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

### Part C (2026-10-03 at `f492223`)

**Line counts:** as in the plan's size table (measured at `59649b8` while writing it).

**Consumes names:** all found.
- The sweep regexes: `tests/unit/evidence-numbers.test.ts`.
- `mayPublish`: unit tests in run-state, analysis-state and gate-evidence.
- The move target `src/application/ports/` exists.
- `LOT_FOOTPRINT`, `MAX_DIRECT_SUBDISTRICTS`, `DRAG_THRESHOLD_CSS_PX` and `entityPath` have no importer outside their own files.
- The kit tone tokens sit at `kit.css:4-8`, the fills at `:19-20`.

**Pair checks:**
- Tasks 1↔4: CI's production audit depends on Task 1's override landing first (order).
- Tasks 2↔9: `analyze` is 4 after Task 2, and both edit the CRLF evidence notes (sequential).
- Tasks 5↔7↔8: all edit `screens-explore.css` (sequential, disjoint rules).
- Task 3's port has 20 src and 45 test importers, as the plan states.

**Result:** 0 blocking, 1 rework (GCQ2).

| # | Ruling |
|---|---|
| GCQ2 | **Ruling:** Tasks 7 and 8 also run the axe test files (`tests/component/axe-*.test.ts`) in their per-task gate. — Their component and copy changes can break a passing axe check, and Task 6 lands before them. — None. |

### Part A (2026-10-04 at `20159bc`)

**Consumes names:** checked against the code while planning:
- `CityViewport.vue` is at 400 lines and frozen. Its local `unavailableReason` is exposed through `defineExpose`, and it injects `'createCityRenderer'`.
- `makeInertPort` exists.
- `finishFailed` carries no cause.
- `runRefresh` never stats the root.
- `watchPluginData(plugin, keys, listener)` is at `plugin-data-shape.ts:62`.
- The build-output test lives in `tests/host/`.
- pinia resolves to `dist/pinia.js`, with the `saveAs` needle at `:174`.
- `LAYOUT_VERSION` is not persisted.
- The jsdom host glob already covers the new host test.

**Pair checks:**
- Tasks 1→2 share the occupancy test.
- Task 2 changes every later city capture.
- Tasks 4↔6 both edit `city-view.ts` (297 + ~20 lines, within the 360 budget) and `styles.css`, in disjoint rules.
- Task 7 produces the `--wide` CLI that Task 8 consumes.
- Tasks 8–10 all add harness shots.
- Tasks 6, 11 and 12 all edit LIM.
- Task 12 runs the full gate at 42 scenarios.

**Result:** 0 blocking, 0 rework. No GCQ ruling was needed.

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

### Part C

| # | Ruling |
|---|---|
| Gap-closure E8 | **Ruling:** Task 5's coverage-bar fill (`screens.css:31`, painting the desaturated `--ci-warning` text token) enters fix round 1 with the two Important findings, although the reviewer graded it Minor. — It contradicts the brief's "fills and borders keep `--ci-tone-*`", so it is a spec deviation this task introduced, not polish. — None. |
| Gap-closure E9 | **Ruling:** the four count strings that still read "1 files", "1 groups" or "1 smaller modules are" (`ARCH_NODE_FILES`, `ARCH_NODE_LABEL_NOT_ANALYSED`, `RELATION_CYCLES_CAPTION`, `ARCH_OMITTED_NOTE`) get plural agreement only, with no rewording or format change, in Task 8's fix round. — It is the defect GCN12 already fixed for `ARCH_RULES_CAPTION` under GCO21, it is visible on the Map node face, and plural agreement is not a wording decision. — Low: a grammar fix the owner did not list; one commit reverts it. |
| Gap-closure E10 | **Ruling:** Plugin Foundations gets the id `WP-00`, and its Delivery record states that the id was assigned during gap closure, because no planning document names one. — The deliverables test needs an id, and order 1 precedes WP-01. — Low: the owner may rename it; without the note a reader might infer a planned "Package 00". |
| Gap-closure E11 | **Ruling:** Task 9's per-task review is folded into the final whole-branch review, which is told to check every Task 9 evidence claim. — Task 9 is docs-only, and the final review must re-verify the evidence anyway. — Low: one independent look fewer at evidence prose; the final review re-ran every figure. |
| Gap-closure E12 | **Ruling:** the one fix wave takes the final review's Important finding and Minors 2–6, plus two promoted Task 6 minors (per-tab axe content guards; `sizeCityStage` restoring). Minor 7 and every other deferred minor stay deferred. — Each promoted item is a gate that could pass silently or a visible regression this part introduced. — Low: a larger fix wave, in one commit. |
| Gap-closure E13 | **Ruling:** no native rerun after the fix wave. — It touches CSS colours and rule order, unit and component tests, the ESLint config, the CI trigger and docs, none of which the native scenarios exercise beyond rendering; 41/41 on 1.13.4 and latest stand from Task 9 (`0f8add8`). — Low: a native regression would surface in Part A's native gate. |

**Every `npm run test` / `npm run verify` / native run of Part C:** Tasks 1–8 ran no full suite (each ran its touched and importing test files, so no Z38 figure).
- **Task 9:**
  - `npm run test`: exit 1 on the expected G8 Unit count and on `clean-vault-install` (the implementation report still quoted the pre-GCN12 source claim; fixed). Z38 passed: control 18.9; hang 21.8/20.6/26.3; streamed 19.6/16.0/19.0; post-control 25.2 ms.
  - `vitest --reporter=json` (the per-layer figures): exit 1 on one drift. Z38 16.4; 30.1/20.3/21.5; 18.6/24.4/23.6; 23.8 ms.
  - `verify` #1: exit 1 on the mirror's drift. Z38 27.0; 22.6/16.5/24.6; 22.6/24.8/16.2; 29.4 ms.
  - `verify` #2: exit 0, 328 files, 3775 passed, 1 skipped. Z38 24.1; 25.2/22.8/24.6; 21.1/19.5/18.7; 16.5 ms.
  - Native 1.13.4 under Node 24.21.0: 41/41 (load 12 %, 491 s). Native latest (1.13.7): 41/41 (load 26 %, 485 s). Both printed "Verified 41 executed native Vitest cases, including all 41 required scenarios." No retries.
  - `test:fallow` 11/11; `analyze` 4; `npm audit` 0 (also with `--omit=dev`); `harness-shot` 86 captures.
- **Final fix wave:**
  - `verify` #1: exit 0, 3816 passed, 1 skipped. Z38 21.8; 26.1/24.3/26.5; 23.1/20.9/23.1; 22.6 ms.
  - `verify` #2 (final tree, after the G8 refresh): exit 0, 328 files, 3816 passed, 1 skipped. Z38 22.0; 25.9/24.5/16.9; 22.7/16.1/18.3; 22.7 ms.
- **Z38 across Part C:** it executed and passed in every full-suite run.

**Final whole-branch review (opus, `f492223..0f8add8`): fix wave needed.**
- It found 0 Critical, 1 Important and 6 Minor issues. The Important one: four borders (`kit.css:70`, `:302`; `screens-configure.css:103`, `:107`) still painted `--ci-warning`, which Task 5 had made a text token, so they went from the host orange to a muted orange-grey.
- One fix wave (`c59a465`) closed it with a sweep that fails on any text token in a border, background, fill, outline or shadow, and closed Minors 2–6 and the two promoted Task 6 minors (E12). The scoped re-review found all of them addressed: ready to push at `c59a465`.
- The final review re-ran every Task 9 figure: the counts are true, and only four lines of prose were off (fixed).

**Commit trailers:** every Part C commit ends with the literal trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", checked one commit at a time before the push.

### Part C deferred minors

The task reviews and the final review triaged these as acceptable follow-ups:
- The historical gate-evidence rounds still say "9 findings, unchanged"; a new Part C section states 4.
- The layering lint's tests ban stays a glob, so a bare `'../tests'` import is not caught (a regex hit the real `src/ui/audit-copy/tests`); the dynamic-import ban covers string literals only, so a computed or template-literal `import()` gets through; the lint test lints real files, so a rename throws.
- CI: the native-gate absence is pinned by a three-name blocklist, not strict step equality; `cancel-in-progress` also cancels a superseded run on `main`; the actions are pinned by major tag, not SHA.
- Contrast: SVG text `fill:` and opacity-dimmed text escape the `color:` sweep; `--ci-on-action` is gated only on the four fills; the table-row hover edge paints three sides (each cell's bottom border covers the fourth); the 3 px nav bar follows the 6 px radius; the sweep's allowlist needs an entry for any new ink-as-mark use, matches selectors by prefix, and ignores a bare `--ci-text`.
- axe never mounts the self-violation marker (it is aria-hidden, with visually hidden text); the source preview region could be named by its Panel heading.
- `selfViolations` counts file-pair edges while the Violations card counts findings, so they differ when one file reaches a same-module target through two specifiers; the matrix marker has no `title`.
- At 176 px "Your rules violated" wraps to three lines; the card-fit test pins token values as a sanity check, and its local `declared()` duplicates one in `contrast-tokens.test.ts`.

### Part A

| # | Ruling |
|---|---|
| Gap-closure E14 | **Ruling:** subagents return their report as text, and the controller saves it to the task's report file. Sections that can be reproduced are condensed; for example, Task 1's spike harness is kept as the NFDH rule plus a description. — The Write tool now refuses report files from subagents. — Low: a condensed report loses detail that the transcript still holds. |
| Gap-closure E15 | **Ruling (GRA1, GCO2):** adopt NFDH. — All three candidates cleared +10 points, with the root aspect inside 0.7–1.43 and no overlap. NFDH is the simplest (today's shelf loop over a footprint-descending, path-tie-broken order), has the largest gain (54.66 → 71.87 %), and is the cheapest (about 1.2× shelf; skyline is about 15×). — Low: it changes every city capture; the revert is one commit. |
| Gap-closure E16 | **Ruling:** a refresh-time root-unavailable raises no Notice; COPY-28 in the status banner is the one signal, as GRA4's proof names. — No run starts, so the run status stays as it was. — Low: a user who misses the banner gets no toast. |
| Gap-closure E17 | **Ruling:** an existing root whose listing fails (readdir EACCES) stays a generic failure in Part A. — "Unreadable" as its own state is GRB17 in Part B. — Low: until then, an unlistable root reads "Scan failed…" instead of COPY-28. |
| Gap-closure E18 | **Ruling (amends Task 7):** the threshold sweep measures what the threshold gates. For each candidate T it checks the city at content = T (leaf = T + 220, nav inline) on s05 and s07, and the nav band at leaf = T. Topbar clipping in drawer mode at sidebar widths is recorded, not used as threshold input. — The first sweep set leaf = T and so only ever measured the drawer layout, because the `@container` resolves on `.ci-shell__content` (leaf − 220). The corrected sweep found `.ci-inspector__actions` overflowing at every width, which was fixed with `flex-wrap`. — Low: the threshold is set against the content box, and nav-inline moves with it. |
| Gap-closure E19 | **Ruling:** reopen Task 4 for one fix. The Retry 3D hover paints `--ci-hover`, as contrast decision #4 requires; `contrast-tokens.test.ts` had not been in Task 4's gate. — Low. |
| Gap-closure E20 | **Ruling (GCO19's optional half):** the selected file's arc lines and cones draw with `depthTest: false` and `renderOrder` 1, with WP-03 N29 and §6 item 6 amended in writing. — The dense-city capture showed the arrowheads, which are the only carrier of direction, hidden behind front-row buildings even after corridor clearance. — Low: an arc can draw over a building that stands in front of its far end. |
| Gap-closure E21 | **Ruling:** accept the unrequested `.oxlintrc.json` allowance of `no-underscore-dangle` for exactly `__THREE__`. — The name belongs to Three.js. — Low. |
| Gap-closure E22 | **Ruling:** one `verify` run's single EPERM failure, a temp-folder rename in `tests/integration/scan-lifecycle.test.ts`, is environmental. — No Part A commit touches that area, the runs on either side of it passed on the same tree, and the native gate was never retried. — Low: an intermittent integration failure could hide there. |
| Gap-closure E23 | **Ruling:** Task 12's per-task review is folded into the final whole-branch review, as in E11. — Low. |
| Gap-closure E24 | **Ruling:** GRA5's ≥ 1140 px and GRA6's ≥ 320 px both mean the stage's content box (`clientWidth`, which is what `CityViewport` measures). `harness-measure` records it and decides on it. The list percentage moves from 16 % to 15 %. — The border box had read 324 (322 content) at 760, and 1140.2 (1138 content) at 1876. — Low: the list is one point narrower. |
| Gap-closure E25 | **Ruling:** the one fix wave takes the final review's three Important findings and every deferred minor it promoted, plus a harness-seeded codebase name and occupancy no-overlap and aspect pins. — Each promoted item is a pin that could not fail, or prose that was not literally true. — Low: a larger fix wave, in one commit. |
| Gap-closure E26 | **Ruling:** after the fix wave, re-run the native gate on the 1.13.4 baseline only. — The wave changed a layout percentage and added a try/catch in picking, both of which reach the real renderer. — Low: a latest-only regression would surface in Part B's gate. |
| Gap-closure E27 | **Ruling:** three files created in Part A as CRLF (`scripts/harness-measure.mjs`, `tests/component/retry-3d.test.ts`, `tests/unit/investigate-rows.test.ts`) are renormalized to LF in a chore commit (`git diff -w` empty). — The subagents' Write tool produced CRLF, as it did for `tests/harness/fixture.ts` in Task 10. — None. |
| Gap-closure E28 | **Ruling:** the E27 chore commit's message is amended in place to carry the plan's literal trailer (it was an unpushed tip, and only the message changed; the tree is identical). — The trailer is a Global Constraint. — None. |

**Native and full-suite runs of Part A:**
- **Tasks 1–11:** no full suite was run during these tasks; each ran its touched and importing test files.
- **Task 5:** scenario 42 was run alone. RED: the banner was null, because a refresh now reports without failing the run (load 5 %). GREEN: 3/3 (load 13 %).
- **Task 11:** the unload scenario was run alone. RED: "186" (load 8 %). GREEN: 2/2 (load 16 %).
- **Task 12:**
  - `npm run test` exited 1 on the expected count drift only (350 files, 3,935 tests). Z38 ran.
  - `verify` #1: exit 0, 3,934 passed, 1 skipped. Z38: 20.9; 24.9/16.3/21.4; 24.2/16.1/15.9; 23.9 ms.
  - `verify` #2: exit 1, the one EPERM failure (E22).
  - `verify` #3: exit 0, on the same tree.
  - Native 1.13.4: 42/42 (load 7 %). Native latest (1.13.7): 42/42 (load 10 %).
  - `test:fallow` 11/11; `analyze` 4; `npm audit` 0 (also with `--omit=dev`).
- **Final fix wave:**
  - `npm run test`: exit 0, 3,944 passed, 1 skipped. Z38: 19.6; 22.9/25.0/16.8; 24.9/16.1/21.3; 23.2 ms.
  - `verify`: exit 0. Z38: 21.9; 21.5/21.6/16.7; 23.1/16.0/16.1; 16.8 ms.
  - Native 1.13.4 (E26): "Verified 42 executed native Vitest cases, including all 42 required scenarios." (load 10 %).
- **Z38 across Part A:** it executed and passed in every full-suite run.

**Final whole-branch review (opus, `3df98ea..8e60ccf`): fix wave needed.**
- It found 0 Critical and 3 Important issues:
  - the stage-margin evidence quoted the border box;
  - three LIM and deliverable claims were inaccurate;
  - three Review Focus pins could not fail (Retry through the host, a two-leaf rename, pointer release without capture).
- It confirmed:
  - `CityViewport.vue` is untouched;
  - the budgets hold;
  - the §4 amendments are exactly GCN3's;
  - all 18 trailers are present;
  - the CRLF notes are intact;
  - the `city-view` ordering is correct (the guard never blocks the completion refresh).
- One fix wave (`2ac9772`) and the E27 chore (`ab7d7b6`) followed. The scoped re-review found every Important finding and promoted item addressed. Its one residual was the chore commit's trailer, which a subagent had written as Haiku. The commit was unpushed, so its message was amended in place (Gap-closure E28: message only, tree identical).

**Per-task fix rounds:**
- Task 5: the lastReactedRun guard. A refresh-time ROOT_UNAVAILABLE had replayed the previous run's notice or republish.
- Task 6: the name refresh after a late `setState`.
- Task 10: the fixture line endings, truthful tower corridors, and an endpoint-skip control.
- Task 4's regression fix (E19).

**Commit trailers:** every Part A commit ends with the literal trailer "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>", checked one commit at a time before the push.

### Part A deferred minors

The task reviews and the final review triaged these as acceptable follow-ups:
- **Layout and threshold:**
  - `path-tree.ts` reads its JSON via `process.cwd()`.
  - The threshold sweep's `clipped` check cannot see overflow inside scroll or overflow-hidden descendants, and it has no `!navInline` check at T−1 for candidates above the constant.
  - The 760 margin is 2 px (content box).
- **Root-unavailable:**
  - It outranks no-search-matches in the view-surface priority, so COPY-28 persists while a query has no matches.
  - The banner persists after the folder returns, until the next scan start (this conforms to the spec).
  - Scenario 42's no-modal assertion cannot fail on its path; the host tests carry that case.
- **Reconstruct cap:** "migration does not count" is proven only in the model, not by native event order.
- **Name:** a later `setState` without a name blanks the toolbar name until the refresh resolves.
- **Arcs:**
  - The clearance is guaranteed only at the corridor's midpoint (t = 0.5); this is moot visually since E20.
  - The arrowhead cones are 1–2 px at fit zoom (recorded in LIM).
- **Stale "820" in test comments:** in `container-box`, `responsive-floor`, `stage-height`, `use-city-floor`, `welcome-state` and `window-migration` (src is clean).
- **Narrow widths:** the topbar breadcrumb clips at narrow drawer-mode widths (360, 480 and 700 px looked at; recorded in LIM). This is a follow-up outside Part A's rows.

**Owner action:** this machine's system Node is 24.15.0, so native runs refuse until it is upgraded to Node ≥ 24.16.0 (the current 24 LTS is 24.21.0).
