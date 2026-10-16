/**
 * T-517 (QA t-505 s1-02/s1-04): the DriverRide camera fits the driver and the current target
 * above the docked panel, refits on a step change, and leaves a manually panned map alone until
 * the recentre button.
 *
 * T-524 (QA t-517 b3): the region is computed here (not fitToCoordinates + edge padding, which
 * the Google iOS provider did not honour with a tall panel): both points land in the visible
 * strip between the back button and the panel, for a pickup 700 m away and one 5 km away.
 */
import { act, renderHook } from '@testing-library/react-native';
import type { LatLng, Region } from 'react-native-maps';
import {
  DRIVER_RIDE_FIT_MS,
  FIT_MARGIN_BOTTOM,
  FIT_MARGIN_SIDE,
  MIN_DRIVER_RIDE_DELTA,
  driverRideFitCoordinates,
  driverRideFitKey,
  driverRideRegion,
  driverRideVisibleStrip,
  useDriverRideCamera,
  type DriverRideViewport,
} from '../../../src/features/driver-ride/camera';
import type { DriverRideStep } from '../../../src/features/driver-ride/steps';

const PICKUP = { latitude: 31.51, longitude: 74.34 };
const DROPOFF = { latitude: 31.47, longitude: 74.27 };
const DRIVER = { latitude: 31.53, longitude: 74.36 };
const VIEWPORT: DriverRideViewport = { mapHeight: 800, mapWidth: 390, dockHeight: 300, topInset: 59, topControls: 64 };

/** iPhone 17 (402 × 874 pt) with the docked panel at 65% of the map, as in QA b3. */
const TALL_PANEL: DriverRideViewport = {
  mapHeight: 874,
  mapWidth: 402,
  dockHeight: Math.round(874 * 0.65),
  topInset: 62,
  topControls: 64,
};

const M_PER_DEG_LAT = 111_195;
/** A point `north` / `east` metres from `origin`. */
const offset = (origin: LatLng, north: number, east: number): LatLng => ({
  latitude: origin.latitude + north / M_PER_DEG_LAT,
  longitude: origin.longitude + east / (M_PER_DEG_LAT * Math.cos((origin.latitude * Math.PI) / 180)),
});

/** Where `p` lands on screen (points from the map's top-left) when the map shows `region`. */
const toScreen = (p: LatLng, region: Region, viewport: DriverRideViewport) => ({
  x: viewport.mapWidth! / 2 + ((p.longitude - region.longitude) / region.longitudeDelta) * viewport.mapWidth!,
  y: viewport.mapHeight / 2 - ((p.latitude - region.latitude) / region.latitudeDelta) * viewport.mapHeight,
});

const expectInVisibleStrip = (points: LatLng[], viewport: DriverRideViewport) => {
  const region = driverRideRegion(driverRideFitCoordinates(points[0], points[1]), viewport)!;
  expect(region).not.toBeNull();
  const covered = { top: viewport.topInset + viewport.topControls, bottom: viewport.mapHeight - viewport.dockHeight };
  points.forEach((p) => {
    const { x, y } = toScreen(p, region, viewport);
    expect(y).toBeGreaterThan(covered.top);
    expect(y).toBeLessThan(covered.bottom);
    expect(x).toBeGreaterThanOrEqual(FIT_MARGIN_SIDE - 1e-6);
    expect(x).toBeLessThanOrEqual(viewport.mapWidth! - FIT_MARGIN_SIDE + 1e-6);
  });
  return region;
};

describe('driver ride fit', () => {
  it('fits the driver and the target (and route points); nothing without a target', () => {
    expect(driverRideFitCoordinates(DRIVER, PICKUP)).toEqual(expect.arrayContaining([PICKUP, DRIVER]));
    expect(driverRideFitCoordinates(DRIVER, DROPOFF, [PICKUP])).toEqual(expect.arrayContaining([DROPOFF, DRIVER, PICKUP]));
    expect(driverRideFitCoordinates(DRIVER, null)).toBeNull();
    expect(driverRideFitCoordinates(null, PICKUP)).toContainEqual(PICKUP);
  });

  it('never zooms in past ~600 m when the driver is at the target', () => {
    const points = driverRideFitCoordinates(PICKUP, PICKUP)!;
    const lats = points.map(p => p.latitude);
    expect(Math.max(...lats) - Math.min(...lats)).toBeGreaterThanOrEqual(MIN_DRIVER_RIDE_DELTA - 1e-9);
  });

  it('the refit key changes with the step and the target, and with ~100 m of driving, not with jitter', () => {
    const base = driverRideFitKey('to_pickup', DRIVER, PICKUP);
    expect(driverRideFitKey('on_trip', DRIVER, PICKUP)).not.toBe(base);
    expect(driverRideFitKey('to_pickup', DRIVER, DROPOFF)).not.toBe(base);
    expect(driverRideFitKey('to_pickup', { latitude: DRIVER.latitude + 0.00002, longitude: DRIVER.longitude }, PICKUP)).toBe(base);
    expect(driverRideFitKey('to_pickup', { latitude: DRIVER.latitude + 0.002, longitude: DRIVER.longitude }, PICKUP)).not.toBe(base);
    expect(driverRideFitKey('summary', DRIVER, null)).toBeNull();
  });
});

describe('driverRideVisibleStrip', () => {
  it('is the map between the back button and the panel, less the margins', () => {
    const strip = driverRideVisibleStrip(VIEWPORT);
    expect(strip.top).toBeGreaterThan(59 + 64);
    expect(strip.bottom).toBeLessThan(800 - 300);
    expect(strip.bottom - strip.top).toBeGreaterThan(200);
  });

  it('T-553: keeps a marker\'s size above the panel, so the car is not half under its edge', () => {
    const strip = driverRideVisibleStrip(VIEWPORT);
    expect(FIT_MARGIN_BOTTOM).toBeGreaterThanOrEqual(40);
    expect(strip.bottom).toBe(800 - 300 - FIT_MARGIN_BOTTOM);
  });

  it('with a panel taller than the map leaves a small strip instead of none', () => {
    const strip = driverRideVisibleStrip({ ...VIEWPORT, dockHeight: 760 });
    expect(strip.bottom - strip.top).toBeGreaterThan(0);
    expect(strip.top).toBeGreaterThanOrEqual(0);
    expect(strip.bottom).toBeLessThanOrEqual(800);
  });
});

describe('driverRideRegion', () => {
  it('a pickup ~700 m away with the panel at 65%: both points sit above the panel (QA b3)', () => {
    const driver = offset(PICKUP, 520, 470); // ~700 m north-east
    const region = expectInVisibleStrip([driver, PICKUP], TALL_PANEL);
    // The centre is south of both points: the visible strip is in the top third of the map.
    expect(region.latitude).toBeLessThan(Math.min(driver.latitude, PICKUP.latitude));
  });

  it('a pickup ~700 m due south (the pickup is the lowest point) still clears the panel', () => {
    expectInVisibleStrip([offset(PICKUP, 700, 0), PICKUP], TALL_PANEL);
    expectInVisibleStrip([offset(PICKUP, 0, 700), PICKUP], TALL_PANEL);
  });

  it('a pickup ~5 km away with a normal panel fits both points', () => {
    expectInVisibleStrip([offset(PICKUP, -3500, 3500), PICKUP], VIEWPORT);
    expectInVisibleStrip([offset(PICKUP, -3500, 3500), PICKUP], TALL_PANEL);
  });

  it('keeps the map aspect, so the native fit shows exactly this region', () => {
    const region = driverRideRegion(driverRideFitCoordinates(DRIVER, PICKUP), TALL_PANEL)!;
    const cos = Math.cos((region.latitude * Math.PI) / 180);
    const latPerPoint = region.latitudeDelta / TALL_PANEL.mapHeight;
    const lngPerPoint = region.longitudeDelta / TALL_PANEL.mapWidth!;
    expect(latPerPoint / lngPerPoint).toBeCloseTo(cos, 2);
  });

  it('nothing without points or a laid-out map', () => {
    expect(driverRideRegion(null, VIEWPORT)).toBeNull();
    expect(driverRideRegion([PICKUP], null)).toBeNull();
    expect(driverRideRegion([PICKUP], { ...VIEWPORT, mapHeight: 0 })).toBeNull();
  });
});

describe('useDriverRideCamera', () => {
  const setup = () => {
    const map = { animateToRegion: jest.fn() };
    const ref = { current: map };
    const hook = renderHook(
      (props: { step: DriverRideStep; target: typeof PICKUP; viewport: DriverRideViewport | null }) =>
        useDriverRideCamera(ref, { step: props.step, driver: DRIVER, target: props.target, viewport: props.viewport }),
      { initialProps: { step: 'to_pickup' as DriverRideStep, target: PICKUP, viewport: VIEWPORT as DriverRideViewport | null } },
    );
    return { map, ...hook };
  };

  it('moves to the computed region once the map and the panel are laid out', () => {
    const { map, result, rerender } = setup();
    expect(map.animateToRegion).not.toHaveBeenCalled();
    act(() => result.current.onMapReady());
    expect(map.animateToRegion).toHaveBeenCalledTimes(1);
    expect(map.animateToRegion.mock.calls[0]).toEqual([
      driverRideRegion(driverRideFitCoordinates(DRIVER, PICKUP), VIEWPORT),
      DRIVER_RIDE_FIT_MS,
    ]);

    rerender({ step: 'to_pickup', target: PICKUP, viewport: VIEWPORT });
    expect(map.animateToRegion).toHaveBeenCalledTimes(1);
    rerender({ step: 'on_trip', target: DROPOFF, viewport: VIEWPORT });
    expect(map.animateToRegion).toHaveBeenCalledTimes(2);
    expect(map.animateToRegion.mock.calls[1][0]).toEqual(driverRideRegion(driverRideFitCoordinates(DRIVER, DROPOFF), VIEWPORT));
  });

  it('a manual pan pauses it until recentre or the next step', () => {
    const { map, result, rerender } = setup();
    act(() => result.current.onMapReady());
    act(() => result.current.onRegionChangeComplete({ ...PICKUP, latitudeDelta: 1, longitudeDelta: 1 }, { isGesture: true }));
    expect(result.current.paused).toBe(true);
    // A taller panel would normally refit; not while paused.
    rerender({ step: 'to_pickup', target: PICKUP, viewport: { ...VIEWPORT, dockHeight: 400 } });
    expect(map.animateToRegion).toHaveBeenCalledTimes(1);

    act(() => result.current.recentre());
    expect(result.current.paused).toBe(false);
    expect(map.animateToRegion).toHaveBeenCalledTimes(2);
    // The recentre uses the same strip-aware region as the fit.
    expect(map.animateToRegion.mock.calls[1][0]).toEqual(
      driverRideRegion(driverRideFitCoordinates(DRIVER, PICKUP), { ...VIEWPORT, dockHeight: 400 }),
    );

    act(() => result.current.onRegionChangeComplete({ ...PICKUP, latitudeDelta: 1, longitudeDelta: 1 }, { isGesture: true }));
    rerender({ step: 'at_pickup', target: PICKUP, viewport: { ...VIEWPORT, dockHeight: 400 } });
    expect(result.current.paused).toBe(false);
    expect(map.animateToRegion).toHaveBeenCalledTimes(3);
  });

  it('our own animations (not gestures) do not pause it', () => {
    const { result } = setup();
    act(() => result.current.onMapReady());
    act(() => result.current.onRegionChangeComplete({ ...PICKUP, latitudeDelta: 1, longitudeDelta: 1 }, { isGesture: false }));
    expect(result.current.paused).toBe(false);
  });
});

describe('T-556: the stops still to visit stay in the fit (QA 2026-10-16 #37/#38)', () => {
  // Stop 2 north of the driver (it sat under the status bar), stop 3 south (under the panel).
  const STOP_NORTH = offset(DRIVER, 1500, -300);
  const STOP_SOUTH = offset(PICKUP, -900, 400);

  it('every stop lands in the strip between the top controls and the panel', () => {
    const region = driverRideRegion(driverRideFitCoordinates(DRIVER, PICKUP, [STOP_NORTH, STOP_SOUTH]), TALL_PANEL)!;
    const covered = { top: TALL_PANEL.topInset + TALL_PANEL.topControls, bottom: TALL_PANEL.mapHeight - TALL_PANEL.dockHeight };
    [DRIVER, PICKUP, STOP_NORTH, STOP_SOUTH].forEach((p) => {
      const { y } = toScreen(p, region, TALL_PANEL);
      expect(y).toBeGreaterThan(covered.top);
      expect(y).toBeLessThan(covered.bottom);
    });
    // Before T-556 the screen fitted the target alone, and the north stop was off the strip.
    const targetOnly = driverRideRegion(driverRideFitCoordinates(DRIVER, PICKUP), TALL_PANEL)!;
    expect(toScreen(STOP_NORTH, targetOnly, TALL_PANEL).y).toBeLessThan(covered.top);
  });

  it('the hook fits the stops, and refits when a stop is done', () => {
    const map = { animateToRegion: jest.fn() };
    const ref = { current: map };
    const { result, rerender } = renderHook(
      (props: { route: LatLng[] }) =>
        useDriverRideCamera(ref, { step: 'on_trip', driver: DRIVER, target: STOP_NORTH, route: props.route, viewport: VIEWPORT }),
      { initialProps: { route: [STOP_NORTH, STOP_SOUTH] } },
    );
    act(() => result.current.onMapReady());
    expect(map.animateToRegion).toHaveBeenLastCalledWith(
      driverRideRegion(driverRideFitCoordinates(DRIVER, STOP_NORTH, [STOP_NORTH, STOP_SOUTH]), VIEWPORT),
      DRIVER_RIDE_FIT_MS,
    );
    rerender({ route: [STOP_NORTH, STOP_SOUTH] });
    expect(map.animateToRegion).toHaveBeenCalledTimes(1);
    rerender({ route: [STOP_NORTH] });
    expect(map.animateToRegion).toHaveBeenCalledTimes(2);
    expect(driverRideFitKey('on_trip', DRIVER, STOP_NORTH, [STOP_NORTH])).not.toBe(
      driverRideFitKey('on_trip', DRIVER, STOP_NORTH, [STOP_NORTH, STOP_SOUTH]),
    );
  });
});
