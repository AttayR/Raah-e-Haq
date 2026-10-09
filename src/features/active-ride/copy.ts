/**
 * User-facing copy of the active-ride flow (T-301). Static strings only, kept in one place so
 * they can move into the i18n catalogue (Urdu) as one unit. Server messages (a refused
 * request, a validation error) come from the API and are never written here.
 */
export const ACTIVE_RIDE_COPY = {
  requestingTitle: 'Creating Ride Request',
  requestingMessage: 'Please wait while we process your request...',
  requestFailedTitle: 'Ride Request Failed',
  requestFailedFallback: 'Failed to request ride',
  cancelFailedFallback: 'Failed to cancel ride',
  dismiss: 'OK',
  completedTitle: 'Ride completed',
  completedMessage: 'Thanks for riding with Raah-e-Haq.',
  cancelledTitle: 'Ride cancelled',
  cancelledMessage: 'This ride was cancelled.',
} as const;
