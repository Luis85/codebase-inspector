---
type: codebase-investigation
status: open
codebase_id: demo-inspector
snapshot_id: demo-2026-09-17
finding_ids:
  - F-001
source_paths:
  - src/visualization/layout/city-layout.ts
provider: fallow
evidence_kind: imported-report
---
# Investigate layout complexity

## Question

Can district partitioning be simplified while preserving deterministic placement?

## Evidence

The imported report identifies cognitive complexity of 27 at a configured threshold of 15 for `partitionDistrict`, at the snapshot-relative location `src/visualization/layout/city-layout.ts:84`.

This is synthetic example content. A real note records the actual provider version, configuration/scope, source match, observation time, and normalized finding identity.

## What remains unknown

Whether decomposition improves the design, whether current tests cover behavior, and whether a specific refactor is safe.

## Proposed investigation

- [ ] Read the complete function and its consumers.
- [ ] Describe its behavior with focused tests.
- [ ] Compare deterministic placement before and after a proposed change.
- [ ] Re-run relevant checks through the approved workflow.

## Decision and verification

Record the decision, tradeoffs, verified outcome, and follow-up work here. Analyzer refresh must not overwrite this human-authored section.

## Inspector reference

```codebase-inspector
profile: demo-inspector
snapshot: demo-2026-09-17
file: src/visualization/layout/city-layout.ts
finding: F-001
```

The fenced syntax above is a **proposed WP-11 format**, not an already implemented command. It carries portable references only: no absolute executable paths, process arguments, or automatic scan authorization. Until WP-11, keep these as plain readable properties/references.
