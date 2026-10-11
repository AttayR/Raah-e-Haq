import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { radius, space } from '../../theme';
import { AppText } from './AppText';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';

export type StatTileProps = {
  icon: IconName;
  /** The value as the API gives it, already formatted; `null` shows an em dash (no data). */
  value: string | null;
  label: string;
  testID?: string;
};

/** Spoken in place of the dash when a stat has no value yet. */
export const STAT_UNAVAILABLE_A11Y = 'not available yet';

/**
 * Stat tile (DESIGN_SYSTEM §5.29): icon 20 in a 32 `primarySoft` circle, value `numericL`
 * (shrinks to fit, never clips), label `caption` (wraps to 2 lines). Tiles flex to share a
 * row, so three fit side by side on a 375pt iPhone SE.
 */
export function StatTile({ icon, value, label, testID }: StatTileProps) {
  const { theme } = useAppTheme();
  return (
    <Card
      testID={testID}
      style={styles.tile}
      accessible
      accessibilityLabel={`${label}: ${value ?? STAT_UNAVAILABLE_A11Y}`}
    >
      <View style={[styles.iconCircle, { backgroundColor: theme.colors.primarySoft }]}>
        <Icon name={icon} size={20} color="primaryText" />
      </View>
      <AppText
        variant="numericL"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={styles.value}
        color={value ? 'textPrimary' : 'textMuted'}
      >
        {value ?? '—'}
      </AppText>
      <AppText variant="caption" color="textSecondary" numberOfLines={2}>
        {label}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: 0, minHeight: 96 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[3],
  },
  value: { marginBottom: space[1] / 2 },
});
