/**
 * Schema and migrations.
 *
 * Migrations are keyed on `PRAGMA user_version`, which SQLite stores in the
 * database header — so nothing else has to be created before the first migration
 * can run, and a migrated database reports its own version.
 *
 * Each step is written as a pure function of `db` so the same code paths run
 * under `expo-sqlite` on device and under `node:sqlite` in
 * `scripts/verify-db.mts`. That is what makes "the SQL is correct" a claim with
 * evidence behind it rather than an impression from clicking around.
 */

/**
 * The driver surface the schema and repository need.
 *
 * Deliberately tiny — four methods. `expo-sqlite`'s real API is much larger, but
 * every extra method here is one more thing the Node harness has to imitate, and
 * one more chance for the two to silently disagree.
 */
export interface SqlDriver {
  /** Multi-statement DDL. Never pass user input to this. */
  exec(sql: string): Promise<void>;
  /** Rows as objects. */
  all<T>(sql: string, params?: readonly SqlValue[]): Promise<T[]>;
  /** First row, or `null`. */
  first<T>(sql: string, params?: readonly SqlValue[]): Promise<T | null>;
  /** Write. Returns the new row id and affected count. */
  run(sql: string, params?: readonly SqlValue[]): Promise<{ lastInsertRowId: number; changes: number }>;
}

export type SqlValue = string | number | null;

export const SCHEMA_VERSION = 1;

/**
 * Default categories.
 *
 * Colour is a hex string stored on the row rather than a palette index, so a
 * future rename or recolour is a data edit, not a code edit.
 *
 * Icons are **semantic keys**, not characters: `'food'` is resolved to an SVG by
 * `components/category-icon.tsx`. Storing an emoji here is what produced App #2's
 * grey boxes on Android — emoji are drawn by a platform font, so the same
 * codepoint is a colour glyph in a browser and a placeholder on a phone.
 */
export const SEED_CATEGORIES: readonly { name: string; color: string; icon: string }[] = [
  { name: 'Food', color: '#E4572E', icon: 'food' },
  { name: 'Transport', color: '#17A2B8', icon: 'transport' },
  { name: 'Bills', color: '#6C5CE7', icon: 'bills' },
  { name: 'Shopping', color: '#E84393', icon: 'shopping' },
  { name: 'Health', color: '#00B894', icon: 'health' },
  { name: 'Fun', color: '#F39C12', icon: 'fun' },
  { name: 'Other', color: '#7F8C8D', icon: 'other' },
];

const DDL_V1 = `
CREATE TABLE IF NOT EXISTS categories (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT    NOT NULL UNIQUE,
  color     TEXT    NOT NULL,
  icon      TEXT    NOT NULL,
  sort      INTEGER NOT NULL DEFAULT 0,
  archived  INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
);

CREATE TABLE IF NOT EXISTS expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  spent_on     TEXT    NOT NULL CHECK (spent_on GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  note         TEXT    NOT NULL DEFAULT '',
  currency     TEXT    NOT NULL DEFAULT 'NGN',
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_expenses_spent_on ON expenses(spent_on);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/**
 * Brings the database up to `SCHEMA_VERSION`.
 *
 * Idempotent: running it twice is a no-op, which matters because `expo-sqlite`
 * reopens the file on every cold start.
 *
 * `PRAGMA foreign_keys` is **per connection**, not stored in the file, so it has
 * to be set on every open — forgetting it is why a deleted category can leave
 * orphaned expenses behind. It is set here because every caller migrates on open.
 */
export async function migrate(db: SqlDriver): Promise<number> {
  await db.exec('PRAGMA journal_mode = WAL;');
  await db.exec('PRAGMA foreign_keys = ON;');

  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await db.exec(DDL_V1);
    await seedCategories(db);
    version = 1;
  }

  // Future migrations chain here, each guarded by its own `if (version < n)`.
  // Never edit DDL_V1 after release — add a step instead, or existing installs
  // will keep their old table shape and silently miss the column.

  // Writing the version unconditionally is cheap (a header write) and avoids a
  // second `PRAGMA user_version` read just to decide whether it is needed.
  await db.exec(`PRAGMA user_version = ${version};`);

  return version;
}

/** Inserts the default categories only if the table is empty. */
export async function seedCategories(db: SqlDriver): Promise<number> {
  const existing = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
  if ((existing?.n ?? 0) > 0) return 0;

  for (let i = 0; i < SEED_CATEGORIES.length; i++) {
    const category = SEED_CATEGORIES[i];
    await db.run(
      'INSERT INTO categories (name, color, icon, sort, archived) VALUES (?, ?, ?, ?, 0)',
      [category.name, category.color, category.icon, i],
    );
  }
  return SEED_CATEGORIES.length;
}
