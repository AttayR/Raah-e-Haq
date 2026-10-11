import React, { useCallback, useState } from 'react';
import { Linking, RefreshControl, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PassengerStackParamList } from '../../app/navigation/stacks/PassengerStack';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { RootState, useAppDispatch } from '../../store';
import { getUserProfile } from '../../store/thunks/apiThunks';
import { useLogout } from '../../hooks/useLogout';
import { AppText, ListGroup, ListItem, Screen } from '../../components/ui';
import { AppearanceRow } from '../../components/driver/settings/AppearanceRow';
import { ProfileSummaryCard } from '../../components/passenger/settings/ProfileSummaryCard';
import { PASSENGER_SETTINGS_COPY as COPY } from '../../components/passenger/settings/copy';
import { space } from '../../theme';

/**
 * Passenger Settings tab (T-618 passenger side, shared-settings spec). Every row leads somewhere:
 * the profile card opens the Profile view, Notifications opens the push preferences (BE-11,
 * T-502) with the phone's own settings as a second row, Appearance is the T-601 override and
 * Sign out is the shared confirm flow (T-102). Help & support and Invite friends come back
 * with T-619; the notification inbox is its own tab, so it is not repeated here.
 */
const PassengerSettingsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  const dispatch = useAppDispatch();
  const { theme } = useAppTheme();
  const { user } = useSelector((state: RootState) => state.apiAuth);
  const { confirmLogout, isLoggingOut } = useLogout();
  const [refreshing, setRefreshing] = useState(false);

  // Pull to refresh re-reads GET /auth/profile (the thunk drops a stale-session result).
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dispatch(getUserProfile());
    } finally {
      setRefreshing(false);
    }
  }, [dispatch]);

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      testID="passenger-settings"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
    >
      <AppText variant="h1" accessibilityRole="header">
        {COPY.title}
      </AppText>

      <ProfileSummaryCard user={user} onPress={() => navigation.navigate('PassengerPofile')} />

      <ListGroup title={COPY.accountGroup}>
        <ListItem
          icon="wallet"
          title={COPY.wallet}
          subtitle={COPY.walletSubtitle}
          onPress={() => navigation.navigate('Wallet')}
          testID="passenger-settings-wallet"
        />
        <ListItem
          icon="bookmark"
          title={COPY.savedPlaces}
          subtitle={COPY.savedPlacesSubtitle}
          onPress={() => navigation.navigate('FavoriteLocations')}
          testID="passenger-settings-saved-places"
        />
        <ListItem
          icon="history"
          title={COPY.rideHistory}
          subtitle={COPY.rideHistorySubtitle}
          onPress={() => navigation.navigate('RideHistory')}
          testID="passenger-settings-ride-history"
        />
      </ListGroup>

      <ListGroup title={COPY.notificationsGroup}>
        <ListItem
          icon="bell"
          title={COPY.notifications}
          subtitle={COPY.notificationsSubtitle}
          onPress={() => navigation.navigate('NotificationPreferences')}
          testID="passenger-settings-notifications"
        />
        <ListItem
          icon="settings"
          title={COPY.phoneNotifications}
          subtitle={COPY.phoneNotificationsSubtitle}
          onPress={() => {
            Linking.openSettings();
          }}
          testID="passenger-settings-phone-notifications"
        />
      </ListGroup>

      <ListGroup title={COPY.appGroup}>
        <AppearanceRow />
      </ListGroup>

      <ListGroup>
        <ListItem
          icon="logout"
          title={isLoggingOut ? COPY.signingOut : COPY.signOut}
          destructive
          onPress={confirmLogout}
          disabled={isLoggingOut}
          testID="passenger-settings-sign-out"
        />
      </ListGroup>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[6],
    gap: space[6],
  },
});

export default PassengerSettingsScreen;
