import React from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { radius, space } from '../../theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type ListItemProps = {
  title: string;
  subtitle?: string;
  /** Leading glyph in a 40x40 `surfaceAlt` tile (§5.8). */
  icon?: IconName;
  /** Custom leading element (e.g. an Avatar); wins over `icon`. */
  leading?: React.ReactNode;
  /** Custom trailing element (Badge, Switch, value text). */
  trailing?: React.ReactNode;
  /** Shows the end chevron; defaults to true when the row is pressable and has no `trailing`. */
  chevron?: boolean;
  /** Label and icon in `danger`, no chevron. */
  destructive?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
};

/**
 * List row (DESIGN_SYSTEM §5.8): min height 56/72, 16 horizontal padding, 16 from the leading
 * element to the text, 8 to the trailing slot.
 * Text wraps (max 2 lines each) instead of clipping, so rows grow with font scaling.
 */
export function ListItem({
  title,
  subtitle,
  icon,
  leading,
  trailing,
  chevron,
  destructive = false,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: ListItemProps) {
  const { theme } = useAppTheme();
  const showChevron = chevron ?? (!!onPress && !trailing && !destructive);
  const tileColor = destructive ? theme.colors.dangerSoft : theme.colors.surfaceAlt;

  const body = (
    <>
      {leading ? (
        <View style={styles.leading}>{leading}</View>
      ) : icon ? (
        <View style={[styles.tile, styles.leading, { backgroundColor: tileColor }]}>
          <Icon name={icon} color={destructive ? 'danger' : 'textSecondary'} />
        </View>
      ) : null}
      <View style={styles.text}>
        <AppText variant="body" color={destructive ? 'danger' : 'textPrimary'} numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySmall" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing}
      {showChevron ? (
        <View style={I18nManager.isRTL ? styles.flip : null}>
          <Icon name="chevronEnd" size={20} color="textMuted" />
        </View>
      ) : null}
    </>
  );

  const rowStyle = [styles.row, subtitle ? styles.twoLine : styles.oneLine, disabled && styles.disabled];

  if (!onPress) {
    return (
      <View testID={testID} style={rowStyle} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [...rowStyle, pressed && !disabled ? { backgroundColor: theme.colors.surfacePressed } : null]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    // 8 to the trailing slot; the leading element adds 8 more so the text starts 16 after it.
    gap: space[2],
  },
  leading: { marginEnd: space[2], flexShrink: 0 },
  oneLine: { minHeight: 56 },
  twoLine: { minHeight: 72 },
  tile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: { flex: 1, minWidth: 0 },
  flip: { transform: [{ scaleX: -1 }] },
  disabled: { opacity: 0.5 },
});
