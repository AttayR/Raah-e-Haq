import Config from 'react-native-config';

/**
 * Single source of truth for environment configuration (API/WS URLs, keys).
 *
 * Values come from the `.env.*` file selected at build time by react-native-config:
 * Debug builds read `.env.development`, Release builds read `.env.production`.
 * See `.env.example` for the keys and how to pick another file (ENVFILE).
 */
export interface Env {
  /** REST API base URL, without a trailing slash, e.g. https://raahehaq.com/api */
  API_URL: string;
  /** WebSocket base URL, without a trailing slash, e.g. wss://raahehaq.com/ws */
  WS_URL: string;
  /** Google Maps / Places / Directions key */
  MAPS_KEY: string;
}

const REQUIRED_KEYS: ReadonlyArray<keyof Env> = ['API_URL', 'WS_URL', 'MAPS_KEY'];

type EnvSource = Record<string, string | undefined>;

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

/**
 * Validates a raw config object and returns a typed `Env`.
 * Throws one error naming every missing key (never the values).
 */
export function readEnv(source: EnvSource | null | undefined): Env {
  const raw = source ?? {};
  const value = (key: keyof Env): string => (raw[key] ?? '').trim();

  const missing = REQUIRED_KEYS.filter(key => value(key) === '');
  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required config: ${missing.join(', ')}. ` +
        'Create the env file for this build (Debug: .env.development, Release: .env.production) ' +
        'from .env.example, then rebuild the native app.',
    );
  }

  const apiUrl = stripTrailingSlash(value('API_URL'));
  const wsUrl = stripTrailingSlash(value('WS_URL'));

  if (!/^https?:\/\//.test(apiUrl)) {
    throw new Error('[env] API_URL must start with http:// or https://');
  }
  if (!/^wss?:\/\//.test(wsUrl)) {
    throw new Error('[env] WS_URL must start with ws:// or wss://');
  }

  return {API_URL: apiUrl, WS_URL: wsUrl, MAPS_KEY: value('MAPS_KEY')};
}

export const env: Env = readEnv(Config);

export default env;
