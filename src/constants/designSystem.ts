import type { TextStyle, ViewStyle } from 'react-native';

/**
 * Veyron Adaptive Modular.
 * Source of truth for color, type, radius, spacing, and elevation.
 * New UI reads these tokens. Do not invent a parallel palette.
 */

export const omniFont = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const omniColor = {
  light: {
    bg: '#F8FAFC',
    card: '#FFFFFF',
    muted: '#F1F5F9',
    subtle: '#EEF2FF',
    highlight: '#E0E7FF',
    border: '#E2E8F0',
    borderFocus: '#C7D2FE',
    text: '#0F172A',
    secondary: '#475569',
    caption: '#94A3B8',
    primary: '#2563EB',
    primaryDark: '#1D4ED8',
    primaryLight: '#60A5FA',
    glaze: 'rgba(37, 99, 235, 0.08)',
    onPrimary: '#FFFFFF',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#06B6D4',
    nav: 'rgba(255, 255, 255, 0.88)',
  },
  dark: {
    bg: '#0F172A',
    card: '#1E293B',
    muted: '#334155',
    subtle: '#1E293B',
    highlight: '#1E3A8A',
    border: '#334155',
    borderFocus: '#1D4ED8',
    text: '#F8FAFC',
    secondary: '#CBD5E1',
    caption: '#94A3B8',
    primary: '#60A5FA',
    primaryDark: '#2563EB',
    primaryLight: '#93C5FD',
    glaze: 'rgba(96, 165, 250, 0.16)',
    onPrimary: '#0F172A',
    success: '#34D399',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#22D3EE',
    nav: 'rgba(15, 23, 42, 0.88)',
  },
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const layout = {
  screenMaxWidth: 440,
  gutter: 16,
  stack: 12,
  stackLoose: 16,
  headerHeight: 64,
  dockHeight: 76,
  fabSize: 56,
  dockClearance: 96,
  cardPadding: 16,
  podPaddingX: 14,
  podPaddingY: 12,
  metricGap: 12,
  metricGapTight: 10,
} as const;

export const typeScale = {
  hero: {
    fontFamily: omniFont.extrabold,
    fontSize: 32,
    lineHeight: 35,
  },
  section: {
    fontFamily: omniFont.bold,
    fontSize: 18,
    lineHeight: 23,
  },
  subhead: {
    fontFamily: omniFont.semibold,
    fontSize: 15,
    lineHeight: 20,
  },
  body: {
    fontFamily: omniFont.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  caption: {
    fontFamily: omniFont.bold,
    fontSize: 11,
    letterSpacing: 0.55,
    lineHeight: 13,
    textTransform: 'uppercase',
  },
} as const satisfies Record<string, TextStyle>;

export const elevation = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
  },
  fab: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
} as const satisfies Record<string, ViewStyle>;
