/**
 * T-586 (map-vehicles.md §2.1, §2.2, §3, §4): which nearby vehicles are drawn and counted.
 */
import type { NearbyDriver } from '../../../src/services/rideService';
import {
  driversForTier,
  nearbyChipCounts,
  nearbyMarkerInputs,
  servesTier,
  spreadOverlaps,
} from '../../../src/features/nearby-vehicles/selection';
import { distanceMeters } from '../../../src/components/ui/ride/vehicleMotion';
import { motionPatterns } from '../../../src/theme';

const driver = (id: string, over: Partial<NearbyDriver> = {}): NearbyDriver => ({
  id,
  rating: 0,
  vehicle_type: 'car',
  distance_km: 1,
  estimated_arrival_min: 3,
  location: { latitude: 31.52, longitude: 74.355 },
  heading: null,
  ...over,
});

describe('tier filter (§3)', () => {
  it('uses tiers[] when the server sends it: an AC car serves car and car_ac', () => {
    const ac = driver('ac', { vehicle_type: 'car_ac', tiers: ['car', 'car_ac'] });
    expect(servesTier(ac, 'car')).toBe(true);
    expect(servesTier(ac, 'car_ac')).toBe(true);
    expect(servesTier(ac, 'bike')).toBe(false);
    // An empty tiers list serves nothing (the server said so).
    expect(servesTier(driver('x', { tiers: [] }), 'car')).toBe(false);
  });

  it('falls back to vehicle_type without tiers (older server); no tier shows everything', () => {
    expect(servesTier(driver('c'), 'car')).toBe(true);
    expect(servesTier(driver('c'), 'car_ac')).toBe(false);
    expect(servesTier(driver('n', { vehicle_type: null }), 'car')).toBe(false);
    expect(servesTier(driver('n', { vehicle_type: null }), null)).toBe(true);
    const all = [driver('a'), driver('b', { vehicle_type: 'bike' })];
    expect(driversForTier(all, null)).toHaveLength(2);
    expect(driversForTier(all, 'bike').map(d => d.id)).toEqual(['b']);
  });

  it('each vehicle keeps its own glyph type (an AC car serving the car tier is still car_ac)', () => {
    const inputs = nearbyMarkerInputs([driver('ac', { vehicle_type: 'car_ac', tiers: ['car', 'car_ac'] })], 'car');
    expect(inputs[0].vehicleType).toBe('car_ac');
  });
});

describe('marker cap and overlap (§2.1, §2.2)', () => {
  it('draws at most 15, nearest first by distance_km', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      driver(`d${i}`, { distance_km: 20 - i, location: { latitude: 31.5 + i * 0.01, longitude: 74.3 } }),
    );
    const inputs = nearbyMarkerInputs(many, null);
    expect(motionPatterns.nearbyMarker.maxMarkers).toBe(15);
    expect(inputs).toHaveLength(15);
    expect(inputs[0].id).toBe('d19');
    expect(inputs.map(i => i.id)).not.toContain('d0');
  });

  it('spreads vehicles on one grid point on a 40 m circle, ordered by id; single ones stay put', () => {
    const at = { latitude: 31.52, longitude: 74.355 };
    const lone = { id: 'z', vehicleType: 'car', latitude: 31.6, longitude: 74.4, heading: null };
    const spread = spreadOverlaps([
      { id: 'b', vehicleType: 'car', ...at, heading: null },
      { id: 'a', vehicleType: 'bike', ...at, heading: null },
      { id: 'c', vehicleType: 'car', ...at, heading: null },
      lone,
    ]);
    expect(spread[3]).toBe(lone);
    for (const v of spread.slice(0, 3)) expect(distanceMeters(v, at)).toBeCloseTo(40, 0);
    // 'a' is first by id: due north of the point.
    const a = spread.find(v => v.id === 'a');
    expect(a?.longitude).toBeCloseTo(at.longitude, 9);
    expect(a!.latitude).toBeGreaterThan(at.latitude);
    // Distinct positions: the map shows as many as the chip counts.
    expect(new Set(spread.map(v => `${v.latitude},${v.longitude}`)).size).toBe(4);
  });

  it('is a no-op for finer positions (no two on one point)', () => {
    const inputs = [
      { id: 'a', vehicleType: 'car', latitude: 31.52, longitude: 74.355, heading: 10 },
      { id: 'b', vehicleType: 'car', latitude: 31.5203, longitude: 74.355, heading: 10 },
    ];
    expect(spreadOverlaps(inputs)).toEqual(inputs);
  });
});

describe('chip counts (§4)', () => {
  const list = [driver('a'), driver('b', { vehicle_type: 'bike' }), driver('c', { vehicle_type: 'car_ac', tiers: ['car', 'car_ac'] })];

  it('prefers the server counts (BE-116), never the number drawn', () => {
    const counts = { byTier: { car: 31, bike: 4 }, onlineTotal: 52 };
    expect(nearbyChipCounts(list, counts, null)).toEqual({ n: 52, online: 52 });
    expect(nearbyChipCounts(list, counts, 'car')).toEqual({ n: 31, online: 52 });
  });

  it('falls back to the list without counts (the online part is hidden)', () => {
    expect(nearbyChipCounts(list, null, null)).toEqual({ n: 3, online: null });
    expect(nearbyChipCounts(list, null, 'car')).toEqual({ n: 2, online: null });
    expect(nearbyChipCounts(list, null, 'van')).toEqual({ n: 0, online: null });
  });
});
