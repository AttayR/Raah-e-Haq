import React from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { componentTokens, radius, space } from '../../theme';
import { AppText } from './AppText';
import { DimmedContext } from './dimmed';
import { Icon, type IconName } from './Icon';

export type ListItemProps = {
  title: string;
  /** Title line cap (default 2); UI-R18 ticket subjects use 1 (tail ellipsis). */
  titleNumberOfLines?: number;
  subtitle?: string;
  /** Subtitle line cap (default 2); 0 shows all of it (a bio or an address on Profile, T-545). */
  subtitleNumberOfLines?: number;
  /** UI-R16: `primaryText` for a call to action in the subtitle ("Add home"); default `textSecondary`. */
  subtitleColor?: 'textSecondary' | 'primaryText';
  /** Optional third line in `caption` `textMuted` (dates, meta). */
  meta?: string;
  /**
   * `settings` (default): title in `body`. `content` (rides, chats, places): title in `title`
   * (17/22, 600) and a 72 minimum height (§5.8, §12.3).
   */
  variant?: 'settings' | 'content';
  /** Leading glyph in a 40x40 `surfaceAlt` tile (§5.8), or a plain 24 glyph with `iconStyle="plain"`. */
  icon?: IconName;
  iconStyle?: 'tile' | 'plain';
  /** Trailing value text (`bodySmall` `textSecondary`), before the chevron. */
  value?: string;
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
  /** For a row that toggles its trailing Switch: announced as a switch with this on/off state. */
  checked?: boolean;
  /**
   * T-523: an option in a single-choice list (a picker sheet): announced as a radio, `checked`
   * when it is the chosen one. Default: a button (or a switch when `checked` is given).
   */
  selectionRole?: 'radio';
  testID?: string;
};

/**
 * List row (DESIGN_SYSTEM §5.8): min height 56 (one line) / 72 (two lines or `content`), 16
 * horizontal and 12 vertical padding, 16 from the leading element to the text, 8 to the trailing
 * slot. Leading: 40 tile, plain 24 glyph or a custom element (Avatar 40). Trailing: value text,
 * chevron, Switch or Badge. Destructive rows: `danger`, no chevron.
 * Text wraps (max 2 lines each) instead of clipping, so rows grow with font scaling.
 */
export function ListItem({
  title,
  titleNumberOfLines = 2,
  subtitle,
  subtitleNumberOfLines = 2,
  subtitleColor = 'textSecondary',
  meta,
  variant = 'settings',
  icon,
  iconStyle = 'tile',
  value,
  leading,
  trailing,
  chevron,
  destructive = false,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  checked,
  selectionRole,
  testID,
}: ListItemProps) {
  const { theme } = useAppTheme();
  const showChevron = chevron ?? (!!onPress && !trailing && !destructive);
  const tileColor = destructive ? theme.colors.dangerSoft : theme.colors.surfaceAlt;

  const body = (
    <>
      {leading ? (
        <View style={styles.leading}>{leading}</View>
      ) : icon && iconStyle === 'plain' ? (
        <View style={styles.leading}>
          <Icon name={icon} color={destructive ? 'danger' : 'textSecondary'} />
        </View>
      ) : icon ? (
        <View style={[styles.tile, styles.leading, { backgroundColor: tileColor }]}>
          <Icon name={icon} color={destructive ? 'danger' : 'textSecondary'} />
        </View>
      ) : null}
      <View style={styles.text}>
        <AppText
          variant={variant === 'content' ? 'title' : 'body'}
          color={destructive ? 'danger' : 'textPrimary'}
          numberOfLines={titleNumberOfLines}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="bodySmall" color={subtitleColor} numberOfLines={subtitleNumberOfLines}>
            {subtitle}
          </AppText>
        ) : null}
        {meta ? (
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="bodySmall" color="textSecondary" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {/* The row already draws at the disabled opacity; a trailing Switch must not dim again. */}
      <DimmedContext.Provider value={disabled}>{trailing}</DimmedContext.Provider>
      {showChevron ? (
        <View style={I18nManager.isRTL ? styles.flip : null}>
          <Icon name="chevronEnd" size={20} color="textMuted" />
        </View>
      ) : null}
    </>
  );

  const tall = !!subtitle || !!meta || variant === 'content';
  const rowStyle = [styles.row, tall ? styles.twoLine : styles.oneLine, disabled && styles.disabled];
  const spoken = [title, subtitle, meta, value].filter(Boolean).join(', ');

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
      accessibilityRole={selectionRole ?? (checked === undefined ? 'button' : 'switch')}
      accessibilityLabel={accessibilityLabel ?? spoken}
      accessibilityHint={accessibilityHint}
      accessibilityState={checked === undefined ? { disabled } : { disabled, checked }}
      style={({ pressed }) => [...rowStyle, pressed && !disabled ? { backgroundColor: theme.colors.surfacePressed } : null]}
    >
      {body}
    </Pressable>
  );
}

const k = componentTokens.listItem;

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
  oneLine: { minHeight: k.minHeight.one },
  twoLine: { minHeight: k.minHeight.two },
  tile: {
    width: k.tile,
    height: k.tile,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  text: { flex: 1, minWidth: 0 },
  value: { flexShrink: 1, maxWidth: '45%' },
  flip: { transform: [{ scaleX: -1 }] },
  disabled: { opacity: componentTokens.state.disabledOpacity },
});
