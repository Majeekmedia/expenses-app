/**
 * The donut, drawn by hand on `react-native-svg`.
 *
 * Why not a charting library: `victory-native` v43 requires
 * `react-native-skia@^2.15.1`, which is **not bundled in Expo Go**, so it would
 * force a custom development build and break the free QR workflow. Its only
 * Expo-Go-safe alternative (`react-native-gifted-charts`) is a reasonable fallback
 * if this ever needs area or stacked charts, but for one donut it is a dependency
 * that buys nothing.
 *
 * Geometry notes that matter more than they look:
 *  - SVG arcs are drawn with the **large-arc-flag**, which has to flip when a
 *    slice passes 180°. Getting it wrong silently renders a slice as its
 *    complement — the numbers look plausible and are simply wrong.
 *  - A slice of exactly 100% has no arc end distinct from its start, so it is
 *    drawn as a full circle instead of a zero-length path.
 *  - `strokeDasharray` on a circle would be shorter code, but it cannot produce
 *    the rounded, separated wedges the design needs.
 */
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { AmountText } from '@/components/amount-text';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface DonutSlice {
  key: string | number;
  value: number;
  color: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  totalMinor: number;
  currency: string;
  size?: number;
  thickness?: number;
  /** Centre label, e.g. "October". */
  caption?: string;
}

export function DonutChart({
  slices,
  totalMinor,
  currency,
  size = 200,
  thickness = 26,
  caption,
}: DonutChartProps) {
  const theme = useTheme();

  // Zero-value slices would render as zero-width wedges with a visible cap, so
  // they are dropped. If nothing is left, the ring is drawn as one muted circle:
  // an empty donut, not a blank square and not a NaN path.
  const positive = slices.filter((slice) => slice.value > 0);
  const sum = positive.reduce((acc, slice) => acc + slice.value, 0);

  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={theme.surfaceAlt}
          strokeWidth={thickness}
          fill="none"
        />

        {sum === 0 ? null : positive.length === 1 ? (
          // A single category is the whole ring. An arc from angle 0 to 360 has
          // identical endpoints and renders nothing, so use a circle.
          <Circle
            cx={cx}
            cy={cy}
            r={radius}
            stroke={positive[0].color}
            strokeWidth={thickness}
            fill="none"
          />
        ) : (
          positive.map((slice) => (
            <Path
              key={slice.key}
              d={wedgePath({
                cx,
                cy,
                radius,
                startRatio: ratioBefore(positive, slice),
                sweepRatio: slice.value / sum,
              })}
              stroke={slice.color}
              strokeWidth={thickness}
              strokeLinecap="butt"
              fill="none"
            />
          ))
        )}
      </Svg>

      {/* Centre readout. Absolutely positioned over the ring so the SVG size can
          change without re-flowing the text. */}
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
          justifyContent: 'center',
          width: size - thickness * 2,
        }}
      >
        <ThemedText type="small" themeColor="textSecondary">
          {caption ?? 'Total'}
        </ThemedText>
        <AmountText minor={totalMinor} currency={currency} size="subtitle" />
      </View>
    </View>
  );
}

function ratioBefore(slices: DonutSlice[], target: DonutSlice): number {
  const sum = slices.reduce((acc, slice) => acc + slice.value, 0);
  let ratio = 0;
  for (const slice of slices) {
    if (slice.key === target.key) break;
    ratio += slice.value / sum;
  }
  return ratio;
}

/**
 * An annular wedge as a stroked arc.
 *
 * Angles start at 12 o'clock (−90°) so the first category begins at the top,
 * which is what people expect from a spending donut.
 */
function wedgePath({
  cx,
  cy,
  radius,
  startRatio,
  sweepRatio,
}: {
  cx: number;
  cy: number;
  radius: number;
  startRatio: number;
  sweepRatio: number;
}): string {
  const startAngle = startRatio * Math.PI * 2 - Math.PI / 2;
  const endAngle = (startRatio + sweepRatio) * Math.PI * 2 - Math.PI / 2;

  const startX = cx + radius * Math.cos(startAngle);
  const startY = cy + radius * Math.sin(startAngle);
  const endX = cx + radius * Math.cos(endAngle);
  const endY = cy + radius * Math.sin(endAngle);

  // Must flip at 180°, or a slice wider than half the ring renders as the
  // remainder instead of itself.
  const largeArc = sweepRatio > 0.5 ? 1 : 0;

  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;
}
