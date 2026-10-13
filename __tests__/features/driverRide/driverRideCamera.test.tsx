/**
 * T-517 (QA t-505 s1-02/s1-04): the DriverRide camera fits the driver and the current target
 * above the docked panel, refits on a step change, and leaves a manually panned map alone until
 * the recentre button.
 */
import { act, renderHook } from '@testing-library/react-native';
import {
  MIN_DRIVER_RIDE_DELTA,
  driverRideEdgePadding,
  driverRideFitCoordinates,
  driverRideFitKey,
  useDriverRideCamera,
  type DriverRideViewport,
} from '../../../src/features/driver-ride/camera';
import type { DriverRideStep } from '../../../src/features/driver-ride/steps';

const PICKUP = { latitude: 31.51, longitude: 74.34 };
const DROPOFF = { latitude: 31.47, longitude: 74.27 };
const DRIVER = { latitude: 31.53, longitude: 74.36 };
const VIEWPORT: DriverRideViewport = { mapHeight: 800, dockHeight: 300, topInset: 59, topControls: 64 };

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

  it('pads for the docked panel at the bottom and the inset + back button on top', () => {
    const padding = driverRideEdgePadding(VIEWPORT);
    expect(padding.bottom).toBe(300 + 24);
    expect(padding.top).toBe(59 + 64 + 24);
    expect(padding.left).toBeGreaterThan(0);
    // A very tall panel is clamped so some map stays visible.
    const tall = driverRideEdgePadding({ ...VIEWPORT, dockHeight: 760 });
    expect(800 - tall.top - tall.bottom).toBeGreaterThanOrEqual(160 - 1e-9);
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

describe('useDriverRideCamera', () => {
  const setup = () => {
    const map = { fitToCoordinates: jest.fn() };
    const ref = { current: map };
    const hook = renderHook(
      (props: { step: DriverRideStep; target: typeof PICKUP; viewport: DriverRideViewport | null }) =>
        useDriverRideCamera(ref, { step: props.step, driver: DRIVER, target: props.target, viewport: props.viewport }),
      { initialProps: { step: 'to_pickup' as DriverRideStep, target: PICKUP, viewport: VIEWPORT as DriverRideViewport | null } },
    );
    return { map, ...hook };
  };

  it('fits once the map and the panel are laid out, with the panel padding', () => {
    const { map, result, rerender } = setup();
    expect(map.fitToCoordinates).not.toHaveBeenCalled();
    act(() => result.current.onMapReady());
    expect(map.fitToCoordinates).toHaveBeenCalledTimes(1);
    expect(map.fitToCoordinates.mock.calls[0][1]).toEqual({ edgePadding: driverRideEdgePadding(VIEWPORT), animated: true });

    rerender({ step: 'to_pickup', target: PICKUP, viewport: VIEWPORT });
    expect(map.fitToCoordinates).toHaveBeenCalledTimes(1);
    rerender({ step: 'on_trip', target: DROPOFF, viewport: VIEWPORT });
    expect(map.fitToCoordinates).toHaveBeenCalledTimes(2);
    expect(map.fitToCoordinates.mock.calls[1][0]).toEqual(expect.arrayContaining([DROPOFF, DRIVER]));
  });

  it('a manual pan pauses it until recentre or the next step', () => {
    const { map, result, rerender } = setup();
    act(() => result.current.onMapReady());
    act(() => result.current.onRegionChangeComplete({ ...PICKUP, latitudeDelta: 1, longitudeDelta: 1 }, { isGesture: true }));
    expect(result.current.paused).toBe(true);
    // A taller panel would normally refit; not while paused.
    rerender({ step: 'to_pickup', target: PICKUP, viewport: { ...VIEWPORT, dockHeight: 400 } });
    expect(map.fitToCoordinates).toHaveBeenCalledTimes(1);

    act(() => result.current.recentre());
    expect(result.current.paused).toBe(false);
    expect(map.fitToCoordinates).toHaveBeenCalledTimes(2);

    act(() => result.current.onRegionChangeComplete({ ...PICKUP, latitudeDelta: 1, longitudeDelta: 1 }, { isGesture: true }));
    rerender({ step: 'at_pickup', target: PICKUP, viewport: { ...VIEWPORT, dockHeight: 400 } });
    expect(result.current.paused).toBe(false);
    expect(map.fitToCoordinates).toHaveBeenCalledTimes(3);
  });

  it('our own animations (not gestures) do not pause it', () => {
    const { result } = setup();
    act(() => result.current.onMapReady());
    act(() => result.current.onRegionChangeComplete({ ...PICKUP, latitudeDelta: 1, longitudeDelta: 1 }, { isGesture: false }));
    expect(result.current.paused).toBe(false);
  });
});
