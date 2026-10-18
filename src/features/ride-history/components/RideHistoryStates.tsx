import React from 'react';
import { StyleSheet } from 'react-native';
import { EmptyState, ErrorState, SkeletonCard, SkeletonGroup } from '../../../components/ui';
import { componentTokens, layout, space } from '../../../theme';
import { RIDE_HISTORY_COPY } from '../copy';
import type { RideHistoryFilter, RideViewer } from '../types';

const SKELETON_ROWS = 3;
const noop = () => undefined;

export type RideHistoryStateProps = {
  kind: 'loading' | 'error' | 'empty';
  viewer: RideViewer;
  filter: RideHistoryFilter;
  /** The load error shown under the error title. */
  error?: string | null;
  onRetry?: () => void;
  /** Passenger, unfiltered empty list: "Book a ride" (opens Where to?). */
  onBook?: () => void;
};

/**
 * The ride list's non-content states (shared-ride-history §States, UI-R15): 3 skeleton cards the
 * height of a real row, the error with Try again, and the empty state (passenger: "Book a ride";
 * driver: no action; a filter: "No {completed/cancelled} rides"). One component, used by the
 * list and by the Debug gallery previews, so the evidence is the shipped layout.
 */
export function RideHistoryState({ kind, viewer, filter, error, onRetry, onBook }: RideHistoryStateProps) {
  if (kind === 'loading') {
    return (
      <SkeletonGroup testID="ride-history-loading" style={styles.skeleton}>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <SkeletonCard key={i} height={componentTokens.skeleton.heights.rideHistoryRow} />
        ))}
      </SkeletonGroup>
    );
  }
  if (kind === 'error') {
    return (
      <ErrorState
        title={RIDE_HISTORY_COPY.loadFailed}
        body={error ?? undefined}
        placement="center"
        retryLabel={RIDE_HISTORY_COPY.retry}
        onRetry={onRetry ?? noop}
        testID="ride-history-error"
      />
    );
  }
  const unfiltered = filter === 'all';
  return (
    <EmptyState
      placement="center"
      icon="rides"
      title={unfiltered ? RIDE_HISTORY_COPY.emptyTitle[viewer] : RIDE_HISTORY_COPY.emptyFilteredTitle[filter]}
      body={unfiltered ? RIDE_HISTORY_COPY.emptyBody[viewer] : undefined}
      action={
        unfiltered && viewer === 'passenger' && onBook
          ? {
              label: RIDE_HISTORY_COPY.emptyAction,
              accessibilityHint: RIDE_HISTORY_COPY.emptyActionHint,
              onPress: onBook,
              testID: 'ride-history-empty-book',
            }
          : undefined
      }
      testID="ride-history-empty"
    />
  );
}

const styles = StyleSheet.create({
  skeleton: { paddingHorizontal: layout.gutter, paddingTop: space[3], gap: space[2] },
});
