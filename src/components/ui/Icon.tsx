import React from 'react';
import { StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { SemanticColorName } from '../../theme';
import { iconGlyphs, shouldMirrorIcon, type IconName } from './icons';

export { iconGlyphs, type IconName } from './icons';

export type IconProps = {
  name: IconName;
  /**
   * 16, 20, 24 (default), 28, 32 or 48 (§4); 40 only for the rating input stars (§5.22); 64 only
   * inside the duotone `Illustration` (UI-R8).
   */
  size?: 16 | 20 | 24 | 28 | 32 | 40 | 48 | 64;
  color?: SemanticColorName;
  /**
   * Raw colour that wins over `color`. Only for surfaces that keep one palette in both modes
   * (the inverse Toast uses the dark-mode tone values); screens use `color` tokens.
   */
  tint?: string;
  testID?: string;
};

/**
 * The one icon component (DESIGN_SYSTEM §4, v1.1): MaterialCommunityIcons, bundled on iOS
 * (`UIAppFonts`) and Android (`fonts.gradle` `iconFontNames`). Decorative by default: the
 * control or text next to it carries the accessible name. Direction glyphs mirror in RTL.
 */
export function Icon({ name, size = 24, color = 'textSecondary', tint, testID }: IconProps) {
  const { theme } = useAppTheme();
  return (
    <MaterialCommunityIcons
      name={iconGlyphs[name]}
      size={size}
      color={tint ?? theme.colors[color]}
      testID={testID}
      style={shouldMirrorIcon(name) ? styles.mirrored : undefined}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}

const styles = StyleSheet.create({
  mirrored: { transform: [{ scaleX: -1 }] },
});
