/**
 * T-536 (PERF-19): the in-memory GET cache and useRemoteData's `cache` option. A fresh read is
 * reused across mounts and focus; pull to refresh always asks; a new session or an expired TTL
 * misses; writes (setData, a save) keep it honest.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import {
  CACHE_TTL,
  cacheVersion,
  clearQueryCache,
  invalidateCache,
  readCache,
  writeCache,
} from '../../../src/core/api/queryCache';
import { useRemoteData } from '../../../src/core/api/useRemoteData';
import { bumpSessionEpoch } from '../../../src/store/sessionEpoch';

afterEach(() => {
  jest.useRealTimers();
  clearQueryCache();
});

describe('queryCache', () => {
  it('returns a value until its TTL ends', () => {
    jest.useFakeTimers();
    writeCache('k', { n: 1 });
    expect(readCache('k', 1000)).toEqual({ value: { n: 1 } });
    jest.advanceTimersByTime(999);
    expect(readCache('k', 1000)).not.toBeNull();
    jest.advanceTimersByTime(1);
    expect(readCache('k', 1000)).toBeNull();
  });

  it('a value from an ended session is never read, nor stored', () => {
    const started = cacheVersion('places');
    writeCache('places', ['home']);
    bumpSessionEpoch();
    expect(readCache('places', CACHE_TTL.savedPlaces)).toBeNull();

    // A request that started before the sign-out lands afterwards: not stored.
    writeCache('places', ['old'], started);
    expect(readCache('places', CACHE_TTL.savedPlaces)).toBeNull();
  });

  it('a GET answer is dropped when the key changed after it started (local write, invalidate, clear)', () => {
    const beforeWrite = cacheVersion('places');
    writeCache('places', ['local']);
    writeCache('places', ['stale'], beforeWrite);
    expect(readCache('places', 60_000)).toEqual({ value: ['local'] });

    const beforeInvalidate = cacheVersion('places');
    invalidateCache('places');
    writeCache('places', ['stale'], beforeInvalidate);
    expect(readCache('places', 60_000)).toBeNull();

    const beforeClear = cacheVersion('places');
    clearQueryCache();
    writeCache('places', ['stale'], beforeClear);
    expect(readCache('places', 60_000)).toBeNull();

    // Unchanged since it started: stored.
    const clean = cacheVersion('places');
    writeCache('places', ['fresh'], clean);
    expect(readCache('places', 60_000)).toEqual({ value: ['fresh'] });
  });

  it('a session change clears the whole cache', () => {
    writeCache('stats/me|', { rides: 3 });
    writeCache('public/vehicle-types', []);
    bumpSessionEpoch();
    writeCache('probe', 1);
    expect(readCache('public/vehicle-types', CACHE_TTL.vehicleTypes)).toBeNull();
    expect(readCache('stats/me|', CACHE_TTL.stats)).toBeNull();
  });

  it('invalidates by prefix', () => {
    writeCache('saved-places|', 1);
    writeCache('stats/me|', 2);
    invalidateCache('saved-places');
    expect(readCache('saved-places|', 60_000)).toBeNull();
    expect(readCache('stats/me|', 60_000)).not.toBeNull();
  });
});

const CACHE = { name: 'test', ttlMs: 60_000 };

describe('useRemoteData with a cache', () => {
  it('a second mount and a refocus within the TTL make no request; refresh does', async () => {
    const fetch = jest.fn().mockResolvedValue({ total: 3 });
    const first = renderHook(() => useRemoteData({ fetch, fallbackError: 'x', cache: CACHE }));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    expect(fetch).toHaveBeenCalledTimes(1);

    const second = renderHook(({ on }: { on: boolean }) => useRemoteData({ fetch, fallbackError: 'x', enabled: on, cache: CACHE }), {
      initialProps: { on: true },
    });
    // Shown on the first frame, no loading state.
    expect(second.result.current.status).toBe('ready');
    expect(second.result.current.data).toEqual({ total: 3 });
    second.rerender({ on: false });
    second.rerender({ on: true });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      await second.result.current.refresh();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('asks again once the TTL has passed, and after a sign-out', async () => {
    jest.useFakeTimers();
    const fetch = jest.fn().mockResolvedValue({ total: 3 });
    const hook = renderHook(({ on }: { on: boolean }) => useRemoteData({ fetch, fallbackError: 'x', enabled: on, cache: CACHE }), {
      initialProps: { on: true },
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    hook.rerender({ on: false });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CACHE.ttlMs);
    });
    hook.rerender({ on: true });
    expect(fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    bumpSessionEpoch();
    hook.rerender({ on: false });
    hook.rerender({ on: true });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('setData updates the cache other screens read', async () => {
    const fetch = jest.fn().mockResolvedValue(['a', 'b']);
    const first = renderHook(() => useRemoteData<string[]>({ fetch, fallbackError: 'x', cache: CACHE }));
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    act(() => first.result.current.setData(['a']));

    const second = renderHook(() => useRemoteData<string[]>({ fetch, fallbackError: 'x', cache: CACHE }));
    expect(second.result.current.data).toEqual(['a']);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('without the option nothing is cached (a focus refetches, as before)', async () => {
    const fetch = jest.fn().mockResolvedValue(1);
    const hook = renderHook(({ on }: { on: boolean }) => useRemoteData({ fetch, fallbackError: 'x', enabled: on }), {
      initialProps: { on: true },
    });
    await waitFor(() => expect(hook.result.current.status).toBe('ready'));
    hook.rerender({ on: false });
    hook.rerender({ on: true });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});
