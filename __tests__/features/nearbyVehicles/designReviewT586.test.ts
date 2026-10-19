/**
 * T-586 design review (light and dark):
 * 1. on Choose ride the count chip covered the drop-off pin: while the chip shows, the route fit
 *    keeps sheet + 72 at the bottom (chip bottom 24 + chip 32 + 16 for a pin);
 * 2. "No AC cars nearby right now" with 11 approved AC cars online: without BE-116 `tiers`, AC and
 *    parcel are read with `vehicle_type` (one read, after a 300 ms settle, under the 10 s floor),
 *    every vehicle in that reply draws the tier's glyph, the chip counts it, and shows loading until
 *    it lands; with BE-116 data no extra read is made;
 * 3. stacked vehicles spread by ~30 pt at the current zoom, not a fixed 40 m.
 */
import { AppState, AppStateStatus } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import rideService, { type NearbyDriver, type NearbyDriversResult } from '../../../src/services/rideService';
import { __resetConnectivityForTests } from '../../../src/core/api/connectivity';
import {
  NEARBY_MIN_GAP_MS,
  NEARBY_TIER_SETTLE_MS,
  __resetNearbyDriversThrottleForTests,
  useNearbyDrivers,
} from '../../../src/hooks/useNearbyDrivers';
import {
  nearbyChipCounts,
  nearbyMarkerInputs,
  overlapSpreadMetersFor,
  responseHasTiers,
  spreadOverlaps,
  tierReadFor,
} from '../../../src/features/nearby-vehicles/selection';
import { nearbyChipContent } from '../../../src/features/nearby-vehicles/chipText';
import { NEARBY_CHIP_ROUTE_CLEARANCE } from '../../../src/features/nearby-vehicles';
import { bookingRouteFitPadding, useBookingMapCamera } from '../../../src/features/ride-booking/useBookingMapCamera';
import { useOverlapSpread } from '../../../src/features/nearby-vehicles/useOverlapSpread';
import { viewportEdgePadding, type MapViewport } from '../../../src/features/active-ride/camera';
import { distanceMeters } from '../../../src/components/ui/ride/vehicleMotion';
import { motionPatterns } from '../../../src/theme';

const drv = (id: string, over: Partial<NearbyDriver> = {}): NearbyDriver => ({
  id,
  rating: 0,
  vehicle_type: 'car',
  distance_km: 1,
  estimated_arrival_min: 3,
  location: { latitude: 31.52, longitude: 74.355 },
  heading: null,
  ...over,
});
const res = (drivers: NearbyDriver[], counts: NearbyDriversResult['counts'] = null): NearbyDriversResult => ({ drivers, counts });
const lahore = { latitude: 31.5204, longitude: 74.3587 };

describe('1. route fit keeps the drop-off pin above the count chip', () => {
  const viewport: MapViewport = { mapHeight: 800, bottom: 400, top: 103 };

  it('is sheet + 72 at the bottom while the chip shows, and today\'s padding when hidden', () => {
    expect(NEARBY_CHIP_ROUTE_CLEARANCE).toBe(72);
    expect(bookingRouteFitPadding(viewport, true)).toEqual({ ...viewportEdgePadding(viewport), bottom: 472 });
    expect(bookingRouteFitPadding(viewport, false)).toEqual(viewportEdgePadding(viewport));
    // No sheet measured yet: the default padding either way.
    expect(bookingRouteFitPadding({ ...viewport, bottom: 0 }, true)).toEqual(viewportEdgePadding({ ...viewport, bottom: 0 }));
    expect(bookingRouteFitPadding(null, true)).toEqual(viewportEdgePadding(null));
  });

  it('the booking camera fits the route with it, and refits when the chip shows or hides', () => {
    jest.useFakeTimers();
    const map = { animateToRegion: jest.fn(), fitToCoordinates: jest.fn() };
    const mapRef = { current: map } as never;
    const viewportRef = { current: viewport };
    const route = [{ latitude: 31.52, longitude: 74.35 }, { latitude: 31.47, longitude: 74.41 }];
    const holds = () => false;
    const { result, rerender } = renderHook(
      ({ chipVisible }: { chipVisible: boolean }) =>
        useBookingMapCamera({
          mapRef,
          currentLocation: null,
          viewportRef,
          sheetHeight: 400,
          routeCoordinates: route,
          rideCameraHoldsMap: holds,
          onRideCameraMapReady: jest.fn(),
          requestLocationPermission: jest.fn(),
          chipVisible,
        }),
      { initialProps: { chipVisible: true } },
    );
    act(() => result.current.onMapLoaded());
    expect(map.fitToCoordinates).toHaveBeenLastCalledWith(route, { edgePadding: expect.objectContaining({ bottom: 472 }), animated: true });
    rerender({ chipVisible: false });
    expect(map.fitToCoordinates).toHaveBeenLastCalledWith(route, { edgePadding: viewportEdgePadding(viewport), animated: true });
    jest.useRealTimers();
  });
});

describe('2. AC and parcel without BE-116 tiers', () => {
  it('rules: only car_ac and parcel need their own read, and only without tiers or counts', () => {
    expect(responseHasTiers([drv('a')], null)).toBe(false);
    expect(responseHasTiers([drv('a', { tiers: ['car'] })], null)).toBe(true);
    expect(responseHasTiers([], { byTier: {}, onlineTotal: 0 })).toBe(true);
    expect(tierReadFor('car_ac', false)).toBe('car_ac');
    expect(tierReadFor('parcel', false)).toBe('parcel');
    expect(tierReadFor('car', false)).toBeNull();
    expect(tierReadFor(null, false)).toBeNull();
    expect(tierReadFor('car_ac', true)).toBeNull();
  });

  it('a list read for the tier: every vehicle drawn with the tier glyph, and the chip counts it', () => {
    // The server applied the AC rule; the cars may still say vehicle_type `car`.
    const list = [drv('a'), drv('b', { vehicle_type: 'car_ac' }), drv('c')];
    const inputs = nearbyMarkerInputs(list, 'car_ac', { listTier: 'car_ac' });
    expect(inputs).toHaveLength(3);
    expect(inputs.every(v => v.vehicleType === 'car_ac')).toBe(true);
    expect(nearbyChipCounts(list, null, 'car_ac', 'car_ac')).toEqual({ n: 3, online: null });
    // Not read for the tier: today's vehicle_type filter.
    expect(nearbyChipCounts(list, null, 'car_ac')).toEqual({ n: 1, online: null });
    const bikes = [drv('p', { vehicle_type: 'bike' })];
    expect(nearbyMarkerInputs(bikes, 'parcel', { listTier: 'parcel' })[0].vehicleType).toBe('parcel');
  });

  describe('the read', () => {
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

    const chipText = (state: ReturnType<typeof useNearbyDrivers>, tier: string | null) =>
      nearbyChipContent({ status: state.status, failed: false, tier, counts: nearbyChipCounts(state.drivers, state.counts, tier, state.listTier ?? null) })?.primary;

    it('selecting AC on an older server makes one AC read; loading until it lands, then its length', async () => {
      const acCars = Array.from({ length: 11 }, (_, i) => drv(`ac${i}`));
      spy.mockImplementation(async ({ vehicleType }) => (vehicleType === 'car_ac' ? res(acCars) : res([drv('c1'), drv('c2')])));
      const { result, rerender } = renderHook(({ tier }: { tier: string | null }) => useNearbyDrivers(lahore, { tier }), {
        initialProps: { tier: 'car' as string | null },
      });
      await advance(0);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].vehicleType).toBeUndefined();
      expect(result.current.status).toBe('ready');

      rerender({ tier: 'car_ac' });
      // At once: loading, never "No AC cars nearby".
      expect(result.current.status).toBe('loading');
      expect(chipText(result.current, 'car_ac')).toBe('Finding AC cars nearby…');
      await advance(NEARBY_TIER_SETTLE_MS);
      // The 10 s floor still holds.
      expect(spy).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('loading');
      await advance(NEARBY_MIN_GAP_MS);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[1][0].vehicleType).toBe('car_ac');
      expect(result.current).toMatchObject({ status: 'ready', listTier: 'car_ac' });
      expect(nearbyChipCounts(result.current.drivers, result.current.counts, 'car_ac', result.current.listTier ?? null).n).toBe(11);
      expect(chipText(result.current, 'car_ac')).not.toMatch(/^No /);
    });

    it('quick switching makes no burst: the last selection after 300 ms wins, one read', async () => {
      spy.mockImplementation(async ({ vehicleType }) => res([drv(`x-${vehicleType ?? 'all'}`)]));
      const { result, rerender } = renderHook(({ tier }: { tier: string | null }) => useNearbyDrivers(lahore, { tier }), {
        initialProps: { tier: 'car' as string | null },
      });
      await advance(NEARBY_MIN_GAP_MS);
      expect(spy).toHaveBeenCalledTimes(1);
      for (const tier of ['car_ac', 'car', 'parcel', 'bike', 'car_ac', 'parcel']) {
        rerender({ tier });
        await advance(100);
      }
      // Nothing read while switching.
      expect(spy).toHaveBeenCalledTimes(1);
      await advance(NEARBY_TIER_SETTLE_MS);
      await advance(NEARBY_MIN_GAP_MS);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls[1][0].vehicleType).toBe('parcel');
      expect(result.current).toMatchObject({ status: 'ready', listTier: 'parcel' });
    });

    it('with BE-116 tiers and counts no extra read is made', async () => {
      const list = [drv('ac', { vehicle_type: 'car_ac', tiers: ['car', 'car_ac'] }), drv('c', { tiers: ['car'] })];
      spy.mockResolvedValue(res(list, { byTier: { car: 2, car_ac: 1 }, onlineTotal: 2 }));
      const { result, rerender } = renderHook(({ tier }: { tier: string | null }) => useNearbyDrivers(lahore, { tier }), {
        initialProps: { tier: 'car' as string | null },
      });
      await advance(0);
      rerender({ tier: 'car_ac' });
      expect(result.current.status).toBe('ready');
      await advance(NEARBY_TIER_SETTLE_MS);
      await advance(NEARBY_MIN_GAP_MS - 1);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(nearbyChipCounts(result.current.drivers, result.current.counts, 'car_ac', result.current.listTier ?? null).n).toBe(1);
    });

    it('a BE-116 server stays known across blur/background: no vehicle_type read, the seed shows, no "Finding…"', async () => {
      const list = [drv('ac', { vehicle_type: 'car_ac', tiers: ['car', 'car_ac'] })];
      spy.mockResolvedValue(res(list, { byTier: { car: 1, car_ac: 1 }, onlineTotal: 1 }));
      type P = { tier: string | null; enabled: boolean };
      const statuses: string[] = [];
      let recording = false;
      const { result, rerender } = renderHook(
        ({ tier, enabled }: P) => {
          const state = useNearbyDrivers(lahore, { tier, enabled });
          if (recording) statuses.push(state.status);
          return state;
        },
        { initialProps: { tier: 'car', enabled: true } as P },
      );
      await advance(0);
      rerender({ tier: 'car_ac', enabled: true });
      await advance(NEARBY_TIER_SETTLE_MS);
      // Blur / background, for longer than the settle time.
      rerender({ tier: 'car_ac', enabled: false });
      await advance(NEARBY_TIER_SETTLE_MS * 2);
      await advance(0);
      recording = true;
      rerender({ tier: 'car_ac', enabled: true });
      await advance(0);
      // The seed is applied at once: the list on screen, ready.
      expect(result.current).toMatchObject({ status: 'ready', listTier: null });
      expect(result.current.drivers).toHaveLength(1);
      expect(spy).toHaveBeenCalledTimes(1);
      await advance(NEARBY_MIN_GAP_MS);
      await advance(0);
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy.mock.calls.every(([query]) => query.vehicleType === undefined)).toBe(true);
      const seeded = statuses.indexOf('ready');
      expect(seeded).toBeGreaterThanOrEqual(0);
      expect(statuses.slice(seeded)).not.toContain('loading');
    });
  });
});

describe('3. overlap spread is ~30 pt at the current zoom', () => {
  const stacked = ['a', 'b', 'c'].map(id => ({ id, vehicleType: 'car', latitude: 31.52, longitude: 74.355, heading: null }));

  it('converts points to metres from the region', () => {
    expect(motionPatterns.nearbyMarker.overlapSpreadPt).toBe(30);
    // 0.01° of latitude over 600 pt: 1111.95 m / 600 pt ≈ 1.85 m/pt → ~55.6 m.
    expect(overlapSpreadMetersFor(0.01, 600)).toBeCloseTo(55.6, 1);
    // Zoomed out 4×: four times the metres, the same 30 pt on screen.
    expect(overlapSpreadMetersFor(0.04, 600)).toBeCloseTo(4 * overlapSpreadMetersFor(0.01, 600), 6);
    // No region or no map height yet: the fixed fallback.
    expect(overlapSpreadMetersFor(null, 600)).toBe(motionPatterns.nearbyMarker.overlapSpreadMeters);
    expect(overlapSpreadMetersFor(0.01, 0)).toBe(motionPatterns.nearbyMarker.overlapSpreadMeters);
  });

  it('spreads stacked vehicles by that distance', () => {
    const meters = overlapSpreadMetersFor(0.04, 600);
    const spread = spreadOverlaps(stacked, meters);
    const centre = { latitude: 31.52, longitude: 74.355 };
    for (const v of spread) expect(distanceMeters(centre, v)).toBeCloseTo(meters, 0);
    const viaInputs = nearbyMarkerInputs(
      ['a', 'b'].map(id => drv(id)),
      null,
      { spreadMeters: meters },
    );
    for (const v of viaInputs) expect(distanceMeters(centre, v)).toBeCloseTo(meters, 0);
  });

  it('useOverlapSpread (in the map) passes regions to the ride camera with a stable handler and spreads by the zoom', () => {
    const ride = jest.fn();
    const { result, rerender } = renderHook(() => useOverlapSpread(ride));
    const handler = result.current.onRegionChangeComplete;
    expect(result.current.spreadMeters).toBe(motionPatterns.nearbyMarker.overlapSpreadMeters);
    act(() => result.current.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 600 } } } as never));
    const region = { latitude: 31.52, longitude: 74.35, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    act(() => handler(region));
    expect(ride).toHaveBeenCalledWith(region, undefined);
    expect(result.current.spreadMeters).toBeCloseTo(overlapSpreadMetersFor(0.01, 600), 6);
    // A pan (under a 10 % zoom change) keeps the spread, so the markers do not re-render.
    act(() => handler({ ...region, latitudeDelta: 0.0105 }));
    expect(result.current.spreadMeters).toBeCloseTo(overlapSpreadMetersFor(0.01, 600), 6);
    act(() => handler({ ...region, latitudeDelta: 0.02 }));
    expect(result.current.spreadMeters).toBeCloseTo(overlapSpreadMetersFor(0.02, 600), 6);
    rerender({});
    expect(result.current.onRegionChangeComplete).toBe(handler);
  });
});
