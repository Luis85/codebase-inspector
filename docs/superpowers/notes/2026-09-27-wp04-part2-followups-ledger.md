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

## Pre-flight scan

(Recorded before Task 1.)

## Execution rulings

(Recorded during execution.)
