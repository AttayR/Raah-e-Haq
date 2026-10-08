/**
 * T-109 (PAX-01, INF-06): the Google Maps key comes from the env file at build time
 * (MAPS_KEY in the git-ignored .env.*), never from a literal in tracked files, and is never logged.
 * These tests read the native config and the JS sources as text.
 */
// Module scope, so the helpers below don't clash with other test files' globals.
export {};

// The app's tsconfig has no Node types, so the Node modules are typed here.
const fs = jest.requireActual<{
  readFileSync: (file: string, encoding: 'utf8') => string;
  readdirSync: (dir: string, options: { withFileTypes: true }) => Array<{
    name: string;
    isDirectory: () => boolean;
  }>;
}>('fs');
const path = jest.requireActual<{ join: (...parts: string[]) => string }>('path');

// Jest runs from the project root, so relative paths resolve against it.
const read = (relative: string) => fs.readFileSync(relative, 'utf8');

/** Shape of a Google API key: "AIza" + 35 characters. Matches are never printed. */
const GOOGLE_KEY = /AIza[0-9A-Za-z_-]{35}/;

const listSources = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listSources(full);
    }
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : [];
  });

const NATIVE_FILES = [
  'android/app/src/main/AndroidManifest.xml',
  'android/app/build.gradle',
  'ios/RaaHeHaq/Info.plist',
  'ios/RaaHeHaq/AppDelegate.swift',
  'ios/RaaHeHaq.xcodeproj/project.pbxproj',
];

describe('Google Maps key is not hardcoded', () => {
  it.each(NATIVE_FILES)('%s holds no key literal', (file) => {
    // Boolean check so a failure never prints the key.
    expect(GOOGLE_KEY.test(read(file))).toBe(false);
  });

  it('no JS source under src/ holds a key literal', () => {
    const offenders = listSources('src').filter((file) => GOOGLE_KEY.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('.env.example has an empty MAPS_KEY placeholder', () => {
    expect(read('.env.example')).toMatch(/^MAPS_KEY=$/m);
  });
});

describe('Android reads the key from the env file', () => {
  it('the manifest uses the ${MAPS_KEY} placeholder', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toMatch(
      /android:name="com\.google\.android\.geo\.API_KEY"\s+android:value="\$\{MAPS_KEY\}"/,
    );
  });

  it('build.gradle fills the placeholder from react-native-config env', () => {
    expect(read('android/app/build.gradle')).toMatch(
      /manifestPlaceholders\s*=\s*\[\s*MAPS_KEY:\s*project\.env\.get\("MAPS_KEY"\)/,
    );
  });
});

describe('iOS reads the key from the env file', () => {
  it('Info.plist GMSApiKey is the MAPS_KEY token, replaced by Info.plist preprocessing', () => {
    expect(read('ios/RaaHeHaq/Info.plist')).toMatch(
      /<key>GMSApiKey<\/key>\s*<string>MAPS_KEY<\/string>/,
    );
  });

  it('the app target preprocesses Info.plist with the react-native-config header (Debug + Release)', () => {
    const pbxproj = read('ios/RaaHeHaq.xcodeproj/project.pbxproj');
    const preprocess = pbxproj.match(/INFOPLIST_PREPROCESS = YES;/g) ?? [];
    const header =
      pbxproj.match(/INFOPLIST_PREFIX_HEADER = "\$\(BUILD_DIR\)\/GeneratedInfoPlistDotEnv\.h";/g) ??
      [];
    expect(preprocess).toHaveLength(2);
    expect(header).toHaveLength(2);
  });

  it('AppDelegate takes the key from Info.plist, not a string literal', () => {
    const appDelegate = read('ios/RaaHeHaq/AppDelegate.swift');
    expect(appDelegate).toContain('Bundle.main.object(forInfoDictionaryKey: "GMSApiKey")');
    expect(appDelegate).not.toMatch(/provideAPIKey\(\s*"/);
  });

  it('JS reads the key through env.MAPS_KEY', () => {
    expect(read('src/config/mapsConfig.ts')).toMatch(/API_KEY:\s*env\.MAPS_KEY/);
  });
});

describe('the key is never logged or shown', () => {
  const LOG_CALL = /\b(?:console|logger)\.\w+\(/;

  it('no log call mentions the key or a key= query', () => {
    const offenders = listSources('src').flatMap((file) =>
      read(file)
        .split('\n')
        .map((line, index) => ({ line, at: `${file}:${index + 1}` }))
        .filter(({ line }) => LOG_CALL.test(line) && /key=|API_KEY|MAPS_KEY/.test(line))
        .map(({ at }) => at),
    );
    expect(offenders).toEqual([]);
  });

  it('no screen prints part of the key', () => {
    const offenders = listSources('src').filter((file) =>
      /(?:API_KEY|MAPS_KEY)\.(?:substring|slice|substr)\(/.test(read(file)),
    );
    expect(offenders).toEqual([]);
  });
});
