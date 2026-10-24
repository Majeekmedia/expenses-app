# Majeek Expenses — Implementation Plan

**App #3 of the Majeek mobile portfolio.**
Status: **Plan review** — no feature code written yet.
Written: 2026-10-24 · Est. 4–5 days (roadmap §6)

Naming per [`CONVENTIONS.md`](../../../docs/CONVENTIONS.md) §1:
display `Majeek Expenses` · slug `majeek-expenses` · `com.majeek.expenses` ·
scheme `majeekexpenses` · folder and repo `expenses-app`.

---

## 1. Goal

A personal expense tracker that stores everything **on the device in SQLite**, computes its
totals with **SQL aggregates** rather than in the UI, draws its charts with **vectors we
control**, and formats money with a **single tested code path**.

It is the first app in the portfolio with a real relational schema, so the thing being
demonstrated is not "an expense list" — it is **correct data modelling over time**
(integer money, local calendar days, `GROUP BY`), plus charts that render identically on
web and Android.

---

## 2. Scope

### In

| Area | Included |
|---|---|
| Expenses | add, edit, delete, note, date, category |
| Categories | seed defaults, add, rename, recolour, archive (no delete when in use) |
| Totals | month total, per-category totals, per-day totals — all via SQL |
| Charts | donut of spend by category, bar chart of spend by day, month switcher |
| Budget | one monthly cap, progress bar, over/under state |
| Money | integer minor units, `Intl.NumberFormat`, currency picker (NGN default) |
| Data | SQLite with `PRAGMA user_version` migrations, seed + reset for demos |

### Out (and why)

| Excluded | Reason |
|---|---|
| **CSV export** | `expo-file-system` documents **Android/iOS/tvOS only — no web** (verified in the SDK 57/58 docs), and sharing adds a platform-divergent code path. The roadmap already assigns "PDF/CSV export" to **App #5, Majeek Budget**. Deferring it is consistent with the roadmap, not a shortcut. |
| Recurring expenses | Needs a scheduler and catch-up logic; a week of work on its own |
| Income / net balance | Turns a tracker into a ledger; App #5 territory |
| Multi-currency conversion | Rates need a network call and a cache — the one thing this app otherwise does not need |
| Accounts / wallets | Relational depth that App #5 exercises better |
| Cloud sync / auth | That is App #4 onward |
| Attachments / receipts | `expo-image-picker` + file storage is App #6 |

---

## 3. Decisions requested in the brief

### 3.1 Charts — **hand-drawn SVG** (recommended, and not for the reason assumed)

The brief's lean was right, but the stated reason was wrong, and the wrong reason would
have led to a bad fallback. Verified against the published packages:

- **`victory-native` v43 requires `react-native-skia@^2.15.1`** (plus Reanimated 4 and
  Worklets). Skia is **not bundled in Expo Go** → it forces a custom dev build and breaks
  the free QR workflow. **Rule out.** Note the brief described it as "Skia-based, needs
  verification" — verified, and the answer is no.
- **`react-native-gifted-charts` is safe**, contrary to the brief's worry. Its install
  line is `expo install react-native-gifted-charts expo-linear-gradient react-native-svg`,
  and all three are in Expo Go. It is a legitimate option.
- **Hand-drawn SVG** (`react-native-svg`, already a weather-app dependency and in Expo Go)
  has zero new dependencies, identical output on web and Android, and is exactly the skill
  this app's roadmap line ("charts") is meant to teach.

**Recommendation: hand-drawn SVG.** Two charts only — a donut and a bar series — is well
under the point where a charting library earns its keep, and we keep full control of
layout at 360px, which is where App #2's bugs lived. If we later want area/line/stacked
charts, `react-native-gifted-charts` is the drop-in and is Expo Go-safe.

### 3.2 SQLite on web — **option (a), with a defined fallback**

`expo-sqlite` web support is **alpha** and needs two things: `wasm` added to Metro's
`assetExts`, and a **cross-origin-isolated** page (`Cross-Origin-Embedder-Policy` +
`Cross-Origin-Opener-Policy`) so `SharedArrayBuffer` exists.

Losing browser verification would hurt: Apps #1–#2 produced their strongest evidence from
scripted browser interaction at 360–390px. But there is a way to keep SQL proof *without*
any browser, which changes the risk profile of this decision:

> **`node:sqlite` works on this machine.** Tested: Node **v22.14.0** with
> `--experimental-sqlite` created a table, inserted and aggregated — `sum=3, count=2`.
> So the real schema and the real query module can be executed against a **real SQLite
> engine in Node**, which is stronger evidence for "SQL read-back" than a browser ever gave.

**Plan:**
1. Configure web properly in `metro.config.js` (`assetExts.push('wasm')`) and inject the
   COOP/COEP headers into Metro's dev server through `server.enhanceMiddleware`.
2. Prove it: the page must report `crossOriginIsolated === true`, and a real
   `INSERT` → `SELECT` → `SUM` round-trip must return the inserted rows in the browser.
3. **Timeboxed fallback** if step 2 fails: keep the same `SqlDriver` interface and add a
   web driver backed by an in-memory store, while `scripts/verify-db.mts` carries the SQL
   correctness proof under `node:sqlite`. Browser verification then covers UI/layout only,
   and **that limitation gets written in the README and PROGRESS**, not glossed over.

The driver interface exists either way, because that is also what lets the query module be
tested outside the app.

### 3.3 Currency — **NGN default + a four-currency picker, display-only**

`Intl.NumberFormat` is free and correct for grouping and symbol placement. The picker
changes only how an amount is *displayed*; there is no conversion, so no data model
complication. Stored in `settings`.

**Risk to verify early:** `Intl` support in Hermes has historically been partial per
platform. Task 2 asserts `Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' })`
actually produces `₦1,234.56` **in Expo Go on the device**, not just in the browser, with a
hand-rolled formatter as the fallback.

### 3.4 Scope — **core + charts + a single monthly budget; export deferred**

Everything except CSV export, in one pass. The brief's own estimate (4–5 days) fits the
core; adding export would push into App #5's territory and its platform-divergent path.

**Recommendation on budget-vs-actual:** keep it to **one number** — a monthly cap — shown
as a progress bar and a reference line on the chart. Full budget-vs-actual (per-category
budgets, rollover) is App #5's teaching point and would compete with it.

---

## 4. Things in the brief I would change

1. **"Budget-vs-actual" overlaps App #5 (Majeek Budget).** #5 is described as "relations,
   aggregates, date grouping, PDF/CSV export". Ship a single monthly cap here, leave
   per-category budgets to #5.
2. **"Currency formatting" is a 30-minute item, not a feature.** It is reused App #5 anyway;
   don't spend a day on it.
3. **Charts + SQLite + currency + CRUD + budget is really two apps.** If the core runs long,
   cut the bar chart before cutting the tests — a chart with no verified numbers is worse
   than no chart.
4. **No `fetch` in this app.** The timeout rule from App #2 therefore does not apply, and
   the only network use is `npx expo start`. Worth stating so a future session does not
   look for a `fetch-with-timeout.ts` that is correctly absent.

---

## 5. Architecture

```
UI (routes + components)
        │  reads/writes through hooks only
        ▼
hooks/use-expenses.tsx        ← state, invalidation, optimistic delete
        │
        ▼
db/repository.ts             ← every SQL string lives here, typed
        │
        ▼
db/driver.ts  (interface)    ← exec / all / run / transaction
        ├── drivers/native.ts  → expo-sqlite (Android, iOS)
        └── drivers/web.ts     → expo-sqlite web  (fallback: in-memory, see §3.2)
        │
        ▼
db/schema.ts                 ← DDL + PRAGMA user_version migrations
```

**Rules this architecture enforces**

- **Money is an integer.** `amount_minor INTEGER` — kobo/cents. No `REAL` anywhere near
  money: `0.1 + 0.2` errors compound across a month of `SUM()`. Formatting to `₦1,234.56`
  happens only at render.
- **Dates are local calendar days**, stored as `TEXT 'YYYY-MM-DD'`. Not UTC timestamps —
  an expense at 23:30 local must not land on the next day. Month ranges are computed as
  `[first, last]` strings, which `BETWEEN` compares correctly.
- **Aggregates come from SQL** (`GROUP BY category_id`, `GROUP BY spent_on`), not from
  `reduce()` over a list in the render path. That is the "derived state" the app teaches.
- **Every SQL statement is parameterised.** `execAsync` does not escape; `runAsync` with
  bound parameters does. No template-interpolated user input.

### Schema

```sql
CREATE TABLE categories (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL UNIQUE,
  color     TEXT NOT NULL,
  icon      TEXT NOT NULL,
  sort      INTEGER NOT NULL DEFAULT 0,
  archived  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE expenses (
  id           INTEGER PRIMARY KEY,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  spent_on     TEXT NOT NULL,          -- 'YYYY-MM-DD', local day
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX idx_expenses_spent_on ON expenses(spent_on);
CREATE INDEX idx_expenses_category ON expenses(category_id);

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

Migrations keyed on `PRAGMA user_version`; `PRAGMA foreign_keys = ON` on every open.

### Screens

| Route | Purpose |
|---|---|
| `/` | This month: total, budget bar, recent expenses, add button |
| `/expense/[id]` | Add when `id` is `new`; edit and delete otherwise |
| `/stats` | Donut by category + bars by day, with a month switcher |
| `/categories` | Add / rename / recolour / archive |
| `/settings` | Currency, monthly budget, seed demo data, clear all |

Six distinct screenshots map to `/`, `/expense/new`, `/stats`, `/categories`,
`/settings`, and one filtered/long-list state of `/`.

---

## 6. File map

```
expenses-app/
├── app.json                     ← naming per CONVENTIONS §1
├── metro.config.js              ← wasm assets + COOP/COEP for expo-sqlite on web
├── docs/
│   ├── PLAN.md                  ← this file
│   ├── NOTES.md                 ← lessons, written progressively
│   └── screenshots/             ← 6 PNGs
├── scripts/
│   ├── verify-db.mts            ← real SQL against node:sqlite
│   ├── verify-logic.mts         ← money, month maths, aggregates, CSV-free formatting
│   ├── verify-contrast.mts      ← both colour schemes
│   ├── verify-docs.mjs          ← copied from weather-app, retargeted
│   ├── capture-screenshots.js   ← Playwright at 390px, hash-checked
│   └── reset-project.js
└── src/
    ├── app/
    │   ├── _layout.tsx          ← providers, stack, 4 background layers
    │   ├── index.tsx
    │   ├── stats.tsx
    │   ├── categories.tsx
    │   ├── settings.tsx
    │   └── expense/[id].tsx
    ├── components/
    │   ├── amount-text.tsx      ← the only place money is formatted
    │   ├── bar-chart.tsx        ← SVG
    │   ├── budget-bar.tsx
    │   ├── category-picker.tsx
    │   ├── donut-chart.tsx      ← SVG
    │   ├── expense-row.tsx
    │   ├── month-switcher.tsx
    │   ├── numeric-keypad.tsx
    │   ├── state-views.tsx
    │   ├── themed-text.tsx
    │   └── themed-view.tsx
    ├── constants/
    │   ├── categories.ts        ← default seed set + palette
    │   ├── navigation-theme.ts
    │   ├── palette.ts           ← per-scheme accents (CONVENTIONS §4)
    │   └── theme.ts
    ├── db/
    │   ├── driver.ts
    │   ├── repository.ts
    │   ├── schema.ts
    │   └── drivers/native.ts · drivers/web.ts
    ├── hooks/
    │   ├── use-color-scheme.ts · use-color-scheme.web.ts
    │   ├── use-expenses.tsx
    │   ├── use-settings.tsx
    │   └── use-theme.ts
    ├── lib/
    │   ├── currency.ts
    │   ├── dates.ts
    │   └── money.ts
    ├── types/
    │   └── expense.ts
    └── global.css
```

---

## 7. Ordered tasks, each with its verification

Scaffolding and toolchain only until §3 is agreed. **No feature code before that.**

| # | Task | Verification |
|---|---|---|
| 1 | Scaffold, strip template, apply Majeek naming, align all four background layers | `node -e` reads `app.json` and asserts name/slug/scheme/package; browser reports **exactly one** distinct background per scheme |
| 2 | **Toolchain proof, before any feature:** `expo-sqlite` installed; Metro wasm + COOP/COEP; a throwaway probe screen that writes and reads one row; `Intl` check | Browser: `crossOriginIsolated === true`, probe `INSERT`→`SELECT` returns the row, `Intl` output `₦1,234.56`. **Device:** same probe works in Expo Go via QR. If web isolation fails → invoke the §3.2 fallback and record it |
| 3 | Schema, migrations, drivers, seed categories | `node --experimental-sqlite scripts/verify-db.mts` creates the schema, seeds, and asserts `PRAGMA user_version`, table/column list, index list |
| 4 | Repository: CRUD + SQL aggregates | `verify-db.mts` inserts a fixture month, asserts `SUM` total, per-category sums, per-day sums, and that a delete removes exactly one row |
| 5 | Pure logic: money, dates, formatting | `node scripts/verify-logic.mts` — `123456`→`₦1,234.56`; 0.1+0.2 case in minor units; month boundaries for Feb/Dec; 23:30 local stays on its day |
| 6 | Expense list + add/edit/delete | Browser at 390px: create → appears → edit amount → total updates → delete → total returns |
| 7 | Donut + bar charts | Assert SVG `path`/`rect` counts match the data; wedge angles sum to 360°; zero-data renders an empty state, not a NaN path |
| 8 | Budget bar + month switcher | Set cap below spend → over-budget state; switch month → totals and charts change, verified by reading rendered text |
| 9 | Categories + settings screens | Rename a category → the expense list label changes everywhere; archive → hidden from picker, still on old expenses |
| 10 | Colour system, both schemes | `node scripts/verify-contrast.mts` — light accents ≥4.5:1 on white, dark on black, and the two schemes differ; exactly one background per scheme |
| 11 | Screenshots | `node scripts/capture-screenshots.js` at 390px: 6 PNGs, **6 distinct SHA256**, each target element geometrically inside the viewport |
| 12 | README + NOTES + verify-docs | `node scripts/verify-docs.mjs` passes; every embedded image exists |
| 13 | Push to GitHub | retry loop, 8 attempts; `git rev-parse HEAD` equals `origin/main`; 3 raw screenshot URLs return HTTP 200 |

---

## 8. Verification plan

**Automated, objective, no browser needed**
- `npx tsc --noEmit` → exit 0; no `any` in app code
- `scripts/verify-db.mts` under `node:sqlite` → real SQL read-back: schema, aggregates,
  delete semantics, `CHECK` constraint rejects `amount_minor = 0`
- `scripts/verify-logic.mts` → money/minor-unit maths and calendar boundaries
- `scripts/verify-contrast.mts` → both schemes
- `scripts/verify-docs.mjs` → docs match the tree

**Browser (Playwright, 390px)**
- `crossOriginIsolated === true` and a real write/read round-trip
- Create → edit → delete, reading totals back as text
- Zero elements clipped outside horizontal scrollers; sum of chart column widths against
  `viewport − padding`
- `document.querySelectorAll('button button').length === 0`, 0 console errors
- One distinct background per scheme

**Device (Expo Go, QR)**
- App opens, SQLite persists across a reload
- `Intl` currency output matches the browser
- Charts render as real vectors — **no emoji glyphs anywhere**

**Honest limits**
- Web SQLite is alpha upstream; if isolation fails we say so and verify SQL in Node instead
- Expo Go is a fixed SDK build; anything needing a config plugin cannot be tested there
- The demo video is the user's to record and is never committed

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| `expo-sqlite` web won't cross-origin isolate | Timeboxed in Task 2; `node:sqlite` harness carries SQL proof; fallback documented |
| `Intl` differs in Hermes | Assert on device in Task 2, hand-rolled formatter ready |
| Charts overflow 360px | Measure element right-edges vs `innerWidth`, as in App #2 |
| Money drifts | Integer minor units + `CHECK (amount_minor > 0)` + a rounding test |
| Day-boundary drift | Local `YYYY-MM-DD`, with a 23:30 test |

---

## 10. Open questions

1. **Currency picker or NGN only?** Plan assumes NGN default with 4 options, display-only.
2. **Monthly budget in v1?** Plan assumes yes, one number. Say the word and it moves to #5.
3. **CSV export:** plan defers it to App #5 as the roadmap does. Confirm.
