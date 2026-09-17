# Validation — concept-city revision 3.0

Validation performed on 2026-09-17 against the built, self-contained HTML and separate viewer bundle. These checks validate the interaction demo, not a production Obsidian plugin.

## Recorded results

| Suite | Result | Evidence |
|---|---:|---|
| Pure state | 14 passed | `state-results.json`; `../tests/state-check.cjs` |
| Main demo browser checks | 48 passed | `browser-results.json`; `../tests/browser-check.py` |
| Independent embedding | 7 passed | `embed-results.json`; `../tests/embed-check.py` |
| Context-resource regression | Passed | `context-results.json`; `../tests/context-check.py` |

The complete names of the 48 browser checks are in the JSON receipt. Tested behaviors include real WebGL2 initialization and raycasting, selection versus focus, top-camera restoration, search without relayout, directional sample links, mini-map focus, light/dark themes, HTML fallback, narrow layouts, refresh cancellation, stale-result rejection, actual context loss/restoration, stable geometry counts over repeated link rebuilds, and disposal.

No runtime network requests, JavaScript errors, shader compilation errors, or graphics warnings were recorded in the final main-demo run. The only console messages were Three.js's informational context-lost/context-restored messages from the intentional recovery test. The independent embed produced no console messages.

## Environment and method

- Chromium 144.0.7559.96; Linux; Xvfb; ANGLE SwiftShader; actual WebGL2 API.
- Main screenshots: 1680 × 1050 CSS pixels at deviceScaleFactor 1.
- Constrained layouts: 700 × 900 and 390 × 844 CSS pixels.
- Independent host: 1280 × 900 CSS pixels.
- The environment blocks direct `file://` navigation. The main HTML was loaded using Playwright `set_content`, without altering its restrictive Content Security Policy or adding external dependencies.
- The separate embedding test locally resolves the three script files into the independent host document before injection. This proves the host uses the public viewer bundle rather than the complete demo interface.
- This is software GPU testing. Draw counts are diagnostics, not hardware performance guarantees.

## Issue corrected during validation

The initial forced-context-loss test recovered visually but produced GPU deletion warnings when stale disposal listeners retained the previous context. The renderer now releases GPU-side ownership during the lost-context event while retaining CPU-side geometry; resources are uploaded again on restoration. A dedicated regression check and the complete interaction suite then passed without warnings. The final delivered files include that correction.

## Remaining validation limits

Native operating-system double-click loading, actual download completion, native Obsidian lifecycle/pop-out migration, other browser engines, physical GPUs, touch hardware, assistive technologies, and arbitrary user themes were not verified here. The fixed fixture is not an arbitrary-scale layout benchmark. No live filesystem, fallow, compiler, or test-runner integration exists in this demo.

Geometric allocations returning to baseline is not a comprehensive browser/GPU heap leak proof. PNG creation is tested; the browser-generated download's final location on a user's device is not.

## Visual evidence

`../captures/` contains 12 screenshots of the actual rendered application and independent viewer. `concept-comparison.png` and `focused-comparison.png` place the original visual reference and actual implementation in the same image. `theme-comparison.png` presents corresponding dark/light states. The comparison is qualitative: the original boards contain illustrative content and are not exact screen specifications. See `../design-qa.md`.
