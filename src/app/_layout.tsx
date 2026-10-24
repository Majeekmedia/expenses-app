import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getLocales } from 'expo-localization';

import { AppDarkTheme, AppLightTheme } from '@/constants/navigation-theme';
import { Palette } from '@/constants/palette';
import { currentMonthKey } from '@/lib/dates';
import { DatabaseProvider, useDatabase } from '@/db/provider';
import { ExpensesProvider } from '@/hooks/use-expenses';
import { SettingsProvider, useSettings } from '@/hooks/use-settings';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * The device's currency, resolved once.
 *
 * `expo-localization` reports a region (`NG`) and a currency code; the currency
 * code is `null` on web and for regions whose currency we do not list, so
 * `resolveCurrency` falls back to NGN instead of guessing.
 */
function deviceCurrency(): string | null {
  try {
    const locales = getLocales();
    return locales[0]?.currencyCode ?? null;
  } catch {
    return null;
  }
}

export default function RootLayout() {
  const isDark = useColorScheme() === 'dark';
  const palette = isDark ? Palette.dark : Palette.light;
  const theme = isDark ? AppDarkTheme : AppLightTheme;

  // Layer 3 of 4: the native root view. `useEffect`, not `useMemo` — a memo body
  // runs during render, which would fire a native call mid-render and again on
  // every unrelated re-render whose dependency array happened to change identity.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(palette.background);
  }, [palette.background]);

  const screenOptions = useMemo(
    () => ({
      // Layer 2 of 4: the navigator's own content background.
      contentStyle: { backgroundColor: palette.background },
      headerStyle: { backgroundColor: palette.background },
      headerTintColor: palette.text,
      headerTitleStyle: { fontSize: 18, fontWeight: '600' as const },
      headerShadowVisible: false,
      // Without this the iOS back button shows the raw route name ("index").
      headerBackTitle: 'Back',
    }),
    [palette.background, palette.text],
  );

  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <DatabaseProvider>
          <SettingsAndExpenses screenOptions={screenOptions} />
        </DatabaseProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Split out so it can read both the database and the settings, which only exist
 * *below* their providers. Reading them in `RootLayout` would give `null` forever.
 */
function SettingsAndExpenses({ screenOptions }: { screenOptions: object }) {
  const { db } = useDatabase();
  const [month, setMonth] = useState(currentMonthKey);

  return (
    <SettingsProvider db={db} deviceCurrency={deviceCurrency()}>
      <ExpensesBridge db={db} month={month} setMonth={setMonth} screenOptions={screenOptions} />
    </SettingsProvider>
  );
}

function ExpensesBridge({
  db,
  month,
  setMonth,
  screenOptions,
}: {
  db: ReturnType<typeof useDatabase>['db'];
  month: string;
  setMonth: (month: string) => void;
  screenOptions: object;
}) {
  const { settings } = useSettings();

  return (
    <ExpensesProvider db={db} month={month} onMonthChange={setMonth} currency={settings.currency}>
      <Stack screenOptions={screenOptions}>
        {/* Each screen renders its own large title inside the content, so the
            header bar is hidden and only the transition background shows. */}
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="stats" options={{ headerShown: false }} />
        <Stack.Screen name="categories" options={{ title: 'Categories' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="expense/[id]" options={{ title: '', headerBackTitle: 'Back' }} />
      </Stack>
    </ExpensesProvider>
  );
}
