/**
 * Native + web driver backed by `expo-sqlite`.
 *
 * `expo-sqlite` is bundled in Expo Go, so this path needs no custom dev build.
 * On web it uses a WebAssembly build and requires a **cross-origin-isolated**
 * page (see `metro.config.js`); the app degrades to a clear error otherwise
 * instead of failing with a bare `SharedArrayBuffer is not defined`.
 */
import * as SQLite from 'expo-sqlite';

import type { SqlDriver, SqlValue } from '@/db/schema';

export const DATABASE_NAME = 'majeek-expenses.db';

let handle: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * One connection for the process.
 *
 * Opening per call would re-run `PRAGMA foreign_keys` and the migration check on
 * every query, and two concurrent opens of the same file can interleave writes.
 * Caching the promise (not the database) also makes concurrent first-callers
 * share a single open rather than racing.
 */
export function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!handle) {
    handle = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return handle;
}

/** Test seam: drop the cached handle so the next call reopens. */
export function resetDatabaseHandle(): void {
  handle = null;
}

export function createExpoDriver(): SqlDriver {
  return {
    async exec(sql: string): Promise<void> {
      const db = await openDatabase();
      await db.execAsync(sql);
    },

    async all<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
      const db = await openDatabase();
      // `getAllAsync` prepares, binds and finalizes internally, so parameters are
      // escaped by SQLite rather than concatenated into the statement.
      return db.getAllAsync<T>(sql, params as SqlValue[]);
    },

    async first<T>(sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
      const db = await openDatabase();
      return db.getFirstAsync<T>(sql, params as SqlValue[]);
    },

    async run(sql: string, params: readonly SqlValue[] = []) {
      const db = await openDatabase();
      const result = await db.runAsync(sql, params as SqlValue[]);
      return { lastInsertRowId: result.lastInsertRowId, changes: result.changes };
    },
  };
}
