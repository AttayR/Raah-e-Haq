/**
 * Home service-card art as data (UI-R20b, passenger-home V2): a side-view sedan for Ride and a
 * box with speed lines for Parcel, each on an 88 × 48 viewBox with the vehicle's front at the
 * end edge (x = 88). Rendered by `ServiceArt` with react-native-svg; same pattern as
 * `vehicleGlyphs.ts`. (The spec calls this file `serviceArt.ts`; it is named apart from
 * `ServiceArt.tsx` because a case-insensitive file system would resolve one for the other.)
 * No React here: every value is unit tested against the spec
 * (`__tests__/components/ui/serviceCard.test.tsx`), including the label exclusion rule.
 */
import type { SemanticColorName } from '../../../theme';

export type ServiceKind = 'ride' | 'parcel';

export const SERVICE_KINDS: ReadonlyArray<ServiceKind> = ['ride', 'parcel'];

export type ArtShape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  /** Stroked with a round cap. */
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; w: number };

/**
 * A shape's paint: a theme colour, `cutout` (the card's own fill, for wheel arches; never a
 * hard-coded colour), or `shadow` (`illoShadow` at the per-mode ground-shadow opacity).
 */
export type ArtPaint = SemanticColorName | 'cutout' | 'shadow';

export type ArtPart = { shape: ArtShape; paint: ArtPaint };

/** The art's drawing grid (the art box is 104 × 56 pt, so it draws at 1.18×). */
export const SERVICE_ART_VIEWBOX = { width: 88, height: 48 } as const;

/**
 * Label exclusion (V2): no art point may lie in x < 16 and y < 24 (viewBox units), so the card's
 * one-word label never touches the art, even at 1.3× text on iPhone SE.
 */
export const SERVICE_ART_EXCLUSION = { maxX: 16, maxY: 24 } as const;

const rect = (x: number, y: number, w: number, h: number, rx?: number): ArtShape => ({ t: 'rect', x, y, w, h, rx });
const circle = (cx: number, cy: number, r: number): ArtShape => ({ t: 'circle', cx, cy, r });
const line = (x1: number, y1: number, x2: number, y2: number, w: number): ArtShape => ({ t: 'line', x1, y1, x2, y2, w });
const part = (shape: ArtShape, paint: ArtPaint): ArtPart => ({ shape, paint });

/** Sedan, side view, front at the end edge (paint order top to bottom). Footprint x 6–84, y 12.5–47. */
const RIDE_ART: ReadonlyArray<ArtPart> = [
  part({ t: 'ellipse', cx: 44, cy: 44.5, rx: 38, ry: 2.5 }, 'shadow'),
  part(
    {
      t: 'path',
      d: 'M6 34 Q6 27 12 26 L24 24.5 L33 15 Q35.5 12.5 39 12.5 L58 12.5 Q61.5 12.5 64 15 L71.5 23.5 L80 25 Q84 25.8 84 30 L84 35 Q84 38 81 38 L9 38 Q6 38 6 35 Z',
    },
    'vehicleBody',
  ),
  part({ t: 'path', d: 'M28 24 L34.5 17 Q36.2 15.5 38.5 15.5 L46.5 15.5 L46.5 24 Z' }, 'vehicleGlass'),
  part({ t: 'path', d: 'M49.5 15.5 L57.5 15.5 Q59.8 15.5 61.4 17.2 L67.5 24 L49.5 24 Z' }, 'vehicleGlass'),
  part(rect(10, 32.5, 70, 2.5, 1.25), 'vehicleRoof'),
  part(rect(40, 26.5, 4, 1.2, 0.6), 'vehicleGlass'),
  part(rect(53, 26.5, 4, 1.2, 0.6), 'vehicleGlass'),
  part(rect(79.5, 27.5, 4, 3, 1.5), 'vehicleHeadlight'),
  part(rect(6, 28, 2.5, 4, 1), 'vehicleTaillight'),
  part(circle(22, 37.5, 8.5), 'cutout'),
  part(circle(66, 37.5, 8.5), 'cutout'),
  part(circle(22, 37.5, 6.5), 'vehicleTyre'),
  part(circle(66, 37.5, 6.5), 'vehicleTyre'),
  part(circle(22, 37.5, 2.75), 'illoHub'),
  part(circle(66, 37.5, 2.75), 'illoHub'),
];

/** Box with speed lines, oblique (depth +12, −8), front at the end edge. Footprint x 10.75–78, y 10–47. */
const PARCEL_ART: ReadonlyArray<ArtPart> = [
  part({ t: 'ellipse', cx: 56, cy: 44.5, rx: 26, ry: 2.5 }, 'shadow'),
  part(line(18, 24, 28, 24, 2.5), 'illoMotion'),
  part(line(12, 31, 28, 31, 2.5), 'illoMotion'),
  part(line(20, 38, 28, 38, 2.5), 'illoMotion'),
  part({ t: 'path', d: 'M66 18 L78 10 L78 36 L66 44 Z' }, 'illoBoxSide'),
  part({ t: 'path', d: 'M34 18 L46 10 L78 10 L66 18 Z' }, 'illoBoxTop'),
  part(rect(34, 18, 32, 26), 'illoBoxFront'),
  part({ t: 'path', d: 'M47 18 L59 10 L65 10 L53 18 Z' }, 'illoBoxTape'),
  part(rect(47, 18, 6, 11), 'illoBoxTape'),
  part(rect(37, 35, 8, 5, 1), 'illoBoxTape'),
];

export const SERVICE_ART: Readonly<Record<ServiceKind, ReadonlyArray<ArtPart>>> = {
  ride: RIDE_ART,
  parcel: PARCEL_ART,
};

/** Absolute (x, y) points of a path's `d` (M/L/Q/Z commands with absolute coordinates). */
const pathPoints = (d: string): Array<[number, number]> => {
  const numbers = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const points: Array<[number, number]> = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]]);
  return points;
};

/**
 * The axis-aligned bounds of a shape (a path's control points included, so the box is never
 * smaller than the curve; a line includes its round caps).
 */
export const artShapeBounds = (shape: ArtShape): { minX: number; minY: number; maxX: number; maxY: number } => {
  switch (shape.t) {
    case 'rect':
      return { minX: shape.x, minY: shape.y, maxX: shape.x + shape.w, maxY: shape.y + shape.h };
    case 'circle':
      return { minX: shape.cx - shape.r, minY: shape.cy - shape.r, maxX: shape.cx + shape.r, maxY: shape.cy + shape.r };
    case 'ellipse':
      return { minX: shape.cx - shape.rx, minY: shape.cy - shape.ry, maxX: shape.cx + shape.rx, maxY: shape.cy + shape.ry };
    case 'line': {
      const cap = shape.w / 2;
      return {
        minX: Math.min(shape.x1, shape.x2) - cap,
        minY: Math.min(shape.y1, shape.y2) - cap,
        maxX: Math.max(shape.x1, shape.x2) + cap,
        maxY: Math.max(shape.y1, shape.y2) + cap,
      };
    }
    case 'path': {
      const pts = pathPoints(shape.d);
      const xs = pts.map(p => p[0]);
      const ys = pts.map(p => p[1]);
      return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
    }
  }
};

/** Points along the segment from a to b, every `step` units (both ends included). */
const along = (a: [number, number], b: [number, number], step = 0.25): Array<[number, number]> => {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  return Array.from({ length: n + 1 }, (_, i): [number, number] => [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
};

/**
 * True when a shape reaches into the label's corner (x < maxX and y < maxY). Paths are walked
 * along their control polygon (closed), which contains each quadratic curve segment; other shapes
 * use their bounds.
 */
export const artIntrudes = (shape: ArtShape, region: { maxX: number; maxY: number } = SERVICE_ART_EXCLUSION): boolean => {
  const inside = ([x, y]: [number, number]) => x < region.maxX && y < region.maxY;
  if (shape.t !== 'path') {
    const b = artShapeBounds(shape);
    return b.minX < region.maxX && b.minY < region.maxY;
  }
  const pts = pathPoints(shape.d);
  return pts.some((p, i) => along(p, pts[(i + 1) % pts.length]).some(inside));
};
