import { rejectionMessage, type ThunkRejection } from '../api/errors';
import { refusedAccountStatus } from './normalizeUser';
import { ACCOUNT_STATUS_COPY } from '../../features/auth/copy/accountStatus';

/** How long a refusal toast with a reason stays up (two lines of text to read). */
export const REFUSAL_TOAST_DURATION_MS = 6000;

/**
 * A rejected login / verify-otp split for display (T-106): `message` is the server's text
 * (rejectionMessage), `reason` is "Reason: …" for a 403 ACCOUNT_* carrying a rejection_reason
 * (BE-32), otherwise null. Toasts show the reason as their second line (subtitle), so the
 * title's line limit never cuts it off.
 */
export function accountRefusalParts(
  payload: ThunkRejection | undefined,
  fallback: string,
): { message: string; reason: string | null } {
  const message = rejectionMessage(payload, fallback);
  if (!payload || refusedAccountStatus(payload) === null) {
    return { message, reason: null };
  }
  const reason = payload.account?.rejectionReason?.trim();
  return { message, reason: reason ? `${ACCOUNT_STATUS_COPY.reasonLabel}: ${reason}` : null };
}

/**
 * The same as one string (message, then the reason on its own line), for inline error text.
 * It lives in Redux memory only (`error` is never persisted, store/persistTransforms).
 */
export function accountRefusalMessage(payload: ThunkRejection | undefined, fallback: string): string {
  const { message, reason } = accountRefusalParts(payload, fallback);
  return reason ? `${message}\n${reason}` : message;
}
