import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * True while the app is in the foreground. The listener is removed on unmount. Shared by the
 * driver pollers and (T-517) the passenger's driver-location reads.
 */
export const useAppIsActive = (): boolean => {
  const [state, setState] = useState<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setState);
    return () => subscription.remove();
  }, []);
  // iOS `inactive` is a short transition (Control Centre, app switcher) with the app still
  // visible; only `background` stops the work.
  return state !== 'background';
};
