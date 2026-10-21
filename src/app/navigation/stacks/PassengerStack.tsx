import React, { useCallback } from 'react';
import {
  createNativeStackNavigator,
  type NativeStackNavigationOptions,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type { NavigatorScreenParams, RouteProp } from '@react-navigation/native';
import { motion } from '../../../theme';
import PassengerBottomTabs, { type PassengerTabParamList } from '../tabs/PassengerBottomTabs';
import PassengerMapScreen from 'src/screens/Passenger/PassengerMapScreen';
import { useRestoreActiveRide } from '../../../features/active-ride/hooks';
import ChatThreadScreen from '../../../features/chat/screens/ChatThreadScreen';
import { rideChatScreenId, type RideChatParams } from '../../../features/chat/navigation';
import { useNotificationsSync } from '../../../features/notifications/hooks';
import { useRealtimeSession } from '../../../features/realtime/useRealtimeSession';
import { usePushNotifications } from '../../../features/notifications/usePushNotifications';
import { topUpStatusScreenId } from '../../../features/wallet/navigation';
import type { WalletRoutes } from '../../../features/wallet/navigation';
import { rideDetailsScreenId, type RideHistoryRoutes } from '../../../features/ride-history/navigation';
import type { SavedPlaceEditorParams } from '../../../features/saved-places/navigation';
import type { BookingParams } from '../../../features/ride-booking/prefill';
import type { SafetyRoutes } from '../../../features/safety/navigation';
import type { ProfileEditRoutes } from '../../../features/profile-edit/navigation';
import type { ParcelPassengerRoutes } from '../../../features/parcel/navigation';
import type { RootStackParamList } from '../RootNavigation';
import { supportTicketScreenId, type SupportRoutes } from '../../../features/support/navigation';
import type { AccountDeletionRoutes } from '../../../features/account-deletion/navigation';
import { keepScreenMounted, localeScreenLayout } from '../localeScreenLayout';

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
  /** Home → "Send a parcel" (T-522, BE-88). */
  SendParcel: ParcelPassengerRoutes['SendParcel'];
  /** Account → Help & support, its requests, one request and a new one (UI-R18, BE-130). */
  Support: SupportRoutes['Support'];
  SupportRequests: SupportRoutes['SupportRequests'];
  SupportTicket: SupportRoutes['SupportTicket'];
  SupportNewRequest: SupportRoutes['SupportNewRequest'];
  /** Account → Invite friends (UI-R18, BE-131). */
  Invite: undefined;
  /** Profile → Delete account and its SMS-code step (UI-R18 §D, BE-129). */
  DeleteAccount: AccountDeletionRoutes['DeleteAccount'];
  DeleteAccountVerify: AccountDeletionRoutes['DeleteAccountVerify'];
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
const loadSendParcelScreen = () => require('../../../features/parcel/screens/SendParcelScreen').default;

const loadSupportScreen = () => require('../../../features/support/screens/SupportScreen').default;
const loadSupportRequestsScreen = () => require('../../../features/support/screens/SupportRequestsScreen').default;
const loadSupportTicketScreen = () => require('../../../features/support/screens/SupportTicketScreen').default;
const loadSupportNewRequestScreen = () => require('../../../features/support/screens/SupportNewRequestScreen').default;
const loadInviteScreen = () => require('../../../features/invite/screens/InviteScreen').default;
const loadDeleteAccountScreen = () => require('../../../features/account-deletion/screens/DeleteAccountScreen').default;
const loadDeleteAccountVerifyScreen = () =>
  require('../../../features/account-deletion/screens/DeleteAccountVerifyScreen').default;

const Stack = createNativeStackNavigator<PassengerStackParamList>();

/** Booking options: never frozen; the "Where to?" entry fades in for its shared-element move (UI-R9b). */
export const bookingScreenOptions = ({ route }: { route: RouteProp<PassengerStackParamList, 'Booking'> }): NativeStackNavigationOptions =>
  route.params?.entry === 'whereTo'
    ? { freezeOnBlur: false, animation: 'fade', animationDuration: motion.base.duration }
    : { freezeOnBlur: false };

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
  // T-406: realtime hints (user, driver and ride channels) that wake the polls.
  useRealtimeSession('passenger');
  usePushNotifications('passenger');

  return (
    // T-535 (PERF-14): screens deeper in the stack stop rendering until they are shown again.
    <Stack.Navigator screenOptions={{ headerShown: false, freezeOnBlur: true }} screenLayout={localeScreenLayout}>
      <Stack.Screen name="PassengerTabs" component={PassengerBottomTabs} layout={keepScreenMounted} />
      <Stack.Screen name="Profile" getComponent={loadPassengerProfile} />
      <Stack.Screen name="ProfileEdit" getComponent={loadProfileEditScreen} />
      <Stack.Screen name="ChangePhone" getComponent={loadChangePhoneScreen} />
      {/* One screen per ride: another ride's thread never reuses this one's state. */}
      <Stack.Screen name="RideChat" component={ChatThreadScreen} getId={rideChatScreenId} />
      {/*
        Not frozen: the live ride still reacts (cancel, finish) while the chat is on top. Fabric
        native-stack does not freeze the screen directly below the focused one anyway; this keeps
        it so when another screen is pushed or those freeze rules change (see useMapMounted).
      */}
      {/* UI-R9b: from "Where to?" Booking fades in (250 ms) while the bar moves to the planner. */}
      <Stack.Screen name="Booking" component={PassengerMapScreen} options={bookingScreenOptions} />
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
      <Stack.Screen name="SendParcel" getComponent={loadSendParcelScreen} />
      <Stack.Screen name="Support" getComponent={loadSupportScreen} />
      <Stack.Screen name="SupportRequests" getComponent={loadSupportRequestsScreen} />
      {/* One screen per request: a push for another request opens its own thread. */}
      <Stack.Screen name="SupportTicket" getComponent={loadSupportTicketScreen} getId={supportTicketScreenId} />
      <Stack.Screen name="SupportNewRequest" getComponent={loadSupportNewRequestScreen} />
      <Stack.Screen name="Invite" getComponent={loadInviteScreen} />
      <Stack.Screen name="DeleteAccount" getComponent={loadDeleteAccountScreen} />
      <Stack.Screen name="DeleteAccountVerify" getComponent={loadDeleteAccountVerifyScreen} />
    </Stack.Navigator>
  );
};

export default PassengerStack;
