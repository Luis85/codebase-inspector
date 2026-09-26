# WP-02 Part 6 — Durable review state, fallow report import with the findings lens, and the cancelling state: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Part 6 delivers four things:
- review state (work items, boundary rules, finding dispositions) that survives a restart;
- import of a real fallow JSON report, with its findings on every screen and on the city's findings lens, replacing the sample findings;
- a `cancelling` state on the city;
- the toolbar Scan button moved to `aria-disabled`.

**Architecture:** The Part 1–5 shell stays as it is:
- screens read read models, stores and copy only;
- every value is a `MetricValue`;
- `city-store` owns selection and route;
- review decisions go through `ReviewRepository`.

Part 6 adds:
- **A durable review adapter** in plugin `data.json`, one per codebase, shared across leaves by a plugin-level registry. It allocates ids and notifies subscribers.
- **Fallow import only, no process:** a raw-report zod schema and reader in the adapter layer, and a pure normaliser in the application layer.
- **Evidence shared per plugin:** a session-only in-memory evidence repository, a per-leaf Pinia evidence store bound per codebase, and an evidence index read model that replaces the sample findings.
- **The findings lens:** a recolour-only `setReported` on the renderer, driven by a lens composable.

**Tech Stack:** TypeScript, Vue 3.5 (`<script setup>`), Pinia 4, zod 4.6.5, Three 0.186, Vitest 5 + @vue/test-utils (jsdom), plain CSS under `:where(.codebase-inspector-root)`.

**Spec:** `docs/superpowers/specs/2026-09-23-inspector-ui-part6-design.md` (decisions Y1–Y40). It sits on these specs, all binding:
- Part 1 (A1–A13);
- Part 2 (P1–P14);
- Part 3 (Q1–Q17);
- Part 4 (W1–W17);
- Part 5 (V1–V32).

Precedent, all binding: the Part 3 ledger (R1–R9, E1–E55), the Part 4 ledger (S1–S27, X0–X19, "Part 4 E1–E22") and the Part 5 ledger (T1–T32, "Part 5 E1–E25"). This part's rulings live in `docs/superpowers/notes/2026-09-23-wp02-part6-ledger.md`: planning rulings are U1…, and execution rulings are "Part 6 E1"….

**Branch:** `feat/wp-02-part6` (from `feat/wp-01-codebase-city` at d5ee2c9), worktree `C:\Projects\codebase-inspector\.claude\worktrees\wp02-part6`. **Not stacked:** at the end, `feat/wp-01-codebase-city` is fast-forwarded to this branch and pushed, so the work lands on PR #1. The integration step is the user's choice.

**Before Task 1:** the worktree has no `node_modules`. The controller runs `npm ci` once in the worktree before the pre-flight scan.

## Global Constraints

**Size**
- `src/**/*.{ts,vue}` max **400** lines. `tests/**/*.ts` max **450** lines (eslint `max-lines`).
- `src/ui/stores/review-store.ts` is at **400/400**. Task 2, the first task to touch it, splits it. After Task 2 it is ≤ 360 lines (`tests/unit/review-store-budget.test.ts`).
- `src/ui/components/CityViewport.vue` is at **400/400**: do not edit it. Lens wiring goes in `src/ui/screens/city/use-lens-renderer.ts`, used by `CityStage.vue` (Task 11).
- `src/host/city-view.ts` (275) and `src/ui/screens/CityWorkspace.vue` (189) are under the 360-line budget test (`tests/unit/city-budget.test.ts`). Keep them there. Tasks 4 and 7 add at most about 10 lines to `city-view.ts`. `CityWorkspace.vue` gains nothing: the cancelling banner goes through the existing StatusBanner.
- `tests/host/city-view-store-wiring.test.ts` is 450/450: never grow it. New host tests go in new files.
- Other test files at or near the cap (do not grow past 450): `renderer-contract` 450, `city-viewport` 448, `welcome-state` 446, `picking` 440, `city-view` 439, `settings-tab` 435, `consent-chain` 420, `window-migration` 419, `responsive-floor` 415, `evidence-numbers` 402, `camera-rig` 401. Add a new test file rather than growing any of them.
- Other `src` files near the cap: `city-renderer.ts` 378, `instanced-city.ts` 334, `inspector-copy.ts` 297. Keep each under 400.

**Browser globals**
- No bare `window`, `document`, `setTimeout`, `ResizeObserver`, `matchMedia`, `getComputedStyle`, `localStorage` in `src/ui/**` (eslint `no-restricted-globals`). No identifier named `window`.
- Use `el.ownerDocument`, `el.ownerDocument.defaultView`, `win.setTimeout`, `nextTick`.
- Never `x instanceof HTMLElement`; always `x.instanceOf(HTMLElement)`.
- Listeners go on the leaf/shell root or on component elements, **never the document**.
- Element ids come from `useUniqueId()` (`src/ui/unique-id.ts`).

**TypeScript and lint**
- tsconfig `lib` is ES2020: no `.at()`, `Object.hasOwn`, String/Array `replaceAll`, `findLast` or other ES2021+ API in `src`.
- oxlint runs `--deny-warnings` with `consistent-function-scoping`: a closure that captures nothing is hoisted to module scope.
- `obsidianmd/prefer-create-el` applies. The only exemption is `src/ui/export/download.ts` and its test. File inputs live in Vue templates, never `createElement`.
- `obsidianmd/no-nodejs-modules` is an error in `src/**`. Nothing in Part 6 imports `fs`, `path` or `child_process` under `src/`.
- `exactOptionalPropertyTypes` is **review discipline**, not a tsconfig flag (Part 4 X13): never assign `undefined` to an optional property; spread it in conditionally.
- zod 4 conventions: `error.issues`, `.strict()` for our own formats, `{ error: '…' }` messages. **The third-party fallow raw schema uses `z.object` (strip)** (Y22, ledger U4). Only the fields we read are declared and type-checked. Unknown fields, including `fragment`, `actions` and `_meta`, are dropped by parsing. `z.looseObject` would keep them.

**Evidence**
- Absent evidence is never rendered or exported as `0`. It is a `MetricValue` with `state: 'unknown'` and a `reason`.
- No composite health score. No exploitability verdict. No invented confidence percentage.
- Sample values are always labelled. After Task 8 there are no sample **findings**. Other sample signals (complexity, history, coverage, packages, imports) stay sample and labelled.
- Mutation, runtime exploitability and secret candidates are always `unknown`.
- No per-person data.
- **Source file content is never read or stored.** The fallow `fragment` field (source text), `actions` and `suggestions` are dropped at parse time.
- Imported fallow evidence is `collected` (provenance source `'fallow'`), or `stale` (Y30), or `unknown` with reason `FALLOW_NOT_ANALYSED` when absent. Its source match is always **unverified**.

**Storage and exports**
- **Nothing is written to the vault.** Exports go through `downloadText` (via `useCsvExport`).
- An import reads **only the file the user picks** (a template `<input type="file">`), never the vault.
- Durable state is **only** the review record sets under `data.json`'s `reviews` key, keyed by `repositoryId`, behind the `ReviewRepository` port, exactly as the in-memory buckets are keyed. No `localStorage`, no IndexedDB, no files.
- Imported fallow evidence is **session-only** memory (Y28).
- The review record set never contains an absolute path or a raw entity id (Y6). Imported text (file name, symbols, paths, warnings) is never rendered as HTML.
- Do not modify `city-store` `select`, `setQuery`, `setCamera` (calling them, and `navigate`/`setViewMode`/`returnFromList`, is fine).
- **Nothing in `src/` spawns a process** (`tests/unit/no-process-execution.test.ts`, Task 5).

**Copy and CSS**
- Every new visible string goes in `src/ui/audit-copy/*.ts` (re-exported by `src/ui/inspector-copy.ts` through `export *` lines), **never** `src/ui/copy.ts`. `copy.ts` exports may be imported. New copy files: `audit-copy/city.ts` (Task 1), `audit-copy/fallow.ts` (Task 5 onwards), `audit-copy/storage.ts` (Task 3).
- CSS lives only in `src/ui/styles/{kit,shell,screens,screens-explore,screens-audit,screens-act,screens-configure}.css`, under `:where(.codebase-inspector-root)`, with BEM `ci-*` classes and colours only through `--ci-*` tokens.
- Every `var(--font-ui-*)` carries an em fallback: `smaller → 0.8em`, `small → 0.9em`, `medium → 1em`, `large → 1.15em`.
- **Never edit `src/ui/styles.css`.** No Vue `<style>` blocks. Import the kit dialog as `CiDialog`.
- Text on a coloured fill uses the Part 5 derived tokens (`--ci-action-fill`, `--ci-danger-fill` and their hovers). Hovers use `--ci-hover`; pressed and current states keep `--ci-raised`.
- A screen never uses another screen's block class; shared looks live in `kit.css` (`tests/unit/css-class-scope.test.ts`). A new class belongs to its own screen's block or to `kit.css`.

**Accessibility**
- Accessible names contain the visible label (WCAG 2.5.3).
- A button that can become blocked while focused uses `aria-disabled="true"` plus a guarded handler, never `disabled` (E40/E44/E50). The kit's shared `button[aria-disabled="true"]` rule styles it; no per-class aria-disabled rule.
- Announce only real outcomes (E17): a store result of `null`/`false` announces nothing, or announces the refusal.
- Repeated outcomes are re-announced with `reannounce(live, message)` from `src/ui/kit/reannounce.ts`.
- Dialog outcomes that leave the dialog open are announced inside it through `CiDialog`'s `status` prop or a `role="alert"` element.

**Test infrastructure**
- jsdom stubs load through vitest `setupFiles`. Component tests that open a `CiDialog` also `import '../mocks/obsidian'`.
- Tests that mount `App` or a real `CityView` and need the city seed route `'city'`. The harness must keep drawing the city (`tests/unit/obsidian-mock-scope.test.ts`).
- Every `.every(...)` assertion is preceded by a non-empty check (E27).
- No raw BOM or NUL byte in any file: write `String.fromCharCode(0xFEFF)` / `String.fromCharCode(0)` (E7/E39). Entity ids in tests are built with `makeEntityId(...)`.
- Nothing under `src` imports from a `tests/` path, and no `src` folder is named `tests` (E42).
- Multi-step async store chains are awaited with `flushPromises()` from `@vue/test-utils` (Part 4 X9).
- Memoised read models are keyed per leaf input, never by a module-level single slot (E53).
- Every new test must fail without its feature. The implementer runs it RED and pastes the output.
- Edit files only with the Edit/Write tools. **Never `sed -i`, heredocs or scripts**: files are CRLF on Windows.

**Gates and commits**
- Per-task gate: `npm run typecheck && npm run lint:fast && npx vitest run <the task's test files>`, plus `npx eslint <touched files> --max-warnings 0`. Run gate commands in the foreground.
- **The WP-01 evidence-note counts are updated ONCE, in Task 12**, following commits fb84ca3 and d5ee2c9. Before that, `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` may fail on file counts. Do not run the full suite per task, and do not "fix" those two tests.
- `tests/unit/install-script.test.ts` fails in any worktree without `.obsidian/`. It is environmental: report it and never fix it. `tests/host/clean-vault-install.test.ts` can time out on a loaded machine: re-run it alone before calling it a failure.
- Commit after each task, only the task's own files (never the ledger). Every message ends with a blank line and `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

**Process**
- Implementers and reviewers never spawn subagents. Reviewers are read-only and create no files in the worktree.
- Implementers report back: files changed with line counts, the gate output, the RED and GREEN output, and every deviation from this plan and why.
- The controller records every ruling in the ledger.

### Screen-task conventions (Tasks 1, 4, 9, 10, 11)

- **Screens follow `OwnershipScreen.vue`:** root `<div ref="root" class="ci-screen ci-screen--<route>">`, `PageHeader` with the actions slot, and a `<p class="visually-hidden ci-<route>__live" role="status">` right after `</PageHeader>` when the screen announces outcomes.
- **Selection** always goes through `store.select(id)`. Nothing moves the camera.
- **Export**: `const exportText = useCsvExport(root, liveMessage);` then `exportText(FILENAME, () => build(...), MIME)`. Never call `downloadText` directly.
- **Work items and review state** go through `review-store`. A `null`/`false` result announces nothing (E17). A rejection sets the task's `*_FAILED` string, in the live region or in the dialog's `role="alert"` error.
- **Evidence** goes through `evidence-store` (Task 7). A screen never holds its own copy of a report.
- **Blocked buttons**: `:aria-disabled="blocked ? 'true' : undefined"` plus an early `return` in the handler.
- **Dialogs** follow `src/ui/screens/settings/ImportReviewDialog.vue`: `CiDialog`, `useBusyAction()`, the repository id checked again before and after each async step, a late result dropped after a codebase switch, Cancel/Escape/backdrop ignored while busy (Part 4 E13).
- **File pickers** follow `src/ui/screens/settings/ImportRow.vue`: a template-owned, visually hidden `<input type="file" accept=".json,application/json" tabindex="-1" aria-hidden="true">`, clicked by a real button, `input.value` cleared after each pick.
- **Component tests** follow `tests/component/ownership-screen.test.ts`: `setActivePinia(createPinia())`, `buildSnapshotFixture`, `useCityStore().setCity(snap, computeLayout(snap))`, `mount(..., { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } })`, `w.unmount()`.

## File map

| File | Status | Task | Responsibility |
|---|---|---|---|
| `src/ui/view-surface.ts`, `src/ui/components/{AppToolbar,AnnouncementRegion}.vue`, `src/ui/audit-copy/city.ts` | modify / create | 1 | cancelling state; Scan `aria-disabled` |
| `src/ui/stores/ports/review-repository.ts` | modify | 2 | `allocateId`, `subscribe`, `diagnostics`; in-memory adapter |
| `src/ui/stores/review-buckets.ts` | create | 2 | bucket map, binding, factory, subscription |
| `src/ui/stores/review-store.ts` | modify (split) | 2 | state, getters, actions; pending per codebase |
| `src/adapters/storage/plugin-data-shape.ts` | modify | 3 | `reviews` key |
| `src/adapters/storage/plugin-data-review-repository.ts` | create | 3 | durable adapter |
| `src/adapters/storage/review-repository-registry.ts` | create | 3 | one instance per codebase; purge |
| `src/ui/read-models/review-record-codec.ts` | create | 3 | record ⇄ stored form (path form) |
| `src/ui/read-models/review-state-import.ts` | modify | 3 | export the record schemas for reuse |
| `src/ui/audit-copy/storage.ts` | create | 3 | storage error and diagnostics copy |
| `src/host/data-ports.ts` | create | 4, 7 | `wireDataPorts(pinia, deps)`, `unwireDataPorts(pinia)` |
| `tests/fixtures/data-port-deps.ts` | create | 4, 7 | `dataPortDeps()`: the only `CityViewDeps` test helper |
| `src/host/setting-definitions.ts`, `src/ui/read-models/review-state.ts` | modify | 3, 4 | extracted export helpers; storage copy |
| `src/host/city-scan-controller.ts`, `src/host/city-view.ts`, `src/main.ts`, `src/host/settings-tab.ts` | modify | 4, 7 | deps, wiring, purge |
| `src/ui/screens/settings/PrivacyRows.vue` | modify | 4 | skipped-records line |
| `tests/fixtures/fallow/**` | create | 5 (controller records) | fixture project + raw outputs |
| `src/application/evidence/{raw-fallow,fallow-report-schema,read-fallow-report}.ts`, `src/ui/audit-copy/fallow.ts` | create | 5 | raw types; zod schema (`z.object` strip); reading and error codes; copy. **No `src/adapters/fallow/`** (U9) |
| `src/domain/hash.ts` | create | 6 | `fnv1a32Hex` |
| `tests/fixtures/evidence-report.ts` | create | 7, 8 | the ONE shared evidence fixture (U31) |
| `src/application/evidence/{model,normalize-fallow,resolve-findings}.ts` | create | 6 | normalised evidence; path resolution; mapping |
| `src/application/ports/evidence-repository.ts`, `src/adapters/storage/in-memory-evidence-store.ts` | create | 7 | session evidence |
| `src/ui/stores/evidence-store.ts` | create | 7 | per-leaf binding |
| `src/host/commands.ts`, `src/ui/App.vue` | modify | 7 | fourth command; bind evidence |
| `src/ui/read-models/evidence-index.ts` | create | 8 | per-file findings and counts |
| `src/ui/read-models/{findings,file-detail,overview,city-summary,file-summaries,use-read-models}.ts`, `src/ui/fixtures/sample-signals.ts`, `src/ui/shell/{NavColumn.vue,use-route-provenance.ts}` | modify | 8 | swap samples for evidence |
| `src/ui/fixtures/sample-findings.ts` | delete | 8 | — |
| `src/ui/kit/{EvidenceBadge,NotAnalysed}.vue` | create | 9 | C13 badge; not-analysed state |
| `src/ui/screens/QualityScreen.vue`, `quality/*`, `file/FileFindingsPanel.vue` | modify | 9 | real findings UX |
| `src/ui/screens/sources/{ConnectFallowDialog,FallowCardDetails}.vue`, `ProviderGrid.vue`, `SourcesScreen.vue`, `src/ui/read-models/sources.ts` | create / modify | 10 | S14 dialog; fallow card |
| `src/visualization/{renderer-port,instanced-city,city-renderer}.ts` | modify | 11 | `setReported` |
| `src/ui/stores/lens-store.ts`, `src/ui/screens/city/{use-lens-renderer.ts,LensHeading.vue}`, `src/ui/components/{AppToolbar,MetricLegend,CityStage,CodebaseFileList}.vue` | create / modify | 11 | findings lens |
| `tests/harness/*`, `scripts/harness-shot.mjs`, evidence notes | modify | 12 | captures, counts, verify |

---

## Planning amendments (these override the task text below)

Six drafters wrote the task text in parallel against the real code. I then reconciled their seams, and each draft was revised to the rulings below. Where a task's text still disagrees with an amendment, **the amendment wins**. Each amendment cites its ledger ruling (U-numbers in `docs/superpowers/notes/2026-09-23-wp02-part6-ledger.md`).

- **A1 (U15, U16): bulk review writes are atomic.** The port's 13th member is `replaceAll(state)`.
  - Store `replaceAll`/`clearAll` call it **once**.
  - The durable adapter writes the whole set in one `writePluginDataSlice`.
    - It is all-or-nothing: an unrepresentable record, a set over 1 MB, or a read-only set rejects, and nothing is written.
    - On success it notifies once.
    - It replaces skipped-but-kept records too.
    - It never lowers `highWater`.
  - Part 5 E18–E20 still hold, and the Part 5 tests that pinned partial failure are rewritten to the atomic behaviour (Task 2 lists them).
- **A2 (U22, U31): close-time and test deps.**
  - `src/host/data-ports.ts` exports `wireDataPorts` **and** `unwireDataPorts`. Task 4 creates both, and `CityView.onClose` calls `unwireDataPorts(this.pinia)` before dropping the pinia.
  - Task 7 extends both functions for the evidence store and does **not** edit `onClose` again.
  - The only `CityViewDeps` test helper is `tests/fixtures/data-port-deps.ts` `dataPortDeps()`. Task 7 widens it.
- **A3 (U9, U8, U10): fallow code lives in `src/application/evidence/`.** There is no `src/adapters/fallow/`.
  - The raw schema uses `z.object` (strip).
  - `notShown` is `{ key, count }`, labelled with `fallowNotShownLabel(key)`.
- **A4 (U31): one evidence test fixture,** `tests/fixtures/evidence-report.ts`. Task 7 creates it; Task 8 completes it, adding `syntheticFallowJson`.
  - Every synthetic report passes through the real `parseFallowReportText` → `buildEvidenceReport`.
  - No task creates `tests/fixtures/fallow-report.ts` or `tests/fixtures/synthetic-fallow.ts`.
- **A5 (U32, U36): Task 8 owns `findings.ts`, the severity tones and classes, `COPY_16`, and the Overview `fallow` coverage row.**
  - Task 9 builds on Task 8's final text: it adds `FINDING_TITLE_FOR`, the rule and meta copy, the dialog rows and `REPORT_EVIDENCE_TEXT`.
  - Task 9 duplicates none of Task 8's helpers.
  - **Before dispatching Task 9, the controller re-reads Task 8's committed files.** Any edit in Task 9's text whose anchor no longer matches is re-anchored in the brief.
- **A6 (U26): Task 4 rewrites the review-state copy that says "session".** Its table lists 14 strings, and gives the exact new text.
  - Task 8's appendix shows `FINDING_DISMISS_HINT`/`FINDING_DISMISSED` with their pre-Task-4 text. The real files carry Task 4's text by then, so Tasks 8 and 9 must leave those two strings as they find them.
- **A7 (U14): Task 5's Step 0 is the controller's.**
  - The controller writes the fixture project and the config exclusions, then records the five raw outputs in Git Bash from the npx-cached binaries.
  - A node script then checks them against the dry-run values.
  - The controller commits all of this as `test(fixtures): fallow raw fixtures (controller)` before dispatching the implementer.
- **A8 (U17, U24, U25): review store state and Settings.**
  - Adds refuse with `null` until `ready`.
  - `loadFailed` drives `REVIEW_STORE_READ_FAILED` on Settings.
  - App's bind gets `.catch(noop)`. Task 7's App edit anchors on that line.
  - Settings › Clear is `aria-disabled` without a snapshot, with its own `SETTINGS_CLEAR_HINT`.
- **A9 (U29): the Y16 test is a regression pin** that passes before Task 2, so its RED step is exempt.
- **A10 (U39): renderer doubles.** Adding `setReported` touches 18 test doubles, each on an existing line. `city-view-store-wiring.test.ts` stays at 450 lines.
- **A12: what the `R` citations in the task text mean.** The task text cites the controller's reconciliation rulings as R1–R9. Each one maps to ledger rulings:

  | Task text | Ledger rulings |
  |---|---|
  | R1 | U15, U16, U17, U24 |
  | R2 | U22, U31 |
  | R3 | U25, U26 |
  | R4 | U8, U9, U10 |
  | R5 | U31 |
  | R6 | U32, U33, U36 |
  | R7 | U23, U35 |
  | R8 | U37, U38, U40, U41 |
  | R9 | U17, U27, U28, U29, U30 |

  These `R` labels are **not** the Part 3 ledger's R1–R9.
- **A13 (U48–U50): three additions the final drafts made.**
  - `QualityModel.severities`, which feeds the severity filter (Task 9 adds the field to Task 8's model);
  - `src/ui/screens/sources/FallowReportFacts.vue`, shared by the card and the S14 review step (Task 10);
  - `snapshotWithOnlyFiles` in the shared fixture, so the lens has files without findings to contrast (Task 11).
- **A11: the pre-flight scan re-checks every "Consumes" name** against what the earlier tasks actually committed, before each dispatch. That matters most for the Task 8 → 9 → 10 → 11 chain, because the drafts for those tasks were written against drafts, not code.

---

## Task outline and interface contracts

Every task's full text follows this outline. The names and signatures below are binding across tasks.

**Task 1: Cancelling state and Scan `aria-disabled` (Y1–Y4).**
Produces:
- `ViewSurfaceState` member `{ kind: 'cancelling'; hasSnapshot: boolean }`;
- `CANCELLING_BANNER(hasSnapshot: boolean): string` in `src/ui/audit-copy/city.ts`. It is used by both the banner and the announcement; there is no separate announcement constant (U30);
- harness `?run=cancelling`.

**Task 2: Review port extension and store split (Y10, Y12–Y16).**
Produces, in `src/ui/stores/ports/review-repository.ts`:
- `type ReviewIdKind = 'workItem' | 'rule'`;
- `interface ReviewStorageDiagnostics { skipped: number; unsupported: boolean }`;
- `ReviewRepository` gains `allocateId(kind: ReviewIdKind): string`, `subscribe(listener: () => void): () => void`, `diagnostics(): ReviewStorageDiagnostics` and `replaceAll(state: ReviewReplaceState): Promise<void>`, for 13 members in total (U15);
- `interface ReviewReplaceState { workItems: readonly WorkItem[]; rules: readonly BoundaryRule[]; dispositions: readonly FindingDisposition[] }`;
- the store gains `loadFailed: boolean` (U24) and `detach()` (U22). Its `replaceAll`/`clearAll` call the port's `replaceAll` once (U15);
- `formatReviewId(kind: ReviewIdKind, n: number): string` (`wi-N`, `AR-` padded to 3 digits);
- `reviewIdSuffix(id: string): number | null`;
- `createInMemoryReviewRepository()` implementing all twelve members.

In `review-store`:
- `setRepositoryFactory(factory: (repositoryId: string) => ReviewRepository): void`;
- state `storageDiagnostics: ReviewStorageDiagnostics`;
- `ready: boolean` (the bound bucket has completed a load). Adds refuse with `null` until it is true.
- The pending state becomes per codebase. `bulkBusy` stays per store.

`src/ui/stores/review-buckets.ts` holds the bucket helpers used only by `review-store.ts`.

**Task 3: Durable adapter, registry and contract (Y5–Y9, Y11 registry, Y17 purge).**
Consumes: Task 2's port.
Produces:
- `createPluginDataReviewRepository(plugin: Plugin, repositoryId: string): ReviewRepository`;
- `class ReviewStoreError extends Error { readonly code: 'full' | 'unsupported' | 'unrepresentable' }`;
- `REVIEW_STORE_MAX_BYTES = 1_000_000`;
- `interface ReviewRepositoryRegistry { for(repositoryId: string): ReviewRepository; purge(repositoryId: string): Promise<void> }`;
- `createReviewRepositoryRegistry(plugin: Plugin): ReviewRepositoryRegistry`;
- `review-record-codec.ts`: `encodeWorkItem`, `encodeRule`, `encodeDisposition` (each returns the stored form, or `null` when unrepresentable) and `decodeRecords(raw, repositoryId)` (returns `{ workItems, rules, dispositions, skipped }`);
- `tests/contracts/review-repository.contract.ts`.

**Task 4: Wire the durable review state (Y7 UI, Y11, Y17).**
Consumes: Tasks 2 and 3.
Produces:
- `wireDataPorts(pinia: Pinia, deps: CityViewDeps): void` and `unwireDataPorts(pinia: Pinia): void` in `src/host/data-ports.ts`. `CityView.onClose` calls `unwireDataPorts` (U22);
- `tests/fixtures/data-port-deps.ts` exporting `dataPortDeps(): Pick<CityViewDeps, 'reviewRepositoryFor'>` (U31);
- `CityViewDeps.reviewRepositoryFor: (repositoryId: string) => ReviewRepository`;
- `CodebaseInspectorSettingTab` takes the registry and calls `purge`;
- the Settings skipped-records line.

**Task 5: Fallow fixtures, raw schema, reader and the no-process guard (Y20–Y22, Y31 codes).**
The controller records the fixtures before dispatch (U14). All modules are in `src/application/evidence/` (U9): `raw-fallow.ts` holds the types and constants, `fallow-report-schema.ts` the zod schema, and `read-fallow-report.ts` the reader. Produces:
- `type FallowReportKind = 'combined' | 'dead-code' | 'health' | 'dupes'`;
- `FALLOW_SUPPORTED: readonly { kind: FallowReportKind; schema: number }[]`;
- `RawFallowReport`;
- `FALLOW_REPORT_MAX_BYTES = 16 * 1024 * 1024`;
- `type FallowImportErrorCode = 'too-large' | 'not-json' | 'unsupported' | 'invalid' | 'source-mismatch' | 'read-failed'`;
- `type FallowReadResult = { ok: true; report: RawFallowReport } | { ok: false; code: FallowImportErrorCode; detail: string }`;
- `readFallowReportFile(file: File): Promise<FallowReadResult>`;
- `parseFallowReportText(text: string): FallowReadResult`.

**Task 6: Evidence model, normaliser and resolution (Y23–Y27).**
Consumes: Task 5.
Produces, in `src/application/evidence/model.ts`:
- `FindingCategory`, `FindingDetail`, `EvidenceFinding`, `NormalizedEvidence`, `EvidenceReport`.

Also:
- `normalizeFallow(raw: RawFallowReport, opts: { stripPrefix: string | null }): NormalizedEvidence`. This is snapshot-independent, so the index can re-resolve against a newer snapshot (Y30).
- `resolveFindings(findings: readonly EvidenceFinding[], snapshotPaths: ReadonlySet<string>): { matched: readonly EvidenceFinding[]; unmatchedPaths: readonly string[] }`;
- `suggestStripPrefix(paths: readonly string[], snapshotPaths: ReadonlySet<string>): string | null`;
- `buildEvidenceReport(input: { raw: RawFallowReport; fileName: string; importedAt: string; snapshotId: string; stripPrefix: string | null }): EvidenceReport`.

**Task 7: Session evidence, the evidence store, wiring and the command (Y28, Y29, Y39).**
Consumes: Task 6's `EvidenceReport`, Task 4's `wireDataPorts`.
Produces:
- `interface EvidenceRepository { get(repositoryId: string): EvidenceReport | null; put(repositoryId: string, report: EvidenceReport): void; remove(repositoryId: string): void; subscribe(listener: (repositoryId: string) => void): () => void }`;
- `class InMemoryEvidenceStore implements EvidenceRepository`;
- `useEvidenceStore` with state `{ repositoryId: string; report: EvidenceReport | null; importRequested: boolean }` and actions `setRepository(repo)`, `bindRepository(id)`, `attach(report): boolean`, `remove(): boolean`, `requestImport()`, `consumeImportRequest(): boolean`;
- `CityViewDeps.evidenceStore: EvidenceRepository`;
- `CityView.hasSnapshot(): boolean` and `CityView.openReportImport(): void`;
- command `import-analysis-report`, named `FALLOW_COMMAND_IMPORT`.

**Task 8: Evidence index and the read-model swap (Y33, Y34).**
Consumes: Tasks 6 and 7.
Produces, in `src/ui/read-models/evidence-index.ts`:
- `type EvidenceIndexState = 'none' | 'current' | 'stale'`;
- `interface FileEvidence { findings: MetricValue; high: MetricValue; unused: MetricValue }`;
- `interface EvidenceIndex { state; report: EvidenceReport | null; byFile: ReadonlyMap<EntityId, readonly EvidenceFinding[]>; perFile(id: EntityId): FileEvidence; totals: FileEvidence; matchedFindings: number; matchedFiles: number; unmatchedPaths: readonly string[]; category(c: FindingCategory): 'analysed' | 'not-analysed' }`;
- `evidenceIndexFor(files: readonly FileSummary[], report: EvidenceReport | null, snapshotId: string): EvidenceIndex`.

`use-read-models` exposes `evidence: ComputedRef<EvidenceIndex>`.

`QualityFinding`/`FileFinding` become `{ id; kind: FindingCategory; rule: string; severity: string; line: number | null; endLine: number | null; symbol: string | null; detail: FindingDetail; title; fingerprint }`, where `severity` is the tool's string or `'unrated'`. They also gain `severityRank(s: string): number`.

`sample-findings.ts` is deleted, and so are the `FileSummary` fields `findings`, `highFindings` and `unusedExports`.

**Task 9: EvidenceBadge, NotAnalysed, Quality and File detail (Y32, Y35, Y36).**
Consumes: Tasks 7 and 8.
Produces:
- `EvidenceBadge.vue` (props `version: string`, `state: 'imported' | 'stale'`);
- `NotAnalysed.vue` (emits `import`);
- the Quality and File findings UX.

**Task 10: Data & scans fallow card and the S14 dialog (Y31, Y37, Y38).**
Consumes: Tasks 5–9.
Produces:
- `ConnectFallowDialog.vue` (emits `close`, `done(message: string)`);
- `FallowCardDetails.vue`;
- the `fallow` provider card;
- `SourcesScreen` consuming `importRequested`.

**Task 11: The findings lens (Y40).**
Consumes: Task 8's index and Task 9's `EvidenceBadge`.
Produces:
- `CityRendererPort.setReported(ids: ReadonlySet<EntityId> | null): void` (U38);
- `useLensStore` with `{ lens: 'category' | 'findings' }` and `setLens`/`reset`;
- `useLensRenderer()`;
- `LensHeading.vue`;
- the toolbar lens select, the legend rows and the list-mode column.

**Task 12: Harness, captures, evidence counts, verification (final; controller).**
Adds:
- `?report=demo`;
- the new shots `city-cancelling`, `sources-fallow`, `connect-fallow-review`, `quality-fallow` and `city-lens`;
- the evidence-note counts, updated once;
- `npm run verify`.

---

### Task 1: Cancelling state and Scan `aria-disabled` (Y1–Y4)

The city gets a `cancelling` banner state that never falls through to the welcome, `AnnouncementRegion` announces the move into it once per run, and the toolbar Scan button moves from native `disabled` to `aria-disabled` plus a guarded handler (T29). The harness accepts `?run=cancelling`.

**Files:**
- Create: `src/ui/audit-copy/city.ts` (6)
- Modify: `src/ui/inspector-copy.ts` (297 → 300)
- Modify: `src/ui/view-surface.ts` (141 → 147)
- Modify: `src/ui/components/AppToolbar.vue` (112 → 119)
- Modify: `src/ui/components/AnnouncementRegion.vue` (89 → 102)
- No change: `src/ui/components/StatusBanner.vue` (27; it already renders every non-empty-state copy, so `cancelling` reaches it through `surfaceCopy`), `src/ui/screens/CityWorkspace.vue` (189; it already passes `hasSnapshot` into `deriveViewSurfaceState`, and the welcome action is gated on `kind === 'no-source'`), `src/ui/styles.css` (never edited; its `button.ci-toolbar__scan:disabled` rule simply stops matching).
- Modify: `tests/harness/page.ts` (54 → 55)
- Modify: `tests/harness/seed.ts` (57 → 62)
- Modify: `tests/harness/mount.ts` (281 → 282)
- Modify: `tests/harness/harness.test.ts` (93 → 96)
- Modify: `tests/unit/view-surface.test.ts` (191 → ~213)
- Modify: `tests/component/status-surfaces.test.ts` (213 → 215)
- Modify: `tests/component/announcement-region.test.ts` (141 → ~182)
- Modify: `tests/component/toolbar-scan.test.ts` (134 → 142)
- Create: `tests/component/city-cancelling.test.ts` (~50)

**Interfaces:**
- Consumes: `useRunStore().run` (`InventoryRunState`, whose `cancelling` variant is `{ status: 'cancelling'; runId; generation }`), `useCityStore().snapshot`, `reannounce` (`src/ui/kit/reannounce.ts`), the kit's shared `button[aria-disabled="true"]` rule (`src/ui/styles/kit.css:27`, loaded after `styles.css`, so its `cursor: not-allowed` wins the (0,1,1) tie with `button.ci-toolbar__scan`).
- Produces:
  - `ViewSurfaceState` member `{ kind: 'cancelling'; hasSnapshot: boolean }` — a banner state (not in `EMPTY_STATE_KINDS`), derived in `running`'s slot.
  - `CANCELLING_BANNER(hasSnapshot: boolean): string` in `src/ui/audit-copy/city.ts`, re-exported by `inspector-copy.ts`: `'Cancelling the scan…'`, plus " The current snapshot stays available." when a snapshot exists. Ruling R9: there is no `CANCELLING_ANNOUNCEMENT`, and `city.ts` reuses no other module's literal (not `SOURCES_RUN_CANCELLING`).
  - `AnnouncementRegion` announces `CANCELLING_BANNER(cityStore.snapshot !== null)` once per `runId`, through `reannounce`.
  - `AppToolbar`: `scannable = run.status !== 'running' && run.status !== 'cancelling'`; `:aria-disabled="scannable ? undefined : 'true'"`; `requestScan()` refuses while blocked.
  - Harness: `HarnessOptions.run?: 'running' | 'cancelling'`; `cancellingLifecycle(): ScanLifecycleState` in `tests/harness/seed.ts`. The `city-cancelling` SHOTS entry is Task 12's.

- [ ] **Step 1: Write the failing tests.**

In `tests/unit/view-surface.test.ts`, after the test `it('reuses run-state.ts’s own CANCELLED_BANNER for "cancelled"', …)` (its closing `});`), add inside the `surfaceCopy` describe. Replace:

```ts
  it('reuses run-state.ts’s own CANCELLED_BANNER for "cancelled"', () => {
    expect(surfaceCopy({ kind: 'cancelled' })).toBe(CANCELLED_BANNER);
  });
```

with:

```ts
  it('reuses run-state.ts’s own CANCELLED_BANNER for "cancelled"', () => {
    expect(surfaceCopy({ kind: 'cancelled' })).toBe(CANCELLED_BANNER);
  });

  it('Part 6 Y1: "cancelling" says the snapshot stays only when there is one', () => {
    expect(surfaceCopy({ kind: 'cancelling', hasSnapshot: true })).toBe('Cancelling the scan… The current snapshot stays available.');
    expect(surfaceCopy({ kind: 'cancelling', hasSnapshot: false })).toBe('Cancelling the scan…');
  });
```

Replace:

```ts
  it('surfaces cancelled', () => {
    expect(deriveViewSurfaceState(baseInputs({ runStatus: 'cancelled' })).kind).toBe('cancelled');
  });
```

with:

```ts
  it('surfaces cancelled', () => {
    expect(deriveViewSurfaceState(baseInputs({ runStatus: 'cancelled' })).kind).toBe('cancelled');
  });

  // Part 6 Y1: cancelling takes running's slot — after the renderer and root checks, before
  // cancelled and everything snapshot-derived — and carries whether a snapshot exists.
  it('surfaces a cancelling scan over a snapshot, and over none without falling through to no-source', () => {
    expect(deriveViewSurfaceState(baseInputs({ runStatus: 'cancelling' }))).toEqual({ kind: 'cancelling', hasSnapshot: true });
    expect(deriveViewSurfaceState(baseInputs({ runStatus: 'cancelling', hasSnapshot: false, totalFileCount: 0 })))
      .toEqual({ kind: 'cancelling', hasSnapshot: false });
  });

  it('cancelling outranks empty-scope, a zero-match filter and a partial read, but not root-unavailable', () => {
    expect(deriveViewSurfaceState(baseInputs({
      runStatus: 'cancelling', totalFileCount: 0, matchingIds: new Set(), query: 'zz', partialRead: { measured: 1, included: 2 },
    })).kind).toBe('cancelling');
    expect(deriveViewSurfaceState(baseInputs({ runStatus: 'cancelling', rootUnavailable: true })).kind).toBe('root-unavailable');
  });
```

Replace:

```ts
    expect(isEmptyStateSurface({ kind: 'cancelled' })).toBe(false);
```

with:

```ts
    expect(isEmptyStateSurface({ kind: 'cancelled' })).toBe(false);
    expect(isEmptyStateSurface({ kind: 'cancelling', hasSnapshot: false })).toBe(false);
```

In `tests/component/status-surfaces.test.ts`, replace:

```ts
    ['cancelled', { kind: 'cancelled' }, 'Scan cancelled. The incomplete result was discarded.'],
```

with:

```ts
    ['cancelled', { kind: 'cancelled' }, 'Scan cancelled. The incomplete result was discarded.'],
    ['cancelling over a snapshot (Part 6 Y1)', { kind: 'cancelling', hasSnapshot: true }, 'Cancelling the scan… The current snapshot stays available.'],
    ['cancelling a first scan (Part 6 Y1)', { kind: 'cancelling', hasSnapshot: false }, 'Cancelling the scan…'],
```

and replace:

```ts
      { kind: 'no-source' }, { kind: 'cancelled' }, { kind: 'context-lost' },
```

with:

```ts
      { kind: 'no-source' }, { kind: 'cancelled' }, { kind: 'cancelling', hasSnapshot: false }, { kind: 'context-lost' },
```

In `tests/component/announcement-region.test.ts`:
- Replace `import { mount } from '@vue/test-utils';` with `import { flushPromises, mount } from '@vue/test-utils';`.
- Replace `import { CANCELLED_BANNER } from '../../src/application/run-state';` with `import { CANCELLED_BANNER, initialScanLifecycleState } from '../../src/application/run-state';`.
- After that line, add `import { CANCELLING_BANNER } from '../../src/ui/inspector-copy';`.
- Replace:

```ts
  it('exposes no aria-valuenow when the total is unknown', async () => {
```

with:

```ts
  // Part 6 Y2: the move into cancelling is a real, user-requested outcome (E17): announced
  // once per run, in the banner's own words; a new run's cancel is heard again even while the
  // region still holds the same text (reannounce, Part 5 V22).
  it('announces the move into cancelling once per run, in the banner\'s words (Part 6 Y2)', async () => {
    const snapshot = buildSnapshotFixture({ files: 1 });
    useCityStore().setCity(snapshot, computeLayout(snapshot));
    const runStore = useRunStore();
    const wrapper = mountRegion({ value: 0 });
    const exposed = wrapper.vm as unknown as { announcePolite: (m: string) => void };
    const polite = wrapper.get('[aria-live="polite"]');
    const cancelling = (runId: string): void => {
      runStore.setLifecycle({ ...initialScanLifecycleState(), run: { status: 'cancelling', runId, generation: 1 } });
    };
    cancelling('r1');
    await flushPromises();
    expect(polite.text()).toBe(CANCELLING_BANNER(true));

    exposed.announcePolite('Something else.');
    cancelling('r1');
    await flushPromises();
    expect(polite.text(), 'the same run again is not a new outcome').toBe('Something else.');

    exposed.announcePolite(CANCELLING_BANNER(true));
    await nextTick();
    const seen: string[] = [];
    const observer = new MutationObserver(() => { seen.push((polite.element.textContent ?? '').trim()); });
    observer.observe(polite.element, { childList: true, characterData: true, subtree: true });
    cancelling('r2');
    await flushPromises();
    observer.disconnect();
    expect(seen).toContain('');
    expect(polite.text()).toBe(CANCELLING_BANNER(true));
  });

  it('with no snapshot, announces the first-scan wording (Part 6 Y2)', async () => {
    const wrapper = mountRegion({ value: 0 });
    useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'cancelling', runId: 'r1', generation: 1 } });
    await flushPromises();
    expect(wrapper.get('[aria-live="polite"]').text()).toBe(CANCELLING_BANNER(false));
  });

  it('exposes no aria-valuenow when the total is unknown', async () => {
```

In `tests/component/toolbar-scan.test.ts`, replace the whole test:

```ts
  it('disables Scan while a run is already in progress, per the interface\'s own runStore dependency', async () => {
    const wrapper = mount(App);
    const runStore = useRunStore();
    expect(wrapper.get('.ci-toolbar__scan').attributes('disabled')).toBeUndefined();

    const approval = {
      profileId: 'p1', sourceFingerprint: 'f1', scopeFingerprint: 's1',
      approvedAt: '2026-01-01T00:00:00.000Z', operation: 'read-only-inventory' as const,
    };
    runStore.setLifecycle({
      run: { status: 'running', runId: 'r1', generation: 1, approval, processedFiles: 0 },
      approval, generation: 1, publishedSnapshotId: null, banner: null,
      selectedEntityId: null, query: '',
    });
    await nextTick();
    expect(wrapper.get('.ci-toolbar__scan').attributes('disabled')).toBeDefined();
  });
```

with:

```ts
  // Part 6 Y3 (T29): Scan moves from native `disabled` to aria-disabled plus a guarded handler
  // (E40/E44/E50), blocked while a run is running OR cancelling. It stays focusable, keeps its
  // name (COPY_07), and a refused press reaches nothing; once the run ends it works again.
  // (APPROVAL is the module-level constant below, read only inside the test body.)
  it.each(['running', 'cancelling'] as const)('keeps Scan focusable but aria-disabled while a run is %s; a press does nothing', async (status) => {
    const onScanRequested = vi.fn();
    const wrapper = mount(App, { global: { provide: { onScanRequested } } });
    const scan = () => wrapper.get('.ci-toolbar__scan');
    expect(scan().attributes('aria-disabled')).toBeUndefined();
    const run = status === 'running'
      ? { status, runId: 'r1', generation: 1, approval: APPROVAL, processedFiles: 0 }
      : { status, runId: 'r1', generation: 1 };
    useRunStore().setLifecycle({ ...initialScanLifecycleState(), run });
    await nextTick();
    expect(scan().attributes('aria-disabled')).toBe('true');
    expect(scan().attributes('disabled')).toBeUndefined();
    expect(scan().text()).toBe(COPY_07);
    await scan().trigger('click');
    expect(onScanRequested).not.toHaveBeenCalled();

    useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'cancelled', runId: 'r1' } });
    await nextTick();
    expect(scan().attributes('aria-disabled')).toBeUndefined();
    await scan().trigger('click');
    expect(onScanRequested).toHaveBeenCalledTimes(1);
  });
```

Create `tests/component/city-cancelling.test.ts`:

```ts
// Part 6 Y1: the city's cancelling state, through the real StatusBanner/EmptyState split in
// CityWorkspace. A first scan being cancelled must never bring back the COPY-01 welcome or
// its "Select a codebase" action (rendered only for 'no-source').
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import App from '../../src/ui/App.vue';
import { computeLayout } from '../../src/domain/layout/layout';
import { initialScanLifecycleState } from '../../src/application/run-state';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useRunStore } from '../../src/ui/stores/run-store';
import { COPY_01 } from '../../src/ui/copy';
import { CANCELLING_BANNER } from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const cancel = (): void => {
  useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'cancelling', runId: 'r1', generation: 1 } });
};

describe('city cancelling state (Part 6 Y1)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useCityStore().navigate('city');
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('a first scan being cancelled shows only the banner: the welcome and its action never come back mid-cancel', async () => {
    const w = mount(App);
    expect(w.find('.ci-welcome__action').exists()).toBe(true);
    cancel();
    await nextTick();
    expect(w.get('.ci-status-banner').text()).toBe(CANCELLING_BANNER(false));
    expect(w.find('.ci-welcome__action').exists()).toBe(false);
    expect(w.find('.ci-empty-state').exists()).toBe(false);
    expect(w.text()).not.toContain(COPY_01);
    w.unmount();
  });

  it('over a snapshot, the banner (role="status") says the current snapshot stays available', async () => {
    const snap = buildSnapshotFixture({ files: 4, directories: 1 });
    useCityStore().setCity(snap, computeLayout(snap));
    const w = mount(App);
    cancel();
    await nextTick();
    const banner = w.get('.ci-status-banner');
    expect(banner.text()).toBe(CANCELLING_BANNER(true));
    expect(banner.attributes('role')).toBe('status');
    w.unmount();
  });
});
```

In `tests/harness/harness.test.ts`:
- Replace `import { runningLifecycle, seedDemoItems } from './seed';` with `import { cancellingLifecycle, runningLifecycle, seedDemoItems } from './seed';`.
- Replace:

```ts
  it('seeds a running scan for ?run=running', () => {
    expect(runningLifecycle().run).toMatchObject({ status: 'running', processedFiles: 57 });
  });
```

with:

```ts
  it('seeds a running scan for ?run=running', () => {
    expect(runningLifecycle().run).toMatchObject({ status: 'running', processedFiles: 57 });
  });
  it('seeds a cancelling scan for ?run=cancelling (Part 6 Y4)', () => {
    expect(cancellingLifecycle().run).toEqual({ status: 'cancelling', runId: 'harness-run', generation: 1 });
  });
```

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/view-surface.test.ts tests/component/status-surfaces.test.ts tests/component/announcement-region.test.ts tests/component/toolbar-scan.test.ts tests/component/city-cancelling.test.ts tests/harness/harness.test.ts`. Expected: FAIL.
  - `view-surface`: the Y1 copy test fails with `expected { kind: 'cancelling', hasSnapshot: true } to be 'Cancelling the scan… The current snapshot stays available.'` (today's `default` branch returns the state object itself); the derive test with `expected { kind: 'none' } to deeply equal { kind: 'cancelling', hasSnapshot: true }`; the priority test with `expected 'empty-scope' to be 'cancelling'`. The `isEmptyStateSurface` line passes already (it is a type-level addition).
  - `status-surfaces`: both new rows fail (the banner renders the state object, not copy).
  - `announcement-region`: both new tests fail with `TypeError: … CANCELLING_BANNER is not a function`.
  - `toolbar-scan`: both `it.each` cases fail with `expected undefined to be 'true'` (today Scan carries native `disabled` while running, and nothing while cancelling).
  - `city-cancelling`: fails at import (`CANCELLING_BANNER` undefined) or with `Unable to get .ci-status-banner` (cancelling with no snapshot derives `no-source` today, so the welcome stays and no banner renders).
  - `harness`: `TypeError: cancellingLifecycle is not a function`.

- [ ] **Step 3: Add the copy.** Create `src/ui/audit-copy/city.ts`:

```ts
// Part 6 Y1–Y2: the city's cancelling state. Re-exported by inspector-copy.ts.

/** Y1: StatusBanner's copy while a scan is cancelling; over a snapshot it also says that
 *  snapshot stays available. Y2 (ruling R9): AnnouncementRegion announces these same words. */
export const CANCELLING_BANNER = (hasSnapshot: boolean): string =>
  (hasSnapshot ? 'Cancelling the scan… The current snapshot stays available.' : 'Cancelling the scan…');
```

In `src/ui/inspector-copy.ts`, replace the last line:

```ts
export * from './audit-copy/settings';
```

with:

```ts
export * from './audit-copy/settings';

/** Part 6: the city's cancelling state. */
export * from './audit-copy/city';
```

- [ ] **Step 4: Add the state.** Edit `src/ui/view-surface.ts`.

  (a) Replace:

```ts
import {
  COPY_01, COPY_12, COPY_14, COPY_28, COPY_READ_NOT_APPROVED, CONTEXT_LOST_NOTICE,
  formatCopy08, formatCopy11, formatCopy13, formatFailedRefreshNotice,
} from './copy';
```

with:

```ts
import {
  COPY_01, COPY_12, COPY_14, COPY_28, COPY_READ_NOT_APPROVED, CONTEXT_LOST_NOTICE,
  formatCopy08, formatCopy11, formatCopy13, formatFailedRefreshNotice,
} from './copy';
import { CANCELLING_BANNER } from './inspector-copy';
```

  (b) Replace:

```ts
  | { kind: 'scanning-unknown-total'; processedFiles: number }
  | { kind: 'cancelled' }
```

with:

```ts
  | { kind: 'scanning-unknown-total'; processedFiles: number }
  | { kind: 'cancelling'; hasSnapshot: boolean }
  | { kind: 'cancelled' }
```

  (c) Replace:

```ts
  if (input.runStatus === 'running') {
    return { kind: 'scanning-unknown-total', processedFiles: input.runProcessedFiles };
  }
  if (input.runStatus === 'cancelled') return { kind: 'cancelled' };
```

with:

```ts
  if (input.runStatus === 'running') {
    return { kind: 'scanning-unknown-total', processedFiles: input.runProcessedFiles };
  }
  // Part 6 Y1: running's slot. A banner state (not in EMPTY_STATE_KINDS), so a first scan
  // being cancelled never falls through to 'no-source' and its "Select a codebase" action.
  if (input.runStatus === 'cancelling') return { kind: 'cancelling', hasSnapshot: input.hasSnapshot };
  if (input.runStatus === 'cancelled') return { kind: 'cancelled' };
```

  (d) Replace:

```ts
    case 'scanning-unknown-total': return formatCopy08(state.processedFiles);
```

with:

```ts
    case 'scanning-unknown-total': return formatCopy08(state.processedFiles);
    case 'cancelling': return CANCELLING_BANNER(state.hasSnapshot);
```

- [ ] **Step 5: Announce it.** Edit `src/ui/components/AnnouncementRegion.vue`.

  (a) Replace:

```ts
import { ANNOUNCE_SCAN_COMPLETE, formatAnnounceSelected, formatCopy08 } from '../copy';
```

with:

```ts
import { ANNOUNCE_SCAN_COMPLETE, formatAnnounceSelected, formatCopy08 } from '../copy';
import { CANCELLING_BANNER } from '../inspector-copy';
import { reannounce } from '../kit/reannounce';
```

  (b) Replace:

```ts
  announcePolite(formatCopy08(processedFiles));
}
```

with:

```ts
  announcePolite(formatCopy08(processedFiles));
}

/** Part 6 Y2: the move into cancelling is a real, user-requested outcome (E17), announced once
 *  per run in StatusBanner's own words. `reannounce`, so a new run's cancel is heard again even
 *  while the region still holds the same text (E17's re-announce rule). */
let cancellingAnnouncedFor: string | null = null;
function announceCancelling(runId: string): void {
  if (runId === cancellingAnnouncedFor) return;
  cancellingAnnouncedFor = runId;
  void reannounce(politeMessage, CANCELLING_BANNER(cityStore.snapshot !== null));
}
```

  (c) Replace:

```ts
  else if (run.status === 'complete') announcePolite(ANNOUNCE_SCAN_COMPLETE);
```

with:

```ts
  else if (run.status === 'complete') announcePolite(ANNOUNCE_SCAN_COMPLETE);
  else if (run.status === 'cancelling') announceCancelling(run.runId);
```

- [ ] **Step 6: Scan becomes `aria-disabled`.** Edit `src/ui/components/AppToolbar.vue`.

  (a) Replace:

```ts
function cancelScan(): void {
  if (!cancellable.value) return;
  onCancelScan();
}
```

with:

```ts
function cancelScan(): void {
  if (!cancellable.value) return;
  onCancelScan();
}
/** Part 6 Y3 (T29): Scan is blocked while a run is running or cancelling: aria-disabled plus
 *  this guarded handler, never native `disabled`, so a focused Scan keeps focus (E40/E44/E50).
 *  A refused press announces nothing (E17); the host's withScanGuard still refuses on its own. */
const scannable = computed(() => runStore.run.status !== 'running' && runStore.run.status !== 'cancelling');
function requestScan(): void {
  if (!scannable.value) return;
  onScanRequested();
}
```

  (b) Replace:

```html
    <!-- Unconditional, like every other toolbar control here -- Scan doubles as
         first-scan and refresh (spec 5), so it belongs regardless of whether a
         snapshot exists yet. Disabled while a run is already in flight (runStore
         mirrors the real coordinator, spec 4.1) so the toolbar itself does not
         invite a second concurrent click; the host guard (withScanGuard) still
         holds even if it did. -->
    <button
      type="button"
      class="ci-toolbar__scan"
      :disabled="runStore.run.status === 'running'"
      @click="onScanRequested"
    >
```

with:

```html
    <!-- Unconditional, like every other toolbar control here -- Scan doubles as
         first-scan and refresh (spec 5), so it belongs regardless of whether a
         snapshot exists yet. Part 6 Y3: aria-disabled while a run is running or
         cancelling (runStore mirrors the real coordinator, spec 4.1), with the
         guarded handler above; the host guard (withScanGuard) still holds. -->
    <button
      type="button"
      class="ci-toolbar__scan"
      :aria-disabled="scannable ? undefined : 'true'"
      @click="requestScan"
    >
```

  No CSS change: kit.css's shared `button[aria-disabled="true"]` rule gives the blocked look (Global Constraints: no per-class aria-disabled rule). `tests/unit/host-cascade.test.ts` keeps passing: the base and hover skin rules for `.ci-toolbar__scan` are untouched.

- [ ] **Step 7: Harness `?run=cancelling` (Y4).**

  In `tests/harness/seed.ts`, replace:

```ts
    run: { status: 'running', runId: 'harness-run', generation: 1, approval, processedFiles: 57 },
  };
}
```

with:

```ts
    run: { status: 'running', runId: 'harness-run', generation: 1, approval, processedFiles: 57 },
  };
}

/** Part 6 Y4: the same run after Cancel was pressed, before the walk confirms it stopped. */
export function cancellingLifecycle(): ScanLifecycleState {
  return { ...runningLifecycle(), run: { status: 'cancelling', runId: 'harness-run', generation: 1 } };
}
```

  In `tests/harness/mount.ts`:
  - Replace `import { demoImportJson, runningLifecycle, seedDemoItems } from './seed';` with `import { cancellingLifecycle, demoImportJson, runningLifecycle, seedDemoItems } from './seed';`.
  - Replace `  run?: 'running';` with `  run?: 'running' | 'cancelling';`.
  - Replace:

```ts
  if (options.run === 'running') {
    // Part 5 V6: the toolbar's and Data & scans' Cancel are enabled only while running.
    useRunStore().setLifecycle(runningLifecycle());
  }
```

  with:

```ts
  if (options.run) {
    // Part 5 V6: the toolbar's and Data & scans' Cancel are enabled only while running.
    // Part 6 Y4: `cancelling` shows the city's cancelling banner over the snapshot.
    useRunStore().setLifecycle(options.run === 'running' ? runningLifecycle() : cancellingLifecycle());
  }
```

  In `tests/harness/page.ts`:
  - Replace `//   ?run=running       seed the run store with a running scan (city, sources)` with `//   ?run=running|cancelling  seed the run store with a scan in flight, or being cancelled (city, sources)`.
  - Replace `const select = params.get('select');` with:

```ts
const select = params.get('select');
const run = params.get('run');
```

  - Replace `  ...(params.get('run') === 'running' ? { run: 'running' as const } : {}),` with `  ...(run === 'running' || run === 'cancelling' ? { run } : {}),`.

  The `city-cancelling` capture (`?screen=s05&theme=dark&route=city&run=cancelling`) is added to `scripts/harness-shot.mjs` SHOTS in Task 12, with the other new shots.

- [ ] **Step 8: Run and confirm it passes.** `npx vitest run tests/unit/view-surface.test.ts tests/component/status-surfaces.test.ts tests/component/announcement-region.test.ts tests/component/toolbar-scan.test.ts tests/component/city-cancelling.test.ts tests/harness/harness.test.ts tests/component/view-surface-memo.test.ts tests/component/welcome-state.test.ts tests/component/sources-screen.test.ts tests/host/city-view.test.ts tests/unit/host-cascade.test.ts tests/unit/city-budget.test.ts tests/unit/obsidian-mock-scope.test.ts tests/unit/css-class-scope.test.ts`. Expected: PASS. `wc -l src/ui/screens/CityWorkspace.vue` still prints 189.

- [ ] **Step 9: Gate.** `npm run typecheck && npm run lint:fast && npx vitest run <the Step 8 files>`, then `npx eslint src/ui/audit-copy/city.ts src/ui/inspector-copy.ts src/ui/view-surface.ts src/ui/components/AppToolbar.vue src/ui/components/AnnouncementRegion.vue tests/harness/page.ts tests/harness/seed.ts tests/harness/mount.ts tests/harness/harness.test.ts tests/unit/view-surface.test.ts tests/component/status-surfaces.test.ts tests/component/announcement-region.test.ts tests/component/toolbar-scan.test.ts tests/component/city-cancelling.test.ts --max-warnings 0`.

- [ ] **Step 10: Commit.**

```
git add src/ui/audit-copy/city.ts src/ui/inspector-copy.ts src/ui/view-surface.ts src/ui/components/AppToolbar.vue src/ui/components/AnnouncementRegion.vue tests/harness/page.ts tests/harness/seed.ts tests/harness/mount.ts tests/harness/harness.test.ts tests/unit/view-surface.test.ts tests/component/status-surfaces.test.ts tests/component/announcement-region.test.ts tests/component/toolbar-scan.test.ts tests/component/city-cancelling.test.ts
git commit -m "feat(ui): cancelling state on the city; toolbar Scan is aria-disabled while running or cancelling (Y1–Y4)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Review port extension and store split (Y10, Y12–Y16)

The `ReviewRepository` port gains `allocateId`, `subscribe`, `diagnostics` and (ruling R1) an atomic `replaceAll`; the in-memory adapter implements all thirteen members. `review-store.ts` (400/400) is split: the per-codebase bookkeeping moves to `review-buckets.ts`. Ids now come from the port, a store reloads when another leaf writes to its codebase, adds wait for the first load, a failed load is flagged (`loadFailed`), `replaceAll`/`clearAll` make ONE port call instead of per-record loops, the unbound bucket refuses bulk writes, and pending keys are kept per codebase.

**Files:**
- Modify: `src/ui/stores/ports/review-repository.ts` (136 → 207)
- Create: `src/ui/stores/review-buckets.ts` (124)
- Modify: `src/ui/stores/review-store.ts` (400 → 323; whole-file replacement)
- Create: `tests/unit/review-repository-port.test.ts` (112)
- Create: `tests/unit/review-store-sync.test.ts` (221)
- Create: `tests/unit/review-store-budget.test.ts` (31)
- Modify (migrations, see Step 1b): `tests/unit/review-replace-all.test.ts` (276 → 290), `tests/unit/review-clear-all.test.ts` (76 → 74), `tests/unit/review-work-items.test.ts` (129 → 129), `tests/unit/review-store.test.ts` (215 → 205), `tests/unit/review-per-codebase.test.ts` (148 → 148), `tests/component/file-inspector.test.ts` (252 → 233), `tests/component/workbench-screen.test.ts` (261 → 252), `tests/component/settings-screen.test.ts` (159 → 162), `tests/component/settings-import.test.ts` (361 → 364)

**Consumers checked (API unchanged, no edit):** every `src` reader of the store uses getters only — `FileInspector.vue` and `FileDetailScreen.vue` (`isPendingFor`), `PackageDetailDialog.vue`, `StewardshipActions.vue`, `CoverageGapsTable.vue` (`isPending`), `WorkItemEditor.vue` (`isItemPending`, `isPending`), `FindingReviewDialog.vue` (`isDispositionPending`, `isPendingFor`), `ClearReviewDialog.vue` (`clearAll`), `ImportReviewDialog.vue` (`replaceAll`), `App.vue` (`bindRepository`). No `src` file reads `nextId`, `nextRuleId`, `buckets` or the four pending arrays, and none imports the store's old `ReviewReplacement` type (removed; the parameter type is now the port's `ReviewReplaceState`, structurally identical). In tests, only `tests/unit/review-clear-all.test.ts:73` reads a removed field (`store.pendingItemIds`).

**Interfaces:**
- Consumes: nothing new.
- Produces, in `src/ui/stores/ports/review-repository.ts`:
  - `type ReviewIdKind = 'workItem' | 'rule'`;
  - `interface ReviewStorageDiagnostics { skipped: number; unsupported: boolean }`;
  - `interface ReviewReplaceState { workItems: readonly WorkItem[]; rules: readonly BoundaryRule[]; dispositions: readonly FindingDisposition[] }` (R1);
  - `ReviewRepository` (13 members) gains `replaceAll(state: ReviewReplaceState): Promise<void>` (R1: atomic, all or nothing, one notification, high-water marks raised past the given ids and never lowered), `allocateId(kind: ReviewIdKind): string`, `subscribe(listener: () => void): () => void`, `diagnostics(): ReviewStorageDiagnostics`. **Notification contract (Task 3 must honour it):** a listener runs once per successful write call (save, remove — even of a missing id — or `replaceAll`), synchronously before that write's promise resolves, and never for a rejected write, nor for a list.
  - `formatReviewId(kind: ReviewIdKind, n: number): string` (`wi-N`; `AR-` padded to 3 digits);
  - `reviewIdSuffix(id: string): number | null` (`/^(?:wi|AR)-(\d{1,15})$/`; either prefix, at most 15 digits);
  - `createInMemoryReviewRepository()`: all thirteen members; per-kind high-water mark raised by every save, every `replaceAll` and every list, never lowered; `replaceAll` swaps the three maps synchronously and notifies once; `diagnostics()` is always `{ skipped: 0, unsupported: false }`; `allocateId` never throws (R9 — only Task 3's durable adapter throws before it is seeded).
- Produces, in `src/ui/stores/review-store.ts`:
  - state: `workItems`, `repository`, `rules`, `dispositions` (unchanged); `pending: Map<string, ReviewPending>` (Y15, replaces `pendingRuleKeys`/`pendingWorkKeys`/`pendingItemIds`/`pendingFingerprints`); `bucketState: BucketState` (raw; replaces `buckets`); `boundKey`; `ready: boolean`; `loadFailed: boolean` (R1); `storageDiagnostics: ReviewStorageDiagnostics`; `bulkBusy` (unchanged, global). `nextId`/`nextRuleId` are removed.
  - getters: unchanged names and signatures; the pending ones read the bound codebase's entry.
  - actions: every existing signature unchanged (`setRepository`, `bindRepository`, `load`, `addWorkItem`, `addWorkItemForFile`, `updateWorkItem`, `removeWorkItem`, `clearAll`, `replaceAll(state: ReviewReplaceState): Promise<boolean>`, `addRule`, `removeRule`, `decide`, `acknowledge`, `dismiss`, `reopen`); new `setRepositoryFactory(factory: (repositoryId: string) => ReviewRepository): void` and `detach(): void`. Ruling R2: `detach()` stays; Task 4's `unwireDataPorts(pinia)` calls `useReviewStore(pinia).detach()`, and `CityView.onClose` calls `unwireDataPorts(this.pinia)` before dropping the pinia.
- Produces, in `src/ui/stores/review-buckets.ts` (used only by `review-store.ts`): `EMPTY_REPLACEMENT: ReviewReplaceState`, `ruleKey`, `ReviewBucket { repository; ready; ownWrites }`, `ReviewRepositoryFactory`, `BucketState { buckets; factory; unsubscribe }`, `createBucketState()`, `bucketFor(bs, id)`, `listenTo(bs, bucket, store)`, `stopListening(bs)`, `ownWrite(bucket, write, store)`, `ReviewPending`, `pendingOf`, `anyPending`, `reserve`, `release`.

**Behaviour (binding for the implementation below):**
- **Y10 ids.** `addWorkItem`/`addRule` call `repo.allocateId(...)` synchronously, after every guard has passed, before the first `await`. A refused call never allocates; a failed save leaves a gap.
- **Y10 readiness.** A bucket made by the store from a fresh in-memory repository (no factory, or the `''` bucket) starts `ready: true`; a bucket made by the factory starts `ready: false` and becomes ready when a `load()` of it finishes. `bindRepository` copies the bucket's flag into `ready`; `setRepository` keeps the bucket's flag (test seam). `addWorkItem` and `addRule` return `null` (announcing nothing) while `!ready`.
- **Y12 subscription.** One live subscription per store, to the bound bucket's repository: `bindRepository` and `setRepository` call `listenTo`, which unsubscribes the previous one and resets the bucket's `ownWrites` to 0. Every port write the store makes goes through `ownWrite` (`ownWrites += 1` before the call; on rejection, give the slot back, or — when a foreign notification already used it up — reload). The listener skips a notification while `ownWrites > 0` (decrementing), and otherwise reloads, only if that bucket is still bound; a failed background reload is swallowed (Drafter note 9). `detach()` drops the subscription.
- **R1 bulk writes.** `replaceAll(state)` and `clearAll()` (empty arrays) each make ONE `repository.replaceAll(...)` call through `ownWrite`, persist-first; then `load()` in a nested `finally`; then `bulkBusy` clears. No per-record `allSettled` loops remain. A port rejection is rethrown while the same codebase is still bound (the reload has shown what the port still holds); if the codebase changed mid-run (Part 5 E20) the call resolves `false` and never rethrows. Refusals unchanged: `bulkBusy`, pending changes in the bound codebase (Y15), and the unbound bucket (Y14).
- **R1 `loadFailed`.** `load()` sets `loadFailed = true` when a list rejects (only while the same repository is still bound) and rethrows; a successful load sets it `false`; every `bindRepository` resets it to `false` before loading. Adds still refuse (null) while `!ready`. (Task 4 adds `.catch(noop)` to App's `void review.bindRepository(id)` and shows `REVIEW_STORE_READ_FAILED` while `loadFailed`.)
- **Y14.** `replaceAll` (and so `clearAll`) returns `false`, touching nothing, while `boundKey === ''`. The factory is never asked for `''`.
- **Y15.** Each action captures `codebase = this.boundKey` at its start; `reserve`/`release` use that key, so a `finally` that settles after a switch releases from the right entry. `hasPendingChanges` = `bulkBusy || anyPending(bound entry)`.
- **Y16.** `replaceAll` clears `bulkBusy` in the nested `finally` even when its own `load()` rejects, and that rejection is what the caller sees. The behaviour is already present; its test is a **regression pin (TDD-RED exception recorded, ruling R9)**.

- [ ] **Step 1: Write the failing tests.**

  **(a) New tests.** Create `tests/unit/review-repository-port.test.ts`:

```ts
// Part 6 Y10/Y12/Y7: the ReviewRepository port's id allocation, notifications and
// diagnostics, as the in-memory adapter implements them. Task 3's contract suite
// (tests/contracts/review-repository.contract.ts) runs the same rules against both adapters;
// these are the Part 5 bucket-counter assertions, moved to the port that now owns the ids.
import { describe, expect, it, vi } from 'vitest';
import {
  NO_CHECKS, createInMemoryReviewRepository, formatReviewId, reviewIdSuffix, type WorkItem,
} from '../../src/ui/stores/ports/review-repository';

const AT = '2026-09-23T10:00:00.000Z';
const item = (id: string): WorkItem => ({
  id, target: { kind: 'package', name: id }, intent: 'review', title: id, status: 'planned',
  priority: 'medium', notes: '', checks: NO_CHECKS, createdAt: AT,
});

describe('review id format (Part 6 Y10)', () => {
  it('formats wi-N and AR-NNN (three digits minimum), as the store did before Part 6', () => {
    expect(formatReviewId('workItem', 1)).toBe('wi-1');
    expect(formatReviewId('workItem', 1234)).toBe('wi-1234');
    expect(formatReviewId('rule', 7)).toBe('AR-007');
    expect(formatReviewId('rule', 1234)).toBe('AR-1234');
  });

  it('reads the number back from either kind, and null from anything else', () => {
    expect(reviewIdSuffix('wi-12')).toBe(12);
    expect(reviewIdSuffix('AR-007')).toBe(7);
    expect(reviewIdSuffix('wi-')).toBeNull();
    expect(reviewIdSuffix('w1')).toBeNull();
    expect(reviewIdSuffix('wi-1x')).toBeNull();
    // More than 15 digits could not be counted past exactly, so it never feeds the mark.
    expect(reviewIdSuffix(`wi-${'9'.repeat(16)}`)).toBeNull();
  });
});

describe('in-memory review repository (Part 6 Y10, Y12, Y7)', () => {
  it('allocates each kind in sequence, synchronously, never the same id twice', () => {
    const repo = createInMemoryReviewRepository();
    expect([repo.allocateId('workItem'), repo.allocateId('workItem'), repo.allocateId('rule')]).toEqual(['wi-1', 'wi-2', 'AR-001']);
  });

  it('a save raises the mark past the saved id; a removal never lowers it', async () => {
    const repo = createInMemoryReviewRepository();
    await repo.saveWorkItem(item('wi-7'));
    await repo.saveRule({ id: 'AR-012', from: 'a', to: 'b', rationale: 'r', createdAt: AT });
    expect(repo.allocateId('workItem')).toBe('wi-8');
    expect(repo.allocateId('rule')).toBe('AR-013');
    await repo.removeWorkItem('wi-7');
    await repo.removeRule('AR-012');
    expect(repo.allocateId('workItem')).toBe('wi-9');
    expect(repo.allocateId('rule')).toBe('AR-014');
  });

  it('notifies every subscriber once per write, before the write\'s promise resolves', async () => {
    const repo = createInMemoryReviewRepository();
    const seen: string[] = [];
    const first = vi.fn(() => { seen.push('notified'); });
    const second = vi.fn();
    repo.subscribe(first);
    const unsubscribe = repo.subscribe(second);
    const writes = [
      () => repo.saveWorkItem(item('wi-1')), () => repo.removeWorkItem('wi-1'),
      () => repo.saveRule({ id: 'AR-001', from: 'a', to: 'b', rationale: 'r', createdAt: AT }), () => repo.removeRule('AR-001'),
      () => repo.saveDisposition({ fingerprint: 'fp', status: 'acknowledged', decidedAt: AT }), () => repo.removeDisposition('fp'),
    ];
    for (const write of writes) {
      const settled = write().then(() => { seen.push('resolved'); });
      await settled;
    }
    expect(first).toHaveBeenCalledTimes(6);
    expect(second).toHaveBeenCalledTimes(6);
    expect(seen).toEqual(Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? 'notified' : 'resolved')));
    unsubscribe();
    await repo.saveWorkItem(item('wi-2'));
    expect(first).toHaveBeenCalledTimes(7);
    expect(second).toHaveBeenCalledTimes(6);
  });

  it('replaceAll swaps the whole state at once, notifies once, and never lowers the marks (R1)', async () => {
    const repo = createInMemoryReviewRepository();
    await repo.saveWorkItem(item('wi-20'));
    await repo.saveDisposition({ fingerprint: 'old', status: 'acknowledged', decidedAt: AT });
    const listener = vi.fn();
    repo.subscribe(listener);
    await repo.replaceAll({
      workItems: [item('wi-3')],
      rules: [{ id: 'AR-009', from: 'a', to: 'b', rationale: 'r', createdAt: AT }],
      dispositions: [],
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect((await repo.listWorkItems()).map((w) => w.id)).toEqual(['wi-3']);
    expect((await repo.listRules()).map((r) => r.id)).toEqual(['AR-009']);
    expect(await repo.listDispositions()).toEqual([]);
    expect(repo.allocateId('workItem')).toBe('wi-21');
    expect(repo.allocateId('rule')).toBe('AR-010');
    await repo.replaceAll({ workItems: [], rules: [], dispositions: [] });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(await repo.listWorkItems()).toEqual([]);
    expect(repo.allocateId('workItem')).toBe('wi-22');
  });

  it('never notifies for a list', async () => {
    const repo = createInMemoryReviewRepository();
    const listener = vi.fn();
    repo.subscribe(listener);
    await Promise.all([repo.listWorkItems(), repo.listRules(), repo.listDispositions()]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('reports no storage problems', () => {
    expect(createInMemoryReviewRepository().diagnostics()).toEqual({ skipped: 0, unsupported: false });
  });
});
```

Create `tests/unit/review-store-sync.test.ts`:

```ts
// Part 6 Y10, Y12, Y14, Y15: the review store over a shared repository — ids from the port,
// leaves kept in step by notifications, the unbound bucket refusing bulk writes, and the
// pending keys kept per codebase. Two Pinia instances stand in for two leaves.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { makeEntityId } from '../../src/domain/entity-id';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository, type ReviewRepository } from '../../src/ui/stores/ports/review-repository';

const NOW = new Date('2026-09-23T10:00:00.000Z');
const fileIn = (repo: string, path: string) => ({ kind: 'file' as const, entityId: makeEntityId(repo, 'file', path) });
const noop = (): void => {};

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (e: Error) => void } {
  let resolve: () => void = noop;
  let reject: (e: Error) => void = noop;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** A leaf: its own Pinia, its review store wired to `factory` the way the host wires it (Y11). */
function leaf(factory: (id: string) => ReviewRepository, pinia: Pinia = createPinia()) {
  const store = useReviewStore(pinia);
  store.setRepositoryFactory(factory);
  return store;
}

describe('review store over a shared repository (Part 6 Y10, Y12)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('takes ids from the port, so two leaves on one codebase never hand out the same one', async () => {
    const shared = createInMemoryReviewRepository();
    const a = leaf(() => shared);
    const b = leaf(() => shared);
    await a.bindRepository('repo-a');
    await b.bindRepository('repo-a');
    const one = await a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW);
    const two = await b.addWorkItem(fileIn('repo-a', 'src/b.ts'), 'refactor', 'B', NOW);
    expect([one?.id, two?.id]).toEqual(['wi-1', 'wi-2']);
    expect((await a.addRule('x', 'y', 'r', NOW))?.id).toBe('AR-001');
    expect((await b.addRule('y', 'z', 'r', NOW))?.id).toBe('AR-002');
  });

  it('another leaf\'s write reloads this one, so a stale leaf cannot act on a removed item', async () => {
    const shared = createInMemoryReviewRepository();
    const a = leaf(() => shared);
    const b = leaf(() => shared);
    await a.bindRepository('repo-a');
    await b.bindRepository('repo-a');
    const added = await a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW);
    await flushPromises();
    expect(b.workItems.map((w) => w.id)).toEqual([added!.id]);
    expect(await b.removeWorkItem(added!.id)).toBe(true);
    await flushPromises();
    expect(a.workItems).toEqual([]);
    expect(await a.updateWorkItem(added!.id, { title: 'Resurrected' }, NOW)).toBeNull();
    expect(await shared.listWorkItems()).toEqual([]);
  });

  it('its own writes never reload it', async () => {
    const shared = createInMemoryReviewRepository();
    const listWorkItems = vi.fn(() => shared.listWorkItems());
    const a = leaf(() => ({ ...shared, listWorkItems }));
    await a.bindRepository('repo-a');
    const item = await a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW);
    await a.updateWorkItem(item!.id, { title: 'A2' }, NOW);
    const rule = await a.addRule('x', 'y', 'r', NOW);
    await a.removeRule(rule!.id);
    await a.acknowledge('fp', NOW);
    await a.reopen('fp');
    await a.removeWorkItem(item!.id);
    await flushPromises();
    expect(listWorkItems).toHaveBeenCalledTimes(1);
    await a.clearAll(); // one port replaceAll, one skipped notification, then its own reload
    await flushPromises();
    expect(listWorkItems).toHaveBeenCalledTimes(2);
  });

  it('a rejected own write gives its notification back: the next foreign write still reloads', async () => {
    const shared = createInMemoryReviewRepository();
    const a = leaf(() => ({ ...shared, saveRule: () => Promise.reject(new Error('disk')) }));
    const b = leaf(() => shared);
    await a.bindRepository('repo-a');
    await b.bindRepository('repo-a');
    await expect(a.addRule('x', 'y', 'r', NOW)).rejects.toThrow('disk');
    await b.addWorkItem(fileIn('repo-a', 'src/b.ts'), 'refactor', 'B', NOW);
    await flushPromises();
    expect(a.workItems.map((w) => w.title)).toEqual(['B']);
  });

  it('a foreign write that lands while its own write is in flight is caught up, even when its own write then fails', async () => {
    const shared = createInMemoryReviewRepository();
    const gate = deferred();
    const a = leaf(() => ({ ...shared, saveWorkItem: () => gate.promise }));
    const b = leaf(() => shared);
    await a.bindRepository('repo-a');
    await b.bindRepository('repo-a');
    const adding = a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW);
    await b.addWorkItem(fileIn('repo-a', 'src/b.ts'), 'refactor', 'B', NOW);
    await flushPromises();
    gate.reject(new Error('disk'));
    await expect(adding).rejects.toThrow('disk');
    await flushPromises();
    expect(a.workItems.map((w) => w.title)).toEqual(['B']);
  });

  it('drops its subscription on a switch, listens again on the way back, and stops on detach', async () => {
    const inner = createInMemoryReviewRepository();
    const offs: (() => void)[] = [];
    const counted: ReviewRepository = {
      ...inner,
      subscribe: (listener) => { const off = vi.fn(inner.subscribe(listener)); offs.push(off); return off; },
    };
    const a = leaf((id) => (id === 'repo-a' ? counted : createInMemoryReviewRepository()));
    await a.bindRepository('repo-a');
    expect(offs).toHaveLength(1);
    await a.bindRepository('repo-b');
    expect(offs[0]).toHaveBeenCalledTimes(1);
    await a.bindRepository('repo-a');
    expect(offs).toHaveLength(2);
    a.detach();
    expect(offs[1]).toHaveBeenCalledTimes(1);
  });
});

describe('review store readiness and diagnostics (Part 6 Y10, Y7)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('refuses adds (null), spending no id, until the bound codebase\'s first load has finished', async () => {
    const inner = createInMemoryReviewRepository();
    const gate = deferred();
    const allocateId = vi.fn(inner.allocateId);
    const a = leaf(() => ({ ...inner, allocateId, listWorkItems: async () => { await gate.promise; return inner.listWorkItems(); } }));
    const binding = a.bindRepository('repo-a');
    expect(a.ready).toBe(false);
    expect(await a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW)).toBeNull();
    expect(await a.addRule('x', 'y', 'r', NOW)).toBeNull();
    expect(allocateId).not.toHaveBeenCalled();
    gate.resolve();
    await binding;
    expect(a.ready).toBe(true);
    expect((await a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW))?.id).toBe('wi-1');
  });

  it('marks loadFailed while the bound codebase cannot be read, and clears it on the next good load (R1)', async () => {
    const inner = createInMemoryReviewRepository();
    let failing = true;
    const a = leaf(() => ({
      ...inner,
      listRules: () => (failing ? Promise.reject(new Error('read failed')) : inner.listRules()),
    }));
    await expect(a.bindRepository('repo-a')).rejects.toThrow('read failed');
    expect(a.loadFailed).toBe(true);
    expect(a.ready).toBe(false);
    expect(await a.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A', NOW)).toBeNull();
    failing = false;
    await a.load();
    expect(a.loadFailed).toBe(false);
    expect(a.ready).toBe(true);
  });

  it('mirrors the bound repository\'s diagnostics after each load, and starts each bind clean', async () => {
    const odd: ReviewRepository = { ...createInMemoryReviewRepository(), diagnostics: () => ({ skipped: 2, unsupported: true }) };
    const a = leaf((id) => (id === 'repo-a' ? odd : createInMemoryReviewRepository()));
    await a.bindRepository('repo-a');
    expect(a.storageDiagnostics).toEqual({ skipped: 2, unsupported: true });
    const binding = a.bindRepository('repo-b');
    expect(a.storageDiagnostics).toEqual({ skipped: 0, unsupported: false });
    await binding;
    expect(a.storageDiagnostics).toEqual({ skipped: 0, unsupported: false });
  });

  it('keeps the unbound bucket in memory: the factory is never asked for it', async () => {
    const factory = vi.fn(() => createInMemoryReviewRepository());
    const a = leaf(factory);
    expect(await a.addWorkItem(fileIn('x', 'src/a.ts'), 'refactor', 'A', NOW)).not.toBeNull();
    expect(factory).not.toHaveBeenCalled();
    await a.bindRepository('repo-a');
    expect(factory).toHaveBeenCalledWith('repo-a');
  });
});

describe('review store bulk writes and pending keys (Part 6 Y14, Y15)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('refuses replaceAll and clearAll while unbound, touching nothing (Y14)', async () => {
    const store = useReviewStore();
    await store.addWorkItemForFile('e1', 'Unbound', NOW);
    const item = store.workItems[0]!;
    expect(await store.replaceAll({ workItems: [], rules: [], dispositions: [] })).toBe(false);
    expect(await store.clearAll()).toBe(false);
    expect(await store.repository.listWorkItems()).toEqual([item]);
    expect(store.workItems).toEqual([item]);
    expect(store.bulkBusy).toBe(false);
  });

  it('keeps pending keys per codebase: a save in flight in one never blocks another (Y15)', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    const inner = createInMemoryReviewRepository();
    const gate = deferred();
    store.setRepository({ ...inner, saveWorkItem: async (w) => { await gate.promise; await inner.saveWorkItem(w); } });
    const target = fileIn('repo-a', 'src/a.ts');
    const adding = store.addWorkItem(target, 'refactor', 'A', NOW);
    expect(store.isPendingFor(target.entityId)).toBe(true);
    expect(store.hasPendingChanges).toBe(true);

    await store.bindRepository('repo-b');
    expect(store.isPendingFor(target.entityId)).toBe(false);
    expect(store.hasPendingChanges).toBe(false);
    expect(await store.clearAll()).toBe(true);

    await store.bindRepository('repo-a');
    expect(store.isPendingFor(target.entityId)).toBe(true);
    gate.resolve();
    expect((await adding)?.title).toBe('A');
    expect(store.isPendingFor(target.entityId)).toBe(false);
    expect(store.hasPendingChanges).toBe(false);
  });
});
```

Create `tests/unit/review-store-budget.test.ts`:

```ts
// Part 6 Y13 (Part 5 E25, the 400/400 rule): review-store.ts was split so later work has
// room. Like city-budget.test.ts, the checks read the source text rather than importing it,
// so each one fails on its own before the split.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  const abs = resolve(process.cwd(), path);
  expect(existsSync(abs), `${path} exists`).toBe(true);
  return readFileSync(abs, 'utf8');
}

describe('review store line budget (Part 6 Y13)', () => {
  it('review-store.ts stays at or under 360 lines', () => {
    expect(source('src/ui/stores/review-store.ts').split('\n').length).toBeLessThanOrEqual(360);
  });

  it('the per-codebase bookkeeping lives in review-buckets.ts, at or under 200 lines', () => {
    const buckets = source('src/ui/stores/review-buckets.ts');
    expect(buckets.split('\n').length).toBeLessThanOrEqual(200);
    for (const name of ['createBucketState', 'bucketFor', 'listenTo', 'stopListening', 'ownWrite', 'reserve', 'release']) {
      expect(buckets, name).toMatch(new RegExp(`export (?:async )?function ${name}\\(`));
    }
    expect(source('src/ui/stores/review-store.ts')).toContain("from './review-buckets'");
  });

  it('the store keeps no id counter of its own: ids come from the port (Y10)', () => {
    expect(source('src/ui/stores/review-store.ts')).not.toMatch(/\bnextId\b|\bnextRuleId\b|\bmaxSuffix\b/);
  });
});
```

  In `tests/unit/review-replace-all.test.ts`, add the Y16 **regression-pin** test (it passes before this task; the TDD-RED exception is recorded, ruling R9) after the "refuses an addWorkItem started after the write phase settles …" test. Replace:

```ts
    // nextId continues from the imported id, not from the refused attempt.
    expect((await store.addWorkItem({ kind: 'package', name: 'after' }, 'review', 'After', NOW))?.id).toBe('wi-2');
  });
```

with:

```ts
    // nextId continues from the imported id, not from the refused attempt.
    expect((await store.addWorkItem({ kind: 'package', name: 'after' }, 'review', 'After', NOW))?.id).toBe('wi-2');
  });

  // Part 6 Y16 (Part 5 E25's parked test): now that a port can reject, replaceAll's own
  // reload can too. bulkBusy still clears, that rejection is what the caller sees, and the
  // store stays usable. REGRESSION PIN: passes before Task 2 (TDD-RED exception, ruling R9).
  it('clears bulkBusy and surfaces the rejection when its own reload rejects (Y16)', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository({ ...repo, listRules: () => Promise.reject(new Error('read failed')) });
    await expect(store.replaceAll(IMPORTED)).rejects.toThrow('read failed');
    expect(store.bulkBusy).toBe(false);
    expect(store.hasPendingChanges).toBe(false);
    expect(await repo.listWorkItems()).toEqual(ITEMS);
    expect((await store.addWorkItem({ kind: 'package', name: 'after' }, 'review', 'After', NOW))?.id).toBe('wi-13');
  });
```

  **(b) Migrations** (existing tests that would break on Y10/Y14/Y15; no assertion is weakened):
  - **Y14 — bind before any `replaceAll`/`clearAll`.** In `tests/unit/review-replace-all.test.ts`, replace each of these three `describe` openings (the fourth, `report store restore`, stays):

```ts
describe('review store replaceAll (Part 5 V16)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
```

```ts
describe('review store clearAll (Part 5 P1/T19)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
```

```ts
describe('review store bulk gate (Part 5 E18)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
```

   with the same `describe` line followed by:

```ts
  // Part 6 Y14: replaceAll and clearAll refuse while unbound, so each test starts bound.
  beforeEach(async () => { setActivePinia(createPinia()); await useReviewStore().bindRepository('repo-t'); });
```

   The two E20 tests that bind `'repo-a'` themselves keep working: they switch from `'repo-t'`.
  - **R1 — the Part 5 tests that pinned per-record (partial-failure) behaviour now pin the atomic behaviour.** In `tests/unit/review-replace-all.test.ts`:
    - Add `type ReviewReplaceState, ` to the port import: replace `  NO_CHECKS, createInMemoryReviewRepository, type BoundaryRule, type FindingDisposition, type WorkItem,` with `  NO_CHECKS, createInMemoryReviewRepository, type BoundaryRule, type FindingDisposition, type ReviewReplaceState, type WorkItem,`.
    - Retitle (assertions unchanged, they still hold for one atomic replace): replace `  it('keeps an imported item whose id a current item already had: removals finish before saves start', async () => {` with `  it('keeps an imported item whose id a current item already had (one atomic port replace, Part 6 R1)', async () => {`.
    - Replace the partial-failure test:

```ts
  it('a partial failure still attempts every save, reloads from the port, and rethrows the first rejection', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository({ ...repo, saveRule: () => Promise.reject(new Error('disk full')) });
    await store.addWorkItem({ kind: 'package', name: 'old' }, 'review', 'Old item', NOW);
    await expect(store.replaceAll(IMPORTED)).rejects.toThrow('disk full');
    expect(await repo.listWorkItems()).toEqual(ITEMS);
    expect(await repo.listDispositions()).toEqual(DECISIONS);
    expect(store.workItems).toEqual(ITEMS);
    expect(store.dispositions).toEqual(DECISIONS);
    expect(store.rules).toEqual([]);
  });
```

      with:

```ts
  // Part 6 R1: the port replaces atomically, so a failure changes nothing. (Until Part 6 this
  // pinned Part 5's per-record partial failure: every other save landed, the rule did not.)
  it('a rejected replace changes nothing, reloads what the port still holds, and rethrows it', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository({ ...repo, replaceAll: () => Promise.reject(new Error('disk full')) });
    const old = await store.addWorkItem({ kind: 'package', name: 'old' }, 'review', 'Old item', NOW);
    await expect(store.replaceAll(IMPORTED)).rejects.toThrow('disk full');
    expect(await repo.listWorkItems()).toEqual([old]);
    expect(await repo.listRules()).toEqual([]);
    expect(await repo.listDispositions()).toEqual([]);
    expect(store.workItems).toEqual([old]);
    expect(store.bulkBusy).toBe(false);
  });
```

    - In the first E20 test ("resolves false, without touching the newly bound codebase …"), gate the one port call instead of the per-record saves. Replace `    store.setRepository({ ...repoA, saveWorkItem: async (item: WorkItem) => { await gate; await repoA.saveWorkItem(item); } });` with `    store.setRepository({ ...repoA, replaceAll: async (state: ReviewReplaceState) => { await gate; await repoA.replaceAll(state); } });`. (The old gate on `saveWorkItem` would no longer hold anything: the store never calls it on this path.)
    - In the second E20 test ("… AND a write in the old codebase rejects"), replace:

```ts
    store.setRepository({
      ...repoA,
      saveWorkItem: async (item: WorkItem) => { await gate; await repoA.saveWorkItem(item); },
      saveRule: () => Promise.reject(new Error('disk full')),
    });
```

      with `    store.setRepository({ ...repoA, replaceAll: async () => { await gate; throw new Error('disk full'); } });`.
    - Line count: 276 + 3 (beforeEach comments) + 13 (Y16) + 2 (partial-failure test) − 4 (second E20 double) = 290.
  - In `tests/unit/review-clear-all.test.ts`, replace the header:

```ts
// Part 5 V32 (Part 4 E22 "the untested clearAll race and rethrow"): clearAll attempts every
// removal, reloads from the port, and rethrows the FIRST rejection in removal order; and a
// clear racing a pending update leaves neither a ghost item nor a stuck pending id.
```

    with:

```ts
// Part 5 V32 (Part 4 E22 "the untested clearAll race and rethrow"), amended by Part 6 R1:
// clearAll is one atomic port replace that reloads from the port and rethrows its rejection;
// and a clear racing a pending update leaves neither a ghost item nor a stuck pending id.
```

    and replace the whole first test:

```ts
  it('attempts every removal when two reject, reloads what the port still holds, and rethrows the first in removal order', async () => {
    const { store, inner } = await seeded();
    const first = new Error('work item wi-1');
    const second = new Error('rule AR-001');
    // wi-1's rejection settles LAST in time, the rule's first: "first" means removal order.
    let failLate: ((e: Error) => void) | undefined;
    const late = new Promise<void>((_, reject) => { failLate = reject; });
    const port = {
      ...inner,
      removeWorkItem: vi.fn((id: string) => (id === 'wi-1' ? late : inner.removeWorkItem(id))),
      removeRule: vi.fn((id: string) => (id === 'AR-001' ? Promise.reject(second) : inner.removeRule(id))),
      removeDisposition: vi.fn((fingerprint: string) => inner.removeDisposition(fingerprint)),
      listWorkItems: vi.fn(() => inner.listWorkItems()),
    };
    store.setRepository(port);
    const clearing = store.clearAll();
    failLate?.(first);
    await expect(clearing).rejects.toBe(first);
    expect(port.removeWorkItem.mock.calls.map(([id]) => id).sort()).toEqual(['wi-1', 'wi-2']);
    expect(port.removeRule).toHaveBeenCalledWith('AR-001');
    expect(port.removeDisposition).toHaveBeenCalledWith('e1#CX-1');
    expect(port.listWorkItems).toHaveBeenCalledOnce();
    expect(store.workItems.map((w) => w.id)).toEqual(['wi-1']);
    expect(store.rules.map((r) => r.id)).toEqual(['AR-001']);
    expect(store.dispositions).toHaveLength(0);
  });
```

    with:

```ts
  // Part 6 R1: ONE port replace with empty arrays, all or nothing. A rejection leaves every
  // record in the port, the reload shows them, and the rejection propagates. (Until Part 6
  // this pinned per-removal allSettled: two rejections, first in removal order.)
  it('clears through one port replace; a rejection keeps everything, reloads it and rethrows', async () => {
    const { store, inner } = await seeded();
    const failure = new Error('disk full');
    const port = {
      ...inner,
      replaceAll: vi.fn(() => Promise.reject(failure)),
      removeWorkItem: vi.fn((id: string) => inner.removeWorkItem(id)),
      listWorkItems: vi.fn(() => inner.listWorkItems()),
    };
    store.setRepository(port);
    await expect(store.clearAll()).rejects.toBe(failure);
    expect(port.replaceAll).toHaveBeenCalledOnce();
    expect(port.replaceAll).toHaveBeenCalledWith({ workItems: [], rules: [], dispositions: [] });
    expect(port.removeWorkItem).not.toHaveBeenCalled();
    expect(port.listWorkItems).toHaveBeenCalledOnce();
    expect(store.workItems.map((w) => w.id)).toEqual(['wi-1', 'wi-2']);
    expect(store.rules.map((r) => r.id)).toEqual(['AR-001']);
    expect(store.dispositions.map((d) => d.fingerprint)).toEqual(['e1#CX-1']);
    expect(store.bulkBusy).toBe(false);
  });
```

  - In `tests/component/settings-screen.test.ts` ("a rejecting repository keeps the dialog open …"), replace `    review.setRepository({ ...repo, removeWorkItem: () => Promise.reject(new Error('disk')) });` with `    review.setRepository({ ...repo, replaceAll: () => Promise.reject(new Error('disk')) }); // Part 6 R1: Clear is one port replace`.
  - In `tests/component/settings-import.test.ts`:
    - Replace `import { NO_CHECKS, createInMemoryReviewRepository, type WorkItem } from '../../src/ui/stores/ports/review-repository';` with `import { NO_CHECKS, createInMemoryReviewRepository, type ReviewReplaceState } from '../../src/ui/stores/ports/review-repository';` (`WorkItem` has no use left after the two edits below).
    - In "ignores Cancel, Escape and a second Replace while the replacement is in flight", replace:

```ts
    const save = vi.fn(async (item: WorkItem) => { await gate; await repo.saveWorkItem(item); });
    review.setRepository({ ...repo, saveWorkItem: save });
```

      with:

```ts
    const save = vi.fn(async (state: ReviewReplaceState) => { await gate; await repo.replaceAll(state); });
    review.setRepository({ ...repo, replaceAll: save }); // Part 6 R1: Replace is one port call
```

      (its `expect(save).toHaveBeenCalledTimes(1)` stays: one Replace, one port call).
    - In "a rejection keeps the dialog open with IMPORT_FAILED …", replace `    review.setRepository({ ...repo, saveRule: () => Promise.reject(new Error('disk')) });` with `    review.setRepository({ ...repo, replaceAll: () => Promise.reject(new Error('disk')) });`.
    - In the E20 test, replace `    review.setRepository({ ...repoA, saveWorkItem: async (item: WorkItem) => { await gate; await repoA.saveWorkItem(item); } });` with `    review.setRepository({ ...repoA, replaceAll: async (state: ReviewReplaceState) => { await gate; await repoA.replaceAll(state); } });`.
  - In `tests/unit/review-clear-all.test.ts`, replace:

```ts
describe('review-store clearAll (Part 5 V32)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
```

   with:

```ts
describe('review-store clearAll (Part 5 V32)', () => {
  beforeEach(async () => { setActivePinia(createPinia()); await useReviewStore().bindRepository('repo-t'); }); // Part 6 Y14
```

   and replace the removed-field read `    expect(store.pendingItemIds).toEqual([]);` with `    expect(store.hasPendingChanges).toBe(false);` (Y15: the per-codebase pending state is read through the getters).
  - In `tests/unit/review-work-items.test.ts` (its last test calls `clearAll`), replace:

```ts
describe('editable work items (Part 4 W8/W9)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
```

   with:

```ts
describe('editable work items (Part 4 W8/W9)', () => {
  beforeEach(async () => { setActivePinia(createPinia()); await useReviewStore().bindRepository('repo-t'); }); // Part 6 Y14
```

  - In `tests/component/settings-screen.test.ts` (Clear goes through `clearAll`):
    - Replace:

```ts
  it('clears the review state only after confirmation, and announces it', async () => {
    await useReviewStore().addWorkItemForFile('repo\0file\0src/a.ts', 'A', new Date());
```

      with:

```ts
  it('clears the review state only after confirmation, and announces it', async () => {
    await useReviewStore().bindRepository('repo'); // Part 6 Y14: only a bound codebase is cleared
    await useReviewStore().addWorkItemForFile('repo\0file\0src/a.ts', 'A', new Date());
```

    - Replace:

```ts
    const review = useReviewStore();
    // Part 5 V32: the rejecting repository must HOLD the item. With an empty one, the reload
```

      with:

```ts
    const review = useReviewStore();
    await review.bindRepository('repo'); // Part 6 Y14
    // Part 5 V32: the rejecting repository must HOLD the item. With an empty one, the reload
```

    - Replace:

```ts
    const review = useReviewStore();
    useReportStore().applyNote('keep?');
    review.setRepository({ ...createInMemoryReviewRepository(), saveWorkItem: () => new Promise<void>(() => {}) });
```

      with:

```ts
    const review = useReviewStore();
    await review.bindRepository('repo'); // Part 6 Y14: refused for the pending save, not for being unbound
    useReportStore().applyNote('keep?');
    review.setRepository({ ...createInMemoryReviewRepository(), saveWorkItem: () => new Promise<void>(() => {}) });
```

  - In `tests/component/settings-import.test.ts` (Replace goes through `replaceAll`; SettingsScreen is mounted without App, so nothing binds the review store), replace:

```ts
function withSnapshot(): CodebaseSnapshot {
  const snap = buildSnapshotFixture({ files: 6, directories: 1, repositoryId: 'repo-a' });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
}
```

   with:

```ts
/** Part 6 Y14: also binds the review store, as App.vue's repository watcher would; replaceAll
 *  refuses while unbound. Awaited, so no bind-time load can land on a later add. */
async function withSnapshot(): Promise<CodebaseSnapshot> {
  const snap = buildSnapshotFixture({ files: 6, directories: 1, repositoryId: 'repo-a' });
  useCityStore().setCity(snap, computeLayout(snap));
  await useReviewStore().bindRepository(snap.repositoryId);
  return snap;
}
```

   then replace every `const snap = withSnapshot();` with `const snap = await withSnapshot();` (Edit with `replace_all: true`; 12 sites) and the one bare call `    withSnapshot();` (in the first test, before `const w2 = await openPrivacy();`) with `    await withSnapshot();`. The E20 test's own `await review.bindRepository('repo-a');` becomes a no-op and stays.
  - **Y10 — hand-built doubles need the three new members.** Replace each nine-member literal with a spread of the in-memory adapter:
    - `tests/unit/review-store.test.ts`, in "a second overlapping call for the same file is refused …", replace:

```ts
    store.setRepository({
      listWorkItems: () => Promise.resolve([]),
      saveWorkItem: () => gate,
      removeWorkItem: () => Promise.resolve(),
      listRules: () => Promise.resolve([]),
      saveRule: () => Promise.resolve(),
      removeRule: () => Promise.resolve(),
      listDispositions: () => Promise.resolve([]),
      saveDisposition: () => Promise.resolve(),
      removeDisposition: () => Promise.resolve(),
    });
```

      with `    store.setRepository({ ...createInMemoryReviewRepository(), saveWorkItem: () => gate });` (the test's `wi-2` expectation holds: the refused second call never allocates).
    - `tests/component/file-inspector.test.ts`: after `import { useReviewStore } from '../../src/ui/stores/review-store';` add `import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';`. Replace the literal whose `saveWorkItem` is `() => Promise.reject(new Error('disk full'))` (from `    useReviewStore().setRepository({` to its `    });`) with `    useReviewStore().setRepository({ ...createInMemoryReviewRepository(), saveWorkItem: () => Promise.reject(new Error('disk full')) });`, and the one whose `saveWorkItem` is `() => gate` with `    useReviewStore().setRepository({ ...createInMemoryReviewRepository(), saveWorkItem: () => gate });`.
    - `tests/component/workbench-screen.test.ts`: after `import { useReviewStore } from '../../src/ui/stores/review-store';` add `import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';`. Replace the literal in "does not flash WORK_DUPLICATE on a double submit …" (from `    review.setRepository({` to its `    });`) with `    review.setRepository({ ...createInMemoryReviewRepository(), saveWorkItem: () => gate });`.
  - **Comment only.** `tests/unit/review-per-codebase.test.ts:47`: replace `    // wi-2 is removed, but its id stays spent: only the bucket's counter remembers that.` with `    // wi-2 is removed, but its id stays spent: the repository's high-water mark remembers it (Part 6 Y10).`

  The counter assertions that stay as they are, and now pass through the port's high-water mark: `review-store.test.ts` (`wi-6` after gaps, `wi-2` after a failed save, `AR-008` after `AR-007`, "load never moves nextId below a reservation"), `review-work-items.test.ts` (a refused add spends no id), `review-per-codebase.test.ts` (`wi-3`/`AR-002` on the way back), `review-replace-all.test.ts` (`wi-13`/`AR-008` after an import, `wi-2` after the gated reload). The port-level versions are in `review-repository-port.test.ts`; Task 3's contract suite takes them over for both adapters.

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/review-repository-port.test.ts tests/unit/review-store-sync.test.ts tests/unit/review-store-budget.test.ts tests/unit/review-replace-all.test.ts tests/unit/review-clear-all.test.ts tests/unit/review-work-items.test.ts tests/unit/review-store.test.ts tests/component/settings-screen.test.ts tests/component/settings-import.test.ts tests/component/file-inspector.test.ts tests/component/workbench-screen.test.ts`. Expected:
  - `review-repository-port`: FAIL — `TypeError: formatReviewId is not a function`, `reviewIdSuffix is not a function`, `repo.allocateId is not a function`, `repo.subscribe is not a function`, `….diagnostics is not a function`.
  - `review-store-sync`: FAIL — every leaf test (including the R1 `loadFailed` one) with `TypeError: store.setRepositoryFactory is not a function`; the Y14 test with `expected true to be false` (today `replaceAll` clears the unbound bucket); the Y15 test with `expected true to be false` at the first `isPendingFor` after the switch (the pending arrays are global today).
  - `review-repository-port`'s R1 test fails with `TypeError: repo.replaceAll is not a function`.
  - The R1-adjusted tests FAIL on today's store, which never calls `repository.replaceAll`: `review-clear-all`'s first test and `review-replace-all`'s rejected-replace test (both `promise resolved "true" instead of rejecting`: today's per-record path never touches the overridden `replaceAll`), and in `settings-screen`/`settings-import` the rejection and in-flight tests (the dialog closes on success instead of showing `SETTINGS_CLEAR_FAILED`/`IMPORT_FAILED`; `save` is called 0 times). The three E20 tests (two in `review-replace-all`, one in `settings-import`) only move their gate to the one port call; on today's store their result depends on timing, so they are not RED evidence.
  - `review-store-budget`: FAIL — `expected 401 to be less than or equal to 360`, `src/ui/stores/review-buckets.ts exists: expected false to be true`, and the `nextId` match.
  - The other migrated tests PASS (binding first, and spreading the in-memory adapter, both work on today's store). The Y16 regression pin also PASSES today, as recorded (ruling R9).

- [ ] **Step 3: Extend the port.** Edit `src/ui/stores/ports/review-repository.ts`.

  (a) Replace:

```ts
// WP-02 spec §4.5: review decisions live behind a port. Parts 1-4 ship in-memory only;
// Part 2 adds boundary rules (spec P5). Part 3 adds dispositions (Q3) and work-item
// targets (Q4).
```

  with:

```ts
// WP-02 spec §4.5: review decisions live behind a port. Parts 1-4 ship in-memory only;
// Part 2 adds boundary rules (spec P5). Part 3 adds dispositions (Q3) and work-item
// targets (Q4). Part 6 adds id allocation (Y10), change notifications (Y12) and storage
// diagnostics (Y7), which the durable adapter implements the same way.
```

  (b) Replace everything from `export const DISMISS_REASON_MAX = 1000;` to the end of the file (the old `ReviewRepository` interface and `createInMemoryReviewRepository`) with the following. It adds `ReviewReplaceState` and the port's `replaceAll` (ruling R1):

```ts
export const DISMISS_REASON_MAX = 1000;

/** Part 6 Y10: the two id sequences `allocateId` draws from. */
export type ReviewIdKind = 'workItem' | 'rule';

/** Part 6 Y7: what a durable adapter could not list — records skipped (kept on disk, not
 *  listed) and a record set in a format it does not support. Valid after the first list. */
export interface ReviewStorageDiagnostics { skipped: number; unsupported: boolean }

/** Part 6 Y10: `wi-N`, or `AR-` with at least three digits (`AR-007`), as before Part 6. */
export function formatReviewId(kind: ReviewIdKind, n: number): string {
  return kind === 'workItem' ? `wi-${n}` : `AR-${String(n).padStart(3, '0')}`;
}

/** Part 6 Y10: the number in a `wi-N` or `AR-N` id, or null for any other id. At most 15
 *  digits, so a high-water mark built from it is always an exact integer. */
export function reviewIdSuffix(id: string): number | null {
  const digits = /^(?:wi|AR)-(\d{1,15})$/.exec(id)?.[1];
  return digits === undefined ? null : parseInt(digits, 10);
}

/** Part 6 R1: a whole review state, written by `ReviewRepository.replaceAll` in one step (an
 *  import, or nothing for a clear). */
export interface ReviewReplaceState {
  workItems: readonly WorkItem[];
  rules: readonly BoundaryRule[];
  dispositions: readonly FindingDisposition[];
}

export interface ReviewRepository {
  listWorkItems(): Promise<WorkItem[]>;
  saveWorkItem(item: WorkItem): Promise<void>;
  removeWorkItem(id: string): Promise<void>;
  listRules(): Promise<BoundaryRule[]>;
  saveRule(rule: BoundaryRule): Promise<void>;
  removeRule(id: string): Promise<void>;
  listDispositions(): Promise<FindingDisposition[]>;
  saveDisposition(d: FindingDisposition): Promise<void>;
  removeDisposition(fingerprint: string): Promise<void>;
  /** Part 6 R1: replaces every work item, rule and disposition of this codebase with `state`,
   *  atomically: all or nothing, one notification. Raises the high-water marks past the ids
   *  given and never lowers them. */
  replaceAll(state: ReviewReplaceState): Promise<void>;
  /** Part 6 Y10: the next unused id of `kind`, synchronously; never the same id twice. A
   *  high-water mark per kind: every save raises it past the saved id, a removal never lowers
   *  it, and a durable adapter seeds it from storage on its first list — so a caller
   *  allocates only after one list has finished (the review store's `ready`). */
  allocateId(kind: ReviewIdKind): string;
  /** Part 6 Y12: `listener` runs once after every successful write — from any caller — and
   *  before that write's promise resolves; never for a rejected write. Returns the
   *  unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Part 6 Y7: see `ReviewStorageDiagnostics`. */
  diagnostics(): ReviewStorageDiagnostics;
}

const noDiagnostics = (): ReviewStorageDiagnostics => ({ skipped: 0, unsupported: false });

/** Tests, the harness and every codebase before the host wires its registry (Part 6 Y11).
 *  Same id allocation and notifications as the durable adapter; listing seeds the high-water
 *  mark too, although here every record already came through a save. Never throws (R9). */
export function createInMemoryReviewRepository(): ReviewRepository {
  const items = new Map<string, WorkItem>();
  const rules = new Map<string, BoundaryRule>();
  const dispositions = new Map<string, FindingDisposition>();
  const high: Record<ReviewIdKind, number> = { workItem: 0, rule: 0 };
  const listeners = new Set<() => void>();
  const raise = (kind: ReviewIdKind, ids: Iterable<string>): void => {
    for (const id of ids) high[kind] = Math.max(high[kind], reviewIdSuffix(id) ?? 0);
  };
  const wrote = (): Promise<void> => {
    for (const listener of [...listeners]) listener();
    return Promise.resolve();
  };
  return {
    listWorkItems: () => { raise('workItem', items.keys()); return Promise.resolve([...items.values()]); },
    saveWorkItem: (item) => { items.set(item.id, { ...item }); raise('workItem', [item.id]); return wrote(); },
    removeWorkItem: (id) => { items.delete(id); return wrote(); },
    listRules: () => { raise('rule', rules.keys()); return Promise.resolve([...rules.values()]); },
    saveRule: (rule) => { rules.set(rule.id, { ...rule }); raise('rule', [rule.id]); return wrote(); },
    removeRule: (id) => { rules.delete(id); return wrote(); },
    listDispositions: () => Promise.resolve([...dispositions.values()]),
    saveDisposition: (d) => { dispositions.set(d.fingerprint, { ...d }); return wrote(); },
    removeDisposition: (fingerprint) => { dispositions.delete(fingerprint); return wrote(); },
    replaceAll: (state) => {
      items.clear();
      rules.clear();
      dispositions.clear();
      for (const w of state.workItems) items.set(w.id, { ...w });
      for (const r of state.rules) rules.set(r.id, { ...r });
      for (const d of state.dispositions) dispositions.set(d.fingerprint, { ...d });
      raise('workItem', items.keys());
      raise('rule', rules.keys());
      return wrote();
    },
    allocateId: (kind) => { high[kind] += 1; return formatReviewId(kind, high[kind]); },
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    diagnostics: noDiagnostics,
  };
}
```

- [ ] **Step 4: Create the buckets module.** Create `src/ui/stores/review-buckets.ts`:

```ts
// Part 6 Y13 (the 400/400 rule, Part 5 E25): the review store's per-codebase bookkeeping,
// split out of review-store.ts and used only by it:
//  - Part 5 V8's buckets: one repository per codebase bound in this leaf, `''` while unbound;
//  - the repository factory (Y11) and the one live subscription with its own-write count (Y12);
//  - the keys in flight, per codebase (Y15).
import { markRaw } from 'vue';
import { noop } from '../kit/noop';
import { createInMemoryReviewRepository, type ReviewReplaceState, type ReviewRepository } from './ports/review-repository';

/** Part 5 E18 / Part 6 R1: what `clearAll` replaces the bound codebase's state with — nothing. */
export const EMPTY_REPLACEMENT: ReviewReplaceState = { workItems: [], rules: [], dispositions: [] };

export const ruleKey = (from: string, to: string): string => `${from}->${to}`;

/** One codebase's repository (Part 5 V8). The id counters a bucket used to carry are the
 *  repository's own high-water mark now (Y10): it survives a removal, a failed save and,
 *  for the durable adapter, a restart. */
export interface ReviewBucket {
  repository: ReviewRepository;
  /** Y10: a load has finished, so the repository has seeded its high-water mark. A bucket
   *  made from a fresh in-memory repository starts ready: there is nothing to seed. */
  ready: boolean;
  /** Y12: notifications still to come from this store's own writes to `repository`. */
  ownWrites: number;
}

export type ReviewRepositoryFactory = (repositoryId: string) => ReviewRepository;

export interface BucketState {
  buckets: Map<string, ReviewBucket>;
  /** Y11: the host's registry. Null in tests and in the harness, where every bucket is in memory. */
  factory: ReviewRepositoryFactory | null;
  /** Y12: the one live subscription, to the bound bucket's repository. */
  unsubscribe: (() => void) | null;
}

const inMemoryBucket = (): ReviewBucket => ({ repository: markRaw(createInMemoryReviewRepository()), ready: true, ownWrites: 0 });

/** Raw: nothing renders from it. Starts with the unbound `''` bucket. */
export function createBucketState(): BucketState {
  return markRaw({ buckets: new Map([['', inMemoryBucket()]]), factory: null, unsubscribe: null });
}

/** The bucket for `id`, made on first use: from the factory when there is one, except the
 *  unbound `''` bucket, which stays in memory and is never persisted (Y14). */
export function bucketFor(bs: BucketState, id: string): ReviewBucket {
  const existing = bs.buckets.get(id);
  if (existing) return existing;
  const made: ReviewBucket = id !== '' && bs.factory
    ? { repository: markRaw(bs.factory(id)), ready: false, ownWrites: 0 }
    : inMemoryBucket();
  bs.buckets.set(id, made);
  return made;
}

/** What the subscription needs from the store. */
interface Reloadable { readonly repository: ReviewRepository; load(): Promise<void> }

/** Y12: reloads the store, but only while `bucket` is still the bound one. A failed reload
 *  keeps the lists as they are (nobody asked for it, so nothing is announced, E17); the
 *  next bind loads again. */
function reloadIfBound(store: Reloadable, bucket: ReviewBucket): void {
  if (store.repository === bucket.repository) void store.load().catch(noop);
}

/** Y12: listens to `bucket`'s repository, dropping the previous subscription, so a store
 *  hears only the codebase it has bound. A notification one of this store's own writes
 *  caused is skipped; any other one (another leaf's write) reloads. */
export function listenTo(bs: BucketState, bucket: ReviewBucket, store: Reloadable): void {
  bs.unsubscribe?.();
  bucket.ownWrites = 0;
  bs.unsubscribe = bucket.repository.subscribe(() => {
    if (bucket.ownWrites > 0) bucket.ownWrites -= 1;
    else reloadIfBound(store, bucket);
  });
}

/** Y12: the leaf is closing; nothing reloads it any more. */
export function stopListening(bs: BucketState): void {
  bs.unsubscribe?.();
  bs.unsubscribe = null;
}

/** Y12: runs one of this store's own writes. The port notifies once per successful write,
 *  before that write's promise resolves, and never for a rejected one. So a rejection gives
 *  its expected notification back; if a foreign notification already used it up (and was
 *  skipped as this store's own), it reloads instead, to catch that change up. */
export async function ownWrite(bucket: ReviewBucket, write: () => Promise<void>, store: Reloadable): Promise<void> {
  bucket.ownWrites += 1;
  try {
    await write();
  } catch (error: unknown) {
    if (bucket.ownWrites > 0) bucket.ownWrites -= 1;
    else reloadIfBound(store, bucket);
    throw error;
  }
}

/** Y15 (Part 5 E15): the keys with a save, update or removal in flight in one codebase —
 *  rule pairs, work-item keys (target + intent), work-item ids, and fingerprints. */
export interface ReviewPending { rule: string[]; work: string[]; item: string[]; fingerprint: string[] }
type PendingKind = keyof ReviewPending;
const NONE_PENDING: Readonly<ReviewPending> = Object.freeze({ rule: [], work: [], item: [], fingerprint: [] });

export const pendingOf = (pending: ReadonlyMap<string, ReviewPending>, key: string): Readonly<ReviewPending> =>
  pending.get(key) ?? NONE_PENDING;

export const anyPending = (p: Readonly<ReviewPending>): boolean =>
  p.rule.length > 0 || p.work.length > 0 || p.item.length > 0 || p.fingerprint.length > 0;

/** Marks `value` in flight in codebase `key`, before the action's first `await` (fix round
 *  2's reservation: an overlapping second call for the same key sees it and refuses). */
export function reserve(pending: Map<string, ReviewPending>, key: string, kind: PendingKind, value: string): void {
  const entry = pending.get(key) ?? { rule: [], work: [], item: [], fingerprint: [] };
  entry[kind] = [...entry[kind], value];
  pending.set(key, entry);
}

/** A `finally` releases `value` from the codebase it was reserved in, by the key the action
 *  captured — never from whichever codebase is bound by the time it settles. */
export function release(pending: Map<string, ReviewPending>, key: string, kind: PendingKind, value: string): void {
  const entry = pending.get(key);
  if (entry) entry[kind] = entry[kind].filter((v) => v !== value);
}
```

- [ ] **Step 5: Replace the store.** Replace the whole of `src/ui/stores/review-store.ts` with:

```ts
// WP-02 spec §4.5: the bound codebase's work items, boundary rules and finding decisions,
// persisted through the ReviewRepository port before local state changes. Part 6 Y13: the
// per-codebase bookkeeping (buckets, subscription, pending keys) is in review-buckets.ts.
import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import {
  workTargetKey, workItemProblem, clipTitle, NO_CHECKS, DISMISS_REASON_MAX, RULE_RATIONALE_MAX,
  type BoundaryRule, type FindingDisposition, type ReviewReplaceState, type ReviewRepository, type ReviewStorageDiagnostics,
  type WorkIntent, type WorkItem, type WorkItemInit, type WorkItemPatch, type WorkTarget,
} from './ports/review-repository';
import {
  EMPTY_REPLACEMENT, anyPending, bucketFor, createBucketState, listenTo, ownWrite, pendingOf, release, reserve, ruleKey,
  stopListening, type BucketState, type ReviewPending, type ReviewRepositoryFactory,
} from './review-buckets';

interface ReviewState {
  workItems: WorkItem[];
  repository: ReviewRepository;
  rules: BoundaryRule[];
  /** Part 3 Q3: decisions on findings, kept apart from the findings themselves. */
  dispositions: FindingDisposition[];
  /** Part 6 Y15 (Part 5 E15): the keys with a save, update or removal in flight, per codebase
   *  (repository id). A key is reserved before the action's first `await`, so an overlapping
   *  second call for it refuses instead of racing it (fix round 2). The getters read the
   *  bound codebase's entry only. */
  pending: Map<string, ReviewPending>;
  /** Part 5 V8 / Part 6 Y13: the buckets, the repository factory and the subscription. Raw. */
  bucketState: BucketState;
  /** The key of the bucket `repository` belongs to; `''` while unbound. */
  boundKey: string;
  /** Part 6 Y10: the bound bucket has finished a load, so its repository has seeded its id
   *  high-water mark. Adds refuse (null, announcing nothing) until then. */
  ready: boolean;
  /** Part 6 R1: the last load of the bound codebase rejected (a durable read failed). Cleared
   *  by the next successful load, and on every bind. */
  loadFailed: boolean;
  /** Part 6 Y7: the bound repository's diagnostics, mirrored after each load. */
  storageDiagnostics: ReviewStorageDiagnostics;
  /** Part 5 E18: true while `replaceAll` (which `clearAll` calls) is running. Set before its
   *  first `await` and cleared in `finally`; every mutating action refuses while it is set.
   *  Global per store (Part 5 E18–E20), unlike the pending keys. */
  bulkBusy: boolean;
}

const noDiagnostics = (): ReviewStorageDiagnostics => ({ skipped: 0, unsupported: false });

export const useReviewStore = defineStore('review', {
  state: (): ReviewState => {
    const bucketState = createBucketState();
    return {
      workItems: [],
      repository: bucketFor(bucketState, '').repository,
      rules: [],
      dispositions: [],
      pending: new Map(),
      bucketState,
      boundKey: '',
      ready: true,
      loadFailed: false,
      storageDiagnostics: noDiagnostics(),
      bulkBusy: false,
    };
  },
  getters: {
    /** Part 5 E18: any save, update or removal in flight in the bound codebase, OR a
     *  `clearAll`/`replaceAll` already running. The gate those two use before starting. */
    hasPendingChanges: (state): boolean => state.bulkBusy || anyPending(pendingOf(state.pending, state.boundKey)),
    workItemCount: (state): number => state.workItems.length,
    /** Part 4 W13: the nav badge counts what is still to do. */
    openWorkItemCount: (state): number => state.workItems.filter((w) => w.status !== 'verified').length,
    isItemPending: (state) => (id: string): boolean => pendingOf(state.pending, state.boundKey).item.includes(id),
    hasWorkItem: (state) => (target: WorkTarget, intent: WorkIntent): boolean =>
      state.workItems.some((w) => workTargetKey(w.target, w.intent) === workTargetKey(target, intent)),
    isPending: (state) => (target: WorkTarget, intent: WorkIntent): boolean =>
      pendingOf(state.pending, state.boundKey).work.includes(workTargetKey(target, intent)),
    /** Unchanged meaning since Part 1: this file already has a REFACTOR item. */
    hasWorkItemFor: (state) => (entityId: EntityId): boolean =>
      state.workItems.some((w) => w.intent === 'refactor' && w.target.kind === 'file' && w.target.entityId === entityId),
    isPendingFor: (state) => (entityId: EntityId): boolean =>
      pendingOf(state.pending, state.boundKey).work.includes(workTargetKey({ kind: 'file', entityId }, 'refactor')),
    workItemsForFile: (state) => (entityId: EntityId): WorkItem[] =>
      state.workItems.filter((w) => w.target.kind === 'file' && w.target.entityId === entityId),
    ruleCount: (state): number => state.rules.length,
    hasRule: (state) => (from: string, to: string): boolean =>
      state.rules.some((r) => r.from === from && r.to === to),
    dispositionFor: (state) => (fingerprint: string): FindingDisposition | undefined =>
      state.dispositions.find((d) => d.fingerprint === fingerprint),
    isDispositionPending: (state) => (fingerprint: string): boolean =>
      pendingOf(state.pending, state.boundKey).fingerprint.includes(fingerprint),
  },
  actions: {
    /** Replaces the bound codebase's repository (tests). The bucket keeps its `ready` flag;
     *  the store listens to the new repository instead (Y12). */
    setRepository(repository: ReviewRepository): void {
      const bucket = bucketFor(this.bucketState, this.boundKey);
      bucket.repository = markRaw(repository);
      this.repository = bucket.repository;
      listenTo(this.bucketState, bucket, this);
    },
    /** Part 6 Y11: where each codebase's repository comes from (the host's registry). Used for
     *  every codebase bound from now on; the unbound `''` bucket stays in memory (Y14). */
    setRepositoryFactory(factory: ReviewRepositoryFactory): void {
      this.bucketState.factory = factory;
    },
    /** Part 5 V8: one repository per codebase. Steps (a)–(d) run synchronously, so the
     *  previous codebase's items never render for even one frame; (e) loads the target's own
     *  state. Binding the bound id again is a no-op. */
    async bindRepository(id: string): Promise<void> {
      if (id === this.boundKey) return;
      const target = bucketFor(this.bucketState, id); // (a) made on first use (Y11)
      this.boundKey = id; // (b)
      this.repository = target.repository;
      this.ready = target.ready;
      listenTo(this.bucketState, target, this); // (c) Y12: only the bound codebase is heard
      this.workItems = []; // (d)
      this.rules = [];
      this.dispositions = [];
      this.storageDiagnostics = noDiagnostics();
      this.loadFailed = false;
      await this.load(); // (e)
    },
    /** Part 6 Y12: stops listening to the bound repository. The host calls it when the leaf
     *  closes, so a closed leaf is never reloaded by another leaf's write. */
    detach(): void {
      stopListening(this.bucketState);
    },
    /** Part 5 V9: a load that settles after a codebase switch belongs to the old codebase and
     *  changes nothing. Part 6 Y10: a finished load makes the bucket ready. R1: a rejected list
     *  sets `loadFailed` (while still bound) and the rejection propagates. */
    async load(): Promise<void> {
      const repo = this.repository;
      let lists: [WorkItem[], BoundaryRule[], FindingDisposition[]];
      try {
        lists = await Promise.all([repo.listWorkItems(), repo.listRules(), repo.listDispositions()]);
      } catch (error: unknown) {
        if (this.repository === repo) this.loadFailed = true;
        throw error;
      }
      if (this.repository !== repo) return;
      const [items, rules, dispositions] = lists;
      this.workItems = items;
      this.rules = rules;
      this.dispositions = dispositions;
      this.storageDiagnostics = { ...repo.diagnostics() };
      bucketFor(this.bucketState, this.boundKey).ready = true;
      this.ready = true;
      this.loadFailed = false;
    },
    /** One work item per (target, intent); a second request for the same pair is refused
     *  (null), even while the first is still saving (fix round 2). Persists BEFORE pushing
     *  into `workItems` (fix round 1): a rejection leaves it unchanged and propagates.
     *  Part 6 Y10: the id comes from the port's `allocateId`, only once every guard has
     *  passed, so a refused call never spends one; a failed save leaves a gap. */
    async addWorkItem(target: WorkTarget, intent: WorkIntent, title: string, now: Date, init: WorkItemInit = {}): Promise<WorkItem | null> {
      const key = workTargetKey(target, intent);
      const codebase = this.boundKey;
      if (!this.ready || this.bulkBusy || this.hasWorkItem(target, intent) || this.isPending(target, intent)) return null;
      // Controller ruling Part 4 E3: clip (never refuse) an over-long GENERATED title, so a
      // long package or file name can never make the calling button silently do nothing.
      // `updateWorkItem` still refuses one via `workItemProblem`: that title came from the user.
      const fields: Omit<WorkItem, 'id'> = {
        target, intent, title: clipTitle(title.trim()), status: init.status ?? 'investigate',
        priority: init.priority ?? 'medium', notes: init.notes ?? '', checks: init.checks ?? NO_CHECKS, createdAt: now.toISOString(),
      };
      if (workItemProblem(fields) !== null) return null;
      const repo = this.repository;
      const item: WorkItem = { id: repo.allocateId('workItem'), ...fields };
      reserve(this.pending, codebase, 'work', key);
      try {
        await ownWrite(bucketFor(this.bucketState, codebase), () => repo.saveWorkItem(item), this);
        // Part 5 V9: saved in its own codebase either way (so the real result is returned),
        // but shown only while that codebase is still bound. A load() that ran mid-save may
        // already hold it.
        if (this.repository === repo && !this.workItems.some((w) => w.id === item.id)) this.workItems.push(item);
        return item;
      } finally {
        release(this.pending, codebase, 'work', key);
      }
    },
    addWorkItemForFile(entityId: EntityId, title: string, now: Date): Promise<WorkItem | null> {
      return this.addWorkItem({ kind: 'file', entityId }, 'refactor', title, now);
    },
    /** Part 4 W9: same persist-first ordering and pending reservation as `addWorkItem`, keyed
     *  by id. Refuses (null) an unknown id, a pending id, and any edit `workItemProblem`
     *  rejects. Copies only the five patch fields, and only when present, so the target and
     *  intent (the item's identity, Q4) never change through this path. */
    async updateWorkItem(id: string, patch: WorkItemPatch, now: Date): Promise<WorkItem | null> {
      const current = this.workItems.find((w) => w.id === id);
      const codebase = this.boundKey;
      if (this.bulkBusy || !current || this.isItemPending(id)) return null;
      const next: WorkItem = { ...current, updatedAt: now.toISOString() };
      if (patch.title !== undefined) next.title = patch.title.trim();
      if (patch.status !== undefined) next.status = patch.status;
      if (patch.priority !== undefined) next.priority = patch.priority;
      if (patch.notes !== undefined) next.notes = patch.notes;
      if (patch.checks !== undefined) next.checks = patch.checks;
      if (workItemProblem(next) !== null) return null;
      const repo = this.repository;
      reserve(this.pending, codebase, 'item', id);
      try {
        await ownWrite(bucketFor(this.bucketState, codebase), () => repo.saveWorkItem(next), this);
        // Part 5 V9: another codebase may hold an item with the same id.
        if (this.repository === repo) this.workItems = this.workItems.map((w) => (w.id === id ? next : w));
        return next;
      } finally {
        release(this.pending, codebase, 'item', id);
      }
    },
    /** Persist first (a rejecting port leaves the item in place); refused (false) for an
     *  unknown id (so E17 callers never announce a removal that did not happen), and while an
     *  update or removal of the same id is in flight. */
    async removeWorkItem(id: string): Promise<boolean> {
      const codebase = this.boundKey;
      if (this.bulkBusy || !this.workItems.some((w) => w.id === id) || this.isItemPending(id)) return false;
      const repo = this.repository;
      reserve(this.pending, codebase, 'item', id);
      try {
        await ownWrite(bucketFor(this.bucketState, codebase), () => repo.removeWorkItem(id), this);
        if (this.repository === repo) this.workItems = this.workItems.filter((w) => w.id !== id);
        return true;
      } finally {
        release(this.pending, codebase, 'item', id);
      }
    },
    /** Part 4 W14 / Part 5 V16: `replaceAll` with empty arrays (R1). Same gating and errors. */
    clearAll(): Promise<boolean> {
      return this.replaceAll(EMPTY_REPLACEMENT);
    },
    /** Part 5 V16 / Part 6 R1: replaces the bound codebase's whole review state (an import, or
     *  nothing via `clearAll`) with ONE port `replaceAll`, all or nothing, persisted first.
     *  Reloads in `finally`, so the lists show what the port holds. Refused (false), touching
     *  nothing, while unbound (Y14) or while `hasPendingChanges` (Part 5 E18). `bulkBusy`
     *  clears in a NESTED `finally`, once the reload has settled (fix round 3, minor 1), even
     *  when it rejects (Y16). A rejection is rethrown while the same codebase is bound; after
     *  a switch mid-run (Part 5 E20) the call resolves `false` and never rethrows. */
    async replaceAll(state: ReviewReplaceState): Promise<boolean> {
      if (this.boundKey === '' || this.hasPendingChanges) return false;
      this.bulkBusy = true;
      const repo = this.repository;
      try {
        await ownWrite(bucketFor(this.bucketState, this.boundKey), () => repo.replaceAll(state), this);
      } catch (error: unknown) {
        if (this.repository === repo) throw error;
        return false;
      } finally {
        try {
          if (this.repository === repo) await this.load();
        } finally {
          this.bulkBusy = false;
        }
      }
      return this.repository === repo;
    },
    /** Part 2 P5. Same reservation and persist-first ordering as `addWorkItem`, and the id
     *  comes from the port the same way (Y10). Refuses (null) a self-rule, an empty rationale,
     *  one over `RULE_RATIONALE_MAX` after trimming (Part 5 E9(b)), an existing pair, and a
     *  second call for a pair whose first save has not settled. */
    async addRule(from: string, to: string, rationale: string, now: Date): Promise<BoundaryRule | null> {
      const key = ruleKey(from, to);
      const codebase = this.boundKey;
      const trimmed = rationale.trim();
      if (!this.ready || this.bulkBusy || from === to || trimmed === '' || trimmed.length > RULE_RATIONALE_MAX
        || this.hasRule(from, to) || pendingOf(this.pending, codebase).rule.includes(key)) return null;
      const repo = this.repository;
      const rule: BoundaryRule = { id: repo.allocateId('rule'), from, to, rationale: trimmed, createdAt: now.toISOString() };
      reserve(this.pending, codebase, 'rule', key);
      try {
        await ownWrite(bucketFor(this.bucketState, codebase), () => repo.saveRule(rule), this);
        if (this.repository === repo && !this.rules.some((r) => r.id === rule.id)) this.rules.push(rule);
        return rule;
      } finally {
        release(this.pending, codebase, 'rule', key);
      }
    },
    /** Part 5 E18: a no-op (not a removal) while a bulk operation is running. */
    async removeRule(id: string): Promise<void> {
      if (this.bulkBusy) return;
      const repo = this.repository;
      await ownWrite(bucketFor(this.bucketState, this.boundKey), () => repo.removeRule(id), this);
      if (this.repository === repo) this.rules = this.rules.filter((r) => r.id !== id);
    },
    /** Part 3 Q3: a decision is stored apart from the generated finding, keyed by its
     *  fingerprint. Same persist-first ordering and pending guard as work items. */
    async decide(disposition: FindingDisposition): Promise<FindingDisposition | null> {
      const fp = disposition.fingerprint;
      const codebase = this.boundKey;
      if (this.bulkBusy || this.isDispositionPending(fp)) return null;
      const repo = this.repository;
      reserve(this.pending, codebase, 'fingerprint', fp);
      try {
        await ownWrite(bucketFor(this.bucketState, codebase), () => repo.saveDisposition(disposition), this);
        if (this.repository === repo) this.dispositions = [...this.dispositions.filter((d) => d.fingerprint !== fp), disposition];
        return disposition;
      } finally {
        release(this.pending, codebase, 'fingerprint', fp);
      }
    },
    acknowledge(fingerprint: string, now: Date): Promise<FindingDisposition | null> {
      return this.decide({ fingerprint, status: 'acknowledged', decidedAt: now.toISOString() });
    },
    dismiss(fingerprint: string, reason: string, now: Date): Promise<FindingDisposition | null> {
      const trimmed = reason.trim();
      if (trimmed === '' || trimmed.length > DISMISS_REASON_MAX) return Promise.resolve(null);
      return this.decide({ fingerprint, status: 'dismissed', reason: trimmed, decidedAt: now.toISOString() });
    },
    /** Reopening deletes the decision: a finding without one is open. Pending-aware like
     *  `decide`; persists before mutating (E32), so a rejecting port leaves it in place. */
    async reopen(fingerprint: string): Promise<boolean> {
      const codebase = this.boundKey;
      if (this.bulkBusy || this.isDispositionPending(fingerprint)) return false;
      const repo = this.repository;
      reserve(this.pending, codebase, 'fingerprint', fingerprint);
      try {
        await ownWrite(bucketFor(this.bucketState, codebase), () => repo.removeDisposition(fingerprint), this);
        if (this.repository === repo) this.dispositions = this.dispositions.filter((d) => d.fingerprint !== fingerprint);
        return true;
      } finally {
        release(this.pending, codebase, 'fingerprint', fingerprint);
      }
    },
  },
});
```

  Afterwards:
  - `grep -n "this.repository\." src/ui/stores/review-store.ts` prints nothing (every port call goes through a captured `repo`, Part 5 V9).
  - `grep -nE "nextId|nextRuleId|pendingItemIds|pendingWorkKeys|pendingRuleKeys|pendingFingerprints|ReviewReplacement" src` prints nothing, and `grep -n "allSettled" src/ui/stores` prints nothing (`src/host/settings-tab.ts` keeps its own, unrelated `allSettled`).
  - `wc -l src/ui/stores/review-store.ts src/ui/stores/review-buckets.ts` prints about 323 and 124.

- [ ] **Step 6: Run and confirm it passes.** `npx vitest run tests/unit/review-repository-port.test.ts tests/unit/review-store-sync.test.ts tests/unit/review-store-budget.test.ts tests/unit/review-store.test.ts tests/unit/review-work-items.test.ts tests/unit/review-dispositions.test.ts tests/unit/review-per-codebase.test.ts tests/unit/review-replace-all.test.ts tests/unit/review-clear-all.test.ts tests/unit/read-models.test.ts tests/component/file-inspector.test.ts tests/component/workbench-screen.test.ts tests/component/workbench-guards.test.ts tests/component/work-editor-focus.test.ts tests/component/settings-screen.test.ts tests/component/settings-import.test.ts tests/component/quality-dialog-status.test.ts tests/component/quality-screen.test.ts tests/component/ownership-screen.test.ts tests/component/workspace-shell.test.ts tests/component/architecture-rules.test.ts tests/component/report-screen.test.ts tests/component/nav-column.test.ts tests/component/dependencies-screen.test.ts tests/component/file-detail-screen.test.ts tests/component/tests-screen.test.ts tests/harness/harness.test.ts`. Expected: PASS (every file that uses `useReviewStore`).

- [ ] **Step 7: Gate.** `npm run typecheck && npm run lint:fast && npx vitest run <the Step 6 files>`, then `npx eslint src/ui/stores/ports/review-repository.ts src/ui/stores/review-buckets.ts src/ui/stores/review-store.ts tests/unit/review-repository-port.test.ts tests/unit/review-store-sync.test.ts tests/unit/review-store-budget.test.ts tests/unit/review-replace-all.test.ts tests/unit/review-clear-all.test.ts tests/unit/review-work-items.test.ts tests/unit/review-store.test.ts tests/unit/review-per-codebase.test.ts tests/component/file-inspector.test.ts tests/component/workbench-screen.test.ts tests/component/settings-screen.test.ts tests/component/settings-import.test.ts --max-warnings 0`.

- [ ] **Step 8: Commit.**

```
git add src/ui/stores/ports/review-repository.ts src/ui/stores/review-buckets.ts src/ui/stores/review-store.ts tests/unit/review-repository-port.test.ts tests/unit/review-store-sync.test.ts tests/unit/review-store-budget.test.ts tests/unit/review-replace-all.test.ts tests/unit/review-clear-all.test.ts tests/unit/review-work-items.test.ts tests/unit/review-store.test.ts tests/unit/review-per-codebase.test.ts tests/component/file-inspector.test.ts tests/component/workbench-screen.test.ts tests/component/settings-screen.test.ts tests/component/settings-import.test.ts
git commit -m "refactor(ui): review port allocates ids, notifies and replaces atomically; review store split, pending state per codebase (Y10, Y12–Y16, R1)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---


---

### Task 3: Durable adapter, registry and contract (Y5–Y9, Y11 registry, Y17 purge; R1 durable `replaceAll`)

**Files:**
- Modify: `src/adapters/storage/plugin-data-shape.ts` (107 → 110) — the `reviews` key.
- Create: `src/adapters/storage/plugin-data-review-repository.ts` (~225) — the durable adapter (13 port members plus `retire`), `ReviewStoreError`, `REVIEW_STORE_MAX_BYTES`, `deleteReviewSet`.
- Create: `src/adapters/storage/review-repository-registry.ts` (~45) — one instance per codebase; purge.
- Create: `src/ui/read-models/review-record-codec.ts` (~95) — record ⇄ stored (path) form.
- Modify: `src/ui/read-models/review-state-import.ts` (240 → ~262) — export `WORK_ITEM`, `RULE`, `DISPOSITION`; extract `toWorkItem`, `toRule`, `toDisposition` from `toState`.
- Modify: `src/ui/read-models/review-state.ts` (108 → ~125) — extract `exportedWorkItem`, `exportedRule`, `exportedDisposition` from `reviewStateJson` (the export's bytes do not change).
- Create: `src/ui/audit-copy/storage.ts` (~22)
- Modify: `src/ui/inspector-copy.ts` (297 → 300, or +1 if Task 1 already opened a Part 6 block)
- Create: `tests/contracts/review-repository.contract.ts` (~400), `tests/unit/review-repository.test.ts` (~40), `tests/unit/review-repository-registry.test.ts` (~85), `tests/unit/review-record-codec.test.ts` (~80)

**Interfaces:**
- Consumes (Task 2, `src/ui/stores/ports/review-repository.ts`): `ReviewRepository` (**13 members**, R1: the 9 existing ones, `allocateId`, `subscribe`, `diagnostics` and `replaceAll(state: ReviewReplaceState): Promise<void>`), `ReviewReplaceState`, `ReviewIdKind`, `ReviewStorageDiagnostics`, `formatReviewId(kind, n)`, `reviewIdSuffix(id)` (`/^(?:wi|AR)-(\d{1,15})$/`), `createInMemoryReviewRepository()`.
- Consumes (existing): `readPluginData`, `writePluginDataSlice`, `asUnknownArray`, `isRecordWithField` (plugin-data-shape.ts); `parseEntityId`, `makeEntityId`; `findingRef` (review-state.ts); `workTargetKey`.
- Produces (`src/adapters/storage/plugin-data-review-repository.ts`): `REVIEW_STORE_MAX_BYTES = 1_000_000`; `type ReviewStoreErrorCode = 'full' | 'unsupported' | 'unrepresentable'`; `class ReviewStoreError extends Error { readonly code: ReviewStoreErrorCode }`; `interface PluginDataReviewRepository extends ReviewRepository { retire(): void }` (used only by the registry's purge); `createPluginDataReviewRepository(plugin: Plugin, repositoryId: string): PluginDataReviewRepository` (assignable to the outline's `ReviewRepository` return); `deleteReviewSet(plugin: Plugin, repositoryId: string): Promise<void>`.
- Produces (`src/adapters/storage/review-repository-registry.ts`): `interface ReviewRepositoryRegistry { for(repositoryId: string): ReviewRepository; purge(repositoryId: string): Promise<void> }`, `createReviewRepositoryRegistry(plugin: Plugin): ReviewRepositoryRegistry`.
- Produces (`src/ui/read-models/review-record-codec.ts`): `type StoredRecord = Record<string, unknown>`; `interface DecodedRecords { workItems: WorkItem[]; rules: BoundaryRule[]; dispositions: FindingDisposition[]; skipped: number }`; `encodeWorkItem(item: WorkItem, repositoryId: string): StoredRecord | null`; `encodeRule(rule: BoundaryRule): StoredRecord | null`; `encodeDisposition(decision: FindingDisposition, repositoryId: string): StoredRecord | null`; `storedFindingKey(fingerprint: string, repositoryId: string): string | null`; `decodeRecords(raw: unknown, repositoryId: string): DecodedRecords`.
- Produces (copy, `src/ui/audit-copy/storage.ts`): `REVIEW_STORE_FULL`, `REVIEW_STORE_UNSUPPORTED`, `REVIEW_SAVE_UNREPRESENTABLE` (the `ReviewStoreError` messages; R9: unmapped by screens in Part 6), `REVIEW_RECORDS_SKIPPED(n)`, `REVIEW_STORE_UNSUPPORTED_NOTE` (Task 4's Settings line; Task 4 adds `REVIEW_STORE_READ_FAILED` to this file).
- Produces (tests): `tests/contracts/review-repository.contract.ts` exports `ReviewRepositoryHarness { repo; reopen; writeRaw; readRaw; writes }`, `CONTRACT_REPO`, `runReviewRepositoryContract(name, make)` (both adapters) and `runDurableReviewRepositoryContract(name, make)` (plugin-data only).

**Design (binding for the implementer):**
- **Stored shape (Y5/Y6):** data.json `reviews = { [repositoryId]: { v: 1, workItems: unknown[], rules: unknown[], dispositions: unknown[], highWater: { workItem: number, rule: number } } }`. Records are in the Part 5 v2 export's path form, built by the export's own converters. No raw entity id, NUL or repository id inside a set.
- **Reads (Y7, Y8, Y19; accepted):** every `list*` re-reads data.json; reads made while one is in flight share it (a store's `load()` costs one read). Each entry is validated with the import's own record schema; an invalid entry, or one repeating an earlier entry's id (or target+intent, rule pair, finding), is skipped and counted. No read ever writes.
- **Record writes (Y7, Y8):** every write is ONE `writePluginDataSlice(plugin, 'reviews', …)` (the plugin-wide lock). `save*`/`remove*` upsert or remove **by id against the raw array**: the first raw entry with the id is replaced in place, later entries with the same id are dropped (a removal drops all), every other raw entry — valid or not — and every unknown set key is carried over verbatim.
- **`replaceAll` (R1):** encodes every record first; if ANY is unrepresentable it rejects `'unrepresentable'` and writes nothing. Otherwise ONE slice write replaces the **whole** set (skipped-but-kept records and unknown keys go too: an explicit user replace or clear), rejects `'full'` over 1 MB and `'unsupported'` on a read-only set, and on success notifies once. `highWater` becomes max(old stored mark, every id seen, ids given) — never lowered.
- **Read-only sets (Y7):** a set with `v !== 1`, a set that is not a plain object, a v1 set whose lists are not arrays, or a `reviews` value that is not a plain object reads as empty with `diagnostics().unsupported === true`; every write (a removal and `replaceAll` too) rejects `ReviewStoreError('unsupported')` inside the lock, before `saveData`.
- **Size (Y9):** a save or `replaceAll` computes the new set and rejects `'full'` before `saveData` when `JSON.stringify(next).length > REVIEW_STORE_MAX_BYTES`. Removals skip the check.
- **Unrepresentable (Y6):** a save whose codec result is `null` — a file target whose entity id does not parse strictly, is not a `file` entity, or is of another repository; an id or field the read schema would refuse; a fingerprint with no `#` or of another codebase — rejects `'unrepresentable'` before taking the lock.
- **Ids (Y10, R9):** a mark per kind that only rises. It absorbs `max(stored highWater, highest raw id of that kind)` on every read and again inside every write (before and after the change), under the lock — raw ids of *skipped* records count, so a skipped `wi-5` is never handed out and then overwritten. Every write persists `highWater` as the current marks. **Seeded** = a read or a write has absorbed the stored set at least once. **Only this adapter throws on `allocateId` before it is seeded** (R9; a plain `Error`, developer text): seeding from 0 is unsafe because `saveWorkItem`/`saveRule` are upserts and cannot tell a new id from an edit, so a pre-seed id could silently overwrite a stored record. Task 2's store adds nothing until `ready`, so the throw is unreachable from the UI.
- **Notifications (Y12):** after each successful write (`replaceAll` included), every subscriber is called synchronously, once, **before** the write's promise resolves. Reads never notify; a refused write never notifies.
- **Diagnostics (Y7):** `{ skipped: 0, unsupported: false }` until the first read; afterwards it reflects the last read or the set the last write saved.
- **Purge (Y17; accepted):** `registry.purge(id)` drops the cached instance, queues `deleteReviewSet` on the data lock (synchronously), then calls the old instance's `retire()` — its later writes reject `'unsupported'`, and its subscribers are told once (their reload is queued after the delete, so it reads the purged state) — then awaits the delete. A `reviews` value that is not an object is left untouched. `for(id)` afterwards builds a fresh instance.
- **Unbound bucket (Y14):** `registry.for('')` returns a fresh, unpersisted in-memory repository (the store never asks; a stray call can never write `reviews['']`).

- [ ] **Step 1: Write the shared contract.** Create `tests/contracts/review-repository.contract.ts`:

```ts
// Part 6 Y5–Y12, R1: the suite every ReviewRepository must pass, run against the in-memory
// adapter (src/ui/stores/ports/review-repository.ts) and the durable plugin-data adapter
// (src/adapters/storage/plugin-data-review-repository.ts), so they cannot drift (ruling
// M24's pattern, as profile-store.contract.ts).
//
// `runReviewRepositoryContract` uses `repo` only; both adapters run it.
// `runDurableReviewRepositoryContract` is plugin-data only. It needs the backing data.json:
// - `writeRaw(doc)` replaces the whole data.json, exactly as a hand edit or a newer plugin
//   version could leave it (the only way to put an invalid record on disk);
// - `readRaw()` returns the whole data.json;
// - `reopen()` builds a FRESH adapter on the same data.json (a plugin restart);
// - `writes()` counts the adapter's own data.json saves (writeRaw does not count).
// Plugin-data-only cases: persistence across a reopen, the path form on disk, the
// high-water mark on disk, allocating before the first read, skip-but-keep, duplicate ids,
// an unsupported set, the 1 MB bound, unrepresentable records, other keys left alone, and
// replaceAll's single atomic write.
import { describe, expect, it } from 'vitest';
import { makeEntityId } from '../../src/domain/entity-id';
import {
  NO_CHECKS, type BoundaryRule, type FindingDisposition, type ReviewRepository, type WorkItem,
} from '../../src/ui/stores/ports/review-repository';
import { REVIEW_STORE_MAX_BYTES, ReviewStoreError } from '../../src/adapters/storage/plugin-data-review-repository';

export interface ReviewRepositoryHarness {
  repo: ReviewRepository;
  reopen: () => ReviewRepository;
  writeRaw: (doc: unknown) => Promise<void>;
  readRaw: () => Promise<unknown>;
  writes: () => number;
}

export const CONTRACT_REPO = 'repo-contract';
const AT = '2026-09-23T10:00:00.000Z';
const NUL = String.fromCharCode(0);
const fileId = (path: string, repositoryId = CONTRACT_REPO): string => makeEntityId(repositoryId, 'file', path);

function item(id: string, overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id, target: { kind: 'file', entityId: fileId(`src/${id}.ts`) }, intent: 'refactor', title: `Item ${id}`,
    status: 'investigate', priority: 'medium', notes: '', checks: NO_CHECKS, createdAt: AT, ...overrides,
  };
}
const rule = (id: string, to = `m-${id}`): BoundaryRule => ({ id, from: 'ui', to, rationale: 'Layering', createdAt: AT });
const decision = (path: string, findingId = 'CX-1'): FindingDisposition =>
  ({ fingerprint: `${fileId(path)}#${findingId}`, status: 'acknowledged', decidedAt: AT });
/** The stored (path) form of `item(id)`, for writeRaw. */
const stored = (id: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  id, target: { kind: 'file', path: `src/${id}.ts` }, intent: 'refactor', title: `Item ${id}`,
  status: 'investigate', priority: 'medium', notes: '', checks: [false, false, false], createdAt: AT, ...extra,
});

export function runReviewRepositoryContract(name: string, make: () => Promise<ReviewRepositoryHarness>): void {
  describe(`ReviewRepository contract: ${name}`, () => {
    it('round-trips work items (file, package and module targets), rules and decisions', async () => {
      const { repo } = await make();
      const items = [
        item('wi-1'),
        item('wi-2', { target: { kind: 'package', name: '@scope/pkg' }, intent: 'review', updatedAt: AT }),
        item('wi-3', { target: { kind: 'module', module: 'src' }, status: 'verified', checks: [true, true, true] }),
      ];
      const dismissed: FindingDisposition = { ...decision('src/a.ts', 'DU-0a1b2c3d'), status: 'dismissed', reason: 'Generated code' };
      for (const w of items) await repo.saveWorkItem(w);
      await repo.saveRule(rule('AR-001'));
      await repo.saveDisposition(dismissed);
      await repo.saveDisposition(decision('docs/c#sharp.md'));
      expect(await repo.listWorkItems()).toEqual(items);
      expect(await repo.listRules()).toEqual([rule('AR-001')]);
      expect(await repo.listDispositions()).toEqual([dismissed, decision('docs/c#sharp.md')]);
    });

    it('replaces a record saved again under its id in place, and removes by id without touching the others', async () => {
      const { repo } = await make();
      for (const id of ['wi-1', 'wi-2', 'wi-3']) await repo.saveWorkItem(item(id));
      await repo.saveWorkItem(item('wi-2', { title: 'Renamed' }));
      await repo.removeWorkItem('wi-1');
      expect((await repo.listWorkItems()).map((w) => [w.id, w.title])).toEqual([['wi-2', 'Renamed'], ['wi-3', 'Item wi-3']]);
      await repo.saveRule(rule('AR-001'));
      await repo.saveRule(rule('AR-002'));
      await repo.removeRule('AR-001');
      expect(await repo.listRules()).toEqual([rule('AR-002')]);
      const redecided: FindingDisposition = { ...decision('src/a.ts'), status: 'dismissed', reason: 'Generated' };
      await repo.saveDisposition(decision('src/a.ts'));
      await repo.saveDisposition(decision('src/b.ts'));
      await repo.saveDisposition(redecided);
      await repo.removeDisposition(decision('src/b.ts').fingerprint);
      expect(await repo.listDispositions()).toEqual([redecided]);
    });

    it('resolves when removing something that is not there', async () => {
      const { repo } = await make();
      await expect(repo.removeWorkItem('wi-9')).resolves.toBeUndefined();
      await expect(repo.removeRule('AR-009')).resolves.toBeUndefined();
      await expect(repo.removeDisposition(decision('src/none.ts').fingerprint)).resolves.toBeUndefined();
    });

    it('allocates wi-N and AR-NNN in sequence once read (Y10)', async () => {
      const { repo } = await make();
      await repo.listWorkItems();
      expect([repo.allocateId('workItem'), repo.allocateId('workItem'), repo.allocateId('rule')]).toEqual(['wi-1', 'wi-2', 'AR-001']);
    });

    it('never allocates an id a stored record has, a saved one raised, or a removed one had (Y10)', async () => {
      const { repo } = await make();
      await repo.saveWorkItem(item('wi-7'));
      await repo.saveRule(rule('AR-012'));
      await repo.listWorkItems();
      expect(repo.allocateId('workItem')).toBe('wi-8');
      expect(repo.allocateId('rule')).toBe('AR-013');
      await repo.saveWorkItem(item('wi-20'));
      expect(repo.allocateId('workItem')).toBe('wi-21');
      await repo.removeWorkItem('wi-20');
      await repo.removeWorkItem('wi-7');
      await repo.listWorkItems();
      expect(repo.allocateId('workItem')).toBe('wi-22');
    });

    it('tells subscribers once after each successful write, before it resolves, and never on a read (Y12)', async () => {
      const { repo } = await make();
      const events: string[] = [];
      const off = repo.subscribe(() => { events.push('notified'); });
      await repo.listWorkItems();
      expect(events).toEqual([]);
      await repo.saveWorkItem(item('wi-1')).then(() => { events.push('saved'); });
      await repo.saveRule(rule('AR-001'));
      await repo.saveDisposition(decision('src/a.ts'));
      await repo.removeWorkItem('wi-1');
      await repo.removeRule('AR-001');
      await repo.removeDisposition(decision('src/a.ts').fingerprint);
      expect(events).toEqual(['notified', 'saved', 'notified', 'notified', 'notified', 'notified', 'notified']);
      off();
      await repo.saveWorkItem(item('wi-2'));
      expect(events).toHaveLength(7);
    });

    it('replaceAll swaps everything at once, tells subscribers once, and raises the marks from the ids it is given (R1)', async () => {
      const { repo } = await make();
      await repo.saveWorkItem(item('wi-1'));
      await repo.saveRule(rule('AR-001'));
      await repo.saveDisposition(decision('src/a.ts'));
      const events: string[] = [];
      repo.subscribe(() => { events.push('notified'); });
      const state = { workItems: [item('wi-12')], rules: [rule('AR-007')], dispositions: [decision('src/b.ts')] };
      await repo.replaceAll(state).then(() => { events.push('replaced'); });
      expect(events).toEqual(['notified', 'replaced']);
      expect(await repo.listWorkItems()).toEqual(state.workItems);
      expect(await repo.listRules()).toEqual(state.rules);
      expect(await repo.listDispositions()).toEqual(state.dispositions);
      expect([repo.allocateId('workItem'), repo.allocateId('rule')]).toEqual(['wi-13', 'AR-008']);
    });

    it('replaceAll with empty lists clears, and never lowers the marks (R1)', async () => {
      const { repo } = await make();
      await repo.saveWorkItem(item('wi-5'));
      await repo.saveRule(rule('AR-003'));
      await repo.replaceAll({ workItems: [], rules: [], dispositions: [] });
      expect(await repo.listWorkItems()).toEqual([]);
      expect(await repo.listRules()).toEqual([]);
      expect(await repo.listDispositions()).toEqual([]);
      expect([repo.allocateId('workItem'), repo.allocateId('rule')]).toEqual(['wi-6', 'AR-004']);
    });

    it('reports clean diagnostics for clean data (Y7)', async () => {
      const { repo } = await make();
      await repo.saveWorkItem(item('wi-1'));
      await repo.listWorkItems();
      expect(repo.diagnostics()).toEqual({ skipped: 0, unsupported: false });
    });
  });
}

interface Doc { reviews?: Record<string, Record<string, unknown>>; [key: string]: unknown }
const setIn = async (h: ReviewRepositoryHarness): Promise<Record<string, unknown>> =>
  ((await h.readRaw()) as Doc).reviews![CONTRACT_REPO]!;
/** A data.json holding `set` for the contract codebase, next to data this adapter must never touch. */
const docWith = (set: unknown): unknown => ({
  profiles: [{ profileId: 'kept' }], reviews: { [CONTRACT_REPO]: set, other: { v: 1, workItems: ['untouched'] } },
});

/** The write rejects with a ReviewStoreError of `code`, data.json is unchanged, and nobody was told. */
async function expectRefused(h: ReviewRepositoryHarness, write: () => Promise<void>, code: string): Promise<void> {
  const before = await h.readRaw();
  const events: number[] = [];
  const off = h.repo.subscribe(() => { events.push(1); });
  const error: unknown = await write().then(() => null, (e: unknown) => e);
  off();
  expect(error).toBeInstanceOf(ReviewStoreError);
  expect((error as ReviewStoreError).code).toBe(code);
  expect(await h.readRaw()).toEqual(before);
  expect(events).toEqual([]);
}

export function runDurableReviewRepositoryContract(name: string, make: () => Promise<ReviewRepositoryHarness>): void {
  describe(`ReviewRepository durable contract: ${name}`, () => {
    it('keeps everything across a reopen, in path form: no raw entity id, NUL or repository id in the set (Y5, Y6)', async () => {
      const h = await make();
      const dismissed: FindingDisposition = { ...decision('src/a.ts'), status: 'dismissed', reason: 'Generated' };
      await h.repo.saveWorkItem(item('wi-1'));
      await h.repo.saveRule(rule('AR-001'));
      await h.repo.saveDisposition(dismissed);
      const again = h.reopen();
      expect(await again.listWorkItems()).toEqual([item('wi-1')]);
      expect(await again.listRules()).toEqual([rule('AR-001')]);
      expect(await again.listDispositions()).toEqual([dismissed]);
      const set = await setIn(h);
      expect(set).toEqual({
        v: 1, workItems: [stored('wi-1')], rules: [rule('AR-001')],
        dispositions: [{ finding: 'src/a.ts#CX-1', status: 'dismissed', reason: 'Generated', decidedAt: AT }],
        highWater: { workItem: 1, rule: 1 },
      });
      const text = JSON.stringify(set);
      expect(text).not.toContain(NUL);
      expect(text).not.toContain(CONTRACT_REPO);
    });

    it('keeps the high-water mark on disk across removal and reopen, and never lowers it (Y10)', async () => {
      const h = await make();
      await h.repo.listWorkItems();
      const first = item(h.repo.allocateId('workItem'));
      const second = item(h.repo.allocateId('workItem'));
      await h.repo.saveWorkItem(first);
      await h.repo.saveWorkItem(second);
      await h.repo.removeWorkItem(second.id);
      expect((await setIn(h)).highWater).toEqual({ workItem: 2, rule: 0 });
      const again = h.reopen();
      await again.listWorkItems();
      expect(again.allocateId('workItem')).toBe('wi-3');
    });

    it('continues after a stored mark higher than any record (Y10)', async () => {
      const h = await make();
      await h.writeRaw(docWith({ v: 1, workItems: [], rules: [], dispositions: [], highWater: { workItem: 40, rule: 7 } }));
      await h.repo.listRules();
      expect([h.repo.allocateId('workItem'), h.repo.allocateId('rule')]).toEqual(['wi-41', 'AR-008']);
    });

    it('refuses to allocate before its first read, rather than hand out an id already on disk (Y10, R9)', async () => {
      const h = await make();
      await h.writeRaw(docWith({ v: 1, workItems: [stored('wi-1')], rules: [], dispositions: [] }));
      const fresh = h.reopen();
      expect(() => fresh.allocateId('workItem')).toThrow();
      await fresh.listWorkItems();
      expect(fresh.allocateId('workItem')).toBe('wi-2');
    });

    it('skips an invalid record but keeps it on disk, and never reuses its id (Y7)', async () => {
      const h = await make();
      const invalid = [stored('wi-5', { owner: 'x' }), 'garbage'];
      const badRule = { id: 'AR-1', from: 'a', to: 'b', rationale: 'r', createdAt: AT };
      const badDecision = { finding: '../x.ts#CX-1', status: 'acknowledged', decidedAt: AT };
      await h.writeRaw(docWith({ v: 1, workItems: [stored('wi-1'), ...invalid], rules: [badRule], dispositions: [badDecision] }));
      expect(await h.repo.listWorkItems()).toEqual([item('wi-1')]);
      expect(await h.repo.listRules()).toEqual([]);
      expect(await h.repo.listDispositions()).toEqual([]);
      expect(h.repo.diagnostics()).toEqual({ skipped: 4, unsupported: false });
      const next = h.repo.allocateId('workItem');
      expect(next).toBe('wi-6');
      await h.repo.saveWorkItem(item(next));
      await h.repo.removeWorkItem('wi-1');
      const set = await setIn(h);
      expect(set.workItems).toEqual([...invalid, stored('wi-6')]);
      expect(set.rules).toEqual([badRule]);
      expect(set.dispositions).toEqual([badDecision]);
      expect(h.repo.diagnostics()).toEqual({ skipped: 4, unsupported: false });
    });

    it('lists the first of two records with one id, and a write to that id leaves one (Y7)', async () => {
      const h = await make();
      await h.writeRaw(docWith({ v: 1, workItems: [stored('wi-1'), stored('wi-1', { title: 'Second' })], rules: [], dispositions: [] }));
      expect(await h.repo.listWorkItems()).toEqual([item('wi-1')]);
      expect(h.repo.diagnostics().skipped).toBe(1);
      await h.repo.saveWorkItem(item('wi-1', { title: 'Renamed' }));
      expect((await setIn(h)).workItems).toEqual([stored('wi-1', { title: 'Renamed' })]);
    });

    it.each<[string, unknown]>([
      ['a newer version', { v: 2, workItems: [stored('wi-1')] }],
      ['a set that is not an object', 'text'],
      ['a set that is a list', [stored('wi-1')]],
      ['a v1 set whose lists are not lists', { v: 1, workItems: 'nope' }],
    ])('reads %s as empty and read-only, and never overwrites it (Y7)', async (_name, set) => {
      const h = await make();
      await h.writeRaw(docWith(set));
      expect(await h.repo.listWorkItems()).toEqual([]);
      expect(h.repo.diagnostics()).toEqual({ skipped: 0, unsupported: true });
      await expectRefused(h, () => h.repo.saveWorkItem(item('wi-1')), 'unsupported');
      await expectRefused(h, () => h.repo.removeWorkItem('wi-1'), 'unsupported');
      await expectRefused(h, () => h.repo.replaceAll({ workItems: [], rules: [], dispositions: [] }), 'unsupported');
    });

    it('treats a reviews value that is not an object as read-only for every codebase (Y7)', async () => {
      const h = await make();
      await h.writeRaw({ reviews: ['not', 'an', 'object'] });
      expect(await h.repo.listRules()).toEqual([]);
      expect(h.repo.diagnostics().unsupported).toBe(true);
      await expectRefused(h, () => h.repo.saveRule(rule('AR-001')), 'unsupported');
    });

    it('refuses a save that would take the set over 1 MB, writing nothing; a removal is never refused (Y9)', async () => {
      const h = await make();
      const notes = 'n'.repeat(4000);
      const workItems: unknown[] = [];
      for (let n = 1, size = 0; size <= REVIEW_STORE_MAX_BYTES; n += 1) {
        const entry = stored(`wi-${n}`, { notes });
        workItems.push(entry);
        size += JSON.stringify(entry).length + 1;
      }
      await h.writeRaw(docWith({ v: 1, workItems, rules: [], dispositions: [] }));
      await h.repo.listWorkItems();
      await expectRefused(h, () => h.repo.saveRule(rule('AR-001')), 'full');
      await h.repo.removeWorkItem('wi-1');
      expect((await setIn(h)).workItems).toHaveLength(workItems.length - 1);
    });

    it.each<[string, (repo: ReviewRepository) => Promise<void>]>([
      ['a file target of another codebase', (r) => r.saveWorkItem(item('wi-1', { target: { kind: 'file', entityId: fileId('src/a.ts', 'repo-other') } }))],
      ['a target that is not an entity id', (r) => r.saveWorkItem(item('wi-1', { target: { kind: 'file', entityId: 'src/a.ts' } }))],
      ['a directory target', (r) => r.saveWorkItem(item('wi-1', { target: { kind: 'file', entityId: makeEntityId(CONTRACT_REPO, 'directory', 'src') } }))],
      ['a work item id a read would refuse', (r) => r.saveWorkItem(item('wi-1234567'))],
      ['a rule id a read would refuse', (r) => r.saveRule(rule('AR-1'))],
      ['a decision without "#"', (r) => r.saveDisposition({ ...decision('src/a.ts'), fingerprint: fileId('src/a.ts') })],
      ['a decision of another codebase', (r) => r.saveDisposition({ ...decision('src/a.ts'), fingerprint: `${fileId('src/a.ts', 'repo-other')}#CX-1` })],
    ])('refuses %s as unrepresentable, writing nothing (Y6)', async (_name, save) => {
      const h = await make();
      await h.repo.saveWorkItem(item('wi-9'));
      await expectRefused(h, () => save(h.repo), 'unrepresentable');
    });

    it('writes only its own codebase and leaves every other data.json key as it was (Y8)', async () => {
      const h = await make();
      await h.writeRaw(docWith({ v: 1, workItems: [], rules: [], dispositions: [] }));
      await h.repo.saveWorkItem(item('wi-1'));
      await h.repo.removeRule('AR-001');
      const doc = (await h.readRaw()) as Doc;
      expect(doc.profiles).toEqual([{ profileId: 'kept' }]);
      expect(doc.reviews!.other).toEqual({ v: 1, workItems: ['untouched'] });
    });

    it('replaceAll replaces the whole set in ONE write, skipped records and unknown keys included, keeping the higher mark (R1)', async () => {
      const h = await make();
      await h.writeRaw(docWith({
        v: 1, workItems: [stored('wi-1'), stored('wi-9', { owner: 'x' })], rules: [], dispositions: ['garbage'],
        extra: true, highWater: { workItem: 40, rule: 2 },
      }));
      await h.repo.listWorkItems();
      const before = h.writes();
      await h.repo.replaceAll({ workItems: [item('wi-3')], rules: [rule('AR-050')], dispositions: [] });
      expect(h.writes() - before).toBe(1);
      expect(await setIn(h)).toEqual({
        v: 1, workItems: [stored('wi-3')], rules: [rule('AR-050')], dispositions: [], highWater: { workItem: 40, rule: 50 },
      });
      expect(h.repo.diagnostics()).toEqual({ skipped: 0, unsupported: false });
      expect(((await h.readRaw()) as Doc).reviews!.other).toEqual({ v: 1, workItems: ['untouched'] });
      const again = h.reopen();
      await again.listWorkItems();
      expect(again.allocateId('workItem')).toBe('wi-41');
    });

    it('replaceAll writes nothing when any one record is unrepresentable, or the result is over 1 MB (R1)', async () => {
      const h = await make();
      await h.repo.saveWorkItem(item('wi-1'));
      const foreign = item('wi-2', { target: { kind: 'file', entityId: fileId('src/a.ts', 'repo-other') } });
      await expectRefused(h, () => h.repo.replaceAll({ workItems: [item('wi-3'), foreign], rules: [], dispositions: [] }), 'unrepresentable');
      const badDecision = { ...decision('src/a.ts'), fingerprint: 'no-hash' };
      await expectRefused(h, () => h.repo.replaceAll({ workItems: [], rules: [], dispositions: [badDecision] }), 'unrepresentable');
      const notes = 'n'.repeat(4000);
      const big = Array.from({ length: 260 }, (_, i) => item(`wi-${i + 10}`, { notes }));
      await expectRefused(h, () => h.repo.replaceAll({ workItems: big, rules: [], dispositions: [] }), 'full');
      expect(await h.repo.listWorkItems()).toEqual([item('wi-1')]);
    });
  });
}
```

  Create `tests/unit/review-repository.test.ts`:

```ts
// Part 6: the ReviewRepository contract against both adapters (ruling M24's pattern, as
// profile-store.test.ts). The durable half runs against the plugin-data adapter only: the
// in-memory adapter has no data.json to reopen, read, hand-edit or count saves of.
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import {
  CONTRACT_REPO, runDurableReviewRepositoryContract, runReviewRepositoryContract, type ReviewRepositoryHarness,
} from '../contracts/review-repository.contract';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { createPluginDataReviewRepository } from '../../src/adapters/storage/plugin-data-review-repository';

const notDurable = (): Promise<never> => Promise.reject(new Error('The in-memory adapter has no data.json.'));
const noWrites = (): number => 0;

function inMemoryHarness(): ReviewRepositoryHarness {
  const repo = createInMemoryReviewRepository();
  return { repo, reopen: () => repo, writeRaw: notDurable, readRaw: notDurable, writes: noWrites };
}

function pluginDataHarness(): ReviewRepositoryHarness {
  // One cast at the boundary, as profile-store.test.ts: the mock implements loadData/saveData only.
  const plugin = new Plugin({}, {}) as unknown as ObsidianPlugin;
  const save = plugin.saveData.bind(plugin);
  let writes = 0;
  // Counts the adapter's own saves; writeRaw uses `save` directly, so it does not count.
  plugin.saveData = (data: unknown): Promise<void> => {
    writes += 1;
    return save(data);
  };
  return {
    repo: createPluginDataReviewRepository(plugin, CONTRACT_REPO),
    reopen: () => createPluginDataReviewRepository(plugin, CONTRACT_REPO),
    writeRaw: (doc) => save(doc),
    readRaw: () => plugin.loadData() as Promise<unknown>,
    writes: () => writes,
  };
}

runReviewRepositoryContract('in-memory', () => Promise.resolve(inMemoryHarness()));
runReviewRepositoryContract('plugin data.json', () => Promise.resolve(pluginDataHarness()));
runDurableReviewRepositoryContract('plugin data.json', () => Promise.resolve(pluginDataHarness()));
```

- [ ] **Step 2: Write the failing registry and codec tests.** Create `tests/unit/review-repository-registry.test.ts`:

```ts
// Part 6 Y11/Y14/Y17: one durable review repository per codebase per plugin, and the purge
// that takes a removed profile's saved review state with it.
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { createReviewRepositoryRegistry } from '../../src/adapters/storage/review-repository-registry';
import { ReviewStoreError } from '../../src/adapters/storage/plugin-data-review-repository';
import type { BoundaryRule } from '../../src/ui/stores/ports/review-repository';

const AT = '2026-09-23T10:00:00.000Z';
const rule = (id: string, to: string): BoundaryRule => ({ id, from: 'ui', to, rationale: 'Layering', createdAt: AT });
const newPlugin = (): ObsidianPlugin => new Plugin({}, {}) as unknown as ObsidianPlugin;
const readDoc = (plugin: ObsidianPlugin): Promise<unknown> => plugin.loadData() as Promise<unknown>;

describe('review repository registry (Part 6 Y11, Y14)', () => {
  it('returns one instance per codebase, so every user shares one id sequence', async () => {
    const registry = createReviewRepositoryRegistry(newPlugin());
    expect(registry.for('p1')).toBe(registry.for('p1'));
    expect(registry.for('p1')).not.toBe(registry.for('p2'));
    await registry.for('p1').listRules();
    expect(registry.for('p1').allocateId('rule')).toBe('AR-001');
    expect(registry.for('p1').allocateId('rule')).toBe('AR-002');
  });

  it('never persists the unbound bucket', async () => {
    const plugin = newPlugin();
    await createReviewRepositoryRegistry(plugin).for('').saveRule(rule('AR-001', 'domain'));
    expect(await readDoc(plugin)).toBeNull();
  });
});

describe('review repository registry: purge (Part 6 Y17)', () => {
  it('deletes only that codebase\'s set, after any write already queued, and leaves every other key as it was', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ profiles: [{ profileId: 'p2' }], reviews: { p1: { v: 1 }, p2: { v: 1, rules: [] } } });
    const registry = createReviewRepositoryRegistry(plugin);
    await registry.for('p1').saveRule(rule('AR-001', 'domain'));
    const queued = registry.for('p1').saveRule(rule('AR-002', 'host'));
    await registry.purge('p1');
    await queued;
    expect(await readDoc(plugin)).toEqual({ profiles: [{ profileId: 'p2' }], reviews: { p2: { v: 1, rules: [] } } });
  });

  it('retires the old instance: a leaf still bound to the removed codebase cannot recreate it, and reloads empty', async () => {
    const plugin = newPlugin();
    const registry = createReviewRepositoryRegistry(plugin);
    const old = registry.for('p1');
    await old.saveRule(rule('AR-001', 'domain'));
    const reloaded: number[] = [];
    old.subscribe(() => { void old.listRules().then((rules) => { reloaded.push(rules.length); }); });
    await registry.purge('p1');
    await flushPromises();
    expect(reloaded).toEqual([0]);
    const refused: unknown = await old.saveRule(rule('AR-002', 'host')).then(() => null, (e: unknown) => e);
    expect(refused).toBeInstanceOf(ReviewStoreError);
    expect((refused as ReviewStoreError).code).toBe('unsupported');
    expect(await readDoc(plugin)).toEqual({ reviews: {} });
    const fresh = registry.for('p1');
    expect(fresh).not.toBe(old);
    await fresh.saveRule(rule('AR-001', 'domain'));
    expect(await fresh.listRules()).toEqual([rule('AR-001', 'domain')]);
  });

  it('leaves a reviews value it cannot read untouched, and resolves when there is nothing to purge', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ reviews: 'not an object' });
    await createReviewRepositoryRegistry(plugin).purge('p1');
    expect(await readDoc(plugin)).toEqual({ reviews: 'not an object' });
    const empty = newPlugin();
    await createReviewRepositoryRegistry(empty).purge('p1');
    expect(await readDoc(empty)).toEqual({});
  });
});
```

  Create `tests/unit/review-record-codec.test.ts`:

```ts
// Part 6 Y6/Y7: the stored form is the Part 5 v2 export's own path form, and a read
// validates each record with the import's own schemas.
import { describe, expect, it } from 'vitest';
import { makeEntityId } from '../../src/domain/entity-id';
import type { BoundaryRule, FindingDisposition, WorkItem } from '../../src/ui/stores/ports/review-repository';
import { reviewStateJson } from '../../src/ui/read-models/review-state';
import { decodeRecords, encodeDisposition, encodeRule, encodeWorkItem } from '../../src/ui/read-models/review-record-codec';

const REPO = 'repo-codec';
const AT = '2026-09-23T10:00:00.000Z';
const fileId = (path: string, repositoryId = REPO): string => makeEntityId(repositoryId, 'file', path);
const ITEM: WorkItem = {
  id: 'wi-3', target: { kind: 'file', entityId: fileId('src/a.ts') }, intent: 'tests', title: 'Cover the parser',
  status: 'planned', priority: 'high', notes: 'Edge cases.', checks: [true, false, false], createdAt: AT, updatedAt: AT,
};
const RULE: BoundaryRule = { id: 'AR-004', from: 'ui', to: 'domain', rationale: 'Layering', createdAt: AT };
const DECISION: FindingDisposition = { fingerprint: `${fileId('src/a.ts')}#UN-0a1b2c3d`, status: 'dismissed', reason: 'Public API', decidedAt: AT };
const SECTIONS = { summary: true, architecture: true, hotspots: true, security: true, plan: true };

describe('review record codec (Part 6 Y6, Y7)', () => {
  it('writes exactly what the v2 export writes for the same records', () => {
    const exported = JSON.parse(reviewStateJson({
      workItems: [ITEM], rules: [RULE], dispositions: [DECISION], report: { sections: SECTIONS, note: '' },
      exportedAt: new Date(AT), source: null,
    })) as { workItems: unknown[]; rules: unknown[]; dispositions: unknown[] };
    expect(encodeWorkItem(ITEM, REPO)).toEqual(exported.workItems[0]);
    expect(encodeRule(RULE)).toEqual(exported.rules[0]);
    expect(encodeDisposition(DECISION, REPO)).toEqual(exported.dispositions[0]);
  });

  it('reads back what it writes', () => {
    const decoded = decodeRecords({
      workItems: [encodeWorkItem(ITEM, REPO)], rules: [encodeRule(RULE)], dispositions: [encodeDisposition(DECISION, REPO)],
    }, REPO);
    expect(decoded).toEqual({ workItems: [ITEM], rules: [RULE], dispositions: [DECISION], skipped: 0 });
  });

  it.each<[string, () => unknown]>([
    ['a file target of another codebase', () => encodeWorkItem({ ...ITEM, target: { kind: 'file', entityId: fileId('src/a.ts', 'repo-other') } }, REPO)],
    ['a target that is not an entity id', () => encodeWorkItem({ ...ITEM, target: { kind: 'file', entityId: 'src/a.ts' } }, REPO)],
    ['a directory target', () => encodeWorkItem({ ...ITEM, target: { kind: 'file', entityId: makeEntityId(REPO, 'directory', 'src') } }, REPO)],
    ['a work item id the read would refuse', () => encodeWorkItem({ ...ITEM, id: 'wi-1234567' }, REPO)],
    ['a rule id the read would refuse', () => encodeRule({ ...RULE, id: 'AR-1' })],
    ['a decision without "#"', () => encodeDisposition({ ...DECISION, fingerprint: fileId('src/a.ts') }, REPO)],
    ['a decision of another codebase', () => encodeDisposition({ ...DECISION, fingerprint: `${fileId('src/a.ts', 'repo-other')}#UN-1` }, REPO)],
    ['a decision whose finding id the read would refuse', () => encodeDisposition({ ...DECISION, fingerprint: `${fileId('src/a.ts')}#UN 1` }, REPO)],
  ])('refuses (null) %s', (_name, encode) => {
    expect(encode()).toBeNull();
  });

  it('skips and counts what a read cannot use: invalid, repeated, or not a record; a missing list reads as empty', () => {
    const stored = encodeWorkItem(ITEM, REPO)!;
    const decoded = decodeRecords({
      workItems: [stored, { ...stored, title: '   ' }, stored, { ...stored, id: 'wi-4' }, 7],
      rules: 'not a list',
      dispositions: [{ ...encodeDisposition(DECISION, REPO)!, finding: '/etc/passwd#UN-1' }],
    }, REPO);
    expect(decoded).toEqual({ workItems: [ITEM], rules: [], dispositions: [], skipped: 5 });
    expect(decodeRecords(null, REPO)).toEqual({ workItems: [], rules: [], dispositions: [], skipped: 0 });
  });
});
```

- [ ] **Step 3: Run them and confirm they fail.** `npx vitest run tests/unit/review-repository.test.ts tests/unit/review-repository-registry.test.ts tests/unit/review-record-codec.test.ts`. Expected: FAIL — all three files fail to load: `review-repository` and `review-repository-registry` with `Failed to resolve import "../../src/adapters/storage/plugin-data-review-repository"` (the contract and the registry test import it), `review-record-codec` with `Failed to resolve import "../../src/ui/read-models/review-record-codec"`.

- [ ] **Step 4: Extract the export's per-record converters.** In `src/ui/read-models/review-state.ts`:

  (a) Replace:

```ts
function skippedWarnings(items: number, decisions: number): string[] {
```

  with:

```ts
/** V12 / Part 6 Y6: one work item in path form, or null when its file target does not
 *  parse. Shared by the export below and the durable codec (review-record-codec.ts). */
export function exportedWorkItem(w: WorkItem): Record<string, unknown> | null {
  const target = exportedTarget(w.target);
  return target === null ? null : {
    id: w.id, target, intent: w.intent, title: w.title, status: w.status,
    priority: w.priority, notes: w.notes, checks: [...w.checks], createdAt: w.createdAt,
    ...(w.updatedAt !== undefined ? { updatedAt: w.updatedAt } : {}),
  };
}

export function exportedRule(r: BoundaryRule): Record<string, unknown> {
  return { id: r.id, from: r.from, to: r.to, rationale: r.rationale, createdAt: r.createdAt };
}

/** V12 / Part 6 Y6: one decision in path form, or null when its fingerprint does not convert. */
export function exportedDisposition(d: FindingDisposition): Record<string, unknown> | null {
  const finding = findingRef(d.fingerprint);
  return finding === null ? null : {
    finding, status: d.status, ...(d.reason !== undefined ? { reason: d.reason } : {}), decidedAt: d.decidedAt,
  };
}

/** The entries a converter could write; the caller counts the rest in `warnings`. */
function writable<T>(entries: readonly T[], convert: (entry: T) => Record<string, unknown> | null): Record<string, unknown>[] {
  return entries.flatMap((entry) => {
    const out = convert(entry);
    return out === null ? [] : [out];
  });
}

function skippedWarnings(items: number, decisions: number): string[] {
```

  (b) Replace:

```ts
  const workItems = input.workItems.flatMap((w) => {
    const target = exportedTarget(w.target);
    return target === null ? [] : [{
      id: w.id, target, intent: w.intent, title: w.title, status: w.status,
      priority: w.priority, notes: w.notes, checks: [...w.checks], createdAt: w.createdAt,
      ...(w.updatedAt !== undefined ? { updatedAt: w.updatedAt } : {}),
    }];
  });
  const dispositions = input.dispositions.flatMap((d) => {
    const finding = findingRef(d.fingerprint);
    return finding === null ? [] : [{
      finding, status: d.status, ...(d.reason !== undefined ? { reason: d.reason } : {}), decidedAt: d.decidedAt,
    }];
  });
```

  with:

```ts
  const workItems = writable(input.workItems, exportedWorkItem);
  const dispositions = writable(input.dispositions, exportedDisposition);
```

  (c) Replace:

```ts
    rules: input.rules.map((r) => ({ id: r.id, from: r.from, to: r.to, rationale: r.rationale, createdAt: r.createdAt })),
```

  with:

```ts
    rules: input.rules.map((r) => exportedRule(r)),
```

  Key order in each object is unchanged, so `reviewStateJson` writes the same bytes (`tests/unit/review-state.test.ts` proves it in Step 10).

- [ ] **Step 5: Export the import's record schemas and converters.** In `src/ui/read-models/review-state-import.ts`:

  (a) Replace `const WORK_ITEM = z.object({` with:

```ts
/** Part 6 Y7: the three record schemas are exported for the durable codec
 *  (review-record-codec.ts), which validates every stored record with them. The list
 *  rules (caps, duplicates) stay here, with the import. */
export const WORK_ITEM = z.object({
```

  (b) Replace `const RULE = z.object({` with `export const RULE = z.object({`.

  (c) Replace `const DISPOSITION = z.object({` with `export const DISPOSITION = z.object({`.

  (d) Replace:

```ts
function toTarget(t: ImportedTarget, fileId: (path: string) => string): WorkTarget {
  if (t.kind === 'file') return { kind: 'file', entityId: fileId(t.path) };
  return t.kind === 'package' ? { kind: 'package', name: t.name } : { kind: 'module', module: t.module };
}

/** V16: paths become entity ids of the codebase on screen; findings become `<that id>#<findingId>`. */
function toState(data: Parsed, repositoryId: string, origin: { folder: string } | null): ImportedReviewState {
  const fileId = (path: string): string => makeEntityId(repositoryId, 'file', path);
  return {
    workItems: data.workItems.map((w): WorkItem => ({
      id: w.id, target: toTarget(w.target, fileId), intent: w.intent, title: w.title.trim(), status: w.status,
      priority: w.priority, notes: w.notes, checks: [w.checks[0], w.checks[1], w.checks[2]], createdAt: w.createdAt,
      ...(w.updatedAt !== undefined ? { updatedAt: w.updatedAt } : {}),
    })),
    rules: data.rules.map((r): BoundaryRule => ({ id: r.id, from: r.from, to: r.to, rationale: r.rationale.trim(), createdAt: r.createdAt })),
    dispositions: data.dispositions.flatMap((d): FindingDisposition[] => {
      const ref = splitFinding(d.finding);
      return ref === null ? [] : [{
        fingerprint: `${fileId(ref.path)}#${ref.findingId}`, status: d.status,
        ...(d.reason !== undefined ? { reason: d.reason.trim() } : {}), decidedAt: d.decidedAt,
      }];
    }),
    report: { sections: { ...data.report.sections }, note: data.report.note },
    origin,
  };
}
```

  with:

```ts
function toTarget(t: ImportedTarget, repositoryId: string): WorkTarget {
  if (t.kind === 'file') return { kind: 'file', entityId: makeEntityId(repositoryId, 'file', t.path) };
  return t.kind === 'package' ? { kind: 'package', name: t.name } : { kind: 'module', module: t.module };
}

/** V16 / Part 6 Y7: one validated work item in the store's shape, its file path an entity
 *  id of `repositoryId`. Shared by `toState` and the durable codec (review-record-codec.ts). */
export function toWorkItem(w: z.output<typeof WORK_ITEM>, repositoryId: string): WorkItem {
  return {
    id: w.id, target: toTarget(w.target, repositoryId), intent: w.intent, title: w.title.trim(), status: w.status,
    priority: w.priority, notes: w.notes, checks: [w.checks[0], w.checks[1], w.checks[2]], createdAt: w.createdAt,
    ...(w.updatedAt !== undefined ? { updatedAt: w.updatedAt } : {}),
  };
}

export function toRule(r: z.output<typeof RULE>): BoundaryRule {
  return { id: r.id, from: r.from, to: r.to, rationale: r.rationale.trim(), createdAt: r.createdAt };
}

/** A decision's `<path>#<findingId>` becomes `<entity id of that path>#<findingId>`. */
export function toDisposition(d: z.output<typeof DISPOSITION>, repositoryId: string): FindingDisposition | null {
  const ref = splitFinding(d.finding);
  return ref === null ? null : {
    fingerprint: `${makeEntityId(repositoryId, 'file', ref.path)}#${ref.findingId}`, status: d.status,
    ...(d.reason !== undefined ? { reason: d.reason.trim() } : {}), decidedAt: d.decidedAt,
  };
}

/** V16: paths become entity ids of the codebase on screen; findings become `<that id>#<findingId>`. */
function toState(data: Parsed, repositoryId: string, origin: { folder: string } | null): ImportedReviewState {
  return {
    workItems: data.workItems.map((w) => toWorkItem(w, repositoryId)),
    rules: data.rules.map((r) => toRule(r)),
    dispositions: data.dispositions.flatMap((d) => {
      const decision = toDisposition(d, repositoryId);
      return decision === null ? [] : [decision];
    }),
    report: { sections: { ...data.report.sections }, note: data.report.note },
    origin,
  };
}
```

- [ ] **Step 6: Storage copy.** Create `src/ui/audit-copy/storage.ts`:

```ts
// Part 6 Y6–Y9: the durable review store's refusals (the ReviewStoreError messages; the
// review store's existing failure paths announce their own *_FAILED copy, spec §4, and R9
// leaves the codes unmapped by screens in Part 6) and Y7's Settings › Privacy & storage
// line. Re-exported by inspector-copy.ts.
function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
/** Y9: a save that would take one codebase's saved review state over 1 MB. */
export const REVIEW_STORE_FULL = 'The saved review state for this codebase has reached its 1 MB limit, so this change was not saved. Remove work items or decisions, or export the review state and clear it.';
/** Y7: a saved set in a format this version cannot change. It is never overwritten. */
export const REVIEW_STORE_UNSUPPORTED = 'The saved review state for this codebase is in a format this version cannot change, so this change was not saved.';
/** Y6: a record whose file or finding cannot be saved as a path inside this codebase. */
export const REVIEW_SAVE_UNREPRESENTABLE = 'This change refers to something that cannot be saved as a path inside this codebase, so it was not saved.';
/** Y7: Settings › Privacy & storage, while n saved records could not be read. */
export const REVIEW_RECORDS_SKIPPED = (n: number): string =>
  `${plural(n, 'saved review record', 'saved review records')} could not be read, so ${n === 1 ? 'it is' : 'they are'} not shown. ${n === 1 ? 'It stays' : 'They stay'} in the plugin’s data file, unchanged.`;
/** Y7: Settings › Privacy & storage, while the saved set is read-only. */
export const REVIEW_STORE_UNSUPPORTED_NOTE = 'The saved review state for this codebase was written in a format this version cannot read. It is kept unchanged, the lists start empty, and changes to them cannot be saved.';
```

  In `src/ui/inspector-copy.ts`, replace `export * from './audit-copy/settings';` with the following (if Task 1 already added a `/** Part 6 … */` block after that line, add only the `storage` line inside it):

```ts
export * from './audit-copy/settings';

/** Part 6: durable review state. */
export * from './audit-copy/storage';
```

- [ ] **Step 7: The `reviews` key.** In `src/adapters/storage/plugin-data-shape.ts`, replace:

```ts
/** Obsidian gives a plugin exactly one JSON document (plugin.loadData()/saveData()),
 *  but spec 4.5 lists ProfileStore and LocalBindingStore as two separate application
 *  ports. Every read/write from either store goes through here. */
export interface PluginDataShape {
  profiles?: unknown;
  bindings?: unknown;
}
```

  with:

```ts
/** Obsidian gives a plugin exactly one JSON document (plugin.loadData()/saveData()),
 *  but spec 4.5 lists ProfileStore and LocalBindingStore as two separate application
 *  ports. Every read/write from either store goes through here. Part 6 Y5 (amending
 *  Part 4 W1) adds `reviews`, `{ [repositoryId]: record set }`, owned by the durable
 *  review adapter (plugin-data-review-repository.ts) and written under the same lock. */
export interface PluginDataShape {
  profiles?: unknown;
  bindings?: unknown;
  reviews?: unknown;
}
```

- [ ] **Step 8: The codec.** Create `src/ui/read-models/review-record-codec.ts`:

```ts
// Part 6 Y6/Y7: one review record ⇄ its stored form, for the durable adapter
// (src/adapters/storage/plugin-data-review-repository.ts). The stored form is the Part 5 v2
// export's PATH form: never a raw entity id, a NUL byte or the repository id.
// - out: the export's own converters (review-state.ts), which use the strict parseEntityId;
// - in: the import's own record schemas and converters (review-state-import.ts), which
//   build entity ids with makeEntityId.
// Every encoded record is checked with the schema a read uses, so whatever is written is
// read back. A record of another codebase, or of an entity that is not a file, cannot be
// stored: its path would read back as a file of THIS codebase.
import type { z } from 'zod';
import { parseEntityId } from '../../domain/entity-id';
import { workTargetKey, type BoundaryRule, type FindingDisposition, type WorkItem } from '../stores/ports/review-repository';
import { exportedDisposition, exportedRule, exportedWorkItem, findingRef } from './review-state';
import { DISPOSITION, RULE, WORK_ITEM, toDisposition, toRule, toWorkItem } from './review-state-import';

/** One record as stored in data.json: plain JSON. */
export type StoredRecord = Record<string, unknown>;
/** A read of one record set. `skipped` counts the entries it could not use (Y7). */
export interface DecodedRecords { workItems: WorkItem[]; rules: BoundaryRule[]; dispositions: FindingDisposition[]; skipped: number }

/** True for a FILE entity id of this codebase, by the strict parse. */
function ownFile(entityId: string, repositoryId: string): boolean {
  try {
    const parsed = parseEntityId(entityId);
    return parsed.repositoryId === repositoryId && parsed.kind === 'file';
  } catch {
    return false;
  }
}

const readable = (schema: z.ZodType, record: StoredRecord | null): StoredRecord | null =>
  record !== null && schema.safeParse(record).success ? record : null;

/** Y6: the stored form, or null when it cannot be stored (the save is refused). */
export function encodeWorkItem(item: WorkItem, repositoryId: string): StoredRecord | null {
  if (item.target.kind === 'file' && !ownFile(item.target.entityId, repositoryId)) return null;
  return readable(WORK_ITEM, exportedWorkItem(item));
}

export function encodeRule(rule: BoundaryRule): StoredRecord | null {
  return readable(RULE, exportedRule(rule));
}

/** Y6: a decision's stored key (`<path>#<findingId>`), or null for a fingerprint that is
 *  not a finding on a file of this codebase. A removal looks records up by it. */
export function storedFindingKey(fingerprint: string, repositoryId: string): string | null {
  const at = fingerprint.lastIndexOf('#');
  return at >= 0 && ownFile(fingerprint.slice(0, at), repositoryId) ? findingRef(fingerprint) : null;
}

export function encodeDisposition(decision: FindingDisposition, repositoryId: string): StoredRecord | null {
  if (storedFindingKey(decision.fingerprint, repositoryId) === null) return null;
  return readable(DISPOSITION, exportedDisposition(decision));
}

const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? (value as unknown[]) : []);

/** Y7: validates each entry. One that fails, or that repeats a key an earlier entry
 *  already has, is skipped and counted. Nothing here removes anything from disk. */
function decodeList<S, T>(
  entries: readonly unknown[], schema: z.ZodType<S>, convert: (stored: S) => T | null, keys: (record: T) => readonly string[],
): { records: T[]; skipped: number } {
  const seen = new Set<string>();
  const records: T[] = [];
  let skipped = 0;
  for (const entry of entries) {
    const parsed = schema.safeParse(entry);
    const record = parsed.success ? convert(parsed.data) : null;
    const recordKeys = record === null ? [] : keys(record);
    if (record === null || recordKeys.some((k) => seen.has(k))) {
      skipped += 1;
      continue;
    }
    for (const k of recordKeys) seen.add(k);
    records.push(record);
  }
  return { records, skipped };
}

/** Y7: one codebase's record set in the store's shapes, file paths as entity ids of
 *  `repositoryId`. Anything that is not a set reads as empty. */
export function decodeRecords(raw: unknown, repositoryId: string): DecodedRecords {
  const set: Record<string, unknown> = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const workItems = decodeList(listOf(set.workItems), WORK_ITEM, (w) => toWorkItem(w, repositoryId),
    (w) => [`id:${w.id}`, `key:${workTargetKey(w.target, w.intent)}`]);
  const rules = decodeList(listOf(set.rules), RULE, (r) => toRule(r), (r) => [`id:${r.id}`, `pair:${JSON.stringify([r.from, r.to])}`]);
  const dispositions = decodeList(listOf(set.dispositions), DISPOSITION, (d) => toDisposition(d, repositoryId), (d) => [d.fingerprint]);
  return {
    workItems: workItems.records, rules: rules.records, dispositions: dispositions.records,
    skipped: workItems.skipped + rules.skipped + dispositions.skipped,
  };
}
```

  If `vue-tsc` cannot infer `S` from `z.ZodType<S>` for these schemas, pass the type arguments explicitly (e.g. `decodeList<z.output<typeof WORK_ITEM>, WorkItem>(…)`) and report it.

- [ ] **Step 9: The adapter and the registry.** Create `src/adapters/storage/plugin-data-review-repository.ts`:

```ts
// Part 6 Y5–Y10, Y12, R1: the durable review adapter, behind the same ReviewRepository port
// as the in-memory one (tests/contracts/review-repository.contract.ts runs both). One
// instance per codebase per plugin: review-repository-registry.ts.
// - Y5/Y8: the record set is data.json `reviews[repositoryId]`. Every write is ONE
//   `writePluginDataSlice` (the plugin-wide data lock) and changes only this entry.
// - Y6: records are stored in PATH form (review-record-codec.ts). A record that cannot be
//   stored that way is refused ('unrepresentable') before anything is written.
// - Y7: every read validates each record; an invalid one is skipped and counted, never
//   dropped: a record write upserts or removes BY ID against the raw array and carries every
//   other raw entry over as it is. A set with `v !== 1`, or one that is not an object, is
//   read as empty, and every write to it is refused ('unsupported'): never overwritten.
// - R1: replaceAll is all or nothing — every record encodes, or nothing is written — and
//   replaces the WHOLE set (skipped records too) in one write.
// - Y9: a save or replaceAll that would take the set over 1 MB is refused ('full').
//   Removals never are.
// - Y10: ids come from a mark per kind that only ever rises. It absorbs the stored mark and
//   every raw id (valid or not) on each read and inside each write, and is written with
//   every write, so an id on disk is never handed out again, across leaves or restarts.
// - Y12: subscribers are told after each successful write, before the write resolves.
// Lists re-read data.json on every call (one read shared while it is in flight), so a
// change made outside the plugin shows on the next bind (Y19).
import type { Plugin } from 'obsidian';
import {
  formatReviewId, reviewIdSuffix, type ReviewIdKind, type ReviewRepository, type ReviewStorageDiagnostics,
} from '../../ui/stores/ports/review-repository';
import {
  decodeRecords, encodeDisposition, encodeRule, encodeWorkItem, storedFindingKey, type DecodedRecords, type StoredRecord,
} from '../../ui/read-models/review-record-codec';
import { REVIEW_SAVE_UNREPRESENTABLE, REVIEW_STORE_FULL, REVIEW_STORE_UNSUPPORTED } from '../../ui/inspector-copy';
import { asUnknownArray, isRecordWithField, readPluginData, writePluginDataSlice } from './plugin-data-shape';

/** Y9: per codebase, as the JSON.stringify length of its record set (the same limit as
 *  the review-state import's IMPORT_MAX_BYTES). */
export const REVIEW_STORE_MAX_BYTES = 1_000_000;

export type ReviewStoreErrorCode = 'full' | 'unsupported' | 'unrepresentable';
const ERROR_TEXT: Readonly<Record<ReviewStoreErrorCode, string>> = {
  full: REVIEW_STORE_FULL, unsupported: REVIEW_STORE_UNSUPPORTED, unrepresentable: REVIEW_SAVE_UNREPRESENTABLE,
};

/** A refused write: nothing was written and nobody was told. The review store's existing
 *  failure paths announce it with their own copy (spec §4). */
export class ReviewStoreError extends Error {
  readonly code: ReviewStoreErrorCode;

  constructor(code: ReviewStoreErrorCode) {
    super(ERROR_TEXT[code]);
    this.name = 'ReviewStoreError';
    this.code = code;
  }
}

/** The port plus the one member the registry's purge uses (Y17). */
export interface PluginDataReviewRepository extends ReviewRepository {
  /** From now on every write rejects ('unsupported'), so a leaf still bound to a removed
   *  profile can never recreate its set. Subscribers are told once, so they reload. */
  retire(): void;
}

type RawSet = Record<string, unknown>;
type ListKey = 'workItems' | 'rules' | 'dispositions';
const LIST_KEYS: readonly ListKey[] = ['workItems', 'rules', 'dispositions'];
const ID_KINDS: readonly ReviewIdKind[] = ['workItem', 'rule'];
const ID_PREFIX: Readonly<Record<ReviewIdKind, string>> = { workItem: 'wi-', rule: 'AR-' };
const ID_LIST: Readonly<Record<ReviewIdKind, ListKey>> = { workItem: 'workItems', rule: 'rules' };
const NOTHING: DecodedRecords = { workItems: [], rules: [], dispositions: [], skipped: 0 };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Y7: this codebase's set, or null when it is read-only. No `reviews` key, or no entry
 *  for this codebase, is an empty set that can be written. */
function recordSetOf(reviews: unknown, repositoryId: string): RawSet | null {
  if (reviews === undefined) return { v: 1 };
  if (!isPlainObject(reviews)) return null;
  const set = Object.prototype.hasOwnProperty.call(reviews, repositoryId) ? reviews[repositoryId] : undefined;
  if (set === undefined) return { v: 1 };
  if (!isPlainObject(set) || set.v !== 1) return null;
  return LIST_KEYS.every((key) => set[key] === undefined || Array.isArray(set[key])) ? set : null;
}

/** Y10: the stored mark for `kind`; 0 when it is absent or not a whole number. */
function storedMark(set: RawSet, kind: ReviewIdKind): number {
  const marks = set.highWater;
  const n = isPlainObject(marks) ? marks[kind] : undefined;
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : 0;
}

/** Y10: the highest id suffix in `kind`'s raw list, counting records a read skips. */
function highestRawId(set: RawSet, kind: ReviewIdKind): number {
  let max = 0;
  for (const entry of asUnknownArray(set[ID_LIST[kind]])) {
    const id = isPlainObject(entry) ? entry.id : undefined;
    const n = typeof id === 'string' && id.startsWith(ID_PREFIX[kind]) ? reviewIdSuffix(id) : null;
    if (n !== null && n > max) max = n;
  }
  return max;
}

/** Y7: replaces the first raw entry with this id in place and drops any later one with the
 *  same id, or appends. Every other entry, valid or not, is carried over as it is. */
function upsert(list: readonly unknown[], field: string, id: string, record: StoredRecord): unknown[] {
  const at = list.findIndex((entry) => isRecordWithField(entry, field, id));
  if (at < 0) return [...list, record];
  return list.flatMap((entry, index) => (index === at ? [record] : isRecordWithField(entry, field, id) ? [] : [entry]));
}

function without(list: readonly unknown[], field: string, id: string): unknown[] {
  return list.filter((entry) => !isRecordWithField(entry, field, id));
}

/** R1: every record's stored form, or null when any one of them cannot be stored. */
function allStored(records: readonly (StoredRecord | null)[]): StoredRecord[] | null {
  const out: StoredRecord[] = [];
  for (const record of records) {
    if (record === null) return null;
    out.push(record);
  }
  return out;
}

/** Y17: removes one codebase's set under the data lock. A `reviews` value that is not an
 *  object is left as it is: what cannot be read is never overwritten. The write is queued
 *  on the lock synchronously, before this returns (the registry's purge relies on it). */
export function deleteReviewSet(plugin: Plugin, repositoryId: string): Promise<void> {
  return writePluginDataSlice(plugin, 'reviews', (current) => (isPlainObject(current)
    ? Object.fromEntries(Object.entries(current).filter(([key]) => key !== repositoryId))
    : current));
}

export function createPluginDataReviewRepository(plugin: Plugin, repositoryId: string): PluginDataReviewRepository {
  const listeners = new Set<() => void>();
  /** Y10: per kind, the highest suffix handed out or seen on disk. Only ever raised. */
  const marks: Record<ReviewIdKind, number> = { workItem: 0, rule: 0 };
  /** Y10: true once a read or a write has absorbed the stored set into `marks`. */
  let seeded = false;
  let retired = false;
  let lastDiagnostics: ReviewStorageDiagnostics = { skipped: 0, unsupported: false };
  /** The set the last write saved; `diagnostics()` counts its skipped records on demand. */
  let lastWritten: RawSet | null = null;
  let reading: Promise<DecodedRecords> | null = null;

  function absorb(set: RawSet): void {
    for (const kind of ID_KINDS) marks[kind] = Math.max(marks[kind], storedMark(set, kind), highestRawId(set, kind));
    seeded = true;
  }

  function decodeRead(reviews: unknown): DecodedRecords {
    lastWritten = null;
    const set = recordSetOf(reviews, repositoryId);
    if (set === null) {
      seeded = true;
      lastDiagnostics = { skipped: 0, unsupported: true };
      return NOTHING;
    }
    absorb(set);
    const decoded = decodeRecords(set, repositoryId);
    lastDiagnostics = { skipped: decoded.skipped, unsupported: false };
    return decoded;
  }

  /** One data.json read, shared by every list call made while it is in flight (the
   *  store's load() lists all three at once). */
  function read(): Promise<DecodedRecords> {
    if (reading) return reading;
    const pending = readPluginData(plugin).then((data) => decodeRead(data.reviews));
    reading = pending;
    const settle = (): void => { if (reading === pending) reading = null; };
    void pending.then(settle, settle);
    return pending;
  }

  function notify(): void {
    for (const listener of [...listeners]) listener();
  }

  /** ONE slice write. `change` returns the lists it replaces. `whole` (replaceAll) starts
   *  from an empty set instead of the stored one, so skipped records and unknown keys go
   *  too; the stored mark is still absorbed first, so it is never lowered. */
  async function write(change: (set: RawSet) => RawSet, bounded: boolean, whole = false): Promise<void> {
    if (retired) throw new ReviewStoreError('unsupported');
    const saved: { set: RawSet | null } = { set: null };
    await writePluginDataSlice(plugin, 'reviews', (current) => {
      const set = recordSetOf(current, repositoryId);
      if (set === null) throw new ReviewStoreError('unsupported');
      absorb(set);
      const merged: RawSet = { workItems: [], rules: [], dispositions: [], ...(whole ? {} : set), v: 1, ...change(set) };
      absorb(merged);
      const previous = !whole && isPlainObject(set.highWater) ? set.highWater : {};
      const next: RawSet = { ...merged, highWater: { ...previous, workItem: marks.workItem, rule: marks.rule } };
      if (bounded && JSON.stringify(next).length > REVIEW_STORE_MAX_BYTES) throw new ReviewStoreError('full');
      saved.set = next;
      return { ...(isPlainObject(current) ? current : {}), [repositoryId]: next };
    });
    reading = null;
    lastWritten = saved.set;
    notify();
  }

  function writeList(key: ListKey, apply: (list: readonly unknown[]) => unknown[], bounded: boolean): Promise<void> {
    return write((set) => ({ [key]: apply(asUnknownArray(set[key])) }), bounded);
  }

  async function save(key: ListKey, record: StoredRecord | null, field: 'id' | 'finding'): Promise<void> {
    const id = record === null ? undefined : record[field];
    if (record === null || typeof id !== 'string') throw new ReviewStoreError('unrepresentable');
    await writeList(key, (list) => upsert(list, field, id, record), true);
  }

  return {
    listWorkItems: async () => (await read()).workItems.slice(),
    listRules: async () => (await read()).rules.slice(),
    listDispositions: async () => (await read()).dispositions.slice(),
    saveWorkItem: (item) => save('workItems', encodeWorkItem(item, repositoryId), 'id'),
    removeWorkItem: (id) => writeList('workItems', (list) => without(list, 'id', id), false),
    saveRule: (rule) => save('rules', encodeRule(rule), 'id'),
    removeRule: (id) => writeList('rules', (list) => without(list, 'id', id), false),
    saveDisposition: (decision) => save('dispositions', encodeDisposition(decision, repositoryId), 'finding'),
    async removeDisposition(fingerprint) {
      const key = storedFindingKey(fingerprint, repositoryId);
      // Y6: such a decision was never stored, so nothing on disk can match it.
      if (key !== null) await writeList('dispositions', (list) => without(list, 'finding', key), false);
    },
    async replaceAll(state) {
      const workItems = allStored(state.workItems.map((w) => encodeWorkItem(w, repositoryId)));
      const rules = allStored(state.rules.map((r) => encodeRule(r)));
      const dispositions = allStored(state.dispositions.map((d) => encodeDisposition(d, repositoryId)));
      // R1: all or nothing. One record that cannot be stored refuses the whole replacement.
      if (workItems === null || rules === null || dispositions === null) throw new ReviewStoreError('unrepresentable');
      await write(() => ({ workItems, rules, dispositions }), true, true);
    },
    allocateId(kind) {
      // R9: only this adapter throws here. Seeding from zero could hand out an id already on
      // disk, and saveWorkItem/saveRule are upserts: they cannot tell a new id from an edit,
      // so that save would overwrite a stored record. The review store adds nothing before
      // its first load (`ready`), so this only stops a caller that skips it.
      if (!seeded) throw new Error('allocateId was called before the first read of the stored review state.');
      marks[kind] += 1;
      return formatReviewId(kind, marks[kind]);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    diagnostics() {
      if (lastWritten !== null) {
        lastDiagnostics = { skipped: decodeRecords(lastWritten, repositoryId).skipped, unsupported: false };
        lastWritten = null;
      }
      return { ...lastDiagnostics };
    },
    retire() {
      retired = true;
      reading = null;
      notify();
    },
  };
}
```

  Create `src/adapters/storage/review-repository-registry.ts`:

```ts
// Part 6 Y11/Y17: one durable review repository per codebase for the whole plugin. main.ts
// builds one registry. Every CityView reaches it through CityViewDeps.reviewRepositoryFor,
// so two leaves on one codebase share one instance (one high-water mark, one subscription
// source), and the settings tab purges a removed profile's review state through it.
import type { Plugin } from 'obsidian';
import { createInMemoryReviewRepository, type ReviewRepository } from '../../ui/stores/ports/review-repository';
import { createPluginDataReviewRepository, deleteReviewSet, type PluginDataReviewRepository } from './plugin-data-review-repository';

export interface ReviewRepositoryRegistry {
  /** The cached instance for this codebase, built on first use. */
  for(repositoryId: string): ReviewRepository;
  /** Y17: deletes `reviews[repositoryId]` under the data lock and drops the instance. */
  purge(repositoryId: string): Promise<void>;
}

export function createReviewRepositoryRegistry(plugin: Plugin): ReviewRepositoryRegistry {
  const instances = new Map<string, PluginDataReviewRepository>();
  return {
    for(repositoryId) {
      // Y14: the unbound '' bucket is never persisted. The review store keeps its own
      // in-memory one; this answer only makes a stray call harmless.
      if (repositoryId === '') return createInMemoryReviewRepository();
      let instance = instances.get(repositoryId);
      if (!instance) {
        instance = createPluginDataReviewRepository(plugin, repositoryId);
        instances.set(repositoryId, instance);
      }
      return instance;
    },
    async purge(repositoryId) {
      const instance = instances.get(repositoryId);
      instances.delete(repositoryId);
      // The delete is queued on the data lock first, then the old instance is retired: a
      // write it had already queued lands before the delete, one it starts now is refused,
      // and the reload its subscribers start reads after the delete.
      const deleted = deleteReviewSet(plugin, repositoryId);
      instance?.retire();
      await deleted;
    },
  };
}
```

- [ ] **Step 10: Run and confirm it passes.** `npx vitest run tests/unit/review-repository.test.ts tests/unit/review-repository-registry.test.ts tests/unit/review-record-codec.test.ts tests/unit/review-state.test.ts tests/unit/review-state-import.test.ts tests/unit/review-state-import-rules.test.ts tests/unit/profile-store.test.ts tests/unit/binding-store.test.ts`. Expected: PASS. The in-memory adapter (Task 2) must pass every shared case — including the two R1 `replaceAll` cases (one notification before it resolves; marks raised from the given ids, never lowered). If a case fails for the in-memory adapter only, fix it in `src/ui/stores/ports/review-repository.ts` and report it as a deviation; the shared contract is the ruling (a save raises the mark; each write — `replaceAll` included — notifies once, before it resolves; reads never notify; the in-memory adapter never throws on `allocateId`, R9).
- [ ] **Step 11: Gate.** `npm run typecheck && npm run lint:fast && npx vitest run tests/unit/review-repository.test.ts tests/unit/review-repository-registry.test.ts tests/unit/review-record-codec.test.ts tests/unit/review-state.test.ts tests/unit/review-state-import.test.ts tests/unit/review-state-import-rules.test.ts tests/unit/profile-store.test.ts tests/unit/binding-store.test.ts`, then `npx eslint src/adapters/storage/plugin-data-shape.ts src/adapters/storage/plugin-data-review-repository.ts src/adapters/storage/review-repository-registry.ts src/ui/read-models/review-record-codec.ts src/ui/read-models/review-state.ts src/ui/read-models/review-state-import.ts src/ui/audit-copy/storage.ts src/ui/inspector-copy.ts tests/contracts/review-repository.contract.ts tests/unit/review-repository.test.ts tests/unit/review-repository-registry.test.ts tests/unit/review-record-codec.test.ts --max-warnings 0`. Line counts: every `src` file ≤ 400 (adapter ~225, review-state-import ~262, inspector-copy ≤ 300), every test file ≤ 450 (the contract ~400; if it passes 450, move `runDurableReviewRepositoryContract` and its helpers unchanged into `tests/contracts/review-repository-durable.contract.ts` and report it).
- [ ] **Step 12: Commit.**

```
git add src/adapters/storage/plugin-data-shape.ts src/adapters/storage/plugin-data-review-repository.ts src/adapters/storage/review-repository-registry.ts src/ui/read-models/review-record-codec.ts src/ui/read-models/review-state.ts src/ui/read-models/review-state-import.ts src/ui/audit-copy/storage.ts src/ui/inspector-copy.ts tests/contracts/review-repository.contract.ts tests/unit/review-repository.test.ts tests/unit/review-repository-registry.test.ts tests/unit/review-record-codec.test.ts
git commit -m "feat(storage): durable review repository in data.json — path-form codec, atomic replaceAll, registry with purge, shared contract (Y5–Y10, Y17, R1)" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire the durable review state (Y7 UI, Y11, Y17; R2, R3)

**Files:**
- Create: `src/host/data-ports.ts` (~25) — `wireDataPorts` and `unwireDataPorts` (Task 7 extends both).
- Modify: `src/host/city-scan-controller.ts` (152 → 156) — `CityViewDeps.reviewRepositoryFor`.
- Modify: `src/host/city-view.ts` (275 → 278; budget ≤ 360) — wire before mount, unwire in `onClose`.
- Modify: `src/main.ts` (77 → 84) — one registry, into the view deps and the settings tab.
- Modify: `src/host/settings-tab.ts` (231 → 238) — the registry parameter; purge after removal.
- Modify: `src/host/setting-definitions.ts` (150 → 151) — `STORAGE_DISCLOSURE_TEXT`.
- Modify: `src/ui/App.vue` (188 → 189) — the bind's `.catch(noop)`.
- Modify: `src/ui/screens/settings/PrivacyRows.vue` (55 → ~95) — the storage line; Clear `aria-disabled` with a hint.
- Modify: `src/ui/audit-copy/settings.ts` (98 → 101), `src/ui/audit-copy/quality.ts` (71 → 71), `src/ui/audit-copy/workbench.ts` (80 → 80), `src/ui/audit-copy/storage.ts` (Task 3's, ~22 → ~24) — R3 copy.
- Create: `tests/fixtures/data-port-deps.ts` (~22)
- Modify (every `CityViewDeps` builder gets `...dataPortDeps()`; found with `grep -rn "getFilesystem" tests`): `tests/host/city-view.test.ts` (439 → 440), `tests/host/city-view-store-wiring.test.ts` (450 → 450: one duplicate import is merged), `tests/host/city-view-scan-modes.test.ts` (194 → 195), `tests/host/city-view-cancel.test.ts` (122 → 123), `tests/host/lifecycle-leaks.test.ts` (288 → 289), `tests/host/multi-leaf.test.ts` (347 → 348), `tests/host/window-migration.test.ts` (419 → 420), `tests/acceptance/view-harness.ts` (120 → 121).
- Modify (every `new CodebaseInspectorSettingTab(…)` gets the sixth argument inline, no line growth): `tests/component/settings-tab.test.ts` (435 → 435), `tests/component/settings-tab-validation.test.ts` (216 → 216), `tests/host/plugin-onload.test.ts` (188 → ~212, also gains the main-wiring test).
- Modify: `tests/component/settings-screen.test.ts` (as Task 2 leaves it, ~162 → ~171) — Clear now needs a codebase on screen.
- Create: `tests/host/data-ports.test.ts` (~110), `tests/host/city-view-data-ports.test.ts` (~80), `tests/component/settings-tab-purge.test.ts` (~80), `tests/component/settings-privacy-storage.test.ts` (~120)

**Interfaces:**
- Consumes (Task 2): `useReviewStore()` — `setRepositoryFactory(factory)`, `detach()`, `storageDiagnostics`, `ready`, `loadFailed` (R1), and the store's subscription and reload on a foreign notification (Y12).
- Consumes (Task 3): `createReviewRepositoryRegistry`, `ReviewRepositoryRegistry`, `createPluginDataReviewRepository`, `REVIEW_RECORDS_SKIPPED`, `REVIEW_STORE_UNSUPPORTED_NOTE`.
- Produces: `wireDataPorts(pinia: Pinia, deps: CityViewDeps): void` and `unwireDataPorts(pinia: Pinia): void` in `src/host/data-ports.ts` (R2); `CityViewDeps.reviewRepositoryFor: (repositoryId: string) => ReviewRepository`; `CodebaseInspectorSettingTab`'s sixth constructor parameter `reviewRegistry: Pick<ReviewRepositoryRegistry, 'purge'>`; `REVIEW_STORE_READ_FAILED` and `SETTINGS_CLEAR_HINT`; the Settings line (`ci-settings__storage-note`) and the Clear hint (`ci-settings__clear-hint`); the test fixture `dataPortDeps(): Pick<CityViewDeps, 'reviewRepositoryFor'>` in `tests/fixtures/data-port-deps.ts` (R2 — Task 7 widens the `Pick` to `'reviewRepositoryFor' | 'evidenceStore'`; no other helper name exists).
- **After this task, `App.vue`'s watcher line reads `  void review.bindRepository(id).catch(noop); // Part 6 R1/R3: a failed read sets loadFailed; Settings says so.`** — Task 7's App edit must anchor on that text.

**R3 copy, exact (every review-state string that now lies):**

| Constant (file) | New text |
|---|---|
| `SETTINGS_STORAGE` (settings.ts) | `Saved review state` |
| `SETTINGS_STORAGE_TEXT` (settings.ts) | `Work items, finding decisions and boundary rules are saved for each codebase in this plugin’s own data for this vault, so they survive restarts. Imported findings and the report screen’s sections and note are kept for this session only. No note in your vault is created or changed.` |
| `SETTINGS_CLEAR_TEXT` (settings.ts) | `Remove every work item, finding decision and boundary rule saved for this codebase, and this session’s report note. No repository content is affected.` |
| `SETTINGS_CLEAR_HINT` (settings.ts, new) | `Open a codebase first: review state is saved for each codebase.` |
| `SETTINGS_IMPORT_TEXT` (settings.ts) | `Replace this codebase’s saved review state with a file exported from it. Only the file you pick is read; nothing is read from your vault.` |
| `IMPORT_REPLACE_TEXT` (settings.ts) | `Every work item, finding decision and boundary rule saved for this codebase, and the report’s sections and note, will be replaced. This cannot be undone. Export the review state first if you want a record.` |
| `REVIEW_STATE_NOTE` (settings.ts; the export's `note` text, format unchanged) | `Review decisions are saved in the plugin’s own data for this vault; the report’s sections and note are kept for this session only. Nothing in the repository was changed.` |
| `STORAGE_DISCLOSURE_TEXT` (setting-definitions.ts) | `Codebase profiles, local folder bindings and each codebase’s review decisions (work items, boundary rules and finding decisions) are stored in this vault, in this plugin’s own data file, and survive restarts. Removing a profile removes its review decisions. Imported findings are kept for this session only. Nothing about them is sent anywhere else.` |
| `FINDING_DISMISS_HINT` (quality.ts) | `Capture the reason. It is saved with this codebase’s review state in the plugin’s own data; the repository is never changed.` |
| `FINDING_DISMISSED` (quality.ts) | `Dismissal and reason saved.` |
| `WORKBENCH_CARD_TOTAL_CAPTION` (workbench.ts) | `Saved for this codebase` |
| `WORK_DELETE_CONFIRM_TEXT` (workbench.ts) | `Delete this work item? It is removed from this codebase’s saved review state.` |
| `PLAN_MD_NOTE` (workbench.ts) | `Saved in the plugin’s review state for this codebase. Statuses record the plan; no source code was changed.` |
| `REVIEW_STORE_READ_FAILED` (storage.ts, new) | `The saved review state for this codebase could not be read, so its lists start empty here. Nothing on disk was changed; close and reopen this tab to try again.` |

Left as they are (still true): `REPORT_NOTE_PANEL_SUBTITLE` ("Kept in this session only." — the report note stays per leaf), `SETTINGS_DENSITY_TEXT` (a preference), the Evolution snapshot strings (snapshots stay in memory). `QUALITY_FOOTNOTE` is rewritten by Task 9 (its draft already drops "kept in this session only"). No test asserts any of the old literals (`grep` of `tests/` for each old string finds nothing).

- [ ] **Step 1: Write the failing host tests.** Create `tests/host/data-ports.test.ts` ('node' project):

```ts
// Part 6 Y11/Y12/Y5, R2: wireDataPorts hands the plugin's review registry to one leaf's
// review store before mount; two leaves on one codebase then share one durable repository —
// one id sequence, and a change in one shows in the other — and the review state is there
// again after a restart (a new registry on the same data.json). unwireDataPorts detaches a
// closing leaf, so the plugin-level repository stops calling into it.
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, type Pinia } from 'pinia';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { unwireDataPorts, wireDataPorts } from '../../src/host/data-ports';
import type { CityViewDeps } from '../../src/host/city-view';
import { createReviewRepositoryRegistry, type ReviewRepositoryRegistry } from '../../src/adapters/storage/review-repository-registry';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { makeEntityId } from '../../src/domain/entity-id';

const REPO = 'p1';
const NOW = new Date('2026-09-23T10:00:00.000Z');
const FILE_A = makeEntityId(REPO, 'file', 'src/a.ts');
/** wireDataPorts reads only the data ports; the scan deps play no part here. */
const depsOf = (ports: Pick<CityViewDeps, 'reviewRepositoryFor'>): CityViewDeps => ports as CityViewDeps;
const newPlugin = (): ObsidianPlugin => new Plugin({}, {}) as unknown as ObsidianPlugin;

/** A leaf: its own Pinia, wired to `registry`, its review store bound to REPO. */
async function leaf(registry: ReviewRepositoryRegistry): Promise<{ pinia: Pinia; review: ReturnType<typeof useReviewStore> }> {
  const pinia = createPinia();
  wireDataPorts(pinia, depsOf({ reviewRepositoryFor: (id) => registry.for(id) }));
  const review = useReviewStore(pinia);
  await review.bindRepository(REPO);
  return { pinia, review };
}

describe('wireDataPorts (Part 6 Y11)', () => {
  it('builds the bound codebase\'s review repository through the given factory', async () => {
    const repo = createInMemoryReviewRepository();
    const reviewRepositoryFor = vi.fn(() => repo);
    const pinia = createPinia();
    wireDataPorts(pinia, depsOf({ reviewRepositoryFor }));
    const review = useReviewStore(pinia);
    await review.bindRepository(REPO);
    expect(reviewRepositoryFor).toHaveBeenCalledWith(REPO);
    await review.addWorkItemForFile(FILE_A, 'Split the parser', NOW);
    expect((await repo.listWorkItems()).map((w) => w.title)).toEqual(['Split the parser']);
  });

  it('two leaves on one codebase share one repository: one id sequence, and each shows the other\'s change (Y11, Y12)', async () => {
    const registry = createReviewRepositoryRegistry(newPlugin());
    const left = (await leaf(registry)).review;
    const right = (await leaf(registry)).review;
    expect((await left.addWorkItemForFile(FILE_A, 'Split the parser', NOW))?.id).toBe('wi-1');
    await flushPromises();
    expect(right.workItems.map((w) => w.id)).toEqual(['wi-1']);
    expect((await right.addWorkItem({ kind: 'module', module: 'src' }, 'review', 'Review src', NOW))?.id).toBe('wi-2');
    await flushPromises();
    expect(left.workItems.map((w) => w.id)).toEqual(['wi-1', 'wi-2']);
    expect(await right.removeWorkItem('wi-1')).toBe(true);
    await flushPromises();
    expect(left.workItems.map((w) => w.id)).toEqual(['wi-2']);
  });

  it('keeps the review state across a restart: a new registry on the same data.json lists it (Y5)', async () => {
    const plugin = newPlugin();
    const before = (await leaf(createReviewRepositoryRegistry(plugin))).review;
    await before.addWorkItemForFile(FILE_A, 'Split the parser', NOW);
    await before.addRule('ui', 'domain', 'Layering', NOW);
    await before.acknowledge(`${FILE_A}#CX-1`, NOW);
    const after = (await leaf(createReviewRepositoryRegistry(plugin))).review;
    expect(after.workItems).toEqual(before.workItems);
    expect(after.rules).toEqual(before.rules);
    expect(after.dispositions).toEqual(before.dispositions);
    expect((await after.addRule('ui', 'host', 'Layering', NOW))?.id).toBe('AR-002');
  });

  it('mirrors what the saved state could not show into the store (Y7)', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ reviews: { [REPO]: { v: 1, workItems: [{ id: 'wi-1', owner: 'x' }], rules: [], dispositions: [] } } });
    const { review } = await leaf(createReviewRepositoryRegistry(plugin));
    expect(review.workItems).toEqual([]);
    expect(review.storageDiagnostics).toEqual({ skipped: 1, unsupported: false });
  });
});

describe('unwireDataPorts (Part 6 R2)', () => {
  it('detaches a closing leaf: it stops following the other leaf, which keeps working', async () => {
    const registry = createReviewRepositoryRegistry(newPlugin());
    const closing = await leaf(registry);
    const open = await leaf(registry);
    unwireDataPorts(closing.pinia);
    await open.review.addWorkItemForFile(FILE_A, 'Split the parser', NOW);
    await flushPromises();
    expect(closing.review.workItems).toEqual([]);
    expect(open.review.workItems.map((w) => w.id)).toEqual(['wi-1']);
  });
});
```

  Create `tests/host/city-view-data-ports.test.ts` (jsdom, via `tests/host/city-view*.test.ts`):

```ts
// Part 6 Y11/R2: a real CityView hands its review store the plugin's registry before mount,
// so App's first bind builds the codebase's repository through it, and on close detaches
// the store, so the plugin-level repository stops calling into a dead leaf. Routed to the
// jsdom project by vitest.config.ts's `tests/host/city-view*.test.ts`.
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { CityView } from '../../src/host/city-view';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { defaultCityViewState } from '../../src/host/view-state';
import { createInMemoryReviewRepository, type ReviewRepository } from '../../src/ui/stores/ports/review-repository';
import type { CameraBookmark, CodebaseSnapshot } from '../../src/domain/model';
import type { CityRendererPort } from '../../src/visualization/renderer-port';
import type { CityViewDeps } from '../../src/host/city-view';
import type { ProfileStore } from '../../src/application/ports/profile-store';

const DUMMY_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};
const inertPort: CityRendererPort = {
  setLayout: vi.fn(() => Promise.resolve()), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(),
  setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),
  getCamera: vi.fn((): CameraBookmark => DUMMY_CAMERA), setCamera: vi.fn(), nudgeCamera: vi.fn(),
  focus: vi.fn(), fit: vi.fn(), resize: vi.fn(), pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
  getDiagnostics: vi.fn(() => ({
    geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
  })),
  debugLoseContext: vi.fn(),
};
vi.mock('../../src/visualization/city-renderer', () => ({ createCityRenderer: vi.fn(() => inertPort) }));

function publishedSnapshot(): CodebaseSnapshot {
  return {
    ...buildSnapshotFixture({ files: 1, repositoryId: 'p1' }),
    snapshotId: 's1',
    scope: { rootPath: '/fake-root', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false as const },
  };
}

function makePluginDouble() {
  return {
    app: {
      workspace: {
        onLayoutReady: vi.fn(), getLeavesOfType: vi.fn(() => []), getLeaf: vi.fn(),
        revealLeaf: vi.fn(() => Promise.resolve()), on: vi.fn(() => ({})), offref: vi.fn(),
      },
      vault: { adapter: { read: vi.fn(), list: vi.fn() }, configDir: '.obsidian' },
    },
  };
}

const profileStore: ProfileStore = {
  list: vi.fn(() => Promise.resolve([])), get: vi.fn(() => Promise.resolve(null)),
  save: vi.fn(() => Promise.resolve()), remove: vi.fn(() => Promise.resolve()), update: vi.fn(() => Promise.resolve()),
};

describe('CityView data ports (Part 6 Y11, R2)', () => {
  it('binds the review store through reviewRepositoryFor, and detaches it on close', async () => {
    const unsubscribe = vi.fn();
    const subscribe = vi.fn(() => unsubscribe);
    const repo: ReviewRepository = { ...createInMemoryReviewRepository(), subscribe };
    const reviewRepositoryFor = vi.fn(() => repo);
    const snapshotStore = new InMemorySnapshotStore(createFixedClock());
    snapshotStore.put(publishedSnapshot());
    const deps: CityViewDeps = {
      profileStore, getFilesystem: () => createFakeSourceFileSystem({}).port, snapshotStore, clock: createFixedClock(),
      reviewRepositoryFor,
    };
    const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, deps);
    await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1', route: 'city' }, {} as never);
    await view.onOpen();
    await flushPromises();
    expect(reviewRepositoryFor).toHaveBeenCalledWith('p1');
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();
    await view.onClose();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
```

  In `tests/host/plugin-onload.test.ts`:

  (a) Replace:

```ts
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
```

  with:

```ts
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { SettingDefinitionItem, SettingDefinitionList } from 'obsidian';
```

  (b) Replace:

```ts
      expect(update).toHaveBeenCalled();
    } finally {
      update.mockRestore();
    }
  });
});
```

  with:

```ts
      expect(update).toHaveBeenCalled();
    } finally {
      update.mockRestore();
    }
  });
});

// Part 6 Y11/Y17: onload builds ONE review registry and hands it to the settings tab, so
// removing a profile removes its saved review state. (The CityView half,
// `reviewRepositoryFor`, needs a DOM to construct a view: tests/host/city-view-data-ports
// and the typecheck cover it.)
describe('the review registry (Part 6 Y11, Y17)', () => {
  it('reaches the settings tab: removing a profile purges its saved review state', async () => {
    const p = makePluginDouble();
    let data: unknown = {
      profiles: [{ profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 }],
      reviews: { p1: { v: 1, workItems: [], rules: [], dispositions: [] }, p2: { v: 1 } },
    };
    p.loadData.mockImplementation(() => Promise.resolve(JSON.parse(JSON.stringify(data)) as unknown));
    p.saveData.mockImplementation((next: unknown) => {
      data = JSON.parse(JSON.stringify(next)) as unknown;
      return Promise.resolve();
    });
    p.onload();
    const tab = p.addSettingTab.mock.calls[0]?.[0] as CodebaseInspectorSettingTab;
    await tab.refresh();
    const list = tab.getSettingDefinitions().find((d: SettingDefinitionItem): d is SettingDefinitionList => 'type' in d && d.type === 'list');
    expect(list?.onDelete).toBeDefined();
    list?.onDelete?.(0);
    await vi.waitFor(() => { expect(data).toEqual({ profiles: [], reviews: { p2: { v: 1 } } }); });
  });
});
```

- [ ] **Step 2: Write the failing settings tests.** Create `tests/component/settings-tab-purge.test.ts` (split from `settings-tab.test.ts`, which is at 435):

```ts
// Part 6 Y17: removing a codebase profile in the plugin settings removes its saved review
// state too — data.json `reviews[id]` and the registry's cached instance. A new file:
// settings-tab.test.ts is at 435 lines.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import type { App, Plugin as ObsidianPlugin, SettingDefinitionItem, SettingDefinitionList } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { PluginDataProfileStore } from '../../src/adapters/storage/plugin-data-profile-store';
import { createReviewRepositoryRegistry, type ReviewRepositoryRegistry } from '../../src/adapters/storage/review-repository-registry';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { ProfileStore } from '../../src/application/ports/profile-store';
import type { CodebaseProfile } from '../../src/domain/model';

const AT = '2026-09-23T10:00:00.000Z';
const profile = (profileId: string): CodebaseProfile =>
  ({ profileId, name: profileId, bindingId: null, exclusions: [], maxFileBytes: 1_000_000 });
const SET = {
  v: 1, workItems: [], rules: [{ id: 'AR-001', from: 'ui', to: 'domain', rationale: 'Layering', createdAt: AT }],
  dispositions: [], highWater: { workItem: 0, rule: 1 },
};

function findList(defs: SettingDefinitionItem[]): SettingDefinitionList {
  const found = defs.find((d): d is SettingDefinitionList => 'type' in d && d.type === 'list');
  if (!found) throw new Error('no list definition found');
  return found;
}

function newTab(profileStore: ProfileStore, registry: Pick<ReviewRepositoryRegistry, 'purge'>): CodebaseInspectorSettingTab {
  return new CodebaseInspectorSettingTab(
    {} as unknown as App, {} as unknown as ObsidianPlugin, profileStore, createFakeBindingStoreHarness().store,
    () => createFakeSourceFileSystem({}).port, registry);
}

afterEach(() => {
  document.querySelectorAll('.notice-container').forEach((n) => { n.remove(); });
});

describe('settings tab: removing a profile purges its review state (Part 6 Y17)', () => {
  it('deletes that profile\'s saved review state and nothing else', async () => {
    const plugin = new Plugin({}, {}) as unknown as ObsidianPlugin;
    await plugin.saveData({ profiles: [profile('p1'), profile('p2')], reviews: { p1: SET, p2: SET } });
    const tab = newTab(new PluginDataProfileStore(plugin), createReviewRepositoryRegistry(plugin));
    await tab.refresh();
    findList(tab.getSettingDefinitions()).onDelete!(0);
    await flushPromises();
    expect(await plugin.loadData()).toEqual({ profiles: [profile('p2')], reviews: { p2: SET } });
  });

  it('purges only after the profile is removed; a failed purge is shown with its reason and the list still refreshes', async () => {
    const { store } = createFakeProfileStoreHarness();
    await store.save(profile('p1'));
    const remove = vi.spyOn(store, 'remove');
    const purge = vi.fn<(repositoryId: string) => Promise<void>>(() => Promise.reject(new Error('Could not write data.json.')));
    const tab = newTab(store, { purge });
    await tab.refresh();
    findList(tab.getSettingDefinitions()).onDelete!(0);
    await flushPromises();
    expect(purge).toHaveBeenCalledWith('p1');
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(purge.mock.invocationCallOrder[0]!);
    expect(document.querySelector('.notice')?.textContent).toBe('Could not write data.json.');
    expect(findList(tab.getSettingDefinitions()).items).toEqual([]);
  });
});
```

  Create `tests/component/settings-privacy-storage.test.ts`:

```ts
// Part 6 Y7/R3: Settings › Privacy & storage says the review state is saved per codebase,
// says when saved records could not be read, when the saved state is read-only, and when it
// could not be read at all (through App's bind, which must never leave an unhandled
// rejection); Clear is aria-disabled, with a hint, while no codebase is on screen.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import App from '../../src/ui/App.vue';
import SettingsScreen from '../../src/ui/screens/SettingsScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { createPluginDataReviewRepository } from '../../src/adapters/storage/plugin-data-review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import {
  REVIEW_RECORDS_SKIPPED, REVIEW_STORE_READ_FAILED, REVIEW_STORE_UNSUPPORTED_NOTE, SETTINGS_CLEAR_HINT, SETTINGS_STORAGE_TEXT,
} from '../../src/ui/inspector-copy';

const mountS = () => mount(SettingsScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
type Wrapper = ReturnType<typeof mountS>;
const openPrivacy = (w: Pick<Wrapper, 'find'>) => w.find('[role="tab"][data-tab-id="privacy"]').trigger('click');
const noteOf = (w: Pick<Wrapper, 'find'>) => w.find('.ci-settings__storage-note');

/** Binds the review store to 'p1', backed by the durable adapter over this data.json. */
async function boundTo(doc: unknown): Promise<void> {
  const plugin = new Plugin({}, {}) as unknown as ObsidianPlugin;
  await plugin.saveData(doc);
  const review = useReviewStore();
  review.setRepositoryFactory((id) => createPluginDataReviewRepository(plugin, id));
  await review.bindRepository('p1');
}

function onScreen(): void {
  const snap = buildSnapshotFixture({ files: 1, repositoryId: 'p1' });
  useCityStore().setCity(snap, computeLayout(snap));
}

describe('Settings › Privacy & storage: the saved review state (Part 6 Y7, R3)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('says the review state is saved per codebase, with no extra line while every record was read', async () => {
    await boundTo({ reviews: { p1: { v: 1, workItems: [], rules: [], dispositions: [] } } });
    const w = mountS();
    await openPrivacy(w);
    expect(w.text()).toContain(SETTINGS_STORAGE_TEXT);
    expect(SETTINGS_STORAGE_TEXT).not.toContain('lost when the leaf closes');
    expect(noteOf(w).exists()).toBe(false);
    w.unmount();
  });

  it('counts the saved records that could not be read, and follows the store', async () => {
    await boundTo({ reviews: { p1: { v: 1, workItems: [{ id: 'wi-1', owner: 'x' }, 'garbage'], rules: [], dispositions: [] } } });
    const w = mountS();
    await openPrivacy(w);
    expect(noteOf(w).text()).toBe(REVIEW_RECORDS_SKIPPED(2));
    useReviewStore().$patch({ storageDiagnostics: { skipped: 0, unsupported: false } });
    await w.vm.$nextTick();
    expect(noteOf(w).exists()).toBe(false);
    w.unmount();
  });

  it('says the saved state is read-only while its format is unsupported', async () => {
    await boundTo({ reviews: { p1: { v: 2, workItems: [] } } });
    const w = mountS();
    await openPrivacy(w);
    expect(noteOf(w).text()).toBe(REVIEW_STORE_UNSUPPORTED_NOTE);
    w.unmount();
  });

  it('says the saved state could not be read when App\'s bind fails, and leaves no unhandled rejection', async () => {
    const failing = { ...createInMemoryReviewRepository(), listWorkItems: () => Promise.reject(new Error('data.json unreadable')) };
    useReviewStore().setRepositoryFactory(() => failing);
    onScreen();
    useCityStore().navigate('settings');
    const w = mount(App, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });
    await flushPromises();
    expect(useReviewStore().loadFailed).toBe(true);
    await openPrivacy(w);
    expect(noteOf(w).text()).toBe(REVIEW_STORE_READ_FAILED);
    w.unmount();
  });

  it('blocks Clear, with a hint, while no codebase is on screen', async () => {
    const w = mountS();
    await openPrivacy(w);
    const clear = w.find('.ci-settings__clear');
    expect(clear.attributes('aria-disabled')).toBe('true');
    expect(w.find(`#${clear.attributes('aria-describedby')!}`).text()).toBe(SETTINGS_CLEAR_HINT);
    await clear.trigger('click');
    expect(w.find('.ci-clear-dialog').exists()).toBe(false);
    onScreen();
    await w.vm.$nextTick();
    expect(w.find('.ci-settings__clear').attributes('aria-disabled')).toBeUndefined();
    expect(w.find('.ci-settings__clear-hint').exists()).toBe(false);
    await w.find('.ci-settings__clear').trigger('click');
    expect(w.find('.ci-clear-dialog').exists()).toBe(true);
    w.unmount();
  });
});
```

- [ ] **Step 3: Run them and confirm they fail.** `npx vitest run tests/host/data-ports.test.ts tests/host/city-view-data-ports.test.ts tests/component/settings-tab-purge.test.ts tests/component/settings-privacy-storage.test.ts tests/host/plugin-onload.test.ts`. Expected: FAIL —
  - `data-ports`: fails to load, `Failed to resolve import "../../src/host/data-ports"`;
  - `city-view-data-ports`: `expected "spy" to be called with arguments: [ 'p1' ]` (the view never wires the factory);
  - `settings-tab-purge`: the first case finds `reviews.p1` still in data.json, the second finds `purge` never called (the sixth argument is ignored);
  - `settings-privacy-storage`: `REVIEW_STORE_READ_FAILED` and `SETTINGS_CLEAR_HINT` import as `undefined`; the first case fails on `not.toContain('lost when the leaf closes')`, the two note cases on the missing `.ci-settings__storage-note`, the App case with vitest's **unhandled rejection** `data.json unreadable` (App's `void review.bindRepository(id)` has no catch), the Clear case on `aria-disabled` being `undefined`;
  - `plugin-onload`: the new case times out in `vi.waitFor` with `reviews.p1` still present; the existing cases pass.

- [ ] **Step 4: The dependency and the data ports.** In `src/host/city-scan-controller.ts`:

  (a) Replace:

```ts
import type { Clock } from '../application/ports/clock';
```

  with:

```ts
import type { Clock } from '../application/ports/clock';
import type { ReviewRepository } from '../ui/stores/ports/review-repository';
```

  (b) Replace:

```ts
/** Task 8: what a CityView needs to run a scan, beyond the plain `Plugin` reference. All
 *  four are plugin-level singletons (main.ts constructs one of each and passes the same
 *  instances to every CityView); `getFilesystem` stays a LAZY factory (task 7's pattern),
 *  so the real Node-backed port is never built earlier than a view that might use it. */
export interface CityViewDeps {
  profileStore: ProfileStore;
  getFilesystem: () => SourceFileSystemPort;
  snapshotStore: SnapshotStore;
  clock: Clock;
}
```

  with:

```ts
/** Task 8: what a CityView needs to run a scan, beyond the plain `Plugin` reference. All
 *  of them are plugin-level singletons (main.ts constructs one of each and passes the same
 *  instances to every CityView); `getFilesystem` stays a LAZY factory (task 7's pattern),
 *  so the real Node-backed port is never built earlier than a view that might use it. */
export interface CityViewDeps {
  profileStore: ProfileStore;
  getFilesystem: () => SourceFileSystemPort;
  snapshotStore: SnapshotStore;
  clock: Clock;
  /** Part 6 Y11: the plugin's review repository registry (`registry.for`), one repository
   *  per codebase shared by every leaf. `wireDataPorts` hands it to the review store. */
  reviewRepositoryFor: (repositoryId: string) => ReviewRepository;
}
```

  Create `src/host/data-ports.ts`:

```ts
// Part 6 Y11/R2 (Task 7 adds Y28's evidence store to both functions): the plugin-level data
// ports a CityView hands to its own Pinia stores in onOpen, before mount, so App's first
// bind already uses them — and takes back in onClose, before the Pinia is dropped, because
// the ports outlive the leaf. Kept out of city-view.ts (the 360-line budget).
import type { Pinia } from 'pinia';
import { useReviewStore } from '../ui/stores/review-store';
import type { CityViewDeps } from './city-scan-controller';

/** Y11: the review store builds each codebase's repository through the plugin's registry,
 *  so two leaves on one codebase share one instance: one high-water mark, one cache and
 *  one subscription source (Y12). */
export function wireDataPorts(pinia: Pinia, deps: CityViewDeps): void {
  useReviewStore(pinia).setRepositoryFactory(deps.reviewRepositoryFor);
}

/** R2: a closing leaf stops listening to the plugin-level repository (Task 2's `detach`),
 *  so later writes from other leaves never reload a dead store. */
export function unwireDataPorts(pinia: Pinia): void {
  useReviewStore(pinia).detach();
}
```

  In `src/host/city-view.ts`:

  (a) Replace:

```ts
import { createLayoutPublisher, type LayoutPublisher } from './layout-publisher';
```

  with:

```ts
import { createLayoutPublisher, type LayoutPublisher } from './layout-publisher';
import { unwireDataPorts, wireDataPorts } from './data-ports';
```

  (b) Replace:

```ts
    this.runStore = useRunStore(this.pinia);
```

  with:

```ts
    this.runStore = useRunStore(this.pinia);
    wireDataPorts(this.pinia, this.deps); // Part 6 Y11: before mount, so App's first bind uses the registry.
```

  (c) Replace:

```ts
    this.vueApp?.unmount();
    this.vueApp = null;
    this.pinia = null;
```

  with:

```ts
    this.vueApp?.unmount();
    this.vueApp = null;
    if (this.pinia) unwireDataPorts(this.pinia); // Part 6 R2: the plugin's ports outlive this leaf.
    this.pinia = null;
```

- [ ] **Step 5: The registry in `main.ts`, the purge in the settings tab, the disclosure, App's bind.** In `src/main.ts`:

  (a) Replace:

```ts
import { InMemorySnapshotStore } from './adapters/storage/in-memory-snapshot-store';
```

  with:

```ts
import { InMemorySnapshotStore } from './adapters/storage/in-memory-snapshot-store';
import { createReviewRepositoryRegistry } from './adapters/storage/review-repository-registry';
```

  (b) Replace:

```ts
    const snapshotStore = new InMemorySnapshotStore(SYSTEM_CLOCK);

    this.registerView(CITY_VIEW_TYPE, (leaf: WorkspaceLeaf) => new CityView(leaf, this, {
      profileStore, getFilesystem: () => createNodeSourceFileSystem(), snapshotStore, clock: SYSTEM_CLOCK,
    }));
```

  with:

```ts
    const snapshotStore = new InMemorySnapshotStore(SYSTEM_CLOCK);
    // Part 6 Y11: ONE review repository per codebase for the whole plugin, shared by every
    // leaf (one high-water mark, one cache) and purged with its profile (Y17). It builds
    // and reads nothing until a view binds a codebase.
    const reviewRegistry = createReviewRepositoryRegistry(this);

    this.registerView(CITY_VIEW_TYPE, (leaf: WorkspaceLeaf) => new CityView(leaf, this, {
      profileStore, getFilesystem: () => createNodeSourceFileSystem(), snapshotStore, clock: SYSTEM_CLOCK,
      reviewRepositoryFor: (repositoryId) => reviewRegistry.for(repositoryId),
    }));
```

  (c) Replace:

```ts
      this.app, this, profileStore, bindingStore, () => createNodeSourceFileSystem());
```

  with:

```ts
      this.app, this, profileStore, bindingStore, () => createNodeSourceFileSystem(), reviewRegistry);
```

  In `src/host/settings-tab.ts`:

  (a) Replace:

```ts
import type { SourceFileSystemPort } from '../application/ports/source-filesystem-port';
```

  with:

```ts
import type { SourceFileSystemPort } from '../application/ports/source-filesystem-port';
import type { ReviewRepositoryRegistry } from '../adapters/storage/review-repository-registry';
```

  (b) Replace:

```ts
    private readonly getFilesystem: () => SourceFileSystemPort,
  ) {
```

  with:

```ts
    private readonly getFilesystem: () => SourceFileSystemPort,
    // Part 6 Y17: a removed profile's review state goes with it (main.ts passes its one registry).
    private readonly reviewRegistry: Pick<ReviewRepositoryRegistry, 'purge'>,
  ) {
```

  (c) Replace:

```ts
  private async deleteProfile(id: string): Promise<void> {
    await this.profileStore.remove(id);
    await this.refresh();
  }
```

  with:

```ts
  private async deleteProfile(id: string): Promise<void> {
    await this.profileStore.remove(id);
    // Part 6 Y17: only once the profile is gone, so a failed removal keeps both. A failed
    // purge is shown with its reason (spec 7: never dropped silently); the list refreshes.
    await this.reviewRegistry.purge(id).catch((e: unknown) => { this.showFailure(e); });
    await this.refresh();
  }
```

  In `src/host/setting-definitions.ts`, replace:

```ts
export const STORAGE_DISCLOSURE_TEXT =
  'Codebase profiles and local folder bindings are stored in this vault, in this ' +
  'plugin’s own data file. Nothing about them is sent anywhere else.';
```

  with:

```ts
export const STORAGE_DISCLOSURE_TEXT =
  'Codebase profiles, local folder bindings and each codebase’s review decisions (work items, ' +
  'boundary rules and finding decisions) are stored in this vault, in this plugin’s own data ' +
  'file, and survive restarts. Removing a profile removes its review decisions. Imported findings ' +
  'are kept for this session only. Nothing about them is sent anywhere else.';
```

  In `src/ui/App.vue`:

  (a) Replace:

```ts
import { useReviewStore } from './stores/review-store';
```

  with:

```ts
import { useReviewStore } from './stores/review-store';
import { noop } from './kit/noop';
```

  (b) Replace:

```ts
  void review.bindRepository(id);
```

  with:

```ts
  void review.bindRepository(id).catch(noop); // Part 6 R1/R3: a failed read sets loadFailed; Settings says so.
```

- [ ] **Step 6: The R3 copy.** In `src/ui/audit-copy/settings.ts`:

  (a) Replace:

```ts
export const SETTINGS_STORAGE = 'Session-only review state';
export const SETTINGS_STORAGE_TEXT = 'Work items, finding decisions, boundary rules and report notes live in this leaf’s memory. They are lost when the leaf closes. Nothing is written to your vault.';
export const SETTINGS_CLEAR = 'Clear review state';
export const SETTINGS_CLEAR_TEXT = 'Remove every work item, finding decision, boundary rule and the report note from this session. No repository content is affected.';
```

  with:

```ts
/** Part 6 Y5/R3: review decisions are saved per codebase; imported findings and the report stay per session. */
export const SETTINGS_STORAGE = 'Saved review state';
export const SETTINGS_STORAGE_TEXT = 'Work items, finding decisions and boundary rules are saved for each codebase in this plugin’s own data for this vault, so they survive restarts. Imported findings and the report screen’s sections and note are kept for this session only. No note in your vault is created or changed.';
export const SETTINGS_CLEAR = 'Clear review state';
export const SETTINGS_CLEAR_TEXT = 'Remove every work item, finding decision and boundary rule saved for this codebase, and this session’s report note. No repository content is affected.';
/** Part 6 R3: Clear is aria-disabled while no codebase is on screen (the Import hint's pattern). */
export const SETTINGS_CLEAR_HINT = 'Open a codebase first: review state is saved for each codebase.';
```

  (b) Replace:

```ts
export const REVIEW_STATE_NOTE = 'Kept in memory for one session. Nothing was written to the vault.';
```

  with:

```ts
export const REVIEW_STATE_NOTE = 'Review decisions are saved in the plugin’s own data for this vault; the report’s sections and note are kept for this session only. Nothing in the repository was changed.';
```

  (c) Replace:

```ts
export const SETTINGS_IMPORT_TEXT = 'Replace this session’s review state with a file exported from this codebase. Only the file you pick is read; nothing is read from your vault.';
```

  with:

```ts
export const SETTINGS_IMPORT_TEXT = 'Replace this codebase’s saved review state with a file exported from it. Only the file you pick is read; nothing is read from your vault.';
```

  (d) Replace:

```ts
export const IMPORT_REPLACE_TEXT = 'Every work item, finding decision and boundary rule in this session, and the report’s sections and note, will be replaced. This cannot be undone. Export the review state first if you want a record.';
```

  with:

```ts
export const IMPORT_REPLACE_TEXT = 'Every work item, finding decision and boundary rule saved for this codebase, and the report’s sections and note, will be replaced. This cannot be undone. Export the review state first if you want a record.';
```

  In `src/ui/audit-copy/quality.ts`:
  - Replace `export const FINDING_DISMISS_HINT = 'Capture the reason. This only updates the review state for this session.';` with `export const FINDING_DISMISS_HINT = 'Capture the reason. It is saved with this codebase’s review state in the plugin’s own data; the repository is never changed.';`.
  - Replace `export const FINDING_DISMISSED = 'Dismissal and reason saved for this session.';` with `export const FINDING_DISMISSED = 'Dismissal and reason saved.';`.

  In `src/ui/audit-copy/workbench.ts`:
  - Replace `export const WORKBENCH_CARD_TOTAL_CAPTION = 'Kept in this session only';` with `export const WORKBENCH_CARD_TOTAL_CAPTION = 'Saved for this codebase';`.
  - Replace `export const WORK_DELETE_CONFIRM_TEXT = 'Delete this work item? It is removed for this session.';` with `export const WORK_DELETE_CONFIRM_TEXT = 'Delete this work item? It is removed from this codebase’s saved review state.';`.
  - Replace `export const PLAN_MD_NOTE = 'Kept in this session only. Statuses record the plan; no source code was changed.';` with `export const PLAN_MD_NOTE = 'Saved in the plugin’s review state for this codebase. Statuses record the plan; no source code was changed.';`.

  In `src/ui/audit-copy/storage.ts` (Task 3's file), append after the `REVIEW_STORE_UNSUPPORTED_NOTE` export:

```ts
/** Part 6 R1/R3: Settings › Privacy & storage, while the bound codebase's last load failed. */
export const REVIEW_STORE_READ_FAILED = 'The saved review state for this codebase could not be read, so its lists start empty here. Nothing on disk was changed; close and reopen this tab to try again.';
```

- [ ] **Step 7: The Settings line and the blocked Clear.** In `src/ui/screens/settings/PrivacyRows.vue`:

  (a) Replace:

```vue
<script setup lang="ts">
import {
  SETTINGS_CLEAR, SETTINGS_CLEAR_OPEN, SETTINGS_CLEAR_TEXT, SETTINGS_EXPORT, SETTINGS_NETWORK, SETTINGS_NETWORK_TEXT,
  SETTINGS_NETWORK_VALUE, SETTINGS_STORAGE, SETTINGS_STORAGE_TEXT,
} from '../../inspector-copy';
import type { ImportCandidate } from './import-candidate';
import ImportRow from './ImportRow.vue';

const emit = defineEmits<{ clear: []; export: []; parsed: [candidate: ImportCandidate] }>();
</script>
```

  with:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import {
  REVIEW_RECORDS_SKIPPED, REVIEW_STORE_READ_FAILED, REVIEW_STORE_UNSUPPORTED_NOTE,
  SETTINGS_CLEAR, SETTINGS_CLEAR_HINT, SETTINGS_CLEAR_OPEN, SETTINGS_CLEAR_TEXT, SETTINGS_EXPORT, SETTINGS_NETWORK,
  SETTINGS_NETWORK_TEXT, SETTINGS_NETWORK_VALUE, SETTINGS_STORAGE, SETTINGS_STORAGE_TEXT,
} from '../../inspector-copy';
import { useCityStore } from '../../stores/city-store';
import { useReviewStore } from '../../stores/review-store';
import { useUniqueId } from '../../unique-id';
import type { ImportCandidate } from './import-candidate';
import ImportRow from './ImportRow.vue';

const emit = defineEmits<{ clear: []; export: []; parsed: [candidate: ImportCandidate] }>();
const city = useCityStore();
const review = useReviewStore();
const clearHintId = useUniqueId('ci-settings-clear-hint');
/** Part 6 Y7/R3: one line about the bound codebase's saved review state, shown only while
 *  it could not be read, is read-only, or has records that could not be read. */
const storageNote = computed((): string => {
  const { skipped, unsupported } = review.storageDiagnostics;
  if (review.loadFailed) return REVIEW_STORE_READ_FAILED;
  if (unsupported) return REVIEW_STORE_UNSUPPORTED_NOTE;
  return skipped > 0 ? REVIEW_RECORDS_SKIPPED(skipped) : '';
});
/** Part 6 R3: blocked (aria-disabled plus this guard, E40) while no codebase is on screen —
 *  the saved review state belongs to one codebase. Announces nothing (E17). */
function requestClear(): void {
  if (!city.snapshot) return;
  emit('clear');
}
</script>
```

  (b) Replace:

```vue
        {{ SETTINGS_STORAGE_TEXT }}
      </p>
```

  with:

```vue
        {{ SETTINGS_STORAGE_TEXT }}
      </p>
      <p
        v-if="storageNote !== ''"
        class="ci-note ci-settings__storage-note"
      >
        {{ storageNote }}
      </p>
```

  (c) Replace:

```vue
        {{ SETTINGS_CLEAR_TEXT }}
      </p>
    </div>
    <button
      type="button"
      class="mod-warning ci-settings__clear"
      @click="emit('clear')"
    >
```

  with:

```vue
        {{ SETTINGS_CLEAR_TEXT }}
      </p>
      <p
        v-if="!city.snapshot"
        :id="clearHintId"
        class="ci-note ci-settings__clear-hint"
      >
        {{ SETTINGS_CLEAR_HINT }}
      </p>
    </div>
    <button
      type="button"
      class="mod-warning ci-settings__clear"
      :aria-disabled="city.snapshot ? undefined : 'true'"
      :aria-describedby="city.snapshot ? undefined : clearHintId"
      @click="requestClear"
    >
```

  The storage line is static text (state, not an outcome; E17). `ci-settings__storage-note` and `ci-settings__clear-hint` belong to the settings screen's own block; no CSS is needed, and the kit's shared `button[aria-disabled="true"]` rule styles the blocked button.

- [ ] **Step 8: Every test `CityViewDeps`, settings tab and Clear test.** Create `tests/fixtures/data-port-deps.ts`:

```ts
// Part 6 R2: the plugin-level data ports every CityViewDeps literal in the tests spreads in
// (`...dataPortDeps()`), so a new port (Task 7's evidence store) changes this one file.
// One in-memory review repository per codebase, shared by every leaf built from the same
// deps object — the registry's own contract, without a data.json.
import type { CityViewDeps } from '../../src/host/city-view';
import { createInMemoryReviewRepository, type ReviewRepository } from '../../src/ui/stores/ports/review-repository';

export function dataPortDeps(): Pick<CityViewDeps, 'reviewRepositoryFor'> {
  const repositories = new Map<string, ReviewRepository>();
  return {
    reviewRepositoryFor: (repositoryId) => {
      let repository = repositories.get(repositoryId);
      if (!repository) {
        repository = createInMemoryReviewRepository();
        repositories.set(repositoryId, repository);
      }
      return repository;
    },
  };
}
```

  Then, in each file below, add `import { dataPortDeps } from '../fixtures/data-port-deps';` directly after its line `import { createFixedClock } from '../fixtures/clock';`, and make the deps edits exactly as listed (Edit tool; `replace_all` only where stated):

  | File | Deps edit |
  |---|---|
  | `tests/host/city-view.test.ts` | `    clock: createFixedClock(),` → `    clock: createFixedClock(), ...dataPortDeps(),` (once); `replace_all` `snapshotStore, clock: createFixedClock() }` → `snapshotStore, clock: createFixedClock(), ...dataPortDeps() }` (2 occurrences) |
  | `tests/host/city-view-store-wiring.test.ts` | the same two edits (1 + 1 occurrence). **Stays at 450:** also replace `import type { CameraBookmark, CodebaseSnapshot } from '../../src/domain/model';` with `import type { CameraBookmark, CodebaseProfile, CodebaseSnapshot } from '../../src/domain/model';` and delete the line `import type { CodebaseProfile } from '../../src/domain/model';` |
  | `tests/host/city-view-scan-modes.test.ts` | `replace_all` `snapshotStore, clock: createFixedClock() }` → `snapshotStore, clock: createFixedClock(), ...dataPortDeps() }` (2 occurrences) |
  | `tests/host/city-view-cancel.test.ts` | the same `replace_all` (1 occurrence) |
  | `tests/host/lifecycle-leaks.test.ts` | `    clock: createFixedClock(),` → `    clock: createFixedClock(), ...dataPortDeps(),`; the same `replace_all` (1 occurrence) |
  | `tests/host/multi-leaf.test.ts` | `    clock: createFixedClock(),` → `    clock: createFixedClock(), ...dataPortDeps(),` |
  | `tests/host/window-migration.test.ts` | the same `replace_all` (1 occurrence); `      snapshotStore: new InMemorySnapshotStore(createFixedClock()), clock: createFixedClock(),` → `      snapshotStore: new InMemorySnapshotStore(createFixedClock()), clock: createFixedClock(), ...dataPortDeps(),` |
  | `tests/acceptance/view-harness.ts` | `    snapshotStore, clock: createFixedClock(),` → `    snapshotStore, clock: createFixedClock(), ...dataPortDeps(),` |

  `grep -rn "getFilesystem: () =>" tests` must then show `dataPortDeps` in the same literal for every hit (the new `city-view-data-ports.test.ts` passes its own `reviewRepositoryFor`); `npm run typecheck` fails on any literal that was missed.

  The settings tab constructions (inline, no new line):
  - `tests/component/settings-tab.test.ts`: replace `    app, {} as unknown as Plugin, profileHarness.store, bindingHarness.store, () => filesystem);` with `    app, {} as unknown as Plugin, profileHarness.store, bindingHarness.store, () => filesystem, { purge: () => Promise.resolve() });`.
  - `tests/component/settings-tab-validation.test.ts`: replace `    () => createFakeSourceFileSystem({}).port);` with `    () => createFakeSourceFileSystem({}).port, { purge: () => Promise.resolve() });`.
  - `tests/host/plugin-onload.test.ts`: the same replacement, in `makeTab()`.

  `tests/component/settings-screen.test.ts` — edit the text **as Task 2 leaves it** (its three Clear tests bind `'repo'` but put no codebase on screen, and Clear is now blocked without one):

  (a) Replace:

```ts
const tab = (w: ReturnType<typeof mountS>, id: string) => w.find(`[role="tab"][data-tab-id="${id}"]`).trigger('click');
```

  with:

```ts
const tab = (w: ReturnType<typeof mountS>, id: string) => w.find(`[role="tab"][data-tab-id="${id}"]`).trigger('click');
/** Part 6 R3: Clear is aria-disabled until a codebase is on screen. */
function onScreen(): void {
  const snap = buildSnapshotFixture({ files: 1, repositoryId: 'repo' });
  useCityStore().setCity(snap, computeLayout(snap));
}
```

  (b) Replace `    await useReviewStore().bindRepository('repo'); // Part 6 Y14: only a bound codebase is cleared` with:

```ts
    await useReviewStore().bindRepository('repo'); // Part 6 Y14: only a bound codebase is cleared
    onScreen();
```

  (c) Replace:

```ts
    await review.bindRepository('repo'); // Part 6 Y14
    // Part 5 V32: the rejecting repository must HOLD the item. With an empty one, the reload
```

  with:

```ts
    await review.bindRepository('repo'); // Part 6 Y14
    onScreen();
    // Part 5 V32: the rejecting repository must HOLD the item. With an empty one, the reload
```

  (d) Replace `    await review.bindRepository('repo'); // Part 6 Y14: refused for the pending save, not for being unbound` with:

```ts
    await review.bindRepository('repo'); // Part 6 Y14: refused for the pending save, not for being unbound
    onScreen();
```

  (The file already imports `buildSnapshotFixture`, `computeLayout` and `useCityStore`. If Task 2's final text for these three lines differs, anchor on Task 2's actual bind line in each of the three Clear tests and report it.)

- [ ] **Step 9: Run and confirm it passes.** `npx vitest run tests/host/data-ports.test.ts tests/host/city-view-data-ports.test.ts tests/component/settings-tab-purge.test.ts tests/component/settings-privacy-storage.test.ts tests/host/plugin-onload.test.ts tests/component/settings-tab.test.ts tests/component/settings-tab-validation.test.ts tests/component/settings-screen.test.ts tests/component/settings-import.test.ts tests/component/quality-dialog-status.test.ts tests/component/workbench-screen.test.ts tests/unit/review-state.test.ts tests/host/city-view.test.ts tests/host/city-view-store-wiring.test.ts tests/host/city-view-scan-modes.test.ts tests/host/city-view-cancel.test.ts tests/host/lifecycle-leaks.test.ts tests/host/multi-leaf.test.ts tests/host/window-migration.test.ts tests/component/workspace-shell.test.ts tests/acceptance/wp01.steps.ts tests/unit/city-budget.test.ts tests/unit/css-class-scope.test.ts`, plus every file `grep -rln "PLAN_MD_NOTE\|FINDING_DISMISSED\|WORK_DELETE_CONFIRM_TEXT\|WORKBENCH_CARD_TOTAL_CAPTION" tests` lists. Expected: PASS.
- [ ] **Step 10: Gate.** `npm run typecheck && npm run lint:fast && npx vitest run <the Step 9 list>`, then `npx eslint src/host/data-ports.ts src/host/city-scan-controller.ts src/host/city-view.ts src/main.ts src/host/settings-tab.ts src/host/setting-definitions.ts src/ui/App.vue src/ui/screens/settings/PrivacyRows.vue src/ui/audit-copy/settings.ts src/ui/audit-copy/quality.ts src/ui/audit-copy/workbench.ts src/ui/audit-copy/storage.ts tests/fixtures/data-port-deps.ts tests/host/data-ports.test.ts tests/host/city-view-data-ports.test.ts tests/component/settings-tab-purge.test.ts tests/component/settings-privacy-storage.test.ts tests/host/plugin-onload.test.ts tests/component/settings-tab.test.ts tests/component/settings-tab-validation.test.ts tests/component/settings-screen.test.ts tests/host/city-view.test.ts tests/host/city-view-store-wiring.test.ts tests/host/city-view-scan-modes.test.ts tests/host/city-view-cancel.test.ts tests/host/lifecycle-leaks.test.ts tests/host/multi-leaf.test.ts tests/host/window-migration.test.ts tests/acceptance/view-harness.ts --max-warnings 0`. Line counts: `src/host/city-view.ts` 278 (≤ 360), `tests/host/city-view-store-wiring.test.ts` exactly 450, `tests/component/settings-tab.test.ts` 435, every other touched test ≤ 450, `PrivacyRows.vue` ≤ 400.
- [ ] **Step 11: Commit.**

```
git add src/host/data-ports.ts src/host/city-scan-controller.ts src/host/city-view.ts src/main.ts src/host/settings-tab.ts src/host/setting-definitions.ts src/ui/App.vue src/ui/screens/settings/PrivacyRows.vue src/ui/audit-copy/settings.ts src/ui/audit-copy/quality.ts src/ui/audit-copy/workbench.ts src/ui/audit-copy/storage.ts tests/fixtures/data-port-deps.ts tests/host/data-ports.test.ts tests/host/city-view-data-ports.test.ts tests/component/settings-tab-purge.test.ts tests/component/settings-privacy-storage.test.ts tests/host/plugin-onload.test.ts tests/component/settings-tab.test.ts tests/component/settings-tab-validation.test.ts tests/component/settings-screen.test.ts tests/host/city-view.test.ts tests/host/city-view-store-wiring.test.ts tests/host/city-view-scan-modes.test.ts tests/host/city-view-cancel.test.ts tests/host/lifecycle-leaks.test.ts tests/host/multi-leaf.test.ts tests/host/window-migration.test.ts tests/acceptance/view-harness.ts
git commit -m "feat(host): wire the durable review state — one registry per plugin, data ports wired and unwired per leaf, purge with the profile, truthful storage copy and Settings line (Y7, Y11, Y17, R2, R3)" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---


---

### Task 5: Fallow fixtures, raw schema, reader and the no-process guard (Y20–Y22, Y31 codes)

**Files:**
- Step 0 (CONTROLLER, before dispatch; see below): create `tests/fixtures/fallow/project/{package.json,src/index.ts,src/layout/partition.ts,src/text/format.ts,src/text/sum-a.ts,src/text/sum-b.ts}`, the five recorded `tests/fixtures/fallow/*.json` and `tests/fixtures/fallow/README.md`; modify `tsconfig.test.json` (+2), `eslint.config.mjs` (+2), `.oxlintrc.json` (±0, one array grows).
- Create: `src/application/evidence/raw-fallow.ts` (103)
- Create: `src/application/evidence/fallow-report-schema.ts` (75)
- Create: `src/application/evidence/read-fallow-report.ts` (70)
- Ruling R4: there is **no** `src/adapters/fallow/` folder. All fallow modules live in `src/application/evidence/`, which the UI may import (an existing edge, for example `view-surface.ts` → `application/run-state`).
- Create: `src/ui/audit-copy/fallow.ts` (84)
- Modify: `src/ui/inspector-copy.ts` (297 + Tasks 1/3 lines → +1)
- Create: `tests/fixtures/fallow-fixture.ts` (90)
- Create: `tests/unit/fallow-report-reader.test.ts` (149), `tests/unit/fallow-copy.test.ts` (43), `tests/unit/no-process-execution.test.ts` (99)

**Interfaces:**
- Consumes (Step 0): the five recorded reports and the fixture project.
- Consumes (existing): `zod` (already used by `src/domain/validator.ts`). Nothing in `src/application/evidence/` imports `src/ui`. `src/ui/audit-copy/fallow.ts` imports from `src/application/evidence/raw-fallow.ts`.
- Produces, in `src/application/evidence/raw-fallow.ts`:
  - `type FallowReportKind = 'combined' | 'dead-code' | 'health' | 'dupes'`;
  - `FALLOW_SUPPORTED: readonly { kind: FallowReportKind; schema: number }[]` (exactly combined@11, combined@12, dead-code@9, health@11, dupes@10);
  - `isSupportedFallow(kind: unknown, schema: unknown): kind is FallowReportKind`;
  - `FALLOW_REPORT_MAX_BYTES = 16 * 1024 * 1024`;
  - `type FallowImportErrorCode = 'too-large' | 'not-json' | 'unsupported' | 'invalid' | 'source-mismatch' | 'read-failed'`;
  - `RawFallowReport` and its parts `RawUnusedEntry`, `RawCheckSection`, `RawCloneInstance`, `RawCloneGroup`, `RawDupesSection`, `RawHealthFinding`, `RawHealthSection`, `RawWorkspaceDiagnostic`;
  - `type FallowReadResult = { ok: true; report: RawFallowReport } | { ok: false; code: FallowImportErrorCode; detail: string }`.
- Produces, in `src/application/evidence/fallow-report-schema.ts`: `FALLOW_REPORT` (the zod discriminated union).
- Produces, in `src/application/evidence/read-fallow-report.ts`:
  - `parseFallowReportText(text: string): FallowReadResult`;
  - `readFallowReportFile(file: File): Promise<FallowReadResult>`.
- Produces, in `src/ui/audit-copy/fallow.ts` (re-exported by `inspector-copy.ts`): `FALLOW_SUPPORTED_TEXT`, `FALLOW_UNSUPPORTED(kind: string, schema: string): string`, `FALLOW_IMPORT_ERROR: Readonly<Record<FallowImportErrorCode, (detail: string) => string>>`, `fallowNotShownLabel(key: string): string`.
- `detail`:
  - for `unsupported`: `<kind>@<schema_version>` (kind clipped to 40 characters), or `''` when the document does not name a string kind and a finite numeric schema;
  - for `invalid`: the first zod issue's path joined by `.` (for example `health.findings.0.cognitive`), clipped to 120;
  - otherwise `''`. `source-mismatch` is never produced here: Task 10 decides it after resolving against the snapshot.
- Order of checks in `parseFallowReportText`: text length > 16 MB → `too-large`; one leading U+FEFF is dropped; `JSON.parse` → `not-json`; the `(kind, schema_version)` pair not in `FALLOW_SUPPORTED` → `unsupported`; the schema → `invalid`.
- **Schema discipline (ruling R4; the Global Constraint is amended):** the fallow objects use zod 4's default `z.object`, which **tolerates and strips** unknown keys, NOT `z.looseObject`. `looseObject` would tolerate them too but passes them through into the parse output (verified against zod 4.6.5: `fragment` survives a looseObject parse). That contradicts Y23's "dropped at parse time and never stored". It would also keep source text in the import dialog's memory while the user reviews the mapping, because the dialog re-normalises the raw report when the mapping checkbox changes (Y26).

- [ ] **Step 0 (CONTROLLER pre-step, before dispatching the implementer): record the fixtures.** Run everything from the worktree root in **Git Bash** (PowerShell 5.1's `>` writes UTF-16 and `Out-File -Encoding utf8` writes a BOM; both would corrupt the recordings).

  (a) Create the fixture project, verbatim (these are exactly the dry-run files; every file ends with one newline, LF):

  `tests/fixtures/fallow/project/package.json`:

```json
{ "name": "fallow-fixture", "version": "1.0.0", "private": true, "type": "module", "main": "src/index.ts" }
```

  `tests/fixtures/fallow/project/src/index.ts`:

```ts
import { formatLabel } from './text/format';
import { partitionDistrict } from './layout/partition';
import { sumA } from './text/sum-a';
import { sumB } from './text/sum-b';

export function main(input: number[]): string {
  const parts = partitionDistrict(input, 3, true, false);
  return formatLabel(String(parts.length + sumA(input) + sumB(input)));
}
```

  `tests/fixtures/fallow/project/src/layout/partition.ts`:

```ts
export function partitionDistrict(values: number[], size: number, strict: boolean, reverse: boolean): number[][] {
  const out: number[][] = [];
  let current: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i] ?? 0;
    if (strict && v < 0) {
      if (reverse) {
        if (current.length > 0) { out.push(current); current = []; }
      } else if (v < -10) {
        continue;
      } else {
        current.push(-v);
      }
    } else if (v === 0) {
      if (reverse && current.length > 1) {
        current.reverse();
      } else if (!reverse && current.length > 2) {
        current.sort();
      }
    } else if (current.length >= size) {
      if (strict) {
        out.push(current);
      } else if (reverse) {
        out.unshift(current);
      } else {
        out.push(current.slice());
      }
      current = [v];
    } else {
      current.push(v);
    }
  }
  if (current.length > 0) {
    if (reverse) { out.unshift(current); } else { out.push(current); }
  }
  return out;
}
```

  `tests/fixtures/fallow/project/src/text/format.ts`:

```ts
export interface LabelOptions { upper: boolean }

export function formatLabel(value: string): string {
  return `[${value}]`;
}

export function unusedHelper(value: string): string {
  return value.trim();
}
```

  `tests/fixtures/fallow/project/src/text/sum-a.ts`:

```ts
export function sumA(values: number[]): number {
  let total = 0;
  for (const value of values) {
    if (value > 10) {
      total += value * 2;
    } else if (value > 5) {
      total += value + 1;
    } else {
      total += value;
    }
  }
  const scaled = total * 3;
  const offset = scaled - 7;
  const bounded = Math.max(0, Math.min(offset, 1000));
  return bounded;
}
```

  `tests/fixtures/fallow/project/src/text/sum-b.ts`:

```ts
export function sumB(values: number[]): number {
  let total = 0;
  for (const value of values) {
    if (value > 10) {
      total += value * 2;
    } else if (value > 5) {
      total += value + 1;
    } else {
      total += value;
    }
  }
  const scaled = total * 3;
  const offset = scaled - 7;
  const bounded = Math.max(0, Math.min(offset, 1000));
  return bounded;
}
```

  Do **not** copy the dry run's `all.json` or `err.txt` into `project/`: outputs go to `tests/fixtures/fallow/`, never inside the analysed root.

  (b) Exclude the project from the repository's own tooling.

  In `tsconfig.test.json`, replace:

```json
  "include": ["tests/**/*.ts", "src/**/*.ts", "src/**/*.vue"]
}
```

  with:

```json
  "include": ["tests/**/*.ts", "src/**/*.ts", "src/**/*.vue"],
  // Part 6 Y21: the fallow fixture project is analysed by fallow, never compiled.
  "exclude": ["tests/fixtures/fallow/project/**"]
}
```

  In `eslint.config.mjs`, replace:

```js
  { ignores: ['dist/**', 'docs/**', 'node_modules/**', 'package.json', '.obsidian/**'] },
```

  with:

```js
  // tests/fixtures/fallow/project/** is Part 6's fallow fixture project (Y21): analysed by
  // fallow, excluded from tsconfig.test.json, so it cannot be type-aware linted either.
  { ignores: ['dist/**', 'docs/**', 'node_modules/**', 'package.json', '.obsidian/**', 'tests/fixtures/fallow/project/**'] },
```

  In `.oxlintrc.json`, replace:

```json
  "ignorePatterns": ["dist/**", "docs/**", "node_modules/**"]
```

  with:

```json
  "ignorePatterns": ["dist/**", "docs/**", "node_modules/**", "tests/fixtures/fallow/project/**"]
```

  The repository's own `npm run analyze` is `fallow dead-code src`, so it needs no change.

  (c) Record the five reports with the fallow binaries already in the npx cache (no download). `--offline` makes npx refuse to fetch; both versions are cached (`%LOCALAPPDATA%/npm-cache/_npx/ee3f2ca80543beb5` is 3.27.0 and `…/e6d07818f0a04ee4` is 3.21.0, whose `node_modules/.bin/fallow` can be called directly instead). A non-zero exit status is normal when a report has findings; the JSON is still complete.

```bash
R=tests/fixtures/fallow/project
O=tests/fixtures/fallow
npx --offline --yes fallow@3.27.0 --format json --no-cache --quiet --root "$R" > "$O/combined-3.27.0.json"
npx --offline --yes fallow@3.27.0 dead-code --format json --no-cache --quiet --root "$R" > "$O/dead-code-3.27.0.json"
npx --offline --yes fallow@3.27.0 health --format json --no-cache --quiet --root "$R" > "$O/health-3.27.0.json"
npx --offline --yes fallow@3.27.0 dupes --format json --no-cache --quiet --root "$R" > "$O/dupes-3.27.0.json"
npx --offline --yes fallow@3.21.0 --format json --no-cache --quiet --root "$R" > "$O/combined-3.21.0.json"
```

  (d) Check the recordings before committing. `git status --porcelain` lists only `tests/fixtures/fallow/**` and the three config files (no cache directory, nothing written inside `project/`). No file starts with a BOM (`head -c 3 "$O/combined-3.27.0.json" | od -c` shows `{` then `"`). Then:

```bash
node -e '
const fs = require("fs");
for (const n of ["combined-3.27.0", "dead-code-3.27.0", "health-3.27.0", "dupes-3.27.0", "combined-3.21.0"]) {
  const j = JSON.parse(fs.readFileSync(`tests/fixtures/fallow/${n}.json`, "utf8"));
  const s = j.kind === "combined" ? j : { check: j.kind === "dead-code" ? j : null, health: j.kind === "health" ? j : null, dupes: j.kind === "dupes" ? j : null };
  console.log(n, j.kind, j.schema_version, j.version);
  if (s.check) console.log("  unused", s.check.unused_exports.map((e) => `${e.export_name} ${e.path}:${e.line}:${e.col}`), s.check.unused_types.map((e) => `${e.export_name} ${e.path}:${e.line}:${e.col}`));
  if (s.health) console.log("  health", s.health.findings.map((f) => `${f.name} ${f.path}:${f.line} cog ${f.cognitive} cyc ${f.cyclomatic} lines ${f.line_count} ${f.severity} ${f.exceeded}`), s.health.summary.max_cyclomatic_threshold, s.health.summary.max_cognitive_threshold);
  if (s.dupes) console.log("  dupes", s.dupes.clone_groups.map((g) => `${g.fingerprint} ${g.token_count}/${g.line_count} ${g.instances.map((i) => `${i.file}:${i.start_line}-${i.end_line}`).join(",")}`));
  console.log("  diagnostics", (j.workspace_diagnostics || []).length);
}'
```

  Expected for every 3.27.0 file that carries the section (the tests encode these dry-run facts):
  - unused: `unusedHelper src/text/format.ts:7:16` and type `LabelOptions src/text/format.ts:1:17`;
  - health: `partitionDistrict src/layout/partition.ts:1 cog 32 cyc 18 lines 37 critical cognitive_crap`, thresholds `20 15`;
  - dupes: one group `dup:6f87acd9 93/15 src/text/sum-a.ts:1-15,src/text/sum-b.ts:1-15` (the fingerprint is read from the recording by the tests; only its presence matters);
  - combined 3.27.0: diagnostics ≥ 1 (the dry run had 3).

  For `combined-3.21.0`: kind `combined`, schema `11`, version `3.21.0`, and the same names, paths and lines. Its severity, `exceeded` and fingerprint may differ and are not asserted. **If any other value differs (an extra finding, a different line or column, a missing section), stop: the Task 5/6 tests encode the dry run, and the controller rules on the change.**

  (e) Write `tests/fixtures/fallow/README.md`:

````markdown
# fallow fixtures (WP-02 Part 6, Y21)

Raw fallow JSON reports of the fixture project in `project/`, recorded once and committed
verbatim, `fragment` and `actions` included: the tests prove those fields are dropped.
Never edit a recording by hand. Re-record with the commands below and review every test
that changes.

## The fixture project

`project/` is a package.json and five small TypeScript files (`.ts`, because
`unused_types` needs TypeScript). A dry run with fallow 3.27.0 found exactly:

- one unused export, `unusedHelper` in `src/text/format.ts`;
- one unused type, `LabelOptions` in `src/text/format.ts`;
- one clone group across `src/text/sum-a.ts` and `src/text/sum-b.ts` (lines 1–15);
- one complexity finding above the default thresholds, `partitionDistrict` in
  `src/layout/partition.ts` (cognitive 32 against 15).

It is excluded from `tsconfig.test.json`, eslint and oxlint. The repository's own
`npm run analyze` scans `src` only.

## Recordings

Recorded on 2026-09-23 from the repository root, in Git Bash, with the fallow binaries
already in the npx cache (`npx --offline`, no download). Nothing under `src/` or in
`package.json` runs fallow.

| File | fallow | kind, schema | Command |
|---|---|---|---|
| `combined-3.27.0.json` | 3.27.0 | combined, 12 | `fallow --format json --no-cache --quiet --root tests/fixtures/fallow/project` |
| `dead-code-3.27.0.json` | 3.27.0 | dead-code, 9 | `fallow dead-code --format json --no-cache --quiet --root tests/fixtures/fallow/project` |
| `health-3.27.0.json` | 3.27.0 | health, 11 | `fallow health --format json --no-cache --quiet --root tests/fixtures/fallow/project` |
| `dupes-3.27.0.json` | 3.27.0 | dupes, 10 | `fallow dupes --format json --no-cache --quiet --root tests/fixtures/fallow/project` |
| `combined-3.21.0.json` | 3.21.0 | combined, 11 | `fallow --format json --no-cache --quiet --root tests/fixtures/fallow/project` |

Each command was run as `npx --offline --yes fallow@<version> <arguments> > <file>`.

## Values that change on every recording

`elapsed_ms` (at every level) and `_meta.telemetry.analysis_run_id` differ on every run,
and `workspace_diagnostics` depends on the machine (for example, whether `node_modules`
exists). The parser drops the first two; no test asserts on them, and the tests compare
warnings with each recording's own `workspace_diagnostics` messages.
````

  (f) Verify, then commit (controller):

```bash
npm run typecheck && npm run lint:fast && npx eslint tests --max-warnings 0
git add tests/fixtures/fallow tsconfig.test.json eslint.config.mjs .oxlintrc.json
git commit -m "test(fixtures): fallow fixture project and raw reports 3.27.0 and 3.21.0 (Part 6 Y21)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

  The implementer starts after this commit.

- [ ] **Step 1: Write the shared fixture helper.** Create `tests/fixtures/fallow-fixture.ts`:

```ts
// Part 6 Y21: the recorded fallow reports (tests/fixtures/fallow/*.json, see its README)
// and helpers to break them one field at a time. The recordings are committed verbatim,
// `fragment` and `actions` included, because the tests prove those are dropped.
// Never assert on elapsed_ms, _meta or next_steps: they change on every recording.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import type { RawFallowReport } from '../../src/application/evidence/raw-fallow';

const DIR = fileURLToPath(new URL('./fallow/', import.meta.url));

export const FALLOW_FIXTURES = ['combined-3.27.0', 'dead-code-3.27.0', 'health-3.27.0', 'dupes-3.27.0', 'combined-3.21.0'] as const;
export type FallowFixture = (typeof FALLOW_FIXTURES)[number];

type Row = Record<string, unknown>;

/** A report's JSON shape, loose enough for a test to break any field. Single-command
 *  reports carry their one section's fields at the top level (read them as `Row[]`). */
export interface FallowDoc {
  kind: unknown;
  schema_version: unknown;
  version: unknown;
  check?: { summary: Record<string, unknown>; unused_exports: Row[]; unused_types: Row[]; [key: string]: unknown } | null;
  dupes?: { clone_groups: (Row & { instances: Row[] })[]; [key: string]: unknown };
  health?: { findings: Row[]; summary: Row; [key: string]: unknown };
  workspace_diagnostics?: Row[];
  [key: string]: unknown;
}

export const fallowText = (name: FallowFixture): string => readFileSync(join(DIR, `${name}.json`), 'utf8');

/** A fresh copy of a recorded report, with one change applied. */
export function fallowDoc(name: FallowFixture, change?: (doc: FallowDoc) => void): FallowDoc {
  const doc = JSON.parse(fallowText(name)) as FallowDoc;
  change?.(doc);
  return doc;
}

/** Top-level rows of a single-command report (`unused_exports`, `findings`, `clone_groups`, …). */
export const rows = (doc: FallowDoc, key: string): Row[] => doc[key] as Row[];

/** "accepted", or the refusal as "<code> <detail>" (for example "invalid version"). */
export function fallowOutcome(doc: unknown): string {
  const result = parseFallowReportText(JSON.stringify(doc));
  return result.ok ? 'accepted' : `${result.code} ${result.detail}`.trim();
}

/** The validated report, for a fixture name or an edited document. */
export function rawReport(source: FallowFixture | FallowDoc): RawFallowReport {
  const text = typeof source === 'string' ? fallowText(source) : JSON.stringify(source);
  const result = parseFallowReportText(text);
  if (!result.ok) throw new Error(`refused: ${result.code} ${result.detail}`);
  return result.report;
}

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...listTs(abs));
    else if (name.endsWith('.ts')) out.push(abs);
  }
  return out;
}

/** Every source line of the fixture project that is long enough to be unmistakable
 *  (12+ characters once trimmed). None may appear in anything the plugin keeps. */
export function fixtureSourceLines(): string[] {
  const lines = listTs(join(DIR, 'project', 'src')).flatMap((f) => readFileSync(f, 'utf8').split(/\r?\n/));
  return lines.map((l) => l.trim()).filter((l) => l.length >= 12);
}

/** Every key at any depth of a JSON-like value. */
export function deepKeys(value: unknown): Set<string> {
  const keys = new Set<string>();
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (typeof v !== 'object' || v === null) return;
    for (const [k, child] of Object.entries(v)) { keys.add(k); visit(child); }
  };
  visit(value);
  return keys;
}

/** Y23: fields fallow writes that must never survive the parse. */
export const DROPPED_KEYS = [
  'fragment', 'actions', 'suggestions', 'clone_families', 'vital_signs', 'file_scores', 'hotspots', 'targets',
  'health_score', 'next_steps', '_meta', 'elapsed_ms',
] as const;
```

- [ ] **Step 2: Write the failing reader tests.** Create `tests/unit/fallow-report-reader.test.ts`:

```ts
// Part 6 Y20-Y22, Y31: reading a fallow report. The recorded fixtures, the supported
// (kind, schema) set, the size limit, JSON, the schema's first issue path, and the
// fields that must never survive the parse.
import { describe, expect, it, vi } from 'vitest';
import { parseFallowReportText, readFallowReportFile } from '../../src/application/evidence/read-fallow-report';
import { FALLOW_REPORT_MAX_BYTES, FALLOW_SUPPORTED } from '../../src/application/evidence/raw-fallow';
import {
  DROPPED_KEYS, FALLOW_FIXTURES, deepKeys, fallowDoc, fallowOutcome, fallowText, rawReport, rows, type FallowDoc, type FallowFixture,
} from '../fixtures/fallow-fixture';

const BOM = String.fromCharCode(0xfeff);
type Change = (d: FallowDoc) => void;

describe('fallow reader: the recorded fixtures (Part 6 Y20, Y21)', () => {
  it.each<[FallowFixture, string, number, string]>([
    ['combined-3.27.0', 'combined', 12, '3.27.0'],
    ['dead-code-3.27.0', 'dead-code', 9, '3.27.0'],
    ['health-3.27.0', 'health', 11, '3.27.0'],
    ['dupes-3.27.0', 'dupes', 10, '3.27.0'],
    ['combined-3.21.0', 'combined', 11, '3.21.0'],
  ])('accepts %s', (name, kind, schema, version) => {
    const report = rawReport(name);
    expect([report.kind, report.schema_version, report.version]).toEqual([kind, schema, version]);
  });

  it('supports exactly the recorded (kind, schema) pairs', () => {
    expect(FALLOW_SUPPORTED.map((s) => `${s.kind}@${s.schema}`).sort()).toEqual(['combined@11', 'combined@12', 'dead-code@9', 'dupes@10', 'health@11']);
    expect(FALLOW_FIXTURES).toHaveLength(5);
  });

  it('reads the fields it uses from the combined 3.27.0 report', () => {
    const report = rawReport('combined-3.27.0');
    if (report.kind !== 'combined') throw new Error('expected a combined report');
    expect(report.check?.unused_exports).toEqual([{ path: 'src/text/format.ts', export_name: 'unusedHelper', is_type_only: false, line: 7, col: 16 }]);
    expect(report.check?.unused_types).toEqual([{ path: 'src/text/format.ts', export_name: 'LabelOptions', is_type_only: true, line: 1, col: 17 }]);
    expect(report.dupes?.clone_groups).toEqual([{
      fingerprint: fallowDoc('combined-3.27.0').dupes!.clone_groups[0]!.fingerprint, token_count: 93, line_count: 15,
      instances: [{ file: 'src/text/sum-a.ts', start_line: 1, end_line: 15 }, { file: 'src/text/sum-b.ts', start_line: 1, end_line: 15 }],
    }]);
    expect(report.health?.findings).toEqual([{
      path: 'src/layout/partition.ts', name: 'partitionDistrict', line: 1, col: 7,
      cyclomatic: 18, cognitive: 32, line_count: 37, exceeded: 'cognitive_crap', severity: 'critical',
    }]);
    expect(report.health?.summary).toEqual({ max_cyclomatic_threshold: 20, max_cognitive_threshold: 15 });
    expect(report.check?.summary.unused_exports).toBe(1);
  });

  it.each(FALLOW_FIXTURES)('drops every field it does not read from %s: no fragment, action or telemetry survives', (name) => {
    expect(deepKeys(JSON.parse(fallowText(name))).has('actions')).toBe(true);
    const keys = deepKeys(rawReport(name));
    expect(keys.size).toBeGreaterThan(0);
    for (const dropped of DROPPED_KEYS) expect({ name, dropped, kept: keys.has(dropped) }).toEqual({ name, dropped, kept: false });
  });
});

describe('fallow reader: refusals (Part 6 Y20, Y31)', () => {
  it('refuses text over 16 MB, and text that is not JSON', () => {
    expect(parseFallowReportText(' '.repeat(FALLOW_REPORT_MAX_BYTES + 1))).toEqual({ ok: false, code: 'too-large', detail: '' });
    for (const text of ['{', '', 'undefined', 'NaN', fallowText('combined-3.27.0').slice(0, 200)]) {
      expect(parseFallowReportText(text), text.slice(0, 20)).toEqual({ ok: false, code: 'not-json', detail: '' });
    }
  });

  it('accepts a report saved with a byte order mark', () => {
    expect(parseFallowReportText(BOM + fallowText('dead-code-3.27.0')).ok).toBe(true);
  });

  it.each<[string, unknown, string]>([
    ['a newer combined schema', { kind: 'combined', schema_version: 13, version: '3.30.0' }, 'unsupported combined@13'],
    ['an older combined schema', { kind: 'combined', schema_version: 10, version: '3.10.0' }, 'unsupported combined@10'],
    ['dead-code at the combined schema', { kind: 'dead-code', schema_version: 12, version: '3.27.0' }, 'unsupported dead-code@12'],
    ['an unknown kind', { kind: 'audit', schema_version: 1 }, 'unsupported audit@1'],
    ['a long kind, clipped', { kind: 'k'.repeat(100), schema_version: 1 }, `unsupported ${'k'.repeat(40)}@1`],
    ['a schema given as text', { kind: 'combined', schema_version: '12' }, 'unsupported'],
    ['no kind at all', { schema_version: 12 }, 'unsupported'],
    ['an empty object', {}, 'unsupported'],
    ['an array', [], 'unsupported'],
    ['null', null, 'unsupported'],
    ['a string', 'combined', 'unsupported'],
  ])('refuses %s as unsupported, naming what it found', (_name, doc, expected) => {
    expect(fallowOutcome(doc)).toBe(expected);
  });

  it.each<[string, Change, string]>([
    ['a version that is not major.minor.patch', (d) => { d.version = 'v3'; }, 'invalid version'],
    ['a version over 64 characters', (d) => { d.version = `3.27.0-${'x'.repeat(60)}`; }, 'invalid version'],
    ['a missing cognitive count', (d) => { delete d.health!.findings[0]!.cognitive; }, 'invalid health.findings.0.cognitive'],
    ['a line given as text', (d) => { d.check!.unused_exports[0]!.line = '7'; }, 'invalid check.unused_exports.0.line'],
    ['a negative line', (d) => { d.check!.unused_types[0]!.line = -1; }, 'invalid check.unused_types.0.line'],
    ['a clone instance whose file is a number', (d) => { d.dupes!.clone_groups[0]!.instances[1]!.file = 3; }, 'invalid dupes.clone_groups.0.instances.1.file'],
    ['a summary count given as text', (d) => { d.check!.summary.unused_files = 'none'; }, 'invalid check.summary.unused_files'],
    ['a missing threshold', (d) => { d.health!.summary.max_cognitive_threshold = null; }, 'invalid health.summary.max_cognitive_threshold'],
    ['a null section', (d) => { d.check = null; }, 'invalid check'],
    ['a diagnostic without a message', (d) => { d.workspace_diagnostics = [{ path: '.', kind: 'x' }]; }, 'invalid workspace_diagnostics.0.message'],
  ])('refuses a combined report with %s, naming the first issue', (_name, change, expected) => {
    expect(fallowOutcome(fallowDoc('combined-3.27.0', change))).toBe(expected);
  });

  it.each<[FallowFixture, Change, string]>([
    ['dead-code-3.27.0', (d) => { rows(d, 'unused_types')[0]!.is_type_only = 'yes'; }, 'invalid unused_types.0.is_type_only'],
    ['health-3.27.0', (d) => { rows(d, 'findings')[0]!.severity = 3; }, 'invalid findings.0.severity'],
    ['dupes-3.27.0', (d) => { rows(d, 'clone_groups')[0]!.token_count = 1.5; }, 'invalid clone_groups.0.token_count'],
  ])('refuses a broken single-command report (%s) at its top-level path', (name, change, expected) => {
    expect(fallowOutcome(fallowDoc(name, change))).toBe(expected);
  });
});

describe('fallow reader: what it tolerates (Part 6 Y22)', () => {
  it.each<[string, Change]>([
    ['a new top-level section', (d) => { d.coverage = { files: [] }; }],
    ['a new field on a finding', (d) => { d.health!.findings[0]!.halstead = 12; }],
    ['a new summary count', (d) => { d.check!.summary.unused_widgets = 4; }],
    ['a pre-release version', (d) => { d.version = '3.27.0-beta.1'; }],
    ['no workspace diagnostics (fallow 3.21.0 writes none)', (d) => { delete d.workspace_diagnostics; }],
    ['no health, dupes or check section', (d) => { delete d.health; delete d.dupes; delete d.check; }],
    ['a finding without its fragment and actions', (d) => { delete d.health!.findings[0]!.actions; delete d.dupes!.clone_groups[0]!.instances[0]!.fragment; }],
  ])('accepts a combined report with %s', (_name, change) => {
    expect(fallowOutcome(fallowDoc('combined-3.27.0', change))).toBe('accepted');
  });

  it('drops a new field instead of keeping it', () => {
    const report = rawReport(fallowDoc('combined-3.27.0', (d) => { d.coverage = { files: [] }; d.health!.findings[0]!.halstead = 12; }));
    expect(deepKeys(report).has('coverage')).toBe(false);
    expect(deepKeys(report).has('halstead')).toBe(false);
  });
});

describe('fallow reader: the picked file (Part 6 Y20, Y31)', () => {
  it('refuses a file over 16 MB without reading it', async () => {
    const text = vi.fn(() => Promise.resolve('{}'));
    expect(await readFallowReportFile({ size: FALLOW_REPORT_MAX_BYTES + 1, text } as unknown as File)).toEqual({ ok: false, code: 'too-large', detail: '' });
    expect(text).not.toHaveBeenCalled();
  });

  it('checks the text length again after reading', async () => {
    const long = { size: 10, text: () => Promise.resolve(' '.repeat(FALLOW_REPORT_MAX_BYTES + 1)) } as unknown as File;
    expect(await readFallowReportFile(long)).toMatchObject({ ok: false, code: 'too-large' });
  });

  it('reports a failed read', async () => {
    const failing = { size: 10, text: () => Promise.reject(new Error('gone')) } as unknown as File;
    expect(await readFallowReportFile(failing)).toEqual({ ok: false, code: 'read-failed', detail: '' });
  });

  it('reads a real picked file', async () => {
    const result = await readFallowReportFile(new File([fallowText('health-3.27.0')], 'health.json', { type: 'application/json' }));
    expect(result.ok && result.report.kind).toBe('health');
  });
});
```

  Notes on this file:
  - The `col` values (16, 17, 7) and every number in the "reads the fields it uses" test come from the dry run; Step 0 (d) checked the recording against them.
  - The fingerprint is read from the recording, never restated.
  - `rows(d, key)` reads a single-command report's top-level arrays, which `FallowDoc` types as `unknown`.

- [ ] **Step 3: Write the failing copy test.** Create `tests/unit/fallow-copy.test.ts`:

```ts
// Part 6 Y20, Y25, Y31: the fallow import copy. One message per refusal code, the
// supported set named from FALLOW_SUPPORTED itself, and not-shown labels that fall back
// to fallow's own key.
import { describe, expect, it } from 'vitest';
import { FALLOW_SUPPORTED } from '../../src/application/evidence/raw-fallow';
import {
  FALLOW_IMPORT_ERROR, FALLOW_SUPPORTED_TEXT, FALLOW_UNSUPPORTED, fallowNotShownLabel,
} from '../../src/ui/inspector-copy';

describe('fallow import copy (Part 6 Y20, Y25, Y31)', () => {
  it('has one message for every refusal code, and each says nothing was imported', () => {
    const codes = Object.keys(FALLOW_IMPORT_ERROR).sort();
    expect(codes).toEqual(['invalid', 'not-json', 'read-failed', 'source-mismatch', 'too-large', 'unsupported']);
    for (const code of codes) {
      expect(FALLOW_IMPORT_ERROR[code as keyof typeof FALLOW_IMPORT_ERROR]('')).toContain('Nothing was imported.');
    }
  });

  it('names every supported kind and schema', () => {
    expect(FALLOW_SUPPORTED_TEXT).toBe('combined (schema 11 or 12), dead-code (schema 9), health (schema 11) and dupes (schema 10)');
    expect(FALLOW_SUPPORTED.length).toBeGreaterThan(0);
    for (const s of FALLOW_SUPPORTED) expect(FALLOW_SUPPORTED_TEXT).toContain(s.kind);
  });

  it('says what an unsupported file is when the reader could tell', () => {
    expect(FALLOW_IMPORT_ERROR.unsupported('combined@13')).toBe(FALLOW_UNSUPPORTED('combined', '13'));
    expect(FALLOW_UNSUPPORTED('combined', '13')).toContain('“combined” report at schema 13');
    expect(FALLOW_IMPORT_ERROR.unsupported('')).toBe(`That file is not a fallow report this version can read. Supported: ${FALLOW_SUPPORTED_TEXT}. Nothing was imported.`);
  });

  it('names the first issue of an invalid report', () => {
    expect(FALLOW_IMPORT_ERROR.invalid('health.findings.0.cognitive')).toBe('That fallow report is not valid at health.findings.0.cognitive. Nothing was imported.');
    expect(FALLOW_IMPORT_ERROR.invalid('')).toBe('That fallow report is not valid. Nothing was imported.');
  });

  it('labels a known not-shown count and shows an unknown key as it is, never an inherited property', () => {
    expect(fallowNotShownLabel('unused_files')).toBe('Unused files');
    expect(fallowNotShownLabel('circular_dependencies')).toBe('Circular dependencies');
    expect(fallowNotShownLabel('clone_groups_omitted')).toBe('Clone groups left out of the report');
    expect(fallowNotShownLabel('unused_widgets')).toBe('unused_widgets');
    for (const key of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) expect(fallowNotShownLabel(key)).toBe(key);
  });
});
```

- [ ] **Step 4: Write the no-process guard.** Create `tests/unit/no-process-execution.test.ts`:

```ts
// Part 6 acceptance evidence (2) for the Fallow Ingestion deliverable: importing a report
// runs no code, and nothing under src/ can start a process or hand a path to the shell.
// A static scan of every source file, comments stripped (they legitimately NAME what is
// banned, to say why). It covers:
// - any mention of the child_process or worker_threads modules in code, in any spelling a
//   static import, a dynamic import() or a window.require() call would use;
// - a call to spawn, spawnSync, exec, execSync, execFile, execFileSync or fork, bare or
//   as a member (`cp.spawn(`), EXCEPT a member `.exec(`: that is RegExp.prototype.exec,
//   used today by src/domain/path-safety.ts and src/ui/stores/review-store.ts. The only
//   way to hold a child_process object is the module, which the first check bans, and
//   tests/unit/node-access-boundary.test.ts pins window.require to node-access.ts;
// - `openPath` (Electron's shell.openPath) anywhere in code.
// Not exhaustive: a specifier assembled at run time would evade any text scan. What it
// covers is stated per test below, as node-access-boundary.test.ts does.
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = fileURLToPath(new URL('../../src', import.meta.url));

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...listSourceFiles(abs));
    else if (/\.(ts|vue|js|mjs|cjs)$/.test(name)) out.push(abs);
  }
  return out;
}

/** Block, line and HTML comments out; `//` after a ':' is kept (a URL, not a comment). */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const BANNED_MODULE = /\b(child_process|worker_threads)\b/;
const PROCESS_CALL = /(?<![\w$.])(spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)\s*\(|\.(spawn|spawnSync|execSync|execFile|execFileSync|fork)\s*\(/;
const OPEN_PATH = /\bopenPath\b/;

/** Every reason this source could start a process or open a path, as short labels. */
function processHazards(source: string): string[] {
  const code = codeOf(source);
  return [
    ...(BANNED_MODULE.test(code) ? ['process module'] : []),
    ...(PROCESS_CALL.test(code) ? ['process call'] : []),
    ...(OPEN_PATH.test(code) ? ['shell.openPath'] : []),
  ];
}

describe('nothing under src/ runs a process (Part 6 acceptance 2)', () => {
  const files = listSourceFiles(SRC_ROOT);

  it('has source files to check (the scan is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no file mentions child_process or worker_threads, calls spawn/exec/execFile/fork, or opens a path', () => {
    const offenders = files
      .map((f) => ({ file: relative(SRC_ROOT, f).replace(/\\/g, '/'), hazards: processHazards(readFileSync(f, 'utf8')) }))
      .filter((o) => o.hazards.length > 0);
    expect(offenders).toEqual([]);
  });
});

// The detector itself, one case per spelling, independent of what src/ holds today.
describe('process hazard detection', () => {
  it.each([
    ["import { spawn } from 'node:child_process';", 'process module'],
    ["import * as cp from 'child_process';", 'process module'],
    ["const cp = await import('node:child_process');", 'process module'],
    ["const cp = window.require('child_process');", 'process module'],
    ["const { Worker } = window.require('node:worker_threads');", 'process module'],
    ["spawn('fallow', ['--format', 'json']);", 'process call'],
    ["exec('fallow --version');", 'process call'],
    ["execFile('fallow', []);", 'process call'],
    ["runner.execFileSync('fallow');", 'process call'],
    ["proc.spawn ('fallow');", 'process call'],
    ["fork('worker.js');", 'process call'],
    ["shell.openPath(report);", 'shell.openPath'],
    ["const { openPath } = shell;", 'shell.openPath'],
  ])('flags %s', (source, label) => {
    expect(processHazards(source)).toContain(label);
  });

  it.each([
    "const drive = /^[A-Za-z]:/.exec(posix)?.[0] ?? null;",
    "const digits = pattern.exec(id)?.[1];",
    "// spawn('fallow') is Part 7's job, never this one",
    "/* import { exec } from 'node:child_process' */ const x = 1;",
    "<!-- openPath is not used --><p>Run nothing</p>",
    "const executable = 'fallow'; const spawned = false; const forked = 0;",
  ])('does not flag %s', (source) => {
    expect(processHazards(source)).toEqual([]);
  });
});
```

  This guard was checked against today's `src/` (250 `.ts`/`.vue` files): zero hits. The only near-misses are the two `RegExp.prototype.exec` calls (`src/domain/path-safety.ts:52`, `src/ui/stores/review-store.ts:15`), which the member-`.exec(` exemption covers. If Task 2 has moved `review-store.ts`'s `pattern.exec(id)` elsewhere, the exemption still covers it.

- [ ] **Step 5: Run them and confirm they fail.** Run `npx vitest run tests/unit/fallow-report-reader.test.ts tests/unit/fallow-copy.test.ts tests/unit/no-process-execution.test.ts`. Expected:
  - `fallow-report-reader` fails to load with `Failed to resolve import "../../src/application/evidence/read-fallow-report" from "tests/fixtures/fallow-fixture.ts"`.
  - `fallow-copy` fails to load with `Failed to resolve import "../../src/application/evidence/raw-fallow"`.
  - `no-process-execution` **passes**: it is a guard over code that already complies. To see it fail, create a temporary `src/probe-process.ts` containing `export const probe = 'node:child_process';`, re-run it, and paste the failure (`offenders` lists `{ file: 'probe-process.ts', hazards: ['process module'] }`). Then **delete `src/probe-process.ts`** and re-run it green.

- [ ] **Step 6: Implement the raw report type.** Create `src/application/evidence/raw-fallow.ts`:

```ts
// Part 6 Y20/Y22: the fallow report as this plugin reads it. Only the fields the
// normaliser uses are declared; the zod schema beside it (fallow-report-schema.ts)
// checks exactly these and strips the rest, so source text (`fragment`), `actions`,
// `suggestions` and the other sections never reach this type. Plain TypeScript, so the
// UI can import the supported set and the refusal codes without pulling in zod.

export type FallowReportKind = 'combined' | 'dead-code' | 'health' | 'dupes';

/** Y20: exactly the (kind, schema_version) pairs the recorded fixtures cover. */
export const FALLOW_SUPPORTED: readonly { kind: FallowReportKind; schema: number }[] = [
  { kind: 'combined', schema: 11 },
  { kind: 'combined', schema: 12 },
  { kind: 'dead-code', schema: 9 },
  { kind: 'health', schema: 11 },
  { kind: 'dupes', schema: 10 },
];

export function isSupportedFallow(kind: unknown, schema: unknown): kind is FallowReportKind {
  return FALLOW_SUPPORTED.some((s) => s.kind === kind && s.schema === schema);
}

/** Y20: 16 MB, checked with `File.size` before reading and with the text length after. */
export const FALLOW_REPORT_MAX_BYTES = 16 * 1024 * 1024;

/** Y31: every way an import can be refused. `source-mismatch` is decided by the import
 *  dialog after resolving against the snapshot; the reader produces the others. */
export type FallowImportErrorCode = 'too-large' | 'not-json' | 'unsupported' | 'invalid' | 'source-mismatch' | 'read-failed';

export interface RawUnusedEntry {
  path: string;
  export_name: string;
  is_type_only: boolean;
  line: number;
  col: number;
}

export interface RawCheckSection {
  /** Every count fallow reports; Y25 lists the non-zero ones Part 6 does not show. */
  summary: Readonly<Record<string, number>>;
  unused_exports: readonly RawUnusedEntry[];
  unused_types: readonly RawUnusedEntry[];
}

export interface RawCloneInstance {
  file: string;
  start_line: number;
  end_line: number;
}

export interface RawCloneGroup {
  fingerprint: string;
  token_count: number;
  line_count: number;
  instances: readonly RawCloneInstance[];
}

export interface RawDupesSection {
  clone_groups: readonly RawCloneGroup[];
  /** Standalone `dupes` only: groups fallow left out of its own output. */
  clone_groups_omitted?: number;
}

export interface RawHealthFinding {
  path: string;
  name: string;
  line: number;
  col: number;
  cyclomatic: number;
  cognitive: number;
  line_count: number;
  exceeded: string;
  severity: string;
}

export interface RawHealthSection {
  findings: readonly RawHealthFinding[];
  summary: { max_cyclomatic_threshold: number; max_cognitive_threshold: number };
}

export interface RawWorkspaceDiagnostic {
  path: string;
  kind: string;
  message: string;
}

interface RawCommon {
  schema_version: number;
  version: string;
  workspace_diagnostics?: readonly RawWorkspaceDiagnostic[];
}

/** Y22: a combined report nests the three sections; a single-command report carries its
 *  one section's fields at the top level. */
export type RawFallowReport =
  | (RawCommon & { kind: 'combined'; check?: RawCheckSection; dupes?: RawDupesSection; health?: RawHealthSection })
  | (RawCommon & { kind: 'dead-code' } & RawCheckSection)
  | (RawCommon & { kind: 'health' } & RawHealthSection)
  | (RawCommon & { kind: 'dupes' } & RawDupesSection);

/** Y31: a validated report, or ONE refusal. `detail` is data for the copy, never copy. */
export type FallowReadResult =
  | { ok: true; report: RawFallowReport }
  | { ok: false; code: FallowImportErrorCode; detail: string };
```

- [ ] **Step 7: Implement the schema.** Create `src/application/evidence/fallow-report-schema.ts`:

```ts
// Part 6 Y22: zod 4 schemas for the fallow report fields this plugin reads, and nothing
// else. Third-party input, so:
// - every field that is read is type-checked;
// - every other field is tolerated AND dropped: zod 4's `z.object` strips unknown keys,
//   so `fragment` (source text), `actions`, `suggestions`, `clone_families`,
//   `vital_signs`, `file_scores`, `hotspots`, `targets`, `health_score`, `next_steps` and
//   `_meta` never leave the parse (Y23);
// - our own formats stay `.strict()` (review-state-import.ts); this one cannot be,
//   because every fallow release adds fields.
// The parse output is assignable to `RawFallowReport` (read-fallow-report.ts returns it
// as one), so tsc proves this schema and raw-fallow.ts's plain type agree.
import { z } from 'zod';

const COUNT = z.number().int().nonnegative();

const UNUSED_ENTRY = z.object({
  path: z.string(),
  export_name: z.string(),
  is_type_only: z.boolean(),
  line: COUNT,
  col: COUNT,
});
const CHECK_FIELDS = {
  summary: z.record(z.string(), z.number()),
  unused_exports: z.array(UNUSED_ENTRY),
  unused_types: z.array(UNUSED_ENTRY),
};

const CLONE_GROUP = z.object({
  fingerprint: z.string(),
  token_count: COUNT,
  line_count: COUNT,
  instances: z.array(z.object({ file: z.string(), start_line: COUNT, end_line: COUNT })),
});
const DUPES_FIELDS = {
  clone_groups: z.array(CLONE_GROUP),
  clone_groups_omitted: COUNT.optional(),
};

const HEALTH_FINDING = z.object({
  path: z.string(),
  name: z.string(),
  line: COUNT,
  col: COUNT,
  cyclomatic: COUNT,
  cognitive: COUNT,
  line_count: COUNT,
  exceeded: z.string(),
  severity: z.string(),
});
const HEALTH_FIELDS = {
  findings: z.array(HEALTH_FINDING),
  summary: z.object({ max_cyclomatic_threshold: z.number(), max_cognitive_threshold: z.number() }),
};

const COMMON = {
  schema_version: z.number().int(),
  version: z.string().max(64).regex(/^\d+\.\d+\.\d+/, { error: 'Must start with major.minor.patch.' }),
  workspace_diagnostics: z.array(z.object({ path: z.string(), kind: z.string(), message: z.string() })).optional(),
};

/** Y22: a discriminated union on `kind`. The (kind, schema_version) pair is checked
 *  against FALLOW_SUPPORTED before this runs, so only the four kinds reach it. */
export const FALLOW_REPORT = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('combined'),
    ...COMMON,
    check: z.object(CHECK_FIELDS).optional(),
    dupes: z.object(DUPES_FIELDS).optional(),
    health: z.object(HEALTH_FIELDS).optional(),
  }),
  z.object({ kind: z.literal('dead-code'), ...COMMON, ...CHECK_FIELDS }),
  z.object({ kind: z.literal('health'), ...COMMON, ...HEALTH_FIELDS }),
  z.object({ kind: z.literal('dupes'), ...COMMON, ...DUPES_FIELDS }),
]);
```

  zod 4.6.5 behaviour this relies on, checked against the installed package:
  - `z.object` strips unknown keys, so the parse output of this repository's own 585 KB combined report contains no `fragment` key (a `z.looseObject` parse keeps them);
  - in a discriminated union, an issue inside the matched branch carries the full path (`health.findings.0.cognitive`, `check.summary.unused_files`, `dupes.clone_groups.0.instances.1.file`);
  - `.regex(re, { error })` reports `invalid_format` at `version`;
  - `z.record(z.string(), z.number())` drops a `__proto__` key and keeps the input's key order.

- [ ] **Step 8: Implement the reader.** Create `src/application/evidence/read-fallow-report.ts`:

```ts
// Part 6 Y20/Y31: reading a fallow JSON report the user picked. Pure apart from
// `file.text()`: the picked file's text in, a validated `RawFallowReport` or ONE refusal
// out. Nothing is read from the vault and nothing is executed; the report is data only.
// Refusals carry a code and a `detail`, never copy: the import dialog maps them to
// FALLOW_IMPORT_ERROR (src/ui/audit-copy/fallow.ts), because src/application never
// imports src/ui.
import type { z } from 'zod';
import { FALLOW_REPORT } from './fallow-report-schema';
import {
  FALLOW_REPORT_MAX_BYTES, isSupportedFallow, type FallowImportErrorCode, type FallowReadResult,
} from './raw-fallow';

const DETAIL_MAX = 120;
const KIND_TEXT_MAX = 40;
const BOM = 0xfeff;

const refused = (code: FallowImportErrorCode, detail = ''): FallowReadResult => ({ ok: false, code, detail });

/** Y31: the first issue's path joined by '.', for example "health.findings.0.cognitive". */
function issueDetail(issue: z.core.$ZodIssue | undefined): string {
  if (!issue) return '';
  return issue.path.map((p) => String(p)).join('.').slice(0, DETAIL_MAX);
}

interface ReportHead { kind: unknown; schema: unknown }

/** The two fields that decide support, read before any validation. */
function headOf(raw: unknown): ReportHead {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { kind: undefined, schema: undefined };
  return {
    kind: 'kind' in raw ? raw.kind : undefined,
    schema: 'schema_version' in raw ? raw.schema_version : undefined,
  };
}

/** Y20: `<kind>@<schema>` for FALLOW_UNSUPPORTED, or '' when the document does not even
 *  name a kind (a string) and a schema version (a finite number). */
function unsupportedDetail(head: ReportHead): string {
  if (typeof head.kind !== 'string' || typeof head.schema !== 'number' || !Number.isFinite(head.schema)) return '';
  return `${head.kind.slice(0, KIND_TEXT_MAX)}@${head.schema}`;
}

/** Y20/Y22: size, JSON, the supported (kind, schema) set, then the schema. */
export function parseFallowReportText(text: string): FallowReadResult {
  if (text.length > FALLOW_REPORT_MAX_BYTES) return refused('too-large');
  const body = text.charCodeAt(0) === BOM ? text.slice(1) : text;
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return refused('not-json');
  }
  const head = headOf(raw);
  if (!isSupportedFallow(head.kind, head.schema)) return refused('unsupported', unsupportedDetail(head));
  const parsed = FALLOW_REPORT.safeParse(raw);
  if (!parsed.success) return refused('invalid', issueDetail(parsed.error.issues[0]));
  return { ok: true, report: parsed.data };
}

/** Y20: reads the picked file, and only it. A file over 16 MB is refused before it is read. */
export async function readFallowReportFile(file: File): Promise<FallowReadResult> {
  if (file.size > FALLOW_REPORT_MAX_BYTES) return refused('too-large');
  let text: string;
  try {
    text = await file.text();
  } catch {
    return refused('read-failed');
  }
  return parseFallowReportText(text);
}
```

  `return { ok: true, report: parsed.data }` is the type check that ties the schema to `RawFallowReport`: adding a field to the interface that the schema does not declare fails `npm run typecheck` at that line.

- [ ] **Step 9: Add the copy.** Create `src/ui/audit-copy/fallow.ts`:

```ts
// Part 6: fallow report import. Re-exported by inspector-copy.ts. Tasks 7-11 add the
// dialog, card, badge and lens strings to this file.
import { FALLOW_SUPPORTED, type FallowImportErrorCode, type FallowReportKind } from '../../application/evidence/raw-fallow';

function supportedText(): string {
  const byKind = new Map<FallowReportKind, number[]>();
  for (const s of FALLOW_SUPPORTED) byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s.schema]);
  const parts = [...byKind].map(([kind, schemas]) => `${kind} (schema ${schemas.join(' or ')})`);
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] ?? ''}`;
}

/** Y20: "combined (schema 11 or 12), dead-code (schema 9), health (schema 11) and dupes (schema 10)". */
export const FALLOW_SUPPORTED_TEXT = supportedText();

/** Y20: names what the file is and what this version reads. `kind` and `schema` come
 *  from the file and are shown as text only. */
export const FALLOW_UNSUPPORTED = (kind: string, schema: string): string =>
  `That file is a fallow “${kind}” report at schema ${schema}, which this version cannot read. Supported: ${FALLOW_SUPPORTED_TEXT}. Nothing was imported.`;

/** Y31: one message per refusal. `detail` is `<kind>@<schema>` (or '') for
 *  `unsupported` and the first issue's path for `invalid`; the other codes ignore it.
 *  A refusal never touches evidence that is already attached. */
export const FALLOW_IMPORT_ERROR: Readonly<Record<FallowImportErrorCode, (detail: string) => string>> = {
  'too-large': () => 'That file is larger than 16 MB, so it was not read. Nothing was imported.',
  'not-json': () => 'That file is not valid JSON. Nothing was imported.',
  unsupported: (found) => {
    const at = found.lastIndexOf('@');
    return at < 0
      ? `That file is not a fallow report this version can read. Supported: ${FALLOW_SUPPORTED_TEXT}. Nothing was imported.`
      : FALLOW_UNSUPPORTED(found.slice(0, at), found.slice(at + 1));
  },
  invalid: (at) => (at === '' ? 'That fallow report is not valid. Nothing was imported.' : `That fallow report is not valid at ${at}. Nothing was imported.`),
  // COPY-17, adapted: a fallow report names no revision, so the match is by file path.
  'source-mismatch': () => 'This report does not match the selected source: none of its findings names a file in the current snapshot, even with the offered folder mapping. Nothing was imported.',
  'read-failed': () => 'Could not read that file. Nothing was imported.',
};

/** Y25: labels for the check.summary counts Part 6 reports but does not show. */
const NOT_SHOWN_LABEL: Readonly<Record<string, string>> = {
  unused_files: 'Unused files',
  private_type_leaks: 'Private type leaks',
  unused_dependencies: 'Unused dependencies',
  unused_enum_members: 'Unused enum members',
  unused_class_members: 'Unused class members',
  unused_store_members: 'Unused store members',
  unprovided_injects: 'Unprovided injects',
  unrendered_components: 'Unrendered components',
  unused_component_props: 'Unused component props',
  unused_component_emits: 'Unused component emits',
  unused_component_inputs: 'Unused component inputs',
  unused_component_outputs: 'Unused component outputs',
  unused_svelte_events: 'Unused Svelte events',
  unused_server_actions: 'Unused server actions',
  unused_load_data_keys: 'Unused load data keys',
  unresolved_imports: 'Unresolved imports',
  unlisted_dependencies: 'Unlisted dependencies',
  duplicate_exports: 'Duplicate exports',
  type_only_dependencies: 'Type-only dependencies',
  test_only_dependencies: 'Test-only dependencies',
  dev_dependencies_in_production: 'Dev dependencies used in production',
  circular_dependencies: 'Circular dependencies',
  re_export_cycles: 'Re-export cycles',
  boundary_violations: 'Boundary violations',
  boundary_coverage_violations: 'Boundary coverage violations',
  boundary_call_violations: 'Boundary call violations',
  policy_violations: 'Policy violations',
  stale_suppressions: 'Stale suppressions',
  unused_catalog_entries: 'Unused catalog entries',
  empty_catalog_groups: 'Empty catalog groups',
  unresolved_catalog_references: 'Unresolved catalog references',
  unused_dependency_overrides: 'Unused dependency overrides',
  misconfigured_dependency_overrides: 'Misconfigured dependency overrides',
  invalid_client_exports: 'Invalid client exports',
  mixed_client_server_barrels: 'Mixed client/server barrels',
  misplaced_directives: 'Misplaced directives',
  route_collisions: 'Route collisions',
  dynamic_segment_name_conflicts: 'Dynamic segment name conflicts',
  clone_groups_omitted: 'Clone groups left out of the report',
};

/** Y25: a key missing from the map is shown by its raw key. Own keys only, so a key such
 *  as "constructor" from the file never reaches Object.prototype. */
export const fallowNotShownLabel = (key: string): string =>
  (Object.prototype.hasOwnProperty.call(NOT_SHOWN_LABEL, key) ? NOT_SHOWN_LABEL[key] : undefined) ?? key;
```

  In `src/ui/inspector-copy.ts`, replace the line Task 1 added:

```ts
export * from './audit-copy/city';
```

  with:

```ts
export * from './audit-copy/city';
export * from './audit-copy/fallow';
```

  (If Task 1's line is not there, add `export * from './audit-copy/fallow';` directly after `export * from './audit-copy/settings';` and report it.)

- [ ] **Step 10: Run and confirm it passes.** Run `npx vitest run tests/unit/fallow-report-reader.test.ts tests/unit/fallow-copy.test.ts tests/unit/no-process-execution.test.ts tests/unit/node-access-boundary.test.ts`. Expected: all pass (reader 50 tests, copy 5, no-process 21). Then the gate:

```bash
npm run typecheck && npm run lint:fast && npx vitest run tests/unit/fallow-report-reader.test.ts tests/unit/fallow-copy.test.ts tests/unit/no-process-execution.test.ts tests/unit/node-access-boundary.test.ts
npx eslint src/application/evidence/raw-fallow.ts src/application/evidence/fallow-report-schema.ts src/application/evidence/read-fallow-report.ts src/ui/audit-copy/fallow.ts src/ui/inspector-copy.ts tests/fixtures/fallow-fixture.ts tests/unit/fallow-report-reader.test.ts tests/unit/fallow-copy.test.ts tests/unit/no-process-execution.test.ts --max-warnings 0
```

  Check the sizes: each new `src` file at most 400 (103, 75, 70, 84), `inspector-copy.ts` under 400, each new test file at most 450.

- [ ] **Step 11: Commit.**

```bash
git add src/application/evidence/raw-fallow.ts src/application/evidence/fallow-report-schema.ts src/application/evidence/read-fallow-report.ts src/ui/audit-copy/fallow.ts src/ui/inspector-copy.ts tests/fixtures/fallow-fixture.ts tests/unit/fallow-report-reader.test.ts tests/unit/fallow-copy.test.ts tests/unit/no-process-execution.test.ts
git commit -m "feat(application): fallow report schema and reader, import copy, no-process guard (Y20-Y22, Y31)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Evidence model, normaliser and resolution (Y23–Y27)

**Files:**
- Create: `src/domain/hash.ts` (14). **Amendment to the file map:** a shared FNV-1a for the finding ids. Application code may not import `src/ui/fixtures/seeded-random.ts`; `src/domain` is importable from every layer and has no dependencies.
- Create: `src/application/evidence/model.ts` (73)
- Create: `src/application/evidence/normalize-fallow.ts` (236)
- Create: `src/application/evidence/resolve-findings.ts` (54)
- Create: `tests/fixtures/fallow-expected.ts` (54)
- Create: `tests/unit/normalize-fallow.test.ts` (181), `tests/unit/normalize-fallow-ids.test.ts` (142), `tests/unit/resolve-findings.test.ts` (70)

**Interfaces:**
- Consumes (Task 5): `RawFallowReport` and its parts, `FallowReportKind` (from `src/application/evidence/raw-fallow.ts`), and `parseFallowReportText` (from `src/application/evidence/read-fallow-report.ts`, through the test helpers); the test helpers in `tests/fixtures/fallow-fixture.ts`.
- Consumes (existing): `normalizeRelativePath` from `src/domain/path-safety.ts` (the scanner's rule, the one Part 5's import used). `FINDING_ID_PATTERN` from `src/ui/read-models/review-state.ts` is imported **by the tests only**.
- Produces, in `src/domain/hash.ts`: `fnv1a32Hex(text: string): string` (eight lower-case hex digits).
- Produces, in `src/application/evidence/model.ts`:
  - `type FindingCategory = 'complexity' | 'duplication' | 'unused-exports'` and `FINDING_CATEGORIES`;
  - `type FindingRule = 'complexity' | 'duplication' | 'unused-export' | 'unused-type'`;
  - `FindingDetail`, `EvidenceFinding` (as Y23, with `rule: FindingRule`);
  - `interface NotShownCount { key: string; count: number }` (**amends Y23's `{ label; count }`**: the application layer holds no copy; the UI labels it with Task 5's `fallowNotShownLabel(key)`);
  - `NormalizedEvidence` (arrays `readonly`), `EvidenceReport` (Y27).
- Produces, in `src/application/evidence/normalize-fallow.ts`:
  - `normalizeFallow(raw: RawFallowReport, opts: { stripPrefix: string | null }): NormalizedEvidence` (throws on a strip prefix that is not a normalised relative folder ending in `/`);
  - `buildEvidenceReport(input: { raw; fileName; importedAt; snapshotId; stripPrefix }): EvidenceReport`.
- Produces, in `src/application/evidence/resolve-findings.ts`:
  - `resolveFindings(findings: readonly EvidenceFinding[], snapshotPaths: ReadonlySet<string>): { matched: readonly EvidenceFinding[]; unmatchedPaths: readonly string[] }`;
  - `suggestStripPrefix(paths: readonly string[], snapshotPaths: ReadonlySet<string>): string | null`.
- Mapping decisions the tests pin (beyond Y23's text):
  - **Occurrence index (Y24 CX key):** counted among same-named findings of one file in **source order** (line, then column), so a reordered report renames nothing. This repository's own report has files with 3, 6 and 9 `<arrow>` findings.
  - **Complexity `endLine`:** `null`. The function's `line_count` is kept in `detail.lineCount`; no end line is derived.
  - **One clone group, two instances in one file** (21 of the 40 groups in this repository's report): one finding for that file, with its earliest instance's range. `partnerFiles` counts the group's other distinct files, including a file whose path was refused.
  - **Identical ids** (the same key reported twice): the first finding is kept.
  - **Strip prefix:** removed from every normalised path that starts with it and is longer than it. `suggestStripPrefix` offers a folder only when no snapshot path lies under it (so stripping can never break a path that already matches), and offers nothing when two folders of the same shortest length qualify.
  - **`notShown`:** every non-zero `check.summary` count except `total_issues`, `unused_exports` and `unused_types`, in the report's key order, plus `{ key: 'clone_groups_omitted' }` when a standalone dupes report says it left groups out.
  - **`rejectedPaths`:** the refused raw paths, clipped to 1024 characters, distinct and sorted. They are **not** merged into `resolveFindings`' `unmatchedPaths`; Tasks 8 and 10 show both (Y26: "treated as unmatched").
  - **`warnings`:** every `workspace_diagnostics[].message`, verbatim, in order.
  - **`fileName`:** the text after the last `/` or `\`, clipped to 255. `providerVersion` is clipped to 64 (the schema already bounds it).

- [ ] **Step 1: Write the expected findings.** Create `tests/fixtures/fallow-expected.ts`:

```ts
// Part 6 Y23/Y24: what the recorded 3.27.0 fixture project normalises to. The project
// (tests/fixtures/fallow/project) has exactly one complex function, one clone group
// across two files, one unused export and one unused type. Ids are built from the Y24
// keys here, so a test that compares against these checks the key recipe too.
import { fnv1a32Hex } from '../../src/domain/hash';
import type { EvidenceFinding } from '../../src/application/evidence/model';
import { fallowDoc } from './fallow-fixture';

export const cxId = (path: string, name: string, occurrence: number): string => `CX-${fnv1a32Hex(`${path}|${name}|${occurrence}`)}`;
export const duId = (fingerprint: string, path: string): string => `DU-${fnv1a32Hex(`${fingerprint}|${path}`)}`;
export const unId = (path: string, name: string, rule: 'unused-export' | 'unused-type'): string =>
  `UN-${fnv1a32Hex(`${path}|${name}|${rule}`)}`;

/** fallow's own clone fingerprint ("dup:6f87acd9" in the dry run), read from the
 *  recording rather than restated: it is the one opaque value fallow computes. */
export const FIXTURE_FINGERPRINT = String(fallowDoc('combined-3.27.0').dupes?.clone_groups[0]?.fingerprint);

export const PARTITION: EvidenceFinding = {
  id: cxId('src/layout/partition.ts', 'partitionDistrict', 0),
  category: 'complexity', rule: 'complexity', severity: 'critical', path: 'src/layout/partition.ts',
  line: 1, endLine: null, symbol: 'partitionDistrict',
  detail: {
    kind: 'complexity', cognitive: 32, cyclomatic: 18, lineCount: 37, exceeded: 'cognitive_crap',
    cognitiveThreshold: 15, cyclomaticThreshold: 20,
  },
};

const clone = (path: string): EvidenceFinding => ({
  id: duId(FIXTURE_FINGERPRINT, path),
  category: 'duplication', rule: 'duplication', severity: null, path,
  line: 1, endLine: 15, symbol: null,
  detail: { kind: 'duplication', tokenCount: 93, lineCount: 15, partnerFiles: 1 },
});
export const SUM_A = clone('src/text/sum-a.ts');
export const SUM_B = clone('src/text/sum-b.ts');

export const UNUSED_HELPER: EvidenceFinding = {
  id: unId('src/text/format.ts', 'unusedHelper', 'unused-export'),
  category: 'unused-exports', rule: 'unused-export', severity: null, path: 'src/text/format.ts',
  line: 7, endLine: null, symbol: 'unusedHelper', detail: { kind: 'unused', typeOnly: false },
};
export const LABEL_OPTIONS: EvidenceFinding = {
  id: unId('src/text/format.ts', 'LabelOptions', 'unused-type'),
  category: 'unused-exports', rule: 'unused-type', severity: null, path: 'src/text/format.ts',
  line: 1, endLine: null, symbol: 'LabelOptions', detail: { kind: 'unused', typeOnly: true },
};

/** Every file of the fixture project, as a scan of the project folder would list it. */
export const FIXTURE_PROJECT_FILES = [
  'package.json', 'src/index.ts', 'src/layout/partition.ts', 'src/text/format.ts', 'src/text/sum-a.ts', 'src/text/sum-b.ts',
];

/** A finding's position, without its id or measurements. */
export const where = (f: EvidenceFinding): string => `${f.rule} ${f.path}:${f.line ?? '-'}-${f.endLine ?? '-'} ${f.symbol ?? ''}`.trim();
```

- [ ] **Step 2: Write the failing normaliser tests.** Create `tests/unit/normalize-fallow.test.ts`:

```ts
// Part 6 Y23, Y25, Y27: normalising a validated fallow report. The mapping rules for each
// kind, categories analysed or not, the counts reported but not shown, no source text
// kept, and the provenance of an attached report.
import { describe, expect, it } from 'vitest';
import { FINDING_CATEGORIES } from '../../src/application/evidence/model';
import { buildEvidenceReport, normalizeFallow } from '../../src/application/evidence/normalize-fallow';
import {
  DROPPED_KEYS, FALLOW_FIXTURES, deepKeys, fallowDoc, fallowText, fixtureSourceLines, rawReport, rows, type FallowDoc, type FallowFixture,
} from '../fixtures/fallow-fixture';
import { LABEL_OPTIONS, PARTITION, SUM_A, SUM_B, UNUSED_HELPER, where } from '../fixtures/fallow-expected';

const NO_STRIP = { stripPrefix: null };
const normalized = (source: FallowFixture | FallowDoc) => normalizeFallow(rawReport(source), NO_STRIP);
const notDuplication = (f: { category: string }): boolean => f.category !== 'duplication';

describe('normalizeFallow: mapping (Part 6 Y23)', () => {
  it('maps the combined 3.27.0 report: one complexity, two duplication and two unused findings', () => {
    expect(normalized('combined-3.27.0').findings).toEqual([PARTITION, SUM_A, SUM_B, UNUSED_HELPER, LABEL_OPTIONS]);
  });

  it.each<[FallowFixture, readonly unknown[]]>([
    ['dead-code-3.27.0', [UNUSED_HELPER, LABEL_OPTIONS]],
    ['health-3.27.0', [PARTITION]],
    ['dupes-3.27.0', [SUM_A, SUM_B]],
  ])('maps the single-command report %s the same way', (name, expected) => {
    expect(normalized(name).findings).toEqual(expected);
  });

  it('maps fallow 3.21.0 (combined schema 11) to the same findings at the same places', () => {
    const older = normalized('combined-3.21.0').findings;
    const current = normalized('combined-3.27.0').findings;
    expect(older.map(where)).toEqual(current.map(where));
    // Complexity and unused keys hold no fallow-assigned value, so their ids survive an upgrade.
    // Clone fingerprints are fallow's own and may change between versions.
    expect(older.filter(notDuplication).map((f) => f.id)).toEqual(current.filter(notDuplication).map((f) => f.id));
  });

  it('keeps the tool\'s severity verbatim, including one a later fallow may add', () => {
    const doc = fallowDoc('health-3.27.0', (d) => { rows(d, 'findings')[0]!.severity = 'severe'; });
    expect(normalized(doc).findings.map((f) => f.severity)).toEqual(['severe']);
  });

  it('keeps an HTML-looking symbol as plain text: it is data, never markup', () => {
    const symbol = '<img src=x onerror=alert(1)>';
    const doc = fallowDoc('dead-code-3.27.0', (d) => { rows(d, 'unused_exports')[0]!.export_name = symbol; });
    expect(normalized(doc).findings[0]!.symbol).toBe(symbol);
  });

  it('keeps every workspace diagnostic message as a warning, verbatim', () => {
    const messages = (fallowDoc('combined-3.27.0').workspace_diagnostics ?? []).map((d) => d.message);
    expect(messages.length).toBeGreaterThan(0);
    expect(normalized('combined-3.27.0').warnings).toEqual(messages);
    expect(normalized(fallowDoc('combined-3.27.0', (d) => { delete d.workspace_diagnostics; })).warnings).toEqual([]);
  });

  it('reports no refused path for the recorded fixtures', () => {
    for (const name of FALLOW_FIXTURES) expect({ name, rejected: normalized(name).rejectedPaths }).toEqual({ name, rejected: [] });
  });
});

describe('normalizeFallow: categories (Part 6 Y25)', () => {
  const A = 'analysed';
  const N = 'not-analysed';

  it.each<[FallowFixture, string, string, string]>([
    ['combined-3.27.0', A, A, A],
    ['combined-3.21.0', A, A, A],
    ['dead-code-3.27.0', N, N, A],
    ['health-3.27.0', A, N, N],
    ['dupes-3.27.0', N, A, N],
  ])('%s: complexity %s, duplication %s, unused exports %s', (name, complexity, duplication, unused) => {
    expect(normalized(name).categories).toEqual({ complexity, duplication, 'unused-exports': unused });
  });

  it('has exactly the three categories', () => {
    expect(Object.keys(normalized('combined-3.27.0').categories).sort()).toEqual([...FINDING_CATEGORIES].sort());
  });

  it('marks a combined report without a section Not analysed, never zero, and a present but empty section analysed', () => {
    const doc = fallowDoc('combined-3.27.0', (d) => {
      delete d.health;
      delete d.dupes;
      d.check!.unused_exports = [];
      d.check!.unused_types = [];
    });
    const result = normalized(doc);
    expect(result.categories).toEqual({ complexity: N, duplication: N, 'unused-exports': A });
    expect(result.findings).toEqual([]);
  });
});

describe('normalizeFallow: reported, not shown (Part 6 Y25)', () => {
  it('lists nothing when every other count is zero', () => {
    expect(normalized('combined-3.27.0').notShown).toEqual([]);
    expect(normalized('dead-code-3.27.0').notShown).toEqual([]);
  });

  it('lists every non-zero count Part 6 does not show, in the report\'s order, never the shown ones or the total', () => {
    const doc = fallowDoc('combined-3.27.0', (d) => {
      Object.assign(d.check!.summary, { total_issues: 9, unused_exports: 4, unused_types: 2, circular_dependencies: 2, unused_files: 3 });
    });
    expect(normalized(doc).notShown).toEqual([{ key: 'unused_files', count: 3 }, { key: 'circular_dependencies', count: 2 }]);
  });

  it('reads a dead-code report\'s top-level summary, including a count this version has no label for', () => {
    const doc = fallowDoc('dead-code-3.27.0', (d) => {
      Object.assign(d.summary as Record<string, unknown>, { unused_class_members: 14, unused_widgets: 1 });
    });
    expect(normalized(doc).notShown).toEqual([{ key: 'unused_class_members', count: 14 }, { key: 'unused_widgets', count: 1 }]);
  });

  it('lists the clone groups a dupes report left out', () => {
    const doc = fallowDoc('dupes-3.27.0', (d) => { d.clone_groups_omitted = 4; });
    expect(normalized(doc).notShown).toEqual([{ key: 'clone_groups_omitted', count: 4 }]);
    expect(normalized(fallowDoc('dupes-3.27.0', (d) => { d.clone_groups_omitted = 0; })).notShown).toEqual([]);
  });
});

describe('normalizeFallow: no source text is kept (Part 6 Y23)', () => {
  const lines = fixtureSourceLines();

  it('the fixtures really do carry source text, so the checks below can fail', () => {
    expect(lines.length).toBeGreaterThan(10);
    expect(lines.some((line) => fallowText('combined-3.27.0').includes(line))).toBe(true);
  });

  it.each(FALLOW_FIXTURES)('%s: no dropped key and no fixture source line in the normalised evidence', (name) => {
    const result = normalized(name);
    const keys = deepKeys(result);
    expect(keys.size).toBeGreaterThan(0);
    for (const dropped of DROPPED_KEYS) expect({ name, dropped, kept: keys.has(dropped) }).toEqual({ name, dropped, kept: false });
    const text = JSON.stringify(result);
    expect(lines.filter((line) => text.includes(line))).toEqual([]);
  });

  it('the attached report keeps none either', () => {
    const report = buildEvidenceReport({
      raw: rawReport('combined-3.27.0'), fileName: 'combined.json', importedAt: '2026-09-23T10:00:00.000Z', snapshotId: 'snap-1', stripPrefix: null,
    });
    const text = JSON.stringify(report);
    expect(lines.filter((line) => text.includes(line))).toEqual([]);
    for (const dropped of DROPPED_KEYS) expect(deepKeys(report).has(dropped)).toBe(false);
  });
});

describe('buildEvidenceReport: provenance (Part 6 Y27)', () => {
  const input = {
    raw: rawReport('combined-3.27.0'), fileName: 'combined-3.27.0.json', importedAt: '2026-09-23T10:00:00.000Z', snapshotId: 'snap-1', stripPrefix: null,
  };

  it('records the provider, version, kind, schema, file name, time, snapshot and mapping', () => {
    const report = buildEvidenceReport(input);
    expect({ ...report, normalized: null }).toEqual({
      provider: 'fallow', providerVersion: '3.27.0', reportKind: 'combined', schemaVersion: 12, fileName: 'combined-3.27.0.json',
      importedAt: '2026-09-23T10:00:00.000Z', snapshotId: 'snap-1', stripPrefix: null, normalized: null,
    });
    expect(report.normalized).toEqual(normalizeFallow(input.raw, NO_STRIP));
  });

  it('records a single-command report\'s own kind and schema', () => {
    const report = buildEvidenceReport({ ...input, raw: rawReport('dupes-3.27.0') });
    expect([report.reportKind, report.schemaVersion, report.providerVersion]).toEqual(['dupes', 10, '3.27.0']);
  });

  it.each<[string, string]>([
    ['C:\\Users\\dev\\reports\\fallow.json', 'fallow.json'],
    ['/home/dev/reports/fallow.json', 'fallow.json'],
    ['fallow.json', 'fallow.json'],
    [`${'f'.repeat(300)}.json`, 'f'.repeat(255)],
  ])('keeps only the file name of %j, at most 255 characters', (fileName, expected) => {
    expect(buildEvidenceReport({ ...input, fileName }).fileName).toBe(expected);
  });

  it('applies and records the chosen strip prefix', () => {
    const report = buildEvidenceReport({ ...input, stripPrefix: 'src/' });
    expect(report.stripPrefix).toBe('src/');
    expect(report.normalized.findings.map((f) => f.path)).toEqual([
      'layout/partition.ts', 'text/sum-a.ts', 'text/sum-b.ts', 'text/format.ts', 'text/format.ts',
    ]);
  });
});
```

  Create `tests/unit/normalize-fallow-ids.test.ts`:

```ts
// Part 6 Y23, Y24, Y26: finding ids that survive a re-import, and report paths that are
// normalised, refused or stripped of a chosen folder before anything uses them.
import { describe, expect, it } from 'vitest';
import { fnv1a32Hex } from '../../src/domain/hash';
import { fnv1a } from '../../src/ui/fixtures/seeded-random';
import type { EvidenceFinding } from '../../src/application/evidence/model';
import { normalizeFallow } from '../../src/application/evidence/normalize-fallow';
import { FINDING_ID_PATTERN } from '../../src/ui/read-models/review-state';
import { FALLOW_FIXTURES, fallowDoc, rawReport, rows, type FallowDoc, type FallowFixture } from '../fixtures/fallow-fixture';
import { FIXTURE_FINGERPRINT, LABEL_OPTIONS, PARTITION, SUM_A, SUM_B, UNUSED_HELPER, cxId, duId } from '../fixtures/fallow-expected';

const normalized = (source: FallowFixture | FallowDoc, stripPrefix: string | null = null) =>
  normalizeFallow(rawReport(source), { stripPrefix });
const ids = (source: FallowFixture | FallowDoc): string[] => normalized(source).findings.map((f) => f.id).sort();
const byLine = (found: readonly EvidenceFinding[]): Map<string, string> => new Map(found.map((f) => [`${f.path}:${f.line ?? 0}`, f.id]));

/** The combined report with a second unused export, optionally with its lists reversed. */
function withTwoExports(reverse: boolean): FallowDoc {
  return fallowDoc('combined-3.27.0', (d) => {
    d.check!.unused_exports.push({ ...d.check!.unused_exports[0]!, export_name: 'otherHelper', line: 12 });
    if (reverse) {
      d.check!.unused_exports.reverse();
      d.dupes!.clone_groups[0]!.instances.reverse();
    }
  });
}

/** Every path in a combined report, rewritten. */
function withPaths(change: (path: string) => string): FallowDoc {
  return fallowDoc('combined-3.27.0', (d) => {
    for (const f of d.health!.findings) f.path = change(f.path as string);
    for (const g of d.dupes!.clone_groups) for (const i of g.instances) i.file = change(i.file as string);
    for (const e of [...d.check!.unused_exports, ...d.check!.unused_types]) e.path = change(e.path as string);
  });
}

describe('fnv1a32Hex (Part 6 Y24)', () => {
  it('matches the FNV-1a 32-bit test vectors', () => {
    expect(fnv1a32Hex('')).toBe('811c9dc5');
    expect(fnv1a32Hex('a')).toBe('e40c292c');
    expect(fnv1a32Hex('foobar')).toBe('bf9cf968');
  });

  it('is the same function as the sample fixtures\' fnv1a, as eight hex digits', () => {
    for (const text of ['', 'src/a.ts|draw|0', 'dup:6f87acd9|src/text/sum-a.ts', 'ünïcode']) {
      expect(fnv1a32Hex(text)).toBe(fnv1a(text).toString(16).padStart(8, '0'));
    }
  });
});

describe('finding ids (Part 6 Y24)', () => {
  it.each(FALLOW_FIXTURES)('%s: every id is distinct and matches FINDING_ID_PATTERN', (name) => {
    const all = normalized(name).findings.map((f) => f.id);
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect({ id, ok: FINDING_ID_PATTERN.test(id) && /^(CX|DU|UN)-[0-9a-f]{8}$/.test(id) }).toEqual({ id, ok: true });
  });

  it('gives the same ids on a second, separate normalisation', () => {
    expect(normalized('combined-3.27.0')).toEqual(normalized('combined-3.27.0'));
    expect(ids('combined-3.27.0')).toEqual([PARTITION, SUM_A, SUM_B, UNUSED_HELPER, LABEL_OPTIONS].map((f) => f.id).sort());
  });

  it('never puts the line in the key: moved code keeps its id', () => {
    const moved = fallowDoc('combined-3.27.0', (d) => {
      d.health!.findings[0]!.line = 40;
      d.check!.unused_exports[0]!.line = 99;
      for (const i of d.dupes!.clone_groups[0]!.instances) { i.start_line = 20; i.end_line = 34; }
    });
    expect(ids(moved)).toEqual(ids('combined-3.27.0'));
  });

  it('does not depend on the report\'s order', () => {
    expect(ids(withTwoExports(true))).toEqual(ids(withTwoExports(false)));
    expect(ids(withTwoExports(false))).toHaveLength(6);
  });

  it('numbers same-named functions in a file by their position in the source, not by report order', () => {
    const base = rows(fallowDoc('health-3.27.0'), 'findings')[0]!;
    const arrow = (line: number, path = 'src/text/format.ts') => ({ ...base, path, name: '<arrow>', line, col: 3 });
    const inOrder = [arrow(30), arrow(10), arrow(5, 'src/index.ts')];
    const inReverse = [arrow(5, 'src/index.ts'), arrow(10), arrow(30)];
    const forward = normalized(fallowDoc('health-3.27.0', (d) => { d.findings = inOrder; })).findings;
    const backward = normalized(fallowDoc('health-3.27.0', (d) => { d.findings = inReverse; })).findings;
    expect(byLine(forward)).toEqual(byLine(backward));
    expect(byLine(forward)).toEqual(new Map([
      ['src/text/format.ts:30', cxId('src/text/format.ts', '<arrow>', 1)],
      ['src/text/format.ts:10', cxId('src/text/format.ts', '<arrow>', 0)],
      ['src/index.ts:5', cxId('src/index.ts', '<arrow>', 0)],
    ]));
  });

  it('keeps one duplication finding per file of a group, with that file\'s earliest instance', () => {
    const doc = fallowDoc('dupes-3.27.0', (d) => {
      const group = rows(d, 'clone_groups')[0] as { instances: Record<string, unknown>[] };
      group.instances.push({ file: 'src/text/sum-a.ts', start_line: 20, end_line: 34 }, { file: 'src/index.ts', start_line: 2, end_line: 9 });
      group.instances.reverse();
    });
    const found = normalized(doc).findings;
    expect(found).toHaveLength(3);
    expect(new Map(found.map((f) => [f.path, [f.line, f.endLine]]))).toEqual(new Map([
      ['src/index.ts', [2, 9]], ['src/text/sum-a.ts', [1, 15]], ['src/text/sum-b.ts', [1, 15]],
    ]));
    for (const f of found) expect(f.detail).toEqual({ kind: 'duplication', tokenCount: 93, lineCount: 15, partnerFiles: 2 });
    expect(found.map((f) => f.id).sort()).toEqual(['src/index.ts', 'src/text/sum-a.ts', 'src/text/sum-b.ts'].map((p) => duId(FIXTURE_FINGERPRINT, p)).sort());
  });
});

describe('report paths (Part 6 Y23, Y26)', () => {
  it('refuses absolute, climbing and drive paths: their findings are dropped and the paths listed once, sorted', () => {
    const doc = fallowDoc('combined-3.27.0', (d) => {
      d.check!.unused_exports[0]!.path = '../outside.ts';
      d.health!.findings[0]!.path = '/abs/partition.ts';
      d.dupes!.clone_groups[0]!.instances[0]!.file = 'C:/x/sum-a.ts';
      d.check!.unused_types[0]!.path = '../outside.ts';
    });
    const result = normalized(doc);
    expect(result.findings.map((f) => f.id)).toEqual([SUM_B.id]);
    expect(result.findings[0]!.detail).toEqual(SUM_B.detail);
    expect(result.rejectedPaths).toEqual(['../outside.ts', '/abs/partition.ts', 'C:/x/sum-a.ts']);
  });

  it('accepts a Windows-style relative path as the same file', () => {
    const doc = fallowDoc('dead-code-3.27.0', (d) => { rows(d, 'unused_exports')[0]!.path = 'src\\text\\format.ts'; });
    expect(normalized(doc).findings[0]).toEqual(UNUSED_HELPER);
  });

  it('strips a chosen folder from every path under it, and the ids match an unprefixed report\'s', () => {
    const prefixed = withPaths((p) => `fixture/${p}`);
    expect(normalized(prefixed, 'fixture/').findings).toEqual(normalized('combined-3.27.0').findings);
    expect(normalized(prefixed).findings.map((f) => f.path)).toContain('fixture/src/text/format.ts');
  });

  it('leaves a path outside the chosen folder as it is', () => {
    const result = normalized('combined-3.27.0', 'lib/');
    expect(result.findings).toEqual(normalized('combined-3.27.0').findings);
  });

  it.each(['src', '../', '/abs/', 'src//', '', 'a\\b/', './'])('refuses the strip prefix %j (a programming error, never user input)', (prefix) => {
    expect(() => normalized('combined-3.27.0', prefix)).toThrow('A strip prefix is a relative folder ending in "/".');
  });
});
```

- [ ] **Step 3: Write the failing resolution tests.** Create `tests/unit/resolve-findings.test.ts`:

```ts
// Part 6 Y26: matching findings to the snapshot's files, and the folder mapping the
// review step may offer (never apply) when a report was made from a different root.
import { describe, expect, it } from 'vitest';
import { normalizeFallow } from '../../src/application/evidence/normalize-fallow';
import { resolveFindings, suggestStripPrefix } from '../../src/application/evidence/resolve-findings';
import { rawReport } from '../fixtures/fallow-fixture';
import { FIXTURE_PROJECT_FILES, LABEL_OPTIONS, PARTITION, SUM_A, SUM_B, UNUSED_HELPER } from '../fixtures/fallow-expected';

const findings = normalizeFallow(rawReport('combined-3.27.0'), { stripPrefix: null }).findings;
const snapshot = (...paths: string[]): ReadonlySet<string> => new Set(paths);

describe('resolveFindings (Part 6 Y26)', () => {
  it('matches every finding when the snapshot is the fixture project itself', () => {
    expect(resolveFindings(findings, snapshot(...FIXTURE_PROJECT_FILES))).toEqual({
      matched: [PARTITION, SUM_A, SUM_B, UNUSED_HELPER, LABEL_OPTIONS], unmatchedPaths: [],
    });
  });

  it('drops a finding whose file is not in the snapshot and lists its path once, sorted', () => {
    const result = resolveFindings(findings, snapshot('src/text/format.ts', 'src/text/sum-a.ts', 'src/index.ts'));
    expect(result.matched).toEqual([SUM_A, UNUSED_HELPER, LABEL_OPTIONS]);
    expect(result.unmatchedPaths).toEqual(['src/layout/partition.ts', 'src/text/sum-b.ts']);
  });

  it('matches nothing against an empty snapshot, and needs no findings to answer', () => {
    expect(resolveFindings(findings, snapshot()).matched).toEqual([]);
    expect(resolveFindings(findings, snapshot()).unmatchedPaths).toEqual([
      'src/layout/partition.ts', 'src/text/format.ts', 'src/text/sum-a.ts', 'src/text/sum-b.ts',
    ]);
    expect(resolveFindings([], snapshot('src/index.ts'))).toEqual({ matched: [], unmatchedPaths: [] });
  });

  it('matches paths exactly: case and a leading folder both count', () => {
    const result = resolveFindings(findings, snapshot('SRC/text/format.ts', 'project/src/text/sum-a.ts'));
    expect(result.matched).toEqual([]);
  });
});

describe('suggestStripPrefix (Part 6 Y26)', () => {
  it('offers the folder a report made one level up adds to every path', () => {
    // The snapshot was scanned at the fixture project's src/; the report at the project root.
    const inner = snapshot('index.ts', 'layout/partition.ts', 'text/format.ts', 'text/sum-a.ts', 'text/sum-b.ts');
    const { unmatchedPaths } = resolveFindings(findings, inner);
    expect(suggestStripPrefix(unmatchedPaths, inner)).toBe('src/');
    const mapped = normalizeFallow(rawReport('combined-3.27.0'), { stripPrefix: 'src/' }).findings;
    expect(resolveFindings(mapped, inner).matched).toHaveLength(5);
  });

  it('offers the shortest folder that works', () => {
    expect(suggestStripPrefix(['a/b/src/x.ts'], snapshot('src/x.ts', 'b/src/x.ts'))).toBe('a/');
  });

  it('offers a folder when every path under it matches, even if paths elsewhere still do not', () => {
    expect(suggestStripPrefix(['pkg/src/a.ts', 'other.ts'], snapshot('src/a.ts'))).toBe('pkg/');
  });

  it.each<[string, string[], string[]]>([
    ['one path under the folder still does not match', ['pkg/src/a.ts', 'pkg/src/gone.ts'], ['src/a.ts']],
    ['no path has a folder', ['a.ts', 'b.ts'], ['a.ts']],
    ['nothing is unmatched', [], ['src/a.ts']],
    ['removing the folder matches nothing', ['pkg/x.ts'], ['src/a.ts']],
    ['the snapshot itself has files under the folder, so stripping could break a match', ['pkg/src/a.ts'], ['src/a.ts', 'pkg/readme.md']],
  ])('offers nothing when %s', (_name, paths, snapshotPaths) => {
    expect(suggestStripPrefix(paths, snapshot(...snapshotPaths))).toBeNull();
  });

  it('offers nothing when two different folders of the same length would each work (ambiguous)', () => {
    expect(suggestStripPrefix(['a/x.ts', 'b/y.ts'], snapshot('x.ts', 'y.ts'))).toBeNull();
  });
});
```

- [ ] **Step 4: Run them and confirm they fail.** Run `npx vitest run tests/unit/normalize-fallow.test.ts tests/unit/normalize-fallow-ids.test.ts tests/unit/resolve-findings.test.ts`. Expected: all three files fail to load with `Failed to resolve import`, naming `../../src/application/evidence/model`, `../../src/application/evidence/normalize-fallow` or `../../src/domain/hash` (from `tests/fixtures/fallow-expected.ts`).

- [ ] **Step 5: Implement the hash.** Create `src/domain/hash.ts`:

```ts
// Part 6 Y24: FNV-1a over UTF-16 code units, 32-bit, as eight lower-case hex digits.
// Deterministic, non-cryptographic, no Node `crypto` (no-nodejs-modules). It names
// imported findings (`CX-1a2b3c4d`); it is never an entity id (spec 4.1: identity is
// never hashed) and never a security boundary. The same algorithm as the private copies
// in application/approval.ts, application/inventory-collector.ts and
// ui/fixtures/seeded-random.ts, which are left as they are.
export function fnv1a32Hex(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
```

  The three existing private copies (`src/application/approval.ts`, `src/application/inventory-collector.ts`, `src/ui/fixtures/seeded-random.ts`) are **not** touched in this task. The test ties the new function to `seeded-random`'s `fnv1a`.

- [ ] **Step 6: Implement the model.** Create `src/application/evidence/model.ts`:

```ts
// Part 6 Y23/Y27: imported evidence, normalised. Provider-neutral in shape, fallow in
// origin. Holds no source text: every field is a path, a number, a tool-assigned name or
// a tool message (Y23's dropped list never reaches it).
import type { FallowReportKind } from './raw-fallow';

export type FindingCategory = 'complexity' | 'duplication' | 'unused-exports';
export const FINDING_CATEGORIES: readonly FindingCategory[] = ['complexity', 'duplication', 'unused-exports'];

/** The tool's rule, one per mapping in Y23. `unused-exports` covers both unused rules. */
export type FindingRule = 'complexity' | 'duplication' | 'unused-export' | 'unused-type';

export type FindingDetail =
  | {
    kind: 'complexity';
    cognitive: number;
    cyclomatic: number;
    lineCount: number;
    /** fallow's own word for which thresholds were exceeded, verbatim ("cognitive", "all", "crap", …). */
    exceeded: string;
    cognitiveThreshold: number;
    cyclomaticThreshold: number;
  }
  | { kind: 'duplication'; tokenCount: number; lineCount: number; partnerFiles: number }
  | { kind: 'unused'; typeOnly: boolean };

export interface EvidenceFinding {
  /** Y24: `CX-`, `DU-` or `UN-` plus eight hex digits; always matches FINDING_ID_PATTERN. */
  id: string;
  category: FindingCategory;
  rule: FindingRule;
  /** The tool's own severity string (`critical`/`high`/`moderate`), or null when it rates none. */
  severity: string | null;
  /** Normalised, POSIX, root-relative, after any strip prefix. */
  path: string;
  line: number | null;
  endLine: number | null;
  symbol: string | null;
  detail: FindingDetail;
}

/** Y25: one reported count Part 6 does not show. `key` is fallow's own key; the UI
 *  labels it with `fallowNotShownLabel` (application code holds no copy). */
export interface NotShownCount {
  key: string;
  count: number;
}

export interface NormalizedEvidence {
  findings: readonly EvidenceFinding[];
  categories: Readonly<Record<FindingCategory, 'analysed' | 'not-analysed'>>;
  notShown: readonly NotShownCount[];
  /** Y23/Y26: report paths `normalizeRelativePath` refused (absolute, `..`, control
   *  characters, …), distinct and sorted. Their findings were dropped. */
  rejectedPaths: readonly string[];
  /** `workspace_diagnostics[].message`, verbatim, rendered as text only. */
  warnings: readonly string[];
}

/** Y27: one attached report and where it came from. */
export interface EvidenceReport {
  provider: 'fallow';
  providerVersion: string;
  reportKind: FallowReportKind;
  schemaVersion: number;
  /** The picked file's name only, never a path, at most 255 characters. */
  fileName: string;
  /** ISO 8601, from the Clock. */
  importedAt: string;
  /** The snapshot the report was attached to; a different current snapshot makes it stale (Y30). */
  snapshotId: string;
  stripPrefix: string | null;
  normalized: NormalizedEvidence;
}
```

- [ ] **Step 7: Implement the normaliser.** Create `src/application/evidence/normalize-fallow.ts`:

```ts
// Part 6 Y23-Y25, Y27: a validated fallow report in, provider-neutral evidence out. Pure
// and snapshot-independent, so the evidence index can resolve the same report again
// against a newer snapshot (Y30); matching is resolve-findings.ts's job. Only paths,
// numbers, tool names and tool messages are copied: no source text exists in the input
// (fallow-report-schema.ts strips it) and none is produced here.
import { fnv1a32Hex } from '../../domain/hash';
import { normalizeRelativePath } from '../../domain/path-safety';
import type {
  EvidenceFinding, EvidenceReport, FindingCategory, FindingRule, NormalizedEvidence, NotShownCount,
} from './model';
import type {
  RawCheckSection, RawCloneInstance, RawDupesSection, RawFallowReport, RawHealthFinding, RawHealthSection, RawUnusedEntry,
} from './raw-fallow';

/** check.summary keys Part 6 shows (as findings) or that are a total, not a section. */
const SHOWN_SUMMARY_KEYS = new Set(['total_issues', 'unused_exports', 'unused_types']);
const REJECTED_TEXT_MAX = 1024;
const FILE_NAME_MAX = 255;
const VERSION_MAX = 64;

/** Y26: a strip prefix is a normalised relative folder followed by '/', like `src/`. */
function isFolderPrefix(prefix: string): boolean {
  if (!prefix.endsWith('/')) return false;
  const folder = prefix.slice(0, -1);
  try {
    return normalizeRelativePath(folder) === folder;
  } catch {
    return false;
  }
}

interface Sections {
  check: RawCheckSection | null;
  dupes: RawDupesSection | null;
  health: RawHealthSection | null;
}

/** Y22: a combined report nests its sections; a single-command report is its section. */
function sectionsOf(raw: RawFallowReport): Sections {
  switch (raw.kind) {
    case 'combined': return { check: raw.check ?? null, dupes: raw.dupes ?? null, health: raw.health ?? null };
    case 'dead-code': return { check: raw, dupes: null, health: null };
    case 'health': return { check: null, dupes: null, health: raw };
    case 'dupes': return { check: null, dupes: raw, health: null };
  }
}

type PathMapper = (reportPath: string) => string | null;

/** Y26: every report path goes through the scanner's own `normalizeRelativePath`. A
 *  refused path is recorded and yields null (its finding is dropped). The strip prefix,
 *  when chosen, is removed from every path that starts with it. */
function pathMapper(stripPrefix: string | null, rejected: Set<string>): PathMapper {
  return (reportPath) => {
    let path: string;
    try {
      path = normalizeRelativePath(reportPath);
    } catch {
      rejected.add(reportPath.slice(0, REJECTED_TEXT_MAX));
      return null;
    }
    if (stripPrefix !== null && path.length > stripPrefix.length && path.startsWith(stripPrefix)) {
      return path.slice(stripPrefix.length);
    }
    return path;
  };
}

const findingId = (prefix: 'CX' | 'DU' | 'UN', key: string): string => `${prefix}-${fnv1a32Hex(key)}`;
const byPosition = (a: RawHealthFinding, b: RawHealthFinding): number => a.line - b.line || a.col - b.col;

/** Y24: the index of each finding among same-named findings in its file, counted in
 *  source order (line, then column), so reordering the report never renames a finding. */
function occurrenceIndexes(findings: readonly RawHealthFinding[], mapPath: PathMapper): Map<RawHealthFinding, number> {
  const groups = new Map<string, RawHealthFinding[]>();
  for (const f of findings) {
    const path = mapPath(f.path);
    if (path === null) continue;
    const key = `${path}|${f.name}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const index = new Map<RawHealthFinding, number>();
  for (const group of groups.values()) [...group].sort(byPosition).forEach((f, i) => index.set(f, i));
  return index;
}

/** Y23: one finding per health finding. */
function complexityFindings(health: RawHealthSection, mapPath: PathMapper): EvidenceFinding[] {
  const occurrence = occurrenceIndexes(health.findings, mapPath);
  const out: EvidenceFinding[] = [];
  for (const f of health.findings) {
    const path = mapPath(f.path);
    if (path === null) continue;
    out.push({
      id: findingId('CX', `${path}|${f.name}|${occurrence.get(f) ?? 0}`),
      category: 'complexity', rule: 'complexity', severity: f.severity, path,
      line: f.line, endLine: null, symbol: f.name,
      detail: {
        kind: 'complexity', cognitive: f.cognitive, cyclomatic: f.cyclomatic, lineCount: f.line_count, exceeded: f.exceeded,
        cognitiveThreshold: health.summary.max_cognitive_threshold, cyclomaticThreshold: health.summary.max_cyclomatic_threshold,
      },
    });
  }
  return out;
}

/** Y23: one finding per (clone group, instance file). A file holding two instances of the
 *  same group gets one finding, with its earliest instance's range. `partnerFiles`
 *  counts the group's other distinct files, a refused path included. */
function duplicationFindings(dupes: RawDupesSection, mapPath: PathMapper): EvidenceFinding[] {
  const out: EvidenceFinding[] = [];
  for (const group of dupes.clone_groups) {
    const refused = new Set<string>();
    const first = new Map<string, RawCloneInstance>();
    for (const instance of group.instances) {
      const path = mapPath(instance.file);
      if (path === null) {
        refused.add(instance.file);
        continue;
      }
      const seen = first.get(path);
      if (seen === undefined || instance.start_line < seen.start_line) first.set(path, instance);
    }
    const partnerFiles = first.size + refused.size - 1;
    for (const [path, instance] of first) {
      out.push({
        id: findingId('DU', `${group.fingerprint}|${path}`),
        category: 'duplication', rule: 'duplication', severity: null, path,
        line: instance.start_line, endLine: instance.end_line, symbol: null,
        detail: { kind: 'duplication', tokenCount: group.token_count, lineCount: group.line_count, partnerFiles },
      });
    }
  }
  return out;
}

/** Y23: one finding per unused export and per unused type. */
function unusedFindings(entries: readonly RawUnusedEntry[], rule: FindingRule, mapPath: PathMapper): EvidenceFinding[] {
  const out: EvidenceFinding[] = [];
  for (const e of entries) {
    const path = mapPath(e.path);
    if (path === null) continue;
    out.push({
      id: findingId('UN', `${path}|${e.export_name}|${rule}`),
      category: 'unused-exports', rule, severity: null, path,
      line: e.line, endLine: null, symbol: e.export_name,
      detail: { kind: 'unused', typeOnly: e.is_type_only },
    });
  }
  return out;
}

/** Y25: every non-zero check.summary count Part 6 does not show, in the report's order,
 *  and the clone groups a standalone dupes report left out. */
function notShownOf(s: Sections): NotShownCount[] {
  const out: NotShownCount[] = [];
  if (s.check !== null) {
    for (const [key, count] of Object.entries(s.check.summary)) {
      if (!SHOWN_SUMMARY_KEYS.has(key) && count > 0) out.push({ key, count });
    }
  }
  const omitted = s.dupes?.clone_groups_omitted;
  if (omitted !== undefined && omitted > 0) out.push({ key: 'clone_groups_omitted', count: omitted });
  return out;
}

/** Keeps the first finding for each id: an identical key is the same finding reported twice. */
function distinctById(findings: readonly EvidenceFinding[]): EvidenceFinding[] {
  const seen = new Set<string>();
  const out: EvidenceFinding[] = [];
  for (const f of findings) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}

const analysed = (present: boolean): 'analysed' | 'not-analysed' => (present ? 'analysed' : 'not-analysed');

/** Y23: the whole mapping. `stripPrefix` is null, or a folder ending in '/' that the user
 *  chose in the review step (Y26); anything else is a programming error. */
export function normalizeFallow(raw: RawFallowReport, opts: { stripPrefix: string | null }): NormalizedEvidence {
  if (opts.stripPrefix !== null && !isFolderPrefix(opts.stripPrefix)) {
    throw new Error('A strip prefix is a relative folder ending in "/".');
  }
  const s = sectionsOf(raw);
  const rejected = new Set<string>();
  const mapPath = pathMapper(opts.stripPrefix, rejected);
  const findings = distinctById([
    ...(s.health !== null ? complexityFindings(s.health, mapPath) : []),
    ...(s.dupes !== null ? duplicationFindings(s.dupes, mapPath) : []),
    ...(s.check !== null ? unusedFindings(s.check.unused_exports, 'unused-export', mapPath) : []),
    ...(s.check !== null ? unusedFindings(s.check.unused_types, 'unused-type', mapPath) : []),
  ]);
  // Y25: a category is analysed when the report carries its section, even with no finding.
  const categories: Record<FindingCategory, 'analysed' | 'not-analysed'> = {
    complexity: analysed(s.health !== null),
    duplication: analysed(s.dupes !== null),
    'unused-exports': analysed(s.check !== null),
  };
  return {
    findings,
    categories,
    notShown: notShownOf(s),
    rejectedPaths: [...rejected].sort(),
    warnings: (raw.workspace_diagnostics ?? []).map((d) => d.message),
  };
}

/** Y27: the last segment of whatever the browser called the file, never a path. */
function baseName(name: string): string {
  const at = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
  return name.slice(at + 1).slice(0, FILE_NAME_MAX);
}

/** Y27: the report to attach, with its provenance. */
export function buildEvidenceReport(input: {
  raw: RawFallowReport;
  fileName: string;
  importedAt: string;
  snapshotId: string;
  stripPrefix: string | null;
}): EvidenceReport {
  return {
    provider: 'fallow',
    providerVersion: input.raw.version.slice(0, VERSION_MAX),
    reportKind: input.raw.kind,
    schemaVersion: input.raw.schema_version,
    fileName: baseName(input.fileName),
    importedAt: input.importedAt,
    snapshotId: input.snapshotId,
    stripPrefix: input.stripPrefix,
    normalized: normalizeFallow(input.raw, { stripPrefix: input.stripPrefix }),
  };
}
```

- [ ] **Step 8: Implement resolution and the mapping offer.** Create `src/application/evidence/resolve-findings.ts`:

```ts
// Part 6 Y26: matching normalised findings against a snapshot's file paths, and the
// explicit folder mapping the review step may offer. Pure. A finding whose path is not a
// snapshot file never paints a lot or appears in a table: it is dropped, and its path is
// listed. Nothing is ever mapped without the user's choice: `suggestStripPrefix` only
// proposes.
import type { EvidenceFinding } from './model';

export function resolveFindings(
  findings: readonly EvidenceFinding[],
  snapshotPaths: ReadonlySet<string>,
): { matched: readonly EvidenceFinding[]; unmatchedPaths: readonly string[] } {
  const matched: EvidenceFinding[] = [];
  const unmatched = new Set<string>();
  for (const f of findings) {
    if (snapshotPaths.has(f.path)) matched.push(f);
    else unmatched.add(f.path);
  }
  return { matched, unmatchedPaths: [...unmatched].sort() };
}

/** Every leading folder of every path, as `a/`, `a/b/`, … */
function leadingFolders(paths: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const path of paths) {
    const segments = path.split('/');
    for (let i = 1; i < segments.length; i += 1) out.add(`${segments.slice(0, i).join('/')}/`);
  }
  return out;
}

/** Y26: every unmatched path under `prefix` matches once it is removed, at least one path
 *  is under it, and no snapshot path is under it (so removing it can never break a path
 *  that already matches: `normalizeFallow` strips it from every path). */
function qualifies(prefix: string, paths: readonly string[], snapshotPaths: ReadonlySet<string>): boolean {
  let any = false;
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue;
    if (!snapshotPaths.has(path.slice(prefix.length))) return false;
    any = true;
  }
  if (!any) return false;
  for (const snapshotPath of snapshotPaths) if (snapshotPath.startsWith(prefix)) return false;
  return true;
}

/** Y26: the shortest qualifying leading folder, or null. Two qualifying folders of that
 *  same shortest length are ambiguous, and nothing is offered. */
export function suggestStripPrefix(paths: readonly string[], snapshotPaths: ReadonlySet<string>): string | null {
  const qualifying = [...leadingFolders(paths)].filter((prefix) => qualifies(prefix, paths, snapshotPaths));
  if (qualifying.length === 0) return null;
  const shortest = qualifying.reduce((min, p) => Math.min(min, p.length), Number.POSITIVE_INFINITY);
  const best = qualifying.filter((p) => p.length === shortest);
  return best.length === 1 ? best[0]! : null;
}
```

- [ ] **Step 9: Run and confirm it passes.** Run `npx vitest run tests/unit/normalize-fallow.test.ts tests/unit/normalize-fallow-ids.test.ts tests/unit/resolve-findings.test.ts tests/unit/fallow-report-reader.test.ts`. Expected: all pass (34, 23, 13 and 50 tests). Then the gate:

```bash
npm run typecheck && npm run lint:fast && npx vitest run tests/unit/normalize-fallow.test.ts tests/unit/normalize-fallow-ids.test.ts tests/unit/resolve-findings.test.ts tests/unit/fallow-report-reader.test.ts tests/unit/no-process-execution.test.ts
npx eslint src/domain/hash.ts src/application/evidence/model.ts src/application/evidence/normalize-fallow.ts src/application/evidence/resolve-findings.ts tests/fixtures/fallow-expected.ts tests/unit/normalize-fallow.test.ts tests/unit/normalize-fallow-ids.test.ts tests/unit/resolve-findings.test.ts --max-warnings 0
```

  Check the sizes: `normalize-fallow.ts` at most 400 (236), each test file at most 450.

- [ ] **Step 10: Commit.**

```bash
git add src/domain/hash.ts src/application/evidence/model.ts src/application/evidence/normalize-fallow.ts src/application/evidence/resolve-findings.ts tests/fixtures/fallow-expected.ts tests/unit/normalize-fallow.test.ts tests/unit/normalize-fallow-ids.test.ts tests/unit/resolve-findings.test.ts
git commit -m "feat(application): fallow evidence model, normaliser and path resolution (Y23-Y27)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---


---

### Task 7: Session evidence, the evidence store, wiring and the command (Y28, Y29, Y39)

Imported fallow evidence is held in memory for the session, in ONE repository per plugin that every leaf shares. Each leaf has its own Pinia evidence store (a setup store, R7). App binds that store to the snapshot's codebase, next to report and review. The store subscribes to the shared repository, so an import in one leaf shows in every leaf on the same codebase. The command `import-analysis-report` opens Data & scans and raises an import request. SourcesScreen turns that request into the S14 dialog in Task 10. Nothing here reads a file, and nothing is written to `data.json` or the vault.

**Files:**
- Create: `src/application/ports/evidence-repository.ts` (~20)
- Create: `src/adapters/storage/in-memory-evidence-store.ts` (~40)
- Create: `src/ui/stores/evidence-store.ts` (~85)
- Modify: `src/host/data-ports.ts` (Task 4's file, +~20). Task 7 extends `wireDataPorts` and `unwireDataPorts` (R2) and adds `requestReportImport`.
- Modify: `src/host/city-scan-controller.ts` (Task 4's ~157 → +3: `CityViewDeps.evidenceStore`)
- Modify: `src/host/city-view.ts` (Task 4's ~280 → about 286: `hasSnapshot` and `openReportImport`). `onClose` already calls `unwireDataPorts` from Task 4. The file must stay ≤ 360 (`tests/unit/city-budget.test.ts`).
- Modify: `src/host/commands.ts` (71 → ~86)
- Modify: `src/main.ts` (Task 4's text → +4)
- Modify: `src/ui/App.vue` (Task 4's text → +3)
- Modify: `src/ui/audit-copy/fallow.ts` (Task 5's file, +2: `FALLOW_COMMAND_IMPORT`)
- Modify: `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md` (+3: the `checkpoint4:commands` block, which `tests/host/clean-vault-install.test.ts` compares with `commands.ts`)
- Create: `tests/fixtures/evidence-report.ts` (~22; the minimal shared fixture, R5. Task 8 replaces it with the full version.)
- Modify: `tests/fixtures/data-port-deps.ts` (Task 4's ~22 → ~24: the `Pick` gains `'evidenceStore'`, R2)
- Create: `tests/unit/in-memory-evidence-store.test.ts` (~60)
- Create: `tests/unit/evidence-store.test.ts` (~125)
- Create: `tests/host/evidence-ports.test.ts` (~80, node project)
- Create: `tests/host/city-view-evidence.test.ts` (~115, jsdom project through the existing `tests/host/city-view*.test.ts` glob)
- Modify: `tests/host/commands.test.ts` (133 → ~172)
- Modify: `tests/host/plugin-onload.test.ts` (Task 4's text → +1)
- Do NOT touch `tests/host/city-view-store-wiring.test.ts` (450/450). It gets the evidence store through `...dataPortDeps()`.

**Interfaces:**
- Consumes:
  - `EvidenceReport` and `FindingCategory` from `src/application/evidence/model.ts` (Task 6, R4);
  - `FallowReportKind` (R4, `raw-fallow.ts`), only through `EvidenceReport.reportKind`;
  - from Task 4: `wireDataPorts(pinia, deps)`, `unwireDataPorts(pinia)` (which already calls `useReviewStore(pinia).detach()`) and `CityViewDeps.reviewRepositoryFor`;
  - `dataPortDeps()` in `tests/fixtures/data-port-deps.ts` (Task 4, R2);
  - `useCityStore().navigate(route)`.
- Produces:
  - `interface EvidenceRepository { get(repositoryId): EvidenceReport | null; put(repositoryId, report): void; remove(repositoryId): void; subscribe(listener: (repositoryId: string) => void): () => void }`.
  - `class InMemoryEvidenceStore implements EvidenceRepository` (no constructor arguments).
  - `useEvidenceStore`, a setup store (R7):
    - refs `repositoryId: string`, `report: EvidenceReport | null`, `importRequested: boolean`;
    - synchronous actions `setRepository(repo)`, `bindRepository(id)`, `attach(report): boolean`, `remove(): boolean`, `requestImport()`, `consumeImportRequest(): boolean`;
    - `$dispose()` drops its subscription.
  - `CityViewDeps.evidenceStore: EvidenceRepository`.
  - In `src/host/data-ports.ts`:
    - `wireDataPorts` also calls `useEvidenceStore(pinia).setRepository(deps.evidenceStore)`;
    - `unwireDataPorts` also calls `useEvidenceStore(pinia).$dispose()`;
    - new: `requestReportImport(pinia: Pinia): void`.
  - `CityView.hasSnapshot(): boolean` and `CityView.openReportImport(): void`.
  - Command `import-analysis-report`, named `FALLOW_COMMAND_IMPORT` (`'Import analysis report'`).
  - `tests/fixtures/evidence-report.ts` (minimal): `ALL_ANALYSED`, `SYNTHETIC_VERSION`, `emptyEvidenceReport(snapshotId, fileName?)`.

- [ ] **Step 1: The shared evidence fixture (minimal).** Create `tests/fixtures/evidence-report.ts`:

```ts
// Part 6: THE shared EvidenceReport fixture (ruling R5). Task 7: the empty report the store
// and wiring tests move around. Task 8 replaces this file with the full version (the
// synthetic fallow JSON and the report built from it through the real parser).
import type { EvidenceReport, FindingCategory } from '../../src/application/evidence/model';

type Categories = Record<FindingCategory, 'analysed' | 'not-analysed'>;
export const ALL_ANALYSED: Readonly<Categories> = { complexity: 'analysed', duplication: 'analysed', 'unused-exports': 'analysed' };
export const SYNTHETIC_VERSION = '3.27.0';

/** A well-formed report with no findings: the store and wiring tests only move it around. */
export function emptyEvidenceReport(snapshotId: string, fileName = 'fallow.json'): EvidenceReport {
  return {
    provider: 'fallow', providerVersion: SYNTHETIC_VERSION, reportKind: 'combined', schemaVersion: 12, fileName,
    importedAt: '2026-09-23T10:00:00.000Z', snapshotId, stripPrefix: null,
    normalized: { findings: [], categories: { ...ALL_ANALYSED }, notShown: [], rejectedPaths: [], warnings: [] },
  };
}
```

- [ ] **Step 2: Write the failing tests.**

Create `tests/unit/in-memory-evidence-store.test.ts`:

```ts
// Part 6 Y28: session-only evidence, one report per codebase, shared by every leaf.
import { describe, expect, it, vi } from 'vitest';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { emptyEvidenceReport } from '../fixtures/evidence-report';

describe('InMemoryEvidenceStore (Part 6 Y28)', () => {
  it('holds one report per codebase and hands back the stored object itself', () => {
    const store = new InMemoryEvidenceStore();
    const a = emptyEvidenceReport('s1', 'a.json');
    const b = emptyEvidenceReport('s1', 'b.json');
    expect(store.get('p1')).toBeNull();
    store.put('p1', a);
    store.put('p2', b);
    expect(store.get('p1')).toBe(a);
    expect(store.get('p2')).toBe(b);
    const replacement = emptyEvidenceReport('s2', 'c.json');
    store.put('p1', replacement);
    expect(store.get('p1')).toBe(replacement);
    store.remove('p1');
    expect(store.get('p1')).toBeNull();
    expect(store.get('p2')).toBe(b);
  });

  it('notifies every subscriber with the codebase after a put and a remove; removing nothing notifies nobody', () => {
    const store = new InMemoryEvidenceStore();
    const first = vi.fn();
    const second = vi.fn();
    store.subscribe(first);
    store.subscribe(second);
    store.put('p1', emptyEvidenceReport('s1'));
    store.remove('p1');
    store.remove('p1');
    store.remove('never-attached');
    expect(first.mock.calls).toEqual([['p1'], ['p1']]);
    expect(second.mock.calls).toEqual([['p1'], ['p1']]);
  });

  it('unsubscribing stops notifications, and the same listener subscribed twice unsubscribes independently', () => {
    const store = new InMemoryEvidenceStore();
    const listener = vi.fn();
    const offFirst = store.subscribe(listener);
    const offSecond = store.subscribe(listener);
    store.put('p1', emptyEvidenceReport('s1'));
    expect(listener).toHaveBeenCalledTimes(2);
    offFirst();
    store.put('p1', emptyEvidenceReport('s2'));
    expect(listener).toHaveBeenCalledTimes(3);
    offSecond();
    offSecond();
    store.put('p1', emptyEvidenceReport('s3'));
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('a listener that unsubscribes while being notified never makes another one miss it', () => {
    const store = new InMemoryEvidenceStore();
    const later = vi.fn();
    const off = store.subscribe(() => { off(); });
    store.subscribe(later);
    store.put('p1', emptyEvidenceReport('s1'));
    expect(later).toHaveBeenCalledWith('p1');
  });
});
```

Create `tests/unit/evidence-store.test.ts`:

```ts
// Part 6 Y29 (ruling R7): the leaf's evidence store mirrors the shared repository's entry
// for the bound codebase, and never keeps a copy of its own that could diverge from the port.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { isReactive } from 'vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import type { EvidenceRepository } from '../../src/application/ports/evidence-repository';
import { emptyEvidenceReport } from '../fixtures/evidence-report';

/** A shared repository that counts its live subscriptions. */
function counting(): { repository: EvidenceRepository; live: () => number } {
  const inner = new InMemoryEvidenceStore();
  let live = 0;
  const repository: EvidenceRepository = {
    get: (id) => inner.get(id),
    put: (id, report) => { inner.put(id, report); },
    remove: (id) => { inner.remove(id); },
    subscribe: (listener) => {
      live += 1;
      const off = inner.subscribe(listener);
      let done = false;
      return () => { if (done) return; done = true; live -= 1; off(); };
    },
  };
  return { repository, live: () => live };
}

/** One leaf: its own Pinia, wired to the shared repository, optionally bound. */
function leaf(repository: EvidenceRepository, id?: string): ReturnType<typeof useEvidenceStore> {
  const store = useEvidenceStore(createPinia());
  store.setRepository(repository);
  if (id !== undefined) store.bindRepository(id);
  return store;
}

describe('evidence store (Part 6 Y29, R7)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('refuses to attach or remove while unbound or without a repository, and reads null', () => {
    const noRepository = useEvidenceStore();
    noRepository.bindRepository('p1');
    expect(noRepository.attach(emptyEvidenceReport('s1'))).toBe(false);
    expect(noRepository.report).toBeNull();
    const repository = new InMemoryEvidenceStore();
    const unbound = leaf(repository);
    expect(unbound.repositoryId).toBe('');
    expect(unbound.attach(emptyEvidenceReport('s1'))).toBe(false);
    expect(unbound.remove()).toBe(false);
    expect(repository.get('')).toBeNull();
  });

  it('attach goes through the port, and the store shows the port\'s own object, never a reactive copy', () => {
    const repository = new InMemoryEvidenceStore();
    const store = leaf(repository, 'p1');
    const report = emptyEvidenceReport('s1');
    expect(store.attach(report)).toBe(true);
    expect(repository.get('p1')).toBe(report);
    expect(store.report).toBe(report);
    expect(isReactive(store.report)).toBe(false);
  });

  it('remove goes through the port; with nothing attached it is refused (E17: nothing to announce)', () => {
    const repository = new InMemoryEvidenceStore();
    const store = leaf(repository, 'p1');
    expect(store.remove()).toBe(false);
    store.attach(emptyEvidenceReport('s1'));
    expect(store.remove()).toBe(true);
    expect(repository.get('p1')).toBeNull();
    expect(store.report).toBeNull();
  });

  it('an import in one leaf shows in every leaf bound to the same codebase, and in no other', () => {
    const repository = new InMemoryEvidenceStore();
    const a = leaf(repository, 'p1');
    const b = leaf(repository, 'p1');
    const c = leaf(repository, 'p2');
    const report = emptyEvidenceReport('s1');
    expect(a.attach(report)).toBe(true);
    expect(b.report).toBe(report);
    expect(c.report).toBeNull();
    expect(b.remove()).toBe(true);
    expect(a.report).toBeNull();
  });

  it('a switch reads the new codebase\'s entry at once and drops a pending import request; switching back restores the old entry', () => {
    const repository = new InMemoryEvidenceStore();
    const forP1 = emptyEvidenceReport('s1', 'p1.json');
    repository.put('p1', forP1);
    const store = leaf(repository, 'p1');
    expect(store.report).toBe(forP1);
    store.requestImport();
    store.bindRepository('p1');
    expect(store.importRequested).toBe(true);
    store.bindRepository('p2');
    expect(store.report).toBeNull();
    expect(store.importRequested).toBe(false);
    store.bindRepository('p1');
    expect(store.report).toBe(forP1);
  });

  it('listens to the bound codebase only: one live subscription per leaf, replaced on every rebind', () => {
    const { repository, live } = counting();
    const store = leaf(repository);
    expect(live()).toBe(0);
    store.bindRepository('p1');
    expect(live()).toBe(1);
    store.bindRepository('p2');
    expect(live()).toBe(1);
    repository.put('p1', emptyEvidenceReport('s1'));
    expect(store.report).toBeNull();
    const forP2 = emptyEvidenceReport('s1', 'p2.json');
    repository.put('p2', forP2);
    expect(store.report).toBe(forP2);
  });

  it('$dispose drops the subscription on the shared repository', () => {
    const { repository, live } = counting();
    const store = leaf(repository, 'p1');
    expect(live()).toBe(1);
    store.$dispose();
    expect(live()).toBe(0);
    expect(() => { repository.put('p1', emptyEvidenceReport('s1')); }).not.toThrow();
  });

  it('an import request is consumed exactly once', () => {
    const store = leaf(new InMemoryEvidenceStore(), 'p1');
    expect(store.consumeImportRequest()).toBe(false);
    store.requestImport();
    expect(store.importRequested).toBe(true);
    expect(store.consumeImportRequest()).toBe(true);
    expect(store.consumeImportRequest()).toBe(false);
    expect(store.importRequested).toBe(false);
  });
});
```

Create `tests/host/evidence-ports.test.ts` (node project):

```ts
// Part 6 Y28/Y29/Y39 (ruling R2): the evidence half of the data-port helpers city-view.ts
// calls, tested without a view. Task 4's tests/host/data-ports.test.ts covers the review half.
import { describe, expect, it } from 'vitest';
import { createPinia } from 'pinia';
import { requestReportImport, unwireDataPorts, wireDataPorts } from '../../src/host/data-ports';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { emptyEvidenceReport } from '../fixtures/evidence-report';
import type { CityViewDeps } from '../../src/host/city-view';
import type { EvidenceRepository } from '../../src/application/ports/evidence-repository';

function depsWith(evidenceStore: EvidenceRepository): CityViewDeps {
  return {
    profileStore: createFakeProfileStoreHarness().store,
    getFilesystem: () => createFakeSourceFileSystem({}).port,
    snapshotStore: new InMemorySnapshotStore(createFixedClock()),
    clock: createFixedClock(),
    ...dataPortDeps(),
    evidenceStore,
  };
}

describe('data ports: evidence (Part 6 Y28/Y29)', () => {
  it('wireDataPorts hands every leaf the ONE shared repository', () => {
    const shared = new InMemoryEvidenceStore();
    const deps = depsWith(shared);
    const leafA = createPinia();
    const leafB = createPinia();
    wireDataPorts(leafA, deps);
    wireDataPorts(leafB, deps);
    useEvidenceStore(leafA).bindRepository('p1');
    useEvidenceStore(leafB).bindRepository('p1');
    const report = emptyEvidenceReport('s1');
    expect(useEvidenceStore(leafA).attach(report)).toBe(true);
    expect(shared.get('p1')).toBe(report);
    expect(useEvidenceStore(leafB).report).toBe(report);
  });

  it('unwireDataPorts drops the closing leaf\'s listener; the other leaf keeps following', () => {
    const shared = new InMemoryEvidenceStore();
    let live = 0;
    const subscribe = shared.subscribe.bind(shared);
    shared.subscribe = (listener) => {
      live += 1;
      const off = subscribe(listener);
      return () => { live -= 1; off(); };
    };
    const deps = depsWith(shared);
    const leafA = createPinia();
    const leafB = createPinia();
    wireDataPorts(leafA, deps);
    wireDataPorts(leafB, deps);
    useEvidenceStore(leafA).bindRepository('p1');
    useEvidenceStore(leafB).bindRepository('p1');
    expect(live).toBe(2);
    unwireDataPorts(leafA);
    expect(live).toBe(1);
    const report = emptyEvidenceReport('s1');
    shared.put('p1', report);
    expect(useEvidenceStore(leafB).report).toBe(report);
  });
});

describe('data ports: requestReportImport (Part 6 Y39)', () => {
  it('opens Data & scans and raises the import request, which is consumed once', () => {
    const pinia = createPinia();
    wireDataPorts(pinia, depsWith(new InMemoryEvidenceStore()));
    requestReportImport(pinia);
    expect(useCityStore(pinia).route).toBe('sources');
    expect(useEvidenceStore(pinia).consumeImportRequest()).toBe(true);
    expect(useEvidenceStore(pinia).consumeImportRequest()).toBe(false);
  });
});
```

Create `tests/host/city-view-evidence.test.ts`. It runs in the jsdom project through the `tests/host/city-view*.test.ts` glob in `vitest.config.ts`.

```ts
// Part 6 Y28/Y29/Y39 with a real CityView:
// - the view gives its own evidence store the plugin's ONE repository;
// - App binds that store to the snapshot's codebase;
// - the command's two methods work;
// - closing the leaf (Task 4's unwireDataPorts in onClose) drops its listener.
// A new file, because city-view-store-wiring.test.ts is at 450/450.
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { getActivePinia, type Pinia } from 'pinia';
import { CityView } from '../../src/host/city-view';
import { defaultCityViewState } from '../../src/host/view-state';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { emptyEvidenceReport } from '../fixtures/evidence-report';
import type { CityViewDeps } from '../../src/host/city-view';
import type { EvidenceRepository } from '../../src/application/ports/evidence-repository';

// A fresh leaf opens on Overview, so no renderer is ever built. The mock only keeps
// three.js out of this file.
vi.mock('../../src/visualization/city-renderer', () => ({ createCityRenderer: vi.fn() }));

function makePluginDouble() {
  return {
    app: {
      workspace: {
        onLayoutReady: vi.fn(), getLeavesOfType: vi.fn(() => []), getLeaf: vi.fn(),
        revealLeaf: vi.fn(async () => {}), on: vi.fn(() => ({})), offref: vi.fn(),
      },
      vault: { adapter: { read: vi.fn(), list: vi.fn() }, configDir: '.obsidian' },
    },
  };
}

/** The shared repository, counting its live subscriptions. */
function counting(): { repository: EvidenceRepository; live: () => number } {
  const inner = new InMemoryEvidenceStore();
  let live = 0;
  const repository: EvidenceRepository = {
    get: (id) => inner.get(id),
    put: (id, report) => { inner.put(id, report); },
    remove: (id) => { inner.remove(id); },
    subscribe: (listener) => {
      live += 1;
      const off = inner.subscribe(listener);
      let done = false;
      return () => { if (done) return; done = true; live -= 1; off(); };
    },
  };
  return { repository, live: () => live };
}

function makeDeps(evidenceStore: EvidenceRepository): CityViewDeps {
  const snapshotStore = new InMemorySnapshotStore(createFixedClock());
  snapshotStore.put({ ...buildSnapshotFixture({ files: 3, repositoryId: 'p1' }), snapshotId: 's1' });
  return {
    profileStore: createFakeProfileStoreHarness().store,
    getFilesystem: () => createFakeSourceFileSystem({}).port,
    snapshotStore,
    clock: createFixedClock(),
    ...dataPortDeps(),
    evidenceStore,
  };
}

/** Opens a view (on the retained snapshot s1 unless told not to) and returns the Pinia it installed. */
async function openView(deps: CityViewDeps, withSnapshot = true): Promise<{ view: CityView; pinia: Pinia }> {
  const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, deps);
  if (withSnapshot) await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1' }, {} as never);
  await view.onOpen();
  await flushPromises();
  const pinia = getActivePinia();
  if (!pinia) throw new Error('test setup: the view installed no Pinia');
  return { view, pinia };
}

describe('CityView evidence wiring (Part 6 Y28/Y29/Y39)', () => {
  it('hasSnapshot() is false until a snapshot is on screen; openReportImport() opens Data & scans with the import request raised', async () => {
    const deps = makeDeps(new InMemoryEvidenceStore());
    const empty = await openView(deps, false);
    expect(empty.view.hasSnapshot()).toBe(false);
    await empty.view.onClose();
    const { view, pinia } = await openView(deps);
    expect(view.hasSnapshot()).toBe(true);
    view.openReportImport();
    await flushPromises();
    expect(useCityStore(pinia).route).toBe('sources');
    expect(useEvidenceStore(pinia).importRequested).toBe(true);
    expect(view.contentEl.querySelector('.ci-screen--sources')).not.toBeNull();
    await view.onClose();
  });

  it('two leaves on the same codebase share the plugin\'s one repository: an import in one shows in the other', async () => {
    const deps = makeDeps(new InMemoryEvidenceStore());
    const a = await openView(deps);
    const b = await openView(deps);
    expect(useEvidenceStore(a.pinia).repositoryId).toBe('p1');
    expect(useEvidenceStore(b.pinia).repositoryId).toBe('p1');
    const report = emptyEvidenceReport('s1');
    expect(useEvidenceStore(a.pinia).attach(report)).toBe(true);
    expect(useEvidenceStore(b.pinia).report).toBe(report);
    expect(deps.evidenceStore.get('p1')).toBe(report);
    await a.view.onClose();
    await b.view.onClose();
  });

  it('closing a leaf drops its listener on the shared repository', async () => {
    const { repository, live } = counting();
    const deps = makeDeps(repository);
    const a = await openView(deps);
    const b = await openView(deps);
    expect(live()).toBe(2);
    await b.view.onClose();
    expect(live()).toBe(1);
    await a.view.onClose();
    expect(live()).toBe(0);
  });
});
```

In `tests/host/commands.test.ts`:

(a) Replace:

```ts
interface AddedCommand {
  id: string;
  checkCallback?: (checking: boolean) => boolean;
}
```

with:

```ts
interface AddedCommand {
  id: string;
  name?: string;
  checkCallback?: (checking: boolean) => boolean;
}
```

(b) Replace:

```ts
function makeCommandsPluginDouble(activeView: ReturnType<typeof makeViewDouble> | null) {
```

with:

```ts
function makeCommandsPluginDouble(activeView: object | null) {
```

(c) Append at the end of the file:

```ts

// Part 6 Y39: import-analysis-report is offered only while the active city view shows a
// snapshot. Its body opens Data & scans and raises the import request; the file picker
// itself opens later, from a real click inside the S14 dialog (Task 10).
function makeImportViewDouble(snapshot: boolean): { hasSnapshot: () => boolean; openReportImport: ReturnType<typeof vi.fn> } {
  return { hasSnapshot: () => snapshot, openReportImport: vi.fn() };
}

describe('registerCommands — import-analysis-report (Part 6 Y39)', () => {
  it('is named "Import analysis report"', () => {
    const { addCommand } = makeCommandsPluginDouble(null);
    expect(findCommand(addCommand, 'import-analysis-report').name).toBe('Import analysis report');
  });

  it('checkCallback(true) returns FALSE with no active city view', () => {
    const { addCommand } = makeCommandsPluginDouble(null);
    expect(findCommand(addCommand, 'import-analysis-report').checkCallback!(true)).toBe(false);
  });

  it('checkCallback returns FALSE when the active view shows no snapshot, and opens nothing', () => {
    const view = makeImportViewDouble(false);
    const { addCommand } = makeCommandsPluginDouble(view);
    expect(findCommand(addCommand, 'import-analysis-report').checkCallback!(true)).toBe(false);
    expect(findCommand(addCommand, 'import-analysis-report').checkCallback!(false)).toBe(false);
    expect(view.openReportImport).not.toHaveBeenCalled();
  });

  it('checkCallback(true) returns true when it shows one, and opens nothing while only checking', () => {
    const view = makeImportViewDouble(true);
    const { addCommand } = makeCommandsPluginDouble(view);
    expect(findCommand(addCommand, 'import-analysis-report').checkCallback!(true)).toBe(true);
    expect(view.openReportImport).not.toHaveBeenCalled();
  });

  it('invoking it calls openReportImport() once', () => {
    const view = makeImportViewDouble(true);
    const { addCommand } = makeCommandsPluginDouble(view);
    expect(findCommand(addCommand, 'import-analysis-report').checkCallback!(false)).toBe(true);
    expect(view.openReportImport).toHaveBeenCalledTimes(1);
  });
});
```

In `tests/host/plugin-onload.test.ts`:

(a) Replace:

```ts
  it('registers the city view, the ribbon icon and three commands, and nothing else', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.registerView).toHaveBeenCalledWith(CITY_VIEW_TYPE, expect.any(Function));
    expect(p.addRibbonIcon).toHaveBeenCalledTimes(1);
    expect(p.addCommand.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id).sort())
      .toEqual(['cancel-scan', 'open-city', 'scan-codebase']);
  });
```

with:

```ts
  it('registers the city view, the ribbon icon and four commands, and nothing else', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.registerView).toHaveBeenCalledWith(CITY_VIEW_TYPE, expect.any(Function));
    expect(p.addRibbonIcon).toHaveBeenCalledTimes(1);
    expect(p.addCommand.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id).sort())
      .toEqual(['cancel-scan', 'import-analysis-report', 'open-city', 'scan-codebase']);
  });
```

(b) Replace:

```ts
  it('registers no command for an unimplemented capability', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.addCommand).toHaveBeenCalledTimes(3);
  });
```

with:

```ts
  it('registers no command for an unimplemented capability', () => {
    const p = makePluginDouble();
    p.onload();
    // Part 6 Y39: the fourth, import-analysis-report, is implemented; "Run fallow analysis" is Part 7.
    expect(p.addCommand).toHaveBeenCalledTimes(4);
  });
```

- [ ] **Step 3: Run them and confirm they fail.** Run `npx vitest run tests/unit/in-memory-evidence-store.test.ts tests/unit/evidence-store.test.ts tests/host/evidence-ports.test.ts tests/host/city-view-evidence.test.ts tests/host/commands.test.ts tests/host/plugin-onload.test.ts`. Expected: FAIL.
  - `in-memory-evidence-store`, `evidence-store`, `evidence-ports` and `city-view-evidence` fail to load with `Failed to resolve import "../../src/adapters/storage/in-memory-evidence-store"`.
  - `commands`: the five new tests fail with `test setup: no command registered with id "import-analysis-report"`.
  - `plugin-onload`: two tests fail, with `expected [ 'cancel-scan', 'open-city', 'scan-codebase' ] to deeply equal [ …(4) ]` and `expected "spy" to be called 4 times, but got 3 times`.

- [ ] **Step 4: The port and the adapter.**

Create `src/application/ports/evidence-repository.ts`:

```ts
// Part 6 Y28: where imported fallow evidence lives for the session. main.ts builds ONE
// instance, shared by every leaf through CityViewDeps.evidenceStore. Each leaf's evidence
// store (src/ui/stores/evidence-store.ts) mirrors the entry for the codebase it is bound to.
import type { EvidenceReport } from '../evidence/model';

export interface EvidenceRepository {
  /** The report attached to this codebase, or null. The stored object itself, never a copy. */
  get(repositoryId: string): EvidenceReport | null;
  /** Attaches the codebase's report, replacing any earlier one, then notifies every subscriber. */
  put(repositoryId: string, report: EvidenceReport): void;
  /** Removes it and notifies. Removing nothing notifies nobody. */
  remove(repositoryId: string): void;
  /** Called with the codebase whose report changed. Returns the unsubscribe function. */
  subscribe(listener: (repositoryId: string) => void): () => void;
}
```

Create `src/adapters/storage/in-memory-evidence-store.ts`:

```ts
// Part 6 Y28: imported fallow evidence, held in memory for this session only. main.ts
// builds ONE instance and every CityView shares it, so an import in one leaf reaches every
// leaf on the same codebase. Nothing is written to data.json or the vault: after a restart
// every codebase reads Not analysed until a report is imported again.
import type { EvidenceReport } from '../../application/evidence/model';
import type { EvidenceRepository } from '../../application/ports/evidence-repository';

/** One subscription. Wrapped, so the same listener subscribed twice unsubscribes independently. */
interface Subscription { listener: (repositoryId: string) => void }

export class InMemoryEvidenceStore implements EvidenceRepository {
  private readonly byRepository = new Map<string, EvidenceReport>();
  private readonly subscriptions = new Set<Subscription>();

  get(repositoryId: string): EvidenceReport | null {
    return this.byRepository.get(repositoryId) ?? null;
  }

  /** Last put wins: one report per codebase. */
  put(repositoryId: string, report: EvidenceReport): void {
    this.byRepository.set(repositoryId, report);
    this.notify(repositoryId);
  }

  remove(repositoryId: string): void {
    if (this.byRepository.delete(repositoryId)) this.notify(repositoryId);
  }

  subscribe(listener: (repositoryId: string) => void): () => void {
    const subscription: Subscription = { listener };
    this.subscriptions.add(subscription);
    return () => { this.subscriptions.delete(subscription); };
  }

  /** Over a copy, so a listener that unsubscribes while being notified never skips another. */
  private notify(repositoryId: string): void {
    for (const s of [...this.subscriptions]) s.listener(repositoryId);
  }
}
```

- [ ] **Step 5: The evidence store.** Create `src/ui/stores/evidence-store.ts`:

```ts
// Part 6 Y29 (ruling R7): this leaf's view of the imported fallow evidence for the bound
// codebase. The report itself lives in the plugin's ONE session-only EvidenceRepository
// (Y28), shared by every leaf. This store mirrors the bound codebase's entry and follows
// every change to it, so an import in one leaf shows at once in every leaf on the same
// codebase. It never keeps a copy of its own that could diverge from the port: attach and
// remove go through it.
//
// A setup store, unlike its siblings: `onScopeDispose` is how `$dispose()` (called by
// unwireDataPorts when the leaf closes) drops the listener on the shared repository, which
// outlives every leaf.
import { defineStore } from 'pinia';
import { onScopeDispose, ref, shallowRef } from 'vue';
import type { EvidenceReport } from '../../application/evidence/model';
import type { EvidenceRepository } from '../../application/ports/evidence-repository';

export const useEvidenceStore = defineStore('evidence', () => {
  /** `''` until App binds the leaf to a snapshot's codebase. */
  const repositoryId = ref('');
  /** Shallow: the report is immutable and shared by every leaf. It stays the port's own
   *  object, never a reactive copy, so the read-model memos can key on it (E53). */
  const report = shallowRef<EvidenceReport | null>(null);
  /** Y39: raised by the `import-analysis-report` command; SourcesScreen consumes it (Task 10). */
  const importRequested = ref(false);
  let repository: EvidenceRepository | null = null;
  let unsubscribe: (() => void) | null = null;

  function refresh(): void {
    report.value = repository !== null && repositoryId.value !== '' ? repository.get(repositoryId.value) : null;
  }
  /** Listens to the bound codebase only. The previous listener is dropped first (a rebind). */
  function listen(): void {
    unsubscribe?.();
    unsubscribe = null;
    const id = repositoryId.value;
    if (repository === null || id === '') return;
    unsubscribe = repository.subscribe((changed) => { if (changed === id) refresh(); });
  }
  /** The plugin's shared repository, set by wireDataPorts before mount. */
  function setRepository(next: EvidenceRepository): void {
    repository = next;
    listen();
    refresh();
  }
  /** Bound by App's repository watcher, next to report and review. An import request made
   *  for the previous codebase is dropped with it. Binding the bound id again is a no-op. */
  function bindRepository(id: string): void {
    if (id === repositoryId.value) return;
    repositoryId.value = id;
    importRequested.value = false;
    listen();
    refresh();
  }
  /** Attaches the report to the bound codebase, replacing any earlier one. False while unbound. */
  function attach(next: EvidenceReport): boolean {
    if (repository === null || repositoryId.value === '') return false;
    repository.put(repositoryId.value, next);
    refresh();
    return true;
  }
  /** Removes the bound codebase's report. False when there is none (E17: nothing to announce). */
  function remove(): boolean {
    if (repository === null || repositoryId.value === '' || report.value === null) return false;
    repository.remove(repositoryId.value);
    refresh();
    return true;
  }
  function requestImport(): void {
    importRequested.value = true;
  }
  /** True exactly once per request. */
  function consumeImportRequest(): boolean {
    if (!importRequested.value) return false;
    importRequested.value = false;
    return true;
  }
  onScopeDispose(() => {
    unsubscribe?.();
    unsubscribe = null;
  });
  return { repositoryId, report, importRequested, setRepository, bindRepository, attach, remove, requestImport, consumeImportRequest };
});
```

- [ ] **Step 6: The dependency, the data ports, the test deps helper and main.ts.**

(a) `src/host/city-scan-controller.ts`.
  - After Task 4's line `import type { ReviewRepository } from '../ui/stores/ports/review-repository';`, add:

```ts
import type { EvidenceRepository } from '../application/ports/evidence-repository';
```

  - Replace Task 4's last member of `interface CityViewDeps`:

```ts
  reviewRepositoryFor: (repositoryId: string) => ReviewRepository;
}
```

  with:

```ts
  reviewRepositoryFor: (repositoryId: string) => ReviewRepository;
  /** Part 6 Y28: imported fallow evidence, session-only. ONE instance per plugin, shared by every leaf. */
  evidenceStore: EvidenceRepository;
}
```

(b) `src/host/data-ports.ts` (Task 4's file, R2).
  - After Task 4's `import { useReviewStore } from '../ui/stores/review-store';`, add:

```ts
import { useCityStore } from '../ui/stores/city-store';
import { useEvidenceStore } from '../ui/stores/evidence-store';
```

  - In `wireDataPorts`'s body, after the line `useReviewStore(pinia).setRepositoryFactory(deps.reviewRepositoryFor);`, add:

```ts
  // Part 6 Y28/Y29: the plugin's ONE evidence repository. App binds the store to the
  // snapshot's codebase; the store listens to that codebase's entry.
  useEvidenceStore(pinia).setRepository(deps.evidenceStore);
```

  - In `unwireDataPorts`'s body, after the line `useReviewStore(pinia).detach();`, add:

```ts
  // Part 6 Y29: the shared evidence repository outlives the leaf. The evidence store is a
  // setup store, so `$dispose` runs its `onScopeDispose` and drops its listener.
  useEvidenceStore(pinia).$dispose();
```

  - Append at the end of the file:

```ts

/** Part 6 Y39: the `import-analysis-report` command's body. It goes to Data & scans and
 *  raises a request; SourcesScreen opens the S14 dialog from it (Task 10). The file picker
 *  therefore always opens from a real click inside the dialog. */
export function requestReportImport(pinia: Pinia): void {
  useCityStore(pinia).navigate('sources');
  useEvidenceStore(pinia).requestImport();
}
```

(c) `tests/fixtures/data-port-deps.ts` (Task 4's helper, R2).
  - Replace:

```ts
export function dataPortDeps(): Pick<CityViewDeps, 'reviewRepositoryFor'> {
```

  with:

```ts
export function dataPortDeps(): Pick<CityViewDeps, 'reviewRepositoryFor' | 'evidenceStore'> {
```

  - Replace:

```ts
      return repository;
    },
  };
}
```

  with:

```ts
      return repository;
    },
    // Part 6 Y28 (Task 7): one session evidence repository per deps object, as main.ts builds one.
    evidenceStore: new InMemoryEvidenceStore(),
  };
}
```

  - After the line `import { createInMemoryReviewRepository, type ReviewRepository } from '../../src/ui/stores/ports/review-repository';`, add:

```ts
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
```

  No `CityViewDeps` literal in any test changes: they all spread `...dataPortDeps()` since Task 4.

(d) `src/main.ts`.
  - After `import { InMemorySnapshotStore } from './adapters/storage/in-memory-snapshot-store';`, add:

```ts
import { InMemoryEvidenceStore } from './adapters/storage/in-memory-evidence-store';
```

  - Replace:

```ts
    const snapshotStore = new InMemorySnapshotStore(SYSTEM_CLOCK);
```

  with:

```ts
    const snapshotStore = new InMemorySnapshotStore(SYSTEM_CLOCK);
    // Part 6 Y28: imported fallow evidence is session-only, and ONE instance serves every
    // CityView for the same reason as the snapshot store: a second leaf on the codebase sees it.
    const evidenceStore = new InMemoryEvidenceStore();
```

  - Add `evidenceStore,` as the last property of the object literal passed as the third argument of `new CityView(leaf, this, { … })`, after Task 4's `reviewRepositoryFor` property.

- [ ] **Step 7: CityView.** Edit `src/host/city-view.ts`. `onClose` already calls `unwireDataPorts(this.pinia)` (Task 4, R2); nothing changes there.

(a) Replace Task 4's import `import { unwireDataPorts, wireDataPorts } from './data-ports';` with:

```ts
import { requestReportImport, unwireDataPorts, wireDataPorts } from './data-ports';
```

(b) Replace:

```ts
  isScanRunning(): boolean { return this.scanController.isScanRunning(); }
```

with:

```ts
  isScanRunning(): boolean { return this.scanController.isScanRunning(); }

  /** Part 6 Y39: `import-analysis-report` is offered only while this leaf shows a snapshot. */
  hasSnapshot(): boolean { return (this.cityStore?.snapshot ?? null) !== null; }

  /** Part 6 Y39: Data & scans, plus a request SourcesScreen turns into the S14 dialog. */
  openReportImport(): void { if (this.pinia) requestReportImport(this.pinia); }
```

Afterwards `wc -l src/host/city-view.ts` must be ≤ 360 (expect about 286).

- [ ] **Step 8: App binds the store.** In `src/ui/App.vue`:
  - After `import { useReviewStore } from './stores/review-store';`, add `import { useEvidenceStore } from './stores/evidence-store';`.
  - After `const review = useReviewStore();`, add `const evidence = useEvidenceStore();`.
  - In the repository watcher, directly after Task 4's review-bind line (`void review.bindRepository(id).catch(noop);`, R1), add:

```ts
  // Part 6 Y29: the evidence store too; it then follows that codebase's imported report.
  evidence.bindRepository(id);
```

- [ ] **Step 9: The command.**

(a) Append to `src/ui/audit-copy/fallow.ts` (created by Task 5, R4):

```ts
// Part 6 Y39: the command palette entry.
export const FALLOW_COMMAND_IMPORT = 'Import analysis report';
```

(b) In `src/host/commands.ts`, replace the first three lines:

```ts
// Registers the three WP-01 commands, without the plugin-id prefix (spec 5.2):
// open-city, scan-codebase, cancel-scan. No fourth command, and none for an
// unimplemented capability (spec 1).
```

  with:

```ts
// Registers the commands without the plugin-id prefix (spec 5.2): the three WP-01
// commands open-city, scan-codebase and cancel-scan, and Part 6's
// import-analysis-report (Y39). None for an unimplemented capability (spec 1).
```

  Replace:

```ts
import { COPY_09 } from '../ui/copy';
```

  with:

```ts
import { COPY_09 } from '../ui/copy';
import { FALLOW_COMMAND_IMPORT } from '../ui/inspector-copy';
```

  Replace the end of `registerCommands`:

```ts
      if (!view || !view.isScanRunning()) return false;
      if (checking) return true;
      view.cancelScan();
      return true;
    },
  });
}
```

  with:

```ts
      if (!view || !view.isScanRunning()) return false;
      if (checking) return true;
      view.cancelScan();
      return true;
    },
  });

  plugin.addCommand({
    id: 'import-analysis-report',
    name: FALLOW_COMMAND_IMPORT,
    // Part 6 Y39: only while the active city view shows a snapshot (paths are matched
    // against it). The body opens Data & scans and raises a request; the file is picked
    // inside the S14 dialog, from a real click. Nothing is read or run here.
    checkCallback: (checking: boolean): boolean => {
      const view = plugin.app.workspace.getActiveViewOfType(CityView);
      if (!view || !view.hasSnapshot()) return false;
      if (checking) return true;
      view.openReportImport();
      return true;
    },
  });
}
```

(c) In `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`, replace:

```md
- `cancel-scan` — "Cancel scan" (COPY-09). **Hidden from the palette unless the active
  view actually has a run to cancel** — its `checkCallback` returns false otherwise.

<!-- checkpoint4:commands:end -->
```

  with:

```md
- `cancel-scan` — "Cancel scan" (COPY-09). **Hidden from the palette unless the active
  view actually has a run to cancel** — its `checkCallback` returns false otherwise.
- `import-analysis-report` — "Import analysis report" (WP-02 Part 6, Y39). **Hidden unless
  the active city view shows a snapshot.** Opens Data & scans and the fallow import
  dialog. The report file is picked there; it is the only file read, and nothing runs.

<!-- checkpoint4:commands:end -->
```

  `tests/host/clean-vault-install.test.ts` compares this block with the ids in `commands.ts`.

- [ ] **Step 10: Run and confirm it passes.**
  - Run `npx vitest run tests/unit/in-memory-evidence-store.test.ts tests/unit/evidence-store.test.ts tests/host/evidence-ports.test.ts tests/host/city-view-evidence.test.ts tests/host/commands.test.ts tests/host/plugin-onload.test.ts tests/host/data-ports.test.ts`.
  - Then run the suites that build a `CityViewDeps` or close a view: `npx vitest run tests/host/city-view.test.ts tests/host/city-view-store-wiring.test.ts tests/host/city-view-scan-modes.test.ts tests/host/city-view-cancel.test.ts tests/host/lifecycle-leaks.test.ts tests/host/multi-leaf.test.ts tests/host/window-migration.test.ts tests/acceptance`.
  - Then, alone, `npx vitest run tests/host/clean-vault-install.test.ts`. It can time out on a loaded machine: re-run it alone before calling it a failure.
  - Check sizes: `wc -l src/host/city-view.ts` ≤ 360, and `wc -l tests/host/city-view-store-wiring.test.ts` is 450 (unchanged).
  - Gate: `npm run typecheck && npm run lint:fast && npx vitest run tests/unit/in-memory-evidence-store.test.ts tests/unit/evidence-store.test.ts tests/host/evidence-ports.test.ts tests/host/city-view-evidence.test.ts tests/host/commands.test.ts tests/host/plugin-onload.test.ts`.
  - Lint the touched files: `npx eslint src/application/ports/evidence-repository.ts src/adapters/storage/in-memory-evidence-store.ts src/ui/stores/evidence-store.ts src/host/data-ports.ts src/host/city-scan-controller.ts src/host/city-view.ts src/host/commands.ts src/main.ts src/ui/App.vue src/ui/audit-copy/fallow.ts tests/fixtures/evidence-report.ts tests/fixtures/data-port-deps.ts tests/unit/in-memory-evidence-store.test.ts tests/unit/evidence-store.test.ts tests/host/evidence-ports.test.ts tests/host/city-view-evidence.test.ts tests/host/commands.test.ts tests/host/plugin-onload.test.ts --max-warnings 0`.

- [ ] **Step 11: Commit.** Commit only this task's files (never the ledger):

```
feat(host): session evidence repository, per-leaf evidence store, and the import-analysis-report command (Y28, Y29, Y39)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 8: Evidence index and the read-model swap (Y33, Y34)

This task replaces the sample findings with the imported evidence, and has four parts.
- **The index.** A per-(files, report) evidence index resolves the attached report against the files on screen. Every findings count comes from it:
  - `collected` when the report matches this snapshot;
  - `stale` when it was imported against another snapshot;
  - `partial` for the total when only some categories were analysed (U-c, accepted);
  - `unknown` with `FALLOW_NOT_ANALYSED` when there is no report or the category was not analysed.
  - It is never a `0` that nothing measured.
- **What goes.** `sample-findings.ts`, the three sample `FileSummary` fields, and `usesSample` on the quality model are removed.
- **Overview.** The coverage row `static` becomes `fallow`, with its state taken from the index (R6).
- **The rest of R6.** Severities become the tool's own word or `'unrated'`, and the kit gets the four severity classes. The severity and title copy moves to `audit-copy/quality.ts`, `COPY_16` is defined, and the three per-row "Sample" provenance badges are removed (U-d, accepted).

Screens get only the edits the new types force. All other findings UX is Task 9's. The "Post-Task-8 file state" appendix at the end gives the exact text Task 9 edits against.

**Files:**
- Create: `src/ui/read-models/evidence-index.ts` (~120)
- Modify: `src/ui/read-models/findings.ts` (107 → ~135; whole-file replacement, given in the appendix)
- Modify: `src/ui/read-models/file-detail.ts` (75 → ~84)
- Modify: `src/ui/read-models/overview.ts` (136 → ~144)
- Modify: `src/ui/read-models/city-summary.ts` (19 → 23; whole-file replacement)
- Modify: `src/ui/read-models/file-summaries.ts` (122 → 116)
- Modify: `src/ui/read-models/use-read-models.ts` (155 → ~176)
- Modify: `src/ui/fixtures/sample-signals.ts` (43 → 39)
- Delete: `src/ui/fixtures/sample-findings.ts` (30 → 0)
- Modify: `src/ui/shell/NavColumn.vue` (117 → 118)
- Modify: `src/ui/shell/use-route-provenance.ts` (42 → 43)
- Modify (minimal, type-driven):
  - `src/ui/screens/quality/FindingsTable.vue` (117 → 115)
  - `src/ui/screens/quality/FindingReviewDialog.vue` (236 → 235)
  - `src/ui/screens/file/FileFindingsPanel.vue` (68 → 66)
  - `src/ui/screens/QualityScreen.vue` (159 → 159)
- Modify: `src/ui/styles/kit.css` (+2: the four severity classes replace `--high`, `--medium` and `--low`, R6)
- Modify copy:
  - `src/ui/audit-copy/quality.ts` (Task 4's text + ~14);
  - `src/ui/audit-copy/fallow.ts` (+13);
  - `src/ui/inspector-copy.ts` (−7: `FINDING_TITLE` and `SEVERITY_LABEL` move to `audit-copy/quality.ts`).
- Modify: `tests/fixtures/evidence-report.ts` (Task 7's ~22 → ~150; whole-file replacement, R5)
- Create: `tests/unit/evidence-index.test.ts` (~185)
- Create: `tests/unit/fallow-acceptance.test.ts` (~110)
- Modify, whole-file replacement:
  - `tests/unit/findings-model.test.ts` (81 → ~130);
  - `tests/unit/file-detail-model.test.ts` (64 → ~68);
  - `tests/component/nav-column.test.ts` (120 → ~113).
- Modify:
  - `tests/unit/css-class-scope.test.ts` (139 → 139);
  - `tests/component/quality-screen.test.ts` (321 → 325);
  - `tests/component/quality-dialog-status.test.ts` (43 → 45);
  - `tests/component/file-detail-screen.test.ts` (119 → 121);
  - `tests/component/shell-provenance.test.ts` (51 → 55);
  - `tests/unit/read-models.test.ts` (272 → 274);
  - `tests/unit/sample-signals.test.ts` (52 → 51);
  - `tests/unit/work-items-model.test.ts` (54 → 54).

None of these test files is near the 450 cap. The largest after this task is `quality-screen.test.ts`, at 325.

**Interfaces:**
- Consumes (R4, all in `src/application/evidence/`):
  - `EvidenceReport`, `EvidenceFinding`, `FindingCategory`, `FindingDetail` and `FINDING_CATEGORIES` (`model.ts`);
  - `resolveFindings(findings, snapshotPaths)` (`resolve-findings.ts`);
  - `buildEvidenceReport(input)` (`normalize-fallow.ts`);
  - `parseFallowReportText(text)` (`read-fallow-report.ts`);
  - the recorded fixture `tests/fixtures/fallow/combined-3.27.0.json` (Task 5);
  - `useEvidenceStore` and `InMemoryEvidenceStore` (Task 7).
- Produces, in `src/ui/read-models/evidence-index.ts`:
  - `type EvidenceIndexState = 'none' | 'current' | 'stale'`;
  - `interface FileEvidence { findings: MetricValue; high: MetricValue; unused: MetricValue }`;
  - `interface EvidenceIndex`: the outline's members plus `count(n: number, c: FindingCategory | null): MetricValue`;
  - `evidenceIndexFor(files, report | null, snapshotId): EvidenceIndex`.
- Produces, in `use-read-models`:
  - `evidence: ComputedRef<EvidenceIndex>`;
  - `overviewModelFor(snapshot, files, cycles, evidence)`, `fileDetailFor(snapshot, files, entityId, evidence)` and `qualityModelFor(files, evidence, dispositions)`, all memoised per evidence index (E53);
  - a report shows only when `evidenceStore.repositoryId === snapshot.repositoryId` (R7).
- Produces, in `findings.ts` (R6):
  - `FindingSeverity = 'critical' | 'high' | 'moderate' | 'unrated'` and `SEVERITY_RANK`;
  - `severityRank(s)`, ranking critical < high < moderate < unknown words < unrated;
  - `severityTone(s): FindingSeverity`, which maps anything unknown to `'unrated'`;
  - `titledFindings(file, evidence)`, `buildQualityModel(files, evidence, dispositions)`, `filterFindings` and `findingsCsv(rows, evidence)`;
  - `QualityModel.evidence`. `usesSample` is removed. `FindingKind` is gone (use `FindingCategory`).
- Produces, in `file-detail.ts`:
  - `FileFinding = { id; kind: FindingCategory; rule: string; severity: string; line; endLine; symbol; detail: FindingDetail; title; fingerprint }`;
  - `buildFileDetail(snapshot, files, entityId, evidence?)`.
- Changes to other builders:
  - `buildOverviewModel(snapshot, files, cycles?, evidence?)`, whose coverage row is `fallow` (state collected, stale or unknown, never sample);
  - `buildCitySummary(files, cycles?, evidence?)`.
  - A missing `evidence` defaults to the no-report index, so it reads Not analysed.
- Kit classes: `ci-severity--critical`, `--high`, `--moderate` and `--unrated`. `--medium` and `--low` are retired.
- Copy:
  - `audit-copy/quality.ts` gains `FINDING_TITLE` (moved, unchanged), `FINDING_SEVERITY_UNRATED`, `SEVERITY_LABEL` (moved, keys critical, high, moderate and unrated) and `SEVERITY_TEXT(s)`.
  - `audit-copy/fallow.ts` gains `FALLOW_NOT_ANALYSED`, `FALLOW_SOME_NOT_ANALYSED`, `FALLOW_PROVENANCE_DETAIL(version)`, `OVERVIEW_FINDINGS_CAPTION(high)`, `OVERVIEW_FALLOW_ROW`, `OVERVIEW_FALLOW_SOURCE(version)` and `COPY_16(absoluteDate)`.
- Test fixture `tests/fixtures/evidence-report.ts` (R5): `ALL_ANALYSED`, `SYNTHETIC_VERSION`, `emptyEvidenceReport`, `syntheticFallowJson`, `syntheticFindings`, `syntheticEvidenceReport`, `attachSyntheticReport` and `snapshotWithPaths`.

- [ ] **Step 1: The shared evidence fixture (full, R5).** Replace the whole of `tests/fixtures/evidence-report.ts` with:

```ts
// Part 6: THE shared EvidenceReport fixture (ruling R5). Tasks 9-12 use only this file.
// - `emptyEvidenceReport`: a report with no findings, for the store and wiring tests.
// - `syntheticFallowJson`: the text of a real-shaped fallow 3.27.0 report whose paths are
//   a snapshot's own file paths. It is clearly synthetic (`_meta.synthetic`).
// - `syntheticEvidenceReport`: that text run through the REAL parser and normaliser
//   (parseFallowReportText, then buildEvidenceReport), so every synthetic report passes
//   the real schema and gets real finding ids.
// - `snapshotWithPaths`: a snapshot with chosen paths, for the recorded fixtures.
import { classify } from '../../src/domain/classify';
import { makeEntityId } from '../../src/domain/entity-id';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import type { CodeEntity, CodebaseSnapshot } from '../../src/domain/model';
import type { EvidenceFinding, EvidenceReport, FindingCategory } from '../../src/application/evidence/model';
import { buildSnapshotFixture } from './snapshot-builder';

type Categories = Record<FindingCategory, 'analysed' | 'not-analysed'>;
export const ALL_ANALYSED: Readonly<Categories> = { complexity: 'analysed', duplication: 'analysed', 'unused-exports': 'analysed' };
export const SYNTHETIC_VERSION = '3.27.0';
const IMPORTED_AT = '2026-09-23T10:00:00.000Z';
const SEVERITIES = ['critical', 'high', 'moderate'] as const;

/** A well-formed report with no findings: the store and wiring tests only move it around. */
export function emptyEvidenceReport(snapshotId: string, fileName = 'fallow.json'): EvidenceReport {
  return {
    provider: 'fallow', providerVersion: SYNTHETIC_VERSION, reportKind: 'combined', schemaVersion: 12, fileName,
    importedAt: IMPORTED_AT, snapshotId, stripPrefix: null,
    normalized: { findings: [], categories: { ...ALL_ANALYSED }, notShown: [], rejectedPaths: [], warnings: [] },
  };
}

export interface SyntheticFallowOptions {
  /** `combined` (schema 12, all three sections) or `dead-code` (schema 9, unused exports only). */
  kind?: 'combined' | 'dead-code';
  /** Paths not in the snapshot; each gets one unused export named `orphan` (Y26). */
  unmatchedPaths?: readonly string[];
  /** The export name of the FIRST file's unused export (default `symbol0`), for the text-only tests. */
  symbol?: string;
  /** One `workspace_diagnostics` message, verbatim. */
  warning?: string;
}

interface UnusedRow { path: string; export_name: string; is_type_only: boolean; line: number; col: number }

/** For file i (in snapshot order):
 *  - an unused export `symbol<i>` on line 1 (an unused type on every fourth file, i % 4 === 3);
 *  - on every even file, a complexity finding `fn<i>` on line 2, cycling critical, high,
 *    moderate (files 0, 2 and 4 are critical, high and moderate);
 *  - on files 5k and 5k + 1, a clone group spanning lines 3-6 of both files.
 *  A `dead-code` report carries only the unused part. The counts per N files are: unused N,
 *  complexity ceil(N / 2), and duplication 2 for each group whose second file exists. */
export function syntheticFallowJson(snapshot: CodebaseSnapshot, options: SyntheticFallowOptions = {}): string {
  const paths = snapshot.entities.filter((e) => e.kind === 'file').map((e) => e.path);
  const rows: UnusedRow[] = paths.map((path, i) => ({
    path, export_name: i === 0 && options.symbol !== undefined ? options.symbol : `symbol${i}`, is_type_only: i % 4 === 3, line: 1, col: 7,
  }));
  const orphans: UnusedRow[] = (options.unmatchedPaths ?? []).map((path) => ({ path, export_name: 'orphan', is_type_only: false, line: 1, col: 7 }));
  const unusedExports = [...rows.filter((r) => !r.is_type_only), ...orphans];
  const unusedTypes = rows.filter((r) => r.is_type_only);
  const check = {
    summary: { total_issues: unusedExports.length + unusedTypes.length, unused_files: 0, unused_exports: unusedExports.length, unused_types: unusedTypes.length },
    unused_exports: unusedExports,
    unused_types: unusedTypes,
  };
  const common = {
    version: SYNTHETIC_VERSION,
    elapsed_ms: 12,
    workspace_diagnostics: options.warning === undefined ? [] : [{ path: paths[0] ?? 'package.json', kind: 'synthetic', message: options.warning }],
    _meta: { synthetic: true },
  };
  if (options.kind === 'dead-code') return JSON.stringify({ kind: 'dead-code', schema_version: 9, ...common, ...check });
  const health = {
    findings: paths.flatMap((path, i) => (i % 2 === 0 ? [{
      path, name: `fn${i}`, line: 2, col: 0, cyclomatic: 12, cognitive: 20 + (i % 10), line_count: 8,
      exceeded: 'cognitive_crap', severity: SEVERITIES[(i / 2) % 3]!,
    }] : [])),
    summary: { max_cyclomatic_threshold: 20, max_cognitive_threshold: 15 },
  };
  const dupes = {
    clone_groups: paths.flatMap((path, i) => (i % 5 === 0 ? [{
      fingerprint: `synthetic-${i}`, token_count: 60, line_count: 4,
      instances: [path, paths[i + 1]].filter((p): p is string => p !== undefined).map((file) => ({ file, start_line: 3, end_line: 6 })),
    }] : [])),
  };
  return JSON.stringify({ kind: 'combined', schema_version: 12, ...common, check, dupes, health });
}

export interface SyntheticReportOptions extends SyntheticFallowOptions {
  /** Defaults to the snapshot's own id (current evidence). Any other id makes it stale (Y30). */
  snapshotId?: string;
}

/** The synthetic JSON through the real parser and normaliser. Throws if the schema refuses it. */
export function syntheticEvidenceReport(snapshot: CodebaseSnapshot, options: SyntheticReportOptions = {}): EvidenceReport {
  const parsed = parseFallowReportText(syntheticFallowJson(snapshot, options));
  if (!parsed.ok) throw new Error(`test setup: the synthetic fallow report was refused (${parsed.code} ${parsed.detail})`);
  return buildEvidenceReport({
    raw: parsed.report, fileName: 'synthetic-fallow.json', importedAt: IMPORTED_AT,
    snapshotId: options.snapshotId ?? snapshot.snapshotId, stripPrefix: null,
  });
}

/** The synthetic report's normalised findings, limited to the analysed categories. */
export function syntheticFindings(snapshot: CodebaseSnapshot, categories: Readonly<Categories> = ALL_ANALYSED): readonly EvidenceFinding[] {
  return syntheticEvidenceReport(snapshot).normalized.findings.filter((f) => categories[f.category] === 'analysed');
}

/** Binds the active leaf's evidence store to the snapshot's codebase and attaches a
 *  synthetic report, as App's repository watcher and the S14 dialog do in the plugin. */
export function attachSyntheticReport(snapshot: CodebaseSnapshot, options: SyntheticReportOptions = {}): EvidenceReport {
  const report = syntheticEvidenceReport(snapshot, options);
  const store = useEvidenceStore();
  store.setRepository(new InMemoryEvidenceStore());
  store.bindRepository(snapshot.repositoryId);
  if (!store.attach(report)) throw new Error('test setup: the evidence store refused the report');
  return report;
}

/** A snapshot whose files are exactly `paths`, so a recorded report's own paths resolve. */
export function snapshotWithPaths(paths: readonly string[], repositoryId = 'repo-fallow'): CodebaseSnapshot {
  const base = buildSnapshotFixture({ files: 0, repositoryId });
  const root = base.entities[0]!;
  const files: CodeEntity[] = paths.map((path) => ({
    id: makeEntityId(repositoryId, 'file', path), repositoryId, kind: 'file', path,
    name: path.slice(path.lastIndexOf('/') + 1), parentId: root.id, category: classify(path),
  }));
  return { ...base, entities: [...base.entities, ...files] };
}
```

  Finding ids are the real hashed ids (`CX-`, `DU-` or `UN-` plus eight hex digits, Y24). Tests never spell them: they read them from the report.

- [ ] **Step 2: Write the new tests.**

Create `tests/unit/evidence-index.test.ts`:

```ts
// Part 6 Y30/Y33/Y34: the evidence index, which every findings count reads.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computeLayout } from '../../src/domain/layout/layout';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildOverviewModel } from '../../src/ui/read-models/overview';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { COPY_16, FALLOW_NOT_ANALYSED, FALLOW_SOME_NOT_ANALYSED, NO_FILES_REASON } from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, syntheticEvidenceReport } from '../fixtures/evidence-report';

const snap = buildSnapshotFixture({ files: 20, directories: 2 });
const files = fileSummariesFor(snap);
const report = syntheticEvidenceReport(snap);
const FALLOW = { source: 'fallow', detail: 'imported report 3.27.0' };
const at = (i: number) => files[i]!;

describe('evidence index without a report (Y33)', () => {
  it('is state none, and every count is unknown with FALLOW_NOT_ANALYSED, never 0', () => {
    const index = evidenceIndexFor(files, null, snap.snapshotId);
    expect(index.state).toBe('none');
    expect(index.report).toBeNull();
    const values = [index.totals.findings, index.totals.high, index.totals.unused, ...Object.values(index.perFile(at(0).id))];
    expect(values).toHaveLength(6);
    for (const v of values) {
      expect(v).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
      expect(v.value).toBeUndefined();
    }
    expect([index.byFile.size, index.matchedFindings, index.matchedFiles, index.unmatchedPaths.length]).toEqual([0, 0, 0, 0]);
    expect(index.category('complexity')).toBe('not-analysed');
  });
});

describe('evidence index with a current report (Y34)', () => {
  const index = evidenceIndexFor(files, report, snap.snapshotId);
  const all = report.normalized.findings;

  it('counts every resolved finding as collected fallow evidence', () => {
    expect(index.state).toBe('current');
    expect(index.report).toBe(report);
    expect(all.length).toBeGreaterThan(0);
    expect(index.totals.findings).toEqual({ state: 'collected', value: all.length, provenance: FALLOW });
    expect(index.totals.unused).toEqual({ state: 'collected', value: all.filter((f) => f.category === 'unused-exports').length, provenance: FALLOW });
    expect([index.matchedFindings, index.matchedFiles, index.unmatchedPaths.length]).toEqual([all.length, files.length, 0]);
    expect(index.category('duplication')).toBe('analysed');
  });

  it('groups the findings per file, in report order', () => {
    const own = all.filter((f) => f.path === at(4).path);
    expect(own.length).toBeGreaterThan(1);
    expect(index.byFile.get(at(4).id)).toEqual(own);
    expect(index.perFile(at(4).id).findings).toEqual({ state: 'collected', value: own.length, provenance: FALLOW });
  });

  it('`high` counts the critical and high severities only (files 0, 2 and 4 are critical, high and moderate)', () => {
    expect([0, 2, 4, 1].map((i) => index.perFile(at(i).id).high.value)).toEqual([1, 1, 0, 0]);
    expect(index.totals.high.value).toBe(all.filter((f) => f.severity === 'critical' || f.severity === 'high').length);
  });

  it('a file the report covers but found nothing in is a reported, collected 0', () => {
    const fewer = syntheticEvidenceReport(buildSnapshotFixture({ files: 10, directories: 2 }));
    const partial = evidenceIndexFor(files, fewer, snap.snapshotId);
    expect(partial.state).toBe('current');
    expect(partial.perFile(at(15).id).findings).toEqual({ state: 'collected', value: 0, provenance: FALLOW });
  });

  it('drops a finding whose path is not in the snapshot and lists the path as unmatched (Y26)', () => {
    const withGone = evidenceIndexFor(files, syntheticEvidenceReport(snap, { unmatchedPaths: ['lib/gone.ts'] }), snap.snapshotId);
    expect(withGone.unmatchedPaths).toEqual(['lib/gone.ts']);
    expect(withGone.matchedFindings).toBe(all.length);
    expect([...withGone.byFile.values()].flat().some((f) => f.path === 'lib/gone.ts')).toBe(false);
  });

  it('a category the report did not analyse is unknown, and the total says it is partial (a dead-code report)', () => {
    const deadCode = syntheticEvidenceReport(snap, { kind: 'dead-code' });
    const dc = evidenceIndexFor(files, deadCode, snap.snapshotId);
    expect(dc.category('complexity')).toBe('not-analysed');
    expect(dc.totals.high).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
    expect(dc.totals.unused.state).toBe('collected');
    expect(dc.totals.findings).toMatchObject({ state: 'partial', value: deadCode.normalized.findings.length, reason: FALLOW_SOME_NOT_ANALYSED });
  });

  it('with no files every total is unknown with its reason, never 0', () => {
    const empty = buildSnapshotFixture({ files: 0 });
    const none = evidenceIndexFor(fileSummariesFor(empty), syntheticEvidenceReport(empty), empty.snapshotId);
    const totals = Object.values(none.totals);
    expect(totals).toHaveLength(3);
    for (const v of totals) expect(v).toMatchObject({ state: 'unknown', reason: NO_FILES_REASON });
  });
});

describe('stale evidence (Y30)', () => {
  it('re-resolves a report imported against another snapshot; every value is stale, and so is the Overview row', () => {
    const newer = { ...buildSnapshotFixture({ files: 12, directories: 2 }), snapshotId: 'snapshot-newer' };
    const newerFiles = fileSummariesFor(newer);
    const index = evidenceIndexFor(newerFiles, report, newer.snapshotId);
    expect(index.state).toBe('stale');
    expect(index.matchedFiles).toBe(12);
    expect(index.unmatchedPaths).toHaveLength(8);
    expect(index.totals.findings).toMatchObject({ state: 'stale', value: index.matchedFindings, provenance: FALLOW });
    expect(buildOverviewModel(newer, newerFiles, undefined, index).coverage.find((r) => r.id === 'fallow')?.state).toBe('stale');
  });

  it('COPY_16 says which date the evidence is from', () => {
    expect(COPY_16('Sep 23, 2026')).toBe('Showing evidence from Sep 23, 2026. It is not current for this snapshot.');
  });
});

describe('evidence index memo (Y30, E53)', () => {
  it('is one index per (files, report), rebuilt for another report or another snapshot', () => {
    const first = evidenceIndexFor(files, report, snap.snapshotId);
    expect(evidenceIndexFor(files, report, snap.snapshotId)).toBe(first);
    expect(evidenceIndexFor(files, syntheticEvidenceReport(snap), snap.snapshotId)).not.toBe(first);
    expect(evidenceIndexFor(files, null, snap.snapshotId)).toBe(evidenceIndexFor(files, null, snap.snapshotId));
    const other = buildSnapshotFixture({ files: 20, directories: 2 });
    expect(evidenceIndexFor(fileSummariesFor(other), report, other.snapshotId)).not.toBe(first);
  });
});

describe('evidence through useReadModels (E53, R7)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('each leaf reads its own bound evidence, even on the same snapshot; the Overview fallow row follows it', () => {
    const layout = computeLayout(snap);
    const leafA = createPinia();
    const leafB = createPinia();
    setActivePinia(leafA);
    useCityStore().setCity(snap, layout);
    attachSyntheticReport(snap);
    const a = useReadModels();
    setActivePinia(leafB);
    useCityStore().setCity(snap, layout);
    const b = useReadModels();
    expect(a.evidence.value.state).toBe('current');
    expect(a.quality.value.findings.length).toBeGreaterThan(0);
    expect(a.overview.value!.coverage.find((r) => r.id === 'fallow')?.state).toBe('collected');
    expect(b.evidence.value.state).toBe('none');
    expect(b.quality.value.findings).toEqual([]);
    expect(b.overview.value!.coverage.find((r) => r.id === 'fallow')?.state).toBe('unknown');
  });

  it('never shows a report bound to another codebase', () => {
    useCityStore().setCity(snap, computeLayout(snap));
    const evidence = useEvidenceStore();
    evidence.setRepository(new InMemoryEvidenceStore());
    evidence.bindRepository('repo-other');
    expect(evidence.attach(report)).toBe(true);
    expect(useReadModels().evidence.value.state).toBe('none');
  });
});
```

Create `tests/unit/fallow-acceptance.test.ts`:

```ts
// Part 6 acceptance evidence for the Fallow Ingestion deliverable (spec §5):
// (1) a known fixture finding lands on the right file and line in the quality model
//     (the lens set is Task 11's);
// (6) with no report every structural screen still works, and nothing reads 0.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computeLayout } from '../../src/domain/layout/layout';
import { makeEntityId } from '../../src/domain/entity-id';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildQualityModel } from '../../src/ui/read-models/findings';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { useCityStore } from '../../src/ui/stores/city-store';
import { FALLOW_NOT_ANALYSED } from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { snapshotWithPaths } from '../fixtures/evidence-report';

const FIXTURE = resolve(process.cwd(), 'tests', 'fixtures', 'fallow', 'combined-3.27.0.json');
const NOW = '2026-09-23T10:00:00.000Z';
type Raw = Parameters<typeof buildEvidenceReport>[0]['raw'];
/** Only the recorded fields this test reads, straight from the JSON (not through our schema). */
interface Recorded {
  check: { unused_exports: { path: string; export_name: string; line: number }[] };
  health: { findings: { path: string; name: string; line: number; severity: string }[] };
}

const reportFor = (raw: Raw, snapshotId: string) =>
  buildEvidenceReport({ raw, fileName: 'combined-3.27.0.json', importedAt: NOW, snapshotId, stripPrefix: null });

describe('acceptance (1): a known fixture finding lands on its own file and line', () => {
  const text = readFileSync(FIXTURE, 'utf8');
  const recorded = JSON.parse(text) as Recorded;
  const parsed = parseFallowReportText(text);
  if (!parsed.ok) throw new Error(`the recorded fixture no longer parses: ${parsed.code} ${parsed.detail}`);
  // A snapshot holding exactly the paths the report names, as a scan of the fixture project would.
  const paths = [...new Set(reportFor(parsed.report, 'probe').normalized.findings.map((f) => f.path))];
  const snap = snapshotWithPaths(paths);
  const files = fileSummariesFor(snap);
  const quality = buildQualityModel(files, evidenceIndexFor(files, reportFor(parsed.report, snap.snapshotId), snap.snapshotId), []);

  it('the recorded unused export: its file, line and symbol, and no severity of our own', () => {
    const known = recorded.check.unused_exports[0]!;
    const hit = quality.findings.find((f) => f.file.path === known.path && f.symbol === known.export_name);
    expect(hit).toMatchObject({ kind: 'unused-exports', rule: 'unused-export', line: known.line, severity: 'unrated' });
    expect(hit!.fingerprint).toBe(`${makeEntityId(snap.repositoryId, 'file', known.path)}#${hit!.id}`);
  });

  it('the recorded complexity finding: its file, line, function and the tool\'s own severity', () => {
    const known = recorded.health.findings[0]!;
    const hit = quality.findings.find((f) => f.file.path === known.path && f.symbol === known.name);
    expect(hit).toMatchObject({ kind: 'complexity', rule: 'complexity', line: known.line, severity: known.severity });
  });
});

describe('acceptance (6): with no report every structural screen works and nothing reads 0', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  function withSnapshot() {
    const snap = buildSnapshotFixture({ files: 30, directories: 3 });
    const store = useCityStore();
    store.setCity(snap, computeLayout(snap));
    store.select(fileSummariesFor(snap)[0]!.id);
    return useReadModels();
  }

  it('Overview, Code quality, the city summary and File detail read unknown, with the reason', () => {
    const m = withSnapshot();
    expect(m.evidence.value.state).toBe('none');
    const values = [
      m.overview.value!.cards.find((c) => c.id === 'findings')!.value,
      ...m.quality.value.cards.map((c) => c.value),
      m.citySummary.value.find((c) => c.id === 'unused')!.value,
      m.fileDetail.value!.findingsCount,
    ];
    expect(values).toHaveLength(7);
    for (const v of values) {
      expect(v).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
      expect(v.value).toBeUndefined();
    }
    expect(m.quality.value.findings).toEqual([]);
    expect(m.fileDetail.value!.findings).toEqual([]);
    const rows = m.overview.value!.coverage;
    expect(rows.find((r) => r.id === 'fallow')?.state).toBe('unknown');
    expect(rows.some((r) => r.id === 'static')).toBe(false);
  });

  it('everything that does not come from fallow still reads: files, bytes, hotspots and coverage', () => {
    const m = withSnapshot();
    expect(m.overview.value!.fileCount).toBe(30);
    expect(m.overview.value!.cards.find((c) => c.id === 'coverage')!.value.value).toBeDefined();
    expect(m.citySummary.value.find((c) => c.id === 'hotspots')!.value.value).toBeDefined();
    expect(m.fileDetail.value!.bytes.state).toBe('collected');
  });
});
```

- [ ] **Step 3: Rewrite and update the existing tests.**

Replace the whole of `tests/unit/findings-model.test.ts` with:

```ts
// Part 3 Q1-Q3, Part 6 Y33-Y35 (ruling R6): the Code quality model over imported evidence.
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { syntheticEvidenceReport } from '../fixtures/evidence-report';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildFileDetail } from '../../src/ui/read-models/file-detail';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import {
  buildQualityModel, DEFAULT_QUALITY_FILTER, filterFindings, findingsCsv, severityRank, severityTone,
  type QualityModel,
} from '../../src/ui/read-models/findings';
import type { FindingDisposition } from '../../src/ui/stores/ports/review-repository';
import { FALLOW_NOT_ANALYSED, NO_FILES_REASON } from '../../src/ui/inspector-copy';

const snap = buildSnapshotFixture({ files: 60, directories: 2 });
const files = fileSummariesFor(snap);
const report = syntheticEvidenceReport(snap);
const evidence = evidenceIndexFor(files, report, snap.snapshotId);
const NOW = '2026-09-21T10:00:00.000Z';
const model = (dispositions: readonly FindingDisposition[] = []) => buildQualityModel(files, evidence, dispositions);
const card = (m: QualityModel, id: string) => m.cards.find((c) => c.id === id)!.value;

describe('code quality model (Part 3 Q1-Q3, Part 6 Y34)', () => {
  it('lists every imported finding that resolved to a file, all open', () => {
    const m = model();
    expect(m.findings.length).toBeGreaterThan(0);
    expect(m.findings).toHaveLength(report.normalized.findings.length);
    expect(m.findings.every((f) => f.status === 'open')).toBe(true);
    expect(m.evidence).toBe(evidence);
  });

  it('fingerprints are unique and name the file (Q2)', () => {
    const m = model();
    expect(new Set(m.findings.map((f) => f.fingerprint)).size).toBe(m.findings.length);
    expect(m.findings[0]!.fingerprint).toBe(`${m.findings[0]!.file.id}#${m.findings[0]!.id}`);
  });

  it('File detail and Code quality agree on a finding fingerprint', () => {
    const file = files[3]!;
    const detail = buildFileDetail(snap, files, file.id, evidence)!;
    expect(detail.findings.length).toBeGreaterThan(0);
    expect(model().byFingerprint.get(detail.findings[0]!.fingerprint)?.file.id).toBe(file.id);
  });

  it('applies dispositions by fingerprint and keeps the reason', () => {
    const [a, b] = model().findings;
    const m = model([
      { fingerprint: a!.fingerprint, status: 'acknowledged', decidedAt: NOW },
      { fingerprint: b!.fingerprint, status: 'dismissed', reason: 'intended API', decidedAt: NOW },
      { fingerprint: 'gone#X', status: 'dismissed', reason: 'stale', decidedAt: NOW },
    ]);
    expect(m.byFingerprint.get(a!.fingerprint)?.status).toBe('acknowledged');
    expect(m.byFingerprint.get(b!.fingerprint)?.reason).toBe('intended API');
    expect(card(m, 'open').value).toBe((card(model(), 'open').value ?? 0) - 2);
  });

  it('filters by status (default open), kind, severity, module and text', () => {
    const [a] = model().findings;
    const m = model([{ fingerprint: a!.fingerprint, status: 'acknowledged', decidedAt: NOW }]);
    expect(filterFindings(m.findings, DEFAULT_QUALITY_FILTER)).not.toContain(m.byFingerprint.get(a!.fingerprint));
    expect(filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'acknowledged' })).toHaveLength(1);
    const cx = filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', kind: 'complexity' });
    expect(cx.length).toBeGreaterThan(0);
    expect(cx.every((f) => f.kind === 'complexity' && f.severity !== 'unrated')).toBe(true);
    const unrated = filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', severity: 'unrated' });
    expect(unrated.length).toBeGreaterThan(0);
    expect(unrated.every((f) => f.kind !== 'complexity')).toBe(true);
    // Y35: the unused-exports kind covers both of its rules.
    const unused = filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', kind: 'unused-exports' });
    expect(new Set(unused.map((f) => f.rule))).toEqual(new Set(['unused-export', 'unused-type']));
    const mod = filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', module: 'dir-1' });
    expect(mod.length).toBeGreaterThan(0);
    expect(mod.every((f) => f.file.module === 'dir-1')).toBe(true);
    // The symbol is searchable: only file 7's unused type is named symbol7 (60 files: no symbol70-79).
    expect(filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', query: 'symbol7' })).toHaveLength(1);
    expect(filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', query: 'no-such' })).toHaveLength(0);
  });

  it('cards count the open findings per category as collected fallow evidence', () => {
    const m = model();
    expect(card(m, 'open')).toMatchObject({ state: 'collected', value: m.findings.length, provenance: { source: 'fallow', detail: 'imported report 3.27.0' } });
    expect(card(m, 'unused-exports').value).toBe(m.findings.filter((f) => f.kind === 'unused-exports').length);
    expect(card(m, 'duplication').value).toBe(m.findings.filter((f) => f.kind === 'duplication').length);
  });

  it('with no report there are no findings, and every card is unknown with FALLOW_NOT_ANALYSED, never 0', () => {
    const m = buildQualityModel(files, evidenceIndexFor(files, null, snap.snapshotId), []);
    expect(m.findings).toEqual([]);
    expect(m.cards).toHaveLength(4);
    for (const c of m.cards) expect(c.value).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
  });

  it('with no files, every card is unknown with its reason, never 0', () => {
    const m = buildQualityModel([], evidenceIndexFor([], null, ''), []);
    expect(m.cards).toHaveLength(4);
    for (const c of m.cards) expect(c.value).toMatchObject({ state: 'unknown', reason: NO_FILES_REASON });
  });

  it('a category the report did not analyse reads unknown; the others still count (Y25, a dead-code report)', () => {
    const deadCode = syntheticEvidenceReport(snap, { kind: 'dead-code' });
    const m = buildQualityModel(files, evidenceIndexFor(files, deadCode, snap.snapshotId), []);
    expect(card(m, 'complexity')).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
    expect(card(m, 'duplication').state).toBe('unknown');
    expect(card(m, 'unused-exports').state).toBe('collected');
    expect(card(m, 'open').state).toBe('partial');
  });

  it('stale evidence is still listed, with every count stale (Y30)', () => {
    const stale = evidenceIndexFor(files, syntheticEvidenceReport(snap, { snapshotId: 'an-older-snapshot' }), snap.snapshotId);
    const m = buildQualityModel(files, stale, []);
    expect(m.findings).toHaveLength(report.normalized.findings.length);
    const values = m.cards.map((c) => c.value);
    expect(values).toHaveLength(4);
    expect(values.every((v) => v.state === 'stale')).toBe(true);
  });

  it('ranks critical, high, moderate, an unknown word, then unrated; the tone of anything unknown is unrated (R6)', () => {
    const words = ['unrated', 'moderate', 'extreme', 'high', 'critical'];
    expect([...words].sort((x, y) => severityRank(x) - severityRank(y))).toEqual(['critical', 'high', 'moderate', 'extreme', 'unrated']);
    expect(severityRank('constructor')).toBe(severityRank('extreme'));
    expect(['critical', 'high', 'moderate', 'unrated', '<img src=x>', 'toString'].map((s) => severityTone(s)))
      .toEqual(['critical', 'high', 'moderate', 'unrated', 'unrated', 'unrated']);
  });

  it('exports the rule, status, reason and fallow provenance; an unknown line is an empty cell with its state', () => {
    const f = model().findings[0]!;
    const bom = String.fromCharCode(0xFEFF);
    const [header, row] = findingsCsv([{ ...f, status: 'dismissed', reason: '=cmd' }], evidence).replace(bom, '').split('\r\n');
    expect(header).toBe('id,path,module,kind,rule,severity,line,line_state,status,reason,provenance');
    expect(row).toContain(",reported,dismissed,'=cmd,fallow 3.27.0 imported");
    expect(findingsCsv([{ ...f, line: null }], evidence).split('\r\n')[1]).toContain(',,unknown,');
    const stale = evidenceIndexFor(files, syntheticEvidenceReport(snap, { snapshotId: 'an-older-snapshot' }), snap.snapshotId);
    expect(findingsCsv([f], stale)).toContain('fallow 3.27.0 stale');
  });
});
```

Replace the whole of `tests/unit/file-detail-model.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { syntheticEvidenceReport } from '../fixtures/evidence-report';
import { fileSummariesFor, type FileSummary } from '../../src/ui/read-models/file-summaries';
import { buildFileDetail } from '../../src/ui/read-models/file-detail';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { unknown } from '../../src/ui/evidence';
import { FALLOW_NOT_ANALYSED, FINDING_TITLE } from '../../src/ui/inspector-copy';

const snap = buildSnapshotFixture({ files: 12, directories: 2, unavailable: 1 });
const files = fileSummariesFor(snap);

describe('file detail model', () => {
  it('is null without a selection, for an unknown id, and for a directory', () => {
    expect(buildFileDetail(snap, files, null)).toBeNull();
    expect(buildFileDetail(snap, files, 'nope')).toBeNull();
    const dir = snap.entities.find((e) => e.kind === 'directory')!;
    expect(buildFileDetail(snap, files, dir.id)).toBeNull();
  });
  it('has four sample cards, collected bytes and the entity category', () => {
    const f = files[3]!;
    const d = buildFileDetail(snap, files, f.id)!;
    expect(d.cards.map((c) => [c.id, c.value.state])).toEqual([['complexity', 'sample'], ['coverage', 'sample'], ['dependents', 'sample'], ['priority', 'sample']]);
    expect(d.bytes.state).toBe('collected');
    expect(d.category).toBe(snap.entities.find((e) => e.id === f.id)?.category);
    expect(d.moduleLabel).toBe(f.module);
    expect(d.usesSample).toBe(true);
  });
  it('ends each history series at the current value', () => {
    const f = files[3]!;
    const d = buildFileDetail(snap, files, f.id)!;
    expect(d.history.find((s) => s.id === 'complexity')?.points.at(-1)?.value).toBe(f.complexity.value);
    expect(d.history.find((s) => s.id === 'coverage')?.points.at(-1)?.value).toBe(f.branchCoverage.value);
  });
  it('omits a history series whose value is unknown', () => {
    const f: FileSummary = { ...files[3]!, branchCoverage: unknown('no report') };
    const d = buildFileDetail(snap, files.map((x) => (x.id === f.id ? f : x)), f.id)!;
    expect(d.history.map((s) => s.id)).toEqual(['complexity']);
  });
});

describe('file detail findings (Part 6 Y34)', () => {
  it('without a report the count is unknown with its reason and the list is empty, never 0', () => {
    const d = buildFileDetail(snap, files, files[0]!.id)!;
    expect(d.findingsCount).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
    expect(d.findingsCount.value).toBeUndefined();
    expect(d.findings).toEqual([]);
  });
  it('lists the file\'s imported findings with their title and fingerprint, and counts them as collected', () => {
    const report = syntheticEvidenceReport(snap);
    const file = files[0]!;
    const d = buildFileDetail(snap, files, file.id, evidenceIndexFor(files, report, snap.snapshotId))!;
    const own = report.normalized.findings.filter((f) => f.path === file.path);
    expect(own.length).toBeGreaterThan(0);
    expect(d.findings.map((f) => f.id)).toEqual(own.map((f) => f.id));
    expect(d.findingsCount).toMatchObject({ state: 'collected', value: own.length, provenance: { source: 'fallow' } });
    expect(d.findings[0]).toMatchObject({ fingerprint: `${file.id}#${own[0]!.id}`, title: FINDING_TITLE[own[0]!.category] });
  });
  it('keeps the tool\'s own severity, and reads "unrated" where the tool gives none (Y35)', () => {
    const evidence = evidenceIndexFor(files, syntheticEvidenceReport(snap), snap.snapshotId);
    const d = buildFileDetail(snap, files, files[0]!.id, evidence)!;
    expect(d.findings.map((f) => [f.kind, f.severity])).toEqual([['complexity', 'critical'], ['duplication', 'unrated'], ['unused-exports', 'unrated']]);
  });
});
```

(The order in the last test is `normalizeFallow`'s: complexity, then duplication, then unused.)

Replace the whole of `tests/component/nav-column.test.ts` with:

```ts
// Final whole-branch review, items 2 and 4: NavColumn's badges and its Escape handling.
// Part 6 Y34: the Code quality badge is the imported fallow findings total. It shows only
// while that total is collected (a current report), never for stale or absent evidence.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import NavColumn from '../../src/ui/shell/NavColumn.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport } from '../fixtures/evidence-report';
import type { CodebaseSnapshot } from '../../src/domain/model';

function withSnapshot(): CodebaseSnapshot {
  const snap = buildSnapshotFixture({ files: 30, directories: 3 });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
}

function mountNav(drawer: boolean) {
  return mount(NavColumn, {
    props: { drawer, workspaceLabel: 'repo' },
    global: { provide: { onSelectCodebase: vi.fn() } },
    attachTo: document.body,
  });
}

function badgeFor(w: ReturnType<typeof mountNav>, title: string): string | null {
  const item = w.findAll('.ci-nav__item').find((b) => b.text().includes(title));
  expect(item, `no nav item "${title}"`).toBeDefined();
  const badge = item!.find('.ci-nav__badge');
  return badge.exists() ? badge.text() : null;
}

describe('NavColumn badges', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('shows no Code quality badge without an imported report', () => {
    withSnapshot();
    const w = mountNav(false);
    expect(badgeFor(w, 'Code quality')).toBeNull();
    w.unmount();
  });

  it('shows the findings total as the Code quality badge while the report is current (Part 6 Y34)', () => {
    const report = attachSyntheticReport(withSnapshot());
    const w = mountNav(false);
    expect(badgeFor(w, 'Code quality')).toBe(String(report.normalized.findings.length));
    w.unmount();
  });

  it('shows no Code quality badge for stale evidence (Y30)', () => {
    attachSyntheticReport(withSnapshot(), { snapshotId: 'an-older-snapshot' });
    const w = mountNav(false);
    expect(badgeFor(w, 'Code quality')).toBeNull();
    w.unmount();
  });

  it('keeps the workbench badge, which counts real in-memory work items', async () => {
    withSnapshot();
    const w = mountNav(false);
    expect(badgeFor(w, 'Refactor workbench')).toBeNull();
    await useReviewStore().addWorkItemForFile('r\0file\0a.ts', 'Investigate a.ts', new Date(0));
    await flushPromises();
    expect(badgeFor(w, 'Refactor workbench')).toBe('1');
    w.unmount();
  });

  it('counts only open work items, so a verified item drops out of the badge', async () => {
    withSnapshot();
    const w = mountNav(false);
    const review = useReviewStore();
    await review.addWorkItemForFile('r\0file\0a.ts', 'Investigate a.ts', new Date(0));
    const second = await review.addWorkItemForFile('r\0file\0b.ts', 'Investigate b.ts', new Date(0));
    await review.updateWorkItem(second!.id, { status: 'verified', checks: [true, true, true] }, new Date(0));
    await flushPromises();
    expect(badgeFor(w, 'Refactor workbench')).toBe('1');
    w.unmount();
  });
});

function pressEscape(w: ReturnType<typeof mountNav>): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  w.find('.ci-nav__item').element.dispatchEvent(event);
  return event;
}

describe('NavColumn Escape', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('closes the drawer and claims the press', () => {
    const w = mountNav(true);
    const event = pressEscape(w);
    expect(event.defaultPrevented).toBe(true);
    expect(w.emitted('close')).toHaveLength(1);
    w.unmount();
  });

  it('leaves Escape unclaimed in the inline nav, so the city escape chain still sees it', () => {
    const w = mountNav(false);
    let reachedDocument = false;
    const listener = (): void => { reachedDocument = true; };
    document.addEventListener('keydown', listener);
    const event = pressEscape(w);
    document.removeEventListener('keydown', listener);
    expect(event.defaultPrevented).toBe(false);
    expect(reachedDocument).toBe(true);
    expect(w.emitted('close')).toBeUndefined();
    w.unmount();
  });
});
```

The workbench tests keep the `'r\0file\0a.ts'` escape literals exactly as the current file has them. They are escape sequences, not raw NUL bytes. If the E7/E39 check flags them, switch to `makeEntityId('repo-fixture', 'file', 'a.ts')` and report it. Note that this whole-file replacement also carries any Task 2/4 edit to the two workbench tests. Diff against the file as it stands before this task, and keep those edits.

`tests/unit/css-class-scope.test.ts` (R6):
- Replace `  'ci-finding__', 'ci-scatter__legend', 'ci-scatter__key',` with `  'ci-finding__', 'ci-scatter__legend', 'ci-scatter__key', 'ci-severity--medium', 'ci-severity--low',`.
- Replace `const RETIRED_SELECTORS = ['.ci-finding__', '.ci-finding {', '.ci-scatter__legend', '.ci-scatter__key'];` with `const RETIRED_SELECTORS = ['.ci-finding__', '.ci-finding {', '.ci-scatter__legend', '.ci-scatter__key', '.ci-severity--medium', '.ci-severity--low'];`.
- Replace `      '.ci-screen ', '.ci-severity ', '.ci-severity--high', '.ci-severity--medium', '.ci-severity--low', '.ci-ref-id',` with `      '.ci-screen ', '.ci-severity ', '.ci-severity--critical', '.ci-severity--high', '.ci-severity--moderate', '.ci-severity--unrated', '.ci-ref-id',`.

`tests/component/quality-screen.test.ts`:
- (a) After `import { buildSnapshotFixture } from '../fixtures/snapshot-builder';`, add `import { attachSyntheticReport } from '../fixtures/evidence-report';`.
- (b) Replace:

```ts
function withSnapshot(files = 60, directories = 3) {
  const snap = buildSnapshotFixture({ files, directories });
  useCityStore().setCity(snap, computeLayout(snap));
}
```

  with:

```ts
/** Part 6 Y34: findings come from an imported report; this attaches a synthetic one. */
function withSnapshot(files = 60, directories = 3) {
  const snap = buildSnapshotFixture({ files, directories });
  useCityStore().setCity(snap, computeLayout(snap));
  attachSyntheticReport(snap);
  return snap;
}
```

- (c) Replace `  it('shows four sample cards and the open findings, 100 at a time', async () => {` with `  it('shows four cards and the open findings, 100 at a time', async () => {`.
- (d) Replace `    // Finding ids repeat across files (CX-<module>-<n>); the id plus the file names the row.` with `    // The finding id plus the file names the row.`.
- (e) Replace:

```ts
    const snap = buildSnapshotFixture({ files: 60, directories: 3 });
    useCityStore().setCity(snap, computeLayout(snap));
    const w = mountQ();
```

  with:

```ts
    const snap = withSnapshot();
    const w = mountQ();
```

  In that test the `repo-other` snapshot has no report bound. `use-read-models` shows no findings for it (R7), so the review closes. Switching back must not reopen it.
- (f) Replace:

```ts
    expect(text).toContain('id,path,module,kind,severity,line,line_state,status,reason,provenance');
```

  with:

```ts
    expect(text).toContain('id,path,module,kind,rule,severity,line,line_state,status,reason,provenance');
    expect(text).toContain('fallow 3.27.0 imported');
```

  Counts with the synthetic report: 60 files give 114 findings (60 unused, 30 complexity, 24 duplication), and 400 files give 760. The paging tests (100, then 200 rows) still hold.

`tests/component/quality-dialog-status.test.ts`:
- After `import { buildSnapshotFixture } from '../fixtures/snapshot-builder';`, add `import { attachSyntheticReport } from '../fixtures/evidence-report';`.
- Replace:

```ts
    useCityStore().setCity(snap, computeLayout(snap));
    const review = useReviewStore();
```

  with:

```ts
    useCityStore().setCity(snap, computeLayout(snap));
    attachSyntheticReport(snap);
    const review = useReviewStore();
```

`tests/component/file-detail-screen.test.ts`:
- After `import { buildSnapshotFixture } from '../fixtures/snapshot-builder';`, add `import { attachSyntheticReport } from '../fixtures/evidence-report';`.
- Replace:

```ts
    store.setCity(snap, computeLayout(snap));
    const finding = useReadModels().quality.value.findings[0]!;
```

  with:

```ts
    store.setCity(snap, computeLayout(snap));
    attachSyntheticReport(snap);
    const finding = useReadModels().quality.value.findings[0]!;
```

`tests/component/shell-provenance.test.ts`:
- Replace:

```ts
    for (const route of ['overview', 'city', 'architecture', 'hotspots', 'file', 'quality', 'tests', 'dependencies', 'security', 'evolution', 'ownership', 'report'] as const) {
```

  with:

```ts
    for (const route of ['overview', 'city', 'architecture', 'hotspots', 'file', 'tests', 'dependencies', 'security', 'evolution', 'ownership', 'report'] as const) {
```

- Replace:

```ts
    store.navigate('settings');
    await nextTick();
    expect(w.find('.ci-topbar__sample').exists()).toBe(false);
```

  with:

```ts
    // Part 6 Y33: findings are imported evidence or Not analysed, never sample.
    store.navigate('quality');
    await nextTick();
    expect(w.find('.ci-topbar__sample').exists()).toBe(false);
    store.navigate('settings');
    await nextTick();
    expect(w.find('.ci-topbar__sample').exists()).toBe(false);
```

`tests/unit/read-models.test.ts`:
- After `import { journalEntryFor } from '../../src/ui/read-models/snapshot-comparison';`, add `import { attachSyntheticReport } from '../fixtures/evidence-report';`.
- Replace:

```ts
    const snap = buildSnapshotFixture({ files: 20, directories: 2 });
    store.setCity(snap, computeLayout(snap));
    const a = useReadModels();
    const b = useReadModels();
    const before = a.quality.value;
```

  with:

```ts
    const snap = buildSnapshotFixture({ files: 20, directories: 2 });
    store.setCity(snap, computeLayout(snap));
    attachSyntheticReport(snap);
    const a = useReadModels();
    const b = useReadModels();
    const before = a.quality.value;
```

`tests/unit/sample-signals.test.ts`: delete the line `      expect(s.highFindings).toBeLessThanOrEqual(s.findings);`.

`tests/unit/work-items-model.test.ts`: replace:

```ts
    complexity: s, commits90d: s, branchesCovered: s, branchesTotal: s, branchCoverage: s, findings: s, highFindings: s,
    unusedExports: s, directDependents: s, priority: s };
```

with:

```ts
    complexity: s, commits90d: s, branchesCovered: s, branchesTotal: s, branchCoverage: s,
    directDependents: s, priority: s };
```

- [ ] **Step 4: Run them and confirm they fail.** Run `npx vitest run tests/unit/evidence-index.test.ts tests/unit/fallow-acceptance.test.ts tests/unit/findings-model.test.ts tests/unit/file-detail-model.test.ts tests/unit/css-class-scope.test.ts tests/component/nav-column.test.ts tests/component/quality-screen.test.ts tests/component/shell-provenance.test.ts`. Expected: FAIL.
  - `evidence-index`, `fallow-acceptance`, `findings-model` and `file-detail-model` fail to load with `Failed to resolve import "../../src/ui/read-models/evidence-index"`.
  - `css-class-scope`: "kit.css defines the shared classes" fails on `.ci-severity--critical`.
  - `nav-column`: "shows the findings total as the Code quality badge…" fails with `expected null to be '57'`, because the badge still reads the sample overview card.
  - `quality-screen`: the export test fails with `expected '…' to contain 'id,path,module,kind,rule,severity,…'`.
  - `shell-provenance`: fails with `expected true to be false` on the quality route.

- [ ] **Step 5: Copy.**

(a) Append to `src/ui/audit-copy/fallow.ts` (R4):

```ts
// Part 6 Y30/Y33/Y34 (Task 8): imported evidence in the read models.
export const FALLOW_NOT_ANALYSED = 'Not analysed. No imported fallow report covers this.';
export const FALLOW_SOME_NOT_ANALYSED = 'Some finding categories were not analysed in the imported report.';
/** MetricValue provenance detail for an imported value (Y33). */
export const FALLOW_PROVENANCE_DETAIL = (version: string): string => `imported report ${version}`;
/** Overview findings card caption; `high` is already formatted (a count, or the no-value mark). */
export const OVERVIEW_FINDINGS_CAPTION = (high: string): string => `${high} critical or high severity`;
/** Overview evidence-coverage row (R6: replaces the sample "Static signals" row). */
export const OVERVIEW_FALLOW_ROW = 'Static findings (fallow)';
export const OVERVIEW_FALLOW_SOURCE = (version: string): string => `Imported fallow ${version} report`;
/** S22 / COPY-16 (Y30): the stale-evidence notice. Tasks 9 and 11 show it. */
export const COPY_16 = (absoluteDate: string): string => `Showing evidence from ${absoluteDate}. It is not current for this snapshot.`;
```

(b) In `src/ui/audit-copy/quality.ts`:
- Replace:

```ts
export const FINDING_KIND_LABEL: Readonly<Record<'complexity' | 'duplication' | 'unused-exports', string>> = {
  complexity: 'Complexity', duplication: 'Duplication', 'unused-exports': 'Unused exports',
};
```

  with:

```ts
export const FINDING_KIND_LABEL: Readonly<Record<'complexity' | 'duplication' | 'unused-exports', string>> = {
  complexity: 'Complexity', duplication: 'Duplication', 'unused-exports': 'Unused exports',
};
/** Moved from inspector-copy.ts in Part 6 (R6), unchanged: the per-category fallback title. */
export const FINDING_TITLE: Readonly<Record<'complexity' | 'duplication' | 'unused-exports', string>> = {
  complexity: 'Complex function needs review',
  duplication: 'Repeated implementation detected',
  'unused-exports': 'Potentially unused export',
};
```

- Replace:

```ts
export const FINDING_STATUS_LABEL: Readonly<Record<'open' | 'acknowledged' | 'dismissed', string>> = {
  open: 'Open', acknowledged: 'Acknowledged', dismissed: 'Dismissed',
};
```

  with:

```ts
export const FINDING_STATUS_LABEL: Readonly<Record<'open' | 'acknowledged' | 'dismissed', string>> = {
  open: 'Open', acknowledged: 'Acknowledged', dismissed: 'Dismissed',
};
// Part 6 Y35 (R6): the tool's own severity. A finding the tool does not rate reads "Not rated".
export const FINDING_SEVERITY_UNRATED = 'Not rated';
export const SEVERITY_LABEL: Readonly<Record<'critical' | 'high' | 'moderate' | 'unrated', string>> = {
  critical: 'Critical', high: 'High', moderate: 'Moderate', unrated: FINDING_SEVERITY_UNRATED,
};
const SEVERITY_LABELS = new Map<string, string>(Object.entries(SEVERITY_LABEL));
/** A word a later fallow adds is shown verbatim, as text. A Map, so no report word reaches an Object.prototype member. */
export const SEVERITY_TEXT = (severity: string): string => SEVERITY_LABELS.get(severity) ?? severity;
```

(c) In `src/ui/inspector-copy.ts`, delete these lines. They now come in through `export * from './audit-copy/quality';`:

```ts
export const FINDING_TITLE: Readonly<Record<'complexity' | 'duplication' | 'unused-exports', string>> = {
  complexity: 'Complex function needs review',
  duplication: 'Repeated implementation detected',
  'unused-exports': 'Potentially unused export',
};
```

  and

```ts
export const SEVERITY_LABEL: Readonly<Record<'high' | 'medium' | 'low', string>> = { high: 'High', medium: 'Medium', low: 'Low' };
```

(d) `src/ui/styles/kit.css` (R6). Replace:

```css
:where(.codebase-inspector-root) .ci-severity--high { color: var(--ci-tone-danger); background: color-mix(in srgb, var(--ci-tone-danger) 16%, transparent); }
:where(.codebase-inspector-root) .ci-severity--medium { color: var(--ci-tone-warning); border: 1px solid var(--ci-tone-warning); }
:where(.codebase-inspector-root) .ci-severity--low { color: var(--ci-tone-success); border: 1px solid var(--ci-tone-success); }
```

  with:

```css
/* Part 6 Y35 (R6): fallow's own severities. Critical keeps the old high fill; high and moderate are borders; unrated is muted. */
:where(.codebase-inspector-root) .ci-severity--critical { color: var(--ci-tone-danger); background: color-mix(in srgb, var(--ci-tone-danger) 16%, transparent); }
:where(.codebase-inspector-root) .ci-severity--high { color: var(--ci-tone-danger); border: 1px solid var(--ci-tone-danger); }
:where(.codebase-inspector-root) .ci-severity--moderate { color: var(--ci-tone-warning); border: 1px solid var(--ci-tone-warning); }
:where(.codebase-inspector-root) .ci-severity--unrated { color: var(--ci-text-muted); border: 1px solid var(--ci-border); }
```

- [ ] **Step 6: The evidence index.** Create `src/ui/read-models/evidence-index.ts`:

```ts
// Part 6 Y30/Y33/Y34: the attached fallow report, resolved against the files on screen.
// Every findings count on every screen reads from here. Each count is a MetricValue:
// - `collected` (source 'fallow') while the report was imported against this snapshot;
// - `stale` when it was imported against another snapshot (Y30), re-resolved against
//   this snapshot's paths;
// - `partial`, for the total only, when just some categories were analysed;
// - `unknown` with FALLOW_NOT_ANALYSED when there is no report or the report did not
//   analyse the category.
// Never a 0 that nothing measured (Y33).
import type { EntityId } from '../../domain/entity-id';
import {
  FINDING_CATEGORIES, type EvidenceFinding, type EvidenceReport, type FindingCategory,
} from '../../application/evidence/model';
import { resolveFindings } from '../../application/evidence/resolve-findings';
import { unknown, type MetricValue } from '../evidence';
import { FALLOW_NOT_ANALYSED, FALLOW_PROVENANCE_DETAIL, FALLOW_SOME_NOT_ANALYSED, NO_FILES_REASON } from '../inspector-copy';
import type { FileSummary } from './file-summaries';

export type EvidenceIndexState = 'none' | 'current' | 'stale';
export interface FileEvidence { findings: MetricValue; high: MetricValue; unused: MetricValue }
export interface EvidenceIndex {
  state: EvidenceIndexState;
  report: EvidenceReport | null;
  byFile: ReadonlyMap<EntityId, readonly EvidenceFinding[]>;
  perFile(id: EntityId): FileEvidence;
  totals: FileEvidence;
  matchedFindings: number;
  matchedFiles: number;
  unmatchedPaths: readonly string[];
  category(c: FindingCategory): 'analysed' | 'not-analysed';
  /** `n` in this index's evidence state. Unknown when `c` (or, for `null`, every category)
   *  was not analysed; partial when `c` is null and only some were. */
  count(n: number, c: FindingCategory | null): MetricValue;
}

type Counter = (n: number, c: FindingCategory | null) => MetricValue;

/** Y34: `high` counts the tool's two top severities. */
const HIGH_SEVERITIES: readonly string[] = ['critical', 'high'];
const isHigh = (f: EvidenceFinding): boolean => f.severity !== null && HIGH_SEVERITIES.includes(f.severity);
const isUnused = (f: EvidenceFinding): boolean => f.category === 'unused-exports';
const notAnalysed = (): MetricValue => unknown(FALLOW_NOT_ANALYSED, 'fallow');

function counterFor(report: EvidenceReport | null, state: EvidenceIndexState): Counter {
  if (report === null) return notAnalysed;
  const analysed = (c: FindingCategory): boolean => report.normalized.categories[c] === 'analysed';
  const provenance = { source: 'fallow', detail: FALLOW_PROVENANCE_DETAIL(report.providerVersion) };
  const present = (n: number): MetricValue => ({ state: state === 'stale' ? 'stale' : 'collected', value: n, provenance });
  const covered = FINDING_CATEGORIES.filter(analysed).length;
  return (n, c) => {
    if (c !== null) return analysed(c) ? present(n) : notAnalysed();
    if (covered === 0) return notAnalysed();
    return covered === FINDING_CATEGORIES.length ? present(n) : { ...present(n), state: 'partial', reason: FALLOW_SOME_NOT_ANALYSED };
  };
}

function evidenceOf(list: readonly EvidenceFinding[], count: Counter): FileEvidence {
  return {
    findings: count(list.length, null),
    high: count(list.filter(isHigh).length, 'complexity'),
    unused: count(list.filter(isUnused).length, 'unused-exports'),
  };
}

function noFiles(): FileEvidence {
  return { findings: unknown(NO_FILES_REASON), high: unknown(NO_FILES_REASON), unused: unknown(NO_FILES_REASON) };
}

/** Y26: findings whose path is not in the snapshot never reach a file; their paths are listed. */
function groupByFile(files: readonly FileSummary[], findings: readonly EvidenceFinding[]): {
  byFile: Map<EntityId, EvidenceFinding[]>; unmatchedPaths: readonly string[];
} {
  const byPath = new Map<string, EntityId>(files.map((f) => [f.path, f.id]));
  const { matched, unmatchedPaths } = resolveFindings(findings, new Set(byPath.keys()));
  const byFile = new Map<EntityId, EvidenceFinding[]>();
  for (const f of matched) {
    const id = byPath.get(f.path);
    if (id === undefined) continue;
    const list = byFile.get(id);
    if (list) list.push(f); else byFile.set(id, [f]);
  }
  return { byFile, unmatchedPaths };
}

function build(files: readonly FileSummary[], report: EvidenceReport | null, snapshotId: string): EvidenceIndex {
  const state: EvidenceIndexState = report === null ? 'none' : report.snapshotId === snapshotId ? 'current' : 'stale';
  const count = counterFor(report, state);
  const { byFile, unmatchedPaths } = report === null
    ? { byFile: new Map<EntityId, EvidenceFinding[]>(), unmatchedPaths: [] }
    : groupByFile(files, report.normalized.findings);
  const matched = [...byFile.values()].flat();
  const perFileCache = new Map<EntityId, FileEvidence>();
  return {
    state,
    report,
    byFile,
    unmatchedPaths,
    matchedFindings: matched.length,
    matchedFiles: byFile.size,
    totals: files.length === 0 ? noFiles() : evidenceOf(matched, count),
    perFile(id: EntityId): FileEvidence {
      let hit = perFileCache.get(id);
      if (!hit) { hit = evidenceOf(byFile.get(id) ?? [], count); perFileCache.set(id, hit); }
      return hit;
    },
    category: (c) => (report !== null && report.normalized.categories[c] === 'analysed' ? 'analysed' : 'not-analysed'),
    count,
  };
}

/** The no-report key: a WeakMap key must be an object. */
const NO_REPORT: object = {};
const cache = new WeakMap<readonly FileSummary[], WeakMap<object, { snapshotId: string; index: EvidenceIndex }>>();

/** Y30/Y34: memoised per (files array, raw report) in a WeakMap of WeakMaps. Both keys are
 *  shared by every leaf on the codebase, so two leaves with the same inputs share one index,
 *  and a leaf with other inputs never reads it (E53: no single slot). `files` is one array
 *  per snapshot, so this is also the Y30 (report, snapshot) pair. Callers pass the RAW report. */
export function evidenceIndexFor(files: readonly FileSummary[], report: EvidenceReport | null, snapshotId: string): EvidenceIndex {
  let byReport = cache.get(files);
  if (!byReport) { byReport = new WeakMap(); cache.set(files, byReport); }
  const key: object = report ?? NO_REPORT;
  const hit = byReport.get(key);
  if (hit && (report === null || hit.snapshotId === snapshotId)) return hit.index;
  const index = build(files, report, snapshotId);
  byReport.set(key, { snapshotId, index });
  return index;
}
```

- [ ] **Step 7: Drop the sample finding fields.**

(a) `src/ui/fixtures/sample-signals.ts`. Replace:

```ts
  branchesCovered: number;
  findings: number;
  highFindings: number;
  unusedExports: number;
  directDependents: number;
```

  with:

```ts
  branchesCovered: number;
  directDependents: number;
```

  and replace:

```ts
  const directDependents = 1 + Math.floor(r() * 18);
  const unusedExports = r() > 0.75 ? 1 + Math.floor(r() * 4) : 0;
  const highFindings = complexity >= 30 ? 1 : 0;
  const findings = Math.floor(r() * 4) + highFindings;
  return { complexity, commits90d, branchesTotal, branchesCovered, findings, highFindings, unusedExports, directDependents };
```

  with:

```ts
  const directDependents = 1 + Math.floor(r() * 18);
  // Part 6 Y34: no sample findings any more. The draws above keep their order, so every
  // remaining sample value is unchanged.
  return { complexity, commits90d, branchesTotal, branchesCovered, directDependents };
```

(b) `src/ui/read-models/file-summaries.ts`. Replace:

```ts
  branchCoverage: MetricValue;   // percent
  findings: MetricValue;
  highFindings: MetricValue;
  unusedExports: MetricValue;
  directDependents: MetricValue;
```

  with:

```ts
  branchCoverage: MetricValue;   // percent
  directDependents: MetricValue;
```

  and replace:

```ts
      findings: sample(s.findings),
      highFindings: sample(s.highFindings),
      unusedExports: sample(s.unusedExports),
      directDependents: sample(s.directDependents),
```

  with:

```ts
      directDependents: sample(s.directDependents),
```

(c) Delete the sample findings: `git rm src/ui/fixtures/sample-findings.ts`.

- [ ] **Step 8: File detail and the quality model.**

(a) `src/ui/read-models/file-detail.ts`:
- Replace `import type { SampleFinding } from '../fixtures/sample-findings';` with `import type { FindingCategory, FindingDetail } from '../../application/evidence/model';`.
- Replace `import { titledFindings } from './findings';` with:

```ts
import { evidenceIndexFor, type EvidenceIndex } from './evidence-index';
import { titledFindings } from './findings';
```

- Replace:

```ts
export interface FileFinding extends SampleFinding { title: string; fingerprint: string }
```

  with:

```ts
/** Part 6 Y34/Y35: one imported finding, as File detail and Code quality show it.
 *  `severity` is the tool's own word, or 'unrated' when the tool gives none. */
export interface FileFinding {
  id: string; kind: FindingCategory; rule: string; severity: string; line: number | null; endLine: number | null;
  symbol: string | null; detail: FindingDetail; title: string; fingerprint: string;
}
```

- Replace:

```ts
export function buildFileDetail(snapshot: CodebaseSnapshot, files: readonly FileSummary[], entityId: EntityId | null): FileDetailModel | null {
```

  with:

```ts
export function buildFileDetail(
  snapshot: CodebaseSnapshot, files: readonly FileSummary[], entityId: EntityId | null,
  evidence: EvidenceIndex = evidenceIndexFor(files, null, snapshot.snapshotId),
): FileDetailModel | null {
```

- Replace:

```ts
    findingsCount: file.findings,
    findings: titledFindings(file),
```

  with:

```ts
    findingsCount: evidence.perFile(file.id).findings,
    findings: titledFindings(file, evidence),
```

(b) Replace the whole of `src/ui/read-models/findings.ts` with the text in the appendix ("Post-Task-8 file state", `src/ui/read-models/findings.ts`).

- [ ] **Step 9: Overview and the city summary.**

(a) `src/ui/read-models/overview.ts`:
- Replace:

```ts
  INVESTIGATE_LARGEST_DETAIL, INVESTIGATE_MODULE_DETAIL, INVESTIGATE_NO_LINES, NO_FILES_REASON, OVERVIEW_ARCH_CAPTION,
  PROTECT_MODULE_TITLE,
} from '../inspector-copy';
import { filesByPriority, ROOT_MODULE, type FileSummary } from './file-summaries';
```

  with:

```ts
  EVIDENCE_SOURCE_NONE, INVESTIGATE_LARGEST_DETAIL, INVESTIGATE_MODULE_DETAIL, INVESTIGATE_NO_LINES, NO_FILES_REASON,
  OVERVIEW_ARCH_CAPTION, OVERVIEW_FALLOW_ROW, OVERVIEW_FALLOW_SOURCE, OVERVIEW_FINDINGS_CAPTION, PROTECT_MODULE_TITLE,
} from '../inspector-copy';
import { evidenceIndexFor, type EvidenceIndex, type EvidenceIndexState } from './evidence-index';
import { filesByPriority, ROOT_MODULE, type FileSummary } from './file-summaries';
```

- Replace:

```ts
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
```

  with:

```ts
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
/** R6: the fallow row's state follows the evidence index. It is never sample. */
const FALLOW_ROW_STATE: Readonly<Record<EvidenceIndexState, EvidenceState>> = { none: 'unknown', current: 'collected', stale: 'stale' };
```

- Replace:

```ts
  cycles: MetricValue = unknown(IMPORT_GRAPH_UNKNOWN_REASON),
): OverviewModel {
```

  with:

```ts
  cycles: MetricValue = unknown(IMPORT_GRAPH_UNKNOWN_REASON),
  evidence: EvidenceIndex = evidenceIndexFor(files, null, snapshot.snapshotId),
): OverviewModel {
```

- Replace:

```ts
  const findings = sumEvidence(files.map((f) => f.findings), NO_FILES_REASON);
  const high = sumEvidence(files.map((f) => f.highFindings), NO_FILES_REASON);
```

  with:

```ts
  // Part 6 Y34: imported fallow evidence, or unknown (Not analysed), never a sample count.
  const findings = evidence.totals.findings;
  const high = evidence.totals.high;
```

- Replace:

```ts
      value: findings, caption: `${formatMetric(high)} high-priority findings · sample rules` },
```

  with:

```ts
      value: findings, caption: OVERVIEW_FINDINGS_CAPTION(formatMetric(high)) },
```

- Replace:

```ts
    { id: 'static', label: 'Static signals', state: 'sample', source: 'Sample provider' },
```

  with:

```ts
    { id: 'fallow', label: OVERVIEW_FALLOW_ROW, state: FALLOW_ROW_STATE[evidence.state],
      source: evidence.report ? OVERVIEW_FALLOW_SOURCE(evidence.report.providerVersion) : EVIDENCE_SOURCE_NONE },
```

(b) Replace the whole of `src/ui/read-models/city-summary.ts` with:

```ts
import type { RouteId } from '../../domain/route-ids';
import { countEvidence, unknown, type MetricValue } from '../evidence';
import { IMPORT_GRAPH_UNKNOWN_REASON, NO_FILES_REASON } from '../inspector-copy';
import { evidenceIndexFor, type EvidenceIndex } from './evidence-index';
import type { FileSummary } from './file-summaries';
import { HOTSPOT_THRESHOLD } from './overview';

export interface CitySummaryCard { id: 'hotspots' | 'cycles' | 'unused'; title: string; caption: string; value: MetricValue; route: RouteId }

/** Part 6 Y34: the unused card counts imported unused exports and types, or reads Not analysed. */
export function buildCitySummary(
  files: readonly FileSummary[], cycles: MetricValue = unknown(IMPORT_GRAPH_UNKNOWN_REASON),
  evidence: EvidenceIndex = evidenceIndexFor(files, null, ''),
): readonly CitySummaryCard[] {
  return [
    { id: 'hotspots', title: 'Change hotspots', caption: 'Complexity × change × coverage gap', route: 'hotspots',
      value: countEvidence(files.map((f) => f.priority), (v) => v >= HOTSPOT_THRESHOLD, NO_FILES_REASON) },
    { id: 'cycles', title: 'Architectural cycles', caption: 'Inspect module boundaries', route: 'architecture', value: cycles },
    { id: 'unused', title: 'Potentially unused exports', caption: 'Verify entry points before deletion', route: 'quality',
      value: evidence.totals.unused },
  ];
}
```

- [ ] **Step 10: `use-read-models`.** Edit `src/ui/read-models/use-read-models.ts`.

(a) Replace:

```ts
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
```

  with:

```ts
import { useCityStore } from '../stores/city-store';
import { useEvidenceStore } from '../stores/evidence-store';
import { useReviewStore } from '../stores/review-store';
```

  and replace `import { buildCitySummary } from './city-summary';` with:

```ts
import { buildCitySummary } from './city-summary';
import { evidenceIndexFor, type EvidenceIndex } from './evidence-index';
```

(b) Replace:

```ts
const overviewCache = new WeakMap<readonly FileSummary[], { snapshot: CodebaseSnapshot; cycles: MetricValue; model: OverviewModel }>();
export function overviewModelFor(snapshot: CodebaseSnapshot, files: readonly FileSummary[], cycles: MetricValue): OverviewModel {
  const hit = overviewCache.get(files);
  if (hit && hit.snapshot === snapshot && hit.cycles === cycles) return hit.model;
  const model = buildOverviewModel(snapshot, files, cycles);
  overviewCache.set(files, { snapshot, cycles, model });
  return model;
}
```

  with:

```ts
/** Part 6: keyed by the evidence index, which is one object per (files, report). */
type OverviewEntry = { snapshot: CodebaseSnapshot; files: readonly FileSummary[]; cycles: MetricValue; model: OverviewModel };
const overviewCache = new WeakMap<EvidenceIndex, OverviewEntry>();
export function overviewModelFor(
  snapshot: CodebaseSnapshot, files: readonly FileSummary[], cycles: MetricValue, evidence: EvidenceIndex,
): OverviewModel {
  const hit = overviewCache.get(evidence);
  if (hit && hit.snapshot === snapshot && hit.files === files && hit.cycles === cycles) return hit.model;
  const model = buildOverviewModel(snapshot, files, cycles, evidence);
  overviewCache.set(evidence, { snapshot, files, cycles, model });
  return model;
}
```

(c) Replace:

```ts
const detailCache = new WeakMap<readonly FileSummary[], { snapshot: CodebaseSnapshot; byId: Map<EntityId, FileDetailModel | null> }>();
export function fileDetailFor(snapshot: CodebaseSnapshot, files: readonly FileSummary[], entityId: EntityId | null): FileDetailModel | null {
  if (!entityId) return null;
  let entry = detailCache.get(files);
  if (!entry || entry.snapshot !== snapshot) { entry = { snapshot, byId: new Map() }; detailCache.set(files, entry); }
  if (!entry.byId.has(entityId)) entry.byId.set(entityId, buildFileDetail(snapshot, files, entityId));
  return entry.byId.get(entityId) ?? null;
}

const qualityCache = new WeakMap<readonly FileSummary[], { dispositions: readonly FindingDisposition[]; model: QualityModel }>();
/** `review.dispositions` is reassigned on every decision, so its identity is the key. */
export function qualityModelFor(files: readonly FileSummary[], dispositions: readonly FindingDisposition[]): QualityModel {
  const hit = qualityCache.get(files);
  if (hit && hit.dispositions === dispositions) return hit.model;
  const model = buildQualityModel(files, dispositions);
  qualityCache.set(files, { dispositions, model });
  return model;
}
```

  with:

```ts
type DetailEntry = { snapshot: CodebaseSnapshot; files: readonly FileSummary[]; byId: Map<EntityId, FileDetailModel | null> };
const detailCache = new WeakMap<EvidenceIndex, DetailEntry>();
export function fileDetailFor(
  snapshot: CodebaseSnapshot, files: readonly FileSummary[], entityId: EntityId | null, evidence: EvidenceIndex,
): FileDetailModel | null {
  if (!entityId) return null;
  let entry = detailCache.get(evidence);
  if (!entry || entry.snapshot !== snapshot || entry.files !== files) { entry = { snapshot, files, byId: new Map() }; detailCache.set(evidence, entry); }
  if (!entry.byId.has(entityId)) entry.byId.set(entityId, buildFileDetail(snapshot, files, entityId, evidence));
  return entry.byId.get(entityId) ?? null;
}

/** Part 6: one Quality model per (evidence index, leaf dispositions). The index is shared
 *  by every leaf on the codebase. Each leaf has its own review store, whose `dispositions`
 *  array is reassigned on every decision, so its raw identity is the inner key (E53). */
const qualityCache = new WeakMap<EvidenceIndex, WeakMap<object, QualityModel>>();
export function qualityModelFor(
  files: readonly FileSummary[], evidence: EvidenceIndex, dispositions: readonly FindingDisposition[],
): QualityModel {
  let byDispositions = qualityCache.get(evidence);
  if (!byDispositions) { byDispositions = new WeakMap(); qualityCache.set(evidence, byDispositions); }
  const key: object = toRaw(dispositions);
  let hit = byDispositions.get(key);
  if (!hit) { hit = buildQualityModel(files, evidence, dispositions); byDispositions.set(key, hit); }
  return hit;
}
```

(d) Replace:

```ts
  const store = useCityStore();
  const review = useReviewStore();
  const files = computed(() => (store.snapshot ? fileSummariesFor(store.snapshot) : NO_FILES));
  const graph = computed(() => architectureGraphFor(files.value));
  const cycles = computed(() => cyclesFor(graph.value));
  const overview = computed(() => (store.snapshot ? overviewModelFor(store.snapshot, files.value, cycles.value) : null));
  const citySummary = computed(() => buildCitySummary(files.value, cycles.value));
  const architecture = computed(() => architectureModelFor(graph.value, review.rules));
  const fileDetail = computed(() => (store.snapshot ? fileDetailFor(store.snapshot, files.value, store.selectedEntityId) : null));
  const quality = computed(() => qualityModelFor(files.value, review.dispositions));
```

  with:

```ts
  const store = useCityStore();
  const review = useReviewStore();
  const evidenceStore = useEvidenceStore();
  const files = computed(() => (store.snapshot ? fileSummariesFor(store.snapshot) : NO_FILES));
  /** Part 6 Y34 (R7): the bound codebase's imported evidence, resolved against these files.
   *  A report bound to another codebase (a switch App has not rebound yet) is never shown. */
  const evidence = computed(() => {
    const snapshot = store.snapshot;
    const report = snapshot && evidenceStore.repositoryId === snapshot.repositoryId ? evidenceStore.report : null;
    return evidenceIndexFor(files.value, report ? toRaw(report) : null, snapshot?.snapshotId ?? '');
  });
  const graph = computed(() => architectureGraphFor(files.value));
  const cycles = computed(() => cyclesFor(graph.value));
  const overview = computed(() => (store.snapshot ? overviewModelFor(store.snapshot, files.value, cycles.value, evidence.value) : null));
  const citySummary = computed(() => buildCitySummary(files.value, cycles.value, evidence.value));
  const architecture = computed(() => architectureModelFor(graph.value, review.rules));
  const fileDetail = computed(() => (store.snapshot
    ? fileDetailFor(store.snapshot, files.value, store.selectedEntityId, evidence.value) : null));
  const quality = computed(() => qualityModelFor(files.value, evidence.value, review.dispositions));
```

(e) Replace:

```ts
  return {
    files, overview, citySummary, architecture, fileDetail, quality, testConfidence, dependencies, security,
    ownership, filesUseSample,
  };
```

  with:

```ts
  return {
    files, evidence, overview, citySummary, architecture, fileDetail, quality, testConfidence, dependencies, security,
    ownership, filesUseSample,
  };
```

- [ ] **Step 11: The shell.**

(a) `src/ui/shell/NavColumn.vue`:
- Replace `const { overview } = useReadModels();` with `const { evidence } = useReadModels();`.
- Replace:

```ts
/** Only COLLECTED counts become nav badges: a nav badge carries no Sample label, so a
 *  sample findings count would read as measured (spec §9 A11 — none are collected in
 *  Part 1, so the Code quality badge is absent). Work items are real, in-memory. */
const badges = computed<Partial<Record<RouteId, number>>>(() => {
  const findings = overview.value?.cards.find((c) => c.id === 'findings')?.value;
  return {
    quality: findings?.state === 'collected' ? findings.value : undefined,
```

  with:

```ts
/** Only COLLECTED counts become nav badges: a nav badge carries no evidence label, so a
 *  stale, partial or unknown count would read as current (spec §9 A11). Part 6 Y34: the
 *  Code quality badge is the imported fallow findings total, shown only while that total
 *  is collected (a current report). Work items are real. */
const badges = computed<Partial<Record<RouteId, number>>>(() => {
  const findings = evidence.value.totals.findings;
  return {
    quality: findings.state === 'collected' ? findings.value : undefined,
```

(b) `src/ui/shell/use-route-provenance.ts`:
- Replace:

```ts
  const {
    overview, citySummary, architecture, fileDetail, quality, testConfidence, dependencies, security, filesUseSample,
    ownership,
  } = useReadModels();
```

  with:

```ts
  const {
    overview, citySummary, architecture, fileDetail, testConfidence, dependencies, security, filesUseSample,
    ownership,
  } = useReadModels();
```

- Replace:

```ts
      case 'quality': return quality.value.usesSample;
```

  with:

```ts
      // Part 6 Y33: findings are imported fallow evidence or Not analysed, never sample.
      case 'quality': return false;
```

- [ ] **Step 12: The minimal screen edits the types force.** Only these four components change; the appendix gives each one's full post-task text. Everything else about the findings UX is Task 9's.

(a) `src/ui/screens/quality/FindingsTable.vue`:
- Replace `import { FINDINGS_PAGE, SEVERITY_RANK, type QualityFinding } from '../../read-models/findings';` with `import { FINDINGS_PAGE, severityRank, severityTone, type QualityFinding } from '../../read-models/findings';`.
- Replace `  QUALITY_REVIEW, QUALITY_REVIEW_LABEL, QUALITY_SHOWING, QUALITY_TABLE_CAPTION, RESET_FILTERS, SEVERITY_LABEL, SHOW_MORE,` with `  QUALITY_REVIEW, QUALITY_REVIEW_LABEL, QUALITY_SHOWING, QUALITY_TABLE_CAPTION, RESET_FILTERS, SEVERITY_TEXT, SHOW_MORE,`.
- Replace:

```ts
import EvidenceTable from '../../kit/EvidenceTable.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';
```

  with:

```ts
import EvidenceTable from '../../kit/EvidenceTable.vue';
```

- Replace `  { key: 'severity', label: QUALITY_COL_SEVERITY, sortValue: (r) => SEVERITY_RANK[r.severity] },` with `  { key: 'severity', label: QUALITY_COL_SEVERITY, sortValue: (r) => severityRank(r.severity) },`.
- Replace:

```html
          <span
            class="ci-severity"
            :class="`ci-severity--${row.severity}`"
          >{{ SEVERITY_LABEL[row.severity] }}</span>
```

  with:

```html
          <span
            class="ci-severity"
            :class="`ci-severity--${severityTone(row.severity)}`"
          >{{ SEVERITY_TEXT(row.severity) }}</span>
```

- Replace:

```html
            <span class="ci-chip">{{ FINDING_KIND_LABEL[row.kind] }}</span>
            <ProvenanceBadge state="sample" />
```

  with:

```html
            <span class="ci-chip">{{ FINDING_KIND_LABEL[row.kind] }}</span>
```

(b) `src/ui/screens/quality/FindingReviewDialog.vue`:
- Replace `import { useReadModels } from '../../read-models/use-read-models';` with:

```ts
import { useReadModels } from '../../read-models/use-read-models';
import { severityTone } from '../../read-models/findings';
```

- Replace `  FINDING_STATUS_LABEL, QUALITY_LOCATION, SEVERITY_LABEL, WORK_ITEM_TITLE,` with `  FINDING_STATUS_LABEL, QUALITY_LOCATION, SEVERITY_TEXT, WORK_ITEM_TITLE,`.
- Replace:

```ts
import CiDialog from '../../kit/Dialog.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';
```

  with:

```ts
import CiDialog from '../../kit/Dialog.vue';
```

- Replace:

```html
        <span
          class="ci-severity"
          :class="`ci-severity--${finding.severity}`"
        >{{ SEVERITY_LABEL[finding.severity] }}</span>
        <span
          class="ci-chip"
          :class="`ci-chip--status-${finding.status}`"
        >{{ FINDING_STATUS_LABEL[finding.status] }}</span>
        <ProvenanceBadge state="sample" />
```

  with:

```html
        <span
          class="ci-severity"
          :class="`ci-severity--${severityTone(finding.severity)}`"
        >{{ SEVERITY_TEXT(finding.severity) }}</span>
        <span
          class="ci-chip"
          :class="`ci-chip--status-${finding.status}`"
        >{{ FINDING_STATUS_LABEL[finding.status] }}</span>
```

(c) `src/ui/screens/file/FileFindingsPanel.vue`:
- Replace `import type { FindingStatus, QualityFinding } from '../../read-models/findings';` with `import { severityTone, type FindingStatus, type QualityFinding } from '../../read-models/findings';`.
- Replace `  FINDING_META, FINDING_STATUS_LABEL, SEVERITY_LABEL,` with `  FINDING_META, FINDING_STATUS_LABEL, SEVERITY_TEXT,`.
- Replace:

```ts
import Callout from '../../kit/Callout.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';
```

  with:

```ts
import Callout from '../../kit/Callout.vue';
```

- Replace:

```html
              :class="`ci-severity--${f.severity}`"
            >{{ SEVERITY_LABEL[f.severity] }}</span>
```

  with:

```html
              :class="`ci-severity--${severityTone(f.severity)}`"
            >{{ SEVERITY_TEXT(f.severity) }}</span>
```

- Replace:

```html
            {{ FINDING_META(f.line) }}
            <ProvenanceBadge state="sample" />
```

  with:

```html
            {{ FINDING_META(f.line) }}
```

(d) `src/ui/screens/QualityScreen.vue`: replace `function exportCsv(): void { exportText(QUALITY_CSV_FILENAME, () => findingsCsv(rows.value)); }` with `function exportCsv(): void { exportText(QUALITY_CSV_FILENAME, () => findingsCsv(rows.value, quality.value.evidence)); }`.

`FindingFilters.vue` needs no edit: it iterates `SEVERITY_LABEL` (now the four Y35 keys) and `FINDING_KIND_LABEL`. R6 gives the model-driven severity options to Task 9.

- [ ] **Step 13: Sweep, run, gate.**
  - These must print nothing:
    - `git grep -n "sample-findings\|sampleFindings\|SampleFinding\|highFindings\|unusedExports\|FindingKind\|SEVERITY_LABEL\[\|ci-severity--medium\|ci-severity--low" -- src`
    - `git grep -n "usesSample" -- src/ui/read-models/findings.ts src/ui/shell/use-route-provenance.ts`
    - `git grep -n "state=\"sample\"" -- src/ui/screens/quality src/ui/screens/file`
    - `git grep -n "'static'" -- src/ui/read-models/overview.ts`
  - Run `npx vitest run tests/unit/evidence-index.test.ts tests/unit/fallow-acceptance.test.ts tests/unit/findings-model.test.ts tests/unit/file-detail-model.test.ts tests/unit/read-models.test.ts tests/unit/sample-signals.test.ts tests/unit/work-items-model.test.ts tests/unit/report-model.test.ts tests/unit/review-per-codebase.test.ts tests/unit/security-lazy.test.ts tests/unit/css-class-scope.test.ts tests/component/nav-column.test.ts tests/component/quality-screen.test.ts tests/component/quality-dialog-status.test.ts tests/component/file-detail-screen.test.ts tests/component/shell-provenance.test.ts tests/component/overview-screen.test.ts tests/component/tests-screen.test.ts tests/unit/normalize-fallow.test.ts tests/unit/fallow-report-reader.test.ts`. Expected: PASS.
  - Check sizes with `wc -l`:
    - `src/ui/read-models/use-read-models.ts` ≤ 180;
    - `src/ui/read-models/findings.ts` ≤ 140;
    - `src/ui/read-models/evidence-index.ts` ≤ 130;
    - `src/ui/inspector-copy.ts` < 400;
    - every touched test file ≤ 450.
  - Gate: `npm run typecheck && npm run lint:fast && npx vitest run tests/unit/evidence-index.test.ts tests/unit/fallow-acceptance.test.ts tests/unit/findings-model.test.ts tests/unit/file-detail-model.test.ts tests/unit/css-class-scope.test.ts tests/component/nav-column.test.ts tests/component/quality-screen.test.ts tests/component/shell-provenance.test.ts`.
  - Lint the touched files: `npx eslint src/ui/read-models/evidence-index.ts src/ui/read-models/findings.ts src/ui/read-models/file-detail.ts src/ui/read-models/overview.ts src/ui/read-models/city-summary.ts src/ui/read-models/file-summaries.ts src/ui/read-models/use-read-models.ts src/ui/fixtures/sample-signals.ts src/ui/shell/NavColumn.vue src/ui/shell/use-route-provenance.ts src/ui/screens/quality/FindingsTable.vue src/ui/screens/quality/FindingReviewDialog.vue src/ui/screens/file/FileFindingsPanel.vue src/ui/screens/QualityScreen.vue src/ui/audit-copy/quality.ts src/ui/audit-copy/fallow.ts src/ui/inspector-copy.ts tests/fixtures/evidence-report.ts tests/unit/evidence-index.test.ts tests/unit/fallow-acceptance.test.ts tests/unit/findings-model.test.ts tests/unit/file-detail-model.test.ts tests/unit/read-models.test.ts tests/unit/sample-signals.test.ts tests/unit/work-items-model.test.ts tests/unit/css-class-scope.test.ts tests/component/nav-column.test.ts tests/component/quality-screen.test.ts tests/component/quality-dialog-status.test.ts tests/component/file-detail-screen.test.ts tests/component/shell-provenance.test.ts --max-warnings 0`.

- [ ] **Step 14: Commit.** Commit only this task's files, including the deletion:

```
feat(ui): evidence index replaces the sample findings; counts are imported, stale or Not analysed (Y33, Y34)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---


---

### Task 9: EvidenceBadge, NotAnalysed, Quality and File detail (Y32, Y35, Y36)

**Files:**
- Create: `src/ui/kit/EvidenceBadge.vue` (~20), `src/ui/kit/NotAnalysed.vue` (~30).
- Modify with exact Edits against Task 8's result (the "Post-Task-8 file state" appendix of Tasks 7–8):
  - `src/ui/read-models/findings.ts` (~135 → ~143);
  - `src/ui/screens/QualityScreen.vue` (159 → ~192);
  - `src/ui/screens/quality/FindingsTable.vue` (115 → ~121);
  - `src/ui/screens/quality/FindingReviewDialog.vue` (235 → ~245);
  - `src/ui/screens/file/FileFindingsPanel.vue` (66 → ~88);
  - `src/ui/audit-copy/quality.ts` (~85 → ~130).
- Modify against today's text (Task 8 does not touch these):
  - `src/ui/screens/quality/FindingFilters.vue` (125 → ~126);
  - `src/ui/screens/FileDetailScreen.vue` (141 → ~152);
  - `src/ui/audit-copy/report.ts` (59 → 59).
- Modify, other:
  - `src/ui/inspector-copy.ts` (Task 8's ~291 → ~289);
  - `src/ui/audit-copy/fallow.ts` (+~10; Tasks 5 and 8 wrote it);
  - `src/ui/styles/kit.css` (+~9, appended after Task 8's severity edit);
  - `src/ui/styles/screens-audit.css` (177 → ~180).
- Test (new):
  - `tests/component/kit-evidence.test.ts` (~45);
  - `tests/unit/finding-copy.test.ts` (~70);
  - `tests/component/quality-fallow.test.ts` (~205);
  - `tests/component/file-findings-fallow.test.ts` (~105).
- Test (modify): `tests/unit/css-class-scope.test.ts` (one line edited; the count is unchanged).
- There is no new fixture: every test uses Task 8's `tests/fixtures/evidence-report.ts` (R5). Task 8 has already made `quality-screen`, `quality-dialog-status` and `file-detail-screen` attach a synthetic report (R6). This task does not edit those files.

**Interfaces:**
- Consumes:
  - **Task 6** (`src/application/evidence/model.ts`): `FindingCategory`, `FindingDetail`, `FindingRule`, `EvidenceReport`.
  - **Task 7:**
    - `useEvidenceStore()` (a setup store): `requestImport()` and `importRequested`.
    - `new InMemoryEvidenceStore()`, used in tests through the fixture only.
  - **Task 8:**
    - From `src/ui/read-models/findings.ts`: `severityRank`, `severityTone`, `titledFindings`, `buildQualityModel`, `findingsCsv(rows, evidence)`, and `QualityModel.evidence: EvidenceIndex`.
    - `EvidenceIndexState`.
    - `FileFinding` (`{ id, kind, rule, severity, line, endLine, symbol, detail, title, fingerprint }`).
    - Copy: `SEVERITY_TEXT`, `SEVERITY_LABEL`, `FINDING_TITLE` (all in `audit-copy/quality.ts`), `COPY_16` and `FALLOW_NOT_ANALYSED` (in `audit-copy/fallow.ts`).
    - The kit severity classes.
    - The fixture `tests/fixtures/evidence-report.ts`: `attachSyntheticReport`, `SYNTHETIC_VERSION`.
  - **Task 4 (R3):** the rewritten `FINDING_DISMISS_HINT` and `FINDING_DISMISSED`. This task does not touch them.
  - **Existing:** `formatAbsoluteTime(iso, Intl)` (`src/ui/copy.ts`), `Callout`, `Panel`, `ProvenanceBadge`.
- Produces:
  - **`EvidenceBadge.vue` (R8):** props `{ version: string; state: 'imported' | 'stale' }`. It renders one `<span class="ci-evidence-badge ci-evidence-badge--<state>">` containing `EVIDENCE_BADGE(version, state)`.
  - **`NotAnalysed.vue`:** no props; emits `import: []`. Classes: `ci-not-analysed` (+ `__title`, `__body`, `__import`).
  - **`QualityModel.severities: readonly string[]`:** the severities present in the model, in `severityRank` order (R6). It is built by `buildQualityModel`.
  - **`titledFindings`** now titles each finding with `FINDING_TITLE_FOR`.
  - **`FindingsTable.vue`** gains the prop `stale: boolean`.
  - **`FindingFilters.vue`** gains the prop `severities: readonly string[]`.
  - **`FileFindingsPanel.vue`** gains the props `evidence: EvidenceIndexState` and `version: string`, and the emit `import: []`.
  - **Copy in `audit-copy/quality.ts`:**
    - `FINDING_RULE_LABEL: Readonly<Record<FindingRule, string>>`;
    - `RULE_TEXT(rule: string)`;
    - `FINDING_TITLE_FOR(kind, rule, symbol, detail)`;
    - `FINDING_META(line, endLine, rule)` (moved here from `inspector-copy.ts`, with a new signature);
    - `FILE_NO_FINDINGS_REPORTED`;
    - `FINDING_DIALOG_RULE` and `FINDING_DIALOG_RULE_VALUE(rule, detail)`;
    - `FINDING_DIALOG_PROVIDER_VALUE`, which becomes `(version, date) => string`;
    - removed: `FINDING_DIALOG_CONFIDENCE` and `FINDING_DIALOG_CONFIDENCE_VALUE`;
    - rewritten: `QUALITY_CARD_COMPLEXITY_CAPTION`, `QUALITY_TABLE_CAPTION` and `QUALITY_FOOTNOTE`.
  - **Copy in `inspector-copy.ts`:** `FILE_NO_FINDINGS` and the old `FINDING_META` are removed, and `FILE_FINDINGS_SUBTITLE` says "reported".
  - **Copy in `audit-copy/fallow.ts`:** `EVIDENCE_BADGE`, `FALLOW_NOT_ANALYSED_TITLE`, `FALLOW_NOT_ANALYSED_BODY` and `FALLOW_IMPORT_ACTION`.
  - **Copy in `audit-copy/report.ts`:** `REPORT_EVIDENCE_TEXT` is rewritten (R6).
  - **Kit classes:** `ci-evidence-badge` (+ `--imported`, `--stale`) and `ci-not-analysed`.
  - **Screen classes:** `ci-quality__evidence` (Quality) and `ci-file-findings__none` (File detail, an unstyled hook).

**NotAnalysed's Import button follows Y39.** The S14 dialog lives only on Data & scans (Task 10), so the button does exactly what the command's `CityView.openReportImport()` does: `store.navigate('sources')`, then `evidenceStore.requestImport()`. SourcesScreen consumes the request once and opens the dialog. The file picker still opens only from a real click on "Choose report…" inside the dialog. `NotAnalysed` itself only emits `import`, because a kit piece touches no store. The two screens that host it own those two lines: Quality directly, and File detail through `FileFindingsPanel`.

**What the tests rely on.** They use `tests/fixtures/evidence-report.ts`, Task 8, on a 10-file, 2-directory snapshot. For file i:
- **Unused:** an unused export `symbol<i>` on line 1. Files 3 and 7 carry an unused type instead.
- **Complexity:** each even file has a complexity finding `fn<i>` on line 2, with cognitive 20 + i and cyclomatic 12, against thresholds of 15 and 20, `exceeded: 'cognitive_crap'`. Files 0 and 6 are critical, 2 and 8 are high, and 4 is moderate.
- **Duplication:** the clone groups are files 0+1 and 5+6, both on lines 3–6, 4 lines and 60 tokens.

That gives 19 findings in 10 files: 5 complexity, 4 duplication, 8 unused exports and 2 unused types. 14 of them are unrated. The file name is `synthetic-fallow.json`. `options.snapshotId` makes a report stale.

- [ ] **Step 1: Write the failing tests.** Create `tests/component/kit-evidence.test.ts`:

```ts
// Part 6 Y32 (C13, R8) and Y35: the two new kit pieces.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import EvidenceBadge from '../../src/ui/kit/EvidenceBadge.vue';
import NotAnalysed from '../../src/ui/kit/NotAnalysed.vue';
import {
  EVIDENCE_BADGE, FALLOW_IMPORT_ACTION, FALLOW_NOT_ANALYSED_BODY, FALLOW_NOT_ANALYSED_TITLE,
} from '../../src/ui/inspector-copy';

describe('EvidenceBadge (Part 6 Y32, C13)', () => {
  it('names the provider, version, freshness and the unverified source match in text', () => {
    const w = mount(EvidenceBadge, { props: { version: '3.27.0', state: 'imported' } });
    expect(w.text()).toBe('fallow 3.27.0 · Imported · Unverified source match');
    expect(w.text()).toBe(EVIDENCE_BADGE('3.27.0', 'imported'));
    expect(w.classes()).toEqual(['ci-evidence-badge', 'ci-evidence-badge--imported']);
  });
  it('says Stale in words, never in colour alone', () => {
    const w = mount(EvidenceBadge, { props: { version: '3.21.0', state: 'stale' } });
    expect(w.text()).toBe('fallow 3.21.0 · Stale · Unverified source match');
    expect(w.classes()).toContain('ci-evidence-badge--stale');
  });
});

describe('NotAnalysed (Part 6 Y35)', () => {
  it('says Not analysed, never zero, and emits import from one real button', async () => {
    const w = mount(NotAnalysed);
    expect(w.find('.ci-not-analysed__title').text()).toBe(FALLOW_NOT_ANALYSED_TITLE);
    expect(w.find('.ci-not-analysed__body').text()).toBe(FALLOW_NOT_ANALYSED_BODY);
    const button = w.find('button.ci-not-analysed__import');
    expect(button.attributes('type')).toBe('button');
    expect(button.text()).toBe(FALLOW_IMPORT_ACTION);
    await button.trigger('click');
    expect(w.emitted('import')).toHaveLength(1);
  });
});
```

  Create `tests/unit/finding-copy.test.ts`:

```ts
// Part 6 Y35/Y36: how a reported finding reads — its title, the review dialog's rule row
// and File detail's meta line — and the report's evidence line (R6).
import { describe, expect, it } from 'vitest';
import type { FindingDetail } from '../../src/application/evidence/model';
import {
  FINDING_DIALOG_RULE_VALUE, FINDING_META, FINDING_TITLE, FINDING_TITLE_FOR, REPORT_EVIDENCE_TEXT, RULE_TEXT,
} from '../../src/ui/inspector-copy';

const complexity = (exceeded: string): FindingDetail => ({
  kind: 'complexity', cognitive: 27, cyclomatic: 24, lineCount: 40, exceeded, cognitiveThreshold: 15, cyclomaticThreshold: 20,
});
const DUPLICATION: FindingDetail = { kind: 'duplication', tokenCount: 93, lineCount: 15, partnerFiles: 1 };
const UNUSED: FindingDetail = { kind: 'unused', typeOnly: false };

describe('finding copy (Part 6 Y35/Y36)', () => {
  it('titles a finding by its symbol and what the tool reported; the category title is the fallback', () => {
    expect(FINDING_TITLE_FOR('complexity', 'complexity', 'partitionDistrict', complexity('cognitive_crap')))
      .toBe('partitionDistrict · Cognitive complexity 27 (threshold 15)');
    expect(FINDING_TITLE_FOR('complexity', 'complexity', 'walk', complexity('cyclomatic'))).toBe('walk · Cyclomatic complexity 24 (threshold 20)');
    expect(FINDING_TITLE_FOR('duplication', 'duplication', null, DUPLICATION)).toBe('Duplicated block · 15 lines');
    expect(FINDING_TITLE_FOR('unused-exports', 'unused-export', 'fs', UNUSED)).toBe('fs · Unused export');
    expect(FINDING_TITLE_FOR('unused-exports', 'unused-type', 'LabelOptions', { kind: 'unused', typeOnly: true })).toBe('LabelOptions · Unused type');
    expect(FINDING_TITLE_FOR('unused-exports', 'unused-member', null, UNUSED)).toBe(FINDING_TITLE['unused-exports']);
  });

  it('the dialog rule row gives both measures and thresholds, "Reported above threshold" for complexity, and COPY-20 for unused', () => {
    expect(FINDING_DIALOG_RULE_VALUE('complexity', complexity('cognitive_crap')))
      .toBe('Complexity: cognitive 27 (threshold 15), cyclomatic 24 (threshold 20). Reported above threshold.');
    expect(FINDING_DIALOG_RULE_VALUE('duplication', DUPLICATION)).toBe('Duplication: 15 lines, 93 tokens, also in 1 other file.');
    expect(FINDING_DIALOG_RULE_VALUE('duplication', { kind: 'duplication', tokenCount: 60, lineCount: 4, partnerFiles: 0 }))
      .toBe('Duplication: 4 lines, 60 tokens, repeated within this file.');
    expect(FINDING_DIALOG_RULE_VALUE('unused-export', UNUSED))
      .toBe('Unused export. No static consumers reported in this analysis scope. Verify dynamic or framework usage before removal.');
  });

  it('the File detail meta line gives the line or the range, then the rule; an unknown rule reads verbatim', () => {
    expect(FINDING_META(7, null, 'unused-export')).toBe('Line 7 · Unused export');
    expect(FINDING_META(3, 6, 'duplication')).toBe('Lines 3–6 · Duplication');
    expect(FINDING_META(3, 3, 'duplication')).toBe('Line 3 · Duplication');
    expect(FINDING_META(null, null, 'complexity')).toBe('Line unknown · Complexity');
    expect(RULE_TEXT('x-new-rule')).toBe('x-new-rule');
    expect(RULE_TEXT('constructor')).toBe('constructor');
  });

  it('the report\'s evidence line no longer calls findings sample data (R6)', () => {
    expect(REPORT_EVIDENCE_TEXT).toContain('imported fallow report');
    expect(REPORT_EVIDENCE_TEXT).not.toMatch(/Findings[^.]*sample data/);
  });
});
```

  Create `tests/component/quality-fallow.test.ts`:

```ts
// Part 6 Y32/Y35: Code quality over an imported fallow report — the Not-analysed state, the
// badge, the tool's severities, per-finding titles, the kind filter, CSV provenance, the
// stale notice, the review dialog's provider and rule rows, and imported text as text.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import QualityScreen from '../../src/ui/screens/QualityScreen.vue';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { formatAbsoluteTime } from '../../src/ui/copy';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import {
  COPY_16, EVIDENCE_BADGE, FALLOW_IMPORT_ACTION, FALLOW_NOT_ANALYSED, FALLOW_NOT_ANALYSED_TITLE, FINDING_DIALOG_PROVIDER_VALUE,
  FINDING_KIND_LABEL, QUALITY_CARD_COMPLEXITY, SEVERITY_LABEL,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { SYNTHETIC_VERSION, attachSyntheticReport } from '../fixtures/evidence-report';

const mountQ = () => mount(QualityScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
function withSnapshot(): CodebaseSnapshot {
  const snap = buildSnapshotFixture({ files: 10, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
}
const rowWith = (w: VueWrapper, text: string) => w.findAll('.ci-table__row').find((r) => r.text().includes(text));
const csvRows = (call: number): string[] => vi.mocked(downloadText).mock.calls[call]![2].split(/\r?\n/).filter((l) => l !== '').slice(1);

describe('Code quality over a fallow report (Part 6 Y35)', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('without a report: Not analysed replaces the table, no card reads 0, and Import report asks Data & scans for the dialog', async () => {
    withSnapshot();
    const w = mountQ();
    expect(w.find('.ci-not-analysed__title').text()).toBe(FALLOW_NOT_ANALYSED_TITLE);
    expect(w.find('.ci-findings-table').exists()).toBe(false);
    expect(w.find('.ci-evidence-badge').exists()).toBe(false);
    const values = w.findAll('.ci-metric-card__value').map((v) => v.text());
    expect(values).toHaveLength(4);
    expect(values.every((v) => v !== '0')).toBe(true);
    expect(w.findAll('.ci-metric-card .ci-provenance--unknown')).toHaveLength(4);
    expect(w.find('.ci-quality__export').attributes('disabled')).toBeDefined();
    const button = w.find('.ci-not-analysed__import');
    expect(button.text()).toBe(FALLOW_IMPORT_ACTION);
    await button.trigger('click');
    expect(useCityStore().route).toBe('sources');
    expect(useEvidenceStore().importRequested).toBe(true);
    w.unmount();
  });

  it('with a report: the badge heads the screen, each row has its own title and the tool\'s severity', () => {
    attachSyntheticReport(withSnapshot());
    const w = mountQ();
    expect(w.find('.ci-quality__evidence .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'imported'));
    expect(w.find('.ci-not-analysed').exists()).toBe(false);
    expect(w.findAll('.ci-table__row')).toHaveLength(19);
    const complexity = rowWith(w, 'fn0 · Cognitive complexity 20 (threshold 15)');
    expect(complexity?.find('.ci-severity').text()).toBe(SEVERITY_LABEL.critical);
    expect(complexity?.find('.ci-severity').classes()).toContain('ci-severity--critical');
    const unused = rowWith(w, 'symbol1 · Unused export');
    expect(unused?.find('.ci-severity').text()).toBe(SEVERITY_LABEL.unrated);
    expect(unused?.find('.ci-findings-table__evidence').text()).toBe('Unused export');
    expect(rowWith(w, 'symbol3 · Unused type')?.find('.ci-findings-table__evidence').text()).toBe('Unused type');
    expect(rowWith(w, 'Duplicated block · 4 lines')).toBeDefined();
    w.unmount();
  });

  it('the severity filter lists the severities the model holds, in rank order, "Not rated" last (R6)', async () => {
    attachSyntheticReport(withSnapshot());
    const w = mountQ();
    const options = w.findAll('.ci-finding-filters__severity option');
    expect(options.map((o) => o.attributes('value'))).toEqual(['', 'critical', 'high', 'moderate', 'unrated']);
    expect(options[4]!.text()).toBe(SEVERITY_LABEL.unrated);
    await w.find('.ci-finding-filters__severity').setValue('unrated');
    const rows = w.findAll('.ci-table__row');
    expect(rows).toHaveLength(14);
    expect(rows.every((r) => r.find('.ci-severity').text() === SEVERITY_LABEL.unrated)).toBe(true);
    w.unmount();
  });

  it('the kind filter covers both unused rules; a category the report did not analyse reads Unknown and stays listed', async () => {
    const snap = withSnapshot();
    attachSyntheticReport(snap);
    const w = mountQ();
    await w.find('.ci-finding-filters__kind').setValue('unused-exports');
    const rows = w.findAll('.ci-table__row');
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => ['Unused export', 'Unused type'].includes(r.find('.ci-findings-table__evidence').text()))).toBe(true);
    w.unmount();

    attachSyntheticReport(snap, { kind: 'dead-code' });
    const d = mountQ();
    expect(d.find('.ci-not-analysed').exists()).toBe(false);
    const card = d.findAll('.ci-metric-card').find((c) => c.text().includes(QUALITY_CARD_COMPLEXITY));
    expect(card?.find('.ci-provenance--unknown').exists()).toBe(true);
    expect(card?.find('.ci-metric-card__reason').text()).toBe(FALLOW_NOT_ANALYSED);
    expect(d.findAll('.ci-finding-filters__kind option').map((o) => o.text())).toContain(FINDING_KIND_LABEL.complexity);
    d.unmount();
  });

  it('exports the rule, "reported" lines and the report\'s provenance, "stale" once the report predates the snapshot', async () => {
    const snap = withSnapshot();
    attachSyntheticReport(snap);
    const w = mountQ();
    await w.find('.ci-quality__export').trigger('click');
    expect(vi.mocked(downloadText).mock.calls[0]![2]).toContain('id,path,module,kind,rule,severity,line,line_state,status,reason,provenance');
    const rows = csvRows(0);
    expect(rows).toHaveLength(19);
    expect(rows.every((l) => l.endsWith(`,fallow ${SYNTHETIC_VERSION} imported`))).toBe(true);
    expect(rows.some((l) => l.includes(',unused-exports,unused-export,unrated,1,reported,open,'))).toBe(true);
    attachSyntheticReport(snap, { snapshotId: 'snapshot-older' });
    await nextTick();
    await w.find('.ci-quality__export').trigger('click');
    const stale = csvRows(1);
    expect(stale.length).toBeGreaterThan(0);
    expect(stale.every((l) => l.endsWith(`,fallow ${SYNTHETIC_VERSION} stale`))).toBe(true);
    w.unmount();
  });

  it('stale evidence stays on screen with the COPY-16 notice, a Stale badge and a stale mark on each row (Y30)', () => {
    const report = attachSyntheticReport(withSnapshot(), { snapshotId: 'snapshot-older' });
    const w = mountQ();
    expect(w.find('.ci-callout').text()).toContain(COPY_16(formatAbsoluteTime(report.importedAt, Intl)));
    expect(w.find('.ci-quality__evidence .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'stale'));
    const rows = w.findAll('.ci-table__row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.find('.ci-findings-table__evidence .ci-provenance--stale').exists())).toBe(true);
    w.unmount();
  });

  it('the review dialog names the provider, the date and the rule with its thresholds; nothing is "Illustrative"', async () => {
    const report = attachSyntheticReport(withSnapshot());
    const w = mountQ();
    await rowWith(w, 'fn0 ·')!.find('.ci-findings-table__open').trigger('click');
    const meta = w.find('.ci-finding-dialog__meta').text();
    expect(meta).toContain(FINDING_DIALOG_PROVIDER_VALUE(SYNTHETIC_VERSION, formatAbsoluteTime(report.importedAt, Intl)));
    expect(meta).toContain('cognitive 20 (threshold 15), cyclomatic 12 (threshold 20)');
    expect(meta).toContain('Reported above threshold.');
    expect(w.find('.ci-finding-dialog__chips .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'imported'));
    expect(w.find('.ci-finding-dialog').text()).not.toContain('Illustrative');
    w.unmount();
  });

  it('renders an imported symbol that looks like HTML as literal text (spec §4)', () => {
    const symbol = '<img src=x onerror=alert(1)>';
    attachSyntheticReport(withSnapshot(), { symbol });
    const w = mountQ();
    expect(rowWith(w, `${symbol} · Unused export`)).toBeDefined();
    expect(w.find('.ci-findings-table img').exists()).toBe(false);
    expect(w.find('.ci-findings-table').html()).toContain('&lt;img');
    w.unmount();
  });
});
```

  Create `tests/component/file-findings-fallow.test.ts`:

```ts
// Part 6 Y36: File detail's findings panel in its three states — Not analysed, analysed
// with no finding for this file (not zero complexity), and the reported findings.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import FileDetailScreen from '../../src/ui/screens/FileDetailScreen.vue';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import {
  EVIDENCE_BADGE, FALLOW_NOT_ANALYSED_TITLE, FILE_FINDINGS_SUBTITLE, FILE_NO_FINDINGS_REPORTED, SEVERITY_LABEL,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { SYNTHETIC_VERSION, attachSyntheticReport } from '../fixtures/evidence-report';

const mountFile = () => mount(FileDetailScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), clipboard: { writeText: vi.fn(() => Promise.resolve()) } } },
});
function onFile(index: number): CodebaseSnapshot {
  const snap = buildSnapshotFixture({ files: 10, directories: 2 });
  const store = useCityStore();
  store.setCity(snap, computeLayout(snap));
  store.select(snap.entities.filter((e) => e.kind === 'file')[index]!.id);
  store.navigate('file');
  return snap;
}

describe('File detail findings (Part 6 Y36)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('without a report: Not analysed, no badge, and Import report asks Data & scans for the dialog', async () => {
    onFile(0);
    const w = mountFile();
    expect(w.find('.ci-not-analysed__title').text()).toBe(FALLOW_NOT_ANALYSED_TITLE);
    expect(w.find('.ci-findings').exists()).toBe(false);
    expect(w.find('.ci-file-findings__none').exists()).toBe(false);
    expect(w.find('.ci-evidence-badge').exists()).toBe(false);
    await w.find('.ci-not-analysed__import').trigger('click');
    expect(useCityStore().route).toBe('sources');
    expect(useEvidenceStore().importRequested).toBe(true);
    w.unmount();
  });

  it('analysed, with no finding for this file: says so, and that it is not zero complexity (S15)', () => {
    onFile(5);
    // A report over the first two files only (same codebase, same snapshot id): file 5 has none.
    attachSyntheticReport(buildSnapshotFixture({ files: 2, directories: 2 }));
    const w = mountFile();
    expect(w.find('.ci-file-findings__none').text()).toBe(FILE_NO_FINDINGS_REPORTED);
    expect(w.find('.ci-not-analysed').exists()).toBe(false);
    expect(w.find('.ci-panel__header .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'imported'));
    w.unmount();
  });

  it('lists each reported finding with its title, line or range, rule and the tool\'s severity; stale says so', async () => {
    const snap = onFile(0);
    attachSyntheticReport(snap);
    const w = mountFile();
    expect(w.text()).toContain(FILE_FINDINGS_SUBTITLE('3'));
    const items = w.findAll('.ci-file-finding');
    expect(items).toHaveLength(3);
    const text = items.map((i) => i.text()).join('\n');
    expect(text).toContain('symbol0 · Unused export');
    expect(text).toContain('Line 1 · Unused export');
    expect(text).toContain('fn0 · Cognitive complexity 20 (threshold 15)');
    expect(text).toContain('Line 2 · Complexity');
    expect(text).toContain('Duplicated block · 4 lines');
    expect(text).toContain('Lines 3–6 · Duplication');
    expect(text).not.toContain('Sample finding');
    expect(items.map((i) => i.find('.ci-severity').text()).sort())
      .toEqual([SEVERITY_LABEL.critical, SEVERITY_LABEL.unrated, SEVERITY_LABEL.unrated].sort());
    attachSyntheticReport(snap, { snapshotId: 'snapshot-older' });
    await nextTick();
    expect(w.find('.ci-panel__header .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'stale'));
    w.unmount();
  });
});
```

  In `tests/unit/css-class-scope.test.ts`, replace `      '.ci-file-cell ', '.ci-file-cell__name', '.ci-file-cell__path', '.ci-priority ',` with `      '.ci-file-cell ', '.ci-file-cell__name', '.ci-file-cell__path', '.ci-priority ', '.ci-evidence-badge ', '.ci-not-analysed ',`. Task 8 has already made the severity-class line on the line above it critical/high/moderate/unrated.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run tests/component/kit-evidence.test.ts tests/unit/finding-copy.test.ts tests/component/quality-fallow.test.ts tests/component/file-findings-fallow.test.ts tests/unit/css-class-scope.test.ts`. Expected: FAIL.
  - `kit-evidence` fails to resolve `src/ui/kit/EvidenceBadge.vue` and `src/ui/kit/NotAnalysed.vue`.
  - `finding-copy` fails because `FINDING_TITLE_FOR`, `FINDING_DIALOG_RULE_VALUE` and `RULE_TEXT` are undefined, and `FINDING_META(7, null, …)` still returns `Sample finding · line 7`.
  - `quality-fallow` and `file-findings-fallow` fail on `.ci-not-analysed__title` (an empty DOMWrapper) and on the missing copy exports.
  - `css-class-scope` fails "kit.css defines the shared classes" on `.ci-evidence-badge `.

- [ ] **Step 3: Copy.**

  (a) In `src/ui/inspector-copy.ts`, as Task 8 leaves it, replace:

```ts
export const FILE_FINDINGS_SUBTITLE = (n: string): string => `${n} static findings for this file.`;
export const FILE_NO_FINDINGS = 'No sample findings for this file.';
export const FILE_FINDINGS_CAVEAT_TITLE = 'No findings does not imply no defects.';
export const FILE_FINDINGS_CAVEAT = 'Dynamic imports, reflection, configuration and runtime behaviour may need additional review.';
export const FINDING_META = (line: number | null): string => (line === null ? 'Sample finding · line unknown' : `Sample finding · line ${line}`);
```

  with:

```ts
export const FILE_FINDINGS_SUBTITLE = (n: string): string => `${n} reported findings for this file.`;
export const FILE_FINDINGS_CAVEAT_TITLE = 'No findings does not imply no defects.';
export const FILE_FINDINGS_CAVEAT = 'Dynamic imports, reflection, configuration and runtime behaviour may need additional review.';
```

  `FINDING_META` is redefined below in `audit-copy/quality.ts` with a new signature, and `FILE_NO_FINDINGS_REPORTED` replaces `FILE_NO_FINDINGS`.

  (b) In `src/ui/audit-copy/quality.ts`, as the appendix shows it:
  - Replace `// Part 3 §2: Code quality screen and the Finding review dialog.` (line 1) with:

```ts
// Part 3 §2: Code quality screen and the Finding review dialog.
// Part 6 Y35/Y36: findings are an imported fallow report's: the tool's own rule, a title
// per finding, and the review dialog's provider and rule rows.
import type { FindingCategory, FindingDetail, FindingRule } from '../../application/evidence/model';
```

  - Replace `export const QUALITY_CARD_COMPLEXITY_CAPTION = 'Functions with cognitive complexity of 30 or more';` with `export const QUALITY_CARD_COMPLEXITY_CAPTION = 'Functions the report lists above its complexity thresholds';`.
  - Replace `export const QUALITY_TABLE_CAPTION = 'Static findings, one row per finding';` with `export const QUALITY_TABLE_CAPTION = 'Reported findings, one row per finding';`.
  - Replace `export const QUALITY_FOOTNOTE = 'Findings are sample data. Decisions are kept in this session only and never written to the repository.';   // E21: use spec wording` with `export const QUALITY_FOOTNOTE = 'Findings come from the imported fallow report and are kept for this session only. Decisions are saved with this codebase’s review state in the plugin’s own data; the repository is never changed.';`. The second sentence follows Task 4's R3 wording for `FINDING_DISMISS_HINT`.
  - Replace:

```ts
export const FINDING_DIALOG_PROVIDER_VALUE = 'Sample findings';
export const FINDING_DIALOG_CONFIDENCE = 'Confidence';
export const FINDING_DIALOG_CONFIDENCE_VALUE = 'Illustrative, manual confirmation required';   // E21: use spec wording
```

    with:

```ts
export const FINDING_DIALOG_PROVIDER_VALUE = (version: string, date: string): string => `fallow ${version} · imported report, ${date}`;
```

  - Replace Task 4's last line `export const FINDING_DISMISSED = 'Dismissal and reason saved.';` (R3) with:

```ts
export const FINDING_DISMISSED = 'Dismissal and reason saved.';

/* Part 6 Y35/Y36: the tool's rule and a title per finding. */
export const FINDING_RULE_LABEL: Readonly<Record<FindingRule, string>> = {
  complexity: 'Complexity', duplication: 'Duplication', 'unused-export': 'Unused export', 'unused-type': 'Unused type',
};
const RULE_LABELS = new Map<string, string>(Object.entries(FINDING_RULE_LABEL));
/** Like SEVERITY_TEXT: a rule this version does not know reads verbatim, and a Map means no
 *  word reaches an Object.prototype member. */
export const RULE_TEXT = (rule: string): string => RULE_LABELS.get(rule) ?? rule;
/** Y35: one title per finding, "<symbol> · <what the tool reported>". A complexity finding
 *  names the measure fallow says it exceeded (fallow's `exceeded` word, verbatim), and a
 *  rule this version does not know falls back to the category title. */
export const FINDING_TITLE_FOR = (kind: FindingCategory, rule: string, symbol: string | null, detail: FindingDetail): string => {
  let what: string;
  switch (detail.kind) {
    case 'complexity':
      what = detail.exceeded.startsWith('cyclomatic')
        ? `Cyclomatic complexity ${detail.cyclomatic} (threshold ${detail.cyclomaticThreshold})`
        : `Cognitive complexity ${detail.cognitive} (threshold ${detail.cognitiveThreshold})`;
      break;
    case 'duplication':
      what = `Duplicated block · ${detail.lineCount} lines`;
      break;
    default:
      what = RULE_LABELS.get(rule) ?? FINDING_TITLE[kind];
  }
  return symbol === null ? what : `${symbol} · ${what}`;
};
/** Y36: File detail's line under each finding: the line or the range, then the rule. */
export const FINDING_META = (line: number | null, endLine: number | null, rule: string): string => {
  const where = line === null ? 'Line unknown' : endLine !== null && endLine !== line ? `Lines ${line}–${endLine}` : `Line ${line}`;
  return `${where} · ${RULE_TEXT(rule)}`;
};
export const FILE_NO_FINDINGS_REPORTED = 'No findings reported for this file. That is not the same as zero complexity.';
/** Y35: the rule and its thresholds replace the old confidence row. Unused exports carry
 *  COPY-20's caution. */
export const FINDING_DIALOG_RULE = 'Rule';
export const FINDING_DIALOG_RULE_VALUE = (rule: string, detail: FindingDetail): string => {
  const label = RULE_TEXT(rule);
  switch (detail.kind) {
    case 'complexity':
      return `${label}: cognitive ${detail.cognitive} (threshold ${detail.cognitiveThreshold}), cyclomatic ${detail.cyclomatic} (threshold ${detail.cyclomaticThreshold}). Reported above threshold.`;
    case 'duplication': {
      const others = detail.partnerFiles === 0
        ? 'repeated within this file'
        : `also in ${detail.partnerFiles} other ${detail.partnerFiles === 1 ? 'file' : 'files'}`;
      return `${label}: ${detail.lineCount} lines, ${detail.tokenCount} tokens, ${others}.`;
    }
    default:
      return `${label}${detail.typeOnly ? ' (type only)' : ''}. No static consumers reported in this analysis scope. Verify dynamic or framework usage before removal.`;
  }
};
```

  (c) In `src/ui/audit-copy/fallow.ts` (after Task 8's additions), append at the end of the file:

```ts

/* Part 6 Task 9 (Y32, Y35, Y36): the evidence badge and the Not-analysed state. COPY_16 is Task 8's (R4). */
/** C13 (R8): provider, version, freshness and source match, in words. A fallow report carries
 *  no root or revision, so the match is always unverified (Y27). */
export const EVIDENCE_BADGE = (version: string, state: 'imported' | 'stale'): string =>
  `fallow ${version} · ${state === 'stale' ? 'Stale' : 'Imported'} · Unverified source match`;
export const FALLOW_NOT_ANALYSED_TITLE = 'Not analysed';
export const FALLOW_NOT_ANALYSED_BODY = 'No fallow report is attached to this codebase, so its findings are unknown, not zero. Import a report to see them. Imported reports are kept for this session only.';
export const FALLOW_IMPORT_ACTION = 'Import report…';
```

  (d) In `src/ui/audit-copy/report.ts`, replace:

```ts
export const REPORT_EVIDENCE_TEXT = 'File inventory collected by the built-in read-only scan. Findings, history, coverage, import edges and packages are sample data. Mutation, runtime and secret scanning were not collected.';
```

  with:

```ts
export const REPORT_EVIDENCE_TEXT = 'File inventory collected by the built-in read-only scan. Static findings come from an imported fallow report when one is attached for this session, and read Not analysed otherwise. History, coverage, import edges and packages are sample data. Mutation, runtime and secret scanning were not collected.';
```

- [ ] **Step 4: The two kit pieces.** Create `src/ui/kit/EvidenceBadge.vue`:

```vue
<script setup lang="ts">
// Part 6 Y32 (C13, R8): who reported the evidence, how fresh it is and whether its source
// match is verified, as one line of text, never a coloured dot alone. A fallow report
// carries no root or revision, so the source match always reads "Unverified" (Y27).
import { computed } from 'vue';
import { EVIDENCE_BADGE } from '../inspector-copy';

const props = defineProps<{ version: string; state: 'imported' | 'stale' }>();
const text = computed(() => EVIDENCE_BADGE(props.version, props.state));
</script>

<template>
  <span
    class="ci-evidence-badge"
    :class="`ci-evidence-badge--${state}`"
  >{{ text }}</span>
</template>
```

  Create `src/ui/kit/NotAnalysed.vue`:

```vue
<script setup lang="ts">
// Part 6 Y35/Y36: no report is attached, so findings are unknown, not zero. One action: the
// host screen decides what Import does (Y39: go to Data & scans and ask for the S14 dialog).
import { FALLOW_IMPORT_ACTION, FALLOW_NOT_ANALYSED_BODY, FALLOW_NOT_ANALYSED_TITLE } from '../inspector-copy';

const emit = defineEmits<{ import: [] }>();
</script>

<template>
  <div class="ci-empty ci-not-analysed">
    <p class="ci-empty__title ci-not-analysed__title">
      {{ FALLOW_NOT_ANALYSED_TITLE }}
    </p>
    <p class="ci-note ci-not-analysed__body">
      {{ FALLOW_NOT_ANALYSED_BODY }}
    </p>
    <button
      type="button"
      class="mod-cta ci-not-analysed__import"
      @click="emit('import')"
    >
      {{ FALLOW_IMPORT_ACTION }}
    </button>
  </div>
</template>
```

- [ ] **Step 5: The per-finding title and the model's severities, in `src/ui/read-models/findings.ts`.** These are exact Edits against the appendix text.
  - Replace:

```ts
  FINDING_TITLE, NO_FILES_REASON, QUALITY_CARD_COMPLEXITY, QUALITY_CARD_COMPLEXITY_CAPTION, QUALITY_CARD_DUPLICATION,
```

    with:

```ts
  FINDING_TITLE_FOR, NO_FILES_REASON, QUALITY_CARD_COMPLEXITY, QUALITY_CARD_COMPLEXITY_CAPTION, QUALITY_CARD_DUPLICATION,
```

  - Replace:

```ts
  cards: readonly QualityCard[];
  /** The evidence the model was built from: its state, report and categories (Y35). */
```

    with:

```ts
  cards: readonly QualityCard[];
  /** R6: the severities the findings use, in severityRank order (the severity filter's options). */
  severities: readonly string[];
  /** The evidence the model was built from: its state, report and categories (Y35). */
```

  - Replace `    symbol: f.symbol, detail: f.detail, title: FINDING_TITLE[f.category], fingerprint: findingFingerprint(file.id, f.id),` with `    symbol: f.symbol, detail: f.detail, title: FINDING_TITLE_FOR(f.category, f.rule, f.symbol, f.detail), fingerprint: findingFingerprint(file.id, f.id),`.
  - Replace:

```ts
export function buildQualityModel(
```

    with:

```ts
/** R6: a word a later fallow adds is listed too, after moderate and before unrated. */
function presentSeverities(findings: readonly QualityFinding[]): string[] {
  return [...new Set(findings.map((f) => f.severity))].sort((a, b) => severityRank(a) - severityRank(b) || a.localeCompare(b));
}

export function buildQualityModel(
```

  - Replace:

```ts
      { id: 'duplication', label: QUALITY_CARD_DUPLICATION, icon: 'copy', value: count('duplication'), caption: QUALITY_CARD_DUPLICATION_CAPTION, tone: 'accent' },
    ],
    evidence,
```

    with:

```ts
      { id: 'duplication', label: QUALITY_CARD_DUPLICATION, icon: 'copy', value: count('duplication'), caption: QUALITY_CARD_DUPLICATION_CAPTION, tone: 'accent' },
    ],
    severities: presentSeverities(findings),
    evidence,
```

  `findingsCsv(rows, evidence)` keeps its signature (R6). Afterwards, `grep -n "FINDING_TITLE\[" src/ui/read-models` prints nothing: `FINDING_TITLE` is used only inside `FINDING_TITLE_FOR`, as its fallback.

- [ ] **Step 6: FindingsTable** (exact Edits against the appendix).
  - Replace `  FINDING_KIND_LABEL, FINDING_STATUS_LABEL, QUALITY_COL_EVIDENCE, QUALITY_COL_FINDING, QUALITY_COL_LOCATION,` with `  FINDING_STATUS_LABEL, QUALITY_COL_EVIDENCE, QUALITY_COL_FINDING, QUALITY_COL_LOCATION,`.
  - Replace `  QUALITY_REVIEW, QUALITY_REVIEW_LABEL, QUALITY_SHOWING, QUALITY_TABLE_CAPTION, RESET_FILTERS, SEVERITY_TEXT, SHOW_MORE,` with `  QUALITY_REVIEW, QUALITY_REVIEW_LABEL, QUALITY_SHOWING, QUALITY_TABLE_CAPTION, RESET_FILTERS, RULE_TEXT, SEVERITY_TEXT, SHOW_MORE,`.
  - Replace:

```ts
import EvidenceTable from '../../kit/EvidenceTable.vue';

defineProps<{ rows: readonly QualityFinding[]; limit: number }>();
```

    with:

```ts
import EvidenceTable from '../../kit/EvidenceTable.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

/** Part 6 Y30/Y35: `stale` marks every row when the report predates the snapshot. */
defineProps<{ rows: readonly QualityFinding[]; limit: number; stale: boolean }>();
```

  - Replace:

```vue
          <span class="ci-findings-table__evidence">
            <span class="ci-chip">{{ FINDING_KIND_LABEL[row.kind] }}</span>
          </span>
```

    with:

```vue
          <span class="ci-findings-table__evidence">
            <span class="ci-chip">{{ RULE_TEXT(row.rule) }}</span>
            <ProvenanceBadge
              v-if="stale"
              state="stale"
            />
          </span>
```

- [ ] **Step 7: FindingFilters** (against today's text; Task 8 does not touch this file).
  - Replace:

```ts
  QUALITY_FILTER_STATUS, QUALITY_RESET, SEVERITY_LABEL,
} from '../../inspector-copy';
import Icon from '../../kit/Icon.vue';

defineProps<{ modules: readonly { name: string; label: string }[] }>();
```

    with:

```ts
  QUALITY_FILTER_STATUS, QUALITY_RESET, SEVERITY_TEXT,
} from '../../inspector-copy';
import Icon from '../../kit/Icon.vue';

/** Part 6 Y35 (R6): `severities` are the model's own, in severityRank order. */
defineProps<{ modules: readonly { name: string; label: string }[]; severities: readonly string[] }>();
```

  - Replace:

```vue
      <option
        v-for="(label, severity) in SEVERITY_LABEL"
        :key="severity"
        :value="severity"
      >
        {{ label }}
      </option>
```

    with:

```vue
      <option
        v-for="severity in severities"
        :key="severity"
        :value="severity"
      >
        {{ SEVERITY_TEXT(severity) }}
      </option>
```

  The kind select is unchanged: `FINDING_KIND_LABEL` lists the three categories, and `unused-exports` covers both unused rules (Y35).

- [ ] **Step 8: QualityScreen** (exact Edits against the appendix).
  - Replace:

```ts
import { useCsvExport } from '../export/use-csv-export';
import {
  DEFAULT_QUALITY_FILTER, FINDINGS_PAGE, filterFindings, findingsCsv, type QualityFilter, type QualityFinding,
} from '../read-models/findings';
```

    with:

```ts
import { formatAbsoluteTime } from '../copy';
import { useCsvExport } from '../export/use-csv-export';
import {
  DEFAULT_QUALITY_FILTER, FINDINGS_PAGE, filterFindings, findingsCsv, type QualityFilter, type QualityFinding,
} from '../read-models/findings';
```

  - Replace:

```ts
import { useCityStore } from '../stores/city-store';
import {
  QUALITY_CSV_FILENAME, QUALITY_EXPORT, QUALITY_EYEBROW, QUALITY_FOOTNOTE, QUALITY_SUBTITLE,
```

    with:

```ts
import { useCityStore } from '../stores/city-store';
import { useEvidenceStore } from '../stores/evidence-store';
import {
  COPY_16, QUALITY_CSV_FILENAME, QUALITY_EXPORT, QUALITY_EYEBROW, QUALITY_FOOTNOTE, QUALITY_SUBTITLE,
```

  - Replace:

```ts
import Panel from '../kit/Panel.vue';
import Icon from '../kit/Icon.vue';
```

    with:

```ts
import Panel from '../kit/Panel.vue';
import Callout from '../kit/Callout.vue';
import Icon from '../kit/Icon.vue';
import EvidenceBadge from '../kit/EvidenceBadge.vue';
import NotAnalysed from '../kit/NotAnalysed.vue';
```

  - Replace:

```ts
const store = useCityStore();
const { quality } = useReadModels();
```

    with:

```ts
const store = useCityStore();
const evidenceStore = useEvidenceStore();
const { quality } = useReadModels();
```

  - Replace:

```ts
const rows = computed(() => filterFindings(quality.value.findings, filter.value));
```

    with:

```ts
const rows = computed(() => filterFindings(quality.value.findings, filter.value));
/** Part 6 Y30/Y32/Y35: the report the model was built from (null: Not analysed), and whether
 *  it predates the snapshot on screen. */
const report = computed(() => quality.value.evidence.report);
const stale = computed(() => quality.value.evidence.state === 'stale');
const staleNotice = computed(() => (report.value && stale.value ? COPY_16(formatAbsoluteTime(report.value.importedAt, Intl)) : ''));
```

  - Replace:

```ts
/** Every filtered finding, handed to the user through this leaf's own document. */
```

    with:

```ts
/** Y35/Y39: the S14 dialog lives on Data & scans. Go there and ask for it, exactly as the
 *  "Import analysis report" command does; the file picker then opens from a real click in it. */
function importReport(): void {
  store.navigate('sources');
  evidenceStore.requestImport();
}

/** Every filtered finding, handed to the user through this leaf's own document. */
```

  - In the template, replace:

```vue
    <template v-else>
      <div class="ci-screen__cards">
```

    with:

```vue
    <template v-else>
      <div
        v-if="report"
        class="ci-quality__evidence"
      >
        <EvidenceBadge
          :version="report.providerVersion"
          :state="stale ? 'stale' : 'imported'"
        />
      </div>
      <Callout
        v-if="staleNotice"
        tone="warning"
        :title="staleNotice"
      />
      <div class="ci-screen__cards">
```

  - Replace:

```vue
      <section
        class="ci-quality__panel"
        tabindex="-1"
      >
        <Panel :title="QUALITY_TABLE_TITLE">
          <FindingFilters
            v-model:filter="filter"
            :modules="quality.modules"
            @reset="resetFilters"
          />
          <FindingsTable
            :rows="rows"
            :limit="shown"
            @open="open"
```

    with:

```vue
      <NotAnalysed
        v-if="!report"
        @import="importReport"
      />
      <section
        v-else
        class="ci-quality__panel"
        tabindex="-1"
      >
        <Panel :title="QUALITY_TABLE_TITLE">
          <FindingFilters
            v-model:filter="filter"
            :modules="quality.modules"
            :severities="quality.severities"
            @reset="resetFilters"
          />
          <FindingsTable
            :rows="rows"
            :limit="shown"
            :stale="stale"
            @open="open"
```

  The Export button keeps its native `disabled`. Nothing can block it while it is focused: its rows change only through the filters, which hold the focus themselves. With no report the rows are empty, so it stays disabled.

- [ ] **Step 9: The review dialog's provider and rule rows** (exact Edits against the appendix).
  - Replace:

```ts
import type { EntityId } from '../../../domain/entity-id';
import { useReadModels } from '../../read-models/use-read-models';
```

    with:

```ts
import type { EntityId } from '../../../domain/entity-id';
import { formatAbsoluteTime } from '../../copy';
import { useReadModels } from '../../read-models/use-read-models';
```

  - Replace:

```ts
  DIALOG_CLOSE, FINDING_ACKNOWLEDGE, FINDING_ACKNOWLEDGED, FINDING_ADD_WORK_ITEM, FINDING_DECISION_FAILED, FINDING_DIALOG_CONFIDENCE,
  FINDING_DIALOG_CONFIDENCE_VALUE, FINDING_DIALOG_LOCATION, FINDING_DIALOG_PROVIDER, FINDING_DIALOG_PROVIDER_VALUE,
  FINDING_DIALOG_REASON, FINDING_DIALOG_TITLE,
```

    with:

```ts
  DIALOG_CLOSE, FINDING_ACKNOWLEDGE, FINDING_ACKNOWLEDGED, FINDING_ADD_WORK_ITEM, FINDING_DECISION_FAILED,
  FINDING_DIALOG_LOCATION, FINDING_DIALOG_PROVIDER, FINDING_DIALOG_PROVIDER_VALUE, FINDING_DIALOG_REASON,
  FINDING_DIALOG_RULE, FINDING_DIALOG_RULE_VALUE, FINDING_DIALOG_TITLE,
```

    The rest of that import line, from `FINDING_DISMISS,` onwards, is unchanged.
  - Replace:

```ts
import CiDialog from '../../kit/Dialog.vue';

const props = defineProps<{ fingerprint: string }>();
const emit = defineEmits<{ close: []; openFile: [id: EntityId] }>();
const { quality } = useReadModels();
```

    with:

```ts
import CiDialog from '../../kit/Dialog.vue';
import EvidenceBadge from '../../kit/EvidenceBadge.vue';

const props = defineProps<{ fingerprint: string }>();
const emit = defineEmits<{ close: []; openFile: [id: EntityId] }>();
const { quality } = useReadModels();
/** Part 6 Y35: who reported the finding, and when. The badge says the source match is unverified. */
const provider = computed(() => {
  const r = quality.value.evidence.report;
  return r ? FINDING_DIALOG_PROVIDER_VALUE(r.providerVersion, formatAbsoluteTime(r.importedAt, Intl)) : '';
});
```

  - In the template, replace:

```vue
        >{{ FINDING_STATUS_LABEL[finding.status] }}</span>
      </p>
```

    with:

```vue
        >{{ FINDING_STATUS_LABEL[finding.status] }}</span>
        <EvidenceBadge
          v-if="quality.evidence.report"
          :version="quality.evidence.report.providerVersion"
          :state="quality.evidence.state === 'stale' ? 'stale' : 'imported'"
        />
      </p>
```

  - Replace:

```vue
        <dt>{{ FINDING_DIALOG_PROVIDER }}</dt>
        <dd>{{ FINDING_DIALOG_PROVIDER_VALUE }}</dd>
        <dt>{{ FINDING_DIALOG_CONFIDENCE }}</dt>
        <dd>{{ FINDING_DIALOG_CONFIDENCE_VALUE }}</dd>
```

    with:

```vue
        <dt>{{ FINDING_DIALOG_PROVIDER }}</dt>
        <dd>{{ provider }}</dd>
        <dt>{{ FINDING_DIALOG_RULE }}</dt>
        <dd>{{ FINDING_DIALOG_RULE_VALUE(finding.rule, finding.detail) }}</dd>
```

- [ ] **Step 10: File detail.** In `src/ui/screens/file/FileFindingsPanel.vue`, use exact Edits against the appendix.
  - Replace:

```ts
import { formatMetric, type MetricValue } from '../../evidence';
import type { FileFinding } from '../../read-models/file-detail';
import { severityTone, type FindingStatus, type QualityFinding } from '../../read-models/findings';
import {
  FILE_FINDINGS_CAVEAT, FILE_FINDINGS_CAVEAT_TITLE, FILE_FINDINGS_SUBTITLE, FILE_FINDINGS_TITLE, FILE_NO_FINDINGS,
  FINDING_META, FINDING_STATUS_LABEL, SEVERITY_TEXT,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import Callout from '../../kit/Callout.vue';

const props = defineProps<{ findings: readonly FileFinding[]; count: MetricValue; statuses: ReadonlyMap<string, QualityFinding> }>();
const emit = defineEmits<{ review: [fingerprint: string] }>();
```

    with:

```ts
// Part 6 Y36: three states, never confused: Not analysed (no report attached), analysed with
// no finding for this file (not the same as zero complexity, S15), and the reported
// findings. The EvidenceBadge heads the panel whenever a report is attached.
import { formatMetric, type MetricValue } from '../../evidence';
import type { EvidenceIndexState } from '../../read-models/evidence-index';
import type { FileFinding } from '../../read-models/file-detail';
import { severityTone, type FindingStatus, type QualityFinding } from '../../read-models/findings';
import {
  FILE_FINDINGS_CAVEAT, FILE_FINDINGS_CAVEAT_TITLE, FILE_FINDINGS_SUBTITLE, FILE_FINDINGS_TITLE, FILE_NO_FINDINGS_REPORTED,
  FINDING_META, FINDING_STATUS_LABEL, SEVERITY_TEXT,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import Callout from '../../kit/Callout.vue';
import EvidenceBadge from '../../kit/EvidenceBadge.vue';
import NotAnalysed from '../../kit/NotAnalysed.vue';

const props = defineProps<{
  findings: readonly FileFinding[]; count: MetricValue; statuses: ReadonlyMap<string, QualityFinding>;
  evidence: EvidenceIndexState; version: string;
}>();
const emit = defineEmits<{ review: [fingerprint: string]; import: [] }>();
```

  - Replace:

```vue
  <Panel
    :title="FILE_FINDINGS_TITLE"
    :subtitle="FILE_FINDINGS_SUBTITLE(formatMetric(count))"
  >
    <ul
      v-if="findings.length"
      class="ci-findings"
    >
```

    with:

```vue
  <Panel
    :title="FILE_FINDINGS_TITLE"
    :subtitle="evidence === 'none' ? undefined : FILE_FINDINGS_SUBTITLE(formatMetric(count))"
  >
    <template
      v-if="evidence !== 'none'"
      #actions
    >
      <EvidenceBadge
        :version="version"
        :state="evidence === 'stale' ? 'stale' : 'imported'"
      />
    </template>
    <NotAnalysed
      v-if="evidence === 'none'"
      @import="emit('import')"
    />
    <ul
      v-else-if="findings.length"
      class="ci-findings"
    >
```

  - Replace `            {{ FINDING_META(f.line) }}` with `            {{ FINDING_META(f.line, f.endLine, f.rule) }}`.
  - Replace:

```vue
    <p
      v-else
      class="ci-note"
    >
      {{ FILE_NO_FINDINGS }}
    </p>
```

    with:

```vue
    <p
      v-else
      class="ci-note ci-file-findings__none"
    >
      {{ FILE_NO_FINDINGS_REPORTED }}
    </p>
```

  In `src/ui/screens/FileDetailScreen.vue` (today's text; Task 8 does not touch it):
  - Replace:

```ts
import { useCityStore } from '../stores/city-store';
import { useReviewStore } from '../stores/review-store';
```

    with:

```ts
import { useCityStore } from '../stores/city-store';
import { useEvidenceStore } from '../stores/evidence-store';
import { useReviewStore } from '../stores/review-store';
```

  - Replace `const { fileDetail, quality } = useReadModels();` with the two lines `const { fileDetail, quality } = useReadModels();` and `const evidenceStore = useEvidenceStore();`.
  - Replace:

```ts
  } catch {
    liveMessage.value = ADD_TO_PLAN_FAILED;
  }
}
</script>
```

    with:

```ts
  } catch {
    liveMessage.value = ADD_TO_PLAN_FAILED;
  }
}

/** Part 6 Y36/Y39: the S14 dialog lives on Data & scans. Go there and ask for it, as the
 *  "Import analysis report" command does. */
function importReport(): void {
  store.navigate('sources');
  evidenceStore.requestImport();
}
</script>
```

  - Replace:

```vue
        <FileFindingsPanel
          :findings="fileDetail.findings"
          :count="fileDetail.findingsCount"
          :statuses="quality.byFingerprint"
          @review="reviewing = $event"
        />
```

    with:

```vue
        <FileFindingsPanel
          :findings="fileDetail.findings"
          :count="fileDetail.findingsCount"
          :statuses="quality.byFingerprint"
          :evidence="quality.evidence.state"
          :version="quality.evidence.report?.providerVersion ?? ''"
          @review="reviewing = $event"
          @import="importReport"
        />
```

  `quality.evidence` is the same index that `fileDetail` is built from (Task 8's `use-read-models`), so the panel's state always agrees with its findings.

- [ ] **Step 11: CSS.** Append to `src/ui/styles/kit.css`:

```css

/* Part 6 Y32 (C13): EvidenceBadge, text first; the stale state is in its words too. */
:where(.codebase-inspector-root) .ci-evidence-badge {
  display: inline-flex; align-items: center; padding: 1px var(--ci-space-2);
  border: 1px solid var(--ci-border); border-radius: var(--ci-radius-small);
  color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); overflow-wrap: anywhere;
}
:where(.codebase-inspector-root) .ci-evidence-badge--stale { border-color: var(--ci-warning); color: var(--ci-warning); }
/* Part 6 Y35: NotAnalysed, the kit's empty state with its one action. */
:where(.codebase-inspector-root) .ci-not-analysed { padding: var(--ci-space-4) 0; }
:where(.codebase-inspector-root) .ci-not-analysed .ci-note { margin: 0; }
```

  Append to `src/ui/styles/screens-audit.css`:

```css

/* Part 6 Task 9: the report's badge over the Code quality cards. */
:where(.codebase-inspector-root) .ci-quality__evidence { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ci-space-2); }
```

  The severity classes belong to Task 8 (R6). `ci-file-findings__none` is an unstyled hook, and `.ci-note` styles it. There is no aria-disabled rule anywhere (E54).

- [ ] **Step 12: Run and confirm it passes.** Run `npx vitest run tests/component/kit-evidence.test.ts tests/unit/finding-copy.test.ts tests/component/quality-fallow.test.ts tests/component/file-findings-fallow.test.ts tests/component/quality-screen.test.ts tests/component/quality-dialog-status.test.ts tests/component/file-detail-screen.test.ts tests/unit/findings-model.test.ts tests/unit/file-detail-model.test.ts tests/unit/report-model.test.ts tests/unit/css-class-scope.test.ts tests/unit/kit-css-fallbacks.test.ts`. Expected: PASS.
  - Task 8's existing screen tests stay green unchanged: they attach a synthetic report before mounting, and a snapshot with no report now shows Not analysed where "No sample findings" used to be.
  - Then run the gate: `npm run typecheck && npm run lint:fast`.
  - Then lint the touched files: `npx eslint src/ui/kit/EvidenceBadge.vue src/ui/kit/NotAnalysed.vue src/ui/read-models/findings.ts src/ui/screens/QualityScreen.vue src/ui/screens/quality/FindingsTable.vue src/ui/screens/quality/FindingFilters.vue src/ui/screens/quality/FindingReviewDialog.vue src/ui/screens/file/FileFindingsPanel.vue src/ui/screens/FileDetailScreen.vue src/ui/audit-copy/quality.ts src/ui/audit-copy/fallow.ts src/ui/audit-copy/report.ts src/ui/inspector-copy.ts tests/component/kit-evidence.test.ts tests/unit/finding-copy.test.ts tests/component/quality-fallow.test.ts tests/component/file-findings-fallow.test.ts tests/unit/css-class-scope.test.ts --max-warnings 0`.
  - Then run the sweeps. This must print nothing: `git grep -n "v-html\|innerHTML\|FINDING_DIALOG_CONFIDENCE\|FILE_NO_FINDINGS\b\|Sample finding\|Illustrative\|FINDING_TITLE\[f\." -- src/ui`.
  - Report the line counts. Every `src` file stays under 400 and every test under 450.

- [ ] **Step 13: Commit.** Commit only this task's files:

```
feat(ui): EvidenceBadge, Not analysed, and fallow findings on Code quality and File detail (Y32, Y35, Y36)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 10: The Data & scans fallow card and the S14 dialog (Y31, Y37, Y38)

**Files:**
- Create:
  - `src/ui/screens/sources/ConnectFallowDialog.vue` (~180);
  - `src/ui/screens/sources/FallowCardDetails.vue` (~95);
  - `src/ui/screens/sources/FallowReportFacts.vue` (~105);
  - `src/ui/screens/sources/fallow-candidate.ts` (~55).
- Replace wholesale: `src/ui/screens/SourcesScreen.vue` (101 → ~190). Earlier tasks do not touch it.
- Modify:
  - `src/ui/screens/sources/ProviderGrid.vue` (73 → 75);
  - `src/ui/read-models/sources.ts` (89 → ~97).
- Modify copy:
  - `src/ui/audit-copy/sources.ts` (51 → 51);
  - `src/ui/audit-copy/fallow.ts` (+~52).
- Modify CSS: `src/ui/styles/screens-configure.css` (48 → ~70). If Task 4 appended to it, append after Task 4's lines.
- Test (new):
  - `tests/unit/fallow-candidate.test.ts` (~85);
  - `tests/component/connect-fallow.test.ts` (~305);
  - `tests/component/fallow-card.test.ts` (~195).
- Test (modify):
  - `tests/unit/sources-model.test.ts` (61 → ~70);
  - `tests/component/route-focus.test.ts` (92 → 92).
- There is no new fixture. The tests use `tests/fixtures/evidence-report.ts` (R5): `syntheticFallowJson`, `attachSyntheticReport` and `snapshotWithPaths`.

**Interfaces:**
- Consumes (R4: every fallow module is in `src/application/evidence/`):
  - **Task 5:**
    - `readFallowReportFile(file)` and `parseFallowReportText(text)`, from `read-fallow-report.ts`;
    - `RawFallowReport`, from `raw-fallow.ts`;
    - from `audit-copy/fallow.ts`: `FALLOW_IMPORT_ERROR: Readonly<Record<FallowImportErrorCode, (detail: string) => string>>` (its `source-mismatch` entry carries COPY-17) and `fallowNotShownLabel(key)`.
  - **Task 6:**
    - `buildEvidenceReport` (`normalize-fallow.ts`);
    - `resolveFindings` and `suggestStripPrefix` (`resolve-findings.ts`);
    - `EvidenceReport` and `FINDING_CATEGORIES` (`model.ts`);
    - `normalized.notShown` as `{ key, count }[]`;
    - `normalized.rejectedPaths`, which is NOT merged into `resolveFindings`' unmatched list.
  - **Task 7 (R7):** `useEvidenceStore()`:
    - `repositoryId`, `report` (a shallow ref), `importRequested`;
    - synchronous `attach(report): boolean` and `remove(): boolean`;
    - `consumeImportRequest(): boolean`;
    - `bindRepository(id)`, which drops a pending request.
  - **Task 8:**
    - `useReadModels().evidence` (`state`, `report`, `matchedFindings`, `matchedFiles`, `unmatchedPaths`) and `useReadModels().files`;
    - the types `EvidenceIndex` and `EvidenceIndexState`;
    - `COPY_16`;
    - the fixture.
  - **Task 9:** `EvidenceBadge.vue`, `FALLOW_IMPORT_ACTION`, `FINDING_KIND_LABEL`.
  - **Existing:** `CiDialog`, `useBusyAction`, `reannounce`, `useUniqueId`, `formatAbsoluteTime`.
- Produces:
  - **`ConnectFallowDialog.vue`:** no props; emits `close: []` and `done: [message: string]`. It has two root nodes: the `CiDialog`, and the hidden `<input type="file" class="ci-connect-fallow__file">` beside it (not inside `.ci-dialog`).
  - **`FallowCardDetails.vue`:** props `{ index: EvidenceIndex; hasSnapshot: boolean }`; emits `import: []` and `remove: []`.
  - **`FallowReportFacts.vue`:** props `{ report: EvidenceReport; matchedFindings: number; matchedFiles: number; unmatchedPaths: readonly string[]; showImportedAt?: boolean }`.
  - **`fallow-candidate.ts`:**
    - `UNMATCHED_SHOWN = 20`;
    - `interface FallowCandidate { raw; fileName; importedAt; snapshotId }`;
    - `unmatchedOf(unmatched, report): string[]`;
    - `reviewFallowCandidate(c, snapshotPaths, mapped)`, which returns `{ report; matchedFindings; matchedFiles; unmatchedPaths; suggestion: string | null; mismatch: boolean }`.
  - **`buildSourcesModel(snapshot, run, fallow = { state: 'none', version: null })`:** the `static` card becomes `fallow`, with state `unknown`, `collected` or `stale`.
  - **`ProviderGrid`** gains one optional named slot per card: `card-<provider id>`.
  - **Classes:**
    - `ci-sources__live`;
    - `ci-fallow-card` (+ `__none`, `__hint`, `__stale`, `__actions`, `__import`, `__remove`);
    - `ci-fallow-facts` (+ `__file`, `__matched`, `__unmatched`, `__not-shown`, `__warnings`, `__list`);
    - `ci-connect-fallow` (+ `__eyebrow`, `__disclosure`, `__mapping`, `__replace`, `__error`, `__actions`, `__cancel`, `__choose`, `__attach`, `__file`);
    - `ci-fallow-remove` (+ `__actions`, `__cancel`, `__confirm`).
  - **Copy in `audit-copy/fallow.ts`:** the texts are in Step 3.

**What the tests rely on.** On a 10-file, 2-directory snapshot, `syntheticFallowJson(snap)` gives 19 findings in 10 files, and its `workspace_diagnostics` is empty unless `warning` is set. The rest of the setup:
- **Unmatched paths:** `unmatchedPaths` adds one unused export per path, which never matches.
- **Warning:** `warning` adds one diagnostic, verbatim.
- **Prefixed paths:** `snapshotWithPaths(paths.map((p) => 'app/' + p))`, fed to `syntheticFallowJson`, gives a report whose every path carries `app/`. That is the mapping case.
- **Attached report:** `attachSyntheticReport(snap)` sets a fresh `InMemoryEvidenceStore`, binds the store to the snapshot's codebase and attaches `synthetic-fallow.json`.
- **Store without a report:** tests that attach nothing call `useEvidenceStore().setRepository(new InMemoryEvidenceStore())` in `beforeEach`. The store has no default repository (R7).

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/fallow-candidate.test.ts`:

```ts
// Part 6 Y26/Y38: what the S14 review step shows for a parsed report, resolved against the
// snapshot on screen — matches, unmatched and refused paths, the mapping offer, mismatch.
import { describe, expect, it } from 'vitest';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { UNMATCHED_SHOWN, reviewFallowCandidate, type FallowCandidate } from '../../src/ui/screens/sources/fallow-candidate';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { snapshotWithPaths, syntheticFallowJson, type SyntheticFallowOptions } from '../fixtures/evidence-report';

const snap = buildSnapshotFixture({ files: 10, directories: 2 });
const filePaths = snap.entities.filter((e) => e.kind === 'file').map((e) => e.path);
const paths: ReadonlySet<string> = new Set(filePaths);
function candidate(source: CodebaseSnapshot, o: SyntheticFallowOptions = {}): FallowCandidate {
  const read = parseFallowReportText(syntheticFallowJson(source, o));
  if (!read.ok) throw new Error(`${read.code}: ${read.detail}`);
  return { raw: read.report, fileName: 'r.json', importedAt: '2026-09-23T08:30:00.000Z', snapshotId: snap.snapshotId };
}

describe('reviewFallowCandidate (Part 6 Y26/Y38)', () => {
  it('matches every finding on the snapshot\'s own paths', () => {
    const r = reviewFallowCandidate(candidate(snap), paths, false);
    expect(r).toMatchObject({ matchedFindings: 19, matchedFiles: 10, unmatchedPaths: [], suggestion: null, mismatch: false });
    expect(r.report.stripPrefix).toBeNull();
  });

  it('lists unmatched paths distinct and sorted, and offers no mapping that would not match', () => {
    const r = reviewFallowCandidate(candidate(snap, { unmatchedPaths: ['ghost/b.ts', 'ghost/a.ts', 'ghost/a.ts'] }), paths, false);
    expect(r.unmatchedPaths).toEqual(['ghost/a.ts', 'ghost/b.ts']);
    expect(r).toMatchObject({ matchedFindings: 19, suggestion: null, mismatch: false });
  });

  it('offers the leading folder and applies it only when asked (Y26)', () => {
    const c = candidate(snapshotWithPaths(filePaths.map((p) => `app/${p}`)));
    const plain = reviewFallowCandidate(c, paths, false);
    expect(plain).toMatchObject({ matchedFindings: 0, suggestion: 'app/', mismatch: false });
    expect(plain.unmatchedPaths).toHaveLength(10);
    expect(plain.report.stripPrefix).toBeNull();
    const mapped = reviewFallowCandidate(c, paths, true);
    expect(mapped).toMatchObject({ matchedFindings: 19, matchedFiles: 10, unmatchedPaths: [], suggestion: 'app/' });
    expect(mapped.report.stripPrefix).toBe('app/');
  });

  it('is a source mismatch when the report has findings and none match, even with a mapping (COPY-17)', () => {
    const r = reviewFallowCandidate(candidate(snapshotWithPaths(['elsewhere/a.ts', 'elsewhere/b.ts'])), paths, false);
    expect(r).toMatchObject({ matchedFindings: 0, suggestion: null, mismatch: true });
  });

  it('is never a mismatch for a report with no findings at all', () => {
    expect(reviewFallowCandidate(candidate(snapshotWithPaths([])), paths, false)).toMatchObject({ matchedFindings: 0, mismatch: false });
  });

  it('lists a refused path (absolute, or with ..) as unmatched, never resolved', () => {
    const r = reviewFallowCandidate(candidate(snap, { unmatchedPaths: ['../outside.ts', '/abs/x.ts'] }), paths, false);
    expect(r.unmatchedPaths).toEqual(expect.arrayContaining(['../outside.ts', '/abs/x.ts']));
    expect(r.matchedFindings).toBe(19);
    expect(reviewFallowCandidate(candidate(snapshotWithPaths([]), { unmatchedPaths: ['../outside.ts'] }), paths, false).mismatch).toBe(true);
  });

  it('lists at most 20 unmatched paths on screen', () => {
    expect(UNMATCHED_SHOWN).toBe(20);
  });
});
```

  Create `tests/component/connect-fallow.test.ts`:

```ts
// Part 6 Y31/Y38 (S14): Connect fallow on Data & scans — the picker, the review step and
// its mapping offer, refusals, busy, a codebase switch, a late result, and report text
// rendered as text. Acceptance (4): a failed import keeps the attached evidence.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { formatAbsoluteTime } from '../../src/ui/copy';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import {
  FALLOW_ATTACHED, FALLOW_DIALOG_TITLE, FALLOW_DISCLOSURE, FALLOW_IMPORT_ERROR, FALLOW_MAPPING_OFFER, FALLOW_MATCHED,
  FALLOW_NOT_SHOWN_ITEM, FALLOW_REPLACE_NOTE, FALLOW_SNAPSHOT_FILES, FALLOW_UNMATCHED_SUMMARY, fallowNotShownLabel,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, snapshotWithPaths, syntheticFallowJson } from '../fixtures/evidence-report';

// oxlint consistent-function-scoping: a no-arg closure that captures nothing is hoisted.
const noop = (): void => {};
const mountS = () => mount(SourcesScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() } },
});
function withSnapshot(repositoryId = 'repo-a'): CodebaseSnapshot {
  const snap = buildSnapshotFixture({ files: 10, directories: 2, repositoryId });
  useCityStore().setCity(snap, computeLayout(snap));
  useEvidenceStore().bindRepository(repositoryId);
  return snap;
}
const filePaths = (snap: CodebaseSnapshot): string[] => snap.entities.filter((e) => e.kind === 'file').map((e) => e.path);
async function openDialog(w: VueWrapper): Promise<void> {
  await w.find('.ci-fallow-card__import').trigger('click');
  await flushPromises();
}
/** What a real pick does: `files` is set on the dialog's own input, then `change` fires. */
async function setFile(w: VueWrapper, file: File): Promise<void> {
  const input = w.find('.ci-connect-fallow__file');
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
  await input.trigger('change');
}
async function pick(w: VueWrapper, text: string, name = 'fallow-report.json'): Promise<void> {
  await setFile(w, new File([text], name, { type: 'application/json' }));
  await flushPromises();
}
/** A file whose `.text()` does not resolve until `release()` (the Part 5 E19a pattern). */
function slowFile(text: string): { file: File; release: () => void } {
  let release: () => void = noop;
  const gate = new Promise<void>((r) => { release = r; });
  const file = new File([text], 'slow.json', { type: 'application/json' });
  const read = file.text.bind(file);
  file.text = async () => { await gate; return read(); };
  return { file, release };
}
/** The synthetic report with two reported-but-not-shown sections (Y25). */
function withNotShown(text: string): string {
  const doc = JSON.parse(text) as { check: { summary: Record<string, number> } };
  doc.check.summary.unused_files = 3;
  doc.check.summary.circular_dependencies = 2;
  return JSON.stringify(doc);
}

describe('Connect fallow (Part 6 Y38, S14)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useEvidenceStore().setRepository(new InMemoryEvidenceStore());
    useCityStore().navigate('sources');
  });

  it('opens from the fallow card with the intro, the disclosure and the snapshot size; Choose clicks the dialog\'s own input', async () => {
    withSnapshot();
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(noop);
    const w = mountS();
    await openDialog(w);
    const dialog = w.find('[role="dialog"]');
    expect(dialog.attributes('aria-label')).toBe(FALLOW_DIALOG_TITLE);
    expect(dialog.text()).toContain(FALLOW_DISCLOSURE);
    expect(dialog.text()).toContain(FALLOW_SNAPSHOT_FILES(10));
    expect(w.find('.ci-connect-fallow__file').attributes()).toMatchObject({ type: 'file', accept: '.json,application/json', tabindex: '-1', 'aria-hidden': 'true' });
    expect(dialog.find('.ci-connect-fallow__file').exists()).toBe(false);   // outside the focus trap
    await w.find('.ci-connect-fallow__choose').trigger('click');
    expect(click).toHaveBeenCalledTimes(1);
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    expect(useEvidenceStore().report).toBeNull();
    w.unmount();
    click.mockRestore();
  });

  it('refuses each broken file with one alert for its code, and a new pick replaces it (Y31)', async () => {
    withSnapshot();
    const w = mountS();
    await openDialog(w);
    const texts = ['{', JSON.stringify({ kind: 'health', schema_version: 99, version: '3.27.0' }), JSON.stringify({ kind: 'combined', schema_version: 12 })];
    for (const text of texts) {
      await pick(w, text);
      const read = parseFallowReportText(text);
      if (read.ok) throw new Error('expected a refusal');
      const alerts = w.findAll('.ci-connect-fallow__error');
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.attributes('role')).toBe('alert');
      expect(alerts[0]!.text()).toBe(FALLOW_IMPORT_ERROR[read.code](read.detail));
      expect(w.find('.ci-connect-fallow__choose').exists()).toBe(true);
    }
    w.unmount();
  });

  it('refuses a report none of whose findings match this snapshot as a source mismatch (COPY-17)', async () => {
    withSnapshot();
    const w = mountS();
    await openDialog(w);
    await pick(w, syntheticFallowJson(snapshotWithPaths(['elsewhere/a.ts', 'elsewhere/b.ts'])));
    expect(w.find('.ci-connect-fallow__error').text()).toBe(FALLOW_IMPORT_ERROR['source-mismatch'](''));
    expect(w.find('.ci-connect-fallow__attach').exists()).toBe(false);
    w.unmount();
  });

  it('reviews a valid report: counts, the first 20 unmatched paths, the sections not shown; Cancel attaches nothing', async () => {
    const snap = withSnapshot();
    const strays = Array.from({ length: 25 }, (_, i) => `ghost/s${String(i).padStart(2, '0')}.ts`);
    const w = mountS();
    await openDialog(w);
    await pick(w, withNotShown(syntheticFallowJson(snap, { unmatchedPaths: strays })));
    expect(document.activeElement).toBe(w.find('.ci-connect-fallow h3').element);
    expect(w.find('.ci-fallow-facts__file').text()).toBe('fallow-report.json');
    expect(w.find('.ci-fallow-facts__matched').text()).toBe(FALLOW_MATCHED(19, 10));
    expect(w.find('.ci-fallow-facts__unmatched summary').text()).toBe(FALLOW_UNMATCHED_SUMMARY(25, 20));
    expect(w.findAll('.ci-fallow-facts__unmatched li').map((li) => li.text())).toEqual(strays.slice(0, 20));
    expect(w.findAll('.ci-fallow-facts__not-shown li').map((li) => li.text())).toEqual([
      FALLOW_NOT_SHOWN_ITEM(fallowNotShownLabel('unused_files'), 3),
      FALLOW_NOT_SHOWN_ITEM(fallowNotShownLabel('circular_dependencies'), 2),
    ]);
    expect(w.find('.ci-connect-fallow__mapping').exists()).toBe(false);
    expect(w.find('.ci-connect-fallow__replace').exists()).toBe(false);
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    expect(useEvidenceStore().report).toBeNull();
    w.unmount();
  });

  it('offers the leading-folder mapping unchecked, and applies it only when checked (Y26)', async () => {
    const snap = withSnapshot();
    const w = mountS();
    await openDialog(w);
    await pick(w, syntheticFallowJson(snapshotWithPaths(filePaths(snap).map((p) => `app/${p}`))));
    const box = w.find<HTMLInputElement>('.ci-connect-fallow__mapping input[type="checkbox"]');
    expect(box.element.checked).toBe(false);
    expect(w.find('.ci-connect-fallow__mapping label').text()).toBe(FALLOW_MAPPING_OFFER('app/'));
    expect(w.find('.ci-fallow-facts__matched').text()).toBe(FALLOW_MATCHED(0, 0));
    await box.setValue(true);
    expect(w.find('.ci-fallow-facts__matched').text()).toBe(FALLOW_MATCHED(19, 10));
    await w.find('.ci-connect-fallow__attach').trigger('click');
    await flushPromises();
    expect(useEvidenceStore().report?.stripPrefix).toBe('app/');
    w.unmount();
  });

  it('Attach closes, announces in the Data & scans live region, and a second import notes the replacement', async () => {
    const snap = withSnapshot();
    const w = mountS();
    await openDialog(w);
    await pick(w, syntheticFallowJson(snap));
    await w.find('.ci-connect-fallow__attach').trigger('click');
    await flushPromises();
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    expect(useEvidenceStore().report?.fileName).toBe('fallow-report.json');
    const message = FALLOW_ATTACHED(19, 10);
    expect(w.find('.ci-sources__live').text()).toBe(message);

    const first = useEvidenceStore().report!;
    await openDialog(w);
    await pick(w, syntheticFallowJson(snap), 'second.json');
    expect(w.find('.ci-connect-fallow__replace').text()).toBe(FALLOW_REPLACE_NOTE(formatAbsoluteTime(first.importedAt, Intl)));
    const live = w.find('.ci-sources__live').element;
    const seen: string[] = [];
    const observer = new MutationObserver(() => { seen.push((live.textContent ?? '').trim()); });
    observer.observe(live, { childList: true, characterData: true, subtree: true });
    await w.find('.ci-connect-fallow__attach').trigger('click');
    await flushPromises();
    observer.disconnect();
    expect(seen).toContain('');
    expect(seen[seen.length - 1]).toBe(message);
    expect(useEvidenceStore().report?.fileName).toBe('second.json');
    w.unmount();
  });

  it('ignores Choose, Cancel and Escape while a slow read is in flight (Part 4 E13)', async () => {
    const snap = withSnapshot();
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(noop);
    const w = mountS();
    await openDialog(w);
    const { file, release } = slowFile(syntheticFallowJson(snap));
    await setFile(w, file);
    expect(w.find('.ci-connect-fallow__choose').attributes('aria-disabled')).toBe('true');
    expect(w.find('.ci-connect-fallow__cancel').attributes('aria-disabled')).toBe('true');
    await w.find('.ci-connect-fallow__choose').trigger('click');
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    await w.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    expect(w.find('.ci-connect-fallow').exists()).toBe(true);
    expect(click).not.toHaveBeenCalled();
    release();
    await flushPromises();
    expect(w.find('.ci-connect-fallow__attach').exists()).toBe(true);
    expect(w.find('.ci-connect-fallow__cancel').attributes('aria-disabled')).toBeUndefined();
    w.unmount();
    click.mockRestore();
  });

  it('closes without attaching when the codebase changes, and drops the late result (Part 4 E8/E11)', async () => {
    const snap = withSnapshot('repo-a');
    const w = mountS();
    await openDialog(w);
    const { file, release } = slowFile(syntheticFallowJson(snap));
    await setFile(w, file);
    withSnapshot('repo-b');
    await flushPromises();
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    release();
    await flushPromises();
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    expect(w.find('.ci-connect-fallow__error').exists()).toBe(false);
    expect(w.find('.ci-sources__live').text()).toBe('');
    expect(useEvidenceStore().report).toBeNull();
    withSnapshot('repo-a');
    expect(useEvidenceStore().report).toBeNull();
    w.unmount();
  });

  it('acceptance (4): a failed import leaves the attached evidence exactly as it was (Y31)', async () => {
    const snap = withSnapshot();
    const kept = attachSyntheticReport(snap);
    const w = mountS();
    await openDialog(w);
    await pick(w, '{');
    expect(w.find('.ci-connect-fallow__error').text()).toBe(FALLOW_IMPORT_ERROR['not-json'](''));
    await pick(w, syntheticFallowJson(snapshotWithPaths(['elsewhere/a.ts'])));
    expect(w.find('.ci-connect-fallow__error').text()).toBe(FALLOW_IMPORT_ERROR['source-mismatch'](''));
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    expect(useEvidenceStore().report).toBe(kept);
    expect(w.find('.ci-fallow-card .ci-fallow-facts__file').text()).toBe(kept.fileName);
    w.unmount();
  });

  it('renders a report\'s file name and warning as literal text, in the review and on the card (spec §4)', async () => {
    const snap = withSnapshot();
    const evil = '<img src=x onerror=alert(1)>';
    const w = mountS();
    await openDialog(w);
    await pick(w, syntheticFallowJson(snap, { warning: evil }), evil);
    expect(w.find('.ci-connect-fallow .ci-fallow-facts__file').text()).toBe(evil);
    expect(w.find('.ci-connect-fallow .ci-fallow-facts__warnings').text()).toBe(evil);
    expect(w.find('.ci-connect-fallow img').exists()).toBe(false);
    await w.find('.ci-connect-fallow__attach').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-card .ci-fallow-facts__file').text()).toBe(evil);
    expect(w.find('.ci-fallow-card .ci-fallow-facts__warnings').text()).toBe(evil);
    expect(w.find('.ci-fallow-card img').exists()).toBe(false);
    expect(w.find('.ci-fallow-card').html()).toContain('&lt;img');
    w.unmount();
  });
});
```

  Create `tests/component/fallow-card.test.ts`:

```ts
// Part 6 Y31/Y37/Y39: the fallow card on Data & scans — its state, its diagnostics, the
// Remove confirmation, and the import request from the command or Not analysed.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { formatAbsoluteTime } from '../../src/ui/copy';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import {
  COPY_16, EVIDENCE_BADGE, FALLOW_CARD_NONE, FALLOW_CATEGORY_LINE, FALLOW_IMPORT_HINT, FALLOW_MATCHED, FALLOW_REMOVE_TITLE,
  FALLOW_REMOVED, FALLOW_ROW_CATEGORIES, FALLOW_ROW_FILE, FALLOW_ROW_IMPORTED, FALLOW_ROW_MATCHED, FALLOW_ROW_NOT_SHOWN,
  FALLOW_ROW_REPORT, FALLOW_ROW_UNMATCHED, FALLOW_ROW_WARNINGS, FINDING_KIND_LABEL,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { SYNTHETIC_VERSION, attachSyntheticReport } from '../fixtures/evidence-report';

const mountS = () => mount(SourcesScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() } },
});
function withSnapshot(repositoryId = 'repo-a'): CodebaseSnapshot {
  const snap = buildSnapshotFixture({ files: 10, directories: 2, repositoryId });
  useCityStore().setCity(snap, computeLayout(snap));
  useEvidenceStore().bindRepository(repositoryId);
  return snap;
}
function fresh(): void {
  setActivePinia(createPinia());
  useEvidenceStore().setRepository(new InMemoryEvidenceStore());
  useCityStore().navigate('sources');
}

describe('the fallow card (Part 6 Y37)', () => {
  beforeEach(fresh);

  it('replaces the static card: Unknown and "No report" without one; Import needs a snapshot, Remove needs a report', async () => {
    const w = mountS();
    expect(w.find('.ci-provider--static').exists()).toBe(false);
    const card = w.find('.ci-provider--fallow');
    expect(card.find('.ci-provenance--unknown').exists()).toBe(true);
    expect(card.find('.ci-fallow-card__none').text()).toBe(FALLOW_CARD_NONE);
    const importButton = card.find('.ci-fallow-card__import');
    expect(importButton.attributes('aria-disabled')).toBe('true');
    expect(importButton.attributes('aria-describedby')).toBe(card.find('.ci-fallow-card__hint').attributes('id'));
    expect(card.find('.ci-fallow-card__hint').text()).toBe(FALLOW_IMPORT_HINT);
    await importButton.trigger('click');
    const remove = card.find('.ci-fallow-card__remove');
    expect(remove.attributes('aria-disabled')).toBe('true');
    await remove.trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    withSnapshot();
    await nextTick();
    expect(w.find('.ci-fallow-card__import').attributes('aria-disabled')).toBeUndefined();
    expect(w.find('.ci-fallow-card__import').attributes('aria-describedby')).toBeUndefined();
    w.unmount();
  });

  it('with a report: the badge and the diagnostics, every row labelled', () => {
    const snap = withSnapshot();
    const report = attachSyntheticReport(snap, { unmatchedPaths: ['ghost/a.ts'], warning: 'node_modules is missing' });
    const w = mountS();
    const card = w.find('.ci-provider--fallow');
    expect(card.find('.ci-provenance').exists()).toBe(false);
    expect(card.find('.ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'imported'));
    expect(card.findAll('.ci-fallow-facts dt').map((dt) => dt.text())).toEqual([
      FALLOW_ROW_REPORT, FALLOW_ROW_FILE, FALLOW_ROW_IMPORTED, FALLOW_ROW_CATEGORIES, FALLOW_ROW_MATCHED, FALLOW_ROW_UNMATCHED,
      FALLOW_ROW_NOT_SHOWN, FALLOW_ROW_WARNINGS,
    ]);
    expect(card.find('.ci-fallow-facts__file').text()).toBe(report.fileName);
    expect(card.text()).toContain(formatAbsoluteTime(report.importedAt, Intl));
    expect(card.find('.ci-fallow-facts__matched').text()).toBe(FALLOW_MATCHED(19, 10));
    expect(card.findAll('.ci-fallow-facts__unmatched li').map((li) => li.text())).toEqual(['ghost/a.ts']);
    expect(card.find('.ci-fallow-facts__warnings').text()).toBe('node_modules is missing');
    expect(card.find('.ci-fallow-card__remove').attributes('aria-disabled')).toBeUndefined();
    w.unmount();
  });

  it('a dead-code report reads complexity and duplication as Not analysed, never zero (Y25)', () => {
    attachSyntheticReport(withSnapshot(), { kind: 'dead-code' });
    const w = mountS();
    const lines = w.findAll('.ci-fallow-card .ci-fallow-facts dd:nth-of-type(4) li').map((li) => li.text());
    expect(lines).toEqual([
      FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL.complexity, 'not-analysed'),
      FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL.duplication, 'not-analysed'),
      FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL['unused-exports'], 'analysed'),
    ]);
    w.unmount();
  });

  it('stale evidence: the card, its badge and COPY-16 say so (Y30)', () => {
    const report = attachSyntheticReport(withSnapshot(), { snapshotId: 'snapshot-older' });
    const w = mountS();
    const card = w.find('.ci-provider--fallow');
    expect(card.find('.ci-provenance--stale').exists()).toBe(true);
    expect(card.find('.ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'stale'));
    expect(card.find('.ci-fallow-card__stale').text()).toBe(COPY_16(formatAbsoluteTime(report.importedAt, Intl)));
    w.unmount();
  });

  it('Remove report asks first; Cancel keeps it; confirming removes it and announces a real outcome (Y31)', async () => {
    const report = attachSyntheticReport(withSnapshot());
    const w = mountS();
    await w.find('.ci-fallow-card__remove').trigger('click');
    expect(w.find('[role="dialog"]').attributes('aria-label')).toBe(FALLOW_REMOVE_TITLE);
    await w.find('.ci-fallow-remove__cancel').trigger('click');
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    expect(useEvidenceStore().report).toBe(report);
    expect(w.find('.ci-sources__live').text()).toBe('');
    await w.find('.ci-fallow-card__remove').trigger('click');
    await w.find('.ci-fallow-remove__confirm').trigger('click');
    await flushPromises();
    expect(useEvidenceStore().report).toBeNull();
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_REMOVED);
    expect(w.find('.ci-fallow-card__none').text()).toBe(FALLOW_CARD_NONE);
    expect(w.find('.ci-fallow-card__remove').attributes('aria-disabled')).toBe('true');
    w.unmount();
  });

  it('a codebase switch closes the Remove confirmation without removing anything', async () => {
    const report = attachSyntheticReport(withSnapshot('repo-a'));
    const w = mountS();
    await w.find('.ci-fallow-card__remove').trigger('click');
    withSnapshot('repo-b');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    withSnapshot('repo-a');
    expect(useEvidenceStore().report).toBe(report);
    w.unmount();
  });
});

describe('the import request (Part 6 Y39)', () => {
  beforeEach(fresh);

  it('opens the dialog once, whether the request came before the screen mounted or while it is on screen', async () => {
    withSnapshot();
    const evidence = useEvidenceStore();
    evidence.requestImport();
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-connect-fallow').exists()).toBe(true);
    expect(evidence.importRequested).toBe(false);
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    evidence.requestImport();
    await flushPromises();
    expect(w.find('.ci-connect-fallow').exists()).toBe(true);
    expect(evidence.importRequested).toBe(false);
    w.unmount();
  });

  it('with no snapshot, consumes the request and opens nothing', async () => {
    const evidence = useEvidenceStore();
    const w = mountS();
    evidence.requestImport();
    await flushPromises();
    expect(evidence.importRequested).toBe(false);
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    w.unmount();
  });
});
```

  Update `tests/unit/sources-model.test.ts`:
  - Replace `import { buildSourcesModel, formatBytes, runView } from '../../src/ui/read-models/sources';` with the two lines `import { buildSourcesModel, formatBytes, runView } from '../../src/ui/read-models/sources';` and `import { EVIDENCE_SOURCE_NONE, FALLOW_SOURCE } from '../../src/ui/inspector-copy';`.
  - Replace `  it('labels every non-inventory provider as sample or unknown, never collected', () => {` with `  it('labels every non-inventory provider as sample or unknown, never collected, while no report is imported', () => {`.
  - Replace `    expect(m.providers.filter((p) => p.state === 'unknown').map((p) => p.id)).toEqual(['secrets', 'runtime']);` with `    expect(m.providers.filter((p) => p.state === 'unknown').map((p) => p.id)).toEqual(['fallow', 'secrets', 'runtime']);`.
  - Replace:

```ts
  it('formats byte limits', () => {
```

    with:

```ts
  it('Part 6 Y37: the fallow card is Unknown without a report, Collected when imported, Stale when older than the snapshot', () => {
    const snap = buildSnapshotFixture({ files: 3 });
    const card = (fallow?: Parameters<typeof buildSourcesModel>[2]) => buildSourcesModel(snap, IDLE, fallow).providers.find((p) => p.id === 'fallow')!;
    expect(card()).toMatchObject({ state: 'unknown', source: EVIDENCE_SOURCE_NONE, title: 'fallow findings', routes: ['quality', 'file'] });
    expect(card({ state: 'current', version: '3.27.0' })).toMatchObject({ state: 'collected', source: FALLOW_SOURCE('3.27.0') });
    expect(card({ state: 'stale', version: '3.21.0' })).toMatchObject({ state: 'stale', source: FALLOW_SOURCE('3.21.0') });
  });
  it('formats byte limits', () => {
```

  In `tests/component/route-focus.test.ts`, replace `trigger: '.ci-provider--static .ci-provider__route'` with `trigger: '.ci-provider--fallow .ci-provider__route'`. The fallow card keeps the `quality` and `file` routes.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run tests/unit/fallow-candidate.test.ts tests/component/connect-fallow.test.ts tests/component/fallow-card.test.ts tests/unit/sources-model.test.ts tests/component/route-focus.test.ts`. Expected: FAIL.
  - `fallow-candidate` fails to resolve `src/ui/screens/sources/fallow-candidate.ts`.
  - `connect-fallow` and `fallow-card` fail because `.ci-fallow-card__import` and `.ci-provider--fallow` do not exist yet ("Cannot call trigger on an empty DOMWrapper"), and the copy (`FALLOW_ATTACHED` and the rest) is undefined.
  - `sources-model` fails: the unknown ids are `['secrets', 'runtime']`, there is no `fallow` card, and `FALLOW_SOURCE` is undefined.
  - `route-focus` fails its File detail case: there is no `.ci-provider--fallow` button yet.

- [ ] **Step 3: Copy.** In `src/ui/audit-copy/sources.ts`:
  - Replace `export const SOURCES_CALLOUT = 'One real provider is connected: the built-in read-only inventory. Every other signal is sample data or not collected.';` with `export const SOURCES_CALLOUT = 'The built-in read-only inventory is always available, and fallow findings come from a report you import. Every other signal is sample data or not collected.';`.
  - Replace `  static: { title: 'Static findings', description: 'Complexity, unused exports and duplication. Sample data seeded per file.' },` with `  fallow: { title: 'fallow findings', description: 'Complexity, duplication and unused exports from a fallow JSON report you import. Nothing is run or installed; the report is kept for this session only.' },`.
  - Replace `export const SOURCES_PLANNED = 'An external analyser may later be imported from a report or run as an already-installed tool, and only on your explicit request. Nothing is ever installed, and no integration is active today.';` with `export const SOURCES_PLANNED = 'Running an already-installed fallow from here comes in a later version, and only on your explicit request. Nothing is ever installed.';`.

  In `src/ui/audit-copy/fallow.ts`, append at the end, after Task 9's lines:

```ts

/* Part 6 Task 10 (Y31, Y37, Y38): the fallow card on Data & scans and the S14 dialog. */
const nounCount = (n: number, one: string, many: string): string => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
export const FALLOW_SOURCE = (version: string): string => `Imported report · fallow ${version}`;
export const FALLOW_CARD_NONE = 'No report attached. An imported report is kept for this session only, so after a restart it is imported again.';
export const FALLOW_IMPORT_HINT = 'Open a codebase first: report paths are matched to the codebase on screen.';
export const FALLOW_REMOVE = 'Remove report';
export const FALLOW_REMOVE_TITLE = 'Remove the fallow report?';
export const FALLOW_REMOVE_TEXT = 'Its findings leave every screen and read Not analysed. Your finding decisions are kept, and you can import the report again.';
export const FALLOW_REMOVE_CANCEL = 'Cancel';
export const FALLOW_REMOVED = 'fallow report removed. Findings read Not analysed.';
export const FALLOW_DIALOG_EYEBROW = 'Add evidence';
export const FALLOW_DIALOG_TITLE = 'Connect fallow';
export const FALLOW_DIALOG_INTRO = 'Keep exploring the structural city while you add analysis. Import a fallow JSON report: it is checked and matched to this snapshot, and no analyser is run.';
export const FALLOW_DISCLOSURE = 'The plugin does not download or install fallow. Imported reports cannot authorize commands or source access.';
export const FALLOW_SNAPSHOT_FILES = (n: number): string => `Current structural snapshot: ${nounCount(n, 'file', 'files')}`;
export const FALLOW_CHOOSE = 'Choose report…';
export const FALLOW_CANCEL = 'Cancel';
export const FALLOW_REVIEW_TITLE = 'Review the report';
export const FALLOW_ATTACH = 'Attach report';
export const FALLOW_MATCHED = (findings: number, files: number): string =>
  `${nounCount(findings, 'finding', 'findings')} in ${nounCount(files, 'file', 'files')}`;
export const FALLOW_ATTACHED = (findings: number, files: number): string => `fallow report attached: ${FALLOW_MATCHED(findings, files)}.`;
export const FALLOW_ATTACH_REFUSED = 'The report was not attached. Open the codebase again, then import the report.';
/** Y26: offered unchecked; nothing is mapped without the user's choice. */
export const FALLOW_MAPPING_OFFER = (prefix: string): string => `Match paths by removing the leading folder “${prefix}”`;
export const FALLOW_REPLACE_NOTE = (date: string): string => `Attaching replaces the report imported ${date}.`;
export const FALLOW_ROW_REPORT = 'Report';
export const FALLOW_ROW_FILE = 'File';
export const FALLOW_ROW_IMPORTED = 'Imported';
export const FALLOW_ROW_CATEGORIES = 'Categories';
export const FALLOW_ROW_MATCHED = 'Matched';
export const FALLOW_ROW_UNMATCHED = 'Unmatched paths';
export const FALLOW_ROW_NOT_SHOWN = 'Reported, not shown in this version';
export const FALLOW_ROW_WARNINGS = 'Warnings';
export const FALLOW_REPORT_VALUE = (version: string, kind: string, schema: number): string => `fallow ${version} · ${kind} report · schema ${schema}`;
export const FALLOW_CATEGORY_LINE = (label: string, state: 'analysed' | 'not-analysed'): string =>
  `${label}: ${state === 'analysed' ? 'Analysed' : 'Not analysed'}`;
export const FALLOW_UNMATCHED_SUMMARY = (total: number, shown: number): string =>
  `${nounCount(total, 'path', 'paths')} not in this snapshot${shown < total ? ` · the first ${shown} are listed` : ''}`;
/** Y25 (R4): `label` is fallowNotShownLabel(key). */
export const FALLOW_NOT_SHOWN_ITEM = (label: string, count: number): string => `${label}: ${count.toLocaleString('en-US')}`;
export const FALLOW_NONE = 'None';
```

  If an earlier task already declared a module-level helper named `nounCount` in `fallow.ts`, reuse it and drop this line.

- [ ] **Step 4: The pure review helper.** Create `src/ui/screens/sources/fallow-candidate.ts`:

```ts
// Part 6 Y26/Y38: what the S14 review step shows for a parsed report, resolved against the
// snapshot on screen. Pure: the dialog calls it again when the mapping checkbox changes,
// and nothing is applied until the user attaches.
import type { EvidenceReport } from '../../../application/evidence/model';
import { buildEvidenceReport } from '../../../application/evidence/normalize-fallow';
import type { RawFallowReport } from '../../../application/evidence/raw-fallow';
import { resolveFindings, suggestStripPrefix } from '../../../application/evidence/resolve-findings';

/** Y37/Y38: how many unmatched paths are listed; the count is always given. */
export const UNMATCHED_SHOWN = 20;

export interface FallowCandidate { raw: RawFallowReport; fileName: string; importedAt: string; snapshotId: string }
interface FallowReview {
  report: EvidenceReport;
  matchedFindings: number;
  matchedFiles: number;
  unmatchedPaths: readonly string[];
  /** The leading folder the mapping checkbox offers, or null (Y26). */
  suggestion: string | null;
  /** The report has findings and none match, even with the offered mapping (COPY-17). */
  mismatch: boolean;
}

/** Distinct and sorted: the paths the snapshot does not have, plus the paths
 *  normalizeRelativePath refused. Task 6 keeps those apart; Y26 treats them as unmatched. */
export function unmatchedOf(unmatched: readonly string[], report: EvidenceReport): string[] {
  return [...new Set([...unmatched, ...report.normalized.rejectedPaths])].sort((a, b) => a.localeCompare(b));
}

function resolveWith(c: FallowCandidate, snapshotPaths: ReadonlySet<string>, stripPrefix: string | null) {
  const report = buildEvidenceReport({ raw: c.raw, fileName: c.fileName, importedAt: c.importedAt, snapshotId: c.snapshotId, stripPrefix });
  return { report, ...resolveFindings(report.normalized.findings, snapshotPaths) };
}

export function reviewFallowCandidate(c: FallowCandidate, snapshotPaths: ReadonlySet<string>, mapped: boolean): FallowReview {
  const plain = resolveWith(c, snapshotPaths, null);
  const suggestion = plain.unmatchedPaths.length === 0 ? null : suggestStripPrefix(plain.unmatchedPaths, snapshotPaths);
  const withMapping = suggestion === null ? null : resolveWith(c, snapshotPaths, suggestion);
  const chosen = mapped && withMapping ? withMapping : plain;
  const reported = plain.report.normalized.findings.length > 0 || plain.report.normalized.rejectedPaths.length > 0;
  return {
    report: chosen.report,
    matchedFindings: chosen.matched.length,
    matchedFiles: new Set(chosen.matched.map((f) => f.path)).size,
    unmatchedPaths: unmatchedOf(chosen.unmatchedPaths, chosen.report),
    suggestion,
    mismatch: reported && plain.matched.length === 0 && (withMapping === null || withMapping.matched.length === 0),
  };
}
```

- [ ] **Step 5: The report facts, shared by the card and the review step.** Create `src/ui/screens/sources/FallowReportFacts.vue`:

```vue
<script setup lang="ts">
// Part 6 Y37/Y38: one report's facts, shared by the fallow card and the S14 review step.
// Every value from the report (file name, paths, section keys, warnings) is interpolated
// as text, never rendered as HTML (spec §4).
import { computed } from 'vue';
import { FINDING_CATEGORIES, type EvidenceReport } from '../../../application/evidence/model';
import { formatAbsoluteTime } from '../../copy';
import {
  FALLOW_CATEGORY_LINE, FALLOW_MATCHED, FALLOW_NONE, FALLOW_NOT_SHOWN_ITEM, FALLOW_REPORT_VALUE, FALLOW_ROW_CATEGORIES,
  FALLOW_ROW_FILE, FALLOW_ROW_IMPORTED, FALLOW_ROW_MATCHED, FALLOW_ROW_NOT_SHOWN, FALLOW_ROW_REPORT, FALLOW_ROW_UNMATCHED,
  FALLOW_ROW_WARNINGS, FALLOW_UNMATCHED_SUMMARY, FINDING_KIND_LABEL, fallowNotShownLabel,
} from '../../inspector-copy';
import { UNMATCHED_SHOWN } from './fallow-candidate';

const props = defineProps<{
  report: EvidenceReport; matchedFindings: number; matchedFiles: number; unmatchedPaths: readonly string[]; showImportedAt?: boolean;
}>();
const importedAt = computed(() => formatAbsoluteTime(props.report.importedAt, Intl));
const categories = computed(() => FINDING_CATEGORIES.map((c) => FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL[c], props.report.normalized.categories[c])));
const listed = computed(() => props.unmatchedPaths.slice(0, UNMATCHED_SHOWN));
/** Y25 (R4): fallow's own key, labelled here; an unknown key reads verbatim. */
const notShown = computed(() => props.report.normalized.notShown.map((s) => FALLOW_NOT_SHOWN_ITEM(fallowNotShownLabel(s.key), s.count)));
</script>

<template>
  <dl class="ci-fallow-facts">
    <dt>{{ FALLOW_ROW_REPORT }}</dt>
    <dd>{{ FALLOW_REPORT_VALUE(report.providerVersion, report.reportKind, report.schemaVersion) }}</dd>
    <dt>{{ FALLOW_ROW_FILE }}</dt>
    <dd class="ci-fallow-facts__file">
      {{ report.fileName }}
    </dd>
    <template v-if="showImportedAt">
      <dt>{{ FALLOW_ROW_IMPORTED }}</dt>
      <dd>{{ importedAt }}</dd>
    </template>
    <dt>{{ FALLOW_ROW_CATEGORIES }}</dt>
    <dd>
      <ul class="ci-fallow-facts__list">
        <li
          v-for="line in categories"
          :key="line"
        >
          {{ line }}
        </li>
      </ul>
    </dd>
    <dt>{{ FALLOW_ROW_MATCHED }}</dt>
    <dd class="ci-fallow-facts__matched">
      {{ FALLOW_MATCHED(matchedFindings, matchedFiles) }}
    </dd>
    <dt>{{ FALLOW_ROW_UNMATCHED }}</dt>
    <dd class="ci-fallow-facts__unmatched">
      <template v-if="unmatchedPaths.length === 0">
        {{ FALLOW_NONE }}
      </template>
      <details v-else>
        <summary>{{ FALLOW_UNMATCHED_SUMMARY(unmatchedPaths.length, listed.length) }}</summary>
        <ul class="ci-fallow-facts__list">
          <li
            v-for="path in listed"
            :key="path"
          >
            <code>{{ path }}</code>
          </li>
        </ul>
      </details>
    </dd>
    <dt>{{ FALLOW_ROW_NOT_SHOWN }}</dt>
    <dd class="ci-fallow-facts__not-shown">
      <template v-if="notShown.length === 0">
        {{ FALLOW_NONE }}
      </template>
      <ul
        v-else
        class="ci-fallow-facts__list"
      >
        <li
          v-for="line in notShown"
          :key="line"
        >
          {{ line }}
        </li>
      </ul>
    </dd>
    <dt>{{ FALLOW_ROW_WARNINGS }}</dt>
    <dd class="ci-fallow-facts__warnings">
      <template v-if="report.normalized.warnings.length === 0">
        {{ FALLOW_NONE }}
      </template>
      <ul
        v-else
        class="ci-fallow-facts__list"
      >
        <li
          v-for="(warning, i) in report.normalized.warnings"
          :key="i"
        >
          {{ warning }}
        </li>
      </ul>
    </dd>
  </dl>
</template>
```

- [ ] **Step 6: The card's details.** Create `src/ui/screens/sources/FallowCardDetails.vue`:

```vue
<script setup lang="ts">
// Part 6 Y31/Y37: the fallow card's state, diagnostics and actions. The card runs nothing:
// Import opens the S14 dialog, and Remove asks SourcesScreen to confirm first. Both stay
// focusable when blocked (aria-disabled plus a guarded handler, E40).
import { computed } from 'vue';
import { formatAbsoluteTime } from '../../copy';
import type { EvidenceIndex } from '../../read-models/evidence-index';
import { useUniqueId } from '../../unique-id';
import { COPY_16, FALLOW_CARD_NONE, FALLOW_IMPORT_ACTION, FALLOW_IMPORT_HINT, FALLOW_REMOVE } from '../../inspector-copy';
import EvidenceBadge from '../../kit/EvidenceBadge.vue';
import FallowReportFacts from './FallowReportFacts.vue';
import { unmatchedOf } from './fallow-candidate';

const props = defineProps<{ index: EvidenceIndex; hasSnapshot: boolean }>();
const emit = defineEmits<{ import: []; remove: [] }>();
const hintId = useUniqueId('ci-fallow-card-hint');
const report = computed(() => props.index.report);
const stale = computed(() => props.index.state === 'stale');
const unmatched = computed(() => (report.value ? unmatchedOf(props.index.unmatchedPaths, report.value) : []));
const staleNotice = computed(() => (report.value && stale.value ? COPY_16(formatAbsoluteTime(report.value.importedAt, Intl)) : ''));

/** Blocked without a snapshot: report paths are matched to the codebase on screen. */
function importReport(): void {
  if (props.hasSnapshot) emit('import');
}
/** Y31: aria-disabled while there is nothing to remove, and the press is refused then. */
function remove(): void {
  if (report.value) emit('remove');
}
</script>

<template>
  <div class="ci-fallow-card">
    <template v-if="report">
      <EvidenceBadge
        :version="report.providerVersion"
        :state="stale ? 'stale' : 'imported'"
      />
      <p
        v-if="staleNotice"
        class="ci-note ci-fallow-card__stale"
      >
        {{ staleNotice }}
      </p>
      <FallowReportFacts
        :report="report"
        :matched-findings="index.matchedFindings"
        :matched-files="index.matchedFiles"
        :unmatched-paths="unmatched"
        show-imported-at
      />
    </template>
    <p
      v-else
      class="ci-note ci-fallow-card__none"
    >
      {{ FALLOW_CARD_NONE }}
    </p>
    <p
      v-if="!hasSnapshot"
      :id="hintId"
      class="ci-note ci-fallow-card__hint"
    >
      {{ FALLOW_IMPORT_HINT }}
    </p>
    <div class="ci-fallow-card__actions">
      <button
        type="button"
        class="ci-fallow-card__import"
        :aria-disabled="hasSnapshot ? undefined : 'true'"
        :aria-describedby="hasSnapshot ? undefined : hintId"
        @click="importReport"
      >
        {{ FALLOW_IMPORT_ACTION }}
      </button>
      <button
        type="button"
        class="ci-fallow-card__remove"
        :aria-disabled="report ? undefined : 'true'"
        @click="remove"
      >
        {{ FALLOW_REMOVE }}
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 7: The S14 dialog.** Create `src/ui/screens/sources/ConnectFallowDialog.vue`:

```vue
<script setup lang="ts">
// Part 6 Y38 (S14): Connect fallow.
// - Step 1 picks a report through this component's own hidden file input. That is the only
//   file read. The input sits beside CiDialog's panel, not in it, because CiDialog's focus
//   selector includes `input:not([disabled])`: inside the panel it would break the Tab trap.
// - Step 2 reviews how the report matches the snapshot on screen, then attaches it through
//   the evidence store.
// Nothing is run or installed. A failure never touches the attached evidence (Y31), and
// report text is only ever interpolated.
import { computed, nextTick, ref, shallowRef } from 'vue';
import { readFallowReportFile } from '../../../application/evidence/read-fallow-report';
import { formatAbsoluteTime } from '../../copy';
import { useReadModels } from '../../read-models/use-read-models';
import { useCityStore } from '../../stores/city-store';
import { useEvidenceStore } from '../../stores/evidence-store';
import { useUniqueId } from '../../unique-id';
import {
  FALLOW_ATTACH, FALLOW_ATTACH_REFUSED, FALLOW_ATTACHED, FALLOW_CANCEL, FALLOW_CHOOSE, FALLOW_DIALOG_EYEBROW,
  FALLOW_DIALOG_INTRO, FALLOW_DIALOG_TITLE, FALLOW_DISCLOSURE, FALLOW_IMPORT_ERROR, FALLOW_MAPPING_OFFER,
  FALLOW_REPLACE_NOTE, FALLOW_REVIEW_TITLE, FALLOW_SNAPSHOT_FILES,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';
import { reannounce } from '../../kit/reannounce';
import { useBusyAction } from '../../kit/use-busy-action';
import FallowReportFacts from './FallowReportFacts.vue';
import { reviewFallowCandidate, type FallowCandidate } from './fallow-candidate';

const emit = defineEmits<{ close: []; done: [message: string] }>();
const city = useCityStore();
const evidence = useEvidenceStore();
const { files } = useReadModels();
const { busy, error, requestClose: requestCloseWith, run } = useBusyAction();
const mappingId = useUniqueId('ci-connect-fallow-mapping');
/** Part 4 E8/E11: the codebase this dialog was opened for. Every async step checks it again. */
const repositoryId = city.snapshot?.repositoryId ?? '';
const fileInput = ref<HTMLInputElement | null>(null);
const reviewHeading = ref<HTMLElement | null>(null);
const candidate = shallowRef<FallowCandidate | null>(null);
const mapped = ref(false);
const snapshotPaths = computed<ReadonlySet<string>>(() => new Set(files.value.map((f) => f.path)));
const review = computed(() => (candidate.value ? reviewFallowCandidate(candidate.value, snapshotPaths.value, mapped.value) : null));
/** Y31: re-importing while a report is attached says what it replaces. */
const replaceNote = computed(() => (evidence.report ? FALLOW_REPLACE_NOTE(formatAbsoluteTime(evidence.report.importedAt, Intl)) : ''));
const onScreen = (): boolean => repositoryId !== '' && city.snapshot?.repositoryId === repositoryId;

/** Part 4 E13: while a read is in flight, Cancel, Escape and the backdrop are ignored. */
function requestClose(): void {
  requestCloseWith(() => emit('close'));
}

/** Blocked while a read is in flight (aria-disabled plus this guard, E40). */
function choose(): void {
  if (busy.value) return;
  fileInput.value?.click();
}

/** One outcome per pick.
 *  - The input is emptied first, so picking the same file again still fires `change`.
 *  - A refusal is re-announced: a new pick clears the previous one.
 *  - A result that lands after a codebase switch is dropped silently.
 *  - A report with findings, none of which match even with the offered mapping, is
 *    refused as a source mismatch (Y26). */
async function picked(): Promise<void> {
  const input = fileInput.value;
  const file = input?.files?.[0];
  if (input) input.value = '';
  if (!file) return;
  await run(async () => {
    const result = await readFallowReportFile(file);
    if (!onScreen()) return;
    if (!result.ok) {
      await reannounce(error, FALLOW_IMPORT_ERROR[result.code](result.detail));
      return;
    }
    const next: FallowCandidate = {
      raw: result.report, fileName: file.name, importedAt: new Date().toISOString(), snapshotId: city.snapshot?.snapshotId ?? '',
    };
    if (reviewFallowCandidate(next, snapshotPaths.value, false).mismatch) {
      await reannounce(error, FALLOW_IMPORT_ERROR['source-mismatch'](''));
      return;
    }
    mapped.value = false;
    candidate.value = next;
  }, FALLOW_IMPORT_ERROR['read-failed'](''));
  if (!candidate.value) return;
  await nextTick();
  reviewHeading.value?.focus();   // Choose has gone; focus stays inside the dialog
}

/** Y31/Y38: attaches through the port. `true` closes the dialog, and the screen announces
 *  it (E17). A refusal stays in the dialog's alert. If the codebase changed since the pick,
 *  nothing is applied (SourcesScreen has already closed the dialog). */
function attach(): void {
  const r = review.value;
  if (busy.value || !r) return;
  if (!onScreen() || evidence.repositoryId !== repositoryId) return;
  if (evidence.attach(r.report)) emit('done', FALLOW_ATTACHED(r.matchedFindings, r.matchedFiles));
  else void reannounce(error, FALLOW_ATTACH_REFUSED);
}
</script>

<template>
  <CiDialog
    :label="FALLOW_DIALOG_TITLE"
    @close="requestClose"
  >
    <div class="ci-connect-fallow">
      <template v-if="!review">
        <p class="ci-connect-fallow__eyebrow">
          {{ FALLOW_DIALOG_EYEBROW }}
        </p>
        <h3>{{ FALLOW_DIALOG_TITLE }}</h3>
        <p>{{ FALLOW_DIALOG_INTRO }}</p>
        <p class="ci-connect-fallow__disclosure">
          {{ FALLOW_DISCLOSURE }}
        </p>
        <p class="ci-note">
          {{ FALLOW_SNAPSHOT_FILES(files.length) }}
        </p>
      </template>
      <template v-else>
        <h3
          ref="reviewHeading"
          tabindex="-1"
        >
          {{ FALLOW_REVIEW_TITLE }}
        </h3>
        <FallowReportFacts
          :report="review.report"
          :matched-findings="review.matchedFindings"
          :matched-files="review.matchedFiles"
          :unmatched-paths="review.unmatchedPaths"
        />
        <p
          v-if="review.suggestion !== null"
          class="ci-connect-fallow__mapping"
        >
          <input
            :id="mappingId"
            v-model="mapped"
            type="checkbox"
          >
          <label :for="mappingId">{{ FALLOW_MAPPING_OFFER(review.suggestion) }}</label>
        </p>
        <p
          v-if="replaceNote"
          class="ci-connect-fallow__replace"
        >
          {{ replaceNote }}
        </p>
      </template>
      <p
        v-if="error"
        class="ci-connect-fallow__error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="ci-connect-fallow__actions">
        <button
          type="button"
          class="ci-connect-fallow__cancel"
          :aria-disabled="busy ? 'true' : undefined"
          @click="requestClose"
        >
          {{ FALLOW_CANCEL }}
        </button>
        <button
          v-if="!review"
          type="button"
          class="mod-cta ci-connect-fallow__choose"
          :aria-disabled="busy ? 'true' : undefined"
          @click="choose"
        >
          {{ FALLOW_CHOOSE }}
        </button>
        <button
          v-else
          type="button"
          class="mod-cta ci-connect-fallow__attach"
          :aria-disabled="busy ? 'true' : undefined"
          @click="attach"
        >
          {{ FALLOW_ATTACH }}
        </button>
      </div>
    </div>
  </CiDialog>
  <input
    ref="fileInput"
    type="file"
    accept=".json,application/json"
    class="visually-hidden ci-connect-fallow__file"
    tabindex="-1"
    aria-hidden="true"
    @change="picked"
  >
</template>
```

  The component has two root nodes: the dialog and the input. `close` and `done` are declared emits, so nothing falls through to either root.

- [ ] **Step 8: The model and the grid slot.** In `src/ui/read-models/sources.ts`:
  - Replace:

```ts
// Part 4 W2/W3/W15: Data & scans. The scope rows and the run state are real (collected
// from the snapshot on screen and the run store); every provider other than the
// built-in inventory is sample or unknown and says so.
```

    with:

```ts
// Part 4 W2/W3/W15: Data & scans. The scope rows and the run state are real (collected
// from the snapshot on screen and the run store). Part 6 Y37: so is the fallow card, from
// the evidence index. Every other provider is sample or unknown and says so.
```

  - Replace:

```ts
import { rootFolderLabel } from './root-label';
```

    with:

```ts
import { FALLOW_SOURCE } from '../inspector-copy';
import type { EvidenceIndexState } from './evidence-index';
import { rootFolderLabel } from './root-label';
```

  - Replace:

```ts
export function buildSourcesModel(snapshot: CodebaseSnapshot | null, run: InventoryRunState): SourcesModel {
```

    with:

```ts
/** Part 6 Y37: the fallow card's state comes from the evidence index (Y30, Y33). */
interface FallowCardState { state: EvidenceIndexState; version: string | null }
const NO_FALLOW: FallowCardState = { state: 'none', version: null };
const FALLOW_EVIDENCE: Readonly<Record<EvidenceIndexState, EvidenceState>> = { none: 'unknown', current: 'collected', stale: 'stale' };

export function buildSourcesModel(snapshot: CodebaseSnapshot | null, run: InventoryRunState, fallow: FallowCardState = NO_FALLOW): SourcesModel {
```

  - Replace `      provider('static', 'code', 'sample', EVIDENCE_SOURCE_SAMPLE, ['quality', 'file']),` with `      provider('fallow', 'code', FALLOW_EVIDENCE[fallow.state], fallow.version === null ? EVIDENCE_SOURCE_NONE : FALLOW_SOURCE(fallow.version), ['quality', 'file']),`.

  The two `inspector-copy` imports may be merged into the existing import list instead. Either form passes eslint.

  In `src/ui/screens/sources/ProviderGrid.vue`, replace:

```vue
        <p class="ci-provider__text">
          {{ p.description }}
        </p>
```

  with:

```vue
        <p class="ci-provider__text">
          {{ p.description }}
        </p>
        <!-- Part 6 Y37: an optional per-card slot, `card-<id>`; only the fallow card uses it. -->
        <slot :name="`card-${p.id}`" />
```

- [ ] **Step 9: SourcesScreen.** Replace the whole of `src/ui/screens/SourcesScreen.vue` with:

```vue
<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import type { RouteId } from '../../domain/route-ids';
import { buildSourcesModel } from '../read-models/sources';
import { useReadModels } from '../read-models/use-read-models';
import { useCityStore } from '../stores/city-store';
import { useEvidenceStore } from '../stores/evidence-store';
import { useRunStore } from '../stores/run-store';
import {
  FALLOW_REMOVE, FALLOW_REMOVE_CANCEL, FALLOW_REMOVE_TEXT, FALLOW_REMOVE_TITLE, FALLOW_REMOVED, SOURCES_CALLOUT,
  SOURCES_CALLOUT_TITLE, SOURCES_CHANGE, SOURCES_EYEBROW, SOURCES_PLANNED, SOURCES_PLANNED_TITLE, SOURCES_RESCAN,
  SOURCES_SUBTITLE, SOURCES_TITLE,
} from '../inspector-copy';
import PageHeader from '../kit/PageHeader.vue';
import Panel from '../kit/Panel.vue';
import Callout from '../kit/Callout.vue';
import CiDialog from '../kit/Dialog.vue';
import Icon from '../kit/Icon.vue';
import { noop } from '../kit/noop';
import { reannounce } from '../kit/reannounce';
import ScopePanel from './sources/ScopePanel.vue';
import ScanStatusPanel from './sources/ScanStatusPanel.vue';
import ProviderGrid from './sources/ProviderGrid.vue';
import FallowCardDetails from './sources/FallowCardDetails.vue';
import ConnectFallowDialog from './sources/ConnectFallowDialog.vue';

const store = useCityStore();
const runStore = useRunStore();
const evidenceStore = useEvidenceStore();
const { evidence } = useReadModels();
// W2: the host callbacks the UI already injects (NoSnapshot, NavColumn, AppToolbar); the
// host's own modals and consent chain do the work. Part 5 V6: onCancelScan calls the SAME
// CityView.cancelScan the 'cancel-scan' command calls.
const onSelectCodebase = inject<() => void>('onSelectCodebase', noop);
const onScanRequested = inject<() => void>('onScanRequested', noop);
const onCancelScan = inject<() => void>('onCancelScan', noop);
const root = ref<HTMLElement | null>(null);
const liveMessage = ref('');
/** Part 6 Y38 / Y31: the S14 dialog and the Remove confirmation. */
const connecting = ref(false);
const removing = ref(false);

const model = computed(() => buildSourcesModel(store.snapshot, runStore.run, {
  state: evidence.value.state, version: evidence.value.report?.providerVersion ?? null,
}));
const inFlight = computed(() => runStore.run.status === 'running' || runStore.run.status === 'cancelling');

/** Y39: the "Import analysis report" command and Not analysed's Import both land here with
 *  a request. It is consumed once, and the dialog opens a tick later, after the route change
 *  has placed focus (V7), so CiDialog returns focus into this screen. With no snapshot there
 *  is nothing to match a report against, so nothing opens. */
async function openRequested(): Promise<void> {
  await nextTick();
  if (store.snapshot) connecting.value = true;
}
watch(() => evidenceStore.importRequested, (requested) => {
  if (requested && evidenceStore.consumeImportRequest()) void openRequested();
}, { immediate: true });

/** Part 4 E8/E11: a codebase switch closes both dialogs. Nothing is attached or removed,
 *  and nothing is announced: the user did not act. */
watch(() => store.snapshot?.repositoryId, () => { connecting.value = false; removing.value = false; });

/** W3 (A8, P14): scan states live on the city route, so go there before the host starts. */
function changeSource(): void {
  store.navigate('city');
  onSelectCodebase();
}
function rescan(): void {
  if (inFlight.value) return;
  store.navigate('city');
  onScanRequested();
}
/** Part 5 V6: guarded on the store itself (not the panel's props, which lag one render), so
 *  an aria-disabled press does nothing. Stays on this screen: the run line announces the
 *  outcome (role="status"). */
function cancelScan(): void {
  if (runStore.run.status !== 'running') return;
  onCancelScan();
}
function open(route: RouteId): void {
  store.navigate(route);
}
function openConnect(): void {
  if (store.snapshot) connecting.value = true;
}
/** CiDialog returns focus to its opener. A dialog opened by a request from another screen
 *  has no opener here, so focus lands on the card's Import button, never on <body>. */
async function closeConnect(): Promise<void> {
  connecting.value = false;
  await nextTick();
  const el = root.value;
  const active = el?.ownerDocument.activeElement;
  if (!el || (active && el.contains(active))) return;
  el.querySelector<HTMLElement>('.ci-fallow-card__import')?.focus();
}
/** Y38: the dialog closes, then this screen announces the real outcome (E17). */
function attached(message: string): void {
  void closeConnect();
  void reannounce(liveMessage, message);
}
/** Y31: only a removal that happened is announced (E17). */
function confirmRemove(): void {
  removing.value = false;
  if (evidenceStore.remove()) void reannounce(liveMessage, FALLOW_REMOVED);
}
</script>

<template>
  <div
    ref="root"
    class="ci-screen ci-screen--sources"
  >
    <PageHeader
      :eyebrow="SOURCES_EYEBROW"
      :title="SOURCES_TITLE"
      :subtitle="SOURCES_SUBTITLE"
    >
      <template #actions>
        <button
          type="button"
          class="ci-sources__change"
          @click="changeSource"
        >
          <Icon name="folder" />
          {{ SOURCES_CHANGE }}
        </button>
        <button
          type="button"
          class="mod-cta ci-sources__rescan"
          :aria-disabled="inFlight ? 'true' : undefined"
          @click="rescan"
        >
          <Icon name="refresh-cw" />
          {{ SOURCES_RESCAN }}
        </button>
      </template>
    </PageHeader>
    <p
      class="visually-hidden ci-sources__live"
      role="status"
    >
      {{ liveMessage }}
    </p>
    <Callout :title="SOURCES_CALLOUT_TITLE">
      {{ SOURCES_CALLOUT }}
    </Callout>
    <div class="ci-screen__grid">
      <ScopePanel :rows="model.scope" />
      <ScanStatusPanel
        :run="model.run"
        @cancel="cancelScan"
      />
    </div>
    <ProviderGrid
      :providers="model.providers"
      @open="open"
    >
      <template #card-fallow>
        <FallowCardDetails
          :index="evidence"
          :has-snapshot="store.snapshot !== null"
          @import="openConnect"
          @remove="removing = true"
        />
      </template>
    </ProviderGrid>
    <Panel :title="SOURCES_PLANNED_TITLE">
      <p class="ci-note">
        {{ SOURCES_PLANNED }}
      </p>
    </Panel>
    <ConnectFallowDialog
      v-if="connecting"
      @close="closeConnect"
      @done="attached"
    />
    <CiDialog
      v-if="removing"
      :label="FALLOW_REMOVE_TITLE"
      @close="removing = false"
    >
      <div class="ci-fallow-remove">
        <h3>{{ FALLOW_REMOVE_TITLE }}</h3>
        <p>{{ FALLOW_REMOVE_TEXT }}</p>
        <div class="ci-fallow-remove__actions">
          <button
            type="button"
            class="ci-fallow-remove__cancel"
            @click="removing = false"
          >
            {{ FALLOW_REMOVE_CANCEL }}
          </button>
          <button
            type="button"
            class="mod-warning ci-fallow-remove__confirm"
            @click="confirmRemove"
          >
            {{ FALLOW_REMOVE }}
          </button>
        </div>
      </div>
    </CiDialog>
  </div>
</template>
```

  Removing is synchronous (`evidenceStore.remove()` returns a boolean, R7), so the confirmation has no busy state.

- [ ] **Step 10: CSS.** Append to `src/ui/styles/screens-configure.css`:

```css

/* Part 6 Task 10: the fallow card, its report facts, the S14 dialog and the remove confirmation. */
:where(.codebase-inspector-root) .ci-fallow-card { display: flex; flex-direction: column; align-items: flex-start; gap: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-fallow-card p { margin: 0; }
:where(.codebase-inspector-root) .ci-fallow-card__actions { display: flex; flex-wrap: wrap; gap: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-fallow-facts {
  display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: var(--ci-space-1) var(--ci-space-3);
  margin: 0; font-size: var(--font-ui-small, 0.9em);
}
:where(.codebase-inspector-root) .ci-fallow-facts dt { color: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-fallow-facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
:where(.codebase-inspector-root) .ci-fallow-facts__list { margin: 0; padding-left: 1.2em; }
:where(.codebase-inspector-root) .ci-connect-fallow { display: grid; gap: var(--ci-space-3); padding: var(--ci-space-4); overflow-wrap: anywhere; }
:where(.codebase-inspector-root) .ci-connect-fallow h3,
:where(.codebase-inspector-root) .ci-connect-fallow p { margin: 0; }
/* A focus target after the step changes, never a control: no ring (like .ci-page-header__title). */
:where(.codebase-inspector-root) .ci-connect-fallow h3:focus { outline: none; }
:where(.codebase-inspector-root) .ci-connect-fallow__eyebrow {
  font-size: var(--font-ui-smaller, 0.8em); letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--ci-action); font-weight: var(--font-semibold);
}
:where(.codebase-inspector-root) .ci-connect-fallow__disclosure { padding: var(--ci-space-3); border-left: 3px solid var(--ci-border); background: var(--ci-panel); }
:where(.codebase-inspector-root) .ci-connect-fallow__mapping { display: flex; align-items: center; gap: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-connect-fallow__error { color: var(--ci-tone-danger); }
:where(.codebase-inspector-root) .ci-connect-fallow__actions,
:where(.codebase-inspector-root) .ci-fallow-remove__actions { display: flex; justify-content: flex-end; gap: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-fallow-remove { display: grid; gap: var(--ci-space-3); padding: var(--ci-space-4); max-width: 32em; }
:where(.codebase-inspector-root) .ci-fallow-remove h3,
:where(.codebase-inspector-root) .ci-fallow-remove p { margin: 0; }
```

  There is no aria-disabled rule here: the kit's shared `button[aria-disabled="true"]` rule styles every blocked button (E54).

- [ ] **Step 11: Run and confirm it passes.** Run `npx vitest run tests/unit/fallow-candidate.test.ts tests/component/connect-fallow.test.ts tests/component/fallow-card.test.ts tests/unit/sources-model.test.ts tests/component/sources-screen.test.ts tests/component/route-focus.test.ts tests/unit/css-class-scope.test.ts tests/unit/kit-css-fallbacks.test.ts`. Expected: PASS.
  - Then run the gate: `npm run typecheck && npm run lint:fast`.
  - Then lint the touched files: `npx eslint src/ui/screens/sources/ConnectFallowDialog.vue src/ui/screens/sources/FallowCardDetails.vue src/ui/screens/sources/FallowReportFacts.vue src/ui/screens/sources/fallow-candidate.ts src/ui/screens/sources/ProviderGrid.vue src/ui/screens/SourcesScreen.vue src/ui/read-models/sources.ts src/ui/audit-copy/sources.ts src/ui/audit-copy/fallow.ts tests/unit/fallow-candidate.test.ts tests/component/connect-fallow.test.ts tests/component/fallow-card.test.ts tests/unit/sources-model.test.ts tests/component/route-focus.test.ts --max-warnings 0`.
  - Then run the sweeps. Each of these must print nothing:
    - `git grep -n "createElement\|v-html\|innerHTML\|adapters/fallow" -- src/ui/screens/sources src/ui/screens/SourcesScreen.vue`;
    - `git grep -n "'static'" -- src/ui/read-models/sources.ts src/ui/audit-copy/sources.ts`.
  - Report the line counts. SourcesScreen should be about 190, and every file must stay under 400.

- [ ] **Step 12: Commit.** Commit only this task's files:

```
feat(ui): the fallow card on Data & scans and the S14 Connect fallow dialog (Y31, Y37, Y38)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---


---

### Task 11: The findings lens (Y40)

**Files:**
- Modify: `src/visualization/renderer-port.ts` (96 → ~102): `CityRendererPort.setReported`.
- Modify: `src/visualization/instanced-city.ts` (334 → ~350): `CityMeshes.setReported`, `lotColour`, the `reported` state.
- Modify: `src/visualization/city-renderer.ts` (378 → ~389, stays under 400): the port method, the `reported` state re-applied in `swapCity`, and the inert port.
- Create: `src/ui/stores/lens-store.ts` (~45): `useLensStore`, `LensId`, `LENS_IDS`. A setup store with a `flush: 'sync'` watcher (R8).
- Create: `src/ui/read-models/use-lens-view.ts` (~45): `useLensView()`, the one "is the lens on, and which files are reported" derivation. (Not in the File map: added so the renderer wiring, legend, heading and list column cannot disagree.)
- Create: `src/ui/screens/city/use-lens-renderer.ts` (~40): `useLensRenderer()`.
- Create: `src/ui/screens/city/LensHeading.vue` (~50).
- Modify: `src/ui/components/CityStage.vue` (75 → ~83): uses `useLensRenderer()` and renders `<LensHeading />`. `CityViewport.vue` (400/400) is **not** touched.
- Modify: `src/ui/components/AppToolbar.vue` (Task 1's 119 → ~157): the Colour select.
- Modify: `src/ui/components/MetricLegend.vue` (70 → ~108): the two lens rows.
- Modify: `src/ui/components/CodebaseFileList.vue` (155 → ~167), `src/ui/components/CodebaseFileListGroup.vue` (141 → ~160), `src/ui/components/file-list-types.ts` (33 → ~39): the list-mode Reported column.
- Modify: `src/ui/audit-copy/fallow.ts` (Tasks 5–10's result, +~16): the `LENS_*` copy. `COPY_16` is Task 8's (R4) and is only imported here.
- Modify: `src/ui/styles/screens.css` (50 → ~70), `src/ui/styles/shell.css` (122 → ~131).
- Modify: `tests/fixtures/evidence-report.ts` (Task 8's ~150 → ~160): one addition, `snapshotWithOnlyFiles` (R5 permits additions in the task that needs them).
- Test: `tests/unit/lens-store.test.ts` (new, ~90), `tests/component/renderer-reported.test.ts` (new, ~185; `renderer-contract.test.ts` is 450/450 and is not grown), `tests/component/findings-lens.test.ts` (new, ~310).
- Modify, one existing line each and **no line added** (the renderer doubles gain `setReported: vi.fn()`, so they still satisfy `CityRendererPort`): `tests/acceptance/world.ts`, `tests/component/{welcome-state,codebase-file-list,camera-controls,file-inspector,status-surfaces,camera-round-trip,city-viewport,city-viewport-wiring,responsive-floor,stage-height}.test.ts`, `tests/host/{city-view-cancel,city-view-scan-modes,city-view-store-wiring,city-view,lifecycle-leaks,multi-leaf,window-migration}.test.ts`.

**Interfaces:**
- Consumes:
  - Task 7 (R7): `useEvidenceStore` (`src/ui/stores/evidence-store.ts`), a setup store with refs `repositoryId`, `report` and synchronous `setRepository`, `bindRepository` (a no-op for the same id), `attach(report): boolean` and `remove(): boolean`; `InMemoryEvidenceStore` (`src/adapters/storage/in-memory-evidence-store.ts`, no-arg constructor).
  - Task 8: `EvidenceIndex` (`state`, `report`, `byFile`, `matchedFindings`, `matchedFiles`) from `src/ui/read-models/evidence-index.ts`; `useReadModels().evidence: ComputedRef<EvidenceIndex>`, which shows a report only when `evidence.repositoryId === snapshot.repositoryId`; `COPY_16(absoluteDate)` in `src/ui/audit-copy/fallow.ts`, reached through `inspector-copy.ts`.
  - Task 8's full `tests/fixtures/evidence-report.ts` (R5): `SYNTHETIC_VERSION`, `syntheticEvidenceReport(snapshot, options?)`, `attachSyntheticReport(snapshot, options?)`. These run `syntheticFallowJson` through `parseFallowReportText` (`src/application/evidence/read-fallow-report.ts`) and `buildEvidenceReport` (`src/application/evidence/normalize-fallow.ts`).
  - Task 9 (R8): `src/ui/kit/EvidenceBadge.vue` (props `version: string`, `state: 'imported' | 'stale'`).
  - `CITY_RENDERER_KEY` / `useCityRendererHandle()` (`src/ui/renderer-handle.ts`); `formatAbsoluteTime(iso, Intl)` (`src/ui/copy.ts`).
- Produces:
  - `CityRendererPort.setReported(ids: ReadonlySet<EntityId> | null): void` (R8), and `CityMeshes.setReported` with the same signature.
  - `type LensId = 'category' | 'findings'`, `LENS_IDS`, `useLensStore` (setup store; state `lens: LensId`; actions `setLens(next: LensId)`, `reset()`). It resets itself, synchronously, when the evidence store's `repositoryId` changes or its `report` becomes `null`.
  - `useLensView(): { active; evidence; reported }` (`src/ui/read-models/use-lens-view.ts`).
  - `useLensRenderer(): void` (`src/ui/screens/city/use-lens-renderer.ts`).
  - `LensHeading.vue` (`.ci-city-lens`), the toolbar `<select class="dropdown ci-toolbar__lens">` with its visible `<label class="ci-toolbar__lens-label">`, the legend rows, and `.ci-file-list__reported` / `.ci-file-list__reported-head`.
  - `RowState.reported: number | null`. The column shows in list mode only (R8).
  - Copy: `LENS_LABEL`, `LENS_OPTION_CATEGORY`, `LENS_OPTION_FINDINGS`, `LENS_EYEBROW`, `LENS_TITLE`, `LENS_SUBTITLE(findings, files)`, `LENS_LEGEND_REPORTED`, `LENS_LEGEND_NONE`, `LENS_LIST_COLUMN`, `LENS_LIST_NONE`, `LENS_LIST_CELL(count)`.
  - `tests/fixtures/evidence-report.ts`: `snapshotWithOnlyFiles(snapshot, paths)`.

- [ ] **Step 1: One fixture addition.** `syntheticFallowJson` reports a finding on EVERY file of the snapshot it is given. A lens where every lot is reported shows nothing, and an em dash never appears. So this task adds one helper to the shared fixture, and Task 12's harness uses it too.
  - In `tests/fixtures/evidence-report.ts`, replace the end of `snapshotWithPaths`:

```ts
  return { ...base, entities: [...base.entities, ...files] };
}
```

    with:

```ts
  return { ...base, entities: [...base.entities, ...files] };
}

/** Task 11: the same snapshot, same id, with only the named files kept. Handed to
 *  syntheticFallowJson / syntheticEvidenceReport / attachSyntheticReport, it gives a report
 *  with findings on those files alone, which is still current for the full snapshot (same
 *  snapshotId and repositoryId). The findings lens needs files WITHOUT findings. */
export function snapshotWithOnlyFiles(snapshot: CodebaseSnapshot, paths: readonly string[]): CodebaseSnapshot {
  const keep = new Set(paths);
  return { ...snapshot, entities: snapshot.entities.filter((e) => e.kind !== 'file' || keep.has(e.path)) };
}
```

- [ ] **Step 2: Write the failing tests.**

  **(a) Create `tests/unit/lens-store.test.ts`:**

```ts
// Part 6 Y40: the lens store. One per leaf; 'findings' needs evidence; it resets to
// 'category' — synchronously — when the bound codebase changes or its evidence goes away.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useLensStore, type LensId } from '../../src/ui/stores/lens-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { syntheticEvidenceReport } from '../fixtures/evidence-report';

const snap = buildSnapshotFixture({ files: 2, repositoryId: 'repo-a' });
let repository: InMemoryEvidenceStore;

beforeEach(() => {
  setActivePinia(createPinia());
  repository = new InMemoryEvidenceStore();
  useEvidenceStore().setRepository(repository);
});

function withEvidence(repositoryId = 'repo-a'): ReturnType<typeof useEvidenceStore> {
  const evidence = useEvidenceStore();
  evidence.bindRepository(repositoryId);
  expect(evidence.attach(syntheticEvidenceReport(snap))).toBe(true);
  return evidence;
}

describe('lens store (Y40)', () => {
  it('starts on the category lens', () => {
    expect(useLensStore().lens).toBe('category');
  });

  it('refuses the findings lens while the codebase has no evidence', () => {
    useEvidenceStore().bindRepository('repo-a');
    const lens = useLensStore();
    lens.setLens('findings');
    expect(lens.lens).toBe('category');
  });

  it('takes the findings lens once evidence is attached, and reset() returns to category', () => {
    withEvidence();
    const lens = useLensStore();
    lens.setLens('findings');
    expect(lens.lens).toBe('findings');
    lens.reset();
    expect(lens.lens).toBe('category');
  });

  it('ignores an unknown lens id', () => {
    withEvidence();
    const lens = useLensStore();
    lens.setLens('heat' as LensId);
    expect(lens.lens).toBe('category');
  });

  it('resets to category in the same call that removes the evidence', () => {
    const evidence = withEvidence();
    const lens = useLensStore();
    lens.setLens('findings');
    expect(evidence.remove()).toBe(true);
    expect(lens.lens).toBe('category');
  });

  it('resets on a codebase switch, even to a codebase that has evidence too', () => {
    repository.put('repo-b', syntheticEvidenceReport(snap, { symbol: 'otherHelper' }));
    const evidence = withEvidence('repo-a');
    const lens = useLensStore();
    lens.setLens('findings');
    evidence.bindRepository('repo-b');
    expect(evidence.report).not.toBeNull();
    expect(lens.lens).toBe('category');
  });

  it('keeps the lens when the report on the same codebase is replaced', () => {
    const evidence = withEvidence();
    const lens = useLensStore();
    lens.setLens('findings');
    expect(evidence.attach(syntheticEvidenceReport(snap, { symbol: 'replacement' }))).toBe(true);
    expect(lens.lens).toBe('findings');
  });
});
```

  **(b) Create `tests/component/renderer-reported.test.ts`:**

```ts
// Part 6 Y40: setReported, the findings lens, is a RECOLOUR ONLY. Reported measured lots
// keep their category colour, every other measured lot takes palette.unavailable,
// unavailable markers never change, and nothing moves. Its own file:
// renderer-contract.test.ts is at 450/450.
//
// Two levels. buildCity (instanced-city.ts) is driven directly with the real `three`,
// recording setColorAt/setMatrixAt; the port (city-renderer.ts) is driven with only
// WebGLRenderer doubled (the tests/unit/city-renderer.test.ts pattern), to prove the set
// survives setColors and a setLayout that lands after it — the renderer-reconstruction
// half of the contract.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../mocks/obsidian';
import { Color, InstancedMesh } from 'three';
import { buildCity, type CityMeshes } from '../../src/visualization/instanced-city';
import type { CityPalette, CityRendererPort } from '../../src/visualization/renderer-port';
import type { LayoutResult } from '../../src/domain/layout/types';
import { CATEGORY_IDS } from '../../src/domain/classify';
import {
  HEIGHT, ID, WIDTH, captureGetContext, layoutOf, makeWinDouble, paletteFixture, stubGetContext,
} from '../fixtures/renderer-doubles';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    info = { memory: { geometries: 0, textures: 0 }, programs: [], render: { calls: 0 } };
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    getContext = vi.fn(() => ({ getExtension: () => null }));
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

const PALETTE = paletteFixture();
const hex = (css: string): number => new Color(css).getHex();
const CATEGORY = hex(PALETTE.categories[CATEGORY_IDS[0]]);
const NEUTRAL = hex(PALETTE.unavailable);

/** Three measured lots (f0..f2) and one whose metric is unavailable (f3). */
function lensLayout(): LayoutResult {
  const base = layoutOf('lens', 4);
  return { ...base, lots: [...base.lots.slice(0, 3), { ...base.lots[3]!, metricState: 'unavailable' as const }] };
}

async function built(): Promise<CityMeshes> {
  const city = await buildCity(lensLayout(), { win: window, superseded: () => false });
  if (!city) throw new Error('buildCity was superseded');
  city.setColors(PALETTE);
  return city;
}

/** pickTargets is FILE LOTS ONLY, measured first, then the unavailable markers (instanced-city.ts). */
function meshes(city: CityMeshes): { measured: InstancedMesh; markers: InstancedMesh } {
  const [measured, markers] = city.pickTargets as readonly InstancedMesh[];
  return { measured: measured!, markers: markers! };
}

/** What each instance will actually be drawn with, as sRGB hex. */
function colours(mesh: InstancedMesh): number[] {
  const out: number[] = [];
  const colour = new Color();
  for (let i = 0; i < mesh.count; i++) {
    mesh.getColorAt(i, colour);
    out.push(colour.getHex());
  }
  return out;
}

afterEach(() => { vi.restoreAllMocks(); });

describe('buildCity: setReported recolours measured lots only (Y40)', () => {
  it('keeps reported lots in their category colour and paints every other measured lot unavailable', async () => {
    const city = await built();
    const { measured, markers } = meshes(city);
    expect(colours(measured)).toEqual([CATEGORY, CATEGORY, CATEGORY]);
    city.setReported(new Set([ID('src/f1.ts')]));
    expect(colours(measured)).toEqual([NEUTRAL, CATEGORY, NEUTRAL]);
    expect(colours(markers)).toEqual([NEUTRAL]);            // the unavailable marker never changes
    city.dispose();
  });

  it('restores the category colours on null', async () => {
    const city = await built();
    city.setReported(new Set([ID('src/f1.ts')]));
    city.setReported(null);
    expect(colours(meshes(city).measured)).toEqual([CATEGORY, CATEGORY, CATEGORY]);
    city.dispose();
  });

  it('treats an empty set as a lens with nothing reported, not as no lens', async () => {
    const city = await built();
    city.setReported(new Set());
    expect(colours(meshes(city).measured)).toEqual([NEUTRAL, NEUTRAL, NEUTRAL]);
    city.dispose();
  });

  it('is a recolour only: colour writes, no matrix writes, nothing moves, selection kept', async () => {
    const city = await built();
    city.setSelection(ID('src/f0.ts'));
    const { measured } = meshes(city);
    const matrices = Array.from(measured.instanceMatrix.array);
    const setMatrixAt = vi.spyOn(InstancedMesh.prototype, 'setMatrixAt');
    const setColorAt = vi.spyOn(InstancedMesh.prototype, 'setColorAt');
    city.setReported(new Set([ID('src/f2.ts')]));
    expect(setMatrixAt).not.toHaveBeenCalled();
    const writes = setColorAt.mock.contexts.flatMap((ctx, i) => (ctx === measured ? [setColorAt.mock.calls[i]!] : []));
    expect(writes.map(([index, colour]) => [index, colour.getHex()])).toEqual([[0, NEUTRAL], [1, NEUTRAL], [2, CATEGORY]]);
    expect(Array.from(measured.instanceMatrix.array)).toEqual(matrices);
    expect(city.lotOf(ID('src/f0.ts'))).not.toBeNull();
    city.dispose();
  });

  it('survives setColors: the lens is repainted from the NEW palette', async () => {
    const city = await built();
    city.setReported(new Set([ID('src/f1.ts')]));
    const next: CityPalette = {
      ...PALETTE, unavailable: '#00ff00',
      categories: Object.fromEntries(CATEGORY_IDS.map((id) => [id, '#ff0000'])) as CityPalette['categories'],
    };
    city.setColors(next);
    expect(colours(meshes(city).measured)).toEqual([hex('#00ff00'), hex('#ff0000'), hex('#00ff00')]);
    city.dispose();
  });

  it('composes with the search filter: a reported lot outside the matches still dims', async () => {
    const city = await built();
    city.setReported(new Set([ID('src/f1.ts')]));
    city.setFilter(new Set([ID('src/f0.ts')]));
    const [f0, f1] = colours(meshes(city).measured);
    expect(f0).toBe(NEUTRAL);                               // matched, not reported: undimmed neutral
    expect(f1).not.toBe(CATEGORY);                          // reported, not matched: dimmed category
    city.dispose();
  });
});

describe('the port: setReported through CityRendererPort (Y40)', () => {
  let restoreGetContext: () => void;
  beforeEach(() => {
    restoreGetContext = captureGetContext();
    stubGetContext('ok');
  });
  afterEach(() => {
    restoreGetContext();
    document.body.replaceChildren();
  });

  async function makePort(): Promise<CityRendererPort> {
    const { win } = makeWinDouble();
    const { createCityRenderer } = await import('../../src/visualization/city-renderer');
    const port = createCityRenderer(document.body.createDiv(), win, () => {});
    port.resize(WIDTH, HEIGHT, 1);
    port.setColors(PALETTE);
    return port;
  }
  const layout = (id: string, generation: number) =>
    [layoutOf(id, 3), { generation, signal: new AbortController().signal }] as const;

  it('applies a set sent BEFORE the first layout once the city lands', async () => {
    const port = await makePort();
    const setColorAt = vi.spyOn(InstancedMesh.prototype, 'setColorAt');
    port.setReported(new Set([ID('src/f2.ts')]));            // no city yet: nothing painted, nothing thrown
    expect(setColorAt).not.toHaveBeenCalled();
    await port.setLayout(...layout('s1', 1));
    expect(colours(setColorAt.mock.contexts.at(-1) as InstancedMesh)).toEqual([NEUTRAL, NEUTRAL, CATEGORY]);
  });

  it('keeps the set across setColors and a NEW city, and null restores it', async () => {
    const port = await makePort();
    const setColorAt = vi.spyOn(InstancedMesh.prototype, 'setColorAt');
    await port.setLayout(...layout('s1', 1));
    port.setReported(new Set([ID('src/f0.ts')]));
    port.setColors(paletteFixture('#ffffff'));
    expect(colours(setColorAt.mock.contexts.at(-1) as InstancedMesh)).toEqual([CATEGORY, NEUTRAL, NEUTRAL]);
    await port.setLayout(...layout('s2', 2));                // a rebuilt city, as after a rescan
    const rebuilt = setColorAt.mock.contexts.at(-1) as InstancedMesh;
    expect(colours(rebuilt)).toEqual([CATEGORY, NEUTRAL, NEUTRAL]);
    port.setReported(null);
    expect(colours(rebuilt)).toEqual([CATEGORY, CATEGORY, CATEGORY]);
  });

  it('never moves the camera', async () => {
    const port = await makePort();
    await port.setLayout(...layout('s1', 1));
    const camera = port.getCamera();
    port.setReported(new Set([ID('src/f1.ts')]));
    expect(port.getCamera()).toEqual(camera);
  });

  it('the inert port (no WebGL2) accepts it without throwing', async () => {
    stubGetContext('null');
    const { createCityRenderer } = await import('../../src/visualization/city-renderer');
    const port = createCityRenderer(document.body.createDiv(), makeWinDouble().win, () => {});
    expect(() => { port.setReported(new Set()); port.setReported(null); }).not.toThrow();
  });
});
```

  **(c) Create `tests/component/findings-lens.test.ts`:**

```ts
// Part 6 Y40: the findings lens in the UI. Covers:
// - the toolbar Colour select (only with evidence, never disabled);
// - the renderer wiring (useLensRenderer, re-applied to a rebuilt renderer);
// - the heading with its badge, and COPY-16 when stale;
// - the legend rows;
// - the list-mode Reported column.
// Evidence comes from the shared fixture (R5): real-shaped fallow JSON through the real
// reader, builder and evidence store.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../mocks/obsidian';
import { defineComponent, h, nextTick, shallowRef, type ShallowRef } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppToolbar from '../../src/ui/components/AppToolbar.vue';
import CityStage from '../../src/ui/components/CityStage.vue';
import CodebaseFileList from '../../src/ui/components/CodebaseFileList.vue';
import MetricLegend from '../../src/ui/components/MetricLegend.vue';
import { useLensRenderer } from '../../src/ui/screens/city/use-lens-renderer';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useLensStore } from '../../src/ui/stores/lens-store';
import { CITY_RENDERER_KEY } from '../../src/ui/renderer-handle';
import { computeLayout } from '../../src/domain/layout/layout';
import { formatAbsoluteTime } from '../../src/ui/copy';
import {
  COPY_16, LENS_EYEBROW, LENS_LABEL, LENS_LEGEND_NONE, LENS_LEGEND_REPORTED, LENS_LIST_CELL, LENS_LIST_COLUMN,
  LENS_LIST_NONE, LENS_OPTION_CATEGORY, LENS_OPTION_FINDINGS, LENS_SUBTITLE, LENS_TITLE,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { SYNTHETIC_VERSION, attachSyntheticReport, snapshotWithOnlyFiles } from '../fixtures/evidence-report';
import type { CameraBookmark, CodebaseSnapshot, CodeEntity } from '../../src/domain/model';
import type { EvidenceReport } from '../../src/application/evidence/model';
import type { CityRendererPort } from '../../src/visualization/renderer-port';

const CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};

function makeRenderer() {
  return {
    setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(),
    setReported: vi.fn<CityRendererPort['setReported']>(), setLabels: vi.fn(), setCameraMode: vi.fn(),
    setMotion: vi.fn(), getCamera: vi.fn((): CameraBookmark => CAMERA), setCamera: vi.fn(), nudgeCamera: vi.fn(),
    focus: vi.fn(), fit: vi.fn(), resize: vi.fn(), pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
    getDiagnostics: vi.fn(() => ({
      geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
    })),
    debugLoseContext: vi.fn(),
  } satisfies CityRendererPort;
}

let snapshot: CodebaseSnapshot;
function fileAt(i: number): CodeEntity {
  const file = snapshot.entities.filter((e) => e.kind === 'file')[i];
  if (!file) throw new Error(`the fixture has no file ${i}`);
  return file;
}

/** The shared fixture's report for files 4 and 9 only (file 0 is the unavailable lot).
 *  Per syntheticFallowJson's own rules, over those two files:
 *  - file 4 gets an unused export, a critical complexity finding and one clone instance (3 findings);
 *  - file 9 gets an unused export and the other clone instance (2 findings).
 *  That is 5 findings on 2 files, and every other file has none. */
function attachEvidence(snapshotId?: string): EvidenceReport {
  const reported = snapshotWithOnlyFiles(snapshot, [fileAt(4).path, fileAt(9).path]);
  return attachSyntheticReport(reported, snapshotId === undefined ? {} : { snapshotId });
}
const REPORTED = (): Set<string> => new Set([fileAt(4).id, fileAt(9).id]);

const wrappers: { unmount(): void }[] = [];
function keep<T extends { unmount(): void }>(wrapper: T): T {
  wrappers.push(wrapper);
  return wrapper;
}

const Probe = defineComponent({ setup() { useLensRenderer(); return () => h('div'); } });
function mountProbe(handle: ShallowRef<CityRendererPort | null>) {
  return keep(mount(Probe, { global: { provide: { [CITY_RENDERER_KEY as symbol]: handle } } }));
}

beforeEach(() => {
  setActivePinia(createPinia());
  snapshot = buildSnapshotFixture({ files: 12, directories: 3, repositoryId: 'repo-lens', unavailable: 1 });
  useCityStore().setCity(snapshot, computeLayout(snapshot));
});

afterEach(() => {
  wrappers.splice(0).forEach((w) => { w.unmount(); });
  document.body.replaceChildren();
});

describe('the toolbar Colour select (Y40)', () => {
  it('is not rendered without evidence — never a disabled control', () => {
    const w = keep(mount(AppToolbar));
    expect(w.find('.ci-toolbar__lens').exists()).toBe(false);
    expect(w.find('select').exists()).toBe(false);
  });

  it('appears with evidence, named by its visible label, offering the two lenses', () => {
    attachEvidence();
    const w = keep(mount(AppToolbar));
    const select = w.get('select.ci-toolbar__lens');
    const label = w.get('label.ci-toolbar__lens-label');
    expect(label.text()).toBe(LENS_LABEL);
    expect(label.attributes('for')).toBe(select.attributes('id'));
    expect(select.findAll('option').map((o) => o.text())).toEqual([LENS_OPTION_CATEGORY, LENS_OPTION_FINDINGS]);
    expect((select.element as HTMLSelectElement).value).toBe('category');
    expect(select.attributes('disabled')).toBeUndefined();
    expect(select.attributes('aria-disabled')).toBeUndefined();
  });

  it('choosing Reported findings sets this leaf\'s lens', async () => {
    attachEvidence();
    const w = keep(mount(AppToolbar));
    await w.get('select.ci-toolbar__lens').setValue('findings');
    expect(useLensStore().lens).toBe('findings');
  });

  it('disappears, and the lens resets, when the evidence is removed', async () => {
    attachEvidence();
    const w = keep(mount(AppToolbar));
    await w.get('select.ci-toolbar__lens').setValue('findings');
    expect(useEvidenceStore().remove()).toBe(true);
    await nextTick();
    expect(w.find('.ci-toolbar__lens').exists()).toBe(false);
    expect(useLensStore().lens).toBe('category');
  });

  it('disappears, and the lens resets, on a codebase switch', async () => {
    attachEvidence();
    const w = keep(mount(AppToolbar));
    await w.get('select.ci-toolbar__lens').setValue('findings');
    useEvidenceStore().bindRepository('repo-other');
    await nextTick();
    expect(w.find('.ci-toolbar__lens').exists()).toBe(false);
    expect(useLensStore().lens).toBe('category');
  });
});

describe('useLensRenderer: the lens reaches the renderer (Y40)', () => {
  it('sends nothing to a fresh renderer while the lens is off', async () => {
    attachEvidence();
    const renderer = makeRenderer();
    mountProbe(shallowRef<CityRendererPort | null>(renderer));
    await nextTick();
    expect(renderer.setReported).not.toHaveBeenCalled();
  });

  it('sends the reported files when the lens turns on, and null when it turns off', async () => {
    attachEvidence();
    const renderer = makeRenderer();
    mountProbe(shallowRef<CityRendererPort | null>(renderer));
    useLensStore().setLens('findings');
    await nextTick();
    expect(renderer.setReported).toHaveBeenLastCalledWith(REPORTED());
    useLensStore().setLens('category');
    await nextTick();
    expect(renderer.setReported).toHaveBeenLastCalledWith(null);
    expect(renderer.setReported).toHaveBeenCalledTimes(2);
  });

  it('re-applies the set to a rebuilt renderer (context loss, floor, migration) and never to the old one', async () => {
    attachEvidence();
    const first = makeRenderer();
    const handle = shallowRef<CityRendererPort | null>(first);
    mountProbe(handle);
    useLensStore().setLens('findings');
    await nextTick();
    expect(first.setReported).toHaveBeenCalledTimes(1);
    handle.value = null;                                    // CityViewport disposes and clears the handle
    await nextTick();
    const rebuilt = makeRenderer();
    handle.value = rebuilt;                                 // …then constructs a new renderer
    await nextTick();
    expect(rebuilt.setReported).toHaveBeenCalledTimes(1);
    expect(rebuilt.setReported).toHaveBeenLastCalledWith(REPORTED());
    expect(first.setReported).toHaveBeenCalledTimes(1);
  });

  it('restores the category colours when the evidence goes away', async () => {
    attachEvidence();
    const renderer = makeRenderer();
    mountProbe(shallowRef<CityRendererPort | null>(renderer));
    useLensStore().setLens('findings');
    await nextTick();
    expect(useEvidenceStore().remove()).toBe(true);
    await nextTick();
    expect(renderer.setReported).toHaveBeenLastCalledWith(null);
  });
});

describe('CityStage in the findings lens (Y40)', () => {
  function mountStage(renderer = makeRenderer()) {
    const w = keep(mount(CityStage, {
      global: { provide: { [CITY_RENDERER_KEY as symbol]: shallowRef<CityRendererPort | null>(renderer) } },
    }));
    return { w, renderer };
  }

  it('shows no lens heading while the lens is off', () => {
    attachEvidence();
    expect(mountStage().w.find('.ci-city-lens').exists()).toBe(false);
  });

  it('shows the heading with the matched counts and the evidence badge, and drives the renderer', async () => {
    attachEvidence();
    useLensStore().setLens('findings');
    const { w, renderer } = mountStage();
    await nextTick();
    const heading = w.get('.ci-city-lens');
    expect(heading.get('.ci-city-lens__eyebrow').text()).toBe(LENS_EYEBROW);
    expect(heading.get('.ci-city-lens__title').text()).toBe(LENS_TITLE);
    expect(heading.get('.ci-city-lens__subtitle').text()).toBe(LENS_SUBTITLE(5, 2));
    expect(heading.text()).toContain(SYNTHETIC_VERSION);
    expect(heading.find('.ci-city-lens__stale').exists()).toBe(false);
    expect(renderer.setReported).toHaveBeenLastCalledWith(REPORTED());
  });

  it('keeps the lens on stale evidence and says so with COPY-16 under the heading', async () => {
    const report = attachEvidence('snapshot-older');
    useLensStore().setLens('findings');
    const { w, renderer } = mountStage();
    await nextTick();
    expect(w.get('.ci-city-lens__stale').text()).toBe(COPY_16(formatAbsoluteTime(report.importedAt, Intl)));
    expect(renderer.setReported).toHaveBeenLastCalledWith(REPORTED());
  });
});

describe('MetricLegend in the findings lens (Y40)', () => {
  it('names the two lens colours instead of the categories while the lens is on', async () => {
    attachEvidence();
    const w = keep(mount(MetricLegend));
    expect(w.findAll('.ci-legend__entry').map((e) => e.text())).toEqual(['typescript']);
    useLensStore().setLens('findings');
    await nextTick();
    expect(w.findAll('.ci-legend__entry').map((e) => e.text())).toEqual([LENS_LEGEND_REPORTED, LENS_LEGEND_NONE]);
    expect(w.findAll('.ci-legend__swatch-group .ci-legend__swatch')).toHaveLength(1);
    expect(w.find('.ci-legend__swatch--none').exists()).toBe(true);
  });
});

describe('the list-mode Reported column (Y40)', () => {
  it('adds a Reported column in list mode only: the count, or an em dash', async () => {
    attachEvidence();
    useLensStore().setLens('findings');
    const w = keep(mount(CodebaseFileList));
    expect(w.find('.ci-file-list__reported-head').exists()).toBe(false);   // beside the canvas, the city carries the lens
    useCityStore().setViewMode('list');
    await nextTick();
    expect(w.get('.ci-file-list__reported-head').text()).toBe(LENS_LIST_COLUMN);
    const cell = (i: number) => {
      const row = w.findAll('.ci-file-list__row').find((r) => r.text().startsWith(fileAt(i).path));
      if (!row) throw new Error(`no row for file ${i}`);
      return row.get('.ci-file-list__reported');
    };
    expect(cell(4).get('[aria-hidden="true"]').text()).toBe('3');
    expect(cell(9).get('[aria-hidden="true"]').text()).toBe('2');
    expect(cell(5).get('[aria-hidden="true"]').text()).toBe(LENS_LIST_NONE);
    expect(cell(4).get('.visually-hidden').text()).toBe(LENS_LIST_CELL(3));
    expect(cell(5).get('.visually-hidden').text()).toBe(LENS_LIST_CELL(0));
  });

  it('has no column once the lens is off', async () => {
    attachEvidence();
    useCityStore().setViewMode('list');
    const w = keep(mount(CodebaseFileList));
    await nextTick();
    expect(w.find('.ci-file-list__reported').exists()).toBe(false);
    expect(w.find('.ci-file-list__reported-head').exists()).toBe(false);
  });
});
```

- [ ] **Step 3: Run them and confirm they fail.** Run `npx vitest run tests/unit/lens-store.test.ts tests/component/renderer-reported.test.ts tests/component/findings-lens.test.ts` and paste the output.
  - Expected: `lens-store.test.ts` and `findings-lens.test.ts` fail to load (`src/ui/stores/lens-store` and `src/ui/screens/city/use-lens-renderer` do not exist). Once those exist, the `LENS_*` imports are `undefined` until Step 5.
  - `renderer-reported.test.ts` fails with `city.setReported is not a function` and `port.setReported is not a function`.
- [ ] **Step 4: The renderer.**
  - In `src/visualization/renderer-port.ts`, replace:

```ts
  setFilter(matching: ReadonlySet<EntityId> | null): void;  // null = unfiltered, empty = no matches
```

    with:

```ts
  setFilter(matching: ReadonlySet<EntityId> | null): void;  // null = unfiltered, empty = no matches
  /** Part 6 Y40, the findings lens. null = category colours. A set keeps categories[colorKey]
   *  on the measured lots it contains and paints every other measured lot `unavailable`;
   *  unavailable markers never change. A RECOLOUR ONLY: no relayout, no camera change. The
   *  renderer keeps the set across setColors and setLayout; a NEW renderer starts at null. */
  setReported(ids: ReadonlySet<EntityId> | null): void;
```

  - In `src/visualization/instanced-city.ts`:
    - In `interface CityMeshes`, replace `  setFilter(matching: ReadonlySet<EntityId> | null): void;` with:

```ts
  setFilter(matching: ReadonlySet<EntityId> | null): void;
  /** Part 6 Y40: see CityRendererPort.setReported. Colour only. */
  setReported(ids: ReadonlySet<EntityId> | null): void;
```

    - Replace `  let matching: ReadonlySet<EntityId> | null = null;` with:

```ts
  let matching: ReadonlySet<EntityId> | null = null;
  let reported: ReadonlySet<EntityId> | null = null;
```

    - Replace `  function paintInstances(mesh: InstancedMesh, lots: readonly CityLot[], current: CityPalette): void {` with:

```ts
  /** Part 6 Y40: the findings lens chooses between two palette members and nothing else. An
   *  unavailable marker is always the neutral; a measured lot keeps its category colour
   *  unless a lens is on and it is not reported. */
  function lotColour(lot: CityLot, current: CityPalette): string {
    if (lot.metricState === 'unavailable') return current.unavailable;
    if (reported !== null && !reported.has(lot.entityId)) return current.unavailable;
    return current.categories[lot.colorKey];
  }

  function paintInstances(mesh: InstancedMesh, lots: readonly CityLot[], current: CityPalette): void {
```

    - Replace:

```ts
      const base = new Color(
        lot.metricState === 'unavailable' ? current.unavailable : current.categories[lot.colorKey],
      );
```

      with:

```ts
      const base = new Color(lotColour(lot, current));
```

    - Replace:

```ts
      matching = next;
      repaint();
    },
```

      with:

```ts
      matching = next;
      repaint();
    },
    setReported(next: ReadonlySet<EntityId> | null): void {
      // null = category colours; a set = the findings lens. repaint() rewrites instance
      // colours only — never setMatrixAt — so nothing moves (Y40).
      reported = next;
      repaint();
    },
```

  - In `src/visualization/city-renderer.ts`:
    - In `makeInertPort`, replace `    setColors: () => {}, setSelection: () => {}, setFilter: () => {}, setLabels: () => {},` with:

```ts
    setColors: () => {}, setSelection: () => {}, setFilter: () => {}, setReported: () => {}, setLabels: () => {},
```

    - Replace `  let filter: ReadonlySet<EntityId> | null = null;` with:

```ts
  let filter: ReadonlySet<EntityId> | null = null;
  let reported: ReadonlySet<EntityId> | null = null;   // Part 6 Y40: re-applied to every new city
```

    - In `swapCity`, replace:

```ts
    if (palette) next.setColors(palette);
    next.setFilter(filter);
```

      with:

```ts
    next.setReported(reported);          // before setColors, so the first paint is already the lens
    if (palette) next.setColors(palette);
    next.setFilter(filter);
```

    - Replace:

```ts
    setFilter(matching: ReadonlySet<EntityId> | null): void {
      filter = matching;               // null = unfiltered, empty = no matches
      city?.setFilter(matching);
      scheduler.invalidate();
    },
```

      with:

```ts
    setFilter(matching: ReadonlySet<EntityId> | null): void {
      filter = matching;               // null = unfiltered, empty = no matches
      city?.setFilter(matching);
      scheduler.invalidate();
    },

    // Part 6 Y40: recolour only. Kept here as well as on the city, so a set sent before the
    // first layout, or before a rebuilt city lands, is applied by swapCity.
    setReported(ids: ReadonlySet<EntityId> | null): void {
      reported = ids;
      city?.setReported(ids);
      scheduler.invalidate();
    },
```

    - Check `city-renderer.ts` is still under 400 lines (about 389).
  - The renderer doubles. Each file below has exactly one matching line; change it in place so no line is added (`city-view-store-wiring.test.ts` is 450/450):
    - `tests/acceptance/world.ts`: `    setFilter: calls.setFilter, setLabels: vi.fn(), setCameraMode: calls.setCameraMode,` → `    setFilter: calls.setFilter, setReported: vi.fn(), setLabels: vi.fn(), setCameraMode: calls.setCameraMode,`
    - `tests/component/welcome-state.test.ts`, `codebase-file-list.test.ts`, `camera-controls.test.ts`, `file-inspector.test.ts`, `status-surfaces.test.ts`, `camera-round-trip.test.ts`, `city-viewport.test.ts`, `responsive-floor.test.ts`: `    setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setLabels: vi.fn(),` → `    setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setReported: vi.fn(), setLabels: vi.fn(),`
    - `tests/component/city-viewport-wiring.test.ts`: `    setFilter: vi.fn(), setLabels: vi.fn(),` → `    setFilter: vi.fn(), setReported: vi.fn(), setLabels: vi.fn(),`
    - `tests/component/stage-height.test.ts`: `    setFilter: vi.fn(), setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),` → `    setFilter: vi.fn(), setReported: vi.fn(), setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),`
    - `tests/host/city-view-cancel.test.ts`: `  setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(),` → the same line followed by ` setReported: vi.fn(),`
    - `tests/host/lifecycle-leaks.test.ts`, `tests/host/multi-leaf.test.ts`: `    setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(),` → the same line followed by ` setReported: vi.fn(),`
    - `tests/host/window-migration.test.ts`: `    setLayout: spies.setLayout, setColors: spies.setColors, setSelection: vi.fn(), setFilter: vi.fn(),` → the same line followed by ` setReported: vi.fn(),`
    - `tests/host/city-view-scan-modes.test.ts`, `tests/host/city-view-store-wiring.test.ts`, `tests/host/city-view.test.ts`: `  setFilter: vi.fn(),` → `  setFilter: vi.fn(), setReported: vi.fn(),`
  - Run `npx vitest run tests/component/renderer-reported.test.ts tests/component/renderer-contract.test.ts tests/component/renderer-disposal.test.ts tests/unit/city-renderer.test.ts`. `renderer-reported` passes now.

- [ ] **Step 5: The copy.** Append to the end of `src/ui/audit-copy/fallow.ts`, after whatever Tasks 5, 7, 8, 9 and 10 left there (an Edit anchored on the file's current last line). `COPY_16` is Task 8's and is not redefined (R4).

```ts

// Part 6 Task 11 (Y40): the findings lens.
export const LENS_LABEL = 'Colour';
export const LENS_OPTION_CATEGORY = 'Category';
export const LENS_OPTION_FINDINGS = 'Reported findings';
export const LENS_EYEBROW = 'fallow lens';
export const LENS_TITLE = 'Reported findings';
export const LENS_SUBTITLE = (findings: number, files: number): string =>
  `${findings} ${findings === 1 ? 'finding' : 'findings'} · ${files} ${files === 1 ? 'file' : 'files'} · imported evidence`;
export const LENS_LEGEND_REPORTED = 'Reported finding';
export const LENS_LEGEND_NONE = 'No finding reported · metric unavailable';
export const LENS_LIST_COLUMN = 'Reported';
export const LENS_LIST_NONE = '—';
/** Screen-reader text after a row's path, so the name reads "…/file-4.ts, 3 reported findings". */
export const LENS_LIST_CELL = (count: number): string =>
  (count === 0 ? ', no finding reported' : `, ${count} reported ${count === 1 ? 'finding' : 'findings'}`);
```

  - Before adding, run `grep -n "LENS_" src/ui/audit-copy/*.ts`. It must print nothing. If an earlier task took one of these names, stop and report it.
- [ ] **Step 6: The lens store.** Create `src/ui/stores/lens-store.ts`:

```ts
// Part 6 Y40: the city's colour lens, one per leaf (each CityView has its own Pinia).
// 'category' is the WP-01 colouring; 'findings' is the S15 findings lens, which needs
// imported evidence. A SETUP store, unlike its siblings, for one reason: it watches the
// evidence store, so the lens resets to 'category' the moment the bound codebase changes
// or its evidence goes away — whichever screen is open, not only while the toolbar that
// sets it is mounted. `flush: 'sync'` makes the reset part of the same call that removed
// the evidence, so no render and no renderer command ever sees the lens on without it.
// city-store's select, setQuery and setCamera are untouched (spec §6).
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useEvidenceStore } from './evidence-store';

export type LensId = 'category' | 'findings';
export const LENS_IDS: readonly LensId[] = ['category', 'findings'];

export const useLensStore = defineStore('lens', () => {
  const evidence = useEvidenceStore();
  const lens = ref<LensId>('category');

  /** Ignores an unknown id, and refuses 'findings' while there is no evidence: the control
   *  that offers it is not rendered then, so nothing legitimate asks. */
  function setLens(next: LensId): void {
    if (!LENS_IDS.includes(next)) return;
    if (next === 'findings' && evidence.report === null) return;
    lens.value = next;
  }

  function reset(): void {
    lens.value = 'category';
  }

  watch(
    [() => evidence.repositoryId, () => evidence.report !== null],
    ([repositoryId, hasEvidence], [previousRepositoryId]) => {
      if (repositoryId !== previousRepositoryId || !hasEvidence) reset();
    },
    { flush: 'sync' },
  );

  return { lens, setLens, reset };
});
```

- [ ] **Step 7: The shared lens view and the renderer wiring.**
  - Create `src/ui/read-models/use-lens-view.ts`:

```ts
// Part 6 Y40: the ONE derivation of "is the findings lens on, and which files are reported",
// shared by the renderer wiring (screens/city/use-lens-renderer.ts), MetricLegend, the lens
// heading and the list-mode column, so they can never disagree. The lens is active only
// while it is chosen AND the bound codebase has evidence (current or stale).
import { computed, type ComputedRef } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { useLensStore } from '../stores/lens-store';
import { useReadModels } from './use-read-models';
import type { EvidenceIndex } from './evidence-index';

/** Keyed by the leaf's own index object (E53), itself memoised per (files, report), so
 *  turning the lens on and off rebuilds nothing and hands the renderer the same Set. */
const reportedCache = new WeakMap<EvidenceIndex, ReadonlySet<EntityId>>();
function reportedIdsFor(index: EvidenceIndex): ReadonlySet<EntityId> {
  let hit = reportedCache.get(index);
  if (!hit) {
    hit = new Set([...index.byFile].filter(([, findings]) => findings.length > 0).map(([id]) => id));
    reportedCache.set(index, hit);
  }
  return hit;
}

interface LensView {
  active: ComputedRef<boolean>;
  evidence: ComputedRef<EvidenceIndex>;
  /** The reported files while the lens is active; null means category colours. */
  reported: ComputedRef<ReadonlySet<EntityId> | null>;
}

export function useLensView(): LensView {
  const lens = useLensStore();
  const { evidence } = useReadModels();
  const active = computed(() => lens.lens === 'findings' && evidence.value.state !== 'none');
  const reported = computed(() => (active.value ? reportedIdsFor(evidence.value) : null));
  return { active, evidence, reported };
}
```

  - Create `src/ui/screens/city/use-lens-renderer.ts`:

```ts
// Part 6 Y40: drives CityRendererPort.setReported from the lens. CityViewport.vue is at
// 400/400 and is not edited: this composable, used by CityStage.vue, reads the SAME shared
// handle CityViewport writes (renderer-handle.ts). A context-loss rebuild, a 320 px floor
// round trip, a pop-out migration and leaving list mode each construct a NEW renderer,
// which starts in category colours, so the set is re-sent whenever the handle changes.
// The renderer itself keeps the set across setColors and setLayout, so neither the theme
// refresh (city-view.ts's handle watcher, css-change) nor CityViewport's layout re-send can
// undo it, in whichever order those watchers run.
import { watch } from 'vue';
import type { EntityId } from '../../../domain/entity-id';
import type { CityRendererPort } from '../../../visualization/renderer-port';
import { useCityRendererHandle } from '../../renderer-handle';
import { useLensView } from '../../read-models/use-lens-view';

type Sources = readonly [CityRendererPort | null, ReadonlySet<EntityId> | null];
type PreviousSources = readonly [(CityRendererPort | null)?, (ReadonlySet<EntityId> | null)?];

/** A fresh renderer is already in category colours, so null is sent only to undo a set on
 *  the SAME renderer — never as a command to every new one (which also keeps renderer
 *  doubles that never see the lens free of it). */
function applyReported([renderer, ids]: Sources, [previousRenderer, previousIds]: PreviousSources): void {
  if (!renderer) return;
  if (ids === null && (renderer !== previousRenderer || !previousIds)) return;
  renderer.setReported(ids);
}

export function useLensRenderer(): void {
  const handle = useCityRendererHandle();
  const { reported } = useLensView();
  watch([() => handle.value, reported], applyReported, { immediate: true });
}
```

- [ ] **Step 8: The heading, and CityStage.**
  - Create `src/ui/screens/city/LensHeading.vue`:

```vue
<!--
  Part 6 Y40 (S15 zone 2): the findings-lens heading over the viewport — eyebrow, title, the
  matched counts and the C13 EvidenceBadge, plus COPY-16 when the evidence is stale (the lens
  stays available on stale evidence, Y30). Rendered only while the lens is active.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useLensView } from '../../read-models/use-lens-view';
import { formatAbsoluteTime } from '../../copy';
import { COPY_16, LENS_EYEBROW, LENS_SUBTITLE, LENS_TITLE } from '../../inspector-copy';
import EvidenceBadge from '../../kit/EvidenceBadge.vue';

const { active, evidence } = useLensView();
const report = computed(() => (active.value ? evidence.value.report : null));
const stale = computed(() => evidence.value.state === 'stale');
const subtitle = computed(() => LENS_SUBTITLE(evidence.value.matchedFindings, evidence.value.matchedFiles));
const staleNote = computed(() => (report.value && stale.value ? COPY_16(formatAbsoluteTime(report.value.importedAt, Intl)) : null));
</script>

<template>
  <div
    v-if="report"
    class="ci-city-lens"
  >
    <div class="ci-city-lens__text">
      <p class="ci-city-lens__eyebrow">
        {{ LENS_EYEBROW }}
      </p>
      <h3 class="ci-city-lens__title">
        {{ LENS_TITLE }}
      </h3>
      <p class="ci-city-lens__subtitle">
        {{ subtitle }}
      </p>
      <p
        v-if="staleNote"
        class="ci-city-lens__stale"
      >
        {{ staleNote }}
      </p>
    </div>
    <EvidenceBadge
      :version="report.providerVersion"
      :state="stale ? 'stale' : 'imported'"
    />
  </div>
</template>
```

  - In `src/ui/components/CityStage.vue`:
    - Replace `import MetricLegend from './MetricLegend.vue';` with:

```ts
import MetricLegend from './MetricLegend.vue';
import LensHeading from '../screens/city/LensHeading.vue';
import { useLensRenderer } from '../screens/city/use-lens-renderer';
```

    - Replace `const store = useCityStore();` with:

```ts
const store = useCityStore();
// Part 6 Y40: the findings lens reaches the renderer from here. CityViewport.vue is at
// 400/400 and is not edited — see use-lens-renderer.ts.
useLensRenderer();
```

    - Replace `    <CityHeader />` with:

```html
    <CityHeader />
    <LensHeading />
```

- [ ] **Step 9: The toolbar select.** In `src/ui/components/AppToolbar.vue` (after Task 1's change):
  - Replace `import FileSearch from './FileSearch.vue';` with:

```ts
import FileSearch from './FileSearch.vue';
import { useEvidenceStore } from '../stores/evidence-store';
import { LENS_IDS, useLensStore, type LensId } from '../stores/lens-store';
import { useUniqueId } from '../unique-id';
import { LENS_LABEL, LENS_OPTION_CATEGORY, LENS_OPTION_FINDINGS } from '../inspector-copy';

/** Part 6 Y40: the findings-lens control. Rendered only while the bound codebase has
 *  evidence (`v-if`), so it is never a disabled control; the lens store resets itself to
 *  'category' when the evidence goes away or the codebase changes. */
const evidence = useEvidenceStore();
const lensStore = useLensStore();
const lensSelectId = useUniqueId('ci-toolbar-lens');
const LENS_OPTION_LABELS: Readonly<Record<LensId, string>> = {
  category: LENS_OPTION_CATEGORY, findings: LENS_OPTION_FINDINGS,
};
const lens = computed<LensId>({
  get: () => lensStore.lens,
  set: (next) => { lensStore.setLens(next); },
});
```

  - Replace `    <FileSearch />` with:

```html
    <FileSearch />
    <!-- Part 6 Y40: the findings lens. Only while this codebase has evidence (never a
         disabled control); the visible label is the select's accessible name. -->
    <span
      v-if="evidence.report"
      class="ci-toolbar__lens-field"
    >
      <label
        class="ci-toolbar__lens-label"
        :for="lensSelectId"
      >{{ LENS_LABEL }}</label>
      <select
        :id="lensSelectId"
        v-model="lens"
        class="dropdown ci-toolbar__lens"
      >
        <option
          v-for="id in LENS_IDS"
          :key="id"
          :value="id"
        >
          {{ LENS_OPTION_LABELS[id] }}
        </option>
      </select>
    </span>
```

  - `computed` is already imported from `vue` in this file. If Task 1 removed it, add it back to that import.

- [ ] **Step 10: The legend.** In `src/ui/components/MetricLegend.vue`:
  - Replace `import { LEGEND_EQUAL_LOT, LEGEND_SELECTION_OUTLINE, LEGEND_UNKNOWN_MARKER } from '../copy';` with:

```ts
import { LEGEND_EQUAL_LOT, LEGEND_SELECTION_OUTLINE, LEGEND_UNKNOWN_MARKER } from '../copy';
import { LENS_LEGEND_NONE, LENS_LEGEND_REPORTED } from '../inspector-copy';
import { useLensView } from '../read-models/use-lens-view';
```

  - Replace `const hasUnavailableLot = computed(() => (store.layout?.lots ?? []).some((l) => l.metricState === 'unavailable'));` with:

```ts
const hasUnavailableLot = computed(() => (store.layout?.lots ?? []).some((l) => l.metricState === 'unavailable'));

/** Part 6 Y40: in the findings lens the city carries two meanings, so the legend states
 *  exactly those two. Reported lots keep their category colours (the swatches are the
 *  categories the reported, measured lots actually have); every other measured lot is the
 *  unavailable neutral, --ci-text-muted, the token theme-bridge.ts reads into it. */
const { active: lensActive, reported } = useLensView();
const reportedCategories = computed(() => {
  const ids = reported.value;
  if (!ids) return [];
  const present = new Set((store.layout?.lots ?? [])
    .filter((l) => l.metricState !== 'unavailable' && ids.has(l.entityId))
    .map((l) => l.colorKey));
  return CATEGORY_IDS.filter((id) => present.has(id));
});
```

  - Replace `    <ul class="ci-legend__swatches">` with:

```html
    <ul
      v-if="lensActive"
      class="ci-legend__swatches"
    >
      <li class="ci-legend__entry">
        <span
          class="ci-legend__swatch-group"
          aria-hidden="true"
        >
          <span
            v-for="categoryId in reportedCategories"
            :key="categoryId"
            class="ci-legend__swatch"
            :style="{ background: `var(--ci-cat-${categoryId})` }"
          />
        </span>
        <span class="ci-legend__label">{{ LENS_LEGEND_REPORTED }}</span>
      </li>
      <li class="ci-legend__entry">
        <span
          class="ci-legend__swatch ci-legend__swatch--none"
          aria-hidden="true"
        />
        <span class="ci-legend__label">{{ LENS_LEGEND_NONE }}</span>
      </li>
    </ul>
    <ul
      v-else
      class="ci-legend__swatches"
    >
```

- [ ] **Step 11: The list-mode Reported column.**
  - In `src/ui/components/file-list-types.ts`, replace:

```ts
export interface RowState {
  dimmed: boolean;
  tabIndex: number;
  selected: boolean;
}
```

    with:

```ts
export interface RowState {
  dimmed: boolean;
  tabIndex: number;
  selected: boolean;
  /** Part 6 Y40: the row's reported-finding count while the list-mode Reported column is
   *  shown (0 renders an em dash); null when the column is off. */
  reported: number | null;
}
```

  - In `src/ui/components/CodebaseFileList.vue`:
    - Replace `import type { CodeEntity } from '../../domain/model';` with:

```ts
import type { CodeEntity } from '../../domain/model';
import { useLensView } from '../read-models/use-lens-view';
import { LENS_LIST_COLUMN } from '../inspector-copy';
```

    - Replace `const renderer = useCityRendererHandle();` with:

```ts
const renderer = useCityRendererHandle();
/** Part 6 Y40: the Reported column, in list mode only — beside the canvas, the city itself
 *  carries the lens. */
const { active: lensActive, evidence } = useLensView();
const reportedColumn = computed(() => lensActive.value && store.viewMode === 'list');
```

    - In `rowStates`, replace:

```ts
      selected: entity.id === store.selectedEntityId,
    });
```

      with:

```ts
      selected: entity.id === store.selectedEntityId,
      reported: reportedColumn.value ? (evidence.value.byFile.get(entity.id)?.length ?? 0) : null,
    });
```

    - Replace:

```html
    <div class="ci-file-list__header">
      <h3 class="ci-file-list__title">
```

      with:

```html
    <div class="ci-file-list__header">
      <span
        v-if="reportedColumn"
        class="ci-file-list__reported-head"
        aria-hidden="true"
      >{{ LENS_LIST_COLUMN }}</span>
      <h3 class="ci-file-list__title">
```

  - In `src/ui/components/CodebaseFileListGroup.vue`:
    - Replace `import { formatDirectoryFocusLabel, formatFileListGroup } from '../copy';` with:

```ts
import { formatDirectoryFocusLabel, formatFileListGroup } from '../copy';
import { LENS_LIST_CELL, LENS_LIST_NONE } from '../inspector-copy';
```

    - Replace `const FALLBACK_ROW_STATE: RowState = { dimmed: false, tabIndex: -1, selected: false };` with:

```ts
const FALLBACK_ROW_STATE: RowState = { dimmed: false, tabIndex: -1, selected: false, reported: null };
```

    - Replace:

```ts
function focusDistrict(): void {
  emit('focusDistrict', props.group.directoryId);
}
```

      with:

```ts
function focusDistrict(): void {
  emit('focusDistrict', props.group.directoryId);
}

/** Part 6 Y40: the Reported cell — the count, or an em dash for none (never a 0 that could
 *  read as "measured clean"), with a spoken phrase after the path. */
function reportedText(count: number | null): string {
  return count === null || count === 0 ? LENS_LIST_NONE : String(count);
}
function reportedLabel(count: number | null): string {
  return LENS_LIST_CELL(count ?? 0);
}
```

    - Replace `four below, so a keystroke` with `five below (Part 6 Y40 added the Reported count), so a keystroke`.
    - Replace:

```html
          rowState(entity.id).tabIndex,
        ]"
```

      with:

```html
          rowState(entity.id).tabIndex,
          rowState(entity.id).reported,
        ]"
```

    - Replace:

```html
          >{{ segment.text }}<wbr v-if="segment.wbr"></span>
        </button>
```

      with:

```html
          >{{ segment.text }}<wbr v-if="segment.wbr"></span>
          <span
            v-if="rowState(entity.id).reported !== null"
            class="ci-file-list__reported"
          ><span aria-hidden="true">{{ reportedText(rowState(entity.id).reported) }}</span><span class="visually-hidden">{{ reportedLabel(rowState(entity.id).reported) }}</span></span>
        </button>
```

- [ ] **Step 12: The CSS.**
  - In `src/ui/styles/screens.css`, after the last line `:where(.codebase-inspector-root) .ci-city-summary__caption { color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }`, add:

```css

/* Part 6 Y40: the findings lens — the heading over the viewport (city/LensHeading.vue), the
   legend rows (MetricLegend.vue) and the list-mode Reported column (CodebaseFileList). The
   "no finding" swatch is --ci-text-muted, the token theme-bridge.ts reads into
   CityPalette.unavailable, so the legend and the city agree in every theme. */
:where(.codebase-inspector-root) .ci-city-lens {
  display: flex; align-items: flex-start; justify-content: space-between; gap: var(--ci-space-3);
  flex: 0 0 auto; padding: var(--ci-space-2) 0;
}
:where(.codebase-inspector-root) .ci-city-lens__text { min-width: 0; }
:where(.codebase-inspector-root) .ci-city-lens__eyebrow {
  margin: 0; color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em);
  font-weight: var(--font-semibold); letter-spacing: 0.06em; text-transform: uppercase;
}
:where(.codebase-inspector-root) .ci-city-lens__title { margin: var(--ci-space-1) 0 0; font-size: 1.1em; font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-city-lens__subtitle { margin: var(--ci-space-1) 0 0; color: var(--ci-text-muted); font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-city-lens__stale { margin: var(--ci-space-1) 0 0; color: var(--ci-warning); font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-legend__swatch-group { display: inline-flex; gap: 2px; }
:where(.codebase-inspector-root) .ci-legend__swatch--none { background: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-file-list__reported,
:where(.codebase-inspector-root) .ci-file-list__reported-head {
  float: right; margin-left: var(--ci-space-2); color: var(--ci-text-muted); font-variant-numeric: tabular-nums;
}
:where(.codebase-inspector-root) .ci-file-list__reported-head { font-size: var(--font-ui-smaller, 0.8em); font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) button.ci-file-list__row--selected .ci-file-list__reported { color: inherit; }
```

  - In `src/ui/styles/shell.css`, after the last line `:where(.codebase-inspector-root) .ci-app__toolbar { flex-wrap: wrap; }` (if Task 1 appended below it, append at the very end instead), add:

```css

/* Part 6 Y40: the findings-lens select, rendered only while this codebase has evidence. The
   visible label is the select's accessible name (WCAG 2.5.3). */
:where(.codebase-inspector-root) .ci-toolbar__lens-field { display: inline-flex; align-items: center; gap: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-toolbar__lens-label {
  color: var(--ci-text-muted); font-size: var(--font-ui-small, 0.9em); white-space: nowrap;
}
:where(.codebase-inspector-root) select.ci-toolbar__lens { min-height: var(--ci-control-min); }
```

- [ ] **Step 13: Run and confirm they pass.**
  - Run `npx vitest run tests/unit/lens-store.test.ts tests/component/renderer-reported.test.ts tests/component/findings-lens.test.ts tests/component/renderer-contract.test.ts tests/component/renderer-disposal.test.ts tests/unit/city-renderer.test.ts tests/component/metric-legend.test.ts tests/component/codebase-file-list.test.ts tests/component/toolbar-scan.test.ts tests/component/city-viewport.test.ts tests/component/city-viewport-wiring.test.ts tests/component/stage-height.test.ts tests/component/welcome-state.test.ts tests/component/camera-controls.test.ts tests/component/file-inspector.test.ts tests/component/status-surfaces.test.ts tests/component/camera-round-trip.test.ts tests/component/responsive-floor.test.ts tests/host/city-view-cancel.test.ts tests/host/city-view-scan-modes.test.ts tests/host/city-view-store-wiring.test.ts tests/host/city-view.test.ts tests/host/lifecycle-leaks.test.ts tests/host/multi-leaf.test.ts tests/host/window-migration.test.ts tests/acceptance tests/unit/css-class-scope.test.ts tests/unit/visualization-rules.test.ts` and paste the output.
  - Gate: `npm run typecheck && npm run lint:fast && npx vitest run <the list above>`, then `npx eslint src/visualization/renderer-port.ts src/visualization/instanced-city.ts src/visualization/city-renderer.ts src/ui/stores/lens-store.ts src/ui/read-models/use-lens-view.ts src/ui/screens/city/use-lens-renderer.ts src/ui/screens/city/LensHeading.vue src/ui/components/CityStage.vue src/ui/components/AppToolbar.vue src/ui/components/MetricLegend.vue src/ui/components/CodebaseFileList.vue src/ui/components/CodebaseFileListGroup.vue src/ui/components/file-list-types.ts src/ui/audit-copy/fallow.ts tests/fixtures/evidence-report.ts tests/unit/lens-store.test.ts tests/component/renderer-reported.test.ts tests/component/findings-lens.test.ts tests/acceptance/world.ts tests/component/welcome-state.test.ts tests/component/codebase-file-list.test.ts tests/component/camera-controls.test.ts tests/component/file-inspector.test.ts tests/component/status-surfaces.test.ts tests/component/camera-round-trip.test.ts tests/component/city-viewport.test.ts tests/component/city-viewport-wiring.test.ts tests/component/responsive-floor.test.ts tests/component/stage-height.test.ts tests/host/city-view-cancel.test.ts tests/host/city-view-scan-modes.test.ts tests/host/city-view-store-wiring.test.ts tests/host/city-view.test.ts tests/host/lifecycle-leaks.test.ts tests/host/multi-leaf.test.ts tests/host/window-migration.test.ts --max-warnings 0`.
  - Report the line counts of `instanced-city.ts`, `city-renderer.ts` (must be < 400), `AppToolbar.vue` and `CityStage.vue`, and confirm `CityViewport.vue` is unchanged (`git diff --stat -- src/ui/components/CityViewport.vue` prints nothing) and no test file grew past 450.
- [ ] **Step 14: Commit** only this task's files: `feat(ui): the findings lens — setReported on the renderer, the toolbar Colour select, lens heading, legend rows and the list-mode Reported column (Y40)`, ending with a blank line and `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

### Task 12: Harness, captures, evidence counts, verification (final; controller)

**This task is run by the controller, not dispatched to an implementer.**

**Files:**
- Modify: `tests/harness/seed.ts` (Task 1's ~63 → ~105): the demo report, built through the real reader and builder, plus the footer text.
- Modify: `tests/harness/mount.ts` (Task 1's ~283 → ~328): the session evidence repository and the `report`, `lens` and `fallow` options.
- Modify: `tests/harness/page.ts` (Task 1's ~55 → ~67): parameters, header lines, the synthetic-data footer.
- Modify: `tests/harness/harness.css` (27 → ~38): the footer caption.
- Modify: `scripts/harness-shot.mjs` (244 → ~255): the six R8 shots.
- Test: `tests/harness/harness-evidence.test.ts` (new, ~80; the Harness layer goes from 1 file to 2), `tests/build/harness-shot.test.ts` (83 → ~99).
- Modify: `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` and `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md` (derived counts only).

**Interfaces:**
- Consumes:
  - Task 1: `?run=cancelling`. `HarnessOptions.run` is `'running' | 'cancelling'`, and `mount.ts` imports `{ cancellingLifecycle, demoImportJson, runningLifecycle, seedDemoItems }` from `./seed`.
  - Task 5 (R4): `parseFallowReportText` (`src/application/evidence/read-fallow-report.ts`).
  - Task 6 (R4): `buildEvidenceReport` (`src/application/evidence/normalize-fallow.ts`), `resolveFindings` (`src/application/evidence/resolve-findings.ts`), `EvidenceReport` (`src/application/evidence/model.ts`).
  - Task 7 (R7): `useEvidenceStore` (`setRepository`, `bindRepository`, `attach`, `requestImport`, `report`), `InMemoryEvidenceStore`.
  - Task 8: `evidenceIndexFor`; the full `tests/fixtures/evidence-report.ts` (R5): `syntheticFallowJson`, `SYNTHETIC_VERSION`, `ALL_ANALYSED`.
  - Task 10: the fallow card's `.ci-fallow-card__import`. `ConnectFallowDialog`'s visually hidden `<input type="file" class="ci-connect-fallow__file">` sits OUTSIDE the `CiDialog` focus trap, and its review step renders `.ci-connect-fallow__attach`. `SourcesScreen` watches `importRequested` (immediate) and opens the dialog one tick after consuming it.
  - Task 11: `useLensStore`, and `snapshotWithOnlyFiles` in `evidence-report.ts`.
- Produces (harness only, never imported by `src`):
  - `DEMO_FALLOW_FILE_NAME`, `DEMO_UNMATCHED_PATH`, `HARNESS_SYNTHETIC_FOOTER`;
  - `filePathsOf(snapshot): string[]`, `demoFallowReportText(snapshot): string`, `demoEvidenceReport(snapshot): EvidenceReport`;
  - the URL parameters `?report=demo`, `?lens=findings` (needs `report=demo`) and `?fallow=review` (needs `route=sources`).

- [ ] **Step 1: Write the failing tests.**
  - Create `tests/harness/harness-evidence.test.ts`:

```ts
// Part 6 §5: ?report=demo and ?fallow=review. The harness report is the shared fixture's
// syntheticFallowJson (R5), cut down to ten harness files, run through the REAL reader and
// builder and attached through the real evidence store. So every capture that shows it says
// "fallow · imported report" because it took the real path. This file keeps that path alive
// under the ordinary suite, the way harness.test.ts keeps the page itself alive.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { resolveFindings } from '../../src/application/evidence/resolve-findings';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { ALL_ANALYSED, SYNTHETIC_VERSION } from '../fixtures/evidence-report';
import {
  DEMO_FALLOW_FILE_NAME, DEMO_UNMATCHED_PATH, HARNESS_SYNTHETIC_FOOTER, demoEvidenceReport, demoFallowReportText,
  filePathsOf,
} from './seed';
import { harnessSnapshot } from './fixture';

describe('the harness fallow report (?report=demo)', () => {
  it('is a combined schema-12 fallow 3.27.0 report that the real reader accepts', () => {
    const read = parseFallowReportText(demoFallowReportText(harnessSnapshot()));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect([read.report.kind, read.report.schema_version, read.report.version]).toEqual(['combined', 12, SYNTHETIC_VERSION]);
  });

  it('carries no source text: no fragment, actions or suggestions anywhere', () => {
    const text = demoFallowReportText(harnessSnapshot());
    for (const key of ['"fragment"', '"actions"', '"suggestions"']) expect(text.includes(key), key).toBe(false);
  });

  // syntheticFallowJson over ten files gives:
  // - 10 unused findings (types on the 4th and 8th file);
  // - 5 complexity findings (files 0, 2, 4, 6 and 8);
  // - 4 duplication findings (clone groups at 0-1 and 5-6);
  // - plus one `orphan` export on the unmatched path.
  it('matches nineteen findings on ten harness files and leaves exactly one path unmatched', () => {
    const snapshot = harnessSnapshot();
    const report = demoEvidenceReport(snapshot);
    const { matched, unmatchedPaths } = resolveFindings(report.normalized.findings, new Set(filePathsOf(snapshot)));
    expect(unmatchedPaths).toEqual([DEMO_UNMATCHED_PATH]);
    expect(matched).toHaveLength(19);
    expect(new Set(matched.map((f) => f.path)).size).toBe(10);
    expect(report.normalized.categories).toEqual(ALL_ANALYSED);
  });

  it('keeps its provenance, and says it is synthetic', () => {
    const snapshot = harnessSnapshot();
    expect(demoEvidenceReport(snapshot)).toMatchObject({
      provider: 'fallow', providerVersion: SYNTHETIC_VERSION, reportKind: 'combined', schemaVersion: 12,
      fileName: DEMO_FALLOW_FILE_NAME, snapshotId: snapshot.snapshotId, stripPrefix: null,
    });
    expect(DEMO_FALLOW_FILE_NAME).toMatch(/synthetic/);
    expect(HARNESS_SYNTHETIC_FOOTER).toMatch(/synthetic/i);
  });
});

describe('attaching it the way mount.ts does', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('reads as current, collected evidence for the harness snapshot, with most files unreported', () => {
    const snapshot = harnessSnapshot();
    const evidence = useEvidenceStore();
    evidence.setRepository(new InMemoryEvidenceStore());
    evidence.bindRepository(snapshot.repositoryId);
    expect(evidence.attach(demoEvidenceReport(snapshot))).toBe(true);
    const index = evidenceIndexFor(fileSummariesFor(snapshot), evidence.report, snapshot.snapshotId);
    expect(index.state).toBe('current');
    expect(index.matchedFindings).toBe(19);
    expect(index.matchedFiles).toBe(10);
    expect(index.totals.findings.state).toBe('collected');
  });
});
```

  - In `tests/build/harness-shot.test.ts`, replace:

```ts
    expect(shotQuery('wp02-settings-import-dark').get('tab')).toBe('privacy');
  });
});
```

    with:

```ts
    expect(shotQuery('wp02-settings-import-dark').get('tab')).toBe('privacy');
  });

  it('captures the Part 6 states: cancelling, the fallow card, the S14 review step, real findings, the lens', () => {
    expect(shotQuery('wp02-city-cancelling-dark').get('run')).toBe('cancelling');
    for (const id of ['wp02-sources-fallow-dark', 'wp02-quality-fallow-dark', 'wp02-city-lens-dark', 'wp02-city-lens-light']) {
      expect(shotQuery(id).get('report'), id).toBe('demo');
    }
    expect(shotQuery('wp02-sources-fallow-dark').get('route')).toBe('sources');
    expect(shotQuery('wp02-quality-fallow-dark').get('route')).toBe('quality');
    expect(shotQuery('wp02-connect-fallow-review-dark').get('route')).toBe('sources');
    expect(shotQuery('wp02-connect-fallow-review-dark').get('fallow')).toBe('review');
    for (const theme of ['dark', 'light']) {
      const q = shotQuery(`wp02-city-lens-${theme}`);
      expect(q.get('theme')).toBe(theme);
      expect(q.get('route')).toBe('city');
      expect(q.get('lens')).toBe('findings');
    }
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/harness/harness-evidence.test.ts tests/build/harness-shot.test.ts`.
  - Expected: `harness-evidence.test.ts` fails to load, because `./seed` exports none of the demo fallow names.
  - `harness-shot.test.ts`'s new test fails with `null` params, because the shots do not exist.
- [ ] **Step 3: `seed.ts`.**
  - Replace `import { REVIEW_STATE_SCHEMA_V1 } from '../../src/ui/read-models/review-state';` with:

```ts
import { REVIEW_STATE_SCHEMA_V1 } from '../../src/ui/read-models/review-state';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { EvidenceReport } from '../../src/application/evidence/model';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { snapshotWithOnlyFiles, syntheticFallowJson } from '../fixtures/evidence-report';
```

  - Replace the end of `demoImportJson`:

```ts
    report: { sections: { ...sections }, note: '' },
  }, null, 2);
}
```

    with:

```ts
    report: { sections: { ...sections }, note: '' },
  }, null, 2);
}

/** Part 6 §5: the synthetic report's own file name says what it is on every surface that
 *  shows it (the fallow card's diagnostics, the S14 review step). */
export const DEMO_FALLOW_FILE_NAME = 'synthetic-harness-fallow-report.json';
/** Not a harness path, so the review step and the fallow card show one unmatched path. */
export const DEMO_UNMATCHED_PATH = 'generated/schema.ts';
/** page.ts's caption whenever the synthetic report is on the page. */
export const HARNESS_SYNTHETIC_FOOTER = 'Harness · synthetic fallow report built from the fixture’s own paths · not a repository analysis';
const DEMO_WARNING = 'Synthetic harness diagnostic: package exports were not resolved.';
/** Ten MEASURED files (1–3 are the fixture's unavailable ones), spread over all six
 *  districts, so the lens shows reported lots among unreported ones. */
const DEMO_FILE_INDEXES: readonly number[] = [4, 10, 23, 31, 40, 57, 66, 88, 101, 120];

export function filePathsOf(snapshot: CodebaseSnapshot): string[] {
  return snapshot.entities.filter((e) => e.kind === 'file').map((e) => e.path);
}

/** R5: the shared fixture's real-shaped fallow 3.27.0 JSON, for the ten demo files plus one
 *  path the snapshot does not have. It is the file `?fallow=review` picks. */
export function demoFallowReportText(snapshot: CodebaseSnapshot): string {
  const paths = filePathsOf(snapshot);
  const demoPaths = DEMO_FILE_INDEXES.map((i) => {
    const path = paths[i];
    if (path === undefined) throw new Error(`harness: report=demo needs a file at index ${i}`);
    return path;
  });
  return syntheticFallowJson(snapshotWithOnlyFiles(snapshot, demoPaths), {
    unmatchedPaths: [DEMO_UNMATCHED_PATH], warning: DEMO_WARNING,
  });
}

/** What the S14 dialog attaches for that file: the real reader, then the real builder. A
 *  refusal throws, and the page error fails `npm run harness-shot`. */
export function demoEvidenceReport(snapshot: CodebaseSnapshot): EvidenceReport {
  const read = parseFallowReportText(demoFallowReportText(snapshot));
  if (!read.ok) throw new Error(`harness: report=demo was refused by the real reader (${read.code} ${read.detail})`);
  return buildEvidenceReport({
    raw: read.report, fileName: DEMO_FALLOW_FILE_NAME, importedAt: AT.toISOString(),
    snapshotId: snapshot.snapshotId, stripPrefix: null,
  });
}
```

- [ ] **Step 4: `mount.ts`.**
  - Replace `import { useRunStore } from '../../src/ui/stores/run-store';` with:

```ts
import { useRunStore } from '../../src/ui/stores/run-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useLensStore } from '../../src/ui/stores/lens-store';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
```

  - Replace Task 1's `import { cancellingLifecycle, demoImportJson, runningLifecycle, seedDemoItems } from './seed';` with:

```ts
import {
  DEMO_FALLOW_FILE_NAME, cancellingLifecycle, demoEvidenceReport, demoFallowReportText, demoImportJson,
  runningLifecycle, seedDemoItems,
} from './seed';
```

  - In `HarnessOptions`, replace `  importFile?: 'demo';` with:

```ts
  importFile?: 'demo';
  report?: 'demo';
  lens?: 'findings';
  fallow?: 'review';
```

  - Replace `  app.use(createPinia());` with:

```ts
  const pinia = createPinia();
  app.use(pinia);
  // Part 6 Y28: what wireDataPorts gives a real CityView — one session evidence repository.
  // The harness has one leaf, so one instance. Set before mount, so App's repository watcher
  // binds the evidence store against it.
  useEvidenceStore(pinia).setRepository(new InMemoryEvidenceStore());
```

  - Replace:

```ts
  const route = options.route ?? 'city';
  store.navigate(route);
```

    with:

```ts
  if (options.report === 'demo') {
    // Part 6 §5: a SYNTHETIC fallow report (seed.ts) through the real reader, builder and
    // evidence store, so every surface says "fallow · imported report" because it took the
    // real path. Bound here rather than left to App's repository watcher, which runs only on
    // the next flush; binding the same id again is a no-op (R7).
    const snapshot = store.snapshot;
    if (!snapshot) throw new Error('harness: report=demo found no snapshot');
    const evidence = useEvidenceStore();
    evidence.bindRepository(snapshot.repositoryId);
    if (!evidence.attach(demoEvidenceReport(snapshot))) throw new Error('harness: report=demo was refused by the evidence store');
  }
  if (options.lens === 'findings') {
    // Part 6 Y40: the select exists only with evidence, and so does the lens.
    const lens = useLensStore();
    lens.setLens('findings');
    if (lens.lens !== 'findings') throw new Error('harness: lens=findings needs report=demo');
  }

  const route = options.route ?? 'city';
  store.navigate(route);
```

  - Replace:

```ts
      await until(() => root.querySelector('.ci-dialog') !== null);
    }
    document.body.dataset.ciHarnessReady = 'true';
    return;
```

    with:

```ts
      await until(() => root.querySelector('.ci-dialog') !== null);
    }
    if (options.fallow === 'review') {
      // Part 6 Y38: the S14 dialog at its review step. requestImport() is the command's own
      // path (Y39): SourcesScreen consumes it and opens the dialog a tick later. As for
      // import=demo, a capture cannot use the file picker, so the dialog's own hidden input
      // (Task 10: `.ci-connect-fallow__file`, outside the CiDialog focus trap) gets the
      // synthetic report and the `change` event a real pick fires. The review step is the
      // one that renders Attach.
      const snapshot = store.snapshot;
      if (route !== 'sources' || !snapshot) throw new Error('harness: fallow=review needs route=sources and a snapshot');
      useEvidenceStore().requestImport();
      await until(() => root.querySelector('.ci-connect-fallow__file') !== null);
      const input = root.querySelector<HTMLInputElement>('.ci-connect-fallow__file');
      if (!input) throw new Error('harness: fallow=review found no file input in the dialog');
      const transfer = new DataTransfer();
      transfer.items.add(new File([demoFallowReportText(snapshot)], DEMO_FALLOW_FILE_NAME, { type: 'application/json' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
      await until(() => root.querySelector('.ci-connect-fallow__attach') !== null);
    }
    document.body.dataset.ciHarnessReady = 'true';
    return;
```

  - If Task 10's final text names the input or the Attach button differently, use its classes and say so in the ledger.

- [ ] **Step 5: `page.ts` and `harness.css`.**
  - In `page.ts`, replace the header line `//   ?import=demo       open the import dialog with a fixed v1 file (settings, tab=privacy)` with:

```ts
//   ?import=demo       open the import dialog with a fixed v1 file (settings, tab=privacy)
//   ?report=demo       attach a SYNTHETIC fallow report built from the fixture's paths (any route)
//   ?lens=findings     turn the findings lens on (city, with report=demo)
//   ?fallow=review     open the Connect fallow dialog at its review step (sources)
```

  - Replace `import { isRouteId } from '../../src/domain/route-ids';` with:

```ts
import { isRouteId } from '../../src/domain/route-ids';
import { HARNESS_SYNTHETIC_FOOTER } from './seed';
```

  - Replace `if (width !== null && /^\d+$/.test(width)) leaf.style.width = `${width}px`;` with:

```ts
if (width !== null && /^\d+$/.test(width)) leaf.style.width = `${width}px`;

// Part 6 §5: a page carrying the synthetic fallow report says so, outside the plugin's own
// root, the way the design mockups carry their "synthetic data" caption.
if (params.get('report') === 'demo' || params.get('fallow') === 'review') {
  document.body.createEl('footer', { cls: 'ci-harness-footer', text: HARNESS_SYNTHETIC_FOOTER });
}
```

  - Replace:

```ts
  ...(params.get('import') === 'demo' ? { importFile: 'demo' as const } : {}),
});
```

    with:

```ts
  ...(params.get('import') === 'demo' ? { importFile: 'demo' as const } : {}),
  ...(params.get('report') === 'demo' ? { report: 'demo' as const } : {}),
  ...(params.get('lens') === 'findings' ? { lens: 'findings' as const } : {}),
  ...(params.get('fallow') === 'review' ? { fallow: 'review' as const } : {}),
});
```

  - Append to `tests/harness/harness.css`:

```css
/* Part 6 §5: the synthetic-data caption (page.ts). Fixed, so it never changes the leaf's box,
   and outside .codebase-inspector-root, like everything else in this sheet. */
.ci-harness-footer {
  position: fixed; right: 8px; bottom: 6px; margin: 0; padding: 2px 6px;
  font: 11px/1.4 var(--font-interface, sans-serif); color: var(--text-muted);
  background: var(--background-primary); border: 1px solid var(--background-modifier-border);
  border-radius: 4px; pointer-events: none;
}
```

- [ ] **Step 6: The shots.** In `scripts/harness-shot.mjs`, replace `  { id: 'wp02-settings-import-dark', query: '?screen=s05&theme=dark&route=settings&tab=privacy&import=demo' },` with:

```js
  { id: 'wp02-settings-import-dark', query: '?screen=s05&theme=dark&route=settings&tab=privacy&import=demo' },
  // WP-02 Part 6: compare against docs/concept/prototype/screenshots/scan-progress-dark.png
  // (cancelling), sources-dark.png (the fallow card), source-wizard-dark.png (the S14 review
  // step), quality-dark.png and finding-review-dark.png (real findings), city-{dark,light}.png,
  // and the design mockups docs/concept/design/mockups/s12-cancelled.png, s14-provider.png and
  // s15-findings.png. report=demo and fallow=review use a SYNTHETIC report (tests/harness/seed.ts).
  { id: 'wp02-city-cancelling-dark', query: '?screen=s05&theme=dark&route=city&run=cancelling' },
  { id: 'wp02-sources-fallow-dark', query: '?screen=s05&theme=dark&route=sources&report=demo' },
  { id: 'wp02-connect-fallow-review-dark', query: '?screen=s05&theme=dark&route=sources&fallow=review' },
  { id: 'wp02-quality-fallow-dark', query: '?screen=s05&theme=dark&route=quality&report=demo' },
  { id: 'wp02-city-lens-dark', query: '?screen=s05&theme=dark&route=city&report=demo&lens=findings' },
  { id: 'wp02-city-lens-light', query: '?screen=s05&theme=light&route=city&report=demo&lens=findings' },
```

- [ ] **Step 7: Run and confirm they pass.** `npx vitest run tests/harness/harness-evidence.test.ts tests/harness/harness.test.ts tests/build/harness-shot.test.ts tests/unit/obsidian-mock-scope.test.ts`, then the gate: `npm run typecheck && npm run lint:fast && npx vitest run tests/harness tests/build`, and `npx eslint tests/harness/seed.ts tests/harness/mount.ts tests/harness/page.ts tests/harness/harness-evidence.test.ts tests/build/harness-shot.test.ts --max-warnings 0`.
- [ ] **Step 8: Capture and compare.**
  - Run `npm run harness-shot`. It must exit 0. A page error from `report=demo` (a refused report), `lens=findings` or `fallow=review` fails it; report the error and keep the throw.
  - Every city shot must still show the drawn city.
  - The demo report is the shared fixture's pattern over ten files: exports `symbol0`–`symbol9` (types on the 4th and 8th), complexity `fn0`/`fn2`/`fn4`/`fn6`/`fn8` (critical, high, moderate, critical, high; cognitive 20–28 against the threshold 15), and two clone groups. That makes 19 matched findings on 10 files, plus one `orphan` export on `generated/schema.ts`.
  - Compare each new PNG in `harness-shots/` with its references:

| New shot | Compare with | Check |
|---|---|---|
| `wp02-city-cancelling-dark.png` | `docs/concept/prototype/screenshots/scan-progress-dark.png`; `docs/concept/design/mockups/s12-cancelled.png` | The StatusBanner reads "Cancelling the scan… The current snapshot stays available."; the city stays drawn; Scan and Cancel both show the shared aria-disabled look; no "Select a codebase" welcome action. |
| `wp02-sources-fallow-dark.png` | `sources-dark.png`; `mockups/s14-provider.png` | The fallow card reads Imported with the EvidenceBadge ("fallow 3.27.0 · Imported · Unverified source match"). Diagnostics: 3.27.0, combined, schema 12, `synthetic-harness-fallow-report.json`, the imported time, three categories analysed, 19 findings on 10 files, 1 unmatched path (`generated/schema.ts` inside the `<details>`), and one warning, the synthetic diagnostic as plain text. It shows **Import report…** and **Remove report** (not aria-disabled). The synthetic caption is at the bottom right. |
| `wp02-connect-fallow-review-dark.png` | `source-wizard-dark.png`; `mockups/s14-provider.png` | The review step shows: version, kind and schema; the categories; 19 matched findings on 10 files; 1 unmatched path; **no** mapping checkbox (no prefix makes `generated/schema.ts` match); no replace note (nothing is attached yet); **Attach report** and **Cancel**. There is no "Use an installed analyzer" option. |
| `wp02-quality-fallow-dark.png` | `quality-dark.png`; `finding-review-dark.png` | Per-finding titles such as "`fn0` · Cognitive complexity 20 (threshold 15)" and "`symbol0` · Unused export"; tool severities critical / high / moderate, and "Not rated" for duplication and unused; the rule column; the badge; the cards read collected counts, not Unknown; no "Sample finding" wording anywhere. |
| `wp02-city-lens-dark.png`, `wp02-city-lens-light.png` | `city-dark.png`, `city-light.png`; `mockups/s15-findings.png` | The toolbar reads "Colour: Reported findings". The heading reads FALLOW LENS / Reported findings / "19 findings · 10 files · imported evidence", with the badge. The 10 reported lots keep their category colour, one or more per district, and every other measured lot is the muted neutral. The three unavailable wireframe markers are unchanged. The legend rows read "Reported finding" and "No finding reported · metric unavailable". The buildings and camera sit exactly where `wp02-city-dark.png` / `s05-city-light.png` put them (no relayout). |

  - Existing shots that change on purpose (list any other difference you leave):
    - `wp02-quality-{dark,light,narrow-dark}`: the NotAnalysed state with **Import report** replaces the sample table, and the cards read Unknown with the reason (Y35).
    - `wp02-file-{dark,light,narrow-dark}`: FileFindingsPanel reads Not analysed, with the Import action (Y36).
    - `wp02-overview-{dark,light,narrow-dark}`: the findings card and its high caption read Unknown, and the coverage row `static` is now `fallow`, reading unknown (Y34, R6).
    - `wp02-report-{dark,light,narrow-dark}`: the finding counts read Unknown (Y34).
    - `wp02-sources-{dark,light,narrow-dark}` and `wp02-sources-running-dark`: the `static` card is now the `fallow` card, reading Not analysed with **Import report…**; the callout drops the sample wording (Y37).
    - Every shell shot: the NavColumn Quality badge is gone (it shows only when the findings total is collected), and Quality no longer feeds the "Includes sample data" badge (Y33).
    - `wp02-city-running-dark`: Scan shows the aria-disabled look instead of native `disabled` (Y3).
    - City shots whose frame reaches the summary cards (`wp02-city-dark`, if they are visible): the unused card reads Unknown.
    - No Colour select appears in any shot without `report=demo`.
- [ ] **Step 9: Evidence-note counts, ONCE.**
  - Run `npx vitest run tests/unit/gate-evidence.test.ts tests/unit/evidence-numbers.test.ts`. The failures name each stale value.
  - Measure, from the worktree root (PowerShell):

```powershell
foreach ($d in 'unit','contracts','integration','component','host','acceptance','benchmarks','harness','build') { $n = (Get-ChildItem -Recurse "tests/$d" -File | Where-Object { $_.Name -match '\.(test|steps)\.ts$' }).Count; "$d $n" }
(Get-ChildItem -Recurse src -Include *.ts,*.vue -File | Where-Object { $_.Name -notlike '*.d.ts' }).Count
```

  - Update, with the Edit tool, following fb84ca3 (`git show fb84ca3`) and d5ee2c9 (`git show d5ee2c9`):
    - In **both** `2026-09-17-wp01-gate-evidence.md` and `2026-09-17-wp01-implementation-report.md`: the `Files` cell of every layer row whose count changed (expect at least Unit, Component, Host and Harness, which goes 1 → 2 with `harness-evidence.test.ts`; Contract only if a `*.test.ts` was added there). The `Tests` column is TRANSCRIBED and never changes.
    - In the gate evidence document:
      - `(240+ files, count asserted` → `(N+ files, count asserted`, where N is the `src/` count rounded down to a multiple of ten (for example 283 → 280). `evidence-numbers.test.ts` requires `N ≤ real` and `real − N ≤ 10`.
      - `Counts refreshed 2026-09-22 to the living suite after WP-02 Part 5` → `Counts refreshed <today's date> to the living suite after WP-02 Part 6`.
      - `The FILE counts — 168 files, and the` → the new layer-file total; and on the next line `are current as of WP-02 Part 5.` → `are current as of WP-02 Part 6.`
      - `**168 files, 1074 tests, 1073 passed,` → the new layer-file total; `1074 tests, 1073 passed` and `1 skipped` stay.
  - Re-run the two tests until they pass. Change derived numbers only.
- [ ] **Step 10: Full verification, and the living-suite totals.**
  - Run `npm run verify` in the foreground.
    - Expected: exit non-zero **only** because of `tests/unit/install-script.test.ts` (no `.obsidian/` in a worktree; environmental). Paste its failing test names and assertion messages verbatim.
    - If `tests/host/clean-vault-install.test.ts` times out, re-run it alone with `npx vitest run tests/host/clean-vault-install.test.ts` before calling it a failure.
    - Anything else failing is real: fix it, or stop and report it.
    - If verify stopped before the build, run `npm run build` on its own and paste the `assert-bundle` line.
  - From that run's vitest summary, update the living-suite totals exactly as d5ee2c9 did: in the G8 vintage paragraph (`168 files, 1759 tests, 1757 passed, 1 skipped, plus` and `not counted in the 1759/1757/1 above`) and in the "not machine-checked" list (`(168 files, 1759` / `tests, 1757 passed, 1 skipped, plus`), write the Test Files total, the Tests total, the passed count and the skipped count. Re-run `npx vitest run tests/unit/gate-evidence.test.ts tests/unit/evidence-numbers.test.ts` after the edit.
  - Check `tests/unit/obsidian-mock-scope.test.ts` and `tests/unit/css-class-scope.test.ts` are green in that run.
- [ ] **Step 11: Commit** `test(harness): Part 6 captures (cancelling, fallow card, S14 review, quality with findings, the findings lens) on a synthetic fallow report; refresh WP-01 evidence counts after WP-02 Part 6`, ending with a blank line and `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. The ledger is committed separately by the controller. `npm run verify` runs again in the main checkout after the fast-forward, which is the user's choice.

---


---

## Self-review notes

- **Spec coverage:**

  | Spec decision | Task |
  |---|---|
  | Y1–Y4 | 1 |
  | Y10, Y12–Y16, and Y18 (store side, as R1/U15: the port's `replaceAll`) | 2 |
  | Y5–Y9, Y11 registry, Y17 purge, and Y18 (durable side) | 3 |
  | Y7 UI, Y11 wiring, Y17 settings | 4 |
  | Y20–Y22, Y31 codes | 5 |
  | Y23–Y27 | 6 |
  | Y28, Y29, Y39 | 7 |
  | Y30, Y33, Y34 | 8 |
  | Y32, Y35, Y36 | 9 |
  | Y31 UI, Y37, Y38 | 10 |
  | Y40 | 11 |
  | §5 harness, evidence counts, verify | 12 |

  **Y19 is deliberately not implemented; it is deferred (U46).**
- **Placeholders:** a scan for TBD, TODO, "similar to Task" and "fill in" finds none.
- **Commit messages:** every task's commit message ends with the `Co-Authored-By: Claude Opus 5` line.
- **Type consistency:** the reconciliation rulings (A1–A13, ledger U8–U51) fix every name shared across tasks. The drafts were revised to them in two waves: Tasks 1–8 against the rulings, then Tasks 9–12 against the revised Task 8 text.
- **Residual risk:** Tasks 9–11 were written against *drafted* earlier tasks, not committed code. A11 makes the controller re-check every "Consumes" name and re-anchor stale edits in each brief before dispatch.
