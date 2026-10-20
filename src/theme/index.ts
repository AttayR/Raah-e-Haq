/**
 * Theme entry point (DESIGN_SYSTEM §1-3, §6). `useAppTheme().theme` (src/app/providers/
 * ThemeProvider.tsx) returns one of the two `AppTheme` objects below.
 */
import { borderWidth } from './borders';
import { componentTokens, type ComponentTokens } from './components';
import { createElevation, type ElevationScale } from './elevation';
import { mapBackgrounds, mapStyles, type MapStyleRule } from './mapStyles';
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

/**
 * UI-R2 retired the legacy `accent` alias (`accent` is the spec saffron, §1.2, §1.4); UI-R19
 * retired the pre-T-601 names (`text`, `mutedText`, `secondary`, `disabledFill`, `disabledText`).
 */
export type ThemeColors = SemanticColors;

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
  /** The map style's land colour, shown while tiles load (T-540). */
  mapBackground: string;
  statusBarStyle: StatusBarStyle;
};

export const createTheme = (mode: ColorMode): AppTheme => {
  const semantic = semanticColors[mode];
  return {
    mode,
    colors: semantic,
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
    mapBackground: mapBackgrounds[mode],
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
