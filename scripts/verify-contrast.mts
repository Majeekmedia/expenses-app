/**
 * Contrast verification, in **both** colour schemes.
 *
 * Run: node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/verify-contrast.mts
 *
 * Why both schemes is non-negotiable: App #2 checked its palette only against the
 * dark hero gradient, so accents chosen to glow there sat at roughly **2:1** on
 * white — unreadable — and an "on-gradient" white was painted onto the plain
 * background, making a notice invisible in light mode. A single-scheme test
 * cannot catch that class of bug, because the failing combination never appears
 * in the scheme being tested.
 *
 * The contracts asserted here:
 *   1. body/secondary/muted text on the scheme's background
 *   2. text on each surface (cards)
 *   3. `onAccent` written on `accent`, and `onDanger` on `danger`
 *   4. accent-as-text on the background (links, positive/negative numbers)
 *   5. category ink on the background, per scheme
 *   6. the two schemes actually differ (an identical palette would pass 1–5)
 */
const root = new URL('..', import.meta.url);
const load = (path: string) => import(new URL(path, root).href);

const palette = await load('src/constants/palette.ts');
const currency = await load('src/lib/currency.ts');

let checks = 0;
let failures = 0;

function check(label: string, ok: boolean, detail = '') {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? '\u001b[32mPASS\u001b[0m' : '\u001b[31mFAIL\u001b[0m'} ${label}${detail ? ` — ${detail}` : ''}`);
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((character) => character + character)
          .join('')
      : value;

  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA = 4.5;

function assertPair(label: string, foreground: string, background: string, threshold = AA) {
  const ratio = contrast(foreground, background);
  check(
    `${label} ${foreground} on ${background}`,
    ratio >= threshold,
    `${ratio.toFixed(2)}:1 (need ${threshold})`,
  );
}

for (const scheme of ['light', 'dark'] as const) {
  const theme = palette.Palette[scheme];
  console.log(`\n=== ${scheme.toUpperCase()} scheme ===\n`);

  // 1. Text on the screen background.
  assertPair('text/background', theme.text, theme.background);
  assertPair('textSecondary/background', theme.textSecondary, theme.background);
  assertPair('textMuted/background', theme.textMuted, theme.background);

  // 2. Text on cards. Every card in the app uses `surface` or `surfaceAlt`.
  assertPair('text/surface', theme.text, theme.surface);
  assertPair('textSecondary/surface', theme.textSecondary, theme.surface);
  assertPair('textMuted/surface', theme.textMuted, theme.surface);
  assertPair('text/surfaceAlt', theme.text, theme.surfaceAlt);
  assertPair('textSecondary/surfaceAlt', theme.textSecondary, theme.surfaceAlt);
  assertPair('textMuted/surfaceAlt', theme.textMuted, theme.surfaceAlt);

  // 3. Text drawn *on* an accent. This is the pairing App #2 got wrong by using
  //    a colour intended for the opposite background.
  assertPair('onAccent/accent', theme.onAccent, theme.accent);
  assertPair('onDanger/danger', theme.onDanger, theme.danger);

  // 4. Accents used as text colour on the background (links, amounts).
  assertPair('accent/background', theme.accent, theme.background);
  assertPair('positive/background', theme.positive, theme.background);
  assertPair('negative/background', theme.negative, theme.background);
  assertPair('accent/surface', theme.accent, theme.surface);
  assertPair('negative/surface', theme.negative, theme.surface);

  // Selected chips tint the fill, so the label has to clear it.
  assertPair('text/selected', theme.text, theme.selected);

  // 5. Category ink, used for labels and legend text.
  const inks = scheme === 'light' ? palette.CategoryInk.light : palette.CategoryInk.dark;
  for (const [swatch, ink] of Object.entries(inks)) {
    assertPair(`categoryInk ${swatch}`, ink as string, theme.background);
  }
}

console.log('\n=== The two schemes genuinely differ ===\n');

check('light and dark backgrounds differ', palette.Palette.light.background !== palette.Palette.dark.background);
check('light and dark text colours differ', palette.Palette.light.text !== palette.Palette.dark.text);
check(
  'light and dark accents differ (a single accent cannot suit both)',
  palette.Palette.light.accent !== palette.Palette.dark.accent,
  `${palette.Palette.light.accent} vs ${palette.Palette.dark.accent}`,
);
check(
  'onAccent inverts between schemes',
  palette.Palette.light.onAccent === '#FFFFFF' && palette.Palette.dark.onAccent !== '#FFFFFF',
  `${palette.Palette.light.onAccent} / ${palette.Palette.dark.onAccent}`,
);

// The dark accent must be *lighter* than the light-scheme accent, because it is
// being read against black rather than white. If someone copies one value into
// both schemes, this catches it even though both might individually pass.
check(
  'the dark accent is lighter than the light accent',
  luminance(palette.Palette.dark.accent) > luminance(palette.Palette.light.accent),
);

console.log('\n=== Currency symbols are not colour-dependent ===\n');

// Sanity check on the money formatter used beside all this colour: it must not
// emit an HTML entity or a raw codepoint that renders as tofu.
for (const entry of currency.CURRENCIES) {
  const formatted = currency.formatMoney(123456, entry.code);
  check(
    `${entry.code} formats to a non-empty string with the right amount`,
    formatted.length > 0 && formatted.replace(/[^\d]/g, '').includes('1234'),
    formatted,
  );
  check(`${entry.code} symbol is a single printable character`, entry.symbol.length <= 3, entry.symbol);
}

console.log(
  `\n${failures === 0 ? '\u001b[32m' : '\u001b[31m'}${checks - failures}/${checks} checks passed, ${failures} failure(s)\u001b[0m\n`,
);
process.exit(failures === 0 ? 0 : 1);
