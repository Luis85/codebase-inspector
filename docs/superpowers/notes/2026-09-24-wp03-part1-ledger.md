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

_To be filled in by the controller's pre-flight scan before Task 1 (JF1…)._

## Execution rulings

_Recorded during execution as "WP-03 E1"…._

## Deferred minors

_Recorded during execution._
