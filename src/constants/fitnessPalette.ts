import { omniColor } from './designSystem';

export type FitnessPalette = {
  bg: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  lime: string;
  limeSoft: string;
  limeDim: string;
  onLime: string;
  burn: string;
  active: string;
  hydrate: string;
  sleep: string;
  hot: string;
  wave: string;
  dangerDot: string;
  track: string;
};

const dark = omniColor.dark;
const light = omniColor.light;

/** Dark Veyron palette. `lime` is the cobalt brand accent. */
export const darkFitnessPalette: FitnessPalette = {
  bg: dark.bg,
  surface: dark.card,
  surfaceElevated: dark.muted,
  border: dark.border,
  text: dark.text,
  textSecondary: dark.secondary,
  textMuted: dark.caption,
  lime: dark.primary,
  limeSoft: dark.primaryLight,
  limeDim: dark.glaze,
  onLime: dark.onPrimary,
  burn: dark.danger,
  active: dark.warning,
  hydrate: dark.info,
  sleep: dark.info,
  hot: dark.danger,
  wave: dark.info,
  dangerDot: dark.danger,
  track: dark.muted,
};

export const lightFitnessPalette: FitnessPalette = {
  bg: light.bg,
  surface: light.card,
  surfaceElevated: light.muted,
  border: light.border,
  text: light.text,
  textSecondary: light.secondary,
  textMuted: light.caption,
  lime: light.primary,
  limeSoft: light.primaryLight,
  limeDim: light.glaze,
  onLime: light.onPrimary,
  burn: light.danger,
  active: light.warning,
  hydrate: light.info,
  sleep: light.info,
  hot: light.danger,
  wave: light.info,
  dangerDot: light.danger,
  track: light.border,
};

/** Default export stays the dark palette for modules that have not opted into theme yet. */
export const fitnessPalette = darkFitnessPalette;
