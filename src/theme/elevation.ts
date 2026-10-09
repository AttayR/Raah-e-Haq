import type { ViewStyle } from 'react-native';
import { neutral } from './palette';
import type { ColorMode } from './tokens';

/**
 * Elevation levels (DESIGN_SYSTEM §3.5). Each level carries the iOS shadow and the Android
 * `elevation`; each platform ignores the other's props. In dark mode every shadow opacity is
 * 0 (depth comes from `surfaceRaised` plus a `border.thin` outline on cards); Android
 * elevation stays.
 */
export type ElevationLevel = 0 | 1 | 2 | 3 | 4;

export type ElevationStyle = Required<
  Pick<ViewStyle, 'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'>
>;

type ShadowSpec = { y: number; opacity: number; radius: number; android: number };

const levels: Record<ElevationLevel, ShadowSpec> = {
  0: { y: 0, opacity: 0, radius: 0, android: 0 },
  1: { y: 2, opacity: 0.06, radius: 8, android: 2 },
  2: { y: 4, opacity: 0.1, radius: 16, android: 6 },
  /** Bottom sheets: shadow cast upward. */
  3: { y: -4, opacity: 0.12, radius: 24, android: 12 },
  4: { y: 8, opacity: 0.16, radius: 32, android: 16 },
};

const build = (mode: ColorMode, spec: ShadowSpec): ElevationStyle => ({
  shadowColor: neutral[900],
  shadowOffset: { width: 0, height: spec.y },
  shadowOpacity: mode === 'dark' ? 0 : spec.opacity,
  shadowRadius: spec.radius,
  elevation: spec.android,
});

export type ElevationScale = Record<ElevationLevel, ElevationStyle>;

export const createElevation = (mode: ColorMode): ElevationScale => ({
  0: build(mode, levels[0]),
  1: build(mode, levels[1]),
  2: build(mode, levels[2]),
  3: build(mode, levels[3]),
  4: build(mode, levels[4]),
});

export const elevation: Record<ColorMode, ElevationScale> = {
  light: createElevation('light'),
  dark: createElevation('dark'),
};
