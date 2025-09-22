import { useCallback, useState } from 'react';
import { MAPS_CONFIG } from '../config/mapsConfig';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const useDirections = () => {
  const [routeCoordinates, setRouteCoordinates] = useState<Coordinates[]>([]);

  /* eslint-disable no-bitwise */
  const decodePolyline = (t: string) => {
    let points: Coordinates[] = [];
    let index = 0, lat = 0, lng = 0;
    while (index < t.length) {
      let b, shift = 0, result = 0;
      do {
        b = t.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
      lat += dlat;
      shift = 0;
      result = 0;
      do {
        b = t.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
      lng += dlng;
      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
  };
  /* eslint-enable no-bitwise */

  const fetchRoute = useCallback(async (pickup: Coordinates, destination: Coordinates) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.latitude},${pickup.longitude}&destination=${destination.latitude},${destination.longitude}&key=${MAPS_CONFIG.API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.routes && json.routes[0] && json.routes[0].overview_polyline) {
        const points = decodePolyline(json.routes[0].overview_polyline.points);
        setRouteCoordinates(points);
      } else {
        setRouteCoordinates([]);
      }
    } catch {
      setRouteCoordinates([]);
    }
  }, []);

  const clearRoute = useCallback(() => setRouteCoordinates([]), []);

  return { routeCoordinates, fetchRoute, clearRoute };
};

export default useDirections;


