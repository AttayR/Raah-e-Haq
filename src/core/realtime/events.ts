import { isRecord, readId, readNumberOrNull, readOneOf, readText } from '../api/read';
import type { DriverLocation, DriverLocationStatus } from '../../services/rideService';
import { logger } from '../logging/logger';

/**
 * T-406 / BE-12 broadcast events. Every event is a hint: the app reacts by running the read
 * it already polls with (GET /rides/{id}, messages after_id, notifications...), so handling the
 * same event twice, late or out of order is harmless. Payloads carry ids only, except the
 * driver location (same shape as GET /rides/{id}/driver-location).
 */

export const RIDE_EVENTS = ['ride.status', 'ride.accepted'] as const;
export const USER_EVENTS = ['ride.driver_location', 'chat.message', 'chat.read', 'notification.created'] as const;
export const DRIVER_EVENTS = ['ride.requested', 'ride.request_withdrawn'] as const;

export type RealtimeEventName =
  | (typeof RIDE_EVENTS)[number]
  | (typeof USER_EVENTS)[number]
  | (typeof DRIVER_EVENTS)[number];

/** The private channels (Echo names, without the `private-` prefix). */
export const rideChannel = (rideId: number): string => `ride.${rideId}`;
export const userChannel = (userId: number): string => `user.${userId}`;
export const driverChannel = (userId: number): string => `driver.${userId}`;

/** The ride id of a ride-scoped payload; null when there is none. */
export const readRideId = (payload: unknown): number | null => (isRecord(payload) ? readId(payload.ride_id) : null);

/** A `ride.driver_location` payload: its ride and the app's DriverLocation shape. */
export interface RealtimeDriverLocation {
  ride_id: number;
  location: DriverLocation;
}

const LOCATION_STATUSES: ReadonlyArray<DriverLocationStatus> = ['online', 'available', 'busy', 'offline'];

/** Null when the payload is unusable (missing ids or time, coordinates out of range). */
export const readDriverLocationEvent = (payload: unknown): RealtimeDriverLocation | null => {
  if (!isRecord(payload)) return null;
  const rideId = readId(payload.ride_id);
  const driverId = readId(payload.driver_id);
  const latitude = readNumberOrNull(payload.latitude);
  const longitude = readNumberOrNull(payload.longitude);
  const lastSeenAt = readText(payload.last_seen_at);
  if (rideId === null || driverId === null || latitude === null || longitude === null || lastSeenAt === null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return {
    ride_id: rideId,
    location: {
      driver_id: driverId,
      latitude,
      longitude,
      heading: readNumberOrNull(payload.heading),
      status: readOneOf(payload.status, LOCATION_STATUSES, 'online'),
      last_seen_at: lastSeenAt,
    },
  };
};

/**
 * In-process fan-out of received events to the hooks that poll (usePolling's `wake`, the
 * pending-requests loop, the driver-location reader). Listeners are removed by the function
 * `on` returns; a throwing listener never stops the others.
 */
type Listener = (payload: unknown) => void;
const listeners = new Map<RealtimeEventName, Set<Listener>>();

export const realtimeEvents = {
  on(event: RealtimeEventName, listener: Listener): () => void {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
    };
  },
  emit(event: RealtimeEventName, payload: unknown): void {
    const set = listeners.get(event);
    if (!set) return;
    [...set].forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        // A listener's bug must not stop the other listeners.
        logger.warn('[realtime] listener failed', { event, name: error instanceof Error ? error.name : typeof error });
      }
    });
  },
  /** Tests. */
  listenerCount(event: RealtimeEventName): number {
    return listeners.get(event)?.size ?? 0;
  },
};

/** A wake source for usePolling: calls `wake` on each `event` (for `rideId` when given). */
export type WakeSource = (wake: () => void) => () => void;

export const wakeOn = (events: ReadonlyArray<RealtimeEventName>, rideId?: number): WakeSource => (wake) => {
  const offs = events.map((event) =>
    realtimeEvents.on(event, (payload) => {
      if (rideId === undefined || readRideId(payload) === rideId) wake();
    }),
  );
  return () => offs.forEach((off) => off());
};
