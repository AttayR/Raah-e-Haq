/**
 * T-112: react-native-config's iOS codegen (BuildDotenvConfig.rb) printed the whole dotenv,
 * MAPS_KEY included, to the Xcode build log, and its podspec build phase ran with `set -ex`.
 * A patch-package patch, applied on every `yarn install`, makes it print only the key count.
 */
// Module scope, so the helpers below don't clash with other test files' globals.
export {};

// The app's tsconfig has no Node types, so the Node modules are typed here.
const fs = jest.requireActual<{
  readFileSync: (file: string, encoding: 'utf8') => string;
  existsSync: (file: string) => boolean;
  writeFileSync: (file: string, data: string) => void;
  mkdtempSync: (prefix: string) => string;
  rmSync: (file: string, options: { recursive: true; force: true }) => void;
}>('fs');
const path = jest.requireActual<{ join: (...parts: string[]) => string }>('path');
const os = jest.requireActual<{ tmpdir: () => string }>('os');
const childProcess = jest.requireActual<{
  spawnSync: (
    command: string,
    args: string[],
    options: { env: Record<string, string | undefined>; encoding: 'utf8' },
  ) => { status: number | null; stdout: string; stderr: string; error?: Error };
}>('child_process');

declare const process: { env: Record<string, string | undefined> };

const PATCH = 'patches/react-native-config+1.7.2.patch';
const CONFIG_DIR = 'node_modules/react-native-config';
const CODEGEN = `${CONFIG_DIR}/ios/ReactNativeConfig/BuildDotenvConfig.rb`;

const read = (relative: string) => fs.readFileSync(relative, 'utf8');

// Only iOS builds need Ruby; without it the runtime check is reported as skipped, not passed.
const hasRuby = !childProcess.spawnSync('ruby', ['--version'], {
  env: process.env,
  encoding: 'utf8',
}).error;

describe('react-native-config codegen does not leak env values (T-112)', () => {
  it('the patch exists and replaces the dotenv dump and set -ex', () => {
    expect(fs.existsSync(PATCH)).toBe(true);
    const patch = read(PATCH);
    expect(patch).toContain('-puts "read dotenv #{dotenv}"');
    expect(patch).toContain('-set -ex');
    expect(patch).not.toMatch(/^\+.*#\{dotenv\}/m);
  });

  it('yarn install applies it (postinstall runs patch-package)', () => {
    const pkg = JSON.parse(read('package.json')) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(pkg.scripts.postinstall).toContain('patch-package');
    expect(pkg.devDependencies['patch-package']).toBeDefined();
  });

  it('the installed codegen and podspec carry the patch', () => {
    expect(read(CODEGEN)).not.toMatch(/puts[^\n]*#\{dotenv\}/);
    expect(read(`${CONFIG_DIR}/react-native-config.podspec`)).not.toMatch(/set -\w*x/);
  });

  (hasRuby ? it : it.skip)('running the codegen prints neither the values nor the dotenv hash', () => {
    const secret = 'T112-fake-secret-value-0123456789';
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rnc-t112-'));
    try {
      fs.writeFileSync(path.join(root, '.env'), `MAPS_KEY=${secret}\nAPI_URL=http://x.test\n`);
      const env: Record<string, string | undefined> = { ...process.env, BUILD_DIR: root };
      delete env.ENVFILE;
      const result = childProcess.spawnSync('ruby', [CODEGEN, root, root], {
        env,
        encoding: 'utf8',
      });
      expect(result.status).toBe(0);
      const output = `${result.stdout}${result.stderr}`;
      expect(output.includes(secret)).toBe(false);
      expect(output).toContain('2 keys');
      // The generated sources still carry the value, so Config keeps working.
      expect(read(path.join(root, 'GeneratedDotEnv.m')).includes(secret)).toBe(true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
