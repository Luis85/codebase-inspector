---
project: codebase-inspector
title: WP-02 — Inspector UI, Part 5: hardening and every deferred finding (design)
status: draft, awaiting approval
date: 2026-09-22
branch: feat/wp-02-part5 (from feat/wp-01-codebase-city at f05fd19). Not stacked: fast-forwarded into feat/wp-01-codebase-city, so it lands on PR #1.
baseline: f05fd19
---

# WP-02 design — Inspector UI, Part 5

These are binding:
- the Part 1 spec (`2026-09-21-inspector-ui-shell-design.md`, §9 A1–A13);
- the Part 2 spec (`2026-09-21-inspector-ui-part2-design.md`, P1–P14; P14 supersedes A1);
- the Part 3 spec (`2026-09-21-inspector-ui-part3-design.md`, Q1–Q17);
- the Part 4 spec (`2026-09-22-inspector-ui-part4-design.md`, W1–W17).

The Part 3 ledger (R1–R9, E1–E55) and the Part 4 ledger (S1–S27, X0–X19, "Part 4 E1–E22") are precedent. This document records only what Part 5 adds:
- city-internal fixes, once a line budget has been freed;
- review state kept per codebase, with a v2 export and a validated import;
- the owner's contrast decision #4;
- every finding deferred so far.

The scope letters follow the brief: A (city internals), B (review state per codebase), C (contrast #4), D (Part 3 leftovers) and E (Part 4 deferred minors).

## 1. Decisions

### A. City internals

| # | Question | Decision |
|---|---|---|
| V1 | How is `city-view.ts` (399/400) cut? | It is cut into two cohesive host modules, with no behaviour change.<br>• **`src/host/city-scan-controller.ts`**: class `CityScanController` owns the `ScanCoordinator`, the `startingScan` flag, `withScanGuard`, `startScan`, `selectCodebase`, `cancelScan`, `isScanRunning`, `cancelIfRunning` (for `onClose`) and `subscribe`. The module also exports **`provideScanCallbacks(app, controller)`**, which provides `onSelectCodebase` and `onScanRequested` into the Vue app.<br>• **`src/host/layout-publisher.ts`**: `createLayoutPublisher({ handle, nextGeneration, setCity, notify })` returns `{ publish(snapshot): Promise<void>; abort(): void }`. It holds the `AbortController` and the `computeLayout` / `setLayout` try-catches.<br>`CityView` keeps its public API as one-line delegations: `startScan`, `selectCodebase`, `cancelScan`, `isScanRunning`, `applyReconciliation`, `getState`/`setState`, `onOpen`/`onClose`. So `commands.ts`, the acceptance steps and every host test stay untouched. Target: ≤ 340 lines, which is 60 lines of headroom (the brief asks for ≥ 40). |
| V2 | How is `CityWorkspace.vue` (386) cut? | It is cut into three extractions, with no behaviour change.<br>• **`screens/city/use-city-escape.ts`**: the Escape chain (`onGlobalKeydown`, `attachKeydownListener`, detach on unmount, re-attach on migration). It takes `rootEl`, the store, the inspector opener, `filesDrawerOpen`, `narrowDrawer` and `closeFilesDrawer`.<br>• **`screens/city/use-city-floor.ts`**: `updateResponsiveLayout`, `forcedListByFloor`, `narrowDrawer` and the resize wiring.<br>• **`screens/city/CitySelectionNotice.vue`**: the COPY-30 notice and its two buttons. `revealSelection` moves with it.<br>Class names stay byte-identical (`ci-app__selection-notice`, `ci-selection-notice__reveal\|__clear`, `ci-welcome__action`). Target: ≤ 300 lines, which is 100 lines of headroom. |
| V3 | What guards the split? | These stay green without changes: every WP-01/WP-01b acceptance test, every `tests/host/*` test, and `tests/host/city-view-store-wiring.test.ts` (450/450, **not edited**). A new `tests/unit/city-budget.test.ts` asserts that both files are ≤ 360 lines, so the headroom cannot be spent without anyone noticing. Later tasks (V4–V7) change only the extracted modules, never the two files. |
| V4 | One ResizeObserver per leaf (Part 2 deferral) | App's `useLeafWidth` observer becomes the leaf's **only** leaf observer.<br>• A new `src/ui/shell/leaf-layout.ts` exports `provideLeafLayout(leafWidth, navInline)` and `injectLeafLayout()`. It provides `{ leafWidth, navInline, layoutTick }`.<br>• `layoutTick` increments in a `flush: 'post'` watcher on `[leafWidth, navInline]`, so readers measure after the nav column has been patched in.<br>• `use-city-floor.ts` watches `layoutTick` and calls `updateResponsiveLayout()`. It no longer observes the leaf or `.ci-shell__content`.<br>• When nothing is provided (CityScreen mounted alone in a test), it falls back to its own single leaf observer, so there is still exactly one per leaf.<br>CityViewport's **stage** observer is not a leaf observer and stays. |
| V5 | CameraControls re-measure (Part 2 deferral) | CameraControls watches the injected `layoutTick`. After every leaf-width or nav-inline change it re-applies `applyStepsDefault(stage)`. It stops doing so once **the user has toggled the steps themselves** (a `userToggled` flag set in `toggleSteps`): from then on, the user's choice wins. The `stepsCollapsed` test prop still overrides both. |
| V6 | Cancel a scan from the leaf (Part 4 S4) | `provideScanCallbacks` also provides **`onCancelScan`**, which calls `controller.cancelScan()`. That lives in the extracted module, so `city-view.ts` gains nothing.<br>The UI gets two Cancel controls. Both are named **"Cancel scan"**: `COPY_09` is reused, so the command name and the button agree. Both are always rendered, and both are **`aria-disabled="true"` unless `run.status === 'running'`**, with a guarded handler (E40/E44/E50).<br>• (a) The city toolbar (`AppToolbar.vue`), next to Scan. The toolbar is the city's scan-state control surface, and it never unmounts, so focus is never dropped when the run ends.<br>• (b) The Scan status panel on Data & scans. The button replaces `SOURCES_CANCEL_HINT`. The run line becomes `role="status"`, so "cancelling" and "cancelled" are announced there.<br>Pressing Cancel announces nothing itself (E17): the real outcome is the run state, which `AnnouncementRegion` already announces on the city. Cancel does not navigate. |
| V7 | Focus after in-leaf navigation | A new `src/ui/shell/use-route-focus.ts`, used by App. A `flush: 'pre'` watcher on `store.route` records whether focus was inside this leaf's shell before the patch. After the patch (`flush: 'post'`), one of three cases applies.<br>(1) Focus was inside the shell and **is no longer inside it**: the trigger unmounted, so focus fell to `<body>`. Focus moves to the new screen's first `.ci-page-header__title` inside `<main>` (PageHeader's `h2` gains `tabindex="-1"`). If there is none, focus moves to `<main>` itself (which gains `tabindex="-1"`). The focused heading is the announcement, so nothing else is announced.<br>(2) Focus was inside the shell and **still is** (nav column, palette, top bar): focus stays. A new visually hidden shell region with `role="status"` announces `ROUTE_OPENED(title)` ("Hotspots screen.") once, using the re-announce pattern.<br>(3) Focus was **not** in the shell (host-driven navigation, or a command from another pane): nothing moves and nothing is announced.<br>The city route counts as a screen (CityScreen has a PageHeader). `NoSnapshot` has no PageHeader, so it falls back to `<main>`. |

### B. Review state per codebase

| # | Question | Decision |
|---|---|---|
| V8 | Keying | `review-store` gains **`bindRepository(id: string)`**. App's existing repository watcher calls it next to `report.bindRepository`.<br>The store keeps a raw `Map<string, ReviewBucket>`, with `ReviewBucket = { repository: ReviewRepository; nextId: number; nextRuleId: number }`. That is one in-memory repository per `repositoryId`.<br>Binding does five things in order:<br>(a) store the current counters back into the current bucket;<br>(b) take the target bucket, or create it;<br>(c) set `repository` and the counters;<br>(d) **synchronously empty** `workItems`, `rules` and `dispositions`, so the previous codebase's items never render for even one frame;<br>(e) `await load()`.<br>Binding the same id again is a no-op. Before any snapshot, the store works on an unbound bucket under the key `''`. `setRepository` (tests) replaces the current bucket's repository. Nothing leaves memory: WP-05 adds the durable adapter behind the same port, keyed the same way. |
| V9 | In-flight operations across a switch | Every async action captures `const repo = this.repository` before its `await`. Afterwards it **mutates local state only if `this.repository === repo`**. `load()` follows the same rule.<br>A save that finishes after a switch is kept in its own codebase's repository. It returns its real result, because the save did happen, but it never appears in the other codebase's lists.<br>The pending arrays stay global, and each operation's `finally` removes only its own key. So while the old operation settles, a same-key action in the new codebase is refused for a moment. That is safe. |
| V10 | Report store | `report-store` is keyed the same way. `bindRepository` stashes `{ sections, note }` for the old id and restores the new id's pair (or the defaults), instead of resetting. Switching back therefore restores the note within the session. This amends Part 4 E8: the note still never crosses codebases, but it survives a round trip. |
| V11 | Export v2 | The schema becomes `codebase-inspector.review-state.v2`. It adds `source: { folder: string; repository: string } \| null`.<br>• `folder` is `rootFolderLabel(scope.rootPath)`: the last path segment only, never the absolute path.<br>• `repository` is `'fnv1a32:'` plus 8 hex digits of the `repositoryId`. It is never the raw id, which is the profile UUID and is embedded in every entity id.<br>• `source` is `null` when no codebase is on screen.<br>Everything else is unchanged from v1. An optional `warnings: string[]` appears only when something was left out (V12). |
| V12 | Never export an entity id verbatim | File targets and finding fingerprints are converted only with the **strict** `parseEntityId`. `entityPath`'s NUL-to-slash fallback would leak the repository id, so export never uses it.<br>These are **left out**:<br>• a disposition whose fingerprint has no `#`, or whose entity part does not parse;<br>• a file work item whose entity id does not parse.<br>When anything is left out, the JSON carries `warnings` with the counts (`REVIEW_STATE_SKIPPED(n, kind)`). A fingerprint never appears verbatim. |
| V13 | Import: where it reads from | Settings › Privacy & storage gains an **Import review state…** row.<br>• A visually hidden `<input type="file" accept=".json,application/json">` sits in the row's own template. It is never created with `document.createElement`, and nothing is read from the vault.<br>• The button calls `input.click()`, and the chosen `File` is read with `file.text()`. That file is the only thing read.<br>• Import is `aria-disabled` while no snapshot is on screen, with a visible hint tied to it by `aria-describedby`. Paths need the current codebase to become entity ids. |
| V14 | Import: validation (strict, zod, in `src/ui/read-models/review-state-import.ts`) | **File:** at most **1 MB**, checked with `File.size` before reading and with the text length after. A JSON parse error is refused.<br>**Top level:** a strict object with `schema` ∈ {v1, v2}, `exportedAt` (ISO), `note` (string ≤ 500, ignored), `workItems`, `rules`, `dispositions`, `report`, plus v2's `source` and the optional `warnings` (≤ 20 strings of ≤ 200 characters, ignored). An unknown key at any level is refused.<br>**Work items** (≤ 2000):<br>• `id` matches `/^wi-\d{1,6}$/` and is unique;<br>• `target` is one of `{kind:'file', path}`, `{kind:'package', name ≤ 214}` or `{kind:'module', module ≤ 255}`;<br>• `intent` is from the enum;<br>• `title` is 1–160 characters after trimming;<br>• `status` and `priority` are from their enums;<br>• `notes` is ≤ 5000;<br>• `checks` is a tuple of exactly three booleans;<br>• `createdAt` and the optional `updatedAt` are ISO;<br>• `(target, intent)` is unique;<br>• **`workItemProblem(item) === null`**, so `verified` requires all three checks.<br>**Rules** (≤ 500):<br>• `id` matches `/^AR-\d{3,6}$/` and is unique;<br>• `from` and `to` are 1–255 characters and different;<br>• `rationale` is 1–1000 after trimming;<br>• the pair is unique;<br>• `createdAt` is ISO.<br>**Dispositions** (≤ 5000):<br>• `finding` is `<path>#<findingId>`, with findingId matching `/^[A-Za-z0-9-]{1,64}$/`;<br>• `status` is `acknowledged` or `dismissed`;<br>• `reason` is required and 1–1000 after trimming when dismissed, and absent when acknowledged;<br>• `decidedAt` is ISO;<br>• `finding` is unique.<br>**Paths:** 1–1024 characters and relative (no leading `/` or `\`, no drive letter), with no `..` segment, no NUL and no backslash.<br>**Report:** `sections` is exactly the five booleans, and `note` is ≤ 5000.<br>**v2 `source`:** either `null`, or `folder` of 1–255 characters with `repository` matching `/^fnv1a32:[0-9a-f]{8}$/`.<br>A v2 `source.repository` that differs from the current codebase's digest is refused as **another codebase** (Part 4 E8/E11: review state is bound to its codebase). v1, and v2 with `source: null`, carry no source. They are accepted, and the dialog says the origin is unknown. |
| V15 | Import: errors | Each refusal shows one inline `role="alert"` message under the import row (`IMPORT_ERROR[code]`). The codes are `too-large`, `not-json`, `unknown-schema`, `invalid` (with the first issue's path, for example "workItems.2.title"), `other-codebase` (naming the file's folder label) and `read-failed`. A new pick clears the previous error first (re-announce pattern).<br>Imported text is only ever rendered through Vue text interpolation, never through `v-html`, `innerHTML` or `setAttribute('href', …)`. A test imports the title `<img src=x onerror=…>` and asserts that it renders as literal text. |
| V16 | Import: confirmation and replacement | A valid file opens **ImportReviewDialog** (`CiDialog`). It shows:<br>• the counts (`IMPORT_CONFIRM_TEXT(items, decisions, rules, hasNote)`);<br>• the origin: the folder label, or "unknown origin (v1)";<br>• a note that the current state will be replaced;<br>• the buttons **Replace review state** and **Cancel**.<br>Confirm is `aria-disabled` while busy. Cancel, Escape and the backdrop are ignored while busy (Part 4 E13).<br>Replacement is a new store action, **`replaceAll(state)`**. It refuses (returns false) while any operation is pending. Otherwise it removes every current item, rule and disposition through the port and saves every imported one through the port (`allSettled`, persist-first). It reloads in `finally` and rethrows the first rejection. File paths become `makeEntityId(repositoryId, 'file', path)`, and findings become `<that id>#<findingId>`. The report store takes the sections and note (`report.restore`).<br>Outcomes:<br>• `true` closes the dialog and announces `IMPORTED(items, decisions, rules)` in the Settings live region (E17). Only this result announces.<br>• A rejection shows `IMPORT_FAILED` in the dialog's `role="alert"`.<br>• `false` shows `IMPORT_BUSY` there.<br>Imported items that point at files missing from the snapshot are kept and read "Not in this snapshot", as today. |

### C. Contrast decision #4

| # | Question | Decision |
|---|---|---|
| V17 | Contrast #4 | **The owner decides this at the Phase 1 pause.** The measurements are in §4: harness, vendored Obsidian 1.12.4 `app.css`, WCAG relative luminance, with translucent colours composited over `--ci-panel`. The chosen option is recorded in the ledger as a planning ruling and implemented in the contrast task. |

### D. Part 3 leftovers

| # | Question | Decision |
|---|---|---|
| V18 | `SECURITY` freeze (Part 3 E55) | Nothing is built at module load.<br>• `buildSecurityModel(packages = SAMPLE_PACKAGES)` becomes pure over its input.<br>• `securityModelFor(packages)` memoizes it in a `WeakMap` keyed by the package array, like `dependenciesModelFor`.<br>• `useReadModels().security` is `computed(() => securityModelFor(SAMPLE_PACKAGES))`.<br>A test proves that importing `use-read-models` builds nothing, and that the first read builds exactly once. |
| V19 | Button column (Quality, Dependencies) | Both tables become `:interactive="false"` (E28/E45) and gain a last column whose cell holds a real `<button>`.<br>• Quality: column "Review", button text "Review", `aria-label` `QUALITY_REVIEW_LABEL(title, file)` = "Review <title> in <file>".<br>• Dependencies: column "Details", button text "Details", `aria-label` `DEPS_DETAILS_LABEL(name)` = "Details for <name>".<br>Both names start with the visible label (WCAG 2.5.3). When the review dialog closes, Quality's focus restore (R5) targets the row's button (`.ci-findings-table__open`) instead of `.ci-table__row`.<br>BoundaryRuleTable and CoverageGapsTable also hold controls in their rows, but they are outside the brief's scope and are listed as deferred. |
| V20 | Cross-screen classes → kit | New kit classes in `kit.css`:<br>• **`ci-severity`**, with `--high\|--medium\|--low` (was `ci-finding__severity`);<br>• **`ci-ref-id`** (was `ci-finding__id`);<br>• **`ci-band-legend`**, with `__key` and `__key--low\|mid\|high` (was `ci-scatter__legend/__key`).<br>Two looks that are already shared across screens but styled in screen sheets also move to the kit, unchanged: **`ci-file-cell`** (+ `__name`, `__path`) and **`ci-priority`**.<br>File detail's finding card becomes its own block, **`ci-file-finding`** (`__head`, `__title`, `__meta`, `__review`), with its rules in `screens-explore.css`.<br>`ci-finding__*` and `ci-scatter__legend/__key` are retired. `ci-scatter` stays Hotspots-only. |
| V21 | Guard every screen prefix | `css-class-scope.test.ts` stops listing three prefixes. Instead it:<br>• extracts every `ci-<block>` root from the class attributes, `:class` bindings and selector strings of each `.vue` file under `src/ui/screens/**`, skipping `useUniqueId('…')` arguments;<br>• maps each file to its screen: `XScreen.vue` or the screen's directory, with `shared/` as its own owner;<br>• asserts that every root is used by **one** screen, or is defined in `kit.css`, or is on an explicit list of WP-01 component blocks that CityWorkspace composes (`ci-app`, `ci-viewport`, `ci-file-list`, `ci-search`, `ci-shell`, `ci-welcome`, `ci-selection-notice`);<br>• asserts that the retired names are gone and that the kit defines the shared classes.<br>A further test proves the extractor finds a known borrowed class in a synthetic snippet. |

### E. Part 4 deferred minors

| # | Question | Decision |
|---|---|---|
| V22 | Re-announce without an overwrite risk (item 14, Part 4 E18) | A new `src/ui/kit/reannounce.ts` exports `reannounce(live: Ref<string>, message: string): Promise<void>`. It clears the region and waits `nextTick`. It then sets the message **only if no later call on the same ref happened in between**, tracked by a per-ref token in a `WeakMap`.<br>`useCsvExport` calls `build()` **outside** the download `try`, so a builder bug throws as a real error. Only `downloadText` failures become `EXPORT_FAILED`, announced through `reannounce`.<br>The Part 5 announcements (V7, V15, V16) also use `reannounce`. |
| V23 | Tests export with no model (item 15) | `exportCsv` returns early when `testConfidence.value` is null. `downloadText` is never handed an empty CSV. |
| V24 | `niceTicks` (item 16) | A `target` or `floor` that is not a finite number > 0 falls back to its default (4 or 10). `niceMax` has no production caller, so it is deleted together with its test. The property sweep gains `floor = 100`, LineChart's only real value, for targets 4 and 5. |
| V25 | Markdown (item 17) | In `mdValue`, a `failed` or `excluded` state without a value reads `failed (reason)` / `excluded (reason)`, or just `failed` / `excluded` when there is no reason. An `unknown` without a value keeps `unknown (reason)`. `escapeBlockStart` also escapes a leading `\|`, so neither `mdLine` nor `mdQuote` can start a table row. |
| V26 | `formatBytes` (item 19) | It picks the unit after rounding to one decimal. So 999,999 gives "1 MB" (never "1,000 KB"), and so does 999,950. It also writes "1 byte" in the singular, and groups the bytes branch ("999 bytes"). |
| V27 | Settings tab narrowing (item 20) | `settings-tabs.ts` exports `SETTINGS_TABS` and `isSettingsTab(id: string): id is SettingsTab`. `SETTINGS_TABS` becomes the one list, used by SettingsScreen's `TABS` and the copy keys. SettingsScreen passes `current`, a computed that narrows with `isSettingsTab` and falls back to `'appearance'`. There is no `as`. |
| V28 | Provider "Used by" (item 21) | The route buttons sit in a `role="group"` labelled `SOURCES_USED_BY_GROUP(provider)` ("<Provider> is used by"). Each button carries the `aria-label` `SOURCES_OPEN_ROUTE(title)` ("Open <Screen>"), which contains its visible screen title. Each provider `article` is labelled by its `h4` (`aria-labelledby`, with the id from `useUniqueId`). |
| V29 | Editor label style (item 22) | `.ci-work-editor__label` takes the look of Obsidian's `.setting-item-name`: `color: var(--ci-text)`, `font-size: var(--font-ui-small, 0.9em)`, `font-weight: var(--font-medium, 500)`. It applies to every field label in the editor, both the real `<label>`s and the read-only Target caption, so they finally match. The harness captures the editor open in both themes (`?edit=first`). |
| V30 | Harness (items 23, 24) | `?items=demo` checks that `addWorkItem` returned three non-null items, and **throws** otherwise, so the page error fails `npm run harness-shot`.<br>The harness snapshot becomes `completeness: 'partial'`, with the matching warning. A real scan marks a snapshot partial whenever a file's lines are unavailable (`inventory-collector.ts:267`), so the fixture's 3 unavailable files made it inconsistent (Part 4 E17). |
| V31 | Citation fix (item 13) | The three title-clip citations that say "Part 4 E2" become "Part 4 E3". |
| V32 | Missing and weak tests (item 25) | Every new test must fail without its feature, and the implementer shows the RED output.<br>• **X17:** the stylesheet-order test derives its list from `readdirSync('src/ui/styles')` and also checks `vite.harness.config.ts`, so a new sheet missing from either one fails it.<br>• **`clearAll`:** a partial failure still attempts every removal, reloads, and rethrows the first rejection. A clear racing a pending update leaves neither a ghost item nor a stuck pending id.<br>• **Review state:** export and import round-trip package and module targets.<br>• **Change source:** the route is `city` **at call time**.<br>• **Editor focus:** delete → confirm focuses the confirm button; keep → focus returns to Delete; deleting the item whose card opened the editor returns focus to the filter.<br>• **Workbench:** the X6 `removing` guard under a concurrent removal (the item vanishes by another path while a delete is in flight, and the deletion is still announced once); New work item's `aria-describedby` names the hint's id.<br>• **Part 4 E2/E18:** the tests observe the intermediate `''` state before the repeated text. |

## 2. Screens and surfaces touched

- **City**: the toolbar gains Cancel scan (V6). There is one leaf observer (V4), the camera steps re-measure (V5), and the two files are split (V1–V3).
- **Shell**: the route-focus rule and a shell live region (V7). PageHeader's title gets `tabindex="-1"`, and so does `<main>`. App binds the review store (V8).
- **Data & scans**: a Cancel button replaces the hint, and the run line is `role="status"` (V6). The provider buttons are grouped (V28).
- **Settings**: the Import row and dialog (V13–V16) and the narrowed tab (V27). If the owner chooses it, the contrast option applies to Clear review state (V17).
- **Quality, Dependencies**: button columns (V19).
- **File detail, Quality, Hotspots, Tests**: kit classes (V20).
- **Workbench**: the label style (V29), plus test-only work (V32).

## 3. Units

| Unit | Responsibility |
|---|---|
| `host/city-scan-controller.ts` | V1, V6: the scan lifecycle and the three injected callbacks |
| `host/layout-publisher.ts` | V1: publishing a snapshot's layout to the store and the renderer |
| `ui/screens/city/{use-city-escape,use-city-floor}.ts`, `CitySelectionNotice.vue` | V2, V4 |
| `ui/shell/leaf-layout.ts` | V4, V5: the one shared leaf measurement |
| `ui/shell/use-route-focus.ts` | V7 |
| `ui/kit/reannounce.ts` | V22 |
| `ui/stores/review-store.ts`, `report-store.ts` | V8–V10, V16 (`replaceAll`, `restore`) |
| `ui/read-models/review-state.ts` | V11, V12 (v2 export) |
| `ui/read-models/review-state-import.ts` | V14 (parsing and validation; pure) |
| `ui/screens/settings/{ImportRow,ImportReviewDialog}.vue` | V13, V15, V16 |

New visible strings go in `src/ui/audit-copy/{settings,sources,quality,dependencies,shared}.ts`. `COPY_09` is imported from `copy.ts` and reused; `copy.ts` itself is not edited.

## 4. Contrast #4: measurements for the owner's decision

These were measured in the harness (vendored Obsidian 1.12.4 `app.css`, default theme) with the WCAG 2.x linearized formula. Translucent colours are composited over `--ci-panel`.

| Pair | Dark | Light | Required |
|---|---|---|---|
| `--ci-on-action` on `--ci-action` (today) | 4.26 | 3.43 | 4.5 |
| `--ci-on-action` on `--ci-action-hover` (today) | 2.75 | 2.75 | 4.5 |
| Obsidian `button.mod-warning`: white on `--background-modifier-error` (today; its hover colour is identical) | **3.45** | 4.20 | 4.5 |
| `--ci-raised` vs `--ci-panel`, the skinned hover (today) | 1.03 | 1.04 | 3 (non-text) |
| Obsidian's own `--background-modifier-hover` vs `--ci-panel` | 1.22 | 1.15 | — |
| on-action on `color-mix(--ci-action 80%, black)` | 6.11 | 5.04 | 4.5 |
| white on `color-mix(--background-modifier-error 80%, black)` | 5.10 | 6.11 | 4.5 |
| `color-mix(--ci-text 15%, --ci-panel)` vs `--ci-panel` | 1.48 | 1.34 | — |

The owner is given the options at the Phase 1 pause, and V17 in §1 records the outcome.

## 5. Testing

Every task is TDD, and its RED run is captured. Every new test fails without its feature.
- **Unit:**
  - the split budget (V3);
  - `reannounce`;
  - review-store keying and in-flight isolation; `replaceAll`; the report stash;
  - the v2 export; `findingRef` skipping;
  - import validation: one test per rule family, v1 and v2, another codebase, limits, unknown keys, and the Verified guard;
  - the `niceTicks` guards and the floor-100 sweep;
  - `mdValue` and `mdLine`; `formatBytes`; `isSettingsTab`;
  - the Security laziness;
  - the class-scope extractor.
- **Component:**
  - Cancel on the toolbar and on Data & scans: aria-disabled while idle, and calls the callback while running;
  - route focus, all three cases;
  - Settings import: pick, refuse, confirm, cancel, busy, failure, and the HTML-looking title;
  - the Quality and Dependencies button columns;
  - the provider groups;
  - the editor focus moves;
  - the Workbench guards.
- **Host:** `onCancelScan` reaches `CityView.cancelScan`, tested in a new `tests/host/city-view-cancel.test.ts`. Nothing is added to the 450-line wiring test.
- **Harness:**
  - the `?items=demo` assertion;
  - the partial fixture;
  - new shots: the import dialog, the editor, and Data & scans with a running scan (via `?run=running`, a harness-only run-store seed).
- **Evidence notes:** updated once, in the final task, followed by `npm run verify`. Verify also runs in the main checkout after the fast-forward.

## 6. Out of scope

- Durable persistence of anything (WP-05). Import restores into this session only.
- Real providers, reading source content, writing to the vault.
- Button columns for BoundaryRuleTable and CoverageGapsTable. Their rows hold controls, but they are outside item 11.
- A `cancelling` view-surface state on the city. The toolbar button and Data & scans already reflect it.
- Changes to the city-store `select`, `setQuery` and `setCamera`.
