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

None yet. The controller records "Part 7 E1"… here, starting with the pre-flight conflict scan before Task 1.
