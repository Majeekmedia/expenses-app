/**
 * The only component allowed to render money.
 *
 * Every amount in the app goes through here, so `formatMoney` is the single code
 * path and two screens cannot disagree about grouping or decimal places. It also
 * means the currency always travels with the amount, which is what stops a
 * ¥1,500 expense being re-rendered as ₦15.00 after a settings change.
 */
import { Text, type TextProps } from 'react-native';

import { Type } from '@/constants/theme';
import { formatMoney } from '@/lib/currency';
import { useTheme } from '@/hooks/use-theme';

export interface AmountTextProps extends TextProps {
  /** Integer amount in the currency's minor unit. */
  minor: number;
  /** ISO code the amount was recorded in. */
  currency: string;
  size?: keyof typeof Type;
  /** Palette colour name; defaults to the theme's primary text colour. */
  tone?: 'text' | 'textSecondary' | 'textMuted' | 'positive' | 'negative' | 'accent';
  withSymbol?: boolean;
}

export function AmountText({
  minor,
  currency,
  size = 'amount',
  tone = 'text',
  withSymbol = true,
  style,
  ...rest
}: AmountTextProps) {
  const theme = useTheme();

  return (
    <Text
      // `Type.amount` carries `fontVariant: tabular-nums`, so a column of amounts
      // lines up instead of wobbling as digit widths change row to row.
      style={[{ color: theme[tone] }, Type[size], style]}
      {...rest}
    >
      {formatMoney(minor, currency, { withSymbol })}
    </Text>
  );
}
