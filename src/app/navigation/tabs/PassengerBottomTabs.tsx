import React, { useCallback } from 'react';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import PassengerHomeScreen from 'src/screens/Passenger/PassengerHomeScreen';
import PassengerSettingsScreen from 'src/screens/Passenger/PassengerSettingsScreen';
import ActivityScreen, { type ActivityParams } from '../../../features/activity/ActivityScreen';
import InboxScreen, { type InboxParams } from '../../../features/inbox/InboxScreen';
import { useUnreadNotificationCount } from '../../../features/notifications/hooks';
import { PASSENGER_TABS, RoleTabBar } from './RoleTabBar';
import { localeScreenLayout } from '../localeScreenLayout';
import { useLocale } from '../../../i18n/languagePreference';

/** DESIGN_SYSTEM §8.1: Home · Activity · Inbox · Account (no Map tab, UI-R4). */
export type PassengerTabParamList = {
  Home: undefined;
  Activity: ActivityParams | undefined;
  Inbox: InboxParams | undefined;
  Account: undefined;
};

const Tab = createBottomTabNavigator<PassengerTabParamList>();

/**
 * The passenger's four tabs with the shared tab bar (§5.3). Home is the map-first screen;
 * "Where to?" pushes the Booking stack route (tab bar hidden). The Inbox badge reads the store
 * only: PassengerStack owns the unread-count poll (T-502).
 */
const PassengerBottomTabs = () => {
  const inboxUnread = useUnreadNotificationCount();
  // T-523: a new tab bar function after a language switch, so its labels re-render.
  const locale = useLocale();
  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => <RoleTabBar key={locale} {...props} specs={PASSENGER_TABS} inboxUnread={inboxUnread} />,
    [inboxUnread, locale],
  );

  return (
    // T-535 (PERF-14): a tab that is not shown stops rendering (its state is kept).
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{ headerShown: false, animation: 'none', freezeOnBlur: true }}
      screenLayout={localeScreenLayout}
    >
      <Tab.Screen name="Home" component={PassengerHomeScreen} />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Inbox" component={PassengerInboxTab} />
      <Tab.Screen name="Account" component={PassengerSettingsScreen} />
    </Tab.Navigator>
  );
};

function PassengerInboxTab() {
  return <InboxScreen role="passenger" />;
}

export default PassengerBottomTabs;
