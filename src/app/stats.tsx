/**
 * Stats: the month's shape, not another list.
 *
 * Both charts read the same `monthSummary` aggregate the home screen uses, so the
 * donut, the bars and the header total are three views of one query result.
 */
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/amount-text';
import { BarChart } from '@/components/bar-chart';
import { CategoryIcon } from '@/components/category-icon';
import { DonutChart } from '@/components/donut-chart';
import { MonthSwitcher } from '@/components/month-switcher';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { categoryInk } from '@/constants/palette';
import { useDatabase } from '@/db/provider';
import { useExpenses } from '@/hooks/use-expenses';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { formatMonthLabel, monthBounds } from '@/lib/dates';
import { percentShares } from '@/lib/money';

export default function StatsScreen() {
  const theme = useTheme();
  const { ready, error } = useDatabase();
  const { settings } = useSettings();
  const { summary, month, shiftMonth, loading } = useExpenses();

  if (error) {
    return (
      <Screen nav={false}>
        <ErrorState message={error} />
      </Screen>
    );
  }

  if (!ready || loading || !summary) {
    return (
      <Screen nav={false}>
        <LoadingState label="Adding it up…" />
      </Screen>
    );
  }

  const { first, last } = monthBounds(month);
  const hasSpend = summary.totalMinor > 0;

  // Only categories that actually have spend, so the donut is not mostly
  // invisible zero-value wedges.
  const slices = summary.byCategory
    .filter((row) => row.totalMinor > 0)
    .map((row) => ({ key: row.categoryId, value: row.totalMinor, color: row.color }));

  return (
    <Screen title="Stats" nav={false} stickyHeader={<MonthSwitcher month={month} onChange={shiftMonth} />}>
      {!hasSpend ? (
        <EmptyState
          icon="chart"
          title={`Nothing in ${formatMonthLabel(month)}`}
          body="Once you add an expense, the breakdown and daily chart appear here."
        />
      ) : (
        <>
          <ThemedView type="surface" style={styles.card}>
            <DonutChart
              slices={slices}
              totalMinor={summary.totalMinor}
              currency={settings.currency}
              caption={formatMonthLabel(month)}
            />
          </ThemedView>

          <ThemedView type="surface" style={styles.card}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardTitle}>
              BY CATEGORY
            </ThemedText>

            {summary.byCategory
              .filter((row) => row.totalMinor > 0)
              .map((row, index, rows) => {
                // `percentShares` rather than `Math.round(share * 100)` per row:
                // independent rounding summed to 101% for this very fixture, which
                // is visible to a user reading the legend.
                const shares = percentShares(rows.map((entry) => entry.totalMinor));
                const percent = shares[index] ?? 0;
                return (
                  <View key={row.categoryId} style={styles.legendRow}>
                    <View style={[styles.swatch, { backgroundColor: row.color }]} />
                    <CategoryIcon
                      name={row.icon}
                      size={16}
                      color={categoryInk(row.color, theme.isDark)}
                    />
                    <View style={styles.legendMiddle}>
                      <ThemedText type="smallBold" numberOfLines={1}>
                        {row.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textMuted">
                        {row.count} · {percent}%
                      </ThemedText>
                    </View>
                    <AmountText
                      minor={row.totalMinor}
                      currency={settings.currency}
                      size="smallBold"
                      style={styles.legendAmount}
                      numberOfLines={1}
                    />
                  </View>
                );
              })}
          </ThemedView>

          <ThemedView type="surface" style={styles.card}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardTitle}>
              BY DAY
            </ThemedText>
            {/* The budget line is drawn here too, so "am I over?" is answerable
                per-day and not only in total. */}
            <BarChart
              data={summary.byDay}
              first={first}
              last={last}
              currency={settings.currency}
              budgetLineMinor={0}
            />
          </ThemedView>

          <ThemedView type="surface" style={styles.card}>
            <View style={styles.statRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Largest single expense
              </ThemedText>
              <AmountText
                minor={summary.largestMinor}
                currency={settings.currency}
                size="smallBold"
              />
            </View>
            <View style={styles.statRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Average per expense
              </ThemedText>
              <AmountText
                minor={summary.count > 0 ? Math.round(summary.totalMinor / summary.count) : 0}
                currency={settings.currency}
                size="smallBold"
              />
            </View>
          </ThemedView>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    padding: Spacing.four,
    marginTop: Spacing.three,
  },
  cardTitle: { marginBottom: Spacing.three, letterSpacing: 0.5 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  // A 6px bar carries the category colour; the label beside it uses the darker
  // per-scheme ink so the text itself stays at 4.5:1.
  swatch: { width: 6, height: 22, borderRadius: Radius.pill },
  legendMiddle: { flex: 1, minWidth: 0 },
  legendAmount: { textAlign: 'right', maxWidth: 120 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
});
