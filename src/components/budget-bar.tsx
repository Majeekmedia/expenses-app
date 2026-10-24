/** Budget progress: one monthly cap, one bar, and an honest over/under state. */
import { StyleSheet, View } from 'react-native';

import { AmountText } from '@/components/amount-text';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { formatMoney } from '@/lib/currency';
import { useTheme } from '@/hooks/use-theme';

export interface BudgetBarProps {
  spentMinor: number;
  budgetMinor: number;
  currency: string;
}

export function BudgetBar({ spentMinor, budgetMinor, currency }: BudgetBarProps) {
  const theme = useTheme();

  if (budgetMinor <= 0) {
    return (
      <ThemedText type="small" themeColor="textMuted">
        No monthly budget set — add one in Settings to track it here.
      </ThemedText>
    );
  }

  const ratio = spentMinor / budgetMinor;
  const over = spentMinor > budgetMinor;
  const remaining = budgetMinor - spentMinor;

  // Cap the painted width at 100% but keep the *text* honest about the overage.
  // Scaling the bar past its track would overflow the card and clip on a 360px
  // screen (the exact class of bug App #2 shipped).
  const painted = Math.min(1, Math.max(0, ratio));

  return (
    <View>
      <View style={styles.labelRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {over ? 'Over budget' : 'Remaining'}
        </ThemedText>
        <AmountText
          minor={Math.abs(remaining)}
          currency={currency}
          size="smallBold"
          tone={over ? 'negative' : 'positive'}
        />
      </View>

      <View
        style={[styles.track, { backgroundColor: theme.surfaceAlt }]}
        // Accessibility: the bar is decorative, the numbers above carry the value.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View
          style={[
            styles.fill,
            {
              width: `${painted * 100}%`,
              backgroundColor: over ? theme.negative : theme.positive,
            },
          ]}
        />
      </View>

      <View style={styles.labelRow}>
        <ThemedText type="small" themeColor="textMuted">
          {formatMoney(spentMinor, currency)} of {formatMoney(budgetMinor, currency)}
        </ThemedText>
        <ThemedText type="small" themeColor="textMuted">
          {Math.round(ratio * 100)}%
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  track: {
    height: 10,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
});
