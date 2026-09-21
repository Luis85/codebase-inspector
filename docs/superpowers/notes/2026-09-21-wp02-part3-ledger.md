---
project: codebase-inspector
title: WP-02 Part 3 — SDD ledger (rulings)
date: 2026-09-21
branch: feat/wp-02-part3
---

# WP-02 Part 3 — rulings

Every ruling made while planning and executing Part 3, with what it costs if it is wrong.
Spec: `docs/superpowers/specs/2026-09-21-inspector-ui-part3-design.md`. Plan:
`docs/superpowers/plans/2026-09-21-inspector-ui-part3.md`.

## Planning rulings

| # | Ruling | Cost if wrong |
|---|---|---|
| R1 | Part 3 strings live in `src/ui/audit-copy/<screen>.ts`, each re-exported by `inspector-copy.ts` with `export *`. That file is at 283/400, and six screens of copy would pass the cap. Screens still import only from `inspector-copy`. | Low. Folding the files back is mechanical. |
| R2 | Fixture *data* (package names, versions, licences, advisory text) lives in `fixtures/sample-packages.ts`, not copy, like the prototype's `data.js`. UI labels stay in copy. | Low. It could be moved if a copy contract ever scans fixtures. |
| R3 | Test results are sample runs seeded per **real** test file (category `test`). With none, the tab shows an empty state and the card is unknown. "Runtime evidence" in the brief is read as runtime exploitability and reachability, which stay unknown. | Medium. If test runs should also be unknown, one card and one tab change to the not-collected state. |
| R4 | Ownership "Show in city" uses the city's path-substring search (`<module>/`). It can also dim-match a nested folder with the same name. No new state is added. | Low. A precise module filter needs a city-store change. |
| R5 | The Finding review dialog stays open after acknowledge, reopen and dismiss, and shows the new state. On close, focus goes to the opener, or to the row now at the same index, the reset button, or the panel. | Low. UX preference only. |
| R6 | The security review checklist is screen-local and not persisted. It is labelled "Not saved". The durable action is the package review work item. | Low. Persisting it would need a new port shape. |
| R7 | `inert` gets its own task (14), apart from the screens, so it can be reviewed and rejected on its own. | None. |
| R8 | The Evolution provenance flag is `store.snapshot !== null`: activity and coupling are always sample. | None. |
| R9 | Finding "Add work item" creates the file's **refactor** item (`addWorkItemForFile`), so File detail, FileInspector and the dialog agree on "In refactor plan". | Low. |

## Execution rulings

(Appended per task.)

### Pre-flight scan (before Task 1)

The pre-flight scan checked every task pair that shares a file or interface and each task's self-consistency against the real code at 23e5e33. It found 34 items, and each is ruled on below. Each ruling reaches its task through the dispatch.

| # | Ruling | Cost if wrong |
|---|---|---|
| E1 (F1) | Task 2 also updates the full `ReviewRepository` literals in `tests/unit/review-store.test.ts` and `tests/component/file-inspector.test.ts` (add the three disposition methods or spread `createInMemoryReviewRepository()`), so typecheck passes. | None. The alternative is a red typecheck. |
| E2 (F2) | Task 11 retargets the `workspace-shell.test.ts` placeholder test from Security to a route that is still a placeholder (`workbench`, "Part 4"). | Low. The test only guards the placeholder outlet. |
| E3 (F3, F4) | Task 14 reuses the existing narrow-width setup in `workspace-shell.test.ts` (the jsdom leaf is 1000 px by default). `closeNav` clears `inert` first, then focuses the opener in `nextTick`, so a real browser does not drop the focus. | Low. It would show up as lost focus in the harness. |
| E4 (F5) | Task 3's App-mount journal-feed test goes in `tests/component/` (jsdom), not `tests/unit/` (node env). The pure journal tests stay in `tests/unit/snapshot-journal.test.ts`. | None. |
| E5 (F6) | Task 1's architecture memo test calls `useReadModels()` twice without mounting, like the existing memo tests. | None. |
| E6 (F7) | Task 1's `includesSample` test uses a partial mixed aggregate (collected plus sample inputs whose aggregate state is not already `sample`) and asserts `provenance.includesSample === true` and `isSampleBacked === true`, so it fails before the change. | Low. |
| E7 (F8) | Every BOM in src and tests is written as the `﻿` escape, never a literal invisible character (matches `hotspots.ts`). | None. |
| E8 (F9) | Task 1 updates the `tests/component/architecture-screen.test.ts:56` regex for the new ", sample" label suffix and adds the file to its list. | None. |
| E9 (F10) | Task 9's file list includes `src/ui/kit/meter-types.ts`, `src/ui/screens/shared/evidence-source.ts` and the `src/ui/audit-copy/tests.ts` change. The plan's step text already defines them. | None. |
| E10 (F11) | Task 9 does not copy HotspotScatter's roving-focus logic. It extracts a shared composable (`src/ui/kit/use-roving-index.ts`), and both HotspotScatter and CoverageMap use it. Hotspots tests must stay green. | Medium. If the extraction regresses the scatter, the Hotspots component tests catch it. The fallback is to revert HotspotScatter to its own copy. |
| E11 (F12) | One `groupByModule` helper goes in `read-models/file-summaries.ts` (next to `ROOT_MODULE`), introduced at its first use (Task 3) and reused by Tasks 5 and 7. Weighted module coverage is one exported function shared by Overview and Test confidence (Task 5), so the two screens cannot disagree. | Low. The Overview weak-module card must keep its current values, and its existing tests pin them. |
| E12 (F13) | `niceMax` moves to one exported helper that both `hotspots.ts` and `BarChart.vue` import (Task 12). | None. |
| E13 (F14–F16) | BarChart renders SVG `<title>` and `<desc>` with `aria-labelledby` and a table fallback (spec §2). Its column header comes from audit-copy (`CHART_DATE_HEADER`). Its fill uses `--ci-tone-accent`, never `--interactive-accent`. | None. The spec and Global Constraints require all three. |
| E14 (F17) | The coverage-trend LineChart label and each MeterList `label` say "sample" when the data is sample (spec §4: every new chart or map label). | Low. |
| E15 (F18) | Task 12 adds a new A4 comment to CityScreen.vue (Compare appears only with two or more journal entries; there is still no "activate snapshot") instead of editing a comment that does not exist. The comment in `SnapshotSelector.vue` stays true. | None. |
| E16 (F19) | Tests in file-detail-screen, overview-screen and city-screen that open a `CiDialog` add `import '../mocks/obsidian'`. | None. |
| E17 (F20) | FindingReviewDialog, and every screen that adds a work item, announces success only when the store returns non-null. A `null` (refused as pending or duplicate) announces nothing, or the refusal. | Low. |
| E18 (F21) | `reopen()` is pending-aware, as Q3 requires: it reserves the fingerprint while the removal is persisting and refuses while one is pending. | Low. |
| E19 (F22) | `FINDING_ROW_LABEL` is not created: Task 8 does not use it. | None. |
| E20 (F23) | Finding and advisory rows that become `<button>`s use `<span>` blocks (display: block via CSS), never `<p>` inside `<button>`. | None. |
| E21 (F24) | Copy follows the spec wording: `QUALITY_FOOTNOTE` = "Findings are sample data. Decisions are kept in this session only and never written to the repository.", and the confidence text = "Illustrative, manual confirmation required". | None. |
| E22 (F25) | The Evolution changed-files card is labelled "Files changed since previous" (spec §2). Task 12's test uses that string. | None. |
| E23 (F26) | The Evolution window card's value is the sample commit total in the selected window (`sample`), captioned with the window (30 or 90 days). A UI setting is never shown as collected evidence. | Low. |
| E24 (F27) | No identifier named `window` in src/ui. The name is `changeWindow`. | None. |
| E25 (F28) | Ownership imports `ROOT_MODULE` from `read-models/file-summaries.ts`, and Task 7 does not redefine it. | None. |
| E26 (F29) | The plan's split stands against spec §3: `buildQualityModel(files, dispositions)` is memoized, and the filter is applied in the screen's computed through `filterFindings`. `compareSnapshots` and `journalEntryFor` live in `read-models/snapshot-comparison.ts`, not `evolution.ts`. This follows §3's last line ("Filter-dependent models are built in the screen's computed from a memoized base"). | Low. Only file placement differs. |
| E27 (F30) | Every `.every(...)` assertion in the new tests is preceded by a non-empty check. | None. |
| E28 (F31) | `EvidenceTable` gains `interactive?: boolean` (default `true`). With `false`, rows get no tabindex and no click or keydown handlers. Package (Task 10) and stewardship (Task 13) rows that are not activatable pass `:interactive="false"`. | Low. It is an additive kit prop. |
| E29 (F32) | The Package table has no initial sort (fixture order), and Task 10's test relies on it explicitly. | None. |
| E30 (F33) | Task 5 computes `testRuns(snapshot, files)` once and reuses it, as its prose says. | None. |
| E31 (F34) | Each coupling row shows the visible note "Correlation, not a causal dependency" (Q10), not only the panel subtitle. | Low. It adds visual weight per row. |

### Task 2

| # | Ruling | Cost if wrong |
|---|---|---|
| E32 | `reopen(fingerprint)` returns `Promise<boolean>`: `true` when the disposition was removed, `false` when refused because a decision for that fingerprint is pending (E18). The dialog can then announce only real outcomes (E17). This deviates from the plan's `Promise<void>`. | Low. Callers that ignore the result are unaffected. |

### Task 3

| # | Ruling | Cost if wrong |
|---|---|---|
| E33 | A module present in only one of the two compared snapshots shows its lines as `unknown` with the new reason `COMPARE_MODULE_ABSENT` ("Module not present in this snapshot."), not a line total of 0 and not the whole-snapshot `COMPARE_LINES_UNKNOWN` reason. Its file count is a real 0. | Low. The comparison dialog shows "—" rather than 0 lines for an added or removed module. |

### Tasks 4–5

| # | Ruling | Cost if wrong |
|---|---|---|
| E34 | File detail and Code quality build their finding rows through one helper, `titledFindings(file)` in `read-models/findings.ts`, so the two screens cannot disagree on the title or fingerprint. `findings.ts` imports only types from `file-detail.ts`. | None. |
| E35 | Weighted module coverage lives in a new `read-models/module-coverage.ts` (`moduleCoverage(files): ModuleCoverage[]`, built on `groupByModule`). Overview's weak-module investigation and Test confidence both use it (E11). Overview keeps its own sort and its current output. | Low. The Overview tests pin the weak-module card. |
| E36 | Test confidence's "Files below 60%" card uses the `alert-triangle` icon, not the plan's `triangle-alert`. It matches the existing uses in `Callout.vue` and `architecture.ts`. | None. It is an icon alias. |

### Task 7

| # | Ruling | Cost if wrong |
|---|---|---|
| E37 | The E23 window card: its value is `sample(sum of the activity series)` with unit " commits", and its caption is `EVOLUTION_CARD_WINDOW_CAPTION(days)` = "Sample commits in the last N days; no author comparisons". | Low. |
| E38 | Task 7 also adds the copy that Task 12 needs for E14 and E31: `EVOLUTION_COVERAGE_LABEL` (the chart's aria label, which says "sample") and `EVOLUTION_COUPLING_ROW_NOTE` = "Correlation, not a causal dependency". Copy for one screen stays in one file. | None. |
| E39 | E7 is satisfied by any spelling that keeps the invisible U+FEFF byte out of the file: the backslash-u escape or `String.fromCharCode(0xFEFF)`. Task 7's test uses the latter, because the editing tool kept turning the escape into the real byte. | None. |

### Task 8

| # | Ruling | Cost if wrong |
|---|---|---|
| E40 | In the Finding review dialog, the Acknowledge/Reopen toggle and the Save dismissal button use `aria-disabled` while a decision is pending, not `disabled`, and their handlers ignore presses. In a real browser, disabling the focused control drops focus to `<body>`, which escapes the dialog's Tab trap and Escape handling. The store also refuses a second decision. | Low. A sighted user sees no pending state until a style is added (deferred minor). |
| E41 | The finding filters' "All …" options use the empty string as the `<select>` value and map it back to `null`, because a native select cannot hold `null`. No module is ever named `''`. | None. |

### Task 9

| # | Ruling | Cost if wrong |
|---|---|---|
| E42 | Test confidence's sub-components live in `src/ui/screens/test-confidence/`, not the plan's `screens/tests/`. An eslint rule blocks `src` imports from any `**/tests/**` path, to keep test code out of the bundle, and that guard stays as it is. | None. It only changes the path. |
| E43 | The E10 roving-focus composable is `src/ui/kit/use-roving-index.ts`. HotspotScatter and CoverageMap both use it, and the Hotspots tests pass unchanged. | Low. If the scatter regresses, its old copy can come back. |
