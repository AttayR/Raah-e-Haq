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
  // UI-R12 PA2: short enough to sit on one line beside the ETA tile.
  driverEnRouteTitle: 'Driver is on the way',
  driverArrivedTitle: 'Your driver is here',
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
  // UI-R12 PA4: sentence case; the server's fee preview follows the message.
  cancelConfirmTitle: 'Cancel ride?',
  cancelConfirmMessage: 'Your driver is already on the way.',
  cancelConfirmMessageArrived: 'Your driver is waiting for you.',
  keepRide: 'Keep ride',
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
  // UI-R12 trip sheet (shared-trip-sheet.md; passenger-driver-assigned / -trip-in-progress / -trip-complete).
  meetAt: (place: string) => `Meet at ${place}`,
  meetDriverAt: (place: string) => `Meet your driver at ${place}`,
  locationStale: (minutes: number) => `Location updated ${minutes} min ago`,
  offlineLastUpdate: "You're offline. Showing the last update.",
  headingTo: (place: string) => `Heading to ${place}`,
  headingToStop: (n: number) => `Heading to stop ${n}`,
  arrivingAt: (time: string) => `Arriving at ${time}`,
  driverFoundA11y: (details: string, minutes: number | null) =>
    `Driver found. ${details}.${minutes !== null ? ` ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} away.` : ''}`,
  driverHereA11y: (plate: string | null) => (plate ? `Your driver is here. Plate ${plate}.` : 'Your driver is here.'),
  tripStartedA11y: (time: string | null) => (time ? `Trip started. Arriving at ${time}.` : 'Trip started.'),
  nextStopA11y: (n: number) => `Next stop ${n}`,
  plateA11y: (plate: string) => `plate ${plate}`,
  shareCell: 'Share trip',
  sharingCell: 'Sharing',
  sharingCellA11y: 'Sharing your trip live. Opens sharing options.',
  shareDialogTitle: "You're sharing this trip",
  shareDialogBody: 'Anyone with the link can follow your ride until it ends.',
  shareAgain: 'Share link again',
  stopSharing: 'Stop sharing',
  sharingRow: 'Sharing your trip live',
  stopShort: 'Stop',
  safetyA11y: 'Safety',
  pickupLabel: 'Pickup',
  pickedUpLabel: 'Picked up',
  stopLabel: (n: number) => `Stop ${n}`,
  stopDoneLabel: (n: number) => `Stop ${n} · done`,
  nextStopLabel: 'Next stop',
  dropoffLabel: 'Drop-off',
  // Receipt (passenger-trip-complete PR2–PR6).
  arrivedTitle: "You've arrived",
  arrivedA11y: (fare: string | null) => (fare ? `You've arrived. Pay ${fare} in cash.` : "You've arrived."),
  payDriverCash: 'Pay your driver in cash',
  moneyA11y: (caption: string, fare: string, fixed: boolean) => `${caption}, ${fare}${fixed ? ', fixed fare' : ''}`,
  fareDetails: 'Fare details',
  fareLater: 'Fare will appear in your ride history.',
  cancellationFee: 'Cancellation fee',
  rateWith: (name: string) => `How was your ride with ${name}?`,
  youRated: 'You rated this ride',
  submitRating: 'Submit rating',
  receiptDone: 'Done',
  ratingThanks: 'Thanks for your feedback',
  ratingFailed: "Couldn't send your rating. Try again.",
  offlineAction: "You're offline",
} as const);
