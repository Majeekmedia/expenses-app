/** Category management: rename, recolour, archive. Archived categories keep their history. */
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CategoryIcon } from '@/components/category-icon';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UiIcon } from '@/components/ui-icon';
import { Radius, Spacing } from '@/constants/theme';
import { SEED_CATEGORIES } from '@/db/schema';
import { useExpenses } from '@/hooks/use-expenses';
import { useTheme } from '@/hooks/use-theme';

const SWATCHES = ['#E4572E', '#17A2B8', '#6C5CE7', '#E84393', '#00B894', '#F39C12', '#7F8C8D'];

export default function CategoriesScreen() {
  const theme = useTheme();
  const { categories, addCategory, retireCategory, editCategory } = useExpenses();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(SWATCHES[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const active = categories.filter((category) => !category.archived);
  const archived = categories.filter((category) => category.archived);

  async function add() {
    const name = newName.trim();
    if (name === '') return;
    if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      setError(`"${name}" already exists.`);
      return;
    }
    try {
      // Pick the icon from the seed table when the name matches a default, so a
      // user re-creating "Food" gets the fork-and-knife rather than a generic dot.
      const seed = SEED_CATEGORIES.find(
        (entry) => entry.name.toLowerCase() === name.toLowerCase(),
      );
      await addCategory({ name, color: newColor, icon: seed?.icon ?? 'other' });
      setNewName('');
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function rename(id: number) {
    const name = editingName.trim();
    if (name === '') {
      setEditingId(null);
      return;
    }
    const existing = categories.find((category) => category.id === id);
    if (!existing) return;
    try {
      await editCategory(id, { name, color: existing.color, icon: existing.icon });
      setEditingId(null);
      setError(null);
    } catch (caught) {
      // The UNIQUE constraint on `categories.name` is the thing that rejects a
      // duplicate here; surfacing its message is more accurate than pre-checking.
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <Screen nav={false}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
        ACTIVE
      </ThemedText>

      {active.map((category) => (
        <ThemedView key={category.id} type="surface" style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: theme.surfaceAlt }]}>
            <CategoryIcon name={category.icon} size={18} color={category.color} />
          </View>

          {editingId === category.id ? (
            <TextInput
              value={editingName}
              onChangeText={setEditingName}
              autoFocus
              onSubmitEditing={() => void rename(category.id)}
              accessibilityLabel="Category name"
              style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
            />
          ) : (
            <ThemedText type="body" style={styles.flex} numberOfLines={1}>
              {category.name}
            </ThemedText>
          )}

          {editingId === category.id ? (
            <Pressable
              onPress={() => void rename(category.id)}
              accessibilityRole="button"
              accessibilityLabel="Save name"
              hitSlop={8}
              style={styles.action}
            >
              <UiIcon name="check" size={18} color={theme.accent} />
            </Pressable>
          ) : (
            <>
              <Pressable
                onPress={() => {
                  setEditingId(category.id);
                  setEditingName(category.name);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Rename ${category.name}`}
                hitSlop={8}
                style={styles.action}
              >
                <ThemedText type="smallBold" themeColor="accent">
                  Rename
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => void retireCategory(category.id)}
                accessibilityRole="button"
                accessibilityLabel={`Archive ${category.name}`}
                hitSlop={8}
                style={styles.action}
              >
                {/* Archiving, not deleting: a hard delete would orphan expenses. */}
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Archive
                </ThemedText>
              </Pressable>
            </>
          )}
        </ThemedView>
      ))}

      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
        ADD A CATEGORY
      </ThemedText>

      <ThemedView type="surface" style={styles.addCard}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Name, e.g. Rent"
          placeholderTextColor={theme.textMuted}
          accessibilityLabel="New category name"
          style={[styles.input, { color: theme.text, backgroundColor: theme.surfaceAlt }]}
        />
        <View style={styles.swatchRow}>
          {SWATCHES.map((color) => (
            <Pressable
              key={color}
              onPress={() => setNewColor(color)}
              accessibilityRole="radio"
              accessibilityState={{ selected: newColor === color }}
              accessibilityLabel={`Colour ${color}`}
              style={[
                styles.swatch,
                { backgroundColor: color },
                newColor === color && { borderColor: theme.text, borderWidth: 2 },
              ]}
            />
          ))}
        </View>
        <Pressable
          onPress={() => void add()}
          accessibilityRole="button"
          accessibilityLabel="Add category"
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: theme.accent, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <UiIcon name="plus" size={16} color={theme.onAccent} />
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            Add category
          </ThemedText>
        </Pressable>
      </ThemedView>

      {error ? (
        <ThemedText type="small" themeColor="negative" style={styles.sectionLabel}>
          {error}
        </ThemedText>
      ) : null}

      {archived.length > 0 ? (
        <>
          <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
            ARCHIVED ({archived.length})
          </ThemedText>
          <ThemedText type="small" themeColor="textMuted" style={styles.hint}>
            Hidden from the picker. Their past expenses keep their label.
          </ThemedText>
          {archived.map((category) => (
            <ThemedView key={category.id} type="surface" style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: theme.surfaceAlt }]}>
                <CategoryIcon name={category.icon} size={18} color={theme.textMuted} />
              </View>
              <ThemedText type="body" themeColor="textMuted" style={styles.flex} numberOfLines={1}>
                {category.name}
              </ThemedText>
            </ThemedView>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: Spacing.four, marginBottom: Spacing.two, letterSpacing: 0.5 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.sm,
    marginBottom: Spacing.two,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
  action: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  input: {
    flex: 1,
    minWidth: 0,
    height: 40,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  addCard: { borderRadius: Radius.md, padding: Spacing.three, gap: Spacing.three },
  swatchRow: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  swatch: { width: 30, height: 30, borderRadius: Radius.pill, borderColor: 'transparent', borderWidth: 2 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
  hint: { marginBottom: Spacing.two },
});
