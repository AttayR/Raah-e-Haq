import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useIsFocused, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AppText,
  Button,
  EmptyState,
  ErrorState,
  Header,
  Icon,
  Screen,
  ScrollHairline,
  SegmentedControl,
  SkeletonList,
  useHeaderScroll,
} from '../../../components/ui';
import { perLocale, t } from '../../../i18n';
import { formatMoney } from '../../../core/format/money';
import { componentTokens, layout, space } from '../../../theme';
import { EarningsChart } from '../components/EarningsChart';
import { EarningsHero } from '../components/EarningsHero';
import { EarningsWalletCard } from '../components/EarningsWalletCard';
import { EarningsLinksCard } from '../components/EarningsLinksCard';
import { DRIVER_STATEMENTS_ROUTE, DRIVER_STRIKES_ROUTE } from '../../driver-statements/navigation';
import { STATS_COPY } from '../copy';
import { earningsRideText } from '../format';
import { useDriverEarnings } from '../hooks';
import { RIDE_DETAILS_ROUTE } from '../../ride-history/navigation';
import type { EarningsPeriod, EarningsRide } from '../types';

const PERIODS = perLocale(() => [
  { value: 'day', label: STATS_COPY.periodDay },
  { value: 'week', label: STATS_COPY.periodWeek },
  { value: 'month', label: STATS_COPY.periodMonth },
] as const);

/**
 * Driver Earnings tab (T-507, BE-08; UI-R4 made it a tab root, DESIGN_SYSTEM §8.1; UI-R15b
 * layout, §5.2 revised UI-R15): `large` Header with the title in the bar, the Today / This week /
 * This month segments pinned under it with a hairline once the list scrolls. GET /driver/earnings
 * for the chosen period with the period total, trips, fares and commission, the
 * commission/settlements entry (GET /wallet -> Wallet screen), a per-day bar chart (week and month) and the period's completed rides, paged
 * on scroll; a ride opens RideDetails (T-501). Pull to refresh; loading, error and empty states.
 */
export default function DriverEarningsScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const isFocused = useIsFocused();
  const [period, setPeriod] = useState<EarningsPeriod>('day');
  const earnings = useDriverEarnings(period, isFocused);
  const { data, status, error, rides, refresh, reload } = earnings;
  const { scrollY, onScroll } = useHeaderScroll();
  // A new period may remount the list at the top: the hairline follows it.
  useEffect(() => {
    scrollY.value = 0;
  }, [period, scrollY]);
  const title = t('earnings.title');

  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && status !== 'refreshing') setPulling(false);
  }, [pulling, status]);
  const onRefresh = useCallback(() => {
    setPulling(true);
    refresh();
  }, [refresh]);

  const renderItem = useCallback(
    ({ item }: { item: EarningsRide }) => {
      const money = (n: number) => formatMoney(n, { currency: data?.currency });
      const text = earningsRideText(item, money);
      return (
        <Pressable
          onPress={() => navigation.navigate(RIDE_DETAILS_ROUTE, { rideId: item.id })}
          accessibilityRole="button"
          accessibilityLabel={`${text.title}, ${text.subtitle}, ${money(item.driverEarnings)}`}
          accessibilityHint={STATS_COPY.openRideHint}
          style={({ pressed }) => [styles.ride, pressed ? { backgroundColor: theme.colors.surfacePressed } : null]}
          testID={`earnings-ride-${item.id}`}
        >
          <View style={styles.rideText}>
            <AppText variant="bodyStrong" numberOfLines={1} testID={`earnings-ride-${item.id}-title`}>
              {text.title}
            </AppText>
            <AppText variant="caption" color="textMuted" numberOfLines={2}>
              {text.subtitle}
            </AppText>
          </View>
          <AppText variant="numeric" style={styles.rideAmount}>
            {money(item.driverEarnings)}
          </AppText>
          <Icon name="chevronEnd" size={20} color="textMuted" />
        </Pressable>
      );
    },
    [data?.currency, navigation, theme.colors.surfacePressed],
  );

  const separator = useCallback(
    () => <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />,
    [theme.colors.border],
  );

  const periodControl = (
    <SegmentedControl<EarningsPeriod>
      options={PERIODS()}
      value={period}
      onChange={setPeriod}
      accessibilityLabel={STATS_COPY.periodLabel}
      testID="earnings-period"
    />
  );

  // Title in the bar and the period segments pinned under it, in every state (no jump on load).
  const header = (
    <>
      <Header variant="large" inlineTitle title={title} tone="background" testID="earnings" />
      <View style={styles.controls}>{periodControl}</View>
    </>
  );
  const walletCard = <EarningsWalletCard visible={isFocused} onOpen={() => navigation.navigate('Wallet')} />;

  if (!data) {
    return (
      <Screen testID="earnings-screen">
        {header}
        {status === 'failed' ? (
          <ErrorState
            title={STATS_COPY.loadFailed}
            body={error ?? undefined}
            retryLabel={STATS_COPY.retry}
            onRetry={reload}
            testID="earnings-error"
          />
        ) : (
          <SkeletonList heroHeight={componentTokens.skeleton.heights.earningsHero} rows={5} testID="earnings-loading" />
        )}
      </Screen>
    );
  }

  const listHeader = (
    <View>
      <View style={styles.headerBlock}>
        <EarningsHero earnings={data} />
        {walletCard}
        <EarningsLinksCard
          onOpenStatements={() => navigation.navigate(DRIVER_STATEMENTS_ROUTE)}
          onOpenStrikes={() => navigation.navigate(DRIVER_STRIKES_ROUTE)}
        />
        {error ? (
          <AppText variant="bodySmall" color="danger" testID="earnings-refresh-error">
            {error}
          </AppText>
        ) : null}
        {data.period !== 'day' ? (
          <EarningsChart series={data.series} period={data.period} currency={data.currency} />
        ) : null}
        <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.sectionTitle}>
          {STATS_COPY.ridesTitle}
        </AppText>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (earnings.loadingMore) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      );
    }
    if (earnings.loadMoreError) {
      return (
        <View style={styles.footer}>
          <AppText variant="bodySmall" color="textSecondary" align="center">
            {earnings.loadMoreError}
          </AppText>
          <Button label={STATS_COPY.retry} variant="ghost" size="sm" fullWidth={false} onPress={earnings.loadMore} />
        </View>
      );
    }
    return null;
  };

  return (
    <Screen testID="earnings-screen">
      {header}
      <ScrollHairline scrollY={scrollY} testID="earnings-hairline" />
      <Animated.FlatList
        testID="earnings-rides"
        style={styles.list}
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={rides}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={separator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <EmptyState icon="rides" title={STATS_COPY.emptyTitle[data.period]} body={STATS_COPY.emptyBody} testID="earnings-empty" />
        }
        ListFooterComponent={renderFooter}
        contentContainerStyle={[styles.content, rides.length === 0 && styles.contentEmpty]}
        onEndReached={earnings.hasMore && !earnings.loadMoreError ? earnings.loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[8] },
  contentEmpty: { flexGrow: 1 },
  // Pinned under the bar: 0 top / 12 bottom (§5.2 revised UI-R15).
  controls: { paddingHorizontal: layout.gutter, paddingBottom: space[3] },
  headerBlock: { paddingHorizontal: layout.gutter, paddingBottom: space[2], gap: space[4] },
  sectionTitle: { marginTop: space[2] },
  ride: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3], minHeight: 64 },
  rideText: { flex: 1, minWidth: 0 },
  rideAmount: { flexShrink: 0 },
  separator: { height: StyleSheet.hairlineWidth, marginStart: space[4] },
  footer: { paddingVertical: space[4], alignItems: 'center', gap: space[2] },
});
