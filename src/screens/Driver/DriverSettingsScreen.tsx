import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DriverStackParamList } from '../../app/navigation/stacks/DriverStack';
import { RootState } from '../../store';
import { useLogout } from '../../hooks/useLogout';
import { AppText, Avatar, Badge, Card, ListGroup, ListItem, Screen } from '../../components/ui';
import { AppearanceRow } from '../../components/driver/settings/AppearanceRow';
import { DRIVER_SETTINGS_COPY } from '../../components/driver/settings/copy';
import { space } from '../../theme';

/**
 * Driver Settings tab (T-618 driver side, shared-settings spec). Every row leads somewhere:
 * Edit profile opens DriverProfile, Notifications opens the push preferences (BE-11, T-502)
 * with the phone's own settings as a second row, Sign out is the shared confirm flow (T-102).
 * Help & support and Privacy come back with T-511.
 */
const DriverSettingsScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  const { user } = useSelector((state: RootState) => state.apiAuth);
  const { confirmLogout, isLoggingOut } = useLogout();
  const isActive = user?.status === 'active';
  const name = user?.name?.trim() || DRIVER_SETTINGS_COPY.driverFallbackName;
  const contact = user?.email || user?.phone || null;

  return (
    <Screen scroll contentStyle={styles.content} testID="driver-settings">
      <AppText variant="h1" accessibilityRole="header">
        {DRIVER_SETTINGS_COPY.title}
      </AppText>

      <Card testID="driver-settings-profile">
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
                label={isActive ? DRIVER_SETTINGS_COPY.statusApproved : DRIVER_SETTINGS_COPY.statusPending}
                testID="driver-settings-status"
              />
            </View>
          </View>
        </View>
      </Card>

      <ListGroup title={DRIVER_SETTINGS_COPY.accountGroup}>
        <ListItem
          icon="account"
          title={DRIVER_SETTINGS_COPY.editProfile}
          subtitle={DRIVER_SETTINGS_COPY.editProfileSubtitle}
          onPress={() => navigation.navigate('DriverProfile')}
          testID="driver-settings-edit-profile"
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
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  profileText: { flex: 1, minWidth: 0, gap: space[1] },
  badgeRow: { flexDirection: 'row', marginTop: space[1] },
});

export default DriverSettingsScreen;
