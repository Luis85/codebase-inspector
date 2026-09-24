---
project: codebase-inspector
title: WP-03 Part 1 — SDD ledger (rulings)
date: 2026-09-24
branch: feat/wp-03-part1
---

# WP-03 Part 1 — rulings

This ledger records every ruling made while planning and executing WP-03 Part 1 (dependency evidence from fallow), and what each one costs if it is wrong.

- Spec: `docs/superpowers/specs/2026-09-24-wp03-part1-dependencies-design.md` (N1–N40).
- Plan: `docs/superpowers/plans/2026-09-24-wp03-part1-dependencies.md` (15 tasks).
- Precedent, all binding:
  - the Part 3–7 ledgers, cited as in the polish ledger (E<n>, "Part 4 E<n>", "Part 5 E<n>", U<n>, "Part 6 E<n>", K<n>, PF<n>, "Part 7 E<n>");
  - the polish ledger (L1–L28, QF1–QF18, "Polish E1–E18").
- Numbering:
  - **J1…** are planning rulings;
  - **JF1…** are pre-flight rulings;
  - **"WP-03 E1…"** are execution rulings.
- Every ruling reads: **Ruling:** what — why — cost if wrong.

## Owner decisions (2026-09-24, before the spec)

| # | Decision |
|---|---|
| O1 | Edge source: **fallow's documented report evidence only** (cycles, re-export cycles, boundary violations, unresolved imports, file scores). No native import extractor, no per-selection `fallow trace`, no `viz` DOT parsing. |
| O2 | Sample module edges: **removed**, Part 6 style. |
| O3 | City arcs: **in this part**, with the §4.2 renderer port amended (`setRelations`, `CityPalette.relations`). |
| O4 | Your module rules: **evaluated on evidenced edges only**: *Violated* or *Not evaluated*, never *Passing*. |
| O5 | Relation controls: **a session store per leaf**. `CityViewState` is not changed. |
| O6 | Cycles, boundary violations and unresolved imports **become reviewable findings** in new categories. |
| O7 | The spec was approved as written, including §8's nine decisions (2026-09-24). |

## Planning rulings

| # | Ruling |
|---|---|
| J1 | **Ruling:** 15 tasks, in the order the dependencies dictate: fixtures (1) → domain (2) → reader (3) → model and normaliser (4) → index and Quality model (5) → relation read model (6) → Architecture and other read models (7) → Quality UI (8) → Architecture UI (9) → File detail panel (10) → renderer port and arcs (11) → city Relations (12) → real-binary test and benchmark (13) → harness (14) → evidence and verification (15). Task 2 has no dependency and can run right after Task 1. — Each task ends with its own test cycle and a reviewer could reject it alone. — Low: a mis-ordered dependency shows in the controller's "Consumes" re-check before the dispatch. |
| J2 | **Ruling:** every expected value about the relations fixture (counts, lines, whether 3.21.0 emits `edges`, whether the barrel pair is also a circular dependency) comes from Task 1's **recordings and README**, never from the plan or the spec's probe table. — The probe used a different scratch project, and fallow versions differ. — Low: a mismatch surfaces at Task 1 Step 4, before any code depends on it. |
| J3 | **Ruling:** the domain relation code orders ids by UTF-16 code unit (`a < b`), not `localeCompare`. `stronglyConnected` (moved from `cyclicComponents`) uses it too. — Ids are NUL-joined entity ids, and ordering must not depend on the host locale. — Low: the module-cycle order on Architecture could change for names that differ only by case. Architecture no longer shows module SCCs after Task 7, so nobody sees it. |
| J4 | **Ruling:** `DROPPED_KEYS` in `tests/fixtures/fallow-fixture.ts` loses `'file_scores'`. That section now survives the parse with exactly `path`, `fan_in` and `fan_out` (N1), and the reader test asserts exactly those three keys instead. — The test must follow the approved N1. — None. |
| J5 | **Ruling:** a new `TOOL_TEXT = z.string().max(1024)` bounds every new string field. **Correction to the spec:** N1's parenthetical calls this "the Y22 bound for tool strings", but no such bound exists in `fallow-report-schema.ts`. The existing fields (`path`, `export_name`, …) are unbounded, and this part does not change them. — The bound limits report-controlled text in the new fields at no cost. The older fields are out of scope. — Low: a real fallow path over 1,024 characters would make the whole report `invalid`. |
| J6 | **Ruling:** `optionalArray` may type its validator as the union `z.ZodType<T> \| ((item: unknown) => ElementResult<T>)`, with `ElementResult` exported from the schema module, if `Parameters<typeof firstArrayFailure<T>>` does not compile under TS 6. — The exported type becomes a used export, not a dead one. — None. |
| J7 | **Ruling (refines N3):** `RelationEvidence.fan` is `readonly ReportedFan[] \| null`, where `null` means "no `health.file_scores`". `RelationEvidence` also gains `cyclesReported: boolean`. — N8 needs to tell "section absent" (FALLOW_NOT_ANALYSED) from "file absent" (RELATION_FAN_NOT_SCORED), and N11's cycle category needs the "both arrays present" fact at the UI layer. — None: two more fields on an in-memory type. |
| J8 | **Ruling:** `DraftFinding` and `PathMapper` move from `normalize-fallow.ts` into a new `src/application/evidence/draft-finding.ts`, and `DraftFinding.prefix` becomes `FindingPrefix` (six prefixes). — `normalize-relations.ts` needs both, and importing them from `normalize-fallow.ts` would make the two modules import each other. — None. |
| J9 | **Ruling:** Task 11 first moves `makeInertPort` (with the new no-op `setRelations`) into `src/visualization/inert-port.ts`. — `city-renderer.ts` is 388/400, and the arc wiring needs about 10 lines. Moving the inert port frees about 20 without touching behaviour, which follows the file's own precedent of moving lighting out. — None. |
| J10 | **Ruling:** every renderer test double gains `setRelations: vi.fn(),` **on the same line as `setReported`**. — Four of those files are at or near the 450-line cap (L25), and a one-line-in-place edit keeps their counts. — None. |
| J11 | **Ruling:** `sample-signals.ts` drops `directDependents` but **keeps consuming its `r()` draw**, with a comment. — Removing the draw would shift every later seeded sample value (complexity, history, coverage) and silently change sample-backed screens and harness captures. — Low: an unused draw is one line of dead arithmetic. |
| J12 | **Ruling:** Architecture's `illustrative` list (the from-module's top files shown under a selected sample edge or violated rule) is **removed**. — It illustrated a *sample* edge, and with evidenced edges the Edges tab lists the real importing files with lines. — Low: a user loses "which files might be involved" for a violated rule. The Edges tab filtered by module gives the real answer. |
| J13 | **Ruling:** `relations.ts` exports `relationValue(model, n): MetricValue` (the relation evidence state for a count), used by `architecture.ts`. — It avoids a second copy of the provenance and state rules. — None. |
| J14 | **Ruling:** `FileFinding` gains `related`, `anchored` and **`anchorPath`**. `touchingFindings` sets them all in Task 5. — File detail must say "Reported on <anchor>" for a finding it shows through a related file, and the fingerprint must stay anchor-based (Part 6). — None. |
| J15 | **Ruling:** Task 9 creates `relations-store.ts` as a stub holding only `highlightedCycleId` and `showCycleInCity`. Task 12 completes it. — **Show in city** on the Cycles tab is Task 9's, and Task 12 comes later. — Low: Task 12 must keep the stub's order (select, then highlight, then navigate), and its tests pin that order. |
| J16 | **Ruling:** the real-binary relations case goes in a sibling file, `tests/fallow-real/fallow-real-relations.test.ts`. — It needs its own temp copy of a different project, and the existing file's structure is per-project. — None. |
| J17 | **Ruling:** `syntheticFallowJson` (the shared synthetic report) gains relation sections for snapshots of 6 or more files. That adds 5 findings to every synthetic report of that size. Task 14 re-runs and fixes, in place, every test that counts all synthetic findings. — The harness and every UI test then see real-shaped relation evidence without a second generator. — Medium: a missed count shows as a red test at Task 14 or in the final `verify`, never silently. |
| J18 | **Ruling:** Architecture tests that need more than one module use a snapshot with paths re-rooted without `src/` and the report normalised with `stripPrefix: 'src/'`. — Every relations-project file lives under `src`, which is one module. The strip prefix is the product's own mapping (Y26), so this also exercises Review Focus 3. — None. |
| J19 | **Ruling:** harness PNGs follow the existing convention for the capture output folder. Nothing new is committed if earlier parts did not commit theirs. — Consistency with Parts 1–7. — None. |
| J20 | **Ruling:** `EDGE_LIST_LIMIT` is exported from `use-architecture-selection.ts` and `RELATION_ARC_LIMIT` from `relations.ts`, so the benchmark (Task 13) asserts the same limits the screens use. — There is one definition of each limit. — None. |

## Pre-flight rulings

The pre-flight scan (2026-09-24, at 89ebabc) checked every Global Constraints line count with `wc -l`, every task's "Consumes" names, every existing symbol, path and npm script the plan names, one row per pair of tasks sharing a file or interface, and each task's own text against itself. It found 2 blocking, 13 rework and 21 cosmetic issues. Every `src` count matched. No consumed name lacks a producer.

| # | Ruling |
|---|---|
| JF1 | **Ruling:** Task 4 (not Task 14) makes `syntheticFallowJson` emit `circular_dependencies`, `re_export_cycles`, `boundary_violations` and `unresolved_imports` as `[]` in the check section of both the combined and the dead-code shape, with no `boundaries-not-configured` diagnostic. Task 14 still fills them for snapshots of 6 or more files (J17). — Without it every synthetic report reads `partial` from Task 4 on, and about 20 existing tests (`harness-evidence.test.ts:52,79`, `evidence-index.test.ts:52,62`, `findings-model.test.ts:81,124`) go red for ten tasks. — Low: the synthetic report claims boundaries were checked; it is a test fixture. |
| JF2 | **Ruling (amends N4, a spec defect):** `boundaries` is `'not-reported'` when there is no check section or no `boundary_violations` key; else `'not-configured'` when a `boundaries-not-configured` diagnostic is present; else `'configured'` when `boundary_violations` is non-empty **or** the report's `schema_version` is 12 or more; else `'not-reported'`. — fallow 3.21.0 (schema 11) has no `workspace_diagnostics` at all (`combined-3.21.0.json`, a project with no boundaries config), so N4 as written would read it as "configured, 0 violations": a zero nothing measured (Y33, Z23). On 3.21.0 an empty list cannot say whether the detector ran. — Low: a 3.21.0 report from a project that did configure boundaries and has none violated reads "not analysed" and a partial total instead of "0". |
| JF3 | **Ruling (refines N13):** `EvidenceIndex.count` over a category list mirrors N11's total rule. Not-configured members are left out. If none is left, the count is `unknown(FALLOW_BOUNDARIES_NOT_CONFIGURED)`. If every remaining member is analysed it is collected, if some are it is partial, and if none are it is `unknown(FALLOW_NOT_ANALYSED)`. — As the plan reads N13, "Import structure" would be partial on nearly every real project, because most configure no fallow boundaries. That contradicts N11 and spec §8.1. — Low: the card counts cycles and unresolved imports as complete when boundaries are off by the user's config. |
| JF4 | **Ruling:** Task 11 and the Global Constraints' `tests/benchmarks/city-renderer.test.ts` and `tests/benchmarks/city-budget.test.ts` are `tests/unit/city-renderer.test.ts` and `tests/unit/city-budget.test.ts`. — Those are the files that exist. — None. |
| JF5 | **Ruling:** Task 7 also edits `src/ui/shell/use-route-provenance.ts`, whose `architecture` case reads the removed `usesSample` and now returns `false`. — It is the only other reader of the field. — None: a typecheck failure otherwise. |
| JF6 | **Ruling:** Task 7 updates `tests/unit/report-model.test.ts` and `tests/unit/review-per-codebase.test.ts` in place for the new `architectureGraphFor` signature. — They call the one-argument form. — None. |
| JF7 | **Ruling:** Task 7 edits `src/ui/screens/SourcesScreen.vue`, `buildSourcesModel`'s only caller, to pass the relation state. — Without it the `imports` row is never partial on screen. — None. |
| JF8 | **Ruling:** Task 6 edits `tests/unit/work-items-model.test.ts` (the `FileSummary` literal with `directDependents`) in place. — It is a typed literal. — None. |
| JF9 | **Ruling:** Task 5 fixes every 4-card pin: the three in `findings-model.test.ts` (not one) and `tests/component/quality-screen.test.ts:45`, and runs that component test. — Otherwise Task 8's gate goes red and is blamed on the wrong task. — None. |
| JF10 | **Ruling:** Task 11 updates the seven-key `CityPalette` pin in `tests/acceptance/steps/lifecycle-steps.ts` to eight keys (citing N28) and runs its acceptance feature. It adds `relations` to the palette literals in `tests/component/picking.test.ts` (on existing lines, J10's rule: the file is 440) and `tests/fixtures/renderer-doubles.ts`. `tests/fixtures/city-view-doubles.ts` has no renderer and is not touched. — The plan's doubles list was wrong for those fixtures, and the pin would go red only at the final verify. — None. |
| JF11 | **Ruling:** Task 7 rewords `RULE_NOT_EVALUATED_REASON`, `ARCH_MAP_EYEBROW`, `ARCH_NODE_LABEL` and `ARCH_MATRIX_CAPTION` in place so they no longer say "sample", and deletes the constants its rewrite leaves unused (`ARCH_EDGES_CAPTION`, `ARCH_NO_CYCLES_CAPTION`, `ARCH_CARD_CYCLES`, or whichever are unused at the end). — The screen would call real evidence "sample", and dead exports are new `analyze` findings (N40). — Low: wording the owner may want to change. |
| JF12 | **Ruling:** Task 2 adds two exact tests: `a` both/2 gives `['1:out:a>b','1:out:a>e','1:in:c>a','1:in:d>a','2:out:b>c','2:out:e>f']` (pins the dedupe), and `x` out/2 over `{x→y, y→x}` gives only `x>y` (pins "never back through the node"). — The plan's two tests for these pass with the guarded code removed (the RED rule). — None. |
| JF13 | **Ruling:** Task 13's arc benchmark sets 5,000 lots and a palette first, and asserts 64 arcs are drawn before it times `setArcs`. — Without lots the arc module draws nothing, so the plan's benchmark times a no-op. — None. |
| JF14 | **Ruling:** Task 7's tests use the relations recordings (J18's strip-prefix snapshot), not `attachSyntheticReport`, which gains relation sections only in Task 14. — A task cannot consume a later task's fixture. — None. |
| JF15 | **Ruling:** Task 11's "through the port" case wraps the real `relation-arcs` module with `vi.mock` (importing the actual module) and asserts `city-renderer` forwards `setRelations`, lots on layout and swap, and colours. — Arcs live inside the scene and the fake GL renderer's `info` is all zeros, so nothing else is observable. The arc drawing itself is covered by the unit tests on `relation-arcs.ts`. — Low: a forwarding test, not a drawing test. |
| JF16 | **Ruling (corrects J11):** Task 6 deletes the `directDependents` draw from `sample-signals.ts`. — It is the **last** `r()` draw (lines 21–24), so removing it shifts no other seeded value, and J11's premise was wrong. — None. |
| JF17 | **Ruling:** the plan's `createRelationArcs()` shape (a `root` object, `setLots`, `setArcs`, `setColors`, `drawnCount`, `dispose`) replaces N29's `createRelationArcs(scene)` with `setArcs(arcs, lots)`. Its disposal goes through `disposal.ts`. — The plan changed the signature without a ruling. The new shape lets the renderer re-apply lots on a swap without re-sending arcs, which N28 requires. — None. |
| JF18 | **Ruling:** `FALLOW_BOUNDARIES_NOT_CONFIGURED` lives in `audit-copy/fallow.ts` and `EVIDENCE_SOURCE_FALLOW_PARTIAL` in `audit-copy/sources.ts`, as the plan's Global Constraints say, not in the two modules spec §2 names. — Each sits beside the strings of its own surface. — None. |
| JF19 | **Ruling (Global Constraints corrections):** (a) `exactOptionalPropertyTypes` is not enabled in either tsconfig, so it is a convention and the tests are the guard. (b) `[...set]` spreads already exist in `src`, but new `src` code still uses `Array.from`. (c) The line table is corrected: `city-view-store-wiring.test.ts` 439, `city-view.test.ts` 421 and `window-migration.test.ts` 409. The near-cap files it does not list are `city-viewport.test.ts` 448, `picking.test.ts` 440, `responsive-floor.test.ts` 415 and `renderer-contract.test.ts` 450. J10's same-line rule covers them all. — These are facts at 89ebabc. — None. |
| JF20 | **Ruling:** Task 13 moves `fallow-real.test.ts`'s module-local helpers (the temp copy, the fs snapshot and diff, the `FALLOW_BIN` lookup) into `tests/fixtures/fallow-real-harness.ts`. Both real-binary files import them. — Copying about 30 lines verbatim is a review defect. — Low: `test:fallow` is the only runner of both files, and Task 13 runs it. |
| JF21 | **Ruling:** Task 14 adds a WP-03 case to `tests/build/harness-shot.test.ts` pinning the new capture names. — Every earlier part pinned its captures there. — None. |
| JF22 | **Ruling:** relation state precedence is stale, then partial, then unknown (Overview and Data & scans). The Overview "Import relations" row reads "Not analysed" without a check section, as N26 says, not "Not collected". — The spec's words win over the plan's. — None. |
| JF23 | **Ruling (text fixes carried in the dispatches):** Task 10's Files include `src/ui/read-models/relations.ts` (`RELATION_ARC_LIMIT`, J20). Task 9's stub holds `highlightedCycleId` and `showCycleInCity`. Task 5's `titledFindings` rows set `anchorPath: file.path`. Task 6's Produces includes the exported `relationValue` (J13). "Consumes" attributions: `fallowDoc`/`fallowOutcome`/`rawReport`/`deepKeys` exist already, `EvidenceIndex.state`/`report` exist already, and Task 13 also uses `cityRelationsFor`, `EdgeList.vue` and `EDGE_LIST_HIDDEN`. The kit table is `EvidenceTable.vue` (no `DataTable` exists). The theme-bridge test follows `tests/unit/color.test.ts`'s fake window (no theme-bridge test exists). Task 4 drops the vacuous `RULE_TEXT('circular-dependencies')` assertion (`Record<FindingRule, string>` is the guard). Expected fixture values come from Task 1's README (J2). Task 11's "colours only" test asserts the position attribute is the same object. `aggregateEdges`' count is the number of distinct file edges per group pair (N19). — Each is a factual or wording mismatch between the plan and the code. — None. |

## Execution rulings

_Recorded during execution as "WP-03 E1"…._

## Deferred minors

_Recorded during execution._
