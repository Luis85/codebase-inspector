# Codebase Inspector — Concept City / v3.0

A visual refinement of the supplied bundled Three.js interaction demo, based on the earlier illuminated-codebase-city concept boards. This remains an offline browser demo, not an installable Obsidian plugin.

## Run

Save and open **`index.html`** in a desktop browser with WebGL2 enabled. The prebuilt HTML contains Three.js r184 (0.184.0), the viewer, interface styles, SVG icons, and the synthetic dataset. It has no runtime CDN, network service, npm-install step, or application-server requirement. A chat/email file preview may not execute JavaScript; open the saved file in the browser itself.

## What changed

- Six raised, beveled district platforms, perimeter lighting, decorative street markers, and a subdued ground grid.
- Real instanced buildings with shader-rendered window facades, roof caps, equipment, beacons, and shared edge geometry.
- Curved, directional example connections, using explicit supplied relationships rather than inferred analysis.
- A district mini-map with click-to-focus and an equivalent keyboard-accessible district list.
- Dark navy, blue/violet/cyan district colors, refined panels, system typography, and a corresponding light theme.
- A persistent right-side area: computed structural overview before selection; file measurements and connections after selection.
- More precise interaction handling: the inspector never changes the camera implicitly, and returning from top view restores the prior 3D camera.

Read `docs/design-changes.md` for the mapping from concepts to implementation.

## Try it

Start by clicking **city-layout.ts** in the expanded visualization directory. Inspect its measurements, switch to **Connections**, and follow an incoming or outgoing example. Selection alone does not move the camera. Use **Focus in city** when you deliberately want to move closer.

Drag to orbit; Shift-drag or right-drag to pan. Scroll on a focused canvas to zoom. Fit, top view, zoom buttons, and keyboard actions are available. The Help dialog describes their scope and exposes single-pointer step controls.

Search changes visibility emphasis without rearranging the city. A selected nonmatch remains inspectable with a warning. Change directory/file-category coloring; turn connections, labels, or facade detail off; switch themes; use the mini-map to focus a district. **Files** shows the same snapshot as an HTML table. The image button exports a PNG of the real WebGL scene, composited over the scene background. Interface panels and projected HTML labels are not included in that PNG.

The small notebook button opens a simulated sibling editor. **Refresh demo** exercises success, failure, and cancellation without running an analyzer. The Help dialog's fallback switch simulates renderer unavailability; actual WebGL context loss is also handled.

## Data semantics

The included example contains **144 synthetic files, 6 directory groups, 42,608 physical lines, and 30 explicit sample relationships**. Those relationships aggregate into 11 directional district routes when no file is selected. Selecting `city-layout.ts` displays its 5 immediate example relationships. These are constructed fixture records, not evidence extracted from a repository.

- Building: one included file.
- District platform: one directory group.
- Height: `0.30 + 0.34 * sqrt(physicalLines)`, with a small decorative roof cap. Exact counts appear in the inspector.
- File lots: equal within a district; not proportional to cost, importance, or quality.
- Color: directory, or file category, depending on the selected lens.
- Window illumination, equipment, and platform lights: decoration, not runtime activity or test coverage.
- Relationship arrow: source to target in the synthetic dataset. Selected-file outbound links are violet; inbound links are cyan.

No code-health grade, deletion-confidence percentage, inferred vulnerability, or complexity score is fabricated. Source code is not read. fallow is not invoked. Notes are not saved. The source dialog is explicitly illustrative, not a working filesystem selector.

## Included files

- `index.html` — self-contained styled demo.
- `viewer.bundle.js` — reusable classic-script viewer, with Three.js included.
- `embed-example.html` — minimal separate host using that same viewer bundle.
- `viewer.d.ts` — proposed typed integration surface.
- `src/` — editable UI, CSS, state, fixture data, relationships, and Three.js renderer.
- `vendor/` — retained Three.js modules and license/integrity records; Font Awesome attribution/license.
- `docs/` — visual changes, viewer embedding, and Obsidian-port boundaries.
- `captures/` — screenshots from the actual rendered application.
- `validation/` — current-run results and comparison artifacts.
- `tests/` — reproducible browser and pure-state tests.
- `build.py` — Python-standard-library build, with stored vendor-integrity checks; no downloads.

## Integration and limitations

The renderer remains separated from the interface and consumes provided records plus state callbacks. The camera is a small custom controller around a real Three.js orthographic camera; OrbitControls is not bundled.

The layout is bounded to the review fixture, not a production repository layout engine. Treat `src/fixture.json` and its generated `src/fixtures.js` as trusted fixture input. A general normalized-data importer, schema migration, fallow adapter, and safe filesystem collector remain separate work.

Do not copy the entire demo shell or its `body` styles into an Obsidian plugin. The host ribbon, theme selector, source scenario, and sibling note are demonstration infrastructure. Mount the UI in an ItemView, adopt host CSS variables, supply per-leaf state, and own/dispose one renderer per view. See `docs/obsidian-port.md`.

## Rebuild and test

```sh
python3 build.py
node tests/state-check.cjs
xvfb-run -a -s '-screen 0 1920x1200x24' python3 tests/browser-check.py
```

Browser testing requires Python Playwright, Chromium, and Xvfb in the verification environment. Those dependencies are **not** needed to run the prebuilt demo. Current receipts are in `validation/browser-results.json` and `validation/state-results.json`; `validation/README.md` explains the test environment and remaining gaps.

The test environment blocks native `file://` navigation. Tests therefore inject the unchanged standalone HTML into Chromium, retaining its restrictive Content Security Policy. Direct operating-system opening and download completion were not empirically tested here. Native Obsidian, physical GPUs, touch hardware, other browser engines, and screen-reader behavior remain unverified.

## Dependencies

Three.js r184 is carried forward from the supplied v2 demo. The build verifies its source files against the inherited Git-blob hashes; this revision does not assert it is the latest Three.js release. Font Awesome Free 6.7.2 SVG icons are included with attribution. See `THIRD_PARTY_NOTICES.md` and `vendor/`. No font files are distributed.
