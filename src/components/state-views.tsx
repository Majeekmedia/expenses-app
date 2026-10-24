/** Loading / error / empty states, designed once and reused by every screen. */
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UiIcon } from '@/components/ui-icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.center}>
      <ActivityIndicator color={theme.accent} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.gap}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

/**
 * A real error, not an empty list.
 *
 * "You have no expenses" and "the database failed to open" look identical if the
 * failure is swallowed, and only one of those is honest. On web the most common
 * cause is a page that is not cross-origin isolated, so the message names it.
 */
export function ErrorState({ message }: { message: string }) {
  const theme = useTheme();
  const isolationHint =
    /SharedArrayBuffer|cross-origin|indexedDB|wasm/i.test(message) &&
    'This build needs cross-origin isolation for SQLite on web (COOP/COEP headers). See the README.';

  return (
    <ThemedView style={styles.center}>
      <ThemedText type="subtitle" themeColor="negative">
        Could not open the database
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={[styles.gap, styles.centred]}>
        {message}
      </ThemedText>
      {isolationHint ? (
        <ThemedText type="small" themeColor="textMuted" style={[styles.gap, styles.centred]}>
          {isolationHint}
        </ThemedText>
      ) : null}
      <View style={styles.gap} />
      <ThemedText type="small" themeColor="textMuted">
        Data is stored on this device only.
      </ThemedText>
      {theme ? null : null}
    </ThemedView>
  );
}

export function EmptyState({
  title,
  body,
  icon = 'wallet',
}: {
  title: string;
  body: string;
  icon?: 'wallet' | 'chart';
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.center}>
      <UiIcon name={icon} size={40} color={theme.textMuted} strokeWidth={1.6} />
      <ThemedText type="subtitle" style={styles.gap}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={[styles.gap, styles.centred]}>
        {body}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    // 60% rather than a fixed height, so a short list still fills the screen
    // without pushing the empty state off the top on a tall phone.
    minHeight: 220,
  },
  gap: { marginTop: Spacing.three },
  centred: { textAlign: 'center' },
});
