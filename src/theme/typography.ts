import { Platform } from 'react-native';
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


