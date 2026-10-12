import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DriverBottomTabs from '../tabs/DriverBottomTabs';
import DriverProfile from 'src/screens/Driver/DriverProfile';
import DriverMapScreen from 'src/screens/Driver/DriverMapScreen';
import DriverRideScreen from 'src/screens/Driver/DriverRideScreen';
import { useDriverStatusSync } from '../../../features/driver-status/hooks';
import { useDriverRideRestore } from '../../../features/driver-ride/hooks';
import { useDriverLocationTracking } from '../../../features/driver-location/hooks';
import ChatThreadScreen from '../../../features/chat/screens/ChatThreadScreen';
import { rideChatScreenId, type RideChatParams } from '../../../features/chat/navigation';
import { useNotificationsSync } from '../../../features/notifications/hooks';
import { usePushNotifications } from '../../../features/notifications/usePushNotifications';
import { NotificationPreferencesScreen } from '../../../features/notifications/screens/NotificationPreferencesScreen';
import { DriverDocumentsScreen } from '../../../features/driverDocuments/screens/DriverDocumentsScreen';
import WalletScreen from '../../../features/wallet/screens/WalletScreen';
import TransactionDetailScreen from '../../../features/wallet/screens/TransactionDetailScreen';
import PayCommissionScreen from '../../../features/wallet/screens/PayCommissionScreen';
import SettlementsScreen from '../../../features/wallet/screens/SettlementsScreen';
import type { DriverWalletRoutes } from '../../../features/wallet/navigation';
import DriverEarningsScreen from '../../../features/stats/screens/DriverEarningsScreen';

export type DriverStackParamList = {
  DriverTabs: undefined;
  DriverProfile: undefined;
  /** One ride's chat thread (T-510). */
  RideChat: RideChatParams;
  DriverMap: undefined;
  /** The driver's current ride (T-405); it reads the ride from the driverRide slice. */
  DriverRide: undefined;
  /** Settings → Notifications: push preferences (T-502, BE-11). */
  NotificationPreferences: undefined;
  /** Settings → Vehicle & documents: review state + re-upload (T-203, BE-66). */
  DriverDocuments: undefined;
  /** Wallet: balance, commission owed and its payment reports, ledger (T-508, BE-09). */
  Wallet: DriverWalletRoutes['Wallet'];
  WalletTransaction: DriverWalletRoutes['WalletTransaction'];
  PayCommission: DriverWalletRoutes['PayCommission'];
  WalletSettlements: DriverWalletRoutes['WalletSettlements'];
  /** Earnings per day / week / month (T-507, BE-08). */
  DriverEarnings: undefined;
};

const Stack = createNativeStackNavigator<DriverStackParamList>();

const DriverStack = () => {
  // Driver online/offline from the server: after sign-in (this mounts) and on foreground (T-401).
  useDriverStatusSync();
  // A ride the server reports as active (on_ride + active_ride_id) is read back (T-405).
  useDriverRideRestore();
  // The one foreground location tracker: online or on a ride, app in the foreground (T-402).
  useDriverLocationTracking();
  // The one unread-count owner and FCM (device registration, foreground toast, tap routing) (T-502).
  useNotificationsSync();
  usePushNotifications('driver');

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="DriverTabs" 
        component={DriverBottomTabs} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="DriverProfile" 
        component={DriverProfile} 
        options={{ headerShown: false }}
      />
      {/* One screen per ride: another ride's thread never reuses this one's state. */}
      <Stack.Screen name="RideChat" component={ChatThreadScreen} getId={rideChatScreenId} />
      <Stack.Screen 
        name="DriverMap" 
        component={DriverMapScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverRide"
        component={DriverRideScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
      <Stack.Screen name="DriverDocuments" component={DriverDocumentsScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="WalletTransaction" component={TransactionDetailScreen} />
      <Stack.Screen name="PayCommission" component={PayCommissionScreen} />
      <Stack.Screen name="WalletSettlements" component={SettlementsScreen} />
      <Stack.Screen name="DriverEarnings" component={DriverEarningsScreen} />
    </Stack.Navigator>
  );
};

export default DriverStack;