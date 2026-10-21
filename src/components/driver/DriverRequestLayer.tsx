import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  StackActions,
  TabActions,
  useIsFocused,
  type NavigationAction,
  type NavigationState,
} from '@react-navigation/native';
import { useDriverLastLocation } from '../../features/driver-location/hooks';
import { usePendingRidePolling } from '../../features/driver-requests/hooks';
import {
  createOfferSession,
  OfferSessionContext,
  useOfferSessionPruning,
} from '../../features/driver-requests/offerSession';
import { IncomingRequestBanner } from './IncomingRequestBanner';

const TABS_ROUTE = 'DriverTabs';
const DRIVE_TAB = 'Drive';

type TabsRoute = NavigationState['routes'][number] & {
  state?: { key?: string; index?: number; routes: ReadonlyArray<{ name: string }> };
  params?: object;
};

/**
 * True while the driver stack shows the tabs with the Drive tab open (the request sheet's place).
 * Before the tab navigator has a state of its own, the tab named in the params (a notification
 * opening Inbox) or the first tab, Drive, is the open one.
 */
export const isDriveTabFocused = (state: Pick<NavigationState, 'index' | 'routes'>): boolean => {
  const top = state.routes[state.index] as TabsRoute | undefined;
  if (top?.name !== TABS_ROUTE) return false;
  const tabs = top.state;
  if (!tabs) {
    const screen = top.params && 'screen' in top.params ? top.params.screen : undefined;
    return screen === undefined || screen === DRIVE_TAB;
  }
  const index = tabs.index ?? tabs.routes.length - 1;
  return tabs.routes[index]?.name === DRIVE_TAB;
};

/**
 * The single GET /rides/pending poller (T-403 cadence, 5 s). Its own component, so a GPS fix
 * re-renders only this (it renders nothing). It runs while the driver stack is on screen; the
 * hook itself stops it offline, on a ride, in the background and on unmount (sign-out).
 */
export function DriverRequestFeedPoller(): null {
  const isFocused = useIsFocused();
  const location = useDriverLastLocation();
  usePendingRidePolling({ isFocused, location });
  return null;
}

type LayerProps = {
  state: Pick<NavigationState, 'key' | 'index' | 'routes'>;
  navigation: { dispatch: (action: NavigationAction) => void };
  children: React.ReactNode;
};

/**
 * T-708: the driver stack's `layout`. It owns the request feed for every driver tab and screen
 * (moved up from RideRequestHost, which polled only while the tabs were on screen), shares one
 * OfferSession between the banner and the Drive request sheet, and shows the in-app banner
 * whenever the Drive tab is not on screen. Tapping the banner returns to the tabs on Drive, where
 * RideRequestHost shows the same request with the same countdown.
 */
export function DriverRequestLayer({ state, navigation, children }: LayerProps) {
  const [session] = useState(createOfferSession);
  useOfferSessionPruning(session);
  const driveFocused = isDriveTabFocused(state);

  const top = state.routes[state.index] as TabsRoute | undefined;
  const tabsOnTop = top?.name === TABS_ROUTE;
  const tabsKey = tabsOnTop ? top?.state?.key : undefined;
  const openDrive = useCallback(() => {
    if (tabsOnTop) {
      // On another tab: select Drive (with no tab state yet, the params route it).
      navigation.dispatch(
        tabsKey
          ? { ...TabActions.jumpTo(DRIVE_TAB), target: tabsKey }
          : StackActions.popTo(TABS_ROUTE, { screen: DRIVE_TAB }),
      );
      return;
    }
    // Under a stack screen: one popTo; the tabs open Drive from its params once they are back.
    // A leave guard on that screen (beforeRemove) can refuse it; then nothing else is changed.
    navigation.dispatch(StackActions.popTo(TABS_ROUTE, { screen: DRIVE_TAB }));
  }, [navigation, tabsKey, tabsOnTop]);

  return (
    <OfferSessionContext.Provider value={session}>
      <View style={styles.container}>
        {children}
        <DriverRequestFeedPoller />
        {driveFocused ? null : <IncomingRequestBanner onOpen={openDrive} />}
      </View>
    </OfferSessionContext.Provider>
  );
}

/** For `<Stack.Navigator layout={driverRequestLayout}>` (a stable function, never re-created). */
export const driverRequestLayout = (props: LayerProps) => <DriverRequestLayer {...props} />;

const styles = StyleSheet.create({
  container: { flex: 1 },
});
