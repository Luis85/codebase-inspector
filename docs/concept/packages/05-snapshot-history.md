---
id: WP-05
title: Snapshot history and change evidence
status: planned
depends_on: [WP-02]
---
# Package 05 — Snapshot history and change evidence

## Outcome

“I can compare compatible codebase states, see introduced or resolved findings, and retain the evidence for an investigation.”

## Work

Implement a versioned durable snapshot store with retention, baseline selection, entity correspondence, comparable provider/run matching, metric deltas, and a city comparison view. Optional Git-backed information is an explicit provider, not something every view startup runs.

Retain normalized structural snapshots rather than assuming a health-score history can reconstruct a city. Reuse an analyzer's suitable metrics instead of duplicating its calculations unnecessarily.

## Deliverables

| Task | Deliverable |
|---|---|
| 05.1 | Snapshot persistence, atomic write/recovery, retention and purge |
| 05.2 | Compatibility assessment for scope, rules, definitions, and source state |
| 05.3 | Added/removed/changed entities and explicit rename correspondence |
| 05.4 | Introduced/resolved/persistent findings with provenance |
| 05.5 | Shared comparison layout and stable visual anchors |
| 05.6 | Baseline selector, date/revision labels, evidence-note references |

## Rules

No finding becomes resolved merely because an analyzer failed, its rules changed, its scope shrank, or a file was excluded. Show “not comparable” rather than a false improvement. Coverage/complexity/bundle definitions must remain comparable across tool upgrades.

Distinguish source deletion, rename, unavailable root, and narrower inventory. A missing file does not necessarily prove an intentional deletion. Record dirty working-tree state as unknown unless measured; do not claim an atomic committed snapshot from a live disk scan.

Use a union/aligned layout for comparison so files do not arbitrarily jump between two frames. Snapshots do not carry saved absolute executable/root paths. A note can reference a retained snapshot ID; if retention removes it, show unavailable evidence and offer import/re-analysis without silently substituting current data.

## Acceptance

Fixtures cover rename, deletion, exclusion, failed provider, changed rules, partial scan, definition upgrade, and duplicate basenames. An interrupted snapshot write recovers cleanly. Retention reports pinned/in-use evidence and does not delete user notes. A baseline comparison explains every visual delta.
