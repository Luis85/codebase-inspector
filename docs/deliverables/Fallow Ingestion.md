---
type: Deliverable
order: 7.5
id: WP-02
title: Fallow ingestion and quality lenses
status: planned
dependsOn:
  - WP-01
parent: "[[Plugin MVP]]"
---
# Package 02 — Fallow ingestion and quality lenses

## Outcome

“I can attach existing fallow evidence or explicitly run a trusted installed analyzer and inspect its findings on the same city.”

## Scope

Add a fallow adapter, provider diagnostics/settings, report import, bounded process orchestration, normalized findings, and selectable quality lenses. Start with unused code, duplication, and supported complexity evidence. Add styling only where the tested output contract supports it.

Import-only mode requires no local executable. A full imported Codebase Inspector snapshot can display its included structure; a findings-only report needs a matching inventory/profile and cannot invent all the unreported files.

## Work

| Task | Deliverable |
|---|---|
| 02.1 | Capability/version and raw-output fixtures for supported fallow versions |
| 02.2 | Runtime validators and normalizers, with preserved scope/provenance |
| 02.3 | Import dialog, profile matching, unresolved-path review |
| 02.4 | Explicit native-executable binding and trust/diagnostic UI |
| 02.5 | Async runner, bounded output, timeout, cancel, safe shutdown |
| 02.6 | Lenses, finding counts, locations, missing/stale/failed evidence states |
| 02.7 | Real report integration plus analyzer side-effect tests |

## Obsidian-specific rules

No automatic package installation, `npx` fetching, runtime model download, or dependency update. Obsidian directory policies prohibit plugins from installing/updating dependencies [S5]. Provide manual installation instructions outside the plugin and support an already-installed native binary; do not require the binary to be bundled with the plugin.

Executing a version probe is still execution: obtain authorization first. Show executable and source root. On Windows, initially accept the native executable rather than treating an npm `.cmd` shim as a safe shell-free binary [S10]. Do not call synchronous process APIs on the host UI thread.

Use verified JSON output contracts and command capabilities. Preserve native exit semantics: a completed analysis with findings is not an operational failure [S8]. Keep stderr diagnostics separate from the stdout JSON document. Detect truncated output and reject partial parsing as a complete result.

Check source writes, including caches, logs, and implicit snapshots. Use supported no-cache/output controls and a no-write fixture [S9]. Disable writing analyzer actions; if a supported command still writes and cannot be redirected safely, explain that and offer import-only mode. Running an authorized native binary is not an OS-sandboxed operation.

## Evidence semantics

A missing record in a thresholded report does not imply zero complexity. A missing report is not a clean run. Keep provider version, adapter version, timestamp, scope, rules/config, source match, and warnings. Path reconciliation must use the selected root and an explicit mapping, never arbitrary absolute reads from report fields.

Display “Not analyzed,” “Unverified source match,” “Stale,” “Failed,” and “No findings in analyzed scope” distinctly. Show findings with native rule and severity, not invented deletion-confidence percentages.

## Acceptance

A known raw fixture highlights the correct file and location. Importing a report does not run code. A configured trusted binary runs without freezing Obsidian. Operational failure does not clear older findings as if resolved. A cancelled or superseded run cannot overwrite a newer snapshot. Missing fallow leaves the structural city fully usable.

## Non-goals

Auto-fix, source deletion, package-manager installation, exact dependency graph generation from finding lists, and general-purpose terminal execution.
