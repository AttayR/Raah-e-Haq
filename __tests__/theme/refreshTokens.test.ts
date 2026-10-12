/** UI-R1: v1.1 component tokens and the gallery's contrast pairs (DESIGN_SYSTEM §1.5, §3.3, §5.2, §5.3). */
import {
  AA_NON_TEXT,
  AA_TEXT,
  DarkTheme,
  LightTheme,
  componentTokens,
  contrastRatio,
  darkColors,
  lightColors,
  radius,
  type SemanticColorName,
} from '../../src/theme';
import { CONTRAST_PAIRS, thresholdFor } from '../../src/features/dev-gallery/contrastPairs';

describe('v1.1 component tokens', () => {
  it('makes every button a pill', () => {
    expect(componentTokens.button.radius).toBe(radius.pill);
    expect(componentTokens.button.height).toEqual({ lg: 56, md: 48, sm: 36 });
  });

  it('holds the header and tab-bar dimensions from §5.2 and §5.3', () => {
    expect(componentTokens.header.barHeight).toBe(56);
    expect(componentTokens.header.titleStart).toBe(56);
    expect(componentTokens.tabBar).toMatchObject({
      height: 60,
      itemMinWidth: 64,
      indicatorWidth: 56,
      indicatorWidthFrom: 32,
      indicatorHeight: 32,
      indicatorRadius: radius.pill,
      iconSize: 24,
      labelGap: 4,
      bottomPadding: 6,
    });
  });

  it('is part of both themes', () => {
    expect(LightTheme.components).toBe(componentTokens);
    expect(DarkTheme.components).toBe(componentTokens);
  });
});

describe('contrast pairs (kit gallery)', () => {
  it('covers every semantic colour token exactly once', () => {
    const tokens = CONTRAST_PAIRS.map(p => p.token).sort();
    expect(tokens).toEqual((Object.keys(lightColors) as SemanticColorName[]).sort());
  });

  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as const)('every text pair reaches 4.5:1 and every non-text pair 3:1 in %s mode', (_mode, colors) => {
    CONTRAST_PAIRS.forEach(pair => {
      const threshold = thresholdFor(pair.kind);
      if (threshold === null) {
        return;
      }
      const ratio = contrastRatio(colors[pair.fg], colors[pair.bg]);
      expect({ token: pair.token, pass: ratio >= threshold }).toEqual({ token: pair.token, pass: true });
    });
  });

  it('computes WCAG ratios', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#011C72', '#FFFFFF')).toBeCloseTo(14.89, 1);
    expect(Number.isNaN(contrastRatio('rgba(0,0,0,0.5)', '#FFFFFF'))).toBe(true);
    expect(AA_TEXT).toBe(4.5);
    expect(AA_NON_TEXT).toBe(3);
  });
});
