import { SUPPORTED_LOCALES } from '../../i18n';
import { copyInLocale, localizedCopy } from '../../i18n/localizedCopy';
import { formatDistance, formatDuration } from '../../utils/format';

/**
 * Static copy of the booking flow (T-302). Server messages (a refused request, a 422 field
 * message, a failed estimate) come from the API and are never written here.
 */
export const BOOKING_COPY = localizedCopy({
  vehicleTypesFailed: 'Could not load vehicle types.',
  estimateLoading: 'Calculating fare…',
  estimateFailed: 'Could not calculate the fare.',
  // T-311: the booking price is the server's quote (BE-82 locks the fare when a driver accepts;
  // the FareTag is the lock note).
  estimatedTotal: 'Estimated total',
  /** UI-R10 (§12.5 [UI-R5]): the sticky footer names the action, the tier and the fare. */
  requestWithFare: (vehicle: string, fare: string) => `Request ${vehicle} · ${fare}`,
  /** UI-R10: the footer while nothing can be requested yet (prices loading, none available). */
  requestIdle: 'Request',
  /** UI-R10: the footer while NetInfo reports no connection. */
  requestOffline: "You're offline",
  /** UI-R5 → UI-R10: one distance and duration format (`formatDistance` / `formatDuration`). */
  tripSummary: (km: number, min: number) => [formatDuration(min), formatDistance(km)].filter(Boolean).join(' · '),
  // UI-R10: the "Choose a ride" sheet (passenger-vehicle-fare.md).
  chooseRideTitle: 'Choose a ride',
  tripLine: (pickup: string, dropoff: string) => `${pickup} → ${dropoff}`,
  stopsCount: (n: number) => (n === 1 ? '1 stop' : `${n} stops`),
  editTripA11y: (trip: string) => `Edit trip, ${trip}`,
  routeSummaryA11y: (summary: string) => `Trip ${summary}. Edit trip`,
  pricesFailedTitle: "Couldn't get prices",
  noRidesTitle: 'No rides available here',
  noRidesBody: 'Try a different pickup or try again in a few minutes.',
  fareDetails: 'Fare details',
  hideFareDetails: 'Hide fare details',
  addStopSubtitle: (max: number) => `Up to ${max} stops on the way`,
  paymentCash: 'Cash',
  paymentCashBody: 'Pay your driver at the end of the trip',
  discardTitle: 'Discard this trip?',
  discardBody: 'Your pickup and drop-off will be cleared.',
  keepEditing: 'Keep editing',
  discard: 'Discard',
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
  addStopOnMap: 'Choose stop on map',
  pinnedOnMap: 'Pinned on map',
  // UI-R9b: the full-screen centre-pin picker (passenger-destination-search block 5).
  mapPickLabel: (target: 'pickup' | 'destination' | 'stop') =>
    target === 'pickup' ? 'Pickup' : target === 'destination' ? 'Drop-off' : 'Stop',
  mapPickConfirm: (target: 'pickup' | 'destination' | 'stop') =>
    target === 'pickup' ? 'Confirm pickup' : target === 'destination' ? 'Confirm drop-off' : 'Add stop',
  mapPickFindingA11y: 'Finding the address',
  mapPickHint: 'Move the map to place the pin',
  // UI-R9b: stops reorder (passenger-destination-search Interactions).
  reorderStopA11y: (n: number) => `Reorder stop ${n}`,
  reorderStopHint: 'Long press and drag to move',
  moveStopUp: 'Move up',
  moveStopDown: 'Move down',
  // T-315: the booking map's inline "no location" state (no blocking alerts).
  locationWaitTitle: 'Finding your location',
  locationWaitBody: 'Allow location access so drivers can find your pickup.',
  locationOffTitle: 'Location is off',
  locationOffBody: 'Turn on location for Raah-e-Haq in Settings so drivers can find your pickup.',
  locationUnavailableTitle: "Can't find your location",
  locationUnavailableBody: 'Move to an open area or check your connection, then try again.',
  locationRetry: 'Try again',
  locationOpenSettings: 'Open settings',
  // T-580: location refused on the booking map: the map stays, the pickup is searched by hand.
  locationOffManualBody: 'Search for your pickup below or choose it on the map. Turn on location to start from where you are.',
  locationTurnOn: 'Turn on',
  // T-523: the booking sheet's own labels, so they follow the language too.
  pickupPlaceholder: 'Pickup location',
  destinationPlaceholder: 'Where to?',
  destinationA11y: 'Destination',
  clearA11y: 'Clear',
  useCurrentLocation: 'Use current location',
  swapA11y: 'Swap pickup and destination',
  addStop: 'Add a stop',
  stopLine: (n: number, address: string) => `Stop ${n}: ${address}`,
  removeStopA11y: (n: number) => `Remove stop ${n}`,
  dismissErrorA11y: 'Dismiss error',
  mapError: 'Map error. Please restart the app.',
  mapLoading: 'Loading map…',
  backA11y: 'Back',
  recenterA11y: 'Show my location',
  // T-575: planner title.
  planTitle: 'Plan your trip',
} as const);

/** `pick(BOOKING_COPY)` in every language, so a label set before a language switch is still known. */
const inEveryLocale = (pick: (copy: typeof BOOKING_COPY) => string): readonly string[] =>
  SUPPORTED_LOCALES.map(locale => pick(copyInLocale(BOOKING_COPY, locale)));

/**
 * Field texts that are labels, not addresses: typing in the field replaces them (T-551). T-575:
 * the labels of every language, so a "Current location" the field got before a switch to Roman
 * Urdu is still replaced on typing (and still shows the locate glyph).
 */
export const locationFieldLabels = (): readonly string[] => [
  ...inEveryLocale(copy => copy.currentLocation),
  ...inEveryLocale(copy => copy.pinnedOnMap),
];

/** True when `text` is the "Current location" label in any language (T-575). */
export const isCurrentLocationLabel = (text: string): boolean =>
  inEveryLocale(copy => copy.currentLocation).includes(text);
