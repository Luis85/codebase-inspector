---
project: codebase-inspector
title: WP-03 — Part 1: dependency evidence from fallow — relation model, queries, new finding categories, the Architecture screen and city arcs (design)
status: draft, awaiting approval
date: 2026-09-24
branch: feat/wp-03-part1 (from feat/wp-01-codebase-city at 2bb64d5). Not stacked: fast-forwarded into feat/wp-01-codebase-city, so it lands on PR #1.
baseline: 2bb64d5
---

# WP-03 design — Part 1

These are binding:
- the WP-01 spec (`2026-09-17-codebase-inspector-wp01-design.md`), including the §4 frozen contracts, except where §1.E below amends §4.2 with the owner's approval;
- the visual-parity spec (`2026-09-20-codebase-city-visual-parity-design.md`);
- the WP-02 Part 1–7 specs (A1–A13, P1–P14, Q1–Q17, W1–W17, V1–V32, Y1–Y40, Z1–Z44).

Precedent, also binding:
- the Part 3–7 ledgers and the Part 7 polish ledger (R, E, S, X, T, U, K, PF, L, QF rulings);
- the polish plan's Global Constraints (line caps, city-view budget, layering, E40, copy in `audit-copy`, CRLF files edited only with Edit/Write, explicit timeouts for slow scans, the commit trailer).

This document records only what WP-03 Part 1 adds. Its decisions are numbered **N1–N40**. The ledger (`docs/superpowers/notes/2026-09-24-wp03-part1-ledger.md`) uses **J** for planning rulings, **JF** for pre-flight rulings and "WP-03 E<n>" for execution rulings.

## 0. Scope

WP-03 is "Dependencies and architecture" (`docs/deliverables/Dependencies and Architecture.md`). Part 1 delivers it from the evidence fallow **already documents** in the combined report that every collected run and every imported report carries. It adds no process, no argv and no trust change.

- **A. Relation evidence (03.1, 03.2).** The report reader also reads fallow's cycles, re-export cycles, boundary violations, unresolved imports and per-file fan-in/fan-out. Paths are matched to the snapshot as findings are (Y26). The graph's scope is stated everywhere.
- **B. Queries (03.3).** Directional neighbourhoods (in, out or both; 1 or 2 hops; limited, with a hidden count), the cycles through a file, cycle groups, and aggregation by module. Pure, in `src/domain/relations/`.
- **C. Three new finding categories.** `cycle`, `boundary` and `unresolved-import` flow through the findings lens, Quality, File detail, the review dialog, review decisions and the Overview count.
- **D. Screens (03.5).** The sample module edges are deleted. Architecture (Map, Matrix, new Cycles and Edges tabs, Rules), File detail, Overview, Data & scans and the city summary read real evidence or say "Not analysed".
- **E. City arcs (03.4).** A §4.2 renderer-port amendment, `setRelations`, draws the selected file's evidenced relations as directed arcs. It is controlled from a new Relations section in the city's file inspector.
- **F. Fixtures, tests and the benchmark (03.1, 03.6).**

The owner chose, on 2026-09-24:
- **edge source:** fallow's report only. No native import extractor, no per-selection `fallow trace` run, no `viz` DOT parsing;
- **sample edges:** removed, as Part 6 removed sample findings;
- **city arcs:** in this part, with the renderer port amended;
- **user boundary rules:** evaluated on evidenced edges only. A rule is *Violated* or *Not evaluated*, never *Passing*;
- **relation controls:** in a session store per leaf. `CityViewState` is not changed;
- **findings:** cycles, boundary violations and unresolved imports become reviewable findings in new categories.

### fallow facts this design rests on

These were probed on 2026-09-24 with the cached native `fallow.exe` 3.27.0, on scratch copies of `tests/fixtures/fallow/project`, of a purpose-built project and of this repository's `src/`. The output contract is `node_modules/fallow/types/output-contract.d.ts` in the fallow 3.27.0 npm package.

| Probe | Observed |
|---|---|
| a documented JSON export of the whole import graph | **none.** `viz` prints DOT or Mermaid text only, with no type-only flag and no unresolved nodes, and has no entry in the output contract. `viz --format json` ignores `--format`, prints nothing, and **writes `fallow-viz.html` into the analysed root** |
| `circular_dependencies[]` (combined `check`, and `dead-code`) | documented `CircularDependencyFinding`: `files` "in import order", `length`, `line`, `col`, and `edges?: {path, line, col}[]`, where `edges[i]` is the import in `files[i]` pointing to `files[(i + 1) % len]`. `edges` is optional ("pre-`edges` baselines") |
| cycles made only of `import type` | **not reported** as a cycle (the probe had `a ↔ b` through `import type` only: `circular_dependencies: []`). The contract does not say whether a hop is type-only |
| `re_export_cycles[]` | documented `ReExportCycleFinding`: `files` "sorted lexicographically", `kind: 'multi-node' \| 'self-loop'`. No hop order |
| `boundary_violations[]` | documented `BoundaryViolationFinding`: `from_path`, `to_path`, `from_zone`, `to_zone`, `import_specifier`, `line`, `col`. In 3.27.0 `import_specifier` held the resolved root-relative path, not the raw specifier. A type-only crossing allowed by `allowTypeOnly` is not reported |
| boundaries not configured | `workspace_diagnostics` holds `{kind: 'boundaries-not-configured', …}`. Its message says the detector did not run, so a zero is "nothing measured" |
| `unresolved_imports[]` | documented `UnresolvedImportFinding`: `path`, `specifier`, `line`, `col`, `specifier_col` |
| `health.file_scores[]` | documented: `path`, `fan_in` ("Modules importing this file"), `fan_out` ("Modules this file imports"), plus fields this design does not read. On this repository it listed 282 of 316 files, so a missing file is **not** zero |
| rule ids (`schema.json`) | `circular-dependencies`, `re-export-cycle`, `boundary-violation`, `unresolved-imports` |
| side effects | none of the reads above needs a new command: the combined run (Z15) already emits every section. No write under the root |
| this repository | 1 import cycle (`src/host/city-view.ts` ↔ `src/host/leaf-registry.ts`, lines 35 and 15), 0 re-export cycles, 0 unresolved imports, boundaries not configured |

fallow 3.21.0 is also cached (`%LOCALAPPDATA%/npm-cache/_npx/8335d9a462546d2d`). The relations fixture is recorded on both versions (N36).

## 1. Decisions

### A. Relation evidence (03.1, 03.2)

| # | Question | Decision |
|---|---|---|
| N1 | Which report fields are read | `fallow-report-schema.ts` declares, following the E31 pattern (each report-controlled array is `z.array(z.unknown())` in the shell and walked by hand, stopping at the first bad element):<br>• in `CHECK_SHELL_FIELDS`, **optional**: `circular_dependencies`, `re_export_cycles`, `boundary_violations`, `unresolved_imports`;<br>• in `HEALTH_SHELL_FIELDS`, **optional**: `file_scores`.<br>Element schemas (exported for `read-fallow-report.ts`):<br>• `CYCLE_SHELL = { files: z.array(z.unknown()), line: COUNT, col: COUNT, edges: z.array(z.unknown()).optional() }`; `files` walked with `z.string()`, `edges` with `CYCLE_EDGE = { path: z.string(), line: COUNT, col: COUNT }` (a two-level walk, like `buildDupes`);<br>• `RE_EXPORT_CYCLE_SHELL = { files: z.array(z.unknown()), kind: z.enum(['multi-node', 'self-loop']) }`;<br>• `BOUNDARY_VIOLATION = { from_path, to_path, from_zone, to_zone, import_specifier: z.string(), line: COUNT, col: COUNT }`;<br>• `UNRESOLVED_IMPORT = { path: z.string(), specifier: z.string(), line: COUNT, col: COUNT }`;<br>• `FILE_SCORE = { path: z.string(), fan_in: COUNT, fan_out: COUNT }`.<br>`WORKSPACE_DIAGNOSTIC` is unchanged; its `kind` is now read (N4).<br>`actions`, `introduced`, `is_cross_package`, `specifier_col` and every other `file_scores` field are still stripped (Y23's list gains nothing and loses only `file_scores`, which is now read for three fields). A string longer than 1,024 characters in any new field fails the walk as `invalid` (the Y22 bound for tool strings). |
| N2 | An absent section | An **absent** array is "not reported" and never an empty list. A 3.21.0 report has every one of these keys, so absence means a future or trimmed writer. The section's category is then `not-analysed` (N11). `edges` absent on a cycle gives hops with `line: null` (N3). |
| N3 | The path-level relation evidence | `NormalizedEvidence` gains `relations: RelationEvidence`, built in a new `src/application/evidence/normalize-relations.ts`, pure and snapshot-independent (like the findings, Y30):<br>`RelationEvidence = { importCycles: ReportedCycle[]; reExportCycles: ReportedReExportCycle[]; boundaryViolations: ReportedBoundaryViolation[]; unresolvedImports: ReportedUnresolvedImport[]; fan: ReportedFan[]; boundaries: 'configured' \| 'not-configured' \| 'not-reported' }`.<br>• `ReportedCycle = { findingId: string; files: string[]; hops: { from: string; to: string; line: number \| null }[] }`. `files` keeps fallow's import order. `hops[i]` is `files[i] → files[(i + 1) % n]` with `edges[i].line` when `edges[i].path === files[i]`, else `line: null`.<br>• `ReportedReExportCycle = { findingId; files: string[]; kind: 'multi-node' \| 'self-loop' }`. No hops: fallow gives no order.<br>• `ReportedBoundaryViolation = { findingId; from: string; to: string; fromZone: string; toZone: string; specifier: string; line: number }`.<br>• `ReportedUnresolvedImport = { findingId; path: string; specifier: string; line: number }`.<br>• `ReportedFan = { path: string; fanIn: number; fanOut: number }`.<br>Every path goes through the same `pathMapper` (Y26), strip prefix included. A cycle, re-export cycle or violation with **any** refused path is dropped whole and its paths are added to `rejectedPaths`. A `file_scores` entry with a refused path is dropped. `findingId` is the id N9 assigns, so a relation and its finding always point at each other. |
| N4 | "Boundaries" state | `boundaries` is `'not-reported'` when the report has no check section or no `boundary_violations` key; else `'not-configured'` when any `workspace_diagnostics[].kind === 'boundaries-not-configured'`; else `'configured'`. `raw-fallow.ts`'s `RawWorkspaceDiagnostic` already carries `kind`; `normalize-fallow.ts` keeps reading only `message` for `warnings`. |
| N5 | The graph's scope, stated | The evidenced edge set is **only** the hops of reported import cycles and the reported boundary violations. It is never called the import graph. Every surface that shows an edge, an edge count, a neighbourhood or an arc shows `RELATIONS_SCOPE_NOTE` (§2): "Only imports fallow reports in cycles and boundary violations. This is not the full import graph." A file with no evidenced edge is "No evidenced imports", never "no imports". |
| N6 | Edge semantics | An evidenced edge has `kind: 'import'` and `typeOnly: null`, rendered as `RELATION_TYPE_UNKNOWN` ("Type-only: not reported by fallow"). fallow's cycle detector skipping type-only cycles (probe) is **not** turned into a claim that a hop is a value import. Re-exports are not edges (no hop order, N3). Static coupling is never called execution: `RELATIONS_STATIC_NOTE` ("A static import. It does not show that code runs or that a change will break.") appears on the Edges tab and in the city Relations section. |
| N7 | Matching to the snapshot | A new `src/ui/read-models/relations.ts` resolves `RelationEvidence` against the snapshot's files by path, as `groupByFile` does (Y26). An edge whose `from` or `to` is not a snapshot file is **not drawn and not dropped silently**: it is counted in `unmatchedEdges` and its paths join the index's `unmatchedPaths`. A cycle with an unmatched member is kept in the Cycles list with that member shown as its path and "not in this snapshot" (`RELATION_MEMBER_UNMATCHED`), and none of its hops is drawn in the city. Fan values for an unmatched path are ignored. |
| N8 | Fan-in and fan-out | `relations.ts` exposes `fanIn(id)` and `fanOut(id)` as `MetricValue`s: `collected` (source `fallow`, detail as the other fallow values) when `file_scores` lists the file; `stale` under Y30/Z23; `unknown(RELATION_FAN_NOT_SCORED)` ("fallow did not score this file") when the section was read but the file is absent; `unknown(FALLOW_NOT_ANALYSED)` without a report or without `file_scores`. The sample `directDependents` in `sample-signals.ts` and `FileSummary` is deleted. |

### B. Findings: three new categories

| # | Question | Decision |
|---|---|---|
| N9 | Categories, rules, ids | `FindingCategory` becomes `'complexity' \| 'duplication' \| 'unused-exports' \| 'cycle' \| 'boundary' \| 'unresolved-import'`, and `FINDING_CATEGORIES` lists them in that order.<br>`FindingRule` gains fallow's own rule ids: `'circular-dependencies' \| 're-export-cycle' \| 'boundary-violation' \| 'unresolved-imports'`.<br>`FindingDetail` gains:<br>• `{ kind: 'cycle'; cycleKind: 'import' \| 're-export'; members: readonly string[]; hops: readonly { from: string; to: string; line: number \| null }[] }`;<br>• `{ kind: 'boundary'; toPath: string; fromZone: string; toZone: string; specifier: string }`;<br>• `{ kind: 'unresolved-import'; specifier: string }`.<br>Id prefixes: `CY-`, `BV-`, `UR-` (all pass `FINDING_ID_PATTERN`). `DraftFinding.prefix` gains them. Keys (Y24's recipe: stable across snapshots, never the line):<br>• import cycle: `import\|` + the member paths sorted and joined with `\n`;<br>• re-export cycle: `re-export\|` + the member paths (already sorted) joined with `\n`;<br>• boundary: `${from}\|${to}\|${specifier}`;<br>• unresolved: `${path}\|${specifier}`.<br>Severity is `null` for all three (fallow gives none), shown as "unrated" (Polish E2). The builders live in `normalize-relations.ts` (N3), which returns both the findings' drafts and the relation evidence; `normalize-fallow.ts` feeds the drafts into its existing `assignIds`. |
| N10 | Anchor and related files | `EvidenceFinding` gains `related?: readonly string[]`: the finding's other paths, sorted, without the anchor. It is omitted (never `undefined`, `exactOptionalPropertyTypes`) for single-file findings.<br>• A cycle is anchored on its **lexicographically first member**, which is fallow's own suppression convention for cycles. `line` is that member's hop line (or null); `related` is the other members.<br>• A boundary violation is anchored on `from`, at its `line`; `related` is `[to]`.<br>• An unresolved import is anchored on `path`, at its `line`; no `related`.<br>`symbol` is null for all three.<br>The fingerprint stays `${anchorFileId}#${findingId}` (Part 6), so the review format is unchanged: no durable schema holds a category enum, and `REVIEW_STATE_SCHEMA` stays v2. |
| N11 | Analysed or not | `categories` gains `cycle: analysed(check has both circular_dependencies and re_export_cycles)`, `'unresolved-import': analysed(check has unresolved_imports)`, and `boundary: analysed(boundaries === 'configured')`.<br>`NormalizedEvidence` gains `notConfigured: readonly FindingCategory[]`: `['boundary']` when `boundaries === 'not-configured'`, else `[]`.<br>`evidence-index.ts`'s total rule changes: the total is `partial` only when a category that is **neither analysed nor not-configured** exists. A not-configured category is off by the user's own fallow configuration, not missing evidence. Its own count is `unknown(FALLOW_BOUNDARIES_NOT_CONFIGURED)` ("Boundaries are not configured in fallow, so none were checked"), never 0. |
| N12 | Counting and the lens | A finding counts **once** everywhere a total is shown (Quality cards and rows, Overview, the CSV, `matchedFindings`).<br>`EvidenceIndex.byFile` keeps its meaning: findings by **anchor** file, so every existing consumer still counts once. A new `EvidenceIndex.touching: ReadonlyMap<EntityId, readonly EvidenceFinding[]>` lists a finding under its anchor **and** under each matched related file. The findings lens (`use-lens-view.ts`) reads `touching.keys()`, so it paints every member of a cycle and both ends of a violation. File detail's findings list and `perFile(id).findings` read `touching`, so the finding shows on each file it involves.<br>`resolveFindings` still requires the **anchor** to match. A related path that does not match is kept in `related`, shown as text, and added to `unmatchedPaths`. |
| N13 | Quality | `FINDING_KIND_LABEL`, `FINDING_TITLE` and `FINDING_RULE_LABEL` are retyped as `Record<FindingCategory, string>` and `Record<FindingRule, string>`, so a missing entry is a type error. `FINDING_TITLE_FOR` and `FINDING_DIALOG_RULE_VALUE` switch exhaustively on `detail.kind` (the `default: unused` branch becomes an explicit `case 'unused'` plus a `never` check).<br>The Type filter lists all six kinds. The cards row gains **one** card, `structure` ("Import structure"), counting open `cycle`, `boundary` and `unresolved-import` findings. `EvidenceIndex.count` accepts `FindingCategory \| readonly FindingCategory[] \| null`: a list is partial when some of its categories are analysed and unknown when none is. So Quality has five cards.<br>The CSV `kind` column prints the category id, as today. |
| N14 | The review dialog | For a finding with `related`, `FindingReviewDialog` shows an "Also involves" row (`FINDING_RELATED_LABEL`) listing each related path as text, with "not in this snapshot" for an unmatched one. For a cycle it also shows the hop path as text (N20's format). The dialog's decisions and "Add work item" use the anchor file, as today. |
| N15 | Architecture → Quality | `evidence-store.ts` gains `requestFindingReview(fingerprint)` and `consumeFindingReviewRequest(): string \| null`, the `requestImport` pattern. `QualityScreen` consumes it on mount and opens the review dialog on that finding, or does nothing if the finding is no longer listed. Architecture's cycle and violation rows get a **Review finding** button that calls it and navigates to `quality`. |

### C. Queries (03.3)

| # | Question | Decision |
|---|---|---|
| N16 | Where | `src/domain/relations/`, pure, no fallow words, node ids are strings:<br>• `graph.ts`: `DirectedEdge = { from: string; to: string }`, `RelationIndex` (`outgoing`/`incoming` adjacency maps, built once), `createRelationIndex(edges)`. Duplicate `(from, to)` pairs are merged; self-loops are dropped.<br>• `queries.ts`: `neighbourhood`, `stronglyConnected`, `aggregateEdges`.<br>`cyclicComponents` moves from `src/ui/read-models/architecture.ts` into `queries.ts` as `stronglyConnected` (same Tarjan, same ordering). The domain layering rule already forbids every outer import there. |
| N17 | Neighbourhood | `neighbourhood(index, node, { direction: 'in' \| 'out' \| 'both'; hops: 1 \| 2; limit: number })` returns `{ edges: readonly { from; to; hop: 1 \| 2; direction: 'in' \| 'out' }[]; hidden: number }`.<br>Breadth-first from `node`: hop 1 is the direct edges in the chosen direction(s); hop 2 continues **in the same direction** from each hop-1 neighbour, never back through `node`. Order: hop, then direction (`out` first), then the other end's id. `edges` holds the first `limit`, and `hidden` is the rest. An edge reached both ways appears once, at its lowest hop. |
| N18 | Cycles, and what the numbers mean | Three numbers, each labelled for exactly what it counts (§2):<br>• **Import cycles**: the length of fallow's `circular_dependencies` list (`RELATION_CARD_CYCLES`, "Import cycles reported by fallow");<br>• **Files in a cycle**: distinct matched members of those cycles;<br>• **Cycle groups**: `stronglyConnected` over the matched hop edges, keeping groups of more than one file. Two reported cycles that share a file form one group, so groups can be fewer than cycles.<br>Re-export cycles are counted separately ("Re-export cycles") and are never merged into the import-cycle numbers. |
| N19 | Aggregation by module | `aggregateEdges(edges, groupOf)` returns `{ from; to; count }[]` over distinct `groupOf(from) !== groupOf(to)` pairs, where `count` is the number of distinct file edges. Architecture's module is `moduleOf(path)` (top-level folder, `(root)`), unchanged. The 12-module cap (`MAX_GRAPH_MODULES`) is unchanged; an edge to an omitted module is counted in the Map's "N edges to modules not shown" note (`ARCH_EDGES_OMITTED_NOTE`). |

### D. Screens (03.5)

| # | Question | Decision |
|---|---|---|
| N20 | Architecture model | `src/ui/fixtures/sample-module-edges.ts` is **deleted**. `architecture.ts` builds from the relation model (N7):<br>• `ModuleEdge = { from; to; meaning: 'evidenced-import'; imports: MetricValue }`, where `imports` is the aggregated file-edge count, `collected`/`stale` like the other fallow values;<br>• cards: **Modules** (inventory, unchanged); **Evidenced imports** (distinct matched file edges, caption `RELATIONS_SCOPE_NOTE`'s short form); **Import cycles** (N18, caption "N files · M groups · K re-export cycles"); **Boundary violations** (fallow's violations plus your violated rules, N23; unknown when boundaries are not configured **and** you have no rules);<br>• without a report, or when the report has no check section, every relation value is `unknown(FALLOW_NOT_ANALYSED)`, the Map shows the modules with no edges and `ARCH_NOT_ANALYSED_NOTE`, and the Matrix shows empty cells with the same note;<br>• `usesSample` is removed from the Architecture model (as Y33 removed it from Quality).<br>The cycle path text format is `a.ts:35 → b.ts:15 → a.ts`: each hop's source with its line (`:?` when null), ending with the first member again. |
| N21 | Tabs | Map, Matrix, **Cycles**, **Edges**, Rules, in that order (`ARCH_TAB_CYCLES`, `ARCH_TAB_EDGES`).<br>• **Cycles:** one row per import cycle, then one per re-export cycle, each with its kind, member count, path text (N20) and **Review finding** (N15) and **Show in city** (N30) buttons. Selecting a row highlights its modules on the Map (the existing violating-edge style, reused as `ci-module-map__edge--cycle`) and shows the path in the inspector column.<br>• **Edges:** a sortable table (the kit `DataTable`) of matched file edges: From, To, Source (`Cycle` and/or `Boundary`), Line, and Type (`RELATION_TYPE_UNKNOWN`). Filters: direction relative to the selected module (All, Outgoing, Incoming) and source (All, Cycle, Boundary). Each row's From cell is a button that opens File detail on the importing file (select + navigate, never moving the camera). At most **200** rows (`EDGE_LIST_LIMIT`), then `EDGE_LIST_HIDDEN(n)`. Unresolved imports are listed below the table as "Unresolved imports" rows (`path:line → specifier`), never as edges.<br>The "Violations only" toggle stays and applies to Map, Matrix and Edges. |
| N22 | Keeping the screen within its cap | `ArchitectureScreen.vue` (243 lines) moves its selection state into a new `src/ui/screens/architecture/use-architecture-selection.ts` composable, and the two new tabs are new components, `CycleList.vue` and `EdgeList.vue`. No file passes 400. |
| N23 | Your rules | `RuleStatus` becomes `'violation' \| 'not-evaluated'` (`'passing'` is removed).<br>• `violation` when at least one matched evidenced file edge goes from a file in `rule.from` to a file in `rule.to`; `violatingImports` is that count;<br>• otherwise `not-evaluated`, with `RULE_NOT_EVALUATED_PARTIAL` ("No complete import graph: fallow reports only cycle and boundary imports") when a report is present, or the existing `RULE_NOT_EVALUATED_REASON` when a module is outside the graph, or `FALLOW_NOT_ANALYSED` without a report.<br>The rule table's status cell and the Report screen's rule list follow. Stored rules are unchanged. |
| N24 | fallow's own boundaries | The Rules tab gains a second panel, **Configured in fallow** (`ARCH_FALLOW_ZONES_TITLE`), below your rules: one row per matched violation (From file, To file, `from_zone → to_zone`, Line, **Review finding**). When boundaries are not configured it shows `FALLOW_BOUNDARIES_NOT_CONFIGURED` and no table; without a report, `FALLOW_NOT_ANALYSED`. It is read-only: nothing writes a fallow config. |
| N25 | File detail | The **Direct dependents** card becomes **Imported by** (`FILE_CARD_IMPORTED_BY`): `fanIn(id)` (N8), caption "Modules importing this file · fallow". A new **Relations** panel (`file/FileRelationsPanel.vue`) lists the file's evidenced outgoing and incoming edges (hop 1, both directions, N17 with limit 24) with line and source, its cycles as path text, and `fanOut`. Its buttons select the other file (File detail follows the selection). `usesSample` for File detail then depends only on complexity, coverage and priority. |
| N26 | Overview, city summary, Data & scans, Report | • Overview's **Architecture exceptions** card: value = import cycles (N18) in the evidence state; caption `OVERVIEW_ARCH_CAPTION(violations)` with the boundary-violation count or "boundaries not configured".<br>• Overview's **Import graph** coverage row becomes **Import relations** with state `partial` (source "fallow · cycles and boundary violations only") when a check section was read, `stale` when the report is stale, else `unknown` / "Not analysed".<br>• `city-summary.ts`'s `cycles` argument is the same value.<br>• Data & scans' `imports` provider row reads the relation state instead of `'sample'` (`sources.ts:89`), with `EVIDENCE_SOURCE_FALLOW_PARTIAL`.<br>• `FallowReportFacts` lists the three new categories through `FINDING_KIND_LABEL`. `circular_dependencies`, `re_export_cycles`, `boundary_violations` and `unresolved_imports` join `SHOWN_SUMMARY_KEYS`, so they leave "not shown". `boundary_coverage_violations` and `boundary_call_violations` stay in "not shown".<br>• The Report screen copies the Architecture cards and rule rows as today. |
| N27 | Memoisation | `relationModelFor(files, evidenceIndex)` is memoised per `EvidenceIndex` (one object per files array and raw report, Part 6), in the `use-read-models.ts` style. `architectureModelFor` keys on (relation model, the leaf's raw rules array) instead of (graph, rules). `use-read-models.ts` stays under 200 lines by moving the relation and architecture memo helpers into `relations.ts` and `architecture.ts`. |

### E. City arcs (03.4): the renderer-port amendment

| # | Question | Decision |
|---|---|---|
| N28 | The port change (owner-approved §4.2 amendment) | `CityRendererPort` gains:<br>`setRelations(arcs: readonly RelationArc[] \| null): void`<br>`RelationArc = { from: EntityId; to: EntityId; role: 'outgoing' \| 'incoming' \| 'cycle' }`<br>`CityPalette` gains `relations: { outgoing: string; incoming: string; cycle: string }`.<br>Its contract, written into `renderer-port.ts`'s CONTRACT NOTES:<br>• **Never throws.** `null` or `[]` removes every arc.<br>• **An overlay only:** no relayout, no recolour of any lot, no camera change, no pick target (arcs are never hit-tested).<br>• **Kept across `setColors` and `setLayout`.** After a new layout, an arc whose `from` or `to` is not a lot of that layout is not drawn (it is kept, and drawn again if a later layout has both ends). `from === to` is never drawn.<br>• **A new renderer starts with no arcs**; the view re-sends (N31).<br>• **At most 64 arcs** (`MAX_RELATION_ARCS`): the renderer draws the first 64 and ignores the rest. The UI never sends more than 24 (N30).<br>• The inert port (`makeInertPort`) and every renderer test double gain a no-op `setRelations`.<br>`getDiagnostics` is unchanged; the arcs' two draw calls show in `drawCalls`. |
| N29 | Drawing | A new `src/visualization/relation-arcs.ts` owns the overlay: `createRelationArcs(scene): { setArcs(arcs, lots); setColors(palette); dispose() }`.<br>• **Geometry:** each arc is a quadratic Bézier from the top centre of the `from` lot (`center[1] + dimensions[1] / 2`) to the top centre of the `to` lot, with its control point raised by `0.35 × horizontal distance + 2` world units above the higher end. It is sampled at 24 segments. All arcs share **one** `LineSegments` (one draw call, vertex colours).<br>• **Direction:** an arrowhead cone at the `to` end, oriented along the curve's tangent at `t = 0.92`, in **one** `InstancedMesh` of cones (one draw call). Direction is therefore shown by shape; colour only adds the role.<br>• **Colour by role:** `palette.relations[role]`.<br>• **Depth:** arcs draw with `depthTest: true`, so a tall building can hide an arc behind it; the text list is the complete record (N30).<br>• Geometry and materials are replaced on each `setArcs` and freed through `disposal.ts`, so repeated selection never leaks (a test counts `renderer.info` geometries).<br>`city-renderer.ts` (388 lines) only creates the overlay, forwards `setRelations`, re-applies it in `swapCity` and forwards colours. Anything more that would pass 400 lines moves into `relation-arcs.ts`. |
| N30 | What is drawn: the city Relations section | `FileInspector.vue` gains a **Relations** section (`src/ui/screens/city/CityRelationsPanel.vue`), shown when the selected entity is a file:<br>• controls: Direction (Both, Outgoing, Incoming; default Both) and Hops (1, 2; default 1), as a kit segmented control; a **Show arcs** checkbox (default on);<br>• the list: the neighbourhood (N17, limit **24**, `RELATION_ARC_LIMIT`) as rows "`→ path:line` (Cycle)" / "`← path:line` (Boundary)", each a button that selects that file (never moving the camera); `RELATION_HIDDEN(n)` when `hidden > 0`; `RELATIONS_SCOPE_NOTE`; `RELATIONS_STATIC_NOTE`;<br>• cycles through the file: one row per cycle with its path text and a **Highlight cycle** toggle button (`aria-pressed`). Highlighting replaces the neighbourhood arcs with the cycle's hops (role `cycle`); selecting another file clears it;<br>• no report: `FALLOW_NOT_ANALYSED`; a report with no evidenced edge for this file: `RELATIONS_NONE_FOR_FILE`.<br>The arcs sent are exactly the list's rows: role `outgoing` or `incoming`, or `cycle` for a highlighted cycle's hops. Arcs are sent only in `3d` and `top` modes; list mode has no renderer (M75) and the Relations section still lists them.<br>Architecture's **Show in city** (N21) sets the highlighted cycle, selects its anchor file and navigates to `city`. |
| N31 | State and wiring | A new setup store, `src/ui/stores/relations-store.ts` (one per leaf, like `lens-store.ts`): `{ direction, hops, showArcs, highlightedCycleId }` with `setDirection`, `setHops`, `setShowArcs`, `highlightCycle(id \| null)`. It resets to its defaults when the bound repository changes or the evidence goes away (the lens-store `flush: 'sync'` watcher). It is session state: nothing is added to `CityViewState`, `getState()` or `data.json`. Another leaf's store and camera are never touched.<br>`src/ui/screens/city/use-relation-renderer.ts`, called from `CityStage.vue` beside `useLensRenderer()`, watches `[renderer handle, arcs]` and calls `setRelations`, re-sending on every new renderer (the `use-lens-renderer.ts` pattern). `CityViewport.vue` (400/400) is not edited.<br>The arcs come from a pure `src/ui/read-models/city-relations.ts`: `cityRelationsFor(relationModel, selectedEntityId, controls): { rows; hidden; cycles; arcs }`. |
| N32 | Tokens and the palette | `kit.css`'s `:where(.codebase-inspector-root)` block gains `--ci-relation-out: var(--color-cyan, #53b8c4)`, `--ci-relation-in: var(--color-orange, #d99a5b)`, `--ci-relation-cycle: var(--color-red, #d9707a)` (host aliases with fallbacks, the T32 rule). `theme-bridge.ts`'s `readPalette` reads them into `relations`. The Relations list's direction glyphs (`→`, `←`) and a small swatch use the same tokens, so text and arcs agree. `styles.css` is not edited. |
| N33 | Budget | The arcs add at most two draw calls and 64 × 24 line segments. `tests/benchmarks/relations-budget.test.ts` (N37) measures `relation-arcs.ts`'s `setArcs(64 arcs)` on the 5,000-file layout, building the Three.js geometry without a GL context; its budget is a **median under 8 ms**. `city-budget.test.ts`'s 360-line caps on `city-view.ts` and `CityWorkspace.vue` hold (neither is edited beyond ≤ 5 lines). |

### F. Fixtures, tests and the benchmark (03.1, 03.6)

| # | Question | Decision |
|---|---|---|
| N34 | Contract fixtures | A new fixture project, `tests/fixtures/fallow/relations-project/` (about 12 files), holding:<br>• a 3-file import cycle `src/core/a.ts → b.ts → c.ts → a.ts`;<br>• a barrel re-export cycle `src/barrel/index.ts ↔ x.ts`;<br>• a type-only import `src/ui/view.ts → src/data/types.ts`;<br>• an unresolved import `./does-not-exist` in `src/index.ts`;<br>• `.fallowrc.json` boundaries (zones `ui`, `core`, `data`; `ui` may import `core`; `allowTypeOnly: ['data']`) and one violation `src/ui/view.ts → src/data/db.ts`;<br>• a disconnected file `src/orphan.ts`.<br>Recorded outputs (commands in `tests/fixtures/fallow/README.md`): `relations-combined-3.27.0.json`, `relations-combined-3.21.0.json`, and `relations-no-boundaries-3.27.0.json` (the same project with `.fallowrc.json` moved aside). `actions` and other bulky fields are kept as fallow wrote them (the reader strips them). |
| N35 | Unit and component tests | • **Reader:** each new section parses; an element with a wrong type fails as `invalid` with its path, and the walk stops at the first bad element (the E31 attack test, extended); an absent section is `not-reported`.<br>• **Normaliser:** the recorded fixtures give the expected cycles (hops and lines), re-export cycle, violation, unresolved import, fan values, finding ids and keys, anchors and `related`; `boundaries` is `configured` / `not-configured` / `not-reported`.<br>• **Domain:** hand-authored directed fixtures for `neighbourhood` (in, out, both; 1 and 2 hops; the limit and `hidden`; never back through the node; a disconnected node), `stronglyConnected` (two overlapping cycles form one group; a self-loop is dropped), `aggregateEdges`, and duplicate edges merging.<br>• **Read models:** unmatched edges counted (N7); fan states (N8); the three cycle numbers (N18); rules are `violation` or `not-evaluated` (N23); evidence-index totals and the not-configured rule (N11); counting once and painting every member (N12).<br>• **Components:** Architecture tabs (Cycles path text, Edges filters and limit, Configured in fallow), File detail (Imported by, Relations), Quality (five cards, six kinds, the review dialog's Also involves), the Relations section (controls, rows, hidden count, highlight), and the Architecture → Quality request.<br>• **Renderer:** `setRelations` draws the right number of segments and cones, keeps arcs across `setColors`/`setLayout`, drops missing ends, caps at 64, never throws, and frees its geometry.<br>Every new test fails without its code (the RED rule); a pin on behaviour that already holds names its mutation. |
| N36 | Real-binary test | `tests/fallow-real/fallow-real.test.ts` gains one case (or a sibling file, if it would pass 450 lines): the real 3.27.0 combined run on a temp copy of `relations-project` reports the expected cycle, re-export cycle, violation and unresolved import through the production reader and normaliser, and the filesystem diff shows **no write** under the analysed folder. `npm run verify` stays offline. |
| N37 | Dense-graph benchmark (03.6) | `tests/benchmarks/relations-budget.test.ts`, a synthetic 5,000-file graph with 2,000 evidenced edges and 200 cycles, measures (median of 20):<br>• `relationModelFor` build: under **50 ms**;<br>• `neighbourhood` (both, 2 hops, limit 24) on the highest-degree file: under **2 ms**, and `hidden` is stated;<br>• `aggregateEdges` to 12 modules: under **10 ms**;<br>• `setRelations(64)`: N33.<br>"Navigable with explicit truncation" is asserted, not only timed: the Edges tab shows 200 rows and `EDGE_LIST_HIDDEN(1800)`; the Relations section shows 24 rows and `RELATION_HIDDEN(n)`. |
| N38 | Harness | `tests/harness/seed.ts`'s synthetic report gains a cycle, a re-export cycle, two boundary violations, an unresolved import and fan values. New or re-framed captures:<br>• `wp03-city-relations-dark` and `-light` (a selected file with arcs and the Relations section);<br>• `wp03-city-cycle-dark` (a highlighted cycle);<br>• `wp03-architecture-cycles-dark`, `wp03-architecture-edges-dark`, `wp03-architecture-rules-dark`;<br>• `wp02-quality-*` re-captured with the five cards;<br>• `wp02-architecture-*` captures that showed sample edges are re-captured. |

### G. Delivery

| # | Question | Decision |
|---|---|---|
| N39 | Evidence documents | The gate evidence gains a **WP-03 Part 1** section: the deliverable's acceptance items, each with its test (§5), the benchmark numbers, the `test:fallow` output, and the G8 counts refreshed from disk once, in the final task (L28's rule). The limitations note gains §7 (§6 below). `docs/deliverables/Dependencies and Architecture.md` gains a delivery record, like Fallow Ingestion's, marking 03.1–03.6 delivered by Part 1 within the evidenced scope. |
| N40 | What counts as done | `npm run verify` exits 0; `npm run test:fallow` passes with `FALLOW_BIN` set to the cached 3.27.0; `npm run harness-shot` produces N38's captures; `npm run analyze` reports no new dead-code finding beyond the baseline of 9; every execution ruling is in the ledger. |

## 2. Copy

Every string goes into `src/ui/audit-copy/relations.ts` (new: Architecture, File detail and city Relations) or `src/ui/audit-copy/quality.ts` (the kinds, rules and dialog), and is re-exported through `inspector-copy.ts`. Changed Architecture strings are edited in place in `inspector-copy.ts`.

### New strings

| Constant | Text |
|---|---|
| `RELATIONS_SCOPE_NOTE` | Only imports fallow reports in cycles and boundary violations. This is not the full import graph. |
| `RELATIONS_SCOPE_SHORT` | Cycle and boundary imports only |
| `RELATIONS_STATIC_NOTE` | A static import. It does not show that code runs or that a change will break. |
| `RELATION_TYPE_UNKNOWN` | Type-only: not reported by fallow |
| `RELATION_MEMBER_UNMATCHED` | not in this snapshot |
| `RELATION_FAN_NOT_SCORED` | fallow did not score this file |
| `RELATIONS_TITLE` | Relations |
| `RELATIONS_DIRECTION_LABEL` / `_BOTH` / `_OUT` / `_IN` | Direction / Both / Outgoing / Incoming |
| `RELATIONS_HOPS_LABEL` | Hops |
| `RELATIONS_SHOW_ARCS` | Show arcs in the city |
| `RELATIONS_NONE_FOR_FILE` | No evidenced imports for this file. |
| `RELATION_HIDDEN(n)` | `${n} more not shown` |
| `RELATION_SOURCE_CYCLE` / `_BOUNDARY` | Cycle / Boundary |
| `RELATIONS_CYCLES_TITLE` | Cycles through this file |
| `RELATIONS_HIGHLIGHT_CYCLE` | Highlight cycle |
| `RELATIONS_FAN_OUT` | Imports (fallow) |
| `ARCH_TAB_CYCLES` / `ARCH_TAB_EDGES` | Cycles / Edges |
| `RELATION_CARD_CYCLES` | Import cycles reported by fallow |
| `RELATION_CYCLES_CAPTION(files, groups, reExports)` | `${files} files · ${groups} groups · ${reExports} re-export cycles` |
| `ARCH_CARD_EVIDENCED` | Evidenced imports |
| `ARCH_NOT_ANALYSED_NOTE` | No fallow report is attached, so no imports are shown. Attach or run one in Data & scans. |
| `ARCH_EDGES_OMITTED_NOTE(n)` | `${n} evidenced imports go to modules not shown` |
| `EDGE_LIST_HIDDEN(n)` | `${n} more imports not shown` |
| `EDGE_COL_FROM` / `_TO` / `_SOURCE` / `_LINE` / `_TYPE` | From / To / Source / Line / Type |
| `EDGE_FILTER_DIRECTION` / `_SOURCE` | Direction / Source |
| `UNRESOLVED_TITLE` | Unresolved imports |
| `CYCLE_KIND_IMPORT` / `CYCLE_KIND_RE_EXPORT` | Import cycle / Re-export cycle |
| `CYCLE_REVIEW` / `CYCLE_SHOW_IN_CITY` | Review finding / Show in city |
| `ARCH_FALLOW_ZONES_TITLE` | Configured in fallow |
| `FALLOW_BOUNDARIES_NOT_CONFIGURED` | Boundaries are not configured in fallow, so none were checked. |
| `RULE_NOT_EVALUATED_PARTIAL` | No complete import graph: fallow reports only cycle and boundary imports. |
| `FILE_CARD_IMPORTED_BY` / `_CAPTION` | Imported by / Modules importing this file · fallow |
| `EVIDENCE_SOURCE_FALLOW_PARTIAL` | fallow · cycles and boundary violations only |
| `OVERVIEW_IMPORTS_ROW` | Import relations |
| `FINDING_KIND_LABEL` additions | cycle: Import cycle · boundary: Boundary violation · unresolved-import: Unresolved import |
| `FINDING_RULE_LABEL` additions | circular-dependencies · re-export-cycle · boundary-violation · unresolved-imports (fallow's ids, verbatim) |
| `QUALITY_CARD_STRUCTURE` / `_CAPTION` | Import structure / Cycles, boundary violations and unresolved imports |
| `FINDING_RELATED_LABEL` | Also involves |

### Changed strings

| Constant | Was | Becomes |
|---|---|---|
| `ARCH_MAP_FOOTNOTE` | "…Sample edges, not observed imports. City arcs make no dependency claim." | `RELATIONS_SCOPE_NOTE` |
| `ARCH_CARD_EDGES` | Sample module edges | removed (replaced by `ARCH_CARD_EVIDENCED`) |
| `SAMPLE_EDGE_DETAIL`, `IMPORT_GRAPH_UNKNOWN_REASON` | — | removed; their uses read the relation state |
| `FILE_CARD_DEPENDENTS` / `_CAPTION` | Direct dependents / Illustrative fan-in | removed (N25) |
| `OVERVIEW_ARCH_CAPTION` | a constant | `OVERVIEW_ARCH_CAPTION(violations: string)` |
| the `passing` rule-status label | Passing | removed (N23) |

## 3. Screens and surfaces touched

- **Architecture:** cards, Map, Matrix, the new Cycles and Edges tabs, Rules with "Configured in fallow", the inspectors (N20–N24).
- **City:** the file inspector's Relations section and the arcs (N28–N32).
- **File detail:** Imported by, the Relations panel, findings via related files (N12, N25).
- **Quality:** five cards, six kinds, the review dialog's Also involves, the focus request (N13–N15).
- **Overview, city summary, Data & scans, Report:** N26.
- **The findings lens:** paints related files (N12).

## 4. Units

| Unit | Kind | Notes |
|---|---|---|
| `src/domain/relations/{graph,queries}.ts` | new | N16–N19 |
| `src/application/evidence/normalize-relations.ts` | new | N3, N4, N9, N10 |
| `src/application/evidence/{fallow-report-schema,read-fallow-report,raw-fallow,normalize-fallow,model}.ts` | edit | N1–N4, N9–N11 |
| `src/application/evidence/resolve-findings.ts` | edit | N12 (related paths) |
| `src/visualization/renderer-port.ts` | edit | N28 (§4.2 amendment) |
| `src/visualization/relation-arcs.ts` | new | N29 |
| `src/visualization/city-renderer.ts` | edit | N28, N29 |
| `src/host/theme-bridge.ts` | edit | N32 |
| `src/ui/read-models/{relations,city-relations}.ts` | new | N7, N8, N27, N31 |
| `src/ui/read-models/{architecture,evidence-index,findings,file-detail,file-summaries,overview,city-summary,sources,report,use-read-models}.ts` | edit | N11–N13, N20–N27 |
| `src/ui/fixtures/sample-module-edges.ts` | **deleted** | N20 |
| `src/ui/fixtures/sample-signals.ts` | edit | drops `directDependents` (N8) |
| `src/ui/stores/relations-store.ts` | new | N31 |
| `src/ui/stores/evidence-store.ts` | edit | N15 |
| `src/ui/screens/city/{CityRelationsPanel.vue,use-relation-renderer.ts}` | new | N30, N31 |
| `src/ui/components/{FileInspector,CityStage}.vue` | edit | N30, N31 |
| `src/ui/screens/architecture/{CycleList.vue,EdgeList.vue,FallowBoundaryTable.vue,use-architecture-selection.ts}` | new | N21, N22, N24 |
| `src/ui/screens/ArchitectureScreen.vue`, `architecture/{ModuleMap,DependencyMatrix,BoundaryRuleTable,BoundaryInspector,ModuleInspector}.vue` | edit | N20–N24 |
| `src/ui/screens/file/FileRelationsPanel.vue` | new | N25 |
| `src/ui/screens/{FileDetailScreen,QualityScreen}.vue`, `quality/{FindingFilters,FindingReviewDialog}.vue`, `sources/FallowReportFacts.vue` | edit | N13–N15, N25, N26 |
| `src/ui/audit-copy/relations.ts` | new | §2 |
| `src/ui/audit-copy/{quality,fallow,sources}.ts`, `src/ui/inspector-copy.ts` | edit | §2 |
| `src/ui/styles/{kit,screens-explore}.css` | edit | N32, the new tabs and the Relations section |
| `tests/fixtures/fallow/relations-project/**`, `tests/fixtures/fallow/relations-*.json`, `tests/fixtures/fallow/README.md` | new or edit | N34 |
| `tests/fixtures/{evidence-report,fallow-fixture,fallow-expected}.ts`, renderer doubles | edit | N35 |
| `tests/fallow-real/*.test.ts` | edit or new | N36 |
| `tests/benchmarks/relations-budget.test.ts` | new | N33, N37 |
| `tests/harness/{seed,mount}.ts`, `scripts/harness-shot.mjs` | edit | N38 |

## 5. Testing and acceptance evidence

N35–N38 list the tests. The evidence notes are updated once, in the final task (N39).

### The deliverable's acceptance, item by item

| Acceptance item | Evidence |
|---|---|
| Hand-authored directed fixtures verify incoming/outgoing queries | domain `neighbourhood` tests (N35) |
| … cycles | domain `stronglyConnected` tests; normaliser tests on the recorded cycle with hops and lines |
| … disconnected files | `src/orphan.ts` in the fixture has no edge and reads "No evidenced imports"; a disconnected domain node has an empty neighbourhood |
| … type-only edges where available | fallow does not report per-edge type-only information. The fixture's type-only import is **not** an edge and **not** a violation (`allowTypeOnly`); every edge shows `RELATION_TYPE_UNKNOWN`. Recorded as a limitation (§6) |
| … boundary rules | recorded violation → `BV-` finding and a "Configured in fallow" row; your rules are `violation` or `not-evaluated` (N23); `not-configured` in the no-boundaries fixture |
| … aggregation | `aggregateEdges` tests; the Map and Matrix component tests |
| Edge drill-down resolves to real evidence | the Edges tab's From button opens File detail on the importing file, with the line from fallow; the finding's review dialog shows the same line |
| Dense graphs remain navigable with explicit truncation | N37 |
| Static coupling is not presented as proof of runtime execution or inevitable breakage | `RELATIONS_STATIC_NOTE` on the Edges tab and the Relations section (component tests); a copy test finds no "calls", "executes" or "will break" claim in `audit-copy/relations.ts` except that sentence |
| Selection-based edges, not a hairball | arcs are drawn only for the selected file or a highlighted cycle; there is no "show all" (N30) |
| Cap visible edges and state the hidden count | 24 in the city (N30), 200 in the Edges tab (N21), 64 in the renderer (N28) |
| Separate highlight for a selected cycle, with its path in text | role `cycle` arcs and colour; the path text in the Relations section and the Cycles tab (N20, N30) |
| A 2D/list alternative with keyboard access | the Edges tab and the Relations list (buttons, tab order); the canvas stays `aria-hidden` |
| Selected relations stay in each leaf; sharing does not move another leaf's camera | `relations-store` is per leaf; a two-leaf test changes one leaf's controls and checks the other's store and camera (N31) |
| Not called an Obsidian backlink | a copy test finds no "backlink" in `audit-copy/relations.ts` |
| Record unresolved/missing nodes and graph scope instead of silently discarding edges | unresolved imports listed (N21); unmatched edges counted and their paths listed (N7); `RELATIONS_SCOPE_NOTE` everywhere (N5) |
| Do not assume an undocumented `viz --format json`, and do not scrape fallow's HTML | the reader reads only documented contract fields; `fallow-argv-policy.test.ts` still pins the one run argv, so `viz` never runs |

## 6. Limitations

These are written into `2026-09-17-wp01-limitations.md` §7:

- **A partial graph.** Only imports that fallow reports in import cycles or boundary violations are edges. Neighbourhoods, the Map, the Matrix, the Edges tab and the arcs show that subset. A file with no evidenced import may still import or be imported by many files; File detail's **Imported by** (fallow's fan-in) is the complete count where fallow scored the file.
- **No type-only distinction.** fallow reports no per-edge type-only flag in its documented JSON. Type-only cycles are not reported by fallow at all (observed on 3.27.0).
- **Re-export cycles have no direction.** They are listed and reviewable, but not drawn.
- **Your module rules can only be violated, never passed.** Without the full graph, a rule with no evidenced crossing is "Not evaluated".
- **Boundaries depend on the analysed folder's fallow config.** Without one, boundary violations are "not configured", and this is not counted as missing evidence.
- **Arcs are depth-tested.** A tall building can hide part of an arc; the Relations list is the complete record.
- **3.21.0 and 3.27.0 only.** The relation fields were recorded on these two versions.

## 7. Out of scope

- The whole import graph from any source: a native import extractor, per-selection `fallow trace` runs, `viz` DOT or Mermaid parsing, or fallow's HTML.
- Co-change and observed-call relations, and the Evolution screen's change coupling (stays sample).
- The external-packages Dependencies screen (stays sample).
- Writing or editing fallow config (`.fallowrc.json`) from the plugin.
- Persisting the relation controls across a reload (owner choice: session only).
- Showing all arcs at once.
- `boundary_coverage_violations` and `boundary_call_violations` (stay "not shown").
- The open owner decisions: M80/F14 renderer retry cap, M95 pointer capture, the spec §7 root-unavailable producer, Y19 external `data.json` edits, and the Z38 no-freeze budget. The manual Part 7 acceptance check (item 3) stays the owner's.

## 8. Decisions taken while writing (for owner review)

1. **Boundaries "not configured" does not make the findings total partial** (N11). It is shown as its own "not configured" state instead. The alternative marks almost every real report partial, because most projects configure no fallow boundaries.
2. A cycle is anchored on its **alphabetically first member**, matching fallow's own suppression convention (N10). Each finding counts once, and the lens paints every member (N12).
3. **One Quality card**, "Import structure", covers the three new categories, rather than three new cards (N13).
4. Three **separately labelled cycle numbers**: fallow's import cycles, files in a cycle, and cycle groups (N18).
5. **Arc limits:** 24 from the UI and 64 in the renderer. The Edges tab shows at most 200 rows (N21, N28, N30).
6. **Arcs are depth-tested** rather than drawn on top (N29), because always-on-top arcs over a dense city hide the lots they connect.
7. Arc colours alias `--color-cyan`, `--color-orange` and `--color-red`, and direction is always also shown by an arrowhead (N29, N32).
8. **Show in city** highlights the cycle, selects its anchor file and navigates, but never moves the camera (N30), following the existing rule that selection never moves the camera.
9. Budgets: relation model build under 50 ms, neighbourhood under 2 ms, aggregation under 10 ms, and arc build under 8 ms (N33, N37).
