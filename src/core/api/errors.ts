import axios from 'axios';
import type { ApiResponse, FieldErrors } from './types';

export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'cancelled'
  | 'auth'
  | 'forbidden'
  | 'bad_request'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'unknown';

/**
 * BE-25/BE-32: what a 403 ACCOUNT_* body says about the account (`data.status`, and
 * `data.rejection_reason` for ACCOUNT_REJECTED). Raw strings; core/auth/normalizeUser maps them.
 */
export interface AccountRefusal {
  status?: string;
  rejectionReason?: string | null;
}

export interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  status?: number;
  code?: string;
  fieldErrors?: FieldErrors;
  retryAfter?: number;
  account?: AccountRefusal;
}

/** The only error type the API layer throws. Built in one place: the axios response interceptor. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly fieldErrors: FieldErrors;
  readonly retryAfter?: number;
  readonly account?: AccountRefusal;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? {};
    this.retryAfter = init.retryAfter;
    if (init.account) {
      this.account = init.account;
    }
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

const DEFAULT_MESSAGES: Record<ApiErrorKind, string> = {
  network: 'Network error. Please check your connection.',
  timeout: 'The request timed out. Please try again.',
  cancelled: 'Request was cancelled',
  auth: 'Your session has expired. Please sign in again.',
  forbidden: 'You do not have permission to do this.',
  bad_request: 'This request could not be completed.',
  not_found: 'Not found.',
  conflict: 'This was changed by someone else. Please refresh and try again.',
  validation: 'Please check the highlighted fields.',
  rate_limited: 'Too many attempts. Please wait and try again.',
  server: 'Something went wrong on our side. Please try again.',
  unknown: 'Something went wrong. Please try again.',
};

/**
 * 5xx refusals whose message the backend writes for users (BE-28): the SMS budget is spent
 * (`sms_unavailable`) or a lock timed out (`busy`). Both carry `retry_after`.
 */
const USER_FACING_SERVER_CODES: ReadonlySet<string> = new Set(['sms_unavailable', 'busy']);

/** True for a 5xx the backend sends on purpose with user-facing text (BE-28 sms_unavailable/busy). */
export const isUserFacingServerCode = (code?: string): boolean =>
  code != null && USER_FACING_SERVER_CODES.has(code);

/**
 * Server text is shown only for kinds where the backend writes user-facing messages.
 * 5xx and unclassified bodies can carry exception text (SQL, PII), so they always get our
 * copy, except the known user-facing 503 codes above.
 */
const displayMessage = (kind: ApiErrorKind, serverMessage?: string, code?: string): string => {
  if (!serverMessage) return DEFAULT_MESSAGES[kind];
  if (kind === 'server') {
    return isUserFacingServerCode(code) ? serverMessage : DEFAULT_MESSAGES[kind];
  }
  return kind === 'unknown' ? DEFAULT_MESSAGES[kind] : serverMessage;
};

const kindForStatus = (status: number): ApiErrorKind => {
  if (status === 400) return 'bad_request';
  if (status === 401) return 'auth';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'unknown';
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toFieldErrors = (value: unknown): FieldErrors => {
  if (!isObject(value)) return {};
  const result: FieldErrors = {};
  Object.entries(value).forEach(([field, messages]) => {
    if (Array.isArray(messages)) {
      result[field] = messages.map(m => String(m));
    } else if (messages != null) {
      result[field] = [String(messages)];
    }
  });
  return result;
};

const toPositiveNumber = (value: unknown): number | undefined => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined;
};

const toAccountRefusal = (data: unknown): AccountRefusal => {
  if (!isObject(data)) return {};
  const refusal: AccountRefusal = {};
  if (typeof data.status === 'string') refusal.status = data.status;
  if (typeof data.rejection_reason === 'string' || data.rejection_reason === null) {
    refusal.rejectionReason = data.rejection_reason;
  }
  return refusal;
};

/** Reads the error fields out of any of the backend's error envelopes. */
const fromBody = (body: unknown) => {
  if (!isObject(body)) return {};
  const nested = isObject(body.error) ? body.error : undefined;
  const message =
    (typeof body.message === 'string' && body.message) ||
    (nested && typeof nested.message === 'string' && nested.message) ||
    (typeof body.error === 'string' && body.error) ||
    undefined;
  const fieldErrors = {
    ...toFieldErrors(nested?.details),
    ...toFieldErrors(body.errors),
  };
  // Top-level `code` (BE-25 403 ACCOUNT_*, BE-28 OTP refusals and the throttle envelope
  // {success:false, code:'rate_limited', retry_after}) or the nested `error.code`.
  const code =
    (typeof body.code === 'string' && body.code) ||
    (nested && typeof nested.code === 'string' && nested.code) ||
    undefined;
  return {
    message,
    code,
    fieldErrors,
    retryAfter: toPositiveNumber(body.retry_after),
    account: code && code.startsWith('ACCOUNT_') ? toAccountRefusal(body.data) : undefined,
  };
};

/** Normalises anything thrown by axios (or our own code) into an ApiError. */
export const toApiError = (error: unknown): ApiError => {
  if (isApiError(error)) return error;

  if (axios.isCancel(error)) {
    return new ApiError({ kind: 'cancelled', message: DEFAULT_MESSAGES.cancelled });
  }

  if (axios.isAxiosError(error)) {
    if (error.response) {
      const status = error.response.status;
      const parsed = fromBody(error.response.data);
      const headerRetry = toPositiveNumber(error.response.headers?.['retry-after']);
      const fieldErrors = parsed.fieldErrors ?? {};
      const kind = Object.keys(fieldErrors).length > 0 && status === 400 ? 'validation' : kindForStatus(status);
      return new ApiError({
        kind,
        status,
        message: displayMessage(kind, parsed.message, parsed.code),
        code: parsed.code,
        fieldErrors,
        retryAfter: parsed.retryAfter ?? headerRetry,
        account: parsed.account,
      });
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({ kind: 'timeout', message: DEFAULT_MESSAGES.timeout });
    }
    return new ApiError({ kind: 'network', message: DEFAULT_MESSAGES.network });
  }

  // A plain Error's text is technical ("undefined is not an object", Firebase codes, stack
  // fragments), so it is never shown; the original stays loggable at the call site.
  return new ApiError({ kind: 'unknown', message: DEFAULT_MESSAGES.unknown });
};

/**
 * Returns `data` from a success envelope. A 2xx body with `success: false` or without
 * `data` becomes an ApiError, so callers never read `.data.data` by hand.
 */
export function unwrap<T>(body: ApiResponse<T>): T {
  if (!body || body.success === false) {
    const parsed = fromBody(body);
    throw new ApiError({
      kind: 'unknown',
      message: displayMessage('unknown', parsed.message),
      code: parsed.code,
      fieldErrors: parsed.fieldErrors,
    });
  }
  if (body.data === undefined) {
    throw new ApiError({ kind: 'unknown', message: 'Invalid response format from server' });
  }
  return body.data;
}

/** What every API thunk passes to rejectWithValue. */
export interface ThunkRejection {
  message: string;
  kind: ApiErrorKind;
  status?: number;
  /** Machine-readable server code (e.g. `otp_cooldown`, `code_exhausted`, `ACCOUNT_SUSPENDED`). */
  code?: string;
  fieldErrors: FieldErrors;
  retryAfter?: number;
  /** Set for a 403 ACCOUNT_* refusal (BE-25/BE-32). */
  account?: AccountRefusal;
}

export const toThunkRejection = (error: unknown, fallbackMessage: string): ThunkRejection => {
  const apiError = toApiError(error);
  // Anything that did not come from the API layer gets the thunk's own, more specific copy.
  const fromApi = isApiError(error) || axios.isAxiosError(error) || axios.isCancel(error);
  return {
    message: fromApi ? apiError.message || fallbackMessage : fallbackMessage,
    kind: apiError.kind,
    status: apiError.status,
    code: apiError.code,
    fieldErrors: apiError.fieldErrors,
    retryAfter: apiError.retryAfter,
    ...(apiError.account ? { account: apiError.account } : {}),
  };
};

/** Safe display text for a rejected thunk payload (never an object inside <Text>). */
export const rejectionMessage = (payload: unknown, fallbackMessage: string): string => {
  if (typeof payload === 'string' && payload) return payload;
  if (isObject(payload) && typeof payload.message === 'string' && payload.message) {
    return payload.message;
  }
  return fallbackMessage;
};
