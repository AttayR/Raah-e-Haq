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
  // T-304 stage panel
  searchingTitle: 'Finding you a driver…',
  searchingMessage: 'Sharing your request with nearby drivers',
  driverCancelledRequeued: 'Your driver cancelled. Finding you another driver…',
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
  plate: (plate: string) => `Plate ${plate}`,
  // T-311: the completed summary is the server's final fare, not the booking estimate.
  finalFareLabel: 'Final fare',
  breakdownDistance: 'Distance',
  breakdownTime: 'Time',
  paymentLabel: (method: string) => (method === 'cash' ? 'Pay your driver in cash' : `Payment: ${method}`),
  cancelRide: 'Cancel ride',
  call: 'Call',
  done: 'Done',
  cancelConfirmTitle: 'Cancel Ride',
  cancelConfirmMessage: 'Are you sure you want to cancel this ride?',
  keepRide: 'Keep Ride',
  cancelFailedTitle: 'Error',
  callFailedTitle: 'Unable to call',
  callFailedMessage: 'Your device could not start the call.',
} as const;
