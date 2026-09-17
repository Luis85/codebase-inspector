# Obsidian integration handoff

This artifact demonstrates a **real Three.js city** inside a standalone host. It does not include an installable manifest/main.js plugin. The next implementation should preserve the behavior rather than embed the whole HTML page as another application shell.

## Adapt in this order

1. Reconcile the demo interchange model with the production normalized snapshot. Keep `FileId`, null measurements, stable relative paths, and explicit provenance. Do not replace the complete model with a findings-only array.
2. Convert `src/model.js` and `src/viewer.js` to TypeScript modules. Replace browser globals with explicit imports/injected dependencies. Select the production Three.js version, adapt its APIs, and run the interaction and visual regression suite against it.
3. Register a native ItemView and mount the Vue host in its content element. Give each leaf its own view state, renderer, canvas, and labels. Use Pinia for appropriate host state, not for deeply reactive Three.js objects.
4. Map theme tokens to Obsidian CSS variables at the owning element. The demo's standalone theme button is review equipment; production follows the host theme.
5. Wire the read-only filesystem collector to the snapshot boundary. The browser demo does not grant or implement filesystem access. fallow remains a separate provider adapter; the city should work without it.
6. Implement lifecycle cleanup, hidden-leaf suspension, per-window DOM ownership, and renderer recreation on supported pop-out/migration events. Test them inside the actual supported Obsidian version.
7. Route selection to native inspection panels, then later investigation notes. There is no note-writing action in this demo.

## Avoid these shortcuts

Do not load `viewer.bundle.js` with a raw CommonJS require inside the plugin. Its browser UMD/globals are for the portable demo. Do not iframe the full demo as the permanent plugin architecture. Do not execute source code or install dependencies because a snapshot or report requests it. Do not share one global camera across leaves. Do not treat the 5,000-file software-rendered test as a production GPU benchmark.

## Public grounding

The design follows the official Obsidian custom-view, pop-out, and plugin-lifecycle guidance and Three.js's explicit resource ownership model. Check these sources again against the versions chosen for implementation:

- https://docs.obsidian.md/Plugins/User+interface/Views
- https://docs.obsidian.md/plugins/guides/pop-out-windows
- https://docs.obsidian.md/community-directory/developer-policies
- https://threejs.org/manual/en/cleanup.html
- https://threejs.org/docs/#api/en/objects/InstancedMesh

These links are implementation references, not evidence that the standalone browser demo has already been validated in Obsidian.
