import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Banner, Icon } from '../../../components/ui';
import { t } from '../../../i18n';
import { radius, space } from '../../../theme';
import { formatMoney } from '../../../utils/format';
import { useNow } from '../hooks';
import { farePolicyLines, formatClock, secondsSince, waitingDetail } from '../format';
import type { FareLock, FareNotice, FarePolicy } from '../types';

/** The fuel adjustment in force (BE-60 `fare_notice`), as an info Banner; nothing without one. */
export function FareNoticeBanner({ notice, testID = 'fare-notice' }: { notice: FareNotice | null; testID?: string }) {
  if (!notice) return null;
  return <Banner tone="info" title={t('fare.noticeTitle')} text={notice.note} testID={testID} />;
}

/** The ride's waiting and cancel terms, only while fees are on (BE-85); nothing otherwise. */
export function FarePolicyNote({ policy, testID = 'fare-policy' }: { policy: FarePolicy | null; testID?: string }) {
  const lines = farePolicyLines(policy);
  if (lines.length === 0) return null;
  return (
    <View style={styles.policy} testID={testID}>
      {lines.map((line) => (
        <View key={line} style={styles.policyLine}>
          <Icon name="info" size={16} color="textMuted" />
          <AppText variant="caption" color="textSecondary" style={styles.flex}>
            {line}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** "Fare locked: Rs 152" once a driver accepted (BE-82), so the passenger knows what to pay. */
export function FareLockBadge({ lock, testID = 'fare-locked' }: { lock: FareLock | null; testID?: string }) {
  const { theme } = useAppTheme();
  if (!lock) return null;
  const amount = formatMoney(lock.acceptedFare);
  return (
    <View
      style={[styles.lock, { backgroundColor: theme.colors.successSoft }]}
      accessible
      accessibilityLabel={t('fare.fareLockedA11y', { amount })}
      testID={testID}
    >
      <Icon name="fareLock" size={20} color="success" />
      <AppText variant="label" color="success" numberOfLines={1}>
        {t('fare.fareLocked', { amount })}
      </AppText>
    </View>
  );
}

type WaitingTimerProps = {
  /** `arrived_at` of the ride. */
  arrivedAt: string | null | undefined;
  policy: FarePolicy | null;
  /** BE-85 `arrival_verified`: waiting is billed only after a verified arrival. */
  arrivalVerified: boolean;
  testID?: string;
};

/**
 * Time at the pickup since the driver arrived, with the free minutes left and then the rate
 * (BE-85). Shown only while fees are on and the arrival is verified, so a timer never suggests
 * a charge the server will not make. It ticks once a second in this component only.
 */
export function WaitingTimer({ arrivedAt, policy, arrivalVerified, testID = 'waiting-timer' }: WaitingTimerProps) {
  const { theme } = useAppTheme();
  const shown = !!policy && policy.feesEnabled && arrivalVerified && !!arrivedAt;
  const now = useNow(shown);
  const elapsed = shown ? secondsSince(arrivedAt, now) : null;
  if (!shown || !policy || elapsed === null) return null;
  return (
    <View style={[styles.waiting, { backgroundColor: theme.colors.surfaceAlt }]} testID={testID} accessibilityLiveRegion="none">
      <Icon name="waiting" size={20} color="textSecondary" />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" testID={`${testID}-clock`}>
          {t('fare.waiting', { time: formatClock(elapsed) })}
        </AppText>
        <AppText variant="caption" color="textSecondary" testID={`${testID}-detail`}>
          {waitingDetail(policy, elapsed)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  policy: { gap: space[1] },
  policyLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  lock: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space[1],
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.pill,
  },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3], borderRadius: radius.md },
});
