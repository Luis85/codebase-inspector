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
