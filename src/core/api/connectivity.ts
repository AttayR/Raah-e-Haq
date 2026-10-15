import { useEffect, useRef } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import type { ApiErrorKind } from './errors';

/**
 * Connection recovery (T-540). A screen that shows a "Network error" from a failed load must
 * clear it once the connection is back, not keep it until the next manual retry. Two signals mean
 * "back":
 *
 * - the phone's network: NetInfo goes from offline to online;
 * - the server: a request answers again after one failed with no response (`network`/`timeout`),
 *   e.g. the phone stayed online while the backend was unreachable. The axios response
 *   interceptor reports every outcome here.
 *
 * `useConnectionRecovered` runs a callback on either; hooks retry their failed loads with it.
 */
type Listener = () => void;

const listeners = new Set<Listener>();
let serverUnreachable = false;

const emit = () => {
  // A copy: a listener may unsubscribe while we iterate.
  [...listeners].forEach((listener) => listener());
};

/** Error kinds that mean no response reached the app (the server is unreachable from here). */
const NO_RESPONSE: ReadonlySet<ApiErrorKind> = new Set<ApiErrorKind>(['network', 'timeout']);

export const connectivity = {
  /** The server answered (any status). Emits once after a no-response failure. */
  reportResponse(): void {
    if (!serverUnreachable) return;
    serverUnreachable = false;
    emit();
  },
  /** A request ended; `kind` of its ApiError (cancelled requests say nothing). */
  reportFailure(kind: ApiErrorKind): void {
    if (kind === 'cancelled') return;
    if (NO_RESPONSE.has(kind)) {
      serverUnreachable = true;
    } else {
      connectivity.reportResponse();
    }
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const __resetConnectivityForTests = () => {
  serverUnreachable = false;
  listeners.clear();
};

const isOffline = (state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean =>
  state.isConnected === false || state.isInternetReachable === false;

/**
 * Calls `onRecovered` when the phone comes back online or the server answers again after being
 * unreachable. The latest callback is used; listeners are removed on unmount or when disabled.
 */
export function useConnectionRecovered(onRecovered: () => void, enabled = true): void {
  const callback = useRef(onRecovered);
  callback.current = onRecovered;

  useEffect(() => {
    if (!enabled) return undefined;
    const fire = () => callback.current();
    // `null` (not known yet) is not offline, so launch never counts as a recovery.
    let wasOffline = false;
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      const offline = isOffline(state);
      if (wasOffline && !offline) fire();
      wasOffline = offline;
    });
    const unsubscribeServer = connectivity.subscribe(fire);
    return () => {
      unsubscribeNet();
      unsubscribeServer();
    };
  }, [enabled]);
}
