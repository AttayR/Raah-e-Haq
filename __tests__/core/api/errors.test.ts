import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import {
  ApiError,
  rejectionMessage,
  toApiError,
  toThunkRejection,
  unwrap,
} from '../../../src/core/api/errors';

const axiosErrorWith = (status: number, data: unknown, headers: Record<string, string> = {}) => {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, headers, config, statusText: '' } as unknown as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, response);
};

describe('toApiError', () => {
  it('reads { success:false, message, errors } (auth controller, 422)', () => {
    const error = toApiError(
      axiosErrorWith(422, { success: false, message: 'Validation errors', errors: { email: ['Taken'] } }),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'validation', status: 422, message: 'Validation errors', fieldErrors: { email: ['Taken'] } });
  });

  it('reads the OTP 429 with retry_after (BE-16)', () => {
    const error = toApiError(
      axiosErrorWith(
        429,
        { success: false, message: 'Please wait 42 seconds.', errors: { phone: ['Please wait 42 seconds.'] }, retry_after: 42 },
        { 'retry-after': '42' },
      ),
    );
    expect(error).toMatchObject({ kind: 'rate_limited', status: 429, retryAfter: 42, message: 'Please wait 42 seconds.' });
  });

  it('falls back to the Retry-After header (framework throttle)', () => {
    const error = toApiError(axiosErrorWith(429, { message: 'Too Many Attempts.' }, { 'retry-after': '30' }));
    expect(error).toMatchObject({ kind: 'rate_limited', retryAfter: 30 });
  });

  it('reads the admin-only 403 envelope (BE-18)', () => {
    const error = toApiError(
      axiosErrorWith(403, { success: false, message: 'Forbidden. You do not have permission to access this resource.' }),
    );
    expect(error).toMatchObject({ kind: 'forbidden', status: 403 });
    expect(error.message).toMatch(/Forbidden/);
  });

  it('reads the nested { error: { code, message } } envelope with string details', () => {
    const error = toApiError(
      axiosErrorWith(400, {
        success: false,
        error: { code: 'RIDE_ALREADY_ACCEPTED', message: 'Ride has already been accepted', details: 'text' },
      }),
    );
    // 4xx text is user-facing: 400 is 'bad_request' and shows the server message.
    expect(error).toMatchObject({
      kind: 'bad_request',
      status: 400,
      code: 'RIDE_ALREADY_ACCEPTED',
      message: 'Ride has already been accepted',
      fieldErrors: {},
    });
  });

  it('maps 409 (ride already taken / invalid transition) to conflict', () => {
    const error = toApiError(
      axiosErrorWith(409, { success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: 'Cannot change ride status' } }),
    );
    expect(error).toMatchObject({ kind: 'conflict', status: 409, code: 'INVALID_STATUS_TRANSITION' });
  });

  it('reads the hybrid BE-30 envelope { success:false, message, error:{code,message} }', () => {
    const error = toApiError(
      axiosErrorWith(403, {
        success: false,
        message: 'Drivers cannot change: passenger_id',
        error: { code: 'FORBIDDEN_FIELDS', message: 'Drivers cannot change: passenger_id' },
      }),
    );
    expect(error).toMatchObject({ kind: 'forbidden', code: 'FORBIDDEN_FIELDS', message: 'Drivers cannot change: passenger_id' });
  });

  it('carries the nested error\'s numbers (BE-64 not_near_pickup), never its other text', () => {
    const error = toApiError(
      axiosErrorWith(422, {
        success: false,
        message: 'You are too far from the pickup point.',
        error: { code: 'not_near_pickup', message: 'You are too far from the pickup point.', distance_m: 812.4, radius_m: 300, note: 'x' },
      }),
    );
    expect(error).toMatchObject({ kind: 'validation', code: 'not_near_pickup', message: 'You are too far from the pickup point.' });
    expect(error.extra).toEqual({ distance_m: 812.4, radius_m: 300 });
    expect(toThunkRejection(error, 'fallback').extra).toEqual({ distance_m: 812.4, radius_m: 300 });

    const plain = toApiError(axiosErrorWith(409, { success: false, error: { code: 'X', message: 'm' } }));
    expect(plain.extra).toBeUndefined();
    expect(toThunkRejection(plain, 'fallback')).not.toHaveProperty('extra');
  });

  it('never shows server text for 5xx (exception text can contain SQL or PII)', () => {
    const error = toApiError(
      axiosErrorWith(500, {
        success: false,
        message: "SQLSTATE[23000]: Integrity constraint violation for phone '+923001234567'",
        error: { code: 'SERVER_ERROR', message: 'SQLSTATE[23000] ...' },
      }),
    );
    expect(error.kind).toBe('server');
    expect(error.message).toBe('Something went wrong on our side. Please try again.');
    expect(error.message).not.toMatch(/SQLSTATE|9230/);
  });

  it('gives a friendly message when the body has none', () => {
    expect(toApiError(axiosErrorWith(500, '<html>')).message).toMatch(/Something went wrong/);
    expect(toApiError(axiosErrorWith(401, { message: 'Unauthenticated.' })).kind).toBe('auth');
  });

  it('maps no-response errors to network/timeout', () => {
    const config = { headers: new AxiosHeaders() };
    expect(toApiError(new AxiosError('timeout', 'ECONNABORTED', config)).kind).toBe('timeout');
    expect(toApiError(new AxiosError('Network Error', 'ERR_NETWORK', config)).kind).toBe('network');
  });

  it('passes ApiError through and wraps plain errors', () => {
    const original = new ApiError({ kind: 'auth', message: 'x' });
    expect(toApiError(original)).toBe(original);
    expect(toApiError(new Error('boom'))).toMatchObject({
      kind: 'unknown',
      message: 'Something went wrong. Please try again.',
    });
    expect(toApiError("undefined is not an object (evaluating 'a.b')").message).toBe(
      'Something went wrong. Please try again.',
    );
  });
});

describe('toApiError: top-level code and retry_after (BE-25, BE-28, T-104)', () => {
  it('reads the throttle envelope { success:false, code:rate_limited, retry_after }', () => {
    const error = toApiError(
      axiosErrorWith(
        429,
        { success: false, message: 'Too many requests. Please try again later.', code: 'rate_limited', retry_after: 37 },
        { 'retry-after': '37' },
      ),
    );
    expect(error).toMatchObject({ kind: 'rate_limited', status: 429, code: 'rate_limited', retryAfter: 37 });
  });

  it('reads the OTP refusal code (code_exhausted) next to errors and retry_after', () => {
    const error = toApiError(
      axiosErrorWith(429, {
        success: false,
        message: 'Too many incorrect attempts. Please request a new code.',
        code: 'code_exhausted',
        errors: { otp_code: ['Too many incorrect attempts. Please request a new code.'] },
        retry_after: 45,
      }),
    );
    expect(error).toMatchObject({ code: 'code_exhausted', retryAfter: 45, fieldErrors: { otp_code: [expect.any(String)] } });
    expect(toThunkRejection(error, 'x')).toMatchObject({ code: 'code_exhausted', retryAfter: 45 });
  });

  it('reads the 403 ACCOUNT_* code', () => {
    const error = toApiError(
      axiosErrorWith(403, { success: false, message: 'Your account is suspended.', code: 'ACCOUNT_SUSPENDED', data: { status: 'suspended' } }),
    );
    expect(error).toMatchObject({ kind: 'forbidden', code: 'ACCOUNT_SUSPENDED' });
  });

  it('shows the server message for 503 sms_unavailable and busy', () => {
    const sms = toApiError(
      axiosErrorWith(503, {
        success: false,
        message: 'Phone verification is temporarily unavailable. Please try again later.',
        code: 'sms_unavailable',
        errors: { phone: ['Phone verification is temporarily unavailable. Please try again later.'] },
        retry_after: 3600,
      }),
    );
    expect(sms).toMatchObject({
      kind: 'server',
      code: 'sms_unavailable',
      retryAfter: 3600,
      message: 'Phone verification is temporarily unavailable. Please try again later.',
    });
    const busy = toApiError(
      axiosErrorWith(503, { success: false, message: 'The server is busy. Please try again in a few seconds.', code: 'busy', retry_after: 5 }),
    );
    expect(busy.message).toBe('The server is busy. Please try again in a few seconds.');
  });

  it('still hides the text of any other 5xx, whatever its code', () => {
    const error = toApiError(axiosErrorWith(503, { message: 'SQLSTATE[HY000] connection refused', code: 'db_down' }));
    expect(error.message).toBe('Something went wrong on our side. Please try again.');
  });
});

describe('unwrap', () => {
  it('returns data', () => {
    expect(unwrap({ success: true, data: { id: 1 } })).toEqual({ id: 1 });
  });

  it('throws on success:false or missing data', () => {
    expect(() => unwrap({ success: false, message: 'Nope' })).toThrow(/Something went wrong/);
    expect(() => unwrap({ success: true })).toThrow(ApiError);
  });
});

describe('thunk rejection helpers', () => {
  it('toThunkRejection uses the fallback for a plain Error, never its raw text', () => {
    expect(toThunkRejection(new Error('[auth/internal-error] stack...'), 'Login failed')).toEqual({
      message: 'Login failed',
      kind: 'unknown',
      status: undefined,
      fieldErrors: {},
      retryAfter: undefined,
    });
  });

  it('toThunkRejection keeps message, fieldErrors and retryAfter', () => {
    const rejection = toThunkRejection(
      axiosErrorWith(429, { success: false, message: 'Wait', errors: { phone: ['Wait'] }, retry_after: 60 }),
      'Failed to send OTP',
    );
    expect(rejection).toEqual({
      message: 'Wait',
      kind: 'rate_limited',
      status: 429,
      fieldErrors: { phone: ['Wait'] },
      retryAfter: 60,
    });
  });

  it('rejectionMessage never returns an object', () => {
    expect(rejectionMessage({ message: 'Bad', fieldErrors: {} }, 'fallback')).toBe('Bad');
    expect(rejectionMessage('Plain', 'fallback')).toBe('Plain');
    expect(rejectionMessage({ errors: {} }, 'fallback')).toBe('fallback');
    expect(rejectionMessage(undefined, 'fallback')).toBe('fallback');
  });
});
