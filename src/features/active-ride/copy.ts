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
  // T-584: the toast after a request is cancelled (back to Home, no "Ride cancelled" panel).
  requestCancelled: 'Request cancelled',
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
  // T-585: a cancel the server refused or that got no answer (passenger-finding-driver.md).
  cancelFailedToast: "Couldn't cancel. Try again.",
  // T-583 (BE-113): Request found a booking already open; that one is shown.
  alreadyActiveTitle: 'You already have a booking',
  alreadyActiveMessage: 'Here it is. Cancel it before you book again.',
  // T-583 (BE-114): the server ended a request no driver accepted in time (no fee).
  noDriverTitle: 'No driver found',
  noDriverMessage: 'No driver accepted your ride in time. You were not charged.',
  noRiderTitle: 'No rider found',
  noRiderMessage: 'No rider accepted your delivery in time. You were not charged.',
  tryAgain: 'Try again',
  close: 'Close',
} as const);
