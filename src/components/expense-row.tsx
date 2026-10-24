/** One expense row. Amount right-aligned and fixed-width so the column cannot drift. */
import { Pressable, StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/amount-text';
import { CategoryIcon } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { dayOfMonth } from '@/lib/dates';
import { useTheme } from '@/hooks/use-theme';
import type { ExpenseWithCategory } from '@/types/expense';

export interface ExpenseRowProps {
  expense: ExpenseWithCategory;
  onPress: () => void;
}

export function ExpenseRow({ expense, onPress }: ExpenseRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${expense.categoryName}, ${expense.note || 'no note'}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? theme.surfaceAlt : 'transparent' },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.surface }]}>
        <CategoryIcon name={expense.categoryIcon} size={18} color={expense.categoryColor} />
      </View>

      {/* `flexShrink: 1` + `minWidth: 0` is what lets the middle column actually
          shrink; without it a long note pushes the amount off the right edge. */}
      <View style={styles.middle}>
        <ThemedText type="body" numberOfLines={1}>
          {expense.note.trim() === '' ? expense.categoryName : expense.note}
        </ThemedText>
        <ThemedText type="small" themeColor="textMuted" numberOfLines={1}>
          {expense.categoryName} · {dayOfMonth(expense.spentOn)}
        </ThemedText>
      </View>

      <AmountText
        minor={expense.amountMinor}
        currency={expense.currency}
        size="amount"
        style={styles.amount}
        numberOfLines={1}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.sm,
    gap: Spacing.three,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, minWidth: 0 },
  // Bounded so a very large amount cannot consume the whole row.
  amount: { textAlign: 'right', maxWidth: 130 },
});
