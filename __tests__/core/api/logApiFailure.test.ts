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
    [403, { message: 'Your account is pending.', code: 'ACCOUNT_PENDING' }],
    [422, { message: 'Validation errors', errors: { email: ['Taken'] } }],
    [429, { message: 'Too many requests.', code: 'rate_limited', retry_after: 5 }],
  ])('logs an expected %s as a warning', (status, body) => {
    logApiFailure('loginUser failed', axiosErrorWith(status, body));
    expect(error).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('loginUser failed', expect.objectContaining({ status }));
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
});
