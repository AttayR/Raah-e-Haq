import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import { perLocale, t } from '../../../i18n';
import { borderWidth, layout, motionPatterns, radius, space } from '../../../theme';
import { AppText, Badge, Banner, Button, Card, Chip, ListItem, RecentRidesCard, vehicleIconName, type RecentRideRow } from '../../ui';
import { DRIVER_HOME_COPY } from '../home/copy';
import { vehicleLabel } from '../../../features/ride-history/copy';
import { DriverTodayStats, type DriverTodayStatsValues } from '../home/DriverTodayStats';
import { LocationNeededCard } from '../../../features/permissions/LocationNeededCard';

export type DriveStatus = 'checking' | 'offline' | 'online' | 'onRide';

const STATUS_TEXT = perLocale((): Record<DriveStatus, string> => ({
  checking: t('drive.checking'),
  offline: t('drive.youAreOffline'),
  online: t('drive.youAreOnline'),
  onRide: t('drive.onRide'),
}));

const HINT_TEXT = perLocale((): Record<DriveStatus, string> => ({
  checking: t('drive.checking'),
  offline: t('drive.offlineHint'),
  online: t('drive.onlineHint'),
  onRide: t('drive.onRideHint'),
}));

/** Status dot (12) beside the `h3` status sentence. */
const DOT = space[3];

/**
 * Drive sheet header (DESIGN_SYSTEM §8.3): status dot + "You're offline"/"You're online" in `h3`,
 * and while online a 2pt `success` shimmer under the row (searching for requests). Reduced
 * motion: a still bar.
 */
export function DriveStatusHeader({ status }: { status: DriveStatus }) {
  const { theme } = useAppTheme();
  const dot =
    status === 'online' ? theme.colors.success : status === 'onRide' ? theme.colors.info : theme.colors.textMuted;
  return (
    <View
      style={styles.header}
      accessibilityRole="summary"
      accessibilityLabel={STATUS_TEXT()[status]}
      testID="drive-status"
    >
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: dot }]} testID={`drive-status-dot-${status}`} />
        <AppText variant="h3" numberOfLines={1} style={styles.flex}>
          {STATUS_TEXT()[status]}
        </AppText>
      </View>
      {status === 'online' ? <SearchingShimmer /> : null}
    </View>
  );
}

function SearchingShimmer() {
  const { theme } = useAppTheme();
  const reduce = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduce) {
      progress.value = 0.5;
      return undefined;
    }
    progress.value = withRepeat(withTiming(1, { duration: motionPatterns.searchingProgressLoopMs }), -1, false);
    return () => cancelAnimation(progress);
  }, [progress, reduce]);
  const style = useAnimatedStyle(() => ({ start: `${progress.value * 130 - 30}%` }));
  return (
    <View
      style={[styles.track, { backgroundColor: theme.colors.successSoft }]}
      accessibilityLabel={t('drive.searchingA11y')}
      testID="drive-searching"
    >
      <Animated.View style={[styles.shimmer, { backgroundColor: theme.colors.success }, style]} />
    </View>
  );
}

type BodyProps = {
  status: DriveStatus;
  /** A change or the first read is in flight. */
  busy: boolean;
  disabled: boolean;
  onToggle: () => void;
  /** The accepted ride (T-405): the action becomes "Resume ride". */
  hasRide: boolean;
  onResume: () => void;
  /** Today's earnings from GET /me/stats, formatted; null until loaded. */
  todayEarnings: string | null;
  today: DriverTodayStatsValues;
  statsError: string | null;
  isApproved: boolean;
  vehicleType: string | undefined;
  /** T-507: the last finished trips (GET /rides?per_page=3); the card hides while empty. */
  recentRides?: RecentRideRow[];
  onSeeAllRides?: () => void;
  onOpenRide?: (id: string) => void;
  /**
   * UI-R8: location access is refused. While offline (and no ride is open) the online control is
   * replaced by the "Location needed to go online" card.
   */
  locationBlocked?: { onOpenSettings: () => void; onRetry: () => void } | null;
  /** T-580: the "Location needed" card's height, so the screen can raise the peek to show all of it. */
  onLocationCardLayout?: (height: number) => void;
};

/** §8.3: the 56pt online action the peek is sized for. */
export const DRIVE_ACTION_HEIGHT = 56;

/** Whether the "Location needed" card replaces the online control (UI-R8). */
export const showsLocationCard = (blocked: boolean, hasRide: boolean, status: DriveStatus): boolean =>
  blocked && !hasRide && status === 'offline';

/**
 * T-580 (QA bug 1): the Drive sheet's snap points. While the "Location needed" card replaces the
 * 56pt action, the peek grows by the card's extra height so its title, Open Settings and Try
 * again are all visible without dragging; the second snap is `full` (always above that peek, also
 * on short phones where `half` could be lower). Otherwise the §8.3 peek 137 → half.
 */
export const driveSheetSnaps = (
  basePeek: number,
  locationCardHeight: number | null,
): { peekHeight: number; snapPoints: readonly ('peek' | 'half' | 'full')[] } =>
  locationCardHeight !== null && locationCardHeight > 0
    ? { peekHeight: basePeek - DRIVE_ACTION_HEIGHT + locationCardHeight, snapPoints: ['peek', 'full'] }
    : { peekHeight: basePeek, snapPoints: ['peek', 'half'] };

/**
 * Drive sheet body (§8.3): the 56pt Go online (primary) / Go offline (outline) action (or
 * "Resume ride" while a ride is open), then at `half`: the status hint, today's earnings pill,
 * the approval warning, today's figures, the recent trips (T-507) and the driver account card.
 * Nothing is shown that the API did not return.
 */
export function DriveSheetBody({
  status,
  busy,
  disabled,
  onToggle,
  hasRide,
  onResume,
  todayEarnings,
  today,
  statsError,
  isApproved,
  vehicleType,
  recentRides = [],
  onSeeAllRides,
  onOpenRide,
  locationBlocked,
  onLocationCardLayout,
}: BodyProps) {
  const online = status === 'online';
  return (
    <View style={styles.body}>
      {locationBlocked && showsLocationCard(true, hasRide, status) ? (
        <View onLayout={e => onLocationCardLayout?.(e.nativeEvent.layout.height)} testID="drive-location-card-wrap">
          <LocationNeededCard onOpenSettings={locationBlocked.onOpenSettings} onRetry={locationBlocked.onRetry} />
        </View>
      ) : hasRide ? (
        <Button
          label={t('drive.resumeRide')}
          size="lg"
          onPress={onResume}
          haptic="impactLight"
          testID="drive-resume-ride"
        />
      ) : (
        <Button
          label={online ? t('drive.goOffline') : t('drive.goOnline')}
          variant={online ? 'outline' : 'primary'}
          size="lg"
          loading={busy}
          disabled={disabled || status === 'checking'}
          onPress={onToggle}
          haptic="impactLight"
          testID="drive-online-toggle"
        />
      )}

      <View style={styles.more}>
        <AppText variant="bodySmall" color="textSecondary" testID="drive-hint">
          {HINT_TEXT()[status]}
        </AppText>
        {todayEarnings ? (
          <View style={styles.pillRow}>
            <Chip
              icon="cash"
              label={t('drive.todayEarnings', { amount: todayEarnings })}
              accessibilityLabel={t('drive.todayEarningsA11y', { amount: todayEarnings })}
              testID="drive-today-earnings"
            />
          </View>
        ) : null}
        {!isApproved ? (
          <Banner
            tone="warning"
            icon="info"
            text={DRIVER_HOME_COPY.pendingApproval}
            testID="driver-home-pending-banner"
          />
        ) : null}
        <DriverTodayStats values={today} error={statsError} />
        {onSeeAllRides ? (
          <RecentRidesCard
            rides={recentRides}
            title={t('ride.recentTrips')}
            onSeeAll={onSeeAllRides}
            onOpen={onOpenRide}
          />
        ) : null}
        <Card padding="none" testID="driver-home-account-card">
          <ListItem
            icon={vehicleIconName(vehicleType)}
            title={DRIVER_HOME_COPY.accountCardTitle}
            subtitle={
              vehicleType
                ? // T-579: the same tier name as Activity, in the active language.
                  vehicleLabel(vehicleType) ?? vehicleType
                : isApproved
                ? DRIVER_HOME_COPY.approvedToDrive
                : DRIVER_HOME_COPY.waitingForApproval
            }
            trailing={
              <Badge
                tone={isApproved ? 'success' : 'warning'}
                label={isApproved ? DRIVER_HOME_COPY.approved : DRIVER_HOME_COPY.pending}
                testID="driver-home-account-status"
              />
            }
          />
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  header: { paddingHorizontal: layout.gutter },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill },
  // Under the status row, inside the 16 gap above the action (§8.3); takes no layout height.
  track: {
    position: 'absolute',
    start: layout.gutter,
    end: layout.gutter,
    bottom: -space[2],
    height: borderWidth.focus,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  shimmer: { position: 'absolute', top: 0, bottom: 0, width: '30%', borderRadius: radius.pill },
  body: { paddingHorizontal: layout.gutter, paddingTop: space[4] },
  more: { paddingTop: space[6], gap: space[4] },
  pillRow: { flexDirection: 'row' },
});
