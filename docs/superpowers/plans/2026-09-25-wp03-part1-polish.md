# WP-03 Part 1 polish pass: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the actionable follow-ups PR 1 lists under "WP-03 Part 1 → Known limitations and follow-ups": the two rulings the owner revisited (PO1, PO2), the Task 9 and Task 13 deferred minors, the city Relations arrow wrap, and the E26 highlight left behind by a vanished cycle.

**Architecture:** no new layer and no new module except tests. Every change sits in the Architecture read model and screen, the relations store, one CSS rule, and the evidence documents.

**Tech Stack:** as the WP-03 Part 1 plan (`docs/superpowers/plans/2026-09-24-wp03-part1-dependencies.md`): TypeScript 6.0.3, Vue 3.5.43, Pinia 4.0.3, Vitest 5.0.1 + @vue/test-utils 2.5.1, Node 24.

**Authorities (binding):**
- the WP-03 Part 1 spec `docs/superpowers/specs/2026-09-24-wp03-part1-dependencies-design.md` (N1–N40), amended only where PO1 and PO2 say;
- the WP-01 spec §4, the WP-02 Part 1–7 specs, every ledger (Parts 3–7, the Part 7 polish ledger, the WP-03 Part 1 ledger);
- this pass's ledger `docs/superpowers/notes/2026-09-25-wp03-part1-polish-ledger.md`: owner decisions **PO1…**, planning rulings **JP1…**, pre-flight rulings **JQ1…**, execution rulings **"WP-03 Polish E1…"**.

**Branch:** `feat/wp-03-part1-polish` from `6419392` (the PR 1 head), worktree `.claude/worktrees/wp-03-part1-polish`. After the final review it is fast-forwarded onto `feat/wp-01-codebase-city`.

**Out of scope** (JP1): the inherent limitations (partial graph, no type-only flag, re-export cycles not drawn, rules never "passing", 3.21.0 boundaries, recorded versions), the arc constants (E22), the M80/F14 retry cap, M95 pointer capture, the spec §7 root-unavailable producer, Y19 external `data.json` edits, the Z38 no-freeze budget, the owner's manual Part 7 check.

## Global Constraints

**Size** (eslint `max-lines`; measured at 6419392 with `wc -l`)
- `src/**/*.{ts,vue}` max **400** lines; `tests/**/*.ts` max **450**. A file that would pass its cap is split, never compressed.
- Files this plan touches, with their size now: `src/ui/read-models/architecture.ts` 204, `src/ui/screens/ArchitectureScreen.vue` 252, `src/ui/screens/architecture/EdgeList.vue` 168, `src/ui/read-models/relations.ts` 267, `src/ui/stores/relations-store.ts` 71, `src/ui/audit-copy/relations.ts` 93, `src/ui/inspector-copy.ts` 299, `src/ui/styles/screens-explore.css` 233 (no cap), `tests/unit/architecture-model.test.ts` 135, `tests/component/architecture-edges.test.ts` 203, `tests/component/architecture-rules.test.ts` 213, `tests/component/architecture-screen.test.ts` 169, `tests/component/architecture-cycles.test.ts` 188, `tests/component/city-relations-panel.test.ts` (check with `wc -l` before growing it; new cases go in a new file if it would pass 450), `tests/benchmarks/relations-budget.test.ts` 229.
- **Never grow** the near-cap tests the WP-03 plan lists (`city-view-store-wiring.test.ts`, `welcome-state.test.ts`, `city-view.test.ts`, `window-migration.test.ts`, `evidence-numbers.test.ts`, `renderer-contract.test.ts`, `city-viewport.test.ts`, `picking.test.ts`). `src/ui/components/CityViewport.vue` is never edited.

**Layering** — unchanged from WP-03 Part 1: `src/ui/**` never imports adapters or host; screens read read models, stores and copy only; no process, argv, spawn or trust change; `CityViewState`, `getState()`, `data.json` and the review format v2 are unchanged.

**Evidence (Z23/Z25, N5)** — absent evidence is never `0`; every value from a report goes through Vue text interpolation; no composite score; every surface that shows an edge keeps `RELATIONS_SCOPE_NOTE`.

**TypeScript and lint** — ES2020 `lib` only (no `.at()`, `Object.hasOwn`, `replaceAll`, `findLast`); oxlint `--deny-warnings` with `consistent-function-scoping`; `Array.from(set)`, never `[...set]`; PF1 timers, PF2 no no-op closures, PF14 arrow-function store members; no redundant `as`; no `undefined` assigned to an optional property; **no new dead export** — `npm run analyze` stays at the baseline of **9**, and an export only a test imports is made module-private.

**Accessibility** — E40: a button that can become blocked while focused uses `aria-disabled="true"` plus a guarded handler; element ids from `useUniqueId()`; announce only real outcomes.

**Copy and CSS**
- New strings go in `src/ui/audit-copy/relations.ts` and are re-exported through `src/ui/inspector-copy.ts` like the others; an Architecture string already in `inspector-copy.ts` is changed or removed in place. A string left without a consumer is deleted.
- CSS only in `src/ui/styles/{kit,screens-explore}.css`, under `:where(.codebase-inspector-root)`, BEM `ci-*`, colours only through `--ci-*` tokens, no Vue `<style>` blocks.

**Tests**
- The RED rule: every new test fails without its code; the implementer runs it RED and pastes the output. A pin on behaviour that already holds is proved by the mutation the task names. Every `.every(...)` assertion is preceded by a non-empty check (E27).
- Reports are built through the real parser and normaliser (`tests/fixtures/relations-report.ts`, `tests/fixtures/evidence-report.ts`), never mocked.
- Explicit per-test timeouts (`30_000`) on whole-`src` scans.
- **Editing files:** only with the Edit/Write tools. Never `sed -i`, heredocs or scripts: files may be CRLF.
- **Never `git stash`** (WP-03 E3). Show RED by temporarily reverting with Edit.

**Gates and commits**
- Per-task gate: `npm run typecheck`, `npm run lint:fast`, `npx eslint <touched src and test files> --max-warnings 0`, `npx vitest run <the task's test files and every existing test file the task edits>`, each as its own foreground command.
- `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` may fail on file counts until Task 4 refreshes them. Do not run the full suite per task and do not "fix" those two early.
- Commit after each task with only its own files (never the ledger): `git commit -m "<subject>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`. The trailer is literal whatever model you run on.

**Process** — implementers and reviewers never spawn subagents; reviewers are read-only. Implementers report files changed with line counts, the gate output, RED and GREEN output, and every deviation from this plan.

## Review Focus

1. **Two units never added (PO1).** No surface (card, caption, Report, Markdown export) adds fallow's boundary violations (distinct findings) to your violated rules (a rule count) or to violating imports (an import count).
2. **Not configured is not 0 (N11).** With fallow boundaries not configured, the fallow card is `unknown(FALLOW_BOUNDARIES_NOT_CONFIGURED)` even when your rules are violated; your-rules card is independent of it.
3. **"Violations only" and a same-module fallow violation (PO2).** A fallow violation whose two ends are in one module keys the diagonal; the Matrix must not crash or hide it, and the Map (which draws no self-edge) must not claim it.
4. **A report with boundary violations but no cycle arrays** (the Task 9 deferred minor). Edges, Map and Matrix show the boundary edges; the Cycles tab and cycles card still read "not analysed"; the evidenced-imports card is `partial`, never `collected` and never `unknown`.
5. **A re-imported report that drops the highlighted cycle** (E26). The highlight clears; a re-import that keeps the same cycle (same content-hash id) keeps it.

---

### Task 1: The violations card split (PO1) and "Violations only" with fallow's violations (PO2)

**Consumes:** `buildArchitectureModel`, `violationsValue`, `ArchitectureCard`, `ArchitectureModel.violatingEdgeKeys`, `edgeKey` (`src/ui/read-models/architecture.ts`); `relationBoundaryValue`, `RelationModel.edges` (`RelationEdgeView.sources`, `fromPath`, `toPath`), `RelationModel.boundaryFindings` (`src/ui/read-models/relations.ts`); `moduleOf` (`src/ui/read-models/file-summaries.ts`); `ARCH_CARD_VIOLATIONS`, `ARCH_VIOLATIONS_CAPTION` (`src/ui/inspector-copy.ts`); the report read model's `architecture.cards` (`src/ui/read-models/report.ts:58`).
**Produces:** `ArchitectureCard.id` gains `'rules'`; the `violations` card carries fallow's count only; a new `rules` card; `violatingEdgeKeys` = your violated rule pairs ∪ fallow boundary-violation module pairs; new copy `ARCH_CARD_RULES`, `ARCH_RULES_CAPTION`, `ARCH_RULES_NONE`, `ARCH_VIOLATIONS_FALLOW_CAPTION` in `audit-copy/relations.ts`.

**Files:**
- Modify: `src/ui/read-models/architecture.ts`, `src/ui/audit-copy/relations.ts`, `src/ui/inspector-copy.ts` (remove `ARCH_VIOLATIONS_CAPTION` if unused), `src/ui/styles/kit.css` or `screens-explore.css` only if five cards do not lay out (see Step 4)
- Test: `tests/unit/architecture-model.test.ts` (or a new `tests/unit/architecture-violations.test.ts` if it would pass 450), the component tests that pin the card values or the Violations-only filter (`tests/component/architecture-screen.test.ts`, `architecture-rules.test.ts`, `architecture-edges.test.ts`), and any report test pinning Architecture's cards (find with `grep -rn "Boundary violations" tests`)

- [ ] **Step 1: RED.** Tests, through the real relations recordings (`tests/fixtures/relations-report.ts`, J18's strip-prefix snapshot for more than one module):
  - `violations` card = `relationBoundaryValue(relations, relations.boundaryFindings)` — on the with-boundaries recording, collected with fallow's distinct count; with a violated rule of yours added, **the same value** (not the sum);
  - on the no-boundaries recording with a violated rule of yours: `violations` is `unknown` with reason `FALLOW_BOUNDARIES_NOT_CONFIGURED`; `rules` is collected 1;
  - `rules` card: `unknown(ARCH_RULES_NONE)` when you have no rules; `unknown(notAnalysedNote)` when `notAnalysed`; else `collected(<violated rule count>, 'review')`, caption `ARCH_RULES_CAPTION(total, notEvaluated)`;
  - `violatingEdgeKeys` holds `edgeKey(moduleOf(fromPath), moduleOf(toPath))` for every relation edge whose `sources` include `'boundary'`, plus your violated rule pairs;
  - component: with "Violations only" on and no rule of yours, the Edges tab keeps fallow's boundary edges and hides cycle-only edges.
- [ ] **Step 2: GREEN.** In `architecture.ts`:
  - `violationsValue(relations)` returns `relationBoundaryValue(relations, relations.boundaryFindings)` (which already yields the not-configured and not-analysed unknowns). Its doc comment says why the two units are never added (PO1, amending N20 and E8/E24).
  - The `violations` card caption: `notAnalysed ? notAnalysedNote : ARCH_VIOLATIONS_FALLOW_CAPTION` (`'Reported by fallow'`).
  - A fifth card after it: `{ id: 'rules', label: ARCH_CARD_RULES ('Your rules violated'), icon: 'shield', tone: 'warning', value, caption }` as Step 1 states, with `ARCH_RULES_CAPTION = (total, notEvaluated) => \`${total} rules · ${notEvaluated} not evaluated\`` and `ARCH_RULES_NONE = 'No module rules yet. Add one on the Rules tab.'`.
  - `violatingEdgeKeys`: the union above. Use `moduleOf` on the edge paths (it is what `FileSummary.module` is built from — confirm in `file-summaries.ts`; if it is not, map through the files' `module` by entity id instead and say so in the report).
  - Remove `ARCH_VIOLATIONS_CAPTION` if nothing reads it any more.
- [ ] **Step 3: consumers.** `grep -rn "cards" src/ui/read-models/report.ts src/ui/screens/report` — the Report and its Markdown export list Architecture's cards by label and value, so they pick up both cards; update any test that pins four Architecture cards. `BoundaryInspector`'s "This edge breaks a boundary rule." now also covers fallow's boundaries; keep the wording.
- [ ] **Step 4: layout.** Read the card-grid CSS rule the Architecture screen uses and confirm it lays out five cards as Quality's five do. Change CSS only if it hard-codes four columns. Task 4's `harness-shot` re-captures `wp02-architecture-*`.
- [ ] **Step 5: gate and commit** — `feat(architecture): fallow's boundary violations and your violated rules are two cards, and Violations only keeps fallow's violations (PO1, PO2)`.

---

### Task 2: Edges and the module views gate on any analysed edge category

**Consumes:** `ArchitectureModel.notAnalysed`, `notAnalysedNote`, `evaluateRules`, the `evidenced` and `cycles` cards (`architecture.ts`); `RelationModel.analysed`, `RelationModel.boundaries`, `relationValue`, the module-private `provenanceCache` (`relations.ts`); `CycleList`'s `notAnalysed` prop (`ArchitectureScreen.vue:171`); `EDGE_DIRECTION_NO_MODULE` (`audit-copy/relations.ts:83`, `EdgeList.vue:99`).
**Produces:** `ArchitectureModel.cyclesNotAnalysed: boolean`; `notAnalysed` becomes "no edge category analysed"; `relationEdgesValue(model, n): MetricValue` exported from `relations.ts` (used by `architecture.ts`); copy `RELATION_CYCLES_NOT_REPORTED`.

**Files:**
- Modify: `src/ui/read-models/architecture.ts`, `src/ui/read-models/relations.ts`, `src/ui/screens/ArchitectureScreen.vue`, `src/ui/audit-copy/relations.ts`
- Test: `tests/unit/architecture-model.test.ts` (or the Task 1 sibling file), `tests/component/architecture-edges.test.ts`, `tests/component/architecture-cycles.test.ts`

- [ ] **Step 1: RED.** Build a report from the with-boundaries 3.27.0 recording with `check.circular_dependencies` and `check.re_export_cycles` deleted (a trimmed writer, N2). Assert:
  - `notAnalysed` is false and the Edges tab lists the boundary edges; Map and Matrix show them;
  - `cyclesNotAnalysed` is true; the Cycles tab and the cycles card read not analysed (unchanged);
  - the `evidenced` card is `partial` with the edge count and reason `RELATION_CYCLES_NOT_REPORTED`;
  - a rule of yours with no evidenced crossing reads `RULE_NOT_EVALUATED_PARTIAL`, not `FALLOW_NOT_ANALYSED`;
  - with no report, and with a report without a check section, everything reads exactly as today.
  - EdgeList: with no module selected, the direction note reads `EDGE_DIRECTION_NO_MODULE`; with one selected, `EDGE_DIRECTION_RELATIVE(<label>)` (the Task 9 deferred minor; prove RED by a mutation of the condition).
- [ ] **Step 2: GREEN.**
  - `relations.ts`: `relationEdgesValue(model, n)` — `relationValue(model, n)` when `model.analysed`; else when `model.boundaries === 'configured'`: stale when the model is stale (JF22's precedence), otherwise `{ state: 'partial', value: n, provenance, reason: RELATION_CYCLES_NOT_REPORTED }`; else `unknown(FALLOW_NOT_ANALYSED, 'fallow')`. `RELATION_CYCLES_NOT_REPORTED = "fallow's report has no cycle section, so only boundary-violation imports are counted."`
  - `architecture.ts`: `edgesAnalysed = state !== 'none' && (analysed || boundaries === 'configured')`; `notAnalysed = !edgesAnalysed`; `cyclesNotAnalysed = state === 'none' || !analysed`. The `evidenced` card uses `relationEdgesValue`; the `cycles` card caption uses `cyclesNotAnalysed`; `evaluateRules`' reason uses `edgesAnalysed`; `ModuleEdge.imports` uses `relationEdgesValue`.
  - `ArchitectureScreen.vue`: `CycleList` receives `architecture.cyclesNotAnalysed`; Map, Matrix and EdgeList keep `architecture.notAnalysed`.
- [ ] **Step 3: gate and commit** — `fix(architecture): boundary edges show when a report has no cycle section, and the Edges direction note is pinned (WP-03 Task 9 deferred minors)`.

---

### Task 3: The city Relations row keeps its arrow on the path's line, and a vanished cycle's highlight clears

**Consumes:** `useRelationsStore` (`highlightedCycleId`, its report watcher, `src/ui/stores/relations-store.ts:57-63`); the evidence store's `report` (`report.normalized.relations.importCycles[].findingId`); the `.ci-city-relations__select`, `__glyph`, `__path` rules (`src/ui/styles/screens-explore.css:142-151`); `CityRelationsPanel.vue` (read only unless the markup must change).
**Produces:** the store clears `highlightedCycleId` when a new report no longer holds that cycle; the row CSS.

**Files:**
- Modify: `src/ui/stores/relations-store.ts`, `src/ui/styles/screens-explore.css`, `src/ui/screens/city/CityRelationsPanel.vue` only if the CSS alone cannot keep the glyph with the path
- Test: a new `tests/component/relations-highlight-reimport.test.ts` (or `city-relations-panel.test.ts` if it stays under 450)

- [ ] **Step 1: RED.** With a highlighted cycle, attach a new report (through the real import path the other panel tests use) that (a) no longer contains the cycle — `highlightedCycleId` becomes null and no arcs are sent for it; (b) contains the same cycle — the highlight is kept.
- [ ] **Step 2: GREEN.** Add a `watch(() => evidence.report, …, { flush: 'sync' })` beside the existing watchers: when the report object changes and is non-null, clear `highlightedCycleId` unless an import or re-export cycle in the new report has that `findingId`. The existing repository and report-removed `reset()` watcher is unchanged.
- [ ] **Step 3: the arrow.** The row button is `display: flex; flex-wrap: wrap`, so a long outgoing path drops onto its own line and leaves the arrow alone. Keep the glyph and the path together: e.g. give `.ci-city-relations__path` `flex: 1 1 0; min-width: 0` so it wraps inside itself (it already has `overflow-wrap: anywhere`), leaving the source and hop labels free to wrap below. Check the result on `npm run harness-shot`'s `wp03-city-relations-dark` capture (Read the PNG) and describe it in the report. CSS changes have no RED; the capture is the evidence.
- [ ] **Step 4: gate and commit** — `fix(city): a vanished cycle's highlight clears on re-import, and a Relations row keeps its arrow beside the path (WP-03 E26 follow-up, cosmetic follow-up)`.

---

### Task 4: Benchmark mutation evidence, evidence documents and counts

**Consumes:** `tests/benchmarks/relations-budget.test.ts` (its truncation assertions for `EDGE_LIST_LIMIT`, `RELATION_ARC_LIMIT` and the arc cap); `docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md` (the WP-03 Part 1 section, G8 table, "Numbers in this document"); `docs/superpowers/notes/2026-09-17-wp01-limitations.md` §7; `tests/unit/gate-evidence.test.ts`, `tests/unit/evidence-numbers.test.ts`.
**Produces:** a "WP-03 Part 1 polish" subsection in the gate evidence; refreshed counts.

**Files:**
- Modify: the two notes and the two count tests named above. No `src` file.

- [ ] **Step 1: the Task 13 deferred minor.** For each truncation assertion in `relations-budget.test.ts`, mutate the limit it depends on in `src` (with Edit), run `npx vitest run tests/benchmarks/relations-budget.test.ts`, paste the failing output, and restore the file exactly (`git diff --stat` shows nothing in `src` afterwards). If an assertion survives its mutation, strengthen it and say so.
- [ ] **Step 2: the evidence.** Add a short "WP-03 Part 1 polish" subsection under the WP-03 Part 1 section of the gate evidence: what changed (PO1, PO2, the gating, the highlight, the arrow) and the mutation runs. In the limitations note §7, drop the follow-ups this pass closed and keep the rest.
- [ ] **Step 3: refresh the counts from disk.** Run `npm run test` once, read the file and test counts and the `src/` floor from its output, and update `gate-evidence.test.ts`, `evidence-numbers.test.ts` and the G8 table together.
- [ ] **Step 4: verification.** Each as its own command: `npm run verify`; `npm run test:fallow` with `FALLOW_BIN` set to `%LOCALAPPDATA%/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe`; `npm run analyze` (9); `npm run harness-shot`. Paste each tail.
- [ ] **Step 5: commit** — `docs(evidence): WP-03 Part 1 polish pass, benchmark mutation runs and refreshed counts`.
