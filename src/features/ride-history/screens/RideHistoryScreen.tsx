import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Button, Screen, SegmentedControl } from '../../../components/ui';
import { layout, space } from '../../../theme';
import { ScreenHeader } from '../../wallet/components/ScreenHeader';
import { StateView } from '../../wallet/components/StateView';
import { RideHistoryRow } from '../components/RideHistoryRow';
import { RIDE_HISTORY_COPY } from '../copy';
import { useRideHistory, useRideViewer } from '../hooks';
import { openRideDetails, type RideDetailsNavigator } from '../navigation';
import type { Ride, RideHistoryFilter } from '../types';

const FILTERS = [
  { value: 'all', label: RIDE_HISTORY_COPY.filterAll },
  { value: 'completed', label: RIDE_HISTORY_COPY.filterCompleted },
  { value: 'cancelled', label: RIDE_HISTORY_COPY.filterCancelled },
] as const;

/**
 * Ride history for both roles (T-501, BE-01): GET /rides scoped to the signed-in user, newest
 * first, with an All / Completed / Cancelled filter, pull to refresh and infinite scroll.
 * Passengers see the fare, drivers their earnings. Tapping a ride opens RideDetails.
 */
export default function RideHistoryScreen() {
  const { theme } = useAppTheme();
  const navigation = useNavigation<RideDetailsNavigator & { goBack(): void }>();
  const isFocused = useIsFocused();
  const viewer = useRideViewer();
  const [filter, setFilter] = useState<RideHistoryFilter>('all');
  const list = useRideHistory(filter, isFocused);
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

  const onOpen = useCallback(
    (ride: Ride) => openRideDetails(navigation, ride.id, ride),
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: Ride }) => <RideHistoryRow ride={item} viewer={viewer} onPress={onOpen} />,
    [viewer, onOpen],
  );

  const listHeader = (
    <View style={styles.headerBlock}>
      <SegmentedControl<RideHistoryFilter>
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
  );

  const renderEmpty = () => {
    if (list.status === 'loading') return <StateView kind="loading" testID="ride-history-loading" />;
    if (list.status === 'failed') {
      return (
        <StateView
          kind="error"
          message={list.error ?? RIDE_HISTORY_COPY.loadFailed}
          retryLabel={RIDE_HISTORY_COPY.retry}
          onRetry={reload}
          testID="ride-history-error"
        />
      );
    }
    return (
      <StateView
        kind="empty"
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
    <Screen testID="ride-history-screen">
      <ScreenHeader
        title={RIDE_HISTORY_COPY.title}
        backLabel={RIDE_HISTORY_COPY.back}
        onBack={() => navigation.goBack()}
        testID="ride-history"
      />
      <FlatList
        testID="ride-history-list"
        data={list.items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={[styles.content, list.items.length === 0 && styles.contentEmpty]}
        onEndReached={list.hasMore && !list.loadMoreError ? loadMore : undefined}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />
        }
      />
    </Screen>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: layout.contentMaxWidth, alignSelf: 'center', paddingBottom: space[8] },
  contentEmpty: { flexGrow: 1 },
  headerBlock: { paddingHorizontal: space[4], paddingTop: space[2], paddingBottom: space[3], gap: space[3] },
  separator: { height: space[3] },
  footer: { paddingVertical: space[4], alignItems: 'center', gap: space[2] },
});
