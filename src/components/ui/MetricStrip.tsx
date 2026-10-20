import React, { Fragment, memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, radius, space } from '../../theme';
import { AppText } from './AppText';

export type MetricCell = {
  key: string;
  /** Already formatted ("3 min", "1.2 km"); one line. */
  value: string;
  /** `caption` under the value ("to pickup"); may wrap to two lines at 1.3×. */
  label: string;
  /** Read as one element ("3 minutes to pickup"); default "{value} {label}". */
  accessibilityLabel?: string;
  testID?: string;
};

type Props = { cells: readonly MetricCell[]; testID?: string };

const k = componentTokens.metricStrip;

/**
 * MetricStrip (UI-R11, driver-incoming-request R2 #6): up to three equal cells on `surfaceAlt`
 * (radius `md`, min height 56) split by 24 high hairline separators; value `numeric` over a
 * `caption` label, centred. Callers pass only cells the API sent; with none the strip is not
 * drawn. Each cell is one screen-reader element.
 */
function MetricStripBase({ cells, testID }: Props) {
  const { theme } = useAppTheme();
  if (cells.length === 0) return null;
  return (
    <View style={[styles.strip, { backgroundColor: theme.colors.surfaceAlt }]} testID={testID}>
      {cells.map((cell, index) => (
        <Fragment key={cell.key}>
          {index > 0 ? <View style={[styles.separator, { backgroundColor: theme.colors.border }]} /> : null}
          <View
            style={styles.cell}
            accessible
            accessibilityLabel={cell.accessibilityLabel ?? `${cell.value} ${cell.label}`}
            testID={cell.testID ? `${cell.testID}-cell` : undefined}
          >
            <AppText variant="numeric" numberOfLines={1} align="center" testID={cell.testID}>
              {cell.value}
            </AppText>
            <AppText variant="caption" color="textSecondary" numberOfLines={2} align="center">
              {cell.label}
            </AppText>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

export const MetricStrip = memo(MetricStripBase);

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: k.minHeight,
    borderRadius: radius.md,
    paddingHorizontal: space[2],
  },
  cell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: k.cellPaddingVertical,
  },
  separator: { width: StyleSheet.hairlineWidth, height: k.separatorHeight },
});
