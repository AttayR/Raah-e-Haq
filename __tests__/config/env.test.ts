import { readEnv, env } from '../../src/config/env';

const valid = {
  API_URL: 'http://localhost:8000/api',
  WS_URL: 'ws://localhost:8080',
  MAPS_KEY: 'test-maps-key',
};

describe('readEnv', () => {
  it('returns typed values from the config source', () => {
    expect(readEnv(valid)).toEqual(valid);
  });

  it('trims whitespace and trailing slashes from URLs', () => {
    expect(
      readEnv({ API_URL: ' https://api.raah.test/api/ ', WS_URL: 'wss://api.raah.test/ws//', MAPS_KEY: ' k ' }),
    ).toEqual({ API_URL: 'https://api.raah.test/api', WS_URL: 'wss://api.raah.test/ws', MAPS_KEY: 'k' });
  });

  it('throws one clear error naming every missing key', () => {
    expect(() => readEnv({ WS_URL: valid.WS_URL, MAPS_KEY: '  ' })).toThrow(
      /Missing required config: API_URL, MAPS_KEY/,
    );
  });

  it('throws when the native config is empty or absent (env file not found at build time)', () => {
    expect(() => readEnv({})).toThrow(/API_URL, WS_URL, MAPS_KEY/);
    expect(() => readEnv(undefined)).toThrow(/Missing required config/);
  });

  it('never puts config values in the error message', () => {
    expect(() => readEnv({ API_URL: 'https://api.raah.test/api', WS_URL: 'wss://x.test' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('api.raah.test') }),
    );
  });

  it('rejects URLs with the wrong scheme', () => {
    expect(() => readEnv({ ...valid, API_URL: 'localhost:8000/api' })).toThrow(/API_URL must start/);
    expect(() => readEnv({ ...valid, WS_URL: 'http://localhost:8080' })).toThrow(/WS_URL must start/);
  });
});

describe('env', () => {
  it('is built from react-native-config (Jest mock values)', () => {
    expect(env).toEqual({
      API_URL: 'https://api.raah.test/api',
      WS_URL: 'wss://api.raah.test/ws',
      MAPS_KEY: 'test-maps-key',
    });
  });
});
