// ─────────────────────────────────────────────────────────────────────────────
// gitWalker.js
// Walks the ENTIRE git history of a repo (including commits where secrets
// were later deleted) and returns all pattern matches.
// ─────────────────────────────────────────────────────────────────────────────

const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');
const { matchPatterns } = require('./patternMatcher');

async function scanRepo(repoPath, onProgress) {
  // Validate the path exists and is a git repo
  const resolvedPath = path.resolve(repoPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Path does not exist: ${resolvedPath}`);
  }

  if (!fs.existsSync(path.join(resolvedPath, '.git'))) {
    throw new Error(`Not a git repository: ${resolvedPath}`);
  }

  const git = simpleGit(resolvedPath);

  // Get full commit log (all branches, all history)
  const log = await git.log([
    '--all',
    '--full-history',
    '--no-merges', // skip merge commits (they don't introduce new code)
  ]);

  const commits = log.all;
  const totalCommits = commits.length;
  const allFindings = [];

  if (totalCommits === 0) {
    return { findings: [], totalCommitsScanned: 0 };
  }

  // Walk each commit
  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];

    // Report progress back to the caller (used for SSE streaming)
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: totalCommits,
        commitHash: commit.hash.substring(0, 7),
        percent: Math.round(((i + 1) / totalCommits) * 100),
      });
    }

    try {
      // Get the full diff for this commit
      // --unified=0 means no context lines, just the changed lines
      const diff = await git.show([
        commit.hash,
        '--unified=0',
        '--no-color',
        '--diff-filter=AM', // only Added or Modified files
      ]);

      // Run all patterns against this diff
      const findings = matchPatterns(
        diff,
        commit.hash,
        commit.date,
        commit.author_name
      );

      allFindings.push(...findings);
    } catch (err) {
      // Some commits (e.g. initial commit) may fail with git show
      // We skip those silently
      console.warn(`Skipping commit ${commit.hash}: ${err.message}`);
    }
  }

  // Deduplicate: same secret type + same preview in different commits
  // (e.g. the same key committed, removed, then committed again)
  const seen = new Set();
  const dedupedFindings = allFindings.filter((f) => {
    const key = `${f.type}:${f.preview}:${f.commitHash}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    findings: dedupedFindings,
    totalCommitsScanned: totalCommits,
  };
}

module.exports = { scanRepo };
