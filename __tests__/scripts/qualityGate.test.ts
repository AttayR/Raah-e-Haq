/**
 * T-541: the quality gate fails loudly when the Jest run did not execute every listed test file
 * (a suite that silently did not run used to leave "Tests: N passed" with a smaller N and a PASS).
 */
type Assertion = { status: string; fullName: string };
type SuiteResult = { name: string; status: string; message?: string; assertionResults: Assertion[] };
type Report = {
  testResults: SuiteResult[];
  numRuntimeErrorTestSuites: number;
  wasInterrupted: boolean;
};
type Checked = { problems: string[]; failedTests: string[] };

const { checkJestReport: checkAgainst } = require('../../scripts/quality-gate') as {
  checkJestReport: (report: Report, expectedFiles: string[], root: string) => Checked;
};

// Jest reports absolute file names; the listing is relative to the project root.
const ROOT = '/work/app';
const FILES = ['__tests__/a.test.ts', '__tests__/b.test.tsx'];
const checkJestReport = (r: Report, files: string[]) => checkAgainst(r, files, ROOT);

const suite = (file: string, statuses: string[], extra: Partial<SuiteResult> = {}): SuiteResult => ({
  name: `${ROOT}/${file}`,
  status: statuses.includes('failed') ? 'failed' : 'passed',
  assertionResults: statuses.map((status, i) => ({ status, fullName: `${file} case ${i}` })),
  ...extra,
});

const report = (testResults: SuiteResult[], extra: Partial<Report> = {}): Report => ({
  testResults,
  numRuntimeErrorTestSuites: 0,
  wasInterrupted: false,
  ...extra,
});

describe('quality gate: Jest report check (T-541)', () => {
  it('accepts a run that executed every listed file', () => {
    const checked = checkJestReport(report([suite(FILES[0], ['passed']), suite(FILES[1], ['passed', 'pending'])]), FILES);
    expect(checked).toEqual({ problems: [], failedTests: [] });
  });

  it('fails when a listed test file did not run, and names it', () => {
    const checked = checkJestReport(report([suite(FILES[0], ['passed'])]), FILES);
    expect(checked.problems).toEqual(['1 of 2 test files did not run: __tests__/b.test.tsx']);
  });

  it('fails when a file ran no test at all (everything skipped)', () => {
    const checked = checkJestReport(report([suite(FILES[0], ['passed']), suite(FILES[1], ['pending'])]), FILES);
    expect(checked.problems).toEqual(['test files that ran no test: __tests__/b.test.tsx']);
  });

  it('fails on a suite that could not run and on an interrupted run', () => {
    const broken = suite(FILES[1], [], { status: 'failed', message: '\n  Test suite failed to run\n\n  SyntaxError' });
    const checked = checkJestReport(report([suite(FILES[0], ['passed']), broken], { numRuntimeErrorTestSuites: 1, wasInterrupted: true }), FILES);
    expect(checked.problems).toEqual([
      'test files that ran no test: __tests__/b.test.tsx',
      '1 test files failed to run',
      'the run was interrupted',
    ]);
    expect(checked.failedTests).toEqual(['__tests__/b.test.tsx (Test suite failed to run)']);
  });

  it('names every failing test', () => {
    const checked = checkJestReport(report([suite(FILES[0], ['passed', 'failed']), suite(FILES[1], ['failed'])]), FILES);
    expect(checked.problems).toEqual([]);
    expect(checked.failedTests).toEqual([
      '__tests__/a.test.ts > __tests__/a.test.ts case 1',
      '__tests__/b.test.tsx > __tests__/b.test.tsx case 0',
    ]);
  });
});
