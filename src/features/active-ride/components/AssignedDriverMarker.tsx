import React, { useMemo } from 'react';
import { VehicleMarker } from '../../../components/ui';
import type { DriverLocation } from '../../../services/rideService';
import { ACTIVE_RIDE_COPY } from '../copy';
import { DRIVER_LOCATION_POLL_MS } from '../hooks';
import { assignedMarkerIntervalMs } from '../arrivedMarker';
import type { PassengerRideStage } from '../stage';

type LatLng = { latitude: number; longitude: number };

/**
 * The route the driver's marker may snap to: the booking route (pickup → drop-off) only while
 * the trip is under way. Heading to the pickup the driver is on some other road, so the marker
 * interpolates in a straight line instead of being pulled onto the trip route.
 */
export const trackingRouteFor = (
  stage: PassengerRideStage | null | undefined,
  route: ReadonlyArray<LatLng> | null | undefined,
): ReadonlyArray<LatLng> | null => (stage === 'in_trip' && route && route.length >= 2 ? route : null);

/**
 * The assigned driver's position (GET /rides/{id}/driver-location) on the passenger map (T-517):
 * the booked vehicle type drawn top-down, driving smoothly between the ~4 s reads, turning with
 * the server heading (else the direction of travel), and following the route polyline on the
 * trip (`trackingRouteFor`). Reduced motion jumps.
 */
const AssignedDriverMarkerBase: React.FC<{
  location: DriverLocation | null;
  vehicleType?: string | null;
  /** The passenger stage: the route is only snapped to while `in_trip`. */
  stage?: PassengerRideStage | null;
  route?: ReadonlyArray<LatLng> | null;
}> = ({ location, vehicleType, stage, route }) => {
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  // T-534 (PERF-12): the same point keeps the same object, so the memoised marker skips.
  const coordinate = useMemo(
    () => (latitude === undefined || longitude === undefined ? null : { latitude, longitude }),
    [latitude, longitude],
  );
  if (!location || !coordinate) return null;
  return (
    <VehicleMarker
      testID="assigned-driver-marker"
      coordinate={coordinate}
      heading={location.heading}
      vehicleType={vehicleType}
      route={trackingRouteFor(stage, route)}
      updateIntervalMs={assignedMarkerIntervalMs(stage, DRIVER_LOCATION_POLL_MS)}
      title={ACTIVE_RIDE_COPY.driverMarkerTitle}
    />
  );
};

export const AssignedDriverMarker = React.memo(AssignedDriverMarkerBase);
