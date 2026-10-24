import { useColorScheme } from '@/hooks/use-color-scheme';
import { Palette } from '@/constants/palette';

/**
 * Returns the active palette.
 *
 * `isDark` rides along on the palette so a component can pick scheme-aware values
 * without a second hook — see `categoryInk(color, theme.isDark)`.
 */
export function useTheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? Palette.dark : Palette.light;
}
