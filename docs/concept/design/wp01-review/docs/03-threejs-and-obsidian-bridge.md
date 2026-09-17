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
