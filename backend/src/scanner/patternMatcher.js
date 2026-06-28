// ─────────────────────────────────────────────────────────────────────────────
// patternMatcher.js
// Each pattern has: name, severity, regex, hint (remediation advice)
// ─────────────────────────────────────────────────────────────────────────────

const SECRET_PATTERNS = [
  // ── Cloud providers ──────────────────────────────────────────────────────
  {
    name: 'AWS Access Key ID',
    severity: 'critical',
    regex: /AKIA[0-9A-Z]{16}/g,
    hint: 'Go to AWS IAM → Delete this access key → Create a new one',
  },
  {
    name: 'AWS Secret Access Key',
    severity: 'critical',
    regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*['"]?([A-Za-z0-9+\/]{40})['"]?/gi,
    hint: 'Rotate immediately in AWS IAM console',
  },
  {
    name: 'Google API Key',
    severity: 'high',
    regex: /AIza[0-9A-Za-z\-_]{35}/g,
    hint: 'Delete in Google Cloud Console → APIs & Services → Credentials',
  },
  {
    name: 'Google OAuth Client Secret',
    severity: 'high',
    regex: /GOCSPX-[A-Za-z0-9_-]{28}/g,
    hint: 'Regenerate in Google Cloud Console → OAuth 2.0 credentials',
  },
  {
    name: 'Azure Connection String',
    severity: 'critical',
    regex: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+\/=]{86,}/g,
    hint: 'Rotate in Azure Portal → Storage Account → Access Keys',
  },

  // ── Payment providers ─────────────────────────────────────────────────────
  {
    name: 'Stripe Secret Key (live)',
    severity: 'critical',
    regex: /sk_live_[0-9a-zA-Z]{24,}/g,
    hint: 'URGENT: Go to Stripe Dashboard → Developers → API Keys → Roll secret key',
  },
  {
    name: 'Stripe Secret Key (test)',
    severity: 'low',
    regex: /sk_test_[0-9a-zA-Z]{24,}/g,
    hint: 'Test key — low risk but still remove from code',
  },
  {
    name: 'Stripe Publishable Key (live)',
    severity: 'medium',
    regex: /pk_live_[0-9a-zA-Z]{24,}/g,
    hint: 'Publishable keys are lower risk but should not be in git history',
  },
  {
    name: 'Razorpay Key ID',
    severity: 'high',
    regex: /rzp_live_[A-Za-z0-9]{14}/g,
    hint: 'Regenerate in Razorpay Dashboard → Settings → API Keys',
  },

  // ── Source control & CI ───────────────────────────────────────────────────
  {
    name: 'GitHub Personal Access Token',
    severity: 'critical',
    regex: /ghp_[A-Za-z0-9]{36}/g,
    hint: 'Delete token at github.com/settings/tokens immediately',
  },
  {
    name: 'GitHub OAuth Token',
    severity: 'critical',
    regex: /gho_[A-Za-z0-9]{36}/g,
    hint: 'Revoke at github.com/settings/applications',
  },
  {
    name: 'GitHub App Token',
    severity: 'critical',
    regex: /(?:ghu|ghs|ghr)_[A-Za-z0-9]{36}/g,
    hint: 'Revoke this GitHub App installation token',
  },
  {
    name: 'GitLab Personal Token',
    severity: 'critical',
    regex: /glpat-[A-Za-z0-9\-_]{20}/g,
    hint: 'Revoke at gitlab.com/-/profile/personal_access_tokens',
  },

  // ── Messaging & communication ─────────────────────────────────────────────
  {
    name: 'Slack Bot Token',
    severity: 'high',
    regex: /xoxb-[0-9]{11}-[0-9]{11}-[A-Za-z0-9]{24}/g,
    hint: 'Revoke at api.slack.com → Your Apps → OAuth & Permissions',
  },
  {
    name: 'Slack User Token',
    severity: 'high',
    regex: /xoxp-[0-9]{11}-[0-9]{11}-[0-9]{11}-[A-Za-z0-9]{32}/g,
    hint: 'Revoke user token in Slack App settings',
  },
  {
    name: 'Slack Webhook URL',
    severity: 'medium',
    regex: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g,
    hint: 'Regenerate webhook in Slack App → Incoming Webhooks',
  },
  {
    name: 'Twilio Account SID',
    severity: 'high',
    regex: /AC[a-z0-9]{32}/g,
    hint: 'Rotate credentials in Twilio Console → Account → API Keys',
  },
  {
    name: 'Twilio Auth Token',
    severity: 'critical',
    regex: /(?:twilio|TWILIO)(?:.{0,20})(?:auth_token|AUTH_TOKEN)\s*[=:]\s*['"]?([a-f0-9]{32})['"]?/gi,
    hint: 'Rotate in Twilio Console → Account Settings',
  },
  {
    name: 'SendGrid API Key',
    severity: 'high',
    regex: /SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}/g,
    hint: 'Delete key at app.sendgrid.com → Settings → API Keys',
  },
  {
    name: 'Mailgun API Key',
    severity: 'high',
    regex: /key-[0-9a-f]{32}/g,
    hint: 'Regenerate at app.mailgun.com → Settings → API Keys',
  },

  // ── Database connection strings ───────────────────────────────────────────
  {
    name: 'MongoDB Connection String',
    severity: 'critical',
    regex: /mongodb(?:\+srv)?:\/\/[^:]+:[^@\s]+@[^\s'"]+/g,
    hint: 'Rotate DB password in MongoDB Atlas → Database Access',
  },
  {
    name: 'PostgreSQL Connection String',
    severity: 'critical',
    regex: /postgres(?:ql)?:\/\/[^:]+:[^@\s]+@[^\s'"]+/g,
    hint: 'Change DB user password and update connection string in env vars',
  },
  {
    name: 'MySQL Connection String',
    severity: 'critical',
    regex: /mysql:\/\/[^:]+:[^@\s]+@[^\s'"]+/g,
    hint: 'Rotate MySQL user password immediately',
  },
  {
    name: 'Redis Connection String',
    severity: 'high',
    regex: /redis:\/\/:[^@\s]+@[^\s'"]+/g,
    hint: 'Update Redis AUTH password and rotate',
  },

  // ── Auth & tokens ─────────────────────────────────────────────────────────
  {
    name: 'JWT Secret',
    severity: 'high',
    regex: /(?:jwt_secret|JWT_SECRET|jwtSecret)\s*[=:]\s*['"]?([A-Za-z0-9_\-]{16,})['"]?/gi,
    hint: 'Change JWT secret — all existing tokens will be invalidated',
  },
  {
    name: 'Private Key (PEM)',
    severity: 'critical',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    hint: 'Revoke and regenerate this private key immediately',
  },
  {
    name: 'Generic Password in Code',
    severity: 'medium',
    regex: /(?:password|passwd|PASSWD|PASSWORD)\s*[=:]\s*['"]([^'"]{8,})['"/]/gi,
    hint: 'Move to environment variable — never hardcode passwords',
  },
  {
    name: 'Generic API Key Assignment',
    severity: 'medium',
    regex: /(?:api_key|apikey|API_KEY|APIKEY)\s*[=:]\s*['"]([A-Za-z0-9_\-]{20,})['"]?/gi,
    hint: 'Move to .env file and add .env to .gitignore',
  },
  {
    name: 'Bearer Token in Code',
    severity: 'medium',
    regex: /Bearer\s+[A-Za-z0-9\-_]{20,}/g,
    hint: 'Never hardcode Bearer tokens — use environment variables',
  },

  // ── .env file accidentally committed ──────────────────────────────────────
  {
    name: '.env file committed',
    severity: 'critical',
    regex: /^\+{0,3}\+\+\+ b\/\.env\b/gm,
    hint: 'Add .env to .gitignore and run: git rm --cached .env',
  },
  {
    name: '.env.local file committed',
    severity: 'high',
    regex: /^\+{0,3}\+\+\+ b\/\.env\.(?:local|production|staging|development)/gm,
    hint: 'Add all .env.* variants to .gitignore',
  },
];

// Lines starting with - in a diff are deletions — we skip those
// Lines starting with + are additions — we flag those
function isAddedLine(context) {
  return context.includes('\n+') || context.startsWith('+');
}

function matchPatterns(diffText, commitHash, commitDate, authorName) {
  const findings = [];

  for (const pattern of SECRET_PATTERNS) {
    // Reset regex state (important for /g flag)
    pattern.regex.lastIndex = 0;

    let match;
    while ((match = pattern.regex.exec(diffText)) !== null) {
      // Extract surrounding context (200 chars before match)
      const contextStart = Math.max(0, match.index - 200);
      const lineContext = diffText.substring(contextStart, match.index + 80);

      // Skip if this is a deleted line (we only care about additions)
      if (!isAddedLine(lineContext)) continue;

      // Skip common false positives
      if (isFalsePositive(match[0], lineContext)) continue;

      findings.push({
        type: pattern.name,
        severity: pattern.severity,
        commitHash,
        commitDate: new Date(commitDate),
        authorName,
        // Redact the secret — show only first 6 chars
        preview: match[0].substring(0, 6) + '••••••••REDACTED••••••••',
        lineContext: lineContext
          .replace(match[0], '[SECRET REDACTED]')
          .substring(0, 300),
        hint: pattern.hint,
      });
    }
  }

  return findings;
}

function isFalsePositive(matchedValue, context) {
  const falsePositivePatterns = [
    /example/i,
    /placeholder/i,
    /your[_-]?key[_-]?here/i,
    /insert[_-]?key/i,
    /dummy/i,
    /fake/i,
    /test123/i,
    /changeme/i,
    /xxx+/i,
    /\*{3,}/,          // already masked values like ****
    /\.md$/,           // documentation files
    /\.txt$/,
  ];

  return falsePositivePatterns.some(
    (fp) => fp.test(matchedValue) || fp.test(context)
  );
}

module.exports = { matchPatterns, SECRET_PATTERNS };
