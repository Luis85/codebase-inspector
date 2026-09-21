# Codebase Inspector — full interactive UI prototype

**Version:** 1.0.0  
**Design language:** English, Obsidian-style desktop workspace, dark and light themes  
**Evidence:** entirely synthetic; this is not an audit of a real repository.

## Open the prototype

Open **`index.html`** in a desktop browser. The HTML embeds all application code, styles, icons, and fixture data. It requires no npm installation, web server, CDN, fonts, or internet connection.

Open **`gallery.html`** to browse screenshots of every main screen and jump directly into the corresponding interactive view. On a phone, file preview applications may show source or a static preview rather than execute JavaScript; use an actual browser for the interactive application. Desktop use remains the intended plugin target.

The separate `codebase-inspector-full-ui.html` supplied with the delivery is identical to `index.html` and can be used without this folder.

## What is included

The app contains **15 main screens** and connected detail/state surfaces:

| Area | Screens |
|---|---|
| Explore | Overview, Code city, Architecture, Hotspots |
| Audit | Code quality, Test confidence, Dependencies, Security, Evolution, Ownership |
| Act | Refactor workbench, Audit report |
| Configure | Data & scans, Settings |
| Cross-cutting | File detail |

Additional surfaces include the file-inspector drawer, finding-review dialog, dismissal rationale, snapshot comparison, command palette, source wizard, simulated scan progress, provider evidence, rule creation and detail, work-item editing, state import, reset confirmation, help, and missing/stale/failed/empty evidence states.

## Try a complete review

1. Start in **Code city**. Search for `CostEngine`, select it, and open **Investigate file**. Search dims the city without changing the layout; selection does not reposition the camera.
2. Open a finding from **File detail**. Acknowledge it, or dismiss it with a reason. The quality screen reflects that decision. No repository suppression is written.
3. Visit **Architecture**. Select a module, switch to the dependency matrix, and inspect the Domain → Storage cell. Add an intended boundary rule to evaluate against the sample graph.
4. Add a work item. In **Refactor workbench**, drag it between columns or edit its status. The Verified state requires all verification checks.
5. Edit the reviewer note and included sections in **Audit report**. Export an actual Markdown file.

## Working interactions

The city supports rotation, pan, zoom, explicit focus, reset, selection, color and height metrics, module filters, a map representation, and a keyboard-accessible inventory. All screens share file identities and two deterministic evidence snapshots.

Other working interactions include finding search/type/severity/status filters; finding disposition; module and matrix inspection; boundary-rule creation; coverage inspection; package search and relationship filters; fictional advisory inspection; history-window selection; refactor creation/edit/delete/drag/drop; report composition; Markdown/CSV/JSON export; validated state import; theme/density/accessibility settings; and keyboard search.

Preferences, work items, review decisions, custom rules, and report notes are stored in browser `localStorage` **when available**. If browser policy blocks storage, the current session still works; use **Data & scans → Export state** to keep review decisions. Persistence for local-file origins can vary by browser and policy. Import only the provided prototype review-state schema, not native tool reports.

## Important implementation boundary

**This is a UI prototype for an Obsidian desktop plugin, not a new standalone production application.** The surrounding workspace is simulated. No Obsidian API is called and no plugin files have been modified.

**The city renderer in this artifact is a dependency-free projected Canvas renderer. It is not the existing Three.js implementation.** It exists so the complete UI can be reviewed as one offline HTML file. Preserve the existing production Three.js decision and reuse that implementation through the renderer adapter described in `docs/IMPLEMENTATION-HANDOFF.md` and `docs/contracts.ts`.

The city’s curved connections are illustrative. The separate architecture graph represents the authoritative *sample* module-edge fixture. Do not derive actual dependency claims from the decorative city arcs.

## What is simulated or not implemented

Source paths in the setup wizard are labels, not filesystem access grants. “Run demo scan” is explicitly simulated. No real repository scanning, executable discovery, fallow execution, report parsing, Obsidian integration, runtime tracing, or package-registry/advisory lookup occurs. The sample `@sample/*` packages, versions, secret pattern, and `DEMO-ADV-*` advisories are fictional.

Mutation-test and runtime evidence are shown as **unknown**, not as zero or passing. All displayed source excerpts are synthetic. No source edits, deletes, dependency installations, automatic fixes, or automatic scans occur.

## Files

- `index.html`: self-contained interactive application.
- `gallery.html`: screenshot gallery with direct screen links.
- `src/`: editable CSS and JavaScript, separated by data, components, city rendering, and application behavior.
- `docs/SCREEN-SPECIFICATION.md`: each main screen, interactions, states, and image references.
- `docs/IMPLEMENTATION-HANDOFF.md`: production integration boundaries and sequence.
- `docs/contracts.ts`: proposed renderer/evidence contracts to reconcile with the existing implementation.
- `docs/TEST-REPORT.md`: actual checks and test-environment limitations.
- `screenshots/`: main screens in both themes, dialogs/subviews, and narrow-layout examples.
- `examples/`: valid prototype evidence and review-state exports.
- `tests/`: browser test scripts and recorded results.
- `build.py`: regenerate the single-file HTML after editing `src/`.

## Rebuild

Run `python build.py` from this folder. The build only uses the Python standard library. No JavaScript packages are required. The build also writes a standalone HTML beside the project folder.

## Validation

All 15 routes were rendered in Chromium, in both themes; all main routes were also checked at a narrow 390 × 844 viewport. A 64-check interaction suite passed, including real browser download events, import validation, keyboard search, triage changes, and work-item verification guards. No uncaught JavaScript errors or application network requests were observed.

The environment's managed Chromium blocked `file://` and localhost URL navigation, so browser testing injected the exact HTML with `page.set_content`. Direct local-file launching, native storage persistence across reload, Safari/iOS behavior, assistive-technology use, and real Obsidian integration were **not** validated. See the test report for the precise scope.
