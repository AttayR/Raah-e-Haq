/**
 * Top-down vehicle art as data (T-586, map-vehicles.md §1): one north-up drawing per kind on a
 * 48-unit grid (front at y = 0), rendered by `VehicleGlyph` with react-native-svg. The
 * silhouette is drawn three times under the details (outer shadow, inner shadow, casing, §1.4),
 * so the shadow is the same at every rotation and no native marker shadow is needed.
 *
 * No React here: every value is unit tested against the spec (`__tests__/components/ui/vehicleGlyphs.test.tsx`).
 */
import type { SemanticColorName } from '../../../theme';

/** One glyph per backend vehicle type (§1.1). */
export type VehicleMarkerKind = 'car' | 'carAc' | 'van' | 'rickshaw' | 'bike' | 'bikeParcel';

export const VEHICLE_MARKER_KINDS: ReadonlyArray<VehicleMarkerKind> = ['car', 'carAc', 'van', 'rickshaw', 'bike', 'bikeParcel'];

const KIND_BY_TYPE: Readonly<Record<string, VehicleMarkerKind>> = {
  car: 'car',
  car_ac: 'carAc',
  van: 'van',
  rickshaw: 'rickshaw',
  bike: 'bike',
  // BE-88: a parcel delivery is carried by bike.
  parcel: 'bikeParcel',
};

/**
 * The glyph for a backend `vehicle_type` (`car`, `car_ac`, `bike`, `parcel`, `rickshaw`, `van`).
 * Missing or unknown types draw the car (art only; text never guesses a type).
 */
export const vehicleMarkerKind = (vehicleType: string | null | undefined): VehicleMarkerKind => {
  const key = typeof vehicleType === 'string' ? vehicleType.trim().toLowerCase() : '';
  return KIND_BY_TYPE[key] ?? 'car';
};

export type GlyphShape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  /** A stroked line; `w` is its width in the fill pass (shadow/casing passes add their width). */
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; w: number };

/** A detail shape: filled, or (lines and open paths) stroked, with a theme colour. */
export type GlyphDetail = {
  shape: GlyphShape;
  fill?: SemanticColorName;
  stroke?: SemanticColorName;
  strokeWidth?: number;
};

export type GlyphDrawing = {
  /** Outline of the vehicle: drawn as outer shadow, inner shadow and casing (§1.4). */
  silhouette: ReadonlyArray<GlyphShape>;
  /** Fills in paint order. */
  details: ReadonlyArray<GlyphDetail>;
};

const rect = (x: number, y: number, w: number, h: number, rx?: number): GlyphShape => ({ t: 'rect', x, y, w, h, rx });
const fill = (shape: GlyphShape, color: SemanticColorName): GlyphDetail => ({ shape, fill: color });

// ── car (footprint x 14–34, y 5–43) ──
const carBody = rect(14, 5, 20, 38, 7);
const carMirrors = [rect(11.5, 15, 3.5, 2.5, 1.25), rect(33, 15, 3.5, 2.5, 1.25)];
const car: GlyphDrawing = {
  silhouette: [carBody, ...carMirrors],
  details: [
    fill(carBody, 'vehicleBody'),
    ...carMirrors.map(m => fill(m, 'vehicleBody')),
    fill({ t: 'path', d: 'M16.5 15.5 Q24 12.5 31.5 15.5 L30.2 20.5 Q24 19.3 17.8 20.5 Z' }, 'vehicleGlass'),
    fill(rect(17.8, 21.5, 12.4, 10.5, 2.5), 'vehicleRoof'),
    fill({ t: 'path', d: 'M17.8 33 Q24 34.2 30.2 33 L31 37 Q24 38.8 17 37 Z' }, 'vehicleGlass'),
    fill(rect(16.8, 7, 4, 2, 1), 'vehicleHeadlight'),
    fill(rect(27.2, 7, 4, 2, 1), 'vehicleHeadlight'),
    fill(rect(16.8, 39.2, 4, 1.8, 0.9), 'vehicleTaillight'),
    fill(rect(27.2, 39.2, 4, 1.8, 0.9), 'vehicleTaillight'),
  ],
};

// ── AC car = car + a roof badge with a snowflake (it rotates with the car: a roof marking) ──
const AC = { cx: 24, cy: 26.75 };
const snowflake = (x1: number, y1: number, x2: number, y2: number): GlyphDetail => ({
  shape: { t: 'line', x1, y1, x2, y2, w: 1.2 },
  stroke: 'vehicleAcGlyph',
  strokeWidth: 1.2,
});
const carAc: GlyphDrawing = {
  silhouette: car.silhouette,
  details: [
    ...car.details,
    fill({ t: 'circle', cx: AC.cx, cy: AC.cy, r: 5 }, 'vehicleAcBadge'),
    snowflake(24, 23.55, 24, 29.95),
    snowflake(21.23, 25.15, 26.77, 28.35),
    snowflake(21.23, 28.35, 26.77, 25.15),
  ],
};

// ── van (footprint x 13–35, y 3–45) ──
const vanBody = rect(13, 3, 22, 42, 4);
const vanMirrors = [rect(10.5, 10, 3.5, 2.5, 1.25), rect(34, 10, 3.5, 2.5, 1.25)];
const rib = (y: number): GlyphDetail => ({ shape: { t: 'line', x1: 17, y1: y, x2: 31, y2: y, w: 1 }, stroke: 'vehicleBody', strokeWidth: 1 });
const van: GlyphDrawing = {
  silhouette: [vanBody, ...vanMirrors],
  details: [
    fill(vanBody, 'vehicleBody'),
    ...vanMirrors.map(m => fill(m, 'vehicleBody')),
    fill({ t: 'path', d: 'M15.2 9.5 Q24 7.2 32.8 9.5 L31.8 14 Q24 13 16.2 14 Z' }, 'vehicleGlass'),
    fill(rect(15.5, 15.5, 17, 26.5, 2), 'vehicleRoof'),
    rib(24.5),
    rib(33),
    fill(rect(15, 4.2, 4.5, 1.8, 0.9), 'vehicleHeadlight'),
    fill(rect(28.5, 4.2, 4.5, 1.8, 0.9), 'vehicleHeadlight'),
    fill(rect(15, 42.2, 4.5, 1.6, 0.8), 'vehicleTaillight'),
    fill(rect(28.5, 42.2, 4.5, 1.6, 0.8), 'vehicleTaillight'),
  ],
};

// ── rickshaw (footprint x 12.8–35.2, y 4.5–41.5) ──
const rickshawTyres = [rect(22.7, 4.5, 2.6, 4, 1.3), rect(12.8, 31, 2.6, 7, 1.3), rect(32.6, 31, 2.6, 7, 1.3)];
const rickshawBody: GlyphShape = {
  t: 'path',
  d: 'M24 6.5 C28.4 6.5 31.2 9.6 31.8 14 L33 36.5 Q33 41.5 28.5 41.5 L19.5 41.5 Q15 41.5 15 36.5 L16.2 14 C16.8 9.6 19.6 6.5 24 6.5 Z',
};
const rickshaw: GlyphDrawing = {
  silhouette: [...rickshawTyres, rickshawBody],
  details: [
    ...rickshawTyres.map(tyre => fill(tyre, 'vehicleTyre')),
    fill(rickshawBody, 'vehicleBody'),
    fill({ t: 'path', d: 'M19.2 13 Q24 11.2 28.8 13 L29.4 18 L18.6 18 Z' }, 'vehicleGlass'),
    fill(rect(17, 19.5, 14, 19.5, 3), 'vehicleRoof'),
    // The saffron trim of Pakistani rickshaws: the only decorative accent in the set.
    fill(rect(17, 35, 14, 1.6), 'vehicleHeadlight'),
    fill({ t: 'circle', cx: 24, cy: 8.6, r: 1.2 }, 'vehicleHeadlight'),
    fill(rect(17.5, 39.8, 3.2, 1.2, 0.6), 'vehicleTaillight'),
    fill(rect(27.3, 39.8, 3.2, 1.2, 0.6), 'vehicleTaillight'),
  ],
};

// ── bike (footprint x 16–32, y 5–43) ──
const bikeTyres = [rect(22.6, 5, 2.8, 8, 1.4), rect(22.6, 35, 2.8, 8, 1.4)];
const handlebar = rect(16, 13, 16, 2.4, 1.2);
const bikeBody: GlyphShape = { t: 'path', d: 'M21.2 15 L26.8 15 L27.4 33.5 Q24 36 20.6 33.5 Z' };
const shoulders: GlyphShape = { t: 'ellipse', cx: 24, cy: 24.5, rx: 7.2, ry: 4.4 };
const arms: GlyphShape[] = [
  { t: 'line', x1: 18, y1: 22.5, x2: 17.5, y2: 15, w: 2.4 },
  { t: 'line', x1: 30, y1: 22.5, x2: 30.5, y2: 15, w: 2.4 },
];
const helmet: GlyphShape = { t: 'circle', cx: 24, cy: 22, r: 3.8 };
const bikeBefore: GlyphDetail[] = [
  ...bikeTyres.map(tyre => fill(tyre, 'vehicleTyre')),
  fill(handlebar, 'vehicleBody'),
  fill(bikeBody, 'vehicleBody'),
];
const bikeRider: GlyphDetail[] = [
  ...arms.map((arm): GlyphDetail => ({ shape: arm, stroke: 'vehicleRoof', strokeWidth: 2.4 })),
  fill(shoulders, 'vehicleRoof'),
  fill(helmet, 'vehicleHeadlight'),
  { shape: { t: 'path', d: 'M21.4 20.4 Q24 18.6 26.6 20.4' }, stroke: 'vehicleGlass', strokeWidth: 1.2 },
  fill({ t: 'circle', cx: 24, cy: 12.4, r: 1.1 }, 'vehicleHeadlight'),
];
const bikeTail = fill(rect(22.4, 34.2, 3.2, 1.2, 0.6), 'vehicleTaillight');
const bikeSilhouette: GlyphShape[] = [...bikeTyres, handlebar, bikeBody, shoulders, helmet, ...arms];
const bike: GlyphDrawing = {
  silhouette: bikeSilhouette,
  details: [...bikeBefore, ...bikeRider, bikeTail],
};

// ── parcel bike = bike + a box on the rear rack (in the silhouette too), drawn after the body ──
const parcelBox = rect(20, 30.5, 8, 6, 1);
const bikeParcel: GlyphDrawing = {
  silhouette: [...bikeSilhouette, parcelBox],
  details: [
    ...bikeBefore,
    fill(parcelBox, 'vehicleRoof'),
    { shape: { t: 'line', x1: 24, y1: 30.5, x2: 24, y2: 36.5, w: 0.9 }, stroke: 'vehicleCasing', strokeWidth: 0.9 },
    ...bikeRider,
    bikeTail,
  ],
};

export const VEHICLE_GLYPHS: Readonly<Record<VehicleMarkerKind, GlyphDrawing>> = {
  car,
  carAc,
  van,
  rickshaw,
  bike,
  bikeParcel,
};
