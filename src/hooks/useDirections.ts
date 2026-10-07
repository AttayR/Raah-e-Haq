import { useCallback, useState } from 'react';
import { MAPS_CONFIG } from '../config/mapsConfig';
import { logger } from '../core/logging/logger';

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
      logger.debug('🗺️ Fetching route:', { pickup, destination });
      
      // Validate coordinates
      if (!pickup || !destination || 
          !pickup.latitude || !pickup.longitude || 
          !destination.latitude || !destination.longitude) {
        logger.warn('⚠️ Invalid coordinates provided:', { pickup, destination });
        setRouteCoordinates([]);
        return;
      }
      
      // Check if coordinates are reasonable (not 0,0 or extreme values)
      if (pickup.latitude === 0 && pickup.longitude === 0 || 
          destination.latitude === 0 && destination.longitude === 0) {
        logger.warn('⚠️ Coordinates are 0,0 - likely invalid:', { pickup, destination });
        setRouteCoordinates([]);
        return;
      }
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.latitude},${pickup.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${MAPS_CONFIG.API_KEY}`;
      
      const res = await fetch(url);
      const json = await res.json();
      
      logger.debug('📊 Directions API Response:', json);
      
      if (json.status !== 'OK') {
        logger.warn('⚠️ Directions API status:', json.status, json.error_message);
        
        // Handle specific error cases
        if (json.status === 'ZERO_RESULTS') {
          logger.warn('🚫 No route found between coordinates:', { pickup, destination });
          // Create a simple straight line route as fallback
          const fallbackRoute = [
            { latitude: pickup.latitude, longitude: pickup.longitude },
            { latitude: destination.latitude, longitude: destination.longitude }
          ];
          logger.debug('🔄 Using fallback straight line route');
          setRouteCoordinates(fallbackRoute);
          return;
        } else if (json.status === 'INVALID_REQUEST') {
          logger.warn('❌ Invalid request to Directions API');
        } else if (json.status === 'OVER_QUERY_LIMIT') {
          logger.warn('⏰ Directions API quota exceeded');
        } else if (json.status === 'REQUEST_DENIED') {
          logger.warn('🔒 Directions API request denied - check API key');
        }
        
        setRouteCoordinates([]);
        return;
      }
      
      if (json.routes && json.routes[0] && json.routes[0].overview_polyline) {
        const points = decodePolyline(json.routes[0].overview_polyline.points);
        logger.debug('✅ Route decoded successfully:', points.length, 'points');
        setRouteCoordinates(points);
      } else {
        logger.warn('⚠️ No route data in response');
        setRouteCoordinates([]);
      }
    } catch (error) {
      logger.error('❌ Error fetching route:', error);
      setRouteCoordinates([]);
    }
  }, []);

  const fetchRouteWithWaypoints = useCallback(async (pickup: Coordinates, waypoints: Coordinates[], destination: Coordinates) => {
    try {
      let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${pickup.latitude},${pickup.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${MAPS_CONFIG.API_KEY}`;
      
      if (waypoints.length > 0) {
        const waypointStr = waypoints.map(wp => `${wp.latitude},${wp.longitude}`).join('|');
        url += `&waypoints=${waypointStr}`;
      }
      
      const res = await fetch(url);
      const json = await res.json();
      if (json.status !== 'OK') {
        logger.warn('Directions API status:', json.status, json.error_message);
      }
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

  return { routeCoordinates, fetchRoute, fetchRouteWithWaypoints, clearRoute };
};

export default useDirections;


