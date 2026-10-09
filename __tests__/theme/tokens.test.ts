/** T-601: theme tokens hold exactly the DESIGN_SYSTEM values and meet WCAG AA. */
import { StyleSheet } from 'react-native';
import {
  DarkTheme,
  LightTheme,
  borderWidth,
  createTheme,
  darkColors,
  elevation,
  layout,
  lightColors,
  mapStyles,
  motion,
  navy,
  radius,
  reducedMotion,
  saffron,
  space,
  springs,
  statusBarStyles,
  textStyles,
  type SemanticColorName,
} from '../../src/theme';

/** WCAG 2.1 relative luminance of an opaque #rrggbb colour. */
const luminance = (hex: string): number => {
  const raw = hex.replace('#', '').slice(0, 6);
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(raw.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// DESIGN_SYSTEM §1.4, verbatim.
const SPEC: Record<SemanticColorName, [string, string]> = {
  background: ['#F4F6FA', '#0B0F1A'],
  surface: ['#FFFFFF', '#141A2A'],
  surfaceAlt: ['#EBEEF5', '#1D2438'],
  surfaceRaised: ['#FFFFFF', '#252D44'],
  surfacePressed: ['#EBEEF5', '#252D44'],
  textPrimary: ['#0F1422', '#F2F4F9'],
  textSecondary: ['#4C556C', '#B7BFD0'],
  textMuted: ['#626B82', '#9099B0'],
  textInverse: ['#FFFFFF', '#0F1422'],
  border: ['#DADFEA', '#2B3450'],
  borderStrong: ['#858EA5', '#626E90'],
  primary: ['#011C72', '#3D5FD0'],
  primaryPressed: ['#01155A', '#2E4FBF'],
  primaryText: ['#011C72', '#9DB2F0'],
  onPrimary: ['#FFFFFF', '#FFFFFF'],
  primarySoft: ['#EEF2FC', '#1C2850'],
  onPrimarySoft: ['#011C72', '#C9D5F7'],
  focusRing: ['#011C72', '#6A86DE'],
  success: ['#12753B', '#4ACB7E'],
  successSoft: ['#E5F4EA', '#12301F'],
  onSuccess: ['#FFFFFF', '#0B0F1A'],
  warning: ['#9A5200', '#F2B44B'],
  warningSoft: ['#FFF2DF', '#332407'],
  danger: ['#C0262D', '#FF7A7F'],
  dangerSoft: ['#FDEBEC', '#3A1517'],
  dangerFill: ['#C0262D', '#D23A40'],
  info: ['#1D58C4', '#7FA8F5'],
  infoSoft: ['#E7EFFD', '#15264A'],
  accent: ['#F59A23', '#F59A23'],
  onAccent: ['#0F1422', '#0F1422'],
  ratingStar: ['#C77700', '#F5A524'],
  ratingStarEmpty: ['#C3CAD9', '#2B3450'],
  overlay: ['rgba(9,12,22,0.48)', 'rgba(0,0,0,0.64)'],
  skeletonHighlight: ['#F4F6FA', '#252D44'],
  routeLine: ['#011C72', '#8EA6F2'],
  routeLineCasing: ['#FFFFFF', '#0B0F1A'],
  routeLineTraveled: ['#858EA5', '#626E90'],
  pickupPin: ['#15803D', '#3DD17A'],
  dropoffPin: ['#011C72', '#C9D5F7'],
  stopPin: ['#4C556C', '#B7BFD0'],
  driverMarker: ['#0F1422', '#F2F4F9'],
  userLocation: ['#1D58C4', '#7FA8F5'],
};

describe('palette (§1.1, §1.2)', () => {
  it('keeps the existing brand navy as navy-800', () => {
    expect(navy[800]).toBe('#011C72');
    expect(Object.keys(navy)).toEqual(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']);
    expect(saffron).toEqual({ 50: '#FFF4E5', 500: '#F59A23', 600: '#C77700', 700: '#A85A00' });
  });
});

describe('semantic colours (§1.4)', () => {
  it('light and dark define exactly the spec token set', () => {
    expect(Object.keys(lightColors).sort()).toEqual(Object.keys(SPEC).sort());
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(SPEC).sort());
  });

  it.each(Object.entries(SPEC))('%s has the spec light/dark values', (name, [light, darkValue]) => {
    const key = name as SemanticColorName;
    expect(lightColors[key]).toBe(light);
    expect(darkColors[key]).toBe(darkValue);
  });

  it('theme.colors carries every semantic token (accent is the legacy alias until T-602)', () => {
    for (const [theme, source] of [[LightTheme, lightColors], [DarkTheme, darkColors]] as const) {
      for (const key of Object.keys(SPEC) as SemanticColorName[]) {
        if (key !== 'accent') {
          expect(theme.colors[key]).toBe(source[key]);
        }
      }
      expect(theme.colors.accent).toBe(source.primaryText);
      expect(theme.colors.text).toBe(source.textPrimary);
      expect(theme.colors.mutedText).toBe(source.textSecondary);
    }
  });

  it('status bar style comes from the theme', () => {
    expect(statusBarStyles).toEqual({ light: 'dark-content', dark: 'light-content' });
    expect(LightTheme.statusBarStyle).toBe('dark-content');
    expect(DarkTheme.statusBarStyle).toBe('light-content');
  });
});

describe('contrast (§1.5, WCAG 2.1 AA)', () => {
  // [foreground, background, light ratio, dark ratio, minimum]
  const PAIRS: Array<[SemanticColorName, SemanticColorName, number, number, number]> = [
    ['textPrimary', 'surface', 18.37, 15.76, 4.5],
    ['textPrimary', 'background', 16.97, 17.39, 4.5],
    ['textSecondary', 'surface', 7.44, 9.39, 4.5],
    ['textSecondary', 'background', 6.87, 10.37, 4.5],
    ['textMuted', 'surface', 5.32, 6.09, 4.5],
    ['textMuted', 'background', 4.92, 6.71, 4.5],
    ['textMuted', 'surfaceAlt', 4.58, 5.41, 4.5],
    ['onPrimary', 'primary', 14.89, 5.61, 4.5],
    ['primaryText', 'surface', 14.89, 8.31, 4.5],
    ['onPrimarySoft', 'primarySoft', 13.29, 9.77, 4.5],
    ['success', 'surface', 5.78, 8.37, 4.5],
    ['success', 'successSoft', 5.08, 6.9, 4.5],
    ['warning', 'surface', 5.86, 9.42, 4.5],
    ['warning', 'warningSoft', 5.31, 8.17, 4.5],
    ['danger', 'surface', 5.9, 6.89, 4.5],
    ['danger', 'dangerSoft', 5.14, 6.42, 4.5],
    ['info', 'surface', 6.47, 7.29, 4.5],
    ['info', 'infoSoft', 5.6, 6.27, 4.5],
    ['onPrimary', 'dangerFill', 5.9, 4.75, 4.5],
    ['onAccent', 'accent', 8.33, 8.33, 4.5],
    ['borderStrong', 'surface', 3.28, 3.43, 3],
    ['ratingStar', 'surface', 3.46, 8.5, 3],
    // Filled success button label (AdvancedRideRequestPanel submit, BrandButton success).
    ['onSuccess', 'success', 5.78, 9.23, 4.5],
  ];

  it.each(PAIRS)('%s on %s: light %d, dark %d', (fg, bg, light, darkRatio, min) => {
    const l = contrast(lightColors[fg], lightColors[bg]);
    const d = contrast(darkColors[fg], darkColors[bg]);
    expect(l).toBeCloseTo(light, 1);
    expect(d).toBeCloseTo(darkRatio, 1);
    expect(l).toBeGreaterThanOrEqual(min);
    expect(d).toBeGreaterThanOrEqual(min);
  });

  it('map pins and route line pass on map land (§1.5)', () => {
    expect(contrast(lightColors.pickupPin, '#F2F2F2')).toBeCloseTo(4.48, 1);
    expect(contrast(darkColors.pickupPin, '#1D2230')).toBeCloseTo(8.01, 1);
    expect(contrast(lightColors.routeLine, '#F2F2F2')).toBeCloseTo(13.3, 1);
    expect(contrast(darkColors.routeLine, '#1D2230')).toBeCloseTo(6.71, 1);
  });

  it('legacy aliases still meet AA: accent text and disabled button label', () => {
    for (const theme of [LightTheme, DarkTheme]) {
      expect(contrast(theme.colors.accent, theme.colors.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.colors.disabledText, theme.colors.disabledFill)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('typography (§2)', () => {
  it('has every spec style with exact size / line height / weight / letter spacing', () => {
    const SPEC_TYPE: Record<string, [number, number, string, number]> = {
      display: [34, 41, '700', -0.4],
      h1: [28, 34, '700', -0.3],
      h2: [22, 28, '700', -0.2],
      h3: [20, 25, '600', -0.1],
      title: [17, 22, '600', -0.2],
      body: [16, 24, '400', 0],
      bodyStrong: [16, 24, '600', 0],
      bodySmall: [14, 20, '400', 0],
      caption: [12, 16, '500', 0.1],
      label: [13, 18, '600', 0.1],
      overline: [12, 16, '600', 0.6],
      button: [16, 20, '600', 0],
      buttonSmall: [14, 18, '600', 0],
      numericXL: [34, 40, '700', -0.4],
      numericL: [22, 28, '700', -0.2],
      numeric: [16, 20, '600', 0],
      numericSmall: [13, 16, '600', 0],
    };
    expect(Object.keys(textStyles).sort()).toEqual(Object.keys(SPEC_TYPE).sort());
    for (const [name, [fontSize, lineHeight, fontWeight, letterSpacing]] of Object.entries(SPEC_TYPE)) {
      const style = textStyles[name as keyof typeof textStyles];
      expect({ name, fontSize: style.fontSize, lineHeight: style.lineHeight, fontWeight: style.fontWeight, letterSpacing: style.letterSpacing })
        .toEqual({ name, fontSize, lineHeight, fontWeight, letterSpacing });
      expect(style).not.toHaveProperty('fontFamily');
      if (name.startsWith('numeric')) {
        expect(style.fontVariant).toEqual(['tabular-nums']);
      }
    }
    expect(textStyles.overline.textTransform).toBe('uppercase');
  });
});

describe('spacing, radii, borders (§3)', () => {
  it('spacing is the 4-pt scale', () => {
    expect(space).toEqual({ 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 });
    expect(layout.gutter).toBe(16);
    expect(layout.sectionGap).toBe(24);
    expect(layout.cardGap).toBe(12);
    expect(layout.touchTargetIOS).toBe(44);
  });

  it('radii and borders', () => {
    expect(radius).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, pill: 999 });
    expect(borderWidth).toEqual({ hairline: StyleSheet.hairlineWidth, thin: 1, focus: 2 });
  });
});

describe('elevation (§3.5)', () => {
  it('light levels use the spec iOS shadow and Android elevation', () => {
    const e = elevation.light;
    expect(e[0]).toMatchObject({ shadowOpacity: 0, elevation: 0 });
    expect(e[1]).toMatchObject({ shadowColor: '#0F1422', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 });
    expect(e[2]).toMatchObject({ shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 6 });
    expect(e[3]).toMatchObject({ shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 12 });
    expect(e[4]).toMatchObject({ shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 32, elevation: 16 });
  });

  it('dark mode has zero shadow opacity and keeps Android elevation', () => {
    for (const level of [0, 1, 2, 3, 4] as const) {
      expect(elevation.dark[level].shadowOpacity).toBe(0);
      expect(elevation.dark[level].elevation).toBe(elevation.light[level].elevation);
    }
    expect(createTheme('dark').elevation[2].shadowOpacity).toBe(0);
  });
});

describe('motion (§6)', () => {
  it('timing tokens', () => {
    expect(motion.instant).toEqual({ duration: 100, easing: { kind: 'out', curve: 'quad' } });
    expect(motion.fast).toEqual({ duration: 150, easing: { kind: 'out', curve: 'cubic' } });
    expect(motion.base).toEqual({ duration: 250, easing: { kind: 'bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 } });
    expect(motion.slow).toEqual({ duration: 350, easing: { kind: 'bezier', x1: 0.2, y1: 0, x2: 0, y2: 1 } });
    expect(motion.exit).toEqual({ duration: 200, easing: { kind: 'bezier', x1: 0.3, y1: 0, x2: 1, y2: 1 } });
  });

  it('springs and reduced motion', () => {
    expect(springs.press).toMatchObject({ damping: 18, stiffness: 300 });
    expect(springs.sheet).toEqual({ damping: 24, stiffness: 260, mass: 1, overshootClamping: false });
    expect(reducedMotion.pressScale).toBe(1);
    expect(reducedMotion.sheetSnap.duration).toBe(200);
    expect(reducedMotion.shimmer).toBe(false);
  });
});

describe('map styles (§9)', () => {
  it('light and dark land colours', () => {
    expect(mapStyles.light[0]).toEqual({ elementType: 'geometry', stylers: [{ color: '#F2F2F2' }] });
    expect(mapStyles.dark[0]).toEqual({ elementType: 'geometry', stylers: [{ color: '#1D2230' }] });
    expect(LightTheme.mapStyle).toBe(mapStyles.light);
    expect(DarkTheme.mapStyle).toBe(mapStyles.dark);
  });
});
