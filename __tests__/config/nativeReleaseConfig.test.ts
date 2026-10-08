/**
 * T-108 (INF-03, INF-21, INF-26): release hardening lives in native config files, so these
 * tests read them as text and fail if a debug-only or unused setting comes back.
 */
// The app's tsconfig has no Node types, so the two Node modules are typed here.
const { readFileSync } = jest.requireActual<{
  readFileSync: (file: string, encoding: 'utf8') => string;
}>('fs');
const path = jest.requireActual<{ join: (...parts: string[]) => string }>('path');

// Jest runs from the project root, so relative paths resolve against it.
const read = (relative: string) => readFileSync(relative, 'utf8');

/** The <array> that follows a plist <key>, as a list of its <string> values. */
const plistArray = (plist: string, key: string): string[] => {
  const match = plist.match(new RegExp(`<key>${key}</key>\\s*<array>([\\s\\S]*?)</array>`));
  if (!match) {
    return [];
  }
  return [...match[1].matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1]);
};

describe('iOS Info.plist', () => {
  const plist = read('ios/RaaHeHaq/Info.plist');

  it('declares only the remote-notification background mode (foreground-only location, B-08)', () => {
    expect(plistArray(plist, 'UIBackgroundModes')).toEqual(['remote-notification']);
  });

  it('asks for when-in-use location only, and has no unused usage strings', () => {
    expect(plist).toContain('<key>NSLocationWhenInUseUsageDescription</key>');
    expect(plist).not.toContain('NSLocationAlwaysAndWhenInUseUsageDescription');
    expect(plist).not.toContain('NSLocationAlwaysUsageDescription');
    expect(plist).not.toContain('NSMicrophoneUsageDescription');
  });

  it('is portrait only', () => {
    expect(plistArray(plist, 'UISupportedInterfaceOrientations')).toEqual([
      'UIInterfaceOrientationPortrait',
    ]);
  });

  it('has no Google Sign-In URL scheme', () => {
    expect(plist).not.toContain('CFBundleURLTypes');
    expect(plist).not.toContain('REVERSED_CLIENT_ID');
  });
});

describe('Android network security', () => {
  it('release (main) config allows no cleartext and trusts system CAs only', () => {
    const config = read('android/app/src/main/res/xml/network_security_config.xml');
    expect(config).toMatch(/<base-config cleartextTrafficPermitted="false">/);
    expect(config).not.toMatch(/cleartextTrafficPermitted="true"/);
    expect(config).not.toContain('src="user"');
  });

  it('main manifest turns cleartext off', () => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('android:usesCleartextTraffic="false"');
    expect(manifest).not.toContain('android:usesCleartextTraffic="true"');
  });

  it('debug config allows cleartext only to localhost, 127.0.0.1 and 10.0.2.2', () => {
    const config = read('android/app/src/debug/res/xml/network_security_config.xml');
    expect(config).toMatch(/<base-config cleartextTrafficPermitted="false">/);
    const domains = [...config.matchAll(/<domain[^>]*>([^<]+)<\/domain>/g)].map((m) => m[1]);
    expect(domains.sort()).toEqual(['10.0.2.2', '127.0.0.1', 'localhost']);
  });
});

describe('Android release signing', () => {
  const gradle = read('android/app/build.gradle');
  const releaseBlock = gradle.slice(gradle.indexOf('buildTypes {'));

  it('never signs release with the debug key', () => {
    const release = releaseBlock.slice(releaseBlock.indexOf('release {'));
    expect(release).not.toMatch(/signingConfig\s+signingConfigs\.debug/);
    expect(release).toMatch(/signingConfig releaseSigningProblems\.isEmpty\(\) \? signingConfigs\.release : null/);
  });

  it('reads all four RH_UPLOAD_* values from Gradle properties or the environment', () => {
    for (const key of [
      'RH_UPLOAD_STORE_FILE',
      'RH_UPLOAD_STORE_PASSWORD',
      'RH_UPLOAD_KEY_ALIAS',
      'RH_UPLOAD_KEY_PASSWORD',
    ]) {
      expect(gradle).toContain(`'${key}'`);
    }
    expect(gradle).toContain('project.findProperty(key) ?: System.getenv(key)');
    expect(gradle).toContain('throw new GradleException(');
  });

  it('keeps no signing values in the committed gradle.properties', () => {
    expect(read('android/gradle.properties')).not.toMatch(/RH_UPLOAD_/);
  });
});

describe('Metro', () => {
  const metroConfig = jest.requireActual<{
    projectRoot: string;
    resolver: { blockList: RegExp[] };
  }>('../../metro.config.js');
  const blocked = (relative: string) =>
    metroConfig.resolver.blockList.some((pattern) =>
      pattern.test(path.join(metroConfig.projectRoot, relative)),
    );

  it('ignores docs/ so saving QA screenshots does not reload the app', () => {
    expect(blocked('docs/qa-reports/2026-10-08-T-108/shot.png')).toBe(true);
    expect(blocked('docs/TASKS.md')).toBe(true);
  });

  it('still watches src/ and the app entry', () => {
    expect(blocked('src/services/api.ts')).toBe(false);
    expect(blocked('App.tsx')).toBe(false);
    expect(blocked('src/docs/helper.ts')).toBe(false);
  });
});
