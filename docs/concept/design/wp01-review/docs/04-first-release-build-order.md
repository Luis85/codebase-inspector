# WP-01 — eight implementation packets

These are sub-packets inside implementation Package 1, not eight new product releases. Do not begin fallow, dependency graphs, findings, coverage, note writing, or CI functionality merely because their mockups are present in the larger package.

## IP-01 — Consolidate contracts and preserve the baseline

**Outcome:** the project has one canonical snapshot, file identity, view state, and renderer boundary.

Read the existing code and implementation kit before creating models. Reconcile `renderer-port.ts` with implemented types. Record disagreements and migration actions. Port the state-preservation tests to Vitest. Define input trust boundaries, file-category mapping, and unknown measurement semantics.

Deliver a contract note, adapter interfaces, frozen synthetic fixtures, and green pure-state tests. Completion is not a scaffold-only demo: these are the contracts used by the next packets. No real collector or renderer is claimed at this point.

## IP-02 — Open a native inspector view

**Use case:** open and reopen the inspector in an Obsidian workspace tab.

Create the manifest/build outputs, register the ItemView, add one ribbon action and necessary commands, mount a Vue root, and own one view-scoped store. Add a visible first-run state. Wire settings through Obsidian instead of shipping a browser host shell.

Acceptance: enabling/reopening creates no scan; two leaves do not share camera/selection; disabling releases the mounted application; the packed plugin loads in a clean test vault. All source input is still synthetic until IP-03.

## IP-03 — Select a source and collect a real read-only inventory

**Use case:** inspect the current vault, a vault subdirectory, or an explicitly bound external directory.

Implement actual path resolution, scope preview, exclusions, non-ASCII/Windows paths, symlink policy, source disappearance, bounded I/O, progress, cancellation, and snapshot validation. Use an immutable publication step. No analyzer, project script, Git, or installation is authorized by inventory.

Acceptance: enumerate a controlled fixture repository accurately; preserve exclusions; reject invalid roots; do not escape approved scope; verify file contents and relevant filesystem metadata remain unchanged apart from explicitly documented read side effects. Keep plugin outputs outside collection scope. Report incomplete reading honestly.

## IP-04 — Render the city with Three.js

**Use case:** recognize files and directories and navigate their spatial representation.

Build a deterministic layout from the canonical snapshot. Implement the renderer port with Three.js, instanced geometry, district labels, bounded camera navigation, file picking, and a selection marker. Keep metadata and layout outside scene objects. Replace the simulator entirely rather than wrapping it as a fallback engine.

Acceptance: known file IDs map to correct buildings after reordering input; physical-line height and equal footprints match the legend; picking works at different zooms; no file is fabricated from a finding list; disposal tests and a documented 5,000-file benchmark run exist.

## IP-05 — Find and inspect a file without losing context

**Use case:** search, select, inspect, copy a relative path, and deliberately focus the city.

Implement the file list, search, details panel/drawer, precise measurements, separate Focus action, fit/top controls, path-copy recovery, keyboard scope, and focus return. Preserve selection when a search does not match. No-result search is not an empty repository.

Acceptance: replay browser checks B02–B10, B18–B19, B21, B23–B26 against the production controls; demonstrate the equivalent HTML path with no 3D input.

## IP-06 — Refresh, cancel, fail, and recover

**Use case:** refresh the same codebase without losing the last valid evidence.

Implement run identities and source/scope generation checks; keep the old snapshot during refresh; reject stale callbacks; distinguish cancelling from stopped work; preserve partial-result warnings; provide renderer-unavailable fallback. Reconcile missing selected files after actual code changes.

Acceptance: cancel an actual in-flight collector; induce a read failure; complete an older run after starting a newer run; close a leaf mid-run. No invalid result publishes. Renderer failure does not restart inventory or erase data.

## IP-07 — Validate the actual Obsidian host

**Use case:** work in split panes, constrained leaves, custom themes, and pop-out windows.

Bind lifecycle/event ownership to the leaf's document. Test initial/repeated mounting, migration, window close, reduced motion, text zoom, focus visibility, assistive navigation, and multi-leaf state independence. Add error boundaries and explicit resource cleanup.

Acceptance: a host test matrix is completed with versions, operating system, observations, unresolved issues, and reproducible steps. Headless-browser success cannot substitute for these checks.

## IP-08 — Package and release the first structural slice

**Use case:** install the built plugin and inspect a real source without development tooling.

Build the actual distribution and test the packed artifacts in a clean vault. Remove review controls, artificial scan outcomes, browser shell, debug globals, and fixture-only assumptions. Document external-file access and current desktop-only scope. Keep unsupported future navigation absent.

Acceptance demonstration: select a real external repository, scan it, find a known file, confirm measurements, exercise keyboard and HTML paths, cancel a refresh, reopen the view, and confirm the source remains unchanged. Repeat with a vault-based source. Release only after required host/safety gates pass.

## Parallel work and ownership

First complete IP-01 and the minimal host composition from IP-02. Then use three bounded work streams: collector/profile adapter (IP-03), layout/Three.js renderer (IP-04), and components/state interactions (IP-05). Only the integration owner changes shared contracts; other agents propose interface changes rather than independently inventing them.

After integration, run IP-06 → IP-07 → IP-08. A renderer agent must not edit filesystem code. A collector agent must not add UI state to snapshots. A component agent must not directly import Node filesystem/process APIs. Each work stream supplies tests and an explicit completion report, including what was not validated.

## Definition of done

A packet is done when its use case works through the intended interface, its acceptance evidence is recorded, its output fits the shared contracts, and no new data-authority or lifecycle ambiguity is introduced. “Screens look similar” and “the example fixture renders” are not adequate completion criteria for the plugin.
