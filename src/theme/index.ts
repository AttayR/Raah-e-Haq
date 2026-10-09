/**
 * Theme entry point (DESIGN_SYSTEM §1-3, §6). `useAppTheme().theme` (src/app/providers/
 * ThemeProvider.tsx) returns one of the two `AppTheme` objects below.
 */
import { borderWidth } from './borders';
import { createElevation, type ElevationScale } from './elevation';
import { mapStyles, type MapStyleRule } from './mapStyles';
import { motion, motionPatterns, reducedMotion, springs } from './motion';
import { radius } from './radii';
import { layout, space } from './spacing';
import {
  semanticColors,
  statusBarStyles,
  type ColorMode,
  type SemanticColors,
  type StatusBarStyle,
} from './tokens';
import { textStyles } from './typography';
import { saffron } from './palette';

/**
 * Pre-T-601 colour names, kept so current screens compile and render as before. Each maps
 * onto a semantic token. New code must not use them; they are removed screen by screen in
 * T-602 onward.
 */
export type LegacyColors = {
  /** @deprecated use `textPrimary`. */
  text: string;
  /** @deprecated use `textSecondary`. */
  mutedText: string;
  /**
   * @deprecated pre-T-601 "orange" secondary (pending status, BrandButton `secondary`).
   * Saffron is not a button or status colour (§1.2); T-602 Button uses `primarySoft`.
   */
  secondary: string;
  /**
   * @deprecated Legacy meaning (T-106): brand text/icon/border colour of outline controls,
   * i.e. the value of `primaryText`. Use `primaryText`. While this alias exists, the spec's
   * saffron `accent` token is shadowed in `theme.colors`; read it from `semanticColors` /
   * `palette.saffron[500]` if needed. T-602 moves the six consumers to `primaryText` and
   * `accent` then takes the spec value.
   */
  accent: string;
  /** @deprecated disabled filled button fill; T-602 Button uses 0.4 opacity instead. */
  disabledFill: string;
  /** @deprecated disabled filled button label. */
  disabledText: string;
};

export type ThemeColors = Omit<SemanticColors, 'accent'> & LegacyColors;

export type AppTheme = {
  mode: ColorMode;
  colors: ThemeColors;
  typography: typeof textStyles;
  space: typeof space;
  layout: typeof layout;
  radius: typeof radius;
  borderWidth: typeof borderWidth;
  elevation: ElevationScale;
  motion: typeof motion;
  springs: typeof springs;
  motionPatterns: typeof motionPatterns;
  reducedMotion: typeof reducedMotion;
  mapStyle: MapStyleRule[];
  statusBarStyle: StatusBarStyle;
};

const legacyColors = (c: SemanticColors): LegacyColors => ({
  text: c.textPrimary,
  mutedText: c.textSecondary,
  secondary: saffron[500],
  accent: c.primaryText,
  disabledFill: c.surfaceAlt,
  disabledText: c.textSecondary,
});

export const createTheme = (mode: ColorMode): AppTheme => {
  const semantic = semanticColors[mode];
  return {
    mode,
    colors: { ...semantic, ...legacyColors(semantic) },
    typography: textStyles,
    space,
    layout,
    radius,
    borderWidth,
    elevation: createElevation(mode),
    motion,
    springs,
    motionPatterns,
    reducedMotion,
    mapStyle: mapStyles[mode],
    statusBarStyle: statusBarStyles[mode],
  };
};

export const LightTheme: AppTheme = createTheme('light');
export const DarkTheme: AppTheme = createTheme('dark');

export const themes: Record<ColorMode, AppTheme> = { light: LightTheme, dark: DarkTheme };

export * from './tokens';
export * from './palette';
export * from './typography';
export * from './spacing';
export * from './radii';
export * from './borders';
export * from './elevation';
export * from './motion';
export * from './mapStyles';
