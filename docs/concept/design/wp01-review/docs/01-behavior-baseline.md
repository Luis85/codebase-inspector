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
