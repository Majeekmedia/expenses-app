/**
 * Captures the six README screenshots at phone width, and proves they differ.
 *
 * Run: node scripts/capture-screenshots.js      (dev server must be on :8081)
 *
 * Lessons baked in from App #2, where a screenshot passed its checks while showing
 * the wrong screen:
 *
 *  1. **Hash every capture.** A byte-identical duplicate is the failure mode a
 *     "did it render?" assertion cannot catch — App #2 shipped `02-daily`
 *     identical to `01-today` because a scroll silently did nothing while the text
 *     assertions still passed (the words were in the DOM, just off-screen).
 *  2. **Assert the target is geometrically inside the viewport**, after scrolling
 *     it there, not merely present in the document.
 *  3. **One browser context for all six shots.** A fresh context starts with an
 *     empty IndexedDB, so it has no expenses — which is exactly how a `/stats`
 *     capture ends up showing the empty state instead of the donut. It is also far
 *     slower: Metro re-serves the whole bundle per context. The colour scheme is
 *     switched with `emulateMedia` on the one context instead.
 */
const { chromium } = require('playwright');
const { createHash } = require('node:crypto');
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const BASE = process.env.BASE_URL ?? 'http://localhost:8081';
const OUT = join(__dirname, '..', 'docs', 'screenshots');
const VIEWPORT = { width: 390, height: 844 }; // phone width, per CONVENTIONS §4
/** `ONLY=02` captures a single shot, for retaking one after a UI fix. */
const ONLY = process.env.ONLY;

/**
 * Each shot: a route, a scheme, and a text fragment that must end up visible.
 *
 * `needsData` is false only for the entry form, which renders the same whether or
 * not any expenses exist. It is skipped so the form can be retaken on its own with
 * `ONLY=02` without depending on a successful seed run first.
 */
const SHOTS = [
  { file: '01-home.png', path: '/', scheme: 'dark', expect: 'Spent this month', needsData: true },
  { file: '02-add-expense.png', path: '/expense/new', scheme: 'dark', expect: 'Save expense', needsData: false },
  { file: '03-stats.png', path: '/stats', scheme: 'dark', expect: 'BY CATEGORY', needsData: true },
  { file: '04-categories.png', path: '/categories', scheme: 'light', expect: 'ACTIVE', needsData: true },
  { file: '05-settings.png', path: '/settings', scheme: 'light', expect: 'CURRENCY', needsData: false },
  { file: '06-home-light.png', path: '/', scheme: 'light', expect: 'Spent this month', needsData: true },
];

/**
 * Waits for a text fragment **without** reloading. Used while seeding.
 *
 * The reloading variant below is the wrong tool here: a reload resets the
 * confirmation message, so it turns a successful write into a timeout. It would
 * also re-run the page while a write is in flight.
 */
async function waitForTextStable(page, fragment, timeout = 45000) {
  await page.waitForFunction((needle) => document.body.innerText.includes(needle), fragment, {
    timeout,
  });
}

/**
 * Waits until a text fragment is present in the document, reloading if needed.
 *
 * A single `waitForFunction` proved flaky here: Metro occasionally serves the HTML
 * shell for a route it is still bundling, and the app then sits on the splash
 * while the websocket reconnects. Reloading once the bundle is warm resolves it,
 * and a diagnostic dump is written on the final failure so the next person does
 * not have to guess what the page actually showed.
 */
async function waitForText(page, fragment, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await page.waitForFunction(
        (needle) => document.body.innerText.includes(needle),
        fragment,
        { timeout: 30000 },
      );
      return true;
    } catch {
      if (attempt === attempts) {
        const dump = await page.evaluate(() => ({
          url: location.pathname,
          text: document.body.innerText.slice(0, 300),
          ready: document.readyState,
        }));
        console.error(
          `  diagnostic for "${fragment}": url=${dump.url} ready=${dump.ready} text=${JSON.stringify(dump.text)}`,
        );
        return false;
      }
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);
    }
  }
  return false;
}

/** Scrolls the fragment into view, then asserts it is *inside* the viewport. */
async function assertInsideViewport(page, fragment) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const inside = await page.evaluate((needle) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (!node.textContent || !node.textContent.includes(needle)) continue;
        const element = node.parentElement;
        if (!element) continue;
        element.scrollIntoView({ block: 'center', behavior: 'instant' });
        const rect = element.getBoundingClientRect();
        // Must be inside the viewport AND have real size — a collapsed or
        // `opacity: 0` reveal passes a naive presence check and fails this one.
        if (rect.top >= -1 && rect.bottom <= window.innerHeight + 1 && rect.width > 0) {
          return true;
        }
      }
      return false;
    }, fragment);
    if (inside) return true;
    await page.waitForTimeout(800);
  }
  return false;
}

/**
 * Removes the keyboard-focus ring before the pixels are taken.
 *
 * The add-expense screen deliberately `autoFocus`es the amount field, because on a
 * phone that is the first thing a person types. On web that focus is drawn as a
 * visible ring around the input, which is correct behaviour but looks like a
 * selected/broken field in a static README image. The focus stays in the app; only
 * the screenshot is taken from a neutral state.
 */
async function clearFocus(page) {
  await page.evaluate(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  });
  // One frame for the ring to disappear, plus a beat for any transition.
  await page.waitForTimeout(400);
  const stillFocused = await page.evaluate(
    () => document.activeElement !== null && document.activeElement !== document.body,
  );
  if (stillFocused) {
    // A second click on neutral chrome is the fallback when `blur()` is swallowed
    // by a handler that re-focuses.
    await page.mouse.click(VIEWPORT.width - 4, 4);
    await page.waitForTimeout(300);
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  const shots = ONLY ? SHOTS.filter((shot) => shot.file.startsWith(ONLY)) : SHOTS;
  if (ONLY && shots.length === 0) {
    throw new Error(`ONLY="${ONLY}" matched no shot`);
  }

  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: 'dark',
    deviceScaleFactor: 2,
    byPassCSP: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const httpErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 160));
  });
  // A bare "Failed to load resource: 500" says nothing actionable. Log the URL so
  // the next person can tell a Metro hiccup on an optional dev endpoint from a
  // real app failure.
  page.on('response', (response) => {
    if (response.status() >= 400) {
      httpErrors.push(`${response.status()} ${response.url().slice(0, 140)}`);
    }
  });

  // ---- Seed once, through the real UI (only if a requested shot needs data) --
  const seedNeeded = shots.some((shot) => shot.needsData);
  if (!seedNeeded) {
    console.log('skipping seed — no requested shot depends on expense data');
  } else {
    // `networkidle` TIMES OUT on Metro, which holds an open websocket.
    await page.goto(BASE + '/settings', { waitUntil: 'domcontentloaded', timeout: 90000 });
    await waitForTextStable(page, 'Add sample data');

    // Give React time to attach its handlers. `waitForFunction` can match the
    // server-rendered text before hydration, and a click at that moment is a no-op
    // — which is how an earlier run "seeded" nothing and produced a ₦0.00 home
    // screen with no budget line.
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: /Add sample data/ }).click();
    await waitForTextStable(page, 'Added 16 sample expenses');
    console.log('seeded 16 sample expenses through the UI');

    await page.getByLabel('Monthly budget').fill('150000');
    await page.getByRole('button', { name: 'Save budget' }).click();
    await waitForTextStable(page, 'Budget set to');
    console.log('budget set to 150000 minor units (₦1,500.00)');

    // Then confirm the effect survives a navigation, which is the real test that
    // the rows are in SQLite and not just in React state.
    const seededTotal = '₦55,490.00';
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 90000 });
    if (!(await waitForText(page, seededTotal))) {
      throw new Error(`seeding failed: home total never showed ${seededTotal}`);
    }
    console.log(`verified after navigation: home shows ${seededTotal} across 16 expenses`);
  }

  // ---- Capture ------------------------------------------------------------
  const hashes = new Map();
  let currentScheme = 'dark';

  for (const shot of shots) {
    if (shot.scheme !== currentScheme) {
      await page.emulateMedia({ colorScheme: shot.scheme });
      currentScheme = shot.scheme;
    }

    await page.goto(BASE + shot.path, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const visible = await waitForText(page, shot.expect);
    if (!visible) {
      console.error(`FAIL ${shot.file} — "${shot.expect}" never appeared`);
      process.exitCode = 1;
      continue;
    }

    // Let SQLite finish its read and the SVG layout settle before pixels.
    await page.waitForTimeout(2000);

    // The focus ring must be gone before the shot — see `clearFocus`.
    await clearFocus(page);

    const inside = await assertInsideViewport(page, shot.expect);
    if (!inside) {
      console.error(`FAIL ${shot.file} — "${shot.expect}" never became visible in the viewport`);
      process.exitCode = 1;
    }

    // Re-assert focus is clear: `assertInsideViewport` scrolls, which can restore it.
    await clearFocus(page);

    const buffer = await page.screenshot({ fullPage: false });
    const file = join(OUT, shot.file);
    writeFileSync(file, buffer);

    const hash = createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 16);
    hashes.set(shot.file, hash);
    console.log(`${inside ? 'PASS' : 'FAIL'} ${shot.file.padEnd(22)} ${hash}  (${buffer.length} bytes)`);
  }

  await context.close();
  await browser.close();

  const unique = new Set(hashes.values());
  console.log(`\n${unique.size}/${hashes.size} distinct hashes`);
  // A single-shot run (ONLY=…) has nothing to compare against, so uniqueness is
  // only meaningful on a full run.
  if (!ONLY && unique.size !== shots.length) {
    console.error('FAIL — duplicate screenshots detected');
    process.exitCode = 1;
  } else if (!ONLY) {
    console.log('PASS — every screenshot is distinct');
  } else {
    console.log(`(single-shot run: uniqueness across all ${SHOTS.length} not checked)`);
  }

  if (httpErrors.length > 0) {
    console.error(`FAIL — ${httpErrors.length} HTTP error response(s):`);
    for (const error of [...new Set(httpErrors)].slice(0, 8)) console.error(`  ${error}`);
    process.exitCode = 1;
  } else {
    console.log('PASS — 0 HTTP errors across all captures');
  }

  // Console errors that are purely a consequence of an HTTP failure are reported
  // once, as the HTTP error above; listing both double-counts one cause.
  const independentConsoleErrors = consoleErrors.filter(
    (message) => !/Failed to load resource/i.test(message),
  );
  if (independentConsoleErrors.length > 0) {
    console.error(`FAIL — ${independentConsoleErrors.length} console error(s):`);
    for (const error of independentConsoleErrors.slice(0, 5)) console.error(`  ${error}`);
    process.exitCode = 1;
  } else {
    console.log('PASS — 0 independent console errors across all captures');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
