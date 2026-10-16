import type { CancellationReason, RideStatus, RideViewer } from './types';

/** Static copy for ride history and ride details (T-501). Rides and amounts come from GET /rides. */
export const RIDE_HISTORY_COPY = {
  title: 'Ride history',
  back: 'Back',
  retry: 'Try again',
  filterLabel: 'Show',
  filterAll: 'All',
  filterCompleted: 'Completed',
  filterCancelled: 'Cancelled',
  loadFailed: "Couldn't load your rides",
  emptyTitle: { passenger: 'No rides yet', driver: 'No trips yet' } as Record<RideViewer, string>,
  emptyBody: {
    passenger: 'Your trips will show up here.',
    driver: 'Go online to start getting trips.',
  } as Record<RideViewer, string>,
  emptyFilteredTitle: { completed: 'No completed rides', cancelled: 'No cancelled rides' },
  endOfList: "That's all your rides",
  noCharge: 'No charge',
  stops: (n: number) => (n === 1 ? '+1 stop' : `+${n} stops`),
  rowLabel: (date: string, status: string, from: string, to: string, amount: string) =>
    [date, status, `from ${from}`, `to ${to}`, amount].filter(Boolean).join(', '),
  openHint: 'Opens the ride details',
  // Details.
  detailsTitle: 'Ride details',
  detailsFailed: "Couldn't load this ride",
  unavailableTitle: "This ride isn't available",
  unavailableBody: 'It may have been removed, or it belongs to another account.',
  goBack: 'Back',
  route: 'Route',
  pickup: 'Pickup',
  dropoff: 'Drop-off',
  stop: (n: number) => `Stop ${n}`,
  yourDriver: 'Your driver',
  yourPassenger: 'Your passenger',
  rider: 'Rider',
  message: 'Message',
  messageHint: 'Opens the chat for this ride',
  receipt: 'Receipt',
  fareBase: 'Base fare',
  fareDistance: 'Distance',
  fareTime: 'Time',
  fareStops: 'Stops',
  fareMinimum: 'Minimum fare adjustment',
  total: 'Total',
  platformFee: 'Raah-e-Haq fee',
  youEarned: 'Your earnings',
  paymentMethod: 'Payment',
  paymentCash: { passenger: 'Cash (paid to driver)', driver: 'Cash (collected by you)' } as Record<RideViewer, string>,
  paymentStatus: 'Payment status',
  rideCode: 'Ride ID',
  date: 'Date',
  timeline: 'Timeline',
  cancellation: 'Cancellation',
  cancellationNote: 'Note',
  noChargeCancelled: 'Cancelled rides are not charged.',
} as const;

export const RIDE_STATUS_LABEL: Record<RideStatus, string> = {
  requested: 'Requested',
  accepted: 'Driver on the way',
  arrived: 'Driver arrived',
  started: 'On trip',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const TIMELINE_LABEL = {
  requested: 'Requested',
  accepted: 'Accepted',
  arrived: 'Driver arrived',
  started: 'Trip started',
  completed: 'Completed',
  cancelled: 'Cancelled',
} as const;

const VEHICLE_LABEL: Record<string, string> = {
  car: 'Car',
  bike: 'Bike',
  rickshaw: 'Rickshaw',
  van: 'Van',
  // T-561: the BE-86 / BE-88 tiers by their names, not their keys ("Car ac").
  car_ac: 'Car AC',
  parcel: 'Parcel',
};

/** "car" -> "Car"; an unknown key is shown title-cased, never as a raw code. */
export const vehicleLabel = (type: string | null): string | null => {
  if (!type) return null;
  const known = VEHICLE_LABEL[type.toLowerCase()];
  if (known) return known;
  const words = type.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
};

/** Who cancelled, said from the viewer's side. */
export const cancellationText = (reason: CancellationReason | null, viewer: RideViewer): string => {
  switch (reason) {
    case 'passenger':
      return viewer === 'passenger' ? 'You cancelled this ride.' : 'The passenger cancelled this ride.';
    case 'driver':
      return viewer === 'driver' ? 'You cancelled this ride.' : 'The driver cancelled this ride.';
    case 'system':
      return 'This ride was cancelled automatically.';
    case 'weather':
      return 'This ride was cancelled because of the weather.';
    default:
      return 'This ride was cancelled.';
  }
};
