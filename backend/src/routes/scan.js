const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const router   = express.Router();
const simpleGit = require('simple-git');
const { scanRepo }    = require('../scanner/gitWalker');
const ScanResult      = require('../models/ScanResult');

// ── helpers ───────────────────────────────────────────────────────────────────

function isGitHubUrl(input) {
  return /^https?:\/\/(www\.)?github\.com\/.+\/.+/i.test(input.trim());
}

function repoNameFromUrl(url) {
  // "https://github.com/user/repo.git" → "repo"
  return url.trim().replace(/\.git$/, '').split('/').pop();
}

async function cloneRepo(githubUrl, destPath) {
  const git = simpleGit();
  await git.clone(githubUrl.trim(), destPath, ['--depth', '50']);
}

function deleteDir(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (_) {}
}

// ── POST /api/scan ────────────────────────────────────────────────────────────
// Accepts either:
//   { repoPath: "/local/path" }          ← local mode (CLI / local UI)
//   { githubUrl: "https://github.com/…" } ← remote mode (live website)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/scan', async (req, res) => {
  const { repoPath, githubUrl } = req.body;

  // Auto-detect: if user pasted a GitHub URL into the repoPath field
  const rawInput   = githubUrl || repoPath || '';
  const isRemote   = githubUrl || isGitHubUrl(rawInput);

  if (!rawInput) {
    return res.status(400).json({ error: 'Provide a repoPath or githubUrl' });
  }

  const repoName = isRemote
    ? repoNameFromUrl(rawInput)
    : path.basename(rawInput);

  // Create scan record immediately
  const scanRecord = await ScanResult.create({
    repoPath: rawInput,
    repoName,
    status: 'running',
  });

  res.json({ scanId: scanRecord._id, message: 'Scan started' });

  // Run in background
  if (isRemote) {
    runRemoteScan(scanRecord._id, rawInput, repoName);
  } else {
    runLocalScan(scanRecord._id, rawInput);
  }
});

// ── Local scan (unchanged behaviour) ─────────────────────────────────────────
async function runLocalScan(scanId, repoPath) {
  try {
    const { findings, totalCommitsScanned } = await scanRepo(repoPath);
    await ScanResult.findByIdAndUpdate(scanId, {
      status: 'done',
      findings,
      totalCommitsScanned,
    });
  } catch (err) {
    await ScanResult.findByIdAndUpdate(scanId, {
      status: 'error',
      errorMessage: err.message,
    });
  }
}

// ── Remote scan (clone → scan → delete) ──────────────────────────────────────
async function runRemoteScan(scanId, githubUrl, repoName) {
  // Clone into a unique temp directory so parallel scans don't collide
  const tmpDir = path.join(os.tmpdir(), `env-leak-${scanId}`);

  try {
    // 1. Clone (shallow — last 50 commits keeps things fast)
    await cloneRepo(githubUrl, tmpDir);

    // 2. Scan the cloned repo
    const { findings, totalCommitsScanned } = await scanRepo(tmpDir);

    // 3. Save results
    await ScanResult.findByIdAndUpdate(scanId, {
      status: 'done',
      findings,
      totalCommitsScanned,
    });
  } catch (err) {
    await ScanResult.findByIdAndUpdate(scanId, {
      status: 'error',
      errorMessage: `Clone/scan failed: ${err.message}`,
    });
  } finally {
    // 4. Always delete the temp clone
    deleteDir(tmpDir);
  }
}

// ── GET /api/results/:scanId ──────────────────────────────────────────────────
router.get('/results/:scanId', async (req, res) => {
  try {
    const result = await ScanResult.findById(req.params.scanId);
    if (!result) return res.status(404).json({ error: 'Scan not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/scans ────────────────────────────────────────────────────────────
router.get('/scans', async (req, res) => {
  try {
    const scans = await ScanResult.find()
      .select('repoName repoPath status totalCommitsScanned createdAt findings')
      .sort({ createdAt: -1 })
      .limit(20);

    const scansWithSummary = scans.map((s) => ({
      _id: s._id,
      repoName: s.repoName,
      repoPath: s.repoPath,
      status: s.status,
      totalCommitsScanned: s.totalCommitsScanned,
      createdAt: s.createdAt,
      summary: s.summary,
      totalFindings: s.findings.length,
    }));

    res.json(scansWithSummary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/scans/:scanId ─────────────────────────────────────────────────
router.delete('/scans/:scanId', async (req, res) => {
  try {
    await ScanResult.findByIdAndDelete(req.params.scanId);
    res.json({ message: 'Scan deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
