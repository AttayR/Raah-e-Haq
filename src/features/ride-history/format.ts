import { t } from '../../i18n';
import { formatDistance, formatDuration, formatMoney, formatRelativeDate, formatTime } from '../../utils/format';
import { RIDE_HISTORY_COPY, RIDE_STATUS_LABEL, TIMELINE_LABEL, vehicleLabel } from './copy';
import type { Ride, RidePerson, RideStatus, RideViewer } from './types';

/**
 * How long an ended ride's chat stays readable. Mirrors the backend's
 * `rides.chat.read_window_hours` (BE-13, default 24); the server stays the authority (410
 * chat_expired), this only decides whether the "Message" link is worth showing.
 */
export const CHAT_READ_WINDOW_HOURS = 24;

const ACTIVE: ReadonlySet<RideStatus> = new Set(['accepted', 'arrived', 'started']);

/** The moment a ride is listed under: when it ended, else when it was booked. */
export const rideTime = (ride: Ride): string | null =>
  ride.completedAt ?? ride.cancelledAt ?? ride.requestedAt ?? ride.createdAt;

/** "Today · 2:30 PM", "Mon, 28 Sep · 9:10 AM"; '' without a valid time. */
export const formatDateTime = (value: string | null): string => {
  const date = formatRelativeDate(value);
  const time = formatTime(value);
  return [date, time].filter(Boolean).join(' · ');
};

/**
 * The amount a row and the summary show: the fare for the passenger, the earnings for the
 * driver. A cancelled ride shows the passenger the fee they were charged (BE-85
 * `cancellation_fee` > 0, "Rs 50 fee", T-543), else "No charge".
 */
/** BE-85: a cancelled ride the passenger was charged a fee for (the driver sees "No charge"). */
export const isChargedFee = (ride: Pick<Ride, 'status' | 'cancellationFee'>, viewer: RideViewer): boolean =>
  ride.status === 'cancelled' && viewer === 'passenger' && ride.cancellationFee !== null && ride.cancellationFee > 0;

export const rideAmountText = (ride: Ride, viewer: RideViewer): string => {
  if (ride.status === 'cancelled') {
    return viewer === 'passenger' && ride.cancellationFee !== null && ride.cancellationFee > 0
      ? t('fare.feeCharged', { amount: formatMoney(ride.cancellationFee) })
      : RIDE_HISTORY_COPY.noCharge;
  }
  if (viewer === 'driver' && ride.status === 'completed' && ride.driverEarnings !== null) {
    return formatMoney(ride.driverEarnings);
  }
  return formatMoney(ride.totalFare);
};

/** The other party: the driver for a passenger, the passenger for a driver. */
export const otherParty = (ride: Ride, viewer: RideViewer): RidePerson | null =>
  viewer === 'passenger' ? ride.driver : ride.passenger;

/**
 * Whether the ride's chat can still be opened: a driver was assigned, and the ride is active
 * or ended less than CHAT_READ_WINDOW_HOURS ago.
 */
export const canOpenChat = (ride: Ride, now: Date = new Date()): boolean => {
  if (ride.driverId === null) return false;
  if (ACTIVE.has(ride.status)) return true;
  const endedAt = ride.status === 'completed' ? ride.completedAt : ride.status === 'cancelled' ? ride.cancelledAt : null;
  if (!endedAt) return false;
  const ended = new Date(endedAt).getTime();
  if (Number.isNaN(ended)) return false;
  return now.getTime() < ended + CHAT_READ_WINDOW_HOURS * 60 * 60 * 1000;
};

export type TimelineStep = { key: keyof typeof TIMELINE_LABEL; label: string; at: string };

/** The ride's steps that have a time, in order. */
export const timelineSteps = (ride: Ride): TimelineStep[] => {
  const steps: Array<[TimelineStep['key'], string | null]> = [
    ['requested', ride.requestedAt ?? ride.createdAt],
    ['accepted', ride.acceptedAt],
    ['arrived', ride.arrivedAt],
    ['started', ride.startedAt],
    ['completed', ride.completedAt],
    ['cancelled', ride.cancelledAt],
  ];
  return steps
    .filter((step): step is [TimelineStep['key'], string] => !!step[1])
    .map(([key, at]) => ({ key, label: TIMELINE_LABEL[key], at }));
};

/** "Paid", "Pending"; null when the server sends none. */
export const titleCase = (value: string | null): string | null => {
  if (!value) return null;
  const words = value.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
};

export interface RideSection {
  /** The local day (`2026-9-18`), or `undated`. */
  key: string;
  /** "Today", "Yesterday", "Mon, 28 Sep" (with the year outside this year); '' when undated. */
  title: string;
  data: Ride[];
}

const localDayKey = (value: string | null): string => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'undated';
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

/**
 * UI-R15: newest-first rides grouped by the local day they are listed under (`rideTime`),
 * keeping the server's order. A later page that continues the same day joins its section; a
 * day that comes back later in the order (out-of-order data) gets its own section.
 */
export const groupRidesByDay = (rides: ReadonlyArray<Ride>, now: Date = new Date()): RideSection[] => {
  const sections: RideSection[] = [];
  const used = new Map<string, number>();
  rides.forEach((ride) => {
    const at = rideTime(ride);
    const day = localDayKey(at);
    const last = sections[sections.length - 1];
    if (last && last.key.split('#')[0] === day) {
      last.data.push(ride);
      return;
    }
    const seen = used.get(day) ?? 0;
    used.set(day, seen + 1);
    sections.push({ key: seen === 0 ? day : `${day}#${seen}`, title: formatRelativeDate(at, now), data: [ride] });
  });
  return sections;
};

/**
 * UI-R15: the text receipt the details screen shares through the OS share sheet. Only what the
 * receipt itself shows: when, status, route, vehicle, distance and time, the amount and the
 * ride code. Never a name, phone number or rating.
 */
export const receiptShareText = (ride: Ride, viewer: RideViewer): string => {
  const metrics = [
    vehicleLabel(ride.vehicleType),
    formatDistance(ride.distanceKm),
    ride.durationMinutes ? formatDuration(ride.durationMinutes) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const amount = rideAmountText(ride, viewer);
  const lines = [
    RIDE_HISTORY_COPY.shareHeading,
    formatDateTime(rideTime(ride)),
    RIDE_STATUS_LABEL[ride.status],
    RIDE_HISTORY_COPY.shareFrom(ride.pickupAddress),
    ...ride.stops.map((stop, i) => RIDE_HISTORY_COPY.shareStop(i + 1, stop.address)),
    RIDE_HISTORY_COPY.shareTo(ride.dropoffAddress),
    metrics,
    ride.status === 'cancelled' ? amount : RIDE_HISTORY_COPY.shareTotal(amount, RIDE_HISTORY_COPY.paymentCash[viewer]),
    ride.rideCode ? `${RIDE_HISTORY_COPY.rideCode}: ${ride.rideCode}` : '',
  ];
  return lines.filter(Boolean).join('\n');
};
