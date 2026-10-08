export const BrandColors = {
  primary: '#011c72ff',    // Royal blue
  secondary: 'orange',  // Premium golden-orange
  gold: '#D4AF37',       // Metallic gold accent
  platinum: '#C0C0C0',   // Soft silver/platinum
  success: '#058a0bee',    // Emerald green
  warning: '#ce0a0aff',    // Deep crimson red
  light: {
    background: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#1B1B1B',
    mutedText: '#5C5C5C',
  },
  dark: {
    background: '#0E0E0E',
    surface: '#1A1A1A',
    text: '#F5F5F5',
    mutedText: '#A1A1A1',
  },
} as const;

/**
 * Toast colours from DESIGN_SYSTEM 5.16 (inverse surface in light, raised surface in dark;
 * tone icons use the dark-tone values, which pass contrast on both fills).
 * Folded into the semantic tokens by T-601.
 */
export const ToastColors = {
  light: { background: '#0F1422', text: '#FFFFFF' },
  dark: { background: '#252D44', text: '#F2F4F9' },
  tone: {
    success: '#4ACB7E',
    error: '#FF7A7F',
    warning: '#F2B44B',
    info: '#7FA8F5',
    loading: '#9DB2F0',
  },
  action: '#9DB2F0',
  shadow: '#000000',
} as const;
