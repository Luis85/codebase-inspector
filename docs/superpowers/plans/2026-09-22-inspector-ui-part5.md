# WP-02 Part 5 — Hardening and every deferred finding: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Free the city's line budget and fix what was deferred behind it, keep review state per codebase with a v2 export and a strictly validated import, implement the owner's contrast decision #4, and close every Part 3 and Part 4 leftover.

The city work covers:
- one leaf observer;
- the camera re-measure;
- cancel from the leaf;
- focus after navigation.

**Architecture:** The Part 1–4 shell stays as it is:
- screens read read models, stores and copy only;
- every value is a `MetricValue`;
- `city-store` owns selection and route;
- review decisions go through `ReviewRepository`, in memory.

Part 5 adds these, and no provider and no persistence:
- two host modules extracted from `city-view.ts`;
- three city modules extracted from `CityWorkspace.vue`;
- a shared leaf-layout provider;
- a route-focus composable;
- a `reannounce` helper;
- per-repository buckets in the review and report stores;
- a pure, zod-based review-state import parser.

**Tech Stack:** TypeScript, Vue 3.5 (`<script setup>`, `defineModel`), Pinia 4, zod 4, Vitest 5 + @vue/test-utils (jsdom), plain CSS under `:where(.codebase-inspector-root)`.

**Spec:** `docs/superpowers/specs/2026-09-22-inspector-ui-part5-design.md` (decisions V1–V32). It sits on these specs, all binding:
- Part 1 (`2026-09-21-inspector-ui-shell-design.md`, §9 A1–A13);
- Part 2 (`2026-09-21-inspector-ui-part2-design.md`, P1–P14; P14 supersedes A1);
- Part 3 (`2026-09-21-inspector-ui-part3-design.md`, Q1–Q17);
- Part 4 (`2026-09-22-inspector-ui-part4-design.md`, W1–W17).

Precedent: the Part 3 ledger (R1–R9, E1–E55) and the Part 4 ledger (S1–S27, X0–X19, "Part 4 E1–E22"). This part's rulings live in `docs/superpowers/notes/2026-09-22-wp02-part5-ledger.md`: planning rulings are T1…, and execution rulings are "Part 5 E1"….

**Branch:** `feat/wp-02-part5` (from `feat/wp-01-codebase-city` at f05fd19), worktree `C:\Projects\codebase-inspector\.claude\worktrees\wp-02-part5`. **Not stacked:** at the end, `feat/wp-01-codebase-city` is fast-forwarded to this branch and pushed, so the work lands on PR #1. The integration step is the user's choice.

## Global Constraints

**Size**
- `src/**/*.{ts,vue}` max **400** lines. `tests/**/*.ts` max **450** lines (eslint `max-lines`).
- **Only Task 1** may restructure `src/host/city-view.ts` (399) and `src/ui/screens/CityWorkspace.vue` (386). Every later task adds nothing to either file: it changes the modules Task 1 extracts. After Task 1 both are ≤ 360 lines (`tests/unit/city-budget.test.ts`).
- `tests/host/city-view-store-wiring.test.ts` is 450/450: never grow it. New host tests go in new files (`tests/host/city-view-*.test.ts` run under jsdom automatically).
- Other test files at or near the cap (do not grow past 450): `renderer-contract` 450, `city-viewport` 448, `welcome-state` 446, `picking` 440, `city-view` 439, `settings-tab` 435, `consent-chain` 420, `window-migration` 419, `responsive-floor` 415.
- Any screen above ~300 lines gets a sub-component in `screens/<screen>/`.

**Browser globals**
- No bare `window`, `document`, `setTimeout`, `ResizeObserver`, `matchMedia`, `getComputedStyle`, `localStorage` in `src/ui/**` (eslint `no-restricted-globals`). No identifier named `window`.
- Use `el.ownerDocument`, `el.ownerDocument.defaultView`, `win.setTimeout`, `nextTick`. A ResizeObserver constructor comes from the element's own window: `(el as unknown as { win?: Window }).win`.
- Never `x instanceof HTMLElement`; always `x.instanceOf(HTMLElement)`.
- Listeners go on the leaf/shell root or on component elements, **never the document**. (CityWorkspace's existing Escape listener on the leaf's own `doc` is WP-01 behaviour; Task 1 moves it unchanged.)
- Element ids come from `useUniqueId()` (`src/ui/unique-id.ts`).

**TypeScript and lint**
- tsconfig `lib` is ES2020: no `.at()`, `Object.hasOwn`, `replaceAll`, `findLast` or other ES2021+ API in `src`.
- oxlint runs `--deny-warnings` with `consistent-function-scoping`: a closure that captures nothing is hoisted to module scope.
- `obsidianmd/prefer-create-el` applies. The only exemption is `src/ui/export/download.ts` and its test. The import file input lives in a Vue template, never `createElement`.
- `exactOptionalPropertyTypes` is **review discipline**, not a tsconfig flag (Part 4 X13): never assign `undefined` to an optional property; spread it in conditionally.
- zod 4 conventions (`src/domain/validator.ts` header): `error.issues`, `.strict()`, `{ error: '…' }` messages.

**Evidence**
- Absent evidence is never rendered or exported as `0`. It is a `MetricValue` with `state: 'unknown'` and a `reason`.
- No composite health score. No exploitability verdict.
- Sample values are always labelled (`ProvenanceBadge`, `isSampleBacked`, the shell badge, "(sample)" in Markdown).
- Mutation, runtime exploitability and secret candidates are always `unknown`.
- No per-person data.
- Source file **content is never read**.
- **Nothing is written to the vault.** Exports go through `downloadText` (via `useCsvExport`).
- **An import reads only the file the user picks** (a template `<input type="file">`), never the vault.
- **Nothing persists beyond memory** (durable persistence is WP-05): no plugin-data key, no `localStorage`.
- Do not modify `city-store` `select`, `setQuery`, `setCamera` (calling them, and `navigate`/`setViewMode`/`returnFromList`, is fine).
- The review-state JSON never contains an absolute path or a raw entity id (which embeds the repository id). Imported text is never rendered as HTML.

**Copy and CSS**
- Every new visible string goes in `src/ui/audit-copy/*.ts` (re-exported by `src/ui/inspector-copy.ts` through its existing `export *` lines), **never** `src/ui/copy.ts`. `copy.ts` exports may be imported (e.g. `COPY_09` "Cancel scan").
- CSS lives only in `src/ui/styles/{kit,shell,screens,screens-explore,screens-audit,screens-act,screens-configure}.css`, under `:where(.codebase-inspector-root)`, with BEM `ci-*` classes and colours only through `--ci-*` tokens.
- Every `var(--font-ui-*)` carries an em fallback: `smaller → 0.8em`, `small → 0.9em`, `medium → 1em`, `large → 1.15em`.
- **Never edit `src/ui/styles.css`.** No Vue `<style>` blocks. Import the kit dialog as `CiDialog`.
- A screen never uses another screen's block class; shared looks live in `kit.css`. After Task 12, `tests/unit/css-class-scope.test.ts` enforces this for every block.

**Accessibility**
- Accessible names contain the visible label (WCAG 2.5.3).
- A button that can become blocked while focused uses `aria-disabled="true"` plus a guarded handler, never `disabled` (E40/E44/E50). The kit's shared `button[aria-disabled="true"]` rule styles it (E54); no per-class aria-disabled rule in screen sheets.
- Announce only real outcomes (E17): a store result of `null`/`false` announces nothing, or the refusal.
- Repeated outcomes are re-announced: clear, `nextTick`, set. After Task 4, use `reannounce(live, message)` from `src/ui/kit/reannounce.ts`.
- Dialog outcomes that leave the dialog open are announced inside it through `CiDialog`'s `status` prop.

**Test infrastructure**
- jsdom stubs load through vitest `setupFiles`. Component tests that open a `CiDialog` also `import '../mocks/obsidian'`.
- Tests that mount `App` or a real `CityView` and need the city seed route `'city'`. The harness must keep drawing the city (`tests/unit/obsidian-mock-scope.test.ts`).
- Every `.every(...)` assertion is preceded by a non-empty check (E27).
- No raw BOM or NUL byte in any file: write `String.fromCharCode(0xFEFF)` / `String.fromCharCode(0)` (E7/E39; the editing tools turn a backslash-u escape into the real byte). This includes entity ids in tests: build them with `makeEntityId(...)` or `String.fromCharCode(0)`.
- Nothing under `src` imports from a `tests/` path, and no `src` folder is named `tests` (E42).
- Multi-step async store chains are awaited with `flushPromises()` from `@vue/test-utils` (Part 4 X9).
- Every new test must fail without its feature. The implementer runs it RED and pastes the output.
- Edit files only with the Edit/Write tools. **Never `sed -i`, heredocs or scripts**: files are CRLF on Windows.

**Gates and commits**
- Per-task gate: `npm run typecheck && npm run lint:fast && npx vitest run <the task's test files>`, plus `npx eslint <touched files> --max-warnings 0`. Run gate commands in the foreground.
- **The WP-01 evidence-note counts are updated ONCE, in Task 16.** Before that, `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` are expected to fail on file counts. Do not run the full suite per task, and do not "fix" those two tests.
- `tests/unit/install-script.test.ts` fails in any worktree without `.obsidian/`. It is environmental: report it and never fix it. `tests/host/clean-vault-install.test.ts` can hit its 5 s timeout on a loaded machine: re-run it alone before calling it a failure.
- Commit after each task, only the task's own files (never the ledger). Every message ends with a blank line and `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

**Process**
- Implementers and reviewers never spawn subagents. Reviewers are read-only and create no files in the worktree.
- Implementers report back: files changed with line counts, the gate output, the RED and GREEN output, and every deviation from this plan and why.
- The controller records every ruling in `docs/superpowers/notes/2026-09-22-wp02-part5-ledger.md`.

### Screen-task conventions (Tasks 3, 5, 9, 11, 13)

- **Screens follow `OwnershipScreen.vue`:** root `<div ref="root" class="ci-screen ci-screen--<route>">`, `PageHeader` with the actions slot, and a `<p class="visually-hidden ci-<route>__live" role="status">` right after `</PageHeader>` when the screen announces outcomes.
- **Selection** always goes through `store.select(id)`. Nothing moves the camera.
- **Export**: `const exportText = useCsvExport(root, liveMessage);` then `exportText(FILENAME, () => build(...), MIME)`. Never call `downloadText` directly.
- **Work items and review state** go through `review-store`. A `null`/`false` result announces nothing (E17). A rejection sets the task's `*_FAILED` string, in the live region or in the dialog's `role="alert"` error.
- **Blocked buttons**: `:aria-disabled="blocked ? 'true' : undefined"` plus an early `return` in the handler.
- **Component tests** follow `tests/component/ownership-screen.test.ts`: `setActivePinia(createPinia())`, `buildSnapshotFixture`, `useCityStore().setCity(snap, computeLayout(snap))`, `mount(..., { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } })`, `w.unmount()`. Mock the download with `vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }))`.

## File map

| File | Status | Task | Responsibility |
|---|---|---|---|
| `src/host/city-scan-controller.ts` | create | 1, 3 | scan lifecycle; `provideScanCallbacks` (+ `onCancelScan` in 3) |
| `src/host/layout-publisher.ts` | create | 1 | publish a snapshot's layout |
| `src/host/city-view.ts` | modify (split only) | 1 | delegations |
| `src/ui/screens/city/{use-city-escape,use-city-floor}.ts`, `CitySelectionNotice.vue` | create | 1, 2 | extracted city composition |
| `src/ui/screens/CityWorkspace.vue` | modify (split only) | 1 | composition |
| `src/ui/shell/leaf-layout.ts` | create | 2 | one leaf measurement, shared |
| `src/ui/shell/use-leaf-width.ts`, `src/ui/App.vue`, `src/ui/components/CameraControls.vue` | modify | 2 | provider, re-measure |
| `src/ui/components/AppToolbar.vue`, `src/ui/screens/sources/ScanStatusPanel.vue`, `src/ui/screens/SourcesScreen.vue` | modify | 3 | Cancel scan |
| `src/ui/kit/reannounce.ts`, `src/ui/export/use-csv-export.ts`, `src/ui/screens/TestsScreen.vue` | create / modify | 4 | re-announce, build outside try, null export |
| `src/ui/shell/use-route-focus.ts`, `src/ui/kit/PageHeader.vue` | create / modify | 5 | focus after navigation |
| `src/ui/stores/review-store.ts`, `src/ui/stores/report-store.ts`, `src/ui/stores/ports/review-repository.ts` | modify | 6, 8 | per-codebase buckets; `replaceAll`, `restore` |
| `src/ui/read-models/review-state.ts` | modify | 7 | v2 export |
| `src/ui/read-models/review-state-import.ts` | create | 8 | strict import parser |
| `src/ui/screens/settings/{ImportRow,ImportReviewDialog}.vue`, `settings-tabs.ts`, `PrivacyRows.vue`, `SettingsScreen.vue` | create / modify | 9 | import UI; tab narrowing |
| `src/ui/read-models/{security,use-read-models}.ts` | modify | 10 | lazy Security |
| `src/ui/screens/quality/FindingsTable.vue`, `QualityScreen.vue`, `dependencies/PackageTable.vue` | modify | 11 | button columns |
| `src/ui/styles/*.css`, `file/FileFindingsPanel.vue`, `quality/*`, `hotspots/HotspotScatter.vue`, `test-confidence/CoverageMap.vue`, `tests/unit/css-class-scope.test.ts` | modify | 12 | kit classes; guard every prefix |
| `src/ui/kit/chart-scale.ts`, `src/ui/export/markdown.ts`, `src/ui/read-models/sources.ts`, `sources/ProviderGrid.vue`, `styles/screens-act.css` | modify | 13 | minors |
| tests only | modify / create | 14 | missing and weak tests |
| `src/ui/styles/kit.css` (+ as decided) | modify | 15 | contrast #4 |
| `tests/harness/*`, `scripts/harness-shot.mjs`, evidence notes | modify | 16 | captures, counts, verify |

---

## Planning amendments (these override the task text below)

I reviewed the drafted tasks against the real code. The notes the drafters raised are ruled on here, and again in the ledger (T19–T31). Where a task's text disagrees with an amendment, the amendment wins.

- **P1 (T19): `clearAll` waits for pending changes.**
  - **Task 8.** `clearAll()` becomes `Promise<boolean>`.
    - While any of `pendingWorkKeys`, `pendingItemIds`, `pendingRuleKeys` or `pendingFingerprints` is non-empty, it returns `false` and does not touch the port. This is the same rule as `replaceAll`.
    - Otherwise it behaves as today (allSettled, reload in `finally`, rethrow the first rejection) and returns `true`.
    - The reason: an update whose save lands after the clear would otherwise be written back into the port and reappear on the next load.
  - **Task 9.** `ClearReviewDialog` treats `false` as a refusal. It shows `SETTINGS_CLEAR_BUSY` = "Wait for the pending change to finish, then clear again." in its `role="alert"`, keeps the dialog open and announces nothing.
  - **Task 14(b).** The race test asserts that a clear during a pending update is refused, and that nothing reappears after `load()`.
  - **Task 14(e).** The concurrent-vanish path must not depend on `clearAll` ignoring pending ids. Instead it mutates the store directly while the delete is gated (`review.workItems = review.workItems.filter(...)`), which stands for the item vanishing by another path.
- **P2 (T20): `reannounce` guard (Task 4, as drafted).** It sets the message only if (a) no later call happened on the same ref and (b) the ref still holds the `''` it left.
- **P3 (T21): Tests export (Task 4, as drafted).** The export button uses `aria-disabled` plus a guarded handler (E40), and refuses when the model is null or there are zero gaps.
- **P4 (T22): route focus (Task 5, as drafted).** Focus resting on the `.ci-shell` root counts as "fell out" (case 1). The programmatically focused heading and `<main>` get no focus ring.
- **P5 (T23): `ci-screen` (Task 12, as drafted).** Its base rule moves to `kit.css` unchanged. `.ci-screen--city` stays in `screens.css`.
- **P6 (T24): harness seeding.** Task 6 adds `await review.load()` in `tests/harness/mount.ts` before the demo seeding. Task 16 builds on that block.
- **P7 (T25): `repositoryDigest`.** It imports `fnv1a` from `src/ui/fixtures/seeded-random.ts`. That module's header is amended to say the hash also serves the review-state origin digest, which is not sample data.
- **P8 (T26): import validation (Tasks 8 and 9, as drafted).**
  - Import paths are validated with the scanner's `normalizeRelativePath`, which is stricter than V14.
  - A v1 file, or a v2 file with `source: null`, shows the origin text `IMPORT_ORIGIN_UNKNOWN`.
- **P9 (T27): `CityViewDeps` (Task 1, as drafted).** It moves to `city-scan-controller.ts` and is re-exported from `city-view.ts`.
- **P10 (T28): `container-box.test.ts`.** Task 2 changes its helper so the drawer opens at 600 px before widening. This file was not in the brief's list.
- **P11 (T29): toolbar wrapping.**
  - Task 3 adds `flex-wrap: wrap` for `.ci-app__toolbar` in `shell.css`, and Task 16 checks the narrow captures for it.
  - The existing toolbar Scan button keeps its native `disabled` (WP-01). That goes on the deferred list.
- **P12 (T30): Cancel guard on Data & scans.** The guard reads `runStore.run.status` in `SourcesScreen`; the panel only emits.
- **P13: contrast.** Task 15 is implemented with the option the owner chooses (ledger T32). Option B as drafted also overrides the WP-01 accent buttons and hovers from `kit.css`, without editing `styles.css`.
- **P14 (T31): evidence floor.** In Task 16, the evidence floor for `src` files is the real count rounded down to a multiple of ten.

---

### Task 1: Split `city-view.ts` and `CityWorkspace.vue` with no behaviour change (V1, V2, V3)

A pure move. No selector, class name, copy string, public `CityView` method or observable behaviour changes. It lands first so that no later task adds to a 399-line or a 386-line file. Every later task changes only the modules this task extracts.

**Files:**
- Create: `src/host/city-scan-controller.ts` (~148 lines)
- Create: `src/host/layout-publisher.ts` (~64 lines)
- Modify: `src/host/city-view.ts` (399 → ~275; the V1 target is ≤ 340)
- Create: `src/ui/screens/city/use-city-floor.ts` (~102 lines)
- Create: `src/ui/screens/city/use-city-escape.ts` (~100 lines)
- Create: `src/ui/screens/city/CitySelectionNotice.vue` (~55 lines)
- Modify: `src/ui/screens/CityWorkspace.vue` (386 → ~189; the V2 target is ≤ 300)
- Test: `tests/unit/city-budget.test.ts` (new, ~48 lines)

**Interfaces:**
- Consumes:
  - `ScanCoordinator`, `createCancellationToken` (`src/application/scan-coordinator.ts`);
  - `resolveOrCreateProfile`, `runInitialScan`, `runRefresh` (`src/host/scan-flow.ts`);
  - `computeLayout` (`src/domain/layout/layout.ts`), `LayoutResult` (`src/domain/layout/types.ts`);
  - `LayoutGenerationSource`, `useCityRendererHandle` (`src/ui/renderer-handle.ts`);
  - `escapeIntent` (`src/ui/interaction/escape-intent.ts`);
  - `cityInlineSize`, `narrowContainer` (`src/ui/container-box.ts`);
  - `DRAWER_MAX_INLINE_SIZE`, `MIN_INLINE_SIZE` (`src/ui/responsive.ts`).
- Produces:
  - `src/host/city-scan-controller.ts`:
    - `export interface CityViewDeps { profileStore: ProfileStore; getFilesystem: () => SourceFileSystemPort; snapshotStore: SnapshotStore; clock: Clock }` (moved; `city-view.ts` re-exports it, so every `import type { CityViewDeps } from '…/host/city-view'` keeps working);
    - `export interface ScanViewBridge { viewState: () => Pick<CityViewState, 'profileId' | 'snapshotId'>; showNotice: (message: string) => void }`;
    - `export class CityScanController { constructor(plugin: Plugin, deps: CityViewDeps, view: ScanViewBridge); startScan(): Promise<void>; selectCodebase(): Promise<void>; cancelScan(): void; isScanRunning(): boolean; cancelIfRunning(): void; subscribe(listener: (lifecycle: ScanLifecycleState) => void): () => void }`;
    - `export function provideScanCallbacks(app: VueApp, controller: CityScanController): void`, which provides `'onSelectCodebase'` → `void controller.selectCodebase()` and `'onScanRequested'` → `void controller.startScan()`.
  - `src/host/layout-publisher.ts`:
    - `export interface LayoutPublisherOptions { handle: ShallowRef<CityRendererPort | null>; nextGeneration: LayoutGenerationSource; setCity: (snapshot: CodebaseSnapshot, layout: LayoutResult) => void; notify: (message: string) => void }`;
    - `export interface LayoutPublisher { publish: (snapshot: CodebaseSnapshot) => Promise<void>; abort: () => void }`;
    - `export function createLayoutPublisher(options: LayoutPublisherOptions): LayoutPublisher`.
  - `src/ui/screens/city/use-city-floor.ts`: `export interface CityFloor { narrowDrawer: Readonly<Ref<boolean>> }` and `export function useCityFloor(rootEl: Readonly<Ref<HTMLElement | null>>, store: ReturnType<typeof useCityStore>, filesDrawerOpen: Ref<boolean>): CityFloor`. Task 2 changes only this file's resize wiring.
  - `src/ui/screens/city/use-city-escape.ts`: `export interface CityEscapeOptions { rootEl; store; inspectorOpener: ShallowRef<HTMLElement | null>; filesDrawerOpen: Readonly<Ref<boolean>>; narrowDrawer: Readonly<Ref<boolean>>; closeFilesDrawer: () => void }` and `export function useCityEscape(options: CityEscapeOptions): void`.
  - `src/ui/screens/city/CitySelectionNotice.vue`: no props, no emits. Renders the COPY-30 notice with the byte-identical classes `ci-app__selection-notice`, `ci-app__selection-notice-text`, `ci-selection-notice__actions`, `ci-selection-notice__reveal`, `ci-selection-notice__clear`.
  - `CityView` keeps every public method with the same signature: `startScan`, `selectCodebase`, `cancelScan`, `isScanRunning`, `applyReconciliation`, `getState`, `setState`, `onOpen`, `onClose`, `getViewType`, `getDisplayText`, `getIcon`, plus `CITY_VIEW_TYPE`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/city-budget.test.ts`:

```ts
// WP-02 Part 5 (V1–V3): city-view.ts (399/400) and CityWorkspace.vue (386/400) were split so
// later work has room. This keeps at least 40 lines of headroom under the 400-line src cap,
// and pins the extracted modules and the names later tasks build on. The checks read the
// source text rather than importing it, so each one fails on its own before the split.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CAP = 360;

function source(path: string): string {
  const abs = resolve(process.cwd(), path);
  expect(existsSync(abs), `${path} exists`).toBe(true);
  return readFileSync(abs, 'utf8');
}

describe('city line budget (Part 5 V3)', () => {
  it.each(['src/host/city-view.ts', 'src/ui/screens/CityWorkspace.vue'])('%s stays at or under 360 lines', (path) => {
    expect(source(path).split('\n').length).toBeLessThanOrEqual(CAP);
  });

  it('the scan lifecycle lives in city-scan-controller.ts (V1)', () => {
    const text = source('src/host/city-scan-controller.ts');
    expect(text).toMatch(/export class CityScanController\b/);
    expect(text).toMatch(/export function provideScanCallbacks\(/);
    expect(text).toContain("provide('onSelectCodebase'");
    expect(text).toContain("provide('onScanRequested'");
  });

  it('layout publishing lives in layout-publisher.ts (V1)', () => {
    expect(source('src/host/layout-publisher.ts')).toMatch(/export function createLayoutPublisher\(/);
  });

  it('the Escape chain, the floor wiring and the selection notice live in screens/city/ (V2)', () => {
    expect(source('src/ui/screens/city/use-city-escape.ts')).toMatch(/export function useCityEscape\(/);
    expect(source('src/ui/screens/city/use-city-floor.ts')).toMatch(/export function useCityFloor\(/);
    const notice = source('src/ui/screens/city/CitySelectionNotice.vue');
    for (const cls of ['ci-app__selection-notice', 'ci-selection-notice__reveal', 'ci-selection-notice__clear']) {
      expect(notice, cls).toContain(cls);
    }
  });

  it('city-view.ts no longer builds the coordinator or computes a layout itself', () => {
    const view = source('src/host/city-view.ts');
    expect(view).not.toContain('new ScanCoordinator(');
    expect(view).not.toContain('computeLayout(');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/unit/city-budget.test.ts`. Expected: FAIL in every case.
  - The two budget cases fail with `expected 400 to be less than or equal to 360` (city-view.ts, 399 lines plus the final newline) and `expected 387 …` (CityWorkspace.vue).
  - The three module cases fail with `src/host/city-scan-controller.ts exists: expected false to be true` (and the same for the other files), because none of them exists yet.
  - The last case fails because `city-view.ts` still contains `new ScanCoordinator(` and `computeLayout(`.

- [ ] **Step 3: Create `src/host/city-scan-controller.ts`.** The bodies are moved from `city-view.ts` unchanged. The only edits are `this.state.X` → `this.view.viewState().X` and `this.showNotice` → `this.view.showNotice`.

```ts
// WP-02 Part 5 (V1): the scan lifecycle, cut out of city-view.ts (399/400) with no behaviour
// change. One controller, and so one ScanCoordinator, per CityView (leaf-registry.ts: the
// coordinator is per view). CityView keeps `startScan`, `selectCodebase`, `cancelScan` and
// `isScanRunning` as one-line delegations, so commands.ts, the acceptance steps and every
// host test stay untouched. `provideScanCallbacks` is the one place the Vue tree's scan
// callbacks are provided.
import type { Plugin } from 'obsidian';
import type { App as VueApp } from 'vue';
import { ScanCoordinator, createCancellationToken } from '../application/scan-coordinator';
import { resolveOrCreateProfile, runInitialScan, runRefresh } from './scan-flow';
import { validationFailureText } from '../domain/validator';
import type { ScanLifecycleState } from '../application/run-state';
import type { CityViewState, CodebaseProfile } from '../domain/model';
import type { ProfileStore } from '../application/ports/profile-store';
import type { SourceFileSystemPort } from '../application/ports/source-filesystem-port';
import type { SnapshotStore } from '../application/ports/snapshot-store';
import type { Clock } from '../application/ports/clock';

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

/** What the controller reads from, and reports to, the CityView that owns it. */
export interface ScanViewBridge {
  /** The view's persisted identifiers, read at call time: the view replaces its state
   *  object on every change, so a captured copy would go stale. */
  viewState: () => Pick<CityViewState, 'profileId' | 'snapshotId'>;
  showNotice: (message: string) => void;
}

export class CityScanController {
  private readonly plugin: Plugin;
  private readonly deps: CityViewDeps;
  private readonly view: ScanViewBridge;
  private readonly coordinator: ScanCoordinator;
  // Fix round 1, Minor 6: `coordinator.state.status` alone does not guard the WHOLE of
  // startScan() -- it stays 'idle' until AFTER both consent modals resolve, so two fast
  // clicks (or two scan-codebase invocations) both pass that check, both resolve/create
  // a profile, and both open a modal. This flag closes the gap for the async method
  // itself, independent of the coordinator's own state.
  private startingScan = false;

  constructor(plugin: Plugin, deps: CityViewDeps, view: ScanViewBridge) {
    this.plugin = plugin;
    this.deps = deps;
    this.view = view;
    this.coordinator = new ScanCoordinator({
      port: deps.getFilesystem(), store: deps.snapshotStore, clock: deps.clock, createCancellationToken,
    });
  }

  /** `scan-codebase`'s own behaviour (spec 5: "scan-codebase doubles as refresh") --
   *  refreshes silently against the stored scope when a snapshot already exists, else
   *  runs the full consent chain. A no-op while a run is already in flight, never
   *  throws. Ruling M46: deliberately distinct from `selectCodebase()` (which the
   *  welcome shell's button calls and ALWAYS opens the modal) -- two names make the
   *  intention explicit at every call site rather than a boolean a caller could pick wrong. */
  async startScan(): Promise<void> {
    await this.withScanGuard(async (profile) => {
      const snapshotId = this.view.viewState().snapshotId;
      if (snapshotId) {
        const existing = this.deps.snapshotStore.get(snapshotId);
        if (existing) {
          await runRefresh(this.plugin.app, this.coordinator, profile, existing.scope, this.deps.clock, this.deps.profileStore);
          return;
        }
        // The in-memory store no longer has this id (e.g. the plugin reloaded) --
        // fall through to a full consent chain rather than "refreshing" against nothing.
      }
      await runInitialScan(this.plugin.app, this.coordinator, profile, this.deps.getFilesystem(), this.deps.profileStore);
    });
  }

  /** Ruling M46: "Select a codebase" (COPY-02) ALWAYS opens the source modal and runs the
   *  full consent chain, whether or not a snapshot already exists — re-selecting a
   *  different codebase must stay reachable. */
  async selectCodebase(): Promise<void> {
    await this.withScanGuard((profile) => (
      runInitialScan(this.plugin.app, this.coordinator, profile, this.deps.getFilesystem(), this.deps.profileStore)
    ));
  }

  /** `cancel-scan`'s callback body. Its checkCallback (commands.ts) already refuses to
   *  invoke this unless a run is running (ruling M36), but this stays defensive on its
   *  own -- cancel() itself is a no-op for a stale/unknown runId regardless. */
  cancelScan(): void {
    const run = this.coordinator.state;
    if (run.status === 'running') this.coordinator.cancel(run.runId);
  }

  isScanRunning(): boolean {
    return this.coordinator.state.status === 'running';
  }

  /** Fix round 1, Important 2 (called from `CityView.onClose`): closing the tab mid-scan
   *  must not leave an unstoppable walk running with no UI (cancel-scan's checkCallback
   *  needs an active CityView, which is gone the instant onClose runs). Discarding the
   *  result after the fact is not the same as actually STOPPING the disk I/O. */
  cancelIfRunning(): void {
    if (this.coordinator.state.status === 'running') this.coordinator.cancel(this.coordinator.state.runId);
  }

  subscribe(listener: (lifecycle: ScanLifecycleState) => void): () => void {
    return this.coordinator.subscribe(listener);
  }

  /** Shared guard for both entry points: refuses to start while the coordinator is
   *  already running/cancelling OR another call is still resolving a profile/showing a
   *  modal (fix round 1, Minor 6 -- two fast clicks across EITHER method share one
   *  in-flight flag). Resolves the profile once, then hands it to `body`. */
  private async withScanGuard(body: (profile: CodebaseProfile) => Promise<void>): Promise<void> {
    if (this.startingScan) return;
    if (this.coordinator.state.status === 'running' || this.coordinator.state.status === 'cancelling') return;
    this.startingScan = true;
    try {
      const profile = await resolveOrCreateProfile(
        this.deps.profileStore, this.view.viewState().profileId, this.plugin.app.vault.configDir,
      );
      await body(profile);
    } catch (e) {
      // Fix wave item 1 (C1): the destination ruling M53's deliberate propagation never
      // had. Both entry points are `void view.startScan()`, so without this a rejection
      // -- a scope the store refuses, or PluginDataProfileStore.list() throwing on one
      // hand-edited record -- was an unhandled rejection in a console nobody opens.
      this.view.showNotice(validationFailureText(e));
    } finally {
      this.startingScan = false;
    }
  }
}

/** The scan callbacks the Vue tree injects (NoSnapshot and the welcome action, NavColumn,
 *  AppToolbar, Data & scans), provided at the APP level before `mount()` (ruling M68's
 *  pattern: a component's own provide() only resolves for its descendants). Each calls
 *  the SAME method its command-palette twin calls, never the coordinator directly. */
export function provideScanCallbacks(app: VueApp, controller: CityScanController): void {
  app.provide('onSelectCodebase', () => { void controller.selectCodebase(); });
  // Task 5 (F7): the toolbar's Scan control, calling the SAME method the
  // 'scan-codebase' palette command calls.
  app.provide('onScanRequested', () => { void controller.startScan(); });
}
```

- [ ] **Step 4: Create `src/host/layout-publisher.ts`.** The body is `CityView.publishLayout`, moved unchanged. `this.layoutAbort` becomes the closure's `inFlight`, `this.cityStore?.setCity` becomes `setCity`, and `this.showNotice` becomes `notify`.

```ts
// WP-02 Part 5 (V1): publishing a snapshot's layout, cut out of city-view.ts with no
// behaviour change.
//
// Obligation 7 (task-8 brief step 4): recomputes the layout from the published snapshot
// and hands it to setLayout with {generation, signal}. `nextGeneration` is ruling M78's
// SHARED dispenser -- `CityViewport` draws from the SAME one on every renderer
// construction, since both writers send `setLayout` to one live port (renderer-handle.ts)
// -- deliberately distinct from the scan run's own `generation`. `setCity` runs
// UNCONDITIONALLY, before checking whether a renderer exists: the HTML list, inspector and
// legend must hold real data below the 320 px floor too, where none does (spec 5.2's
// list-first fallback). `computeLayout` gets its own try/catch -- it has no never-throws
// contract, and this runs even with no renderer to catch a later throw for it.
import type { ShallowRef } from 'vue';
import { computeLayout } from '../domain/layout/layout';
import type { LayoutResult } from '../domain/layout/types';
import type { CodebaseSnapshot } from '../domain/model';
import type { CityRendererPort } from '../visualization/renderer-port';
import type { LayoutGenerationSource } from '../ui/renderer-handle';
import { CITY_RENDER_FAILURE_NOTICE } from '../ui/copy';

export interface LayoutPublisherOptions {
  /** Ruling M68: the view's SHARED renderer handle. `CityViewport` is its only writer. */
  handle: ShallowRef<CityRendererPort | null>;
  nextGeneration: LayoutGenerationSource;
  /** The view's own city store (ruling M66), or a no-op once the view has closed. */
  setCity: (snapshot: CodebaseSnapshot, layout: LayoutResult) => void;
  notify: (message: string) => void;
}

export interface LayoutPublisher {
  publish: (snapshot: CodebaseSnapshot) => Promise<void>;
  /** Called from `onClose`: aborts the in-flight `setLayout`, if any. */
  abort: () => void;
}

export function createLayoutPublisher(options: LayoutPublisherOptions): LayoutPublisher {
  const { handle, nextGeneration, setCity, notify } = options;
  let inFlight: AbortController | null = null;

  async function publish(snapshot: CodebaseSnapshot): Promise<void> {
    let layout: LayoutResult;
    try {
      layout = computeLayout(snapshot);
    } catch {
      notify(CITY_RENDER_FAILURE_NOTICE);
      return;
    }
    setCity(snapshot, layout);
    const renderer = handle.value;
    if (!renderer) return;
    // Fix round 1, Minor 8: every call site is `void publish(...)`, so an uncaught throw
    // here would be an unhandled promise rejection, not a catchable error anywhere.
    // `setLayout` itself never rejects (spec 4.2).
    try {
      inFlight?.abort();
      inFlight = new AbortController();
      await renderer.setLayout(layout, { generation: nextGeneration(), signal: inFlight.signal });
    } catch {
      notify(CITY_RENDER_FAILURE_NOTICE);
    }
  }

  return { publish, abort: () => { inFlight?.abort(); } };
}
```

- [ ] **Step 5: Rewrite `src/host/city-view.ts`.** Replace the whole file with the version below. Compared with today:
  - `CityViewDeps` moves to `city-scan-controller.ts` and is re-exported.
  - The fields `coordinator`, `startingScan` and `layoutAbort` are gone. `scanController` and `layoutPublisher` replace them, and both are built in the constructor.
  - `startScan`, `selectCodebase`, `cancelScan` and `isScanRunning` become delegations.
  - `withScanGuard` and `publishLayout` are gone.
  - In `onOpen`, the two `provide` calls become `provideScanCallbacks(...)`, `this.coordinator.subscribe` becomes `this.scanController.subscribe`, and `this.publishLayout(existing)` becomes `this.layoutPublisher.publish(existing)`.
  - In `onClose`, the running-cancel becomes `this.scanController.cancelIfRunning()`, and `this.layoutAbort?.abort()` becomes `this.layoutPublisher.abort()`.

  The ruling citations (M36, M46, M53, M66, M68, M78) stay, shortened where the full text moved with the code.

```ts
// ItemView owning onOpen/onClose/getState/setState (task 3), the scan lifecycle
// wiring (task 8: coordinator, consent chain, progress/cancellation notices, handing
// a completed snapshot's layout to the renderer), and task 11's per-leaf snapshot
// reconciliation plus CityViewState<->store sync (view-reconciliation.ts,
// view-state-sync.ts). Part 5 (V1): the scan lifecycle itself lives in
// city-scan-controller.ts and layout publishing in layout-publisher.ts; the public
// methods below are one-line delegations, so commands.ts and every host test are
// unchanged.
//
// Ruling M68 (task 9): renderer CONSTRUCTION, teardown and sizing live in
// `CityViewport.vue`, the single owner — this file only PROVIDES the real
// `createCityRenderer` factory into the tree (before `mount()`, at the app level,
// since a component's own `provide()` only resolves for ITS descendants) and reads
// the SAME shared handle for the two things only the host layer can do: react to
// `workspace.on('css-change')`, and hand a completed snapshot's layout to whichever
// renderer currently exists.
//
// Host rules this file exists to satisfy (spec 4.4): WebGL context creation happens
// in onOpen, never the constructor; Vue mounts on this.contentEl, never
// containerEl.children[1]; each view gets its OWN Pinia instance; getState() returns
// identifiers and presentation state only; setState validates through the same
// runtime validator as settings; below the 320 CSS px floor no WebGL context exists
// at all (CityViewport's own guard); visibility NEVER authorises a scan.
import { ItemView, Notice } from 'obsidian';
import type { EventRef, Plugin, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { createApp, shallowRef, watch, type App as VueApp, type ShallowRef } from 'vue';
import { createPinia, type Pinia } from 'pinia';
import RootComponent from '../ui/App.vue';
import { createCityRenderer } from '../visualization/city-renderer';
import { useCityStore } from '../ui/stores/city-store';
import { useRunStore } from '../ui/stores/run-store';
import { CITY_RENDERER_KEY, LAYOUT_GENERATION_KEY, createLayoutGenerationSource } from '../ui/renderer-handle';
import { reactToLifecycleChange } from './lifecycle-notices';
import { wireWindowMigration } from './window-migration';
import { reconcileEveryView } from './leaf-registry';
import { applyReconciliationTo } from './view-reconciliation';
import { pickUiState, seedStoreFromState } from './view-state-sync';
import { CityScanController, provideScanCallbacks, type CityViewDeps } from './city-scan-controller';
import { createLayoutPublisher, type LayoutPublisher } from './layout-publisher';
import type { CityRendererPort } from '../visualization/renderer-port';
import type { ScanLifecycleState } from '../application/run-state';
import type { CodebaseSnapshot, CityViewState } from '../domain/model';
import { defaultCityViewState, decodeCityViewState } from './view-state';
import { readPalette } from './theme-bridge';

export type { CityViewDeps } from './city-scan-controller';

export const CITY_VIEW_TYPE = 'codebase-inspector-city';

export class CityView extends ItemView {
  private readonly plugin: Plugin;
  private readonly deps: CityViewDeps;
  /** Part 5 (V1): the coordinator, the consent chain and the start guard. */
  private readonly scanController: CityScanController;
  private vueApp: VueApp | null = null;
  private pinia: Pinia | null = null;
  // Task 9 fix round 2, item 1 (ruling M68): the SHARED renderer handle, provided into
  // the Vue tree at the APP level (a component-level provide only resolves `inject()`
  // calls made by ITS OWN descendants, never by this plain-class code). `CityViewport.vue`
  // is the only WRITER; this file only READS it (theme-colour refresh on `css-change`,
  // and publishing a snapshot's layout) — it never constructs, disposes or sizes anything.
  private readonly cityRendererHandle: ShallowRef<CityRendererPort | null> = shallowRef(null);
  private unwatchRendererForColors: (() => void) | null = null;
  private cssChangeRef: EventRef | null = null;
  private unsubscribeCoordinator: (() => void) | null = null;
  private state: CityViewState = defaultCityViewState();
  // Task 9 fix round 1, item 1 (ruling M66): each view's OWN store instances, resolved by
  // passing `this.pinia` explicitly (Pinia's pattern for a store outside a component's
  // setup), never "whichever pinia is currently active" — the same discipline that keeps
  // `createPinia()` itself per-view (spec 4.4).
  private cityStore: ReturnType<typeof useCityStore> | null = null;
  private runStore: ReturnType<typeof useRunStore> | null = null;
  // Ruling M78: ONE monotonic token source per view, shared with `CityViewport`, which
  // writes setLayout to the same live port. Two private counters meant two sequences
  // against one `latestGeneration`, so a publish after a reconstruct was silently never
  // applied. See renderer-handle.ts.
  private readonly nextLayoutGeneration = createLayoutGenerationSource();
  /** Part 5 (V1): computeLayout, setCity and setLayout, with its own AbortController. */
  private readonly layoutPublisher: LayoutPublisher;
  // Task 11: retained so onClose can call it -- never re-derived, never dropped.
  private unwireWindowMigration: (() => void) | null = null;
  // Task 11 fix round 1, item 1: true once a REAL (validated) setState payload has
  // arrived, whenever that happens relative to onOpen (spec 11's open question).
  // Guards seeding the store from `this.state` -- a fresh view's own constructor
  // default must never be mistaken for a genuine restore (view-state.ts's own
  // `DecodedCityViewState.ok` comment).
  private stateWasRestored = false;
  private unwatchStateSync: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: Plugin, deps: CityViewDeps) {
    super(leaf);
    this.plugin = plugin;
    this.deps = deps;
    this.scanController = new CityScanController(plugin, deps, {
      viewState: () => this.state,
      showNotice: (message) => { this.showNotice(message); },
    });
    this.layoutPublisher = createLayoutPublisher({
      handle: this.cityRendererHandle,
      nextGeneration: this.nextLayoutGeneration,
      setCity: (snapshot, layout) => { this.cityStore?.setCity(snapshot, layout); },
      notify: (message) => { this.showNotice(message); },
    });
  }

  override getViewType(): string { return CITY_VIEW_TYPE; }
  override getDisplayText(): string { return 'Codebase city'; }
  override getIcon(): string { return 'building-2'; }

  /** `scan-codebase` (spec 5: doubles as refresh). Rulings M46 and M53: see
   *  city-scan-controller.ts. A no-op while a run is in flight; never throws. */
  async startScan(): Promise<void> { await this.scanController.startScan(); }

  /** Ruling M46: "Select a codebase" (COPY-02) ALWAYS runs the full consent chain. */
  async selectCodebase(): Promise<void> { await this.scanController.selectCodebase(); }

  /** `cancel-scan`'s callback body (ruling M36); a no-op unless a run is running. */
  cancelScan(): void { this.scanController.cancelScan(); }

  isScanRunning(): boolean { return this.scanController.isScanRunning(); }

  override async onOpen(): Promise<void> {
    this.contentEl.classList.add('codebase-inspector-root');

    this.pinia = createPinia();
    // This view's OWN store instances (item 1, ruling M66) — explicit `pinia`
    // argument, never the ambient "currently active" one, so two CityViews never
    // share data even if Vue's own per-app resolution were ever bypassed.
    this.cityStore = useCityStore(this.pinia);
    this.runStore = useRunStore(this.pinia);
    // typescript-eslint's type-aware linting resolves a cross-file .vue import as an
    // untyped/error module (it has no Vue SFC language-service plugin, unlike vue-tsc,
    // which DOES type-check this correctly — see `npm run typecheck`). Real behaviour
    // is unaffected; this is a lint-tooling gap, not an unsafe value.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- see comment above: vue-tsc, not eslint's type-aware linting, is the accurate check here
    this.vueApp = createApp(RootComponent);
    // 'onSelectCodebase' and (task 5, F7) 'onScanRequested', provided before mount.
    provideScanCallbacks(this.vueApp, this.scanController);
    // Task 9 fix round 2, item 1 (ruling M68): the shared handle AND the real
    // factory, both provided at the APP level, BEFORE mount — `CityViewport`
    // is the only thing that ever WRITES the handle or calls the factory;
    // this file only ever READS the handle afterwards.
    this.vueApp.provide(CITY_RENDERER_KEY, this.cityRendererHandle);
    this.vueApp.provide(LAYOUT_GENERATION_KEY, this.nextLayoutGeneration);
    this.vueApp.provide('createCityRenderer', createCityRenderer);
    this.vueApp.use(this.pinia);
    this.vueApp.mount(this.contentEl);

    // Task 11: containerEl, per spec 4.4's cross-window rule -- see window-migration.ts.
    this.unwireWindowMigration = wireWindowMigration(this.containerEl);

    // Applies the current theme the moment a renderer exists — on first
    // construction, and again on any later reconstruction (e.g. after a
    // context-lost dispose-and-rebuild) — without CityViewport itself needing
    // to import theme-bridge.ts (a host-layer concern; CityViewport stays
    // ignorant of Obsidian's theme system entirely, same as it already never
    // imports 'obsidian'). `watch()` works outside a component's setup exactly
    // like this — it is Vue's reactivity system, not the injection system.
    this.unwatchRendererForColors = watch(this.cityRendererHandle, (renderer) => {
      renderer?.setColors(readPalette(this.contentEl));
    });

    this.cssChangeRef = this.plugin.app.workspace.on('css-change', () => {
      // Re-reads every cached colour. Never moves buildings, changes camera, or
      // clears state (spec 4.4).
      this.cityRendererHandle.value?.setColors(readPalette(this.contentEl));
    });

    this.unsubscribeCoordinator = this.scanController.subscribe((lifecycle) => { this.onLifecycleChange(lifecycle); });

    // Reopening shows retained in-memory state (spec 4.5): if a prior scan already
    // published a snapshot this view's own persisted state points at, render it again
    // without starting anything -- restoring a view never authorises a scan.
    if (this.state.snapshotId) {
      const existing = this.deps.snapshotStore.get(this.state.snapshotId);
      if (existing) void this.layoutPublisher.publish(existing);
    }

    // Task 11 fix round 1, item 1: seeds the store AFTER the block above, so a
    // restored query's own match set is computed against a real `store.snapshot`
    // rather than the empty one `setQuery` falls back to. Covers "setState arrived
    // BEFORE onOpen"; `setState` itself covers the other ordering.
    if (this.stateWasRestored) seedStoreFromState(this.cityStore, this.state);
    // The one real source of truth for "did the live UI change" from here on --
    // mirrored back into `this.state` so `getState()`/workspace.json reflect a
    // selection, query, camera or view-mode change made with no rescan at all
    // (spec 4.2: "the view mirrors [camera-changed] into CityViewState").
    this.unwatchStateSync = watch(() => pickUiState(this.cityStore!), (live) => {
      this.state = { ...this.state, ...live };
    });
  }

  override async onClose(): Promise<void> {
    // Fix round 1, Important 2: closing the tab mid-scan must actually STOP the walk
    // (CityScanController.cancelIfRunning), not merely discard its result later.
    this.scanController.cancelIfRunning();
    if (this.cssChangeRef) {
      this.plugin.app.workspace.offref(this.cssChangeRef);
      this.cssChangeRef = null;
    }
    this.unwatchRendererForColors?.();
    this.unwatchRendererForColors = null;
    this.unsubscribeCoordinator?.();
    this.unsubscribeCoordinator = null;
    this.unwireWindowMigration?.();
    this.unwireWindowMigration = null;
    this.unwatchStateSync?.();
    this.unwatchStateSync = null;
    this.layoutPublisher.abort();
    // Ruling M68: no `teardownRenderer()` here — `CityViewport.vue`'s own
    // `onBeforeUnmount` (its ResizeObserver disconnect, `renderer.dispose()`, which
    // itself calls `forceContextLoss()`, spec 4.4, and clearing the shared handle)
    // fires as part of THIS `unmount()` call. Disposing here too would be the
    // double-dispose ruling M68 warned about.
    this.vueApp?.unmount();
    this.vueApp = null;
    this.pinia = null;
    this.cityStore = null;
    this.runStore = null;
  }

  override getState(): Record<string, unknown> {
    // Identifiers and presentation state only — never a snapshot, a resolved
    // absolute path, or scan authorisation (spec 4.4).
    return { ...this.state };
  }

  override async setState(state: unknown, _result: ViewStateResult): Promise<void> {
    // workspace.json is user-editable: validated through the same runtime validator
    // as settings. An invalid payload keeps whatever state this view already had,
    // never partially applying it.
    const decoded = decodeCityViewState(state, this.state);
    this.state = decoded.state;
    if (!decoded.ok) return;
    this.stateWasRestored = true;
    // Spec 11's open question: ordering between setState and onOpen on workspace
    // restore is not guaranteed. `onOpen` seeds the store when IT runs after this;
    // this covers setState arriving AFTER onOpen already ran (the store exists).
    if (this.cityStore) seedStoreFromState(this.cityStore, this.state);
  }

  /** Reacts to every run-lifecycle transition (spec 7) — the decision logic lives in
   *  `lifecycle-notices.ts`'s `reactToLifecycleChange` (task 9 fix round 1, item 1).
   *  This method is just the host-specific wiring: which store, which snapshot store,
   *  which callbacks. */
  private onLifecycleChange(lifecycle: ScanLifecycleState): void {
    const updated = reactToLifecycleChange(
      lifecycle, this.deps.snapshotStore, this.state.snapshotId, this.runStore,
      { publishLayout: (snapshot) => { void this.layoutPublisher.publish(snapshot); }, showNotice: (m) => { this.showNotice(m); } },
    );
    if (updated) this.state = { ...this.state, ...updated };
    // Task 11: a sibling leaf on the same profile knows nothing about THIS
    // coordinator's completion (leaf-registry.ts: ScanCoordinator is one per view).
    if (lifecycle.run.status === 'complete' && lifecycle.publishedSnapshotId) {
      const snapshot = this.deps.snapshotStore.get(lifecycle.publishedSnapshotId);
      if (snapshot) reconcileEveryView(this.plugin.app, snapshot);
    }
  }

  /** Called by `reconcileEveryView` for EVERY open CityView, including this one --
   *  see view-reconciliation.ts for the guard, the identity match, and Minor 5's
   *  sibling-vs-own notice wording. */
  applyReconciliation(snapshot: CodebaseSnapshot): void {
    if (!this.cityStore) return;
    const { notice } = applyReconciliationTo(this.cityStore, this.state, snapshot);
    if (notice) this.showNotice(notice);
  }

  /** A one-shot Notice for a terminal (cancelled/failed) transition, a scan-start
   *  failure or a render failure — never for progress, which is `runStore`'s and
   *  `StatusBanner`'s job. Nothing here retains the instance afterwards. */
  private showNotice(message: string): void {
    void new Notice(message, 6000);
  }
}
```

- [ ] **Step 6: Create `src/ui/screens/city/use-city-floor.ts`.** `updateResponsiveLayout` and `attachResizeObserver` are moved from `CityWorkspace.vue` unchanged, with the same two observed elements (the leaf and `.ci-shell__content`). Task 2 changes this file.

```ts
// WP-02 Part 5 (V2): the city's responsive wiring, moved out of CityWorkspace.vue with no
// behaviour change.
//
// Phase 2 fix wave, I2 (Important): spec 5.2 says "below a hard floor of 320 CSS px inline
// size the view renders LIST-FIRST and creates no WebGL context at all". CityViewport
// disposes the renderer; this switches the presentation, so a leaf dragged into a sidebar
// (spec 5.2: "can be ~150 px") shows the file list instead of an empty bordered stage.
//
// This lives at the workspace level, NOT in CityViewport.applySize, for a structural
// reason: entering list mode UNMOUNTS CityViewport (CityStage's `v-if`), which disconnects
// the very ResizeObserver that would have to notice the leaf widening again -- a one-way
// door. `forcedListByFloor` records that WE switched, so widening restores the user's own
// spatial mode (`returnFromList()` -> `lastSpatialMode`) and never drags someone out of a
// list view they chose themselves. `setViewMode` preserves query, selection and the camera
// bookmark, which is exactly what the spec's next sentence requires.
import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import type { useCityStore } from '../../stores/city-store';
import { DRAWER_MAX_INLINE_SIZE, MIN_INLINE_SIZE } from '../../responsive';
import { cityInlineSize, narrowContainer } from '../../container-box';

interface WinBearing { win?: Window }

export interface CityFloor {
  /** Below the 820 px drawer threshold: the Escape chain's drawer link. */
  narrowDrawer: Readonly<Ref<boolean>>;
}

export function useCityFloor(
  rootEl: Readonly<Ref<HTMLElement | null>>,
  store: ReturnType<typeof useCityStore>,
  filesDrawerOpen: Ref<boolean>,
): CityFloor {
  const narrowDrawer = ref(false);
  const forcedListByFloor = ref(false);
  let resizeObserver: ResizeObserver | null = null;
  let unwireMigration: (() => void) | null = null;

  function updateResponsiveLayout(): void {
    const el = rootEl.value;
    if (!el) return;
    // Ruling M97, reopened: the CONTENT box, which is what `container-type: inline-size`
    // compares -- `getBoundingClientRect()` is the BORDER box and Obsidian's own
    // `.view-content` padding makes the two differ by 24 px. See container-box.ts.
    const width = cityInlineSize(el);
    narrowDrawer.value = width < DRAWER_MAX_INLINE_SIZE;
    // Re-review round 2 (R1, Important): at or above the threshold the Files overlay
    // STOPS EXISTING -- styles.css makes the list a permanent column and hides the
    // opener -- so the width that ends the narrow layout is where the flag is retired.
    // Assigned directly rather than through `closeFilesDrawer()`: that one focuses the
    // opener, which is exactly the hidden control this must not send focus to.
    if (!narrowDrawer.value) filesDrawerOpen.value = false;
    // A hidden leaf collapses to exactly 0 (spec 4.2's pause/resume invariant, the
    // same case CityViewport's own zero-box guard exists for) -- suspended, not narrow.
    if (width <= 0) return;
    if (width < MIN_INLINE_SIZE) {
      if (store.viewMode === 'list') return;
      forcedListByFloor.value = true;
      store.setViewMode('list');
    } else if (forcedListByFloor.value) {
      forcedListByFloor.value = false;
      store.returnFromList();
    }
  }

  /** Task 11 fix round 1, item 3: rebuilt off `el`'s CURRENT `.win`, never left pointing
   *  at the pre-migration window's `ResizeObserver` constructor (which has no defined
   *  behaviour once `el` has moved). */
  function attachResizeObserver(el: HTMLElement): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
    const win = (el as unknown as WinBearing).win;
    if (!win) return;
    resizeObserver = new (win as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver(() => {
      updateResponsiveLayout();
    });
    resizeObserver.observe(narrowContainer(el));
    // WP-02: the shell's nav column flipping inline resizes the city's content box but not the leaf.
    const content = el.closest<HTMLElement>('.ci-shell__content');
    if (content) resizeObserver.observe(content);
  }

  onMounted(() => {
    const el = rootEl.value;
    if (!el) return;
    updateResponsiveLayout();
    attachResizeObserver(el);
    // Task 11 fix round 1, item 3: re-measured and re-attached on migration -- the
    // "no wrong-window DOM" clause task 11 named.
    unwireMigration = el.onWindowMigrated(() => {
      updateResponsiveLayout();
      attachResizeObserver(el);
    });
  });
  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    unwireMigration?.();
    unwireMigration = null;
  });

  return { narrowDrawer };
}
```

- [ ] **Step 7: Create `src/ui/screens/city/use-city-escape.ts`.** `onGlobalKeydown` and `attachKeydownListener` are moved from `CityWorkspace.vue` unchanged. The listener stays on the leaf's own `doc` (WP-01 behaviour, Global Constraints).

```ts
// WP-02 Part 5 (V2): the city's Escape chain, moved out of CityWorkspace.vue with no
// behaviour change.
//
// Task 9 fix round 2, item 2 (Fold): escapeIntent's chain (modal -> help -> nonmodal
// drawer -> query -> selection, ruling M61) was previously reachable end to end ONLY
// through FileSearch.vue's own local `clear-query` handling. This shell-level listener
// reaches the drawer and selection branches too, with REAL state — no `modal`/`help`
// state exists at this level yet, so those two never fire; the rest do.
//
// Task 9 fix round 3, item 1 (Important): it acts only when focus is inside THIS view
// (M9: two open leaves share one document), gated exactly like FileSearch.vue's own
// `viewRoot.contains(doc.activeElement)` check.
import { onBeforeUnmount, onMounted, type Ref, type ShallowRef } from 'vue';
import type { useCityStore } from '../../stores/city-store';
import { escapeIntent } from '../../interaction/escape-intent';
import { narrowContainer } from '../../container-box';

interface DocBearing { doc?: Document }

export interface CityEscapeOptions {
  rootEl: Readonly<Ref<HTMLElement | null>>;
  store: ReturnType<typeof useCityStore>;
  /** The element that opened the inspector (drawer-focus.ts); focus returns to it. */
  inspectorOpener: ShallowRef<HTMLElement | null>;
  filesDrawerOpen: Readonly<Ref<boolean>>;
  narrowDrawer: Readonly<Ref<boolean>>;
  /** Closes the Files drawer and returns focus to its opener. */
  closeFilesDrawer: () => void;
}

export function useCityEscape(options: CityEscapeOptions): void {
  const { rootEl, store, inspectorOpener, filesDrawerOpen, narrowDrawer, closeFilesDrawer } = options;
  let listenerDoc: Document | null = null;
  let unwireMigration: (() => void) | null = null;

  /** `event.isComposing` (native, spec-provided) rather than a locally tracked flag —
   *  this listens on the document, never a specific input, so there is no single
   *  element whose own compositionstart/end this could track instead. */
  function onGlobalKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const el = rootEl.value;
    if (!el) return;
    const active = listenerDoc?.activeElement ?? null;
    if (!narrowContainer(el).contains(active)) return;
    const intent = escapeIntent({
      composing: event.isComposing,
      inInspector: store.inspectorOpen,
      // Phase 2 fix wave, I1 (Important): the shell's OWN Files-drawer state -- without it
      // the chain fell through to `inCanvas && selected` (true precisely BECAUSE focus is
      // inside the open drawer's list) and Escape destroyed the selection instead of
      // closing the drawer. Spec 5.2 names Files as one of the two nonmodal drawers.
      filesDrawer: filesDrawerOpen.value,
      narrowDrawer: narrowDrawer.value,
      inSearch: Boolean(active?.closest('.ci-search')),
      query: store.query,
      // "canvas/list focus": the spatial selection surfaces a selection can be MADE from
      // (spec 5.2) — the 3D viewport and the HTML list both select the same
      // `store.selectedEntityId`, so Escape clearing it applies to either.
      inCanvas: Boolean(active?.closest('.ci-viewport, .ci-file-list')),
      selected: store.selectedEntityId !== null,
    });
    if (intent === 'close-inspector') {
      store.closeInspector();
      inspectorOpener.value?.focus();
    } else if (intent === 'close-files-drawer') {
      closeFilesDrawer();          // already returns focus to the opener
    } else if (intent === 'clear-selection') {
      store.clearSelection();
    } else if (intent === 'clear-query') {
      // Reachable only when a leftover query exists while focus is on NEITHER the search
      // field (FileSearch.vue claims that case via `event.defaultPrevented`) nor anywhere
      // else this chain checks first (tests/unit/escape-intent.test.ts's reachability note).
      store.setQuery('');
    }
  }

  /** Re-resolves the document the listener is attached to, off `el`'s CURRENT `.doc`
   *  (spec 4.4: the injected Document, never a bare global). Task 11 fix round 1, item 3
   *  (Important): a pop-out's Escape key used to stay bound to the PRE-migration document
   *  forever. Detaches the previous document's listener first, so migrating more than
   *  once never accumulates one. */
  function attachKeydownListener(el: HTMLElement): void {
    listenerDoc?.removeEventListener('keydown', onGlobalKeydown);
    listenerDoc = (el as unknown as DocBearing).doc ?? null;
    listenerDoc?.addEventListener('keydown', onGlobalKeydown);
  }

  onMounted(() => {
    const el = rootEl.value;
    if (!el) return;
    attachKeydownListener(el);
    unwireMigration = el.onWindowMigrated(() => { attachKeydownListener(el); });
  });
  onBeforeUnmount(() => {
    listenerDoc?.removeEventListener('keydown', onGlobalKeydown);
    listenerDoc = null;
    unwireMigration?.();
    unwireMigration = null;
  });
}
```

- [ ] **Step 8: Create `src/ui/screens/city/CitySelectionNotice.vue`.** The markup is moved from `CityWorkspace.vue` byte for byte, including the `v-if`. `revealSelection` moves with it and reads the shared renderer handle through `useCityRendererHandle()`, which resolves to the handle `CityWorkspace`'s `provideCityRenderer()` provides (or reuses from the app level, ruling M68).

```vue
<!--
  WP-02 Part 5 (V2): COPY-30, moved out of CityWorkspace.vue with no behaviour change.
  Phase 2c, I4: spec 5.2 says a filter-hidden selection is "EXPLAINED, never silently
  replaced". NOT routed through viewSurfaceState/StatusBanner (a single-winner chain; this
  must coexist with whatever else is showing) and not a second live region
  (AnnouncementRegion owns that). Task 9 (F13): the tail used to be unpressable prose; it
  is two real buttons. A3 fix (whole-branch review, I3): all three pieces —
  COPY_30_EXPLANATION and both button labels — derive from COPY_30 itself, never retyped.
-->
<script setup lang="ts">
import { useCityStore } from '../../stores/city-store';
import { useCityRendererHandle } from '../../renderer-handle';
import { COPY_30_CLEAR_LABEL, COPY_30_EXPLANATION, COPY_30_REVEAL_LABEL } from '../../copy';

const store = useCityStore();
// Task 9 (F13): the SAME shared handle CityViewport writes (CityWorkspace provides it).
const cityRenderer = useCityRendererHandle();

/** Task 9 (F13): "Reveal file" — re-selects (idempotent) and focuses through the renderer,
 *  like FileInspector.vue's own Focus button. Never touches `store.query`: revealing is
 *  not the same action as clearing the search that hid it. */
function revealSelection(): void {
  const id = store.selectedEntityId;
  if (!id) return;
  store.select(id);
  cityRenderer.value?.focus(id);
}
</script>

<template>
  <div
    v-if="store.banner"
    class="ci-app__selection-notice"
  >
    <p class="ci-app__selection-notice-text">
      {{ COPY_30_EXPLANATION }}
    </p>
    <div class="ci-selection-notice__actions">
      <button
        type="button"
        class="ci-selection-notice__reveal"
        @click="revealSelection"
      >
        {{ COPY_30_REVEAL_LABEL }}
      </button>
      <button
        type="button"
        class="ci-selection-notice__clear"
        @click="store.clearSelection()"
      >
        {{ COPY_30_CLEAR_LABEL }}
      </button>
    </div>
  </div>
</template>
```

- [ ] **Step 9: Rewrite `src/ui/screens/CityWorkspace.vue`.** Replace the whole file with the version below. Compared with today:
  - `revealSelection`, `forcedListByFloor`, `updateResponsiveLayout`, `onGlobalKeydown`, `attachKeydownListener`, `attachResizeObserver`, the `onMounted`/`onBeforeUnmount` pair and the `WinBearing`/`DocBearing` interfaces are gone. They moved in Steps 6–8.
  - `provideCityRenderer()` is still called (the shared handle must exist at this level for CityViewport and the notice), but its result is no longer captured.
  - The notice block becomes `<CitySelectionNotice />` at the same position.
  - Everything else is unchanged, including the template's class names and order.

```vue
<!--
  C01 — the city composition (WP-02: moved out of App.vue, which is now the inspector shell).
  Behaviour unchanged. Still exposes `rendererHost` (CityViewport's own internal stage div,
  forwarded up through its exposed `stageEl`) for tests that mount `App` directly,
  but task 9 fix round 2, item 1 (ruling M68) ended `city-view.ts`'s own read of it:
  CityViewport is now the SINGLE owner of renderer construction, teardown and
  sizing, reached by `city-view.ts` PROVIDING the real `createCityRenderer` factory
  into this tree instead of calling it directly and reading the result back out.

  Owns the ONE shared renderer-command handle and the ONE shared stage-element
  handle (renderer-handle.ts) at the root of the tree, and the ONE derivation of
  "which view-level state currently applies" (view-surface.ts) driving
  StatusBanner/EmptyState. See task-9-report.md for the two states
  (invalid-directory, read-not-approved) this derivation cannot yet reach.

  Part 5 (V2): the Escape chain (city/use-city-escape.ts), the 320 px floor and 820 px
  drawer wiring (city/use-city-floor.ts) and the COPY-30 notice
  (city/CitySelectionNotice.vue) live beside this file, moved without behaviour change.
-->
<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useRunStore } from '../stores/run-store';
import { provideCityRenderer, provideCityStageEl } from '../renderer-handle';
import { provideInspectorOpener } from '../drawer-focus';
import { countPartialRead, deriveViewSurfaceState } from '../view-surface';
import { COPY_02 } from '../copy';
import AppToolbar from '../components/AppToolbar.vue';
import CodebaseFileList from '../components/CodebaseFileList.vue';
import CityStage from '../components/CityStage.vue';
import FileInspector from '../components/FileInspector.vue';
import SnapshotStatus from '../components/SnapshotStatus.vue';
import StatusBanner from '../components/StatusBanner.vue';
import EmptyState from '../components/EmptyState.vue';
import AnnouncementRegion from '../components/AnnouncementRegion.vue';
import CitySelectionNotice from './city/CitySelectionNotice.vue';
import { useCityEscape } from './city/use-city-escape';
import { useCityFloor } from './city/use-city-floor';

const onSelectCodebase = inject<() => void>('onSelectCodebase', () => {});

// Task 9 (F13): the ONE shared renderer handle CityViewport writes (reused from the app
// level when city-view.ts provided it, ruling M68). CitySelectionNotice's Reveal control
// issues its renderer command through it.
provideCityRenderer();
provideCityStageEl();
const inspectorOpenerHandle = provideInspectorOpener();

const store = useCityStore();
const runStore = useRunStore();

// Task 9 fix round 1, item 7 (Important): the <820px layout's Files overlay —
// unlike the Inspector, which already has `store.inspectorOpen` — had no
// state of its own at all, no opener and no close control. Purely a narrow-
// layout UI concern (never persisted, never meaningful at >=820px, where CSS
// ignores it entirely), so it stays local here rather than in the Pinia store.
const filesDrawerOpen = ref(false);
const filesDrawerOpener = ref<HTMLElement | null>(null);

function openFilesDrawer(event: MouseEvent): void {
  filesDrawerOpener.value = event.currentTarget as HTMLElement;
  filesDrawerOpen.value = true;
  store.closeInspector();   // ONE overlay at a time
}
function closeFilesDrawer(): void {
  filesDrawerOpen.value = false;
  filesDrawerOpener.value?.focus();
}
// The other half of "one overlay at a time": opening the inspector (from
// CodebaseFileList's own row activation, or a future canvas pick) closes the
// Files drawer too, without CodebaseFileList needing to know the drawer exists.
watch(() => store.inspectorOpen, (open) => { if (open) filesDrawerOpen.value = false; });

const rootEl = ref<HTMLElement | null>(null);
// Phase 2 fix wave I2 and R1: the 320 px list-first floor and the 820 px drawer threshold.
const { narrowDrawer } = useCityFloor(rootEl, store, filesDrawerOpen);
// Task 9 fix rounds 2 and 3, task 11 fix round 1 item 3: the leaf-scoped Escape chain.
useCityEscape({
  rootEl, store, inspectorOpener: inspectorOpenerHandle, filesDrawerOpen, narrowDrawer, closeFilesDrawer,
});

// Task 10 (F5): CityStage.vue now owns CityHeader/CityViewport/CameraControls/
// MetricLegend as one extracted unit (see that file's own comment for why), and
// relays CityViewport's own exposed `stageEl` back up through its own
// `defineExpose` — this ref reaches the SAME element `cityViewportRef` used to,
// one hop further away.
interface CityStageExposed { stageEl: HTMLElement | null }
const cityStageRef = ref<CityStageExposed | null>(null);

// Task 9 fix round 1, item 4 (Important): renderer/root unavailability are
// deliberately NEVER wired into this derivation. `view-surface.ts` still SUPPORTS
// 'renderer-unavailable'/'context-lost' as states (StatusBanner/EmptyState's own
// component tests exercise them directly), but feeding the real signal in here
// made it the head of a single-winner priority chain — masking "no source
// selected", scanning, cancelled and every other state behind it, permanently on
// any narrow leaf — a regression against task 3, whose welcome button was
// unconditional. CityViewport already renders its OWN, genuinely non-exclusive
// notice for exactly this signal (COPY-14 / the reconstruct notice), inside the
// viewport pane, alongside whatever else is on screen — picking IT as the one
// owner of that copy is what fixes the double-print too.
// Phase 2c, M8: functions of `store.snapshot` ALONE. Inline in the computed below — which
// also depends on `store.matchingIds`, i.e. on every debounced keystroke — an O(entities)
// filter and an O(entities + observations) scan both re-ran per keystroke while depending
// on nothing that had changed. Split out, they cache on the snapshot.
const totalFileCount = computed(() => store.snapshot?.entities.filter((e) => e.kind === 'file').length ?? 0);
const partialRead = computed(() => countPartialRead(store.snapshot));

const viewSurfaceState = computed(() => deriveViewSurfaceState({
  hasSnapshot: store.snapshot !== null,
  runStatus: runStore.run.status,
  runProcessedFiles: runStore.run.status === 'running' ? runStore.run.processedFiles : 0,
  runFailureMessage: runStore.run.status === 'failed' ? runStore.run.message : null,
  totalFileCount: totalFileCount.value,
  matchingIds: store.matchingIds,
  query: store.query,
  partialRead: partialRead.value,
  rendererUnavailableReason: null,
  rootUnavailable: false,
}));

const rendererHost = computed(() => cityStageRef.value?.stageEl ?? null);
defineExpose({ rendererHost });
</script>

<template>
  <div
    ref="rootEl"
    class="ci-app"
  >
    <!-- Task 5 (F7): the toolbar itself (search, Scan, mode toggle, Files opener) now
         lives in AppToolbar.vue -- extracted, not rewritten, to keep this file under
         the 400-line src/** budget (task-5-brief.md step 4). `openFilesDrawer` stays
         here: it is shell-level state (`filesDrawerOpen`/`filesDrawerOpener`, item 7's
         own one-overlay-at-a-time rule), not the toolbar's own concern. -->
    <AppToolbar @open-files-drawer="openFilesDrawer" />
    <!-- Phase 2c, I4 / Task 9 (F13): COPY-30, a filter-hidden selection explained with two
         real buttons. See city/CitySelectionNotice.vue (Part 5 V2). -->
    <CitySelectionNotice />
    <div class="ci-app__body">
      <!-- Rendered per the container-query layout (styles.css's 820px threshold),
           never per viewMode: the >=820px layout is "list + canvas + inspector"
           together, regardless of which spatial mode the camera is in. Below
           820px it is a drawer instead, gated by `filesDrawerOpen` (item 7) —
           mutually exclusive with the Inspector drawer, never both at once. -->
      <div
        class="ci-app__list-wrapper"
        :class="{ 'ci-app__list-wrapper--open': filesDrawerOpen || store.viewMode === 'list' }"
      >
        <button
          v-if="filesDrawerOpen"
          type="button"
          aria-label="Close files"
          class="ci-app__drawer-close"
          @click="closeFilesDrawer"
        >
          Close
        </button>
        <CodebaseFileList class="ci-app__list" />
      </div>
      <!-- Task 10 (F5): CityHeader, CityViewport (with CameraControls slotted
           inside its own `.ci-viewport`) and MetricLegend now live in CityStage.vue
           -- extracted out of this file, which the brief's own measurement found at
           its 400-line cap with no headroom left for this task's own markup. See
           that file's own comment for the full account, including why
           CameraControls is no longer this column's own direct sibling. -->
      <CityStage ref="cityStageRef" />
      <FileInspector v-if="store.inspectorOpen" />
    </div>
    <div
      v-if="viewSurfaceState.kind === 'no-source'"
      class="ci-app__welcome-action"
    >
      <!-- Class name kept stable from the task-3 welcome shell:
           tests/host/city-view.test.ts (task 8, unmodified this task) selects the
           "Select a codebase" action by this exact selector. -->
      <button
        type="button"
        class="ci-welcome__action"
        @click="onSelectCodebase"
      >
        {{ COPY_02 }}
      </button>
    </div>
    <SnapshotStatus />
    <StatusBanner :state="viewSurfaceState" />
    <EmptyState :state="viewSurfaceState" />
    <AnnouncementRegion />
  </div>
</template>
```

- [ ] **Step 10: Run and confirm it passes.**
  - `npx vitest run tests/unit/city-budget.test.ts`. All six cases pass.
  - `wc -l src/host/city-view.ts src/ui/screens/CityWorkspace.vue`. Both must be ≤ 340 and ≤ 300 (V1/V2 targets). Report the numbers.
  - The split's regression set, none of it edited:
    - `npx vitest run tests/host` (every `tests/host/*.test.ts`, including `city-view-store-wiring`, `city-view`, `city-view-scan-modes`, `commands`, `multi-leaf`, `window-migration`, `lifecycle-leaks`). `tests/host/clean-vault-install.test.ts` can time out on a loaded machine: re-run it alone before calling it a failure.
    - `npx vitest run tests/acceptance` (the `*.steps.ts` scenarios run in the jsdom project, `vitest.config.ts`).
    - `npx vitest run tests/component/workspace-shell.test.ts tests/component/responsive-floor.test.ts tests/component/container-box.test.ts tests/component/city-screen.test.ts tests/component/welcome-state.test.ts tests/component/status-surfaces.test.ts tests/component/toolbar-scan.test.ts tests/component/camera-round-trip.test.ts tests/component/view-surface-memo.test.ts tests/component/command-palette.test.ts tests/component/shell-provenance.test.ts tests/component/file-search.test.ts tests/unit/css-class-scope.test.ts tests/unit/host-cascade.test.ts tests/unit/escape-intent.test.ts tests/unit/obsidian-mock-scope.test.ts tests/host/plugin-onload.test.ts`
  - Then the gate: `npm run typecheck && npm run lint:fast`, and `npx eslint src/host/city-view.ts src/host/city-scan-controller.ts src/host/layout-publisher.ts src/ui/screens/CityWorkspace.vue src/ui/screens/city/use-city-floor.ts src/ui/screens/city/use-city-escape.ts src/ui/screens/city/CitySelectionNotice.vue tests/unit/city-budget.test.ts --max-warnings 0`.
  - Expected and not to be fixed: `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` now fail on the `src/` file count (5 new files). Task 16 refreshes those counts once.
- [ ] **Step 11: Commit.** Only the eight files above. `refactor(host,ui): split city-view.ts and CityWorkspace.vue into scan controller, layout publisher and city composables (V1-V3)`

---

### Task 2: One ResizeObserver per leaf; CameraControls re-measures (V4, V5)

**Files:**
- Create: `src/ui/shell/leaf-layout.ts` (~45 lines)
- Modify: `src/ui/App.vue` (164 → ~168): call `provideLeafLayout` after `navInline`.
- Modify: `src/ui/screens/city/use-city-floor.ts` (from Task 1, ~102 → ~107): react to `layoutTick`; observe nothing inside the shell; fall back to one leaf observer alone.
- Modify: `src/ui/components/CameraControls.vue` (285 → ~303): `userToggled`; re-apply the steps default on every `layoutTick`.
- Not modified: `src/ui/shell/use-leaf-width.ts`. Its observer is already the leaf's one observer, and its `Ref<number>` is what `provideLeafLayout` takes.
- Test: `tests/component/workspace-shell.test.ts` (273 → ~300): the nav-flip test is rewritten, and an observer-count test is added.
- Test: `tests/component/camera-controls.test.ts` (281 → ~338): a new `describe` for V5.
- Test: `tests/component/container-box.test.ts` (144 → ~148): the M97 helper opens the drawer narrow, then resizes to the measured width. This keeps what it checks, and it passes before and after (see Step 1).

**Interfaces:**
- Consumes: `useLeafWidth(rootEl): Ref<number>` (App.vue), `navInline: ComputedRef<boolean>` (App.vue); from Task 1, `useCityFloor` (`src/ui/screens/city/use-city-floor.ts`).
- Produces (`src/ui/shell/leaf-layout.ts`):
  - `export interface LeafLayout { leafWidth: Readonly<Ref<number>>; navInline: Readonly<Ref<boolean>>; layoutTick: Readonly<Ref<number>> }`;
  - `export const LEAF_LAYOUT_KEY: InjectionKey<LeafLayout>`;
  - `export function provideLeafLayout(leafWidth: Readonly<Ref<number>>, navInline: Readonly<Ref<boolean>>): LeafLayout`. `layoutTick` starts at 0 and increments in a `flush: 'post'` watcher on `[leafWidth, navInline]`;
  - `export function injectLeafLayout(): LeafLayout | null`.

- [ ] **Step 1: Write the failing tests.**

  **(a) `tests/component/workspace-shell.test.ts`.**
  - Add `import CityScreen from '../../src/ui/screens/CityScreen.vue';` after the `App` import.
  - Replace `installTargetedResizeObserver` (lines 14–32) with the version below, which also counts observers per element:

```ts
/** A ResizeObserver stand-in that fires only the observers watching a given element, and
 *  counts them (Part 5 V4: one observer per leaf). installControllableResizeObserver
 *  fires every observer. */
function installTargetedResizeObserver() {
  const entries: { cb: () => void; targets: Element[] }[] = [];
  const holder = window as unknown as { ResizeObserver: unknown };
  const previous = holder.ResizeObserver;
  holder.ResizeObserver = class {
    private readonly entry: { cb: () => void; targets: Element[] };
    constructor(cb: () => void) { this.entry = { cb, targets: [] }; entries.push(this.entry); }
    observe(target: Element): void { this.entry.targets.push(target); }
    unobserve(): void {}
    disconnect(): void { this.entry.targets.length = 0; }
  };
  return {
    resize: (target: Element) => { entries.filter((e) => e.targets.includes(target)).forEach((e) => { e.cb(); }); },
    observersOf: (target: Element): number => entries.filter((e) => e.targets.includes(target)).length,
    restore: () => { holder.ResizeObserver = previous; },
  };
}
```

  - Replace the whole test `it('re-measures the city when only the shell content box resizes (nav column flips)', …)` (lines 192–219) with these two tests:

```ts
  it('re-measures the city after the nav column flips inline with the leaf width (Part 5 V4)', async () => {
    // App's leaf observer is the leaf's only one. The city re-measures on the shell's
    // post-patch layoutTick, so the inline nav column is already in the DOM when
    // cityInlineSize subtracts it.
    const ro = installTargetedResizeObserver();
    try {
      const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
      leaf.getBoundingClientRect = () => ({ width: 700 } as DOMRect);
      const w = mountShell(leaf);
      w.find<HTMLElement>('.ci-shell__nav').element.getBoundingClientRect = () => ({ width: 220 } as DOMRect);
      await w.get('[aria-label="Files"]').trigger('click');
      expect(w.find('.ci-app__list-wrapper--open').exists()).toBe(true);

      // 1000 px leaf: the nav column goes inline (220), so the city gets 780 and stays narrow.
      leaf.getBoundingClientRect = () => ({ width: 1000 } as DOMRect);
      ro.resize(leaf);
      await nextTick();
      expect(w.find('.ci-shell').classes()).toContain('ci-shell--nav-inline');
      expect(w.find('.ci-app__list-wrapper--open').exists()).toBe(true);

      // 1200 px leaf: the city gets 980, so the narrow-only drawer is retired.
      leaf.getBoundingClientRect = () => ({ width: 1200 } as DOMRect);
      ro.resize(leaf);
      await nextTick();
      expect(w.find('.ci-app__list-wrapper--open').exists()).toBe(false);
      w.unmount();
      leaf.remove();
    } finally {
      ro.restore();
    }
  });

  it('observes the leaf exactly once: App inside the shell, the city itself when mounted alone (Part 5 V4)', () => {
    const ro = installTargetedResizeObserver();
    try {
      const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
      const w = mountShell(leaf);
      expect(ro.observersOf(leaf)).toBe(1);
      expect(ro.observersOf(w.get('.ci-shell__content').element)).toBe(0);
      w.unmount();
      expect(ro.observersOf(leaf)).toBe(0);
      leaf.remove();

      const alone = document.body.createDiv({ cls: 'codebase-inspector-root' });
      const city = mount(CityScreen, { attachTo: alone, global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });
      expect(ro.observersOf(alone)).toBe(1);
      city.unmount();
      alone.remove();
    } finally {
      ro.restore();
    }
  });
```

  **(b) `tests/component/camera-controls.test.ts`.**
  - Change the vue import to `import { nextTick, ref } from 'vue';` (add the line; the file has no vue import today).
  - Add `import { LEAF_LAYOUT_KEY, type LeafLayout } from '../../src/ui/shell/leaf-layout';` after the `renderer-handle` import.
  - Give `mountControls` a fourth optional parameter and spread it into `provide`:

```ts
function mountControls(
  rendererDouble: ReturnType<typeof makeRendererDouble>,
  stageEl: HTMLElement,
  props: { stepsCollapsed?: boolean } = {},
  leafLayout?: LeafLayout,
) {
  return mount(CameraControls, {
    props,
    global: {
      provide: {
        [CITY_RENDERER_KEY as symbol]: { value: rendererDouble },
        [CITY_STAGE_KEY as symbol]: { value: stageEl },
        ...(leafLayout ? { [LEAF_LAYOUT_KEY as symbol]: leafLayout } : {}),
      },
    },
    attachTo: document.body,
  });
}
```

  - Append a new `describe` block after the existing `describe('CameraControls.vue (C09) — WCAG 2.5.7', …)` block, before the stylesheet `describe`:

```ts
// Part 5 V5 (Part 2 deferral): the steps default was computed once, at mount. It now follows
// the shell's ONE leaf measurement (leaf-layout.ts's layoutTick) until the user toggles.
describe('CameraControls re-measures on every leaf layout change (Part 5 V5)', () => {
  let rendererDouble: ReturnType<typeof makeRendererDouble>;
  beforeEach(() => { setActivePinia(createPinia()); rendererDouble = makeRendererDouble(); });

  /** What App's provideLeafLayout provides; the test advances the tick by hand. */
  function layoutDouble(): { layout: LeafLayout; tick: () => void } {
    const layoutTick = ref(0);
    return { layout: { leafWidth: ref(900), navInline: ref(true), layoutTick }, tick: () => { layoutTick.value += 1; } };
  }
  function resizeLeaf(stage: HTMLElement, width: number): void {
    stage.closest<HTMLElement>('.codebase-inspector-root')!.getBoundingClientRect = () => ({
      width, height: 700, top: 0, left: 0, right: width, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
    });
  }

  it('collapses the steps when the leaf narrows across 820 px, and reopens them when it widens', async () => {
    const stage = stageInRoot(900);
    const { layout, tick } = layoutDouble();
    const wrapper = mountControls(rendererDouble, stage, {}, layout);
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(true);

    resizeLeaf(stage, 600);
    tick();
    await nextTick();
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(false);

    resizeLeaf(stage, 900);
    tick();
    await nextTick();
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(true);
  });

  it('never overrides the user once they have toggled the steps themselves', async () => {
    const stage = stageInRoot(900);
    const { layout, tick } = layoutDouble();
    const wrapper = mountControls(rendererDouble, stage, {}, layout);
    resizeLeaf(stage, 600);
    tick();
    await nextTick();
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(false);

    await wrapper.find('.ci-camera-controls__more').trigger('click');   // the user opens them
    resizeLeaf(stage, 500);
    tick();
    await nextTick();
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(true);

    await wrapper.find('.ci-camera-controls__more').trigger('click');   // …and closes them
    resizeLeaf(stage, 1000);
    tick();
    await nextTick();
    expect(byLabel(wrapper, 'Rotate left').exists()).toBe(false);
  });
});
```

  **(c) `tests/component/container-box.test.ts`.** This is not a new test. It adapts the M97 helper to the single observer, and it passes before and after this task. Today the helper mounts at the measured width, forces the Files drawer open, and fires the observers without changing the width. With one leaf observer, an unchanged leaf width produces no `layoutTick`, so nothing would re-measure. In a real host the opener is hidden at ≥ 820 px, so a drawer opened while the leaf is wide cannot happen. The helper now opens the drawer while the leaf is genuinely narrow, then resizes to the measured width. That is the drag the M97 defect needed, and it asserts the same two outcomes. Replace the body of `drawerSurvivesAt` with:

```ts
  async function drawerSurvivesAt(borderBoxWidth: number): Promise<boolean> {
    const leaf = document.body.createDiv({ cls: 'codebase-inspector-root' });
    leaf.setCssStyles({ paddingLeft: `${HOST_PADDING_PX}px`, paddingRight: `${HOST_PADDING_PX}px` });
    setRect(leaf, 600, 700);                       // genuinely narrow: the drawer IS a drawer
    const wrapper = mount(App, { attachTo: leaf });
    await nextTick();

    await wrapper.get('[aria-label="Files"]').trigger('click');
    expect(wrapper.find('.ci-app__list-wrapper--open').exists()).toBe(true);

    setRect(leaf, borderBoxWidth, 700);            // the drag to the width under test
    resizeObserver.trigger();
    await nextTick();
    return wrapper.find('.ci-app__list-wrapper--open').exists();
  }
```

  Update the helper's doc comment to "Mounts into a genuinely narrow leaf that carries the real host's 12 px of horizontal padding, opens the Files drawer, then drags the leaf to a BORDER box of `borderBoxWidth` and lets the responsive observer run. …" and keep the rest.

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/component/workspace-shell.test.ts tests/component/camera-controls.test.ts tests/component/container-box.test.ts`. Expected:
  - **workspace-shell, nav flip: FAIL** at the second `expect(…list-wrapper--open…).toBe(true)`. Today CityWorkspace observes the leaf itself, and its observer was constructed first (a child's `onMounted` runs before App's). So `ro.resize(leaf)` runs the city's measurement before App has measured the leaf, and before `ci-shell--nav-inline` is patched in. `cityInlineSize` therefore reads the whole 1000 px leaf with no nav column subtracted, calls it wide, and retires the drawer.
  - **workspace-shell, observer count: FAIL** with `expected 2 to be 1`. The leaf is observed by App's `useLeafWidth` AND by CityWorkspace's own observer, and `.ci-shell__content` is observed once.
  - **camera-controls: FAIL** for the whole file with `Failed to resolve import "../../src/ui/shell/leaf-layout"`, because the module does not exist yet. Step 4 re-runs it after the module exists, to show the assertion-level failure.
  - **container-box: PASS** (both cases), before any source change.

- [ ] **Step 3: Create `src/ui/shell/leaf-layout.ts`.**

```ts
// WP-02 Part 5 (V4, V5; Part 2 deferral): ONE leaf measurement per leaf. App's
// `useLeafWidth` ResizeObserver is the only observer on the leaf. Everything else that
// depends on the leaf's width reacts to `layoutTick` instead of observing the leaf again:
// the city's 320 px floor and 820 px drawer threshold (screens/city/use-city-floor.ts), and
// CameraControls' steps default.
//
// `layoutTick` advances in a `flush: 'post'` watcher, so a reader measures AFTER the nav
// column's inline/drawer switch has been patched into the DOM: `cityInlineSize` subtracts
// the inline column only once `.ci-shell--nav-inline` is on the shell.
import { inject, provide, readonly, ref, watch, type InjectionKey, type Ref } from 'vue';

export interface LeafLayout {
  /** The leaf's content-box inline size; 0 while hidden or before layout. */
  leafWidth: Readonly<Ref<number>>;
  /** True while the shell shows its navigation column inline. */
  navInline: Readonly<Ref<boolean>>;
  /** Advances after every leafWidth or navInline change, once the DOM is patched. */
  layoutTick: Readonly<Ref<number>>;
}

export const LEAF_LAYOUT_KEY: InjectionKey<LeafLayout> = Symbol('ci-leaf-layout');

/** Called once, by App.vue, right after `useLeafWidth` and `navInline`. */
export function provideLeafLayout(leafWidth: Readonly<Ref<number>>, navInline: Readonly<Ref<boolean>>): LeafLayout {
  const tick = ref(0);
  watch([leafWidth, navInline], () => { tick.value += 1; }, { flush: 'post' });
  const layout: LeafLayout = { leafWidth, navInline, layoutTick: readonly(tick) };
  provide(LEAF_LAYOUT_KEY, layout);
  return layout;
}

/** The shell's leaf layout, or null outside the shell (a screen or component mounted
 *  alone, as component tests do). */
export function injectLeafLayout(): LeafLayout | null {
  return inject(LEAF_LAYOUT_KEY, null);
}
```

- [ ] **Step 4: Re-run the CameraControls tests and confirm the assertion-level failure.** `npx vitest run tests/component/camera-controls.test.ts`. Expected: the existing tests pass. Both new V5 tests FAIL at their first post-tick assertion, `expect(byLabel(wrapper, 'Rotate left').exists()).toBe(false)`, with `expected true to be false`. CameraControls computes its steps default once, at setup and when the stage element arrives, and never looks at `layoutTick`, so the steps stay open after the leaf narrows to 600 px.

- [ ] **Step 5: App provides the leaf layout.** In `src/ui/App.vue`:
  - Add `import { provideLeafLayout } from './shell/leaf-layout';` after `import { useLeafWidth } from './shell/use-leaf-width';`.
  - After:

```ts
const navInline = computed(() => leafWidth.value >= DRAWER_MAX_INLINE_SIZE);
```

  add:

```ts
/** Part 5 V4/V5: this leaf's ONE measurement, shared with the city floor and the camera controls. */
provideLeafLayout(leafWidth, navInline);
```

- [ ] **Step 6: The city floor reacts to `layoutTick`.** In `src/ui/screens/city/use-city-floor.ts` (from Task 1):
  - Change the vue import to `import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';`.
  - Add `import { injectLeafLayout } from '../../../shell/leaf-layout';` after the `container-box` import. (The path is `src/ui/shell/leaf-layout.ts` from `src/ui/screens/city/`.)
  - Append to the file header comment:

```ts
//
// Part 5 V4 (Part 2 deferral): inside the shell, App's leaf observer is the leaf's ONLY
// observer (shell/leaf-layout.ts). This re-measures on its post-patch `layoutTick`, so the
// nav column's inline/drawer switch is already in the DOM when `cityInlineSize` subtracts
// it, and it observes neither the leaf nor `.ci-shell__content`. Mounted without the shell
// (a component test), it falls back to one observer of its own on the leaf.
```

  - Replace:

```ts
  /** Task 11 fix round 1, item 3: rebuilt off `el`'s CURRENT `.win`, never left pointing
   *  at the pre-migration window's `ResizeObserver` constructor (which has no defined
   *  behaviour once `el` has moved). */
  function attachResizeObserver(el: HTMLElement): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
    const win = (el as unknown as WinBearing).win;
    if (!win) return;
    resizeObserver = new (win as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver(() => {
      updateResponsiveLayout();
    });
    resizeObserver.observe(narrowContainer(el));
    // WP-02: the shell's nav column flipping inline resizes the city's content box but not the leaf.
    const content = el.closest<HTMLElement>('.ci-shell__content');
    if (content) resizeObserver.observe(content);
  }
```

  with:

```ts
  const leafLayout = injectLeafLayout();
  if (leafLayout) watch(() => leafLayout.layoutTick.value, () => { updateResponsiveLayout(); });

  /** The fallback observer, used only without the shell. Task 11 fix round 1, item 3:
   *  rebuilt off `el`'s CURRENT `.win`, never left pointing at the pre-migration window's
   *  `ResizeObserver` constructor (which has no defined behaviour once `el` has moved). */
  function attachResizeObserver(el: HTMLElement): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (leafLayout) return;
    const win = (el as unknown as WinBearing).win;
    if (!win) return;
    resizeObserver = new (win as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver(() => {
      updateResponsiveLayout();
    });
    resizeObserver.observe(narrowContainer(el));
  }
```

  `onMounted`, the migration handler and `onBeforeUnmount` stay as they are. On migration the city still re-measures directly, and App's `useLeafWidth` re-attaches its own observer in the new window, which is what `window-migration`'s M3 test drives.

- [ ] **Step 7: CameraControls re-measures until the user toggles.** In `src/ui/components/CameraControls.vue`:
  - Add `import { injectLeafLayout } from '../shell/leaf-layout';` after `import { DRAWER_MAX_INLINE_SIZE } from '../responsive';`.
  - Replace:

```ts
function toggleSteps(): void { stepsOpen.value = !stepsOpen.value; }
```

  with:

```ts
/** Part 5 V5: set once the user has opened or closed the steps themselves. From then on a
 *  leaf resize never overrides their choice. */
let userToggled = false;
function toggleSteps(): void {
  userToggled = true;
  stepsOpen.value = !stepsOpen.value;
}

// Part 5 V5 (Part 2 deferral): the shell's ONE leaf measurement (shell/leaf-layout.ts)
// ticks after every leaf-width or nav-inline change, once the DOM is patched. The steps
// default is re-applied on each tick until the user has toggled. `props.stepsCollapsed`
// still wins inside computeStepsOpen. A standalone mount (no shell) keeps the setup-time
// and stage-arrival default only, as before.
const leafLayout = injectLeafLayout();
if (leafLayout) {
  watch(() => leafLayout.layoutTick.value, () => {
    if (!userToggled) applyStepsDefault(stage.value);
  });
}
```

  `watch` is already imported. The stage watch in `onMounted` is unchanged.

- [ ] **Step 8: Run and confirm they pass.**
  - `npx vitest run tests/component/workspace-shell.test.ts tests/component/camera-controls.test.ts tests/component/container-box.test.ts tests/unit/city-budget.test.ts`
  - Regression, none of these edited: `npx vitest run tests/component/responsive-floor.test.ts tests/component/city-screen.test.ts tests/component/welcome-state.test.ts tests/component/status-surfaces.test.ts tests/component/toolbar-scan.test.ts tests/component/camera-round-trip.test.ts tests/component/camera-restore.test.ts tests/component/canvas-camera.test.ts tests/component/city-viewport.test.ts tests/component/stage-height.test.ts tests/component/view-surface-memo.test.ts tests/component/command-palette.test.ts tests/component/shell-provenance.test.ts tests/host/window-migration.test.ts tests/host/lifecycle-leaks.test.ts tests/host/city-view.test.ts tests/host/city-view-store-wiring.test.ts tests/host/multi-leaf.test.ts tests/acceptance`
    - `window-migration` M3: after the move, `popout.triggerResize()` fires App's re-attached leaf observer. The width changes 1000 → 200, `layoutTick` advances in the post flush, and the city switches to list mode within the same `await nextTick()` (Vue flushes jobs queued during the post flush in the same tick).
    - `lifecycle-leaks` "leaves no observer": App's and CityViewport's observers are the only ones constructed, and each disconnects exactly once.
  - Confirm with grep that `ResizeObserver(` appears under `src/ui` only in `shell/use-leaf-width.ts`, `components/CityViewport.vue` (the stage observer, V4) and `screens/city/use-city-floor.ts` (the fallback).
  - Then the gate, with `npx eslint src/ui/shell/leaf-layout.ts src/ui/App.vue src/ui/screens/city/use-city-floor.ts src/ui/components/CameraControls.vue tests/component/workspace-shell.test.ts tests/component/camera-controls.test.ts tests/component/container-box.test.ts --max-warnings 0`.
- [ ] **Step 9: Commit.** `feat(ui): one ResizeObserver per leaf via a shared leaf layout; camera steps re-measure until the user toggles (V4, V5)`

---

### Task 3: Cancel a running scan from the leaf (V6)

**Files:**
- Modify: `src/host/city-scan-controller.ts` (from Task 1, ~148 → ~151): `provideScanCallbacks` also provides `'onCancelScan'`. `src/host/city-view.ts` is **not** touched.
- Modify: `src/ui/components/AppToolbar.vue` (86 → ~115): a Cancel scan button after Scan.
- Modify: `src/ui/screens/sources/ScanStatusPanel.vue` (51 → ~60): the button replaces the hint, and the run line gets `role="status"`.
- Modify: `src/ui/screens/SourcesScreen.vue` (92 → ~104): inject `onCancelScan`, with the guarded handler.
- Modify: `src/ui/audit-copy/sources.ts` (48 → 47): remove `SOURCES_CANCEL_HINT`.
- Modify: `src/ui/styles/shell.css` (100 → ~117): the toolbar Cancel skin; the toolbar may wrap.
- Test: `tests/host/city-view-cancel.test.ts` (new, ~122 lines; runs under jsdom through the `tests/host/city-view*.test.ts` pattern in `vitest.config.ts`)
- Test: `tests/component/toolbar-scan.test.ts` (79 → ~125), `tests/component/sources-screen.test.ts` (88 → ~125)

**Interfaces:**
- Consumes: `COPY_09` = `'Cancel scan'` (`src/ui/copy.ts`, imported, never edited); `CityScanController.cancelScan()` (Task 1); `useRunStore().run.status`.
- Produces:
  - The injection `'onCancelScan': () => void`, provided by `provideScanCallbacks` and calling `controller.cancelScan()`;
  - `AppToolbar`: `<button class="ci-toolbar__cancel">`, always rendered, directly after `.ci-toolbar__scan`, with `aria-disabled="true"` unless `runStore.run.status === 'running'`;
  - `ScanStatusPanel` emits `cancel` (no payload). It renders `<button class="ci-sources__cancel">`, always, with `aria-disabled="true"` unless `run.kind === 'running'`. `.ci-sources__run` has `role="status"`;
  - `SourcesScreen` handles `@cancel` with a guard on `runStore.run.status === 'running'`;
  - No new copy constant. `SOURCES_CANCEL_HINT` is deleted.

- [ ] **Step 1: Write the failing tests.**

  **(a) Create `tests/host/city-view-cancel.test.ts`:**

```ts
// WP-02 Part 5 (V6): Cancel scan from the leaf reaches the SAME CityView.cancelScan the
// 'cancel-scan' command calls, through provideScanCallbacks' 'onCancelScan'. A real
// CityView, a real coordinator and a refresh that is genuinely running (the pattern in
// city-view.test.ts), so the button is proven end to end rather than against a double.
// Routed to the jsdom project by vitest.config.ts's `tests/host/city-view*.test.ts`.
import { describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { CityView } from '../../src/host/city-view';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { defaultCityViewState } from '../../src/host/view-state';
import type { CameraBookmark, CodebaseProfile, CodebaseSnapshot } from '../../src/domain/model';
import type { CityRendererPort } from '../../src/visualization/renderer-port';
import type { CityViewDeps } from '../../src/host/city-view';
import type { ProfileStore } from '../../src/application/ports/profile-store';

const DUMMY_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};
const inertPort: CityRendererPort = {
  setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(),
  setLabels: vi.fn(), setCameraMode: vi.fn(), setMotion: vi.fn(),
  getCamera: vi.fn((): CameraBookmark => DUMMY_CAMERA), setCamera: vi.fn(), nudgeCamera: vi.fn(),
  focus: vi.fn(), fit: vi.fn(), resize: vi.fn(), pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
  getDiagnostics: vi.fn(() => ({
    geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
  })),
  debugLoseContext: vi.fn(),
};
vi.mock('../../src/visualization/city-renderer', () => ({ createCityRenderer: vi.fn(() => inertPort) }));

/** A snapshot whose scope's rootPath is createFakeSourceFileSystem's fixed '/fake-root',
 *  so a refresh against it genuinely reaches 'running'. */
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
        revealLeaf: vi.fn(async () => {}), on: vi.fn(() => ({})), offref: vi.fn(),
      },
      vault: { adapter: { read: vi.fn(), list: vi.fn() }, configDir: '.obsidian' },
    },
  };
}

function makeProfileStoreDouble(initial: CodebaseProfile[]): ProfileStore {
  const profiles = [...initial];
  return {
    list: vi.fn(async () => [...profiles]),
    get: vi.fn(async (id: string) => profiles.find((p) => p.profileId === id) ?? null),
    save: vi.fn(async (p: CodebaseProfile) => { profiles.push(p); }),
    remove: vi.fn(async () => {}),
    update: vi.fn(async () => {}),
  };
}

/** Microtask ticks only (no timer) until the coordinator is really running. */
async function waitUntilRunning(view: CityView): Promise<void> {
  for (let i = 0; i < 50 && !view.isScanRunning(); i += 1) await Promise.resolve();
}

/** A view restored onto `route` with snapshot 's1', so startScan() takes the silent
 *  refresh path (no modal) and reaches 'running'. */
async function openRefreshableView(route: 'city' | 'sources') {
  const snapshotStore = new InMemorySnapshotStore(createFixedClock());
  snapshotStore.put(publishedSnapshot());
  const { port } = createFakeSourceFileSystem({ 'a.ts': 'x', 'b.ts': 'y', 'c.ts': 'z' });
  const profileStore = makeProfileStoreDouble([
    { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 5_000_000 },
  ]);
  const deps: CityViewDeps = { profileStore, getFilesystem: () => port, snapshotStore, clock: createFixedClock() };
  const view = new CityView({ width: 1000 } as never, makePluginDouble() as never, deps);
  await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1', route }, {} as never);
  await view.onOpen();
  await nextTick();
  return { view, snapshotStore };
}

describe('Cancel scan from the leaf (Part 5 V6)', () => {
  it('the city toolbar\'s Cancel scan stops a running scan through onCancelScan', async () => {
    const { view, snapshotStore } = await openRefreshableView('city');
    const cancel = view.contentEl.querySelector<HTMLButtonElement>('.ci-toolbar__cancel');
    expect(cancel).not.toBeNull();
    expect(cancel!.getAttribute('aria-disabled')).toBe('true');

    const runPromise = view.startScan();
    await waitUntilRunning(view);
    expect(view.isScanRunning()).toBe(true);
    cancel!.click();
    expect(view.isScanRunning()).toBe(false);   // 'cancelling', synchronously
    await runPromise;
    // A genuinely stopped refresh publishes nothing: the retained snapshot is still 's1'.
    expect(snapshotStore.latestFor('p1')?.snapshotId).toBe('s1');
    await view.onClose();
  });

  it('Data & scans\' Cancel scan stops it the same way, without leaving the screen', async () => {
    const { view, snapshotStore } = await openRefreshableView('sources');
    const cancel = view.contentEl.querySelector<HTMLButtonElement>('.ci-sources__cancel');
    expect(cancel).not.toBeNull();

    const runPromise = view.startScan();
    await waitUntilRunning(view);
    expect(view.isScanRunning()).toBe(true);
    cancel!.click();
    expect(view.isScanRunning()).toBe(false);
    await runPromise;
    expect(snapshotStore.latestFor('p1')?.snapshotId).toBe('s1');
    expect(view.getState().route).toBe('sources');
    await view.onClose();
  });
});
```

  **(b) `tests/component/toolbar-scan.test.ts`.**
  - Change `import { COPY_07 } from '../../src/ui/copy';` to `import { COPY_07, COPY_09 } from '../../src/ui/copy';`.
  - Add `import { initialScanLifecycleState } from '../../src/application/run-state';`.
  - Append after the existing `describe`:

```ts
const APPROVAL = {
  profileId: 'p1', sourceFingerprint: 'f1', scopeFingerprint: 's1',
  approvedAt: '2026-01-01T00:00:00.000Z', operation: 'read-only-inventory' as const,
};

// Part 5 V6: Cancel scan beside Scan. Always rendered (the toolbar never unmounts, so a
// focused Cancel never loses focus when the run ends); aria-disabled plus a guarded handler
// unless a run is running (E40/E44/E50).
describe('toolbar Cancel scan (Part 5 V6)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useCityStore().navigate('city');
  });
  afterEach(() => { document.body.innerHTML = ''; });

  it('sits right after Scan, carries the command\'s own name, and is inert while no run is running', async () => {
    const onCancelScan = vi.fn();
    const wrapper = mount(App, { global: { provide: { onCancelScan } } });
    const cancel = wrapper.get('.ci-toolbar__cancel');
    expect(cancel.text()).toBe(COPY_09);
    expect(wrapper.get('.ci-toolbar__scan').element.nextElementSibling).toBe(cancel.element);
    expect(cancel.attributes('aria-disabled')).toBe('true');
    expect(cancel.attributes('disabled')).toBeUndefined();
    await cancel.trigger('click');
    expect(onCancelScan).not.toHaveBeenCalled();
  });

  it('while a run is running, calls the host once and stays on the city', async () => {
    const onCancelScan = vi.fn();
    const wrapper = mount(App, { global: { provide: { onCancelScan } } });
    useRunStore().setLifecycle({
      ...initialScanLifecycleState(),
      run: { status: 'running', runId: 'r1', generation: 1, approval: APPROVAL, processedFiles: 3 },
    });
    await nextTick();
    const cancel = wrapper.get('.ci-toolbar__cancel');
    expect(cancel.attributes('aria-disabled')).toBeUndefined();
    await cancel.trigger('click');
    expect(onCancelScan).toHaveBeenCalledTimes(1);
    expect(useCityStore().route).toBe('city');
  });

  it('is inert again while the run is only cancelling', async () => {
    const onCancelScan = vi.fn();
    const wrapper = mount(App, { global: { provide: { onCancelScan } } });
    useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'cancelling', runId: 'r1', generation: 1 } });
    await nextTick();
    const cancel = wrapper.get('.ci-toolbar__cancel');
    expect(cancel.attributes('aria-disabled')).toBe('true');
    await cancel.trigger('click');
    expect(onCancelScan).not.toHaveBeenCalled();
  });
});
```

  **(c) `tests/component/sources-screen.test.ts`.**
  - Add `import { COPY_09 } from '../../src/ui/copy';`.
  - Replace `mountS` with a version that also provides `onCancelScan`:

```ts
function mountS(onSelectCodebase = vi.fn(), onScanRequested = vi.fn(), onCancelScan = vi.fn()) {
  return mount(SourcesScreen, { attachTo: document.body, global: { provide: { onSelectCodebase, onScanRequested, onCancelScan } } });
}
const APPROVAL = { profileId: 'p', sourceFingerprint: 's', scopeFingerprint: 'c', approvedAt: 'a', operation: 'read-only-inventory' as const };
function setRunning(processedFiles: number): void {
  useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'running', runId: 'r', generation: 1, approval: APPROVAL, processedFiles } });
}
```

  - Replace the test `it('Rescan is aria-disabled while a run is in flight, and the status explains how to cancel', …)` with:

```ts
  it('Rescan is aria-disabled while a run is in flight', async () => {
    const scan = vi.fn();
    const w = mountS(vi.fn(), scan);
    setRunning(12);
    await nextTick();
    const rescan = w.find('.ci-sources__rescan');
    expect(rescan.attributes('aria-disabled')).toBe('true');
    await rescan.trigger('click');
    expect(scan).not.toHaveBeenCalled();
    expect(w.find('.ci-sources__status').text()).toContain('12 files read so far');
    w.unmount();
  });

  it('Cancel scan replaces the command-palette hint: always rendered, inert while idle (Part 5 V6)', async () => {
    const onCancelScan = vi.fn();
    const w = mountS(vi.fn(), vi.fn(), onCancelScan);
    const cancel = w.get('.ci-sources__cancel');
    expect(cancel.text()).toBe(COPY_09);
    expect(cancel.attributes('aria-disabled')).toBe('true');
    await cancel.trigger('click');
    expect(onCancelScan).not.toHaveBeenCalled();
    expect(w.find('.ci-sources__status').text()).not.toContain('command palette');
    w.unmount();
  });

  it('while running, Cancel scan calls the host once and stays here; the run line announces the outcome', async () => {
    const onCancelScan = vi.fn();
    const w = mountS(vi.fn(), vi.fn(), onCancelScan);
    setRunning(4);
    await nextTick();
    expect(w.get('.ci-sources__run').attributes('role')).toBe('status');
    const cancel = w.get('.ci-sources__cancel');
    expect(cancel.attributes('aria-disabled')).toBeUndefined();
    await cancel.trigger('click');
    expect(onCancelScan).toHaveBeenCalledOnce();
    expect(useCityStore().route).toBe('sources');

    useRunStore().setLifecycle({ ...initialScanLifecycleState(), run: { status: 'cancelling', runId: 'r', generation: 1 } });
    await nextTick();
    expect(w.get('.ci-sources__run').text()).toContain('Cancelling the scan');
    expect(w.get('.ci-sources__cancel').attributes('aria-disabled')).toBe('true');
    await w.get('.ci-sources__cancel').trigger('click');
    expect(onCancelScan).toHaveBeenCalledOnce();
    w.unmount();
  });
```

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/host/city-view-cancel.test.ts tests/component/toolbar-scan.test.ts tests/component/sources-screen.test.ts`. Expected:
  - **city-view-cancel: FAIL, both tests,** at `expect(cancel).not.toBeNull()`. Neither `.ci-toolbar__cancel` nor `.ci-sources__cancel` exists. If only the buttons existed, without the `onCancelScan` provide, the tests would still fail at `expect(view.isScanRunning()).toBe(false)`, because the injected default is a no-op.
  - **toolbar-scan: the three new tests FAIL** with `Unable to get DOM element matching selector .ci-toolbar__cancel`. The four existing tests pass.
  - **sources-screen: the two new tests FAIL** with `Unable to get DOM element matching selector .ci-sources__cancel`. The rewritten Rescan test passes, because it asserts only what exists today.

- [ ] **Step 3: Provide `onCancelScan`.** In `src/host/city-scan-controller.ts`, replace:

```ts
  // Task 5 (F7): the toolbar's Scan control, calling the SAME method the
  // 'scan-codebase' palette command calls.
  app.provide('onScanRequested', () => { void controller.startScan(); });
}
```

  with:

```ts
  // Task 5 (F7): the toolbar's Scan control, calling the SAME method the
  // 'scan-codebase' palette command calls.
  app.provide('onScanRequested', () => { void controller.startScan(); });
  // Part 5 V6: Cancel scan in the city toolbar and on Data & scans, calling the SAME method
  // the 'cancel-scan' command calls. cancelScan() is itself a no-op unless a run is running.
  app.provide('onCancelScan', () => { controller.cancelScan(); });
}
```

  Also extend the `provideScanCallbacks` doc comment's list: "…AppToolbar (Scan, Cancel scan), Data & scans…". `city-view.ts` is not touched.

- [ ] **Step 4: The toolbar button.** In `src/ui/components/AppToolbar.vue`:
  - Add to the header comment, after "…the narrow-layout Files drawer opener.": `Part 5 V6: and Cancel scan (COPY_09, the command's own name), right after Scan.`
  - Replace:

```ts
import { inject } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useRunStore } from '../stores/run-store';
import { COPY_07 } from '../copy';
```

  with:

```ts
import { computed, inject } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useRunStore } from '../stores/run-store';
import { COPY_07, COPY_09 } from '../copy';
```

  - After `const onScanRequested = inject<() => void>('onScanRequested', () => {});`, add:

```ts
/** consistent-function-scoping: a no-op default that captures nothing, hoisted once. */
const noop = (): void => {};
// Part 5 V6: provided by city-scan-controller.ts's provideScanCallbacks, calling the SAME
// CityView.cancelScan the 'cancel-scan' command calls. Never a direct coordinator call.
const onCancelScan = inject<() => void>('onCancelScan', noop);
/** Only a RUNNING scan can be cancelled (a cancelling one already is). Read from runStore
 *  at press time, so the guard never lags a render. */
const cancellable = computed(() => runStore.run.status === 'running');
/** E40/E44/E50: the button stays focusable while blocked, so the handler refuses the press.
 *  Announces nothing itself (E17): AnnouncementRegion announces the run's real outcome. */
function cancelScan(): void {
  if (!cancellable.value) return;
  onCancelScan();
}
```

  - In the template, directly after the Scan `<button … class="ci-toolbar__scan" …>…</button>`, add:

```vue
    <!-- Part 5 V6: always rendered, so a focused Cancel keeps focus when the run ends (the
         toolbar never unmounts); aria-disabled unless a run is running, with the guarded
         handler above. Pressing it does not navigate. -->
    <button
      type="button"
      class="ci-toolbar__cancel"
      :aria-disabled="cancellable ? undefined : 'true'"
      @click="cancelScan"
    >
      {{ COPY_09 }}
    </button>
```

- [ ] **Step 5: The Data & scans button.** Replace `src/ui/screens/sources/ScanStatusPanel.vue` with:

```vue
<script setup lang="ts">
import { computed } from 'vue';
import type { RunView } from '../../read-models/sources';
import {
  SOURCES_RUN_CANCELLED, SOURCES_RUN_CANCELLING, SOURCES_RUN_COMPLETE, SOURCES_RUN_FAILED, SOURCES_RUN_IDLE,
  SOURCES_RUN_RUNNING, SOURCES_STATUS_SUBTITLE, SOURCES_STATUS_TITLE,
} from '../../inspector-copy';
import { COPY_09 } from '../../copy';
import Panel from '../../kit/Panel.vue';
import Icon from '../../kit/Icon.vue';

const props = defineProps<{ run: RunView }>();
/** Part 5 V6: the screen owns the host callback and the guard; this only reports the press. */
defineEmits<{ cancel: [] }>();

/** W3: the real run state, mirrored from the host; nothing here is simulated. */
const view = computed<{ icon: string; text: string; tone: 'muted' | 'warning' | 'success' }>(() => {
  const r = props.run;
  switch (r.kind) {
    case 'running': return { icon: 'loader', text: SOURCES_RUN_RUNNING(r.processed), tone: 'muted' };
    case 'cancelling': return { icon: 'loader', text: SOURCES_RUN_CANCELLING, tone: 'muted' };
    case 'cancelled': return { icon: 'circle-slash', text: SOURCES_RUN_CANCELLED, tone: 'warning' };
    case 'failed': return { icon: 'alert-triangle', text: SOURCES_RUN_FAILED(r.message), tone: 'warning' };
    case 'complete': return { icon: 'check', text: SOURCES_RUN_COMPLETE, tone: 'success' };
    default: return { icon: 'clock', text: SOURCES_RUN_IDLE, tone: 'muted' };
  }
});
/** V6: only a RUNNING scan can be cancelled (a cancelling one already is). */
const cancellable = computed(() => props.run.kind === 'running');
</script>

<template>
  <div class="ci-sources__status">
    <Panel
      :title="SOURCES_STATUS_TITLE"
      :subtitle="SOURCES_STATUS_SUBTITLE"
    >
      <!-- Part 5 V6: a status region, so "cancelling" and "cancelled" are announced here. -->
      <p
        class="ci-sources__run"
        :class="`ci-sources__run--${view.tone}`"
        role="status"
      >
        <Icon :name="view.icon" />
        <span>
          {{ view.text }}
        </span>
      </p>
      <!-- Part 5 V6: replaces the command-palette hint. Always rendered; aria-disabled unless
           a run is running (E40/E44/E50), and SourcesScreen's handler refuses the press then
           too. It announces nothing itself (E17) and does not navigate. -->
      <button
        type="button"
        class="ci-sources__cancel"
        :aria-disabled="cancellable ? undefined : 'true'"
        @click="$emit('cancel')"
      >
        {{ COPY_09 }}
      </button>
    </Panel>
  </div>
</template>
```

- [ ] **Step 6: SourcesScreen handles the press.** In `src/ui/screens/SourcesScreen.vue`:
  - Replace:

```ts
// W2: the two host callbacks the UI already injects (NoSnapshot, NavColumn, AppToolbar);
// the host's own modals and consent chain do the work.
const onSelectCodebase = inject<() => void>('onSelectCodebase', noop);
const onScanRequested = inject<() => void>('onScanRequested', noop);
```

  with:

```ts
// W2: the host callbacks the UI already injects (NoSnapshot, NavColumn, AppToolbar); the
// host's own modals and consent chain do the work. Part 5 V6: onCancelScan calls the SAME
// CityView.cancelScan the 'cancel-scan' command calls.
const onSelectCodebase = inject<() => void>('onSelectCodebase', noop);
const onScanRequested = inject<() => void>('onScanRequested', noop);
const onCancelScan = inject<() => void>('onCancelScan', noop);
```

  - After `function rescan(): void { … }`, add:

```ts
/** Part 5 V6: guarded on the store itself (not the panel's props, which lag one render), so
 *  an aria-disabled press does nothing. Stays on this screen: the run line announces the
 *  outcome (role="status"). */
function cancelScan(): void {
  if (runStore.run.status !== 'running') return;
  onCancelScan();
}
```

  - Replace `<ScanStatusPanel :run="model.run" />` with:

```vue
      <ScanStatusPanel
        :run="model.run"
        @cancel="cancelScan"
      />
```

- [ ] **Step 7: Retire the hint.** In `src/ui/audit-copy/sources.ts`, delete the line:

```ts
export const SOURCES_CANCEL_HINT = 'To cancel a running scan, use the “Cancel scan” command in Obsidian’s command palette.';
```

  Confirm with grep that `SOURCES_CANCEL_HINT` no longer appears anywhere under `src/` or `tests/`.

- [ ] **Step 8: The toolbar skin.** The toolbar's Scan skin is WP-01's `button.ci-toolbar__scan` in `styles.css`, which is never edited. Append to `src/ui/styles/shell.css`:

```css
/* Part 5 V6: Cancel scan sits beside Scan in the city toolbar and takes the same skin
   (styles.css `button.ci-toolbar__scan`, M113): `button` raises the rule to (0,1,1) so it
   ties Obsidian's `button:not(.clickable-icon)` and wins on order, and box-shadow is
   cleared so the host's input shadow does not paint under the border. No `cursor` here:
   kit.css's shared `button[aria-disabled="true"]` rule (E54) owns the blocked look. */
:where(.codebase-inspector-root) button.ci-toolbar__cancel {
  min-height: var(--ci-control-min);
  padding-inline: var(--ci-space-3);
  border-radius: var(--ci-radius-control);
  border: 1px solid var(--ci-border);
  background: var(--ci-panel);
  box-shadow: none;
  color: var(--ci-text);
  white-space: nowrap;
}
:where(.codebase-inspector-root) button.ci-toolbar__cancel:hover { background: var(--ci-raised); }
/* One more always-present control: let the toolbar wrap in a narrow leaf instead of
   overflowing it (the WP-01 rule in styles.css sets only display, alignment and gap). */
:where(.codebase-inspector-root) .ci-app__toolbar { flex-wrap: wrap; }
```

  The Data & scans button keeps Obsidian's own button skin, like every other button on that screen, so `screens-configure.css` gets nothing.

- [ ] **Step 9: Run and confirm they pass.**
  - `npx vitest run tests/host/city-view-cancel.test.ts tests/component/toolbar-scan.test.ts tests/component/sources-screen.test.ts`
  - Regression: `npx vitest run tests/host/city-view.test.ts tests/host/city-view-scan-modes.test.ts tests/host/city-view-store-wiring.test.ts tests/host/commands.test.ts tests/host/lifecycle-leaks.test.ts tests/host/window-migration.test.ts tests/component/workspace-shell.test.ts tests/component/welcome-state.test.ts tests/component/status-surfaces.test.ts tests/component/stage-height.test.ts tests/component/responsive-floor.test.ts tests/contracts/microcopy.test.ts tests/unit/city-budget.test.ts tests/unit/host-cascade.test.ts tests/unit/kit-css-fallbacks.test.ts tests/unit/css-class-scope.test.ts tests/unit/sources-model.test.ts tests/acceptance`
  - No test counts the toolbar's buttons: `grep -rn "ci-app__toolbar\|findAll('button')" tests/component` hits only `camera-controls`, `canvas-camera`, `city-viewport`, `kit-interactive` and `quality-screen`, none of which mounts the toolbar. If a hit appears that does count toolbar buttons, update it and report it.
  - `wc -l src/host/city-view.ts` is unchanged from Task 1.
  - Then the gate, with `npx eslint src/host/city-scan-controller.ts src/ui/components/AppToolbar.vue src/ui/screens/sources/ScanStatusPanel.vue src/ui/screens/SourcesScreen.vue src/ui/audit-copy/sources.ts tests/host/city-view-cancel.test.ts tests/component/toolbar-scan.test.ts tests/component/sources-screen.test.ts --max-warnings 0`.
- [ ] **Step 10: Commit.** `feat(ui): Cancel scan in the city toolbar and on Data & scans, through onCancelScan (V6)`

---

### Task 4: `reannounce`, `useCsvExport` builds outside the try, Tests export with no model (V22, V23)

**Files:**
- Create: `src/ui/kit/reannounce.ts` (~20 lines)
- Modify: `src/ui/export/use-csv-export.ts` (27 → ~28), `src/ui/screens/TestsScreen.vue` (285 → ~292)
- Test: `tests/unit/reannounce.test.ts` (new, ~50), `tests/unit/use-csv-export.test.ts` (48 → ~80), `tests/component/tests-screen.test.ts` (152 → ~168)

**Interfaces:**
- Consumes: `EXPORT_FAILED` (`src/ui/audit-copy/shared.ts`, via `../inspector-copy`), `downloadText` (`src/ui/export/download.ts`), `gapsCsv`, `useReadModels().testConfidence`.
- Produces: `reannounce(live: Ref<string>, message: string): Promise<void>` in `src/ui/kit/reannounce.ts`. Tasks 5 and 9 use it. `useCsvExport` keeps its signature `(root: Ref<HTMLElement | null>, liveMessage: Ref<string>) => (filename: string, build: () => string, mime?: string) => void`; only its failure behaviour changes (a throwing `build` now propagates).

Design notes for the implementer:
- `reannounce` sets the message only if (a) no later `reannounce` on the same ref happened in between (a per-ref token in a module `WeakMap<Ref<string>, number>`, from a module counter) **and** (b) the region still holds the `''` this call left. (b) also protects a screen's direct write (`liveMessage.value = TESTS_PLAN_ADDED(...)`) that lands between the clear and the tick.
- Tests export: the button can become blocked while focused (a rescan with no gaps, a snapshot switch), so it follows E40: `aria-disabled="true"` plus a guarded handler, never `disabled`. This also makes V23's guard testable: a press on the aria-disabled button reaches the handler, and the handler must refuse.

- [ ] **Step 1: Write the failing `reannounce` test.** Create `tests/unit/reannounce.test.ts`:

```ts
// Part 5 V22 (Part 4 E18): re-announce a repeated outcome without an overwrite risk.
import { describe, expect, it } from 'vitest';
import { nextTick, ref, watch } from 'vue';
import { reannounce } from '../../src/ui/kit/reannounce';

/** A live region's value plus every value it took, in order (sync watcher). */
function region(initial: string) {
  const live = ref(initial);
  const seen: string[] = [];
  watch(live, (v) => { seen.push(v); }, { flush: 'sync' });
  return { live, seen };
}

describe('reannounce (V22)', () => {
  it('clears the region at once, then sets the message on the next tick', async () => {
    const { live, seen } = region('Saved.');
    const done = reannounce(live, 'Saved.');
    expect(live.value).toBe('');
    await done;
    expect(live.value).toBe('Saved.');
    expect(seen).toEqual(['', 'Saved.']);
  });

  it('two rapid calls on one region: only the later message lands, after the intermediate empty string', async () => {
    const { live, seen } = region('Old.');
    const first = reannounce(live, 'First.');
    const second = reannounce(live, 'Second.');
    await Promise.all([first, second]);
    await nextTick();
    expect(live.value).toBe('Second.');
    expect(seen).toEqual(['', 'Second.']);
  });

  it('a direct write between the clear and the tick is not overwritten', async () => {
    const { live } = region('');
    const pending = reannounce(live, 'Could not start the download.');
    live.value = 'Tests planned for a.ts.';
    await pending;
    expect(live.value).toBe('Tests planned for a.ts.');
  });

  it('regions are independent: a call on one never cancels a call on another', async () => {
    const a = ref('');
    const b = ref('');
    await Promise.all([reannounce(a, 'A.'), reannounce(b, 'B.')]);
    expect([a.value, b.value]).toEqual(['A.', 'B.']);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/unit/reannounce.test.ts`. Expected: FAIL, the import of `../../src/ui/kit/reannounce` cannot be resolved (the module does not exist yet).
- [ ] **Step 3: Implement `reannounce`.** Create `src/ui/kit/reannounce.ts`:

```ts
// Part 5 V22 (Part 4 E18): re-announce a repeated outcome without an overwrite risk.
// A screen reader only announces a text CHANGE, so the region is cleared first and the
// message is set on the next tick. The message is set only if no later call on the same
// region happened in between (per-region token) and nothing else wrote to the region
// meanwhile (it still holds the '' this call left). A later outcome always wins.
import { nextTick, type Ref } from 'vue';

const latest = new WeakMap<Ref<string>, number>();
let issued = 0;

export async function reannounce(live: Ref<string>, message: string): Promise<void> {
  issued += 1;
  const token = issued;
  latest.set(live, token);
  live.value = '';
  await nextTick();
  if (latest.get(live) === token && live.value === '') live.value = message;
}
```

  Run `npx vitest run tests/unit/reannounce.test.ts`: PASS.
- [ ] **Step 4: Write the failing export tests.**
  - Replace `tests/unit/use-csv-export.test.ts` with:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick, ref } from 'vue';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import { CSV_MIME, MARKDOWN_MIME, useCsvExport } from '../../src/ui/export/use-csv-export';
import { reannounce } from '../../src/ui/kit/reannounce';
import { EXPORT_FAILED } from '../../src/ui/inspector-copy';

const host = {} as HTMLElement;
const failDownloads = () => { vi.mocked(downloadText).mockImplementation(() => { throw new Error('no window'); }); };

describe('useCsvExport (E55, Part 5 V22)', () => {
  beforeEach(() => { vi.mocked(downloadText).mockReset(); });

  it('hands the built text to downloadText through the root, CSV by default', () => {
    const live = ref('');
    useCsvExport(ref(host), live)('a.csv', () => 'x');
    expect(downloadText).toHaveBeenCalledWith(host, 'a.csv', 'x', CSV_MIME);
    expect(live.value).toBe('');
  });
  it('passes another MIME type through', () => {
    useCsvExport(ref(host), ref(''))('r.md', () => '# r', MARKDOWN_MIME);
    expect(downloadText).toHaveBeenCalledWith(host, 'r.md', '# r', MARKDOWN_MIME);
  });
  it('announces EXPORT_FAILED when the download throws, and nothing is thrown', async () => {
    failDownloads();
    const live = ref('');
    expect(() => useCsvExport(ref(host), live)('a.csv', () => 'x')).not.toThrow();
    await nextTick();
    expect(live.value).toBe(EXPORT_FAILED);
  });
  it('E17-style repeat: two consecutive failures both end with EXPORT_FAILED, clearing the message in between', async () => {
    failDownloads();
    const live = ref('');
    const run = useCsvExport(ref(host), live);
    run('a.csv', () => 'x');
    expect(live.value).toBe('');
    await nextTick();
    expect(live.value).toBe(EXPORT_FAILED);
    run('a.csv', () => 'x');
    expect(live.value).toBe('');
    await nextTick();
    expect(live.value).toBe(EXPORT_FAILED);
  });
  it('V22: a builder that throws is a real error: it propagates, nothing is downloaded or announced', async () => {
    const live = ref('');
    const run = useCsvExport(ref(host), live);
    expect(() => run('a.csv', () => { throw new Error('builder bug'); })).toThrow('builder bug');
    await nextTick();
    expect(downloadText).not.toHaveBeenCalled();
    expect(live.value).toBe('');
  });
  it('V22: a direct write between a failure and the tick is not overwritten', async () => {
    failDownloads();
    const live = ref('');
    useCsvExport(ref(host), live)('a.csv', () => 'x');
    live.value = 'Tests planned for a.ts.';
    await nextTick();
    expect(live.value).toBe('Tests planned for a.ts.');
  });
  it('V22: a later reannounce on the same region wins over a pending failure', async () => {
    failDownloads();
    const live = ref('');
    useCsvExport(ref(host), live)('a.csv', () => 'x');
    await reannounce(live, 'Plan saved.');
    await nextTick();
    expect(live.value).toBe('Plan saved.');
  });
  it('does nothing without a root', () => {
    useCsvExport(ref(null), ref(''))('a.csv', () => 'x');
    expect(downloadText).not.toHaveBeenCalled();
  });
});
```

  - In `tests/component/tests-screen.test.ts`:
    - In the test `'the evidence dialog lists each signal and its state; export sends every gap'`, directly before `await w.find('.ci-tests__export').trigger('click');` add:

```ts
    expect(w.find('.ci-tests__export').attributes('aria-disabled')).toBeUndefined();
```

    - Append this test before the closing `});` of the `describe`:

```ts
  it('V23 (E40): with no model, Export is aria-disabled, stays focusable, and a press hands nothing to downloadText', async () => {
    const w = mountT();   // no snapshot: testConfidence is null
    const button = w.find('.ci-tests__export');
    expect(button.attributes('disabled')).toBeUndefined();
    expect(button.attributes('aria-disabled')).toBe('true');
    (button.element as HTMLElement).focus();
    await button.trigger('click');
    await nextTick();
    expect(downloadText).not.toHaveBeenCalled();
    expect(w.find('.ci-tests__live').text()).toBe('');
    expect(document.activeElement).toBe(button.element);
    w.unmount();
  });
```

- [ ] **Step 5: Run them and confirm they fail.** `npx vitest run tests/unit/use-csv-export.test.ts tests/component/tests-screen.test.ts`. Expected failures:
  - `V22: a builder that throws …`: the current `build()` runs inside the `try`, so the error is swallowed and `EXPORT_FAILED` is announced; `toThrow` fails.
  - `V22: a direct write …` and `V22: a later reannounce …`: the current `nextTick().then(() => { liveMessage.value = EXPORT_FAILED; })` overwrites the later message.
  - `V23 (E40) …`: the button carries `disabled` today, so `attributes('disabled')` is defined.
- [ ] **Step 6: Implement `useCsvExport`.** Replace the whole of `src/ui/export/use-csv-export.ts` with:

```ts
// E55: the one export handler every screen uses. The download goes through the
// leaf's own document (P8), nothing is written to the vault, and a failure is announced
// in the screen's live region. Success announces nothing (E17): the save dialog that
// Electron shows is the outcome.
import type { Ref } from 'vue';
import { EXPORT_FAILED } from '../inspector-copy';
import { reannounce } from '../kit/reannounce';
import { downloadText } from './download';

export const CSV_MIME = 'text/csv;charset=utf-8';
export const MARKDOWN_MIME = 'text/markdown;charset=utf-8';
export const JSON_MIME = 'application/json;charset=utf-8';

/** Part 5 V22: the text is built OUTSIDE the try, so a builder bug is a real error, never a
 *  "Could not start the download." Only a failing download is announced, through
 *  reannounce (a repeated failure is announced again; a later outcome is never overwritten). */
export function useCsvExport(root: Ref<HTMLElement | null>, liveMessage: Ref<string>): (filename: string, build: () => string, mime?: string) => void {
  return (filename, build, mime = CSV_MIME) => {
    const host = root.value;
    if (!host) return;
    const text = build();
    try {
      downloadText(host, filename, text, mime);
    } catch {
      void reannounce(liveMessage, EXPORT_FAILED);
    }
  };
}
```

- [ ] **Step 7: Tests export with no model.** In `src/ui/screens/TestsScreen.vue`:
  - Replace

```ts
function exportCsv(): void { exportText(TESTS_CSV_FILENAME, () => gapsCsv(testConfidence.value?.gaps ?? [])); }
```

  with

```ts
/** V23 (E40): nothing to export without a model or without gaps. The button stays focusable
 *  (aria-disabled), so the handler refuses too, and downloadText never gets an empty CSV. */
const exportBlocked = computed(() => !testConfidence.value || testConfidence.value.gaps.length === 0);
function exportCsv(): void {
  const model = testConfidence.value;
  if (!model || model.gaps.length === 0) return;
  exportText(TESTS_CSV_FILENAME, () => gapsCsv(model.gaps));
}
```

  - In the template, replace

```vue
          :disabled="!testConfidence || testConfidence.gaps.length === 0"
```

  with

```vue
          :aria-disabled="exportBlocked ? 'true' : undefined"
```

  The kit's shared `button[aria-disabled="true"]` rule (kit.css, E54) styles it; add no CSS.
- [ ] **Step 8: Run and confirm they pass.** `npx vitest run tests/unit/reannounce.test.ts tests/unit/use-csv-export.test.ts tests/component/tests-screen.test.ts tests/component/hotspots-screen.test.ts tests/component/quality-screen.test.ts tests/component/security-screen.test.ts tests/component/dependencies-screen.test.ts tests/component/ownership-screen.test.ts tests/component/report-screen.test.ts tests/component/settings-screen.test.ts` (every screen that exports keeps its "a failed export is announced" test green), then the gate, plus `npx eslint src/ui/kit/reannounce.ts src/ui/export/use-csv-export.ts src/ui/screens/TestsScreen.vue tests/unit/reannounce.test.ts tests/unit/use-csv-export.test.ts tests/component/tests-screen.test.ts --max-warnings 0`.
- [ ] **Step 9: Commit.** `feat(ui): reannounce helper; exports build outside the try; Tests export refuses without a model (V22, V23)`

---

### Task 5: Focus after in-leaf navigation (V7)

**Files:**
- Create: `src/ui/shell/use-route-focus.ts` (~40 lines)
- Modify: `src/ui/App.vue` (164 before Task 2; Task 5 adds ~13 lines), `src/ui/kit/PageHeader.vue` (25 → 26), `src/ui/audit-copy/shared.ts` (12 → 14), `src/ui/styles/kit.css` (+2), `src/ui/styles/shell.css` (100 → 102)
- Test: `tests/component/route-focus.test.ts` (new, ~130)

**Interfaces:**
- Consumes: `reannounce` (Task 4, `src/ui/kit/reannounce.ts`), `ROUTE_META` (`src/ui/routes.ts`), `useCityStore().route`.
- Produces: `useRouteFocus(shellEl: Ref<HTMLElement | null>, mainEl: Ref<HTMLElement | null>, liveMessage: Ref<string>): void`; copy `ROUTE_OPENED = (title: string): string => \`${title} screen.\`` in `src/ui/audit-copy/shared.ts`; App's `<p class="visually-hidden ci-shell__live" role="status">`; `<main class="ci-shell__content" tabindex="-1">`; PageHeader's `<h2 class="ci-page-header__title" tabindex="-1">`.

Behaviour (V7), for the implementer:
- A `flush: 'pre'` watcher on `store.route` records whether `document.activeElement` was inside the shell before the patch.
- A `flush: 'post'` watcher then applies one case:
  1. Focus was inside and **fell out**: focus the first `.ci-page-header__title` inside `<main>`, else `<main>`. Nothing is announced (the focused heading is the announcement). Focus on the shell root itself counts as "fell out": that is CiDialog's fallback when the palette's opener unmounted.
  2. Focus was inside and **still is** (nav column, top bar, palette opener): focus stays; `reannounce(liveMessage, ROUTE_OPENED(ROUTE_META[route].title))`.
  3. Focus was **not** inside the shell: nothing.
- Focus styles: `styles.css` has `:where(.codebase-inspector-root) :focus-visible { outline: 2px solid var(--ci-focus) }`. A programmatically focused `tabindex="-1"` heading matches `:focus-visible` in Chromium when the navigation came from the keyboard, so it would get a ring. It is not an interactive control, so, like `.ci-shell:focus` (shell.css), the heading and `<main>` get `outline: none` on `:focus`. Interactive controls keep their ring.

- [ ] **Step 1: Write the failing test.** Create `tests/component/route-focus.test.ts`:

```ts
// Part 5 V7: where focus goes after in-leaf navigation, and what the shell announces.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { flushPromises, mount, type DOMWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import type { RouteId } from '../../src/domain/route-ids';
import App from '../../src/ui/App.vue';
import { useCityStore } from '../../src/ui/stores/city-store';

function mountShell(route: RouteId) {
  useCityStore().navigate(route);
  return mount(App, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });
}
type Shell = ReturnType<typeof mountShell>;
const live = (w: Shell) => w.find('.ci-shell__live');
async function openTab(w: Shell, id: string): Promise<void> {
  await w.find(`[role="tab"][data-tab-id="${id}"]`).trigger('click');
}
/** A real press: focus the control first (trigger('click') alone does not), then click. */
async function press(target: DOMWrapper<Element> | undefined): Promise<void> {
  expect(target?.exists()).toBe(true);
  (target!.element as HTMLElement).focus();
  await target!.trigger('click');
  await flushPromises();
}

interface UnmountCase { name: string; from: RouteId; tab: string | null; trigger: string; text: string | null; to: RouteId; focus: string }
const UNMOUNT_CASES: readonly UnmountCase[] = [
  { name: 'Settings › Accessibility › Open file inventory', from: 'settings', tab: 'accessibility', trigger: '.ci-settings__inventory', text: null, to: 'city', focus: '.ci-screen--city .ci-page-header__title' },
  { name: 'Data & scans › Used by › Architecture', from: 'sources', tab: null, trigger: '.ci-provider--imports .ci-provider__route', text: 'Architecture', to: 'architecture', focus: '.ci-screen--architecture .ci-page-header__title' },
  { name: 'Settings › Analysis › View current scope', from: 'settings', tab: 'analysis', trigger: '.ci-settings__scope', text: null, to: 'sources', focus: '.ci-screen--sources .ci-page-header__title' },
  // No snapshot: File detail shows NoSnapshot, which has no PageHeader, so <main> takes focus.
  { name: 'Data & scans › Used by › File detail (no heading: <main>)', from: 'sources', tab: null, trigger: '.ci-provider--static .ci-provider__route', text: 'File detail', to: 'file', focus: 'main.ci-shell__content' },
];

describe('route focus (V7)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it.each(UNMOUNT_CASES)('case 1, the trigger unmounts: $name → focus on the new screen, nothing announced', async (c) => {
    const w = mountShell(c.from);
    if (c.tab) await openTab(w, c.tab);
    const candidates = w.findAll(c.trigger);
    await press(c.text === null ? candidates[0] : candidates.find((b) => b.text() === c.text));
    expect(useCityStore().route).toBe(c.to);
    const target = w.find(c.focus);
    expect(target.exists()).toBe(true);
    expect(document.activeElement).toBe(target.element);
    expect(live(w).text()).toBe('');
    w.unmount();
  });

  it('the page title and <main> are focusable only programmatically', () => {
    const w = mountShell('overview');
    expect(w.find('.ci-page-header__title').attributes('tabindex')).toBe('-1');
    expect(w.find('main.ci-shell__content').attributes('tabindex')).toBe('-1');
    w.unmount();
  });

  it('case 2, focus stays in the shell (nav column): it stays, and each route is announced once, cleared first', async () => {
    const w = mountShell('overview');
    const region = live(w).element;
    const records: string[] = [];
    const observer = new MutationObserver(() => { records.push(region.textContent?.trim() ?? ''); });
    observer.observe(region, { childList: true, characterData: true, subtree: true });
    const item = (title: string) => w.findAll('.ci-nav__item').find((b) => b.text().includes(title));
    await press(item('Hotspots'));
    expect(useCityStore().route).toBe('hotspots');
    expect(document.activeElement).toBe(item('Hotspots')!.element);
    expect(live(w).text()).toBe('Hotspots screen.');
    await press(item('Overview'));
    expect(document.activeElement).toBe(item('Overview')!.element);
    expect(live(w).text()).toBe('Overview screen.');
    // Part 4 E2/E18: the intermediate '' is observed before the next message.
    expect(records).toEqual(['Hotspots screen.', '', 'Overview screen.']);
    observer.disconnect();
    w.unmount();
  });

  it('case 3, focus outside the shell (host-driven navigation): nothing moves and nothing is announced', async () => {
    const outside = document.body.createEl('button', { text: 'Another pane' });
    const w = mountShell('settings');
    outside.focus();
    useCityStore().navigate('overview');
    await flushPromises();
    expect(useCityStore().route).toBe('overview');
    expect(document.activeElement).toBe(outside);
    expect(live(w).exists()).toBe(true);
    expect(live(w).text()).toBe('');
    w.unmount();
    outside.remove();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/component/route-focus.test.ts`. Expected: every case-1 row fails on `document.activeElement` (it is `<body>`: the focused trigger was removed and nothing re-focuses); the tabindex test fails (`undefined`); case 2 and case 3 fail because `.ci-shell__live` does not exist.
- [ ] **Step 3: Copy.** Append to `src/ui/audit-copy/shared.ts`:

```ts
// Part 5 V7: the shell's route announcement (App's visually hidden status region), said
// only when focus stayed in the shell (nav column, top bar, palette opener).
export const ROUTE_OPENED = (title: string): string => `${title} screen.`;
```

- [ ] **Step 4: The composable.** Create `src/ui/shell/use-route-focus.ts`:

```ts
// Part 5 V7: focus after in-leaf navigation. A `pre` watcher notes whether focus was inside
// this leaf's shell before the route patch; a `post` watcher then decides:
// (1) focus was inside and fell out (the trigger unmounted; CiDialog's fallback onto the
//     shell root counts too): focus the new screen's first page-header title, or <main>.
//     The focused heading is the announcement, so nothing else is said.
// (2) focus was inside and still is (nav column, top bar, palette opener): it stays, and
//     the shell's status region says "<Screen> screen." once (reannounce).
// (3) focus was elsewhere (host-driven navigation, another pane): nothing moves or is said.
import { watch, type Ref } from 'vue';
import { ROUTE_OPENED } from '../inspector-copy';
import { reannounce } from '../kit/reannounce';
import { ROUTE_META } from '../routes';
import { useCityStore } from '../stores/city-store';

/** Focus sits on something inside the shell other than the shell root itself. */
function focusWithin(shell: HTMLElement): boolean {
  const active = shell.ownerDocument.activeElement;
  return active !== null && active !== shell && shell.contains(active);
}

export function useRouteFocus(shellEl: Ref<HTMLElement | null>, mainEl: Ref<HTMLElement | null>, liveMessage: Ref<string>): void {
  const store = useCityStore();
  let hadFocus = false;
  watch(() => store.route, () => {
    const shell = shellEl.value;
    hadFocus = shell !== null && shell.contains(shell.ownerDocument.activeElement);
  }, { flush: 'pre' });
  watch(() => store.route, (route) => {
    const shell = shellEl.value;
    const wasInside = hadFocus;
    hadFocus = false;
    if (!wasInside || !shell) return;
    if (focusWithin(shell)) {
      void reannounce(liveMessage, ROUTE_OPENED(ROUTE_META[route].title));
      return;
    }
    const main = mainEl.value;
    (main?.querySelector<HTMLElement>('.ci-page-header__title') ?? main)?.focus();
  }, { flush: 'post' });
}
```

- [ ] **Step 5: App.** In `src/ui/App.vue` (anchors avoid the lines Task 2 changed):
  - After `import { useJournalFeed } from './shell/use-journal-feed';` add `import { useRouteFocus } from './shell/use-route-focus';`.
  - Replace

```ts
interface CityScreenExposed { rendererHost: HTMLElement | null }
```

  with

```ts
/** Part 5 V7: focus after in-leaf navigation, and the shell's own route announcement. */
const mainEl = ref<HTMLElement | null>(null);
const routeMessage = ref('');
useRouteFocus(rootEl, mainEl, routeMessage);

interface CityScreenExposed { rendererHost: HTMLElement | null }
```

  - In the template, replace

```vue
    <main
      class="ci-shell__content"
      :inert="drawerOpen || undefined"
    >
```

  with

```vue
    <main
      ref="mainEl"
      class="ci-shell__content"
      tabindex="-1"
      :inert="drawerOpen || undefined"
    >
```

  - Replace

```vue
    </main>
    <CommandPalette
```

  with

```vue
    </main>
    <p
      class="visually-hidden ci-shell__live"
      role="status"
    >
      {{ routeMessage }}
    </p>
    <CommandPalette
```

  `.visually-hidden` is `position: absolute`, so the paragraph takes no cell in the `.ci-shell` grid.
- [ ] **Step 6: PageHeader.** In `src/ui/kit/PageHeader.vue`, replace

```vue
      <h2 class="ci-page-header__title">
```

  with

```vue
      <h2
        class="ci-page-header__title"
        tabindex="-1"
      >
```

- [ ] **Step 7: Focus styles.**
  - In `src/ui/styles/kit.css`, directly after the line `:where(.codebase-inspector-root) .ci-page-header__title { margin: var(--ci-space-2) 0 0; font-size: 1.6em; }` add:

```css
/* Part 5 V7: a focus target after navigation, never a control: no ring (like .ci-shell:focus). */
:where(.codebase-inspector-root) .ci-page-header__title:focus { outline: none; }
```

  - In `src/ui/styles/shell.css`, directly after `:where(.codebase-inspector-root) .ci-shell:focus { outline: none; }` add:

```css
/* Part 5 V7: <main> is focused only when the new screen has no page title; never a control. */
:where(.codebase-inspector-root) .ci-shell__content:focus { outline: none; }
```

- [ ] **Step 8: Run and confirm it passes.** `npx vitest run tests/component/route-focus.test.ts tests/component/workspace-shell.test.ts tests/component/command-palette.test.ts tests/component/nav-column.test.ts tests/component/welcome-state.test.ts tests/component/toolbar-scan.test.ts tests/component/status-surfaces.test.ts tests/component/shell-provenance.test.ts tests/component/container-box.test.ts tests/component/responsive-floor.test.ts tests/component/camera-round-trip.test.ts tests/component/view-surface-memo.test.ts tests/component/settings-screen.test.ts tests/component/file-detail-screen.test.ts tests/component/kit-display.test.ts tests/unit/kit-css-fallbacks.test.ts` (every test that mounts App, plus PageHeader users), then the gate, plus `npx eslint src/ui/shell/use-route-focus.ts src/ui/App.vue src/ui/kit/PageHeader.vue src/ui/audit-copy/shared.ts tests/component/route-focus.test.ts --max-warnings 0`. Report App.vue's final line count.
- [ ] **Step 9: Commit.** `feat(ui): focus moves to the new screen's title when navigation drops it; the shell announces in-shell navigation (V7)`

---

### Task 6: Review state per codebase (V8, V9, V10, V31)

Review and report state are kept per `repositoryId` inside the leaf. Every async review action is isolated from a codebase switch. The three "Part 4 E2" title-clip citations are corrected.

**Files:**
- Modify: `src/ui/stores/review-store.ts` (263 → ~318)
- Modify: `src/ui/stores/report-store.ts` (37 → ~50)
- Modify: `src/ui/App.vue` (164 → ~170. Tasks 2 and 5 also edit this file; this task changes only the imports, one `const` and the repository watcher)
- Modify: `src/ui/stores/ports/review-repository.ts` (132 → 132; citation only)
- Modify: `tests/harness/mount.ts` (251 → ~255; await the bind's load before seeding demo items)
- Create: `tests/unit/review-per-codebase.test.ts` (~170)
- Modify: `tests/unit/report-model.test.ts` (131 → ~140)
- Modify: `tests/component/workspace-shell.test.ts` (273 → ~297)
- Modify: `tests/unit/review-work-items.test.ts` (129 → 129; citation only)

**Interfaces:**
- Consumes: `createInMemoryReviewRepository`, `ReviewRepository` (`src/ui/stores/ports/review-repository.ts`); `store.snapshot?.repositoryId` (city store).
- Produces:
  - `useReviewStore()` state gains `buckets: Map<string, ReviewBucket>` (raw) and `boundKey: string` (`''` while unbound). `ReviewBucket = { repository: ReviewRepository; nextId: number; nextRuleId: number }` (module-private).
  - `useReviewStore().bindRepository(id: string): Promise<void>`: steps (a)–(d) run synchronously, then (e) `await load()`. Binding the bound id again is a no-op.
  - `setRepository(repository)` also replaces the bound bucket's repository.
  - Every async action (`load`, `addWorkItem`, `updateWorkItem`, `removeWorkItem`, `clearAll`, `addRule`, `removeRule`, `decide`, `reopen`) captures `const repo = this.repository` before its `await`. It mutates local state only if `this.repository === repo`.
  - `useReportStore()` state gains `stash: Map<string, { sections; note }>` (raw). `bindRepository(id)` stashes the old id's choices and restores the new id's choices, or the defaults when it has none. `reset()` is unchanged.

- [ ] **Step 1: Write the failing tests.**

Create `tests/unit/review-per-codebase.test.ts`:

```ts
// Part 5 V8–V9: review state per codebase, and in-flight operations across a switch.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { makeEntityId } from '../../src/domain/entity-id';
import { architectureGraphFor } from '../../src/ui/read-models/architecture';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { architectureModelFor } from '../../src/ui/read-models/use-read-models';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { NO_CHECKS, createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const NOW = new Date('2026-09-22T10:00:00.000Z');
const fileIn = (repo: string, path: string) => ({ kind: 'file' as const, entityId: makeEntityId(repo, 'file', path) });

/** A promise the test settles by hand, to hold a repository call open across a switch. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('review store per codebase (Part 5 V8)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('empties the lists synchronously on a switch, before the new codebase has loaded', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    await store.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A1', NOW);
    await store.addRule('ui', 'domain', 'Layering', NOW);
    await store.acknowledge(`${fileIn('repo-a', 'src/a.ts').entityId}#CX-a-1`, NOW);
    const binding = store.bindRepository('repo-b');
    expect(store.workItems).toEqual([]);
    expect(store.rules).toEqual([]);
    expect(store.dispositions).toEqual([]);
    await binding;
    expect(store.workItemCount).toBe(0);
  });

  it('keeps each codebase\'s items, rules, decisions and id counters apart, and restores them on the way back', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    await store.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A1', NOW);
    const a2 = await store.addWorkItem(fileIn('repo-a', 'src/b.ts'), 'refactor', 'A2', NOW);
    // wi-2 is removed, but its id stays spent: only the bucket's counter remembers that.
    expect(await store.removeWorkItem(a2!.id)).toBe(true);
    await store.addRule('ui', 'domain', 'Layering', NOW);
    await store.acknowledge('fp-a', NOW);

    await store.bindRepository('repo-b');
    expect((await store.addWorkItem(fileIn('repo-b', 'src/a.ts'), 'refactor', 'B1', NOW))?.id).toBe('wi-1');
    expect((await store.addRule('ui', 'domain', 'B rule', NOW))?.id).toBe('AR-001');
    expect(store.workItems.map((w) => w.title)).toEqual(['B1']);

    await store.bindRepository('repo-a');
    expect(store.workItems.map((w) => w.title)).toEqual(['A1']);
    expect(store.rules.map((r) => r.rationale)).toEqual(['Layering']);
    expect(store.dispositions.map((d) => d.fingerprint)).toEqual(['fp-a']);
    expect((await store.addWorkItem(fileIn('repo-a', 'src/c.ts'), 'refactor', 'A3', NOW))?.id).toBe('wi-3');
    expect((await store.addRule('ui', 'api', 'Second', NOW))?.id).toBe('AR-002');
  });

  it('keeps a save that settles after a switch in its own codebase: it is returned, never shown in the other one', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    const repoA = createInMemoryReviewRepository();
    const gate = deferred();
    store.setRepository({ ...repoA, saveWorkItem: async (item) => { await gate.promise; await repoA.saveWorkItem(item); } });
    const adding = store.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A1', NOW);
    await store.bindRepository('repo-b');
    gate.resolve();
    const item = await adding;
    expect(item?.title).toBe('A1');
    expect(store.workItems).toEqual([]);
    expect((await repoA.listWorkItems()).map((w) => w.title)).toEqual(['A1']);
    await store.bindRepository('repo-a');
    expect(store.workItems.map((w) => w.title)).toEqual(['A1']);
  });

  it('never lets an update or a removal that settles after a switch touch the other codebase\'s item with the same id', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    await store.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A1', NOW);
    await store.addWorkItem(fileIn('repo-a', 'src/b.ts'), 'refactor', 'A2', NOW);
    const repoA = store.repository;
    const gate = deferred();
    store.setRepository({
      ...repoA,
      saveWorkItem: async (item) => { await gate.promise; await repoA.saveWorkItem(item); },
      removeWorkItem: async (id) => { await gate.promise; await repoA.removeWorkItem(id); },
    });
    const updating = store.updateWorkItem('wi-1', { title: 'A1 renamed' }, NOW);
    const removing = store.removeWorkItem('wi-2');
    await store.bindRepository('repo-b');
    await store.addWorkItem(fileIn('repo-b', 'src/a.ts'), 'refactor', 'B1', NOW);
    await store.addWorkItem(fileIn('repo-b', 'src/b.ts'), 'refactor', 'B2', NOW);
    expect(store.workItems.map((w) => w.id)).toEqual(['wi-1', 'wi-2']);
    gate.resolve();
    expect((await updating)?.title).toBe('A1 renamed');
    expect(await removing).toBe(true);
    expect(store.workItems.map((w) => w.title)).toEqual(['B1', 'B2']);
    await store.bindRepository('repo-a');
    expect(store.workItems.map((w) => w.title)).toEqual(['A1 renamed']);
  });

  it('a load that settles after a switch never fills the new codebase with the old one\'s data', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    const repoA = createInMemoryReviewRepository();
    await repoA.saveWorkItem({
      id: 'wi-1', target: fileIn('repo-a', 'src/a.ts'), intent: 'refactor', title: 'A1', status: 'planned',
      priority: 'medium', notes: '', checks: NO_CHECKS, createdAt: NOW.toISOString(),
    });
    const gate = deferred();
    store.setRepository({ ...repoA, listWorkItems: async () => { await gate.promise; return repoA.listWorkItems(); } });
    const loading = store.load();
    await store.bindRepository('repo-b');
    gate.resolve();
    await loading;
    expect(store.workItems).toEqual([]);
  });

  it('binding the bound codebase again is a no-op: nothing is emptied or reloaded', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    const repo = createInMemoryReviewRepository();
    let lists = 0;
    store.setRepository({ ...repo, listWorkItems: () => { lists += 1; return repo.listWorkItems(); } });
    await store.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A1', NOW);
    await store.bindRepository('repo-a');
    expect(lists).toBe(0);
    expect(store.workItems.map((w) => w.title)).toEqual(['A1']);
  });

  it('the Architecture memo (keyed by the raw rules array) follows the switch both ways', async () => {
    const graph = architectureGraphFor(fileSummariesFor(buildSnapshotFixture({ files: 6, directories: 2, repositoryId: 'repo-a' })));
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    await store.addRule('dir-0', 'dir-1', 'Layering', NOW);
    expect(architectureModelFor(graph, store.rules).rules).toHaveLength(1);
    await store.bindRepository('repo-b');
    expect(architectureModelFor(graph, store.rules).rules).toHaveLength(0);
    await store.bindRepository('repo-a');
    expect(architectureModelFor(graph, store.rules).rules).toHaveLength(1);
  });
});
```

In `tests/unit/report-model.test.ts`, replace the E8 test (its title line through its closing `});`):

```ts
  it('fix round 1 #2 (Part 4 E8): binding a different repository clears the note and section choices; re-binding the same one is a no-op', () => {
    const r = useReportStore();
    r.bindRepository('repo-a');
    r.setSection('security', false);
    expect(r.applyNote('about repo-a')).toBe(true);

    r.bindRepository('repo-b');
    expect(r.note).toBe('');
    expect(r.sections).toEqual({ summary: true, architecture: true, hotspots: true, security: true, plan: true });

    r.setSection('plan', false);
    expect(r.applyNote('about repo-b')).toBe(true);
    r.bindRepository('repo-b');
    expect(r.note).toBe('about repo-b');
    expect(r.sections.plan).toBe(false);
  });
```

with:

```ts
  it('Part 4 E8 as amended by Part 5 V10: a new codebase starts from the defaults, the note never crosses codebases, and a round trip restores each one\'s own choices', () => {
    const r = useReportStore();
    r.bindRepository('repo-a');
    r.setSection('security', false);
    expect(r.applyNote('about repo-a')).toBe(true);

    r.bindRepository('repo-b');
    expect(r.note).toBe('');
    expect(r.sections).toEqual({ summary: true, architecture: true, hotspots: true, security: true, plan: true });

    r.setSection('plan', false);
    expect(r.applyNote('about repo-b')).toBe(true);
    r.bindRepository('repo-b');
    expect(r.note).toBe('about repo-b');
    expect(r.sections.plan).toBe(false);

    r.bindRepository('repo-a');
    expect(r.note).toBe('about repo-a');
    expect(r.sections).toEqual({ summary: true, architecture: true, hotspots: true, security: false, plan: true });
    r.bindRepository('repo-b');
    expect(r.note).toBe('about repo-b');
    expect(r.sections.plan).toBe(false);
  });
```

In `tests/component/workspace-shell.test.ts`:
- Change the import `import { mount } from '@vue/test-utils';` to `import { flushPromises, mount } from '@vue/test-utils';`.
- After `import { useReportStore } from '../../src/ui/stores/report-store';`, add `import { useReviewStore } from '../../src/ui/stores/review-store';`.
- Add this test after the "binds the report store …" test, inside the same `describe`:

```ts
  it('shows each codebase its own work items: a switch empties the Workbench at once, and switching back restores it (Part 5 V8)', async () => {
    const w = mountShell();
    const repoA = buildSnapshotFixture({ files: 4, directories: 1, repositoryId: 'repo-a' });
    useCityStore().setCity(repoA, computeLayout(repoA));
    useCityStore().navigate('workbench');
    await flushPromises();
    const fileA = repoA.entities.find((e) => e.kind === 'file')!;
    await useReviewStore().addWorkItemForFile(fileA.id, 'Split A', new Date());
    await nextTick();
    expect(w.findAll('.ci-work-card__title').map((t) => t.text())).toEqual(['Split A']);

    const repoB = buildSnapshotFixture({ files: 4, directories: 1, repositoryId: 'repo-b' });
    useCityStore().setCity(repoB, computeLayout(repoB));
    await nextTick();
    expect(w.findAll('.ci-work-card')).toHaveLength(0);

    useCityStore().setCity(repoA, computeLayout(repoA));
    await flushPromises();
    expect(w.findAll('.ci-work-card__title').map((t) => t.text())).toEqual(['Split A']);
    w.unmount();
  });
```

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/review-per-codebase.test.ts tests/unit/report-model.test.ts tests/component/workspace-shell.test.ts`. Expected: FAIL.
  - `review-per-codebase`: every test fails with `TypeError: store.bindRepository is not a function`.
  - `report-model`: the amended E8 test fails with `expected '' to be 'about repo-a'`, because today's `bindRepository` resets instead of restoring.
  - `workspace-shell`: the new test fails with `expected [ …(1) ] to have a length of 0`. App does not bind the review store yet, so repo-a's card stays on screen for repo-b.

- [ ] **Step 3: Implement buckets in the review store.** Edit `src/ui/stores/review-store.ts`.

  (a) After the `isRejected` function, add the bucket type and its factory. Replace:

```ts
function isRejected(result: PromiseSettledResult<unknown>): result is PromiseRejectedResult {
  return result.status === 'rejected';
}
```

with:

```ts
function isRejected(result: PromiseSettledResult<unknown>): result is PromiseRejectedResult {
  return result.status === 'rejected';
}

/** Part 5 V8: one codebase's own repository and id counters. The lists are reloaded from
 *  the repository on every switch; the counters travel with the bucket because a failed
 *  save or a removal leaves a spent id that `load()` cannot see. */
interface ReviewBucket { repository: ReviewRepository; nextId: number; nextRuleId: number }
const newBucket = (): ReviewBucket => ({ repository: markRaw(createInMemoryReviewRepository()), nextId: 1, nextRuleId: 1 });
```

  (b) Add two fields to `ReviewState`. Replace:

```ts
  /** Fingerprints with a `decide` (acknowledge/dismiss) or `reopen` in flight — same
   *  reservation pattern as `pendingWorkKeys`. */
  pendingFingerprints: string[];
}
```

with:

```ts
  /** Fingerprints with a `decide` (acknowledge/dismiss) or `reopen` in flight — same
   *  reservation pattern as `pendingWorkKeys`. */
  pendingFingerprints: string[];
  /** Part 5 V8: every codebase bound in this leaf, by repository id; `''` is the unbound
   *  bucket used before any snapshot. Raw: nothing renders from it. The pending arrays
   *  above stay global (V9). */
  buckets: Map<string, ReviewBucket>;
  /** The key of the bucket that `repository` and the counters belong to. */
  boundKey: string;
}
```

  (c) Replace the `state` factory:

```ts
  state: (): ReviewState => ({
    workItems: [],
    nextId: 1,
    repository: markRaw(createInMemoryReviewRepository()),
    rules: [],
    nextRuleId: 1,
    pendingRuleKeys: [],
    pendingWorkKeys: [],
    pendingItemIds: [],
    dispositions: [],
    pendingFingerprints: [],
  }),
```

with:

```ts
  state: (): ReviewState => {
    const unbound = newBucket();
    return {
      workItems: [],
      nextId: 1,
      repository: unbound.repository,
      rules: [],
      nextRuleId: 1,
      pendingRuleKeys: [],
      pendingWorkKeys: [],
      pendingItemIds: [],
      dispositions: [],
      pendingFingerprints: [],
      buckets: markRaw(new Map([['', unbound]])),
      boundKey: '',
    };
  },
```

  (d) Replace `setRepository` and the head of `load`:

```ts
    setRepository(repository: ReviewRepository): void {
      this.repository = markRaw(repository);
    },
    /** Part 2 §5: pending-aware. A save still in flight has already reserved an id; the
     *  counters only ever move forward, so load() can never hand that id out again. */
    async load(): Promise<void> {
      const [items, rules, dispositions] = await Promise.all([
        this.repository.listWorkItems(), this.repository.listRules(), this.repository.listDispositions(),
      ]);
      this.workItems = items;
```

with:

```ts
    /** Replaces the bound codebase's repository (tests; WP-05's durable adapter). */
    setRepository(repository: ReviewRepository): void {
      const raw = markRaw(repository);
      this.repository = raw;
      const bucket = this.buckets.get(this.boundKey);
      if (bucket) bucket.repository = raw;
    },
    /** Part 5 V8: one in-memory repository, and its own id counters, per codebase.
     *  Steps (a)–(d) run synchronously, so the previous codebase's items never render for
     *  even one frame; (e) loads the target codebase's own state. Binding the bound id
     *  again is a no-op. Nothing leaves memory (WP-05 adds the durable adapter behind the
     *  same port, keyed the same way). */
    async bindRepository(id: string): Promise<void> {
      if (id === this.boundKey) return;
      const current = this.buckets.get(this.boundKey);
      if (current) {
        current.nextId = this.nextId; // (a)
        current.nextRuleId = this.nextRuleId;
      }
      let target = this.buckets.get(id); // (b)
      if (!target) {
        target = newBucket();
        this.buckets.set(id, target);
      }
      this.boundKey = id; // (c)
      this.repository = target.repository;
      this.nextId = target.nextId;
      this.nextRuleId = target.nextRuleId;
      this.workItems = []; // (d)
      this.rules = [];
      this.dispositions = [];
      await this.load(); // (e)
    },
    /** Part 2 §5: pending-aware. A save still in flight has already reserved an id; the
     *  counters only ever move forward, so load() can never hand that id out again.
     *  Part 5 V9: a load that settles after a codebase switch belongs to the old codebase
     *  and changes nothing. */
    async load(): Promise<void> {
      const repo = this.repository;
      const [items, rules, dispositions] = await Promise.all([
        repo.listWorkItems(), repo.listRules(), repo.listDispositions(),
      ]);
      if (this.repository !== repo) return;
      this.workItems = items;
```

  (e) `addWorkItem`. Replace:

```ts
      if (workItemProblem(item) !== null) return null;
      this.nextId += 1;
      this.pendingWorkKeys.push(key);
      try {
        await this.repository.saveWorkItem(item);
        // A load() that ran mid-save may already hold it.
        if (!this.workItems.some((w) => w.id === item.id)) this.workItems.push(item);
        return item;
```

with:

```ts
      if (workItemProblem(item) !== null) return null;
      const repo = this.repository;
      this.nextId += 1;
      this.pendingWorkKeys.push(key);
      try {
        await repo.saveWorkItem(item);
        // Part 5 V9: saved in its own codebase either way (so the real result is
        // returned), but shown only while that codebase is still bound. A load() that
        // ran mid-save may already hold it.
        if (this.repository === repo && !this.workItems.some((w) => w.id === item.id)) this.workItems.push(item);
        return item;
```

  (f) `updateWorkItem`. Replace:

```ts
      if (workItemProblem(next) !== null) return null;
      this.pendingItemIds.push(id);
      try {
        await this.repository.saveWorkItem(next);
        this.workItems = this.workItems.map((w) => (w.id === id ? next : w));
        return next;
```

with:

```ts
      if (workItemProblem(next) !== null) return null;
      const repo = this.repository;
      this.pendingItemIds.push(id);
      try {
        await repo.saveWorkItem(next);
        // Part 5 V9: another codebase may hold an item with the same id.
        if (this.repository === repo) this.workItems = this.workItems.map((w) => (w.id === id ? next : w));
        return next;
```

  (g) `removeWorkItem`. Replace:

```ts
      this.pendingItemIds.push(id);
      try {
        await this.repository.removeWorkItem(id);
        this.workItems = this.workItems.filter((w) => w.id !== id);
        return true;
```

with:

```ts
      const repo = this.repository;
      this.pendingItemIds.push(id);
      try {
        await repo.removeWorkItem(id);
        if (this.repository === repo) this.workItems = this.workItems.filter((w) => w.id !== id);
        return true;
```

  (h) `clearAll`. Replace:

```ts
    async clearAll(): Promise<void> {
      let results: PromiseSettledResult<void>[] = [];
      try {
        results = await Promise.allSettled([
          ...this.workItems.map((w) => this.repository.removeWorkItem(w.id)),
          ...this.rules.map((r) => this.repository.removeRule(r.id)),
          ...this.dispositions.map((d) => this.repository.removeDisposition(d.fingerprint)),
        ]);
      } finally {
        await this.load();
      }
```

with:

```ts
    async clearAll(): Promise<void> {
      const repo = this.repository;
      let results: PromiseSettledResult<void>[] = [];
      try {
        results = await Promise.allSettled([
          ...this.workItems.map((w) => repo.removeWorkItem(w.id)),
          ...this.rules.map((r) => repo.removeRule(r.id)),
          ...this.dispositions.map((d) => repo.removeDisposition(d.fingerprint)),
        ]);
      } finally {
        // Part 5 V9: after a switch, the bound codebase has already loaded its own state.
        if (this.repository === repo) await this.load();
      }
```

  (i) `addRule`. Replace:

```ts
      this.nextRuleId += 1;
      this.pendingRuleKeys.push(key);
      try {
        await this.repository.saveRule(rule);
        if (!this.rules.some((r) => r.id === rule.id)) this.rules.push(rule);
        return rule;
```

with:

```ts
      const repo = this.repository;
      this.nextRuleId += 1;
      this.pendingRuleKeys.push(key);
      try {
        await repo.saveRule(rule);
        if (this.repository === repo && !this.rules.some((r) => r.id === rule.id)) this.rules.push(rule);
        return rule;
```

  (j) `removeRule`. Replace:

```ts
    async removeRule(id: string): Promise<void> {
      await this.repository.removeRule(id);
      this.rules = this.rules.filter((r) => r.id !== id);
    },
```

with:

```ts
    async removeRule(id: string): Promise<void> {
      const repo = this.repository;
      await repo.removeRule(id);
      if (this.repository === repo) this.rules = this.rules.filter((r) => r.id !== id);
    },
```

  (k) `decide`. Replace:

```ts
      if (this.pendingFingerprints.includes(fp)) return null;
      this.pendingFingerprints.push(fp);
      try {
        await this.repository.saveDisposition(disposition);
        this.dispositions = [...this.dispositions.filter((d) => d.fingerprint !== fp), disposition];
        return disposition;
```

with:

```ts
      if (this.pendingFingerprints.includes(fp)) return null;
      const repo = this.repository;
      this.pendingFingerprints.push(fp);
      try {
        await repo.saveDisposition(disposition);
        if (this.repository === repo) this.dispositions = [...this.dispositions.filter((d) => d.fingerprint !== fp), disposition];
        return disposition;
```

  (l) `reopen`. Replace:

```ts
      this.pendingFingerprints.push(fingerprint);
      try {
        await this.repository.removeDisposition(fingerprint);
        this.dispositions = this.dispositions.filter((d) => d.fingerprint !== fingerprint);
        return true;
```

with:

```ts
      const repo = this.repository;
      this.pendingFingerprints.push(fingerprint);
      try {
        await repo.removeDisposition(fingerprint);
        if (this.repository === repo) this.dispositions = this.dispositions.filter((d) => d.fingerprint !== fingerprint);
        return true;
```

  Afterwards, `grep -n "this.repository\." src/ui/stores/review-store.ts` must print nothing: every port call goes through the captured `repo`.

- [ ] **Step 4: Implement the report stash.** Replace the whole of `src/ui/stores/report-store.ts` with:

```ts
// Part 4 W1/W7: the Audit report's choices, held per leaf in memory. Lost when the leaf
// closes; durable history is WP-05. Part 5 V10: kept per codebase within the leaf.
import { defineStore } from 'pinia';
import { markRaw } from 'vue';

export const REPORT_SECTIONS = ['summary', 'architecture', 'hotspots', 'security', 'plan'] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];
export const REPORT_NOTE_MAX = 5000;

const allOn = (): Record<ReportSection, boolean> => ({ summary: true, architecture: true, hotspots: true, security: true, plan: true });

/** One codebase's report choices, set aside while another codebase is bound. */
interface ReportChoices { sections: Record<ReportSection, boolean>; note: string }

export const useReportStore = defineStore('report', {
  state: () => ({
    sections: allOn(),
    note: '',
    repositoryId: null as string | null,
    /** Part 5 V10: the choices of every other codebase bound in this leaf. Raw: nothing renders from it. */
    stash: markRaw(new Map<string, ReportChoices>()),
  }),
  actions: {
    setSection(section: ReportSection, on: boolean): void {
      this.sections = { ...this.sections, [section]: on };
    },
    /** The note is applied, not live (the prototype's "Apply note"). Refuses an over-long note. */
    applyNote(text: string): boolean {
      if (text.length > REPORT_NOTE_MAX) return false;
      this.note = text.trim();
      return true;
    },
    reset(): void {
      this.sections = allOn();
      this.note = '';
    },
    /** Controller ruling Part 4 E8, amended by Part 5 V10: a reviewer note about one
     *  codebase must never appear in another codebase's report. Pinia state lives per
     *  leaf (never reset on its own), so a snapshot switch inside the same leaf sets the
     *  old codebase's note and section choices aside and brings back the new one's (or
     *  the defaults); switching back restores them within the session. Binding the same
     *  repository again is a no-op. */
    bindRepository(id: string): void {
      if (this.repositoryId === id) return;
      if (this.repositoryId !== null) this.stash.set(this.repositoryId, { sections: { ...this.sections }, note: this.note });
      this.repositoryId = id;
      const saved = this.stash.get(id);
      this.sections = saved ? { ...saved.sections } : allOn();
      this.note = saved ? saved.note : '';
    },
  },
});
```

- [ ] **Step 5: Bind the review store in App.** In `src/ui/App.vue`:
  - After `import { useReportStore } from './stores/report-store';`, add `import { useReviewStore } from './stores/review-store';`.
  - After `const report = useReportStore();`, add `const review = useReviewStore();`.
  - Replace:

```ts
 *  different codebase is scanned into this leaf; re-binding the same repository is a
 *  no-op (report-store.ts's own guard). */
watch(() => store.snapshot?.repositoryId, (id) => { if (id) report.bindRepository(id); }, { immediate: true });
```

  with:

```ts
 *  different codebase is scanned into this leaf; re-binding the same repository is a
 *  no-op (report-store.ts's own guard). Part 5 V8/V10: the review store is bound the same
 *  way. Both keep each codebase's state, so switching back restores it. */
watch(() => store.snapshot?.repositoryId, (id) => {
  if (!id) return;
  report.bindRepository(id);
  void review.bindRepository(id);
}, { immediate: true });
```

- [ ] **Step 6: Keep the harness's demo items.** App now binds the review store when the harness snapshot arrives, and that bind starts a `load()`. If that load settled after the demo items were pushed, it would replace them with the empty list it read at bind time. In `tests/harness/mount.ts`, replace:

```ts
      const review = useReviewStore();
      const ids = (store.layout?.lots ?? []).slice(0, 3).map((l) => l.entityId);
```

  with:

```ts
      const review = useReviewStore();
      // Part 5 V8: App's repository watcher bound the review store to this snapshot and
      // started a load. A second load settles after the first (same depth, in order), so
      // awaiting it guarantees no load lands on top of the items added below.
      await review.load();
      const ids = (store.layout?.lots ?? []).slice(0, 3).map((l) => l.entityId);
```

- [ ] **Step 7: Correct the citations (V31).** Change "Part 4 E2" to "Part 4 E3" in exactly these three places, and change nothing else on those lines:
  - `src/ui/stores/ports/review-repository.ts:60`: `/** Controller ruling Part 4 E2: a title cap …` → `/** Controller ruling Part 4 E3: a title cap …`.
  - `src/ui/stores/review-store.ts` (was line 117, the `addWorkItem` comment): `// Controller ruling Part 4 E2: clip (never refuse) …` → `// Controller ruling Part 4 E3: clip (never refuse) …`.
  - `tests/unit/review-work-items.test.ts:35`: `…(controller ruling Part 4 E2), and still produces a real item'` → `…(controller ruling Part 4 E3), and still produces a real item'`.

  Then `grep -rn "Part 4 E2[^0-9]" src tests` must print nothing.

- [ ] **Step 8: Run and confirm it passes.** Run `npx vitest run tests/unit/review-per-codebase.test.ts tests/unit/report-model.test.ts tests/component/workspace-shell.test.ts tests/unit/review-store.test.ts tests/unit/review-work-items.test.ts tests/unit/review-dispositions.test.ts tests/component/settings-screen.test.ts tests/component/workbench-screen.test.ts tests/component/report-screen.test.ts tests/component/architecture-rules.test.ts tests/harness/harness.test.ts`, then the gate. `wc -l src/ui/stores/review-store.ts` must be ≤ 330 (Task 8 adds about 30 more lines).
- [ ] **Step 9: Commit.** `feat(ui): review and report state per codebase; in-flight saves stay in their own codebase (V8–V10, V31)`

---

### Task 7: Review-state export v2 (V11, V12)

**Files:**
- Modify: `src/ui/read-models/review-state.ts` (45 → ~95; full replacement below)
- Modify: `src/ui/audit-copy/settings.ts` (62 → ~66)
- Modify: `src/ui/fixtures/seeded-random.ts` (header comment only)
- Modify: `src/ui/screens/SettingsScreen.vue` (96 → ~100)
- Test: `tests/unit/review-state.test.ts` (27 → ~110; full replacement below), `tests/component/settings-screen.test.ts` (118 → ~135)

**Interfaces:**
- Consumes: `parseEntityId` (`src/domain/entity-id.ts`), `fnv1a(text): number` (`src/ui/fixtures/seeded-random.ts`, already unsigned), `rootFolderLabel` (`src/ui/read-models/root-label.ts`).
- Produces (in `src/ui/read-models/review-state.ts`):
  - `REVIEW_STATE_SCHEMA_V1 = 'codebase-inspector.review-state.v1'` and `REVIEW_STATE_SCHEMA = 'codebase-inspector.review-state.v2'`.
  - `SOURCE_FOLDER_MAX = 255`.
  - `interface ReviewStateSource { folder: string; repository: string }`.
  - `ReviewStateInput` gains the required field `source: ReviewStateSource | null`.
  - `repositoryDigest(repositoryId: string): string`, which returns `'fnv1a32:' + 8 lowercase hex digits`.
  - `reviewStateSource(snapshot: { repositoryId: string; scope: { rootPath: string } } | null): ReviewStateSource | null`.
  - `findingRef(fingerprint: string): string | null`.
  - `reviewStateJson(input)`, which writes `source`, and writes `warnings` only when something was left out.
- Produces (copy, `src/ui/audit-copy/settings.ts`): `REVIEW_STATE_SKIPPED(n: number, kind: 'work items' | 'finding decisions'): string`.
- Tasks 8 and 9 import all of these.

- [ ] **Step 1: Write the failing tests.** Replace the whole of `tests/unit/review-state.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { makeEntityId } from '../../src/domain/entity-id';
import {
  REVIEW_STATE_SCHEMA, REVIEW_STATE_SCHEMA_V1, findingRef, repositoryDigest, reviewStateJson, reviewStateSource,
  type ReviewStateInput,
} from '../../src/ui/read-models/review-state';
import { REVIEW_STATE_SKIPPED } from '../../src/ui/inspector-copy';
import { NO_CHECKS, type WorkItem, type WorkTarget } from '../../src/ui/stores/ports/review-repository';

// 'repo-xyz' (not a bare 'repo', which the "report" key itself contains) so every
// not-leaked assertion below is meaningful.
const REPO = 'repo-xyz';
const ROOT = 'C:\\Users\\someone\\projects\\shop-api';
const fileId = makeEntityId(REPO, 'file', 'src/a.ts');
const SECTIONS = { summary: true, architecture: false, hotspots: true, security: true, plan: true };
const item = (id: string, target: WorkTarget): WorkItem => ({
  id, target, intent: 'refactor', title: 't', status: 'planned', priority: 'high', notes: 'n', checks: NO_CHECKS, createdAt: 'c',
});
const input = (over: Partial<ReviewStateInput> = {}): ReviewStateInput => ({
  workItems: [], rules: [], dispositions: [], report: { sections: SECTIONS, note: 'x' },
  exportedAt: new Date('2026-09-22T10:00:00Z'), source: null, ...over,
});
const data = (text: string) => JSON.parse(text) as Record<string, unknown>;

describe('review-state export (Part 4 W14, Part 5 V11–V12)', () => {
  it('writes the v2 schema, relative paths and never a raw entity id or a NUL', () => {
    const text = reviewStateJson(input({
      workItems: [item('wi-1', { kind: 'file', entityId: fileId })],
      rules: [{ id: 'AR-001', from: 'a', to: 'b', rationale: 'r', createdAt: 'c' }],
      dispositions: [{ fingerprint: `${fileId}#CX-a-1`, status: 'dismissed', reason: 'why', decidedAt: 'd' }],
    }));
    expect(text).not.toContain(String.fromCharCode(0));
    expect(text).not.toContain(String.fromCharCode(92) + 'u0000');
    expect(text).not.toContain(REPO);
    const d = data(text);
    expect(d.schema).toBe(REVIEW_STATE_SCHEMA);
    expect(REVIEW_STATE_SCHEMA).toBe('codebase-inspector.review-state.v2');
    expect(REVIEW_STATE_SCHEMA_V1).toBe('codebase-inspector.review-state.v1');
    expect(d.exportedAt).toBe('2026-09-22T10:00:00.000Z');
    expect(d.source).toBeNull();
    expect(d.workItems).toEqual([expect.objectContaining({ id: 'wi-1', target: { kind: 'file', path: 'src/a.ts' }, checks: [false, false, false] })]);
    expect(d.dispositions).toEqual([{ finding: 'src/a.ts#CX-a-1', status: 'dismissed', reason: 'why', decidedAt: 'd' }]);
    expect(d.report).toEqual({ sections: SECTIONS, note: 'x' });
    expect('warnings' in d).toBe(false);
  });

  it('writes the source as the folder label and a digest: never the raw repository id, never the absolute root (V11)', () => {
    const source = reviewStateSource({ repositoryId: REPO, scope: { rootPath: ROOT } });
    expect(source).toEqual({ folder: 'shop-api', repository: repositoryDigest(REPO) });
    expect(source?.repository).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
    const text = reviewStateJson(input({ source, workItems: [item('wi-1', { kind: 'file', entityId: fileId })] }));
    expect(data(text).source).toEqual(source);
    for (const leak of [REPO, 'someone', 'projects', 'Users']) expect(text, leak).not.toContain(leak);
    expect(reviewStateSource(null)).toBeNull();
    expect(reviewStateSource({ repositoryId: REPO, scope: { rootPath: '/' } })?.folder).toBe('(root)');
  });

  it('repositoryDigest is FNV-1a 32 in eight hex digits, and tells codebases apart', () => {
    expect(repositoryDigest('')).toBe('fnv1a32:811c9dc5');
    expect(repositoryDigest('a')).toBe('fnv1a32:e40c292c');
    expect(repositoryDigest('repo-a')).not.toBe(repositoryDigest('repo-b'));
  });

  it('exports package and module targets as they are (V32)', () => {
    const d = data(reviewStateJson(input({
      workItems: [item('wi-2', { kind: 'package', name: '@scope/pkg' }), item('wi-3', { kind: 'module', module: 'src' })],
    })));
    expect((d.workItems as { target: unknown }[]).map((w) => w.target)).toEqual([
      { kind: 'package', name: '@scope/pkg' }, { kind: 'module', module: 'src' },
    ]);
    expect('warnings' in d).toBe(false);
  });

  it('leaves out a decision whose fingerprint has no "#" or does not parse, counts it, and never writes it (V12)', () => {
    const text = reviewStateJson(input({
      dispositions: [
        { fingerprint: 'legacy-fingerprint-xyz', status: 'acknowledged', decidedAt: 'd' },
        { fingerprint: 'not-an-entity#CX-1', status: 'acknowledged', decidedAt: 'd' },
        { fingerprint: `${fileId}#CX-a-1`, status: 'acknowledged', decidedAt: 'd' },
      ],
    }));
    const d = data(text);
    expect(d.dispositions).toEqual([{ finding: 'src/a.ts#CX-a-1', status: 'acknowledged', decidedAt: 'd' }]);
    expect(d.warnings).toEqual([REVIEW_STATE_SKIPPED(2, 'finding decisions')]);
    expect(text).not.toContain('legacy-fingerprint-xyz');
    expect(text).not.toContain('not-an-entity');
    expect(findingRef('legacy-fingerprint-xyz')).toBeNull();
    expect(findingRef(`${fileId}#CX-a-1`)).toBe('src/a.ts#CX-a-1');
  });

  it('leaves out a file work item whose entity id does not parse, counts it, and never leaks the repository id (V12)', () => {
    // Two NUL-joined parts, not three: entityPath's fallback would have written "repo-xyz/src/b.ts".
    const broken = [REPO, 'src/b.ts'].join(String.fromCharCode(0));
    const text = reviewStateJson(input({
      workItems: [item('wi-1', { kind: 'file', entityId: broken }), item('wi-2', { kind: 'file', entityId: fileId })],
    }));
    const d = data(text);
    expect((d.workItems as { id: string }[]).map((w) => w.id)).toEqual(['wi-2']);
    expect(d.warnings).toEqual([REVIEW_STATE_SKIPPED(1, 'work items')]);
    expect(text).not.toContain(REPO);
    expect(text).not.toContain(String.fromCharCode(0));
  });
});
```

  In `tests/component/settings-screen.test.ts`:
  - In the "exports the review state as JSON through the leaf document" test, replace `schema: 'codebase-inspector.review-state.v1',` with `schema: 'codebase-inspector.review-state.v2', source: null,`.
  - Add these imports: `import { computeLayout } from '../../src/domain/layout/layout';`, `import { buildSnapshotFixture } from '../fixtures/snapshot-builder';`, `import { repositoryDigest } from '../../src/ui/read-models/review-state';`.
  - Add this test after that one:

```ts
  it('names the codebase on screen by folder and digest only (Part 5 V11)', async () => {
    const snap = buildSnapshotFixture({ files: 4, directories: 1, repositoryId: 'repo-xyz' });
    useCityStore().setCity(snap, computeLayout(snap));
    const w = mountS();
    await w.find('.ci-settings__export').trigger('click');
    const text = vi.mocked(downloadText).mock.calls[0]![2];
    expect((JSON.parse(text) as { source: unknown }).source).toEqual({ folder: 'root', repository: repositoryDigest('repo-xyz') });
    expect(text).not.toContain('repo-xyz');
    expect(text).not.toContain('/fixture/root');
    w.unmount();
  });
```

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/unit/review-state.test.ts tests/component/settings-screen.test.ts`. Expected: FAIL.
  - `reviewStateSource`, `repositoryDigest` and `findingRef` are not exported yet, so their tests fail with `is not a function`.
  - The schema assertions fail with `expected 'codebase-inspector.review-state.v1' to be 'codebase-inspector.review-state.v2'`.
  - The skip tests fail because `legacy-fingerprint-xyz` and `repo-xyz/src/b.ts` are written verbatim today.
  - The Settings test fails because the JSON has no `source`.

- [ ] **Step 3: Add the copy.** In `src/ui/audit-copy/settings.ts`, after the last line (`export const REVIEW_STATE_NOTE = …`), add:

```ts
/** Part 5 V12: one `warnings` entry of the v2 export, per kind of item left out. */
export const REVIEW_STATE_SKIPPED = (n: number, kind: 'work items' | 'finding decisions'): string =>
  `Left out ${plural(n, kind === 'work items' ? 'work item' : 'finding decision', kind)} whose target could not be written as a relative path.`;
```

- [ ] **Step 4: Implement the v2 export.** Replace the whole of `src/ui/read-models/review-state.ts` with:

```ts
// Part 4 W14 / Part 5 V11–V12: the review state as JSON, for downloadText only. Targets
// and findings are written as source-relative paths, never raw entity ids (which carry
// NUL separators and the repository id). v2 adds `source`: the root folder's name (never
// the absolute path) and a digest of the repository id (never the raw id, which is the
// profile UUID). An entity id is converted only with the strict `parseEntityId`; anything
// that does not parse is left out and counted in `warnings`, never written verbatim.
// The import side is review-state-import.ts.
import { parseEntityId, type EntityId } from '../../domain/entity-id';
import type { BoundaryRule, FindingDisposition, WorkItem, WorkTarget } from '../stores/ports/review-repository';
import type { ReportSection } from '../stores/report-store';
import { fnv1a } from '../fixtures/seeded-random';
import { REVIEW_STATE_NOTE, REVIEW_STATE_SKIPPED } from '../inspector-copy';
import { rootFolderLabel } from './root-label';

export const REVIEW_STATE_SCHEMA_V1 = 'codebase-inspector.review-state.v1';
export const REVIEW_STATE_SCHEMA = 'codebase-inspector.review-state.v2';
/** V14: the longest folder label an import accepts, so every export stays importable. */
export const SOURCE_FOLDER_MAX = 255;

export interface ReviewStateSource { folder: string; repository: string }

export interface ReviewStateInput {
  workItems: readonly WorkItem[];
  rules: readonly BoundaryRule[];
  dispositions: readonly FindingDisposition[];
  report: { sections: Readonly<Record<ReportSection, boolean>>; note: string };
  exportedAt: Date;
  /** V11: null when no codebase is on screen. */
  source: ReviewStateSource | null;
}

/** V11: names the codebase without revealing its id. */
export function repositoryDigest(repositoryId: string): string {
  return `fnv1a32:${(fnv1a(repositoryId) >>> 0).toString(16).padStart(8, '0')}`;
}

/** V11: the last path segment only (never the absolute root) and the digest (never the id). */
export function reviewStateSource(snapshot: { repositoryId: string; scope: { rootPath: string } } | null): ReviewStateSource | null {
  if (!snapshot) return null;
  const folder = rootFolderLabel(snapshot.scope.rootPath).slice(0, SOURCE_FOLDER_MAX) || '(root)';
  return { folder, repository: repositoryDigest(snapshot.repositoryId) };
}

/** V12: the strict parse only. `entityPath`'s NUL-to-slash fallback would write the repository id. */
function strictPath(id: EntityId): string | null {
  try { return parseEntityId(id).path; } catch { return null; }
}

const exportedTarget = (t: WorkTarget): Record<string, string> | null => {
  if (t.kind !== 'file') return { ...t };
  const path = strictPath(t.entityId);
  return path === null ? null : { kind: 'file', path };
};

/** Fingerprints are `${entityId}#${ruleScopedId}` (Q2); the rule id never contains '#'.
 *  V12: null when there is no '#' or the entity part does not parse. */
export function findingRef(fingerprint: string): string | null {
  const at = fingerprint.lastIndexOf('#');
  if (at < 0) return null;
  const path = strictPath(fingerprint.slice(0, at));
  return path === null ? null : `${path}#${fingerprint.slice(at + 1)}`;
}

function skippedWarnings(items: number, decisions: number): string[] {
  return [
    ...(items > 0 ? [REVIEW_STATE_SKIPPED(items, 'work items')] : []),
    ...(decisions > 0 ? [REVIEW_STATE_SKIPPED(decisions, 'finding decisions')] : []),
  ];
}

export function reviewStateJson(input: ReviewStateInput): string {
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
  const warnings = skippedWarnings(input.workItems.length - workItems.length, input.dispositions.length - dispositions.length);
  const data = {
    schema: REVIEW_STATE_SCHEMA,
    exportedAt: input.exportedAt.toISOString(),
    note: REVIEW_STATE_NOTE,
    source: input.source === null ? null : { folder: input.source.folder, repository: input.source.repository },
    workItems,
    rules: input.rules.map((r) => ({ id: r.id, from: r.from, to: r.to, rationale: r.rationale, createdAt: r.createdAt })),
    dispositions,
    report: { sections: { ...input.report.sections }, note: input.report.note },
    ...(warnings.length > 0 ? { warnings } : {}),
  };
  return `${JSON.stringify(data, null, 2)}\n`;
}
```

- [ ] **Step 5: Note the digest in the fixture header.** In `src/ui/fixtures/seeded-random.ts`, replace line 1:

```ts
// Deterministic pseudo-randomness for SAMPLE data only. Never used for anything measured.
```

  with:

```ts
// Deterministic pseudo-randomness for SAMPLE data only. Never used for anything measured.
// `fnv1a` also names a codebase in the review-state export (Part 5 V11,
// `repositoryDigest`): that is an identifier, not a measurement.
```

- [ ] **Step 6: Pass the source from Settings.** In `src/ui/screens/SettingsScreen.vue`:
  - Replace:

```ts
import { reviewStateJson } from '../read-models/review-state';
import { useReportStore } from '../stores/report-store';
```

  with:

```ts
import { reviewStateJson, reviewStateSource } from '../read-models/review-state';
import { useCityStore } from '../stores/city-store';
import { useReportStore } from '../stores/report-store';
```

  - Replace `const review = useReviewStore();` with `const city = useCityStore();` on one line, then `const review = useReviewStore();` on the next.
  - Replace:

```ts
/** W14: JSON through the leaf's own document only; relative paths, never raw entity ids. */
function exportState(): void {
  exportText(SETTINGS_JSON_FILENAME, () => reviewStateJson({
    workItems: review.workItems, rules: review.rules, dispositions: review.dispositions,
    report: { sections: report.sections, note: report.note }, exportedAt: new Date(),
  }), JSON_MIME);
}
```

  with:

```ts
/** W14 / Part 5 V11: JSON through the leaf's own document only; relative paths, never raw
 *  entity ids; the source names the folder and a digest, never the absolute root or the id. */
function exportState(): void {
  exportText(SETTINGS_JSON_FILENAME, () => reviewStateJson({
    workItems: review.workItems, rules: review.rules, dispositions: review.dispositions,
    report: { sections: report.sections, note: report.note }, exportedAt: new Date(),
    source: reviewStateSource(city.snapshot),
  }), JSON_MIME);
}
```

- [ ] **Step 7: Run and confirm it passes.** Run `npx vitest run tests/unit/review-state.test.ts tests/component/settings-screen.test.ts tests/unit/sample-signals.test.ts`, then the gate. Also run `grep -rn "reviewStateJson(" src tests` and check that every call passes `source`. `tsc` enforces this.
- [ ] **Step 8: Commit.** `feat(ui): review-state export v2 with a source digest; never write an unparseable entity id (V11, V12)`

---

### Task 8: Import parser, `replaceAll` and `report.restore` (V14, V16 store part)

**Files:**
- Create: `src/ui/read-models/review-state-import.ts` (~185)
- Modify: `src/ui/stores/review-store.ts` (~318 → ~350). If it exceeds 380, move `maxSuffix`, `isRejected`, `ReviewBucket` and `newBucket` unchanged into a new `src/ui/stores/review-buckets.ts` (pure helpers, exported), import them back, and report it.
- Modify: `src/ui/stores/report-store.ts` (~50 → ~56)
- Create: `tests/fixtures/review-state-doc.ts` (~70)
- Create: `tests/unit/review-state-import.test.ts` (~190), `tests/unit/review-state-import-rules.test.ts` (~130), `tests/unit/review-replace-all.test.ts` (~115)

**Interfaces:**
- Consumes (Task 7): `REVIEW_STATE_SCHEMA`, `REVIEW_STATE_SCHEMA_V1`, `SOURCE_FOLDER_MAX`, `repositoryDigest`, `reviewStateJson`, `reviewStateSource`.
- Consumes (existing): `makeEntityId`, `normalizeRelativePath` (`src/domain/path-safety.ts`), `workItemProblem`, `WORK_TITLE_MAX`, `WORK_NOTES_MAX`, `DISMISS_REASON_MAX`, `REPORT_NOTE_MAX`.
- Produces (in `src/ui/read-models/review-state-import.ts`):
  - `type ImportErrorCode = 'too-large' | 'not-json' | 'unknown-schema' | 'invalid' | 'other-codebase'`.
  - `interface ImportedReviewState { workItems: WorkItem[]; rules: BoundaryRule[]; dispositions: FindingDisposition[]; report: { sections: Record<ReportSection, boolean>; note: string }; origin: { folder: string } | null }`.
  - `type ImportResult = { ok: true; state: ImportedReviewState } | { ok: false; code: ImportErrorCode; detail: string }`.
  - `type ReadResult = ImportResult | { ok: false; code: 'read-failed'; detail: string }`.
  - `IMPORT_MAX_BYTES = 1_000_000`.
  - `parseReviewState(text: string, current: { repositoryId: string }): ImportResult`.
  - `readReviewStateFile(file: Blob, current: { repositoryId: string }): Promise<ReadResult>`.
- Produces (review store): `interface ReviewReplacement { workItems: readonly WorkItem[]; rules: readonly BoundaryRule[]; dispositions: readonly FindingDisposition[] }` and `useReviewStore().replaceAll(state: ReviewReplacement): Promise<boolean>`.
- Produces (report store): `useReportStore().restore(sections: Readonly<Record<ReportSection, boolean>>, note: string): void`.
- `detail`:
  - for `invalid`, the first zod issue's path joined by `.` (for example `workItems.2.title`); for an unknown key, the key is appended (for example `workItems.0.owner`, or just `extra` at the top level). Clipped to 120 characters.
  - for `other-codebase`, the file's `source.folder`.
  - otherwise `''`.

- [ ] **Step 1: Write the shared fixture.** Create `tests/fixtures/review-state-doc.ts`:

```ts
// Part 5 Task 8: one valid v2 review-state document, built by the real exporter, and the
// helpers the import tests use to break it one field at a time.
import { makeEntityId } from '../../src/domain/entity-id';
import { reviewStateJson, reviewStateSource } from '../../src/ui/read-models/review-state';
import { parseReviewState, type ImportedReviewState } from '../../src/ui/read-models/review-state-import';
import { NO_CHECKS } from '../../src/ui/stores/ports/review-repository';

export const DOC_REPO = 'repo-xyz';
export const DOC_NOW = '2026-09-22T10:00:00.000Z';
export const DOC_SECTIONS = { summary: true, architecture: false, hotspots: true, security: true, plan: true };
export const docFileId = (path: string): string => makeEntityId(DOC_REPO, 'file', path);

/** The document's JSON shape, loose enough for a test to break any field. */
export interface ReviewDoc {
  schema: string;
  source?: { folder: string; repository: string } | null;
  workItems: Record<string, unknown>[];
  rules: Record<string, unknown>[];
  dispositions: Record<string, unknown>[];
  report: { sections: Record<string, unknown>; note: string };
  [key: string]: unknown;
}

export function docText(): string {
  return reviewStateJson({
    workItems: [
      { id: 'wi-1', target: { kind: 'file', entityId: docFileId('src/a.ts') }, intent: 'refactor', title: 'Split the parser', status: 'planned', priority: 'high', notes: 'Start with the lexer.', checks: NO_CHECKS, createdAt: DOC_NOW },
      { id: 'wi-2', target: { kind: 'package', name: '@scope/pkg' }, intent: 'review', title: 'Review the package', status: 'verified', priority: 'low', notes: '', checks: [true, true, true], createdAt: DOC_NOW, updatedAt: DOC_NOW },
      { id: 'wi-3', target: { kind: 'module', module: 'src' }, intent: 'documentation', title: 'Document src', status: 'investigate', priority: 'medium', notes: '', checks: NO_CHECKS, createdAt: DOC_NOW },
    ],
    rules: [{ id: 'AR-001', from: 'ui', to: 'domain', rationale: 'Layering', createdAt: DOC_NOW }],
    dispositions: [
      { fingerprint: `${docFileId('src/a.ts')}#CX-a-1`, status: 'dismissed', reason: 'Generated code', decidedAt: DOC_NOW },
      { fingerprint: `${docFileId('src/b.ts')}#DUP-2`, status: 'acknowledged', decidedAt: DOC_NOW },
    ],
    report: { sections: DOC_SECTIONS, note: 'Confirm the parser boundary.' },
    exportedAt: new Date(DOC_NOW),
    source: reviewStateSource({ repositoryId: DOC_REPO, scope: { rootPath: '/home/dev/shop-api' } }),
  });
}

/** A fresh copy of the document with one change applied. */
export function docWith(change: (doc: ReviewDoc) => void): ReviewDoc {
  const doc = JSON.parse(docText()) as ReviewDoc;
  change(doc);
  return doc;
}

/** The first work item's target, for path edits. */
export const targetOf = (doc: ReviewDoc, index = 0): Record<string, unknown> => doc.workItems[index]!.target as Record<string, unknown>;

/** "accepted", or the refusal as "<code> <detail>" (for example "invalid workItems.0.title"). */
export function outcome(doc: unknown, repositoryId = DOC_REPO): string {
  const result = parseReviewState(JSON.stringify(doc), { repositoryId });
  return result.ok ? 'accepted' : `${result.code} ${result.detail}`.trim();
}

export function accepted(doc: unknown, repositoryId = DOC_REPO): ImportedReviewState {
  const result = parseReviewState(JSON.stringify(doc), { repositoryId });
  if (!result.ok) throw new Error(`refused: ${result.code} ${result.detail}`);
  return result.state;
}
```

- [ ] **Step 2: Write the failing parser tests.** Create `tests/unit/review-state-import.test.ts`:

```ts
// Part 5 V14: the import parser. Top level, schemas, codebase binding, limits, work items.
import { describe, expect, it, vi } from 'vitest';
import { IMPORT_MAX_BYTES, parseReviewState, readReviewStateFile } from '../../src/ui/read-models/review-state-import';
import { REVIEW_STATE_SCHEMA_V1, reviewStateJson, reviewStateSource } from '../../src/ui/read-models/review-state';
import {
  DOC_NOW, DOC_REPO, DOC_SECTIONS, accepted, docFileId, docText, docWith, outcome, targetOf, type ReviewDoc,
} from '../fixtures/review-state-doc';

type Change = (d: ReviewDoc) => void;

describe('review-state import: schemas and codebase (Part 5 V14)', () => {
  it('round-trips the exporter\'s own v2 file, file, package and module targets included (V32)', () => {
    const state = accepted(JSON.parse(docText()));
    expect(state.workItems.map((w) => w.target)).toEqual([
      { kind: 'file', entityId: docFileId('src/a.ts') }, { kind: 'package', name: '@scope/pkg' }, { kind: 'module', module: 'src' },
    ]);
    expect(state.workItems[0]).toEqual({
      id: 'wi-1', target: { kind: 'file', entityId: docFileId('src/a.ts') }, intent: 'refactor', title: 'Split the parser',
      status: 'planned', priority: 'high', notes: 'Start with the lexer.', checks: [false, false, false], createdAt: DOC_NOW,
    });
    expect('updatedAt' in state.workItems[0]!).toBe(false);
    expect(state.workItems[1]!.updatedAt).toBe(DOC_NOW);
    expect(state.rules).toEqual([{ id: 'AR-001', from: 'ui', to: 'domain', rationale: 'Layering', createdAt: DOC_NOW }]);
    expect(state.dispositions).toEqual([
      { fingerprint: `${docFileId('src/a.ts')}#CX-a-1`, status: 'dismissed', reason: 'Generated code', decidedAt: DOC_NOW },
      { fingerprint: `${docFileId('src/b.ts')}#DUP-2`, status: 'acknowledged', decidedAt: DOC_NOW },
    ]);
    expect(state.report).toEqual({ sections: DOC_SECTIONS, note: 'Confirm the parser boundary.' });
    expect(state.origin).toEqual({ folder: 'shop-api' });
    // And back: exporting what was imported writes the same file.
    const again = reviewStateJson({
      workItems: state.workItems, rules: state.rules, dispositions: state.dispositions, report: state.report,
      exportedAt: new Date(DOC_NOW), source: reviewStateSource({ repositoryId: DOC_REPO, scope: { rootPath: '/home/dev/shop-api' } }),
    });
    expect(again).toBe(docText());
  });

  it('accepts v1 (no source) with an unknown origin, and refuses a v1 file that carries a source', () => {
    expect(accepted(docWith((d) => { d.schema = REVIEW_STATE_SCHEMA_V1; delete d.source; })).origin).toBeNull();
    expect(outcome(docWith((d) => { d.schema = REVIEW_STATE_SCHEMA_V1; }))).toBe('invalid source');
  });

  it('accepts v2 exported with no codebase on screen (source null) with an unknown origin', () => {
    expect(accepted(docWith((d) => { d.source = null; })).origin).toBeNull();
  });

  it('refuses a v2 file from another codebase, naming its folder (Part 4 E8/E11)', () => {
    expect(outcome(JSON.parse(docText()), 'repo-other')).toBe('other-codebase shop-api');
  });

  it('refuses text over 1 MB, text that is not JSON, and JSON that is not a known schema', () => {
    expect(parseReviewState(' '.repeat(IMPORT_MAX_BYTES + 1), { repositoryId: DOC_REPO })).toEqual({ ok: false, code: 'too-large', detail: '' });
    for (const text of ['{', '', 'undefined']) expect(parseReviewState(text, { repositoryId: DOC_REPO }), text).toMatchObject({ ok: false, code: 'not-json' });
    for (const doc of [null, [], 'text', {}, docWith((d) => { d.schema = 'codebase-inspector.review-state.v3'; })]) {
      expect(outcome(doc), JSON.stringify(doc).slice(0, 40)).toBe('unknown-schema');
    }
  });

  it('reads a picked file only when it is at most 1 MB, and reports a failed read', async () => {
    const text = vi.fn(() => Promise.resolve('{}'));
    expect(await readReviewStateFile({ size: IMPORT_MAX_BYTES + 1, text } as unknown as Blob, { repositoryId: DOC_REPO })).toMatchObject({ ok: false, code: 'too-large' });
    expect(text).not.toHaveBeenCalled();
    const failing = { size: 10, text: () => Promise.reject(new Error('gone')) } as unknown as Blob;
    expect(await readReviewStateFile(failing, { repositoryId: DOC_REPO })).toEqual({ ok: false, code: 'read-failed', detail: '' });
    expect((await readReviewStateFile(new Blob([docText()]), { repositoryId: DOC_REPO })).ok).toBe(true);
  });

  it.each<[string, Change, string]>([
    ['at the top level', (d) => { d.extra = 1; }, 'invalid extra'],
    ['in a work item', (d) => { d.workItems[0]!.owner = 'x'; }, 'invalid workItems.0.owner'],
    ['in a target', (d) => { targetOf(d).entityId = 'x'; }, 'invalid workItems.0.target.entityId'],
    ['in a rule', (d) => { d.rules[0]!.severity = 'high'; }, 'invalid rules.0.severity'],
    ['in a decision', (d) => { d.dispositions[0]!.by = 'x'; }, 'invalid dispositions.0.by'],
    ['in the report', (d) => { d.report.sections.extra = true; }, 'invalid report.sections.extra'],
    ['in the source', (d) => { (d.source as Record<string, unknown>).path = '/abs'; }, 'invalid source.path'],
  ])('refuses an unknown key %s', (_name, change, expected) => {
    expect(outcome(docWith(change))).toBe(expected);
  });

  it('refuses a malformed exportedAt or top-level note', () => {
    expect(outcome(docWith((d) => { d.exportedAt = 'yesterday'; }))).toBe('invalid exportedAt');
    expect(outcome(docWith((d) => { d.note = 'x'.repeat(501); }))).toBe('invalid note');
  });
});

describe('review-state import: work items (Part 5 V14)', () => {
  it.each<[string, Change, string]>([
    ['an id that is not wi-<digits>', (d) => { d.workItems[0]!.id = 'wi-abc'; }, 'invalid workItems.0.id'],
    ['an id with seven digits', (d) => { d.workItems[0]!.id = 'wi-1234567'; }, 'invalid workItems.0.id'],
    ['a duplicate id', (d) => { d.workItems[1]!.id = 'wi-1'; }, 'invalid workItems.1.id'],
    ['an unknown target kind', (d) => { d.workItems[0]!.target = { kind: 'repo', path: 'x' }; }, 'invalid workItems.0.target.kind'],
    ['a package name over 214', (d) => { targetOf(d, 1).name = 'p'.repeat(215); }, 'invalid workItems.1.target.name'],
    ['a module name over 255', (d) => { targetOf(d, 2).module = 'm'.repeat(256); }, 'invalid workItems.2.target.module'],
    ['an unknown intent', (d) => { d.workItems[0]!.intent = 'rewrite'; }, 'invalid workItems.0.intent'],
    ['a blank title', (d) => { d.workItems[0]!.title = '   '; }, 'invalid workItems.0.title'],
    ['a title over 160 after trimming', (d) => { d.workItems[0]!.title = `  ${'t'.repeat(161)}  `; }, 'invalid workItems.0.title'],
    ['an unknown status', (d) => { d.workItems[0]!.status = 'done'; }, 'invalid workItems.0.status'],
    ['an unknown priority', (d) => { d.workItems[0]!.priority = 'urgent'; }, 'invalid workItems.0.priority'],
    ['notes over 5000', (d) => { d.workItems[0]!.notes = 'n'.repeat(5001); }, 'invalid workItems.0.notes'],
    ['two checks', (d) => { d.workItems[0]!.checks = [true, false]; }, 'invalid workItems.0.checks'],
    ['four checks', (d) => { d.workItems[0]!.checks = [true, false, true, true]; }, 'invalid workItems.0.checks'],
    ['a check that is not a boolean', (d) => { d.workItems[0]!.checks = [true, 'yes', false]; }, 'invalid workItems.0.checks.1'],
    ['a createdAt that is not ISO', (d) => { d.workItems[0]!.createdAt = '22/09/2026'; }, 'invalid workItems.0.createdAt'],
    ['an updatedAt that is not ISO', (d) => { d.workItems[1]!.updatedAt = 'later'; }, 'invalid workItems.1.updatedAt'],
    ['Verified without all three checks (the Verified guard)', (d) => { d.workItems[1]!.checks = [true, true, false]; }, 'invalid workItems.1.status'],
    ['a second item for the same target and intent', (d) => { d.workItems[2]!.target = { kind: 'file', path: 'src/a.ts' }; d.workItems[2]!.intent = 'refactor'; }, 'invalid workItems.2.target'],
  ])('refuses %s', (_name, change, expected) => {
    expect(outcome(docWith(change))).toBe(expected);
  });

  it('refuses more than 2000 work items', () => {
    const doc = docWith((d) => {
      const first = d.workItems[0]!;
      d.workItems = Array.from({ length: 2001 }, (_, i) => ({ ...first, id: `wi-${i + 1}`, target: { kind: 'file', path: `f${i}.ts` } }));
    });
    expect(outcome(doc)).toBe('invalid workItems');
  });

  it('keeps the same target under two different intents', () => {
    expect(outcome(docWith((d) => { d.workItems[2]!.target = { kind: 'file', path: 'src/a.ts' }; }))).toBe('accepted');
  });
});
```

  Create `tests/unit/review-state-import-rules.test.ts`:

```ts
// Part 5 V14/V15: the import parser. Rules, decisions, paths, report, source, warnings,
// and imported text staying plain text.
import { describe, expect, it } from 'vitest';
import { accepted, docWith, outcome, targetOf, type ReviewDoc } from '../fixtures/review-state-doc';

const NUL = String.fromCharCode(0);
type Change = (d: ReviewDoc) => void;

describe('review-state import: rules and decisions (Part 5 V14)', () => {
  it.each<[string, Change, string]>([
    ['a rule id that is not AR-<3–6 digits>', (d) => { d.rules[0]!.id = 'AR-1'; }, 'invalid rules.0.id'],
    ['a rule from a module to itself', (d) => { d.rules[0]!.to = 'ui'; }, 'invalid rules.0.to'],
    ['an empty from', (d) => { d.rules[0]!.from = ''; }, 'invalid rules.0.from'],
    ['a to over 255', (d) => { d.rules[0]!.to = 'm'.repeat(256); }, 'invalid rules.0.to'],
    ['a blank rationale', (d) => { d.rules[0]!.rationale = '  '; }, 'invalid rules.0.rationale'],
    ['a rationale over 1000', (d) => { d.rules[0]!.rationale = 'r'.repeat(1001); }, 'invalid rules.0.rationale'],
    ['a rule createdAt that is not ISO', (d) => { d.rules[0]!.createdAt = 'now'; }, 'invalid rules.0.createdAt'],
    ['a duplicate rule id', (d) => { d.rules.push({ ...d.rules[0]!, to: 'api' }); }, 'invalid rules.1.id'],
    ['a duplicate rule pair', (d) => { d.rules.push({ ...d.rules[0]!, id: 'AR-002' }); }, 'invalid rules.1.to'],
    ['more than 500 rules', (d) => {
      const first = d.rules[0]!;
      d.rules = Array.from({ length: 501 }, (_, i) => ({ ...first, id: `AR-${String(i + 1).padStart(3, '0')}`, to: `m${i}` }));
    }, 'invalid rules'],
    ['a finding without "#"', (d) => { d.dispositions[0]!.finding = 'src/a.ts'; }, 'invalid dispositions.0.finding'],
    ['a finding id with a space', (d) => { d.dispositions[0]!.finding = 'src/a.ts#CX a'; }, 'invalid dispositions.0.finding'],
    ['a finding id over 64', (d) => { d.dispositions[0]!.finding = `src/a.ts#${'x'.repeat(65)}`; }, 'invalid dispositions.0.finding'],
    ['an unknown decision status', (d) => { d.dispositions[0]!.status = 'open'; }, 'invalid dispositions.0.status'],
    ['a dismissal without a reason', (d) => { delete d.dispositions[0]!.reason; }, 'invalid dispositions.0.reason'],
    ['a dismissal with a blank reason', (d) => { d.dispositions[0]!.reason = '   '; }, 'invalid dispositions.0.reason'],
    ['a dismissal reason over 1000', (d) => { d.dispositions[0]!.reason = 'r'.repeat(1001); }, 'invalid dispositions.0.reason'],
    ['an acknowledgement with a reason', (d) => { d.dispositions[1]!.reason = 'why'; }, 'invalid dispositions.1.reason'],
    ['a decidedAt that is not ISO', (d) => { d.dispositions[0]!.decidedAt = 'today'; }, 'invalid dispositions.0.decidedAt'],
    ['a duplicate finding', (d) => { d.dispositions[1]!.finding = d.dispositions[0]!.finding; }, 'invalid dispositions.1.finding'],
    ['more than 5000 decisions', (d) => {
      const first = d.dispositions[1]!;
      d.dispositions = Array.from({ length: 5001 }, (_, i) => ({ ...first, finding: `f${i}.ts#X-1` }));
    }, 'invalid dispositions'],
  ])('refuses %s', (_name, change, expected) => {
    expect(outcome(docWith(change))).toBe(expected);
  });
});

describe('review-state import: paths (Part 5 V14)', () => {
  const BAD = ['../etc/passwd', 'src/../../x', 'src/..', '/etc/passwd', '\\\\server\\share', 'C:/x', 'c:x', 'src\\a.ts', '', `src/a${NUL}.ts`, 'p'.repeat(1025)];
  it.each(BAD)('refuses the file target path %j', (path) => {
    expect(outcome(docWith((d) => { targetOf(d).path = path; }))).toBe('invalid workItems.0.target.path');
  });
  it.each(BAD)('refuses the finding path %j', (path) => {
    expect(outcome(docWith((d) => { d.dispositions[0]!.finding = `${path}#CX-1`; }))).toBe('invalid dispositions.0.finding');
  });
  it('accepts a nested relative path and a path that contains "#"', () => {
    const state = accepted(docWith((d) => { targetOf(d).path = 'src/deep/a.b.ts'; d.dispositions[0]!.finding = 'docs/c#sharp.md#CX-1'; }));
    expect(state.dispositions[0]!.fingerprint.endsWith('#CX-1')).toBe(true);
  });
});

describe('review-state import: report, source and warnings (Part 5 V14)', () => {
  it.each<[string, Change, string]>([
    ['a missing section', (d) => { delete d.report.sections.plan; }, 'invalid report.sections.plan'],
    ['a section that is not a boolean', (d) => { d.report.sections.summary = 'yes'; }, 'invalid report.sections.summary'],
    ['a report note over 5000', (d) => { d.report.note = 'n'.repeat(5001); }, 'invalid report.note'],
    ['a malformed repository digest', (d) => { d.source = { folder: 'shop-api', repository: 'fnv1a32:XYZ' }; }, 'invalid source.repository'],
    ['a raw repository id as the digest', (d) => { d.source = { folder: 'shop-api', repository: 'repo-xyz' }; }, 'invalid source.repository'],
    ['an empty folder', (d) => { d.source = { folder: '', repository: 'fnv1a32:0123abcd' }; }, 'invalid source.folder'],
    ['a folder over 255', (d) => { d.source = { folder: 'f'.repeat(256), repository: 'fnv1a32:0123abcd' }; }, 'invalid source.folder'],
    ['more than 20 warnings', (d) => { d.warnings = Array.from({ length: 21 }, () => 'w'); }, 'invalid warnings'],
    ['a warning over 200', (d) => { d.warnings = ['w'.repeat(201)]; }, 'invalid warnings.0'],
  ])('refuses %s', (_name, change, expected) => {
    expect(outcome(docWith(change))).toBe(expected);
  });

  it('ignores the top-level note and up to 20 warnings', () => {
    expect(outcome(docWith((d) => { d.note = 'anything'; d.warnings = ['Left out 1 work item.']; }))).toBe('accepted');
  });

  it('keeps an HTML-looking title as plain text: it is data, never markup (V15)', () => {
    const title = '<img src=x onerror=alert(1)>';
    expect(accepted(docWith((d) => { d.workItems[0]!.title = title; })).workItems[0]!.title).toBe(title);
  });
});
```

- [ ] **Step 3: Write the failing store tests.** Create `tests/unit/review-replace-all.test.ts`:

```ts
// Part 5 V16: replacing the whole review state with an imported one, and the report's restore.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useReportStore } from '../../src/ui/stores/report-store';
import {
  NO_CHECKS, createInMemoryReviewRepository, type BoundaryRule, type FindingDisposition, type WorkItem,
} from '../../src/ui/stores/ports/review-repository';

const NOW = new Date('2026-09-22T10:00:00.000Z');
const AT = NOW.toISOString();
const ITEMS: WorkItem[] = [
  { id: 'wi-12', target: { kind: 'module', module: 'src' }, intent: 'documentation', title: 'Document src', status: 'planned', priority: 'low', notes: '', checks: NO_CHECKS, createdAt: AT },
  { id: 'wi-4', target: { kind: 'package', name: '@scope/pkg' }, intent: 'review', title: 'Review pkg', status: 'verified', priority: 'high', notes: 'ok', checks: [true, true, true], createdAt: AT, updatedAt: AT },
];
const RULES: BoundaryRule[] = [{ id: 'AR-007', from: 'ui', to: 'domain', rationale: 'Layering', createdAt: AT }];
const DECISIONS: FindingDisposition[] = [{ fingerprint: 'imported-fp', status: 'dismissed', reason: 'Generated', decidedAt: AT }];
const IMPORTED = { workItems: ITEMS, rules: RULES, dispositions: DECISIONS };
const hang = (): Promise<void> => new Promise<void>(() => {});
type Store = ReturnType<typeof useReviewStore>;

async function seeded(store: Store): Promise<void> {
  await store.addWorkItem({ kind: 'package', name: 'old' }, 'review', 'Old item', NOW);
  await store.addRule('a', 'b', 'Old rule', NOW);
  await store.acknowledge('old-fp', NOW);
}

describe('review store replaceAll (Part 5 V16)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('replaces every item, rule and decision through the port, and new ids continue after the imported ones', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    await seeded(store);
    expect(await store.replaceAll(IMPORTED)).toBe(true);
    expect(store.workItems).toEqual(ITEMS);
    expect(store.rules).toEqual(RULES);
    expect(store.dispositions).toEqual(DECISIONS);
    expect(await repo.listWorkItems()).toEqual(ITEMS);
    expect(await repo.listRules()).toEqual(RULES);
    expect(await repo.listDispositions()).toEqual(DECISIONS);
    expect((await store.addWorkItem({ kind: 'package', name: 'new' }, 'review', 'New', NOW))?.id).toBe('wi-13');
    expect((await store.addRule('x', 'y', 'New rule', NOW))?.id).toBe('AR-008');
  });

  it('keeps an imported item whose id a current item already had: removals finish before saves start', async () => {
    const store = useReviewStore();
    await store.addWorkItem({ kind: 'package', name: 'old' }, 'review', 'Old item', NOW);
    expect(await store.replaceAll({ workItems: [{ ...ITEMS[0]!, id: 'wi-1' }], rules: [], dispositions: [] })).toBe(true);
    expect(store.workItems.map((w) => [w.id, w.title])).toEqual([['wi-1', 'Document src']]);
    expect(await store.repository.listWorkItems()).toHaveLength(1);
  });

  it.each<[string, (s: Store) => void]>([
    ['a new work item', (s) => { void s.addWorkItem({ kind: 'package', name: 'slow' }, 'review', 'Slow', NOW); }],
    ['a rule', (s) => { void s.addRule('p', 'q', 'Slow', NOW); }],
    ['a decision', (s) => { void s.acknowledge('slow-fp', NOW); }],
  ])('refuses (false) and changes nothing while %s is still saving', async (_name, start) => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository({ ...repo, saveWorkItem: hang, saveRule: hang, saveDisposition: hang });
    start(store);
    expect(await store.replaceAll(IMPORTED)).toBe(false);
    expect(await repo.listWorkItems()).toEqual([]);
    expect(await repo.listRules()).toEqual([]);
    expect(await repo.listDispositions()).toEqual([]);
  });

  it('refuses (false) while an update is in flight', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepository(repo);
    const item = await store.addWorkItem({ kind: 'package', name: 'p' }, 'review', 'P', NOW);
    store.setRepository({ ...repo, saveWorkItem: hang });
    void store.updateWorkItem(item!.id, { title: 'Renamed' }, NOW);
    expect(await store.replaceAll(IMPORTED)).toBe(false);
    expect(store.workItems.map((w) => w.title)).toEqual(['P']);
  });

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
});

describe('report store restore (Part 5 V16)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('takes the imported sections and note for the bound codebase, and keeps them across a round trip', () => {
    const report = useReportStore();
    report.bindRepository('repo-a');
    const sections = { summary: false, architecture: true, hotspots: true, security: false, plan: true };
    report.restore(sections, 'Imported note.');
    expect(report.sections).toEqual(sections);
    expect(report.note).toBe('Imported note.');
    report.bindRepository('repo-b');
    report.bindRepository('repo-a');
    expect(report.note).toBe('Imported note.');
    expect(report.sections).toEqual(sections);
  });
});
```

- [ ] **Step 4: Run them and confirm they fail.** Run `npx vitest run tests/unit/review-state-import.test.ts tests/unit/review-state-import-rules.test.ts tests/unit/review-replace-all.test.ts`. Expected: FAIL.
  - Both import files fail to load with `Failed to resolve import "../../src/ui/read-models/review-state-import"` (the fixture imports it).
  - `review-replace-all` fails with `TypeError: store.replaceAll is not a function` and `report.restore is not a function`.

- [ ] **Step 5: Implement the parser.** Create `src/ui/read-models/review-state-import.ts`:

```ts
// Part 5 V14: the review-state import parser. Pure: the picked file's text in, a typed
// state or ONE refusal out. Everything in the file is untrusted input:
// - every object is strict, so an unknown key at any level is refused;
// - every string and array is bounded;
// - the store's own validity rule (`workItemProblem`) and every uniqueness rule run
//   before anything reaches the store.
// File paths become entity ids of the codebase on screen (V16), and a v2 file from
// another codebase is refused (Part 4 E8/E11). The only input is the text of the file the
// user picked (V13); nothing is read from the vault. zod 4 conventions as in
// src/domain/validator.ts (`error.issues`, `.strict()`, `{ error: '…' }`).
import { z } from 'zod';
import { makeEntityId } from '../../domain/entity-id';
import { normalizeRelativePath } from '../../domain/path-safety';
import {
  DISMISS_REASON_MAX, WORK_NOTES_MAX, WORK_TITLE_MAX, workItemProblem,
  type BoundaryRule, type FindingDisposition, type WorkItem, type WorkTarget,
} from '../stores/ports/review-repository';
import { REPORT_NOTE_MAX, type ReportSection } from '../stores/report-store';
import { REVIEW_STATE_SCHEMA, REVIEW_STATE_SCHEMA_V1, SOURCE_FOLDER_MAX, repositoryDigest } from './review-state';

export type ImportErrorCode = 'too-large' | 'not-json' | 'unknown-schema' | 'invalid' | 'other-codebase';
export interface ImportedReviewState {
  workItems: WorkItem[];
  rules: BoundaryRule[];
  dispositions: FindingDisposition[];
  report: { sections: Record<ReportSection, boolean>; note: string };
  /** The exporting codebase's folder label. Null for v1, and for v2 exported with no codebase on screen. */
  origin: { folder: string } | null;
}
export type ImportResult = { ok: true; state: ImportedReviewState } | { ok: false; code: ImportErrorCode; detail: string };
/** Reading a picked file adds one more refusal: the file itself could not be read. */
export type ReadResult = ImportResult | { ok: false; code: 'read-failed'; detail: string };

/** V14: 1 MB, checked with `File.size` before reading and with the text length after. */
export const IMPORT_MAX_BYTES = 1_000_000;
const PATH_MAX = 1024;
const DETAIL_MAX = 120;
const FINDING_ID = /^[A-Za-z0-9-]{1,64}$/;

/** V14: relative (no leading `/` or `\`, no drive letter), no `..` segment, no NUL and no
 *  backslash. `normalizeRelativePath` is the scanner's own rule, and it is stricter still:
 *  it also refuses empty and `.` segments and every control character, which a scanned
 *  path never has. */
function isRelativePath(path: string): boolean {
  if (path.includes('\\')) return false;
  try {
    normalizeRelativePath(path);
    return true;
  } catch {
    return false;
  }
}

/** `<path>#<findingId>`; the finding id never contains '#', so the last one splits. */
function splitFinding(ref: string): { path: string; findingId: string } | null {
  const at = ref.lastIndexOf('#');
  if (at < 0) return null;
  const path = ref.slice(0, at);
  const findingId = ref.slice(at + 1);
  return path.length <= PATH_MAX && isRelativePath(path) && FINDING_ID.test(findingId) ? { path, findingId } : null;
}

/** Indexes of entries whose key an earlier entry already had. */
function duplicateIndexes<T>(entries: readonly T[], key: (entry: T) => string): number[] {
  const seen = new Set<string>();
  const duplicates: number[] = [];
  entries.forEach((entry, index) => {
    const k = key(entry);
    if (seen.has(k)) duplicates.push(index);
    else seen.add(k);
  });
  return duplicates;
}

const trimmedBetween = (min: number, max: number) => z.string().refine((s) => {
  const n = s.trim().length;
  return n >= min && n <= max;
}, { error: `Must be ${min}–${max} characters after trimming.` });

const ISO = z.iso.datetime();
const PATH = z.string().min(1).max(PATH_MAX).refine(isRelativePath, { error: 'Must be a relative path inside the codebase.' });

const TARGET = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('file'), path: PATH }).strict(),
  z.object({ kind: z.literal('package'), name: z.string().min(1).max(214) }).strict(),
  z.object({ kind: z.literal('module'), module: z.string().min(1).max(255) }).strict(),
]);
type ImportedTarget = z.output<typeof TARGET>;
const targetKey = (t: ImportedTarget): string => JSON.stringify([t.kind, t.kind === 'file' ? t.path : t.kind === 'package' ? t.name : t.module]);

/** Which field each `workItemProblem` answer is about. */
const PROBLEM_FIELD = { 'title-empty': 'title', 'title-long': 'title', 'notes-long': 'notes', unverified: 'status' } as const;

const WORK_ITEM = z.object({
  id: z.string().regex(/^wi-\d{1,6}$/),
  target: TARGET,
  intent: z.enum(['refactor', 'tests', 'review', 'pairing', 'documentation']),
  title: trimmedBetween(1, WORK_TITLE_MAX),
  status: z.enum(['investigate', 'planned', 'in-progress', 'verified']),
  priority: z.enum(['high', 'medium', 'low']),
  notes: z.string().max(WORK_NOTES_MAX),
  checks: z.tuple([z.boolean(), z.boolean(), z.boolean()]),
  createdAt: ISO,
  updatedAt: ISO.optional(),
}).strict().superRefine((item, ctx) => {
  // The store's own rule: `verified` needs all three checks (Part 4 W9).
  const problem = workItemProblem(item);
  if (problem !== null) ctx.addIssue({ code: 'custom', path: [PROBLEM_FIELD[problem]], message: `The store refuses this item (${problem}).` });
});
const WORK_ITEMS = z.array(WORK_ITEM).max(2000).superRefine((items, ctx) => {
  for (const i of duplicateIndexes(items, (w) => w.id)) ctx.addIssue({ code: 'custom', path: [i, 'id'], message: 'Duplicate work item id.' });
  for (const i of duplicateIndexes(items, (w) => `${targetKey(w.target)}:${w.intent}`)) {
    ctx.addIssue({ code: 'custom', path: [i, 'target'], message: 'A second work item for the same target and intent.' });
  }
});

const RULE = z.object({
  id: z.string().regex(/^AR-\d{3,6}$/),
  from: z.string().min(1).max(255),
  to: z.string().min(1).max(255),
  rationale: trimmedBetween(1, 1000),
  createdAt: ISO,
}).strict().refine((r) => r.from !== r.to, { error: 'A rule needs two different modules.', path: ['to'] });
const RULES = z.array(RULE).max(500).superRefine((rules, ctx) => {
  for (const i of duplicateIndexes(rules, (r) => r.id)) ctx.addIssue({ code: 'custom', path: [i, 'id'], message: 'Duplicate rule id.' });
  for (const i of duplicateIndexes(rules, (r) => JSON.stringify([r.from, r.to]))) ctx.addIssue({ code: 'custom', path: [i, 'to'], message: 'Duplicate rule.' });
});

const DISPOSITION = z.object({
  finding: z.string().max(PATH_MAX + 65).refine((f) => splitFinding(f) !== null, { error: 'Must be <relative path>#<finding id>.' }),
  status: z.enum(['acknowledged', 'dismissed']),
  reason: z.string().optional(),
  decidedAt: ISO,
}).strict().superRefine((d, ctx) => {
  const length = d.reason === undefined ? 0 : d.reason.trim().length;
  if (d.status === 'dismissed' && (length < 1 || length > DISMISS_REASON_MAX)) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: 'A dismissal needs a reason.' });
  }
  if (d.status === 'acknowledged' && d.reason !== undefined) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: 'An acknowledgement carries no reason.' });
  }
});
const DISPOSITIONS = z.array(DISPOSITION).max(5000).superRefine((ds, ctx) => {
  for (const i of duplicateIndexes(ds, (d) => d.finding)) ctx.addIssue({ code: 'custom', path: [i, 'finding'], message: 'Duplicate decision.' });
});

const REPORT = z.object({
  sections: z.object({
    summary: z.boolean(), architecture: z.boolean(), hotspots: z.boolean(), security: z.boolean(), plan: z.boolean(),
  }).strict(),
  note: z.string().max(REPORT_NOTE_MAX),
}).strict();

const COMMON = {
  exportedAt: ISO,
  note: z.string().max(500),
  workItems: WORK_ITEMS,
  rules: RULES,
  dispositions: DISPOSITIONS,
  report: REPORT,
};
const V1 = z.object({ schema: z.literal(REVIEW_STATE_SCHEMA_V1), ...COMMON }).strict();
const V2 = z.object({
  schema: z.literal(REVIEW_STATE_SCHEMA),
  ...COMMON,
  source: z.object({
    folder: z.string().min(1).max(SOURCE_FOLDER_MAX),
    repository: z.string().regex(/^fnv1a32:[0-9a-f]{8}$/),
  }).strict().nullable(),
  warnings: z.array(z.string().max(200)).max(20).optional(),
}).strict();
type Parsed = z.output<typeof V1> | z.output<typeof V2>;

const refused = (code: ImportErrorCode, detail = ''): ImportResult => ({ ok: false, code, detail });

/** V15: the first issue's path, joined by '.' (for example "workItems.2.title"). An
 *  unknown key is named too, so the reader can find it. */
function issueDetail(issue: z.core.$ZodIssue | undefined): string {
  if (!issue) return '';
  const path = issue.path.map((p) => String(p));
  if (issue.code === 'unrecognized_keys' && issue.keys[0] !== undefined) path.push(issue.keys[0]);
  return path.join('.').slice(0, DETAIL_MAX);
}

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

/** V14: strict parse of a review-state file for the codebase on screen. */
export function parseReviewState(text: string, current: { repositoryId: string }): ImportResult {
  if (text.length > IMPORT_MAX_BYTES) return refused('too-large');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return refused('not-json');
  }
  const schema = typeof raw === 'object' && raw !== null && 'schema' in raw ? raw.schema : undefined;
  if (schema !== REVIEW_STATE_SCHEMA && schema !== REVIEW_STATE_SCHEMA_V1) return refused('unknown-schema');
  const parsed = schema === REVIEW_STATE_SCHEMA ? V2.safeParse(raw) : V1.safeParse(raw);
  if (!parsed.success) return refused('invalid', issueDetail(parsed.error.issues[0]));
  const source = parsed.data.schema === REVIEW_STATE_SCHEMA ? parsed.data.source : null;
  if (source !== null && source.repository !== repositoryDigest(current.repositoryId)) return refused('other-codebase', source.folder);
  return { ok: true, state: toState(parsed.data, current.repositoryId, source === null ? null : { folder: source.folder }) };
}

/** V13/V14: reads the picked file, and only it. A file over 1 MB is refused before it is read. */
export async function readReviewStateFile(file: Blob, current: { repositoryId: string }): Promise<ReadResult> {
  if (file.size > IMPORT_MAX_BYTES) return refused('too-large');
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, code: 'read-failed', detail: '' };
  }
  return parseReviewState(text, current);
}
```

  Two zod behaviours this relies on, both checked against the installed zod 4.6.5:
  - An object's `superRefine` does not run when a field failed with a type error. It does run after a refine failure or an unknown key, so `workItemProblem` only ever sees well-typed items.
  - `z.iso.datetime()` accepts `2026-09-22T10:00:00.000Z` and `2026-09-22T10:00:00Z`. It refuses offsets and non-ISO text. `toISOString()` always writes `Z`.

- [ ] **Step 6: Implement `replaceAll`.** In `src/ui/stores/review-store.ts`:

  (a) Export the replacement type. Replace:

```ts
const newBucket = (): ReviewBucket => ({ repository: markRaw(createInMemoryReviewRepository()), nextId: 1, nextRuleId: 1 });
```

  with:

```ts
const newBucket = (): ReviewBucket => ({ repository: markRaw(createInMemoryReviewRepository()), nextId: 1, nextRuleId: 1 });

/** Part 5 V16: a whole review state to replace the bound codebase's with (an import). */
export interface ReviewReplacement {
  workItems: readonly WorkItem[];
  rules: readonly BoundaryRule[];
  dispositions: readonly FindingDisposition[];
}
```

  (b) Add the action after `clearAll`. Replace:

```ts
      const rejected = results.find(isRejected);
      if (rejected) throw rejected.reason;
    },
    /** Part 2 P5. Same reservation and persist-first ordering as `addWorkItem`.
```

  with:

```ts
      const rejected = results.find(isRejected);
      if (rejected) throw rejected.reason;
    },
    /** Part 5 V16: replaces the whole review state with an imported one. Refused (false)
     *  while any save, update or removal is in flight, so nothing half-applied races it.
     *  Removes every current item, rule and decision through the port, then saves every
     *  imported one (persist-first; `allSettled` in both phases, so one rejection does not
     *  stop the rest). The removals finish before the saves start, so an imported id that
     *  a current item already had is saved, not deleted. Reloads in `finally`, so the
     *  lists show exactly what the port holds (the id counters move past every imported
     *  id), then rethrows the first rejection, like `clearAll`. */
    async replaceAll(state: ReviewReplacement): Promise<boolean> {
      const pending = this.pendingWorkKeys.length + this.pendingItemIds.length + this.pendingRuleKeys.length + this.pendingFingerprints.length;
      if (pending > 0) return false;
      const repo = this.repository;
      let results: PromiseSettledResult<void>[] = [];
      try {
        const removed = await Promise.allSettled([
          ...this.workItems.map((w) => repo.removeWorkItem(w.id)),
          ...this.rules.map((r) => repo.removeRule(r.id)),
          ...this.dispositions.map((d) => repo.removeDisposition(d.fingerprint)),
        ]);
        const saved = await Promise.allSettled([
          ...state.workItems.map((w) => repo.saveWorkItem(w)),
          ...state.rules.map((r) => repo.saveRule(r)),
          ...state.dispositions.map((d) => repo.saveDisposition(d)),
        ]);
        results = [...removed, ...saved];
      } finally {
        if (this.repository === repo) await this.load();
      }
      const rejected = results.find(isRejected);
      if (rejected) throw rejected.reason;
      return true;
    },
    /** Part 2 P5. Same reservation and persist-first ordering as `addWorkItem`.
```

- [ ] **Step 7: Implement `restore`.** In `src/ui/stores/report-store.ts`, replace:

```ts
    reset(): void {
      this.sections = allOn();
      this.note = '';
    },
```

  with:

```ts
    reset(): void {
      this.sections = allOn();
      this.note = '';
    },
    /** Part 5 V16: an imported report's sections and note, for the bound codebase. The
     *  parser has already bounded the note (REPORT_NOTE_MAX). */
    restore(sections: Readonly<Record<ReportSection, boolean>>, note: string): void {
      this.sections = { ...sections };
      this.note = note;
    },
```

- [ ] **Step 8: Run and confirm it passes.** Run `npx vitest run tests/unit/review-state-import.test.ts tests/unit/review-state-import-rules.test.ts tests/unit/review-replace-all.test.ts tests/unit/review-state.test.ts tests/unit/review-per-codebase.test.ts tests/unit/review-store.test.ts tests/unit/report-model.test.ts`, then the gate. Then check the sizes:
  - `wc -l src/ui/stores/review-store.ts`: at most 380, otherwise apply the `review-buckets.ts` move from the Files list.
  - `src/ui/read-models/review-state-import.ts`: at most 400.
  - Each new test file: at most 450.
- [ ] **Step 9: Commit.** `feat(ui): strict review-state import parser; review replaceAll and report restore (V14, V16)`

---

### Task 9: Import UI and settings tab narrowing (V13, V15, V16 UI, V27)

**Files:**
- Create: `src/ui/screens/settings/ImportRow.vue` (~95), `src/ui/screens/settings/ImportReviewDialog.vue` (~95)
- Modify: `src/ui/screens/settings/settings-tabs.ts` (4 → ~12), `src/ui/screens/settings/PrivacyRows.vue` (52 → ~57), `src/ui/screens/settings/SettingsSections.vue` (28 → ~30), `src/ui/screens/SettingsScreen.vue` (~100 → ~112)
- Modify: `src/ui/audit-copy/settings.ts` (~66 → ~95)
- Modify: `src/ui/styles/screens-configure.css` (40 → ~47)
- Test: `tests/component/settings-import.test.ts` (new, ~230), `tests/unit/settings-tabs.test.ts` (new, ~20)

**Interfaces:**
- Consumes:
  - Task 8: `readReviewStateFile`, `ImportedReviewState`, `useReviewStore().replaceAll`, `useReportStore().restore`.
  - Task 7: `reviewStateJson`, `reviewStateSource`, `repositoryDigest`.
  - Task 4: `reannounce(live: Ref<string>, message: string): Promise<void>` from `src/ui/kit/reannounce.ts`.
  - Existing: `useUniqueId`, `CiDialog` (`src/ui/kit/Dialog.vue`).
- Produces:
  - `SETTINGS_TABS = ['appearance', 'analysis', 'accessibility', 'privacy', 'about'] as const`, `type SettingsTab = (typeof SETTINGS_TABS)[number]`, `isSettingsTab(id: string): id is SettingsTab`.
  - `ImportRow.vue` emits `parsed: [state: ImportedReviewState]`. PrivacyRows and SettingsSections forward `parsed`.
  - `ImportReviewDialog.vue` takes `state: ImportedReviewState` and emits `close: []` and `done: [message: string]`.
  - Classes: `ci-settings__import`, `ci-settings__import-hint`, `ci-settings__import-file`, `ci-settings__import-error`, `ci-import-dialog` (+ `__counts`, `__origin`, `__error`, `__actions`, `__cancel`, `__confirm`).
  - Copy in `src/ui/audit-copy/settings.ts` (exact texts in Step 3): `SETTINGS_IMPORT`, `SETTINGS_IMPORT_TEXT`, `SETTINGS_IMPORT_OPEN`, `SETTINGS_IMPORT_HINT`, `IMPORT_ERROR`, `IMPORT_DIALOG_TITLE`, `IMPORT_CONFIRM_TEXT`, `IMPORT_ORIGIN`, `IMPORT_ORIGIN_UNKNOWN`, `IMPORT_REPLACE_TEXT`, `IMPORT_CONFIRM`, `IMPORT_CANCEL`, `IMPORTED`, `IMPORT_FAILED`, `IMPORT_BUSY`.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/settings-tabs.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SETTINGS_TABS, isSettingsTab } from '../../src/ui/screens/settings/settings-tabs';
import { SETTINGS_TAB } from '../../src/ui/inspector-copy';

describe('settings tabs (Part 5 V27)', () => {
  it('narrows exactly the five tab ids', () => {
    expect(SETTINGS_TABS).toEqual(['appearance', 'analysis', 'accessibility', 'privacy', 'about']);
    for (const id of SETTINGS_TABS) expect(isSettingsTab(id), id).toBe(true);
    for (const id of ['', 'Privacy', 'privacy ', 'constructor', 'toString', 'settings']) expect(isSettingsTab(id), id).toBe(false);
  });
  it('is the one list the tab labels are keyed by', () => {
    expect(Object.keys(SETTINGS_TAB)).toEqual([...SETTINGS_TABS]);
  });
});
```

  Create `tests/component/settings-import.test.ts`:

```ts
// Part 5 V13–V16: Settings › Privacy & storage › Import review state.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import SettingsScreen from '../../src/ui/screens/SettingsScreen.vue';
import WorkbenchScreen from '../../src/ui/screens/WorkbenchScreen.vue';
import { makeEntityId } from '../../src/domain/entity-id';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { repositoryDigest, reviewStateJson, reviewStateSource, type ReviewStateSource } from '../../src/ui/read-models/review-state';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReportStore } from '../../src/ui/stores/report-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { NO_CHECKS, createInMemoryReviewRepository, type WorkItem } from '../../src/ui/stores/ports/review-repository';
import {
  IMPORT_BUSY, IMPORT_CONFIRM_TEXT, IMPORT_ERROR, IMPORT_FAILED, IMPORT_ORIGIN, IMPORTED, SETTINGS_IMPORT_HINT, SETTINGS_IMPORT_OPEN,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const NOW = new Date('2026-09-22T10:00:00.000Z');
const provide = { onSelectCodebase: vi.fn() };
const mountS = () => mount(SettingsScreen, { attachTo: document.body, global: { provide } });

function withSnapshot(): CodebaseSnapshot {
  const snap = buildSnapshotFixture({ files: 6, directories: 1, repositoryId: 'repo-a' });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
}

/** A review-state file for `snap`: one item, one rule, one decision and a note. */
function stateText(snap: CodebaseSnapshot, title = 'Split the parser', source: ReviewStateSource | null = reviewStateSource(snap)): string {
  const path = snap.entities.find((e) => e.kind === 'file')!.path;
  const fileId = makeEntityId(snap.repositoryId, 'file', path);
  return reviewStateJson({
    workItems: [{ id: 'wi-7', target: { kind: 'file', entityId: fileId }, intent: 'refactor', title, status: 'planned', priority: 'high', notes: '', checks: NO_CHECKS, createdAt: NOW.toISOString() }],
    rules: [{ id: 'AR-004', from: 'dir-0', to: 'dir-1', rationale: 'Layering', createdAt: NOW.toISOString() }],
    dispositions: [{ fingerprint: `${fileId}#CX-a-1`, status: 'acknowledged', decidedAt: NOW.toISOString() }],
    report: { sections: { summary: true, architecture: false, hotspots: true, security: true, plan: true }, note: 'Imported note.' },
    exportedAt: NOW,
    source,
  });
}

/** What a real pick does: `files` is set on the template's own input, then `change` fires. */
async function pick(w: VueWrapper, text: string): Promise<void> {
  const input = w.find('.ci-settings__import-file');
  Object.defineProperty(input.element, 'files', { value: [new File([text], 'x.json', { type: 'application/json' })], configurable: true });
  await input.trigger('change');
  await flushPromises();
}

async function openPrivacy(): Promise<VueWrapper> {
  const w = mountS();
  await w.find('[role="tab"][data-tab-id="privacy"]').trigger('click');
  return w;
}

describe('Import review state (Part 5 V13–V16)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('is aria-disabled, described by its visible hint, while no codebase is on screen; the file input lives in the template', async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const w = await openPrivacy();
    const button = w.find('.ci-settings__import');
    expect(button.text()).toBe(SETTINGS_IMPORT_OPEN);
    expect(button.attributes('aria-disabled')).toBe('true');
    const hint = w.find('.ci-settings__import-hint');
    expect(hint.text()).toBe(SETTINGS_IMPORT_HINT);
    expect(button.attributes('aria-describedby')).toBe(hint.attributes('id'));
    await button.trigger('click');
    expect(click).not.toHaveBeenCalled();
    w.unmount();

    withSnapshot();
    const w2 = await openPrivacy();
    const ready = w2.find('.ci-settings__import');
    expect(ready.attributes('aria-disabled')).toBeUndefined();
    expect(ready.attributes('aria-describedby')).toBeUndefined();
    expect(w2.find('.ci-settings__import-hint').exists()).toBe(false);
    const input = w2.find('.ci-settings__import-file');
    expect(input.attributes()).toMatchObject({ type: 'file', accept: '.json,application/json', tabindex: '-1', 'aria-hidden': 'true' });
    await ready.trigger('click');
    expect(click).toHaveBeenCalledTimes(1);
    w2.unmount();
    click.mockRestore();
  });

  it('refuses a broken file with one alert, and a new pick replaces the message', async () => {
    const snap = withSnapshot();
    const w = await openPrivacy();
    await pick(w, '{');
    const alert = w.find('.ci-settings__import-error');
    expect(alert.attributes('role')).toBe('alert');
    expect(alert.text()).toBe(IMPORT_ERROR['not-json'](''));
    const bad = JSON.parse(stateText(snap)) as { workItems: { title: string }[] };
    bad.workItems[0]!.title = '   ';
    await pick(w, JSON.stringify(bad));
    expect(w.findAll('.ci-settings__import-error')).toHaveLength(1);
    expect(w.find('.ci-settings__import-error').text()).toBe(IMPORT_ERROR.invalid('workItems.0.title'));
    expect(w.find('.ci-import-dialog').exists()).toBe(false);
    w.unmount();
  });

  it('refuses a file from another codebase and names its folder', async () => {
    const snap = withSnapshot();
    const w = await openPrivacy();
    await pick(w, stateText(snap, 'x', { folder: 'other-app', repository: repositoryDigest('repo-b') }));
    expect(w.find('.ci-settings__import-error').text()).toBe(IMPORT_ERROR['other-codebase']('other-app'));
    expect(w.find('.ci-import-dialog').exists()).toBe(false);
    w.unmount();
  });

  it('opens the dialog with the counts and origin for a valid file; Cancel changes nothing', async () => {
    const snap = withSnapshot();
    const w = await openPrivacy();
    await pick(w, stateText(snap));
    expect(w.find('.ci-settings__import-error').exists()).toBe(false);
    expect(w.find('.ci-import-dialog__counts').text()).toBe(IMPORT_CONFIRM_TEXT(1, 1, 1, true));
    expect(w.find('.ci-import-dialog__origin').text()).toBe(IMPORT_ORIGIN('root'));
    await w.find('.ci-import-dialog__cancel').trigger('click');
    expect(w.find('.ci-import-dialog').exists()).toBe(false);
    expect(useReviewStore().workItems).toEqual([]);
    w.unmount();
  });

  it('Replace swaps the state in, closes the dialog and re-announces the outcome in the Settings live region', async () => {
    const snap = withSnapshot();
    const review = useReviewStore();
    await review.addWorkItem({ kind: 'package', name: 'old' }, 'review', 'Old item', NOW);
    const w = await openPrivacy();
    await pick(w, stateText(snap));
    await w.find('.ci-import-dialog__confirm').trigger('click');
    await flushPromises();
    expect(review.workItems.map((i) => [i.id, i.title])).toEqual([['wi-7', 'Split the parser']]);
    expect(review.rules.map((r) => r.id)).toEqual(['AR-004']);
    expect(review.dispositions).toHaveLength(1);
    expect(useReportStore().note).toBe('Imported note.');
    expect(useReportStore().sections.architecture).toBe(false);
    expect(w.find('.ci-import-dialog').exists()).toBe(false);
    const message = IMPORTED(1, 1, 1);
    expect(w.find('.ci-settings__live').text()).toBe(message);

    // The same outcome again is heard again: the region passes through '' first.
    const live = w.find('.ci-settings__live').element;
    const seen: string[] = [];
    const observer = new MutationObserver(() => { seen.push((live.textContent ?? '').trim()); });
    observer.observe(live, { childList: true, characterData: true, subtree: true });
    await pick(w, stateText(snap));
    await w.find('.ci-import-dialog__confirm').trigger('click');
    await flushPromises();
    observer.disconnect();
    expect(seen).toContain('');
    expect(seen[seen.length - 1]).toBe(message);
    w.unmount();
  });

  it('ignores Cancel, Escape and a second Replace while the replacement is in flight (Part 4 E13)', async () => {
    const snap = withSnapshot();
    const review = useReviewStore();
    const repo = createInMemoryReviewRepository();
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => { release = r; });
    const save = vi.fn(async (item: WorkItem) => { await gate; await repo.saveWorkItem(item); });
    review.setRepository({ ...repo, saveWorkItem: save });
    const w = await openPrivacy();
    await pick(w, stateText(snap));
    await w.find('.ci-import-dialog__confirm').trigger('click');
    expect(w.find('.ci-import-dialog__confirm').attributes('aria-disabled')).toBe('true');
    expect(w.find('.ci-import-dialog__cancel').attributes('aria-disabled')).toBe('true');
    await w.find('.ci-import-dialog__cancel').trigger('click');
    await w.find('.ci-import-dialog').trigger('keydown', { key: 'Escape' });
    await w.find('.ci-import-dialog__confirm').trigger('click');
    expect(w.find('.ci-import-dialog').exists()).toBe(true);
    release();
    await flushPromises();
    expect(save).toHaveBeenCalledTimes(1);
    expect(w.find('.ci-import-dialog').exists()).toBe(false);
    w.unmount();
  });

  it('a rejection keeps the dialog open with IMPORT_FAILED and announces nothing; a refusal shows IMPORT_BUSY', async () => {
    const snap = withSnapshot();
    const review = useReviewStore();
    const repo = createInMemoryReviewRepository();
    review.setRepository({ ...repo, saveRule: () => Promise.reject(new Error('disk')) });
    const w = await openPrivacy();
    await pick(w, stateText(snap));
    await w.find('.ci-import-dialog__confirm').trigger('click');
    await flushPromises();
    expect(w.find('.ci-import-dialog').exists()).toBe(true);
    expect(w.find('.ci-import-dialog__error').attributes('role')).toBe('alert');
    expect(w.find('.ci-import-dialog__error').text()).toBe(IMPORT_FAILED);
    expect(w.find('.ci-settings__live').text()).toBe('');
    expect(useReportStore().note).toBe('');

    review.setRepository({ ...repo, saveWorkItem: () => new Promise<void>(() => {}) });
    void review.addWorkItem({ kind: 'package', name: 'slow' }, 'review', 'Slow', NOW);
    await w.find('.ci-import-dialog__confirm').trigger('click');
    await flushPromises();
    expect(w.find('.ci-import-dialog__error').text()).toBe(IMPORT_BUSY);
    expect(w.find('.ci-import-dialog').exists()).toBe(true);
    w.unmount();
  });

  it('renders an imported HTML-looking title as literal text in the Workbench (V15)', async () => {
    const snap = withSnapshot();
    const title = '<img src=x onerror=alert(1)>';
    const w = await openPrivacy();
    await pick(w, stateText(snap, title));
    await w.find('.ci-import-dialog__confirm').trigger('click');
    await flushPromises();
    w.unmount();
    const wb = mount(WorkbenchScreen, { attachTo: document.body, global: { provide } });
    expect(wb.find('.ci-work-card__title').text()).toBe(title);
    expect(wb.find('img').exists()).toBe(false);
    expect(wb.html()).toContain('&lt;img');
    wb.unmount();
  });
});
```

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run tests/unit/settings-tabs.test.ts tests/component/settings-import.test.ts`. Expected: FAIL.
  - `settings-tabs` fails because `SETTINGS_TABS` is undefined and `isSettingsTab is not a function`.
  - `settings-import` fails in every test: there is no `.ci-settings__import` button or `.ci-settings__import-file` input yet (`Cannot call attributes on an empty DOMWrapper`). The copy imports (`IMPORT_ERROR` …) are also undefined.

- [ ] **Step 3: Add the copy.** In `src/ui/audit-copy/settings.ts`:
  - After line 1 (`// Part 4: Settings. Re-exported by inspector-copy.ts.`), add `import type { SettingsTab } from '../screens/settings/settings-tabs';`.
  - Replace `export const SETTINGS_TAB: Readonly<Record<'appearance' | 'analysis' | 'accessibility' | 'privacy' | 'about', string>> = {` with `export const SETTINGS_TAB: Readonly<Record<SettingsTab, string>> = {`. The object body stays as it is.
  - At the end of the file (after `REVIEW_STATE_SKIPPED` from Task 7), add:

```ts
/* Part 5 V13–V16: Import review state. */
export const SETTINGS_IMPORT = 'Import review state';
export const SETTINGS_IMPORT_TEXT = 'Replace this session’s review state with a file exported from this codebase. Only the file you pick is read; nothing is read from your vault.';
export const SETTINGS_IMPORT_OPEN = 'Import review state…';
export const SETTINGS_IMPORT_HINT = 'Open a codebase first: imported file paths are matched to the codebase on screen.';
/** V15: one message per refusal. `detail` is the first issue's path for `invalid` and the
 *  file's folder label for `other-codebase`; the other codes ignore it. */
export const IMPORT_ERROR: Readonly<Record<'too-large' | 'not-json' | 'unknown-schema' | 'invalid' | 'other-codebase' | 'read-failed', (detail: string) => string>> = {
  'too-large': () => 'That file is larger than 1 MB, so it was not read. Nothing was imported.',
  'not-json': () => 'That file is not valid JSON. Nothing was imported.',
  'unknown-schema': () => 'That file is not a Codebase Inspector review state (v1 or v2). Nothing was imported.',
  invalid: (at) => (at === '' ? 'That review state is not valid. Nothing was imported.' : `That review state is not valid at ${at}. Nothing was imported.`),
  'other-codebase': (folder) => `That review state belongs to another codebase (${folder}). Open that codebase to import it. Nothing was imported.`,
  'read-failed': () => 'Could not read that file. Nothing was imported.',
};
export const IMPORT_DIALOG_TITLE = 'Replace the review state?';
export const IMPORT_CONFIRM_TEXT = (items: number, decisions: number, rules: number, hasNote: boolean): string =>
  `The file holds ${plural(items, 'work item', 'work items')}, ${plural(decisions, 'finding decision', 'finding decisions')} and ${plural(rules, 'boundary rule', 'boundary rules')}${hasNote ? ', and a report note' : ''}.`;
export const IMPORT_ORIGIN = (folder: string): string => `Exported from the codebase in “${folder}”.`;
export const IMPORT_ORIGIN_UNKNOWN = 'Unknown origin: the file does not say which codebase it came from (a v1 file, or exported with no codebase open).';
export const IMPORT_REPLACE_TEXT = 'Every work item, finding decision and boundary rule in this session, and the report’s sections and note, will be replaced. This cannot be undone. Export the review state first if you want a record.';
export const IMPORT_CONFIRM = 'Replace review state';
export const IMPORT_CANCEL = 'Cancel';
export const IMPORTED = (items: number, decisions: number, rules: number): string =>
  `Review state imported: ${plural(items, 'work item', 'work items')}, ${plural(decisions, 'finding decision', 'finding decisions')} and ${plural(rules, 'boundary rule', 'boundary rules')}.`;
export const IMPORT_FAILED = 'Could not import the whole review state. The lists show what was saved.';
export const IMPORT_BUSY = 'A review change is still being saved. Try again in a moment.';
```

- [ ] **Step 4: Narrow the tabs (V27).** Replace the whole of `src/ui/screens/settings/settings-tabs.ts` with:

```ts
// Part 4 Task 13: the Settings tab vocabulary, kept apart from SettingsSections.vue's
// <script setup> block (a type exported through an SFC's second <script> block is
// awkward with vue-tsc/eslint — allowed by the controller's Task 13 notes).
// Part 5 V27: SETTINGS_TABS is the one list (SettingsScreen's tabs, the copy keys), and
// `isSettingsTab` narrows Tabs' plain-string v-model without a cast.
export const SETTINGS_TABS = ['appearance', 'analysis', 'accessibility', 'privacy', 'about'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
const TAB_IDS: ReadonlySet<string> = new Set(SETTINGS_TABS);
export function isSettingsTab(id: string): id is SettingsTab {
  return TAB_IDS.has(id);
}
```

- [ ] **Step 5: Create the row.** Create `src/ui/screens/settings/ImportRow.vue`:

```vue
<script setup lang="ts">
// Part 5 V13/V15: the Import row. The file input lives in this template and is never
// created with createElement. The button opens it, and the picked file is the only thing
// read. A refusal is one inline alert; a valid file goes up to the confirmation dialog.
import { ref } from 'vue';
import { readReviewStateFile, type ImportedReviewState } from '../../read-models/review-state-import';
import { useCityStore } from '../../stores/city-store';
import { reannounce } from '../../kit/reannounce';
import { useUniqueId } from '../../unique-id';
import {
  IMPORT_ERROR, SETTINGS_IMPORT, SETTINGS_IMPORT_HINT, SETTINGS_IMPORT_OPEN, SETTINGS_IMPORT_TEXT,
} from '../../inspector-copy';

const emit = defineEmits<{ parsed: [state: ImportedReviewState] }>();
const city = useCityStore();
const fileInput = ref<HTMLInputElement | null>(null);
const error = ref('');
const hintId = useUniqueId('ci-settings-import-hint');

/** Blocked (aria-disabled plus this guard, E40) while no codebase is on screen: imported
 *  paths need its repository id to become entity ids. */
function open(): void {
  if (!city.snapshot) return;
  fileInput.value?.click();
}

/** One outcome per pick. The input is emptied first, so picking the same file again still
 *  fires `change`. A refusal is re-announced (V15: a new pick clears the previous error
 *  first). */
async function picked(): Promise<void> {
  const input = fileInput.value;
  const file = input?.files?.[0];
  const repositoryId = city.snapshot?.repositoryId;
  if (input) input.value = '';
  if (!file || repositoryId === undefined) return;
  const result = await readReviewStateFile(file, { repositoryId });
  if (result.ok) {
    error.value = '';
    emit('parsed', result.state);
    return;
  }
  await reannounce(error, IMPORT_ERROR[result.code](result.detail));
}
</script>

<template>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_IMPORT }}</h3>
      <p class="ci-note">
        {{ SETTINGS_IMPORT_TEXT }}
      </p>
      <p
        v-if="!city.snapshot"
        :id="hintId"
        class="ci-note ci-settings__import-hint"
      >
        {{ SETTINGS_IMPORT_HINT }}
      </p>
      <p
        v-if="error"
        class="ci-settings__import-error"
        role="alert"
      >
        {{ error }}
      </p>
    </div>
    <button
      type="button"
      class="ci-settings__import"
      :aria-disabled="city.snapshot ? undefined : 'true'"
      :aria-describedby="city.snapshot ? undefined : hintId"
      @click="open"
    >
      {{ SETTINGS_IMPORT_OPEN }}
    </button>
    <input
      ref="fileInput"
      type="file"
      accept=".json,application/json"
      class="visually-hidden ci-settings__import-file"
      tabindex="-1"
      aria-hidden="true"
      @change="picked"
    >
  </div>
</template>
```

- [ ] **Step 6: Create the dialog.** Create `src/ui/screens/settings/ImportReviewDialog.vue`:

```vue
<script setup lang="ts">
// Part 5 V16: confirms an import. Replace goes through the store (`replaceAll`: persist
// first, reload after). Only `true` closes the dialog and announces (E17). A refusal or a
// rejection stays in the dialog's own alert. Imported text is only ever interpolated,
// never rendered as HTML (V15).
import { computed, ref } from 'vue';
import type { ImportedReviewState } from '../../read-models/review-state-import';
import { useReportStore } from '../../stores/report-store';
import { useReviewStore } from '../../stores/review-store';
import {
  IMPORT_BUSY, IMPORT_CANCEL, IMPORT_CONFIRM, IMPORT_CONFIRM_TEXT, IMPORT_DIALOG_TITLE, IMPORT_FAILED, IMPORT_ORIGIN,
  IMPORT_ORIGIN_UNKNOWN, IMPORT_REPLACE_TEXT, IMPORTED,
} from '../../inspector-copy';
import CiDialog from '../../kit/Dialog.vue';

const props = defineProps<{ state: ImportedReviewState }>();
const emit = defineEmits<{ close: []; done: [message: string] }>();
const review = useReviewStore();
const report = useReportStore();
const busy = ref(false);
const error = ref('');
const counts = computed(() => IMPORT_CONFIRM_TEXT(
  props.state.workItems.length, props.state.dispositions.length, props.state.rules.length, props.state.report.note !== '',
));
const origin = computed(() => (props.state.origin ? IMPORT_ORIGIN(props.state.origin.folder) : IMPORT_ORIGIN_UNKNOWN));

/** Part 4 E13: while the replacement is in flight, Cancel, Escape and the backdrop (all
 *  routed through CiDialog's `close`) are ignored, so the outcome is never lost. */
function requestClose(): void {
  if (busy.value) return;
  emit('close');
}

async function confirm(): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    const { workItems, rules, dispositions } = props.state;
    if (await review.replaceAll({ workItems, rules, dispositions })) {
      report.restore(props.state.report.sections, props.state.report.note);
      emit('done', IMPORTED(workItems.length, dispositions.length, rules.length));
    } else {
      error.value = IMPORT_BUSY;
    }
  } catch {
    error.value = IMPORT_FAILED;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <CiDialog
    :label="IMPORT_DIALOG_TITLE"
    @close="requestClose"
  >
    <div class="ci-import-dialog">
      <h3>{{ IMPORT_DIALOG_TITLE }}</h3>
      <p class="ci-import-dialog__counts">
        {{ counts }}
      </p>
      <p class="ci-import-dialog__origin">
        {{ origin }}
      </p>
      <p class="ci-note">
        {{ IMPORT_REPLACE_TEXT }}
      </p>
      <p
        v-if="error"
        class="ci-import-dialog__error"
        role="alert"
      >
        {{ error }}
      </p>
      <div class="ci-import-dialog__actions">
        <button
          type="button"
          class="ci-import-dialog__cancel"
          :aria-disabled="busy ? 'true' : undefined"
          @click="requestClose"
        >
          {{ IMPORT_CANCEL }}
        </button>
        <button
          type="button"
          class="mod-cta ci-import-dialog__confirm"
          :aria-disabled="busy ? 'true' : undefined"
          @click="confirm"
        >
          {{ IMPORT_CONFIRM }}
        </button>
      </div>
    </div>
  </CiDialog>
</template>
```

- [ ] **Step 7: Wire the row into the Privacy tab.**

  In `src/ui/screens/settings/PrivacyRows.vue`, replace:

```ts
} from '../../inspector-copy';

const emit = defineEmits<{ clear: []; export: [] }>();
```

  with:

```ts
} from '../../inspector-copy';
import type { ImportedReviewState } from '../../read-models/review-state-import';
import ImportRow from './ImportRow.vue';

const emit = defineEmits<{ clear: []; export: []; parsed: [state: ImportedReviewState] }>();
```

  In the same file's template, replace:

```vue
      {{ SETTINGS_EXPORT }}
    </button>
  </div>
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_CLEAR }}</h3>
```

  with:

```vue
      {{ SETTINGS_EXPORT }}
    </button>
  </div>
  <ImportRow @parsed="emit('parsed', $event)" />
  <div class="ci-setting-row">
    <div>
      <h3>{{ SETTINGS_CLEAR }}</h3>
```

  In `src/ui/screens/settings/SettingsSections.vue`:
  - Replace `import type { SettingsTab } from './settings-tabs';` with the two lines `import type { ImportedReviewState } from '../../read-models/review-state-import';` and `import type { SettingsTab } from './settings-tabs';`.
  - Replace `const emit = defineEmits<{ priority: []; clear: []; export: [] }>();` with `const emit = defineEmits<{ priority: []; clear: []; export: []; parsed: [state: ImportedReviewState] }>();`.
  - Replace:

```vue
    <PrivacyRows
      v-else-if="tab === 'privacy'"
      @clear="emit('clear')"
      @export="emit('export')"
    />
```

  with:

```vue
    <PrivacyRows
      v-else-if="tab === 'privacy'"
      @clear="emit('clear')"
      @export="emit('export')"
      @parsed="emit('parsed', $event)"
    />
```

- [ ] **Step 8: SettingsScreen: the dialog, the announcement and the narrowed tab.** In `src/ui/screens/SettingsScreen.vue`, after Task 7:

  (a) Replace `import { nextTick, ref } from 'vue';` with `import { computed, ref, shallowRef } from 'vue';`.

  (b) Replace:

```ts
import { reviewStateJson, reviewStateSource } from '../read-models/review-state';
```

  with:

```ts
import { reviewStateJson, reviewStateSource } from '../read-models/review-state';
import type { ImportedReviewState } from '../read-models/review-state-import';
import { reannounce } from '../kit/reannounce';
```

  (c) Replace:

```ts
import ClearReviewDialog from './settings/ClearReviewDialog.vue';
import type { SettingsTab } from './settings/settings-tabs';

const TABS: readonly TabItem[] = (['appearance', 'analysis', 'accessibility', 'privacy', 'about'] as const).map((id) => ({ id, label: SETTINGS_TAB[id] }));
```

  with:

```ts
import ClearReviewDialog from './settings/ClearReviewDialog.vue';
import ImportReviewDialog from './settings/ImportReviewDialog.vue';
import { SETTINGS_TABS, isSettingsTab, type SettingsTab } from './settings/settings-tabs';

const TABS: readonly TabItem[] = SETTINGS_TABS.map((id) => ({ id, label: SETTINGS_TAB[id] }));
```

  (d) Replace `const showClear = ref(false);` with:

```ts
const showClear = ref(false);
/** Part 5 V16: the parsed file waiting for confirmation. Shallow: it is handed on, never edited. */
const importing = shallowRef<ImportedReviewState | null>(null);
/** V27: Tabs' v-model is a plain string; narrowed here, with no cast. */
const current = computed<SettingsTab>(() => (isSettingsTab(tab.value) ? tab.value : 'appearance'));
```

  (e) Replace:

```ts
/** E17-style repeat (fix round 1, Minor 3): a screen reader only announces an actual text
 *  change, so a SECOND clear (a fresh add, then clear again) must be announced again too. */
async function cleared(message: string): Promise<void> {
  showClear.value = false;
  liveMessage.value = '';
  await nextTick();
  liveMessage.value = message;
}
```

  with:

```ts
/** A dialog's real outcome (E17): the dialog closes and the Settings live region
 *  announces it. `reannounce` (V22) makes a repeated outcome (a second clear, a second
 *  import of the same file) heard again. */
function announce(message: string): void {
  showClear.value = false;
  importing.value = null;
  void reannounce(liveMessage, message);
}
```

  (f) In the template, replace:

```vue
      <SettingsSections
        :tab="tab as SettingsTab"
        @priority="showPriority = true"
        @clear="showClear = true"
        @export="exportState"
      />
```

  with:

```vue
      <SettingsSections
        :tab="current"
        @priority="showPriority = true"
        @clear="showClear = true"
        @export="exportState"
        @parsed="importing = $event"
      />
```

  (g) Replace:

```vue
    <ClearReviewDialog
      v-if="showClear"
      @close="showClear = false"
      @done="cleared"
    />
```

  with:

```vue
    <ClearReviewDialog
      v-if="showClear"
      @close="showClear = false"
      @done="announce"
    />
    <ImportReviewDialog
      v-if="importing"
      :state="importing"
      @close="importing = null"
      @done="announce"
    />
```

  If Task 4 already rewrote `cleared` (for example to call `reannounce`), replace that version with `announce` above instead of quoting the pre-Task-4 text. Drop `nextTick` from the `vue` import only if nothing else in the file uses it. Afterwards `grep -n " as " src/ui/screens/SettingsScreen.vue` must print nothing (V27).

- [ ] **Step 9: CSS.** Append to `src/ui/styles/screens-configure.css`:

```css

/* Part 5 Task 9: Import review state. */
:where(.codebase-inspector-root) .ci-settings__import-error { margin: var(--ci-space-2) 0 0; color: var(--ci-tone-danger); }
:where(.codebase-inspector-root) .ci-import-dialog { display: grid; gap: var(--ci-space-3); max-width: 32em; overflow-wrap: anywhere; }
:where(.codebase-inspector-root) .ci-import-dialog h3,
:where(.codebase-inspector-root) .ci-import-dialog p { margin: 0; }
:where(.codebase-inspector-root) .ci-import-dialog__error { color: var(--ci-tone-danger); }
:where(.codebase-inspector-root) .ci-import-dialog__actions { display: flex; justify-content: flex-end; gap: var(--ci-space-2); }
```

  There is no aria-disabled rule here: the kit's shared `button[aria-disabled="true"]` rule styles both buttons (E54).

- [ ] **Step 10: Run and confirm it passes.** Run `npx vitest run tests/unit/settings-tabs.test.ts tests/component/settings-import.test.ts tests/component/settings-screen.test.ts tests/unit/kit-css-fallbacks.test.ts tests/unit/css-class-scope.test.ts`, then the gate, including `npx eslint src/ui/screens/settings/ImportRow.vue src/ui/screens/settings/ImportReviewDialog.vue src/ui/screens/settings/PrivacyRows.vue src/ui/screens/settings/SettingsSections.vue src/ui/screens/settings/settings-tabs.ts src/ui/screens/SettingsScreen.vue src/ui/audit-copy/settings.ts --max-warnings 0`. Then:
  - Confirm `grep -rn "createElement\|v-html\|innerHTML" src/ui/screens/settings` prints nothing.
  - Report the line counts. SettingsScreen should be about 112, and every file must stay under 400.
- [ ] **Step 11: Commit.** `feat(ui): Import review state in Settings with a confirmation dialog; narrow the settings tab (V13, V15, V16, V27)`

---

### Task 10: Security is built lazily (V18)

**Files:**
- Modify: `src/ui/read-models/security.ts` (40 → 40), `src/ui/read-models/use-read-models.ts` (148 → ~153)
- Test: `tests/unit/security-lazy.test.ts` (new, ~50)

**Interfaces:**
- Consumes: `SAMPLE_PACKAGES`, `type SamplePackage` (`src/ui/fixtures/sample-packages.ts`).
- Produces: `buildSecurityModel(packages: readonly SamplePackage[] = SAMPLE_PACKAGES): SecurityModel` (pure over its input; the no-argument calls in `tests/unit/dependencies-model.test.ts:72` and `tests/unit/report-model.test.ts:22,94` keep working) and `securityModelFor(packages: readonly SamplePackage[]): SecurityModel` exported from `use-read-models.ts`, memoized in a `WeakMap` keyed by the package array, next to `dependenciesModelFor`. `useReadModels().security` becomes `computed(() => securityModelFor(SAMPLE_PACKAGES))`. The module constant `SECURITY` is removed.
- The memo lives in `use-read-models.ts` (the file's memo section), not in `security.ts`: that is where every other `*ModelFor` lives, and a call from `use-read-models.ts` into `./security` goes through the module boundary, so the test's `vi.mock` spy sees it.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/security-lazy.test.ts`:

```ts
// Part 5 V18 (Part 3 E55): nothing is built at module load; the first read builds the
// Security model once, and every later read (any leaf) reuses it.
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/ui/read-models/security', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/ui/read-models/security')>();
  return { ...actual, buildSecurityModel: vi.fn(actual.buildSecurityModel) };
});

describe('Security read model laziness (V18)', () => {
  it('importing use-read-models builds nothing; the first read builds once; later reads reuse it', async () => {
    const security = await import('../../src/ui/read-models/security');
    const build = vi.mocked(security.buildSecurityModel);
    const { useReadModels } = await import('../../src/ui/read-models/use-read-models');
    expect(build).toHaveBeenCalledTimes(0);
    setActivePinia(createPinia());
    const first = useReadModels().security.value;
    expect(build).toHaveBeenCalledTimes(1);
    expect(first.advisories.length).toBeGreaterThan(0);
    setActivePinia(createPinia());   // a second leaf
    expect(useReadModels().security.value).toBe(first);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('buildSecurityModel is pure over its input; securityModelFor memoizes per package array', async () => {
    const { buildSecurityModel } = await import('../../src/ui/read-models/security');
    const { securityModelFor } = await import('../../src/ui/read-models/use-read-models');
    const { SAMPLE_PACKAGES } = await import('../../src/ui/fixtures/sample-packages');
    const none = buildSecurityModel([]);
    expect(none.advisories).toEqual([]);
    expect(none.cards.find((c) => c.id === 'advisories')?.value).toMatchObject({ state: 'sample', value: 0 });
    expect(none.cards.find((c) => c.id === 'licenses')?.value).toMatchObject({ state: 'sample', value: 0 });
    const withAdvisory = SAMPLE_PACKAGES.filter((p) => p.advisory !== null).slice(0, 1);
    expect(withAdvisory).toHaveLength(1);
    expect(securityModelFor(withAdvisory)).toBe(securityModelFor(withAdvisory));
    expect(securityModelFor(withAdvisory).advisories).toEqual(withAdvisory);
    expect(securityModelFor([...withAdvisory])).not.toBe(securityModelFor(withAdvisory));
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/unit/security-lazy.test.ts`. Expected:
  - the first test fails at `expect(build).toHaveBeenCalledTimes(0)` with 1 call: `use-read-models.ts:103` runs `const SECURITY = buildSecurityModel()` while the module loads;
  - the second fails because `securityModelFor` is not exported (and `buildSecurityModel([])` ignores its argument, so the advisories are not empty).
- [ ] **Step 3: Make the builder pure.** In `src/ui/read-models/security.ts`, replace

```ts
export function buildSecurityModel(): SecurityModel {
  const advisories = SAMPLE_PACKAGES.filter((p) => p.advisory !== null);
```

  with

```ts
/** Part 5 V18: pure over its input; nothing calls it at module load (see securityModelFor). */
export function buildSecurityModel(packages: readonly SamplePackage[] = SAMPLE_PACKAGES): SecurityModel {
  const advisories = packages.filter((p) => p.advisory !== null);
```

  and replace

```ts
      { id: 'licenses', label: SECURITY_CARD_LICENSES, icon: 'file-text', value: sample(SAMPLE_PACKAGES.filter((p) => p.license === null).length), caption: SECURITY_CARD_LICENSES_CAPTION, tone: 'accent' },
```

  with

```ts
      { id: 'licenses', label: SECURITY_CARD_LICENSES, icon: 'file-text', value: sample(packages.filter((p) => p.license === null).length), caption: SECURITY_CARD_LICENSES_CAPTION, tone: 'accent' },
```

- [ ] **Step 4: Memoize on first read.** In `src/ui/read-models/use-read-models.ts`:
  - After `import type { ChangeWindow } from '../fixtures/sample-evolution';` add `import { SAMPLE_PACKAGES, type SamplePackage } from '../fixtures/sample-packages';`.
  - Replace

```ts
/** Security has no snapshot-derived input (Part 3 Q7), so it is built once at module load. */
const SECURITY: SecurityModel = buildSecurityModel();
```

  with

```ts
/** Security has no snapshot-derived input (Part 3 Q7). Part 5 V18: built on the first read,
 *  never at module load, and then shared by every leaf (keyed by the package array). */
const securityCache = new WeakMap<readonly SamplePackage[], SecurityModel>();
export function securityModelFor(packages: readonly SamplePackage[]): SecurityModel {
  let hit = securityCache.get(packages);
  if (!hit) { hit = buildSecurityModel(packages); securityCache.set(packages, hit); }
  return hit;
}
```

  - Replace `  const security = computed(() => SECURITY);` with `  const security = computed(() => securityModelFor(SAMPLE_PACKAGES));`.
- [ ] **Step 5: Run and confirm it passes.** `npx vitest run tests/unit/security-lazy.test.ts tests/unit/dependencies-model.test.ts tests/unit/report-model.test.ts tests/unit/read-models.test.ts tests/component/security-screen.test.ts tests/component/report-screen.test.ts`, then the gate, plus `npx eslint src/ui/read-models/security.ts src/ui/read-models/use-read-models.ts tests/unit/security-lazy.test.ts --max-warnings 0`.
- [ ] **Step 6: Commit.** `perf(ui): build the Security read model on first read, never at module load (V18)`

---

### Task 11: Button columns in the Quality and Dependencies tables (V19)

**Files:**
- Modify: `src/ui/screens/quality/FindingsTable.vue` (105 → ~117), `src/ui/screens/QualityScreen.vue` (159 → 159), `src/ui/screens/dependencies/PackageTable.vue` (99 → ~111), `src/ui/audit-copy/quality.ts` (67 → 70), `src/ui/audit-copy/dependencies.ts` (74 → 77), `src/ui/styles/screens-audit.css` (183 → 185)
- Test: `tests/component/quality-screen.test.ts` (287 → ~320), `tests/component/dependencies-screen.test.ts` (201 → ~222)

**Interfaces:**
- Consumes: `EvidenceTable`'s `interactive` prop (`src/ui/kit/EvidenceTable.vue`, E28/E45) and its `cell-<key>` slots.
- Produces: copy in `src/ui/audit-copy/quality.ts`: `QUALITY_COL_REVIEW = 'Review'`, `QUALITY_REVIEW = 'Review'`, `QUALITY_REVIEW_LABEL = (title: string, file: string): string => \`Review ${title} in ${file}\``; in `src/ui/audit-copy/dependencies.ts`: `DEPS_COL_DETAILS = 'Details'`, `DEPS_DETAILS = 'Details'`, `DEPS_DETAILS_LABEL = (name: string): string => \`Details for ${name}\``. Classes `ci-findings-table__open` (Quality) and `ci-packages__details` (Dependencies). The `open`/`inspect` events keep their payloads.

- [ ] **Step 1: Write the failing tests.**
  - In `tests/component/quality-screen.test.ts`:
    - Replace every `await w.findAll('.ci-table__row')[0]!.trigger('click');` (currently at lines 92, 124, 167, 180, 191, 206, 222, 238, 258) with `await w.findAll('.ci-findings-table__open')[0]!.trigger('click');`. Row-count assertions on `.ci-table__row` stay.
    - Replace the test `'acknowledging moves the finding out of the Open list; closing lands focus on a row, never the shell or body'` (lines 64–87) with:

```ts
  it('acknowledging moves the finding out of the Open list; closing lands focus on a Review button, never the shell or body', async () => {
    withSnapshot();
    const { w, done } = mountInShell();
    // Finding ids repeat across files (CX-<module>-<n>); the id plus the file names the row.
    const identity = w.findAll('.ci-table__row')[0]!.text();
    const open = w.findAll('.ci-findings-table__open')[0]!;
    (open.element as HTMLElement).focus();
    await open.trigger('click');
    expect(w.find('.ci-finding-dialog').exists()).toBe(true);
    await w.find('.ci-finding-dialog__acknowledge').trigger('click');
    await flush();
    expect(useReviewStore().dispositions).toHaveLength(1);
    expect(w.find('.ci-finding-dialog__reopen').exists()).toBe(true);
    expect(w.find('[role="dialog"] .ci-dialog__status').text()).toBe('Finding acknowledged. No repository suppression was written.');
    expect(w.find('.ci-quality__live').text()).toBe('');
    await w.find('.ci-finding-dialog__close').trigger('click');
    await flush();
    const rows = w.findAll('.ci-table__row').map((r) => r.text());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows).not.toContain(identity);
    expect(document.activeElement?.classList.contains('ci-findings-table__open')).toBe(true);
    expect(document.activeElement?.classList.contains('ci-shell')).toBe(false);
    done();
  });
```

    - Append before the closing `});` of the `describe`:

```ts
  it('V19: rows take no focus or click; each Review button is named "Review <title> in <file>", starting with its text', async () => {
    withSnapshot();
    const w = mountQ();
    const rows = w.findAll('.ci-table__row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.attributes('tabindex') === undefined)).toBe(true);
    await rows[0]!.trigger('click');
    expect(w.find('.ci-finding-dialog').exists()).toBe(false);
    const buttons = w.findAll('.ci-findings-table__open');
    expect(buttons).toHaveLength(rows.length);
    expect(buttons.every((b) => (b.attributes('aria-label') ?? '').startsWith(b.text()))).toBe(true);
    // The row's two .ci-file-cell__name cells: the finding title, then the file name.
    const names = rows[0]!.findAll('.ci-file-cell__name').map((n) => n.text());
    expect(names).toHaveLength(2);
    expect(buttons[0]!.text()).toBe('Review');
    expect(buttons[0]!.attributes('aria-label')).toBe(`Review ${names[0]!} in ${names[1]!}`);
    w.unmount();
  });

  it('V19/R5: closing the dialog returns focus to the same row\'s Review button', async () => {
    withSnapshot();
    const { w, done } = mountInShell();
    const buttons = w.findAll('.ci-findings-table__open');
    expect(buttons.length).toBeGreaterThan(1);
    const second = buttons[1]!;
    (second.element as HTMLElement).focus();
    await second.trigger('click');
    expect(w.find('.ci-finding-dialog').exists()).toBe(true);
    await w.find('.ci-finding-dialog__close').trigger('click');
    await flush();
    expect(document.activeElement).toBe(second.element);
    done();
  });
```

  - In `tests/component/dependencies-screen.test.ts`:
    - Replace every `await w.findAll('.ci-table__row')[0]!.trigger('click');` (lines 62, 88, 100, 112) with `await w.findAll('.ci-packages__details')[0]!.trigger('click');`.
    - Replace the test `'Close and Escape close the dialog and return focus to the opener row'` (lines 121–141) with:

```ts
  it('Close and Escape close the dialog and return focus to the row\'s Details button', async () => {
    withSnapshot();
    const w = mountD();
    const details = w.findAll('.ci-packages__details')[0]!;

    (details.element as HTMLElement).focus();
    await details.trigger('click');
    expect(w.find('.ci-package-dialog').exists()).toBe(true);
    await w.find('.ci-package-dialog__close').trigger('click');
    await nextTick();
    expect(w.find('.ci-package-dialog').exists()).toBe(false);
    expect(document.activeElement).toBe(details.element);

    (details.element as HTMLElement).focus();
    await details.trigger('click');
    await w.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    await nextTick();
    expect(w.find('.ci-package-dialog').exists()).toBe(false);
    expect(document.activeElement).toBe(details.element);
    w.unmount();
  });
```

    - In the two tests `'shows the unused-package note …'` and `'shows the metadata note …'`, replace `await row.trigger('click');` with `await row.find('.ci-packages__details').trigger('click');` (the row's text check stays).
    - Append before the closing `});`:

```ts
  it('V19: package rows take no focus or click; each Details button is named "Details for <package>", starting with its text', async () => {
    withSnapshot();
    const w = mountD();
    const rows = w.findAll('.ci-table__row');
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.attributes('tabindex') === undefined)).toBe(true);
    await rows[0]!.trigger('click');
    expect(w.find('.ci-package-dialog').exists()).toBe(false);
    const details = w.findAll('.ci-packages__details');
    expect(details).toHaveLength(10);
    expect(details.every((b) => (b.attributes('aria-label') ?? '').startsWith(b.text()))).toBe(true);
    expect(details[0]!.text()).toBe('Details');
    expect(details[0]!.attributes('aria-label')).toBe('Details for @sample/document-parser');
    w.unmount();
  });
```

- [ ] **Step 2: Run them and confirm they fail.** `npx vitest run tests/component/quality-screen.test.ts tests/component/dependencies-screen.test.ts`. Expected: every test that clicks `.ci-findings-table__open` / `.ci-packages__details` fails (no such element); the two V19 tests also fail because rows carry `tabindex="0"` and a row click opens the dialog.
- [ ] **Step 3: Copy.**
  - In `src/ui/audit-copy/quality.ts`, after `export const QUALITY_COL_STATUS = 'Status';` add:

```ts
// Part 5 V19: the row's own button (the row is no longer a control); the name starts with the visible text.
export const QUALITY_COL_REVIEW = 'Review';
export const QUALITY_REVIEW = 'Review';
export const QUALITY_REVIEW_LABEL = (title: string, file: string): string => `Review ${title} in ${file}`;
```

  - In `src/ui/audit-copy/dependencies.ts`, after `export const DEPS_COL_STATUS = 'Status';` add:

```ts
// Part 5 V19: the row's own button (the row is no longer a control); the name starts with the visible text.
export const DEPS_COL_DETAILS = 'Details';
export const DEPS_DETAILS = 'Details';
export const DEPS_DETAILS_LABEL = (name: string): string => `Details for ${name}`;
```

- [ ] **Step 4: FindingsTable.** In `src/ui/screens/quality/FindingsTable.vue`:
  - Replace the import block

```ts
import {
  FINDING_KIND_LABEL, FINDING_STATUS_LABEL, QUALITY_COL_EVIDENCE, QUALITY_COL_FINDING, QUALITY_COL_LOCATION,
  QUALITY_COL_SEVERITY, QUALITY_COL_STATUS, QUALITY_LOCATION, QUALITY_NO_MATCH, QUALITY_NO_MATCH_TITLE, QUALITY_SHOWING,
  QUALITY_TABLE_CAPTION, RESET_FILTERS, SEVERITY_LABEL, SHOW_MORE,
} from '../../inspector-copy';
```

  with

```ts
import {
  FINDING_KIND_LABEL, FINDING_STATUS_LABEL, QUALITY_COL_EVIDENCE, QUALITY_COL_FINDING, QUALITY_COL_LOCATION,
  QUALITY_COL_REVIEW, QUALITY_COL_SEVERITY, QUALITY_COL_STATUS, QUALITY_LOCATION, QUALITY_NO_MATCH, QUALITY_NO_MATCH_TITLE,
  QUALITY_REVIEW, QUALITY_REVIEW_LABEL, QUALITY_SHOWING, QUALITY_TABLE_CAPTION, RESET_FILTERS, SEVERITY_LABEL, SHOW_MORE,
} from '../../inspector-copy';
```

  - Replace `  { key: 'status', label: QUALITY_COL_STATUS },` with

```ts
  { key: 'status', label: QUALITY_COL_STATUS },
  // V19 (E28/E45): the row is static; this real button is the one control per row.
  { key: 'open', label: QUALITY_COL_REVIEW },
```

  - Replace

```vue
        :limit="limit"
        @activate="emit('open', $event)"
      >
```

  with

```vue
        :limit="limit"
        :interactive="false"
      >
```

  - Replace

```vue
          </span>
        </template>
      </EvidenceTable>
```

  with

```vue
          </span>
        </template>
        <template #cell-open="{ row }">
          <button
            type="button"
            class="ci-findings-table__open"
            :aria-label="QUALITY_REVIEW_LABEL(row.title, row.file.name)"
            @click="emit('open', row)"
          >
            {{ QUALITY_REVIEW }}
          </button>
        </template>
      </EvidenceTable>
```

- [ ] **Step 5: Quality focus restore (R5).** In `src/ui/screens/QualityScreen.vue`, replace

```ts
/** Remembers where the opening row sat, so closing can land near it (closeReview). */
function open(finding: QualityFinding): void {
  const el = root.value;
  const active = el?.ownerDocument.activeElement ?? null;
  const rowEls = el ? [...el.querySelectorAll<HTMLElement>('.ci-table__row')] : [];
  const at = active ? rowEls.findIndex((r) => r === active) : -1;
```

  with

```ts
/** Remembers which row's Review button opened the dialog, so closing can land near it (closeReview). */
function open(finding: QualityFinding): void {
  const el = root.value;
  const active = el?.ownerDocument.activeElement ?? null;
  const buttons = el ? [...el.querySelectorAll<HTMLElement>('.ci-findings-table__open')] : [];
  const at = active ? buttons.findIndex((b) => b === active) : -1;
```

  and replace

```ts
  const rowEls = [...el.querySelectorAll<HTMLElement>('.ci-table__row')];
  (rowEls[Math.min(openedIndex.value, rowEls.length - 1)]
```

  with

```ts
  const buttons = [...el.querySelectorAll<HTMLElement>('.ci-findings-table__open')];
  (buttons[Math.min(openedIndex.value, buttons.length - 1)]
```

  In the comment above `closeReview`, change "otherwise land on the row now at the same place, the last row, or the panel" to "otherwise land on the Review button now at the same place, the last one, or the panel".
- [ ] **Step 6: PackageTable.** In `src/ui/screens/dependencies/PackageTable.vue`:
  - Replace

```ts
import {
  DEPS_COL_INSTALLED, DEPS_COL_LICENSE, DEPS_COL_PACKAGE, DEPS_COL_RELATIONSHIP, DEPS_COL_STATUS, DEPS_COUNT,
  DEPS_FILTER_LABEL, DEPS_FILTER_LABELS, DEPS_FILTER_QUERY, DEPS_LICENSE_UNRESOLVED, DEPS_NO_MATCH, DEPS_NO_MATCH_TITLE,
  DEPS_RELATIONSHIP_LABEL, DEPS_REFERENCES, DEPS_STATUS_LABEL, DEPS_TABLE_CAPTION,
} from '../../inspector-copy';
```

  with

```ts
import {
  DEPS_COL_DETAILS, DEPS_COL_INSTALLED, DEPS_COL_LICENSE, DEPS_COL_PACKAGE, DEPS_COL_RELATIONSHIP, DEPS_COL_STATUS, DEPS_COUNT,
  DEPS_DETAILS, DEPS_DETAILS_LABEL, DEPS_FILTER_LABEL, DEPS_FILTER_LABELS, DEPS_FILTER_QUERY, DEPS_LICENSE_UNRESOLVED,
  DEPS_NO_MATCH, DEPS_NO_MATCH_TITLE, DEPS_RELATIONSHIP_LABEL, DEPS_REFERENCES, DEPS_STATUS_LABEL, DEPS_TABLE_CAPTION,
} from '../../inspector-copy';
```

  - Replace `  { key: 'status', label: DEPS_COL_STATUS },` with

```ts
  { key: 'status', label: DEPS_COL_STATUS },
  // V19 (E28/E45): the row is static; this real button is the one control per row.
  { key: 'details', label: DEPS_COL_DETAILS },
```

  - Replace

```vue
        :caption="DEPS_TABLE_CAPTION"
        @activate="emit('inspect', $event.pkg)"
      >
```

  with

```vue
        :caption="DEPS_TABLE_CAPTION"
        :interactive="false"
      >
```

  - Replace

```vue
          >{{ DEPS_STATUS_LABEL[row.pkg.status] }}</span>
        </template>
      </EvidenceTable>
```

  with

```vue
          >{{ DEPS_STATUS_LABEL[row.pkg.status] }}</span>
        </template>
        <template #cell-details="{ row }">
          <button
            type="button"
            class="ci-packages__details"
            :aria-label="DEPS_DETAILS_LABEL(row.pkg.name)"
            @click="emit('inspect', row.pkg)"
          >
            {{ DEPS_DETAILS }}
          </button>
        </template>
      </EvidenceTable>
```

  `DependenciesScreen.vue` is unchanged: it already listens to `@inspect`, and CiDialog restores focus to the pressed button (the opener).
- [ ] **Step 7: CSS.** In `src/ui/styles/screens-audit.css`:
  - After `:where(.codebase-inspector-root) .ci-findings-table__status { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ci-space-2); min-width: 0; }` add
    `:where(.codebase-inspector-root) .ci-findings-table__open { white-space: nowrap; }`
  - After `:where(.codebase-inspector-root) .ci-packages__query { flex: 1 1 14em; min-width: 0; }` add
    `:where(.codebase-inspector-root) .ci-packages__details { white-space: nowrap; }`

  The kit's `.ci-table__row--static` rule (no pointer, no hover) already applies to non-interactive rows.
- [ ] **Step 8: Run and confirm they pass.** `npx vitest run tests/component/quality-screen.test.ts tests/component/dependencies-screen.test.ts tests/component/kit-interactive.test.ts tests/unit/css-class-scope.test.ts tests/unit/kit-css-fallbacks.test.ts`, then the gate, plus `npx eslint src/ui/screens/quality/FindingsTable.vue src/ui/screens/QualityScreen.vue src/ui/screens/dependencies/PackageTable.vue src/ui/audit-copy/quality.ts src/ui/audit-copy/dependencies.ts tests/component/quality-screen.test.ts tests/component/dependencies-screen.test.ts --max-warnings 0`.
- [ ] **Step 9: Commit.** `feat(ui): Quality and Dependencies rows are static; each row gets a named Review/Details button (V19)`

---

### Task 12: Kit classes for shared looks; guard every screen block (V20, V21)

**Files:**
- Modify: `src/ui/styles/kit.css` (~208 after Task 5 → ~232), `src/ui/styles/screens.css` (64 → ~51), `src/ui/styles/screens-explore.css` (140 → ~137), `src/ui/styles/screens-audit.css` (~185 after Task 11 → ~178)
- Modify (class names only): `src/ui/screens/file/FileFindingsPanel.vue` (68 → 68), `src/ui/screens/quality/FindingsTable.vue` (~117 → ~117), `src/ui/screens/quality/FindingReviewDialog.vue` (236 → 236), `src/ui/screens/hotspots/HotspotScatter.vue` (134 → 134), `src/ui/screens/test-confidence/CoverageMap.vue` (63 → 63)
- Test: `tests/unit/css-class-scope.test.ts` (39 → ~120, rewritten), `tests/component/file-detail-screen.test.ts` (1 selector)

**Interfaces:**
- Produces (kit.css): `ci-screen` (the screen root base, moved from screens.css), `ci-severity` + `--high|--medium|--low`, `ci-ref-id`, `ci-band-legend` + `__key` + `__key--low|--mid|--high`, `ci-file-cell` + `__name|__path`, `ci-priority`. File detail's own card block `ci-file-finding` + `__head|__title|__meta|__review` (screens-explore.css).
- Retired: `ci-finding` (the block and every `ci-finding__*`), `ci-scatter__legend`, `ci-scatter__key*`. `ci-scatter` itself stays Hotspots-only; `ci-finding-dialog`, `ci-finding-filters`, `ci-findings`, `ci-findings-table` are other blocks and stay.
- The guard (V21) extracts `ci-<block>` roots from each `.vue` under `src/ui/screens/**` and maps each file to one owner:
  - a top-level `XScreen.vue` → `x` lowercased (`FileDetailScreen.vue` → `filedetail`); `NoSnapshot.vue` → `nosnapshot`; `CityWorkspace.vue` → `city`;
  - a file in `screens/<dir>/` → `<dir>`, with the aliases `file` → `filedetail` and `test-confidence` → `tests`; `shared/` is its own owner `shared`.

  A root used by more than one owner must be defined in `kit.css` or be one of the WP-01 component blocks `ci-app, ci-viewport, ci-file-list, ci-search, ci-shell, ci-welcome, ci-selection-notice`.

Cross-owner roots found in the real code at f05fd19, and what happens to each (the same extractor, run over `src/ui/screens/**`):

| Root | Owners today | After this task |
|---|---|---|
| `ci-chip`, `ci-empty`, `ci-facts`, `ci-note`, `ci-selected-strip`, `ci-table` | several | already kit: allowed |
| `ci-file-cell` | architecture, evolution, hotspots, overview, quality, report, tests, workbench | moved to kit |
| `ci-priority` | architecture, hotspots, overview | moved to kit |
| `ci-finding` | filedetail, quality | Quality uses `ci-severity`/`ci-ref-id` (kit); File detail uses `ci-file-finding` (own) |
| `ci-scatter` | hotspots, tests | legends use `ci-band-legend` (kit); `ci-scatter` stays Hotspots-only |
| `ci-screen` | every screen | its base rule moves from screens.css to kit (unchanged body) |

- [ ] **Step 1: Write the failing test.** Replace `tests/unit/css-class-scope.test.ts` with:

```ts
// E55 / Part 5 V21: a screen never borrows another screen's block class; shared looks live
// in kit.css. Every ci-<block> root named by a screen file must belong to one screen, be a
// kit class, or be one of the WP-01 component blocks CityWorkspace composes.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI = resolve(process.cwd(), 'src', 'ui');
const SCREENS = join(UI, 'screens');
const STYLES = join(UI, 'styles');
function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? vueFiles(p) : p.endsWith('.vue') ? [p] : [];
  });
}
interface SourceFile { path: string; text: string }
const load = (base: string): SourceFile[] =>
  vueFiles(base).map((p) => ({ path: relative(base, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }));
const FILES = load(UI);
const SCREEN_FILES = load(SCREENS);
const stripCssComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
const KIT = stripCssComments(readFileSync(join(STYLES, 'kit.css'), 'utf8'));

/** WP-01 component blocks CityWorkspace composes (styled in styles.css, never edited). */
const WP01_BLOCKS: readonly string[] = ['ci-app', 'ci-viewport', 'ci-file-list', 'ci-search', 'ci-shell', 'ci-welcome', 'ci-selection-notice'];
/** A directory or file stem whose screen key differs from its name. */
const OWNER_ALIAS: Readonly<Record<string, string>> = { file: 'filedetail', 'test-confidence': 'tests', cityworkspace: 'city' };

/** Path relative to src/ui/screens → the screen that owns it. */
function ownerOf(path: string): string {
  const parts = path.split('/');
  const head = parts[0] ?? '';
  const key = parts.length > 1 ? head : head.replace(/\.vue$/, '').replace(/Screen$/, '').toLowerCase();
  return OWNER_ALIAS[key] ?? key;
}

/** Every ci-<block> root a file names in class attributes, :class bindings and selector
 *  strings: comments are dropped, useUniqueId('…') ids are skipped, and a root ends where
 *  `__` or `--` begins. */
function blockRoots(text: string): Set<string> {
  const code = text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
    .replace(/useUniqueId\(\s*(['"`])[^'"`]*\1\s*\)/g, 'useUniqueId()');
  return new Set([...code.matchAll(/(?<![\w-])ci-[a-z0-9]+(?:-[a-z0-9]+)*/g)].map((m) => m[0]));
}

/** root → its owners, for every root named by more than one owner. */
function sharedRoots(files: readonly SourceFile[]): Map<string, string[]> {
  const owners = new Map<string, Set<string>>();
  for (const f of files) {
    for (const root of blockRoots(f.text)) {
      const set = owners.get(root) ?? new Set<string>();
      set.add(ownerOf(f.path));
      owners.set(root, set);
    }
  }
  return new Map([...owners].filter(([, set]) => set.size > 1).map(([root, set]) => [root, [...set].sort()]));
}
const definedInKit = (root: string): boolean =>
  new RegExp(`:where\\(\\.codebase-inspector-root\\)[^{}]*\\.${root}(?![\\w-])`).test(KIT);

const RETIRED = [
  'ci-hotspots__note', 'ci-hotspots__selected', 'ci-overview__cards', 'ci-overview__grid', 'ci-overview__empty', 'ci-findings-table__empty',
  'ci-finding__', 'ci-scatter__legend', 'ci-scatter__key',
];
const RETIRED_SELECTORS = ['.ci-finding__', '.ci-finding {', '.ci-scatter__legend', '.ci-scatter__key'];

const SNIPPET = [
  '<!-- ci-commented__out -->',
  '<figcaption class="ci-scatter__legend">',
  '  <span :class="\'ci-scatter__key--\' + band" />',
  '</figcaption>',
  '<script setup lang="ts">',
  'const id = useUniqueId(\'ci-hotspots-filter\');',
  '// ci-in-a-comment',
  'const row = root.querySelector<HTMLElement>(\'.ci-table__row\');',
  '</script>',
].join('\n');

describe('CSS class scope (E55, Part 5 V21)', () => {
  it('finds the Vue files', () => {
    expect(FILES.length).toBeGreaterThan(50);
    expect(SCREEN_FILES.length).toBeGreaterThan(40);
  });

  it('the extractor finds a borrowed block in a synthetic snippet, and skips comments and useUniqueId ids', () => {
    expect([...blockRoots(SNIPPET)].sort()).toEqual(['ci-scatter', 'ci-table']);
    const borrowed = sharedRoots([
      { path: 'test-confidence/Legend.vue', text: SNIPPET },
      { path: 'HotspotsScreen.vue', text: '<div class="ci-screen ci-scatter"></div>' },
    ]);
    expect(borrowed).toEqual(new Map([['ci-scatter', ['hotspots', 'tests']]]));
  });

  it('maps every file to its screen', () => {
    expect(ownerOf('file/FileHeader.vue')).toBe(ownerOf('FileDetailScreen.vue'));
    expect(ownerOf('test-confidence/CoverageMap.vue')).toBe(ownerOf('TestsScreen.vue'));
    expect(ownerOf('CityWorkspace.vue')).toBe(ownerOf('city/CitySummaryCards.vue'));
    expect(ownerOf('CityScreen.vue')).toBe('city');
    expect(ownerOf('shared/EvidenceSourceDialog.vue')).toBe('shared');
    expect(ownerOf('NoSnapshot.vue')).toBe('nosnapshot');
  });

  it('every ci-<block> root is used by one screen, or is a kit or WP-01 component block', () => {
    const shared = sharedRoots(SCREEN_FILES);
    expect(shared.size).toBeGreaterThan(0);   // E27: the kit classes are shared, so the scan found something
    const offenders = [...shared]
      .filter(([root]) => !definedInKit(root) && !WP01_BLOCKS.includes(root))
      .map(([root, owners]) => `${root} (${owners.join(', ')})`);
    expect(offenders).toEqual([]);
  });

  it('uses no retired shared-by-accident class anywhere', () => {
    for (const f of FILES) for (const cls of RETIRED) expect(f.text.includes(cls), `${f.path} uses ${cls}`).toBe(false);
  });

  it('no stylesheet still styles a retired Part 5 name (V20)', () => {
    const sheets = readdirSync(STYLES).filter((n) => n.endsWith('.css'));
    expect(sheets.length).toBeGreaterThan(0);
    for (const name of sheets) {
      const css = stripCssComments(readFileSync(join(STYLES, name), 'utf8'));
      for (const sel of RETIRED_SELECTORS) expect(css.includes(sel), `${name} styles ${sel}`).toBe(false);
    }
  });

  it('kit.css defines the shared classes', () => {
    for (const cls of [
      '.ci-note', '.ci-empty', '.ci-empty__title', '.ci-selected-strip', '.ci-screen__cards', '.ci-screen__grid', '.ci-chip ', '.ci-chip--sample',
      '.ci-screen ', '.ci-severity ', '.ci-severity--high', '.ci-severity--medium', '.ci-severity--low', '.ci-ref-id',
      '.ci-band-legend ', '.ci-band-legend__key::before', '.ci-band-legend__key--low', '.ci-band-legend__key--mid', '.ci-band-legend__key--high',
      '.ci-file-cell ', '.ci-file-cell__name', '.ci-file-cell__path', '.ci-priority ',
    ]) {
      expect(KIT.includes(`:where(.codebase-inspector-root) ${cls}`), cls).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** `npx vitest run tests/unit/css-class-scope.test.ts`. Expected:
  - `every ci-<block> root …` fails with `offenders` equal to `['ci-file-cell (…)', 'ci-finding (filedetail, quality)', 'ci-priority (architecture, hotspots, overview)', 'ci-scatter (hotspots, tests)', 'ci-screen (…)']`, plus any root a Part 5 task added since (list each one in your report and resolve it the same way: kit class, or a rename into the owning screen's block);
  - `uses no retired …` fails on `ci-finding__` and `ci-scatter__legend`;
  - `no stylesheet …` and `kit.css defines …` fail.
- [ ] **Step 3: Kit rules.** Append to `src/ui/styles/kit.css` (bodies are copied unchanged from the rules named in each comment):

```css
/* Part 5 V20/V21: looks more than one screen uses, moved here with their bodies unchanged. */
/* The screen root (was screens.css). */
:where(.codebase-inspector-root) .ci-screen {
  display: flex; flex-direction: column; gap: var(--ci-space-5);
  padding: var(--ci-space-6); box-sizing: border-box; min-width: 0;
}
/* Severity pill and reference id (were .ci-finding__severity* and .ci-finding__id, screens-explore.css). */
:where(.codebase-inspector-root) .ci-severity { padding: 1px var(--ci-space-2); border-radius: var(--ci-radius-small); font-size: var(--font-ui-smaller, 0.8em); font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-severity--high { color: var(--ci-tone-danger); background: color-mix(in srgb, var(--ci-tone-danger) 16%, transparent); }
:where(.codebase-inspector-root) .ci-severity--medium { color: var(--ci-tone-warning); border: 1px solid var(--ci-tone-warning); }
:where(.codebase-inspector-root) .ci-severity--low { color: var(--ci-tone-success); border: 1px solid var(--ci-tone-success); }
:where(.codebase-inspector-root) .ci-ref-id { color: var(--ci-text-faint); font-family: var(--ci-font-mono); font-size: var(--font-ui-smaller, 0.8em); }
/* Band legend under a chart (was .ci-scatter__legend / .ci-scatter__key*, screens-explore.css). */
:where(.codebase-inspector-root) .ci-band-legend { display: flex; flex-wrap: wrap; gap: var(--ci-space-4); margin-top: var(--ci-space-2); color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-band-legend__key::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: var(--ci-space-1); border-radius: 50%; background: var(--ci-text-faint); }
:where(.codebase-inspector-root) .ci-band-legend__key--low::before { background: var(--ci-tone-danger); }
:where(.codebase-inspector-root) .ci-band-legend__key--mid::before { background: var(--ci-tone-warning); }
:where(.codebase-inspector-root) .ci-band-legend__key--high::before { background: var(--ci-tone-success); }
/* A file name over its path (was screens.css). */
:where(.codebase-inspector-root) .ci-file-cell { display: flex; flex-direction: column; }
:where(.codebase-inspector-root) .ci-file-cell__name { font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-file-cell__path { color: var(--ci-text-faint); font-family: var(--ci-font-mono); font-size: var(--font-ui-smaller, 0.8em); }
/* Priority score (was screens.css). Task 11: a tint, not Obsidian's `--background-modifier-error`
   — that token is the solid `--color-red`, the same colour as the text, so the score was unreadable. */
:where(.codebase-inspector-root) .ci-priority {
  padding: 2px var(--ci-space-2); border-radius: var(--ci-radius-small); white-space: nowrap;
  color: var(--ci-tone-danger); background: color-mix(in srgb, var(--ci-tone-danger) 16%, transparent);
}
```

  Cascade check: kit.css loads before shell.css and every screen sheet. None of these classes has another rule in a later sheet (`grep -n "ci-file-cell\|ci-priority\|ci-screen\b" src/ui/styles/*.css` shows only `.ci-screen--city …` in screens.css and `.ci-shell--compact .ci-screen:not(.ci-screen--city)` in shell.css, both of which are meant to override the base and still do).
- [ ] **Step 4: Remove the moved rules from the screen sheets.**
  - `src/ui/styles/screens.css`:
    - replace the first line `/* WP-02 screens. The city screen is a flex column holding its PageHeader, the unchanged` with `/* WP-02 screens (the shared .ci-screen base is in kit.css, Part 5 V21). The city screen is a flex column holding its PageHeader, the unchanged`;
    - delete the rule

```css
:where(.codebase-inspector-root) .ci-screen {
  display: flex; flex-direction: column; gap: var(--ci-space-5);
  padding: var(--ci-space-6); box-sizing: border-box; min-width: 0;
}
```

    - delete lines 38–46 (the three `.ci-file-cell*` rules, the two-line "Task 11: a tint …" comment and the four-line `.ci-priority` rule) and the blank line after them. `.ci-screen--city` and `.ci-screen--city > .ci-app` stay (`tests/unit/city-stage-floor.test.ts` reads them from screens.css).
  - `src/ui/styles/screens-explore.css`:
    - delete the five lines from `:where(.codebase-inspector-root) .ci-scatter__legend { …` through `:where(.codebase-inspector-root) .ci-scatter__key--high::before { background: var(--ci-tone-success); }`;
    - replace the nine lines from `:where(.codebase-inspector-root) .ci-finding { padding: var(--ci-space-3) 0; border-bottom: 1px solid var(--ci-border); }` through `:where(.codebase-inspector-root) .ci-finding__meta { … }` with:

```css
/* Part 5 V20: File detail's own finding card (was .ci-finding*); the severity pill and the id are kit classes. */
:where(.codebase-inspector-root) .ci-file-finding { padding: var(--ci-space-3) 0; border-bottom: 1px solid var(--ci-border); }
:where(.codebase-inspector-root) .ci-file-finding__head { display: flex; align-items: center; gap: var(--ci-space-2); margin: 0; }
:where(.codebase-inspector-root) .ci-file-finding__title { margin: var(--ci-space-2) 0 var(--ci-space-1); font-weight: var(--font-semibold); }
:where(.codebase-inspector-root) .ci-file-finding__meta { display: flex; align-items: center; gap: var(--ci-space-2); margin: 0; color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) button.ci-file-finding__review {
  display: block; width: 100%; height: auto; padding: 0; border: none; border-radius: 0; box-shadow: none;
  background: transparent; color: var(--ci-text); font: inherit; text-align: left; white-space: normal; cursor: pointer;
}
:where(.codebase-inspector-root) button.ci-file-finding__review:hover { background: var(--ci-raised); }
:where(.codebase-inspector-root) button.ci-file-finding__review:focus-visible { outline: 2px solid var(--ci-focus); outline-offset: 2px; }
:where(.codebase-inspector-root) .ci-file-finding__review .ci-file-finding__title { display: block; }
```

  - `src/ui/styles/screens-audit.css`: delete the seven lines from `:where(.codebase-inspector-root) button.ci-finding__review {` through `:where(.codebase-inspector-root) .ci-finding__review .ci-finding__title { display: block; }` (moved above).
- [ ] **Step 5: Rename the class uses.**
  - `src/ui/screens/file/FileFindingsPanel.vue`: replace

```vue
      <li
        v-for="f in findings"
        :key="f.fingerprint"
        class="ci-finding"
      >
        <!-- E20: a <button> holds phrasing content only, so every block is a <span>. -->
        <button
          type="button"
          class="ci-finding__review"
          @click="emit('review', f.fingerprint)"
        >
          <span class="ci-finding__head">
            <span
              class="ci-finding__severity"
              :class="`ci-finding__severity--${f.severity}`"
            >{{ SEVERITY_LABEL[f.severity] }}</span>
            <span
              class="ci-chip"
              :class="`ci-chip--status-${statusOf(f.fingerprint)}`"
            >{{ FINDING_STATUS_LABEL[statusOf(f.fingerprint)] }}</span>
            <code class="ci-finding__id">{{ f.id }}</code>
          </span>
          <span class="ci-finding__title">{{ f.title }}</span>
          <span class="ci-finding__meta">
```

  with

```vue
      <li
        v-for="f in findings"
        :key="f.fingerprint"
        class="ci-file-finding"
      >
        <!-- E20: a <button> holds phrasing content only, so every block is a <span>. -->
        <button
          type="button"
          class="ci-file-finding__review"
          @click="emit('review', f.fingerprint)"
        >
          <span class="ci-file-finding__head">
            <span
              class="ci-severity"
              :class="`ci-severity--${f.severity}`"
            >{{ SEVERITY_LABEL[f.severity] }}</span>
            <span
              class="ci-chip"
              :class="`ci-chip--status-${statusOf(f.fingerprint)}`"
            >{{ FINDING_STATUS_LABEL[statusOf(f.fingerprint)] }}</span>
            <code class="ci-ref-id">{{ f.id }}</code>
          </span>
          <span class="ci-file-finding__title">{{ f.title }}</span>
          <span class="ci-file-finding__meta">
```

  - `src/ui/screens/quality/FindingsTable.vue`: replace

```vue
          <span
            class="ci-finding__severity"
            :class="`ci-finding__severity--${row.severity}`"
          >{{ SEVERITY_LABEL[row.severity] }}</span>
```

  with

```vue
          <span
            class="ci-severity"
            :class="`ci-severity--${row.severity}`"
          >{{ SEVERITY_LABEL[row.severity] }}</span>
```

  and `<code class="ci-finding__id">{{ row.id }}</code>` with `<code class="ci-ref-id">{{ row.id }}</code>`.
  - `src/ui/screens/quality/FindingReviewDialog.vue`: replace `<code class="ci-finding__id">{{ finding.id }}</code>` with `<code class="ci-ref-id">{{ finding.id }}</code>`, and

```vue
        <span
          class="ci-finding__severity"
          :class="`ci-finding__severity--${finding.severity}`"
        >{{ SEVERITY_LABEL[finding.severity] }}</span>
```

  with

```vue
        <span
          class="ci-severity"
          :class="`ci-severity--${finding.severity}`"
        >{{ SEVERITY_LABEL[finding.severity] }}</span>
```

  - `src/ui/screens/hotspots/HotspotScatter.vue`: replace

```vue
    <figcaption class="ci-scatter__legend">
      <span
        v-for="band in BANDS"
        :key="band"
        class="ci-scatter__key"
        :class="`ci-scatter__key--${band}`"
      >{{ HOTSPOTS_BAND_LABEL[band] }}</span>
```

  with

```vue
    <figcaption class="ci-band-legend">
      <span
        v-for="band in BANDS"
        :key="band"
        class="ci-band-legend__key"
        :class="`ci-band-legend__key--${band}`"
      >{{ HOTSPOTS_BAND_LABEL[band] }}</span>
```

  - `src/ui/screens/test-confidence/CoverageMap.vue`: the same replacement with `COVERAGE_BAND_LABEL[band]` in place of `HOTSPOTS_BAND_LABEL[band]`.
  - `tests/component/file-detail-screen.test.ts:105`: `w.findAll('.ci-finding__review')` → `w.findAll('.ci-file-finding__review')`.
  - Confirm with `grep -rn "ci-finding__\|ci-scatter__legend\|ci-scatter__key\|class=\"ci-finding\"" src tests` that nothing is left (the retired list in the new test is the guard).
- [ ] **Step 6: Run and confirm it passes.** `npx vitest run tests/unit/css-class-scope.test.ts tests/unit/kit-css-fallbacks.test.ts tests/unit/city-stage-floor.test.ts tests/component/file-detail-screen.test.ts tests/component/quality-screen.test.ts tests/component/hotspots-screen.test.ts tests/component/tests-screen.test.ts tests/component/overview-screen.test.ts tests/component/architecture-screen.test.ts tests/component/evolution-screen.test.ts tests/component/report-screen.test.ts tests/component/workbench-screen.test.ts tests/harness/harness.test.ts`, then the gate, plus `npx eslint src/ui/screens/file/FileFindingsPanel.vue src/ui/screens/quality/FindingsTable.vue src/ui/screens/quality/FindingReviewDialog.vue src/ui/screens/hotspots/HotspotScatter.vue src/ui/screens/test-confidence/CoverageMap.vue tests/unit/css-class-scope.test.ts tests/component/file-detail-screen.test.ts --max-warnings 0`. Paste the final `offenders` (empty) and the list of cross-owner roots the scan now reports, with their owners, in your report.
- [ ] **Step 7: Commit.** `refactor(ui): severity, ref id, band legend, file cell, priority and screen base in the kit; guard every screen block (V20, V21)`

---

### Task 13: Minors: axis guards, Markdown wording, byte units, provider groups, editor labels (V24, V25, V26, V28, V29)

Five small, independent fixes. Each has its own failing test.

**Files:**
- Modify: `src/ui/kit/chart-scale.ts` (21 → ~24): `niceTicks` guards; delete `niceMax`
- Modify: `src/ui/export/markdown.ts` (48 → ~56): `mdValue` for `failed`/`excluded`; `escapeBlockStart` escapes a leading `|`
- Modify: `src/ui/read-models/sources.ts` (86 → ~89): `formatBytes`
- Modify: `src/ui/screens/sources/ProviderGrid.vue` (60 → ~72): the route group, the button names, the article label
- Modify: `src/ui/audit-copy/sources.ts` (48 → ~52, or whatever Task 3 left it at, plus 4): two copy functions
- Modify: `src/ui/styles/screens-act.css` (83 → 83): `.ci-work-editor__label`
- Modify: `src/ui/screens/workbench/WorkItemEditor.vue` (300 → ~315): the label class on all five `<label>`s
- Test: `tests/unit/chart-scale.test.ts` (30 → ~50), `tests/unit/markdown.test.ts` (30 → ~45), `tests/unit/sources-model.test.ts` (52 → ~61), `tests/component/sources-screen.test.ts` (88 → ~112, or Task 3's size plus 24), `tests/component/workbench-screen.test.ts` (247 → ~262)

**Interfaces:**
- Consumes: `EVIDENCE_LABELS`, `hasValue`, `MetricValue` (`src/ui/evidence.ts`); `ROUTE_META` (`src/ui/routes.ts`); `useUniqueId(prefix: string): string` (`src/ui/unique-id.ts`).
- Produces:
  - `niceTicks(value: number, target = 4, floor = 10): NiceScale` (unchanged signature). A `target` or `floor` that is not a finite number > 0 falls back to 4 or 10.
  - `niceMax` is **removed**. It has no production caller (ledger T17).
  - `mdValue(m, unit)`: a value-less `failed` or `excluded` reads `failed (reason)` / `excluded (reason)`, or just `failed` / `excluded` when there is no reason. `unknown` is unchanged.
  - `formatBytes(n)`: picks the unit after rounding to one decimal, and writes `1 byte` in the singular.
  - Copy in `src/ui/audit-copy/sources.ts`: `SOURCES_USED_BY_GROUP = (provider: string): string => \`${provider} is used by\``, and `SOURCES_OPEN_ROUTE = (title: string): string => \`Open ${title}\``.
  - The class `ci-work-editor__label` is on every editor field label.

- [ ] **Step 1: Write the failing tests.**

  **(a)** Replace the whole of `tests/unit/chart-scale.test.ts` with the code below. It removes the `niceMax` import and test, and adds the guard test and the floor-100 sweep.

```ts
import { describe, expect, it } from 'vitest';
import { niceTicks } from '../../src/ui/kit/chart-scale';

const evenIntegers = (ticks: readonly number[]): boolean => ticks.length > 1
  && ticks.every((t) => Number.isInteger(t))
  && ticks.every((t, i) => i === 0 || (t - ticks[i - 1]!) === (ticks[1]! - ticks[0]!));

describe('niceTicks (E55)', () => {
  it('never produces 12.5-style ticks', () => {
    expect(niceTicks(50)).toEqual({ max: 60, step: 20, ticks: [0, 20, 40, 60] });
    expect(niceTicks(37)).toEqual({ max: 40, step: 10, ticks: [0, 10, 20, 30, 40] });
  });
  it('keeps the floor and uses 2.5 steps only from 10 up', () => {
    expect(niceTicks(0)).toEqual({ max: 10, step: 5, ticks: [0, 5, 10] });
    expect(niceTicks(3)).toEqual({ max: 10, step: 5, ticks: [0, 5, 10] });
    expect(niceTicks(100, 4, 100)).toEqual({ max: 100, step: 25, ticks: [0, 25, 50, 75, 100] });
    expect(niceTicks(137, 4, 100)).toEqual({ max: 150, step: 50, ticks: [0, 50, 100, 150] });
  });
  it('gives evenly spaced integer ticks whose last tick is the max, across a range of inputs', () => {
    for (let v = 0; v <= 5000; v += 7) {
      for (const target of [4, 5]) {
        const s = niceTicks(v, target);
        expect(evenIntegers(s.ticks), `${v}/${target}`).toBe(true);
        expect(s.ticks[s.ticks.length - 1]).toBe(s.max);
        expect(s.max).toBeGreaterThanOrEqual(Math.max(10, v));
      }
    }
  });
  it('keeps the same guarantees at floor 100, the only floor a chart passes (LineChart) (Part 5 V24)', () => {
    for (let v = 0; v <= 5000; v += 7) {
      for (const target of [4, 5]) {
        const s = niceTicks(v, target, 100);
        expect(evenIntegers(s.ticks), `${v}/${target}/100`).toBe(true);
        expect(s.ticks[s.ticks.length - 1]).toBe(s.max);
        expect(s.max).toBeGreaterThanOrEqual(Math.max(100, v));
      }
    }
  });
  it('falls back to the default target (4) and floor (10) when either is not a finite number above 0 (Part 5 V24)', () => {
    const bad = [0, -2, Number.NaN, Number.POSITIVE_INFINITY];
    for (const target of bad) expect(niceTicks(50, target), `target ${target}`).toEqual(niceTicks(50));
    // Value 3 sits below the default floor, so a floor that is ignored instead of replaced shows.
    for (const floor of bad) expect(niceTicks(3, 4, floor), `floor ${floor}`).toEqual(niceTicks(3));
    expect(niceTicks(0, 0, 0)).toEqual({ max: 10, step: 5, ticks: [0, 5, 10] });
  });
});
```

  **(b)** In `tests/unit/markdown.test.ts`, add these two tests as the last ones inside the `describe`:

```ts
  it('names a failed or excluded value by its state, with its reason when there is one (Part 5 V25)', () => {
    const none = { source: 'none' };
    expect(mdValue({ state: 'failed', provenance: none, reason: 'The coverage run crashed' })).toBe('failed (The coverage run crashed)');
    expect(mdValue({ state: 'excluded', provenance: none, reason: 'Outside the approved scope' })).toBe('excluded (Outside the approved scope)');
    expect(mdValue({ state: 'failed', provenance: none })).toBe('failed');
    expect(mdValue({ state: 'excluded', provenance: none })).toBe('excluded');
    expect(mdValue(unknown('No secret-scanning provider'))).toBe('unknown (No secret-scanning provider)');
  });
  it('escapes a leading pipe, so neither a line nor a quoted note line can start a table row (Part 5 V25)', () => {
    expect(mdLine('| a | b |')).toBe('\\| a | b |');
    expect(mdLine('  |x')).toBe('  \\|x');
    expect(mdQuote('| a |\nok')).toBe('> \\| a |\n> ok');
  });
```

  **(c)** In `tests/unit/sources-model.test.ts`, add this test after `'formats byte limits'`:

```ts
  it('picks the unit after rounding, so a limit never reads "1,000 KB", and says "1 byte" (Part 5 V26)', () => {
    expect(formatBytes(999_999)).toBe('1 MB');
    expect(formatBytes(999_950)).toBe('1 MB');
    expect(formatBytes(999_949)).toBe('999.9 KB');
    expect(formatBytes(1_000)).toBe('1 KB');
    expect(formatBytes(999)).toBe('999 bytes');
    expect(formatBytes(1)).toBe('1 byte');
    expect(formatBytes(0)).toBe('0 bytes');
  });
```

  **(d)** In `tests/component/sources-screen.test.ts`, add this test as the last one inside the `describe`:

```ts
  it('groups each provider\'s route buttons under "<Provider> is used by", names each button after its screen, and labels each card by its heading (Part 5 V28)', () => {
    const w = mountS();
    const cards = w.findAll('.ci-provider');
    expect(cards).toHaveLength(8);
    const headingIds = new Set<string>();
    for (const card of cards) {
      const heading = card.find('.ci-provider__name');
      const id = heading.attributes('id') ?? '';
      expect(id, 'the provider heading has an id').not.toBe('');
      expect(card.attributes('aria-labelledby')).toBe(id);
      headingIds.add(id);
      const group = card.find('.ci-provider__routes');
      expect(group.attributes('role')).toBe('group');
      expect(group.attributes('aria-label')).toBe(`${heading.text()} is used by`);
      const buttons = group.findAll('.ci-provider__route');
      expect(buttons.length).toBeGreaterThan(0);
      for (const b of buttons) expect(b.attributes('aria-label')).toBe(`Open ${b.text()}`);
    }
    expect(headingIds.size, 'every card has its own heading id').toBe(8);
    w.unmount();
  });
```

  **(e)** In `tests/component/workbench-screen.test.ts`, add this test as the last one inside the `describe`:

```ts
  it('gives every editor field label the one label style: the real <label>s and the Target caption alike (Part 5 V29)', async () => {
    const ids = withSnapshot();
    useCityStore().select(ids[0]!);
    const w = mountW();
    await nextTick();
    // Create mode shows all five labelled fields (title, priority, status, intent, notes).
    await w.find('.ci-workbench__new').trigger('click');
    const labels = w.findAll('.ci-work-editor label[for]');
    expect(labels).toHaveLength(5);
    expect(labels.every((l) => l.classes('ci-work-editor__label'))).toBe(true);
    expect(w.findAll('.ci-work-editor__label')).toHaveLength(6);
    w.unmount();
  });
```

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run tests/unit/chart-scale.test.ts tests/unit/markdown.test.ts tests/unit/sources-model.test.ts tests/component/sources-screen.test.ts tests/component/workbench-screen.test.ts`. Expected failures:
  - **chart-scale, the guard test:** `niceTicks(50, 0)` returns `{ max: NaN, step: NaN, ticks: [] }`. `niceTicks(3, 4, 0)` returns `{ max: 3, step: 1, … }`, not the floor-10 scale. The floor-100 sweep **passes** already: it pins existing behaviour at the real floor, which V24 asks for as coverage. To show it can fail, temporarily change `Math.ceil(top / step)` to `Math.round(top / step)` in `niceTicks`. The sweep then goes red (`max` < `v` at v = 120), and the three older tests stay green. Revert the change.
  - **markdown:** `mdValue` returns `'unknown (The coverage run crashed)'` and `'unknown (Failed)'`. `mdLine('| a | b |')` returns the pipe unescaped.
  - **sources-model:** `formatBytes(999_999)` is `'1,000 KB'`, and `formatBytes(1)` is `'1 bytes'`.
  - **sources-screen:** `aria-labelledby` is undefined, because the heading has no id.
  - **workbench-screen:** the five `<label>`s have no class, so `.every` is false.
- [ ] **Step 3: `niceTicks` (V24).** In `src/ui/kit/chart-scale.ts`, replace:

```ts
export function niceTicks(value: number, target = 4, floor = 10): NiceScale {
  const top = Math.max(floor, Number.isFinite(value) ? value : 0);
  const raw = top / target;
```

  with:

```ts
/** Part 5 V24: a target or floor that is not a finite number above 0 falls back to its
 *  default, so no caller can produce a NaN or empty axis. */
const positiveOr = (v: number, fallback: number): number => (Number.isFinite(v) && v > 0 ? v : fallback);

export function niceTicks(value: number, target = 4, floor = 10): NiceScale {
  const top = Math.max(positiveOr(floor, 10), Number.isFinite(value) ? value : 0);
  const raw = top / positiveOr(target, 4);
```

  Delete the last line of the file and the blank line before it:

```ts

export const niceMax = (v: number): number => niceTicks(v).max;
```

  Then run `grep -rn "niceMax" src tests`. It must print nothing.
- [ ] **Step 4: Markdown (V25).** In `src/ui/export/markdown.ts`:
  - Replace the body of `escapeBlockStart`:

```ts
  return s.replace(/^(\s*)([#>*+-])/, '$1\\$2').replace(/^(\s*\d+)\./, '$1\\.');
```

    with:

```ts
  return s.replace(/^(\s*)([#>*+|-])/, '$1\\$2').replace(/^(\s*\d+)\./, '$1\\.');
```

  - Extend the doc comment above it. Change `a leading \`#\`, \`>\`, \`*\`, \`+\`, \`-\` or \`N.\` would` to `a leading \`#\`, \`>\`, \`*\`, \`+\`, \`-\`, \`|\` (a table row, Part 5 V25) or \`N.\` would`.
  - Replace the first line of `mdValue`:

```ts
  if (!hasValue(m)) return `unknown (${m.reason ?? EVIDENCE_LABELS[m.state]})`;
```

    with:

```ts
  if (!hasValue(m)) {
    // Part 5 V25: a failed or excluded value says so rather than reading "unknown (Failed)".
    if (m.state === 'failed' || m.state === 'excluded') {
      const label = EVIDENCE_LABELS[m.state].toLowerCase();
      return m.reason ? `${label} (${m.reason})` : label;
    }
    return `unknown (${m.reason ?? EVIDENCE_LABELS[m.state]})`;
  }
```

- [ ] **Step 5: `formatBytes` (V26).** In `src/ui/read-models/sources.ts`, replace:

```ts
export function formatBytes(n: number): string {
  if (n >= 1_000_000) return `${formatFixed(n / 1_000_000)} MB`;
  if (n >= 1_000) return `${formatFixed(n / 1_000)} KB`;
  return `${n} bytes`;
}
```

  with:

```ts
/** Part 5 V26: the unit is picked AFTER rounding to one decimal. Rounding is counted in
 *  tenths of a KB, which is exact for whole byte counts, so 999,950 bytes and up read
 *  "1 MB" and never "1,000 KB". */
export function formatBytes(n: number): string {
  if (Math.round(n / 100) >= 10_000) return `${formatFixed(n / 1_000_000)} MB`;
  if (n >= 1_000) return `${formatFixed(n / 1_000)} KB`;
  return n === 1 ? '1 byte' : `${n.toLocaleString('en-US')} bytes`;
}
```

- [ ] **Step 6: Copy (V28).** Append to `src/ui/audit-copy/sources.ts`:

```ts
/** Part 5 V28: the provider's route buttons form a group named after the provider, and
 *  each button's name contains its visible screen title (WCAG 2.5.3). */
export const SOURCES_USED_BY_GROUP = (provider: string): string => `${provider} is used by`;
export const SOURCES_OPEN_ROUTE = (title: string): string => `Open ${title}`;
```

- [ ] **Step 7: ProviderGrid (V28).** Replace the whole of `src/ui/screens/sources/ProviderGrid.vue` with:

```vue
<script setup lang="ts">
import type { RouteId } from '../../../domain/route-ids';
import type { ProviderCard } from '../../read-models/sources';
import { ROUTE_META } from '../../routes';
import { useUniqueId } from '../../unique-id';
import { SOURCES_OPEN_ROUTE, SOURCES_PROVIDERS_TITLE, SOURCES_USED_BY, SOURCES_USED_BY_GROUP } from '../../inspector-copy';
import Icon from '../../kit/Icon.vue';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';

defineProps<{ providers: readonly ProviderCard[] }>();
const emit = defineEmits<{ open: [route: RouteId] }>();
/** Part 5 V28: one unique base per grid. Each card's heading id adds the provider id, so
 *  every article is labelled by its own h4. */
const base = useUniqueId('ci-provider');
</script>

<template>
  <section class="ci-providers">
    <h3 class="ci-providers__title">
      {{ SOURCES_PROVIDERS_TITLE }}
    </h3>
    <div class="ci-providers__grid">
      <article
        v-for="p in providers"
        :key="p.id"
        class="ci-provider"
        :class="`ci-provider--${p.id}`"
        :aria-labelledby="`${base}-${p.id}-name`"
      >
        <div class="ci-provider__head">
          <span class="ci-provider__icon">
            <Icon :name="p.icon" />
          </span>
          <ProvenanceBadge
            v-if="p.state !== 'collected'"
            :state="p.state"
          />
        </div>
        <h4
          :id="`${base}-${p.id}-name`"
          class="ci-provider__name"
        >
          {{ p.title }}
        </h4>
        <p class="ci-note">
          {{ p.source }}
        </p>
        <p class="ci-provider__text">
          {{ p.description }}
        </p>
        <div
          class="ci-provider__routes"
          role="group"
          :aria-label="SOURCES_USED_BY_GROUP(p.title)"
        >
          <span class="ci-note">
            {{ SOURCES_USED_BY }}
          </span>
          <button
            v-for="r in p.routes"
            :key="r"
            type="button"
            class="ci-provider__route"
            :aria-label="SOURCES_OPEN_ROUTE(ROUTE_META[r].title)"
            @click="emit('open', r)"
          >
            {{ ROUTE_META[r].title }}
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
```

- [ ] **Step 8: The editor label style (V29).**
  - In `src/ui/styles/screens-act.css`, replace:

```css
:where(.codebase-inspector-root) .ci-work-editor__label { color: var(--ci-text-muted); font-size: var(--font-ui-smaller, 0.8em); }
```

    with:

```css
:where(.codebase-inspector-root) .ci-work-editor__label { color: var(--ci-text); font-size: var(--font-ui-small, 0.9em); font-weight: var(--font-medium, 500); }
```

  - In `src/ui/screens/workbench/WorkItemEditor.vue`, each field label is a standalone `<label :for>` next to its control, not wrapped around it. The class goes on the `<label>` itself, and `:for` keeps the association. The Target caption `<span class="ci-work-editor__label">` already has the class. Make these five replacements, keeping each line's indentation:
    - `<label :for="\`${base}-title\`">{{ WORK_FIELD_TITLE }}</label>` (6 spaces) becomes:

```vue
      <label
        :for="`${base}-title`"
        class="ci-work-editor__label"
      >{{ WORK_FIELD_TITLE }}</label>
```

    - `<label :for="\`${base}-priority\`">{{ WORK_FIELD_PRIORITY }}</label>` (10 spaces) becomes:

```vue
          <label
            :for="`${base}-priority`"
            class="ci-work-editor__label"
          >{{ WORK_FIELD_PRIORITY }}</label>
```

    - `<label :for="\`${base}-status\`">{{ WORK_FIELD_STATUS }}</label>` (10 spaces) becomes:

```vue
          <label
            :for="`${base}-status`"
            class="ci-work-editor__label"
          >{{ WORK_FIELD_STATUS }}</label>
```

    - `<label :for="\`${base}-intent\`">{{ WORK_FIELD_INTENT }}</label>` (10 spaces) becomes:

```vue
          <label
            :for="`${base}-intent`"
            class="ci-work-editor__label"
          >{{ WORK_FIELD_INTENT }}</label>
```

    - `<label :for="\`${base}-notes\`">{{ WORK_FIELD_NOTES }}</label>` (6 spaces) becomes:

```vue
      <label
        :for="`${base}-notes`"
        class="ci-work-editor__label"
      >{{ WORK_FIELD_NOTES }}</label>
```

  - The checklist's wrapping `<label class="ci-work-editor__check">` elements in `WorkChecklist.vue` are checkbox captions, not field labels. Leave them alone.
- [ ] **Step 9: Run and confirm they pass.** Run `npx vitest run tests/unit/chart-scale.test.ts tests/unit/markdown.test.ts tests/unit/sources-model.test.ts tests/unit/report-model.test.ts tests/component/report-screen.test.ts tests/component/sources-screen.test.ts tests/component/workbench-screen.test.ts tests/component/kit-display.test.ts tests/component/kit-interactive.test.ts tests/unit/kit-css-fallbacks.test.ts`. The two kit tests mount BarChart and LineChart. Then run the gate and `npx eslint src/ui/kit/chart-scale.ts src/ui/export/markdown.ts src/ui/read-models/sources.ts src/ui/screens/sources/ProviderGrid.vue src/ui/audit-copy/sources.ts src/ui/screens/workbench/WorkItemEditor.vue tests/unit/chart-scale.test.ts tests/unit/markdown.test.ts tests/unit/sources-model.test.ts tests/component/sources-screen.test.ts tests/component/workbench-screen.test.ts --max-warnings 0`. Report `wc -l` of `WorkItemEditor.vue`. The expected value is about 315.
- [ ] **Step 10: Commit.** `fix(ui): niceTicks guards, failed/excluded Markdown wording, formatBytes rounding, grouped provider routes, editor label style (V24–V26, V28, V29)`

---

### Task 14: Missing and weak tests (V32)

Tests only. Every test below pins behaviour **that already exists**, so each one passes when it is first run. The RED evidence for each is a **mutation check**:
1. make the one named source edit (with the Edit tool);
2. run the test and paste the failure;
3. revert the edit.

`git diff --stat src` must be empty before you commit.

If a test fails *before* its mutation, that is a real bug. Stop and report it. Do not change `src` to make it pass.

The editor's "return focus to the filter" behaviour already exists: `WorkbenchScreen.vue` `closeEditor` focuses `.ci-workbench__filter` whenever focus is outside the screen after the dialog closes. So (d) needs no source change.

**Files:**
- Modify: `tests/unit/kit-css-fallbacks.test.ts` (43 → ~62): X17
- Create: `tests/unit/review-clear-all.test.ts` (~95): `clearAll` partial failure, the first rejection, and the race
- Modify: `tests/component/settings-screen.test.ts` (118 → ~124, or Task 9's size plus 6): the rejecting-clear test gets a repository that holds the item
- Modify: `tests/component/sources-screen.test.ts` (+2 lines): the route at `onSelectCodebase` call time
- Create: `tests/component/work-editor-focus.test.ts` (~80): Delete, Keep, and deleting the opener's item
- Create: `tests/component/workbench-guards.test.ts` (~110): the X6 guard under a concurrent removal, New work item's `aria-describedby`, and the observed `''` between identical outcomes
- Create: `tests/component/quality-dialog-status.test.ts` (~55): the dialog status is `''` while a decision is in flight (Part 4 E2)

**Interfaces:**
- Consumes (existing, unchanged):
  - `useReviewStore()`: `clearAll`, `updateWorkItem`, `removeWorkItem`, `setRepository`, `isItemPending`, `pendingItemIds`, `workItems`, `rules`, `dispositions`, `addWorkItemForFile`, `addRule`, `acknowledge`, `isDispositionPending`;
  - `createInMemoryReviewRepository()`, `makeEntityId(repositoryId, kind, path)`;
  - `WorkbenchScreen.vue` classes `.ci-work-card`, `.ci-work-editor__delete|__confirm-delete|__keep`, `.ci-workbench__filter|__live|__new|__new-hint`;
  - `QualityScreen.vue`, whose row button is `.ci-findings-table__open` **after Task 11**, and `.ci-finding-dialog__acknowledge|__reopen`;
  - copy `WORKBENCH_NEW_HINT`, `FINDING_ACKNOWLEDGED`, `FINDING_REOPENED`.
- Produces: tests only.

- [ ] **Step 1: (a) X17, the stylesheet list comes from the folder.** In `tests/unit/kit-css-fallbacks.test.ts`:
  - Replace `import { readFileSync } from 'node:fs';` with `import { readdirSync, readFileSync } from 'node:fs';`.
  - After the `SCREEN_SHEETS` line, add:

```ts
/** Part 4 X17: the cascade order. styles.css (the WP-01 token bridge) always comes first. */
const CASCADE = ['kit.css', 'shell.css', ...SCREEN_SHEETS] as const;
const CASCADE_PATHS = ['styles.css', ...CASCADE.map((n) => `styles/${n}`)];
```

  - Replace the whole `it('main.ts imports every stylesheet in cascade order (E55)', () => { … });` block with:

```ts
  it('the sheet list is the folder on disk, so a new stylesheet fails here until it is wired in (Part 4 X17)', () => {
    const onDisk = readdirSync(resolve(process.cwd(), 'src', 'ui', 'styles')).filter((n) => n.endsWith('.css')).sort();
    expect(onDisk).toEqual([...CASCADE].sort());
  });

  it('main.ts imports styles.css first, then every sheet in cascade order, and nothing else (E55, X17)', () => {
    const main = readFileSync(resolve(process.cwd(), 'src', 'main.ts'), 'utf8');
    const imported = [...main.matchAll(/^import '\.\/ui\/([\w/.-]+\.css)';/gm)].map((m) => m[1]);
    expect(imported).toEqual(CASCADE_PATHS);
  });

  it('the harness serves the same sheets in the same order (X17)', () => {
    const config = readFileSync(resolve(process.cwd(), 'vite.harness.config.ts'), 'utf8');
    const list = /const pluginStylesheets = \[([\s\S]*?)\]/.exec(config);
    expect(list, 'vite.harness.config.ts no longer declares pluginStylesheets').not.toBeNull();
    const served = [...list![1]!.matchAll(/'([\w/.-]+\.css)'/g)].map((m) => m[1]);
    expect(served).toEqual(CASCADE_PATHS);
  });
```

  The old test only looked up names from its own hard-coded list, so it could not notice an eighth sheet (the tautology). The new ones compare against the folder and against the exact import list.
- [ ] **Step 2: (b) `clearAll`.** Create `tests/unit/review-clear-all.test.ts`:

```ts
// Part 5 V32 (Part 4 E22 "the untested clearAll race and rethrow"): clearAll attempts every
// removal, reloads from the port, and rethrows the FIRST rejection in removal order; and a
// clear racing a pending update leaves neither a ghost item nor a stuck pending id.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';

const NOW = new Date('2026-09-22T10:00:00Z');

/** Two work items (wi-1, wi-2), one rule (AR-001) and one disposition, held by `inner`. */
async function seeded() {
  const inner = createInMemoryReviewRepository();
  const store = useReviewStore();
  store.setRepository(inner);
  await store.addWorkItemForFile('e1', 'One', NOW);
  await store.addWorkItemForFile('e2', 'Two', NOW);
  await store.addRule('a', 'b', 'why', NOW);
  await store.acknowledge('e1#CX-1', NOW);
  return { store, inner };
}

describe('review-store clearAll (Part 5 V32)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

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

  it('a clear racing a pending update leaves no ghost item and no stuck pending id', async () => {
    const { store, inner } = await seeded();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    store.setRepository({ ...inner, saveWorkItem: (item) => gate.then(() => inner.saveWorkItem(item)) });
    const update = store.updateWorkItem('wi-1', { title: 'Renamed' }, NOW);
    expect(store.isItemPending('wi-1')).toBe(true);
    await store.clearAll();
    expect(store.workItems).toHaveLength(0);
    release?.();
    await update;
    await flushPromises();
    expect(store.workItems, 'the settled update must not re-insert the cleared item').toHaveLength(0);
    expect(store.pendingItemIds).toEqual([]);
    expect(store.isItemPending('wi-1')).toBe(false);
  });
});
```

- [ ] **Step 3: (b) The Settings gap.** In `tests/component/settings-screen.test.ts`:
  - Add `import { makeEntityId } from '../../src/domain/entity-id';` after the `createInMemoryReviewRepository` import.
  - In the test `'a rejecting repository keeps the dialog open, shows the error, and keeps the review state (fix round 1, Minor 5)'`, replace:

```ts
    const review = useReviewStore();
    await review.addWorkItemForFile('repo\0file\0src/a.ts', 'A', new Date());
    useReportStore().applyNote('keep?');
    review.setRepository({ ...createInMemoryReviewRepository(), removeWorkItem: () => Promise.reject(new Error('disk')) });
```

    with:

```ts
    const review = useReviewStore();
    // Part 5 V32: the rejecting repository must HOLD the item. With an empty one, the reload
    // inside clearAll emptied the list, and "keeps the review state" was never checked.
    const repo = createInMemoryReviewRepository();
    review.setRepository({ ...repo, removeWorkItem: () => Promise.reject(new Error('disk')) });
    await review.addWorkItemForFile(makeEntityId('repo', 'file', 'src/a.ts'), 'A', new Date());
    expect(await repo.listWorkItems()).toHaveLength(1);
    useReportStore().applyNote('keep?');
```

  - In the same test, after `expect(useReportStore().note).toBe('keep?');`, add `expect(useReviewStore().workItems).toHaveLength(1);`.
- [ ] **Step 4: (c) Change source ordering.** In `tests/component/sources-screen.test.ts`, test `'Rescan and Change source go to the city first, then call the host'`:
  - Replace `const select = vi.fn();` with:

```ts
    let routeAtSelect = '';
    const select = vi.fn(() => { routeAtSelect = useCityStore().route; });
```

  - Replace `expect(useCityStore().route).toBe('city');` (the last assertion of that test) with `expect(routeAtSelect).toBe('city');`.
- [ ] **Step 5: (d) Editor focus moves.** Create `tests/component/work-editor-focus.test.ts`:

```ts
// Part 5 V32 (Part 4 E22 "untested editor focus moves"): Delete moves focus to the
// confirm button, Keep returns it to Delete, and deleting the item whose card opened the
// editor lands focus on the filter — never the shell, never <body>.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import WorkbenchScreen from '../../src/ui/screens/WorkbenchScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const NOW = new Date('2026-09-22T10:00:00Z');
async function withItems(count: number): Promise<void> {
  const snap = buildSnapshotFixture({ files: 12, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
  const ids = snap.entities.filter((e) => e.kind === 'file').map((e) => e.id);
  for (let i = 0; i < count; i += 1) await useReviewStore().addWorkItemForFile(ids[i]!, `Item ${i + 1}`, NOW);
}
/** A focusable `.ci-shell` around the screen, as App.vue provides, so CiDialog's real
 *  fallback (focus the shell when the opener is gone) runs. */
function mountInShell() {
  const shell = document.body.createDiv({ cls: 'ci-shell' });
  shell.tabIndex = -1;
  const w = mount(WorkbenchScreen, { attachTo: shell, global: { provide: { onSelectCodebase: vi.fn() } } });
  return { w, done: () => { w.unmount(); shell.remove(); } };
}
/** Opens the first card's editor the way a keyboard user does: the card has focus. */
async function openFirstCard(w: ReturnType<typeof mountInShell>['w']): Promise<Element> {
  const card = w.find('.ci-work-card');
  (card.element as HTMLElement).focus();
  await card.trigger('click');
  await nextTick();
  return card.element;
}

describe('Work-item editor focus (Part 5 V32)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('Delete moves focus to the confirm button', async () => {
    await withItems(1);
    const { w, done } = mountInShell();
    await openFirstCard(w);
    await w.find('.ci-work-editor__delete').trigger('click');
    await nextTick();
    expect(document.activeElement).toBe(w.find('.ci-work-editor__confirm-delete').element);
    done();
  });

  it('Keep returns focus to Delete', async () => {
    await withItems(1);
    const { w, done } = mountInShell();
    await openFirstCard(w);
    await w.find('.ci-work-editor__delete').trigger('click');
    await nextTick();
    await w.find('.ci-work-editor__keep').trigger('click');
    await nextTick();
    expect(document.activeElement).toBe(w.find('.ci-work-editor__delete').element);
    done();
  });

  it('deleting the item whose card opened the editor lands focus on the filter, not the shell', async () => {
    await withItems(2);
    const { w, done } = mountInShell();
    const opener = await openFirstCard(w);
    await w.find('.ci-work-editor__delete').trigger('click');
    await w.find('.ci-work-editor__confirm-delete').trigger('click');
    await flushPromises();
    expect(w.find('.ci-work-editor').exists()).toBe(false);
    expect(opener.isConnected, 'the opener card went with its item').toBe(false);
    expect(w.findAll('.ci-work-card'), 'the other item still has a card').toHaveLength(1);
    expect(document.activeElement).toBe(w.find('.ci-workbench__filter').element);
    done();
  });
});
```

- [ ] **Step 6: (e) and (f), the Workbench guards and the intermediate `''`.** Create `tests/component/workbench-guards.test.ts`:

```ts
// Part 5 V32: the X6 `removing` guard under a real concurrent removal, New work item's
// description, and the observed '' between two identical outcomes (Part 4 E18).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import WorkbenchScreen from '../../src/ui/screens/WorkbenchScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { WORKBENCH_NEW_HINT } from '../../src/ui/inspector-copy';

const NOW = new Date('2026-09-22T10:00:00Z');
function withSnapshot() {
  const snap = buildSnapshotFixture({ files: 12, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap.entities.filter((e) => e.kind === 'file').map((e) => e.id);
}
const mountW = () => mount(WorkbenchScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

/** Every text the region was set to, in order. It is read from the mutation records
 *  themselves (the nodes each write added), not from the live DOM when the callback
 *  runs, so two writes that land before one callback are still two entries. A write
 *  that empties the region adds no node and is recorded as ''. */
function textHistory(el: Element): { seen: string[]; stop: () => void } {
  const seen: string[] = [];
  const take = (records: MutationRecord[]): void => {
    for (const r of records) {
      if (r.type === 'characterData') seen.push((r.target.textContent ?? '').trim());
      else seen.push(Array.from(r.addedNodes).map((n) => n.textContent ?? '').join('').trim());
    }
  };
  const observer = new MutationObserver(take);
  observer.observe(el, { childList: true, characterData: true, subtree: true });
  return { seen, stop: () => { take(observer.takeRecords()); observer.disconnect(); } };
}

describe('Workbench guards (Part 5 V32)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('X6: an item removed by another path while its delete is in flight is still announced exactly once, and the editor closes', async () => {
    const ids = withSnapshot();
    const review = useReviewStore();
    const inner = createInMemoryReviewRepository();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let removals = 0;
    // The editor's removal waits on the gate; any later removal (Clear review state's) goes straight through.
    review.setRepository({
      ...inner,
      removeWorkItem: (id) => { removals += 1; return removals === 1 ? gate.then(() => inner.removeWorkItem(id)) : inner.removeWorkItem(id); },
    });
    await review.addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    const live = w.find('.ci-workbench__live').element;
    const history = textHistory(live);
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor__delete').trigger('click');
    await w.find('.ci-work-editor__confirm-delete').trigger('click');
    expect(review.isItemPending('wi-1')).toBe(true);
    // Another path takes the item away first: Clear review state removes it and reloads.
    await review.clearAll();
    await flushPromises();
    expect(review.workItems).toHaveLength(0);
    expect(w.find('.ci-work-editor').exists(), 'the X6 guard keeps the removing editor open').toBe(true);
    release?.();
    await flushPromises();
    history.stop();
    expect(w.find('.ci-work-editor').exists()).toBe(false);
    expect(live.textContent?.trim()).toBe('wi-1 deleted.');
    expect(history.seen.filter((t) => t === 'wi-1 deleted.')).toHaveLength(1);
    w.unmount();
  });

  it('New work item is described by its hint: aria-describedby names the hint paragraph\'s id', () => {
    const w = mountW();
    const hint = w.find('.ci-workbench__new-hint');
    const id = hint.attributes('id') ?? '';
    expect(id).not.toBe('');
    expect(w.find('.ci-workbench__new').attributes('aria-describedby')).toBe(id);
    expect(hint.text()).toBe(WORKBENCH_NEW_HINT);
    w.unmount();
  });

  it('Part 4 E18: a second identical outcome passes through an empty live region before it is set again', async () => {
    const ids = withSnapshot();
    await useReviewStore().addWorkItemForFile(ids[0]!, 'A', NOW);
    const w = mountW();
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor').trigger('submit');
    await flushPromises();
    const live = w.find('.ci-workbench__live').element;
    expect(live.textContent?.trim()).toBe('wi-1 updated.');
    const history = textHistory(live);
    await w.find('.ci-work-card').trigger('click');
    await w.find('.ci-work-editor').trigger('submit');
    await flushPromises();
    history.stop();
    expect(history.seen).toEqual(['', 'wi-1 updated.']);
    w.unmount();
  });
});
```

  Create `tests/component/quality-dialog-status.test.ts`. It uses Task 11's row button `.ci-findings-table__open`:

```ts
// Part 5 V32 (Part 4 E2): the finding dialog's status region is cleared to '' the moment a
// decision starts, and only then set to that decision's outcome — so a stale success never
// sits in role="status" while the next decision is in flight, and a repeat re-announces.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import QualityScreen from '../../src/ui/screens/QualityScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { FINDING_ACKNOWLEDGED, FINDING_REOPENED } from '../../src/ui/inspector-copy';

describe('Finding dialog status (Part 5 V32, Part 4 E2)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('is "" while a decision is in flight, between the previous outcome and the new one', async () => {
    const snap = buildSnapshotFixture({ files: 60, directories: 3 });
    useCityStore().setCity(snap, computeLayout(snap));
    const review = useReviewStore();
    const inner = createInMemoryReviewRepository();
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    review.setRepository({ ...inner, removeDisposition: (fp) => gate.then(() => inner.removeDisposition(fp)) });
    const w = mount(QualityScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
    const status = () => w.find('[role="dialog"] .ci-dialog__status').text();
    await w.findAll('.ci-findings-table__open')[0]!.trigger('click');
    await w.find('.ci-finding-dialog__acknowledge').trigger('click');
    await flushPromises();
    expect(status()).toBe(FINDING_ACKNOWLEDGED);
    await w.find('.ci-finding-dialog__reopen').trigger('click');
    await nextTick();
    expect(review.dispositions, 'the reopen is still in flight').toHaveLength(1);
    expect(status()).toBe('');
    release?.();
    await flushPromises();
    expect(status()).toBe(FINDING_REOPENED);
    w.unmount();
  });
});
```

  `useCsvExport` already observes the intermediate `''` (`tests/unit/use-csv-export.test.ts`). Leave it as it is.
- [ ] **Step 7: Run them.** Run `npx vitest run tests/unit/kit-css-fallbacks.test.ts tests/unit/review-clear-all.test.ts tests/component/settings-screen.test.ts tests/component/sources-screen.test.ts tests/component/work-editor-focus.test.ts tests/component/workbench-guards.test.ts tests/component/quality-dialog-status.test.ts`.
  - Expected: all pass. They pin behaviour that exists.
  - If any fails, stop and report it with the output. It is either a real bug or a Task 4/6/11 deviation. Do not edit `src`.
- [ ] **Step 8: Mutation checks (the RED evidence).** For each row:
  1. make the edit with the Edit tool;
  2. run only the named test file (`-t "<test name>"` is fine) and paste the failure;
  3. revert the edit.

| Test | Temporary edit | Why it goes red |
|---|---|---|
| X17: folder on disk | Write an empty `src/ui/styles/zz-probe.css`. Delete it afterwards with `Remove-Item`. | `onDisk` has 8 names, and `CASCADE` has 7. |
| X17: main.ts order | In `src/main.ts`, swap the `screens-act.css` and `screens-audit.css` import lines. | `imported` is out of cascade order. |
| X17: harness order | In `vite.harness.config.ts`, delete `'styles/screens-configure.css'` from `pluginStylesheets`. | `served` lacks the last sheet. |
| clearAll: every removal, reload, first rejection | In `review-store.ts` `clearAll`, change `const rejected = results.find(isRejected);` to `const rejected = [...results].reverse().find(isRejected);`. | It rethrows `second`, not `first`. |
| clearAll: reload | Delete the `finally { await this.load(); }` wrapper, keeping the `allSettled` line. | `listWorkItems` is never called. `workItems` still holds wi-2. |
| clearAll race: no ghost | In `updateWorkItem`, change `this.workItems = this.workItems.map((w) => (w.id === id ? next : w));` to `this.workItems = [...this.workItems.filter((w) => w.id !== id), next];`. | The settled update re-inserts wi-1. |
| clearAll race: no stuck id | In `updateWorkItem`, delete the `finally` body line `this.pendingItemIds = this.pendingItemIds.filter((p) => p !== id);`. | `pendingItemIds` stays `['wi-1']`. |
| Settings: keeps the review state | In `clearAll`, replace `await this.load();` in the `finally` block with `this.workItems = [];`. | `workItems` is 0, not 1. (Under the old empty repository this assertion was red even without an edit, which is the gap.) |
| Change source at call time | In `SourcesScreen.vue` `changeSource`, swap the two lines so `onSelectCodebase();` runs before `store.navigate('city');`. | `routeAtSelect` is `'sources'`. The old assertion (route after the call) stayed green. |
| Delete → confirm focused | In `WorkItemEditor.vue` `askDelete`, change `void nextTick(() => confirmButton.value?.focus());` to `void nextTick();`. | Focus stays on the title input. |
| Keep → Delete focused | In `keep`, change `void nextTick(() => deleteButton.value?.focus());` to `void nextTick();`. | Focus drops to `<body>` with the removed confirm button. |
| Delete opener → filter | In `WorkbenchScreen.vue` `closeEditor`, delete the line `if (el && !(active && el.contains(active))) el.querySelector<HTMLElement>('.ci-workbench__filter')?.focus();`. | Focus stays on the `.ci-shell` that CiDialog fell back to. |
| X6 under a concurrent removal | In `WorkItemEditor.vue`, change the watcher's `&& !removing.value` to nothing (`if (props.itemId !== null && now === null) emit('close');`). | clearAll's reload closes the editor. `done` is emitted on an unmounted component and dropped, so the "keeps the removing editor open" assertion and the announcement count both fail. |
| `aria-describedby` | In `WorkbenchScreen.vue`, delete `:aria-describedby="hintId"`. | The attribute is undefined. |
| E18 intermediate `''` | In `closeEditor`, delete `liveMessage.value = '';` and `await nextTick();` inside `if (message)`. After Task 4 this may be `reannounce(liveMessage, message)`: replace it with `liveMessage.value = message;`. | The identical text is never re-patched, so `seen` is `[]`. |
| Quality E2 `''` | In `FindingReviewDialog.vue` `run`, delete `status.value = '';`. | The status still reads `FINDING_ACKNOWLEDGED` while the reopen is in flight. |

  Afterwards, `git diff --stat -- src vite.harness.config.ts` must print nothing, and `src/ui/styles/zz-probe.css` must not exist.
- [ ] **Step 9: Run and confirm they pass.** Re-run the Step 7 command, then run the gate and `npx eslint tests/unit/kit-css-fallbacks.test.ts tests/unit/review-clear-all.test.ts tests/component/settings-screen.test.ts tests/component/sources-screen.test.ts tests/component/work-editor-focus.test.ts tests/component/workbench-guards.test.ts tests/component/quality-dialog-status.test.ts --max-warnings 0`.
- [ ] **Step 10: Commit.** `test(ui): X17 sheet list from disk, clearAll race and rethrow, editor focus moves, X6 under a concurrent removal, intermediate '' states (V32)`

---

### Task 15: Contrast decision #4 (V17)

**The owner chooses one option at the Phase 1 pause, and the controller records it as ruling T32.** The implementer receives this task with **one** option named, and implements **only** that option's steps. Options A, C and D are short variants of B, which is the recommended option.

Background, for every option:
- `src/ui/styles.css` lines 3–28 are the token bridge. `--ci-action` aliases `--interactive-accent`, `--ci-action-hover` aliases `--interactive-accent-hover`, `--ci-on-action` aliases `--text-on-accent`, and `--ci-raised` aliases `--background-primary-alt`. **Never edit `styles.css`.**
- Obsidian paints `button.mod-cta` with `--interactive-accent`, and `button.mod-warning` with `--background-modifier-error` (hover `…-error-hover`, the same colour in the default theme). Both set `--text-color: var(--text-on-accent)`. See `tests/harness/obsidian.css` lines 6719–6743. The selectors are `(0,1,1)`, and the hovers `(0,2,1)` inside `@media (hover: hover)`.
- Load order: `src/main.ts` imports `./ui/styles.css` and then `./ui/styles/kit.css`. `vite.harness.config.ts` `pluginStylesheets` lists `'styles.css'` and then `'styles/kit.css'`, and the bundle keeps import order. Both files scope with `:where(.codebase-inspector-root)`, which has zero specificity, so a same-selector rule in `kit.css` wins over `styles.css` on order. A plugin's `styles.css` is appended after Obsidian's `app.css`, so `:where(root) button.mod-cta` at `(0,1,1)` beats Obsidian's rule too. `tests/unit/kit-css-fallbacks.test.ts` (after Task 14) pins this order.
- Measured in the harness (spec §4):

| Pair | Dark | Light |
|---|---|---|
| on-action on action | 4.26 | 3.43 |
| `mod-warning` (rest and hover) | 3.45 | 4.20 |
| `--ci-raised` against panel | 1.03 | 1.04 |
| action mixed 80 % with black | 6.11 | 5.04 |
| error mixed 80 % with black | 5.10 | 6.11 |
| `--ci-text` 15 % over panel | 1.48 | 1.34 |
| Obsidian `--background-modifier-hover` against panel | 1.22 | 1.15 |

- Every text-on-colour button in the view:
  - `mod-cta`: `BoundaryRuleTable`, `RuleEditor`, `FileHeader` (`ci-file-detail__add`), `PriorityFormulaDialog`, `NoSnapshot`, `OverviewScreen` (`ci-overview__select-source`), `FindingReviewDialog` (`ci-finding-dialog__save-dismissal`), `ReportScreen` (`ci-report__export`), `EvidenceSourceDialog` (`ci-evidence-dialog__close`), `SourcesScreen` (`ci-sources__rescan`), `WorkItemEditor` (`ci-work-editor__save`), `WorkbenchScreen` (`ci-workbench__new`), plus any that Tasks 3, 9 and 11 added (for example Import's Replace).
  - `mod-warning`: `ClearReviewDialog` (`ci-clear-dialog__confirm`), `PrivacyRows` (`ci-settings__clear`), `WorkItemEditor` (`__delete`, `__confirm-delete`).
  - WP-01, in `styles.css`: `button.ci-welcome__action` (+ `:hover` on `--ci-action-hover`) and `button.ci-file-list__row--selected` (+ `--selected:hover`).
- Every hover that paints `--ci-raised`:
  - WP-01, in `styles.css`: `button.ci-app__mode-toggle:hover`, `button.ci-selection-notice__reveal:hover`, `button.ci-selection-notice__clear:hover`, `button.ci-app__drawer-close:hover`, `button.ci-toolbar__scan:hover`, `button.ci-file-list__group-focus:hover`, `.ci-camera-controls button:hover`.
  - WP-02: `kit.css` `.ci-table__row:hover` (with `:focus-visible`); `shell.css` `button.ci-nav__item:hover`; `screens.css` `button.ci-investigation:hover` and `button.ci-city-summary__card:hover`; `screens-explore.css` `button.ci-module-inspector__file:hover` and `button.ci-shortlist__item:hover`; the finding-review button hover (`button.ci-finding__review:hover` in `screens-audit.css` today, or `button.ci-file-finding__review:hover` in `screens-explore.css` after Task 12); `screens-audit.css` `button.ci-advisory__open:hover`. Re-run `grep -n ":hover" src/ui/styles/*.css` first, because Tasks 3, 11 and 12 may have added or moved some.

---

#### Option B (recommended): plugin-owned derived tokens in `kit.css`

**Files:**
- Modify: `src/ui/styles/kit.css` (Task 12's size + ~32): five derived tokens, the fill rules, the WP-01 overrides, and `.ci-table__row` hover
- Modify (one declaration each): `src/ui/styles/shell.css`, `src/ui/styles/screens.css`, `src/ui/styles/screens-explore.css`, `src/ui/styles/screens-audit.css`
- Create: `tests/unit/contrast-tokens.test.ts` (~110)
- Modify: `docs/superpowers/notes/2026-09-21-wp01b-open-decisions.md` (§4 status), `docs/superpowers/notes/2026-09-17-wp01-limitations.md` (one bullet)
- Scratch, not committed: `<your scratchpad>/contrast-check.mjs`

**Interfaces:**
- Produces, on `:where(.codebase-inspector-root)` in `kit.css`:
  - `--ci-action-fill: color-mix(in srgb, var(--interactive-accent) 80%, var(--text-on-accent-inverted, black))`
  - `--ci-action-fill-hover`: the same at 72 %
  - `--ci-danger-fill: color-mix(in srgb, var(--background-modifier-error) 80%, var(--text-on-accent-inverted, black))`
  - `--ci-danger-fill-hover`: the same at 72 %
  - `--ci-hover: color-mix(in srgb, var(--ci-text) 10%, var(--ci-panel))`
- No host variable is redefined. Mixing toward `--text-on-accent-inverted` darkens under white text and lightens under black text, so a theme with dark on-accent text also gains contrast.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/contrast-tokens.test.ts`:

```ts
// Part 5 V17, contrast decision #4 (option B): plugin-owned DERIVED fills and a hover
// surface in kit.css. kit.css loads after styles.css and both scope with the zero-
// specificity :where(root), so a same-selector rule here wins on order without editing
// styles.css. Static checks only; the real colours are measured in the harness.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI = resolve(process.cwd(), 'src', 'ui');
const ROOT = ':where(.codebase-inspector-root)';
const read = (path: string): string => readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const KIT = read(join(UI, 'styles', 'kit.css'));
const BRIDGE = read(join(UI, 'styles.css'));
const SHEETS = readdirSync(join(UI, 'styles')).filter((n) => n.endsWith('.css'));

interface Rule { selectors: string[]; body: string }
/** Innermost `selectors { body }` pairs. An at-rule's prelude never matches, because its
 *  block contains braces; the rules inside it do. */
function rules(css: string): Rule[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selectors: m[1]!.split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
    body: m[2]!,
  }));
}
/** The last value `css` declares for `property` under exactly `selector`, or null. */
function declared(css: string, selector: string, property: string): string | null {
  const pattern = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`);
  let value: string | null = null;
  for (const r of rules(css)) {
    if (!r.selectors.includes(selector)) continue;
    const m = pattern.exec(r.body);
    if (m) value = m[1]!.trim();
  }
  return value;
}
function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? vueFiles(p) : p.endsWith('.vue') ? [p] : [];
  });
}
const FILL: Readonly<Record<string, readonly [string, string]>> = {
  'mod-cta': ['var(--ci-action-fill)', 'var(--ci-action-fill-hover)'],
  'mod-warning': ['var(--ci-danger-fill)', 'var(--ci-danger-fill-hover)'],
};

describe('contrast decision #4, option B (Part 5 V17)', () => {
  it('derives the fills and the hover surface on the root from host variables, redefining none', () => {
    const mix = (host: string, pct: number) => `color-mix(in srgb, var(${host}) ${pct}%, var(--text-on-accent-inverted, black))`;
    expect(declared(KIT, ROOT, '--ci-action-fill')).toBe(mix('--interactive-accent', 80));
    expect(declared(KIT, ROOT, '--ci-action-fill-hover')).toBe(mix('--interactive-accent', 72));
    expect(declared(KIT, ROOT, '--ci-danger-fill')).toBe(mix('--background-modifier-error', 80));
    expect(declared(KIT, ROOT, '--ci-danger-fill-hover')).toBe(mix('--background-modifier-error', 72));
    expect(declared(KIT, ROOT, '--ci-hover')).toBe('color-mix(in srgb, var(--ci-text) 10%, var(--ci-panel))');
    expect(KIT).not.toMatch(/(?:^|[\s;{])--(?:background|text|interactive)-[\w-]+\s*:/);
  });

  it('puts every mod-cta and mod-warning in the view on a <button>, which the kit fill reaches', () => {
    const uses: string[] = [];
    for (const file of vueFiles(UI)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bclass="([^"]*)"/g)) {
        const classes = m[1]!.split(/\s+/);
        for (const mod of Object.keys(FILL)) {
          if (!classes.includes(mod)) continue;
          const tag = /^<([\w-]+)/.exec(text.slice(text.lastIndexOf('<', m.index)))?.[1];
          uses.push(`${relative(UI, file)} ${mod}`);
          expect(tag, `${relative(UI, file)} puts ${mod} on <${tag ?? '?'}>`).toBe('button');
        }
      }
    }
    expect(uses.length, 'the sweep found the known mod-cta/mod-warning buttons').toBeGreaterThanOrEqual(16);
  });

  it('fills mod-cta and mod-warning from the kit, at rest and on hover', () => {
    for (const [mod, [rest, hover]] of Object.entries(FILL)) {
      expect(declared(KIT, `${ROOT} button.${mod}`, 'background-color'), mod).toBe(rest);
      expect(declared(KIT, `${ROOT} button.${mod}:hover`, 'background-color'), `${mod}:hover`).toBe(hover);
    }
  });

  it('repaints every WP-01 control that paints --ci-action behind --ci-on-action, from the kit', () => {
    const accent = rules(BRIDGE).filter((r) => /background:\s*var\(--ci-action(?:-hover)?\)/.test(r.body));
    expect(accent.length).toBeGreaterThan(0);
    for (const r of accent) {
      const want = /var\(--ci-action-hover\)/.test(r.body) ? 'var(--ci-action-fill-hover)' : 'var(--ci-action-fill)';
      for (const s of r.selectors) expect(declared(KIT, s, 'background'), s).toBe(want);
    }
  });

  it('gives every WP-01 hover that painted --ci-raised the perceptible --ci-hover instead', () => {
    const raised = rules(BRIDGE).filter((r) => /background:\s*var\(--ci-raised\)/.test(r.body));
    expect(raised.length).toBeGreaterThan(0);
    for (const r of raised) for (const s of r.selectors) expect(declared(KIT, s, 'background'), s).toBe('var(--ci-hover)');
  });

  it('paints no hover in the WP-02 sheets with --ci-raised', () => {
    const offenders = SHEETS.flatMap((name) => rules(read(join(UI, 'styles', name)))
      .filter((r) => r.selectors.some((s) => s.includes(':hover')) && /var\(--ci-raised\)/.test(r.body))
      .map((r) => `${name}: ${r.selectors.join(', ')}`));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run tests/unit/contrast-tokens.test.ts`.
  - Expected: five tests fail. The tokens are `null`, the fills are `null`, and so are the WP-01 overrides. The offender list names `kit.css: … .ci-table__row:hover …`, `shell.css: … ci-nav__item:hover` and the screen hovers.
  - The `<button>` sweep passes already. It pins that the `button.mod-*` fill selector reaches every use. To show it can fail, temporarily change the `<button` that carries `class="mod-cta"` in `src/ui/screens/NoSnapshot.vue` to `<a` (and its closing tag), run, paste the failure, and revert.
- [ ] **Step 3: The tokens.** In `src/ui/styles/kit.css`, in the first `:where(.codebase-inspector-root) { … }` block, after `  --ci-nav-width: 220px;`, add:

```css
  /* Part 5 V17, contrast decision #4 (option B): plugin-owned DERIVED tokens. They mix
     host variables and redefine none (spec 4.4). The fills move the accent and the error
     colour toward the accent's inverted text colour until text on them reaches 4.5:1
     (measured 6.11/5.04 and 5.10/6.11 dark/light at 80 %). Hover moves further, never
     back, so pointing at a button cannot drop it under the threshold. --ci-hover is a
     neutral hover surface that can be seen (--ci-raised measured 1.03/1.04). */
  --ci-action-fill: color-mix(in srgb, var(--interactive-accent) 80%, var(--text-on-accent-inverted, black));
  --ci-action-fill-hover: color-mix(in srgb, var(--interactive-accent) 72%, var(--text-on-accent-inverted, black));
  --ci-danger-fill: color-mix(in srgb, var(--background-modifier-error) 80%, var(--text-on-accent-inverted, black));
  --ci-danger-fill-hover: color-mix(in srgb, var(--background-modifier-error) 72%, var(--text-on-accent-inverted, black));
  --ci-hover: color-mix(in srgb, var(--ci-text) 10%, var(--ci-panel));
```

- [ ] **Step 4: The fills and the WP-01 overrides.** Append to the end of `src/ui/styles/kit.css`:

```css

/* Part 5 V17 (option B). Obsidian paints button.mod-cta and button.mod-warning at (0,1,1)
   and their hovers at (0,2,1). These tie them and win on order (a plugin's styles load
   after app.css), and a snippet scoped to the root still beats them (host-cascade rule). */
:where(.codebase-inspector-root) button.mod-cta { background-color: var(--ci-action-fill); }
:where(.codebase-inspector-root) button.mod-cta:hover { background-color: var(--ci-action-fill-hover); }
:where(.codebase-inspector-root) button.mod-warning { background-color: var(--ci-danger-fill); }
:where(.codebase-inspector-root) button.mod-warning:hover { background-color: var(--ci-danger-fill-hover); }
/* The WP-01 controls in styles.css that paint --ci-on-action on --ci-action, and its hovers
   that painted --ci-raised: the same selectors, overridden here, never edited there. */
:where(.codebase-inspector-root) button.ci-welcome__action,
:where(.codebase-inspector-root) button.ci-file-list__row--selected,
:where(.codebase-inspector-root) button.ci-file-list__row--selected:hover { background: var(--ci-action-fill); }
:where(.codebase-inspector-root) button.ci-welcome__action:hover { background: var(--ci-action-fill-hover); }
:where(.codebase-inspector-root) button.ci-app__mode-toggle:hover,
:where(.codebase-inspector-root) button.ci-selection-notice__reveal:hover,
:where(.codebase-inspector-root) button.ci-selection-notice__clear:hover,
:where(.codebase-inspector-root) button.ci-app__drawer-close:hover,
:where(.codebase-inspector-root) button.ci-toolbar__scan:hover,
:where(.codebase-inspector-root) button.ci-file-list__group-focus:hover,
:where(.codebase-inspector-root) .ci-camera-controls button:hover { background: var(--ci-hover); }
```

  If the test's WP-01 checks name a `styles.css` selector that this list lacks, add it to the matching group here. Do not touch `styles.css`.
- [ ] **Step 5: The WP-02 hovers.** Change only `var(--ci-raised)` to `var(--ci-hover)` in these rules. Leave the rest of each line alone.
  - `kit.css`: `:where(.codebase-inspector-root) .ci-table__row:focus-visible { background: var(--ci-raised); }`. This is the second line of the `.ci-table__row:hover,` rule.
  - `shell.css`: `button.ci-nav__item:hover { background: var(--ci-raised); color: var(--ci-text); }`
  - `screens.css`: `button.ci-investigation:hover { background: var(--ci-raised); }` and `button.ci-city-summary__card:hover { background: var(--ci-raised); }`
  - `screens-explore.css`: `button.ci-module-inspector__file:hover { … }` and `button.ci-shortlist__item:hover { … }`
  - The finding-review hover: `button.ci-finding__review:hover` in `screens-audit.css`, or `button.ci-file-finding__review:hover` in `screens-explore.css` after Task 12.
  - `screens-audit.css`: `button.ci-advisory__open:hover { … }`
  - Any other `:hover` rule on `--ci-raised` that the test's offender list names (Tasks 3, 11).

  Pressed and current states that use `--ci-raised` keep it: `[aria-current="page"]`, `[aria-pressed="true"]`, `[aria-selected="true"]` and `--selected`. Each already has a second cue, such as the accent text, the inset bar or the weight.
- [ ] **Step 6: Record the decision.**
  - In `docs/superpowers/notes/2026-09-21-wp01b-open-decisions.md`, after the §4 paragraph that starts `**The options, as they stand:**`, add:

```markdown

**Decided (WP-02 Part 5, ruling T19): option B, plugin-owned derived tokens.** `kit.css`
derives `--ci-action-fill`, `--ci-danger-fill` (with 72 % hover variants) and `--ci-hover`
by mixing host variables; no host variable is redefined, so spec 4.4 holds. Every
`mod-cta` and `mod-warning` button in the view, the welcome action, the selected file row
and every skinned hover now use them. The measured ratios after the change are in the
Part 5 Task 16 report.
```

  - In `docs/superpowers/notes/2026-09-17-wp01-limitations.md`, replace:

```markdown
- **The new hover contrast on three controls.** `--ci-raised` had no consumer before
  this cycle and sits close to the surrounding surface in the default themes.
```

    with:

```markdown
- **The new hover contrast on three controls — decided in WP-02 Part 5 (option B).**
  The skinned hovers no longer paint `--ci-raised`; they paint the plugin-owned
  `--ci-hover`, and text-on-colour buttons use darkened fills. See
  `2026-09-21-wp01b-open-decisions.md` §4.
```

- [ ] **Step 7: Measure.** Write the script below to `<your scratchpad>/contrast-check.mjs`, never inside the worktree. Run it from the worktree root with `node <your scratchpad>/contrast-check.mjs`. Paste its output into your report.

```js
// Part 5 V17: WCAG 2.x contrast of the REAL computed colours in the harness, both themes.
// Translucent layers are composited through a 1x1 canvas, as the spec §4 measurement did.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const fromCwd = (p) => pathToFileURL(path.join(process.cwd(), p)).href;
const { chromium } = await import(fromCwd('node_modules/playwright-core/index.mjs'));
const { createServer } = await import(fromCwd('node_modules/vite/dist/node/index.js'));
const { resolveChromiumExecutable } = await import(fromCwd('scripts/chromium.mjs'));

const CHECKS = [
  { screen: 's05', query: 'route=settings&tab=privacy', sel: '.ci-settings__clear', label: 'mod-warning, Clear review state', kind: 'text' },
  { screen: 's05', query: 'route=sources', sel: '.ci-sources__rescan', label: 'mod-cta, Rescan', kind: 'text' },
  { screen: 's11', query: 'select=first', sel: '.ci-file-list__row--selected', label: 'selected file row (WP-01)', kind: 'text' },
  { screen: 's05', query: 'route=overview', sel: '.ci-nav__item:not([aria-current="page"])', label: 'nav item hover', kind: 'surface' },
  { screen: 's05', query: 'route=city', sel: '.ci-toolbar__scan', label: 'toolbar Scan hover (WP-01)', kind: 'surface' },
];

function colours(sel) {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`no element for ${sel}`);
  const canvas = document.createElement('canvas');
  canvas.width = 1; canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const chain = (node) => { const out = []; for (let n = node; n; n = n.parentElement) out.unshift(getComputedStyle(n).backgroundColor); return out; };
  const paint = (layers) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1, 1);
    for (const c of layers) { ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); }
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => { const x = lum(a); const y = lum(b); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100; };
  const bg = paint(chain(el));
  return { text: ratio(paint([...chain(el), getComputedStyle(el).color]), bg), surface: ratio(bg, paint(chain(el.parentElement))) };
}

const server = await createServer({ configFile: 'vite.harness.config.ts', server: { open: false } });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ executablePath: resolveChromiumExecutable(), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
console.log('theme\tcontrol\trest\thover\trequired');
for (const theme of ['dark', 'light']) {
  for (const c of CHECKS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${base}/?screen=${c.screen}&theme=${theme}&${c.query}`, { waitUntil: 'load' });
    await page.waitForSelector('body[data-ci-harness-ready="true"]', { timeout: 20_000 });
    const rest = await page.evaluate(colours, c.sel);
    await page.hover(c.sel);
    const hover = await page.evaluate(colours, c.sel);
    console.log(`${theme}\t${c.label}\t${rest[c.kind]}\t${hover[c.kind]}\t${c.kind === 'text' ? '4.5 (text on fill)' : 'vs parent surface; today 1.03/1.04'}`);
    await page.close();
  }
}
await browser.close();
await server.close();
```

  Expected:
  - The three `text` rows are at least 4.5 in both themes at rest and on hover. Rest is about 6.11/5.04 for `mod-cta` and the selected row, and about 5.10/6.11 for `mod-warning`. Hover is higher.
  - The two `surface` rows are higher on hover than today's 1.03/1.04.
  - Any `text` value under 4.5 is a failure. Stop and report it.
- [ ] **Step 8: Run and confirm it passes.** Run `npx vitest run tests/unit/contrast-tokens.test.ts tests/unit/kit-css-fallbacks.test.ts tests/unit/css-class-scope.test.ts tests/unit/host-cascade.test.ts tests/unit/leaf-chrome.test.ts tests/unit/evidence-numbers.test.ts`. `evidence-numbers` may fail **only** on file counts, which is expected before Task 16. Any failure that quotes the limitations document's new text is yours to fix. Then run the gate, and `npx eslint tests/unit/contrast-tokens.test.ts --max-warnings 0`.
- [ ] **Step 9: Commit.** `fix(ui): contrast decision #4, option B: derived action/danger fills and a perceptible hover token in the kit (V17)`

---

#### Option A: accept and record

**Files:** Modify `docs/superpowers/notes/2026-09-21-wp01b-open-decisions.md` and `docs/superpowers/notes/2026-09-17-wp01-limitations.md`. No code and no test. The decision is documentation, and there is no behaviour to pin.

- [ ] **Step 1: The decision.** In `2026-09-21-wp01b-open-decisions.md`, after the §4 paragraph that starts `**The options, as they stand:**`, add:

```markdown

**Decided (WP-02 Part 5, ruling T19): accepted.** The failing pairs are inherited from
the host's default theme through pure aliases, and spec 4.4 forbids redefining a host
variable, so the plugin keeps them as they are. Measured in WP-02 Part 5 (harness,
Obsidian 1.12.4 default theme): text on `mod-cta` 4.26 dark / 3.43 light; text on
`mod-warning` 3.45 dark / 4.20 light; the `--ci-raised` hover 1.03 / 1.04 against the
panel. Recorded as a known limitation in `2026-09-17-wp01-limitations.md`.
```

- [ ] **Step 2: The limitation.** In `2026-09-17-wp01-limitations.md`, in `## Known limitations`, after the bullet ending `  itemised row by row.`, add:

```markdown
- **Text on the accent and error buttons, and every skinned hover, sit below WCAG
  contrast in the default theme** (decision #4, accepted in WP-02 Part 5). They alias
  Obsidian's own `--interactive-accent`, `--background-modifier-error` and
  `--background-primary-alt`, which the plugin may not redefine. The figures are in
  `2026-09-21-wp01b-open-decisions.md` §4.
```

  In `## Decisions that are the user's, not ours`, replace the bullet starting `- **The new hover contrast on three controls.**` (two lines) with:

```markdown
- **The new hover contrast on three controls — decided in WP-02 Part 5: accepted.**
  See the known limitation above and `2026-09-21-wp01b-open-decisions.md` §4.
```

- [ ] **Step 3: Check.** Run `npx vitest run tests/unit/evidence-numbers.test.ts tests/unit/gate-evidence.test.ts`. Only the file-count failures that exist before Task 16 are allowed. A failure that quotes the new bullet means a number phrase collided with the sweep: reword it.
- [ ] **Step 4: Commit.** `docs(notes): contrast decision #4 accepted as a host-theme consequence (V17)`

---

#### Option C: fills only, no hover change

This is Option B without `--ci-hover`.

**Files:** as in B, except that `shell.css` and the `screens*.css` files are not modified.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/contrast-tokens.test.ts` as in B, with three changes:
  - delete the `--ci-hover` expectation from the first test;
  - delete the two tests `'gives every WP-01 hover that painted --ci-raised …'` and `'paints no hover in the WP-02 sheets …'`;
  - rename the `describe` to `'contrast decision #4, option C (Part 5 V17)'`.
- [ ] **Step 2: Run it and confirm it fails.** Run `npx vitest run tests/unit/contrast-tokens.test.ts`. The tokens and fills are `null`.
- [ ] **Step 3: The tokens.** Apply B Step 3 without the `--ci-hover` line. In the comment, replace the sentence about `--ci-hover` with: `Hover surfaces stay on --ci-raised (option C: accepted at 1.03/1.04).`
- [ ] **Step 4: The fills.** Append B Step 4's block without the last rule (the seven `:hover` selectors on `var(--ci-hover)`), and drop `and its hovers that painted --ci-raised` from its comment.
- [ ] **Step 5: Record.** Apply B Step 6 with these changes:
  - the decision reads `option C, derived fills; hover surfaces unchanged`;
  - the sentence becomes: `Every mod-cta and mod-warning button in the view, the welcome action and the selected file row now use the fills. The skinned hovers keep --ci-raised (1.03/1.04), accepted.`;
  - the limitations bullet reads `… decided in WP-02 Part 5 (option C): fills fixed, hover surfaces accepted as they are.`
- [ ] **Step 6: Measure.** Apply B Step 7. The `text` rows must be at least 4.5. The `surface` rows are expected to stay at about 1.03/1.04.
- [ ] **Step 7: Run and confirm it passes.** Apply B Step 8.
- [ ] **Step 8: Commit.** `fix(ui): contrast decision #4, option C: derived action/danger fills in the kit (V17)`

---

#### Option D: report upstream only

**Files:** Create `docs/superpowers/notes/2026-09-22-obsidian-contrast-upstream-report.md`. Modify `docs/superpowers/notes/2026-09-21-wp01b-open-decisions.md`. No code. Filing the issue itself is the owner's action, because the plan never posts anything.

- [ ] **Step 1: The report text.** Create `docs/superpowers/notes/2026-09-22-obsidian-contrast-upstream-report.md`:

```markdown
---
project: codebase-inspector
title: Upstream report draft — default-theme contrast of accent and warning buttons
date: 2026-09-22
status: draft for the owner to file; not filed by the plugin
---

# Default theme: text on `mod-cta` and `mod-warning` buttons is below WCAG AA

**Where:** Obsidian 1.12.4 `app.css` (default theme), also present in the harness copy.

**What:** `button.mod-cta` paints `--interactive-accent` behind `--text-on-accent`, and
`button.mod-warning` paints `--background-modifier-error` behind `--text-on-accent`. Measured
with the WCAG 2.x relative-luminance formula:

| Pair | Dark | Light | WCAG AA (text) |
|---|---|---|---|
| `--text-on-accent` on `--interactive-accent` | 4.26:1 | 3.43:1 | 4.5:1 |
| `--text-on-accent` on `--interactive-accent-hover` | 2.75:1 | 2.75:1 | 4.5:1 |
| `--text-on-accent` on `--background-modifier-error` (hover identical) | 3.45:1 | 4.20:1 | 4.5:1 |
| `--background-primary-alt` against `--background-secondary` (hover surface) | 1.03:1 | 1.04:1 | 3:1 (non-text) |

**Suggested fix:** darken the default `--interactive-accent`/`--background-modifier-error`
(for example `color-mix(in srgb, <colour> 80%, black)` gives 6.11/5.04 and 5.10/6.11), or
give `--interactive-accent-hover` a colour that is darker, not lighter, than the accent.

**Why a plugin cannot fix it:** plugins that respect the host theme alias these
variables; redefining them would override the user's theme everywhere.
```

- [ ] **Step 2: The decision.** In `2026-09-21-wp01b-open-decisions.md`, after the §4 paragraph that starts `**The options, as they stand:**`, add:

```markdown

**Decided (WP-02 Part 5, ruling T19): raise it upstream; no plugin change.** The report
text is `2026-09-22-obsidian-contrast-upstream-report.md`; filing it is the owner's step.
Until the host changes, the figures above stand.
```

- [ ] **Step 3: Commit.** `docs(notes): contrast decision #4, upstream report draft (V17)`

---

### Task 16: Harness captures, evidence counts, verification (V30 + final)

**Files:**
- Create: `tests/harness/seed.ts` (~70): the demo items (throws unless all three are created), the running lifecycle, and the demo import file
- Modify: `tests/harness/fixture.ts` (26 → ~31): `completeness: 'partial'` and the warning
- Modify: `tests/harness/mount.ts` (251 → ~275): uses `seed.ts`, and adds `edit`, `run` and `importFile`
- Modify: `tests/harness/page.ts` (48 → ~54): header lines and parameters
- Modify: `scripts/harness-shot.mjs` (236 → ~243): five shots
- Test: `tests/harness/harness.test.ts` (61 → ~100), `tests/build/harness-shot.test.ts` (67 → ~80)
- Modify: `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`, `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md` (derived counts only)

**Interfaces:**
- Consumes:
  - `useReviewStore().addWorkItem(target, intent, title, now, init)` (returns `WorkItem | null`);
  - `useRunStore().setLifecycle(state: ScanLifecycleState)`;
  - `initialScanLifecycleState()` (`src/application/run-state.ts`);
  - `useReportStore().sections`;
  - `ReportSection` (`src/ui/stores/report-store.ts`);
  - `EntityId`;
  - Task 9's Import row file input `.ci-settings__import-file` on Settings › Privacy & storage, and its `CiDialog` (`.ci-dialog`);
  - Task 3's toolbar Cancel.
- Produces (harness only, never imported by `src`):
  - `seedDemoItems(fileIds: readonly EntityId[]): Promise<void>`;
  - `runningLifecycle(): ScanLifecycleState`;
  - `demoImportJson(filePath: string, sections: Readonly<Record<ReportSection, boolean>>): string`;
  - the URL parameters `?edit=first`, `?run=running` and `?import=demo`.

- [ ] **Step 1: Write the failing tests.**
  - In `tests/harness/harness.test.ts`:
    - Change the first import to `import { beforeEach, describe, expect, it } from 'vitest';`.
    - After the existing imports, add:

```ts
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { runningLifecycle, seedDemoItems } from './seed';
```

    - Inside `describe('harness fixture', …)`, add:

```ts
  it('is partial, with the warning a real scan writes when line counts are unavailable (Part 5 V30, Part 4 E17)', () => {
    const snapshot = harnessSnapshot();
    expect(snapshot.completeness).toBe('partial');
    expect(snapshot.warnings).toEqual(['binary content: physical lines are not defined']);
  });
```

    - Append a new `describe` at the end of the file:

```ts
describe('harness seeding (Part 5 V30)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  const fileIds = () => harnessSnapshot().entities.filter((e) => e.kind === 'file').map((e) => e.id);

  it('seeds three work items, one per status column the prototype shows', async () => {
    await seedDemoItems(fileIds().slice(0, 3));
    expect(useReviewStore().workItems.map((w) => w.status)).toEqual(['planned', 'in-progress', 'verified']);
  });
  it('throws when fewer than three were created, so the page error fails the capture', async () => {
    await expect(seedDemoItems(fileIds().slice(0, 2))).rejects.toThrow('harness: items=demo seeded 2 of 3 work items');
  });
  it('counts a refused add (null) as missing, never as seeded', async () => {
    const ids = fileIds().slice(0, 3);
    await useReviewStore().addWorkItem({ kind: 'file', entityId: ids[0]! }, 'refactor', 'Already planned', new Date('2026-09-17T12:00:00Z'));
    await expect(seedDemoItems(ids)).rejects.toThrow('harness: items=demo seeded 2 of 3 work items');
  });
  it('seeds a running scan for ?run=running', () => {
    expect(runningLifecycle().run).toMatchObject({ status: 'running', processedFiles: 57 });
  });
});
```

  - In `tests/build/harness-shot.test.ts`, inside `describe('harness-shot SHOTS', …)`, add:

```ts
  it('captures the Part 5 states: the editor in both schemes, a running scan, the import dialog (V29, V30)', () => {
    const query = (id: string) => new URLSearchParams(SHOTS.find((shot) => shot.id === id)?.query ?? '');
    for (const theme of ['dark', 'light']) {
      const q = query(`wp02-workbench-editor-${theme}`);
      expect(q.get('theme')).toBe(theme);
      expect(q.get('items')).toBe('demo');
      expect(q.get('edit')).toBe('first');
    }
    expect(query('wp02-sources-running-dark').get('run')).toBe('running');
    expect(query('wp02-city-running-dark').get('run')).toBe('running');
    expect(query('wp02-settings-import-dark').get('import')).toBe('demo');
    expect(query('wp02-settings-import-dark').get('tab')).toBe('privacy');
  });
```

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest run tests/harness/harness.test.ts tests/build/harness-shot.test.ts`.
  - Expected: `harness.test.ts` fails to load, because `./seed` does not exist.
  - Once `seed.ts` exists, the partial-fixture test fails, because `completeness` is `'complete'` and `warnings` is `[]`.
  - `harness-shot.test.ts` fails with `null` params, because the shots do not exist.
- [ ] **Step 3: `seed.ts`.** Create `tests/harness/seed.ts`:

```ts
// What the harness seeds, split out of mount.ts so the ordinary suite can check it
// (mount.ts only runs in a real browser). Harness-only: nothing under src imports this.
import type { EntityId } from '../../src/domain/entity-id';
import { initialScanLifecycleState, type ScanLifecycleState } from '../../src/application/run-state';
import type { ReportSection } from '../../src/ui/stores/report-store';
import { useReviewStore } from '../../src/ui/stores/review-store';

const AT = new Date('2026-09-17T12:00:00Z');

/** Part 4: three fixed work items on the first three files, one per status column the
 *  prototype shows. Part 5 V30: a refused add returns null, and a board with a column
 *  missing would be photographed as if it were right, so this throws unless all three
 *  were created — the page error then fails `npm run harness-shot`. */
export async function seedDemoItems(fileIds: readonly EntityId[]): Promise<void> {
  const review = useReviewStore();
  const [a, b, c] = fileIds;
  const created = [
    a ? await review.addWorkItem({ kind: 'file', entityId: a }, 'refactor', 'Separate calculation from persistence', AT, { priority: 'high', status: 'planned', checks: [true, false, false] }) : null,
    b ? await review.addWorkItem({ kind: 'file', entityId: b }, 'tests', 'Add regression tests for selection changes', AT, { status: 'in-progress', checks: [true, true, false] }) : null,
    c ? await review.addWorkItem({ kind: 'file', entityId: c }, 'documentation', 'Document the persistence boundary', AT, { priority: 'low', status: 'verified', checks: [true, true, true] }) : null,
  ].filter((item) => item !== null).length;
  if (created !== 3) throw new Error(`harness: items=demo seeded ${created} of 3 work items`);
}

/** Part 5 V6: a scan in flight, as the host's ScanCoordinator subscription would mirror
 *  it into the run store (a pure mirror), for the Cancel controls' captures. */
export function runningLifecycle(): ScanLifecycleState {
  const approval = {
    profileId: 'harness', sourceFingerprint: 'harness-source', scopeFingerprint: 'harness-scope',
    approvedAt: '2026-09-17T12:00:00.000Z', operation: 'read-only-inventory' as const,
  };
  return {
    ...initialScanLifecycleState(),
    generation: 1,
    approval,
    run: { status: 'running', runId: 'harness-run', generation: 1, approval, processedFiles: 57 },
  };
}

/** Part 5 V13: a fixed v1 review-state file for `?import=demo`. v1 carries no source, so
 *  no repository digest is needed, and the dialog shows the origin as unknown. */
export function demoImportJson(filePath: string, sections: Readonly<Record<ReportSection, boolean>>): string {
  const at = '2026-09-17T12:00:00.000Z';
  return JSON.stringify({
    schema: 'codebase-inspector.review-state.v1',
    exportedAt: at,
    note: 'Harness demo import.',
    workItems: [{
      id: 'wi-1', target: { kind: 'file', path: filePath }, intent: 'refactor', title: 'Separate calculation from persistence',
      status: 'planned', priority: 'high', notes: '', checks: [true, false, false], createdAt: at,
    }],
    rules: [{ id: 'AR-001', from: 'dir-0', to: 'dir-1', rationale: 'Keep the core free of UI imports.', createdAt: at }],
    dispositions: [],
    report: { sections: { ...sections }, note: '' },
  }, null, 2);
}
```

- [ ] **Step 4: The partial fixture.** In `tests/harness/fixture.ts`, replace:

```ts
    measuredZero: 1,
    unavailable: 3,
  });
```

  with:

```ts
    measuredZero: 1,
    unavailable: 3,
    // Part 5 V30 (Part 4 E17): a real scan marks a snapshot partial whenever a file's
    // lines are unavailable (inventory-collector.ts), with this reason as its warning.
    completeness: 'partial',
    warnings: ['binary content: physical lines are not defined'],
  });
```

- [ ] **Step 5: `mount.ts`.**
  - Replace the import `import { useReviewStore } from '../../src/ui/stores/review-store';` with the lines below. `seed.ts` now owns the review-store use, so the old import would be unused.

```ts
import { useReportStore } from '../../src/ui/stores/report-store';
import { useRunStore } from '../../src/ui/stores/run-store';
import { demoImportJson, runningLifecycle, seedDemoItems } from './seed';
```

  - In `HarnessOptions`, after `items?: 'demo';`, add:

```ts
  edit?: 'first';
  run?: 'running';
  importFile?: 'demo';
```

  - Replace:

```ts
  const route = options.route ?? 'city';
  store.navigate(route);
```

    with:

```ts
  if (options.run === 'running') {
    // Part 5 V6: the toolbar's and Data & scans' Cancel are enabled only while running.
    useRunStore().setLifecycle(runningLifecycle());
  }

  const route = options.route ?? 'city';
  store.navigate(route);
```

  - Replace the whole `if (options.items === 'demo') { … }` block (from `if (options.items === 'demo') {` through its `await nextTick();` and closing `}`) with:

```ts
    if (options.items === 'demo') {
      // Part 4: the workbench and report shots need work items. Part 5 V30: seedDemoItems
      // throws unless all three were created, so a refused add fails the capture.
      await seedDemoItems((store.layout?.lots ?? []).slice(0, 3).map((l) => l.entityId));
      await nextTick();
    }
    if (options.edit === 'first') {
      // Part 5 V29: the editor open, so the label style is seen in both themes.
      const card = root.querySelector<HTMLElement>('.ci-work-card');
      if (!card) throw new Error('harness: edit=first found no work card (add items=demo)');
      card.click();
      await nextTick();
      await nextTick();
    }
```

  - After the `if (options.tab) { … }` block, before `document.body.dataset.ciHarnessReady = 'true';`, add:

```ts
    if (options.importFile === 'demo') {
      // Part 5 V13: a capture cannot use the file picker, so the Import row's own
      // <input type="file"> gets a fixed file and the `change` event a real pick fires.
      const input = root.querySelector<HTMLInputElement>('.ci-settings__import-file');
      const firstPath = store.snapshot?.entities.find((e) => e.kind === 'file')?.path;
      if (!input || !firstPath) throw new Error('harness: import=demo found no import input (add tab=privacy)');
      const transfer = new DataTransfer();
      transfer.items.add(new File([demoImportJson(firstPath, useReportStore().sections)], 'review-state.json', { type: 'application/json' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change'));
      await until(() => root.querySelector('.ci-dialog') !== null);
    }
```

  - If Task 9 gave the file input or its dialog a different class, use Task 9's actual class, and say so in your report.
- [ ] **Step 6: `page.ts`.**
  - After the header line `//   ?items=demo        seed three work items (workbench, report)`, add:

```ts
//   ?edit=first        open the first work card's editor (workbench, with items=demo)
//   ?run=running       seed the run store with a running scan (city, sources)
//   ?import=demo       open the import dialog with a fixed v1 file (settings, tab=privacy)
```

  - Replace:

```ts
  ...(params.get('items') === 'demo' ? { items: 'demo' as const } : {}),
});
```

    with:

```ts
  ...(params.get('items') === 'demo' ? { items: 'demo' as const } : {}),
  ...(params.get('edit') === 'first' ? { edit: 'first' as const } : {}),
  ...(params.get('run') === 'running' ? { run: 'running' as const } : {}),
  ...(params.get('import') === 'demo' ? { importFile: 'demo' as const } : {}),
});
```

- [ ] **Step 7: The shots.** In `scripts/harness-shot.mjs`, after the line `{ id: 'wp02-settings-privacy-dark', query: '?screen=s05&theme=dark&route=settings&tab=privacy' },`, add:

```js
  // WP-02 Part 5: compare against docs/concept/prototype/screenshots/work-item-editor-dark.png
  // (the editor, both schemes), scan-progress-dark.png (a running scan: Data & scans and the
  // city, Cancel enabled) and settings-dark.png (the import dialog over Settings).
  { id: 'wp02-workbench-editor-dark', query: '?screen=s05&theme=dark&route=workbench&items=demo&edit=first' },
  { id: 'wp02-workbench-editor-light', query: '?screen=s05&theme=light&route=workbench&items=demo&edit=first' },
  { id: 'wp02-sources-running-dark', query: '?screen=s05&theme=dark&route=sources&run=running' },
  { id: 'wp02-city-running-dark', query: '?screen=s05&theme=dark&route=city&run=running' },
  { id: 'wp02-settings-import-dark', query: '?screen=s05&theme=dark&route=settings&tab=privacy&import=demo' },
```

- [ ] **Step 8: Run and confirm they pass.** Run `npx vitest run tests/harness/harness.test.ts tests/build/harness-shot.test.ts tests/unit/obsidian-mock-scope.test.ts`, then the gate. Also run `npx eslint tests/harness/seed.ts tests/harness/fixture.ts tests/harness/mount.ts tests/harness/page.ts tests/harness/harness.test.ts tests/build/harness-shot.test.ts --max-warnings 0`.
- [ ] **Step 9: Capture and compare.**
  - Run `npm run harness-shot`. It must exit 0. A page error from `seedDemoItems`, `edit=first` or `import=demo` fails it. That is the point: report the error, and do not remove the throw.
  - Every city shot must still show the drawn city.
  - The controller compares each new PNG in `harness-shots/` with its prototype in `docs/concept/prototype/screenshots/`:

| New shot | Prototype |
|---|---|
| `wp02-workbench-editor-dark.png` | `work-item-editor-dark.png` |
| `wp02-workbench-editor-light.png` | `work-item-editor-dark.png` (no light prototype: structure only) |
| `wp02-sources-running-dark.png` | `scan-progress-dark.png`, `sources-dark.png` |
| `wp02-city-running-dark.png` | `scan-progress-dark.png`, `city-dark.png` |
| `wp02-settings-import-dark.png` | `settings-dark.png` (no import prototype: check the dialog shows counts, "unknown origin (v1)", Replace review state, Cancel) |

  - Check the editor labels in both themes. They should read at normal text colour, 0.9em, medium weight, and the Target caption should match the four select and text labels (V29).
  - Expected, intended differences:
    - Every existing shot now carries the partial-read notice (COPY-13 on the city, "Partial: 141 of 144 files measured" on Data & scans, inventory marked Partial). This is ledger T16.
    - There is no drag and drop, no avatars, no simulated scan buttons and no "Run demo scan" (W2, W8, W10, W14, W15).
    - The Cancel buttons are enabled only in the two `run=running` shots.
    - The fixture uses `dir-N` module names, and Obsidian draws its own chrome.
  - List every other difference you leave.
- [ ] **Step 10: Contrast, measured.** Re-run the Task 15 script with `node <your scratchpad>/contrast-check.mjs` from the worktree root, and paste its full output.
  - If the owner chose Option A or D, write the script from Task 15 Option B Step 7 into your scratchpad first. The numbers then record the unchanged state.
  - Every `text` row under Option B or C is at least 4.5.
- [ ] **Step 11: Evidence-note counts, ONCE.**
  - Run `npx vitest run tests/unit/gate-evidence.test.ts tests/unit/evidence-numbers.test.ts`. The failures name each stale value.
  - Update exactly those values, with the Edit tool, in `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` and `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`. Commit ec1f7fc is the pattern (`git show ec1f7fc -- docs`). It changed:
    - the `src/` floor `(200+ files` → `(230+ files`;
    - the sentence `Counts refreshed 2026-09-22 to the living suite after WP-02 Part 3` → `… Part 4`;
    - the G8 heading `**138 files` → `**152 files` (the tests, passed and skipped numbers stayed);
    - the `Files` cell of the Unit and Component rows in **both** documents' layer tables. The `Tests` column is TRANSCRIBED and never changes.
  - This time, expect these to change:
    - the Files cells of `tests/unit/**`, `tests/component/**` and `tests/host/**` (Task 3's `tests/host/city-view-cancel.test.ts`), in both tables. Harness and Build keep 1 file each: `seed.ts` is not a test file.
    - the G8 total, which is the sum of the layer Files cells;
    - the sentence, which now says `… after WP-02 Part 5`. Keep the date `2026-09-22` unless you run this on another day; then use that day.
    - the `src/` floor. `tests/unit/evidence-numbers.test.ts` (`'states the src/ file count as a floor that is actually true'`) requires `stated ≤ real` and `real − stated ≤ 10`, where `real` counts `.ts`/`.vue` files under `src/`, excluding `.d.ts`. The rule: write `(N+ files`, where N is `real` rounded down to a multiple of ten. For example, 248 real files gives `(240+ files`. Count with `Get-ChildItem -Recurse src -Include *.ts,*.vue | Where-Object { $_.Name -notlike '*.d.ts' } | Measure-Object`.
    - any per-file test-count claim (`<path> … N tests`) that the sweep names.
  - Change derived numbers only. Re-run the two tests until they pass.
- [ ] **Step 12: Full verification.** Run `npm run verify` in the foreground.
  - Expected: exit non-zero **only** because of `tests/unit/install-script.test.ts`, which fails in a worktree without `.obsidian/` (environmental). Paste its failing test names and assertion messages verbatim.
  - If `tests/host/clean-vault-install.test.ts` times out, re-run it alone with `npx vitest run tests/host/clean-vault-install.test.ts` before calling it a failure.
  - Anything else failing is real: fix it, or stop and report it.
  - Run `npm run build` on its own afterwards if verify stopped before it, and paste the `assert-bundle` line.
- [ ] **Step 13: Commit.** `test(harness): Part 5 captures (editor, running scan, import) on a partial fixture; ?items=demo throws on a refused add; refresh WP-01 evidence counts after WP-02 Part 5`

---

---

## Self-review notes

- **Spec coverage:**

  | Spec item | Task |
  |---|---|
  | V1–V3 split | 1 |
  | V4, V5 one leaf observer, camera re-measure | 2 |
  | V6 cancel | 3 (the callback lives in Task 1's module) |
  | V7 route focus | 5 |
  | V8–V10 per-codebase keying, V31 citations | 6 |
  | V11, V12 v2 export | 7 |
  | V14, V16 (store) import parser, `replaceAll`, `restore` | 8 (+ P1) |
  | V13, V15, V16 (UI), V27 import UI, tab narrowing | 9 |
  | V17 contrast #4 | 15 (the owner's option) |
  | V18 lazy Security | 10 |
  | V19 button columns | 11 |
  | V20, V21 kit classes, class-scope guard | 12 |
  | V22, V23 reannounce, export, null Tests export | 4 |
  | V24–V26, V28, V29 minors | 13 |
  | V30 harness | 6 (P6), 16 |
  | V32 tests | 14, plus each task's own tests |

- **Line budgets:**

  | File | Before | After |
  |---|---|---|
  | `city-view.ts` | 399 | ~275 (cap test: 360) |
  | `CityWorkspace.vue` | 386 | ~189 (cap test: 360) |
  | `review-store.ts` | — | ~350 (fallback: `review-buckets.ts`) |
  | `WorkItemEditor.vue` | 300 | ~315 |
  | `App.vue` | 164 | ~185 |

  No test file passes 450 lines, and `city-view-store-wiring.test.ts` is not touched.
- **Names shared across tasks:**
  - Task 1: `CityScanController`, `provideScanCallbacks`, `createLayoutPublisher`
  - Task 2: `LEAF_LAYOUT_KEY`, `provideLeafLayout`, `injectLeafLayout`, `layoutTick`
  - Tasks 4–5: `reannounce`, `useRouteFocus`, `ROUTE_OPENED`
  - Tasks 6 and 8: `bindRepository`, `replaceAll`, `restore`
  - Task 7: `repositoryDigest`, `reviewStateSource`, `REVIEW_STATE_SCHEMA`, `REVIEW_STATE_SCHEMA_V1`
  - Task 8: `parseReviewState`, `readReviewStateFile`, `ImportedReviewState`, `ImportErrorCode`, `IMPORT_MAX_BYTES`
  - Task 9: `SETTINGS_TABS`, `isSettingsTab`
  - Task 10: `securityModelFor`
  - Task 12: `ci-severity`, `ci-ref-id`, `ci-band-legend`, `ci-file-finding`
- **Task order:** strictly 1 → 16. The dependencies:

  | Task | Needs |
  |---|---|
  | 2 | 1 (`use-city-floor.ts`) |
  | 3 | 1 (`provideScanCallbacks`) |
  | 5, 9 | 4 (`reannounce`) |
  | 7 | 6 |
  | 8 | 6, 7 |
  | 9 | 8 |
  | 14 | 8 (P1), 9, 11 |
  | 15 | 12 (the moved hover) |
  | 16 | every other task |
