import { StyleSheet, Text, type TextProps } from 'react-native';

import { Type, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: keyof typeof Type;
  themeColor?: ThemeColor;
};

/**
 * Text with a scheme-aware colour and one of the shared type sizes.
 *
 * `themeColor` names a palette entry rather than taking a raw colour, which keeps
 * every text colour in the contrast test's reach: a literal `#777` passed inline
 * somewhere would be invisible to `verify-contrast.mts`.
 */
export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[{ color: theme[themeColor ?? 'text'] }, Type[type], style]}
      {...rest}
    />
  );
}

export const textStyles = StyleSheet.create({});
