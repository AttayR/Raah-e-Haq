/**
 * Semantic colour tokens, light and dark (DESIGN_SYSTEM §1.4). Code uses these names only,
 * via `useAppTheme().theme.colors.<token>`. Contrast pairs from §1.5 are asserted in
 * `__tests__/theme/tokens.test.ts`.
 */
import { dark, extra, navy, neutral, saffron } from './palette';

export type ColorMode = 'light' | 'dark';

export type SemanticColors = {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  surfacePressed: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryPressed: string;
  primaryText: string;
  onPrimary: string;
  primarySoft: string;
  onPrimarySoft: string;
  focusRing: string;
  success: string;
  successSoft: string;
  onSuccess: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  dangerFill: string;
  info: string;
  infoSoft: string;
  accent: string;
  onAccent: string;
  ratingStar: string;
  ratingStarEmpty: string;
  overlay: string;
  skeletonHighlight: string;
  routeLine: string;
  routeLineCasing: string;
  routeLineTraveled: string;
  pickupPin: string;
  dropoffPin: string;
  stopPin: string;
  driverMarker: string;
  userLocation: string;
};

export type SemanticColorName = keyof SemanticColors;

export const lightColors: SemanticColors = {
  background: neutral[50],
  surface: neutral[0],
  surfaceAlt: neutral[100],
  surfaceRaised: neutral[0],
  surfacePressed: neutral[100],
  textPrimary: neutral[900],
  textSecondary: neutral[600],
  textMuted: neutral[500],
  textInverse: neutral[0],
  border: neutral[200],
  borderStrong: neutral[400],
  primary: navy[800],
  primaryPressed: navy[900],
  primaryText: navy[800],
  onPrimary: extra.white,
  primarySoft: navy[50],
  onPrimarySoft: navy[800],
  focusRing: navy[800],
  success: extra.success,
  successSoft: extra.successSoft,
  onSuccess: extra.white,
  warning: extra.warning,
  warningSoft: extra.warningSoft,
  danger: extra.danger,
  dangerSoft: extra.dangerSoft,
  dangerFill: extra.danger,
  info: extra.info,
  infoSoft: extra.infoSoft,
  accent: saffron[500],
  onAccent: neutral[900],
  ratingStar: saffron[600],
  ratingStarEmpty: neutral[300],
  overlay: extra.overlay,
  skeletonHighlight: neutral[50],
  routeLine: navy[800],
  routeLineCasing: extra.white,
  routeLineTraveled: neutral[400],
  pickupPin: extra.pickupPin,
  dropoffPin: navy[800],
  stopPin: neutral[600],
  driverMarker: neutral[900],
  userLocation: extra.info,
};

export const darkColors: SemanticColors = {
  background: dark[950],
  surface: dark[900],
  surfaceAlt: dark[850],
  surfaceRaised: dark[800],
  surfacePressed: dark[800],
  textPrimary: dark[50],
  textSecondary: dark[300],
  textMuted: dark[500],
  textInverse: neutral[900],
  border: dark[700],
  borderStrong: dark[600],
  primary: navy[500],
  primaryPressed: navy[600],
  primaryText: navy[300],
  onPrimary: extra.white,
  primarySoft: extra.primarySoftDark,
  onPrimarySoft: navy[200],
  focusRing: navy[400],
  success: extra.successDark,
  successSoft: extra.successSoftDark,
  onSuccess: dark[950],
  warning: extra.warningDark,
  warningSoft: extra.warningSoftDark,
  danger: extra.dangerDark,
  dangerSoft: extra.dangerSoftDark,
  dangerFill: extra.dangerFillDark,
  info: extra.infoDark,
  infoSoft: extra.infoSoftDark,
  accent: saffron[500],
  onAccent: neutral[900],
  ratingStar: extra.ratingStarDark,
  ratingStarEmpty: dark[700],
  overlay: extra.overlayDark,
  skeletonHighlight: dark[800],
  routeLine: extra.routeLineDark,
  routeLineCasing: dark[950],
  routeLineTraveled: dark[600],
  pickupPin: extra.pickupPinDark,
  dropoffPin: navy[200],
  stopPin: dark[300],
  driverMarker: dark[50],
  userLocation: extra.infoDark,
};

export const semanticColors: Record<ColorMode, SemanticColors> = {
  light: lightColors,
  dark: darkColors,
};

/** `statusBar` token (§1.4): set by `Screen`/App from the theme, never per screen. */
export type StatusBarStyle = 'dark-content' | 'light-content';
export const statusBarStyles: Record<ColorMode, StatusBarStyle> = {
  light: 'dark-content',
  dark: 'light-content',
};
