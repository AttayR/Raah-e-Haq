import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { t, type TranslationKey } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';
import { AppText } from '../AppText';
import { Badge, type BadgeTone } from '../Badge';

const g = componentTokens.ride.progress;

/**
 * Ride `status` as the API sends it. `started` is the app's name for the server's `ongoing`;
 * both are accepted so callers pass the raw value.
 */
export type RideStatusValue =
  | 'requested'
  | 'pending'
  | 'accepted'
  | 'arrived'
  | 'ongoing'
  | 'started'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/** How far a step label may shrink to stay on one line (iOS; Android scales by steps). */
const LABEL_MIN_SCALE = 0.8;

const STEP_LABELS: TranslationKey[] = ['ride.stepRequested', 'ride.stepOnTheWay', 'ride.stepArrived', 'ride.stepOnTrip'];

/** 0 Requested · 1 On the way · 2 Arrived · 3 On trip; null for ended or unknown statuses. */
export const rideProgressStep = (status: string | null | undefined): number | null => {
  switch (status) {
    case 'requested':
    case 'pending':
      return 0;
    case 'accepted':
      return 1;
    case 'arrived':
      return 2;
    case 'ongoing':
    case 'started':
    case 'in_progress':
      return 3;
    default:
      return null;
  }
};

/**
 * Ride progress (DESIGN_SYSTEM §5.24, §12.5): four segments (Requested → On the way → Arrived →
 * On trip) on a 4pt `surfaceAlt` track, filled `primary` up to the current step; current label
 * `label` `textPrimary`, others `caption` `textMuted`. The same component on both roles.
 */
export function RideProgress({ step, showLabels = true, testID }: { step: number; showLabels?: boolean; testID?: string }) {
  const { theme } = useAppTheme();
  const current = Math.min(STEP_LABELS.length - 1, Math.max(0, step));
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('ride.progressA11y', { step: t(STEP_LABELS[current]), n: current + 1 })}
      accessibilityValue={{ min: 1, max: STEP_LABELS.length, now: current + 1 }}
      style={styles.wrap}
    >
      <View style={styles.track}>
        {STEP_LABELS.map((key, i) => (
          <View
            key={key}
            testID={testID ? `${testID}-segment-${i}` : undefined}
            style={[styles.segment, { backgroundColor: i <= current ? theme.colors.primary : theme.colors.surfaceAlt }]}
          />
        ))}
      </View>
      {showLabels ? (
        <View style={styles.labels}>
          {STEP_LABELS.map((key, i) => (
            <AppText
              key={key}
              variant={i === current ? 'label' : 'caption'}
              color={i === current ? 'textPrimary' : 'textMuted'}
              // T-577: one line in every language (Roman Urdu "Pohanch gaya" wrapped); a long label
              // shrinks a little rather than break the row.
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={LABEL_MIN_SCALE}
              align={i === 0 ? 'start' : i === STEP_LABELS.length - 1 ? 'end' : 'center'}
              style={styles.label}
              testID={testID ? `${testID}-label-${i}` : undefined}
            >
              {t(key)}
            </AppText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const PILL: Record<string, { tone: BadgeTone; key: TranslationKey }> = {
  requested: { tone: 'info', key: 'ride.statusRequested' },
  pending: { tone: 'info', key: 'ride.statusRequested' },
  accepted: { tone: 'info', key: 'ride.statusAccepted' },
  arrived: { tone: 'warning', key: 'ride.statusArrived' },
  ongoing: { tone: 'info', key: 'ride.statusOngoing' },
  started: { tone: 'info', key: 'ride.statusOngoing' },
  in_progress: { tone: 'info', key: 'ride.statusOngoing' },
  completed: { tone: 'success', key: 'ride.statusCompleted' },
  cancelled: { tone: 'neutral', key: 'ride.statusCancelled' },
};

/** "in_progress" → "In progress". */
const titleCase = (value: string): string => {
  const words = value.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : '';
};

/** Tone and label for a ride status (§5.24); unknown statuses are neutral with the raw label. */
export const rideStatusPill = (status: string): { tone: BadgeTone; label: string } => {
  const known = PILL[status];
  return known ? { tone: known.tone, label: t(known.key) } : { tone: 'neutral', label: titleCase(status) };
};

/**
 * Status pill for a ride (§5.24): Finding driver / Driver on the way (info), Driver arrived
 * (warning), On trip (info), Completed (success), Cancelled (neutral: cancelling is not an error).
 */
export function RideStatusPill({ status, label, testID }: { status: string; label?: string; testID?: string }) {
  const pill = rideStatusPill(status);
  return <Badge tone={pill.tone} label={label ?? pill.label} testID={testID} />;
}

export type TimelineEntry = { key: string; label: string; time: string; testID?: string };

/**
 * Vertical ride timeline for Ride details (§5.24): one row per step that has a time, a 10pt dot
 * (`primary`; the last one `success` or neutral when cancelled) joined by a 2pt `border` line.
 */
export function RideTimeline({ entries, cancelled = false, testID }: { entries: ReadonlyArray<TimelineEntry>; cancelled?: boolean; testID?: string }) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  return (
    <View testID={testID}>
      {entries.map((entry, i) => {
        const last = i === entries.length - 1;
        const dot = last ? (cancelled ? c.textMuted : c.success) : c.primary;
        return (
          <View key={entry.key} style={styles.entry} testID={entry.testID} accessible accessibilityLabel={`${entry.label}, ${entry.time}`}>
            <View style={styles.entryRail}>
              <View style={[styles.entryDot, { backgroundColor: dot }]} />
              {last ? null : <View style={[styles.entryLine, { backgroundColor: c.border }]} />}
            </View>
            <View style={[styles.entryText, last ? null : styles.entryGap]}>
              <AppText variant="bodySmall" color="textPrimary" style={styles.flex}>
                {entry.label}
              </AppText>
              <AppText variant="caption" color="textMuted" align="end" selectable>
                {entry.time}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Rail top so the 10pt dot centres on the first `bodySmall` line. */
const RAIL_TOP = space[1] + 1;

const styles = StyleSheet.create({
  wrap: { gap: space[2] },
  track: { flexDirection: 'row', gap: g.segmentGap },
  segment: { flex: 1, height: g.track, borderRadius: radius.xs },
  labels: { flexDirection: 'row', gap: g.segmentGap },
  label: { flex: 1, minWidth: 0 },
  entry: { flexDirection: 'row', gap: space[3] },
  entryRail: { width: g.timelineDot, alignItems: 'center', paddingTop: RAIL_TOP },
  entryDot: { width: g.timelineDot, height: g.timelineDot, borderRadius: radius.pill },
  // UI-R15: the connector runs from this dot into the next entry's top padding, so it meets the
  // next dot with no gap (it used to stop 4pt short at both ends).
  entryLine: { flex: 1, width: 2, marginBottom: -RAIL_TOP },
  entryText: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  entryGap: { paddingBottom: space[4] },
  flex: { flex: 1, minWidth: 0 },
});
