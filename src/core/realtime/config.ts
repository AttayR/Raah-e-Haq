import { isRecord, readNumberOrNull, readText } from '../api/read';

/**
 * T-406 / BE-12: the realtime connection settings (Laravel Reverb over the Pusher protocol).
 *
 * The app connects only with its own env values (WS_URL + WS_APP_KEY, src/config/env.ts). The
 * server's `meta.realtime` of GET /settings/public says whether realtime is on and is accepted
 * only when it describes the same origin; anything else keeps the app on polling.
 */

/** `meta.realtime` of GET /settings/public, as sent (every field optional on the wire). */
export interface RealtimeMeta {
  enabled: boolean;
  protocol: string | null;
  key: string | null;
  host: string | null;
  port: number | null;
  scheme: string | null;
  /** The full socket URL the server advertises, e.g. wss://raahehaq.com/app/{key}. */
  websocketUrl: string | null;
}

/** What the client connects with. */
export interface RealtimeConfig {
  key: string;
  host: string;
  port: number;
  /** https -> wss (forceTLS), http -> ws. */
  scheme: 'http' | 'https';
  /** Path prefix in front of /app/{key}; '' for none (BE-12 serves wss://raahehaq.com/app/{key}). */
  wsPath: string;
  /** <API origin>/broadcasting/auth (no /api prefix). */
  authEndpoint: string;
}

export interface RealtimeEnv {
  API_URL: string;
  WS_URL: string;
  WS_APP_KEY: string;
}

export interface ResolveOptions {
  /** Release build: only wss (https) is accepted. */
  release: boolean;
}

/** Why realtime stays off (logged once, never with values). */
export type RealtimeOffReason =
  | 'server_disabled'
  | 'no_meta'
  | 'no_key'
  | 'bad_env'
  | 'insecure_in_release'
  | 'protocol_mismatch'
  | 'origin_mismatch';

export type ResolvedRealtime = { ok: true; config: RealtimeConfig } | { ok: false; reason: RealtimeOffReason };

/** Reads `meta.realtime` from the GET /settings/public body; null when it is absent or malformed. */
export const readRealtimeMeta = (body: unknown): RealtimeMeta | null => {
  if (!isRecord(body) || !isRecord(body.meta) || !isRecord(body.meta.realtime)) return null;
  const raw = body.meta.realtime;
  const port = readNumberOrNull(raw.port);
  return {
    enabled: raw.enabled === true,
    protocol: readText(raw.protocol),
    key: readText(raw.key),
    host: readText(raw.host)?.trim().toLowerCase() ?? null,
    port: port !== null && Number.isInteger(port) ? port : null,
    scheme: readText(raw.scheme)?.trim().toLowerCase() ?? null,
    websocketUrl: readText(raw.websocket_url)?.trim() ?? null,
  };
};

interface ParsedOrigin {
  scheme: 'http' | 'https';
  host: string;
  port: number;
  path: string;
}

/** ws(s)://host[:port][/path] from WS_URL. A regex, as React Native's URL lacks `origin`. */
export const parseWsUrl = (url: string): ParsedOrigin | null => {
  const match = /^(wss?):\/\/(\[[0-9a-f:.]+\]|[a-z0-9.-]+)(?::(\d{1,5}))?(\/[^?#]*)?$/i.exec(url.trim());
  if (!match) return null;
  const scheme = match[1].toLowerCase() === 'wss' ? 'https' : 'http';
  const port = match[3] !== undefined ? Number(match[3]) : scheme === 'https' ? 443 : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  const path = (match[4] ?? '').replace(/\/+$/, '');
  return { scheme, host: match[2].toLowerCase(), port, path };
};

/** "scheme://host[:port]" of API_URL (the auth endpoint has no /api prefix). */
export const apiOriginOf = (apiUrl: string): string | null => {
  const match = /^(https?):\/\/([^/?#]+)/i.exec(apiUrl.trim());
  return match ? `${match[1].toLowerCase()}://${match[2].toLowerCase()}` : null;
};

/**
 * Loopback names that mean the same local Reverb in a Debug build: the iOS simulator uses
 * 127.0.0.1 / localhost, the Android emulator reaches the Mac at 10.0.2.2, while the server
 * reports its own REVERB_HOST.
 */
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost', '10.0.2.2', '[::1]']);

const sameHost = (envHost: string, serverHost: string, release: boolean): boolean =>
  envHost === serverHost || (!release && LOOPBACK_HOSTS.has(envHost) && LOOPBACK_HOSTS.has(serverHost));

/**
 * The server's `websocket_url` must be exactly where pusher-js will connect:
 * {scheme}://{host}:{port}{wsPath}/app/{key} (query ignored). Anything else would only fail
 * and retry, so it keeps the app on polling instead.
 */
const sameSocketUrl = (url: string, origin: ParsedOrigin, key: string, release: boolean): boolean => {
  const server = parseWsUrl(url.split(/[?#]/)[0]);
  return (
    server !== null &&
    server.scheme === origin.scheme &&
    server.port === origin.port &&
    sameHost(origin.host, server.host, release) &&
    server.path === `${origin.path}/app/${key}`
  );
};

/**
 * The connection settings, or why realtime stays off. The server must say `enabled` and the
 * Pusher protocol; each of key, host, port, scheme and websocket_url it sends must match the env value (a
 * field it leaves out is taken from env). A release build accepts only https (wss).
 */
export const resolveRealtimeConfig = (
  meta: RealtimeMeta | null,
  env: RealtimeEnv,
  { release }: ResolveOptions,
): ResolvedRealtime => {
  if (!meta) return { ok: false, reason: 'no_meta' };
  if (!meta.enabled) return { ok: false, reason: 'server_disabled' };
  if (meta.protocol !== null && meta.protocol !== 'pusher') return { ok: false, reason: 'protocol_mismatch' };
  const key = env.WS_APP_KEY.trim();
  if (key === '') return { ok: false, reason: 'no_key' };
  const origin = parseWsUrl(env.WS_URL);
  const apiOrigin = apiOriginOf(env.API_URL);
  if (!origin || !apiOrigin) return { ok: false, reason: 'bad_env' };
  if (release && (origin.scheme !== 'https' || !apiOrigin.startsWith('https://'))) {
    return { ok: false, reason: 'insecure_in_release' };
  }
  if (
    (meta.key !== null && meta.key !== key) ||
    (meta.host !== null && !sameHost(origin.host, meta.host, release)) ||
    (meta.port !== null && meta.port !== origin.port) ||
    (meta.scheme !== null && meta.scheme !== origin.scheme) ||
    (meta.websocketUrl !== null && !sameSocketUrl(meta.websocketUrl, origin, key, release))
  ) {
    return { ok: false, reason: 'origin_mismatch' };
  }
  return {
    ok: true,
    config: {
      key,
      host: origin.host,
      port: origin.port,
      scheme: origin.scheme,
      wsPath: origin.path,
      authEndpoint: `${apiOrigin}/broadcasting/auth`,
    },
  };
};
