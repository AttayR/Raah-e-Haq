/**
 * Which nearby vehicles the map draws and what the count chip says (T-586, map-vehicles.md §2.1,
 * §2.2, §3, §4). Pure functions, unit tested in `__tests__/features/nearbyVehicles/selection.test.ts`.
 */
import { motionPatterns } from '../../theme';
import type { NearbyCounts, NearbyDriver, NearbyPrecision, VehicleTypeKey } from '../../services/rideService';
import { isVehicleTypeKey } from '../../services/rideService';

const N = motionPatterns.nearbyMarker;
const M_PER_DEG_LAT = 111_195;

/** One vehicle as the motion layer gets it (primitive fields only). */
export interface NearbyVehicleInput {
  id: string;
  vehicleType: string | null;
  latitude: number;
  longitude: number;
  heading: number | null;
  /** BE-118 (T-590): `fine` glides, `coarse` relocates with a crossfade. */
  precision: NearbyPrecision;
}

/**
 * §3: a driver is shown for a tier when the tier is in its BE-116 `tiers` list (dispatch rules:
 * an AC car serves `car` too; `parcel` only opted-in bikes). Without `tiers` (older server):
 * `vehicle_type === tier`. No tier (Home): every vehicle.
 */
export const servesTier = (driver: NearbyDriver, tier: string | null | undefined): boolean => {
  if (!tier) return true;
  return Array.isArray(driver.tiers) ? driver.tiers.some(t => t === tier) : driver.vehicle_type === tier;
};

export const driversForTier = (drivers: ReadonlyArray<NearbyDriver>, tier: string | null | undefined): NearbyDriver[] =>
  tier ? drivers.filter(d => servesTier(d, tier)) : [...drivers];

/**
 * §2.2 overlap (coarse positions): vehicles that arrive on the same coordinate (today's 550 m
 * grid) are spread on a circle of `overlapSpreadMeters` round it, ordered by id, so the map shows
 * as many vehicles as the chip counts. Inside the position's own uncertainty: it invents nothing.
 * A no-op once positions are finer (no two share a point).
 */
export const spreadOverlaps = (vehicles: ReadonlyArray<NearbyVehicleInput>, radiusMeters: number = N.overlapSpreadMeters): NearbyVehicleInput[] => {
  const groups = new Map<string, NearbyVehicleInput[]>();
  for (const v of vehicles) {
    const key = `${v.latitude.toFixed(6)},${v.longitude.toFixed(6)}`;
    const group = groups.get(key);
    if (group) group.push(v);
    else groups.set(key, [v]);
  }
  const spread = new Map<string, NearbyVehicleInput>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    ordered.forEach((v, i) => {
      const angle = (2 * Math.PI * i) / ordered.length;
      const north = radiusMeters * Math.cos(angle);
      const east = radiusMeters * Math.sin(angle);
      const mPerDegLng = M_PER_DEG_LAT * Math.cos((v.latitude * Math.PI) / 180);
      spread.set(v.id, {
        ...v,
        latitude: v.latitude + north / M_PER_DEG_LAT,
        longitude: v.longitude + (mPerDegLng > 0 ? east / mPerDegLng : 0),
      });
    });
  }
  return vehicles.map(v => spread.get(v.id) ?? v);
};

/**
 * T-586 part 2 (design review: a bike drew on top of a car close by): vehicles closer than
 * `minMeters` (about the spread, ~30 pt on screen) are pushed apart along the line between them,
 * half each, in one pass. Cheap (≤ 15 markers, ≤ 105 pairs), and continuous in the positions, so
 * two vehicles driving past each other glide apart instead of hopping. Identical points are
 * spread first by `spreadOverlaps`.
 */
export const separateClose = (vehicles: ReadonlyArray<NearbyVehicleInput>, minMeters: number): NearbyVehicleInput[] => {
  if (vehicles.length < 2 || !(minMeters > 0)) return [...vehicles];
  const lat0 = vehicles[0].latitude;
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat0 * Math.PI) / 180);
  if (!(mPerDegLng > 0)) return [...vehicles];
  // Local metres (east, north) round the first vehicle.
  const pts = vehicles.map(v => ({ x: (v.longitude - vehicles[0].longitude) * mPerDegLng, y: (v.latitude - lat0) * M_PER_DEG_LAT }));
  const shift = pts.map(() => ({ x: 0, y: 0 }));
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      const dx = pts[j].x - pts[i].x;
      const dy = pts[j].y - pts[i].y;
      const d = Math.hypot(dx, dy);
      if (d >= minMeters || d < 0.01) continue;
      const push = (minMeters - d) / 2;
      shift[i].x -= (dx / d) * push;
      shift[i].y -= (dy / d) * push;
      shift[j].x += (dx / d) * push;
      shift[j].y += (dy / d) * push;
    }
  }
  return vehicles.map((v, i) =>
    shift[i].x === 0 && shift[i].y === 0
      ? v
      : { ...v, latitude: v.latitude + shift[i].y / M_PER_DEG_LAT, longitude: v.longitude + shift[i].x / mPerDegLng },
  );
};

/**
 * T-586 design review: the overlap spread is ~`overlapSpreadPt` points on screen at the current
 * zoom, in metres: `latitudeDelta` spans `mapHeightPt` points. Falls back to the fixed
 * `overlapSpreadMeters` while no region (or no map height) is known yet.
 */
export const overlapSpreadMetersFor = (
  latitudeDelta: number | null | undefined,
  mapHeightPt: number | null | undefined,
  points: number = N.overlapSpreadPt,
): number => {
  if (!latitudeDelta || !mapHeightPt || !(latitudeDelta > 0) || !(mapHeightPt > 0)) return N.overlapSpreadMeters;
  return (latitudeDelta * M_PER_DEG_LAT * points) / mapHeightPt;
};

/**
 * Tiers an older server (no BE-116 `tiers`) cannot be filtered for on the phone: an AC car and a
 * parcel bike are rules the server applies (AC approval, parcel opt-in), so the map asks for them
 * with `vehicle_type` instead (T-586 design review).
 */
const SERVER_FILTERED_TIERS: ReadonlyArray<VehicleTypeKey> = ['car_ac', 'parcel'];

/** True when the response carries BE-116 data (`counts`, or `tiers` on any driver). */
export const responseHasTiers = (drivers: ReadonlyArray<NearbyDriver>, counts: NearbyCounts | null | undefined): boolean =>
  !!counts || drivers.some(d => Array.isArray(d.tiers));

/**
 * The `vehicle_type` the nearby read must carry for `tier`: `car_ac` / `parcel` while the server
 * sends no `tiers` (it applies the AC and parcel rules), else none (BE-116 data filters on the
 * phone with no extra read).
 */
export const tierReadFor = (tier: string | null | undefined, hasTiers: boolean): VehicleTypeKey | null => {
  if (hasTiers || !tier) return null;
  return SERVER_FILTERED_TIERS.find(t => t === tier) ?? null;
};

/**
 * The glyph a nearby vehicle draws (§1.1, §3: true to the vehicle). BE-116 sends the vehicle kind
 * in `vehicle_type` (an AC car is a `car`) and what it may serve in `tiers`: a car whose tiers
 * include `car_ac` is an AC car on every screen (Home, and under the Car tier too). A bike shown
 * for the parcel tier carries its box (`parcel`), as the tier's own list read does on older
 * servers. Anything else keeps its own `vehicle_type`.
 */
export const glyphTypeFor = (driver: NearbyDriver, tier: string | null | undefined): string | null => {
  if (Array.isArray(driver.tiers) && driver.tiers.includes('car_ac')) return 'car_ac';
  if (tier === 'parcel' && driver.vehicle_type === 'bike') return 'parcel';
  return driver.vehicle_type;
};

export interface NearbyMarkerOptions {
  /**
   * The tier the list was read for (`vehicle_type` read): every vehicle in it serves that tier,
   * so none is filtered out and each draws the tier's own glyph (AC car, parcel bike).
   */
  listTier?: string | null;
  spreadMeters?: number;
  max?: number;
}

/**
 * The vehicles to draw (§2.1, §3): the tier's drivers, nearest first by `distance_km`, at most
 * `maxMarkers`, overlaps spread. Each keeps its own glyph (`glyphTypeFor`: an AC car serving the
 * car tier still shows the AC car), except in a list read for the tier itself (see `listTier`).
 */
export const nearbyMarkerInputs = (
  drivers: ReadonlyArray<NearbyDriver>,
  tier: string | null | undefined,
  options: NearbyMarkerOptions = {},
): NearbyVehicleInput[] => {
  const { listTier = null, spreadMeters = N.overlapSpreadMeters, max = N.maxMarkers } = options;
  const tierList = !!tier && listTier === tier;
  const nearest = (tierList ? [...drivers] : driversForTier(drivers, tier))
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, max)
    .map(d => ({
      id: d.id,
      vehicleType: tierList ? tier : glyphTypeFor(d, tier),
      latitude: d.location.latitude,
      longitude: d.location.longitude,
      heading: d.heading,
      precision: d.precision ?? 'coarse',
    }));
  return separateClose(spreadOverlaps(nearest, spreadMeters), spreadMeters);
};

/**
 * What the chip counts (§4): server numbers when BE-116 sends them, else the list (a list read
 * for the tier itself counts whole).
 */
export interface NearbyChipCounts {
  /** Home: online drivers near you. Choose ride: vehicles of the tier. */
  n: number;
  /** The total online in the radius (Choose ride's second part); null when the server sent no counts. */
  online: number | null;
}

export const nearbyChipCounts = (
  drivers: ReadonlyArray<NearbyDriver>,
  counts: NearbyCounts | null | undefined,
  tier: string | null | undefined,
  listTier: string | null = null,
): NearbyChipCounts => {
  const online = counts?.onlineTotal ?? null;
  if (!tier) return { n: online ?? drivers.length, online };
  const byTier = counts && isVehicleTypeKey(tier) ? counts.byTier[tier] : undefined;
  if (byTier !== undefined) return { n: byTier, online };
  return { n: listTier === tier ? drivers.length : driversForTier(drivers, tier).length, online };
};
