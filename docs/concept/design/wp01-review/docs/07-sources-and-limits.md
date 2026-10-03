# Primary sources and limits

Consulted for this continuation on 17 September 2026. URLs point to primary documentation; moving documentation must be rechecked against the versions actually used by the plugin.

| ID | Source | Used for |
|---|---|---|
| O1 | Obsidian developer documentation, custom views: https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Views.md | ItemView registration, multiple view instances, lifecycle ownership |
| O2 | Obsidian, Support pop-out windows: https://docs.obsidian.md/plugins/guides/pop-out-windows | Owning window/document and migration concerns |
| T1 | Three.js, InstancedMesh: https://threejs.org/docs/pages/InstancedMesh.html | Shared geometry/materials, instance state and bounds |
| T2 | Three.js, OrbitControls: https://threejs.org/docs/pages/OrbitControls.html | Orbit, pan, dolly, control configuration, keyboard scope considerations |
| T3 | Three.js, Cleanup: https://threejs.org/manual/pages/cleanup.html (moved from `/manual/en/cleanup.html`, which now returns 404; corrected 2026-10-03) | Explicit lifetime management for graphics resources |
| T4 | Three.js r184 package metadata: https://github.com/mrdoob/three.js/blob/r184/package.json | Identified package version 0.184.0; not a latest-version claim |
| A1 | W3C WAI-ARIA APG, Dialog (Modal) Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/ | Modal focus containment, Escape, focus return |
| A2 | W3C technique H102: https://www.w3.org/WAI/WCAG21/Techniques/html/H102 | Native HTML dialog behavior in the browser reference |

## Citations re-fetched 2026-10-03 (gap closure GRD11)

Each `[T1]`-`[T4]` and `[O1]`-`[O2]` source cited by `03-threejs-and-obsidian-bridge.md` was fetched again on 2026-10-03. The claim each citation supports was compared with what the page says now.

| ID | URL fetched | Accessed | Claim still holds? |
|---|---|---|---|
| O1 | https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Views.md | 2026-10-03 | Yes. `registerView()` takes a view-factory function, the page warns the factory can be called several times and shows `getLeavesOfType()` for several instances, and `onOpen()`/`onClose()` carry the lifecycle. |
| O2 | https://docs.obsidian.md/plugins/guides/pop-out-windows | 2026-10-03 | Yes. Each pop-out window has its own `Window`, `Document` and fresh global constructors; the guide says to use `element.win`/`element.doc`, not `activeDocument`, and offers `HTMLElement.onWindowMigrated()` so a canvas renderer can re-initialise. |
| T1 | https://threejs.org/docs/pages/InstancedMesh.html | 2026-10-03 | Yes. `setMatrixAt()`/`setColorAt()` set per-instance transforms and colors, `instanceMatrix`/`instanceColor` need `needsUpdate = true`, and the bounding box and sphere may need recomputing after `setMatrixAt()`. |
| T2 | https://threejs.org/docs/pages/OrbitControls.html | 2026-10-03 | Yes. The page documents `enableRotate`, `enableZoom` (dolly) and `enablePan`, `mouseButtons`, and `listenToKeyEvents(domElement)`, which it recommends calling with `window`; the keyboard-scope warning in the bridge doc stands. |
| T3 | https://threejs.org/manual/pages/cleanup.html (was `/manual/en/cleanup.html`: moved, now 404) | 2026-10-03 | Yes, at the new URL. three.js cannot free these resources automatically; `dispose()` must be called on textures, geometries and materials, and removing an object from a scene is not enough. |
| T4 | https://github.com/mrdoob/three.js/blob/r184/package.json | 2026-10-03 | Yes. The `version` field is `0.184.0`. Still not a latest-version claim. |

No claim is superseded; the only correction is the T3 URL.

## Evidence boundaries

No repository for an implemented Codebase Inspector plugin was supplied in this continuation, and no such repository was inferred or modified. The visual baseline and fixtures came from the previously delivered design archive. One fixture filename was changed to a non-ASCII example while retaining 144 files. These quantities and paths are illustrative, not extracted from a user's source tree.

No user research, live Obsidian test, screen-reader session, GPU benchmark, real scanner, or fallow run was performed. The browser tests exercise a separately authored, self-contained review page using the exact bundled HTML content. The browser environment blocks local `file:` navigation, so automation injected the HTML into a blank page using Playwright `set_content`; no local server or network dependency was needed.

The attempt to download a Three.js runtime dependency failed in this environment. The runnable interaction reference therefore uses an explicitly labeled Canvas 2D projection simulator, while the intended production implementation remains Three.js. The archive does not contain a fabricated or substituted “Three.js” library. The supplied TypeScript file defines the adapter boundary; it does not implement that renderer.

This package should be evaluated as a design and implementation handoff. Passing its tests is evidence for the reference behavior, not a claim that the product exists or is release-ready.
