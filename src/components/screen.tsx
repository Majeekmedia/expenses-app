/** Shared screen chrome: background, safe area, scroll container, and a nav row. */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UiIcon, type UiIconName } from '@/components/ui-icon';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ScreenProps {
  children: React.ReactNode;
  /** Rendered above the scroll area and pinned — used for the month switcher. */
  stickyHeader?: React.ReactNode;
  /** Omit for the two screens that draw their own title block. */
  title?: string;
  nav?: boolean;
}

/**
 * One wrapper so every screen has the same background, padding and max width.
 *
 * The `maxWidth` + `alignSelf: center` pair matters on web: without it the app
 * stretches to the full browser width and every "does it fit at 360px" check
 * becomes meaningless, because the layout was never exercised at 360px.
 */
export function Screen({ children, stickyHeader, title, nav = true }: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.root}>
      <View
        style={[
          styles.inner,
          { paddingTop: insets.top + Spacing.three, maxWidth: MaxContentWidth },
        ]}
      >
        {title ? (
          <View style={styles.titleRow}>
            <ThemedText type="title">{title}</ThemedText>
          </View>
        ) : null}

        {nav ? <NavRow /> : null}
        {stickyHeader}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            // Leaves room for the add button so the last row is never covered.
            { paddingBottom: insets.bottom + 96 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </View>
      {theme ? null : null}
    </ThemedView>
  );
}

/**
 * Text links rather than icon-only buttons.
 *
 * App #2 clipped its nav to "Loc" at 360px because the title and three links had
 * to share one line. Here the links are a separate row of fixed-size targets and
 * the title sits above them, so neither can squeeze the other.
 */
function NavRow() {
  const theme = useTheme();
  const router = useRouter();

  const items: { icon: UiIconName; label: string; href: '/stats' | '/categories' | '/settings' }[] = [
    { icon: 'chart', label: 'Stats', href: '/stats' },
    { icon: 'tag', label: 'Categories', href: '/categories' },
    { icon: 'gear', label: 'Settings', href: '/settings' },
  ];

  return (
    <View style={styles.nav}>
      {items.map((item) => (
        <Pressable
          key={item.href}
          onPress={() => router.push(item.href)}
          accessibilityRole="link"
          style={({ pressed }) => [
            styles.navItem,
            { backgroundColor: pressed ? theme.surfaceAlt : theme.surface },
          ]}
        >
          <UiIcon name={item.icon} size={16} color={theme.textSecondary} />
          <ThemedText type="smallBold" themeColor="textSecondary">
            {item.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  inner: { flex: 1, width: '100%', alignSelf: 'center', paddingHorizontal: Spacing.four },
  titleRow: { marginBottom: Spacing.three },
  nav: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.four },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    flexShrink: 1,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.one },
});
