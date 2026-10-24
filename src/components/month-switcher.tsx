/** Month navigation. Kept to a fixed width so the label cannot push the arrows off-screen. */
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { UiIcon } from '@/components/ui-icon';
import { Radius, Spacing } from '@/constants/theme';
import { formatMonthLabel } from '@/lib/dates';
import { useTheme } from '@/hooks/use-theme';

export interface MonthSwitcherProps {
  month: string;
  onChange: (delta: number) => void;
}

export function MonthSwitcher({ month, onChange }: MonthSwitcherProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(-1)}
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        hitSlop={10}
        style={({ pressed }) => [
          styles.arrow,
          { backgroundColor: pressed ? theme.surfaceAlt : theme.surface },
        ]}
      >
        <UiIcon name="chevron-left" size={18} color={theme.text} />
      </Pressable>

      <ThemedText type="subtitle" numberOfLines={1} style={styles.label}>
        {formatMonthLabel(month)}
      </ThemedText>

      <Pressable
        onPress={() => onChange(1)}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        hitSlop={10}
        style={({ pressed }) => [
          styles.arrow,
          { backgroundColor: pressed ? theme.surfaceAlt : theme.surface },
        ]}
      >
        <UiIcon name="chevron-right" size={18} color={theme.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  // `flex: 1` with `textAlign: center`: the two arrows stay a fixed size and the
  // label gives up width instead. A long month name then ellipsises rather than
  // scrolling the arrows out of the viewport at 360px.
  label: { flex: 1, textAlign: 'center' },
  arrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
});
