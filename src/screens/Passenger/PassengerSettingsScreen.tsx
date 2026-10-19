import React, { useCallback, useState, useRef } from 'react';
import { Linking, RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PassengerStackParamList } from '../../app/navigation/stacks/PassengerStack';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { RootState, useAppDispatch } from '../../store';
import { getUserProfile } from '../../store/thunks/apiThunks';
import { useLogout } from '../../hooks/useLogout';
import { useTabScrollReset } from '../../hooks/useTabScrollReset';
import { Header, ListGroup, ListItem, Screen, useHeaderScroll } from '../../components/ui';
import { t } from '../../i18n';
import { AppearanceRow } from '../../components/driver/settings/AppearanceRow';
import { LanguageRow } from '../../components/driver/settings/LanguageRow';
import { ProfileSummaryCard } from '../../components/passenger/settings/ProfileSummaryCard';
import { PASSENGER_SETTINGS_COPY as COPY } from '../../components/passenger/settings/copy';
import { AccountChecks } from '../../features/profile-edit';
import { layout, space } from '../../theme';

/**
 * Passenger Account tab (T-618 passenger side, shared-settings spec; UI-R4; UI-R15b: `large` Header
 * with the title in the bar, a hairline once the list scrolls, DESIGN_SYSTEM §5.2/§8.1). Every row leads somewhere: the profile card opens the
 * Profile view, Saved places its screen, Notifications the push preferences (BE-11, T-502) with
 * the phone's own settings as a second row, Appearance is the T-601 override and Sign out is the
 * shared confirm flow (T-102). Ride history and Wallet live in Activity and the inbox is its own
 * tab, so none of them is repeated here. Help & support and Invite friends come with T-619.
 */
const PassengerSettingsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<PassengerStackParamList>>();
  const dispatch = useAppDispatch();
  const { theme } = useAppTheme();
  const { user } = useSelector((state: RootState) => state.apiAuth);
  const { confirmLogout, isLoggingOut } = useLogout();
  const [refreshing, setRefreshing] = useState(false);
  const { scrollY, onScroll } = useHeaderScroll();
  const scrollRef = useRef<Animated.ScrollView>(null);
  useTabScrollReset(scrollRef);
  const title = t('nav.account');

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
    <Screen testID="passenger-settings">
      <Header variant="large" inlineTitle title={title} scrollY={scrollY} tone="background" testID="passenger-settings-header" />
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        testID="passenger-settings-scroll"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
      >
        <View style={styles.body}>
          <ProfileSummaryCard user={user} onPress={() => navigation.navigate('Profile')} />
          <AccountChecks user={user} phoneOnly onOpenPhone={() => navigation.navigate('ChangePhone')} testID="passenger-settings-checks" />

          <ListGroup title={COPY.accountGroup}>
            <ListItem
              icon="bookmark"
              title={COPY.savedPlaces}
              subtitle={COPY.savedPlacesSubtitle}
              onPress={() => navigation.navigate('FavoriteLocations')}
              testID="passenger-settings-saved-places"
            />
            <ListItem
              icon="contacts"
              title={t('safety.contactsRow')}
              subtitle={t('safety.contactsRowSubtitle')}
              onPress={() => navigation.navigate('EmergencyContacts')}
              testID="passenger-settings-emergency-contacts"
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
            <LanguageRow />
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
        </View>
      </Animated.ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[6] },
  body: { paddingHorizontal: layout.gutter, paddingTop: space[2], gap: space[6] },
});

export default PassengerSettingsScreen;
