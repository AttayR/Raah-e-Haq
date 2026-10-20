import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useIsFocused, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AppText,
  Banner,
  ErrorState,
  Header,
  OfflineBanner,
  Screen,
  ScrollHairline,
  SegmentedControl,
  useHeaderScroll,
  useIsOffline,
} from '../../../components/ui';
import { perLocale, t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { EarningsChart } from '../components/EarningsChart';
import { EarningsHero } from '../components/EarningsHero';
import { EarningsWalletCard } from '../components/EarningsWalletCard';
import { EarningsLinkTiles } from '../components/EarningsLinkTiles';
import { EarningsEmpty, EarningsListFooter, EarningsSkeleton } from '../components/EarningsListParts';
import { EarningsDayHeader, EarningsTripRow } from '../components/EarningsTripRow';
import { StaleOpacityProvider, useStaleOpacity } from '../components/StaleFade';
import { DRIVER_STATEMENTS_ROUTE, DRIVER_STRIKES_ROUTE } from '../../driver-statements/navigation';
import { STATS_COPY } from '../copy';
import { periodCaption } from '../format';
import { useEarningsScreen } from '../useEarningsScreen';
import type { TripListItem } from '../tripItems';
import { RIDE_DETAILS_ROUTE } from '../../ride-history/navigation';
import type { EarningsPeriod } from '../types';
import { TabScrollToTop } from '../../../hooks/TabScrollToTop';
import { ADD_MONEY_ROUTE, topUpParamsFor } from '../../wallet/navigation';

const PERIODS = perLocale(() => [
  { value: 'day', label: STATS_COPY.periodDay },
  { value: 'week', label: STATS_COPY.periodWeek },
  { value: 'month', label: STATS_COPY.periodMonth },
] as const);

const PERIOD_LABEL: Record<EarningsPeriod, () => string> = {
  day: () => STATS_COPY.periodDay,
  week: () => STATS_COPY.periodWeek,
  month: () => STATS_COPY.periodMonth,
};

const keyOf = (item: TripListItem) => item.key;

/**
 * Driver Earnings tab (T-507, BE-08; UI-R4 tab root; UI-R15b layout; UI-R17, docs/design/screens/
 * driver-earnings.md). Under the pinned Today / This week / This month segments, one list: the
 * period hero, the amount owed (GET /wallet now), the daily chart (week and month), the Weekly
 * statements and Strikes tiles, then the period's trips grouped by day, paged on scroll; a trip
 * opens RideDetails (T-501). Pull to refresh reads the period, the wallet and the strikes again.
 * Skeleton, error, empty and stale-period states; server data only.
 */
export default function DriverEarningsScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const isFocused = useIsFocused();
  const offline = useIsOffline();
  const [period, setPeriod] = useState<EarningsPeriod>('day');
  const screen = useEarningsScreen(period, isFocused);
  const { earnings, wallet, strikes, data, stale, items } = screen;
  const staleOpacity = useStaleOpacity(stale);
  const { scrollY, onScroll } = useHeaderScroll();
  // T-577: re-tapping the selected tab scrolls this list to the top.
  const listRef = useRef<FlatList<TripListItem>>(null);
  // §3.6: a new period starts at the top (no animation), and the hairline follows.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
    scrollY.value = 0;
  }, [period, scrollY]);
  const tint = theme.mode === 'dark' ? theme.colors.primaryText : theme.colors.primary;

  const openRide = useCallback((rideId: number) => navigation.navigate(RIDE_DETAILS_ROUTE, { rideId }), [navigation]);
  const openWallet = useCallback(() => navigation.navigate('Wallet'), [navigation]);
  const payOwed = useCallback(
    (amountOwed: number) => navigation.navigate(ADD_MONEY_ROUTE, topUpParamsFor(amountOwed)),
    [navigation],
  );
  const openStatements = useCallback(() => navigation.navigate(DRIVER_STATEMENTS_ROUTE), [navigation]);
  const openStrikes = useCallback(() => navigation.navigate(DRIVER_STRIKES_ROUTE), [navigation]);
  const goToDrive = useCallback(() => navigation.navigate('Drive'), [navigation]);

  const renderItem = useCallback(
    ({ item }: { item: TripListItem }) =>
      item.kind === 'day' ? (
        <EarningsDayHeader label={item.label} totals={item.totals} a11y={item.a11y} first={item.first} date={item.date} />
      ) : (
        <EarningsTripRow ride={item.ride} text={item.text} first={item.first} last={item.last} onOpen={openRide} />
      ),
    [openRide],
  );

  // Title in the bar and the period segments pinned under it, in every state (no jump on load).
  const header = (
    <>
      <Header variant="large" inlineTitle title={t('earnings.title')} tone="background" testID="earnings" />
      <View style={styles.controls}>
        <SegmentedControl<EarningsPeriod>
          options={PERIODS()}
          value={period}
          onChange={setPeriod}
          accessibilityLabel={STATS_COPY.periodLabel}
          testID="earnings-period"
        />
      </View>
    </>
  );

  const bannerKind = offline ? 'offline' : screen.periodFailed ? 'period' : screen.refreshFailed ? 'refresh' : null;
  const { reload } = earnings;
  const { onRefresh } = screen;
  const banner = useMemo(() => {
    if (bannerKind === 'offline') return <OfflineBanner />;
    if (!bannerKind) return null;
    // §3.4 / §3.6: a failed refresh keeps the last numbers; a failed switch keeps the old period dimmed.
    const text = bannerKind === 'period' ? t('earnings.periodFailed', { period: PERIOD_LABEL[period]() }) : t('earnings.refreshFailed');
    return (
      <Banner
        tone="warning"
        text={text}
        action={{ label: t('earnings.retry'), onPress: bannerKind === 'period' ? reload : onRefresh, testID: 'earnings-refresh-retry' }}
        testID="earnings-refresh-error"
      />
    );
  }, [bannerKind, period, reload, onRefresh]);
  const walletView = useMemo(
    () => ({ data: wallet.data, status: wallet.status, reload: wallet.reload }),
    [wallet.data, wallet.status, wallet.reload],
  );

  // Memoised so a pull or a chart selection does not rebuild the hero, owed card and tiles.
  const listHeader = useMemo(
    () =>
      data ? (
        <View style={styles.headerBlock}>
          <EarningsHero
            totals={data.totals}
            currency={data.currency}
            period={data.period}
            from={data.from}
            to={data.to}
            stale={stale}
          />
          <EarningsWalletCard wallet={walletView} onOpenWallet={openWallet} onPay={payOwed} />
          {banner ? <View style={styles.gap16}>{banner}</View> : null}
          {data.period !== 'day' && data.series.length > 0 && data.totals.trips > 0 ? (
            <View style={styles.gap16}>
              <EarningsChart
                series={data.series}
                period={data.period}
                currency={data.currency}
                today={screen.today}
                caption={periodCaption(data.period, data.from, data.to)}
                stale={stale}
              />
            </View>
          ) : null}
          <View style={styles.gap16}>
            <EarningsLinkTiles strikes={strikes.data} onOpenStatements={openStatements} onOpenStrikes={openStrikes} />
          </View>
          <AppText variant="overline" color="textMuted" accessibilityRole="header" style={styles.sectionTitle}>
            {t('earnings.tripsHeader')}
          </AppText>
        </View>
      ) : null,
    [data, stale, walletView, openWallet, payOwed, banner, screen.today, strikes.data, openStatements, openStrikes],
  );

  if (!data) {
    return (
      <Screen testID="earnings-screen">
        {header}
        {earnings.status === 'failed' ? (
          <ErrorState
            title={STATS_COPY.loadFailed}
            body={earnings.error ?? undefined}
            retryLabel={STATS_COPY.retry}
            onRetry={earnings.reload}
            testID="earnings-error"
          />
        ) : (
          <EarningsSkeleton period={period} />
        )}
      </Screen>
    );
  }

  return (
    <Screen testID="earnings-screen">
      {header}
      <ScrollHairline scrollY={scrollY} testID="earnings-hairline" />
      <TabScrollToTop scrollRef={listRef} />
      <StaleOpacityProvider value={staleOpacity} stale={stale}>
        <Animated.FlatList
          ref={listRef}
          testID="earnings-rides"
          style={styles.list}
          onScroll={onScroll}
          scrollEventThrottle={16}
          data={items}
          keyExtractor={keyOf}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={<EarningsEmpty period={data.period} mismatch={data.totals.trips > 0} onGoToDrive={goToDrive} />}
          ListFooterComponent={
            <EarningsListFooter
              period={data.period}
              loadingMore={earnings.loadingMore}
              loadMoreError={earnings.loadMoreError}
              ended={screen.ended}
              onRetry={earnings.loadMore}
            />
          }
          contentContainerStyle={styles.content}
          onEndReached={!stale && earnings.hasMore && !earnings.loadMoreError ? earnings.loadMore : undefined}
          onEndReachedThreshold={0.5}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl
              refreshing={screen.pulling}
              onRefresh={screen.onRefresh}
              tintColor={tint}
              colors={[tint]}
              progressBackgroundColor={theme.colors.surface}
            />
          }
        />
      </StaleOpacityProvider>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[8] },
  // Pinned under the bar: 0 top / 12 bottom (§5.2 revised UI-R15).
  controls: { paddingHorizontal: layout.gutter, paddingBottom: space[3] },
  // §1: hero, 12, owed card; 16 between the later blocks; 24 above "Trips", 8 under it.
  headerBlock: { paddingHorizontal: layout.gutter, paddingBottom: space[2], gap: space[3] },
  gap16: { marginTop: space[1] },
  sectionTitle: { marginTop: space[3] },
});
