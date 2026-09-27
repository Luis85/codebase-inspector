---
project: codebase-inspector
title: WP-04 Part 2 polish follow-ups — SDD ledger (rulings)
date: 2026-09-27
branch: feat/wp-04-part2-followups
---

# WP-04 Part 2 polish follow-ups — rulings

This ledger records every ruling made while planning and executing the WP-04 Part 2 polish follow-ups, and what each one costs if it is wrong.

- **Spec:** `docs/superpowers/specs/2026-09-27-wp04-part2-followups-design.md`. It holds the inventory FU1–FU3 and FM1–FM14, the owner decisions O1–O2, the design decisions FN1–FN4, scenario 41, and the Z38 measurement record (§3.3).
- **Plan:** `docs/superpowers/plans/2026-09-27-wp04-part2-followups.md`, 5 tasks.
- **Branch:** `feat/wp-04-part2-followups`, from `8466f03`, the PR 1 head after the WP-04 Part 2 polish pass.
- **Precedent (all binding):**
  - the polish ledger (O1–O4, PP1–PP15, PQ1–PQ2, WP-04.2 Polish E1–E13);
  - the WP-04 Part 2 ledger (NP1–NP20, NPF1–NPF15, WP-04.2 E1–E22);
  - the WP-04 Part 1 ledger (IPF20 and the rest);
  - every earlier ledger.
- **Numbering:**
  - **O1…** are this pass's owner decisions;
  - **FU1…** and **FM1…** are the spec's inventory rows;
  - **FN1…** are the spec's decisions;
  - **FP1…** are planning rulings;
  - **FQ1…** are pre-flight rulings;
  - **"WP-04.2 Follow-up E1…"** are execution rulings.

  None of the two-letter prefixes (FU, FM, FN, FP, FQ) is used anywhere in the repository outside this pass (grep over the repository, `node_modules` excluded). The single letter F is taken (F14), so no single-letter prefix is used.
- Every ruling reads: **Ruling:** what — why — cost if wrong.

## Owner decisions (2026-09-27, after the measurement and before the spec)

| # | Decision |
|---|---|
| O1 | **Z38 gets a load guard.** A 2 s bare control phase runs before the modes. At a worst gap of ≥ 35 ms the case skips, naming the figure; otherwise the 50 ms budget is asserted unchanged. |
| O2 | **Scope: every confirmed item**, meaning FU1–FU3 and FM1–FM14. |

## Planning rulings

| # | Ruling |
|---|---|
| FP1 | **Ruling:** 5 tasks, in this order:<ol><li>the render wait (FU1, FU2, FM8, FM9, scenario 41);</li><li>the fast-suite minors (FM1, FM2, FM3, FM7);</li><li>the Z38 guard and the config pin (FU3, FM10);</li><li>the native minors (FM4–FM6, FM11–FM14);</li><li>evidence and verification.</li></ol>`src` changes only in Tasks 1–2, so the controller runs the full suite after Task 2. — Task 1 carries the only product fix and the only new scenario, so it lands first. Tasks 3 and 4 touch disjoint files. — Low: a mis-ordered dependency shows in the pre-flight Consumes re-check. |
| FP2 | **Ruling:** one new required scenario, 41, in `settings.e2e.ts`. No title is renamed, and FU1 gets no native scenario. — FU1's listener count cannot be observed through WebDriver without reading Obsidian's internals, and the polish E13 trace already shows no user-visible effect. A fast listener count is the honest proof. FU2 has a user-visible effect: stale rows after a reopen. — Low: an FU1 regression would show natively only as idle listeners, which the fast test catches. |
| FP3 | **Ruling (FN1's shape):** the wait moves into `src/host/settings-render-wait.ts`, and `hide()` releases it through a microtask. — `settings-tab.ts` is at 388 of 400; FU1, FU2 and the `hide()` override would pass the cap, and a file that would pass its cap is split, never compressed. The microtask is read from both bundles: `closeActiveTab()` calls `hide()` before it sets `activeTab = null`, and `openTab()` calls it before it sets the new tab. A synchronous `update()` in `hide()` would therefore redraw into the container Obsidian has just emptied, and leak the rendered items. — Low: if a later Obsidian calls `hide()` after clearing `activeTab`, the microtask is merely unneeded. If it calls `hide()` for a tab it will show again at once, the waiting render runs one tick early, with nothing focused in it. |
| FP4 | **Ruling:** changed scenarios 1, 7, 23 and 40 are shown green only. Scenarios 39 and 2 get a RED. — Their changes are behaviour-neutral refactors of test code: a shared helper moved verbatim, a type alias, a typed callback, and one shared walk with identical output. No assertion changes meaning, which is the polish precedent for T9 and T10 (spec §5 "shown green only"). Scenario 39 gains assertions, so it is shown RED under FM5's mutation. Scenario 2's derived id drives the dismissed branch, so polish T4's mutation is re-run. — Low: a refactor that silently weakened an assertion would pass green. The reviewers check each diff for that (Review Focus 4). |
| FP5 | **Ruling (FN2's shape):** the guard skips through `ctx.skip(note)`; it never passes. The threshold is O1's 35 ms, and G8 comes only from a run where the case executed. — A skip is counted and visible in every summary, while a silent pass under load would claim a measurement never made. Between the measured idle pre-run controls (≤ 25.6 ms) and the loaded ones (≥ 38.4 ms), 35 ms separates all 8 runs. — Medium: a freeze regression exercised only on loaded machines goes unseen, until an idle run. A load that starts after the control still fails the case, which is disclosed, never retried. |
| FP6 | **Ruling (corrects polish E3 and E7):** their premise that "Obsidian calls `getSettingDefinitions()` on every `display()`" is withdrawn. In 1.13.4 and 1.13.7 the only call is inside `SettingTab.update()`, and `openTab` → `renderTab` draws the stored `settingItems`. `obsidian.d.ts:6579` says otherwise, and the bundles win. E7's cost was therefore understated: Settings reopened after a close-while-waiting show stale rows, not only a stale search index. FU2 fixes it rather than keeping the limitation. — Read from both app bundles (spec FU2). — None: a correction of record. |
| FP7 | **Ruling:** a CPU-attributed budget (`process.threadCpuUsage` per gap) is not offered as a Z38 option. — Measured on this machine (Node 24.15.0): Windows accounts thread CPU in 15.6 ms ticks, and under all-core load an 80 ms wall-clock synchronous block registered 31 and 47 ms in 2 of 3 probes. So the attribution neither resolves finely nor holds under load. — Low: a work-based control might behave better, but it was not needed once O1 was decided. |
| FP8 | **Ruling (scenario 41):**<ul><li>It closes the settings window through WebDriver's `closeWindow`, the person's close, not through `app.setting.close()`.</li><li>If its control fails on 8466f03, or step 6 is already green there, Task 1 stops for a ruling (as PP6).</li></ul>— `setting.close()` is the modal's own call. The window close takes the `pagehide` path FU2 is about, and the reviewer of E7 observed no `focusout` on it. — Medium: if ChromeDriver's close does not fire `pagehide` in Electron, the scenario stays RED after the fix, and the task stops. |
| FP9 | **Ruling (FM1):** the fake announces a reconciled folder with `create`, though nothing consumes it today. — The fake's own `createFolder` and `rawCreate` announce every entry they index, so a reconciled parent is the one entry that enters its index silently. A future `create` consumer tested on the fake would otherwise miss it. — Low: whether real Obsidian fires `create` for a folder it reconciles is not probed in this pass. The fake follows the rule it already applies everywhere else, and a native probe would settle it if a consumer ever appears. |
| FP10 | **Ruling:** the 8 instrumented measurement runs (spec §3.3) are disclosed as this pass's first `npm run test` runs, each with its Z38 outcome. They were full runs of a modified test file, restored with `git checkout` and never committed. — The brief requires every `npm run test` run to be disclosed, and these ran the full suite. — None. |
| FP11 | **Ruling:** the spec, this plan and this ledger are committed together before Task 1, and the controller stops for the owner's approval there. Execution rulings are transcribed into this ledger after the final review. — The brief's Phase 1 stop. — None. |
| FP12 | **Ruling:** the native finish runs `npm run test:e2e` on the baseline 1.13.4, then once with `OBSIDIAN_VERSION=latest`, with `FALLOW_BIN` as a pure-backslash path (E10) and no `fallow.exe` running. A failure on latest is a failure of this pass (NP20). — This carries polish PP15. — Low: a new Obsidian release between the runs can turn latest red; that is reported, never retried. |

## Test runs of the pass

1. **The measurement batch** (FP10, spec §3.3): eight instrumented full `npm run test` runs at `8466f03`.
   - **r1, r3 and r6 (idle), and r4 and r7 (real load):** exit 0 with 311 files and 3489 passed, 1 skipped. Z38 passed: 30.7/21.5, 24.2/23.4, 24.8/24.7, 27.2/18.1 and 25.4/19.3 ms.
   - **r2, r5 and r8 (burn):** exit 1. Z38 failed: 50.8/41.7, 104.1/64.1 and 114.1/153.3 ms, alongside 6, 7 and 23 other load failures.
2. **Probes:** two scratch `cpu-attrib` probes (FP7), not suite runs.
3. **The controller's `npm run test` at `d665099`, after the last `src` task:** exit 1.
   - Counts: 312 files (3 failed, 309 passed); 3501 tests (3 failed, 3497 passed, 1 skipped).
   - Failures: the G8 component file count and the `src/` floor, both expected until Task 5; and the acceptance step "Verify unchanged source after a real scan", on Vitest's 5 000 ms default timeout (E3).
   - Z38 passed at 25.3/23.3 ms, before the guard.
4. **Task 3's `node-serial` runs:**
   - unchanged file under an all-core burner: fail, `hang` at 56.8 ms;
   - unchanged file idle: pass, 32.0/21.0 ms;
   - guard, idle: pass, with a control of 24.8 ms and modes of 28.9/27.0 ms;
   - guard under the burner: **skipped**, control 50.3 ms;
   - guard, idle, under the 80 ms freeze mutation: `streamed` failed at 15 360.1 ms with a control of 22.8 ms (FQ1).
5. **Task 5's runs:**
   - `npm run test` at `69dabdd`: 313 files, 2 failed (the two count checks, before the refresh); 3504 tests. Z38 passed (control/hang/streamed 23.6/25.1/19.7 ms).
   - `npm run verify` before its commit: exit 0; 313 files, 3503 passed, 1 skipped; Z38 16.6/29.2/21.8 ms.
   - `npm run verify` at `059203a`: exit 0, the same counts; Z38 17.9/29.7/28.2 ms.
   - Native 1.13.4: 40/40, "Verified 40 executed native Vitest cases, including all 40 required scenarios." (483 s).
   - Native latest, which resolved to 1.13.7: **failed 39/40**. `fallow.e2e.ts`'s cancel scenario failed its machine-wide `fallowProcessCount()` baseline, because another session's `fallow.exe` appeared mid-run (E6).
   - `npm run test:fallow` 11/11; `npm run analyze` 9; `npm run harness-shot` looked at.
6. **The final fix wave's runs:**
   - `npm run verify` at `b5a8591`: exit 0; 313 files, 3503 passed, 1 skipped; Z38 16.5/29.1/18.9 ms.
   - Native 1.13.4: **failed 39/40** on the same baseline count. It was launched with a foreign `fallow.exe` already running; another session started a `dupes` run every 1–3 s (E7).
   - Native latest (1.13.7), launched after 120 s with no `fallow.exe`: 40/40, with the same Verified line (377 s).
   - `npm run test:fallow` 11/11; `npm run analyze` 9.
   - `npm run verify` at `832758a`, after the evidence commit: exit 0, the same counts; Z38 16.7/25.2/18.1 ms.
7. **The controller's native 1.13.4 run on the final head `832758a`** (E7), launched after 120 s with no `fallow.exe`: **failed**, 39/40, with no case failing an assertion. The Vitest worker running `fallow.e2e.ts` exited with Windows code `0xC0000409` (335 s). It was not re-run (E8).

**Z38 across the pass:** it passed in every uninstrumented run. It failed only in the three instrumented burn runs and in Task 3's deliberate burner run before the guard. The guard skipped once, under the burner.

## Pre-flight scan

The scan ran on 2026-09-27 at `57cc61c`, whose `src` is identical to `8466f03`.

**Line counts:** re-measured with `wc -l`, and all match the plan's Size table.

**Consumes names:** grepped, and all found:
- `renderWhenIdle`, `renderPendingIn`, `isElementIn` and `isEditingIn` (`settings-tab.ts:37`, `:43`, `:59`, `:124`, `:138–155`);
- the mock's `hide()` (`obsidian.ts:172`);
- `moveFocus` (`settings-tab-focus.test.ts:51`);
- scenario 38's helpers (`settings.e2e.ts:26`, `:43`, `:53`);
- `reconcileFolder` and `vaultEvents` (`fake-vault.ts:204`, `:174`);
- `RealPath` and `Memo` (`investigation-notes.ts:35`, `:38`);
- `silentRefresh` and `waitForModal` (`city-view-scan-modes.test.ts:217`, `:43`);
- `ctx.skip(note)` (`plugin.d.CN87HSxv.d.ts:356`);
- in `workspace-files.ts`: `hashTree` (exported), `projectFilePaths` (module-private) and `writeReport`, whose only callers are `investigation.e2e.ts:139` and `preview.e2e.ts:163`;
- `SECOND_FINDING` and the `_` casts (`plugin-lifecycle.e2e.ts`);
- the runner's stdout handler (`fallow-runner.ts:163`).

None of the new names exists yet.

| Row | Tasks | Produces ↔ consumes / self-consistency | Finding |
|---|---|---|---|
| 1 | 1 ↔ 4 | Task 1 runs scenario 39 on its Settings change; Task 4 then edits scenario 39. | Sequential; Task 4 re-runs all of `commands.e2e.ts`. Consistent. |
| 2 | 2 ↔ 4 | Both use temporary mutations of `scan-flow.ts` (`:206` for FM7, `:207` for FM5), each reverted. | Disjoint, never committed. Consistent. |
| 3 | 2 ↔ 3 | Task 3's freeze proof temporarily edits `fallow-runner.ts`. | Disjoint. Consistent. |
| 4 | 3 ↔ 5 | A load-skip changes the skipped count; G8 must come from an executed run. | Consistent. |
| 5 | 1 ↔ 5 | `harness-shot`'s Settings captures show Task 1. | Consistent. |
| 6 | 4 | FM13 retypes `writeReport`'s edit; both callers are in Task 4's files. | Consistent. |
| T1 | 1 | Step 1's E13 RED needs the listener to stay; the file's `beforeEach` mocks `hasFocus` true. | Consistent: the plan mocks it false for the blur. |
| T3 | 3 | The freeze mutation sits in the stdout handler, and the fake's `hang` mode writes no stdout. | **Correction (FQ1).** |
| T5 | 5 | 41 executed = 41 required. | Consistent then; amended to 40 by E2. |

0 blocking, 1 correction (FQ1).

## Pre-flight rulings

| # | Ruling |
|---|---|
| FQ1 | **Ruling:** Task 3's idle freeze proof expects the failure in `streamed`; a `hang` pass under the mutation is expected. — The fake's `hang` mode writes no stdout (`fake-fallow.mjs:13`, `:40`), so the 80 ms block never runs there. — Low: the block is 80 ms per chunk, so any streamed chunk fails the budget. |

## Execution rulings

| # | Ruling |
|---|---|
| WP-04.2 Follow-up E1 | **Ruling:** after scenario 41 was GREEN on 8466f03 (FP8's stop), one more discriminating probe ran on the unchanged `src`: the settings closed from the main window with the settings document unfocused. — The implementer's diagnosis: WebDriver's `closeWindow` detaches the modal DOM before `onClose` and `hide()`. Removing the focused textarea fires `change` and a `focusout` while `document.hasFocus()` is still true, which releases the wait. Polish E7's premise ("a window closed with a field focused sends no focusout") is withdrawn for this path. — Low: one extra native run. |
| WP-04.2 Follow-up E2 | **Ruling (amends spec §5 and FU2's test; the gate stays at 40):** scenario 41 is dropped, and FU1 and FU2 land as fast-tested fixes.<ul><li>The E1 probe was GREEN too, with its control passing. The focus evidence was `settingsFocused: true`: WebDriver's `switchToWindow` moves no OS focus.</li><li>Every person-driven close (the window's X, which re-activates an unfocused window first, Ctrl+W, or `setting.close()` while the settings window has focus) removes the focused field while its document has focus. Chromium's removal `focusout` then releases the wait before `hide()`.</li><li>The wait outlives a close only when the settings document is unfocused at removal: quitting, the plugin unloading, or a programmatic close from another window. A tab switch keeps the wait too, because focus on a nav item stays inside the document. In these cases `hide()` is the release.</li><li>The tab-level fast test, RED on 8466f03, is its proof.</li></ul>— Low: FU2 has no native guard, and its uncovered paths are programmatic. |
| WP-04.2 Follow-up E3 | **Ruling:** the acceptance step "Verify unchanged source after a real scan" timing out at Vitest's 5 000 ms default is recorded, not fixed, in this pass. — It predates the pass (polish `verify` #2 and #3), recurs under load, and no task here touches the scan path. It is disclosed wherever it fails, and a follow-up task is suggested. — Low: a `verify` can fail on it, which is then disclosed. |
| WP-04.2 Follow-up E4 | **Ruling (amends spec FM5):** scenario 39's cancel step gains the probe's positive control, `commandAvailable(browser, 'scan-codebase')` true, beside `cancel-scan` false. — The rule "every negative assertion has a positive control in the same test" binds over the row as written, and a `cancel-scan` true control would need a scan held in flight. — Low: the control proves the probe can answer true here, not that `cancel-scan` specifically would. The snapshot equality still catches a scan wrongly started by a cancel. |
| WP-04.2 Follow-up E5 | **Ruling:** Task 5's one `sed -i` on the two CRLF notes, which is forbidden and stripped their CRLF, is accepted as repaired, as polish E6 was. — The controller verified the committed notes byte-level (every line CRLF, 0 bare LF), and the diff carries only content changes. — None. |
| WP-04.2 Follow-up E6 | **Ruling:** Task 5's latest native run is void as gate evidence and was not re-run then. — Its stated precondition (no `fallow.exe` running, E10) was broken mid-run by another session's process, which `fallow.e2e.ts`'s machine-wide `fallowProcessCount()` counts. The native gate runs again on the final head. A follow-up task to scope the count to the test's own processes is suggested. — Medium: a foreign `fallow.exe` can fail any later run the same way. |
| WP-04.2 Follow-up E7 | **Ruling:** the fix wave's 1.13.4 native run is void. — It was launched with a foreign `fallow.exe` already running, against E10, and it failed only on the machine-wide baseline count. The controller ran 1.13.4 once more on the final head, launched only after 120 s with no `fallow.exe`. Both runs are disclosed, and this is a first valid run, not a retry of a valid one. — Medium: a foreign process starting mid-run fails the same scenario, which is then the pass's reported result. |
| WP-04.2 Follow-up E8 | **Ruling:** the E7 run failed differently: the Vitest worker running `fallow.e2e.ts` crashed with Windows code `0xC0000409` after 39 cases passed. It is disclosed and not re-run (no retries). The 1.13.4 run of record is Task 5's 40/40 at `059203a`. — Its native inputs are the final head's:<ul><li>`tests/e2e`, `scripts` and the build configuration are unchanged since `059203a`;</li><li>building the two `src` files as they were there gives a `dist/main.js` (SHA-256 `b47599725e07…6485c2`) and `dist/styles.css` byte-identical to the final head's, because the only `src` change since is comment text.</li></ul>`fallow.e2e.ts` also passed on latest on that same bundle. — Medium: the final head's commit has no green 1.13.4 run of its own, only a byte-identical build's. The owner may ask for one more run. |

Also recorded during execution:
- **Fix rounds:**
  - Task 4 needed one: E4's positive control.
  - Task 5 needed one: four false claims in the evidence prose.
  - Tasks 1–3 were approved at their first review. Task 1 stopped twice under FP8 and was resolved by E1 and E2.
- **Final whole-branch review (opus, `8466f03..cd7ef7f`): ready with fixes.**
  - It found 0 Critical and 2 Important issues, both in the evidence notes: the new tests were misdescribed, in places inverted, and the final `verify` was a placeholder. It also found three Minors to fix before merge:
    - the hide comments on the tab-switch release;
    - exact listener counts in the tab test;
    - the Task 4 evidence bullet.
  - It confirmed the render wait under every focus/hide ordering, that the Z38 guard cannot mask a freeze on an idle machine, the native minors, the counts and every trailer.
  - One fix wave (`b5a8591`, `832758a`) closed all five, and the scoped re-review found every finding addressed.
  - It triaged these as acceptable follow-ups: `hidden()`'s microtask skipping the focus check (FN1), both Task 3 cosmetic notes, and both Task 4 notes.
- **Commit trailers:** every commit on the branch ends with the literal trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", checked one commit at a time before the push.

## Deferred minors

The final review triaged these as acceptable follow-ups:
- **Task 1:** `hidden()`'s microtask render skips the focus check (FN1-mandated). It was not observed to rebuild a focused field.
- **Task 3:**
  - The header's guard note is three wrapped lines where the brief said one.
  - An informational oxlint comment on an already module-scoped guard, following the repo's convention.
- **Task 4:**
  - The brief's stale FM4 line reference.
  - FM12 also dropped the unused `prefix` parameter.
- **Out of scope, suggested as follow-up tasks:** both were done, and are recorded below.
  - E3: an explicit timeout for the acceptance scan step.
  - E6 and E7: a native fallow process count scoped to the test's own processes.

## Follow-ups closed after the pass (2026-09-27)

Both follow-up tasks ran in separate sessions from `9b219df`. Each branch got a final review (E3 on sonnet, E6 on opus), with 0 Critical and 0 Important findings. The controller stacked them on a local branch, `feat/wp-04-followups-e3-e6`, and on the owner's approval fast-forwarded it onto PR 1 (`9b219df..da42e9f`).

- **E3, closed (`4a4a073`).**
  - `runFeature` takes a per-scenario `timeouts` map, and a key naming no scenario throws before anything registers. "Verify unchanged source after a real scan" gets 60 s.
  - Measured: 0.40–0.66 s alone, 1.7–3.9 s in a full run, and up to 27.4 s under 22 burner processes. A structural guard pins the registered timeout.
  - No assertion changed. The evidence heading became 316 files and 3509 tests.
- **E6 and E7, closed (`d038b63`, `b972d83`, `97a47b6`, `da42e9f`).**
  - `fallowProcessCount(root)` walks one `Win32_Process` snapshot down from the Obsidian renderer's pid; a child counts only if it was created after its parent.
  - `fallow.e2e.ts`'s cancel scenario runs a foreign `fallow.exe` throughout (a renamed `PING.EXE`) and asserts that the machine-wide count sees it while the scoped count does not.
  - It was RED before the fix and under the machine-wide mutation.
  - `97a47b6` folds in the review's hardening: a 30 s timeout on the process listing, a foreign control that lives at most 330 s, and temp-folder cleanup if its spawn fails.
- **Ruling (amends E10 and FP12):** a native run no longer needs "no `fallow.exe` running" at launch. — The fallow scenario's count is scoped to the test's own Obsidian, and its foreign control proves that another process is ignored. — Low: heavy CPU load from other sessions can still time out native scans, so the landing runs waited for load under 50 %.
- **Runs on `da42e9f`:**
  - `npm run verify`: exit 0; 314 files, 3508 passed, 1 skipped. Z38 passed (control/hang/streamed 25.0/23.1/22.1 ms).
  - Native latest (1.13.7): 40/40, "Verified 40 executed native Vitest cases, including all 40 required scenarios."
  - Native 1.13.4: **failed and was not retried.** 36 of 40 passed, then the Vitest worker crashed with `0xC0000409` in `commands.e2e.ts` before its 4 cases reported. `fallow.e2e.ts` passed 3/3, with a scoped baseline of 0 while the foreign control ran.
  - `npm run test:fallow` 11/11; `npm run analyze` 9.
  - The owner chose to push with this disclosed.
- **Open observation:** the `0xC0000409` worker crash has now happened in 2 of the last 3 runs on 1.13.4 (E8's run, in `fallow.e2e.ts`, and this one, in `commands.e2e.ts`). No latest run crashed. Its cause, whether the 1.13.4 runtime or load from other sessions, is not established.
