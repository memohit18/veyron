import { omniColor } from './designSystem';

export type ThemeMode = 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryEnd: string;
  primaryText: string;
  border: string;
  inputBackground: string;
  inputBorder: string;
  error: string;
  placeholder: string;
  accent: string;
  glow: string;
  pattern: string;
  socialButtonBg: string;
  checkboxBorder: string;
}

const light = omniColor.light;
const dark = omniColor.dark;

export const lightColors: ThemeColors = {
  background: light.bg,
  surface: light.card,
  text: light.text,
  textSecondary: light.secondary,
  primary: light.primary,
  primaryEnd: light.primaryDark,
  primaryText: light.onPrimary,
  border: light.border,
  inputBackground: light.muted,
  inputBorder: light.border,
  error: light.danger,
  placeholder: light.caption,
  accent: light.primaryLight,
  glow: light.glaze,
  pattern: light.glaze,
  socialButtonBg: light.card,
  checkboxBorder: light.border,
};

export const darkColors: ThemeColors = {
  background: dark.bg,
  surface: dark.card,
  text: dark.text,
  textSecondary: dark.secondary,
  primary: dark.primary,
  primaryEnd: dark.primaryDark,
  primaryText: dark.onPrimary,
  border: dark.border,
  inputBackground: dark.muted,
  inputBorder: dark.border,
  error: dark.danger,
  placeholder: dark.caption,
  accent: dark.primaryLight,
  glow: dark.glaze,
  pattern: dark.glaze,
  socialButtonBg: 'transparent',
  checkboxBorder: dark.border,
};

export const THEME_STORAGE_KEY = 'theme-mode';
