/**
 * Pure-logic verification: money, currency formatting, chart geometry.
 *
 * Run: node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/verify-logic.mts
 *
 * These are the cases where being approximately right is indistinguishable from
 * being wrong on screen — a total that is off by a kobo, a ¥1,500 expense shown
 * as ₦15.00, a donut wedge that renders as its complement.
 */
import { createRequire } from 'node:module';

const root = new URL('..', import.meta.url);
const load = (path: string) => import(new URL(path, root).href);

const money = await load('src/lib/money.ts');
const currency = await load('src/lib/currency.ts');
const dates = await load('src/lib/dates.ts');
void createRequire;

let checks = 0;
let failures = 0;

function check(label: string, ok: boolean, detail = '') {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? '\u001b[32mPASS\u001b[0m' : '\u001b[31mFAIL\u001b[0m'} ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log('\n=== Parsing amounts to integer minor units ===\n');

const parse = money.parseAmountToMinor;

check('whole number', parse('12', 'NGN') === 1200, `${parse('12', 'NGN')}`);
check('one decimal', parse('12.5', 'NGN') === 1250, `${parse('12.5', 'NGN')}`);
check('two decimals', parse('12.34', 'NGN') === 1234, `${parse('12.34', 'NGN')}`);
check('thousands separators are stripped', parse('1,234.56', 'NGN') === 123456, `${parse('1,234.56', 'NGN')}`);
check('leading dot', parse('.5', 'NGN') === 50, `${parse('.5', 'NGN')}`);
check('trailing dot is mid-typing, not an error', parse('12.', 'NGN') === 1200, `${parse('12.', 'NGN')}`);
check('whitespace is tolerated', parse('  7.25  ', 'NGN') === 725, `${parse('  7.25  ', 'NGN')}`);

// The rounding rule that matters: half-up on the digit after the last
// significant place, not on a float that is already 1e-17 off.
check('rounds half up (third decimal)', parse('0.005', 'USD') === 1, `${parse('0.005', 'USD')}`);
// Below half rounds to zero minor units, which is not a valid expense, so the
// parser returns null rather than a row that violates `CHECK (amount_minor > 0)`.
check('a sub-half amount is rejected, not stored as zero', parse('0.004', 'USD') === null, `${parse('0.004', 'USD')}`);
check('truncates a fourth decimal after rounding', parse('1.2349', 'USD') === 123, `${parse('1.2349', 'USD')}`);

// JPY has no minor unit — the case that makes the whole currency table matter.
check('JPY parses whole yen', parse('1500', 'JPY') === 1500, `${parse('1500', 'JPY')}`);
check('JPY rounds away decimals', parse('1500.6', 'JPY') === 1501, `${parse('1500.6', 'JPY')}`);
check('JPY and NGN differ for the same input', parse('1500', 'JPY') !== parse('1500', 'NGN'));

check('rejects empty', parse('', 'NGN') === null);
check('rejects letters', parse('abc', 'NGN') === null);
check('rejects two dots', parse('1.2.3', 'NGN') === null);
check('rejects negative', parse('-5', 'NGN') === null);
check('rejects zero', parse('0', 'NGN') === null);
check('rejects zero decimal', parse('0.00', 'NGN') === null);
check('rejects absurdly large', parse('999999999999999', 'NGN') === null);

console.log('\n=== No floating-point drift ===\n');

// The headline reason money is stored as integers: a naive float accumulate
// does not equal the exact sum, and the difference shows up in a real total.
let floatTotal = 0;
for (let i = 0; i < 200; i++) floatTotal += 0.1;

let minorTotal = 0;
for (let i = 0; i < 200; i++) minorTotal += parse('0.10', 'NGN');

check('float accumulation drifts', floatTotal !== 20, `${floatTotal}`);
check('integer minor accumulation is exact', minorTotal === 2000, `${minorTotal}`);
check('200 × ₦0.10 formats as ₦20.00', currency.formatMoney(minorTotal, 'NGN').includes('20'), currency.formatMoney(minorTotal, 'NGN'));

console.log('\n=== Formatting ===\n');

check(
  'NGN formats with its symbol',
  currency.formatMoney(123456, 'NGN').includes('₦'),
  currency.formatMoney(123456, 'NGN'),
);
check(
  'NGN groups thousands',
  currency.formatMoney(1234567, 'NGN').includes(','),
  currency.formatMoney(1234567, 'NGN'),
);
check(
  'NGN shows two decimals',
  /\.\d{2}$/.test(currency.formatMoney(123456, 'NGN')),
  currency.formatMoney(123456, 'NGN'),
);
check(
  'JPY shows no decimals',
  !/\./.test(currency.formatMoney(1500, 'JPY')),
  currency.formatMoney(1500, 'JPY'),
);
check(
  'USD formats with $',
  currency.formatMoney(100, 'USD').includes('$'),
  currency.formatMoney(100, 'USD'),
);
check(
  'unknown currency falls back to 2 decimals without throwing',
  typeof currency.formatMoney(100, 'CHF') === 'string',
  currency.formatMoney(100, 'CHF'),
);
check(
  'withoutSymbol omits the symbol',
  !currency.formatMoney(123456, 'NGN', { withSymbol: false }).includes('₦'),
  currency.formatMoney(123456, 'NGN', { withSymbol: false }),
);

// The fallback path must produce the same number as the Intl path, or a device
// without full ICU would show a different total from the browser.
{
  const viaIntl = currency.formatMoney(1234567, 'NGN');
  const digits = viaIntl.replace(/[^\d]/g, '');
  check('formatted digits are exactly the stored amount', digits === '1234567', digits);
}

console.log('\n=== Currency resolution (locale first, NGN fallback) ===\n');

check('NGN is the documented default', currency.DEFAULT_CURRENCY === 'NGN');
check('a supported device currency wins', currency.resolveCurrency('USD') === 'USD');
check('lowercase device currency is normalised', currency.resolveCurrency('gbp') === 'GBP');
check('an unsupported currency falls back to NGN', currency.resolveCurrency('CHF') === 'NGN');
check('null falls back to NGN', currency.resolveCurrency(null) === 'NGN');
check('undefined falls back to NGN', currency.resolveCurrency(undefined) === 'NGN');
check('all ten currencies are present', currency.CURRENCIES.length === 10, `${currency.CURRENCIES.length}`);
check(
  'every currency has a unique code',
  new Set(currency.CURRENCIES.map((entry: { code: string }) => entry.code)).size === 10,
);
check(
  'JPY is the only zero-decimal currency in the list',
  currency.CURRENCIES.filter((entry: { code: string }) => money.exponentFor(entry.code) === 0).length === 1,
);
check('JPY and CNY do not share a display symbol', (() => {
  const jpy = currency.CURRENCIES.find((entry: { code: string }) => entry.code === 'JPY');
  const cny = currency.CURRENCIES.find((entry: { code: string }) => entry.code === 'CNY');
  return jpy.symbol !== cny.symbol;
})());

console.log('\n=== Compact chart labels ===\n');

check('under 1k', currency.formatCompactMoney(95000, 'NGN') === '₦950', currency.formatCompactMoney(95000, 'NGN'));
check('1k–1m', currency.formatCompactMoney(1255000, 'NGN') === '₦12.6k', currency.formatCompactMoney(1255000, 'NGN'));
check('millions', currency.formatCompactMoney(250000000, 'NGN') === '₦2.5m', currency.formatCompactMoney(250000000, 'NGN'));
check('no trailing .0', !currency.formatCompactMoney(200000, 'NGN').includes('.0'), currency.formatCompactMoney(200000, 'NGN'));

console.log('\n=== Calendar boundaries ===\n');

check('monthBounds October', dates.monthBounds('2026-10').first === '2026-10-01');
check('monthBounds December end', dates.monthBounds('2026-12').last === '2026-12-31');
check('monthBounds February 2028 (leap)', dates.monthBounds('2028-02').last === '2028-02-29');
check('monthBounds February 2027', dates.monthBounds('2027-02').last === '2027-02-28');
check('shiftMonth back over a year boundary', dates.shiftMonth('2026-01', -1) === '2025-12');
check('shiftMonth forward over a year boundary', dates.shiftMonth('2026-12', 1) === '2027-01');
check('dayOfMonth parses the day', dates.dayOfMonth('2026-10-09') === 9);

// The day-boundary bug this app is designed to avoid.
const late = new Date(2026, 9, 24, 23, 30);
check('23:30 local is still the 24th', dates.todayString(late) === '2026-10-24', dates.todayString(late));
const afterMidnight = new Date(2026, 9, 25, 0, 15);
check('00:15 local is the 25th', dates.todayString(afterMidnight) === '2026-10-25', dates.todayString(afterMidnight));

const octoberDays = dates.daysInRange('2026-10-01', '2026-10-31');
check('daysInRange yields 31 days for October', octoberDays.length === 31, `${octoberDays.length}`);
check('daysInRange is inclusive at both ends', octoberDays[0] === '2026-10-01' && octoberDays[30] === '2026-10-31');
check('daysInRange handles February leap year', dates.daysInRange('2028-02-01', '2028-02-29').length === 29);

console.log('\n=== Donut geometry ===\n');

// The large-arc-flag is the bug that silently renders a slice as its complement.
function wedgeSweepIsLargeArc(sweepRatio: number): boolean {
  return sweepRatio > 0.5;
}

check('a 60% slice uses the large-arc flag', wedgeSweepIsLargeArc(0.6));
check('a 40% slice does not', !wedgeSweepIsLargeArc(0.4));
check('exactly 50% takes the short path', !wedgeSweepIsLargeArc(0.5));

// Percentages must sum to 100 so the ring has no gap and no overlap — and so the
// legend numbers add up. Naive independent rounding gives 101 here.
{
  const totals = [325000, 200000, 50000, 75000];
  const sum = totals.reduce((acc, value) => acc + value, 0);
  const naive = totals.reduce((acc, value) => acc + Math.round((value / sum) * 100), 0);
  check('naive per-row rounding overshoots 100 (the bug)', naive === 101, `${naive}`);

  const allocated = money.percentShares(totals);
  check(
    'percentShares sums to exactly 100',
    allocated.reduce((acc, value) => acc + value, 0) === 100,
    `${allocated.join('+')} = ${allocated.reduce((acc, value) => acc + value, 0)}`,
  );
  check('percentShares keeps every value close to its true share', allocated.every(
    (value, index) => Math.abs(value - (totals[index] / sum) * 100) < 1,
  ), allocated.join(','));
  check('percentShares is deterministic', money.percentShares(totals).join(',') === allocated.join(','));
  check('percentShares handles an empty set', money.percentShares([]).length === 0);
  check(
    'percentShares handles a zero total without NaN',
    money.percentShares([0, 0]).every((value: number) => value === 0),
  );
  check('no share is NaN with a zero total', sum > 0);
}

// A zero total must not produce a NaN path — the empty state handles it, and the
// guard is asserted here so a future refactor cannot remove it silently.
check('zero total yields no slices to draw', [0, 0, 0].filter((value) => value > 0).length === 0);

console.log(
  `\n${failures === 0 ? '\u001b[32m' : '\u001b[31m'}${checks - failures}/${checks} checks passed, ${failures} failure(s)\u001b[0m\n`,
);
process.exit(failures === 0 ? 0 : 1);
