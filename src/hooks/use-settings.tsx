/**
 * Settings: currency and monthly budget, persisted in SQLite.
 *
 * Lives in SQL rather than AsyncStorage because the app already has a database —
 * a second storage engine for two values would be one more thing to migrate and
 * to get wrong. `settings` is a plain key/value table.
 *
 * The currency is resolved **once** on first launch from the device locale, then
 * persisted. Resolving on every launch would mean a user who deliberately picks
 * USD in a Nigerian locale is switched back on the next start.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getSettings, saveSettings } from '@/db/repository';
import { DEFAULT_CURRENCY, resolveCurrency } from '@/lib/currency';
import type { SqlDriver } from '@/db/schema';
import type { Settings } from '@/types/expense';

interface SettingsContextValue {
  settings: Settings;
  ready: boolean;
  /** Why the DB is unavailable, if it is. Surfaced as a real error screen. */
  error: string | null;
  setCurrency: (code: string) => Promise<void>;
  setMonthlyBudget: (minor: number) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({
  children,
  db,
  deviceCurrency,
}: {
  children: React.ReactNode;
  db: SqlDriver | null;
  deviceCurrency: string | null;
}) {
  const [settings, setSettings] = useState<Settings>({
    currency: DEFAULT_CURRENCY,
    monthlyBudgetMinor: 0,
  });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!db) return;
      try {
        const stored = await getSettings(db);
        if (cancelled) return;

        if (stored) {
          setSettings(stored);
        } else {
          // First launch: locale first, NGN fallback (the brief's rule).
          const initial: Settings = {
            currency: resolveCurrency(deviceCurrency),
            monthlyBudgetMinor: 0,
          };
          await saveSettings(db, initial);
          if (!cancelled) setSettings(initial);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, deviceCurrency]);

  const setCurrency = useCallback(
    async (code: string) => {
      if (!db) return;
      const next = { ...settings, currency: code };
      // Optimistic: the picker closes immediately, and the write is local so it
      // cannot realistically fail after validation.
      setSettings(next);
      await saveSettings(db, next);
    },
    [db, settings],
  );

  const setMonthlyBudget = useCallback(
    async (minor: number) => {
      if (!db) return;
      const next = { ...settings, monthlyBudgetMinor: minor };
      setSettings(next);
      await saveSettings(db, next);
    },
    [db, settings],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, ready, error, setCurrency, setMonthlyBudget }),
    [settings, ready, error, setCurrency, setMonthlyBudget],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used inside <SettingsProvider>');
  return context;
}
