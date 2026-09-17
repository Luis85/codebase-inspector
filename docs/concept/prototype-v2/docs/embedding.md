# Embedding the concept-city viewer

`viewer.bundle.js` contains the same Three.js r184 renderer used by the complete demo. Load it as a local classic script. It creates `window.CodebaseInspector3D`; it is not an ES-module import or a published npm package.

```html
<script src="viewer.bundle.js"></script>
```

Supply trusted normalized file records. The renderer does not inspect a directory or parse a fallow report. Each record needs a unique `id`, `path`, `group`, `category`, nonnegative finite `lines` and `bytes`, and a display `name`. The current layout is a demonstration layout, not an arbitrary-scale production import engine.

```js
let state = {
  selectedId: null,
  query: '',
  mode: '3d',
  camera: { yaw: 0.44, pitch: 0.71, zoom: 1, x: 0, y: 2, z: 0 }
};

const viewer = new CodebaseInspector3D.ThreeCity(
  canvas,
  files,
  () => state,
  patch => {
    state = { ...state, camera: { ...state.camera, ...patch } };
    viewer.invalidate();
  },
  id => {
    state = { ...state, selectedId: id };
    viewer.invalidate();
  },
  {
    relationships: edges, // Optional { id, source, target, kind, provenance } records
    minimap: miniMapCanvas, // Optional HTML canvas; host supplies sizing and label
    onContextLost: showEquivalentInventory,
    onContextRestored: showCity
  }
);

viewer.setTheme('dark');
viewer.setLens('directory');
viewer.setLinks(true);
```

The `canvas` must have a definite layout size; its parent must use `position: relative` and `overflow: hidden` for projected labels/tooltips. Copy the scoped `.three-labels`, `.district-label`, and `.city-tooltip` presentation rules or supply your own. These labels are ordinary DOM elements, not part of the WebGL export.

## Operations

| Method | Effect |
|---|---|
| `invalidate()` | Schedule a render if one is not already pending |
| `setTheme('dark' / 'light')` | Explicit host theme; avoids relying on the standalone body attribute |
| `setLens('directory' / 'category')` | Recolor without changing positions |
| `setLabels(boolean)` | Toggle projected directory labels |
| `setDetail(boolean)` | Toggle decorative facade and rooftop detail |
| `setLinks(boolean)` | Toggle supplied relationships |
| `focusDistrict(name)` | Send an explicit camera change through the host callback |
| `position(fileId)` | Return a file's world-space focus target, or null |
| `pick(x, y)` | Raycast canvas-relative CSS coordinates to a file ID |
| `capture()` | Render and return PNG data, including a scene background but not DOM labels/UI |
| `stats()` | Report renderer diagnostics for this demo |
| `dispose()` | Remove listeners/labels/observer and dispose owned geometry, materials, instances, shadow resources, and renderer |

The host owns selection, query, and camera state. The renderer does not mutate the host snapshot. Update state and call `invalidate()` when the host changes a selection or query. Implement camera fit/top restoration in the host using the same state contract.

The constructor currently builds one scene for one supplied fixture. Replacing the entire dataset requires disposing the viewer and constructing a new instance. Do not assume a `loadSnapshot` method or raw fallow importer exists.

Use `embed-example.html` as a runnable local example. The complete standalone demo includes an HTML fallback; the minimal embed deliberately leaves fallback UI to its host.
