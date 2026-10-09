import { darkColors, lightColors } from './tokens';
import { extra, navy } from './palette';

/**
 * @deprecated Pre-T-601 static brand colours. They do not follow the colour scheme and the
 * values predate DESIGN_SYSTEM §1 (`warning` here is a red, `secondary` is CSS 'orange').
 * New code reads `useAppTheme().theme.colors.<semantic token>`; the remaining importers move
 * over as their screens are redesigned (T-603 onward), then this object is deleted.
 */
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
    /** @deprecated use `theme.colors.primaryText` (dark value navy-300). */
    accent: '#9DB2F0',
  },
} as const;

/**
 * Toast colours (DESIGN_SYSTEM 5.16): inverse surface in light, raised surface in dark;
 * tone icons use the dark-tone values, which pass contrast on both fills. Values now come
 * from the semantic tokens; the shape is kept for ModernToast until T-608 replaces it.
 */
export const ToastColors = {
  light: { background: lightColors.textPrimary, text: lightColors.textInverse },
  dark: { background: darkColors.surfaceRaised, text: darkColors.textPrimary },
  tone: {
    success: darkColors.success,
    error: darkColors.danger,
    warning: darkColors.warning,
    info: darkColors.info,
    loading: navy[300],
  },
  action: navy[300],
  shadow: extra.black,
} as const;
