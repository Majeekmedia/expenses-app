/**
 * The data layer for expenses and categories.
 *
 * Every mutation re-reads the affected queries rather than patching an in-memory
 * copy. That is deliberate: the month total is a SQL aggregate, so a locally
 * patched array would show a number the database disagrees with — the classic
 * "the list says ₦4,300 but the header says ₦4,100" bug. Re-reading is cheap on a
 * local file and keeps the aggregate honest.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  archiveCategory,
  createCategory,
  createExpense,
  deleteExpense,
  listCategories,
  listExpensesForMonth,
  monthSummary,
  updateCategory,
  updateExpense,
  type ExpenseInput,
} from '@/db/repository';
import type { SqlDriver } from '@/db/schema';
import type { Category, ExpenseWithCategory, MonthSummary } from '@/types/expense';

interface ExpensesContextValue {
  month: string;
  setMonth: (month: string) => void;
  shiftMonth: (delta: number) => void;
  expenses: ExpenseWithCategory[];
  categories: Category[];
  summary: MonthSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addExpense: (input: ExpenseInput) => Promise<number>;
  editExpense: (id: number, input: ExpenseInput) => Promise<void>;
  removeExpense: (id: number) => Promise<void>;
  addCategory: (input: { name: string; color: string; icon: string }) => Promise<number>;
  editCategory: (id: number, input: { name: string; color: string; icon: string }) => Promise<void>;
  retireCategory: (id: number) => Promise<void>;
}

const ExpensesContext = createContext<ExpensesContextValue | null>(null);

export function ExpensesProvider({
  children,
  db,
  month,
  onMonthChange,
  currency,
}: {
  children: React.ReactNode;
  db: SqlDriver | null;
  month: string;
  onMonthChange: (month: string) => void;
  currency: string;
}) {
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<MonthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!db) return;
    try {
      // Sequential rather than `Promise.all`: `expo-sqlite` serialises statements
      // on one connection anyway, and this keeps a failure attributable to one
      // query instead of an opaque aggregate rejection.
      const nextCategories = await listCategories(db, true);
      const nextExpenses = await listExpensesForMonth(db, month);
      const nextSummary = await monthSummary(db, month, currency);

      setCategories(nextCategories);
      setExpenses(nextExpenses);
      setSummary(nextSummary);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [db, month, currency]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const addExpense = useCallback(
    async (input: ExpenseInput) => {
      if (!db) throw new Error('Database unavailable');
      const id = await createExpense(db, input);
      await load();
      return id;
    },
    [db, load],
  );

  const editExpense = useCallback(
    async (id: number, input: ExpenseInput) => {
      if (!db) throw new Error('Database unavailable');
      await updateExpense(db, id, input);
      await load();
    },
    [db, load],
  );

  const removeExpense = useCallback(
    async (id: number) => {
      if (!db) throw new Error('Database unavailable');
      await deleteExpense(db, id);
      await load();
    },
    [db, load],
  );

  const addCategory = useCallback(
    async (input: { name: string; color: string; icon: string }) => {
      if (!db) throw new Error('Database unavailable');
      const id = await createCategory(db, input);
      await load();
      return id;
    },
    [db, load],
  );

  const editCategory = useCallback(
    async (id: number, input: { name: string; color: string; icon: string }) => {
      if (!db) throw new Error('Database unavailable');
      await updateCategory(db, id, input);
      await load();
    },
    [db, load],
  );

  const retireCategory = useCallback(
    async (id: number) => {
      if (!db) throw new Error('Database unavailable');
      await archiveCategory(db, id);
      await load();
    },
    [db, load],
  );

  const value = useMemo<ExpensesContextValue>(
    () => ({
      month,
      setMonth: onMonthChange,
      shiftMonth: (delta: number) => {
        const [year, monthIndex] = month.split('-').map(Number);
        const date = new Date(year, monthIndex - 1 + delta, 1);
        const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        onMonthChange(next);
      },
      expenses,
      categories,
      summary,
      loading,
      error,
      refresh: load,
      addExpense,
      editExpense,
      removeExpense,
      addCategory,
      editCategory,
      retireCategory,
    }),
    [
      month,
      onMonthChange,
      expenses,
      categories,
      summary,
      loading,
      error,
      load,
      addExpense,
      editExpense,
      removeExpense,
      addCategory,
      editCategory,
      retireCategory,
    ],
  );

  return <ExpensesContext.Provider value={value}>{children}</ExpensesContext.Provider>;
}

export function useExpenses(): ExpensesContextValue {
  const context = useContext(ExpensesContext);
  if (!context) throw new Error('useExpenses must be used inside <ExpensesProvider>');
  return context;
}
