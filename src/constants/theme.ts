/** Theme colours plus the type scale. Imported by every component that needs colour. */
import '@/global.css';

import { Platform, type TextStyle } from 'react-native';

import { Palette, Spacing, Radius, MaxContentWidth, type ThemeColor } from '@/constants/palette';

export const Colors = Palette;

// Re-exported so components can import every theme concern from one module.
export type { ThemeColor };

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  default: { sans: 'normal', mono: 'monospace' },
  web: { sans: 'var(--font-display)', mono: 'var(--font-mono)' },
});

export const Type = {
  /** Screen title. 20px, not the template's 48 — see CONVENTIONS §4 (360px rule). */
  title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  /** The month total, the one number the screen is about. */
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  subtitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  smallBold: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  /**
   * Amounts in lists: tabular figures stop the decimal point jittering per row.
   *
   * `fontVariant` is a mutable `FontVariant[]` rather than `as const`, because
   * `TextStyle` requires a mutable array — a `readonly ['tabular-nums']` is not
   * assignable and fails the whole style object at the `Text` call site.
   */
  amount: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    fontVariant: ['tabular-nums'] as ('tabular-nums' | 'small-caps')[],
  },
} as const satisfies Record<string, TextStyle>;

export { Spacing, Radius, MaxContentWidth };
