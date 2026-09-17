---
id: WP-01
title: Native Obsidian Three.js codebase city
status: planned
depends_on: []
---
# Package 01 — Native Obsidian Three.js codebase city

## User outcome

**I enable Codebase Inspector, choose a codebase inside or outside my vault, and explore its real files as an interactive Three.js city in an Obsidian tab without running or modifying the source project.**

This is a complete vertical slice: plugin distribution → source selection → safe scan → normalized snapshot → city → inspection. A fixture-only city or an empty plugin scaffold does not satisfy it.

## First-run flow

1. Enable the plugin. Register capabilities; do not scan automatically.
2. Choose the ribbon entry or “Codebase Inspector: Open codebase city.”
3. With no profile selected, show source options: current vault, vault directory, external directory.
4. Validate the root, show the resolved location and default exclusions, and ask for confirmation of read access. Accept a pasted absolute path as the baseline external selector; do not make undocumented Electron dialogs a prerequisite.
5. Press “Scan codebase.” Display cancellable progress and partial/error state as appropriate.
6. Show the city and synchronized file list/inspector. Save small profile metadata and view preferences, not a giant snapshot in ordinary plugin settings.
7. Refresh on explicit action. Reopening may show retained in-memory/cached state marked with its age, but does not silently authorize a new scan.

## UI and native integration

Use one normal workspace tab, not a ribbon-triggered browser window, localhost site, iframe, or Webviewer. Proposed view type: `codebase-inspector-city`.

The view contains a compact profile/source selector and search; a central city; a collapsible file list and inspector; and controls for fit, top-down, refresh, and cancel. Collapse side panels into drawers in narrow leaves. All labels are English. Do not add a second Obsidian sidebar, account avatar, invented fallow branding, or tabs for future capabilities.

Suggested command IDs: `open-city`, `scan-codebase`, `cancel-scan`. Obsidian adds the plugin ID prefix [S3]. A settings tab handles profiles, exclusions, inventory limits, and local-storage disclosure. Scan commands target the active inspector leaf; if none is active, show/select a profile instead of guessing another leaf's root.

Settings and source modals should use native host controls; the main view may use Vue. Theme colors come from Obsidian variables. Let the host theme remain authoritative rather than a separate dark/light setting. Use root-scoped CSS; do not reset global styles.

## Visual contract

| Encoding | Meaning |
|---|---|
| City | Selected codebase root |
| District | Directory hierarchy |
| Building | Included file |
| Height | Physical text lines, with documented display scaling |
| Footprint | Equal file lot |
| Color | File category |
| Selection | Separate outline/marker, not a replacement metric |
| Inspector | Relative path, category, measured lines/bytes, scan scope/warnings |

Define physical lines precisely: empty text = 0; CRLF is one line separator; a final newline does not create a phantom extra line; comments and blank lines count. Binary, invalid encoding, skipped, or oversized content has an unavailable line count, not zero. Included file byte size remains a distinct observation. Show a legend if heights are logarithmic or clamped, and keep raw values accessible.

No fallow, fake quality heat, dependency arcs, architecture labels, health score, deletion confidence, or history slider in this increment.

## Implementation tasks

| Task | Deliverable | Acceptance |
|---|---|---|
| 01.1 Host scaffold | Manifest, production build, plugin entry, settings, commands, registered ItemView | Release files load in an isolated vault |
| 01.2 Profile and snapshot | Root/source references, local bindings, minimal validated model, fixture | Valid data round-trips; invalid references rejected |
| 01.3 Inventory collector | Authorized root, scoped read-only walk, text metrics, cancellation | Cross-platform and no-source-write fixtures pass |
| 01.4 Pure layout | Deterministic directory allocation and equal lots | No overlaps; stable output for identical input/settings |
| 01.5 Three.js city | Instanced buildings, camera controls, picking, focus, resize, dispose | Correct file selected; responsive camera |
| 01.6 Vue view | Search/list, toolbar, inspector, keyboard fallback, theme bridge | Canvas and HTML selection stay synchronized |
| 01.7 Host lifecycle | Independent leaves, workspace state, hidden/visible behavior, pop-out rebind | No leaked work or wrong-window DOM |
| 01.8 Real integration | Source selector → scan → city with progress, warnings, cancel | Real vault and external project work |
| 01.9 Release gate | Clean-vault install, benchmark, safety and lifecycle results | Recorded actual outcomes and limitations |

After 01.2, inventory, layout/renderer, and UI can partly proceed in parallel. Keep host integration active from the beginning rather than wrapping a completed standalone web app at the end.

## Inventory specifics

Use a bounded async filesystem walk behind a port. Obtain the vault filesystem root only through a supported adapter and type check. Do not rely on Obsidian's Markdown index to discover source code [S4]. Treat all sources as filesystem trees after explicit root resolution, while reserving Vault APIs for note actions.

Skip source links/junctions in this release. Exclude dependency folders, `.git`, build outputs, secrets, active vault config, cache/output folders, and user exclusions. Validate absolute and root-relative paths with native platform semantics. Handle nested ignores, unreadable files, Windows paths, duplicate basenames, mixed encodings, empty folders, concurrent disk edits, and cancellation. Source metadata is portable; absolute bindings remain local.

Do not run Git, package scripts, fallow, TypeScript configs, build tools, or repository-local executable code to obtain the basic inventory. Filename/category classification is not semantic language analysis. Mark partial scans honestly; a cancelled run must not silently replace the last complete snapshot.

## Layout and rendering specifics

Pure layout consumes a validated snapshot, not the filesystem. Sort deterministically and allocate directory rectangles from file-lot counts with consistent padding. Identical inputs produce identical geometry; this is not a promise that adding a file never moves neighbors. More stable comparative layout belongs to WP-05.

Use `InstancedMesh` for repeated buildings and a `(batchId, instanceId) -> entityId` map [S7]. Geometry/materials are shared intentionally and disposed by their owner. Keep Three.js objects outside deep Vue/Pinia reactivity. Use tested controls rather than implementing a new camera system.

Distinguish drag from selection click; hover displays a short tooltip; select synchronizes inspector/list; focus frames a file; Escape clears selection when the view owns focus. Offer fit-to-view and top-down. Limit labels to a bounded visible set and the selection. Respect reduced motion and cap pixel ratio.

Render only when needed. Hidden leaves pause; context loss shows recovery/fallback. Closing a view releases resources, and moving it to a pop-out window rebinds document/window-specific resources [S6]. Do not steal keyboard shortcuts from an active Markdown editor.

## Lifecycle specifics

Mount each Vue app into its own view container and create per-view state. Plugin-scoped services own safe shared snapshots and scan coordination, not DOM or GPU resources. Use Obsidian lifecycle registration helpers for host events where applicable [S1]. On view close/unload, cancel frames, remove listeners, disconnect observers, release controls and GPU resources, unsubscribe, and ignore stale async completions.

If a selected profile changes during a scan, the old job result cannot overwrite the new profile. Multiple open leaves may share a completed snapshot, but must keep independent camera and selection state. Restore identifiers and presentation state, never process execution authorization.

## Acceptance scenarios

```gherkin
Feature: Inspect a real codebase in Obsidian

  Scenario: External codebase without project changes
    Given the production plugin is installed in a test vault
    And an external source directory contains nested code files
    When I explicitly select that directory and start a scan
    Then an Obsidian workspace view displays its included files as a city
    And selecting a building shows the correct relative path and measurements
    And the scan creates, changes, or deletes no source-project files
    And no source-project script or dependency installation runs

  Scenario: Vault is the codebase
    Given my vault contains code and Markdown files
    When I scan the current vault
    Then included code files are discovered independently of Markdown indexing
    And the actual vault configuration and generated output folders are excluded

  Scenario: No WebGL
    Given WebGL initialization fails
    When the inspector view opens
    Then the searchable HTML file list and inspector remain usable
    And an explanation describes the unavailable 3D view

  Scenario: Independent views and cleanup
    Given two city views are open
    When I select a file in the first view
    Then the second view keeps its own selection
    When I close the first view
    Then its renderer and subscriptions are released
    And the second view remains usable

  Scenario: Late result after profile change
    Given a scan for profile A is running
    When I switch the view to profile B
    And the old scan completes later
    Then profile B is not replaced by profile A's result

  Scenario: Theme and window migration
    Given a city view is open
    When I change the Obsidian theme and move the view to a pop-out window
    Then controls remain readable and interactions operate in the correct window
```

Also verify empty roots, invalid roots, permissions, malicious filenames, long labels, narrow leaves, cancel, refresh, restart, plugin re-enable, source-path disclosure, and generated-output self-scanning.

## Performance and release evidence

Use 1,000-file functional fixtures and a 5,000-file performance fixture. Proposed target: first usable city within three seconds after snapshot delivery, interaction p95 near/below 33 ms on documented hardware, and no sustained idle rendering. Measure scan cost separately and record the actual Obsidian/runtime version. These are acceptance targets, not measured results.

Install the release outputs in an isolated vault without a development server, and inspect one vault-based and one external real project. Provide screenshots and results from actual execution. A browser-only test is not proof that the plugin installs or cleans up correctly.

## Definition of done

An actual Obsidian plugin build satisfies the real-root workflow, file measurements are correct, the target remains unchanged by scanning, accessibility and lifecycle checks pass, the benchmark and limitations are recorded, and all visible commands/settings are implemented. Stop before adding fallow.
