#!/usr/bin/env node
/**
 * Quality gate with a ratchet.
 *
 * Runs TypeScript, ESLint, Jest and a release JS bundle for android and ios,
 * compares the results with .quality/baseline.json and fails if anything got worse.
 *
 *   node scripts/quality-gate.js            check against the baseline
 *   node scripts/quality-gate.js --update   lower the baseline to the current numbers
 *                                           (refuses to raise it)
 *   node scripts/quality-gate.js --init     write the baseline from scratch
 *   node scripts/quality-gate.js --json     machine-readable output
 *
 * The baseline only ever goes down. Every fix should leave the numbers equal or lower,
 * and once Jest (or the release bundle) passes it must keep passing.
 */
const {spawnSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, '.quality', 'baseline.json');
const args = new Set(process.argv.slice(2));

function run(cmd, cmdArgs) {
  const res = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: {...process.env, CI: 'true', FORCE_COLOR: '0'},
  });
  return {code: res.status, stdout: res.stdout || '', out: `${res.stdout || ''}${res.stderr || ''}`};
}

function typescript() {
  const {out} = run('npx', ['tsc', '--noEmit', '--pretty', 'false']);
  const errors = out.split('\n').filter(l => /error TS\d+/.test(l));
  const byFile = {};
  for (const line of errors) {
    const file = line.split('(')[0];
    byFile[file] = (byFile[file] || 0) + 1;
  }
  return {errors: errors.length, byFile, sample: errors.slice(0, 15)};
}

function eslint() {
  const {stdout, out} = run('npx', ['eslint', '.', '--ext', '.ts,.tsx,.js', '-f', 'json']);
  let results = [];
  try {
    results = JSON.parse(stdout.slice(stdout.indexOf('[{')));
  } catch (e) {
    console.error('Could not parse ESLint output:\n' + out.slice(0, 1000));
    process.exit(2);
  }
  let errors = 0;
  let warnings = 0;
  const byFile = {};
  for (const r of results) {
    errors += r.errorCount;
    warnings += r.warningCount;
    if (r.errorCount) {
      byFile[path.relative(ROOT, r.filePath)] = r.errorCount;
    }
  }
  return {errors, warnings, byFile};
}

function jest() {
  const {code, out} = run('npx', ['jest', '--ci', '--silent']);
  const m = out.match(/Tests:\s+(.*)/);
  return {passing: code === 0, summary: m ? m[1].trim() : out.split('\n').slice(-6).join(' ')};
}

// Release bundle for both platforms (catches case-sensitive paths and missing modules
// that tsc and Jest can miss). Output goes to a temp dir that is removed afterwards.
function bundle() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rh-bundle-'));
  const failures = [];
  try {
    for (const platform of ['android', 'ios']) {
      const {code, out} = run('npx', [
        'react-native',
        'bundle',
        '--platform',
        platform,
        '--dev',
        'false',
        '--entry-file',
        'index.js',
        '--bundle-output',
        path.join(dir, `rh.${platform}.js`),
        '--assets-dest',
        path.join(dir, `assets-${platform}`),
        '--reset-cache',
      ]);
      if (code !== 0) {
        const lines = out.split('\n').filter(Boolean);
        const errLine = lines.find(l => /error/i.test(l)) || lines.slice(-1)[0] || 'unknown error';
        failures.push(`${platform}: ${errLine.trim()}`);
      }
    }
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
  return {ok: failures.length === 0, failures};
}

function main() {
  const current = {
    tsErrors: 0,
    eslintErrors: 0,
    eslintWarnings: 0,
    jestPassing: false,
    bundleOk: false,
  };
  const ts = typescript();
  const lint = eslint();
  const tests = jest();
  const bundled = bundle();
  current.tsErrors = ts.errors;
  current.eslintErrors = lint.errors;
  current.eslintWarnings = lint.warnings;
  current.jestPassing = tests.passing;
  current.bundleOk = bundled.ok;

  if (args.has('--init')) {
    fs.mkdirSync(path.dirname(BASELINE_PATH), {recursive: true});
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({...current, updatedAt: new Date().toISOString()}, null, 2) + '\n');
    console.log('Baseline written:', current);
    return;
  }

  if (!fs.existsSync(BASELINE_PATH)) {
    console.error('No baseline at .quality/baseline.json. Run with --init first.');
    process.exit(2);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

  const regressions = [];
  if (current.tsErrors > base.tsErrors) {
    regressions.push(`TypeScript errors rose ${base.tsErrors} -> ${current.tsErrors}`);
  }
  if (current.eslintErrors > base.eslintErrors) {
    regressions.push(`ESLint errors rose ${base.eslintErrors} -> ${current.eslintErrors}`);
  }
  if (current.eslintWarnings > base.eslintWarnings) {
    regressions.push(`ESLint warnings rose ${base.eslintWarnings} -> ${current.eslintWarnings}`);
  }
  if (base.jestPassing && !current.jestPassing) {
    regressions.push(`Jest was passing and now fails: ${tests.summary}`);
  }
  if (base.bundleOk && !current.bundleOk) {
    regressions.push(`Release bundle was building and now fails: ${bundled.failures.join('; ')}`);
  }

  const report = {
    baseline: base,
    current,
    regressions,
    jestSummary: tests.summary,
    bundleFailures: bundled.failures,
    tsSample: ts.sample,
    tsByFile: ts.byFile,
    eslintErrorsByFile: lint.byFile,
  };

  if (args.has('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const row = (name, b, c) => `  ${name.padEnd(16)} baseline ${String(b).padStart(5)}   now ${String(c).padStart(5)}`;
    console.log('Quality gate');
    console.log(row('TS errors', base.tsErrors, current.tsErrors));
    console.log(row('ESLint errors', base.eslintErrors, current.eslintErrors));
    console.log(row('ESLint warnings', base.eslintWarnings, current.eslintWarnings));
    console.log(row('Jest passing', base.jestPassing, current.jestPassing));
    console.log(row('Bundle ok', Boolean(base.bundleOk), current.bundleOk));
    console.log(`  Jest: ${tests.summary}`);
    bundled.failures.forEach(f => console.log(`  Bundle: ${f}`));
    if (regressions.length) {
      console.log('\nFAIL');
      regressions.forEach(r => console.log(`  - ${r}`));
    } else {
      console.log('\nPASS');
    }
  }

  if (args.has('--update') && !regressions.length) {
    const next = {
      tsErrors: Math.min(base.tsErrors, current.tsErrors),
      eslintErrors: Math.min(base.eslintErrors, current.eslintErrors),
      eslintWarnings: Math.min(base.eslintWarnings, current.eslintWarnings),
      jestPassing: base.jestPassing || current.jestPassing,
      bundleOk: Boolean(base.bundleOk) || current.bundleOk,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
    if (!args.has('--json')) {
      console.log('Baseline lowered:', next);
    }
  }

  process.exit(regressions.length ? 1 : 0);
}

main();
