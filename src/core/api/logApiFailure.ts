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
  if (isExpected(apiError.kind, apiError.code)) {
    logger.warn(context, summary);
  } else {
    logger.error(context, summary);
  }
};
