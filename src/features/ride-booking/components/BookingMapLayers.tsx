import React from 'react';
import type { LatLng } from 'react-native-maps';
import { RideMarker, RouteLine } from '../../../components/ui';

type Props = {
  pickup: LatLng | null;
  stops: LatLng[];
  destination: LatLng | null;
  route: LatLng[];
};

/**
 * Pickup, stops, destination and the route on the booking map with the kit's custom pins and
 * cased route line (DESIGN_SYSTEM §5.21, UI-R5): pickup circle, numbered stops, drop-off square;
 * no Google teardrops.
 */
export const BookingMapLayers: React.FC<Props> = ({ pickup, stops, destination, route }) => (
  <>
    {route.length > 1 && <RouteLine coordinates={route} testID="booking-route" />}
    {pickup && <RideMarker kind="pickup" coordinate={pickup} testID="pickup-marker" />}
    {stops.map((stop, index) => (
      <RideMarker key={`stop-${index}`} kind="stop" index={index + 1} coordinate={stop} testID={`stop-marker-${index + 1}`} />
    ))}
    {destination && <RideMarker kind="dropoff" coordinate={destination} testID="destination-marker" />}
  </>
);

export default BookingMapLayers;
