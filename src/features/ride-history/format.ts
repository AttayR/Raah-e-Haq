import { formatMoney, formatRelativeDate, formatTime } from '../../utils/format';
import { RIDE_HISTORY_COPY, TIMELINE_LABEL } from './copy';
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
 * driver. A cancelled ride shows "No charge" (the API has no cancellation fee).
 */
export const rideAmountText = (ride: Ride, viewer: RideViewer): string => {
  if (ride.status === 'cancelled') return RIDE_HISTORY_COPY.noCharge;
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
