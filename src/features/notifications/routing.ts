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
  /** The driver's request feed (the Drive map, UI-R4). */
  | { kind: 'rideRequests' }
  /** The role's home tab. */
  | { kind: 'home' }
  /** The wallet (category `wallet`: top-ups, settlements, adjustments; T-515/T-514). */
  | { kind: 'wallet' }
  /** Nothing more specific: the notifications list. */
  | { kind: 'inbox' };

export interface TargetSource {
  category: NotificationCategory;
  type: string | null;
  rideId: number | null;
}

const ENDED_RIDE_TYPES = new Set(['ride_completed', 'ride_cancelled']);
/** BE-74 top-up results; also routed by type in case a push arrives without its category. */
const WALLET_TYPES = new Set(['topup_succeeded', 'topup_failed']);

export const resolveNotificationTarget = (
  { category, type, rideId }: TargetSource,
  role: NotificationRole,
): NotificationTarget => {
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
    if (type !== null && ENDED_RIDE_TYPES.has(type)) return { kind: 'home' };
    return { kind: 'ride', rideId };
  }
  if (type !== null && ENDED_RIDE_TYPES.has(type)) return { kind: 'rideHistory' };
  return { kind: 'ride', rideId };
};
