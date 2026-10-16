/**
 * T-536: the shared poll engine's read-at-once key and cadence changes (the rest of the engine is
 * covered by __tests__/features/chat/chatPolling.test.tsx).
 */
import { act, renderHook } from '@testing-library/react-native';
import { ApiError } from '../../src/core/api/errors';
import { __resetConnectivityForTests, connectivity } from '../../src/core/api/connectivity';
import { pollFailureOf, usePolling, type PollOutcome } from '../../src/core/polling';

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

type Props = { on: boolean; every: number; id?: number };

const renderPoller = (run: jest.Mock<Promise<PollOutcome>, []>, initialProps: Props) =>
  renderHook(
    ({ on, every, id }: Props) => usePolling({ enabled: on, intervalMs: every, run, readAtOnceKey: id }),
    { initialProps },
  );

describe('usePolling readAtOnceKey', () => {
  it('polls at once on enable and for a new key, not for an interval change', async () => {
    const run = jest.fn<Promise<PollOutcome>, []>().mockResolvedValue('continue');
    const hook = renderPoller(run, { on: true, every: 3000, id: 1 });
    await advance(0);
    expect(run).toHaveBeenCalledTimes(1);

    // Cadence change right after a poll: the next one is timed from that poll, no extra read.
    hook.rerender({ on: true, every: 10000, id: 1 });
    await advance(9999);
    expect(run).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(run).toHaveBeenCalledTimes(2);

    hook.rerender({ on: true, every: 10000, id: 2 });
    await advance(0);
    expect(run).toHaveBeenCalledTimes(3);

    hook.rerender({ on: false, every: 10000, id: 2 });
    hook.rerender({ on: true, every: 10000, id: 2 });
    await advance(0);
    expect(run).toHaveBeenCalledTimes(4);
  });

  it('a pending back-off wins over the read at once', async () => {
    const run = jest
      .fn<Promise<PollOutcome>, []>()
      .mockRejectedValueOnce(new ApiError({ kind: 'rate_limited', status: 429, message: 'slow', retryAfter: 30 }))
      .mockResolvedValue('continue');
    const hook = renderPoller(run, { on: true, every: 3000, id: 1 });
    await advance(0);
    expect(run).toHaveBeenCalledTimes(1);

    hook.rerender({ on: false, every: 3000, id: 1 });
    hook.rerender({ on: true, every: 3000, id: 1 });
    await advance(29_999);
    expect(run).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('a network back-off ends when the connection is back; a 429 Retry-After does not', async () => {
    const network = new ApiError({ kind: 'network', message: 'offline' });
    const run = jest.fn<Promise<PollOutcome>, []>().mockRejectedValueOnce(network).mockResolvedValue('continue');
    renderPoller(run, { on: true, every: 3000, id: 1 });
    await advance(0);
    expect(run).toHaveBeenCalledTimes(1);
    // Backing off 6 s; the server answers another request meanwhile.
    await advance(1000);
    connectivity.reportFailure('network');
    act(() => connectivity.reportResponse());
    await advance(0);
    expect(run).toHaveBeenCalledTimes(2);
    // Then the interval again.
    await advance(3000);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('a 429 back-off is kept through a reconnect', async () => {
    const run = jest
      .fn<Promise<PollOutcome>, []>()
      .mockRejectedValueOnce(new ApiError({ kind: 'rate_limited', status: 429, message: 'slow', retryAfter: 30 }))
      .mockResolvedValue('continue');
    renderPoller(run, { on: true, every: 3000, id: 1 });
    await advance(0);
    connectivity.reportFailure('network');
    act(() => connectivity.reportResponse());
    await advance(29_999);
    expect(run).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('pollFailureOf keeps the Retry-After of a refused thunk', () => {
    const error = pollFailureOf({ kind: 'rate_limited', message: 'slow', status: 429, fieldErrors: {}, retryAfter: 12 });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.retryAfter).toBe(12);
    expect(error.kind).toBe('rate_limited');
  });
});
