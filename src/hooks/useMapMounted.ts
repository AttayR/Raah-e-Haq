import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useIsFocused, useNavigation } from '@react-navigation/native';

/**
 * How long a covered map stays mounted (ms): the push animation (~350 ms) ends over it first,
 * so the screen sliding away still shows its map.
 */
export const MAP_RELEASE_DELAY_MS = 600;

const noop = () => undefined;

/**
 * True while this (tab) screen is covered by one of `routeNames` in the parent stack (T-535,
 * PERF-14), e.g. Home under Booking (also with the ride chat pushed over Booking). Pass a
 * module-level constant array. False outside a stack (tests that mock the navigation).
 */
export const useCoveredByRoutes = (routeNames: readonly string[]): boolean => {
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const parent = typeof navigation.getParent === 'function' ? navigation.getParent() : undefined;
  const subscribe = useCallback((onChange: () => void) => (parent ? parent.addListener('state', onChange) : noop), [parent]);
  const inStack = useCallback(() => {
    const state = parent?.getState();
    return state ? state.routes.some(route => routeNames.includes(route.name)) : false;
  }, [parent, routeNames]);
  const routeInStack = useSyncExternalStore(subscribe, inStack, inStack);
  return !isFocused && routeInStack;
};

/**
 * Depends on Fabric native-stack (react-native-screens 4) not freezing the screen directly below
 * the focused one: the tab screen still renders while the map route is on top, so the delayed
 * release below can unmount the map. If that changes (old architecture, a react-native-screens
 * upgrade), a frozen tab would keep its map mounted until it is shown again; re-check then.
 *
 * Whether this screen's map may stay mounted (T-535, PERF-14: one live Google Map per role).
 * While a full-screen map route (Booking, DriverRide) is on top, the map under it is unmounted
 * after MAP_RELEASE_DELAY_MS, freeing its native memory; it mounts again as soon as this screen
 * is uncovered.
 */
export const useMapMounted = (coveringRoutes: readonly string[]): boolean => {
  const covered = useCoveredByRoutes(coveringRoutes);
  const [released, setReleased] = useState(false);
  useEffect(() => {
    if (!covered) {
      setReleased(false);
      return;
    }
    const timer = setTimeout(() => setReleased(true), MAP_RELEASE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [covered]);
  return !covered || !released;
};
