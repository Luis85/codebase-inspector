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

### Pre-flight scan (before Task 1)

The pre-flight scan (one Opus reviewer, read-only) checked every task pair that shares a file or an interface, and each task's own consistency, against the real code at 148a6cd. It found 19 items: 1 blocker, 7 likely failures, 4 risks and 7 nits. Each is ruled on below and reaches its task through the dispatch. The plan text is left unchanged, and these rulings amend it.

| # | Ruling | Cost if wrong |
|---|---|---|
| X0 | Dispatch format. Each implementer gets a brief file holding the plan's Global Constraints, the Screen-task conventions (Tasks 10–13) and the full task text, copied verbatim by script. The dispatch prompt itself carries the hard constraints, the amending rulings and the real names from earlier tasks. The brief is a file rather than inline text so the controller's context survives 14 tasks, and the words are the same. | None. |
| X1 (F1) | Task 4: `FindingReviewDialog.run()` keeps its `Promise<boolean>` contract, because `saveDismissal` closes the form on `true`. It sets `status.value = done` and returns `true` only when the result is neither `null` nor `false`, returns `false` otherwise, and on a throw sets the error and returns `false`. | None. The alternative breaks typecheck. |
| X2 (F2) | Task 2 also renames `OverviewScreen.vue:103` `ci-overview__empty` → `ci-empty`. | None. |
| X3 (F3) | Task 2: the FindingsTable empty title becomes `ci-empty__title`. The audit rules `.ci-findings-table__empty` and `__empty-title` are deleted outright, not text-replaced. Any padding the Quality empty state needs moves to `.ci-findings-table__none`. The old `.ci-findings-table__empty .ci-hotspots__note` override becomes `.ci-findings-table__none .ci-note`. | Low. |
| X4 (F4) | Task 4 tests find the in-dialog region as `[role="dialog"] .ci-dialog__status`: the region is a sibling of the slotted root, not inside it. | None. |
| X5 (F5) | Task 9's partial-read test builds `buildSnapshotFixture({ files: 10, directories: 2, unavailable: 2, completeness: 'partial' })`. | None. |
| X6 (F6) | Task 10: in `WorkItemEditor`, a local `removing` flag is set before `removeWorkItem` is awaited. The "item vanished" watcher skips `emit('close')` while the flag is set, so `done(WORK_DELETED)` is emitted and announced. | Low. Without it, a deletion is never announced. |
| X7 (F7) | Task 9: `formatBytes`'s formatter is hoisted to module scope (`consistent-function-scoping`). The same applies to any closure in the plan that captures nothing. | None. |
| X8 (F8) | Tasks 10, 11 and 13 tests use the mock call tuple without casts (`host.classList…`, `JSON.parse(text)`), because of `no-unnecessary-type-assertion`. | None. |
| X9 (F9) | Task 13's clear test, and any test awaiting a multi-step store chain, uses `flushPromises()` from `@vue/test-utils`. | None. |
| X10 (F10) | The `workspace-shell.test.ts` placeholder test is retargeted in **Task 10**, not Task 13 (assert `.ci-screen--workbench`, rename the test), so no task leaves a red test behind. Task 13 still deletes the placeholder and adds the density test. | None. |
| X11 (F11) | Task 9's review-state test asserts `not.toContain(String.fromCharCode(0))` and `not.toContain(String.fromCharCode(92) + 'u0000')`. It uses the distinctive repository id `repo-xyz` and asserts that string never appears. No backslash-u escape is written anywhere. | None. |
| X12 (F12) | Task 2: kit `.ci-note` keeps the old note spacing (`margin: var(--ci-space-2) 0 0`), and the existing `… .ci-note { margin: 0 }` overrides still apply. Kit `.ci-selected-strip` takes the Hotspots declarations (flex, wrap, centred, `justify-content: space-between`, gap `space-3`, margin-top `space-3`), with no muted colour or small font, and the explore rule is deleted. Nothing changes visually. | Low. The harness captures in Task 14 would show a regression. |
| X13 (F13) | `exactOptionalPropertyTypes` is not in `tsconfig.json`, but the user's hard constraints require it as a rule. It binds as review discipline: never assign `undefined` to an optional property. Typecheck does not enforce it. | None. |
| X14 (F14) | Tasks 11 and 13 write templates multi-line directly (`vue/singleline-html-element-content-newline`). `eslint --fix` is allowed only on the task's own files. | None. |
| X15 (F15) | Task 10: `.ci-work-editor` sets no width, and the kit `.ci-dialog` sizes it. | None. |
| X16 (F16) | Task 4 moves three assertions: the dependencies "announces PACKAGE_REVIEW_ADDED" test to `[role="dialog"] .ci-dialog__status`; the "rejected add announces PACKAGE_REVIEW_FAILED" test to `.ci-package-dialog__error`; and the quality `.ci-quality__live` expectation (it is replaced, not kept beside the new one). | None. |
| X17 (F17) | Task 1's stylesheet-order test checks `expect(order).toHaveLength(7)` before `.every` (E27). | None. |
| X18 (F18) | The copy follows the spec. `REPORT_CALLOUT` = "This is an illustrative review built partly from sample data. It is not a security certification or an audit of your repository." `SOURCES_CALLOUT_TITLE` = "Evidence sources". `SOURCES_CALLOUT` = "One real provider is connected: the built-in read-only inventory. Every other signal is sample data or not collected." Settings › Privacy & storage gets its own Export review state button (`ci-settings__export-privacy`, emitting `export`), as spec §2 lists. **Deviation kept:** the report paper's section headings are `h4` under an `h3` paper title, under the page `h2`, because a correct outline beats spec §2's "h3 sections". `mdQuote` keeping `> # …` is acceptable, and the test description says "quotes every line". | Low. |
| X19 (F19) | Task 10: the WorkItemEditor split threshold is 300 lines, as in the plan's self-review. | None. |

### Task 1

Clean review.
- Deferred minor: X17's `toHaveLength(7)` is tautological, because `order` maps a fixed seven-item literal. It meets only the letter of E27.

### Task 2

| # | Ruling | Cost if wrong |
|---|---|---|
| E1 | X12's "zero visual change" governs over its own list, which named "wrap" by mistake. `.ci-selected-strip` drops `flex-wrap: wrap` and copies the old Hotspots declarations exactly. The Quality empty state keeps its old `gap: var(--ci-space-2)` on `.ci-findings-table__none`. | Low. A long strip cannot wrap at narrow widths, exactly as before Part 4. |

### Task 4

| # | Ruling | Cost if wrong |
|---|---|---|
| E2 | The in-dialog `status` is cleared at the start of every decision, not only set on success. Otherwise an earlier success stays in the `role="status"` region while a later failure shows in `role="alert"`, and a repeated identical message never re-announces. | None. |

### Task 5

Clean review.
- Deferred minors: `niceTicks` returns `NaN` for `target <= 0` or `floor <= 0` (unreachable — every caller passes a positive literal); `niceMax` now has no production caller (kept because the plan's interface lists it); the property sweep never exercises `floor = 100`, which only LineChart passes.

### Task 6

| # | Ruling | Cost if wrong |
|---|---|---|
| E3 | A title cap must never make an existing action silently do nothing. `addWorkItem` **clips** a too-long generated title to `WORK_TITLE_MAX` (last character `…`); `updateWorkItem` still refuses one, because the editor validates and explains it. Package names up to 214 characters and file names up to 255 would otherwise refuse silently under E17. | Low. A clipped title loses its tail; the target and path still identify the work. |
| E4 | `updateWorkItem` copies the five patch fields explicitly instead of spreading, so identity fields (`id`, `target`, `intent`, `createdAt`) can never change at runtime and an explicit `undefined` cannot clobber a required field. `removeWorkItem` returns `false` for an unknown id. `clearAll` uses `allSettled`, reloads, then rethrows the first rejection. `NO_CHECKS` is frozen. | None. |

### Task 7

| # | Ruling | Cost if wrong |
|---|---|---|
| E5 | Amends X18: a quoted note line must not start a Markdown block. `mdQuote` escapes each line's leading `#`, `-`, `*`, `+`, `>` or `N.` exactly as `mdLine` does, so a note never becomes a heading, list or nested quote inside the exported plan. `mdCode`'s fence is run-length aware, so a path containing backticks cannot break its code span. | None. The exported Markdown reads as the user wrote it. |
