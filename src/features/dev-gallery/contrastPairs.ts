import type { SemanticColorName } from '../../theme';

/**
 * The contrast pair the kit gallery prints for each colour token (DESIGN_SYSTEM §1.5): the
 * token is shown either as a foreground on `on`, or as a background under `fg`.
 * - `text`: must reach 4.5:1
 * - `nonText`: icons and UI boundaries, must reach 3:1
 * - `decorative`: dividers, empty stars, skeleton, casing; no threshold (§1.4 notes)
 * - `scrim`: translucent overlay, not measurable as a pair
 */
export type ContrastKind = 'text' | 'nonText' | 'decorative' | 'scrim';

export type ContrastPair = {
  token: SemanticColorName;
  fg: SemanticColorName;
  bg: SemanticColorName;
  kind: ContrastKind;
};

const fgOn = (token: SemanticColorName, bg: SemanticColorName, kind: ContrastKind): ContrastPair => ({
  token,
  fg: token,
  bg,
  kind,
});

const bgUnder = (token: SemanticColorName, fg: SemanticColorName, kind: ContrastKind): ContrastPair => ({
  token,
  fg,
  bg: token,
  kind,
});

/** One entry per semantic colour token, in DESIGN_SYSTEM §1.4 order. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = [
  bgUnder('background', 'textPrimary', 'text'),
  bgUnder('surface', 'textPrimary', 'text'),
  bgUnder('surfaceAlt', 'textMuted', 'text'),
  bgUnder('surfaceRaised', 'textPrimary', 'text'),
  bgUnder('surfacePressed', 'textPrimary', 'text'),
  bgUnder('surfaceAltPressed', 'textSecondary', 'text'),
  fgOn('textPrimary', 'surface', 'text'),
  fgOn('textSecondary', 'surface', 'text'),
  fgOn('textMuted', 'surface', 'text'),
  fgOn('textInverse', 'textPrimary', 'text'),
  fgOn('border', 'surface', 'decorative'),
  fgOn('borderStrong', 'surface', 'nonText'),
  bgUnder('primary', 'onPrimary', 'text'),
  bgUnder('primaryPressed', 'onPrimary', 'text'),
  fgOn('primaryText', 'surface', 'text'),
  fgOn('onPrimary', 'primary', 'text'),
  bgUnder('primarySoft', 'onPrimarySoft', 'text'),
  fgOn('onPrimarySoft', 'primarySoft', 'text'),
  bgUnder('primarySoftPressed', 'onPrimarySoft', 'text'),
  fgOn('focusRing', 'surface', 'nonText'),
  fgOn('success', 'surface', 'text'),
  bgUnder('successSoft', 'success', 'text'),
  fgOn('onSuccess', 'success', 'text'),
  fgOn('warning', 'surface', 'text'),
  bgUnder('warningSoft', 'warning', 'text'),
  fgOn('danger', 'surface', 'text'),
  bgUnder('dangerSoft', 'danger', 'text'),
  bgUnder('dangerFill', 'onPrimary', 'text'),
  bgUnder('dangerPressed', 'onPrimary', 'text'),
  bgUnder('dangerSoftPressed', 'danger', 'text'),
  bgUnder('fillDisabled', 'textDisabled', 'text'),
  fgOn('textDisabled', 'fillDisabled', 'text'),
  fgOn('info', 'surface', 'text'),
  bgUnder('infoSoft', 'info', 'text'),
  bgUnder('accent', 'onAccent', 'text'),
  // UI-R21 navy + saffron (§1.4, §1.5): pressed disc, promo/FareTag tint, saffron glyph.
  bgUnder('accentPressed', 'onAccent', 'text'),
  fgOn('onAccent', 'accent', 'text'),
  bgUnder('accentSoft', 'textSecondary', 'text'),
  bgUnder('accentSoftPressed', 'textSecondary', 'text'),
  fgOn('accentStrong', 'accentSoft', 'nonText'),
  fgOn('ratingStar', 'surface', 'nonText'),
  fgOn('ratingStarEmpty', 'surface', 'decorative'),
  fgOn('overlay', 'surface', 'scrim'),
  fgOn('skeletonHighlight', 'surfaceAlt', 'decorative'),
  fgOn('routeLine', 'background', 'nonText'),
  fgOn('routeLineCasing', 'routeLine', 'decorative'),
  fgOn('routeLineTraveled', 'surface', 'nonText'),
  fgOn('pickupPin', 'surface', 'nonText'),
  fgOn('dropoffPin', 'surface', 'nonText'),
  fgOn('dropoffPinEdge', 'surfaceAlt', 'nonText'),
  fgOn('stopPin', 'surface', 'nonText'),
  fgOn('driverMarker', 'surface', 'nonText'),
  fgOn('userLocation', 'surface', 'nonText'),
  // T-586 vehicle art (map-vehicles.md §1.3): the body and outline carry the 3:1; trims are decorative.
  fgOn('vehicleBody', 'surface', 'nonText'),
  fgOn('vehicleRoof', 'vehicleBody', 'decorative'),
  fgOn('vehicleGlass', 'vehicleBody', 'nonText'),
  fgOn('vehicleTyre', 'vehicleCasing', 'nonText'),
  fgOn('vehicleCasing', 'vehicleBody', 'nonText'),
  fgOn('vehicleHeadlight', 'vehicleBody', 'decorative'),
  fgOn('vehicleTaillight', 'vehicleBody', 'decorative'),
  fgOn('vehicleShadow', 'surface', 'decorative'),
  bgUnder('vehicleAcBadge', 'vehicleAcGlyph', 'nonText'),
  fgOn('vehicleAcGlyph', 'vehicleAcBadge', 'nonText'),
  fgOn('vehicleHalo', 'surface', 'decorative'),
  // UI-R20b Home service-card art (passenger-home V2): the front face carries the 3:1 in both modes
  // (3.02 / 4.72); the side face is 5.30 in light only, so it is listed as decorative.
  fgOn('illoHub', 'vehicleTyre', 'decorative'),
  fgOn('illoShadow', 'primarySoft', 'decorative'),
  fgOn('illoBoxFront', 'accentSoft', 'nonText'),
  fgOn('illoBoxTop', 'illoBoxFront', 'decorative'),
  fgOn('illoBoxSide', 'accentSoft', 'decorative'),
  fgOn('illoBoxTape', 'illoBoxFront', 'decorative'),
  fgOn('illoMotion', 'accentSoft', 'decorative'),
  // UI-R17 Earnings hero (driver-earnings.md §1.1).
  bgUnder('heroFill', 'heroText', 'text'),
  fgOn('heroText', 'heroFill', 'text'),
  fgOn('heroTextMuted', 'heroFill', 'text'),
  fgOn('heroDivider', 'heroFill', 'decorative'),
];

/** Minimum ratio for a kind, or null when the pair has no threshold. */
export const thresholdFor = (kind: ContrastKind): number | null =>
  kind === 'text' ? 4.5 : kind === 'nonText' ? 3 : null;
