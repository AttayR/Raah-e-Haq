import { useMemo } from 'react';
import type { LatLng } from 'react-native-maps';
import type { RideResource } from '../../../services/rideService';
import { useRideRouteLeg } from '../../active-ride/routeLeg';
import { useTripRoute } from '../../active-ride/tripRoute';
import { activeStops, toLatLng, type DriverRideStep } from '../steps';

const EMPTY: LatLng[] = [];

export type DriverRideMapLayers = {
  pickup: LatLng | null;
  /** The stops still to visit (numbered pins), on the trip only. */
  stops: Array<{ id: number; coordinate: LatLng }>;
  dropoff: LatLng | null;
  /** The cased route ahead of the vehicle; empty while it loads or after it failed (pins only). */
  route: LatLng[];
  /** The driver's own vehicle is drawn (not on the receipt or the cancelled state). */
  showVehicle: boolean;
};

/**
 * What the driver's ride map draws per step (UI-R13, shared-trip-sheet TS2.1, DP5/DT5):
 * - to pickup: the pickup pin and the vehicle → pickup leg once fetched; arrived: the pickup pin;
 * - on trip: the stops still to visit, the drop-off and the trip route from the vehicle;
 * - receipt / cancelled: the pickup and drop-off pins, no vehicle, no route.
 * Both legs keep the T-549 rules (one Directions request per leg start, then only when > 120 m
 * off the line, never sooner than 60 s, and every 5 min); never a straight line.
 */
export const useDriverRideMap = (
  ride: RideResource | null,
  step: DriverRideStep,
  vehicle: { latitude: number; longitude: number } | null,
): DriverRideMapLayers => {
  const toPickup = step === 'to_pickup';
  const onTrip = step === 'on_trip';
  const legKey = toPickup && ride ? `${ride.id}:pickup` : null;
  const pLat = ride?.pickup_latitude;
  const pLng = ride?.pickup_longitude;
  const target = useMemo(() => (legKey ? { latitude: pLat, longitude: pLng } : null), [legKey, pLat, pLng]);
  const leg = useRideRouteLeg(legKey, target, vehicle);
  const trip = useTripRoute(onTrip, ride, vehicle);

  const pickup = useMemo(() => (ride ? toLatLng(ride.pickup_latitude, ride.pickup_longitude) : null), [ride]);
  const dropoff = useMemo(() => (ride ? toLatLng(ride.dropoff_latitude, ride.dropoff_longitude) : null), [ride]);
  const stops = useMemo(
    () =>
      onTrip
        ? activeStops(ride).flatMap((stop) => {
            const coordinate = toLatLng(stop.latitude, stop.longitude);
            return coordinate ? [{ id: stop.id, coordinate }] : [];
          })
        : [],
    [onTrip, ride],
  );

  const ended = step === 'summary' || step === 'cancelled';
  let route = EMPTY;
  if (toPickup) route = leg.remaining;
  else if (onTrip && trip.route.length > 1) route = trip.remaining;
  return {
    pickup: onTrip ? null : pickup,
    stops,
    dropoff: onTrip || ended ? dropoff : null,
    route,
    showVehicle: !ended,
  };
};
