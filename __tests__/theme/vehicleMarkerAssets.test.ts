/**
 * T-517: the generated top-down vehicle PNGs exist for every kind, map style and scale at the
 * §5.21 size, and were drawn with the current theme tokens (rerun
 * `node scripts/generate-vehicle-markers.js` after a token change).
 */
import { componentTokens, semanticColors, type SemanticColorName } from '../../src/theme';
import { VEHICLE_MARKER_KINDS } from '../../src/components/ui/ride/vehicleAssets';

const { readFileSync, existsSync } = jest.requireActual<{
  readFileSync: { (file: string, encoding: 'utf8'): string; (file: string): Uint8Array };
  existsSync: (file: string) => boolean;
}>('fs');
// The generator's colour table, read straight from the script.
const { ROLES } = jest.requireActual<{ ROLES: Record<string, [string, string, string]> }>(
  '../../scripts/generate-vehicle-markers.js',
);

/** Relative to the repo root (Jest's cwd). */
const DIR = 'src/assets/vehicles';

type Manifest = {
  size: number;
  scales: number[];
  vehicles: string[];
  colors: Record<string, { token: string; light: string; dark: string }>;
};
const manifest = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8')) as Manifest;

/** Width and height from the PNG IHDR chunk. */
const pngSize = (file: string): { width: number; height: number } => {
  const bytes = readFileSync(file);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(String.fromCharCode(bytes[1], bytes[2], bytes[3])).toBe('PNG');
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

describe('vehicle marker assets', () => {
  it('match the §5.21 marker size and cover every kind the app draws', () => {
    expect(manifest.size).toBe(componentTokens.ride.vehicleMarker.size);
    expect([...manifest.vehicles].sort()).toEqual([...VEHICLE_MARKER_KINDS].sort());
  });

  it.each(VEHICLE_MARKER_KINDS.flatMap(kind => (['light', 'dark'] as const).map(mode => [kind, mode])))(
    '%s (%s): @1x/@2x/@3x at 40/80/120 px',
    (kind, mode) => {
      for (const scale of manifest.scales) {
        const file = `${DIR}/${kind}-${mode}${scale === 1 ? '' : `@${scale}x`}.png`;
        expect(existsSync(file)).toBe(true);
        expect(pngSize(file)).toEqual({ width: manifest.size * scale, height: manifest.size * scale });
      }
    },
  );

  it('were drawn with the current theme tokens', () => {
    for (const [role, entry] of Object.entries(manifest.colors)) {
      const token = entry.token as SemanticColorName;
      expect({ role, light: entry.light }).toEqual({ role, light: semanticColors.light[token] });
      expect({ role, dark: entry.dark }).toEqual({ role, dark: semanticColors.dark[token] });
      expect(ROLES[role]).toEqual([entry.token, entry.light, entry.dark]);
    }
  });
});
