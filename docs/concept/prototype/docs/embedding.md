# Embed the bundled viewer

`viewer.bundle.js` contains the actual pinned Three.js runtime, CIModel, and CityViewer. It does not contain the demo's toolbar, source fixture, inspector, or application state. `embed.html` is a minimal working browser example.

For a plain browser page, load this local script once, provide a sized canvas container and an absolutely positioned label layer, and pass a validated immutable snapshot:

```html
<div class="viewer-host">
  <canvas id="city" tabindex="0"></canvas>
  <div id="labels" class="district-labels"></div>
</div>
<script src="viewer.bundle.js"></script>
<script>
const snapshot = CIModel.validateSnapshot({
  schemaVersion: 1,
  name: 'Example',
  files: [{ path: 'src/main.ts', lines: 120, bytes: 4096 }]
});
let city;
city = new CodebaseInspectorViewer.CityViewer({
  canvas: document.getElementById('city'),
  labels: document.getElementById('labels'),
  onSelect(id) {
    city.setSelected(id); // Does not move the camera.
    // Update the host's inspector and selection state here.
  },
  onContextLost() { /* Switch to a host-provided HTML inventory. */ }
});
city.loadSnapshot(snapshot);
// Explicit intent, e.g. a separate host button:
// city.focusFile('src/main.ts');
// On host destruction:
// city.dispose();
</script>
```

Required layout rules are illustrated in `embed.html`. The host must give the canvas container a nonzero width/height. CityViewer observes its parent with ResizeObserver. The label layer must not intercept pointer events. Use `src/renderer-contract.d.ts` as a typed description; this file is not a separate implementation.

## Host responsibilities

Keep snapshot, selected ID, search predicate, panels, focus, and visible mode in host state. Keep camera pose, raycasting, scene objects, and invalidation in the renderer. Apply filters with `setMatches(new Set(ids))`; null means no filter and an empty Set means no matches. Do not supply new layouts just to filter. `setSelected(null)` clears only the visual selection; synchronize the host too.

`loadSnapshot` expects the normalized result of `CIModel.validateSnapshot`, not arbitrary input. Reset or reconcile selected/filter state before publishing a replacement snapshot. One viewer belongs to one host canvas; never move a live rendering context between windows. On recreation, restore selection, visual settings, and a compatible camera bookmark.

There is no ambient filesystem, analyzer, authentication, or network access. Callbacks expose only file IDs, normalized records, pointer coordinates, camera state, and render diagnostics. The authoring sources have no external image/font/texture loaders.

## Camera and rendering

The current camera is orthographic with a bounded polar angle, custom pointer gestures, and explicit fit/focus. `setMode('top')` stores a 3D bookmark. `setMode('3d')` restores it. `getCameraState()` is meaningful within a compatible snapshot/layout; it is not a portable navigation link format. Host keyboard actions are outside the viewer module.

A new frame is requested only on input, changes, resize, restoration, or unhide. `setSuspended(true)` cancels queued work. `dispose()` is idempotent; it removes observers/listeners, disposes world geometry/materials and shadow resources, disposes the renderer, clears labels, and releases the context. Resource-count tests cover repeated snapshot loads; they do not prove every host integration is leak-free.

`capture()` renders the current canvas and returns a PNG data URL. It does not include HTML labels or surrounding UI. `getDiagnostics()` reports actual renderer counters; counts are not a quality score or a frames-per-second benchmark.

## Version and module boundary

The supplied bundle intentionally exposes browser globals. Three.js r140 uses the older `outputEncoding`/`sRGBEncoding` API. A modern production upgrade needs deliberate changes and revalidation, not just replacing the vendor file. A strict host Content Security Policy may disallow a single-file inline variant; use bundled host modules in that environment.

Do not insert this demo bundle unchanged into Obsidian's CommonJS runtime. Convert the authored modules to TypeScript/ES modules with explicit `three` and model imports, bundle them with the plugin, and retain Obsidian as an external host import. Keep the full MIT license when redistributing the library or a modified runtime bundle.
