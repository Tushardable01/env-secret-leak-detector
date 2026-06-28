const express   = require('express');
const path      = require('path');
const fs        = require('fs');
const os        = require('os');
const { exec }  = require('child_process');
const router    = express.Router();
const { scanRepo }  = require('../scanner/gitWalker');
const ScanResult    = require('../models/ScanResult');

// ── helpers ───────────────────────────────────────────────────────────────────
function isGitHubUrl(input) {
  return /^https?:\/\/(www\.)?github\.com\/.+\/.+/i.test(input.trim());
}

function repoNameFromUrl(url) {
  return url.trim().replace(/\.git$/, '').split('/').pop();
}

function deleteDir(dirPath) {
  try { fs.rmSync(dirPath, { recursive: true, force: true }); } catch (_) {}
}

function cloneWithExec(githubUrl, destPath) {
  return new Promise((resolve, reject) => {
    // Use --depth 50 for speed, no credentials needed for public repos
    const cmd = `git clone --depth 50 "${githubUrl.trim()}" "${destPath}"`;
    exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve();
    });
  });
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
    ? repoNameFromUrl(rawInput)
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
    await cloneWithExec(githubUrl, tmpDir);
    const { findings, totalCommitsScanned } = await scanRepo(tmpDir);
    await ScanResult.findByIdAndUpdate(scanId, { status: 'done', findings, totalCommitsScanned });
  } catch (err) {
    await ScanResult.findByIdAndUpdate(scanId, {
      status: 'error',
      errorMessage: `Clone/scan failed: ${err.message}`,
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

// ── DELETE /api/scans/:scanId ─────────────────────────────────────────────────
router.delete('/scans/:scanId', async (req, res) => {
  try {
    await ScanResult.findByIdAndDelete(req.params.scanId);
    res.json({ message: 'Scan deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
