/** Small UI glyphs, drawn rather than typed — the App #2 emoji lesson. */
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type UiIconName =
  | 'plus'
  | 'chevron-left'
  | 'chevron-right'
  | 'trash'
  | 'check'
  | 'close'
  | 'chart'
  | 'tag'
  | 'gear'
  | 'wallet';

export interface UiIconProps {
  name: UiIconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

export function UiIcon({ name, size = 20, color, strokeWidth = 2 }: UiIconProps) {
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
  name: UiIconName,
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
    case 'plus':
      return (
        <>
          <Line x1="12" y1="5" x2="12" y2="19" {...common} />
          <Line x1="5" y1="12" x2="19" y2="12" {...common} />
        </>
      );

    case 'chevron-left':
      return <Path d="M15 5l-7 7 7 7" {...common} />;

    case 'chevron-right':
      return <Path d="M9 5l7 7-7 7" {...common} />;

    case 'trash':
      return (
        <>
          <Path d="M4 7h16" {...common} />
          <Path d="M9 7V5h6v2" {...common} />
          <Path d="M6 7l1 13h10l1-13" {...common} />
          <Path d="M10 11v5M14 11v5" {...common} />
        </>
      );

    case 'check':
      return <Path d="M5 13l4 4 10-11" {...common} />;

    case 'close':
      return (
        <>
          <Line x1="6" y1="6" x2="18" y2="18" {...common} />
          <Line x1="18" y1="6" x2="6" y2="18" {...common} />
        </>
      );

    // Three bars of differing heights — a chart, not the word "Stats".
    case 'chart':
      return (
        <>
          <Rect x="4" y="13" width="4" height="7" rx="1" {...common} />
          <Rect x="10" y="8" width="4" height="12" rx="1" {...common} />
          <Rect x="16" y="4" width="4" height="16" rx="1" {...common} />
        </>
      );

    case 'tag':
      return (
        <>
          <Path d="M4 12.5V5a1 1 0 0 1 1-1h7.5L21 12.5 13.5 20z" {...common} />
          <Circle cx="8.5" cy="8.5" r="1.2" fill={color} stroke="none" />
        </>
      );

    case 'gear':
      return (
        <>
          <Circle cx="12" cy="12" r="3.2" {...common} />
          <Path
            d="M12 3.5v2.2M12 18.3v2.2M4.7 7.8l1.9 1.1M17.4 15.1l1.9 1.1M4.7 16.2l1.9-1.1M17.4 8.9l1.9-1.1"
            {...common}
          />
        </>
      );

    case 'wallet':
      return (
        <>
          <Rect x="3" y="6" width="18" height="13" rx="2.5" {...common} />
          <Path d="M3 10h18" {...common} />
          <Circle cx="17" cy="14.5" r="1.2" fill={color} stroke="none" />
        </>
      );

    default:
      return <Circle cx="12" cy="12" r="8" {...common} />;
  }
}
