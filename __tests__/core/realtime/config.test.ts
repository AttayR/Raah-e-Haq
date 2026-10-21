/**
 * T-406: realtime settings come from env; the server's meta.realtime is accepted only when it
 * describes the same origin, and only wss in release builds.
 */
import { readRealtimeMeta, resolveRealtimeConfig, type RealtimeMeta } from '../../../src/core/realtime/config';

const LOCAL_ENV = { API_URL: 'http://127.0.0.1:8000/api', WS_URL: 'ws://127.0.0.1:8080', WS_APP_KEY: 'raah-local' };
const PROD_ENV = { API_URL: 'https://raahehaq.test/api', WS_URL: 'wss://raahehaq.test', WS_APP_KEY: 'raah-key' };

const meta = (over: Partial<RealtimeMeta> = {}): RealtimeMeta => ({
  enabled: true,
  protocol: 'pusher',
  key: 'raah-local',
  host: '127.0.0.1',
  port: 8080,
  scheme: 'http',
  websocketUrl: 'ws://127.0.0.1:8080/app/raah-local',
  ...over,
});

describe('readRealtimeMeta', () => {
  it('reads meta.realtime of GET /settings/public', () => {
    expect(
      readRealtimeMeta({
        success: true,
        data: [],
        meta: {
          realtime: {
            enabled: true,
            protocol: 'pusher',
            key: 'raah-key',
            host: 'RaaheHaq.test',
            port: '443',
            scheme: 'HTTPS',
            websocket_url: 'wss://raahehaq.test/app/raah-key',
            auth_endpoint: 'https://evil.test/broadcasting/auth',
          },
        },
      }),
    ).toEqual({
      enabled: true,
      protocol: 'pusher',
      key: 'raah-key',
      host: 'raahehaq.test',
      port: 443,
      scheme: 'https',
      websocketUrl: 'wss://raahehaq.test/app/raah-key',
    });
  });

  it('is null without meta.realtime, and `enabled` is only a literal true', () => {
    expect(readRealtimeMeta({ success: true, data: [] })).toBeNull();
    expect(readRealtimeMeta(null)).toBeNull();
    expect(readRealtimeMeta({ meta: { realtime: { enabled: 'true' } } })?.enabled).toBe(false);
  });
});

describe('resolveRealtimeConfig', () => {
  it('local Debug: connects to the env origin; the auth endpoint is the API origin without /api', () => {
    expect(resolveRealtimeConfig(meta(), LOCAL_ENV, { release: false })).toEqual({
      ok: true,
      config: {
        key: 'raah-local',
        host: '127.0.0.1',
        port: 8080,
        scheme: 'http',
        wsPath: '',
        authEndpoint: 'http://127.0.0.1:8000/broadcasting/auth',
      },
    });
  });

  it('production: wss://host/app/{key} (no path), forceTLS scheme https', () => {
    const resolved = resolveRealtimeConfig(
      meta({ key: 'raah-key', host: 'raahehaq.test', port: 443, scheme: 'https', websocketUrl: 'wss://raahehaq.test/app/raah-key' }),
      PROD_ENV,
      { release: true },
    );
    expect(resolved).toEqual({
      ok: true,
      config: {
        key: 'raah-key',
        host: 'raahehaq.test',
        port: 443,
        scheme: 'https',
        wsPath: '',
        authEndpoint: 'https://raahehaq.test/broadcasting/auth',
      },
    });
  });

  it('does not connect when the server disabled realtime or sent no meta (keep polling)', () => {
    expect(resolveRealtimeConfig(meta({ enabled: false }), LOCAL_ENV, { release: false })).toEqual({
      ok: false,
      reason: 'server_disabled',
    });
    expect(resolveRealtimeConfig(null, LOCAL_ENV, { release: false })).toEqual({ ok: false, reason: 'no_meta' });
  });

  it('does not connect without an env key or with another protocol', () => {
    expect(resolveRealtimeConfig(meta(), { ...LOCAL_ENV, WS_APP_KEY: ' ' }, { release: false }).ok).toBe(false);
    expect(resolveRealtimeConfig(meta({ protocol: 'socket.io' }), LOCAL_ENV, { release: false })).toEqual({
      ok: false,
      reason: 'protocol_mismatch',
    });
  });

  it('refuses server values that differ from the env origin (host, port, scheme, key)', () => {
    const cases: Array<Partial<RealtimeMeta>> = [
      { host: 'evil.test' },
      { port: 6001 },
      { scheme: 'https' },
      { key: 'other-key' },
    ];
    cases.forEach((over) => {
      expect(resolveRealtimeConfig(meta(over), LOCAL_ENV, { release: false })).toEqual({
        ok: false,
        reason: 'origin_mismatch',
      });
    });
  });

  it('refuses a websocket_url that is not {env origin}/app/{key} (e.g. an old /ws path)', () => {
    const prod = meta({ key: 'raah-key', host: 'raahehaq.test', port: 443, scheme: 'https' });
    ['wss://raahehaq.test/ws/app/raah-key', 'wss://raahehaq.test:8443/app/raah-key', 'wss://other.test/app/raah-key', 'ws://raahehaq.test/app/raah-key', 'wss://raahehaq.test/app/other']
      .forEach((websocketUrl) => {
        expect(resolveRealtimeConfig({ ...prod, websocketUrl }, PROD_ENV, { release: true })).toEqual({
          ok: false,
          reason: 'origin_mismatch',
        });
      });
    // An env with a proxy path must match the advertised URL's path too.
    expect(
      resolveRealtimeConfig({ ...prod, websocketUrl: 'wss://raahehaq.test/app/raah-key' }, { ...PROD_ENV, WS_URL: 'wss://raahehaq.test/ws' }, { release: true }),
    ).toEqual({ ok: false, reason: 'origin_mismatch' });
    expect(resolveRealtimeConfig({ ...prod, websocketUrl: 'wss://raahehaq.test/app/raah-key?protocol=7' }, PROD_ENV, { release: true }).ok).toBe(true);
    expect(resolveRealtimeConfig({ ...prod, websocketUrl: null }, PROD_ENV, { release: true }).ok).toBe(true);
  });

  it('Debug treats the loopback names as one host (Android emulator 10.0.2.2); release does not', () => {
    const android = { ...LOCAL_ENV, API_URL: 'http://10.0.2.2:8000/api', WS_URL: 'ws://10.0.2.2:8080' };
    const resolved = resolveRealtimeConfig(meta({ host: '127.0.0.1' }), android, { release: false });
    expect(resolved.ok).toBe(true);
    expect(resolved.ok && resolved.config.host).toBe('10.0.2.2');
    const releaseEnv = { API_URL: 'https://10.0.2.2/api', WS_URL: 'wss://10.0.2.2', WS_APP_KEY: 'raah-local' };
    expect(
      resolveRealtimeConfig(meta({ host: '127.0.0.1', port: 443, scheme: 'https', websocketUrl: null }), releaseEnv, { release: true }),
    ).toEqual({ ok: false, reason: 'origin_mismatch' });
  });

  it('release builds accept only wss (and an https API)', () => {
    expect(resolveRealtimeConfig(meta(), LOCAL_ENV, { release: true })).toEqual({ ok: false, reason: 'insecure_in_release' });
  });

  it('a malformed WS_URL keeps realtime off', () => {
    expect(resolveRealtimeConfig(meta(), { ...LOCAL_ENV, WS_URL: 'ws://127.0.0.1:99999' }, { release: false })).toEqual({
      ok: false,
      reason: 'bad_env',
    });
  });
});
