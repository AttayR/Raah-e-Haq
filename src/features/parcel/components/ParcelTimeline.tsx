import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Icon } from '../../../components/ui';
import { t } from '../../../i18n';
import { radius, space } from '../../../theme';
import { parcelTimeline } from '../rules';
import type { ParcelView } from '../types';

const DOT = space[3];

/**
 * The parcel's steps for the sender (BE-88 `parcel.status`): requested → accepted → arrived →
 * picked up → delivered, or … → returning → returned; cancelled ends it. Done steps carry a
 * tick, the current one the primary dot, later ones a muted dot. T-578: `times` (the ride's
 * accepted / arrived times) keep those steps on a cancelled parcel.
 */
export function ParcelTimeline({
  parcel,
  times,
  testID = 'parcel-timeline',
}: {
  parcel: ParcelView;
  times?: { acceptedAt?: string | null; arrivedAt?: string | null };
  testID?: string;
}) {
  const { theme } = useAppTheme();
  const steps = parcelTimeline(parcel, times);
  return (
    <View style={styles.list} accessibilityLabel={t('parcel.timelineA11y')} testID={testID}>
      {steps.map((step) => {
        const done = step.state === 'done';
        const current = step.state === 'current';
        const danger = current && step.key === 'cancelled';
        return (
          <View
            key={step.key}
            style={styles.row}
            accessible
            accessibilityLabel={done ? `${step.label}, ${t('parcel.stepDone')}` : current ? `${step.label}, ${t('parcel.stepCurrent')}` : step.label}
            testID={`${testID}-${step.key}-${step.state}`}
          >
            {done ? (
              <Icon name="check" size={16} color="success" />
            ) : (
              <View
                style={[
                  styles.dot,
                  { backgroundColor: danger ? theme.colors.danger : current ? theme.colors.primary : theme.colors.border },
                ]}
              />
            )}
            <AppText
              variant={current ? 'bodyStrong' : 'bodySmall'}
              color={danger ? 'danger' : current || done ? 'textPrimary' : 'textMuted'}
              style={styles.label}
            >
              {step.label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  dot: { width: DOT, height: DOT, borderRadius: radius.pill, marginHorizontal: space[1] / 2 },
  label: { flex: 1 },
});
