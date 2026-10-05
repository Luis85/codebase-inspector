# WP-02 Part 7 — fallow execution: executable binding and trust, the async runner, side-effect tests and "Run fallow analysis": Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Part 7 delivers the execution half of the Fallow Ingestion deliverable:
- a per-codebase fallow executable binding in `data.json`, with trust stored as a fingerprint and remembered until something it covers changes (02.4);
- an async runner in `src/adapters/fallow/` with bounded output, a timeout, cancellation and a safe shutdown (02.5);
- collected evidence (origin `collected`, verified source match) on every screen, a failed run keeping the old evidence marked stale;
- the S14 "installed analyzer" route, the Data & scans run controls and banner, and the "Run fallow analysis" / "Cancel fallow analysis" commands;
- the deliberate amendment of the no-process guard, an offline test net for `npm run verify`, and an opt-in `npm run test:fallow` against the real, pinned fallow 3.27.0 (02.7).

**Architecture:** The Part 1–6 shell stays as it is:
- screens read read models, stores and copy only (Part 6 E20);
- every value is a `MetricValue`; absent evidence is `unknown`, never `0`;
- evidence goes through the one session-only `EvidenceRepository` (Y28) and the per-leaf evidence store (Y29);
- the Part 6 parse → normalise → resolve pipeline (`parseFallowReportText`, `buildEvidenceReport`, `resolveFindings`) is reused unchanged (U1, U9).

Part 7 adds:
- **Pure application contracts** in `src/application/analysis/`: the exact argv, the caps, the environment allow-list, exit semantics, error codes, the analyzer record and the trust fingerprint.
- **A plugin-wide `AnalysisCoordinator`** with a pure reducer mirroring `run-state.ts` (identity, generation, `mayPublish`), and a **`FallowAnalysisService`** facade that owns binding, trust and the pre-run checks.
- **Adapters:** a durable `analyzers` slice in `data.json`, an executable inspector (stat, real path, 4-byte header; never executes), and the process runner — the only `child_process` code in `src/`, split into `node-process-access.ts` (the `window.require`) and `fallow-runner.ts` (the one `spawn`).
- **Host and UI:** a per-leaf analysis store wired through `wireDataPorts`, two commands, a failure Notice, settings rows, and the Data & scans installed route, run panel and banner.

**Tech Stack:** TypeScript 6.0.3, Vue 3.5.43 (`<script setup>`), Pinia 4.0.3, zod 4.6.5, Vitest (`vitest.config.ts` projects `node` and `jsdom`) + @vue/test-utils 2.5.1, Node 24 (`node:child_process` in tests only), fallow 3.27.0 (opt-in tests only, never a dependency).

**Spec:** `docs/superpowers/specs/2026-09-23-inspector-ui-part7-design.md` (decisions **Z1–Z44**, owner-approved at 384c528, including its 18 "Decisions taken while writing"). It sits on these specs, all binding:
- Part 1 (`2026-09-21-inspector-ui-shell-design.md`, A1–A13);
- Part 2 (`2026-09-21-inspector-ui-part2-design.md`, P1–P14);
- Part 3 (`2026-09-21-inspector-ui-part3-design.md`, Q1–Q17);
- Part 4 (`2026-09-22-inspector-ui-part4-design.md`, W1–W17);
- Part 5 (`2026-09-22-inspector-ui-part5-design.md`, V1–V32);
- Part 6 (`2026-09-23-inspector-ui-part6-design.md`, Y1–Y40).

Precedent, all binding: the Part 3 ledger (R1–R9, E1–E55), the Part 4 ledger (S1–S27, X0–X19, "Part 4 E1–E22"), the Part 5 ledger (T1–T32, "Part 5 E1–E25") and the Part 6 ledger (U1–U51, "Part 6 E1–E49"). This part's rulings live in `docs/superpowers/notes/2026-09-23-wp02-part7-ledger.md`: planning rulings are **K1…**, execution rulings are "Part 7 E1"….

**Branch:** `feat/wp-02-part7` (from `feat/wp-01-codebase-city` at 8841b4c; the spec and this plan are its first commits), worktree `C:\Projects\codebase-inspector\.claude\worktrees\inspector-prototype-ui-18caac`. **Not stacked:** at the end, `feat/wp-01-codebase-city` is fast-forwarded to this branch and pushed, so the work lands on PR #1. The integration step is the owner's choice.

**Before Task 1:** `node_modules` is already installed in this worktree (`npm ci` is not needed). `.obsidian/` does not exist here, so `tests/unit/install-script.test.ts` fails environmentally (see Gates). The controller runs the pre-flight conflict scan (A10) before dispatching Task 1.

## Global Constraints

**Size** (eslint `max-lines`; measured at 384c528)
- `src/**/*.{ts,vue}` max **400** lines. `tests/**/*.ts` max **450** lines.
- `src/host/city-view.ts` is **285**; `tests/unit/city-budget.test.ts` caps it (and `src/ui/screens/CityWorkspace.vue`, 189) at **360**. Task 9 adds four one-line delegations (≈ 298). `CityWorkspace.vue` is not touched.
- Files this plan touches, with their size now: `src/main.ts` 88, `src/host/commands.ts` 87, `src/host/data-ports.ts` 36, `src/host/city-scan-controller.ts` 159, `src/host/setting-definitions.ts` 152, `src/host/settings-tab.ts` 240, `src/adapters/storage/plugin-data-shape.ts` 110, `src/adapters/storage/in-memory-evidence-store.ts` 40, `src/adapters/filesystem/node-globals.d.ts` 61, `src/adapters/filesystem/node-access.ts` 15, `src/application/ports/evidence-repository.ts` 15, `src/application/evidence/model.ts` 73, `src/ui/read-models/evidence-index.ts` 131, `src/ui/read-models/sources.ts` 95, `src/ui/read-models/overview.ts` 150, `src/ui/read-models/findings.ts` 165, `src/ui/kit/EvidenceBadge.vue` 17, `src/ui/screens/sources/ConnectFallowDialog.vue` 220, `src/ui/screens/sources/FallowCardDetails.vue` 86, `src/ui/screens/sources/FallowReportFacts.vue` 125, `src/ui/screens/SourcesScreen.vue` 219, `src/ui/screens/QualityScreen.vue` 218, `src/ui/screens/FileDetailScreen.vue` 153, `src/ui/screens/file/FileFindingsPanel.vue` 88, `src/ui/screens/quality/FindingReviewDialog.vue` 247, `src/ui/screens/city/LensHeading.vue` 47, `src/ui/App.vue` 193, `src/ui/inspector-copy.ts` 296, `src/ui/audit-copy/fallow.ts` 181, `src/ui/audit-copy/quality.ts` 143, `src/ui/audit-copy/report.ts` 59, `src/ui/audit-copy/sources.ts` 51. CSS (no cap): `src/ui/styles/kit.css` 282, `src/ui/styles/screens-configure.css` 84.
- Test files this plan touches: `tests/fixtures/process-guard.ts` 206, `tests/unit/no-process-execution.test.ts` 149, `tests/unit/node-access-boundary.test.ts` 152, `tests/unit/assert-bundle.test.ts` 61, `tests/fixtures/data-port-deps.ts` 23, `tests/host/plugin-onload.test.ts` 220, `tests/unit/evidence-store.test.ts` 135, `tests/host/city-view-evidence.test.ts` 131, `tests/unit/in-memory-evidence-store.test.ts` 68, `tests/unit/evidence-index.test.ts` 188, `tests/unit/finding-copy.test.ts` 53, `tests/unit/sources-model.test.ts` 69, `tests/component/kit-evidence.test.ts` 35, `tests/component/settings-tab-purge.test.ts` 83, `tests/component/settings-tab-validation.test.ts` 216, `scripts/assert-bundle.mjs` 80, `tests/harness/page.ts` 68, `tests/harness/seed.ts` 108, `tests/harness/mount.ts` 333, `tests/harness/harness-evidence.test.ts` 75, `tests/build/harness-shot.test.ts` 100, `scripts/harness-shot.mjs` 255, `tests/unit/evidence-numbers.test.ts` 402.
- **At or near the tests cap — never grow them:** `tests/component/settings-tab.test.ts` **435** (Task 10 changes one constructor call in place and one import line: 435 → 436), `tests/host/city-view-store-wiring.test.ts` **450**, `tests/unit/evidence-numbers.test.ts` **402** (Task 14: one added line, 402 → 403), `tests/component/connect-fallow.test.ts` 370. New tests go in new files.
- New `src` files and their caps (Z43): `fallow-runner.ts` ≤ 300, `process-output.ts` ≤ 160, `executable-inspector.ts` ≤ 200, `node-process-access.ts` ≤ 90, `plugin-data-analyzer-store.ts` ≤ 250, `analysis-coordinator.ts` ≤ 330, `fallow-analysis-service.ts` ≤ 330, `analysis-state.ts` ≤ 220, `fallow-invocation.ts` ≤ 200, `analyzer-trust.ts` ≤ 120, `analyzer-record.ts` ≤ 120 (K27 raises it to ≤ 200: it also holds the pure write function), `analysis-store.ts` ≤ 200, `FallowInstalledRoute.vue` ≤ 260, `FallowRunReview.vue` ≤ 160, `FallowRunPanel.vue` ≤ 220, `FallowRunBanner.vue` ≤ 100, `audit-copy/fallow-run.ts` ≤ 240, `read-models/fallow-run.ts` ≤ 120. A file that would pass its cap is split, never compressed.

**Layering**
- `src/domain/**` is not touched.
- `src/application/**` imports no adapter, no host, no UI and no Node module. It may use zod, `crypto.randomUUID()` (as `scan-coordinator.ts` does) and `TextDecoder`.
- Process I/O lives only in `src/adapters/fallow/`. Only `node-process-access.ts` names `node:child_process`; only `fallow-runner.ts` calls `spawn`.
- `src/ui/**` never imports `src/adapters/**` or `src/host/**`. Screens reach application types through `src/ui/read-models/fallow-run.ts` (the E20 barrel) and state through `src/ui/stores/analysis-store.ts`.
- `obsidianmd/no-nodejs-modules` stays an error in `src/**`: Node is reached only through `window.require` in the two `*-access.ts` files.

**Process safety (Z13–Z18, Z37)**
- The run argv is exactly `['--format', 'json', '--no-cache', '--quiet', '--root', root]`; the probe argv is exactly `['--version']`. The cwd is always the root.
- Spawn options are exactly `{ cwd, env, shell: false, windowsHide: true, detached: platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] }`.
- Environment allow-list: `PATH`, `SystemRoot`, `TEMP`, `TMP`, `TMPDIR`, `HOME`, `USERPROFILE`, `LOCALAPPDATA`, plus `NO_COLOR=1`; any `FALLOW_*` key and `NODE_OPTIONS` are dropped even if listed.
- Caps: stdout **16 MB** (`FALLOW_REPORT_MAX_BYTES`, in bytes); stderr keeps the last **64 KB** (`65_536`); version probe **5 s** and **4 KB** stdout; run timeout default **120 s**, min **10**, max **1800** (integer seconds, per profile); kill grace **2 s**; close grace **2 s**.
- No `shell: true`, no `*Sync` process API, no `exec`, `execFile`, `fork`, `worker_threads` or Electron opener anywhere in `src/`. No `npx`, `npm`, `fix`, `init`, `setup`, `watch`, `--fail-on-issues` or `--allow-remote-extends` string in `src/application/analysis/**` or `src/adapters/fallow/**`.
- Nothing executes on `onload`, a view open or restore, a settings refresh, a review, or a codebase bind (Z36). The probe runs only after "Trust and run" or a passing pre-run check.

**Evidence (Part 6, unchanged, plus Z23/Z25)**
- Absent evidence is never rendered or exported as `0`. No composite score, no invented confidence.
- An imported report never has `collected`; a collected report always has it. `stripPrefix` is `null` for a collected report.
- An operational run failure never removes evidence; it marks it `staleReason: 'failed-run'`. A cancel, `snapshot-changed`, `superseded`, `version-changed`, `changed-since-review`, `store-unsupported` or `source-mismatch` leaves evidence exactly as it was.
- Every value from a process, a file or `data.json` (paths, stderr, fallow's error message) is rendered through Vue text interpolation only: never `v-html`, `innerHTML` or an `href`.

**Storage**
- The only new durable key is `data.json` `analyzers[profileId]` (Z1), written only through `writePluginDataSlice` under the existing lock. Collected evidence is session-only memory (Y28). Nothing is written to the vault or to the analysed folder.
- The stored `executablePath` is the `normalizeAbsolutePath` form of the trimmed input and at most **1,024** characters (K21).

**TypeScript and lint** (carried from Part 6)
- tsconfig `lib` is ES2020: no `.at()`, `Object.hasOwn`, `replaceAll`, `findLast` in `src`.
- oxlint `--deny-warnings` with `consistent-function-scoping`: a closure that captures nothing is hoisted to module scope. No `[...set]` spread (oxlint `unicorn/no-useless-spread`, Part 6 E5): use `Array.from(set)`.
- `exactOptionalPropertyTypes` is review discipline: never assign `undefined` to an optional property; spread it in conditionally.
- zod 4: `.strict()` for our own formats, `{ error: '…' }` messages, `error.issues`.
- A regex containing a control character needs `// eslint-disable-next-line no-control-regex -- <reason>` (as `src/domain/path-safety.ts`).

**Browser globals and accessibility** (carried from Part 6)
- No bare `window`, `document`, `setTimeout`, `localStorage` in `src/ui/**`. Use `el.ownerDocument`, `nextTick`. Never `x instanceof HTMLElement`.
- Element ids come from `useUniqueId()`.
- A button that can become blocked while focused uses `aria-disabled="true"` plus a guarded handler, never `disabled` (E40).
- Announce only real outcomes (E17), through `reannounce(live, message)`. A dialog's refusal goes to its own `role="alert"`.

**Copy and CSS**
- Every new visible string goes in `src/ui/audit-copy/fallow-run.ts` (re-exported by `inspector-copy.ts` through one `export *` line), never `src/ui/copy.ts`.
- CSS only in `src/ui/styles/{kit,screens-configure}.css`, under `:where(.codebase-inspector-root)`, BEM `ci-*` classes, colours only through `--ci-*` tokens, `var(--font-ui-*)` with em fallbacks. Never edit `src/ui/styles.css`. No Vue `<style>` blocks.

**Test infrastructure**
- Tests in `tests/{unit,contracts,integration,host,build}` run in the `node` project; `tests/{component,acceptance,benchmarks,harness}` and the listed `city-view*` host tests run in `jsdom` (`vitest.config.ts`).
- Real processes in tests are spawned with `process.execPath` and `tests/fixtures/fallow-runner/fake-fallow.mjs`. Every test that starts a process cleans it up in `afterEach`, even on failure.
- `node:*` imports are allowed under `tests/**` and `scripts/**` only.
- Every new test must fail without its feature: the implementer runs it RED and pastes the output. Every `.every(...)` assertion is preceded by a non-empty check (E27).
- Edit files only with the Edit/Write tools. **Never `sed -i`, heredocs or scripts**: files are CRLF on Windows.

**Gates and commits**
- Per-task gate: `npm run typecheck && npm run lint:fast && npx vitest run <the task's test files>`, plus `npx eslint <touched files> --max-warnings 0`. Run gate commands in the foreground.
- **The WP-01 evidence-note counts are updated ONCE, in Task 14.** Before that, `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` may fail on file counts and on the missing `tests/fallow-real` layer row. Do not run the full suite per task, and do not "fix" those two tests.
- `tests/unit/install-script.test.ts` fails in a worktree without `.obsidian/`: environmental; report it, never fix it. `tests/host/clean-vault-install.test.ts` can time out on a loaded machine: re-run it alone before calling it a failure.
- Commit after each task, only the task's own files (never the ledger). Every message is written as `git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`, which puts the trailer after a blank line.

**Process**
- Implementers and reviewers never spawn subagents. Reviewers are read-only and create no files in the worktree.
- Implementers report: files changed with line counts, the gate output, the RED and GREEN output, and every deviation from this plan and why.
- The controller records every ruling in the ledger.

### Screen-task conventions (Tasks 11, 12)

- **Dialogs** follow `ConnectFallowDialog.vue`: `CiDialog`, `useBusyAction()`, the repository id checked again before and after each async step (Part 6 E36), a late result dropped after a codebase switch, Cancel/Escape/backdrop ignored while busy (Part 4 E13).
- **Component tests** follow `tests/component/connect-fallow.test.ts`: `setActivePinia(createPinia())`, `import '../mocks/obsidian'`, `buildSnapshotFixture`, `useCityStore().setCity(snap, computeLayout(snap))`, `mount(SourcesScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() } } })`, `w.unmount()`.
- The analysis store gets its service with `useAnalysisStore().setService(fake)` where `fake = createFakeFallowAnalysis()` (`tests/fixtures/fake-fallow-analysis.ts`, Task 9), then `bindRepository(repositoryId)`.

## File map

| File | Status | Task | Responsibility |
|---|---|---|---|
| `src/application/analysis/fallow-invocation.ts` | create | 1 | argv builders, caps, env allow-list, tested versions, `parseFallowVersion`, `classifyVersionProbe`, `classifyFallowExit` |
| `src/application/analysis/fallow-run-errors.ts` | create | 1 | `FallowRunErrorCode`, `OPERATIONAL_FAILURES`, `fromImportCode` |
| `src/application/analysis/analyzer-trust.ts` | create | 1 | `AnalyzerTrust`, `TrustSubject`, `fingerprintTrust`, `isTrustCurrent` |
| `src/application/ports/analyzer-process.ts` | create | 1 | `ProcessRequest`, `ProcessOutcome`, `AnalyzerProcessPort` |
| `src/application/ports/executable-inspector.ts` | create | 1 | `ExecutableFacts`, `ExecutableRefusal`, `ExecutableInspection`, `ExecutableInspectorPort` |
| `src/application/analysis/analyzer-record.ts` | create | 2 | record schema, `decodeAnalyzerRecord`, `applyAnalyzerWrite`, `AnalyzerStoreError` |
| `src/application/ports/analyzer-binding-store.ts` | create | 2 | `AnalyzerBindingStore` |
| `src/adapters/storage/plugin-data-analyzer-store.ts` | create | 2 | durable `analyzers` slice |
| `src/adapters/storage/plugin-data-shape.ts` | modify | 2 | `analyzers?: unknown` |
| `tests/fixtures/in-memory-analyzer-store.ts`, `tests/contracts/analyzer-binding-store.contract.ts` | create | 2 | the port's second implementation and its shared suite |
| `src/application/evidence/model.ts` | modify | 3 | `CollectedRunProvenance`, `collected?`, `staleReason?`, `originOf` |
| `src/application/ports/evidence-repository.ts`, `src/adapters/storage/in-memory-evidence-store.ts` | modify | 3 | `markStale` |
| `src/ui/read-models/evidence-index.ts` | modify | 3, 11 | stale after a failed run (3); `evidenceBadgeOf`, `staleCauseOf`, origin provenance (11) |
| `src/application/analysis/analysis-state.ts` | create | 4 | reducer, `mayPublish`, `isActive`, `isCancellable` |
| `src/application/analysis/analysis-coordinator.ts` | create | 4 | `AnalysisCoordinator` |
| `tests/fixtures/fake-process-port.ts` | create | 4 | scriptable `AnalyzerProcessPort` |
| `src/application/analysis/fallow-analysis-service.ts` | create | 5 | `FallowAnalysisService`, `createFallowAnalysisService` |
| `tests/fixtures/fake-executable-inspector.ts` | create | 5 | scriptable inspector |
| `src/adapters/fallow/executable-inspector.ts` | create | 6 | `createExecutableInspector` |
| `src/adapters/filesystem/node-globals.d.ts` | modify | 6 | `realpath`, `open`, `NodeFileHandleLike` |
| `src/adapters/fallow/node-process-access.ts` | create | 7 | the only `window.require('node:child_process')` |
| `src/adapters/fallow/process-output.ts` | create | 7 | stdout collector, stderr tail, `cleanLog`, `buildChildEnv` |
| `src/adapters/fallow/fallow-runner.ts` | create | 7 | `createFallowRunner`, the only `spawn` |
| `src/adapters/filesystem/node-access.ts` | modify | 7 | header comment only |
| `tests/fixtures/process-guard.ts`, `tests/unit/no-process-execution.test.ts`, `tests/unit/node-access-boundary.test.ts` | modify | 7 | the deliberate guard amendment |
| `tests/fixtures/fake-child-process.ts`, `tests/fixtures/real-spawn.ts`, `tests/fixtures/fallow-runner/{fake-fallow.mjs,README.md}` | create | 7 | process doubles and the fake fallow |
| `tests/integration/fallow-analysis.test.ts`, `tests/unit/fallow-argv-policy.test.ts` | create | 8 | the real stack; the policy scan |
| `scripts/fetch-fallow.mjs`, `vitest.fallow.config.ts`, `tests/fallow-real/fallow-real.test.ts` | create | 8 | `npm run test:fallow` |
| `package.json`, `.gitignore`, `eslint.config.mjs`, `.oxlintrc.json` | modify | 8 | the script and the ignores |
| `src/ui/audit-copy/fallow-run.ts` | create | 9 | every new string (§2 of the spec) |
| `src/ui/stores/analysis-store.ts`, `src/ui/read-models/fallow-run.ts` | create | 9 | per-leaf store; the barrel and `fallowRunBannerOf` |
| `src/host/analysis-notices.ts` | create | 9 | `watchAnalysisFailures` |
| `src/host/{city-scan-controller,data-ports,city-view,commands}.ts`, `src/main.ts`, `src/ui/App.vue`, `src/ui/inspector-copy.ts` | modify | 9 | wiring, commands, onunload |
| `scripts/assert-bundle.mjs`, `tests/unit/assert-bundle.test.ts` | modify | 9 | exactly one `node:child_process` (K23) |
| `tests/fixtures/fake-fallow-analysis.ts`, `tests/fixtures/data-port-deps.ts` | create / modify | 9 | the service double for component, host and harness tests |
| `src/host/{setting-definitions,settings-tab}.ts`, `src/main.ts` | modify | 10 | two profile rows, Forget, the time limit, purge, the disclosure |
| `src/ui/kit/EvidenceBadge.vue`, `src/ui/styles/kit.css` | modify | 11 | the `collected` state |
| `src/ui/audit-copy/{fallow,quality,report,sources}.ts`; `src/ui/read-models/{sources,overview,findings}.ts`; `src/ui/screens/{QualityScreen,FileDetailScreen,SourcesScreen}.vue`, `city/LensHeading.vue`, `file/FileFindingsPanel.vue`, `quality/FindingReviewDialog.vue`, `sources/{FallowCardDetails,FallowReportFacts,ConnectFallowDialog}.vue` | modify | 11 | origin-aware copy and badges |
| `src/ui/screens/sources/{FallowInstalledRoute,FallowRunReview,FallowRunPanel,FallowRunBanner}.vue`, `src/ui/screens/sources/use-fallow-run.ts` | create | 12 | the installed route, review, run panel, banner and run controls |
| `src/ui/screens/sources/{ConnectFallowDialog,FallowCardDetails}.vue`, `src/ui/screens/SourcesScreen.vue`, `src/ui/styles/screens-configure.css` | modify | 12 | route choice, card, request watcher, planned panel removed |
| `tests/harness/{page,seed,mount}.ts`, `tests/harness/harness-evidence.test.ts`, `scripts/harness-shot.mjs`, `tests/build/harness-shot.test.ts` | modify | 13 | `?fallow=routes` or `installed`, `?analysis=…`, six shots |
| `docs/superpowers/notes/2026-09-17-wp01-{gate-evidence,implementation-report,limitations}.md`, `docs/deliverables/Fallow Ingestion.md`, `tests/unit/evidence-numbers.test.ts` | modify | 9, 10, 14 | command and settings lists (9, 10); counts, G6 section, limitations, delivery record (14) |

## Planning amendments (these override the task text below)

Each amendment cites its ledger ruling (K-numbers in `docs/superpowers/notes/2026-09-23-wp02-part7-ledger.md`). Where a task's text disagrees with an amendment, **the amendment wins**.

- **A1 (K19): `node-access-boundary.test.ts` is amended with the guard.** It pins `window.require` to `node-access.ts` alone; the spec does not mention it. Task 7 widens its expectation to exactly `adapters/fallow/node-process-access.ts` and `adapters/filesystem/node-access.ts`.
- **A2 (K20): the checkpoint-#4 lists move with the controls.** `tests/host/clean-vault-install.test.ts` requires the implementation report's `checkpoint4:commands` and `checkpoint4:settings` blocks to equal what `commands.ts` and `setting-definitions.ts` build. Task 9 adds the two commands to the report; Task 10 adds the two settings rows. Settings row names are string literals (`name: 'fallow executable'`, `name: 'fallow time limit'`) so that guard can read them.
- **A3 (K21): the stored path is the normalised form, at most 1,024 characters.** `normalizeAbsolutePath` caps at 1,024 (`MAX_PATH_LENGTH`), so the spec's 4,096 cannot be reached. The record schema accepts only a path equal to its own `normalizeAbsolutePath` form.
- **A4 (K22): `insideRoot` also compares real paths.** The inspector resolves the root with `realpath` too, so a root reached through a symlink or junction still flags an executable inside it (Review Focus 3).
- **A5 (K23): the `assert-bundle` check lands with the wiring (Task 9), not with the runner (Task 7).** Until `main.ts` imports the runner, `dist/main.js` has no `node:child_process`, and an "exactly once" check would fail every build (including `tests/global-setup.ts`).
- **A6 (K24): `classifyFallowExit` returns a three-arm union** `{ kind: 'completed'; report } | { kind: 'cancelled' } | { kind: 'failed'; code; detail }`, and takes `timeoutSeconds` for the `timed-out` detail. The probe is classified by its own `classifyVersionProbe`.
- **A7 (K25): `RunPlan.onProbePassed` resolves `'continue' | 'version-changed' | 'changed-since-review'`.** The service answers `'changed-since-review'` when `grantTrust` refuses (the stored path moved under the run).
- **A8 (K26): probing and running states carry `rootPath`,** so `fallowRunBannerOf(state, hasEvidence)` can name the folder; `hasEvidence` selects whether "Current findings stay…" is said.
- **A9 (K28): the contracts layer gains one test file** (`tests/contracts/fallow-runner.test.ts`). Task 14 extends `evidence-numbers.test.ts`'s Contract-row formula with its `it(` count, and adds a `tests/fallow-real` row (Ran: opt-in) to the G8 table in both documents.
- **A10: pre-flight.** Before each dispatch the controller re-checks every "Consumes" name against what earlier tasks actually committed.

## Task outline and interface contracts

The names and signatures below are binding across tasks.

**Task 1 (Z6, Z7, Z8, Z9, Z15, Z16, Z17, Z19, exit semantics).** Produces:
- `src/application/analysis/fallow-invocation.ts`: `FALLOW_RUN_ARGS(root: string): readonly string[]`; `FALLOW_VERSION_ARGS: readonly string[]`; the constants `FALLOW_VERSION_TIMEOUT_MS = 5_000`, `FALLOW_VERSION_MAX_BYTES = 4_096`, `FALLOW_STDOUT_MAX_BYTES = FALLOW_REPORT_MAX_BYTES`, `FALLOW_STDERR_TAIL_BYTES = 65_536`, `FALLOW_KILL_GRACE_MS = 2_000`, `FALLOW_CLOSE_GRACE_MS = 2_000`, `FALLOW_TIMEOUT_DEFAULT_S = 120`, `FALLOW_TIMEOUT_MIN_S = 10`, `FALLOW_TIMEOUT_MAX_S = 1800`, `FALLOW_ERROR_MESSAGE_MAX = 500`, `FALLOW_TESTED_VERSIONS: readonly string[]`, `FALLOW_ENV_ALLOW_LIST: readonly string[]`, `FALLOW_ENV_EXTRA: Readonly<Record<string, string>>`; `isValidTimeoutSeconds(n: unknown): n is number`; `parseFallowVersion(stdout: string | null): FallowVersion`; `classifyVersionProbe(outcome: ProcessOutcome): VersionProbeResult`; `classifyFallowExit(outcome: ProcessOutcome, timeoutSeconds: number): FallowExitResult`.
- `src/application/analysis/fallow-run-errors.ts`: `FallowRunErrorCode`, `FALLOW_RUN_ERROR_CODES`, `OPERATIONAL_FAILURES: ReadonlySet<FallowRunErrorCode>`, `fromImportCode(code: FallowImportErrorCode): FallowRunErrorCode`.
- `src/application/analysis/analyzer-trust.ts`: `AnalyzerTrust { fingerprint; version; grantedAt }`, `TrustSubject { profileId; machineId; rootPath; args; facts }`, `fingerprintTrust(subject, version): string`, `isTrustCurrent(trust: AnalyzerTrust | null, subject, version): boolean`.
- `src/application/ports/analyzer-process.ts`: `ProcessRequest`, `ProcessOutcome`, `AnalyzerProcessPort { run(request, token): Promise<ProcessOutcome>; killAll(): void }`.
- `src/application/ports/executable-inspector.ts`: `ExecutableFormat`, `ExecutableFacts`, `ExecutableRefusal`, `ExecutableInspection`, `ExecutableInspectorPort { inspect(executablePath, rootPath): Promise<ExecutableInspection>; readonly executableName: 'fallow.exe' | 'fallow' }`.

**Task 2 (Z1, Z2, Z3).** Produces `AnalyzerBinding`, `AnalyzerBindingRead`, `AnalyzerWrite`, `AnalyzerStoreErrorCode`, `AnalyzerStoreError`, `decodeAnalyzerRecord(slice, profileId, machineId)`, `applyAnalyzerWrite(slice, profileId, machineId, write)` (all in `analyzer-record.ts`); `AnalyzerBindingStore` (port); `createPluginDataAnalyzerStore(plugin, machineId)`; `createInMemoryAnalyzerStore(machineId?, initial?)` (tests); `runAnalyzerBindingStoreContract(label, make)` (tests).

**Task 3 (Z23, Z25).** Produces `CollectedRunProvenance`, `EvidenceOrigin`, `originOf(report)`, `EvidenceReport.collected?`, `EvidenceReport.staleReason?`, `EvidenceRepository.markStale(repositoryId)`.

**Task 4 (Z20, Z21, Z24).** Produces `AnalysisIdentity`, `AnalysisRunState`, `AnalysisAction`, `IDLE`, `isActive`, `isCancellable`, `reduceAnalysis`, `mayPublish` (`analysis-state.ts`); `RunPlan`, `AnalysisCoordinatorDeps`, `AnalysisCoordinator { stateOf; subscribe; start; cancel; shutdown }`; `createFakeProcessPort()` (tests).

**Task 5 (Z7, Z8, Z10, Z11, Z22, Z36).** Produces `AnalyzerBindingView`, `RunReview`, `ReviewResult`, `TrustCheck`, `StartOutcome`, `FallowAnalysisService`, `FallowAnalysisServiceDeps`, `createFallowAnalysisService(deps)`; `createFakeExecutableInspector()` and `factsFor(path, overrides?)` (tests).

**Task 6 (Z4, Z5).** Produces `ExecutableInspectorDeps`, `createExecutableInspector(deps?)`.

**Task 7 (Z14–Z18, Z37, Z38 runner).** Produces `childProcess`, `nodeProcess`, `SpawnLike`, `SpawnOptionsLike`, `ChildProcessLike`, `ReadableLike`, `NodeProcessLike` (`node-process-access.ts`); `createStdoutCollector`, `createStderrTail`, `cleanLog`, `buildChildEnv` (`process-output.ts`); `FallowRunnerDeps`, `createFallowRunner(deps?)`; the guard labels `'spawn call'` and `'shell option'`; `injectStatement(source, kind, statement)`.

**Task 8 (Z38 integration and policy, Z40, Z41).** Produces the `test:fallow` script, `scripts/fetch-fallow.mjs`, `vitest.fallow.config.ts`, the real-binary suite.

**Task 9 (Z24, Z28, Z34, Z35, Z36).** Produces every §2 string in `audit-copy/fallow-run.ts`; `InstalledRouteStart`, `FallowRunBanner`, `LOG_SHOWN_CHARS`, `fallowRunBannerOf(state, hasEvidence)`, `refusalBanner(code, detail)` (`read-models/fallow-run.ts`); `useAnalysisStore`; `watchAnalysisFailures(service, notify)`; `CityViewDeps.fallowAnalysis`; `requestFallowRun(pinia)`; `CityView.requestFallowRun / isAnalysisActive / isAnalysisCancellable / cancelAnalysis`; the commands `run-fallow-analysis` and `cancel-fallow-analysis`; `createFakeFallowAnalysis()`, `fakeRunReview(...)`, `HARNESS_EXECUTABLE` (tests).

**Task 10 (Z11, Z12).** Produces `ProfileEntry.analyzer`, `SettingDefinitionsCallbacks.onForgetAnalyzer / onAnalyzerTimeoutChange`, the settings tab's seventh constructor parameter, the new `STORAGE_DISCLOSURE_TEXT`.

**Task 11 (Z23 notice, Z26, Z27).** Produces `EvidenceBadgeProps`, `evidenceBadgeOf(report, stale)`, `staleCauseOf(report)`, `FALLOW_ROW_COLLECTED`, the origin parameters (default `'imported'`) on the Part 6 copy functions (§2 "Changed Part 6 strings"), `FileFindingsPanel`'s `badge` prop (K31) and `collectedEvidenceReport(snapshot, versionTested?)` (tests).

**Task 12 (Z29–Z33, Z35 screen half).** Produces `FallowInstalledRoute.vue` (props `start`, `action`), `FallowRunReview.vue`, `FallowRunPanel.vue`, `FallowRunBanner.vue`, `useFallowRun(open, announce, hasEvidence)`, and `ConnectFallowDialog`'s `initialRoute` and `installed` props.

**Task 13 (Z42).** Produces the harness parameters and the six shots.

**Task 14 (Z43, Z44, acceptance).** Produces the evidence and delivery records.

## Review Focus

Five input classes or failure modes the spec implies but that no spec-listed test exercises, most likely first. Each has a pinning test in its owning task.

1. **A UTF-8 character split across two stdout chunks.** fallow prints paths and messages with non-ASCII characters; a pipe can cut a multibyte sequence anywhere. Decoding per chunk would turn a valid report into `output-not-json`. **Pinned in Task 7** (`tests/unit/process-output.test.ts`, "decodes a character split across two chunks", and the same with the split at exactly `maxBytes`).
2. **Paths with spaces and non-ASCII characters** in the executable path and the root (`C:\Program Files\fallow\fallow.exe`, `…\Jörg\my repo`). They must reach the child unquoted and unchanged, be shown exactly, and fingerprint stably. **Pinned in Task 7** (contract: fake fallow `argv` and `cwd` modes under a root named `my repo ü`), **Task 1** (the fingerprint of a non-ASCII path is stable and differs from its NFD form), and **Task 6** (inspection under a folder with a space and `ü`).
3. **A root reached through a symlink or junction.** `isContained(rootPath, realPath)` is false when the root is a link and the executable's real path lies in its target. **Pinned in Task 6** ("flags an executable inside a root reached through a junction", K22).
4. **The executable deleted or replaced between the trust check and the spawn.** The pre-run check passes, then the file is gone at spawn time. It must fail as `executable-missing`, keep the old evidence (marked stale), and leave trust untouched; and a review whose file vanishes before "Trust and run" must bind nothing. **Pinned in Task 4** ("a binary that vanished after the check fails as executable-missing") and **Task 5** ("Trust and run after the file vanished binds nothing").
5. **A slow stdout trickle that never goes quiet.** A timer reset by output would never fire. The timeout is absolute from spawn. **Pinned in Task 7** (runner unit test with fake timers: data every second for 200 s under a 120 s limit ends `timed-out` at 120 s; contract: fake fallow `trickle` under a 500 ms limit).

---

### Task 1: The invocation contract, exit semantics, error codes and the trust fingerprint (Z6, Z7, Z8, Z9, Z15, Z16, Z17, Z19, exit semantics)

Pure application code and two ports. Nothing here runs a process: it is the data the runner, the coordinator and the service share.

**Files:**
- Create: `src/application/analysis/fallow-run-errors.ts` (~50)
- Create: `src/application/ports/analyzer-process.ts` (~45)
- Create: `src/application/ports/executable-inspector.ts` (~40)
- Create: `src/application/analysis/analyzer-trust.ts` (~50)
- Create: `src/application/analysis/fallow-invocation.ts` (~150)
- Test: `tests/unit/fallow-invocation.test.ts` (new, ~130)
- Test: `tests/unit/analyzer-trust.test.ts` (new, ~75)

**Interfaces:**
- Consumes: `parseFallowReportText(text: string): FallowReadResult` (`src/application/evidence/read-fallow-report.ts`); `FALLOW_REPORT_MAX_BYTES`, `FallowImportErrorCode`, `RawFallowReport` (`src/application/evidence/raw-fallow.ts`); `fnv1a32Hex(text: string): string` (`src/domain/hash.ts`); `fingerprintSource(resolvedRoot: string): string` (`src/application/approval.ts`); `CancellationToken` (`src/application/ports/cancellation-token.ts`); `fallowText('combined-3.27.0')` (`tests/fixtures/fallow-fixture.ts`).
- Produces: everything listed for Task 1 in the outline above, with these exact shapes:
  - `type ProcessOutcome = { kind: 'exited'; exitCode: number; stdout: string | null; stdoutBytes: number; stderrTail: string } | { kind: 'signalled'; signal: string; stderrTail: string } | { kind: 'timed-out'; stderrTail: string } | { kind: 'cancelled'; stderrTail: string } | { kind: 'stdout-too-large'; stderrTail: string } | { kind: 'output-incomplete'; stderrTail: string } | { kind: 'spawn-failed'; errorCode: string }`
  - `type FallowVersion = { ok: true; version: string; major: number; tested: boolean } | { ok: false }`
  - `type VersionProbeResult = { ok: true; version: string; tested: boolean } | { ok: false; code: FallowRunErrorCode; detail: string }`
  - `type FallowExitResult = { kind: 'completed'; report: RawFallowReport } | { kind: 'cancelled' } | { kind: 'failed'; code: FallowRunErrorCode; detail: string }` (A6)

- [ ] **Step 1: Write the failing tests.**

Create `tests/unit/fallow-invocation.test.ts`:

```ts
// Part 7 Z8/Z9/Z15/Z16/Z19 and the spec's §1 "Exit semantics" table: how fallow is invoked
// and how a finished process is read. Pure: no process is started here.
import { describe, expect, it } from 'vitest';
import {
  FALLOW_ENV_ALLOW_LIST, FALLOW_ENV_EXTRA, FALLOW_RUN_ARGS, FALLOW_TESTED_VERSIONS, FALLOW_VERSION_ARGS,
  classifyFallowExit, classifyVersionProbe, isValidTimeoutSeconds, parseFallowVersion,
} from '../../src/application/analysis/fallow-invocation';
import { FALLOW_RUN_ERROR_CODES, OPERATIONAL_FAILURES, fromImportCode, type FallowRunErrorCode } from '../../src/application/analysis/fallow-run-errors';
import type { ProcessOutcome } from '../../src/application/ports/analyzer-process';
import { fallowText } from '../fixtures/fallow-fixture';

const exited = (exitCode: number, stdout: string | null): ProcessOutcome =>
  ({ kind: 'exited', exitCode, stdout, stdoutBytes: stdout === null ? 0 : stdout.length, stderrTail: '' });
const ERROR_MESSAGE = "invalid root path '/nope': No such file or directory (os error 2)";
const ERROR_JSON = JSON.stringify({ error: true, message: ERROR_MESSAGE, exit_code: 2 });
const REPORT = fallowText('combined-3.27.0');

describe('the fallow invocation (Z15, Z16, Z10)', () => {
  it('runs combined mode with exactly these arguments, the root last and unquoted', () => {
    expect(FALLOW_RUN_ARGS('C:\\Program Files\\my repo')).toEqual(['--format', 'json', '--no-cache', '--quiet', '--root', 'C:\\Program Files\\my repo']);
    expect(FALLOW_VERSION_ARGS).toEqual(['--version']);
  });

  it('passes on only the allow-listed environment, plus NO_COLOR', () => {
    expect(FALLOW_ENV_ALLOW_LIST).toEqual(['PATH', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'LOCALAPPDATA']);
    expect(FALLOW_ENV_EXTRA).toEqual({ NO_COLOR: '1' });
  });

  it('accepts a time limit only as whole seconds from 10 to 1800', () => {
    for (const ok of [10, 120, 1800]) expect(isValidTimeoutSeconds(ok), String(ok)).toBe(true);
    for (const bad of [9, 1801, 12.5, Number.NaN, '120', null]) expect(isValidTimeoutSeconds(bad), String(bad)).toBe(false);
  });
});

describe('the version probe (Z8, Z9)', () => {
  it('reads "fallow x.y.z" and says whether that version was tested', () => {
    expect(parseFallowVersion('fallow 3.27.0\n')).toEqual({ ok: true, version: '3.27.0', major: 3, tested: true });
    expect(parseFallowVersion('fallow 3.21.0')).toEqual({ ok: true, version: '3.21.0', major: 3, tested: true });
    expect(parseFallowVersion('fallow 3.28.0')).toEqual({ ok: true, version: '3.28.0', major: 3, tested: false });
    expect(FALLOW_TESTED_VERSIONS).toEqual(['3.21.0', '3.27.0']);
  });

  it('refuses anything else, including a version longer than the record can hold', () => {
    for (const bad of [null, '', '3.27.0', 'fallow v3.27.0', 'fallow 3.27', 'fallow 3.27.0 extra', `fallow ${'9'.repeat(40)}.0.0`]) {
      expect(parseFallowVersion(bad), String(bad)).toEqual({ ok: false });
    }
  });

  it('classifies every probe outcome', () => {
    expect(classifyVersionProbe(exited(0, 'fallow 3.27.0'))).toEqual({ ok: true, version: '3.27.0', tested: true });
    expect(classifyVersionProbe(exited(0, 'fallow 3.28.0'))).toEqual({ ok: true, version: '3.28.0', tested: false });
    expect(classifyVersionProbe(exited(0, 'fallow 4.0.0'))).toEqual({ ok: false, code: 'version-unsupported', detail: '4.0.0' });
    expect(classifyVersionProbe(exited(0, 'hello'))).toEqual({ ok: false, code: 'version-probe-failed', detail: 'no-version' });
    expect(classifyVersionProbe(exited(3, 'fallow 3.27.0'))).toEqual({ ok: false, code: 'version-probe-failed', detail: '3' });
    expect(classifyVersionProbe({ kind: 'timed-out', stderrTail: '' })).toEqual({ ok: false, code: 'version-probe-failed', detail: 'timeout' });
    expect(classifyVersionProbe({ kind: 'spawn-failed', errorCode: 'ENOENT' })).toEqual({ ok: false, code: 'executable-missing', detail: '' });
    expect(classifyVersionProbe({ kind: 'spawn-failed', errorCode: 'EACCES' })).toEqual({ ok: false, code: 'spawn-failed', detail: 'EACCES' });
    expect(classifyVersionProbe({ kind: 'signalled', signal: 'SIGSEGV', stderrTail: '' })).toEqual({ ok: false, code: 'version-probe-failed', detail: 'SIGSEGV' });
    expect(classifyVersionProbe({ kind: 'stdout-too-large', stderrTail: '' })).toEqual({ ok: false, code: 'version-probe-failed', detail: 'no-version' });
    expect(classifyVersionProbe({ kind: 'output-incomplete', stderrTail: '' })).toEqual({ ok: false, code: 'version-probe-failed', detail: 'no-version' });
    expect(classifyVersionProbe({ kind: 'cancelled', stderrTail: '' })).toEqual({ ok: false, code: 'version-probe-failed', detail: 'cancelled' });
  });
});

describe('exit semantics (spec §1)', () => {
  it('exit 0 or 1 with a supported report is completed: findings are not an operational failure (S8)', () => {
    for (const code of [0, 1]) {
      const result = classifyFallowExit(exited(code, REPORT), 120);
      expect(result.kind, String(code)).toBe('completed');
      if (result.kind === 'completed') expect(result.report.kind).toBe('combined');
    }
  });

  it('a cancelled run is cancelled, never failed', () => {
    expect(classifyFallowExit({ kind: 'cancelled', stderrTail: 'bye' }, 120)).toEqual({ kind: 'cancelled' });
  });

  it.each<[string, ProcessOutcome, FallowRunErrorCode, string]>([
    ['exit 0 with the error object', exited(0, ERROR_JSON), 'analyzer-error', ERROR_MESSAGE],
    ['exit 2 with the error object', exited(2, ERROR_JSON), 'analyzer-error', ERROR_MESSAGE],
    ['exit 2 with an error object and no message', exited(2, '{"error":true}'), 'analyzer-error', ''],
    ['exit 2 with a message longer than 500 characters', exited(2, JSON.stringify({ error: true, message: 'x'.repeat(600) })), 'analyzer-error', 'x'.repeat(500)],
    ['exit 2 with anything else', exited(2, 'boom'), 'exit-code', '2'],
    ['exit 0 with no output', exited(0, ''), 'output-not-json', ''],
    ['exit 0 with output that is not UTF-8', exited(0, null), 'output-not-json', ''],
    ['exit 1 with a truncated report', exited(1, REPORT.slice(0, Math.floor(REPORT.length / 2))), 'output-not-json', ''],
    ['exit 0 with an unsupported schema', exited(0, JSON.stringify({ kind: 'combined', schema_version: 99, version: '3.27.0' })), 'output-unsupported', 'combined@99'],
    ['exit 0 with an invalid report', exited(0, JSON.stringify({ kind: 'combined', schema_version: 12, version: 7 })), 'output-invalid', 'version'],
    ['exit 3', exited(3, REPORT), 'exit-code', '3'],
    ['a signal the adapter did not send', { kind: 'signalled', signal: 'SIGSEGV', stderrTail: '' }, 'exit-code', 'SIGSEGV'],
    ['the time limit', { kind: 'timed-out', stderrTail: '' }, 'timed-out', '120'],
    ['the stdout cap', { kind: 'stdout-too-large', stderrTail: '' }, 'output-too-large', ''],
    ['pipes that never closed', { kind: 'output-incomplete', stderrTail: '' }, 'output-incomplete', ''],
    ['a missing executable', { kind: 'spawn-failed', errorCode: 'ENOENT' }, 'executable-missing', ''],
    ['any other spawn failure', { kind: 'spawn-failed', errorCode: 'EACCES' }, 'spawn-failed', 'EACCES'],
  ])('%s', (_label, outcome, code, detail) => {
    expect(classifyFallowExit(outcome, 120)).toEqual({ kind: 'failed', code, detail });
  });
});

describe('run error codes (Z19)', () => {
  it('maps every Part 6 reader code onto a run code', () => {
    expect(fromImportCode('too-large')).toBe('output-too-large');
    expect(fromImportCode('not-json')).toBe('output-not-json');
    expect(fromImportCode('unsupported')).toBe('output-unsupported');
    expect(fromImportCode('invalid')).toBe('output-invalid');
    expect(fromImportCode('source-mismatch')).toBe('source-mismatch');
    expect(fromImportCode('read-failed')).toBe('output-incomplete');
  });

  it('treats exactly fourteen of the twenty codes as operational failures', () => {
    expect(FALLOW_RUN_ERROR_CODES).toHaveLength(20);
    const quiet: FallowRunErrorCode[] = ['changed-since-review', 'store-unsupported', 'version-changed', 'source-mismatch', 'snapshot-changed', 'superseded'];
    for (const code of quiet) expect(OPERATIONAL_FAILURES.has(code), code).toBe(false);
    expect(OPERATIONAL_FAILURES.size).toBe(14);
    for (const code of FALLOW_RUN_ERROR_CODES.filter((c) => !quiet.includes(c))) expect(OPERATIONAL_FAILURES.has(code), code).toBe(true);
  });
});
```

Create `tests/unit/analyzer-trust.test.ts`:

```ts
// Part 7 Z6/Z7: trust is a fingerprint of exactly what was reviewed, never a boolean. Any
// change to what it covers makes it stale, and the run's time limit is not one of them.
import { describe, expect, it } from 'vitest';
import { fingerprintTrust, isTrustCurrent, type TrustSubject } from '../../src/application/analysis/analyzer-trust';
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import type { ExecutableFacts } from '../../src/application/ports/executable-inspector';

const FACTS: ExecutableFacts = {
  executablePath: 'C:\\Tools\\fallow\\fallow.exe', realPath: 'C:\\Tools\\fallow\\fallow.exe',
  size: 12_400_000, mtimeMs: 1_758_600_000_123.75, format: 'pe', insideRoot: false,
};
function subject(overrides: Partial<TrustSubject> = {}, facts: Partial<ExecutableFacts> = {}): TrustSubject {
  return { profileId: 'p1', machineId: 'm1', rootPath: 'C:\\repo', args: FALLOW_RUN_ARGS('C:\\repo'), facts: { ...FACTS, ...facts }, ...overrides };
}
const BASE = fingerprintTrust(subject(), '3.27.0');

describe('fingerprintTrust (Z6)', () => {
  it('is eight lower-case hex digits and the same for the same inputs', () => {
    expect(BASE).toMatch(/^[0-9a-f]{8}$/);
    expect(fingerprintTrust(subject(), '3.27.0')).toBe(BASE);
  });

  it.each<[string, TrustSubject, string]>([
    ['the profile', subject({ profileId: 'p2' }), '3.27.0'],
    ['the machine', subject({ machineId: 'm2' }), '3.27.0'],
    ['the executable path', subject({}, { executablePath: 'C:\\Tools\\fallow2\\fallow.exe' }), '3.27.0'],
    ['the real path', subject({}, { realPath: 'D:\\cache\\fallow.exe' }), '3.27.0'],
    ['the size', subject({}, { size: 12_400_001 }), '3.27.0'],
    ['the modification time, to the millisecond', subject({}, { mtimeMs: 1_758_600_000_124 }), '3.27.0'],
    ['the root', subject({ rootPath: 'C:\\other', args: FALLOW_RUN_ARGS('C:\\repo') }), '3.27.0'],
    ['the arguments', subject({ args: [...FALLOW_RUN_ARGS('C:\\repo'), '--production'] }), '3.27.0'],
    ['the version', subject(), '3.28.0'],
  ])('changes when %s changes', (_label, changed, version) => {
    expect(fingerprintTrust(changed, version)).not.toBe(BASE);
  });

  it('ignores the sub-millisecond part of the modification time', () => {
    expect(fingerprintTrust(subject({}, { mtimeMs: 1_758_600_000_123.2 }), '3.27.0')).toBe(BASE);
  });

  it('treats a root that differs only in case as a different root (M29: re-ask, never widen consent)', () => {
    expect(fingerprintTrust(subject({ rootPath: 'c:\\REPO' }), '3.27.0')).not.toBe(BASE);
  });

  it('Review Focus 2: a path with spaces and non-ASCII characters fingerprints stably, and differs from its NFD spelling', () => {
    const nfc = subject({ rootPath: 'C:\\Users\\J\u00f6rg\\my repo' }, { executablePath: 'C:\\Program Files\\fallow\\fallow.exe' });
    const nfd = subject({ rootPath: 'C:\\Users\\Jo\u0308rg\\my repo' }, { executablePath: 'C:\\Program Files\\fallow\\fallow.exe' });
    expect(fingerprintTrust(nfc, '3.27.0')).toBe(fingerprintTrust(nfc, '3.27.0'));
    expect(fingerprintTrust(nfc, '3.27.0')).not.toBe(fingerprintTrust(nfd, '3.27.0'));
  });
});

describe('isTrustCurrent (Z7)', () => {
  const trust = { fingerprint: BASE, version: '3.27.0', grantedAt: '2026-09-23T10:00:00.000Z' };

  it('is never current without a trust record', () => {
    expect(isTrustCurrent(null, subject(), '3.27.0')).toBe(false);
  });

  it('is current only for the same subject and the same version', () => {
    expect(isTrustCurrent(trust, subject(), '3.27.0')).toBe(true);
    expect(isTrustCurrent(trust, subject(), '3.28.0')).toBe(false);
    expect(isTrustCurrent(trust, subject({}, { size: 1 }), '3.27.0')).toBe(false);
    expect(isTrustCurrent({ ...trust, fingerprint: '00000000' }, subject(), '3.27.0')).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/unit/fallow-invocation.test.ts tests/unit/analyzer-trust.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/application/analysis/fallow-invocation"` (and `…/analyzer-trust`).

- [ ] **Step 3: Implement.**

Create `src/application/ports/analyzer-process.ts`:

```ts
// Part 7 Z13/Z15/Z18: how the application asks for a process, and what it gets back. The
// adapter (src/adapters/fallow/fallow-runner.ts) is generic: the application builds the
// argv (fallow-invocation.ts), so a test can run any executable through the same adapter.
import type { CancellationToken } from './cancellation-token';

export interface ProcessRequest {
  executablePath: string;
  args: readonly string[];
  /** Always the analysed root (Z15). */
  cwd: string;
  timeoutMs: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
}

/** Z18: every way a run can end. `run` never rejects. `stdout` is null when the bytes were
 *  not valid UTF-8. `stderrTail` is already cleaned for display (process-output.ts). */
export type ProcessOutcome =
  | { kind: 'exited'; exitCode: number; stdout: string | null; stdoutBytes: number; stderrTail: string }
  | { kind: 'signalled'; signal: string; stderrTail: string }
  | { kind: 'timed-out'; stderrTail: string }
  | { kind: 'cancelled'; stderrTail: string }
  | { kind: 'stdout-too-large'; stderrTail: string }
  | { kind: 'output-incomplete'; stderrTail: string }
  | { kind: 'spawn-failed'; errorCode: string };

export interface AnalyzerProcessPort {
  run(request: ProcessRequest, token: CancellationToken): Promise<ProcessOutcome>;
  /** Z24: kills every live child synchronously and resolves every pending run as cancelled. */
  killAll(): void;
}
```

Create `src/application/ports/executable-inspector.ts`:

```ts
// Part 7 Z4/Z5: what is known about the executable before anything runs. The adapter
// (src/adapters/fallow/executable-inspector.ts) stats it and reads its first 4 bytes; it
// never executes it.
export type ExecutableFormat = 'pe' | 'elf' | 'mach-o';

export interface ExecutableFacts {
  /** The normalised absolute path, as bound and as shown. */
  executablePath: string;
  realPath: string;
  size: number;
  mtimeMs: number;
  format: ExecutableFormat;
  /** Z5 (K22): inside the analysed root, by its path, its real path, or the root's real path. */
  insideRoot: boolean;
}

export type ExecutableRefusal =
  | 'not-absolute' | 'wrong-name' | 'launcher' | 'executable-missing' | 'not-a-file' | 'not-native' | 'unreadable';

/** `detail` is data for the copy: the expected name for `wrong-name` and `launcher`, the
 *  error code for `unreadable`, '' otherwise. */
export type ExecutableInspection =
  | { ok: true; facts: ExecutableFacts }
  | { ok: false; refusal: ExecutableRefusal; detail: string };

export interface ExecutableInspectorPort {
  inspect(executablePath: string, rootPath: string): Promise<ExecutableInspection>;
  /** The only accepted base name on this platform, for the path hint (Z22, K41). */
  readonly executableName: 'fallow.exe' | 'fallow';
}
```

Create `src/application/analysis/fallow-run-errors.ts`:

```ts
// Part 7 Z19: every way a fallow run can be refused or fail. It sits BESIDE Part 6's
// FallowImportErrorCode: import refusals are about a picked file, run failures about a
// process. `detail` is always data for the copy (src/ui/audit-copy/fallow-run.ts), never copy.
import type { FallowImportErrorCode } from '../evidence/raw-fallow';

export type FallowRunErrorCode =
  | 'root-unavailable' | 'executable-missing' | 'executable-refused' | 'changed-since-review' | 'store-unsupported'
  | 'version-probe-failed' | 'version-unsupported' | 'version-changed' | 'spawn-failed' | 'timed-out'
  | 'output-too-large' | 'output-incomplete' | 'output-not-json' | 'output-unsupported' | 'output-invalid'
  | 'analyzer-error' | 'exit-code' | 'source-mismatch' | 'snapshot-changed' | 'superseded';

export const FALLOW_RUN_ERROR_CODES: readonly FallowRunErrorCode[] = [
  'root-unavailable', 'executable-missing', 'executable-refused', 'changed-since-review', 'store-unsupported',
  'version-probe-failed', 'version-unsupported', 'version-changed', 'spawn-failed', 'timed-out',
  'output-too-large', 'output-incomplete', 'output-not-json', 'output-unsupported', 'output-invalid',
  'analyzer-error', 'exit-code', 'source-mismatch', 'snapshot-changed', 'superseded',
];

/** Not operational: a changed trust subject, a newer data format, a newer snapshot or
 *  newer evidence, or a report that matches nothing. None of these marks evidence stale. */
const NOT_OPERATIONAL: readonly FallowRunErrorCode[] = [
  'changed-since-review', 'store-unsupported', 'version-changed', 'source-mismatch', 'snapshot-changed', 'superseded',
];

/** Z19/Z23: only these mark the old evidence stale, and only these (with `version-changed`)
 *  raise a Notice (Z34). */
export const OPERATIONAL_FAILURES: ReadonlySet<FallowRunErrorCode> =
  new Set(FALLOW_RUN_ERROR_CODES.filter((code) => !NOT_OPERATIONAL.includes(code)));

const FROM_IMPORT: Readonly<Record<FallowImportErrorCode, FallowRunErrorCode>> = {
  'too-large': 'output-too-large',
  'not-json': 'output-not-json',
  unsupported: 'output-unsupported',
  invalid: 'output-invalid',
  'source-mismatch': 'source-mismatch',
  // The reader never produces read-failed for text it was handed; mapped for totality.
  'read-failed': 'output-incomplete',
};

/** Z19: a Part 6 reader refusal of fallow's stdout, as a run failure. The detail is kept. */
export function fromImportCode(code: FallowImportErrorCode): FallowRunErrorCode {
  return FROM_IMPORT[code];
}
```

Create `src/application/analysis/analyzer-trust.ts`:

```ts
// Part 7 Z6/Z7: trust is a FINGERPRINT of exactly what the user reviewed, never a bare
// boolean (architecture §6). FNV-1a, as approval.ts: it detects an incidental change, it
// does not resist a deliberate forgery (spec §6). The time limit is deliberately NOT
// covered: changing it cannot widen what runs.
import { fnv1a32Hex } from '../../domain/hash';
import { fingerprintSource } from '../approval';
import type { ExecutableFacts } from '../ports/executable-inspector';

/** Z1: stored in data.json `analyzers[profileId].trust`, only after the version probe passed. */
export interface AnalyzerTrust {
  /** Eight lower-case hex digits. */
  fingerprint: string;
  /** The probed version, `x.y.z`. */
  version: string;
  /** ISO 8601, from the Clock. */
  grantedAt: string;
}

export interface TrustSubject {
  profileId: string;
  machineId: string;
  rootPath: string;
  /** Exactly the run argv, FALLOW_RUN_ARGS(rootPath). */
  args: readonly string[];
  facts: ExecutableFacts;
}

export function fingerprintTrust(subject: TrustSubject, version: string): string {
  const f = subject.facts;
  return fnv1a32Hex(JSON.stringify({
    v: 1,
    provider: 'fallow',
    profileId: subject.profileId,
    machineId: subject.machineId,
    exe: f.executablePath,
    real: f.realPath,
    size: f.size,
    mtime: Math.trunc(f.mtimeMs),
    // Case-sensitive on purpose (M29): a root that differs only in case re-asks.
    root: fingerprintSource(subject.rootPath),
    args: subject.args,
    version,
  }));
}

/** Z7: the stored trust still describes this subject at this version. */
export function isTrustCurrent(trust: AnalyzerTrust | null, subject: TrustSubject, version: string): boolean {
  return trust !== null && trust.version === version && trust.fingerprint === fingerprintTrust(subject, version);
}
```

Create `src/application/analysis/fallow-invocation.ts`:

```ts
// Part 7 Z8/Z9/Z10/Z15/Z16/Z17 and the spec's §1 "Exit semantics": HOW fallow is invoked
// and how a finished process is read, as pure data and pure functions. Report text goes
// through Part 6's parseFallowReportText, unchanged (U1). No Node, no process.
import { parseFallowReportText } from '../evidence/read-fallow-report';
import { FALLOW_REPORT_MAX_BYTES, type RawFallowReport } from '../evidence/raw-fallow';
import type { ProcessOutcome } from '../ports/analyzer-process';
import { fromImportCode, type FallowRunErrorCode } from './fallow-run-errors';

/** Z15: combined (bare) mode, JSON, no cache, quiet, an explicit root. Nothing else, ever. */
export function FALLOW_RUN_ARGS(root: string): readonly string[] {
  return ['--format', 'json', '--no-cache', '--quiet', '--root', root];
}
export const FALLOW_VERSION_ARGS: readonly string[] = ['--version'];

export const FALLOW_VERSION_TIMEOUT_MS = 5_000;
export const FALLOW_VERSION_MAX_BYTES = 4_096;
export const FALLOW_STDOUT_MAX_BYTES = FALLOW_REPORT_MAX_BYTES;
export const FALLOW_STDERR_TAIL_BYTES = 65_536;
export const FALLOW_KILL_GRACE_MS = 2_000;
export const FALLOW_CLOSE_GRACE_MS = 2_000;
export const FALLOW_TIMEOUT_DEFAULT_S = 120;
export const FALLOW_TIMEOUT_MIN_S = 10;
export const FALLOW_TIMEOUT_MAX_S = 1800;
export const FALLOW_ERROR_MESSAGE_MAX = 500;
const VERSION_MAX = 32;

/** Z9: the versions the committed fixtures were recorded with (Y20/Y21). */
export const FALLOW_TESTED_VERSIONS: readonly string[] = ['3.21.0', '3.27.0'];

/** Z16: the only variables passed on. The adapter also drops FALLOW_* and NODE_OPTIONS. */
export const FALLOW_ENV_ALLOW_LIST: readonly string[] = ['PATH', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'LOCALAPPDATA'];
export const FALLOW_ENV_EXTRA: Readonly<Record<string, string>> = { NO_COLOR: '1' };

/** Z10: whole seconds from 10 to 1800. */
export function isValidTimeoutSeconds(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= FALLOW_TIMEOUT_MIN_S && n <= FALLOW_TIMEOUT_MAX_S;
}

export type FallowVersion = { ok: true; version: string; major: number; tested: boolean } | { ok: false };
const VERSION_LINE = /^fallow (\d+)\.(\d+)\.(\d+)$/;

/** Z8: `fallow 3.27.0` (the probe's observed output), trimmed. */
export function parseFallowVersion(stdout: string | null): FallowVersion {
  if (stdout === null) return { ok: false };
  const match = VERSION_LINE.exec(stdout.trim());
  if (!match) return { ok: false };
  const version = `${match[1]}.${match[2]}.${match[3]}`;
  if (version.length > VERSION_MAX) return { ok: false };
  return { ok: true, version, major: Number(match[1]), tested: FALLOW_TESTED_VERSIONS.includes(version) };
}

export type VersionProbeResult = { ok: true; version: string; tested: boolean } | { ok: false; code: FallowRunErrorCode; detail: string };

/** Z8: a probe passes only with exit 0 and a `fallow 3.y.z` line. Details are data:
 *  'timeout', 'no-version', 'cancelled', an exit code or a signal name. */
export function classifyVersionProbe(outcome: ProcessOutcome): VersionProbeResult {
  switch (outcome.kind) {
    case 'exited': {
      if (outcome.exitCode !== 0) return { ok: false, code: 'version-probe-failed', detail: String(outcome.exitCode) };
      const parsed = parseFallowVersion(outcome.stdout);
      if (!parsed.ok) return { ok: false, code: 'version-probe-failed', detail: 'no-version' };
      if (parsed.major !== 3) return { ok: false, code: 'version-unsupported', detail: parsed.version };
      return { ok: true, version: parsed.version, tested: parsed.tested };
    }
    case 'timed-out': return { ok: false, code: 'version-probe-failed', detail: 'timeout' };
    case 'signalled': return { ok: false, code: 'version-probe-failed', detail: outcome.signal };
    case 'cancelled': return { ok: false, code: 'version-probe-failed', detail: 'cancelled' };
    case 'spawn-failed':
      return outcome.errorCode === 'ENOENT'
        ? { ok: false, code: 'executable-missing', detail: '' }
        : { ok: false, code: 'spawn-failed', detail: outcome.errorCode };
    default: return { ok: false, code: 'version-probe-failed', detail: 'no-version' };
  }
}

export type FallowExitResult =
  | { kind: 'completed'; report: RawFallowReport }
  | { kind: 'cancelled' }
  | { kind: 'failed'; code: FallowRunErrorCode; detail: string };

const failed = (code: FallowRunErrorCode, detail = ''): FallowExitResult => ({ kind: 'failed', code, detail });

/** fallow's operational error document, `{"error":true,"message":…}`: its message (capped),
 *  '' when it has none, or null when `stdout` is not such a document. */
function errorMessageOf(stdout: string | null): string | null {
  if (stdout === null) return null;
  const body = stdout.charCodeAt(0) === 0xfeff ? stdout.slice(1) : stdout;
  let doc: unknown;
  try {
    doc = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return null;
  const record = doc as Record<string, unknown>;
  if (record.error !== true) return null;
  return typeof record.message === 'string' ? record.message.slice(0, FALLOW_ERROR_MESSAGE_MAX) : '';
}

function classifyExited(exitCode: number, stdout: string | null): FallowExitResult {
  if (exitCode === 0 || exitCode === 1) {
    if (stdout === null) return failed('output-not-json');
    const read = parseFallowReportText(stdout);
    if (read.ok) return { kind: 'completed', report: read.report };
    // The error document names no kind, so the reader refuses it as unsupported first.
    const message = read.code === 'unsupported' ? errorMessageOf(stdout) : null;
    if (message !== null) return failed('analyzer-error', message);
    return failed(fromImportCode(read.code), read.detail);
  }
  if (exitCode === 2) {
    const message = errorMessageOf(stdout);
    return message === null ? failed('exit-code', '2') : failed('analyzer-error', message);
  }
  return failed('exit-code', String(exitCode));
}

/** The spec's §1 table. A completed analysis with findings (exit 0 or 1) is never a
 *  failure; nothing partial is ever returned as completed. */
export function classifyFallowExit(outcome: ProcessOutcome, timeoutSeconds: number): FallowExitResult {
  switch (outcome.kind) {
    case 'exited': return classifyExited(outcome.exitCode, outcome.stdout);
    case 'cancelled': return { kind: 'cancelled' };
    case 'signalled': return failed('exit-code', outcome.signal);
    case 'timed-out': return failed('timed-out', String(timeoutSeconds));
    case 'stdout-too-large': return failed('output-too-large');
    case 'output-incomplete': return failed('output-incomplete');
    case 'spawn-failed': return outcome.errorCode === 'ENOENT' ? failed('executable-missing') : failed('spawn-failed', outcome.errorCode);
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}
```

- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/unit/fallow-invocation.test.ts tests/unit/analyzer-trust.test.ts`
Expected: PASS (2 files; every case green).

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/application/analysis src/application/ports/analyzer-process.ts src/application/ports/executable-inspector.ts tests/unit/fallow-invocation.test.ts tests/unit/analyzer-trust.test.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add src/application/analysis/fallow-run-errors.ts src/application/analysis/analyzer-trust.ts src/application/analysis/fallow-invocation.ts src/application/ports/analyzer-process.ts src/application/ports/executable-inspector.ts tests/unit/fallow-invocation.test.ts tests/unit/analyzer-trust.test.ts
git commit -m "feat(application): fallow invocation contract, exit semantics, run error codes and the trust fingerprint (Z6-Z9, Z15-Z17, Z19)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Run the covering tests.**

Run: `npx vitest run tests/unit/fallow-invocation.test.ts tests/unit/analyzer-trust.test.ts tests/unit/approval.test.ts tests/unit/fallow-report-reader.test.ts`
Expected: PASS.

---

### Task 2: The analyzer record, the binding-store port and the durable store (Z1, Z2, Z3)

**Files:**
- Create: `src/application/analysis/analyzer-record.ts` (~170; K27 caps it at 200)
- Create: `src/application/ports/analyzer-binding-store.ts` (~30)
- Create: `src/adapters/storage/plugin-data-analyzer-store.ts` (~45)
- Modify: `src/adapters/storage/plugin-data-shape.ts` (110 → 113): lines 4–12 (the header comment and `PluginDataShape`)
- Create: `tests/fixtures/in-memory-analyzer-store.ts` (~35)
- Create: `tests/contracts/analyzer-binding-store.contract.ts` (~150; a `.contract.ts`, run from a unit test, so the contracts layer's file count is unchanged, K29)
- Test: `tests/unit/analyzer-binding-store.test.ts` (new, ~60)
- Test: `tests/unit/analyzer-record.test.ts` (new, ~90)

**Interfaces:**
- Consumes: Task 1's `AnalyzerTrust` and `FALLOW_TIMEOUT_DEFAULT_S`, `FALLOW_TIMEOUT_MIN_S`, `FALLOW_TIMEOUT_MAX_S`; `normalizeAbsolutePath` (`src/domain/path-safety.ts`); `readPluginData(plugin)`, `writePluginDataSlice(plugin, key, mutate)` (`plugin-data-shape.ts`); the `Plugin` mock's faithful `loadData`/`saveData` (`tests/mocks/obsidian.ts`).
- Produces:
  - `interface AnalyzerBinding { profileId: string; executablePath: string; timeoutSeconds: number; trust: AnalyzerTrust | null }`
  - `type AnalyzerBindingRead = { kind: 'none' } | { kind: 'bound'; binding: AnalyzerBinding } | { kind: 'other-machine' } | { kind: 'invalid' } | { kind: 'unsupported' }`
  - `type AnalyzerWrite = { op: 'bind'; executablePath: string } | { op: 'timeout'; seconds: number } | { op: 'grant'; trust: AnalyzerTrust; expectedPath: string } | { op: 'revoke' } | { op: 'forget' } | { op: 'purge' }`
  - `type AnalyzerStoreErrorCode = 'unsupported' | 'not-bound' | 'changed'`; `class AnalyzerStoreError extends Error { readonly code: AnalyzerStoreErrorCode }`
  - `decodeAnalyzerRecord(slice: unknown, profileId: string, machineId: string): AnalyzerBindingRead`
  - `applyAnalyzerWrite(slice: unknown, profileId: string, machineId: string, write: AnalyzerWrite): unknown` (pure; throws `AnalyzerStoreError` or a zod error)
  - `interface AnalyzerBindingStore { read; bind; setTimeoutSeconds; grantTrust; revokeTrust; forget; purge }` (Z3 signatures)
  - `createPluginDataAnalyzerStore(plugin: Plugin, machineId: string): AnalyzerBindingStore`
  - tests: `createInMemoryAnalyzerStore(machineId?: string, initial?: unknown): AnalyzerBindingStore & { slice(): unknown }`; `runAnalyzerBindingStoreContract(label, make)`

- [ ] **Step 1: Write the failing tests.**

Create `tests/unit/analyzer-record.test.ts`:

```ts
// Part 7 Z1/Z2: the data.json `analyzers` slice, read and written as pure data. A newer
// format is read-only and never overwritten; a malformed or other-device record is never
// used and is replaced only by an explicit choice (bind) or deleted by Forget.
import { describe, expect, it } from 'vitest';
import { AnalyzerStoreError, applyAnalyzerWrite, decodeAnalyzerRecord } from '../../src/application/analysis/analyzer-record';

const M = 'machine-a';
const TRUST = { fingerprint: '0a1b2c3d', version: '3.27.0', grantedAt: '2026-09-23T10:00:00.000Z' };
const RECORD = { v: 1, provider: 'fallow', machineId: M, executablePath: 'C:\\Tools\\fallow\\fallow.exe', timeoutSeconds: 120, trust: TRUST };
const codeOf = (fn: () => unknown): string => {
  try { fn(); } catch (e) { return e instanceof AnalyzerStoreError ? e.code : 'other'; }
  return 'none';
};

describe('decodeAnalyzerRecord (Z2)', () => {
  it('reads each kind', () => {
    expect(decodeAnalyzerRecord(undefined, 'p1', M)).toEqual({ kind: 'none' });
    expect(decodeAnalyzerRecord({}, 'p1', M)).toEqual({ kind: 'none' });
    expect(decodeAnalyzerRecord({ p1: RECORD }, 'p1', M)).toEqual({
      kind: 'bound', binding: { profileId: 'p1', executablePath: RECORD.executablePath, timeoutSeconds: 120, trust: TRUST },
    });
    expect(decodeAnalyzerRecord({ p1: RECORD }, 'p1', 'machine-b')).toEqual({ kind: 'other-machine' });
    expect(decodeAnalyzerRecord({ p1: { ...RECORD, timeoutSeconds: 5 } }, 'p1', M)).toEqual({ kind: 'invalid' });
    expect(decodeAnalyzerRecord({ p1: { ...RECORD, extra: 1 } }, 'p1', M)).toEqual({ kind: 'invalid' });
    expect(decodeAnalyzerRecord({ p1: { ...RECORD, executablePath: 'C:\\Tools\\..\\fallow.exe' } }, 'p1', M)).toEqual({ kind: 'invalid' });
    expect(decodeAnalyzerRecord({ p1: { ...RECORD, trust: { ...TRUST, fingerprint: 'XYZ' } } }, 'p1', M)).toEqual({ kind: 'invalid' });
    expect(decodeAnalyzerRecord({ p1: { ...RECORD, v: 2 } }, 'p1', M)).toEqual({ kind: 'unsupported' });
    expect(decodeAnalyzerRecord({ p1: 'fallow.exe' }, 'p1', M)).toEqual({ kind: 'unsupported' });
    expect(decodeAnalyzerRecord([RECORD], 'p1', M)).toEqual({ kind: 'unsupported' });
  });

  it('never reads an Object.prototype member as a record', () => {
    expect(decodeAnalyzerRecord({}, 'constructor', M)).toEqual({ kind: 'none' });
  });

  it('refuses a path over 1,024 characters (K21)', () => {
    const long = `C:\\${'a'.repeat(1030)}\\fallow.exe`;
    expect(decodeAnalyzerRecord({ p1: { ...RECORD, executablePath: long } }, 'p1', M)).toEqual({ kind: 'invalid' });
  });
});

describe('applyAnalyzerWrite (Z2, Z3)', () => {
  it('bind writes a v1 record stamped with this machine, no trust, and the default time limit', () => {
    expect(applyAnalyzerWrite(undefined, 'p1', M, { op: 'bind', executablePath: 'C:\\Tools\\fallow\\fallow.exe' })).toEqual({
      p1: { v: 1, provider: 'fallow', machineId: M, executablePath: 'C:\\Tools\\fallow\\fallow.exe', timeoutSeconds: 120, trust: null },
    });
  });

  it('bind keeps a bound record\'s time limit, drops its trust, and leaves other entries verbatim', () => {
    const other = { v: 7, anything: true };
    const next = applyAnalyzerWrite({ p1: { ...RECORD, timeoutSeconds: 300 }, p2: other }, 'p1', M, { op: 'bind', executablePath: 'D:\\fallow.exe' });
    expect(next).toEqual({ p1: { ...RECORD, executablePath: 'D:\\fallow.exe', timeoutSeconds: 300, trust: null }, p2: other });
  });

  it('bind replaces an invalid or other-device record (an explicit user choice)', () => {
    expect(applyAnalyzerWrite({ p1: { ...RECORD, timeoutSeconds: 5 } }, 'p1', M, { op: 'bind', executablePath: 'D:\\fallow.exe' }))
      .toMatchObject({ p1: { executablePath: 'D:\\fallow.exe', timeoutSeconds: 120, machineId: M } });
    expect(applyAnalyzerWrite({ p1: { ...RECORD, machineId: 'machine-b' } }, 'p1', M, { op: 'bind', executablePath: 'D:\\fallow.exe' }))
      .toMatchObject({ p1: { machineId: M, timeoutSeconds: 120 } });
  });

  it('an unsupported entry or slice refuses every write, so it is never overwritten', () => {
    for (const slice of [{ p1: { ...RECORD, v: 2 } }, 'nonsense']) {
      for (const write of [
        { op: 'bind', executablePath: 'D:\\fallow.exe' }, { op: 'timeout', seconds: 60 }, { op: 'revoke' }, { op: 'forget' },
        { op: 'grant', trust: TRUST, expectedPath: RECORD.executablePath },
      ] as const) {
        expect(codeOf(() => applyAnalyzerWrite(slice, 'p1', M, write)), write.op).toBe('unsupported');
      }
    }
  });

  it('timeout, grant and revoke need a bound record; grant refuses a path that moved', () => {
    expect(codeOf(() => applyAnalyzerWrite(undefined, 'p1', M, { op: 'timeout', seconds: 60 }))).toBe('not-bound');
    expect(codeOf(() => applyAnalyzerWrite({ p1: { ...RECORD, machineId: 'machine-b' } }, 'p1', M, { op: 'revoke' }))).toBe('not-bound');
    expect(codeOf(() => applyAnalyzerWrite({ p1: RECORD }, 'p1', M, { op: 'grant', trust: TRUST, expectedPath: 'D:\\fallow.exe' }))).toBe('changed');
    expect(applyAnalyzerWrite({ p1: { ...RECORD, trust: null } }, 'p1', M, { op: 'grant', trust: TRUST, expectedPath: RECORD.executablePath }))
      .toEqual({ p1: RECORD });
    expect(applyAnalyzerWrite({ p1: RECORD }, 'p1', M, { op: 'revoke' })).toEqual({ p1: { ...RECORD, trust: null } });
    expect(applyAnalyzerWrite({ p1: RECORD }, 'p1', M, { op: 'timeout', seconds: 1800 })).toEqual({ p1: { ...RECORD, timeoutSeconds: 1800 } });
  });

  it('forget deletes a bound, invalid or other-device record, and is a no-op with none', () => {
    expect(applyAnalyzerWrite({ p1: RECORD, p2: RECORD }, 'p1', M, { op: 'forget' })).toEqual({ p2: RECORD });
    expect(applyAnalyzerWrite({ p1: { ...RECORD, timeoutSeconds: 5 } }, 'p1', M, { op: 'forget' })).toEqual({});
    expect(applyAnalyzerWrite({ p1: { ...RECORD, machineId: 'machine-b' } }, 'p1', M, { op: 'forget' })).toEqual({});
    expect(applyAnalyzerWrite(undefined, 'p1', M, { op: 'forget' })).toBeUndefined();
  });

  it('purge deletes the entry whatever its format (Z11), and leaves a non-object slice alone', () => {
    expect(applyAnalyzerWrite({ p1: { v: 9 }, p2: RECORD }, 'p1', M, { op: 'purge' })).toEqual({ p2: RECORD });
    expect(applyAnalyzerWrite('nonsense', 'p1', M, { op: 'purge' })).toBe('nonsense');
  });
});
```

Create `tests/contracts/analyzer-binding-store.contract.ts`:

```ts
// Part 7 Z3: the suite every AnalyzerBindingStore must pass, run against the durable
// plugin-data adapter and the in-memory test double (the review-repository.contract.ts
// pattern), so they cannot drift. `slice()` returns data.json's `analyzers` value.
import { describe, expect, it } from 'vitest';
import { AnalyzerStoreError } from '../../src/application/analysis/analyzer-record';
import type { AnalyzerBindingStore } from '../../src/application/ports/analyzer-binding-store';

export interface AnalyzerStoreHarness {
  store: AnalyzerBindingStore;
  slice: () => Promise<unknown>;
}
export const CONTRACT_MACHINE = 'machine-contract';
const EXE = 'C:\\Tools\\fallow\\fallow.exe';
const TRUST = { fingerprint: '0a1b2c3d', version: '3.27.0', grantedAt: '2026-09-23T10:00:00.000Z' };

async function codeOf(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { return e instanceof AnalyzerStoreError ? e.code : 'other'; }
  return 'none';
}

export function runAnalyzerBindingStoreContract(label: string, make: (initial?: unknown) => Promise<AnalyzerStoreHarness>): void {
  describe(`${label}: AnalyzerBindingStore contract (Z3)`, () => {
    it('reads none, then the bound record after bind, with no trust and the default limit', async () => {
      const { store } = await make();
      expect(await store.read('p1')).toEqual({ kind: 'none' });
      await store.bind('p1', EXE);
      expect(await store.read('p1')).toEqual({ kind: 'bound', binding: { profileId: 'p1', executablePath: EXE, timeoutSeconds: 120, trust: null } });
    });

    it('grants, revokes and changes the time limit on the bound record only', async () => {
      const { store } = await make();
      await store.bind('p1', EXE);
      await store.grantTrust('p1', TRUST, EXE);
      await store.setTimeoutSeconds('p1', 600);
      expect(await store.read('p1')).toEqual({ kind: 'bound', binding: { profileId: 'p1', executablePath: EXE, timeoutSeconds: 600, trust: TRUST } });
      await store.revokeTrust('p1');
      expect(await store.read('p1')).toMatchObject({ kind: 'bound', binding: { trust: null, timeoutSeconds: 600 } });
      expect(await codeOf(store.revokeTrust('p2'))).toBe('not-bound');
      expect(await codeOf(store.setTimeoutSeconds('p2', 60))).toBe('not-bound');
    });

    it('refuses trust for a path that is no longer the bound one', async () => {
      const { store } = await make();
      await store.bind('p1', EXE);
      await store.bind('p1', 'D:\\fallow.exe');
      expect(await codeOf(store.grantTrust('p1', TRUST, EXE))).toBe('changed');
      expect(await store.read('p1')).toMatchObject({ kind: 'bound', binding: { trust: null } });
    });

    it('re-binding drops trust but keeps the time limit', async () => {
      const { store } = await make();
      await store.bind('p1', EXE);
      await store.setTimeoutSeconds('p1', 300);
      await store.grantTrust('p1', TRUST, EXE);
      await store.bind('p1', EXE);
      expect(await store.read('p1')).toMatchObject({ kind: 'bound', binding: { trust: null, timeoutSeconds: 300 } });
    });

    it('forget and purge remove only their own profile', async () => {
      const { store, slice } = await make();
      await store.bind('p1', EXE);
      await store.bind('p2', EXE);
      await store.forget('p1');
      expect(await store.read('p1')).toEqual({ kind: 'none' });
      await store.purge('p2');
      expect(await slice()).toEqual({});
    });

    it('reads another device\'s record as other-machine, never uses it, and replaces it only on bind', async () => {
      const foreign = { v: 1, provider: 'fallow', machineId: 'machine-other', executablePath: EXE, timeoutSeconds: 120, trust: TRUST };
      const { store } = await make({ p1: foreign });
      expect(await store.read('p1')).toEqual({ kind: 'other-machine' });
      expect(await codeOf(store.grantTrust('p1', TRUST, EXE))).toBe('not-bound');
      await store.bind('p1', EXE);
      expect(await store.read('p1')).toMatchObject({ kind: 'bound', binding: { trust: null } });
    });

    it('keeps a newer-format record read-only: every write but purge is refused and it stays as it was', async () => {
      const newer = { v: 2, provider: 'fallow', executable: { path: EXE } };
      const { store, slice } = await make({ p1: newer, p2: newer });
      expect(await store.read('p1')).toEqual({ kind: 'unsupported' });
      expect(await codeOf(store.bind('p1', EXE))).toBe('unsupported');
      expect(await codeOf(store.forget('p1'))).toBe('unsupported');
      expect(await codeOf(store.setTimeoutSeconds('p1', 60))).toBe('unsupported');
      expect(await slice()).toEqual({ p1: newer, p2: newer });
      await store.purge('p1');
      expect(await slice()).toEqual({ p2: newer });
    });
  });
}
```

Create `tests/unit/analyzer-binding-store.test.ts`:

```ts
// Part 7 Z1–Z3: the durable plugin-data store and the in-memory double both pass the one
// contract; the durable one also keeps every other data.json key and survives a restart.
import { describe, expect, it } from 'vitest';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { createPluginDataAnalyzerStore } from '../../src/adapters/storage/plugin-data-analyzer-store';
import { CONTRACT_MACHINE, runAnalyzerBindingStoreContract } from '../contracts/analyzer-binding-store.contract';
import { createInMemoryAnalyzerStore } from '../fixtures/in-memory-analyzer-store';

const newPlugin = (): ObsidianPlugin => new Plugin({}, {}) as unknown as ObsidianPlugin;

runAnalyzerBindingStoreContract('plugin-data', async (initial) => {
  const plugin = newPlugin();
  if (initial !== undefined) await plugin.saveData({ analyzers: initial });
  const store = createPluginDataAnalyzerStore(plugin, CONTRACT_MACHINE);
  return { store, slice: async () => ((await plugin.loadData()) as { analyzers?: unknown } | null)?.analyzers };
});

runAnalyzerBindingStoreContract('in-memory', (initial) => {
  const store = createInMemoryAnalyzerStore(CONTRACT_MACHINE, initial);
  return Promise.resolve({ store, slice: () => Promise.resolve(store.slice()) });
});

describe('the durable analyzer store (Z1, Z3)', () => {
  it('writes only its own key: profiles, bindings and reviews are carried over verbatim', async () => {
    const plugin = newPlugin();
    const others = { profiles: [{ profileId: 'p1' }], bindings: [{ bindingId: 'b1' }], reviews: { p1: { v: 1 } } };
    await plugin.saveData(others);
    await createPluginDataAnalyzerStore(plugin, 'm').bind('p1', 'C:\\Tools\\fallow\\fallow.exe');
    expect(await plugin.loadData()).toMatchObject(others);
  });

  it('survives a restart: a new store on the same data.json reads the record', async () => {
    const plugin = newPlugin();
    await createPluginDataAnalyzerStore(plugin, 'm').bind('p1', 'C:\\Tools\\fallow\\fallow.exe');
    expect(await createPluginDataAnalyzerStore(plugin, 'm').read('p1')).toMatchObject({ kind: 'bound' });
  });

  it('never caches: a change made outside the store shows on the next read (Z3)', async () => {
    const plugin = newPlugin();
    const store = createPluginDataAnalyzerStore(plugin, 'm');
    await store.bind('p1', 'C:\\Tools\\fallow\\fallow.exe');
    await plugin.saveData({});
    expect(await store.read('p1')).toEqual({ kind: 'none' });
  });

  it('serialises two concurrent writes under the one data lock', async () => {
    const plugin = newPlugin();
    const store = createPluginDataAnalyzerStore(plugin, 'm');
    await Promise.all([store.bind('p1', 'C:\\a\\fallow.exe'), store.bind('p2', 'C:\\b\\fallow.exe')]);
    expect(Object.keys(((await plugin.loadData()) as { analyzers: Record<string, unknown> }).analyzers).sort()).toEqual(['p1', 'p2']);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/unit/analyzer-record.test.ts tests/unit/analyzer-binding-store.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/application/analysis/analyzer-record"` (and the store and fixture imports).

- [ ] **Step 3: Implement.**

Create `src/application/analysis/analyzer-record.ts`:

```ts
// Part 7 Z1/Z2 (K27): the data.json `analyzers` slice as pure data. BOTH store
// implementations (plugin-data-analyzer-store.ts and the in-memory test double) call
// `applyAnalyzerWrite`, so their write rules cannot drift. Our own format: zod `.strict()`.
// - A newer format (`v !== 1`, a non-object entry, or a non-object slice) is READ-ONLY:
//   every write but purge is refused, so it is never overwritten (Y7's rule).
// - A malformed v1 record or another device's record is never used, and is kept as it is;
//   `bind` replaces it (an explicit user choice) and `forget` deletes it.
// - Every write changes only its own profile's entry; the others are carried over verbatim.
import { z } from 'zod';
import { normalizeAbsolutePath } from '../../domain/path-safety';
import { FALLOW_TIMEOUT_DEFAULT_S, FALLOW_TIMEOUT_MAX_S, FALLOW_TIMEOUT_MIN_S } from './fallow-invocation';
import type { AnalyzerTrust } from './analyzer-trust';

export interface AnalyzerBinding {
  profileId: string;
  executablePath: string;
  timeoutSeconds: number;
  trust: AnalyzerTrust | null;
}

export type AnalyzerBindingRead =
  | { kind: 'none' }
  | { kind: 'bound'; binding: AnalyzerBinding }
  | { kind: 'other-machine' }
  | { kind: 'invalid' }
  | { kind: 'unsupported' };

export type AnalyzerWrite =
  | { op: 'bind'; executablePath: string }
  | { op: 'timeout'; seconds: number }
  | { op: 'grant'; trust: AnalyzerTrust; expectedPath: string }
  | { op: 'revoke' }
  | { op: 'forget' }
  | { op: 'purge' };

export type AnalyzerStoreErrorCode = 'unsupported' | 'not-bound' | 'changed';

/** A refused write: nothing was written. The service maps the code to a run error (Z22). */
export class AnalyzerStoreError extends Error {
  readonly code: AnalyzerStoreErrorCode;

  constructor(code: AnalyzerStoreErrorCode) {
    super(`analyzer store: ${code}`);
    this.name = 'AnalyzerStoreError';
    this.code = code;
  }
}

/** K21: the stored path is exactly its own normalised form, so what is shown, stored,
 *  fingerprinted and run is one string. normalizeAbsolutePath caps it at 1,024. */
function isNormalAbsolute(path: string): boolean {
  try {
    return normalizeAbsolutePath(path) === path;
  } catch {
    return false;
  }
}

const TRUST = z.object({
  fingerprint: z.string().regex(/^[0-9a-f]{8}$/, { error: 'fingerprint must be eight lower-case hex digits' }),
  version: z.string().max(32, { error: 'version is too long' }).regex(/^\d+\.\d+\.\d+$/, { error: 'version must be x.y.z' }),
  grantedAt: z.iso.datetime({ error: 'grantedAt must be an ISO 8601 time' }),
}).strict();

const RECORD = z.object({
  v: z.literal(1),
  provider: z.literal('fallow'),
  machineId: z.string().min(1).max(100),
  executablePath: z.string().min(1).max(1024).refine(isNormalAbsolute, { error: 'executablePath must be a normalised absolute path' }),
  timeoutSeconds: z.number().int().min(FALLOW_TIMEOUT_MIN_S).max(FALLOW_TIMEOUT_MAX_S),
  trust: TRUST.nullable(),
}).strict();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ownEntry(slice: Record<string, unknown>, profileId: string): unknown {
  return Object.prototype.hasOwnProperty.call(slice, profileId) ? slice[profileId] : undefined;
}

/** Z2: `slice` is data.json's whole `analyzers` value. */
export function decodeAnalyzerRecord(slice: unknown, profileId: string, machineId: string): AnalyzerBindingRead {
  if (slice === undefined) return { kind: 'none' };
  if (!isPlainObject(slice)) return { kind: 'unsupported' };
  const entry = ownEntry(slice, profileId);
  if (entry === undefined) return { kind: 'none' };
  if (!isPlainObject(entry) || entry.v !== 1) return { kind: 'unsupported' };
  const parsed = RECORD.safeParse(entry);
  if (!parsed.success) return { kind: 'invalid' };
  if (parsed.data.machineId !== machineId) return { kind: 'other-machine' };
  const { executablePath, timeoutSeconds, trust } = parsed.data;
  return { kind: 'bound', binding: { profileId, executablePath, timeoutSeconds, trust } };
}

function withoutEntry(slice: Record<string, unknown>, profileId: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(slice).filter(([key]) => key !== profileId));
}

function withEntry(slice: Record<string, unknown>, profileId: string, machineId: string, b: Omit<AnalyzerBinding, 'profileId'>): Record<string, unknown> {
  const record = RECORD.parse({ v: 1, provider: 'fallow', machineId, executablePath: b.executablePath, timeoutSeconds: b.timeoutSeconds, trust: b.trust });
  return { ...withoutEntry(slice, profileId), [profileId]: record };
}

/** Z2/Z3: the new `analyzers` value after one write. Pure: it never mutates `slice`. */
export function applyAnalyzerWrite(slice: unknown, profileId: string, machineId: string, write: AnalyzerWrite): unknown {
  if (write.op === 'purge') {
    if (!isPlainObject(slice) || ownEntry(slice, profileId) === undefined) return slice;
    return withoutEntry(slice, profileId);
  }
  const read = decodeAnalyzerRecord(slice, profileId, machineId);
  if (read.kind === 'unsupported') throw new AnalyzerStoreError('unsupported');
  const base: Record<string, unknown> = isPlainObject(slice) ? slice : {};
  if (write.op === 'bind') {
    const timeoutSeconds = read.kind === 'bound' ? read.binding.timeoutSeconds : FALLOW_TIMEOUT_DEFAULT_S;
    return withEntry(base, profileId, machineId, { executablePath: write.executablePath, timeoutSeconds, trust: null });
  }
  if (write.op === 'forget') return read.kind === 'none' ? slice : withoutEntry(base, profileId);
  if (read.kind !== 'bound') throw new AnalyzerStoreError('not-bound');
  const b = read.binding;
  if (write.op === 'timeout') return withEntry(base, profileId, machineId, { ...b, timeoutSeconds: write.seconds });
  if (write.op === 'grant') {
    if (b.executablePath !== write.expectedPath) throw new AnalyzerStoreError('changed');
    return withEntry(base, profileId, machineId, { ...b, trust: write.trust });
  }
  return withEntry(base, profileId, machineId, { ...b, trust: null });
}
```

Create `src/application/ports/analyzer-binding-store.ts`:

```ts
// Part 7 Z3: the per-profile fallow executable binding and its trust. One durable adapter
// (src/adapters/storage/plugin-data-analyzer-store.ts); the write rules live in
// analyzer-record.ts so every implementation shares them. Every write rejects with
// AnalyzerStoreError ('unsupported' | 'not-bound' | 'changed') when refused, and then
// nothing was written.
import type { AnalyzerTrust } from '../analysis/analyzer-trust';
import type { AnalyzerBindingRead } from '../analysis/analyzer-record';

export type { AnalyzerBinding, AnalyzerBindingRead } from '../analysis/analyzer-record';

export interface AnalyzerBindingStore {
  read(profileId: string): Promise<AnalyzerBindingRead>;
  /** Replaces the path and drops trust; keeps a bound record's time limit, else 120 s. */
  bind(profileId: string, executablePath: string): Promise<void>;
  setTimeoutSeconds(profileId: string, seconds: number): Promise<void>;
  /** Refused with 'changed' when the stored path is no longer `expectedPath`. */
  grantTrust(profileId: string, trust: AnalyzerTrust, expectedPath: string): Promise<void>;
  revokeTrust(profileId: string): Promise<void>;
  forget(profileId: string): Promise<void>;
  /** Z11: profile removal. Deletes the entry whatever its format. */
  purge(profileId: string): Promise<void>;
}
```

Create `src/adapters/storage/plugin-data-analyzer-store.ts`:

```ts
// Part 7 Z1–Z3: the durable AnalyzerBindingStore, data.json `analyzers[profileId]`. Every
// write is ONE writePluginDataSlice under the plugin-wide data lock, and the rule is
// applied to the entry found INSIDE the lock, so a concurrent write is never overwritten.
// No cache: every read goes to data.json, so a Sync or hand edit is seen at the next check.
import type { Plugin } from 'obsidian';
import { applyAnalyzerWrite, decodeAnalyzerRecord, type AnalyzerWrite } from '../../application/analysis/analyzer-record';
import type { AnalyzerBindingStore } from '../../application/ports/analyzer-binding-store';
import { readPluginData, writePluginDataSlice } from './plugin-data-shape';

export function createPluginDataAnalyzerStore(plugin: Plugin, machineId: string): AnalyzerBindingStore {
  const write = (profileId: string, change: AnalyzerWrite): Promise<void> =>
    writePluginDataSlice(plugin, 'analyzers', (current) => applyAnalyzerWrite(current, profileId, machineId, change));
  return {
    async read(profileId) {
      const data = await readPluginData(plugin);
      return decodeAnalyzerRecord(data.analyzers, profileId, machineId);
    },
    bind: (profileId, executablePath) => write(profileId, { op: 'bind', executablePath }),
    setTimeoutSeconds: (profileId, seconds) => write(profileId, { op: 'timeout', seconds }),
    grantTrust: (profileId, trust, expectedPath) => write(profileId, { op: 'grant', trust, expectedPath }),
    revokeTrust: (profileId) => write(profileId, { op: 'revoke' }),
    forget: (profileId) => write(profileId, { op: 'forget' }),
    purge: (profileId) => write(profileId, { op: 'purge' }),
  };
}
```

In `src/adapters/storage/plugin-data-shape.ts`, replace lines 4–12:

```ts
 *  ports. Every read/write from either store goes through here. Part 6 Y5 (amending
 *  Part 4 W1) adds `reviews`, `{ [repositoryId]: record set }`, owned by the durable
 *  review adapter (plugin-data-review-repository.ts) and written under the same lock. */
export interface PluginDataShape {
  profiles?: unknown;
  bindings?: unknown;
  reviews?: unknown;
}
```

with:

```ts
 *  ports. Every read/write from either store goes through here. Part 6 Y5 (amending
 *  Part 4 W1) adds `reviews`, `{ [repositoryId]: record set }`, owned by the durable
 *  review adapter (plugin-data-review-repository.ts) and written under the same lock.
 *  Part 7 Z1 adds `analyzers`, `{ [profileId]: fallow executable record }`, owned by
 *  plugin-data-analyzer-store.ts, under the same lock. */
export interface PluginDataShape {
  profiles?: unknown;
  bindings?: unknown;
  reviews?: unknown;
  analyzers?: unknown;
}
```

Create `tests/fixtures/in-memory-analyzer-store.ts`:

```ts
// Part 7 Z3: the in-memory AnalyzerBindingStore, for the service, component and harness
// tests. It applies the SAME pure rules as the durable adapter (applyAnalyzerWrite), and
// passes the same contract (tests/contracts/analyzer-binding-store.contract.ts).
import { applyAnalyzerWrite, decodeAnalyzerRecord, type AnalyzerWrite } from '../../src/application/analysis/analyzer-record';
import type { AnalyzerBindingStore } from '../../src/application/ports/analyzer-binding-store';

export function createInMemoryAnalyzerStore(machineId = 'machine-test', initial?: unknown): AnalyzerBindingStore & { slice(): unknown } {
  let slice: unknown = initial === undefined ? undefined : JSON.parse(JSON.stringify(initial));
  const write = (profileId: string, change: AnalyzerWrite): Promise<void> => {
    try {
      slice = applyAnalyzerWrite(slice, profileId, machineId, change);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
  };
  return {
    read: (profileId) => Promise.resolve(decodeAnalyzerRecord(slice, profileId, machineId)),
    bind: (profileId, executablePath) => write(profileId, { op: 'bind', executablePath }),
    setTimeoutSeconds: (profileId, seconds) => write(profileId, { op: 'timeout', seconds }),
    grantTrust: (profileId, trust, expectedPath) => write(profileId, { op: 'grant', trust, expectedPath }),
    revokeTrust: (profileId) => write(profileId, { op: 'revoke' }),
    forget: (profileId) => write(profileId, { op: 'forget' }),
    purge: (profileId) => write(profileId, { op: 'purge' }),
    slice: () => slice,
  };
}
```

- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/unit/analyzer-record.test.ts tests/unit/analyzer-binding-store.test.ts`
Expected: PASS (both contract runs, plus the durable-only cases).

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/application/analysis/analyzer-record.ts src/application/ports/analyzer-binding-store.ts src/adapters/storage tests/fixtures/in-memory-analyzer-store.ts tests/contracts/analyzer-binding-store.contract.ts tests/unit/analyzer-record.test.ts tests/unit/analyzer-binding-store.test.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add src/application/analysis/analyzer-record.ts src/application/ports/analyzer-binding-store.ts src/adapters/storage/plugin-data-analyzer-store.ts src/adapters/storage/plugin-data-shape.ts tests/fixtures/in-memory-analyzer-store.ts tests/contracts/analyzer-binding-store.contract.ts tests/unit/analyzer-record.test.ts tests/unit/analyzer-binding-store.test.ts
git commit -m "feat(storage): the analyzers slice in data.json: record schema, binding-store port and durable store (Z1-Z3)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Run the covering tests.**

Run: `npx vitest run tests/unit/analyzer-record.test.ts tests/unit/analyzer-binding-store.test.ts tests/unit/plugin-data-shape.test.ts tests/unit/review-repository.test.ts tests/unit/binding-store.test.ts`
Expected: PASS.

---

### Task 3: Collected provenance and stale-after-failure (Z23, Z25)

**Files:**
- Modify: `src/application/evidence/model.ts` (73 → ~100): after the `EvidenceReport` interface's `normalized` field (line 72) and at the end of the file
- Modify: `src/application/ports/evidence-repository.ts` (15 → 17): the interface body
- Modify: `src/adapters/storage/in-memory-evidence-store.ts` (40 → 50): after `remove` (line 26)
- Modify: `src/ui/read-models/evidence-index.ts` (131 → 132): line 83 (`build`'s `state`)
- Modify: `tests/unit/evidence-store.test.ts` (135 → 136) and `tests/host/city-view-evidence.test.ts` (131 → 132): the hand-built `EvidenceRepository` doubles gain `markStale`
- Test: `tests/unit/in-memory-evidence-store.test.ts` (68 → ~95), `tests/unit/evidence-index.test.ts` (188 → ~205), `tests/unit/evidence-model.test.ts` (new, ~30)

**Interfaces:**
- Consumes: `EvidenceReport`, `InMemoryEvidenceStore`, `evidenceIndexFor(files, report, snapshotId)`, `emptyEvidenceReport(snapshotId, fileName?)`, `syntheticEvidenceReport(snapshot)` (`tests/fixtures/evidence-report.ts`), `fileSummariesFor` (as `tests/unit/evidence-index.test.ts` already uses it).
- Produces:
  - `interface CollectedRunProvenance { origin: 'collected'; sourceMatch: 'verified'; runId: string; rootPath: string; executablePath: string; args: readonly string[]; exitCode: 0 | 1; startedAt: string; durationMs: number; versionTested: boolean }`
  - `EvidenceReport.collected?: CollectedRunProvenance`; `EvidenceReport.staleReason?: 'failed-run'`
  - `type EvidenceOrigin = 'imported' | 'collected'`; `originOf(report: EvidenceReport): EvidenceOrigin`
  - `EvidenceRepository.markStale(repositoryId: string): void`

- [ ] **Step 1: Write the failing tests.**

Create `tests/unit/evidence-model.test.ts`:

```ts
// Part 7 Z25: an imported report keeps its exact Part 6 shape; only a collected run has
// `collected`, and that is how its origin is told.
import { describe, expect, it } from 'vitest';
import { originOf, type EvidenceReport } from '../../src/application/evidence/model';
import { emptyEvidenceReport } from '../fixtures/evidence-report';

describe('originOf (Z25)', () => {
  it('is imported without `collected`, and the Part 6 shape has no new key', () => {
    const imported = emptyEvidenceReport('s1');
    expect(originOf(imported)).toBe('imported');
    expect(Object.keys(imported).sort()).toEqual(
      ['fileName', 'importedAt', 'normalized', 'provider', 'providerVersion', 'reportKind', 'schemaVersion', 'snapshotId', 'stripPrefix']);
  });

  it('is collected with `collected`', () => {
    const collected: EvidenceReport = {
      ...emptyEvidenceReport('s1', 'fallow.exe'),
      collected: {
        origin: 'collected', sourceMatch: 'verified', runId: 'r1', rootPath: 'C:\\repo', executablePath: 'C:\\Tools\\fallow\\fallow.exe',
        args: ['--format', 'json', '--no-cache', '--quiet', '--root', 'C:\\repo'], exitCode: 1,
        startedAt: '2026-09-23T10:00:00.000Z', durationMs: 900, versionTested: true,
      },
    };
    expect(originOf(collected)).toBe('collected');
  });
});
```

In `tests/unit/in-memory-evidence-store.test.ts`, before the file's final `});`, add:

```ts
  it('Part 7 Z23: markStale marks the stored report stale once, as a new object, and notifies', () => {
    const store = new InMemoryEvidenceStore();
    const listener = vi.fn();
    const report = emptyEvidenceReport('s1');
    store.put('p1', report);
    store.subscribe(listener);
    store.markStale('p1');
    const marked = store.get('p1');
    expect(marked).not.toBe(report);
    expect(marked).toEqual({ ...report, staleReason: 'failed-run' });
    expect(report).not.toHaveProperty('staleReason');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('p1');
    store.markStale('p1');
    expect(store.get('p1')).toBe(marked);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('Part 7 Z23: markStale with no report does nothing and notifies nobody', () => {
    const store = new InMemoryEvidenceStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.markStale('p1');
    expect(store.get('p1')).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  it('Part 7 Z23: a later put replaces the marked report with an unmarked one', () => {
    const store = new InMemoryEvidenceStore();
    store.put('p1', emptyEvidenceReport('s1'));
    store.markStale('p1');
    const fresh = emptyEvidenceReport('s2');
    store.put('p1', fresh);
    expect(store.get('p1')).toBe(fresh);
  });
```

At the end of `tests/unit/evidence-index.test.ts` (after the last `describe` block; the file already imports `evidenceIndexFor` and defines the module-level `snap`, `files` and `report` for a 20-file fixture), add:

```ts
describe('stale after a failed run (Part 7 Z23)', () => {
  it('a report marked after a failed run is stale even for its own snapshot, and keeps its counts', () => {
    const current = evidenceIndexFor(files, report, snap.snapshotId);
    const marked = evidenceIndexFor(files, { ...report, staleReason: 'failed-run' }, snap.snapshotId);
    expect(current.state).toBe('current');
    expect(marked.state).toBe('stale');
    expect(marked.matchedFindings).toBe(current.matchedFindings);
    expect(marked.totals.findings).toMatchObject({ state: 'stale', value: current.matchedFindings });
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/unit/evidence-model.test.ts tests/unit/in-memory-evidence-store.test.ts tests/unit/evidence-index.test.ts`
Expected: FAIL — `originOf` is not exported (`evidence-model.test.ts`), `store.markStale is not a function`, and the marked index reads `current`.

- [ ] **Step 3: Implement.**

In `src/application/evidence/model.ts`, replace the end of the `EvidenceReport` interface:

```ts
  stripPrefix: string | null;
  normalized: NormalizedEvidence;
}
```

with:

```ts
  stripPrefix: string | null;
  normalized: NormalizedEvidence;
  /** Part 7 Z25: present only for a run the user started; an imported report never has it.
   *  For a collected report `fileName` is the executable's base name, `importedAt` is when
   *  the result was attached, and `stripPrefix` is null. */
  collected?: CollectedRunProvenance;
  /** Part 7 Z23: set by EvidenceRepository.markStale after an operational run failure. */
  staleReason?: 'failed-run';
}

/** Part 7 Z25: where a collected report came from. Held in memory only (Y28): the absolute
 *  paths are never persisted, exported or put in getState(). "Verified" means the run's
 *  root was the snapshot's own scope.rootPath and that snapshot was still the latest when
 *  the result was published (Z20). */
export interface CollectedRunProvenance {
  origin: 'collected';
  sourceMatch: 'verified';
  runId: string;
  rootPath: string;
  executablePath: string;
  args: readonly string[];
  exitCode: 0 | 1;
  startedAt: string;
  durationMs: number;
  versionTested: boolean;
}

export type EvidenceOrigin = 'imported' | 'collected';

export function originOf(report: EvidenceReport): EvidenceOrigin {
  return report.collected === undefined ? 'imported' : 'collected';
}
```

In `src/application/ports/evidence-repository.ts`, replace:

```ts
  /** Called with the codebase whose report changed. Returns the unsubscribe function. */
  subscribe(listener: (repositoryId: string) => void): () => void;
```

with:

```ts
  /** Called with the codebase whose report changed. Returns the unsubscribe function. */
  subscribe(listener: (repositoryId: string) => void): () => void;
  /** Part 7 Z23: after an operational run failure. Replaces the report with a copy marked
   *  `staleReason: 'failed-run'` and notifies; nothing when there is none or it is marked. */
  markStale(repositoryId: string): void;
```

In `src/adapters/storage/in-memory-evidence-store.ts`, replace:

```ts
  remove(repositoryId: string): void {
    if (this.byRepository.delete(repositoryId)) this.notify(repositoryId);
  }
```

with:

```ts
  remove(repositoryId: string): void {
    if (this.byRepository.delete(repositoryId)) this.notify(repositoryId);
  }

  /** Part 7 Z23: a failed run never clears evidence; it marks it. A NEW object, so every
   *  memo keyed on the report (E53) recomputes. */
  markStale(repositoryId: string): void {
    const report = this.byRepository.get(repositoryId);
    if (report === undefined || report.staleReason === 'failed-run') return;
    this.byRepository.set(repositoryId, { ...report, staleReason: 'failed-run' });
    this.notify(repositoryId);
  }
```

In `src/ui/read-models/evidence-index.ts`, replace line 83:

```ts
  const state: EvidenceIndexState = report === null ? 'none' : report.snapshotId === snapshotId ? 'current' : 'stale';
```

with:

```ts
  // Part 7 Z23: stale for another snapshot (Y30), or after a failed run on this one.
  const state: EvidenceIndexState = report === null ? 'none'
    : report.snapshotId === snapshotId && report.staleReason === undefined ? 'current' : 'stale';
```

In `tests/unit/evidence-store.test.ts` and `tests/host/city-view-evidence.test.ts`, in the hand-built `repository: EvidenceRepository = { … }` literal, replace:

```ts
    remove: (id) => { inner.remove(id); },
```

with:

```ts
    remove: (id) => { inner.remove(id); },
    markStale: (id) => { inner.markStale(id); },
```

- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/unit/evidence-model.test.ts tests/unit/in-memory-evidence-store.test.ts tests/unit/evidence-index.test.ts tests/unit/evidence-store.test.ts tests/host/city-view-evidence.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/application/evidence/model.ts src/application/ports/evidence-repository.ts src/adapters/storage/in-memory-evidence-store.ts src/ui/read-models/evidence-index.ts tests/unit/evidence-model.test.ts tests/unit/in-memory-evidence-store.test.ts tests/unit/evidence-index.test.ts tests/unit/evidence-store.test.ts tests/host/city-view-evidence.test.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add src/application/evidence/model.ts src/application/ports/evidence-repository.ts src/adapters/storage/in-memory-evidence-store.ts src/ui/read-models/evidence-index.ts tests/unit/evidence-model.test.ts tests/unit/in-memory-evidence-store.test.ts tests/unit/evidence-index.test.ts tests/unit/evidence-store.test.ts tests/host/city-view-evidence.test.ts
git commit -m "feat(evidence): collected-run provenance and stale-after-failure (Z23, Z25)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Run the covering tests.**

Run: `npx vitest run tests/unit/evidence-model.test.ts tests/unit/in-memory-evidence-store.test.ts tests/unit/evidence-index.test.ts tests/unit/evidence-store.test.ts tests/host/city-view-evidence.test.ts tests/host/evidence-ports.test.ts tests/unit/fallow-acceptance.test.ts tests/component/quality-fallow.test.ts tests/component/fallow-card.test.ts`
Expected: PASS.

---

### Task 4: The run reducer and the plugin-wide AnalysisCoordinator (Z20, Z21, Z24)

**Files:**
- Create: `src/application/analysis/analysis-state.ts` (~150)
- Create: `src/application/analysis/analysis-coordinator.ts` (~230)
- Create: `tests/fixtures/fake-process-port.ts` (~55)
- Test: `tests/unit/analysis-state.test.ts` (new, ~150)
- Test: `tests/unit/analysis-coordinator.test.ts` (new, ~330)

**Interfaces:**
- Consumes: Task 1 (`FALLOW_RUN_ARGS`, `FALLOW_VERSION_ARGS`, `FALLOW_VERSION_TIMEOUT_MS`, `FALLOW_VERSION_MAX_BYTES`, `FALLOW_STDOUT_MAX_BYTES`, `FALLOW_STDERR_TAIL_BYTES`, `classifyVersionProbe`, `classifyFallowExit`, `OPERATIONAL_FAILURES`, `FallowRunErrorCode`, `fingerprintTrust`, `TrustSubject`, `AnalyzerProcessPort`, `ProcessOutcome`, `ProcessRequest`, `ExecutableFacts`); Task 3 (`EvidenceReport.collected`, `EvidenceRepository.markStale`); `buildEvidenceReport` (`src/application/evidence/normalize-fallow.ts`); `resolveFindings` (`src/application/evidence/resolve-findings.ts`); `fingerprintSource` (`src/application/approval.ts`); `createCancellationToken` (`src/application/scan-coordinator.ts`); `SnapshotStore`, `Clock`, `CancellationToken`; `InMemorySnapshotStore`, `InMemoryEvidenceStore`; tests: `createFixedClock`, `snapshotWithPaths`, `FIXTURE_PROJECT_FILES`, `fallowText`, `emptyEvidenceReport`.
- Produces:
  - `interface AnalysisIdentity { profileId: string; snapshotId: string; rootFingerprint: string; subjectFingerprint: string; runId: string; generation: number }`
  - `type AnalysisRunState = { status: 'idle' } | { status: 'probing'; identity; rootPath: string; startedAt: string; timeoutSeconds: number } | { status: 'running'; identity; rootPath: string; startedAt: string; timeoutSeconds: number; version: string; tested: boolean } | { status: 'cancelling'; identity } | { status: 'completed'; runId; finishedAt; version; tested; matchedFindings: number; matchedFiles: number } | { status: 'cancelled'; runId } | { status: 'failed'; runId; code: FallowRunErrorCode; detail: string; logExcerpt: string; evidenceKept: boolean; finishedAt: string }` (A8: `rootPath` in probing and running)
  - `type AnalysisAction = { type: 'PROBE_STARTED'; identity; rootPath; startedAt; timeoutSeconds } | { type: 'PROBE_PASSED'; runId; version; tested } | { type: 'CANCEL_REQUESTED'; runId } | { type: 'PROCESS_STOPPED'; runId } | { type: 'RUN_COMPLETED'; runId; finishedAt; matchedFindings; matchedFiles } | { type: 'RUN_FAILED'; runId; code; detail; logExcerpt; evidenceKept; finishedAt }`
  - `IDLE: AnalysisRunState`; `isActive(state): boolean` (probing, running, cancelling); `isCancellable(state): boolean` (probing, running); `reduceAnalysis(state, action): AnalysisRunState`; `mayPublish(identity, state, current: { latestSnapshotId: string | null; evidenceUnchanged: boolean }): boolean`
  - `interface RunPlan { subject: TrustSubject; snapshotId: string; timeoutSeconds: number; trustedVersion: string | null; onProbePassed: (version: string) => Promise<'continue' | 'version-changed' | 'changed-since-review'> }` (A7)
  - `interface AnalysisCoordinatorDeps { process: AnalyzerProcessPort; evidence: EvidenceRepository; snapshots: SnapshotStore; clock: Clock; createCancellationToken: () => { token: CancellationToken; cancel: () => void } }`
  - `class AnalysisCoordinator { stateOf(profileId): AnalysisRunState; subscribe(listener: (profileId: string) => void): () => void; start(plan: RunPlan): boolean; cancel(profileId): void; shutdown(): void }`
  - tests: `createFakeProcessPort(): FakeProcessPort` (`requests`, `settle(outcome)`, `pending()`, `killAllCalls()`); `exitedWith(exitCode, stdout)`

- [ ] **Step 1: Write the failing tests.**

Create `tests/fixtures/fake-process-port.ts`:

```ts
// Part 7 Z21: a scriptable AnalyzerProcessPort. Each `run` waits until the test settles
// it; a cancelled token resolves it as `cancelled`, exactly as the real adapter does.
import type { AnalyzerProcessPort, ProcessOutcome, ProcessRequest } from '../../src/application/ports/analyzer-process';
import type { CancellationToken } from '../../src/application/ports/cancellation-token';

interface Pending { request: ProcessRequest; resolve: (outcome: ProcessOutcome) => void }

export interface FakeProcessPort extends AnalyzerProcessPort {
  readonly requests: ProcessRequest[];
  /** Resolves the oldest pending run with `outcome`, then lets the coordinator catch up. */
  settle(outcome: ProcessOutcome): Promise<void>;
  pending(): number;
  killAllCalls(): number;
}

export const exitedWith = (exitCode: number, stdout: string | null): ProcessOutcome =>
  ({ kind: 'exited', exitCode, stdout, stdoutBytes: stdout === null ? 0 : stdout.length, stderrTail: '' });

const tick = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

export function createFakeProcessPort(): FakeProcessPort {
  const requests: ProcessRequest[] = [];
  let queue: Pending[] = [];
  let kills = 0;
  return {
    requests,
    run(request: ProcessRequest, token: CancellationToken): Promise<ProcessOutcome> {
      requests.push(request);
      return new Promise<ProcessOutcome>((resolve) => {
        const entry: Pending = { request, resolve };
        queue.push(entry);
        token.onCancelled(() => {
          queue = queue.filter((e) => e !== entry);
          resolve({ kind: 'cancelled', stderrTail: '' });
        });
      });
    },
    killAll(): void {
      kills += 1;
      const all = queue;
      queue = [];
      for (const entry of all) entry.resolve({ kind: 'cancelled', stderrTail: '' });
    },
    async settle(outcome: ProcessOutcome): Promise<void> {
      const entry = queue.shift();
      if (!entry) throw new Error('fake process port: nothing is running');
      entry.resolve(outcome);
      await tick();
      await tick();
    },
    pending: () => queue.length,
    killAllCalls: () => kills,
  };
}
```

Create `tests/unit/analysis-state.test.ts`:

```ts
// Part 7 Z20: the per-codebase run reducer, mirroring run-state.ts. One run per codebase;
// cancelling forbids publication immediately; only the process's own confirmation ends a
// cancel; and a result publishes only for the same identity, the latest snapshot and
// unchanged evidence.
import { describe, expect, it } from 'vitest';
import {
  IDLE, isActive, isCancellable, mayPublish, reduceAnalysis, type AnalysisIdentity, type AnalysisRunState,
} from '../../src/application/analysis/analysis-state';

const ID: AnalysisIdentity = { profileId: 'p1', snapshotId: 's1', rootFingerprint: 'aaaaaaaa', subjectFingerprint: 'bbbbbbbb', runId: 'r1', generation: 0 };
const AT = '2026-09-23T10:00:00.000Z';
const started = reduceAnalysis(IDLE, { type: 'PROBE_STARTED', identity: ID, rootPath: '/repo', startedAt: AT, timeoutSeconds: 120 });
const running = reduceAnalysis(started, { type: 'PROBE_PASSED', runId: 'r1', version: '3.27.0', tested: true });
const NOW = { latestSnapshotId: 's1', evidenceUnchanged: true };

describe('reduceAnalysis (Z20)', () => {
  it('idle → probing → running', () => {
    expect(started).toEqual({ status: 'probing', identity: ID, rootPath: '/repo', startedAt: AT, timeoutSeconds: 120 });
    expect(running).toEqual({ status: 'running', identity: ID, rootPath: '/repo', startedAt: AT, timeoutSeconds: 120, version: '3.27.0', tested: true });
  });

  it('refuses a second start while probing, running or cancelling (the same object comes back)', () => {
    const other = { type: 'PROBE_STARTED', identity: { ...ID, runId: 'r2', generation: 1 }, rootPath: '/repo', startedAt: AT, timeoutSeconds: 120 } as const;
    const cancelling = reduceAnalysis(running, { type: 'CANCEL_REQUESTED', runId: 'r1' });
    for (const state of [started, running, cancelling]) expect(reduceAnalysis(state, other)).toBe(state);
  });

  it('starts again from any finished state', () => {
    const done = reduceAnalysis(running, { type: 'RUN_COMPLETED', runId: 'r1', finishedAt: AT, matchedFindings: 5, matchedFiles: 4 });
    expect(reduceAnalysis(done, { type: 'PROBE_STARTED', identity: { ...ID, runId: 'r2' }, rootPath: '/repo', startedAt: AT, timeoutSeconds: 60 }).status).toBe('probing');
  });

  it('cancel moves probing or running to cancelling, and only PROCESS_STOPPED ends it', () => {
    for (const state of [started, running]) {
      const cancelling = reduceAnalysis(state, { type: 'CANCEL_REQUESTED', runId: 'r1' });
      expect(cancelling).toEqual({ status: 'cancelling', identity: ID });
      expect(reduceAnalysis(cancelling, { type: 'RUN_COMPLETED', runId: 'r1', finishedAt: AT, matchedFindings: 1, matchedFiles: 1 })).toBe(cancelling);
      expect(reduceAnalysis(cancelling, { type: 'RUN_FAILED', runId: 'r1', code: 'timed-out', detail: '120', logExcerpt: '', evidenceKept: false, finishedAt: AT })).toBe(cancelling);
      expect(reduceAnalysis(cancelling, { type: 'PROCESS_STOPPED', runId: 'r1' })).toEqual({ status: 'cancelled', runId: 'r1' });
    }
  });

  it('ignores every action for another run id', () => {
    expect(reduceAnalysis(started, { type: 'PROBE_PASSED', runId: 'r9', version: '3.27.0', tested: true })).toBe(started);
    expect(reduceAnalysis(running, { type: 'CANCEL_REQUESTED', runId: 'r9' })).toBe(running);
    expect(reduceAnalysis(running, { type: 'RUN_COMPLETED', runId: 'r9', finishedAt: AT, matchedFindings: 1, matchedFiles: 1 })).toBe(running);
    expect(reduceAnalysis(running, { type: 'RUN_FAILED', runId: 'r9', code: 'exit-code', detail: '3', logExcerpt: '', evidenceKept: false, finishedAt: AT })).toBe(running);
  });

  it('completes only from running, carrying the version', () => {
    expect(reduceAnalysis(started, { type: 'RUN_COMPLETED', runId: 'r1', finishedAt: AT, matchedFindings: 1, matchedFiles: 1 })).toBe(started);
    expect(reduceAnalysis(running, { type: 'RUN_COMPLETED', runId: 'r1', finishedAt: AT, matchedFindings: 5, matchedFiles: 4 }))
      .toEqual({ status: 'completed', runId: 'r1', finishedAt: AT, version: '3.27.0', tested: true, matchedFindings: 5, matchedFiles: 4 });
  });

  it('fails from probing or running', () => {
    const failure = { type: 'RUN_FAILED', runId: 'r1', code: 'version-unsupported', detail: '4.0.0', logExcerpt: 'log', evidenceKept: true, finishedAt: AT } as const;
    for (const state of [started, running]) {
      expect(reduceAnalysis(state, failure)).toEqual({ status: 'failed', runId: 'r1', code: 'version-unsupported', detail: '4.0.0', logExcerpt: 'log', evidenceKept: true, finishedAt: AT });
    }
  });

  it('isActive and isCancellable', () => {
    const cancelling = reduceAnalysis(running, { type: 'CANCEL_REQUESTED', runId: 'r1' });
    const table: [AnalysisRunState, boolean, boolean][] = [
      [IDLE, false, false], [started, true, true], [running, true, true], [cancelling, true, false],
      [{ status: 'cancelled', runId: 'r1' }, false, false],
    ];
    for (const [state, active, cancellable] of table) {
      expect(isActive(state), state.status).toBe(active);
      expect(isCancellable(state), state.status).toBe(cancellable);
    }
  });
});

describe('mayPublish (Z20)', () => {
  it('publishes the running identity on the latest snapshot with unchanged evidence', () => {
    expect(mayPublish(ID, running, NOW)).toBe(true);
  });

  it('never while probing or cancelling', () => {
    expect(mayPublish(ID, started, NOW)).toBe(false);
    expect(mayPublish(ID, reduceAnalysis(running, { type: 'CANCEL_REQUESTED', runId: 'r1' }), NOW)).toBe(false);
  });

  it.each(Object.keys(ID) as (keyof AnalysisIdentity)[])('never when the identity differs in %s', (key) => {
    const changed = { ...ID, [key]: key === 'generation' ? 5 : 'other' };
    expect(mayPublish(changed, running, key === 'snapshotId' ? { ...NOW, latestSnapshotId: 'other' } : NOW)).toBe(false);
  });

  it('never when a newer snapshot exists, or the evidence changed meanwhile', () => {
    expect(mayPublish(ID, running, { latestSnapshotId: 's2', evidenceUnchanged: true })).toBe(false);
    expect(mayPublish(ID, running, { latestSnapshotId: null, evidenceUnchanged: true })).toBe(false);
    expect(mayPublish(ID, running, { latestSnapshotId: 's1', evidenceUnchanged: false })).toBe(false);
  });
});
```

Create `tests/unit/analysis-coordinator.test.ts`:

```ts
// Part 7 Z21/Z23/Z24, acceptance (4) and (5): the plugin-wide coordinator over a scripted
// process port. It probes, runs, classifies, publishes atomically as collected evidence,
// keeps old evidence on failure (marked stale), and never lets a cancelled or superseded
// run overwrite a newer snapshot or newer evidence.
import { describe, expect, it } from 'vitest';
import { AnalysisCoordinator, type RunPlan } from '../../src/application/analysis/analysis-coordinator';
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import type { TrustSubject } from '../../src/application/analysis/analyzer-trust';
import type { AnalysisRunState } from '../../src/application/analysis/analysis-state';
import type { ExecutableFacts } from '../../src/application/ports/executable-inspector';
import { createCancellationToken } from '../../src/application/scan-coordinator';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFixedClock } from '../fixtures/clock';
import { createFakeProcessPort, exitedWith } from '../fixtures/fake-process-port';
import { emptyEvidenceReport, snapshotWithPaths } from '../fixtures/evidence-report';
import { FIXTURE_PROJECT_FILES } from '../fixtures/fallow-expected';
import { fallowText } from '../fixtures/fallow-fixture';

const REPORT = fallowText('combined-3.27.0');
const ERROR_JSON = JSON.stringify({ error: true, message: 'invalid root path', exit_code: 2 });
const SNAPSHOT = snapshotWithPaths(FIXTURE_PROJECT_FILES, 'p1');
const ROOT = SNAPSHOT.scope.rootPath;
const FACTS: ExecutableFacts = { executablePath: '/opt/fallow/bin/fallow', realPath: '/opt/fallow/bin/fallow', size: 1000, mtimeMs: 1, format: 'elf', insideRoot: false };
const SUBJECT: TrustSubject = { profileId: 'p1', machineId: 'm', rootPath: ROOT, args: FALLOW_RUN_ARGS(ROOT), facts: FACTS };

function setup() {
  const process = createFakeProcessPort();
  const evidence = new InMemoryEvidenceStore();
  const clock = createFixedClock('2026-09-23T10:00:00.000Z');
  const snapshots = new InMemorySnapshotStore(clock);
  snapshots.put(SNAPSHOT);
  const coordinator = new AnalysisCoordinator({ process, evidence, snapshots, clock, createCancellationToken });
  const seen: AnalysisRunState['status'][] = [];
  coordinator.subscribe((id) => { if (id === 'p1') seen.push(coordinator.stateOf('p1').status); });
  return { process, evidence, snapshots, clock, coordinator, seen };
}
const plan = (overrides: Partial<RunPlan> = {}): RunPlan => ({
  subject: SUBJECT, snapshotId: SNAPSHOT.snapshotId, timeoutSeconds: 120, trustedVersion: '3.27.0',
  onProbePassed: () => Promise.resolve('continue'), ...overrides,
});
async function probed(s: ReturnType<typeof setup>, p: RunPlan = plan()): Promise<void> {
  expect(s.coordinator.start(p)).toBe(true);
  await s.process.settle(exitedWith(0, 'fallow 3.27.0\n'));
}

describe('AnalysisCoordinator: the happy path (Z21)', () => {
  it('probes first (--version, 5 s, 4 KB, in the root), then runs the exact argv with the plan\'s limit and the 16 MB cap', async () => {
    const s = setup();
    await probed(s);
    expect(s.process.requests.map((r) => r.args)).toEqual([['--version'], FALLOW_RUN_ARGS(ROOT)]);
    expect(s.process.requests[0]).toMatchObject({ executablePath: FACTS.executablePath, cwd: ROOT, timeoutMs: 5_000, maxStdoutBytes: 4_096, maxStderrBytes: 65_536 });
    expect(s.process.requests[1]).toMatchObject({ executablePath: FACTS.executablePath, cwd: ROOT, timeoutMs: 120_000, maxStdoutBytes: 16 * 1024 * 1024 });
    expect(s.seen).toEqual(['probing', 'running']);
  });

  it('publishes a completed run as collected, verified evidence, and counts what matched', async () => {
    const s = setup();
    await probed(s);
    s.clock.advance(900);
    await s.process.settle(exitedWith(0, REPORT));
    const state = s.coordinator.stateOf('p1');
    expect(state).toMatchObject({ status: 'completed', version: '3.27.0', tested: true, matchedFindings: 5, matchedFiles: 4 });
    const report = s.evidence.get('p1');
    expect(report).toMatchObject({ provider: 'fallow', providerVersion: '3.27.0', reportKind: 'combined', fileName: 'fallow', snapshotId: SNAPSHOT.snapshotId, stripPrefix: null });
    expect(report?.collected).toEqual({
      origin: 'collected', sourceMatch: 'verified', runId: state.status === 'completed' ? state.runId : '', rootPath: ROOT,
      executablePath: FACTS.executablePath, args: FALLOW_RUN_ARGS(ROOT), exitCode: 0,
      startedAt: '2026-09-23T10:00:00.000Z', durationMs: 900, versionTested: true,
    });
  });

  it('exit 1 with findings is completed, and records exit code 1', async () => {
    const s = setup();
    await probed(s);
    await s.process.settle(exitedWith(1, REPORT));
    expect(s.coordinator.stateOf('p1').status).toBe('completed');
    expect(s.evidence.get('p1')?.collected?.exitCode).toBe(1);
  });

  it('labels an untested 3.x version and still runs it', async () => {
    const s = setup();
    expect(s.coordinator.start(plan({ trustedVersion: null }))).toBe(true);
    await s.process.settle(exitedWith(0, 'fallow 3.28.0'));
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'running', version: '3.28.0', tested: false });
  });
});

describe('AnalysisCoordinator: failures keep old evidence (acceptance 4, Z23)', () => {
  it('an operational failure keeps the report and marks it stale', async () => {
    const s = setup();
    const old = emptyEvidenceReport(SNAPSHOT.snapshotId);
    s.evidence.put('p1', old);
    await probed(s);
    await s.process.settle({ ...exitedWith(2, ERROR_JSON), stderrTail: 'boom' });
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'analyzer-error', detail: 'invalid root path', logExcerpt: 'boom', evidenceKept: true });
    expect(s.evidence.get('p1')).toEqual({ ...old, staleReason: 'failed-run' });
  });

  it('with no evidence it attaches nothing and says so', async () => {
    const s = setup();
    await probed(s);
    await s.process.settle({ kind: 'timed-out', stderrTail: '' });
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'timed-out', detail: '120', evidenceKept: false });
    expect(s.evidence.get('p1')).toBeNull();
  });

  it('a probe of fallow 4 stops before the run, and is operational', async () => {
    const s = setup();
    s.evidence.put('p1', emptyEvidenceReport(SNAPSHOT.snapshotId));
    expect(s.coordinator.start(plan())).toBe(true);
    await s.process.settle(exitedWith(0, 'fallow 4.0.0'));
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'version-unsupported', detail: '4.0.0' });
    expect(s.process.requests).toHaveLength(1);
    expect(s.evidence.get('p1')?.staleReason).toBe('failed-run');
  });

  it('Review Focus 4: a binary that vanished after the check fails as executable-missing, never runs, and keeps the evidence stale', async () => {
    const s = setup();
    s.evidence.put('p1', emptyEvidenceReport(SNAPSHOT.snapshotId));
    expect(s.coordinator.start(plan())).toBe(true);
    await s.process.settle({ kind: 'spawn-failed', errorCode: 'ENOENT' });
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'executable-missing', evidenceKept: true });
    expect(s.process.requests).toHaveLength(1);
    expect(s.evidence.get('p1')?.staleReason).toBe('failed-run');
  });

  it('a version change or a moved binding ends the run quietly, before the analysis, evidence untouched', async () => {
    for (const verdict of ['version-changed', 'changed-since-review'] as const) {
      const s = setup();
      const old = emptyEvidenceReport(SNAPSHOT.snapshotId);
      s.evidence.put('p1', old);
      await probed(s, plan({ onProbePassed: () => Promise.resolve(verdict) }));
      expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: verdict });
      expect(s.process.requests).toHaveLength(1);
      expect(s.evidence.get('p1')).toBe(old);
    }
  });

  it('findings that match no file are refused as source-mismatch, and attach nothing', async () => {
    const s = setup();
    const elsewhere = { ...snapshotWithPaths(['other/a.ts'], 'p1'), snapshotId: 'snapshot-elsewhere' };
    s.snapshots.put(elsewhere);
    await probed(s, plan({ snapshotId: 'snapshot-elsewhere' }));
    await s.process.settle(exitedWith(0, REPORT));
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'source-mismatch' });
    expect(s.evidence.get('p1')).toBeNull();
  });

  it('a throwing onProbePassed ends the run as failed, never stuck', async () => {
    const s = setup();
    await probed(s, plan({ onProbePassed: () => Promise.reject(new Error('disk full')) }));
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'spawn-failed', detail: 'internal' });
  });
});

describe('AnalysisCoordinator: cancelled or superseded runs never publish (acceptance 5)', () => {
  it('cancel while probing: cancelling at once, cancelled only when the process confirms, nothing published', async () => {
    const s = setup();
    expect(s.coordinator.start(plan())).toBe(true);
    s.coordinator.cancel('p1');
    expect(s.coordinator.stateOf('p1').status).toBe('cancelling');
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(s.coordinator.stateOf('p1').status).toBe('cancelled');
    expect(s.process.requests).toHaveLength(1);
    expect(s.evidence.get('p1')).toBeNull();
  });

  it('cancel while running forbids publication even if the report was already complete', async () => {
    const s = setup();
    await probed(s);
    s.coordinator.cancel('p1');
    expect(s.coordinator.stateOf('p1').status).toBe('cancelling');
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(s.coordinator.stateOf('p1').status).toBe('cancelled');
    expect(s.evidence.get('p1')).toBeNull();
    expect(s.seen).toEqual(['probing', 'running', 'cancelling', 'cancelled']);
  });

  it('a subscriber cancelling on PROBE_PASSED is honoured: the run is never started', async () => {
    const s = setup();
    s.coordinator.subscribe((id) => { if (s.coordinator.stateOf(id).status === 'running') s.coordinator.cancel(id); });
    await probed(s);
    expect(s.coordinator.stateOf('p1').status).toBe('cancelled');
    expect(s.process.requests).toHaveLength(1);
  });

  it('a rescan while running discards the result as snapshot-changed and leaves evidence as it was', async () => {
    const s = setup();
    const old = emptyEvidenceReport(SNAPSHOT.snapshotId);
    s.evidence.put('p1', old);
    await probed(s);
    s.snapshots.put({ ...SNAPSHOT, snapshotId: 'snapshot-newer' });
    await s.process.settle(exitedWith(0, REPORT));
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'snapshot-changed' });
    expect(s.evidence.get('p1')).toBe(old);
  });

  it('an import while running supersedes the run: the import stays', async () => {
    const s = setup();
    await probed(s);
    const imported = emptyEvidenceReport(SNAPSHOT.snapshotId, 'imported.json');
    s.evidence.put('p1', imported);
    await s.process.settle(exitedWith(0, REPORT));
    expect(s.coordinator.stateOf('p1')).toMatchObject({ status: 'failed', code: 'superseded' });
    expect(s.evidence.get('p1')).toBe(imported);
  });

  it('one run per codebase: a second start is refused while active, another codebase may run', async () => {
    const s = setup();
    expect(s.coordinator.start(plan())).toBe(true);
    expect(s.coordinator.start(plan())).toBe(false);
    expect(s.coordinator.start(plan({ subject: { ...SUBJECT, profileId: 'p2' } }))).toBe(true);
    expect(s.process.requests).toHaveLength(2);
  });

  it('cancel is a no-op with nothing to cancel', () => {
    const s = setup();
    s.coordinator.cancel('p1');
    expect(s.coordinator.stateOf('p1').status).toBe('idle');
  });
});

describe('AnalysisCoordinator: shutdown (Z24)', () => {
  it('cancels every active run, kills every child, publishes nothing, and refuses new starts', async () => {
    const s = setup();
    await probed(s);
    expect(s.coordinator.start(plan({ subject: { ...SUBJECT, profileId: 'p2' } }))).toBe(true);
    s.coordinator.shutdown();
    expect(s.process.killAllCalls()).toBe(1);
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(s.coordinator.stateOf('p1').status).toBe('cancelled');
    expect(s.coordinator.stateOf('p2').status).toBe('cancelled');
    expect(s.evidence.get('p1')).toBeNull();
    expect(s.coordinator.start(plan())).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/unit/analysis-state.test.ts tests/unit/analysis-coordinator.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/application/analysis/analysis-state"` (and `…/analysis-coordinator`).

- [ ] **Step 3: Implement.**

Create `src/application/analysis/analysis-state.ts`:

```ts
// Part 7 Z20: one codebase's fallow run, as a pure reducer mirroring run-state.ts. The
// coordinator keeps one state per profile. A run publishes only while `running`, for the
// same identity, on the codebase's latest snapshot, with the evidence unchanged since it
// started: a cancelled or superseded run can never overwrite newer data (acceptance 5).
import type { FallowRunErrorCode } from './fallow-run-errors';

export interface AnalysisIdentity {
  profileId: string;
  snapshotId: string;
  rootFingerprint: string;
  /** fingerprintTrust(subject, ''): the reviewed facts, without the version. */
  subjectFingerprint: string;
  runId: string;
  generation: number;
}

export type AnalysisRunState =
  | { status: 'idle' }
  | { status: 'probing'; identity: AnalysisIdentity; rootPath: string; startedAt: string; timeoutSeconds: number }
  | { status: 'running'; identity: AnalysisIdentity; rootPath: string; startedAt: string; timeoutSeconds: number; version: string; tested: boolean }
  | { status: 'cancelling'; identity: AnalysisIdentity }
  | { status: 'completed'; runId: string; finishedAt: string; version: string; tested: boolean; matchedFindings: number; matchedFiles: number }
  | { status: 'cancelled'; runId: string }
  | { status: 'failed'; runId: string; code: FallowRunErrorCode; detail: string; logExcerpt: string; evidenceKept: boolean; finishedAt: string };

export type AnalysisAction =
  | { type: 'PROBE_STARTED'; identity: AnalysisIdentity; rootPath: string; startedAt: string; timeoutSeconds: number }
  | { type: 'PROBE_PASSED'; runId: string; version: string; tested: boolean }
  | { type: 'CANCEL_REQUESTED'; runId: string }
  | { type: 'PROCESS_STOPPED'; runId: string }
  | { type: 'RUN_COMPLETED'; runId: string; finishedAt: string; matchedFindings: number; matchedFiles: number }
  | { type: 'RUN_FAILED'; runId: string; code: FallowRunErrorCode; detail: string; logExcerpt: string; evidenceKept: boolean; finishedAt: string };

export const IDLE: AnalysisRunState = { status: 'idle' };

/** A run is in flight: probing, running or being cancelled. One per codebase. */
export function isActive(state: AnalysisRunState): boolean {
  return state.status === 'probing' || state.status === 'running' || state.status === 'cancelling';
}

/** M36's rule for the cancel command: only a probing or running analysis can be cancelled. */
export function isCancellable(state: AnalysisRunState): boolean {
  return state.status === 'probing' || state.status === 'running';
}

export function reduceAnalysis(state: AnalysisRunState, action: AnalysisAction): AnalysisRunState {
  switch (action.type) {
    case 'PROBE_STARTED':
      if (isActive(state)) return state;
      return { status: 'probing', identity: action.identity, rootPath: action.rootPath, startedAt: action.startedAt, timeoutSeconds: action.timeoutSeconds };
    case 'PROBE_PASSED':
      if (state.status !== 'probing' || state.identity.runId !== action.runId) return state;
      return {
        status: 'running', identity: state.identity, rootPath: state.rootPath, startedAt: state.startedAt,
        timeoutSeconds: state.timeoutSeconds, version: action.version, tested: action.tested,
      };
    case 'CANCEL_REQUESTED':
      if ((state.status !== 'probing' && state.status !== 'running') || state.identity.runId !== action.runId) return state;
      return { status: 'cancelling', identity: state.identity };
    case 'PROCESS_STOPPED':
      if (state.status !== 'cancelling' || state.identity.runId !== action.runId) return state;
      return { status: 'cancelled', runId: action.runId };
    case 'RUN_COMPLETED':
      if (state.status !== 'running' || state.identity.runId !== action.runId) return state;
      return {
        status: 'completed', runId: action.runId, finishedAt: action.finishedAt, version: state.version, tested: state.tested,
        matchedFindings: action.matchedFindings, matchedFiles: action.matchedFiles,
      };
    case 'RUN_FAILED':
      if ((state.status !== 'probing' && state.status !== 'running') || state.identity.runId !== action.runId) return state;
      return {
        status: 'failed', runId: action.runId, code: action.code, detail: action.detail, logExcerpt: action.logExcerpt,
        evidenceKept: action.evidenceKept, finishedAt: action.finishedAt,
      };
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

/** Z20: validation (the Part 6 schema and the mismatch rule) is the caller's; this is the
 *  identity, cancellation and supersession half. `cancelling` forbids publication at once. */
export function mayPublish(
  identity: AnalysisIdentity, state: AnalysisRunState, current: { latestSnapshotId: string | null; evidenceUnchanged: boolean },
): boolean {
  if (state.status !== 'running') return false;
  const s = state.identity;
  return s.profileId === identity.profileId
    && s.snapshotId === identity.snapshotId
    && s.rootFingerprint === identity.rootFingerprint
    && s.subjectFingerprint === identity.subjectFingerprint
    && s.runId === identity.runId
    && s.generation === identity.generation
    && identity.snapshotId === current.latestSnapshotId
    && current.evidenceUnchanged;
}
```

Create `src/application/analysis/analysis-coordinator.ts`:

```ts
// Part 7 Z21/Z23/Z24: ONE coordinator per plugin (main.ts), shared by every leaf; one run
// per codebase. `start` returns at once and the run continues detached: nothing awaits a
// 120 s analysis. The body probes, lets the service store or check trust, runs, classifies
// (fallow-invocation.ts), builds the report with the unchanged Part 6 builder, and
// publishes atomically (`put` then RUN_COMPLETED, no await between: the scan-coordinator
// rule). After EVERY await it checks for a cancel first (ScanCoordinator.start's
// re-entrancy rule). An operational failure keeps the old evidence and marks it stale.
import { fingerprintSource } from '../approval';
import { buildEvidenceReport } from '../evidence/normalize-fallow';
import { resolveFindings } from '../evidence/resolve-findings';
import type { EvidenceReport } from '../evidence/model';
import type { AnalyzerProcessPort, ProcessOutcome, ProcessRequest } from '../ports/analyzer-process';
import type { CancellationToken } from '../ports/cancellation-token';
import type { Clock } from '../ports/clock';
import type { EvidenceRepository } from '../ports/evidence-repository';
import type { SnapshotStore } from '../ports/snapshot-store';
import { fingerprintTrust, type TrustSubject } from './analyzer-trust';
import {
  FALLOW_RUN_ARGS, FALLOW_STDERR_TAIL_BYTES, FALLOW_STDOUT_MAX_BYTES, FALLOW_VERSION_ARGS, FALLOW_VERSION_MAX_BYTES,
  FALLOW_VERSION_TIMEOUT_MS, classifyFallowExit, classifyVersionProbe,
} from './fallow-invocation';
import { OPERATIONAL_FAILURES, type FallowRunErrorCode } from './fallow-run-errors';
import {
  IDLE, isActive, mayPublish, reduceAnalysis, type AnalysisAction, type AnalysisIdentity, type AnalysisRunState,
} from './analysis-state';

export interface RunPlan {
  subject: TrustSubject;
  snapshotId: string;
  timeoutSeconds: number;
  /** null on a first run (Trust and run): the probe's version is then trusted by the service. */
  trustedVersion: string | null;
  /** Called once the probe passed, before the analysis (A7). */
  onProbePassed: (version: string) => Promise<'continue' | 'version-changed' | 'changed-since-review'>;
}

export interface AnalysisCoordinatorDeps {
  process: AnalyzerProcessPort;
  evidence: EvidenceRepository;
  snapshots: SnapshotStore;
  clock: Clock;
  createCancellationToken: () => { token: CancellationToken; cancel: () => void };
}

const logOf = (outcome: ProcessOutcome): string => ('stderrTail' in outcome ? outcome.stderrTail : '');

export class AnalysisCoordinator {
  private readonly states = new Map<string, AnalysisRunState>();
  private readonly listeners = new Set<(profileId: string) => void>();
  private readonly cancels = new Map<string, () => void>();
  private nextGeneration = 0;
  private shutDown = false;

  constructor(private readonly deps: AnalysisCoordinatorDeps) {}

  stateOf(profileId: string): AnalysisRunState {
    return this.states.get(profileId) ?? IDLE;
  }

  subscribe(listener: (profileId: string) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  /** False when this codebase already has a run in flight, or after shutdown. */
  start(plan: RunPlan): boolean {
    const profileId = plan.subject.profileId;
    if (this.shutDown || isActive(this.stateOf(profileId))) return false;
    const identity: AnalysisIdentity = {
      profileId, snapshotId: plan.snapshotId, rootFingerprint: fingerprintSource(plan.subject.rootPath),
      subjectFingerprint: fingerprintTrust(plan.subject, ''), runId: crypto.randomUUID(), generation: this.nextGeneration,
    };
    this.nextGeneration += 1;
    const { token, cancel } = this.deps.createCancellationToken();
    this.cancels.set(identity.runId, cancel);
    const evidenceAtStart = this.deps.evidence.get(profileId);
    this.dispatch(profileId, {
      type: 'PROBE_STARTED', identity, rootPath: plan.subject.rootPath, startedAt: this.deps.clock.nowIso(), timeoutSeconds: plan.timeoutSeconds,
    });
    void this.execute(plan, identity, token, evidenceAtStart).finally(() => { this.cancels.delete(identity.runId); });
    return true;
  }

  /** Cancelling forbids publication at once; `cancelled` follows the process's own end. */
  cancel(profileId: string): void {
    const state = this.stateOf(profileId);
    if (state.status !== 'probing' && state.status !== 'running') return;
    this.dispatch(profileId, { type: 'CANCEL_REQUESTED', runId: state.identity.runId });
    this.cancels.get(state.identity.runId)?.();
  }

  /** Z24: synchronous and idempotent. Nothing publishes, every child is killed, no new run
   *  starts, and every listener is dropped (the leaves are going away with the plugin). */
  shutdown(): void {
    this.shutDown = true;
    for (const [profileId, state] of Array.from(this.states)) {
      if (state.status === 'probing' || state.status === 'running') this.dispatch(profileId, { type: 'CANCEL_REQUESTED', runId: state.identity.runId });
    }
    this.deps.process.killAll();
    for (const cancel of Array.from(this.cancels.values())) cancel();
    this.listeners.clear();
  }

  private async execute(plan: RunPlan, identity: AnalysisIdentity, token: CancellationToken, evidenceAtStart: EvidenceReport | null): Promise<void> {
    const { profileId, runId } = identity;
    const root = plan.subject.rootPath;
    const request = (args: readonly string[], timeoutMs: number, maxStdoutBytes: number): ProcessRequest => ({
      executablePath: plan.subject.facts.executablePath, args, cwd: root, timeoutMs, maxStdoutBytes, maxStderrBytes: FALLOW_STDERR_TAIL_BYTES,
    });
    try {
      const probe = await this.deps.process.run(request(FALLOW_VERSION_ARGS, FALLOW_VERSION_TIMEOUT_MS, FALLOW_VERSION_MAX_BYTES), token);
      if (this.stopIfCancelled(profileId, runId)) return;
      const version = classifyVersionProbe(probe);
      if (!version.ok) { this.fail(profileId, runId, version.code, version.detail, logOf(probe)); return; }
      const verdict = await plan.onProbePassed(version.version);
      if (this.stopIfCancelled(profileId, runId)) return;
      if (verdict !== 'continue') { this.fail(profileId, runId, verdict, version.version, ''); return; }
      this.dispatch(profileId, { type: 'PROBE_PASSED', runId, version: version.version, tested: version.tested });
      if (this.stopIfCancelled(profileId, runId)) return;

      const startedAt = this.deps.clock.nowIso();
      const startedMs = this.deps.clock.now().getTime();
      const outcome = await this.deps.process.run(request(FALLOW_RUN_ARGS(root), plan.timeoutSeconds * 1000, FALLOW_STDOUT_MAX_BYTES), token);
      if (this.stopIfCancelled(profileId, runId)) return;
      const result = classifyFallowExit(outcome, plan.timeoutSeconds);
      if (result.kind === 'cancelled') {
        this.dispatch(profileId, { type: 'CANCEL_REQUESTED', runId });
        this.dispatch(profileId, { type: 'PROCESS_STOPPED', runId });
        return;
      }
      if (result.kind === 'failed') { this.fail(profileId, runId, result.code, result.detail, logOf(outcome)); return; }

      const snapshot = this.deps.snapshots.get(identity.snapshotId);
      if (snapshot === null) { this.fail(profileId, runId, 'snapshot-changed', '', ''); return; }
      const finishedAt = this.deps.clock.nowIso();
      const base = buildEvidenceReport({
        raw: result.report, fileName: plan.subject.facts.executablePath, importedAt: finishedAt, snapshotId: identity.snapshotId, stripPrefix: null,
      });
      const report: EvidenceReport = {
        ...base,
        collected: {
          origin: 'collected', sourceMatch: 'verified', runId, rootPath: root, executablePath: plan.subject.facts.executablePath,
          args: FALLOW_RUN_ARGS(root), exitCode: outcome.kind === 'exited' && outcome.exitCode === 1 ? 1 : 0,
          startedAt, durationMs: this.deps.clock.now().getTime() - startedMs, versionTested: version.tested,
        },
      };
      const paths = new Set(snapshot.entities.filter((e) => e.kind === 'file').map((e) => e.path));
      const { matched } = resolveFindings(report.normalized.findings, paths);
      const reported = report.normalized.findings.length > 0 || report.normalized.rejectedPaths.length > 0;
      if (reported && matched.length === 0) { this.fail(profileId, runId, 'source-mismatch', '', ''); return; }

      const latestSnapshotId = this.deps.snapshots.latestFor(profileId)?.snapshotId ?? null;
      const evidenceUnchanged = this.deps.evidence.get(profileId) === evidenceAtStart;
      if (!mayPublish(identity, this.stateOf(profileId), { latestSnapshotId, evidenceUnchanged })) {
        this.fail(profileId, runId, latestSnapshotId === identity.snapshotId ? 'superseded' : 'snapshot-changed', '', '');
        return;
      }
      // The atomic swap: no await between these two lines.
      this.deps.evidence.put(profileId, report);
      this.dispatch(profileId, {
        type: 'RUN_COMPLETED', runId, finishedAt, matchedFindings: matched.length, matchedFiles: new Set(matched.map((f) => f.path)).size,
      });
    } catch {
      if (!this.stopIfCancelled(profileId, runId)) this.fail(profileId, runId, 'spawn-failed', 'internal', '');
    }
  }

  private stopIfCancelled(profileId: string, runId: string): boolean {
    const state = this.stateOf(profileId);
    if (state.status !== 'cancelling' || state.identity.runId !== runId) return false;
    this.dispatch(profileId, { type: 'PROCESS_STOPPED', runId });
    return true;
  }

  /** Z23: an operational failure keeps the evidence and marks it stale; the others leave it as it was. */
  private fail(profileId: string, runId: string, code: FallowRunErrorCode, detail: string, logExcerpt: string): void {
    const evidenceKept = this.deps.evidence.get(profileId) !== null;
    if (evidenceKept && OPERATIONAL_FAILURES.has(code)) this.deps.evidence.markStale(profileId);
    this.dispatch(profileId, { type: 'RUN_FAILED', runId, code, detail, logExcerpt, evidenceKept, finishedAt: this.deps.clock.nowIso() });
  }

  private dispatch(profileId: string, action: AnalysisAction): void {
    const before = this.stateOf(profileId);
    const after = reduceAnalysis(before, action);
    if (after === before) return;
    this.states.set(profileId, after);
    for (const listener of Array.from(this.listeners)) listener(profileId);
  }
}
```

Note on the `superseded` / `snapshot-changed` split: `mayPublish` has already failed; if the latest snapshot is still this run's, the only remaining reason is changed evidence (`superseded`), otherwise the snapshot moved (`snapshot-changed`).

- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/unit/analysis-state.test.ts tests/unit/analysis-coordinator.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/application/analysis/analysis-state.ts src/application/analysis/analysis-coordinator.ts tests/fixtures/fake-process-port.ts tests/unit/analysis-state.test.ts tests/unit/analysis-coordinator.test.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add src/application/analysis/analysis-state.ts src/application/analysis/analysis-coordinator.ts tests/fixtures/fake-process-port.ts tests/unit/analysis-state.test.ts tests/unit/analysis-coordinator.test.ts
git commit -m "feat(application): the fallow run reducer and the plugin-wide analysis coordinator (Z20, Z21, Z23, Z24)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Run the covering tests.**

Run: `npx vitest run tests/unit/analysis-state.test.ts tests/unit/analysis-coordinator.test.ts tests/unit/run-state.test.ts tests/unit/scan-coordinator.test.ts tests/unit/in-memory-evidence-store.test.ts`
Expected: PASS.

---

### Task 5: The FallowAnalysisService: binding, trust and the pre-run checks (Z7, Z8, Z10, Z11, Z22, Z36)

**Files:**
- Create: `src/application/analysis/fallow-analysis-service.ts` (~250)
- Create: `tests/fixtures/fake-executable-inspector.ts` (~40)
- Test: `tests/unit/fallow-analysis-service.test.ts` (new, ~330)

**Interfaces:**
- Consumes: Tasks 1, 2 and 4 (`FALLOW_RUN_ARGS`, `FALLOW_VERSION_ARGS`, `FALLOW_ENV_ALLOW_LIST`, `FALLOW_TIMEOUT_DEFAULT_S`, `isValidTimeoutSeconds`, `fingerprintTrust`, `isTrustCurrent`, `TrustSubject`, `AnalyzerBinding`, `AnalyzerBindingRead`, `AnalyzerStoreError`, `AnalyzerBindingStore`, `AnalysisCoordinator`, `AnalysisRunState`, `isActive`, `ExecutableFacts`, `ExecutableInspectorPort`); `normalizeAbsolutePath`; `SourceFileSystemPort.stat`; `SnapshotStore.latestFor`; `CodebaseSnapshot`; tests: `createInMemoryAnalyzerStore`, `createFakeProcessPort`, `exitedWith`.
- Produces:
  - `type AnalyzerBindingView = AnalyzerBindingRead & { executableName: 'fallow.exe' | 'fallow' }`
  - `interface RunReview { profileId: string; snapshotId: string; rootPath: string; facts: ExecutableFacts; args: readonly string[]; versionArgs: readonly string[]; envNames: readonly string[]; timeoutSeconds: number; trustedVersion: string | null; subjectFingerprint: string }`
  - `type ReviewResult = { ok: true; review: RunReview } | { ok: false; code: 'executable-refused' | 'executable-missing' | 'root-unavailable'; detail: string }` — the `executable-refused` detail is the refusal, then `:` and the inspector's detail when it has one (`'launcher:fallow.exe'`, `'unreadable:EACCES'`, `'not-native'`) (K35)
  - `type TrustCheck = { kind: 'trusted' } | { kind: 'review'; review: RunReview; reason: 'untrusted' | 'changed' } | { kind: 'unbound'; read: AnalyzerBindingRead } | { kind: 'refused'; code: FallowRunErrorCode; detail: string }` (`unbound` covers `none`, `other-machine`, `invalid`; `unsupported` is `refused`/`store-unsupported`)
  - `type StartOutcome = { kind: 'started' } | { kind: 'review'; review: RunReview; reason: 'untrusted' | 'changed' } | { kind: 'choose-executable'; read: AnalyzerBindingRead } | { kind: 'refused'; code: FallowRunErrorCode; detail: string } | { kind: 'busy' }`
  - `interface FallowAnalysisService { readBinding(profileId): Promise<AnalyzerBindingView>; review(profileId, snapshot, executablePath): Promise<ReviewResult>; checkTrust(profileId, snapshot): Promise<TrustCheck>; run(profileId, snapshot): Promise<StartOutcome>; trustAndRun(profileId, snapshot, review): Promise<StartOutcome>; cancel(profileId): void; forget(profileId): Promise<'forgotten' | 'busy'>; setTimeLimit(profileId, seconds): Promise<'saved' | 'invalid'>; purgeProfile(profileId): Promise<void>; stateOf(profileId): AnalysisRunState; subscribe(listener: (profileId: string) => void): () => void; shutdown(): void }`
  - `interface FallowAnalysisServiceDeps { store: AnalyzerBindingStore; inspector: ExecutableInspectorPort; coordinator: AnalysisCoordinator; snapshots: SnapshotStore; getFilesystem: () => SourceFileSystemPort; machineId: string; clock: Clock }`
  - `createFallowAnalysisService(deps): FallowAnalysisService`
  - tests: `factsFor(executablePath, overrides?): ExecutableFacts`; `createFakeExecutableInspector(executableName?): FakeExecutableInspector` (`calls`, a replaceable `answer(executablePath)`)

- [ ] **Step 1: Write the failing tests.**

Create `tests/fixtures/fake-executable-inspector.ts`:

```ts
// Part 7 Z4/Z22: a scriptable ExecutableInspectorPort. By default every path is a native
// executable with fixed facts; a test replaces `answer` to model a changed or vanished file.
import type { ExecutableFacts, ExecutableInspection, ExecutableInspectorPort } from '../../src/application/ports/executable-inspector';

export function factsFor(executablePath: string, overrides: Partial<ExecutableFacts> = {}): ExecutableFacts {
  return { executablePath, realPath: executablePath, size: 12_400_000, mtimeMs: 1_758_600_000_000, format: 'pe', insideRoot: false, ...overrides };
}

export interface FakeExecutableInspector extends ExecutableInspectorPort {
  readonly calls: { executablePath: string; rootPath: string }[];
  answer: (executablePath: string) => ExecutableInspection;
}

export function createFakeExecutableInspector(executableName: 'fallow.exe' | 'fallow' = 'fallow.exe'): FakeExecutableInspector {
  const inspector: FakeExecutableInspector = {
    calls: [],
    executableName,
    answer: (executablePath) => ({ ok: true, facts: factsFor(executablePath) }),
    inspect(executablePath, rootPath) {
      inspector.calls.push({ executablePath, rootPath });
      return Promise.resolve(inspector.answer(executablePath));
    },
  };
  return inspector;
}
```

Create `tests/unit/fallow-analysis-service.test.ts`:

```ts
// Part 7 Z7/Z8/Z10/Z11/Z22/Z36 and G6's "explicit trust before any probe": the service
// reviews by inspecting only, runs nothing without trust, probes before it stores trust,
// remembers trust until what it covers changes, and refuses stale or busy starts.
import { describe, expect, it } from 'vitest';
import { AnalysisCoordinator } from '../../src/application/analysis/analysis-coordinator';
import { createFallowAnalysisService } from '../../src/application/analysis/fallow-analysis-service';
import { FALLOW_ENV_ALLOW_LIST, FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import { fingerprintTrust, type TrustSubject } from '../../src/application/analysis/analyzer-trust';
import { createCancellationToken } from '../../src/application/scan-coordinator';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFixedClock } from '../fixtures/clock';
import { createFakeProcessPort, exitedWith } from '../fixtures/fake-process-port';
import { createFakeExecutableInspector, factsFor } from '../fixtures/fake-executable-inspector';
import { createInMemoryAnalyzerStore } from '../fixtures/in-memory-analyzer-store';
import { snapshotWithPaths } from '../fixtures/evidence-report';
import { FIXTURE_PROJECT_FILES } from '../fixtures/fallow-expected';

const SNAPSHOT = snapshotWithPaths(FIXTURE_PROJECT_FILES, 'p1');
const ROOT = SNAPSHOT.scope.rootPath;
const EXE = '/opt/fallow/bin/fallow';
const subjectOf = (facts = factsFor(EXE)): TrustSubject => ({ profileId: 'p1', machineId: 'm', rootPath: ROOT, args: FALLOW_RUN_ARGS(ROOT), facts });
/** A SourceFileSystemPort whose `stat` answers for the root; the other members are unused here. */
const dirPort = (exists: () => boolean): SourceFileSystemPort => ({
  stat: () => Promise.resolve({ exists: exists(), isDirectory: exists(), isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 }),
}) as unknown as SourceFileSystemPort;

function setup() {
  const process = createFakeProcessPort();
  const evidence = new InMemoryEvidenceStore();
  const clock = createFixedClock('2026-09-23T10:00:00.000Z');
  const snapshots = new InMemorySnapshotStore(clock);
  snapshots.put(SNAPSHOT);
  const coordinator = new AnalysisCoordinator({ process, evidence, snapshots, clock, createCancellationToken });
  const store = createInMemoryAnalyzerStore('m');
  const inspector = createFakeExecutableInspector('fallow');
  const root = { exists: true };
  const service = createFallowAnalysisService({
    store, inspector, coordinator, snapshots, getFilesystem: () => dirPort(() => root.exists), machineId: 'm', clock,
  });
  return { process, evidence, snapshots, coordinator, store, inspector, root, service };
}
async function trusted(s: ReturnType<typeof setup>, version = '3.27.0'): Promise<void> {
  await s.store.bind('p1', EXE);
  await s.store.grantTrust('p1', { fingerprint: fingerprintTrust(subjectOf(), version), version, grantedAt: '2026-09-23T09:00:00.000Z' }, EXE);
}
async function reviewed(s: ReturnType<typeof setup>) {
  const result = await s.service.review('p1', SNAPSHOT, EXE);
  if (!result.ok) throw new Error(`test setup: review refused (${result.code})`);
  return result.review;
}

describe('reading and reviewing never execute (Z22, Z36)', () => {
  it('readBinding adds the platform\'s executable name', async () => {
    const s = setup();
    expect(await s.service.readBinding('p1')).toEqual({ kind: 'none', executableName: 'fallow' });
  });

  it('review inspects the trimmed, normalised path and shows exactly what would run; nothing runs or is stored', async () => {
    const s = setup();
    const result = await s.service.review('p1', SNAPSHOT, `  ${EXE}  `);
    expect(result).toEqual({
      ok: true,
      review: {
        profileId: 'p1', snapshotId: SNAPSHOT.snapshotId, rootPath: ROOT, facts: factsFor(EXE), args: FALLOW_RUN_ARGS(ROOT),
        versionArgs: ['--version'], envNames: FALLOW_ENV_ALLOW_LIST, timeoutSeconds: 120, trustedVersion: null,
        subjectFingerprint: fingerprintTrust(subjectOf(), ''),
      },
    });
    expect(s.inspector.calls).toEqual([{ executablePath: EXE, rootPath: ROOT }]);
    expect(s.process.requests).toEqual([]);
    expect(await s.store.read('p1')).toEqual({ kind: 'none' });
  });

  it('refuses a relative path without inspecting it, and maps the inspector\'s refusals', async () => {
    const s = setup();
    expect(await s.service.review('p1', SNAPSHOT, 'fallow')).toEqual({ ok: false, code: 'executable-refused', detail: 'not-absolute' });
    expect(s.inspector.calls).toEqual([]);
    s.inspector.answer = () => ({ ok: false, refusal: 'launcher', detail: 'fallow' });
    expect(await s.service.review('p1', SNAPSHOT, EXE)).toEqual({ ok: false, code: 'executable-refused', detail: 'launcher:fallow' });
    s.inspector.answer = () => ({ ok: false, refusal: 'not-native', detail: '' });
    expect(await s.service.review('p1', SNAPSHOT, EXE)).toEqual({ ok: false, code: 'executable-refused', detail: 'not-native' });
    s.inspector.answer = () => ({ ok: false, refusal: 'executable-missing', detail: '' });
    expect(await s.service.review('p1', SNAPSHOT, EXE)).toEqual({ ok: false, code: 'executable-missing', detail: '' });
  });

  it('refuses a root that is no longer a directory', async () => {
    const s = setup();
    s.root.exists = false;
    expect(await s.service.review('p1', SNAPSHOT, EXE)).toEqual({ ok: false, code: 'root-unavailable', detail: '' });
  });
});

describe('explicit trust before any probe (G6, Z7, Z8)', () => {
  it('run with no binding asks for an executable and runs nothing', async () => {
    const s = setup();
    expect(await s.service.run('p1', SNAPSHOT)).toEqual({ kind: 'choose-executable', read: { kind: 'none' } });
    expect(s.process.requests).toEqual([]);
  });

  it('run on an untrusted binding returns the review and runs nothing', async () => {
    const s = setup();
    await s.store.bind('p1', EXE);
    const outcome = await s.service.run('p1', SNAPSHOT);
    expect(outcome).toMatchObject({ kind: 'review', reason: 'untrusted', review: { facts: factsFor(EXE), trustedVersion: null } });
    expect(s.process.requests).toEqual([]);
  });

  it('Trust and run binds, probes --version first, stores trust only after the probe passed, then runs', async () => {
    const s = setup();
    const review = await reviewed(s);
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toEqual({ kind: 'started' });
    expect(s.process.requests.map((r) => r.args)).toEqual([['--version']]);
    expect(await s.store.read('p1')).toMatchObject({ kind: 'bound', binding: { executablePath: EXE, trust: null } });
    await s.process.settle(exitedWith(0, 'fallow 3.27.0'));
    expect(await s.store.read('p1')).toMatchObject({
      kind: 'bound', binding: { trust: { fingerprint: fingerprintTrust(subjectOf(), '3.27.0'), version: '3.27.0', grantedAt: '2026-09-23T10:00:00.000Z' } },
    });
    expect(s.process.requests.map((r) => r.args)).toEqual([['--version'], FALLOW_RUN_ARGS(ROOT)]);
  });

  it('a probe that fails stores no trust', async () => {
    const s = setup();
    await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s));
    await s.process.settle(exitedWith(0, 'fallow 4.0.0'));
    expect(s.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'version-unsupported' });
    expect(await s.store.read('p1')).toMatchObject({ kind: 'bound', binding: { trust: null } });
  });
});

describe('remembered trust (Z7)', () => {
  it('starts directly when nothing changed', async () => {
    const s = setup();
    await trusted(s);
    expect(await s.service.checkTrust('p1', SNAPSHOT)).toEqual({ kind: 'trusted' });
    expect(await s.service.run('p1', SNAPSHOT)).toEqual({ kind: 'started' });
    expect(s.process.requests.map((r) => r.args)).toEqual([['--version']]);
  });

  it('a changed binary reopens the review before anything runs', async () => {
    const s = setup();
    await trusted(s);
    s.inspector.answer = (p) => ({ ok: true, facts: factsFor(p, { size: 1 }) });
    expect(await s.service.run('p1', SNAPSHOT)).toMatchObject({ kind: 'review', reason: 'changed', review: { trustedVersion: '3.27.0' } });
    expect(s.process.requests).toEqual([]);
  });

  it('a different probed version revokes trust and ends the run as version-changed', async () => {
    const s = setup();
    await trusted(s);
    await s.service.run('p1', SNAPSHOT);
    await s.process.settle(exitedWith(0, 'fallow 3.28.0'));
    expect(s.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'version-changed', detail: '3.28.0' });
    expect(await s.store.read('p1')).toMatchObject({ kind: 'bound', binding: { trust: null } });
    expect(s.process.requests).toHaveLength(1);
  });

  it('keeps a bound time limit for the run', async () => {
    const s = setup();
    await trusted(s);
    await s.store.setTimeoutSeconds('p1', 600);
    await s.service.run('p1', SNAPSHOT);
    await s.process.settle(exitedWith(0, 'fallow 3.27.0'));
    expect(s.process.requests[1]?.timeoutMs).toBe(600_000);
  });
});

describe('refusals before a start (Z22)', () => {
  it('Review Focus 4: Trust and run after the file vanished binds nothing and runs nothing', async () => {
    const s = setup();
    const review = await reviewed(s);
    s.inspector.answer = () => ({ ok: false, refusal: 'executable-missing', detail: '' });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toEqual({ kind: 'refused', code: 'executable-missing', detail: '' });
    expect(await s.store.read('p1')).toEqual({ kind: 'none' });
    expect(s.process.requests).toEqual([]);
  });

  it('a file that changed between the review and Trust and run is refused as changed-since-review', async () => {
    const s = setup();
    const review = await reviewed(s);
    s.inspector.answer = (p) => ({ ok: true, facts: factsFor(p, { mtimeMs: 1_758_600_009_000 }) });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toEqual({ kind: 'refused', code: 'changed-since-review', detail: '' });
    expect(await s.store.read('p1')).toEqual({ kind: 'none' });
  });

  it('a leaf showing an older snapshot is refused as snapshot-changed', async () => {
    const s = setup();
    await trusted(s);
    s.snapshots.put({ ...SNAPSHOT, snapshotId: 'snapshot-newer' });
    expect(await s.service.run('p1', SNAPSHOT)).toEqual({ kind: 'refused', code: 'snapshot-changed', detail: '' });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s))).toEqual({ kind: 'refused', code: 'snapshot-changed', detail: '' });
  });

  it('a missing root is refused as root-unavailable; a newer-format record as store-unsupported', async () => {
    const s = setup();
    await trusted(s);
    s.root.exists = false;
    expect(await s.service.run('p1', SNAPSHOT)).toEqual({ kind: 'refused', code: 'root-unavailable', detail: '' });
    const newer = createInMemoryAnalyzerStore('m', { p1: { v: 2 } });
    const t = setup();
    const service = createFallowAnalysisService({
      store: newer, inspector: t.inspector, coordinator: t.coordinator, snapshots: t.snapshots, getFilesystem: () => dirPort(() => true), machineId: 'm', clock: createFixedClock(),
    });
    expect(await service.run('p1', SNAPSHOT)).toEqual({ kind: 'refused', code: 'store-unsupported', detail: '' });
    expect(await service.checkTrust('p1', SNAPSHOT)).toEqual({ kind: 'refused', code: 'store-unsupported', detail: '' });
  });

  it('is busy while a run is active: run, Trust and run and Forget refuse, nothing changes', async () => {
    const s = setup();
    await trusted(s);
    const review = await reviewed(s);
    await s.service.run('p1', SNAPSHOT);
    expect(await s.service.run('p1', SNAPSHOT)).toEqual({ kind: 'busy' });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toEqual({ kind: 'busy' });
    expect(await s.service.forget('p1')).toBe('busy');
    expect(await s.store.read('p1')).toMatchObject({ kind: 'bound' });
  });
});

describe('settings actions (Z10, Z11)', () => {
  it('setTimeLimit writes whole seconds from 10 to 1800 and refuses the rest without writing', async () => {
    const s = setup();
    await s.store.bind('p1', EXE);
    expect(await s.service.setTimeLimit('p1', 300)).toBe('saved');
    expect(await s.service.setTimeLimit('p1', 5)).toBe('invalid');
    expect(await s.service.setTimeLimit('p1', Number.NaN)).toBe('invalid');
    expect(await s.store.read('p1')).toMatchObject({ kind: 'bound', binding: { timeoutSeconds: 300 } });
  });

  it('forget deletes the record when idle', async () => {
    const s = setup();
    await s.store.bind('p1', EXE);
    expect(await s.service.forget('p1')).toBe('forgotten');
    expect(await s.store.read('p1')).toEqual({ kind: 'none' });
  });

  it('purgeProfile cancels the active run and deletes the record whatever its format', async () => {
    const s = setup();
    await trusted(s);
    await s.service.run('p1', SNAPSHOT);
    await s.service.purgeProfile('p1');
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    expect(s.service.stateOf('p1').status).toBe('cancelled');
    expect(await s.store.read('p1')).toEqual({ kind: 'none' });
  });
});
```

- [ ] **Step 2: Run it and watch it fail.**

Run: `npx vitest run tests/unit/fallow-analysis-service.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/application/analysis/fallow-analysis-service"`.

- [ ] **Step 3: Implement.**

Create `src/application/analysis/fallow-analysis-service.ts`:

```ts
// Part 7 Z7/Z8/Z10/Z11/Z22/Z36: what the host and the UI call. It owns the binding and
// trust rules and every pre-run check; the coordinator owns the run itself. Every method
// takes the profile id and, where it needs a root, the snapshot the caller shows.
// - review and checkTrust INSPECT only (stat and a 4-byte header): nothing runs.
// - run starts only with current trust; otherwise it returns the review.
// - trustAndRun binds, then starts; trust is written only once the probe passed.
import { normalizeAbsolutePath } from '../../domain/path-safety';
import type { CodebaseSnapshot } from '../../domain/model';
import type { AnalyzerBindingStore } from '../ports/analyzer-binding-store';
import type { Clock } from '../ports/clock';
import type { ExecutableFacts, ExecutableInspection, ExecutableInspectorPort } from '../ports/executable-inspector';
import type { SnapshotStore } from '../ports/snapshot-store';
import type { SourceFileSystemPort } from '../ports/source-filesystem-port';
import { AnalyzerStoreError, type AnalyzerBinding, type AnalyzerBindingRead } from './analyzer-record';
import { fingerprintTrust, isTrustCurrent, type TrustSubject } from './analyzer-trust';
import { isActive, type AnalysisRunState } from './analysis-state';
import type { AnalysisCoordinator } from './analysis-coordinator';
import {
  FALLOW_ENV_ALLOW_LIST, FALLOW_RUN_ARGS, FALLOW_TIMEOUT_DEFAULT_S, FALLOW_VERSION_ARGS, isValidTimeoutSeconds,
} from './fallow-invocation';
import type { FallowRunErrorCode } from './fallow-run-errors';

export type AnalyzerBindingView = AnalyzerBindingRead & { executableName: 'fallow.exe' | 'fallow' };

export interface RunReview {
  profileId: string;
  snapshotId: string;
  rootPath: string;
  facts: ExecutableFacts;
  args: readonly string[];
  versionArgs: readonly string[];
  envNames: readonly string[];
  timeoutSeconds: number;
  trustedVersion: string | null;
  /** fingerprintTrust(subject, ''): what "Trust and run" checks again. */
  subjectFingerprint: string;
}

export type ReviewResult =
  | { ok: true; review: RunReview }
  | { ok: false; code: 'executable-refused' | 'executable-missing' | 'root-unavailable'; detail: string };

export type TrustCheck =
  | { kind: 'trusted' }
  | { kind: 'review'; review: RunReview; reason: 'untrusted' | 'changed' }
  | { kind: 'unbound'; read: AnalyzerBindingRead }
  | { kind: 'refused'; code: FallowRunErrorCode; detail: string };

export type StartOutcome =
  | { kind: 'started' }
  | { kind: 'review'; review: RunReview; reason: 'untrusted' | 'changed' }
  | { kind: 'choose-executable'; read: AnalyzerBindingRead }
  | { kind: 'refused'; code: FallowRunErrorCode; detail: string }
  | { kind: 'busy' };

export interface FallowAnalysisService {
  readBinding(profileId: string): Promise<AnalyzerBindingView>;
  review(profileId: string, snapshot: CodebaseSnapshot, executablePath: string): Promise<ReviewResult>;
  checkTrust(profileId: string, snapshot: CodebaseSnapshot): Promise<TrustCheck>;
  run(profileId: string, snapshot: CodebaseSnapshot): Promise<StartOutcome>;
  trustAndRun(profileId: string, snapshot: CodebaseSnapshot, review: RunReview): Promise<StartOutcome>;
  cancel(profileId: string): void;
  forget(profileId: string): Promise<'forgotten' | 'busy'>;
  setTimeLimit(profileId: string, seconds: number): Promise<'saved' | 'invalid'>;
  purgeProfile(profileId: string): Promise<void>;
  stateOf(profileId: string): AnalysisRunState;
  subscribe(listener: (profileId: string) => void): () => void;
  shutdown(): void;
}

export interface FallowAnalysisServiceDeps {
  store: AnalyzerBindingStore;
  inspector: ExecutableInspectorPort;
  coordinator: AnalysisCoordinator;
  snapshots: SnapshotStore;
  getFilesystem: () => SourceFileSystemPort;
  machineId: string;
  clock: Clock;
}

type Refusal = { code: 'executable-refused' | 'executable-missing'; detail: string };
type Precheck =
  | { kind: 'trusted'; subject: TrustSubject; binding: AnalyzerBinding; version: string }
  | Exclude<TrustCheck, { kind: 'trusted' }>;

/** K35: `refusal[:detail]`, so the copy can name the expected file or the error code. */
function refusalOf(inspection: Extract<ExecutableInspection, { ok: false }>): Refusal {
  if (inspection.refusal === 'executable-missing') return { code: 'executable-missing', detail: '' };
  return { code: 'executable-refused', detail: inspection.detail === '' ? inspection.refusal : `${inspection.refusal}:${inspection.detail}` };
}

function normalisedPath(raw: string): string | null {
  try {
    return normalizeAbsolutePath(raw.trim());
  } catch {
    return null;
  }
}

export function createFallowAnalysisService(deps: FallowAnalysisServiceDeps): FallowAnalysisService {
  const { store, inspector, coordinator, snapshots, machineId, clock } = deps;

  async function rootIsDirectory(rootPath: string): Promise<boolean> {
    try {
      const stat = await deps.getFilesystem().stat(rootPath);
      return stat.exists && stat.isDirectory;
    } catch {
      return false;
    }
  }

  function subjectOf(profileId: string, snapshot: CodebaseSnapshot, facts: ExecutableFacts): TrustSubject {
    const rootPath = snapshot.scope.rootPath;
    return { profileId, machineId, rootPath, args: FALLOW_RUN_ARGS(rootPath), facts };
  }

  function reviewOf(profileId: string, snapshot: CodebaseSnapshot, facts: ExecutableFacts, timeoutSeconds: number, trustedVersion: string | null): RunReview {
    const subject = subjectOf(profileId, snapshot, facts);
    return {
      profileId, snapshotId: snapshot.snapshotId, rootPath: subject.rootPath, facts, args: subject.args,
      versionArgs: FALLOW_VERSION_ARGS, envNames: FALLOW_ENV_ALLOW_LIST, timeoutSeconds, trustedVersion,
      subjectFingerprint: fingerprintTrust(subject, ''),
    };
  }

  const isLatest = (profileId: string, snapshot: CodebaseSnapshot): boolean =>
    snapshots.latestFor(profileId)?.snapshotId === snapshot.snapshotId;

  async function precheck(profileId: string, snapshot: CodebaseSnapshot): Promise<Precheck> {
    const read = await store.read(profileId);
    if (read.kind === 'unsupported') return { kind: 'refused', code: 'store-unsupported', detail: '' };
    if (read.kind !== 'bound') return { kind: 'unbound', read };
    const binding = read.binding;
    if (!(await rootIsDirectory(snapshot.scope.rootPath))) return { kind: 'refused', code: 'root-unavailable', detail: '' };
    const inspection = await inspector.inspect(binding.executablePath, snapshot.scope.rootPath);
    if (!inspection.ok) return { kind: 'refused', ...refusalOf(inspection) };
    const subject = subjectOf(profileId, snapshot, inspection.facts);
    const trust = binding.trust;
    if (trust !== null && isTrustCurrent(trust, subject, trust.version)) return { kind: 'trusted', subject, binding, version: trust.version };
    return {
      kind: 'review', review: reviewOf(profileId, snapshot, inspection.facts, binding.timeoutSeconds, trust?.version ?? null),
      reason: trust === null ? 'untrusted' : 'changed',
    };
  }

  function startPlan(profileId: string, snapshot: CodebaseSnapshot, subject: TrustSubject, timeoutSeconds: number, trustedVersion: string | null): StartOutcome {
    const started = coordinator.start({
      subject, snapshotId: snapshot.snapshotId, timeoutSeconds, trustedVersion,
      onProbePassed: async (version) => {
        if (trustedVersion === null) {
          try {
            await store.grantTrust(profileId, { fingerprint: fingerprintTrust(subject, version), version, grantedAt: clock.nowIso() }, subject.facts.executablePath);
          } catch (e) {
            if (e instanceof AnalyzerStoreError) return 'changed-since-review';
            throw e;
          }
          return 'continue';
        }
        if (version === trustedVersion) return 'continue';
        await store.revokeTrust(profileId);
        return 'version-changed';
      },
    });
    return started ? { kind: 'started' } : { kind: 'busy' };
  }

  return {
    async readBinding(profileId) {
      return { ...(await store.read(profileId)), executableName: inspector.executableName };
    },

    async review(profileId, snapshot, executablePath) {
      const path = normalisedPath(executablePath);
      if (path === null) return { ok: false, code: 'executable-refused', detail: 'not-absolute' };
      if (!(await rootIsDirectory(snapshot.scope.rootPath))) return { ok: false, code: 'root-unavailable', detail: '' };
      const inspection = await inspector.inspect(path, snapshot.scope.rootPath);
      if (!inspection.ok) return { ok: false, ...refusalOf(inspection) };
      const read = await store.read(profileId);
      const bound = read.kind === 'bound' ? read.binding : null;
      const trustedVersion = bound !== null && bound.executablePath === path ? bound.trust?.version ?? null : null;
      return { ok: true, review: reviewOf(profileId, snapshot, inspection.facts, bound?.timeoutSeconds ?? FALLOW_TIMEOUT_DEFAULT_S, trustedVersion) };
    },

    async checkTrust(profileId, snapshot) {
      const checked = await precheck(profileId, snapshot);
      return checked.kind === 'trusted' ? { kind: 'trusted' } : checked;
    },

    async run(profileId, snapshot) {
      if (isActive(coordinator.stateOf(profileId))) return { kind: 'busy' };
      if (!isLatest(profileId, snapshot)) return { kind: 'refused', code: 'snapshot-changed', detail: '' };
      const checked = await precheck(profileId, snapshot);
      switch (checked.kind) {
        case 'trusted': return startPlan(profileId, snapshot, checked.subject, checked.binding.timeoutSeconds, checked.version);
        case 'review': return { kind: 'review', review: checked.review, reason: checked.reason };
        case 'unbound': return { kind: 'choose-executable', read: checked.read };
        default: return checked;
      }
    },

    async trustAndRun(profileId, snapshot, reviewed) {
      if (isActive(coordinator.stateOf(profileId))) return { kind: 'busy' };
      if (reviewed.profileId !== profileId || reviewed.snapshotId !== snapshot.snapshotId || !isLatest(profileId, snapshot)) {
        return { kind: 'refused', code: 'snapshot-changed', detail: '' };
      }
      const read = await store.read(profileId);
      if (read.kind === 'unsupported') return { kind: 'refused', code: 'store-unsupported', detail: '' };
      if (!(await rootIsDirectory(snapshot.scope.rootPath))) return { kind: 'refused', code: 'root-unavailable', detail: '' };
      const inspection = await inspector.inspect(reviewed.facts.executablePath, snapshot.scope.rootPath);
      if (!inspection.ok) return { kind: 'refused', ...refusalOf(inspection) };
      const subject = subjectOf(profileId, snapshot, inspection.facts);
      if (fingerprintTrust(subject, '') !== reviewed.subjectFingerprint) return { kind: 'refused', code: 'changed-since-review', detail: '' };
      try {
        await store.bind(profileId, reviewed.facts.executablePath);
      } catch (e) {
        if (e instanceof AnalyzerStoreError && e.code === 'unsupported') return { kind: 'refused', code: 'store-unsupported', detail: '' };
        throw e;
      }
      const timeoutSeconds = read.kind === 'bound' ? read.binding.timeoutSeconds : FALLOW_TIMEOUT_DEFAULT_S;
      return startPlan(profileId, snapshot, subject, timeoutSeconds, null);
    },

    cancel(profileId) {
      coordinator.cancel(profileId);
    },

    async forget(profileId) {
      if (isActive(coordinator.stateOf(profileId))) return 'busy';
      await store.forget(profileId);
      return 'forgotten';
    },

    async setTimeLimit(profileId, seconds) {
      if (!isValidTimeoutSeconds(seconds)) return 'invalid';
      await store.setTimeoutSeconds(profileId, seconds);
      return 'saved';
    },

    async purgeProfile(profileId) {
      coordinator.cancel(profileId);
      await store.purge(profileId);
    },

    stateOf: (profileId) => coordinator.stateOf(profileId),
    subscribe: (listener) => coordinator.subscribe(listener),
    shutdown: () => { coordinator.shutdown(); },
  };
}
```

- [ ] **Step 4: Run it and watch it pass.**

Run: `npx vitest run tests/unit/fallow-analysis-service.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/application/analysis/fallow-analysis-service.ts tests/fixtures/fake-executable-inspector.ts tests/unit/fallow-analysis-service.test.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add src/application/analysis/fallow-analysis-service.ts tests/fixtures/fake-executable-inspector.ts tests/unit/fallow-analysis-service.test.ts
git commit -m "feat(application): the fallow analysis service: review, remembered trust and the pre-run checks (Z7, Z8, Z10, Z11, Z22, Z36)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Run the covering tests.**

Run: `npx vitest run tests/unit/fallow-analysis-service.test.ts tests/unit/analysis-coordinator.test.ts tests/unit/analyzer-binding-store.test.ts tests/unit/analyzer-trust.test.ts`
Expected: PASS.

---

### Task 6: The executable inspector (Z4, Z5)

It stats the executable, resolves its real path and reads its first 4 bytes. It never executes it, and it touches no `child_process`.

**Files:**
- Create: `src/adapters/fallow/executable-inspector.ts` (~110)
- Modify: `src/adapters/filesystem/node-globals.d.ts` (61 → 71): `NodeFsPromisesLike` (lines 41–46) and a new `NodeFileHandleLike`
- Test: `tests/unit/executable-inspector.test.ts` (new, ~170)

**Interfaces:**
- Consumes: Task 1's `ExecutableFormat`, `ExecutableInspection`, `ExecutableInspectorPort`, `ExecutableRefusal`; `fsPromises` (`src/adapters/filesystem/node-access.ts`, injectable per M17); `NodeFsPromisesLike`, `NodeStatsLike` (`node-globals.d.ts`); `isContained`, `normalizeAbsolutePath` (`src/domain/path-safety.ts`); `Platform` (`obsidian`: `isWin`, `isMacOS`); tests: `makeTempTree`, `TempTree` (`tests/fixtures/temp-tree.ts`), real `node:fs/promises`.
- Produces:
  - `interface ExecutableInspectorDeps { fsPromises?: NodeFsPromisesLike | null; platform?: string }`
  - `createExecutableInspector(deps?: ExecutableInspectorDeps): ExecutableInspectorPort`
  - `NodeFsPromisesLike` gains `realpath(path: string): Promise<string>` and `open(path: string, flags: 'r'): Promise<NodeFileHandleLike>`; `interface NodeFileHandleLike { read(buffer: Uint8Array, offset: number, length: number, position: number): Promise<{ bytesRead: number }>; close(): Promise<void> }`

- [ ] **Step 1: Write the failing test.**

Create `tests/unit/executable-inspector.test.ts`:

```ts
// Part 7 Z4/Z5 and G6's "Windows launchers": only a regular file named fallow.exe (Windows)
// or fallow (elsewhere) whose first bytes are this platform's native format is accepted.
// npm launchers and scripts are refused by name or by their `#!`. Real temporary files,
// through the real node:fs/promises (M17). Nothing is ever executed.
import * as fsPromises from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createExecutableInspector } from '../../src/adapters/fallow/executable-inspector';
import type { NodeFsPromisesLike } from '../../src/adapters/filesystem/node-globals';
import { makeTempTree, type TempTree, type TempTreeSpec } from '../fixtures/temp-tree';

const fs = fsPromises as unknown as NodeFsPromisesLike;
const PE = { binary: Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]) };
const ELF = { binary: Uint8Array.from([0x7f, 0x45, 0x4c, 0x46]) };
const MACH_O = { binary: Uint8Array.from([0xcf, 0xfa, 0xed, 0xfe]) };
const SCRIPT = '#!/usr/bin/env node\nrequire("../lib/fallow.js");\n';
const windows = createExecutableInspector({ fsPromises: fs, platform: 'win32' });
const linux = createExecutableInspector({ fsPromises: fs, platform: 'linux' });
const mac = createExecutableInspector({ fsPromises: fs, platform: 'darwin' });

const trees: TempTree[] = [];
async function tree(spec: TempTreeSpec): Promise<TempTree> {
  const t = await makeTempTree(spec);
  trees.push(t);
  return t;
}
afterEach(async () => {
  for (const t of trees.splice(0)) await t.cleanup();
});

describe('accepts a native binary (Z4)', () => {
  it('on each platform, with its facts', async () => {
    const t = await tree({ 'win/fallow.exe': PE, 'linux/fallow': ELF, 'mac/fallow': MACH_O });
    const exe = join(t.root, 'win', 'fallow.exe');
    const result = await windows.inspect(exe, join(t.root, 'repo'));
    expect(result).toEqual({
      ok: true,
      facts: {
        executablePath: exe, realPath: await fsPromises.realpath(exe), size: 4,
        mtimeMs: (await fsPromises.stat(exe)).mtimeMs, format: 'pe', insideRoot: false,
      },
    });
    expect(await linux.inspect(join(t.root, 'linux', 'fallow'), t.root)).toMatchObject({ ok: true, facts: { format: 'elf' } });
    expect(await mac.inspect(join(t.root, 'mac', 'fallow'), t.root)).toMatchObject({ ok: true, facts: { format: 'mach-o' } });
  });

  it('Review Focus 2: under a folder whose name has a space and a non-ASCII letter, the path is kept exactly', async () => {
    const t = await tree({ 'Program Files/J\u00f6rg tools/fallow.exe': PE });
    const exe = join(t.root, 'Program Files', 'J\u00f6rg tools', 'fallow.exe');
    expect(await windows.inspect(`  ${exe}  `, t.root)).toMatchObject({ ok: true, facts: { executablePath: exe } });
  });

  it('names the platform\'s only accepted base name', () => {
    expect(windows.executableName).toBe('fallow.exe');
    expect(linux.executableName).toBe('fallow');
  });
});

describe('refuses everything else (Z4, G6 Windows launchers)', () => {
  it('a relative path', async () => {
    expect(await windows.inspect('fallow.exe', '/repo')).toEqual({ ok: false, refusal: 'not-absolute', detail: '' });
  });

  it('npm launchers by name, before touching the disk', async () => {
    for (const name of ['fallow.cmd', 'fallow.bat', 'fallow.ps1', 'fallow.js', 'fallow.mjs', 'fallow.cjs', 'FALLOW.CMD']) {
      expect(await windows.inspect(`C:\\nowhere\\${name}`, 'C:\\repo'), name).toEqual({ ok: false, refusal: 'launcher', detail: 'fallow.exe' });
    }
    expect(await linux.inspect('/nowhere/fallow.sh', '/repo')).toEqual({ ok: false, refusal: 'launcher', detail: 'fallow' });
  });

  it('any other name; case matters outside Windows only', async () => {
    expect(await windows.inspect('C:\\tools\\node.exe', 'C:\\repo')).toEqual({ ok: false, refusal: 'wrong-name', detail: 'fallow.exe' });
    expect(await windows.inspect('C:\\tools\\fallow', 'C:\\repo')).toEqual({ ok: false, refusal: 'wrong-name', detail: 'fallow.exe' });
    expect(await linux.inspect('/tools/Fallow', '/repo')).toEqual({ ok: false, refusal: 'wrong-name', detail: 'fallow' });
    expect(await windows.inspect('C:\\nowhere\\FALLOW.EXE', 'C:\\repo')).toEqual({ ok: false, refusal: 'executable-missing', detail: '' });
  });

  it('a script behind the right name (npm\'s POSIX bin link to a JS launcher)', async () => {
    const t = await tree({ 'bin/fallow': SCRIPT });
    expect(await linux.inspect(join(t.root, 'bin', 'fallow'), t.root)).toEqual({ ok: false, refusal: 'launcher', detail: 'fallow' });
  });

  it('another platform\'s binary, or no binary at all', async () => {
    const t = await tree({ 'a/fallow.exe': ELF, 'b/fallow': PE, 'c/fallow': 'plain text' });
    expect(await windows.inspect(join(t.root, 'a', 'fallow.exe'), t.root)).toEqual({ ok: false, refusal: 'not-native', detail: '' });
    expect(await linux.inspect(join(t.root, 'b', 'fallow'), t.root)).toEqual({ ok: false, refusal: 'not-native', detail: '' });
    expect(await linux.inspect(join(t.root, 'c', 'fallow'), t.root)).toEqual({ ok: false, refusal: 'not-native', detail: '' });
  });

  it('a missing file, a folder, an unreadable file, and no Node at all', async () => {
    const t = await tree({ 'fallow.exe/inner.txt': 'x' });
    expect(await windows.inspect(join(t.root, 'missing', 'fallow.exe'), t.root)).toEqual({ ok: false, refusal: 'executable-missing', detail: '' });
    expect(await windows.inspect(join(t.root, 'fallow.exe'), t.root)).toEqual({ ok: false, refusal: 'not-a-file', detail: '' });
    const denied = createExecutableInspector({
      platform: 'win32',
      fsPromises: { ...fs, stat: () => Promise.reject(Object.assign(new Error('denied'), { code: 'EACCES' })) } as NodeFsPromisesLike,
    });
    expect(await denied.inspect('C:\\tools\\fallow.exe', 'C:\\repo')).toEqual({ ok: false, refusal: 'unreadable', detail: 'EACCES' });
    const noNode = createExecutableInspector({ fsPromises: null, platform: 'win32' });
    expect(await noNode.inspect('C:\\tools\\fallow.exe', 'C:\\repo')).toEqual({ ok: false, refusal: 'unreadable', detail: 'UNAVAILABLE' });
  });
});

describe('an executable inside the codebase (Z5)', () => {
  it('is flagged by its path', async () => {
    const t = await tree({ 'repo/tools/fallow.exe': PE, 'elsewhere/fallow.exe': PE });
    const root = join(t.root, 'repo');
    expect(await windows.inspect(join(root, 'tools', 'fallow.exe'), root)).toMatchObject({ ok: true, facts: { insideRoot: true } });
    expect(await windows.inspect(join(t.root, 'elsewhere', 'fallow.exe'), root)).toMatchObject({ ok: true, facts: { insideRoot: false } });
  });

  it('Review Focus 3 (K22): is flagged when the root is reached through a symlink or junction', async () => {
    const t = await tree({ 'real/tools/fallow.exe': PE, link: { symlinkTo: 'real' } });
    const result = await windows.inspect(join(t.root, 'real', 'tools', 'fallow.exe'), join(t.root, 'link'));
    expect(result).toMatchObject({ ok: true, facts: { insideRoot: true } });
  });
});
```

- [ ] **Step 2: Run it and watch it fail.**

Run: `npx vitest run tests/unit/executable-inspector.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/adapters/fallow/executable-inspector"`.

- [ ] **Step 3: Implement.**

In `src/adapters/filesystem/node-globals.d.ts`, replace:

```ts
export interface NodeFsPromisesLike {
  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<NodeDirentLike[]>;
  lstat(path: string): Promise<NodeStatsLike>;
  stat(path: string): Promise<NodeStatsLike>;
  readFile(path: string): Promise<Uint8Array>;
}
```

with:

```ts
/** Part 7 Z4: enough of fs.promises' FileHandle to read an executable's first bytes. */
export interface NodeFileHandleLike {
  read(buffer: Uint8Array, offset: number, length: number, position: number): Promise<{ bytesRead: number }>;
  close(): Promise<void>;
}

export interface NodeFsPromisesLike {
  readdir(path: string): Promise<string[]>;
  readdir(path: string, options: { withFileTypes: true }): Promise<NodeDirentLike[]>;
  lstat(path: string): Promise<NodeStatsLike>;
  stat(path: string): Promise<NodeStatsLike>;
  readFile(path: string): Promise<Uint8Array>;
  /** Part 7 Z4/Z5: the executable's and the root's real paths. */
  realpath(path: string): Promise<string>;
  /** Part 7 Z4: opened read-only for the 4-byte native-format check, then closed. */
  open(path: string, flags: 'r'): Promise<NodeFileHandleLike>;
}
```

Create `src/adapters/fallow/executable-inspector.ts`:

```ts
// Part 7 Z4/Z5: what the executable IS, before anything runs. A stat, a real path and its
// first 4 bytes — it is never executed, and this file touches no child_process. Checks run
// in order and the first failure wins: absolute path, base name (launchers by extension),
// exists, regular file, real path, native format (a `#!` script is a launcher). Fs deps
// are injectable (M17), defaulting to node-access.ts; tests pass node:fs/promises.
import { Platform } from 'obsidian';
import { fsPromises as defaultFsPromises } from '../filesystem/node-access';
import type { NodeFsPromisesLike, NodeStatsLike } from '../filesystem/node-globals';
import { isContained, normalizeAbsolutePath } from '../../domain/path-safety';
import type {
  ExecutableFormat, ExecutableInspection, ExecutableInspectorPort, ExecutableRefusal,
} from '../../application/ports/executable-inspector';

export interface ExecutableInspectorDeps {
  /** null: not the desktop app, so nothing can be inspected. */
  fsPromises?: NodeFsPromisesLike | null;
  /** Node's platform name; defaults to Obsidian's Platform flags. */
  platform?: string;
}

const LAUNCHER_EXTENSIONS: readonly string[] = ['.cmd', '.bat', '.ps1', '.js', '.mjs', '.cjs', '.sh', '.vbs'];
const MACH_O: readonly string[] = ['feedface', 'feedfacf', 'cefaedfe', 'cffaedfe', 'cafebabe'];

function hostPlatform(): string {
  if (Platform.isWin) return 'win32';
  return Platform.isMacOS ? 'darwin' : 'linux';
}

const refuse = (refusal: ExecutableRefusal, detail = ''): ExecutableInspection => ({ ok: false, refusal, detail });

function baseNameOf(path: string): string {
  const posix = path.replace(/\\/g, '/');
  return posix.slice(posix.lastIndexOf('/') + 1);
}

function codeOf(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = (e as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'UNKNOWN';
}

/** Z4: fallow.exe on Windows (any case), fallow elsewhere (exact). `fallow` plus a launcher
 *  extension is refused as a launcher, with its own message; anything else is a wrong name. */
function nameRefusal(name: string, platform: string): ExecutableInspection | null {
  const expected = platform === 'win32' ? 'fallow.exe' : 'fallow';
  if (platform === 'win32' ? name.toLowerCase() === expected : name === expected) return null;
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf('.');
  const stem = dot < 0 ? lower : lower.slice(0, dot);
  const extension = dot < 0 ? '' : lower.slice(dot);
  return refuse(stem === 'fallow' && LAUNCHER_EXTENSIONS.includes(extension) ? 'launcher' : 'wrong-name', expected);
}

function formatOf(head: Uint8Array, platform: string): ExecutableFormat | 'script' | null {
  if (head[0] === 0x23 && head[1] === 0x21) return 'script';
  const hex = Array.from(head, (b) => b.toString(16).padStart(2, '0')).join('');
  if (platform === 'win32') return hex.startsWith('4d5a') ? 'pe' : null;
  if (platform === 'darwin') return MACH_O.includes(hex) ? 'mach-o' : null;
  return hex === '7f454c46' ? 'elf' : null;
}

async function readHead(fs: NodeFsPromisesLike, path: string): Promise<Uint8Array> {
  const handle = await fs.open(path, 'r');
  try {
    const buffer = new Uint8Array(4);
    const { bytesRead } = await handle.read(buffer, 0, 4, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export function createExecutableInspector(deps: ExecutableInspectorDeps = {}): ExecutableInspectorPort {
  const fs = deps.fsPromises === undefined ? defaultFsPromises : deps.fsPromises;
  const platform = deps.platform ?? hostPlatform();
  // M20: the platform's own case rule for containment.
  const caseSensitive = platform !== 'win32' && platform !== 'darwin';
  const inside = (root: string, candidate: string): boolean => isContained(root, candidate, { caseSensitive });
  return {
    executableName: platform === 'win32' ? 'fallow.exe' : 'fallow',
    async inspect(executablePath, rootPath) {
      let path: string;
      try {
        path = normalizeAbsolutePath(executablePath.trim());
      } catch {
        return refuse('not-absolute');
      }
      const named = nameRefusal(baseNameOf(path), platform);
      if (named !== null) return named;
      if (fs === null) return refuse('unreadable', 'UNAVAILABLE');
      let stat: NodeStatsLike;
      try {
        stat = await fs.stat(path);
      } catch (e) {
        const code = codeOf(e);
        return code === 'ENOENT' ? refuse('executable-missing') : refuse('unreadable', code);
      }
      if (!stat.isFile()) return refuse('not-a-file');
      let realPath: string;
      let head: Uint8Array;
      try {
        realPath = await fs.realpath(path);
        head = await readHead(fs, realPath);
      } catch (e) {
        return refuse('unreadable', codeOf(e));
      }
      const format = formatOf(head, platform);
      if (format === 'script') return refuse('launcher', platform === 'win32' ? 'fallow.exe' : 'fallow');
      if (format === null) return refuse('not-native');
      // K22 (Review Focus 3): the root's real path too, so a root reached through a
      // symlink or junction still flags a binary inside its target.
      const realRoot = await fs.realpath(rootPath).catch(() => rootPath);
      const insideRoot = inside(rootPath, path) || inside(rootPath, realPath) || inside(realRoot, realPath);
      return { ok: true, facts: { executablePath: path, realPath, size: stat.size, mtimeMs: stat.mtimeMs, format, insideRoot } };
    },
  };
}
```

- [ ] **Step 4: Run it and watch it pass.**

Run: `npx vitest run tests/unit/executable-inspector.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/adapters/fallow/executable-inspector.ts src/adapters/filesystem/node-globals.d.ts tests/unit/executable-inspector.test.ts --max-warnings 0`
Expected: exit 0. (`tests/contracts/node-filesystem.test.ts` still passes `node:fs/promises` without a cast: the two new members are structurally satisfied.)

- [ ] **Step 6: Commit.**

```
git add src/adapters/fallow/executable-inspector.ts src/adapters/filesystem/node-globals.d.ts tests/unit/executable-inspector.test.ts
git commit -m "feat(adapters): fallow executable inspector: name, native header, real path, inside-root (Z4, Z5)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Run the covering tests.**

Run: `npx vitest run tests/unit/executable-inspector.test.ts tests/contracts/node-filesystem.test.ts tests/unit/no-process-execution.test.ts tests/unit/node-access-boundary.test.ts tests/unit/path-safety.test.ts`
Expected: PASS.

---

### Task 7: The process runner, the Node boundary and the deliberate guard amendment (Z14–Z18, Z37, Z38 runner)

This is the only task that adds process code to `src/`. The guard is amended **in the same commit** as the two files it allow-lists.

**Files:**
- Create: `src/adapters/fallow/node-process-access.ts` (~60)
- Create: `src/adapters/fallow/process-output.ts` (~95)
- Create: `src/adapters/fallow/fallow-runner.ts` (~150)
- Modify: `src/adapters/filesystem/node-access.ts` (15): line 1 (comment only; M17 forbids restructuring its code)
- Modify: `tests/fixtures/process-guard.ts` (206 → ~250): whole file below
- Modify: `tests/unit/no-process-execution.test.ts` (149 → ~215): whole file below
- Modify: `tests/unit/node-access-boundary.test.ts` (152 → 153): lines 104–108
- Create: `tests/fixtures/fake-child-process.ts` (~75), `tests/fixtures/real-spawn.ts` (~10)
- Create: `tests/fixtures/fallow-runner/fake-fallow.mjs` (~70), `tests/fixtures/fallow-runner/README.md` (~45)
- Test: `tests/unit/process-output.test.ts` (new, ~110), `tests/unit/fallow-runner.test.ts` (new, ~230), `tests/contracts/fallow-runner.test.ts` (new, ~200)

**Interfaces:**
- Consumes: Task 1 (`AnalyzerProcessPort`, `ProcessRequest`, `ProcessOutcome`, `FALLOW_ENV_ALLOW_LIST`, `FALLOW_ENV_EXTRA`, `FALLOW_KILL_GRACE_MS`, `FALLOW_CLOSE_GRACE_MS`, `FALLOW_RUN_ARGS`, `classifyFallowExit`); `CancellationToken`; `Platform` (`obsidian`); tests: `createCancellationToken` (`tests/fixtures/cancellation-token.ts`), `fallowText`, real `node:child_process` (tests only).
- Produces:
  - `node-process-access.ts`: `interface ReadableLike { on(event: 'data', listener: (chunk: Uint8Array) => void): unknown; destroy(): unknown }`; `interface ChildProcessLike { readonly pid?: number | undefined; readonly stdout: ReadableLike | null; readonly stderr: ReadableLike | null; on(event: 'error', listener: (error: Error & { code?: string }) => void): unknown; on(event: 'exit' | 'close', listener: (code: number | null, signal: string | null) => void): unknown; kill(signal?: string): boolean }`; `interface SpawnOptionsLike { cwd: string; env: Record<string, string>; shell: false; windowsHide: true; detached: boolean; stdio: ['ignore', 'pipe', 'pipe'] }`; `type SpawnLike = (command: string, args: readonly string[], options: SpawnOptionsLike) => ChildProcessLike`; `interface NodeProcessLike { env: Record<string, string | undefined>; platform: string; kill(pid: number, signal: string): void }`; `childProcess: { spawn: SpawnLike } | null`; `nodeProcess: NodeProcessLike | null`
  - `process-output.ts`: `createStdoutCollector(maxBytes): { push(chunk: Uint8Array): boolean; readonly bytes: number; readonly overflowed: boolean; text(): string | null }`; `createStderrTail(maxBytes): { push(chunk: Uint8Array): void; excerpt(): string }`; `cleanLog(text: string): string`; `buildChildEnv(source, platform, allow, extra): Record<string, string>`
  - `fallow-runner.ts`: `interface FallowRunnerDeps { spawn?: SpawnLike | null; env?: Readonly<Record<string, string | undefined>>; platform?: string; killProcess?: (pid: number, signal: string) => void; setTimer?: (fn: () => void, ms: number) => unknown; clearTimer?: (handle: unknown) => void }`; `createFallowRunner(deps?: FallowRunnerDeps): AnalyzerProcessPort`
  - guard: `type ProcessHazard = 'process module' | 'spawn call' | 'process call' | 'shell option' | 'shell.openPath'`; `injectStatement(source, kind, statement): string`; `PROCESS_ALLOWED` (in the test)
  - tests: `FakeChildProcess`, `fakeSpawn(pid?)`, `realSpawn: SpawnLike`

- [ ] **Step 1: Write the failing tests, the fixtures and the amended guard.**

Create `tests/fixtures/fallow-runner/fake-fallow.mjs`:

```js
// Part 7 Z38: a stand-in for fallow, run as `node fake-fallow.mjs --mode=<mode> [fallow args…]`.
// The mode is an ARGUMENT because the runner filters the environment (Z16). The report it
// prints is the committed fallow 3.27.0 recording. Test-only: nothing under src/ runs it.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = (process.argv[2] ?? '').replace(/^--mode=/, '');
const fixture = () => readFileSync(fileURLToPath(new URL('../fallow/combined-3.27.0.json', import.meta.url)));
const hang = () => { setInterval(() => {}, 1_000); };
const exitAfter = (text, code) => { process.stdout.write(text, () => process.exit(code)); };

function writeBlocks(block, count, done) {
  let written = 0;
  const next = () => {
    while (written < count) {
      written += 1;
      if (!process.stdout.write(block)) { process.stdout.once('drain', next); return; }
    }
    done();
  };
  next();
}

switch (mode) {
  case 'version': process.stdout.write('fallow 3.27.0\n'); break;
  case 'version-4': process.stdout.write('fallow 4.0.0\n'); break;
  case 'version-untested': process.stdout.write('fallow 3.28.0\n'); break;
  case 'ok': process.stdout.write(fixture()); break;
  case 'findings-exit-1': exitAfter(fixture(), 1); break;
  case 'error-exit-2': exitAfter(JSON.stringify({ error: true, message: "invalid root path '/nope': No such file or directory (os error 2)", exit_code: 2 }), 2); break;
  case 'garbage': process.stdout.write('this is not json'); break;
  case 'truncated': { const text = fixture(); process.stdout.write(text.subarray(0, Math.floor(text.length / 2))); break; }
  case 'huge': writeBlocks(Buffer.alloc(1024 * 1024, 0x20), 17, () => {}); break;
  case 'streamed': process.stdout.write(fixture(), () => writeBlocks(Buffer.alloc(64 * 1024, 0x20), 192, () => {})); break;
  case 'stderr-flood': process.stderr.write(Buffer.alloc(1024 * 1024, 0x61)); process.stderr.write('\nlast line\n'); process.stdout.write(fixture()); break;
  case 'hang': hang(); break;
  case 'trickle': setInterval(() => { process.stdout.write(' '); }, 50); break;
  case 'env-dump': process.stdout.write(JSON.stringify(Object.keys(process.env).sort())); break;
  case 'cwd': process.stdout.write(process.cwd()); break;
  case 'argv': process.stdout.write(JSON.stringify(process.argv.slice(3))); break;
  case 'grandchild': {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    writeFileSync(join(process.cwd(), 'grandchild.pid'), String(child.pid));
    hang();
    break;
  }
  case 'html-stderr': process.stderr.write('<img src=x onerror=alert(1)>\n', () => process.exit(3)); break;
  default: process.stderr.write(`fake-fallow: unknown mode "${mode}"\n`, () => process.exit(9));
}
```

Create `tests/fixtures/fallow-runner/README.md`:

```markdown
# fake-fallow and the real-CLI facts it stands in for

`fake-fallow.mjs` is run by `tests/contracts/fallow-runner.test.ts` and
`tests/integration/fallow-analysis.test.ts` as `node fake-fallow.mjs --mode=<mode> …`. The
mode is an argument because the runner passes on only an allow-listed environment (Part 7
Z16). `ok`, `findings-exit-1`, `truncated`, `streamed` and `stderr-flood` print
`../fallow/combined-3.27.0.json`, the committed fallow 3.27.0 recording.

Modes: `version`, `version-4`, `version-untested`, `ok`, `findings-exit-1`, `error-exit-2`,
`garbage`, `truncated`, `huge` (17 MB), `streamed` (the report plus 12 MB of trailing
whitespace, in 64 KB writes), `stderr-flood` (1 MB of stderr), `hang`, `trickle` (a space
every 50 ms, forever), `env-dump`, `cwd`, `argv`, `grandchild` (writes `grandchild.pid` in
its cwd, then hangs), `html-stderr` (markup on stderr, exit 3).

## What the real fallow 3.27.0 did (probed 2026-09-23, native `fallow.exe`, Windows)

On a temporary copy of `../fallow/project`:

| Invocation | Observed |
|---|---|
| `fallow --version` | stdout `fallow 3.27.0`, exit 0 |
| `--format json --no-cache --quiet --root <p>` | exit 0 with findings; 13,185 bytes of stdout, 0 of stderr; no file created or changed under the root |
| a root that does not exist | exit 2; stdout `{"error":true,"message":"invalid root path '…': … (os error 2)","exit_code":2}`; stderr empty |
| the same without `--no-cache` | writes `<root>/.fallow/.gitignore`, `.fallow/cache.bin`, `.fallow/graph-cache.bin` |
| `--fail-on-issues` | exit 1 when issues exist (never passed by the plugin) |

`FALLOW_*` variables change fallow's behaviour, so the runner never passes them. Config files
in the root (`.fallowrc.json` and others) are honoured; a remote `extends` needs
`--allow-remote-extends`, which is never passed. `npm run test:fallow` re-checks these
against the pinned binary (`tests/fallow-real/fallow-real.test.ts`).
```

Create `tests/fixtures/real-spawn.ts`:

```ts
// Part 7 Z38: node:child_process's own spawn, typed as the runner's structural SpawnLike.
// Tests only: nothing under src/ may name child_process except node-process-access.ts.
import { spawn } from 'node:child_process';
import type { ChildProcessLike, SpawnLike } from '../../src/adapters/fallow/node-process-access';

export const realSpawn: SpawnLike = (command, args, options) =>
  spawn(command, [...args], options) as unknown as ChildProcessLike;
```

Create `tests/fixtures/fake-child-process.ts`:

```ts
// Part 7 Z38: a scriptable child process for the runner's unit tests. A test drives the
// streams and the exit/close/error events by hand, and reads back every kill() call.
import type { ChildProcessLike, ReadableLike, SpawnLike, SpawnOptionsLike } from '../../src/adapters/fallow/node-process-access';

export class FakeStream implements ReadableLike {
  destroyed = false;
  private readonly listeners: ((chunk: Uint8Array) => void)[] = [];

  on(_event: 'data', listener: (chunk: Uint8Array) => void): this {
    this.listeners.push(listener);
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
}

type Listener = (...args: never[]) => void;

export class FakeChildProcess implements ChildProcessLike {
  readonly stdout = new FakeStream();
  readonly stderr = new FakeStream();
  readonly kills: (string | undefined)[] = [];
  private readonly handlers: Record<'error' | 'exit' | 'close', Listener[]> = { error: [], exit: [], close: [] };

  constructor(readonly pid: number | undefined = 4242) {}

  on(event: 'error' | 'exit' | 'close', listener: Listener): this {
    this.handlers[event].push(listener);
    return this;
  }

  kill(signal?: string): boolean {
    this.kills.push(signal);
    return true;
  }

  emitError(code: string): void {
    for (const l of this.handlers.error) (l as (e: Error & { code?: string }) => void)(Object.assign(new Error(code), { code }));
  }

  exit(code: number | null, signal: string | null = null): void {
    for (const l of this.handlers.exit) (l as (c: number | null, s: string | null) => void)(code, signal);
  }

  close(code: number | null, signal: string | null = null): void {
    for (const l of this.handlers.close) (l as (c: number | null, s: string | null) => void)(code, signal);
  }
}

export interface SpawnCall { command: string; args: readonly string[]; options: SpawnOptionsLike }

export function fakeSpawn(pid: number | undefined = 4242): { spawn: SpawnLike; calls: SpawnCall[]; children: FakeChildProcess[] } {
  const calls: SpawnCall[] = [];
  const children: FakeChildProcess[] = [];
  const spawn: SpawnLike = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new FakeChildProcess(pid);
    children.push(child);
    return child;
  };
  return { spawn, calls, children };
}
```

Create `tests/unit/process-output.test.ts`:

```ts
// Part 7 Z16/Z17: the runner's pure helpers. stdout is kept whole up to the cap and decoded
// ONCE, so a character split across chunks survives (Review Focus 1); stderr keeps only
// its tail; the child's environment is built, never inherited.
import { describe, expect, it } from 'vitest';
import { buildChildEnv, cleanLog, createStderrTail, createStdoutCollector } from '../../src/adapters/fallow/process-output';
import { FALLOW_ENV_ALLOW_LIST, FALLOW_ENV_EXTRA } from '../../src/application/analysis/fallow-invocation';

const bytes = (...values: number[]): Uint8Array => Uint8Array.from(values);
const text = (s: string): Uint8Array => new TextEncoder().encode(s);

describe('createStdoutCollector (Z17)', () => {
  it('keeps chunks up to the cap and decodes them once', () => {
    const c = createStdoutCollector(10);
    expect(c.push(text('{"a":'))).toBe(true);
    expect(c.push(text('1}'))).toBe(true);
    expect([c.bytes, c.overflowed, c.text()]).toEqual([7, false, '{"a":1}']);
  });

  it('accepts exactly the cap, refuses one byte more, and keeps nothing of the refused chunk', () => {
    const c = createStdoutCollector(4);
    expect(c.push(text('abcd'))).toBe(true);
    expect(c.push(text('e'))).toBe(false);
    expect([c.bytes, c.overflowed, c.text()]).toEqual([4, true, 'abcd']);
    expect(c.push(text('f'))).toBe(false);
  });

  it('Review Focus 1: decodes a character split across two chunks', () => {
    const c = createStdoutCollector(100);
    c.push(bytes(0x22, 0xc3));
    c.push(bytes(0xa9, 0x22));
    expect(c.text()).toBe('"\u00e9"');
  });

  it('Review Focus 1: the same split, landing exactly on the cap', () => {
    const c = createStdoutCollector(4);
    expect(c.push(bytes(0x22, 0xc3))).toBe(true);
    expect(c.push(bytes(0xa9, 0x22))).toBe(true);
    expect(c.text()).toBe('"\u00e9"');
  });

  it('returns null for bytes that are not UTF-8', () => {
    const c = createStdoutCollector(10);
    c.push(bytes(0xff, 0xfe));
    expect(c.text()).toBeNull();
  });
});

describe('createStderrTail (Z17)', () => {
  it('keeps only the last N bytes, across chunk boundaries', () => {
    const t = createStderrTail(5);
    t.push(text('abc'));
    t.push(text('defg'));
    expect(t.excerpt()).toBe('cdefg');
  });

  it('decodes a tail that starts mid-character without throwing', () => {
    const t = createStderrTail(3);
    t.push(bytes(0x61, 0xc3, 0xa9));
    t.push(text('bc'));
    expect(t.excerpt()).toBe('\ufffdbc');
  });
});

describe('cleanLog (Z17)', () => {
  it('drops ANSI escapes and control characters, keeping tabs and newlines', () => {
    expect(cleanLog('\u001b[31mred\u001b[0m\r\n\ttab\u0000\u0007end')).toBe('red\n\ttabend');
  });
});

describe('buildChildEnv (Z16)', () => {
  it('on Windows, finds each allowed name in any case, writes it in the list\'s spelling, and adds NO_COLOR', () => {
    const env = buildChildEnv({
      Path: 'C:\\bin', SystemRoot: 'C:\\Windows', TEMP: 'C:\\t', FALLOW_PRODUCTION: '1', NODE_OPTIONS: '--inspect', HTTP_PROXY: 'http://x',
    }, 'win32', FALLOW_ENV_ALLOW_LIST, FALLOW_ENV_EXTRA);
    expect(env).toEqual({ PATH: 'C:\\bin', SystemRoot: 'C:\\Windows', TEMP: 'C:\\t', NO_COLOR: '1' });
  });

  it('elsewhere, matches names exactly and skips empty values', () => {
    const env = buildChildEnv({ PATH: '/usr/bin', path: '/nope', HOME: '/home/a', TMPDIR: '/tmp', TMP: '' }, 'linux', FALLOW_ENV_ALLOW_LIST, FALLOW_ENV_EXTRA);
    expect(env).toEqual({ PATH: '/usr/bin', HOME: '/home/a', TMPDIR: '/tmp', NO_COLOR: '1' });
  });

  it('drops FALLOW_* and NODE_OPTIONS even when a list admits them', () => {
    const env = buildChildEnv({ FALLOW_COVERAGE: '1', NODE_OPTIONS: '--x', PATH: '/bin' }, 'linux', ['FALLOW_COVERAGE', 'NODE_OPTIONS', 'PATH'], {});
    expect(env).toEqual({ PATH: '/bin' });
  });
});
```

Create `tests/unit/fallow-runner.test.ts`:

```ts
// Part 7 Z15/Z17/Z18 over a scripted child process and fake timers: the exact spawn call,
// the built environment, the caps, the absolute timeout (Review Focus 5), cancel, the kill
// escalation per platform, the close grace, killAll and every spawn failure.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFallowRunner } from '../../src/adapters/fallow/fallow-runner';
import type { ProcessRequest } from '../../src/application/ports/analyzer-process';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { fakeSpawn } from '../fixtures/fake-child-process';

const REQUEST: ProcessRequest = {
  executablePath: '/opt/fallow/bin/fallow', args: ['--format', 'json', '--no-cache', '--quiet', '--root', '/repo'],
  cwd: '/repo', timeoutMs: 120_000, maxStdoutBytes: 1_000_000, maxStderrBytes: 8,
};

function setup(platform = 'linux', env: Record<string, string> = { PATH: '/usr/bin' }) {
  const spawned = fakeSpawn();
  const kills: [number, string][] = [];
  const runner = createFallowRunner({ spawn: spawned.spawn, env, platform, killProcess: (pid, signal) => { kills.push([pid, signal]); } });
  const { token, cancel } = createCancellationToken();
  return { runner, spawned, kills, token, cancel, child: () => spawned.children[0]! };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('the spawn call (Z15, Z16)', () => {
  it('spawns once, exactly as specified, with the built environment', () => {
    const s = setup('linux', { PATH: '/usr/bin', HOME: '/home/a', FALLOW_PRODUCTION: '1', NODE_OPTIONS: '--inspect' });
    void s.runner.run(REQUEST, s.token);
    expect(s.spawned.calls).toEqual([{
      command: REQUEST.executablePath, args: REQUEST.args,
      options: { cwd: '/repo', env: { PATH: '/usr/bin', HOME: '/home/a', NO_COLOR: '1' }, shell: false, windowsHide: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
    }]);
  });

  it('is not detached on Windows', () => {
    const s = setup('win32', { Path: 'C:\\bin' });
    void s.runner.run(REQUEST, s.token);
    expect(s.spawned.calls[0]?.options).toMatchObject({ detached: false, env: { PATH: 'C:\\bin', NO_COLOR: '1' } });
  });
});

describe('a finished process (Z17)', () => {
  it('resolves on close with the whole stdout and the stderr tail', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.child().stdout.emit('{"a":');
    s.child().stdout.emit('1}');
    s.child().stderr.emit('0123456789');
    s.child().exit(0);
    s.child().close(0);
    await expect(done).resolves.toEqual({ kind: 'exited', exitCode: 0, stdout: '{"a":1}', stdoutBytes: 7, stderrTail: '23456789' });
  });

  it('reports a signal it did not send', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.child().exit(null, 'SIGSEGV');
    s.child().close(null, 'SIGSEGV');
    await expect(done).resolves.toEqual({ kind: 'signalled', signal: 'SIGSEGV', stderrTail: '' });
  });

  it('gives up on pipes that never close 2 s after exit, and destroys them', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.child().exit(0);
    vi.advanceTimersByTime(2_000);
    await expect(done).resolves.toEqual({ kind: 'output-incomplete', stderrTail: '' });
    expect([s.child().stdout.destroyed, s.child().stderr.destroyed]).toEqual([true, true]);
  });
});

describe('stopping a process (Z17, Z18)', () => {
  it('kills the group at the stdout cap and never parses what it kept', async () => {
    const s = setup();
    const done = s.runner.run({ ...REQUEST, maxStdoutBytes: 16 }, s.token);
    s.child().stdout.emit('x'.repeat(10));
    s.child().stdout.emit('y'.repeat(10));
    expect(s.kills).toEqual([[-4242, 'SIGTERM']]);
    s.child().exit(null, 'SIGTERM');
    await expect(done).resolves.toEqual({ kind: 'stdout-too-large', stderrTail: '' });
  });

  it('Review Focus 5: the time limit is absolute: output every second does not postpone it', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    for (let second = 1; second < 120; second += 1) {
      vi.advanceTimersByTime(1_000);
      s.child().stdout.emit(' ');
    }
    expect(s.kills).toEqual([]);
    vi.advanceTimersByTime(1_000);
    expect(s.kills).toEqual([[-4242, 'SIGTERM']]);
    s.child().exit(null, 'SIGTERM');
    await expect(done).resolves.toEqual({ kind: 'timed-out', stderrTail: '' });
  });

  it('cancel sends SIGTERM to the group, then SIGKILL after 2 s, and resolves only at exit', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    let settled = false;
    void done.then(() => { settled = true; });
    s.cancel();
    expect(s.kills).toEqual([[-4242, 'SIGTERM']]);
    vi.advanceTimersByTime(2_000);
    expect(s.kills).toEqual([[-4242, 'SIGTERM'], [-4242, 'SIGKILL']]);
    await Promise.resolve();
    expect(settled).toBe(false);
    s.child().exit(null, 'SIGKILL');
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
  });

  it('on Windows kills the direct child only, spawning nothing else (no taskkill)', async () => {
    const s = setup('win32');
    const done = s.runner.run(REQUEST, s.token);
    s.cancel();
    vi.advanceTimersByTime(2_000);
    expect(s.child().kills).toEqual([undefined, undefined]);
    expect(s.kills).toEqual([]);
    expect(s.spawned.calls).toHaveLength(1);
    s.child().exit(1);
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
  });

  it('a token cancelled before the call spawns nothing', async () => {
    const s = setup();
    s.cancel();
    await expect(s.runner.run(REQUEST, s.token)).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
    expect(s.spawned.calls).toEqual([]);
  });

  it('killAll sends SIGKILL at once, resolves without waiting for exit, and leaves no timer', async () => {
    const s = setup();
    const done = s.runner.run(REQUEST, s.token);
    s.runner.killAll();
    expect(s.kills).toEqual([[-4242, 'SIGKILL']]);
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a process group that is already gone does not throw', async () => {
    const spawned = fakeSpawn();
    const runner = createFallowRunner({ spawn: spawned.spawn, env: {}, platform: 'linux', killProcess: () => { throw Object.assign(new Error('ESRCH'), { code: 'ESRCH' }); } });
    const { token, cancel } = createCancellationToken();
    const done = runner.run(REQUEST, token);
    expect(() => { cancel(); }).not.toThrow();
    spawned.children[0]!.exit(0);
    await expect(done).resolves.toEqual({ kind: 'cancelled', stderrTail: '' });
  });
});

describe('spawn failures (Z18)', () => {
  it('an error before the process started is spawn-failed with its code', async () => {
    const spawned = fakeSpawn(undefined);
    const runner = createFallowRunner({ spawn: spawned.spawn, env: {}, platform: 'linux' });
    const done = runner.run(REQUEST, createCancellationToken().token);
    spawned.children[0]!.emitError('ENOENT');
    await expect(done).resolves.toEqual({ kind: 'spawn-failed', errorCode: 'ENOENT' });
  });

  it('a synchronous throw is spawn-failed with its code', async () => {
    const runner = createFallowRunner({ spawn: () => { throw Object.assign(new Error('bad'), { code: 'EINVAL' }); }, env: {}, platform: 'linux' });
    await expect(runner.run(REQUEST, createCancellationToken().token)).resolves.toEqual({ kind: 'spawn-failed', errorCode: 'EINVAL' });
  });

  it('without Node (not the desktop app) every run is spawn-failed UNAVAILABLE', async () => {
    await expect(createFallowRunner().run(REQUEST, createCancellationToken().token)).resolves.toEqual({ kind: 'spawn-failed', errorCode: 'UNAVAILABLE' });
  });
});
```

Create `tests/contracts/fallow-runner.test.ts`:

```ts
// Part 7 Z38: the REAL runner spawning real processes: `process.execPath` running the fake
// fallow. The executable is supplied through ProcessRequest (the adapter is generic), and
// real node:child_process is injected. Every process a test starts is killed in afterEach.
import { mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createFallowRunner } from '../../src/adapters/fallow/fallow-runner';
import { FALLOW_ENV_ALLOW_LIST, FALLOW_RUN_ARGS, classifyFallowExit } from '../../src/application/analysis/fallow-invocation';
import type { ProcessOutcome, ProcessRequest } from '../../src/application/ports/analyzer-process';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { fallowText } from '../fixtures/fallow-fixture';
import { realSpawn } from '../fixtures/real-spawn';

const FAKE = fileURLToPath(new URL('../fixtures/fallow-runner/fake-fallow.mjs', import.meta.url));
const pids: number[] = [];
const bases: string[] = [];
const runner = createFallowRunner({
  spawn: (command, args, options) => {
    const child = realSpawn(command, args, options);
    if (child.pid !== undefined) pids.push(child.pid);
    return child;
  },
  env: process.env,
  platform: process.platform,
});

const alive = (pid: number): boolean => {
  try { process.kill(pid, 0); return true; } catch { return false; }
};
async function gone(pid: number, withinMs = 3_000): Promise<boolean> {
  const until = Date.now() + withinMs;
  while (Date.now() < until) {
    if (!alive(pid)) return true;
    await new Promise((resolve) => { setTimeout(resolve, 50); });
  }
  return !alive(pid);
}
afterEach(async () => {
  for (const pid of pids.splice(0)) if (alive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } }
  for (const base of bases.splice(0)) await rm(base, { recursive: true, force: true });
});

async function rootNamed(name = 'root'): Promise<string> {
  const base = await mkdtemp(join(tmpdir(), 'ci-fallow-runner-'));
  bases.push(base);
  const root = join(base, name);
  await mkdir(root);
  return root;
}
function request(mode: string, root: string, overrides: Partial<ProcessRequest> = {}): ProcessRequest {
  return {
    executablePath: process.execPath, args: [FAKE, `--mode=${mode}`, ...FALLOW_RUN_ARGS(root)], cwd: root,
    timeoutMs: 20_000, maxStdoutBytes: 16 * 1024 * 1024, maxStderrBytes: 65_536, ...overrides,
  };
}
const run = (r: ProcessRequest): Promise<ProcessOutcome> => runner.run(r, createCancellationToken().token);

describe('the real runner: exit semantics (Z18, spec §1)', () => {
  it('exit 0 with a report is read whole', async () => {
    const outcome = await run(request('ok', await rootNamed()));
    expect(outcome).toMatchObject({ kind: 'exited', exitCode: 0, stdout: fallowText('combined-3.27.0') });
    expect(classifyFallowExit(outcome, 120).kind).toBe('completed');
  });

  it('exit 1 with a report is completed; exit 2 with the error object is analyzer-error', async () => {
    const root = await rootNamed();
    expect(classifyFallowExit(await run(request('findings-exit-1', root)), 120).kind).toBe('completed');
    expect(classifyFallowExit(await run(request('error-exit-2', root)), 120)).toMatchObject({ kind: 'failed', code: 'analyzer-error' });
  });

  it('a truncated report and garbage are output-not-json', async () => {
    const root = await rootNamed();
    for (const mode of ['truncated', 'garbage']) {
      expect(classifyFallowExit(await run(request(mode, root)), 120), mode).toEqual({ kind: 'failed', code: 'output-not-json', detail: '' });
    }
  });

  it('a missing executable is spawn-failed ENOENT', async () => {
    const root = await rootNamed();
    expect(await run({ ...request('ok', root), executablePath: join(root, 'nope', 'fallow.exe') })).toEqual({ kind: 'spawn-failed', errorCode: 'ENOENT' });
  });
});

describe('the real runner: bounds (Z17)', () => {
  it('stops a 17 MB stdout at 16 MB, and the process is gone', async () => {
    const outcome = await run(request('huge', await rootNamed()));
    expect(outcome.kind).toBe('stdout-too-large');
    expect(await gone(pids[pids.length - 1]!)).toBe(true);
  });

  it('keeps only the last 64 KB of a 1 MB stderr, separate from stdout', async () => {
    const outcome = await run(request('stderr-flood', await rootNamed()));
    expect(outcome.kind).toBe('exited');
    if (outcome.kind !== 'exited') return;
    expect(outcome.stderrTail.length).toBeLessThanOrEqual(65_536);
    expect(outcome.stderrTail.endsWith('last line\n')).toBe(true);
    expect(outcome.stdout).toBe(fallowText('combined-3.27.0'));
  });

  it('keeps markup on stderr as plain text for the log excerpt', async () => {
    const outcome = await run(request('html-stderr', await rootNamed()));
    expect(outcome).toMatchObject({ kind: 'exited', exitCode: 3, stderrTail: '<img src=x onerror=alert(1)>\n' });
  });
});

describe('the real runner: time, cancel and shutdown (Z18)', () => {
  it('times out a hanging process, which is then gone', async () => {
    const outcome = await run(request('hang', await rootNamed(), { timeoutMs: 500 }));
    expect(outcome.kind).toBe('timed-out');
    expect(await gone(pids[pids.length - 1]!)).toBe(true);
  });

  it('Review Focus 5: times out a process that never stops writing', async () => {
    expect((await run(request('trickle', await rootNamed(), { timeoutMs: 500 }))).kind).toBe('timed-out');
  });

  it('cancels a hanging process', async () => {
    const { token, cancel } = createCancellationToken();
    const done = runner.run(request('hang', await rootNamed()), token);
    setTimeout(cancel, 200);
    expect((await done).kind).toBe('cancelled');
    expect(await gone(pids[pids.length - 1]!)).toBe(true);
  });

  it('killAll ends a hanging process at once', async () => {
    const done = runner.run(request('hang', await rootNamed()), createCancellationToken().token);
    await new Promise((resolve) => { setTimeout(resolve, 200); });
    runner.killAll();
    expect((await done).kind).toBe('cancelled');
    expect(await gone(pids[pids.length - 1]!)).toBe(true);
  });

  // One plain it() with a platform branch, not it.skipIf/it.runIf: evidence-numbers.test.ts
  // counts `it(` blocks in this file (K28), and a conditional spelling would be missed.
  it('cancel ends the whole process group on POSIX, and the direct child only on Windows (the documented limitation)', async () => {
    const root = await rootNamed();
    const { token, cancel } = createCancellationToken();
    const done = runner.run(request('grandchild', root), token);
    await new Promise((resolve) => { setTimeout(resolve, 500); });
    const direct = pids[pids.length - 1]!;
    const grandchild = Number(await readFile(join(root, 'grandchild.pid'), 'utf8'));
    pids.push(grandchild);
    cancel();
    expect((await done).kind).toBe('cancelled');
    expect(await gone(direct)).toBe(true);
    if (process.platform !== 'win32') expect(await gone(grandchild)).toBe(true);
  });
});

describe('the real runner: what the child sees (Z15, Z16)', () => {
  it('gets only the allow-listed environment plus NO_COLOR, never FALLOW_* or NODE_OPTIONS', async () => {
    process.env.FALLOW_PRODUCTION = '1';
    process.env.NODE_OPTIONS = '--max-old-space-size=64';
    try {
      const outcome = await run(request('env-dump', await rootNamed()));
      if (outcome.kind !== 'exited') throw new Error(`env-dump ended as ${outcome.kind}`);
      const keys = (JSON.parse(outcome.stdout ?? '[]') as string[]).filter((k) => !k.startsWith('='));
      const allowed = [...FALLOW_ENV_ALLOW_LIST, 'NO_COLOR'].map((k) => k.toUpperCase());
      expect(keys).toContain('NO_COLOR');
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) expect(allowed, key).toContain(key.toUpperCase());
    } finally {
      delete process.env.FALLOW_PRODUCTION;
      delete process.env.NODE_OPTIONS;
    }
  });

  it('Review Focus 2: a root with a space and a non-ASCII letter reaches the child unquoted, as its cwd', async () => {
    const root = await rootNamed('my repo \u00fc');
    const argv = await run(request('argv', root));
    expect(argv.kind === 'exited' ? JSON.parse(argv.stdout ?? 'null') : null).toEqual(['--format', 'json', '--no-cache', '--quiet', '--root', root]);
    const cwd = await run(request('cwd', root));
    expect(cwd.kind === 'exited' ? await realpath(cwd.stdout ?? '') : null).toBe(await realpath(root));
  });
});
```

Replace the whole of `tests/fixtures/process-guard.ts` with:

```ts
// Part 6 acceptance evidence (2) detector, used by tests/unit/no-process-execution.test.ts.
// Moved out of the test file (fix round 2, E31) so the test file can stay under its
// 450-line cap once the detector grew from a token scan into a full parse.
//
// History: round 1 replaced a comment-stripping regex with `ts.createScanner`, which
// fixed strings that merely LOOK like comments but never re-entered template or regex
// mode (it missed an injected call in 68 of 262 real files). Round 2 parsed `.ts`/`.js`
// with `ts.createSourceFile`, but still found a `.vue` file's `<script>` with a regex, which
// a component named `<ScriptPanel />` or a `<script>` inside an HTML comment fooled. Round
// 3 (E31) parses `.vue` files with `@vue/compiler-sfc`'s `parse`.
//
// PART 7 (spec Z37, U42's "Part 7 must amend it deliberately"): the one legitimate process
// code now exists, so the labels are finer and the allow-list lives in the test:
// - 'spawn call' is the async `spawn` alone, in every spelling below;
// - 'process call' is every other process API: spawnSync, bare exec, execSync, execFile,
//   execFileSync and fork (a member `.exec(` stays RegExp.prototype.exec);
// - 'shell option' (new) is an object-literal property named `shell` — plain, string-keyed,
//   computed with a string key, or shorthand — whose value is not the literal `false`;
// - 'process module' and 'shell.openPath' are unchanged.
// tests/unit/no-process-execution.test.ts allows exactly 'process module' in
// src/adapters/fallow/node-process-access.ts and exactly 'spawn call' in
// src/adapters/fallow/fallow-runner.ts. Everything else stays banned everywhere.
//
// The AST walk covers: import/export specifiers, dynamic import(), `require`/`x.require`
// calls, any string literal naming a banned module, calls (bare, member, bracket with a
// string or template key, `.call`/`.apply`, tagged templates, optional chains, non-null
// assertions, parentheses, type assertions and comma expressions), opener identifiers,
// and `shell` properties. A `.vue` <template> is scanned as text for calls and openers.
//
// Known, accepted gaps: an alias (`const s = spawn; s();`), `spawn.bind(null)()`,
// `Reflect.apply`, an uncalled bracket reference to an opener, a name built at run time,
// and a `shell` option written inside a <template> (not scanned: prose there reads
// "shell:" too often to be a reliable signal).
import ts from 'typescript';
import { parse as parseSfc } from '@vue/compiler-sfc';

export type ProcessGuardKind = 'ts' | 'vue';
export type ProcessHazard = 'process module' | 'spawn call' | 'process call' | 'shell option' | 'shell.openPath';
const HAZARD_ORDER: readonly ProcessHazard[] = ['process module', 'spawn call', 'process call', 'shell option', 'shell.openPath'];

const BANNED_MODULE = /\b(child_process|worker_threads)\b/;
const SPAWN = 'spawn';
const BARE_NAMES: ReadonlySet<string> = new Set(['spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']);
// No bare "exec" here: a member `.exec(` is RegExp.prototype.exec.
const MEMBER_NAMES: ReadonlySet<string> = new Set(['spawnSync', 'execSync', 'execFile', 'execFileSync', 'fork']);
const OPENER_NAMES: ReadonlySet<string> = new Set(['openPath', 'openExternal', 'openItem', 'showItemInFolder']);

interface Found { module: boolean; spawn: boolean; call: boolean; shell: boolean; open: boolean }
type CalleeShape = { shape: 'bare' | 'member'; name: string } | { shape: 'none' };

function literalText(node: ts.Node | undefined): string | undefined {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined;
}

function unwrap(expr: ts.Expression): ts.Expression {
  for (;;) {
    if (ts.isParenthesizedExpression(expr)) { expr = expr.expression; continue; }
    if (ts.isNonNullExpression(expr)) { expr = expr.expression; continue; }
    if (ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr) || ts.isTypeAssertionExpression(expr)) { expr = expr.expression; continue; }
    if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.CommaToken) { expr = expr.right; continue; }
    return expr;
  }
}

function calleeShape(expr: ts.Expression): CalleeShape {
  const inner = unwrap(expr);
  if (ts.isIdentifier(inner)) return { shape: 'bare', name: inner.text };
  if (ts.isPropertyAccessExpression(inner)) return { shape: 'member', name: inner.name.text };
  if (ts.isElementAccessExpression(inner)) {
    const name = literalText(inner.argumentExpression);
    return name === undefined ? { shape: 'none' } : { shape: 'member', name };
  }
  return { shape: 'none' };
}

/** Which hazard calling something of this shape is: the async spawn, another process API, or none. */
function callHazard(shape: CalleeShape): 'spawn' | 'call' | null {
  if (shape.shape === 'none') return null;
  if (shape.name === SPAWN) return 'spawn';
  return (shape.shape === 'bare' ? BARE_NAMES : MEMBER_NAMES).has(shape.name) ? 'call' : null;
}

function mark(found: Found, hazard: 'spawn' | 'call' | null): void {
  if (hazard === 'spawn') found.spawn = true;
  else if (hazard === 'call') found.call = true;
}

function specifierHazard(arg: ts.Expression | undefined, found: Found): void {
  const text = literalText(arg);
  if (text !== undefined && BANNED_MODULE.test(text)) found.module = true;
}

function visitCall(node: ts.CallExpression, found: Found): void {
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) { specifierHazard(node.arguments[0], found); return; }
  const callee = calleeShape(node.expression);
  if (callee.shape === 'member' && (callee.name === 'call' || callee.name === 'apply')) {
    // The receiver's OWN shape decides (round 3): `x.exec.call(y)` stays exempt, `spawn.call(y)` does not.
    const inner = unwrap(node.expression);
    const receiver = ts.isPropertyAccessExpression(inner) || ts.isElementAccessExpression(inner) ? inner.expression : undefined;
    if (receiver) mark(found, callHazard(calleeShape(receiver)));
    return;
  }
  if (callee.shape !== 'none' && callee.name === 'require') { specifierHazard(node.arguments[0], found); return; }
  const hazard = callHazard(callee);
  if (hazard !== null) { mark(found, hazard); return; }
  if (callee.shape === 'member' && OPENER_NAMES.has(callee.name)) found.open = true;
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name)) return literalText(name.expression);
  return undefined;
}

function toList(found: Found): ProcessHazard[] {
  const on: Record<ProcessHazard, boolean> = {
    'process module': found.module, 'spawn call': found.spawn, 'process call': found.call, 'shell option': found.shell, 'shell.openPath': found.open,
  };
  return HAZARD_ORDER.filter((h) => on[h]);
}

function processHazardsTs(source: string): ProcessHazard[] {
  const sourceFile = ts.createSourceFile('probe.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: Found = { module: false, spawn: false, call: false, shell: false, open: false };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) specifierHazard(node.moduleSpecifier, found);
    else if (ts.isExportDeclaration(node)) specifierHazard(node.moduleSpecifier, found);
    else if (ts.isCallExpression(node)) visitCall(node, found);
    else if (ts.isTaggedTemplateExpression(node)) mark(found, callHazard(calleeShape(node.tag)));
    else if (ts.isIdentifier(node) && OPENER_NAMES.has(node.text)) found.open = true;
    else if (ts.isStringLiteralLike(node) && BANNED_MODULE.test(node.text)) found.module = true;
    else if (ts.isPropertyAssignment(node) && propertyNameText(node.name) === 'shell'
      && unwrap(node.initializer).kind !== ts.SyntaxKind.FalseKeyword) found.shell = true;
    else if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'shell') found.shell = true;
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return toList(found);
}

const BARE_LIST = Array.from(BARE_NAMES).join('|');
const MEMBER_LIST = Array.from(MEMBER_NAMES).join('|');
const callPattern = (bare: string, member: string): RegExp => new RegExp(
  `(?<![\\w$.])(?:${bare})(?:\\s*\\?\\.)?\\s*\\(`
  + `|\\.(?:${member})(?:\\s*\\?\\.)?\\s*\\(`
  + `|(?<![\\w$.])(?:${bare})\\.(?:call|apply)\\s*\\(`
  + `|\\[\\s*['"](?:${member})['"]\\s*\\]\\s*\\(`,
);
const TEMPLATE_SPAWN = callPattern(SPAWN, SPAWN);
const TEMPLATE_CALL = callPattern(BARE_LIST, MEMBER_LIST);
const TEMPLATE_OPEN = new RegExp(`\\b(?:${Array.from(OPENER_NAMES).join('|')})\\b`);

function scanTemplateText(text: string): ProcessHazard[] {
  return toList({
    module: BANNED_MODULE.test(text), spawn: TEMPLATE_SPAWN.test(text), call: TEMPLATE_CALL.test(text), shell: false, open: TEMPLATE_OPEN.test(text),
  });
}

function processHazardsVue(source: string): ProcessHazard[] {
  const { descriptor } = parseSfc(source, { filename: 'probe.vue' });
  const parts = new Set<ProcessHazard>();
  if (descriptor.template?.content) scanTemplateText(descriptor.template.content).forEach((h) => parts.add(h));
  if (descriptor.script?.content) processHazardsTs(descriptor.script.content).forEach((h) => parts.add(h));
  if (descriptor.scriptSetup?.content) processHazardsTs(descriptor.scriptSetup.content).forEach((h) => parts.add(h));
  return HAZARD_ORDER.filter((h) => parts.has(h));
}

/** Every reason `source` could start a process or open a path, as short labels, in HAZARD_ORDER. */
export function processHazards(source: string, kind: ProcessGuardKind): ProcessHazard[] {
  return kind === 'vue' ? processHazardsVue(source) : processHazardsTs(source);
}

/** Self-test helper: appends a statement (for `.vue`, right before the LAST `</script>`). */
export function injectStatement(source: string, kind: ProcessGuardKind, statement: string): string {
  if (kind !== 'vue') return `${source}\n${statement}\n`;
  const at = source.lastIndexOf('</script>');
  return at < 0 ? source : `${source.slice(0, at)}\n${statement}\n${source.slice(at)}`;
}

export function injectSpawnCall(source: string, kind: ProcessGuardKind): string {
  return injectStatement(source, kind, "spawn('x');");
}
```

Replace the whole of `tests/unit/no-process-execution.test.ts` with:

```ts
// Part 6 acceptance evidence (2), amended deliberately by Part 7 (spec Z37, U42). Importing
// a report runs no code, and nothing under src/ can start a process or hand a path to the
// shell — except exactly two adapter files, each for exactly one hazard:
// - src/adapters/fallow/node-process-access.ts may name node:child_process (its one
//   window.require);
// - src/adapters/fallow/fallow-runner.ts may call the async spawn (its one call).
// shell: true, every *Sync API, exec, execFile, fork, worker_threads and the Electron openers
// stay banned everywhere, those two files included. The detector is
// tests/fixtures/process-guard.ts; see its header for what it covers and its history.
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { injectSpawnCall, injectStatement, processHazards, type ProcessGuardKind, type ProcessHazard } from '../fixtures/process-guard';

const SRC_ROOT = fileURLToPath(new URL('../../src', import.meta.url));

/** Z37: EXACTLY these two files, each allowed EXACTLY its own hazard. */
const PROCESS_ALLOWED: ReadonlyMap<string, readonly ProcessHazard[]> = new Map<string, readonly ProcessHazard[]>([
  ['adapters/fallow/node-process-access.ts', ['process module']],
  ['adapters/fallow/fallow-runner.ts', ['spawn call']],
]);

function listSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...listSourceFiles(abs));
    else if (/\.(ts|vue|js|mjs|cjs)$/.test(name)) out.push(abs);
  }
  return out;
}

const kindOf = (file: string): ProcessGuardKind => (file.endsWith('.vue') ? 'vue' : 'ts');
const rel = (abs: string): string => relative(SRC_ROOT, abs).replace(/\\/g, '/');
const hazardsOf = (relPath: string): ProcessHazard[] => processHazards(readFileSync(join(SRC_ROOT, relPath), 'utf8'), kindOf(relPath));

describe('nothing under src/ runs a process, except the two allow-listed adapter files (Z37)', () => {
  const files = listSourceFiles(SRC_ROOT).map(rel);

  it('has source files to check (the scan is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('no file has a hazard it is not allowed', () => {
    const offenders = files
      .map((file) => ({ file, hazards: hazardsOf(file).filter((h) => !(PROCESS_ALLOWED.get(file) ?? []).includes(h)) }))
      .filter((o) => o.hazards.length > 0);
    expect(offenders).toEqual([]);
  });

  it('each allow-listed file exists and has exactly its allowed hazard, so the list cannot go stale', () => {
    for (const [file, allowed] of PROCESS_ALLOWED) {
      expect(existsSync(join(SRC_ROOT, file)), file).toBe(true);
      expect(hazardsOf(file), file).toEqual(allowed);
    }
  });

  it('flags an injected spawn(\'x\'); call in every real source file (E31\'s blind-spot pin)', () => {
    const missed = files.filter((file) => !processHazards(injectSpawnCall(readFileSync(join(SRC_ROOT, file), 'utf8'), kindOf(file)), kindOf(file)).includes('spawn call'));
    expect(missed).toEqual([]);
  });

  it('still flags an injected spawnSync in each allow-listed file', () => {
    for (const file of PROCESS_ALLOWED.keys()) {
      const injected = injectStatement(readFileSync(join(SRC_ROOT, file), 'utf8'), 'ts', "spawnSync('x');");
      expect(processHazards(injected, 'ts'), file).toContain('process call');
    }
  });

  it('flags an injected { shell: true } in every real source file', () => {
    const missed = files.filter((file) => !processHazards(injectStatement(readFileSync(join(SRC_ROOT, file), 'utf8'), kindOf(file), 'const o = { shell: true };'), kindOf(file)).includes('shell option'));
    expect(missed).toEqual([]);
  });
});

describe('process hazard detection', () => {
  it.each<[string, ProcessGuardKind, ProcessHazard]>([
    ["import { spawn } from 'node:child_process';", 'ts', 'process module'],
    ["import * as cp from 'child_process';", 'ts', 'process module'],
    ["const cp = await import('node:child_process');", 'ts', 'process module'],
    ["const cp = window.require('child_process');", 'ts', 'process module'],
    ["const { Worker } = window.require('node:worker_threads');", 'ts', 'process module'],
    ["spawn('fallow', ['--format', 'json']);", 'ts', 'spawn call'],
    ["exec('fallow --version');", 'ts', 'process call'],
    ["execFile('fallow', []);", 'ts', 'process call'],
    ["runner.execFileSync('fallow');", 'ts', 'process call'],
    ["cp.spawnSync('fallow');", 'ts', 'process call'],
    ["proc.spawn ('fallow');", 'ts', 'spawn call'],
    ["fork('worker.js');", 'ts', 'process call'],
    ['shell.openPath(report);', 'ts', 'shell.openPath'],
    ['const { openPath } = shell;', 'ts', 'shell.openPath'],
    ["const g = 'dir/*'; spawn('x'); /** doc */", 'ts', 'spawn call'],
    ["const s = '//'; exec(cmd)", 'ts', 'process call'],
    ["spawn?.('fallow');", 'ts', 'spawn call'],
    ["cp.fork?.(['worker.js']);", 'ts', 'process call'],
    ["cp['spawn']('fallow');", 'ts', 'spawn call'],
    ["spawn.call(null, 'fallow');", 'ts', 'spawn call'],
    ["spawn.apply(null, ['fallow']);", 'ts', 'spawn call'],
    ['shell.openExternal(url);', 'ts', 'shell.openPath'],
    ['const { openItem } = shell;', 'ts', 'shell.openPath'],
    ['showItemInFolder(path);', 'ts', 'shell.openPath'],
    ["const t = `${dir}/*`; spawn('x'); /** doc */", 'ts', 'spawn call'],
    ["const t = `a${x}b'c`; spawn('x');", 'ts', 'spawn call'],
    ["const re = /[/*]/; spawn('x'); /** doc */", 'ts', 'spawn call'],
    ["const re = /'/; spawn('x');", 'ts', 'spawn call'],
    ["cp[`spawn`]('x')", 'ts', 'spawn call'],
    ['<template><button @click="exec(cmd)">Run</button></template>', 'vue', 'process call'],
    ['<template><button @click="shell.openPath(p)">Run</button></template>', 'vue', 'shell.openPath'],
    ['<template><ScriptPanel/><p>a backtick ` here</p></template><script setup>\nspawn(\'fallow\');\n</script>', 'vue', 'spawn call'],
    ['<template><!-- the <script> below --><p>Run nothing</p></template><script setup>\nspawn(\'fallow\');\n</script>', 'vue', 'spawn call'],
    ["<template><p>x</p></template><script setup>\nspawn('fallow');\n</script >", 'vue', 'spawn call'],
    ["<template><button @click=\"spawn?.('x')\">Run</button></template>", 'vue', 'spawn call'],
    ["<template><button @click=\"cp['spawn']('x')\">Run</button></template>", 'vue', 'spawn call'],
    ["<template><button @click=\"cp.execSync('x')\">Run</button></template>", 'vue', 'process call'],
    ["const m = 'child_process'; window.require(m);", 'ts', 'process module'],
    ["(spawn)('x');", 'ts', 'spawn call'],
    ["(0, cp.spawn)('x');", 'ts', 'spawn call'],
    ["spawn!('x');", 'ts', 'spawn call'],
    ['spawn`x`;', 'ts', 'spawn call'],
    ["spawn['call'](null);", 'ts', 'spawn call'],
    // Part 7 Z37: the shell option, in each spelling.
    ["cp.spawn('x', [], { shell: true });", 'ts', 'shell option'],
    ["const o = { ['shell']: 'cmd.exe' };", 'ts', 'shell option'],
    ["const o = { 'shell': process.env.SHELL };", 'ts', 'shell option'],
    ['const o = { shell };', 'ts', 'shell option'],
  ])('flags %s (%s) as %s', (source, kind, label) => {
    expect(processHazards(source, kind)).toContain(label);
  });

  it.each<[string, ProcessGuardKind]>([
    ["const drive = /^[A-Za-z]:/.exec(posix)?.[0] ?? null;", 'ts'],
    ["const digits = pattern.exec(id)?.[1];", 'ts'],
    ["// spawn('fallow') is fallow-runner.ts's job, never this one", 'ts'],
    ["/* import { exec } from 'node:child_process' */ const x = 1;", 'ts'],
    ["const executable = 'fallow'; const spawned = false; const forked = 0;", 'ts'],
    ["const note = 'a fork (of…) in the road, not a process';", 'ts'],
    ['const t = `${x} fork (now)`;', 'ts'],
    ['<template><p>Run nothing</p></template><script>const x = 1;</script>', 'vue'],
    ['<!-- openPath is not used --><p>Run nothing</p>', 'vue'],
    ['pattern.exec.call(str);', 'ts'],
    // Part 7 Z37: `shell: false`, and a `shell` that is not a property assignment.
    ["const options = { shell: false, windowsHide: true };", 'ts'],
    ['interface O { shell: false }', 'ts'],
    ['const shell = 1; use(shell);', 'ts'],
  ])('does not flag %s', (source, kind) => {
    expect(processHazards(source, kind)).toEqual([]);
  });

  it('keeps the async spawn apart from every other process API', () => {
    expect(processHazards("spawn('x'); spawnSync('y');", 'ts')).toEqual(['spawn call', 'process call']);
  });
});
```

In `tests/unit/node-access-boundary.test.ts`, replace lines 104–108:

```ts
  it('references a require-like access in EXACTLY node-access.ts, and nowhere else in src/', () => {
    const offending = files.filter((f) => referencesRequireLikeAccess(readFileSync(f, 'utf8')));
    const relPaths = offending.map((f) => relative(SRC_ROOT, f).replace(/\\/g, '/'));
    expect(relPaths).toEqual(['adapters/filesystem/node-access.ts']);
  });
```

with:

```ts
  // Part 7 Z14 (K19): node-process-access.ts is the second, and only other, window.require.
  it('references a require-like access in EXACTLY node-access.ts and node-process-access.ts, and nowhere else in src/', () => {
    const offending = files.filter((f) => referencesRequireLikeAccess(readFileSync(f, 'utf8')));
    const relPaths = offending.map((f) => relative(SRC_ROOT, f).replace(/\\/g, '/')).sort();
    expect(relPaths).toEqual(['adapters/fallow/node-process-access.ts', 'adapters/filesystem/node-access.ts']);
  });
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/unit/process-output.test.ts tests/unit/fallow-runner.test.ts tests/contracts/fallow-runner.test.ts tests/unit/no-process-execution.test.ts tests/unit/node-access-boundary.test.ts`
Expected: FAIL — `process-output.test.ts`, `fallow-runner.test.ts` and `tests/contracts/fallow-runner.test.ts` cannot resolve `../../src/adapters/fallow/*`; `no-process-execution.test.ts` fails "each allow-listed file exists" (`adapters/fallow/node-process-access.ts`: expected true, got false); `node-access-boundary.test.ts` fails (only `node-access.ts` found).

- [ ] **Step 3: Implement.**

In `src/adapters/filesystem/node-access.ts`, replace line 1:

```ts
// The ONLY place in the codebase that reaches Node. Everything else imports from here.
```

with:

```ts
// The only place that reaches Node's filesystem and path modules; src/adapters/fallow/node-process-access.ts is the only place that reaches child_process (Part 7 Z14).
```

Create `src/adapters/fallow/node-process-access.ts`:

```ts
// Part 7 Z14: the ONLY place in the codebase that reaches Node's child_process, and the one
// file the process guard allows to name it (tests/unit/no-process-execution.test.ts). The
// same window.require route as node-access.ts, for the same reasons (a static import would
// trip no-nodejs-modules and be bundled). Its overloads and the minimal structural shapes
// live HERE rather than in node-globals.d.ts, so the guard's allow-list stays at two files.
// Nothing here calls spawn: fallow-runner.ts does, once.
import { Platform } from 'obsidian';

export interface ReadableLike {
  on(event: 'data', listener: (chunk: Uint8Array) => void): unknown;
  destroy(): unknown;
}

export interface ChildProcessLike {
  readonly pid?: number | undefined;
  readonly stdout: ReadableLike | null;
  readonly stderr: ReadableLike | null;
  on(event: 'error', listener: (error: Error & { code?: string }) => void): unknown;
  on(event: 'exit' | 'close', listener: (code: number | null, signal: string | null) => void): unknown;
  kill(signal?: string): boolean;
}

/** Z15: exactly the options the runner passes; `shell` can only be `false`. */
export interface SpawnOptionsLike {
  cwd: string;
  env: Record<string, string>;
  shell: false;
  windowsHide: true;
  detached: boolean;
  stdio: ['ignore', 'pipe', 'pipe'];
}

export type SpawnLike = (command: string, args: readonly string[], options: SpawnOptionsLike) => ChildProcessLike;

export interface NodeProcessLike {
  env: Record<string, string | undefined>;
  platform: string;
  kill(pid: number, signal: string): void;
}

interface ChildProcessModuleLike { spawn: SpawnLike }

declare global {
  interface Window {
    require(id: 'node:child_process'): ChildProcessModuleLike;
    require(id: 'node:process'): NodeProcessLike;
  }
}

export const childProcess: ChildProcessModuleLike | null = Platform.isDesktopApp ? window.require('node:child_process') : null;
export const nodeProcess: NodeProcessLike | null = Platform.isDesktopApp ? window.require('node:process') : null;
```

Create `src/adapters/fallow/process-output.ts`:

```ts
// Part 7 Z16/Z17: the runner's pure helpers (no Node import). stdout is kept whole up to
// its cap and decoded ONCE, so a character split across chunks survives; stderr keeps only
// its tail and is cleaned for display; the child's environment is BUILT from an allow-list.

export interface StdoutCollector {
  /** False once the cap is crossed: that chunk is not kept, and the caller kills the child. */
  push(chunk: Uint8Array): boolean;
  readonly bytes: number;
  readonly overflowed: boolean;
  /** The kept bytes as UTF-8, or null when they are not valid UTF-8. */
  text(): string | null;
}

function concat(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const all = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) { all.set(chunk, at); at += chunk.length; }
  return all;
}

export function createStdoutCollector(maxBytes: number): StdoutCollector {
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let overflowed = false;
  return {
    push(chunk) {
      if (overflowed) return false;
      if (bytes + chunk.length > maxBytes) { overflowed = true; return false; }
      chunks.push(chunk);
      bytes += chunk.length;
      return true;
    },
    get bytes() { return bytes; },
    get overflowed() { return overflowed; },
    text() {
      try {
        return new TextDecoder('utf-8', { fatal: true }).decode(concat(chunks, bytes));
      } catch {
        return null;
      }
    },
  };
}

// eslint-disable-next-line no-control-regex -- stripping ANSI escape sequences is the point.
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
// eslint-disable-next-line no-control-regex -- stripping control characters (all but \t and \n) is the point.
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/g;

/** Z17: a log excerpt safe to show as text: no ANSI escapes, no control characters but tab and newline. */
export function cleanLog(text: string): string {
  return text.replace(ANSI, '').replace(CONTROL, '');
}

export interface StderrTail {
  push(chunk: Uint8Array): void;
  excerpt(): string;
}

export function createStderrTail(maxBytes: number): StderrTail {
  let chunks: Uint8Array[] = [];
  let bytes = 0;
  return {
    push(chunk) {
      chunks.push(chunk);
      bytes += chunk.length;
      while (bytes > maxBytes && chunks.length > 0) {
        const first = chunks[0]!;
        const excess = bytes - maxBytes;
        if (first.length <= excess) {
          chunks = chunks.slice(1);
          bytes -= first.length;
        } else {
          chunks[0] = first.subarray(excess);
          bytes -= excess;
        }
      }
    },
    excerpt() {
      return cleanLog(new TextDecoder('utf-8').decode(concat(chunks, bytes)));
    },
  };
}

/** Z16: only the allow-listed names (case-insensitively on Windows, written in the list's
 *  spelling), plus `extra`; any FALLOW_* key and NODE_OPTIONS are dropped whatever the list says. */
export function buildChildEnv(
  source: Readonly<Record<string, string | undefined>>, platform: string,
  allow: readonly string[], extra: Readonly<Record<string, string>>,
): Record<string, string> {
  const keys = Object.keys(source);
  const env: Record<string, string> = {};
  for (const name of allow) {
    const key = platform === 'win32'
      ? keys.find((k) => k.toUpperCase() === name.toUpperCase())
      : (Object.prototype.hasOwnProperty.call(source, name) ? name : undefined);
    const value = key === undefined ? undefined : source[key];
    if (value !== undefined && value !== '') env[name] = value;
  }
  for (const [key, value] of Object.entries(extra)) env[key] = value;
  return Object.fromEntries(Object.entries(env).filter(([key]) => {
    const upper = key.toUpperCase();
    return !upper.startsWith('FALLOW_') && upper !== 'NODE_OPTIONS';
  }));
}
```

Create `src/adapters/fallow/fallow-runner.ts`:

```ts
// Part 7 Z15/Z17/Z18: THE spawn — the one process call in src/, allowed by the guard for
// this file alone. Generic: the application builds the argv; tests supply any executable.
// - One spawn per run: argument array, shell: false, windowsHide, a built environment,
//   stdio ignore/pipe/pipe, and a process group of its own on POSIX (detached).
// - stdout is capped (bytes) and parsed by nobody here; stderr keeps its tail.
// - The time limit is absolute from spawn; output never postpones it.
// - Cancel, the time limit and the cap all stop the same way: SIGTERM (the group on POSIX,
//   kill() on Windows), then SIGKILL after the grace. A stopped run resolves on `exit`,
//   after destroying the pipes, so a grandchild holding them cannot keep it open.
// - killAll (onunload) sends SIGKILL at once and resolves every run as cancelled.
// - run() never rejects.
import { childProcess, nodeProcess, type ChildProcessLike, type SpawnLike } from './node-process-access';
import { buildChildEnv, createStderrTail, createStdoutCollector } from './process-output';
import {
  FALLOW_CLOSE_GRACE_MS, FALLOW_ENV_ALLOW_LIST, FALLOW_ENV_EXTRA, FALLOW_KILL_GRACE_MS,
} from '../../application/analysis/fallow-invocation';
import type { AnalyzerProcessPort, ProcessOutcome, ProcessRequest } from '../../application/ports/analyzer-process';
import type { CancellationToken } from '../../application/ports/cancellation-token';

export interface FallowRunnerDeps {
  /** null: not the desktop app, so nothing can run. */
  spawn?: SpawnLike | null;
  env?: Readonly<Record<string, string | undefined>>;
  platform?: string;
  killProcess?: (pid: number, signal: string) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

type StopReason = 'cancelled' | 'timed-out' | 'stdout-too-large';
interface LiveRun { stop(reason: StopReason): void; shutdown(): void }

function errorCodeOf(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e) {
    const code = (e as { code: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'UNKNOWN';
}

function defaultSpawn(): SpawnLike | null {
  const cp = childProcess;
  return cp === null ? null : (command, args, options) => cp.spawn(command, args, options);
}

export function createFallowRunner(deps: FallowRunnerDeps = {}): AnalyzerProcessPort {
  const spawn = deps.spawn === undefined ? defaultSpawn() : deps.spawn;
  const env = deps.env ?? nodeProcess?.env ?? {};
  const platform = deps.platform ?? nodeProcess?.platform ?? 'linux';
  const killProcess = deps.killProcess ?? ((pid: number, signal: string): void => { nodeProcess?.kill(pid, signal); });
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number): unknown => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((handle: unknown): void => { clearTimeout(handle as ReturnType<typeof setTimeout>); });
  const live = new Set<LiveRun>();

  function run(request: ProcessRequest, token: CancellationToken): Promise<ProcessOutcome> {
    if (token.cancelled) return Promise.resolve({ kind: 'cancelled', stderrTail: '' });
    if (spawn === null) return Promise.resolve({ kind: 'spawn-failed', errorCode: 'UNAVAILABLE' });
    let child: ChildProcessLike;
    try {
      child = spawn(request.executablePath, request.args, {
        cwd: request.cwd,
        env: buildChildEnv(env, platform, FALLOW_ENV_ALLOW_LIST, FALLOW_ENV_EXTRA),
        shell: false,
        windowsHide: true,
        detached: platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (e) {
      return Promise.resolve({ kind: 'spawn-failed', errorCode: errorCodeOf(e) });
    }
    const running = child;
    return new Promise<ProcessOutcome>((resolve) => {
      const stdout = createStdoutCollector(request.maxStdoutBytes);
      const stderr = createStderrTail(request.maxStderrBytes);
      const timers = new Set<unknown>();
      let stopReason: StopReason | null = null;
      let exited = false;
      let settled = false;
      let unsubscribe = (): void => {};

      const signal = (name: 'SIGTERM' | 'SIGKILL'): void => {
        const pid = running.pid;
        if (platform !== 'win32' && pid !== undefined) {
          try { killProcess(-pid, name); } catch { /* the group is already gone */ }
          return;
        }
        running.kill();
      };
      const destroyPipes = (): void => { running.stdout?.destroy(); running.stderr?.destroy(); };
      const after = (ms: number, fn: () => void): void => { timers.add(setTimer(fn, ms)); };
      const stoppedOutcome = (): ProcessOutcome => {
        const stderrTail = stderr.excerpt();
        if (stopReason === 'timed-out') return { kind: 'timed-out', stderrTail };
        if (stopReason === 'stdout-too-large') return { kind: 'stdout-too-large', stderrTail };
        return { kind: 'cancelled', stderrTail };
      };
      const handle: LiveRun = {
        stop(reason) {
          if (settled || stopReason !== null) return;
          stopReason = reason;
          if (exited) { destroyPipes(); finish(stoppedOutcome()); return; }
          signal('SIGTERM');
          after(FALLOW_KILL_GRACE_MS, () => { if (!exited) signal('SIGKILL'); });
        },
        shutdown() {
          if (settled) return;
          signal('SIGKILL');
          destroyPipes();
          finish({ kind: 'cancelled', stderrTail: stderr.excerpt() });
        },
      };
      function finish(outcome: ProcessOutcome): void {
        if (settled) return;
        settled = true;
        for (const timer of Array.from(timers)) clearTimer(timer);
        timers.clear();
        unsubscribe();
        live.delete(handle);
        resolve(outcome);
      }

      live.add(handle);
      unsubscribe = token.onCancelled(() => { handle.stop('cancelled'); });
      running.stdout?.on('data', (chunk) => { if (!stdout.push(chunk)) handle.stop('stdout-too-large'); });
      running.stderr?.on('data', (chunk) => { stderr.push(chunk); });
      running.on('error', (error) => {
        // Only a failure to start: a failed kill() also emits 'error', and is ignored.
        if (running.pid === undefined) finish({ kind: 'spawn-failed', errorCode: typeof error.code === 'string' ? error.code : 'UNKNOWN' });
      });
      running.on('exit', () => {
        exited = true;
        if (stopReason !== null) { destroyPipes(); finish(stoppedOutcome()); return; }
        after(FALLOW_CLOSE_GRACE_MS, () => { destroyPipes(); finish({ kind: 'output-incomplete', stderrTail: stderr.excerpt() }); });
      });
      running.on('close', (code, signalName) => {
        if (stopReason !== null) { finish(stoppedOutcome()); return; }
        if (code === null) { finish({ kind: 'signalled', signal: signalName ?? 'UNKNOWN', stderrTail: stderr.excerpt() }); return; }
        finish({ kind: 'exited', exitCode: code, stdout: stdout.text(), stdoutBytes: stdout.bytes, stderrTail: stderr.excerpt() });
      });
      after(request.timeoutMs, () => { handle.stop('timed-out'); });
    });
  }

  return {
    run,
    killAll(): void {
      for (const liveRun of Array.from(live)) liveRun.shutdown();
    },
  };
}
```

- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/unit/process-output.test.ts tests/unit/fallow-runner.test.ts tests/contracts/fallow-runner.test.ts tests/unit/no-process-execution.test.ts tests/unit/node-access-boundary.test.ts`
Expected: PASS. The grandchild test asserts the group kill on POSIX and only the direct child on Windows.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/adapters/fallow src/adapters/filesystem/node-access.ts tests/fixtures/process-guard.ts tests/fixtures/fake-child-process.ts tests/fixtures/real-spawn.ts tests/fixtures/fallow-runner/fake-fallow.mjs tests/unit/process-output.test.ts tests/unit/fallow-runner.test.ts tests/contracts/fallow-runner.test.ts tests/unit/no-process-execution.test.ts tests/unit/node-access-boundary.test.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add src/adapters/fallow/node-process-access.ts src/adapters/fallow/process-output.ts src/adapters/fallow/fallow-runner.ts src/adapters/filesystem/node-access.ts tests/fixtures/process-guard.ts tests/fixtures/fake-child-process.ts tests/fixtures/real-spawn.ts tests/fixtures/fallow-runner/fake-fallow.mjs tests/fixtures/fallow-runner/README.md tests/unit/process-output.test.ts tests/unit/fallow-runner.test.ts tests/contracts/fallow-runner.test.ts tests/unit/no-process-execution.test.ts tests/unit/node-access-boundary.test.ts
git commit -m "feat(adapters): the fallow process runner and the deliberate process-guard amendment (Z14-Z18, Z37)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Run the covering tests.**

Run: `npx vitest run tests/unit/process-output.test.ts tests/unit/fallow-runner.test.ts tests/contracts/fallow-runner.test.ts tests/unit/no-process-execution.test.ts tests/unit/node-access-boundary.test.ts tests/unit/executable-inspector.test.ts tests/unit/fallow-invocation.test.ts`
Expected: PASS.

---

### Task 8: The real stack end to end, the argv policy, and the opt-in `npm run test:fallow` (Z38 integration and policy, Z40, Z41)

**Files:**
- Create: `tests/fixtures/node-wrapped-port.ts` (~35)
- Test: `tests/integration/fallow-analysis.test.ts` (new, ~260)
- Test: `tests/unit/fallow-argv-policy.test.ts` (new, ~80)
- Create: `scripts/fetch-fallow.mjs` (~50), `vitest.fallow.config.ts` (~20)
- Test: `tests/fallow-real/fallow-real.test.ts` (new, ~190; a new layer, not collected by `vitest.config.ts`)
- Modify: `package.json` (44 → 45): `scripts`, after `"test": "vitest run",`
- Modify: `.gitignore` (5 → 6)
- Modify: `eslint.config.mjs` (257): line 21 (the `ignores` array)
- Modify: `.oxlintrc.json` (12): line 11 (`ignorePatterns`)

**Interfaces:**
- Consumes: Tasks 1–7 (the whole application layer, `createFallowRunner`, `createExecutableInspector`, `classifyFallowExit`, `classifyVersionProbe`, `FALLOW_RUN_ARGS`, `FALLOW_VERSION_ARGS`, `FALLOW_STDOUT_MAX_BYTES`, `FALLOW_STDERR_TAIL_BYTES`, `normalizeFallow`); `ScanCoordinator`, `createCancellationToken` (`src/application/scan-coordinator.ts`); `approve` (`src/application/approval.ts`); tests: `createRealNodePort`, `createFixedClock`, `createInMemoryAnalyzerStore`, `createFakeExecutableInspector`, `realSpawn`, `hashTree` (`tests/fixtures/temp-tree.ts`), `rawReport`, `FALLOW_FIXTURES` (`tests/fixtures/fallow-fixture.ts`), `fake-fallow.mjs`.
- Produces:
  - `nodeWrapped(runner: AnalyzerProcessPort, modeFor: (args: readonly string[]) => string, hold?: () => Promise<void>): AnalyzerProcessPort & { requests: ProcessRequest[] }` (tests)
  - `package.json` script `"test:fallow": "node scripts/fetch-fallow.mjs && vitest run --config vitest.fallow.config.ts"`
  - `.fallow-bin/bin-path.txt` (git-ignored, written by the fetch script)

- [ ] **Step 1: Write the failing tests.**

Create `tests/integration/fallow-analysis.test.ts`:

```ts
// Part 7 Z38, acceptance (3), (4) and (5), and G6: the REAL service, coordinator and runner
// over a REAL scan of a temporary copy of the fallow fixture project. The executable is the
// fake fallow run by Node (nodeWrapped); the inspector is scripted, because it would rightly
// refuse node as "not named fallow" — Task 6 tests it against real files, and
// `npm run test:fallow` against the real binary.
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createFallowRunner } from '../../src/adapters/fallow/fallow-runner';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { AnalysisCoordinator } from '../../src/application/analysis/analysis-coordinator';
import { isActive } from '../../src/application/analysis/analysis-state';
import { createFallowAnalysisService, type FallowAnalysisService } from '../../src/application/analysis/fallow-analysis-service';
import { FALLOW_RUN_ARGS, FALLOW_STDERR_TAIL_BYTES, FALLOW_STDOUT_MAX_BYTES, classifyFallowExit } from '../../src/application/analysis/fallow-invocation';
import { approve } from '../../src/application/approval';
import { ScanCoordinator, createCancellationToken } from '../../src/application/scan-coordinator';
import type { AnalysisScope, CodebaseSnapshot } from '../../src/domain/model';
import { createFixedClock } from '../fixtures/clock';
import { emptyEvidenceReport } from '../fixtures/evidence-report';
import { createFakeExecutableInspector } from '../fixtures/fake-executable-inspector';
import { createInMemoryAnalyzerStore } from '../fixtures/in-memory-analyzer-store';
import { nodeWrapped } from '../fixtures/node-wrapped-port';
import { createRealNodePort } from '../fixtures/real-node-port';
import { realSpawn } from '../fixtures/real-spawn';

const PROJECT = fileURLToPath(new URL('../fixtures/fallow/project', import.meta.url));
const FAKE = fileURLToPath(new URL('../fixtures/fallow-runner/fake-fallow.mjs', import.meta.url));
const bases: string[] = [];
const pids: number[] = [];
const alive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };
afterEach(async () => {
  for (const pid of pids.splice(0)) if (alive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
  for (const base of bases.splice(0)) await rm(base, { recursive: true, force: true });
});

interface World {
  root: string;
  snapshot: CodebaseSnapshot;
  service: FallowAnalysisService;
  evidence: InMemoryEvidenceStore;
  requests: { args: readonly string[] }[];
  mode: { run: string; probe: string };
  rescan: () => Promise<CodebaseSnapshot>;
  release: () => void;
}

async function world(options: { hold?: boolean } = {}): Promise<World> {
  const base = await mkdtemp(join(tmpdir(), 'ci-fallow-analysis-'));
  bases.push(base);
  const root = join(base, 'project');
  await cp(PROJECT, root, { recursive: true });
  const clock = createFixedClock('2026-09-23T10:00:00.000Z');
  const snapshots = new InMemorySnapshotStore(clock);
  const scope: AnalysisScope = { rootPath: root, exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false };
  const scanner = new ScanCoordinator({ port: createRealNodePort(), store: snapshots, clock, createCancellationToken });
  const rescan = async (): Promise<CodebaseSnapshot> => {
    clock.advance(1_000);
    await scanner.start(approve('p1', root, scope, clock), scope);
    return snapshots.latestFor('p1')!;
  };
  const snapshot = await rescan();
  const mode = { run: 'ok', probe: 'version' };
  let release = (): void => {};
  const gate = options.hold ? new Promise<void>((resolve) => { release = resolve; }) : null;
  const runner = createFallowRunner({
    spawn: (command, args, spawnOptions) => {
      const child = realSpawn(command, args, spawnOptions);
      if (child.pid !== undefined) pids.push(child.pid);
      return child;
    },
    env: process.env, platform: process.platform,
  });
  const port = nodeWrapped(runner, (args) => (args[0] === '--version' ? mode.probe : mode.run), gate === null ? undefined : () => gate);
  const evidence = new InMemoryEvidenceStore();
  const coordinator = new AnalysisCoordinator({ process: port, evidence, snapshots, clock, createCancellationToken });
  const service = createFallowAnalysisService({
    store: createInMemoryAnalyzerStore('m'), inspector: createFakeExecutableInspector(process.platform === 'win32' ? 'fallow.exe' : 'fallow'),
    coordinator, snapshots, getFilesystem: () => createRealNodePort(), machineId: 'm', clock,
  });
  return { root, snapshot, service, evidence, requests: port.requests, mode, rescan, release: () => { release(); } };
}

const EXE = process.platform === 'win32' ? 'C:\\Tools\\fallow\\fallow.exe' : '/opt/fallow/bin/fallow';

async function settled(w: World): Promise<void> {
  const until = Date.now() + 15_000;
  while (isActive(w.service.stateOf('p1')) && Date.now() < until) await new Promise((resolve) => { setTimeout(resolve, 25); });
}
async function trustAndRun(w: World): Promise<void> {
  const reviewed = await w.service.review('p1', w.snapshot, EXE);
  if (!reviewed.ok) throw new Error(`test setup: review refused (${reviewed.code})`);
  expect(await w.service.trustAndRun('p1', w.snapshot, reviewed.review)).toEqual({ kind: 'started' });
  await settled(w);
}

describe('the real stack: trust, probe, run, publish (G6, acceptance 3)', () => {
  it('an untrusted binding starts no process at all', async () => {
    const w = await world();
    const reviewed = await w.service.review('p1', w.snapshot, EXE);
    expect(reviewed.ok).toBe(true);
    expect(w.requests).toEqual([]);
  });

  it('Trust and run probes first, then runs the exact argv in the scanned root, and publishes collected evidence', async () => {
    const w = await world();
    await trustAndRun(w);
    expect(w.requests.map((r) => r.args)).toEqual([['--version'], FALLOW_RUN_ARGS(w.root)]);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'completed', version: '3.27.0', tested: true, matchedFindings: 5, matchedFiles: 4 });
    expect(w.evidence.get('p1')?.collected).toMatchObject({ origin: 'collected', sourceMatch: 'verified', rootPath: w.root, exitCode: 0 });
    expect(await w.service.checkTrust('p1', w.snapshot)).toEqual({ kind: 'trusted' });
  });

  it('exit 1 with findings is completed', async () => {
    const w = await world();
    w.mode.run = 'findings-exit-1';
    await trustAndRun(w);
    expect(w.service.stateOf('p1').status).toBe('completed');
    expect(w.evidence.get('p1')?.collected?.exitCode).toBe(1);
  });

  it('fallow 4 is refused after the probe; nothing runs and no trust is stored', async () => {
    const w = await world();
    w.mode.probe = 'version-4';
    await trustAndRun(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'version-unsupported', detail: '4.0.0' });
    expect(w.requests).toHaveLength(1);
    expect(await w.service.checkTrust('p1', w.snapshot)).toMatchObject({ kind: 'review', reason: 'untrusted' });
  });

  it('an untested 3.x runs, labelled untested', async () => {
    const w = await world();
    w.mode.probe = 'version-untested';
    await trustAndRun(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'completed', tested: false });
    expect(w.evidence.get('p1')?.collected?.versionTested).toBe(false);
  });

  it('a version change after trust ends the next run as version-changed and revokes trust', async () => {
    const w = await world();
    await trustAndRun(w);
    w.mode.probe = 'version-untested';
    expect(await w.service.run('p1', w.snapshot)).toEqual({ kind: 'started' });
    await settled(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'version-changed', detail: '3.28.0' });
    expect(await w.service.checkTrust('p1', w.snapshot)).toMatchObject({ kind: 'review', reason: 'untrusted' });
  });
});

describe('the real stack: failures keep evidence (acceptance 4)', () => {
  it('a real operational failure keeps the earlier findings, marked stale', async () => {
    const w = await world();
    await trustAndRun(w);
    const before = w.evidence.get('p1');
    w.mode.run = 'error-exit-2';
    await w.service.run('p1', w.snapshot);
    await settled(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'analyzer-error', evidenceKept: true });
    expect(w.evidence.get('p1')).toEqual({ ...before, staleReason: 'failed-run' });
  });

  it('a truncated report attaches nothing', async () => {
    const w = await world();
    w.mode.run = 'truncated';
    await trustAndRun(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'output-not-json' });
    expect(w.evidence.get('p1')).toBeNull();
  });
});

describe('the real stack: cancelled or superseded runs never publish (acceptance 5)', () => {
  it('a cancelled run is cancelled, attaches nothing, and its process is gone', async () => {
    const w = await world();
    w.mode.run = 'hang';
    const reviewed = await w.service.review('p1', w.snapshot, EXE);
    if (!reviewed.ok) throw new Error('test setup: review refused');
    await w.service.trustAndRun('p1', w.snapshot, reviewed.review);
    while (w.service.stateOf('p1').status !== 'running' || w.requests.length < 2) await new Promise((resolve) => { setTimeout(resolve, 25); });
    await new Promise((resolve) => { setTimeout(resolve, 200); });
    w.service.cancel('p1');
    expect(w.service.stateOf('p1').status).toBe('cancelling');
    await settled(w);
    expect(w.service.stateOf('p1').status).toBe('cancelled');
    expect(w.evidence.get('p1')).toBeNull();
    expect(alive(pids[pids.length - 1]!)).toBe(false);
  });

  it('a rescan while fallow runs discards the result as snapshot-changed', async () => {
    const w = await world({ hold: true });
    const reviewed = await w.service.review('p1', w.snapshot, EXE);
    if (!reviewed.ok) throw new Error('test setup: review refused');
    await w.service.trustAndRun('p1', w.snapshot, reviewed.review);
    while (w.service.stateOf('p1').status !== 'running') await new Promise((resolve) => { setTimeout(resolve, 25); });
    await w.rescan();
    w.release();
    await settled(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'snapshot-changed' });
    expect(w.evidence.get('p1')).toBeNull();
  });

  it('an import while fallow runs supersedes it: the import stays', async () => {
    const w = await world({ hold: true });
    const reviewed = await w.service.review('p1', w.snapshot, EXE);
    if (!reviewed.ok) throw new Error('test setup: review refused');
    await w.service.trustAndRun('p1', w.snapshot, reviewed.review);
    while (w.service.stateOf('p1').status !== 'running') await new Promise((resolve) => { setTimeout(resolve, 25); });
    w.evidence.put('p1', emptyEvidenceReport(w.snapshot.snapshotId, 'imported.json'));
    const kept = w.evidence.get('p1');
    w.release();
    await settled(w);
    expect(w.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'superseded' });
    expect(w.evidence.get('p1')).toBe(kept);
  });

  it('shutdown ends a hanging run at once and publishes nothing', async () => {
    const w = await world();
    w.mode.run = 'hang';
    const reviewed = await w.service.review('p1', w.snapshot, EXE);
    if (!reviewed.ok) throw new Error('test setup: review refused');
    await w.service.trustAndRun('p1', w.snapshot, reviewed.review);
    while (w.requests.length < 2) await new Promise((resolve) => { setTimeout(resolve, 25); });
    await new Promise((resolve) => { setTimeout(resolve, 200); });
    w.service.shutdown();
    await settled(w);
    expect(w.service.stateOf('p1').status).toBe('cancelled');
    expect(w.evidence.get('p1')).toBeNull();
  });
});

describe('no freeze (acceptance 3)', () => {
  it('the event loop never stalls for 50 ms while a child hangs or streams 12 MB; the final parse is only measured', async () => {
    const w = await world();
    const runner = createFallowRunner({ spawn: realSpawn, env: process.env, platform: process.platform });
    const request = (mode: string, timeoutMs: number) => ({
      executablePath: process.execPath, args: [FAKE, `--mode=${mode}`, ...FALLOW_RUN_ARGS(w.root)], cwd: w.root,
      timeoutMs, maxStdoutBytes: FALLOW_STDOUT_MAX_BYTES, maxStderrBytes: FALLOW_STDERR_TAIL_BYTES,
    });
    for (const [mode, timeoutMs, expected] of [['hang', 2_000, 'timed-out'], ['streamed', 30_000, 'exited']] as const) {
      let last = performance.now();
      let worst = 0;
      const sampler = setInterval(() => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; }, 10);
      const outcome = await runner.run(request(mode, timeoutMs), createCancellationToken().token);
      clearInterval(sampler);
      expect(outcome.kind, mode).toBe(expected);
      const parseStarted = performance.now();
      const classified = classifyFallowExit(outcome, 120);
      console.info(`[no-freeze] ${mode}: largest event-loop gap ${worst.toFixed(1)} ms; final parse ${(performance.now() - parseStarted).toFixed(1)} ms (${classified.kind})`);
      expect(worst, `${mode}: largest event-loop gap`).toBeLessThan(50);
    }
  });
});
```

Create `tests/unit/fallow-argv-policy.test.ts`:

```ts
// Part 7 Z15/Z38/Z40 and G6's "Disallow auto-install/download/fix paths": the only argv the
// plugin can build, no install/fix/watch word anywhere in the fallow code, no fallow
// dependency, and the real-binary tests kept out of `npm run verify`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { FALLOW_RUN_ARGS, FALLOW_VERSION_ARGS } from '../../src/application/analysis/fallow-invocation';

const REPO = fileURLToPath(new URL('../../', import.meta.url));
const FORBIDDEN: readonly string[] = ['npx', 'npm', 'fix', 'init', 'setup', 'watch', '--fail-on-issues', '--allow-remote-extends'];

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    return statSync(abs).isDirectory() ? tsFiles(abs) : name.endsWith('.ts') ? [abs] : [];
  });
}

function stringLiterals(file: string): string[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) found.push(node.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('the fallow argv policy (Z15)', () => {
  it('builds exactly two argument lists', () => {
    expect(FALLOW_RUN_ARGS('/repo')).toEqual(['--format', 'json', '--no-cache', '--quiet', '--root', '/repo']);
    expect(FALLOW_VERSION_ARGS).toEqual(['--version']);
  });

  it('has no install, fix, init, setup, watch or failing-flag word as a string in the fallow code', () => {
    const files = [...tsFiles(join(REPO, 'src', 'application', 'analysis')), ...tsFiles(join(REPO, 'src', 'adapters', 'fallow'))];
    expect(files.length).toBeGreaterThan(8);
    const hits = files.flatMap((file) => stringLiterals(file).filter((s) => FORBIDDEN.includes(s)).map((s) => `${file}: ${s}`));
    expect(hits).toEqual([]);
  });
});

describe('fallow stays out of the dependencies and out of verify (Z40)', () => {
  const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts: Record<string, string>;
  };

  it('depends on no fallow package', () => {
    const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
    expect(names.filter((n) => n === 'fallow' || n.startsWith('@fallow-cli/'))).toEqual([]);
  });

  it('runs the real binary only through the opt-in script, never from verify', () => {
    expect(pkg.scripts['test:fallow']).toBe('node scripts/fetch-fallow.mjs && vitest run --config vitest.fallow.config.ts');
    expect(pkg.scripts.verify).not.toContain('test:fallow');
    expect(pkg.scripts.test).toBe('vitest run');
  });

  it('git-ignores the fetched binary and keeps linters out of it', () => {
    expect(readFileSync(join(REPO, '.gitignore'), 'utf8').split(/\r?\n/)).toContain('.fallow-bin/');
    expect(readFileSync(join(REPO, 'eslint.config.mjs'), 'utf8')).toContain("'.fallow-bin/**'");
    expect(readFileSync(join(REPO, '.oxlintrc.json'), 'utf8')).toContain('".fallow-bin/**"');
  });
});
```

Create `tests/fallow-real/fallow-real.test.ts`:

```ts
// Part 7 Z40/Z41 (G6 "Verify analyzer cache/report/log side effects against the tested
// version"): OPT-IN. Runs the real, pinned fallow — fetched by `npm run test:fallow` into
// the git-ignored .fallow-bin/, or the binary named by FALLOW_BIN — through the real
// inspector and runner, on a temporary copy of the fixture project. Collected only by
// vitest.fallow.config.ts; skipped (never failed, never downloaded) when no binary is there.
import { existsSync, readFileSync } from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createExecutableInspector } from '../../src/adapters/fallow/executable-inspector';
import { createFallowRunner } from '../../src/adapters/fallow/fallow-runner';
import type { NodeFsPromisesLike } from '../../src/adapters/filesystem/node-globals';
import {
  FALLOW_RUN_ARGS, FALLOW_STDERR_TAIL_BYTES, FALLOW_STDOUT_MAX_BYTES, FALLOW_VERSION_ARGS, classifyFallowExit, classifyVersionProbe,
} from '../../src/application/analysis/fallow-invocation';
import { normalizeFallow } from '../../src/application/evidence/normalize-fallow';
import type { ProcessOutcome, ProcessRequest } from '../../src/application/ports/analyzer-process';
import { createCancellationToken } from '../fixtures/cancellation-token';
import { FALLOW_FIXTURES, rawReport, type FallowFixture } from '../fixtures/fallow-fixture';
import { realSpawn } from '../fixtures/real-spawn';
import { hashTree } from '../fixtures/temp-tree';

function resolveFallowBin(): string | null {
  const fromEnv = process.env.FALLOW_BIN;
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  const file = fileURLToPath(new URL('../../.fallow-bin/bin-path.txt', import.meta.url));
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : null;
}

const BIN = resolveFallowBin();
const PROJECT = fileURLToPath(new URL('../fixtures/fallow/project', import.meta.url));
const TITLE = BIN === null ? 'fallow binary not fetched: run npm run test:fallow' : `the real fallow at ${BIN}`;

describe.skipIf(BIN === null)(TITLE, () => {
  const bin = BIN ?? '';
  const pids: number[] = [];
  const bases: string[] = [];
  const runner = createFallowRunner({
    spawn: (command, args, options) => {
      const child = realSpawn(command, args, options);
      if (child.pid !== undefined) pids.push(child.pid);
      return child;
    },
    env: process.env, platform: process.platform,
  });
  const inspector = createExecutableInspector({ fsPromises: fsPromises as unknown as NodeFsPromisesLike, platform: process.platform });
  const alive = (pid: number): boolean => { try { process.kill(pid, 0); return true; } catch { return false; } };

  afterEach(async () => {
    for (const pid of pids.splice(0)) if (alive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
    for (const base of bases.splice(0)) await rm(base, { recursive: true, force: true });
  });

  async function projectCopy(): Promise<string> {
    const base = await mkdtemp(join(tmpdir(), 'ci-fallow-real-'));
    bases.push(base);
    const root = join(base, 'project');
    await cp(PROJECT, root, { recursive: true });
    return root;
  }
  const request = (root: string, args: readonly string[] = FALLOW_RUN_ARGS(root), overrides: Partial<ProcessRequest> = {}): ProcessRequest => ({
    executablePath: bin, args, cwd: root, timeoutMs: 60_000, maxStdoutBytes: FALLOW_STDOUT_MAX_BYTES, maxStderrBytes: FALLOW_STDERR_TAIL_BYTES, ...overrides,
  });
  const go = (r: ProcessRequest): Promise<ProcessOutcome> => runner.run(r, createCancellationToken().token);
  const lastPidGone = (): boolean => !alive(pids[pids.length - 1]!);

  it('1. the inspector accepts it as this platform\'s native binary', async () => {
    const root = await projectCopy();
    expect(await inspector.inspect(bin, root)).toMatchObject({ ok: true, facts: { insideRoot: false } });
  });

  it('2. the probe reports a 3.x version (3.27.0 unless FALLOW_BIN names another)', async () => {
    const root = await projectCopy();
    const probe = classifyVersionProbe(await go(request(root, FALLOW_VERSION_ARGS, { timeoutMs: 5_000, maxStdoutBytes: 4_096 })));
    console.info(`[fallow-real] ${bin} on ${process.platform}: ${JSON.stringify(probe)}`);
    expect(probe.ok).toBe(true);
    if (process.env.FALLOW_BIN === undefined && probe.ok) expect(probe.version).toBe('3.27.0');
  });

  it('3. the exact run completes and reproduces the committed recording of its version', async () => {
    const root = await projectCopy();
    const probe = classifyVersionProbe(await go(request(root, FALLOW_VERSION_ARGS, { timeoutMs: 5_000, maxStdoutBytes: 4_096 })));
    const outcome = await go(request(root));
    expect(outcome.kind).toBe('exited');
    if (outcome.kind === 'exited') expect([0, 1]).toContain(outcome.exitCode);
    const result = classifyFallowExit(outcome, 60);
    expect(result.kind).toBe('completed');
    const fixture = probe.ok ? (`combined-${probe.version}` as FallowFixture) : null;
    if (result.kind !== 'completed' || fixture === null || !FALLOW_FIXTURES.includes(fixture)) return;
    const shape = (findings: readonly { id: string; path: string; line: number | null }[]) =>
      findings.map((f) => `${f.id} ${f.path}:${f.line ?? '-'}`).sort();
    expect(shape(normalizeFallow(result.report, { stripPrefix: null }).findings))
      .toEqual(shape(normalizeFallow(rawReport(fixture), { stripPrefix: null }).findings));
  });

  it('4. fs-diff: the exact run writes nothing under the root (no .fallow/ cache, no report, no log)', async () => {
    const root = await projectCopy();
    const before = await hashTree(root);
    expect(classifyFallowExit(await go(request(root)), 60).kind).toBe('completed');
    expect(await hashTree(root)).toEqual(before);
  });

  it('5. control: the same run WITHOUT --no-cache does write .fallow/, so the diff above can see writes', async () => {
    const root = await projectCopy();
    await go(request(root, ['--format', 'json', '--quiet', '--root', root]));
    expect(existsSync(join(root, '.fallow'))).toBe(true);
  });

  it('6. a root that does not exist exits 2 with fallow\'s error object: analyzer-error', async () => {
    const root = await projectCopy();
    const outcome = await go(request(root, FALLOW_RUN_ARGS(join(root, 'nope'))));
    expect(outcome).toMatchObject({ kind: 'exited', exitCode: 2 });
    expect(classifyFallowExit(outcome, 60)).toMatchObject({ kind: 'failed', code: 'analyzer-error' });
  });

  it('7. control: --fail-on-issues exits 1 on this project, and exit 1 with a report still completes', async () => {
    const root = await projectCopy();
    const outcome = await go(request(root, [...FALLOW_RUN_ARGS(root), '--fail-on-issues']));
    expect(outcome).toMatchObject({ kind: 'exited', exitCode: 1 });
    expect(classifyFallowExit(outcome, 60).kind).toBe('completed');
  });

  it('8. a 1 ms limit times the run out, and the process is gone', async () => {
    const root = await projectCopy();
    expect((await go(request(root, FALLOW_RUN_ARGS(root), { timeoutMs: 1 }))).kind).toBe('timed-out');
    expect(lastPidGone()).toBe(true);
  });

  it('9. a cancel right after the spawn cancels it, and the process is gone', async () => {
    const root = await projectCopy();
    const { token, cancel } = createCancellationToken();
    const done = runner.run(request(root), token);
    cancel();
    expect((await done).kind).toBe('cancelled');
    expect(lastPidGone()).toBe(true);
  });

  it('10. a 1,000-byte stdout cap stops it, and the process is gone', async () => {
    const root = await projectCopy();
    expect((await go(request(root, FALLOW_RUN_ARGS(root), { maxStdoutBytes: 1_000 }))).kind).toBe('stdout-too-large');
    expect(lastPidGone()).toBe(true);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/integration/fallow-analysis.test.ts tests/unit/fallow-argv-policy.test.ts`
Expected: FAIL — `Failed to resolve import "../fixtures/node-wrapped-port"`; the policy test fails on `pkg.scripts['test:fallow']` (undefined) and on `.fallow-bin/` missing from `.gitignore`.

Run: `npx vitest run --config vitest.fallow.config.ts`
Expected: FAIL — vitest cannot load `vitest.fallow.config.ts` (it does not exist yet).

- [ ] **Step 3: Implement.**

Create `tests/fixtures/node-wrapped-port.ts`:

```ts
// Part 7 Z38: runs every request of the REAL runner as `node fake-fallow.mjs --mode=<m> …`,
// the mode chosen per request (the probe or the run). `hold`, when given, is awaited before
// a run is forwarded, so a test can change the world while fallow "runs".
import { fileURLToPath } from 'node:url';
import type { AnalyzerProcessPort, ProcessRequest } from '../../src/application/ports/analyzer-process';

const FAKE = fileURLToPath(new URL('./fallow-runner/fake-fallow.mjs', import.meta.url));

export function nodeWrapped(
  runner: AnalyzerProcessPort, modeFor: (args: readonly string[]) => string, hold?: () => Promise<void>,
): AnalyzerProcessPort & { requests: ProcessRequest[] } {
  const requests: ProcessRequest[] = [];
  return {
    requests,
    async run(request, token) {
      requests.push(request);
      if (hold !== undefined && request.args[0] !== '--version') await hold();
      return runner.run({ ...request, executablePath: process.execPath, args: [FAKE, `--mode=${modeFor(request.args)}`, ...request.args] }, token);
    },
    killAll() { runner.killAll(); },
  };
}
```

Create `scripts/fetch-fallow.mjs`:

```js
// scripts/fetch-fallow.mjs — Part 7 Z40, for `npm run test:fallow` ONLY (never `npm run
// verify`, never a dependency). Puts the pinned fallow@3.27.0 and its platform package in
// the git-ignored .fallow-bin/, and writes the binary's path to .fallow-bin/bin-path.txt.
// FALLOW_BIN=<path> skips all of this and tests that binary instead. No shell: npm's own
// CLI runs under this Node, through npm_execpath.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '3.27.0';
const root = fileURLToPath(new URL('../', import.meta.url));
const dir = join(root, '.fallow-bin');
const fail = (message) => { console.error(`fetch-fallow: ${message}`); process.exit(1); };

function binaries() {
  const scope = join(dir, 'node_modules', '@fallow-cli');
  if (!existsSync(scope)) return [];
  return readdirSync(scope)
    .flatMap((pkg) => ['fallow', 'fallow.exe'].map((name) => join(scope, pkg, name)))
    .filter((path) => existsSync(path));
}

function installedVersion() {
  const pkg = join(dir, 'node_modules', 'fallow', 'package.json');
  return existsSync(pkg) ? JSON.parse(readFileSync(pkg, 'utf8')).version : null;
}

if (process.env.FALLOW_BIN) {
  console.log(`fetch-fallow: FALLOW_BIN=${process.env.FALLOW_BIN}; nothing fetched.`);
  process.exit(0);
}

if (installedVersion() !== VERSION || binaries().length === 0) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) fail('run it through `npm run test:fallow` (npm_execpath is not set).');
  mkdirSync(dir, { recursive: true });
  const result = spawnSync(process.execPath, [
    npmCli, 'install', `fallow@${VERSION}`, '--prefix', dir, '--no-save', '--no-package-lock', '--ignore-scripts', '--no-audit', '--no-fund',
  ], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) fail(`test:fallow needs network access once to fetch fallow@${VERSION} (npm exited ${result.status}).`);
}

const found = binaries();
if (found.length !== 1) fail(`expected exactly one fallow binary under .fallow-bin/node_modules/@fallow-cli, found ${found.length}.`);
writeFileSync(join(dir, 'bin-path.txt'), `${found[0]}\n`);
console.log(`fetch-fallow: fallow@${VERSION} at ${found[0]}`);
```

Create `vitest.fallow.config.ts`:

```ts
// Part 7 Z40: the opt-in real-fallow suite ONLY. `npm run test` never collects
// tests/fallow-real/ (vitest.config.ts's includes do not match it), and this config has
// no globalSetup, so it never builds dist/. See scripts/fetch-fallow.mjs.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const obsidianMock = fileURLToPath(new URL('./tests/mocks/obsidian.ts', import.meta.url));

export default defineConfig({
  resolve: { alias: { obsidian: obsidianMock } },
  test: { name: 'fallow-real', environment: 'node', include: ['tests/fallow-real/**/*.test.ts'], testTimeout: 60_000 },
});
```

In `package.json`, replace:

```json
    "test": "vitest run",
```

with:

```json
    "test": "vitest run",
    "test:fallow": "node scripts/fetch-fallow.mjs && vitest run --config vitest.fallow.config.ts",
```

In `.gitignore`, add a last line:

```
.fallow-bin/
```

In `eslint.config.mjs`, replace line 21:

```js
  { ignores: ['dist/**', 'docs/**', 'node_modules/**', 'package.json', '.obsidian/**', 'tests/fixtures/fallow/project/**'] },
```

with:

```js
  { ignores: ['dist/**', 'docs/**', 'node_modules/**', 'package.json', '.obsidian/**', 'tests/fixtures/fallow/project/**', '.fallow-bin/**'] },
```

In `.oxlintrc.json`, replace line 11:

```json
  "ignorePatterns": ["dist/**", "docs/**", "node_modules/**", "tests/fixtures/fallow/project/**"]
```

with:

```json
  "ignorePatterns": ["dist/**", "docs/**", "node_modules/**", "tests/fixtures/fallow/project/**", ".fallow-bin/**"]
```

- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/integration/fallow-analysis.test.ts tests/unit/fallow-argv-policy.test.ts`
Expected: PASS. The no-freeze test prints two `[no-freeze]` lines; paste them into the report.

Run: `npx vitest run --config vitest.fallow.config.ts`
Expected: exit 0 with the suite **skipped** ("fallow binary not fetched: run npm run test:fallow"): nothing is downloaded.

Run (Git Bash): `FALLOW_BIN="$LOCALAPPDATA/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe" npm run test:fallow`
Expected: `fetch-fallow: FALLOW_BIN=…; nothing fetched.`, then 10 passing tests, and the `[fallow-real]` line naming `fallow 3.27.0`. Paste the output into the report.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint tests/fixtures/node-wrapped-port.ts tests/integration/fallow-analysis.test.ts tests/unit/fallow-argv-policy.test.ts tests/fallow-real/fallow-real.test.ts scripts/fetch-fallow.mjs vitest.fallow.config.ts eslint.config.mjs --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add tests/fixtures/node-wrapped-port.ts tests/integration/fallow-analysis.test.ts tests/unit/fallow-argv-policy.test.ts tests/fallow-real/fallow-real.test.ts scripts/fetch-fallow.mjs vitest.fallow.config.ts package.json .gitignore eslint.config.mjs .oxlintrc.json
git commit -m "test(fallow): the real stack end to end, the argv policy, and the opt-in test:fallow against fallow 3.27.0 (Z38, Z40, Z41)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Run the covering tests.**

Run: `npx vitest run tests/integration/fallow-analysis.test.ts tests/unit/fallow-argv-policy.test.ts tests/contracts/fallow-runner.test.ts tests/unit/fallow-analysis-service.test.ts tests/integration/scan-lifecycle.test.ts`
Expected: PASS.

---

### Task 9: The analysis store, the run copy, and the host wiring: deps, CityView, commands, notices, onunload (Z24, Z28, Z34, Z35, Z36)

**Files:**
- Create: `src/ui/audit-copy/fallow-run.ts` (~200)
- Modify: `src/ui/inspector-copy.ts` (296 → 297): after line 296 (`export * from './audit-copy/fallow';`)
- Create: `src/ui/read-models/fallow-run.ts` (~75)
- Create: `src/ui/stores/analysis-store.ts` (~115)
- Modify: `src/ui/App.vue` (193 → 195): the repository watcher (lines 54–64) and the store imports
- Create: `src/host/analysis-notices.ts` (~30)
- Modify: `src/host/city-scan-controller.ts` (159 → 163): `CityViewDeps` (lines 21–36) and its imports
- Modify: `src/host/data-ports.ts` (36 → 49)
- Modify: `src/host/city-view.ts` (285 → ≈ 297): after `openReportImport` (line 125) and the imports (lines 38, 28)
- Modify: `src/host/commands.ts` (87 → ≈ 125): header (lines 1–3), import (line 17), two commands at the end
- Modify: `src/main.ts` (88 → ≈ 115)
- Modify: `scripts/assert-bundle.mjs` (80 → 90), `tests/unit/assert-bundle.test.ts` (61 → ~72)
- Create: `tests/fixtures/fake-fallow-analysis.ts` (~95); Modify: `tests/fixtures/data-port-deps.ts` (23 → 26)
- Modify: `tests/host/plugin-onload.test.ts` (220 → ~232): lines 64–71, 88–93, and a new case after line 128
- Modify: `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`: the `checkpoint4:commands` block (A2)
- Test: `tests/unit/fallow-run-copy.test.ts` (new, ~80), `tests/unit/fallow-run-read-model.test.ts` (new, ~90), `tests/unit/analysis-store.test.ts` (new, ~150), `tests/host/fallow-commands.test.ts` (new, ~110), `tests/host/analysis-notices.test.ts` (new, ~60), `tests/host/analysis-ports.test.ts` (new, ~55)

**Interfaces:**
- Consumes: Tasks 1–5 (`AnalysisRunState`, `IDLE`, `isActive`, `isCancellable`, `FallowAnalysisService`, `AnalyzerBindingView`, `AnalyzerBindingRead`, `RunReview`, `ReviewResult`, `StartOutcome`, `FallowRunErrorCode`, `FALLOW_RUN_ERROR_CODES`, `OPERATIONAL_FAILURES`, `ExecutableRefusal`, `ExecutableFormat`, `FALLOW_TESTED_VERSIONS`, `FALLOW_RUN_ARGS`, `FALLOW_VERSION_ARGS`, `FALLOW_ENV_ALLOW_LIST`, `AnalysisCoordinator`, `createFallowAnalysisService`); Tasks 2, 6, 7 (`createPluginDataAnalyzerStore`, `createExecutableInspector`, `createFallowRunner`); `FALLOW_MATCHED`, `FALLOW_SUPPORTED_TEXT`, `FALLOW_COMMAND_IMPORT` (`audit-copy/fallow.ts`); `formatAbsoluteTime` (`src/ui/copy.ts`); `rootFolderLabel` (`src/ui/read-models/root-label.ts`); `getOrCreateMachineId`; `createCancellationToken`; `CityView`, `wireDataPorts`, `unwireDataPorts`, `useCityStore().navigate`.
- Produces:
  - every string of the spec's §2 "New strings" table in `src/ui/audit-copy/fallow-run.ts`, as below (K26: `FALLOW_RUN_PROBING(hasEvidence)` and `FALLOW_RUN_RUNNING(folder, time, seconds, hasEvidence)`; K20: the two settings row names are literals in `setting-definitions.ts`, not constants; K35: `FALLOW_EXE_REFUSED_TEXT(encoded)`)
  - `read-models/fallow-run.ts`: `type InstalledRouteStart = { startAt: 'path' } | { startAt: 'review'; review: RunReview; reason: 'untrusted' | 'changed' }`; `interface FallowRunBanner { tone: 'info' | 'warning'; icon: string; text: string; reason: string | null; kept: boolean; log: string | null }`; `LOG_SHOWN_CHARS = 2000`; `fallowRunBannerOf(state, hasEvidence): FallowRunBanner | null`; `refusalBanner(code, detail): FallowRunBanner`; re-exports of the application types and `isActive`, `isCancellable`, `FALLOW_TESTED_VERSIONS`
  - `useAnalysisStore`: state `repositoryId`, `run`, `binding`, `runRequested`; getters `active`, `cancellable`; actions `setService(service)`, `bindRepository(id)`, `refreshBinding(): Promise<void>`, `requestRun()`, `consumeRunRequest(): boolean`, `review(snapshot, path): Promise<ReviewResult | null>`, `startOrReview(snapshot): Promise<StartOutcome | null>`, `trustAndRun(snapshot, review): Promise<StartOutcome | null>`, `cancel(): boolean`, `forget(): Promise<boolean>` (K39: `null` while unbound or for another codebase's snapshot)
  - `watchAnalysisFailures(service: Pick<FallowAnalysisService, 'subscribe' | 'stateOf'>, notify: (message: string) => void): () => void`
  - `CityViewDeps.fallowAnalysis: FallowAnalysisService`; `requestFallowRun(pinia: Pinia): void`; `CityView.requestFallowRun(): void`, `isAnalysisActive(): boolean`, `isAnalysisCancellable(): boolean`, `cancelAnalysis(): void`
  - commands `run-fallow-analysis` and `cancel-fallow-analysis`
  - tests: `createFakeFallowAnalysis(executableName?): FakeFallowAnalysis` (`calls`, `next`, `setState`, `setBinding`, `listenerCount`), `fakeRunReview(profileId, snapshotId, rootPath, overrides?)`, `HARNESS_EXECUTABLE`

- [ ] **Step 1: Write the failing tests.**

Create `tests/fixtures/fake-fallow-analysis.ts`:

```ts
// Part 7 Z28: a scriptable FallowAnalysisService for component, host and harness tests. It
// runs nothing: `next` says what each call answers, and `setState`/`setBinding` notify
// subscribers exactly as the real coordinator does.
import { IDLE, type AnalysisRunState } from '../../src/application/analysis/analysis-state';
import type { AnalyzerBindingRead } from '../../src/application/analysis/analyzer-record';
import type { FallowAnalysisService, ReviewResult, RunReview, StartOutcome } from '../../src/application/analysis/fallow-analysis-service';
import { FALLOW_ENV_ALLOW_LIST, FALLOW_RUN_ARGS, FALLOW_VERSION_ARGS } from '../../src/application/analysis/fallow-invocation';

export const HARNESS_EXECUTABLE = 'C:\\Tools\\fallow\\fallow.exe';

export function fakeRunReview(profileId: string, snapshotId: string, rootPath: string, overrides: Partial<RunReview> = {}): RunReview {
  return {
    profileId, snapshotId, rootPath,
    facts: { executablePath: HARNESS_EXECUTABLE, realPath: HARNESS_EXECUTABLE, size: 12_400_000, mtimeMs: Date.UTC(2026, 8, 20, 9, 30), format: 'pe', insideRoot: false },
    args: FALLOW_RUN_ARGS(rootPath), versionArgs: FALLOW_VERSION_ARGS, envNames: FALLOW_ENV_ALLOW_LIST,
    timeoutSeconds: 120, trustedVersion: null, subjectFingerprint: '0a1b2c3d', ...overrides,
  };
}

export interface FakeFallowAnalysis extends FallowAnalysisService {
  readonly calls: { method: string; profileId: string }[];
  next: { run: StartOutcome; trustAndRun: StartOutcome; review: ReviewResult | null; forget: 'forgotten' | 'busy'; setTimeLimit: 'saved' | 'invalid' };
  setState(profileId: string, state: AnalysisRunState): void;
  setBinding(profileId: string, read: AnalyzerBindingRead): void;
  listenerCount(): number;
}

export function createFakeFallowAnalysis(executableName: 'fallow.exe' | 'fallow' = 'fallow.exe'): FakeFallowAnalysis {
  const states = new Map<string, AnalysisRunState>();
  const bindings = new Map<string, AnalyzerBindingRead>();
  const listeners = new Set<(profileId: string) => void>();
  const calls: { method: string; profileId: string }[] = [];
  const notify = (profileId: string): void => { for (const listener of Array.from(listeners)) listener(profileId); };
  const call = (method: string, profileId: string): void => { calls.push({ method, profileId }); };
  const fake: FakeFallowAnalysis = {
    calls,
    next: { run: { kind: 'started' }, trustAndRun: { kind: 'started' }, review: null, forget: 'forgotten', setTimeLimit: 'saved' },
    setState(profileId, state) { states.set(profileId, state); notify(profileId); },
    setBinding(profileId, read) { bindings.set(profileId, read); notify(profileId); },
    listenerCount: () => listeners.size,
    readBinding(profileId) {
      call('readBinding', profileId);
      return Promise.resolve({ ...(bindings.get(profileId) ?? { kind: 'none' }), executableName });
    },
    review(profileId, snapshot, executablePath) {
      call('review', profileId);
      const path = executablePath.trim();
      const base = fakeRunReview(profileId, snapshot.snapshotId, snapshot.scope.rootPath);
      return Promise.resolve(fake.next.review ?? { ok: true, review: { ...base, facts: { ...base.facts, executablePath: path, realPath: path } } });
    },
    checkTrust(profileId) { call('checkTrust', profileId); return Promise.resolve({ kind: 'trusted' }); },
    run(profileId) { call('run', profileId); return Promise.resolve(fake.next.run); },
    trustAndRun(profileId) { call('trustAndRun', profileId); return Promise.resolve(fake.next.trustAndRun); },
    cancel(profileId) { call('cancel', profileId); },
    forget(profileId) { call('forget', profileId); return Promise.resolve(fake.next.forget); },
    setTimeLimit(profileId) { call('setTimeLimit', profileId); return Promise.resolve(fake.next.setTimeLimit); },
    purgeProfile(profileId) { call('purgeProfile', profileId); return Promise.resolve(); },
    stateOf: (profileId) => states.get(profileId) ?? IDLE,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    shutdown() { call('shutdown', ''); },
  };
  return fake;
}
```

In `tests/fixtures/data-port-deps.ts`, replace:

```ts
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';

export function dataPortDeps(): Pick<CityViewDeps, 'reviewRepositoryFor' | 'evidenceStore'> {
```

with:

```ts
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { createFakeFallowAnalysis } from './fake-fallow-analysis';

export function dataPortDeps(): Pick<CityViewDeps, 'reviewRepositoryFor' | 'evidenceStore' | 'fallowAnalysis'> {
```

and replace:

```ts
    evidenceStore: new InMemoryEvidenceStore(),
```

with:

```ts
    evidenceStore: new InMemoryEvidenceStore(),
    // Part 7 Z28 (Task 9): the fallow analysis service, scripted; it runs nothing.
    fallowAnalysis: createFakeFallowAnalysis(),
```

Create `tests/unit/fallow-run-copy.test.ts`:

```ts
// Part 7 §2: the run copy. COPY-15 is pinned against its own catalogue row (the microcopy
// contract sweeps copy.ts only, K43); every run error code has a message; refusals decode;
// and G6's "Do not claim an OS sandbox": the only copy that says "sandbox" says it is not one.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FALLOW_RUN_ERROR_CODES } from '../../src/application/analysis/fallow-run-errors';
import {
  COPY_15, FALLOW_EXE_REFUSED_TEXT, FALLOW_REVIEW_EFFECTS, FALLOW_RUN_ERROR, FALLOW_RUN_PROBING, FALLOW_RUN_RUNNING,
} from '../../src/ui/inspector-copy';

const REPO = fileURLToPath(new URL('../../', import.meta.url));

describe('run copy (spec §2)', () => {
  it('COPY-15 is the catalogue row, with the provider substituted', () => {
    const catalogue = readFileSync(join(REPO, 'docs', 'concept', 'design', 'interactions', '04-microcopy.md'), 'utf8');
    const row = catalogue.split('\n').find((line) => line.startsWith('| COPY-15 |'));
    expect(row).toBeDefined();
    const text = row!.split('|')[3]!.trim();
    expect(COPY_15('fallow')).toBe(text.replace('{provider}', 'fallow'));
  });

  it('has a message for every run error code', () => {
    expect(Object.keys(FALLOW_RUN_ERROR).sort()).toEqual([...FALLOW_RUN_ERROR_CODES].sort());
    for (const code of FALLOW_RUN_ERROR_CODES) expect(FALLOW_RUN_ERROR[code]('x').length, code).toBeGreaterThan(10);
  });

  it('decodes an executable refusal and its detail (K35)', () => {
    expect(FALLOW_EXE_REFUSED_TEXT('wrong-name:fallow.exe')).toBe('That file is not named fallow.exe. Choose the native fallow executable.');
    expect(FALLOW_EXE_REFUSED_TEXT('unreadable:EACCES')).toBe('Could not read that file’s details (EACCES).');
    expect(FALLOW_EXE_REFUSED_TEXT('not-native')).toBe('That file is not a native executable for this computer. Choose the fallow binary built for this system.');
    expect(FALLOW_RUN_ERROR['executable-refused']('launcher:fallow.exe')).toContain('launcher script');
  });

  it('says current findings stay only when there are some (K26)', () => {
    expect(FALLOW_RUN_PROBING(true)).toBe('Checking the fallow version… Current findings stay available.');
    expect(FALLOW_RUN_PROBING(false)).toBe('Checking the fallow version…');
    expect(FALLOW_RUN_RUNNING('project', '23 Sept 2026, 10:00', 120, true))
      .toBe('fallow is analysing “project”. Started 23 Sept 2026, 10:00; it is stopped after 120 seconds. Current findings stay until it finishes.');
    expect(FALLOW_RUN_RUNNING('project', 'now', 120, false)).toBe('fallow is analysing “project”. Started now; it is stopped after 120 seconds.');
  });

  it('names the version-probe details in words', () => {
    expect(FALLOW_RUN_ERROR['version-probe-failed']('timeout')).toBe('fallow did not report its version within 5 seconds. Nothing was analysed.');
    expect(FALLOW_RUN_ERROR['version-probe-failed']('no-version')).toBe('That file did not report a fallow version. Nothing was analysed.');
    expect(FALLOW_RUN_ERROR['version-probe-failed']('3')).toBe('fallow’s version check ended with exit code 3. Nothing was analysed.');
    expect(FALLOW_RUN_ERROR['version-probe-failed']('SIGSEGV')).toBe('fallow’s version check ended unexpectedly (SIGSEGV). Nothing was analysed.');
    expect(FALLOW_RUN_ERROR['exit-code']('3')).toBe('fallow ended unexpectedly with exit code 3.');
    expect(FALLOW_RUN_ERROR['output-too-large']('')).toBe('fallow’s output was larger than 16 MB, so it was stopped and nothing was read.');
  });

  it('G6: no copy claims a sandbox; the one mention says it is not one', () => {
    const dir = join(REPO, 'src', 'ui', 'audit-copy');
    const lines = readdirSync(dir).flatMap((name) => readFileSync(join(dir, name), 'utf8').split('\n')).filter((l) => /sandbox/i.test(l));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('This is not a sandbox');
    expect(FALLOW_REVIEW_EFFECTS[3]).toBe('Runs with your user account’s permissions. This is not a sandbox: the executable can read and change anything your account can.');
  });
});
```

Create `tests/unit/fallow-run-read-model.test.ts`:

```ts
// Part 7 Z33: the run banner as pure data, one row per state; a failure keeps its log tail.
import { describe, expect, it } from 'vitest';
import type { AnalysisIdentity } from '../../src/application/analysis/analysis-state';
import { LOG_SHOWN_CHARS, fallowRunBannerOf, refusalBanner } from '../../src/ui/read-models/fallow-run';
import { formatAbsoluteTime } from '../../src/ui/copy';
import {
  COPY_15, FALLOW_RUN_CANCELLED, FALLOW_RUN_CANCELLING, FALLOW_RUN_COMPLETED, FALLOW_RUN_ERROR, FALLOW_RUN_PROBING, FALLOW_RUN_RUNNING,
} from '../../src/ui/inspector-copy';

const ID: AnalysisIdentity = { profileId: 'p1', snapshotId: 's1', rootFingerprint: 'a', subjectFingerprint: 'b', runId: 'r1', generation: 0 };
const AT = '2026-09-23T10:00:00.000Z';
const info = (icon: string, text: string) => ({ tone: 'info', icon, text, reason: null, kept: false, log: null });

describe('fallowRunBannerOf (Z33)', () => {
  it('shows nothing while idle', () => {
    expect(fallowRunBannerOf({ status: 'idle' }, true)).toBeNull();
  });

  it('probing, running and cancelling are info with a loader; the folder is the root\'s last segment', () => {
    expect(fallowRunBannerOf({ status: 'probing', identity: ID, rootPath: '/work/my repo', startedAt: AT, timeoutSeconds: 120 }, true))
      .toEqual(info('loader', FALLOW_RUN_PROBING(true)));
    expect(fallowRunBannerOf({ status: 'running', identity: ID, rootPath: '/work/my repo', startedAt: AT, timeoutSeconds: 300, version: '3.27.0', tested: true }, false))
      .toEqual(info('loader', FALLOW_RUN_RUNNING('my repo', formatAbsoluteTime(AT, Intl), 300, false)));
    expect(fallowRunBannerOf({ status: 'cancelling', identity: ID }, true)).toEqual(info('loader', FALLOW_RUN_CANCELLING));
  });

  it('cancelled and completed are info', () => {
    expect(fallowRunBannerOf({ status: 'cancelled', runId: 'r1' }, true)).toEqual(info('circle-slash', FALLOW_RUN_CANCELLED));
    expect(fallowRunBannerOf({ status: 'completed', runId: 'r1', finishedAt: AT, version: '3.27.0', tested: true, matchedFindings: 5, matchedFiles: 4 }, true))
      .toEqual(info('check', FALLOW_RUN_COMPLETED(5, 4)));
  });

  it('a failure is a warning with COPY-15, its reason, whether evidence was kept, and the log tail', () => {
    const log = `${'x'.repeat(3000)}last`;
    expect(fallowRunBannerOf({ status: 'failed', runId: 'r1', code: 'timed-out', detail: '120', logExcerpt: log, evidenceKept: true, finishedAt: AT }, true)).toEqual({
      tone: 'warning', icon: 'alert-triangle', text: COPY_15('fallow'), reason: FALLOW_RUN_ERROR['timed-out']('120'), kept: true, log: log.slice(-LOG_SHOWN_CHARS),
    });
    expect(fallowRunBannerOf({ status: 'failed', runId: 'r1', code: 'exit-code', detail: '3', logExcerpt: '', evidenceKept: false, finishedAt: AT }, false))
      .toMatchObject({ kept: false, log: null });
  });

  it('a refused start is the failed form without a log', () => {
    expect(refusalBanner('root-unavailable', '')).toEqual({
      tone: 'warning', icon: 'alert-triangle', text: COPY_15('fallow'), reason: FALLOW_RUN_ERROR['root-unavailable'](''), kept: false, log: null,
    });
  });
});
```

Create `tests/unit/analysis-store.test.ts`:

```ts
// Part 7 Z28: the per-leaf analysis store mirrors the plugin's service for the bound
// codebase only, reads its binding, carries the command's run request, and drops its
// subscription when the leaf goes.
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import type { AnalysisIdentity } from '../../src/application/analysis/analysis-state';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { createFakeFallowAnalysis, fakeRunReview } from '../fixtures/fake-fallow-analysis';

const ID: AnalysisIdentity = { profileId: 'p1', snapshotId: 's1', rootFingerprint: 'a', subjectFingerprint: 'b', runId: 'r1', generation: 0 };
const RUNNING = { status: 'running', identity: ID, rootPath: '/repo', startedAt: '2026-09-23T10:00:00.000Z', timeoutSeconds: 120, version: '3.27.0', tested: true } as const;
const SNAP = buildSnapshotFixture({ files: 3, repositoryId: 'p1' });

beforeEach(() => { setActivePinia(createPinia()); });

describe('useAnalysisStore (Z28)', () => {
  it('mirrors the bound codebase\'s run and ignores every other codebase', () => {
    const fake = createFakeFallowAnalysis();
    const store = useAnalysisStore();
    store.setService(fake);
    store.bindRepository('p1');
    fake.setState('p2', RUNNING);
    expect(store.run.status).toBe('idle');
    fake.setState('p1', RUNNING);
    expect(store.run).toEqual(RUNNING);
    expect([store.active, store.cancellable]).toEqual([true, true]);
    fake.setState('p1', { status: 'cancelling', identity: ID });
    expect([store.active, store.cancellable]).toEqual([true, false]);
  });

  it('reads the binding on bind and after each notification; a late read for the previous codebase is dropped', async () => {
    const fake = createFakeFallowAnalysis('fallow');
    fake.setBinding('p1', { kind: 'bound', binding: { profileId: 'p1', executablePath: '/opt/fallow', timeoutSeconds: 120, trust: null } });
    const store = useAnalysisStore();
    store.setService(fake);
    store.bindRepository('p1');
    store.bindRepository('p2');
    await flushPromises();
    expect(store.binding).toEqual({ kind: 'none', executableName: 'fallow' });
    store.bindRepository('p1');
    await flushPromises();
    expect(store.binding).toMatchObject({ kind: 'bound', executableName: 'fallow' });
  });

  it('carries a run request once; a rebind drops it', () => {
    const store = useAnalysisStore();
    store.setService(createFakeFallowAnalysis());
    store.bindRepository('p1');
    store.requestRun();
    expect(store.consumeRunRequest()).toBe(true);
    expect(store.consumeRunRequest()).toBe(false);
    store.requestRun();
    store.bindRepository('p2');
    expect(store.runRequested).toBe(false);
  });

  it('forwards start, review and Trust and run for its own codebase, and answers null otherwise (K39)', async () => {
    const fake = createFakeFallowAnalysis();
    const store = useAnalysisStore();
    store.setService(fake);
    expect(await store.startOrReview(SNAP)).toBeNull();
    store.bindRepository('p1');
    fake.next.run = { kind: 'busy' };
    expect(await store.startOrReview(SNAP)).toEqual({ kind: 'busy' });
    expect(await store.startOrReview(buildSnapshotFixture({ files: 1, repositoryId: 'other' }))).toBeNull();
    expect(await store.review(SNAP, '/opt/fallow')).toMatchObject({ ok: true });
    expect(await store.trustAndRun(SNAP, fakeRunReview('p1', SNAP.snapshotId, SNAP.scope.rootPath))).toEqual({ kind: 'started' });
    expect(fake.calls.map((c) => c.method)).toEqual(expect.arrayContaining(['run', 'review', 'trustAndRun']));
  });

  it('cancels only a cancellable run; forget reports whether it happened', async () => {
    const fake = createFakeFallowAnalysis();
    const store = useAnalysisStore();
    store.setService(fake);
    store.bindRepository('p1');
    expect(store.cancel()).toBe(false);
    fake.setState('p1', RUNNING);
    expect(store.cancel()).toBe(true);
    expect(fake.calls.filter((c) => c.method === 'cancel')).toEqual([{ method: 'cancel', profileId: 'p1' }]);
    fake.next.forget = 'busy';
    expect(await store.forget()).toBe(false);
    fake.next.forget = 'forgotten';
    fake.setState('p1', { status: 'idle' });
    expect(await store.forget()).toBe(true);
  });

  it('$dispose drops its subscription to the plugin-level service', () => {
    const fake = createFakeFallowAnalysis();
    const store = useAnalysisStore();
    store.setService(fake);
    store.bindRepository('p1');
    expect(fake.listenerCount()).toBe(1);
    store.$dispose();
    expect(fake.listenerCount()).toBe(0);
  });
});
```

Create `tests/host/fallow-commands.test.ts`:

```ts
// Part 7 Z35: "Run fallow analysis" is offered only with a snapshot and no analysis in
// flight, and its body only raises a request; "Cancel fallow analysis" only while probing or
// running (M36's rule). A new file: commands.test.ts keeps the Part 1–6 commands.
import { describe, expect, it, vi } from 'vitest';
import { registerCommands } from '../../src/host/commands';

interface AddedCommand { id: string; name?: string; checkCallback?: (checking: boolean) => boolean }
interface ViewDouble {
  hasSnapshot: () => boolean; isAnalysisActive: () => boolean; isAnalysisCancellable: () => boolean;
  requestFallowRun: ReturnType<typeof vi.fn>; cancelAnalysis: ReturnType<typeof vi.fn>;
}
const view = (snapshot: boolean, active: boolean, cancellable: boolean): ViewDouble => ({
  hasSnapshot: () => snapshot, isAnalysisActive: () => active, isAnalysisCancellable: () => cancellable,
  requestFallowRun: vi.fn(), cancelAnalysis: vi.fn(),
});
function commandFor(id: string, activeView: object | null): AddedCommand {
  const addCommand = vi.fn();
  registerCommands({ app: { workspace: { getActiveViewOfType: vi.fn(() => activeView) } }, addCommand } as never);
  const found = (addCommand.mock.calls as [AddedCommand][]).find(([c]) => c.id === id);
  if (!found) throw new Error(`test setup: no command "${id}"`);
  return found[0];
}

describe('run-fallow-analysis (Z35)', () => {
  it('is named "Run fallow analysis"', () => {
    expect(commandFor('run-fallow-analysis', null).name).toBe('Run fallow analysis');
  });

  it('is hidden without a city view, without a snapshot, or while an analysis is in flight', () => {
    expect(commandFor('run-fallow-analysis', null).checkCallback!(true)).toBe(false);
    expect(commandFor('run-fallow-analysis', view(false, false, false)).checkCallback!(true)).toBe(false);
    expect(commandFor('run-fallow-analysis', view(true, true, false)).checkCallback!(true)).toBe(false);
  });

  it('is offered with a snapshot and nothing in flight, and only raises the request when invoked', () => {
    const v = view(true, false, false);
    const command = commandFor('run-fallow-analysis', v);
    expect(command.checkCallback!(true)).toBe(true);
    expect(v.requestFallowRun).not.toHaveBeenCalled();
    expect(command.checkCallback!(false)).toBe(true);
    expect(v.requestFallowRun).toHaveBeenCalledTimes(1);
  });
});

describe('cancel-fallow-analysis (Z35, M36)', () => {
  it('is named "Cancel fallow analysis" and hidden unless the analysis is probing or running', () => {
    expect(commandFor('cancel-fallow-analysis', null).name).toBe('Cancel fallow analysis');
    expect(commandFor('cancel-fallow-analysis', null).checkCallback!(true)).toBe(false);
    expect(commandFor('cancel-fallow-analysis', view(true, true, false)).checkCallback!(true)).toBe(false);
  });

  it('cancels when invoked while cancellable', () => {
    const v = view(true, true, true);
    const command = commandFor('cancel-fallow-analysis', v);
    expect(command.checkCallback!(true)).toBe(true);
    expect(v.cancelAnalysis).not.toHaveBeenCalled();
    command.checkCallback!(false);
    expect(v.cancelAnalysis).toHaveBeenCalledTimes(1);
  });
});
```

Create `tests/host/analysis-notices.test.ts`:

```ts
// Part 7 Z34: one Notice per failed run, for operational failures and a changed version only.
import { describe, expect, it, vi } from 'vitest';
import { watchAnalysisFailures } from '../../src/host/analysis-notices';
import { FALLOW_RUN_ERROR, FALLOW_RUN_NOTICE } from '../../src/ui/inspector-copy';
import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

const failed = (runId: string, code: 'timed-out' | 'version-changed' | 'snapshot-changed' | 'superseded') =>
  ({ status: 'failed', runId, code, detail: '120', logExcerpt: '', evidenceKept: false, finishedAt: '2026-09-23T10:00:00.000Z' }) as const;

describe('watchAnalysisFailures (Z34)', () => {
  it('notifies once per failed run, with COPY-15 and the reason', () => {
    const fake = createFakeFallowAnalysis();
    const notify = vi.fn();
    watchAnalysisFailures(fake, notify);
    fake.setState('p1', failed('r1', 'timed-out'));
    fake.setState('p1', failed('r1', 'timed-out'));
    expect(notify.mock.calls).toEqual([[FALLOW_RUN_NOTICE(FALLOW_RUN_ERROR['timed-out']('120'))]]);
    fake.setState('p1', failed('r2', 'version-changed'));
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('stays quiet for a discarded run, a completion or a cancel, and after unwatching', () => {
    const fake = createFakeFallowAnalysis();
    const notify = vi.fn();
    const stop = watchAnalysisFailures(fake, notify);
    fake.setState('p1', failed('r1', 'snapshot-changed'));
    fake.setState('p1', failed('r2', 'superseded'));
    fake.setState('p1', { status: 'cancelled', runId: 'r3' });
    stop();
    fake.setState('p1', failed('r4', 'timed-out'));
    expect(notify).not.toHaveBeenCalled();
  });
});
```

Create `tests/host/analysis-ports.test.ts`:

```ts
// Part 7 Z28: wireDataPorts hands a leaf's analysis store the plugin's service before
// mount, unwireDataPorts drops its subscription, and requestFallowRun is the command body.
import { describe, expect, it } from 'vitest';
import { createPinia } from 'pinia';
import { requestFallowRun, unwireDataPorts, wireDataPorts } from '../../src/host/data-ports';
import type { CityViewDeps } from '../../src/host/city-view';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import { useCityStore } from '../../src/ui/stores/city-store';
import { dataPortDeps } from '../fixtures/data-port-deps';
import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

describe('the analysis port (Z28)', () => {
  it('is wired before mount and unwired on close', () => {
    const fake = createFakeFallowAnalysis();
    const pinia = createPinia();
    wireDataPorts(pinia, { ...dataPortDeps(), fallowAnalysis: fake } as CityViewDeps);
    useAnalysisStore(pinia).bindRepository('p1');
    expect(fake.listenerCount()).toBe(1);
    unwireDataPorts(pinia);
    expect(fake.listenerCount()).toBe(0);
  });

  it('requestFallowRun opens Data & scans and raises the run request', () => {
    const pinia = createPinia();
    wireDataPorts(pinia, dataPortDeps() as CityViewDeps);
    useAnalysisStore(pinia).bindRepository('p1');
    requestFallowRun(pinia);
    expect(useCityStore(pinia).route).toBe('sources');
    expect(useAnalysisStore(pinia).runRequested).toBe(true);
  });
});
```

In `tests/host/plugin-onload.test.ts`, replace:

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

with:

```ts
  it('registers the city view, the ribbon icon and six commands, and nothing else', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.registerView).toHaveBeenCalledWith(CITY_VIEW_TYPE, expect.any(Function));
    expect(p.addRibbonIcon).toHaveBeenCalledTimes(1);
    expect(p.addCommand.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id).sort())
      .toEqual(['cancel-fallow-analysis', 'cancel-scan', 'import-analysis-report', 'open-city', 'run-fallow-analysis', 'scan-codebase']);
  });
```

replace:

```ts
    // Part 6 Y39: the fourth, import-analysis-report, is implemented; "Run fallow analysis" is Part 7.
    expect(p.addCommand).toHaveBeenCalledTimes(4);
```

with:

```ts
    // Part 6 Y39 and Part 7 Z35: import, run and cancel an analysis are all implemented.
    expect(p.addCommand).toHaveBeenCalledTimes(6);
```

and after the test `'never detaches leaves in onunload'` add:

```ts
  it('Part 7 Z24: onunload shuts the fallow analysis down once, synchronously', () => {
    const p = makePluginDouble();
    p.onload();
    const analysis = (p as unknown as { analysis: { shutdown(): void } }).analysis;
    const shutdown = vi.spyOn(analysis, 'shutdown');
    expect(p.onunload()).toBeUndefined();
    p.onunload();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });
```

In `tests/unit/assert-bundle.test.ts`, replace:

```ts
const CLEAN_MAIN = 'Object.defineProperty(exports, "__esModule", { value: true });\nexports.default = X;\n';
```

with:

```ts
// Part 7 Z38 (K23): a real bundle names node:child_process exactly once, in node-process-access.ts's window.require.
const CLEAN_MAIN = 'Object.defineProperty(exports, "__esModule", { value: true });\nexports.default = X;\nwindow.require("node:child_process");\n';
```

and before the file's last `});` add:

```ts
  it('Part 7 Z38: refuses a bundle that names node:child_process other than once, in window.require', () => {
    const none = runAgainst('Object.defineProperty(exports, "__esModule", { value: true });\nexports.default = X;\n');
    expect(none.stderr).toContain('must name node:child_process exactly once');
    expect(none.status).toBe(1);
    const twice = runAgainst(`${CLEAN_MAIN}const s = "node:child_process";\n`);
    expect(twice.stderr).toContain('must name node:child_process exactly once');
    expect(twice.status).toBe(1);
  });
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/unit/fallow-run-copy.test.ts tests/unit/fallow-run-read-model.test.ts tests/unit/analysis-store.test.ts tests/host/fallow-commands.test.ts tests/host/analysis-notices.test.ts tests/host/analysis-ports.test.ts tests/host/plugin-onload.test.ts tests/unit/assert-bundle.test.ts`
Expected: FAIL — unresolved imports (`analysis-store`, `read-models/fallow-run`, `analysis-notices`), `COPY_15` not exported, no `run-fallow-analysis` command, onload registers four commands, and the assert-bundle refusal case passes a bundle it should reject.

- [ ] **Step 3: Implement.**

Create `src/ui/audit-copy/fallow-run.ts`:

```ts
// Part 7 (spec §2): every new string for running an installed fallow. Re-exported by
// inspector-copy.ts. House style: plain sentences, "fallow" lower-case, no exclamation
// marks, and each failure says what stays usable. Every value from a process, a file or
// data.json is interpolated as text only.
import type { ExecutableFormat, ExecutableRefusal } from '../../application/ports/executable-inspector';
import type { FallowRunErrorCode } from '../../application/analysis/fallow-run-errors';
import { FALLOW_REPORT_MAX_BYTES } from '../../application/evidence/raw-fallow';
import { FALLOW_MATCHED, FALLOW_SUPPORTED_TEXT } from './fallow';

const MAX_SIZE_TEXT = `${FALLOW_REPORT_MAX_BYTES / (1024 * 1024)} MB`;
const NUMBER = /^-?\d+$/;

export const FALLOW_COMMAND_RUN = 'Run fallow analysis';
export const FALLOW_COMMAND_CANCEL = 'Cancel fallow analysis';

/* The S14 dialog: the two routes (Z29). */
export const FALLOW_ROUTE_IMPORT_TITLE = 'Import a report';
export const FALLOW_ROUTE_IMPORT_TEXT = 'Choose a fallow JSON report you already have. It is checked and matched to this snapshot; nothing is run.';
export const FALLOW_ROUTE_RUN_TITLE = 'Run installed fallow';
export const FALLOW_ROUTE_RUN_TEXT = 'Run a fallow executable that is already installed on this computer, on this codebase’s folder. You see exactly what will run, and trust it, before anything starts.';
export const FALLOW_ROUTE_RUN_ACTION = 'Use installed fallow…';
export const FALLOW_INSTALL_NOTE = 'Install fallow yourself, outside Obsidian. The plugin never downloads, installs or updates it.';

/* The installed route: the path step (Z30). */
export const FALLOW_EXE_LABEL = 'Path to the fallow executable';
export const FALLOW_EXE_HINT_WINDOWS = 'The full path to the native fallow.exe, for example C:\\Tools\\fallow\\fallow.exe. npm launchers such as fallow.cmd or fallow.ps1 are not accepted.';
export const FALLOW_EXE_HINT_POSIX = 'The full path to the native fallow binary, for example /usr/local/bin/fallow. npm launcher scripts are not accepted.';
export const FALLOW_EXE_CHECK = 'Check executable';
export const FALLOW_EXE_REFUSED: Readonly<Record<ExecutableRefusal, (detail: string) => string>> = {
  'not-absolute': () => 'Enter the full path, starting from the drive or the root folder.',
  'wrong-name': (name) => `That file is not named ${name}. Choose the native fallow executable.`,
  launcher: () => 'That is a launcher script, not the native fallow executable. npm keeps the native binary in its @fallow-cli package folder; choose that file instead.',
  'executable-missing': () => 'No file exists at that path. Check the path, or install fallow first.',
  'not-a-file': () => 'That path is a folder, not the fallow executable.',
  'not-native': () => 'That file is not a native executable for this computer. Choose the fallow binary built for this system.',
  unreadable: (code) => `Could not read that file’s details (${code}).`,
};
/** K35: the service encodes a refusal as `refusal[:detail]`. An unknown refusal reads as not-native. */
export function FALLOW_EXE_REFUSED_TEXT(encoded: string): string {
  const at = encoded.indexOf(':');
  const refusal = at < 0 ? encoded : encoded.slice(0, at);
  const detail = at < 0 ? '' : encoded.slice(at + 1);
  const text = Object.prototype.hasOwnProperty.call(FALLOW_EXE_REFUSED, refusal) ? FALLOW_EXE_REFUSED[refusal as ExecutableRefusal] : undefined;
  return (text ?? FALLOW_EXE_REFUSED['not-native'])(detail);
}

/* The installed route: the review (Z31). */
export const FALLOW_REVIEW_TITLE_RUN = 'Review what will run';
export const FALLOW_REVIEW_ROW_EXECUTABLE = 'Executable';
export const FALLOW_REVIEW_ROW_SIZE = 'Size';
export const FALLOW_REVIEW_ROW_MODIFIED = 'Modified';
export const FALLOW_REVIEW_ROW_FORMAT = 'Format';
export const FALLOW_REVIEW_ROW_FOLDER = 'Folder analysed';
export const FALLOW_REVIEW_ROW_CWD = 'Runs in';
export const FALLOW_REVIEW_ROW_ARGS = 'Arguments';
export const FALLOW_REVIEW_ROW_ENV = 'Environment';
export const FALLOW_REVIEW_ROW_LIMIT = 'Time limit';
export const FALLOW_REVIEW_ROW_VERSION = 'Version';
export const FALLOW_FORMAT_LABEL: Readonly<Record<ExecutableFormat, string>> = {
  pe: 'Windows executable (PE)', elf: 'Linux executable (ELF)', 'mach-o': 'macOS executable (Mach-O)',
};
export const FALLOW_REVIEW_ENV = 'Only PATH, SystemRoot, TEMP, TMP, TMPDIR, HOME, USERPROFILE and LOCALAPPDATA are passed on, plus NO_COLOR=1. FALLOW_* settings and NODE_OPTIONS are not.';
export const FALLOW_REVIEW_LIMIT = (seconds: number): string => `Stopped after ${seconds} seconds. Change it in Obsidian’s settings for Codebase Inspector.`;
export const FALLOW_REVIEW_VERSION_PENDING = 'Checked after you trust it: fallow runs once with --version, for at most 5 seconds.';
export const FALLOW_REVIEW_VERSION_KNOWN = (version: string, tested: boolean): string =>
  `You trusted fallow ${version}${tested ? '' : ' (untested version)'}. It is checked again before the run.`;
export const FALLOW_REVIEW_EFFECTS_TITLE = 'What running it does';
export const FALLOW_REVIEW_EFFECTS: readonly string[] = [
  'Writes nothing to the folder: --no-cache turns fallow’s cache off. Checked with fallow 3.27.0.',
  'Reads every file in the folder, including paths your scan excludes, and may read its git history.',
  'Follows fallow configuration files in the folder, such as .fallowrc.json. Remote configuration is never fetched.',
  'Runs with your user account’s permissions. This is not a sandbox: the executable can read and change anything your account can.',
];
export const FALLOW_REVIEW_INSIDE_ROOT = 'This executable is inside the codebase you are analysing. Running it runs code from that repository. Trust it only if you trust the repository.';
export const FALLOW_REVIEW_RETRUST = 'Something you trusted has changed: the executable, the folder or the arguments. Review it again before it runs.';
export const FALLOW_CHANGE_PATH = 'Change path';
export const FALLOW_TRUST_AND_RUN = 'Trust and run';

/* The Data & scans card (Z32). */
export const FALLOW_RUN_ACTION = 'Run fallow analysis';
export const FALLOW_RUN_CANCEL = 'Cancel analysis';
export const FALLOW_EXE_CHOOSE = 'Choose executable…';
export const FALLOW_EXE_CHANGE = 'Change executable…';
export const FALLOW_EXE_FORGET = 'Forget executable';
export const FALLOW_EXE_FORGOTTEN = 'fallow executable forgotten for this codebase. It runs again only after you choose and trust one.';
export const FALLOW_ROW_EXECUTABLE = 'Executable';
export const FALLOW_ROW_TRUST = 'Trust';
export const FALLOW_ROW_LIMIT = 'Time limit';
export const FALLOW_LIMIT_VALUE = (seconds: number): string => `${seconds} seconds`;
export const FALLOW_TRUST_VALUE = (version: string | null, tested: boolean): string =>
  (version === null ? 'Not trusted yet. You review it before the first run.' : `Trusted for this codebase · fallow ${version}${tested ? '' : ' (untested version)'}`);
export const FALLOW_EXE_NONE = 'No executable chosen. Import a report, or choose an installed fallow to run.';
export const FALLOW_EXE_OTHER_DEVICE = 'The executable was chosen on another device. Choose it again on this one.';
export const FALLOW_EXE_INVALID = 'This codebase’s executable setting could not be read. Choose the executable again.';
export const FALLOW_EXE_UNSUPPORTED = 'This codebase’s executable setting was saved by a newer version of the plugin. It is kept unchanged and cannot be used here.';
export const FALLOW_RUN_HINT = 'Open a codebase first: fallow runs on the folder of the codebase on screen.';
export const FALLOW_RUN_BUSY_HINT = 'Wait for the fallow analysis to finish, or cancel it.';

/* The run banner (Z33). K26: "current findings stay" is said only when there are some. */
export const FALLOW_RUN_PROBING = (hasEvidence: boolean): string =>
  `Checking the fallow version…${hasEvidence ? ' Current findings stay available.' : ''}`;
export const FALLOW_RUN_RUNNING = (folder: string, time: string, seconds: number, hasEvidence: boolean): string =>
  `fallow is analysing “${folder}”. Started ${time}; it is stopped after ${seconds} seconds.${hasEvidence ? ' Current findings stay until it finishes.' : ''}`;
export const FALLOW_RUN_CANCELLING = 'Cancelling the fallow analysis…';
export const FALLOW_RUN_CANCELLED = 'The fallow analysis was cancelled. Nothing was attached; current findings are unchanged.';
export const FALLOW_RUN_COMPLETED = (findings: number, files: number): string => `fallow analysis attached: ${FALLOW_MATCHED(findings, files)}.`;
/** COPY-15, verbatim (docs/concept/design/interactions/04-microcopy.md). */
export const COPY_15 = (provider: string): string => `${provider} analysis failed. The structural snapshot is still available.`;
export const FALLOW_RUN_KEPT = 'The previous findings are kept and marked stale.';
export const FALLOW_RUN_LOG = 'Error output (last lines)';
export const FALLOW_RUN_NOTICE = (reason: string): string => `${COPY_15('fallow')} ${reason}`;
/** Part 7 Z23/Z27: the stale notice, by cause. `snapshot` is COPY-16 itself. */
export const FALLOW_STALE_NOTICE = (date: string, cause: 'snapshot' | 'failed-run'): string =>
  (cause === 'snapshot'
    ? `Showing evidence from ${date}. It is not current for this snapshot.`
    : `Showing evidence from ${date}. The latest fallow analysis failed, so it may not be current.`);

/** Z19: one message per run error code. `detail` is data, never copy. */
export const FALLOW_RUN_ERROR: Readonly<Record<FallowRunErrorCode, (detail: string) => string>> = {
  'root-unavailable': () => 'The codebase folder is not available. Reconnect the source, then run again.',
  'executable-missing': () => 'The fallow executable is no longer at its path. Choose it again.',
  'executable-refused': (detail) => FALLOW_EXE_REFUSED_TEXT(detail),
  'changed-since-review': () => 'The executable changed while you were reviewing it. Review it again.',
  'store-unsupported': () => FALLOW_EXE_UNSUPPORTED,
  'version-probe-failed': (detail) => {
    if (detail === 'timeout') return 'fallow did not report its version within 5 seconds. Nothing was analysed.';
    if (detail === 'no-version') return 'That file did not report a fallow version. Nothing was analysed.';
    if (NUMBER.test(detail)) return `fallow’s version check ended with exit code ${detail}. Nothing was analysed.`;
    return `fallow’s version check ended unexpectedly (${detail}). Nothing was analysed.`;
  },
  'version-unsupported': (version) => `That executable reports fallow ${version}. This version runs fallow 3.x only. Nothing was analysed.`,
  'version-changed': (version) => `The executable now reports fallow ${version}, not the version you trusted. Review it again before it runs.`,
  'spawn-failed': (code) => `fallow could not be started (${code}).`,
  'timed-out': (seconds) => `fallow did not finish within ${seconds} seconds and was stopped. Raise the time limit in settings, or run again.`,
  'output-too-large': () => `fallow’s output was larger than ${MAX_SIZE_TEXT}, so it was stopped and nothing was read.`,
  'output-incomplete': () => 'fallow exited, but its output did not finish. Nothing was read.',
  'output-not-json': () => 'fallow’s output was not a complete JSON report. Nothing was read.',
  'output-unsupported': (found) => {
    const at = found.lastIndexOf('@');
    return at < 0
      ? `fallow produced a report this version cannot read. Supported: ${FALLOW_SUPPORTED_TEXT}. Nothing was attached.`
      : `fallow produced a “${found.slice(0, at)}” report at schema ${found.slice(at + 1)}, which this version cannot read. Supported: ${FALLOW_SUPPORTED_TEXT}. Nothing was attached.`;
  },
  'output-invalid': (at) => (at === '' ? 'fallow’s report is not valid. Nothing was attached.' : `fallow’s report is not valid at ${at}. Nothing was attached.`),
  'analyzer-error': (message) => (message === '' ? 'fallow reported an error.' : `fallow reported an error: ${message}`),
  'exit-code': (detail) => (NUMBER.test(detail) ? `fallow ended unexpectedly with exit code ${detail}.` : `fallow ended unexpectedly (${detail}).`),
  'source-mismatch': () => 'None of fallow’s findings names a file in the current snapshot. Nothing was attached.',
  'snapshot-changed': () => 'The codebase was rescanned while fallow ran, so its result was discarded. Run it again.',
  superseded: () => 'The findings changed while fallow ran (a report was imported or removed), so its result was discarded.',
};

/* Settings (Z12). The row names are literals in setting-definitions.ts (K20). */
export const SETTINGS_FALLOW_FORGET = 'Forget';
export const SETTINGS_FALLOW_LIMIT_DESC = 'Seconds before a fallow analysis is stopped, from 10 to 1800.';
export const SETTINGS_FALLOW_LIMIT_INVALID = 'Enter a whole number of seconds from 10 to 1800.';
export const SETTINGS_FALLOW_BUSY = 'Cancel the fallow analysis for this codebase first.';
export const PROFILE_ANALYZER_PURGE_FAILED = (reason: string): string =>
  `The profile was removed, but its fallow executable setting could not be removed: ${reason}`;
```

In `src/ui/inspector-copy.ts`, after line 296 (`export * from './audit-copy/fallow';`) add:

```ts
export * from './audit-copy/fallow-run';
```

Create `src/ui/read-models/fallow-run.ts`:

```ts
// Part 7 Z28/Z33: the screens' only door to the fallow run types (Part 6 E20's barrel), and
// the run banner (C16) as pure data.
import type { AnalysisRunState } from '../../application/analysis/analysis-state';
import type { FallowRunErrorCode } from '../../application/analysis/fallow-run-errors';
import type { RunReview } from '../../application/analysis/fallow-analysis-service';
import { formatAbsoluteTime } from '../copy';
import {
  COPY_15, FALLOW_RUN_CANCELLED, FALLOW_RUN_CANCELLING, FALLOW_RUN_COMPLETED, FALLOW_RUN_ERROR, FALLOW_RUN_PROBING, FALLOW_RUN_RUNNING,
} from '../inspector-copy';
import { rootFolderLabel } from './root-label';

export { isActive, isCancellable, type AnalysisRunState } from '../../application/analysis/analysis-state';
export type { AnalyzerBindingView, ReviewResult, RunReview, StartOutcome } from '../../application/analysis/fallow-analysis-service';
export type { FallowRunErrorCode } from '../../application/analysis/fallow-run-errors';
export type { ExecutableFacts, ExecutableFormat, ExecutableRefusal } from '../../application/ports/executable-inspector';
export { FALLOW_TESTED_VERSIONS } from '../../application/analysis/fallow-invocation';

/** Z29/Z30: where the installed route opens. */
export type InstalledRouteStart = { startAt: 'path' } | { startAt: 'review'; review: RunReview; reason: 'untrusted' | 'changed' };

export interface FallowRunBanner {
  tone: 'info' | 'warning';
  icon: string;
  text: string;
  reason: string | null;
  /** The previous findings were kept (and marked stale). */
  kept: boolean;
  log: string | null;
}

/** Z33: how much of a failure's stderr tail is shown. */
export const LOG_SHOWN_CHARS = 2000;

const info = (icon: string, text: string): FallowRunBanner => ({ tone: 'info', icon, text, reason: null, kept: false, log: null });

/** Z33: a refused start, in the failed form, with no log. */
export function refusalBanner(code: FallowRunErrorCode, detail: string): FallowRunBanner {
  return { tone: 'warning', icon: 'alert-triangle', text: COPY_15('fallow'), reason: FALLOW_RUN_ERROR[code](detail), kept: false, log: null };
}

export function fallowRunBannerOf(state: AnalysisRunState, hasEvidence: boolean): FallowRunBanner | null {
  switch (state.status) {
    case 'idle': return null;
    case 'probing': return info('loader', FALLOW_RUN_PROBING(hasEvidence));
    case 'running':
      return info('loader', FALLOW_RUN_RUNNING(rootFolderLabel(state.rootPath), formatAbsoluteTime(state.startedAt, Intl), state.timeoutSeconds, hasEvidence));
    case 'cancelling': return info('loader', FALLOW_RUN_CANCELLING);
    case 'cancelled': return info('circle-slash', FALLOW_RUN_CANCELLED);
    case 'completed': return info('check', FALLOW_RUN_COMPLETED(state.matchedFindings, state.matchedFiles));
    case 'failed': {
      const log = state.logExcerpt.slice(-LOG_SHOWN_CHARS);
      return {
        tone: 'warning', icon: 'alert-triangle', text: COPY_15('fallow'), reason: FALLOW_RUN_ERROR[state.code](state.detail),
        kept: state.evidenceKept, log: log === '' ? null : log,
      };
    }
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}
```

Create `src/ui/stores/analysis-store.ts`:

```ts
// Part 7 Z28: this leaf's view of the plugin's ONE FallowAnalysisService, for the bound
// codebase. A setup store (like evidence-store.ts): `onScopeDispose` is how `$dispose()`
// (unwireDataPorts, when the leaf closes) drops the listener on the service, which outlives
// every leaf. The store never runs anything itself: every action is the service's.
import { defineStore } from 'pinia';
import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import type { CodebaseSnapshot } from '../../domain/model';
import { IDLE, isActive, isCancellable, type AnalysisRunState } from '../../application/analysis/analysis-state';
import type {
  AnalyzerBindingView, FallowAnalysisService, ReviewResult, RunReview, StartOutcome,
} from '../../application/analysis/fallow-analysis-service';

export const useAnalysisStore = defineStore('fallow-analysis', () => {
  const repositoryId = ref('');
  const run = shallowRef<AnalysisRunState>(IDLE);
  /** null until the first read for the bound codebase lands. */
  const binding = shallowRef<AnalyzerBindingView | null>(null);
  /** Z35: raised by the `run-fallow-analysis` command; SourcesScreen consumes it. */
  const runRequested = ref(false);
  const active = computed(() => isActive(run.value));
  const cancellable = computed(() => isCancellable(run.value));
  let service: FallowAnalysisService | null = null;
  let unsubscribe: (() => void) | null = null;
  let readTicket = 0;

  function refreshRun(): void {
    run.value = service !== null && repositoryId.value !== '' ? service.stateOf(repositoryId.value) : IDLE;
  }
  /** A read that lands after a rebind is dropped (the ticket moved on). */
  async function refreshBinding(): Promise<void> {
    const id = repositoryId.value;
    const current = service;
    readTicket += 1;
    const ticket = readTicket;
    if (current === null || id === '') { binding.value = null; return; }
    const view = await current.readBinding(id);
    if (ticket === readTicket && id === repositoryId.value) binding.value = view;
  }
  const refreshQuietly = (): void => { void refreshBinding().catch(() => { binding.value = null; }); };
  function listen(): void {
    unsubscribe?.();
    unsubscribe = null;
    const id = repositoryId.value;
    if (service === null || id === '') return;
    unsubscribe = service.subscribe((changed) => {
      if (changed !== id) return;
      refreshRun();
      refreshQuietly();
    });
  }
  function setService(next: FallowAnalysisService): void {
    service = next;
    listen();
    refreshRun();
    refreshQuietly();
  }
  /** Bound by App's repository watcher. A run request for the previous codebase is dropped. */
  function bindRepository(id: string): void {
    if (id === repositoryId.value) return;
    repositoryId.value = id;
    runRequested.value = false;
    binding.value = null;
    listen();
    refreshRun();
    refreshQuietly();
  }
  function requestRun(): void {
    runRequested.value = true;
  }
  function consumeRunRequest(): boolean {
    if (!runRequested.value) return false;
    runRequested.value = false;
    return true;
  }
  /** K39: the service and codebase to act on, or null while unbound or for another codebase. */
  function target(snapshot: CodebaseSnapshot): { service: FallowAnalysisService; id: string } | null {
    const id = repositoryId.value;
    return service === null || id === '' || snapshot.repositoryId !== id ? null : { service, id };
  }
  async function review(snapshot: CodebaseSnapshot, path: string): Promise<ReviewResult | null> {
    const t = target(snapshot);
    return t === null ? null : t.service.review(t.id, snapshot, path);
  }
  async function startOrReview(snapshot: CodebaseSnapshot): Promise<StartOutcome | null> {
    const t = target(snapshot);
    return t === null ? null : t.service.run(t.id, snapshot);
  }
  async function trustAndRun(snapshot: CodebaseSnapshot, reviewed: RunReview): Promise<StartOutcome | null> {
    const t = target(snapshot);
    return t === null ? null : t.service.trustAndRun(t.id, snapshot, reviewed);
  }
  /** Only a probing or running analysis; false otherwise (nothing to announce, E17). */
  function cancel(): boolean {
    if (service === null || repositoryId.value === '' || !cancellable.value) return false;
    service.cancel(repositoryId.value);
    return true;
  }
  /** True when the executable was forgotten; false while a run is in flight or unbound. */
  async function forget(): Promise<boolean> {
    const id = repositoryId.value;
    if (service === null || id === '') return false;
    const result = await service.forget(id);
    await refreshBinding();
    return result === 'forgotten';
  }
  onScopeDispose(() => {
    unsubscribe?.();
    unsubscribe = null;
  });
  return {
    repositoryId, run, binding, runRequested, active, cancellable,
    setService, bindRepository, refreshBinding, requestRun, consumeRunRequest, review, startOrReview, trustAndRun, cancel, forget,
  };
});
```

In `src/ui/App.vue`, after line 17 (`import { useEvidenceStore } from './stores/evidence-store';`) add `import { useAnalysisStore } from './stores/analysis-store';`; after line 47 (`const evidence = useEvidenceStore();`) add `const analysis = useAnalysisStore();`; and in the repository watcher replace:

```ts
  // Part 6 Y29: the evidence store too; it then follows that codebase's imported report.
  evidence.bindRepository(id);
```

with:

```ts
  // Part 6 Y29: the evidence store too; it then follows that codebase's imported report.
  evidence.bindRepository(id);
  // Part 7 Z28: and the analysis store, which follows that codebase's fallow run.
  analysis.bindRepository(id);
```

Create `src/host/analysis-notices.ts`:

```ts
// Part 7 Z34: a failed fallow run tells the user even if they left Data & scans. main.ts
// calls this once. One Notice per run id, for operational failures and a changed version
// only; a completion or a cancel shows up on every screen and raises none.
import { OPERATIONAL_FAILURES } from '../application/analysis/fallow-run-errors';
import type { FallowAnalysisService } from '../application/analysis/fallow-analysis-service';
import { FALLOW_RUN_ERROR, FALLOW_RUN_NOTICE } from '../ui/inspector-copy';

export function watchAnalysisFailures(
  service: Pick<FallowAnalysisService, 'subscribe' | 'stateOf'>, notify: (message: string) => void,
): () => void {
  const told = new Set<string>();
  return service.subscribe((profileId) => {
    const state = service.stateOf(profileId);
    if (state.status !== 'failed' || told.has(state.runId)) return;
    if (!OPERATIONAL_FAILURES.has(state.code) && state.code !== 'version-changed') return;
    told.add(state.runId);
    notify(FALLOW_RUN_NOTICE(FALLOW_RUN_ERROR[state.code](state.detail)));
  });
}
```

In `src/host/city-scan-controller.ts`, add `import type { FallowAnalysisService } from '../application/analysis/fallow-analysis-service';` beside the `EvidenceRepository` import, and replace:

```ts
  /** Part 6 Y28: imported fallow evidence, session-only. ONE instance per plugin, shared by every leaf. */
  evidenceStore: EvidenceRepository;
}
```

with:

```ts
  /** Part 6 Y28: imported fallow evidence, session-only. ONE instance per plugin, shared by every leaf. */
  evidenceStore: EvidenceRepository;
  /** Part 7 Z28: the plugin's ONE fallow analysis service, shared by every leaf. */
  fallowAnalysis: FallowAnalysisService;
}
```

In `src/host/data-ports.ts`, after line 8 (`import { useEvidenceStore } from '../ui/stores/evidence-store';`) add `import { useAnalysisStore } from '../ui/stores/analysis-store';`; replace:

```ts
  useEvidenceStore(pinia).setRepository(deps.evidenceStore);
}
```

with:

```ts
  useEvidenceStore(pinia).setRepository(deps.evidenceStore);
  // Part 7 Z28: the plugin's ONE fallow analysis service; App binds the store to the codebase.
  useAnalysisStore(pinia).setService(deps.fallowAnalysis);
}
```

replace:

```ts
  useEvidenceStore(pinia).$dispose();
}
```

with:

```ts
  useEvidenceStore(pinia).$dispose();
  // Part 7 Z24/Z28: the service outlives the leaf, and a closing leaf does NOT cancel a run.
  useAnalysisStore(pinia).$dispose();
}
```

and at the end of the file add:

```ts
/** Part 7 Z35: the `run-fallow-analysis` command's body. It goes to Data & scans and raises a
 *  request; SourcesScreen starts at once when trust holds, and otherwise opens the review. */
export function requestFallowRun(pinia: Pinia): void {
  useCityStore(pinia).navigate('sources');
  useAnalysisStore(pinia).requestRun();
}
```

In `src/host/city-view.ts`, replace line 38:

```ts
import { requestReportImport, unwireDataPorts, wireDataPorts } from './data-ports';
```

with:

```ts
import { requestFallowRun, requestReportImport, unwireDataPorts, wireDataPorts } from './data-ports';
import { useAnalysisStore } from '../ui/stores/analysis-store';
```

and after `openReportImport(): void { … }` (line 125) add:

```ts

  /** Part 7 Z35: Data & scans, plus a request SourcesScreen turns into a run or the review. */
  requestFallowRun(): void { if (this.pinia && this.hasSnapshot()) requestFallowRun(this.pinia); }

  /** Part 7 Z35: this leaf's codebase has an analysis probing, running or cancelling. */
  isAnalysisActive(): boolean { return this.pinia ? useAnalysisStore(this.pinia).active : false; }

  /** Part 7 Z35 (M36): probing or running, so there is something to cancel. */
  isAnalysisCancellable(): boolean { return this.pinia ? useAnalysisStore(this.pinia).cancellable : false; }

  cancelAnalysis(): void { if (this.pinia) useAnalysisStore(this.pinia).cancel(); }
```

In `src/host/commands.ts`, replace lines 1–3:

```ts
// Registers the commands without the plugin-id prefix (spec 5.2): the three WP-01
// commands open-city, scan-codebase and cancel-scan, and Part 6's
// import-analysis-report (Y39). None for an unimplemented capability (spec 1).
```

with:

```ts
// Registers the commands without the plugin-id prefix (spec 5.2): the three WP-01
// commands open-city, scan-codebase and cancel-scan, Part 6's import-analysis-report (Y39),
// and Part 7's run-fallow-analysis and cancel-fallow-analysis (Z35). Six in all; none for
// an unimplemented capability (spec 1).
```

replace:

```ts
import { FALLOW_COMMAND_IMPORT } from '../ui/inspector-copy';
```

with:

```ts
import { FALLOW_COMMAND_CANCEL, FALLOW_COMMAND_IMPORT, FALLOW_COMMAND_RUN } from '../ui/inspector-copy';
```

and before the final `}` of `registerCommands` (after the `import-analysis-report` command) add:

```ts

  plugin.addCommand({
    id: 'run-fallow-analysis',
    name: FALLOW_COMMAND_RUN,
    // Part 7 Z35: only while the active city view shows a snapshot and its codebase has no
    // analysis in flight. The body opens Data & scans and raises a request: SourcesScreen
    // starts at once when trust holds, and otherwise opens the review. Nothing runs here.
    checkCallback: (checking: boolean): boolean => {
      const view = plugin.app.workspace.getActiveViewOfType(CityView);
      if (!view || !view.hasSnapshot() || view.isAnalysisActive()) return false;
      if (checking) return true;
      view.requestFallowRun();
      return true;
    },
  });

  plugin.addCommand({
    id: 'cancel-fallow-analysis',
    name: FALLOW_COMMAND_CANCEL,
    // Part 7 Z35, M36's rule: offered only while there is an analysis to cancel.
    checkCallback: (checking: boolean): boolean => {
      const view = plugin.app.workspace.getActiveViewOfType(CityView);
      if (!view || !view.isAnalysisCancellable()) return false;
      if (checking) return true;
      view.cancelAnalysis();
      return true;
    },
  });
```

In `src/main.ts`:
- replace `import { Plugin, type WorkspaceLeaf } from 'obsidian';` with `import { Notice, Plugin, type WorkspaceLeaf } from 'obsidian';`;
- after `import { createReviewRepositoryRegistry } from './adapters/storage/review-repository-registry';` add:

```ts
import { createPluginDataAnalyzerStore } from './adapters/storage/plugin-data-analyzer-store';
import { createExecutableInspector } from './adapters/fallow/executable-inspector';
import { createFallowRunner } from './adapters/fallow/fallow-runner';
import { AnalysisCoordinator } from './application/analysis/analysis-coordinator';
import { createFallowAnalysisService, type FallowAnalysisService } from './application/analysis/fallow-analysis-service';
import { createCancellationToken } from './application/scan-coordinator';
import { watchAnalysisFailures } from './host/analysis-notices';
```

- replace:

```ts
export default class CodebaseInspectorPlugin extends Plugin {
  override onload(): void {
```

with:

```ts
export default class CodebaseInspectorPlugin extends Plugin {
  /** Part 7 Z24: kept so onunload can shut every fallow run down. */
  private analysis: FallowAnalysisService | null = null;
  private unwatchAnalysis: (() => void) | null = null;

  override onload(): void {
```

- replace:

```ts
    const bindingStore = new PluginDataBindingStore(this, getOrCreateMachineId(this.app));
```

with:

```ts
    const machineId = getOrCreateMachineId(this.app);
    const bindingStore = new PluginDataBindingStore(this, machineId);
```

- after `const reviewRegistry = createReviewRepositoryRegistry(this);` add:

```ts
    // Part 7 Z21/Z22/Z36: ONE fallow analysis service per plugin, shared by every leaf.
    // Building it spawns nothing, stats nothing and reads nothing: a run starts only from
    // "Trust and run" or a passing pre-run check.
    const analysis = createFallowAnalysisService({
      store: createPluginDataAnalyzerStore(this, machineId),
      inspector: createExecutableInspector(),
      coordinator: new AnalysisCoordinator({
        process: createFallowRunner(), evidence: evidenceStore, snapshots: snapshotStore, clock: SYSTEM_CLOCK, createCancellationToken,
      }),
      snapshots: snapshotStore,
      getFilesystem: () => createNodeSourceFileSystem(),
      machineId,
      clock: SYSTEM_CLOCK,
    });
    this.analysis = analysis;
    // Part 7 Z34: an operational failure tells the user even off Data & scans.
    this.unwatchAnalysis = watchAnalysisFailures(analysis, (message) => { void new Notice(message, 8000); });
```

- in the `registerView` deps object, replace `      evidenceStore,` with:

```ts
      evidenceStore,
      fallowAnalysis: analysis,
```

- replace `  override onunload(): void {}` with:

```ts
  override onunload(): void {
    // Part 7 Z24: stop watching, then kill every fallow child, synchronously; idempotent.
    this.unwatchAnalysis?.();
    this.unwatchAnalysis = null;
    this.analysis?.shutdown();
    this.analysis = null;
  }
```

In `scripts/assert-bundle.mjs`, after the `if (bundledBuiltins.length > 0) { … }` block, add:

```js

// Part 7 Z38 (K23). The one sanctioned route to child_process is node-process-access.ts's
// window.require: the module is named exactly once in the whole bundle, and that once is
// the window.require call. A second mention would be a second process path.
const childProcessMentions = main.split('node:child_process').length - 1;
const childProcessRequires = requires.filter((m) => m[1] === 'window' && m[3] === 'node:child_process').length;
if (childProcessMentions !== 1 || childProcessRequires !== 1) {
  fail(`dist/main.js must name node:child_process exactly once, in window.require(…) `
    + `(src/adapters/fallow/node-process-access.ts): found ${childProcessMentions} mention(s) and ${childProcessRequires} window.require call(s).`);
}
```

In `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`, in the `checkpoint4:commands` block, after the `import-analysis-report` item add (A2):

```markdown
- `run-fallow-analysis` — "Run fallow analysis" (WP-02 Part 7, Z35). **Hidden unless the
  active city view shows a snapshot and no fallow analysis is in flight for its codebase.**
  Opens Data & scans; runs at once when the bound executable is still trusted, and
  otherwise opens the review. Nothing runs from the palette itself.
- `cancel-fallow-analysis` — "Cancel fallow analysis" (Z35). **Hidden unless the active
  view's fallow analysis is checking its version or running.**
```

- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/unit/fallow-run-copy.test.ts tests/unit/fallow-run-read-model.test.ts tests/unit/analysis-store.test.ts tests/host/fallow-commands.test.ts tests/host/analysis-notices.test.ts tests/host/analysis-ports.test.ts tests/host/plugin-onload.test.ts tests/unit/assert-bundle.test.ts`
Expected: PASS.

Run: `npm run build`
Expected: `assert-bundle: OK` — the real bundle names `node:child_process` exactly once.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/ui/audit-copy/fallow-run.ts src/ui/inspector-copy.ts src/ui/read-models/fallow-run.ts src/ui/stores/analysis-store.ts src/ui/App.vue src/host src/main.ts scripts/assert-bundle.mjs tests/fixtures/fake-fallow-analysis.ts tests/fixtures/data-port-deps.ts tests/unit/fallow-run-copy.test.ts tests/unit/fallow-run-read-model.test.ts tests/unit/analysis-store.test.ts tests/host/fallow-commands.test.ts tests/host/analysis-notices.test.ts tests/host/analysis-ports.test.ts tests/host/plugin-onload.test.ts tests/unit/assert-bundle.test.ts --max-warnings 0`
Expected: exit 0. `src/host/city-view.ts` ≤ 360 (`npx vitest run tests/unit/city-budget.test.ts`).

- [ ] **Step 6: Commit.**

```
git add src/ui/audit-copy/fallow-run.ts src/ui/inspector-copy.ts src/ui/read-models/fallow-run.ts src/ui/stores/analysis-store.ts src/ui/App.vue src/host/analysis-notices.ts src/host/city-scan-controller.ts src/host/data-ports.ts src/host/city-view.ts src/host/commands.ts src/main.ts scripts/assert-bundle.mjs tests/fixtures/fake-fallow-analysis.ts tests/fixtures/data-port-deps.ts tests/unit/fallow-run-copy.test.ts tests/unit/fallow-run-read-model.test.ts tests/unit/analysis-store.test.ts tests/host/fallow-commands.test.ts tests/host/analysis-notices.test.ts tests/host/analysis-ports.test.ts tests/host/plugin-onload.test.ts tests/unit/assert-bundle.test.ts docs/superpowers/notes/2026-09-17-wp01-implementation-report.md
git commit -m "feat(host): the fallow analysis service wired per plugin, the per-leaf analysis store, two commands, failure notices and onunload shutdown (Z24, Z28, Z34, Z35)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Run the covering tests.**

Run: `npx vitest run tests/unit/fallow-run-copy.test.ts tests/unit/fallow-run-read-model.test.ts tests/unit/analysis-store.test.ts tests/host tests/unit/assert-bundle.test.ts tests/unit/city-budget.test.ts tests/unit/no-process-execution.test.ts`
Expected: PASS (`tests/host/clean-vault-install.test.ts` included; re-run it alone if it times out).

---

### Task 10: Settings: the two profile rows, Forget, the time limit, the purge and the disclosure (Z11, Z12)

**Files:**
- Modify: `src/host/setting-definitions.ts` (152 → ≈ 205): imports (lines 8–10), `ProfileEntry` (lines 16–19), `SettingDefinitionsCallbacks` (lines 21–29), `STORAGE_DISCLOSURE_TEXT` (lines 41–45), two new render functions, `buildProfilePage` (lines 111–124)
- Modify: `src/host/settings-tab.ts` (240 → ≈ 275): imports (lines 9–18), the constructor (lines 36–48), `refresh` (line 71), `getSettingDefinitions` (lines 98–110), `deleteProfile` (lines 138–145), three new private methods
- Modify: `src/main.ts`: the `CodebaseInspectorSettingTab` construction
- Modify: `tests/component/settings-tab.test.ts` (435 → 436), `tests/component/settings-tab-validation.test.ts`, `tests/component/settings-tab-purge.test.ts`, `tests/host/plugin-onload.test.ts`: each constructor call gains `createFakeFallowAnalysis()` (K37)
- Modify: `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`: the `checkpoint4:settings` block (A2)
- Test: `tests/component/settings-fallow.test.ts` (new, ~190)

**Interfaces:**
- Consumes: Task 9's `createFakeFallowAnalysis` and copy (`FALLOW_EXE_NONE`, `FALLOW_EXE_OTHER_DEVICE`, `FALLOW_EXE_INVALID`, `FALLOW_EXE_UNSUPPORTED`, `FALLOW_TRUST_VALUE`, `SETTINGS_FALLOW_FORGET`, `SETTINGS_FALLOW_LIMIT_DESC`, `SETTINGS_FALLOW_LIMIT_INVALID`, `SETTINGS_FALLOW_BUSY`, `PROFILE_ANALYZER_PURGE_FAILED`); Task 5's `FallowAnalysisService`; Task 2's `AnalyzerBindingRead`; Task 1's `FALLOW_TESTED_VERSIONS`.
- Produces:
  - `ProfileEntry.analyzer: AnalyzerBindingRead`
  - `SettingDefinitionsCallbacks.onForgetAnalyzer(profileId: string): void`, `onAnalyzerTimeoutChange(profileId: string, rawValue: string): void`
  - `analyzerDescription(read: AnalyzerBindingRead): string` (exported for the test)
  - `CodebaseInspectorSettingTab` constructor: seventh parameter `analysis: Pick<FallowAnalysisService, 'readBinding' | 'forget' | 'setTimeLimit' | 'purgeProfile'>`
  - the settings rows `fallow executable` (always) and `fallow time limit` (only when bound), named by string literals (K20)
  - the new `STORAGE_DISCLOSURE_TEXT`

- [ ] **Step 1: Write the failing test.**

Create `tests/component/settings-fallow.test.ts`:

```ts
// Part 7 Z11/Z12: each profile page shows its fallow executable and, when one is chosen,
// its time limit. Forget and the time limit go through the service; a busy or invalid
// answer is shown and changes nothing; removing a profile purges its executable setting.
// A new file: settings-tab.test.ts is at 435 lines.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { Setting } from '../mocks/obsidian';
import type { App, Plugin, Setting as ObsidianSetting, SettingDefinitionItem, SettingDefinitionList,
  SettingDefinitionPage, SettingDefinitionRender, SettingGroup } from 'obsidian';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { STORAGE_DISCLOSURE_TEXT, analyzerDescription } from '../../src/host/setting-definitions';
import type { AnalyzerBindingRead } from '../../src/application/analysis/analyzer-record';
import type { CodebaseProfile } from '../../src/domain/model';
import {
  FALLOW_EXE_NONE, FALLOW_EXE_OTHER_DEVICE, FALLOW_EXE_UNSUPPORTED, FALLOW_TRUST_VALUE, PROFILE_ANALYZER_PURGE_FAILED,
  SETTINGS_FALLOW_BUSY, SETTINGS_FALLOW_LIMIT_DESC, SETTINGS_FALLOW_LIMIT_INVALID,
} from '../../src/ui/inspector-copy';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFakeFallowAnalysis, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

const EXE = 'C:\\Tools\\fallow\\fallow.exe';
const TRUST = { fingerprint: '0a1b2c3d', version: '3.27.0', grantedAt: '2026-09-23T10:00:00.000Z' };
const BOUND: AnalyzerBindingRead = { kind: 'bound', binding: { profileId: 'p1', executablePath: EXE, timeoutSeconds: 300, trust: TRUST } };
const profile: CodebaseProfile = { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 };
const fakeGroup = {} as unknown as SettingGroup;

async function makeTab(read: AnalyzerBindingRead | null): Promise<{ tab: CodebaseInspectorSettingTab; analysis: FakeFallowAnalysis }> {
  const profiles = createFakeProfileStoreHarness();
  await profiles.store.save(profile);
  const analysis = createFakeFallowAnalysis();
  if (read !== null) analysis.setBinding('p1', read);
  const tab = new CodebaseInspectorSettingTab(
    {} as unknown as App, {} as unknown as Plugin, profiles.store, createFakeBindingStoreHarness().store,
    () => createFakeSourceFileSystem({}).port, { purge: () => Promise.resolve() }, analysis);
  await tab.refresh();
  return { tab, analysis };
}
function page(tab: CodebaseInspectorSettingTab): SettingDefinitionPage {
  const list = tab.getSettingDefinitions().find((d): d is SettingDefinitionList => 'type' in d && d.type === 'list');
  const found = (list?.items ?? []).find((item): item is SettingDefinitionPage => 'type' in item && item.type === 'page');
  if (!found) throw new Error('no profile page');
  return found;
}
const rowNames = (tab: CodebaseInspectorSettingTab): string[] => (page(tab).items ?? []).map((i) => (i as { name: string }).name);
function render(tab: CodebaseInspectorSettingTab, name: string): Setting {
  const def = (page(tab).items ?? []).find((i): i is SettingDefinitionRender => 'render' in i && i.name === name);
  if (!def) throw new Error(`no row ${name}`);
  const setting = new Setting(document.body.createDiv());
  def.render(setting as unknown as ObsidianSetting, fakeGroup);
  return setting;
}
afterEach(() => {
  document.body.replaceChildren();
});

describe('the fallow executable row (Z12)', () => {
  it('without a record: the none text, no Forget, and no time-limit row', async () => {
    const { tab } = await makeTab(null);
    expect(rowNames(tab)).toEqual(['Name', 'Excluded paths', 'Maximum file size to read', 'Source folder', 'fallow executable']);
    const row = render(tab, 'fallow executable');
    expect(row.nameEl.textContent).toBe('fallow executable');
    expect(row.descEl.textContent).toBe(FALLOW_EXE_NONE);
    expect(row.controlEl.querySelector('[data-action="forget-analyzer"]')).toBeNull();
  });

  it('bound: the path and its trust, Forget, and the time-limit row after it', async () => {
    const { tab } = await makeTab(BOUND);
    expect(rowNames(tab).slice(-2)).toEqual(['fallow executable', 'fallow time limit']);
    expect(render(tab, 'fallow executable').descEl.textContent).toBe(`${EXE} · ${FALLOW_TRUST_VALUE('3.27.0', true)}`);
    expect(render(tab, 'fallow executable').controlEl.querySelector('[data-action="forget-analyzer"]')).not.toBeNull();
    const limit = render(tab, 'fallow time limit');
    expect(limit.descEl.textContent).toBe(SETTINGS_FALLOW_LIMIT_DESC);
    expect(limit.controlEl.querySelector('input')?.value).toBe('300');
  });

  it('describes every read kind, and offers Forget except with none or a newer format', () => {
    expect(analyzerDescription({ kind: 'other-machine' })).toBe(FALLOW_EXE_OTHER_DEVICE);
    expect(analyzerDescription({ kind: 'unsupported' })).toBe(FALLOW_EXE_UNSUPPORTED);
    expect(analyzerDescription({ kind: 'bound', binding: { ...BOUND.binding, trust: null } })).toBe(`${EXE} · ${FALLOW_TRUST_VALUE(null, false)}`);
    expect(analyzerDescription({ kind: 'bound', binding: { ...BOUND.binding, trust: { ...TRUST, version: '3.28.0' } } }))
      .toBe(`${EXE} · ${FALLOW_TRUST_VALUE('3.28.0', false)}`);
  });

  it('shows Forget for another device\'s record, but not for a newer-format one', async () => {
    const other = (await makeTab({ kind: 'other-machine' })).tab;
    expect(render(other, 'fallow executable').controlEl.querySelector('[data-action="forget-analyzer"]')).not.toBeNull();
    const newer = (await makeTab({ kind: 'unsupported' })).tab;
    expect(render(newer, 'fallow executable').controlEl.querySelector('[data-action="forget-analyzer"]')).toBeNull();
  });
});

describe('Forget and the time limit go through the service (Z10, Z11)', () => {
  it('Forget asks the service, then refreshes; busy is shown and changes nothing', async () => {
    const { tab, analysis } = await makeTab(BOUND);
    render(tab, 'fallow executable').controlEl.querySelector<HTMLButtonElement>('[data-action="forget-analyzer"]')!.click();
    await tab.waitForPendingUpdates();
    expect(analysis.calls.filter((c) => c.method === 'forget')).toEqual([{ method: 'forget', profileId: 'p1' }]);
    analysis.next.forget = 'busy';
    render(tab, 'fallow executable').controlEl.querySelector<HTMLButtonElement>('[data-action="forget-analyzer"]')!.click();
    await tab.waitForPendingUpdates();
    expect(document.querySelector('.notice')?.textContent).toBe(SETTINGS_FALLOW_BUSY);
  });

  it('a time limit is sent as a number; an invalid one is refused with a reason', async () => {
    const { tab, analysis } = await makeTab(BOUND);
    const setTimeLimit = vi.spyOn(analysis, 'setTimeLimit');
    const input = render(tab, 'fallow time limit').controlEl.querySelector('input')!;
    input.value = '600';
    input.dispatchEvent(new Event('change'));
    await tab.waitForPendingUpdates();
    expect(setTimeLimit).toHaveBeenLastCalledWith('p1', 600);
    analysis.next.setTimeLimit = 'invalid';
    input.value = '';
    input.dispatchEvent(new Event('change'));
    await tab.waitForPendingUpdates();
    expect(setTimeLimit).toHaveBeenLastCalledWith('p1', Number.NaN);
    expect(document.querySelector('.notice')?.textContent).toBe(SETTINGS_FALLOW_LIMIT_INVALID);
  });
});

describe('removing a profile purges its executable setting (Z11)', () => {
  it('purges after the profile is removed; a failed purge says so and the list refreshes', async () => {
    const { tab, analysis } = await makeTab(BOUND);
    const purge = vi.spyOn(analysis, 'purgeProfile').mockRejectedValue(new Error('Could not write data.json.'));
    const list = tab.getSettingDefinitions().find((d): d is SettingDefinitionList => 'type' in d && d.type === 'list');
    list!.onDelete!(0);
    await flushPromises();
    expect(purge).toHaveBeenCalledWith('p1');
    expect(document.querySelector('.notice')?.textContent).toBe(PROFILE_ANALYZER_PURGE_FAILED('Could not write data.json.'));
  });
});

describe('the storage disclosure (Z12)', () => {
  it('names the executable setting, its fingerprint and the device rule', () => {
    expect(STORAGE_DISCLOSURE_TEXT).toBe(
      'Codebase profiles, local folder bindings and each codebase’s review decisions (work items, boundary rules and finding decisions) are stored in this vault, in this plugin’s own data file, and survive restarts. When you choose a fallow executable for a codebase, its path, its time limit and a fingerprint of what you trusted (the executable’s path, size and modification time, the folder, the arguments and the fallow version) are stored there too, marked with this device: another device never runs it without asking again. Removing a profile removes its review decisions and its executable setting. fallow findings, imported or collected, are kept for this session only. Nothing about them is sent anywhere else.');
  });
});

describe('the settings definitions stay declarative', () => {
  it('uses no SettingDefinitionItem with a control for the time limit when nothing is bound', async () => {
    const { tab } = await makeTab({ kind: 'invalid' });
    expect(rowNames(tab)).not.toContain('fallow time limit');
    expect((tab.getSettingDefinitions() as SettingDefinitionItem[]).length).toBeGreaterThan(0);
  });
});
```

In each of the four constructor call sites, add `createFakeFallowAnalysis()` as the last argument and the import `import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';`:
- `tests/component/settings-tab.test.ts` line 43: `app, {} as unknown as Plugin, profileHarness.store, bindingHarness.store, () => filesystem, { purge: () => Promise.resolve() });` → `…, { purge: () => Promise.resolve() }, createFakeFallowAnalysis());` (the file grows by the import line only: 435 → 436)
- `tests/component/settings-tab-validation.test.ts`: `() => createFakeSourceFileSystem({}).port, { purge: () => Promise.resolve() });` → `…, { purge: () => Promise.resolve() }, createFakeFallowAnalysis());`
- `tests/component/settings-tab-purge.test.ts`: `() => createFakeSourceFileSystem({}).port, registry);` → `() => createFakeSourceFileSystem({}).port, registry, createFakeFallowAnalysis());`
- `tests/host/plugin-onload.test.ts`: `() => createFakeSourceFileSystem({}).port, { purge: () => Promise.resolve() });` → `…, { purge: () => Promise.resolve() }, createFakeFallowAnalysis());`

- [ ] **Step 2: Run it and watch it fail.**

Run: `npx vitest run tests/component/settings-fallow.test.ts`
Expected: FAIL — `analyzerDescription` is not exported, the profile page has no `fallow executable` row, and the disclosure text differs.

- [ ] **Step 3: Implement.**

In `src/host/setting-definitions.ts`, replace lines 8–10:

```ts
import type { Setting, SettingDefinitionItem, SettingDefinitionPage } from 'obsidian';
import type { CodebaseProfile, LocalBinding } from '../domain/model';
import { COPY_28 } from '../ui/copy';
```

with:

```ts
import type { Setting, SettingDefinitionItem, SettingDefinitionPage } from 'obsidian';
import type { CodebaseProfile, LocalBinding } from '../domain/model';
import type { AnalyzerBindingRead } from '../application/analysis/analyzer-record';
import { FALLOW_TESTED_VERSIONS } from '../application/analysis/fallow-invocation';
import { COPY_28 } from '../ui/copy';
import {
  FALLOW_EXE_INVALID, FALLOW_EXE_NONE, FALLOW_EXE_OTHER_DEVICE, FALLOW_EXE_UNSUPPORTED, FALLOW_TRUST_VALUE,
  SETTINGS_FALLOW_FORGET, SETTINGS_FALLOW_LIMIT_DESC,
} from '../ui/inspector-copy';
```

replace:

```ts
export interface ProfileEntry {
  profile: CodebaseProfile;
  binding: LocalBinding | null;
}
```

with:

```ts
export interface ProfileEntry {
  profile: CodebaseProfile;
  binding: LocalBinding | null;
  /** Part 7 Z12: this profile's fallow executable record, as read from data.json. */
  analyzer: AnalyzerBindingRead;
}
```

replace:

```ts
  onReconnect: (profileId: string) => void;
  onClearBinding: (profileId: string) => void;
}
```

with:

```ts
  onReconnect: (profileId: string) => void;
  onClearBinding: (profileId: string) => void;
  /** Part 7 Z11: Forget the fallow executable (refused while a run is active). */
  onForgetAnalyzer: (profileId: string) => void;
  /** Part 7 Z10: the typed time limit, validated by the service. */
  onAnalyzerTimeoutChange: (profileId: string, rawValue: string) => void;
}
```

replace the whole `STORAGE_DISCLOSURE_TEXT` constant (lines 41–45) with:

```ts
export const STORAGE_DISCLOSURE_TEXT =
  'Codebase profiles, local folder bindings and each codebase’s review decisions (work items, ' +
  'boundary rules and finding decisions) are stored in this vault, in this plugin’s own data ' +
  'file, and survive restarts. When you choose a fallow executable for a codebase, its path, ' +
  'its time limit and a fingerprint of what you trusted (the executable’s path, size and ' +
  'modification time, the folder, the arguments and the fallow version) are stored there too, ' +
  'marked with this device: another device never runs it without asking again. Removing a ' +
  'profile removes its review decisions and its executable setting. fallow findings, imported ' +
  'or collected, are kept for this session only. Nothing about them is sent anywhere else.';
```

after `renderBindingStatusRow` add:

```ts
/** Part 7 Z12: what the "fallow executable" row says for each record kind. */
export function analyzerDescription(read: AnalyzerBindingRead): string {
  switch (read.kind) {
    case 'none': return FALLOW_EXE_NONE;
    case 'other-machine': return FALLOW_EXE_OTHER_DEVICE;
    case 'invalid': return FALLOW_EXE_INVALID;
    case 'unsupported': return FALLOW_EXE_UNSUPPORTED;
    default: {
      const version = read.binding.trust?.version ?? null;
      return `${read.binding.executablePath} · ${FALLOW_TRUST_VALUE(version, version !== null && FALLOW_TESTED_VERSIONS.includes(version))}`;
    }
  }
}

/** Part 7 Z12: choosing an executable needs the folder and the review, so it lives in Data &
 *  scans; here the record is shown, and Forget is offered when there is one to remove. A
 *  newer-format record is read-only (Z2), so it has no Forget. */
function renderAnalyzerRow(setting: Setting, entry: ProfileEntry, callbacks: SettingDefinitionsCallbacks): void {
  setting.setName('fallow executable');
  setting.setDesc(analyzerDescription(entry.analyzer));
  if (entry.analyzer.kind === 'none' || entry.analyzer.kind === 'unsupported') return;
  setting.addButton((btn) => {
    btn.setButtonText(SETTINGS_FALLOW_FORGET);
    btn.buttonEl.setAttribute('data-action', 'forget-analyzer');
    btn.onClick(() => { callbacks.onForgetAnalyzer(entry.profile.profileId); });
  });
}

function renderAnalyzerLimitRow(setting: Setting, seconds: number, onChange: (rawValue: string) => void): void {
  setting.setName('fallow time limit').setDesc(SETTINGS_FALLOW_LIMIT_DESC);
  const input = setting.controlEl.createEl('input', { attr: { type: 'number', min: '10', max: '1800', step: '1', value: String(seconds) } });
  input.addEventListener('change', () => { onChange(input.value); });
}
```

and in `buildProfilePage`, replace:

```ts
function buildProfilePage(entry: ProfileEntry, callbacks: SettingDefinitionsCallbacks): SettingDefinitionPage {
  const { profile } = entry;
```

with:

```ts
function buildProfilePage(entry: ProfileEntry, callbacks: SettingDefinitionsCallbacks): SettingDefinitionPage {
  const { profile } = entry;
  // Part 7 Z12: the time-limit row exists only for a usable record (no disabled control).
  const limit = entry.analyzer.kind === 'bound' ? entry.analyzer.binding.timeoutSeconds : null;
```

and replace:

```ts
      { name: 'Source folder', render: (setting) => { renderBindingStatusRow(setting, entry, callbacks); } },
    ],
```

with:

```ts
      { name: 'Source folder', render: (setting) => { renderBindingStatusRow(setting, entry, callbacks); } },
      { name: 'fallow executable', render: (setting) => { renderAnalyzerRow(setting, entry, callbacks); } },
      ...(limit === null ? [] : [{
        name: 'fallow time limit',
        render: (setting: Setting) => { renderAnalyzerLimitRow(setting, limit, (raw) => { callbacks.onAnalyzerTimeoutChange(profile.profileId, raw); }); },
      }]),
    ],
```

In `src/host/settings-tab.ts`:
- replace `import { PROFILE_REVIEW_PURGE_FAILED } from '../ui/inspector-copy';` with:

```ts
import { PROFILE_ANALYZER_PURGE_FAILED, PROFILE_REVIEW_PURGE_FAILED, SETTINGS_FALLOW_BUSY, SETTINGS_FALLOW_LIMIT_INVALID } from '../ui/inspector-copy';
import type { FallowAnalysisService } from '../application/analysis/fallow-analysis-service';
```

- replace:

```ts
    private readonly reviewRegistry: Pick<ReviewRepositoryRegistry, 'purge'>,
  ) {
```

with:

```ts
    private readonly reviewRegistry: Pick<ReviewRepositoryRegistry, 'purge'>,
    // Part 7 Z11/Z12: the plugin's fallow analysis service (main.ts passes its one instance).
    private readonly analysis: Pick<FallowAnalysisService, 'readBinding' | 'forget' | 'setTimeLimit' | 'purgeProfile'>,
  ) {
```

- replace:

```ts
        entries.push({ profile, binding });
```

with:

```ts
        entries.push({ profile, binding, analyzer: await this.analysis.readBinding(profile.profileId) });
```

- replace:

```ts
      onClearBinding: (id) => { this.confirmClearBinding(id); },
    });
```

with:

```ts
      onClearBinding: (id) => { this.confirmClearBinding(id); },
      onForgetAnalyzer: (id) => { this.trackUpdate(this.forgetAnalyzer(id)); },
      onAnalyzerTimeoutChange: (id, raw) => { this.trackUpdate(this.changeAnalyzerTimeout(id, raw)); },
    });
```

- replace:

```ts
    await this.reviewRegistry.purge(id).catch((e: unknown) => { this.showFailure(e, PROFILE_REVIEW_PURGE_FAILED); });
    await this.refresh();
  }
```

with:

```ts
    await this.reviewRegistry.purge(id).catch((e: unknown) => { this.showFailure(e, PROFILE_REVIEW_PURGE_FAILED); });
    // Part 7 Z11: and its fallow executable setting, whatever its format (a run in flight is cancelled).
    await this.analysis.purgeProfile(id).catch((e: unknown) => { this.showFailure(e, PROFILE_ANALYZER_PURGE_FAILED); });
    await this.refresh();
  }

  /** Part 7 Z11: refused while this codebase's run is active; the service changes nothing then. */
  private async forgetAnalyzer(profileId: string): Promise<void> {
    try {
      if ((await this.analysis.forget(profileId)) === 'busy') this.notify(SETTINGS_FALLOW_BUSY);
    } catch (e) {
      this.showFailure(e);
    }
    await this.refresh();
  }

  /** Part 7 Z10 (M62): whole seconds from 10 to 1800; otherwise refused with a reason, and
   *  refresh() puts the stored value back in the field. */
  private async changeAnalyzerTimeout(profileId: string, rawValue: string): Promise<void> {
    const seconds = rawValue.trim() === '' ? Number.NaN : Number(rawValue);
    try {
      if ((await this.analysis.setTimeLimit(profileId, seconds)) === 'invalid') this.notify(SETTINGS_FALLOW_LIMIT_INVALID);
    } catch (e) {
      this.showFailure(e);
    }
    await this.refresh();
  }

  private notify(message: string): void {
    const notice = new Notice(message, 8000);
    void notice;
  }
```

In `src/main.ts`, replace:

```ts
      this.app, this, profileStore, bindingStore, () => createNodeSourceFileSystem(), reviewRegistry);
```

with:

```ts
      this.app, this, profileStore, bindingStore, () => createNodeSourceFileSystem(), reviewRegistry, analysis);
```

In `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`, in the `checkpoint4:settings` block, after the `Source folder` item add (A2):

```markdown
- `fallow executable` — per profile (WP-02 Part 7, Z12): the chosen fallow executable's path
  and whether it is trusted, or why none can be used on this device. **Forget** appears only
  when there is a setting to remove. Choosing an executable happens in Data & scans, where
  the folder and the review are.
- `fallow time limit` — per profile, **only when an executable is chosen**: whole seconds
  from 10 to 1800 before an analysis is stopped; anything else is refused with a reason.
```

and in the same block replace the `Storage` item's text after the dash with: `static explanatory text: profiles, bindings, review decisions and each codebase's fallow executable setting are stored in this vault, in this plugin's own data file; fallow findings are kept for this session only, and nothing about them is sent anywhere else.`

- [ ] **Step 4: Run it and watch it pass.**

Run: `npx vitest run tests/component/settings-fallow.test.ts tests/component/settings-tab.test.ts tests/component/settings-tab-validation.test.ts tests/component/settings-tab-purge.test.ts tests/host/plugin-onload.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/host/setting-definitions.ts src/host/settings-tab.ts src/main.ts tests/component/settings-fallow.test.ts tests/component/settings-tab.test.ts tests/component/settings-tab-validation.test.ts tests/component/settings-tab-purge.test.ts tests/host/plugin-onload.test.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 6: Commit.**

```
git add src/host/setting-definitions.ts src/host/settings-tab.ts src/main.ts tests/component/settings-fallow.test.ts tests/component/settings-tab.test.ts tests/component/settings-tab-validation.test.ts tests/component/settings-tab-purge.test.ts tests/host/plugin-onload.test.ts docs/superpowers/notes/2026-09-17-wp01-implementation-report.md
git commit -m "feat(settings): fallow executable and time-limit rows, Forget, the profile purge and the storage disclosure (Z10-Z12)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Run the covering tests.**

Run: `npx vitest run tests/component/settings-fallow.test.ts tests/component/settings-tab.test.ts tests/component/settings-tab-validation.test.ts tests/component/settings-tab-purge.test.ts tests/host/plugin-onload.test.ts tests/host/clean-vault-install.test.ts tests/unit/settings-tabs.test.ts`
Expected: PASS (re-run `clean-vault-install.test.ts` alone if it times out).

---

### Task 11: Collected evidence on every surface: the badge and origin-aware copy (Z23 notice, Z26, Z27)

**Files:**
- Modify: `src/ui/kit/EvidenceBadge.vue` (17 → 22), `src/ui/styles/kit.css` (282 → 283; after line 279)
- Modify: `src/ui/audit-copy/fallow.ts` (181 → ≈ 195): `FALLOW_NOT_ANALYSED`, `FALLOW_SOME_NOT_ANALYSED`, `FALLOW_PROVENANCE_DETAIL`, `OVERVIEW_FALLOW_SOURCE`, `EVIDENCE_BADGE`, `FALLOW_NOT_ANALYSED_BODY`, `FALLOW_SOURCE`, `FALLOW_CARD_NONE`, `FALLOW_DIALOG_INTRO`, `FALLOW_REPLACE_NOTE`, `LENS_SUBTITLE`, and a new `FALLOW_ROW_COLLECTED`
- Modify: `src/ui/audit-copy/quality.ts` (lines 13, 67, 70), `src/ui/audit-copy/report.ts` (line 17), `src/ui/audit-copy/sources.ts` (lines 7, 38)
- Modify: `src/ui/read-models/evidence-index.ts` (132 → ≈ 150): line 47 and three new exports
- Modify: `src/ui/read-models/sources.ts` (95 → 97): lines 73–86; `src/ui/read-models/overview.ts` (line 133); `src/ui/read-models/findings.ts` (line 163)
- Modify: `src/ui/screens/QualityScreen.vue` (lines 13, 42–44, 152–155), `src/ui/screens/city/LensHeading.vue` (lines 7–17, 42–45), `src/ui/screens/file/FileFindingsPanel.vue` (lines 6, 15–20, 36–39), `src/ui/screens/FileDetailScreen.vue` (line 2 area imports, line 119), `src/ui/screens/quality/FindingReviewDialog.vue` (lines 25–28, 131–135), `src/ui/screens/sources/FallowCardDetails.vue` (lines 8–20, 35–38), `src/ui/screens/sources/FallowReportFacts.vue` (lines 7–11, 40–47), `src/ui/screens/sources/ConnectFallowDialog.vue` (line 42), `src/ui/screens/SourcesScreen.vue` (lines 37–39)
- Modify: `tests/fixtures/evidence-report.ts` (139 → ~158): `collectedEvidenceReport`
- Modify: `tests/unit/finding-copy.test.ts` (line 50), `tests/component/kit-evidence.test.ts` (35 → ~60)
- Test: `tests/unit/fallow-origin-copy.test.ts` (new, ~110), `tests/component/collected-evidence.test.ts` (new, ~120)

**Interfaces:**
- Consumes: Task 3's `originOf`, `EvidenceOrigin`, `CollectedRunProvenance`, `staleReason`; Task 9's `FALLOW_STALE_NOTICE`, `FALLOW_ROW_EXECUTABLE`; `syntheticEvidenceReport`, `attachSyntheticReport`, `buildSnapshotFixture`.
- Produces:
  - `EvidenceBadge.vue` props `{ version: string; state: 'imported' | 'collected' | 'stale'; origin?: 'imported' | 'collected'; untested?: boolean }`
  - `EVIDENCE_BADGE(version, state: 'imported' | 'collected' | 'stale', origin: EvidenceOrigin = 'imported', untested = false)`; the origin parameter, defaulting to `'imported'`, on `FALLOW_PROVENANCE_DETAIL`, `OVERVIEW_FALLOW_SOURCE`, `FALLOW_SOURCE`, `FALLOW_REPLACE_NOTE`, `LENS_SUBTITLE`, `FINDING_DIALOG_PROVIDER_VALUE` (so every Part 6 caller and test keeps its text)
  - `interface EvidenceBadgeProps { version: string; state: 'imported' | 'collected' | 'stale'; origin: EvidenceOrigin; untested: boolean }`; `evidenceBadgeOf(report: EvidenceReport, stale: boolean): EvidenceBadgeProps`; `staleCauseOf(report: EvidenceReport): 'snapshot' | 'failed-run'`
  - `FileFindingsPanel` prop `version: string` becomes `badge: EvidenceBadgeProps | null` (K31)
  - `buildSourcesModel`'s fallow argument gains `origin: EvidenceOrigin`
  - tests: `collectedEvidenceReport(snapshot, versionTested?)`

- [ ] **Step 1: Write the failing tests.**

In `tests/fixtures/evidence-report.ts`, after `syntheticEvidenceReport` add:

```ts
/** Part 7 Z25: the synthetic report as a collected run attaches it (fileName is the
 *  executable's base name; verified source match; stripPrefix null). */
export function collectedEvidenceReport(snapshot: CodebaseSnapshot, versionTested = true): EvidenceReport {
  const base = syntheticEvidenceReport(snapshot);
  return {
    ...base, fileName: 'fallow.exe',
    collected: {
      origin: 'collected', sourceMatch: 'verified', runId: 'run-collected', rootPath: snapshot.scope.rootPath,
      executablePath: 'C:\\Tools\\fallow\\fallow.exe', args: ['--format', 'json', '--no-cache', '--quiet', '--root', snapshot.scope.rootPath],
      exitCode: 0, startedAt: IMPORTED_AT, durationMs: 900, versionTested,
    },
  };
}
```

Create `tests/unit/fallow-origin-copy.test.ts`:

```ts
// Part 7 Z26/Z27: every Part 6 string that named import as the only origin now takes the
// origin, defaulting to 'imported' so every Part 6 text is unchanged; the badge helper and
// the stale cause read the report.
import { describe, expect, it } from 'vitest';
import { evidenceBadgeOf, evidenceIndexFor, staleCauseOf } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildSourcesModel } from '../../src/ui/read-models/sources';
import { findingsCsv, buildQualityModel } from '../../src/ui/read-models/findings';
import {
  EVIDENCE_BADGE, FALLOW_CARD_NONE, FALLOW_DIALOG_INTRO, FALLOW_NOT_ANALYSED, FALLOW_NOT_ANALYSED_BODY, FALLOW_PROVENANCE_DETAIL,
  FALLOW_REPLACE_NOTE, FALLOW_SOME_NOT_ANALYSED, FALLOW_SOURCE, FINDING_DIALOG_PROVIDER_VALUE, LENS_SUBTITLE, OVERVIEW_FALLOW_SOURCE,
  QUALITY_CARD_OPEN_CAPTION_STALE, QUALITY_FOOTNOTE, REPORT_EVIDENCE_TEXT, SOURCES_CALLOUT, SOURCES_PROVIDER,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { collectedEvidenceReport, syntheticEvidenceReport } from '../fixtures/evidence-report';
import { initialScanLifecycleState } from '../../src/application/run-state';

const snap = buildSnapshotFixture({ files: 6, repositoryId: 'p1' });

describe('the badge (Z26)', () => {
  it('reads four ways, and adds "Untested version" for an untested collected run', () => {
    expect(EVIDENCE_BADGE('3.27.0', 'imported')).toBe('fallow 3.27.0 · Imported · Unverified source match');
    expect(EVIDENCE_BADGE('3.27.0', 'stale')).toBe('fallow 3.27.0 · Stale · Unverified source match');
    expect(EVIDENCE_BADGE('3.27.0', 'collected', 'collected')).toBe('fallow 3.27.0 · Collected · Verified source match');
    expect(EVIDENCE_BADGE('3.27.0', 'stale', 'collected')).toBe('fallow 3.27.0 · Stale · Source verified when collected');
    expect(EVIDENCE_BADGE('3.28.0', 'collected', 'collected', true)).toBe('fallow 3.28.0 · Collected · Verified source match · Untested version');
  });

  it('evidenceBadgeOf takes the origin and the untested flag from the report', () => {
    expect(evidenceBadgeOf(syntheticEvidenceReport(snap), false)).toEqual({ version: '3.27.0', state: 'imported', origin: 'imported', untested: false });
    expect(evidenceBadgeOf(collectedEvidenceReport(snap, false), false)).toEqual({ version: '3.27.0', state: 'collected', origin: 'collected', untested: true });
    expect(evidenceBadgeOf(collectedEvidenceReport(snap), true)).toEqual({ version: '3.27.0', state: 'stale', origin: 'collected', untested: false });
  });

  it('staleCauseOf says why evidence is stale', () => {
    expect(staleCauseOf(syntheticEvidenceReport(snap, { snapshotId: 'older' }))).toBe('snapshot');
    expect(staleCauseOf({ ...collectedEvidenceReport(snap), staleReason: 'failed-run' })).toBe('failed-run');
  });
});

describe('origin-aware copy (Z27, spec §2)', () => {
  it('keeps every Part 6 text for an imported report', () => {
    expect(FALLOW_PROVENANCE_DETAIL('3.27.0')).toBe('imported report 3.27.0');
    expect(OVERVIEW_FALLOW_SOURCE('3.27.0')).toBe('Imported fallow 3.27.0 report');
    expect(FALLOW_SOURCE('3.27.0')).toBe('Imported report · fallow 3.27.0');
    expect(FINDING_DIALOG_PROVIDER_VALUE('3.27.0', 'today')).toBe('fallow 3.27.0 · imported report, today');
    expect(LENS_SUBTITLE(5, 2)).toBe('5 findings · 2 files · imported evidence');
    expect(FALLOW_REPLACE_NOTE('today')).toBe('Attaching replaces the report imported today.');
  });

  it('says "collected" for a collected run', () => {
    expect(FALLOW_PROVENANCE_DETAIL('3.27.0', 'collected')).toBe('collected run 3.27.0');
    expect(OVERVIEW_FALLOW_SOURCE('3.27.0', 'collected')).toBe('Collected by fallow 3.27.0');
    expect(FALLOW_SOURCE('3.27.0', 'collected')).toBe('Collected run · fallow 3.27.0');
    expect(FINDING_DIALOG_PROVIDER_VALUE('3.27.0', 'today', 'collected')).toBe('fallow 3.27.0 · collected run, today');
    expect(LENS_SUBTITLE(5, 2, 'collected')).toBe('5 findings · 2 files · collected evidence');
    expect(FALLOW_REPLACE_NOTE('today', 'collected')).toBe('Attaching replaces the findings collected today.');
  });

  it('rewrites the strings that assumed import was the only way in', () => {
    expect(FALLOW_NOT_ANALYSED).toBe('Not analysed. No fallow evidence covers this.');
    expect(FALLOW_SOME_NOT_ANALYSED).toBe('Some finding categories were not analysed in the attached fallow evidence.');
    expect(FALLOW_NOT_ANALYSED_BODY).toBe('No fallow evidence is attached to this codebase, so its findings are unknown, not zero. Import a report or run an installed fallow to see them. Findings are kept for this session only.');
    expect(FALLOW_CARD_NONE).toBe('No findings attached. Imported and collected findings are kept for this session only, so after a restart you import or run again.');
    expect(FALLOW_DIALOG_INTRO).toBe('Keep exploring the structural city while you add analysis. Import a fallow JSON report, or run a fallow that is already installed.');
    expect(QUALITY_CARD_OPEN_CAPTION_STALE(7, 2)).toBe('7 findings in the attached evidence · 2 decided');
    expect(QUALITY_FOOTNOTE).toBe('Findings come from fallow, imported as a report or collected by a run you started, and are kept for this session only. Decisions are saved with this codebase’s review state in the plugin’s own data; the repository is never changed.');
    expect(REPORT_EVIDENCE_TEXT).toBe('File inventory collected by the built-in read-only scan. Static findings come from fallow evidence (an imported report or a run you started) when one is attached for this session, and read Not analysed otherwise. History, coverage, import edges and packages are sample data. Mutation, runtime and secret scanning were not collected.');
    expect(SOURCES_CALLOUT).toBe('The built-in read-only inventory is always available. fallow findings come from a report you import or a run of an installed fallow you start. Every other signal is sample data or not collected.');
    expect(SOURCES_PROVIDER.fallow?.description).toBe('Complexity, duplication and unused exports from a fallow JSON report you import, or from a run of an installed fallow you review and start. Nothing is installed; findings are kept for this session only.');
  });
});

describe('the read models carry the origin (Z27)', () => {
  it('the evidence index marks collected values with the collected provenance detail', () => {
    const index = evidenceIndexFor(fileSummariesFor(snap), collectedEvidenceReport(snap), snap.snapshotId);
    expect(index.totals.findings).toMatchObject({ state: 'collected', provenance: { source: 'fallow', detail: 'collected run 3.27.0' } });
  });

  it('the fallow card source and the CSV provenance say collected', () => {
    const card = buildSourcesModel(snap, initialScanLifecycleState().run, { state: 'current', version: '3.27.0', origin: 'collected' }).providers.find((p) => p.id === 'fallow');
    expect(card?.source).toBe('Collected run · fallow 3.27.0');
    const index = evidenceIndexFor(fileSummariesFor(snap), collectedEvidenceReport(snap), snap.snapshotId);
    const csv = findingsCsv(buildQualityModel(fileSummariesFor(snap), index, []).findings, index);
    expect(csv).toContain('fallow 3.27.0 collected');
  });
});
```


In `tests/unit/finding-copy.test.ts`, replace line 50:

```ts
    expect(REPORT_EVIDENCE_TEXT).toContain('imported fallow report');
```

with:

```ts
    expect(REPORT_EVIDENCE_TEXT).toContain('fallow evidence (an imported report or a run you started)');
```

In `tests/component/kit-evidence.test.ts`, inside `describe('EvidenceBadge (Part 6 Y32, C13)', …)`, after its second `it` ("says Stale in words…"), add:

```ts
  it('Part 7 Z26: renders the collected state with its own class, and the untested flag', () => {
    const w = mount(EvidenceBadge, { props: { version: '3.28.0', state: 'collected', origin: 'collected', untested: true } });
    expect(w.text()).toBe(EVIDENCE_BADGE('3.28.0', 'collected', 'collected', true));
    expect(w.classes()).toContain('ci-evidence-badge--collected');
    w.unmount();
  });
```

(The file already imports `mount`, `EvidenceBadge` and `EVIDENCE_BADGE`.)

Create `tests/component/collected-evidence.test.ts`:

```ts
// Part 7 Z23/Z26/Z27 on real screens: a collected report reads "Collected · Verified source
// match" wherever a badge shows; evidence kept after a failed run says why it is stale; and
// the fallow card names the executable and when it was collected.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import QualityScreen from '../../src/ui/screens/QualityScreen.vue';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { formatAbsoluteTime } from '../../src/ui/copy';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { EVIDENCE_BADGE, FALLOW_ROW_COLLECTED, FALLOW_ROW_EXECUTABLE, FALLOW_STALE_NOTICE } from '../../src/ui/inspector-copy';
import type { EvidenceReport } from '../../src/application/evidence/model';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { collectedEvidenceReport } from '../fixtures/evidence-report';

const provide = { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() };

function attach(report: (snapId: string) => EvidenceReport): EvidenceReport {
  const snap = buildSnapshotFixture({ files: 6, repositoryId: 'p1' });
  useCityStore().setCity(snap, computeLayout(snap));
  const evidence = useEvidenceStore();
  evidence.setRepository(new InMemoryEvidenceStore());
  evidence.bindRepository('p1');
  const r = report(snap.snapshotId);
  expect(evidence.attach(r)).toBe(true);
  return r;
}

beforeEach(() => { setActivePinia(createPinia()); });

describe('collected evidence on the screens (Z26, Z27)', () => {
  it('Quality reads Collected · Verified source match', async () => {
    attach(() => collectedEvidenceReport(buildSnapshotFixture({ files: 6, repositoryId: 'p1' })));
    const w = mount(QualityScreen, { attachTo: document.body, global: { provide } });
    await flushPromises();
    expect(w.find('.ci-quality__evidence .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE('3.27.0', 'collected', 'collected'));
    w.unmount();
  });

  it('after a failed run, Quality says the evidence may not be current, and the badge reads Stale', async () => {
    const report = attach(() => ({ ...collectedEvidenceReport(buildSnapshotFixture({ files: 6, repositoryId: 'p1' })), staleReason: 'failed-run' }));
    const w = mount(QualityScreen, { attachTo: document.body, global: { provide } });
    await flushPromises();
    expect(w.find('.ci-quality__evidence .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE('3.27.0', 'stale', 'collected'));
    expect(w.text()).toContain(FALLOW_STALE_NOTICE(formatAbsoluteTime(report.importedAt, Intl), 'failed-run'));
    w.unmount();
  });

  it('the fallow card names the executable and when it was collected', async () => {
    attach(() => collectedEvidenceReport(buildSnapshotFixture({ files: 6, repositoryId: 'p1' })));
    const w = mount(SourcesScreen, { attachTo: document.body, global: { provide } });
    await flushPromises();
    const rows = w.findAll('.ci-fallow-card .ci-fallow-facts dt').map((dt) => dt.text());
    expect(rows).toContain(FALLOW_ROW_EXECUTABLE);
    expect(rows).toContain(FALLOW_ROW_COLLECTED);
    expect(w.find('.ci-fallow-facts__file').text()).toBe('fallow.exe');
    expect(w.find('.ci-fallow-card .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE('3.27.0', 'collected', 'collected'));
    w.unmount();
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/unit/fallow-origin-copy.test.ts tests/unit/finding-copy.test.ts tests/component/kit-evidence.test.ts tests/component/collected-evidence.test.ts`
Expected: FAIL — `evidenceBadgeOf`/`staleCauseOf` not exported, `EVIDENCE_BADGE(…, 'collected', 'collected')` reads "Imported", the rewritten strings differ, and the card shows "File"/"Imported" rows.

- [ ] **Step 3: Implement.**

In `src/ui/audit-copy/fallow.ts`:
- add `import type { EvidenceOrigin } from '../../application/evidence/model';` beside the existing `raw-fallow` import;
- replace `export const FALLOW_NOT_ANALYSED = 'Not analysed. No imported fallow report covers this.';` with `export const FALLOW_NOT_ANALYSED = 'Not analysed. No fallow evidence covers this.';`
- replace `export const FALLOW_SOME_NOT_ANALYSED = 'Some finding categories were not analysed in the imported report.';` with `export const FALLOW_SOME_NOT_ANALYSED = 'Some finding categories were not analysed in the attached fallow evidence.';`
- replace `export const FALLOW_PROVENANCE_DETAIL = (version: string): string => \`imported report ${version}\`;` with:

```ts
export const FALLOW_PROVENANCE_DETAIL = (version: string, origin: EvidenceOrigin = 'imported'): string =>
  (origin === 'collected' ? `collected run ${version}` : `imported report ${version}`);
```

- replace `export const OVERVIEW_FALLOW_SOURCE = (version: string): string => \`Imported fallow ${version} report\`;` with:

```ts
export const OVERVIEW_FALLOW_SOURCE = (version: string, origin: EvidenceOrigin = 'imported'): string =>
  (origin === 'collected' ? `Collected by fallow ${version}` : `Imported fallow ${version} report`);
```

- replace the two-line `EVIDENCE_BADGE` with:

```ts
/** C13 (R8, Part 7 Z26): provider, version, freshness and source match, in words. An imported
 *  report carries no root or revision, so its match is always unverified (Y27); a collected
 *  run's root was the snapshot's own (Z25). */
export const EVIDENCE_BADGE = (
  version: string, state: 'imported' | 'collected' | 'stale', origin: EvidenceOrigin = 'imported', untested = false,
): string => {
  const freshness = state === 'stale' ? 'Stale' : origin === 'collected' ? 'Collected' : 'Imported';
  const match = origin === 'imported' ? 'Unverified source match' : state === 'stale' ? 'Source verified when collected' : 'Verified source match';
  return `fallow ${version} · ${freshness} · ${match}${untested ? ' · Untested version' : ''}`;
};
```

- replace `FALLOW_NOT_ANALYSED_BODY`'s text with `'No fallow evidence is attached to this codebase, so its findings are unknown, not zero. Import a report or run an installed fallow to see them. Findings are kept for this session only.'`;
- replace `export const FALLOW_SOURCE = (version: string): string => \`Imported report · fallow ${version}\`;` with:

```ts
export const FALLOW_SOURCE = (version: string, origin: EvidenceOrigin = 'imported'): string =>
  (origin === 'collected' ? `Collected run · fallow ${version}` : `Imported report · fallow ${version}`);
```

- replace `FALLOW_CARD_NONE`'s text with `'No findings attached. Imported and collected findings are kept for this session only, so after a restart you import or run again.'`;
- replace `FALLOW_DIALOG_INTRO`'s text with `'Keep exploring the structural city while you add analysis. Import a fallow JSON report, or run a fallow that is already installed.'`;
- replace `export const FALLOW_REPLACE_NOTE = (date: string): string => \`Attaching replaces the report imported ${date}.\`;` with:

```ts
export const FALLOW_REPLACE_NOTE = (date: string, origin: EvidenceOrigin = 'imported'): string =>
  (origin === 'collected' ? `Attaching replaces the findings collected ${date}.` : `Attaching replaces the report imported ${date}.`);
```

- after `export const FALLOW_ROW_IMPORTED = 'Imported';` add `export const FALLOW_ROW_COLLECTED = 'Collected';`
- replace the two-line `LENS_SUBTITLE` with:

```ts
export const LENS_SUBTITLE = (findings: number, files: number, origin: EvidenceOrigin = 'imported'): string =>
  `${nounCount(findings, 'finding', 'findings')} · ${nounCount(files, 'file', 'files')} · ${origin} evidence`;
```

In `src/ui/audit-copy/quality.ts`:
- line 13 becomes `export const QUALITY_CARD_OPEN_CAPTION_STALE = (total: number, decided: number): string => \`${total} findings in the attached evidence · ${decided} decided\`;`
- line 67 becomes `export const QUALITY_FOOTNOTE = 'Findings come from fallow, imported as a report or collected by a run you started, and are kept for this session only. Decisions are saved with this codebase’s review state in the plugin’s own data; the repository is never changed.';`
- line 70 becomes:

```ts
export const FINDING_DIALOG_PROVIDER_VALUE = (version: string, date: string, origin: 'imported' | 'collected' = 'imported'): string =>
  `fallow ${version} · ${origin === 'collected' ? 'collected run' : 'imported report'}, ${date}`;
```

In `src/ui/audit-copy/report.ts`, line 17 becomes `export const REPORT_EVIDENCE_TEXT = 'File inventory collected by the built-in read-only scan. Static findings come from fallow evidence (an imported report or a run you started) when one is attached for this session, and read Not analysed otherwise. History, coverage, import edges and packages are sample data. Mutation, runtime and secret scanning were not collected.';`

In `src/ui/audit-copy/sources.ts`, line 7 becomes `export const SOURCES_CALLOUT = 'The built-in read-only inventory is always available. fallow findings come from a report you import or a run of an installed fallow you start. Every other signal is sample data or not collected.';` and the `fallow` entry of `SOURCES_PROVIDER` (line 38) becomes `  fallow: { title: 'fallow findings', description: 'Complexity, duplication and unused exports from a fallow JSON report you import, or from a run of an installed fallow you review and start. Nothing is installed; findings are kept for this session only.' },`

In `src/ui/read-models/evidence-index.ts`:
- replace the model import (lines 11–13) with:

```ts
import {
  FINDING_CATEGORIES, originOf, type EvidenceFinding, type EvidenceOrigin, type EvidenceReport, type FindingCategory,
} from '../../application/evidence/model';
```

- replace line 47:

```ts
  const provenance = { source: 'fallow', detail: FALLOW_PROVENANCE_DETAIL(report.providerVersion) };
```

with:

```ts
  const provenance = { source: 'fallow', detail: FALLOW_PROVENANCE_DETAIL(report.providerVersion, originOf(report)) };
```

- at the end of the file add:

```ts
/** Part 7 Z26: what the C13 badge shows for a report. */
export interface EvidenceBadgeProps {
  version: string;
  state: 'imported' | 'collected' | 'stale';
  origin: EvidenceOrigin;
  untested: boolean;
}

export function evidenceBadgeOf(report: EvidenceReport, stale: boolean): EvidenceBadgeProps {
  const origin = originOf(report);
  return {
    version: report.providerVersion, state: stale ? 'stale' : origin, origin,
    untested: report.collected !== undefined && !report.collected.versionTested,
  };
}

/** Part 7 Z23/Z27: why stale evidence is stale, for FALLOW_STALE_NOTICE. */
export function staleCauseOf(report: EvidenceReport): 'snapshot' | 'failed-run' {
  return report.staleReason === 'failed-run' ? 'failed-run' : 'snapshot';
}
```

Replace the whole of `src/ui/kit/EvidenceBadge.vue` with:

```vue
<script setup lang="ts">
// Part 6 Y32 (C13, R8), Part 7 Z26: who reported the evidence, how fresh it is and whether its
// source match is verified, as one line of text, never a coloured dot alone. An imported
// report's match is always unverified (Y27); a collected run's is verified (Z25).
import { computed } from 'vue';
import { EVIDENCE_BADGE } from '../inspector-copy';

const props = withDefaults(defineProps<{
  version: string; state: 'imported' | 'collected' | 'stale'; origin?: 'imported' | 'collected'; untested?: boolean;
}>(), { origin: 'imported', untested: false });
const text = computed(() => EVIDENCE_BADGE(props.version, props.state, props.origin, props.untested));
</script>

<template>
  <span
    class="ci-evidence-badge"
    :class="`ci-evidence-badge--${state}`"
  >{{ text }}</span>
</template>
```

In `src/ui/styles/kit.css`, after line 279 (`.ci-evidence-badge--stale`) add:

```css
:where(.codebase-inspector-root) .ci-evidence-badge--collected { border-color: var(--ci-tone-success); }
```

In `src/ui/read-models/sources.ts`, replace:

```ts
interface FallowCardState { state: EvidenceIndexState; version: string | null }
const NO_FALLOW: FallowCardState = { state: 'none', version: null };
```

with:

```ts
/** Part 7 Z27: `origin` is optional, so the Part 6 callers and tests keep their shape. */
interface FallowCardState { state: EvidenceIndexState; version: string | null; origin?: EvidenceOrigin }
const NO_FALLOW: FallowCardState = { state: 'none', version: null };
```

and in `buildSourcesModel` replace `FALLOW_SOURCE(fallow.version)` with `FALLOW_SOURCE(fallow.version, fallow.origin ?? 'imported')`; add `import type { EvidenceOrigin } from '../../application/evidence/model';` to its imports.

In `src/ui/read-models/overview.ts`, line 133 becomes:

```ts
      source: evidence.report ? OVERVIEW_FALLOW_SOURCE(evidence.report.providerVersion, originOf(evidence.report)) : EVIDENCE_SOURCE_NONE },
```

with `import { originOf } from '../../application/evidence/model';` added to its imports.

In `src/ui/read-models/findings.ts`, replace line 163:

```ts
  const provenance = report === null ? 'none' : `fallow ${report.providerVersion} ${evidence.state === 'stale' ? 'stale' : 'imported'}`;
```

with:

```ts
  const provenance = report === null ? 'none' : `fallow ${report.providerVersion} ${evidence.state === 'stale' ? 'stale' : originOf(report)}`;
```

with `import { originOf } from '../../application/evidence/model';` added, and its doc comment's "(`fallow <version> imported`, or `… stale`)" becoming "(`fallow <version> imported` or `collected`, or `… stale`)".

In `src/ui/screens/SourcesScreen.vue`, replace:

```ts
const model = computed(() => buildSourcesModel(store.snapshot, runStore.run, {
  state: evidence.value.state, version: evidence.value.report?.providerVersion ?? null,
}));
```

with:

```ts
const model = computed(() => buildSourcesModel(store.snapshot, runStore.run, {
  state: evidence.value.state, version: evidence.value.report?.providerVersion ?? null,
  origin: evidence.value.report?.collected === undefined ? 'imported' : 'collected',
}));
```

In `src/ui/screens/QualityScreen.vue`:
- in the copy import (line 13) replace `COPY_16, ` with `FALLOW_STALE_NOTICE, `;
- add `import { evidenceBadgeOf, staleCauseOf } from '../read-models/evidence-index';` after the `use-read-models` import;
- replace line 44 with:

```ts
const staleNotice = computed(() => (report.value && stale.value
  ? FALLOW_STALE_NOTICE(formatAbsoluteTime(report.value.importedAt, Intl), staleCauseOf(report.value)) : ''));
```

- replace:

```vue
        <EvidenceBadge
          :version="report.providerVersion"
          :state="stale ? 'stale' : 'imported'"
        />
```

with:

```vue
        <EvidenceBadge v-bind="evidenceBadgeOf(report, stale)" />
```

In `src/ui/screens/city/LensHeading.vue`, replace lines 7–17 with:

```ts
import { computed } from 'vue';
import { useLensView } from '../../read-models/use-lens-view';
import { evidenceBadgeOf, staleCauseOf } from '../../read-models/evidence-index';
import { originOf } from '../../read-models/fallow-candidate';
import { formatAbsoluteTime } from '../../copy';
import { FALLOW_STALE_NOTICE, LENS_EYEBROW, LENS_SUBTITLE, LENS_TITLE } from '../../inspector-copy';
import EvidenceBadge from '../../kit/EvidenceBadge.vue';

const { active, evidence } = useLensView();
const report = computed(() => (active.value ? evidence.value.report : null));
const stale = computed(() => evidence.value.state === 'stale');
const subtitle = computed(() => LENS_SUBTITLE(evidence.value.matchedFindings, evidence.value.matchedFiles, report.value ? originOf(report.value) : 'imported'));
const staleNote = computed(() => (report.value && stale.value
  ? FALLOW_STALE_NOTICE(formatAbsoluteTime(report.value.importedAt, Intl), staleCauseOf(report.value)) : null));
```

and replace:

```vue
    <EvidenceBadge
      :version="report.providerVersion"
      :state="stale ? 'stale' : 'imported'"
    />
```

with:

```vue
    <EvidenceBadge v-bind="evidenceBadgeOf(report, stale)" />
```

In `src/ui/read-models/fallow-candidate.ts`, extend the E20 re-export (line 13) to `export { FINDING_CATEGORIES, originOf, type EvidenceReport } from '../../application/evidence/model';` so screens reach `originOf` through the barrel.

In `src/ui/screens/file/FileFindingsPanel.vue`:
- after line 6 add `import type { EvidenceBadgeProps } from '../../read-models/evidence-index';`;
- in `defineProps`, replace `evidence: EvidenceIndexState; version: string;` with `evidence: EvidenceIndexState; badge: EvidenceBadgeProps | null;` (K31);
- replace:

```vue
      <EvidenceBadge
        :version="version"
        :state="evidence === 'stale' ? 'stale' : 'imported'"
      />
```

with:

```vue
      <EvidenceBadge
        v-if="badge"
        v-bind="badge"
      />
```

In `src/ui/screens/FileDetailScreen.vue`, add `import { evidenceBadgeOf } from '../read-models/evidence-index';` after line 3, and replace line 119:

```vue
          :version="quality.evidence.report?.providerVersion ?? ''"
```

with:

```vue
          :badge="quality.evidence.report ? evidenceBadgeOf(quality.evidence.report, quality.evidence.state === 'stale') : null"
```

In `src/ui/screens/quality/FindingReviewDialog.vue`:
- add `import { evidenceBadgeOf } from '../../read-models/evidence-index';` and `import { originOf } from '../../read-models/fallow-candidate';` after the `use-read-models` import;
- replace line 27:

```ts
  return r ? FINDING_DIALOG_PROVIDER_VALUE(r.providerVersion, formatAbsoluteTime(r.importedAt, Intl)) : '';
```

with:

```ts
  return r ? FINDING_DIALOG_PROVIDER_VALUE(r.providerVersion, formatAbsoluteTime(r.importedAt, Intl), originOf(r)) : '';
```

- replace:

```vue
        <EvidenceBadge
          v-if="quality.evidence.report"
          :version="quality.evidence.report.providerVersion"
          :state="quality.evidence.state === 'stale' ? 'stale' : 'imported'"
        />
```

with:

```vue
        <EvidenceBadge
          v-if="quality.evidence.report"
          v-bind="evidenceBadgeOf(quality.evidence.report, quality.evidence.state === 'stale')"
        />
```

In `src/ui/screens/sources/FallowCardDetails.vue`:
- replace the copy import `import { COPY_16, FALLOW_CARD_NONE, FALLOW_IMPORT_ACTION, FALLOW_IMPORT_HINT, FALLOW_REMOVE } from '../../inspector-copy';` with `import { FALLOW_CARD_NONE, FALLOW_IMPORT_ACTION, FALLOW_IMPORT_HINT, FALLOW_REMOVE, FALLOW_STALE_NOTICE } from '../../inspector-copy';` and add `import { evidenceBadgeOf, staleCauseOf } from '../../read-models/evidence-index';` after the `EvidenceIndex` type import;
- replace the `staleNotice` computed with:

```ts
const staleNotice = computed(() => (report.value && stale.value
  ? FALLOW_STALE_NOTICE(formatAbsoluteTime(report.value.importedAt, Intl), staleCauseOf(report.value)) : ''));
```

- replace:

```vue
      <EvidenceBadge
        :version="report.providerVersion"
        :state="stale ? 'stale' : 'imported'"
      />
```

with:

```vue
      <EvidenceBadge v-bind="evidenceBadgeOf(report, stale)" />
```

In `src/ui/screens/sources/FallowReportFacts.vue`:
- add `FALLOW_ROW_COLLECTED, FALLOW_ROW_EXECUTABLE, ` to the copy import;
- after `const importedAt = computed(…);` add `const collected = computed(() => props.report.collected !== undefined);`
- replace:

```vue
    <dt>{{ FALLOW_ROW_FILE }}</dt>
```

with:

```vue
    <dt>{{ collected ? FALLOW_ROW_EXECUTABLE : FALLOW_ROW_FILE }}</dt>
```

- replace:

```vue
      <dt>{{ FALLOW_ROW_IMPORTED }}</dt>
```

with:

```vue
      <dt>{{ collected ? FALLOW_ROW_COLLECTED : FALLOW_ROW_IMPORTED }}</dt>
```

In `src/ui/screens/sources/ConnectFallowDialog.vue`, replace line 42:

```ts
const replaceNote = computed(() => (evidence.report ? FALLOW_REPLACE_NOTE(formatAbsoluteTime(evidence.report.importedAt, Intl)) : ''));
```

with:

```ts
const replaceNote = computed(() => (evidence.report
  ? FALLOW_REPLACE_NOTE(formatAbsoluteTime(evidence.report.importedAt, Intl), evidence.report.collected === undefined ? 'imported' : 'collected') : ''));
```

- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/unit/fallow-origin-copy.test.ts tests/unit/finding-copy.test.ts tests/component/kit-evidence.test.ts tests/component/collected-evidence.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/ui tests/fixtures/evidence-report.ts tests/unit/fallow-origin-copy.test.ts tests/unit/finding-copy.test.ts tests/component/kit-evidence.test.ts tests/component/collected-evidence.test.ts --max-warnings 0`
Expected: exit 0. `npx vitest run tests/unit/css-class-scope.test.ts tests/unit/kit-css-fallbacks.test.ts` passes (the new class is in `kit.css`).

- [ ] **Step 6: Commit.**

```
git add src/ui/kit/EvidenceBadge.vue src/ui/styles/kit.css src/ui/audit-copy/fallow.ts src/ui/audit-copy/quality.ts src/ui/audit-copy/report.ts src/ui/audit-copy/sources.ts src/ui/read-models/evidence-index.ts src/ui/read-models/sources.ts src/ui/read-models/overview.ts src/ui/read-models/findings.ts src/ui/read-models/fallow-candidate.ts src/ui/screens/QualityScreen.vue src/ui/screens/city/LensHeading.vue src/ui/screens/file/FileFindingsPanel.vue src/ui/screens/FileDetailScreen.vue src/ui/screens/quality/FindingReviewDialog.vue src/ui/screens/sources/FallowCardDetails.vue src/ui/screens/sources/FallowReportFacts.vue src/ui/screens/sources/ConnectFallowDialog.vue src/ui/screens/SourcesScreen.vue tests/fixtures/evidence-report.ts tests/unit/fallow-origin-copy.test.ts tests/unit/finding-copy.test.ts tests/component/kit-evidence.test.ts tests/component/collected-evidence.test.ts
git commit -m "feat(ui): collected evidence on every surface: the Collected badge, origin-aware copy and the failed-run stale notice (Z23, Z26, Z27)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Run the covering tests.**

Run: `npx vitest run tests/unit/fallow-origin-copy.test.ts tests/unit/finding-copy.test.ts tests/unit/evidence-index.test.ts tests/unit/sources-model.test.ts tests/unit/findings-model.test.ts tests/unit/fallow-acceptance.test.ts tests/component/kit-evidence.test.ts tests/component/collected-evidence.test.ts tests/component/quality-fallow.test.ts tests/component/file-findings-fallow.test.ts tests/component/findings-lens.test.ts tests/component/fallow-card.test.ts tests/component/connect-fallow.test.ts tests/unit/css-class-scope.test.ts`
Expected: PASS.

---

### Task 12: Data & scans: the S14 installed route, the review, the run panel and the banner (Z29–Z33, Z35 screen half)

**Files:**
- Create: `src/ui/screens/sources/FallowRunBanner.vue` (~45), `src/ui/screens/sources/FallowRunReview.vue` (~95), `src/ui/screens/sources/FallowInstalledRoute.vue` (~200), `src/ui/screens/sources/FallowRunPanel.vue` (~130), `src/ui/screens/sources/use-fallow-run.ts` (~80)
- Modify: `src/ui/screens/sources/ConnectFallowDialog.vue` (Task 11's ~222 → ≈ 265): the script's imports, props and busy action (lines 9–31); step 1 of the template and the actions row
- Modify: `src/ui/screens/sources/FallowCardDetails.vue` (Task 11's ~86 → ≈ 115)
- Modify: `src/ui/screens/SourcesScreen.vue` (Task 11's ~220 → ≈ 260): imports, dialog state, the run request watcher, the template (Planned integrations panel removed)
- Modify: `src/ui/audit-copy/sources.ts` (51 → 49): delete `SOURCES_PLANNED_TITLE` and `SOURCES_PLANNED` (lines 47–48)
- Modify: `src/ui/styles/screens-configure.css` (84 → ≈ 106): after line 84
- Test: `tests/component/connect-fallow-routes.test.ts` (new, ~230), `tests/component/fallow-run-panel.test.ts` (new, ~250)

**Interfaces:**
- Consumes: Task 9 (`useAnalysisStore`, `InstalledRouteStart`, `FallowRunBanner`, `fallowRunBannerOf`, `refusalBanner`, `LOG_SHOWN_CHARS`, `FALLOW_TESTED_VERSIONS`, the §2 copy, `createFakeFallowAnalysis`, `fakeRunReview`, `HARNESS_EXECUTABLE`); Task 11 (`ConnectFallowDialog`'s origin-aware replace note, `FallowCardDetails`' `evidenceBadgeOf`); `useBusyAction` and `BusyAction` (`src/ui/kit/use-busy-action.ts`); `reannounce`; `useUniqueId`; `formatBytes` (`src/ui/read-models/sources.ts`); `formatAbsoluteTime`; `Icon`; `CiDialog`.
- Produces:
  - `ConnectFallowDialog` props `initialRoute?: 'choose' | 'installed'` (default `'choose'`) and `installed?: InstalledRouteStart`; it emits `done` with `''` when a run started
  - `FallowInstalledRoute` props `{ start?: InstalledRouteStart; action: BusyAction }` (K32: the dialog's own busy action), emits `close` and `started`
  - `FallowRunReview` props `{ review: RunReview }`
  - `FallowRunPanel` props `{ hasSnapshot: boolean; hasEvidence: boolean; busyHintId: string; refusal: { code: FallowRunErrorCode; detail: string } | null }`, emits `run`, `cancel`, `choose`, `forget` (`busyHintId` is the card's one busy-hint element)
  - `FallowRunBanner` props `{ banner: FallowRunBanner }`
  - `FallowCardDetails` gains the prop `refusal` and the emits `run`, `cancel`, `choose`, `forget`
  - `useFallowRun(open: (start: InstalledRouteStart) => void, announce: (message: string) => void, hasEvidence: () => boolean): { refusal: Ref<{ code: FallowRunErrorCode; detail: string } | null>; run(): Promise<void>; cancel(): void; forget(): Promise<void> }`
  - the stable test classes: `.ci-connect-fallow__route`, `.ci-connect-fallow__use-installed`, `.ci-fallow-installed__path`, `.ci-fallow-installed__check`, `.ci-fallow-installed__trust`, `.ci-fallow-installed__change`, `.ci-fallow-installed__retrust`, `.ci-fallow-review`, `.ci-fallow-review__executable`, `.ci-fallow-review__root`, `.ci-fallow-review__cwd`, `.ci-fallow-review__argv`, `.ci-fallow-review__effects`, `.ci-fallow-review__inside`, `.ci-fallow-run`, `.ci-fallow-run__banner`, `.ci-fallow-run__reason`, `.ci-fallow-run__kept`, `.ci-fallow-run__log`, `.ci-fallow-run__facts`, `.ci-fallow-run__run`, `.ci-fallow-run__cancel`, `.ci-fallow-run__choose`, `.ci-fallow-run__forget`, `.ci-fallow-card__busy`

- [ ] **Step 1: Write the failing tests.**

Create `tests/component/connect-fallow-routes.test.ts`:

```ts
// Part 7 Z29–Z31 (S14): the Connect fallow dialog offers two routes; the installed route
// checks a path by inspection only, reviews exactly what will run, and starts only on
// "Trust and run". Every value is text. A new file: connect-fallow.test.ts is at 370 lines.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import {
  FALLOW_DISCLOSURE, FALLOW_EXE_HINT_WINDOWS, FALLOW_EXE_LABEL, FALLOW_INSTALL_NOTE, FALLOW_REVIEW_EFFECTS, FALLOW_REVIEW_INSIDE_ROOT,
  FALLOW_REVIEW_VERSION_PENDING, FALLOW_ROUTE_IMPORT_TITLE, FALLOW_ROUTE_RUN_TEXT, FALLOW_ROUTE_RUN_TITLE, FALLOW_RUN_BUSY_HINT,
  FALLOW_RUN_ERROR,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { createFakeFallowAnalysis, fakeRunReview, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

const mountS = () => mount(SourcesScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() } },
});
type Wrapper = ReturnType<typeof mountS>;

function setup(): { snap: CodebaseSnapshot; fake: FakeFallowAnalysis } {
  const snap = buildSnapshotFixture({ files: 6, repositoryId: 'p1' });
  useCityStore().setCity(snap, computeLayout(snap));
  const evidence = useEvidenceStore();
  evidence.setRepository(new InMemoryEvidenceStore());
  evidence.bindRepository('p1');
  const fake = createFakeFallowAnalysis();
  const analysis = useAnalysisStore();
  analysis.setService(fake);
  analysis.bindRepository('p1');
  return { snap, fake };
}
async function openRoutes(w: Wrapper): Promise<void> {
  await w.find('.ci-fallow-card__import').trigger('click');
  await flushPromises();
}
async function toInstalled(w: Wrapper): Promise<void> {
  await openRoutes(w);
  await w.find('.ci-connect-fallow__use-installed').trigger('click');
  await flushPromises();
}
async function checkPath(w: Wrapper, path: string): Promise<void> {
  await w.find('.ci-fallow-installed__path').setValue(path);
  await w.find('.ci-fallow-installed__check').trigger('click');
  await flushPromises();
}

beforeEach(() => { setActivePinia(createPinia()); });

describe('step 1 offers both routes (Z29)', () => {
  it('shows the import route, the installed route and the disclosure with the install note', async () => {
    setup();
    const w = mountS();
    await openRoutes(w);
    const routes = w.findAll('.ci-connect-fallow__route');
    expect(routes).toHaveLength(2);
    expect(routes[0]!.find('h4').text()).toBe(FALLOW_ROUTE_IMPORT_TITLE);
    expect(routes[0]!.find('.ci-connect-fallow__choose').exists()).toBe(true);
    expect(routes[1]!.find('h4').text()).toBe(FALLOW_ROUTE_RUN_TITLE);
    expect(routes[1]!.text()).toContain(FALLOW_ROUTE_RUN_TEXT);
    expect(routes[1]!.attributes('aria-labelledby')).toBe(routes[1]!.find('h4').attributes('id'));
    expect(w.find('.ci-connect-fallow__disclosure').text()).toBe(`${FALLOW_DISCLOSURE} ${FALLOW_INSTALL_NOTE}`);
    w.unmount();
  });
});

describe('the installed route (Z30, Z31)', () => {
  it('opens on the path step when nothing is bound, with the Windows hint, and checking a path only inspects it', async () => {
    const { fake } = setup();
    const w = mountS();
    await toInstalled(w);
    expect(w.find('label').text()).toBe(FALLOW_EXE_LABEL);
    expect(w.find('.ci-fallow-installed__path').attributes('aria-describedby')).toBeDefined();
    expect(w.text()).toContain(FALLOW_EXE_HINT_WINDOWS);
    await checkPath(w, 'C:\\Tools\\fallow\\fallow.exe');
    expect(fake.calls.map((c) => c.method)).not.toContain('trustAndRun');
    expect(fake.calls.map((c) => c.method)).toContain('review');
    expect(w.find('.ci-fallow-review').exists()).toBe(true);
    w.unmount();
  });

  it('G6: the review shows the exact executable, the root as folder and cwd, one code per argument, the pending version and the effects', async () => {
    const { snap } = setup();
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Program Files\\fallow\\fallow.exe');
    expect(w.find('.ci-fallow-review__executable').text()).toBe('C:\\Program Files\\fallow\\fallow.exe');
    expect(w.find('.ci-fallow-review__root').text()).toBe(snap.scope.rootPath);
    expect(w.find('.ci-fallow-review__cwd').text()).toBe(snap.scope.rootPath);
    expect(w.findAll('.ci-fallow-review__argv code').map((c) => c.text())).toEqual([...FALLOW_RUN_ARGS(snap.scope.rootPath)]);
    expect(w.text()).toContain(FALLOW_REVIEW_VERSION_PENDING);
    expect(w.findAll('.ci-fallow-review__effects li').map((li) => li.text())).toEqual([...FALLOW_REVIEW_EFFECTS]);
    expect(w.find('.ci-fallow-review__inside').exists()).toBe(false);
    w.unmount();
  });

  it('warns when the executable is inside the codebase (Z5)', async () => {
    const { snap, fake } = setup();
    fake.next.review = { ok: true, review: fakeRunReview('p1', snap.snapshotId, snap.scope.rootPath, {
      facts: { ...fakeRunReview('p1', snap.snapshotId, snap.scope.rootPath).facts, insideRoot: true },
    }) };
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\repo\\tools\\fallow.exe');
    expect(w.find('.ci-fallow-review__inside').text()).toBe(FALLOW_REVIEW_INSIDE_ROOT);
    w.unmount();
  });

  it('renders a path with markup as literal text', async () => {
    setup();
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\<img src=x onerror=alert(1)>\\fallow.exe');
    expect(w.find('.ci-fallow-review__executable').text()).toBe('C:\\<img src=x onerror=alert(1)>\\fallow.exe');
    expect(w.find('.ci-fallow-review__executable img').exists()).toBe(false);
    w.unmount();
  });

  it('a refused check is shown in the dialog\'s alert, and nothing else happens', async () => {
    const { fake } = setup();
    fake.next.review = { ok: false, code: 'executable-refused', detail: 'launcher:fallow.exe' };
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Tools\\fallow.cmd');
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_RUN_ERROR['executable-refused']('launcher:fallow.exe'));
    expect(w.find('.ci-fallow-review').exists()).toBe(false);
    w.unmount();
  });

  it('Trust and run starts through the service and closes the dialog; Change path goes back', async () => {
    const { fake } = setup();
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Tools\\fallow\\fallow.exe');
    await w.find('.ci-fallow-installed__change').trigger('click');
    await flushPromises();
    expect((w.find('.ci-fallow-installed__path').element as HTMLInputElement).value).toBe('C:\\Tools\\fallow\\fallow.exe');
    await w.find('.ci-fallow-installed__check').trigger('click');
    await flushPromises();
    await w.find('.ci-fallow-installed__trust').trigger('click');
    await flushPromises();
    expect(fake.calls.map((c) => c.method)).toContain('trustAndRun');
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });

  it('a refused or busy Trust and run stays in the dialog with its reason', async () => {
    const { fake } = setup();
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Tools\\fallow\\fallow.exe');
    fake.next.trustAndRun = { kind: 'refused', code: 'root-unavailable', detail: '' };
    await w.find('.ci-fallow-installed__trust').trigger('click');
    await flushPromises();
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_RUN_ERROR['root-unavailable'](''));
    fake.next.trustAndRun = { kind: 'busy' };
    await w.find('.ci-fallow-installed__trust').trigger('click');
    await flushPromises();
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_RUN_BUSY_HINT);
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    w.unmount();
  });

  it('a file that changed since the review reopens a fresh review saying why', async () => {
    const { fake } = setup();
    const w = mountS();
    await toInstalled(w);
    await checkPath(w, 'C:\\Tools\\fallow\\fallow.exe');
    fake.next.trustAndRun = { kind: 'refused', code: 'changed-since-review', detail: '' };
    await w.find('.ci-fallow-installed__trust').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-installed__retrust').exists()).toBe(true);
    expect(w.find('[role="alert"]').text()).toBe(FALLOW_RUN_ERROR['changed-since-review'](''));
    w.unmount();
  });
});
```

Create `tests/component/fallow-run-panel.test.ts`:

```ts
// Part 7 Z32–Z35 on Data & scans: the fallow card's run controls per state, the C16 banner,
// the blocked controls while a run is in flight, the command's run request, and one
// announcement per finished run. The Planned integrations panel is gone.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { computeLayout } from '../../src/domain/layout/layout';
import type { AnalysisIdentity } from '../../src/application/analysis/analysis-state';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import {
  COPY_15, FALLOW_EXE_CHANGE, FALLOW_EXE_CHOOSE, FALLOW_EXE_NONE, FALLOW_RUN_BUSY_HINT, FALLOW_RUN_CANCELLED, FALLOW_RUN_COMPLETED,
  FALLOW_RUN_ERROR, FALLOW_RUN_HINT, FALLOW_RUN_KEPT, FALLOW_TRUST_VALUE,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport } from '../fixtures/evidence-report';
import { createFakeFallowAnalysis, fakeRunReview, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';

const ID: AnalysisIdentity = { profileId: 'p1', snapshotId: 'snapshot-fixture', rootFingerprint: 'a', subjectFingerprint: 'b', runId: 'r1', generation: 0 };
const AT = '2026-09-23T10:00:00.000Z';
const RUNNING = { status: 'running', identity: ID, rootPath: '/fixture/root', startedAt: AT, timeoutSeconds: 120, version: '3.27.0', tested: true } as const;
const BOUND = { kind: 'bound', binding: { profileId: 'p1', executablePath: 'C:\\Tools\\fallow\\fallow.exe', timeoutSeconds: 120, trust: null } } as const;

const mountS = () => mount(SourcesScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() } },
});

function setup(options: { snapshot?: boolean; evidence?: boolean } = {}): FakeFallowAnalysis {
  const fake = createFakeFallowAnalysis();
  const analysis = useAnalysisStore();
  analysis.setService(fake);
  const evidence = useEvidenceStore();
  evidence.setRepository(new InMemoryEvidenceStore());
  if (options.snapshot !== false) {
    const snap = buildSnapshotFixture({ files: 6, repositoryId: 'p1' });
    useCityStore().setCity(snap, computeLayout(snap));
    if (options.evidence) attachSyntheticReport(snap);
    evidence.bindRepository('p1');
    analysis.bindRepository('p1');
  }
  return fake;
}

beforeEach(() => { setActivePinia(createPinia()); });

describe('the run panel (Z32)', () => {
  it('without a snapshot: Run and Choose are aria-disabled with the hint, and nothing is emitted', async () => {
    const fake = setup({ snapshot: false });
    const w = mountS();
    await flushPromises();
    const run = w.find('.ci-fallow-run__run');
    expect(run.attributes('aria-disabled')).toBe('true');
    expect(w.find(`#${run.attributes('aria-describedby') ?? 'missing'}`).text()).toBe(FALLOW_RUN_HINT);
    await run.trigger('click');
    expect(fake.calls.map((c) => c.method)).not.toContain('run');
    w.unmount();
  });

  it('idle and unbound: Run, Choose executable…, no Forget, and the none text', async () => {
    setup();
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-fallow-run__run').attributes('aria-disabled')).toBeUndefined();
    expect(w.find('.ci-fallow-run__choose').text()).toBe(FALLOW_EXE_CHOOSE);
    expect(w.find('.ci-fallow-run__forget').exists()).toBe(false);
    expect(w.find('.ci-fallow-run__facts').text()).toContain(FALLOW_EXE_NONE);
    expect(w.text()).not.toContain('Planned integrations');
    w.unmount();
  });

  it('bound: the path, the trust state, Change executable…, and Forget', async () => {
    const fake = setup();
    fake.setBinding('p1', BOUND);
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-fallow-run__facts code').text()).toBe('C:\\Tools\\fallow\\fallow.exe');
    expect(w.find('.ci-fallow-run__facts').text()).toContain(FALLOW_TRUST_VALUE(null, false));
    expect(w.find('.ci-fallow-run__choose').text()).toBe(FALLOW_EXE_CHANGE);
    expect(w.find('.ci-fallow-run__forget').exists()).toBe(true);
    w.unmount();
  });

  it('while running: Cancel replaces Run, and Import, Remove, Change and Forget are blocked with the busy hint', async () => {
    const fake = setup({ evidence: true });
    fake.setBinding('p1', BOUND);
    fake.setState('p1', RUNNING);
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-fallow-run__run').exists()).toBe(false);
    for (const cls of ['.ci-fallow-card__import', '.ci-fallow-card__remove', '.ci-fallow-run__choose', '.ci-fallow-run__forget']) {
      expect(w.find(cls).attributes('aria-disabled'), cls).toBe('true');
    }
    expect(w.find('.ci-fallow-card__busy').text()).toBe(FALLOW_RUN_BUSY_HINT);
    await w.find('.ci-fallow-card__import').trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    await w.find('.ci-fallow-run__cancel').trigger('click');
    expect(fake.calls.filter((c) => c.method === 'cancel')).toEqual([{ method: 'cancel', profileId: 'p1' }]);
    w.unmount();
  });

  it('Forget calls the service and announces', async () => {
    const fake = setup();
    fake.setBinding('p1', BOUND);
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__forget').trigger('click');
    await flushPromises();
    expect(fake.calls.map((c) => c.method)).toContain('forget');
    expect(w.find('.ci-sources__live').text()).toContain('fallow executable forgotten');
    w.unmount();
  });
});

describe('the run banner (Z33)', () => {
  it('shows the running text, with the folder and the limit', async () => {
    const fake = setup();
    fake.setState('p1', RUNNING);
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-fallow-run__banner').attributes('role')).toBe('status');
    expect(w.find('.ci-fallow-run__banner').text()).toContain('fallow is analysing “root”');
    w.unmount();
  });

  it('a failure shows COPY-15, the reason, that the findings were kept, and the log as text', async () => {
    const fake = setup({ evidence: true });
    fake.setState('p1', { status: 'failed', runId: 'r1', code: 'analyzer-error', detail: 'bad root', logExcerpt: '<img src=x onerror=alert(1)>', evidenceKept: true, finishedAt: AT });
    const w = mountS();
    await flushPromises();
    const banner = w.find('.ci-fallow-run__banner');
    expect(banner.text()).toContain(COPY_15('fallow'));
    expect(w.find('.ci-fallow-run__reason').text()).toBe(FALLOW_RUN_ERROR['analyzer-error']('bad root'));
    expect(w.find('.ci-fallow-run__kept').text()).toBe(FALLOW_RUN_KEPT);
    expect(w.find('.ci-fallow-run__log pre').text()).toBe('<img src=x onerror=alert(1)>');
    expect(w.find('.ci-fallow-run__log img').exists()).toBe(false);
    w.unmount();
  });
});

describe('Run and the command request (Z32, Z35)', () => {
  it('Run with trust starts through the service and shows no dialog', async () => {
    const fake = setup();
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__run').trigger('click');
    await flushPromises();
    expect(fake.calls.map((c) => c.method)).toContain('run');
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    w.unmount();
  });

  it('a review outcome opens the dialog on the review step; choose-executable on the path step', async () => {
    const fake = setup();
    fake.next.run = { kind: 'review', review: fakeRunReview('p1', 'snapshot-fixture', '/fixture/root'), reason: 'untrusted' };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__run').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-review').exists()).toBe(true);
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    await flushPromises();
    fake.next.run = { kind: 'choose-executable', read: { kind: 'none' } };
    await w.find('.ci-fallow-run__run').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-installed__path').exists()).toBe(true);
    w.unmount();
  });

  it('a refused Run shows the failed form and announces the reason', async () => {
    const fake = setup();
    fake.next.run = { kind: 'refused', code: 'root-unavailable', detail: '' };
    const w = mountS();
    await flushPromises();
    await w.find('.ci-fallow-run__run').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-run__reason').text()).toBe(FALLOW_RUN_ERROR['root-unavailable'](''));
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_RUN_ERROR['root-unavailable'](''));
    w.unmount();
  });

  it('the command\'s run request is consumed once and runs', async () => {
    const fake = setup();
    useAnalysisStore().requestRun();
    const w = mountS();
    await flushPromises();
    expect(fake.calls.filter((c) => c.method === 'run')).toHaveLength(1);
    expect(useAnalysisStore().runRequested).toBe(false);
    w.unmount();
  });
});

describe('announcements (Z33, E17)', () => {
  it('announces a finished run once per run id, and not a run that had finished before the screen opened', async () => {
    const fake = setup();
    fake.setState('p1', { status: 'cancelled', runId: 'r0' });
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-sources__live').text()).toBe('');
    fake.setState('p1', RUNNING);
    fake.setState('p1', { status: 'completed', runId: 'r1', finishedAt: AT, version: '3.27.0', tested: true, matchedFindings: 5, matchedFiles: 4 });
    await flushPromises();
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_RUN_COMPLETED(5, 4));
    fake.setState('p1', { status: 'cancelled', runId: 'r2' });
    await flushPromises();
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_RUN_CANCELLED);
    w.unmount();
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/component/connect-fallow-routes.test.ts tests/component/fallow-run-panel.test.ts`
Expected: FAIL — no `.ci-connect-fallow__route` or `.ci-fallow-run__run` exists yet, and the Planned integrations text is still on screen.

- [ ] **Step 3: Implement.**

Create `src/ui/screens/sources/FallowRunBanner.vue`:

```vue
<script setup lang="ts">
// Part 7 Z33 (C16): the provider's status banner on the fallow card. Text first, with an
// icon; role="status". A failure shows COPY-15, its reason, whether the previous findings
// were kept (marked stale), and the last lines of fallow's error output, as text only.
import type { FallowRunBanner } from '../../read-models/fallow-run';
import { FALLOW_RUN_KEPT, FALLOW_RUN_LOG } from '../../inspector-copy';
import Icon from '../../kit/Icon.vue';

defineProps<{ banner: FallowRunBanner }>();
</script>

<template>
  <div
    class="ci-fallow-run__banner"
    :class="`ci-fallow-run__banner--${banner.tone}`"
    role="status"
  >
    <p class="ci-fallow-run__banner-text">
      <Icon :name="banner.icon" />
      {{ banner.text }}
    </p>
    <p
      v-if="banner.reason"
      class="ci-fallow-run__reason"
    >
      {{ banner.reason }}
    </p>
    <p
      v-if="banner.kept"
      class="ci-fallow-run__kept"
    >
      {{ FALLOW_RUN_KEPT }}
    </p>
    <details
      v-if="banner.log"
      class="ci-fallow-run__log"
    >
      <summary>{{ FALLOW_RUN_LOG }}</summary>
      <pre>{{ banner.log }}</pre>
    </details>
  </div>
</template>
```

Create `src/ui/screens/sources/FallowRunReview.vue`:

```vue
<script setup lang="ts">
// Part 7 Z31: exactly what will run, as text. Every path is in a <code>; the arguments are one
// <code> per argv item, so nothing is re-quoted; the side effects come before "Trust and
// run" (which the route renders after this). The version is checked only after trusting.
import { computed } from 'vue';
import { formatAbsoluteTime } from '../../copy';
import { formatBytes } from '../../read-models/sources';
import { FALLOW_TESTED_VERSIONS, type RunReview } from '../../read-models/fallow-run';
import {
  FALLOW_FORMAT_LABEL, FALLOW_REVIEW_EFFECTS, FALLOW_REVIEW_EFFECTS_TITLE, FALLOW_REVIEW_ENV, FALLOW_REVIEW_INSIDE_ROOT,
  FALLOW_REVIEW_LIMIT, FALLOW_REVIEW_ROW_ARGS, FALLOW_REVIEW_ROW_CWD, FALLOW_REVIEW_ROW_ENV, FALLOW_REVIEW_ROW_EXECUTABLE,
  FALLOW_REVIEW_ROW_FOLDER, FALLOW_REVIEW_ROW_FORMAT, FALLOW_REVIEW_ROW_LIMIT, FALLOW_REVIEW_ROW_MODIFIED, FALLOW_REVIEW_ROW_SIZE,
  FALLOW_REVIEW_ROW_VERSION, FALLOW_REVIEW_VERSION_KNOWN, FALLOW_REVIEW_VERSION_PENDING,
} from '../../inspector-copy';

const props = defineProps<{ review: RunReview }>();
const modified = computed(() => formatAbsoluteTime(new Date(props.review.facts.mtimeMs).toISOString(), Intl));
const realDiffers = computed(() => props.review.facts.realPath !== props.review.facts.executablePath);
const version = computed(() => {
  const v = props.review.trustedVersion;
  return v === null ? FALLOW_REVIEW_VERSION_PENDING : FALLOW_REVIEW_VERSION_KNOWN(v, FALLOW_TESTED_VERSIONS.includes(v));
});
</script>

<template>
  <div class="ci-fallow-review">
    <dl class="ci-fallow-review__facts">
      <dt>{{ FALLOW_REVIEW_ROW_EXECUTABLE }}</dt>
      <dd class="ci-fallow-review__executable">
        <code>{{ review.facts.executablePath }}</code>
        <template v-if="realDiffers">
          → <code>{{ review.facts.realPath }}</code>
        </template>
      </dd>
      <dt>{{ FALLOW_REVIEW_ROW_SIZE }}</dt>
      <dd>{{ formatBytes(review.facts.size) }}</dd>
      <dt>{{ FALLOW_REVIEW_ROW_MODIFIED }}</dt>
      <dd>{{ modified }}</dd>
      <dt>{{ FALLOW_REVIEW_ROW_FORMAT }}</dt>
      <dd>{{ FALLOW_FORMAT_LABEL[review.facts.format] }}</dd>
      <dt>{{ FALLOW_REVIEW_ROW_FOLDER }}</dt>
      <dd class="ci-fallow-review__root">
        <code>{{ review.rootPath }}</code>
      </dd>
      <dt>{{ FALLOW_REVIEW_ROW_CWD }}</dt>
      <dd class="ci-fallow-review__cwd">
        <code>{{ review.rootPath }}</code>
      </dd>
      <dt>{{ FALLOW_REVIEW_ROW_ARGS }}</dt>
      <dd>
        <ol class="ci-fallow-review__argv">
          <li
            v-for="(arg, i) in review.args"
            :key="i"
          >
            <code>{{ arg }}</code>
          </li>
        </ol>
      </dd>
      <dt>{{ FALLOW_REVIEW_ROW_ENV }}</dt>
      <dd>{{ FALLOW_REVIEW_ENV }}</dd>
      <dt>{{ FALLOW_REVIEW_ROW_LIMIT }}</dt>
      <dd>{{ FALLOW_REVIEW_LIMIT(review.timeoutSeconds) }}</dd>
      <dt>{{ FALLOW_REVIEW_ROW_VERSION }}</dt>
      <dd>{{ version }}</dd>
    </dl>
    <h4>{{ FALLOW_REVIEW_EFFECTS_TITLE }}</h4>
    <ul class="ci-fallow-review__effects">
      <li
        v-for="line in FALLOW_REVIEW_EFFECTS"
        :key="line"
      >
        {{ line }}
      </li>
    </ul>
    <p
      v-if="review.facts.insideRoot"
      class="ci-fallow-review__inside"
    >
      {{ FALLOW_REVIEW_INSIDE_ROOT }}
    </p>
  </div>
</template>
```

Create `src/ui/screens/sources/FallowInstalledRoute.vue`:

```vue
<script setup lang="ts">
// Part 7 Z30/Z31: the S14 installed-analyzer route, inside the Connect fallow dialog. A path,
// then the review of exactly what will run, then "Trust and run". Checking a path only
// INSPECTS it (a stat and 4 bytes); nothing runs before "Trust and run", and the version
// probe happens only after it. It shares the dialog's busy action (K32), so Cancel, Escape
// and the backdrop stay ignored while a check or a start is in flight (Part 4 E13), and its
// refusals land in the dialog's one role="alert". The codebase is checked again around each
// async step (Part 6 E36); a late answer after a switch is dropped.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import type { CodebaseSnapshot } from '../../../domain/model';
import { useCityStore } from '../../stores/city-store';
import { useAnalysisStore } from '../../stores/analysis-store';
import { useUniqueId } from '../../unique-id';
import type { BusyAction } from '../../kit/use-busy-action';
import { reannounce } from '../../kit/reannounce';
import type { InstalledRouteStart, RunReview } from '../../read-models/fallow-run';
import {
  FALLOW_CANCEL, FALLOW_CHANGE_PATH, FALLOW_EXE_CHECK, FALLOW_EXE_HINT_POSIX, FALLOW_EXE_HINT_WINDOWS, FALLOW_EXE_LABEL,
  FALLOW_EXE_REFUSED, FALLOW_INSTALL_NOTE, FALLOW_REVIEW_RETRUST, FALLOW_REVIEW_TITLE_RUN, FALLOW_ROUTE_RUN_TITLE,
  FALLOW_RUN_BUSY_HINT, FALLOW_RUN_ERROR, FALLOW_TRUST_AND_RUN,
} from '../../inspector-copy';
import FallowRunReview from './FallowRunReview.vue';

const props = defineProps<{ start?: InstalledRouteStart; action: BusyAction }>();
const emit = defineEmits<{ close: []; started: [] }>();
const city = useCityStore();
const analysis = useAnalysisStore();
const pathId = useUniqueId('ci-fallow-exe-path');
const hintId = useUniqueId('ci-fallow-exe-hint');
/** Part 6 E36: the codebase this route was opened for. */
const repositoryId = city.snapshot?.repositoryId ?? '';
const step = ref<'path' | 'review'>('path');
const path = ref('');
const review = shallowRef<RunReview | null>(null);
const retrust = ref(false);
const heading = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const hint = computed(() => (analysis.binding?.executableName === 'fallow' ? FALLOW_EXE_HINT_POSIX : FALLOW_EXE_HINT_WINDOWS));
const UNREADABLE = FALLOW_EXE_REFUSED.unreadable('UNKNOWN');
let disposed = false;
onBeforeUnmount(() => { disposed = true; });

const bound = (): boolean =>
  repositoryId !== '' && city.snapshot?.repositoryId === repositoryId && analysis.repositoryId === repositoryId;
function drop(): void {
  if (!disposed) emit('close');
}
async function focusHeading(): Promise<void> {
  await nextTick();
  if (!disposed) heading.value?.focus();
}
async function showReview(next: RunReview, changed: boolean): Promise<void> {
  review.value = next;
  retrust.value = changed;
  path.value = next.facts.executablePath;
  step.value = 'review';
  await focusHeading();
}

/** Inspection only: nothing runs and nothing is stored. */
async function check(): Promise<void> {
  const snapshot = city.snapshot;
  if (props.action.busy.value) return;
  if (!snapshot || !bound()) { drop(); return; }
  await props.action.run(async () => {
    const result = await analysis.review(snapshot, path.value);
    if (!bound()) { drop(); return; }
    if (result === null) return;
    if (!result.ok) { await reannounce(props.action.error, FALLOW_RUN_ERROR[result.code](result.detail)); return; }
    await showReview(result.review, false);
  }, UNREADABLE);
}

async function reviewAgain(snapshot: CodebaseSnapshot, executablePath: string): Promise<void> {
  const result = await analysis.review(snapshot, executablePath);
  if (result === null) return;
  if (!result.ok) { await reannounce(props.action.error, FALLOW_RUN_ERROR[result.code](result.detail)); return; }
  await showReview(result.review, true);
  await reannounce(props.action.error, FALLOW_RUN_ERROR['changed-since-review'](''));
}

async function trustAndRun(): Promise<void> {
  const snapshot = city.snapshot;
  const reviewed = review.value;
  if (props.action.busy.value || reviewed === null) return;
  if (!snapshot || !bound()) { drop(); return; }
  await props.action.run(async () => {
    const outcome = await analysis.trustAndRun(snapshot, reviewed);
    if (!bound()) { drop(); return; }
    if (outcome === null) return;
    if (outcome.kind === 'started') { emit('started'); return; }
    if (outcome.kind === 'busy') { await reannounce(props.action.error, FALLOW_RUN_BUSY_HINT); return; }
    if (outcome.kind !== 'refused') return;
    if (outcome.code === 'changed-since-review') { await reviewAgain(snapshot, reviewed.facts.executablePath); return; }
    await reannounce(props.action.error, FALLOW_RUN_ERROR[outcome.code](outcome.detail));
  }, UNREADABLE);
}

function changePath(): void {
  if (props.action.busy.value) return;
  step.value = 'path';
  review.value = null;
  props.action.error.value = '';
  void nextTick(() => { input.value?.focus(); });
}

function cancel(): void {
  if (props.action.busy.value) return;
  emit('close');
}

onMounted(() => {
  const binding = analysis.binding;
  if (binding?.kind === 'bound') path.value = binding.binding.executablePath;
  const start = props.start;
  if (start?.startAt === 'review') { void showReview(start.review, start.reason === 'changed'); return; }
  if (start?.startAt === 'path' || binding?.kind !== 'bound') { void focusHeading(); return; }
  void check();
});
</script>

<template>
  <div class="ci-fallow-installed">
    <template v-if="step === 'path' || review === null">
      <h3
        ref="heading"
        tabindex="-1"
      >
        {{ FALLOW_ROUTE_RUN_TITLE }}
      </h3>
      <label
        :for="pathId"
        class="ci-fallow-installed__label"
      >{{ FALLOW_EXE_LABEL }}</label>
      <input
        :id="pathId"
        ref="input"
        v-model="path"
        type="text"
        class="ci-fallow-installed__path"
        spellcheck="false"
        autocomplete="off"
        :aria-describedby="hintId"
        @keydown.enter.prevent="check"
      >
      <p
        :id="hintId"
        class="ci-note"
      >
        {{ hint }} {{ FALLOW_INSTALL_NOTE }}
      </p>
    </template>
    <template v-else>
      <h3
        ref="heading"
        tabindex="-1"
      >
        {{ FALLOW_REVIEW_TITLE_RUN }}
      </h3>
      <p
        v-if="retrust"
        class="ci-fallow-installed__retrust"
      >
        {{ FALLOW_REVIEW_RETRUST }}
      </p>
      <FallowRunReview :review="review" />
    </template>
    <div class="ci-connect-fallow__actions">
      <button
        type="button"
        class="ci-connect-fallow__cancel"
        :aria-disabled="action.busy.value ? 'true' : undefined"
        @click="cancel"
      >
        {{ FALLOW_CANCEL }}
      </button>
      <button
        v-if="step === 'review' && review !== null"
        type="button"
        class="ci-fallow-installed__change"
        :aria-disabled="action.busy.value ? 'true' : undefined"
        @click="changePath"
      >
        {{ FALLOW_CHANGE_PATH }}
      </button>
      <button
        v-if="step === 'path' || review === null"
        type="button"
        class="mod-cta ci-fallow-installed__check"
        :aria-disabled="action.busy.value ? 'true' : undefined"
        @click="check"
      >
        {{ FALLOW_EXE_CHECK }}
      </button>
      <button
        v-else
        type="button"
        class="mod-cta ci-fallow-installed__trust"
        :aria-disabled="action.busy.value ? 'true' : undefined"
        @click="trustAndRun"
      >
        {{ FALLOW_TRUST_AND_RUN }}
      </button>
    </div>
  </div>
</template>
```

Create `src/ui/screens/sources/FallowRunPanel.vue`:

```vue
<script setup lang="ts">
// Part 7 Z32/Z33: the run half of the fallow card: the C16 banner, the executable, its trust
// and its time limit, and Run / Cancel analysis / Choose or Change executable… / Forget
// executable. The panel reports presses; SourcesScreen (use-fallow-run.ts) acts on them.
// Blocked controls stay focusable (aria-disabled plus a guarded handler, E40).
import { computed } from 'vue';
import { useAnalysisStore } from '../../stores/analysis-store';
import { useUniqueId } from '../../unique-id';
import { FALLOW_TESTED_VERSIONS, fallowRunBannerOf, refusalBanner, type FallowRunErrorCode } from '../../read-models/fallow-run';
import {
  FALLOW_EXE_CHANGE, FALLOW_EXE_CHOOSE, FALLOW_EXE_FORGET, FALLOW_EXE_INVALID, FALLOW_EXE_NONE, FALLOW_EXE_OTHER_DEVICE,
  FALLOW_EXE_UNSUPPORTED, FALLOW_LIMIT_VALUE, FALLOW_ROW_EXECUTABLE, FALLOW_ROW_LIMIT, FALLOW_ROW_TRUST, FALLOW_RUN_ACTION,
  FALLOW_RUN_CANCEL, FALLOW_RUN_HINT, FALLOW_TRUST_VALUE,
} from '../../inspector-copy';
import FallowRunBanner from './FallowRunBanner.vue';

const props = defineProps<{
  hasSnapshot: boolean; hasEvidence: boolean; busyHintId: string;
  refusal: { code: FallowRunErrorCode; detail: string } | null;
}>();
const emit = defineEmits<{ run: []; cancel: []; choose: []; forget: [] }>();
const analysis = useAnalysisStore();
const runHintId = useUniqueId('ci-fallow-run-hint');

const banner = computed(() => (props.refusal !== null && !analysis.active
  ? refusalBanner(props.refusal.code, props.refusal.detail)
  : fallowRunBannerOf(analysis.run, props.hasEvidence)));
const bound = computed(() => (analysis.binding?.kind === 'bound' ? analysis.binding.binding : null));
const executableText = computed(() => {
  const read = analysis.binding;
  if (read === null || read.kind === 'none') return FALLOW_EXE_NONE;
  if (read.kind === 'other-machine') return FALLOW_EXE_OTHER_DEVICE;
  if (read.kind === 'invalid') return FALLOW_EXE_INVALID;
  if (read.kind === 'unsupported') return FALLOW_EXE_UNSUPPORTED;
  return read.binding.executablePath;
});
const trustText = computed(() => {
  const b = bound.value;
  if (b === null) return null;
  const version = b.trust?.version ?? null;
  return FALLOW_TRUST_VALUE(version, version !== null && FALLOW_TESTED_VERSIONS.includes(version));
});
const canForget = computed(() => analysis.binding !== null && analysis.binding.kind !== 'none' && analysis.binding.kind !== 'unsupported');
const chooseBlocked = computed(() => analysis.active || !props.hasSnapshot);

function run(): void {
  if (!props.hasSnapshot || analysis.active) return;
  emit('run');
}
function cancel(): void {
  if (!analysis.cancellable) return;
  emit('cancel');
}
function choose(): void {
  if (chooseBlocked.value) return;
  emit('choose');
}
function forget(): void {
  if (analysis.active) return;
  emit('forget');
}
</script>

<template>
  <div class="ci-fallow-run">
    <FallowRunBanner
      v-if="banner"
      :banner="banner"
    />
    <dl class="ci-fallow-run__facts">
      <dt>{{ FALLOW_ROW_EXECUTABLE }}</dt>
      <dd>
        <code v-if="bound">{{ executableText }}</code>
        <template v-else>
          {{ executableText }}
        </template>
      </dd>
      <template v-if="trustText">
        <dt>{{ FALLOW_ROW_TRUST }}</dt>
        <dd>{{ trustText }}</dd>
      </template>
      <template v-if="bound">
        <dt>{{ FALLOW_ROW_LIMIT }}</dt>
        <dd>{{ FALLOW_LIMIT_VALUE(bound.timeoutSeconds) }}</dd>
      </template>
    </dl>
    <p
      v-if="!hasSnapshot"
      :id="runHintId"
      class="ci-note ci-fallow-run__hint"
    >
      {{ FALLOW_RUN_HINT }}
    </p>
    <div class="ci-fallow-run__actions">
      <button
        v-if="analysis.cancellable"
        type="button"
        class="ci-fallow-run__cancel"
        @click="cancel"
      >
        {{ FALLOW_RUN_CANCEL }}
      </button>
      <button
        v-else-if="!analysis.active"
        type="button"
        class="mod-cta ci-fallow-run__run"
        :aria-disabled="hasSnapshot ? undefined : 'true'"
        :aria-describedby="hasSnapshot ? undefined : runHintId"
        @click="run"
      >
        {{ FALLOW_RUN_ACTION }}
      </button>
      <button
        type="button"
        class="ci-fallow-run__choose"
        :aria-disabled="chooseBlocked ? 'true' : undefined"
        :aria-describedby="!hasSnapshot ? runHintId : analysis.active ? busyHintId : undefined"
        @click="choose"
      >
        {{ bound ? FALLOW_EXE_CHANGE : FALLOW_EXE_CHOOSE }}
      </button>
      <button
        v-if="canForget"
        type="button"
        class="ci-fallow-run__forget"
        :aria-disabled="analysis.active ? 'true' : undefined"
        :aria-describedby="analysis.active ? busyHintId : undefined"
        @click="forget"
      >
        {{ FALLOW_EXE_FORGET }}
      </button>
    </div>
  </div>
</template>
```

(`busyHintId` is the id of `FallowCardDetails`' one busy hint, `.ci-fallow-card__busy`, so the four blocked controls point at the same sentence.)

Replace the whole of `src/ui/screens/sources/FallowCardDetails.vue` (Task 11's version) with:

```vue
<script setup lang="ts">
// Part 6 Y31/Y37, Part 7 Z32: the fallow card's state, diagnostics and actions, and its run
// half (FallowRunPanel). The card runs nothing: every press is reported to SourcesScreen.
// While a run is in flight, Import and Remove are blocked too: changing the evidence mid-run
// would supersede it (Z20). Blocked controls stay focusable (aria-disabled plus a guard, E40).
import { computed } from 'vue';
import { formatAbsoluteTime } from '../../copy';
import type { EvidenceIndex } from '../../read-models/evidence-index';
import { evidenceBadgeOf, staleCauseOf } from '../../read-models/evidence-index';
import { unmatchedOf } from '../../read-models/fallow-candidate';
import type { FallowRunErrorCode } from '../../read-models/fallow-run';
import { useAnalysisStore } from '../../stores/analysis-store';
import { useUniqueId } from '../../unique-id';
import {
  FALLOW_CARD_NONE, FALLOW_IMPORT_ACTION, FALLOW_IMPORT_HINT, FALLOW_REMOVE, FALLOW_RUN_BUSY_HINT, FALLOW_STALE_NOTICE,
} from '../../inspector-copy';
import EvidenceBadge from '../../kit/EvidenceBadge.vue';
import FallowReportFacts from './FallowReportFacts.vue';
import FallowRunPanel from './FallowRunPanel.vue';

const props = defineProps<{ index: EvidenceIndex; hasSnapshot: boolean; refusal: { code: FallowRunErrorCode; detail: string } | null }>();
const emit = defineEmits<{ import: []; remove: []; run: []; cancel: []; choose: []; forget: [] }>();
const analysis = useAnalysisStore();
const hintId = useUniqueId('ci-fallow-card-hint');
const busyId = useUniqueId('ci-fallow-card-busy');
const report = computed(() => props.index.report);
const stale = computed(() => props.index.state === 'stale');
const unmatched = computed(() => (report.value ? unmatchedOf(props.index.unmatchedPaths, report.value) : []));
const staleNotice = computed(() => (report.value && stale.value
  ? FALLOW_STALE_NOTICE(formatAbsoluteTime(report.value.importedAt, Intl), staleCauseOf(report.value)) : ''));
const importBlocked = computed(() => !props.hasSnapshot || analysis.active);
const removeBlocked = computed(() => report.value === null || analysis.active);

/** Blocked without a snapshot (paths are matched to the codebase on screen) or mid-run. */
function importReport(): void {
  if (!importBlocked.value) emit('import');
}
/** Y31: aria-disabled while there is nothing to remove, or mid-run. */
function remove(): void {
  if (!removeBlocked.value) emit('remove');
}
</script>

<template>
  <div class="ci-fallow-card">
    <template v-if="report">
      <EvidenceBadge v-bind="evidenceBadgeOf(report, stale)" />
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
    <p
      v-if="analysis.active"
      :id="busyId"
      class="ci-note ci-fallow-card__busy"
    >
      {{ FALLOW_RUN_BUSY_HINT }}
    </p>
    <div class="ci-fallow-card__actions">
      <button
        type="button"
        class="ci-fallow-card__import"
        :aria-disabled="importBlocked ? 'true' : undefined"
        :aria-describedby="!hasSnapshot ? hintId : analysis.active ? busyId : undefined"
        @click="importReport"
      >
        {{ FALLOW_IMPORT_ACTION }}
      </button>
      <button
        type="button"
        class="ci-fallow-card__remove"
        :aria-disabled="removeBlocked ? 'true' : undefined"
        :aria-describedby="analysis.active ? busyId : undefined"
        @click="remove"
      >
        {{ FALLOW_REMOVE }}
      </button>
    </div>
    <FallowRunPanel
      :has-snapshot="hasSnapshot"
      :has-evidence="report !== null"
      :busy-hint-id="busyId"
      :refusal="refusal"
      @run="emit('run')"
      @cancel="emit('cancel')"
      @choose="emit('choose')"
      @forget="emit('forget')"
    />
  </div>
</template>
```

Create `src/ui/screens/sources/use-fallow-run.ts`:

```ts
// Part 7 Z32/Z33/Z35: the run controls behind the fallow card AND the "Run fallow analysis"
// command, in one place, so both behave the same. A start goes through the analysis store;
// `review` and `choose-executable` open the installed route; a refusal is held for the banner
// and announced. Each finished run (completed, cancelled, failed) is announced ONCE (E17),
// and a run that had already finished when the screen opened or the codebase changed is not.
import { ref, watch, type Ref } from 'vue';
import { useCityStore } from '../../stores/city-store';
import { useAnalysisStore } from '../../stores/analysis-store';
import { fallowRunBannerOf, type AnalysisRunState, type FallowRunErrorCode, type InstalledRouteStart } from '../../read-models/fallow-run';
import { FALLOW_EXE_FORGOTTEN, FALLOW_RUN_ERROR } from '../../inspector-copy';

export interface FallowRunControls {
  refusal: Ref<{ code: FallowRunErrorCode; detail: string } | null>;
  run(): Promise<void>;
  cancel(): void;
  forget(): Promise<void>;
}

function runIdOf(state: AnalysisRunState): string {
  if ('runId' in state) return state.runId;
  return 'identity' in state ? state.identity.runId : '';
}

export function useFallowRun(open: (start: InstalledRouteStart) => void, announce: (message: string) => void, hasEvidence: () => boolean): FallowRunControls {
  const city = useCityStore();
  const analysis = useAnalysisStore();
  const refusal = ref<{ code: FallowRunErrorCode; detail: string } | null>(null);
  let announced = runIdOf(analysis.run);

  watch(() => analysis.repositoryId, () => {
    refusal.value = null;
    announced = runIdOf(analysis.run);
  });
  watch(() => analysis.run, (state) => {
    if (state.status !== 'completed' && state.status !== 'cancelled' && state.status !== 'failed') return;
    if (state.runId === announced) return;
    announced = state.runId;
    const banner = fallowRunBannerOf(state, hasEvidence());
    if (banner) announce(banner.reason === null ? banner.text : `${banner.text} ${banner.reason}`);
  });

  async function run(): Promise<void> {
    const snapshot = city.snapshot;
    if (!snapshot || analysis.active) return;
    refusal.value = null;
    const outcome = await analysis.startOrReview(snapshot);
    // Part 6 E36: a codebase switch while the check ran drops the answer.
    if (outcome === null || city.snapshot?.snapshotId !== snapshot.snapshotId) return;
    if (outcome.kind === 'review') open({ startAt: 'review', review: outcome.review, reason: outcome.reason });
    else if (outcome.kind === 'choose-executable') open({ startAt: 'path' });
    else if (outcome.kind === 'refused') {
      refusal.value = { code: outcome.code, detail: outcome.detail };
      announce(FALLOW_RUN_ERROR[outcome.code](outcome.detail));
    }
  }
  function cancel(): void {
    analysis.cancel();
  }
  async function forget(): Promise<void> {
    if (analysis.active) return;
    refusal.value = null;
    if (await analysis.forget()) announce(FALLOW_EXE_FORGOTTEN);
  }
  return { refusal, run, cancel, forget };
}
```

In `src/ui/screens/sources/ConnectFallowDialog.vue`:
- after `import FallowReportFacts from './FallowReportFacts.vue';` add:

```ts
import FallowInstalledRoute from './FallowInstalledRoute.vue';
import type { InstalledRouteStart } from '../../read-models/fallow-run';
```

- add to the copy import list: `FALLOW_INSTALL_NOTE, FALLOW_ROUTE_IMPORT_TEXT, FALLOW_ROUTE_IMPORT_TITLE, FALLOW_ROUTE_RUN_ACTION, FALLOW_ROUTE_RUN_TEXT, FALLOW_ROUTE_RUN_TITLE,`;
- replace:

```ts
const emit = defineEmits<{ close: []; done: [message: string] }>();
```

with:

```ts
/** Part 7 Z29: which route opens first; the installed route's own starting point. */
const props = withDefaults(defineProps<{ initialRoute?: 'choose' | 'installed'; installed?: InstalledRouteStart }>(), { initialRoute: 'choose' });
const emit = defineEmits<{ close: []; done: [message: string] }>();
const route = ref<'choose' | 'installed'>(props.initialRoute);
```

- replace:

```ts
const { busy, error, requestClose: requestCloseWith, run } = useBusyAction();
```

with:

```ts
/** K32: one busy action for both routes, so Cancel/Escape/backdrop stay ignored mid-step. */
const action = useBusyAction();
const { busy, error, requestClose: requestCloseWith, run } = action;
const importHeadingId = useUniqueId('ci-connect-fallow-import');
const runHeadingId = useUniqueId('ci-connect-fallow-run');
```

- after `function choose(): void { … }` add:

```ts
/** Part 7 Z29: the installed-analyzer route, inside this same dialog. */
function useInstalled(): void {
  if (busy.value) return;
  error.value = '';
  route.value = 'installed';
}
```

- in the template, replace the whole `<template v-if="!review"> … </template>` step-1 block with:

```vue
      <FallowInstalledRoute
        v-if="route === 'installed'"
        :start="installed"
        :action="action"
        @close="requestClose"
        @started="emit('done', '')"
      />
      <template v-else-if="!review">
        <p class="ci-connect-fallow__eyebrow">
          {{ FALLOW_DIALOG_EYEBROW }}
        </p>
        <h3>{{ FALLOW_DIALOG_TITLE }}</h3>
        <p>{{ FALLOW_DIALOG_INTRO }}</p>
        <p class="ci-note">
          {{ FALLOW_SNAPSHOT_FILES(files.length) }}
        </p>
        <section
          class="ci-connect-fallow__route"
          :aria-labelledby="importHeadingId"
        >
          <h4 :id="importHeadingId">
            {{ FALLOW_ROUTE_IMPORT_TITLE }}
          </h4>
          <p>{{ FALLOW_ROUTE_IMPORT_TEXT }}</p>
          <button
            type="button"
            class="mod-cta ci-connect-fallow__choose"
            :aria-disabled="busy ? 'true' : undefined"
            @click="choose"
          >
            {{ FALLOW_CHOOSE }}
          </button>
        </section>
        <section
          class="ci-connect-fallow__route"
          :aria-labelledby="runHeadingId"
        >
          <h4 :id="runHeadingId">
            {{ FALLOW_ROUTE_RUN_TITLE }}
          </h4>
          <p>{{ FALLOW_ROUTE_RUN_TEXT }}</p>
          <button
            type="button"
            class="ci-connect-fallow__use-installed"
            :aria-disabled="busy ? 'true' : undefined"
            @click="useInstalled"
          >
            {{ FALLOW_ROUTE_RUN_ACTION }}
          </button>
        </section>
        <p class="ci-connect-fallow__disclosure">
          {{ FALLOW_DISCLOSURE }} {{ FALLOW_INSTALL_NOTE }}
        </p>
      </template>
```

- replace the `<template v-else>` that opens the review step with `<template v-else-if="review">` (its content is unchanged), and replace the whole `<div class="ci-connect-fallow__actions"> … </div>` with:

```vue
      <div
        v-if="route !== 'installed'"
        class="ci-connect-fallow__actions"
      >
        <button
          type="button"
          class="ci-connect-fallow__cancel"
          :aria-disabled="busy ? 'true' : undefined"
          @click="requestClose"
        >
          {{ FALLOW_CANCEL }}
        </button>
        <button
          v-if="review"
          type="button"
          class="mod-cta ci-connect-fallow__attach"
          :aria-disabled="busy ? 'true' : undefined"
          @click="attach"
        >
          {{ FALLOW_ATTACH }}
        </button>
      </div>
```

(The `role="alert"` paragraph between the steps and the actions stays where it is: the installed route's refusals land in it through the shared `error`.)

In `src/ui/screens/SourcesScreen.vue`:
- in the imports, replace `import { computed, inject, nextTick, ref, watch } from 'vue';` with `import { computed, inject, nextTick, ref, shallowRef, watch } from 'vue';`; add `import { useAnalysisStore } from '../stores/analysis-store';`, `import { useFallowRun } from './sources/use-fallow-run';` and `import type { InstalledRouteStart } from '../read-models/fallow-run';`; remove `SOURCES_PLANNED, SOURCES_PLANNED_TITLE, ` from the copy import and delete `import Panel from '../kit/Panel.vue';`;
- after `const removing = ref(false);` add:

```ts
/** Part 7 Z29/Z32: the dialog's first route, and the installed route's starting point. */
const connectRoute = ref<'choose' | 'installed'>('choose');
const installedStart = shallowRef<InstalledRouteStart | undefined>(undefined);
const analysisStore = useAnalysisStore();
```

- replace `function startConnect(): void {` … `}` with:

```ts
function startConnect(): void {
  removing.value = false;
  connectRoute.value = 'choose';
  installedStart.value = undefined;
  connecting.value = true;
}
/** Part 7 Z32/Z35: the installed route, at its path step or its review. */
function openInstalled(start: InstalledRouteStart): void {
  removing.value = false;
  connectRoute.value = 'installed';
  installedStart.value = start;
  connecting.value = true;
}
const { refusal: runRefusal, run: runAnalysis, cancel: cancelAnalysis, forget: forgetExecutable } =
  useFallowRun(openInstalled, (message) => { void reannounce(liveMessage, message); }, () => evidence.value.report !== null);
function chooseExecutable(): void {
  if (store.snapshot && !analysisStore.active) openInstalled({ startAt: 'path' });
}
/** Z35: the `run-fallow-analysis` command lands here with a request, consumed once. */
watch(() => analysisStore.runRequested, (requested) => {
  if (requested && analysisStore.consumeRunRequest()) void nextTick().then(runAnalysis);
}, { immediate: true });
```

- replace:

```ts
function attached(message: string): void {
  void closeConnect();
  void reannounce(liveMessage, message);
}
```

with:

```ts
function attached(message: string): void {
  void closeConnect();
  // Part 7 Z29: a started run announces nothing here; its end is announced once (use-fallow-run.ts).
  if (message !== '') void reannounce(liveMessage, message);
}
```

- in the template, replace:

```vue
        <FallowCardDetails
          :index="evidence"
          :has-snapshot="store.snapshot !== null"
          @import="openConnect"
          @remove="openRemove"
        />
```

with:

```vue
        <FallowCardDetails
          :index="evidence"
          :has-snapshot="store.snapshot !== null"
          :refusal="runRefusal"
          @import="openConnect"
          @remove="openRemove"
          @run="runAnalysis"
          @cancel="cancelAnalysis"
          @choose="chooseExecutable"
          @forget="forgetExecutable"
        />
```

- delete:

```vue
    <Panel :title="SOURCES_PLANNED_TITLE">
      <p class="ci-note">
        {{ SOURCES_PLANNED }}
      </p>
    </Panel>
```

- replace:

```vue
    <ConnectFallowDialog
      v-if="connecting"
      @close="closeConnect"
      @done="attached"
    />
```

with:

```vue
    <ConnectFallowDialog
      v-if="connecting"
      :initial-route="connectRoute"
      :installed="installedStart"
      @close="closeConnect"
      @done="attached"
    />
```

In `src/ui/audit-copy/sources.ts`, delete lines 47–48 (`SOURCES_PLANNED_TITLE` and `SOURCES_PLANNED`).

In `src/ui/styles/screens-configure.css`, after line 84 add:

```css
/* Part 7 Z29–Z33: the installed route, the review, and the fallow card's run panel. */
:where(.codebase-inspector-root) .ci-connect-fallow__route { display: grid; gap: var(--ci-space-2); padding: var(--ci-space-3); border: 1px solid var(--ci-border); border-radius: var(--ci-radius-small); }
:where(.codebase-inspector-root) .ci-connect-fallow__route h4 { margin: 0; font-size: var(--font-ui-medium, 1em); }
:where(.codebase-inspector-root) .ci-connect-fallow__route .mod-cta,
:where(.codebase-inspector-root) .ci-connect-fallow__use-installed { justify-self: start; }
:where(.codebase-inspector-root) .ci-fallow-installed { display: grid; gap: var(--ci-space-3); }
:where(.codebase-inspector-root) .ci-fallow-installed h3 { margin: 0; }
:where(.codebase-inspector-root) .ci-fallow-installed h3:focus { outline: none; }
:where(.codebase-inspector-root) .ci-fallow-installed__path { width: 100%; font-family: var(--ci-font-mono); }
:where(.codebase-inspector-root) .ci-fallow-installed__retrust { margin: 0; color: var(--ci-warning); }
:where(.codebase-inspector-root) .ci-fallow-review { display: grid; gap: var(--ci-space-2); }
:where(.codebase-inspector-root) .ci-fallow-review__facts { display: grid; grid-template-columns: fit-content(40%) minmax(0, 1fr); gap: var(--ci-space-1) var(--ci-space-3); margin: 0; font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-fallow-review__facts dt { color: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-fallow-review__facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
:where(.codebase-inspector-root) .ci-fallow-review__argv { margin: 0; padding-left: 1.4em; }
:where(.codebase-inspector-root) .ci-fallow-review h4 { margin: 0; font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-fallow-review__effects { margin: 0; padding-left: 1.2em; }
:where(.codebase-inspector-root) .ci-fallow-review__inside { margin: 0; padding: var(--ci-space-2) var(--ci-space-3); border-left: 3px solid var(--ci-warning); }
:where(.codebase-inspector-root) .ci-fallow-run { display: grid; gap: var(--ci-space-2); align-self: stretch; }
:where(.codebase-inspector-root) .ci-fallow-run p { margin: 0; }
:where(.codebase-inspector-root) .ci-fallow-run__banner { display: grid; gap: var(--ci-space-1); padding: var(--ci-space-2); border-left: 3px solid var(--ci-border); }
:where(.codebase-inspector-root) .ci-fallow-run__banner--warning { border-left-color: var(--ci-warning); }
:where(.codebase-inspector-root) .ci-fallow-run__log pre { margin: 0; max-height: 12em; overflow: auto; white-space: pre-wrap; font-family: var(--ci-font-mono); font-size: var(--font-ui-smaller, 0.8em); }
:where(.codebase-inspector-root) .ci-fallow-run__facts { display: grid; grid-template-columns: minmax(0, 1fr); margin: 0; font-size: var(--font-ui-small, 0.9em); }
:where(.codebase-inspector-root) .ci-fallow-run__facts dt { color: var(--ci-text-muted); }
:where(.codebase-inspector-root) .ci-fallow-run__facts dd { margin: 0; overflow-wrap: anywhere; }
:where(.codebase-inspector-root) .ci-fallow-run__actions { display: flex; flex-wrap: wrap; gap: var(--ci-space-2); }
```

- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/component/connect-fallow-routes.test.ts tests/component/fallow-run-panel.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint src/ui/screens/sources src/ui/screens/SourcesScreen.vue src/ui/audit-copy/sources.ts tests/component/connect-fallow-routes.test.ts tests/component/fallow-run-panel.test.ts --max-warnings 0`
Expected: exit 0. Every file in `src/ui/screens/sources/` is under its cap (Z43).

- [ ] **Step 6: Commit.**

```
git add src/ui/screens/sources/FallowRunBanner.vue src/ui/screens/sources/FallowRunReview.vue src/ui/screens/sources/FallowInstalledRoute.vue src/ui/screens/sources/FallowRunPanel.vue src/ui/screens/sources/use-fallow-run.ts src/ui/screens/sources/ConnectFallowDialog.vue src/ui/screens/sources/FallowCardDetails.vue src/ui/screens/SourcesScreen.vue src/ui/audit-copy/sources.ts src/ui/styles/screens-configure.css tests/component/connect-fallow-routes.test.ts tests/component/fallow-run-panel.test.ts
git commit -m "feat(ui): Data & scans runs fallow: the S14 installed route, the review, the run panel and banner; Planned integrations removed (Z29-Z33, Z35)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 7: Run the covering tests.**

Run: `npx vitest run tests/component/connect-fallow-routes.test.ts tests/component/fallow-run-panel.test.ts tests/component/connect-fallow.test.ts tests/component/fallow-card.test.ts tests/component/sources-screen.test.ts tests/component/collected-evidence.test.ts tests/unit/css-class-scope.test.ts tests/unit/kit-css-fallbacks.test.ts tests/unit/sources-model.test.ts`
Expected: PASS.

---

### Task 13: Harness captures for the installed route and the run states (Z42)

**Files:**
- Modify: `tests/harness/seed.ts` (108 → ~150): new seeds after `demoEvidenceReport`
- Modify: `tests/harness/mount.ts` (333 → ~375): imports (lines 13–19), `HarnessOptions` (lines 27–39), the analysis service before `app.mount`, the `analysis` and `fallow` options
- Modify: `tests/harness/page.ts` (68 → 73): header lines 15–16, the footer condition (line 49), the options (lines 66–67)
- Modify: `scripts/harness-shot.mjs` (255 → 263): `SHOTS`, after line 139
- Test: `tests/harness/harness-evidence.test.ts` (75 → ~125), `tests/build/harness-shot.test.ts` (100 → ~118)

**Interfaces:**
- Consumes: Task 9's `createFakeFallowAnalysis`, `fakeRunReview`, `HARNESS_EXECUTABLE`, `useAnalysisStore` (`setService`, `requestRun`); Task 12's `.ci-connect-fallow__use-installed` and `.ci-fallow-installed__trust`; Task 3's `staleReason`; Part 6's `demoEvidenceReport`, `buildEvidenceReport`, `parseFallowReportText`, `demoFallowReportText`; `FALLOW_RUN_ARGS`.
- Produces (harness only, never imported by `src`):
  - `demoCollectedReport(snapshot): EvidenceReport`; `demoRunReview(snapshot): RunReview`; `HARNESS_BINDING: AnalyzerBindingRead`; `runningAnalysisState(snapshot): AnalysisRunState`; `failedAnalysisState(): AnalysisRunState`; `completedAnalysisState(): AnalysisRunState`
  - URL parameters `?fallow=routes|installed` (with `route=sources`) and `?analysis=running|failed|collected`
  - shots `wp02-connect-fallow-routes-dark`, `wp02-connect-fallow-installed-dark`, `wp02-connect-fallow-installed-light`, `wp02-sources-fallow-running-dark`, `wp02-sources-fallow-failed-dark`, `wp02-sources-fallow-collected-dark`

- [ ] **Step 1: Write the failing tests.**

In `tests/harness/harness-evidence.test.ts`, add to the imports:

```ts
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import { fallowRunBannerOf } from '../../src/ui/read-models/fallow-run';
```

extend the `./seed` import with `completedAnalysisState, demoCollectedReport, demoRunReview, failedAnalysisState, runningAnalysisState, HARNESS_BINDING,`, and at the end of the file add:

```ts
describe('the harness fallow run (?fallow=installed, ?analysis=…, Part 7 Z42)', () => {
  it('the collected demo is the real builder\'s report with verified, collected provenance', () => {
    const snapshot = harnessSnapshot();
    const report = demoCollectedReport(snapshot);
    expect(report.collected).toMatchObject({ origin: 'collected', sourceMatch: 'verified', rootPath: snapshot.scope.rootPath, exitCode: 0 });
    expect(report.fileName).toBe('fallow.exe');
    expect(report.normalized.findings.length).toBe(demoEvidenceReport(snapshot).normalized.findings.length);
  });

  it('the review shows the exact argv for the harness root and a synthetic executable', () => {
    const snapshot = harnessSnapshot();
    const review = demoRunReview(snapshot);
    expect(review.args).toEqual(FALLOW_RUN_ARGS(snapshot.scope.rootPath));
    expect(review.facts.executablePath).toBe('C:\\Tools\\fallow\\fallow.exe');
    expect(HARNESS_BINDING).toMatchObject({ kind: 'bound', binding: { executablePath: 'C:\\Tools\\fallow\\fallow.exe' } });
  });

  it('every seeded run state has a banner', () => {
    const snapshot = harnessSnapshot();
    expect(fallowRunBannerOf(runningAnalysisState(snapshot), true)?.tone).toBe('info');
    expect(fallowRunBannerOf(failedAnalysisState(), true)).toMatchObject({ tone: 'warning', kept: true });
    expect(fallowRunBannerOf(completedAnalysisState(), true)?.icon).toBe('check');
  });
});
```

In `tests/build/harness-shot.test.ts`, after the `it('captures the Part 6 states: …')` block add:

```ts
  it('captures the Part 7 states: both routes, the installed review in both themes, and running, failed and collected', () => {
    expect(shotQuery('wp02-connect-fallow-routes-dark').get('fallow')).toBe('routes');
    for (const theme of ['dark', 'light']) {
      const q = shotQuery(`wp02-connect-fallow-installed-${theme}`);
      expect(q.get('fallow')).toBe('installed');
      expect(q.get('theme')).toBe(theme);
    }
    for (const state of ['running', 'failed', 'collected']) {
      const q = shotQuery(`wp02-sources-fallow-${state}-dark`);
      expect(q.get('analysis'), state).toBe(state);
      expect(q.get('route')).toBe('sources');
    }
    for (const id of ['wp02-connect-fallow-routes-dark', 'wp02-connect-fallow-installed-dark', 'wp02-connect-fallow-installed-light']) {
      expect(shotQuery(id).get('route'), id).toBe('sources');
    }
  });
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run tests/harness/harness-evidence.test.ts tests/build/harness-shot.test.ts`
Expected: FAIL — `demoCollectedReport` and the other seeds are not exported; no `wp02-connect-fallow-routes-dark` shot exists.

- [ ] **Step 3: Implement.**

In `tests/harness/seed.ts`, add to the imports:

```ts
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import type { AnalysisRunState } from '../../src/application/analysis/analysis-state';
import type { AnalyzerBindingRead } from '../../src/application/analysis/analyzer-record';
import type { RunReview } from '../../src/application/analysis/fallow-analysis-service';
import { HARNESS_EXECUTABLE, fakeRunReview } from '../fixtures/fake-fallow-analysis';
```

and after `demoEvidenceReport` add:

```ts
/** Part 7 Z42: the demo report as a collected run attaches it (the real builder's output plus
 *  collected provenance), for `?analysis=collected`. */
export function demoCollectedReport(snapshot: CodebaseSnapshot): EvidenceReport {
  const base = demoEvidenceReport(snapshot);
  return {
    ...base, fileName: 'fallow.exe',
    collected: {
      origin: 'collected', sourceMatch: 'verified', runId: 'harness-fallow-run', rootPath: snapshot.scope.rootPath,
      executablePath: HARNESS_EXECUTABLE, args: FALLOW_RUN_ARGS(snapshot.scope.rootPath), exitCode: 0,
      startedAt: AT.toISOString(), durationMs: 1_450, versionTested: true,
    },
  };
}

/** Part 7 Z42: the installed route's review for the harness root (`?fallow=installed`). */
export function demoRunReview(snapshot: CodebaseSnapshot): RunReview {
  return fakeRunReview(snapshot.repositoryId, snapshot.snapshotId, snapshot.scope.rootPath);
}

export const HARNESS_BINDING: AnalyzerBindingRead = {
  kind: 'bound', binding: { profileId: 'harness', executablePath: HARNESS_EXECUTABLE, timeoutSeconds: 120, trust: { fingerprint: '0a1b2c3d', version: '3.27.0', grantedAt: AT.toISOString() } },
};

export function runningAnalysisState(snapshot: CodebaseSnapshot): AnalysisRunState {
  return {
    status: 'running', rootPath: snapshot.scope.rootPath, startedAt: AT.toISOString(), timeoutSeconds: 120, version: '3.27.0', tested: true,
    identity: { profileId: snapshot.repositoryId, snapshotId: snapshot.snapshotId, rootFingerprint: 'harness', subjectFingerprint: 'harness', runId: 'harness-fallow-run', generation: 0 },
  };
}

export function failedAnalysisState(): AnalysisRunState {
  return {
    status: 'failed', runId: 'harness-fallow-run', code: 'timed-out', detail: '120', evidenceKept: true, finishedAt: AT.toISOString(),
    logExcerpt: 'Synthetic harness log: analysing 142 files…\nSynthetic harness log: still analysing after 120 s.',
  };
}

export function completedAnalysisState(): AnalysisRunState {
  return { status: 'completed', runId: 'harness-fallow-run', finishedAt: AT.toISOString(), version: '3.27.0', tested: true, matchedFindings: 19, matchedFiles: 10 };
}
```

In `tests/harness/mount.ts`:
- after `import { useLensStore } from '../../src/ui/stores/lens-store';` add `import { useAnalysisStore } from '../../src/ui/stores/analysis-store';` and `import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';`;
- extend the `./seed` import with `HARNESS_BINDING, completedAnalysisState, demoCollectedReport, demoRunReview, failedAnalysisState, runningAnalysisState,`;
- in `HarnessOptions`, replace `  fallow?: 'review';` with:

```ts
  fallow?: 'review' | 'routes' | 'installed';
  analysis?: 'running' | 'failed' | 'collected';
```

- after `useEvidenceStore(pinia).setRepository(new InMemoryEvidenceStore());` add:

```ts
  // Part 7 Z42: a scripted fallow analysis service (it runs nothing); `?analysis=` seeds it.
  const fallowAnalysis = createFakeFallowAnalysis();
  useAnalysisStore(pinia).setService(fallowAnalysis);
```

- after the `if (options.lens === 'findings') { … }` block add:

```ts
  if (options.analysis) {
    // Part 7 Z42: a run as the plugin's coordinator would report it, on the harness codebase.
    const snapshot = store.snapshot;
    if (!snapshot) throw new Error('harness: analysis= found no snapshot');
    const evidence = useEvidenceStore();
    evidence.bindRepository(snapshot.repositoryId);
    fallowAnalysis.setBinding(snapshot.repositoryId, HARNESS_BINDING);
    if (options.analysis === 'running') fallowAnalysis.setState(snapshot.repositoryId, runningAnalysisState(snapshot));
    if (options.analysis === 'failed') {
      if (!evidence.attach({ ...demoEvidenceReport(snapshot), staleReason: 'failed-run' })) throw new Error('harness: analysis=failed was refused');
      fallowAnalysis.setState(snapshot.repositoryId, failedAnalysisState());
    }
    if (options.analysis === 'collected') {
      if (!evidence.attach(demoCollectedReport(snapshot))) throw new Error('harness: analysis=collected was refused');
      fallowAnalysis.setState(snapshot.repositoryId, completedAnalysisState());
    }
  }
```

- after the `if (options.fallow === 'review') { … }` block (inside the `route !== 'city'` branch) add:

```ts
    if (options.fallow === 'routes') {
      // Part 7 Z29: the dialog's step 1, with both routes.
      if (route !== 'sources') throw new Error('harness: fallow=routes needs route=sources');
      useEvidenceStore().requestImport();
      await until(() => root.querySelector('.ci-connect-fallow__use-installed') !== null);
    }
    if (options.fallow === 'installed') {
      // Part 7 Z30/Z31: the command's own path: a run request whose answer is the review.
      const snapshot = store.snapshot;
      if (route !== 'sources' || !snapshot) throw new Error('harness: fallow=installed needs route=sources and a snapshot');
      fallowAnalysis.next.run = { kind: 'review', review: demoRunReview(snapshot), reason: 'untrusted' };
      useAnalysisStore().requestRun();
      await until(() => root.querySelector('.ci-fallow-installed__trust') !== null);
    }
```

In `tests/harness/page.ts`, replace line 15:

```ts
//   ?fallow=review     open the Connect fallow dialog at its review step (sources)
```

with:

```ts
//   ?fallow=review     open the Connect fallow dialog at its review step (sources)
//   ?fallow=routes     open the Connect fallow dialog at step 1, both routes (sources)
//   ?fallow=installed  open the installed-analyzer route at its review (sources)
//   ?analysis=running|failed|collected  seed the scripted fallow run (sources)
```

replace line 49:

```ts
if (params.get('report') === 'demo' || params.get('fallow') === 'review') {
```

with:

```ts
const FALLOW_PAGES: readonly (string | null)[] = ['review', 'routes', 'installed'];
if (params.get('report') === 'demo' || FALLOW_PAGES.includes(params.get('fallow')) || params.get('analysis') !== null) {
```

and replace:

```ts
  ...(params.get('fallow') === 'review' ? { fallow: 'review' as const } : {}),
});
```

with:

```ts
  ...(params.get('fallow') === 'review' ? { fallow: 'review' as const } : {}),
  ...(params.get('fallow') === 'routes' ? { fallow: 'routes' as const } : {}),
  ...(params.get('fallow') === 'installed' ? { fallow: 'installed' as const } : {}),
  ...(['running', 'failed', 'collected'].includes(params.get('analysis') ?? '') ? { analysis: params.get('analysis') as 'running' | 'failed' | 'collected' } : {}),
});
```

In `scripts/harness-shot.mjs`, after the `wp02-city-lens-light` entry (line 139) add:

```js
  // WP-02 Part 7: compare against docs/concept/design/mockups/s14-provider.png (both routes; the
  // installed-analyzer review) and docs/concept/prototype/screenshots/sources-dark.png (the fallow
  // card while a run is in flight, after a failed run, and with collected findings). The
  // executable, the run and its log are SYNTHETIC (tests/harness/seed.ts).
  { id: 'wp02-connect-fallow-routes-dark', query: '?screen=s05&theme=dark&route=sources&fallow=routes' },
  { id: 'wp02-connect-fallow-installed-dark', query: '?screen=s05&theme=dark&route=sources&fallow=installed' },
  { id: 'wp02-connect-fallow-installed-light', query: '?screen=s05&theme=light&route=sources&fallow=installed' },
  { id: 'wp02-sources-fallow-running-dark', query: '?screen=s05&theme=dark&route=sources&analysis=running' },
  { id: 'wp02-sources-fallow-failed-dark', query: '?screen=s05&theme=dark&route=sources&analysis=failed' },
  { id: 'wp02-sources-fallow-collected-dark', query: '?screen=s05&theme=dark&route=sources&analysis=collected' },
```

- [ ] **Step 4: Run them and watch them pass.**

Run: `npx vitest run tests/harness/harness-evidence.test.ts tests/build/harness-shot.test.ts tests/harness/harness.test.ts`
Expected: PASS.

- [ ] **Step 5: Capture.**

Run: `npm run harness-shot`
Expected: exit 0; the six new PNGs are written under `harness-shots/`. The controller opens every new shot and the intended change to `wp02-sources-fallow-dark` (no Planned integrations panel; the run panel with "Run fallow analysis" and "Choose executable…") and records what it saw in the ledger (the Part 6 E46 lesson: a capture can show what no test can).

- [ ] **Step 6: Gate.**

Run: `npm run typecheck && npm run lint:fast && npx eslint tests/harness scripts/harness-shot.mjs tests/build/harness-shot.test.ts --max-warnings 0`
Expected: exit 0.

- [ ] **Step 7: Commit.**

```
git add tests/harness/seed.ts tests/harness/mount.ts tests/harness/page.ts tests/harness/harness-evidence.test.ts scripts/harness-shot.mjs tests/build/harness-shot.test.ts
git commit -m "test(harness): Part 7 captures: both S14 routes, the installed review, and running, failed and collected fallow runs (Z42)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Run the covering tests.**

Run: `npx vitest run tests/harness tests/build tests/unit/obsidian-mock-scope.test.ts`
Expected: PASS.

---

### Task 14: Evidence, acceptance and the full verification (Z43, Z44; G6; deliverable acceptance (3) and (5)) — controller

**This task is run by the controller.** It changes no `src/` file.

**Files:**
- Modify: `tests/unit/evidence-numbers.test.ts` (402 → 403): the Contract-row formula (lines 364–369)
- Modify: `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` (770): the G8 heading paragraph and table (lines 454–510), and a new `## G6 — Analyzer process boundary (WP-02 Part 7)` section before `## G8`
- Modify: `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md`: its copy of the G8 table (identical to the gate evidence, `tests/host/clean-vault-install.test.ts`)
- Modify: `docs/superpowers/notes/2026-09-17-wp01-limitations.md` (328): a new `## WP-02 Part 7 — running an installed fallow` section before `## Numbers in this document`
- Modify: `docs/deliverables/Fallow Ingestion.md` (57): a new `## Delivery record` section at the end (K36: `status` stays `planned`; the owner changes it at integration)

**Interfaces:**
- Consumes: every earlier task; `npm run test:fallow` (Task 8); the harness shots (Task 13).
- Produces: the evidence and delivery records; a green `npm run verify` (except the environmental `install-script` case).

- [ ] **Step 1: Run the two evidence guards and watch them fail.**

Run: `npx vitest run tests/unit/gate-evidence.test.ts tests/unit/evidence-numbers.test.ts`
Expected: FAIL — the G8 table has no `tests/fallow-real` row, and its FILE counts differ from disk (unit, contracts, integration, component and host all grew).

- [ ] **Step 2: Extend the Contract-row formula (K28).**

In `tests/unit/evidence-numbers.test.ts`, replace:

```ts
    const heightScaleTests = itCount('tests/contracts/height-scale.test.ts');
    const microcopyTests = itCount('tests/contracts/microcopy.test.ts');
    expect(Number(table![1]), 'one suite (two implementations) plus this directory\'s other two pinned files')
      .toBe(obligations * 2 + heightScaleTests + microcopyTests);
```

with:

```ts
    const heightScaleTests = itCount('tests/contracts/height-scale.test.ts');
    const microcopyTests = itCount('tests/contracts/microcopy.test.ts');
    const fallowRunnerTests = itCount('tests/contracts/fallow-runner.test.ts'); // Part 7 K28
    expect(Number(table![1]), 'one suite (two implementations) plus this directory\'s other three pinned files')
      .toBe(obligations * 2 + heightScaleTests + microcopyTests + fallowRunnerTests);
```

- [ ] **Step 3: Refresh the G8 table and heading.**

Take the numbers from disk and from the living suite, never by hand:
- per-layer FILE counts: `find tests/<layer> -name '*.test.ts' -o -name '*.steps.ts' | wc -l` for each layer. After Tasks 1–13 they are: unit **117**, contracts **5**, integration **9**, component **75**, host **18**, acceptance **1**, benchmarks **1**, harness **2**, build **1**, fallow-real **1** — **230** in all (204 + 26). If a count on disk differs, the disk wins and the difference is recorded in the ledger.
- the Contract row's Tests cell: its current value plus `itCount('tests/contracts/fallow-runner.test.ts')` (**14**). Add the same 14 to the heading's test total and to its passed count (the per-layer sum must equal the heading, `gate-evidence.test.ts`).
- a new row, placed after the Build row:

```markdown
| Real fallow (opt-in) | `tests/fallow-real/**` | 1 | opt-in (`npm run test:fallow`), never in `npm run test` | 0 | Part 7 Z40/Z41: ten tests against the real, pinned fallow 3.27.0 (or `FALLOW_BIN`): native-binary inspection, the version probe, fixture fidelity, the fs-diff side-effect proof with its `.fallow/` control, the bad-root error, `--fail-on-issues` exit 1, the time limit, cancel and the stdout cap. Its ten tests are not part of the living suite this table totals, so its Tests cell is 0; the run is recorded in G6 above |
```

- the living-suite line ("The living suite's own measurement, taken at this commit: …"): replace its four figures with those `npx vitest run` prints at this commit (files, tests, passed, skipped), and keep the sentence about `install-script.test.ts`'s environmental failure.
- the vintage paragraph: after "…are the WP-01-gate transcription described above;" add "the Contract row is the exception: its guard derives it from its files, so it includes Part 7's runner contract (`tests/contracts/fallow-runner.test.ts`, K28);".
- copy the whole `<!-- g8:table:start -->` … `<!-- g8:table:end -->` block, byte for byte, into the implementation report's copy.

- [ ] **Step 4: Write the G6 section of the gate evidence.**

Run (Git Bash): `FALLOW_BIN="$LOCALAPPDATA/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe" npm run test:fallow`
Expected: `fetch-fallow: FALLOW_BIN=…; nothing fetched.` and 10 passing tests, including test 4 (fs-diff) and test 5 (the `.fallow/` control); the `[fallow-real]` line names `fallow 3.27.0` on `win32`.

Run: `npx vitest run tests/integration/fallow-analysis.test.ts -t "no freeze"`
Expected: PASS, printing two `[no-freeze]` lines.

Before `## G8 — Testing coverage`, add a section headed `## G6 — Analyzer process boundary (WP-02 Part 7)` containing:
1. the G6 requirement-to-evidence table, copied from the Part 7 spec §5 "Quality gate G6, item by item", with each evidence cell naming the test file that holds it;
2. "`npm run test:fallow` at this commit:" followed by the binary path, the version, the platform, and the test output pasted verbatim;
3. the two `[no-freeze]` lines pasted verbatim, and the sentence "The final JSON parse runs on the UI thread and is measured, not bounded (spec §6).";
4. "Deliverable acceptance (3) and (5):" followed by the spec §5 bullets, each naming its test;
5. "Manual host check — acceptance (3):" — **NOT PERFORMED**, awaiting the owner's checkpoint: install with `npm run install:vault`, open a city on this repository, run *Run fallow analysis* with the local fallow 3.27.0, and confirm the city stays interactive while it runs. When the owner performs it, the result replaces this line.

- [ ] **Step 5: Record the limitations and the delivery.**

In `docs/superpowers/notes/2026-09-17-wp01-limitations.md`, before `## Numbers in this document`, add `## WP-02 Part 7 — running an installed fallow` with the nine bullets of the Part 7 spec §6, verbatim (no Windows process-tree kill; not a sandbox; config files in the root are honoured; the git history may be read; scan exclusions do not apply to fallow; untested versions; a force-quit mid-run; the final parse is synchronous; machine identity is inferred), then the line "Every one of these is also stated where the user meets it: the review's side-effect list (Z31) and the storage disclosure (Z12)."

In `docs/deliverables/Fallow Ingestion.md`, at the end, add:

```markdown
## Delivery record

Built on branch `feat/wp-02-part6` (import) and `feat/wp-02-part7` (execution); design in
`docs/superpowers/specs/2026-09-23-inspector-ui-part6-design.md` (Y1–Y40) and
`docs/superpowers/specs/2026-09-23-inspector-ui-part7-design.md` (Z1–Z44).

| Task | Delivered by |
|---|---|
| 02.1 | Part 6 Y20–Y21: the recorded 3.21.0 and 3.27.0 fixtures |
| 02.2 | Part 6 Y22–Y27: the zod raw schema, the normaliser, provenance |
| 02.3 | Part 6 Y26, Y38: the import dialog, path matching, the explicit mapping |
| 02.4 | Part 7 Z1–Z12: the per-profile executable binding, the trust fingerprint, the review |
| 02.5 | Part 7 Z13–Z24: the async runner, bounded output, time limit, cancel, shutdown |
| 02.6 | Part 6 Y30–Y40, Part 7 Z23/Z26/Z27: lenses, counts, missing/stale/failed/collected states |
| 02.7 | Part 7 Z37–Z41: the amended no-process guard, the offline contracts, `npm run test:fallow` |

Acceptance, item by item, is recorded in `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`
(G6, and the Part 6 acceptance notes). The manual host check for "a configured trusted
binary runs without freezing Obsidian" is open until the owner performs it.
```

- [ ] **Step 6: Run the evidence guards and watch them pass.**

Run: `npx vitest run tests/unit/gate-evidence.test.ts tests/unit/evidence-numbers.test.ts tests/host/clean-vault-install.test.ts`
Expected: PASS. A failing assertion names the stale figure and the true one; fix exactly that figure and re-run.

- [ ] **Step 7: Commit.**

```
git add tests/unit/evidence-numbers.test.ts docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md docs/superpowers/notes/2026-09-17-wp01-implementation-report.md docs/superpowers/notes/2026-09-17-wp01-limitations.md "docs/deliverables/Fallow Ingestion.md"
git commit -m "docs(evidence): Part 7 G6 evidence, test counts, limitations and the Fallow Ingestion delivery record" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Run the full verification.**

Run: `npm run verify`
Expected: typecheck, `lint:fast`, `lint` and `build` pass (`assert-bundle: OK`); `npm run test` passes every file except `tests/unit/install-script.test.ts`, whose one environmental failure (no `.obsidian/` in this worktree) is expected and reported, never fixed. Paste the final summary into the ledger. The owner's integration step re-runs `npm run verify` in the main checkout after the fast-forward, where `install-script` passes.

Run (Git Bash): `FALLOW_BIN="$LOCALAPPDATA/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe" npm run test:fallow`
Expected: 10 passing tests.

---

## Z → Task coverage

| Z | Decision | Task(s) |
|---|---|---|
| Z1 | the `analyzers` slice | 2 (record, store), 1 (`AnalyzerTrust`) |
| Z2 | read validation, newer formats | 2 |
| Z3 | port and durable adapter | 2 |
| Z4 | accepted executables | 6 (1: port types) |
| Z5 | an executable inside the codebase | 6 (K22), 12 (the warning) |
| Z6 | the trust fingerprint | 1 |
| Z7 | when trust is checked and invalidated | 1 (`isTrustCurrent`), 5 (the checks), 4 (post-probe verdict) |
| Z8 | the version probe | 1 (parse, classify), 4 (run it first), 5 (store trust after it) |
| Z9 | tested and untested versions | 1, 4, 11 (badge), 12 (review, panel) |
| Z10 | the time limit | 1 (constants), 5 (`setTimeLimit`), 10 (settings row) |
| Z11 | Forget and profile removal | 5 (`forget`, `purgeProfile`), 10 (settings), 12 (card) |
| Z12 | settings rows and the disclosure | 10 |
| Z13 | layering | 1–7 (file placement), 7 and 8 (guard, policy scan) |
| Z14 | the Node boundary | 7 |
| Z15 | the spawn call and exact argv | 1 (argv), 7 (spawn), 8 (policy) |
| Z16 | the environment | 1 (list), 7 (`buildChildEnv`, contract env-dump) |
| Z17 | bounded output | 1 (caps), 7 |
| Z18 | timeout, cancel, killing | 7 (4: the coordinator side) |
| Z19 | error codes | 1 (9: copy) |
| Z20 | the reducer | 4 |
| Z21 | the coordinator | 4 (8: real stack) |
| Z22 | the service | 5 |
| Z23 | failure keeps evidence, stale | 3 (port, index), 4 (the call), 11 (the notice) |
| Z24 | shutdown | 4 (coordinator), 7 (`killAll`), 9 (`onunload`) |
| Z25 | collected provenance | 3 (model), 4 (built) |
| Z26 | EvidenceBadge | 11 |
| Z27 | origin-aware copy | 11 |
| Z28 | how the UI reaches the service | 9 |
| Z29 | the S14 second route | 12 |
| Z30 | path then review | 12 |
| Z31 | what the review shows | 12 |
| Z32 | the Data & scans card | 12 |
| Z33 | the run banner | 9 (read model), 12 (component) |
| Z34 | the failure Notice | 9 |
| Z35 | commands | 9 (host), 12 (the request's screen half) |
| Z36 | nothing runs at load, review or bind | 5 (tests), 9 (`onload` builds only) |
| Z37 | the process-guard amendment | 7 |
| Z38 | offline coverage | 7 (unit, contract), 8 (integration, policy), 9 (`assert-bundle`, K23) |
| Z39 | unit and component coverage | 1–12 (each task's tests) |
| Z40 | `npm run test:fallow` | 8 (14: run and recorded) |
| Z41 | the real-binary checks | 8 (14: recorded) |
| Z42 | harness | 13 |
| Z43 | file budgets | Global Constraints; every task's gate (eslint `max-lines`, `city-budget.test.ts`) |
| Z44 | Part 6 decisions amended | 3 (Y27, Y28), 7 (U42), 9 (Y39), 11 (Y32), 12 (Y37, Y38) |

## Self-review notes

- **Coverage.** Every Z1–Z44 maps to at least one task above; the five Review Focus items each have a named pinning test in Tasks 1, 4, 5, 6 and 7.
- **Names are one spelling across tasks.** `FallowAnalysisService` (service), `AnalysisCoordinator` (coordinator), `createFallowRunner` (runner), `createExecutableInspector`, `createPluginDataAnalyzerStore`, `useAnalysisStore`, `fallowRunBannerOf`, `evidenceBadgeOf`, `staleCauseOf(report)`, `InstalledRouteStart`, `StartOutcome` (with `choose-executable`), `classifyFallowExit(outcome, timeoutSeconds)` (three arms, A6), `RunPlan.onProbePassed` (three verdicts, A7). The spec's `staleCauseOf` is not named there; this plan's signature takes the report only.
- **Budgets.** Measured at 384c528; no `src` file this plan grows passes 400, `city-view.ts` stays ≤ 360, and the four test files at or near 450 are either untouched or edited in place (`settings-tab.test.ts` +1, `evidence-numbers.test.ts` +1).
- **Tasks that are RED only through a fixture.** Task 8's integration test fails first on its new `node-wrapped-port.ts` fixture: every module it drives already exists, which is the point of an integration test.
- **Known environmental failure.** `tests/unit/install-script.test.ts` (no `.obsidian/` in this worktree), as in Part 6.
- **Open for the owner.** The manual host check for acceptance (3), recorded as NOT PERFORMED in Task 14 until done.
