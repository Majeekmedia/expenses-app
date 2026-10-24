/**
 * Money is stored as an **integer in the currency's minor unit** — kobo for NGN,
 * cents for USD, and whole yen for JPY. Never a float.
 *
 * Why integer minor units rather than a decimal string or a `REAL` column:
 *
 *   0.1 + 0.2 === 0.30000000000000004
 *
 * One expense done that way is harmless. Two hundred summed by SQLite across a
 * month is a total that disagrees with the rows above it, and once it is in the
 * database there is no way to tell which rounding was "right".
 */

/**
 * Decimal places for each supported currency.
 *
 * This is the table that makes the currency picker safe rather than cosmetic:
 * JPY has **zero** minor digits, so ¥1,500 is stored as `1500`, whereas ₦15.00
 * is stored as `1500` too — the same integer meaning two different amounts. The
 * code therefore has to travel with the amount, which is why `expenses` carries
 * a `currency` column and not just `settings`.
 */
export const CURRENCY_EXPONENTS: Record<string, number> = {
  NGN: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  ZAR: 2,
  INR: 2,
  CNY: 2,
  JPY: 0,
};

/** Anything not in the table is treated as 2-decimal rather than throwing. */
export function exponentFor(currency: string): number {
  return CURRENCY_EXPONENTS[currency] ?? 2;
}

/**
 * Parses what a person typed into an integer minor amount.
 *
 * Accepts `1`, `1.5`, `1,234.56`, `.5` and ` 12 `. Rejects anything that is not
 * a positive, finite, sensibly sized number. Returns `null` rather than throwing
 * so the form can show an inline error instead of crashing a screen.
 *
 * A comma is treated as a **thousands separator**, not a decimal point: the app
 * targets en-NG/en-US/en-GB, where `1,50` means 150, and silently reading it as
 * 1.50 would lose a factor of 100.
 */
export function parseAmountToMinor(input: string, currency: string): number | null {
  const raw = input.trim().replace(/,/g, '');
  if (raw === '') return null;

  // `1.` and `.5` are legitimate half-typed states; `1.2.3` and `abc` are not.
  // `.5` is normalised to `0.5`, and `\d*\.?` (not `\d+\.`) is what allows the
  // bare trailing dot — without it, typing "12." flips the field to "Not a valid
  // amount" for one keystroke, which reads as a bug to the person typing.
  const normalised = raw.startsWith('.') ? `0${raw}` : raw;
  if (!/^\d+(\.\d*)?$/.test(normalised)) return null;

  const exponent = exponentFor(currency);
  const [whole, fraction = ''] = normalised.split('.');

  // Round-half-up on the digit after the last significant place, rather than
  // letting `Math.round` see a float that is already 1e-17 off.
  const significant = fraction.slice(0, exponent);
  const padded = significant.padEnd(exponent, '0');
  const nextDigit = fraction.length > exponent ? Number(fraction[exponent]) : 0;

  let minor = Number(whole) * 10 ** exponent + (exponent === 0 ? 0 : Number(padded || '0'));
  if (nextDigit >= 5) minor += 1;

  if (!Number.isFinite(minor) || minor <= 0) return null;

  // Guard against a fat-fingered entry overflowing SQLite's 64-bit INTEGER.
  const MAX = 9_000_000_000_000;
  if (minor > MAX) return null;

  return minor;
}

/** Splits a minor amount into its whole and fractional parts, without floating point. */
export function splitMinor(minor: number, currency: string): { whole: number; fraction: string } {
  const exponent = exponentFor(currency);
  if (exponent === 0) return { whole: minor, fraction: '' };

  const factor = 10 ** exponent;
  const whole = Math.trunc(minor / factor);
  // `%` on a positive integer is exact; the padEnd keeps `105` as "05", not "5".
  const fraction = String(minor % factor).padStart(exponent, '0');
  return { whole, fraction };
}

/**
 * Groups the whole part with the separator the locale actually uses.
 *
 * Deliberately does not use `Intl.NumberFormat` for the fallback path: if Hermes
 * lacks full ICU, `Intl` can silently produce "NGN 1,234.56" instead of
 * "₦1,234.56", and a wrong-looking amount is worse than a plainly formatted one.
 */
export function groupThousands(whole: number, separator = ','): string {
  const sign = whole < 0 ? '-' : '';
  const digits = String(Math.abs(whole));
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += separator;
    out += digits[i];
  }
  return sign + out;
}

/**
 * Whole-percent shares that **sum to exactly 100**.
 *
 * Rounding each share independently does not: totals of
 * `[325000, 200000, 50000, 75000]` round to `43 + 27 + 7 + 24 = 101`, which a
 * user reads straight off the stats legend as "these do not add up".
 *
 * Uses the **largest remainder** method: floor every share, then hand the
 * leftover points to the shares with the biggest fractional part. Deterministic,
 * with an index tiebreak, so the same data always renders the same numbers.
 */
export function percentShares(values: readonly number[]): number[] {
  const total = values.reduce((acc, value) => acc + value, 0);
  if (total <= 0) return values.map(() => 0);

  const exact = values.map((value) => (value / total) * 100);
  const floors = exact.map((value) => Math.floor(value));
  let remaining = 100 - floors.reduce((acc, value) => acc + value, 0);

  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const result = [...floors];
  for (const entry of order) {
    if (remaining <= 0) break;
    result[entry.index] += 1;
    remaining -= 1;
  }

  return result;
}
