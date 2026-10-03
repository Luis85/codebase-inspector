# Review script and validation boundaries

## Open the reference

Open `index.html` in a desktop browser. It is a self-contained HTML file with no runtime network dependency. The archive also includes the editable sources. A host policy can block local-file navigation; this environment used Playwright `set_content` with the same HTML bytes for capture rather than a file URL. The file can also be served through ordinary local development tooling outside Obsidian; no server is part of the plugin architecture.

The source and scan controls are explicitly simulated. No repository path is opened. The “Sibling note” text is not saved to a vault. The renderer uses Canvas 2D projection, not Three.js/WebGL. This is an interaction review, not product installation.

## Ten-minute walkthrough

1. Select `city-layout.ts` in `src/visualization`. Confirm the exact relative path and 342 physical lines. The camera should not move merely because the inspector opens. Use Focus in city and compare the explicit framing change.
2. Close Details, then reopen it. Confirm the same selected file remains. Search for `snapshot`; the selected file remains inspectable while a search-mismatch explanation appears.
3. Press Escape while search is focused. Only the query clears. Focus the canvas and press Escape: only selection clears. Select the file again and open Sibling note. Type `/`, `f`, and `t`, then press Escape in the note. None should navigate the city.
4. Orbit, pan, and zoom. Use Top, pan in top view, and return to 3D. The earlier 3D pose must return. Repeat navigation through the camera-help buttons and canvas keys.
5. Search for `ÜBER`; select the non-ASCII fixture path. Search for a nonexistent path; observe zero matches without losing the snapshot or selected file.
6. Open Review scan. Tab through the modal and dismiss with Escape. Confirm focus returns to the trigger. Reopen and confirm that consent has reset.
7. Start a simulated scan, then cancel. Wait for the simulated run's old timer callbacks. The previous snapshot remains current. Run the failed-refresh scenario and compare its message with cancellation.
8. Use Test 3D fallback. The HTML table retains every included file and exact measurements. Search/select through it. This is a simulated renderer failure, not a real WebGL context-loss test.
9. Resize the window and toggle Sibling note to constrain the leaf. Close the details drawer with Escape while inside it; the selected file remains, and focus returns to Details.
10. Preview light/dark themes. Selection, query, camera, and snapshot identity remain unchanged. The theme selector is review-only; the production plugin follows Obsidian's theme.

Ask reviewers to explain what building height means, what the scan control actually did, and how they would inspect a file without using 3D. Record observations rather than asking whether they “like” the design. No user-study results are supplied in this package.

## Completed checks

See `validation/model-test-results.tap` and `validation/browser-results.json` for executable results and test names. The current run contains 31 passing state tests and 28 passing headless Chromium checks. Those counts refer to this reference only. Twelve current-run screenshots capture selected review states. Syntax and artifact checks are recorded separately.

Browser checks cover identity-preserving selection, context-scoped keys, source-modal focus, search/no-result semantics, camera bookmark behavior, simulated scan publication, clipping at selected viewport sizes, fallback table retention, clipboard failure, and idle render scheduling. A basic button-label check is not an accessibility audit. The observed absence of network requests applies to the reference page during these tests.

## Outstanding production gates

| Area | Evidence still required |
|---|---|
| Three.js | Actual renderer loads; InstancedMesh picking; bounds; resource disposal; GPU/context-loss recovery; documented scale benchmark |
| Obsidian | Clean-vault installation; real ItemView lifecycle; split leaves; host command routing; pop-out migration; disable/re-enable |
| Inventory | Actual paths; scope confinement; ignored/generated files; symlink behavior; non-ASCII Windows paths; cancellation; partial reads; no unintended source writes |
| Authorization | Actual approval fingerprints; root changes; machine-local external bindings; no run on restore |
| Accessibility | Screen-reader testing, focus order/visibility, zoom, custom themes, reduced motion, non-drag equivalence in the actual host |
| UX | Maintainer/new-contributor reviews; comprehension of physical lines versus complexity; first-run success; narrow-leaf task completion |
| Performance | Real-codebase load/interaction measurements with hardware and application versions documented |
| Persistence | Workspace restoration, profile/snapshot reconciliation, missing selected file, stale/unbound source, snapshot retention |

Do not merge browser checks and future host gates into a single misleading “all tests passed” claim. The view is ready for implementation review, not certified for release.
