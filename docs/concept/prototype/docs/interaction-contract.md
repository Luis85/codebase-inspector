# Interaction contract — real Three.js reference

## Selection, focus, and presentation

Pointer click/tap or HTML list selection changes the selected file and opens its inspector. It does not move the camera. The explicit Focus action frames the selected file; fit frames the complete city. Clicking empty space does not silently clear a selection. Drag detection prevents an orbit gesture from becoming a selection. Closing the inspector preserves selection.

Search and kind filters compute a predicate over the same snapshot; they never regenerate the lots. Matching files retain category colors, nonmatches dim, and the selected nonmatch retains a selection outline with a visible explanation. Enter in search selects the first match without moving the camera. Escape in search clears a nonempty query only. No results is not an empty snapshot.

## Camera ownership

Primary drag orbits in 3D; Shift/right drag pans. In top view primary drag pans. Wheel zoom is captured only while the canvas is focused, avoiding unexpected scroll interception. Two-pointer pinch/pan is implemented but needs device testing. Camera limits are bounded. The F/T/Enter/arrows/+/−/Escape commands operate only with canvas focus. Text controls do not trigger them.

Top view saves the complete 3D theta, phi, zoom, target, and mode. Returning restores that bookmark. Top-view pans and zooms do not overwrite it. File-kind, labels, shadows, theme, and metric changes do not automatically move the camera. Restoring a new snapshot fits it deliberately.

## Availability and recovery

WebGL initialization failure presents the equivalent HTML inventory. Runtime context loss cancels rendering, keeps the snapshot/filter/selection, and switches to that inventory. Return to 3D requests actual context restoration; the browser may still refuse. No invented recovery success is displayed. The Help dialog exposes a real context-loss test for review; it is not an end-user production control.

Imported JSON is parsed and validated before publication. Concurrent imports are generation-guarded so an older read cannot overwrite the latest request. Invalid reports preserve the previous valid snapshot. Data remains in browser memory; reload resets to the default fixture. Downloads occur only on explicit export/capture actions.

## Evidence boundaries

The city is structural, not a health score. Lines include comments/blank lines, bytes are source-file size rather than compressed bundle size, and unavailable metrics are labeled. Directory grouping is path-based, not inferred domain architecture. Equal footprints, nonlinear height scale, visible cap, category colors, and selection are separate meanings. No dependency arcs exist until an actual graph provider is implemented.

## Production validation still required

Test real hardware GPUs, retina scaling, supported OS/browser combinations, assistive technology, custom Obsidian themes, pop-out ownership, repeated ItemView lifecycles, view migration, large real snapshots, and touch devices. The browser reference's dark/light themes are not proof of compatibility with every Obsidian theme.
