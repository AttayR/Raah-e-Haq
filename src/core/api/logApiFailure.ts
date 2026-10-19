import { isUserFacingServerCode, toApiError, type ApiErrorKind } from './errors';
import { logger } from '../logging/logger';

/**
 * Failures the app expects in normal use (offline, wrong password, expired session, rate
 * limits, validation, a 409). They are handled in the UI, so they are not errors, which would
 * raise a red LogBox in Debug and print in release.
 *
 * T-584: no connection (offline, the server down, a timeout or a cancelled call) and a 409 log
 * at debug. T-589 (QA 2026-10-19): so does every other expected failure. Since RN 0.80 a
 * `console.warn` only shows the unreadable "Open debugger to view warnings" toast, and these
 * are everyday states each screen shows itself (a 401 when a session ends, a 422 on a short
 * phone number, a 429 the poll backs off from).
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

/** True for a failure kind the app expects, logged at debug (no connection, a 401, a 409 ...). */
export const isQuietFailureKind = (kind: ApiErrorKind): boolean => EXPECTED_KINDS.has(kind);

/**
 * A 503 the backend sends on purpose (BE-28 `sms_unavailable`, `busy`): a refusal with a
 * user-facing message and retry_after that the screen handles, not a server fault (AUTH-18).
 */
const isExpected = (kind: ApiErrorKind, code?: string): boolean =>
  isQuietFailureKind(kind) || (kind === 'server' && isUserFacingServerCode(code));

/**
 * Logs a failed API call as a keyed summary (kind, status, code, display-safe message), so
 * the line is never empty and never carries the request config or body. Expected failures
 * (and a 403 ACCOUNT_*, T-581: the account's state, shown on the account status screen) log at
 * debug; anything else (a 5xx, a bug in our code) is an error.
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
  if (apiError.account || isExpected(apiError.kind, apiError.code)) {
    logger.debug(context, summary);
  } else {
    logger.error(context, summary);
  }
};
