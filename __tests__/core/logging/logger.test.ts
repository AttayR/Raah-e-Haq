import { logger, redact, REDACTED, isSensitiveKey } from '../../../src/core/logging/logger';

const devGlobal = globalThis as unknown as { __DEV__: boolean };

describe('redact', () => {
  it('redacts every sensitive key at the top level', () => {
    const input = {
      password: 'secret123',
      password_confirmation: 'secret123',
      token: 'abc',
      otp: '1234',
      otp_code: '1234',
      cnic: '35202-1234567-1',
      phone: '+923001234567',
      bank_account_number: 'PK00TEST',
      authorization: 'Bearer abc',
      fcmToken: 'fcm-xyz',
      name: 'Ali',
      status: 'active',
    };
    expect(redact(input)).toEqual({
      password: REDACTED,
      password_confirmation: REDACTED,
      token: REDACTED,
      otp: REDACTED,
      otp_code: REDACTED,
      cnic: REDACTED,
      phone: REDACTED,
      bank_account_number: REDACTED,
      authorization: REDACTED,
      fcmToken: REDACTED,
      name: 'Ali',
      status: 'active',
    });
  });

  it('matches keys case-insensitively and as substrings', () => {
    expect(isSensitiveKey('Authorization')).toBe(true);
    expect(isSensitiveKey('phoneNumber')).toBe(true);
    expect(isSensitiveKey('access_token')).toBe(true);
    expect(isSensitiveKey('FCM')).toBe(true);
    expect(isSensitiveKey('accountNumber')).toBe(true);
    expect(isSensitiveKey('name')).toBe(false);
    expect(isSensitiveKey('rideId')).toBe(false);
  });

  it('redacts the extended PII keys on every level', () => {
    const input = {
      emergency_contact: '+923000000000',
      passenger_emergency_contact_name: 'Sara',
      bank_name: 'HBL',
      verificationId: 'v-1',
      address: 'House 1, Lahore',
      license_number: 'LHR-123',
      license_plate: 'LEA-1234',
      api_key: 'AIza-test',
      apiKey: 'AIza-test',
      uid: 'firebase-uid',
      rideId: 5,
      pickup: { latitude: 31.5, longitude: 74.3 },
      name: 'Ali',
    };
    expect(redact(input)).toEqual({
      emergency_contact: REDACTED,
      passenger_emergency_contact_name: REDACTED,
      bank_name: REDACTED,
      verificationId: REDACTED,
      address: REDACTED,
      license_number: REDACTED,
      license_plate: REDACTED,
      api_key: REDACTED,
      apiKey: REDACTED,
      uid: REDACTED,
      rideId: 5,
      // Coordinates and names are kept in development logs ...
      pickup: { latitude: 31.5, longitude: 74.3 },
      name: 'Ali',
    });
  });

  it('strict mode also redacts names and coordinates', () => {
    const input = {
      name: 'Ali',
      driver_name: 'Bilal',
      lat: 31.5,
      lng: 74.3,
      pickup: { latitude: 31.5, longitude: 74.3 },
      location: { x: 1 },
      coords: [31.5, 74.3],
      rideId: 5,
      status: 'requested',
    };
    expect(redact(input, true)).toEqual({
      name: REDACTED,
      driver_name: REDACTED,
      lat: REDACTED,
      lng: REDACTED,
      pickup: { latitude: REDACTED, longitude: REDACTED },
      location: REDACTED,
      coords: REDACTED,
      rideId: 5,
      status: 'requested',
    });
    expect(isSensitiveKey('latitude')).toBe(false);
    expect(isSensitiveKey('latitude', true)).toBe(true);
  });

  it('masks key and token query values inside strings', () => {
    const url =
      'https://maps.googleapis.com/maps/api/geocode/json?latlng=31.5,74.3&key=AIzaSECRET&x=1';
    expect(redact(url)).toBe(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=31.5,74.3&key=${REDACTED}&x=1`,
    );
    expect(redact({ link: '/ws?token=abc123' })).toEqual({ link: `/ws?token=${REDACTED}` });
  });

  it('never throws on a throwing getter', () => {
    const input = { id: 1 };
    Object.defineProperty(input, 'broken', {
      enumerable: true,
      get() {
        throw new Error('nope');
      },
    });
    expect(() => redact(input)).not.toThrow();
    expect(redact(input)).toEqual({ id: 1, broken: '[Unreadable]' });
  });

  it('redacts nested objects and arrays', () => {
    const input = {
      data: {
        user: { id: 7, phone: '+923001234567', cnic: '35202-1234567-1' },
        token: 'abc',
      },
      drivers: [
        { id: 1, phone: '+923000000001' },
        { id: 2, meta: { fcm_token: 'f' } },
      ],
      list: [['nested', { otp: '9999' }]],
    };
    expect(redact(input)).toEqual({
      data: {
        user: { id: 7, phone: REDACTED, cnic: REDACTED },
        token: REDACTED,
      },
      drivers: [
        { id: 1, phone: REDACTED },
        { id: 2, meta: { fcm_token: REDACTED } },
      ],
      list: [['nested', { otp: REDACTED }]],
    });
  });

  it('does not mutate the original value', () => {
    const input = { password: 'p', nested: { token: 't' } };
    redact(input);
    expect(input).toEqual({ password: 'p', nested: { token: 't' } });
  });

  it('passes primitives through unchanged', () => {
    expect(redact('hello')).toBe('hello');
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
  });

  it('survives circular references', () => {
    const input: Record<string, unknown> = { id: 1 };
    input.self = input;
    expect(redact(input)).toEqual({ id: 1, self: '[Circular]' });
  });

  it('prints a shared, non-circular reference in full each time', () => {
    const location = { lat: 31.5, lng: 74.3 };
    expect(redact({ pickup: location, dropoff: location })).toEqual({
      pickup: { lat: 31.5, lng: 74.3 },
      dropoff: { lat: 31.5, lng: 74.3 },
    });
  });

  it('keeps the message of an Error and redacts its own sensitive props', () => {
    const err = Object.assign(new Error('boom'), { token: 'abc', code: 'E1' });
    const out = redact(err) as Record<string, unknown>;
    expect(out.name).toBe('Error');
    expect(out.message).toBe('boom');
    expect(out.token).toBe(REDACTED);
    expect(out.code).toBe('E1');
  });

  it('reduces an axios error to a summary without headers or request body', () => {
    const err = Object.assign(new Error('Request failed with status code 422'), {
      isAxiosError: true as const,
      code: 'ERR_BAD_REQUEST',
      config: {
        method: 'post',
        url: '/auth/login',
        headers: { Authorization: 'Bearer secret-token' },
        data: JSON.stringify({ email: 'a@b.c', password: 'hunter2' }),
      },
      request: { _response: 'raw' },
      response: {
        status: 422,
        data: { message: 'Invalid', errors: { phone: ['taken'] }, otp_code: '1234' },
        headers: { 'set-cookie': 'x' },
      },
    });
    const out = redact(err);
    expect(out).toEqual({
      name: 'Error',
      message: 'Request failed with status code 422',
      code: 'ERR_BAD_REQUEST',
      method: 'post',
      url: '/auth/login',
      status: 422,
      responseData: { message: 'Invalid', errors: { phone: REDACTED }, otp_code: REDACTED },
    });
    const serialised = JSON.stringify(out);
    expect(serialised).not.toContain('secret-token');
    expect(serialised).not.toContain('hunter2');
    expect(serialised).not.toContain('1234');
  });
});

describe('logger', () => {
  const originalDev = devGlobal.__DEV__;
  let logSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    devGlobal.__DEV__ = originalDev;
    jest.restoreAllMocks();
  });

  it('prints redacted arguments in development', () => {
    devGlobal.__DEV__ = true;
    logger.debug('login', { email: 'a@b.c', password: 'p', role: 'driver' });
    expect(logSpy).toHaveBeenCalledWith('login', {
      email: REDACTED,
      password: REDACTED,
      role: 'driver',
    });
    logger.info('info', { token: 't' });
    expect(infoSpy).toHaveBeenCalledWith('info', { token: REDACTED });
    logger.warn('warn', { cnic: 'c' });
    expect(warnSpy).toHaveBeenCalledWith('warn', { cnic: REDACTED });
  });

  it('is silent for debug, info and warn outside development', () => {
    devGlobal.__DEV__ = false;
    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    expect(logSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('always prints errors, redacted, even outside development', () => {
    devGlobal.__DEV__ = false;
    logger.error('failed', { otp_code: '1234', rideId: 9 });
    expect(errorSpy).toHaveBeenCalledWith('failed', { otp_code: REDACTED, rideId: 9 });
  });

  it('uses the strict set on the error path only', () => {
    devGlobal.__DEV__ = true;
    const payload = { name: 'Ali', pickup: { lat: 31.5, lng: 74.3 }, rideId: 9 };
    logger.debug('debug', payload);
    expect(logSpy).toHaveBeenCalledWith('debug', payload);
    logger.error('error', payload);
    expect(errorSpy).toHaveBeenCalledWith('error', {
      name: REDACTED,
      pickup: { lat: REDACTED, lng: REDACTED },
      rideId: 9,
    });
  });
});
