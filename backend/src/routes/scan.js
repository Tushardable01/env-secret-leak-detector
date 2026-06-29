const express  = require('express');
const path     = require('path');
const router   = express.Router();
const { scanRepo }         = require('../scanner/gitWalker');
const { scanGitHubRepo, parseGitHubUrl } = require('../scanner/githubScanner');
const { matchPatterns }    = require('../scanner/patternMatcher');
const ScanResult           = require('../models/ScanResult');

// ── helpers ───────────────────────────────────────────────────────────────────
function isGitHubUrl(input) {
  return /^https?:\/\/(www\.)?github\.com\/.+\/.+/i.test(input.trim());
}

// ── POST /api/scan ────────────────────────────────────────────────────────────
router.post('/scan', async (req, res) => {
  const { repoPath, githubUrl } = req.body;
  const rawInput = githubUrl || repoPath || '';
  const isRemote = githubUrl || isGitHubUrl(rawInput);

  if (!rawInput) {
    return res.status(400).json({ error: 'Provide a repoPath or githubUrl' });
  }

  let repoName;
  try {
    repoName = isRemote
      ? parseGitHubUrl(rawInput).repo
      : path.basename(rawInput);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const scanRecord = await ScanResult.create({
    repoPath: rawInput, repoName, status: 'running',
  });

  res.json({ scanId: scanRecord._id, message: 'Scan started' });

  if (isRemote) runGitHubScan(scanRecord._id, rawInput);
  else          runLocalScan(scanRecord._id, rawInput);
});

// ── Local scan (uses git CLI locally) ────────────────────────────────────────
async function runLocalScan(scanId, repoPath) {
  try {
    const { findings, totalCommitsScanned } = await scanRepo(repoPath);
    await ScanResult.findByIdAndUpdate(scanId, {
      status: 'done', findings, totalCommitsScanned,
    });
  } catch (err) {
    await ScanResult.findByIdAndUpdate(scanId, {
      status: 'error', errorMessage: err.message,
    });
  }
}

// ── GitHub scan (uses GitHub API — no git CLI needed) ─────────────────────────
async function runGitHubScan(scanId, githubUrl) {
  try {
    const { findings, totalCommitsScanned } = await scanGitHubRepo(
      githubUrl,
      matchPatterns  // pass the pattern matcher directly
    );
    await ScanResult.findByIdAndUpdate(scanId, {
      status: 'done', findings, totalCommitsScanned,
    });
  } catch (err) {
    await ScanResult.findByIdAndUpdate(scanId, {
      status: 'error',
      errorMessage: `GitHub scan failed: ${err.message}`,
    });
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
