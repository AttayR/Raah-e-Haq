/**
 * T-311: while the driver is on the way the passenger map fits the driver and the pickup
 * (QA 2026-10-10-ride-e2e-b: the driver pin sat at the screen edge).
 */
import { act, renderHook } from '@testing-library/react-native';
import type { LatLng } from 'react-native-maps';
import {
  DRIVER_APPROACH_EDGE_PADDING,
  driverApproachCoordinates,
  fitKeyOf,
  useFitCoordinates,
  usePassengerRideCamera,
  type FitToCoordinatesMap,
} from '../../../src/features/active-ride/camera';
import type { PassengerRideStage } from '../../../src/features/active-ride/stage';

const pickupRide = { pickup_latitude: 31.5204, pickup_longitude: 74.3587 };
const driver = { latitude: 31.53, longitude: 74.37 };

describe('driverApproachCoordinates', () => {
  it('returns the driver and the pickup while the driver is on the way', () => {
    expect(driverApproachCoordinates('driver_en_route', driver, pickupRide)).toEqual([
      { latitude: 31.53, longitude: 74.37 },
      { latitude: 31.5204, longitude: 74.3587 },
    ]);
  });

  it('reads decimal strings as the API sends them', () => {
    const ride = { pickup_latitude: '31.52040000', pickup_longitude: '74.35870000' } as unknown as typeof pickupRide;
    expect(driverApproachCoordinates('driver_en_route', driver, ride)?.[1]).toEqual({ latitude: 31.5204, longitude: 74.3587 });
  });

  it.each<PassengerRideStage>(['searching', 'driver_arrived', 'in_trip', 'completed', 'cancelled'])(
    'leaves the camera alone in stage %s',
    (stage) => {
      expect(driverApproachCoordinates(stage, driver, pickupRide)).toBeNull();
    },
  );

  it('needs both a driver position and a valid pickup', () => {
    expect(driverApproachCoordinates('driver_en_route', null, pickupRide)).toBeNull();
    expect(driverApproachCoordinates('driver_en_route', driver, null)).toBeNull();
    expect(driverApproachCoordinates('driver_en_route', driver, { pickup_latitude: Number.NaN, pickup_longitude: 74.3 })).toBeNull();
    expect(driverApproachCoordinates(null, driver, pickupRide)).toBeNull();
  });
});

describe('useFitCoordinates', () => {
  const setup = (initial: LatLng[] | null) => {
    const fit = jest.fn();
    const map: FitToCoordinatesMap = { fitToCoordinates: fit };
    const mapRef = { current: map };
    const hook = renderHook(({ coords }: { coords: LatLng[] | null }) => useFitCoordinates(mapRef, coords), {
      initialProps: { coords: initial },
    });
    return { ...hook, fit };
  };

  it('fits the map to the points with room for the panel', () => {
    const points = driverApproachCoordinates('driver_en_route', driver, pickupRide);
    const { fit } = setup(points);
    expect(fit).toHaveBeenCalledTimes(1);
    expect(fit).toHaveBeenCalledWith(points, { edgePadding: DRIVER_APPROACH_EDGE_PADDING, animated: true });
  });

  it('refits when the driver moves, not on a re-render with the same points', () => {
    const { fit, rerender } = setup(driverApproachCoordinates('driver_en_route', driver, pickupRide));
    rerender({ coords: driverApproachCoordinates('driver_en_route', { ...driver }, pickupRide) });
    expect(fit).toHaveBeenCalledTimes(1);
    rerender({ coords: driverApproachCoordinates('driver_en_route', { latitude: 31.525, longitude: 74.365 }, pickupRide) });
    expect(fit).toHaveBeenCalledTimes(2);
  });

  it('does nothing without points (other stages)', () => {
    const { fit, rerender } = setup(null);
    rerender({ coords: null });
    expect(fit).not.toHaveBeenCalled();
  });
});

describe('T-312: refit key, map ready, passenger gestures', () => {
  it('the refit key ignores moves under ~10 m (4 decimals)', () => {
    const a = [{ latitude: 31.52041, longitude: 74.35871 }];
    const jitter = [{ latitude: 31.52044, longitude: 74.35873 }]; // ~3 m
    const moved = [{ latitude: 31.5206, longitude: 74.3587 }]; // ~20 m
    expect(fitKeyOf(jitter)).toBe(fitKeyOf(a));
    expect(fitKeyOf(moved)).not.toBe(fitKeyOf(a));
  });

  it('useFitCoordinates waits for the map to be ready, then fits the same points once', () => {
    const fit = jest.fn();
    const mapRef = { current: { fitToCoordinates: fit } };
    const points = driverApproachCoordinates('driver_en_route', driver, pickupRide);
    const { rerender } = renderHook(({ ready }: { ready: boolean }) => useFitCoordinates(mapRef, points, { ready }), {
      initialProps: { ready: false },
    });
    expect(fit).not.toHaveBeenCalled();
    rerender({ ready: true });
    expect(fit).toHaveBeenCalledTimes(1);
    rerender({ ready: true });
    expect(fit).toHaveBeenCalledTimes(1);
  });

  type CameraProps = { stage: PassengerRideStage; location: { latitude: number; longitude: number } };

  const setupCamera = (initial: CameraProps) => {
    const fit = jest.fn();
    const mapRef = { current: { fitToCoordinates: fit } };
    const hook = renderHook(
      ({ stage, location }: CameraProps) => usePassengerRideCamera(mapRef, stage, location, pickupRide),
      { initialProps: initial },
    );
    return { ...hook, fit };
  };

  it('a screen mounted mid-ride fits once the map becomes ready', () => {
    const { result, fit } = setupCamera({ stage: 'driver_en_route', location: driver });
    expect(fit).not.toHaveBeenCalled();
    act(() => result.current.onMapReady());
    expect(fit).toHaveBeenCalledTimes(1);
    expect(result.current.isFollowing()).toBe(true);
  });

  it('pauses after the passenger pans or zooms, and resumes on the next stage', () => {
    const { result, fit, rerender } = setupCamera({ stage: 'driver_en_route', location: driver });
    act(() => result.current.onMapReady());
    expect(fit).toHaveBeenCalledTimes(1);

    // Our own fit animation is not a gesture: still following.
    act(() => result.current.onRegionChangeComplete({} as never, { isGesture: false }));
    rerender({ stage: 'driver_en_route', location: { latitude: 31.525, longitude: 74.365 } });
    expect(fit).toHaveBeenCalledTimes(2);

    act(() => result.current.onRegionChangeComplete({} as never, { isGesture: true }));
    expect(result.current.isFollowing()).toBe(false);
    rerender({ stage: 'driver_en_route', location: { latitude: 31.522, longitude: 74.362 } });
    expect(fit).toHaveBeenCalledTimes(2);

    // Driver arrived: a new stage clears the pause (nothing to fit in this stage).
    rerender({ stage: 'driver_arrived', location: { latitude: 31.522, longitude: 74.362 } });
    expect(fit).toHaveBeenCalledTimes(2);
    // Back to en route (e.g. a re-read of the ride): following again.
    rerender({ stage: 'driver_en_route', location: { latitude: 31.522, longitude: 74.362 } });
    expect(result.current.isFollowing()).toBe(true);
    expect(fit).toHaveBeenCalledTimes(3);
  });
});

