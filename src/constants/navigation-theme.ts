/**
 * Navigation themes aligned with the app's own palette.
 *
 * The navigator paints its own background **behind and around** our screens. Expo
 * Router's defaults are `rgb(242, 242, 242)` light and `rgb(18, 18, 18)` dark,
 * so if a screen is pure white or pure black you get a visible flash on every
 * push and pop. Mapping the navigator onto the same two colours removes it.
 * See `docs/CONVENTIONS.md` §3 — all four layers must agree.
 */
import { DarkTheme, DefaultTheme } from 'expo-router';

import { Palette } from '@/constants/palette';

type NavigationTheme = typeof DefaultTheme;

export const AppLightTheme: NavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: Palette.light.background,
    // `card` paints the header, so matching it to the screen keeps them seamless.
    card: Palette.light.background,
    text: Palette.light.text,
    // Header hairline.
    border: Palette.light.border,
    primary: Palette.light.accent,
  },
};

export const AppDarkTheme: NavigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: Palette.dark.background,
    card: Palette.dark.background,
    text: Palette.dark.text,
    border: Palette.dark.border,
    primary: Palette.dark.accent,
  },
};
