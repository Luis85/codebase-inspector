# Implementation-agent prompt

You are implementing the Obsidian desktop plugin `codebase-inspector`. Use this design package alongside the current Obsidian implementation kit. Work on the requested implementation package only; default to WP-01 if no package is specified.

## Inspect before editing

Read the repository instructions, existing package/manifest/build setup, current data model and tests. Read design README, foundations, interactions, component contracts, package map, and all screens assigned to the target package. Identify code already implemented and consolidate with its actual snapshot/profile/observation model; do not create parallel domain models merely because a mockup uses convenient fixture fields.

The synthetic fixture is not the user repository. Do not hard-code 144 files, six districts, example findings, dates, source paths, or a health score. No real plugin capability should depend on the review prototype.

## Architectural boundaries

Obsidian owns workspace/ribbon/settings/themes. Use one native ItemView; no server, iframe, Webviewer wrapper, account UI, or second application sidebar. Mount one Vue/Pinia UI scope per leaf. Keep Three.js objects out of deep reactivity. The renderer takes normalized snapshots and emits presentation intents; it does not read the filesystem or execute providers.

Source selection supports current vault, vault directory, and explicit external directory. Inventory is bounded and read-only. Do not run project configs/scripts, Git, or an analyzer to implement WP-01. No automatic scan when enabling/reopening the plugin. Follow symlink/junction, exclusions, output-cache, and path-security requirements from the implementation kit.

## Deliver the screen flows

Build source selection, review/consent, cancellable inventory, city, list, search, selection, exact-value inspector, camera controls, top view, narrow layout, fallback, retained-snapshot recovery, and native settings. Use actual host semantic theme variables and support light/dark/custom themes. Implement explicit unavailable measurements, not fabricated zero values.

Use the numbered PNGs as visual targets, and the Markdown specs as interaction truth. The prototype uses an SVG city to communicate design; replace that stand-in with the required Three.js implementation, not an embedded HTML demo. Avoid decorative city features until performance and accessibility are proven.

## Acceptance evidence

Unit tests: physical lines, availability semantics, path normalization, deterministic layout, selection/query state. Contract tests: snapshot/UI model, provider interface when relevant. Integration: source → real inventory → renderer/list/inspector. Host tests: close/reopen, two leaves, pop-out, theme change, resize, disabled WebGL, late async result, plugin unload. Use actual Obsidian release artifacts in an isolated vault.

Record benchmarks on documented hardware and runtime. Performance targets are proposals until measured. Report precisely which checks passed, failed, or were not run. Screenshot tests alone do not establish usability or WCAG conformance.

## Finish

Provide changed files, implemented scenarios, test evidence, known limitations, and the next dependency-ready work item. Never mark mock-data-only flows as completed real-codebase functionality. Do not proceed to future packages without the current acceptance gate.
