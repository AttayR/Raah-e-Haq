/**
 * Static copy for the driver's incoming ride requests (T-403/T-404). Every number on the card
 * comes from GET /rides/pending; only labels live here.
 */
export const DRIVER_REQUESTS_COPY = {
  title: 'New Ride Request',
  loading: 'Looking for ride requests…',
  empty: 'No ride requests nearby right now',
  loadFailed: 'Could not load ride requests',
  retry: 'Retry',
  passengerFallback: 'Passenger',
  noRating: 'New rider',
  pickup: 'Pickup',
  dropoff: 'Drop-off',
  toPickup: 'to pickup',
  away: 'away',
  minutesShort: 'min',
  km: 'km',
  currency: 'PKR',
  cash: 'Cash',
  accept: 'Accept',
  accepting: 'Accepting…',
  reject: 'Reject',
  rejectA11y: 'Reject this ride request',
  accepted: 'Ride accepted. Head to the pickup.',
  acceptFailed: 'Could not accept the ride. Please try again.',
  // Pending feed refusals (BE-02).
  locationRequired: 'Share your location to see ride requests.',
  noApprovedVehicle: 'You need an approved vehicle to see ride requests.',
  driverNotAvailable: 'Go online to see ride requests.',
  driverOnRide: 'Finish your current ride to see new requests.',
  // Accept refusals (BE-03).
  alreadyAccepted: 'Another driver already took this ride.',
  rideNotAvailable: 'This ride is no longer available.',
  acceptOnRide: 'You already have a ride in progress.',
  acceptNotAvailable: 'You are offline. Go online to accept rides.',
  acceptNoVehicle: 'You need an approved vehicle to accept rides.',
  phoneNotVerified: 'Verify your phone number to accept rides.',
} as const;
