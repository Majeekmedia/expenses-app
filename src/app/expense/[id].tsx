/**
 * Add / edit an expense.
 *
 * `id === 'new'` (or `'new'` pushed by the FAB) creates; anything else edits.
 *
 * Two things here are deliberate:
 *
 * 1. **The amount is parsed, never `parseFloat`'d.** `Number('12.999')` becomes a
 *    float and then a rounding decision; `parseAmountToMinor` works on the string
 *    and produces an exact integer in the currency's minor unit.
 * 2. **The date is a plain `YYYY-MM-DD` text field with stepper buttons**, not a
 *    native date picker. The app needs the *local* day, and every date-picker
 *    binding returns a `Date` whose timezone handling differs between platforms —
 *    which is how a 23:30 expense ends up filed under tomorrow.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AmountText } from '@/components/amount-text';
import { CategoryPicker } from '@/components/category-picker';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UiIcon } from '@/components/ui-icon';
import { Radius, Spacing } from '@/constants/theme';
import { useExpenses } from '@/hooks/use-expenses';
import { useSettings } from '@/hooks/use-settings';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney, currencyOption } from '@/lib/currency';
import { fromDayString, shiftMonth, todayString, toDayString } from '@/lib/dates';
import { exponentFor, parseAmountToMinor } from '@/lib/money';
import { getExpense } from '@/db/repository';
import { useDatabase } from '@/db/provider';

export default function ExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const { db } = useDatabase();
  const { settings } = useSettings();
  const { categories, addExpense, editExpense, removeExpense } = useExpenses();

  const isNew = id === 'new' || id === undefined;
  const numericId = isNew ? null : Number(id);

  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [spentOn, setSpentOn] = useState(todayString());
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [saving, setSaving] = useState(false);

  const activeCategories = useMemo(
    () => categories.filter((category) => !category.archived),
    [categories],
  );

  // Default the category to the first active one, so a tap-heavy flow needs no
  // extra choice before saving.
  useEffect(() => {
    if (categoryId === null && activeCategories.length > 0) {
      setCategoryId(activeCategories[0].id);
    }
  }, [activeCategories, categoryId]);

  // Load the existing row when editing. `loaded` gates the form so the inputs do
  // not flash empty and then populate.
  useEffect(() => {
    if (isNew || !db || numericId === null) return;
    let cancelled = false;
    (async () => {
      const existing = await getExpense(db, numericId);
      if (cancelled || !existing) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const exponent = exponentFor(existing.currency);
      setAmountText(
        exponent === 0
          ? String(existing.amountMinor)
          : (existing.amountMinor / 10 ** exponent).toFixed(exponent),
      );
      setNote(existing.note);
      setSpentOn(existing.spentOn);
      setCategoryId(existing.categoryId);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, isNew, numericId]);

  const minor = parseAmountToMinor(amountText, settings.currency);
  const previewIsValid = minor !== null;

  async function save() {
    setError(null);

    if (minor === null) {
      setError(`Enter an amount greater than zero, e.g. ${formatMoney(125050, settings.currency)}`);
      return;
    }
    if (categoryId === null) {
      setError('Choose a category.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) {
      setError('Date must look like 2026-10-24.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        amountMinor: minor,
        categoryId,
        spentOn,
        note,
        // The currency is captured on the row at save time. Changing the setting
        // later re-renders the amount, but never rewrites what was stored.
        currency: settings.currency,
      };

      if (isNew) {
        await addExpense(payload);
      } else if (numericId !== null) {
        await editExpense(numericId, payload);
      }
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSaving(false);
    }
  }

  async function remove() {
    if (numericId === null) return;
    setSaving(true);
    try {
      await removeExpense(numericId);
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setSaving(false);
    }
  }

  function nudgeDay(delta: number) {
    const date = fromDayString(spentOn);
    date.setDate(date.getDate() + delta);
    setSpentOn(toDayString(date));
  }

  if (!loaded) {
    return (
      <Screen nav={false}>
        <View style={{ height: 40 }} />
      </Screen>
    );
  }

  return (
    <Screen nav={false}>
      <View style={styles.form}>
        <ThemedText type="small" themeColor="textSecondary">
          Amount ({currencyOption(settings.currency).code})
        </ThemedText>

        <View style={styles.amountRow}>
          <ThemedText type="display" themeColor="textSecondary">
            {currencyOption(settings.currency).symbol}
          </ThemedText>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0.00"
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
            inputMode="decimal"
            autoFocus={isNew}
            accessibilityLabel="Amount"
            style={[styles.amountInput, { color: theme.text }]}
          />
        </View>

        {previewIsValid ? (
          <ThemedText type="small" themeColor="textMuted">
            Saves as {formatMoney(minor, settings.currency)} ({minor} minor units)
          </ThemedText>
        ) : amountText.trim() === '' ? null : (
          <ThemedText type="small" themeColor="negative">
            Not a valid amount
          </ThemedText>
        )}

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
            Category
          </ThemedText>
          <CategoryPicker
            categories={activeCategories}
            selectedId={categoryId}
            onSelect={setCategoryId}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
            Date
          </ThemedText>
          <View style={styles.dateRow}>
            <Pressable
              onPress={() => nudgeDay(-1)}
              accessibilityRole="button"
              accessibilityLabel="Previous day"
              hitSlop={8}
              style={[styles.stepper, { backgroundColor: theme.surface }]}
            >
              <UiIcon name="chevron-left" size={16} color={theme.text} />
            </Pressable>

            <TextInput
              value={spentOn}
              onChangeText={setSpentOn}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Date"
              style={[styles.dateInput, { color: theme.text, backgroundColor: theme.surface }]}
            />

            <Pressable
              onPress={() => nudgeDay(1)}
              accessibilityRole="button"
              accessibilityLabel="Next day"
              hitSlop={8}
              style={[styles.stepper, { backgroundColor: theme.surface }]}
            >
              <UiIcon name="chevron-right" size={16} color={theme.text} />
            </Pressable>

            <Pressable
              onPress={() => setSpentOn(todayString())}
              accessibilityRole="button"
              style={[styles.todayButton, { backgroundColor: theme.surface }]}
            >
              <ThemedText type="smallBold" themeColor="textSecondary">
                Today
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
            Note (optional)
          </ThemedText>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="What was it for?"
            placeholderTextColor={theme.textMuted}
            accessibilityLabel="Note"
            style={[styles.input, { color: theme.text, backgroundColor: theme.surface }]}
          />
        </View>

        {error ? (
          <ThemedText type="small" themeColor="negative" style={styles.label}>
            {error}
          </ThemedText>
        ) : null}

        <Pressable
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={isNew ? 'Save expense' : 'Update expense'}
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: theme.accent, opacity: saving ? 0.6 : pressed ? 0.9 : 1 },
          ]}
        >
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            {isNew ? 'Save expense' : 'Save changes'}
          </ThemedText>
        </Pressable>

        {!isNew ? (
          <Pressable
            onPress={remove}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Delete expense"
            style={({ pressed }) => [
              styles.secondary,
              { borderColor: theme.negative, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <UiIcon name="trash" size={16} color={theme.negative} />
            <ThemedText type="smallBold" themeColor="negative">
              Delete expense
            </ThemedText>
          </Pressable>
        ) : null}

        {/* Monthly total reference, so the form shows where the money is going
            without navigating away. */}
        <ThemedView type="surface" style={styles.hint}>
          <AmountText
            minor={settings.monthlyBudgetMinor}
            currency={settings.currency}
            size="smallBold"
            tone="textSecondary"
          />
          <ThemedText type="small" themeColor="textMuted">
            {' monthly budget'}
          </ThemedText>
        </ThemedView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { paddingTop: Spacing.four, gap: Spacing.two },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderBottomWidth: 2,
    borderBottomColor: '#DFE3E8',
    paddingBottom: Spacing.two,
  },
  // `flex: 1` + `minWidth: 0`: RN Web's inputs default to an intrinsic width that
  // overflows a 360px container once the symbol sits beside them.
  amountInput: { flex: 1, minWidth: 0, fontSize: 34, lineHeight: 40, fontWeight: '700' },
  field: { marginTop: Spacing.four },
  label: { marginBottom: Spacing.two },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepper: {
    width: 36,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateInput: {
    flex: 1,
    minWidth: 0,
    height: 40,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
    textAlign: 'center',
  },
  todayButton: {
    height: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 44,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  primary: {
    marginTop: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  secondary: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
    borderWidth: 1,
  },
  hint: {
    marginTop: Spacing.four,
    padding: Spacing.three,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
