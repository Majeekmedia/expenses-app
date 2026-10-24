/**
 * Currency display.
 *
 * The single place in the app where an integer minor amount becomes a string.
 * `components/amount-text.tsx` is the only component allowed to call it, so a
 * formatting change cannot leave two screens disagreeing.
 *
 * There is **no conversion** anywhere in this app: the picker changes how an
 * amount is displayed, and each expense records the currency it was entered in.
 * The alternative — a single global currency with silent reinterpretation —
 * would turn a ¥1,500 lunch into ₦15.00 the moment the setting changed.
 */
import { exponentFor, splitMinor, groupThousands } from '@/lib/money';

export type CurrencyCode =
  | 'NGN' | 'USD' | 'EUR' | 'GBP' | 'CAD'
  | 'AUD' | 'ZAR' | 'INR' | 'JPY' | 'CNY';

export interface CurrencyOption {
  code: CurrencyCode;
  /** Display symbol. `¥` is deliberately shown with its code because JPY and CNY share it. */
  symbol: string;
  label: string;
  /** BCP-47 tag used for `Intl` grouping and symbol placement. */
  locale: string;
}

export const CURRENCIES: readonly CurrencyOption[] = [
  { code: 'NGN', symbol: '₦', label: 'Nigerian Naira', locale: 'en-NG' },
  { code: 'USD', symbol: '$', label: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', label: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', label: 'British Pound', locale: 'en-GB' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar', locale: 'en-AU' },
  { code: 'ZAR', symbol: 'R', label: 'South African Rand', locale: 'en-ZA' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee', locale: 'en-IN' },
  { code: 'CNY', symbol: 'CN¥', label: 'Chinese Yuan', locale: 'zh-CN' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen', locale: 'ja-JP' },
] as const;

/** The fallback, per the brief: locale first, then NGN. */
export const DEFAULT_CURRENCY: CurrencyCode = 'NGN';

const BY_CODE = new Map(CURRENCIES.map((entry) => [entry.code, entry]));

/** Narrowing guard, so a stored string can be validated before use. */
export function isCurrencyCode(value: string): value is CurrencyCode {
  return BY_CODE.has(value as CurrencyCode);
}

export function currencyOption(code: string): CurrencyOption {
  return BY_CODE.get(code as CurrencyCode) ?? BY_CODE.get(DEFAULT_CURRENCY)!;
}

/**
 * Resolves the currency an app should start on.
 *
 * `deviceCurrency` is the ISO code that `expo-localization` reported (it can be
 * `undefined` on web, and can be a currency we do not support, e.g. `CHF`). Both
 * of those cases fall through to NGN rather than throwing or rendering a blank.
 */
export function resolveCurrency(deviceCurrency: string | null | undefined): CurrencyCode {
  if (!deviceCurrency) return DEFAULT_CURRENCY;
  const upper = deviceCurrency.toUpperCase();
  return isCurrencyCode(upper) ? upper : DEFAULT_CURRENCY;
}

/**
 * Formats an integer minor amount for display.
 *
 * Preference order:
 *  1. `Intl.NumberFormat` with the currency's locale and style — correct grouping
 *     and correct decimal count (JPY shows none).
 *  2. A hand-rolled fallback, because Hermes can ship without full ICU and a
 *     formatter that returns `"NGN 1234.56"` is worse than `"₦1,234.56"`.
 *
 * The fallback groups by three and uses the symbol directly, which is right for
 * the app's target locales (NG/US/GB/ZA/IN all group by three).
 */
export function formatMoney(
  minor: number,
  currency: string,
  options: { withSymbol?: boolean } = {},
): string {
  const withSymbol = options.withSymbol ?? true;
  const option = currencyOption(currency);
  const exponent = exponentFor(option.code);

  try {
    const formatted = new Intl.NumberFormat(option.locale, {
      style: withSymbol ? 'currency' : 'decimal',
      currency: option.code,
      minimumFractionDigits: exponent,
      maximumFractionDigits: exponent,
    }).format(minor / 10 ** exponent);

    // A currency style that silently dropped the symbol is not acceptable here:
    // `Intl` falls back to the raw code in minimal-ICU builds, and 10 codes are
    // supported so "NGN" is a predictable symptom. Swap in our own symbol.
    if (withSymbol && !formatted.includes(option.symbol) && new RegExp(option.code).test(formatted)) {
      return formatted.replace(option.code, option.symbol).trim();
    }
    return formatted;
  } catch {
    // No usable `Intl`: build it ourselves from exact integer parts.
  }

  const { whole, fraction } = splitMinor(Math.abs(minor), option.code);
  const sign = minor < 0 ? '-' : '';
  const grouped = groupThousands(whole);
  const number = exponent === 0 ? grouped : `${grouped}.${fraction}`;
  return withSymbol ? `${sign}${option.symbol}${number}` : `${sign}${number}`;
}

/** Compact form for chart labels: `₦12.5k`, `₦980`. */
export function formatCompactMoney(minor: number, currency: string): string {
  const option = currencyOption(currency);
  const exponent = exponentFor(option.code);
  const major = minor / 10 ** exponent;

  if (major >= 1_000_000) return `${option.symbol}${trimZero(major / 1_000_000)}m`;
  if (major >= 1_000) return `${option.symbol}${trimZero(major / 1_000)}k`;
  return `${option.symbol}${trimZero(major)}`;
}

/** One decimal at most, and no trailing `.0` — `1.5` not `1.50`, `2` not `2.0`. */
function trimZero(value: number): string {
  const fixed = value.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}
