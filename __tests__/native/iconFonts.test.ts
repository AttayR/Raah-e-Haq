/**
 * T-533 (PERF-05): the app draws one icon family, MaterialCommunityIcons (the kit Icon), so only
 * that font ships on iOS and Android. These tests read the native config and the source as text
 * and fail when another icon font or a reachable import of another family comes back.
 */
// The app's tsconfig has no Node types, so the Node modules are typed here.
const fs = jest.requireActual<{
  readFileSync: (file: string, encoding: 'utf8') => string;
  readdirSync: (dir: string, options: { withFileTypes: true }) => Array<{ name: string; isDirectory: () => boolean }>;
}>('fs');
const path = jest.requireActual<{
  join: (...parts: string[]) => string;
  dirname: (p: string) => string;
  basename: (p: string) => string;
  resolve: (...parts: string[]) => string;
}>('path');

// Jest runs from the project root, so relative paths resolve against it.
const read = (relative: string) => fs.readFileSync(relative, 'utf8');

const KEPT = ['MaterialCommunityIcons.ttf'];

const plistArray = (plist: string, key: string): string[] => {
  const match = plist.match(new RegExp(`<key>${key}</key>\\s*<array>([\\s\\S]*?)</array>`));
  return match ? [...match[1].matchAll(/<string>([^<]*)<\/string>/g)].map((m) => m[1]) : [];
};

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|js)$/.test(entry.name) ? [full] : [];
  });

const withoutExtension = (file: string) => file.replace(/\.(ts|tsx|js)$/, '');

/** The absolute module paths a file imports with relative specifiers. */
const relativeImports = (file: string, text: string): string[] =>
  [...text.matchAll(/(?:from\s+|require\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)].map((m) =>
    path.resolve(path.dirname(file), m[1]),
  );

describe('icon fonts (T-533, PERF-05)', () => {
  it('iOS registers only MaterialCommunityIcons in UIAppFonts', () => {
    expect(plistArray(read('ios/RaaHeHaq/Info.plist'), 'UIAppFonts')).toEqual(KEPT);
  });

  it('Android copies only MaterialCommunityIcons into the APK', () => {
    const gradle = read('android/app/build.gradle');
    const names = gradle.match(/iconFontNames:\s*\[([^\]]*)\]/);
    expect(names).not.toBeNull();
    expect([...(names?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual(KEPT);
  });

  it('the Podfile drops every other vector-icons font from the copied pod resources', () => {
    const podfile = read('ios/Podfile');
    expect(podfile).toMatch(/kept_icon_fonts = \['MaterialCommunityIcons\.ttf'\]/);
    expect(podfile).toMatch(/post_integrate do \|installer\|/);
  });

  it('no reachable source file imports an icon family other than MaterialCommunityIcons', () => {
    const files = [...sourceFiles('src'), 'App.tsx', 'index.js'].map((f) => path.resolve(f));
    const texts = new Map(files.map((f) => [f, read(f)]));
    const otherFamily = /react-native-vector-icons\/(?!MaterialCommunityIcons['"]|glyphmaps\/MaterialCommunityIcons\.json)/;
    const users = files.filter((f) => otherFamily.test(texts.get(f) ?? ''));

    const imported = new Set(files.flatMap((f) => relativeImports(f, texts.get(f) ?? '')));
    const isImported = (file: string) => {
      const bare = withoutExtension(file);
      return imported.has(bare) || (path.basename(bare) === 'index' && imported.has(path.dirname(bare)));
    };
    // A file that still names another family must be dead (imported by nothing), so Metro
    // never bundles it and its font is never needed.
    expect(users.filter(isImported)).toEqual([]);
  });
});

// A module, so these names do not collide with other script-mode test files.
export {};
