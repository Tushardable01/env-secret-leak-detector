#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// cli.js  —  Env Secret Leak Detector (CLI mode)
// Usage:
//   node src/cli.js ./my-repo
//   node src/cli.js C:\Users\Lenovo\projects\my-repo --output report.json
//   node src/cli.js ./my-repo --severity critical
//   node src/cli.js ./my-repo --quiet
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const fs   = require('fs');
const { scanRepo }       = require('./scanner/gitWalker');
const { SECRET_PATTERNS } = require('./scanner/patternMatcher');

// ── Tiny colour helpers (no dependencies) ────────────────────────────────────
const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  orange:  '\x1b[33m',
  yellow:  '\x1b[93m',
  green:   '\x1b[32m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
  white:   '\x1b[97m',
  bgRed:   '\x1b[41m',
};

const SEVERITY_COLOR = {
  critical: c.red,
  high:     c.orange,
  medium:   c.yellow,
  low:      c.green,
};

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

// ── Parse CLI arguments ───────────────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);          // strip 'node' and script name
  const opts = {
    repoPath:      null,
    outputFile:    null,
    filterSeverity: null,              // show only this severity level
    quiet:         false,              // suppress banner + progress
    noColor:       false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output'   || arg === '-o') { opts.outputFile    = args[++i]; continue; }
    if (arg === '--severity' || arg === '-s') { opts.filterSeverity = args[++i]; continue; }
    if (arg === '--quiet'    || arg === '-q') { opts.quiet         = true;       continue; }
    if (arg === '--no-color')                 { opts.noColor       = true;       continue; }
    if (arg === '--help'     || arg === '-h') { printHelp(); process.exit(0); }
    if (!arg.startsWith('-'))                 { opts.repoPath      = arg; }
  }

  if (opts.noColor) Object.keys(c).forEach(k => (c[k] = ''));

  return opts;
}

function printHelp() {
  console.log(`
${c.bold}${c.cyan}Env Secret Leak Detector${c.reset} — scan git history for leaked secrets

${c.bold}Usage:${c.reset}
  node src/cli.js <repo-path> [options]

${c.bold}Options:${c.reset}
  -o, --output <file>      Save results to a JSON file
  -s, --severity <level>   Filter output: critical | high | medium | low
  -q, --quiet              Suppress banner and progress (only show findings)
      --no-color           Disable colored output
  -h, --help               Show this help

${c.bold}Examples:${c.reset}
  node src/cli.js ./my-project
  node src/cli.js C:\\Users\\Lenovo\\projects\\talenttrack
  node src/cli.js ./my-project --severity critical
  node src/cli.js ./my-project --output report.json
  node src/cli.js ./my-project --quiet --no-color
`);
}

// ── Visual helpers ────────────────────────────────────────────────────────────
function printBanner() {
  console.log(`
${c.cyan}${c.bold}  ███████╗███╗   ██╗██╗   ██╗    ██╗     ███████╗ █████╗ ██╗  ██╗${c.reset}
${c.cyan}${c.bold}  ██╔════╝████╗  ██║██║   ██║    ██║     ██╔════╝██╔══██╗██║ ██╔╝${c.reset}
${c.cyan}${c.bold}  █████╗  ██╔██╗ ██║██║   ██║    ██║     █████╗  ███████║█████╔╝ ${c.reset}
${c.cyan}${c.bold}  ██╔══╝  ██║╚██╗██║╚██╗ ██╔╝    ██║     ██╔══╝  ██╔══██║██╔═██╗ ${c.reset}
${c.cyan}${c.bold}  ███████╗██║ ╚████║ ╚████╔╝     ███████╗███████╗██║  ██║██║  ██╗${c.reset}
${c.cyan}${c.bold}  ╚══════╝╚═╝  ╚═══╝  ╚═══╝      ╚══════╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝${c.reset}
${c.dim}  Scans entire git history for leaked secrets & API keys${c.reset}
${c.dim}  ─────────────────────────────────────────────────────${c.reset}
${c.dim}  Built by ${c.reset}${c.bold}${c.white}Tushar Dable${c.reset}${c.dim}  ·  github.com/Tushardable01${c.reset}
`);
}

function severityLabel(s) {
  const col = SEVERITY_COLOR[s] || '';
  return `${col}${c.bold}[${s.toUpperCase()}]${c.reset}`;
}

// Spinner frames
const SPINNER = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
let spinnerIdx = 0;
let spinnerTimer = null;
let lastProgressLine = '';

function startSpinner(msg) {
  spinnerTimer = setInterval(() => {
    const frame = SPINNER[spinnerIdx++ % SPINNER.length];
    const line = `\r  ${c.cyan}${frame}${c.reset}  ${msg}`;
    process.stdout.write(line + ' '.repeat(Math.max(0, lastProgressLine.length - line.length)));
    lastProgressLine = line;
  }, 80);
}

function updateSpinner(msg) {
  lastProgressLine = `\r  ${SPINNER[spinnerIdx % SPINNER.length]}  ${msg}`;
}

function stopSpinner(finalMsg) {
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
  }
  process.stdout.write('\r' + ' '.repeat(lastProgressLine.length + 4) + '\r');
  if (finalMsg) console.log(finalMsg);
}

// ── Print a single finding ────────────────────────────────────────────────────
function printFinding(f, index) {
  const shortHash = (f.commitHash || '').substring(0, 7);
  const date = f.commitDate
    ? new Date(f.commitDate).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
      })
    : 'unknown date';

  console.log(`\n  ${c.dim}${'─'.repeat(60)}${c.reset}`);
  console.log(`  ${severityLabel(f.severity)}  ${c.bold}${c.white}${f.type}${c.reset}`);
  console.log(`  ${c.dim}Commit${c.reset}  ${c.magenta}${shortHash}${c.reset}  ${c.dim}·${c.reset}  ${date}${f.authorName ? `  ${c.dim}·${c.reset}  ${f.authorName}` : ''}`);
  console.log(`  ${c.dim}Secret${c.reset}  ${f.preview}`);

  if (f.hint) {
    console.log(`  ${c.dim}Fix   ${c.reset}  ${c.cyan}${f.hint}${c.reset}`);
  }
}

// ── Summary box ───────────────────────────────────────────────────────────────
function printSummary(findings, totalCommits, repoName, elapsed) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  findings.forEach(f => counts[f.severity]++);

  const total = findings.length;
  const status = total === 0
    ? `${c.green}${c.bold}✅  No secrets found${c.reset}`
    : `${c.red}${c.bold}🚨  ${total} finding${total !== 1 ? 's' : ''} detected${c.reset}`;

  console.log(`\n  ${c.dim}${'═'.repeat(60)}${c.reset}`);
  console.log(`  ${c.bold}SCAN COMPLETE${c.reset}  ${c.dim}${repoName}${c.reset}`);
  console.log(`  ${c.dim}${'═'.repeat(60)}${c.reset}`);
  console.log(`  ${status}`);
  console.log();
  console.log(`  ${c.dim}Commits scanned :${c.reset}  ${c.bold}${totalCommits}${c.reset}`);
  console.log(`  ${c.dim}Time taken      :${c.reset}  ${c.bold}${elapsed}s${c.reset}`);
  console.log();

  if (total > 0) {
    if (counts.critical) console.log(`  ${c.red}${c.bold}  ● Critical  ${counts.critical}${c.reset}`);
    if (counts.high)     console.log(`  ${c.orange}${c.bold}  ● High      ${counts.high}${c.reset}`);
    if (counts.medium)   console.log(`  ${c.yellow}${c.bold}  ● Medium    ${counts.medium}${c.reset}`);
    if (counts.low)      console.log(`  ${c.green}${c.bold}  ● Low       ${counts.low}${c.reset}`);
  }
  console.log(`  ${c.dim}${'─'.repeat(60)}${c.reset}\n`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.repoPath) {
    console.error(`\n  ${c.red}Error: No repository path provided.${c.reset}`);
    console.error(`  Usage: node src/cli.js <repo-path>\n`);
    process.exit(1);
  }

  const repoPath = path.resolve(opts.repoPath);
  const repoName = path.basename(repoPath);

  if (!opts.quiet) printBanner();

  console.log(`  ${c.bold}Repository${c.reset}  ${c.cyan}${repoPath}${c.reset}\n`);

  if (!fs.existsSync(repoPath)) {
    console.error(`  ${c.red}Error: Path does not exist: ${repoPath}${c.reset}\n`);
    process.exit(1);
  }
  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    console.error(`  ${c.red}Error: Not a git repository (no .git folder found)${c.reset}\n`);
    process.exit(1);
  }

  // Start scan
  const startTime = Date.now();
  let commitCount = 0;

  if (!opts.quiet) {
    startSpinner('Initialising scanner…');
  }

  let scanResult;
  try {
    scanResult = await scanRepo(repoPath, (progress) => {
      commitCount = progress.total;
      if (!opts.quiet) {
        updateSpinner(
          `Scanning commit ${progress.current}/${progress.total}  ${c.dim}(${progress.commitHash})${c.reset}`
        );
      }
    });
  } catch (err) {
    stopSpinner();
    console.error(`\n  ${c.red}Scan failed: ${err.message}${c.reset}\n`);
    process.exit(1);
  }

  stopSpinner();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  let { findings, totalCommitsScanned } = scanResult;

  // Apply severity filter if --severity flag was passed
  if (opts.filterSeverity) {
    const valid = ['critical','high','medium','low'];
    if (!valid.includes(opts.filterSeverity)) {
      console.error(`  ${c.red}Invalid severity: "${opts.filterSeverity}". Use: critical | high | medium | low${c.reset}\n`);
      process.exit(1);
    }
    const before = findings.length;
    findings = findings.filter(f => SEVERITY_ORDER[f.severity] <= SEVERITY_ORDER[opts.filterSeverity]);
    const filtered = before - findings.length;
    if (filtered > 0) {
      console.log(`  ${c.dim}Showing ${findings.length} findings (filtered out ${filtered} below "${opts.filterSeverity}")${c.reset}\n`);
    }
  }

  // Sort by severity
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  // Print findings
  if (findings.length > 0) {
    console.log(`  ${c.bold}FINDINGS${c.reset}`);
    findings.forEach((f, i) => printFinding(f, i));
  }

  // Summary
  printSummary(findings, totalCommitsScanned, repoName, elapsed);

  // Save JSON report if --output flag was passed
  if (opts.outputFile) {
    const report = {
      scannedAt:           new Date().toISOString(),
      repoPath,
      repoName,
      totalCommitsScanned,
      elapsedSeconds:      parseFloat(elapsed),
      summary: {
        critical: findings.filter(f => f.severity === 'critical').length,
        high:     findings.filter(f => f.severity === 'high').length,
        medium:   findings.filter(f => f.severity === 'medium').length,
        low:      findings.filter(f => f.severity === 'low').length,
        total:    findings.length,
      },
      findings,
    };

    const outPath = path.resolve(opts.outputFile);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`  ${c.green}✓${c.reset}  Report saved → ${c.cyan}${outPath}${c.reset}\n`);
  }

  // Exit code: 1 if critical findings found (useful in CI pipelines)
  const hasCritical = findings.some(f => f.severity === 'critical');
  process.exit(hasCritical ? 1 : 0);
}

main().catch(err => {
  console.error(`\n  ${c.red}Unexpected error: ${err.message}${c.reset}\n`);
  process.exit(1);
});
