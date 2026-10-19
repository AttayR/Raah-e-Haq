/**
 * T-104 (QA T-103): expected API failures (offline, 401/403, 4xx) are warnings, never a red
 * Debug LogBox; real failures (5xx, bugs) stay errors. The line is a keyed summary, never empty.
 */
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { logApiFailure } from '../../../src/core/api/logApiFailure';
import { apiClient } from '../../../src/services/api';
import rideService from '../../../src/services/rideService';

const axiosErrorWith = (status: number, data: unknown) => {
  const config = { headers: new AxiosHeaders() };
  const response = { status, data, headers: {}, config, statusText: '' } as unknown as AxiosResponse;
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, {}, response);
};

let warn: jest.SpyInstance;
let error: jest.SpyInstance;

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('logApiFailure', () => {
  it.each([
    [401, { message: 'Invalid credentials' }],
    [403, { message: 'Forbidden.' }],
    [422, { message: 'Validation errors', errors: { email: ['Taken'] } }],
    [429, { message: 'Too many requests.', code: 'rate_limited', retry_after: 5 }],
  ])('logs an expected %s as a warning', (status, body) => {
    logApiFailure('loginUser failed', axiosErrorWith(status, body));
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('loginUser failed', expect.objectContaining({ status }));
  });

  it.each([
    [503, { message: 'Phone verification is temporarily unavailable.', code: 'sms_unavailable', retry_after: 600 }],
    [503, { message: 'The server is busy.', code: 'busy', retry_after: 5 }],
    [429, { message: 'Too many incorrect attempts.', code: 'code_exhausted', retry_after: 20 }],
    [429, { message: 'Too many codes from this network.', code: 'otp_ip_limit', retry_after: 3600 }],
  ])('T-113: logs the expected OTP refusal %s %o as a warning (no red LogBox)', (status, body) => {
    logApiFailure('sendOtp failed', axiosErrorWith(status, body));
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('sendOtp failed', expect.objectContaining({ status, code: body.code }));
  });

  it('T-113: a 503 without a known refusal code is still an error', () => {
    logApiFailure('sendOtp failed', axiosErrorWith(503, { message: 'Service Unavailable' }));
    expect(error).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs offline as a warning with a non-empty summary', () => {
    const config = { headers: new AxiosHeaders() };
    logApiFailure('x failed', new AxiosError('Network Error', 'ERR_NETWORK', config));
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'x failed',
      expect.objectContaining({ kind: 'network', message: expect.stringMatching(/\S/) }),
    );
  });

  it('logs a 5xx as an error, without the server text', () => {
    logApiFailure('x failed', axiosErrorWith(500, { message: "SQLSTATE phone '+923001234567'" }));
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error.mock.calls[0])).not.toMatch(/SQLSTATE|9230/);
  });

  it('RideService#getNotifications offline is a warning, not an error', async () => {
    const mock = new MockAdapter(apiClient);
    mock.onGet('/notifications').networkError();
    try {
      await expect(rideService.getNotifications()).rejects.toMatchObject({ kind: 'network' });
    } finally {
      mock.restore();
    }
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'RideService#getNotifications failed',
      expect.objectContaining({ kind: 'network' }),
    );
  });

  it.each(['ACCOUNT_PENDING', 'ACCOUNT_SUSPENDED', 'ACCOUNT_REJECTED'])(
    'T-581: a 403 %s (the account state, shown on its screen) is debug only, no LogBox',
    (code) => {
      const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
      logApiFailure('Failed to fetch rides', axiosErrorWith(403, { message: 'Refused.', code, data: { status: 'suspended' } }));
      expect(error).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalledWith('Failed to fetch rides', expect.objectContaining({ status: 403, code }));
    },
  );

  it('T-581: RideService#getRides refused by ACCOUNT_SUSPENDED logs no console.error', async () => {
    const mock = new MockAdapter(apiClient);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    mock.onGet('/rides').reply(403, { success: false, message: 'Suspended.', code: 'ACCOUNT_SUSPENDED', data: { status: 'suspended' } });
    try {
      await expect(rideService.getRides()).rejects.toMatchObject({ status: 403 });
    } finally {
      mock.restore();
    }
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('T-581: RideService#getRides failing on a 5xx is still an error with a summary', async () => {
    const mock = new MockAdapter(apiClient);
    mock.onGet('/rides').reply(500, { message: 'boom' });
    try {
      await expect(rideService.getRides()).rejects.toMatchObject({ status: 500 });
    } finally {
      mock.restore();
    }
    expect(error).toHaveBeenCalledWith('Failed to fetch rides', expect.objectContaining({ status: 500 }));
  });
});
