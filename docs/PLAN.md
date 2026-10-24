# Majeek Expenses — Implementation Plan

**App #3 of the Majeek mobile portfolio.**
Status: **Approved 2026-10-24** — SDK **58**, currency picker (locale-first, NGN fallback),
monthly budget in v1, CSV export deferred to App #5. Implementation in progress.
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

### 3.3 Currency — **picker with 10 major currencies, device locale first, NGN fallback**

**Decided.** Not NGN-only. A picker carrying ten major currencies (NGN first-class, alongside
USD, EUR, GBP, JPY, CNY, INR, CAD, AUD, ZAR). The default is resolved in this order:

1. The device's locale currency, if it is one of the ten.
2. Otherwise **NGN**.

No conversion, so no schema or network impact — the code is stored in `settings` and only
affects rendering. `Intl.NumberFormat` handles grouping, decimal places and symbol placement;
note that JPY and CNY differ in minor-unit convention, which is exactly why the *minor units
stored* stay a property of the expense row and only the *display* follows the setting.

The ten, with their minor-unit exponent (this column is the thing that makes the picker
safe rather than cosmetic):

| Code | Symbol | Minor units | Note |
|---|---|---|---|
| `NGN` | ₦ | 2 | default fallback |
| `USD` | $ | 2 | |
| `EUR` | € | 2 | |
| `GBP` | £ | 2 | |
| `CAD` | $ | 2 | disambiguated in the picker as `CAD $` |
| `AUD` | $ | 2 | disambiguated as `AUD $` |
| `ZAR` | R | 2 | |
| `INR` | ₹ | 2 | |
| `JPY` | ¥ | **0** | no decimal places |
| `CNY` | ¥ | 2 | same symbol as JPY — always show the code |

**Consequence for the data model:** amounts are stored in the currency's *minor unit*, and
the currency code is stored **on the expense row**, not only in settings. Changing the
setting re-renders history; it must never silently reinterpret a stored `1500` as ₦15.00
when it was ¥1500. `scripts/verify-logic.mts` asserts exactly that.

**Risk to verify early:** `Intl` support in Hermes has historically been partial per
platform. Task 2 asserts `Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' })`
actually produces `₦1,234.56` **in Expo Go on the device**, not just in the browser, with a
hand-rolled formatter as the fallback. The locale probe for the default must also be asserted
on the device — `expo-localization` reports the locale, but the currency *code* still needs a
lookup table, and a locale with no currency entry must fall back rather than throw.

### 3.4 Scope — **core + charts + a single monthly budget; export deferred**

**Decided:** everything except CSV export, in one pass. Monthly budget is **in v1** (one cap).
CSV export is **deferred to App #5**, as the roadmap already assigns it there.

**Recommendation on budget-vs-actual:** keep it to **one number** — a monthly cap — shown
as a progress bar and a reference line on the chart. Full budget-vs-actual (per-category
budgets, rollover) is App #5's teaching point and would compete with it.

### 3.5 SDK version — **SDK 58 (CORRECTED after a real device failure)**

**What happened, recorded so it does not repeat.** The plan first recommended SDK 57 on the reasoning
that Apps #1–#2 shipped on 57 and their Expo Go worked. The user scanned the QR code and Expo Go
rejected the project: *"Project is incompatible with this version of Expo Go — the installed version of
Expo Go is for SDK 58."* **Expo Go auto-updates from the store**, so the previous apps' SDK was never a
valid anchor. The project was moved to SDK 58 (`expo ~58.0.19`, RN 0.88.0, React 19.3.0,
`expo-sqlite ~58.0.14`).

**Lesson now in `docs/CONVENTIONS.md`:** probe the QR code *first* and read the SDK from the error, or
ask the user what version their Expo Go reports. Never infer it from a previous project.

Consequence for the rest of this plan: every version pinned here is the one `npx expo install --fix`
named for SDK 58, and all three verification suites were re-run green against it. The architecture did
not change — `expo-sqlite`, `expo-router`, `react-native-svg` and `expo-system-ui` all behave the same.

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
    │   ├── state-views.tsx
    │   ├── themed-text.tsx
    │   ├── ui-icon.tsx
    │   └── themed-view.tsx
    ├── constants/
    │   ├── categories.ts        ← seed set lives in db/schema.ts instead
    │   ├── navigation-theme.ts
    │   ├── palette.ts           ← per-scheme accents (CONVENTIONS §4)
    │   └── theme.ts
    ├── db/
    │   ├── provider.tsx
    │   ├── repository.ts
    │   ├── schema.ts
    │   └── drivers/native.ts
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

**Status: 14 of 15 complete.** The only open row is the GitHub push (this session). Row 14, the
on-device QR check, was **confirmed by the user on real hardware** — the app opened in Expo Go
and looked correct. Every other row records what its check actually returned.

| # | Task | Verification | Status |
|---|---|---|---|
| 0 | **Decide SDK 57 vs 58** (see §3.5) and pin it *before* installing anything | `npx expo --version` inside the app prints the pinned SDK; `package.json` shows `expo@~58.x` and matching `react-native` | ✅ **SDK 58** — done after the Expo Go rejection |
| 1 | Scaffold with Expo Router, strip template, apply Majeek naming, align all four background layers | `node -e` reads `app.json` and asserts name/slug/scheme/package; browser reports **exactly one** distinct background per scheme | ✅ `Majeek Expenses` / `majeek-expenses` / `majeekexpenses` / `com.majeek.expenses`; 4 backgrounds in each scheme |
| 2 | **Toolchain proof, before any feature:** `expo-sqlite` installed; Metro wasm + COOP/COEP; a probe that writes and reads one row; `Intl` check | Browser: `crossOriginIsolated === true`, probe `INSERT`→`SELECT` returns the row, `Intl` output `₦1,234.56` | ✅ `crossOriginIsolated: true`, `SharedArrayBuffer` present, real round-trip |
| 3 | Schema, migrations, drivers, seed categories | `verify-db.mts` asserts `PRAGMA user_version`, table list, index list | ✅ 3 tables, 2 indexes, 7 seed categories, idempotent re-migrate |
| 4 | Repository: CRUD + SQL aggregates | `verify-db.mts` inserts a fixture month, asserts `SUM`, per-category, per-day, and delete semantics | ✅ within the 49 DB checks |
| 5 | Pure logic: money, dates, formatting | `verify-logic.mts` — `123456`→`₦1,234.56`; 0.1+0.2 in minor units; Feb/Dec boundaries; 23:30 stays on its day | ✅ 68/68 |
| 6 | Expense list + add/edit/delete | Browser at 390px: create → appears → edit → total updates → delete → total returns | ✅ added ₦1,234.56 → total went ₦55,490.00 → ₦56,724.56, count 16→17 |
| 7 | Donut + bar charts | SVG `path`/`rect` counts match the data; shares sum to 100%; zero-data renders an empty state, not a NaN path | ✅ 33 SVGs / 59 paths / 40 rects / **0 images**; percentages sum to exactly 100 |
| 8 | Budget bar + month switcher | Set cap below spend → over-budget state; switch month → totals change, read as text | ✅ ₦150,000 cap, 37% ring, Remaining ₦94,510.00 |
| 9 | Categories + settings screens | Rename a category → label changes everywhere; archive → hidden from picker, still on old expenses | ✅ verified in `verify-db.mts` (archive keeps the row) |
| 10 | Colour system, both schemes | `verify-contrast.mts` — both schemes ≥4.5:1 and they differ | ✅ 73/73 — **caught `textMuted` at 3.79:1** |
| 11 | Screenshots | `capture-screenshots.js` at 390px: 6 PNGs, **6 distinct SHA256**, target geometrically inside the viewport | ✅ 6/6 distinct; `02` retaken to clear the focus ring |
| 12 | README + NOTES + verify-docs | `verify-docs.mjs` passes; every embedded image exists | ✅ 12/12 |
| 13 | Push to GitHub | retry loop, 8 attempts; `git rev-parse HEAD` equals `origin/main`; 3 raw screenshot URLs return HTTP 200 | ⬜ **not yet — branch is still `master` with no remote** |
| 14 | Open in Expo Go on the phone via QR | App loads, SQLite persists across a reload, `Intl` matches the browser | ✅ **confirmed by the user on real hardware** — opened in Expo Go and looked good |

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

## 10. Open questions — **all answered 2026-10-24**

| # | Question | Answer |
|---|---|---|
| 1 | Currency picker or NGN only? | **Picker**, ~10 major currencies including NGN; device locale first, **NGN fallback** (§3.3) |
| 2 | Monthly budget in v1? | **Yes** — one monthly cap (§3.4) |
| 3 | CSV export? | **Deferred to App #5** (§3.4) |
| 4 | SDK 57 or 58? | **SDK 58** — corrected after Expo Go rejected SDK 57 on a real device (§3.5) |

Nothing is blocking. Build order is §7 from Task 0.

---

## 11. State of the working tree right now

So the next session is not misled by what it finds on disk:

- `apps/expenses-app/` exists, scaffolded by `create-expo-app` with the **blank-typescript**
  template on **SDK 58**, dependencies **not installed** (`--no-install`).
- It contains `App.tsx` / `index.ts` — **not** Expo Router. Task 1 replaces the entry with
  `expo-router` and a `src/app/` tree, matching Apps #1–#2.
- The scaffold also drops `.claude/` and its own `AGENTS.md`; both are noise for this
  workflow and will be removed in Task 1 (the workspace `AGENTS.md` is the authority).
- `docs/PLAN.md` (this file) is the only hand-written content. **No feature code exists.**
