import React from 'react';
import { Marker, type LatLng } from 'react-native-maps';
import MAPS_CONFIG from '../../../config/mapsConfig';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import AnimatedPolyline from '../../../components/AnimatedPolyline';

type Props = {
  pickup: LatLng | null;
  stops: LatLng[];
  destination: LatLng | null;
  route: LatLng[];
};

/**
 * Pickup, stops, destination and the route on the booking map, in the theme's map colours
 * (DESIGN_SYSTEM 5.21: `pickupPin`, `stopPin`, `dropoffPin`, `routeLine`).
 */
export const BookingMapLayers: React.FC<Props> = ({ pickup, stops, destination, route }) => {
  const { theme } = useAppTheme();
  const c = theme.colors;
  return (
    <>
      {pickup && (
        <Marker
          testID="pickup-marker"
          coordinate={pickup}
          title={MAPS_CONFIG.MARKERS.pickup.title}
          pinColor={c.pickupPin}
        />
      )}
      {stops.map((stop, index) => (
        <Marker key={`stop-${index}`} coordinate={stop} title={`Stop ${index + 1}`} pinColor={c.stopPin} />
      ))}
      {destination && (
        <Marker
          testID="destination-marker"
          coordinate={destination}
          title={MAPS_CONFIG.MARKERS.destination.title}
          pinColor={c.dropoffPin}
        />
      )}
      {route.length > 0 && <AnimatedPolyline coordinates={route} strokeWidth={5} strokeColor={c.routeLine} durationMs={1200} />}
    </>
  );
};

export default BookingMapLayers;
