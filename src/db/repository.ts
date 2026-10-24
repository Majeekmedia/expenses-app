/**
 * Every SQL statement the app runs.
 *
 * Keeping them here rather than inline in screens buys three things:
 *  - one place to check parameterisation (user input is only ever bound, never
 *    interpolated — `exec` is reserved for DDL),
 *  - one place to change the schema's effect on queries,
 *  - and a module that can be exercised against a real SQLite engine in Node,
 *    which is how the aggregates are verified.
 */
import type {
  Category,
  CategoryTotal,
  DayTotal,
  Expense,
  ExpenseWithCategory,
  MonthSummary,
  Settings,
} from '@/types/expense';
import { monthBounds } from '@/lib/dates';
import type { SqlDriver } from '@/db/schema';

/** Raw row shapes, as SQLite returns them (`snake_case`, integers for booleans). */
interface CategoryRow {
  id: number;
  name: string;
  color: string;
  icon: string;
  sort: number;
  archived: number;
}

interface ExpenseRow {
  id: number;
  amount_minor: number;
  category_id: number;
  spent_on: string;
  note: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

interface ExpenseJoinedRow extends ExpenseRow {
  category_name: string;
  category_color: string;
  category_icon: string;
}

const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  color: row.color,
  icon: row.icon,
  sort: row.sort,
  // SQLite has no boolean type; the column is constrained to (0, 1).
  archived: row.archived === 1,
});

const toExpense = (row: ExpenseRow): Expense => ({
  id: row.id,
  amountMinor: row.amount_minor,
  categoryId: row.category_id,
  spentOn: row.spent_on,
  note: row.note,
  currency: row.currency,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toExpenseJoined = (row: ExpenseJoinedRow): ExpenseWithCategory => ({
  ...toExpense(row),
  categoryName: row.category_name,
  categoryColor: row.category_color,
  categoryIcon: row.category_icon,
});

/* ------------------------------------------------------------------ categories */

export async function listCategories(db: SqlDriver, includeArchived = false): Promise<Category[]> {
  const rows = await db.all<CategoryRow>(
    `SELECT id, name, color, icon, sort, archived
       FROM categories
      ${includeArchived ? '' : 'WHERE archived = 0'}
      ORDER BY sort ASC, name ASC`,
  );
  return rows.map(toCategory);
}

export async function createCategory(
  db: SqlDriver,
  input: { name: string; color: string; icon: string },
): Promise<number> {
  const next = await db.first<{ next: number }>(
    'SELECT COALESCE(MAX(sort), -1) + 1 AS next FROM categories',
  );
  const result = await db.run(
    'INSERT INTO categories (name, color, icon, sort, archived) VALUES (?, ?, ?, ?, 0)',
    [input.name.trim(), input.color, input.icon, next?.next ?? 0],
  );
  return result.lastInsertRowId;
}

export async function updateCategory(
  db: SqlDriver,
  id: number,
  input: { name: string; color: string; icon: string },
): Promise<void> {
  await db.run('UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?', [
    input.name.trim(),
    input.color,
    input.icon,
    id,
  ]);
}

/**
 * Archives rather than deletes.
 *
 * A hard delete would orphan every expense that referenced the category (the
 * foreign key only guarantees the row *existed*; `ON DELETE` was deliberately
 * left at the default so this cannot silently cascade). Archiving keeps history
 * readable and the picker clean.
 */
export async function archiveCategory(db: SqlDriver, id: number): Promise<void> {
  await db.run('UPDATE categories SET archived = 1 WHERE id = ?', [id]);
}

export async function unarchiveCategory(db: SqlDriver, id: number): Promise<void> {
  await db.run('UPDATE categories SET archived = 0 WHERE id = ?', [id]);
}

/* -------------------------------------------------------------------- expenses */

export async function listExpensesForMonth(
  db: SqlDriver,
  month: string,
): Promise<ExpenseWithCategory[]> {
  const { first, last } = monthBounds(month);
  const rows = await db.all<ExpenseJoinedRow>(
    `SELECT e.id, e.amount_minor, e.category_id, e.spent_on, e.note, e.currency,
            e.created_at, e.updated_at,
            c.name AS category_name, c.color AS category_color, c.icon AS category_icon
       FROM expenses e
       JOIN categories c ON c.id = e.category_id
      WHERE e.spent_on BETWEEN ? AND ?
      ORDER BY e.spent_on DESC, e.id DESC`,
    [first, last],
  );
  return rows.map(toExpenseJoined);
}

export async function getExpense(db: SqlDriver, id: number): Promise<Expense | null> {
  const row = await db.first<ExpenseRow>(
    `SELECT id, amount_minor, category_id, spent_on, note, currency, created_at, updated_at
       FROM expenses WHERE id = ?`,
    [id],
  );
  return row ? toExpense(row) : null;
}

export interface ExpenseInput {
  amountMinor: number;
  categoryId: number;
  spentOn: string;
  note: string;
  currency: string;
}

export async function createExpense(db: SqlDriver, input: ExpenseInput): Promise<number> {
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO expenses (amount_minor, category_id, spent_on, note, currency, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.amountMinor,
      input.categoryId,
      input.spentOn,
      input.note.trim(),
      input.currency,
      now,
      now,
    ],
  );
  return result.lastInsertRowId;
}

export async function updateExpense(
  db: SqlDriver,
  id: number,
  input: ExpenseInput,
): Promise<void> {
  await db.run(
    `UPDATE expenses
        SET amount_minor = ?, category_id = ?, spent_on = ?, note = ?, currency = ?, updated_at = ?
      WHERE id = ?`,
    [
      input.amountMinor,
      input.categoryId,
      input.spentOn,
      input.note.trim(),
      input.currency,
      new Date().toISOString(),
      id,
    ],
  );
}

export async function deleteExpense(db: SqlDriver, id: number): Promise<number> {
  const result = await db.run('DELETE FROM expenses WHERE id = ?', [id]);
  return result.changes;
}

/* ------------------------------------------------------------------ aggregates */

/**
 * The month summary, computed in SQL rather than by reducing over a list.
 *
 * This is the app's "derived state" teaching point. Summing client-side would
 * mean the total on `/` and the total on `/stats` could disagree if one screen
 * filtered first; here both read the same aggregate.
 *
 * `COALESCE` matters: with no expenses, `SUM` returns `NULL`, and `null + 0` is
 * `0` in JS but `null` in arithmetic that goes through JSON — the chart would
 * then try to draw a `NaN` wedge.
 */
export async function monthSummary(
  db: SqlDriver,
  month: string,
  currency: string,
): Promise<MonthSummary> {
  const { first, last } = monthBounds(month);

  const totals = await db.first<{ total: number | null; count: number | null; largest: number | null }>(
    `SELECT COALESCE(SUM(amount_minor), 0) AS total,
            COUNT(*)                       AS count,
            COALESCE(MAX(amount_minor), 0) AS largest
       FROM expenses
      WHERE spent_on BETWEEN ? AND ?`,
    [first, last],
  );

  // LEFT JOIN from categories so a category with zero spend still appears in the
  // breakdown — the donut legend and the categories screen both rely on that.
  const categoryRows = await db.all<{
    category_id: number;
    name: string;
    color: string;
    icon: string;
    total_minor: number;
    count: number;
  }>(
    `SELECT c.id            AS category_id,
            c.name          AS name,
            c.color         AS color,
            c.icon          AS icon,
            COALESCE(SUM(e.amount_minor), 0) AS total_minor,
            COUNT(e.id)     AS count
       FROM categories c
       LEFT JOIN expenses e
         ON e.category_id = c.id AND e.spent_on BETWEEN ? AND ?
      GROUP BY c.id, c.name, c.color, c.icon
      ORDER BY total_minor DESC, c.name ASC`,
    [first, last],
  );

  const dayRows = await db.all<{ spent_on: string; total_minor: number }>(
    `SELECT spent_on, SUM(amount_minor) AS total_minor
       FROM expenses
      WHERE spent_on BETWEEN ? AND ?
      GROUP BY spent_on
      ORDER BY spent_on ASC`,
    [first, last],
  );

  const byCategory: CategoryTotal[] = categoryRows.map((row) => ({
    categoryId: row.category_id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    totalMinor: row.total_minor,
    count: row.count,
  }));

  const byDay: DayTotal[] = dayRows.map((row) => ({
    spentOn: row.spent_on,
    totalMinor: row.total_minor,
  }));

  return {
    month,
    totalMinor: totals?.total ?? 0,
    count: totals?.count ?? 0,
    largestMinor: totals?.largest ?? 0,
    byCategory,
    byDay,
    currency,
  };
}

/** All months that have at least one expense, newest first — drives the month switcher. */
export async function monthsWithExpenses(db: SqlDriver): Promise<string[]> {
  const rows = await db.all<{ month: string }>(
    `SELECT DISTINCT substr(spent_on, 1, 7) AS month
       FROM expenses
      ORDER BY month DESC`,
  );
  return rows.map((row) => row.month);
}

/* -------------------------------------------------------------------- settings */

export async function getSettings(db: SqlDriver): Promise<Settings | null> {
  const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
  if (rows.length === 0) return null;

  const map = new Map(rows.map((row) => [row.key, row.value]));
  const currency = map.get('currency');
  const budget = map.get('monthlyBudgetMinor');
  if (!currency || budget === undefined) return null;

  return { currency, monthlyBudgetMinor: Number(budget) };
}

export async function saveSettings(db: SqlDriver, settings: Settings): Promise<void> {
  await db.run(
    `INSERT INTO settings (key, value) VALUES ('currency', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [settings.currency],
  );
  await db.run(
    `INSERT INTO settings (key, value) VALUES ('monthlyBudgetMinor', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(settings.monthlyBudgetMinor)],
  );
}

/* ------------------------------------------------------------------- lifecycle */

/** Wipes every expense and setting, keeping the category seed. Used by "Clear all". */
export async function clearAllData(db: SqlDriver): Promise<void> {
  await db.run('DELETE FROM expenses');
  await db.run('DELETE FROM settings');
}

/**
 * Deterministic demo data, so screenshots and the demo video are reproducible.
 *
 * Amounts are hand-picked rather than random: a seeded RNG would still drift if
 * the row-insert order changed, and a chart that renders differently on every
 * run cannot be compared against a stored hash.
 */
export async function seedDemoData(db: SqlDriver, month: string, currency: string): Promise<number> {
  const categories = await listCategories(db);
  if (categories.length === 0) return 0;

  const plan: { day: number; minor: number; note: string; category: string }[] = [
    { day: 2, minor: 485000, note: 'Monthly rent top-up', category: 'Bills' },
    { day: 3, minor: 1250000, note: 'Groceries', category: 'Food' },
    { day: 3, minor: 18000, note: 'Danfo fare', category: 'Transport' },
    { day: 5, minor: 75000, note: 'Lunch with Tunde', category: 'Food' },
    { day: 6, minor: 260000, note: 'Data plan', category: 'Bills' },
    { day: 8, minor: 89000, note: 'Pharmacy', category: 'Health' },
    { day: 9, minor: 1450000, note: 'New headphones', category: 'Shopping' },
    { day: 11, minor: 32000, note: 'Suya', category: 'Food' },
    { day: 12, minor: 15000, note: 'Keke', category: 'Transport' },
    { day: 14, minor: 480000, note: 'Cinema + snacks', category: 'Fun' },
    { day: 16, minor: 95000, note: 'Fuel', category: 'Transport' },
    { day: 18, minor: 640000, note: 'Groceries', category: 'Food' },
    { day: 19, minor: 120000, note: 'Haircut', category: 'Other' },
    { day: 21, minor: 210000, note: 'Electricity token', category: 'Bills' },
    { day: 23, minor: 285000, note: 'Birthday gift', category: 'Shopping' },
    { day: 24, minor: 45000, note: 'Coffee', category: 'Food' },
  ];

  const byName = new Map(categories.map((category) => [category.name, category.id]));
  let inserted = 0;

  for (const item of plan) {
    const categoryId = byName.get(item.category);
    if (categoryId === undefined) continue;
    const spentOn = `${month}-${String(item.day).padStart(2, '0')}`;
    await createExpense(db, {
      amountMinor: item.minor,
      categoryId,
      spentOn,
      note: item.note,
      currency,
    });
    inserted++;
  }

  return inserted;
}
