---
type: Deliverable
order: 8.75
id: WP-03
title: Dependency and architecture explorer
status: planned
dependsOn:
  - WP-02
parent: "[[Plugin MVP]]"
---
# Package 03 — Dependency and architecture explorer

## Outcome

“I can select a file or directory, see what it depends on and what depends on it, and investigate cycles and boundary violations.”

## Scope and evidence

Add typed relations, directory aggregation, incoming/outgoing neighborhoods, cycle groups, boundary findings, and a synchronized edge list/2D representation. Use actual provider output. Fallow documents HTML/DOT/Mermaid visualization formats [S11]; do not assume an undocumented `viz --format json` graph API exists. Select a documented, fixture-tested adapter or an explicitly chosen complementary graph provider.

Do not scrape embedded JavaScript from fallow's HTML as a stable machine contract. Record unresolved/missing nodes and graph scope instead of silently discarding inconvenient edges.

## Work

| Task | Deliverable |
|---|---|
| 03.1 | Relation model and provider compatibility fixtures |
| 03.2 | Validated graph ingestion and path reconciliation |
| 03.3 | Directional query indexes, neighborhood limits, cycle calculation |
| 03.4 | Selective city arcs and explicit arrow direction |
| 03.5 | Edge list, package/directory aggregation, architecture filter |
| 03.6 | Correctness tests and dense-graph usability benchmark |

## Interaction

Default to selection-based edges, not an all-repository hairball. Choose incoming/outgoing, one/two hops, and relation type. Cap visible edges and state the hidden count. Use a separate highlight for a selected cycle and show its path in text. Provide a 2D/list alternative for precise analysis and keyboard access.

Distinguish static imports, type imports, runtime imports, re-exports, co-change, and observed calls whenever the provider distinguishes them. An ambiguous edge stays labeled ambiguous; do not invent semantics. Counting cycle components is different from counting every possible cycle—label the metric precisely.

## Obsidian integration

Keep selected relations within each leaf's state; sharing a snapshot must not move another leaf's camera. Open relevant notes only through an explicit action. Do not call a source-code relationship an Obsidian backlink; they belong to separate graphs.

## Acceptance

Hand-authored directed fixtures verify incoming/outgoing queries, cycles, disconnected files, type-only edges where available, boundary rules, and aggregation. Edge drill-down resolves to real evidence. Dense graphs remain navigable with explicit truncation. Static coupling is not presented as proof of runtime execution or inevitable breakage.

## Delivery record

Built on branch `feat/wp-03-part1` (fast-forwarded onto `feat/wp-01-codebase-city`, so it
lands on PR #1); design in
`docs/superpowers/specs/2026-09-24-wp03-part1-dependencies-design.md` (N1–N40).

**Scope: the evidenced subset only.** Part 1 delivers this deliverable from the relation
evidence fallow already documents in the same combined report every collected run or
imported report carries — cycles, re-export cycles, boundary violations, unresolved
imports and per-file fan-in/fan-out. It is not the whole import graph: no native import
extractor, no per-selection `fallow trace`, no `viz` DOT/Mermaid parsing and no scraping
of fallow's HTML (spec §0, §7). Every surface that shows an edge, an edge count, a
neighbourhood or an arc says so (`RELATIONS_SCOPE_NOTE`).

| Task | Delivered by |
|---|---|
| 03.1 | §1.A N1–N2: the report schema's new optional relation fields; §1.F N34: the recorded relations fixture project (`tests/fixtures/fallow/relations-project`, both 3.21.0 and 3.27.0) |
| 03.2 | §1.A N3–N8: the normaliser, path reconciliation (the same strip-prefix as findings), misaligned-edges and stale-evidence handling; §1.B N9–N15: the CY-/BV-/UR- finding categories |
| 03.3 | §1.C N16–N19: `src/domain/relations/{graph,queries}.ts` — the relation index, `neighbourhood`, `stronglyConnected`, `aggregateEdges` |
| 03.4 | §1.E N28–N33: the `CityRendererPort.setRelations` amendment, directed relation arcs in two draw calls, the city Relations section, the per-leaf relations store, and the arc/highlight-cycle caps (24 in the city, 64 in the renderer) |
| 03.5 | §1.D N20–N27: the Architecture screen's Cycles, Edges and Rules ("Configured in fallow") tabs; the File detail Relations panel and Imported by card; Quality's Import structure kinds and review dialog; the Overview and Data & scans imports rows |
| 03.6 | §1.F N35–N38: the fixture and renderer-double edits carrying relation evidence, the dense-graph `relations-budget` benchmark (N33, N37), the real-fallow relations test (N36), and the harness captures (N38) |

Acceptance, item by item, is recorded in
`docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md`'s **WP-03 Part 1** section,
added by task 15. The benchmark medians, the extended `npm run test:fallow` run and the
harness capture list are recorded there too. The limitations this evidenced subset
carries — a partial graph, no type-only distinction, undirected re-export cycles, rules
that can only be violated, and the two tested fallow versions — are in
`docs/superpowers/notes/2026-09-17-wp01-limitations.md` §7.
