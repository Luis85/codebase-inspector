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
