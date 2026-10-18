import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Skeleton } from '../../../components/ui';
import { t } from '../../../i18n';
import { componentTokens, radius, space } from '../../../theme';

/** The strip at 1.0x font: 8 + value 20 + 2 + label 16 + 8. The skeleton uses the same height. */
const STRIP_HEIGHT = componentTokens.skeleton.heights.activitySummary;
import type { SummaryItem } from '../format';

type Props = {
  items: ReadonlyArray<SummaryItem>;
  /** Stats still loading for the first time: a placeholder of the same height, so nothing jumps. */
  loading?: boolean;
};

/**
 * Slim summary strip over the ride list (UI-R15, owner feedback 2026-10-18): up to four
 * server figures side by side in one low-emphasis `surfaceAlt` row (value `numeric`, label
 * `caption`), so the rides stay the hero and start on the first screen. Renders nothing when
 * there is nothing to sum up.
 */
export const ActivitySummary = memo(function ActivitySummary({ items, loading = false }: Props) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  if (loading && items.length === 0) {
    return (
      <View
        style={[styles.strip, styles.skeleton, { backgroundColor: c.surfaceAlt }]}
        accessible
        accessibilityLabel={t('activity.summaryLoading')}
        testID="activity-summary-loading"
      >
        <View style={styles.cell}>
          <Skeleton width="80%" textVariant="numeric" />
          <Skeleton width="50%" textVariant="caption" />
        </View>
      </View>
    );
  }
  if (items.length === 0) return null;
  return (
    <View
      style={[styles.strip, { backgroundColor: c.surfaceAlt }]}
      accessibilityLabel={t('activity.summaryA11y')}
      testID="activity-summary"
    >
      {items.map((item, i) => (
        <View
          key={item.key}
          style={[
            styles.cell,
            i > 0 ? { borderStartWidth: theme.borderWidth.hairline, borderStartColor: c.border } : null,
          ]}
          accessible
          accessibilityLabel={`${item.label}, ${item.value}`}
          testID={`activity-summary-${item.key}`}
        >
          <AppText variant="numeric" numberOfLines={1} align="center">
            {item.value}
          </AppText>
          <AppText variant="caption" color="textSecondary" numberOfLines={1} align="center">
            {item.label}
          </AppText>
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    borderRadius: radius.md,
    paddingVertical: space[2],
    // Grows with large text; never shorter than the 1.0x height (no jump from the skeleton).
    minHeight: STRIP_HEIGHT,
  },
  skeleton: { height: STRIP_HEIGHT },
  cell: {
    flex: 1,
    minWidth: 0,
    // No `adjustsFontSizeToFit` here: in this flex row iOS (new arch) shrank the values to a few
    // points. One line with an ellipsis; the full value is in the cell's accessibility label.
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: space[1] / 2,
    paddingHorizontal: space[1],
  },
});
