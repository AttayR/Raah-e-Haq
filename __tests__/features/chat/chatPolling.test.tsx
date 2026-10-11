/**
 * T-510: the thread poller runs one request at a time every 5 s only while enabled (focused +
 * foreground), stops on disable/unmount/'stop', backs off on 429 (Retry-After) and errors, and
 * re-polls at once for has_more.
 */
import { act, renderHook } from '@testing-library/react-native';
import { ApiError } from '../../../src/core/api/errors';
import {
  backoffDelay,
  CHAT_POLL_INTERVAL_MS,
  CHAT_POLL_MAX_DELAY_MS,
  usePolling,
  type PollOutcome,
} from '../../../src/features/chat/polling';

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
  });
};

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};

const rateLimited = (retryAfter?: number) =>
  new ApiError({ kind: 'rate_limited', status: 429, message: 'slow', code: 'rate_limited', retryAfter });

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const renderPoller = (run: jest.Mock<Promise<PollOutcome>, []>, enabled = true) =>
  renderHook(({ on }: { on: boolean }) => usePolling({ enabled: on, run }), { initialProps: { on: enabled } });

describe('usePolling', () => {
  it('polls every interval while enabled and stops when disabled or unmounted', async () => {
    const run = jest.fn<Promise<PollOutcome>, []>().mockResolvedValue('continue');
    const hook = renderPoller(run);

    await advance(CHAT_POLL_INTERVAL_MS - 1);
    expect(run).not.toHaveBeenCalled();
    await advance(1);
    expect(run).toHaveBeenCalledTimes(1);
    await advance(CHAT_POLL_INTERVAL_MS);
    expect(run).toHaveBeenCalledTimes(2);

    hook.rerender({ on: false });
    await advance(CHAT_POLL_INTERVAL_MS * 5);
    expect(run).toHaveBeenCalledTimes(2);

    // Back after longer than the interval: polls at once.
    hook.rerender({ on: true });
    await advance(0);
    expect(run).toHaveBeenCalledTimes(3);

    hook.unmount();
    await advance(CHAT_POLL_INTERVAL_MS * 5);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('never starts while disabled', async () => {
    const run = jest.fn<Promise<PollOutcome>, []>().mockResolvedValue('continue');
    renderPoller(run, false);
    await advance(CHAT_POLL_INTERVAL_MS * 5);
    expect(run).not.toHaveBeenCalled();
  });

  it('waits for the previous request before scheduling the next', async () => {
    let resolve: (v: PollOutcome) => void = () => {};
    const run = jest.fn<Promise<PollOutcome>, []>(() => new Promise<PollOutcome>((r) => { resolve = r; }));
    renderPoller(run);
    await advance(CHAT_POLL_INTERVAL_MS);
    expect(run).toHaveBeenCalledTimes(1);
    await advance(CHAT_POLL_INTERVAL_MS * 3);
    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => resolve('continue'));
    await advance(CHAT_POLL_INTERVAL_MS);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('backs off on 429 (at least Retry-After) and returns to the interval after a success', async () => {
    const run = jest
      .fn<Promise<PollOutcome>, []>()
      .mockRejectedValueOnce(rateLimited(20))
      .mockResolvedValue('continue');
    renderPoller(run);

    await advance(CHAT_POLL_INTERVAL_MS);
    expect(run).toHaveBeenCalledTimes(1);
    await advance(19_999);
    expect(run).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(run).toHaveBeenCalledTimes(2);
    await advance(CHAT_POLL_INTERVAL_MS);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('doubles the wait on repeated errors, capped at a minute', async () => {
    expect(backoffDelay(new ApiError({ kind: 'network', message: 'x' }), 4000)).toBe(8000);
    expect(backoffDelay(rateLimited(), 4000)).toBe(8000);
    expect(backoffDelay(rateLimited(3), 4000)).toBe(8000);
    expect(backoffDelay(rateLimited(30), 4000)).toBe(30000);
    expect(backoffDelay(new Error('x'), 50000)).toBe(CHAT_POLL_MAX_DELAY_MS);

    const run = jest.fn<Promise<PollOutcome>, []>().mockRejectedValue(new ApiError({ kind: 'network', message: 'x' }));
    renderPoller(run);
    await advance(CHAT_POLL_INTERVAL_MS);
    await advance(CHAT_POLL_INTERVAL_MS * 2);
    expect(run).toHaveBeenCalledTimes(2);
    await advance(CHAT_POLL_INTERVAL_MS * 4 - 1);
    expect(run).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('toggling while a request is in flight never starts a second one', async () => {
    let resolve: (v: PollOutcome) => void = () => {};
    const run = jest.fn<Promise<PollOutcome>, []>(() => new Promise<PollOutcome>((r) => { resolve = r; }));
    const hook = renderPoller(run);
    await advance(CHAT_POLL_INTERVAL_MS);
    expect(run).toHaveBeenCalledTimes(1);

    hook.rerender({ on: false });
    hook.rerender({ on: true });
    await advance(CHAT_POLL_INTERVAL_MS * 3);
    expect(run).toHaveBeenCalledTimes(1);

    // When it settles (still enabled) the next one waits the interval.
    await act(async () => resolve('continue'));
    await advance(CHAT_POLL_INTERVAL_MS - 1);
    expect(run).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('a request that settles while disabled schedules nothing until enabled again', async () => {
    let resolve: (v: PollOutcome) => void = () => {};
    const run = jest.fn<Promise<PollOutcome>, []>(() => new Promise<PollOutcome>((r) => { resolve = r; }));
    const hook = renderPoller(run);
    await advance(CHAT_POLL_INTERVAL_MS);
    hook.rerender({ on: false });
    await act(async () => resolve('continue'));
    await advance(CHAT_POLL_INTERVAL_MS * 3);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('toggling after a 429 still waits for Retry-After', async () => {
    const run = jest
      .fn<Promise<PollOutcome>, []>()
      .mockRejectedValueOnce(rateLimited(30))
      .mockResolvedValue('continue');
    const hook = renderPoller(run);
    await advance(CHAT_POLL_INTERVAL_MS);
    expect(run).toHaveBeenCalledTimes(1);

    await advance(1000);
    hook.rerender({ on: false });
    hook.rerender({ on: true });
    await advance(28_999);
    expect(run).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("'again' polls at once (has_more); 'stop' ends the loop", async () => {
    const run = jest
      .fn<Promise<PollOutcome>, []>()
      .mockResolvedValueOnce('again')
      .mockResolvedValueOnce('stop')
      .mockResolvedValue('continue');
    renderPoller(run);
    await advance(CHAT_POLL_INTERVAL_MS);
    await advance(0);
    expect(run).toHaveBeenCalledTimes(2);
    await advance(CHAT_POLL_INTERVAL_MS * 5);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
