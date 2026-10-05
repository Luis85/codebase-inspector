# Gap closure — Part C (quality gates, evidence semantics and copy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close spec rows GRC1–GRC14:
- the gates: layering lint, CI, a contrast gate, axe;
- the evidence semantics: violations per file edge, JP5 widened, in-module violations shown;
- the copy and layout revisits;
- deliverable status;
- the analyze baseline 9 → 4;
- M118 coverage and the residual fingerprint;
- the `moment` advisory.

**Architecture:**
- **New gates are tests:** `tests/build/eslint-layering.test.ts`, `tests/build/ci-workflow.test.ts`, `tests/unit/contrast-gate.test.ts` (with `tests/support/css-tokens.ts`), `tests/component/axe-*.test.ts` (with `tests/support/axe.ts`), and `tests/unit/deliverables-status.test.ts`.
- **One `src` port moves** from `src/ui/stores/ports/review-repository.ts` to `src/application/ports/review-repository.ts`.
- **CSS tokens are derived in `kit.css`**; no host variable is redefined.
- **Copy changes live only in the copy modules**, using the approved wording (spec GCN12).

**Tech Stack:** TypeScript 6.0.3, Vue 3.5.43, Vitest 5.0.1 (jsdom), ESLint 9 (flat config), oxlint, Node 24. axe-core is a new **devDependency**.

**Spec:** `docs/superpowers/specs/2026-10-03-gap-closure-design.md`, §3.2 (GRC1–GRC14), GCN4, GCN9, GCN12, GCO10–GCO13, GCO16, GCO18, GCO20, GCO21.
- **Rulings:** `docs/superpowers/notes/2026-10-03-gap-closure-ledger.md`. GCP2 makes the codec the one layering exception. Execution rulings continue as "Gap-closure E8…".

**Branch:** `feat/gap-closure` in `.claude/worktrees/gap-closure`, at `59649b8` (the PR 1 head after Part D). At the end it is fast-forward-pushed onto `feat/wp-01-codebase-city`. Pushing needs the `Luis85` gh account to be active; it is now.

## Global Constraints

**Repository rules:**
- Caps: **400** lines for `src/**/*.{ts,vue}` and **450** for tests. `tests/e2e/inspector.ts` is at 381.
- Layering: only `src/adapters/filesystem/node-access.ts` may `window.require` `fs`, and `src/ui/**` never imports adapters or host. After Task 3 this is enforced by lint (GCO10, GCP2).
- Copy lives only in `src/ui/audit-copy` and the established copy modules (`src/ui/copy.ts`, `src/ui/inspector-copy.ts`). The microcopy contract (`tests/contracts/microcopy.test.ts`) must stay green.
- CRLF files are edited only with Edit/Write. The two evidence notes are CRLF; check them byte-level afterwards.
- `npm run analyze` stays at **9** until Task 2, then is **4**. A new dead export is removed, never baselined.
- **GCN4:** every new gate lands green. A violation is fixed in this part, or carries a recorded exception ruling naming the file and reason. A rule is never weakened.

**Process rules:**
- **Never run `git stash` in any form.** RED is shown by a temporary Edit that is reverted.
- Tests are written and run RED before the code. A RED rebuilt after the code is written is not accepted.
- Every commit message ends with the literal trailer **"Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"**. Stage explicit paths, never `git add -A`.
- Worktree-isolated sessions refuse shell commands that compute a program name at runtime: run plain, separate commands.
- Disclose every `npm run test` / `npm run verify` run with its Z38 outcome (pre-control, the best-of-3 figures, post-control, or skip with its figure).

**TypeScript and lint:**
- ES2020 `lib` only: no `.at()`, `Object.hasOwn`, `replaceAll` or `findLast`.
- oxlint `--deny-warnings`; `Array.from(set)`; PF1 timers; no redundant `as`.

**Native runs:**
- Part C adds no native scenarios. Changed copy is imported by the native tests through constants, so the full native gate runs once in Task 9.
- Native runs must use Node with libuv ≥ 1.52. The system Node is 24.15.0 and is refused, so use the portable Node: `C:\Users\LUISME~1\AppData\Local\Temp\claude\C--Projects-codebase-inspector--claude-worktrees-inspector-prototype-ui-18caac\841c5b72-4d1a-40a3-a435-aa83781f2391\scratchpad\node-24.21.0\node-v24.21.0-win-x64\node.exe scripts/native-tests.mjs`.
- `FALLOW_BIN` is `Join-Path $env:LOCALAPPDATA 'npm-cache\_npx\ee3f2ca80543beb5\node_modules\@fallow-cli\win32-x64-msvc\fallow.exe'`.
- No retries.

**Per-task gate** (each its own command):
- `npm run typecheck`
- `npm run lint:fast`
- `npx eslint <touched files> --max-warnings 0`
- `npx vitest run <the task's test files plus every existing test file the task edits>`

`gate-evidence.test.ts` and `evidence-numbers.test.ts` may fail on counts until Task 9.

**Size now** (at `59649b8`):

| File | Lines |
|---|---|
| `eslint.config.mjs` | 258 |
| `package.json` | 52 |
| `src/ui/stores/ports/review-repository.ts` | 229 (imported by 20 `src` and 45 test files) |
| `src/adapters/storage/plugin-data-review-repository.ts` | 284 |
| `src/adapters/storage/review-repository-registry.ts` | 41 |
| `src/ui/styles.css` / `styles/kit.css` | 805 / 306 (CSS, no cap) |
| `src/ui/styles/screens-act.css` / `-audit` / `-explore` / `screens.css` / `shell.css` | 178 / 181 / 233 / 75 / 130 |
| `tests/unit/contrast-tokens.test.ts` | 106 |
| `src/ui/screens/architecture/EdgeList.vue` / `DependencyMatrix.vue` / `ModuleMap.vue` | 168 / 100 / 128 |
| `src/ui/screens/ArchitectureScreen.vue` | 260 |
| `src/ui/read-models/relations.ts` / `city-relations.ts` / `architecture.ts` | 285 / 75 / 254 |
| `src/ui/screens/file/FileRelationsPanel.vue` / `city/CityRelationsPanel.vue` | 140 / 193 |
| `src/ui/inspector-copy.ts` / `copy.ts` | 303 / 330 |
| `src/ui/components/SnapshotStatus.vue` | 134 |
| `src/application/scan-coordinator.ts` | 317 |
| `tests/unit/evidence-numbers.test.ts` | **404** (cap 450) |

## Review Focus

1. **The layering lint never forbids an import the code legitimately needs.**
   - `ui → application` and `ui → domain` stay allowed.
   - The tests pattern repeats in every new block, so flat config does not drop it.
   - The codec exception names one file.
2. **The contrast gate measures what renders.**
   - Its token resolver gives the same values the vendored host CSS produces: the existing recorded figures 4.26/3.43, 1.03/1.04 and 6.11/5.04 must reproduce before any change.
   - The structural sweep catches a `color:` using an ungated token.
3. **axe never passes vacuously.** Each screen is mounted with content (not empty states only), and the helper's positive control fails on an unnamed button.
4. **"Violations only" keeps every fallow-reported violation edge.** JP5's widening never shows a cycle list for a boundary-only report.
5. **CI runs exactly `npm run verify` plus the production audit,** with the line-ending step before checkout, and no native, analyze or fallow step.

---

### Task 1: The `moment` advisory (GRC14)

**Files:** Modify `package.json` and `package-lock.json`.

- [ ] **Step 1: RED.** Run `npm audit --json` and record the 4 moderate findings (`moment` 2.29.4, GHSA-4p3w-j4w9-5jqw).
- [ ] **Step 2:** Add `"moment": "2.31.0"` to `overrides` in `package.json` (beside `@puppeteer/browsers`). Then `npm install` to refresh the lockfile; do not run `npm audit fix`.
- [ ] **Step 3: GREEN.** `npm audit` reports 0 vulnerabilities, `npm ls moment` shows only 2.31.0, `npm run typecheck` passes (obsidian.d.ts imports moment's types), and `npm run lint` passes.
- [ ] **Step 4: Commit.** Subject: `build(deps): override moment to 2.31.0 for GHSA-4p3w-j4w9-5jqw (dev-only, via obsidian types) (gap closure GRC14)`.

---

### Task 2: The analyze baseline 9 → 4, and M118 coverage plus the residual fingerprint (GRC12, GRC13)

**Files:**
- Modify:
  - `src/domain/layout/districts.ts` (`LOT_FOOTPRINT`, `MAX_DIRECT_SUBDISTRICTS` un-exported);
  - `src/visualization/picking.ts` (`DRAG_THRESHOLD_CSS_PX`);
  - `src/ui/read-models/work-items.ts` (`entityPath`);
  - `src/application/scan-coordinator.ts` (`getLifecycle` deleted, with its doc reference at `:97`);
  - `tests/unit/evidence-numbers.test.ts`;
  - `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` (CRLF; the analyze line and a sweep fingerprint line);
  - `docs/superpowers/notes/2026-09-17-wp01-limitations.md` (`:234` analyze entry);
  - `docs/superpowers/notes/2026-09-17-wp01-implementation-report.md` (CRLF; `:186`, `:586`).
- Create: `tests/unit/may-publish-consulted.test.ts`.

- [ ] **Step 1: GRC12.** Grep each of the four names across `src` and `tests`, and confirm no importer (comments only). Remove `export` from each; delete `ScanCoordinator.getLifecycle` and fix the comment at `scan-coordinator.ts:97`. Run `npm run analyze`. **Expected:** 4 findings (the `fs` seam, `SourceReference`, the `EntityId` duplicate pair, the city-view ↔ leaf-registry cycle). Update the three evidence lines in their existing parseable shape: `evidence-numbers.test.ts:314-324` sums the parts, and `clean-vault-install.test.ts:239` slices the gate-evidence; check whether it covers that line.
- [ ] **Step 2: GRC13, RED then GREEN.** Create `tests/unit/may-publish-consulted.test.ts`:
  - `vi.mock('../../src/application/run-state', async (orig) => ({ ...(await orig()), mayPublish: vi.fn(() => false) }))`, then drive one scan with the in-memory store and the fake filesystem. Copy the setup from an existing scan-coordinator unit test.
  - Assert that `store.put` is never called and no `SCAN_COMPLETED` is reported, and that `mayPublish` was called once with the run identities.
  - **Control:** a second `describe` without the mock publishes.
  - **RED:** temporarily change `scan-coordinator.ts:210` to `if (false && !mayPublish(`; the mocked test fails. Revert.
- [ ] **Step 3: The sweep fingerprint.**
  - In `evidence-numbers.test.ts`, compute an FNV-1a hex of the sweep regexes' `source + flags` (read how the sweep regexes are defined there or in the sweep test they belong to).
  - Assert that it equals the `Sweep fingerprint: \`<hex>\`` line, which you add to the gate-evidence residual-list block (`:1084-1115`; CRLF, Edit only), and that items (a), (b) and (c) are present.
  - The failure message reads: "the sweep regexes changed: re-examine the residual list (a)–(c), then update the fingerprint".
  - **RED:** until the doc line exists, then again under a temporary change to one sweep regex.
  - Keep the file ≤ 450 lines.
- [ ] **Step 4: Gate and commit.** Subject: `refactor(analyze): drop four unused exports and getLifecycle (analyze 9 → 4); test that mayPublish is consulted and fingerprint the residual sweep (gap closure GRC12, GRC13)`.

---

### Task 3: The layering lint (GRC1, GCO10, GCP2)

**Files:**
- Move: `src/ui/stores/ports/review-repository.ts` → `src/application/ports/review-repository.ts` (`git mv`).
- Modify:
  - every importer (20 `src`, 45 tests): a scripted relative-path rewrite (these are LF files);
  - `src/adapters/storage/plugin-data-review-repository.ts` (also drop the `ui/inspector-copy` import);
  - `src/adapters/storage/review-repository-registry.ts`;
  - `eslint.config.mjs`.
- Create: `tests/build/eslint-layering.test.ts`.

- [ ] **Step 1: RED.** Create `tests/build/eslint-layering.test.ts`. It uses the ESLint Node API (`new ESLint({ cwd: process.cwd() })`, then `lintText(code, { filePath })`) and expects a `no-restricted-imports` error for each of:
  - `src/ui/x.ts` importing `../adapters/y`;
  - `src/ui/x.ts` importing `../host/y`;
  - `src/application/x.ts` importing `../ui/y`;
  - `src/adapters/x.ts` importing `../host/y`;
  - `src/adapters/x.ts` importing `../ui/y`.

  **Controls:** `src/ui/x.ts` importing `../application/y`, and `src/application/x.ts` importing `../domain/y`, produce no error. Run it; the five error cases fail (RED).
- [ ] **Step 2: The port move.**
  - `git mv` the port. The port imports only `domain/entity-id`; fix its own relative import.
  - Rewrite every importer's specifier with a small node script in the scratchpad that resolves each old relative path to the new one. Run `npm run typecheck`; it must pass.
  - In `plugin-data-review-repository.ts`, remove the `../../ui/inspector-copy` import. Throw code-only messages instead: the error's `code` already drives `ui/read-models/review-failure.ts`'s text. Check every test asserting the adapter's message text, and update those to codes.
- [ ] **Step 3: The bans.** In `eslint.config.mjs`, factor the existing tests-ban pattern into a shared `const` (flat config replaces rule options per block; see `:214-221`). Add three `no-restricted-imports` blocks:
  - `src/ui/**/*.{ts,vue}`: `['**/adapters/**', '**/host/**']`;
  - `src/application/**/*.ts`: `['**/adapters/**', '**/host/**', '**/ui/**']`;
  - `src/adapters/**/*.ts`: `['**/host/**', '**/ui/**']`.

  Each block repeats the shared tests pattern. Add one exception block for `src/adapters/storage/plugin-data-review-repository.ts` that allows only its `../../ui/read-models/review-record-codec` import (GCP2). Comment it as "the one recorded exception (GCP2) until the codec moves".
- [ ] **Step 4: GREEN.** The eslint-layering test passes. `npm run lint` is clean with no other exception; any other violation stops the task for a ruling. `npm run analyze` is still 4: the move creates no dead export.
- [ ] **Step 5: Gate and commit.** Subject: `build(lint): ui, application and adapters never import a layer above them; the review repository port moves to application (gap closure GRC1, GCP2)`.

---

### Task 4: CI on windows-latest (GRC2, GCO11, GCN9)

**Files:** Create `.github/workflows/verify.yml` and `tests/build/ci-workflow.test.ts`.

- [ ] **Step 1: RED.** Create `tests/build/ci-workflow.test.ts`. It parses `.github/workflows/verify.yml` with `yaml` (already a devDependency) and asserts:
  - `runs-on: windows-latest`;
  - triggers on `push` and `pull_request`;
  - read-only `contents` permission;
  - a step running `git config --global core.autocrlf false` that comes before `actions/checkout`;
  - `actions/setup-node` with node-version 24 (24.16 or newer resolves; `actions/setup-node`'s `24` gives the latest 24.x);
  - steps exactly `npm ci --ignore-scripts`, `npm run verify` and `npm audit --omit=dev --audit-level=moderate`;
  - no step mentioning `test:e2e`, `analyze` or `test:fallow`.

  RED: no file.
- [ ] **Step 2: GREEN.** Create the workflow:

```yaml
name: verify
on:
  push:
    branches: ['**']
  pull_request: {}
permissions:
  contents: read
concurrency:
  group: verify-${{ github.ref }}
  cancel-in-progress: true
jobs:
  verify:
    runs-on: windows-latest
    timeout-minutes: 40
    steps:
      - run: git config --global core.autocrlf false
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci --ignore-scripts
      - run: npm run verify
      - run: npm audit --omit=dev --audit-level=moderate
```

- [ ] **Step 3:** Run the test GREEN. Because `.github/` is new, also run `npx eslint .` (ignores YAML) and `npm run lint`.
- [ ] **Step 4: Gate and commit.** Subject: `ci: run npm run verify and the production audit on windows-latest for every push and PR (gap closure GRC2, GCO11)`.

**Note for the controller:** the first real CI run happens after the push. A test that skips locally (file symlinks; the junction and 8.3 alias cases) may run on the elevated runner. A first-run failure is handled after landing, fixed or ruled (GCN9), never skipped.

---

### Task 5: The contrast gate and token fixes (GRC3, GRC4, GCO12, GCO16)

**Files:**
- Create:
  - `tests/support/css-tokens.ts` (the resolver);
  - `tests/unit/contrast-gate.test.ts`.
- Modify:
  - `src/ui/styles/kit.css` (derived tokens, hover edge);
  - `src/ui/styles.css` (`:16` focus, `:17-18` error/warning, `.ci-snapshot-status__claims`, comment `:759-764`);
  - `screens-act.css`, `screens-audit.css`, `screens-explore.css`, `screens.css`, `shell.css` (repointed `color:`, hover-edge selectors);
  - `tests/unit/contrast-tokens.test.ts` (pins that change);
  - `docs/superpowers/notes/2026-09-17-wp01-limitations.md` (`:203-207`).

- [ ] **Step 1: The resolver, calibrated before any change.** Write `tests/support/css-tokens.ts`. It parses the vendored host blocks in `tests/harness/obsidian.css` (`body {` ~2028–2866, `.theme-light {` ~2874, `.theme-dark {` ~2921) plus `src/ui/styles.css:3-28` and `kit.css:3-30`.
  - **Resolver:** `var(--x, fallback)`, hex, `white`/`black`, `hsl(calc(var(--accent-h) - n), calc(var(--accent-s) * k), …)` and `color-mix(in srgb, A p%, B)` (a component-wise sRGB lerp).
  - **WCAG:** relative luminance with the 0.03928 threshold; `contrast(a, b)`.
  - **Calibration test (first):** at HEAD it must reproduce, within 0.01:
    - `--ci-on-action` on `--ci-action`: 4.26 dark / 3.43 light;
    - `--ci-raised` vs panel: 1.03 / 1.04;
    - on-action on fill: 6.11 or 6.12 / 5.04.

    If it cannot, stop and report: the gate would be measuring something else.
- [ ] **Step 2: RED.** Write `tests/unit/contrast-gate.test.ts` over both themes:
  - **Text, 4.5:1:**
    - `--ci-text`, `--ci-text-muted`, `--ci-text-faint` and `--ci-text-accent` on surface, panel, raised and hover;
    - `--ci-on-action` on the four fills;
    - `--ci-text-danger`, `-warning`, `-success` and `-sample` on surface, panel and raised;
    - `--ci-text-danger` on the critical tint `color-mix(in srgb, danger 16%, panel)`.
  - **Non-text, 3:1:** `--ci-focus` and `--ci-hover-edge` against surface, panel, raised and hover.
  - **Structural sweep:** no `color:` declaration in `src/ui/**/*.css` uses a token outside the gated text set. Read declarations with the existing `declared()` helper in the contrast tests, or a regex over the files.
  - **Safety claims:** `.ci-snapshot-status__claims` declares `color: var(--ci-text)`.

  Record the RED figures, which the audit expects: focus 2.24/1.88, faint 2.90/2.30, accent text 3.64/3.28, the source-preview line 4.26/3.43, and the missing tokens.
- [ ] **Step 3: GREEN** (all in derived tokens; no host variable redefined):
  - **Text tokens in `kit.css`:**
    - `--ci-text-faint: color-mix(in srgb, var(--text-faint) 45%, var(--text-normal))`;
    - `--ci-text-accent: color-mix(in srgb, var(--interactive-accent) 50%, var(--text-normal))`;
    - `--ci-text-danger` (red 55 %), `--ci-text-warning` (orange 50 %), `--ci-text-success` (green 50 %) and `--ci-text-sample` (yellow 45 %), each `color-mix(in srgb, <host colour> p%, var(--text-normal))`. Read the existing `--ci-tone-*`/`--ci-sample` definitions for the host colour variables.
  - **Repointed `color:` declarations:** every one using a `--ci-tone-*`, `--ci-sample`, `--ci-action`, `--ci-warning` or `--ci-error` token now uses the matching text token, across `kit.css`, `screens-act.css`, `screens-audit.css` and `shell.css:59`. Fills and borders keep `--ci-tone-*`.
  - **`styles.css`:** `:17-18` define `--ci-error`/`--ci-warning` as the text variants; `:16` sets `--ci-focus: var(--ci-text-accent)`.
  - **Hover edge:** `--ci-hover-edge: var(--text-muted)`, and one grouped kit rule giving every `--ci-hover` hover selector `box-shadow: inset 0 0 0 1px var(--ci-hover-edge)`. Find them with `grep -n "ci-hover" src/ui/styles`; the audit lists about 19.
  - **`screens-act.css:50`:** background `var(--ci-action-fill)`.
  - **Safety claims:** add `:where(.codebase-inspector-root) .ci-snapshot-status__claims { color: var(--ci-text); }` after `styles.css:767`, then rewrite the comment `:759-764` and LIM `:203-207`.

  Run the gate GREEN. Update `contrast-tokens.test.ts` pins that changed deliberately, and say which.
- [ ] **Step 4: Visual check.** Run `npm run harness-shot`, then look at the city, Architecture, Quality and Investigate captures in both themes, and the Settings captures. Report what changed (tone saturation, hover edges) and any problem. Re-run `tests/unit/host-cascade.test.ts` (it should accept a (0,1,0) span rule).
- [ ] **Step 5: Gate and commit.** Subject: `fix(ui): text and focus tokens reach 4.5:1 and 3:1 in both themes, hover becomes an edge, safety claims use the text token, and a test computes contrast from the tokens (gap closure GRC3, GRC4)`.

---

### Task 6: axe over every screen (GRC5, GCO13)

**Files:**
- Modify: `package.json` and `package-lock.json` (devDependency `axe-core`).
- Create:
  - `tests/support/axe.ts`;
  - `tests/component/axe-routes.test.ts`;
  - `tests/component/axe-dialogs.test.ts`;
  - `tests/component/axe-host-modals.test.ts`;
  - fixes as found.

- [ ] **Step 1:** Run `npm install -D axe-core`, then confirm `npm run build` still produces three `dist` files and that `assert-bundle` passes (axe must never reach `dist`).
- [ ] **Step 2: The helper and its positive control, RED.** `tests/support/axe.ts` exports `expectNoSeriousViolations(root: Element)`.
  - It runs `axe.run(root, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, rules: { 'color-contrast': { enabled: false }, region: { enabled: false }, 'landmark-one-main': { enabled: false }, 'page-has-heading-one': { enabled: false } } })` and fails listing each violation of impact `serious` or `critical`: rule id, help text, target.
  - `color-contrast` is off because jsdom has no layout and Task 5 covers contrast. The page-level rules are off because we render inside a leaf.
  - **Positive control:** a fixture with `<button></button>` (no name) fails the helper.
- [ ] **Step 3: The screens.** Mount each case with content, not only empty states, reusing each screen's existing component-test setup (seeded stores and the recording fixtures):
  - **The 16 routes in `src/ui/routes.ts`:** overview, city (S05, S07–S10, the S11 list and WebGL-failed), architecture (the map, matrix, cycles, edges and rules tabs), hotspots, quality, tests, dependencies, security, evolution, ownership, investigate, workbench, report, sources (fallow routes, review, installed; analysis running, failed, collected; run running, cancelling), settings (including the privacy tab), and file.
  - **The dialogs:** RuleEditor, PackageDetailDialog, SnapshotComparisonDialog, PriorityFormulaDialog, CreateNoteDialog, RefreshNoteDialog, FindingReviewDialog, ClearReviewDialog, ImportReviewDialog, EvidenceSourceDialog, ConnectFallowDialog, FallowRemoveDialog, WorkItemEditor and CommandPalette.
  - **The host modals:** scope, source and clear-binding; and the settings tab's rendered rows.

  Keep each file ≤ 450 lines; split routes across two files if needed.
- [ ] **Step 4: Fix what axe finds.** Each serious or critical finding is fixed in the component (the copy in copy modules), or, only if it is a jsdom false positive, disabled per rule **for that one case**, with a comment and a recorded ruling (report it; the controller ledgers it). List every finding and its disposition in the report.
- [ ] **Step 5: Gate and commit** (one commit per logical fix group is fine). Final subject: `test(a11y): axe over every route, dialog and host modal, failing on serious and critical violations; fixes for what it found (gap closure GRC5)`.

---

### Task 7: Evidence semantics — violations per file edge, JP5 widened, in-module violations (GRC6, GRC7, GRC8)

**Files:**
- Modify:
  - `src/ui/screens/architecture/EdgeList.vue`;
  - `src/ui/screens/ArchitectureScreen.vue`;
  - `src/ui/read-models/relations.ts`;
  - `architecture.ts`;
  - `city-relations.ts`;
  - `overview.ts` and `sources.ts` (the row state consumers);
  - `src/ui/screens/file/FileRelationsPanel.vue`;
  - `src/ui/screens/city/CityRelationsPanel.vue`;
  - `DependencyMatrix.vue`;
  - `ModuleMap.vue`;
  - `src/domain/relations/queries.ts`, only if `selfViolations` is computed there;
  - `src/ui/inspector-copy.ts` (new copy);
  - `src/ui/styles/screens-explore.css`.
- Tests:
  - `tests/component/architecture-edges.test.ts`;
  - `file-relations.test.ts`;
  - `city-relations-panel.test.ts`;
  - the overview and sources read-model tests;
  - `tests/fixtures/relations-report.ts` (move `boundaryOnlyJson` here, and add a same-module violation variant).

- [ ] **Step 1 (GRC6): RED, then GREEN.**
  - In `architecture-edges.test.ts`, add a mixed pair: a synthetic cycle-only file edge `ui/* → data/*` beside the boundary `ui/view.ts → data/db.ts`. With Violations only on, expect only the Boundary row. It is RED today, because both rows show.
  - Fix `EdgeList.vue:53` to `if (props.violationsOnly && !e.sources.includes('boundary')) return false;`, drop the `violating` prop and its binding (`ArchitectureScreen.vue:189`), and update the header comment.
  - Rename the test at `:155`, whose case passes only because its edge is also a boundary edge.
  - Map and Matrix stay per module pair. Add a one-line comment in each saying so (spec GRC6).
- [ ] **Step 2 (GRC7): RED, then GREEN.**
  - Add boundary-only cases (from the moved `boundaryOnlyJson`): File detail shows a Boundary row, not `FALLOW_NOT_ANALYSED`; city Relations shows the boundary edges with `RELATION_CYCLES_NOT_REPORTED`; the Overview / Data & scans row state is `partial`. Each is RED today.
  - Add `export function relationEdgesAnalysed(model)` to `relations.ts`, moving the logic from `architecture.ts:139-141`. Use it at all five sites. Cycle lists and highlighting stay gated on `model.analysed` (Review Focus 4: a boundary-only report never shows a cycle list).
- [ ] **Step 3 (GRC8): RED, then GREEN.**
  - Make a same-module violation fixture: a variant of the 3.27.0 recording with one boundary violation whose two files share a top-level folder.
  - Expect the Matrix diagonal for that module to show a marker plus visually hidden text `ARCH_MATRIX_SELF_VIOLATION(n)`, and the Map node's aria-label to end with `ARCH_NODE_SELF_VIOLATION(n)`. Both are RED today.
  - Implement `selfViolations: ReadonlyMap<string, number>` in `architecture.ts`: boundary edges with `moduleOf(from) === moduleOf(to)`. Add the diagonal marker (CSS in `screens-explore.css`) and the node class `ci-module-map__node--violation` with the aria suffix. Correct the comment at `architecture.ts:245-248`.
  - The copy, approved (GCN12), goes in `inspector-copy.ts` with a correct plural:
    - `ARCH_MATRIX_SELF_VIOLATION = (n) => \`Same module · ${n} boundary violation${n === 1 ? '' : 's'} inside\``;
    - `ARCH_NODE_SELF_VIOLATION = (n) => \`, ${n} boundary violation${n === 1 ? '' : 's'} inside\``.
- [ ] **Step 4: Gate and commit.** Subject: `fix(architecture): Violations only lists fallow's violation edges, a boundary-only report shows its edges on every surface, and a violation inside one module is marked (gap closure GRC6–GRC8)`.

---

### Task 8: Cards at 1280 px, the copy revisits, and deliverable status (GRC9, GRC10, GRC11)

**Files:**
- Modify:
  - `src/ui/styles/screens-explore.css`;
  - `src/ui/copy.ts` (`CLAIM_SOURCE_UNCHANGED`);
  - `src/ui/inspector-copy.ts` (six Architecture strings);
  - `src/ui/audit-copy/relations.ts` (`ARCH_RULES_CAPTION`);
  - the literal-pin tests the copy changes break (`scope-modal.test.ts:210-232`, `snapshot-status.test.ts:63`, `settings-tab.test.ts:199`, `architecture-screen.test.ts:136`, `architecture-relations.test.ts:103,107`, and any other grep finds);
  - `src/host/setting-definitions.ts:56` (comment);
  - `docs/deliverables/*.md` (WP-01–WP-04, Plugin Foundations).
- Create:
  - `tests/unit/architecture-card-fit.test.ts`;
  - `tests/unit/deliverables-status.test.ts`.

- [ ] **Step 1 (GRC9): RED, then GREEN.** The new test reads, with `declared()`, `--ci-nav-width`, `--ci-space-6`, the card gap and the Architecture card minimum. It asserts `floor((1280 − nav − 2·pad − 16 + gap) / (min + gap)) ≥ 5`, and is RED at 200 px. Add `:where(.codebase-inspector-root) .ci-screen--architecture .ci-screen__cards { grid-template-columns: repeat(auto-fit, minmax(176px, 1fr)); }` to `screens-explore.css`, then capture `wp02-architecture-dark` before and after.
- [ ] **Step 2 (GRC10): the approved wording, exactly as spec GCN12 gives it:**
  - `CLAIM_SOURCE_UNCHANGED`: "Scans and previews never change source files."
  - `RULE_NOT_EVALUATED_REASON`: "One of this rule's modules is not shown in the module graph, so it cannot be checked."
  - `ARCH_MAP_EYEBROW`: "Module graph · evidenced imports only"
  - `ARCH_MATRIX_CAPTION`: "Evidenced imports from each row module to each column module (cycle and boundary imports only)"
  - `ARCH_NODE_LABEL`: `(label, files, out, in) => \`${label}: ${files} file${files === 1 ? '' : 's'}; evidenced imports: ${out} outgoing, ${in} incoming\``
  - `RULES_EMPTY`: "No boundary rules yet. Add one to check an intended boundary against fallow's evidenced imports."
  - `BOUNDARY_INSPECTOR_SUBTITLE`: "Your rule, checked against evidenced imports."
  - `ARCH_RULES_CAPTION`: `(total, notEvaluated) => \`${total} rule${total === 1 ? '' : 's'} · ${notEvaluated} not evaluated\``

  Write the pin updates first, so each pin is RED against the old copy. For the plural, `architecture-relations.test.ts:103,107` with total 1 expects "1 rule". Then change the copy, GREEN. Check `tests/contracts/microcopy.test.ts` stays green (the CLAIMs are authored-fresh, not catalogue-pinned). Grep `tests/e2e` for any literal of the old strings; native tests must use the constants.
- [ ] **Step 3 (GRC11): RED, then GREEN.**
  - `tests/unit/deliverables-status.test.ts` parses each `docs/deliverables/*.md` frontmatter with `yaml` and asserts:
    - `status: delivered` for exactly Native Codebase City (WP-01), Fallow Ingestion (WP-02), Dependencies and Architecture (WP-03), Investigation and Notes (WP-04) and Plugin Foundations;
    - every delivered file has a `## Delivery record` mentioning "PR #1";
    - Snapshot History (WP-05) and every other deliverable stay `planned`.

    It is RED today.
  - Then:
    - edit the frontmatter;
    - add a WP-01 Delivery record (Native Codebase City has none);
    - add a "Delivered in PR #1" line to each existing record, keeping its caveats (WP-02's open manual check A12; WP-03's evidenced subset);
    - give Plugin Foundations an `id`/`status` in its existing frontmatter style.
- [ ] **Step 4: Gate and commit.** Subject: `fix(copy): approved wording for the source claim and the Architecture strings, five cards on one row at 1280 px, and shipped deliverables marked delivered (gap closure GRC9–GRC11)`.

---

### Task 9: Evidence and verification (Part C)

**Files:**
- Modify:
  - the two CRLF evidence notes (the G8 table and its mirror; the analyze line is already 4 from Task 2);
  - `docs/deliverables/Test Evidence.md` (one sentence each on the layering lint, the contrast gate, axe and CI);
  - the count tests, only where they pin a count.

- [ ] **Step 1:** Run `npm run test`; take the G8 figures from a run where the no-freeze case executed. Refresh the counts once (Edit/Write only, CRLF proof).
- [ ] **Step 2:** `npm run verify` exits 0. Report every run with its Z38 outcome.
- [ ] **Step 3:** The native gate on 1.13.4, then latest, under the portable Node. **Expected:** "Verified 41 executed native Vitest cases, including all 41 required scenarios." Also `npm run test:fallow`, `npm run analyze` (expect 4) and `npm audit` (expect 0).
- [ ] **Step 4:** `npm run harness-shot`. Look at the captures the part affects (contrast, cards, Architecture) and report them.
- [ ] **Step 5: Commit.** Subject: `docs(evidence): gap-closure Part C — layering lint, CI, the contrast gate, axe, analyze 4 and the counts`.

The controller checks the first real CI run after the push (one look with `gh run list`, no polling loop), rules on any first-run failure (GCN9), and transcribes the rulings into the ledger.
