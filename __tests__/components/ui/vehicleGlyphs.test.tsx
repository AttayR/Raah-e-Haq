/**
 * T-586 (map-vehicles.md §1): the react-native-svg vehicle set: six kinds drawn from the spec
 * geometry, the paint order of §1.4 (outer shadow, inner shadow, casing, details), theme colours
 * in light and dark, and the assigned halo.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { DarkTheme, LightTheme, componentTokens, type AppTheme } from '../../../src/theme';
import { VehicleGlyph } from '../../../src/components/ui/ride/VehicleGlyph';
import { VEHICLE_GLYPHS, VEHICLE_MARKER_KINDS } from '../../../src/components/ui/ride/vehicleGlyphs';

let mockTheme: AppTheme = LightTheme;
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: mockTheme, scheme: 'system', setScheme: jest.fn() }),
}));

const m = componentTokens.ride.vehicleMarker;

type Node = { type: string; props: Record<string, unknown>; children: Node[] | null };
const all = (node: Node | null): Node[] => (node ? [node, ...(node.children ?? []).flatMap(c => (typeof c === 'object' ? all(c) : []))] : []);
/** The rendered fill colours of the svg (host props). */
const fills = (root: Node) => all(root).map(n => n.props.fill).filter((f): f is unknown => f !== undefined);

beforeEach(() => {
  mockTheme = LightTheme;
});

describe('vehicle glyph data (§1.5)', () => {
  it('has all six kinds', () => {
    expect([...VEHICLE_MARKER_KINDS].sort()).toEqual(['bike', 'bikeParcel', 'car', 'carAc', 'rickshaw', 'van']);
  });

  it('car: the 20×38 body with 7 corners and the two mirrors are the silhouette', () => {
    expect(VEHICLE_GLYPHS.car.silhouette).toEqual([
      { t: 'rect', x: 14, y: 5, w: 20, h: 38, rx: 7 },
      { t: 'rect', x: 11.5, y: 15, w: 3.5, h: 2.5, rx: 1.25 },
      { t: 'rect', x: 33, y: 15, w: 3.5, h: 2.5, rx: 1.25 },
    ]);
  });

  it('AC car = car + a roof badge (r 5 at 24, 26.75) and a three-stroke snowflake', () => {
    const extra = VEHICLE_GLYPHS.carAc.details.slice(VEHICLE_GLYPHS.car.details.length);
    expect(extra[0]).toEqual({ shape: { t: 'circle', cx: 24, cy: 26.75, r: 5 }, fill: 'vehicleAcBadge' });
    expect(extra.slice(1).every(d => d.shape.t === 'line' && d.stroke === 'vehicleAcGlyph' && d.strokeWidth === 1.2)).toBe(true);
    expect(extra).toHaveLength(4);
    expect(VEHICLE_GLYPHS.carAc.silhouette).toBe(VEHICLE_GLYPHS.car.silhouette);
  });

  it('parcel bike = bike + the box, which joins the silhouette; the tail light still comes last', () => {
    const box = { t: 'rect', x: 20, y: 30.5, w: 8, h: 6, rx: 1 };
    expect(VEHICLE_GLYPHS.bikeParcel.silhouette).toContainEqual(box);
    expect(VEHICLE_GLYPHS.bike.silhouette).not.toContainEqual(box);
    const details = VEHICLE_GLYPHS.bikeParcel.details;
    expect(details[details.length - 1].fill).toBe('vehicleTaillight');
  });

  it('rickshaw carries the one decorative accent: the saffron canopy band', () => {
    expect(VEHICLE_GLYPHS.rickshaw.details).toContainEqual({ shape: { t: 'rect', x: 17, y: 35, w: 14, h: 1.6, rx: undefined }, fill: 'vehicleHeadlight' });
  });

  it('every drawing stays inside the 48-unit grid', () => {
    for (const kind of VEHICLE_MARKER_KINDS) {
      for (const s of VEHICLE_GLYPHS[kind].silhouette) {
        if (s.t === 'rect') {
          expect(s.x).toBeGreaterThanOrEqual(0);
          expect(s.x + s.w).toBeLessThanOrEqual(48);
          expect(s.y).toBeGreaterThanOrEqual(0);
          expect(s.y + s.h).toBeLessThanOrEqual(48);
        }
      }
    }
  });
});

describe('VehicleGlyph (§1.2–§1.4, §1.6)', () => {
  it.each(VEHICLE_MARKER_KINDS)('%s renders a 40pt 56-unit svg: shadow (0.08, 0.16), casing, then body', kind => {
    const { toJSON } = render(<VehicleGlyph kind={kind} testID="g" />);
    const root = toJSON() as unknown as Node;
    expect(screen.getByTestId('g').props).toMatchObject({ width: 40, height: 40 });
    const groups = all(root).filter(n => n.props.opacity !== undefined);
    expect(groups.slice(0, 3).map(g => g.props.opacity)).toEqual([0.08, 0.16, 1]);
    expect(fills(root).length).toBeGreaterThan(0);
    // The 48-unit drawing sits 4 units inside the 56-unit viewBox.
    expect(root.props).toMatchObject({ vbWidth: 56, vbHeight: 56 });
    expect(all(root).some(n => JSON.stringify(n.props.matrix) === JSON.stringify([1, 0, 0, 1, 4, 4]))).toBe(true);
  });

  it('light: navy body on a white casing; dark: light body on a dark casing', () => {
    const light = JSON.stringify(render(<VehicleGlyph kind="car" />).toJSON());
    mockTheme = DarkTheme;
    const dark = JSON.stringify(render(<VehicleGlyph kind="car" />).toJSON());
    // react-native-svg processes colours to numbers; compare the two themes instead of hex text.
    expect(light).not.toEqual(dark);
    expect(LightTheme.colors.vehicleBody).toBe('#011C72');
    expect(DarkTheme.colors.vehicleBody).toBe('#F2F4F9');
  });

  it('assigned: 64pt view, a 56pt halo round the pivot, the glyph scaled to 48pt', () => {
    render(<VehicleGlyph kind="rickshaw" assigned testID="a" />);
    expect(screen.getByTestId('a').props).toMatchObject({ width: m.assignedViewSize, height: m.assignedViewSize });
    const halo = screen.getByTestId('a-halo');
    expect(halo.props).toMatchObject({ cx: 32, cy: 32, r: (56 - 1) / 2, strokeWidth: 1 });
    // Glyph: scale 48/56 about an 8pt inset, then the 4-unit grid inset.
    const k = 48 / 56;
    const root = screen.toJSON() as unknown as Node;
    const matrix = all(root).map(n => n.props.matrix as number[] | undefined).find(mx => mx && Math.abs(mx[0] - k) < 1e-6);
    expect(matrix?.[4]).toBeCloseTo(8 + 4 * k, 5);
  });

  it('unknown types draw the car', () => {
    const car = JSON.stringify(render(<VehicleGlyph kind="car" />).toJSON());
    const unknown = JSON.stringify(render(<VehicleGlyph vehicleType="helicopter" />).toJSON());
    expect(unknown).toEqual(car);
  });
});
