import { rejectionMessage, type ThunkRejection } from '../../core/api/errors';
import { isStaleSessionRejection } from '../../store/thunks/apiThunks';

/** BE-37: POST /rides refuses a passenger whose phone is not verified (403, error.code). */
export const PHONE_NOT_VERIFIED = 'PHONE_NOT_VERIFIED';

/**
 * What the booking screen does with a refused POST /rides:
 * - `phone_not_verified`: send the passenger to verify their number (BE-37);
 * - `handled`: nothing to show (a stale session after logout, or 403 ACCOUNT_*, which the API
 *   client already routes to the account status screen, T-106);
 * - `message`: show the server's text (for a 422 the first field message, e.g. "The selected
 *   vehicle type is invalid.", not the generic "Validation failed").
 */
export type RideRequestFailure =
  | { kind: 'phone_not_verified'; message: string }
  | { kind: 'handled' }
  | { kind: 'message'; message: string };

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
  if (rejection.status === 403 && rejection.code?.startsWith('ACCOUNT_')) {
    return { kind: 'handled' };
  }
  if (rejection.kind === 'validation') {
    return { kind: 'message', message: firstFieldError(rejection) ?? rejectionMessage(rejection, fallback) };
  }
  return { kind: 'message', message: rejectionMessage(rejection, fallback) };
};
