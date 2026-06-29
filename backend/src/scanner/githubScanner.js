// ─────────────────────────────────────────────────────────────────────────────
// githubScanner.js
// Uses GitHub API to fetch repo contents + commits without needing git CLI
// ─────────────────────────────────────────────────────────────────────────────

const https = require('https');

// ── HTTP helper ───────────────────────────────────────────────────────────────
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'env-secret-leak-detector',
        'Accept': 'application/vnd.github.v3+json',
        ...headers,
      },
    };
    const request = (reqUrl) => {
      https.get(reqUrl, opts, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          return request(res.headers.location);
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`GitHub API error ${res.statusCode}: ${data}`));
          } else {
            try { resolve(JSON.parse(data)); }
            catch (e) { resolve(data); }
          }
        });
      }).on('error', reject);
    };
    request(url);
  });
}

// ── Parse GitHub URL ──────────────────────────────────────────────────────────
function parseGitHubUrl(url) {
  const clean = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const match = clean.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error('Invalid GitHub URL');
  return { owner: match[1], repo: match[2] };
}

// ── Get all commits (up to 100) ───────────────────────────────────────────────
async function getCommits(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`;
  return await httpGet(url);
}

// ── Get diff for a single commit ──────────────────────────────────────────────
async function getCommitDiff(owner, repo, sha) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;
  const data = await httpGet(url, { 'Accept': 'application/vnd.github.v3.diff' });
  return typeof data === 'string' ? data : JSON.stringify(data);
}

// ── Main scanner function ─────────────────────────────────────────────────────
async function scanGitHubRepo(githubUrl, matchPatternsFn) {
  const { owner, repo } = parseGitHubUrl(githubUrl);

  // Get commits
  const commits = await getCommits(owner, repo);
  if (!Array.isArray(commits)) {
    throw new Error('Could not fetch commits. Repo may be private or not exist.');
  }

  const allFindings = [];
  const seen = new Set();

  // Scan each commit's diff
  for (const commit of commits) {
    try {
      const diff = await getCommitDiff(owner, repo, commit.sha);
      const findings = matchPatternsFn(
        diff,
        commit.sha,
        commit.commit?.author?.date || new Date().toISOString(),
        commit.commit?.author?.name || 'unknown'
      );

      // Deduplicate
      for (const f of findings) {
        const key = `${f.type}:${f.preview}:${f.commitHash}`;
        if (!seen.has(key)) {
          seen.add(key);
          allFindings.push(f);
        }
      }
    } catch (err) {
      // Skip commits that fail
      console.warn(`Skipping commit ${commit.sha}: ${err.message}`);
    }

    // Small delay to avoid GitHub rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  return {
    findings: allFindings,
    totalCommitsScanned: commits.length,
  };
}

module.exports = { scanGitHubRepo, parseGitHubUrl };
