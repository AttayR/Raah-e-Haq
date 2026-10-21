import { rejectionMessage, type ThunkRejection } from '../api/errors';
import { refusedAccountStatus } from './normalizeUser';
import { ACCOUNT_STATUS_COPY, ACCOUNT_STATUS_VARIANTS } from '../../features/auth/copy/accountStatus';

/** How long a refusal toast with a reason stays up (two lines of text to read). */
export const REFUSAL_TOAST_DURATION_MS = 6000;

/** BE-141: the code of the 403 that login / verify-otp send for an admin account (no token issued). */
export const ADMIN_USE_PANEL_CODE = 'ADMIN_USE_PANEL';

/** True for BE-141's 403 ADMIN_USE_PANEL: an admin tried to sign in to the passenger/driver app. */
export function isAdminUsePanelRefusal(payload: Pick<ThunkRejection, 'status' | 'code'> | undefined): boolean {
  return payload?.status === 403 && payload.code === ADMIN_USE_PANEL_CODE;
}

/**
 * A rejected login / verify-otp split for display (T-106): `message` is the server's text
 * (rejectionMessage), `reason` is "Reason: …" for a 403 ACCOUNT_* carrying a rejection_reason
 * (BE-32), otherwise null. A 403 ADMIN_USE_PANEL (BE-141) gets the admin copy instead: the
 * title and the "Admins use the web dashboard" line (T-714). Toasts show the reason as their
 * second line (subtitle), so the title's line limit never cuts it off.
 */
export function accountRefusalParts(
  payload: ThunkRejection | undefined,
  fallback: string,
): { message: string; reason: string | null } {
  if (isAdminUsePanelRefusal(payload)) {
    // T-714: our own copy (the same as the account-status screen's admin variant), not the
    // server's text, in the app's language.
    return { message: ACCOUNT_STATUS_VARIANTS.unsupportedRole.title, reason: ACCOUNT_STATUS_COPY.adminUsePanel };
  }
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
