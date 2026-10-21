import { Platform } from 'react-native';
import Geolocation, {
  type GeolocationConfiguration,
  type GeolocationError,
  type GeolocationOptions,
  type GeolocationResponse,
} from '@react-native-community/geolocation';

/**
 * T-712: the one geolocation configuration of the app, for the passenger lookups and the driver
 * watch alike (the library keeps a single global configuration).
 * - Android reads through the fused provider (Play Services). The library's default
 *   AndroidLocationManager refuses GPS without FINE, so an "Approximate only" user with Google
 *   Location Accuracy off got no position at all; the fused provider gives that app a coarsened one.
 * - Android never lets the library ask for permission (T-593, T-596): the app asks itself.
 * - iOS keeps what the driver tracker always set: "while using", no background updates.
 */
const appConfiguration = (): GeolocationConfiguration => ({
  skipPermissionRequests: Platform.OS === 'android',
  authorizationLevel: 'whenInUse',
  enableBackgroundLocationUpdates: false,
  locationProvider: Platform.OS === 'android' ? 'playServices' : 'auto',
});

let applied: string | null = null;

/**
 * Applies the app configuration once, before the first lookup or watch. The native module swaps
 * its location manager on a provider change without stopping a running watch (the old one
 * would leak), so the configuration is never changed again afterwards; later calls are no-ops.
 */
export const configureGeolocation = (): void => {
  const config = appConfiguration();
  const key = JSON.stringify(config);
  if (applied === key) return;
  applied = key;
  Geolocation.setRNConfiguration(config);
};

/** Tests only: forget the applied configuration (a fresh app start). */
export const resetGeolocationConfigurationForTests = (): void => {
  applied = null;
};

/** The error a lookup that ran out of time reports (the library's TIMEOUT code). */
const timeoutError = (): GeolocationError => ({
  code: 3,
  message: 'Location request timed out',
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
});

/**
 * One position lookup. The fused provider's single lookup has no native timeout, so on Android
 * a JS timer ends the wait after `options.timeout` with a TIMEOUT error; the timer is cleared as
 * soon as the lookup answers, and a late answer after the timer is ignored. iOS keeps the
 * library's own timeout.
 */
export const getPositionOnce = (
  success: (position: GeolocationResponse) => void,
  failure: (error: GeolocationError) => void,
  options: GeolocationOptions,
): void => {
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const settle = (): boolean => {
    if (settled) return false;
    settled = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    return true;
  };
  if (Platform.OS === 'android' && options.timeout !== undefined) {
    timer = setTimeout(() => {
      if (settle()) failure(timeoutError());
    }, options.timeout);
  }
  Geolocation.getCurrentPosition(
    (position) => {
      if (settle()) success(position);
    },
    (error) => {
      if (settle()) failure(error);
    },
    options,
  );
};

/**
 * T-712: on Android, POSITION_UNAVAILABLE means the device's location is switched off only with
 * one of these messages:
 * - the fused provider (Play Services): its settings check failed and neither GPS nor the network
 *   provider is on;
 * - the legacy AndroidLocationManager, which phones without Play Services (Huawei) keep: no
 *   provider it may use is on.
 * Any other "unavailable" with access granted (fused lastLocation or availability) is no fix yet,
 * a retry.
 */
const DEVICE_LOCATION_OFF = ['FusedLocationProvider/settings', 'No location provider available'];

export const isDeviceLocationOff = (error: Pick<GeolocationError, 'code' | 'message'>): boolean =>
  Platform.OS === 'android' &&
  error.code === 2 &&
  typeof error.message === 'string' &&
  DEVICE_LOCATION_OFF.some((marker) => error.message.includes(marker));
