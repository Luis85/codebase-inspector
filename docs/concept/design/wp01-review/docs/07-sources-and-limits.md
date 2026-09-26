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
