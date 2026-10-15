import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, EmptyState, ErrorState, FilterChips, Header, Screen, SkeletonList } from '../../../components/ui';
import { layout, space } from '../../../theme';
import { RideHistoryRow } from '../components/RideHistoryRow';
import { RIDE_HISTORY_COPY } from '../copy';
import { useRideHistory, useRideViewer } from '../hooks';
import { useOpenRide } from '../../active-ride/useOpenRide';
import type { Ride, RideHistoryFilter } from '../types';

const FILTERS = [
  { value: 'all', label: RIDE_HISTORY_COPY.filterAll },
  { value: 'completed', label: RIDE_HISTORY_COPY.filterCompleted },
  { value: 'cancelled', label: RIDE_HISTORY_COPY.filterCancelled },
] as const;

export type RideHistoryListProps = {
  /** True while the list is on screen (loads then, and again on each return). */
  visible: boolean;
  /** Rendered above the filter (Activity's large title, segments and stats); scrolls with the list. */
  header?: React.ReactElement;
  /** `useHeaderScroll().onScroll`, so a large title collapses into the bar. */
  onScroll?: React.ComponentProps<typeof Animated.FlatList>['onScroll'];
};

/**
 * Ride history for both roles (T-501, BE-01): GET /rides scoped to the signed-in user, newest
 * first, with an All / Completed / Cancelled filter, pull to refresh and infinite scroll.
 * Passengers see the fare, drivers their earnings. Tapping a ride opens RideDetails (a
 * passenger's ride in progress opens the live ride instead, T-543). The list
 * is also the passenger's Activity › Rides (UI-R4); the driver opens it from Account.
 */
export function RideHistoryList({ visible, header, onScroll }: RideHistoryListProps) {
  const { theme } = useAppTheme();
  const viewer = useRideViewer();
  const [filter, setFilter] = useState<RideHistoryFilter>('all');
  const list = useRideHistory(filter, visible);
  const { refresh, reload, loadMore } = list;

  // The spinner shows for a pull only.
  const [pulling, setPulling] = useState(false);
  useEffect(() => {
    if (pulling && list.status !== 'refreshing') setPulling(false);
  }, [pulling, list.status]);
  const onRefresh = useCallback(() => {
    setPulling(true);
    refresh();
  }, [refresh]);

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

  const listHeader = (
    <View>
      {header}
      <View style={styles.headerBlock}>
        <FilterChips<RideHistoryFilter>
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          accessibilityLabel={RIDE_HISTORY_COPY.filterLabel}
          testID="ride-history-filter"
        />
        {list.error && list.items.length > 0 ? (
          <AppText variant="bodySmall" color="danger" testID="ride-history-refresh-error">
            {list.error}
          </AppText>
        ) : null}
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (list.status === 'loading') return <SkeletonList rows={5} testID="ride-history-loading" />;
    if (list.status === 'failed') {
      return (
        <ErrorState
          title={RIDE_HISTORY_COPY.loadFailed}
          body={list.error ?? undefined}
          placement="center"
          retryLabel={RIDE_HISTORY_COPY.retry}
          onRetry={reload}
          testID="ride-history-error"
        />
      );
    }
    return (
      <EmptyState
        placement="center"
        icon="rides"
        title={filter === 'all' ? RIDE_HISTORY_COPY.emptyTitle[viewer] : RIDE_HISTORY_COPY.emptyFilteredTitle[filter]}
        body={filter === 'all' ? RIDE_HISTORY_COPY.emptyBody[viewer] : undefined}
        testID="ride-history-empty"
      />
    );
  };

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
    <Animated.FlatList
      testID="ride-history-list"
      style={styles.list}
      data={list.items}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderItem}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      contentContainerStyle={[styles.content, list.items.length === 0 && styles.contentEmpty]}
      onScroll={onScroll}
      scrollEventThrottle={16}
      onEndReached={list.hasMore && !list.loadMoreError ? loadMore : undefined}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
      }
    />
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
  list: { flex: 1 },
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[8] },
  contentEmpty: { flexGrow: 1 },
  headerBlock: { paddingHorizontal: space[4], paddingTop: space[3], paddingBottom: space[3], gap: space[3] },
  separator: { height: space[3] },
  footer: { paddingVertical: space[4], alignItems: 'center', gap: space[2] },
});
