/**
 * WCAG 2.1 contrast helpers for opaque `#rrggbb` colours (DESIGN_SYSTEM §1.5). Used by the kit
 * gallery to print each token's contrast pair; tests assert the same numbers.
 */

/** Relative luminance of an opaque `#rrggbb` (alpha suffix ignored). NaN for anything else. */
export const relativeLuminance = (hex: string): number => {
  const raw = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(raw)) {
    return Number.NaN;
  }
  const [r, g, b] = [0, 2, 4].map(i => {
    const c = parseInt(raw.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Contrast ratio (1–21) between two opaque colours; NaN when either is not `#rrggbb`. */
export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** WCAG AA thresholds: 4.5 body text, 3 for large text, icons and UI boundaries. */
export const AA_TEXT = 4.5;
export const AA_NON_TEXT = 3;
