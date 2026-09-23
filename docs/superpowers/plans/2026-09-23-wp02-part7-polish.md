# WP-02 Part 7 polish pass — close the deferred findings and the open gaps: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every OPEN item of the verified open-items inventory (taken at d42a2c2, the PR #1 head) that the controller ruled IN (polish ledger L1), without changing an approved decision:
- the fallow runner, its adapters and the process guard (A1–A10, G2);
- the analysis application layer (B1–B10);
- the analysis UI: binding truth first (C1, C2, C10, C11, C13), then focus, copy and tests (C3–C9, C12, C14–C17, C19);
- settings (D1–D5);
- evidence truth and accessibility (E2–E4, E11–E13), then the review store and adapter refactors and the review-save failure mapping (E1, E5–E9, E14);
- the older WP-02 screens (F1–F5) and test hygiene (G1, G3–G7);
- dead code and the stale evidence documents (X1, H1–H6, D6), then one full verification.

**Architecture:** The Part 1–7 architecture is unchanged:
- screens read read models, stores and copy only (Part 6 E20);
- every value is a `MetricValue`; absent evidence is `unknown`, never `0`;
- evidence goes through the one session-only `EvidenceRepository` (Y28); review state through the `ReviewRepository` port and its durable adapter (Part 6);
- the only process code is `src/adapters/fallow/{node-process-access,fallow-runner}.ts` (Z14, Z37).

This pass adds five small modules, and moves one class:
- `src/domain/plain-data.ts`: `isPlainObject`, `asUnknownArray` (E5, polish ledger L11);
- `src/ui/read-models/severity.ts`: fallow's severity words in one place (E2, E8);
- `src/ui/read-models/review-failure.ts`: `reviewFailureText` (E1);
- `src/ui/screens/use-import-report.ts` (E9) and `src/ui/screens/sources/FallowRemoveDialog.vue` (F5);
- `ReviewStoreError` moves from the durable adapter to the port module (E1, L3).

**Tech Stack:** TypeScript 6.0.3, Vue 3.5.43 (`<script setup>`), Pinia 4.0.3, zod 4.6.5, Vitest 5.0.1 (`vitest.config.ts` projects `node` and `jsdom`) + @vue/test-utils 2.5.1, Node 24 (`node:*` in tests and scripts only), fallow 3.27.0 (opt-in tests and `npm run analyze` only, never a dependency).

**Spec:** none new. The binding authorities are the Part 1–7 specs and ledgers:
- Part 1 (`2026-09-21-inspector-ui-shell-design.md`, A1–A13) through Part 7 (`2026-09-23-inspector-ui-part7-design.md`, Z1–Z44);
- the Part 3–7 ledgers (R, E, S, X, T, U, K, PF rulings);
- this pass's own amendments, recorded in `docs/superpowers/notes/2026-09-23-wp02-part7-polish-ledger.md`: **L2** (K41 amended: `executableName` also on the service and the store), **L3** (U27 amended: review-save failures name their reason), **L4** (spec §2's `SETTINGS_FALLOW_EXE_NAME` row corrected to what shipped).

Planning rulings are **L1…** in that ledger; execution rulings are "Polish E1"….

**Branch:** `feat/wp-02-part7-polish` (from d42a2c2, the PR #1 head), worktree `C:\Projects\codebase-inspector\.claude\worktrees\inspector-prototype-ui-18caac`. Nothing is pushed; the integration step is the owner's.

**Before Task 1:** `node_modules` is installed. The controller re-checks every "Consumes" name against what earlier tasks committed before each dispatch (Part 7 A10's pre-flight rule).

## Global Constraints

**Size** (eslint `max-lines`; measured at d42a2c2 with `wc -l`)
- `src/**/*.{ts,vue}` max **400** lines. `tests/**/*.ts` max **450** lines.
- `src/host/city-view.ts` is **297**; `tests/unit/city-budget.test.ts` caps it (and `src/ui/screens/CityWorkspace.vue`) at **360**. This pass does not touch either.
- The Part 7 caps still hold (Z43): `fallow-runner.ts` ≤ 300, `process-output.ts` ≤ 160, `executable-inspector.ts` ≤ 200, `node-process-access.ts` ≤ 90, `analysis-coordinator.ts` ≤ 330, `fallow-analysis-service.ts` ≤ 330, `analysis-state.ts` ≤ 220, `fallow-invocation.ts` ≤ 200, `analyzer-record.ts` ≤ 200 (K27), `analysis-store.ts` ≤ 200, `FallowInstalledRoute.vue` ≤ 260, `FallowRunPanel.vue` ≤ 220, `FallowRunBanner.vue` ≤ 100, `audit-copy/fallow-run.ts` ≤ 240, `read-models/fallow-run.ts` ≤ 120. A file that would pass its cap is split, never compressed.
- `src` files this plan touches, with their size now: `src/adapters/fallow/fallow-runner.ts` 177, `src/adapters/fallow/process-output.ts` 105, `src/adapters/fallow/executable-inspector.ts` 119, `src/adapters/fallow/node-process-access.ts` 51, `src/application/analysis/analysis-coordinator.ts` 216, `src/application/analysis/analysis-state.ts` 100, `src/application/analysis/analyzer-record.ts` 127, `src/application/analysis/fallow-analysis-service.ts` 278, `src/application/analysis/fallow-invocation.ts` 133, `src/application/analysis/fallow-run-errors.ts` 43, `src/application/ports/evidence-repository.ts` 18, `src/application/ports/analyzer-binding-store.ts` 22, `src/application/scan-coordinator.ts` (read only), `src/domain/layout/districts.ts` 383, `src/domain/layout/scale.ts` 46, `src/visualization/picking.ts` 191, `src/host/analysis-notices.ts` 19, `src/host/settings-tab.ts` 274, `src/host/city-scan-controller.ts` 162, `src/main.ts` 124, `src/adapters/storage/plugin-data-review-repository.ts` 265, `src/adapters/storage/plugin-data-shape.ts` 113, `src/adapters/storage/plugin-data-binding-store.ts` 79, `src/adapters/storage/plugin-data-profile-store.ts` 45, `src/ui/stores/analysis-store.ts` 121, `src/ui/stores/review-store.ts` 329, `src/ui/stores/review-buckets.ts` 160, `src/ui/stores/ports/review-repository.ts` 210, `src/ui/read-models/fallow-run.ts` 65, `src/ui/read-models/overview.ts` 151, `src/ui/read-models/findings.ts` 165, `src/ui/read-models/evidence-index.ts` 154, `src/ui/read-models/review-record-codec.ts` 97, `src/ui/read-models/snapshot-comparison.ts` 76, `src/ui/read-models/use-read-models.ts` 186, `src/ui/read-models/use-lens-view.ts` 37, `src/ui/read-models/evolution.ts` 76, `src/ui/read-models/hotspots.ts` 91, `src/ui/audit-copy/fallow-run.ts` 171, `src/ui/audit-copy/fallow.ts` 193, `src/ui/audit-copy/quality.ts` 144, `src/ui/audit-copy/settings.ts` 101, `src/ui/audit-copy/shared.ts` 15, `src/ui/audit-copy/tests.ts` 72, `src/ui/audit-copy/workbench.ts` 80, `src/ui/inspector-copy.ts` 297, `src/ui/copy.ts` 326 (read only), `src/ui/kit/Dialog.vue` 82, `src/ui/components/CodebaseFileListGroup.vue` 156, `src/ui/components/FileInspector.vue` 211, `src/ui/screens/SourcesScreen.vue` 253, `src/ui/screens/sources/ConnectFallowDialog.vue` 298, `src/ui/screens/sources/FallowInstalledRoute.vue` 238, `src/ui/screens/sources/FallowRunPanel.vue` 159, `src/ui/screens/sources/FallowCardDetails.vue` 117, `src/ui/screens/sources/ScanStatusPanel.vue` 62, `src/ui/screens/QualityScreen.vue` 217, `src/ui/screens/FileDetailScreen.vue` 154, `src/ui/screens/TestsScreen.vue` 292, `src/ui/screens/OwnershipScreen.vue` 135, `src/ui/screens/ArchitectureScreen.vue` 242, `src/ui/screens/architecture/BoundaryRuleTable.vue` 78, `src/ui/screens/architecture/RuleEditor.vue` 128, `src/ui/screens/test-confidence/CoverageGapsTable.vue` 92, `src/ui/screens/dependencies/PackageDetailDialog.vue` 120, `src/ui/screens/quality/FindingReviewDialog.vue` 248, `src/ui/screens/workbench/WorkItemEditor.vue` 315, `src/ui/screens/city/LensHeading.vue` 47. CSS (no cap): `src/ui/styles/screens-configure.css` 111, `src/ui/styles/screens-explore.css` 138, `src/ui/styles/screens-audit.css` 180. Script: `scripts/assert-bundle.mjs` 90.
- Test files this plan touches, with their size now: `tests/fixtures/process-guard.ts` 182, `tests/fixtures/fake-child-process.ts` 75, `tests/fixtures/real-spawn.ts` 14, `tests/fixtures/fake-process-port.ts` 60, `tests/fixtures/fake-fallow-analysis.ts` 85, `tests/fixtures/data-port-deps.ts` 29, `tests/unit/fallow-runner.test.ts` 215, `tests/unit/process-output.test.ts` 87, `tests/unit/executable-inspector.test.ts` 117, `tests/unit/assert-bundle.test.ts` 71, `tests/unit/no-process-execution.test.ts` 174, `tests/unit/node-access-boundary.test.ts` 153, `tests/unit/fallow-argv-policy.test.ts` 68, `tests/integration/fallow-analysis.test.ts` 287, `tests/fallow-real/fallow-real.test.ts` 154, `tests/unit/fallow-analysis-service.test.ts` 272, `tests/unit/analysis-coordinator.test.ts` 339, `tests/unit/analysis-state.test.ts` 96, `tests/unit/fallow-invocation.test.ts` 118, `tests/unit/analysis-store.test.ts` 172, `tests/unit/fallow-run-read-model.test.ts` 57, `tests/unit/fallow-run-copy.test.ts` 60, `tests/host/analysis-notices.test.ts` 33, `tests/component/connect-fallow.test.ts` 370, `tests/component/connect-fallow-routes.test.ts` 338, `tests/component/settings-fallow.test.ts` 151, `tests/component/settings-tab-purge.test.ts` 84, `tests/component/settings-tab-validation.test.ts` 217, `tests/host/plugin-onload.test.ts` 231, `tests/unit/evidence-index.test.ts` 199, `tests/component/findings-lens.test.ts` 293, `tests/component/evolution-screen.test.ts` 208, `tests/unit/review-replace-all.test.ts` 292, `tests/unit/review-repository-registry.test.ts` 77, `tests/component/tests-screen.test.ts` 167, `tests/component/architecture-rules.test.ts` 169, `tests/component/status-surfaces.test.ts` 215, `tests/unit/css-class-scope.test.ts` 139, `tests/component/ownership-screen.test.ts` 168, `tests/component/quality-screen.test.ts` 325, `tests/component/kit-evidence.test.ts` 42, `tests/component/toolbar-scan.test.ts` 143, `tests/harness/seed.ts` 154, `tests/harness/mount.ts` 373, `tests/harness/harness-evidence.test.ts` 103.
- **At or near the tests cap — never grow them** (polish ledger L25): `tests/component/settings-tab.test.ts` **436** (Task 4 edits one constructor call in place: 436 → 436), `tests/host/city-view-store-wiring.test.ts` **450**, `tests/component/welcome-state.test.ts` **446**, `tests/host/city-view.test.ts` **440**, `tests/contracts/review-repository.contract.ts` **423**, `tests/host/window-migration.test.ts` **420**, `tests/unit/evidence-numbers.test.ts` **403**, `tests/component/fallow-run-panel.test.ts` **391** (Task 3a rewrites one case in place). New tests go in new files, named in each task.

**Layering**
- `src/domain/**` changes in exactly two ways (L11): the new `src/domain/plain-data.ts` (E5), and the `export` keyword dropped from `UNAVAILABLE_FOOTPRINT` and `SCALE_NAME` (X1). No frozen §4 type or member changes.
- `src/application/**` imports no adapter, no host, no UI and no Node module.
- Process I/O lives only in `src/adapters/fallow/`. Only `node-process-access.ts` names `node:child_process`; only `fallow-runner.ts` calls `spawn`, **once** (A6, L12).
- `src/ui/**` never imports `src/adapters/**` or `src/host/**`. Screens reach application types through `src/ui/read-models/fallow-run.ts` (the E20 barrel) and state through the stores.
- `obsidianmd/no-nodejs-modules` stays an error in `src/**`.

**Process safety (Z13–Z18, Z37)** — unchanged, and nothing in this pass may loosen it:
- The run argv is exactly `['--format', 'json', '--no-cache', '--quiet', '--root', root]`; the probe argv is exactly `['--version']`; the cwd is always the root.
- Spawn options are exactly `{ cwd, env, shell: false, windowsHide: true, detached: platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] }`.
- No `shell: true`, no `*Sync` process API, no `exec`, `execFile`, `fork`, `worker_threads` or Electron opener anywhere in `src/`.
- Nothing executes on `onload`, a view open or restore, a settings refresh, a review, or a codebase bind (Z36; C15 pins the UI half).

**Evidence (Part 6, plus Z23/Z25)**
- Absent evidence is never rendered or exported as `0`. No composite score, no invented confidence.
- An operational run failure never removes evidence; it marks it `staleReason: 'failed-run'`. A cancel, `snapshot-changed`, `superseded`, `version-changed`, `changed-since-review`, `store-unsupported` or `source-mismatch` leaves evidence exactly as it was (B2, B5 keep it so).
- Every value from a process, a file or `data.json` is rendered through Vue text interpolation only: never `v-html`, `innerHTML` or an `href`.

**Storage**
- No new durable key. Collected and imported evidence stays session-only (Y28); D5 removes a purged profile's session entry. Writes go only through `writePluginDataSlice` under the existing lock; E7 makes it skip `saveData` when a mutation changed nothing (L17).

**TypeScript and lint** (carried from Parts 6 and 7)
- tsconfig `lib` is ES2020: no `.at()`, `Object.hasOwn`, `replaceAll`, `findLast` in `src`.
- oxlint `--deny-warnings` with `consistent-function-scoping`: a closure that captures nothing is hoisted to module scope. No `[...set]` spread in `src` (`unicorn/no-useless-spread`): use `Array.from(set)`.
- **PF1:** timers in `src` are read through a local binding at call time (`const schedule = setTimeout;`), never called bare (`obsidianmd/prefer-window-timers`); tests use `node:timers/promises` for real waits.
- **PF2:** no no-op closure initialisers (`let off = (): void => {}`); use a nullable variable or a module-level `noop`, and hoist capture-free test helpers to module scope.
- **PF14:** store and composable members a screen destructures are arrow-function properties, never methods (`typescript-eslint/unbound-method`).
- **no-unnecessary-type-assertion** (Part 7 E13): no `as` a type already has; `npx eslint <file> --max-warnings 0` catches it before commit.
- `exactOptionalPropertyTypes` is review discipline: never assign `undefined` to an optional property; spread it in conditionally.
- A regex containing a control character needs `// eslint-disable-next-line no-control-regex -- <reason>`.
- An exported type or constant that no other module imports is a new `npm run analyze` finding: keep helpers module-private unless another module uses them.

**Browser globals and accessibility** (carried from Part 6)
- No bare `window`, `document`, `setTimeout`, `localStorage` in `src/ui/**`. Use `el.ownerDocument`, `nextTick`. Never `x instanceof HTMLElement` (use `.instanceOf(HTMLElement)`).
- Element ids come from `useUniqueId()`.
- **E40:** a button that can become blocked while focused uses `aria-disabled="true"` plus a guarded handler, never `disabled`.
- Announce only real outcomes (E17), through `reannounce(live, message)`. A dialog's refusal goes to its own `role="alert"`.

**Copy and CSS**
- Every new visible string goes in the `src/ui/audit-copy/` module of its surface: `fallow-run.ts` (Part 7 surfaces and settings rows), `fallow.ts` (Part 6 import and lens), `tests.ts`, `shared.ts`; the architecture rule-table strings sit beside `RULE_REMOVE` in `src/ui/inspector-copy.ts`. Never `src/ui/copy.ts`.
- CSS only in `src/ui/styles/{kit,screens-configure,screens-explore,screens-audit}.css`, under `:where(.codebase-inspector-root)`, BEM `ci-*` classes, colours only through `--ci-*` tokens. Never edit `src/ui/styles.css`. No Vue `<style>` blocks.

**Test infrastructure**
- Tests in `tests/{unit,contracts,integration,host,build}` run in the `node` project; `tests/{component,acceptance,benchmarks,harness}` and `tests/host/city-view*.test.ts` (plus the listed host files) run in `jsdom` (`vitest.config.ts`).
- A slow whole-`src` scan or a real-process wait gets an **explicit per-test timeout** (Part 7 E21: `30_000` for the whole-src scans, the poll's own deadline plus margin for waits).
- Real waits use `node:timers/promises` (`setTimeout as sleep`/`delay`), with a deadline, never a fixed sleep for an event.
- Every real process a test starts gets `realKill` (PF4) and is killed again in `afterEach`, group first on POSIX (A9).
- `node:*` imports are allowed under `tests/**` and `scripts/**` only.
- Every new test must fail without its fix: the implementer runs it RED and pastes the output. A pin on behaviour that already holds (a test-gap item) is proved by the **mutation** the task names: apply it, watch the pin fail, revert it, and paste both runs. Every `.every(...)` assertion is preceded by a non-empty check (E27).
- Edit files only with the Edit/Write tools. **Never `sed -i`, heredocs or scripts**: files are CRLF on Windows.

**Gates and commits**
- Per-task gate: `npm run typecheck && npm run lint:fast && npx eslint <touched src and test files> --max-warnings 0 && npx vitest run <the task's test files>`. Run gate commands in the foreground.
- **The WP-01 evidence-note counts are updated ONCE, in Task 9** (L28). Before that, `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` may fail on file counts, the `src/` floor and the analyze figures. Do not run the full suite per task, and do not "fix" those two tests early.
- `tests/host/clean-vault-install.test.ts` and `tests/unit/no-process-execution.test.ts` scan all of `src/`; under load re-run them alone before calling a failure real.
- Commit after each task, only the task's own files (never the ledger). Every message is written as `git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`, which puts the trailer after a blank line.

**Process**
- Implementers and reviewers never spawn subagents. Reviewers are read-only and create no files in the worktree.
- Implementers report: files changed with line counts, the gate output, the RED and GREEN output (or the mutation run for a pin), and every deviation from this plan and why.
- The controller records every ruling in the polish ledger.

## Review Focus

Five regressions this pass could introduce, most likely first. Each has a pinning test in its owning task.

1. **The busy re-check racing the bind (B1).** `trustAndRun` now re-checks `isActive` after its awaits and before `store.bind`. A check placed before the last await, or one that returns `busy` after binding, would still swap a binding under a live run. **Pinned in Task 2** (`tests/unit/fallow-analysis-service-consent.test.ts`, "B1: a run that starts while Trust and run awaits its checks is not bound over": a run started from inside the inspection; the result is `busy` and the stored path is still the old one).
2. **The `ReviewStoreError` mapping hiding a real error (E1, and its twin B2).** A mapping keyed on anything looser than `instanceof ReviewStoreError` (a `code` property, a message) would turn a real failure into "the 1 MB limit". **Pinned in Task 5b** (`tests/unit/review-failure.test.ts`, "Review Focus 2: any other failure keeps the screen's own text", with a plain `Error`, an `Error` carrying `code: 'full'`, and a string) and **Task 2** ("B2: any other error from a trust write still ends the run as the internal failure").
3. **Dead-code un-exports breaking a frozen contract or a test import (X1).** Removing `export` from a symbol a test imports breaks typecheck of `tsconfig.test.json`; touching `SourceReference`, either `EntityId`, `getCamera`, `fs` or `getLifecycle` breaks a frozen §4 contract or an acceptance step. **Pinned in Task 8** (the gate runs `npm run typecheck`, which includes `tsconfig.test.json`; a per-symbol `grep -rnw` shows zero consumers before each un-export; `npm run analyze` must print exactly the accepted list, L27; the frozen names are checked by a grep step).
4. **F1 changing row semantics.** With `:interactive="false"`, a row no longer selects a rule or opens a file; the new buttons must do what the rows did, and nothing else may still depend on a row click. **Pinned in Task 6** (`tests/component/architecture-rules.test.ts` "F1: rule rows are static; Show selects the rule, a row click does not"; `tests/component/tests-screen.test.ts` "F1: gap rows are static; Open file opens the file, a row click does not").
5. **D5 removing evidence for the wrong profile.** The purge removes by the id it was asked to delete, after the analyzer purge, and only when the profile removal itself succeeded. **Pinned in Task 4** (`tests/component/settings-tab-purge.test.ts`, "D5: removes only the removed profile's session evidence, after the analyzer purge", and "D4: a failed removal is shown, keeps the profile, and removes no evidence").

## File map

| File | Status | Task | Responsibility |
|---|---|---|---|
| `src/adapters/fallow/fallow-runner.ts` | modify | 1 | A1 group-kill fallback, A2 pipe errors, A6 one spawn call |
| `src/adapters/fallow/node-process-access.ts` | modify | 1 | A2 `ReadableLike` error overload |
| `src/adapters/fallow/process-output.ts` | modify | 1 | A3 head index |
| `src/adapters/fallow/executable-inspector.ts` | modify | 1 | A4 `expectedName` |
| `scripts/assert-bundle.mjs` | modify | 1 | A5 bare `child_process` |
| `tests/fixtures/process-guard.ts` | modify | 1 | A6 `spawnCallCount`, A7 shell assignments, G2 fail-closed and header |
| `tests/fixtures/source-files.ts` | create | 1 | G2 the one test file walker |
| `tests/fixtures/fake-child-process.ts`, `tests/fixtures/real-spawn.ts` | modify | 1 | A2 `emitError`; A9 `killTree` |
| `tests/unit/{fallow-runner,process-output,executable-inspector,assert-bundle,no-process-execution,node-access-boundary,fallow-argv-policy}.test.ts`, `tests/integration/fallow-analysis.test.ts`, `tests/fallow-real/fallow-real.test.ts` | modify | 1 | the pins; A9 cleanup; G2 walker |
| `src/application/analysis/{fallow-analysis-service,analysis-coordinator,analysis-state,fallow-run-errors}.ts`, `src/application/ports/evidence-repository.ts` | modify | 2 | B1–B6, B10 |
| `tests/fixtures/fake-process-port.ts` | modify | 2 | B9 |
| `tests/fixtures/fallow-service-world.ts` | create | 2 | the service test world, shared |
| `tests/unit/fallow-analysis-service-consent.test.ts` | create | 2 | B1, B2, B7 |
| `tests/unit/{fallow-analysis-service,analysis-coordinator,analysis-state}.test.ts` | modify | 2 | world import; B5, B6, B8, B9; B10 rename |
| `src/ui/stores/analysis-store.ts`, `src/ui/screens/sources/{FallowRunPanel,FallowInstalledRoute,ConnectFallowDialog}.vue`, `src/ui/screens/SourcesScreen.vue`, `src/ui/audit-copy/fallow-run.ts` | modify | 3a | C1, C2, C10, C11, C13 |
| `tests/fixtures/fake-fallow-analysis.ts` | modify | 3a | `executableName` |
| `tests/component/fallow-binding-truth.test.ts` | create | 3a | C1, C2, C10 |
| `tests/unit/analysis-store.test.ts`, `tests/component/fallow-run-panel.test.ts` (one case in place) | modify | 3a | C1, C11, C13 |
| `src/ui/screens/sources/{FallowRunPanel,FallowInstalledRoute,ConnectFallowDialog}.vue`, `src/ui/screens/SourcesScreen.vue`, `src/ui/read-models/fallow-run.ts`, `src/ui/audit-copy/{fallow-run,fallow}.ts`, `src/host/analysis-notices.ts` | modify | 3b | C3–C9, C12, C17, C19 |
| `tests/component/fallow-run-polish.test.ts`, `tests/host/city-view-analysis.test.ts` | create | 3b | C3–C6, C14, C15, C17; C16 |
| `tests/unit/{fallow-run-read-model,fallow-run-copy}.test.ts`, `tests/host/analysis-notices.test.ts` | modify | 3b | C8, C9, C12 |
| `src/host/settings-tab.ts`, `src/main.ts`, `src/ui/audit-copy/fallow-run.ts` | modify | 4 | D1–D5 |
| `tests/component/{settings-fallow,settings-tab-purge,settings-tab-validation,settings-tab}.test.ts`, `tests/host/plugin-onload.test.ts` | modify | 4 | D1–D5; the eighth constructor argument |
| `src/ui/read-models/severity.ts` | create | 5a (5b extends) | E2, E8 |
| `src/ui/read-models/{findings,evidence-index,overview,use-read-models,use-lens-view,snapshot-comparison}.ts`, `src/ui/stores/{review-store,review-buckets}.ts`, `src/ui/screens/QualityScreen.vue`, `src/ui/components/CodebaseFileListGroup.vue`, `src/ui/audit-copy/fallow.ts` | modify | 5a | E2, E3, E4, E11, E12, E13 |
| `tests/unit/review-store-races.test.ts`, `tests/component/quality-focus-swap.test.ts` | create | 5a | E3, E4; E13 |
| `tests/unit/evidence-index.test.ts`, `tests/component/{findings-lens,evolution-screen}.test.ts` | modify | 5a | E2; E11; E12 |
| `src/domain/plain-data.ts`, `src/ui/read-models/review-failure.ts`, `src/ui/screens/use-import-report.ts` | create | 5b | E5; E1; E9 |
| `src/ui/stores/ports/review-repository.ts`, `src/adapters/storage/{plugin-data-review-repository,plugin-data-shape,plugin-data-binding-store,plugin-data-profile-store}.ts`, `src/application/analysis/analyzer-record.ts`, `src/ui/read-models/{review-record-codec,findings,evidence-index,severity}.ts`, `src/ui/audit-copy/quality.ts`, `src/ui/stores/review-store.ts`, the ten review-writing screens, `QualityScreen.vue`, `FileDetailScreen.vue`, `LensHeading.vue`, `FallowCardDetails.vue`, `FindingReviewDialog.vue` | modify | 5b | E1, E5–E9, E14 |
| `tests/unit/review-failure.test.ts`, `tests/unit/review-repository-writes.test.ts` | create | 5b | E1; E6, E7 |
| `tests/contracts/review-repository.contract.ts` (import line only), `tests/unit/review-repository-registry.test.ts` (import line only), `tests/unit/review-replace-all.test.ts`, `tests/component/tests-screen.test.ts`, `tests/unit/evidence-index.test.ts` | modify | 5b | E1 imports; E14; E1 screen pin; E9 |
| `src/ui/screens/architecture/BoundaryRuleTable.vue`, `src/ui/screens/test-confidence/CoverageGapsTable.vue`, `src/ui/styles/{screens-explore,screens-audit,screens-configure}.css`, `src/host/city-scan-controller.ts`, `src/ui/kit/Dialog.vue`, `src/ui/audit-copy/{shared,fallow,quality,settings,tests,workbench}.ts`, `src/ui/inspector-copy.ts`, `src/ui/screens/sources/{ConnectFallowDialog,FallowRemoveDialog}.vue`, `src/ui/screens/SourcesScreen.vue` | modify / create | 6 | F1–F5 |
| `tests/component/dialog-trap.test.ts` | create | 6 | F5 trap |
| `tests/component/{architecture-rules,tests-screen,status-surfaces,connect-fallow}.test.ts`, `tests/unit/css-class-scope.test.ts` | modify | 6 | F1, F2, F4, F5 |
| `tests/fixtures/city-view-doubles.ts`, `tests/unit/review-repository-roundtrip.test.ts`, `tests/host/city-scan-controller.test.ts`, `tests/component/use-city-floor.test.ts` | create | 7 | G1, G4, G6 |
| `tests/host/*.test.ts` (the ten `makePluginDouble` copies), `tests/component/{ownership-screen,quality-screen,kit-evidence,toolbar-scan}.test.ts`, the G4 and G7 files | modify | 7 | G1, G3, G4, G5, G7 |
| the flagged `src` modules (export keywords only), `src/ui/read-models/fallow-run.ts`, `src/application/ports/analyzer-binding-store.ts` | modify | 8 | X1 |
| `tests/harness/{seed,mount}.ts`, `tests/harness/harness-evidence.test.ts` | modify | 8 | H5 |
| `docs/superpowers/notes/2026-09-17-wp01-{gate-evidence,limitations,implementation-report}.md`, `docs/superpowers/notes/2026-09-20-wp01b-acceptance-spine.md`, `docs/superpowers/specs/2026-09-23-inspector-ui-part7-design.md` | modify | 8 | H1–H4, H6, D6 |
| `docs/superpowers/notes/2026-09-17-wp01-{gate-evidence,implementation-report}.md` | modify | 9 | counts, the living-suite line, the G8 table |

## Task outline and interface contracts

The names and signatures below are binding across tasks.

- **Task 1** produces: `ReadableLike.on(event: 'error', listener: (error: Error) => void): unknown`; the runner's `StopReason` gains `'output-incomplete'`; `FakeStream.emitError(code?: string): void`; `killTree(pid: number, platform?: string, kill?: (pid: number, signal: string) => void): void` (`tests/fixtures/real-spawn.ts`); `spawnCallCount(source: string): number` and the hazard label `'unscannable'` (`tests/fixtures/process-guard.ts`); `listFiles(dir: string, accept: (name: string) => boolean): string[]` (`tests/fixtures/source-files.ts`).
- **Task 2** produces: `RunPlan.onProbePassed: (version: string) => Promise<'continue' | 'version-changed' | 'changed-since-review' | 'store-unsupported'>`; `isCancellable(state): state is Extract<AnalysisRunState, { status: 'probing' | 'running' }>`; `FALLOW_RUN_ERROR_CODES` as `readonly [...] as const` and `FallowRunErrorCode = (typeof FALLOW_RUN_ERROR_CODES)[number]`; `mayPublishAnalysis` (renamed from `mayPublish` in `analysis-state.ts`); `createServiceWorld(store?: AnalyzerBindingStore)`, `SNAPSHOT`, `ROOT`, `EXE`, `subjectOf`, `trusted`, `reviewed` (`tests/fixtures/fallow-service-world.ts`).
- **Task 3a** produces: `FallowAnalysisService.executableName: 'fallow.exe' | 'fallow'` (read-only, L2); `useAnalysisStore().readFailed: boolean` and `.executableName: 'fallow.exe' | 'fallow' | null`; `refreshBinding` no longer returned by the store (C13); `FALLOW_EXE_READ_FAILED`; `ConnectFallowDialog` emits `busy: [busy: boolean]`; `FakeFallowAnalysis.executableName`.
- **Task 3b** produces: `failureBanner(text: string): FallowRunBanner` (`read-models/fallow-run.ts`); `FALLOW_RUN_CANCELLING_HINT`; the `alert` slot of `FallowInstalledRoute.vue`; `FALLOW_ROW_COLLECTED` moved to `audit-copy/fallow-run.ts`.
- **Task 4** produces: the settings tab's eighth constructor parameter `evidence: Pick<EvidenceRepository, 'remove'>` (L22); `SETTINGS_FALLOW_STORE_FAILED: Readonly<Record<AnalyzerStoreErrorCode, string>>`.
- **Task 5a** produces: `src/ui/read-models/severity.ts` with `HIGH_SEVERITIES: readonly string[]` and `isHighSeverity(severity: string | null): boolean`; `openHighFindingsValue(model: QualityModel): MetricValue` (`findings.ts`); `buildOverviewModel`'s fifth parameter becomes `quality: QualityModel`; `reloadIfBound` exported from `review-buckets.ts`; `LENS_LIST_TEXT(count: number | null): string` (`audit-copy/fallow.ts`).
- **Task 5b** produces: `ReviewStoreError`, `ReviewStoreErrorCode` in `src/ui/stores/ports/review-repository.ts` (L3); `reviewFailureText(e: unknown, fallback: string): string`; `isPlainObject`, `asUnknownArray` in `src/domain/plain-data.ts`; `FindingSeverity`, `FINDING_SEVERITIES` in `severity.ts`; `evidenceBadgeFor(index: EvidenceIndex): EvidenceBadgeProps | null` (`evidence-index.ts`); `useImportReport(): () => void`; the adapter's `write(change, options: { bounded: boolean; whole?: boolean })`.
- **Task 6** produces: `RULE_SHOW`, `RULE_SHOW_LABEL(id)`, `TESTS_OPEN`, `TESTS_OPEN_LABEL(name)`, `CANCEL`, `FALLOW_REVIEW_UNVERIFIED`, `FallowRemoveDialog.vue` (emits `close`, `confirm`).
- **Task 7** produces: `makePluginDouble()` (`tests/fixtures/city-view-doubles.ts`).
- **Task 8** produces: `openFailureLog(root: ParentNode): void` (`tests/harness/seed.ts`); the re-baselined analyze figures.
- **Task 9** produces: the evidence counts and a green `npm run verify`.

---

### Task 1: The fallow runner, its adapters and the process guard (A1–A10, G2)

Model tier: **most capable** (process safety; the guard is acceptance evidence).

**Files:**
- Modify: `src/adapters/fallow/fallow-runner.ts` (177): `defaultSpawn` (lines 42–45), `signal` (99–106), `StopReason` (31), `stoppedOutcome` (109–114), the listeners (147–154)
- Modify: `src/adapters/fallow/node-process-access.ts` (51): `ReadableLike` (9–12)
- Modify: `src/adapters/fallow/process-output.ts` (105): `createStderrTail` (60–83)
- Modify: `src/adapters/fallow/executable-inspector.ts` (119): lines 44–54, 82, 110
- Modify: `scripts/assert-bundle.mjs` (90): after line 66
- Modify: `tests/fixtures/process-guard.ts` (182): header (12–33), `HAZARD_ORDER`/`ProcessHazard` (38–39), `Found` (48), `visitCall` (93–107), `processHazardsTs` (122–139), `processHazardsVue` (159–166), a new export at the end
- Create: `tests/fixtures/source-files.ts` (~15)
- Modify: `tests/fixtures/fake-child-process.ts` (75): `FakeStream` (5–23)
- Modify: `tests/fixtures/real-spawn.ts` (14): append `killTree`
- Modify: `tests/unit/fallow-runner.test.ts` (215 → ~290), `tests/unit/process-output.test.ts` (87 → ~102), `tests/unit/executable-inspector.test.ts` (117 → ~150), `tests/unit/assert-bundle.test.ts` (71 → ~78), `tests/unit/no-process-execution.test.ts` (174 → ~190), `tests/unit/node-access-boundary.test.ts` (153 → ~143), `tests/unit/fallow-argv-policy.test.ts` (68 → ~62), `tests/integration/fallow-analysis.test.ts` (287), `tests/fallow-real/fallow-real.test.ts` (154)

**Interfaces:**
- Consumes: `createFallowRunner(deps)`, `FallowRunnerDeps`, `ChildProcessLike`, `SpawnLike` (Part 7 Task 7); `createExecutableInspector(deps)`; `processHazards`, `injectStatement`, `injectSpawnCall`; `createCancellationToken` (`tests/fixtures/cancellation-token.ts`); `fakeSpawn`; `realKill`, `realSpawn`; `makeTempTree`.
- Produces: see the outline (Task 1).

**A1 — the group kill swallows every error.** In `signal`, replace the `try { killProcess(-pid, name); } catch { … }` line with:

```ts
          try {
            killProcess(-pid, name);
          } catch (e) {
            // Polish A1: ESRCH is "the group is already gone". Anything else (EPERM, EINVAL)
            // means the group was NOT signalled, so the direct child is signalled instead.
            if (errorCodeOf(e) !== 'ESRCH') running.kill(name);
          }
```

Pin (`tests/unit/fallow-runner.test.ts`; `throwDenied` at module scope beside `throwGone`: `function throwDenied(): never { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); }`):

```ts
  it('Polish A1: a group kill refused with EPERM signals the child itself, SIGTERM then SIGKILL', async () => {
    const spawned = fakeSpawn();
    const runner = createFallowRunner({ spawn: spawned.spawn, env: {}, platform: 'linux', killProcess: throwDenied });
    const { token, cancel } = createCancellationToken();
    const done = runner.run(REQUEST, token);
    cancel();
    expect(spawned.children[0]!.kills).toEqual(['SIGTERM']);
    vi.advanceTimersByTime(2_000);
    expect(spawned.children[0]!.kills).toEqual(['SIGTERM', 'SIGKILL']);
    spawned.children[0]!.exit(null, 'SIGKILL');
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
  });
```

And in the existing "a process group that is already gone does not throw" case, add after `cancel()`: `expect(spawned.children[0]!.kills).toEqual([]);` (ESRCH signals nothing else). RED: `kills` is `[]` for EPERM.

**A2 — no `on('error')` on the pipes.** In `node-process-access.ts`:

```ts
export interface ReadableLike {
  on(event: 'data', listener: (chunk: Uint8Array) => void): unknown;
  /** Polish A2: a pipe error; without a listener Node throws it as an uncaught exception. */
  on(event: 'error', listener: (error: Error) => void): unknown;
  destroy(): unknown;
}
```

In `fallow-runner.ts`: `type StopReason = 'cancelled' | 'timed-out' | 'stdout-too-large' | 'output-incomplete';`; in `stoppedOutcome`, before the final `return`, add `if (stopReason === 'output-incomplete') return { kind: 'output-incomplete', stderrTail };`; after the two `'data'` listeners add:

```ts
      // Polish A2: a broken pipe on either stream means the output cannot be trusted. The run
      // stops the way a cancel does (the child is signalled unless it already exited) and ends
      // output-incomplete; the listener also keeps the error off Obsidian's uncaught path.
      const pipeFailed = (): void => { handle.stop('output-incomplete'); };
      running.stdout?.on('error', pipeFailed);
      running.stderr?.on('error', pipeFailed);
```

In `tests/fixtures/fake-child-process.ts`, `FakeStream` models Node's rule:

```ts
export class FakeStream implements ReadableLike {
  destroyed = false;
  private readonly listeners: ((chunk: Uint8Array) => void)[] = [];
  private readonly errorListeners: ((error: Error) => void)[] = [];

  on(event: 'data', listener: (chunk: Uint8Array) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'data' | 'error', listener: ((chunk: Uint8Array) => void) | ((error: Error) => void)): this {
    if (event === 'data') this.listeners.push(listener as (chunk: Uint8Array) => void);
    else this.errorListeners.push(listener as (error: Error) => void);
    return this;
  }

  destroy(): this {
    this.destroyed = true;
    return this;
  }

  emit(chunk: Uint8Array | string): void {
    const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
    for (const listener of this.listeners) listener(bytes);
  }

  /** Polish A2: as a Node stream does, an 'error' nobody listens to is thrown. */
  emitError(code = 'EPIPE'): void {
    const error = Object.assign(new Error(code), { code });
    if (this.errorListeners.length === 0) throw error;
    for (const listener of this.errorListeners) listener(error);
  }
}
```

Pins:

```ts
  it('Polish A2: a stdout pipe error stops the child and ends output-incomplete, leaving no timer', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.child().stdout.emitError('EPIPE');
    expect(s.kills).toEqual([[-4242, 'SIGTERM']]);
    s.child().exit(null, 'SIGTERM');
    await expect(done).resolves.toEqual({ kind: 'output-incomplete', stderrTail: '' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Polish A2: a stderr pipe error after exit ends output-incomplete at once and destroys both pipes', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.child().exit(0);
    s.child().stderr.emitError('ECONNRESET');
    await expect(done).resolves.toEqual({ kind: 'output-incomplete', stderrTail: '' });
    expect([s.child().stdout.destroyed, s.child().stderr.destroyed]).toEqual([true, true]);
    expect(vi.getTimerCount()).toBe(0);
  });
```

RED: `emitError` throws (no listener).

**A3 — O(n²) stderr tail.** Replace `createStderrTail` with:

```ts
export function createStderrTail(maxBytes: number): StderrTail {
  const chunks: Uint8Array[] = [];
  /** Polish A3: the first kept chunk. Dropping a chunk moves this index; it never copies the array. */
  let head = 0;
  let bytes = 0;
  return {
    push(chunk) {
      chunks.push(chunk);
      bytes += chunk.length;
      while (bytes > maxBytes && head < chunks.length) {
        const first = chunks[head]!;
        const excess = bytes - maxBytes;
        if (first.length <= excess) {
          head += 1;
          bytes -= first.length;
        } else {
          chunks[head] = first.subarray(excess);
          bytes -= excess;
        }
      }
      // Compacted only once the dropped prefix is at least half the array: amortised O(1) per chunk.
      if (head > 0 && head * 2 >= chunks.length) { chunks.splice(0, head); head = 0; }
    },
    excerpt() {
      return cleanLog(new TextDecoder('utf-8').decode(concat(chunks.slice(head), bytes)));
    },
  };
}
```

Pin (`tests/unit/process-output.test.ts`):

```ts
  it('Polish A3: keeps the last 64 KB of a flood of one-byte chunks, in linear time', () => {
    const tail = createStderrTail(65_536);
    const one = Uint8Array.from([0x61]);
    const started = performance.now();
    for (let i = 0; i < 200_000; i += 1) tail.push(one);
    tail.push(new TextEncoder().encode('END'));
    const elapsed = performance.now() - started;
    const text = tail.excerpt();
    expect(text).toHaveLength(65_536);
    expect(text.endsWith('aEND')).toBe(true);
    expect(elapsed, `200,000 pushes took ${Math.round(elapsed)} ms`).toBeLessThan(2_000);
  }, 60_000);
```

RED: the old `slice(1)` loop copies ~65,536 entries per push for 134,464 pushes (well over 2 s). The existing tail cases stay green.

**A4 — the name ternary three times.** Add, above `nameRefusal`:

```ts
/** Polish A4 (Z4): the one accepted base name per platform. Module-private. */
function expectedName(platform: string): 'fallow.exe' | 'fallow' {
  return platform === 'win32' ? 'fallow.exe' : 'fallow';
}
```

Use it in `nameRefusal` (`const expected = expectedName(platform);`), in `executableName: expectedName(platform),` and in `if (format === 'script') return refuse('launcher', expectedName(platform));`. Pure refactor: the existing inspector tests stay green, and `grep -c "'fallow.exe' : 'fallow'" src/adapters/fallow/executable-inspector.ts` prints **1**.

**A5 — a bare `child_process` passes the bundle guard.** A bare `require("child_process")` is already refused by the built-ins check; `window.require('child_process')` is not. After the `node:child_process` block in `scripts/assert-bundle.mjs`, add:

```js
// Polish A5: the check above counts only the `node:` name. A bare 'child_process' specifier —
// window.require('child_process'), or a string handed to one — is a second route to the same
// module, so any mention of it is refused.
const bareChildProcess = [...main.matchAll(/(["'`])child_process\1/g)].length;
if (bareChildProcess > 0) {
  fail(`dist/main.js names the bare 'child_process' module ${bareChildProcess} time(s). `
    + 'Only src/adapters/fallow/node-process-access.ts may reach it, and only as node:child_process.');
}
```

Pin (`tests/unit/assert-bundle.test.ts`):

```ts
  it('Polish A5: refuses a bare child_process specifier, even through window.require', () => {
    const viaWindow = runAgainst(`${CLEAN_MAIN}window.require('child_process');\n`);
    expect(viaWindow.stderr).toContain("names the bare 'child_process' module 1 time(s)");
    expect(viaWindow.status).toBe(1);
    expect(runAgainst(CLEAN_MAIN).status).toBe(0);
  });
```

RED: status 0. The real bundle must still pass: the gate runs `npm run build`.

**A6 — a second `spawn(` passes all three guards.** Make `defaultSpawn` a property read (L12):

```ts
/** Polish A6 (L12): the module's own spawn, read, never wrapped in a second call: the
 *  runner's `spawn(…)` in `run` is this file's only spawn call (the guard counts them). */
function defaultSpawn(): SpawnLike | null {
  return childProcess?.spawn ?? null;
}
```

In `tests/fixtures/process-guard.ts`, export:

```ts
/** Polish A6 (Z37): how many calls to the async `spawn` `source` makes, by the same callee
 *  rules as the hazard walk. tests/unit/no-process-execution.test.ts requires exactly one in
 *  fallow-runner.ts. */
export function spawnCallCount(source: string): number {
  const sourceFile = ts.createSourceFile('probe.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && callHazard(calleeShape(node.expression)) === 'spawn') count += 1;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return count;
}
```

Pin (`tests/unit/no-process-execution.test.ts`, inside the first `describe`):

```ts
  it('Polish A6: fallow-runner.ts makes exactly one spawn call, and a second one is counted', () => {
    const runner = readFileSync(join(SRC_ROOT, 'adapters/fallow/fallow-runner.ts'), 'utf8');
    expect(spawnCallCount(runner)).toBe(1);
    expect(spawnCallCount(injectSpawnCall(runner, 'ts'))).toBe(2);
  });
```

RED: `2` (the old `cp.spawn(…)` wrapper plus `spawn(…)` in `run`).

**A7 — the shell option set after the literal.** In `process-guard.ts`, add a module-level helper and one branch to the `processHazardsTs` chain, placed before the `isPropertyAssignment` branch:

```ts
/** Polish A7: `o.shell = x` or `o['shell'] = x`, where x is not the literal `false`. */
function isShellAssignment(node: ts.Node): boolean {
  if (!ts.isBinaryExpression(node) || node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) return false;
  const target = unwrap(node.left);
  const name = ts.isPropertyAccessExpression(target) ? target.name.text
    : ts.isElementAccessExpression(target) ? literalText(target.argumentExpression) : undefined;
  return name === 'shell' && unwrap(node.right).kind !== ts.SyntaxKind.FalseKeyword;
}
```

```ts
    else if (isShellAssignment(node)) found.shell = true;
```

and in `visitCall` (a call never reaches the chain's later branches), right after its existing `const callee = calleeShape(node.expression);` line:

```ts
  // Polish A7: Object.defineProperty(o, 'shell', …) sets the option too.
  if (callee.shape === 'member' && callee.name === 'defineProperty' && literalText(node.arguments[1]) === 'shell') found.shell = true;
``` Pins: in the "flags" table add

```ts
    // Polish A7: the shell option set after the object literal.
    ['o.shell = true;', 'ts', 'shell option'],
    ["o['shell'] = 'cmd.exe';", 'ts', 'shell option'],
    ["Object.defineProperty(o, 'shell', { value: true });", 'ts', 'shell option'],
```

in the "does not flag" table add `['o.shell = false;', 'ts'],`, and in `STILL_BANNED` add `['o.shell = true;', 'shell option'],`. RED: the three are not flagged.

**A8 — runner edges untested.** Add to `tests/unit/fallow-runner.test.ts`:

```ts
describe('Polish A8: the runner\'s remaining edges (Z38)', () => {
  it('a stop after exit but before close settles at once, signals nothing and leaves no timer', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.child().exit(0);
    s.cancel();
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
    expect(s.kills).toEqual([]);
    expect([s.child().stdout.destroyed, s.child().stderr.destroyed]).toEqual([true, true]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a normal close clears the time limit and the close grace', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    expect(vi.getTimerCount()).toBe(1);
    s.child().exit(0);
    expect(vi.getTimerCount()).toBe(2);
    s.child().close(0);
    await expect(done).resolves.toMatchObject({ kind: 'exited', exitCode: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('EACCES and ENOENT before the start are both spawn-failed, each with its own code', async () => {
    for (const code of ['EACCES', 'ENOENT']) {
      const spawned = fakeSpawn(null);
      const runner = createFallowRunner({ spawn: spawned.spawn, env: {}, platform: 'linux' });
      const done = runner.run(REQUEST, createCancellationToken().token);
      spawned.children[0]!.emitError(code);
      await expect(done, code).resolves.toEqual({ kind: 'spawn-failed', errorCode: code });
    }
  });
});
```

Pins on behaviour that already holds; mutations: (1) delete the `if (exited) { … }` line of `stop` → `kills` is not empty; (2) delete the `for (const timer …) clearTimer(timer);` line of `finish` → the timer count is not 0; (3) hard-code `errorCode: 'ENOENT'` in the `'error'` listener → the EACCES case fails.

**A9 — the afterEach fallback is not a group kill.** Append to `tests/fixtures/real-spawn.ts`:

```ts
/** Polish A9: the real-process tests' cleanup. On POSIX the child leads its own process group
 *  (spawned detached), so the group is killed — which reaches any grandchild, even after the
 *  child itself exited — and then the child. Every error means "already gone". */
export function killTree(pid: number, platform: string = process.platform, kill: (pid: number, signal: string) => void = realKill): void {
  if (platform !== 'win32') {
    try { kill(-pid, 'SIGKILL'); } catch { /* the group is already gone */ }
  }
  try { kill(pid, 'SIGKILL'); } catch { /* the child is already gone */ }
}
```

In both `afterEach` blocks (`tests/integration/fallow-analysis.test.ts:50`, `tests/fallow-real/fallow-real.test.ts:58`) replace the `for … if (alive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch { … } }` line with `for (const pid of pids.splice(0)) killTree(pid);` (no `alive` gate: the group can outlive its leader). Pin (`tests/unit/fallow-runner.test.ts`):

```ts
describe('Polish A9: the real-process tests\' cleanup kill', () => {
  it('kills the POSIX group, then the child; on Windows the child only; a gone process is not an error', () => {
    const calls: [number, string][] = [];
    const record = (pid: number, signal: string): void => { calls.push([pid, signal]); };
    killTree(4242, 'linux', record);
    killTree(4242, 'win32', record);
    expect(calls).toEqual([[-4242, 'SIGKILL'], [4242, 'SIGKILL'], [4242, 'SIGKILL']]);
    expect(() => { killTree(4242, 'linux', throwGone); }).not.toThrow();
  });
});
```

RED: `killTree` does not exist.

**A10 — two inspector paths untested.** Add to `tests/unit/executable-inspector.test.ts` (`import { Platform } from 'obsidian';` — the vitest alias resolves it to `tests/mocks/obsidian.ts`):

```ts
describe('Polish A10: short files and the host platform', () => {
  it('an empty file, or a 3-byte ELF or Mach-O prefix, behind the right name is not native', async () => {
    const t = await tree({
      'w/fallow.exe': { binary: new Uint8Array(0) },
      'l/fallow': { binary: Uint8Array.from([0x7f, 0x45, 0x4c]) },
      'm/fallow': { binary: Uint8Array.from([0xcf, 0xfa, 0xed]) },
    });
    const notNative = { ok: false, refusal: 'not-native', detail: '' };
    expect(await windows.inspect(join(t.root, 'w', 'fallow.exe'), t.root)).toEqual(notNative);
    expect(await linux.inspect(join(t.root, 'l', 'fallow'), t.root)).toEqual(notNative);
    expect(await mac.inspect(join(t.root, 'm', 'fallow'), t.root)).toEqual(notNative);
  });

  it('without a platform it reads Obsidian\'s Platform flags', async () => {
    const saved = { isWin: Platform.isWin, isMacOS: Platform.isMacOS };
    try {
      const t = await tree({ 'mac/fallow': MACH_O });
      const exe = join(t.root, 'mac', 'fallow');
      Platform.isWin = true;
      expect(createExecutableInspector({ fsPromises: fs }).executableName).toBe('fallow.exe');
      Platform.isWin = false;
      Platform.isMacOS = true;
      expect(await createExecutableInspector({ fsPromises: fs }).inspect(exe, t.root)).toMatchObject({ ok: true, facts: { format: 'mach-o' } });
      Platform.isMacOS = false;
      expect(await createExecutableInspector({ fsPromises: fs }).inspect(exe, t.root)).toEqual({ ok: false, refusal: 'not-native', detail: '' });
    } finally {
      Object.assign(Platform, saved);
    }
  });
});
```

(Z4's PE rule reads only `MZ`, so a 2-byte `MZ` file is PE by design; this pass does not change that.) Mutation: make `hostPlatform()` return `'linux'` always → the Windows and macOS assertions fail.

**G2 — the guard skips what it cannot parse.** In `process-guard.ts`:
- `ProcessHazard` gains `'unscannable'`, last in `HAZARD_ORDER`; `Found` gains `unscannable: boolean` (`false` in `processHazardsTs` and in `scanTemplateText`), and `toList`'s record maps `'unscannable': found.unscannable`.
- `processHazardsVue` fails closed:

```ts
function processHazardsVue(source: string): ProcessHazard[] {
  const { descriptor, errors } = parseSfc(source, { filename: 'probe.vue' });
  const parts = new Set<ProcessHazard>();
  // Polish G2: fail closed. A parse error (an unclosed tag, a second <script setup>) or a block
  // this detector does not read (<docs>, an upper-case <SCRIPT>, any custom block) could hide a
  // call, so the file is reported instead of passing silently.
  if (errors.length > 0 || descriptor.customBlocks.length > 0) parts.add('unscannable');
  if (descriptor.template?.content) scanTemplateText(descriptor.template.content).forEach((h) => parts.add(h));
  if (descriptor.script?.content) processHazardsTs(descriptor.script.content).forEach((h) => parts.add(h));
  if (descriptor.scriptSetup?.content) processHazardsTs(descriptor.scriptSetup.content).forEach((h) => parts.add(h));
  return HAZARD_ORDER.filter((h) => parts.has(h));
}
```

- The header gains, in its label list, "- 'unscannable' (polish G2) is a `.vue` file the SFC parser reported an error for, or one with a custom block: it fails the scan rather than passing unread;" and in the "Known, accepted gaps" sentence: the aliases, `bind` and `Reflect.apply` gaps apply to **every** process API name, not only `spawn`; an opener is flagged by its name wherever it appears (so `.call`/`.apply`/`.bind` on an opener is flagged); a `shell` option reached only through a computed name built at run time is not.
- Create `tests/fixtures/source-files.ts`:

```ts
// Polish G2: the one recursive file walker the whole-src guards share. It was written three
// times (no-process-execution, node-access-boundary, fallow-argv-policy).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every file under `dir` whose base name `accept` keeps, depth first, in readdir order. */
export function listFiles(dir: string, accept: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) return listFiles(abs, accept);
    return accept(name) ? [abs] : [];
  });
}
```

  Replace the three walkers with it, each predicate hoisted to module scope (PF2): `no-process-execution.test.ts` `const isScanned = (name: string): boolean => /\.(ts|vue|js|mjs|cjs)$/.test(name);`; `node-access-boundary.test.ts` `const isSource = (name: string): boolean => /\.(ts|vue)$/.test(name) && !name.endsWith('.d.ts');`; `fallow-argv-policy.test.ts` `const isTs = (name: string): boolean => name.endsWith('.ts');`. Each drops its own `readdirSync`/`statSync` import if now unused.

Pins (the "flags" table):

```ts
    // Polish G2: fail closed on what the SFC parser could not read or this detector does not scan.
    ["<template><p>x</p></template><SCRIPT>spawn('x')</SCRIPT>", 'vue', 'unscannable'],
    ["<docs>spawn('x')</docs><template><p/></template>", 'vue', 'unscannable'],
    ["<template><p/></template><script setup>\nconst a = 1;\n</script><script setup>\nspawn('x');\n</script>", 'vue', 'unscannable'],
    ['<template><div></template><script setup>\nconst x = 1;\n</script>', 'vue', 'unscannable'],
    ['shell.openPath.call(shell, p);', 'ts', 'shell.openPath'],
```

RED: the four `unscannable` rows (the last row already passes: it pins the header's opener claim). The real-file scan must stay green: `grep -rlE "<docs|<SCRIPT|<i18n" src --include=*.vue` prints nothing today; if any real `.vue` file reports `unscannable`, stop and report it.

- [ ] **Step 1: Write the failing tests.** Add every pin above (A1, A2, A3, A5, A6, A7, A8, A9, A10, G2) and the `FakeStream`, `killTree`, `spawnCallCount` and `listFiles` fixture changes they need, but none of the `src/` or `scripts/` changes and not yet the two `afterEach` switches.

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/unit/fallow-runner.test.ts tests/unit/process-output.test.ts tests/unit/executable-inspector.test.ts tests/unit/assert-bundle.test.ts tests/unit/no-process-execution.test.ts`
Expected: FAIL — A1 (`kills` `[]`), A2 (the fake throws), A3 (over 2 s), A5 (status 0), A6 (`2`), A7 (not flagged), G2 (not `unscannable`). A8, A9 (its fixture lands in this step) and A10 pass: run their mutations now — for A9, make `killTree` skip the group kill — and paste both runs.

- [ ] **Step 3: Implement** A1, A2, A3, A4, A5, A6, A7 and G2 as above, and switch the two `afterEach` blocks to `killTree` (A9).

- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/unit/fallow-runner.test.ts tests/unit/process-output.test.ts tests/unit/executable-inspector.test.ts tests/unit/assert-bundle.test.ts tests/unit/no-process-execution.test.ts tests/unit/node-access-boundary.test.ts tests/unit/fallow-argv-policy.test.ts tests/contracts/fallow-runner.test.ts tests/integration/fallow-analysis.test.ts`
Expected: PASS. `grep -c "'fallow.exe' : 'fallow'" src/adapters/fallow/executable-inspector.ts` prints `1`.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/adapters/fallow scripts/assert-bundle.mjs tests/fixtures/process-guard.ts tests/fixtures/source-files.ts tests/fixtures/fake-child-process.ts tests/fixtures/real-spawn.ts tests/unit/fallow-runner.test.ts tests/unit/process-output.test.ts tests/unit/executable-inspector.test.ts tests/unit/assert-bundle.test.ts tests/unit/no-process-execution.test.ts tests/unit/node-access-boundary.test.ts tests/unit/fallow-argv-policy.test.ts tests/integration/fallow-analysis.test.ts tests/fallow-real/fallow-real.test.ts --max-warnings 0 && npm run build`
Expected: exit 0; the build ends with `assert-bundle: OK`.

- [ ] **Step 6: Commit.**

```
git add src/adapters/fallow scripts/assert-bundle.mjs tests/fixtures/process-guard.ts tests/fixtures/source-files.ts tests/fixtures/fake-child-process.ts tests/fixtures/real-spawn.ts tests/unit/fallow-runner.test.ts tests/unit/process-output.test.ts tests/unit/executable-inspector.test.ts tests/unit/assert-bundle.test.ts tests/unit/no-process-execution.test.ts tests/unit/node-access-boundary.test.ts tests/unit/fallow-argv-policy.test.ts tests/integration/fallow-analysis.test.ts tests/fallow-real/fallow-real.test.ts
git commit -m "fix(fallow): runner kill fallback and pipe errors, linear stderr tail, one spawn call, and a guard that fails closed (polish A1-A10, G2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The analysis application layer (B1–B10)

Model tier: **most capable** (the consent gate and the coordinator's cancel races).

**Files:**
- Modify: `src/application/analysis/fallow-analysis-service.ts` (278): `startPlan` (172–191), `trustAndRun` (227–247), a module helper after `normalisedPath` (96–102)
- Modify: `src/application/analysis/analysis-coordinator.ts` (216): `RunPlan` (27–33), `cancel` (83–88), `shutdown` (94–102), `execute` (110–131, 158–161), a new private helper
- Modify: `src/application/analysis/analysis-state.ts` (100): `isCancellable` (44–47), the reducer (60–62, 72–73), `mayPublish` (85–100)
- Modify: `src/application/analysis/fallow-run-errors.ts` (43): lines 6–17
- Modify: `src/application/ports/evidence-repository.ts` (18): `put`'s comment (9–10)
- Modify: `tests/fixtures/fake-process-port.ts` (60): `run` (33–43)
- Create: `tests/fixtures/fallow-service-world.ts` (~50)
- Create: `tests/unit/fallow-analysis-service-consent.test.ts` (~200)
- Modify: `tests/unit/fallow-analysis-service.test.ts` (272 → ~235), `tests/unit/analysis-coordinator.test.ts` (339 → ~395), `tests/unit/analysis-state.test.ts` (96)

**Interfaces:**
- Consumes: `AnalyzerStoreError` (`analyzer-record.ts`), `createInMemoryAnalyzerStore(machineId, initial?)`, `createFakeExecutableInspector`, `factsFor`, `createFakeProcessPort`, `exitedWith`, `emptyEvidenceReport`, `snapshotWithPaths`, `FIXTURE_PROJECT_FILES`.
- Produces: see the outline (Task 2).

**B1 — busy checked only on entry.** In `trustAndRun`, between the `changed-since-review` line and the `try { await store.bind(…) }`:

```ts
      // Polish B1: a run may have started during the awaits above (another leaf, the command).
      // Its binding is never replaced under it.
      if (isActive(coordinator.stateOf(profileId))) return { kind: 'busy' };
```

**B2 — a trust-write refusal ends as an internal failure.** Add after `normalisedPath`:

```ts
/** Polish B2 (L13): a trust write the store refused is never an operational failure, so good
 *  evidence is not marked stale. Only the store's own refusal is mapped; anything else is a
 *  real error and still ends the run as the internal failure. */
function refusedTrustWrite(e: unknown): 'store-unsupported' | 'changed-since-review' | null {
  if (!(e instanceof AnalyzerStoreError)) return null;
  return e.code === 'unsupported' ? 'store-unsupported' : 'changed-since-review';
}
```

and replace `onProbePassed` in `startPlan` with:

```ts
      onProbePassed: async (version) => {
        try {
          if (trustedVersion === null) {
            await store.grantTrust(profileId, { fingerprint: fingerprintTrust(subject, version), version, grantedAt: clock.nowIso() }, subject.facts.executablePath);
            return 'continue';
          }
          if (version === trustedVersion) return 'continue';
          await store.revokeTrust(profileId);
          return 'version-changed';
        } catch (e) {
          const verdict = refusedTrustWrite(e);
          if (verdict === null) throw e;
          return verdict;
        }
      },
```

`RunPlan.onProbePassed` becomes `(version: string) => Promise<'continue' | 'version-changed' | 'changed-since-review' | 'store-unsupported'>`; the coordinator's `if (verdict !== 'continue') { this.fail(…, verdict, …) }` is unchanged (all three are `FallowRunErrorCode`s, none operational).

**B3 — `isCancellable` is not a type guard.**

```ts
/** M36's rule for the cancel command: only a probing or running analysis can be cancelled.
 *  Polish B3: a type guard, used by the coordinator and the reducer alike. */
export function isCancellable(state: AnalysisRunState): state is Extract<AnalysisRunState, { status: 'probing' | 'running' }> {
  return state.status === 'probing' || state.status === 'running';
}
```

Use it for `CANCEL_REQUESTED` and `RUN_FAILED` in the reducer (`if (!isCancellable(state) || state.identity.runId !== action.runId) return state;`), in `AnalysisCoordinator.cancel` (`if (!isCancellable(state)) return;`) and in `shutdown` (`if (isCancellable(state)) this.dispatch(…)`). Pure refactor: the existing tests stay green; `grep -c "status !== 'probing' && state.status !== 'running'" src/application/analysis/*.ts` and `grep -c "status === 'probing' || state.status === 'running'" src/application/analysis/analysis-coordinator.ts` both print `0`; the coordinator's `state.identity.runId` after the guard compiles only because it is one.

**B4 — the codes listed twice.**

```ts
/** Polish B4: the one list; the type is derived from it, so a code cannot be added to only one. */
export const FALLOW_RUN_ERROR_CODES = [
  'root-unavailable', 'executable-missing', 'executable-refused', 'changed-since-review', 'store-unsupported',
  'version-probe-failed', 'version-unsupported', 'version-changed', 'spawn-failed', 'timed-out',
  'output-too-large', 'output-incomplete', 'output-not-json', 'output-unsupported', 'output-invalid',
  'analyzer-error', 'exit-code', 'source-mismatch', 'snapshot-changed', 'superseded',
] as const;

export type FallowRunErrorCode = (typeof FALLOW_RUN_ERROR_CODES)[number];
```

Pure refactor: `tests/unit/fallow-invocation.test.ts` and `tests/unit/fallow-run-copy.test.ts` ("has a message for every run error code") stay green; `grep -c "'superseded'" src/application/analysis/fallow-run-errors.ts` prints `2` (the list and `NOT_OPERATIONAL`), not 3.

**B5 — an unasked probe `cancelled` is operational.** In `AnalysisCoordinator`, add:

```ts
  /** Polish B5 (L14): the port ended the process as cancelled although nobody asked (its own
   *  killAll): confirmed as a cancel, on the probe and the run path alike. */
  private stopUnasked(profileId: string, runId: string): void {
    this.dispatch(profileId, { type: 'CANCEL_REQUESTED', runId });
    this.dispatch(profileId, { type: 'PROCESS_STOPPED', runId });
  }
```

In `execute`, after the probe's `stopIfCancelled` line: `if (probe.kind === 'cancelled') { this.stopUnasked(profileId, runId); return; }`; and replace the run path's two dispatches (`if (result.kind === 'cancelled') { … }`) with `if (result.kind === 'cancelled') { this.stopUnasked(profileId, runId); return; }`.

**B6 — write-before-notify is only documented in a comment.** `EvidenceRepository.put`'s comment becomes:

```ts
  /** Attaches the codebase's report, replacing any earlier one, THEN notifies every subscriber,
   *  synchronously: a subscriber already reads the new report. The analysis coordinator relies
   *  on this order (Polish B6): a subscriber that cancels re-entrantly during `put` ends the run
   *  `cancelled`, with the complete, verified report it had already published kept. */
```

and the coordinator's comment above `this.isolate(() => { this.deps.evidence.put(profileId, report); });` gains "A subscriber cancelling inside `put` keeps the report just published (Polish B6, L15): `finally` then confirms `cancelled`." (L15.)

**B8, B9, B10** — see the pins.

**B9 fix** (`tests/fixtures/fake-process-port.ts`, first lines of `run`):

```ts
      requests.push(request);
      // Polish B9: parity with the real runner, which never spawns for a token already cancelled
      // (and a token's onCancelled never fires for a cancel that already happened).
      if (token.cancelled) return Promise.resolve({ kind: 'cancelled', stderrTail: '' });
```

**B10:** rename `mayPublish` in `analysis-state.ts` to `mayPublishAnalysis`, and its two uses (`analysis-coordinator.ts:24,154`) and `tests/unit/analysis-state.test.ts` (import line and six calls). `run-state.ts`'s `mayPublish` is not touched. Pure rename; `grep -rn "mayPublish\b" src/application/analysis` prints nothing.

**The service test world.** Create `tests/fixtures/fallow-service-world.ts` by moving, verbatim, `SNAPSHOT`, `ROOT`, `EXE`, `subjectOf`, `dirPort`, `setup` (renamed `createServiceWorld`, with one optional parameter `store: AnalyzerBindingStore = createInMemoryAnalyzerStore('m')` used instead of the literal), `trusted` and `reviewed` out of `tests/unit/fallow-analysis-service.test.ts`; that file imports them (`const setup = (): ServiceWorld => createServiceWorld();` keeps its call sites unchanged). Export `type ServiceWorld = ReturnType<typeof createServiceWorld>`.

**B7 — the consent-gate tests are thin.** No code change: the cases below (another device's or an invalid record, Trust and run on an unsupported store, zero process requests on every refusal, trust intact on busy, the 120,000 ms default, and 10/1800/9/1801/10.5 at the service) pin what the service already does.

Pins — `tests/unit/fallow-analysis-service-consent.test.ts` (new):

```ts
// Polish B1, B2, B7: the consent gate case by case — busy races, refused trust writes, and
// every refusal starting nothing.
import { describe, expect, it } from 'vitest';
import { setTimeout as delay } from 'node:timers/promises';
import { AnalyzerStoreError } from '../../src/application/analysis/analyzer-record';
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import type { AnalyzerBindingStore } from '../../src/application/ports/analyzer-binding-store';
import { createInMemoryAnalyzerStore } from '../fixtures/in-memory-analyzer-store';
import { factsFor } from '../fixtures/fake-executable-inspector';
import { exitedWith } from '../fixtures/fake-process-port';
import { emptyEvidenceReport } from '../fixtures/evidence-report';
import { EXE, ROOT, SNAPSHOT, createServiceWorld, reviewed, subjectOf, trusted } from '../fixtures/fallow-service-world';

const OLD_EXE = '/opt/old/fallow';
const refusing = (inner: AnalyzerBindingStore, member: 'grantTrust' | 'revokeTrust', error: Error): AnalyzerBindingStore =>
  ({ ...inner, [member]: () => Promise.reject(error) });

describe('Polish B1: the busy re-check before the bind', () => {
  it('B1: a run that starts while Trust and run awaits its checks is not bound over', async () => {
    const s = createServiceWorld();
    await s.store.bind('p1', OLD_EXE);
    const review = await reviewed(s);
    const inspect = s.inspector.answer;
    s.inspector.answer = (path) => {
      s.coordinator.start({ subject: subjectOf(factsFor(OLD_EXE)), snapshotId: SNAPSHOT.snapshotId, timeoutSeconds: 120, onProbePassed: () => Promise.resolve('continue') });
      return inspect(path);
    };
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toEqual({ kind: 'busy' });
    expect(await s.store.read('p1')).toMatchObject({ kind: 'bound', binding: { executablePath: OLD_EXE } });
  });
});

describe('Polish B2: a refused trust write is not an operational failure', () => {
  it('B2: a grant refused as unsupported ends store-unsupported; evidence is not marked stale', async () => {
    const s = createServiceWorld(refusing(createInMemoryAnalyzerStore('m'), 'grantTrust', new AnalyzerStoreError('unsupported')));
    s.evidence.put('p1', emptyEvidenceReport(SNAPSHOT.snapshotId));
    expect(await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s))).toEqual({ kind: 'started' });
    await s.process.settle(exitedWith(0, 'fallow 3.27.0'));
    expect(s.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'store-unsupported', evidenceKept: false });
    expect(s.evidence.get('p1')?.staleReason).toBeUndefined();
  });

  it('B2: a revoke refused after a version change ends changed-since-review (not-bound) or store-unsupported, never stale', async () => {
    for (const [code, expected] of [['not-bound', 'changed-since-review'], ['unsupported', 'store-unsupported']] as const) {
      const s = createServiceWorld(refusing(createInMemoryAnalyzerStore('m'), 'revokeTrust', new AnalyzerStoreError(code)));
      await trusted(s);
      s.evidence.put('p1', emptyEvidenceReport(SNAPSHOT.snapshotId));
      await s.service.run('p1', SNAPSHOT);
      await s.process.settle(exitedWith(0, 'fallow 3.28.0'));
      expect(s.service.stateOf('p1'), code).toMatchObject({ status: 'failed', code: expected, evidenceKept: false });
      expect(s.evidence.get('p1')?.staleReason, code).toBeUndefined();
    }
  });

  it('B2: any other error from a trust write still ends the run as the internal failure', async () => {
    const s = createServiceWorld(refusing(createInMemoryAnalyzerStore('m'), 'revokeTrust', new Error('disk full')));
    await trusted(s);
    await s.service.run('p1', SNAPSHOT);
    await s.process.settle(exitedWith(0, 'fallow 3.28.0'));
    expect(s.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'spawn-failed', detail: 'internal' });
  });
});

describe('Polish B7: the consent gate at the service', () => {
  it('another device\'s record, or an invalid one, asks for an executable and runs nothing', async () => {
    const other = { v: 1, provider: 'fallow', machineId: 'other', executablePath: EXE, timeoutSeconds: 120, trust: null };
    for (const [record, kind] of [[other, 'other-machine'], [{ v: 1, provider: 'fallow' }, 'invalid']] as const) {
      const s = createServiceWorld(createInMemoryAnalyzerStore('m', { p1: record }));
      expect(await s.service.run('p1', SNAPSHOT), kind).toEqual({ kind: 'choose-executable', read: { kind } });
      expect(s.process.requests, kind).toEqual([]);
    }
  });

  it('Trust and run against a newer-format record is refused as store-unsupported and runs nothing', async () => {
    const s = createServiceWorld(createInMemoryAnalyzerStore('m', { p1: { v: 2 } }));
    expect(await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s))).toEqual({ kind: 'refused', code: 'store-unsupported', detail: '' });
    expect(s.process.requests).toEqual([]);
  });

  it('no refusal starts a process: a relative path, a missing root, an older snapshot, a vanished or changed file', async () => {
    const s = createServiceWorld();
    const review = await reviewed(s);
    expect(await s.service.review('p1', SNAPSHOT, 'fallow')).toMatchObject({ ok: false });
    s.inspector.answer = () => ({ ok: false, refusal: 'executable-missing', detail: '' });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toMatchObject({ kind: 'refused', code: 'executable-missing' });
    s.inspector.answer = (p) => ({ ok: true, facts: factsFor(p, { size: 1 }) });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toMatchObject({ kind: 'refused', code: 'changed-since-review' });
    s.root.exists = false;
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toMatchObject({ kind: 'refused', code: 'root-unavailable' });
    s.root.exists = true;
    s.snapshots.put({ ...SNAPSHOT, snapshotId: 'snapshot-newer' });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toMatchObject({ kind: 'refused', code: 'snapshot-changed' });
    expect(s.process.requests).toEqual([]);
  });

  it('busy keeps the stored trust exactly as it was', async () => {
    const s = createServiceWorld();
    await trusted(s);
    const before = await s.store.read('p1');
    await s.service.run('p1', SNAPSHOT);
    expect(await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s))).toEqual({ kind: 'busy' });
    expect(await s.store.read('p1')).toEqual(before);
  });

  it('a first Trust and run uses the 120 s default: the analysis asks for 120,000 ms', async () => {
    const s = createServiceWorld();
    await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s));
    await s.process.settle(exitedWith(0, 'fallow 3.27.0'));
    expect(s.process.requests.map((r) => r.args)).toEqual([['--version'], FALLOW_RUN_ARGS(ROOT)]);
    expect(s.process.requests[1]?.timeoutMs).toBe(120_000);
  });

  it('setTimeLimit accepts 10 and 1800 and refuses 9, 1801 and 10.5 without writing', async () => {
    const s = createServiceWorld();
    await s.store.bind('p1', EXE);
    expect(await s.service.setTimeLimit('p1', 10)).toBe('saved');
    expect(await s.service.setTimeLimit('p1', 1800)).toBe('saved');
    for (const bad of [9, 1801, 10.5]) expect(await s.service.setTimeLimit('p1', bad), String(bad)).toBe('invalid');
    expect(await s.store.read('p1')).toMatchObject({ binding: { timeoutSeconds: 1800 } });
    await delay(0);
  });
});
```

(If the decoder reports `invalid` rather than `other-machine` for the first record, the disk wins: fix the expectation and record it as "Polish E<n>".)

RED: B1 (`started`, and the path is `EXE`), B2's first two (`changed-since-review`/`spawn-failed`, stale). The B7 cases and the third B2 case pin existing behaviour; mutations: drop `if (isActive(…)) return { kind: 'busy' };` on entry (busy case), drop `if (!isValidTimeoutSeconds(seconds))` (limits case), replace `FALLOW_TIMEOUT_DEFAULT_S` with `600` in `trustAndRun` (default case), make `refusedTrustWrite` return `'changed-since-review'` for every error (third B2 case).

Pins — `tests/unit/analysis-coordinator.test.ts`:
- **B5** (in "failures keep old evidence"):

```ts
  it('Polish B5: a probe the port ends as cancelled, unasked, ends the run cancelled and marks nothing stale', async () => {
    const s = setup();
    const old = emptyEvidenceReport(SNAPSHOT.snapshotId);
    s.evidence.put('p1', old);
    expect(s.coordinator.start(plan())).toBe(true);
    await s.process.settle({ kind: 'cancelled', stderrTail: '' });
    expect(s.coordinator.stateOf('p1').status).toBe('cancelled');
    expect(s.evidence.get('p1')).toBe(old);
    expect(s.process.requests).toHaveLength(1);
  });
```

  RED: `failed`/`version-probe-failed`, evidence replaced by a stale copy.
- **B6**: the existing "an evidence subscriber cancelling on put still reaches cancelled, not stuck in cancelling" gains `expect(s.evidence.get('p1')?.collected?.origin).toBe('collected');` and its title ends ", and keeps the report it had already published (Polish B6)". Mutation: dispatch `RUN_COMPLETED` before `put` → the state ends `completed`.
- **B8**: retitle "cancel while running forbids publication even if the report was already complete" to "cancel while running stops the process and publishes nothing"; add

```ts
  it('Polish B8: a cancel while onProbePassed is pending ends cancelled, and the analysis never starts', async () => {
    const s = setup();
    const verdicts: ((verdict: 'continue') => void)[] = [];
    await probed(s, plan({ onProbePassed: () => new Promise((resolve) => { verdicts.push(resolve); }) }));
    expect(s.coordinator.stateOf('p1').status).toBe('probing');
    s.coordinator.cancel('p1');
    expect(s.coordinator.stateOf('p1').status).toBe('cancelling');
    verdicts[0]!('continue');
    await delay(0);
    expect(s.coordinator.stateOf('p1').status).toBe('cancelled');
    expect(s.process.requests).toHaveLength(1);
  });
```

  (mutation: delete the `stopIfCancelled` line after `await plan.onProbePassed(…)` → two requests); and make the shutdown test's "publishes nothing" real — after `expect(s.coordinator.start(plan({ subject: { ...SUBJECT, profileId: 'p2' } }))).toBe(true);` insert

```ts
    // Polish B8: p1's complete report has arrived; shutdown lands before the coordinator reads it.
    const arriving = s.process.settle(exitedWith(0, REPORT));
```

  then `s.coordinator.shutdown();` as today, then `await arriving;` before the existing assertions (mutation: delete the `stopIfCancelled` line after the analysis `await` → p1's report is published).
- **B9**:

```ts
describe('the fake process port (Polish B9)', () => {
  it('answers a token cancelled before the call at once, as the real runner does', async () => {
    const port = createFakeProcessPort();
    const { token, cancel } = createCancellationToken();
    cancel();
    const request = { executablePath: '/x/fallow', args: ['--version'], cwd: '/x', timeoutMs: 5_000, maxStdoutBytes: 4_096, maxStderrBytes: 65_536 };
    await expect(port.run(request, token)).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
    expect(port.pending()).toBe(0);
  }, 2_000);
});
```

  RED: it hangs until the 2 s timeout.

- [ ] **Step 1: Write the failing tests.** Create the world fixture and move the service test's setup into it (no behaviour change), then add every pin above.
- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/unit/fallow-analysis-service-consent.test.ts tests/unit/analysis-coordinator.test.ts`
Expected: FAIL — B1, B2 (first two), B5, B9. Run the named mutations for B6, B7, B8 and the third B2 case, and paste both runs.

- [ ] **Step 3: Implement** B1–B6, B9's fixture change and B10.
- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/unit/fallow-analysis-service-consent.test.ts tests/unit/fallow-analysis-service.test.ts tests/unit/analysis-coordinator.test.ts tests/unit/analysis-state.test.ts tests/unit/fallow-invocation.test.ts tests/unit/fallow-run-copy.test.ts tests/integration/fallow-analysis.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/application/analysis src/application/ports/evidence-repository.ts tests/fixtures/fake-process-port.ts tests/fixtures/fallow-service-world.ts tests/unit/fallow-analysis-service-consent.test.ts tests/unit/fallow-analysis-service.test.ts tests/unit/analysis-coordinator.test.ts tests/unit/analysis-state.test.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add src/application/analysis src/application/ports/evidence-repository.ts tests/fixtures/fake-process-port.ts tests/fixtures/fallow-service-world.ts tests/unit/fallow-analysis-service-consent.test.ts tests/unit/fallow-analysis-service.test.ts tests/unit/analysis-coordinator.test.ts tests/unit/analysis-state.test.ts
git commit -m "fix(analysis): busy re-check before bind, refused trust writes are not operational, unasked cancels, and derived error codes (polish B1-B10)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3a: The analysis UI — binding truth (C1, C2, C10, C11, C13)

Model tier: **most capable** (store state, a remount race, K41 amended).

**Files:**
- Modify: `src/application/analysis/fallow-analysis-service.ts` (after Task 2): the interface (56–73) and the returned object (193–196) — `executableName`
- Modify: `src/ui/stores/analysis-store.ts` (121): the state (15–25), `refreshBinding`/`refreshQuietly` (30–40), `setService` (56–61), `bindRepository` (63–71), `forget` (106–112), the return (117–120)
- Modify: `src/ui/screens/sources/FallowRunPanel.vue` (159): header (6–7), `executableText` (42–49), `chooseBlocked` (68), the choose button (136–145), the facts `<dd>` (104–109)
- Modify: `src/ui/screens/sources/FallowInstalledRoute.vue` (238): lines 40–42
- Modify: `src/ui/screens/sources/ConnectFallowDialog.vue` (298): emits (35), a `busy` watcher
- Modify: `src/ui/screens/SourcesScreen.vue` (253): `startConnect`/`openInstalled` (65–81), the dialog element (218–225), the switch watcher (97)
- Modify: `src/ui/audit-copy/fallow-run.ts` (171): after `FALLOW_EXE_UNSUPPORTED` (100) — **shared with Tasks 3b and 4**, which add below it
- Modify: `tests/fixtures/fake-fallow-analysis.ts` (85): `executableName`
- Create: `tests/component/fallow-binding-truth.test.ts` (~190)
- Modify: `tests/unit/analysis-store.test.ts` (172 → ~225), `tests/component/fallow-run-panel.test.ts` (391: the case at 360 rewritten in place, 391 → 392)

**Interfaces:**
- Consumes: `FallowAnalysisService`, `useAnalysisStore`, `createFakeFallowAnalysis(executableName?)`, `fakeRunReview`, the Task 2 service.
- Produces: see the outline (Task 3a).

**C1 — a read failure reads as "none".** Service interface: `/** Polish C1 (K41 amended, L2): the platform's executable name, without reading the binding. */ readonly executableName: 'fallow.exe' | 'fallow';` and in the returned object `executableName: inspector.executableName,`. The fake gains `executableName,` in its object literal and `readonly executableName: 'fallow.exe' | 'fallow'` through the interface.

Store — add the state:

```ts
  /** Polish C1: the last read of the binding failed (data.json unreadable). `binding` null with
   *  `readFailed` false means "not read yet". */
  const readFailed = ref(false);
  /** Polish C1 (K41 amended, L2): from the service itself, so the path hint never waits for
   *  (or depends on) a binding read. */
  const executableName = shallowRef<'fallow.exe' | 'fallow' | null>(null);
```

and replace `refreshBinding`/`refreshQuietly` with:

```ts
  /** A read that lands after a rebind is dropped (the ticket moved on). Polish C1: a failed read
   *  is kept as `readFailed`, never folded into "no executable chosen". It never rejects. */
  const refreshBinding = async (): Promise<void> => {
    const id = repositoryId.value;
    const current = service;
    readTicket += 1;
    const ticket = readTicket;
    if (current === null || id === '') { binding.value = null; readFailed.value = false; return; }
    const still = (): boolean => ticket === readTicket && id === repositoryId.value;
    try {
      const view = await current.readBinding(id);
      if (still()) { binding.value = view; readFailed.value = false; }
    } catch {
      if (still()) { binding.value = null; readFailed.value = true; }
    }
  };
  const refreshQuietly = (): void => { void refreshBinding(); };
```

`setService` sets `executableName.value = next.executableName;` before `listen()`; `bindRepository` also sets `readFailed.value = false;` beside `binding.value = null;`.

Copy (`audit-copy/fallow-run.ts`, after `FALLOW_EXE_UNSUPPORTED`):

```ts
/** Polish C1: the binding could not be read, which is not the same as none being chosen. */
export const FALLOW_EXE_READ_FAILED = 'This codebase’s executable setting could not be read from the plugin’s data file. Nothing was changed. Open Data & scans again to retry.';
```

Panel: `executableText` starts `if (read === null) return analysis.readFailed ? FALLOW_EXE_READ_FAILED : FALLOW_EXE_NONE;` then `if (read.kind === 'none') return FALLOW_EXE_NONE;` (the rest unchanged); the header comment's lines 6–7 become "An unread binding reads as 'No executable chosen'; an unreadable one (the store's `readFailed`) says it could not be read. There is no spinner to hang, and Run still asks the service, which reads the record itself." `canForget` is unchanged (false for `null`). Installed route: `const windows = computed(() => analysis.executableName !== 'fallow');` with the comment "fallow.exe unless the service says `fallow` (Polish C1: from the service, not the binding read)".

**C2 — an unsupported record still offers Choose.**

```ts
const unsupported = computed(() => analysis.binding?.kind === 'unsupported');
/** Polish C2: an unsupported record cannot be replaced from here (it is read-only, Z2), so
 *  Choose is blocked, described by the row that says why. */
const chooseBlocked = computed(() => analysis.active || !props.hasSnapshot || unsupported.value);
const executableId = useUniqueId('ci-fallow-run-exe');
```

The facts `<dd>` gets `:id="executableId"`; the choose button's `aria-describedby` becomes `!hasSnapshot ? runHintId : analysis.active ? busyHintId : unsupported ? executableId : undefined`.

**C10 — a remount mid-step discards the step.** `ConnectFallowDialog.vue`: `const emit = defineEmits<{ close: []; done: [message: string]; busy: [busy: boolean] }>();` and after `const { busy, … } = action;`:

```ts
/** Polish C10: SourcesScreen holds a newer request while a step is in flight (L23). */
watch(busy, (now) => { emit('busy', now); });
```

(`watch` joins the `vue` import.) `SourcesScreen.vue`:

```ts
/** Polish C10 (L23): while the dialog's step is in flight, a newer request waits, the newest
 *  one winning, and is applied once the step settles; it is dropped if that step closed the
 *  dialog or the codebase changed. A remount mid-step would discard the step. */
const dialogBusy = ref(false);
let deferred: (() => void) | null = null;
function whenDialogIdle(apply: () => void): void {
  if (connecting.value && dialogBusy.value) { deferred = apply; return; }
  apply();
}
watch(dialogBusy, (now) => {
  const next = deferred;
  if (now || next === null) return;
  deferred = null;
  if (connecting.value) next();
});
watch(connecting, (open) => { if (!open) { dialogBusy.value = false; deferred = null; } });
```

`startConnect` and `openInstalled` wrap their bodies: `function startConnect(): void { whenDialogIdle(() => { removing.value = false; connectRoute.value = 'choose'; installedStart.value = undefined; connectKey.value += 1; connecting.value = true; }); }` and likewise for `openInstalled(start)`. The dialog element gains `@busy="dialogBusy = $event"`. The switch watcher (line 97) also clears `deferred = null`.

**C11 — a refresh rejection reports a successful Forget as failed.** Solved by C1's `refreshBinding`, which never rejects; `forget` keeps `await refreshBinding();` so the binding is fresh when it resolves.

**C13 — `refreshBinding` exposed.** Drop it from the store's return object (`setService, bindRepository, requestRun, …`).

Pins — `tests/unit/analysis-store.test.ts`:

```ts
describe('Polish C1, C11, C13: binding truth in the store', () => {
  it('C1: a failed read is readFailed, not "none"; the next good read clears it', async () => {
    const fake = createFakeFallowAnalysis('fallow');
    const read = fake.readBinding.bind(fake);
    let failing = true;
    fake.readBinding = (id) => (failing ? Promise.reject(new Error('EIO')) : read(id));
    const store = useAnalysisStore();
    store.setService(fake);
    store.bindRepository('p1');
    await flushPromises();
    expect([store.binding, store.readFailed]).toEqual([null, true]);
    failing = false;
    fake.setBinding('p1', { kind: 'none' });
    await flushPromises();
    expect([store.binding, store.readFailed]).toEqual([{ kind: 'none', executableName: 'fallow' }, false]);
  });

  it('C1 (L2): the executable name comes from the service before any read lands', () => {
    const store = useAnalysisStore();
    store.setService(createFakeFallowAnalysis('fallow'));
    expect(store.executableName).toBe('fallow');
  });

  it('C11: a Forget that succeeded resolves true even when the re-read fails', async () => {
    const fake = createFakeFallowAnalysis();
    fake.setBinding('p1', { kind: 'bound', binding: { profileId: 'p1', executablePath: 'C:\\f\\fallow.exe', timeoutSeconds: 120, trust: null } });
    const store = useAnalysisStore();
    store.setService(fake);
    store.bindRepository('p1');
    await flushPromises();
    fake.readBinding = () => Promise.reject(new Error('EIO'));
    await expect(store.forget()).resolves.toBe(true);
    expect(store.readFailed).toBe(true);
  });

  it('C13: refreshBinding is internal to the store', () => {
    const store = useAnalysisStore();
    // @ts-expect-error Polish C13: not part of the store's surface.
    expect(store.refreshBinding).toBeUndefined();
  });
});
```

RED: `readFailed`/`executableName` do not exist; C11 rejects; C13's `@ts-expect-error` is unused (typecheck fails).

`tests/component/fallow-run-panel.test.ts`, the case at line 360, rewritten in place: title "Polish C1: an unreadable binding says so, offers no Forget, and Run still asks the service"; replace `expect(w.find('.ci-fallow-run__facts').text()).toContain(FALLOW_EXE_NONE);` with `expect(w.find('.ci-fallow-run__facts').text()).toContain(FALLOW_EXE_READ_FAILED);` and add `expect(w.find('.ci-fallow-run__forget').exists()).toBe(false);` (import `FALLOW_EXE_READ_FAILED` on the existing copy import line, replacing `FALLOW_EXE_NONE` if unused elsewhere in the file).

`tests/component/fallow-binding-truth.test.ts` (new; header "Polish C1, C2, C10: what the fallow card and the installed route say when the binding is unreadable or read-only, and a request that lands mid-step"), with the `mountS`, `setup` and `RUNNING`/`BOUND` definitions copied from `tests/component/fallow-run-panel.test.ts` lines 23–47 (G1 does not cover component helpers):

```ts
describe('Polish C1: the executable name without a binding read', () => {
  it('on POSIX the path hint is the POSIX one even when the binding read failed', async () => {
    const fake = createFakeFallowAnalysis('fallow');
    fake.readBinding = () => Promise.reject(new Error('EIO'));
    setupWith(fake);
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await flushPromises();
    expect(w.text()).toContain(FALLOW_EXE_HINT_POSIX);
    expect(w.text()).not.toContain(FALLOW_EXE_HINT_WINDOWS);
    w.unmount();
  });
});

describe('Polish C2: a read-only record', () => {
  it('blocks Choose executable…, described by the row that says why, and opens nothing', async () => {
    const fake = setup();
    fake.setBinding('p1', { kind: 'unsupported' });
    const w = mountS();
    await flushPromises();
    const choose = w.find('.ci-fallow-run__choose');
    expect(choose.attributes('aria-disabled')).toBe('true');
    const describedBy = choose.attributes('aria-describedby');
    expect(describedBy).toBeDefined();
    expect(document.getElementById(describedBy!)?.textContent?.trim()).toBe(FALLOW_EXE_UNSUPPORTED);
    await choose.trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });
});

describe('Polish C10: a request that lands mid-step', () => {
  it('a run request during a busy check waits for the check, then opens its review', async () => {
    const fake = setup();
    const answers: ((result: ReviewResult) => void)[] = [];
    fake.review = () => new Promise((resolve) => { answers.push(resolve); });
    fake.next.run = { kind: 'review', review: fakeRunReview('p1', 'snapshot-fixture', '/fixture/root'), reason: 'changed' };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__path').setValue('C:\\Tools\\fallow\\fallow.exe');
    await w.find('.ci-fallow-installed__check').trigger('click');
    useAnalysisStore().requestRun();
    await flushPromises();
    expect((w.find('.ci-fallow-installed__path').element as HTMLInputElement).value).toBe('C:\\Tools\\fallow\\fallow.exe');
    expect(answers).toHaveLength(1);
    answers[0]!({ ok: false, code: 'executable-missing', detail: '' });
    await flushPromises();
    expect(w.find('.ci-fallow-review').exists()).toBe(true);
    expect(w.find('.ci-fallow-installed__retrust').exists()).toBe(true);
    expect(w.findAll('[role="dialog"]')).toHaveLength(1);
    w.unmount();
  });

  it('a request held during Trust and run is dropped once the run starts and the dialog closes', async () => {
    const fake = setup();
    const starts: ((outcome: StartOutcome) => void)[] = [];
    fake.trustAndRun = () => new Promise((resolve) => { starts.push(resolve); });
    fake.next.run = { kind: 'choose-executable', read: { kind: 'none' } };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__path').setValue('C:\\Tools\\fallow\\fallow.exe');
    await w.find('.ci-fallow-installed__check').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__trust').trigger('click');
    useAnalysisStore().requestRun();
    await flushPromises();
    starts[0]!({ kind: 'started' });
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });
});
```

(`setupWith(fake)` is `setup`'s body taking the fake as a parameter; `setup()` becomes `() => setupWith(createFakeFallowAnalysis())`. `ReviewResult` and `StartOutcome` are imported as types from `src/ui/read-models/fallow-run.ts`.) RED: C1 shows the Windows hint; C2 is not aria-disabled; C10's first case finds the review already shown (the path input is gone); the second case reopens a dialog on the path step.

- [ ] **Step 1: Write the failing tests** (the store pins, the rewritten panel case, the new component file) and the fake's `executableName`.
- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/unit/analysis-store.test.ts tests/component/fallow-binding-truth.test.ts tests/component/fallow-run-panel.test.ts`
Expected: FAIL as listed (and `npm run typecheck` fails on `readFailed`, `executableName` and C13's unused `@ts-expect-error`).

- [ ] **Step 3: Implement** C1, C2, C10, C11, C13.
- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/unit/analysis-store.test.ts tests/component/fallow-binding-truth.test.ts tests/component/fallow-run-panel.test.ts tests/component/connect-fallow-routes.test.ts tests/component/connect-fallow.test.ts tests/component/fallow-card.test.ts tests/unit/fallow-analysis-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/application/analysis/fallow-analysis-service.ts src/ui/stores/analysis-store.ts src/ui/screens/sources src/ui/screens/SourcesScreen.vue src/ui/audit-copy/fallow-run.ts tests/fixtures/fake-fallow-analysis.ts tests/unit/analysis-store.test.ts tests/component/fallow-binding-truth.test.ts tests/component/fallow-run-panel.test.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add src/application/analysis/fallow-analysis-service.ts src/ui/stores/analysis-store.ts src/ui/screens/sources/FallowRunPanel.vue src/ui/screens/sources/FallowInstalledRoute.vue src/ui/screens/sources/ConnectFallowDialog.vue src/ui/screens/SourcesScreen.vue src/ui/audit-copy/fallow-run.ts tests/fixtures/fake-fallow-analysis.ts tests/unit/analysis-store.test.ts tests/component/fallow-binding-truth.test.ts tests/component/fallow-run-panel.test.ts
git commit -m "fix(ui): an unreadable or read-only binding says so, the path hint comes from the service, and a request never remounts a busy step (polish C1, C2, C10, C11, C13)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3b: The analysis UI — focus, copy and tests (C3–C9, C12, C14–C17, C19)

Model tier: **standard**.

**Files:**
- Modify: `src/ui/screens/sources/FallowRunPanel.vue` (after 3a): `primary` (72–79), `banner` (33–40), a hint paragraph after the run hint
- Modify: `src/ui/screens/sources/FallowInstalledRoute.vue` (after 3a): header (1–10), `onMounted` (141–148), an `alert` slot before the actions
- Modify: `src/ui/screens/sources/ConnectFallowDialog.vue` (after 3a): `inject` import and `now` (12, after 43), lines 122 and 146, the `FallowInstalledRoute` element (162–169), the alert paragraph (257–263)
- Modify: `src/ui/screens/SourcesScreen.vue` (after 3a): the run-request watcher (88–90)
- Modify: `src/ui/read-models/fallow-run.ts` (65): after `refusalBanner` (157–160)
- Modify: `src/ui/audit-copy/fallow-run.ts` (after 3a): `FALLOW_EXE_FORGET_FAILED` (106), `FALLOW_RUN_CANCELLING_HINT` after `FALLOW_RUN_BUSY_HINT` (102), `FALLOW_ROW_COLLECTED` after `FALLOW_ROW_EXECUTABLE` (91)
- Modify: `src/ui/audit-copy/fallow.ts` (193): delete `FALLOW_ROW_COLLECTED` (156) — **shared with Tasks 5a and 6**, which edit other lines
- Modify: `src/host/analysis-notices.ts` (19): lines 11–16
- Create: `tests/component/fallow-run-polish.test.ts` (~260), `tests/host/city-view-analysis.test.ts` (~110)
- Modify: `tests/unit/fallow-run-read-model.test.ts` (57 → ~63), `tests/unit/fallow-run-copy.test.ts` (60 → ~66), `tests/host/analysis-notices.test.ts` (33 → ~45)

**Interfaces:**
- Consumes: Task 3a's store (`readFailed`, `executableName`), `createFakeFallowAnalysis`, `fakeRunReview`, `syntheticFallowJson`, `dataPortDeps`, `defaultCityViewState`.
- Produces: see the outline (Task 3b).

**C3 — the blocked Cancel is described by the busy hint.** Copy: `/** Polish C3: what a blocked Cancel analysis says while the run is already stopping. */ export const FALLOW_RUN_CANCELLING_HINT = 'The analysis is already being stopped. It ends in a few seconds.';`. Panel: `const cancellingHintId = useUniqueId('ci-fallow-run-cancelling');`; in `primary`'s active branch `describedBy: blocked ? cancellingHintId : undefined`; after the run hint paragraph:

```vue
    <p
      v-if="analysis.active && !analysis.cancellable"
      :id="cancellingHintId"
      class="visually-hidden"
    >
      {{ FALLOW_RUN_CANCELLING_HINT }}
    </p>
```

(`busyHintId` stays on Choose and Forget, which really are blocked by the run.)

**C4 — focus after a command-started run.** `SourcesScreen.vue`:

```ts
/** Polish C4: a run the command started, with no dialog opened, leaves focus on the run's own
 *  button (Cancel analysis), never on a control the run has just blocked (Import). */
async function runFromCommand(): Promise<void> {
  await runAnalysis();
  if (connecting.value) return;
  await nextTick();
  root.value?.querySelector<HTMLElement>('.ci-fallow-run__cancel, .ci-fallow-run__run')?.focus();
}
```

and the watcher calls `void nextTick().then(runFromCommand)`.

**C5 — the auto-check places no focus first.** In `FallowInstalledRoute.vue`'s `onMounted`, replace the last line `void check();` with:

```ts
  // Polish C5: focus is inside the route before the check starts, so a refusal (which lands in
  // the dialog's alert) or a thrown step never leaves it on the removed "Use installed fallow…".
  void focusOn('heading').then(check);
```

**C6 — the alert below the installed route's buttons.** In `FallowInstalledRoute.vue`, before `<div class="ci-connect-fallow__actions">`: `<slot name="alert" />` (the header gains "Polish C6: the dialog passes its one role=\"alert\" through the `alert` slot, so it sits above this route's actions, as it does on the import route."). In `ConnectFallowDialog.vue`, the `FallowInstalledRoute` element gets

```vue
        <template #alert>
          <p
            v-if="error"
            class="ci-connect-fallow__error"
            role="alert"
          >
            {{ error }}
          </p>
        </template>
```

and the dialog's own alert paragraph's `v-if` becomes `error && route !== 'installed'` (only one is ever rendered).

**C7 — the header comment.** Replace "It never assigns to that action: clearing the alert is the dialog's (`clear-error`, PF13)." with "It never assigns to that action. Only 'Change path' clears the alert, by emitting `clear-error` (PF13); every other step replaces its text through `reannounce`."

**C8 — the failure banner built inline.** `read-models/fallow-run.ts`, after `refusalBanner`:

```ts
/** Polish C8: a Run or a Forget that threw (use-fallow-run.ts): the failed form, its text only. */
export function failureBanner(text: string): FallowRunBanner {
  return { tone: 'warning', icon: 'alert-triangle', text, reason: null, kept: false, log: null };
}
```

and the panel's `banner` uses `return failureBanner(props.failure);`.

**C9 — Forget's failure does not say what stays.** `export const FALLOW_EXE_FORGET_FAILED = 'The fallow executable could not be forgotten: the plugin’s data file could not be updated. It stays chosen and trusted for this codebase. Try again.';`

**C12 — the `told` set grows.**

```ts
  /** Polish C12: the last run told, per codebase — not every run of the session. */
  const told = new Map<string, string>();
  return service.subscribe((profileId) => {
    const state = service.stateOf(profileId);
    if (state.status !== 'failed' || told.get(profileId) === state.runId) return;
    if (!OPERATIONAL_FAILURES.has(state.code) && state.code !== 'version-changed') return;
    told.set(profileId, state.runId);
    notify(FALLOW_RUN_NOTICE(FALLOW_RUN_ERROR[state.code](state.detail)));
  });
```

**C17 — `new Date()` where Y27 says Clock.** `ConnectFallowDialog.vue`: `inject` joins the `vue` import;

```ts
/** Polish C17 (Y27): time comes from the host's clock when one is provided, as SnapshotStatus reads it. */
const now = inject<() => Date>('now', () => new Date());
```

and lines 122 and 146 use `now().toISOString()`.

**C19.** Move `FALLOW_ROW_COLLECTED = 'Collected'` from `audit-copy/fallow.ts` to `audit-copy/fallow-run.ts` after `FALLOW_ROW_EXECUTABLE`. Both are re-exported by `inspector-copy.ts`, so no import changes. Pure move: `grep -n "FALLOW_ROW_COLLECTED" src/ui/audit-copy/*.ts` prints one line, in `fallow-run.ts`; `tests/component/collected-evidence.test.ts` stays green.

**C16 — the delegations only tested through a double.** `tests/host/city-view-analysis.test.ts` (new; runs in jsdom through the `city-view*` glob):

```ts
// Polish C16 (Part 7 Z35): the four analysis delegations on a REAL CityView, before onOpen (no
// Pinia) and after it, with and without a snapshot. commands.ts calls them through
// getActiveViewOfType; fallow-commands.test.ts uses a view double, so their guards were unpinned.
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { getActivePinia, type Pinia } from 'pinia';
import { CityView, type CityViewDeps } from '../../src/host/city-view';
import { defaultCityViewState } from '../../src/host/view-state';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import type { AnalysisIdentity } from '../../src/application/analysis/analysis-state';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import { useCityStore } from '../../src/ui/stores/city-store';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { createFakeFallowAnalysis, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

// A fresh leaf opens on Overview, so no renderer is ever built; the mock keeps three.js out.
vi.mock('../../src/visualization/city-renderer', () => ({ createCityRenderer: vi.fn() }));

const ID: AnalysisIdentity = { profileId: 'p1', snapshotId: 's1', rootFingerprint: 'a', subjectFingerprint: 'b', runId: 'r1', generation: 0 };
const RUNNING = { status: 'running', identity: ID, rootPath: '/repo', startedAt: '2026-09-23T10:00:00.000Z', timeoutSeconds: 120, version: '3.27.0', tested: true } as const;

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

function makeDeps(fallowAnalysis: FakeFallowAnalysis): CityViewDeps {
  const snapshotStore = new InMemorySnapshotStore(createFixedClock());
  snapshotStore.put({ ...buildSnapshotFixture({ files: 3, repositoryId: 'p1' }), snapshotId: 's1' });
  return {
    profileStore: createFakeProfileStoreHarness().store, getFilesystem: () => createFakeSourceFileSystem({}).port,
    snapshotStore, clock: createFixedClock(), ...dataPortDeps(), fallowAnalysis,
  };
}

async function openView(deps: CityViewDeps, withSnapshot = true): Promise<{ view: CityView; pinia: Pinia }> {
  const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, deps);
  if (withSnapshot) await view.setState({ ...defaultCityViewState(), profileId: 'p1', snapshotId: 's1' }, {} as never);
  await view.onOpen();
  await flushPromises();
  const pinia = getActivePinia();
  if (!pinia) throw new Error('test setup: the view installed no Pinia');
  return { view, pinia };
}

describe('CityView analysis delegations (Polish C16)', () => {
  it('before onOpen (no Pinia) they answer false and reach nothing', () => {
    const fake = createFakeFallowAnalysis();
    const view = new CityView({ width: 1000, height: 700 } as never, makePluginDouble() as never, makeDeps(fake));
    expect([view.isAnalysisActive(), view.isAnalysisCancellable()]).toEqual([false, false]);
    expect(() => { view.requestFallowRun(); view.cancelAnalysis(); }).not.toThrow();
    expect(fake.calls).toEqual([]);
  });

  it('without a snapshot, requestFallowRun raises no request', async () => {
    const { view, pinia } = await openView(makeDeps(createFakeFallowAnalysis()), false);
    view.requestFallowRun();
    expect(useAnalysisStore(pinia).runRequested).toBe(false);
    await view.onClose();
  });

  it('with a snapshot it raises the request, mirrors the run, and cancels through the service', async () => {
    const fake = createFakeFallowAnalysis();
    const { view, pinia } = await openView(makeDeps(fake));
    view.requestFallowRun();
    expect(useAnalysisStore(pinia).runRequested).toBe(true);
    await flushPromises();
    expect(useCityStore(pinia).route).toBe('sources');
    fake.setState('p1', RUNNING);
    expect([view.isAnalysisActive(), view.isAnalysisCancellable()]).toEqual([true, true]);
    view.cancelAnalysis();
    expect(fake.calls).toContainEqual({ method: 'cancel', profileId: 'p1' });
    fake.setState('p1', { status: 'cancelling', identity: ID });
    expect([view.isAnalysisActive(), view.isAnalysisCancellable()]).toEqual([true, false]);
    await view.onClose();
  });
});
```

(`makePluginDouble` is folded into the shared fixture by Task 7, G1.) Pins on behaviour that holds; mutations: drop `this.pinia &&` from `isAnalysisActive` (the first case throws), drop `this.hasSnapshot()` from `requestFallowRun` (the second case raises the request).

**C14 — busy-step inertness untested; C15 — no wiring test for Z36.** No code change: the C14 and C15 cases below pin what the dialog, the panel and the store already do.

`tests/component/fallow-run-polish.test.ts` (new; the header says "Polish C3–C6, C14, C15, C17: the run panel's hints, focus after a command, the installed route's focus and alert, busy-step inertness, nothing running on mount, and the clock"), with `mountS(provide = {})` accepting extra provides, `setup()`, `RUNNING`, `BOUND` as in `tests/component/connect-fallow-routes.test.ts` lines 25–45 plus the `pick` helper from `tests/component/connect-fallow.test.ts` lines 40–49:

```ts
describe('Polish C3: the cancelling hint', () => {
  it('a blocked Cancel while cancelling is described by the cancelling hint, not the busy hint', async () => {
    const { fake } = setup();
    fake.setState('p1', { status: 'cancelling', identity: RUNNING.identity });
    const w = mountS();
    await flushPromises();
    const cancel = w.find('.ci-fallow-run__cancel');
    expect(cancel.attributes('aria-disabled')).toBe('true');
    expect(document.getElementById(cancel.attributes('aria-describedby')!)?.textContent?.trim()).toBe(FALLOW_RUN_CANCELLING_HINT);
    w.unmount();
  });
});

describe('Polish C4: focus after a command-started run', () => {
  it('lands on Cancel analysis, not on the blocked Import', async () => {
    const { fake } = setup();
    fake.run = (id) => { fake.setState(id, RUNNING); return Promise.resolve({ kind: 'started' }); };
    const w = mountS();
    await flushPromises();
    useAnalysisStore().requestRun();
    await flushPromises();
    expect(document.activeElement).toBe(w.find('.ci-fallow-run__cancel').element);
    w.unmount();
  });
});

describe('Polish C5, C6: the installed route\'s focus and alert', () => {
  it('C5: a refused auto-check leaves focus on the route heading, never on <body>', async () => {
    const { fake } = setup();
    fake.setBinding('p1', BOUND);
    fake.next.review = { ok: false, code: 'executable-missing', detail: '' };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-card__import').trigger('click');
    await flushPromises();
    await w.find('.ci-connect-fallow__use-installed').trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(w.find('.ci-fallow-installed h3').element);
    w.unmount();
  });

  it('C6: its alert sits above its actions, as on the import route', async () => {
    const { fake } = setup();
    fake.next.review = { ok: false, code: 'executable-missing', detail: '' };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__path').setValue('C:\\nope\\fallow.exe');
    await w.find('.ci-fallow-installed__check').trigger('click');
    await flushPromises();
    const alert = w.find('[role="alert"]').element;
    const actions = w.find('.ci-fallow-installed .ci-connect-fallow__actions').element;
    expect(w.findAll('[role="alert"]')).toHaveLength(1);
    expect(alert.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    w.unmount();
  });
});

describe('Polish C14: a busy step and a running analysis are inert', () => {
  it('Escape, Cancel and the backdrop leave the dialog open while a check is in flight', async () => {
    const { fake } = setup();
    const answers: ((result: ReviewResult) => void)[] = [];
    fake.review = () => new Promise((resolve) => { answers.push(resolve); });
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__path').setValue('C:\\Tools\\fallow\\fallow.exe');
    await w.find('.ci-fallow-installed__check').trigger('click');
    await w.find('.ci-dialog').trigger('keydown', { key: 'Escape' });
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    await w.find('.ci-dialog__backdrop').trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    answers[0]!({ ok: false, code: 'executable-missing', detail: '' });
    await flushPromises();
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });

  it('Choose and Forget presses while running open nothing and forget nothing', async () => {
    const { fake } = setup();
    fake.setBinding('p1', BOUND);
    fake.setState('p1', RUNNING);
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await w.find('.ci-fallow-run__forget').trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    expect(fake.calls.map((c) => c.method)).not.toContain('forget');
    w.unmount();
  });

  it('Enter in the path input checks the path', async () => {
    const { fake } = setup();
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__choose').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__path').setValue('C:\\Tools\\fallow\\fallow.exe');
    await w.find('.ci-fallow-installed__path').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(fake.calls.map((c) => c.method)).toContain('review');
    w.unmount();
  });
});

describe('Polish C15 (Z36): nothing runs on bind or mount', () => {
  it('binding the store and mounting Data & scans only read the binding', async () => {
    const { fake } = setup();
    const w = mountS();
    await flushPromises();
    const methods = fake.calls.map((c) => c.method);
    expect(methods.length).toBeGreaterThan(0);
    expect(methods.every((m) => m === 'readBinding')).toBe(true);
    w.unmount();
  });
});

describe('Polish C17 (Y27): the import takes its time from the host clock', () => {
  it('an attached report is stamped with the provided clock', async () => {
    const { snap } = setup();
    const w = mountS({ now: () => new Date('2026-09-23T12:34:56.000Z') });
    await flushPromises();
    await w.find('.ci-fallow-card__import').trigger('click');
    await flushPromises();
    await pick(w, syntheticFallowJson(snap));
    await w.find('.ci-connect-fallow__attach').trigger('click');
    await flushPromises();
    expect(useEvidenceStore().report?.importedAt).toBe('2026-09-23T12:34:56.000Z');
    w.unmount();
  });
});
```

RED: C3 (describedby is the busy hint), C4 (focus on `<body>`), C5 (focus on `<body>`), C6 (the alert follows the actions), C17 (the wall-clock time). C14 and C15 pin behaviour that holds; mutations: drop `if (props.action.busy.value) return;` from the route's `cancel` (C14 first case), drop `if (analysis.active) return;` from the panel's `forget` (second), drop `@keydown.enter.prevent="check"` (third), add `void analysis.startOrReview(snapshot)` to `SourcesScreen`'s setup (C15).

`tests/unit/fallow-run-read-model.test.ts`: "Polish C8: a thrown Run or Forget is the warning form with its text only" → `expect(failureBanner('x')).toEqual({ tone: 'warning', icon: 'alert-triangle', text: 'x', reason: null, kept: false, log: null });` (RED: no export). `tests/unit/fallow-run-copy.test.ts`: "Polish C9: a failed Forget says the executable stays chosen and trusted" → `expect(FALLOW_EXE_FORGET_FAILED).toContain('It stays chosen and trusted for this codebase.');` (RED). `tests/host/analysis-notices.test.ts`: "Polish C12: two codebases failing in turn are each told once per run" (p1 r1, p2 r2, p1 r1 again, p1 r3 → three notices); the leak itself is not observable, so the check is `grep -n "new Set" src/host/analysis-notices.ts` printing nothing.

- [ ] **Step 1: Write the failing tests.**
- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/component/fallow-run-polish.test.ts tests/host/city-view-analysis.test.ts tests/unit/fallow-run-read-model.test.ts tests/unit/fallow-run-copy.test.ts tests/host/analysis-notices.test.ts`
Expected: FAIL as listed; run the named mutations for C14, C15 and C16 and paste both runs.

- [ ] **Step 3: Implement** C3–C9, C12, C17, C19.
- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/component/fallow-run-polish.test.ts tests/host/city-view-analysis.test.ts tests/unit/fallow-run-read-model.test.ts tests/unit/fallow-run-copy.test.ts tests/host/analysis-notices.test.ts tests/component/fallow-run-panel.test.ts tests/component/connect-fallow-routes.test.ts tests/component/connect-fallow.test.ts tests/component/collected-evidence.test.ts tests/component/fallow-binding-truth.test.ts tests/host/fallow-commands.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/ui/screens/sources src/ui/screens/SourcesScreen.vue src/ui/read-models/fallow-run.ts src/ui/audit-copy/fallow-run.ts src/ui/audit-copy/fallow.ts src/host/analysis-notices.ts tests/component/fallow-run-polish.test.ts tests/host/city-view-analysis.test.ts tests/unit/fallow-run-read-model.test.ts tests/unit/fallow-run-copy.test.ts tests/host/analysis-notices.test.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add src/ui/screens/sources/FallowRunPanel.vue src/ui/screens/sources/FallowInstalledRoute.vue src/ui/screens/sources/ConnectFallowDialog.vue src/ui/screens/SourcesScreen.vue src/ui/read-models/fallow-run.ts src/ui/audit-copy/fallow-run.ts src/ui/audit-copy/fallow.ts src/host/analysis-notices.ts tests/component/fallow-run-polish.test.ts tests/host/city-view-analysis.test.ts tests/unit/fallow-run-read-model.test.ts tests/unit/fallow-run-copy.test.ts tests/host/analysis-notices.test.ts
git commit -m "fix(ui): run panel hints and focus, the installed route's alert and focus, the host clock, and pins for busy steps, mount and the CityView delegations (polish C3-C9, C12, C14-C17, C19)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Settings (D1–D5)

Model tier: **standard**.

**Files:**
- Modify: `src/host/settings-tab.ts` (274): imports (8–22), the constructor (37–53), `showFailure` (93–99), `deleteProfile` (143–152), `forgetAnalyzer` (155–162), `changeAnalyzerTimeout` (166–174), `notify` (176–179)
- Modify: `src/main.ts` (124): the settings tab construction (90–91)
- Modify: `src/ui/audit-copy/fallow-run.ts` (after 3b): after `SETTINGS_FALLOW_BUSY` (169)
- Modify: `tests/component/settings-fallow.test.ts` (151 → ~185), `tests/component/settings-tab-purge.test.ts` (84 → ~130), `tests/component/settings-tab-validation.test.ts` (217, one argument), `tests/component/settings-tab.test.ts` (436, one argument, in place), `tests/host/plugin-onload.test.ts` (231, one argument)

**Interfaces:**
- Consumes: `AnalyzerStoreError`, `AnalyzerStoreErrorCode` (`analyzer-record.ts`); `EvidenceRepository` (port); `InMemoryEvidenceStore`; `emptyEvidenceReport`.
- Produces: see the outline (Task 4).

**D1, D2.** Copy (`audit-copy/fallow-run.ts`; `import type { AnalyzerStoreErrorCode } from '../../application/analysis/analyzer-record';` joins the imports):

```ts
/** Polish D1: a refused analyzer write in Settings, by AnalyzerStoreError code — never the
 *  store's own "analyzer store: <code>" message. */
export const SETTINGS_FALLOW_STORE_FAILED: Readonly<Record<AnalyzerStoreErrorCode, string>> = {
  unsupported: FALLOW_EXE_UNSUPPORTED,
  'not-bound': 'No fallow executable is chosen for this codebase any more, so nothing was changed.',
  changed: 'The fallow executable setting changed while this was saved, so nothing was changed. Check it and try again.',
};
```

Settings tab:

```ts
  /** Every reason on one line, in a Notice. Polish D2: built by `notify`, the one Notice maker. */
  private showFailure(e: unknown, describe?: (reason: string) => string): void {
    const reason = validationFailureText(e);
    this.notify(describe ? describe(reason) : reason);
  }

  /** Polish D1: a refused analyzer write names its reason in words; any other error is shown
   *  as every other failure is. */
  private showAnalyzerFailure(e: unknown): void {
    if (e instanceof AnalyzerStoreError) { this.notify(SETTINGS_FALLOW_STORE_FAILED[e.code]); return; }
    this.showFailure(e);
  }
```

`forgetAnalyzer` and `changeAnalyzerTimeout` call `this.showAnalyzerFailure(e)` in their `catch`.

**D4, D5.** The constructor gains, after `analysis`:

```ts
    // Polish D5 (L22): the plugin's one session evidence repository, so a removed codebase's
    // findings go with it (main.ts passes its instance).
    private readonly evidence: Pick<EvidenceRepository, 'remove'>,
```

and `deleteProfile` becomes:

```ts
  private async deleteProfile(id: string): Promise<void> {
    // Polish D4: a failed removal is shown, keeps everything, and the list refreshes. The list's
    // onDelete calls this with `void`, so a rejection here was unhandled.
    try {
      await this.profileStore.remove(id);
    } catch (e) {
      this.showFailure(e);
      await this.refresh();
      return;
    }
    // Part 6 Y17: only once the profile is gone, so a failed removal keeps both. A failed
    // purge says the profile went but its review decisions stayed, with the reason (spec 7,
    // E29); the list refreshes.
    await this.reviewRegistry.purge(id).catch((e: unknown) => { this.showFailure(e, PROFILE_REVIEW_PURGE_FAILED); });
    // Part 7 Z11: and its fallow executable setting, whatever its format (a run in flight is cancelled).
    await this.analysis.purgeProfile(id).catch((e: unknown) => { this.showFailure(e, PROFILE_ANALYZER_PURGE_FAILED); });
    // Polish D5: and its session evidence, last, for this profile only.
    try {
      this.evidence.remove(id);
    } catch (e) {
      this.showFailure(e);
    }
    await this.refresh();
  }
```

`main.ts` passes `evidenceStore` as the eighth argument. Every test construction site appends `{ remove: vi.fn() }` as the eighth argument (in place; `vi` joins the file's vitest import where missing): `settings-fallow.test.ts:37`, `settings-tab-purge.test.ts:34`, `settings-tab-validation.test.ts:24`, `settings-tab.test.ts:43` (436 → 436), `plugin-onload.test.ts:164`. In `settings-tab-purge.test.ts`, `newTab` gains an options parameter: `function newTab(profileStore: ProfileStore, registry: Pick<ReviewRepositoryRegistry, 'purge'>, options: { analysis?: FakeFallowAnalysis; evidence?: Pick<EvidenceRepository, 'remove'> } = {})`, passing `options.analysis ?? createFakeFallowAnalysis()` and `options.evidence ?? { remove: vi.fn() }`.

**D3 — the two catch paths untested.** No code change beyond D1: the D3 case below pins `changeAnalyzerTimeout`'s catch, and D1's case pins `forgetAnalyzer`'s.

Pins — `tests/component/settings-fallow.test.ts`:

```ts
describe('Polish D1, D3: a failed Forget or time limit is shown in words', () => {
  it('D1: a refused Forget shows the reason, never "analyzer store: not-bound"', async () => {
    const { tab, analysis } = await makeTab(BOUND);
    vi.spyOn(analysis, 'forget').mockRejectedValue(new AnalyzerStoreError('not-bound'));
    render(tab, 'fallow executable').controlEl.querySelector('button')!.click();
    await tab.waitForPendingUpdates();
    expect(document.querySelector('.notice')?.textContent).toBe(SETTINGS_FALLOW_STORE_FAILED['not-bound']);
  });

  it('D3: a time limit whose write throws an ordinary error shows that error and refreshes', async () => {
    const { tab, analysis } = await makeTab(BOUND);
    vi.spyOn(analysis, 'setTimeLimit').mockRejectedValue(new Error('Could not write data.json.'));
    const refresh = vi.spyOn(tab, 'refresh');
    const input = render(tab, 'fallow time limit').controlEl.querySelector('input')!;
    input.value = '600';
    input.dispatchEvent(new Event('change'));
    await tab.waitForPendingUpdates();
    expect(document.querySelector('.notice')?.textContent).toBe('Could not write data.json.');
    expect(refresh).toHaveBeenCalled();
  });
});
```

(The Forget button and the time-limit input are reached exactly as the file's existing "Forget" and "time limit" cases reach them; if their selectors differ, use those cases' selectors.) RED: D1 shows `analyzer store: not-bound`. D3 pins held behaviour; mutation: delete the `try`/`catch` in `changeAnalyzerTimeout` → an unhandled rejection and no Notice.

`tests/component/settings-tab-purge.test.ts`: replace the case "never purges when removing the profile fails" (its comment says the missing catch is deferred, U47) with

```ts
  it('Polish D4: a failed removal is shown, keeps the profile, and purges and removes nothing', async () => {
    const { store } = createFakeProfileStoreHarness();
    await store.save(profile('p1'));
    vi.spyOn(store, 'remove').mockRejectedValue(new Error('Could not write data.json.'));
    const purge = vi.fn<(repositoryId: string) => Promise<void>>(() => Promise.resolve());
    const evidence = { remove: vi.fn() };
    const tab = newTab(store, { purge }, { evidence });
    await tab.refresh();
    findList(tab.getSettingDefinitions()).onDelete!(0);
    await flushPromises();
    expect(document.querySelector('.notice')?.textContent).toBe('Could not write data.json.');
    expect(purge).not.toHaveBeenCalled();
    expect(evidence.remove).not.toHaveBeenCalled();
    expect(findList(tab.getSettingDefinitions()).items).toHaveLength(1);
  });

  it('Polish D5: removes only the removed profile\'s session evidence, after the analyzer purge', async () => {
    const { store } = createFakeProfileStoreHarness();
    await store.save(profile('p1'));
    await store.save(profile('p2'));
    const evidence = new InMemoryEvidenceStore();
    evidence.put('p1', emptyEvidenceReport('s1'));
    evidence.put('p2', emptyEvidenceReport('s2'));
    const analysis = createFakeFallowAnalysis();
    const purge = vi.spyOn(analysis, 'purgeProfile');
    const remove = vi.spyOn(evidence, 'remove');
    const tab = newTab(store, { purge: () => Promise.resolve() }, { analysis, evidence });
    await tab.refresh();
    const index = findList(tab.getSettingDefinitions()).items!.findIndex((item) => 'name' in item && item.name === 'p1');
    findList(tab.getSettingDefinitions()).onDelete!(index);
    await flushPromises();
    expect(evidence.get('p1')).toBeNull();
    expect(evidence.get('p2')).not.toBeNull();
    expect(remove.mock.calls).toEqual([['p1']]);
    expect(purge.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]!);
  });
```

(If a list item's name is not its `name` property, use the index of `profile('p1')` in `store.list()` order, which the existing first case relies on: `onDelete!(0)` removes the first saved profile.) RED: D4 rejects unhandled (the test sees no Notice); D5 leaves p1's evidence.

- [ ] **Step 1: Write the failing tests**, and add the eighth argument at every construction site (the typecheck then fails until the constructor has it: that is D5's first RED).
- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/component/settings-fallow.test.ts tests/component/settings-tab-purge.test.ts`
Expected: FAIL — D1, D4, D5; run D3's mutation and paste both runs.

- [ ] **Step 3: Implement** D1–D5.
- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/component/settings-fallow.test.ts tests/component/settings-tab-purge.test.ts tests/component/settings-tab-validation.test.ts tests/component/settings-tab.test.ts tests/host/plugin-onload.test.ts tests/component/settings-screen.test.ts tests/component/settings-privacy-storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/host/settings-tab.ts src/main.ts src/ui/audit-copy/fallow-run.ts tests/component/settings-fallow.test.ts tests/component/settings-tab-purge.test.ts tests/component/settings-tab-validation.test.ts tests/component/settings-tab.test.ts tests/host/plugin-onload.test.ts --max-warnings 0`
Expected: exit 0. `wc -l tests/component/settings-tab.test.ts` prints 436.

- [ ] **Step 6: Commit.**

```
git add src/host/settings-tab.ts src/main.ts src/ui/audit-copy/fallow-run.ts tests/component/settings-fallow.test.ts tests/component/settings-tab-purge.test.ts tests/component/settings-tab-validation.test.ts tests/component/settings-tab.test.ts tests/host/plugin-onload.test.ts
git commit -m "fix(settings): analyzer failures in words, one Notice builder, a handled profile removal, and a purge that removes the profile's session evidence (polish D1-D5)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5a: Evidence truth and accessibility (E2, E3, E4, E11, E12, E13)

Model tier: **most capable** (E4 is a cross-leaf race).

**Files:**
- Create: `src/ui/read-models/severity.ts` (~12) — **extended by Task 5b**
- Modify: `src/ui/read-models/evidence-index.ts` (154): lines 38–40
- Modify: `src/ui/read-models/findings.ts` (165): after `openFindingsValue` (126–131)
- Modify: `src/ui/read-models/overview.ts` (151): the signature (93–98) and lines 102–104
- Modify: `src/ui/read-models/use-read-models.ts` (186): `overviewModelFor` (45–58)
- Modify: `src/ui/stores/review-buckets.ts` (160): `reloadIfBound` (67–69) exported
- Modify: `src/ui/stores/review-store.ts` (329): `addWorkItem` (159–184), `addRule` (265–281), `decide` (291–304) — **shared with Task 5b**, which edits `replaceAll`, `removeRule` and `load`
- Modify: `src/ui/audit-copy/fallow.ts` (after 3b): `nounCount` (126) and after `LENS_LIST_NONE` (190)
- Modify: `src/ui/components/CodebaseFileListGroup.vue` (156): `reportedText` (78–81)
- Modify: `src/ui/read-models/use-lens-view.ts` (37): line 18
- Modify: `src/ui/read-models/snapshot-comparison.ts` (76): lines 12–17
- Modify: `src/ui/screens/QualityScreen.vue` (217): a watcher after the severity watcher (62)
- Create: `tests/unit/review-store-races.test.ts` (~140), `tests/component/quality-focus-swap.test.ts` (~80)
- Modify: `tests/unit/evidence-index.test.ts` (199 → ~220), `tests/component/findings-lens.test.ts` (293 → ~303), `tests/component/evolution-screen.test.ts` (208 → ~211)

**Interfaces:**
- Consumes: `buildQualityModel`, `openFindingsValue`, `QualityModel`, `hasValue` (`ui/evidence.ts`), `FindingDisposition`, `createInMemoryReviewRepository`, `ownWrite`, `bucketFor`, `attachSyntheticReport`, `emptyEvidenceReport`.
- Produces: see the outline (Task 5a).

**E2 — the caption counts decided findings.** `src/ui/read-models/severity.ts`:

```ts
// Polish E2 (and E8, Task 5b): fallow's severity words, in one place. `high` is the tool's two
// top severities (Part 6 Y34).
export const HIGH_SEVERITIES: readonly string[] = ['critical', 'high'];

export function isHighSeverity(severity: string | null): boolean {
  return severity !== null && HIGH_SEVERITIES.includes(severity);
}
```

`evidence-index.ts` drops its local `HIGH_SEVERITIES` and uses `const isHigh = (f: EvidenceFinding): boolean => isHighSeverity(f.severity);`. `findings.ts`:

```ts
/** Polish E2: the Overview's "critical or high" over OPEN findings only (as openFindingsValue),
 *  in the state and provenance of the index's own high count: unknown stays unknown, never 0. */
export function openHighFindingsValue(model: QualityModel): MetricValue {
  const all = model.evidence.totals.high;
  if (!hasValue(all)) return all;
  return { ...all, value: model.findings.filter((f) => f.status === 'open' && isHighSeverity(f.severity)).length };
}
```

`buildOverviewModel`'s fifth parameter becomes `quality: QualityModel = buildQualityModel(files, evidence, [])`, with `const findings = openFindingsValue(quality);` and `const high = openHighFindingsValue(quality);` (its comment: "Part 6 E48 (I1), Polish E2: both the count and its caption read the Quality model's OPEN findings"). `overviewModelFor` passes `qualityModelFor(files, evidence, dispositions)` instead of its `open` value.

Pin (`tests/unit/evidence-index.test.ts`; 20 files give 10 complexity findings, cycling critical, high, moderate, so 7 are critical or high):

```ts
describe('Polish E2: the Overview caption counts open findings only', () => {
  it('a dismissed critical finding leaves the caption as it leaves the count', () => {
    const index = evidenceIndexFor(files, report, snap.snapshotId);
    const highs = buildQualityModel(files, index, []).findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
    expect(highs).toHaveLength(7);
    const dismissed: FindingDisposition[] = [{ fingerprint: highs[0]!.fingerprint, status: 'dismissed', reason: 'accepted', decidedAt: '2026-09-23T10:00:00.000Z' }];
    const card = buildOverviewModel(snap, files, undefined, index, buildQualityModel(files, index, dismissed)).cards.find((c) => c.id === 'findings')!;
    expect(card.caption).toBe(OVERVIEW_FINDINGS_CAPTION('6'));
  });
});
```

RED: `7` (the parameter is ignored and the caption reads `evidence.totals.high`).

**E3 — `decide()` has no ready gate.** `decide`'s refusal line becomes `if (!this.ready || this.bulkBusy || this.isDispositionPending(fp)) return null;` (its comment: "Polish E3: refused before the bound codebase is read, as the adds are (Y10)").

**E4 — a stale-leaf upsert resurrects.** Export `reloadIfBound` from `review-buckets.ts` (unchanged body). In `addWorkItem`, `addRule` and `decide`, read the bucket's ticket before the write and upsert only when no load started during it:

```ts
      const bucket = bucketFor(this.bucketState, codebase);
      const ticket = bucket.loadTicket;
      reserve(this.pending, codebase, 'fingerprint', fp);
      try {
        await ownWrite(bucket, () => repo.saveDisposition(disposition), this);
        if (this.repository === repo) {
          // Polish E4 (L16): a load that started during this write reflects another leaf's
          // change; an upsert now could put back what that change removed. Reload instead.
          if (bucket.loadTicket !== ticket) reloadIfBound(this, bucket);
          else this.dispositions = [...this.dispositions.filter((d) => d.fingerprint !== fp), disposition];
        }
        return disposition;
      } finally {
        release(this.pending, codebase, 'fingerprint', fp);
      }
```

(`addWorkItem`: `if (bucket.loadTicket !== ticket) reloadIfBound(this, bucket); else if (!this.workItems.some((w) => w.id === item.id)) this.workItems.push(item);`; `addRule` likewise with `rules`.)

Pins — `tests/unit/review-store-races.test.ts` (new):

```ts
// Polish E3, E4: the review store refuses a decision before its codebase is read, and never puts
// back what another leaf removed while its own write was in flight.
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import {
  createInMemoryReviewRepository, type FindingDisposition, type ReviewRepository,
} from '../../src/ui/stores/ports/review-repository';

const AT = '2026-09-23T10:00:00.000Z';
const DECISION: FindingDisposition = { fingerprint: 'src/a.ts#f1', status: 'acknowledged', decidedAt: AT };
const noop = (): void => {};

function gate(): { promise: Promise<void>; open: () => void } {
  let open: () => void = noop;
  const promise = new Promise<void>((resolve) => { open = resolve; });
  return { promise, open: () => { open(); } };
}

/** The same repository, whose disposition saves land (and notify) at once but resolve only
 *  when `until` opens: the notification window a slow disk opens. */
function delayedSaves(inner: ReviewRepository, until: Promise<void>): ReviewRepository {
  return {
    listWorkItems: () => inner.listWorkItems(), saveWorkItem: (i) => inner.saveWorkItem(i), removeWorkItem: (id) => inner.removeWorkItem(id),
    listRules: () => inner.listRules(), saveRule: (r) => inner.saveRule(r), removeRule: (id) => inner.removeRule(id),
    listDispositions: () => inner.listDispositions(),
    saveDisposition: async (d) => { await inner.saveDisposition(d); await until; },
    removeDisposition: (fp) => inner.removeDisposition(fp), replaceAll: (s) => inner.replaceAll(s),
    allocateId: (k) => inner.allocateId(k), subscribe: (l) => inner.subscribe(l), diagnostics: () => inner.diagnostics(),
  };
}

describe('Polish E3: decide waits for the bound codebase to be read', () => {
  it('a decision before the read lands is refused, and nothing is saved', async () => {
    const repo = createInMemoryReviewRepository();
    const read = gate();
    const list = repo.listDispositions.bind(repo);
    repo.listDispositions = async () => { await read.promise; return list(); };
    const save = vi.spyOn(repo, 'saveDisposition');
    const store = useReviewStore(createPinia());
    store.setRepositoryFactory(() => repo);
    const binding = store.bindRepository('c1');
    expect(store.ready).toBe(false);
    expect(await store.decide(DECISION)).toBeNull();
    expect(save).not.toHaveBeenCalled();
    read.open();
    await binding;
    expect(await store.decide(DECISION)).toEqual(DECISION);
  });
});

describe('Polish E4: an own write never resurrects what another leaf removed', () => {
  it('a decision another leaf reopened during this leaf\'s save is not put back', async () => {
    const shared = createInMemoryReviewRepository();
    const slow = gate();
    const a = useReviewStore(createPinia());
    const b = useReviewStore(createPinia());
    a.setRepositoryFactory(() => delayedSaves(shared, slow.promise));
    b.setRepositoryFactory(() => shared);
    await a.bindRepository('c1');
    await b.bindRepository('c1');
    const deciding = a.decide(DECISION);
    await flushPromises();
    expect(b.dispositions).toEqual([DECISION]);
    expect(await b.reopen(DECISION.fingerprint)).toBe(true);
    await flushPromises();
    slow.open();
    expect(await deciding).toEqual(DECISION);
    await flushPromises();
    expect(a.dispositions).toEqual([]);
    expect(await shared.listDispositions()).toEqual([]);
  });
});
```

RED: E3 saves (`save` called); E4 ends with `a.dispositions` equal to `[DECISION]`.

**E11 — shown and spoken counts differ.** `audit-copy/fallow.ts`: `nounCount` becomes `const nounCount = (n: number, one: string, many: string): string => \`${formatCount(n)} ${n === 1 ? one : many}\`;` with `const formatCount = (n: number): string => n.toLocaleString('en-US');` above it; after `LENS_LIST_NONE`:

```ts
/** Polish E11: the Reported cell's visible text, formatted exactly as LENS_LIST_CELL speaks it;
 *  none is an em dash, never a 0 that could read as "measured clean". */
export const LENS_LIST_TEXT = (count: number | null): string => (count === null || count === 0 ? LENS_LIST_NONE : formatCount(count));
```

`CodebaseFileListGroup.vue`'s `reportedText` returns `LENS_LIST_TEXT(count)` (import it; drop `LENS_LIST_NONE` if unused). `use-lens-view.ts` line 18 becomes `hit = new Set(index.byFile.keys());` with the comment "`groupByFile` creates a file's entry with its first finding, so none is empty (Polish E11)". Pin (`tests/component/findings-lens.test.ts`):

```ts
describe('Polish E11: the Reported count reads the same shown and spoken', () => {
  it('groups thousands in both, and shows none as a dash', () => {
    expect(LENS_LIST_TEXT(12_345)).toBe('12,345');
    expect(LENS_LIST_CELL(12_345)).toBe(', 12,345 reported findings');
    expect(LENS_LIST_TEXT(0)).toBe(LENS_LIST_NONE);
    expect(LENS_LIST_TEXT(null)).toBe(LENS_LIST_NONE);
  });
});
```

RED: no `LENS_LIST_TEXT` export. The lens cell cases (lines 280–282) stay green; `grep -n "String(count)" src/ui/components/CodebaseFileListGroup.vue` prints nothing.

**E12 — two scans in one minute share a label.** `snapshotEntryLabel` (L18):

```ts
/** The one label for a journal entry (journal rows, comparison options, the Compare buttons'
 *  descriptions): capture date plus UTC HH:MM:SS. Polish E12: seconds, so two scans in the
 *  same minute are told apart. */
export function snapshotEntryLabel(capturedAt: string): string {
  const d = new Date(capturedAt);
  return SNAPSHOT_ENTRY_LABEL(dateLabels(capturedAt, 1, 0)[0] ?? '', `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`);
}
```

Pin (`tests/component/evolution-screen.test.ts`): the existing expectation becomes `'Sep 22 · 09:05:00 UTC'`, and the case gains `expect(snapshotEntryLabel('2026-09-22T09:05:10.000Z')).not.toBe(snapshotEntryLabel('2026-09-22T09:05:40.000Z'));`. RED: both read `09:05`. Any other test that pins an `HH:MM UTC` journal label is updated the same way (`grep -rn " UTC'" tests/component tests/unit`).

**E13 — focus lost when the Quality panel swaps.** In `QualityScreen.vue`, after the severity watcher:

```ts
/** Polish E13 (L19): another leaf can remove the report, or replace it with one that reports
 *  nothing, while focus is inside the findings panel. The focused control unmounts; focus moves
 *  to what replaced it — NotAnalysed's Import, or the panel itself — never to <body>. */
watch([() => report.value === null, () => quality.value.findings.length === 0], async () => {
  const el = root.value;
  const active = el?.ownerDocument.activeElement ?? null;
  if (!el || !active || !el.querySelector('.ci-quality__panel')?.contains(active)) return;
  await nextTick();
  if (active.isConnected) return;
  (el.querySelector<HTMLElement>('.ci-not-analysed__import') ?? el.querySelector<HTMLElement>('.ci-quality__panel'))?.focus();
});
```

Pins — `tests/component/quality-focus-swap.test.ts` (new), mounting `QualityScreen` as `tests/component/quality-fallow.test.ts` does (its setup: a snapshot fixture on the city store and `attachSyntheticReport(snap)`):

```ts
describe('Polish E13: focus survives the findings panel being replaced', () => {
  it('removing the report while a Review button has focus moves focus to Import', async () => {
    const w = mountQuality();
    await flushPromises();
    (w.find('.ci-findings-table__open').element as HTMLElement).focus();
    expect(useEvidenceStore().remove()).toBe(true);
    await flushPromises();
    expect(document.activeElement).toBe(w.find('.ci-not-analysed__import').element);
    w.unmount();
  });

  it('a report that now reports nothing moves focus to the findings panel', async () => {
    const { snap, w } = mountQualityWithSnapshot();
    await flushPromises();
    (w.find('.ci-findings-table__open').element as HTMLElement).focus();
    expect(useEvidenceStore().attach(emptyEvidenceReport(snap.snapshotId))).toBe(true);
    await flushPromises();
    expect(document.activeElement).toBe(w.find('.ci-quality__panel').element);
    w.unmount();
  });
});
```

(`mountQuality()`/`mountQualityWithSnapshot()` are this file's two helpers: `setActivePinia(createPinia())` in `beforeEach`, a `buildSnapshotFixture({ files: 20 })` snapshot set on the city store with `computeLayout`, `attachSyntheticReport(snap)`, then `mount(QualityScreen, { attachTo: document.body })`.) RED: `document.activeElement` is `<body>`.

- [ ] **Step 1: Write the failing tests.**
- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/unit/evidence-index.test.ts tests/unit/review-store-races.test.ts tests/component/findings-lens.test.ts tests/component/evolution-screen.test.ts tests/component/quality-focus-swap.test.ts`
Expected: FAIL as listed.

- [ ] **Step 3: Implement** E2, E3, E4, E11, E12, E13.
- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/unit/evidence-index.test.ts tests/unit/review-store-races.test.ts tests/component/findings-lens.test.ts tests/component/evolution-screen.test.ts tests/component/quality-focus-swap.test.ts tests/unit/read-models.test.ts tests/unit/report-model.test.ts tests/unit/findings-model.test.ts tests/unit/review-store.test.ts tests/unit/review-dispositions.test.ts tests/unit/review-store-sync.test.ts tests/unit/review-per-codebase.test.ts tests/unit/review-work-items.test.ts tests/component/quality-screen.test.ts tests/component/quality-fallow.test.ts tests/component/overview-screen.test.ts`
Expected: PASS (a file in this list that does not exist is dropped from the command, and the report says so).

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/ui/read-models src/ui/stores/review-store.ts src/ui/stores/review-buckets.ts src/ui/audit-copy/fallow.ts src/ui/components/CodebaseFileListGroup.vue src/ui/screens/QualityScreen.vue tests/unit/evidence-index.test.ts tests/unit/review-store-races.test.ts tests/component/findings-lens.test.ts tests/component/evolution-screen.test.ts tests/component/quality-focus-swap.test.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add src/ui/read-models/severity.ts src/ui/read-models/evidence-index.ts src/ui/read-models/findings.ts src/ui/read-models/overview.ts src/ui/read-models/use-read-models.ts src/ui/read-models/use-lens-view.ts src/ui/read-models/snapshot-comparison.ts src/ui/stores/review-store.ts src/ui/stores/review-buckets.ts src/ui/audit-copy/fallow.ts src/ui/components/CodebaseFileListGroup.vue src/ui/screens/QualityScreen.vue tests/unit/evidence-index.test.ts tests/unit/review-store-races.test.ts tests/component/findings-lens.test.ts tests/component/evolution-screen.test.ts tests/component/quality-focus-swap.test.ts
git commit -m "fix(evidence): open-only high caption, a ready gate on decide, no resurrecting upsert, one count format, second-precision labels, and focus kept on a panel swap (polish E2-E4, E11-E13)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5b: The review store and adapter refactors, and review-save failures in words (E1, E5–E9, E14)

Model tier: **most capable** (E7 changes when data.json is written; E1 spans ten screens).

**Files:**
- Modify: `src/ui/stores/ports/review-repository.ts` (210): a new block after the imports — `ReviewStoreError`, `ReviewStoreErrorCode`
- Modify: `src/adapters/storage/plugin-data-review-repository.ts` (265): lines 30–54 (the class, the codes, the text map), 69–71 (`isPlainObject`), `absorb` (148–151), `write` (182–203), `writeList`/`save` (205–213), the three removals (221–229), `replaceAll` (230–237), `retire` (259–263)
- Modify: `src/adapters/storage/plugin-data-shape.ts` (113): `writePluginDataSlice` (61–72), `asUnknownArray` (108–113) removed
- Modify: `src/adapters/storage/plugin-data-binding-store.ts` (79), `src/adapters/storage/plugin-data-profile-store.ts` (45): the `asUnknownArray` import
- Create: `src/domain/plain-data.ts` (~15)
- Modify: `src/application/analysis/analyzer-record.ts` (127): `isPlainObject` (74–76) removed, imported
- Modify: `src/ui/read-models/review-record-codec.ts` (97): `listOf` (61) removed
- Modify: `src/ui/read-models/severity.ts` (after 5a), `src/ui/read-models/findings.ts` (after 5a): lines 19–45, `src/ui/read-models/evidence-index.ts` (after 5a): `counterFor` (44–55), `category` (111), a new `evidenceBadgeFor` after `evidenceBadgeOf`
- Modify: `src/ui/audit-copy/quality.ts` (144): `SEVERITY_LABEL`'s type (43)
- Create: `src/ui/read-models/review-failure.ts` (~20), `src/ui/screens/use-import-report.ts` (~15)
- Modify (E1, one `catch` each): `src/ui/components/FileInspector.vue` (55), `src/ui/screens/architecture/RuleEditor.vue` (39), `src/ui/screens/ArchitectureScreen.vue` (109), `src/ui/screens/dependencies/PackageDetailDialog.vue` (38), `src/ui/screens/FileDetailScreen.vue` (54), `src/ui/screens/OwnershipScreen.vue` (53), `src/ui/screens/quality/FindingReviewDialog.vue` (57), `src/ui/screens/TestsScreen.vue` (104), `src/ui/screens/workbench/WorkItemEditor.vue` (117, 130)
- Modify (E9): `src/ui/screens/QualityScreen.vue` (107–111, 154), `src/ui/screens/FileDetailScreen.vue` (61–64, 120), `src/ui/screens/quality/FindingReviewDialog.vue` (135), `src/ui/screens/city/LensHeading.vue` (45), `src/ui/screens/sources/FallowCardDetails.vue` (49)
- Modify: `src/ui/stores/review-store.ts` (after 5a): `load` (133–153), `replaceAll` (243–260), `removeRule` (283–288), `bindRepository` (121)
- Create: `tests/unit/review-failure.test.ts` (~60), `tests/unit/review-repository-writes.test.ts` (~110)
- Modify: `tests/contracts/review-repository.contract.ts` (423: the import line only, in place), `tests/unit/review-repository-registry.test.ts` (77: the import line), `tests/unit/review-replace-all.test.ts` (292 → ~315), `tests/component/tests-screen.test.ts` (167 → ~185) — **shared with Task 6** — `tests/unit/evidence-index.test.ts` (after 5a, → ~232)

**Interfaces:**
- Consumes: `REVIEW_STORE_FULL`, `REVIEW_STORE_UNSUPPORTED`, `REVIEW_SAVE_UNREPRESENTABLE` (`audit-copy/storage.ts`); `EvidenceBadgeProps`, `evidenceBadgeOf`; Task 5a's `severity.ts`.
- Produces: see the outline (Task 5b).

**E1 (L3).** Port module, after the imports:

```ts
/** Part 6 Y9/Y7, moved here by Polish E1 (L3): a refused review write — nothing was written and
 *  nobody was told. The durable adapter throws it; a screen maps its code to words
 *  (read-models/review-failure.ts) without importing the adapter. */
export type ReviewStoreErrorCode = 'full' | 'unsupported' | 'unrepresentable';

export class ReviewStoreError extends Error {
  readonly code: ReviewStoreErrorCode;

  constructor(code: ReviewStoreErrorCode, message = `review store: ${code}`) {
    super(message);
    this.name = 'ReviewStoreError';
    this.code = code;
  }
}
```

The adapter deletes its own `ReviewStoreErrorCode` and class, imports both from the port, keeps `ERROR_TEXT`, and adds `const refused = (code: ReviewStoreErrorCode): ReviewStoreError => new ReviewStoreError(code, ERROR_TEXT[code]);`; every `new ReviewStoreError('…')` becomes `refused('…')` (so `error.message` is unchanged). The two test imports change to `../../src/ui/stores/ports/review-repository`. `src/ui/read-models/review-failure.ts`:

```ts
// Polish E1 (amends U27, Part 6 spec §4 "screens keep generic"; L3): a review write the store
// refused names its reason; every other failure keeps the screen's own generic text.
import { ReviewStoreError, type ReviewStoreErrorCode } from '../stores/ports/review-repository';
import { REVIEW_SAVE_UNREPRESENTABLE, REVIEW_STORE_FULL, REVIEW_STORE_UNSUPPORTED } from '../inspector-copy';

const TEXT: Readonly<Record<ReviewStoreErrorCode, string>> = {
  full: REVIEW_STORE_FULL, unsupported: REVIEW_STORE_UNSUPPORTED, unrepresentable: REVIEW_SAVE_UNREPRESENTABLE,
};

export function reviewFailureText(e: unknown, fallback: string): string {
  return e instanceof ReviewStoreError ? TEXT[e.code] : fallback;
}
```

Each of the ten `catch {` blocks becomes `catch (e) {` with its message wrapped: `ADD_TO_PLAN_FAILED` → `reviewFailureText(e, ADD_TO_PLAN_FAILED)` (FileInspector, FileDetailScreen), `RULE_EDITOR_FAILED`, `RULE_REMOVE_FAILED`, `PACKAGE_REVIEW_FAILED`, `OWNERSHIP_ACTION_FAILED`, `FINDING_DECISION_FAILED`, `TESTS_PLAN_FAILED`, `WORK_SAVE_FAILED` (`await setError(reviewFailureText(e, WORK_SAVE_FAILED))`), `WORK_DELETE_FAILED`. `FileInspector.copyRelativePath`, `SourceContextPanel` and `FallowInstalledRoute` are not review writes and stay as they are.

Pins — `tests/unit/review-failure.test.ts` (new):

```ts
// Polish E1 (L3, U27 amended): a refused review write names its reason; nothing else does.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reviewFailureText } from '../../src/ui/read-models/review-failure';
import { ReviewStoreError } from '../../src/ui/stores/ports/review-repository';
import { REVIEW_SAVE_UNREPRESENTABLE, REVIEW_STORE_FULL, REVIEW_STORE_UNSUPPORTED } from '../../src/ui/inspector-copy';

const REVIEW_WRITERS: readonly string[] = [
  'src/ui/components/FileInspector.vue', 'src/ui/screens/architecture/RuleEditor.vue', 'src/ui/screens/ArchitectureScreen.vue',
  'src/ui/screens/dependencies/PackageDetailDialog.vue', 'src/ui/screens/FileDetailScreen.vue', 'src/ui/screens/OwnershipScreen.vue',
  'src/ui/screens/quality/FindingReviewDialog.vue', 'src/ui/screens/TestsScreen.vue', 'src/ui/screens/workbench/WorkItemEditor.vue',
];

describe('reviewFailureText (Polish E1)', () => {
  it('names each refusal in words', () => {
    expect(reviewFailureText(new ReviewStoreError('full'), 'generic')).toBe(REVIEW_STORE_FULL);
    expect(reviewFailureText(new ReviewStoreError('unsupported'), 'generic')).toBe(REVIEW_STORE_UNSUPPORTED);
    expect(reviewFailureText(new ReviewStoreError('unrepresentable'), 'generic')).toBe(REVIEW_SAVE_UNREPRESENTABLE);
  });

  it('Review Focus 2: any other failure keeps the screen\'s own text', () => {
    expect(reviewFailureText(new Error('disk'), 'generic')).toBe('generic');
    expect(reviewFailureText(Object.assign(new Error('x'), { code: 'full' }), 'generic')).toBe('generic');
    expect(reviewFailureText('full', 'generic')).toBe('generic');
  });

  it('every review-writing screen maps its failure', () => {
    expect(REVIEW_WRITERS.length).toBeGreaterThan(0);
    for (const file of REVIEW_WRITERS) expect(readFileSync(file, 'utf8'), file).toContain('reviewFailureText(');
  });

  it('WorkItemEditor maps both its save and its delete', () => {
    expect(readFileSync('src/ui/screens/workbench/WorkItemEditor.vue', 'utf8').split('reviewFailureText(').length - 1).toBe(2);
  });
});
```

and in `tests/component/tests-screen.test.ts`:

```ts
  it('Polish E1: a refused plan names its reason; any other failure keeps the generic text', async () => {
    withSnapshot(80);
    const w = mountT();
    const save = vi.spyOn(useReviewStore().repository, 'saveWorkItem');
    save.mockRejectedValueOnce(new ReviewStoreError('full'));
    await w.find('.ci-coverage-gaps__plan').trigger('click');
    await flushPromises();
    expect(w.find('.ci-tests__live').text()).toBe(REVIEW_STORE_FULL);
    save.mockRejectedValueOnce(new Error('disk'));
    await w.find('.ci-coverage-gaps__plan').trigger('click');
    await flushPromises();
    expect(w.find('.ci-tests__live').text()).toBe(TESTS_PLAN_FAILED);
    w.unmount();
  });
```

(`flushPromises` joins the `@vue/test-utils` import; `ReviewStoreError`, `REVIEW_STORE_FULL` and `TESTS_PLAN_FAILED` are imported.) RED: the module does not exist; the screen shows `TESTS_PLAN_FAILED` for `full`.

**E5.** `src/domain/plain-data.ts`:

```ts
// Polish E5 (L11): two structural checks on untrusted JSON, shared by every layer that decodes
// it (the analyzer record, the review adapter and codec, the plugin-data stores).
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `Array.isArray` narrows to `any[]` even from `unknown` (a lib.es5 quirk); this gives the
 *  narrowed branch an explicit `unknown[]`, so no `any` leaks into list code. */
export function asUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}
```

The two `isPlainObject` copies, `plugin-data-shape.ts`'s `asUnknownArray` and the codec's `listOf` are deleted; every user imports from `../../domain/plain-data`. Pure refactor: `grep -rn "function isPlainObject\|function asUnknownArray\|const listOf" src` prints only `src/domain/plain-data.ts`; the review, analyzer and profile store suites stay green.

**E6.** `write(change, options)`:

```ts
  interface WriteOptions { bounded: boolean; whole?: boolean }
  /** ONE slice write. `change` returns the lists it replaces, or null when it changes nothing
   *  (Polish E7). `bounded` applies the 1 MB limit; `whole` (replaceAll) starts from an empty set. */
  async function write(change: (set: RawSet) => RawSet | null, { bounded, whole = false }: WriteOptions): Promise<void> {
```

Call sites: `save` → `{ bounded: true }`, removals → `{ bounded: false }`, `replaceAll` → `{ bounded: true, whole: true }`. Pure refactor: `grep -n "true, true)" src/adapters/storage/plugin-data-review-repository.ts` prints nothing.

**E7 (L17).** `writePluginDataSlice`:

```ts
    const shape = data ?? {};
    const next = mutate(shape[key]);
    // Polish E7: a mutation that changed nothing (returned its input) is not written.
    if (next === shape[key]) return;
    shape[key] = next;
    await plugin.saveData(shape);
```

The adapter: a pure `raisedMarks(base: Readonly<Record<ReviewIdKind, number>>, set: RawSet): Record<ReviewIdKind, number>` returns `{ workItem: Math.max(base.workItem, storedMark(set, 'workItem'), highestRawId(set, 'workItem')), rule: … }`; `absorb(set)` becomes `Object.assign(marks, raisedMarks(marks, set)); seeded = true;`. Inside `write`'s mutation: `absorb(set)` stays (what is on disk is true either way); then `const changed = change(set); if (changed === null) return current;`; the merged set's marks are computed with `const high = raisedMarks(marks, merged);` (not absorbed), written into `highWater`, and stored in `saved.marks = high` only after the size check; after the `await`, `if (saved.marks) Object.assign(marks, saved.marks);` then `reading = null; lastWritten = saved.set; notify();` as today (a no-change removal still notifies once, Part 6 E8). The three removals use one helper:

```ts
  /** Polish E7: removes `id` from `key`; when nothing matched, nothing is written (it still
   *  notifies, like every successful removal, Part 6 E8). */
  function removeFrom(key: ListKey, field: 'id' | 'finding', id: string | null): Promise<void> {
    return write((set) => {
      const list = asUnknownArray(set[key]);
      const kept = id === null ? list : without(list, field, id);
      return kept.length === list.length ? null : { [key]: kept };
    }, { bounded: false });
  }
```

(`removeWorkItem: (id) => removeFrom('workItems', 'id', id)`, `removeRule` likewise, `removeDisposition` passes `storedFindingKey(…)`, which is `null` when nothing can match.) `retire()` also sets `lastDiagnostics = { skipped: 0, unsupported: true }; lastWritten = null;`.

Pins — `tests/unit/review-repository-writes.test.ts` (new):

```ts
// Polish E6, E7: the durable review adapter writes data.json only when something changed, never
// raises its id marks for a refused write, and a retired instance says it is read-only.
import { describe, expect, it, vi } from 'vitest';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { createPluginDataReviewRepository, deleteReviewSet } from '../../src/adapters/storage/plugin-data-review-repository';
import { NO_CHECKS, ReviewStoreError, type WorkItem } from '../../src/ui/stores/ports/review-repository';

function harness() {
  // One cast at the boundary, as review-repository.test.ts: the mock implements loadData/saveData only.
  const plugin = new Plugin({}, {}) as unknown as ObsidianPlugin;
  const save = plugin.saveData.bind(plugin);
  let saves = 0;
  plugin.saveData = (data: unknown): Promise<void> => { saves += 1; return save(data); };
  return { plugin, saves: () => saves, repo: createPluginDataReviewRepository(plugin, 'c1') };
}
const item = (n: number): WorkItem => ({
  id: `wi-${String(n).padStart(3, '0')}`, target: { kind: 'module', module: 'src' }, intent: 'review', title: `Item ${n}`,
  status: 'investigate', priority: 'medium', notes: 'n'.repeat(150), checks: NO_CHECKS, createdAt: '2026-09-23T10:00:00.000Z',
});

describe('Polish E7: no needless data.json writes', () => {
  it('a removal that removes nothing saves nothing, and still notifies once', async () => {
    const h = harness();
    await h.repo.listWorkItems();
    const heard = vi.fn();
    h.repo.subscribe(heard);
    const before = h.saves();
    await h.repo.removeWorkItem('wi-404');
    await h.repo.removeRule('AR-404');
    await h.repo.removeDisposition('src/a.ts#none');
    expect(h.saves()).toBe(before);
    expect(heard).toHaveBeenCalledTimes(3);
  });

  it('purging a codebase on a fresh install saves nothing', async () => {
    const h = harness();
    await deleteReviewSet(h.plugin, 'c1');
    expect(h.saves()).toBe(0);
  });
});

describe('Polish E7: a refused write leaves the id marks where they were', () => {
  it('a replaceAll refused as full does not move the next id', async () => {
    const h = harness();
    await h.repo.listWorkItems();
    const fresh = createPluginDataReviewRepository(h.plugin, 'c1');
    await fresh.listWorkItems();
    const many = Array.from({ length: 6_000 }, (_, i) => item(i + 1));
    await expect(h.repo.replaceAll({ workItems: many, rules: [], dispositions: [] })).rejects.toBeInstanceOf(ReviewStoreError);
    expect(h.repo.allocateId('workItem')).toBe(fresh.allocateId('workItem'));
  });
});

describe('Polish E7: a retired repository', () => {
  it('reports its set as read-only', () => {
    const h = harness();
    h.repo.retire();
    expect(h.repo.diagnostics()).toEqual({ skipped: 0, unsupported: true });
  });
});
```

(If `WorkItem`'s id format, the module target or `NO_CHECKS` differ from this sketch, build the item with the port's own helpers as `tests/contracts/review-repository.contract.ts` does; 6,000 items of ~250 bytes cross the 1 MB limit.) RED: saves counted, a jumped id, `unsupported: false`. E6 is a pure refactor (the grep above). If `tests/contracts/analyzer-binding-store.contract.ts` or another store test counted a save for a purge or removal that changed nothing, that expectation pinned the needless write: update it and record "Polish E<n>" (L17).

**E8.** `severity.ts` gains:

```ts
/** Polish E8: fallow's own severities plus `unrated`, in rank order (Part 6 Y35, R6). A word a
 *  later fallow adds is kept verbatim on a finding; it is just not in this list. */
export type FindingSeverity = 'critical' | 'high' | 'moderate' | 'unrated';
export const FINDING_SEVERITIES: readonly FindingSeverity[] = ['critical', 'high', 'moderate', 'unrated'];
```

and `HIGH_SEVERITIES` becomes `readonly FindingSeverity[]`. `findings.ts` drops its own `FindingSeverity` (no module imports it from there; `grep -rn "FindingSeverity" src tests` confirms) and imports it; `TONES` becomes `new Set<string>(FINDING_SEVERITIES)`. `SEVERITY_LABEL` in `audit-copy/quality.ts` is typed `Readonly<Record<FindingSeverity, string>>` (`import type { FindingSeverity } from '../read-models/severity';`). In `evidence-index.ts`, one module helper replaces both copies of the analysed test:

```ts
/** Polish E8: whether the report analysed `c`; the counter and `category()` both read it. */
const isAnalysed = (report: EvidenceReport | null, c: FindingCategory): boolean =>
  report !== null && report.normalized.categories[c] === 'analysed';
```

(`counterFor` uses `(c) => isAnalysed(report, c)`, and `category: (c) => (isAnalysed(report, c) ? 'analysed' : 'not-analysed')`.) Pure refactor: `grep -rn "'critical', 'high'" src` prints only `severity.ts`; the findings, evidence-index and quality suites stay green.

**E9.** `evidence-index.ts`, after `evidenceBadgeOf`:

```ts
/** Polish E9: the badge for an index's report in the index's own state, or none without one. */
export function evidenceBadgeFor(index: EvidenceIndex): EvidenceBadgeProps | null {
  return index.report === null ? null : evidenceBadgeOf(index.report, index.state === 'stale');
}
```

used by `QualityScreen.vue` (`<EvidenceBadge v-bind="evidenceBadgeFor(quality.evidence)!" />` inside its `v-if="report"`), `FileDetailScreen.vue:120` (`:badge="evidenceBadgeFor(quality.evidence)"`), `FindingReviewDialog.vue:135`, `LensHeading.vue:45` and `FallowCardDetails.vue:49` (each inside a `v-if` on the report: bind `evidenceBadgeFor(index)!`, or keep a local `computed` that returns the non-null value, whichever the implementer's eslint run accepts without `no-unnecessary-type-assertion`). `src/ui/screens/use-import-report.ts`:

```ts
// Polish E9 (Part 6 Y39): go to Data & scans and ask for the S14 dialog, exactly as the "Import
// analysis report" command does. Quality and File detail share it.
import { useCityStore } from '../stores/city-store';
import { useEvidenceStore } from '../stores/evidence-store';

export function useImportReport(): () => void {
  const city = useCityStore();
  const evidence = useEvidenceStore();
  return () => { city.navigate('sources'); evidence.requestImport(); };
}
```

(`QualityScreen` and `FileDetailScreen` replace their `importReport` function with `const importReport = useImportReport();` and drop an unused store.) Pin (`tests/unit/evidence-index.test.ts`): "Polish E9: evidenceBadgeFor is null without a report and stale for another snapshot's" — `expect(evidenceBadgeFor(evidenceIndexFor(files, null, snap.snapshotId))).toBeNull(); expect(evidenceBadgeFor(evidenceIndexFor(files, report, 'another'))?.state).toBe('stale');` (RED: no export). `grep -rn "evidenceBadgeOf(" src/ui/screens` prints nothing.

**E14.** `review-store.ts`: `removeRule` and `replaceAll` capture `const codebase = this.boundKey;` first and use it for `bucketFor(this.bucketState, codebase)` (and `replaceAll`'s `codebase === ''` refusal); `load` takes the bucket: `async load(bucket: ReviewBucket = bucketFor(this.bucketState, this.boundKey)): Promise<void>` and `bindRepository` calls `await this.load(target);` (`ReviewBucket` is imported as a type). `replaceAll` surfaces the first error:

```ts
    async replaceAll(state: ReviewReplaceState): Promise<boolean> {
      const codebase = this.boundKey;
      if (codebase === '' || !this.ready || this.loadFailed || this.hasPendingChanges) return false;
      this.bulkBusy = true;
      const repo = this.repository;
      let failure: { error: unknown } | null = null;
      try {
        await ownWrite(bucketFor(this.bucketState, codebase), () => repo.replaceAll(state), this);
      } catch (error: unknown) {
        failure = { error };
      }
      try {
        if (this.repository === repo) await this.load();
      } catch (reloadError: unknown) {
        // Polish E14: when the write failed too, the caller sees the write's own error.
        if (failure === null) throw reloadError;
      } finally {
        this.bulkBusy = false;
      }
      if (failure !== null) {
        if (this.repository === repo) throw failure.error;
        return false;
      }
      return this.repository === repo;
    },
```

Pin (`tests/unit/review-replace-all.test.ts`):

```ts
  it('Polish E14: when the write and the reload both fail, the caller sees the write\'s own error', async () => {
    const repo = createInMemoryReviewRepository();
    const store = useReviewStore();
    store.setRepositoryFactory(() => repo);
    await store.bindRepository('c1');
    vi.spyOn(repo, 'replaceAll').mockRejectedValue(new ReviewStoreError('full'));
    vi.spyOn(repo, 'listWorkItems').mockRejectedValue(new Error('read failed'));
    await expect(store.replaceAll({ workItems: [], rules: [], dispositions: [] })).rejects.toBeInstanceOf(ReviewStoreError);
    expect(store.bulkBusy).toBe(false);
  });
```

RED: the rejection is `read failed`. The file's existing replace-all cases (Part 5 E18–E20, Part 6 R1, Y16) stay green.

- [ ] **Step 1: Write the failing tests** (E1, E7, E9, E14) and change the two `ReviewStoreError` test imports to the port path.
- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/unit/review-failure.test.ts tests/unit/review-repository-writes.test.ts tests/unit/review-replace-all.test.ts tests/component/tests-screen.test.ts tests/unit/evidence-index.test.ts`
Expected: FAIL as listed.

- [ ] **Step 3: Implement** E1, E5, E6, E7, E8, E9, E14.
- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/unit/review-failure.test.ts tests/unit/review-repository-writes.test.ts tests/unit/review-replace-all.test.ts tests/component/tests-screen.test.ts tests/unit/evidence-index.test.ts tests/unit/review-repository.test.ts tests/unit/review-repository-registry.test.ts tests/unit/review-record-codec.test.ts tests/unit/analyzer-binding-store.test.ts tests/unit/profile-store.test.ts tests/unit/findings-model.test.ts tests/component/quality-screen.test.ts tests/component/quality-fallow.test.ts tests/component/file-findings-fallow.test.ts tests/component/fallow-card.test.ts tests/component/findings-lens.test.ts tests/component/workbench-screen.test.ts tests/component/architecture-rules.test.ts tests/component/ownership-screen.test.ts tests/component/settings-privacy-storage.test.ts`
Expected: PASS (a listed file that does not exist is dropped, and the report says so).

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/domain/plain-data.ts src/adapters/storage src/application/analysis/analyzer-record.ts src/ui/stores src/ui/read-models src/ui/audit-copy/quality.ts src/ui/components/FileInspector.vue src/ui/screens tests/unit/review-failure.test.ts tests/unit/review-repository-writes.test.ts tests/unit/review-replace-all.test.ts tests/component/tests-screen.test.ts tests/unit/evidence-index.test.ts tests/unit/review-repository-registry.test.ts tests/contracts/review-repository.contract.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add src/domain/plain-data.ts src/adapters/storage src/application/analysis/analyzer-record.ts src/ui/stores src/ui/read-models src/ui/audit-copy/quality.ts src/ui/components/FileInspector.vue src/ui/screens tests/unit/review-failure.test.ts tests/unit/review-repository-writes.test.ts tests/unit/review-replace-all.test.ts tests/component/tests-screen.test.ts tests/unit/evidence-index.test.ts tests/unit/review-repository-registry.test.ts tests/contracts/review-repository.contract.ts
git commit -m "refactor(review): review-save failures in words, shared plain-data checks, no needless or mark-raising writes, one severity table, and the first error surfaced (polish E1, E5-E9, E14)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The older WP-02 screens (F1–F5)

Model tier: **standard**.

**Files:**
- Modify: `src/ui/screens/architecture/BoundaryRuleTable.vue` (78): the imports (5–8), the table (39–77)
- Modify: `src/ui/screens/test-confidence/CoverageGapsTable.vue` (92): the imports (8–11), the table (46–81)
- Modify: `src/ui/inspector-copy.ts` (297): after `RULE_REMOVE_LABEL` (173)
- Modify: `src/ui/audit-copy/tests.ts` (72): after `TESTS_PLAN_LABEL` (43)
- Modify: `src/ui/styles/screens-explore.css` (138), `src/ui/styles/screens-audit.css` (180), `src/ui/styles/screens-configure.css` (111)
- Modify: `src/host/city-scan-controller.ts` (162): `cancelIfRunning` (116–118)
- Modify: `src/ui/audit-copy/shared.ts` (15), `src/ui/audit-copy/fallow.ts` (after 5a: 134, 142, a new review-step string), `src/ui/audit-copy/quality.ts` (87), `src/ui/audit-copy/settings.ts` (57, 95), `src/ui/audit-copy/workbench.ts` (63), `src/ui/inspector-copy.ts` (157)
- Modify: `src/ui/kit/Dialog.vue` (82): `onKeydown` (44–55)
- Modify: `src/ui/screens/sources/ConnectFallowDialog.vue` (after 3b): the review step (after its `<h3>`)
- Create: `src/ui/screens/sources/FallowRemoveDialog.vue` (~40)
- Modify: `src/ui/screens/SourcesScreen.vue` (after 3b): the Remove `CiDialog` (226–251) and its imports
- Create: `tests/component/dialog-trap.test.ts` (~70)
- Modify: `tests/component/architecture-rules.test.ts` (169 → ~195), `tests/component/tests-screen.test.ts` (after 5b, → ~205), `tests/component/status-surfaces.test.ts` (215 → ~218), `tests/component/connect-fallow.test.ts` (370 → ~380), `tests/unit/css-class-scope.test.ts` (139 → ~146)

**Interfaces:**
- Consumes: `EvidenceTable` (`interactive` prop), `RuleEvaluation`, `unknown` (`ui/evidence.ts`), `COPY_30_REVEAL_LABEL`, `COPY_30_CLEAR_LABEL`.
- Produces: see the outline (Task 6).

**F1 (V19, L20).** `BoundaryRuleTable.vue`: the `EvidenceTable` gets `:interactive="false"` and loses `@activate`; the actions cell becomes

```vue
    <template #cell-actions="{ row }">
      <button
        type="button"
        class="ci-rule-table__show"
        :aria-label="RULE_SHOW_LABEL(row.rule.id)"
        @click="emit('select', row.rule.id)"
      >
        {{ RULE_SHOW }}
      </button>
      <button
        type="button"
        class="ci-rule-table__remove"
        :aria-label="RULE_REMOVE_LABEL(row.rule.id)"
        @click="emit('remove', row.rule.id)"
      >
        {{ RULE_REMOVE }}
      </button>
    </template>
```

(the `.stop` modifiers and `@keydown.stop` go: there is no row handler left). Copy (`inspector-copy.ts`, after `RULE_REMOVE_LABEL`): `export const RULE_SHOW = 'Show';` and `export const RULE_SHOW_LABEL = (id: string): string => \`Show rule ${id}\`;`. `CoverageGapsTable.vue`: `:interactive="false"`, no `@activate`; the actions cell gains, before Plan tests, `<button type="button" class="ci-coverage-gaps__open" :aria-label="TESTS_OPEN_LABEL(row.name)" @click="emit('open', row.id)">{{ TESTS_OPEN }}</button>`, and Plan tests loses `.stop` and `@keydown.stop`. Copy (`audit-copy/tests.ts`): `export const TESTS_OPEN = 'Open file';` and `export const TESTS_OPEN_LABEL = (name: string): string => \`Open file ${name}\`;` (WCAG 2.5.3: the name contains the visible label). CSS: `:where(.codebase-inspector-root) .ci-rule-table__show { margin-inline-end: var(--ci-space-2); }` in `screens-explore.css` beside `.ci-rule-table__empty`; `:where(.codebase-inspector-root) .ci-coverage-gaps__open { margin-inline-end: var(--ci-space-2); }` in `screens-audit.css` beside `.ci-coverage-gaps__more`.

Pins (Review Focus 4). `tests/component/architecture-rules.test.ts`, mounting the table directly:

```ts
describe('Polish F1 (V19): the rule table', () => {
  const RULE: RuleEvaluation = {
    rule: { id: 'AR-001', from: 'ui', to: 'domain', rationale: 'Layering', createdAt: '2026-09-23T10:00:00.000Z' },
    status: 'not-evaluated', violatingImports: unknown('not evaluated'),
  };

  it('rule rows are static; Show selects the rule, a row click does not', async () => {
    const w = mount(BoundaryRuleTable, { props: { rules: [RULE] }, attachTo: document.body });
    const row = w.find('.ci-table__row');
    expect(row.classes()).toContain('ci-table__row--static');
    expect(row.attributes('tabindex')).toBeUndefined();
    await row.trigger('click');
    await row.trigger('keydown', { key: 'Enter' });
    expect(w.emitted('select')).toBeUndefined();
    const show = w.find('.ci-rule-table__show');
    expect(show.attributes('aria-label')).toBe(RULE_SHOW_LABEL('AR-001'));
    await show.trigger('click');
    expect(w.emitted('select')).toEqual([['AR-001']]);
    await w.find('.ci-rule-table__remove').trigger('click');
    expect(w.emitted('remove')).toEqual([['AR-001']]);
    expect(w.emitted('select')).toHaveLength(1);
    w.unmount();
  });
});
```

and `tests/component/tests-screen.test.ts`:

```ts
  it('Polish F1 (V19): gap rows are static; Open file opens the file, a row click does not', async () => {
    withSnapshot(80);
    const store = useCityStore();
    store.navigate('tests');
    const w = mountT();
    const row = w.find('.ci-coverage-gaps .ci-table__row');
    expect(row.attributes('tabindex')).toBeUndefined();
    await row.trigger('click');
    expect(store.route).toBe('tests');
    const open = w.find('.ci-coverage-gaps__open');
    expect(open.attributes('aria-label')!.startsWith('Open file')).toBe(true);
    await open.trigger('click');
    expect(store.route).toBe('file');
    expect(store.selectedEntityId).not.toBeNull();
    w.unmount();
  });
```

RED: rows are focusable and a row click emits or navigates; the buttons do not exist. Any existing case that clicks a row to select a rule or open a file is updated to click the new button (`grep -rn "ci-table__row" tests/component/architecture-rules.test.ts tests/component/tests-screen.test.ts tests/acceptance`), and the report lists each one.

**F2.** `screens-configure.css`, after the `.ci-sources__run--success` rule: `:where(.codebase-inspector-root) .ci-sources__cancel { margin-top: var(--ci-space-3); }` (the spacing its sibling `.ci-coverage-gaps__more` uses). Pin (`tests/unit/css-class-scope.test.ts`): "Polish F2: the scan panel's Cancel scan has a rule" → `expect(readFileSync('src/ui/styles/screens-configure.css', 'utf8')).toMatch(/\.ci-sources__cancel\s*\{/);` (RED).

**F3.** `cancelIfRunning(): void { this.cancelScan(); }` (its comment stays). Pure refactor: `tests/host/city-view-cancel.test.ts` and `tests/host/lifecycle-leaks.test.ts` stay green.

**F4.** In `tests/component/status-surfaces.test.ts`, after the two derived-label assertions, pin the literals: `expect(COPY_30_REVEAL_LABEL).toBe('Reveal file');` and `expect(COPY_30_CLEAR_LABEL).toBe('Clear selection');` (the comment: "Polish F4: the derivation is string surgery on COPY_30; a catalogue reword must fail here, not produce a nonsense label"). Mutation: change COPY_30's " Reveal file or clear selection." tail in `src/ui/copy.ts` to " Show file or clear selection." → the first pin fails (and only the literal pins would catch it).

**F5 (L21).**
- `audit-copy/shared.ts`: `/** Polish F5: the one "Cancel"; the per-surface names below are aliases of it. */ export const CANCEL = 'Cancel';`. `FALLOW_REMOVE_CANCEL`, `FALLOW_CANCEL`, `FINDING_DISMISS_CANCEL`, `SETTINGS_CLEAR_CANCEL`, `IMPORT_CANCEL`, `WORK_CANCEL` and `RULE_EDITOR_CANCEL` become `= CANCEL` (each module imports it from `./shared`, `inspector-copy.ts` from `./audit-copy/shared`). Pure refactor: `grep -rn "= 'Cancel'" src/ui` prints only `shared.ts`.
- The S14 review step: `audit-copy/fallow.ts`, after `FALLOW_REVIEW_TITLE`: `/** Polish F5: the review step says what the badge says, in words (Y27). */ export const FALLOW_REVIEW_UNVERIFIED = 'Unverified source match: a report carries no folder or revision, so its paths are matched to this snapshot by name only.';`, rendered in `ConnectFallowDialog.vue` right after the review `<h3>` as `<p class="ci-note ci-connect-fallow__unverified">{{ FALLOW_REVIEW_UNVERIFIED }}</p>`. Pin (`tests/component/connect-fallow.test.ts`): "Polish F5: the review step says the source match is unverified" — pick the synthetic report as the file's existing review cases do, then `expect(w.find('.ci-connect-fallow__unverified').text()).toBe(FALLOW_REVIEW_UNVERIFIED);` (RED).
- `FallowRemoveDialog.vue` (new) holds the Remove confirmation markup verbatim from `SourcesScreen.vue` lines 226–251 (`CiDialog` with `FALLOW_REMOVE_TITLE`, text, Cancel and Remove), with `defineEmits<{ close: []; confirm: [] }>()`; `SourcesScreen` renders `<FallowRemoveDialog v-if="removing" @close="removing = false" @confirm="confirmRemove" />`. Pure refactor: `tests/component/fallow-card.test.ts` stays green.
- The trap (`Dialog.vue`), position-aware:

```ts
/** Node.DOCUMENT_POSITION_FOLLOWING, without reaching a bare global. */
const FOLLOWING = 4;

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    emit('close');
    return;
  }
  if (event.key !== 'Tab') return;
  const items = focusables();
  const first = items[0]; const last = items[items.length - 1];
  const active = panel.value?.ownerDocument.activeElement;
  if (!first || !last || !active) return;
  // Polish F5: an active element outside the list (a tabindex="-1" heading) wraps by where it
  // is: after `last`, Tab goes to `first`; before `first`, Shift+Tab goes to `last`; anywhere
  // between, the browser's own order is right and nothing is prevented.
  const listed = items.some((el) => el === active);
  const afterLast = !listed && (last.compareDocumentPosition(active) & FOLLOWING) !== 0;
  const beforeFirst = !listed && (active.compareDocumentPosition(first) & FOLLOWING) !== 0;
  if (!event.shiftKey && (active === last || afterLast)) { event.preventDefault(); first.focus(); }
  else if (event.shiftKey && (active === first || beforeFirst)) { event.preventDefault(); last.focus(); }
}
```

Pins — `tests/component/dialog-trap.test.ts` (new):

```ts
// Polish F5 (Part 6 E42): the kit dialog's Tab trap wraps an unlisted focused element by where
// it is in the panel, not as if it always came before the first control.
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { h, type VNode } from 'vue';
import CiDialog from '../../src/ui/kit/Dialog.vue';

const button = (name: string): VNode => h('button', { type: 'button', class: name }, name);
const heading = (name: string): VNode => h('h3', { class: name, tabindex: '-1' }, name);
const mountTrap = (children: () => VNode[]) =>
  mount(CiDialog, { props: { label: 'Trap' }, slots: { default: children }, attachTo: document.body });
function tab(w: ReturnType<typeof mountTrap>, shiftKey: boolean): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
  w.find('.ci-dialog').element.dispatchEvent(event);
  return event;
}

describe('the dialog trap (Polish F5)', () => {
  it('Tab from an unlisted element after the last control wraps to the first', () => {
    const w = mountTrap(() => [button('first'), button('last'), heading('after')]);
    (w.find('.after').element as HTMLElement).focus();
    expect(tab(w, false).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(w.find('.first').element);
    w.unmount();
  });

  it('Shift+Tab from an unlisted element between two controls is left to the browser', () => {
    const w = mountTrap(() => [button('first'), heading('middle'), button('last')]);
    (w.find('.middle').element as HTMLElement).focus();
    expect(tab(w, true).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(w.find('.middle').element);
    w.unmount();
  });

  it('Shift+Tab from an unlisted element before the first control still wraps to the last (Part 6 E42)', () => {
    const w = mountTrap(() => [heading('before'), button('first'), button('last')]);
    (w.find('.before').element as HTMLElement).focus();
    expect(tab(w, true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(w.find('.last').element);
    w.unmount();
  });
});
```

RED: the first two cases (the old trap never wraps forward from `after`, and always wraps back from `middle`); the third stays green.

- [ ] **Step 1: Write the failing tests.**
- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/component/architecture-rules.test.ts tests/component/tests-screen.test.ts tests/unit/css-class-scope.test.ts tests/component/connect-fallow.test.ts tests/component/dialog-trap.test.ts tests/component/status-surfaces.test.ts`
Expected: FAIL as listed (F4's pins pass: run its mutation and paste both runs).

- [ ] **Step 3: Implement** F1–F5.
- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/component/architecture-rules.test.ts tests/component/tests-screen.test.ts tests/unit/css-class-scope.test.ts tests/component/connect-fallow.test.ts tests/component/dialog-trap.test.ts tests/component/status-surfaces.test.ts tests/component/fallow-card.test.ts tests/host/city-view-cancel.test.ts tests/host/lifecycle-leaks.test.ts tests/component/workbench-screen.test.ts tests/component/settings-import.test.ts tests/component/quality-dialog-status.test.ts tests/acceptance`
Expected: PASS.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/ui/screens/architecture/BoundaryRuleTable.vue src/ui/screens/test-confidence/CoverageGapsTable.vue src/ui/inspector-copy.ts src/ui/audit-copy src/host/city-scan-controller.ts src/ui/kit/Dialog.vue src/ui/screens/sources/ConnectFallowDialog.vue src/ui/screens/sources/FallowRemoveDialog.vue src/ui/screens/SourcesScreen.vue tests/component/architecture-rules.test.ts tests/component/tests-screen.test.ts tests/unit/css-class-scope.test.ts tests/component/connect-fallow.test.ts tests/component/dialog-trap.test.ts tests/component/status-surfaces.test.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add src/ui/screens/architecture/BoundaryRuleTable.vue src/ui/screens/test-confidence/CoverageGapsTable.vue src/ui/inspector-copy.ts src/ui/audit-copy src/ui/styles/screens-explore.css src/ui/styles/screens-audit.css src/ui/styles/screens-configure.css src/host/city-scan-controller.ts src/ui/kit/Dialog.vue src/ui/screens/sources/ConnectFallowDialog.vue src/ui/screens/sources/FallowRemoveDialog.vue src/ui/screens/SourcesScreen.vue tests/component/architecture-rules.test.ts tests/component/tests-screen.test.ts tests/unit/css-class-scope.test.ts tests/component/connect-fallow.test.ts tests/component/dialog-trap.test.ts tests/component/status-surfaces.test.ts
git commit -m "fix(ui): static rule and gap rows with real buttons, Cancel scan spacing, one Cancel, an unverified review step and a position-aware dialog trap (polish F1-F5)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Test hygiene (G1, G3–G7)

Model tier: **standard**. Tests only; runs after Tasks 1–6, which added cases to some of these files.

**Files:**
- Create: `tests/fixtures/city-view-doubles.ts` (~25)
- Modify: the `makePluginDouble` copies in `tests/host/{city-view-cancel,city-view-data-ports,city-view-evidence,city-view-scan-modes,city-view-store-wiring,city-view,commands,lifecycle-leaks,plugin-onload,window-migration,city-view-analysis}.test.ts` (each shrinks)
- Modify: `tests/component/ownership-screen.test.ts` (168: lines 88, 99, 122, 133, 144), `tests/component/quality-screen.test.ts` (325: line 33 and its callers)
- Create: `tests/unit/review-repository-roundtrip.test.ts` (~130)
- Modify (G4 repairs, in place): the files the triage names (see G4)
- Modify: `tests/component/kit-evidence.test.ts` (42 → ~45), `tests/component/toolbar-scan.test.ts` (143 → ~147)
- Create: `tests/host/city-scan-controller.test.ts` (~55), `tests/component/use-city-floor.test.ts` (~70)
- Modify (G7): the two test files the search finds

**Interfaces:**
- Consumes: `defaultCityViewState`, `CityScanController`, `provideScanCallbacks`, `useCityFloor`, `createPluginDataReviewRepository`, `deleteReviewSet`.
- Produces: `makePluginDouble()`.

**G1.** `tests/fixtures/city-view-doubles.ts`:

```ts
// Polish G1 (Part 5 E10): the Obsidian plugin double every real-CityView host test builds, once.
// A file whose double differs (extra workspace members, spies it reads back) keeps its own.
import { vi } from 'vitest';

export function makePluginDouble(): {
  app: { workspace: Record<string, ReturnType<typeof vi.fn>>; vault: { adapter: Record<string, ReturnType<typeof vi.fn>>; configDir: string } };
} {
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
```

Replace each copy whose body is the same (ignoring layout); list every file that keeps its own and why. Pure refactor: every host test stays green, and `grep -rln "function makePluginDouble" tests/host` lists only the files the report names.

**G3.** Replace `await Promise.resolve(); await nextTick();` in `ownership-screen.test.ts` with `await flushPromises();` (five sites), and `quality-screen.test.ts`'s `flush` helper with `flushPromises` at every call. Pure refactor: both files stay green; drop `nextTick` from an import it no longer needs.

**G4 — triage, then about ten cases.** Each case is added, repaired, or recorded as already covered (by test name) — nothing is invented to reach a number:
1. (Part 6 E27) the 1 MB save test seeds a set already over the limit: in `tests/unit/review-repository-roundtrip.test.ts`, "a save that crosses 1 MB is refused as full and data.json is unchanged" — seed a set just under `REVIEW_STORE_MAX_BYTES` through `plugin.saveData`, save one more item, expect `ReviewStoreError` with code `full` and `await plugin.loadData()` equal to the seed. The over-limit case in the contract file stays (the contract file is at 423 lines, L25).
2. (E27) "a work item on a path with spaces and non-ASCII letters round-trips through data.json" — save, reopen with a new adapter, list, `toEqual`.
3. (E27) "a codebase whose id is `__proto__` saves and reopens, and the `reviews` object keeps its prototype" — `Object.getPrototypeOf((await plugin.loadData()).reviews)` is `Object.prototype`.
4. (E27) "the three list calls a load makes share one data.json read" — spy `plugin.loadData`, call the three lists together, expect one call.
5. (E30) `storageNote` precedence with several conditions at once — in `tests/component/settings-privacy-storage.test.ts`: a read failure beside skipped records shows the read-failure note (read the component's precedence first; pin what it does).
6. (E30) two copy assertions that compare a constant with itself — find them with `grep -rnE "expect\(([A-Z_]+)\)\.toBe\(\1\)" tests`; replace each with the literal from the copy module.
7. (E34) refusal gaps — in the fallow path-safety tests (`grep -rln "rejectedPaths" tests/unit`): a UNC path, `C:\`, and a path containing NUL are each rejected into `rejectedPaths`.
8. (E34) the identical-key dedup of unused entries — two identical unused-export rows give one finding.
9. (E36) the `changed === id` filter — in `tests/unit/evidence-store.test.ts`: a notification for another codebase does not change the bound report.
10. (E36) `setRepository` called twice — the second repository's notifications reach the store and the first's no longer do.
11. (E42) focus after the S14 dialog's Cancel and after a successful Attach lands on the card's Import button — in `tests/component/connect-fallow.test.ts` only if it stays under 390 lines, otherwise in `tests/component/fallow-run-polish.test.ts`.
12. (E42) the vacuous Shift+Tab-from-summary test and the `UNMATCHED_SHOWN` constant test — find them (`grep -rn "UNMATCHED_SHOWN\|summary" tests/component/connect-fallow.test.ts tests/component/fallow-card.test.ts`), and make each assert an observable result (focus moved; the list is cut at the constant).

The 20k timing test's 1.6× margin (E34) is recorded in the ledger, not changed (a timing budget is a spec gate, L5's reasoning). Each added case names its RED, or its mutation when it pins held behaviour.

**G5.** `tests/component/kit-evidence.test.ts`: the three cases without `w.unmount()` gain it (consistency with the collected-state case). `tests/component/toolbar-scan.test.ts`, the guarded-press case: before the refused click, `const said = wrapper.findAll('[role="status"]').map((r) => r.text());`, and after it `expect(wrapper.findAll('[role="status"]').map((r) => r.text())).toEqual(said);` ("a refused press announces nothing", E17). Mutation: make the guarded handler call `reannounce` on the shell's status region → the new assertion fails.

**G6.** `tests/host/city-scan-controller.test.ts` (node project):

```ts
// Polish G6 (Part 5 E12): CityScanController on its own, over doubles, not only through CityView.
import { describe, expect, it, vi } from 'vitest';
import type { App as VueApp } from 'vue';
import { CityScanController, provideScanCallbacks } from '../../src/host/city-scan-controller';
import { defaultCityViewState } from '../../src/host/view-state';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFixedClock } from '../fixtures/clock';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { makePluginDouble } from '../fixtures/city-view-doubles';

function controller(): CityScanController {
  return new CityScanController(makePluginDouble() as never, {
    profileStore: createFakeProfileStoreHarness().store, getFilesystem: () => createFakeSourceFileSystem({}).port,
    snapshotStore: new InMemorySnapshotStore(createFixedClock()), clock: createFixedClock(), ...dataPortDeps(),
  }, { viewState: () => defaultCityViewState(), showNotice: vi.fn() });
}

describe('CityScanController (Polish G6)', () => {
  it('is not running before any scan, and both cancels are safe no-ops then', () => {
    const c = controller();
    expect(c.isScanRunning()).toBe(false);
    expect(() => { c.cancelScan(); c.cancelIfRunning(); }).not.toThrow();
    expect(c.isScanRunning()).toBe(false);
  });

  it('provideScanCallbacks provides exactly three callbacks, each reaching the controller once', () => {
    const provided = new Map<string, () => void>();
    const app = { provide: (key: string, value: () => void) => { provided.set(key, value); } } as unknown as VueApp;
    const c = controller();
    const select = vi.spyOn(c, 'selectCodebase').mockResolvedValue(undefined);
    const start = vi.spyOn(c, 'startScan').mockResolvedValue(undefined);
    const cancel = vi.spyOn(c, 'cancelScan');
    provideScanCallbacks(app, c);
    expect(Array.from(provided.keys())).toEqual(['onSelectCodebase', 'onScanRequested', 'onCancelScan']);
    for (const callback of provided.values()) callback();
    expect([select, start, cancel].map((s) => s.mock.calls.length)).toEqual([1, 1, 1]);
  });
});
```

and `tests/component/use-city-floor.test.ts`: one case, "below the 320 px floor the city switches to list mode and widening restores the spatial mode the user had", mounting a small component that calls `useCityFloor(rootRef, useCityStore(), ref(false))`, with the leaf width stubbed exactly as `tests/component/welcome-state.test.ts`'s narrow-layout cases stub it (read them first; do not grow that file, L25). Mutations: delete `useCityFloor`'s list switch (floor case); swap two `app.provide` keys (G6 provide case).

**G7 (L26).** Search the tests Part 6 E48 touched for titles and comments its fixes made false: `grep -rnE "it\('[^']*(decided|open finding|critical or high|ready|reload)" tests/unit tests/component` and read each hit's assertions; fix every title or comment whose words contradict what it asserts, and list each by file and line. If fewer than two are found, record that in the report (the ledger records it), rather than editing a true title.

- [ ] **Step 1: Make the changes**, adding each new case RED first (or with its mutation) as named.
- [ ] **Step 2: Run the touched tests.**

Run: `npx vitest run tests/host tests/component/ownership-screen.test.ts tests/component/quality-screen.test.ts tests/component/kit-evidence.test.ts tests/component/toolbar-scan.test.ts tests/component/use-city-floor.test.ts tests/unit/review-repository-roundtrip.test.ts` plus every file G4 and G7 touched.
Expected: PASS.

- [ ] **Step 3: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint tests/fixtures/city-view-doubles.ts tests/host tests/component tests/unit/review-repository-roundtrip.test.ts --max-warnings 0`
Expected: exit 0. No touched file passes 450 lines (`wc -l` each).

- [ ] **Step 4: Commit.**

```
git add tests
git commit -m "test: shared CityView plugin double, flushPromises, triaged review and evidence pins, consistent kit tests, and isolated scan-controller and city-floor tests (polish G1, G3-G7)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Dead code and the evidence documents (X1, H1–H6, D6)

Model tier: **standard**. Runs after Tasks 2, 3a and 3b, whose changes the analyze total depends on.

**Files:**
- Modify (the `export` keyword only): `src/domain/layout/districts.ts` (`UNAVAILABLE_FOOTPRINT`, 16), `src/domain/layout/scale.ts` (`SCALE_NAME`, 35), `src/visualization/picking.ts` (`HOVER_DWELL_MS`, 17), `src/ui/read-models/evolution.ts` (`COUPLING_ROWS`, 16), `src/ui/read-models/findings.ts` (`findingFingerprint`, 59), `src/ui/read-models/hotspots.ts` (`SHORTLIST_SIZE`, `SCATTER_TICKS`, 11–12), `src/ui/read-models/use-read-models.ts` (`overviewModelFor`, `fileDetailFor`, `qualityModelFor`, `testConfidenceModelFor`, `dependenciesModelFor`, `ownershipModelFor`), `src/ui/stores/ports/review-repository.ts` (`allChecksDone`, 61), `src/application/analysis/fallow-invocation.ts` (`FALLOW_ERROR_MESSAGE_MAX`, 24)
- Modify: `src/ui/read-models/fallow-run.ts` (after 3b): the re-export lines (133–136); `src/application/ports/analyzer-binding-store.ts` (22): line 9
- Modify: `tests/harness/seed.ts` (154), `tests/harness/mount.ts` (373 → ~378), `tests/harness/harness-evidence.test.ts` (103 → ~118)
- Modify: `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` (905): the analyze section (724–750), the G6 no-freeze lines, the Numbers residual (833); `docs/superpowers/notes/2026-09-17-wp01-limitations.md` (380): lines 70–77, 121–125, 225–232, 289, the Part 7 section (302–352), 374; `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md` (618): lines 167, 566, 614; `docs/superpowers/notes/2026-09-20-wp01b-acceptance-spine.md` (284): lines 184–185; `docs/superpowers/specs/2026-09-23-inspector-ui-part7-design.md` (404): line 222

**Interfaces:**
- Consumes: every earlier task.
- Produces: `openFailureLog(root: ParentNode): void`; the re-baselined analyze figures.

**X1.** Run `npx --offline --yes fallow@3.27.0 dead-code src --format json --quiet > "$TMP/analyze-before.json"` (it exits 1 by design). For each name in the Files list: `grep -rnw <name> src tests` must show only its own module; then drop `export`. If the name is then unused inside its module (typecheck or lint says so), delete the declaration instead and say so. In `read-models/fallow-run.ts` drop, from the re-export lines, exactly the names the analyze run still flags there (at d42a2c2: `isActive`, `isCancellable`, `AnalyzerBindingView`, `StartOutcome`, `ExecutableFacts`, `ExecutableFormat`, `ExecutableRefusal`; Task 3a's tests import `ReviewResult` and `StartOutcome` through it, so keep any name a `src` or `tests` file imports from the barrel); drop the `AnalyzerBinding` re-export from `analyzer-binding-store.ts:9` (its users import it from `analyzer-record.ts`). Kept, and checked unchanged: `fs` (`node-access.ts`), `LOT_FOOTPRINT`, `MAX_DIRECT_SUBDISTRICTS`, `DRAG_THRESHOLD_CSS_PX`, `entityPath` (test-used), `SourceReference` and both `EntityId`s (frozen §4), `ScanCoordinator.getLifecycle` (called by `tests/acceptance/steps/evidence-steps.ts`, L10), the `city-view` ↔ `leaf-registry` cycle, `CityRendererPort.getCamera` (frozen §4.2). The grep check (Review Focus 3): `grep -n "export type SourceReference\|export type EntityId\|getCamera\|export const fs\b\|getLifecycle" src/domain/model.ts src/domain/entity-id.ts src/visualization/renderer-port.ts src/adapters/filesystem/node-access.ts src/application/scan-coordinator.ts` prints each of them. Run analyze again into `$TMP/analyze-after.json`: the total is **9** (5 unused exports, 1 unused type, 1 unused class member, 1 duplicate export pair, 1 circular dependency), or **13** if the four CityView members are still flagged (L27). Any other finding is a regression of this pass: fix it before going on.

**H1.** In the gate evidence, rewrite "**Accepted baseline at this commit: 11 findings** — …" as "**Accepted baseline at this commit: 9 findings** — 5 unused exports, 1 unused type, 1 unused class member, 1 duplicate export pair, 1 circular dependency." (the figures `analyze-after.json` gives; `tests/unit/evidence-numbers.test.ts:314` requires the parts to sum to the total), and its table to the kept list: the first row becomes "`districts.ts` `LOT_FOOTPRINT`, `MAX_DIRECT_SUBDISTRICTS`; `picking.ts` `DRAG_THRESHOLD_CSS_PX`; `work-items.ts` `entityPath` | imported by their tests (`layout-districts`, `layout-determinism`, `ui-steps`, `review-state`), which assert against the constant rather than retyping it; the WP-02 polish pass (X1) un-exported the three that no test used. Accepted."; the `getLifecycle` row says it is called by `tests/acceptance/steps/evidence-steps.ts` and kept (polish L10); if the total is 13, one more row names the four `CityView` members as false positives (`commands.ts` calls them through `getActiveViewOfType`). The limitations note (§Tooling, 225–232, and the Numbers line 374), the implementation report (167, 566, 614) and the gate evidence's Numbers residual (833) say the new total. The sentence "the baseline is what makes a twelfth finding visible" becomes "…a tenth finding…" (or "fourteenth" with 13).

**H2.** In the limitations note, each stale bullet keeps its text and gains a closing sentence, in italics:
- line 70 ("No analyzer, no findings, …"): "*Superseded for findings: WP-02 Part 6 imports fallow evidence and Part 7 runs an installed fallow (`tests/unit/evidence-index.test.ts`, `tests/integration/fallow-analysis.test.ts`); coverage, dependency relations and runtime evidence are still not collected.*"
- line 73 ("No note writing, no snapshot comparison."): "*Superseded for comparison: WP-02 Part 3 compares snapshots (`tests/component/evolution-screen.test.ts`); no note writing still holds.*"
- line 74 ("…External process execution is an unresolved policy question…"): "*Superseded: WP-02 Part 7 decided and delivered the process policy (Z1–Z44; `tests/unit/no-process-execution.test.ts`, the G6 section of the gate evidence). No source-opening or open-in-editor action still holds.*"
- line 77 ("No lens parameter on the city viewport."): "*Superseded: WP-02 Part 6 adds the findings lens (Y40; `tests/component/findings-lens.test.ts`).*"
- line 121 ("No COPY literal is pinned …"): "*Superseded: `tests/contracts/microcopy.test.ts` compares the catalogue with `src/ui/copy.ts`.*"
- line 289 (§11, "Whether external process execution is permitted by policy."): "*Closed by WP-02 Part 7 (Z1–Z44), which the owner approved.*"

**H3.** In the acceptance spine (184–185), `'and still loses to a scoped user snippet'` becomes `'and still loses to a user snippet scoped to our own root'` (the real title, `tests/unit/host-cascade.test.ts:133`).

**H4.** In the limitations note's `## WP-02 Part 7 — running an installed fallow`, after "Machine identity is inferred.", add: "- **Two devices displace each other's binding.** The record is stamped with one device's id (K2). Choosing the executable on a second device replaces the first device's record, so each switch between devices asks for the executable and its review again: once per switch, not once per device." The closing paragraph's list of what "is stated only in this document" gains "the two-device displacement".

**H5 (L24).** `tests/harness/seed.ts`:

```ts
/** Polish H5 (L24): a headless capture cannot click, so the failed-run shot opens the banner's
 *  "Error output (last lines)" itself, and the log text is in the picture. */
export function openFailureLog(root: ParentNode): void {
  const log = root.querySelector('details.ci-fallow-run__log');
  if (log === null) throw new Error('harness: analysis=failed rendered no error output');
  log.setAttribute('open', '');
}
```

`tests/harness/mount.ts`, in the `route !== 'city'` block after the first `await nextTick();`: `if (options.analysis === 'failed') { openFailureLog(root); await nextTick(); }` (imported from `./seed`). Pin (`tests/harness/harness-evidence.test.ts`):

```ts
  it('Polish H5: the failed-run shot opens its error output, and refuses to capture without one', () => {
    const root = document.createElement('div');
    root.innerHTML = '<details class="ci-fallow-run__log"><summary>Error output (last lines)</summary><pre>boom</pre></details>';
    openFailureLog(root);
    expect(root.querySelector('details')!.open).toBe(true);
    expect(() => { openFailureLog(document.createElement('div')); }).toThrow('rendered no error output');
  });
```

RED: no export. The capture itself is retaken in Task 9.

**H6.** Run `npx vitest run tests/integration/fallow-analysis.test.ts -t "no freeze"` and, in the gate evidence's G6 section, after the two pasted `[no-freeze]` lines, add the new lines verbatim and: "Observed again in the WP-02 polish pass: the largest event-loop gap was N ms against the 50 ms budget (Z38, K18); Part 7 observed 22–27 ms. The budget is unchanged (polish L5, C18)." with N the measured value.

**D6 (L4).** In the Part 7 spec §2 table (line 222), `SETTINGS_FALLOW_EXE_NAME` becomes `SETTINGS_FALLOW_EXECUTABLE_NAME`, and the row gains "(corrected in the polish pass, polish ledger L4)".

- [ ] **Step 1: Write the H5 pin and watch it fail.**

Run: `npx vitest run tests/harness/harness-evidence.test.ts`
Expected: FAIL (no `openFailureLog`).

- [ ] **Step 2: Do X1** (grep each name, un-export, re-run analyze) **and H5.**
- [ ] **Step 3: Update the documents** (H1–H4, H6, D6).
- [ ] **Step 4: Run the covering tests.**

Run: `npx vitest run tests/harness tests/unit/evidence-numbers.test.ts tests/host/clean-vault-install.test.ts tests/unit/layout-districts.test.ts tests/unit/review-state.test.ts tests/acceptance`
Expected: PASS, except `tests/unit/evidence-numbers.test.ts` failures that name file counts or the `src/` floor (Task 9 refreshes those, L28); its analyze-breakdown case must pass.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/domain/layout src/visualization/picking.ts src/ui/read-models src/ui/stores/ports/review-repository.ts src/application/analysis/fallow-invocation.ts src/application/ports/analyzer-binding-store.ts tests/harness --max-warnings 0`
Expected: exit 0. `npx --offline --yes fallow@3.27.0 dead-code src` prints the accepted list only.

- [ ] **Step 6: Commit.**

```
git add src tests/harness docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md docs/superpowers/notes/2026-09-17-wp01-limitations.md docs/superpowers/notes/2026-09-17-wp01-implementation-report.md docs/superpowers/notes/2026-09-20-wp01b-acceptance-spine.md docs/superpowers/specs/2026-09-23-inspector-ui-part7-design.md
git commit -m "chore: un-export dead symbols and re-baseline analyze, open the failed-run log in the harness, and correct the stale evidence notes (polish X1, H1-H6, D6)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Full verification and the evidence counts — controller

Model tier: **most capable** (run by the controller). No `src/` change.

**Files:**
- Modify: `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`: the G8 heading paragraph and heading (579–604), the `<!-- g8:table:start -->` … `<!-- g8:table:end -->` block (631–645), the G2 `(N+ files, count asserted` floor if its guard asks, and the Numbers residual's living-suite line (835)
- Modify: `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`: its copy of the G8 table, byte-identical
- Record in the polish ledger: the final verification (the controller's own file)

**Interfaces:**
- Consumes: every earlier task; `npm run test:fallow`; `npm run harness-shot`.
- Produces: a green `npm run verify`, the retaken shots and the refreshed counts.

- [ ] **Step 1: Run the two evidence guards and watch them fail.**

Run: `npx vitest run tests/unit/gate-evidence.test.ts tests/unit/evidence-numbers.test.ts`
Expected: FAIL — the unit, component and host FILE counts differ from disk (this pass adds five unit files, five component files and two host files), and possibly the `src/` floor (five new `src` files).

- [ ] **Step 2: Refresh the counts from disk, never by hand.**
- per-layer FILE counts: `find tests/<layer> -name '*.test.ts' -o -name '*.steps.ts' | wc -l` for each layer. Expected after Tasks 1–8: unit **122**, contracts **5**, integration **9**, component **80**, host **20**, acceptance **1**, benchmarks **1**, harness **2**, build **1**, fallow-real **1** — **242** in all. If disk differs, the disk wins and the difference goes in the ledger.
- the Contract row's Tests cell is derived by its guard; no contract file gained an `it(` in this pass, so it stays unless the guard says otherwise.
- the heading's per-layer total and the vintage paragraph: "The per-layer total is 242, which is not what `npm run test` itself runs: it is 241 files plus the opt-in `tests/fallow-real` layer's one file…".
- the `src/` floor: if `evidence-numbers.test.ts` reports the stated floor more than ten below the real count, raise the stated floor to the real count minus zero to ten, as its message asks.
- copy the whole `<!-- g8:table:start -->` … `<!-- g8:table:end -->` block, byte for byte, into the implementation report.

- [ ] **Step 3: Run the full verification and take the living-suite figures.**

Run: `npm run verify`
Expected: typecheck, `lint:fast`, `lint` and `build` pass (`assert-bundle: OK`); `npm run test` passes. If `tests/host/clean-vault-install.test.ts` or `tests/unit/no-process-execution.test.ts` times out under load, re-run it alone and record both runs. Replace the living-suite sentence's four figures (files, tests, passed, skipped) with those this run prints, measured "after the WP-02 polish pass", in the G8 vintage paragraph and in the Numbers residual (line 835, which still says 204 files and 2223 tests).

- [ ] **Step 4: Run the real-binary suite.**

Run (Git Bash): `FALLOW_BIN="$LOCALAPPDATA/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe" npm run test:fallow`
Expected: `fetch-fallow: FALLOW_BIN=…; nothing fetched.` and 10 passing tests (A9's `killTree` cleanup is in this suite). Paste the summary into the ledger.

- [ ] **Step 5: Retake the harness captures (H5).**

Run: `npm run harness-shot`
Expected: every shot is written to `harness-shots/` (ignored by git). Open `harness-shots/wp02-sources-fallow-failed-dark.png` and confirm the "Error output (last lines)" block is open and its log text is visible; record that in the ledger. Also look at `wp02-evolution-dark.png` (E12's seconds) and `wp02-architecture-dark.png` (F1's Show buttons) and record what they show.

- [ ] **Step 6: Run the evidence guards and watch them pass.**

Run: `npx vitest run tests/unit/gate-evidence.test.ts tests/unit/evidence-numbers.test.ts tests/host/clean-vault-install.test.ts`
Expected: PASS. A failing assertion names the stale figure and the true one; fix exactly that figure and re-run.

- [ ] **Step 7: Commit.**

```
git add docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md docs/superpowers/notes/2026-09-17-wp01-implementation-report.md
git commit -m "docs(evidence): WP-02 polish pass test counts, living suite and G8 table" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Record the final verification in the polish ledger** (the `npm run verify` summary, the `test:fallow` summary, the analyze total, the harness observations) and commit the ledger on its own: `git commit -m "docs(ledger): polish pass final verification" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.

---

## Not in this pass

Each is recorded in the polish ledger with its reason.

| Item | Why not | Ledger |
|---|---|---|
| C18 — the no-freeze gate's 50 ms budget | It is spec Z38 (with K18). Only the observed margin is recorded (H6, Task 8). | L5 |
| S1 — an attempt cap on `CityViewport` self-reconstruction | Changes M80, the renderer's no-self-healing rule, tied to OWNER-DECISION F14. | L6 |
| S2 — `setPointerCapture` on an edge drag | Changes ruling M95. | L6 |
| S3 — a producer for the `root-unavailable` scan state | Changes spec §7. | L6 |
| E10 — `onExternalSettingsChange` re-read and rebind | Changes Y19 ("external changes are picked up on the next bind"). | L6 |
| The 11 OWNER-DECISION items (F2 packing, F14 Retry 3D, SourceIdentity naming, the layering lint, M108 concurrency, the wide-leaf city size, the M116 re-skin, the muted-token claims, Option B hover contrast and a measured gate, the deliverable status and integration, the 820 px threshold) | The owner's decisions by definition. | L7 |
| The 28 NOT-FIXABLE-HERE items (the manual host check, the NOT PERFORMED accessibility rows, untried themes, the Windows direct-child kill, the unrun POSIX paths, libuv's environment, fallow's ignored `--fail-on-issues`, the design's inherent limits, the force-quit gap, the synchronous parse, the inferred machine identity, fallow id churn, the guard's accepted gaps, the symlink skip, in-memory snapshots, the snapshot ceiling and include list, FNV-1a under-invalidation, pre-M62 globs, the unreachable `mayPublish` guard, `getCamera`, `SourceReference`/`EntityId`, the vendor FileSaver island, the Three.js warning, the §11 host questions, upgrade-time checks, external citations, community-directory acceptance, the prose residual list) | Each needs real hardware, a real host, a human, an upstream change, or an owner-approved spec change. | L8 |
| Removing `ScanCoordinator.getLifecycle` (offered as optional under X1) | `tests/acceptance/steps/evidence-steps.ts` calls it. | L10 |

## Item → task coverage

Every IN item maps to exactly one task.

| Items | Task |
|---|---|
| A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, G2 | 1 |
| B1, B2, B3, B4, B5, B6, B7, B8, B9, B10 | 2 |
| C1, C2, C10, C11, C13 | 3a |
| C3, C4, C5, C6, C7, C8, C9, C12, C14, C15, C16, C17, C19 | 3b |
| D1, D2, D3, D4, D5 | 4 |
| E2, E3, E4, E11, E12, E13 | 5a |
| E1, E5, E6, E7, E8, E9, E14 | 5b |
| F1, F2, F3, F4, F5 | 6 |
| G1, G3, G4, G5, G6, G7 | 7 |
| X1, H1, H2, H3, H4, H5, H6, D6 | 8 (H5's capture is retaken in Task 9) |
| — (verification and counts) | 9 |

Count: 11 + 10 + 5 + 13 + 5 + 6 + 7 + 5 + 6 + 8 = **76** items (A1–A10, G2; B1–B10; C1–C17 and C19; D1–D5; E1–E9 and E11–E14; F1–F5; G1 and G3–G7; X1, H1–H6, D6). The inventory's "77 planned" also counted C18, which L5 rules out.

## Self-review notes

- **Coverage.** The table above lists all 76 IN items once each; the five Review Focus items each have a named pin (Tasks 2, 5b, 8, 6 and 4).
- **Names are one spelling across tasks.** `expectedName`, `killTree`, `spawnCallCount`, `listFiles`, `'unscannable'`, `refusedTrustWrite`, `stopUnasked`, `mayPublishAnalysis`, `createServiceWorld`, `executableName` (service and store), `readFailed`, `FALLOW_EXE_READ_FAILED`, `whenDialogIdle`, `failureBanner`, `FALLOW_RUN_CANCELLING_HINT`, `SETTINGS_FALLOW_STORE_FAILED`, `showAnalyzerFailure`, `isHighSeverity`, `HIGH_SEVERITIES`, `openHighFindingsValue`, `reloadIfBound`, `LENS_LIST_TEXT`, `ReviewStoreError`/`ReviewStoreErrorCode` (port), `reviewFailureText`, `isPlainObject`/`asUnknownArray` (domain), `FindingSeverity`/`FINDING_SEVERITIES`, `evidenceBadgeFor`, `useImportReport`, `raisedMarks`, `removeFrom`, `RULE_SHOW`/`RULE_SHOW_LABEL`, `TESTS_OPEN`/`TESTS_OPEN_LABEL`, `CANCEL`, `FALLOW_REVIEW_UNVERIFIED`, `FallowRemoveDialog`, `makePluginDouble`, `openFailureLog`.
- **Found already partly closed.** G2's header already names `spawn.bind(null)()` and `Reflect.apply`, and an opener's `.call` is already flagged by name (pinned in Task 1, not re-implemented). A5's bare `require("child_process")` is already refused by the built-ins check; only the `window.require('child_process')` route was open. X1's optional `getLifecycle` removal is not possible (L10).
- **Budgets.** Measured at d42a2c2; no `src` file this plan grows passes 400 (`review-store.ts` ~355, `ConnectFallowDialog.vue` ~315, `WorkItemEditor.vue` 315), the Part 7 caps hold (`FallowInstalledRoute.vue` ~245 ≤ 260), and the test files at or near 450 are edited in place only (L25).
- **Spec amendments.** Exactly three: L2 (K41), L3 (U27), L4 (a spec §2 row corrected to what shipped). Everything else is inside an existing decision.
- **Open for the owner.** The OUT list above, unchanged by this pass.
