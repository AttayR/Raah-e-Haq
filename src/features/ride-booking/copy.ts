import { perLocale } from '../../i18n';
import { localizedCopy } from '../../i18n/localizedCopy';

/**
 * Static copy of the booking flow (T-302). Server messages (a refused request, a 422 field
 * message, a failed estimate) come from the API and are never written here.
 */
export const BOOKING_COPY = localizedCopy({
  vehicleTypesLoading: 'Loading vehicle types…',
  vehicleTypesFailed: 'Could not load vehicle types.',
  vehicleTypesEmpty: 'No vehicle types are available right now.',
  estimateLoading: 'Calculating fare…',
  estimateFailed: 'Could not calculate the fare.',
  retry: 'Retry',
  // T-311: the booking price is the server's quote. T-521: the footnote is `fare.lockNote` (BE-82
  // locks the fare when a driver accepts).
  estimatedFareTitle: 'Estimated fare',
  estimatedTotal: 'Estimated total',
  /** §7: the button names the action and the choice ("Request Rickshaw"). */
  request: (vehicle: string) => `Request ${vehicle}`,
  tripSummary: (km: number, min: number) => `${km} km • ${min} min`,
  phoneNotVerifiedTitle: 'Verify your phone number',
  phoneNotVerifiedAction: 'Verify number',
  notNow: 'Not now',
  chooseOnMap: 'Choose on map',
  /** Pickup field while the passenger's own position is the pickup (until they edit it). */
  currentLocation: 'Current location',
  /** Pickup field while the position's address is looked up (the field is read-only then). */
  resolvingAddress: 'Resolving address…',
  setLocationOnMap: 'Set location on map',
  noPlacesTitle: 'No places found',
  noPlacesBody: 'Check the spelling or choose on the map.',
  searchFailed: "Search isn't working right now.",
  addStopOnMap: '+ Add via map',
  pinnedOnMap: 'Pinned on map',
  mapPickHint: (target: 'pickup' | 'destination' | 'stop') =>
    target === 'pickup' ? 'Tap the map to set your pickup' : target === 'destination' ? 'Tap the map to set your destination' : 'Tap the map to add a stop',
  mapPickCancel: 'Cancel',
  // T-315: the booking map's inline "no location" state (no blocking alerts).
  locationWaitTitle: 'Finding your location',
  locationWaitBody: 'Allow location access so drivers can find your pickup.',
  locationOffTitle: 'Location is off',
  locationOffBody: 'Turn on location for Raah-e-Haq in Settings so drivers can find your pickup.',
  locationUnavailableTitle: "Can't find your location",
  locationUnavailableBody: 'Move to an open area or check your connection, then try again.',
  locationRetry: 'Try again',
  locationOpenSettings: 'Open settings',
  // T-523: the booking sheet's own labels, so they follow the language too.
  pickupPlaceholder: 'Pickup location',
  destinationPlaceholder: 'Where to?',
  destinationA11y: 'Destination',
  clearA11y: 'Clear',
  useCurrentLocation: 'Use current location',
  swapA11y: 'Swap pickup and destination',
  tripDetails: 'Trip details',
  editPickup: 'Edit pickup',
  editDropoff: 'Edit drop-off',
  swap: 'Swap',
  optionalStops: (max: number) => `Add optional stops (up to ${max})`,
  addStop: 'Add a stop',
  stopLine: (n: number, address: string) => `Stop ${n}: ${address}`,
  removeStopA11y: (n: number) => `Remove stop ${n}`,
  reviewTitle: 'Review & confirm',
  reviewMeta: (vehicle: string) => `Vehicle: ${vehicle}`,
  changeVehicle: 'Change vehicle',
  cancelBooking: 'Cancel',
  dismissErrorA11y: 'Dismiss error',
  mapError: 'Map error. Please restart the app.',
  mapLoading: 'Loading map…',
  backA11y: 'Back',
  recenterA11y: 'Show my location',
  startOverA11y: 'Start over',
} as const);

/**
 * Field texts that are labels, not addresses: typing in the field replaces them (T-551). In the
 * active language (T-523), so call it at render time.
 */
export const locationFieldLabels = perLocale((): readonly string[] => [BOOKING_COPY.currentLocation, BOOKING_COPY.pinnedOnMap]);
