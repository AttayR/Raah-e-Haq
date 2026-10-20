import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigatorScreenParams } from '@react-navigation/native';
import DriverBottomTabs, { type DriverTabParamList } from '../tabs/DriverBottomTabs';
import DriverRideScreen from 'src/screens/Driver/DriverRideScreen';
import { useDriverStatusSync } from '../../../features/driver-status/hooks';
import { useDriverRideRestore } from '../../../features/driver-ride/hooks';
import { useDriverLocationTracking } from '../../../features/driver-location/hooks';
import ChatThreadScreen from '../../../features/chat/screens/ChatThreadScreen';
import { rideChatScreenId, type RideChatParams } from '../../../features/chat/navigation';
import { useNotificationsSync } from '../../../features/notifications/hooks';
import { usePushNotifications } from '../../../features/notifications/usePushNotifications';
import { topUpStatusScreenId } from '../../../features/wallet/navigation';
import type { DriverWalletRoutes } from '../../../features/wallet/navigation';
import { rideDetailsScreenId, type RideHistoryRoutes } from '../../../features/ride-history/navigation';
import type { SafetyRoutes } from '../../../features/safety/navigation';
import type { ProfileEditRoutes } from '../../../features/profile-edit/navigation';
import type { DriverStatementRoutes } from '../../../features/driver-statements/navigation';
import type { VehicleAcRoutes } from '../../../features/ac/navigation';
import type { ParcelDriverRoutes } from '../../../features/parcel/navigation';
import { supportTicketScreenId, type SupportRoutes } from '../../../features/support/navigation';
import type { AccountDeletionRoutes } from '../../../features/account-deletion/navigation';
import { keepScreenMounted, localeScreenLayout } from '../localeScreenLayout';

export type DriverStackParamList = {
  /** Drive · Earnings · Inbox · Account (UI-R4, DESIGN_SYSTEM §8.1). */
  DriverTabs: NavigatorScreenParams<DriverTabParamList> | undefined;
  Profile: undefined;
  /** Profile → Edit profile and Change / Verify number (T-504b, BE-35/BE-38). */
  ProfileEdit: ProfileEditRoutes['ProfileEdit'];
  ChangePhone: ProfileEditRoutes['ChangePhone'];
  /** One ride's chat thread (T-510). */
  RideChat: RideChatParams;
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
  /** Wallet top-up (T-515, BE-74): form, hosted checkout, polled result. */
  AddMoney: DriverWalletRoutes['AddMoney'];
  TopUpCheckout: DriverWalletRoutes['TopUpCheckout'];
  TopUpStatus: DriverWalletRoutes['TopUpStatus'];
  /** Account → Ride history and one ride's details/receipt (T-501). Earnings is a tab (UI-R4). */
  RideHistory: RideHistoryRoutes['RideHistory'];
  RideDetails: RideHistoryRoutes['RideDetails'];
  /** Account → Emergency contacts and its form (T-520, BE-79); the SOS sheet opens it too. */
  EmergencyContacts: SafetyRoutes['EmergencyContacts'];
  EmergencyContactEditor: SafetyRoutes['EmergencyContactEditor'];
  /** Earnings → Weekly statements and Strikes (T-521, BE-84 / BE-82 / BE-85). */
  DriverStatements: DriverStatementRoutes['DriverStatements'];
  DriverStrikes: DriverStatementRoutes['DriverStrikes'];
  /** Account → Vehicle AC (T-522, BE-86). */
  VehicleAc: VehicleAcRoutes['VehicleAc'];
  /** Account → Parcel deliveries (T-522, BE-88). */
  ParcelOptIn: ParcelDriverRoutes['ParcelOptIn'];
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
const loadDriverProfile = () => require('../../../screens/Driver/DriverProfile').default;
const loadProfileEditScreen = () => require('../../../features/profile-edit/screens/ProfileEditScreen').default;
const loadChangePhoneScreen = () => require('../../../features/profile-edit/screens/ChangePhoneScreen').default;
const loadNotificationPreferencesScreen = () => require('../../../features/notifications/screens/NotificationPreferencesScreen').NotificationPreferencesScreen;
const loadDriverDocumentsScreen = () => require('../../../features/driverDocuments/screens/DriverDocumentsScreen').DriverDocumentsScreen;
const loadWalletScreen = () => require('../../../features/wallet/screens/WalletScreen').default;
const loadTransactionDetailScreen = () => require('../../../features/wallet/screens/TransactionDetailScreen').default;
const loadAddMoneyScreen = () => require('../../../features/wallet/screens/AddMoneyScreen').default;
const loadTopUpCheckoutScreen = () => require('../../../features/wallet/screens/TopUpCheckoutScreen').default;
const loadTopUpStatusScreen = () => require('../../../features/wallet/screens/TopUpStatusScreen').default;
const loadPayCommissionScreen = () => require('../../../features/wallet/screens/PayCommissionScreen').default;
const loadSettlementsScreen = () => require('../../../features/wallet/screens/SettlementsScreen').default;
const loadRideHistoryScreen = () => require('../../../features/ride-history/screens/RideHistoryScreen').default;
const loadRideDetailsScreen = () => require('../../../features/ride-history/screens/RideDetailsScreen').default;
const loadEmergencyContactsScreen = () => require('../../../features/safety/screens/EmergencyContactsScreen').default;
const loadEmergencyContactEditorScreen = () => require('../../../features/safety/screens/EmergencyContactEditorScreen').default;
const loadWeeklyStatementScreen = () => require('../../../features/driver-statements/screens/WeeklyStatementScreen').default;
const loadDriverStrikesScreen = () => require('../../../features/driver-statements/screens/DriverStrikesScreen').default;
const loadVehicleAcScreen = () => require('../../../features/ac/screens/VehicleAcScreen').default;
const loadParcelOptInScreen = () => require('../../../features/parcel/screens/ParcelOptInScreen').default;

const loadSupportScreen = () => require('../../../features/support/screens/SupportScreen').default;
const loadSupportRequestsScreen = () => require('../../../features/support/screens/SupportRequestsScreen').default;
const loadSupportTicketScreen = () => require('../../../features/support/screens/SupportTicketScreen').default;
const loadSupportNewRequestScreen = () => require('../../../features/support/screens/SupportNewRequestScreen').default;
const loadInviteScreen = () => require('../../../features/invite/screens/InviteScreen').default;
const loadDeleteAccountScreen = () => require('../../../features/account-deletion/screens/DeleteAccountScreen').default;
const loadDeleteAccountVerifyScreen = () =>
  require('../../../features/account-deletion/screens/DeleteAccountVerifyScreen').default;

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
    // T-535 (PERF-14): screens deeper in the stack stop rendering until they are shown again.
    <Stack.Navigator screenOptions={{ headerShown: false, freezeOnBlur: true }} screenLayout={localeScreenLayout}>
      <Stack.Screen name="DriverTabs" component={DriverBottomTabs} layout={keepScreenMounted} />
      <Stack.Screen name="Profile" getComponent={loadDriverProfile} />
      <Stack.Screen name="ProfileEdit" getComponent={loadProfileEditScreen} />
      <Stack.Screen name="ChangePhone" getComponent={loadChangePhoneScreen} />
      {/* One screen per ride: another ride's thread never reuses this one's state. */}
      <Stack.Screen name="RideChat" component={ChatThreadScreen} getId={rideChatScreenId} />
      {/* The full-screen trip map (T-405): pushed over the tabs, so no tab bar. */}
      {/*
        Not frozen: the live ride still reacts (cancel, taken away) while the chat is on top. Fabric
        native-stack does not freeze the screen directly below the focused one anyway; this keeps
        it so when another screen is pushed or those freeze rules change (see useMapMounted).
      */}
      <Stack.Screen name="DriverRide" component={DriverRideScreen} options={{ freezeOnBlur: false }} />
      <Stack.Screen name="NotificationPreferences" getComponent={loadNotificationPreferencesScreen} />
      <Stack.Screen name="DriverDocuments" getComponent={loadDriverDocumentsScreen} />
      <Stack.Screen name="Wallet" getComponent={loadWalletScreen} />
      <Stack.Screen name="WalletTransaction" getComponent={loadTransactionDetailScreen} />
      <Stack.Screen name="AddMoney" getComponent={loadAddMoneyScreen} />
      {/* No swipe-back: leaving the checkout always goes to the status screen. */}
      <Stack.Screen name="TopUpCheckout" getComponent={loadTopUpCheckoutScreen} options={{ gestureEnabled: false }} />
      <Stack.Screen name="TopUpStatus" getComponent={loadTopUpStatusScreen} getId={topUpStatusScreenId} />
      <Stack.Screen name="PayCommission" getComponent={loadPayCommissionScreen} />
      <Stack.Screen name="WalletSettlements" getComponent={loadSettlementsScreen} />
      <Stack.Screen name="RideHistory" getComponent={loadRideHistoryScreen} />
      <Stack.Screen name="RideDetails" getComponent={loadRideDetailsScreen} getId={rideDetailsScreenId} />
      <Stack.Screen name="EmergencyContacts" getComponent={loadEmergencyContactsScreen} />
      <Stack.Screen name="EmergencyContactEditor" getComponent={loadEmergencyContactEditorScreen} />
      <Stack.Screen name="DriverStatements" getComponent={loadWeeklyStatementScreen} />
      <Stack.Screen name="DriverStrikes" getComponent={loadDriverStrikesScreen} />
      <Stack.Screen name="VehicleAc" getComponent={loadVehicleAcScreen} />
      <Stack.Screen name="ParcelOptIn" getComponent={loadParcelOptInScreen} />
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

export default DriverStack;