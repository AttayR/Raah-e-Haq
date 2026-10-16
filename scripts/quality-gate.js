#!/usr/bin/env node
/**
 * Quality gate with a ratchet.
 *
 * Runs TypeScript, ESLint, Jest and a release JS bundle for android and ios (which must
 * not contain dev-only modules such as the kit gallery),
 * compares the results with .quality/baseline.json and fails if anything got worse.
 *
 *   node scripts/quality-gate.js            check against the baseline
 *   node scripts/quality-gate.js --update   lower the baseline to the current numbers
 *                                           (refuses to raise it)
 *   node scripts/quality-gate.js --init     write the baseline from scratch
 *   node scripts/quality-gate.js --json     machine-readable output
 *
 * Jest only counts as passing when the run executed every test file that `jest --listTests`
 * finds and each of them ran at least one test (T-541); failing tests are listed by name.
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

// T-541: the run must execute every test file Jest can find. Watchman is off for both the
// listing and the run: its watch root is the main checkout, which holds every agent worktree
// (and its node_modules), so it recrawls constantly and a crawl that misses files would drop
// suites without any error. The listing and the run are separate processes, so a suite that
// silently goes missing in between (or a run that is cut short) still shows up as a mismatch.
function expectedTestFiles() {
  const {code, stdout, out} = run('npx', ['jest', '--listTests', '--json', '--no-watchman']);
  try {
    const files = JSON.parse(stdout.slice(stdout.indexOf('[')));
    if (code === 0 && Array.isArray(files) && files.length) {
      return {files: files.map(f => path.relative(ROOT, f)).sort()};
    }
  } catch (e) {
    // reported below
  }
  return {error: `could not list the test files: ${out.split('\n').filter(Boolean).slice(-3).join(' ')}`};
}

// Pure: checks a Jest --json report (absolute file names) against the listed test files
// (relative to root). Exported for its tests.
function checkJestReport(report, expectedFiles, root = ROOT) {
  const problems = [];
  const ran = (report.testResults || []).map(r => path.relative(root, r.name)).sort();
  const ranSet = new Set(ran);
  const expectedSet = new Set(expectedFiles);
  const missing = expectedFiles.filter(f => !ranSet.has(f));
  const extra = ran.filter(f => !expectedSet.has(f));
  if (missing.length) {
    problems.push(`${missing.length} of ${expectedFiles.length} test files did not run: ${missing.slice(0, 5).join(', ')}`);
  }
  if (extra.length) {
    problems.push(`ran ${extra.length} test files that the listing did not have: ${extra.slice(0, 5).join(', ')}`);
  }
  const empty = (report.testResults || [])
    .filter(r => !(r.assertionResults || []).some(a => a.status === 'passed' || a.status === 'failed'))
    .map(r => path.relative(root, r.name));
  if (empty.length) {
    problems.push(`test files that ran no test: ${empty.slice(0, 5).join(', ')}`);
  }
  if (report.numRuntimeErrorTestSuites) {
    problems.push(`${report.numRuntimeErrorTestSuites} test files failed to run`);
  }
  if (report.wasInterrupted) {
    problems.push('the run was interrupted');
  }
  const failedTests = [];
  for (const r of report.testResults || []) {
    const file = path.relative(root, r.name);
    const failed = (r.assertionResults || []).filter(a => a.status === 'failed');
    failed.forEach(a => failedTests.push(`${file} > ${a.fullName}`));
    if (!failed.length && r.status === 'failed') {
      const why = String(r.message || '').split('\n').map(l => l.trim()).find(Boolean) || 'failed to run';
      failedTests.push(`${file} (${why.slice(0, 200)})`);
    }
  }
  return {problems, failedTests};
}

function jest() {
  const expected = expectedTestFiles();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rh-jest-'));
  const outputFile = path.join(dir, 'jest.json');
  let report = null;
  let code;
  let out;
  try {
    ({code, out} = run('npx', ['jest', '--ci', '--silent', '--no-watchman', '--json', `--outputFile=${outputFile}`]));
    try {
      report = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    } catch (e) {
      report = null;
    }
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
  const m = out.match(/Tests:\s+(.*)/);
  const summary = m ? m[1].trim() : out.split('\n').slice(-6).join(' ');
  const problems = [];
  let failedTests = [];
  if (expected.error) {
    problems.push(expected.error);
  }
  if (!report) {
    problems.push('Jest wrote no JSON report');
  } else if (expected.files) {
    const checked = checkJestReport(report, expected.files);
    problems.push(...checked.problems);
    failedTests = checked.failedTests;
  }
  const suites = report ? `${report.numTotalTestSuites} files` : '? files';
  const skipped = report ? report.numPendingTests + report.numTodoTests : 0;
  return {
    passing: code === 0 && Boolean(report && report.success) && problems.length === 0,
    summary: `${summary} (${suites}${skipped ? `, ${skipped} skipped` : ''})`,
    problems,
    failedTests,
  };
}

// Dev-only modules that must never reach a release bundle (PERF-08, T-531). The host stays:
// it is the `__DEV__`-gated entry point and renders nothing in release.
const DEV_ONLY_SOURCE = /(^|\/)src\/features\/dev-gallery\/(?!DevKitGalleryHost\.tsx$)/;

function devOnlySources(sourceMapPath) {
  try {
    const map = JSON.parse(fs.readFileSync(sourceMapPath, 'utf8'));
    return (map.sources || []).filter(s => DEV_ONLY_SOURCE.test(String(s).replace(/\\/g, '/')));
  } catch (e) {
    return [`could not read the source map (${e.message})`];
  }
}

// Release bundle for both platforms (catches case-sensitive paths and missing modules
// that tsc and Jest can miss), and no dev-only module in it. Output goes to a temp dir that
// is removed afterwards.
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
        '--sourcemap-output',
        path.join(dir, `rh.${platform}.js.map`),
        '--assets-dest',
        path.join(dir, `assets-${platform}`),
        '--reset-cache',
      ]);
      if (code !== 0) {
        const lines = out.split('\n').filter(Boolean);
        const errLine = lines.find(l => /error/i.test(l)) || lines.slice(-1)[0] || 'unknown error';
        failures.push(`${platform}: ${errLine.trim()}`);
        continue;
      }
      const devOnly = devOnlySources(path.join(dir, `rh.${platform}.js.map`));
      if (devOnly.length) {
        failures.push(`${platform}: dev-only modules in the release bundle: ${devOnly.slice(0, 5).join(', ')}`);
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
    const why = tests.problems.length ? `; ${tests.problems.join('; ')}` : '';
    regressions.push(`Jest was passing and now fails: ${tests.summary}${why}`);
  }
  if (base.bundleOk && !current.bundleOk) {
    regressions.push(`Release bundle was building and now fails: ${bundled.failures.join('; ')}`);
  }

  const report = {
    baseline: base,
    current,
    regressions,
    jestSummary: tests.summary,
    jestProblems: tests.problems,
    jestFailedTests: tests.failedTests,
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
    tests.problems.forEach(p => console.log(`  Jest: ${p}`));
    tests.failedTests.slice(0, 20).forEach(t => console.log(`  Failed: ${t}`));
    if (tests.failedTests.length > 20) {
      console.log(`  Failed: ... and ${tests.failedTests.length - 20} more`);
    }
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

if (require.main === module) {
  main();
}

module.exports = {checkJestReport};
