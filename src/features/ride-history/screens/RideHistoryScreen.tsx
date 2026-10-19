import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useIsFocused, useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import {
  AppText,
  Button,
  FilterChips,
  Header,
  Screen,
  ScrollHairline,
  useHeaderScroll,
} from '../../../components/ui';
import { layout, space } from '../../../theme';
import { RideHistoryRow } from '../components/RideHistoryRow';
import { RideHistoryState } from '../components/RideHistoryStates';
import { RIDE_HISTORY_COPY } from '../copy';
import { groupRidesByDay, type RideSection } from '../format';
import { useRideHistory, useRideViewer } from '../hooks';
import { useOpenRide } from '../../active-ride/useOpenRide';
import type { Ride, RideHistoryFilter } from '../types';
import { perLocale } from '../../../i18n';
import { TabScrollToTop } from '../../../hooks/TabScrollToTop';

const FILTERS = perLocale(() => [
  { value: 'all', label: RIDE_HISTORY_COPY.filterAll },
  { value: 'completed', label: RIDE_HISTORY_COPY.filterCompleted },
  { value: 'cancelled', label: RIDE_HISTORY_COPY.filterCancelled },
] as const);

const AnimatedSectionList = Animated.createAnimatedComponent(SectionList<Ride, RideSection>);

export type RideHistoryListProps = {
  /** True while the list is on screen (loads then, and again on each return). */
  visible: boolean;
  /** Scrolls above the first day (Activity's summary strip); the filter chips stay pinned. */
  summary?: React.ReactElement | null;
  /** Called on pull to refresh, so the host can re-read what it shows above the list. */
  onRefresh?: () => void;
};

/**
 * Ride history for both roles (T-501, BE-01; UI-R15 layout): GET /rides scoped to the signed-in
 * user, newest first, grouped by day under sticky "Today / Yesterday / Mon, 28 Sep" headers. The
 * All / Completed / Cancelled chips stay pinned above the list with a hairline once it scrolls;
 * pull to refresh and infinite scroll. Passengers see the fare, drivers their earnings. Tapping a
 * ride opens RideDetails (a passenger's ride in progress opens the live ride instead, T-543).
 * The list is the passenger's Activity › Rides; the driver opens it from Account.
 */
export function RideHistoryList({ visible, summary, onRefresh: onHostRefresh }: RideHistoryListProps) {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const viewer = useRideViewer();
  const [filter, setFilter] = useState<RideHistoryFilter>('all');
  const list = useRideHistory(filter, visible);
  const { refresh, reload, loadMore } = list;
  const sections = useMemo(() => groupRidesByDay(list.items), [list.items]);
  const { scrollY, onScroll } = useHeaderScroll();
  // T-577: re-tapping the selected tab scrolls this list to the top.
  const listRef = useRef<SectionList<Ride, RideSection>>(null);

  useEffect(() => {
    scrollY.value = 0;
  }, [filter, scrollY]);

  // The spinner shows for a pull only.
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && list.status !== 'refreshing') setPulling(false);
  }, [pulling, list.status]);
  const onRefresh = useCallback(() => {
    setPulling(true);
    refresh();
    onHostRefresh?.();
  }, [refresh, onHostRefresh]);

  // A passenger's ride still in progress opens the live ride, a finished one its details (T-543).
  const openRide = useOpenRide(viewer);
  const onOpen = useCallback(
    (ride: Ride) => {
      openRide(ride.id, ride).catch(() => undefined);
    },
    [openRide],
  );

  const renderItem = useCallback(
    ({ item }: { item: Ride }) => <RideHistoryRow ride={item} viewer={viewer} onPress={onOpen} />,
    [viewer, onOpen],
  );

  const background = theme.colors.background;
  const renderSectionHeader = useCallback(
    ({ section }: { section: RideSection }) =>
      section.title ? (
        <View style={[styles.dayHeader, { backgroundColor: background }]} testID={`ride-history-day-${section.key}`}>
          <AppText variant="caption" color="textMuted" accessibilityRole="header">
            {section.title}
          </AppText>
        </View>
      ) : null,
    [background],
  );

  const listHeader =
    summary || (list.error && list.items.length > 0) ? (
      <View style={styles.listHeader}>
        {summary}
        {list.error && list.items.length > 0 ? (
          <AppText variant="bodySmall" color="danger" testID="ride-history-refresh-error">
            {list.error}
          </AppText>
        ) : null}
      </View>
    ) : null;

  const renderEmpty = () => (
    <RideHistoryState
      kind={list.status === 'loading' ? 'loading' : list.status === 'failed' ? 'error' : 'empty'}
      viewer={viewer}
      filter={filter}
      error={list.error}
      onRetry={reload}
      onBook={() => navigation.navigate('Booking')}
    />
  );

  const renderFooter = () => {
    if (list.status === 'loadingMore') {
      return (
        <View style={styles.footer} testID="ride-history-loading-more">
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      );
    }
    if (list.loadMoreError) {
      return (
        <View style={styles.footer} testID="ride-history-load-more-error">
          <AppText variant="bodySmall" color="textSecondary" align="center">
            {list.loadMoreError}
          </AppText>
          <Button label={RIDE_HISTORY_COPY.retry} variant="ghost" size="sm" fullWidth={false} onPress={loadMore} />
        </View>
      );
    }
    if (list.items.length > 0 && !list.hasMore && list.status === 'ready') {
      return (
        <View style={styles.footer} testID="ride-history-end">
          <AppText variant="caption" color="textMuted" align="center">
            {RIDE_HISTORY_COPY.endOfList}
          </AppText>
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.fill}>
      <View style={styles.pinned}>
        <FilterChips<RideHistoryFilter>
          options={FILTERS()}
          value={filter}
          onChange={setFilter}
          accessibilityLabel={RIDE_HISTORY_COPY.filterLabel}
          testID="ride-history-filter"
        />
      </View>
      <ScrollHairline scrollY={scrollY} testID="ride-history-hairline" />
      <TabScrollToTop scrollRef={listRef} />
      <AnimatedSectionList
        ref={listRef}
        testID="ride-history-list"
        style={styles.fill}
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[styles.content, sections.length === 0 && styles.contentEmpty]}
        onScroll={onScroll}
        scrollEventThrottle={16}
        initialNumToRender={8}
        windowSize={7}
        onEndReached={list.hasMore && !list.loadMoreError ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
        }
      />
    </View>
  );
}

/** The driver's Account → Ride history route: a standard Header with back over the list. */
export default function RideHistoryScreen() {
  const navigation = useNavigation<{ goBack(): void }>();
  const isFocused = useIsFocused();
  return (
    <Screen testID="ride-history-screen">
      <Header
        tone="background"
        title={RIDE_HISTORY_COPY.title}
        backLabel={RIDE_HISTORY_COPY.back}
        onBack={() => navigation.goBack()}
        testID="ride-history"
      />
      <RideHistoryList visible={isFocused} />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pinned: { paddingHorizontal: layout.gutter, paddingTop: space[1], paddingBottom: space[3] },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[8] },
  contentEmpty: { flexGrow: 1 },
  listHeader: { paddingHorizontal: layout.gutter, paddingTop: space[3], gap: space[3] },
  dayHeader: { minHeight: space[8], justifyContent: 'center', paddingHorizontal: layout.gutter, paddingTop: space[2] },
  separator: { height: space[2] },
  footer: { paddingVertical: space[4], alignItems: 'center', gap: space[2] },
});
