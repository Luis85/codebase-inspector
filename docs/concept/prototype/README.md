# Codebase Inspector — bundled Three.js interaction demo

**Real Three.js/WebGL rendering. Offline, self-contained HTML. No CDN, dependency installation, account, or server required for the demo.**

The demo implements the first city-view interaction slice for Codebase Inspector, the planned Obsidian plugin. It is a browser reference and a reusable rendering module, **not an installed Obsidian plugin or a fallow analyzer**.

## Open the demo

Open `standalone.html` in a desktop browser with JavaScript and WebGL 2 enabled. Three.js, the viewer, CSS, icons, and the 144-file synthetic snapshot are included in that single file. Use the actual HTML file in a browser rather than a file-preview pane that prevents scripts from running.

Alternatively, keep the extracted folder intact and open `index.html`. It loads its JavaScript and CSS locally. When a browser restricts local files, run the optional loopback-only helper with Node.js 20 or later:

```sh
node serve.mjs
```

Then open the address printed by the helper. This is an optional static-file server, not an analysis service. Stop it with Ctrl+C. No dependencies need to be installed.

**Runtime version:** the included library is **Three.js r140 / 0.140.0**, an older MIT-licensed release. It was recovered from an available local distribution and its exact Git blob verified against the upstream release. It is pinned for this offline demo, **not a current production-version recommendation**. See `vendor/PROVENANCE.json`. Upgrade deliberately and revalidate rendering, color management, picking, lifecycle, and context recovery before integration into the production plugin.

## What works

The city uses actual `THREE.WebGLRenderer`, `OrthographicCamera`, `InstancedMesh`, lights, shadows, and raycasting. Directory districts contain individual file buildings. File kind determines color; physical lines or file bytes determine height through a disclosed square-root scale. Exact values stay visible in the inspector.

- Orbit, pan, zoom, fit, top-down view, explicit focus, hover, and real file picking.
- Search and file-kind filtering without rebuilding the layout; selected nonmatches remain visible and inspectable.
- Synchronized explorer, selected-file inspector, and HTML inventory.
- Light/dark themes, labels, shadows, constrained layouts, and scoped keyboard controls.
- JSON snapshot import/export using an explicit chooser. Invalid imports keep the last valid snapshot.
- Actual WebGL context-loss test and recovery through the Help dialog. A failure leaves the HTML inventory available.
- On-demand rendering rather than a permanent animation loop; explicit resource cleanup and per-instance IDs.

The included fixture has **144 files across six directory groups**. These are synthetic measurements, not an inventory or quality report of a real repository. Import your own normalized snapshot using **Load snapshot**; the documented format is in `docs/snapshot-format.md` and `fixtures/minimal.snapshot.json`. Raw fallow JSON is intentionally rejected: an explicit adapter must map its evidence into the application's model.

## Navigation

| Action | Control |
|---|---|
| Select a file without moving the camera | Click/tap a building or choose an explorer entry |
| Orbit | Primary pointer drag in 3D |
| Pan | Shift-drag or right-drag; primary drag in top view |
| Zoom | Wheel after focusing the canvas, or the + / − buttons |
| Fit city | Fit city button; F with canvas focus |
| Top view / previous 3D pose | Top / 3D city buttons; T with canvas focus |
| Focus the selected file | Focus in city button; Enter with canvas focus |
| Search | Search field; / outside editable controls |
| Clear selection | Inspector action; Escape with canvas focus |
| Clear search | Escape in a nonempty search field |
| Navigate without 3D | Files tab and the equivalent HTML inventory |

The camera uses a small custom controller, **not OrbitControls**. Touch pan/pinch code is included, but real-device gesture behavior remains unverified. Right drag is intercepted only on the canvas. Typing in an input does not trigger camera shortcuts.

Selection and camera focus are separate. Closing Details preserves selection. Top view stores and restores the prior 3D camera state. Filter changes never shuffle lots. Nothing automatically executes source code, runs tests, writes to an Obsidian vault, or uploads data.

## Contents

| File or folder | Purpose |
|---|---|
| `standalone.html` | Complete single-file offline demo |
| `index.html`, `styles.css`, `demo.bundle.js` | Same demo with local assets separated |
| `viewer.bundle.js` | Three.js + normalized model + reusable CityViewer; no demo UI |
| `embed.html` | Small integration example using the bundled viewer |
| `src/viewer.js` | Authored renderer and camera controller |
| `src/model.js` | Validation, file kinds, grouping, deterministic layout, filtering |
| `src/app.js` | Demo host UI; replace this host for Obsidian integration |
| `src/renderer-contract.d.ts` | Typed API description of the viewer boundary |
| `src/template.html`, `src/styles.css` | Editable layout and styles |
| `fixtures/` | Complete synthetic fixture, minimal import, JSON schema |
| `docs/` | Snapshot, embedding, interaction, and Obsidian handoff documents |
| `tests/`, `validation/` | Automated checks, recorded results, and limitations |
| `captures/` | Browser captures of the real WebGL demo |
| `vendor/` | Exact local library, provenance, and licenses |

## Rebuild and test

```sh
node build.mjs
node --test tests/model.test.cjs
```

The build uses Node's standard library only and verifies the vendored Three.js Git blob before emitting artifacts. The default fixture is duplicated in `fixtures/demo.snapshot.json` and `src/fixture.js`; keep them synchronized when editing it.

Browser checks require Python, Playwright, Chromium, and—on a headless Linux machine—Xvfb. These are **development/test dependencies, not runtime requirements**. The package does not install them automatically.

```sh
# On a prepared Linux test machine:
xvfb-run -a -s '-screen 0 1600x1000x24' python tests/browser.py
# Set CHROMIUM_PATH when Chromium is installed elsewhere.
```

Recorded result: **23 model tests and 37 browser checks passed**, including a 5,000-file scene, real raycasting, and real context loss/restoration. The runtime generated zero network requests in the recorded interaction run. See `validation/README.md` for how these results were obtained and what they do not prove.

## Constraints and next integration step

Import limit: 10 MiB / 10,000 files. Explorer population is capped at 600 visible rows and the table at 500; search narrows the results. More than 30 directory groups are aggregated into a visibly named overflow district. Buildings are height-capped at 18 scene units; the inspector always shows the true measurement. These are explicit demo bounds, not production-scale claims.

The app is written in dependency-light browser JavaScript for this portable demo. The production target remains **Obsidian + TypeScript + Vue 3 + Pinia + Three.js**. Keep the model and viewer boundary; replace the demo host with an ItemView, inject theme values, wire immutable snapshots to a scan coordinator, and implement the renderer lifecycle per leaf. Do not load this UMD browser bundle into the plugin's CommonJS entry unchanged; see `docs/obsidian-integration.md`.

No complexity, health, coverage, dependency, or deletion-safety claim is inferred from file size or line count. Hardware GPU performance, actual Obsidian behavior, mobile interaction, and screen-reader usability remain to be validated.

## Licensing

Authored demo code: MIT, see `LICENSE`. Three.js: MIT, full license in `vendor/THREE-LICENSE.txt`. SVG icons: Font Awesome Free by Fonticons, Inc., CC BY 4.0; full distribution terms and attribution are in `vendor/FONT-AWESOME-LICENSE.txt`. Only SVG icon shapes are included; no font files are distributed. Icons are embedded into a symbol sprite without using the Font Awesome JavaScript runtime.
