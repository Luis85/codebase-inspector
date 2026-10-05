---
project: codebase-inspector
title: WP-02 Part 7 polish pass — SDD ledger (rulings)
date: 2026-09-23
branch: feat/wp-02-part7-polish
---

# WP-02 Part 7 polish pass — rulings

This ledger records every ruling made while planning and executing the polish pass, and what each one costs if it is wrong. The pass closes the deferred findings and open gaps listed in the verified open-items inventory (taken at d42a2c2, the PR #1 head).

- Spec: none new. The binding authorities are the Part 1–7 specs and ledgers, plus the amendments below (L2, L3, L4).
- Plan: `docs/superpowers/plans/2026-09-23-wp02-part7-polish.md`.
- Precedent, all binding:
  - the Part 3 ledger (R1–R9, E1–E55), cited as E<n>;
  - the Part 4 ledger (S1–S27, X0–X19, E1–E22), cited as "Part 4 E<n>";
  - the Part 5 ledger (T1–T32, E1–E25), cited as "Part 5 E<n>";
  - the Part 6 ledger (U1–U51, E1–E49), cited as U<n> and "Part 6 E<n>";
  - the Part 7 ledger (K1–K49, PF1–PF18, E1–E21), cited as K<n>, PF<n> and "Part 7 E<n>".
- Numbering: planning rulings here are L1…; execution rulings are "Polish E1"….
- Item ids (A1, B1, C1, …) are the inventory's; the plan's item → task table maps each to exactly one task.
- Every ruling reads: **Ruling:** what — why — cost if wrong.

## Planning rulings

### The controller's scope rulings (binding)

| # | Ruling |
|---|---|
| L1 | **Ruling:** IN scope are every OPEN item of the inventory's candidate Tasks 1–8: A1–A10 and G2; B1–B10; C1–C17 and C19; D1–D5; E1–E9 and E11–E14; F1–F5; G1 and G3–G7; X1, H1–H6 and D6. Nothing else is changed — the inventory is verified at d42a2c2 with file:line evidence, and a polish pass that grows its own scope stops being reviewable — low: an item found later is parked for the owner, not added here. |
| L2 | **Ruling (amends K41, mild):** C1 is IN. `executableName` also becomes available independently of the binding view: `FallowAnalysisService.executableName` (read-only, the inspector's own) and the analysis store's `executableName`. `AnalyzerBindingView.executableName` stays — K41 put the name only on the view, so a failed data.json read left the path hint without it and POSIX got the Windows hint; the view keeps it so no Part 7 consumer changes — none: one more read-only member on the service and its test double. |
| L3 | **Ruling (amends U27, Part 6 spec §4 "screens keep generic"):** E1 is IN. Every review-writing screen maps a `ReviewStoreError` code to `REVIEW_STORE_FULL`, `REVIEW_STORE_UNSUPPORTED` or `REVIEW_SAVE_UNREPRESENTABLE`; any other failure keeps the screen's own generic text. `ReviewStoreError` and `ReviewStoreErrorCode` move from the durable adapter to the port module (`src/ui/stores/ports/review-repository.ts`) so a screen can test for it without a ui → adapters import — the PR itself lists the mapping as an open follow-up, and "could not save" hides a 1 MB limit the user can act on — low: a mapping that swallowed a real error would hide it, so only the store's own refusal is mapped (Review Focus 2). |
| L4 | **Ruling:** D6 is a documentation correction only: spec §2's row `SETTINGS_FALLOW_EXE_NAME` is corrected in place to the shipped `SETTINGS_FALLOW_EXECUTABLE_NAME`, marked "(corrected in the polish pass, polish ledger L4)"; the constant is not renamed — the Part 7 E17 precedent: documentation of what shipped, not a design change — none. |
| L5 | **Ruling (OUT):** C18, the no-freeze gate's 50 ms budget, is not changed. The budget is spec Z38 (with K18); this pass only records the observed margin in the gate evidence (H6) — changing a spec gate needs the owner — medium: the gate can still flake on a loaded machine; the recorded margin makes a flake diagnosable. |
| L6 | **Ruling (OUT):** S1 (a cap on `CityViewport` self-reconstruction; M80, tied to OWNER-DECISION F14), S2 (`setPointerCapture` on an edge drag; M95), S3 (a producer for `root-unavailable`; spec §7) and E10 (`onExternalSettingsChange`; Y19) are not changed — each one changes an approved decision and needs an owner decision first — low to medium: each risk stays as the inventory states it. |
| L7 | **Ruling (OUT):** every OWNER-DECISION item (11: F2 packing, F14 Retry 3D, SourceIdentity naming, the layering lint, M108 concurrency, the wide-leaf city size, the M116 search re-skin, the muted-token claims, Option B hover contrast and its measured gate, the deliverable status and integration step (K36/K47), the 820 px threshold) stays open — they are the owner's by definition — none for this pass. |
| L8 | **Ruling (OUT):** every NOT-FIXABLE-HERE item (28, including the manual host check for acceptance (3), the NOT PERFORMED accessibility rows, the untried third-party theme, the Windows direct-child kill, the unrun POSIX paths, libuv's Windows environment, fallow's ignored `--fail-on-issues`, the design's own limits, the force-quit gap, the synchronous final parse, the inferred machine identity, the frozen `getCamera`/`SourceReference`/`EntityId`, vendor and host behaviour, upgrade-time checks and the external citations) stays open — each needs real hardware, a real host, a human, an upstream change or an owner-approved spec change — none for this pass. |

### Design rulings from planning

| # | Ruling |
|---|---|
| L9 | **Ruling:** eleven tasks, in this order: 1 (runner, adapters, process guard), 2 (application/analysis), 3a (binding truth), 3b (the rest of the analysis UI), 4 (settings), 5a (evidence truth and a11y), 5b (review store and adapter refactors, E1), 6 (older WP-02 screens), 7 (test hygiene), 8 (dead code and docs), 9 (full verification and evidence, controller). A later task never rewrites an earlier task's lines; where two tasks share a file the plan names it (`audit-copy/fallow-run.ts` 3a → 3b → 4; `ConnectFallowDialog.vue` 3a → 3b → 6; `SourcesScreen.vue` 3a → 3b → 6; `review-store.ts` 5a → 5b; `findings.ts`/`evidence-index.ts`/`severity.ts` 5a → 5b; `audit-copy/fallow.ts` 3b → 5a → 6; `tests-screen.test.ts` 5b → 6) — the inventory's order rule, and the controller's split of candidate Tasks 3 and 5 — low. |
| L10 | **Ruling:** `ScanCoordinator.getLifecycle` is kept (corrected at pre-flight, Polish QF5: `getLifecycle` has no caller; kept as public coordinator surface). The inventory offered its removal as optional; it is a frozen/public surface of `ScanCoordinator`, and removing it is out of scope for this pass — H1's breakdown row records "no caller; kept as public coordinator surface" — none: one accepted dead export. |
| L11 | **Ruling:** the Part 7 constraint "`src/domain/**` is not touched" is replaced, for this pass, by "`src/domain/**` changes in exactly two ways": E5 adds `src/domain/plain-data.ts` (`isPlainObject`, `asUnknownArray`), and X1 removes the `export` keyword from `UNAVAILABLE_FOOTPRINT` (`districts.ts`) and `SCALE_NAME` (`scale.ts`). No frozen §4 type or member changes — the shared helper must sit below application, adapters and ui, and the un-exports are keyword-only — low. |
| L12 | **Ruling:** A6's "exactly one spawn call" is reached by making `defaultSpawn` a property read (`childProcess?.spawn ?? null`) rather than a wrapper that calls `cp.spawn(…)`; the runner's own `spawn(…)` in `run` is then the file's only call — the guard counts call expressions, and a second one (even a delegating wrapper) is exactly what it must refuse — none: Node's `spawn` does not use `this`. |
| L13 | **Ruling:** B2 maps only `AnalyzerStoreError` from `grantTrust`/`revokeTrust` after the probe: `unsupported` → `store-unsupported`, `not-bound` and `changed` → `changed-since-review`, neither operational. Any other error still ends the run as the internal failure (`spawn-failed`/`internal`), which marks evidence stale — a mapping that caught everything would hide a real defect as "the executable changed" — low: a data.json I/O error that is not the store's own refusal still marks evidence stale. |
| L14 | **Ruling:** B5 treats a probe outcome `cancelled` that nobody asked for (the port's own `killAll`) as a cancel, exactly as the run path already does, through one helper — consistency; unreachable today — none. |
| L15 | **Ruling:** B6 is documented, not reordered: `EvidenceRepository.put` states write-then-notify, synchronously, and the coordinator states that a subscriber cancelling re-entrantly during `put` ends the run `cancelled` with the report it had already published kept (complete and verified); a pin asserts exactly that — reordering the terminal dispatch before `put` would announce "completed" before the evidence exists — low: the state says "cancelled" for a run whose report is on screen, in a window only a re-entrant subscriber reaches. |
| L16 | **Ruling:** E4's fix: after its own write, the review store upserts locally only when no load of the bucket started during the write; otherwise it reloads (a load that started then reflects another leaf's change, and a local upsert could put back what that change removed). Applies to `addWorkItem`, `addRule` and `decide` — dropping the upsert without a reload could lose the item until the next reload; a reload is the stored truth — low: one extra read in the race window. |
| L17 | **Ruling:** E7: `writePluginDataSlice` skips `saveData` when the mutation returns its input unchanged (`===`); the review adapter's removals return "no change" when nothing matched, and still notify once (Part 6 E8: the store's own-write count relies on one notification per successful removal); a refused write no longer raises the in-memory id marks; `retire()` sets its diagnostics to `unsupported: true` — the three E27 minors, without changing what a caller observes — low: a store test that pinned a needless save is updated, and says so. |
| L18 | **Ruling:** E12: a snapshot journal label always carries seconds (`HH:MM:SS UTC`), not only on a collision — a collision rule needs every sibling label at each call site; seconds everywhere is one function and one test — low: labels grow by three characters. |
| L19 | **Ruling:** E13's focus targets: when the report goes and NotAnalysed replaces the panel, focus moves to its Import button (its one control); when the report now reports nothing, to the findings panel section (already `tabindex="-1"`). Focus moves only when the focused element was inside the panel and is gone after the render — the inventory said "the panel heading", but NotAnalysed has no focusable heading and the kit component stays unchanged — none. |
| L20 | **Ruling:** F1 applies V19 with one new button per row: the boundary-rule table gains "Show" (`RULE_SHOW`, `RULE_SHOW_LABEL(id)`) before Remove; the coverage-gaps table gains "Open file" (`TESTS_OPEN`, `TESTS_OPEN_LABEL(name)`) before Plan tests. Both tables become `:interactive="false"`: rows are not focusable and a row click does nothing — V19's pattern, as Quality and Dependencies already use — medium: a pointer user who clicked a row now clicks the button (Review Focus 4). |
| L21 | **Ruling:** F5: one `CANCEL = 'Cancel'` in `audit-copy/shared.ts`; the seven existing names stay as aliases of it, so no call site changes; the S14 import review step says "Unverified source match" in words (`FALLOW_REVIEW_UNVERIFIED`); the Remove confirmation moves to `FallowRemoveDialog.vue`; the kit trap wraps by position (an unlisted focused element after `last` wraps forward, before `first` wraps back, in between is left to the browser) — the four E42 minors — low. |
| L22 | **Ruling:** D5: the settings tab takes the plugin's evidence repository as a required eighth constructor parameter, `Pick<EvidenceRepository, 'remove'>`; `deleteProfile` removes that profile's session evidence after the analyzer purge, and only when the profile removal itself succeeded (D4) — the K37 precedent (a required parameter, the test sites edited in place) — low: five test construction sites change by one argument each; `settings-tab.test.ts` stays at 436 lines. |
| L23 | **Ruling:** C10: while the Connect fallow dialog's busy action is in flight, a newer request (the run command's review or path step, or an import request) is held, the newest one winning, and applied when the step settles; it is dropped if the step closed the dialog (a started run) or the codebase changed. The dialog reports its busy state with a `busy` emit — a remount mid-step discarded the in-flight step, and the newer request must still win (M3) — low. |
| L24 | **Ruling:** H5: the harness opens the failed run's `<details>` through `openFailureLog(root)` in `tests/harness/seed.ts`, called by `mount.ts` for `?analysis=failed`; the capture is retaken in Task 9's `npm run harness-shot` — a headless capture cannot click, so the harness does it, as for tabs (Part 3 §4) — none. |
| L25 | **Ruling:** test files at or near the 450-line cap get no new cases (only in-place edits): `tests/component/settings-tab.test.ts` (436), `tests/host/city-view-store-wiring.test.ts` (450), `tests/component/welcome-state.test.ts` (446), `tests/host/city-view.test.ts` (440), `tests/contracts/review-repository.contract.ts` (423), `tests/host/window-migration.test.ts` (420), `tests/unit/evidence-numbers.test.ts` (403), `tests/component/fallow-run-panel.test.ts` (391). New cases go in new files, named in each task — the Part 7 rule — none. |
| L26 | **Ruling:** G7 ("two tests have stale titles or comments", ledger, not re-verified) is closed by a stated search, not by guessing: the implementer greps the titles and comments of the tests Part 6 E48 touched for claims E48 made false, fixes each one whose words contradict what it asserts, and records each by file and line; if fewer than two are found, the ledger says so rather than editing a true title — the Part 6 ledger names no files — low. |
| L27 | **Ruling:** the expected `npm run analyze` total after Task 8 is **9** (5 unused exports, 1 unused type, 1 unused class member, 1 duplicate export pair, 1 circular dependency), if C16's real-`CityView` test clears the four false-positive members; otherwise **13**, with those four recorded as false positives (`commands.ts` calls them). The disk wins; H1 records what the tool prints — the figure depends on how fallow credits a test's calls — none. |
| L28 | **Ruling:** the gate-evidence counts are updated once, in Task 9. Before that, `tests/unit/gate-evidence.test.ts` and `tests/unit/evidence-numbers.test.ts` may fail on file counts, the `src/` file floor and the analyze figures; no task "fixes" those two tests early — the Part 7 rule: one refresh from disk, at the end — none. |

## Execution rulings

### Pre-flight scan (before Task 1)

Four read-only tables checked the plan's task text against the real code, against the Part 1–7 specs and ledgers, and against every other task it shares a file or interface with. Table A (task pairs sharing a file or interface) has 44 rows plus 33 cap rows, Table B (each task's self-consistency) has 11 rows, Table C (plan vs spec / Global Constraints / reviewer-grade defects) has 26 rows, Table D (existing code the plan consumes: mismatches) has 16 rows. The full tables stay in the scratch ledger, `.superpowers/sdd/2026-09-23-wp02-part7-polish/preflight-scan.md`; the rulings they produced (QF1–QF18) are reproduced below with their cost if wrong, matching the "Pre-flight rulings" section above.

#### Pre-flight rulings (QF1–QF18)

| # | Ruling | Cost if wrong |
|---|---|---|
| QF1 | (T1 G2): the existing "does not flag" row `<!-- openPath is not used --><p>Run nothing</p>` is wrapped in `<template>…</template>` so the fail-closed parser doesn't call it unscannable; record it. Corrected during execution (Polish E1): the guard scans `<template>` text including comments, so only the `<p>` is wrapped and the comment stays outside the template. | None. |
| QF2 | (T5b E8): `HIGH_SEVERITIES` stays `readonly string[]` (or a `ReadonlySet<string>`), not `readonly FindingSeverity[]` — TS2345 otherwise. | None. |
| QF3 | (T5a E2): `HIGH_SEVERITIES` is module-private (no new analyze finding); the expected analyze total is recomputed in Task 8 from the real run. | None. |
| QF4 | (T3b C17): rename the injected clock binding (e.g. `clockNow`) to avoid colliding with `attach()`'s local `now`. | None. |
| QF5 | (L10/T8 H1): L10 is corrected — `getLifecycle` has no caller (comments only). Keep the method (frozen/public surface of `ScanCoordinator`; removing it is out of scope), leave it as an accepted analyze finding, and H1's breakdown row says "no caller; kept as public coordinator surface". | One accepted dead export. |
| QF6 | (T8 H5): use Obsidian `createDiv()`/`createEl` helpers instead of `document.createElement` in tests/harness (obsidianmd/prefer-create-el). | None. |
| QF7 | (T2 B8): the two B8 pins are behaviour pins, not mutation-proven; the implementer records one valid mutation per pin if one exists, otherwise states "behaviour pin". | Weaker RED evidence for those two. |
| QF8 | (T3b C14): mutate the real guards (`useBusyAction.requestClose`, `useFallowRun.forget`, `chooseExecutable`) for RED evidence. | None. |
| QF9 | (T1 A6): `spawnCallCount` reuses the hazard walk's receiver logic so `spawn.call`/`.apply`/tagged forms count; add a pin with a second `spawn.call(...)`. | None. |
| QF10 | (T3b C9): `FALLOW_EXE_FORGET_FAILED` says "…Nothing was changed." (true for every record kind that offers Forget) instead of "stays chosen and trusted". | None. |
| QF11 | (T3b C17/Y27): the injected `now` is a test seam defaulting to the wall clock (SnapshotStatus precedent); no production provider added. | Production still uses wall-clock time, as before. |
| QF12 | shared-file ordering noted — 3a→3b (FallowRunPanel, FallowInstalledRoute, fallow-analysis-service), 5a→5b (QualityScreen), 5b→6 (audit-copy/quality.ts); each later implementer re-reads anchors. | None. |
| QF13 | (T1 A3): RED demonstration uses a 4,096-byte tail variant so the RED run stays ~10 s; the committed test keeps the real cap. | RED shown on a smaller cap. |
| QF14 | (T2 B1): RED description corrected — HEAD already returns 'busy'; the failing assertion is the stored path being replaced. | None. |
| QF15 | (T5b E7): any store test updated because a no-op save disappeared is added to the task's git add list. | None. |
| QF16 | (T5b): `refused`/`raisedMarks` helpers live at module scope (consistent-function-scoping). | None. |
| QF17 | (T3a C1): the read-failure copy must not say "Open Data & scans again" (shown on Data & scans); say e.g. "Try again, or reopen this codebase." in house style. | None. |
| QF18 | anchor corrections — refusalBanner at fallow-run.ts:37–39 and barrel re-exports at 12–15; SourceReference is an interface (grep `interface SourceReference`); the Obsidian mock has no Platform.isMacOS (add it to the mock only if a test needs it); mayPublish has 7 test call sites; the review contract needs two import lines changed; `pick` helper spans 39–52; C16's mutation targets the ternary; F5's fallow.ts anchors shift +1 after 5a. | None. |

### Rulings during execution (Polish E1–E18)

| # | Task | Ruling | Cost if wrong |
|---|---|---|---|
| Polish E1 | 1 | QF1 corrected — the guard scans `<template>` text including comments, so only the `<p>` is wrapped and the comment stays outside the template (implementer's fix). | None. |
| Polish E2 | 1 | polish-pass policy — minor review findings that are cheap and inside the task's own code enter the fix round instead of being deferred (the pass exists to close gaps, not open new ones); only out-of-area or costly minors are deferred. | Slightly larger fix rounds. |
| Polish E3 | 1 | review Important (plan-mandated G2 gap: `<template src>`/`<script src>`/`<script setup src>` pass silently) — fix: treat any block with `src` as unscannable, add flag rows. | None. |
| Polish E4 | 2 | review Important (plan-mandated B1 residual: a `service.run` in precheck is invisible to `isActive`, so `trustAndRun` can bind then return busy) — fix now with a synchronous per-profile reservation in the service (run/trustAndRun reserve across their awaits; forget consults it; checkTrust does not); keep the B1 re-check as defence in depth; pin with a deferred bind. | ~10 lines; a concurrent run/trustAndRun on the same profile now answers busy. |
| Polish E5 | 2 | re-review out-of-scope gap (`purgeProfile` during a reserved `trustAndRun` re-binds a removed profile and starts a run) enters round 2 under the polish-pass policy (cheap, same file) — purge marks the profile so a reserved body refuses before bind/start; `timeoutSeconds` re-read at bind time is optional. | None. |
| Polish E6 | 2 | parked: a start issued between `purgeProfile`'s call and its store write is not marked — accepted residual; the only caller (settings delete) unbinds the leaf first, so no UI path reaches it. | A removed profile could get one run. |
| Polish E7 | 3a | amends L23: a request held while the dialog is busy is DROPPED when the step ended with an error (the refusal stays visible — E13 "outcome never lost"); applied only when the step ended cleanly; also `flush:'sync'` on the busy emit watcher and pins for newest-wins, dropped-on-codebase-switch and held-not-applied-immediately. | A Run command issued during a refused check must be re-issued. |
| Polish E8 | 4 | `evidence.remove` runs even when the analyzer purge rejects (Notice shown) — the profile is gone either way, so its session evidence must go; mirrors the review-purge pattern. | None (evidence is session-only). |
| Polish E9 | 5a | approved review's Minor 1 (E4 reload window lets a duplicate add slip in; a failed reload hides a saved record) and Minor 3 (`reportedText` one-line wrapper) enter a fix round under the polish policy; Minor 2 (E3 refusal silent in `FindingReviewDialog` before ready) is CARRIED into Task 5b (review-save failures in words). | None. |
| Polish E10 | 5a | parked: speculative stacked-reload case (a newer Y12 reload could land after the action released its key) — accepted, unverified, pre-existing ticket machinery; the latest-ticket rule keeps lists correct and the pending check only narrows duplicates. | A rare duplicate add under concurrent own-writes + a foreign notification. |
| Polish E11 | 5b | accepted all five departures (absorb-raise marks; `lastWritten` kept on no-op; `retired` stays unsupported in diagnostics; purge with no set saves nothing; `load(target?)` with `??`) — each corrects a defect in the brief's own code and is pinned. | None. |
| Polish E12 | 5b | review Important (plan-mandated gap vs L3: `ImportReviewDialog`/`ClearReviewDialog` still show generic text because `useBusyAction.run` discards the error) fixed in this task — `run` takes an optional error mapper, both dialogs use `reviewFailureText`, added to `REVIEW_WRITERS`, pinned; Minors 1 (`retired` repository shows "format" wording → its own code/words), 2 (blocked-press no-announce pin), 3 (`evidenceBadgeOf` private; test uses `evidenceBadgeFor`), 4 (`writePluginDataSlice` doc: mutate must not change input in place) enter the same round under polish policy. | None. |
| Polish E13 | 8 | `LOT_FOOTPRINT`, `MAX_DIRECT_SUBDISTRICTS`, `DRAG_THRESHOLD_CSS_PX`, `entityPath` stay exported as accepted analyze findings (brief + L27 total 9); the evidence row now states truthfully that only test comments cite them. | 4 accepted dead exports (could drop the baseline to 5 later). |
| Polish E14 | final review | the Task 2 park is REVERSED — its premise ("settings delete unbinds the leaf first") is false; a removed profile can be re-bound, run and re-evidenced in plain sequence. ONE fix wave: a permanent removed-set in the service (profile ids are UUIDs, never reused); run/trustAndRun/setTimeLimit/forget refuse a removed id with a real `profile-removed` refusal + copy (not choose-executable); plus final Minors 1 (busy/PURGED outcomes silent in UI), 2 (Settings busy wording during a reserved start), 3 (`fallow-run-panel.test.ts` back to ≤391). | One new `FallowRunErrorCode` + copy line. |
| Polish E15 | final review | Important 2 (ledger) is handled after the fix wave by a documentation transcription into the committed polish ledger (Polish E1…), correcting L10 in place; Minor 4 (three Sonnet-trailer commits: a8a5ea8, 05f13b1, 8851f3f) recorded there. | None. |
| Polish E16 | final review | parked: a leaf open on a removed codebase still shows "No executable chosen" + Choose (the first action behind Choose refuses as removed) — accepted; hiding needs a new binding kind. | One extra click to learn the codebase was removed. |
| Polish E17 | final review | parked: the removed mark is memory-only (does not survive restart) — accepted; after restart the removed profile has no leaf/profile to bind from (profiles list no longer holds it). | None observed. |
| Polish E18 | final review | residual minors ship as recorded — none affects consent, evidence truth or data. | A slightly off banner heading on a removed-codebase Forget. |

### Per task: completion, commit range and fix rounds

- **Task 1** — fix round 1/5 (5 addressed, 0 open — external src fail-closed; logical shell assignments; wrapped fallback kill; mock isMacOS; post-settle pipe error pin; commits d0bb66a..380d329); complete (commits af96e88..380d329, review clean after 1 fix round; see Polish E1–E3).
- **Task 2** — fix round 1/5 (2 addressed, 0 open — per-profile reservation; stray delay; commits 402dede..45e95c6); fix round 2/5 (1 addressed, 0 open — purge during reserved run/trustAndRun never re-binds or starts; time limit read after bind; commits 45e95c6..fa63659); complete (commits 380d329..fa63659, review clean after 2 fix rounds; see Polish E4–E6).
- **Task 3a** — note (FINAL TASK SHOULD WATCH): integration "no freeze (acceptance 3)" failed once under load in 3a's broader run, passed alone 14/14 — C18 (Z38 budget) is OUT of scope; if it fails in Task 9's full verify, rule then. Fix round 1/5 (3 addressed, 0 open — held request dropped on refusal; sync busy emit; newest-wins/switch-drop/held pins; commits fa08a7d..6cf76f7); complete (commits fa63659..6cf76f7, review clean after 1 fix round; see Polish E7).
- **Task 3b** — complete (commits 6cf76f7..a8a5ea8, review clean, no fix round).
- **Task 4** — complete (commits a8a5ea8..8851f3f, review clean, no fix round; see Polish E8 and Trailers below).
- **Task 5a** — note (CARRY to 5b): `review-store.ts` now 349/400; 5b must keep it under cap (split if needed per plan); L16's accepted cost restated: in the E4 reload path an add/decide result returns before the reloaded list shows it. Fix round 1/5 (2 addressed, 0 open — reservation held until reload settles; `LENS_LIST_TEXT` direct; commits df704e6..765cbb9); complete (commits 8851f3f..765cbb9, review clean after 1 fix round; see Polish E9–E10).
- **Task 5b** — fix round 1/5 (5 addressed, 0 open — replaceAll dialogs map `ReviewStoreError` via optional mapper; `retired` code + Settings note; blocked-press no-announce pin; `evidenceBadgeOf` private; no-op save contract documented; commits fdc4431..1e4a747); complete (commits 765cbb9..1e4a747, review clean after 1 fix round; see Polish E11–E12).
- **Task 6** — complete (commits 1e4a747..05f13b1, review clean, no fix round; see Trailers below).
- **Task 7** — complete (commits 05f13b1..e75a199, review clean, no fix round).
- **Task 8** — note: full verify at 259a449 — 2 failures = the file-count checks (src floor 12>10; unit file count 117 vs 122) that Task 9 owns; build + assert-bundle OK; no timing test failed. Complete (commits e75a199..259a449, review clean, no fix round; see Polish E13).
- **Task 9** — note: component files on disk = 82 (brief predicted 80); disk wins → per-layer total 244; src floor 305+ (real 307). Verify exit 0 twice (243 files, 2682 passed, 1 skipped; assert-bundle 1108 kB); test:fallow 10/10; harness-shot OK (H5 log visible, E12 seconds); analyze total 9. Complete (commits 259a449..d50514a, review clean; ledger record deferred to this transcription).
- **Final whole-branch review** (d42a2c2..d50514a, opus) — "With fixes": 0 Critical, 2 Important, 4 Minor. Final fix wave: commits d50514a..fac7e0c — permanent removed-set, `profile-removed` refusal (not operational) on run/trustAndRun/review/setTimeLimit/forget; busy/removed announced; every non-started Trust and run alerts; Settings busy wording covers "starting"; run-panel test ≤391; G8 counts refreshed (unit 123, component 83, total 246). Re-review: 4/4 resolved, APPROVE (see Polish E14–E18).

### Deferred minors and parked items, by task

**Task 1**
- minor → behaviour pin (QF7-style): A10 short-file case has no mutation proof.

**Task 2**
- parked: a start issued between `purgeProfile`'s call and its store write is not marked (Polish E6).
- minor (deferred): `purgeProfile`'s `store.purge` rejection leaves the mark set until reserve's finally (fail-closed; PURGED.read may be inaccurate).

**Task 3a**
- note (FINAL TASK SHOULD WATCH): integration "no freeze (acceptance 3)" failed once under load, passed alone 14/14; C18 (Z38 budget) is out of scope.
- minor (deferred): C13 `@ts-expect-error` pin never shown failing on the type side (typecheck RED not captured).

**Task 5a**
- parked: speculative stacked-reload case (Polish E10).

**Task 5b**
- minor (CARRY to Task 8): stale doc comment `plugin-data-review-repository.ts:53` `retire()` says "unsupported" — should say "retired"; `review-failure.test.ts` "names each refusal" lacks a retired line.
- minor (deferred): Settings Clear/Import stay enabled for a retired repository (refused with `REVIEW_STORE_RETIRED` on press; same as unsupported behaviour).

**Task 8**
- minor (CARRY to Task 9): `scale.ts:35` `const SCALE_NAME ='…'` lost its space before `=`.

**Final review**
- parked: a leaf open on a removed codebase still shows "No executable chosen" + Choose, since the first action behind Choose refuses as removed (Polish E16).
- parked: the removed mark is memory-only and does not survive restart (Polish E17).
- residual minors after the final fix-wave re-review (Polish E18): Forget answered "removed" shows refusalBanner heading COPY_15 ("fallow analysis failed…") — slightly wrong heading, reason line correct; `FALLOW_TRUST_NOT_STARTED` unreachable from the real service (future guard); commit 20e2f7a alone fails gate-evidence (count refresh landed in fac7e0c); the Part 7 spec copy table still has the old "Cancel … first" string (historical, left).

### Trailers

Commits a8a5ea8 (Task 3b), 05f13b1 (Task 6) and 8851f3f (Task 4) carry a "Claude Sonnet 5" Co-Authored-By trailer — the implementers' own harness attribution, not the plan's "Claude Opus 5.5". Accepted as-is, no history rewrite, following the Part 7 E1 precedent (Part 7 ledger, `docs/superpowers/notes/2026-09-23-wp02-part7-ledger.md`); recorded formally in Polish E15 above.

### Final verification

Verify at d50514a: 243 files, 2682 passed, 1 skipped. Final-fix-wave verify: 245 files, 2696 passed, 1 skipped. `npm run analyze`: 9. `npm run test:fallow`: 10/10.
