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
  tripSummary: (km: number, min: number) => `${km} km • ${min} min`,
  phoneNotVerifiedTitle: 'Verify your phone number',
  phoneNotVerifiedAction: 'Verify number',
  notNow: 'Not now',
} as const;
