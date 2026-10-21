import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSelector } from 'react-redux';
import { env } from '../../config/env';
import { readPublicSettings } from '../../core/api/publicSettings';
import type { RideResource } from '../../services/rideService';
import type { User } from '../../services/api';
import { logger } from '../../core/logging/logger';
import { realtime, type ChannelHandlers } from '../../core/realtime';
import { readRealtimeMeta, resolveRealtimeConfig, type RealtimeConfig } from '../../core/realtime/config';
import {
  DRIVER_EVENTS,
  driverChannel,
  RIDE_EVENTS,
  rideChannel,
  realtimeEvents,
  USER_EVENTS,
  userChannel,
  type RealtimeEventName,
} from '../../core/realtime/events';
import { currentSessionEpoch, isStaleSession, onSessionEpochChange } from '../../store/sessionEpoch';
import { useAppIsActive } from '../../hooks/useAppIsActive';
import { useConnectionRecovered } from '../../core/api/connectivity';
import { isRideInProgress } from '../active-ride/status';
import { isRestorableDriverRide } from '../driver-ride/steps';

/**
 * T-406: the realtime session of the signed-in user, mounted once per role (PassengerStack,
 * DriverStack). It reads GET /settings/public `meta.realtime` once per session and wants:
 *
 * - `private-user.{me}` while signed in;
 * - `private-driver.{me}` while the driver is online;
 * - `private-ride.{id}` while a ride is in progress and this user is its party: the passenger's
 *   in-progress ride; the driver's accepted/arrived/started ride assigned to them. It is left
 *   as soon as the ride ends, is cancelled or requeued away from the driver (SEC-35).
 *
 * Every event is only forwarded to `realtimeEvents`; the polling hooks run their usual read on
 * it. Logout ends it all: the stacks unmount, and the session epoch resets the manager.
 */

type Role = 'passenger' | 'driver';

interface SessionRoot {
  apiAuth: { user: User | null };
  activeRide: { ride: RideResource | null };
  driverRide: { ride: RideResource | null };
  driverStatus: { status: string | null };
}

/** Forwards each event of `events` to the in-process bus. */
const forward = (events: ReadonlyArray<RealtimeEventName>): ChannelHandlers => {
  const handlers: ChannelHandlers = {};
  events.forEach((event) => {
    handlers[event] = (payload) => realtimeEvents.emit(event, payload);
  });
  return handlers;
};

const USER_HANDLERS = forward(USER_EVENTS);
const DRIVER_HANDLERS = forward(DRIVER_EVENTS);
const RIDE_HANDLERS = forward(RIDE_EVENTS);

/** The realtime settings for this build, or null (server off, mismatch, no key): keep polling. */
export const loadRealtimeConfig = async (release: boolean = !__DEV__): Promise<RealtimeConfig | null> => {
  const resolved = resolveRealtimeConfig(readRealtimeMeta(await readPublicSettings()), env, { release });
  if (!resolved.ok) {
    logger.debug('[realtime] off, polling only', { reason: resolved.reason });
    return null;
  }
  return resolved.config;
};

const retryRealtimeNow = (): void => realtime.retryNow();

const selectUserId = (state: SessionRoot): number | null => state.apiAuth.user?.id ?? null;

/** The ride whose channel this user may listen to, or null. */
export const partyRideId = (role: Role, userId: number | null, state: SessionRoot): number | null => {
  if (userId === null) return null;
  if (role === 'passenger') {
    const ride = state.activeRide.ride;
    return ride && isRideInProgress(ride) && ride.passenger_id === userId ? ride.id : null;
  }
  const ride = state.driverRide.ride;
  return ride && isRestorableDriverRide(ride) && ride.driver_id === userId ? ride.id : null;
};

const isDriverOnline = (state: SessionRoot): boolean =>
  state.driverStatus.status === 'available' || state.driverStatus.status === 'on_ride';

export const useRealtimeSession = (role: Role): void => {
  const signedInUserId = useSelector(selectUserId);
  const epoch = useSyncExternalStore(onSessionEpochChange, currentSessionEpoch);
  // The session this user's realtime belongs to: the epoch when the user appeared. Logout bumps
  // the epoch before it clears the user (and awaits the server revoke in between); from that
  // moment nothing subscribes or reconnects for the old user.
  const [owner, setOwner] = useState({ userId: signedInUserId, epoch });
  if (owner.userId !== signedInUserId) {
    // Derived state (React's documented pattern): re-render at once with the new owner.
    setOwner({ userId: signedInUserId, epoch });
  }
  const userId = owner.userId === signedInUserId && owner.epoch === epoch ? signedInUserId : null;
  const appActive = useAppIsActive();
  const partyRide = useSelector((state: SessionRoot) => partyRideId(role, selectUserId(state), state));
  const online = useSelector((state: SessionRoot) => role === 'driver' && isDriverOnline(state));
  const rideId = userId === null ? null : partyRide;
  const driverOnline = userId !== null && online;

  // The server's settings, once per session (a failure is retried on the next foreground).
  useEffect(() => {
    if (userId === null || !appActive || realtime.isConfiguredFor(epoch)) return undefined;
    let live = true;
    loadRealtimeConfig()
      .then((config) => {
        if (live && !isStaleSession(epoch)) realtime.configure(config, epoch);
      })
      .catch((error: unknown) => {
        // Offline or a server error: polling carries on; retried on the next foreground.
        logger.debug('[realtime] settings read failed', { name: error instanceof Error ? error.name : typeof error });
      });
    return () => {
      live = false;
    };
  }, [userId, epoch, appActive]);

  // The network is back: reconnect now instead of waiting out the back-off (a 429 hold stays).
  useConnectionRecovered(retryRealtimeNow, userId !== null);

  useEffect(() => (userId === null ? undefined : realtime.subscribe(userChannel(userId), USER_HANDLERS)), [userId, epoch]);

  useEffect(
    () => (userId === null || !driverOnline ? undefined : realtime.subscribe(driverChannel(userId), DRIVER_HANDLERS)),
    [userId, driverOnline, epoch],
  );

  useEffect(() => (rideId === null ? undefined : realtime.subscribe(rideChannel(rideId), RIDE_HANDLERS)), [rideId, epoch]);
};
