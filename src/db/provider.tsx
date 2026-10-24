/**
 * Opens and migrates the database once, before any screen can query it.
 *
 * The app renders a real error state if this fails rather than an empty list,
 * because "no expenses" and "the database did not open" look identical on screen
 * and only one of them is safe to show.
 */
import { createContext, useContext, useEffect, useState } from 'react';

import { createExpoDriver } from '@/db/drivers/native';
import { migrate, type SqlDriver } from '@/db/schema';

interface DatabaseContextValue {
  db: SqlDriver | null;
  ready: boolean;
  error: string | null;
  /** The version the database reports after migration — shown on Settings as evidence. */
  schemaVersion: number | null;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  db: null,
  ready: false,
  error: null,
  schemaVersion: null,
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SqlDriver | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaVersion, setSchemaVersion] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const driver = createExpoDriver();
        const version = await migrate(driver);
        if (cancelled) return;
        setDb(driver);
        setSchemaVersion(version);
      } catch (caught) {
        if (cancelled) return;
        // On web the most likely cause is a missing cross-origin-isolated page,
        // so name that specifically instead of surfacing a bare
        // "SharedArrayBuffer is not defined".
        const message = caught instanceof Error ? caught.message : String(caught);
        setError(message);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DatabaseContext.Provider value={{ db, ready, error, schemaVersion }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  return useContext(DatabaseContext);
}
