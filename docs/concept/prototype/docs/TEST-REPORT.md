# Browser validation report

**Artifact:** Codebase Inspector interactive UI prototype 1.0.0  
**Checked:** 17 September 2026  
**Dataset:** synthetic, 144 files; no repository was scanned.

## Results

| Check | Observed result |
|---|---|
| Main screens | All 15 rendered at 1600 × 1050 |
| Themes | All 15 rendered in dark and light themes |
| Interaction suite | **64 of 64 checks passed** |
| Narrow layouts | All 15 checked at 390 × 844; no document-level horizontal overflow |
| Action dispatch | No unrecognized visible action handlers on the main screens |
| JavaScript runtime | No uncaught errors observed |
| Network | No application network requests observed during the tested workflows |
| Actual exports | Markdown report and JSON review state downloaded and content checked |
| Import | Matching review-state schema accepted; unsupported schema rejected |
| Screenshots | 30 clean main-screen captures plus detail, state, and narrow-layout captures |

These observations concern the prototype, not the health or quality of any production codebase.

## Test environment and limits

Automated checks used headless Chromium with Playwright. Managed browser policy blocked navigation to `file://` and localhost addresses, so the exact self-contained HTML was injected with `page.set_content`. Canvas, DOM interactions, keyboard behavior, dialogs, real browser download events, and JSON import were exercised inside that browser.

**Not validated:** opening the local HTML through a native file manager, browser-native localStorage persistence across reload, Safari/iOS behavior, real Obsidian integration, real Three.js integration, actual filesystem permissions, fallow execution, tool-report parsing, runtime tracing, large-repository performance, screen-reader usability, or formal WCAG conformance. The application catches unavailable storage and remains usable in-session; use JSON export/import to preserve review state when storage is unavailable.

Narrow-width checks confirm responsive layout behavior, not a commitment to a mobile Obsidian plugin. The product target remains an Obsidian desktop workspace view.

The city is an explicitly labelled Canvas UI stand-in. It does not test the existing production Three.js renderer. Source connection and scan flows are explicitly simulated.

## Reproduce

The application itself has no runtime dependencies. The test harness additionally requires Python, Playwright, and a Chromium installation. The checked environment used `/usr/bin/chromium`; adapt `executable_path` in the scripts for another installation.

```sh
python build.py
python tests/test_smoke.py
python tests/test_interactions.py
python tests/capture_gallery.py
```

`capture_gallery.py` regenerates clean main-screen images after interaction tests, which also capture changed UI states. Recorded machine-readable results are in `tests/smoke-results.json` and `tests/interaction-results.json`. Test-created download fixtures in `tests/` are not production audit data.

## Interaction checks

1. PASS — Initial city renders a canvas
2. PASS — City search matches one file
3. PASS — City search supports no-result state
4. PASS — City metric controls update their legend
5. PASS — City camera controls do not throw
6. PASS — Map representation renders
7. PASS — Inventory exposes every file
8. PASS — Inventory opens accessible file inspector
9. PASS — Escape closes modal
10. PASS — Architecture node updates module inspector
11. PASS — Matrix preserves direction and evidence
12. PASS — Boundary rules are available
13. PASS — New intended rule is evaluated
14. PASS — Violations filter limits rules
15. PASS — Finding search is scoped
16. PASS — Acknowledging a finding changes open count
17. PASS — Acknowledged filter shows disposition
18. PASS — Reopening restores open count
19. PASS — Dismissal requires and records a reason
20. PASS — Test result tab displays failures
21. PASS — Missing mutation evidence is unknown
22. PASS — Package search filters inventory
23. PASS — Package detail labels fictional record
24. PASS — Dependency relationship filter works
25. PASS — License screen distinguishes unresolved status
26. PASS — Secret fixture disposition is stored
27. PASS — History window changes
28. PASS — Baseline selection changes data
29. PASS — Creating work item adds a persistent state entry
30. PASS — Verification guard rejects incomplete checklist
31. PASS — Verified status requires completed checks
32. PASS — Work-item search filters cards
33. PASS — Drag-and-drop updates work-item status
34. PASS — Audit note appears in report
35. PASS — Report content switches remove section
36. PASS — Markdown report export creates a real download
37. PASS — Export contains current reviewer note
38. PASS — Review state export has explicit schema
39. PASS — Exported review state imports successfully
40. PASS — Unsupported state schema is rejected
41. PASS — Source wizard changes metadata only
42. PASS — All four recoverable scan states render
43. PASS — Demo scan completes
44. PASS — Keyboard command palette opens a file
45. PASS — Light theme applies
46. PASS — All 15 screens render in light theme
47. PASS — Narrow layout: city has no document overflow
48. PASS — Narrow layout: overview has no document overflow
49. PASS — Narrow layout: architecture has no document overflow
50. PASS — Narrow layout: quality has no document overflow
51. PASS — Narrow layout: tests has no document overflow
52. PASS — Narrow layout: dependencies has no document overflow
53. PASS — Narrow layout: security has no document overflow
54. PASS — Narrow layout: evolution has no document overflow
55. PASS — Narrow layout: ownership has no document overflow
56. PASS — Narrow layout: workbench has no document overflow
57. PASS — Narrow layout: report has no document overflow
58. PASS — Narrow layout: sources has no document overflow
59. PASS — Narrow layout: settings has no document overflow
60. PASS — Narrow layout: file has no document overflow
61. PASS — Narrow layout: hotspots has no document overflow
62. PASS — Narrow navigation opens
63. PASS — No uncaught JavaScript errors
64. PASS — No network requests during render and interactions

## Interpretation

The test suite checks the listed happy paths, validation guards, selected empty/error states, and navigation. It is not exhaustive security, accessibility, compatibility, performance, or production acceptance testing. A production integration must connect real evidence and host services through the documented adapters and add tests against the actual repository implementation.
