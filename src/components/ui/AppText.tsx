import React from 'react';
import { Text, type TextProps } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { MAX_FONT_SIZE_MULTIPLIER, type SemanticColorName, type TextStyleName } from '../../theme';

/** Text colours allowed by DESIGN_SYSTEM §2 (text tokens, `primaryText`, semantic and `on*`). */
export type TextColor = Extract<
  SemanticColorName,
  | 'textPrimary'
  | 'textSecondary'
  | 'textMuted'
  | 'textDisabled'
  | 'textInverse'
  | 'primaryText'
  | 'onPrimary'
  | 'onPrimarySoft'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'onAccent'
  | 'onSuccess'
  | 'heroText'
  | 'heroTextMuted'
>;

export type AppTextProps = TextProps & {
  /** Type-scale style (§2). Defaults to `body`. */
  variant?: TextStyleName;
  /** Colour token. Defaults to `textPrimary`. */
  color?: TextColor;
  /** `start`/`center`/`end`, mapped so RTL (Urdu) mirrors correctly. */
  align?: 'start' | 'center' | 'end';
};

const alignMap = { start: 'auto', center: 'center', end: 'right' } as const;

/**
 * The only text component screens use (DESIGN_SYSTEM §2): a type-scale style, a colour token
 * and Dynamic Type capped at 1.3x so layouts never clip.
 */
export function AppText({
  variant = 'body',
  color = 'textPrimary',
  align,
  style,
  maxFontSizeMultiplier = MAX_FONT_SIZE_MULTIPLIER,
  ...rest
}: AppTextProps) {
  const { theme } = useAppTheme();
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        theme.typography[variant],
        { color: theme.colors[color] },
        align ? { textAlign: alignMap[align] } : null,
        style,
      ]}
    />
  );
}
