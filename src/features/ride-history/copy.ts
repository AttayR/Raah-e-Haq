import type { CancellationReason, RideStatus, RideViewer } from './types';
import { localizedCopy } from '../../i18n/localizedCopy';

/** Static copy for ride history and ride details (T-501). Rides and amounts come from GET /rides. */
export const RIDE_HISTORY_COPY = localizedCopy({
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
  emptyAction: 'Book a ride',
  emptyActionHint: 'Opens Where to?',
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
  cancellationFeeLabel: 'Cancellation fee',
  // Who cancelled, said from the viewer's side (T-575: was inline in cancellationText).
  cancelledByYou: 'You cancelled this ride.',
  cancelledByPassenger: 'The passenger cancelled this ride.',
  cancelledByDriver: 'The driver cancelled this ride.',
  cancelledBySystem: 'This ride was cancelled automatically.',
  cancelledByWeather: 'This ride was cancelled because of the weather.',
  cancelledUnknown: 'This ride was cancelled.',
  // T-579: the same lines on a parcel, said as a delivery.
  parcelCancelled: {
    byYou: 'You cancelled this delivery.',
    byPassenger: 'The sender cancelled this delivery.',
    byDriver: 'Your rider cancelled this delivery.',
    bySystem: 'This delivery was cancelled automatically.',
    byWeather: 'This delivery was cancelled because of the weather.',
    unknown: 'This delivery was cancelled.',
    noCharge: 'Cancelled deliveries are not charged.',
  },
  // UI-R15 share receipt.
  share: 'Share receipt',
  shareHeading: 'Raah-e-Haq ride receipt',
  shareFrom: (address: string) => `From: ${address}`,
  shareTo: (address: string) => `To: ${address}`,
  shareStop: (n: number, address: string) => `Stop ${n}: ${address}`,
  shareTotal: (amount: string, payment: string) => `Total: ${amount} · ${payment}`,
} as const);

export const RIDE_STATUS_LABEL: Record<RideStatus, string> = localizedCopy({
  requested: 'Finding driver',
  accepted: 'Driver on the way',
  arrived: 'Driver arrived',
  started: 'On trip',
  completed: 'Completed',
  cancelled: 'Cancelled',
});

export const TIMELINE_LABEL = localizedCopy({
  requested: 'Requested',
  accepted: 'Accepted',
  arrived: 'Driver arrived',
  started: 'Trip started',
  completed: 'Completed',
  cancelled: 'Cancelled',
} as const);

/** Vehicle type names (T-575: in the active language). */
export const VEHICLE_LABEL = localizedCopy({
  car: 'Car',
  bike: 'Bike',
  rickshaw: 'Rickshaw',
  van: 'Van',
  // T-561: the BE-86 / BE-88 tiers by their names, not their keys ("Car ac").
  car_ac: 'Car AC',
  parcel: 'Parcel',
} as const);

const isVehicleKey = (key: string): key is keyof typeof VEHICLE_LABEL =>
  Object.prototype.hasOwnProperty.call(VEHICLE_LABEL, key);

/** "car" -> "Car"; an unknown key is shown title-cased, never as a raw code. */
export const vehicleLabel = (type: string | null): string | null => {
  if (!type) return null;
  const key = type.toLowerCase();
  if (isVehicleKey(key)) return VEHICLE_LABEL[key];
  const words = type.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
};

/** The server's payment status in the active language (T-579); null when the server sends none. */
export const PAYMENT_STATUS_LABEL = localizedCopy({
  paid: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  refunded: 'Refunded',
} as const);

const isPaymentStatusKey = (key: string): key is keyof typeof PAYMENT_STATUS_LABEL =>
  Object.prototype.hasOwnProperty.call(PAYMENT_STATUS_LABEL, key);

/** "paid" -> "Paid" ("Ada ho gaya" in Roman Urdu); an unknown status is shown title-cased. */
export const paymentStatusLabel = (status: string | null): string | null => {
  if (!status) return null;
  const key = status.trim().toLowerCase();
  if (isPaymentStatusKey(key)) return PAYMENT_STATUS_LABEL[key];
  const words = status.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
};

/**
 * T-579: the booking's tier name. The server's display name wins whenever it sends one (BE-112:
 * stock names come translated, "Gaari" like Activity; an admin-renamed tier is shown as typed);
 * without one, the app's VEHICLE_LABEL in the active language, else the key title-cased.
 */
export const tierLabel = (key: string | null, serverLabel?: string | null): string | null => {
  const label = serverLabel?.trim();
  return label ? label : vehicleLabel(key);
};

/** Who cancelled, said from the viewer's side; a parcel (T-579) is said as a delivery. */
export const cancellationText = (reason: CancellationReason | null, viewer: RideViewer, parcel = false): string => {
  if (parcel) {
    const P = RIDE_HISTORY_COPY.parcelCancelled;
    switch (reason) {
      case 'passenger':
        return viewer === 'passenger' ? P.byYou : P.byPassenger;
      case 'driver':
        return viewer === 'driver' ? P.byYou : P.byDriver;
      case 'system':
        return P.bySystem;
      case 'weather':
        return P.byWeather;
      default:
        return P.unknown;
    }
  }
  switch (reason) {
    case 'passenger':
      return viewer === 'passenger' ? RIDE_HISTORY_COPY.cancelledByYou : RIDE_HISTORY_COPY.cancelledByPassenger;
    case 'driver':
      return viewer === 'driver' ? RIDE_HISTORY_COPY.cancelledByYou : RIDE_HISTORY_COPY.cancelledByDriver;
    case 'system':
      return RIDE_HISTORY_COPY.cancelledBySystem;
    case 'weather':
      return RIDE_HISTORY_COPY.cancelledByWeather;
    default:
      return RIDE_HISTORY_COPY.cancelledUnknown;
  }
};
