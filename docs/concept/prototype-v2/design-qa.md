# Design QA — concept-style revision

**Review scope:** a working, offline Three.js interpretation of the previously supplied city concept boards, preserving the demo's evidence semantics and interactions. Not a pixel-identical recreation or native-plugin certification.

## Source and rendered evidence

- Source visual truth: `references/earlier-dependency-city-concept.png` (1672 × 941 pixels) and `references/earlier-obsidian-design-board.png`.
- Implementation: `captures/02-selected-dark.png`, 1680 × 1050 CSS/pixel viewport, deviceScaleFactor 1, selected `city-layout.ts`, default 3D view, directory coloring.
- Full-view comparison: `validation/concept-comparison.png` contains both source and implementation, each uniformly scaled with its aspect ratio preserved. No false 1:1 density or state claim: their content and intended data differ.
- Focus comparison: `validation/focused-comparison.png`, architecture/platform/tower/route regions from both images in one comparison input.
- Theme counterpart: `captures/03-selected-light.png`; `validation/theme-comparison.png`.
- Constrained layouts: `captures/09-narrow-leaf.png`, `10-narrow-city.png`, `11-small-viewport.png`.

## Required visual surfaces

| Surface | Review outcome |
|---|---|
| Typography | Uses system UI typography and monospace source paths; clear title, section, measurement, and secondary hierarchy. Does not pretend to recreate the unknown font in an image-generated board. Small auxiliary labels remain dense; test host zoom and actual themes before production. |
| Spacing/layout | Explorer, dominant city canvas, fixed right context panel, compact toolbar, and bottom camera controls are coherent. Selection does not resize the desktop canvas. Narrow inspector intentionally overlays the city and remains closeable/scrollable. |
| Colors/tokens | Navy/slate, blue-violet emphasis, varied district colors, fine borders, and corresponding light treatment follow the references. Color is directory or file type, not fabricated health. |
| Image/scene quality | Actual Three.js extruded platforms, instanced towers, shader windows, roof details, outlines, and directional route geometry replace the prior plain blocks. Icons are bundled licensed SVG assets. No rasterized city substitutes or downloaded textures. |
| Copy/content | File counts and measurements derive from the fixture. Example relationships and all decorative facade details are explicitly distinguished from analysis or runtime evidence. The original board's fictional health/risk percentages and account shell are deliberately omitted. |

## Accepted differences

The camera is orthographic and the lots are deterministic. The skyline is less irregular and cinematic than the reference board. There is no bloom post-process, animated traffic, fake risk gradient, or fake analysis dashboard. Platform lighting and softer route outlines suggest glow without requiring an endless animation loop. These are intentional implementation/scope decisions, not claims of exact fidelity.

## Review and correction history

1. Inspected initial dark/selected/light renders against the original boards; refined window pitch and brightness, route line weight, and initial framing while maintaining real geometry and exact metrics.
2. Browser recovery checks exposed a return-to-empty-city control during actual context loss; disabled that route while unavailable. Rechecked fallback and restoration.
3. Forced context restoration exposed stale GPU disposal listeners; released GPU ownership during loss, reran the dedicated regression and all 48 browser checks. Final warnings/errors: none.
4. Inspected the final combined full-view and focused comparisons, dark/light captures, and narrow inspector. No unresolved P0/P1/P2 visual or functional issue identified within this demo-review scope.

## Follow-up polish / production gaps

- Dense labels and projected labels at extreme camera angles need host zoom, accessibility, and larger-real-codebase testing.
- The 390-pixel layout is a constrained-leaf preview, not a supported mobile Obsidian product.
- Native theme variables, pop-out context migration, screen-reader review, and real GPU budgets belong to the plugin implementation.
- A production layout engine must handle varied directory sizes and explicit metric-scale choices; this scene is a bounded demonstration fixture.

## Interaction evidence

See `validation/browser-results.json` (48 passing checks), `state-results.json` (14), and `embed-results.json` (7). The final browser run used Chromium/SwiftShader and did not claim native OS file navigation or native Obsidian validation.

**final result: passed**

This result applies to the stated concept-style demo scope. It is not a production accessibility, security, performance, or native-host certification.
