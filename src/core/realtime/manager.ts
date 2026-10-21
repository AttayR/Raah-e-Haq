import { AppState, type AppStateStatus } from 'react-native';
import { isApiError } from '../api/errors';
import { logger } from '../logging/logger';
import type { RealtimeConfig } from './config';
import type { ChannelAuth, ChannelAuthorizer, RealtimeClient, RealtimeClientFactory, RealtimeStatus } from './echoClient';
import type { RealtimeEventName } from './events';

/**
 * T-406: the one realtime connection (Laravel Reverb, Pusher protocol), replacing the old
 * per-feature sockets of webSocketService (T-102/T-106 review: untracked reconnect timers,
 * unsubscribe reconnecting, sockets alive after logout).
 *
 * - Hooks say which private channels they want (`subscribe`, reference counted per channel);
 *   the manager connects while at least one is wanted, the server enabled realtime
 *   (`configure`) and the app is in the foreground, and disconnects otherwise.
 * - A dropped or failed connection reconnects after a capped, jittered back-off. There is at
 *   most one reconnect timer; it is stored and cleared on every teardown (reset, background,
 *   configure(null), last unsubscribe), so nothing reconnects after logout.
 * - Every client gets a generation: callbacks of a client that was torn down (status changes,
 *   channel auth answers that land late) are ignored.
 * - SEC-35: authorization is checked only when a channel is subscribed, so any 401/403 of the
 *   session (`revoke`) drops the connection and every subscription; the reconnect subscribes
 *   again with a fresh /broadcasting/auth. A channel whose auth was refused (401/403) is not
 *   subscribed again in this session (`refused`).
 * - A 429 from /broadcasting/auth backs off like a dropped connection (at least its
 *   Retry-After) and subscribes again on the next connection.
 * - `reset` (logout, session epoch change) forgets everything: channels, config, timers.
 *
 * Nothing here logs tokens, channel auth signatures, payloads or coordinates.
 */

export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;

type Handler = (payload: unknown) => void;
export type ChannelHandlers = Partial<Record<RealtimeEventName, Handler>>;

interface AppStateLike {
  currentState: AppStateStatus | null | undefined;
  addEventListener(type: 'change', listener: (state: AppStateStatus) => void): { remove(): void };
}

export interface RealtimeManagerDeps {
  createClient: RealtimeClientFactory;
  /** POST /broadcasting/auth for `config`'s server. */
  authorize: (config: RealtimeConfig, channelName: string, socketId: string) => Promise<ChannelAuth>;
  appState?: AppStateLike;
  /** 0..1, for the jitter (tests pass a fixed value). */
  random?: () => number;
}

/** The back-off before reconnect attempt `attempt` (0-based): doubling, capped, ±25% jitter. */
export const reconnectDelay = (attempt: number, random: number): number => {
  const base = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** Math.min(attempt, 16));
  return Math.min(RECONNECT_MAX_MS, Math.round(base * (0.75 + 0.5 * random)));
};

const isAuthRefusal = (error: unknown): boolean =>
  isApiError(error) && (error.status === 401 || error.status === 403);

export class RealtimeManager {
  private readonly deps: RealtimeManagerDeps;
  private config: RealtimeConfig | null = null;
  private configuredEpoch: number | null = null;
  /** channel -> event -> handlers of every live `subscribe` call. */
  private readonly wanted = new Map<string, Map<RealtimeEventName, Set<Handler>>>();
  /** Channels (and their events) bound on the current client. */
  private attached = new Map<string, Set<RealtimeEventName>>();
  private readonly refused = new Set<string>();
  private client: RealtimeClient | null = null;
  private offStatus: (() => void) | null = null;
  private generation = 0;
  /** Moves on with every reset, so an unsubscribe of an ended session does nothing. */
  private session = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  /** Until when a 429 from /broadcasting/auth holds reconnects back (ms epoch). */
  private holdUntil = 0;
  private status: RealtimeStatus = 'disconnected';
  private appActive = true;
  private appStateSubscription: { remove(): void } | null = null;

  constructor(deps: RealtimeManagerDeps) {
    this.deps = deps;
  }

  /**
   * The server's answer for this session (`null`: realtime off, keep polling). The epoch is
   * the session it was read in.
   */
  configure(config: RealtimeConfig | null, epoch: number): void {
    this.config = config;
    this.configuredEpoch = epoch;
    if (!config) {
      this.clearReconnect();
      this.teardownClient();
      return;
    }
    this.listenToAppState();
    this.sync();
  }

  /** True once `configure` ran for this session epoch (enabled or not). */
  isConfiguredFor(epoch: number): boolean {
    return this.configuredEpoch === epoch;
  }

  /** Wants `handlers` on `private-{channel}` until the returned function is called. */
  subscribe(channel: string, handlers: ChannelHandlers): () => void {
    const session = this.session;
    let events = this.wanted.get(channel);
    if (!events) {
      events = new Map();
      this.wanted.set(channel, events);
    }
    const added: Array<[RealtimeEventName, Handler]> = [];
    (Object.keys(handlers) as RealtimeEventName[]).forEach((event) => {
      const handler = handlers[event];
      if (!handler) return;
      let set = events?.get(event);
      if (!set) {
        set = new Set();
        events?.set(event, set);
      }
      set.add(handler);
      added.push([event, handler]);
    });
    this.sync();
    this.attachChannel(channel);

    let done = false;
    return () => {
      if (done || session !== this.session) return;
      done = true;
      this.unsubscribe(channel, added);
    };
  }

  /**
   * SEC-35: a 401/403 of the current session (any API route or /broadcasting/auth): drop the
   * connection and every subscription now; subscribe again later with a fresh auth.
   */
  revoke(): void {
    if (!this.client && this.reconnectTimer === null) return;
    logger.debug('[realtime] authorization refused: reconnecting with a fresh auth');
    this.scheduleReconnect();
  }

  /**
   * The network is back (NetInfo / the server answers again): a back-off from the outage no
   * longer applies, so reconnect now. A 429's hold is kept.
   */
  retryNow(): void {
    if (Date.now() < this.holdUntil) return;
    this.clearReconnect();
    this.attempts = 0;
    this.sync();
  }

  /** Logout / session change: everything goes, and nothing reconnects. */
  reset(): void {
    this.session += 1;
    this.clearReconnect();
    this.teardownClient();
    this.wanted.clear();
    this.refused.clear();
    this.config = null;
    this.configuredEpoch = null;
    this.attempts = 0;
    this.holdUntil = 0;
    this.appStateSubscription?.remove();
    this.appStateSubscription = null;
  }

  getStatus(): RealtimeStatus {
    return this.client ? this.status : 'disconnected';
  }

  isConnected(): boolean {
    return this.client !== null && this.status === 'connected';
  }

  /** Tests and diagnostics. */
  debugState(): { channels: string[]; attached: string[]; reconnectPending: boolean; attempts: number; refused: string[] } {
    return {
      channels: [...this.wanted.keys()],
      attached: [...this.attached.keys()],
      reconnectPending: this.reconnectTimer !== null,
      attempts: this.attempts,
      refused: [...this.refused],
    };
  }

  private unsubscribe(channel: string, added: Array<[RealtimeEventName, Handler]>): void {
    const events = this.wanted.get(channel);
    if (!events) return;
    added.forEach(([event, handler]) => {
      const set = events.get(event);
      set?.delete(handler);
      if (set && set.size === 0) events.delete(event);
    });
    if (events.size > 0) return;
    this.wanted.delete(channel);
    if (this.attached.has(channel)) {
      this.attached.delete(channel);
      try {
        this.client?.leave(channel);
      } catch (error) {
        // Leaving a channel of a closing socket: nothing else to do.
        logger.debug('[realtime] leave failed', { name: error instanceof Error ? error.name : typeof error });
      }
    }
    if (this.wanted.size === 0) {
      this.clearReconnect();
      this.teardownClient();
    }
  }

  private shouldConnect(): boolean {
    return this.config !== null && this.appActive && this.wanted.size > 0 && this.reconnectTimer === null;
  }

  private sync(): void {
    if (!this.shouldConnect()) {
      if (this.client && (!this.appActive || this.wanted.size === 0 || !this.config)) this.teardownClient();
      return;
    }
    if (this.client || !this.config) return;
    const generation = ++this.generation;
    let client: RealtimeClient;
    try {
      client = this.deps.createClient(this.config, this.authorizeFor(generation, this.config));
    } catch (error) {
      logger.warn('[realtime] could not start the client', { name: error instanceof Error ? error.name : typeof error });
      this.scheduleReconnect();
      return;
    }
    this.client = client;
    this.status = 'connecting';
    this.attached = new Map();
    this.offStatus = client.onStatus((status) => this.onStatus(generation, status));
    [...this.wanted.keys()].forEach((channel) => this.attachChannel(channel));
  }

  private attachChannel(channel: string): void {
    const client = this.client;
    const events = this.wanted.get(channel);
    if (!client || !events || this.refused.has(channel)) return;
    let bound = this.attached.get(channel);
    if (!bound) {
      bound = new Set();
      this.attached.set(channel, bound);
    }
    for (const event of events.keys()) {
      if (bound.has(event)) continue;
      bound.add(event);
      client.listen(channel, event, (payload) => this.dispatch(client, channel, event, payload));
    }
  }

  private dispatch(client: RealtimeClient, channel: string, event: RealtimeEventName, payload: unknown): void {
    if (client !== this.client) return;
    const handlers = this.wanted.get(channel)?.get(event);
    if (!handlers) return;
    [...handlers].forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        logger.warn('[realtime] event handler failed', { event, name: error instanceof Error ? error.name : typeof error });
      }
    });
  }

  private onStatus(generation: number, status: RealtimeStatus): void {
    if (generation !== this.generation || !this.client) return;
    this.status = status;
    if (status === 'connected') {
      this.attempts = 0;
    } else if (status === 'failed' || status === 'disconnected') {
      // Not ours (we unbind before an intentional disconnect): back off and reconnect.
      this.scheduleReconnect();
    }
  }

  private authorizeFor(generation: number, config: RealtimeConfig): ChannelAuthorizer {
    return async (channelName: string, socketId: string): Promise<ChannelAuth> => {
      if (generation !== this.generation) throw new Error('Realtime client closed');
      const channel = channelName.replace(/^private-/, '');
      try {
        const auth = await this.deps.authorize(config, channelName, socketId);
        if (generation !== this.generation) throw new Error('Realtime client closed');
        return auth;
      } catch (error) {
        if (isAuthRefusal(error)) {
          // Not (or no longer) allowed on this channel: never ask for it again this session.
          this.refused.add(channel);
          this.attached.delete(channel);
        } else if (isApiError(error) && error.kind === 'rate_limited' && generation === this.generation) {
          // BE-12: 30 auths a minute per user. Back off (at least its Retry-After), then
          // subscribe everything again on a new connection.
          this.scheduleReconnect((error.retryAfter ?? 0) * 1000);
        }
        throw error;
      }
    };
  }

  private scheduleReconnect(minDelayMs = 0): void {
    this.teardownClient();
    if (this.reconnectTimer !== null || !this.config || this.wanted.size === 0 || !this.appActive) return;
    const delay = Math.max(minDelayMs, reconnectDelay(this.attempts, (this.deps.random ?? Math.random)()));
    if (minDelayMs > 0) this.holdUntil = Date.now() + delay;
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.sync();
    }, delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private teardownClient(): void {
    const client = this.client;
    this.generation += 1;
    this.client = null;
    this.attached = new Map();
    this.status = 'disconnected';
    // Unbind first, so our own disconnect is never read as a drop that needs a reconnect.
    this.offStatus?.();
    this.offStatus = null;
    if (!client) return;
    try {
      client.disconnect();
    } catch (error) {
      // Already closed.
      logger.debug('[realtime] disconnect failed', { name: error instanceof Error ? error.name : typeof error });
    }
  }

  private listenToAppState(): void {
    if (this.appStateSubscription) return;
    const appState = this.deps.appState ?? AppState;
    this.appActive = appState.currentState !== 'background';
    this.appStateSubscription = appState.addEventListener('change', (next) => {
      // iOS `inactive` is a short transition with the app still visible; only background stops.
      const active = next !== 'background';
      if (active === this.appActive) return;
      this.appActive = active;
      if (!active) {
        this.clearReconnect();
        this.teardownClient();
        this.attempts = 0;
      } else {
        this.sync();
      }
    });
  }
}
