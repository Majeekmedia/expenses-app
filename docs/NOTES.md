# Majeek Expenses — Technical Notes

> Deep technical detail for App #3. The plan of record is [`PLAN.md`](./PLAN.md);
> this file records what was actually built, what broke, and why the code looks the
> way it does.

**Stack:** Expo SDK **58** · React Native 0.88.0 · React 19.3.0 · TypeScript 6 ·
Expo Router 58 · `expo-sqlite` 58 · `react-native-svg` 15.16.0 · Node v22.14.0

---

## 1. The SDK mistake, in full

The plan recommended **SDK 57**, reasoning that Apps #1 and #2 shipped on 57 and their Expo
Go worked. The user scanned the QR code and Expo Go refused:

```
ERROR  Project is incompatible with this version of Expo Go
• The installed version of Expo Go is for SDK 58.
• The project you opened uses SDK 57.
```

**Expo Go updates itself from the app store.** It is not pinned to whatever the previous
project used, so "the last app's SDK" is not a valid anchor. Cost: one full install cycle,
plus a rebuild of every dependency at a second version.

Procedure now recorded in `docs/CONVENTIONS.md`:

1. Scaffold.
2. **Scan the QR immediately** — before feature code — and read the SDK out of the error, or
   ask the user what their Expo Go reports on launch.
3. Pin the project to that SDK.
4. `npm install expo@~<version>`, then `npx expo install --fix` to get the companion
   versions, which is authoritative. npm `dist-tags` are **not**: most packages have no
   `sdk-XX` tag, so `npm view <pkg> dist-tags.sdk-57` silently returns the `latest`
   version, which is a different SDK's.

Final pinned set: `expo ~58.0.19` · `expo-router ~58.0.26` · `expo-sqlite ~58.0.14` ·
`expo-localization ~58.0.5` · `react-native 0.88.0` · `react 19.3.0` ·
`react-native-svg 15.16.0` · `expo-system-ui ~58.0.6`.

---

## 2. SQLite on web does work — here is the whole recipe

`expo-sqlite`'s web support is flagged **alpha** upstream and needs two things that fail
silently and independently. `metro.config.js` supplies both:

```js
config.resolver.assetExts.push('wasm');           // 1. let Metro treat .wasm as an asset
config.server.enhanceMiddleware = (mw) => (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');       // 2a.
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');  // 2b.
  return mw(req, res, next);
};
```

Then the page must report `crossOriginIsolated === true`. Measured live:

```
HTTP 200
COOP: same-origin
COEP: credentialless
crossOriginIsolated: true
typeof SharedArrayBuffer: "function"
```

**`credentialless`, not `require-corp`.** `require-corp` also isolates the page, but forces
every third-party subresource to carry a CORP header — which breaks the Metro HMR websocket
and any remote asset during development. `credentialless` gives the same
`SharedArrayBuffer` access without that tax.

**These are development-only.** Metro does not control the production host, so a deployed
web build needs the same two headers from the host. `README.md` says so plainly rather than
leaving it implied.

**The failure mode is a misleading one.** Without isolation the app throws
`SharedArrayBuffer is not defined`, which reads like a bundler problem. `state-views.tsx`
therefore pattern-matches that message and renders a specific hint naming COOP/COEP, rather
than a generic error.

---

## 3. Why the SQL is verified without a browser

Node 22.14 ships `node:sqlite`, which is the same SQLite C library the app uses. So
`scripts/verify-db.mts` imports the **real** `src/db/schema.ts` and `src/db/repository.ts`
and runs them against a temporary on-disk database:

```powershell
node --experimental-sqlite --experimental-strip-types `
     --import ./scripts/register-alias.mjs scripts/verify-db.mts
```

That gives 49 assertions covering things a click-through cannot: that
`CHECK (amount_minor > 0)` actually rejects zero, that the foreign key rejects an orphan,
that `CHECK (spent_on GLOB ...)` rejects `10/24/2026`, that `SUM` excludes the adjacent
month, and that data and settings survive closing and reopening the file.

**The one obstacle was the `@/` alias**, which only Metro and TypeScript resolve. Rather
than duplicate the modules into the script (where they would drift and prove nothing),
`scripts/alias-loader.mjs` teaches Node the same mapping through a module resolver hook.
Sixteen lines, and the verification exercises the shipping code.

`scripts/verify-logic.mts` and `verify-contrast.mts` use the same hook, so `money.ts`,
`currency.ts`, `dates.ts` and `palette.ts` are all tested as shipped.

---

## 4. Bugs the tests caught

### `textMuted` failed AA — in light mode only

`#7C848E` measured **3.79:1 on white** and **3.50:1 on the card surface**, below the 4.5:1
threshold. It is the colour used for chart axis labels, so real content was affected. First
attempt at a fix, `#6B7280`, still failed at **4.47:1** on `surface` — close enough to look
fixed and not be. Final value `#646B78` measures 5.36:1 on white, 4.96:1 on `surface` and
4.62:1 on `surfaceAlt`.

The general lesson is the App #2 one, re-confirmed: **the dark scheme alone would have
passed**, because this token is only used as dark text on light surfaces.

### Percentages summed to 101%

`[325000, 200000, 50000, 75000]` with `Math.round(share * 100)` per row gives
`43 + 27 + 7 + 24 = 101`, which a user reads straight off the legend as arithmetic that
does not add up. Fixed with the largest-remainder method in `percentShares()`, which floors
every share and distributes the leftover points to the largest fractional parts. A test
asserts both the naive overshoot and the corrected exact-100 result.

### `12.` was rejected mid-typing

The amount regex was `\d+(\.\d+)?`, so typing `12.` flipped the field to "Not a valid
amount" for one keystroke. `\d+(\.\d*)?` accepts the trailing dot, which is a legitimate
half-typed state rather than an error.

### A sub-half amount

`parseAmountToMinor('0.004', 'USD')` rounds to `0` minor units, which would violate
`CHECK (amount_minor > 0)`. Returning `null` is correct: a ₦0.00 expense is not a thing.
The test originally asserted `0`, i.e. the test was wrong, not the code.

### The focus ring in screenshot 02

The add-expense screen `autoFocus`es the amount field, which is right on a phone — it is the
first thing anyone types. On web that focus draws a visible ring, which looks like a
selected or broken field in a static README image.

`capture-screenshots.js` now calls `clearFocus()` immediately before the shutter (twice: once
after layout settles, once after the viewport assertion scrolls and can restore it). Verified
rather than assumed: `document.activeElement` went from `INPUT` to `BODY`, and the computed
style reported `outline: none 3px` and `box-shadow: none`.

This is a **presentation** fix only — `autoFocus` stays in the app. The trap to remember is
that any screenshot of a form with an autofocused field needs an explicit blur first.

### Retaking a single screenshot

`ONLY=02 node scripts/capture-screenshots.js` captures one shot. Shots carry a `needsData`
flag, so the entry form can be retaken without a successful seed run first. A single-shot run
reports `(single-shot run: uniqueness across all 6 not checked)` instead of pretending to
have checked uniqueness.

### `fontVariant: ['tabular-nums'] as const`

Fails type-check. `TextStyle.fontVariant` is a **mutable** `FontVariant[]`, so a `readonly`
tuple is not assignable, and the error surfaces at every `Text` call site rather than at the
constant. Declared with an explicit mutable type instead.

### ~39 phantom `TS7016` errors after a botched install

`npx expo install --fix` hit ERESOLVE peer conflicts, was interrupted, and left
`node_modules/react-native/types/` containing only `tsconfig.json` — the whole `types/`
tree was gone. Every file reported `Could not find a declaration file for module
'react-native'`, which looks like a source problem and is an install problem. Fix: delete
`node_modules` and `package-lock.json`, install once cleanly.

---

## 5. Design decisions worth remembering

**`expenses.currency` is per row.** The currency picker is display-only, and the code that
was saved travels with the amount. Without this column, switching NGN→JPY would reinterpret
a stored `1500` from ₦15.00 into ¥1,500 — the same integer, two very different amounts. JPY
having zero decimal places is what makes this structural rather than theoretical.

**Archiving, not deleting, categories.** A hard `DELETE` would orphan every expense that
referenced the category. `ON DELETE` was deliberately left at SQLite's default (no action)
so a delete cannot silently cascade; the UI offers archive instead, and archived categories
still label their historical expenses.

**Re-read after every write.** The month total is a SQL aggregate, so patching an in-memory
array after an edit would show a total the database disagrees with. Every mutation calls
`load()` again. It is cheap on a local file and keeps the aggregate honest.

**Charts are SVG laid out from measured width.** SVG children do not participate in flex
sizing, so a `<Rect width="100%">` inside an unbounded `Svg` renders at an arbitrary
intrinsic size and clips. `bar-chart.tsx` measures with `onLayout` and derives all geometry
from that. The donut flips the SVG **large-arc flag** above 50%, because a slice wider than
half the ring otherwise renders as its complement — plausible-looking and wrong.

**Zero-spend days are drawn.** `daysInRange` fills the gaps so the bar chart shows real
calendar time; sending only days that have expenses turns a gap into an invisible day with
spending.

**Nav is its own row.** App #2 clipped its header to "Loc" at 360px because a 48px title and
three links shared one line. Here the title sits above and the links are a separate row of
fixed-size targets, so neither can squeeze the other.

---

## 6. File map

```
expenses-app/
├── app.json
├── metro.config.js
├── expo-env.d.ts
├── tsconfig.json
├── README.md
├── docs/
│   ├── PLAN.md
│   ├── NOTES.md
│   └── screenshots/
├── scripts/
│   ├── alias-loader.mjs
│   ├── register-alias.mjs
│   ├── verify-db.mts
│   ├── verify-logic.mts
│   ├── verify-contrast.mts
│   ├── verify-docs.mjs
│   └── capture-screenshots.js
└── src/
    ├── app/
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   ├── stats.tsx
    │   ├── categories.tsx
    │   ├── settings.tsx
    │   └── expense/
    │       └── [id].tsx
    ├── components/
    │   ├── amount-text.tsx
    │   ├── bar-chart.tsx
    │   ├── budget-bar.tsx
    │   ├── category-icon.tsx
    │   ├── category-picker.tsx
    │   ├── donut-chart.tsx
    │   ├── expense-row.tsx
    │   ├── month-switcher.tsx
    │   ├── screen.tsx
    │   ├── state-views.tsx
    │   ├── themed-text.tsx
    │   ├── themed-view.tsx
    │   └── ui-icon.tsx
    ├── constants/
    │   ├── navigation-theme.ts
    │   ├── palette.ts
    │   └── theme.ts
    ├── db/
    │   ├── provider.tsx
    │   ├── repository.ts
    │   ├── schema.ts
    │   └── drivers/
    │       └── native.ts
    ├── hooks/
    │   ├── use-color-scheme.ts
    │   ├── use-color-scheme.web.ts
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

## 7. Verification commands

```powershell
& node .\node_modules\typescript\bin\tsc --noEmit

node --experimental-sqlite --experimental-strip-types --import ./scripts/register-alias.mjs scripts/verify-db.mts
node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/verify-logic.mts
node --experimental-strip-types --import ./scripts/register-alias.mjs scripts/verify-contrast.mts
node scripts/verify-docs.mjs

node scripts/capture-screenshots.js   # needs the dev server on :8081
```

`npx tsc` on this machine resolves to the unrelated `tsc` npm package and tries to install
it, which is why the local binary is invoked by path.
