---
project: codebase-inspector
title: WP-02 Part 4 — SDD ledger (rulings)
date: 2026-09-22
branch: feat/wp-02-part4
---

# WP-02 Part 4 — rulings

Every ruling made while planning and executing Part 4, with what it costs if it is wrong.
Spec: `docs/superpowers/specs/2026-09-22-inspector-ui-part4-design.md`. Plan:
`docs/superpowers/plans/2026-09-22-inspector-ui-part4.md`. Part 3 precedent:
`docs/superpowers/notes/2026-09-21-wp02-part3-ledger.md` (R1–R9, E1–E55).

## Planning rulings

| # | Ruling | Cost if wrong |
|---|---|---|
| S1 | Nothing new persists (W1). Work-item edits, report choices and note, and density live in per-leaf Pinia stores and are lost when the leaf closes or reloads. No plugin-data key, no `localStorage`. | Medium. Users lose a session's plan on reload. The screens say "Kept in this session only", and Export review state gives them a record. WP-05 adds a durable adapter behind the existing port. |
| S2 | No new provider or scan behaviour (W2). Data & scans reuses the injected `onSelectCodebase` / `onScanRequested`, the same host entry points `NoSnapshot`, `NavColumn` and the city toolbar already call. There is no simulated scan. | Low. A reviewer expecting the prototype's "demo scan" gets a real rescan instead, which is more honest. |
| S3 | Change source and Rescan navigate to `city` first (W3, following A8/P14 and `NoSnapshot`). The scan's states and announcements live only on the city route. | Low. The user leaves Data & scans when scanning; the Scan status panel shows the outcome on return. |
| S4 | There is no Vue source wizard, no scan-progress dialog and no cancel button in the leaf (W3, W4). The host modals are the consent chain, and `city-view.ts` (399/400) cannot provide a cancel callback. The copy names the "Cancel scan" command. | Low. One extra step to cancel. A cancel injection needs a `city-view.ts` split first. |
| S5 | The in-leaf Settings never edits profiles, exclusions, limits or bindings. Obsidian's plugin settings tab stays the only editor (W5). Settings links to Data & scans, which shows the values the snapshot was scanned with. | Low. Two places to look, but one editor. Moving editing into the leaf would duplicate validation (`exclusionInputReasons`) and need host plumbing. |
| S6 | Density (comfortable / compact) is the only real leaf preference. There is no theme switch (it follows Obsidian), and no connections, contrast or threshold controls: each would need a city or read-model change with no budget, or would contradict the fixed formula. | Low. The screen is thinner than the prototype. The rest is stated as policy text. |
| S7 | The report is exported as Markdown through `downloadText` only, and there is no Print (W6). Printing a leaf prints the whole Obsidian window. | Low. Users print the exported Markdown instead. |
| S8 | The report composes the existing read models (W7). Its metadata, note and limitations are always included, its five sections can be toggled, and it carries an "Includes sample data" badge instead of "Demo report". | Low. |
| S9 | `WorkItem` gains priority, notes and three checks. There is no team or owner field (Q11), target and intent never change, and notes are never prefilled with sample numbers (W8). | Low. A team field could return later as a module-level sample label, but only with a label. |
| S10 | `updateWorkItem` refuses `verified` unless all three checks are done, in the store as well as the editor. `WorkItemInit` can set status and checks, but goes through the same `workItemProblem` rule (W9). | None. Mirrors the dismissal-reason rule (Q3). |
| S11 | There is no drag and drop on the board (W10). The editor's status select is the accessible path, and a list view is the table equivalent. | Low. Pointer users lose a shortcut. |
| S12 | New work item plans for the selected file only, with the file intents refactor, tests and documentation (W11). Without a file selection the button is `aria-disabled`, with a visible hint tied to it by `aria-describedby`. | Low. A global "pick any file" would need a file picker over thousands of files. The command palette already selects files. |
| S13 | Delete is confirmed inline in the editor footer, not in a nested dialog (W12). The confirm and keep buttons move focus explicitly. | Low. |
| S14 | The workbench nav badge counts items not yet verified (W13, the prototype's rule), not every item. | Low. `nav-column.test.ts` pins the new rule. |
| S15 | Review state can be exported (JSON: paths only, never raw entity ids; schema `v1`) and cleared with confirmation. Import is deferred to WP-05 (W14). | Medium. Users cannot restore a session. Import without persistence restores only into one session, and validating untrusted JSON belongs with the durable adapter. |
| S16 | Data & scans has no per-provider "evidence envelope" dialog. Each card carries its state chip, source, description and "Used by" navigation (W15). | Low. |
| S17 | Provenance (W16): `report` shows the shell sample badge. `workbench`, `sources` and `settings` do not, because they show user records, scope facts and states, not sample values. | Low. |
| S18 | `PlaceholderScreen` and `PLACEHOLDER_ARRIVES` are deleted (W17). `RouteMeta.part` stays. `workspace-shell.test.ts`'s placeholder test is retargeted to the workbench screen. | None. |
| S19 | The composable keeps the user's name `useCsvExport` even though it also exports Markdown and JSON (through its `mime` argument). | None. Renaming later is mechanical. |
| S20 | `screens.css` is split by area into `screens.css` (base, Overview, City), `screens-explore.css`, `screens-audit.css`, `screens-act.css` and `screens-configure.css`. It is a pure move first (Task 1), and main.ts keeps the cascade order. | Low. A cascade regression shows in the harness captures. `city-stage-floor.test.ts` still reads `screens.css`. |
| S21 | The shared-class cleanup goes one step past "note/empty": `ci-overview__cards/__grid` become `ci-screen__cards/__grid` and `ci-hotspots__selected` becomes `ci-selected-strip`, because they are the same cross-screen reuse. `ci-chip` moves to the kit. `css-class-scope.test.ts` guards it. | Low. The rename touches many screens, but it is mechanical and the component tests cover them. |
| S22 | Dialog outcomes are announced inside the modal through a new `CiDialog` `status` prop. FindingReviewDialog also stops announcing a refused decision (it announced after any resolved promise, including `null`): E17 applied. PackageDetailDialog failures move to an in-dialog `role="alert"`. | Low. |
| S23 | `niceTicks` uses steps of 1, 2, 2.5 (from 10 up) and 5 × 10ⁿ. `HotspotsModel` exposes `xTicks`/`yTicks`, so the scatter never recomputes a scale from an already-rounded max. LineChart keeps a floor of 100. | Low. Axis maxima change (for example 50 → 60). Any test that pinned an old value is updated and listed. |
| S24 | The workbench plan export writes the filtered rows (what is on screen), like every other export. | Low. |
| S25 | The Settings categories use the kit `Tabs` (horizontal, roving tabindex, harness `?tab=`), not the prototype's vertical list. | Low. It is cosmetic, and it is listed as an intended difference. |
| S26 | The harness gains `?items=demo`, which seeds three fixed work items for the workbench and report shots only. There is no source change. | None. |
| S27 | Deferred again: the E55 `SECURITY` module-load freeze and the missing button column in the Quality and Dependencies tables (outside the user's six cleanup items); the CameraControls re-measure and the duplicate leaf ResizeObservers (city-internal, no `CityWorkspace.vue` budget); contrast decision #4 (untouched, and reported in Task 14). | Low. None of them hides evidence or breaks a hard constraint. |

## Execution rulings

(Appended per task.)
