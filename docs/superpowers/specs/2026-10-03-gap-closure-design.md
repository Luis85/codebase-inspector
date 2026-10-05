---
project: codebase-inspector
title: Gap closure — every open item on PR 1 an agent can close (design)
date: 2026-10-03
status: for owner approval
deliverable: docs/deliverables/Test Evidence.md
---

# Gap closure

## 1. Outcome and scope

At `1baa572` (the PR 1 head), a read-only inventory found 87 open items across PR 1's body, every ledger, the WP-01 limitations and the deliverables. The owner chose **everything, decomposed** (GCO1). This spec is **sub-project 1 of 5**: it closes every item an agent can close, in four parts that each land on PR 1 in turn.

- **Part D — harness, evidence and minors** (first: it makes later native runs trustworthy).
- **Part C — quality gates, evidence semantics and copy.**
- **Part A — city and renderer.**
- **Part B — data, state and processes.**

Each part gets its own plan, subagent-driven execution, final review, and a fast-forward onto `feat/wp-01-codebase-city`, with a PR 1 section per part.

**Later sub-projects, each with its own spec → plan → execution, in this order:**
1. the full import graph (WP-03 §7, inventory B1/C11);
2. clone groups, symbol tracing and the external editor (WP-04 O1/O5, C10);
3. WP-05 durable snapshot history (C13);
4. the pop-out window harness (NE20, C5).

**Not agent-closable** (§8): the manual Part 7 check (item 3), the human accessibility checkpoint #4, other operating systems, the Electron performance row, the §11 host questions, and the file-symlink test (Developer Mode).

**Binding:**
- the WP-01 spec §4 frozen contracts, amended only where §4 of this spec names an owner decision;
- every earlier spec and ledger, notably the WP-04 Part 2 follow-ups ledger (FP1–FP12, FQ1, WP-04.2 Follow-up E1–E8);
- `docs/deliverables/*.md`;
- the house constraints carried by every plan: caps 400 `src` / 450 tests; the city-view budget (`city-view.ts` and `CityWorkspace.vue` ≤ 360, and `CityViewport.vue` never edited); layering; copy only in `src/ui/audit-copy` and the established copy modules; CRLF notes edited only with Edit/Write; `npm run analyze` never grows; never `git stash`; the literal commit trailer; native discipline (IPF20, E6/E7, NPF7, NPF13, `retry: 0`, a positive control per probe, a RED per new or changed scenario).

Rulings made while planning are **GCP1…** in `docs/superpowers/notes/2026-10-03-gap-closure-ledger.md`.

## 2. Owner decisions (2026-10-03)

| # | Decision |
|---|---|
| GCO1 | **Scope:** everything, decomposed into this sub-project and the four later ones; every part lands on PR 1. |
| GCO2 | **F2:** spike a deterministic tighter packing; adopt it only if root occupancy rises by 10 points or more on the same real scan. Otherwise record the result and keep shelf packing. |
| GCO3 | **F14 + M80:** cap automatic WebGL reconstruction, then the S11 fallback with a user-initiated **Retry 3D** that reinitialises the renderer only and never scans. |
| GCO4 | **M95:** pointer capture on an edge drag, and no pick outside the canvas. |
| GCO5 | **§7 root-unavailable:** produce it when a scan or refresh finds the root missing or unreadable; the snapshot stays readable. |
| GCO6 | **SourceIdentity:** an additive `name` on `CityStoreState`/`CityViewState`, shown in S05's toolbar (§4.1 amended in writing). |
| GCO7 | **Y19:** handle external `data.json` edits live through `onExternalSettingsChange`. |
| GCO8 | **M108: adopt bounded scan concurrency.** The guarantee "a cancelled run opens nothing further" is weakened in writing to "no excluded path is ever opened; nothing new is dispatched after a cancel; in-flight reads drain before the run reports cancelled". |
| GCO9 | **Windows tree kill:** probe whether fallow 3.27.0 spawns children; tree-kill via System32 `taskkill.exe /T` only if it does. |
| GCO10 | **Layering lint:** ui ↛ adapters/host; application ↛ adapters/host/ui; adapters ↛ host/ui. |
| GCO11 | **CI:** GitHub Actions on `windows-latest` running `npm ci` and `npm run verify`; the native suite stays manual. |
| GCO12 | **Contrast:** fix the tokens (text 4.5:1, hover and focus indicators 3:1, both themes) and add a test that computes WCAG contrast from the token values. |
| GCO13 | **axe:** axe-core over every screen, failing on serious or critical violations; mobile stays out (`isDesktopOnly`). |
| GCO14 | **Wide leaf:** the stage grows in a wide leaf. |
| GCO15 | **M116:** the search field stays host-styled (closed as decided). |
| GCO16 | **Safety claims** render in `--ci-text`. |
| GCO17 | **820 px:** measure the drawer threshold, then set and pin it. |
| GCO18 | **"Violations only"** filters per file edge. |
| GCO19 | **Arcs:** tune against captures, and draw the selected file's arcs above buildings if needed. |
| GCO20 | **Deliverables:** shipped deliverables are marked delivered, with a Delivery record citing PR 1. |
| GCO21 | **Revisits, all reopened:** WP-04 E25/E30, WP-03 Polish E4, WP-04.2 E17, and the copy notes (WP-04 E29, WP-03 E7, JP3). New wording is proposed in §4 for approval with this spec. |
| GCO22 | **Z38:** best-of-3 per mode, plus a second control after the modes (skip at ≥ 35 ms). |
| GCO23 | **Per-device fallow bindings:** a data.json v2 analyzer slice keyed by machine (reverses K2). |
| GCO24 | **Stale detection (B6):** accept and document; no content digest. |
| GCO25 | **Crash dump:** procdump is allowed for the diagnostic native runs. The controller asks once, with filename, source and size, before downloading it. |

## 3. Inventory at 1baa572

Four read-only audits checked every row against the code at `1baa572`. **Fix** means this sub-project changes it; **Accept** means it is documented as a decided limitation, with its reason. Sizes are S, M or L.

### 3.1 Part D — harness, evidence and minors

| # | Item | Current (evidence) | Change | Proof |
|---|---|---|---|---|
| GRD1 | **Native worker crash `0xC0000409`** on 1.13.4 (D1, A14) | <ul><li>3 crashes: Part 2 E5, then the `fallow.e2e.ts` run and the `commands.e2e.ts` run on 1.13.4.</li><li>Silent `__fastfail` in node.exe: no Node or V8 message, and WER saved nothing.</li><li>Evidence is overwritten by the next run (`diagnostics.ts:6-9`, `native-tests.mjs:14`).</li><li>`environment.json` lacks the Node, chromedriver and Electron versions (`fixture.ts:27-32`).</li><li>1.13.4 runs on Electron 43.1.1 with chromedriver 43.1.1; latest on 43.3.0.</li></ul> | **Fix (M).**<ol><li>Run-scoped evidence: `reports/native/runs/<UTC>-<version>/`.</li><li>Crash-safe breadcrumbs at each session phase: time, rss, heap, active handles, Obsidian and chromedriver process counts.</li><li>`environment.json` gains `process.versions`, chromedriver and Electron.</li><li>Worker `execArgv` adds `--report-on-fatalerror`.</li><li>A diagnostic mode attaches procdump to each worker (GCO25).</li><li>Measure the rate over 10 runs on 1.13.4 and 10 on latest.</li><li>Choose the remedy from the dump: a Node pin, or a webdriverio / wdio-obsidian-service bump. A baseline move to 1.13.7 needs the owner.</li></ol> | The crash first reproduces with the diagnostics on and no remedy (the baseline arm). With the remedy: **11 consecutive green 1.13.4 runs** at the head (95 % confidence for p ≈ 0.25). Also a crash-shaped fixture in `native-results-gate.test.ts`. |
| GRD2 | **Z38 residual** (D2) | `fallow-no-freeze.test.ts:24`, `:36-55`. Three failures had the control under 35 ms (33.2 → 53.8, 28.8 → 71.6, 27.8 → 55.3 ms). | **Fix (S), GCO22.** Each mode runs 3×; the test asserts min(worst) < 50 and prints every figure. A post-control ≥ 35 ms skips with its figure. The timeout becomes 90 s. | RED under FQ1's freeze mutation (streamed fails all 3). About 5 burner runs pass or skip, never fail. |
| GRD3 | **E7's `hide()` release has no native test** (D3) | `settings-tab.ts:122-125` and `settings-render-wait.ts:76-82` are proven only by `settings-tab-focus.test.ts:222`. In 1.13.4 nav items are `tabIndex:-1`, so clicking another settings tab keeps the wait until `hide()`. `update()` refreshes the settings search index. | **Fix (M).** New **scenario 41** (§5): focus a field, make a write elsewhere, and confirm (control) that the settings search does not yet find it for this tab. Click another core tab's nav item (`[data-setting-id="appearance"]`); the search now finds it. | RED with `hidden()`'s body a no-op. A probe step first confirms the search and focus behaviour. |
| GRD4 | **Foreign CPU load times out native scans** (D4) | Fixed budgets (`inspector.ts:114` 60 s; `testTimeout` 120 s). Landing runs waited for load by hand. | **Fix (S–M).** `native-tests.mjs` gets a pre-flight load gate: sample CPU for 10 s; if it is ≥ 50 %, wait up to 15 min, then refuse with a named message, exit non-zero and write no report (a refusal, never a pass). Each case's `environment.json` records CPU and foreign process counts. | A unit test with an injected sampler: 80 % refuses and spawns no Vitest (RED: gate removed); 20 % runs. |
| GRD5 | **E9:** a refusal's "no effect" half was never shown RED | `commands.ts:80-85`; scenario 7 (`commands.e2e.ts:118-119`). | **Fix (S), proof only.** A temporary asymmetric-guard mutation (checking refuses, executing still opens) must turn scenario 7 RED; the RED is recorded. | Recorded RED. |
| GRD6 | **E17:** scenario 4's positive control lives in scenario 6 (GCO21) | `city.e2e.ts:121-167`. | **Fix (M).** After its restored-state asserts, scenario 4 writes a 2 000-file tree and starts a modal scan without waiting (a new `scanFolderNoWait` in a new `inspector-<concern>.ts`). It polls `cancel-scan` to available, cancels, and polls back. About 10–15 s. | RED: `isScanRunning` mutated to always return false. |
| GRD7 | **NE13:** dispose and reconstruct cannot be told apart | Renderer `dispose()` calls `canvas.remove()` (`city-renderer.ts:320-333`). | **Fix (S–M).** Scenario 3 installs a MutationObserver on the canvas's parent before the theme switches and asserts 0 removals. Positive control: detaching the leaf removes it. | RED: a temporary css-change handler that disposes and recreates the renderer. |
| GRD8 | **E4:** the leak allowance would mask exactly one `layout-change` listener per leaf | `src` registers no `layout-change` today. | **Fix (S).** A fast static guard fails if any `src` file registers `'layout-change'`. | RED: a temporary registration in `main.ts`. |
| GRD9 | **E15:** the `getLeaf(false)` mutation is unobservable | `investigation-notes.ts:261`; it is an equivalent mutant in the only reachable state. | **Accept.** Equivalent mutants cannot be shown RED; the strict new-tab assertions are RED under `'split'` and `getMostRecentLeaf()`. | — |
| GRD10 | **D8:** tests serialise YAML with `yaml` 2.9.1, not Obsidian | Production uses Obsidian's `stringifyYaml` (`investigation-notes.ts:204`); the native fact test proves the value round-trip. | **Accept**, plus a small parity test: one input table is shared by the native probe and a fast mock check. | The parity test. |
| GRD11 | **D10:** the vault watcher does not index `node:fs` copies | The product side was closed by NPF15 (`ca1a8b7`). The comment at `notes-root.e2e.ts:19-22` is stale, and LIM `:479-485` does not say the plugin no longer depends on this. | **Fix (S):** the comment and the LIM entry. The environment fact stays. | — |
| GRD12 | **D11:** checks owed at upgrade time | LIM `:286-299`. | **Fix (S):** re-fetch the `[T1]`–`[T4]` and `[O1]`–`[O2]` citations in `docs/concept/design/wp01-review/docs/03-threejs-and-obsidian-bridge.md`. **Accept** the rest until the upgrade it names: r187 WeakRef, the r186 wiki note, mockups after r181, and the community directory (not a goal). | Updated citations with their access dates. |
| GRD13 | **WP-04 Part 1 minors** (E3) | <ul><li>`LPT0`/`CONOUT$` untested.</li><li>The hard size guard is unreachable.</li><li>The retry is already tested.</li><li>The token is bumped twice.</li><li>Filter paging is partly covered.</li><li>No idle-state test.</li></ul> | <ul><li>**Fix (S):** two `expect`s for `LPT0`/`CONOUT$` (`investigation-note-path.test.ts`); a filter-after-Show-more paging test; an idle-state test.</li><li>**Accept:** the unreachable guard (dead by construction) and the double bump (harmless).</li></ul> | RED: drop `LPT0`/`CONOUT$` from the reserved list. |
| GRD14 | **Part 7 polish minors** (E5) | <ul><li>A10 is only a behaviour pin.</li><li>C13's `@ts-expect-error` was never shown failing.</li><li>`FALLOW_TRUST_NOT_STARTED` cannot be reached.</li><li>A stale spec copy row.</li><li>The purge mark.</li></ul> | <ul><li>**Fix (S):** A10 RED by mutation (recorded).</li><li>**Fix (S):** C13 RED type-side (recorded).</li><li>**Fix (S):** narrow `trustAndRun`'s return type to started, refused or busy, and drop the dead branch at `FallowInstalledRoute.vue:127` and its copy.</li><li>**Fix (S):** amend the Part 7 spec row `:226` with a "superseded" note.</li><li>**Accept** the purge mark: it fails closed and Settings names it.</li></ul> | RED: `trustAndRun` returning `{kind:'review'}` fails typecheck. |
| GRD15 | **Follow-ups and WP-04 Part 2 minors** (E1, E2), and the closed-but-reads-open groups (F) | The follow-ups pass's minors; `fallowBinary` stricter than NE7; scenario 23 scanning before Connect; about 25 groups that older text lists as open. | **Accept** E1 and E2 with their reasons. Scenario 23 is revisited only if a scan comes to read the binding. **Ledger only:** record each F closure with its commit (the audit's sentences). | — |

### 3.2 Part C — quality gates, evidence semantics and copy

| # | Item | Current (evidence) | Change | Proof |
|---|---|---|---|---|
| GRC1 | **Layering lint** (GCO10) | `eslint.config.mjs` bans only domain and visualization. At HEAD: ui → adapters/host 0, application → … 0, **adapters → ui 4**: `plugin-data-review-repository.ts:28`, `:32`, `:35` and `review-repository-registry.ts:6`. | **Fix (M).** Three `no-restricted-imports` blocks; the tests pattern becomes a shared const. Move `ui/stores/ports/review-repository.ts` (229 lines; it imports only `domain`) to `application/ports/` (about 15 import paths). The adapter throws code-only messages; ui's `review-failure.ts` already maps codes to text. **One ruled exception:** `review-record-codec`, until the codec moves (GCP ruling). | `tests/build/eslint-layering.test.ts` lints synthetic snippets: a ui import of adapters errors, an application import of ui errors. RED: no rule. `npm run lint` is clean at the head. |
| GRC2 | **CI** (GCO11) | No `.github/`. `verify` needs no network. The runner's system git sets `autocrlf=true`. Install scripts (edgedriver, geckodriver) download over the network. | **Fix (S).** `.github/workflows/verify.yml`: `git config --global core.autocrlf false` before checkout; Node 24 with an npm cache; `npm ci --ignore-scripts`; `npm run verify`; `npm audit --omit=dev --audit-level=moderate`. Read-only permissions and a concurrency group. | `tests/build/ci-workflow.test.ts` parses the YAML (`windows-latest`, push and PR triggers, the steps, autocrlf before checkout, no native/analyze/fallow step); RED: no file. The real proof is a green run on PR 1. **Known exposure:** tests that skip locally (file symlinks, junction and 8.3 alias cases) run on the elevated runner; a first-run failure is fixed or ruled, never skipped. |
| GRC3 | **Contrast** (GCO12) | Measured from the vendored app.css (dark/light): `--ci-on-action` on `--ci-action` 4.26/3.43 (live at `screens-act.css:50`); `--ci-raised` vs panel 1.03/1.04; `--ci-hover` 1.29/1.21. **New failures:** `--ci-focus` 2.24/1.88; `--ci-text-faint` as text 2.90/2.30 (28 uses); accent as text 3.64/3.28; danger text 4.38/3.89; and in light mode warning 2.95, success 2.61 and sample 2.09. | **Fix (M).**<ul><li>Derived text tokens: `--ci-text-faint` = faint 45 % into normal; new `--ci-text-accent`, `-danger`, `-warning`, `-success` and `-sample`, each mixed into `--text-normal` to ≥ 4.5:1.</li><li>Every coloured `color:` is repointed to the text tokens; fills and borders keep `--ci-tone-*`.</li><li>`--ci-focus` uses `--ci-text-accent`.</li><li>**The hover indicator becomes a 1 px inset edge** in `--text-muted` (7.22/6.19). A fill cannot reach 3:1 against the panel while its text keeps 4.5:1 (arithmetic in the audit).</li><li>`screens-act.css:50` uses `--ci-action-fill`.</li></ul> | `tests/support/css-tokens.ts` resolves `var()`, hex, `hsl(calc(var(--accent-*)…))` and `color-mix` from the vendored host blocks plus `styles.css` and `kit.css`. `tests/unit/contrast-gate.test.ts` checks every listed pair in both themes, and a sweep checks that no `color:` uses an ungated token. RED at HEAD. `--ci-hover`/`--ci-raised` vs panel are recorded as infeasible for fills; the edge carries the 3:1. |
| GRC4 | **Safety claims** (GCO16) | `SnapshotStatus.vue:108-110` inherits `--ci-text-muted` (7.22/6.19) from `styles.css:754-758`. The scope modal's claims are already host `--text-normal`. | **Fix (S):** `.ci-snapshot-status__claims { color: var(--ci-text); }`; rewrite the comment and LIM `:203-207`. | A declared-colour pin; RED: none today. |
| GRC5 | **axe** (GCO13) | axe-core is not installed. jsdom component tests run inside `verify`. | **Fix (M–L).** axe-core as a **devDependency** (it must not reach `dist`). `tests/support/axe.ts` uses the WCAG 2.0/2.1 A and AA tags. It disables `color-contrast` (no layout in jsdom; GRC3 covers it) and page-level rules (we render in a leaf). It fails on serious or critical. It covers 16 routes, their states, 14 dialogs and the host modals and settings tab, in 3–4 files. | Positive control: an unnamed `<button>` fixture fails the helper. Findings on the first run become fixes, or per-rule rulings. |
| GRC6 | **"Violations only" per file edge** (GCO18, B4) | `EdgeList.vue:53` filters file edges by their module pair. Map and Matrix are module-level by nature. | **Fix (S):** `EdgeList.vue:53` keeps only `e.sources.includes('boundary')`; the `violating` prop is dropped. Map and Matrix stay per pair, and the spec says so. | A mixed pair (a cycle-only edge beside a boundary edge) lists only the Boundary row. RED: both rows show. |
| GRC7 | **JP5 widened** (B3) | `edgesAnalysed` is used only by Architecture (`architecture.ts:139-141`). File detail (`FileRelationsPanel.vue:35`), city Relations (`CityRelationsPanel.vue:39`, `city-relations.ts:61`) and the Overview / Data & scans row (`relations.ts:282-285`) still use the cycle-only gate. | **Fix (M):** `relationEdgesAnalysed(model)` in `relations.ts`, used at all five sites. A boundary-only report shows `RELATION_CYCLES_NOT_REPORTED` on File and City, and the row reads `partial`. | Boundary-only cases in four test files. RED: "not analysed". |
| GRC8 | **A violation inside one module** (B5) | Same-module pairs are dropped (`queries.ts:84`); the Matrix diagonal always shows "Same module". | **Fix (M):** `selfViolations` per module; a diagonal marker with hidden text, and a Map node class plus aria suffix. The new copy is in §4. The fixture is a derived variant of the 3.27.0 recording. | Diagonal and node label assertions. RED: no marker. |
| GRC9 | **Five Architecture cards at 1280 px** (WP-03 Polish E4, GCO21) | `kit.css:212` `minmax(200px, 1fr)`: about 1012 px available, against the 1064 px five cards need, so they wrap 4 + 1. | **Fix (S):** for `.ci-screen--architecture` only, `minmax(176px, 1fr)` (five cards need 944 px). | A computed-fit test from the declared CSS (RED at 200) and before/after captures. |
| GRC10 | **Copy revisits** (WP-04 E29, WP-03 E7, JP3; GCO21) | `CLAIM_SOURCE_UNCHANGED` (`copy.ts:88`); six Architecture strings (`inspector-copy.ts:100`, `:125-127`, `:130`, `:159`, `:176`); `ARCH_RULES_CAPTION` gives "1 rules" (`audit-copy/relations.ts:101-103`). | **Fix (S):** the wording in §4 (GCN12). Literal pins are updated. | The updated pins; the plural fix is RED at "1 rules". |
| GRC11 | **Deliverable status** (GCO20) | Every deliverable says `planned`; WP-01 has no Delivery record; Plugin Foundations has no status. | **Fix (S):** WP-01 to WP-04 and Plugin Foundations become `delivered`, each with a Delivery record naming PR #1 and keeping its caveats (A12; WP-03's evidenced subset). WP-05 to WP-12 stay `planned`. | `tests/unit/deliverables-status.test.ts`; RED: none delivered. |
| GRC12 | **analyze baseline** (D6) | 9 findings. Four unused exports (`LOT_FOOTPRINT`, `MAX_DIRECT_SUBDISTRICTS`, `DRAG_THRESHOLD_CSS_PX`, `entityPath`) and `ScanCoordinator.getLifecycle` have no importer. | **Fix (S):** un-export the four; delete `getLifecycle` and its comment reference. The baseline becomes **4**: the `fs` seam, `SourceReference` (frozen), the `EntityId` pair (frozen), and the city-view ↔ leaf-registry cycle. | `npm run analyze` prints 4, and the evidence line keeps its parseable shape. |
| GRC13 | **M118 and the residual list** (D7) | The `mayPublish` guard has only a source tripwire, recorded as "not coverage". The evidence's residual list is unchecked prose. | **Fix (S).** A behavioural test mocks `mayPublish` to false: nothing is published, it is called once with the identities, and the real function is the control. A sweep fingerprint line in the gate evidence is checked by `evidence-numbers.test.ts`. | RED: `if (false && !mayPublish(`, and any change to a sweep regex. |
| GRC14 | **`npm audit`: 4 moderate** (new) | One root cause: `moment` 2.29.4 (GHSA-4p3w-j4w9-5jqw), dev-only, through `obsidian` (types) and `eslint-plugin-obsidianmd`. Production dependencies have 0. | **Fix (S):** `"moment": "2.31.0"` in `overrides`, then refresh the lockfile. | `npm audit` reports 0; `npm ls moment` shows only 2.31.0; typecheck passes. |

### 3.3 Part A — city and renderer

| # | Item | Current (evidence) | Change | Proof |
|---|---|---|---|---|
| GRA1 | **F2 packing spike** (GCO2) | Shelf packing in path order (`districts.ts:123-232`; 383 lines). 64.2 % was measured on 84d92d7's tree. No occupancy code exists. | **Spike (S), then adopt only by measurement:**<ol><li>Calibrate the occupancy definition (root extent against the sum of the root's direct items) on 84d92d7's tree until it reproduces 64.2 % ± 0.1. If it can't, re-baseline at HEAD's tree with both figures recorded (GCP ruling).</li><li>Measure three deterministic candidates: NFDH, FFDH and skyline.</li><li>Adopt the simplest that reaches ≥ baseline + 10. If adopted: a new `src/domain/layout/pack.ts`, `LAYOUT_VERSION` '2', a frozen real-tree fixture, and an occupancy helper in tests.</li></ol> | `layout-occupancy.test.ts` on the frozen tree (RED at HEAD) plus the existing determinism and aspect pins. If nothing is adopted: the spike's table in the ledger. |
| GRA2 | **Reconstruction cap + Retry 3D** (GCO3) | `CityViewport.vue:115-121` rebuilds on every context loss, with no counter. The file is frozen at 400 lines. No Retry control exists. | **Fix (M), without touching `CityViewport.vue`** (GCN2).<ul><li>`src/visualization/reconstruct-cap.ts` wraps the renderer factory. After **3** automatic losses it emits `unavailable{initialization-failed}` and returns the inert port, so COPY-14 shows.</li><li>`city-view.ts` provides the capped factory and `onRetryRenderer` (one cap per leaf).</li><li>`CityStage.vue` shows **Retry 3D** when the reason is `unsupported` or `initialization-failed`. A click resets the cap and remounts the viewport by `:key`: renderer only, never a scan. Focus moves to the stage.</li></ul> | `reconstruct-cap.test.ts` (RED: module missing); a host test counting factory calls under N+1 losses (RED: grows without bound); a component test for the button and that no scan is requested. |
| GRA3 | **M95 pointer capture** (GCO4) | `picking.ts:80-89` never captures. `onPointerUp` hit-tests any point (`:117-127`). | **Fix (S):** capture on pointerdown, release on up and cancel; an `insideCanvas` guard before `hitTest` and dwell. | `picking-capture.test.ts`: capture called (RED); a release at x = 102 on a 100-wide canvas picks nothing (RED: it picks), with x = 97 as the positive control. |
| GRA4 | **§7 root-unavailable producer** (GCO5, and B10's first half) | The coordinator detects a missing root (`scan-coordinator.ts:153-158`) but reports a generic failure. `CityWorkspace.vue:118` hard-codes `rootUnavailable: false`. COPY-28 and the banner kind already exist. `runRefresh` (`scan-flow.ts:206-209`) can ask to approve a missing bound root. | **Fix (S–M).** `ScanLifecycleState.rootUnavailable` (application-owned, no §4 change) is set by `SCAN_FAILED` with `cause: 'root-unavailable'` and cleared by `SCAN_STARTED`. `run-store` mirrors it, and CityWorkspace reads it. `runRefresh` stats the bound root first and reports root-unavailable rather than asking to approve a missing folder. | Fast: the lifecycle field (RED); a component test where the banner reads COPY-28 and list rows remain (RED: "Scan failed…"). Native **scenario 42** (§5). |
| GRA5 | **Wide leaf** (GCO14) | The panels are `clamp(180px, 18%, 320px)` and `clamp(200px, 20%, 360px)`; the stage is flex. Estimated stage at a 1,876 px viewport: about 980 px with the inspector open, below the pre-shell 1,140 px the complaint measured. | **Fix (S–M), by measurement** (GCN6): lower the panel percentages so that at 1,876 px the stage is **≥ 1,140 px with the inspector open**, keeping the caps and the minimums. Choose the values from `harness-measure` (GRA6). | New measured shots at 1280, 1876 and 2560; a CSS pin; the measure JSON shows no clipping. |
| GRA6 | **820 px threshold** (GCO17) | `responsive.ts:19`, duplicated in `styles.css:217`/`:258` and `screens-act.css:5`; pinned by `layout-budget.test.ts`. | **Fix (M).** New `scripts/harness-measure.mjs` (reusing harness-shot's setup). It sweeps sidebar-like and pop-out-like widths at s05 and s07, and records box widths, clipping and the stage-floor notice as JSON. Set the threshold to the smallest width with no clipping and a stage of at least 320 px, and change all four places together. Nav-inline and the city drawer keep one constant unless the sweep shows the nav band clipping (GCP ruling). | `drawer-threshold.test.ts` cites the measured table; RED against 820 if the value moves (otherwise a recorded mutation RED). |
| GRA7 | **Arcs** (GCO19, B2) | `relation-arcs.ts:13-19`: lift 0.35·d + 2, depth-tested (`:137-143`). In the worked example the apex is 13.9 between two 8-high lots with a 128-high lot between them. | **Fix (M).** First, **corridor clearance**: raise each arc's control point so its apex clears the tallest lot in its xz corridor plus a clearance; it stays depth-tested. Only if the dense-city captures still hide arcs, draw the **selected file's** arcs with `depthTest: false` plus `renderOrder`; N29/§6 amended in writing (GCO19 authorises it). Add dense and sparse harness fixtures. | The 8/128/8 fixture's apex clears 128 + clearance (RED: 13.9); before/after captures. |
| GRA8 | **Codebase name** (GCO6, both halves) | `CityViewState` is `.strict()` (`validator.ts:225-245`) with no name. The toolbar (`AppToolbar.vue:77-79`) has no identity block. | **Fix (S–M).** `name?: string` (max 200 characters, `.optional().catch(undefined)`); `CityStoreState.name` and `setName()`; view-state sync. `city-view.ts` resolves `profileStore.get(id)?.name` on open, on scan completion and on the 'profiles' watch (GRB1); the resolved name beats a persisted one. The toolbar shows it as its first child with an ellipsis and a title. The TopBar keeps the folder name (GCP ruling). | `view-state.test.ts` (RED: `.strict()` rejects the name); sync round-trip; a host resolve test; a toolbar component test. The downgrade risk is recorded: an older build drops the leaf state once. |
| GRA9 | **Investigate rows: Open wraps away** (B13) | `screens-act.css:58-66` uses flex-wrap rows in `OrphanNotesPanel.vue` and `NotesPanel.vue`. | **Fix (S):** a two-column grid (path | actions), with the actions `flex: none`. | A CSS pin (RED: flex-wrap) and a capture with a long orphan path. |
| GRA10 | **Vendor quirks** (B23) | Pinia's FileSaver/XHR island is kept alive by a non-PURE `saveAs` (`pinia.js:174`); `build-output.test.ts:95-109` pins it present. Three.js sets `window.__THREE__` and never clears it, so re-enabling warns. | **Fix (S):** <ul><li>A Vite pre-transform marks pinia's `saveAs` PURE and errors if the needle is absent, so the XHR island drops out of the bundle.</li><li>`releaseThreeMarker` deletes `__THREE__` on unload only when it equals the bundled `REVISION`. This reverses LIM's "disclosed rather than suppressed"; real double bundling still warns (GCP ruling).</li></ul> | <ul><li>`build-output.test.ts` expects 0 XHR (RED).</li><li>The marker unit test, with a foreign value as the control.</li><li>A host unload test (RED).</li><li>Native: the unload scenario reads `window.__THREE__` as undefined after disable.</li></ul> |

### 3.4 Part B — data, state and processes

| # | Item | Current (evidence) | Change | Proof |
|---|---|---|---|---|
| GRB1 | **Y19 live external edits** (GCO7) | No `onExternalSettingsChange` (`main.ts:37-140`). `watchPluginData` fires only after the plugin's own writes. Open stores that are not told go stale. | **Fix (M).**<ul><li>`notifyExternalChange(plugin)` calls every watcher.</li><li>`main.ts` overrides `onExternalSettingsChange`.</li><li>The review registry refreshes its repositories, and `analysis.refreshBindings()` re-emits bindings.</li><li>CityViews re-resolve the name (GRA8) and the investigation destination.</li></ul>Reads only, under the data lock, so nothing is written from a re-read. | Host and unit RED: an external change reloads the stores, and a stale-read race keeps the write. Native **scenario 43** (§5). |
| GRB2 | **Bounded scan concurrency** (GCO8) | Sequential walker (`walker.ts:110-171`). Four gate tests (`walker-concurrency.test.ts:80`, `:125`, `:138`, `:174`) and `inventory-collector.test.ts:147-148` pin "nothing further after a cancel". | **Fix (M).** A window of **8** per directory, with an index-ordered queue. Exclusion is checked before dispatch, and nothing is dispatched after a cancel. Results are consumed in index order (so the emission order is unchanged), and `finally` awaits every in-flight read. Rewrites: `:174` becomes "no new lstat or read starts after the cancel is observed; reads ≤ 3 + W − 1; an excluded path never appears"; `:125` becomes a multiset comparison; the collector test asserts "no open dispatched after cancel". | RED: the order test against a naive window; a mutation (dispatch guard removed) fails the cancel test. A print-only benchmark re-measures the speed-up. |
| GRB3 | **Windows tree kill** (GCO9) | `fallow-runner.ts:106-119` uses TerminateProcess on the direct child. | **Probe first (S):**<ul><li>static: CreateProcess imports and `git` strings in fallow.exe;</li><li>dynamic: recursive `Win32_Process` polling plus a WMI creation subscription, over a git fixture and this repository;</li><li>a cancel-kill check.</li></ul>**No children:** close with evidence, plus an opt-in test "spawns no child process on Windows". **Children:** `taskkill.exe /PID <pid> /T /F` from `%SystemRoot%\System32` (strict path check) before the direct kill, recorded as a widening of Z14/Z15/Z37, with `no-process-execution.test.ts` allowing a spawn count of 2. | The probe's record. If fixed: a unit test recording the taskkill argv (RED), and a real fixture that spawns a grandchild. |
| GRB4 | **Preview root in the host service** (WP-04 E25/E30, GCO21) | `investigation-services.ts:31-40` returns `{unbound:true}`; `source-preview.ts:188-192` reads under the UI-supplied `expectedRoot`. | **Fix (S):** the service takes the snapshot store; an unbound resolve returns the host's snapshot root, and `expectedRoot` only narrows the read (`sameRoot`). | RED: host root `/a` with the request's `/b` gives `no-binding` (today it reads `/b`). |
| GRB5 | **Refresh keeps YAML formatting** (B7) | `processFrontMatter` re-dumps the YAML (`investigation-notes.ts:239-246`). | **Fix (M).** Inside the same `vault.process`, rewrite only the two single-line keys `snapshot_id` and `source_path`, when exactly one top-level line each exists; otherwise fall back to today's call. One write; `'partial'` remains only on the fallback. | A fast RED in a new test file (`investigation-notes.test.ts` is at 440). Native **scenario 44**. |
| GRB6 | **Note index resync** (B8) | Only the first `resolved` rebuilds (`investigation-note-index.ts:35-49`). | **Fix (S):** `rebuild()` and the port's `resync(codebaseId)`, called when Investigate mounts (one pass per screen open, so IP13 holds). | Host RED; native **scenario 45**. |
| GRB7 | **Notes folder = codebase root** (B9) | `inside === ''` gives `ok` with a warning (`investigation-notes.ts:136-141`). | **Fix (S):** a new plan status `folder-is-root`, refused, with the copy in §4. | RED: the alias test's `ok` and the create-dialog test. Native **scenario 46**. |
| GRB8 | **Reconnected root: preview reason** (B10, second half) | `source-preview.ts:192` answers `no-binding` for both causes; the copy never says "rescan". | **Fix (S):** a new reason `root-changed`, with the copy in §4. The behaviour (the IP14 safety rule) stays. | RED: `root-changed`; scenario 23 expects the new text. |
| GRB9 | **fallow config files in provenance** (B14.3) | `CollectedRunProvenance` (`evidence/model.ts:136-147`) records none. | **Fix (M):** before the spawn, stat fallow 3.27.0's config file names in the root and record `configFiles` in the provenance detail. The name list is taken from fallow's own documentation or strings and recorded (GCP ruling); `extends` chains are not followed. | RED: a root with `.fallowrc.json` lists it. |
| GRB10 | **Per-device fallow bindings** (GCO23) | One record per profile; another device's record reads as `other-machine` (`analyzer-record.ts:69-98`). | **Fix (M):** a v2 analyzer slice `{v:2, provider, devices:{[machineId]:{executablePath, timeoutSeconds, trust}}}`. v1 is read as one device and migrated on the next write, under the data lock. An older build refusing v2 is recorded (GCP ruling). | RED: bind on A, bind on B, and A is still bound. A migration test from v1; an invalid v2 is reported with its reason. |
| GRB11 | **Scope fingerprints are 32-bit** (B15.3) | FNV-1a 32-bit in `approval.ts:14-52`. A collision means a changed scope may not ask for re-approval. | **Fix (S):** a 64-bit `fingerprintSource`/`fingerprintScope`/`fileSetDigest` in `domain/hash.ts`. They are in memory only; the persisted trust hash is untouched. | RED: a known FNV-1a-32 collision pair fingerprints equal today. |
| GRB12 | **Wildcard exclusions saved before M62** (B15.4) | Accepted on read; they match nothing (`walker.ts:66-79`). | **Fix (S):** a snapshot warning per wildcard exclusion (copy in §4). | RED: `['dist/*']` gives a warning. |
| GRB13 | **Removed and retired residuals** (B16) | <ul><li>(a) A leaf on a removed codebase still offers Choose (`fallow-analysis-service.ts:233-235`).</li><li>(c) Clear and Import stay enabled for a retired repository (`review-write-gate.ts:25`).</li><li>(d) Forget answered "removed" shows the COPY_15 heading.</li><li>(b) The removed mark is memory only.</li></ul> | <ul><li>**Fix (a), (c), (d) (S):** a `removed` binding view with no Choose; retired blocks Clear and Import; a removed heading (copy in §4).</li><li>**Accept (b):** no snapshot survives a restart.</li></ul> | Three component REDs. |
| GRB14 | **A stacked reload lets a duplicate add through** (B17) | `review-buckets.ts:81-102`. | **Fix (S):** the upsert lands even when a newer load overtakes, because the upserts are id-idempotent. | RED: a race test where the second add returns non-null today. |
| GRB15 | **Focus after Show more** (B19) | The button unmounts and focus drops to the body, in 4 tables. | **Fix (S):** focus the first newly shown row (roving index), in all four. | RED: `activeElement` is the body. |
| GRB16 | **`\@` before a package scope** (B20) | `note-text.ts:28-29` escapes every `@`. | **Fix (S):** escape `@` only after a character that can end a GFM email local part. | Unit RED; native scenario 26 changed: `@scope/pkg` shows no backslash, and email addresses stay inert. |
| GRB17 | **Bidi controls and unreadable paths** (B22) | <ul><li>(a) Report symbol and detail render bidi controls raw (`read-models/findings.ts:78`).</li><li>(b) The Node adapter maps any lstat error to "missing" (`node-source-filesystem.ts:149-150`).</li></ul> | <ul><li>**Fix (a) (S):** a `visibleControls()` display helper (shared with the preview).</li><li>**Fix (b) (S–M):** `StatResult.unreadable?: string` (**§4.5 additive amendment**); the preview reports `read-error` and the source modal names the code.</li></ul> | REDs: a U+202E symbol; an injected EACCES. |
| GRB18 | **Inherent limits, accepted** (B6, B11, B12, B14 and B15 sub-items) | Listed in §7. | **Accept**, each with its one-line reason, recorded in LIM and the ledger. B6 is GCO24. | — |

## 4. Decisions

- **GCN1 — Order and landing.** Parts land as D, C, A, B, each fast-forwarded onto PR 1 after its own final review, with a green `npm run verify` and the native gate on 1.13.4 and latest. Part D comes first because GRD1 and GRD4 make every later native run trustworthy. Part C comes second because its gates (contrast, axe, layering) then measure Parts A and B as they land.
- **GCN2 — The frozen viewport.** GRA2 is built around `CityViewport.vue` without editing it. The cap wraps the factory the host provides, and Retry remounts the viewport. The reconstruct counter resets only on Retry. The reason reused is `initialization-failed`, so no §4.2 interface change. The **§4.2 prose is amended in writing**, at spec `:589-591` and `renderer-port.ts:28-32`: "disposes and reconstructs, at most 3 times automatically; then S11, with a user-initiated Retry 3D (renderer only, never scan)".
- **GCN3 — §4 amendments, in writing.**
  - §4.1: `CityViewState.name?` (GRA8).
  - §4.5: `StatResult.unreadable?` (GRB17).
  - §4.2: the GCN2 prose.
  - Spec §7 and the G2 evidence: the concurrency wording (GCO8).
  - Nothing else in §4 changes.
- **GCN4 — Gates must pass on their first landing.** The layering bans, the contrast gate and axe each land green. A violation is fixed in the same part, or carries a recorded exception ruling that names the file and the reason. The rules themselves are never weakened.
- **GCN5 — The concurrency guarantee (GCO8).** Exclusion is checked before any open. No new open starts after a cancel is observed. In-flight reads drain before the run reports cancelled, which keeps spec §7's "the UI never claims work stopped before the collector confirms it". The emission order is index-ordered and unchanged. Only the read-log *order* becomes completion-dependent.
- **GCN6 — Wide leaf, measured.** The target is a stage of ≥ 1,140 px at a 1,876 px viewport with the inspector open: the pre-shell figure from the original complaint. It is reached by lowering the panel percentages, keeping the caps and the minimums. The values come from the harness measurement, never from estimates.
- **GCN7 — The crash remedy is chosen from a dump.** No remedy lands without the baseline arm reproducing the crash with diagnostics on. A remedy counts as shown only after 11 consecutive green 1.13.4 runs. Moving the baseline Obsidian version is not a remedy this pass may take without the owner.
- **GCN8 — Native gate growth.** The gate grows from 40 to **46** required scenarios (§5); no title is renamed. Changed scenarios (3, 4, 23, 26, the unload scenario in `plugin-lifecycle`, and scenario 7's recorded RED) each have a RED on record.
- **GCN9 — CI is a mirror, not a new gate set.** It runs exactly `npm run verify`, plus a production-only `npm audit`. A test that first runs in CI and fails is fixed or ruled, never skipped.
- **GCN10 — Per-device bindings (GCO23).** v2 is written only by this version. A v1 record is read as one device and migrated on the next write, under the data lock. An older build that meets v2 reports it as invalid with its reason and refuses to write (it never overwrites v2). This is recorded as the cost of GCO23.
- **GCN11 — Accepted items are closed, not dropped.** Every Accept row gets a dated line in LIM and in the ledger, with its reason. The PR 1 body moves it from "follow-ups" to "decided limitations".
- **GCN12 — Proposed wording (approved together with this spec).**

  | Where | Today | Proposed |
  |---|---|---|
  | `CLAIM_SOURCE_UNCHANGED` (WP-04 E29) | "Scanning never changes the source." | "Scans and previews never change source files." |
  | `RULE_NOT_EVALUATED_REASON` (WP-03 E7) | "A module in this rule is not in the module graph." | "One of this rule's modules is not shown in the module graph, so it cannot be checked." |
  | `ARCH_MAP_EYEBROW` | "Module graph · evidenced imports" | "Module graph · evidenced imports only" |
  | `ARCH_MATRIX_CAPTION` | "Evidenced imports from each row module to each column module" | "Evidenced imports from each row module to each column module (cycle and boundary imports only)" |
  | `ARCH_NODE_LABEL` | "{label}, {n} files, {out} outgoing, {in} incoming, evidenced imports" (gives "1 files") | "{label}: {n} file(s); evidenced imports: {out} outgoing, {in} incoming" |
  | `RULES_EMPTY` | "No boundary rules yet. Add one to compare an intended boundary with fallow's evidenced imports." | "No boundary rules yet. Add one to check an intended boundary against fallow's evidenced imports." |
  | `BOUNDARY_INSPECTOR_SUBTITLE` | "Intended rule vs. evidenced imports." | "Your rule, checked against evidenced imports." |
  | `ARCH_RULES_CAPTION` (JP3) | "{n} rules · {m} not evaluated" (gives "1 rules") | "{n} rule(s) · {m} not evaluated", correctly pluralised. The five cards stay, per WP-03 Polish E4. |
  | `RETRY_3D` (GRA2) | — | "Retry 3D" |
  | Matrix diagonal (GRC8) | "Same module" | "Same module · {n} boundary violation(s) inside" |
  | Map node suffix (GRC8) | — | ", {n} boundary violation(s) inside" |
  | Folder is root (GRB7) | "The note will appear in the next scan." | "This folder is the codebase folder itself. Choose another folder for the note." |
  | Root changed (GRB8) | (the no-binding text) | "This codebase is now connected to a different folder than the one scanned. Scan it again to preview files." |
  | Removed codebase heading (GRB13d) | COPY_15 failure heading | "This codebase was removed." |
  | Wildcard exclusion (GRB12) | — | "The exclusion "{x}" contains * or ? and matches nothing. Edit it in Settings." |
  | Unreadable folder (GRB17b) | "… missing …" | "The folder cannot be read ({code})." |
  | Config files (GRB9) | — | "fallow config files in the root: {list}" / "No fallow config file in the root" |

## 5. Native scenarios (exact titles appended to `tests/e2e/required-scenarios.json`)

| # | File | Title | RED proof | Positive control |
|---|---|---|---|---|
| 41 | settings | `a render waiting in the settings tab is released when another settings tab is opened` | `hidden()` a no-op | Before the switch, the settings search does not find the write for this tab. |
| 42 | city | `the city shows the source as unavailable when its folder is gone, and keeps the snapshot readable` | RED on 1baa572 (generic "Scan failed") | File rows are listed before the rename, and still after it. |
| 43 | settings | `the settings tab follows a data.json changed outside the plugin and names an invalid record's reason` | RED on 1baa572 (no live update) | The tab lists the original profile before the external write. |
| 44 | notes-refresh | `refreshing a note keeps its frontmatter comments and quoting` | RED on 1baa572 | The keys the refresh owns are updated. |
| 45 | notes-index | `a linked note the vault indexed late is listed when Investigate opens again` | RED on 1baa572 | An indexed note is listed at once. |
| 46 | notes-root | `a notes folder that is the codebase folder itself is refused, and nothing is written` | RED on 1baa572 (created with a warning) | A valid folder in the same dialog is accepted. |

**Changed scenarios** (titles unchanged): 3 (NE13 observer), 4 (its own scan-running control), 23 (the `root-changed` text), 26 (`@scope/pkg`), the plugin unload scenario (`window.__THREE__` cleared) and 7 (E9's recorded RED, no change). Each has a RED on record.

## 6. Verification and evidence (per part, then once at the end)

- **`npm run verify`** exits 0. Every run is disclosed with its Z38 outcome (pass with figures, fail with figures, or skip with the control figure).
- **`npm run test:e2e`** passes every required scenario exactly once on the baseline 1.13.4 and once on latest. Runs pass the load gate (GRD4). From Part D onward, a run that crashes is evidence for GRD1, never retried.
- **Other checks:**
  - `npm run test:fallow` passes.
  - `npm run analyze` prints 9 until GRC12, then 4.
  - `npm audit` reports 0 after GRC14.
  - The CI workflow is green on PR 1 after Part C.
  - `npm run harness-shot` and `harness-measure` captures are looked at for every part that changes layout.
- **Evidence counts are refreshed once per part:** the G8 table and its mirror, `Test Evidence.md`'s native paragraph, and the count tests. Evidence prose is checked against git by the part's task reviewer.

## 7. Accepted limitations (closed as decided, with reasons)

- **B6 (GCO24):** stale-location detection compares size, line count and mtime, not content.
- **B11(a):** an unreachable root's null resolution is kept for the session. This is fail-safe: it falls back to the textual check.
- **B11(b):** a mapped drive to an offline server blocks once per session. `plan()` must be synchronous (NE15), and Node has no non-blocking realpath with a timeout.
- **B12:** the Settings render waits while a field has focus, by design. FN1's hidden-tab render draws into no visible field.
- **B14:**
  - (1) A force-quit leaves fallow running: Node has no Windows kill-on-parent-death.
  - (2) The synchronous 16 MB `JSON.parse`: it is measured, and a worker would need a second bundle entry.
  - (4) Scan exclusions are not applied to fallow: Z15 fixes the argv, and findings in excluded paths stay unmatched.
  - (5) Untested fallow versions carry a label: that label is the mitigation.
  - (6) Machine identity is inferred: Obsidian offers no stable device id.
- **B15:**
  - (1) The 200k ceiling is a hard failure: degrading would redefine `partial`.
  - (2) There is no include list: a feature for a later work package.
  - (5) The height cap is derived per snapshot: a stable cap needs WP-05's history.
  - (6) File symlinks are skipped, by design (§4.4).
- **B16(b):** the removed mark is memory only.
- **The remaining E-group minors** are accepted as listed in §3.1.
- **GCO15:** the search field stays host-styled.

## 8. Not agent-closable (the owner's actions)

- **A12:** the manual Part 7 check, item 3 (a trusted fallow run without freezing Obsidian).
- **A13:** the human accessibility checkpoint #4. The rows still open are NVDA, a third-party theme (M113), two leaves, pop-out migration, GPU context recovery, and the host-shortcut half of Row 1.
- **C8:** other operating systems, and the POSIX process-group kill.
- **C12:** the Electron/Chrome performance row.
- **B21:** the §11 host questions (DeferredView and WebGL contexts, a context surviving pop-out).
- **D9:** the file-symlink test, which needs Developer Mode. CI's elevated runner may exercise it (GRC2).

## 9. Limitations known at design time

- GRA2 reuses `initialization-failed`, so a capped context and a context that never initialised show the same COPY-14 notice. The Retry button is what distinguishes them.
- GRB2 makes the read-log order completion-dependent.
- GRB10 and GRA8 make older builds reject the new shapes; each is recorded.
- GRC3's gate measures the vendored app.css 1.12.4, not the user's theme.
- GRC5 under jsdom misses layout-dependent rules (target size, reflow).
- GRD1 may end in "rate reduced" rather than "eliminated". If 11 consecutive greens cannot be shown, the part reports the measured rate and stops for the owner. It never retries.
