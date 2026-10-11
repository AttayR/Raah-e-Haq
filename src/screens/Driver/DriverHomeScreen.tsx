import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootState } from '../../store';
import { useDriverStatusToggle, useLoadDriverStatusOnMount } from '../../features/driver-status/hooks';
import { selectDriverActiveRide } from '../../features/driver-ride/slice';
import type { DriverStackParamList } from '../../app/navigation/stacks/DriverStack';
import { AppText, Badge, Card, Icon, ListItem, Screen, type IconName } from '../../components/ui';
import { DriverHomeHeader } from '../../components/driver/home/DriverHomeHeader';
import { DriverResumeRideCard } from '../../components/driver/home/DriverResumeRideCard';
import { DriverStatusCard, type DriverStatusView } from '../../components/driver/home/DriverStatusCard';
import { DriverTodayStats, type DriverTodayStatsValues } from '../../components/driver/home/DriverTodayStats';
import { DRIVER_HOME_COPY } from '../../components/driver/home/copy';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { radius, space } from '../../theme';

const vehicleIcon = (type: string | undefined): IconName => {
  switch (type) {
    case 'bike':
      return 'bike';
    case 'van':
    case 'truck':
      return 'van';
    default:
      return 'car';
  }
};

const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * No figures until GET /me/stats (BE-08) is wired by T-507: the tiles show honest dashes. The
 * old screen showed invented numbers ("156 rides", "PKR 24k").
 */
const TODAY_STATS: DriverTodayStatsValues = { rides: null, onlineTime: null, rating: null };

export default function DriverHomeScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  // Online/offline is the server's answer (GET/PUT /driver/status, T-401), shared with Map.
  useLoadDriverStatusOnMount();
  const { isOnline, isOnRide, isBusy, isChecking, disabled, toggle } = useDriverStatusToggle();
  const { user } = useSelector((state: RootState) => state.apiAuth);
  // The accepted ride (T-404/T-405); its steps live on the DriverRide screen (T-413).
  const currentRide = useSelector(selectDriverActiveRide);

  const isDriverApproved = user?.status === 'active';
  const status: DriverStatusView = isChecking ? 'checking' : isOnRide ? 'onRide' : isOnline ? 'online' : 'offline';
  const openProfile = () => navigation.navigate('DriverProfile');

  return (
    <Screen scroll contentStyle={styles.content} testID="driver-home">
      <DriverHomeHeader
        name={user?.name}
        photoUri={user?.profile_image_url}
        isOnline={isOnline}
        onOpenProfile={openProfile}
      />

      {!isDriverApproved && (
        <View
          style={[styles.banner, { backgroundColor: theme.colors.warningSoft }]}
          accessibilityRole="alert"
          testID="driver-home-pending-banner"
        >
          <Icon name="info" size={20} color="warning" />
          <AppText variant="bodySmall" color="warning" style={styles.bannerText}>
            {DRIVER_HOME_COPY.pendingApproval}
          </AppText>
        </View>
      )}

      {currentRide && (
        <DriverResumeRideCard ride={currentRide} onResume={() => navigation.navigate('DriverRide')} />
      )}

      <DriverStatusCard
        status={status}
        isBusy={isBusy}
        disabled={disabled}
        // The server decides (403 not approved / no vehicle, 409 on a ride) and its message is shown.
        onToggle={() => {
          toggle();
        }}
      />

      <Card padding="none" testID="driver-home-account-card">
        <ListItem
          icon={vehicleIcon(user?.vehicle_type)}
          title={DRIVER_HOME_COPY.accountCardTitle}
          subtitle={
            user?.vehicle_type
              ? titleCase(user.vehicle_type)
              : isDriverApproved
              ? DRIVER_HOME_COPY.approvedToDrive
              : DRIVER_HOME_COPY.waitingForApproval
          }
          trailing={
            <Badge
              tone={isDriverApproved ? 'success' : 'warning'}
              label={isDriverApproved ? DRIVER_HOME_COPY.approved : DRIVER_HOME_COPY.pending}
              testID="driver-home-account-status"
            />
          }
        />
      </Card>

      <DriverTodayStats values={TODAY_STATS} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space[4],
    paddingTop: space[2],
    paddingBottom: space[6],
    gap: space[6],
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    padding: space[3],
    paddingHorizontal: space[4],
    borderRadius: radius.md,
  },
  bannerText: { flex: 1, minWidth: 0 },
});
