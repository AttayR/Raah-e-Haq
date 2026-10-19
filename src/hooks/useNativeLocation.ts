import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Platform, Linking, PermissionsAndroid } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { isAndroidEmulator, getDefaultLocation } from '../utils/locationUtils';
import { logger } from '../core/logging/logger';
import { primeBeforeOsPrompt } from '../features/permissions/primer';
import { locationOsDenied, locationOsUndetermined } from '../features/permissions/locationStatus';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationPermissionStatus {
  isGranted: boolean;
  canAskAgain: boolean;
  isLocationEnabled: boolean;
}

/**
 * Why there is no location (T-315), for the screen to render inline:
 * - `denied`: the passenger refused location access (Settings is the way back);
 * - `disabled`: location services are off for the device (or for the app on iOS);
 * - `unavailable`: no fix in time (timeout, no signal), worth a retry.
 */
export type LocationErrorKind = 'denied' | 'disabled' | 'unavailable';

export interface UseNativeLocationOptions {
  /**
   * False while the screen is not focused. The first lookup waits until it is true, and a
   * screen that comes back without a location tries once more. Nothing here ever shows an
   * alert: failures are returned as `error` for the screen to render (T-315).
   */
  active?: boolean;
}

/** Foreground only (B-08): a backgrounded app does not ask for the position. */
const useAppInForeground = (): boolean => {
  const [state, setState] = useState<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setState);
    return () => subscription.remove();
  }, []);
  // 'inactive' is also reported while a system dialog (the permission prompt) is up.
  return state !== 'background';
};

/** Geolocation error codes: 1 PERMISSION_DENIED, 2 POSITION_UNAVAILABLE, 3 TIMEOUT. */
const errorKindOf = (code: number): LocationErrorKind =>
  code === 1 ? 'denied' : code === 2 ? 'disabled' : 'unavailable';

export const useNativeLocation = ({ active = true }: UseNativeLocationOptions = {}) => {
  const appInForeground = useAppInForeground();
  const enabled = active && appInForeground;
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  // Loading from the start while enabled, so a screen does not flash its "no location" state
  // before the first lookup has begun.
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<LocationErrorKind | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>({
    isGranted: false,
    canAskAgain: true,
    isLocationEnabled: false,
  });
  // A late callback after unmount must not set state.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Check location services status
  const checkLocationServices = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      // For Android emulator, always return true
      if (isAndroidEmulator()) {
        logger.debug('Android emulator detected, skipping location services check');
        resolve(true);
        return;
      }

      Geolocation.getCurrentPosition(
        () => resolve(true),
        (positionError) => {
          // Error codes 1 and 2 usually indicate location services are disabled
          resolve(positionError.code !== 1 && positionError.code !== 2);
        },
        { timeout: 5000, maximumAge: 60000 }
      );
    });
  }, []);

  // Check permission status
  const checkPermissionStatus = useCallback(async (): Promise<LocationPermissionStatus> => {
    if (Platform.OS === 'android') {
      try {
        const fineLocation = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        const coarseLocation = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
        );

        const isGranted = fineLocation || coarseLocation;
        const isLocationEnabled = await checkLocationServices();

        // For Android emulator, always return granted and enabled
        if (isAndroidEmulator()) {
          return {
            isGranted: true,
            canAskAgain: false,
            isLocationEnabled: true,
          };
        }

        return {
          isGranted,
          canAskAgain: !isGranted,
          isLocationEnabled,
        };
      } catch (permissionError) {
        logger.warn('Error checking Android permissions:', permissionError);
        return {
          isGranted: false,
          canAskAgain: true,
          isLocationEnabled: false,
        };
      }
    } else {
      // iOS - Geolocation automatically handles permissions
      const isLocationEnabled = await checkLocationServices();
      return {
        isGranted: true, // iOS handles this automatically
        canAskAgain: false,
        isLocationEnabled,
      };
    }
  }, [checkLocationServices]);

  // Get current location; a failure is kept in `error` (no alert).
  const getCurrentLocation = useCallback((): Promise<Coordinates | null> => {
    return new Promise((resolve) => {
      // For Android emulator, use a default location if real location fails
      const isEmulator = Platform.OS === 'android' && __DEV__;

      Geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          if (mounted.current) {
            setCurrentLocation(location);
            setError(null);
          }
          resolve(location);
        },
        (positionError) => {
          logger.warn('Location error:', positionError);

          // For Android emulator, use default location
          if (isEmulator && positionError.code === 3) { // TIMEOUT
            logger.debug('Using default location for Android emulator');
            const defaultLocation = getDefaultLocation();
            if (mounted.current) {
              setCurrentLocation(defaultLocation);
              setError(null);
            }
            resolve(defaultLocation);
            return;
          }

          if (mounted.current) setError(errorKindOf(positionError.code));
          resolve(null);
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }, []);

  // Request location permission (from a button the passenger pressed), then read the position.
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);

    try {
      // For Android emulator, skip permission request and use default location
      if (isAndroidEmulator()) {
        logger.debug('Android emulator detected, using default location');
        const defaultLocation = getDefaultLocation();
        setCurrentLocation(defaultLocation);
        setError(null);
        setPermissionStatus({
          isGranted: true,
          canAskAgain: false,
          isLocationEnabled: true,
        });
        return true;
      }

      if (Platform.OS === 'android') {
        // Check current status first
        const currentStatus = await checkPermissionStatus();

        if (currentStatus.isGranted) {
          if (mounted.current) setPermissionStatus(currentStatus);
          // Permission already granted, check if location services are enabled
          if (!currentStatus.isLocationEnabled) {
            if (mounted.current) setError('disabled');
            return false;
          }
          return (await getCurrentLocation()) !== null;
        }

        // Request permission
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'RaaHeHaq needs access to your location to find nearby drivers and show your position.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'Allow',
          }
        );

        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          if (mounted.current) {
            setPermissionStatus({
              isGranted: false,
              canAskAgain: granted !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
              isLocationEnabled: currentStatus.isLocationEnabled,
            });
            setError('denied');
          }
          return false;
        }

        // Permission granted, now check location services
        const isLocationEnabled = await checkLocationServices();
        if (mounted.current) setPermissionStatus({ isGranted: true, canAskAgain: false, isLocationEnabled });
        if (!isLocationEnabled) {
          if (mounted.current) setError('disabled');
          return false;
        }
        return (await getCurrentLocation()) !== null;
      }

      // iOS - Just get location, iOS handles permissions automatically
      const location = await getCurrentLocation();
      if (location && mounted.current) {
        setPermissionStatus({ isGranted: true, canAskAgain: false, isLocationEnabled: true });
      }
      // T-580 (QA bug 4): after "Don't Allow" the OS will not ask again. Record that, so the
      // screen keeps its "Turn on location" state, now opening Settings (whatever error code the
      // lookup ended with).
      if (!location && (await locationOsDenied()) && mounted.current) {
        setPermissionStatus({ isGranted: false, canAskAgain: false, isLocationEnabled: false });
        setError('denied');
      }
      return location !== null;
    } catch (requestError) {
      logger.warn('Error requesting location permission:', requestError);
      if (mounted.current) setError('unavailable');
      return false;
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [checkPermissionStatus, checkLocationServices, getCurrentLocation]);

  // Initialize location
  const initializeLocation = useCallback(async () => {
    setIsLoading(true);

    try {
      // UI-R8: before the OS asks the first time, the app's own pre-prompt explains why
      // (shared-permissions). "Not now" leaves the OS unasked: the screen shows its "Turn on"
      // state, whose tap asks the OS directly (requestLocationPermission).
      const primer = await primeBeforeOsPrompt('locationPassenger', locationOsUndetermined);
      if (!mounted.current) return;
      if (primer === 'skip') {
        setPermissionStatus({ isGranted: false, canAskAgain: true, isLocationEnabled: false });
        setError('denied');
        return;
      }
      if (primer === 'continued' && Platform.OS === 'android') {
        // "Continue" means: ask now (Android has no prompt on a plain lookup).
        await requestLocationPermission();
        return;
      }
      const status = await checkPermissionStatus();
      if (!mounted.current) return;
      setPermissionStatus(status);

      if (status.isGranted && status.isLocationEnabled) {
        await getCurrentLocation();
      } else if (status.isGranted) {
        // Granted (always on iOS) but no position allowed: services or app access are off.
        setError('disabled');
      }
      // Not granted yet on Android: the screen offers "Turn on", which asks.
    } catch (initError) {
      logger.warn('Error initializing location:', initError);
      if (mounted.current) setError('unavailable');
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, [checkPermissionStatus, getCurrentLocation, requestLocationPermission]);

  // Refresh location
  const refreshLocation = useCallback(async () => {
    if (permissionStatus.isGranted && permissionStatus.isLocationEnabled) {
      await getCurrentLocation();
    } else {
      await requestLocationPermission();
    }
  }, [permissionStatus, getCurrentLocation, requestLocationPermission]);

  /** The app's page in the device Settings (location access is turned back on there). */
  const openSettings = useCallback(() => {
    Linking.openSettings().catch((settingsError) => logger.warn('Could not open settings:', settingsError));
  }, []);

  // First lookup once the screen is focused and the app is in the foreground; a screen that
  // comes back (or an app that returns) without a location tries once more. Never on a loop.
  const hasLocation = currentLocation !== null;
  useEffect(() => {
    if (!enabled || hasLocation) return;
    initializeLocation();
  }, [enabled, hasLocation, initializeLocation]);

  return {
    currentLocation,
    isLoading,
    error,
    permissionStatus,
    requestLocationPermission,
    refreshLocation,
    getCurrentLocation,
    openSettings,
  };
};

export default useNativeLocation;
