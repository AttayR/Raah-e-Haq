/**
 * T-406: the Echo adapter against a fake Pusher class shaped like pusher-js's React Native bundle
 * (`module.exports.Pusher`, no default export): the options Echo hands to Pusher, private
 * channel names, the leading-dot event names, the custom channel authorizer, status and teardown.
 */
import type { RealtimeConfig } from '../../../src/core/realtime/config';
import { createEchoClient } from '../../../src/core/realtime/echoClient';

type Callback = (payload: unknown) => void;

interface FakeChannel {
  name: string;
  handlers: Map<string, Callback[]>;
  bind(event: string, callback: Callback): void;
  unbind(event?: string, callback?: Callback): void;
}

interface FakePusherInstance {
  key: string;
  options: Record<string, unknown> & {
    channelAuthorization: {
      customHandler: (params: { socketId: string; channelName: string }, cb: (e: Error | null, d: unknown) => void) => void;
    };
  };
  channels: Map<string, FakeChannel>;
  unsubscribed: string[];
  disconnected: boolean;
  connection: { state: string; socket_id: string; bind(event: string, cb: () => void): void; unbind(event: string, cb: () => void): void; fire(state: string): void };
}

const mockInstances: FakePusherInstance[] = [];

jest.mock('pusher-js/react-native', () => {
  class FakePusher {
    channels = new Map();
    unsubscribed: string[] = [];
    disconnected = false;
    connection = {
      state: 'connecting',
      socket_id: '1.2',
      listeners: new Map<string, Array<() => void>>(),
      bind(event: string, cb: () => void) {
        this.listeners.set(event, [...(this.listeners.get(event) ?? []), cb]);
      },
      unbind(event: string, cb: () => void) {
        this.listeners.set(event, (this.listeners.get(event) ?? []).filter((l) => l !== cb));
      },
      fire(state: string) {
        this.state = state;
        (this.listeners.get('state_change') ?? []).forEach((l) => l());
      },
    };
    key: string;
    options: unknown;
    constructor(appKey: string, appOptions: unknown) {
      this.key = appKey;
      this.options = appOptions;
      (mockInstances as unknown[]).push(this);
    }
    subscribe(name: string) {
      const channel = {
        name,
        handlers: new Map<string, Array<(payload: unknown) => void>>(),
        bind(event: string, callback: (payload: unknown) => void) {
          this.handlers.set(event, [...(this.handlers.get(event) ?? []), callback]);
        },
        unbind() {
          this.handlers.clear();
        },
      };
      this.channels.set(name, channel);
      return channel;
    }
    unsubscribe(name: string) {
      this.unsubscribed.push(name);
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  return { Pusher: FakePusher };
});

const CONFIG: RealtimeConfig = {
  key: 'raah-key',
  host: 'raahehaq.test',
  port: 443,
  scheme: 'https',
  wsPath: '',
  authEndpoint: 'https://raahehaq.test/broadcasting/auth',
};

beforeEach(() => {
  mockInstances.length = 0;
});

describe('createEchoClient', () => {
  it('builds Pusher with the Reverb options (forceTLS from the scheme, ws/wss only, no stats)', () => {
    createEchoClient(CONFIG, jest.fn());
    expect(mockInstances).toHaveLength(1);
    const pusher = mockInstances[0];
    expect(pusher.key).toBe('raah-key');
    expect(pusher.options).toMatchObject({
      wsHost: 'raahehaq.test',
      wsPort: 443,
      wssPort: 443,
      forceTLS: true,
      enabledTransports: ['ws', 'wss'],
      disableStats: true,
      authEndpoint: 'https://raahehaq.test/broadcasting/auth',
      cluster: '',
    });
    expect(pusher.options.wsPath).toBeUndefined();
    createEchoClient({ ...CONFIG, scheme: 'http', port: 8080 }, jest.fn());
    expect(mockInstances[1].options).toMatchObject({ forceTLS: false, wsPort: 8080 });
  });

  it('listens on private-{channel} with the literal (leading-dot) event name, and leaves it', () => {
    const client = createEchoClient(CONFIG, jest.fn());
    const handler = jest.fn();
    client.listen('ride.5', 'ride.status', handler);
    const channel = mockInstances[0].channels.get('private-ride.5');
    expect(channel).toBeDefined();
    channel?.handlers.get('ride.status')?.forEach((cb) => cb({ ride_id: 5 }));
    expect(handler).toHaveBeenCalledWith({ ride_id: 5 });

    client.leave('ride.5');
    expect(mockInstances[0].unsubscribed).toEqual(['private-ride.5']);
  });

  it('signs channels through the app authorizer and reports its failures to Pusher', async () => {
    const authorize = jest.fn().mockResolvedValueOnce({ auth: 'raah-key:sig' }).mockRejectedValueOnce(new Error('403'));
    createEchoClient(CONFIG, authorize);
    const { customHandler } = mockInstances[0].options.channelAuthorization;

    const ok = await new Promise((resolve) => customHandler({ socketId: '1.2', channelName: 'private-user.9' }, (e, d) => resolve([e, d])));
    expect(authorize).toHaveBeenCalledWith('private-user.9', '1.2');
    expect(ok).toEqual([null, { auth: 'raah-key:sig' }]);

    const failed = await new Promise<[Error | null, unknown]>((resolve) =>
      customHandler({ socketId: '1.2', channelName: 'private-ride.5' }, (e, d) => resolve([e, d])),
    );
    expect(failed[0]).toBeInstanceOf(Error);
    expect(failed[1]).toBeNull();
  });

  it('reports connection status and disconnects', () => {
    const client = createEchoClient(CONFIG, jest.fn());
    const statuses: string[] = [];
    const off = client.onStatus((s) => statuses.push(s));
    mockInstances[0].connection.fire('connected');
    mockInstances[0].connection.fire('unavailable');
    off();
    mockInstances[0].connection.fire('connected');
    expect(statuses).toEqual(['connected', 'failed']);

    client.disconnect();
    expect(mockInstances[0].disconnected).toBe(true);
  });
});
