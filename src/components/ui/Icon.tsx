import React from 'react';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import type { SemanticColorName } from '../../theme';

/**
 * Semantic icon names -> glyphs (DESIGN_SYSTEM §4). Screens say `<Icon name="vehicle" />`, never
 * a glyph name, and a missing name fails type-check.
 *
 * The spec's family is MaterialCommunityIcons, but its font is not bundled in the iOS app yet
 * (Info.plist UIAppFonts lists MaterialIcons only), so MDI glyphs would render as "?". Until
 * T-602 adds the font, the map points at the bundled MaterialIcons; swapping families later
 * changes this file only.
 */
const glyphs = {
  account: 'person-outline',
  back: 'arrow-back',
  bell: 'notifications-none',
  car: 'directions-car',
  chat: 'chat-bubble-outline',
  bike: 'two-wheeler',
  van: 'airport-shuttle',
  chevronEnd: 'chevron-right',
  check: 'check-circle',
  clock: 'schedule',
  help: 'help-outline',
  info: 'info-outline',
  lock: 'lock-outline',
  locate: 'my-location',
  locationOff: 'location-searching',
  logout: 'logout',
  phone: 'phone',
  pin: 'location-on',
  promo: 'local-offer',
  power: 'power-settings-new',
  retry: 'refresh',
  rides: 'local-taxi',
  send: 'send',
  settings: 'settings',
  shield: 'privacy-tip',
  star: 'star',
  theme: 'brightness-6',
  wallet: 'account-balance-wallet',
  warning: 'error-outline',
  // Added for the passenger Home and booking map (T-604); additive only.
  add: 'add',
  bookmark: 'bookmark-border',
  clear: 'cancel',
  close: 'close',
  distance: 'straighten',
  edit: 'edit',
  history: 'history',
  origin: 'trip-origin',
  refresh: 'refresh',
  savings: 'savings',
  search: 'search',
  starOutline: 'star-outline',
  swap: 'swap-vert',
} as const;

export type IconName = keyof typeof glyphs;

export type IconProps = {
  name: IconName;
  /** 16, 20, 24 (default), 28, 32 or 48 (§4). */
  size?: 16 | 20 | 24 | 28 | 32 | 48;
  color?: SemanticColorName;
  testID?: string;
};

/** Decorative by default: the control or text next to it carries the accessible name. */
export function Icon({ name, size = 24, color = 'textSecondary', testID }: IconProps) {
  const { theme } = useAppTheme();
  return (
    <MaterialIcons
      name={glyphs[name]}
      size={size}
      color={theme.colors[color]}
      testID={testID}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
