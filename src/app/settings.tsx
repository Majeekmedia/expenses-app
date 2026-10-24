/** Settings: currency picker, monthly budget, demo data, clear-all. */
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UiIcon } from '@/components/ui-icon';
import { Radius, Spacing } from '@/constants/theme';
import { CURRENCIES } from '@/lib/currency';
import { formatMoney } from '@/lib/currency';
import { exponentFor, parseAmountToMinor } from '@/lib/money';
import { useDatabase } from '@/db/provider';
import { useExpenses } from '@/hooks/use-expenses';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { clearAllData, seedDemoData } from '@/db/repository';
import { currentMonthKey } from '@/lib/dates';

export default function SettingsScreen() {
  const theme = useTheme();
  const { db, schemaVersion } = useDatabase();
  const { settings, setCurrency, setMonthlyBudget } = useSettings();
  const { refresh } = useExpenses();

  const [budgetText, setBudgetText] = useState(
    settings.monthlyBudgetMinor > 0
      ? (settings.monthlyBudgetMinor / 10 ** exponentFor(settings.currency)).toFixed(
          exponentFor(settings.currency),
        )
      : '',
  );
  const [status, setStatus] = useState<string | null>(null);

  async function saveBudget() {
    const minor = parseAmountToMinor(budgetText, settings.currency);
    await setMonthlyBudget(minor ?? 0);
    await refresh();
    setStatus(minor === null ? 'Budget cleared' : `Budget set to ${formatMoney(minor, settings.currency)}`);
  }

  async function addDemoData() {
    if (!db) return;
    const inserted = await seedDemoData(db, currentMonthKey(), settings.currency);
    await refresh();
    setStatus(`Added ${inserted} sample expenses`);
  }

  function confirmClear() {
    const run = async () => {
      if (!db) return;
      await clearAllData(db);
      await refresh();
      setStatus('All expenses and settings deleted');
    };

    // `Alert.alert` is a no-op on RN Web, so a destructive action there would
    // otherwise fire with no confirmation at all. `window.confirm` is the
    // correct analogue on that platform.
    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm('Delete every expense and reset settings? This cannot be undone.')
          : false;
      if (confirmed) void run();
      return;
    }

    Alert.alert('Delete everything?', 'This removes every expense and resets settings.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void run() },
    ]);
  }

  return (
    <Screen nav={false}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
        CURRENCY
      </ThemedText>
      <ThemedText type="small" themeColor="textMuted" style={styles.hint}>
        Sets how amounts are displayed. Existing expenses keep the currency they were saved in.
      </ThemedText>

      <ThemedView type="surface" style={styles.card}>
        <ScrollView
          // A nested horizontal list is the only place on this screen that is
          // allowed to overflow, and the clipping check exempts its children.
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.currencyRow}
        >
          {CURRENCIES.map((option) => {
            const selected = option.code === settings.currency;
            return (
              <Pressable
                key={option.code}
                onPress={() => void setCurrency(option.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.label} (${option.code})`}
                style={[
                  styles.currencyChip,
                  {
                    backgroundColor: selected ? theme.selected : theme.surfaceAlt,
                    borderColor: selected ? theme.accent : 'transparent',
                  },
                ]}
              >
                <ThemedText type="smallBold">{option.symbol}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {option.code}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <ThemedText type="small" themeColor="textMuted" style={styles.preview}>
          Preview: {formatMoney(1234567, settings.currency)}
        </ThemedText>
      </ThemedView>

      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
        MONTHLY BUDGET
      </ThemedText>
      <ThemedView type="surface" style={styles.card}>
        <View style={styles.budgetRow}>
          <TextInput
            value={budgetText}
            onChangeText={setBudgetText}
            placeholder="0.00"
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
            inputMode="decimal"
            accessibilityLabel="Monthly budget"
            style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
          />
          <Pressable
            onPress={() => void saveBudget()}
            accessibilityRole="button"
            accessibilityLabel="Save budget"
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Save
            </ThemedText>
          </Pressable>
        </View>
        <ThemedText type="small" themeColor="textMuted">
          Leave empty to clear the budget.
        </ThemedText>
      </ThemedView>

      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
        DATA
      </ThemedText>
      <ThemedView type="surface" style={styles.card}>
        <Pressable
          onPress={() => void addDemoData()}
          accessibilityRole="button"
          style={styles.actionRow}
        >
          <UiIcon name="plus" size={16} color={theme.textSecondary} />
          <ThemedText type="body" style={styles.flex}>
            Add sample data
          </ThemedText>
          <ThemedText type="small" themeColor="textMuted">
            16 expenses
          </ThemedText>
        </Pressable>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        <Pressable onPress={confirmClear} accessibilityRole="button" style={styles.actionRow}>
          <UiIcon name="trash" size={16} color={theme.negative} />
          <ThemedText type="body" themeColor="negative" style={styles.flex}>
            Delete all data
          </ThemedText>
        </Pressable>
      </ThemedView>

      {status ? (
        <ThemedText type="small" themeColor="positive" style={styles.sectionLabel}>
          {status}
        </ThemedText>
      ) : null}

      <ThemedText type="small" themeColor="textMuted" style={styles.footer}>
        Majeek Expenses · SQLite schema v{schemaVersion ?? '—'} · data stays on this device
      </ThemedText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: Spacing.four, marginBottom: Spacing.two, letterSpacing: 0.5 },
  hint: { marginBottom: Spacing.two },
  card: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.three },
  currencyRow: { gap: Spacing.two, paddingRight: Spacing.two },
  currencyChip: {
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.sm,
    borderWidth: 1,
    gap: 2,
  },
  preview: { marginTop: Spacing.one },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  input: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  saveButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  flex: { flex: 1, minWidth: 0 },
  divider: { height: 1 },
  footer: { marginTop: Spacing.five, textAlign: 'center' },
});
