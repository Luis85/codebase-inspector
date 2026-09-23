---
project: codebase-inspector
title: WP-02 Part 7 — SDD ledger (rulings)
date: 2026-09-23
branch: feat/wp-02-part7
---

# WP-02 Part 7 — rulings

This ledger records every ruling made while planning and executing Part 7, and what each one costs if it is wrong.

- Spec: `docs/superpowers/specs/2026-09-23-inspector-ui-part7-design.md` (Z1–Z44).
- Plan: `docs/superpowers/plans/2026-09-23-inspector-ui-part7.md`.
- Precedent, all binding:
  - the Part 3 ledger (R1–R9, E1–E55), cited as E<n>;
  - the Part 4 ledger (S1–S27, X0–X19, E1–E22), cited as "Part 4 E<n>";
  - the Part 5 ledger (T1–T32, E1–E25), cited as "Part 5 E<n>";
  - the Part 6 ledger (U1–U51, E1–E49), cited as U<n> and "Part 6 E<n>".
- Numbering: planning rulings here are K1…; execution rulings are "Part 7 E1"….
- Every ruling reads: **Ruling:** what — why — cost if wrong.

## Planning rulings

### Owner-approved: the spec's "Decisions taken while writing" (Phase 1 review, 2026-09-23, spec at 384c528)

| # | Ruling |
|---|---|
| K1 | **Ruling:** the executable must pass a native magic-byte check (PE, ELF or Mach-O, its first 4 bytes); a file starting with `#!` is refused as a launcher (Z4) — it is the only way to catch npm's POSIX bin link, which is named `fallow` but is a JS launcher, without executing anything — low: a native binary with an unusual header would be refused with "not a native executable", and the user can still import a report. |
| K2 | **Ruling:** the binding and its trust are stamped with this device's id and ignored on another device (Z1) — `data.json` travels through Sync, and architecture §6 forbids an automatically honoured shared trust — low: a user on two devices chooses and trusts the executable once per device. The id's own sync scope is the existing inferred risk of `getOrCreateMachineId`. |
| K3 | **Ruling:** the time limit is not part of the trust fingerprint; its range is 10–1800 s (Z6, Z10) — changing a time limit cannot widen what runs, and asking again for it would teach users to click through reviews — none for trust; low for the range (a repository needing more than 30 minutes cannot be analysed from the plugin, and can still be imported). |
| K4 | **Ruling:** `TMPDIR` joins the environment allow-list (Z16) — it is the POSIX temporary directory, as `TEMP`/`TMP` are on Windows, and a tool that needs scratch space should not fall back to an unexpected location — low: one more inherited variable, visible in the review's Environment row. |
| K5 | **Ruling:** the time limit and Forget live in Obsidian's settings; choosing an executable happens only in Data & scans (Z12) — choosing needs the codebase's folder and the review, which only exist beside a snapshot — low: a user looking for the executable in settings is told where it is chosen. |
| K6 | **Ruling:** `FallowRunErrorCode` sits beside `FallowImportErrorCode`, with a mapping for the reader's codes (Z19) — import refusals are about a picked file, run failures about a process; one union would make every import message handle process codes — none. |
| K7 | **Ruling:** collected provenance is an optional `collected` field; `fileName` holds the executable's base name and `importedAt` keeps its name, meaning "attached at" (Z25) — imported reports keep their exact Part 6 shape, and every Part 6 consumer (COPY-16, staleness, the dialogs) keeps working — low: `importedAt` reads oddly for a run; renaming it later touches every Part 6 consumer. |
| K8 | **Ruling:** "marks it stale" is an `EvidenceRepository.markStale` port method plus an optional `staleReason: 'failed-run'` (Z23) — a failed run must never clear evidence, and staleness was only "another snapshot" before — low: one more port member; two test doubles gain it. |
| K9 | **Ruling:** a run whose evidence changed mid-run is discarded as `superseded`; Import, Remove, Change and Forget are blocked while a run is active (Z20, Z32) — acceptance (5): a superseded run cannot overwrite newer data, and blocking the controls keeps the discard rare — low: a user who wants to import mid-run cancels first. |
| K10 | **Ruling:** a start from a leaf whose snapshot is not the codebase's latest is refused as `snapshot-changed` (Z22) — the result would be discarded on arrival anyway (Z20) — low: a stale leaf says "rescanned, run it again". |
| K11 | **Ruling:** `run` and `trustAndRun` resolve once the run has started, and the run continues detached (Z21, Z22) — nothing may await a 120 s analysis on the UI path; progress arrives through `subscribe` — none. |
| K12 | **Ruling:** there is no plugin-wide cap on concurrent runs across codebases (Z21) — each run is bounded by its own time limit and output caps, and two codebases in two leaves is a deliberate use — low: two heavy analyses at once load the machine; a cap is one counter in the coordinator. |
| K13 | **Ruling:** the kill grace is 2 s (SIGTERM, then SIGKILL on POSIX); a close grace of 2 s gives `output-incomplete`; `onunload` sends SIGKILL at once (Z18) — a stopped run must end promptly, and an unloading plugin cannot wait; `--no-cache` means an abrupt kill leaves nothing half-written — low. |
| K14 | **Ruling:** the run banner lives on the Data & scans card only; operational failures also raise a Notice (Z33, Z34) — the city's StatusBanner is one-state-at-a-time for scans, and a Notice reaches a user who has left Data & scans — low: no running indicator on the city itself (spec §7 out of scope). |
| K15 | **Ruling:** the Planned integrations panel is removed, not reworded (Z32) — its only content was the fallow "comes later" text, and an empty panel would render nothing useful — none. |
| K16 | **Ruling:** `FALLOW_BIN` lets `test:fallow` use a local binary; otherwise the fetch runs `npm install fallow@3.27.0 --prefix .fallow-bin --no-save --no-package-lock --ignore-scripts` through `npm_execpath`, with no shell (Z40) — it tests a user's own install (3.21.0 too) and never touches `package.json` — low: a machine without network and without `FALLOW_BIN` skips the suite. |
| K17 | **Ruling:** `assert-bundle.mjs` asserts exactly one `node:child_process` in `dist/main.js` (Z38) — a third, independent layer behind the AST guard and the lint rule — low: a minifier change that duplicated the literal would fail the build loudly. |
| K18 | **Ruling:** the no-freeze gate is the largest event-loop gap under 50 ms while the child runs; the final parse is measured only (Z38) — spawning is async, but the final `JSON.parse` of up to 16 MB is synchronous in Part 6 too — medium: a loaded CI machine can stretch a gap; the measurement is printed so a flake is diagnosable. |

### Design rulings from planning

| # | Ruling |
|---|---|
| K19 | **Ruling:** `tests/unit/node-access-boundary.test.ts` is amended in Task 7 to allow exactly `adapters/fallow/node-process-access.ts` and `adapters/filesystem/node-access.ts` — the spec (Z14, Z37) named the process guard but not this second guard, which pins `window.require` to one file and would fail the moment the runner lands — none; the amendment is as narrow as the process guard's. |
| K20 | **Ruling:** `tests/host/clean-vault-install.test.ts` requires the implementation report's command and settings lists to equal what the code registers, so Task 9 adds the two commands and Task 10 the two settings rows to the report; the settings row names are string literals (`name: 'fallow executable'`, `name: 'fallow time limit'`) and have no copy constants — the guard reads `name: '…'` literals from `setting-definitions.ts`; a constant would hide the rows from it — low: the two names live in code, as every other row name does. |
| K21 | **Ruling:** the stored `executablePath` is its own `normalizeAbsolutePath` form, at most 1,024 characters — the spec said 4,096, but `normalizeAbsolutePath` caps at 1,024, and storing the normalised form means what is shown, stored, fingerprinted and run is one string (the Part 5 consent-display lesson) — low: a path longer than 1,024 characters cannot be chosen. |
| K22 | **Ruling:** the inspector also resolves the root's real path, so `insideRoot` is true when the executable's real path is inside the root's real path — Review Focus 3: with Z5's two checks alone, a root reached through a symlink or junction missed a binary inside its target; on this machine the temporary directory is itself an 8.3 short path — none. |
| K23 | **Ruling:** the `assert-bundle` check lands with the host wiring (Task 9), not with the runner (Task 7) — until `main.ts` imports the runner, the bundle has no `node:child_process`, and "exactly once" would fail every build, including `tests/global-setup.ts`'s — none. |
| K24 | **Ruling:** `classifyFallowExit(outcome, timeoutSeconds)` returns `{ kind: 'completed' } \| { kind: 'cancelled' } \| { kind: 'failed' }`, and the probe has its own `classifyVersionProbe` — the spec's two-arm shape had no place for the table's "cancelled" row, and the `timed-out` detail needs the seconds — none. |
| K25 | **Ruling:** `RunPlan.onProbePassed` resolves `'continue' \| 'version-changed' \| 'changed-since-review'`; the service answers the last when `grantTrust` refuses — a binding moved under a first run must end the run quietly, not as an internal error — none. |
| K26 | **Ruling:** the probing and running states carry `rootPath`, and `FALLOW_RUN_PROBING`/`FALLOW_RUN_RUNNING` take `hasEvidence`, saying "Current findings stay…" only when there are some — the banner names the folder, and the sentence was false for a first run — none. |
| K27 | **Ruling:** `analyzer-record.ts` holds `applyAnalyzerWrite`, the pure write rule both store implementations call, and its cap is 200 lines — the durable store and the in-memory double then cannot drift, and the contract runs against both — none. |
| K28 | **Ruling:** the runner's contract test stays in `tests/contracts/` (Z38), so Task 14 extends `evidence-numbers.test.ts`'s derived Contract-row formula with its `it(` count, the G8 table gains a `tests/fallow-real` row whose Tests cell is 0 (its ten tests are not part of the suite the table totals), and the platform-dependent grandchild test is one plain `it()` with a branch (the counter reads `it(`, not `it.skipIf(`) — the evidence guards derive these figures and would otherwise go red or under-count — low: two documents and one guard line change once, in Task 14. |
| K29 | **Ruling:** the analyzer-store contract is `tests/contracts/analyzer-binding-store.contract.ts`, run from `tests/unit/analyzer-binding-store.test.ts` — the `review-repository.contract.ts` pattern; it keeps the contracts layer's file count and its derived Tests cell unchanged — none. |
| K30 | **Ruling:** fourteen tasks: the pure invocation, exit, error and trust contracts are one task (1); the reducer and the coordinator are one (4); harness captures (13) come before evidence and acceptance (14) — each task still has its own test cycle and could be rejected alone; the order follows committed interfaces (application, then adapters, then host and UI) — low: Task 1 is the largest pure task; a reviewer may ask to split it. |
| K31 | **Ruling:** `FileFindingsPanel`'s `version: string` prop becomes `badge: EvidenceBadgeProps \| null`, computed by `FileDetailScreen` with `evidenceBadgeOf` — the panel never had the report, and the badge now needs the origin and the untested flag — none; one parent passes it. |
| K32 | **Ruling:** the installed route receives the dialog's own `useBusyAction()` object as a prop — Cancel, Escape and the backdrop must stay ignored while a check or a start is in flight (Part 4 E13), and its refusals must land in the dialog's one `role="alert"` — none. |
| K33 | **Ruling:** the fake fallow gains three modes beyond Z38's list, `argv`, `trickle` and `streamed`, and its `grandchild` mode writes the pid to a file in its cwd — Review Focus 2 and 5 and the no-freeze gate need them, and a cancelled run returns no stdout to read a pid from — none. |
| K34 | **Ruling:** the integration test drives the real service, coordinator and runner over a real scan of the fixture project, with a scripted inspector and a port that runs the fake fallow through Node — the real inspector rightly refuses `node` as "not named fallow"; it is tested on real files (Task 6) and against the real binary (`test:fallow`) — low. |
| K35 | **Ruling:** an `executable-refused` detail is `refusal[:detail]` (`launcher:fallow.exe`, `unreadable:EACCES`), decoded by `FALLOW_EXE_REFUSED_TEXT`; `version-probe-failed` with a signal or `cancelled` detail reads "ended unexpectedly (…)" — details stay data, and the copy can still name the expected file or the error code — none. |
| K36 | **Ruling:** the deliverable's `status` stays `planned`; Task 14 adds a "Delivery record" section — every deliverable, WP-01 included, still reads `planned`, and changing status is the owner's integration step — none. |
| K37 | **Ruling:** the settings tab's seventh constructor parameter is required, and the four test construction sites pass `createFakeFallowAnalysis()` — an optional default would exist only for tests — low: four one-line edits, `settings-tab.test.ts` 435 → 436. |
| K38 | **Ruling:** one scripted service double, `tests/fixtures/fake-fallow-analysis.ts`, serves the component, host and harness tests, and `dataPortDeps()` includes it — Part 6 R2's single-helper rule — none. |
| K39 | **Ruling:** the analysis store's `review`, `startOrReview` and `trustAndRun` resolve `null` while unbound or for another codebase's snapshot — a late press after a codebase switch must do nothing (Part 6 E36) — none. |
| K40 | **Ruling:** the finished-run announcement lives in `use-fallow-run.ts`, once per run id, and a run that had already finished when the screen opened or the codebase changed is not announced — E17: announce real outcomes, once — none. |
| K41 | **Ruling:** `ExecutableInspectorPort` has a read-only `executableName`, and `AnalyzerBindingView` carries it — the path hint (Windows or POSIX) must be known before any executable is chosen, and the UI may not read the platform — none. |
| K42 | **Ruling:** `staleCauseOf(report)` takes the report only: `failed-run` when it carries the flag, otherwise `snapshot` — when both apply, "the latest fallow analysis failed" is the more useful sentence, and the card had no snapshot id to compare — none. |
| K43 | **Ruling:** COPY-15 is pinned against its catalogue row in `tests/unit/fallow-run-copy.test.ts`, not in `tests/contracts/microcopy.test.ts` — that contract sweeps `src/ui/copy.ts` exports only, and its `it(` count feeds the derived Contract row — none. |
| K44 | **Ruling:** every Part 6 copy function that gains an origin parameter defaults it to `'imported'`, and `FallowCardState.origin` is optional — every Part 6 call site and test keeps its exact text — none. |
| K45 | **Ruling:** "Choose executable…" is aria-disabled without a snapshot, described by the run hint — the installed route needs the snapshot's folder to review anything — low. |
| K46 | **Ruling:** `PROFILE_ANALYZER_PURGE_FAILED` lives in `audit-copy/fallow-run.ts` with the other Part 7 strings, as a function of the reason — spec §2 places every new string there; the Part 6 purge string is also a function — none. |
| K47 | **Ruling:** `npm run verify` in this worktree is expected to fail only on `tests/unit/install-script.test.ts` (no `.obsidian/`), reported and never fixed; the owner re-runs it in the main checkout after the fast-forward — the Part 6 precedent — none. |
| K48 | **Ruling:** the manual host check behind acceptance (3) is recorded as NOT PERFORMED until the owner does it — the controller cannot drive the real Obsidian; an automated gap measurement is the offline evidence — low: acceptance (3) is automated-only until the checkpoint. |
| K49 | **Ruling:** Task 8's integration test is RED through its new `node-wrapped-port.ts` fixture — every module it drives already exists by then; that is what an integration test is — none. |

## Execution rulings

### Pre-flight conflict scan (before Task 1, HEAD 624cc05)

Four read-only tables checked every task's text against the real code at HEAD, against the spec and plan, and against every other task it shares a file or interface with. Table A (task pairs sharing a file or interface) has 47 rows, Table B (each task's self-consistency) has 14 rows, Table C (plan vs spec / Global Constraints / reviewer-grade defects) has 28 rows, Table D (existing code the plan consumes: mismatches) has 13 rows. The full tables stay in the scratch ledger, `.superpowers/sdd/2026-09-23-inspector-ui-part7/progress.md`; only the rulings they produced are transcribed below.

#### Pre-flight rulings (PF1–PF18)

| # | Ruling | Cost if wrong |
|---|---|---|
| PF1 | Timers in src (Tasks 4, 5, 7, 8) read the global through a local binding at call time (walker.ts pattern) instead of bare setTimeout/clearTimeout/setInterval; tests use node:timers/promises where they need real waits — prefer-window-timers would otherwise fail every --max-warnings 0 gate. | Minor rework of timer call sites. |
| PF2 | No no-op closure initialisers (`let unsubscribe = (): void => {}`); use a nullable variable, and hoist capture-free test helpers (release/alive/shape) to module scope — oxlint consistent-function-scoping fails lint:fast. | None. |
| PF3 | Task 7 also amends `tests/acceptance/steps/source-steps.ts:168` (the third process guard) with the same two-file allow-list, and rewords src comments that mention child_process/spawn( outside those files; K19 extended — otherwise `npm run test` fails from Task 7. | A guard that is slightly wider than before, limited to the two adapter files. |
| PF4 | Tests pass an explicit real kill function (tests/fixtures `realKill` using process.kill / child.kill) to the runner on every real-process test; the default kill stays the Obsidian path — POSIX real-process tests would hang otherwise. | None on Windows; fixture code only. |
| PF5 | Reword the contract-test comment so the `it(` counter counts only real tests (14). | None. |
| PF6 | Tests use process.stdout.write, never console.info — the latter is a lint error. | None. |
| PF7 | Task 8 tests set explicit per-test timeouts (no-freeze and wait-loop tests ≥ 30 s). | Slower failure on a hang. |
| PF8 | Add to Task 8 integration a test "a bound but untrusted run starts zero processes"; do NOT add a real-stack service-level timeout test (the 10 s minimum limit makes it slow) — the runner contract `trickle` test pins the timeout at process level, and Task 5 adds a unit assertion that the service passes timeoutSeconds*1000 as the request timeout. | A service→runner timeout wiring bug not covered end-to-end beyond that unit assertion. |
| PF9 | Task 10 types the bound fixture via `Extract<…, {kind:'bound'}>` — otherwise TS2339. | None. |
| PF10 | Settings rows call setName with the spec's SETTINGS_FALLOW_*_NAME constants (sentence case); the K20 `name:` literals stay for the checkpoint guard — obsidianmd sentence-case lint otherwise fails. | Two parallel spellings; the checkpoint guard compares literals only. |
| PF11 | Task 11 updates `tests/unit/findings-model.test.ts:122` for the new stale caption. | None. |
| PF12 | Task 11's Files list includes `src/ui/read-models/fallow-candidate.ts`; `tests/fixtures/node-wrapped-port.ts` is recorded as a Task 7 create — File-map gaps only. | None. |
| PF13 | FallowInstalledRoute never mutates props; it emits `clear-error` and the dialog clears `action.error` (K32 amended) — otherwise vue/no-mutating-props. | One extra emit. |
| PF14 | The composable/store members SourcesScreen destructures (run/cancel/forget) are declared as arrow-function properties, not methods — otherwise typescript-eslint unbound-method (use-busy-action.ts precedent). | None. |
| PF15 | The refusal banner is cleared when a new run id starts (Z33: the banner reflects the current run) — otherwise a stale refusal reappears after a successful run. | A refusal disappears as soon as a new run starts, which is intended. |
| PF16 | FALLOW_STALE_NOTICE returns COPY_16(date) rather than retyping the sentence (spec §2). | None. |
| PF17 | Installed route: (a) a codebase switch while busy closes the route once the busy step settles (dropping its late result, Part 6 E36); (b) a thrown non-FS error shows the generic read failure without the "(UNKNOWN)" code suffix; (c) the path step shows FALLOW_EXE_REFUSED['executable-missing'] when inspection says missing — spec Z29–Z31. | Small copy/flow rework. |
| PF18 | Record-only items are left to the per-task reviews: weak/over-titled tests, unlisted signature drifts, unused RunPlan.trustedVersion, new host test file names, FALLOW_ROW_COLLECTED's location, off line anchors; reviewers may flag them; RunPlan.trustedVersion is removed if still unused after Task 5. | Review-loop churn only. |

### Rulings during execution (Part 7 E1–E20)

| # | Task | Ruling | Cost if wrong |
|---|---|---|---|
| Part 7 E1 | 3 | Commit 2b501d5 carries a 'Claude Sonnet 5' Co-Authored-By trailer (the implementer's own harness attribution) instead of the plan's 'Claude Opus 5.5'; accepted as-is, no history rewrite — the trailer names the model that wrote the commit, and PR 1 history already mixes Opus 5/5.5 trailers. | Cosmetic trailer inconsistency. |
| Part 7 E2 | 7 | On Windows, libuv injects its own required variables (USERNAME, USERDOMAIN, LOGONSERVER, WINDIR, HOMEDRIVE, …) into every child env regardless of the env passed; accepted — none is FALLOW_* or NODE_OPTIONS, the runner still passes only the allow-list (unit-pinned), and the contract test allows exactly that libuv set on Windows; Task 14 must add this to the Limitations ("child env = allow-list exactly on POSIX; on Windows plus libuv's mandatory variables"). | Spec Z16 wording overstated on Windows until Task 14 docs it. |
| Part 7 E3 | 7 | POSIX group-kill/realKill(-pid) paths are unit-pinned but not executed on this Windows machine; accepted, recorded as an untested-platform limitation for Task 14. | A POSIX kill defect ships unobserved. |
| Part 7 E4 | 7 | Review Important #2 (a killed run has no final deadline; plan-mandated by Z18 "a killed run resolves on exit") — decided: add a final deadline — after SIGKILL is sent, arm FALLOW_CLOSE_GRACE_MS; if exit never arrives, destroy pipes and settle with the stopped outcome (cancelled / timed-out). Spec intent (bounded kill grace + close grace, coordinator must not wedge) outranks the literal "resolves on exit". | A process that exits after the deadline is reported stopped while still alive for a moment; acceptable, it was already SIGKILLed. |
| Part 7 E5 | 8 | Spec Z41.7 assumed bare `fallow --fail-on-issues` exits 1; real 3.27.0 bare/combined mode ignores it (gate "not enforced") and exits 0, while `fallow dead-code --fail-on-issues` exits 1 — accepted the implementer's change: the real-binary test uses `dead-code --fail-on-issues` to prove "exit 1 + valid report = completed"; the product runner's argv is unchanged (never passes --fail-on-issues); Task 14 must correct the spec/deliverable wording and add this to the probe facts. | The exit-1 path is proven with a dead-code report rather than a combined one (same classifier path). |
| Part 7 E6 | 8 | `scripts/fetch-fallow.mjs` strips `npm_config_allow_scripts` from the child env for the install (the owner's ~/.npmrc allow-scripts entry, forwarded by `npm run`, makes npm 12 refuse a project install with EALLOWSCRIPTS); the approved command line is otherwise unchanged and --ignore-scripts still set. | A user's allow-scripts policy is not applied to this one throwaway install, which runs no scripts anyway. |
| Part 7 E7 | 9 | Review Important #1 (analysis-store.forget swallows the service rejection as false) — decided: restore the brief's behaviour, let the rejection propagate so Task 12's useBusyAction surfaces it; a test was added with the fake's forget rejecting. | Callers must catch (they already must, per the carried Task 5 note). |
| Part 7 E8 | 12 | Accepted the implementer's interface drift: a required `failure` prop on FallowCardDetails/FallowRunPanel and on FallowRunControls (the only way a store rejection reaches the card); the `clear-error` emit (PF13); `connectKey` remount; an in-flight announcement fix. | Small prop churn for Task 13's harness. |
| Part 7 E9 | 12 | Review Minor #9 (plan-mandated double announcement of run endings: banner role="status" + useFallowRun live region) — decided: the banner (C16 StatusBanner, role="status") is the single announcement of run state changes; useFallowRun stops announcing run endings through .ci-sources__live (Z33 "announced once"). | If the banner is not on screen when a run ends, no announcement is made on this screen; the failure Notice (Z34) still covers failures. |
| Part 7 E10 | 12 | Review Important #2 — Trust-and-run (and review's store.read) rejections from data.json use a start-failure string ("could not be read or updated", says nothing ran and what stays), not FALLOW_EXE_CHECK_FAILED; the test was updated. | One more copy string. |
| Part 7 E11 | 12 | Accepted removal of FALLOW_EXE_CHECK_FAILED instead of keeping it — the inspector never rejects (file errors come back as refusals), so the string was unreachable. | A future rejecting inspector shows the start-failure text. |
| Part 7 E12 | 12 | Refusals and Run/Forget failures stay announced by both the live region and the banner (the run-endings ruling, E9, is not extended to them) — a status region appearing together with its text is often not read, so the live region is the reliable path for these one-shot outcomes. | Some screen readers read these twice. |
| Part 7 E13 | 14 | Task 14 was blocked only on `npm run lint`: `tests/component/settings-fallow.test.ts:149`'s `no-unnecessary-type-assertion` sits in a Task 10 file, not Task 14's. Ruling: route the one-line fix back to the Task 10 implementer, the file's owner, rather than fixing it inside Task 14 — landed as commit 50d6e0f. | Low: a borrowed one-line fix in Task 14's own commit would blur per-task attribution; routing it to the file's owner keeps the ledger's task boundaries honest. |
| Part 7 E14 | final review | One fix wave covers Important 1–4, the two deferred minors the reviewer ruled must-fix (`contracts/fallow-runner.test.ts`'s `sleep(500)` → poll with a deadline; focus after a successful Forget), and final Minors 1 (the review's version copy overpromised) and 8 (G6 cited the wrong file for the real ENOENT spawn). | Small wave-scope growth. |
| Part 7 E15 | final review | Final Minors 2–7 are parked: (2) two devices displace each other's record — safe, K2's cost restated as "once per switch between devices"; (3) an internal `grantTrust`/`revokeTrust` error is worded as a start failure; (4) an unsupported record still offers Choose; (5) blocked Cancel's odd description; (6) focus lands on the aria-disabled Import after a command-started run; (7) a raw "analyzer store: not-bound" string surfaces in Settings. None affects consent or evidence truth. | Small UX roughness ships. |
| Part 7 E16 | final review | Recommended-not-blocking deferred minors (the Z36 wiring test, the no-freeze margin, `trustAndRun`'s busy-on-entry check) are parked; the reviewer verified Z36 by reading the code rather than by adding a test. | A later wiring regression would not be caught by a test. |
| Part 7 E17 | final review | Spec §2 rows `FALLOW_REVIEW_ENV` / `FALLOW_REVIEW_VERSION_KNOWN`, and Z23 (`evidenceKept`), Z31 (the Environment row), Z33 (`fallowRunBannerOf`'s signature and `kept`) are corrected in place in `2026-09-23-inspector-ui-part7-design.md`, each marked "(corrected in the final review, Part 7 ledger)" — documentation of what shipped, not a design change. | None. |
| Part 7 E18 | final review | Accepted the fix wave's own choices: `evidenceKept` narrowed to "this failure marked the report stale" with a required `evidenceMarkedFailed` argument on `fallowRunBannerOf`; a mid-run import is blocked inside `ConnectFallowDialog.vue` itself rather than making the request wait; the test fake notifies binding changes without mutating its scripted reads. | Minor rework if a later caller had wanted the old, wider `evidenceKept` meaning ("a report was there"). |
| Part 7 E19 | final review | The re-review's new Minor B1 (`contracts/fallow-runner.test.ts`'s grandchild poll deadline of 10 s exceeds the `it`'s 5 s default timeout — a clear error is unreachable, and an orphaned poll may reap later) is parked and surfaced to the owner as a residual, rather than spending a second fix wave on it. | That contract test can still time out under load with a generic message instead of the poll's own clear one. |
| Part 7 E20 | final review | `no-process-execution.test.ts` and `clean-vault-install`'s network sweep — both whole-`src` scans — have no explicit per-test timeout and can exceed vitest's 5 s default under full-suite load, though both pass alone; parked and surfaced to the owner as a residual, with the one-line fix (an explicit per-test timeout) left for them. | `npm run verify` can exit 1 on a loaded machine even though both tests pass alone. |

### Per task: completion, commit range and fix rounds

- **Task 1** — complete (commits 624cc05..aeafef0, review clean, no fix round).
- **Task 2** — complete (commits aeafef0..1ad5b8e, review clean, no fix round).
- **Task 3** — complete (commits 1ad5b8e..2b501d5, review clean, no fix round; see Part 7 E1).
- **Task 4** — fix round 1/5 (2 addressed, 0 open — throwing-subscriber isolation; re-entrant cancel stuck in cancelling; commits 175c217..5a4fb0c); complete (commits 2b501d5..5a4fb0c, review clean after 1 fix round).
- **Task 5** — complete (commits 5a4fb0c..ea7574c, review clean, no fix round).
- **Task 6** — complete (commits ea7574c..26e2d2f, review clean, no fix round).
- **Task 7** — fix round 1/5 (2 addressed, 0 open — post-killAll timer leak; final deadline after SIGKILL; commits 47b3627..44c8a5a); complete (commits 26e2d2f..44c8a5a, review clean after 1 fix round; see Part 7 E2–E4).
- **Task 8** — complete (commits 44c8a5a..0586069, review clean, no fix round; see Part 7 E5–E6).
- **Task 9** — fix round 1/5 (1 addressed, 0 open — forget rejection now propagates; commits 571bc5f..d0e4489); complete (commits 0586069..d0e4489, review clean after 1 fix round; see Part 7 E7).
- **Task 10** — complete (commits d0e4489..11429db, review clean, no fix round).
- **Task 11** — complete (commits 11429db..0060969, review clean, no fix round).
- **Task 12** — fix round 1/5 (3 addressed, 0 open — one focus-keeping Run/Cancel button; start-failure text for data.json rejections; banner-only run-ending announcement; commits 625c8fa..7bb88d7); complete (commits 0060969..7bb88d7, review clean after 1 fix round; see Part 7 E8–E12).
- **Task 13** — fix round 1/5 (1 addressed, 0 open — 1280×2000 viewport override for the four fallow-card shots, dispatched because three `?analysis=` shots cropped out FallowRunPanel/Banner, Z42 missed; commits d9571ae..16b18a2); complete (commits 7bb88d7..16b18a2, review clean after 1 fix round).
- **Task 14** — implemented (commit f7507e8); BLOCKED only on `npm run lint`: `tests/component/settings-fallow.test.ts:149` no-unnecessary-type-assertion, a Task 10 file, not Task 14's — ruling: route the one-line fix back to the Task 10 implementer (the file's owner) rather than Task 14; note: `install-script.test.ts` passed 7/7 in this worktree (the brief predicted an environmental failure); the living-suite figures reflect a fully green `npm run test` (229 files, 2536 passed, 1 skipped). Task 10's follow-up commit 50d6e0f drops the flagged type assertion, after which `npm run lint` exits 0.

### Deferred minors, by task

**Task 1**
- FallowRunErrorCode literals are duplicated in the type union and in FALLOW_RUN_ERROR_CODES (plan-mandated; could derive the type from an `as const` array).

**Task 4**
- fake-process-port does not honour a pre-cancelled token (hangs; its header claims parity with the adapter) — the pre-probe cancel race is untestable with this fake.
- analysis-coordinator.test.ts:170's title over-promises (it never settles a report before cancel); cancel during a pending onProbePassed is untested.
- the shutdown test's "publishes nothing" assertion is vacuous (nothing was settled).
- probe outcome 'cancelled' without a requested cancel maps to operational version-probe-failed (would mark stale), while the run path treats it as cancel — unreachable today.
- isCancellable is not a type guard; the check is repeated at coordinator :87/:97 and reducer :58/:70.
- re-entrant cancel during evidence.put leaves the new report stored while the terminal state is 'cancelled' (a consequence of the prescribed fix).
- isolate() around evidence.put relies on write-before-notify (the port doc says so; it is not type-enforced).

**Task 5**
- trustAndRun checks busy only on entry; a run starting during its awaits lets bind replace the record before 'busy' is returned (re-check isActive before store.bind).
- revokeTrust throwing on the version-changed path ends the run as spawn-failed/internal (marks stale); grantTrust 'unsupported' is reported as changed-since-review (A7-permitted).
- CARRY to Tasks 10 & 12: service.forget / setTimeLimit can reject with AnalyzerStoreError outside their declared result types — callers must catch.
- consent-gate tests are thin: no other-machine/invalid-record test at service level; trustAndRun store-unsupported is untested; some refusals don't assert zero process requests; the busy test doesn't assert trust stays intact.
- trustAndRun's time limit (120,000 ms default) is not asserted; timeout boundaries 10/1800/9/1801/10.5 are not pinned at the service.

**Task 6**
- the platform→'fallow.exe'|'fallow' ternary is repeated 3× in executable-inspector.ts (:47, :82, :110).
- a 0–3 byte file → not-native path is untested.
- hostPlatform() is untested.

**Task 7**
- guards count labels, not call sites; a second spawn in fallow-runner.ts would pass all three guards (plan-mandated, Z37).
- the shell-option detector sees only object-literal props (o.shell=true / defineProperty is unflagged; the header doesn't list the gap).
- fallow-runner.ts:101 swallows every killProcess error, not only ESRCH.
- ReadableLike lacks on('error'); a stdio stream error would be uncaught.
- process-output.ts:71's chunks.slice(1) per dropped chunk is O(n²).
- unit gaps: stop() after exit before close; timers cleared after a normal close; EACCES vs ENOENT (Z38).
- **FINAL REVIEW SHOULD TRIAGE** (flake risk in verify): contracts/fallow-runner.test.ts:152-154's fixed sleep(500) before reading the grandchild pid — on a slow Windows machine this risks ENOENT plus a leaked grandchild.

**Task 8**
- the afterEach fallback kill uses pid, not -pid (no group kill), in the integration/fallow-real tests.
- **FINAL REVIEW SHOULD TRIAGE** (CI stability): the no-freeze gate observed 22–27 ms against a 50 ms budget.

**Task 9**
- assert-bundle's "exactly once" counts only 'node:child_process', not the unprefixed 'child_process' (plan-mandated).
- CARRY to Task 12: refreshQuietly sets binding=null on a read failure — indistinguishable from "not read yet".
- **FINAL REVIEW SHOULD TRIAGE**: no test asserts Z36 for the wiring (bind/mount calls only readBinding on the service).
- CityView's four new delegations are tested only via a view double (hasSnapshot guard, pinia===null fallbacks).
- analysis-notices' `told` set grows per failed run for the session.
- forget() after a successful service.forget now propagates a refreshBinding rejection (it was caught into binding=null before).

**Task 10**
- the constant is named SETTINGS_FALLOW_EXECUTABLE_NAME; spec §2 calls it SETTINGS_FALLOW_EXE_NAME.
- forgetAnalyzer/changeAnalyzerTimeout try/catch paths are untested (only the purge rejection is tested).
- notify() duplicates showFailure()'s Notice construction in settings-tab.ts.

**Task 11**
- FALLOW_ROW_COLLECTED lives in audit-copy/fallow.ts while its sibling FALLOW_ROW_EXECUTABLE is in fallow-run.ts (PF18, record-only).
- the new kit-evidence test unmounts; its siblings don't.

**Task 12**
- connectKey remount can discard a busy step when a run request arrives mid-step (pre-flight scan E13).
- the FallowInstalledRoute header comment is inaccurate; clear-error is only needed by changePath.
- the failure banner object is built inline in FallowRunPanel (add a failureBanner beside refusalBanner).
- FALLOW_EXE_FORGET_FAILED doesn't say what stays usable (spec §2).
- plan-mandated: binding===null after a read failure shows "No executable chosen" and hides Forget; POSIX gets the Windows hint (executableName is only on the binding view).
- the auto-check on mount doesn't place focus before check(); a refusal or throw leaves focus nowhere.
- the dialog alert sits below the installed route's buttons (it sits above them on the import route).
- tests don't cover Escape/Cancel/backdrop being ignored while the installed route is busy; Choose/Forget clicks while running; Enter in the path input.
- **FINAL REVIEW SHOULD TRIAGE** (a11y): after a successful Forget, the focused Forget button unmounts and focus drops to `<body>`.

**Task 13**
- the failed-run shot shows the collapsed "Error output (last lines)" `<details>`, not the log text.

### Final verification (50d6e0f)

- `npm run verify`: typecheck, lint:fast and lint green.
- `test`: 228/229 files, 2535 passed, 1 skipped.
- 1 failure: the known clean-vault-install flake ("reaches no network API"). It timed out at 5 s under full-suite load, and passed 15/15 when re-run alone (a documented known flake).
- `build` and `assert-bundle` OK, dist/main.js 1,128.55 kB.
- `npm run test:fallow` 10/10 on fallow 3.27.0, win32.

### Final whole-branch review

**Verdict** (8841b4c..159e9b3, most capable model): "With fixes" — 0 Critical, 4 Important, 8 Minor. The rulings that disposed of every finding are Part 7 E13–E20 above.

**Fix wave** (commits 159e9b3..950b87f, one wave, single fixer, no subagents, all edits through Edit/Write):

| Commit | Finding |
|---|---|
| 6c6ab3e | Important 1: the banner said "kept and marked stale" when nothing was — `evidenceKept` now means "this failure marked the report stale", and `fallowRunBannerOf` takes a required `evidenceMarkedFailed` so `kept = evidenceKept && evidenceMarkedFailed`. |
| 6c6ab3e | Important 2: the Data & scans card went stale after a Settings change — `FallowAnalysisService.onBindingChanged` notifies after every successful binding write (bind, trust grant/revoke, forget, time limit, purge), from any source; the analysis store subscribes and refreshes only the bound codebase. |
| 6c6ab3e | Important 3: the review's Environment row was false on Windows, and the limitations doc overclaimed — `FALLOW_REVIEW_ENV` becomes a function of `windows`; the wp01 limitations note is split into what is stated where the user meets it versus stated only in the doc. |
| 6c6ab3e | Important 4: the import command bypassed "Import is blocked mid-run" (Z32/K9) — `ConnectFallowDialog.vue`'s Choose report… and Attach are `aria-disabled` and guarded while that codebase's analysis is active; the dialog still opens, so the request is answered rather than dropped. |
| 6c6ab3e | Must-fix minor: focus dropped to `<body>` after a successful Forget — `FallowRunPanel.vue` moves focus to "Choose executable…" when Forget unmounts under focus. |
| 6c6ab3e | Minor: the review's version copy overpromised a pinned, re-checked version — `FALLOW_REVIEW_VERSION_KNOWN` now says the version is recorded after you trust it again. |
| 9430840 | Must-fix minor: a flaky fixed `sleep(500)` in the runner contract — polls for the grandchild pid on a deadline instead; no `it(` was added, so the K28/PF5 test-count derivations are unchanged. |
| 950b87f | Minor: G6 "Missing native binary" credited the wrong file for the real ENOENT spawn — the gate-evidence note now credits `tests/contracts/fallow-runner.test.ts`, and its living-suite line is refreshed with the two load-only timeouts disclosed. |

**Re-review**: 8/8 findings ADDRESSED, no new breakage. New: Minor B1 (the grandchild poll's 10 s deadline exceeds the `it`'s 5 s default timeout) and a spacing nit — both parked (Part 7 E19).

**Controller's verify at 950b87f** (typecheck/lint green; test not fully green):
- 2547 passed, 1 skipped, 1 failed;
- the 1 failure is the known `clean-vault-install` network-sweep timeout under load (the documented flake, which passes alone);
- build and assert-bundle OK.

**Residuals (resolved at finish, supersedes E19 and E20):**
- B1 — the runner contract's grandchild poll deadline (10 s) exceeded its `it`'s default timeout (5 s), so a hang there reported a generic timeout instead of the poll's own clear error;
- no explicit per-test timeout on the two whole-`src` scan tests (`no-process-execution.test.ts`; `clean-vault-install`'s network sweep), which exceeded vitest's 5 s default under full-suite load though both pass alone.

| # | Ruling | Cost if wrong |
|---|---|---|
| Part 7 E21 | The finishing gate ran the full suite three times, and the `clean-vault-install` network sweep failed on all three. It is not a flake on this machine: `npm run verify` stayed red. E19 and E20 are reversed, and 7ced8d2 fixes both residuals. The fix gives explicit per-test timeouts to the whole-`src` scans (30 s; four tests) and to the grandchild-poll test (20 s, above its 10 s poll deadline). No assertion changed and no global timeout was set. | A genuinely hung scan now takes up to 30 s to report. |

**Controller's verify at 7ced8d2:** `npm run verify` exit 0. 229/229 test files; 2548 passed and 1 skipped; build and assert-bundle OK (dist/main.js 1103 kB).
