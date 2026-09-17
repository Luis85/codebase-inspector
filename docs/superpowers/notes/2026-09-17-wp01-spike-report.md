# WP-01 spike report

Date: 2026-09-17   Obsidian version: 1.13.7   Electron: 39.6.0   Chrome: 142.0.7444.265

## Verdict on the load-bearing question

window.require('node:original-fs'): PASS — `CI-SPIKE: window.require node:original-fs OK — 42 entries, first=".cursor"`
window.require('node:path'):        PASS — same log line as above. The probe has no separate log line for `node:path`; it calls `path.join('C:', 'Projects')` to build the argument passed to `fs.readdirSync`, so a successful `OK` result with real directory entries implies both `require('node:original-fs')` and `require('node:path')` resolved and worked. There is no second `CI-SPIKE:` line to quote for `node:path` specifically — its success is embedded in the one line above.
Static `import * as fs from 'fs'`:       real module — `CI-SPIKE: static import 'fs' = object, readdirSync = function`
Static `import * as fs from 'node:fs'`:  real module — `CI-SPIKE: static import 'node:fs' = object, readdirSync = function`

**Consequence for task 5:** The load-bearing question is answered **yes**: `window.require` resolves Node built-ins at runtime inside the bundled Obsidian plugin, so the §3.1 design — routing all Node access through `src/adapters/filesystem/node-access.ts` via `window.require` with `node:`-prefixed specifiers, guarded by `Platform.isDesktopApp` — stands unchanged. What the spike overturns is the *predicted failure mode* of the alternative, not the design decision itself: §3.1's inference was that Obsidian's injected `require` returns `null` for Node built-ins, but a **static** `import * as fs from 'fs'` (and the `node:fs` form) did not fail, return `null`, or throw — it silently resolved to a real module object with a working `readdirSync`. That means a static import of a Node built-in would pass a runtime smoke test and produce no observable symptom at all; it is caught only by the `no-nodejs-modules` lint rule at build time, never by anything a developer would notice at runtime. The other two reasons the design gives for routing through `window.require` with `node:original-fs` are untouched by this finding: the lint rule enforcement itself, and the fact that `node:original-fs` is unpatched while Electron's plain `fs` is asar-aware (a distinction a static import bypasses entirely regardless of whether it resolves).

## Bundle shape

dist/ contents:
```
main.js
manifest.json
styles.css
```
main.js bytes: 624679  (BASELINE BUDGET)

CommonJS: yes    new Function(: 0    eval(: 0    THREE_CJS_DEPRECATED: 0

**Toolchain version caveat:** the spike's `package.json` pinned no exact devDependency versions beyond `three@0.186.0`, so `npm install` resolved current-latest ranges: **vite 8.3.0**, **@vitejs/plugin-vue 6.0.9**, **typescript 7.0.2**, **pinia 4.0.3**, **obsidian 1.13.1** — while the WP-01 plan pins **vite ^5.4**, **@vitejs/plugin-vue ^5.1**, **typescript ^5.6** and **pinia ^2.2**. This bundle-shape evidence (CommonJS output, absence of `new Function(`/`eval(`/`THREE_CJS_DEPRECATED`, the 624,679-byte size) was produced by Vite 8, not by the Vite 5 line task 1 will actually build with, and should be treated as directionally informative rather than a guaranteed reproduction. One concrete version-specific symptom: Vite 8's build emitted a deprecation warning that `rollupOptions.output.inlineDynamicImports` (which both the spike's and the plan's `vite.config.ts` use, per the Global Constraints table) is deprecated in favour of `codeSplitting: false`. The pinned Vite 5 line does not raise this deprecation notice — it is new in Vite 8 — so task 1 should not expect to see it, and should not treat its absence there as a sign of misconfiguration.

## Probes

ItemView registered / opened: PASS — `registerView('ci-spike-view', ...)` succeeded; clicking the ribbon icon opened the view with no console error.
Vue SFC + scoped style: PASS — user confirmed "the styles and controls and clicking does work"; the probe box rendered with its dark (`#2a2a2a`) background and a `data-v-` scoping attribute, consistent with Vue's scoped-style mechanism working inside the bundle.
Pinia: PASS — the button read "clicked 4" after four clicks, confirming the `useSpikeStore().bump()` action and reactive `count` both work through the bundled Pinia instance.
Three.js InstancedMesh 1000 + OrbitControls: PASS (rendered and orbits) — `CI-SPIKE: three InstancedMesh 1000 boxes drawn, OrbitControls attached` logged, and the user confirmed dragging rotates the scene. Visually, the 1,000 boxes rendered as a flat plate (all instances are `BoxGeometry(1,1,1)` translated to `y = 0.5`, which is the expected/intended layout, not a defect) — see "Anything unexpected" below for a separate, real lighting/exposure issue observed in the same render.
Two disable/enable cycles: PASS, no console error — each cycle re-emitted the `THREE.WARNING` (see below) and the full set of `CI-SPIKE:` lines; no error was logged on either cycle.

## Cheap answers to open questions (§11)

styles.css auto-injected with no loader code: yes — `main.ts` contains no CSS import or injection call, and the probe box's `#2a2a2a` background was applied, confirming Obsidian's plugin loader auto-injects a plugin's `styles.css` without any code in `main.ts` needing to request it.
vault.getFiles() returns .ts entries: yes (count: 6300) — the dev vault (`renovation-planner`) is a working checkout, so this count very likely includes files under `node_modules` or similar dependency trees; that inclusion is a plausible explanation for a count this large, not a measured fact, since which paths contributed to the 6,300 was not inspected.

## Anything unexpected

**`THREE.WARNING: Multiple instances of Three.js being imported`, on every enable cycle.** This warning appeared each time the plugin was enabled, including on both of the two disable/enable cycles run for the gating checklist. The likely mechanism: Three.js sets a marker on `globalThis` the first time its module initialises, as a guard against exactly this situation; Obsidian tears down a disabled plugin's module scope on disable, but does not clear that global marker, so the next `onload` re-initialises Three.js's module code and sees a marker already present from the "previous" instance — which is actually itself. In other words, it is one instance re-initialising, and the warning's literal claim (multiple instances) is false in this case. It did not fail any gating line — it is a console warning, not an error, and every gating line that depended on "no console error" still passed. It is flagged here because it will recur on every re-enable of the real plugin and, most likely, on every hot-reload during development, which is relevant to task 11 (lifecycle) and worth a mention in task 13 (limitations) so a future user or reviewer does not mistake it for a real double-bundling defect.

**Two `[Violation]` performance notices: a 160 ms `'click'` handler and a 37 ms forced reflow.** Both fired from the ribbon-icon click that opens the view, which synchronously creates a `WebGLRenderer`, builds a 1,000-instance mesh, and renders a frame, all inside one click handler. This is an expected consequence of the probe's simple, synchronous shape and is not itself a defect in the spike — but it is a direct warning to the real renderer's implementation: `onOpen()` (or whatever triggers WebGL context creation and first render) must not do this work synchronously inside a click handler if it wants to avoid the same violation at real scale, which will be worse than 1,000 boxes.

**The render came out blown-out white with no visible shading.** The scene uses a default (white) `MeshStandardMaterial`, an `AmbientLight(0xffffff, 0.6 * Math.PI)` (≈ 1.885) and a `DirectionalLight(0xffffff, 1.2 * Math.PI)` (≈ 3.77). The `* Math.PI` multiplication is the correct r155/r165 conversion of the pre-r155 base values `0.6` and `1.2` (per the design's global constraints, lighting values authored before r155 must be scaled by π to remain physically equivalent) — the math is not in question. What the spike's visual result shows is that those particular pre-r155 base values, once converted, saturate a plain white `MeshStandardMaterial` at this scale, producing a flat, shading-less white render rather than a recognisable lit scene. This is recorded here strictly as an observation for task 10, which owns the real lighting design — it is explicitly **not** a recommended intensity value, and no correction is proposed here. A wrong lighting value of this kind produces no error and no failing test, so it can only be caught by looking at the render, which is exactly what happened here.
