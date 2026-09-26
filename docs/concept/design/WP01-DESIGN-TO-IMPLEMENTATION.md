# Codebase Inspector — WP-01 design-to-implementation handoff

Version 1.1 · 17 September 2026. This document extends the existing UI/UX design package; the production target remains an Obsidian desktop plugin with Three.js.

The included browser reference is an offline Canvas 2D projection simulator using synthetic data, not a plugin or a Three.js runtime. It has 31 passing state tests and 28 passing browser checks; actual host, graphics, source-safety, accessibility, and performance validation remains required.

The full archive includes editable sources, twelve captured states, typed contracts, executable tests, and the original twenty-eight-screen design package.

---

# WP-01 interaction baseline — version 1.1

Status: proposed implementation baseline. Product: **Codebase Inspector**. Host: Obsidian desktop. Language: English. Release boundary: the first structural city only.

This document resolves ambiguous interaction choices in the earlier design package. It does not authorize new product features. The production renderer remains Three.js. The accompanying browser reference uses a dependency-free Canvas 2D projection simulator because a Three.js dependency download was unavailable in the authoring environment. Its renderer must not be copied into the plugin.

## Authority and relationship to the existing package

Keep the original 28 screen specifications, component library, and twelve-package roadmap. Apply this version to WP-01 screens S01–S13 and S23. Safety and evidence constraints from the implementation kit remain binding. Where a previous interaction was described as optional, this baseline chooses a default. Original screen images remain visual references, not proofs of working behavior. The older all-package SVG prototype is retained for browsing later-release concepts; use this WP-01 reference for first-release behavior.

The new prototype is not a production plugin, not an inventory scanner, and not a fallow integration. Its review toolbar, theme selector, simulated failure controls, synthetic scan consent, and sibling-note fixture are review equipment, not plugin features.

## Selection is not camera focus

A primary click on a file lot or a file-list button selects that file and opens its inspector. It updates the selected marker and the corresponding list row. It does not move the camera, change the search, or rebuild the layout. Keyboard activation of a file button has the same effect. Merely moving keyboard focus to another list button does not select it.

**Focus in city** is the explicit camera action. It frames the selected file with surrounding context, retaining other lots. Canvas Enter invokes the same action. Closing the inspector hides the panel but preserves selection; the persistent Details button restores it. Clear selection is explicit. A click on empty space is a no-op in WP-01. Double-click-to-focus is deferred until the click/drag/double-click sequence is implemented and tested; it is not required for the first release.

The reference proves that selection does not mutate camera state. It does not prove that a production panel resize leaves pixel framing unchanged. The Three.js integration must preserve the camera bookmark and may resize the projection viewport; it must never call Fit as a side effect of selecting a file.

## Search is a presentation filter

The search field searches **included file paths**, case-insensitively. Empty or whitespace-only queries match all included files. WP-01 does not search source text, symbols, or every quality finding. Use “Search files or paths…” rather than “Search everything.”

Typing filters the list and dims nonmatching buildings in place. It does not hide or relocate lots. A selected file remains selected even when it does not match; the inspector and outlined marker remain available, and a banner states “Selected file is outside the current search.” Clear search is an explicit recovery action. No-result search does not erase the snapshot.

Enter in the search field selects the first matching file in deterministic display order without moving the camera. Enter with no matches is a no-op. Escape in this field clears only a nonempty query and keeps focus in the field. Do not globally clear the query on Escape elsewhere. Production search may debounce expensive filtering by about 150 ms; input text remains immediate. The small reference fixture filters synchronously.

## Camera defaults

The first production view uses an orthographic, oblique perspective of the city. Top view also uses orthographic projection. Retain the existing square-root display scale for physical line count and show exact counts in the inspector. The first lot layout is deterministic and has equal file footprints; do not encode the same size metric into both footprint and height.

| Interaction | Chosen behavior |
|---|---|
| Primary drag | Orbit in 3D; pan in top view |
| Shift-primary or right drag | Pan |
| Wheel over focused canvas | Zoom; do not capture wheel input from lists, forms, or other leaves |
| Primary click with movement ≤5 CSS pixels | Select a visible file |
| Movement >5 CSS pixels | Treat as drag; release never selects |
| Fit city | Frame the entire current inventory, retaining selection/query |
| Focus in city | Frame the selected lot with context |
| Top → 3D | Restore the saved 3D camera, including target and zoom |
| Resize | Resize the projection without resetting semantic view state |
| Hidden leaf | Suspend drawing/input; do not scan |

The 5-pixel threshold and step increments are proposed usability defaults, not research results. Avoid inertial drift in the first implementation. Motion can be instant; reduced-motion mode must not require animation to understand a selection change. Every drag action has single-pointer and keyboard alternatives in Camera help.

## Keyboard ownership and Escape

Do not install default host-wide shortcuts. Register Obsidian commands so users can bind their own keys. The local slash shortcut focuses search only when focus belongs to this view and is not in an editable control. F, T, +/−, arrows, Shift-arrows, and Enter work only when the city canvas itself has focus. Ignore composing input, handled events, and Ctrl/Meta/Alt combinations unless explicitly registered by the host.

Escape processes one context only: a modal closes itself; search clears its own query; a narrow nonmodal inspector closes only while focus is inside it; the canvas clears its own selection. A wide inspector does not close simply because Escape was pressed in an unrelated control. Keyboard input in a sibling note must never be consumed by the plugin.

Use normal HTML button/list semantics for the initial file list. A virtualized tree is a separate component implementation requiring a complete keyboard and accessible-name contract, not a role attribute added to an incomplete control.

## Panel and layout behavior

Measure the **leaf content width**, not the application window. At ample width, display file list, city, and inspector. At constrained width, retain city/list switching and present details as a nonmodal drawer. The reference collapses at 820 CSS pixels; this is a new provisional threshold replacing coarse window-based review styles, not a claim about optimal device breakpoints.

A drawer has a visible close button and an explicit return path. Closing returns focus to Details. Switching to the HTML inventory preserves query, selection, and camera bookmark. At very narrow widths, actions wrap rather than clipping. Additional production tests must include text zoom, host fonts, custom themes, and narrow leaves inside a wide host window.

## Source and scan behavior

Opening the plugin or a saved view is not authorization to scan. Selecting a source mode is not execution. Production scope approval must identify the actual root, exclusions, operation, and side effects. A changed root or scope invalidates old approval. Use read-only inventory; no Git, fallow, scripts, package installation, or source writes in WP-01.

During a refresh of the same profile and scope, keep the previous valid snapshot visible. Show a separate running state. Cancel stops publication immediately, requests cancellation of actual work, and retains the previous snapshot. Late completion cannot publish. Failure leaves the previous snapshot intact and labels the failed refresh. A success publishes only after validation.

The reference exercises the same-data refresh branch only. Initial scanning with no snapshot, switching to a different profile, unreadable paths, partial inventories, and source disappearance are implementation-stage cases described in the original package and the acceptance scenarios below.

## Evidence language

Large means many physical lines, not poor quality. Missing measurements are unavailable, not zero. The structural city is not a health score. No dependency arcs, security labels, test coverage, finding severity, or safe-to-delete probability appear in WP-01. The published synthetic fixture contains 144 files; it is not an analysis of a user repository.


---

# State ownership and command contract

## Separate domain data from transient presentation

The plugin has shared immutable snapshots and per-leaf interaction state. A leaf must not own a second copy of the scanner's mutable working inventory. A renderer must not own the authoritative selected file. The application layer interprets actions; visual components emit intent.

| Owner | Data | Persistence |
|---|---|---|
| Plugin/application services | Profiles, supported providers, immutable snapshots, approved run coordinator | Explicit local persistence |
| Machine-local binding store | Resolved external roots and trusted executable bindings | Machine-local; never assume portable across synced machines |
| View state | Profile ID, snapshot ID, selection ID, query, panel presentation, camera bookmark | Small host workspace state; no source text or process object |
| Per-leaf Pinia instance | Reactive representation of that leaf's state | Do not use a global singleton selection store |
| Renderer instance | Scene objects, resources, pick-index mapping, render scheduling | None; reconstruct from snapshot/layout/view state |
| Active run | ID, generation, approval fingerprint, progress, cancellation signal | Session only; a saved run is not resumed implicitly |

Obsidian custom views can be created multiple times; use the registered view factory and retrieve leaves through the workspace rather than maintaining one permanent view reference [O1]. Pop-out windows have their own document and window contexts [O2].

## Proposed events and effects

The executable reference model is in `src/interaction-state.js`. The typed production seam is `integration/renderer-port.ts`. Reconcile both with existing implemented domain contracts before adoption.

| Intent / result | State change | Permitted side effects | Forbidden side effects |
|---|---|---|---|
| FILE_SELECTED | Selected ID + inspector visible | Recolor/marker and row update | Fit camera, run analyzer, open editor |
| QUERY_CHANGED | Query + derived match set | Update list and dim instances | Recompute layout, clear selection |
| INSPECTOR_CLOSED | Inspector visibility only | Restore focus when appropriate | Clear selected file or query |
| FOCUS_REQUESTED | Camera bookmark | Frame selected geometry | Hide unmatched files or change scope |
| TOP_TOGGLED | View mode + saved 3D bookmark | Change projection pose | Lose previous 3D pose |
| SCAN_REQUESTED | No change until approval validation | Present scope review | Start filesystem access implicitly |
| SCAN_STARTED | Run ID/generation/running state | Start approved collector | Mutate current published snapshot |
| SCAN_PROGRESS | Progress for matching active run only | Bounded progress announcement | Publish partial working state as complete |
| SCAN_CANCEL_REQUESTED | Run is nonpublishable | Abort actual work; show stopping if needed | Claim process stopped before confirmation |
| SCAN_COMPLETED | Validated snapshot replaces compatible prior snapshot | Reconcile selected IDs and rebuild geometry once | Publish stale generation or mismatched scope |
| SCAN_FAILED | Failed-run state | Error with old snapshot retained | Replace quality data with zeros |
| RENDERER_UNAVAILABLE | View mode fallback | Show HTML inventory | Discard snapshot or restart scan |
| VIEW_DISPOSED | No future view mutations | Detach listeners, release owned resources | Leave scheduled work retaining DOM |

The reference shortens cancellation to an immediate `cancelled` model state because its only asynchronous work is timer-driven fixture publication. Production must distinguish `cancelling` from `cancelled` whenever the collector/worker needs time to stop. In both cases, publication becomes forbidden immediately.

## Async publication guard

Each scan is associated with `{profileId, sourceFingerprint, scopeFingerprint, runId, generation}`. A result may publish only if all identities still match, cancellation has not invalidated it, and validation succeeds. The previous snapshot is immutable until the atomic swap. A late progress/result from an older run is ignored and may be logged as such; it never overwrites a newer result.

The UI's single-profile reference tests the run-ID/generation behavior only. It does not test real root authorization, fingerprint generation, filesystem cancellation, or multi-view orchestration. Those remain explicit host/integration gates.

When two leaves show the same profile, their selection, camera, and query remain independent. Shared snapshot availability can update both views, but each independently reconciles whether its selected file still exists. If not, show a non-destructive “File is no longer in this snapshot” state rather than selecting another file by index.

## Search + selection + geometry invariants

File identity is not a render-array index. Every render batch has an explicit instance-to-file mapping. A match set of `null` means unfiltered; an empty set means no matches. Neither changes the lot layout. Unknown measurements stay typed as unknown; no sentinel numeric zero.

Store the previous 3D camera as a full value object. Top-view operations must not mutate it. The renderer event `camera-changed` is separate from a command to move the camera, so host synchronization does not produce loops. Compare semantic values or attach origins to avoid reapplying the same change.

## Focus ownership

Keep DOM focus outside domain state. View-specific focus coordinators remember an initiating element or stable control identity for modal return. If a trigger has disappeared, focus a documented safe control in that same view. Do not return focus to `document.body` or to another leaf. All source paths and labels are plain text, not HTML.

## Unit-test scope

The reference has deterministic state tests for preservation, top-mode restoration, cancellation, stale completions, path lookup, and Escape intent. They do not validate the production application's reducers automatically. Port the tests to the chosen implementation, keeping the invariants intact rather than merely copying function names.

Sources: `07-sources-and-limits.md`.


---

# Three.js and Obsidian implementation bridge

## This reference deliberately stops at the host boundary

The browser interaction reference has no Obsidian runtime, filesystem adapter, Pinia instance, or fallow process. Its offline renderer is a small Canvas 2D orthographic simulator. It validates review interactions without external dependencies. It is **not** the production architecture and must not be shipped instead of Three.js.

A direct Three.js dependency download was unavailable in the authoring environment. The adapter contract is therefore supplied without claiming a working Three.js integration. The official r184 package metadata identifies version 0.184.0 [T4]; that version was inspected as a possible pin, not installed, benchmarked, or certified as the newest release. Confirm a compatible project pin during implementation.

## Component ownership

| Existing component | Production responsibility | Must not own |
|---|---|---|
| C01 InspectorWorkspace | Layout, view-scoped services, capability availability | Global shell/navigation or source execution |
| C02 ProfileSelector | Present/select a saved profile | Automatic scanning on selection |
| C03 SourceSelector + C04 ScopeReview | Choose root and present actual resolved scope | Silent permission carryover after scope edits |
| C05 ScanProgress | Run state, cancellation, previous-snapshot explanation | Invented percentages during unknown-length discovery |
| C06 FileSearch | Immediate text input, path search intent | Source-text indexing in WP-01 |
| C07 CodebaseFileList | Equivalent navigation and measurements | A second source of selected-file truth |
| C08 CityViewport | Own one renderer bridge for one view | Filesystem, raw fallow JSON, host-wide hotkeys |
| C09 CameraControls | Explicit framing and navigation intents | Scanning or selection mutation |
| C10 FileInspector | Exact metrics, path copy, selected-ID display | Code deletion or automatic external editor execution |
| C11 MetricLegend | Visible mapping and unknown-state explanation | Health labels inferred from building size |
| C18 ResponsivePanelHost | Leaf-width-driven panels and return focus | Device-width assumptions |

Vue components communicate through typed intent events and application services. Keep Three.js classes and WebGL resources outside deep Vue reactivity. Use a per-view Pinia store for camera/selection/query; shared snapshot services expose immutable domain values. The registered ItemView creates and disposes the Vue root and renderer bridge for its own leaf.

## Suggested Three.js implementation

Use one or a small number of `InstancedMesh` batches for repeated file lots with shared geometry/materials. Three.js supplies per-instance transforms/colors; explicitly refresh the relevant bounds and instance buffers when necessary [T1]. Keep file identity mapping independent of array order. Use a separate marker/outline layer for selection so category colors retain their meaning.

Use OrbitControls for orbit/dolly/pan and configure the desired input behavior [T2]. Do not follow a generic example that attaches keyboard controls to the global window; the keyboard contract belongs to the focused canvas in this specific ItemView. Primary click-versus-drag classification remains an application concern. Run ray picking only against selectable file lots, not labels, ground planes, district borders, or overlays.

Use the full `CameraBookmark` value to save/restore 3D/top states. Align the orientation and height scale with the visual design, but treat the simulator's pixel/angle constants as illustrative, not Three.js configuration constants. Keep Fit city and Focus selected as different public operations.

## Demand-driven drawing and resources

A changed camera, selection, filter presentation, theme, resize, or scene requests a render. No constant auto-rotation or perpetual idle render loop is required. If enabling damping later, keep drawing while motion is settling and stop once stable. Coalesce invalidations into one pending frame.

Three.js resources need explicit disposal; simply removing a mesh from a scene does not release its geometry/material/texture resources [T3]. Each view must dispose its controls, observers, input listeners, scheduled animation frames, renderer, and owned scene assets. Shared resources need explicit ownership/reference counting rather than disposal by whichever leaf closes first.

Measure actual draw calls, texture/geometry counts, memory behavior, and input latency in Obsidian. The browser reference's idle-frame check is not a GPU or Three.js benchmark. The 5,000-file target from the implementation kit remains unverified.

## Host lifecycle and pop-outs

Use the ItemView container as the mount point and register through the plugin's view factory [O1]. Use the container's owning document/window for overlays, animation scheduling, event handlers, computed theme variables, and observers. Pop-out windows use different global constructors and contexts; migration may require renderer reinitialization [O2].

Restore a saved camera/selection/query when reconstructing the same compatible view. Never restore a running process or authorize a fresh scan simply because a view reopens. If the source is unavailable, preserve an inspectable snapshot with an explicit stale/unbound state.

Plugin unload should make new callbacks no-ops, detach observers, cancel view-specific tasks, and release resources. If a shared run is used by another leaf, detach this leaf's subscription rather than blindly killing work it does not exclusively own. A user-issued Cancel has its own run-level semantics.

## Theme bridge

Read semantic host CSS variables and resolve them into plain color values for Three.js. On a host theme change, refresh materials/labels without moving buildings or clearing state. Keep selection outline distinct from evidence/category colors, and verify contrast in light, dark, and custom themes. The prototype's standalone theme picker is review-only and must not become a plugin setting.

## Required adapter verification

Before calling WP-01 complete, demonstrate real view mounting and disposal; actual InstancedMesh mapping and picking; top/3D camera restoration; resize with no implicit Fit; keyboard ownership in split leaves; renderer recovery; shared snapshots with independent view state; correct pop-out migration; and unchanged source files after inventory scanning.

Sources: `07-sources-and-limits.md`.


---

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


---

# Review script and validation boundaries

## Open the reference

Open `index.html` in a desktop browser. It is a self-contained HTML file with no runtime network dependency. The archive also includes the editable sources. A host policy can block local-file navigation; this environment used Playwright `set_content` with the same HTML bytes for capture rather than a file URL. The file can also be served through ordinary local development tooling outside Obsidian; no server is part of the plugin architecture.

The source and scan controls are explicitly simulated. No repository path is opened. The “Sibling note” text is not saved to a vault. The renderer uses Canvas 2D projection, not Three.js/WebGL. This is an interaction review, not product installation.

## Ten-minute walkthrough

1. Select `city-layout.ts` in `src/visualization`. Confirm the exact relative path and 342 physical lines. The camera should not move merely because the inspector opens. Use Focus in city and compare the explicit framing change.
2. Close Details, then reopen it. Confirm the same selected file remains. Search for `snapshot`; the selected file remains inspectable while a search-mismatch explanation appears.
3. Press Escape while search is focused. Only the query clears. Focus the canvas and press Escape: only selection clears. Select the file again and open Sibling note. Type `/`, `f`, and `t`, then press Escape in the note. None should navigate the city.
4. Orbit, pan, and zoom. Use Top, pan in top view, and return to 3D. The earlier 3D pose must return. Repeat navigation through the camera-help buttons and canvas keys.
5. Search for `ÜBER`; select the non-ASCII fixture path. Search for a nonexistent path; observe zero matches without losing the snapshot or selected file.
6. Open Review scan. Tab through the modal and dismiss with Escape. Confirm focus returns to the trigger. Reopen and confirm that consent has reset.
7. Start a simulated scan, then cancel. Wait for the simulated run's old timer callbacks. The previous snapshot remains current. Run the failed-refresh scenario and compare its message with cancellation.
8. Use Test 3D fallback. The HTML table retains every included file and exact measurements. Search/select through it. This is a simulated renderer failure, not a real WebGL context-loss test.
9. Resize the window and toggle Sibling note to constrain the leaf. Close the details drawer with Escape while inside it; the selected file remains, and focus returns to Details.
10. Preview light/dark themes. Selection, query, camera, and snapshot identity remain unchanged. The theme selector is review-only; the production plugin follows Obsidian's theme.

Ask reviewers to explain what building height means, what the scan control actually did, and how they would inspect a file without using 3D. Record observations rather than asking whether they “like” the design. No user-study results are supplied in this package.

## Completed checks

See `validation/model-test-results.tap` and `validation/browser-results.json` for executable results and test names. The current run contains 31 passing state tests and 28 passing headless Chromium checks. Those counts refer to this reference only. Twelve current-run screenshots capture selected review states. Syntax and artifact checks are recorded separately.

Browser checks cover identity-preserving selection, context-scoped keys, source-modal focus, search/no-result semantics, camera bookmark behavior, simulated scan publication, clipping at selected viewport sizes, fallback table retention, clipboard failure, and idle render scheduling. A basic button-label check is not an accessibility audit. The observed absence of network requests applies to the reference page during these tests.

## Outstanding production gates

| Area | Evidence still required |
|---|---|
| Three.js | Actual renderer loads; InstancedMesh picking; bounds; resource disposal; GPU/context-loss recovery; documented scale benchmark |
| Obsidian | Clean-vault installation; real ItemView lifecycle; split leaves; host command routing; pop-out migration; disable/re-enable |
| Inventory | Actual paths; scope confinement; ignored/generated files; symlink behavior; non-ASCII Windows paths; cancellation; partial reads; no unintended source writes |
| Authorization | Actual approval fingerprints; root changes; machine-local external bindings; no run on restore |
| Accessibility | Screen-reader testing, focus order/visibility, zoom, custom themes, reduced motion, non-drag equivalence in the actual host |
| UX | Maintainer/new-contributor reviews; comprehension of physical lines versus complexity; first-run success; narrow-leaf task completion |
| Performance | Real-codebase load/interaction measurements with hardware and application versions documented |
| Persistence | Workspace restoration, profile/snapshot reconciliation, missing selected file, stale/unbound source, snapshot retention |

Do not merge browser checks and future host gates into a single misleading “all tests passed” claim. The view is ready for implementation review, not certified for release.


---

# Decisions and traceability — WP-01 refinement

These are implementation defaults proposed in this continuation, not a record of a user approval meeting. They preserve the existing visual direction and the requirement to build a native Obsidian plugin with Three.js.

| ID | Decision | Why it resolves ambiguity | Reference evidence / future gate |
|---|---|---|---|
| D01 | Select and Focus are separate | Prevents accidental camera travel while reading a list | State tests; B02/B08; actual Three framing still required |
| D02 | Empty canvas click is a no-op | Removes accidental loss of context after navigating | Renderer click classification; production picking gate |
| D03 | Close inspector preserves selection | Panel visibility is not data selection | B03 |
| D04 | Search dims without relocating lots | Keeps spatial identity stable while narrowing attention | B04/B25 |
| D05 | Selected nonmatch remains inspectable | Avoids silent disappearance when refining a query | B04/B18 |
| D06 | Escape belongs to the focused context | Prevents conflicts with Obsidian and sibling notes | B05/B06/B12/B13/B26; real host gate remains |
| D07 | Store complete 3D bookmark for top-view return | Top-view exploration must not destroy a previous viewpoint | B07; production bookmark integration required |
| D08 | Fit city always means entire current inventory | Removes uncertainty between filtered results and the full city | State test + B08; keep explicit label |
| D09 | Refresh keeps a compatible previous snapshot | Progress/failure is distinct from codebase evidence | B15/B16/B17; real profile/scope guards remain |
| D10 | Cancel invalidates publication immediately | Prevents late asynchronous results from reappearing | Run-ID tests + B15; real worker stop still required |
| D11 | HTML inventory is a first-class path | Core information must not require graphics or dragging | B11; real context loss/accessibility remain |
| D12 | Responsive behavior is measured on the leaf | A wide desktop may contain a very narrow plugin pane | Container styles/B12/B24; real split-leaf gate |
| D13 | Review controls never become product navigation | Avoids leaking synthetic states and an independent theme UI | IP-08 distribution review |
| D14 | Defer double-click focus | Reduces conflicting gesture handling in the first release | Explicit button/Enter equivalent already exists |
| D15 | No Three.js implementation is claimed here | Dependency fetch was unavailable; a contract is not a running integration | Sources/limits; adapter declaration only |

## Corrections made during review

The earlier all-package SVG prototype used document-level keyboard handling and broad re-render paths. The new WP-01 reference scopes input to the plugin region, preserves the active file control during selection, keeps camera bookmarks separate, and uses modal-specific return focus. The original prototype has not been rewritten globally; it remains a later-capability visual fixture, not the updated behavior source.

The new browser run initially revealed a scope-modal focus-cycle failure in the reference and an incorrect test expectation for the fixture's full path. An explicit boundary-cycle handler was added to the modal; the path expectation now matches `src/visualization/layout/city-layout.ts`. The fixture category `Test` was also reconciled with the Tests legend color. Final results are saved after rerunning the suite.

## Screen linkage

| Earlier screens | New reference/capture | Scope |
|---|---|---|
| S02–S04 | 08 scope review + simulated running state | Review interaction; no real picker, root validation, or scan |
| S05–S07 | 01 city, 02 selected, 11 light theme | Structural presentation/selection |
| S08 + S23 | 03 selected outside search; empty/non-ASCII test cases | Path filtering and preserved selection |
| S09 | 05 top-down | Camera-mode return behavior |
| S10 | 07 narrow drawer, 12 constrained leaf | Responsive controls and focus |
| S11 | 06 HTML fallback | Equivalent inventory under simulated rendering failure |
| S12 | 09 cancelled, 10 failed refresh | Last-valid-snapshot retention |
| Host integration | 04 sibling note | Local keyboard ownership; host is simulated |

The first-run screen and production settings are still specified in S01 and S13. The new reference does not replace every screen or implement every state. Later-release screens S14 onward stay assigned to their original packages.


---

# Primary sources and limits

Consulted for this continuation on 17 September 2026. URLs point to primary documentation; moving documentation must be rechecked against the versions actually used by the plugin.

| ID | Source | Used for |
|---|---|---|
| O1 | Obsidian developer documentation, custom views: https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Views.md | ItemView registration, multiple view instances, lifecycle ownership |
| O2 | Obsidian, Support pop-out windows: https://docs.obsidian.md/plugins/guides/pop-out-windows | Owning window/document and migration concerns |
| T1 | Three.js, InstancedMesh: https://threejs.org/docs/pages/InstancedMesh.html | Shared geometry/materials, instance state and bounds |
| T2 | Three.js, OrbitControls: https://threejs.org/docs/pages/OrbitControls.html | Orbit, pan, dolly, control configuration, keyboard scope considerations |
| T3 | Three.js, Cleanup: https://threejs.org/manual/en/cleanup.html | Explicit lifetime management for graphics resources |
| T4 | Three.js r184 package metadata: https://github.com/mrdoob/three.js/blob/r184/package.json | Identified package version 0.184.0; not a latest-version claim |
| A1 | W3C WAI-ARIA APG, Dialog (Modal) Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | Modal focus containment, Escape, focus return |
| A2 | W3C technique H102: https://www.w3.org/WAI/WCAG21/Techniques/html/H102 | Native HTML dialog behavior in the browser reference |

## Evidence boundaries

No repository for an implemented Codebase Inspector plugin was supplied in this continuation, and no such repository was inferred or modified. The visual baseline and fixtures came from the previously delivered design archive. One fixture filename was changed to a non-ASCII example while retaining 144 files. These quantities and paths are illustrative, not extracted from a user's source tree.

No user research, live Obsidian test, screen-reader session, GPU benchmark, real scanner, or fallow run was performed. The browser tests exercise a separately authored, self-contained review page using the exact bundled HTML content. The browser environment blocks local `file:` navigation, so automation injected the HTML into a blank page using Playwright `set_content`; no local server or network dependency was needed.

The attempt to download a Three.js runtime dependency failed in this environment. The runnable interaction reference therefore uses an explicitly labeled Canvas 2D projection simulator, while the intended production implementation remains Three.js. The archive does not contain a fabricated or substituted “Three.js” library. The supplied TypeScript file defines the adapter boundary; it does not implement that renderer.

This package should be evaluated as a design and implementation handoff. Passing its tests is evidence for the reference behavior, not a claim that the product exists or is release-ready.


---

# Implementation-agent prompt — first structural city

Copy the following into the implementation session with repository access.

---

Implement **WP-01 of Codebase Inspector**, an Obsidian desktop plugin. The UI is English. The production visualization uses Three.js. The earlier UI/UX package covers the whole product; this session must implement only the first structural city and its supporting workflow.

Read the existing repository, its development instructions, the WP-01 implementation specification, the UI/UX screen specs S01–S13 and S23, and this WP-01 refinement package. Produce a brief contract inventory before editing. Reconcile implemented models with `integration/renderer-port.ts`; do not blindly add competing Snapshot, File, Profile, or ViewState models.

The review reference is a synthetic, dependency-free browser simulator. Use its behavior and tests as a specification, not as production architecture. Do not copy its Canvas 2D renderer, fake host shell, artificial scan states, global debug hook, or review toolbar into the plugin. Keep Three.js behind the renderer port. Keep its objects outside deep Vue reactivity. Use view-scoped UI state with shared immutable snapshot services.

Work through IP-01 to IP-08 in `docs/04-first-release-build-order.md`. After contracts and the minimal host shell, collector, renderer, and UI work may proceed in parallel with non-overlapping ownership. A single integrator resolves shared interface changes. Each agent reports edited files, tests executed, unfinished items, and any integration assumptions.

The required experience is: open a native ItemView; explicitly select a vault, vault subdirectory, or external root; review actual scan scope; collect a real read-only inventory; render the city; search and select files without moving the camera; focus deliberately; inspect exact measurements; use an equivalent HTML list; cancel/fail/refresh without losing the previous valid snapshot; survive lifecycle and theme changes.

Do not execute project scripts, fallow, Git, package installs, or source writes as a side effect of inventory. Opening a view or restoring workspace state does not authorize scanning. Keep scope approvals attached to actual source and scope identities. Reject stale results after cancellation or a new run.

Preserve per-leaf keyboard ownership: text inputs and sibling notes must not trigger city controls. Modal Escape returns to its trigger. Search Escape clears only its query. Closing Details preserves selection. Search preserves lot geometry. Top/3D restores the saved camera.

Port the model and UI invariants into the project's Vitest/host test strategy. Do not claim the browser reference's 31 state tests or 28 Chromium checks as tests of your implementation. Run real production tests and identify all unexecuted host, graphics, filesystem, accessibility, and performance gates.

Do not implement later packages or expose empty navigation for them. No findings, dependencies, health score, safe-to-delete rating, coverage, runtime analysis, or automatic note creation in WP-01.

Finish with a tested production build and a reproducible demonstration in a clean Obsidian test vault against a real codebase. Report evidence of source-safety, lifecycle cleanup, performance measurements, and remaining limitations. If any required gate fails, keep its status visible rather than hiding it behind a successful fixture render.

---
