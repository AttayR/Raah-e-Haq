import React from 'react';
import { StyleSheet, View } from 'react-native';
import { FilterChips, Header, Screen, ScrollHairline, SegmentedControl } from '../../../components/ui';
import { t } from '../../../i18n';
import { layout, space } from '../../../theme';
import { ActivitySummary } from '../../activity/components/ActivitySummary';
import { RideHistoryState } from '../../ride-history/components/RideHistoryStates';
import { RideHistoryRow } from '../../ride-history/components/RideHistoryRow';
import { toRide } from '../../ride-history/api';
import type { Ride, RideHistoryFilter } from '../../ride-history/types';
import { RIDE_HISTORY_COPY } from '../../ride-history/copy';

/**
 * Debug gallery (UI-R15): passenger Activity › Rides in its non-content states, built from the
 * screen's own pieces (inline-title Header, pinned segments and chips, the summary strip and
 * `RideHistoryState`), for design screenshots of states live data cannot produce on demand.
 * Shown with `-RHKitGallerySection screen-history-loading|empty|error`.
 */
const noop = () => undefined;

const SEGMENTS = [
  { value: 'rides', label: t('activity.rides') },
  { value: 'wallet', label: t('activity.wallet') },
] as const;

const FILTERS = [
  { value: 'all', label: RIDE_HISTORY_COPY.filterAll },
  { value: 'completed', label: RIDE_HISTORY_COPY.filterCompleted },
  { value: 'cancelled', label: RIDE_HISTORY_COPY.filterCancelled },
] as const;

export function ActivityHistoryPreview({ state }: { state: 'loading' | 'empty' | 'error' }) {
  return (
    <Screen testID={`preview-history-${state}`}>
      <Header variant="large" inlineTitle title={t('activity.title')} tone="background" />
      <View style={styles.segments}>
        <SegmentedControl options={SEGMENTS} value="rides" onChange={noop} accessibilityLabel={t('activity.segmentLabel')} />
      </View>
      <View style={styles.chips}>
        <FilterChips<RideHistoryFilter> options={FILTERS} value="all" onChange={noop} accessibilityLabel={RIDE_HISTORY_COPY.filterLabel} />
      </View>
      <ScrollHairline />
      {state === 'loading' ? (
        <View style={styles.summary}>
          <ActivitySummary items={[]} loading />
        </View>
      ) : null}
      <View style={styles.fill}>
        <RideHistoryState
          kind={state}
          viewer="passenger"
          filter="all"
          error={state === 'error' ? t('kitGallery.errorNetworkBody') : null}
          onRetry={noop}
          onBook={noop}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  segments: { paddingHorizontal: layout.gutter, paddingBottom: space[3] },
  chips: { paddingHorizontal: layout.gutter, paddingTop: space[1], paddingBottom: space[3] },
  summary: { paddingHorizontal: layout.gutter, paddingTop: space[3] },
  rows: { gap: space[2], paddingTop: space[2] },
});

/** API-shaped fake rides (local gallery only) through the real mapper, one per row state. */
const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60000).toISOString();
const galleryRide = (raw: Record<string, unknown>): Ride | null =>
  toRide({
    pickup_address: 'Block N Gulberg III, Lahore',
    dropoff_address: 'Liberty Market, Gulberg III, Lahore',
    vehicle_type: 'car',
    total_fare: '450.00',
    stops: [],
    ...raw,
  });
const GALLERY_ROWS: Ride[] = [
  galleryRide({ id: 1, status: 'requested', requested_at: at(1) }),
  galleryRide({ id: 2, status: 'accepted', vehicle_type: 'rickshaw', requested_at: at(6) }),
  galleryRide({ id: 3, status: 'cancelled', cancelled_at: at(40), cancellation_fee: '30.00' }),
  galleryRide({ id: 4, status: 'completed', vehicle_type: 'car_ac', completed_at: at(90) }),
].filter((ride): ride is Ride => ride !== null);

/** UI-R15: one row per state (in progress = pill only, charged fee, completed) for SE screenshots. */
export function ActivityRowsPreview() {
  return (
    <Screen testID="preview-history-rows">
      <Header variant="large" inlineTitle title={t('activity.title')} tone="background" />
      <View style={styles.rows}>
        {GALLERY_ROWS.map((ride) => (
          <RideHistoryRow key={ride.id} ride={ride} viewer="passenger" onPress={noop} />
        ))}
      </View>
    </Screen>
  );
}
