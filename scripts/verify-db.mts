/**
 * Real SQL against a real SQLite engine — no browser, no mocks.
 *
 * Run: node --experimental-sqlite scripts/verify-db.mts
 *
 * Why this exists: `expo-sqlite` on web is alpha and needs a cross-origin-isolated
 * page, so browser verification of the database is not guaranteed. Node 22 ships
 * `node:sqlite`, which is the same SQLite C library, so the schema and every
 * aggregate can be proven here regardless of what the browser does.
 *
 * This runs the **actual** `src/db/schema.ts` and `src/db/repository.ts` modules
 * (type-stripped by Node), not copies. A copy would drift and prove nothing.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const load = (path: string) => import(new URL(path, root).href);

const { migrate, SEED_CATEGORIES, SCHEMA_VERSION } = await load('src/db/schema.ts');
const repo = await load('src/db/repository.ts');
const { monthBounds, shiftMonth, todayString, toDayString, fromDayString } = await load(
  'src/lib/dates.ts',
);

let checks = 0;
let failures = 0;

function check(label: string, ok: boolean, detail = '') {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? '\u001b[32mPASS\u001b[0m' : '\u001b[31mFAIL\u001b[0m'} ${label}${detail ? ` — ${detail}` : ''}`);
}

/**
 * Adapts `node:sqlite` to the app's `SqlDriver` interface.
 *
 * The point of the adapter is that the *repository* is unchanged: this file is
 * the only place that knows about `DatabaseSync`, exactly as
 * `src/db/drivers/native.ts` is the only place that knows about `expo-sqlite`.
 */
function nodeDriver(file: string) {
  const db = new DatabaseSync(file);
  return {
    async exec(sql: string) {
      db.exec(sql);
    },
    async all<T>(sql: string, params: readonly unknown[] = []) {
      return db.prepare(sql).all(...(params as never[])) as T[];
    },
    async first<T>(sql: string, params: readonly unknown[] = []) {
      const rows = db.prepare(sql).all(...(params as never[])) as T[];
      return rows.length > 0 ? rows[0] : null;
    },
    async run(sql: string, params: readonly unknown[] = []) {
      const result = db.prepare(sql).run(...(params as never[]));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    close() {
      db.close();
    },
  };
}

const dir = mkdtempSync(join(tmpdir(), 'majeek-expenses-'));
const dbPath = join(dir, 'test.db');

try {
  /* ---------------------------------------------------------------- schema */
  console.log('\n=== Schema and migrations ===\n');

  const db = nodeDriver(dbPath);
  const version = await migrate(db);
  check('migrate() reports the current schema version', version === SCHEMA_VERSION, `v${version}`);

  const tables = await db.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const tableNames = tables.map((row) => row.name);
  check(
    'creates categories, expenses and settings',
    ['categories', 'expenses', 'settings'].every((name) => tableNames.includes(name)),
    tableNames.join(', '),
  );

  const indexes = await db.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const indexNames = indexes.map((row) => row.name);
  check(
    'creates the spent_on index',
    indexNames.includes('idx_expenses_spent_on'),
    indexNames.join(', '),
  );
  check(
    'reports user_version from the header',
    (await db.first<{ user_version: number }>('PRAGMA user_version'))?.user_version === SCHEMA_VERSION,
  );

  // Migrating twice must be a no-op; `expo-sqlite` reopens the file every launch.
  const second = await migrate(db);
  const categoryCount = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
  check(
    'migrate() is idempotent (no duplicate seed rows)',
    second === SCHEMA_VERSION && categoryCount?.n === SEED_CATEGORIES.length,
    `categories=${categoryCount?.n}`,
  );

  /* -------------------------------------------------------------- constraints */
  console.log('\n=== Constraints actually fire ===\n');

  const categories = await repo.listCategories(db);
  check('seeds the default categories', categories.length === SEED_CATEGORIES.length, `${categories.length}`);
  check(
    'seeds are not archived and carry an icon key',
    categories.every((category: { archived: boolean; icon: string }) => !category.archived && category.icon.length > 0),
  );

  const food = categories.find((category: { name: string }) => category.name === 'Food');

  let rejected = false;
  try {
    await repo.createExpense(db, {
      amountMinor: 0,
      categoryId: food.id,
      spentOn: '2026-10-01',
      note: 'zero',
      currency: 'NGN',
    });
  } catch {
    rejected = true;
  }
  check('CHECK (amount_minor > 0) rejects a zero amount', rejected);

  rejected = false;
  try {
    await repo.createExpense(db, {
      amountMinor: 100,
      categoryId: 99999,
      spentOn: '2026-10-01',
      note: 'orphan',
      currency: 'NGN',
    });
  } catch {
    rejected = true;
  }
  check('foreign key rejects a non-existent category', rejected);

  rejected = false;
  try {
    await repo.createExpense(db, {
      amountMinor: 100,
      categoryId: food.id,
      spentOn: '10/24/2026',
      note: 'bad date',
      currency: 'NGN',
    });
  } catch {
    rejected = true;
  }
  check('CHECK (spent_on GLOB) rejects a non-ISO date', rejected);

  /* -------------------------------------------------------------- aggregates */
  console.log('\n=== Aggregates match hand-calculated values ===\n');

  await repo.clearAllData(db);

  const byName = new Map(categories.map((category: { name: string; id: number }) => [category.name, category.id]));
  const fixture: { day: string; minor: number; category: string }[] = [
    { day: '2026-10-01', minor: 125000, category: 'Food' },
    { day: '2026-10-01', minor: 75000, category: 'Transport' },
    { day: '2026-10-05', minor: 200000, category: 'Food' },
    { day: '2026-10-31', minor: 50000, category: 'Bills' },
    // Previous month — must not leak into October's totals.
    { day: '2026-09-30', minor: 999999, category: 'Food' },
  ];

  for (const row of fixture) {
    await repo.createExpense(db, {
      amountMinor: row.minor,
      categoryId: byName.get(row.category)!,
      spentOn: row.day,
      note: '',
      currency: 'NGN',
    });
  }

  const summary = await repo.monthSummary(db, '2026-10', 'NGN');
  const expectedTotal = 125000 + 75000 + 200000 + 50000;
  check('month total sums only that month', summary.totalMinor === expectedTotal, `${summary.totalMinor} vs ${expectedTotal}`);
  check('month count excludes other months', summary.count === 4, `${summary.count}`);
  check('largest single expense', summary.largestMinor === 200000, `${summary.largestMinor}`);

  const foodRow = summary.byCategory.find((row: { name: string }) => row.name === 'Food');
  check('per-category total for Food', foodRow?.totalMinor === 325000, `${foodRow?.totalMinor}`);
  check('per-category count for Food', foodRow?.count === 2, `${foodRow?.count}`);

  const oct1 = summary.byDay.find((row: { spentOn: string }) => row.spentOn === '2026-10-01');
  check('per-day total for 1 Oct groups two rows', oct1?.totalMinor === 200000, `${oct1?.totalMinor}`);
  check('byDay is ordered ascending', summary.byDay[0].spentOn < summary.byDay[summary.byDay.length - 1].spentOn);
  check('byCategory includes zero-spend categories (LEFT JOIN)', summary.byCategory.length === SEED_CATEGORIES.length, `${summary.byCategory.length}`);

  const months = await repo.monthsWithExpenses(db);
  check('monthsWithExpenses finds both months', months.length === 2 && months[0] === '2026-10', months.join(','));

  /* ------------------------------------------------------------------ CRUD */
  console.log('\n=== CRUD semantics ===\n');

  const listed = await repo.listExpensesForMonth(db, '2026-10');
  check('lists 4 October expenses', listed.length === 4, `${listed.length}`);
  check('orders newest day first', listed[0].spentOn === '2026-10-31', listed[0].spentOn);
  check('joins the category name', listed.every((row: { categoryName: string }) => row.categoryName.length > 0));

  const target = listed[0];
  await repo.updateExpense(db, target.id, {
    amountMinor: 123456,
    categoryId: target.categoryId,
    spentOn: target.spentOn,
    note: 'updated',
    currency: 'NGN',
  });
  const updated = await repo.getExpense(db, target.id);
  check('update persists the new amount', updated?.amountMinor === 123456, `${updated?.amountMinor}`);
  check('update persists the note', updated?.note === 'updated', updated?.note);

  const afterUpdate = await repo.monthSummary(db, '2026-10', 'NGN');
  check(
    'month total reflects the edit',
    afterUpdate.totalMinor === expectedTotal - 50000 + 123456,
    `${afterUpdate.totalMinor}`,
  );

  const removed = await repo.deleteExpense(db, target.id);
  check('delete reports exactly one row changed', removed === 1, `${removed}`);

  const afterDelete = await repo.monthSummary(db, '2026-10', 'NGN');
  check(
    'month total reflects the delete',
    afterDelete.totalMinor === 125000 + 75000 + 200000,
    `${afterDelete.totalMinor}`,
  );
  check('count dropped to 3', afterDelete.count === 3, `${afterDelete.count}`);

  /* -------------------------------------------------------------- categories */
  console.log('\n=== Category lifecycle ===\n');

  const rentId = await repo.createCategory(db, { name: 'Rent', color: '#123456', icon: 'other' });
  const withRent = await repo.listCategories(db);
  check('createCategory adds a row', withRent.some((category: { id: number }) => category.id === rentId));

  await repo.updateCategory(db, rentId, { name: 'Housing', color: '#654321', icon: 'other' });
  const renamed = await repo.listCategories(db);
  check(
    'updateCategory renames',
    renamed.some((category: { name: string }) => category.name === 'Housing'),
  );

  await repo.archiveCategory(db, rentId);
  const activeOnly = await repo.listCategories(db);
  const allCategories = await repo.listCategories(db, true);
  check('archive hides from the active list', !activeOnly.some((category: { id: number }) => category.id === rentId));
  check('archive keeps the row for history', allCategories.some((category: { id: number; archived: boolean }) => category.id === rentId && category.archived));

  /* ---------------------------------------------------------------- settings */
  console.log('\n=== Settings round-trip ===\n');

  check('no settings on a fresh database', (await repo.getSettings(db)) === null);

  await repo.saveSettings(db, { currency: 'USD', monthlyBudgetMinor: 500000 });
  const saved = await repo.getSettings(db);
  check('settings round-trip currency', saved?.currency === 'USD', saved?.currency);
  check('settings round-trip budget', saved?.monthlyBudgetMinor === 500000, `${saved?.monthlyBudgetMinor}`);

  await repo.saveSettings(db, { currency: 'JPY', monthlyBudgetMinor: 900000 });
  const overwritten = await repo.getSettings(db);
  check('settings upsert overwrites rather than duplicating', overwritten?.currency === 'JPY', overwritten?.currency);
  const settingRows = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM settings');
  check('exactly two settings keys exist', settingRows?.n === 2, `${settingRows?.n}`);

  /* ------------------------------------------------------------------- dates */
  console.log('\n=== Calendar maths ===\n');

  check('monthBounds for a 31-day month', monthBounds('2026-10').last === '2026-10-31');
  check('monthBounds for February (leap)', monthBounds('2028-02').last === '2028-02-29');
  check('monthBounds for February (non-leap)', monthBounds('2026-02').last === '2026-02-28');
  check('shiftMonth wraps backwards across a year', shiftMonth('2026-01', -1) === '2025-12');
  check('shiftMonth wraps forwards across a year', shiftMonth('2026-12', 1) === '2027-01');
  check('shiftMonth handles a 13-month swing', shiftMonth('2026-01', 13) === '2027-02');

  // The day-boundary rule: a local 23:30 must stay on its own day, and parsing
  // must not round-trip through UTC.
  const lateEvening = new Date(2026, 9, 24, 23, 30, 0);
  check('23:30 local stays on the same calendar day', todayString(lateEvening) === '2026-10-24');
  check('fromDayString returns local midnight', fromDayString('2026-10-24').getHours() === 0);
  check('toDayString/fromDayString round-trip', toDayString(fromDayString('2026-03-01')) === '2026-03-01');

  db.close();

  /* ------------------------------------------------------- persistence check */
  console.log('\n=== Persistence across a reopen ===\n');

  const reopened = nodeDriver(dbPath);
  const persisted = await repo.monthSummary(reopened, '2026-10', 'NGN');
  check('data survives closing and reopening the file', persisted.count === 3, `${persisted.count}`);
  const persistedSettings = await repo.getSettings(reopened);
  check('settings survive a reopen', persistedSettings?.currency === 'JPY', persistedSettings?.currency);

  // A second `migrate()` on an existing file must not re-seed or bump the version.
  const versionAfterReopen = await migrate(reopened);
  const categoriesAfterReopen = await reopened.first<{ n: number }>(
    'SELECT COUNT(*) AS n FROM categories',
  );
  check(
    'reopening does not re-run the seed',
    versionAfterReopen === SCHEMA_VERSION &&
      (categoriesAfterReopen?.n ?? 0) === SEED_CATEGORIES.length + 1,
    `v${versionAfterReopen}, categories=${categoriesAfterReopen?.n}`,
  );

  reopened.close();
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(
  `\n${failures === 0 ? '\u001b[32m' : '\u001b[31m'}${checks - failures}/${checks} checks passed, ${failures} failure(s)\u001b[0m\n`,
);
process.exit(failures === 0 ? 0 : 1);
