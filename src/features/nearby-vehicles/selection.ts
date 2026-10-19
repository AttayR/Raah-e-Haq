/**
 * Which nearby vehicles the map draws and what the count chip says (T-586, map-vehicles.md §2.1,
 * §2.2, §3, §4). Pure functions, unit tested in `__tests__/features/nearbyVehicles/selection.test.ts`.
 */
import { motionPatterns } from '../../theme';
import type { NearbyCounts, NearbyDriver } from '../../services/rideService';
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
 * The vehicles to draw (§2.1, §3): the tier's drivers, nearest first by `distance_km`, at most
 * `maxMarkers`, overlaps spread. Each keeps its own `vehicle_type` glyph (an AC car serving the
 * car tier still shows the AC car).
 */
export const nearbyMarkerInputs = (
  drivers: ReadonlyArray<NearbyDriver>,
  tier: string | null | undefined,
  max: number = N.maxMarkers,
): NearbyVehicleInput[] => {
  const nearest = driversForTier(drivers, tier)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, max)
    .map(d => ({
      id: d.id,
      vehicleType: d.vehicle_type,
      latitude: d.location.latitude,
      longitude: d.location.longitude,
      heading: d.heading,
    }));
  return spreadOverlaps(nearest);
};

/** What the chip counts (§4): server numbers when BE-116 sends them, else the list. */
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
): NearbyChipCounts => {
  const online = counts?.onlineTotal ?? null;
  if (!tier) return { n: online ?? drivers.length, online };
  const byTier = counts && isVehicleTypeKey(tier) ? counts.byTier[tier] : undefined;
  return { n: byTier ?? driversForTier(drivers, tier).length, online };
};
