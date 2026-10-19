import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, ErrorState, Skeleton, SkeletonGroup, SkeletonListItem } from '../../../components/ui';
import { RecentRidesCard } from '../../../components/ui/ride/RecentRidesCard';
import { t } from '../../../i18n';
import { space } from '../../../theme';
import type { HomeRecentRide } from '../types';

/** What the Home sheet knows about GET /rides (T-507): first load, failed with nothing shown, or rows. */
export type HomeRidesState = 'loading' | 'failed' | 'ready';

type Props = {
  state: HomeRidesState;
  rides: HomeRecentRide[];
  onOpenRide: (id: string) => void;
  onSeeAll: () => void;
  onRetry: () => void;
  /**
   * New account (UI-R9 review): no finished rides and no recent places, so one quiet line says
   * what will show here. Only when the read succeeded (`ready`).
   */
  emptyHint?: boolean;
};

/** The two skeleton rows the card holds while the first read runs (passenger-home "Loading"). */
const SKELETON_ROWS = [0, 1] as const;

/**
 * Home sheet "Recent rides" (passenger-home block 8, UI-R9 states): skeleton (overline + card with
 * 2 rows) on the first read, the kit compact ErrorState with "Try again" when it failed and
 * nothing is cached (fully visible at `half` on an SE), the new-account line, else the shared
 * RecentRidesCard.
 * A failed refresh keeps the rows that are on screen (`ready`).
 */
function HomeRidesSectionBase({ state, rides, onOpenRide, onSeeAll, onRetry, emptyHint = false }: Props) {
  if (state === 'loading') {
    return (
      <SkeletonGroup style={[styles.skeleton, styles.card]} accessibilityLabel={t('home.ridesLoadingA11y')} testID="home-recent-rides-loading">
        <Skeleton width="40%" textVariant="overline" />
        <Card padding="none">
          {SKELETON_ROWS.map(row => (
            <SkeletonListItem key={row} leading="none" />
          ))}
        </Card>
      </SkeletonGroup>
    );
  }
  if (state === 'failed') {
    return (
      <ErrorState
        size="compact"
        kind="network"
        title={t('home.ridesFailedTitle')}
        onRetry={onRetry}
        testID="home-recent-rides-error"
      />
    );
  }
  if (rides.length === 0) {
    return emptyHint ? (
      <AppText variant="bodySmall" color="textSecondary" numberOfLines={2} testID="home-empty-hint">
        {t('home.emptyHint')}
      </AppText>
    ) : null;
  }
  return (
    <View style={styles.card}>
      <RecentRidesCard rides={rides} onSeeAll={onSeeAll} onOpen={onOpenRide} />
    </View>
  );
}

export const HomeRidesSection = memo(HomeRidesSectionBase);

const styles = StyleSheet.create({
  skeleton: { gap: space[2] },
  // The card section sits 24 under the chip row; states (error, empty line) sit 16 under it.
  card: { marginTop: space[2] },
});
