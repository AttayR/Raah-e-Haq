/**
 * T-543 (QA: Home kept the old route after a cancel): a directions answer that lands after
 * clearRoute(), or after a newer request, never puts an old route back on the map.
 */
import { act, renderHook } from '@testing-library/react-native';
import { useDirections } from '../../src/hooks/useDirections';

const A = { latitude: 31.52, longitude: 74.35 };
const B = { latitude: 31.48, longitude: 74.3 };
const C = { latitude: 31.5, longitude: 74.32 };

/** "_p~iF~ps|U_ulLnnqC" is the classic two-point example polyline. */
const ok = (polyline = '_p~iF~ps|U_ulLnnqC') => ({ ok: true, json: async () => ({ status: 'OK', routes: [{ overview_polyline: { points: polyline } }] }) });

describe('useDirections', () => {
  const fetchMock = jest.fn();
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('sets the route from the answer', async () => {
    fetchMock.mockResolvedValueOnce(ok());
    const { result } = renderHook(() => useDirections());
    await act(() => result.current.fetchRoute(A, B));
    expect(result.current.routeCoordinates).toHaveLength(2);
  });

  it('T-536: the same route within 5 min is not asked again; a moved pin is', async () => {
    fetchMock.mockResolvedValue(ok());
    const first = renderHook(() => useDirections());
    await act(() => first.result.current.fetchRoute(A, B));
    const second = renderHook(() => useDirections());
    // A few metres off (same 4-decimal cell) still reuses the route.
    await act(() => second.result.current.fetchRoute({ latitude: 31.52001, longitude: 74.35001 }, B));
    expect(second.result.current.routeCoordinates).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(() => second.result.current.fetchRoute(C, B));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('an answer that arrives after clearRoute() is dropped', async () => {
    let answer: (value: unknown) => void = () => undefined;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const { result } = renderHook(() => useDirections());

    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.fetchRoute(A, B);
    });
    act(() => result.current.clearRoute());
    await act(async () => {
      answer(ok());
      await pending;
    });

    expect(result.current.routeCoordinates).toEqual([]);
  });

  it('only the newest request sets the route', async () => {
    let first: (value: unknown) => void = () => undefined;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (first = resolve))).mockResolvedValueOnce(ok('_p~iF~ps|U'));
    const { result } = renderHook(() => useDirections());

    let older: Promise<void> = Promise.resolve();
    act(() => {
      older = result.current.fetchRoute(A, B);
    });
    await act(() => result.current.fetchRouteWithWaypoints(A, [], C));
    expect(result.current.routeCoordinates).toHaveLength(1);
    await act(async () => {
      first(ok());
      await older;
    });

    expect(result.current.routeCoordinates).toHaveLength(1);
  });

  it('T-552: the waypoint request says whether a route came back', async () => {
    fetchMock.mockResolvedValueOnce(ok()).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useDirections());
    let answer: boolean | undefined;
    await act(async () => {
      answer = await result.current.fetchRouteWithWaypoints({ latitude: 31.41, longitude: 74.21 }, [C], B);
    });
    expect(answer).toBe(true);
    await act(async () => {
      answer = await result.current.fetchRouteWithWaypoints({ latitude: 31.42, longitude: 74.22 }, [], B);
    });
    expect(answer).toBe(false);
    expect(result.current.routeCoordinates).toEqual([]);
  });
});
