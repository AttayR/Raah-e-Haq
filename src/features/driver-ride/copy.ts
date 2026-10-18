import { localizedCopy } from '../../i18n/localizedCopy';

/**
 * Static copy for the driver ride screen (T-405). Every number (fare, earnings, distance) comes
 * from the server's RideResource; only labels live here.
 */
export const DRIVER_RIDE_COPY = localizedCopy({
  screenA11y: 'Current ride',
  back: 'Back',
  recentreA11y: 'Show the route to your next point',
  // Step titles.
  toPickup: 'Head to pickup',
  atPickup: 'Waiting for the passenger',
  /** T-567: a parcel pickup waits for the sender, not a passenger. */
  atPickupParcel: 'Waiting for the sender',
  onTrip: 'On trip',
  summary: 'Trip complete',
  cancelled: 'Ride cancelled',
  cancelledBody: 'This ride is no longer assigned to you.',
  unknown: 'Checking the ride…',
  noRide: 'You have no active ride.',
  backToMap: 'Back to map',
  openRide: 'Open ride',
  openRideA11y: 'Open your current ride',
  rideInProgress: 'Ride in progress',
  // Labels.
  passengerFallback: 'Passenger',
  /** T-569: the person on a parcel ride is the sender. */
  senderFallback: 'Sender',
  noRating: 'New rider',
  pickup: 'Pickup',
  dropoff: 'Drop-off',
  stop: 'Stop',
  nextStop: 'Next stop',
  call: 'Call',
  callA11y: 'Call the passenger',
  message: 'Message',
  messageA11y: 'Message the passenger',
  callA11yParcel: 'Call the sender',
  messageA11yParcel: 'Message the sender',
  navigate: 'Navigate',
  navigateA11y: 'Open directions in the maps app',
  // Actions.
  arrived: "I've arrived",
  start: 'Start trip',
  complete: 'Complete trip',
  completeStop: 'Stop done',
  cancel: 'Cancel ride',
  /** T-559: in the footer row on small phones. */
  cancelShort: 'Cancel',
  working: 'Please wait…',
  done: 'Done',
  // Summary.
  totalFare: 'Total fare',
  collectCash: 'Collect in cash',
  collectOther: 'Paid by',
  yourEarnings: 'Your earnings',
  base: 'Base fare',
  distance: 'Distance',
  time: 'Time',
  stopsFare: 'Stops',
  minFareAdjustment: 'Minimum fare adjustment',
  km: 'km',
  minutes: 'min',
  // Cancel sheet.
  cancelTitle: 'Why are you cancelling?',
  cancelHint: 'The passenger will see this reason.',
  cancelPlaceholder: 'For example: the passenger is not at the pickup',
  cancelHintParcel: 'The sender will see this reason.',
  cancelPlaceholderParcel: 'For example: the sender is not at the pickup',
  cancelTooShort: 'Please write at least 3 characters.',
  cancelSubmit: 'Cancel ride',
  cancelKeep: 'Keep ride',
  // Toasts.
  arrivedDone: 'The passenger knows you have arrived.',
  /** T-567: the parcel sender is told instead. */
  arrivedDoneParcel: 'The sender knows you have arrived.',
  startedDone: 'Trip started.',
  completedDone: 'Trip complete.',
  stopDone: 'Stop marked as done.',
  cancelledDone: 'Ride cancelled.',
  actionFailed: 'Could not update the ride. Please try again.',
  refreshFailed: 'Could not refresh the ride.',
  changedElsewhere: 'The ride changed. Showing the latest status.',
  notAssigned: 'This ride is no longer assigned to you.',
  cannotCancel: 'The ride can only be cancelled before the trip starts.',
  notNearPickup: 'You are not at the pickup yet.',
  /**
   * Appended to the not-near-pickup message; `{distance}` is the server's distance, in metres
   * below 1 km and in km from there (T-556: "About 1737 m away" read badly).
   */
  aboutAway: 'About {distance} away.',
  metres: '{m} m',
  navigateFailed: 'Could not open the maps app.',
} as const);
