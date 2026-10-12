import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootState } from '../../store';
import { useDriverStatusToggle, useLoadDriverStatusOnMount } from '../../features/driver-status/hooks';
import { selectDriverActiveRide } from '../../features/driver-ride/slice';
import type { DriverStackParamList } from '../../app/navigation/stacks/DriverStack';
import { AppText, Badge, Card, Icon, ListItem, Screen, type IconName } from '../../components/ui';
import { DriverHomeHeader } from '../../components/driver/home/DriverHomeHeader';
import { DriverResumeRideCard } from '../../components/driver/home/DriverResumeRideCard';
import { DriverStatusCard, type DriverStatusView } from '../../components/driver/home/DriverStatusCard';
import { DriverTodayStats } from '../../components/driver/home/DriverTodayStats';
import { DRIVER_HOME_COPY } from '../../components/driver/home/copy';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { radius, space } from '../../theme';
import { formatMoney } from '../../core/format/money';
import { useMyStats } from '../../features/stats/hooks';
import { toDriverTodayValues } from '../../features/stats/format';
import { STATS_COPY } from '../../features/stats/copy';

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

export default function DriverHomeScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<DriverStackParamList>>();
  // Online/offline is the server's answer (GET/PUT /driver/status, T-401), shared with Map.
  useLoadDriverStatusOnMount();
  const { isOnline, isOnRide, isBusy, isChecking, disabled, toggle } = useDriverStatusToggle();
  const { user } = useSelector((state: RootState) => state.apiAuth);
  // The accepted ride (T-404/T-405); its steps live on the DriverRide screen (T-413).
  const currentRide = useSelector(selectDriverActiveRide);

  // Today's tiles and the week's earnings from GET /me/stats (BE-08, T-507), read on focus.
  const isFocused = useIsFocused();
  const stats = useMyStats(isFocused, DRIVER_HOME_COPY.statsUnavailable);
  const driverStats = stats.data?.role === 'driver' ? stats.data : null;
  const { refresh: refreshStats } = stats;
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && stats.status !== 'refreshing') setPulling(false);
  }, [pulling, stats.status]);
  const onRefresh = useCallback(() => {
    setPulling(true);
    refreshStats();
  }, [refreshStats]);

  const isDriverApproved = user?.status === 'active';
  const status: DriverStatusView = isChecking ? 'checking' : isOnRide ? 'onRide' : isOnline ? 'online' : 'offline';
  const openProfile = () => navigation.navigate('DriverProfile');

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      testID="driver-home"
      refreshControl={
        <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
      }
    >
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

      <DriverTodayStats
        values={toDriverTodayValues(driverStats)}
        error={!driverStats && stats.status === 'failed' ? stats.error : null}
      />

      <Card padding="none" testID="driver-home-money-card">
        <ListItem
          icon="chart"
          title={STATS_COPY.earningsRow}
          subtitle={
            driverStats
              ? STATS_COPY.earningsRowSubtitle(
                  formatMoney(driverStats.earningsWeek, { currency: driverStats.currency }),
                  driverStats.tripsWeek,
                )
              : STATS_COPY.earningsRowFallback
          }
          onPress={() => navigation.navigate('DriverEarnings')}
          testID="driver-home-earnings"
        />
        <ListItem
          icon="wallet"
          title={STATS_COPY.walletRow}
          subtitle={
            driverStats && driverStats.commissionOwed > 0
              ? STATS_COPY.walletRowOwed(formatMoney(driverStats.commissionOwed, { currency: driverStats.currency }))
              : STATS_COPY.walletRowSubtitle
          }
          onPress={() => navigation.navigate('Wallet')}
          testID="driver-home-wallet"
        />
      </Card>
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
