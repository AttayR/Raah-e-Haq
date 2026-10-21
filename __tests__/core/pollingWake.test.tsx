/**
 * T-406: realtime events only wake the shared poll engine; the interval stays the fallback.
 */
import { act, renderHook } from '@testing-library/react-native';
import { ApiError } from '../../src/core/api/errors';
import { __resetConnectivityForTests } from '../../src/core/api/connectivity';
import { POLL_WAKE_MIN_GAP_MS, usePolling, type PollOutcome } from '../../src/core/polling';
import { realtimeEvents, wakeOn, type WakeSource } from '../../src/core/realtime/events';

const advance = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  __resetConnectivityForTests();
});

const renderWoken = (run: jest.Mock<Promise<PollOutcome>, []>, wake: WakeSource) =>
  renderHook(({ on }: { on: boolean }) => usePolling({ enabled: on, intervalMs: 10_000, run, wake }), {
    initialProps: { on: true },
  });

describe('usePolling wake', () => {
  it('an event for this ride reads at once (after the min gap), another ride does not, polling continues', async () => {
    const run = jest.fn<Promise<PollOutcome>, []>().mockResolvedValue('continue');
    const wake = wakeOn(['ride.status'], 5);
    const hook = renderWoken(run, wake);
    await advance(10_000);
    expect(run).toHaveBeenCalledTimes(1);

    realtimeEvents.emit('ride.status', { ride_id: 6, status: 'started' });
    await advance(POLL_WAKE_MIN_GAP_MS);
    expect(run).toHaveBeenCalledTimes(1);

    realtimeEvents.emit('ride.status', { ride_id: 5, status: 'started' });
    await advance(POLL_WAKE_MIN_GAP_MS);
    expect(run).toHaveBeenCalledTimes(2);

    // The interval fallback keeps going.
    await advance(10_000);
    expect(run).toHaveBeenCalledTimes(3);

    hook.unmount();
    expect(realtimeEvents.listenerCount('ride.status')).toBe(0);
  });

  it('a burst of events is one read, and events during a read get one follow-up', async () => {
    let resolve: (v: PollOutcome) => void = () => undefined;
    const run = jest
      .fn<Promise<PollOutcome>, []>()
      .mockImplementationOnce(
        () =>
          new Promise<PollOutcome>((r) => {
            resolve = r;
          }),
      )
      .mockResolvedValue('continue');
    renderWoken(run, wakeOn(['chat.message']));
    await advance(10_000);
    expect(run).toHaveBeenCalledTimes(1);
    realtimeEvents.emit('chat.message', { ride_id: 1 });
    realtimeEvents.emit('chat.message', { ride_id: 1 });
    realtimeEvents.emit('chat.message', { ride_id: 1 });
    await act(async () => {
      resolve('continue');
    });
    await advance(POLL_WAKE_MIN_GAP_MS);
    expect(run).toHaveBeenCalledTimes(2);

    for (let i = 0; i < 5; i += 1) realtimeEvents.emit('chat.message', { ride_id: 1 });
    await advance(POLL_WAKE_MIN_GAP_MS);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('a wake does nothing while held by a 429 or while disabled', async () => {
    const run = jest
      .fn<Promise<PollOutcome>, []>()
      .mockRejectedValueOnce(new ApiError({ kind: 'rate_limited', status: 429, message: 'slow', retryAfter: 30 }))
      .mockResolvedValue('continue');
    const hook = renderWoken(run, wakeOn(['notification.created']));
    await advance(10_000);
    expect(run).toHaveBeenCalledTimes(1);
    realtimeEvents.emit('notification.created', { id: 1 });
    await advance(5_000);
    expect(run).toHaveBeenCalledTimes(1);

    hook.rerender({ on: false });
    await advance(30_000);
    realtimeEvents.emit('notification.created', { id: 2 });
    await advance(5_000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
