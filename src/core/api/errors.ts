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

export interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  status?: number;
  code?: string;
  fieldErrors?: FieldErrors;
  retryAfter?: number;
}

/** The only error type the API layer throws. Built in one place: the axios response interceptor. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly fieldErrors: FieldErrors;
  readonly retryAfter?: number;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.fieldErrors = init.fieldErrors ?? {};
    this.retryAfter = init.retryAfter;
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
 * Server text is shown only for kinds where the backend writes user-facing messages.
 * 5xx and unclassified bodies can carry exception text (SQL, PII), so they always get our copy.
 */
const displayMessage = (kind: ApiErrorKind, serverMessage?: string): string =>
  kind === 'server' || kind === 'unknown' || !serverMessage ? DEFAULT_MESSAGES[kind] : serverMessage;

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
  return {
    message,
    code: nested && typeof nested.code === 'string' ? nested.code : undefined,
    fieldErrors,
    retryAfter: toPositiveNumber(body.retry_after),
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
        message: displayMessage(kind, parsed.message),
        code: parsed.code,
        fieldErrors,
        retryAfter: parsed.retryAfter ?? headerRetry,
      });
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({ kind: 'timeout', message: DEFAULT_MESSAGES.timeout });
    }
    return new ApiError({ kind: 'network', message: DEFAULT_MESSAGES.network });
  }

  if (error instanceof Error) {
    return new ApiError({ kind: 'unknown', message: error.message || DEFAULT_MESSAGES.unknown });
  }
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
  fieldErrors: FieldErrors;
  retryAfter?: number;
}

export const toThunkRejection = (error: unknown, fallbackMessage: string): ThunkRejection => {
  const apiError = toApiError(error);
  return {
    message: apiError.message || fallbackMessage,
    kind: apiError.kind,
    status: apiError.status,
    fieldErrors: apiError.fieldErrors,
    retryAfter: apiError.retryAfter,
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
