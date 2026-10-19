import { localizedCopy } from '../../i18n/localizedCopy';

/**
 * User-facing copy of the active-ride flow (T-301). Static strings only, kept in one place so
 * they can move into the i18n catalogue (Urdu) as one unit. Server messages (a refused
 * request, a validation error) come from the API and are never written here.
 */
export const ACTIVE_RIDE_COPY = localizedCopy({
  requestingTitle: 'Creating Ride Request',
  requestingMessage: 'Please wait while we process your request…',
  requestFailedTitle: 'Ride Request Failed',
  requestFailedFallback: 'Failed to request ride',
  cancelFailedFallback: 'Failed to cancel ride',
  dismiss: 'OK',
  // T-304 stage panel
  searchingTitle: 'Finding you a driver…',
  driverCancelledRequeued: "Your driver cancelled. We're asking other drivers nearby.",
  // UI-R10: the finding-driver sheet (passenger-finding-driver.md).
  findingTitle: 'Finding you a driver',
  findingMessage: 'This usually takes under a minute.',
  findingSlowMessage: 'Still looking. More drivers are joining.',
  cancelRequest: 'Cancel request',
  cancelRequestTitle: 'Cancel request?',
  cancelRequestMessage: "We'll stop looking for a driver.",
  keepLooking: 'Keep looking',
  cashLabel: 'Cash',
  driverEnRouteTitle: 'Your driver is on the way',
  driverArrivedTitle: 'Your driver has arrived',
  driverArrivedMessage: 'Meet your driver at the pickup point',
  inTripTitle: 'Trip in progress',
  completedTitle: 'Ride completed',
  completedMessage: 'Thanks for riding with Raah-e-Haq.',
  cancelledTitle: 'Ride cancelled',
  cancelledByPassenger: 'You cancelled this ride.',
  cancelledByDriver: 'Your driver cancelled this ride.',
  cancelledBySystem: 'This ride was cancelled.',
  driverFallbackName: 'Your driver',
  driverMarkerTitle: 'Your driver',
  // T-549: follow the car again after the passenger moved the map.
  recentreA11y: 'Follow your ride on the map',
  // T-311: the completed summary is the server's final fare, not the booking estimate.
  finalFareLabel: 'Final fare',
  paymentLabel: (method: string) => (method === 'cash' ? 'Pay your driver in cash' : `Payment: ${method}`),
  cancelRide: 'Cancel ride',
  call: 'Call',
  done: 'Done',
  cancelConfirmTitle: 'Cancel Ride',
  cancelConfirmMessage: 'Are you sure you want to cancel this ride?',
  keepRide: 'Keep Ride',
  cancelFailedTitle: 'Error',
} as const);
