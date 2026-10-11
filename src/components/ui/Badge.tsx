import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { radius, space, type SemanticColorName } from '../../theme';
import { AppText, type TextColor } from './AppText';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const tones: Record<BadgeTone, { fill: SemanticColorName; text: TextColor }> = {
  success: { fill: 'successSoft', text: 'success' },
  warning: { fill: 'warningSoft', text: 'warning' },
  danger: { fill: 'dangerSoft', text: 'danger' },
  info: { fill: 'infoSoft', text: 'info' },
  neutral: { fill: 'surfaceAlt', text: 'textSecondary' },
};

export type BadgeProps = { label: string; tone?: BadgeTone; testID?: string };

/**
 * Status pill (DESIGN_SYSTEM §5.12): min height 24, pill radius, `label` text. It never
 * shrinks, so a long neighbour truncates instead of pushing the pill off-screen.
 */
export function Badge({ label, tone = 'neutral', testID }: BadgeProps) {
  const { theme } = useAppTheme();
  const t = tones[tone];
  return (
    <View testID={testID} style={[styles.pill, { backgroundColor: theme.colors[t.fill] }]}>
      <AppText variant="label" color={t.text} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 24,
    paddingHorizontal: space[2],
    paddingVertical: space[0],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
