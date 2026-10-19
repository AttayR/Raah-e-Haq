import { isUserFacingServerCode, toApiError, type ApiErrorKind } from './errors';
import { logger } from '../logging/logger';

/**
 * Failures the app expects in normal use (offline, wrong password, expired session, rate
 * limits, validation). They are handled in the UI, so they are logged as warnings (dev
 * only) instead of errors, which would raise a red LogBox in Debug and print in release.
 */
const EXPECTED_KINDS: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>([
  'network',
  'timeout',
  'cancelled',
  'auth',
  'forbidden',
  'bad_request',
  'not_found',
  'conflict',
  'validation',
  'rate_limited',
]);

/**
 * T-584 (QA 2026-10-19): no connection (offline, the server down, a timeout or a cancelled call)
 * and a 409 conflict (an open booking, a ride that moved on) are everyday states each screen
 * shows itself. They log at debug, so they do not raise the yellow Debug LogBox either.
 */
const QUIET_KINDS: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>(['network', 'timeout', 'cancelled', 'conflict']);

/** True for a failure kind logged at debug (no connection, a 409). */
export const isQuietFailureKind = (kind: ApiErrorKind): boolean => QUIET_KINDS.has(kind);

/**
 * A 503 the backend sends on purpose (BE-28 `sms_unavailable`, `busy`): a refusal with a
 * user-facing message and retry_after that the screen handles, not a server fault (AUTH-18).
 */
const isExpected = (kind: ApiErrorKind, code?: string): boolean =>
  EXPECTED_KINDS.has(kind) || (kind === 'server' && isUserFacingServerCode(code));

/**
 * Logs a failed API call as a keyed summary (kind, status, code, display-safe message), so
 * the line is never empty and never carries the request config or body.
 */
export const logApiFailure = (context: string, error: unknown): void => {
  const apiError = toApiError(error);
  const summary = {
    kind: apiError.kind,
    status: apiError.status,
    code: apiError.code,
    message: apiError.message,
    // A non-API error (a bug in our code) keeps its type so it can be found.
    cause: apiError === error || !(error instanceof Error) ? undefined : error.name,
  };
  if (apiError.account || isQuietFailureKind(apiError.kind)) {
    // T-581: a 403 ACCOUNT_* (pending, suspended, rejected) is the account's state, shown on the
    // account status screen; every call made meanwhile is refused the same way. Not a warning.
    logger.debug(context, summary);
  } else if (isExpected(apiError.kind, apiError.code)) {
    logger.warn(context, summary);
  } else {
    logger.error(context, summary);
  }
};
