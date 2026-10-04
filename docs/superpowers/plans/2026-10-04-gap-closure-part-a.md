# Gap closure — Part A (city and renderer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close spec rows GRA1–GRA10:
- the F2 packing spike, adopted only by measurement;
- a cap on automatic WebGL reconstruction, then Retry 3D;
- pointer capture;
- the §7 root-unavailable producer;
- the measured wide leaf and drawer threshold;
- relation arcs that clear tall buildings;
- the codebase name in the toolbar;
- Investigate rows that keep Open beside the path;
- the two vendor quirks.

**Architecture:**
- **Renderer recovery wraps the factory** (`src/visualization/reconstruct-cap.ts`). Retry remounts the viewport by `:key` from `CityStage.vue`. `CityViewport.vue` is never edited (GCN2).
- **Root-unavailable is application-owned:** a `ScanLifecycleState.rootUnavailable` flag, set by `SCAN_FAILED { cause: 'root-unavailable' }` or a new `ROOT_UNAVAILABLE` action, cleared by `SCAN_STARTED`.
- **Layout numbers come from a new measuring script,** `scripts/harness-measure.mjs`, which reuses the harness. Its JSON is committed as a fixture that the CSS pins read.
- **Arcs gain corridor clearance** inside `relation-arcs.ts`, which already holds every lot.
- **The name is a validated optional `CityViewState.name`.** A small host helper resolves it from the profile store.

**Tech Stack:** TypeScript 6.0.3, Vue 3.5.43, Pinia 4.0.3, Three.js 0.186.0, Vite 8.3.0, Vitest 5.0.1 (jsdom), playwright-core (the harness), WebdriverIO with wdio-obsidian-service (native), Node 24.

**Spec:** `docs/superpowers/specs/2026-10-03-gap-closure-design.md`:
- §3.3 (GRA1–GRA10);
- GCN2, GCN3 (§4.1 `name?`, the §4.2 prose), GCN6, GCN8, GCN12 (`RETRY_3D`);
- §5 scenario 42;
- GCO2–GCO6, GCO14, GCO17, GCO19.

**Rulings:** `docs/superpowers/notes/2026-10-03-gap-closure-ledger.md`. The ones that bind this part:
- GCP3: the F2 re-baseline;
- GCP4: one threshold constant;
- GCP5: the name shows in the toolbar, not the TopBar;
- GCP6: clear only our own `__THREE__`;
- GCP9: the cap is 3, reset only by Retry.

Pre-flight rulings continue as GCQ3…, and execution rulings as "Gap-closure E14…".

**Branch:** `feat/gap-closure` in `.claude/worktrees/gap-closure`, at `3df98ea` (the PR 1 head after Part C). At the end it is fast-forward-pushed onto `feat/wp-01-codebase-city` as `Luis85`.

## Global Constraints

**Repository rules:**
- **Line caps:** **400** lines for `src/**/*.{ts,vue}` and **450** for tests.
- **City-view budget:** `city-view.ts` and `CityWorkspace.vue` stay ≤ **360**. **`CityViewport.vue` (400/400) is never edited.**
- **Layering is enforced by lint (GCO10):** `ui` never imports `adapters` or `host`. Only `src/adapters/filesystem/node-access.ts` may `window.require` `fs`. No bare `window`/`document` inside `src/ui` or `src/visualization` (spec 4.4 lint rule).
- **Copy** lives only in `src/ui/audit-copy`, `src/ui/copy.ts` and `src/ui/inspector-copy.ts`. The new string is `RETRY_3D = 'Retry 3D'` (GCN12). The microcopy contract stays green.
- **Part C's gates are live,** and every new or changed UI must pass them:
  - the contrast gate (`tests/unit/contrast-gate.test.ts`, including its text-token-as-border sweep);
  - axe (`tests/component/axe-*.test.ts`);
  - the layering lint.
- **CRLF files** are edited only with Edit/Write: the two evidence notes, `gate-evidence.md` and `implementation-report.md`. LIM and the specs are LF.
- `npm run analyze` stays at **4**. A new dead export is removed, never baselined.
- **§4 amendments only as GCN3 names them:** `CityViewState.name?` (§4.1) and the §4.2 reconstruction prose. Nothing else in §4 changes.

**Process rules:**
- **Never run `git stash` in any form.** A RED is shown by a temporary Edit that is then reverted.
- **Tests are written and run RED before the code.** A RED rebuilt after the code is written is not accepted.
- **Every commit message ends with the literal trailer** "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>". Stage explicit paths, never `git add -A`.
- **Run plain, separate shell commands.** Worktree-isolated sessions refuse commands that compute a program name.
- **Disclose every `npm run test` / `npm run verify` run** with its Z38 outcome.

**TypeScript and lint:**
- ES2020 `lib` only: no `.at()`, `Object.hasOwn`, `replaceAll` or `findLast`.
- oxlint runs with `--deny-warnings`.
- Use `Array.from(set)`, the PF1 timers, and no redundant `as`.

**Native runs:**
- Part A adds **scenario 42**, so the gate goes from 41 to **42**. It also changes the plugin unload scenario (`window.__THREE__`).
- Each new or changed scenario needs a RED on record, a positive control, and `retry: 0`.
- Native runs need Node with libuv ≥ 1.52, so use the portable Node: `C:\Users\LUISME~1\AppData\Local\Temp\claude\C--Projects-codebase-inspector--claude-worktrees-inspector-prototype-ui-18caac\841c5b72-4d1a-40a3-a435-aa83781f2391\scratchpad\node-24.21.0\node-v24.21.0-win-x64\node.exe scripts/native-tests.mjs`.
- `FALLOW_BIN` is `Join-Path $env:LOCALAPPDATA 'npm-cache\_npx\ee3f2ca80543beb5\node_modules\@fallow-cli\win32-x64-msvc\fallow.exe'`.
- No retries. Never kill foreign processes.

**Per-task gate** (each its own command):
- `npm run typecheck`
- `npm run lint:fast`
- `npx eslint <touched files> --max-warnings 0`
- `npx vitest run <the task's test files plus every existing test file that imports a changed module>`
- For tasks that change UI, also `npx vitest run tests/component/axe-*.test.ts tests/unit/contrast-gate.test.ts`.

`gate-evidence.test.ts` and `evidence-numbers.test.ts` may fail on counts until Task 12.

**Size now** (at `3df98ea`):

| File | Lines |
|---|---|
| `src/domain/layout/districts.ts` / `layout.ts` | 383 / 86 |
| `src/visualization/picking.ts` / `relation-arcs.ts` / `renderer-port.ts` / `inert-port.ts` | 191 / 175 / 124 / 33 |
| `src/host/city-view.ts` | 297 (budget 360) |
| `src/ui/components/CityStage.vue` / `CityViewport.vue` / `AppToolbar.vue` | 83 / **400 (frozen)** / 163 |
| `src/ui/screens/CityWorkspace.vue` | 189 (budget 360) |
| `src/application/run-state.ts` / `scan-coordinator.ts` | 184 / 313 |
| `src/ui/stores/run-store.ts` / `city-store.ts` | 34 / 220 |
| `src/host/scan-flow.ts` / `city-scan-controller.ts` / `view-state-sync.ts` | 228 / 173 / 73 |
| `src/domain/validator.ts` / `model.ts` | 362 / 110 |
| `src/ui/responsive.ts` / `styles.css` / `styles/screens-act.css` | 19 / 812 / 179 |
| `src/main.ts` / `vite.config.ts` / `src/ui/copy.ts` | 140 / 41 / 330 |
| `scripts/harness-shot.mjs` / `tests/harness/page.ts` / `fixture.ts` | 345 / 83 / 32 |
| `tests/component/picking.test.ts` / `relation-arcs.test.ts` / `city-viewport.test.ts` | **440** / 351 / **448** |
| `tests/unit/layout-budget.test.ts` / `tests/host/build-output.test.ts` / `tests/build/harness-shot.test.ts` | 165 / 130 / 209 |
| `tests/e2e/city.e2e.ts` / `plugin-lifecycle.e2e.ts` / `inspector.ts` | 214 / 242 / 381 |

Three test files are near their caps: `picking.test.ts` (440), `city-viewport.test.ts` (448) and `inspector.ts` (381). New cases go into new files.

## Review Focus

1. **Root-unavailable never masks another state or lies.**
   - The banner shows only when a snapshot exists.
   - The next scan start clears it.
   - A missing root never opens the approve modal.
   - A first scan and an ordinary failure are unaffected.

   Pinned in Task 5.
2. **The reconstruction cap counts only context losses.**
   - A window migration, which also disposes and rebuilds, never counts.
   - A list ↔ 3D round trip does not reset it (GCP9).
   - Retry 3D never requests a scan.

   Pinned in Task 4.
3. **Pointer capture keeps an ordinary click working.**
   - A click inside the canvas still picks.
   - A release outside the canvas after a capture picks nothing.
   - A missing `setPointerCapture` (jsdom, old hosts) never throws.

   Pinned in Task 3.
4. **The name follows the profile without breaking the leaf state.**
   - A rename in Settings updates every open leaf.
   - A missing profile keeps the persisted name.
   - An over-long or non-string persisted name is dropped by itself, never rejecting the whole leaf state.

   Pinned in Task 6.
5. **Layout changes keep their invariants.**
   - An adopted packer keeps determinism, no overlap and the 0.7–1.43 aspect window.
   - A moved threshold keeps nav-inline, the city drawer and all four CSS places flipping at the same width.

   Pinned in Tasks 2 and 7.

---

### Task 1: The F2 packing spike — measure, never adopt here (GRA1, GCO2, GCP3)

**Files:**
- Create:
  - `tests/fixtures/path-tree.ts`: `snapshotFromPaths(paths, repositoryId)`;
  - `tests/fixtures/real-tree.json`: the frozen path list;
  - `tests/support/occupancy.ts`;
  - `tests/unit/layout-occupancy.test.ts`.
- Spike only, never committed: a temporary `tests/unit/packing-spike.test.ts` holding the candidates.

**Interfaces:**
- Produces:
  - `snapshotFromPaths(paths: readonly string[], repositoryId: string): CodebaseSnapshot`. Every file gets a measured line count of 10, so every lot has `LOT_FOOTPRINT`.
  - `rootOccupancy(layout: LayoutResult): number`, a percentage in the range 0–100.
  - `REAL_TREE_PATHS: readonly string[]`, read from the JSON.

- [ ] **Step 1: The path-tree fixture.** Write `snapshotFromPaths`, modelled on `nestedFixture`'s `addDir`/`addFile` closures (`tests/fixtures/snapshot-builder.ts:186-206`). It builds directory entities for every path prefix and sorts nothing itself, because the layout sorts.
- [ ] **Step 2: Calibrate the occupancy definition.** The definition is the sum of the areas of the root's direct items (file lots plus child district extents) over the root extent's area.
  - Build `snapshotFromPaths(git ls-tree -r 84d92d7 --name-only)`; it has 601 paths. Compute `rootOccupancy`, trying four variants:
    - the root area with or without `2·DISTRICT_PADDING`;
    - a lot counted as `LOT_FOOTPRINT²` or by its dimensions.
  - Record every variant's figure against **64.2 %** (own 1,016,060, used 652,244: `docs/superpowers/notes/2026-09-21-wp01b-open-decisions.md:20-22`).
  - **Expected:** no variant reaches ±0.1, because that scan had 1,087 files including untracked ones. Per GCP3, re-baseline: use the definition matching the note's own wording ("own area" = root extent including padding; "used" = sum of the direct items) on the **plan-base tree**.
- [ ] **Step 3: Freeze the plan-base tree.** Write `git ls-files` at `3df98ea` into `tests/fixtures/real-tree.json` as a sorted JSON array. Write `tests/unit/layout-occupancy.test.ts`. It asserts:
  - the shelf baseline figure on the frozen tree, to 0.1;
  - the same figure on a reversed path list (determinism).

  The test's header comment records both figures, the 84d92d7 calibration attempt and the plan-base baseline.
- [ ] **Step 4: Measure three deterministic candidates** in the uncommitted spike test file, each on the frozen tree:
  - **NFDH:** sort by footprintZ descending, path as the tie-break; fill shelves in that order.
  - **FFDH:** like NFDH, but each item goes into the first shelf with room.
  - **Skyline bottom-left:** the same sort; place each item at the lowest skyline segment that fits.

  Each candidate keeps `shelfPack`'s target-width search (`districts.ts:206-232`), so the aspect window holds. For each one, record the root occupancy, the root aspect, the no-overlap check, and the wall time on `nestedStressFixture`.
- [ ] **Step 5: Report the table, then delete the spike file.** The report holds the full candidate code so the table can be reproduced. Its columns are candidate, occupancy, Δ against the baseline, aspect, overlap and ms. The controller rules from it:
  - **adopt** the simplest candidate reaching **≥ baseline + 10** points with aspect 0.7–1.43 and no overlap: Task 2 runs;
  - otherwise **keep shelf packing**: Task 2 is skipped, and the table goes into the ledger.
- [ ] **Step 6: Gate and commit** (the fixture, the support module and the occupancy test only). Subject: `test(layout): root occupancy on a frozen real tree, the F2 spike baseline (gap closure GRA1)`.

---

### Task 2: Adopt the measured packer (GRA1) — runs only if Task 1's ruling adopts a candidate

**Files:**
- Create: `src/domain/layout/pack.ts`.
- Modify:
  - `src/domain/layout/districts.ts`: `shelfPack`, `measureAt` and `placeAt` move out;
  - `src/domain/layout/layout.ts:10`: `LAYOUT_VERSION = '2'`;
  - the five type-filler `layoutVersion: '1'` literals, for consistency only: `src/visualization/dev-fixture.ts:44`, `tests/fixtures/renderer-doubles.ts:20`, `tests/unit/city-renderer.test.ts:122,250` and `tests/component/picking.test.ts:56`;
  - `tests/unit/layout-occupancy.test.ts`.

**Interfaces:**
- Produces: `pack(items: readonly Footprint[]): { width: number; footprintZ: number; placed: Array<{ x: number; z: number }> }`, with exactly `shelfPack`'s signature. `Footprint` moves to `pack.ts` and is exported for `districts.ts` only.

- [ ] **Step 1: RED.** Raise the occupancy test's floor to `baseline + 10`, so it fails against shelf packing.
- [ ] **Step 2:** Move the adopted candidate from Task 1's report into `pack.ts`, with its target-width search. `districts.ts` calls `pack` where it called `shelfPack`. The child mapping `placed[fileKids.length + i]` (`:285`) must still hold. If the candidate reorders items, `pack` returns `placed` **in input order**; write that as a code comment and test it.
- [ ] **Step 3: GREEN.** All of these pass:
  - `layout-occupancy`;
  - `layout-determinism`: same output, reversed input and no overlap;
  - `layout-districts`: aspect pins 0.7–1.43, children inside their parent;
  - `layout-budget`, `layout-scale`;
  - `tests/benchmarks/city-benchmark.test.ts`.

  Add one test: `pack` returns `placed` in input order for a mixed-size list.
- [ ] **Step 4:** Run `npm run harness-shot` and look at `s05-city-dark`, `s07-selected-dark` and `wp03-city-relations-dark`. Describe the before and after in the report.
- [ ] **Step 5: Gate and commit.** Subject: `feat(layout): <candidate> packing raises root occupancy from <b> % to <a> % on the real tree; LAYOUT_VERSION 2 (gap closure GRA1)`.

---

### Task 3: Pointer capture on an edge drag (GRA3, GCO4, M95)

**Files:**
- Modify: `src/visualization/picking.ts:80-137`.
- Create: `tests/component/picking-capture.test.ts`, reusing `picking.test.ts`'s setup: `stubGetContext('ok')`, the mocked WebGLRenderer, `canvas.getBoundingClientRect`, and the `pointerEvent(type, at, button)` helper at `:119-125`. Copy what is needed; `picking.test.ts` is at 440 lines.

- [ ] **Step 1: RED.** In the new file, with a 100×100 canvas and `canvas.setPointerCapture` / `releasePointerCapture` defined as `vi.fn()`:
  - (a) pointerdown at (50, 50) calls `setPointerCapture(1)`;
  - (b) pointerup at (50, 50) calls `releasePointerCapture(1)`, and pointercancel does too;
  - (c) down at (98, 50), up at (102, 50) (inside the drag threshold) picks nothing. **Positive control:** down at (95, 50), up at (97, 50) picks the lot `hitTest` returns there;
  - (d) a pointermove at (130, 50) with no button arms no dwell (`hitTest` not called after the dwell timeout);
  - (e) with `setPointerCapture` **undefined** on the canvas, down and up at (50, 50) still pick and nothing throws.

  Run it: (a), (b) and (c) fail, which is the RED.
- [ ] **Step 2: Implement.** In `onPointerDown`, after the `isActive` guard: `canvas.setPointerCapture?.(e.pointerId)`. In `endGesture`, used by up and cancel: `if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id)`. Add a guard:

  ```ts
  function insideCanvas(point: { x: number; y: number }): boolean {
    const rect = canvas.getBoundingClientRect();
    return point.x >= 0 && point.y >= 0 && point.x <= rect.width && point.y <= rect.height;
  }
  ```

  `onPointerUp` returns before `hitTest` when the point is not `insideCanvas(toCanvas(e))`, and `armDwell` returns early when it is not inside. Add no new listener: `renderer-disposal.test.ts:295-325` pins the exact listener list.
- [ ] **Step 3: GREEN.** The new file, `picking.test.ts` and `renderer-disposal.test.ts` all pass.
- [ ] **Step 4: Gate and commit.** Subject: `fix(picking): capture the pointer on press and never pick outside the canvas (gap closure GRA3, M95)`.

---

### Task 4: A cap on automatic reconstruction, then Retry 3D (GRA2, GCO3, GCN2, GCP9)

**Files:**
- Create:
  - `src/visualization/reconstruct-cap.ts`;
  - `tests/unit/reconstruct-cap.test.ts`;
  - `tests/component/retry-3d.test.ts`;
  - `tests/host/city-view-reconstruct-cap.test.ts` (add it to the vitest `JSDOM_HOST_TESTS` list, beside `city-view*`).
- Modify:
  - `src/host/city-view.ts:166`;
  - `src/ui/components/CityStage.vue`;
  - `src/ui/copy.ts` (`RETRY_3D`; check whether `tests/contracts/microcopy.test.ts` needs a catalogue row for it);
  - `src/ui/styles.css` (`.ci-viewport__retry`);
  - `src/visualization/renderer-port.ts:28-29` (prose);
  - `docs/superpowers/specs/2026-09-17-codebase-inspector-wp01-design.md:589-591` (the §4.2 prose, amended in writing per GCN2).
- Do not touch: `CityViewport.vue`.

**Interfaces:**
- Produces:

  ```ts
  export const MAX_AUTOMATIC_RECONSTRUCTIONS = 3;
  export interface ReconstructCap { create: CreateCityRenderer; reset(): void }
  export function createReconstructCap(inner: CreateCityRenderer, max?: number): ReconstructCap;
  ```

  The provide key is the string `'retryCityRenderer'`, typed `() => void` (the same string-key style as `'createCityRenderer'`).

- [ ] **Step 1: RED (unit).** Write `tests/unit/reconstruct-cap.test.ts`. The inner factory captures each `onEvent` and returns `makeRendererDouble()`-style ports. Drive four losses, each `onEvent({ type: 'unavailable', reason: 'context-lost' })` followed by another `create`. Expect:
  - the inner factory is called **4** times (1 initial + 3 reconstructions);
  - the 5th `create` emits `unavailable{initialization-failed}` synchronously, before it returns, and returns a port whose methods are no-ops (`makeInertPort`);
  - after `reset()`, `create` calls the inner factory again;
  - `initialization-failed` or `unsupported` from the inner factory does not count;
  - a `create` with no loss in between (a window migration) does not count.

  It fails because the module is missing.
- [ ] **Step 2:** Implement:

  ```ts
  export function createReconstructCap(inner: CreateCityRenderer, max = MAX_AUTOMATIC_RECONSTRUCTIONS): ReconstructCap {
    let losses = 0;
    const create: CreateCityRenderer = (mountEl, win, onEvent) => {
      if (losses > max) {
        onEvent({ type: 'unavailable', reason: 'initialization-failed' });
        return makeInertPort();
      }
      return inner(mountEl, win, (event) => {
        if (event.type === 'unavailable' && event.reason === 'context-lost') losses += 1;
        onEvent(event);
      });
    };
    return { create, reset: () => { losses = 0; } };
  }
  ```

  `CityViewport.vue:258-269` already handles an unavailable event emitted synchronously inside the factory: its test is at `city-viewport.test.ts:299`.
- [ ] **Step 3: RED (host).** `tests/host/city-view-reconstruct-cap.test.ts` mounts a real `CityView`. It copies the setup from `tests/host/city-view.test.ts`: `vi.mock` of `src/visualization/city-renderer` with a factory that records calls and captures `onEvent`. Open it in 3D with a published snapshot. Then repeat 4 times: emit context-lost and await two `nextTick`s. Assert:
  - the mocked `createCityRenderer` was called **4** times;
  - the leaf text contains `COPY_14`.

  RED at HEAD: 5 calls and no COPY-14, because the loop is unbounded.
- [ ] **Step 4: Host wiring.** `city-view.ts` gets one cap per leaf: `private readonly rendererCap = createReconstructCap(createCityRenderer);`. It provides `'createCityRenderer'` → `this.rendererCap.create` and `'retryCityRenderer'` → `() => { this.rendererCap.reset(); }`. Keep `city-view.ts` ≤ 360.
- [ ] **Step 5: RED (component).** `tests/component/retry-3d.test.ts` mounts `CityStage` with:
  - a capped double factory;
  - a `retryCityRenderer` spy;
  - an `onScanRequested` spy;
  - a pinia city store in 3D with a snapshot.

  It sets the stage rect the way `city-viewport.test.ts:60-74` does. Expect:
  - after a synchronous `initialization-failed`, a button named **"Retry 3D"** shows. The same holds for `unsupported`;
  - it does not show for `context-lost` or for the 320 px floor notice;
  - clicking it calls the retry spy once and the factory once more;
  - `document.activeElement` becomes the `[data-ci-role="stage"]` element;
  - `onScanRequested` is never called;
  - **GCP9:** `store.setViewMode('list')` then `'3d'` with the cap exhausted still shows Retry 3D, because the round trip does not reset the cap.
- [ ] **Step 6: Implement in `CityStage.vue`.**
  - Extend `CityViewportExposed` with `unavailableReason: 'unsupported' | 'context-lost' | 'initialization-failed' | null` (exposed refs unwrap, so this is reactive).
  - Add `const retryable = computed(() => ['unsupported', 'initialization-failed'].includes(cityViewportRef.value?.unavailableReason ?? ''))` and `const viewportKey = ref(0)`.
  - `retry()`:
    1. calls the injected `retryCityRenderer`;
    2. does `viewportKey.value += 1`;
    3. after `await nextTick()` twice, focuses `cityViewportRef.value?.stageEl`.
  - In the template, `<CityViewport :key="viewportKey" …>`. Inside its slot, after `<CameraControls />`, add `<button v-if="retryable" type="button" class="ci-viewport__retry" @click="retry">{{ RETRY_3D }}</button>`.
  - CSS: `.ci-viewport__retry`, absolutely positioned under the notice, using the kit's button tokens. It must pass the contrast gate and axe.
- [ ] **Step 7: The written amendments (GCN2).**
  - `renderer-port.ts:28-29`: "On unavailable{context-lost} the VIEW disposes and reconstructs, at most 3 times automatically (reconstruct-cap.ts); then S11, with a user-initiated Retry 3D (renderer only, never scan)."
  - The WP-01 spec `:589-591`, as an LF edit: the same wording, plus "(amended by gap closure GCN2, 2026-10-04)".
- [ ] **Step 8: GREEN.** Run all three new files, plus `city-viewport.test.ts`, `city-viewport-wiring.test.ts`, `responsive-floor.test.ts`, `city-view.test.ts`, the axe files, contrast-gate and the microcopy contract.
- [ ] **Step 9: Gate and commit.** Subject: `fix(renderer): at most 3 automatic reconstructions, then the 3D-unavailable notice with Retry 3D (renderer only, never scan) (gap closure GRA2, F14, M80)`.

---

### Task 5: The §7 root-unavailable producer, and native scenario 42 (GRA4, GCO5)

**Files:**
- Modify:
  - `src/application/run-state.ts`: the `rootUnavailable` field, `SCAN_FAILED.cause?`, a new `ROOT_UNAVAILABLE` action;
  - `src/application/scan-coordinator.ts`: `finishFailed(runId, message, cause?)` at `:153`, plus `reportRootUnavailable(rootPath)`;
  - `src/ui/stores/run-store.ts`;
  - `src/ui/screens/CityWorkspace.vue:117-118`;
  - `src/host/scan-flow.ts`: `runRefresh` gains `port: SourceFileSystemPort`;
  - `src/host/city-scan-controller.ts:90`;
  - `tests/e2e/city.e2e.ts`;
  - `tests/e2e/required-scenarios.json`.
- Create:
  - `tests/unit/run-state-root-unavailable.test.ts`;
  - `tests/component/root-unavailable.test.ts`;
  - `tests/host/scan-flow-root-unavailable.test.ts`.

**Interfaces:**
- Produces:
  - `ScanLifecycleState.rootUnavailable: boolean` (initial `false`);
  - `RunAction` gains `{ type: 'SCAN_FAILED'; runId; message; cause?: 'root-unavailable' }` and `{ type: 'ROOT_UNAVAILABLE'; message: string }`;
  - `ScanCoordinator.reportRootUnavailable(rootPath: string): void`;
  - `runRefresh(app, coordinator, profile, storedScope, clock, profileStore, boundRoot, port)`, with `port` added last.

- [ ] **Step 1: RED (unit).** The reducer must satisfy:
  - `SCAN_FAILED` with `cause: 'root-unavailable'` sets `rootUnavailable: true`;
  - `SCAN_FAILED` without a cause leaves it `false`;
  - `SCAN_STARTED` clears it;
  - `ROOT_UNAVAILABLE` sets it and the banner (`Scan failed: <message>`) only when no run is running or cancelling. During a run it returns the same reference;
  - `publishedSnapshotId` is unchanged throughout.

  The coordinator must satisfy:
  - a `start` whose root stat says missing dispatches `SCAN_FAILED` with the cause, using the fake filesystem and copying a scan-coordinator unit test's setup;
  - `reportRootUnavailable('/x')` dispatches `ROOT_UNAVAILABLE` with the message `The source directory is no longer available: /x`.
- [ ] **Step 2: Implement** the reducer cases, `finishFailed`'s cause (`:153` passes `'root-unavailable'`), `reportRootUnavailable`, and the field in `initialScanLifecycleState`. `run-store.setLifecycle` copies `rootUnavailable`.
- [ ] **Step 3: RED (component).** Mount `App` the way the axe `mountLeaf` helper does (`tests/component/axe-support.ts:60`), with a published snapshot. Set the run store to `{ run: { status: 'failed', … }, rootUnavailable: true }`. Expect:
  - the status banner text is exactly `COPY_28`, with no "Scan failed:" in it;
  - the file rows are still listed.

  **Control:** with `rootUnavailable: true` and **no** snapshot, the welcome state shows, not COPY_28.

  It is RED because `CityWorkspace.vue:118` hard-codes `false`.
- [ ] **Step 4: Implement.** In `CityWorkspace.vue`, set `rootUnavailable: runStore.rootUnavailable && store.snapshot !== null`. Replace the line-90 comment's "root unavailability is never wired" with one line on why it is safe now: the flag is set only on a failed or refused run, and a scan start clears it.
- [ ] **Step 5: RED (host).** Test `runRefresh` with a fake port whose `stat(boundRoot)` returns `{ exists: false }`:
  - it calls `coordinator.reportRootUnavailable(boundRoot)`;
  - it never calls `openScopeModal` (mock `./scope-modal` or wherever `openScopeModal` lives) or `coordinator.start`.

  Run it for both `boundRoot === storedScope.rootPath` and a different `boundRoot`. **Control:** an existing `boundRoot` that equals the stored root starts the scan.
- [ ] **Step 6: Implement.** At the top of `runRefresh`:

  ```ts
  const target = boundRoot ?? storedScope.rootPath;
  const rootStat = await port.stat(target);
  if (!rootStat.exists || !rootStat.isDirectory) { coordinator.reportRootUnavailable(target); return; }
  ```

  `city-scan-controller.ts:90` passes `this.deps.getFilesystem()`. Update every other `runRefresh` caller and test that grep finds.
- [ ] **Step 7: Native scenario 42.** In `tests/e2e/city.e2e.ts`, inside the existing `describe`, add a test titled exactly `the city shows the source as unavailable when its folder is gone, and keeps the snapshot readable`, and append the same title to `required-scenarios.json`.
  - Steps: scan a copied project (`copyProject` + `scanFolder`). **Positive control:** file rows are listed.
  - Rename the folder on disk from the test process (`fs.renameSync` on the vault path that `copyProject` used), then run `scan-codebase` (the `rescan` helper or the command).
  - Assert:
    - the status banner shows `COPY_28`, imported from the copy module, never a literal;
    - the file rows are still listed;
    - no scope modal opened.
  - Rename the folder back in `finally`.
  - **RED:** with Task 5's `CityWorkspace.vue` change temporarily reverted, the banner reads "Scan failed…". Run only `city.e2e.ts`; the full gate runs in Task 12.
- [ ] **Step 8: GREEN.** Run the three new files, `run-state` and `scan-coordinator` unit tests, `status-surfaces`, `view-surface`, `lifecycle-notices` tests, every `scan-flow` test, the axe files, and the native `city.e2e.ts` alone (portable Node, `FALLOW_BIN`).
- [ ] **Step 9: Gate and commit.** Subject: `feat(scan): a missing or unreadable root shows the source as unavailable and keeps the snapshot readable, and refresh never asks to approve a missing folder (gap closure GRA4, §7; scenario 42)`.

---

### Task 6: The codebase name in the toolbar (GRA8, GCO6, GCP5)

**Files:**
- Modify:
  - `src/domain/model.ts:88-99` (`name?: string`);
  - `src/domain/validator.ts:224-235`;
  - `src/ui/stores/city-store.ts`: `name`, `setName`;
  - `src/host/view-state-sync.ts`: `pickUiState`, `seedStoreFromState`;
  - `src/host/city-view.ts`;
  - `src/ui/components/AppToolbar.vue:78`;
  - `src/ui/styles.css`;
  - `docs/superpowers/specs/2026-09-17-codebase-inspector-wp01-design.md` §4.1: add `name?`, amended in writing (GCN3).
- Create:
  - `src/host/codebase-name.ts`;
  - `tests/unit/view-state-name.test.ts`;
  - `tests/host/codebase-name.test.ts`;
  - `tests/component/toolbar-name.test.ts`.

**Interfaces:**
- Produces:
  - `CityViewState.name?: string`.
  - `useCityStore().name: string | undefined` and `setName(name: string | undefined): void`.
  - `wireCodebaseName(deps: { plugin: Plugin; profileStore: ProfileStore; profileId: () => string | null; setName: (name: string | undefined) => void }): { refresh(): void; dispose(): void }`. It subscribes `watchPluginData(plugin, ['profiles'], refresh)`.

- [ ] **Step 1: RED (schema).** `decodeCityViewState` must:
  - keep `name: 'My repo'`;
  - drop a 201-character name while keeping the rest;
  - drop `name: 42` while keeping the rest;
  - keep a state with no name unchanged.

  The pickUiState/seed round trip must carry the name. RED because `.strict()` rejects the key.
- [ ] **Step 2: Implement.**
  - The schema: `name: z.string().max(200).optional().catch(undefined)`.
  - The model field.
  - The store field and `setName`.
  - `pickUiState` adds `name: store.name`, and `seedStoreFromState` calls `store.setName(state.name)`.
- [ ] **Step 3: RED (host).** Use the fake profile store (`tests/fixtures/fake-profile-store.ts`) and a fake plugin whose data watcher can be fired. Expect:
  - `refresh()` sets the profile's name;
  - a profiles change (rename) updates it;
  - two overlapping refreshes apply the **later** result: guard with a generation counter;
  - a missing profile (`get` returns `null`) leaves the current name;
  - `dispose()` unsubscribes.
- [ ] **Step 4: Wire `city-view.ts`.**
  - Construct `wireCodebaseName` in `onOpen`, after the store exists.
  - `profileId: () => this.state.profileId`; `setName` writes the store.
  - Call `refresh()` after the restore block, and in `onLifecycleChange` when `run.status === 'complete'`.
  - Call `dispose()` in `onClose`.

  The resolved name beats the persisted one because `refresh` runs after `seedStoreFromState`. Keep the file ≤ 360.
- [ ] **Step 5: RED (component).** With `store.name = 'My repo'`, `AppToolbar`'s **first child** is `.ci-toolbar__name`, whose text and `title` are both "My repo". With no name, the element is absent. Add the same case at the 700 px narrow leaf via `mountLeaf({ leafWidth: 700 })`.
- [ ] **Step 6: Implement.**
  - Markup: `<span v-if="store.name" class="ci-toolbar__name" :title="store.name">{{ store.name }}</span>` as the first child of `.ci-app__toolbar`.
  - CSS: `min-width: 0; max-width: 16em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ci-text); font-weight: var(--font-semibold, 600);`.
  - The TopBar keeps the folder name (GCP5).
- [ ] **Step 7: Write the §4.1 amendment and record the downgrade in LIM.** An older build's `.strict()` schema rejects a leaf state carrying `name` and drops it once.
- [ ] **Step 8: GREEN.** Run the new files, `view-state`, `view-state-sync`, `validator`, `city-store`, `toolbar-scan`, `city-view`, the axe files and contrast-gate.
- [ ] **Step 9: Gate and commit.** Subject: `feat(city): the codebase name in the toolbar, resolved from the profile and kept in the leaf state (gap closure GRA8, §4.1 amended)`.

---

### Task 7: The harness measuring script and the measured drawer threshold (GRA6, GCO17, GCP4)

**Files:**
- Create:
  - `scripts/harness-measure.mjs`;
  - `tests/fixtures/drawer-threshold-measure.json`;
  - `tests/unit/drawer-threshold.test.ts`.
- Modify:
  - `scripts/harness-shot.mjs`: export `captureShot`/`waitForHarnessReady` if reused, otherwise duplicate nothing large;
  - `package.json` (`"harness-measure": "node scripts/harness-measure.mjs"`);
  - `tests/unit/layout-budget.test.ts`: derive the two `@container` strings from `DRAWER_MAX_INLINE_SIZE`; they are hard-coded today;
  - if the value moves: `src/ui/responsive.ts:19`, `src/ui/styles.css:220,261` and `src/ui/styles/screens-act.css:5`.

**Interfaces:**
- Produces: the script's CLI (Task 8 uses it; nothing imports the script):
  - `--sweep` writes the threshold JSON;
  - `--wide 1280,1876,2560` prints the wide-leaf JSON for Task 8.

- [ ] **Step 1: The script.** It reuses harness-shot's launch: `createServer({ configFile: 'vite.harness.config.ts' })`, `resolveChromiumExecutable()` and `LAUNCH_ARGS`. To try a candidate threshold T, it starts the Vite server with one extra plugin whose `transform` rewrites:
  - `= 820` in `src/ui/responsive.ts` to `= T`;
  - `820px` and `819px` in `src/ui/styles.css` and `src/ui/styles/screens-act.css` to `Tpx` and `(T-1)px`.

  It restarts the server per candidate, because the CSS and the constant must move together, exactly as a real change would.

  **Measurements:** for each candidate T from 700 to 900 in steps of 20, load `?screen=s05&width=T` and `?screen=s07&width=T` at a viewport of T + 60 × 900, then record:
  - the widths of `.ci-shell__nav`, `.ci-app__list-wrapper`, `.ci-inspector`, `.ci-app__stage-column` and `.ci-viewport__stage`;
  - `clipped`: every one of those, plus `.ci-app__toolbar` and `.ci-shell__topbar`, whose `scrollWidth > clientWidth + 1`;
  - whether `.ci-viewport__notice` exists (the stage floor).

  For evidence, also record the sidebar-like widths 360 and 480 and the pop-out-like widths 1024 and 1440 at the chosen T.
- [ ] **Step 2: Run the sweep.** Write `tests/fixtures/drawer-threshold-measure.json` as `{ candidates: [{ threshold, screen, clipped, stage, floorNotice }], chosen }`. Here `chosen` is the smallest T where, at both screens, `clipped` is empty and `stage ≥ 320`. **GCP4:** if the nav band itself (`.ci-shell__nav`, `.ci-shell__topbar`) clips at a T where the city boxes do not, stop and report for a ruling. Do not split the constant.
- [ ] **Step 3: RED.** `drawer-threshold.test.ts` reads the JSON. It asserts:
  - `DRAWER_MAX_INLINE_SIZE === chosen`;
  - `chosen` is the smallest passing candidate (recomputed from the rows);
  - all four CSS places carry `chosen` and `chosen - 1`, so `screens-act.css:5` is now pinned too.

  If `chosen !== 820`, this is RED against HEAD. If `chosen === 820`, show a recorded mutation RED instead: temporarily set `screens-act.css:5` to 799px, then revert.
- [ ] **Step 4: Implement** the value in all four places, if it moved. Make `layout-budget.test.ts`'s `wideLayoutBlock()` build its strings from the constant.
- [ ] **Step 5: GREEN.** Run `drawer-threshold`, `layout-budget`, `container-box`, `kit-css-fallbacks`, the component tests that use `leafWidth` (grep `leafWidth:`), and the axe files. Run `npm run harness-shot` and look at `s10-narrow-dark` and every `width=700` shot.
- [ ] **Step 6: Gate and commit.** Subject: `feat(harness): harness-measure sweeps the drawer threshold; set and pin it at <T> px in all four places (gap closure GRA6)`.

---

### Task 8: The wide leaf grows the stage (GRA5, GCO14, GCN6)

**Files:**
- Modify: `src/ui/styles.css:247-259` (the two `clamp()` percentages only; the caps and minimums stay).
- Create:
  - `tests/fixtures/wide-leaf-measure.json`;
  - `tests/unit/wide-leaf.test.ts`;
  - two harness shots in `scripts/harness-shot.mjs`: `wide-1876-s07-dark` at 1876×1000 and `wide-2560-s07-dark` at 2560×1200. Update `tests/build/harness-shot.test.ts`'s pinned ids.

- [ ] **Step 1: Measure the baseline.** Run `node scripts/harness-measure.mjs --wide 1280,1876,2560` at s07 (inspector open), with the viewport equal to the width and no `width=` (the leaf fills the page, nav inline). Record the stage width per viewport; it is about 980 px at 1876 by the spec's estimate.
- [ ] **Step 2: RED.** `wide-leaf.test.ts` reads `wide-leaf-measure.json`. It asserts:
  - the 1876 row's stage is ≥ **1140**;
  - the JSON's recorded percentages equal the `clamp()` percentages in `styles.css`, so the JSON cannot go stale silently;
  - the caps 320/360 and the minimums 180/200 are unchanged.

  Commit the baseline JSON first in the working tree; the test fails on 1140.
- [ ] **Step 3: Choose by measurement.** Lower the list percentage (18 %) and the inspector percentage (20 %) in 1-point steps, re-measuring each time. Stop at the first pair (the inspector lowered first) where the stage is ≥ 1140 at 1876, with no box in `clipped` at 1280, 1876 or 2560. Write the final measurement to the JSON. Never use estimated values (GCN6).
- [ ] **Step 4: GREEN.** Run `wide-leaf`, `layout-budget` (B2's shrinkability still holds) and `stage-height`. Capture and look at the three widths and `s07-selected-dark`.
- [ ] **Step 5: Gate and commit.** Subject: `feat(layout): a wide leaf gives the stage ≥ 1140 px at 1876 with the inspector open (list <a> %, inspector <b> %, measured) (gap closure GRA5)`.

---

### Task 9: Investigate rows keep Open beside the path (GRA9, B13)

**Files:**
- Modify:
  - `src/ui/styles/screens-act.css:60-69`;
  - `src/ui/screens/investigate/NotesPanel.vue` and `OrphanNotesPanel.vue`: wrap the two row buttons in `<span class="ci-notes-panel__actions">` / `<span class="ci-orphan-notes__actions">`.
- Create:
  - `tests/unit/investigate-rows.test.ts`;
  - a harness shot with a long orphan path: add `&items=long-orphan` or the nearest existing query that yields an orphan note, checking `tests/harness/page.ts`.

- [ ] **Step 1: RED.** A CSS test, using the regex-rule pattern from `tests/unit/city-stage-floor.test.ts`, asserts that each `__item` rule has:
  - `display: grid`;
  - `grid-template-columns: minmax(0, 1fr) auto`;
  - no `flex-wrap`.

  It also asserts that each `__actions` rule has `display: flex` and `flex: none`, and that the `__open-error` rule spans `grid-column: 1 / -1`. A component check renders both panels inside a 320 px-wide container (through `investigate-*` mounts) and asserts the buttons sit inside `__actions`. RED: flex-wrap.
- [ ] **Step 2: Implement:**

  ```css
  :where(.codebase-inspector-root) .ci-notes-panel__item { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: var(--ci-space-1) var(--ci-space-2); }
  :where(.codebase-inspector-root) .ci-notes-panel__path, :where(.codebase-inspector-root) .ci-notes-panel__status { grid-column: 1; }
  :where(.codebase-inspector-root) .ci-notes-panel__actions { grid-column: 2; grid-row: 1 / span 2; display: flex; flex: none; gap: var(--ci-space-2); }
  :where(.codebase-inspector-root) .ci-notes-panel__open-error { grid-column: 1 / -1; margin: 0; color: var(--ci-text-danger); }
  ```

  Apply the same rules to `.ci-orphan-notes__*`. Drop `flex: 1 1 12em` from `__path` and keep `overflow-wrap: anywhere`.
- [ ] **Step 3: GREEN.** Run the new test, `investigate-create`, `investigate-refresh`, `investigate-refresh-review`, the axe files, contrast-gate and `kit-css-fallbacks`. Capture and look at the long-path shot.
- [ ] **Step 4: Gate and commit.** Subject: `fix(investigate): note rows are a two-column grid, so Open never wraps away from its path (gap closure GRA9, B13)`.

---

### Task 10: Relation arcs clear the buildings in their corridor (GRA7, GCO19, B2)

**Files:**
- Modify:
  - `src/visualization/relation-arcs.ts:34-37` and `:100-155`;
  - `tests/harness/page.ts`, `tests/harness/fixture.ts` and `tests/harness/mount.ts` (`?city=dense|sparse`);
  - `scripts/harness-shot.mjs` and `tests/build/harness-shot.test.ts`, for the shots `wp03-city-relations-dense-dark` and `wp03-city-relations-sparse-dark`, at 1280×1050 with `report=demo&select=<a related file present in that fixture>`.
- Create: `tests/component/relation-arcs-clearance.test.ts`.

**Interfaces:**
- Consumes: the lots map from `setLots` (`:163-166`), which already holds every lot.
- Produces: `ARC_CLEARANCE = 2` (world units), exported for the test.

- [ ] **Step 1: RED.** Build the 8/128/8 fixture with three lots on the x axis, lot dimensions `[2, h, 2]`, and centre y = h/2:
  - A at x = 0 (h 8);
  - M at x = 14 (h 128);
  - B at x = 28 (h 8).

  Draw one arc A → B. Read the line geometry's positions; the apex is the highest sampled y, sample 12 of 24. Assert apex ≥ 128 + `ARC_CLEARANCE`. It is RED at **13.9**.

  **Controls:**
  - with M lowered to h 4, the arc keeps today's lift (apex 13.9);
  - a lot beside the corridor but not in it (at z = 10) does not raise it;
  - the endpoints are unchanged.
- [ ] **Step 2: Implement.** In `rebuild()`, for each valid arc with xz endpoints `a` and `b`, find the tallest roof among lots other than `from` and `to` whose xz rectangle (`center ± dimensions/2`) intersects the segment `ab`. Use the slab test, about 15 lines, in a local `segmentHitsRect`. Then:

  ```ts
  function controlPoint(p0: Vector3, p2: Vector3, corridorTop: number): Vector3 {
    const horizontal = Math.hypot(p2.x - p0.x, p2.z - p0.z);
    const lifted = Math.max(p0.y, p2.y) + LIFT_PER_DISTANCE * horizontal + LIFT_BASE;
    // The quadratic's apex is control.y / 2 + (p0.y + p2.y) / 4; raise the control so the apex clears the corridor.
    const cleared = 2 * (corridorTop + ARC_CLEARANCE) - (p0.y + p2.y) / 2;
    return new Vector3((p0.x + p2.x) / 2, Math.max(lifted, cleared), (p0.z + p2.z) / 2);
  }
  ```

  Arcs stay depth-tested.
- [ ] **Step 3: GREEN.** Run the new file, `relation-arcs.test.ts`, `relations-budget.test.ts` (the benchmark's time budget must still pass with the corridor scan at 64 arcs) and `relation-renderer-wiring`.
- [ ] **Step 4: Dense and sparse fixtures.**
  - `fixture.ts` gains `harnessSnapshot(kind: 'default' | 'dense' | 'sparse')`:
    - dense: `buildSnapshotFixture({ files: 600, directories: 12, lineCounts: <a few tall files between related files> })`;
    - sparse: 24 files over 3 directories.
  - Check that the demo report's selected file exists in each, or pick one that does.
  - `page.ts` reads `city`.
  - Capture before (the corridor change temporarily reverted) and after, for:
    - `wp03-city-relations-dark`;
    - `-dense-dark`;
    - `-sparse-dark`;
    - `wp03-city-cycle-dark`.
- [ ] **Step 5: Report what the dense capture shows.** The controller rules on the optional half of GCO19: if a selected file's arc is still hidden behind buildings, its lines and cones draw with `depthTest: false` and `renderOrder = 1`. If that is ruled in:
  - make the change;
  - add a test asserting both materials' `depthTest === false`;
  - amend N29 and §6 item 6 in writing, in `docs/superpowers/specs/2026-09-24-wp03-part1-dependencies-design.md:116` and `:295` (LF), citing GCO19;
  - update the code comment at `:137-138`.
- [ ] **Step 6: Gate and commit.** Subject: `fix(arcs): each relation arc clears the tallest building in its corridor; dense and sparse harness cities (gap closure GRA7, B2)`.

---

### Task 11: The vendor quirks — pinia's dead XHR island and Three.js's marker (GRA10, B23, GCP6)

**Files:**
- Create:
  - `scripts/pinia-saveas-pure.mjs` and `scripts/pinia-saveas-pure.d.mts`;
  - `tests/build/pinia-saveas-pure.test.ts`;
  - `src/visualization/three-marker.ts`;
  - `tests/unit/three-marker.test.ts`.
- Modify:
  - `vite.config.ts` (`plugins: [piniaSaveAsPure(), vue()]`);
  - `tests/host/build-output.test.ts:93-109`;
  - `src/main.ts` (`onunload`);
  - `tests/host/plugin-onload.test.ts`;
  - `tests/e2e/plugin-lifecycle.e2e.ts:82-161`;
  - `docs/superpowers/notes/2026-09-17-wp01-limitations.md:153-178`.

**Interfaces:**
- Produces:
  - `piniaSaveAsPure(): import('vite').Plugin`, with `enforce: 'pre'`;
  - `releaseThreeMarker(target: { __THREE__?: unknown }): void`.

- [ ] **Step 1: RED (bundle).** In `build-output.test.ts`:
  - expect `occurrences('XMLHttpRequest')` to be **0**;
  - replace the non-vacuity check at `:108` with a pinia-owned string that survives minification. Grep `dist/main.js` for one before changing anything (e.g. a `getActivePinia` error message), and record which one you chose.

  Run `npm run build` and then the test; it is RED at 2.
- [ ] **Step 2: RED (plugin).** `tests/build/pinia-saveas-pure.test.ts` covers the plugin's `transform`:
  - for an id ending in `node_modules/pinia/dist/pinia.js` (both slash styles), it rewrites `const saveAs = !IS_CLIENT ? … ;` to `const saveAs = /*#__PURE__*/ (() => !IS_CLIENT ? … )();`;
  - for any other id it returns `null`;
  - for the pinia id **without** the needle it calls `this.error` with a message naming GRA10.
- [ ] **Step 3: Implement:**

  ```js
  const PINIA_ID = /[\\/]node_modules[\\/]pinia[\\/]dist[\\/]pinia\.js$/;
  const NEEDLE = /const saveAs = (!IS_CLIENT \?[^;]*);/;
  export function piniaSaveAsPure() {
    return {
      name: 'ci-pinia-saveas-pure',
      enforce: 'pre',
      transform(code, id) {
        if (!PINIA_ID.test(id)) return null;
        if (!NEEDLE.test(code)) this.error('pinia-saveas-pure (GRA10): the saveAs needle is gone; re-check pinia before shipping its XHR island');
        return { code: code.replace(NEEDLE, 'const saveAs = /*#__PURE__*/ (() => $1)();'), map: null };
      },
    };
  }
  ```

  Then `npm run build`. Both build-output cases are GREEN, and the devtools-hook absence check still passes. **If the island does not drop** (XHR still 2), stop and report. Do not widen the transform.
- [ ] **Step 4: RED (marker).** `three-marker.test.ts`:
  - `{ __THREE__: REVISION }` → the key is deleted;
  - the control `{ __THREE__: '185' }` (a foreign revision) is kept;
  - `{}` is a no-op.

  `plugin-onload.test.ts`: after `onunload()`, `window.__THREE__` is `undefined` when it held `REVISION`, and a foreign value survives. RED: the module is missing, and the unload does not clear it.
- [ ] **Step 5: Implement.** `three-marker.ts` imports `REVISION` from `three`. `main.ts`'s `onunload` calls `releaseThreeMarker(window as unknown as { __THREE__?: unknown })` last. Check the obsidianmd lint rules for `window` in `main.ts`; if one objects, take the global through `activeWindow`'s owner and note why.
- [ ] **Step 6: Native.** The unload scenario's `hostState()` (`:41-51`) gains `three: window.__THREE__ ?? null`, read via `executeObsidian`.
  - **Positive control:** before the disable at `:141`, `three === REVISION`, imported from `three` in the test file.
  - **After:** `null`.
  - **RED:** with `main.ts`'s call temporarily removed, after = REVISION.

  Run `plugin-lifecycle.e2e.ts` alone; the full gate runs in Task 12.
- [ ] **Step 7: LIM.** Rewrite `:153-178`:
  - the FileSaver island is now dropped by the PURE pre-transform, which fails the build if the needle disappears;
  - the Three.js marker is cleared on unload only when it equals our `REVISION` (GCP6, reversing "disclosed rather than suppressed"); a genuine double bundle in one session still warns.
- [ ] **Step 8: Gate and commit.** Subject: `fix(build): pinia's dead FileSaver XHR island drops out of the bundle, and unload clears our own Three.js marker (gap closure GRA10, B23)`.

---

### Task 12: Evidence and verification (Part A)

**Files:**
- Modify:
  - the two CRLF evidence notes: the G8 table and its mirror, plus a Part A section at the end of `gate-evidence.md`;
  - `docs/deliverables/Test Evidence.md`: the native paragraph, 41 → 42, `city` 2 → 3;
  - `docs/deliverables/Native Codebase City.md`: its Delivery record gains the Part A items;
  - `docs/superpowers/notes/2026-09-17-wp01-limitations.md`: any Part A limitation not yet recorded, i.e. GRA2's shared COPY-14 (spec §9), the GRA8 downgrade, and GRA1's outcome;
  - the count tests, only where they pin a count.

- [ ] **Step 1:** Run `npm run test`. Take the G8 figures from a run where Z38 executed. Refresh the counts once, with Edit/Write only, and prove the CRLF afterwards.
- [ ] **Step 2:** `npm run verify` exits 0. Report every run with its Z38 outcome.
- [ ] **Step 3: The native gate** on 1.13.4, then latest, under the portable Node. **Expected:** "Verified 42 executed native Vitest cases, including all 42 required scenarios." Also run:
  - `npm run test:fallow` (11/11);
  - `npm run analyze` (4);
  - `npm audit` (0).
- [ ] **Step 4: Captures.** Run `npm run harness-shot`, look at every capture this part affected, and report what each shows:
  - the city (layout, if adopted);
  - Retry 3D (if the harness can show it, via `webglDisabled`);
  - the toolbar name;
  - the narrow and wide leaves;
  - the Investigate rows;
  - the dense and sparse arcs.
- [ ] **Step 5: Commit.** Subject: `docs(evidence): gap-closure Part A — 42 native scenarios, the measured layout numbers and the counts`.

After the push, the controller takes one look at PR 1's CI run (`gh run list`; no polling loop) and rules on any failure (GCN9).
