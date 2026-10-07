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
    expect(toApiError(new Error('boom'))).toMatchObject({ kind: 'unknown', message: 'boom' });
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
