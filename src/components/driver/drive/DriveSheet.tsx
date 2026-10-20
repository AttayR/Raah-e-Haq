import React from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { t } from '../../../i18n';
import { componentTokens, layout, space } from '../../../theme';
import { Badge, Banner, Button, Card, ListItem, RecentRidesCard, vehicleIconName, type RecentRideRow } from '../../ui';
import { DRIVER_HOME_COPY } from '../home/copy';
import { vehicleLabel } from '../../../features/ride-history/copy';
import { LocationNeededCard } from '../../../features/permissions/LocationNeededCard';
import type { DriveStatus } from './driveNotice';

export { DriveStatusHeader } from './DriveStatusHeader';
export type { DriveStatus } from './driveNotice';

type BodyProps = {
  status: DriveStatus;
  /** A change or the first read is in flight. */
  busy: boolean;
  disabled: boolean;
  onToggle: () => void;
  /** The accepted ride (T-405): the action becomes "Resume ride". */
  hasRide: boolean;
  onResume: () => void;
  /** UI-R11 D4: the Today card (DriverTodayCard) at `half`. */
  today?: React.ReactNode;
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
  /** T-580: the "Location needed" card's height. */
  onLocationCardLayout?: (height: number) => void;
  /** T-587: the auto-accept row (§7.1), between the status block and the online action. */
  autoAcceptRow?: React.ReactNode;
  /**
   * UI-R11 D1: the measured height of the peek group (12 + auto-accept row + 12 + action, or the
   * location card), so the peek is measured, never hard-coded.
   */
  onPeekGroupHeight?: (height: number) => void;
  /** D6 cold-open entrance styles for the auto-accept row and the action. */
  rowStyle?: StyleProp<ViewStyle>;
  actionStyle?: StyleProp<ViewStyle>;
};

/** Whether the "Location needed" card replaces the online control (UI-R8). */
export const showsLocationCard = (blocked: boolean, hasRide: boolean, status: DriveStatus): boolean =>
  blocked && !hasRide && status === 'offline';

/**
 * T-580 (QA bug 1) + UI-R11 D1: the Drive sheet's snap points. `peek` is the measured peek; the
 * peek group holds the "Location needed" card in place of the action when it shows, so the whole
 * card is visible without dragging. While the card shows, the second snap is `full` (always above
 * that peek, also on short phones where `half` could be lower); otherwise `half`.
 */
export const driveSheetSnaps = (
  peek: number,
  locationCardShown: boolean,
): { peekHeight: number; snapPoints: readonly ('peek' | 'half' | 'full')[] } =>
  locationCardShown
    ? { peekHeight: peek, snapPoints: ['peek', 'full'] }
    : { peekHeight: peek, snapPoints: ['peek', 'half'] };

/** D1: handle area 24 + measured status block + measured peek group + 16. */
export const drivePeekHeight = (headerHeight: number, groupHeight: number): number =>
  componentTokens.sheet.contentTop + headerHeight + groupHeight + space[4];

/**
 * Drive sheet body (§8.3, UI-R11 D1/D4): the peek group (auto-accept row, then the 56pt Go
 * online / Go offline action, "Resume ride" while a ride is open, or the "Location needed" card),
 * then at `half`: the approval warning, the Today card, the recent trips (T-507) and the driver
 * account card. The hint and every notice live in the status block's subtitle. Nothing is shown
 * that the API did not return.
 */
export function DriveSheetBody({
  status,
  busy,
  disabled,
  onToggle,
  hasRide,
  onResume,
  today,
  isApproved,
  vehicleType,
  recentRides = [],
  onSeeAllRides,
  onOpenRide,
  locationBlocked,
  onLocationCardLayout,
  autoAcceptRow,
  onPeekGroupHeight,
  rowStyle,
  actionStyle,
}: BodyProps) {
  const online = status === 'online';
  const onGroupLayout = (e: LayoutChangeEvent) => onPeekGroupHeight?.(Math.round(e.nativeEvent.layout.height));
  return (
    <View style={styles.body}>
      <View style={styles.group} onLayout={onGroupLayout} testID="drive-peek-group">
        {autoAcceptRow ? <Animated.View style={[styles.rowSlot, rowStyle]}>{autoAcceptRow}</Animated.View> : null}
        <Animated.View style={actionStyle}>
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
              accessibilityLabel={online ? t('drive.goOfflineA11y') : t('drive.goOnlineA11y')}
              testID="drive-online-toggle"
            />
          )}
        </Animated.View>
      </View>

      <View style={styles.more}>
        {!isApproved ? (
          <Banner
            tone="warning"
            icon="info"
            text={DRIVER_HOME_COPY.pendingApproval}
            testID="driver-home-pending-banner"
          />
        ) : null}
        {today}
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
  body: { paddingHorizontal: layout.gutter },
  // D1: status block → 12 → auto-accept row → 12 → action (the group's height is measured).
  group: { paddingTop: space[3] },
  rowSlot: { marginBottom: space[3] },
  // D4: 24 below the action, 16 between blocks.
  more: { paddingTop: space[6], gap: space[4] },
});
