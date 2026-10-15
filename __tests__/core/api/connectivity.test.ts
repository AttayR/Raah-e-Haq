/**
 * T-540: "the connection is back" = NetInfo offline → online, or the server answering again after
 * a request got no response. Screens use it to drop a stale "Network error".
 */
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { act, renderHook } from '@testing-library/react-native';
import { __resetConnectivityForTests, connectivity, useConnectionRecovered } from '../../../src/core/api/connectivity';

type NetListener = (state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>) => void;
let netListeners: NetListener[];
const unsubscribeNet = jest.fn();

beforeEach(() => {
  __resetConnectivityForTests();
  netListeners = [];
  unsubscribeNet.mockClear();
  (NetInfo.addEventListener as jest.Mock).mockClear();
  (NetInfo.addEventListener as jest.Mock).mockImplementation((listener: NetListener) => {
    netListeners.push(listener);
    return unsubscribeNet;
  });
});

const net = (isConnected: boolean | null, isInternetReachable: boolean | null = isConnected) =>
  act(() => netListeners.forEach((l) => l({ isConnected, isInternetReachable })));

describe('connectivity', () => {
  it('emits once when the server answers after a no-response failure', () => {
    const listener = jest.fn();
    connectivity.subscribe(listener);
    connectivity.reportResponse();
    expect(listener).not.toHaveBeenCalled();
    connectivity.reportFailure('timeout');
    connectivity.reportFailure('network');
    connectivity.reportResponse();
    connectivity.reportResponse();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('counts an HTTP error as an answer, and ignores cancelled requests', () => {
    const listener = jest.fn();
    connectivity.subscribe(listener);
    connectivity.reportFailure('network');
    connectivity.reportFailure('cancelled');
    expect(listener).not.toHaveBeenCalled();
    connectivity.reportFailure('server');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('useConnectionRecovered', () => {
  it('fires when the phone comes back online, not on launch or while online', () => {
    const onRecovered = jest.fn();
    renderHook(() => useConnectionRecovered(onRecovered));
    net(null);
    net(true);
    expect(onRecovered).not.toHaveBeenCalled();
    net(false);
    expect(onRecovered).not.toHaveBeenCalled();
    net(true);
    expect(onRecovered).toHaveBeenCalledTimes(1);
    net(true, false); // connected, but no internet
    net(true, true);
    expect(onRecovered).toHaveBeenCalledTimes(2);
  });

  it('fires when the server answers again', () => {
    const onRecovered = jest.fn();
    renderHook(() => useConnectionRecovered(onRecovered));
    act(() => {
      connectivity.reportFailure('network');
      connectivity.reportResponse();
    });
    expect(onRecovered).toHaveBeenCalledTimes(1);
  });

  it('listens only while enabled and cleans up on unmount', () => {
    const onRecovered = jest.fn();
    const { rerender, unmount } = renderHook(({ on }: { on: boolean }) => useConnectionRecovered(onRecovered, on), {
      initialProps: { on: false },
    });
    expect(NetInfo.addEventListener).not.toHaveBeenCalled();
    connectivity.reportFailure('network');
    connectivity.reportResponse();
    expect(onRecovered).not.toHaveBeenCalled();

    rerender({ on: true });
    unmount();
    expect(unsubscribeNet).toHaveBeenCalled();
    connectivity.reportFailure('network');
    connectivity.reportResponse();
    expect(onRecovered).not.toHaveBeenCalled();
  });
});
