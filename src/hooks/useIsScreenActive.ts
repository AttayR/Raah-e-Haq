import { useCallback, useContext, useSyncExternalStore } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { useAppIsActive } from './useAppIsActive';

const noop = () => undefined;

/**
 * True while the screen this component sits in is focused (T-535). Outside a navigator (the
 * dev gallery, a component test) there is no screen to blur, so it is always true; unlike
 * `useIsFocused` it does not throw there.
 */
export const useIsFocusedSafe = (): boolean => {
  const navigation = useContext(NavigationContext);
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!navigation) return noop;
      const offFocus = navigation.addListener('focus', onChange);
      const offBlur = navigation.addListener('blur', onChange);
      return () => {
        offFocus();
        offBlur();
      };
    },
    [navigation],
  );
  const isFocused = useCallback(() => (navigation ? navigation.isFocused() : true), [navigation]);
  return useSyncExternalStore(subscribe, isFocused, isFocused);
};

/**
 * True while the user can see this screen: it is focused and the app is in the foreground
 * (T-535, PERF-13). Frame loops (the live vehicle marker) stop when it turns false.
 */
export const useIsScreenActive = (): boolean => {
  const focused = useIsFocusedSafe();
  const appActive = useAppIsActive();
  return focused && appActive;
};
