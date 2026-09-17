# Decisions and traceability — WP-01 refinement

These are implementation defaults proposed in this continuation, not a record of a user approval meeting. They preserve the existing visual direction and the requirement to build a native Obsidian plugin with Three.js.

| ID | Decision | Why it resolves ambiguity | Reference evidence / future gate |
|---|---|---|---|
| D01 | Select and Focus are separate | Prevents accidental camera travel while reading a list | State tests; B02/B08; actual Three framing still required |
| D02 | Empty canvas click is a no-op | Removes accidental loss of context after navigating | Renderer click classification; production picking gate |
| D03 | Close inspector preserves selection | Panel visibility is not data selection | B03 |
| D04 | Search dims without relocating lots | Keeps spatial identity stable while narrowing attention | B04/B25 |
| D05 | Selected nonmatch remains inspectable | Avoids silent disappearance when refining a query | B04/B18 |
| D06 | Escape belongs to the focused context | Prevents conflicts with Obsidian and sibling notes | B05/B06/B12/B13/B26; real host gate remains |
| D07 | Store complete 3D bookmark for top-view return | Top-view exploration must not destroy a previous viewpoint | B07; production bookmark integration required |
| D08 | Fit city always means entire current inventory | Removes uncertainty between filtered results and the full city | State test + B08; keep explicit label |
| D09 | Refresh keeps a compatible previous snapshot | Progress/failure is distinct from codebase evidence | B15/B16/B17; real profile/scope guards remain |
| D10 | Cancel invalidates publication immediately | Prevents late asynchronous results from reappearing | Run-ID tests + B15; real worker stop still required |
| D11 | HTML inventory is a first-class path | Core information must not require graphics or dragging | B11; real context loss/accessibility remain |
| D12 | Responsive behavior is measured on the leaf | A wide desktop may contain a very narrow plugin pane | Container styles/B12/B24; real split-leaf gate |
| D13 | Review controls never become product navigation | Avoids leaking synthetic states and an independent theme UI | IP-08 distribution review |
| D14 | Defer double-click focus | Reduces conflicting gesture handling in the first release | Explicit button/Enter equivalent already exists |
| D15 | No Three.js implementation is claimed here | Dependency fetch was unavailable; a contract is not a running integration | Sources/limits; adapter declaration only |

## Corrections made during review

The earlier all-package SVG prototype used document-level keyboard handling and broad re-render paths. The new WP-01 reference scopes input to the plugin region, preserves the active file control during selection, keeps camera bookmarks separate, and uses modal-specific return focus. The original prototype has not been rewritten globally; it remains a later-capability visual fixture, not the updated behavior source.

The new browser run initially revealed a scope-modal focus-cycle failure in the reference and an incorrect test expectation for the fixture's full path. An explicit boundary-cycle handler was added to the modal; the path expectation now matches `src/visualization/layout/city-layout.ts`. The fixture category `Test` was also reconciled with the Tests legend color. Final results are saved after rerunning the suite.

## Screen linkage

| Earlier screens | New reference/capture | Scope |
|---|---|---|
| S02–S04 | 08 scope review + simulated running state | Review interaction; no real picker, root validation, or scan |
| S05–S07 | 01 city, 02 selected, 11 light theme | Structural presentation/selection |
| S08 + S23 | 03 selected outside search; empty/non-ASCII test cases | Path filtering and preserved selection |
| S09 | 05 top-down | Camera-mode return behavior |
| S10 | 07 narrow drawer, 12 constrained leaf | Responsive controls and focus |
| S11 | 06 HTML fallback | Equivalent inventory under simulated rendering failure |
| S12 | 09 cancelled, 10 failed refresh | Last-valid-snapshot retention |
| Host integration | 04 sibling note | Local keyboard ownership; host is simulated |

The first-run screen and production settings are still specified in S01 and S13. The new reference does not replace every screen or implement every state. Later-release screens S14 onward stay assigned to their original packages.
