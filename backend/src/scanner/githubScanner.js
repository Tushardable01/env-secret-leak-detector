const https = require('https');

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: {
        'User-Agent': 'env-secret-leak-detector',
        'Accept': 'application/vnd.github.v3+json',
        // Use token if available — increases limit from 60 to 5000 requests/hour
        ...(process.env.GITHUB_TOKEN && {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`
        }),
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
          if (res.statusCode === 403) {
            reject(new Error('GitHub API rate limit exceeded. Try again in an hour.'));
          } else if (res.statusCode >= 400) {
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

function parseGitHubUrl(url) {
  const clean = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const match = clean.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error('Invalid GitHub URL — use format: https://github.com/user/repo');
  return { owner: match[1], repo: match[2] };
}

async function getCommits(owner, repo) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100`;
  return await httpGet(url);
}

async function getCommitDiff(owner, repo, sha) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`;
  const data = await httpGet(url, { 'Accept': 'application/vnd.github.v3.diff' });
  return typeof data === 'string' ? data : JSON.stringify(data);
}

async function scanGitHubRepo(githubUrl, matchPatternsFn) {
  const { owner, repo } = parseGitHubUrl(githubUrl);

  const commits = await getCommits(owner, repo);
  if (!Array.isArray(commits)) {
    throw new Error('Could not fetch commits. Repo may be private or does not exist.');
  }

  const allFindings = [];
  const seen = new Set();

  for (const commit of commits) {
    try {
      const diff = await getCommitDiff(owner, repo, commit.sha);
      const findings = matchPatternsFn(
        diff,
        commit.sha,
        commit.commit?.author?.date || new Date().toISOString(),
        commit.commit?.author?.name || 'unknown'
      );

      for (const f of findings) {
        const key = `${f.type}:${f.preview}:${f.commitHash}`;
        if (!seen.has(key)) {
          seen.add(key);
          allFindings.push(f);
        }
      }
    } catch (err) {
      console.warn(`Skipping commit ${commit.sha}: ${err.message}`);
    }

    // Small delay to be respectful to GitHub API
    await new Promise(r => setTimeout(r, 50));
  }

  return {
    findings: allFindings,
    totalCommitsScanned: commits.length,
  };
}

module.exports = { scanGitHubRepo, parseGitHubUrl };
