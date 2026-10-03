# Interaction specification

## The navigation model

A single click **selects**. Focus/frame is a deliberate secondary action. Selection alone must not make the camera jump. Double-click may focus as a convenience, but every double-click and drag action has an explicit control alternative.

Selection, hover, camera target, directory focus, query, and panel visibility are separate states. Closing a panel is not clearing selection. Recoloring a lens is not a new scan. Filtering is not changing the snapshot. Source authorization is not a presentation preference.

## Pointer and camera contract

| Input / control | Result | Recovery and caveat |
|---|---|---|
| Hover building, about 200 ms | Short path/category/value tooltip | No camera or selection change; dismiss on leave/Escape |
| Primary click, movement ≤5 CSS px | Select nearest visible building | Sync list and inspector; full path accessible |
| Primary drag, movement >5 CSS px | Orbit around current target | Never interpret release as a selection |
| Right drag or modified-primary drag | Pan | Do not open a conflicting context menu after a drag |
| Wheel over focused/engaged canvas | Dolly | Bound zoom; let text/list scrolling remain normal |
| Double-click building | Select and frame building neighborhood | Same action as Focus; reduced-motion alternative |
| Fit button | Frame current visible scope | Does not clear selected file, query, or provider |
| Focus in city | Frame selected file with surrounding context | Does not isolate/delete other files |
| Top button | Switch to top-down camera | Remember previous 3D camera so toggle back restores it |
| Zoom + / − | Step distance by a documented bounded factor | Single-pointer alternative to wheel/pinch |
| Direction/rotate step controls in help | Move camera by bounded steps | Single-pointer alternative to dragging |
| Click empty city space | Clear selection only if explicitly documented | Prefer no-op in initial release; provide Clear selection |
| File list item | Select matching file | Do not automatically focus camera on each arrow/navigation move |
| Relative-path copy | Copy codebase-relative path | Announce success; failure exposes selectable text |
| Source-opening action | Request supported viewer/editor target | No shell-built command string; invalid/unbound path explains next step |

Three.js OrbitControls supplies orbit/dolly/pan primitives and configurable controls [S10]. Configure and test them rather than assuming default global keyboard behavior is suitable inside Obsidian. Never attach keyboard listeners to the global window for inactive leaves.

Thresholds and timings are proposed interaction constants to test with mouse, trackpad, pen, and assistive input. Do not tie the drag threshold to device pixels.

## Keyboard contract

All required actions are normal focusable controls. Do not assign global shortcuts by default that conflict with Obsidian. Register commands so users may choose hotkeys.

While the canvas region itself has focus, optional local keys may be: `F` Fit, `T` Top/3D, `+`/`-` zoom, arrow keys pan, Shift+arrows rotate, Enter focus selection. `/` focuses file search only when the inspector workspace owns focus and the target is not a text input. These are proposals, not host-wide bindings.

Escape resolves the topmost transient state: modal or popover → camera interaction/help → nonmodal drawer → query/selection only when the corresponding control owns focus. One press performs one action. Do not clear a Markdown editor’s state or interfere with IME composition. With a dirty note composer, Escape offers Keep editing / Discard draft rather than silently losing work.

For ordinary list buttons, use native Tab navigation. If replacing them with a virtualized composite tree/list, implement its full documented keyboard pattern, stable accessible names, active-descendant/roving-focus semantics, and offscreen selection recovery. Do not add `role=tree` to an incomplete implementation.

## Search and filters

Search scope is included file paths, not every symbol, finding, or source text in WP-01. Do not label it “Search everything.” Case-insensitive path substring matching is an acceptable first implementation; ranking can prefer exact basename, basename prefix, path substring, then fuzzy results if implemented.

Debounce around 120–180 ms for large inventories, but keep input immediate. Update match count, dim nonmatches in place, and offer “Focus results” explicitly. Do not rebuild layout from the filtered set by default. No-results state says “0 of 144 files match,” not “Your codebase is empty.” Clearing search restores the same geometry and camera unless the user deliberately focused another scope.

A filter-hidden selection remains known. Explain “Selected file is outside these filters” and offer Reveal or Clear selection. Do not silently replace it with the first matching file. In the prototype, the review fixture implements simple matching and visual emphasis, not the full production focus/virtualization model.

## Selection synchronization

Publish `selection.changed` with `viewId`, `profileId`, `snapshotId`, `entityId`, and origin (`city`, `file-list`, `finding`, `link`). The UI resolves details once from the normalized snapshot. Do not bounce events in a list↔canvas loop. Camera focus uses a separate `camera.focusRequested` intent.

Immutable snapshot replacement reconciles selection by entity ID. A missing file becomes a descriptive state with its old path, not a new random selection. New provider results update only compatible observations. A late job for another profile cannot overwrite the active view.

## Source and scan controls

Source selection validates path existence, readable directory, supported adapter, and normalized resolved root before scope review. If validation fails, retain the typed value and place the error next to that field. Default consent is unchecked. Scan begins only through the explicit action after review. Editing the root invalidates the prior review.

The first click on Scan while idle enters review or a clearly authorized operation path. During a scan, show Cancel rather than starting duplicate jobs. A cancelled partial result does not replace the last complete snapshot. A completed scan swaps the snapshot atomically after validation and labels any skipped/unreadable scope. Reopening a tab may show retained evidence but does not start work.

## Provider and note actions

Import report → validate envelope/schema/version/scope/path mapping → show provenance → attach compatible evidence. Never execute report-specified commands. Installed analyzer → inspect executable/version/arguments/root/side effects → explicit approval → cancellable run. The community-plugin policy forbids installing/updating dependencies from the plugin [S4].

Create investigation note → confirm destination and content → create through Vault API → report actual result → offer Open note. Never announce success before write completion. A collision offers a distinct new name, explicit append, or cancel; no silent overwrite. A recovered draft remains editable after failure.

The UI does not offer “Delete unused code,” “Fix all,” or a fabricated probability of safe deletion.
