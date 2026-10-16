/**
 * T-549 (QA t-545 B08): during the trip the passenger map showed no drop-off and no route, and
 * the camera did not follow the car, so it could drive off screen.
 */
import { act, renderHook } from '@testing-library/react-native';
import type { LatLng } from 'react-native-maps';
import {
  TRIP_FOLLOW_INTERVAL_MS,
  rideFollowCoordinates,
  usePassengerRideCamera,
  viewportEdgePadding,
  withMinimumSpan,
} from '../../../src/features/active-ride/camera';
import type { PassengerRideStage } from '../../../src/features/active-ride/stage';
import {
  MIN_ROUTE_REFETCH_MS,
  OFF_ROUTE_METERS,
  ROUTE_REFRESH_MS,
  nearestOnRoute,
  nextTripRouteRequest,
  remainingRoute,
  useTripRoute,
} from '../../../src/features/active-ride/tripRoute';

const mockFetchRoute = jest.fn();
const mockClearRoute = jest.fn();
let mockRoute: LatLng[] = [];
jest.mock('../../../src/hooks/useDirections', () => ({
  useDirections: () => ({ routeCoordinates: mockRoute, fetchRouteWithWaypoints: mockFetchRoute, clearRoute: mockClearRoute }),
}));

const ride = {
  id: 207,
  pickup_latitude: 31.52,
  pickup_longitude: 74.35,
  dropoff_latitude: 31.48,
  dropoff_longitude: 74.3,
};
const PICKUP = { latitude: 31.52, longitude: 74.35 };
const DROPOFF = { latitude: 31.48, longitude: 74.3 };
// A straight route pickup → drop-off, with a middle point.
const ROUTE = [PICKUP, { latitude: 31.5, longitude: 74.325 }, DROPOFF];
const car = (latitude: number, longitude: number) => ({ latitude, longitude });

describe('rideFollowCoordinates', () => {
  it('follows the car and the drop-off on the trip (strings as the API sends them)', () => {
    const apiRide = { ...ride, dropoff_latitude: '31.48000000', dropoff_longitude: '74.30000000' } as unknown as typeof ride;
    expect(rideFollowCoordinates('in_trip', car(31.51, 74.34), apiRide)).toEqual([car(31.51, 74.34), DROPOFF]);
  });

  it('keeps the driver + pickup fit on the way, and nothing in other stages', () => {
    expect(rideFollowCoordinates('driver_en_route', car(31.53, 74.37), ride)).toEqual([car(31.53, 74.37), PICKUP]);
    expect(rideFollowCoordinates('driver_arrived', car(31.53, 74.37), ride)).toBeNull();
    expect(rideFollowCoordinates('in_trip', null, ride)).toBeNull();
    expect(rideFollowCoordinates('in_trip', car(31.5, 74.3), { pickup_latitude: 1, pickup_longitude: 2 })).toBeNull();
  });
});

describe('T-549: the ride camera on the trip', () => {
  type P = { stage: PassengerRideStage | null; location: LatLng };
  const viewport = { mapHeight: 667, bottom: 333, top: 100 };

  const setup = (initial: P) => {
    const fit = jest.fn();
    const mapRef = { current: { fitToCoordinates: fit, animateToRegion: jest.fn() } };
    const hook = renderHook(
      ({ stage, location }: P) => usePassengerRideCamera(mapRef, stage, location, ride, null, viewport),
      { initialProps: initial },
    );
    act(() => hook.result.current.onMapReady());
    return { ...hook, fit };
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('fits the car and the drop-off above the sheet, at most once per interval, with the latest car', () => {
    const { fit, rerender } = setup({ stage: 'in_trip', location: car(31.51, 74.34) });
    expect(fit).toHaveBeenCalledTimes(1);
    expect(fit).toHaveBeenLastCalledWith(withMinimumSpan([car(31.51, 74.34), DROPOFF]), {
      edgePadding: viewportEdgePadding(viewport),
      animated: true,
    });

    // Two reads inside the interval: no fit yet, then one fit with the newer position.
    rerender({ stage: 'in_trip', location: car(31.505, 74.335) });
    rerender({ stage: 'in_trip', location: car(31.5, 74.33) });
    expect(fit).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(TRIP_FOLLOW_INTERVAL_MS));
    expect(fit).toHaveBeenCalledTimes(2);
    expect(fit.mock.calls[1][0][0]).toEqual(car(31.5, 74.33));

    // A read after the interval fits at once.
    act(() => jest.advanceTimersByTime(TRIP_FOLLOW_INTERVAL_MS));
    rerender({ stage: 'in_trip', location: car(31.495, 74.32) });
    expect(fit).toHaveBeenCalledTimes(3);
  });

  it('a pan pauses following (recentre button shown), and recentre fits at once and follows again', () => {
    const { result, fit, rerender } = setup({ stage: 'in_trip', location: car(31.51, 74.34) });
    expect(result.current.paused).toBe(false);

    act(() => result.current.onRegionChangeComplete({} as never, { isGesture: true }));
    expect(result.current.paused).toBe(true);
    expect(result.current.isFollowing()).toBe(false);
    // The passenger's own moving position must not take the map back either.
    expect(result.current.holdsCamera()).toBe(true);
    rerender({ stage: 'in_trip', location: car(31.5, 74.33) });
    act(() => jest.advanceTimersByTime(TRIP_FOLLOW_INTERVAL_MS * 2));
    expect(fit).toHaveBeenCalledTimes(1);

    act(() => result.current.recentre());
    expect(result.current.paused).toBe(false);
    expect(result.current.isFollowing()).toBe(true);
    expect(fit).toHaveBeenCalledTimes(2);
    expect(fit.mock.calls[1][0][0]).toEqual(car(31.5, 74.33));

    // Recentre right after a fit is not held back by the interval.
    act(() => result.current.recentre());
    expect(fit).toHaveBeenCalledTimes(3);
  });

  it('the trip starting fits the car and the drop-off at once (not after the interval)', () => {
    const { fit, rerender } = setup({ stage: 'driver_en_route', location: car(31.51, 74.34) });
    expect(fit).toHaveBeenCalledTimes(1);
    rerender({ stage: 'in_trip', location: car(31.51, 74.34) });
    expect(fit).toHaveBeenCalledTimes(2);
    expect(fit.mock.calls[1][0]).toEqual(withMinimumSpan([car(31.51, 74.34), DROPOFF]));
    // Then the trip interval applies.
    rerender({ stage: 'in_trip', location: car(31.5, 74.33) });
    expect(fit).toHaveBeenCalledTimes(2);
  });

  it('no recentre button and no hold outside the followed stages', () => {
    const { result } = setup({ stage: 'driver_arrived', location: car(31.51, 74.34) });
    act(() => result.current.onRegionChangeComplete({} as never, { isGesture: true }));
    expect(result.current.paused).toBe(false);
    expect(result.current.holdsCamera()).toBe(false);
  });
});

describe('trip route geometry', () => {
  it('finds the closest point on the route and its distance', () => {
    const on = nearestOnRoute(ROUTE, car(31.51, 74.3375));
    expect(on?.index).toBe(0);
    expect(on?.distance).toBeLessThan(1);
    const off = nearestOnRoute(ROUTE, car(31.51, 74.35));
    expect(off?.distance).toBeGreaterThan(OFF_ROUTE_METERS);
    expect(nearestOnRoute([PICKUP], PICKUP)).toBeNull();
  });

  it('the remaining route starts at the car and keeps the rest to the drop-off', () => {
    const rest = remainingRoute(ROUTE, car(31.49, 74.3125));
    expect(rest[0].latitude).toBeCloseTo(31.49, 6);
    expect(rest[0].longitude).toBeCloseTo(74.3125, 6);
    expect(rest.slice(1)).toEqual([DROPOFF]);
    expect(remainingRoute(ROUTE, null)).toEqual(ROUTE);
  });
});

describe('nextTripRouteRequest (no request bursts)', () => {
  const base = {
    now: 1_000_000,
    route: ROUTE,
    driver: car(31.51, 74.3375),
    pickup: PICKUP,
    dropoff: DROPOFF,
    stops: [] as LatLng[],
    stopsKey: '',
    requestedStopsKey: '',
  };

  it('first asks for the booking route (pickup → drop-off, the cached one), else from the car', () => {
    expect(nextTripRouteRequest({ ...base, lastRequestAt: null, route: [] })).toEqual({ from: PICKUP, waypoints: [], to: DROPOFF });
    expect(nextTripRouteRequest({ ...base, lastRequestAt: null, route: [], pickup: null })).toEqual({ from: base.driver, waypoints: [], to: DROPOFF });
    expect(nextTripRouteRequest({ ...base, lastRequestAt: null, dropoff: null })).toBeNull();
  });

  it('stays quiet while the car is on the route', () => {
    expect(nextTripRouteRequest({ ...base, lastRequestAt: base.now - MIN_ROUTE_REFETCH_MS * 2 })).toBeNull();
  });

  it('asks again from the car when it is off the route, but never within a minute', () => {
    const off = car(31.51, 74.35);
    expect(nextTripRouteRequest({ ...base, driver: off, lastRequestAt: base.now - MIN_ROUTE_REFETCH_MS + 1 })).toBeNull();
    expect(nextTripRouteRequest({ ...base, driver: off, lastRequestAt: base.now - MIN_ROUTE_REFETCH_MS })).toEqual({ from: off, waypoints: [], to: DROPOFF });
    // A failed answer (no route) is retried on the same minute rule.
    expect(nextTripRouteRequest({ ...base, route: [], lastRequestAt: base.now - MIN_ROUTE_REFETCH_MS })).toEqual({ from: base.driver, waypoints: [], to: DROPOFF });
  });

  it('a completed stop asks again (car → the stops left → drop-off), on the same minute rule', () => {
    const stop = car(31.5, 74.325);
    const withStop = { ...base, stops: [stop], stopsKey: '11', requestedStopsKey: '11' };
    expect(nextTripRouteRequest({ ...withStop, lastRequestAt: null })).toEqual({ from: PICKUP, waypoints: [stop], to: DROPOFF });
    expect(nextTripRouteRequest({ ...withStop, lastRequestAt: base.now - MIN_ROUTE_REFETCH_MS })).toBeNull();
    const done = { ...base, stopsKey: '', requestedStopsKey: '11' };
    expect(nextTripRouteRequest({ ...done, lastRequestAt: base.now - 1000 })).toBeNull();
    expect(nextTripRouteRequest({ ...done, lastRequestAt: base.now - MIN_ROUTE_REFETCH_MS })).toEqual({
      from: base.driver,
      waypoints: [],
      to: DROPOFF,
    });
  });

  it('refreshes from the car every few minutes', () => {
    expect(nextTripRouteRequest({ ...base, lastRequestAt: base.now - ROUTE_REFRESH_MS })).toEqual({ from: base.driver, waypoints: [], to: DROPOFF });
  });
});

describe('useTripRoute', () => {
  type P = { active: boolean; location: LatLng | null };

  beforeEach(() => {
    mockFetchRoute.mockClear();
    mockClearRoute.mockClear();
    mockRoute = [];
  });

  it('asks once for the booking route, shows the part ahead of the car, and does not re-ask on each read', () => {
    const { result, rerender } = renderHook(({ active, location }: P) => useTripRoute(active, ride, location), {
      initialProps: { active: false, location: null } as P,
    });
    expect(mockFetchRoute).not.toHaveBeenCalled();
    expect(result.current.dropoff).toBeNull();
    expect(mockClearRoute).not.toHaveBeenCalled();

    rerender({ active: true, location: car(31.51, 74.3375) });
    expect(mockFetchRoute).toHaveBeenCalledTimes(1);
    expect(mockFetchRoute).toHaveBeenCalledWith(PICKUP, [], DROPOFF);
    expect(result.current.dropoff).toEqual(DROPOFF);

    mockRoute = ROUTE;
    rerender({ active: true, location: car(31.49, 74.3125) });
    rerender({ active: true, location: car(31.485, 74.30625) });
    expect(mockFetchRoute).toHaveBeenCalledTimes(1);
    expect(result.current.route).toBe(ROUTE);
    expect(result.current.remaining[0].latitude).toBeCloseTo(31.485, 6);
    expect(result.current.remaining).toHaveLength(2);

    // The trip ends: the route is dropped and nothing is drawn.
    rerender({ active: false, location: car(31.48, 74.3) });
    expect(mockClearRoute).toHaveBeenCalledTimes(1);
    expect(result.current.route).toEqual([]);
    expect(result.current.dropoff).toBeNull();
  });
});

describe('useTripRoute with a stop', () => {
  // Pickup → stop (east) → drop-off: the car on the leg to the stop is far from a straight
  // pickup → drop-off line, but on this route.
  const STOP = { latitude: 31.52, longitude: 74.4 };
  const stopResource = (status: 'active' | 'completed') => ({
    id: 11,
    ride_id: 207,
    address: 'Stop',
    latitude: STOP.latitude,
    longitude: STOP.longitude,
    stop_order: 1,
    status,
    status_label: status,
    status_color: '',
    created_at: 't',
    updated_at: 't',
  });
  const STOP_ROUTE = [PICKUP, STOP, DROPOFF];
  type P = { location: LatLng; status: 'active' | 'completed' };

  beforeEach(() => {
    jest.useFakeTimers();
    mockFetchRoute.mockClear();
    mockRoute = [];
  });
  afterEach(() => jest.useRealTimers());

  it('first asks with the stop (booking cache key), stays quiet on the stop leg, refetches once when the stop is done', () => {
    const { rerender } = renderHook(
      ({ location, status }: P) => useTripRoute(true, { ...ride, stops: [stopResource(status)] }, location),
      { initialProps: { location: car(31.52, 74.36), status: 'active' } as P },
    );
    expect(mockFetchRoute).toHaveBeenCalledTimes(1);
    expect(mockFetchRoute).toHaveBeenLastCalledWith(PICKUP, [STOP], DROPOFF);

    // Following the stop leg for several minutes: never "off route", no new request until the refresh.
    mockRoute = STOP_ROUTE;
    for (let i = 1; i <= 10; i += 1) {
      act(() => jest.advanceTimersByTime(20_000));
      rerender({ location: car(31.52, 74.36 + i * 0.003), status: 'active' });
    }
    expect(mockFetchRoute).toHaveBeenCalledTimes(1);

    // The stop is completed: one request from the car to the drop-off, then quiet again.
    rerender({ location: car(31.519, 74.399), status: 'completed' });
    expect(mockFetchRoute).toHaveBeenCalledTimes(2);
    expect(mockFetchRoute).toHaveBeenLastCalledWith(car(31.519, 74.399), [], DROPOFF);
    mockRoute = [car(31.519, 74.399), DROPOFF];
    act(() => jest.advanceTimersByTime(20_000));
    rerender({ location: car(31.51, 74.38), status: 'completed' });
    expect(mockFetchRoute).toHaveBeenCalledTimes(2);
  });
});

describe('T-550: trip stop pins come from the ride', () => {
  const stop = (id: number, order: number, status: 'active' | 'completed', latitude: number, longitude: number) => ({
    id,
    ride_id: 207,
    address: `Stop ${id}`,
    latitude,
    longitude,
    stop_order: order,
    status,
    status_label: status,
    status_color: '',
    created_at: 't',
    updated_at: 't',
  });
  type P = { active: boolean; location: LatLng | null; first: 'active' | 'completed' };
  const rideWith = (first: 'active' | 'completed') => ({
    ...ride,
    // Out of order on purpose: pins follow stop_order.
    stops: [stop(22, 2, 'active', 31.5, 74.31), stop(21, 1, first, 31.51, 74.33)],
  });

  beforeEach(() => {
    mockFetchRoute.mockClear();
    mockRoute = [];
  });

  it('shows the active stops in route order (also after a reopen), keeps the array while they do not change, drops a completed one', () => {
    const { result, rerender } = renderHook(
      ({ active, location, first }: P) => useTripRoute(active, rideWith(first), location),
      { initialProps: { active: false, location: null, first: 'active' } as P },
    );
    // Not on the trip: no pins from here (the booking form draws its own).
    expect(result.current.stops).toEqual([]);

    // The trip, as on a reopen: the ride alone gives both pins, in stop_order.
    rerender({ active: true, location: car(31.515, 74.34), first: 'active' });
    const pins = result.current.stops;
    expect(pins).toEqual([
      { latitude: 31.51, longitude: 74.33 },
      { latitude: 31.5, longitude: 74.31 },
    ]);
    // A new car position (new ride object, same stops): the same array, so the map does not re-render.
    rerender({ active: true, location: car(31.512, 74.335), first: 'active' });
    expect(result.current.stops).toBe(pins);

    // Stop 1 completed: its pin goes.
    rerender({ active: true, location: car(31.51, 74.33), first: 'completed' });
    expect(result.current.stops).toEqual([{ latitude: 31.5, longitude: 74.31 }]);
  });
});
