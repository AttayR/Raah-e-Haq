import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { t } from '../../i18n';
import { componentTokens, radius, space, type SemanticColorName } from '../../theme';
import { AppText, type TextColor } from './AppText';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const tones: Record<BadgeTone, { fill: SemanticColorName; text: TextColor }> = {
  success: { fill: 'successSoft', text: 'success' },
  warning: { fill: 'warningSoft', text: 'warning' },
  danger: { fill: 'dangerSoft', text: 'danger' },
  info: { fill: 'infoSoft', text: 'info' },
  neutral: { fill: 'surfaceAlt', text: 'textSecondary' },
};

type Common = { testID?: string; accessibilityLabel?: string };

/** Status pill (default): a short sentence-case label in one of five tones. */
type StatusBadgeProps = Common & { variant?: 'status'; label: string; tone?: BadgeTone };
/**
 * Count: number on `dangerFill` (white on dark `danger` is 2.52:1); `99+` cap; zero renders nothing.
 * The host supplies `accessibilityLabel` ("3 unread"), never the bare number.
 */
type CountBadgeProps = Common & { variant: 'count'; count: number };
/** Dot: 8pt `danger` dot with a 2pt `surface` ring (unread marker). */
type DotBadgeProps = Common & { variant: 'dot' };

export type BadgeProps = StatusBadgeProps | CountBadgeProps | DotBadgeProps;

const k = componentTokens.badge;

/** `12` → "12", `150` → "99+" (§5.12). */
export const formatBadgeCount = (count: number): string =>
  count > k.countCap ? t('kit.countOverflow', { max: k.countCap }) : String(Math.floor(count));

/**
 * Badge (DESIGN_SYSTEM §5.12): status pill (min height 24, pill radius, `label` text), count or
 * dot. It never shrinks, so a long neighbour truncates instead of pushing the badge off-screen.
 */
export function Badge(props: BadgeProps) {
  const { theme } = useAppTheme();
  const c = theme.colors;

  if (props.variant === 'dot') {
    return (
      <View
        testID={props.testID}
        accessible={!!props.accessibilityLabel}
        accessibilityLabel={props.accessibilityLabel}
        style={[styles.dot, { backgroundColor: c.danger, borderColor: c.surface }]}
      />
    );
  }

  if (props.variant === 'count') {
    if (props.count <= 0) {
      return null;
    }
    const text = formatBadgeCount(props.count);
    return (
      <View
        testID={props.testID}
        accessible
        accessibilityLabel={props.accessibilityLabel ?? text}
        style={[styles.count, { backgroundColor: c.dangerFill }]}
      >
        <AppText variant="numericSmall" color="onPrimary" numberOfLines={1}>
          {text}
        </AppText>
      </View>
    );
  }

  const tone = tones[props.tone ?? 'neutral'];
  return (
    <View
      testID={props.testID}
      accessibilityLabel={props.accessibilityLabel}
      style={[styles.pill, { backgroundColor: c[tone.fill] }]}
    >
      <AppText variant="label" color={tone.text} numberOfLines={1}>
        {props.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: k.statusHeight,
    paddingHorizontal: space[2],
    paddingVertical: space[0],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  count: {
    minWidth: k.countMin,
    minHeight: k.countMin,
    paddingHorizontal: k.countPaddingHorizontal,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dot: {
    width: k.dot + k.dotRing * 2,
    height: k.dot + k.dotRing * 2,
    borderRadius: radius.pill,
    borderWidth: k.dotRing,
    flexShrink: 0,
  },
});
