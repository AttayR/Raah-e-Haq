import { useMemo } from 'react';
import type { LatLng } from 'react-native-maps';
import type { DriverLocation, RideResource } from '../../services/rideService';
import type { PassengerRideStage } from './stage';
import { useRideMapRoutes, useTripRoute } from './tripRoute';
import { useRideRouteLeg } from './routeLeg';

const EMPTY: LatLng[] = [];

type Input = {
  stage: PassengerRideStage | null | undefined;
  ride: RideResource | null;
  driverLocation: DriverLocation | null;
  /** The booking's own points and route (before a ride, and the receipt's route from the cache). */
  pickup: LatLng | null;
  stops: LatLng[];
  destination: LatLng | null;
  bookingRoute: LatLng[];
};

export type RideMapLayers = {
  pickup: LatLng | null;
  stops: LatLng[];
  destination: LatLng | null;
  route: LatLng[];
  driverRoute: LatLng[];
};

/**
 * What the passenger booking map draws per ride stage (UI-R12, shared-trip-sheet TS2.1):
 * - on the way: the pickup pin and the vehicle → pickup leg once fetched (no drop-off: the meeting
 *   point is the focus); arrived: the pickup pin only;
 * - on trip (T-549/T-550/T-552): the stops still to visit, the drop-off and the route ahead of the car;
 * - otherwise (booking, receipt): the booking's points and route (the receipt's from the cache).
 * The arrays keep their identity while unchanged, so the memoised map skips.
 */
export const useRideMapLayers = ({ stage, ride, driverLocation, pickup, stops, destination, bookingRoute }: Input): RideMapLayers => {
  const inTrip = stage === 'in_trip';
  const trip = useTripRoute(inTrip, ride, driverLocation);
  const tripRoutes = useRideMapRoutes(inTrip, trip, bookingRoute, driverLocation);
  const onTheWay = stage === 'driver_en_route';
  const meeting = onTheWay || stage === 'driver_arrived';
  const legKey = onTheWay && ride ? `${ride.id}:pickup` : null;
  const pLat = ride?.pickup_latitude;
  const pLng = ride?.pickup_longitude;
  const target = useMemo(() => (legKey ? { latitude: pLat, longitude: pLng } : null), [legKey, pLat, pLng]);
  const leg = useRideRouteLeg(legKey, target, driverLocation);

  if (meeting) {
    return { pickup, stops: EMPTY, destination: null, route: onTheWay ? leg.remaining : EMPTY, driverRoute: EMPTY };
  }
  return {
    pickup: inTrip ? null : pickup,
    stops: inTrip ? trip.stops : stops,
    destination: trip.dropoff ?? destination,
    route: tripRoutes.route,
    driverRoute: tripRoutes.driverRoute,
  };
};
