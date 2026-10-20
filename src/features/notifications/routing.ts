import type { NotificationCategory } from './types';

export type NotificationRole = 'passenger' | 'driver';

/**
 * Where opening a notification (a list row or a tapped push) leads. Pure, so it is tested
 * without navigation; navigation.ts turns it into a route for each role.
 */
export type NotificationTarget =
  /** The ride's chat thread (BE-13 `chat_message`). */
  | { kind: 'chat'; rideId: number }
  /** The ride in progress (passenger booking screen / driver ride screen). */
  | { kind: 'ride'; rideId: number | null }
  /** A finished or cancelled ride (passenger history). */
  | { kind: 'rideHistory' }
  /** T-581: one ride's static details (a ride notification whose ride is no longer live). */
  | { kind: 'rideDetails'; rideId: number }
  /** The driver's request feed (the Drive map, UI-R4). */
  | { kind: 'rideRequests' }
  /** The role's home tab. */
  | { kind: 'home' }
  /** The driver's Earnings tab (BE-73 "Trip completed. Collect Rs X in cash", T-514). */
  | { kind: 'earnings' }
  /** The wallet (category `wallet`: top-ups, settlements, adjustments; T-515/T-514). */
  | { kind: 'wallet' }
  /** BE-130 `support`: an agent replied to this request (UI-R18 thread). */
  | { kind: 'supportTicket'; ticketId: number }
  /** A `support` notification without a request id: Help & support. */
  | { kind: 'support' }
  /** Nothing more specific: the notifications list. */
  | { kind: 'inbox' };

export interface TargetSource {
  category: NotificationCategory;
  type: string | null;
  rideId: number | null;
  /** BE-85 `requeued`: the cancelled-by-driver ride is back in the queue (passenger: still live). */
  requeued?: boolean;
  /** BE-93 push `ride_status`: the ride's API status when the push was sent (null when absent). */
  rideStatus?: string | null;
  /** BE-114 `reason: no_driver`: the request expired unanswered. */
  noDriver?: boolean;
  /** BE-130 `support`: the request's id (`ticket_id`). */
  ticketId?: number | null;
}

/** BE-130: an agent replied to a support request (`data.ticket_id`). */
export const SUPPORT_TYPE = 'support';

const ENDED_RIDE_TYPES = new Set(['ride_completed', 'ride_cancelled']);
/** BE-74 top-up results; also routed by type in case a push arrives without its category. */
const WALLET_TYPES = new Set(['topup_succeeded', 'topup_failed']);

export const resolveNotificationTarget = (
  { category, type, rideId, requeued = false, rideStatus = null, noDriver = false, ticketId = null }: TargetSource,
  role: NotificationRole,
): NotificationTarget => {
  if (type === SUPPORT_TYPE) {
    return ticketId ? { kind: 'supportTicket', ticketId } : { kind: 'support' };
  }
  if ((category === 'chat' || type === 'chat_message') && rideId !== null) {
    return { kind: 'chat', rideId };
  }
  if (category === 'wallet' || (type !== null && WALLET_TYPES.has(type))) {
    return { kind: 'wallet' };
  }
  if (category !== 'ride') {
    return { kind: 'inbox' };
  }
  if (role === 'driver') {
    if (type === 'new_ride_request') return { kind: 'rideRequests' };
    // BE-73: the driver's "Trip completed. Collect Rs X" opens what the trip earned.
    if (type === 'ride_completed') return { kind: 'earnings' };
    if (type !== null && ENDED_RIDE_TYPES.has(type)) return { kind: 'home' };
    return { kind: 'ride', rideId };
  }
  // T-521: "Your driver cancelled. Your ride is back in the queue" opens the live ride (finding
  // another driver), not the history. T-546: a push says so with requeued "true", or with the
  // ride back in `requested` (BE-93 ride_status).
  if (type === 'ride_cancelled' && (requeued || rideStatus === 'requested')) return { kind: 'ride', rideId };
  // T-583 (BE-114): "No driver found" opens that ride: its "No driver found" state while the
  // booking screen still shows it, else its details (confirmPassengerLiveRide decides).
  if (type === 'ride_cancelled' && noDriver && rideId !== null) return { kind: 'ride', rideId };
  if (type !== null && ENDED_RIDE_TYPES.has(type)) return { kind: 'rideHistory' };
  return { kind: 'ride', rideId };
};
