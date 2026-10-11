import { useEffect, useState } from 'react';
import { reverseGeocode } from '../../services/placesService';
import { logger } from '../../core/logging/logger';
import type { HomeLocationState } from './components/HomeHeader';
import { displayAddress } from './greeting';

type Coords = { latitude: number; longitude: number } | null;
type Permission = { isGranted: boolean; isLocationEnabled: boolean };

const coordsText = (c: { latitude: number; longitude: number }) => `${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}`;

/**
 * Where the rider is, for the Home header: the reverse-geocoded street address (Plus Code
 * dropped), coordinates when geocoding fails, or a denied / locating state. Moved out of
 * PassengerHomeScreen (same lookups as before).
 */
export const useHomeLocation = (currentLocation: Coords, permission: Permission): HomeLocationState => {
  const [state, setState] = useState<HomeLocationState>({ kind: 'locating' });

  useEffect(() => {
    let active = true;
    if (!permission.isGranted || !permission.isLocationEnabled) {
      setState({ kind: 'denied' });
      return;
    }
    if (!currentLocation) {
      setState({ kind: 'locating' });
      return;
    }
    (async () => {
      try {
        const address = await reverseGeocode(currentLocation.latitude, currentLocation.longitude);
        if (!active) return;
        const text = typeof address === 'string' && address.trim().length > 0 ? displayAddress(address) : coordsText(currentLocation);
        setState({ kind: 'address', text });
      } catch (error) {
        logger.warn('Reverse geocoding error:', error);
        if (active) setState({ kind: 'address', text: coordsText(currentLocation) });
      }
    })();
    return () => {
      active = false;
    };
  }, [currentLocation, permission.isGranted, permission.isLocationEnabled]);

  return state;
};
