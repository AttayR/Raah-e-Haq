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
  /** [UI-R2] pressed state of things resting on `surfaceAlt` (default chips, tonal IconButton). */
  surfaceAltPressed: string;
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
  /** [UI-R2] pressed `secondary` button and selected chip. */
  primarySoftPressed: string;
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
  /** [UI-R2] pressed `destructive` / `destructiveSoft` buttons. */
  dangerPressed: string;
  dangerSoftPressed: string;
  /** [T-545] disabled filled Button fill (solid, no opacity, so the label stays readable in dark mode). */
  fillDisabled: string;
  /** [T-545] disabled Button label and icon (≥4.5:1 on `fillDisabled`, `background` and `surface`). */
  textDisabled: string;
  info: string;
  infoSoft: string;
  /** [UI-R21] logo orange: brand glyph discs, BrandBar, vehicle lights (§1.7 moments only). */
  accent: string;
  /** [UI-R21] pressed saffron disc. */
  accentPressed: string;
  onAccent: string;
  /** [UI-R21] promo / invite card, FareTag, promo notification tile. Never a Banner or status. */
  accentSoft: string;
  accentSoftPressed: string;
  /** [UI-R21] saffron glyph on `surface` / `accentSoft`. Never for words. */
  accentStrong: string;
  ratingStar: string;
  ratingStarEmpty: string;
  overlay: string;
  skeletonHighlight: string;
  routeLine: string;
  routeLineCasing: string;
  routeLineTraveled: string;
  pickupPin: string;
  dropoffPin: string;
  /** [UI-R21] 1 pt edge of the AddressPair dropoff square (`accent` on `surfaceAlt` is 2.88 in light). */
  dropoffPinEdge: string;
  stopPin: string;
  driverMarker: string;
  userLocation: string;
  /** [T-586] top-down vehicle art (map-vehicles.md §1.3): body, mirrors, bike tank/handlebar. */
  vehicleBody: string;
  /** Roof, rickshaw canopy, rider jacket, parcel box. */
  vehicleRoof: string;
  /** Wind and rear glass, helmet visor. */
  vehicleGlass: string;
  vehicleTyre: string;
  /** 2-unit outline round the silhouette (= `routeLineCasing`). */
  vehicleCasing: string;
  /** Head lights, helmet, rickshaw band (= `accent`). */
  vehicleHeadlight: string;
  /** Tail lights (= `danger`). */
  vehicleTaillight: string;
  /** Contact shadow colour; its opacity is a component token. */
  vehicleShadow: string;
  /** AC roof disc and its snowflake. */
  vehicleAcBadge: string;
  vehicleAcGlyph: string;
  /** Assigned vehicle halo fill and ring (opacity from component tokens). */
  vehicleHalo: string;
  /** [UI-R17] driver Earnings period hero (driver-earnings.md §1.1): fill, text, muted text, rules. */
  heroFill: string;
  /** The hero's big number and values: white in both modes (the brightest thing on screen). */
  heroText: string;
  heroTextMuted: string;
  /** Decorative rules inside the hero (never the only separator of meaning). */
  heroDivider: string;
};

export type SemanticColorName = keyof SemanticColors;

export const lightColors: SemanticColors = {
  background: neutral[50],
  surface: neutral[0],
  surfaceAlt: neutral[100],
  surfaceRaised: neutral[0],
  surfacePressed: neutral[100],
  surfaceAltPressed: neutral[200],
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
  primarySoftPressed: navy[100],
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
  dangerPressed: extra.dangerPressed,
  dangerSoftPressed: extra.dangerSoftPressed,
  fillDisabled: neutral[200],
  textDisabled: neutral[600],
  info: extra.info,
  infoSoft: extra.infoSoft,
  accent: saffron[500],
  accentPressed: saffron[400],
  onAccent: neutral[900],
  accentSoft: saffron[50],
  accentSoftPressed: saffron[100],
  accentStrong: saffron[700],
  ratingStar: saffron[500],
  ratingStarEmpty: neutral[300],
  overlay: extra.overlay,
  skeletonHighlight: neutral[50],
  routeLine: navy[800],
  routeLineCasing: extra.white,
  routeLineTraveled: neutral[400],
  pickupPin: extra.pickupPin,
  dropoffPin: saffron[500],
  dropoffPinEdge: saffron[700],
  stopPin: neutral[600],
  driverMarker: neutral[900],
  userLocation: extra.info,
  vehicleBody: navy[800],
  vehicleRoof: navy[600],
  vehicleGlass: navy[200],
  vehicleTyre: neutral[800],
  vehicleCasing: extra.white,
  vehicleHeadlight: saffron[500],
  vehicleTaillight: extra.danger,
  vehicleShadow: extra.black,
  vehicleAcBadge: extra.white,
  vehicleAcGlyph: navy[800],
  vehicleHalo: navy[800],
  heroFill: navy[800],
  heroText: extra.white,
  heroTextMuted: navy[200],
  heroDivider: navy[700],
};

export const darkColors: SemanticColors = {
  background: dark[950],
  surface: dark[900],
  surfaceAlt: dark[850],
  surfaceRaised: dark[800],
  surfacePressed: dark[800],
  surfaceAltPressed: dark[700],
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
  primarySoftPressed: navy[700],
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
  dangerPressed: extra.dangerPressedDark,
  dangerSoftPressed: extra.dangerSoftPressedDark,
  fillDisabled: dark[700],
  textDisabled: dark[300],
  info: extra.infoDark,
  infoSoft: extra.infoSoftDark,
  accent: saffron[500],
  accentPressed: saffron[400],
  onAccent: neutral[900],
  accentSoft: saffron[900],
  accentSoftPressed: extra.accentSoftPressedDark,
  accentStrong: saffron[300],
  ratingStar: saffron[500],
  ratingStarEmpty: dark[700],
  overlay: extra.overlayDark,
  skeletonHighlight: dark[800],
  routeLine: extra.routeLineDark,
  routeLineCasing: dark[950],
  routeLineTraveled: dark[600],
  pickupPin: extra.pickupPinDark,
  dropoffPin: saffron[500],
  dropoffPinEdge: saffron[500],
  stopPin: dark[300],
  driverMarker: dark[50],
  userLocation: extra.infoDark,
  vehicleBody: dark[50],
  vehicleRoof: navy[200],
  vehicleGlass: navy[700],
  // A darker tyre disappears into the dark casing.
  vehicleTyre: dark[600],
  vehicleCasing: dark[950],
  vehicleHeadlight: saffron[500],
  vehicleTaillight: extra.dangerDark,
  vehicleShadow: extra.black,
  vehicleAcBadge: navy[800],
  vehicleAcGlyph: extra.white,
  vehicleHalo: navy[400],
  heroFill: extra.primarySoftDark,
  heroText: extra.white,
  heroTextMuted: navy[300],
  heroDivider: navy[500],
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
