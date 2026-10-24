/**
 * Daily spend as vertical bars, drawn with `react-native-svg`.
 *
 * Two decisions worth recording:
 *
 * 1. **Zero-spend days are rendered.** Sending only the days that have expenses
 *    makes an irregular month look continuous — a gap silently becomes a day with
 *    spending. `daysInRange` fills the holes so the x-axis is real calendar time.
 * 2. **The chart is laid out from measured width, not `flex: 1`.** SVG children
 *    do not participate in flex sizing, so a `<Rect width="100%">` inside an
 *    unbounded `Svg` renders at an arbitrary intrinsic size and clips. The width
 *    is measured with `onLayout` and the geometry derived from it.
 */
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatCompactMoney } from '@/lib/currency';
import { dayOfMonth, daysInRange } from '@/lib/dates';
import { useTheme } from '@/hooks/use-theme';
import type { DayTotal } from '@/types/expense';

export interface BarChartProps {
  data: DayTotal[];
  /** Inclusive month bounds, so days with no spend still appear. */
  first: string;
  last: string;
  currency: string;
  height?: number;
  /** Budget line, drawn across the chart when set. */
  budgetLineMinor?: number;
}

const BAR_GAP = 3;
const AXIS_HEIGHT = 18;
const VALUE_HEIGHT = 14;

export function BarChart({
  data,
  first,
  last,
  currency,
  height = 150,
  budgetLineMinor = 0,
}: BarChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const days = useMemo(() => daysInRange(first, last), [first, last]);

  const byDay = useMemo(() => {
    const map = new Map(data.map((row) => [row.spentOn, row.totalMinor]));
    return days.map((day) => ({ day, value: map.get(day) ?? 0 }));
  }, [data, days]);

  const peak = byDay.reduce((max, row) => Math.max(max, row.value), 0);
  const maxValue = Math.max(peak, budgetLineMinor);

  const plotHeight = height - AXIS_HEIGHT - VALUE_HEIGHT;
  const slot = days.length > 0 ? width / days.length : 0;
  const barWidth = Math.max(2, slot - BAR_GAP);

  // Label only every ~5th day: at 390px, 30 labels overlap into a grey smear.
  const labelEvery = days.length > 20 ? 5 : days.length > 12 ? 3 : 1;

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ width: '100%' }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {/* Budget reference line, drawn behind the bars so bars stay readable. */}
          {budgetLineMinor > 0 && maxValue > 0 ? (
            <Line
              x1={0}
              x2={width}
              y1={VALUE_HEIGHT + plotHeight - (budgetLineMinor / maxValue) * plotHeight}
              y2={VALUE_HEIGHT + plotHeight - (budgetLineMinor / maxValue) * plotHeight}
              stroke={theme.negative}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ) : null}

          {byDay.map((row, index) => {
            const ratio = maxValue > 0 ? row.value / maxValue : 0;
            const barHeight = Math.max(row.value > 0 ? 2 : 0, ratio * plotHeight);
            const x = index * slot + BAR_GAP / 2;
            const y = VALUE_HEIGHT + plotHeight - barHeight;

            return (
              <Rect
                key={row.day}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={Math.min(3, barWidth / 2)}
                fill={row.value > 0 ? theme.accent : theme.surfaceAlt}
              />
            );
          })}

          {byDay.map((row, index) =>
            index % labelEvery === 0 || index === byDay.length - 1 ? (
              <SvgText
                key={`label-${row.day}`}
                x={index * slot + slot / 2}
                y={height - 4}
                fontSize={9}
                fill={theme.textMuted}
                textAnchor="middle"
              >
                {dayOfMonth(row.day)}
              </SvgText>
            ) : null,
          )}
        </Svg>
      ) : (
        // Reserve the height before measurement so the layout does not jump once
        // `onLayout` fires.
        <View style={{ height }} />
      )}

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: Spacing.one,
        }}
      >
        <ThemedText type="small" themeColor="textMuted">
          {peak > 0 ? `Peak ${formatCompactMoney(peak, currency)}` : 'No spend yet'}
        </ThemedText>
        {budgetLineMinor > 0 ? (
          <ThemedText type="small" themeColor="textMuted">
            Budget {formatCompactMoney(budgetLineMinor, currency)}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}
