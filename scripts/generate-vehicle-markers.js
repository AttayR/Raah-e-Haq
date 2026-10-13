#!/usr/bin/env node
/**
 * Generates the top-down vehicle map markers (T-517, DESIGN_SYSTEM §5.21) as PNG @1x/@2x/@3x
 * for light and dark map styles: src/assets/vehicles/<type>-<mode>[@2x|@3x].png.
 *
 *   node scripts/generate-vehicle-markers.js
 *
 * No dependencies (Node 22.2+ for zlib.crc32): every vehicle is a stack of signed-distance shapes (rounded rects, circles,
 * rounded polygons) in a 40×40 design box, pointing north (up), rasterised with analytic
 * anti-aliasing (coverage = 0.5 − distance in pixels) and written with Node's zlib. The shapes
 * are resolution independent, so each scale is drawn natively (crisp at 1x-3x), not resized.
 *
 * Shape language (shared by all three): one silhouette with a 2pt `routeLineCasing` outline so
 * the marker separates from any road or route line without a shadow (§5.21 b), body in
 * `driverMarker`, glass in `borderStrong`, saffron `accent` front lights (they also show which
 * way the vehicle faces), `danger` tail lights, 1pt casing-coloured seams between parts.
 *
 * The colours below are the theme's semantic token values; `__tests__/theme/vehicleMarkerAssets.test.ts`
 * fails when a token changes without the assets being regenerated (it compares this table and
 * `src/assets/vehicles/manifest.json` with `src/theme/tokens.ts`).
 */
const { Buffer } = require('buffer');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/** §5.21 vehicle marker box (design points); keep equal to componentTokens.ride.vehicleMarker.size. */
const SIZE = 40;
const SCALES = [1, 2, 3];
const OUT_DIR = path.join(__dirname, '..', 'src', 'assets', 'vehicles');

/** role → [semantic token, light value, dark value] */
const ROLES = {
  body: ['driverMarker', '#0F1422', '#F2F4F9'],
  casing: ['routeLineCasing', '#FFFFFF', '#0B0F1A'],
  glass: ['borderStrong', '#858EA5', '#626E90'],
  lights: ['accent', '#F59A23', '#F59A23'],
  tail: ['danger', '#C0262D', '#FF7A7F'],
};

// ---------- signed distance primitives (design units; negative = inside) ----------

const roundRect = (x0, y0, x1, y1, r) => (px, py) => {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const hx = (x1 - x0) / 2 - r;
  const hy = (y1 - y0) / 2 - r;
  const qx = Math.abs(px - cx) - hx;
  const qy = Math.abs(py - cy) - hy;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
};

const circle = (cx, cy, r) => (px, py) => Math.hypot(px - cx, py - cy) - r;

/** Convex or concave polygon (Inigo Quilez's sdPolygon), corners rounded by `r`. */
const polygon = (points, r = 0) => (px, py) => {
  let d = Infinity;
  let sign = 1;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const ex = xj - xi;
    const ey = yj - yi;
    const wx = px - xi;
    const wy = py - yi;
    const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey)));
    d = Math.min(d, Math.hypot(wx - ex * t, wy - ey * t));
    const c1 = py >= yi;
    const c2 = py < yj;
    const c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) sign = -sign;
  }
  return sign * d - r;
};

/** A straight bar between two points (round caps), `w` wide. */
const bar = (ax, ay, bx, by, w) => (px, py) => {
  const ex = bx - ax;
  const ey = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey)));
  return Math.hypot(px - ax - ex * t, py - ay - ey * t) - w / 2;
};

const union = (...shapes) => (px, py) => Math.min(...shapes.map((s) => s(px, py)));
const grow = (shape, by) => (px, py) => shape(px, py) - by;
/** Mirror a shape across the vertical centre line (vehicles are symmetric). */
const mirrored = (shape) => union(shape, (px, py) => shape(SIZE - px, py));

// ---------- the vehicles (north-up, 40×40) ----------

/**
 * Each layer: { shape, role, seam? } painted in order. `seam` paints a 1pt casing ring around
 * the part first, so parts of the same colour still read as separate shapes.
 */
const OUTLINE = 2;
const SEAM = 0.9;

function car() {
  const body = roundRect(12, 3, 28, 37, 6.5);
  const mirrors = mirrored(roundRect(9.6, 12.2, 12.6, 14.6, 1.2));
  const windshield = polygon([[15.2, 10.4], [24.8, 10.4], [25.8, 15.8], [14.2, 15.8]], 1.2);
  const rear = polygon([[14.8, 29], [25.2, 29], [24.4, 32.4], [15.6, 32.4]], 1);
  const sideWindows = mirrored(roundRect(13.4, 17.2, 14.6, 27.6, 0.6));
  const head = mirrored(roundRect(13.8, 3.6, 17.4, 5.4, 0.9));
  const tail = mirrored(roundRect(14, 35, 17, 36.4, 0.7));
  return {
    silhouette: union(body, mirrors),
    layers: [
      { shape: mirrors, role: 'body' },
      { shape: body, role: 'body' },
      { shape: windshield, role: 'glass' },
      { shape: rear, role: 'glass' },
      { shape: sideWindows, role: 'glass' },
      { shape: head, role: 'lights' },
      { shape: tail, role: 'tail' },
    ],
  };
}

function bike() {
  const frontWheel = roundRect(18.3, 2.6, 21.7, 11.2, 1.7);
  const rearWheel = roundRect(18.3, 28.6, 21.7, 37.4, 1.7);
  const frame = roundRect(16.6, 8.6, 23.4, 33.6, 3.4);
  const handlebar = bar(11.6, 11.6, 28.4, 11.6, 2.2);
  const arms = mirrored(bar(14.6, 18.6, 12.8, 12.4, 2.6));
  const shoulders = roundRect(12.6, 16.8, 27.4, 25.4, 4.2);
  const helmet = circle(20, 19.6, 4.4);
  const head = circle(20, 4.6, 1.4);
  const tail = roundRect(18.6, 35.2, 21.4, 36.6, 0.7);
  return {
    silhouette: union(frontWheel, rearWheel, frame, handlebar, arms, shoulders),
    layers: [
      { shape: frontWheel, role: 'body' },
      { shape: rearWheel, role: 'body' },
      { shape: frame, role: 'body', seam: true },
      { shape: handlebar, role: 'body', seam: true },
      { shape: arms, role: 'body', seam: true },
      { shape: shoulders, role: 'body', seam: true },
      { shape: helmet, role: 'lights', seam: true },
      { shape: head, role: 'lights' },
      { shape: tail, role: 'tail' },
    ],
  };
}

/**
 * Scales a shape by `k` about (cx, cy) and moves that point to the canvas centre. Distances stay
 * in canvas points, so the 2pt outline and seams keep their width.
 */
const scaledAbout = (shape, k, cx, cy) => (px, py) =>
  shape(cx + (px - SIZE / 2) / k, cy + (py - SIZE / 2) / k) * k;

/**
 * Rickshaw: drawn in a 40-box layout spanning y 2.1–37.5 (cowl tip incl. rounding to canopy
 * end), then scaled to RICKSHAW_LENGTH and centred, so with its 2pt casing it is ~34pt long
 * (a three-wheeler is shorter than a car) and nothing touches the canvas edge.
 */
const RICKSHAW_LENGTH = 30;
const RICKSHAW_TOP = 2.1;
const RICKSHAW_BOTTOM = 37.5;

function rickshaw() {
  const k = RICKSHAW_LENGTH / (RICKSHAW_BOTTOM - RICKSHAW_TOP);
  const fit = (shape) => scaledAbout(shape, k, SIZE / 2, (RICKSHAW_TOP + RICKSHAW_BOTTOM) / 2);
  const canopy = fit(roundRect(11, 13.5, 29, 37.5, 5));
  const cowl = fit(polygon([[17, 4.1], [23, 4.1], [26.4, 15.5], [13.6, 15.5]], 2));
  const rearWheels = fit(mirrored(roundRect(8.6, 27.9, 11.6, 35.1, 1.3)));
  const windshield = fit(polygon([[16.4, 11.1], [23.6, 11.1], [25, 15.9], [15, 15.9]], 1));
  const seams = fit(mirrored(roundRect(15.4, 19.5, 16.4, 33.5, 0.5)));
  const head = fit(circle(20, 6.1, 1.6));
  const tail = fit(mirrored(roundRect(12.8, 35.5, 15.8, 36.9, 0.7)));
  return {
    silhouette: union(canopy, cowl, rearWheels),
    layers: [
      { shape: rearWheels, role: 'body' },
      { shape: cowl, role: 'body' },
      { shape: canopy, role: 'body', seam: true },
      { shape: windshield, role: 'glass' },
      { shape: seams, role: 'glass' },
      { shape: head, role: 'lights' },
      { shape: tail, role: 'tail' },
    ],
  };
}

const VEHICLES = { car, bike, rickshaw };

// ---------- rasterise ----------

const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);

function render(vehicle, mode, scale) {
  const px = SIZE * scale;
  const rgba = new Float64Array(px * px * 4);
  const colour = (role) => hex(ROLES[role][mode === 'light' ? 1 : 2]);
  const paint = (shape, rgb) => {
    for (let y = 0; y < px; y += 1) {
      for (let x = 0; x < px; x += 1) {
        // Sample at the pixel centre, in design units; distance converted back to pixels.
        const d = shape((x + 0.5) / scale, (y + 0.5) / scale) * scale;
        const a = Math.max(0, Math.min(1, 0.5 - d));
        if (a <= 0) continue;
        const i = (y * px + x) * 4;
        const da = rgba[i + 3];
        const oa = a + da * (1 - a);
        for (let c = 0; c < 3; c += 1) {
          rgba[i + c] = (rgb[c] * a + rgba[i + c] * da * (1 - a)) / oa;
        }
        rgba[i + 3] = oa;
      }
    }
  };
  paint(grow(vehicle.silhouette, OUTLINE), colour('casing'));
  for (const layer of vehicle.layers) {
    if (layer.seam) paint(grow(layer.shape, SEAM), colour('casing'));
    paint(layer.shape, colour(layer.role));
  }
  return { px, rgba };
}

// ---------- PNG (RGBA8, no dependencies) ----------

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body));
  return Buffer.concat([len, body, crc]);
};

function encodePng({ px, rgba }) {
  const raw = Buffer.alloc(px * (px * 4 + 1));
  for (let y = 0; y < px; y += 1) {
    raw[y * (px * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < px * 4; x += 1) {
      raw[y * (px * 4 + 1) + 1 + x] = Math.round(rgba[y * px * 4 + x] * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function main() {
  if (typeof zlib.crc32 !== 'function') {
    throw new Error('Needs Node 22.2 or newer (zlib.crc32).');
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const written = [];
  for (const [type, build] of Object.entries(VEHICLES)) {
    const vehicle = build();
    for (const mode of ['light', 'dark']) {
      for (const scale of SCALES) {
        const name = `${type}-${mode}${scale === 1 ? '' : `@${scale}x`}.png`;
        fs.writeFileSync(path.join(OUT_DIR, name), encodePng(render(vehicle, mode, scale)));
        written.push(name);
      }
    }
  }
  const manifest = {
    generator: 'scripts/generate-vehicle-markers.js',
    size: SIZE,
    scales: SCALES,
    vehicles: Object.keys(VEHICLES),
    colors: Object.fromEntries(
      Object.entries(ROLES).map(([role, [token, light, dark]]) => [role, { token, light, dark }]),
    ),
  };
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Wrote ${written.length} PNGs and manifest.json to ${path.relative(process.cwd(), OUT_DIR)}\n`);
}

if (require.main === module) main();

module.exports = { ROLES, SIZE, SCALES };
