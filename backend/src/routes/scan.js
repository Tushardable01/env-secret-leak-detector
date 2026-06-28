const express = require('express');
const path = require('path');
const router = express.Router();
const { scanRepo } = require('../scanner/gitWalker');
const ScanResult = require('../models/ScanResult');

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/scan
// Body: { repoPath: "/absolute/path/to/your/repo" }
// Creates a scan record, runs the scanner asynchronously, returns scanId
// ─────────────────────────────────────────────────────────────────────────────
router.post('/scan', async (req, res) => {
  const { repoPath } = req.body;

  if (!repoPath) {
    return res.status(400).json({ error: 'repoPath is required' });
  }

  // Derive a friendly repo name from the path
  const repoName = path.basename(repoPath);

  // Create the scan record immediately (status: running)
  const scanRecord = await ScanResult.create({
    repoPath,
    repoName,
    status: 'running',
  });

  // Respond immediately with the scanId so the frontend can start polling
  res.json({ scanId: scanRecord._id, message: 'Scan started' });

  // Run the scan in the background (don't await here)
  runScanInBackground(scanRecord._id, repoPath);
});

async function runScanInBackground(scanId, repoPath) {
  try {
    const { findings, totalCommitsScanned } = await scanRepo(repoPath);

    await ScanResult.findByIdAndUpdate(scanId, {
      status: 'done',
      findings,
      totalCommitsScanned,
    });

    console.log(`Scan ${scanId} complete — ${findings.length} findings in ${totalCommitsScanned} commits`);
  } catch (err) {
    console.error(`Scan ${scanId} failed:`, err.message);
    await ScanResult.findByIdAndUpdate(scanId, {
      status: 'error',
      errorMessage: err.message,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/results/:scanId
// Returns the scan result (findings + summary)
// Frontend polls this until status === 'done'
// ─────────────────────────────────────────────────────────────────────────────
router.get('/results/:scanId', async (req, res) => {
  try {
    const result = await ScanResult.findById(req.params.scanId);
    if (!result) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/scans
// Returns list of all past scans (for history page)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/scans', async (req, res) => {
  try {
    const scans = await ScanResult.find()
      .select('repoName repoPath status totalCommitsScanned createdAt findings')
      .sort({ createdAt: -1 })
      .limit(20);

    // Return with summary counts
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

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/scans/:scanId
// Deletes a scan record
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/scans/:scanId', async (req, res) => {
  try {
    await ScanResult.findByIdAndDelete(req.params.scanId);
    res.json({ message: 'Scan deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
