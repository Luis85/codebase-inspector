---
project: codebase-inspector
title: WP-04 Part 2 polish follow-ups (design)
date: 2026-09-27
status: for owner approval
deliverable: docs/deliverables/Test Evidence.md
---

# WP-04 Part 2 polish follow-ups

## 1. Outcome and scope

This pass closes the follow-ups the WP-04 Part 2 polish pass left open, without widening scope:
- E13, the Settings listener cleanup;
- E7, a Settings window closed while a render waits;
- the Z38 no-freeze flake;
- every item in the polish ledger's "Deferred minors".

**Gate:** every change keeps or strengthens the native gate. It grows from 40 to **41** required scenarios (Â§5). No existing title is renamed. A bug found natively is fixed RED first, with a fast-suite test as well.

**Out of scope** (unchanged unless the owner asks):
- the M80/F14 renderer retry cap and M95 pointer capture;
- the spec Â§7 root-unavailable producer and Y19 external `data.json` edits;
- pop-out windows (NE20), axe and mobile (IP51), and CI (O3);
- the owner's manual Part 7 check (item 3).

**Binding:**
- the polish spec (PN1â€“PN7);
- the polish ledger (O1â€“O4, PP1â€“PP15, PQ1â€“PQ2, WP-04.2 Polish E1â€“E13, its final-review record and its "Deferred minors");
- the WP-04 Part 2 spec and ledger (NE1â€“NE20, NPF1â€“NPF15, WP-04.2 E1â€“E22);
- the WP-04 Part 1 spec and ledger (IN42â€“IN51, IPF20);
- the WP-01 spec Â§4 frozen contracts, every earlier spec and ledger, and `docs/deliverables/*.md`.

Planning rulings are **FP1â€¦** in `docs/superpowers/notes/2026-09-27-wp04-part2-followups-ledger.md`, and this spec cites them where it depends on one.

## 2. Owner decisions (2026-09-27)

| # | Decision |
|---|---|
| O1 | **Z38 gets a load guard.** Before the two modes, the no-freeze case samples a 2 s bare control phase with no child running. If the control's worst gap is **â‰¥ 35 ms**, the machine cannot hold a 50 ms budget, so the case is skipped, with the control's figure as the reason. Otherwise the 50 ms budget is asserted unchanged. A skip is visible in the run summary and is disclosed. |
| O2 | **Scope: every confirmed item.** That is FU1â€“FU3 and FM1â€“FM14 (Â§3). |

## 3. Inventory at 8466f03

Every row was checked against the code at `8466f03`: the product rows by the controller, the minors by a read-only audit whose evidence the controller spot-checked. Obsidian's behaviour was read from the 1.13.4 and 1.13.7 app bundles in `.obsidian-cache/obsidian-app/*.asar`. **Confirm** means the finding is real and this pass changes it. The inventory confirms all 17 items and rejects none.

### 3.1 Product follow-ups and Z38

| # | Item | Current behaviour and evidence | Change | Test |
|---|---|---|---|---|
| FU1 | **E13: listeners accumulate** | <ul><li>`renderWhenIdle()` (`src/host/settings-tab.ts:138â€“155`) adds a `focusout` listener when it waits (`:147â€“154`), and only that listener removes itself (`:149`).</li><li>The immediate branch (`:140â€“143`) sets `renderPendingIn = null` and renders, but leaves an earlier wait's listener attached.</li><li>A later wait then sees `renderPendingIn !== doc` (`:145`) and adds a second listener.</li><li>Harmless in behaviour (polish E13): each listener re-checks before acting. But listeners pile up until focus next leaves the page's controls.</li></ul> | **Confirm** (FN1). The wait holds its listener. The immediate branch and a new wait both remove any earlier listener first, so at most one is ever attached. | Fast (jsdom), counting the attached listeners through `addEventListener`/`removeEventListener` spies:<ul><li>at the tab level in `tests/component/settings-tab-focus.test.ts`, RED on 8466f03;</li><li>at the module level in `tests/component/settings-render-wait.test.ts`.</li></ul> |
| FU2 | **E7: a Settings window closed while a render waits** | <ul><li>Polish E7 accepted that a window closed with a field focused sends no `focusout`, so the waiting `update()` never runs. It claimed that "Obsidian calls `getSettingDefinitions()` on every `display()`", so only the search index would stay stale. E3 makes the same claim.</li><li>**That claim is false in 1.13.4 and 1.13.7.** In both bundles `getSettingDefinitions()` is called only from `SettingTab.update()` (`this.settingItems=this.getSettingDefinitions(), â€¦, refreshSearch(), refreshCurrentPage(this)`). Opening a tab (`openTab` â†’ `renderTab`) draws the **stored** `settingItems`. So Settings reopened after such a close show the rows from before the write, until the next refresh.</li><li>**A close signal exists.**<ul><li>1.13.4: the popout's `pagehide` calls the modal's `close()`.</li><li>1.13.7: `Modal.onWindowClose` does the same on `pagehide`.</li><li>In both, the settings modal's `onClose` calls `closeActiveTab()`, which calls the active tab's `hide()`, inside a `try`. `openTab` calls the previous tab's `hide()` too.</li></ul></li><li>The tab does not override `hide()`, and Obsidian's default is empty.</li></ul> | **Confirm; fix** (FN1). `hide()` releases a waiting render: it removes the listener and runs `update()` in a microtask. By then Obsidian has cleared or replaced `activeTab`, so `update()` stores the definitions and refreshes the search without drawing into the hidden container. With no render waiting, `hide()` does nothing. | <ul><li>**Fast:** `settings-render-wait.test.ts` (release on hide, no-op without a wait); `tests/component/settings-tab-focus.test.ts` (the tab's `hide()` wiring).</li><li>**Native:** scenario 41 (Â§5), RED on 8466f03.</li></ul> |
| FU3 | **Z38: the no-freeze flake** | <ul><li>`tests/integration/fallow-no-freeze.test.ts:14â€“35` asserts a worst wall-clock event-loop gap under 50 ms (Part 7 decision 18) in `hang` and `streamed`. It runs alone in `node-serial` (polish O2, PN6).</li><li>After isolation it still failed twice, at 290 ms and 62.5 ms (polish ledger).</li><li>**Measured at 8466f03** (Â§3.3) with an instrumented copy, never committed. Every gap was recorded in a bare control phase with no child, then in the two modes, over 8 full `npm run test` runs.<ul><li>**No load and a real typecheck+lint load (5 runs):** 5/5 pass; worst gaps 18â€“31 ms, p50 15.8â€“16.4 ms (Windows' 15.6 ms timer tick).</li><li>**All-core synthetic load (3 runs):** 3/3 fail (50.8; 104.1/64.1; 114.1/153.3 ms). The bare control reached â‰¥ 50 ms in 2 of those 3 with no child at all.</li></ul></li><li>So under saturation the wall-clock gap measures the OS scheduler, not the runner.</li><li>Per-thread CPU attribution (`process.threadCpuUsage`) cannot replace it on Windows. It is accounted in 15.6 ms ticks, and under load an 80 ms synchronous block registered only 31â€“47 ms in 2 of 3 probes.</li></ul> | **O1** (FN2): a load guard on a pre-run bare control phase, threshold 35 ms. The 50 ms budget, the modes and the timeout are unchanged. | <ul><li>**Idle:** the case asserts and passes.</li><li>**All-core load:** the case skips, naming the control's figure.</li><li>**A freeze still fails when idle:** under a temporary 80 ms synchronous block in the runner's stdout handler, the idle run fails the 50 ms assertion and is not skipped.</li><li>The config pin FM10 guards `node-serial`'s place.</li></ul> |

### 3.2 The polish ledger's deferred minors

| # | Minor | Current code and evidence | Change | Proof |
|---|---|---|---|---|
| FM1 | The fake vault's `reconcileFolder` fires no `create` | `tests/fixtures/fake-vault.ts:204â€“217` indexes the parent with no `trigger`. `createFolder` (`:280`) and `rawCreate` (`:254`) both fire `create`. No `src` or test consumer listens for `create` today. | **Confirm.** Fire `create` for the reconciled folder, as the fake's other index entries do. | A new case in `tests/unit/fake-vault.test.ts`: `diskOnly('a','folder')`, then `createFolder('a/b')`, gives `create` for `a` and then `a/b`. RED without the trigger. |
| FM2 | `Memo` is structurally `RealPath` | `src/host/investigation-notes.ts:35` `type RealPath = (path: string) => string \| null`; `:36â€“38` `type Memo = (path: string) => string \| null`, used at `:117` and `:125`. | **Confirm.** `type Memo = RealPath;`, keeping its doc comment. | Behaviour-neutral: typecheck and suite. |
| FM3 | T8's "unrelated resolver" case survives the mutation | `tests/host/investigation-notes-alias.test.ts:97â€“109`. The `/unrelated${path}` prefix preserves every relation (`relativeInside` is segment-wise), so under "`sourceNotePath` compares only the resolved pair" it still answers `docs/guide.md`. Only the null row catches the mutation. | **Confirm; better than a comment.** Add a third row whose resolver maps each path to its own flat folder, relating no two paths. The existing row is relabelled "relation-preserving". ES2020: `split('/').join('_')`, not `replaceAll`. | The polish plan's T8 mutation is RED on the new row. |
| FM4 | The commands describe title still says "rows 5â€“7" | `tests/e2e/commands.e2e.ts:1` and `:53`; the file also holds scenario 39 (`:153`). The gate matches the test name only (`scripts/check-native-results.mjs:16`, `test.title`, where Vitest's `title` is the test's own name), so a describe rename cannot rename a required scenario. | **Confirm.** Say "rows 5â€“7 and 39" at `:1` and `:53`. | Behaviour-neutral; the gate is untouched. |
| FM5 | Scenario 39's cancel and step-5 checks | `commands.e2e.ts:153â€“209`. `offered` is read at `:192` but asserted only at `:206`, after the approval. The cancel (`:194â€“200`) asserts the snapshot and the profile, but not the bindings or `cancel-scan`. | **Confirm.** Assert `offered.endsWith(copy)` right after `:192`. After the cancel, read `pluginData` once and assert the bindings are unchanged and `commandAvailable('cancel-scan')` is false. | RED under the mutation `resolvedRoot: storedScope.rootPath` (`src/host/scan-flow.ts:207`): it fails at step 5, not after a full rescan. |
| FM6 | `clearBinding` is duplicated | `commands.e2e.ts:41â€“51` (a function) and `preview.e2e.ts:116â€“125` (inline, without the final Reconnect poll, which `inspector.reconnect` polls anyway, `inspector.ts:91â€“92`). | **Confirm.** Move it verbatim into a new `tests/e2e/inspector-binding.ts` (NP2: `inspector.ts` is at 400) and call it from both. | Behaviour-neutral: scenarios 23 and 39 stay green. |
| FM7 | A `silentRefresh` regression shows as a 5 s timeout | `tests/host/city-view-scan-modes.test.ts:216â€“224` awaits `view.startScan()` (`:219`) before asserting no modal (`:220`). A regression that opens the modal leaves `openScopeModal` unanswered, so the test dies at Vitest's 5 000 ms default. | **Confirm.** Start the scan without awaiting it. Poll for a modal within the file's own 50-microtask budget (`waitForModal`, `:43â€“50`), then assert none and await the scan. | Under the mutation `if (boundRoot !== null)` (`scan-flow.ts:206`), it fails as an assertion, not a timeout. |
| FM8 | The refusal-restore comments | `settings-tab.ts:264â€“265`, `:277â€“279`, `:300â€“301` say `refresh()` "puts the stored value back in the field". Since PN4 that happens once focus leaves the fields. | **Confirm.** Each says so. `:322â€“325` ("re-read back into entries") is already true. | Comments only. |
| FM9 | No re-arm test; `moveFocus` sends a duplicate `focusout` | `tests/component/settings-tab-focus.test.ts:50â€“54` dispatches a `focusout` after `focus()`/`blur()`, which already fire one in jsdom 30.1.0 (`HTMLOrSVGElement-impl.js`, checked). No case moves the tab to a second document (`:145`/`:150` handle it). | **Confirm.** `moveFocus` only moves focus. A new case in `settings-render-wait.test.ts` arms on one document, then on an iframe's document, and releases once there. | The trim is behaviour-neutral. The re-arm case is RED under the mutation `if (pending !== null) return;` in place of the same-document check. |
| FM10 | The Z38 ordering proof is read from console order | `vitest.config.ts:48â€“49` and `:80â€“84`, with the claim in its comments. The polish plan's proof (`plans/2026-09-26-wp04-part2-polish.md:488`) is the position of the output. No test pins the config. | **Confirm.** A new `tests/build/vitest-projects.test.ts` imports the config. It asserts that `node-serial` includes exactly the no-freeze file, that its `groupOrder` is above every other project's, and that `node` excludes the file. | RED with `groupOrder: 0`, or without the exclude. It pins the configuration; Vitest's runtime order is still shown only by output order. |
| FM11 | The `app.vault._` double-cast is repeated | `tests/e2e/plugin-lifecycle.e2e.ts:97` and `:101` repeat `as unknown as { _: Record<string, unknown> }`. | **Confirm.** One module type next to `ProbeWindow` (`:26`), used at both. | Behaviour-neutral (typecheck). |
| FM12 | `hashTree` and `projectFilePaths` walk alike | `tests/e2e/workspace-files.ts:27â€“36` and `:49â€“58`: the same sorted recursive walk, differing only in the leaf. | **Confirm.** One private `walk(root, onFile, onDir?)` that both use. | Behaviour-neutral: scenarios 7 and 40 and every `hashTree` equality stay green. |
| FM13 | Scenario 40's `Record<string, unknown>[]` cast | `tests/e2e/investigation.e2e.ts:140` and `:143`; a sibling cast at `preview.e2e.ts:164`. Both come from `writeReport`'s untyped `edit` (`workspace-files.ts:105`). | **Confirm.** `workspace-files.ts` types the recording's `check.unused_exports` entries once, and `edit` receives that type. Both casts go. | Behaviour-neutral (typecheck). |
| FM14 | Scenario 2's hard-coded `SECOND_FINDING` | `plugin-lifecycle.e2e.ts:35â€“37` hard-codes `'UN-07f110ff'`, used at `:195` and `:237`. The recording has one `unused_exports` entry (`src/barrel/x.ts`, `x`), whose id the normaliser derives. The audit recomputed it as `UN-07f110ff`. | **Confirm.** A sibling of `cycleFinding` in `workspace-files.ts` returns the recording's `unused-exports` finding on `src/barrel/x.ts`, and scenario 2 uses it. | Green, plus polish T4's mutation (the save-dismissal skips its save) re-run RED, because the derived id drives the dismissed branch. |

### 3.3 Z38 measurement record

These were instrumented runs at `8466f03`: the committed file with every gap recorded and the assertions moved after the phases, restored with `git checkout` afterwards. Each run was a full `npm run test` driven by a scratch script, with machine CPU sampled each second.
- **Loads:**
  - `idle`: nothing added;
  - `burn`: 22 busy Node processes, one per logical CPU;
  - `real`: a loop of `npm run typecheck` then `npm run lint` in the same worktree.
- **Columns:** "Z38" is the modes' worst gaps; "control" is the bare 2 s phase before and after the modes. p50 is the modes' median gap.

| Run | Load | Exit | Suite | Z38 hang / streamed | Control before / after | p50 | CPU (no-freeze window) |
|---|---|---|---|---|---|---|---|
| r1 | idle | 0 | 311 files, 3489 passed, 1 skipped | 30.7 / 21.5 | 24.3 / 24.7 | 15.9 | not sampled |
| r2 | burn | 1 | 7 failed, including Z38 | **50.8** / 41.7 | 38.4 / 51.4 | 29.5 | not sampled |
| r3 | idle | 0 | as r1 | 24.2 / 23.4 | 25.3 / 33.0 | 15.8 | 34 % |
| r4 | real | 0 | as r1 | 24.8 / 24.7 | 25.2 / 25.2 | 15.7 | 52 % |
| r5 | burn | 1 | 8 failed, including Z38 | **104.1** / **64.1** | 50.9 / 53.0 | 29.9 | 91 % |
| r6 | idle | 0 | as r1 | 27.2 / 18.1 | 24.0 / 24.8 | 15.9 | 27 % |
| r7 | real | 0 | as r1 | 25.4 / 19.3 | 25.6 / 23.7 | 15.9 | 33 % |
| r8 | burn | 1 | 24 failed, including Z38 | **114.1** / **153.3** | 39.9 / 38.6 | 17.5 | 91 % |

- **Why 35 ms:**
  - The five idle and real pre-run controls peaked at 25.6 ms, and every idle or real control at 33.0.
  - The three burn pre-run controls were 38.4, 50.9 and 39.9.
  - Under O1's guard, r2, r5 and r8 would have skipped, and r1, r3, r4, r6 and r7 would have asserted and passed.
- **The other failures:** the burn runs' non-Z38 failures (timeouts in `fallow-runner`, `no-source-writes`, `fallow-report-reader` and the acceptance "Verify unchanged source after a real scan") are load, not this pass's concern.
- **Not reproduced:** the real typecheck+lint load did not reproduce the recorded 62.5 and 290 ms failures, whose load was never measured.

## 4. Decisions

- **FN1 â€” One Settings render wait, which `hide()` releases (FU1, FU2, FM9).**
  - **The module:** the wait moves out of `settings-tab.ts` into a new `src/host/settings-render-wait.ts`, with `isElementIn` and `isEditingIn` moved verbatim. It exports `createRenderWait(doc: () => Document, render: () => void, onError: (e: unknown) => void): { request(): void; hidden(): void }`.
  - **`request()`** keeps `renderWhenIdle()`'s rules unchanged: render at once unless a field of the document holds focus, and release only when focus leaves the page's controls with the document focused, re-checking on release. The state is one `{ doc, listener } | null`.
    - The immediate branch removes any held listener before rendering (FU1).
    - A wait on a document already waiting returns.
    - A wait on another document first removes the earlier listener.
  - **`hidden()`**, when a render waits: it removes the listener, clears the state and queues `render` in a microtask (FU2). A deferred render, whether released by `focusout` or by `hidden()`, passes a throw to `onError`. The immediate branch still throws to its caller, as `refresh()` does today.
  - **The tab:**
    - `refresh()` calls `request()`;
    - it gains `override hide(): void { super.hide(); this.renderWait.hidden(); }`;
    - `onError` is `showFailure`.
  - **Size:** `settings-tab.ts` shrinks from 388 lines.
  - **Why a microtask:** Obsidian calls `hide()` from `closeActiveTab()` before it sets `activeTab = null`, and from `openTab()` before it sets the new tab. `refreshCurrentPage(this)` then draws nothing for this tab.
- **FN2 â€” The Z38 load guard (O1, FU3).**
  - **The guard:** `fallow-no-freeze.test.ts` samples a 2 s bare control phase with the test's own sampler (a 10 ms `setInterval`, the worst gap) before the modes. It always prints `[no-freeze] control: largest event-loop gap N ms`.
    - When N â‰¥ 35 (`LOADED_CONTROL_MS`, with the measured justification of Â§3.3 in its comment), it calls `ctx.skip(<the figure and the reason>)`, and no mode runs.
    - Otherwise `hang` and `streamed` run and assert `< 50` exactly as today.
  - **Unchanged:** the modes, the 50 ms budget, the timeout and `node-serial`.
  - **What it cannot guard:** a load that begins after the control still fails the case. Such a failure is disclosed, never retried.
- **FN3 â€” Minors change tests only, except FM2 and FM8.** FM2 is a type alias and FM8 comments. No other `src` changes outside FN1.
- **FN4 â€” Native discipline (PN7 carried over).**
  - One fresh session per test, `retry: 0`, `expect.poll`.
  - A positive control for every negative assertion.
  - Obsidian's words are never matched (IPF20); plugin words come only from copy constants or `ROUTE_META` (E6, E7).
  - Settings are driven in their own window (NPF7), and a refusal is never asserted as a throw (NPF13). Timeouts follow NP5.

## 5. Scenarios (exact titles appended to `tests/e2e/required-scenarios.json`)

| # | File | Title | RED proof | Positive control |
|---|---|---|---|---|
| 41 | settings | `a setting being typed when the settings window closes shows the write made elsewhere once the settings reopen` | RED on 8466f03: the reopened page shows the folder from before the write | Before the close, the tab's own entries show the write while the open page's notes folder field still shows the old folder, so the render did wait. |

Scenario 41's steps:
1. Type into Excluded paths, as scenario 38 does.
2. Switch to the main window and write the notes folder elsewhere. Poll the tab's entries until they show the write.
3. Switch back to the settings window and read the notes folder field (the control) without moving focus.
4. Close the settings window as a person does, through WebDriver's `closeWindow` on its handle, and wait until no window shows the settings.
5. Reopen the codebase's settings and expect the notes folder field to show the write.

**Changed scenarios** (titles unchanged):
- **39:** step-5 root and cancel checks (FM5); RED under FM5's mutation.
- **2:** the derived second finding (FM14); green, plus the T4 mutation re-run RED. Its FM11 cast change rides along.
- **1:** the FM11 cast change only; shown green.
- **23:** the shared `clearBinding` (FM6); shown green.
- **40:** typed `edit` (FM13); shown green.
- **7:** `projectFilePaths` through the shared walk (FM12); shown green.

FP4 rules on the green-only ones.

## 6. Verification and evidence

- **`npm run verify`** exits 0. Every `npm run verify` and `npm run test` run in this pass is disclosed with its Z38 outcome: pass, fail with figures, or load-skip with the control's figure. No run is presented alone as a cherry-picked pass.
- **`npm run test:e2e`:** on the baseline 1.13.4 it prints "Verified N executed native Vitest cases, including all 41 required scenarios", each run exactly once. It also runs once with `OBSIDIAN_VERSION=latest`, with the resolved version recorded, `FALLOW_BIN` set (E10), and no `fallow.exe` running.
- **`npm run test:fallow`** passes with the same `FALLOW_BIN`.
- **`npm run analyze`** stays at 9.
- **`npm run harness-shot`** runs, and the Settings captures are looked at.
- **The evidence counts are refreshed once:**
  - the gate-evidence G8 table and its mirror in the implementation report;
  - `docs/deliverables/Test Evidence.md`'s native paragraph (40 â†’ 41);
  - the two count tests.

  The G8 figures come from a run in which the no-freeze case executed. A load-skipped run is disclosed but does not supply G8.

## 7. Limitations (known at design time)

- **FN1:**
  - A render waiting when Settings close runs once, in a microtask after `hide()`.
  - Text typed into a field when its window closes is committed only if the browser fires `change`. This pass does not change that.
  - The E12 limitation stands: a render waits while focus rests on a button whose action never refreshes.
- **FN2:**
  - On a loaded machine the no-freeze check does not run.
  - A load that starts after the control still fails the case.
  - The threshold rests on eight measured runs on this machine.
