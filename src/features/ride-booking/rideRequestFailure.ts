import { rejectionMessage, type ThunkRejection } from '../../core/api/errors';
import { isStaleSessionRejection } from '../../store/thunks/apiThunks';
import { offerBandFromExtra } from '../fare/api';
import type { OfferBand } from '../fare/types';

/** BE-37: POST /rides refuses a passenger whose phone is not verified (403, error.code). */
export const PHONE_NOT_VERIFIED = 'PHONE_NOT_VERIFIED';
/** BE-85: POST /rides refuses a passenger who owes more than the limit (403, error.amount_owed). */
export const PASSENGER_BALANCE_OWED = 'PASSENGER_BALANCE_OWED';
/** BE-113: the passenger already has an open ride or parcel (409, `error.ride_id`). */
export const RIDE_ALREADY_ACTIVE = 'RIDE_ALREADY_ACTIVE';
/** BE-129: the passenger's account deletion is scheduled (423); "Keep my account" is offered. */
export const ACCOUNT_DELETION_SCHEDULED = 'ACCOUNT_DELETION_SCHEDULED';
/** 429 after 5 unaccepted requests cancelled within 30 minutes; `retry_after` seconds to wait. */
export const BOOKING_COOLDOWN = 'BOOKING_COOLDOWN';

/**
 * What the booking screen does with a refused POST /rides:
 * - `phone_not_verified`: send the passenger to verify their number (BE-37);
 * - `handled`: nothing to show (a stale session after logout, or 403 ACCOUNT_*, which the API
 *   client already routes to the account status screen, T-106);
 * - `balance_owed`: "You owe Rs X. Top up to book" with a top-up (BE-85);
 * - `offer_out_of_band`: the offer was outside the server's band (BE-83 422 `offered_fare`); the
 *   message is the server's and `band` (from `error.offer_band`, null if absent) resets the stepper;
 * - `deletion_scheduled`: BE-129 423, the account is in its deletion cooling-off period; the
 *   caller offers "Keep my account" (features/account-deletion offerKeepAccount);
 * - `cooldown`: 429 BOOKING_COOLDOWN, the passenger cancelled too many unaccepted requests; the
 *   server's message is shown and booking is held for `retryAfter` seconds (bookingCooldown),
 *   never retried automatically;
 * - `already_active`: BE-113, the passenger already has an open booking (`rideId`, GET
 *   /rides/{id}); the app opens it instead of showing an error;
 * - `message`: show the server's text (for a 422 the first field message, e.g. "The selected
 *   vehicle type is invalid.", not the generic "Validation failed"). `uncertain` (T-583): no
 *   answer came back (network, timeout), so the server may have created the ride; a retry of the
 *   same booking reuses its Idempotency-Key.
 */
export type RideRequestFailure =
  | { kind: 'phone_not_verified'; message: string }
  | { kind: 'balance_owed'; message: string; amountOwed: number | null; limit: number | null }
  | { kind: 'offer_out_of_band'; message: string; band: OfferBand | null }
  | { kind: 'already_active'; message: string; rideId: number }
  | { kind: 'cooldown'; message: string; retryAfter: number | null }
  | { kind: 'deletion_scheduled' }
  | { kind: 'handled' }
  | { kind: 'message'; message: string; uncertain?: boolean };

const firstFieldError = (rejection: ThunkRejection): string | null => {
  for (const messages of Object.values(rejection.fieldErrors ?? {})) {
    const first = messages.find((m) => typeof m === 'string' && m.trim());
    if (first) return first;
  }
  return null;
};

export const classifyRideRequestFailure = (
  rejection: ThunkRejection | undefined,
  fallback: string,
): RideRequestFailure => {
  if (!rejection || isStaleSessionRejection(rejection)) {
    return rejection ? { kind: 'handled' } : { kind: 'message', message: fallback };
  }
  if (rejection.code === PHONE_NOT_VERIFIED) {
    return { kind: 'phone_not_verified', message: rejectionMessage(rejection, fallback) };
  }
  if (rejection.code === PASSENGER_BALANCE_OWED) {
    const owed = rejection.extra?.amount_owed;
    const limit = rejection.extra?.limit;
    return {
      kind: 'balance_owed',
      message: rejectionMessage(rejection, fallback),
      amountOwed: typeof owed === 'number' && owed > 0 ? owed : null,
      limit: typeof limit === 'number' ? limit : null,
    };
  }
  if (rejection.code === BOOKING_COOLDOWN) {
    // Top-level retry_after or the Retry-After header (core/api/errors), else the nested one.
    const wait = rejection.retryAfter ?? rejection.extra?.retry_after;
    return {
      kind: 'cooldown',
      message: rejectionMessage(rejection, fallback),
      retryAfter: typeof wait === 'number' && wait > 0 ? wait : null,
    };
  }
  if (rejection.code === ACCOUNT_DELETION_SCHEDULED) {
    return { kind: 'deletion_scheduled' };
  }
  if (rejection.status === 403 && rejection.code?.startsWith('ACCOUNT_')) {
    return { kind: 'handled' };
  }
  const activeRideId = rejection.extra?.ride_id;
  if (rejection.code === RIDE_ALREADY_ACTIVE && typeof activeRideId === 'number' && activeRideId > 0) {
    return { kind: 'already_active', message: rejectionMessage(rejection, fallback), rideId: activeRideId };
  }
  const offerMessage = rejection.fieldErrors?.offered_fare?.find((m) => typeof m === 'string' && m.trim());
  if (rejection.kind === 'validation' && offerMessage) {
    return { kind: 'offer_out_of_band', message: offerMessage, band: offerBandFromExtra(rejection.extra) };
  }
  if (rejection.kind === 'validation') {
    return { kind: 'message', message: firstFieldError(rejection) ?? rejectionMessage(rejection, fallback) };
  }
  const uncertain = rejection.kind === 'network' || rejection.kind === 'timeout';
  return uncertain
    ? { kind: 'message', message: rejectionMessage(rejection, fallback), uncertain }
    : { kind: 'message', message: rejectionMessage(rejection, fallback) };
};
