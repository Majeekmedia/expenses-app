/**
 * Home: this month's total, the budget bar, and the expense list.
 *
 * The total comes from `monthSummary` (a SQL aggregate), not from summing the
 * list above it. That is the point of the app: the number and the rows cannot
 * disagree, because they are two readings of the same table.
 */
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/amount-text';
import { BudgetBar } from '@/components/budget-bar';
import { ExpenseRow } from '@/components/expense-row';
import { MonthSwitcher } from '@/components/month-switcher';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/state-views';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UiIcon } from '@/components/ui-icon';
import { Pressable } from 'react-native';
import { Radius, Spacing } from '@/constants/theme';
import { useDatabase } from '@/db/provider';
import { useExpenses } from '@/hooks/use-expenses';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { ready, error } = useDatabase();
  const { settings } = useSettings();
  const { summary, expenses, loading, month, shiftMonth } = useExpenses();

  // The database error is checked before `loading`, because a failure leaves
  // `loading` false and a screen with no rows — which reads as "no expenses".
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
        <LoadingState label="Opening your expenses…" />
      </Screen>
    );
  }

  return (
    <Screen stickyHeader={<MonthSwitcher month={month} onChange={shiftMonth} />}>
      <View style={styles.totalBlock}>
        <ThemedText type="small" themeColor="textSecondary">
          Spent this month
        </ThemedText>
        <AmountText
          minor={summary.totalMinor}
          currency={settings.currency}
          size="display"
        />
        <ThemedText type="small" themeColor="textMuted">
          {summary.count === 0
            ? 'No expenses recorded'
            : `${summary.count} expense${summary.count === 1 ? '' : 's'}`}
        </ThemedText>
      </View>

      <ThemedView type="surface" style={styles.card}>
        <BudgetBar
          spentMinor={summary.totalMinor}
          budgetMinor={settings.monthlyBudgetMinor}
          currency={settings.currency}
        />
      </ThemedView>

      <View style={styles.sectionHeader}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          EXPENSES
        </ThemedText>
      </View>

      {expenses.length === 0 ? (
        <EmptyState
          title="Nothing yet this month"
          body="Tap Add expense to record your first one. Everything stays on this device."
        />
      ) : (
        <View>
          {expenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              onPress={() => router.push(`/expense/${expense.id}`)}
            />
          ))}
        </View>
      )}

      <Pressable
        onPress={() => router.push('/expense/new')}
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: pressed ? theme.accent : theme.accent, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <UiIcon name="plus" size={20} color={theme.onAccent} />
        <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
          Add expense
        </ThemedText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  totalBlock: { marginTop: Spacing.four, marginBottom: Spacing.four, gap: Spacing.one },
  card: {
    borderRadius: Radius.md,
    padding: Spacing.four,
    marginBottom: Spacing.four,
  },
  sectionHeader: { marginBottom: Spacing.two },
  fab: {
    marginTop: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
});
