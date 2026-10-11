/**
 * T-311: while the driver is on the way the passenger map fits the driver and the pickup
 * (QA 2026-10-10-ride-e2e-b: the driver pin sat at the screen edge).
 */
import { act, renderHook } from '@testing-library/react-native';
import type { LatLng } from 'react-native-maps';
import {
  BOOKING_REGION_DELTA,
  DRIVER_APPROACH_EDGE_PADDING,
  driverApproachCoordinates,
  fitKeyOf,
  clampViewportInsets,
  MIN_VISIBLE_MAP,
  regionInViewport,
  viewportEdgePadding,
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

  type CameraProps = {
    stage: PassengerRideStage | null;
    location: { latitude: number; longitude: number };
    home?: LatLng | null;
  };

  const setupCamera = (initial: CameraProps) => {
    const fit = jest.fn();
    const animate = jest.fn();
    const mapRef = { current: { fitToCoordinates: fit, animateToRegion: animate } };
    const hook = renderHook(
      ({ stage, location, home }: CameraProps) => usePassengerRideCamera(mapRef, stage, location, pickupRide, home),
      { initialProps: initial },
    );
    return { ...hook, fit, animate };
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

describe('T-313: the ride is cleared', () => {
  type Props = { stage: PassengerRideStage | null; home: LatLng | null };
  const home = { latitude: 31.51, longitude: 74.34 };

  const setup = (initial: Props) => {
    const fit = jest.fn();
    const animate = jest.fn();
    const mapRef = { current: { fitToCoordinates: fit, animateToRegion: animate } };
    const hook = renderHook(
      ({ stage, home: point }: Props) => usePassengerRideCamera(mapRef, stage, driver, pickupRide, point),
      { initialProps: initial },
    );
    return { ...hook, fit, animate };
  };

  it('after a hand-panned ride, Done drops the pause and recentres on the booking point', () => {
    const { result, rerender, animate } = setup({ stage: 'driver_en_route', home: null });
    act(() => result.current.onMapReady());
    act(() => result.current.onRegionChangeComplete({} as never, { isGesture: true }));
    expect(result.current.isFollowing()).toBe(false);

    rerender({ stage: 'completed', home: null });
    expect(animate).not.toHaveBeenCalled();

    // Done: the ride is cleared and the screen passes the passenger's position.
    rerender({ stage: null, home });
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledWith({
      latitude: 31.51,
      longitude: 74.34,
      latitudeDelta: BOOKING_REGION_DELTA,
      longitudeDelta: BOOKING_REGION_DELTA,
    });

    // The next ride follows the driver again (no pause carried over), and re-renders on the
    // booking map do not recentre again.
    rerender({ stage: null, home: { latitude: 31.6, longitude: 74.4 } });
    expect(animate).toHaveBeenCalledTimes(1);
    rerender({ stage: 'driver_en_route', home: null });
    expect(result.current.isFollowing()).toBe(true);
  });

  it('does not recentre on first mount without a ride, before the map is ready, or without a point', () => {
    const first = setup({ stage: null, home });
    act(() => first.result.current.onMapReady());
    expect(first.animate).not.toHaveBeenCalled();

    const notReady = setup({ stage: 'cancelled', home });
    notReady.rerender({ stage: null, home });
    expect(notReady.animate).not.toHaveBeenCalled();

    const noPoint = setup({ stage: 'cancelled', home: null });
    act(() => noPoint.result.current.onMapReady());
    noPoint.rerender({ stage: null, home: null });
    expect(noPoint.animate).not.toHaveBeenCalled();
  });
});

describe('T-314: recentre and fit above the bottom sheet', () => {
  const point = { latitude: 31.5204, longitude: 74.3587 };

  it('without a viewport the region is centred on the point', () => {
    expect(regionInViewport(point, null)).toEqual({ ...point, latitudeDelta: BOOKING_REGION_DELTA, longitudeDelta: BOOKING_REGION_DELTA });
    expect(regionInViewport(point, { mapHeight: 0, bottom: 300 })).toEqual(regionInViewport(point));
  });

  it('moves the centre south so the point sits in the middle of the visible part', () => {
    // 667 pt map, 333 pt sheet, 100 pt of controls: visible band 100..334, middle 217.
    const r = regionInViewport(point, { mapHeight: 667, bottom: 333, top: 100 });
    const degPerPt = r.latitudeDelta / 667;
    // The point is (333 - 100) / 2 pt above the map centre.
    expect(r.latitude).toBeCloseTo(point.latitude - 116.5 * degPerPt, 10);
    expect(r.latitude).toBeLessThan(point.latitude);
    expect(r.longitude).toBe(point.longitude);
    // The visible band still spans the booking zoom.
    expect(r.latitudeDelta).toBeCloseTo(BOOKING_REGION_DELTA * (667 / 234), 10);
  });

  it('caps the zoom-out when the sheet covers almost everything', () => {
    const r = regionInViewport(point, { mapHeight: 667, bottom: 640 });
    expect(r.latitudeDelta).toBeCloseTo(BOOKING_REGION_DELTA * 3, 10);
  });

  it('keeps at least 160 pt of map between the insets (tall sheet)', () => {
    // 667 map, 600 sheet, 100 controls: scaled so top + bottom = 507.
    const pad = viewportEdgePadding({ mapHeight: 667, bottom: 600, top: 100 });
    expect(pad.top + pad.bottom).toBeCloseTo(667 - MIN_VISIBLE_MAP, 6);
    expect(pad.bottom).toBeGreaterThan(pad.top);
    expect(clampViewportInsets({ mapHeight: 667, bottom: 300, top: 100 })).toEqual({ top: 100, bottom: 300 });
    const r = regionInViewport(point, { mapHeight: 667, bottom: 700, top: 100 });
    expect(r.latitude).toBeLessThan(point.latitude);
    expect(r.latitudeDelta).toBeCloseTo(BOOKING_REGION_DELTA * 3, 10);
  });

  it('fit padding = sheet height + 24 at the bottom, controls + 24 at the top', () => {
    expect(viewportEdgePadding({ mapHeight: 667, bottom: 320, top: 76 })).toEqual({ top: 100, right: 48, bottom: 344, left: 48 });
    expect(viewportEdgePadding(null)).toEqual(DRIVER_APPROACH_EDGE_PADDING);
  });

  it('Done recentres with the sheet height taken into account', () => {
    const animate = jest.fn();
    const mapRef = { current: { fitToCoordinates: jest.fn(), animateToRegion: animate } };
    const viewport = { mapHeight: 667, bottom: 300, top: 100 };
    type P = { stage: PassengerRideStage | null };
    const { result, rerender } = renderHook(
      ({ stage }: P) => usePassengerRideCamera(mapRef, stage, null, pickupRide, point, viewport),
      { initialProps: { stage: 'completed' } as P },
    );
    act(() => result.current.onMapReady());
    rerender({ stage: null });
    expect(animate).toHaveBeenCalledWith(regionInViewport(point, viewport));
  });

  it('the driver-approach fit uses the sheet padding when a viewport is given', () => {
    const fit = jest.fn();
    const mapRef = { current: { fitToCoordinates: fit, animateToRegion: jest.fn() } };
    const viewport = { mapHeight: 667, bottom: 280, top: 76 };
    const { result } = renderHook(() => usePassengerRideCamera(mapRef, 'driver_en_route', driver, pickupRide, null, viewport));
    act(() => result.current.onMapReady());
    expect(fit).toHaveBeenLastCalledWith(expect.any(Array), { edgePadding: viewportEdgePadding(viewport), animated: true });
  });
});
