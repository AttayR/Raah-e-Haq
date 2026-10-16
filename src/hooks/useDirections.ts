import { useCallback, useRef, useState } from 'react';
import { MAPS_CONFIG } from '../config/mapsConfig';
import { logger } from '../core/logging/logger';
import { CACHE_TTL, cacheVersion, readCache, writeCache } from '../core/api/queryCache';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * T-536 (PERF-19): the same route asked again within 5 min (a re-render, back on the booking
 * screen, the same pins) comes from the cache, keyed by the points rounded to 4 decimals (about
 * 11 m). Only an OK answer is cached.
 */
export const directionsCacheKey = (points: ReadonlyArray<Coordinates>): string =>
  `directions|${points.map((p) => `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`).join(';')}`;

const cachedRoute = (key: string): Coordinates[] | null =>
  readCache<Coordinates[]>(key, CACHE_TTL.directions)?.value ?? null;

export const useDirections = () => {
  const [routeCoordinates, setRouteCoordinatesState] = useState<Coordinates[]>([]);
  // Each request (and each clear) gets a number; only the newest request may set the route, so
  // a response that lands after clearRoute() (a cancelled ride, T-543) or after a newer request
  // cannot bring an old route back.
  const generation = useRef(0);
  const begin = useCallback(() => {
    generation.current += 1;
    const mine = generation.current;
    return (points: Coordinates[]) => {
      if (generation.current === mine) setRouteCoordinatesState(points);
    };
  }, []);

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
    const setRouteCoordinates = begin();
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

      const cacheKey = directionsCacheKey([pickup, destination]);
      const cached = cachedRoute(cacheKey);
      if (cached) {
        setRouteCoordinates(cached);
        return;
      }
      const since = cacheVersion(cacheKey);

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
        writeCache(cacheKey, points, since);
        setRouteCoordinates(points);
      } else {
        logger.warn('⚠️ No route data in response');
        setRouteCoordinates([]);
      }
    } catch (error) {
      logger.error('❌ Error fetching route:', error);
      setRouteCoordinates([]);
    }
  }, [begin]);

  // T-552: resolves true when a route came back (cache or Directions), false when none did.
  const fetchRouteWithWaypoints = useCallback(async (pickup: Coordinates, waypoints: Coordinates[], destination: Coordinates): Promise<boolean> => {
    const setRouteCoordinates = begin();
    try {
      const cacheKey = directionsCacheKey([pickup, ...waypoints, destination]);
      const cached = cachedRoute(cacheKey);
      if (cached) {
        setRouteCoordinates(cached);
        return true;
      }
      const since = cacheVersion(cacheKey);
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
        if (json.status === 'OK') writeCache(cacheKey, points, since);
        setRouteCoordinates(points);
        return points.length > 1;
      }
      setRouteCoordinates([]);
      return false;
    } catch {
      setRouteCoordinates([]);
      return false;
    }
  }, [begin]);

  const clearRoute = useCallback(() => begin()([]), [begin]);

  return { routeCoordinates, fetchRoute, fetchRouteWithWaypoints, clearRoute };
};

export default useDirections;


