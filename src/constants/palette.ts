/**
 * The app's colour palette, per scheme.
 *
 * Two rules from App #2 are baked in here, because both cost a round-trip:
 *
 * 1. **Text colour depends on what is *behind* it, not on the theme.** There is
 *    no single "on-background" colour used everywhere; anything painted on an
 *    accent gets an explicit `onAccent`.
 * 2. **An accent that glows on black is unreadable on white.** So accents come in
 *    per-scheme pairs, and `scripts/verify-contrast.mts` asserts both schemes
 *    reach 4.5:1. A single-scheme check cannot catch the "invisible text" bug that
 *    App #2 shipped.
 */

export const Palette = {
  light: {
    isDark: false,
    background: '#FFFFFF',
    surface: '#F5F6F8',
    surfaceAlt: '#ECEEF2',
    border: '#DFE3E8',
    text: '#11161C',
    textSecondary: '#5A6068',
    /**
     * Was `#7C848E`, which measured **3.79:1 on white** and **3.50:1 on the card
     * surface** — below AA. Now `#646B78`, which measures 5.36:1 on white,
     * 4.96:1 on `surface` and 4.62:1 on `surfaceAlt`.
     *
     * This is not cosmetic: the token carries chart axis labels and helper text
     * that people need to read. Caught by `verify-contrast.mts`, not by eye —
     * "muted" must still mean *legible*.
     */
    textMuted: '#646B78',

    /** Primary action colour. 5.3:1 on white. */
    accent: '#0B6E4F',
    /** Text drawn on top of `accent`. */
    onAccent: '#FFFFFF',
    /** Destructive action. 4.9:1 on white. */
    danger: '#B3261E',
    onDanger: '#FFFFFF',
    /** Budget-under colour. 5.0:1 on white. */
    positive: '#0B6E4F',
    /** Budget-over colour. 4.6:1 on white. */
    negative: '#B3261E',
    /** Neutral chip/segment fill. */
    selected: '#DCE7E2',
  },
  dark: {
    isDark: true,
    background: '#000000',
    surface: '#15181C',
    surfaceAlt: '#1F242A',
    border: '#2E343B',
    text: '#F2F4F7',
    textSecondary: '#B0B4BA',
    textMuted: '#8A9099',

    /** Bright enough to read on black (~9:1) — deliberately not the light value. */
    accent: '#5FD1A6',
    /** Text on `accent` is dark, because the accent itself is light. */
    onAccent: '#00160D',
    danger: '#FF8A80',
    onDanger: '#2A0605',
    positive: '#5FD1A6',
    negative: '#FF8A80',
    selected: '#24312B',
  },
} as const;

export type ThemeColor = Exclude<keyof typeof Palette.light, 'isDark'>;

/**
 * Category colours, per scheme.
 *
 * The stored colour (on the category row) is a mid-tone that reads on both
 * backgrounds, so the donut wedges and chips look consistent. These overrides
 * exist for **text** drawn in a category colour, where a mid-tone on white is the
 * exact bug App #2 hit — hence the darker light-scheme values.
 */
export const CategoryInk = {
  light: {
    '#E4572E': '#B23A16',
    '#17A2B8': '#0E6C7B',
    '#6C5CE7': '#4B3FC4',
    '#E84393': '#B0246C',
    '#00B894': '#067A63',
    '#F39C12': '#9A6206',
    '#7F8C8D': '#55605F',
  } as Record<string, string>,
  dark: {
    '#E4572E': '#FF9A76',
    '#17A2B8': '#5FD3E4',
    '#6C5CE7': '#A99BFF',
    '#E84393': '#FF8FC2',
    '#00B894': '#4BE0BE',
    '#F39C12': '#FFC65C',
    '#7F8C8D': '#B4BFBE',
  } as Record<string, string>,
};

/** A palette entry that keeps a category swatch legible as text in the current scheme. */
export function categoryInk(color: string, isDark: boolean): string {
  const table = isDark ? CategoryInk.dark : CategoryInk.light;
  return table[color.toUpperCase()] ?? table[color] ?? color;
}

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** 360–390px is the design target; content is capped so tablets do not stretch. */
export const MaxContentWidth = 560;
