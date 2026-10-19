import { useNativeLocation, type LocationErrorKind } from '../../hooks/useNativeLocation';
import { locationRefused, showLocationWait } from './locationGate';

/** What the full-screen LocationWaitState needs, without its back handler (the screen's). */
export type BookingLocationWait = {
  reason: LocationErrorKind | null;
  onRetry: () => void;
  onOpenSettings: () => void;
  canAskAgain: boolean;
};

/**
 * The booking map's device location and what it means for the screen (T-315, T-580):
 * - `wait`: props for the full-screen "Finding your location" state, or null when the map shows
 *   (a ride always wins; refused or switched-off access keeps the map too);
 * - `refused`: access refused or off, so the sheet shows the warning Banner and the pickup is
 *   searched by hand;
 * - `askOrSettings`: the Banner's action: asks the OS while it still can, else opens Settings.
 * No lookups while `active` is false (another screen covers booking).
 */
export const useBookingLocationGate = ({ active, rideShown }: { active: boolean; rideShown: boolean }) => {
  const {
    currentLocation,
    isLoading,
    error,
    permissionStatus,
    requestLocationPermission,
    openSettings,
  } = useNativeLocation({ active });

  const refused = !currentLocation && locationRefused(error);
  const wait: BookingLocationWait | null = showLocationWait({
    hasLocation: !!currentLocation,
    locationLoading: isLoading,
    rideShown,
    refused,
  })
    ? {
        reason: error,
        onRetry: () => {
          requestLocationPermission();
        },
        onOpenSettings: openSettings,
        canAskAgain: permissionStatus.canAskAgain,
      }
    : null;
  const askOrSettings = (): void => {
    if (error === 'disabled' || !permissionStatus.canAskAgain) {
      openSettings();
    } else {
      requestLocationPermission();
    }
  };

  return { currentLocation, requestLocationPermission, refused, wait, askOrSettings };
};
