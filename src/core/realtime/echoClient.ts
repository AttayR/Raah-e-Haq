import Echo from 'laravel-echo';
import PusherModule from 'pusher-js/react-native';
import type { ChannelAuthorizationCallback, ChannelAuthorizationHandler } from 'pusher-js/react-native';
import type { RealtimeConfig } from './config';

/**
 * T-406: the only file that touches laravel-echo / pusher-js. The manager talks to the small
 * `RealtimeClient` interface, so tests swap this factory for a fake.
 */

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed';

/** The answer of POST /broadcasting/auth. */
export interface ChannelAuth {
  auth: string;
  channel_data?: string;
}

/** Signs one private channel subscription (`channelName` with its `private-` prefix). */
export type ChannelAuthorizer = (channelName: string, socketId: string) => Promise<ChannelAuth>;

export interface RealtimeClient {
  /** Listens on `private-{channel}` for `event` (the broadcast name, without the leading dot). */
  listen(channel: string, event: string, handler: (payload: unknown) => void): void;
  /** Unsubscribes `private-{channel}`. */
  leave(channel: string): void;
  onStatus(listener: (status: RealtimeStatus) => void): () => void;
  disconnect(): void;
}

export type RealtimeClientFactory = (config: RealtimeConfig, authorize: ChannelAuthorizer) => RealtimeClient;

type PusherClass = typeof PusherModule;

const isPusherClass = (value: unknown): value is PusherClass => typeof value === 'function';

/**
 * pusher-js's React Native bundle sets `module.exports.Pusher` (no `default`), while its types
 * declare a default export; accept either shape.
 */
const resolvePusher = (mod: unknown): PusherClass | null => {
  if (isPusherClass(mod)) return mod;
  if (typeof mod === 'object' && mod !== null && 'Pusher' in mod && isPusherClass(mod.Pusher)) return mod.Pusher;
  return null;
};

export const createEchoClient: RealtimeClientFactory = (config, authorize) => {
  const Pusher = resolvePusher(PusherModule);
  if (!Pusher) throw new Error('pusher-js is not available');

  const customHandler: ChannelAuthorizationHandler = ({ channelName, socketId }, callback: ChannelAuthorizationCallback) => {
    authorize(channelName, socketId).then(
      (data) => callback(null, data),
      (error: unknown) => callback(error instanceof Error ? error : new Error('Channel authorization failed'), null),
    );
  };

  const echo = new Echo({
    broadcaster: 'reverb',
    key: config.key,
    wsHost: config.host,
    wsPort: config.port,
    wssPort: config.port,
    wsPath: config.wsPath === '' ? undefined : config.wsPath,
    forceTLS: config.scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
    authEndpoint: config.authEndpoint,
    // The request goes through the app's axios client (bearer token, 401/403 handling).
    channelAuthorization: { customHandler },
    // No global axios / jQuery interceptors in the app.
    withoutInterceptors: true,
    Pusher,
  });

  return {
    listen(channel, event, handler) {
      echo.private(channel).listen(`.${event}`, handler);
    },
    leave(channel) {
      echo.leaveChannel(`private-${channel}`);
    },
    onStatus(listener) {
      return echo.connector.onConnectionChange(listener);
    },
    disconnect() {
      echo.leaveAllChannels();
      echo.disconnect();
    },
  };
};
