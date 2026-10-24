/**
 * Documentation consistency check.
 *
 * Run: node scripts/verify-docs.mjs
 *
 * **Why this exists (learned in App #2).** Every doc claims to be the source of
 * truth for the next session, but they are hand-maintained and drift. App #2's
 * `PLAN.md` still said "Draft — awaiting approval" with **all 12 task checkboxes
 * unticked** after the app had shipped and been pushed, and `NOTES.md`'s file map
 * listed a deleted script while omitting five real files. Nobody noticed, because
 * a human will not re-read six documents at the end of a session.
 *
 * This runs in a second and fails the build, so drift gets fixed while the
 * context is still fresh.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `import.meta.url` is percent-encoded and this workspace path contains a space
 * ("Majeek apps"), so it cannot be used as a filesystem path directly — doing so
 * produced `Majeek%20apps` and an ENOENT. `fileURLToPath` decodes it correctly.
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE = join(ROOT, '..', '..');

let failures = 0;
let checks = 0;

const check = (label, ok, detail = '') => {
  checks++;
  if (!ok) failures++;
  console.log(`${ok ? '\u001b[32mPASS\u001b[0m' : '\u001b[31mFAIL\u001b[0m'} ${label}${detail ? ` — ${detail}` : ''}`);
};

const read = (path) => readFileSync(path, 'utf8');

/** Every source file, so the documented map can be compared with reality. */
const walk = (dir, base = dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(relative(base, full).replace(/\\/g, '/'));
  }
  return out;
};

const appDocs = join(ROOT, 'docs');
const plan = read(join(appDocs, 'PLAN.md'));
const notes = read(join(appDocs, 'NOTES.md'));
const readme = read(join(ROOT, 'README.md'));
const progress = read(join(WORKSPACE, 'docs', 'PROGRESS.md'));
const resume = read(join(WORKSPACE, 'docs', 'RESUME.md'));

console.log('\n=== PLAN.md reflects reality ===\n');

// The plan's §7 task table must show real status, not just exist. An earlier
// version of this check looked for `- [ ]` checkboxes, found none, and passed
// vacuously — which is exactly the App #2 failure it was written to prevent, in a
// new costume. The table now carries a Status column, so it is checked directly.
check('the plan is marked approved, not draft', !/Status:\*\* Draft|awaiting approval|awaiting review/i.test(plan));

// The plan legitimately *mentions* 57 when narrating the correction (§3.5), so the
// assertion is that the plan's declared status line says 58 — not that the string
// "SDK 57" never appears, which would forbid recording the mistake at all.
// The number may be wrapped in bold markers (`SDK **58**`), so they are optional.
const statusLine = plan.match(/^Status:[^\n]*$/m)?.[0] ?? '';
check(
  'the plan declares SDK 58 in its status line',
  /SDK\s*\*{0,2}\s*58/.test(statusLine),
  `status line was: ${JSON.stringify(statusLine)}`,
);

// Every row of the §7 task table must have a status marker.
//
// Scoped to the §7 section deliberately: a naive whole-file regex also matched the
// numbered rows of the §10 open-questions table, which are questions rather than
// tasks and have no status.
const taskSection = plan.slice(plan.indexOf('## 7. Ordered tasks'), plan.indexOf('## 8. Verification'));
const taskRows = [...taskSection.matchAll(/^\|\s*\d+\s*\|.*\|$/gm)].map((match) => match[0]);
const untrackedRows = taskRows.filter((row) => !/(✅|⬜)/.test(row));
check(
  `all ${taskRows.length} §7 task rows carry a ✅/⬜ status`,
  taskRows.length > 0 && untrackedRows.length === 0,
  untrackedRows.map((row) => row.slice(0, 60)).join(' | '),
);

// The header sentence must agree with the table, or the plan contradicts itself.
const markedDone = taskRows.filter((row) => /✅/.test(row)).length;
const markedOpen = taskRows.filter((row) => /⬜/.test(row)).length;
const claimed = plan.match(/Status:\s*(\d+) of (\d+) complete/);
if (claimed) {
  const [, claimedDone, claimedTotal] = claimed;
  check(
    `the "${claimedDone} of ${claimedTotal} complete" claim matches the table`,
    Number(claimedDone) === markedDone && Number(claimedTotal) === taskRows.length,
    `table has ${markedDone} ✅ + ${markedOpen} ⬜ = ${taskRows.length} rows`,
  );
} else {
  check('the task table states how many are complete', false, 'add a "Status: N of M complete" line');
}

console.log('\n=== NOTES.md file map matches the tree ===\n');

// Paths mentioned in the fenced tree, e.g. "├── money.ts" or "│   └── expense.ts".
//
// Extensions are ordered longest-first (`tsx` before `ts`): in a regex alternation
// the first match wins, so `ts|tsx` would consume "index.ts" from "index.tsx" and
// leave a stray "x", reporting every component as a phantom file. `json` and `md`
// are included because the map legitimately lists `app.json`, `tsconfig.json` and
// the docs; excluding them reported real files as phantoms. Nested paths are
// reduced to their basename, so `expense/[id].tsx` still counts as `[id].tsx`.
const documented = new Set(
  [...notes.matchAll(/[├└│─\s]+([_a-z0-9[\]][_a-z0-9./[\]-]*\.(?:tsx|mts|mjs|json|mjs|md|ts|js|css))/gi)]
    .map((m) => m[1].split('/').pop()),
);

const actual = [
  ...walk(join(ROOT, 'src')).map((file) => file.split('/').pop()),
  ...readdirSync(join(ROOT, 'scripts')).filter((file) => /\.(js|mjs|mts)$/.test(file)),
];

const missingFromMap = actual.filter((name) => !documented.has(name));
check(
  `all ${actual.length} source/script files appear in the NOTES map`,
  missingFromMap.length === 0,
  missingFromMap.join(', '),
);

// A documented file that no longer exists is worse than an omission: it sends a
// future session looking for something that was deleted.
//
// `app.json`, `tsconfig.json` and the doc names live at the project root or in
// `docs/`, not under `src/`, so those locations are checked too.
const ROOT_LEVEL = new Set([
  'app.json',
  'tsconfig.json',
  'metro.config.js',
  'expo-env.d.ts',
  'package.json',
  'README.md',
  'PLAN.md',
  'NOTES.md',
  'global.css',
]);

const phantom = [...documented].filter((name) => {
  if (ROOT_LEVEL.has(name)) {
    return !existsSync(join(ROOT, name)) && !existsSync(join(ROOT, 'docs', name)) && !existsSync(join(ROOT, 'src', name));
  }
  const inSrc = walk(join(ROOT, 'src')).some((file) => file.endsWith(`/${name}`) || file === name);
  const inScripts = existsSync(join(ROOT, 'scripts', name));
  return !inSrc && !inScripts;
});
check('the map contains no files that do not exist', phantom.length === 0, phantom.join(', '));

console.log('\n=== Cross-document status agrees ===\n');

check('PROGRESS lists Expenses as in progress', /Expense tracker — \*\*Majeek Expenses\*\*/.test(progress));
check('PROGRESS records the SDK correction', /SDK 58/.test(progress) && /Expo Go/.test(progress));
check('RESUME mentions the Expenses app', /expenses-app|Majeek Expenses/.test(resume));

console.log('\n=== README embeds real screenshots ===\n');

const embedded = [...readme.matchAll(/\]\((docs\/screenshots\/[^)]+)\)/g)].map((m) => m[1]);
const brokenImages = embedded.filter((path) => !existsSync(join(ROOT, path)));
check(`all ${embedded.length} embedded screenshots exist`, brokenImages.length === 0, brokenImages.join(', '));
check('the README embeds at least 6 screenshots', embedded.length >= 6, `${embedded.length}`);
check('the README does not contain a placeholder', !/To be captured|TODO/i.test(readme));

console.log('\n=== No stale status wording anywhere ===\n');

const allDocs = [
  ['PLAN.md', plan],
  ['NOTES.md', notes],
  ['README.md', readme],
  ['PROGRESS.md', progress],
  ['RESUME.md', resume],
];
const stale = [];
for (const [name, body] of allDocs) {
  for (const phrase of ['awaiting approval', 'awaiting review', 'device-untested', 'not created yet', 'To be captured']) {
    if (body.includes(phrase)) stale.push(`${name}: "${phrase}"`);
  }
}
check('no document still claims the app is unbuilt or unreviewed', stale.length === 0, stale.join('; '));

console.log(`\n${failures === 0 ? '\u001b[32m' : '\u001b[31m'}${checks - failures}/${checks} checks passed, ${failures} failure(s)\u001b[0m\n`);
process.exit(failures === 0 ? 0 : 1);
