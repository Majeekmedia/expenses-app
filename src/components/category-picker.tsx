/** Category chooser: a wrapping grid of chips, not a modal picker. */
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { categoryInk } from '@/constants/palette';
import { useTheme } from '@/hooks/use-theme';
import type { Category } from '@/types/expense';

export interface CategoryPickerProps {
  categories: Category[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export function CategoryPicker({ categories, selectedId, onSelect }: CategoryPickerProps) {
  const theme = useTheme();

  return (
    // `flexWrap` + `gap` rather than a horizontal scroller: seven categories fit in
    // three rows at 360px, and a scroller would hide options behind a swipe.
    <View style={styles.grid}>
      {categories.map((category) => {
        const selected = category.id === selectedId;
        return (
          <Pressable
            key={category.id}
            onPress={() => onSelect(category.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={category.name}
            style={[
              styles.chip,
              {
                backgroundColor: selected ? theme.selected : theme.surface,
                borderColor: selected ? theme.accent : 'transparent',
              },
            ]}
          >
            <CategoryIcon
              name={category.icon}
              size={16}
              color={selected ? categoryInk(category.color, theme.isDark) : theme.textSecondary}
            />
            <ThemedText
              type="smallBold"
              // Selected chips use the darker per-scheme ink so the label stays
              // readable on the tinted fill; see CONVENTIONS §4 on accents.
              style={{ color: selected ? theme.text : theme.textSecondary }}
              numberOfLines={1}
            >
              {category.name}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
