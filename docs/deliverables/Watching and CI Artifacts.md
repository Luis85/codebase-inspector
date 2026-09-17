---
type: Deliverable
order: 100
id: WP-10
title: Watch mode and CI artifact exchange
status: planned
dependsOn:
  - WP-02
  - WP-05
parent: "[[Plugin MVP]]"
---
# Package 10 — Watch mode and CI artifact exchange

## Outcome

“I can explicitly watch a source root, keep evidence current, and exchange snapshots with CI without making Obsidian a build runner.”

## Watch tasks

Add explicit start/stop actions, source watcher adapter, debouncing, coalescing, cancellation, bounded job queues, generation tokens, and visible watch status. A profile should not acquire duplicate watchers because several leaves are open. Use source-appropriate filesystem observation for external/non-indexed files; Vault events alone are not a complete code watcher.

Exclude plugin config, caches, generated notes, reports, dependency/build folders, and other output paths. Handle rename storms, missed events, root disconnect, and invalid bindings. Offer manual/full rescan reconciliation. Watch sessions stop on plugin unload and do not silently resume analyzer execution on restart.

## CI artifact tasks

Import user-selected analysis/snapshot artifacts, validate versions and provenance, choose source mappings, compare with baselines, and export portable normalized snapshots and sanitized Markdown/JSON summaries. The CI system runs analyzers in its own workflow; no Obsidian installation is required in CI.

A future headless companion can reuse the core but is not a mandatory part of this package. Do not recreate the earlier CLI/server architecture merely to ingest a report. Direct GitHub/Azure artifact fetching is a separate optional authenticated integration, not required for basic file import.

## Sharing rules

Default exports omit absolute roots, executable paths, source bodies, usernames, secret-bearing logs, and raw payloads. Let the user inspect an export manifest. A portable report is untrusted input and cannot start a process or access an arbitrary original-machine path.

## Acceptance

Bursty changes produce bounded work; cancelled/old results never replace new evidence; no self-triggered scan loop occurs. Plugin shutdown releases watchers and terminates owned jobs where supported. Imports work without the original machine path and explain unverified source matches. A required provider failure is not a passing policy gate.
