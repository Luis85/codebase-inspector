---
project: codebase-inspector
title: WP-04 Part 2 polish pass — SDD ledger (rulings)
date: 2026-09-26
branch: feat/wp-04-part2-polish
---

# WP-04 Part 2 polish pass — rulings

This ledger records every ruling made while planning and executing the WP-04 Part 2 polish pass, and what each one costs if it is wrong.

- **Spec:** `docs/superpowers/specs/2026-09-26-wp04-part2-polish-design.md`. It holds the inventory P1–P8 and T1–T10, the owner decisions O1–O4, the design decisions PN1–PN7, and scenarios 37–40.
- **Plan:** `docs/superpowers/plans/2026-09-26-wp04-part2-polish.md`, 9 tasks.
- **Branch:** `feat/wp-04-part2-polish`, from `9644c08`, the PR 1 head after WP-04 Part 2.
- **Precedent (all binding):** the WP-04 Part 2 ledger (O1–O4, NP1–NP20, NPF1–NPF15, WP-04.2 E1–E22), the WP-04 Part 1 ledger (IPF20 and the rest), and every earlier ledger.
- **Numbering:**
  - **O1…** are this pass's owner decisions;
  - **PN1…** are the spec's decisions;
  - **PP1…** are planning rulings;
  - **PQ1…** are pre-flight rulings;
  - **"WP-04.2 Polish E1…"** are execution rulings.

  None of these letters is used by an earlier ledger (grep over `docs/`).
- Every ruling reads: **Ruling:** what — why — cost if wrong.

## Owner decisions (2026-09-26, before the spec)

| # | Decision |
|---|---|
| O1 | **E14:** when a snapshot exists and the profile's live binding names another root, `scan-codebase` opens the scope approval on the binding's root. Cancelling changes nothing. |
| O2 | **Z38:** the 50 ms budget stays, and the no-freeze case runs isolated, after every other file. |
| O3 | **NP11 and E4 are kept** as ruled. |
| O4 | **Scope:** every confirmed item, meaning the five product follow-ups and the ten test-quality minors. |

## Planning rulings

| # | Ruling |
|---|---|
| PP1 | **Ruling:** 9 tasks, in this order:<ol><li>NPF15 (`ensureFolders`, scenario 37);</li><li>E20 with E13 and T8 (`insideOf`, the resolver);</li><li>E14 (scenario 39);</li><li>NE9 typing (scenario 38);</li><li>the status bar (scenario 24);</li><li>Z38 isolation;</li><li>the native test minors T1–T5, T9 and T10;</li><li>Show more and unmatched findings (scenario 40, T6 and T7);</li><li>evidence and verification.</li></ol>`src` changes only in Tasks 1–5, so the controller runs the full suite after Task 5. — Tasks 1 and 2 both edit `investigation-notes.ts` and run in sequence. Tasks 7 and 8 both edit `inspector.ts` and `workspace-files.ts`, and scenario 2's changes land before scenario 40 reuses the count helper. — Low: a mis-ordered dependency shows in the Consumes re-check. |
| PP2 | **Ruling:** four new required scenarios, 37–40 (spec §5), in the existing files:<ul><li>`notes-root` (37);</li><li>`settings` (38);</li><li>`commands` (39);</li><li>`investigation` (40).</li></ul>No existing title is renamed. Changed scenarios keep their titles, and each changed one has a RED run on record. — The brief requires the gate to keep or strengthen, and a rename would read as a dropped scenario in the gate history. — None. |
| PP3 | **Ruling (E20's shape, PN1):** skip UNC paths, and memoise only the root and base resolutions, never through vault events. `sourceNotePath` re-appends the relative path to the resolved root. — Measured: an offline SMB root blocked a call for 21 s, and today that happens on every keystroke and selection. Locally the cost is 0.6–1.2 ms, so the memo exists for the network case. No event can invalidate a memo for a root outside the vault: the plugin registers no `create` listener, and outside roots get no vault events. A scanned file is reached without following links (WP-01 §4.4), so resolving the root alone gives the same answer. — Low (spec §7): a root unreachable at first use, or a junction retargeted mid-session, keeps its first resolution until the plugin reloads. That is fail-safe to the textual answer. |
| PP4 | **Ruling (E13):** a fast wiring test, with `realPath` kept optional. — Making it required would add `realPath: () => null` to 9 test call sites, which behaves exactly like leaving it out; it would catch a dropped property only at the type level. The wiring test catches a dropped or mis-wired resolver in behaviour, which is what E13 feared. — Low: a new production constructor call without `realPath` would still typecheck. There is one such call today. |
| PP5 | **Ruling (T10, widens the minor):** scenarios 2, 17 and 22 drop their third `test` argument and take the config's `120_000`. — NP5 gives `300_000` to an app restart or a fallow run and `240_000` to a synthetic-tree scan. A plugin disable and enable is neither. In Part 2's last gate run the three took 10.4 s, 6.8 s and 10.0 s (`reports/native/vitest-results.json`, 2026-09-26 18:01). — Low: a much slower machine needs a ruling, never a retry. |
| PP6 | **Ruling (P4):** the NE9 typing fix lands only if scenario 38 is RED on 9644c08. If it passes there, the task stops for a ruling, and neither the fix nor the scenario lands unreviewed. — The loss is read from Obsidian's bundle (`update()` re-renders `render`-type items) but has not been observed yet, and O2 requires RED first. — None. |
| PP7 | **Ruling (NPF15's shape, PN2):** `adapter.stat`, not `adapter.exists`. — `exists` cannot tell a folder from a file. A file on disk at a folder segment must still refuse, and `stat` keeps that refusal explicit. — Low: `stat` is one more adapter call per missing segment. |
| PP8 | **Ruling (P3's shape, PN3):** `scroll-padding-block-end` on the scroll container, not a bottom padding on the leaf. — Restoring the leaf's bottom padding would shrink the city stage and undo the pinned leaf chrome. Scroll padding changes no layout, and it moves every scroll-into-view (WebDriver's click, keyboard focus) clear of the bar. — Medium: if ChromeDriver's click scroll ignores `scroll-padding`, scenario 24 stays RED after the fix, and Task 5 stops for a ruling. |
| PP9 | **Ruling (E14's shape, PN5):**<ul><li>The rule lives in `runRefresh`, beside M57's scope divergence, and takes the bound root as a parameter.</li><li>`CityViewDeps` gains a required `boundRoot`, which the one shared test fixture answers with null.</li></ul>— M57 is already the place where a refresh re-opens consent, and the scope modal already takes a `resolvedRoot`. One fixture builds `CityViewDeps` for every test (`tests/fixtures/data-port-deps.ts`). — Medium: this amends spec §5's "re-approves against the stored scope" for one case, as WP-01 §4.1's "a changed root invalidates prior approval" requires. |
| PP10 | **Ruling (Z38's shape, PN6):** one new file, `tests/integration/fallow-no-freeze.test.ts`, run by a third project with `sequence.groupOrder: 1`. The shared `world()` and spawn helpers move unchanged into a non-test support module. — `groupOrder` is in Vitest 5.0.1's own types (`plugin.d.CN87HSxv.d.ts:3379–3387`: "groups are run from lowest to highest"). Moving the whole `fallow-analysis.test.ts` would serialise about 20 unrelated cases. — Low: the node layer's file count grows by one, and Task 9 refreshes the counts. |
| PP11 | **Ruling (scenario 40, T6 and T7):**<ul><li>The report is crafted with `writeReport`: the recording plus about 150 clones of `check.unused_exports[0]` with distinct `export_name`s, plus one clone whose path is `src/missing.ts`.</li><li>Expected counts come from `resolveFindings` in `src/application/evidence/resolve-findings.ts`, which native files may import (IP56).</li><li>The scenario lives in `investigation.e2e.ts`.</li></ul>— Clones need no fallow run and no synthetic tree. `resolveFindings` is the app's own rule for dropping a finding. — Low: an importer that later rejects duplicate-shaped findings turns the scenario RED, and it is reworked then. |
| PP12 | **Ruling (T4):** `reviewFinding` is typed from `FINDING_STATUS_LABEL`'s keys (`src/ui/audit-copy/quality.ts:46`), not from `DispositionStatus` in `src/ui/stores/ports/`. — NP3 and IP56 let native files import the copy modules and `src/application/**`, and the stores' ports are neither. — None. |
| PP13 | **Ruling (T3):** scenario 2's post-reload RED is a second recorded mutation (`listDispositions` returning `[]`), with no change to the test beyond T4 and T5. — No `data.json` read happens at `onload`, so no write-side mutation can reach past the reload. The read side is where a reload loses data. — None. |
| PP14 | **Ruling:** the spec, this plan and this ledger are committed together before Task 1, and the controller stops for the owner's approval there. Execution rulings are transcribed into this ledger in Task 9's evidence commit. — The brief's Phase 1 stop. — None. |
| PP15 | **Ruling:** the native finish runs `npm run test:e2e` on the baseline 1.13.4, then once with `OBSIDIAN_VERSION=latest`, with `FALLOW_BIN` set to the owner's path and no `fallow.exe` running (E11). A failure on latest is a failure of this pass (NP20). — Carries Part 2's O4. — Low: a new Obsidian release between the runs can turn latest red; that is reported, never retried. |

## Pre-flight scan

The scan ran on 2026-09-26 at `2a770a1`, which differs from `9644c08` only by these three documents.

**Line counts:** re-measured with `wc -l`, and all match the plan's table. The plan's own Size table is the record.

**Consumes names:** grepped, and all found:
- `DataAdapter.stat(normalizedPath): Promise<Stat | null>` (`obsidian.d.ts:2027`);
- `sameRoot` (`root-path.ts:47`);
- `resolveFindings` (`resolve-findings.ts:10`);
- `FINDINGS_PAGE` (`findings.ts:40`);
- `FINDING_STATUS_LABEL` (`audit-copy/quality.ts:46`) and `FINDING_DIALOG_REASON` (`:87`, rendered at `EvidencePanel.vue:83`);
- `ROUTE_META` (`routes.ts:12`);
- `openScopeModal` and `ScopeSubject.resolvedRoot` (`src/host/modals/scope-modal.ts:21–23, 208`);
- `writeReport` (`workspace-files.ts:86`);
- `setTimeLimit` (`fallow-analysis-service.ts:308`: it writes through `store.setTimeoutSeconds` unless the profile was purged or the value is invalid), and `this.analysis` (`main.ts:78`);
- `listDispositions` (`plugin-data-review-repository.ts:238`);
- `@more` (`InvestigateScreen.vue:199`) and `.ci-finding-dialog__save-dismissal` (`FindingReviewDialog.vue:251`).

None of the new names exists yet (`groupOrder` in the config, `diskOnly`, `boundRoot`, `renderWhenIdle`).

| Row | Tasks | Produces ↔ consumes / self-consistency | Finding |
|---|---|---|---|
| 1 | 1 ↔ 2 | Both edit `investigation-notes.ts`. Task 1 changes `ensureFolders`; Task 2 changes `insideOf`, `planDestination`, `sourceNotePath` and `createInvestigationNotes`. | Sequential and disjoint functions. Consistent. |
| 2 | 1 ↔ 7 | Both edit `notes-root.e2e.ts`: Task 1 adds scenario 37, Task 7 changes scenario 22's timeout. | Sequential. Consistent. |
| 3 | 3 ↔ 4 | Scenario 39 (Task 3) drives Settings Connect and Clear binding. Task 4 changes when `settings-tab.ts` re-renders (PN4). | Scenario 39 is built on pre-PN4 rendering. Task 4 must re-run it with `settings.e2e.ts`, and Task 9's full gate re-runs everything. **Rework (PQ-R1):** Task 4's native run adds `commands.e2e.ts -t "scan-codebase after a Reconnect"`. |
| 4 | 3 ↔ 8 | Both edit `commands.e2e.ts`: Task 3 adds scenario 39, and Task 8 replaces the count helper in scenario 7. | Sequential. Consistent. |
| 5 | 7 ↔ 8 | Both edit `inspector.ts` and `workspace-files.ts`: Task 7 changes `reviewFinding` and `evidence()`, and Task 8 replaces `recordingFindingCount`. | Disjoint members. Consistent. |
| 6 | 5 ↔ 9 | `harness-shot` shows the Task 5 CSS. | Consistent. |
| 7 | 6 ↔ 9 | Task 6 adds one node-layer test file and one support module; Task 9 refreshes the counts. | Consistent (PP10). |
| T1 | 1 | The fake's disk-only parent must accept a child `createFolder` or `create`, as Obsidian's recursive `mkdir` does. | Consistent. |
| T2 | 2 | The lazy `{ container, target }` resolutions against "resolved only when the textual check fails". | Consistent. |
| T3 | 3 | Step 3 names the scope modal at `src/host/scope-modal.ts`. | **Correction (PQ1):** it is `src/host/modals/scope-modal.ts`. |
| T3b | 3 | `sameRoot`'s `caseSensitive`. PN5 says `Platform.isLinux`; the source modal uses `!Platform.isWin` (`source-modal.ts:189`). | **Ruling (PQ2)** below. |
| T4 | 4 | Step 1's watched write. `setTimeLimit` writes `analyzers` for any unpurged profile with a valid value. | Consistent; the first choice is usable. |
| T5 | 5 | The pin and the CSS name the same declaration. | Consistent. |
| T6 | 6 | `groupOrder` exists in Vitest 5.0.1's types; whether every project must set it is checked in Step 2. | Consistent. |
| T7 | 7 | The second finding must be open, because `.ci-finding-dialog__acknowledge` exists only while the status is `open` (`FindingReviewDialog.vue:275`), and `reviewFinding` polls it first. | Consistent: the plan says "still open". |
| T8 | 8 | Both RED mutations are named, and the controls come first. | Consistent. |
| T9 | 9 | "Verified 40 executed … all 40", because every native case is a required one (Part 2: 36/36). | Consistent. |

0 blocking, 1 rework (PQ-R1), 1 correction (PQ1) and 1 ruling (PQ2).

## Pre-flight rulings

| # | Ruling |
|---|---|
| PQ1 | **Ruling:** Task 3 reads the scope modal at `src/host/modals/scope-modal.ts`. PQ-R1 is carried into Task 4's dispatch: its native run adds scenario 39. — Both are facts: the plan's path, and a cross-task dependency its Files list missed. — None. |
| PQ2 | **Ruling:** E14's root comparison uses `sameRoot(…, { caseSensitive: Platform.isLinux })`, as PN5 states, not the source modal's `!Platform.isWin`. — The investigation code and the preview already use `Platform.isLinux` (`investigation-notes.ts:44–46`, `investigation-services.ts:49`), and macOS's default filesystem is case-insensitive. The source modal's stricter macOS rule is a containment check on a new selection, not a comparison of two roots. — Low: on a case-sensitive macOS volume, two roots that differ only in case would read as one, so no approval would be asked. |

## Execution rulings

| # | Ruling |
|---|---|
| WP-04.2 Polish E1 | **Ruling:** the Task 2 implementer ran `git stash -u` once, which is forbidden, to rebuild its RED after writing code first. It restored the tree byte-identical and clean. The entry `4b7f790 wp04-task2-red-check-1790450957` holds a strict subset of `7bb5f5b`: its tree differs from `7bb5f5b` only by 66 test lines the commit adds. The harness blocked the subagent's `git stash drop`, and the controller does not drop it either, because an action the safety layer refused is surfaced to the owner, not retried. — Cost: one redundant entry on the shared stash stack until the owner drops it; none to the branch. |
| WP-04.2 Polish E2 | **Ruling:** Task 2's reconstructed RED needs no fix round. The reviewer checked that it is tied to byte-identical pre-fix `src` (`HEAD~1`), and each failure is the expected pre-fix behaviour:<ul><li>`sourceNotePath` null through the alias;</li><li>doubled root lookups;</li><li>a UNC path reaching `realpathSync`.</li></ul>Later dispatches restate "the failing test first". — Low: a test passing for a wrong reason would have been caught only by the reconstruction, which the reviewer judged specific. |
| WP-04.2 Polish E3 | **Ruling (amends PN4):** the focus check is scoped to the settings window's document (`containerEl.ownerDocument`), not to `containerEl`. Observed natively: a profile page renders into its own `.setting-page` while the tab's `containerEl` is detached, so a check scoped to `containerEl` never deferred (built and run: still RED). The pending state names its document (`renderPendingIn`), so a stale wait never holds back a later render. — Low. While focus is in any field of the settings window (another tab, or the settings search), this tab's re-render waits until focus leaves, and before Settings are first opened a focused field in the main window does the same. No text is lost; a render only comes later, and `display()` re-reads `getSettingDefinitions()`. |
| WP-04.2 Polish E4 | **Ruling (amends spec §5 row 38's control):** the positive control is the notes-folder field showing the write made elsewhere, after the blur. Observed: a marker on `.setting-item` survives a re-render, and one on the Name input disappears even with no write, because the tab's own save re-renders. — Low: the control proves that a render carried the write. The while-focused evidence is the scenario's poll on the tab's own state before the switch back. |
| WP-04.2 Polish E5 | **Ruling (amends Task 4's step 5):** scenario 38's watched write is the tab's own investigation folder store, reached through `app.setting.activeTab` (a `writePluginDataSlice('investigations')` write). `setTimeLimit` throws `not-bound` for a profile with no fallow executable, and the plugin instance holds no profile store. The scenario reads the tab's private fields (`investigations`, `entries`). — Low: renaming those fields breaks scenario 38 loudly, never silently. |
| WP-04.2 Polish E6 | **Ruling:** the Task 4 implementer's one `node -e` rewrite of `tests/e2e/settings.e2e.ts`, which breaks the Edit/Write-only rule, is accepted. The file is LF before and after, and the committed diff is what the reviewer judged. — None. |
| WP-04.2 Polish E7 | **Ruling:** the reviewer's ⚠️ item is accepted as a known cost, not fixed: a settings window closed while a field is focused sends no focusout, so the deferred `update()` may never run. `refresh()` has already stored fresh entries, and Obsidian calls `getSettingDefinitions()` on every `display()`. Only `update()`'s search-index snapshot stays stale until the next refresh or display, and the next refresh with nothing focused supersedes the wait. — Low: the settings search may match stale row text until then. |
| WP-04.2 Polish E8 | **Ruling (resolves PP8):**<ul><li>**Why the fix failed:** ChromeDriver scrolls only an element outside the viewport. A button already inside it, but under the fixed status bar, gets no scroll, so `scroll-padding` cannot help a WebDriver click.</li><li>**The plan:** prove the person-facing path instead, the button's own `focus()` followed by a not-obscured check. If that did not discriminate, revert the CSS and keep `centred()` with a corrected comment.</li></ul>— Low. |
| WP-04.2 Polish E9 | **Ruling (closes the Task 9 minor; amends P3 and PN3):** the plugin's padding is not at fault, and no product change ships.<ul><li>Natively, the button's own `focus()` already scrolls it clear of the status bar on the unchanged CSS: E8's check was GREEN without `scroll-padding`.</li><li>At maximum scroll, the Create button sits 70.35 px above the status bar's top.</li><li>Only a WebDriver click on a button left under the bar at the viewport's bottom edge is intercepted. That is Obsidian's fixed status bar, over any view.</li></ul>`centred()` stays, with its comment corrected, and the spec's P3 claim "focus is obscured (WCAG 2.4.11)" is withdrawn. — None to the product; the native workaround remains, now correctly explained. |
| WP-04.2 Polish E10 | **Ruling:** native runs set `FALLOW_BIN` as a pure-backslash Windows path. Scenario 15 compares the executable path the tab shows against `FALLOW_BIN` as text, and the owner's forward-slash path names the same file; a mixed-separator value is a harness input error, not a product bug. One scenario-9 flake (a `vaultHas` poll timeout during a Task 8 investigation run, green alone and in the full file) is recorded under Part 2's E5 rule. — Low. |
| WP-04.2 Polish E12 | **Ruling (final review):** one fix wave covers Important 1–3 and Minors 4–9.<ul><li>**Important 1 is fixed, not ruled.** The waiting Settings render is released only when focus leaves the page's controls with the document still focused, and the release re-checks focus. Focus moving onto a button, or a window blur, keeps it waiting, and a button's own action renders at once.</li><li>**Minors 4–9:** stale scan-flow and preview comments, two evidence wording slips, scenario 38's control comment, scenario 37's control re-read at create time, and two needless exports.</li><li>**Not taken:** deriving scenario 2's `SECOND_FINDING` from the recording, and 14 of the 19 task-review minors. The review triaged them as follow-ups; the other 5 were fixed in this wave.</li></ul>— Low: a render waits while focus rests on a button whose action never refreshes, until focus leaves the page's controls. |
| WP-04.2 Polish E13 | **Ruling (parks the fix-wave re-review's one Minor):** a `focusout` listener from an earlier wait can stay attached after the immediate branch of `renderWhenIdle()` renders. A later wait can then add a second listener.<ul><li>Each listener re-checks `relatedTarget`, `hasFocus()` and `renderPendingIn` before acting.</li><li>Each one removes itself on the next focusout that leaves the page's controls.</li><li>No double render and no lost click reproduces in the traced sequences.</li></ul>— Low: a few idle listeners on the settings document until focus next leaves its controls. A follow-up can remove the listener in the immediate branch. |
| WP-04.2 Polish E11 | **Ruling (rejects a Task 9 review finding):** scenario numbers are the spec §5 identities: 38 is settings typing and 39 is the scan after a Reconnect. `required-scenarios.json` is ordered by the commit that appended each title, and Task 3 appended 39 before Task 4 appended 38. The gate matches titles, not positions, and the evidence says so once. — None. |

Also recorded during execution:
- **Pre-flight:** 0 blocking findings. PQ-R1 was carried into Task 4, which re-ran scenario 39.
- **Fix rounds:**
  - Task 1 needed one: scenario 37's copy-settle poll.
  - Task 9 needed one: four earlier runs undisclosed, and one scenario number wrong.
  - Every other task was approved at its first review. Task 5 stopped once under PP8 and was resolved by E8 and E9.
- **Test runs of the pass**, every one, in order:
  1. The controller's `npm run test` at `5968e38`, after the last `src` task: 308/310 files, 3483 passed, 1 skipped, 2 failed. The failures were the G8 count, expected until Task 9, and **Z38 failing at 62.6 ms** before isolation.
  2. Task 6's `npm run test` at `886f67a`: 310/311 files, 1 failed (the G8 count). Z38 passed at 33.9 and 20.3 ms.
  3. An ad hoc two-file run under the root config, so the no-freeze file ran in `node-serial`: **Z38 failed at 290 ms** right after a typecheck and lint burst, then passed (24.6/19.7 and 22.4/24.9 ms).
  4. Task 9's runs:
     - `verify` #1 failed on the pre-refresh G8 sum; Z38 30.7/25.2 ms.
     - `verify` #2 failed on the implementer's placeholder text, plus a `wp01.steps.ts` "Verify unchanged source after a real scan" timeout; Z38 22.7/25.0 ms.
     - `verify` #3 failed on a wrong count convention, plus **Z38 failing at 62.5 ms in `node-serial` under sustained load**, plus the same acceptance timeout.
     - `verify` #4 exited 0; Z38 21.6/21.1 ms.
     - `verify` #5 exited 0; Z38 22.5/27.3 ms. That run had 313 files and 3486 tests: 3485 passed, 1 skipped.
     - Task 9 also ran `npm run test` once at `f931ad8` to refresh the counts; Z38 25.0/28.4 ms.
  5. The final fix wave's runs:
     - `verify` #1 exited 0 with 3489 passed and 1 skipped of 3490; Z38 34.8/35.5 ms.
     - `verify` #2, after the docs, exited 0 with the same counts; Z38 25.4/25.2 ms.
  - **After isolation, Z38 failed 2 of the recorded runs**: 290 ms and 62.5 ms, both inside `node-serial` and both put down to machine load, which was inferred rather than measured. Isolation removed the contention inside the suite, but not the failures under machine load. The 50 ms budget stands (O2); the owner may revisit it.
- **Native and tooling:**
  - `npm run test:e2e` on 1.13.4: "Verified 40 executed native Vitest cases, including all 40 required scenarios."
  - The latest run resolved to 1.13.7 and also passed 40/40.
  - `npm run test:fallow`: 11/11.
  - `npm run analyze`: 9.
  - `npm run harness-shot`: run in Task 9. The `wp04-investigate-*`, `wp02-settings-*` and `s05-city-dark` captures were looked at, with no layout change. It was not re-run after the fix wave, which changed no UI or CSS.
- **Final whole-branch review (opus, `9644c08..e39667b`): ready with fixes.**
  - It found 0 Critical, 3 Important and 8 Minor issues:
    - a click lost after a deferred Settings render;
    - the evidence claiming a refusal test that did not exist;
    - the Z38 record calling the 290 ms run "not node-serial" and understating the isolated failures.
  - It confirmed the E14 consent path, PN1, PN2, scenarios 37–40, every trailer, the line caps and the CRLF notes. Of the 19 task-review minors it triaged 3 as fix-before-merge; everything else was a follow-up.
  - One fix wave (`9caede4`, `fe8b60e`; E12) closed all 3 Important issues and Minors 4–9, and the scoped re-review found every finding addressed. Its one new Minor is parked (E13).
  - The fix wave re-ran everything:
    - `npm run verify` twice, exit 0 both times;
    - `npm run test:e2e` on 1.13.4: 40/40, 520 s, "Verified 40 executed native Vitest cases, including all 40 required scenarios.";
    - the latest run, which resolved to 1.13.7: 40/40, 347 s;
    - `npm run test:fallow`: 11/11;
    - `npm run analyze`: 9.
- **Commit trailers:** every commit on the branch ends with the literal trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", checked one commit at a time before the push.

## Deferred minors

The final whole-branch review triaged each minor from the task reviews. It wanted three fixed before merge: the `runRefresh` comment, `preview.e2e.ts`'s header, and the lost click. The fix wave fixed those three, plus scenario 38's control comment and the two needless exports. These are the acceptable follow-ups:
- **Task 1:** the fake vault's `reconcileFolder` fires no `create` event for a parent it reconciles.
- **Task 2:**
  - `Memo` is structurally `RealPath`.
  - T8's "unrelated resolver" case survives the mutation, because the null-resolver case is the one that catches it. A test comment would say so.
- **Task 3:**
  - The commands describe title still says "rows 5–7".
  - Scenario 39's cancel could also assert `cancel-scan` and the bindings.
  - Scenario 39 asserts the modal's root at the end, not at step 5.
  - `clearBinding` is duplicated in `commands.e2e.ts` and `preview.e2e.ts`.
  - A `silentRefresh` regression shows as a 5 s timeout, not an assertion.
- **Task 4:**
  - The refusal-restore comments now take effect only once focus leaves the fields.
  - No test re-arms the wait on a new document; `moveFocus` may send a duplicate focusout.
- **Task 6:** the ordering proof is read from the position of console output.
- **Task 7:** the `app.vault._` double-cast is repeated.
- **Task 8:**
  - `hashTree` and `projectFilePaths` walk the tree the same way.
  - Scenario 40's `Record<string, unknown>[]` cast.
- **Final review:** scenario 2's `SECOND_FINDING` could be derived from the recording.
- **Final fix wave:** listeners may accumulate (E13).

