import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import DriverDriveScreen from 'src/screens/Driver/DriverDriveScreen';
import DriverSettingsScreen from 'src/screens/Driver/DriverSettingsScreen';
import DriverEarningsScreen from '../../../features/stats/screens/DriverEarningsScreen';
import InboxScreen, { type InboxParams } from '../../../features/inbox/InboxScreen';
import { useUnreadNotificationCount } from '../../../features/notifications/hooks';
import { RideRequestHost } from '../../../components/driver/RideRequestHost';
import { IncomingRequestFramingContext, IncomingRequestShownContext } from '../../../features/driver-requests/overlay';
import type { DriverStackParamList } from '../stacks/DriverStack';
import { DRIVER_TABS, RoleTabBar } from './RoleTabBar';
import { localeScreenLayout } from '../localeScreenLayout';
import { useLocale } from '../../../i18n/languagePreference';

/** DESIGN_SYSTEM §8.1: Drive · Earnings · Inbox · Account (no Map tab, UI-R4). */
export type DriverTabParamList = {
  Drive: undefined;
  Earnings: undefined;
  Inbox: InboxParams | undefined;
  Account: undefined;
};

const Tab = createBottomTabNavigator<DriverTabParamList>();

type Props = NativeStackScreenProps<DriverStackParamList, 'DriverTabs'>;

/**
 * The driver's four tabs with the shared tab bar (§5.3). RideRequestHost is mounted once here
 * (the single GET /rides/pending poller, T-408): a request switches to the Drive tab and hides
 * the tab bar so it sits on the Drive map (§8.3); declining or a timeout brings the bar back.
 */
const DriverBottomTabs = ({ navigation }: Props) => {
  const inboxUnread = useUnreadNotificationCount();
  const [requestShown, setRequestShown] = useState(false);
  const [requestSheetHeight, setRequestSheetHeight] = useState(0);
  const [shownOfferId, setShownOfferId] = useState<number | null>(null);
  // UI-R11 R1: what the Drive map frames (the offer on screen, never the taken state).
  const framing = useMemo(
    () => ({ rideId: requestShown ? shownOfferId : null, sheetHeight: requestShown ? requestSheetHeight : 0 }),
    [requestShown, requestSheetHeight, shownOfferId],
  );
  const [activeTab, setActiveTab] = useState<keyof DriverTabParamList>('Drive');

  const onRequestShownChange = useCallback(
    (shown: boolean) => {
      setRequestShown(shown);
      if (shown && activeTab !== 'Drive') {
        navigation.navigate('DriverTabs', { screen: 'Drive' });
      }
    },
    [activeTab, navigation],
  );

  // T-523: a new tab bar function after a language switch, so its labels re-render.
  const locale = useLocale();
  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => (
      <RoleTabBar key={locale} {...props} specs={DRIVER_TABS} inboxUnread={inboxUnread} hidden={requestShown} />
    ),
    [inboxUnread, requestShown, locale],
  );

  return (
    <IncomingRequestShownContext.Provider value={requestShown}>
      <IncomingRequestFramingContext.Provider value={framing}>
        <View style={styles.container}>
          <Tab.Navigator
            tabBar={renderTabBar}
            screenListeners={({ route }) => ({
              focus: () => setActiveTab(route.name),
            })}
            // T-535 (PERF-14): a tab that is not shown stops rendering (its state is kept).
            screenOptions={{ headerShown: false, animation: 'none', freezeOnBlur: true }}
            screenLayout={localeScreenLayout}
          >
            <Tab.Screen name="Drive" component={DriverDriveScreen} />
            <Tab.Screen name="Earnings" component={DriverEarningsScreen} />
            <Tab.Screen name="Inbox" component={DriverInboxTab} />
            <Tab.Screen name="Account" component={DriverSettingsScreen} />
          </Tab.Navigator>
          {/* UI-R11: the request sheet sits on the bottom edge over the hidden tab bar. */}
          <RideRequestHost
            onRequestShownChange={onRequestShownChange}
            onSheetHeightChange={setRequestSheetHeight}
            onShownOfferChange={setShownOfferId}
          />
        </View>
      </IncomingRequestFramingContext.Provider>
    </IncomingRequestShownContext.Provider>
  );
};

function DriverInboxTab() {
  return <InboxScreen role="driver" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default DriverBottomTabs;
