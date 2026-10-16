/**
 * T-552 (QA 2026-10-16 regression): on the trip the passenger camera fitted only the car and the
 * drop-off, so the stop pin sat at the edge under the top-right controls (2-06, 2-08); and at
 * the trip start the line from before the trip lingered for a frame (2-05).
 */
import { act, renderHook } from '@testing-library/react-native';
import type { LatLng } from 'react-native-maps';
import {
  MIN_VISIBLE_MAP,
  RIDE_CONTROLS_CLEARANCE,
  rideFollowCoordinates,
  rideFollowEdgePadding,
  usePassengerRideCamera,
  viewportEdgePadding,
  withMinimumSpan,
} from '../../../src/features/active-ride/camera';
import { rideMapRoutes, useTripRoute } from '../../../src/features/active-ride/tripRoute';

const mockFetchRoute = jest.fn();
let mockRoute: LatLng[] = [];
jest.mock('../../../src/hooks/useDirections', () => ({
  useDirections: () => ({ routeCoordinates: mockRoute, fetchRouteWithWaypoints: mockFetchRoute, clearRoute: jest.fn() }),
}));
import type { RideStopResource } from '../../../src/services/rideService';

const DROPOFF = { latitude: 31.48, longitude: 74.3 };
const car = (latitude: number, longitude: number) => ({ latitude, longitude });

const stop = (
  id: number,
  order: number,
  status: RideStopResource['status'],
  latitude: number | string,
  longitude: number | string,
): RideStopResource =>
  ({
    id,
    ride_id: 209,
    address: `Fake stop ${id}`,
    latitude,
    longitude,
    stop_order: order,
    status,
    status_label: status,
    status_color: '',
    created_at: 't',
    updated_at: 't',
  }) as RideStopResource;

const rideWithStops = (stops: RideStopResource[]) => ({
  pickup_latitude: 31.52,
  pickup_longitude: 74.35,
  dropoff_latitude: 31.48,
  dropoff_longitude: 74.3,
  stops,
});

describe('T-552: the trip camera fits the stops still to visit', () => {
  it('fits car → active stops (route order) → drop-off; completed stops and bad coordinates are left out', () => {
    const ride = rideWithStops([
      stop(22, 2, 'active', '31.50000000', '74.31000000'),
      stop(21, 1, 'active', 31.53, 74.36),
      stop(23, 3, 'completed', 31.6, 74.4),
      stop(24, 4, 'active', 'x', 74.4),
    ]);
    expect(rideFollowCoordinates('in_trip', car(31.51, 74.34), ride)).toEqual([
      car(31.51, 74.34),
      car(31.53, 74.36),
      car(31.5, 74.31),
      DROPOFF,
    ]);
  });

  it('without stops it is still the car and the drop-off; the approach is unchanged', () => {
    expect(rideFollowCoordinates('in_trip', car(31.51, 74.34), rideWithStops([]))).toEqual([car(31.51, 74.34), DROPOFF]);
    const ride = rideWithStops([stop(21, 1, 'active', 31.53, 74.36)]);
    expect(rideFollowCoordinates('driver_en_route', car(31.51, 74.34), ride)).toEqual([
      car(31.51, 74.34),
      { latitude: 31.52, longitude: 74.35 },
    ]);
  });

  it('the hook fits the stop, and a completed stop drops out of the next fit', () => {
    jest.useFakeTimers();
    try {
      const viewport = { mapHeight: 874, bottom: 438, top: 118 };
      const fit = jest.fn();
      const mapRef = { current: { fitToCoordinates: fit, animateToRegion: jest.fn() } };
      type P = { status: RideStopResource['status'] };
      const { rerender, result } = renderHook(
        ({ status }: P) =>
          usePassengerRideCamera(
            mapRef,
            'in_trip',
            car(31.51, 74.34),
            rideWithStops([stop(21, 1, status, 31.53, 74.36)]),
            null,
            viewport,
          ),
        { initialProps: { status: 'active' } as P },
      );
      act(() => result.current.onMapReady());
      expect(fit).toHaveBeenCalledTimes(1);
      expect(fit).toHaveBeenLastCalledWith(withMinimumSpan([car(31.51, 74.34), car(31.53, 74.36), DROPOFF]), {
        edgePadding: rideFollowEdgePadding(viewport),
        animated: true,
      });

      rerender({ status: 'completed' });
      act(() => jest.advanceTimersByTime(10_000));
      expect(fit).toHaveBeenCalledTimes(2);
      expect(fit.mock.calls[1][0]).toEqual(withMinimumSpan([car(31.51, 74.34), DROPOFF]));
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('T-552: ride fit padding keeps points clear of the top controls', () => {
  it('is the viewport padding when the sheet leaves room (top = controls + clearance)', () => {
    const viewport = { mapHeight: 874, bottom: 438, top: 118 };
    expect(rideFollowEdgePadding(viewport)).toEqual(viewportEdgePadding(viewport));
    expect(rideFollowEdgePadding(viewport).top).toBe(118 + RIDE_CONTROLS_CLEARANCE);
  });

  it('with a tall sheet the bottom gives way, never the top (the generic clamp shrank both)', () => {
    const viewport = { mapHeight: 667, bottom: 600, top: 100 };
    expect(viewportEdgePadding(viewport).top).toBeLessThan(100);
    const pad = rideFollowEdgePadding(viewport);
    expect(pad.top).toBe(100 + RIDE_CONTROLS_CLEARANCE);
    expect(pad.bottom).toBe(667 - MIN_VISIBLE_MAP - pad.top);
    expect(pad.right).toBe(48);
  });

  it('no viewport yet: the default padding', () => {
    expect(rideFollowEdgePadding(null)).toEqual(viewportEdgePadding(null));
  });
});

describe('T-552: no pre-trip line at the trip start', () => {
  const booking: LatLng[] = [car(31.52, 74.35), car(31.5, 74.32), DROPOFF];
  const tripRoute: LatLng[] = [car(31.51, 74.34), DROPOFF];
  const remaining: LatLng[] = [car(31.505, 74.33), DROPOFF];

  it('before the trip: the booking route', () => {
    expect(rideMapRoutes(false, { route: [], remaining: [], failed: false }, booking)).toEqual({ route: booking, driverRoute: booking });
  });

  it('trip started, trip route not here yet: nothing drawn (not the booking route)', () => {
    const first = rideMapRoutes(true, { route: [], remaining: [], failed: false }, booking);
    expect(first.route).toEqual([]);
    expect(first.driverRoute).toEqual([]);
    // Stable empty arrays, so the memoised map does not re-render on every poll.
    expect(rideMapRoutes(true, { route: [], remaining: [], failed: false }, booking).route).toBe(first.route);
  });

  it('trip route request failed: the booking route again, from the car on', () => {
    // The car halfway along the last leg: the driven part (pickup → middle) is not drawn.
    const routes = rideMapRoutes(true, { route: [], remaining: [], failed: true }, booking, car(31.49, 74.31));
    expect(routes.route).toHaveLength(2);
    expect(routes.route[0].latitude).toBeCloseTo(31.49, 6);
    expect(routes.route[0].longitude).toBeCloseTo(74.31, 6);
    expect(routes.route[1]).toEqual(DROPOFF);
    expect(routes.driverRoute).toBe(booking);
    // A failure with no booking route (reopened mid-trip): still nothing, never a fake line.
    expect(rideMapRoutes(true, { route: [], remaining: [], failed: true }, [], null).route).toEqual([]);
  });

  it('trip route here: the part ahead of the car, and the whole route for the marker', () => {
    const routes = rideMapRoutes(true, { route: tripRoute, remaining, failed: false }, booking);
    expect(routes.route).toBe(remaining);
    expect(routes.driverRoute).toBe(tripRoute);
  });
});

describe('T-552: useTripRoute reports a failed trip route request', () => {
  const ride = { id: 209, pickup_latitude: 31.52, pickup_longitude: 74.35, dropoff_latitude: 31.48, dropoff_longitude: 74.3 };

  beforeEach(() => {
    mockFetchRoute.mockReset();
    mockRoute = [];
  });

  it('failed after a request with no route, not before; cleared when the trip ends', async () => {
    let answer: (ok: boolean) => void = () => undefined;
    mockFetchRoute.mockReturnValueOnce(new Promise<boolean>((resolve) => (answer = resolve)));
    type P = { active: boolean };
    const { result, rerender } = renderHook(({ active }: P) => useTripRoute(active, ride, car(31.51, 74.34)), {
      initialProps: { active: true },
    });
    expect(mockFetchRoute).toHaveBeenCalledTimes(1);
    // At the trip start (request in flight) it has not failed: nothing is drawn yet.
    expect(result.current.failed).toBe(false);
    await act(async () => answer(false));
    expect(result.current.failed).toBe(true);
    rerender({ active: false });
    expect(result.current.failed).toBe(false);
  });

  it('a request that brings a route is not a failure', async () => {
    mockFetchRoute.mockResolvedValueOnce(true);
    const { result } = renderHook(() => useTripRoute(true, ride, car(31.51, 74.34)));
    await act(async () => undefined);
    expect(result.current.failed).toBe(false);
  });
});
