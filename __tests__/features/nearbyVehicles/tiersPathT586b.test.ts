/**
 * T-586 part 2 (BE-116 wiring + design review):
 * - tiers path: a car whose tiers include car_ac draws the AC car on Home and in every tier; in the
 *   parcel tier a bike draws the parcel bike; plain cars stay cars;
 * - close (not identical) vehicles are pushed apart to the minimum spacing, far ones are untouched;
 * - a cold Choose ride on AC: the first (AC) reply carries tiers, so it answers the tier (no
 *   "Finding…" while the next, unfiltered poll waits for its floor);
 * - finding a driver keeps the requested tier's vehicles (useBookingNearby) with no chip.
 */
import { AppState, AppStateStatus } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import rideService, { type NearbyDriver, type NearbyDriversResult, type RideResource } from '../../../src/services/rideService';
import { __resetConnectivityForTests } from '../../../src/core/api/connectivity';
import { NEARBY_MIN_GAP_MS, NEARBY_TIER_SETTLE_MS, __resetNearbyDriversThrottleForTests, useNearbyDrivers } from '../../../src/hooks/useNearbyDrivers';
import { glyphTypeFor, nearbyMarkerInputs, separateClose, type NearbyVehicleInput } from '../../../src/features/nearby-vehicles/selection';
import { useBookingNearby } from '../../../src/features/ride-booking/useBookingNearby';
import { distanceMeters } from '../../../src/components/ui/ride/vehicleMotion';

jest.mock('../../../src/components/ui/Banner', () => ({ useIsOffline: () => false }));

const M_PER_DEG_LAT = 111_195;
const ORIGIN = { latitude: 31.52, longitude: 74.355 };
const at = (north: number, east = 0) => ({
  latitude: ORIGIN.latitude + north / M_PER_DEG_LAT,
  longitude: ORIGIN.longitude + east / (M_PER_DEG_LAT * Math.cos((ORIGIN.latitude * Math.PI) / 180)),
});

const drv = (id: string, over: Partial<NearbyDriver> = {}): NearbyDriver => ({
  id,
  rating: 0,
  vehicle_type: 'car',
  distance_km: 1,
  estimated_arrival_min: 3,
  location: at(Number(id.replace(/\D/g, '') || 0) * 500),
  heading: null,
  ...over,
});
const res = (drivers: NearbyDriver[], counts: NearbyDriversResult['counts'] = null): NearbyDriversResult => ({ drivers, counts });
const lahore = { latitude: 31.5204, longitude: 74.3587 };

describe('tiers path glyphs (BE-116)', () => {
  const ac = drv('a1', { tiers: ['car', 'car_ac'] });
  const car = drv('c2', { tiers: ['car'] });
  const bike = drv('b3', { vehicle_type: 'bike', tiers: ['bike', 'parcel'] });

  it('glyphTypeFor: AC car everywhere, parcel bike in the parcel tier, else the vehicle', () => {
    expect(glyphTypeFor(ac, null)).toBe('car_ac');
    expect(glyphTypeFor(ac, 'car')).toBe('car_ac');
    expect(glyphTypeFor(ac, 'car_ac')).toBe('car_ac');
    expect(glyphTypeFor(car, 'car')).toBe('car');
    expect(glyphTypeFor(bike, null)).toBe('bike');
    expect(glyphTypeFor(bike, 'bike')).toBe('bike');
    expect(glyphTypeFor(bike, 'parcel')).toBe('parcel');
    // An older server (no tiers) keeps vehicle_type.
    expect(glyphTypeFor(drv('o4'), 'car')).toBe('car');
  });

  it('nearbyMarkerInputs on the tiers path (no listTier): AC selected draws AC cars, not plain cars', () => {
    const all = [ac, car, bike];
    const byId = (tier: string | null) => Object.fromEntries(nearbyMarkerInputs(all, tier).map(v => [v.id, v.vehicleType]));
    expect(byId('car_ac')).toEqual({ a1: 'car_ac' });
    expect(byId('car')).toEqual({ a1: 'car_ac', c2: 'car' });
    expect(byId('parcel')).toEqual({ b3: 'parcel' });
    expect(byId(null)).toEqual({ a1: 'car_ac', c2: 'car', b3: 'bike' });
  });
});

describe('separateClose (design review: a bike on top of a car)', () => {
  const v = (id: string, north: number, east = 0): NearbyVehicleInput => ({ id, vehicleType: 'car', heading: null, ...at(north, east) });

  it('pushes a close pair apart to the minimum, half each, along the line between them', () => {
    const [a, b] = separateClose([v('a', 0), v('b', 10)], 40);
    expect(distanceMeters(a, b)).toBeCloseTo(40, 0);
    expect(distanceMeters(a, at(-15))).toBeLessThan(0.5);
    expect(distanceMeters(b, at(25))).toBeLessThan(0.5);
  });

  it('leaves vehicles already far enough apart (and a lone vehicle) untouched', () => {
    const input = [v('a', 0), v('b', 100), v('c', 0, 300)];
    const out = separateClose(input, 40);
    out.forEach((p, i) => expect(p).toBe(input[i]));
    expect(separateClose([v('x', 0)], 40)).toHaveLength(1);
  });

  it('is applied by nearbyMarkerInputs (close vehicles of the map end up ≥ the spread apart)', () => {
    const list = [drv('a', { location: at(0) }), drv('b', { location: at(0, 12), vehicle_type: 'bike' })];
    const [p, q] = nearbyMarkerInputs(list, null, { spreadMeters: 40 });
    expect(distanceMeters(p, q)).toBeGreaterThan(39);
  });
});

describe('reads', () => {
  let spy: jest.SpyInstance;
  const advance = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    __resetNearbyDriversThrottleForTests();
    __resetConnectivityForTests();
    spy = jest.spyOn(rideService, 'getNearbyDriversResult');
    (AppState as { currentState: AppStateStatus }).currentState = 'active';
    (AppState.addEventListener as jest.Mock).mockImplementation(() => ({ remove: jest.fn() }));
  });
  afterEach(() => {
    spy.mockRestore();
    jest.useRealTimers();
  });

  it('cold Choose ride on AC: the AC reply with tiers answers the tier; the next poll is unfiltered, no burst', async () => {
    const counts = { byTier: { car: 5, car_ac: 2 }, onlineTotal: 9 };
    spy.mockImplementation(async () => res([drv('a1', { tiers: ['car', 'car_ac'] })], counts));
    const { result } = renderHook(() => useNearbyDrivers(lahore, { tier: 'car_ac' }));
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].vehicleType).toBe('car_ac');
    await advance(NEARBY_TIER_SETTLE_MS);
    // Ready with the AC reply (not "Finding…" for 10 s).
    expect(result.current.status).toBe('ready');
    expect(result.current.counts?.onlineTotal).toBe(9);
    await advance(NEARBY_MIN_GAP_MS);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1][0].vehicleType).toBeUndefined();
  });

  it('finding a driver: the requested tier stays on the map, no chip; a taken ride shows none', async () => {
    spy.mockImplementation(async () => res([drv('a1', { tiers: ['car', 'car_ac'] }), drv('c2', { tiers: ['car'] })], { byTier: { car: 2 }, onlineTotal: 2 }));
    const ride = { id: 7, vehicle_type: 'car_ac', status: 'requested' } as unknown as RideResource;
    const base = { center: lahore, focused: true, ride, requesting: true, rideEnded: false, choosing: false, selectedTier: 'car_ac', chipShown: false };
    const { result, rerender } = renderHook((p: { searching: boolean }) => useBookingNearby({ ...base, searching: p.searching }), {
      initialProps: { searching: true },
    });
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.tier).toBe('car_ac');
    expect(result.current.drivers).toHaveLength(2);
    expect(result.current.chipVisible).toBe(false);
    // The driver took it: no nearby vehicles, no more reads.
    rerender({ searching: false });
    expect(result.current.drivers).toBeNull();
    await advance(60_000);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
