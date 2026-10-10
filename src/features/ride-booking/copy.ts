/**
 * Static copy of the booking flow (T-302). Server messages (a refused request, a 422 field
 * message, a failed estimate) come from the API and are never written here.
 */
export const BOOKING_COPY = {
  vehicleTypesLoading: 'Loading vehicle types…',
  vehicleTypesFailed: 'Could not load vehicle types.',
  vehicleTypesEmpty: 'No vehicle types are available right now.',
  estimateLoading: 'Calculating fare…',
  estimateFailed: 'Could not calculate the fare.',
  fareUnavailable: '—',
  retry: 'Retry',
  seats: (n: number) => (n === 1 ? '1 seat' : `${n} seats`),
  breakdownBase: 'Base fare',
  breakdownDistance: (km: number) => `Distance (${km} km)`,
  breakdownTime: (min: number) => `Time (${min} min)`,
  breakdownStops: 'Stops',
  breakdownMinimum: 'Minimum fare adjustment',
  // T-311: the booking price is the server's quote; the final fare is set when the trip ends.
  estimatedFareTitle: 'Estimated fare',
  fareBreakdownTitle: 'Fare breakdown',
  estimatedTotal: 'Estimated total',
  estimateNote: 'Your final fare is calculated when the trip ends.',
  tripSummary: (km: number, min: number) => `${km} km • ${min} min`,
  phoneNotVerifiedTitle: 'Verify your phone number',
  phoneNotVerifiedAction: 'Verify number',
  notNow: 'Not now',
  chooseOnMap: 'Choose on map',
  addStopOnMap: '+ Add via map',
  pinnedOnMap: 'Pinned on map',
  mapPickHint: (target: 'pickup' | 'destination' | 'stop') =>
    target === 'pickup' ? 'Tap the map to set your pickup' : target === 'destination' ? 'Tap the map to set your destination' : 'Tap the map to add a stop',
  mapPickCancel: 'Cancel',
} as const;
