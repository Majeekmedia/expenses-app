/**
 * Category icons, drawn as SVG.
 *
 * **Why not emoji.** Emoji come from a *platform font*. The same codepoint is a
 * colour glyph in a browser and a flat grey box on Android — that is exactly what
 * happened to App #2's weather icons, and the codepoints turned out to be correct
 * (`U+26C5 U+FE0F` with the variation selector intact). There is nothing to fix
 * at the emoji end, so the fix is to stop using emoji for anything that must look
 * the same on every device.
 *
 * `react-native-svg` is bundled in Expo Go, so this costs no extra dependency and
 * no custom dev build.
 *
 * Each icon is drawn on a 24×24 grid with `currentColor` strokes, so a caller only
 * has to set `color` and the geometry stays consistent.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type CategoryIconName =
  | 'food'
  | 'transport'
  | 'bills'
  | 'shopping'
  | 'health'
  | 'fun'
  | 'other';

export interface CategoryIconProps {
  name: string;
  size?: number;
  color: string;
  /** 2 is legible at 20–24px; 2.5 for the larger picker tiles. */
  strokeWidth?: number;
}

export function CategoryIcon({ name, size = 20, color, strokeWidth = 2 }: CategoryIconProps) {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {geometry(name, common, color)}
    </Svg>
  );
}

function geometry(
  name: string,
  common: {
    stroke: string;
    strokeWidth: number;
    strokeLinecap: 'round';
    strokeLinejoin: 'round';
    fill: string;
  },
  color: string,
) {
  switch (name) {
    // Fork and knife.
    case 'food':
      return (
        <>
          <Path d="M7 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" {...common} />
          <Path d="M9 12v9" {...common} />
          <Path d="M17 3c-1.7 1.2-2.5 3-2.5 5.2 0 1.7.8 2.8 2.5 3.3V21" {...common} />
        </>
      );

    // Bus front.
    case 'transport':
      return (
        <>
          <Rect x="4" y="4" width="16" height="13" rx="2" {...common} />
          <Path d="M4 11h16" {...common} />
          <Path d="M8 21v-2M16 21v-2" {...common} />
          <Circle cx="8" cy="14" r="1" fill={color} stroke="none" />
          <Circle cx="16" cy="14" r="1" fill={color} stroke="none" />
        </>
      );

    // Receipt with a torn base.
    case 'bills':
      return (
        <>
          <Path d="M6 3h12v17l-3-2-3 2-3-2-3 2z" {...common} />
          <Path d="M9 8h6M9 12h6" {...common} />
        </>
      );

    // Shopping bag.
    case 'shopping':
      return (
        <>
          <Path d="M5 8h14l-1 12H6z" {...common} />
          <Path d="M9 8V6a3 3 0 0 1 6 0v2" {...common} />
        </>
      );

    // Heart with a pulse line.
    case 'health':
      return (
        <>
          <Path
            d="M12 20s-7-4.3-7-9a3.8 3.8 0 0 1 7-2.1A3.8 3.8 0 0 1 19 11c0 4.7-7 9-7 9z"
            {...common}
          />
        </>
      );

    // Ticket.
    case 'fun':
      return (
        <>
          <Path d="M3 9V7h18v2a2.5 2.5 0 0 0 0 6v2H3v-2a2.5 2.5 0 0 0 0-6z" {...common} />
          <Path d="M12 7v10" {...common} strokeDasharray="2 3" />
        </>
      );

    // Three dots in a rounded square.
    case 'other':
    default:
      return (
        <>
          <Rect x="4" y="4" width="16" height="16" rx="4" {...common} />
          <Circle cx="9" cy="12" r="1" fill={color} stroke="none" />
          <Circle cx="12" cy="12" r="1" fill={color} stroke="none" />
          <Circle cx="15" cy="12" r="1" fill={color} stroke="none" />
        </>
      );
  }
}
