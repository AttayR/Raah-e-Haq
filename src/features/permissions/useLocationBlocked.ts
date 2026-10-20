import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { locationOsApproximateOnly, locationOsDenied } from './locationStatus';

/**
 * Why the driver cannot go online: location refused (UI-R8), or only approximate location granted
 * on Android (T-596; dispatch needs the precise position).
 */
export type LocationBlockReason = 'denied' | 'approximate';

const readBlockReason = async (): Promise<LocationBlockReason | null> => {
  if (await locationOsDenied()) return 'denied';
  if (await locationOsApproximateOnly()) return 'approximate';
  return null;
};

/**
 * Whether location access blocks going online (UI-R8 denied state, T-596 approximate only),
 * re-read while `focused` when the screen gains focus, when the app comes back from Settings, and
 * on `recheck()`. The listener is removed on unmount. Read-only: it never asks the OS.
 */
export const useLocationBlocked = (
  focused: boolean,
): { blocked: boolean; reason: LocationBlockReason | null; recheck: () => void } => {
  const [reason, setReason] = useState<LocationBlockReason | null>(null);
  const mounted = useRef(true);

  const recheck = useCallback(() => {
    readBlockReason().then(next => {
      if (mounted.current) setReason(next);
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!focused) return undefined;
    recheck();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') recheck();
    });
    return () => subscription.remove();
  }, [focused, recheck]);

  return { blocked: reason !== null, reason, recheck };
};
