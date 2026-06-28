const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const https    = require('https');
const { execSync } = require('child_process');
const router   = express.Router();
const { scanRepo }  = require('../scanner/gitWalker');
const ScanResult    = require('../models/ScanResult');

// ── helpers ───────────────────────────────────────────────────────────────────
function isGitHubUrl(input) {
  return /^https?:\/\/(www\.)?github\.com\/.+\/.+/i.test(input.trim());
}

function parseGitHubUrl(url) {
  // https://github.com/user/repo  or  https://github.com/user/repo.git
  const clean = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const parts = clean.split('/');
  const repo  = parts.pop();
  const user  = parts.pop();
  return { user, repo };
}

function deleteDir(dirPath) {
  try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch (_) {}
}

// Download a file from a URL to disk
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const request = (reqUrl) => {
      https.get(reqUrl, (res) => {
        // Follow redirects (GitHub ZIP URLs redirect)
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          return request(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', reject);
      }).on('error', reject);
    };
    request(url);
  });
}

// Use Node's built-in zlib + tar alternative: unzip via child_process
function unzip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  // unzip is available on Railway (Linux)
  execSync(`unzip -q "${zipPath}" -d "${destDir}"`, { timeout: 60000 });
}

// GitHub provides ZIP downloads without needing git
async function downloadAndExtractRepo(githubUrl, destDir) {
  const { user, repo } = parseGitHubUrl(githubUrl);
  
  // GitHub ZIP URL format
  const zipUrl  = `https://github.com/${user}/${repo}/archive/refs/heads/main.zip`;
  const zipPath = path.join(os.tmpdir(), `${repo}-${Date.now()}.zip`);

  try {
    await downloadFile(zipUrl, zipPath);
  } catch (e) {
    // Try 'master' branch if 'main' fails
    const masterUrl = `https://github.com/${user}/${repo}/archive/refs/heads/master.zip`;
    await downloadFile(masterUrl, zipPath);
  }

  unzip(zipPath, destDir);
  fs.unlinkSync(zipPath);

  // GitHub extracts to repo-main/ or repo-master/ subfolder
  const entries = fs.readdirSync(destDir);
  const subDir  = entries.find(e => e.startsWith(repo));
  return subDir ? path.join(destDir, subDir) : destDir;
}

// ── POST /api/scan ────────────────────────────────────────────────────────────
router.post('/scan', async (req, res) => {
  const { repoPath, githubUrl } = req.body;
  const rawInput = githubUrl || repoPath || '';
  const isRemote = githubUrl || isGitHubUrl(rawInput);

  if (!rawInput) {
    return res.status(400).json({ error: 'Provide a repoPath or githubUrl' });
  }

  const repoName = isRemote
    ? parseGitHubUrl(rawInput).repo
    : path.basename(rawInput);

  const scanRecord = await ScanResult.create({
    repoPath: rawInput, repoName, status: 'running',
  });

  res.json({ scanId: scanRecord._id, message: 'Scan started' });

  if (isRemote) runRemoteScan(scanRecord._id, rawInput);
  else          runLocalScan(scanRecord._id, rawInput);
});

// ── Local scan ────────────────────────────────────────────────────────────────
async function runLocalScan(scanId, repoPath) {
  try {
    const { findings, totalCommitsScanned } = await scanRepo(repoPath);
    await ScanResult.findByIdAndUpdate(scanId, { status: 'done', findings, totalCommitsScanned });
  } catch (err) {
    await ScanResult.findByIdAndUpdate(scanId, { status: 'error', errorMessage: err.message });
  }
}

// ── Remote scan ───────────────────────────────────────────────────────────────
async function runRemoteScan(scanId, githubUrl) {
  const tmpDir = path.join(os.tmpdir(), `env-leak-${scanId}`);
  try {
    // Download ZIP instead of git clone — no git binary needed!
    const repoDir = await downloadAndExtractRepo(githubUrl, tmpDir);

    // Initialize a temporary git repo so gitWalker can scan it
    // (the ZIP doesn't include .git history, so we scan the files directly)
    execSync(`git init && git add . && git commit -m "scan"`, {
      cwd: repoDir,
      timeout: 30000,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'scanner',
        GIT_AUTHOR_EMAIL: 'scanner@scan.com',
        GIT_COMMITTER_NAME: 'scanner',
        GIT_COMMITTER_EMAIL: 'scanner@scan.com',
      }
    });

    const { findings, totalCommitsScanned } = await scanRepo(repoDir);
    await ScanResult.findByIdAndUpdate(scanId, { status: 'done', findings, totalCommitsScanned });
  } catch (err) {
    await ScanResult.findByIdAndUpdate(scanId, {
      status: 'error',
      errorMessage: `Scan failed: ${err.message}`,
    });
  } finally {
    deleteDir(tmpDir);
  }
}

// ── GET /api/results/:scanId ──────────────────────────────────────────────────
router.get('/results/:scanId', async (req, res) => {
  try {
    const result = await ScanResult.findById(req.params.scanId);
    if (!result) return res.status(404).json({ error: 'Scan not found' });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/scans ────────────────────────────────────────────────────────────
router.get('/scans', async (req, res) => {
  try {
    const scans = await ScanResult.find()
      .select('repoName repoPath status totalCommitsScanned createdAt findings')
      .sort({ createdAt: -1 }).limit(20);
    res.json(scans.map(s => ({
      _id: s._id, repoName: s.repoName, repoPath: s.repoPath,
      status: s.status, totalCommitsScanned: s.totalCommitsScanned,
      createdAt: s.createdAt, summary: s.summary, totalFindings: s.findings.length,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE ────────────────────────────────────────────────────────────────────
router.delete('/scans/:scanId', async (req, res) => {
  try {
    await ScanResult.findByIdAndDelete(req.params.scanId);
    res.json({ message: 'Scan deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
