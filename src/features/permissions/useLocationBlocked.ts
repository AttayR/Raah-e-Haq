import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { locationOsDenied } from './locationStatus';

/**
 * Whether location access is refused (UI-R8 denied state), re-read while `focused` when the
 * screen gains focus, when the app comes back from Settings, and on `recheck()`. The listener is
 * removed on unmount. Read-only: it never asks the OS.
 */
export const useLocationBlocked = (focused: boolean): { blocked: boolean; recheck: () => void } => {
  const [blocked, setBlocked] = useState(false);
  const mounted = useRef(true);

  const recheck = useCallback(() => {
    locationOsDenied().then(denied => {
      if (mounted.current) setBlocked(denied);
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

  return { blocked, recheck };
};
