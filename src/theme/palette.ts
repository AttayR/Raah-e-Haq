/**
 * Raw palette (DESIGN_SYSTEM §1.1-1.3). Screens never import this file: they use the
 * semantic tokens in `tokens.ts` through `useAppTheme().theme.colors`. Only `src/theme/*`
 * reads palette names directly.
 */

/** Brand navy scale; the existing brand colour #011C72 is navy-800. */
export const navy = {
  50: '#EEF2FC',
  100: '#DCE4F8',
  200: '#C9D5F7',
  300: '#9DB2F0',
  400: '#6A86DE',
  500: '#3D5FD0',
  600: '#2E4FBF',
  700: '#1A3496',
  800: '#011C72',
  900: '#01155A',
  950: '#000D3B',
} as const;

/** Saffron accent from the logo. Never for buttons, status or large areas. */
export const saffron = {
  50: '#FFF4E5',
  500: '#F59A23',
  600: '#C77700',
  700: '#A85A00',
} as const;

/** Light-mode neutrals. */
export const neutral = {
  0: '#FFFFFF',
  25: '#FAFBFD',
  50: '#F4F6FA',
  100: '#EBEEF5',
  200: '#DADFEA',
  300: '#C3CAD9',
  400: '#858EA5',
  500: '#626B82',
  600: '#4C556C',
  700: '#353D52',
  800: '#20273A',
  900: '#0F1422',
} as const;

/** Dark-mode neutrals. */
export const dark = {
  950: '#0B0F1A',
  900: '#141A2A',
  850: '#1D2438',
  800: '#252D44',
  700: '#2B3450',
  600: '#626E90',
  500: '#9099B0',
  300: '#B7BFD0',
  50: '#F2F4F9',
} as const;

/** One-off values the semantic table uses that are not on a scale above. */
export const extra = {
  white: '#FFFFFF',
  black: '#000000',
  primarySoftDark: '#1C2850',
  success: '#12753B',
  successDark: '#4ACB7E',
  successSoft: '#E5F4EA',
  successSoftDark: '#12301F',
  warning: '#9A5200',
  warningDark: '#F2B44B',
  warningSoft: '#FFF2DF',
  warningSoftDark: '#332407',
  danger: '#C0262D',
  dangerDark: '#FF7A7F',
  dangerSoft: '#FDEBEC',
  dangerSoftDark: '#3A1517',
  dangerFillDark: '#D23A40',
  info: '#1D58C4',
  infoDark: '#7FA8F5',
  infoSoft: '#E7EFFD',
  infoSoftDark: '#15264A',
  ratingStarDark: '#F5A524',
  routeLineDark: '#8EA6F2',
  pickupPin: '#15803D',
  pickupPinDark: '#3DD17A',
  overlay: 'rgba(9,12,22,0.48)',
  overlayDark: 'rgba(0,0,0,0.64)',
} as const;

export const palette = { navy, saffron, neutral, dark, extra } as const;
