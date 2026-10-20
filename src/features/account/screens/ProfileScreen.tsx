import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { useAppDispatch, type RootState } from '../../../store';
import { getUserProfile } from '../../../store/thunks/apiThunks';
import { Header, OfflineBanner, Screen, useHeaderScroll } from '../../../components/ui';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { useMyStats } from '../../stats/hooks';
import { useMyVehicles } from '../../driver-profile/hooks';
import { AccountChecks } from '../../profile-edit';
import { AccountActions } from '../components/AccountActions';
import { DriverVehicleRow } from '../components/DriverVehicleRow';
import { ProfileIdentity } from '../components/ProfileIdentity';
import { ProfileInfoList } from '../components/ProfileInfoList';
import { ProfileStats, type ProfileStatValues } from '../components/ProfileStats';
import type { AccountRole, ProfileNavigator } from '../navigation';

type Props = {
  role: AccountRole;
};

/**
 * Profile view, one screen for both roles (UI-R16, shared-profile.md): standard Header with
 * "Edit", identity, account checks, the Rating / Trips / Distance strip from GET /me/stats (never
 * earnings and never `user.total_rides`), personal info, a driver's one Vehicle row, and the
 * account-actions group (Delete account, UI-R18). Identity and info render from the stored user;
 * the profile is re-read on focus (an admin's photo decision shows up), pull to refresh re-reads
 * the profile and the stats.
 */
export function ProfileScreen({ role }: Props) {
  const prefix = `${role}-profile`;
  const navigation = useNavigation<ProfileNavigator>();
  const dispatch = useAppDispatch();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const user = useSelector((state: RootState) => state.apiAuth.user);
  const stats = useMyStats(isFocused);
  const isDriver = role === 'driver';
  const vehicles = useMyVehicles(isFocused && isDriver);
  const { scrollY, onScroll } = useHeaderScroll();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isFocused) dispatch(getUserProfile()).catch(() => undefined);
  }, [dispatch, isFocused]);

  const statValues = useMemo<ProfileStatValues | null>(
    () =>
      stats.data ? { rating: stats.data.rating, trips: stats.data.totalRides, distanceKm: stats.data.totalDistanceKm } : null,
    [stats.data],
  );

  const { refresh: refreshStats } = stats;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [profile] = await Promise.all([dispatch(getUserProfile()), refreshStats()]);
      if (getUserProfile.rejected.match(profile)) toast.error(t('profile.refreshFailed'));
    } finally {
      setRefreshing(false);
    }
  }, [dispatch, refreshStats]);

  const openEdit = useCallback(() => navigation.navigate('ProfileEdit'), [navigation]);
  // UI-R18 §D (BE-129): Account → Profile → Delete account, both roles (store rule: 3 taps).
  const openDeleteAccount = useCallback(() => navigation.navigate('DeleteAccount'), [navigation]);
  const bottom = { paddingBottom: Math.max(insets.bottom, space[4]) + space[6] };

  return (
    <Screen testID={prefix}>
      <Header
        title={t('profile.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('profile.back')}
        trailingText={{ label: t('profile.edit'), accessibilityLabel: t('profile.editA11y'), onPress: openEdit, testID: `${prefix}-edit` }}
        scrollY={scrollY}
        tone="background"
        testID={`${prefix}-header`}
      />
      <OfflineBanner style={styles.offline} testID={`${prefix}-offline`} />
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, bottom]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        testID={`${prefix}-scroll`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
      >
        <ProfileIdentity user={user} role={role} />
        <AccountChecks user={user} onOpenPhone={() => navigation.navigate('ChangePhone')} testID={`${prefix}-checks`} />
        <ProfileStats values={statValues} failed={stats.status === 'failed'} testID={`${prefix}-stats`} />
        <ProfileInfoList user={user} onAddDetails={openEdit} testIDPrefix={prefix} />
        {isDriver ? (
          <DriverVehicleRow
            vehicles={vehicles.data}
            vehicleType={user?.vehicle_type}
            licenceExpiry={user?.license_expiry_date}
            onPress={() => navigation.navigate('DriverDocuments')}
          />
        ) : null}
        <AccountActions onDeleteAccount={openDeleteAccount} testID={`${prefix}-actions`} />
      </Animated.ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  offline: { marginHorizontal: layout.gutter, marginBottom: space[2] },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
    gap: layout.sectionGap,
  },
});
