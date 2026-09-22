---
project: codebase-inspector
title: WP-02 — Inspector UI, Part 4: Refactor workbench, Audit report, Data & scans, Settings (design)
status: draft, awaiting approval
date: 2026-09-22
branch: feat/wp-02-part4 (from feat/wp-01-codebase-city at 08cb58f). Not stacked: fast-forwarded into feat/wp-01-codebase-city, so it lands on PR #1.
baseline: 08cb58f
---

# WP-02 design — Inspector UI, Part 4

The Part 1 spec (`2026-09-21-inspector-ui-shell-design.md`, §9 A1–A13), the Part 2 spec
(`2026-09-21-inspector-ui-part2-design.md`, P1–P14; P14 supersedes A1) and the Part 3 spec
(`2026-09-21-inspector-ui-part3-design.md`, Q1–Q17) are binding. The Part 3 ledger
(`notes/2026-09-21-wp02-part3-ledger.md`, R1–R9, E1–E55) is precedent. This document
records only what Part 4 adds: the four remaining screens (Refactor workbench, Audit
report, Data & scans, Settings), the Work-item editor, and the Part 3 E55 cleanup.

## 1. Decisions

| # | Question | Decision |
|---|---|---|
| W1 | What persists? | **Nothing new.** Work-item edits, report section choices and the reviewer note, and the display density all live in the leaf's Pinia stores, in memory. They are lost when the leaf closes or Obsidian reloads. Durable review history is WP-05 (Q8). No plugin-data key is added and nothing is written to the vault. The screens say this where it matters ("Kept in this session only"). |
| W2 | Real provider or scan behaviour? | **None new.** Every non-inventory signal stays sample or unknown, labelled. Data & scans reuses the two host callbacks the UI already injects: `onSelectCodebase` (the host's real source and scope modals) and `onScanRequested` (the real rescan the city toolbar already uses). It shows the real run state (`run-store`) and the real scope of the snapshot on screen (`snapshot.scope`, collected). There is no simulated scan, no fake progress bar, no stale/failed "demo state" buttons and no fallow adapter. |
| W3 | Where do scan states show? | On the city route, as today (A8, P14). "Change source" and "Rescan" on Data & scans navigate to `city` first, then call the callback, exactly like `NoSnapshot`. Data & scans shows the outcome of the last run (idle; running with a processed-file count and an unknown total; cancelling; cancelled; failed with its message; complete) and the snapshot's completeness. Cancelling stays the host's "Cancel scan" command: `city-view.ts` (399/400) cannot provide a cancel callback, so the copy names the command. |
| W4 | Source wizard and scan-progress dialogs | **Not rebuilt in Vue.** The host's Obsidian modals are the source wizard (vault / vault folder / external, then scope approval). A Vue copy would duplicate the consent chain, which the handoff forbids. The live run panel replaces the progress dialog. |
| W5 | Settings vs Obsidian's settings tab | Obsidian's plugin settings tab stays the **only** place that edits codebase profiles, exclusions, the file-size limit and folder bindings. The in-leaf Settings screen never edits them. It (a) says where they are edited and links to Data & scans, which shows the values the snapshot on screen was actually scanned with; (b) holds the one real leaf preference, **information density** (comfortable / compact, in memory, W1); (c) states the fixed policies: the theme follows Obsidian, source access is read-only, there are no network requests and no tools run, and the hotspot threshold is 65, explained by the priority formula dialog. "Open file inventory" navigates to the city in list mode. |
| W6 | Report export | **Markdown through `downloadText` only** (`codebase-audit-report.md`, `text/markdown`). Nothing is written to the vault. Every sample value is written with "(sample)"; an unknown value is written as "unknown (reason)", never 0. There is no Print action: printing a leaf prints the whole Obsidian window. |
| W7 | Report content | Composed from the existing read models, never new numbers: source and snapshot metadata (collected); executive summary (file and line counts plus Overview's cards); architecture (Architecture's cards and the user's own boundary rules); hotspots (the top 5 by sample priority); security (Security's cards: fictional advisories, with secrets and runtime unknown); refactor plan (the real work items); the reviewer note; a fixed limitations section. There is no composite score and no verdict. The paper carries an "Includes sample data" badge instead of the prototype's "Demo report". Five sections can be toggled (summary, architecture, hotspots, security, plan). The metadata, note and limitations are always included. |
| W8 | Work-item fields | `WorkItem` gains `priority: 'high' \| 'medium' \| 'low'`, `notes: string` (≤ 5000) and `checks: readonly [boolean, boolean, boolean]`. There is **no team or owner field** (Q11: no per-person data; a team label would be sample). The target and intent are fixed after creation, because `(target, intent)` is the identity (Q4). New items get `medium`, empty notes and no checks. Notes are never prefilled with sample numbers, so user text never carries an unlabelled sample value. |
| W9 | Work-item editing | `review-store.updateWorkItem(id, patch, now)` is pending-aware per id and persists before mutating (the existing pattern). It refuses (null) an empty or over-long title (1–160 after trimming), notes over 5000 characters, and **`verified` unless all three checks are done**, in the store as well as the dialog. `removeWorkItem` becomes pending-aware too. |
| W10 | Board interactions | **No drag and drop**: it is pointer-only, and the editor's status select is the accessible equivalent the prototype names. The board shows four status columns (Investigate, Planned, In progress, Verified), and each card is a button that opens the editor. A Board / List toggle (`aria-pressed` buttons) switches to an `EvidenceTable`. A text filter matches title, target and notes. |
| W11 | Creating work items | "New work item" plans work for the **selected file** (the city-store selection). Without a file selection the button is `aria-disabled` with a visible hint ("Select a file in the city, a table or the command palette first."). The editor's create mode offers the file intents (refactor, tests, documentation) and refuses a duplicate `(target, intent)` inline. Package and module items are still created from Dependencies, Security and Ownership. |
| W12 | Delete | Delete sits in the editor's footer. It asks for confirmation inline (a second "Delete work item" button plus "Keep it"), not in a nested dialog. A deleted item is gone for the session. |
| W13 | Nav badge | The Refactor workbench badge counts items **not yet verified** (the prototype's rule), through a new `openWorkItemCount` getter. |
| W14 | Review-state export and clearing | Settings › Privacy & storage has **Export review state** and **Clear review state**. Export is JSON through `downloadText`, schema `codebase-inspector.review-state.v1`: work items (each target as a relative path, never a raw entity id), rules, dispositions, the report choices and the note. Clear asks for confirmation in a `CiDialog`, removes everything through the port, then clears the stores. **Import is deferred to WP-05**: without persistence it would only restore into one session, and validating untrusted JSON belongs with the durable adapter. |
| W15 | Provider cards on Data & scans | One card per evidence family. File inventory is collected (or partial). Static findings, Module import graph, Change history, Coverage and test runs, and Packages and advisories are sample ("Sample provider" / "Fictional packages"). Secret scanning and Runtime & mutation are unknown ("Not collected"). Each card lists the screens that use it as navigation buttons. There is no per-card "evidence envelope" dialog: the state chip and the text carry the provenance. A "Planned integrations" panel says, as text only, that an external analyser will only ever be run or imported on explicit request and never installed. |
| W16 | Provenance badge | `use-route-provenance` gains `report` (true whenever a snapshot is shown). It returns `false` explicitly for `workbench`, `sources` and `settings`: they show user records, scope facts and states, not sample values. |
| W17 | Placeholders | Every route is now built, so `PlaceholderScreen.vue` and `PLACEHOLDER_ARRIVES` are deleted. `RouteMeta.part` stays as a record of delivery. |

## 2. Screens

Every screen has a `PageHeader` with eyebrow `<Group> / <Screen>` and the prototype's
title and subtitle. A screen with outcomes to announce (exports, saves, clears) has a
`role="status"` live region. Data & scans has none: its actions leave for the city. Screens that need a snapshot show
`NoSnapshot` without one: Report does, and so does the scope panel of Data & scans.
Workbench and Settings do not need one.

- **Refactor workbench** (`WorkbenchScreen.vue` + `workbench/*`):
  - Actions: Export plan (Markdown, `refactor-plan.md`) and New work item (W11).
  - Cards: Work items (collected, caption "Kept in this session only"), Under investigation, In progress, and Verified (caption "All three checks completed").
  - A toolbar with the filter and the Board / List toggle.
  - `WorkBoard`: four columns with a count each. A card shows the id, a priority chip, the title, the target name, the intent and `n/3` checks.
  - `WorkList`: an EvidenceTable of id and title, target, intent, status, priority and checks.
  - With no items, an empty state: "No work items yet. Add them from File detail, Code quality, Test confidence, Dependencies, Security or Ownership."
  - Footnote: "Statuses record your plan. Nothing here changes source code."
- **Work-item editor** (`WorkItemEditor.vue`, `CiDialog`), for create or edit:
  - Fields: title, priority, status, intent (create only), target (read-only) and notes.
  - The three-item checklist: "Characterize existing behaviour and define a safe boundary", "Implement the agreed change and keep compatibility", "Run regression tests and review the evidence".
  - The hint "Verified needs all three checks. Changing a status never changes source code."
  - Errors are inline `role="alert"`.
  - Footer: Delete (edit only, W12), Cancel, and Save / Create.
  - Save and delete close the dialog, and the screen announces the outcome. Only a non-null store result is announced (E17).
- **Audit report** (`ReportScreen.vue` + `report/*`):
  - Action: Export Markdown (W6).
  - Left: `ReportPaper` (W7), an `article` with `h3` sections numbered in order of inclusion.
  - Right:
    - "Report contents": five checkboxes.
    - "Reviewer note": a textarea plus Apply note. The note is applied, not live, like the prototype.
    - A warning `Callout`: "This is an illustrative review built partly from sample data. It is not a security certification or an audit of your repository."
  - Choices and note sit in a `report-store` (W1).
- **Data & scans** (`SourcesScreen.vue` + `sources/*`):
  - Actions: Change source and Rescan (W3). Rescan is `aria-disabled` while a run is in flight.
  - A Callout: "One real provider is connected: the built-in read-only inventory. Every other signal is sample data or not collected."
  - Panels:
    - Active source, all collected: the root folder label and path, exclusions, the file-size limit, symbolic links not followed, the capture time, and completeness with the skipped-file count. The note "Edit profiles, exclusions and limits in Obsidian's settings for Codebase Inspector."
    - Scan status (W3).
    - The provider grid (W15).
    - Planned integrations.
  - Without a snapshot, the scope panel shows `NoSnapshot`, while the status and provider panels still render.
- **Settings** (`SettingsScreen.vue` + `settings/*`):
  - Action: Export review state (W14).
  - `Tabs`:
    - Appearance: the theme ("Follows Obsidian") and the density select.
    - Analysis & scope:
      - hotspot threshold 65, with "How priority works" opening `PriorityFormulaDialog`;
      - source access "Read-only";
      - "Profiles, exclusions and limits are edited in Obsidian's settings", with "View current scope" going to `sources`.
    - Accessibility:
      - reduced motion follows the system, and the city never moves the camera on selection;
      - "Open file inventory";
      - a list of keyboard shortcuts.
    - Privacy & storage: no network requests; review state in memory only; Export review state; Clear review state….
    - About: what the plugin reads, never changes and never runs.

## 3. Units

| Unit | Responsibility |
|---|---|
| `stores/ports/review-repository.ts` | `WorkPriority`, `WorkChecks`, the three new `WorkItem` fields, limits (`WORK_TITLE_MAX`, `WORK_NOTES_MAX`) |
| `stores/review-store.ts` | `updateWorkItem`, pending-aware `removeWorkItem`, `clearAll`, `openWorkItemCount`, `addWorkItem` options |
| `stores/report-store.ts` | report sections and the applied note (W1) |
| `stores/preferences-store.ts` | `density` (A2's deferred preferences store) |
| `read-models/work-items.ts` | `workTargetLabel`, `buildWorkbenchModel(items, files, query)`, `planMarkdown` |
| `read-models/report.ts` | `buildReportModel(...)`, `reportMarkdown(model, sections, note)` |
| `read-models/sources.ts` | `buildSourcesModel(snapshot, run)`: scope rows, run status, provider cards |
| `read-models/review-state.ts` | `reviewStateJson(...)` (W14) |
| `export/markdown.ts` | `mdText`, `mdCell`, `mdValue` (sample and unknown spelled out) |
| `export/use-csv-export.ts` | E55: one export handler for every screen |
| `kit/chart-scale.ts` | E55: `niceTicks` |
| `kit/Dialog.vue` | E55: an in-dialog `status` live region |
| `kit/MetricCard.vue` | E55: a "Sample" mark for `includesSample` values |

Screens still import only read models, stores and copy. New copy goes in
`audit-copy/{workbench,report,sources,settings}.ts`.

## 4. The E55 cleanup

- **Split `screens.css`** (399 lines) before any new rule.
  - `screens.css` keeps the base rules, Overview and City.
  - `screens-explore.css` takes Architecture, Hotspots and File detail.
  - `screens-audit.css` takes the six Audit screens.
  - Part 4 adds `screens-act.css` and `screens-configure.css`.
  - The imports keep today's cascade order. `kit-css-fallbacks.test.ts`, `city-stage-floor.test.ts`, `main.ts` and the harness stylesheet list follow the new files.
- **Shared classes.**
  - `ci-note` (a muted note), `ci-empty` (+ `__title`), `ci-selected-strip`, `ci-screen__cards` and `ci-screen__grid` go in `kit.css`.
  - They replace every cross-screen use of `ci-hotspots__note`, `ci-findings-table__empty`, `ci-overview__empty`, `ci-hotspots__selected`, `ci-overview__cards` and `ci-overview__grid`.
  - `ci-chip` and its generic tones move from the File-detail section to `kit.css`.
- **`useCsvExport(root, liveMessage)`** returns `exportText(filename, build, mime?)`.
  - A thrown download becomes `EXPORT_FAILED`. Success announces nothing (E17: the save dialog is the outcome).
  - The six Part 2–3 handlers use it, and Hotspots gains the live region it lacked. The Part 4 Markdown and JSON exports use it too.
- **MetricCard "Sample" mark.** A value that is `isSampleBacked` but not `state: 'sample'` (a partial aggregate with `includesSample`) shows a second `ProvenanceBadge`, "Sample", next to its state badge.
- **Live regions inside dialogs.**
  - `CiDialog` gains an optional `status` prop, rendered as a visually hidden `role="status"` inside the modal.
  - `FindingReviewDialog` and `PackageDetailDialog` announce their outcomes there, instead of emitting `announce` to a region the modal hides.
  - Their failures stay `role="alert"` inside the dialog.
- **Even ticks.**
  - `niceTicks(max, target)` picks a step of 1, 2, 2.5 (only from 10 up) or 5 × 10ⁿ, so every tick is an evenly spaced integer.
  - `BarChart`, `LineChart` (with gridline and label at the same value) and the Hotspots scatter use it.
  - `niceMax` stays, as `niceTicks(v).max`.
- **Deferred again:**
  - From E55: the `SECURITY` module-load freeze, and the missing button column in the Quality and Dependencies tables.
  - The CameraControls re-measure and the duplicate leaf ResizeObservers. Both are city-internal, and `CityWorkspace.vue` has no line budget.
  - Contrast decision #4 is left untouched. The final task reports whether any new screen makes it worse.

## 5. Testing

- **Unit:**
  - Review store:
    - `updateWorkItem`: patch, the verified guard, title and notes limits, pending, persist-before-mutate
    - pending `removeWorkItem`, `clearAll`, `openWorkItemCount`
  - `workTargetLabel` for all three kinds, and for a file missing from the snapshot; board grouping and the filter; `planMarkdown`
  - `reportMarkdown`: sections toggle, "(sample)", "unknown (…)", never a bare 0 for an unknown value, pipes escaped
  - `buildSourcesModel` for every run state and both completeness values
  - `reviewStateJson`: paths, never raw entity ids; the schema
  - `niceTicks`; `useCsvExport`; the MetricCard sample mark; the Dialog status region
  - The CSS split: every `screens*.css` file has em fallbacks, and no screen-prefixed class is used outside its screen.
- **Component:**
  - Workbench:
    - empty state; board and list; filter
    - open the editor, edit and save; verified refused until all three checks are done
    - delete with confirmation
    - New work item aria-disabled without a selection; create for the selection; duplicate refused
    - export
  - Report: sections toggle, note applied, export text.
  - Data & scans:
    - scope rows and run states
    - Rescan and Change source navigate to the city, then call the callback
    - provider navigation
  - Settings: tabs, the density class on the shell, the priority dialog, open inventory, export review state, clear with confirmation.
  - Shell: provenance for the four routes; the nav badge counts open items.
- **Harness:**
  - Shots: `workbench`, `report`, `sources` and `settings` in dark, light and narrow, plus `settings&tab=privacy`.
  - For the workbench and report routes only, the harness seeds three work items (`?items=demo`), so those shots are not empty.
  - Compare against the prototype screenshots.
- **Evidence notes:** updated once, in the final task, followed by `npm run verify`. Verify also runs in the main checkout after the fast-forward.

## 6. Out of scope

- Real providers of any kind, a fallow adapter, reading source content.
- Persistence beyond memory, review-state import, printing.
- Editing profiles, exclusions or bindings inside the leaf.
- A Vue source wizard or scan-progress dialog; cancelling from the leaf.
- Drag and drop on the board; team or owner fields.
