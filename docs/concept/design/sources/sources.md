# Source register

Reviewed 17 September 2026. Product behavior described as “must,” “should,” or “proposed” is a design decision unless explicitly attributed below. Screens contain synthetic data and are not evidence about the user’s codebase. Current provider/version compatibility still needs to be verified in implementation.

| ID | Primary source | What it grounds |
|---|---|---|
| S1 | [Obsidian — custom views](https://github.com/obsidianmd/obsidian-developer-docs/blob/main/en/Plugins/User%20interface/Views.md) | ItemView, registration, lifecycle and multiple view instances; source content was present in the preceding project discussion |
| S2 | [Obsidian — Colors](https://docs.obsidian.md/Reference/CSS%20variables/Foundations/Colors) | Host semantic surface/text/action variables; theme-owned palette; current color representation guidance |
| S3 | [Obsidian — Pop-out windows](https://docs.obsidian.md/plugins/guides/pop-out-windows) | Owning window/document, cross-window handling, renderer migration |
| S4 | [Obsidian — Developer policies](https://docs.obsidian.md/community-directory/developer-policies) | No dependency auto-install/update; external-file/network disclosures; client telemetry policy |
| S5 | [W3C — Contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | Normal and large-text contrast criteria |
| S6 | [W3C — Non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | Meaningful controls/graphics contrast |
| S7 | [W3C — Target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 24 CSS px criterion and exceptions; larger project design defaults remain recommendations |
| S8 | [W3C — Dragging movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements) | Non-drag single-pointer alternative requirement |
| S9 | [WAI-ARIA APG — Modal dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | Dialog focus, keyboard and semantic guidance |
| S10 | [Three.js — OrbitControls](https://threejs.org/docs/pages/OrbitControls.html) | Orbit/pan/dolly primitives, configurable inputs and lifecycle |
| S11 | [fallow — health CLI](https://docs.fallow.tools/cli/health) | Thresholded complexity findings and different optional evidence sections |
| S12 | [WAI-ARIA APG — Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) | Accessible tab semantics and keyboard handling when true tab patterns are used |

The actual production minimum Obsidian version, Three.js version, and supported fallow report versions are intentionally not invented in this design pack. Select and verify them in the implementation repository. A design concern such as “keep selection stable on theme change” is a proposed acceptance condition, not a claim the host implements it for the plugin.

## Input documents

The existing `codebase-inspector-obsidian-implementation-kit` and its WP-01 native-city specification, supplied earlier in this conversation, establish the 12 implementation packages and the plugin-first architecture. This design package is a companion, not a rewrite of their safety and data contracts.

## Non-evidence

No interviews, analytics, user testing, production screenshots, actual code scans, Figma source, or compiled plugin were supplied or produced as research evidence. The role/job model and usability targets are hypotheses. The prototype is locally authored and uses a synthetic 144-file fixture; its city is an SVG stand-in, not a Three.js implementation.
