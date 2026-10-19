import React, { useRef } from 'react';
import { I18nManager, Linking, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DriverStackParamList } from '../../app/navigation/stacks/DriverStack';
import { RootState } from '../../store';
import { useLogout } from '../../hooks/useLogout';
import { useTabScrollReset } from '../../hooks/useTabScrollReset';
import { AppText, Avatar, Badge, Card, Header, Icon, ListGroup, ListItem, Screen, useHeaderScroll } from '../../components/ui';
import { t } from '../../i18n';
import { AppearanceRow } from '../../components/driver/settings/AppearanceRow';
import { LanguageRow } from '../../components/driver/settings/LanguageRow';
import { DRIVER_SETTINGS_COPY } from '../../components/driver/settings/copy';
import { AccountChecks } from '../../features/profile-edit';
import { DriverWomenModeRow } from '../../features/women-mode/components/DriverWomenModeRow';
import { showParcelOptInRow, useParcelOptInSummary } from '../../features/parcel/hooks';
import { layout, space } from '../../theme';

/**
 * Driver Account tab (T-618 driver side, shared-settings spec; UI-R4; UI-R15b: `large` Header
 * with the title in the bar, a hairline once the list scrolls, DESIGN_SYSTEM §5.2/§8.1). Every row leads somewhere: the profile card opens
 * Profile and Edit profile the edit form (T-545, like the passenger Profile → Edit),
 * Vehicle & documents the documents list (T-203), Ride history its screen (T-501), Notifications
 * the push preferences (BE-11, T-502) with the phone's own settings as a second row, Sign out is
 * the shared confirm flow (T-102). Earnings is a tab and the wallet opens from it (UI-R4).
 * Help & support and Privacy come back with T-511.
 */
const DriverSettingsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  const { user } = useSelector((state: RootState) => state.apiAuth);
  const { confirmLogout, isLoggingOut } = useLogout();
  const isActive = user?.status === 'active';
  const statusLabel = isActive ? DRIVER_SETTINGS_COPY.statusApproved : DRIVER_SETTINGS_COPY.statusPending;
  const name = user?.name?.trim() || DRIVER_SETTINGS_COPY.driverFallbackName;
  const contact = user?.email || user?.phone || null;
  const { scrollY, onScroll } = useHeaderScroll();
  const scrollRef = useRef<Animated.ScrollView>(null);
  useTabScrollReset(scrollRef);
  const title = t('nav.account');
  const isFocused = useIsFocused();
  // T-561: only a driver whose profile type is not a bike needs the server's word on other vehicles.
  const parcelOptIn = useParcelOptInSummary(isFocused && !showParcelOptInRow(null, user?.vehicle_type));

  return (
    <Screen testID="driver-settings">
      <Header variant="large" inlineTitle title={title} scrollY={scrollY} tone="background" testID="driver-settings-header" />
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        testID="driver-settings-scroll"
      >
        <View style={styles.body}>
          <Card
            onPress={() => navigation.navigate('Profile')}
            accessibilityLabel={[name, contact, statusLabel].filter(Boolean).join(', ')}
            accessibilityHint={DRIVER_SETTINGS_COPY.openProfileHint}
            testID="driver-settings-profile"
          >
            <View style={styles.profileRow}>
              <Avatar name={name} uri={user?.profile_image_url} size={56} />
              <View style={styles.profileText}>
                <AppText variant="h3" numberOfLines={2}>
                  {name}
                </AppText>
                {contact ? (
                  <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} ellipsizeMode="middle">
                    {contact}
                  </AppText>
                ) : null}
                <View style={styles.badgeRow}>
                  <Badge
                    tone={isActive ? 'success' : 'warning'}
                    label={statusLabel}
                    testID="driver-settings-status"
                  />
                </View>
              </View>
              <View style={I18nManager.isRTL ? styles.flip : null}>
                <Icon name="chevronEnd" size={20} color="textMuted" />
              </View>
            </View>
          </Card>
          <AccountChecks user={user} phoneOnly onOpenPhone={() => navigation.navigate('ChangePhone')} testID="driver-settings-checks" />

          <ListGroup title={DRIVER_SETTINGS_COPY.accountGroup}>
            <ListItem
              icon="account"
              title={DRIVER_SETTINGS_COPY.editProfile}
              subtitle={DRIVER_SETTINGS_COPY.editProfileSubtitle}
              onPress={() => navigation.navigate('ProfileEdit')}
              testID="driver-settings-edit-profile"
            />
            <ListItem
              icon="document"
              title={DRIVER_SETTINGS_COPY.documents}
              subtitle={DRIVER_SETTINGS_COPY.documentsSubtitle}
              onPress={() => navigation.navigate('DriverDocuments')}
              testID="driver-settings-documents"
            />
            {/* BE-86: AC is declared on a car (no row for a bike or rickshaw). */}
            {!user?.vehicle_type || user.vehicle_type === 'car' ? (
              <ListItem
                icon="ac"
                title={t('ac.rowTitle')}
                subtitle={t('ac.rowSubtitle')}
                onPress={() => navigation.navigate('VehicleAc')}
                testID="driver-settings-vehicle-ac"
              />
            ) : null}
            <DriverWomenModeRow raw={user?.women_mode} />
            {/* BE-88: parcels go by bike. T-561: any approved bike counts, not only the first vehicle. */}
            {showParcelOptInRow(parcelOptIn, user?.vehicle_type) ? (
              <ListItem
                icon="parcel"
                title={t('parcel.optInRowTitle')}
                subtitle={t('parcel.optInRowSubtitle')}
                onPress={() => navigation.navigate('ParcelOptIn')}
                testID="driver-settings-parcels"
              />
            ) : null}
            <ListItem
              icon="history"
              title={DRIVER_SETTINGS_COPY.rideHistory}
              subtitle={DRIVER_SETTINGS_COPY.rideHistorySubtitle}
              onPress={() => navigation.navigate('RideHistory')}
              testID="driver-settings-ride-history"
            />
            <ListItem
              icon="contacts"
              title={t('safety.contactsRow')}
              subtitle={t('safety.contactsRowSubtitle')}
              onPress={() => navigation.navigate('EmergencyContacts')}
              testID="driver-settings-emergency-contacts"
            />
            <ListItem
              icon="bell"
              title={DRIVER_SETTINGS_COPY.notifications}
              subtitle={DRIVER_SETTINGS_COPY.notificationsSubtitle}
              onPress={() => navigation.navigate('NotificationPreferences')}
              testID="driver-settings-notifications"
            />
            <ListItem
              icon="settings"
              title={DRIVER_SETTINGS_COPY.phoneNotifications}
              subtitle={DRIVER_SETTINGS_COPY.phoneNotificationsSubtitle}
              onPress={() => {
                Linking.openSettings();
              }}
              testID="driver-settings-phone-notifications"
            />
          </ListGroup>

          <ListGroup title={DRIVER_SETTINGS_COPY.appGroup}>
            <AppearanceRow />
            <LanguageRow />
          </ListGroup>

          <ListGroup>
            <ListItem
              icon="logout"
              title={isLoggingOut ? DRIVER_SETTINGS_COPY.signingOut : DRIVER_SETTINGS_COPY.signOut}
              destructive
              onPress={confirmLogout}
              disabled={isLoggingOut}
              testID="driver-settings-sign-out"
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
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  profileText: { flex: 1, minWidth: 0, gap: space[1] },
  badgeRow: { flexDirection: 'row', marginTop: space[1] },
  flip: { transform: [{ scaleX: -1 }] },
});

export default DriverSettingsScreen;
