import { localizedCopy } from '../../i18n/localizedCopy';

/**
 * Static copy for the driver's incoming ride requests (T-403/T-404). Every number on the card
 * comes from GET /rides/pending; only labels live here.
 */
export const DRIVER_REQUESTS_COPY = localizedCopy({
  loadFailed: 'Could not load ride requests',
  passengerFallback: 'Passenger',
  noRating: 'New rider',
  pickup: 'Pickup',
  dropoff: 'Drop-off',
  // T-552: the card lists the first stops; the rest are counted. T-553: one stop reads "Stop 3".
  moreStopsLabel: (from: number, to: number) =>
    from === to ? `Stop ${from}` : `Stops ${from}–${to}`,
  moreStops: (count: number) => `+${count} more ${count === 1 ? 'stop' : 'stops'}`,
  cash: 'Cash',
  // UI-R11 request sheet v2 (driver-incoming-request R7).
  decline: 'Decline',
  declineA11y: 'Decline this ride request',
  accept: 'Accept',
  accepting: 'Accepting…',
  acceptA11y: (seconds: number) => `Accept ride, ${seconds} seconds left`,
  secondsLeftA11y: (seconds: number) => `${seconds} seconds left`,
  youKeep: (net: string, rate: string) => `You keep ${net} · ${rate} commission`,
  youKeepNoRate: (net: string) => `You keep ${net}`,
  metricToPickup: 'to pickup',
  metricAway: 'away',
  metricTrip: 'trip',
  metricToPickupA11y: (value: string) => `${value} to pickup`,
  metricAwayA11y: (value: string) => `${value} away`,
  metricTripA11y: (value: string) => `${value} trip`,
  more: (count: number) => `+${count} more`,
  passengers: (count: number) => `${count} passengers`,
  taken: 'Another driver took this ride',
  gone: 'This ride is no longer available',
  arrivalA11y: (fare: string, minutes: number) => `New ride request, ${fare}, pickup ${minutes} minutes away`,
  arrivalNoEtaA11y: (fare: string) => `New ride request, ${fare}`,
  sheetA11y: 'Ride request',
  accepted: 'Ride accepted. Head to the pickup.',
  acceptFailed: "Couldn't accept the ride. Try again.",
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
} as const);
