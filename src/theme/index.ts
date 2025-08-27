import { BrandColors } from './colors';


export type AppTheme = {
mode: 'light' | 'dark';
colors: {
primary: string;
secondary: string;
success: string;
warning: string;
background: string;
surface: string;
text: string;
mutedText: string;
border: string;
overlay: string;
};
};


export const LightTheme: AppTheme = {
mode: 'light',
colors: {
primary: BrandColors.primary,
secondary: BrandColors.secondary,
success: BrandColors.success,
warning: BrandColors.warning,
background: BrandColors.light.background,
surface: BrandColors.light.surface,
text: BrandColors.light.text,
mutedText: '#4B5563',
border: '#E5E7EB',
overlay: 'rgba(0,0,0,0.08)',
},
};


export const DarkTheme: AppTheme = {
mode: 'dark',
colors: {
primary: BrandColors.primary,
secondary: BrandColors.secondary,
success: BrandColors.success,
warning: BrandColors.warning,
background: BrandColors.dark.background,
surface: BrandColors.dark.surface,
text: BrandColors.dark.text,
mutedText: '#A3A3A3',
border: '#2E2E2E',
overlay: 'rgba(255,255,255,0.08)',
},
};