---
project: codebase-inspector
title: Gap closure — SDD ledger (rulings)
date: 2026-10-03
branch: feat/gap-closure
---

# Gap closure — rulings

This ledger records every ruling made while planning and executing the gap-closure sub-project, and what each one costs if it is wrong.

- **Spec:** `docs/superpowers/specs/2026-10-03-gap-closure-design.md`. It holds the owner decisions GCO1–GCO25, the inventory GRD1–GRD15, GRC1–GRC14, GRA1–GRA10 and GRB1–GRB18, the decisions GCN1–GCN12, and scenarios 41–46.
- **Plans:** one per part, written after the spec is approved, in landing order: D, C, A, B.
- **Branch:** `feat/gap-closure`, from `1baa572` (the PR 1 head).
- **Precedent:** every earlier ledger, notably the WP-04 Part 2 follow-ups ledger (FP1–FP12, FQ1, WP-04.2 Follow-up E1–E8).
- **Numbering:**
  - **GCO…** are owner decisions;
  - **GR(A|B|C|D)…** are the spec's inventory rows;
  - **GCN…** are the spec's decisions;
  - **GCP…** are planning rulings;
  - **GCQ…** are pre-flight rulings;
  - **"Gap-closure E1…"** are execution rulings.

  None of these prefixes occurs anywhere in `docs`, `src`, `tests` or `scripts` (checked with grep).
- Every ruling reads: **Ruling:** what — why — cost if wrong.

## Inventory (2026-10-03)

A read-only inventory at `1baa572` found 87 open items across PR 1's body, every ledger, the WP-01 limitations and the deliverables. They fall into six groups:
- 20 owner decisions;
- 23 rows of product gaps;
- 13 items carried out of scope;
- 11 test and harness issues;
- about 20 minors;
- about 25 groups that older text lists as open but that are closed.

Four read-only audits then gave every row its evidence and design. These are the spec's §3 tables.

## Planning rulings

| # | Ruling |
|---|---|
| GCP1 | **Ruling:** four parts in the order D, C, A, B, each with its own plan, execution, final review and push onto PR 1 (GCN1). — Part D makes native runs trustworthy (crash diagnostics, load gate), and Part C's gates then measure A and B as they land. Separate pushes keep each review surface reviewable. — Low: four PR 1 sections instead of one. |
| GCP2 | **Ruling (GRC1):** the review-repository port moves from `ui/stores/ports` to `application/ports`. `review-record-codec` stays in `ui/read-models`, and its import from `adapters/storage` is the one recorded exception to GCO10. — The codec depends on `ui/read-models/review-state(-import)`, which pulls in the report store, the seeded fixtures and copy; moving it is size L for no behaviour. The exception names the file, and the rule itself is unchanged. — Low: one adapter keeps a ui import until a later pass moves the codec. |
| GCP3 | **Ruling (GRA1):** if 84d92d7's 64.2 % cannot be reproduced to within 0.1 points by the calibrated occupancy definition, the baseline becomes shelf packing measured on HEAD's tree, with both figures recorded. — The original scan's scope and exclusions are not recorded, and the +10 rule needs a baseline the spike can recompute. — Low: the bar moves by however far HEAD's tree differs. |
| GCP4 | **Ruling (GRA6):** nav-inline (leaf ≥ threshold) and the city drawer (city inline ≥ threshold) keep one constant unless the measurement sweep shows the nav band clipping. — They gate different boxes, but one constant has kept them consistent since WP-02, and splitting them without evidence adds a state. — Low. |
| GCP5 | **Ruling (GRA8):** the profile name shows in the S05 toolbar; the TopBar keeps the folder name. — This avoids showing the same name twice, and the folder stays the place-of-record label. — Low. |
| GCP6 | **Ruling (GRA10):** the Three.js marker is cleared on unload only when it equals the bundled `REVISION`. This reverses LIM's "disclosed rather than suppressed". — Clearing only our own revision removes the false warning on every re-enable, while a genuine double bundle in the same session still warns. — Low: another plugin with the same revision could lose its marker, which is harmless. |
| GCP7 | **Ruling (GRB9):** the list of fallow 3.27.0 config file names comes from fallow's own documentation or the binary's strings, and the source is recorded. `extends` chains are not followed. — The provenance must name what fallow reads, and only fallow's own documentation can say that. — Low: a config file outside the list is not recorded; the list names its source. |
| GCP8 | **Ruling (GRB10, GCN10):** an older plugin build that meets a v2 analyzer slice reports it as invalid with its reason and refuses to write. — This is the existing contract for an unknown record shape (spec §7), and it never overwrites newer data. — Medium: after a downgrade, fallow bindings stay unusable until the newer build runs again. Recorded as the cost of GCO23. |
| GCP9 | **Ruling (GRA2):** the automatic reconstruction cap is **3**, and it resets only on Retry 3D. A list ↔ 3D round trip does not reset it. — Three tolerates transient losses (GPU driver resets) and stops a loop. A round-trip reset would let the loop return through the UI. — Low. |
| GCP10 | **Ruling (GRD4):** the native load gate's threshold is **50 % CPU over 10 s**, with a wait of up to 15 minutes, and a named refusal otherwise. — That is the threshold the landing runs practised by hand. A refusal writes no report and exits non-zero, so it can never read as a pass. — Low: a busy machine refuses rather than runs. |
| GCP11 | **Ruling (GRD1, GCO25):** procdump is downloaded only after the owner confirms the exact file, source and size in chat, and it is used only in the opt-in diagnostic mode of the native harness. Its path comes from an environment variable and is never committed. — Downloading a file needs explicit permission; GCO25 granted the method, not the download itself. — None. |
| GCP12 | **Ruling:** the spec and this ledger are committed before any plan, and the controller stops for the owner's review of the spec. Part D's plan is written only after approval (brainstorming's gate: written-spec approval permits writing plans). — None. |

## Pre-flight scans

### Part D (2026-10-03 at `edccf12`)

**Line counts:** all match the plan, except `session.ts` (48 lines, not 51) and `commands.e2e.ts` (205, not 213).

**Consumes names:** all found. Each is listed below with where it lives.
- `execArgv`: test-level, in Vitest 5.0.1.
- `writeSyntheticTree`: `workspace-files.ts:95`.
- `startScanNoWait`: `inspector.ts:179`.
- `cancel-scan` and `view.isScanRunning`: `commands.ts:57`, `:67`.
- The `css-change` handler: `city-view.ts:184`.
- `trustAndRun`: the service at `:65` and `:268`, the store at `:107`.
- The `.d.mts` precedent for `.mjs` imports: `harness-shot`.
- The YAML fact table: `obsidian-facts.e2e.ts:161-175`.

**Pair checks:** Tasks 1↔6 both edit `vitest.config.mts` (Task 1 adds `execArgv`, Task 6 adds `setupFiles`). Native runs pass the load gate after Task 1. Only Task 3 appends a title. Task 5 keeps `analyze` at 9.

**Result:** 0 blocking, 1 correction (GCQ1).

| # | Ruling |
|---|---|
| GCQ1 | **Ruling:** narrowing `trustAndRun`'s type also deletes the `fallow-run-outcomes.test.ts:117` case. That case drives a fake service through a return kind the real service cannot produce, and the narrowed type makes it unrepresentable, so it is deleted rather than rewritten. — Low: if the type is ever re-widened, typecheck forces the branch back. |

## Execution rulings

### Part D

| # | Ruling |
|---|---|
| Gap-closure E1 | **Ruling (amends Task 3, GRD3):** scenario 41's write elsewhere becomes a profile **rename** made through the open tab's private profile store (the polish E5 precedent). Our page is found through `app.setting.searchNavItems` (our tab id, `isPage`, the new name), read from the main window. — The probe showed that Obsidian's settings search indexes only setting and page names, never field values, so the planned notes-folder control could not tell GREEN from RED. Page names are indexed and profiles are watched, so the stale index and the fresh one discriminate. — Low: it reads two Obsidian internals, and a rename breaks loudly. |
| Gap-closure E2 | **Ruling:** focus in the settings search box holding the render wait is accepted and recorded in LIM. The wait covers every field of the settings document (E3/E12). — Low: search results can lag a write by one focus change. |
| Gap-closure E3 | **Ruling (amends GRD5):** E9's RED needed both guards removed: the command's checkCallback and `CityView.openReportImport`'s own `hasSnapshot()`. — The "no effect" half is defended twice; with only the command mutated, scenario 7 stays green because the second guard works. — Low: the scenario cannot tell which guard held, and either suffices. |
| Gap-closure E4 | **Ruling (amends GRD7):** a full dispose-and-recreate was already caught by scenario 3's element-identity check. The new 0-removals observer is shown RED by re-appending the same canvas element, which the identity check cannot see. — None. |
| Gap-closure E5 | **Ruling (amends Task 7's remedy table):** the remedy is Node 24 ≥ 24.16.0, not Node 22. — The procdump dump, symbolized with WinDbg and Node 24.15.0's PDB, shows the crash in libuv's Windows TCP connect: `__report_gsfailure` ← inline `uv__insert_pending_req` ← inline `uv__tcp_try_connect` ← `uv__tcp_connect` ← `TCPWrap::Connect` ← JS ← `AfterGetAddrInfo`. That is FAST_FAIL code 2, a stack-cookie failure, when the WebDriver client connects to chromedriver after a DNS lookup. Node 24.15.0 ships libuv 1.51.0; every Node 24 from 24.16.0 ships 1.52.1, which rewrites exactly that code (`uv__insert_pending_req` moved and de-inlined, inline asm replaced). — Medium: the changelog shows a rewrite, not a named fix, so only the 11-run proof shows it works. |
| Gap-closure E6 | **Ruling:** the remedy is scoped to the native runner. `scripts/native-tests.mjs` refuses with exit 4 on libuv < 1.52; the final fix wave also refuses at the native Vitest config's load, and scopes both to Windows. No `engines` field is added. The native suite runs under a verified portable Node 24.21.0 until the owner upgrades. — The crash lives only in the native WebDriver path, and an engines floor would warn on every npm command on the owner's Node 24.15.0. — Low: a developer on an older Node gets a named refusal, never a crash. |
| Gap-closure E7 | **Ruling (closes final-review Minor 2):** three spec items are accepted where their evidence landed. — The evidence exists in better-scoped places.<ul><li>GRD1's Electron version is carried by the chromedriver version in `environment.json` (electron-chromedriver is versioned with Electron).</li><li>GRD4's CPU and process counts are in the run's `load-gate.json` and the per-case breadcrumbs.</li><li>The refusal path's "spawns no Vitest" is shown by Task 7's live refusal and the final review's check of the code order.</li></ul>— Low: a regression moving the refusal after the spawn is caught only by review. |

**The crash investigation (GRD1):**
- **Downloads:** each was approved by the owner, recorded, and kept in the session scratchpad (never in the repository):
  - ProcDump (1,255,611 bytes, Microsoft-signed);
  - WinDbg 1.2606.22001.0 (via winget);
  - Node 24.15.0's `node_pdb.zip` (94,202,352 bytes);
  - portable Node v24.21.0 (37,618,919 bytes; its SHA-256 matched nodejs.org's SHASUMS, and it is Microsoft-signed).
- **Baseline arm** (diagnostics on, procdump attached): runs 1 and 2 passed 41/41; run 3 crashed in `investigation.e2e.ts` at the breadcrumb `connect:start`, while a fresh WebDriver session was opening. That is 1 crash in 3 runs. The Node fatal report was empty, because a fast-fail bypasses it.
- **Remedy arm:** under Node 24.21.0 (libuv 1.52.1), **11 consecutive green 1.13.4 runs** (41/41 each, CPU load 4–9 %), plus one green latest run (1.13.7).

**Every other `npm run test` / `npm run verify` / native run of Part D:**
- **Task 1:** smoke 2/2; a full native run 40/40 through the new gate (load 9 %); then the fix-round proof of a Node report landing in `node-reports`.
- **Task 2** (`node-serial` only):
  - the freeze mutation was RED on the old file and on the new file;
  - an idle run passed (23.8/16.2/22.2 ms);
  - 3 burner runs passed, with single-run spikes (190.2, 51.2, 51.6 ms) absorbed by best-of-3.
- **Task 3:** probe, RED, GREEN and the full `settings.e2e.ts` (7/7); load 4–5 %.
- **Task 4:** 9 native runs at load 3–8 %, no crash.
- **Task 8:**
  - `npm run test` before the refresh: exit 1 on the expected G8 Unit count only. Z38 passed: pre-control 21.6; hang 21.2/24.3/24.5; streamed 20.3/23.5/16.0; post-control 28.3 ms.
  - `verify` #1: exit 0. Z38 24.4; 22.9/23.7/23.1; 18.2/23.5/24.2; 26.3 ms.
  - Native 1.13.4: 41/41 (load 6 %). Native latest (1.13.7): 41/41 (load 18 %).
  - `test:fallow` 11/11; `analyze` 9.
  - `verify` #2: exit 0, 3536 passed, 1 skipped. Z38 23.2; 24.1/22.2/22.2; 21.3/16.0/16.7; 25.6 ms.
- **Final fix wave:**
  - `verify`: exit 0. Z38 22.7; 31.4/24.9/26.8; 26.2/20.0/20.8; 24.5 ms.
  - Native 1.13.4 under Node 24.21.0: 41/41 (load 33 %).
  - Native latest on the final head (`c75c4d9`) under Node 24.21.0: 41/41, "Verified 41 executed native Vitest cases, including all 41 required scenarios." (496 s).
- **Z38 across Part D:** it passed in every full-suite run. In `node-serial` it failed only under the deliberate freeze mutation.

**Final whole-branch review (opus, `1baa572..97dba1e`): ready with fixes.**
- It found 0 Critical, 2 Important and 7 Minor issues:
  - a refusal left the previous green report at the gate's path, and an old `junit.xml` could be copied into a new run;
  - the crash fixture asserted a guard the real crash never reached (the recorded report had `success: true`, with one scenario pending).
- One fix wave (`c75c4d9`) closed both Important issues, Minors 1 and 3–7, and two fold-ins (scenario 3's `finally`, the backtick regex). Minor 2 is ruled in E7. The scoped re-review found all of them addressed.
- **Accepted by design:** GRD9 (E15, an equivalent mutant), and the GRD15 acceptances and F closures, listed in the spec's §3.1.

**Commit trailers:** every Part D commit ends with the literal trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", checked one commit at a time before the push.

### Part D deferred minors

The final review triaged these as acceptable follow-ups:
- `hostProcessCounts` sits outside the breadcrumb's try; the host process counts are machine-wide; `waitedMs` includes the 10 s sample.
- The Z38 best-of-3 trade-offs: a stall on the first run only is absorbed, the post-control follows the streamed run, and the worst case is about 90 s.
- Scenario 41's control reads the search-DOM absence right after typing; its stale `storedPages` check carries it. The group counts are evidence only.
- Scenario 4's poll to false proves the cancel was accepted, not that the walk ended.
- A describe now holding one test; the old three.js cleanup URL in `WP01-DESIGN-TO-IMPLEMENTATION.md:398` and the generated HTML.
- procdump's `attached` breadcrumb is written at spawn; its mkdir is outside the try; the 1-in-3 rate was measured under a debugger.
- The guard's comment says `uv_tcp_connect`; two-part version strings fail closed, untested.
- The G8 heading's inherited bold span.

**Owner action:** this machine's system Node is 24.15.0, so native runs refuse until it is upgraded to Node ≥ 24.16.0 (the current 24 LTS is 24.21.0).
