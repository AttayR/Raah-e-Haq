/**
 * Theme entry point (DESIGN_SYSTEM §1-3, §6). `useAppTheme().theme` (src/app/providers/
 * ThemeProvider.tsx) returns one of the two `AppTheme` objects below.
 */
import { borderWidth } from './borders';
import { componentTokens, type ComponentTokens } from './components';
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
  /** @deprecated disabled filled button fill; T-602 Button uses 0.4 opacity instead. */
  disabledFill: string;
  /** @deprecated disabled filled button label. */
  disabledText: string;
};

/** UI-R2 retired the legacy `accent` alias: `accent` is the spec saffron (§1.2, §1.4). */
export type ThemeColors = SemanticColors & LegacyColors;

export type AppTheme = {
  mode: ColorMode;
  colors: ThemeColors;
  typography: typeof textStyles;
  space: typeof space;
  layout: typeof layout;
  radius: typeof radius;
  borderWidth: typeof borderWidth;
  elevation: ElevationScale;
  /** v1.1 component dimensions (button radius, header, tab bar, IconButton). */
  components: ComponentTokens;
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
    components: componentTokens,
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
export * from './components';
export * from './contrast';
