/**
 * T-104 (QA T-103): expected API failures (401/403, 4xx) are never a red Debug LogBox;
 * T-584: no connection and a 409 are debug only (no yellow LogBox either); T-589: so is every
 * other expected failure (RN 0.80 shows a warning only as the unreadable "Open debugger to view
 * warnings" toast); real failures (5xx, bugs) stay errors. The line is a keyed summary, never empty.
 */
import { AxiosError, AxiosHeaders, AxiosResponse } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { logApiFailure } from '../../../src/core/api/logApiFailure';
import { apiClient } from '../../../src/services/api';
import rideService from '../../../src/services/rideService';
import { fetchFareEstimates } from '../../../src/features/ride-booking/api';

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
  ])('T-589: logs an expected %s at debug (no LogBox)', (status, body) => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    logApiFailure('loginUser failed', axiosErrorWith(status, body));
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('loginUser failed', expect.objectContaining({ status }));
  });

  it.each([
    [503, { message: 'Phone verification is temporarily unavailable.', code: 'sms_unavailable', retry_after: 600 }],
    [503, { message: 'The server is busy.', code: 'busy', retry_after: 5 }],
    [429, { message: 'Too many incorrect attempts.', code: 'code_exhausted', retry_after: 20 }],
    [429, { message: 'Too many codes from this network.', code: 'otp_ip_limit', retry_after: 3600 }],
  ])('T-113: logs the expected OTP refusal %s %o at debug (no LogBox)', (status, body) => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    logApiFailure('sendOtp failed', axiosErrorWith(status, body));
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('sendOtp failed', expect.objectContaining({ status, code: body.code }));
  });

  it('T-113: a 503 without a known refusal code is still an error', () => {
    logApiFailure('sendOtp failed', axiosErrorWith(503, { message: 'Service Unavailable' }));
    expect(error).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('T-584: logs offline at debug (no LogBox) with a non-empty summary', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const config = { headers: new AxiosHeaders() };
    logApiFailure('x failed', new AxiosError('Network Error', 'ERR_NETWORK', config));
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      'x failed',
      expect.objectContaining({ kind: 'network', message: expect.stringMatching(/\S/) }),
    );
  });

  it('logs a 5xx as an error, without the server text', () => {
    logApiFailure('x failed', axiosErrorWith(500, { message: "SQLSTATE phone '+923001234567'" }));
    expect(error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(error.mock.calls[0])).not.toMatch(/SQLSTATE|9230/);
  });

  it('T-584: RideService#getNotifications offline is debug only, not a warning or an error', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const mock = new MockAdapter(apiClient);
    mock.onGet('/notifications').networkError();
    try {
      await expect(rideService.getNotifications()).rejects.toMatchObject({ kind: 'network' });
    } finally {
      mock.restore();
    }
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      'RideService#getNotifications failed',
      expect.objectContaining({ kind: 'network' }),
    );
  });

  it('T-584: a 409 on POST /rides (an open booking) is debug only', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const mock = new MockAdapter(apiClient);
    mock.onPost('/rides').reply(409, {
      success: false,
      message: 'You already have an open booking.',
      error: { code: 'RIDE_ALREADY_ACTIVE', ride_id: 5 },
    });
    const request: Parameters<typeof rideService.createRide>[0] = {
      pickup_latitude: 31.5,
      pickup_longitude: 74.3,
      pickup_address: 'A',
      dropoff_latitude: 31.6,
      dropoff_longitude: 74.4,
      dropoff_address: 'B',
      vehicle_type: 'car',
    };
    try {
      await expect(rideService.createRide(request)).rejects.toMatchObject({ status: 409 });
    } finally {
      mock.restore();
    }
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Failed to create ride', expect.objectContaining({ status: 409 }));
  });

  it('T-584: POST /rides/estimate with the server down is debug only', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const mock = new MockAdapter(apiClient);
    mock.onPost('/rides/estimate').networkError();
    const route = { pickup: { latitude: 31.5, longitude: 74.3 }, dropoff: { latitude: 31.6, longitude: 74.4 }, stops: [] };
    try {
      await expect(fetchFareEstimates(route)).rejects.toMatchObject({ kind: 'network' });
    } finally {
      mock.restore();
    }
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Failed to estimate fare', expect.objectContaining({ kind: 'network' }));
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

  it('T-589: a failed cancel with the server down is debug only (no red LogBox)', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const mock = new MockAdapter(apiClient);
    mock.onPost('/rides/7/cancel').networkError();
    try {
      await expect(rideService.cancelRide(7)).rejects.toMatchObject({ kind: 'network' });
    } finally {
      mock.restore();
    }
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Failed to cancel ride', expect.objectContaining({ kind: 'network' }));
  });

  it('T-589: a cancel refused with 409 (the ride moved on) is debug only', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const mock = new MockAdapter(apiClient);
    mock.onPost('/rides/7/cancel').reply(409, { success: false, message: 'The ride has already started.' });
    try {
      await expect(rideService.cancelRide(7)).rejects.toMatchObject({ status: 409 });
    } finally {
      mock.restore();
    }
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('T-589: a cancel failing on a 5xx is still an error, as a summary', async () => {
    const mock = new MockAdapter(apiClient);
    mock.onPost('/rides/7/cancel').reply(500, { message: 'boom' });
    try {
      await expect(rideService.cancelRide(7)).rejects.toMatchObject({ status: 500 });
    } finally {
      mock.restore();
    }
    expect(error).toHaveBeenCalledWith('Failed to cancel ride', expect.objectContaining({ status: 500 }));
  });
});
