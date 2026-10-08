/**
 * T-110 / BE-20: the passenger map polls GET /rides/nearby-drivers no faster than every 10 s,
 * waits for retry_after on 429, shows loading/error/empty, and stops on unmount.
 */
import { AppState, AppStateStatus } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import rideService, { NearbyDriver } from '../../src/services/rideService';
import { ApiError } from '../../src/core/api/errors';
import {
  NEARBY_ERROR_RETRY_MS,
  NEARBY_MIN_GAP_MS,
  NEARBY_POLL_MS,
  __resetNearbyDriversThrottleForTests,
  useNearbyDrivers,
} from '../../src/hooks/useNearbyDrivers';

const driver: NearbyDriver = {
  id: 'a1b2c3d4e5f60718',
  rating: 4.5,
  vehicle_type: 'car',
  distance_km: 1.2,
  estimated_arrival_min: 3,
  location: { latitude: 31.52, longitude: 74.355 },
};

const lahore = { latitude: 31.5204, longitude: 74.3587 };

let spy: jest.SpyInstance;
let appStateListeners: Array<(state: AppStateStatus) => void>;
let removeListener: jest.Mock;

const setAppState = async (state: AppStateStatus) => {
  await act(async () => {
    (AppState as { currentState: AppStateStatus }).currentState = state;
    appStateListeners.forEach(listener => listener(state));
  });
};

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  jest.useFakeTimers();
  __resetNearbyDriversThrottleForTests();
  spy = jest.spyOn(rideService, 'getNearbyDrivers');
  appStateListeners = [];
  removeListener = jest.fn();
  (AppState as { currentState: AppStateStatus }).currentState = 'active';
  (AppState.addEventListener as jest.Mock).mockImplementation((_type: string, listener: (s: AppStateStatus) => void) => {
    appStateListeners.push(listener);
    return { remove: removeListener };
  });
});

afterEach(() => {
  spy.mockRestore();
  jest.useRealTimers();
});

describe('useNearbyDrivers', () => {
  it('loads, then polls every 30 s, and stops on unmount', async () => {
    spy.mockResolvedValue([driver]);
    const { result, unmount } = renderHook(() => useNearbyDrivers(lahore));
    expect(result.current.status).toBe('idle');

    await advance(0);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toMatchObject({ latitude: 31.52, longitude: 74.359 });
    expect(result.current).toEqual({ drivers: [driver], status: 'ready', error: null });

    await advance(NEARBY_POLL_MS - 1);
    expect(spy).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(spy).toHaveBeenCalledTimes(2);

    unmount();
    await advance(NEARBY_POLL_MS * 5);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('reports an empty list as ready with no drivers', async () => {
    spy.mockResolvedValue([]);
    const { result } = renderHook(() => useNearbyDrivers(lahore));
    await advance(0);
    expect(result.current).toEqual({ drivers: [], status: 'ready', error: null });
  });

  it('does not fetch without a centre or when disabled', async () => {
    spy.mockResolvedValue([driver]);
    const { result, rerender } = renderHook(
      ({ center, enabled }: { center: typeof lahore | null; enabled: boolean }) => useNearbyDrivers(center, { enabled }),
      { initialProps: { center: null as typeof lahore | null, enabled: true } },
    );
    await advance(NEARBY_POLL_MS);
    rerender({ center: lahore, enabled: false });
    await advance(NEARBY_POLL_MS);
    expect(spy).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('keeps requests at least 10 s apart when the centre moves, and ignores GPS jitter', async () => {
    spy.mockResolvedValue([driver]);
    const { rerender } = renderHook(({ center }: { center: typeof lahore }) => useNearbyDrivers(center), {
      initialProps: { center: lahore },
    });
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(1);

    rerender({ center: { latitude: lahore.latitude + 0.00003, longitude: lahore.longitude } });
    await advance(NEARBY_MIN_GAP_MS);
    expect(spy).toHaveBeenCalledTimes(1);

    rerender({ center: { latitude: 31.55, longitude: 74.34 } });
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(2);

    rerender({ center: { latitude: 31.6, longitude: 74.3 } });
    await advance(NEARBY_MIN_GAP_MS - 1);
    expect(spy).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('waits for retry_after on 429 and keeps the last list', async () => {
    spy
      .mockResolvedValueOnce([driver])
      .mockRejectedValueOnce(new ApiError({ kind: 'rate_limited', status: 429, message: 'Too many', retryAfter: 45 }))
      .mockResolvedValue([]);
    const { result } = renderHook(() => useNearbyDrivers(lahore));
    await advance(0);
    await advance(NEARBY_POLL_MS);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.current).toEqual({ drivers: [driver], status: 'ready', error: null });

    await advance(45_000 - 1);
    expect(spy).toHaveBeenCalledTimes(2);
    await advance(1);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(result.current.drivers).toEqual([]);
  });

  it('shows an error state and retries after a minute', async () => {
    spy
      .mockRejectedValueOnce(new ApiError({ kind: 'network', message: 'Network error. Please check your connection.' }))
      .mockResolvedValue([driver]);
    const { result } = renderHook(() => useNearbyDrivers(lahore));
    await advance(0);
    expect(result.current).toEqual({
      drivers: [],
      status: 'error',
      error: 'Network error. Please check your connection.',
    });
    await advance(NEARBY_ERROR_RETRY_MS);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('ready');
  });

  it('aborts the in-flight request on unmount', async () => {
    let signal: AbortSignal | undefined;
    spy.mockImplementation((_query, s?: AbortSignal) => {
      signal = s;
      return new Promise<NearbyDriver[]>(() => undefined);
    });
    const { unmount } = renderHook(() => useNearbyDrivers(lahore));
    await advance(0);
    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('polls only while the app is active and aborts when it leaves the foreground', async () => {
    let signal: AbortSignal | undefined;
    spy.mockImplementationOnce((_query, s?: AbortSignal) => {
      signal = s;
      return new Promise<NearbyDriver[]>(() => undefined);
    });
    spy.mockResolvedValue([driver]);
    const { result, unmount } = renderHook(() => useNearbyDrivers(lahore));
    await advance(0);
    expect(spy).toHaveBeenCalledTimes(1);

    await setAppState('inactive');
    expect(signal?.aborted).toBe(true);
    await setAppState('background');
    await advance(NEARBY_POLL_MS * 4);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('idle');

    await setAppState('active');
    await advance(NEARBY_MIN_GAP_MS);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('ready');

    unmount();
    expect(removeListener).toHaveBeenCalled();
  });

  it('does not start while the app is in the background', async () => {
    (AppState as { currentState: AppStateStatus }).currentState = 'background';
    spy.mockResolvedValue([driver]);
    renderHook(() => useNearbyDrivers(lahore));
    await advance(NEARBY_POLL_MS);
    expect(spy).not.toHaveBeenCalled();
  });

  it('keeps the 10 s floor across remounts', async () => {
    spy.mockResolvedValue([driver]);
    const first = renderHook(() => useNearbyDrivers(lahore));
    await advance(0);
    first.unmount();
    renderHook(() => useNearbyDrivers(lahore));
    await advance(NEARBY_MIN_GAP_MS - 1);
    expect(spy).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('stops after a 401 instead of retrying', async () => {
    spy.mockRejectedValue(new ApiError({ kind: 'auth', status: 401, message: 'Your session has expired. Please sign in again.' }));
    const { result } = renderHook(() => useNearbyDrivers(lahore));
    await advance(0);
    expect(result.current.status).toBe('error');
    await advance(NEARBY_ERROR_RETRY_MS * 3);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
