import { apiClient, onSessionAuthRefusal } from '../../services/api';
import { onSessionEpochChange } from '../../store/sessionEpoch';
import { isRecord, readText } from '../api/read';
import { logger } from '../logging/logger';
import type { ChannelAuth, RealtimeClientFactory } from './echoClient';
import { RealtimeManager } from './manager';

/**
 * T-406: the app's realtime connection. POST /broadcasting/auth goes through the shared axios
 * client, so it carries the session's bearer token (same origin as API_URL) and its 401/403
 * are handled like any other request's.
 */
export const authorizeChannel = async (endpoint: string, channelName: string, socketId: string): Promise<ChannelAuth> => {
  const response = await apiClient.post<unknown>(endpoint, { socket_id: socketId, channel_name: channelName });
  const body = response.data;
  const auth = isRecord(body) ? readText(body.auth) : null;
  if (!isRecord(body) || auth === null) throw new Error('Invalid channel authorization');
  const channelData = readText(body.channel_data);
  return channelData === null ? { auth } : { auth, channel_data: channelData };
};

/**
 * laravel-echo and pusher-js load on the first connect, not at app start (cold start, PERF):
 * a signed-out user or a server with realtime off never loads them.
 */
const createClient: RealtimeClientFactory = (config, authorize) => {
  const { createEchoClient }: typeof import('./echoClient') = require('./echoClient');
  return createEchoClient(config, authorize);
};

export const realtime = new RealtimeManager({
  createClient,
  authorize: (config, channelName, socketId) => authorizeChannel(config.authEndpoint, channelName, socketId),
});

// Logout and every session start drop all channels and timers (T-104 epoch).
onSessionEpochChange(() => {
  try {
    realtime.reset();
  } catch (error) {
    // Never break the epoch listeners; logout also resets explicitly and reports a failure.
    logger.debug('[realtime] reset on session change failed', { name: error instanceof Error ? error.name : typeof error });
  }
});
// SEC-35: any 401/403 of this session drops the subscriptions; they are re-authorized later.
onSessionAuthRefusal(() => realtime.revoke());

export { RealtimeManager } from './manager';
export type { ChannelHandlers } from './manager';
