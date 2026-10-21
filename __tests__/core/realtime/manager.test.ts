/**
 * T-406: the realtime manager with a fake Echo client: subscription lifecycle, reconnect
 * back-off with tracked timers, AppState, logout, and SEC-35 (401/403 drops subscriptions).
 */
import type { AppStateStatus } from 'react-native';
import { ApiError } from '../../../src/core/api/errors';
import type { RealtimeConfig } from '../../../src/core/realtime/config';
import type { ChannelAuthorizer, RealtimeClient, RealtimeStatus } from '../../../src/core/realtime/echoClient';
import { RealtimeManager, RECONNECT_MAX_MS, reconnectDelay } from '../../../src/core/realtime/manager';

const CONFIG: RealtimeConfig = {
  key: 'raah-local',
  host: '127.0.0.1',
  port: 8080,
  scheme: 'http',
  wsPath: '',
  authEndpoint: 'http://127.0.0.1:8000/broadcasting/auth',
};

class FakeClient implements RealtimeClient {
  listeners: Array<{ channel: string; event: string; handler: (payload: unknown) => void }> = [];
  left: string[] = [];
  disconnected = false;
  statusListener: ((status: RealtimeStatus) => void) | null = null;
  constructor(public readonly authorize: ChannelAuthorizer) {}
  listen(channel: string, event: string, handler: (payload: unknown) => void) {
    this.listeners.push({ channel, event, handler });
  }
  leave(channel: string) {
    this.left.push(channel);
  }
  onStatus(listener: (status: RealtimeStatus) => void) {
    this.statusListener = listener;
    return () => {
      this.statusListener = null;
    };
  }
  disconnect() {
    this.disconnected = true;
  }
  emit(channel: string, event: string, payload: unknown) {
    this.listeners.filter((l) => l.channel === channel && l.event === event).forEach((l) => l.handler(payload));
  }
  status(status: RealtimeStatus) {
    this.statusListener?.(status);
  }
}

const setup = () => {
  const clients: FakeClient[] = [];
  let appStateListener: ((state: AppStateStatus) => void) | null = null;
  const appState = {
    currentState: 'active' as AppStateStatus,
    addEventListener: jest.fn((_type: 'change', listener: (state: AppStateStatus) => void) => {
      appStateListener = listener;
      return {
        remove: () => {
          appStateListener = null;
        },
      };
    }),
  };
  const authorize = jest.fn().mockResolvedValue({ auth: 'raah-local:sig' });
  const manager = new RealtimeManager({
    createClient: (_config, auth) => {
      const client = new FakeClient(auth);
      clients.push(client);
      return client;
    },
    authorize,
    appState,
    random: () => 0.5,
  });
  return {
    manager,
    clients,
    authorize,
    last: () => clients[clients.length - 1],
    setAppState: (state: AppStateStatus) => appStateListener?.(state),
    hasAppStateListener: () => appStateListener !== null,
  };
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('reconnectDelay', () => {
  it('doubles from 1 s with ±25% jitter and is capped', () => {
    expect(reconnectDelay(0, 0.5)).toBe(1000);
    expect(reconnectDelay(1, 0.5)).toBe(2000);
    expect(reconnectDelay(0, 0)).toBe(750);
    expect(reconnectDelay(0, 1)).toBe(1250);
    expect(reconnectDelay(10, 1)).toBe(RECONNECT_MAX_MS);
    expect(reconnectDelay(1000, 0.5)).toBe(RECONNECT_MAX_MS);
  });
});

describe('RealtimeManager', () => {
  it('does not connect while realtime is off (not configured, or configured null)', () => {
    const { manager, clients } = setup();
    manager.subscribe('user.9', { 'notification.created': jest.fn() });
    expect(clients).toHaveLength(0);
    manager.configure(null, 1);
    expect(clients).toHaveLength(0);
    expect(manager.isConfiguredFor(1)).toBe(true);
    expect(manager.getStatus()).toBe('disconnected');
  });

  it('connects once channels are wanted, listens with the event names, and fans events out', () => {
    const { manager, clients, last } = setup();
    manager.configure(CONFIG, 1);
    expect(clients).toHaveLength(0);

    const onNotification = jest.fn();
    const onChat = jest.fn();
    manager.subscribe('user.9', { 'notification.created': onNotification, 'chat.message': onChat });
    expect(clients).toHaveLength(1);
    expect(last().listeners.map((l) => `${l.channel}:${l.event}`)).toEqual([
      'user.9:notification.created',
      'user.9:chat.message',
    ]);

    // A second subscriber of the same channel shares the subscription.
    const second = jest.fn();
    const off = manager.subscribe('user.9', { 'notification.created': second });
    expect(last().listeners).toHaveLength(2);
    last().emit('user.9', 'notification.created', { id: 1 });
    expect(onNotification).toHaveBeenCalledWith({ id: 1 });
    expect(second).toHaveBeenCalledTimes(1);
    off();
    last().emit('user.9', 'notification.created', { id: 2 });
    expect(second).toHaveBeenCalledTimes(1);
    expect(onNotification).toHaveBeenCalledTimes(2);
  });

  it('leaves a channel when its last subscriber goes and disconnects with none left, without reconnecting', () => {
    const { manager, clients, last } = setup();
    manager.configure(CONFIG, 1);
    const offUser = manager.subscribe('user.9', { 'chat.message': jest.fn() });
    const offRide = manager.subscribe('ride.5', { 'ride.status': jest.fn() });
    last().status('connected');

    offRide();
    expect(last().left).toEqual(['ride.5']);
    expect(last().disconnected).toBe(false);
    offUser();
    expect(last().disconnected).toBe(true);
    // Our own disconnect is never read as a drop.
    last().status('disconnected');
    jest.advanceTimersByTime(RECONNECT_MAX_MS * 2);
    expect(clients).toHaveLength(1);
    expect(manager.debugState().reconnectPending).toBe(false);
    // A second call of the same unsubscribe does nothing.
    offUser();
  });

  it('reconnects a failed connection after a capped back-off; one timer, cleared on connect', () => {
    const { manager, clients, last } = setup();
    manager.configure(CONFIG, 1);
    manager.subscribe('user.9', { 'chat.message': jest.fn() });

    last().status('failed');
    expect(clients[0].disconnected).toBe(true);
    expect(manager.debugState()).toMatchObject({ reconnectPending: true, attempts: 1 });
    // A second failure report of the dead client changes nothing (no second timer).
    clients[0].status('failed');
    expect(manager.debugState().attempts).toBe(1);

    jest.advanceTimersByTime(999);
    expect(clients).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(clients).toHaveLength(2);
    // The new client subscribes the wanted channels again (fresh auth on the server).
    expect(last().listeners.map((l) => l.channel)).toEqual(['user.9']);

    last().status('failed');
    jest.advanceTimersByTime(1999);
    expect(clients).toHaveLength(2);
    jest.advanceTimersByTime(1);
    expect(clients).toHaveLength(3);
    last().status('connected');
    expect(manager.debugState()).toMatchObject({ reconnectPending: false, attempts: 0 });
    expect(manager.isConnected()).toBe(true);
  });

  it('logout (reset) cancels a scheduled reconnect, drops every channel, and old unsubscribes do nothing', () => {
    const { manager, clients, last, hasAppStateListener } = setup();
    manager.configure(CONFIG, 1);
    const off = manager.subscribe('driver.9', { 'ride.requested': jest.fn() });
    last().status('failed');
    expect(manager.debugState().reconnectPending).toBe(true);

    manager.reset();
    jest.advanceTimersByTime(RECONNECT_MAX_MS * 2);
    expect(clients).toHaveLength(1);
    expect(manager.debugState()).toEqual({ channels: [], attached: [], reconnectPending: false, attempts: 0, refused: [] });
    expect(manager.isConfiguredFor(1)).toBe(false);
    expect(hasAppStateListener()).toBe(false);

    // The next session's subscription is not removed by the old session's unsubscribe.
    manager.configure(CONFIG, 2);
    manager.subscribe('user.10', { 'chat.message': jest.fn() });
    off();
    expect(manager.debugState().channels).toEqual(['user.10']);
    expect(clients).toHaveLength(2);
  });

  it('a reset while connected disconnects the socket at once', () => {
    const { manager, last } = setup();
    manager.configure(CONFIG, 1);
    manager.subscribe('user.9', { 'chat.message': jest.fn() });
    last().status('connected');
    manager.reset();
    expect(last().disconnected).toBe(true);
    expect(manager.getStatus()).toBe('disconnected');
  });

  it('background disconnects and clears the reconnect timer; foreground connects again', () => {
    const { manager, clients, last, setAppState } = setup();
    manager.configure(CONFIG, 1);
    manager.subscribe('user.9', { 'chat.message': jest.fn() });
    last().status('failed');
    expect(manager.debugState().reconnectPending).toBe(true);

    setAppState('background');
    expect(manager.debugState()).toMatchObject({ reconnectPending: false, attempts: 0 });
    jest.advanceTimersByTime(RECONNECT_MAX_MS * 2);
    expect(clients).toHaveLength(1);

    // iOS `inactive` is not a background.
    setAppState('active');
    expect(clients).toHaveLength(2);
    setAppState('inactive');
    expect(last().disconnected).toBe(false);
    setAppState('background');
    expect(last().disconnected).toBe(true);
  });

  it('SEC-35: a 401/403 of the session drops the connection and re-subscribes later with a fresh auth', () => {
    const { manager, clients, last } = setup();
    manager.configure(CONFIG, 1);
    manager.subscribe('user.9', { 'chat.message': jest.fn() });
    manager.subscribe('ride.5', { 'ride.status': jest.fn() });
    last().status('connected');

    manager.revoke();
    expect(clients[0].disconnected).toBe(true);
    expect(manager.getStatus()).toBe('disconnected');
    jest.advanceTimersByTime(1000);
    expect(clients).toHaveLength(2);
    expect(last().listeners.map((l) => l.channel)).toEqual(['user.9', 'ride.5']);
  });

  it('SEC-35: a channel whose /broadcasting/auth answers 403 is not subscribed again this session', async () => {
    const { manager, clients, last, authorize } = setup();
    manager.configure(CONFIG, 1);
    manager.subscribe('user.9', { 'chat.message': jest.fn() });
    manager.subscribe('ride.5', { 'ride.status': jest.fn() });
    authorize.mockRejectedValueOnce(new ApiError({ kind: 'forbidden', status: 403, message: 'Forbidden' }));

    await expect(last().authorize('private-ride.5', '1.2')).rejects.toBeInstanceOf(ApiError);
    expect(authorize).toHaveBeenCalledWith(CONFIG, 'private-ride.5', '1.2');
    expect(manager.debugState().refused).toEqual(['ride.5']);

    manager.revoke();
    jest.advanceTimersByTime(1000);
    expect(clients).toHaveLength(2);
    expect(last().listeners.map((l) => l.channel)).toEqual(['user.9']);
  });

  it('a 429 from /broadcasting/auth backs off (at least its Retry-After), then subscribes again', async () => {
    const { manager, clients, last, authorize } = setup();
    manager.configure(CONFIG, 1);
    manager.subscribe('user.9', { 'chat.message': jest.fn() });
    manager.subscribe('ride.5', { 'ride.status': jest.fn() });
    const limited = new ApiError({ kind: 'rate_limited', status: 429, message: 'Too many', retryAfter: 20 });
    authorize.mockRejectedValueOnce(limited).mockRejectedValueOnce(limited);

    const first = last();
    await expect(first.authorize('private-user.9', '1.2')).rejects.toBe(limited);
    // The second channel's 429 of the same (now closed) client schedules nothing more.
    await expect(first.authorize('private-ride.5', '1.2')).rejects.toThrow();
    expect(first.disconnected).toBe(true);
    expect(manager.debugState()).toMatchObject({ reconnectPending: true, attempts: 1, refused: [] });

    jest.advanceTimersByTime(19_999);
    expect(clients).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(clients).toHaveLength(2);
    expect(last().listeners.map((l) => l.channel)).toEqual(['user.9', 'ride.5']);
  });

  it('network recovery (retryNow) reconnects at once after an offline failure; a 429 hold is kept', async () => {
    const { manager, clients, last, authorize } = setup();
    manager.configure(CONFIG, 1);
    manager.subscribe('user.9', { 'chat.message': jest.fn() });
    // Offline: two failures in a row, the back-off is now 2 s.
    last().status('failed');
    jest.advanceTimersByTime(1000);
    last().status('failed');
    expect(manager.debugState()).toMatchObject({ reconnectPending: true, attempts: 2 });

    manager.retryNow();
    expect(clients).toHaveLength(3);
    expect(manager.debugState()).toMatchObject({ reconnectPending: false, attempts: 0 });
    // Connected already: a recovery changes nothing.
    manager.retryNow();
    expect(clients).toHaveLength(3);

    const limited = new ApiError({ kind: 'rate_limited', status: 429, message: 'Too many', retryAfter: 20 });
    authorize.mockRejectedValueOnce(limited);
    await expect(last().authorize('private-user.9', '1.2')).rejects.toBe(limited);
    manager.retryNow();
    expect(clients).toHaveLength(3);
    expect(manager.debugState().reconnectPending).toBe(true);
    jest.advanceTimersByTime(20_000);
    expect(clients).toHaveLength(4);
  });

  it('a channel auth that lands after its client was torn down is refused', async () => {
    const { manager, clients } = setup();
    manager.configure(CONFIG, 1);
    manager.subscribe('user.9', { 'chat.message': jest.fn() });
    const first = clients[0];
    manager.reset();
    await expect(first.authorize('private-user.9', '1.2')).rejects.toThrow(/closed/);
  });

  it('events of a torn-down client never reach the handlers', () => {
    const { manager, clients } = setup();
    manager.configure(CONFIG, 1);
    const handler = jest.fn();
    manager.subscribe('user.9', { 'chat.message': handler });
    clients[0].status('failed');
    clients[0].emit('user.9', 'chat.message', { ride_id: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it('configure(null) after a connect (server turned it off) disconnects and stops reconnecting', () => {
    const { manager, clients, last } = setup();
    manager.configure(CONFIG, 1);
    manager.subscribe('user.9', { 'chat.message': jest.fn() });
    last().status('failed');
    manager.configure(null, 1);
    jest.advanceTimersByTime(RECONNECT_MAX_MS * 2);
    expect(clients).toHaveLength(1);
    expect(manager.debugState().reconnectPending).toBe(false);
  });
});
