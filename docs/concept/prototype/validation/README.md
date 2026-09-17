# Validation record

Date: 2026-09-17. Artifact: Codebase Inspector bundled Three.js interaction demo.

## Actual completed checks

| Check | Result | Evidence |
|---|---|---|
| Pinned Three.js Git blob | Exact match with upstream r140 | `vendor/PROVENANCE.json`; build integrity check |
| Normalization/model tests | 23 passed, 0 failed | `model-tests.tap` |
| Browser interaction checks | 37 passed, 0 failed | `browser-results.json` |
| Separate embedding example | 6 checks passed | `embed-results.json` |
| Optional static server | 7 response/safety checks passed | `server-results.json` |
| Typed API declaration | TypeScript strict no-emit check passed | `type-check.txt` |
| Renderer | Actual WebGL2 and Three.js r140 | Runtime context/instance checks |
| Scene | 144 instanced file buildings in default fixture | Browser assertions and captures |
| Idle renderer | No additional frame without changes/input | Browser assertion |
| Large fixture | 5,000 files rendered; DOM lists bounded | Browser assertion and capture |
| Raycast selection | Actual Three.js raycasting | Pointer interaction assertion |
| Context recovery | Actual forced loss and restoration | Browser extension and callback assertions |
| Repeated loads | Geometry allocation count stable | Repeated snapshot-load assertion |
| Runtime external traffic | 0 network requests during interaction run | Recorded request listener |
| Browser script errors | 0 during the final interaction run | Recorded pageerror listener |

## Environment and limits

Chromium 144 in headed mode under Xvfb. ANGLE SwiftShader provided a **software WebGL2 context**, not a mocked renderer. Screenshots are actual browser-rendered Three.js scenes. They are not generated images or the earlier Canvas2D simulator.

This managed browser blocks navigation to both file URLs and local-server URLs. Tests therefore read the generated standalone HTML from disk and inject its unmodified content using Playwright `page.set_content`. This exercises actual scripts, styles, WebGL, DOM, and controls. **Direct double-click/file:// loading is not separately verified in this environment.** The artifact is designed for that use and contains classic inline scripts with no external runtime imports. No browser policies were modified to bypass this restriction.

No hardware-GPU latency/FPS claim is made. The 5,000-file assertion proves scene creation/rendering in this environment, not a performance service level. Screen-reader behavior, native touch/trackpad behavior, Safari/Firefox, hardware GPU/driver combinations, Electron/Obsidian, and theme interoperability require separate validation.

The included browser launcher uses software-GPU and test-container flags, including `--no-sandbox`, solely for this container's test harness. Do not copy those flags into the production plugin or recommend disabling a user's browser sandbox.

## Fix-and-rerun history

The first full run exposed a null `instanceColor` attribute on a zero-building InstancedMesh. Its empty-snapshot assertion failed, and the following allocation comparison inherited that interrupted state. `_recolor()` now guards the optional instance-color attributes. The entire 23-model/37-browser suite was rerun after the fix; all checks passed. The current JSON/TAP files are the post-fix results.

Visual inspection covered the dark selected-file view, light theme, narrow inspector, and default city after correcting the background/shadow surface. The initial opaque floor was replaced by an appropriate shadow-receiving surface, avoiding a bright plane against the dark interface. These are visual checks, not a blanket WCAG or pixel-perfect design certification.

## Captures

01 default dark city; 02 selected file; 03 retained selection outside search; 04 top view; 05 HTML inventory; 06 light theme; 07 actual context-loss fallback; 08 narrow city; 09 narrow inspector; 10 5,000-file scene; 11 separate viewer embedding example.

The app UI's diagnostic draw-call count changes with selection/shadows. The unselected default scene reported 16 draw calls in the recorded run. This is an implementation counter, not a cross-device throughput guarantee.
