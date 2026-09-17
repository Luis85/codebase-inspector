# Quality gates

## G1 — Host distribution

The release files load in a separate test vault with no dev server, network, source checkout, or runtime package install. The ID/name are correct; the plugin is desktop-only initially; the documented minimum host version is actually tested. Verify dependency licenses and the current community submission policies [S1, S3, S5].

## G2 — Source safety and scope

The built-in inventory cannot traverse outside an approved root. Test spaces, Unicode, Windows drive paths, prefix collisions, parent traversal, symlinks/junctions, permission errors, binary/invalid text, nested ignores, huge files, and cancellation. Exclude the actual vault config directory rather than only a hard-coded `.obsidian` path.

A WP-01 source scan creates/modifies/deletes no target project file. Plugin installation/settings and explicit future note exports are separate authorized host writes, not part of a source scan. Validate source bytes/hashes before and after scanning with the plugin already installed; do not compare unavoidable Obsidian workspace updates as if they were source-code modifications.

A secret-exclusion test verifies content was never read, not merely removed from the UI afterward. Report pruned directories honestly. Snapshot refresh excludes report/cache output to avoid self-analysis loops.

## G3 — Evidence truth

Physical lines have an exact definition and tests. No provider means not analyzed. No reported finding is not necessarily evidence of a measured zero. Imported artifacts retain provenance, analyzed scope, thresholds, source matching, and truncation state. Unknown source matches remain unverified.

Keep run completion separate from findings and policy verdict. Never infer “safe to delete,” “test will pass,” or “not exploitable” from an unsupported heuristic.

## G4 — Lifecycle and accessibility

Test multiple leaves, independent selection, command reveal behavior, view close/reopen, plugin disable/re-enable, workspace restoration, hidden/resized leaves, theme switching, and pop-out migration [S2, S6]. No orphan canvas, observer, timer, watcher, event handler, or active render loop remains after shutdown. Job completion after a closed/rebound view is ignored.

The file list and inspector work with keyboard only and without WebGL. Respect reduced motion; preserve focus after refresh; do not capture host shortcuts while the city lacks focus. Tooltip and overlay DOM belongs to the correct window.

## G5 — Performance

Measure scan, normalization, layout, first paint, interaction, and cleanup separately. Use 1,000-file functional fixtures and a 5,000-file benchmark fixture. Initial targets, not claims: first city visible within three seconds of normalized snapshot availability and interaction p95 frame time near or below 33 ms on stated reference hardware. No sustained animation while idle/hidden. Avoid main-thread blocking scans or large unbounded JSON parse/read operations.

Record CPU, GPU, OS, Obsidian/runtime version, viewport, scale, fixture, settings, and measurement method. CI software rendering does not establish desktop GPU performance. Use aggregation/drill-down for unsupported scale rather than silent disappearance of files.

## G6 — Analyzer process boundary (WP-02+)

Test exact executable/cwd display, explicit trust before any probe, missing native binary, unsupported version, finding exit status, real failure, malformed/truncated output, timeout, cancellation, shutdown, Windows launchers, and process-tree cleanup where supported. Do not claim an OS sandbox. Disallow auto-install/download/fix paths. Verify analyzer cache/report/log side effects against the tested version [S5, S9–S10].

## G7 — Note and artifact writes (WP-04+)

Note creation requires a selected folder and explicit action. Escape paths/messages in Markdown/YAML; treat report text as untrusted. Avoid overwriting an existing note; use deterministic identity plus safe collision handling. Preserve human-edited sections during updates. No absolute root/executable path or source body is exported by default. A deep link or code block can select a known profile, not grant execution.

## G8 — Testing coverage

Unit tests cover contracts, root resolution, metrics, layout, and snapshot comparisons. Integration tests cover inventory and adapter fixtures. A browser fixture harness tests Vue/Three.js behavior. Dedicated real-host tests, manual or automated as available, verify Obsidian integration. Release notes clearly state which layers actually ran.
