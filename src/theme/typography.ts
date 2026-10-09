import { Platform, type TextStyle } from 'react-native';

/**
 * Type scale (DESIGN_SYSTEM §2). System font on both platforms: no `fontFamily` is set
 * (iOS resolves SF Pro Text/Display itself, Android uses Roboto). Weights are numeric
 * strings only; `'bold'` is banned.
 */
export type TextStyleName =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'title'
  | 'body'
  | 'bodyStrong'
  | 'bodySmall'
  | 'caption'
  | 'label'
  | 'overline'
  | 'button'
  | 'buttonSmall'
  | 'numericXL'
  | 'numericL'
  | 'numeric'
  | 'numericSmall';

type ScaleStyle = Required<Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing'>> &
  Pick<TextStyle, 'fontVariant' | 'textTransform'>;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

export const textStyles: Record<TextStyleName, ScaleStyle> = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.4 },
  h1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3 },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2 },
  h3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: -0.1 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400', letterSpacing: 0 },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600', letterSpacing: 0 },
  bodySmall: { fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0.1 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.1 },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  button: { fontSize: 16, lineHeight: 20, fontWeight: '600', letterSpacing: 0 },
  buttonSmall: { fontSize: 14, lineHeight: 18, fontWeight: '600', letterSpacing: 0 },
  numericXL: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.4, fontVariant: tabular },
  numericL: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2, fontVariant: tabular },
  numeric: { fontSize: 16, lineHeight: 20, fontWeight: '600', letterSpacing: 0, fontVariant: tabular },
  numericSmall: { fontSize: 13, lineHeight: 16, fontWeight: '600', letterSpacing: 0, fontVariant: tabular },
};

/** Dynamic Type / font scale cap applied by the `Text` component (§2). */
export const MAX_FONT_SIZE_MULTIPLIER = 1.3;

/** Line-height multiplier for Noto Nastaliq Urdu (`ur` locale only, §2). */
export const URDU_LINE_HEIGHT_MULTIPLIER = 1.6;

/** A text style with its line height scaled for the Urdu (Nastaliq) font. */
export const withUrduLineHeight = (style: ScaleStyle): ScaleStyle => ({
  ...style,
  lineHeight: Math.round(style.lineHeight * URDU_LINE_HEIGHT_MULTIPLIER),
});

/**
 * @deprecated Legacy font families (pre-T-601). 'SF Pro Display' is not a reliable family
 * name; new code uses `textStyles`, which set no family. Removed once the remaining
 * consumers move to the `Text` component (T-602+).
 */
export const FontFamilies = {
  primary: Platform.select({
    ios: 'SF Pro Display',
    android: 'sans-serif',
    default: 'System',
  }) as string,
  secondary: Platform.select({
    ios: 'SF Pro Text',
    android: 'sans-serif-medium',
    default: 'System',
  }) as string,
};

/**
 * @deprecated Legacy type styles (pre-T-601), kept so current screens render unchanged.
 * Use `textStyles` (or `theme.typography`) instead.
 */
export const Typography = {
  display: {
    fontFamily: FontFamilies.primary,
    fontWeight: '800' as const,
    fontSize: 28,
    letterSpacing: 0.2,
    lineHeight: 34,
  },
  title: {
    fontFamily: FontFamilies.primary,
    fontWeight: '700' as const,
    fontSize: 22,
    letterSpacing: 0.2,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: FontFamilies.secondary,
    fontWeight: '500' as const,
    fontSize: 14,
    letterSpacing: 0.15,
    lineHeight: 20,
  },
  body: {
    fontFamily: FontFamilies.secondary,
    fontWeight: '400' as const,
    fontSize: 16,
    letterSpacing: 0.15,
    lineHeight: 22,
  },
  small: {
    fontFamily: FontFamilies.secondary,
    fontWeight: '500' as const,
    fontSize: 12,
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  button: {
    fontFamily: FontFamilies.primary,
    fontWeight: '600' as const,
    fontSize: 16,
    letterSpacing: 0.4,
    lineHeight: 20,
    textTransform: 'none' as const,
  },
};
