import React, { useCallback } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import PassengerBottomTabs, { type PassengerTabParamList } from '../tabs/PassengerBottomTabs';
import PassengerMapScreen from 'src/screens/Passenger/PassengerMapScreen';
import { useRestoreActiveRide } from '../../../features/active-ride/hooks';
import ChatThreadScreen from '../../../features/chat/screens/ChatThreadScreen';
import { rideChatScreenId, type RideChatParams } from '../../../features/chat/navigation';
import { useNotificationsSync } from '../../../features/notifications/hooks';
import { usePushNotifications } from '../../../features/notifications/usePushNotifications';
import { topUpStatusScreenId } from '../../../features/wallet/navigation';
import type { WalletRoutes } from '../../../features/wallet/navigation';
import { rideDetailsScreenId, type RideHistoryRoutes } from '../../../features/ride-history/navigation';
import type { SavedPlaceEditorParams } from '../../../features/saved-places/navigation';
import type { BookingParams } from '../../../features/ride-booking/prefill';
import type { SafetyRoutes } from '../../../features/safety/navigation';
import type { ProfileEditRoutes } from '../../../features/profile-edit/navigation';
import type { RootStackParamList } from '../RootNavigation';

export type PassengerStackParamList = {
  /** Home · Activity · Inbox · Account (UI-R4, DESIGN_SYSTEM §8.1). */
  PassengerTabs: NavigatorScreenParams<PassengerTabParamList> | undefined;
  Profile: undefined;
  /** Profile → Edit profile and Change / Verify number (T-504b, BE-35/BE-38). */
  ProfileEdit: ProfileEditRoutes['ProfileEdit'];
  ChangePhone: ProfileEditRoutes['ChangePhone'];
  /** One ride's chat thread (T-510). */
  RideChat: RideChatParams;
  /**
   * The booking flow and the ride in progress, full-screen over the tabs (T-301; UI-R4 rename of
   * PassengerMap). Optional pickup/destination prefill from a saved place (T-516).
   */
  Booking: BookingParams | undefined;
  /** One ride's details/receipt (T-501); the list itself is Activity › Rides. */
  RideDetails: RideHistoryRoutes['RideDetails'];
  /** Account → Saved places (T-516, BE-14). */
  FavoriteLocations: undefined;
  /** Add or edit one saved place (T-516). */
  SavedPlaceEditor: SavedPlaceEditorParams | undefined;
  /** One ledger entry (T-508); the wallet itself is Activity › Wallet. */
  WalletTransaction: WalletRoutes['WalletTransaction'];
  /** Wallet top-up (T-515, BE-74): form, hosted checkout, polled result. */
  AddMoney: WalletRoutes['AddMoney'];
  TopUpCheckout: WalletRoutes['TopUpCheckout'];
  TopUpStatus: WalletRoutes['TopUpStatus'];
  /** Account → Notifications: push preferences (T-502, BE-11). */
  NotificationPreferences: undefined;
  /** Account → Emergency contacts and its form (T-520, BE-79); the SOS sheet opens it too. */
  EmergencyContacts: SafetyRoutes['EmergencyContacts'];
  EmergencyContactEditor: SafetyRoutes['EmergencyContactEditor'];
};

/*
 * Secondary routes are required on first navigation, not when the stack mounts (PERF-03,
 * T-531): the first screen paints without evaluating these screens and their imports.
 */
const loadPassengerProfile = () => require('../../../screens/Passenger/Passengerprofile').default;
const loadProfileEditScreen = () => require('../../../features/profile-edit/screens/ProfileEditScreen').default;
const loadChangePhoneScreen = () => require('../../../features/profile-edit/screens/ChangePhoneScreen').default;
const loadNotificationPreferencesScreen = () => require('../../../features/notifications/screens/NotificationPreferencesScreen').NotificationPreferencesScreen;
const loadTransactionDetailScreen = () => require('../../../features/wallet/screens/TransactionDetailScreen').default;
const loadAddMoneyScreen = () => require('../../../features/wallet/screens/AddMoneyScreen').default;
const loadTopUpCheckoutScreen = () => require('../../../features/wallet/screens/TopUpCheckoutScreen').default;
const loadTopUpStatusScreen = () => require('../../../features/wallet/screens/TopUpStatusScreen').default;
const loadRideDetailsScreen = () => require('../../../features/ride-history/screens/RideDetailsScreen').default;
const loadSavedPlacesScreen = () => require('../../../features/saved-places/screens/SavedPlacesScreen').default;
const loadSavedPlaceEditorScreen = () => require('../../../features/saved-places/screens/SavedPlaceEditorScreen').default;
const loadEmergencyContactsScreen = () => require('../../../features/safety/screens/EmergencyContactsScreen').default;
const loadEmergencyContactEditorScreen = () => require('../../../features/safety/screens/EmergencyContactEditorScreen').default;

const Stack = createNativeStackNavigator<PassengerStackParamList>();

type Props = NativeStackScreenProps<RootStackParamList, 'Passenger'>;

/**
 * The passenger app. `Booking` is the one booking route (T-301: never also a tab; UI-R4: Home is
 * the map-first tab and "Where to?" pushes it). On mount it asks the server for an in-progress
 * ride and, if there is one, opens the booking screen on top of the tabs, which shows it from
 * the activeRide slice.
 */
const PassengerStack = ({ navigation }: Props) => {
  const openActiveRide = useCallback(() => {
    // initial: false keeps PassengerTabs underneath, so Back returns to Home.
    navigation.navigate('Passenger', { screen: 'Booking', initial: false });
  }, [navigation]);
  useRestoreActiveRide(openActiveRide);
  // The one unread-count owner and FCM (device registration, foreground toast, tap routing) (T-502).
  useNotificationsSync();
  usePushNotifications('passenger');

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PassengerTabs" component={PassengerBottomTabs} />
      <Stack.Screen name="Profile" getComponent={loadPassengerProfile} />
      <Stack.Screen name="ProfileEdit" getComponent={loadProfileEditScreen} />
      <Stack.Screen name="ChangePhone" getComponent={loadChangePhoneScreen} />
      {/* One screen per ride: another ride's thread never reuses this one's state. */}
      <Stack.Screen name="RideChat" component={ChatThreadScreen} getId={rideChatScreenId} />
      <Stack.Screen name="Booking" component={PassengerMapScreen} />
      <Stack.Screen name="RideDetails" getComponent={loadRideDetailsScreen} getId={rideDetailsScreenId} />
      <Stack.Screen name="FavoriteLocations" getComponent={loadSavedPlacesScreen} />
      <Stack.Screen name="SavedPlaceEditor" getComponent={loadSavedPlaceEditorScreen} />
      <Stack.Screen name="WalletTransaction" getComponent={loadTransactionDetailScreen} />
      <Stack.Screen name="AddMoney" getComponent={loadAddMoneyScreen} />
      {/* No swipe-back: leaving the checkout always goes to the status screen. */}
      <Stack.Screen name="TopUpCheckout" getComponent={loadTopUpCheckoutScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="TopUpStatus" getComponent={loadTopUpStatusScreen} getId={topUpStatusScreenId} />
      <Stack.Screen name="NotificationPreferences" getComponent={loadNotificationPreferencesScreen} />
      <Stack.Screen name="EmergencyContacts" getComponent={loadEmergencyContactsScreen} />
      <Stack.Screen name="EmergencyContactEditor" getComponent={loadEmergencyContactEditorScreen} />
    </Stack.Navigator>
  );
};

export default PassengerStack;
