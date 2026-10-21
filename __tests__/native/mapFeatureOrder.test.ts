/**
 * T-713: on Android (react-native-maps 1.26.6) the booking map kept the old route and showed a
 * default red Google teardrop after Choose on map changed the drop-off. The native MapView kept
 * its children in a `HashMap<Integer, MapFeature>` keyed by child index: an insert at an index in
 * use overwrote (orphaned) the feature there, and a removal did not shift the later children, so
 * Fabric's `removeViewAt` found the wrong child ("view already removed from parent!") and left the
 * Polyline or Marker on the map. A removed Marker that stays behind loses its custom view and
 * falls back to the default pin. Worse, when the map left the window (a screen pushed over it) it
 * moved its children to `savedFeatures` and put them all back on attach, including the ones React
 * removed meanwhile (their removals found nothing). A patch-package patch keeps the children in
 * an ordered list and routes changes made while detached to the saved list. It also guards the
 * marker's layout listener, which crashed when a late Reanimated layout reached a view already
 * taken out of its marker (seen while verifying the fix: cancel on Finding a driver).
 */
// Module scope, so the helpers below don't clash with other test files' globals.
export {};

// Jest runs from the repository root; paths are relative to it.
const { readFileSync } = jest.requireActual<{
  readFileSync: (file: string, encoding: 'utf8') => string;
}>('fs');

const MAPS_PACKAGE = 'node_modules/react-native-maps/package.json';
const MAP_VIEW = 'node_modules/react-native-maps/android/src/main/java/com/rnmaps/maps/MapView.java';

const installedVersion = (): string => (JSON.parse(readFileSync(MAPS_PACKAGE, 'utf8')) as { version: string }).version;

/** The body of one method of the installed Android MapView, up to the next `public` member. */
const method = (source: string, signature: string): string => {
  const start = source.indexOf(signature);
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('\n    public ', start + signature.length);
  return source.slice(start, end === -1 ? undefined : end);
};

describe('Android MapView keeps its children in React order (T-713)', () => {
  it('a patch exists for the installed react-native-maps version', () => {
    const patch = readFileSync(`patches/react-native-maps+${installedVersion()}.patch`, 'utf8');
    expect(patch).toContain('android/src/main/java/com/rnmaps/maps/MapView.java');
    expect(patch).toMatch(/^\+\s+private final List<MapFeature> features = new ArrayList<>\(\);/m);
  });

  it('the children are an ordered list, not a map keyed by child index', () => {
    const source = readFileSync(MAP_VIEW, 'utf8');
    expect(source).not.toMatch(/Map<Integer,\s*MapFeature>/);
    expect(source).toMatch(/private final List<MapFeature> features = new ArrayList<>\(\);/);
    expect(source).not.toMatch(/features\.put\(/);
  });

  it('an insert shifts the later children and a removal takes the child at that index', () => {
    const source = readFileSync(MAP_VIEW, 'utf8');
    const add = method(source, 'public void addFeature(View child, int index)');
    expect(add).toMatch(/features\.add\(clampFeatureIndex\(index\), annotation\);/);
    expect(add).toMatch(/features\.add\(clampFeatureIndex\(index\), polylineView\);/);
    const remove = method(source, 'public void removeFeatureAt(int index)');
    expect(remove).toMatch(/if \(index < 0 \|\| index >= features\.size\(\)\) \{\s*return;\s*\}/);
    expect(remove).toContain('MapFeature feature = features.remove(index);');
    const at = method(source, 'public View getFeatureAt(int index)');
    expect(at).toContain('index >= 0 && index < children.size() ? children.get(index) : null');
  });

  it('while the map is off the window, adds and removals go to the saved list, so a removed child never comes back', () => {
    const source = readFileSync(MAP_VIEW, 'utf8');
    const add = method(source, 'public void addFeature(View child, int index)');
    expect(add).toMatch(/if \(featuresDetached && child instanceof MapFeature\) \{\s*\/\/[^\n]*\n\s*savedFeatures\.add\(/);
    const remove = method(source, 'public void removeFeatureAt(int index)');
    expect(remove).toMatch(/if \(featuresDetached\) \{[\s\S]*?savedFeatures\.remove\(index\);[\s\S]*?return;/);
    expect(method(source, 'public int getFeatureCount()')).toContain('featuresDetached ? savedFeatures.size() : features.size()');
    const attach = method(source, 'protected void onAttachedToWindow()');
    expect(attach).toMatch(/List<MapFeature> restore = savedFeatures;\s*savedFeatures = new ArrayList<>\(\);\s*featuresDetached = false;/);
    const detach = method(source, 'protected void onDetachedFromWindow()');
    expect(detach).toMatch(/if \(!featuresDetached\) \{[\s\S]*?featuresDetached = true;/);
  });

  it('a late layout of a view React took out of its marker does not crash', () => {
    const marker = readFileSync('node_modules/react-native-maps/android/src/main/java/com/rnmaps/fabric/MarkerManager.java', 'utf8');
    expect(marker).toMatch(/if \(!\(v\.getParent\(\) instanceof MapMarker\)\) \{\s*return;\s*\}\s*MapMarker marker = \(MapMarker\) v\.getParent\(\);/);
  });
});
