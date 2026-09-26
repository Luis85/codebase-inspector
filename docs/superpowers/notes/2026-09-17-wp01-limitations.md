# WP-01 limitations

What this increment does not do, does not know, and has not checked. Written at the
release gate (task 13) so that the record ships with the software rather than after it.

Everything below is either carried forward from spec §11, recorded by tasks S–12, or
ruled on during this cycle. Where an item was answered, the answer is here; where it was
**not**, it says **NOT ANSWERED** in those words rather than being quietly left out.

Companion documents, both cited throughout: `2026-09-17-wp01-gate-evidence.md` (the
G2/G3/G4/G5/G8 record) and `2026-09-17-wp01-accessibility-matrix.md` (the fourteen-row
matrix). This document adds nothing to them; it says what they do not cover.

---

## Measured, and what it means

**Reference hardware and runtime** (from the G5 block in the gate-evidence document,
cited rather than re-derived):

| | |
|---|---|
| CPU | Intel(R) Core(TM) Ultra 9 185H |
| GPU | NVIDIA RTX 1000 Ada Generation Laptop GPU (Intel Arc Pro Graphics also present) |
| OS | Microsoft Windows 11 Pro 10.0.26200 |
| Runtime actually measured | Node v24.15.0 + jsdom under vitest, `WebGLRenderer` **doubled** |
| Obsidian | **not exercised by these numbers** |
| Electron / Chrome | **deliberately empty — nobody measured it** |

| Stage | 1,000 files | 5,000 files |
|---|---|---|
| Scan (sequential walk) | 2,914 ms | 13,399 ms |
| Normalization (`validateSnapshot`) | 27.7 ms | 39.4 ms |
| Layout (`computeLayout`) | 22.7 ms | 32.6 ms |
| First paint after snapshot available | 48.8 ms | 153.8 ms |
| Interaction p95 (command → draw call) | 1.58 ms | 0.75 ms |
| Cleanup (`dispose()`) | 0.82 ms | 0.49 ms |

**These are initial targets, not claims, and they are NOT GPU figures.** jsdom resolves
no WebGL2 context, so `WebGLRenderer` is doubled: "first paint" is the time from
`setLayout` to the **first draw call issued**, not a frame on a display, and
"interaction" is command-to-draw latency, not frame time. The interaction and cleanup
rows go *down* as the data goes *up*; both sit below this harness's measurement
resolution and neither supports any verdict.

**The Electron/Chrome row is empty on purpose.** The figure that would matter comes from
the user's own host — Obsidian **1.13.7**, Electron **39.6.0**, Chrome
**142.0.7444.265** — and no measurement was taken there. It must not be filled in from
the **1.12.4** install on the development machine.

Adjacent figures worth having, same source: the development vault takes roughly 62–77 s
for 39,805 files; validate + layout is about **280 ms** of synchronous
renderer-thread work at 40,000 files; and `computeLayout` on a real 1,087-file tree is
**9 ms**.

**Three Obsidian versions are in play and a claim must say which one it rests on:**
**1.12.4** installed on the development machine, **1.13.1** the types package this
repository compiles against, **1.13.7** the user's host. `minAppVersion` is declared as
**1.13.0** and has been tested on *none* of them — see the implementation report's G1
section, where that gap is stated rather than closed.

---

## Known limitations

- **Snapshots are IN-MEMORY ONLY.** Durable history is WP-05. Reopening a view shows the
  retained in-memory state marked with its age ("Snapshot retained from …") and never
  silently authorises a new scan. An Obsidian restart ends that retention; nothing is
  written to disk.
- **No analyzer, no findings, no coverage, no dependency relations, no runtime
  evidence.** One provider ships, `builtin-inventory`, and the validator rejects any
  snapshot claiming another. *Superseded for findings: WP-02 Part 6 imports fallow
  evidence and Part 7 runs an installed fallow (`tests/unit/evidence-index.test.ts`,
  `tests/integration/fallow-analysis.test.ts`); coverage, dependency relations and runtime
  evidence are still not collected.*
- **No note writing, no snapshot comparison.** *Superseded for comparison: WP-02 Part 3
  compares snapshots (`tests/component/evolution-screen.test.ts`); no note writing still
  holds.*
- **No source-opening or open-in-editor action.** External process execution is an
  unresolved policy question and the boundary is frozen: the plugin never installs,
  downloads or updates any executable. *Superseded: WP-02 Part 7 decided and delivered
  the process policy (Z1–Z44; `tests/unit/no-process-execution.test.ts`, the G6 section of
  the gate evidence). No source-opening or open-in-editor action still holds.*
- **No lens parameter on the city viewport.** *Superseded: WP-02 Part 6 adds the findings
  lens (Y40; `tests/component/findings-lens.test.ts`).*
- **Symbolic links and junctions are never followed**; they are reported as skipped,
  with a reason. The **directory-junction** case is verified against a real junction
  pointing out of an approved root. The plain **file-symlink** case is *not* verified on
  this machine: Windows Developer Mode is off, so creating a file symlink fails `EPERM`
  before the assertion is reached. That is the suite's one skipped test and it is an
  environment gate, not a gap in the code.
- **The height cap is derived per snapshot**, so a file's rendered height depends on
  unrelated files and can change between refreshes. The raw values are always in the
  inspector.
- **The 820 CSS px collapse threshold is provisional.** Checkpoint #3 did not itemise it.
  What checkpoint #3 *did* produce at this layout: three defects the user reported and
  saw fixed — indefinite stage height, file-list row wrapping and wheel zoom — closed
  with "this looks better now. proceed" and a screenshot. Whether 820 px is the right
  number in a sidebar and in a pop-out is **NOT ANSWERED**.
- **The snapshot size ceiling is a hard failure, not a degradation.** The validator
  rejects a snapshot above 200,000 entities + observations, which is roughly 65,000
  in-scope files. The development vault sits at about 61% of that. A larger root fails
  the **whole scan** rather than degrading.
- **There is no include list.** The scope model is a root plus exclusions — a denylist —
  so "scan only `src` and `test`" is not expressible.
- **The FNV-1a hash under-invalidates.** Ruling M58 left the 32-bit hash at both call
  sites. Two different inputs can collide, and a colliding change is not seen as a
  change. Recorded as a property, not fixed.
- **An exclusion containing `*` or `?` persisted before ruling M62** is accepted on read
  and **matches nothing** until the user next passes it through an input surface, which
  now refuses it with a visible reason. There is no glob support anywhere in the walk.
- **`CityViewport`'s self-reconstruction has no attempt cap.** A context that is lost
  repeatedly is reconstructed repeatedly.
- **`root-unavailable` is a spec §7 state with no producer.** It exists in the state
  vocabulary and nothing emits it.
- **An edge drag takes no `setPointerCapture`** (ruling M95), so an unclamped canvas
  point can raycast outside the frustum and pick an off-screen building.
- **Three more surfaces with no production caller, recorded rather than removed.**
  `ScanCoordinator.getLifecycle()` is named below; the final whole-branch review added
  two, and **both are dead in `src/` while tests do use them** — which is exactly why
  neither is visible to `npm run analyze` (see that gate below). `parseEntityId`
  (`src/domain/entity-id.ts`) is called only by tests. `CityRendererPort.getCamera()`
  (`src/visualization/renderer-port.ts`) has **no production caller**: `city-renderer.ts`
  IMPLEMENTS the member, delegating to the rig's own internal `getCamera`, and nothing in
  `src/` calls it through the port; `tests/component/canvas-camera.test.ts` and
  `camera-restore.test.ts` do. `getCamera` is a **frozen §4.2 member and must not be
  removed**; unlike `getDiagnostics` and `debugLoseContext` it was never disclosed as
  instrumentation, and it is disclosed here now.
- **No COPY literal is pinned to the design catalogue by any test.** The microcopy in
  `src/ui/copy.ts` is transcribed character-for-character from
  `docs/concept/design/interactions/04-microcopy.md`, and nothing compares the two: a test
  that asserts a component renders `COPY_14` passes whatever `COPY_14` says. The
  duplication that used to sit beside this — COPY-28 retyped in
  `src/host/setting-definitions.ts` rather than imported — is fixed (the constant is now
  the catalogue entry, so the settings row and `src/ui/copy.ts` cannot drift), but the
  broader property stands for every id. *Superseded: `tests/contracts/microcopy.test.ts`
  compares the catalogue with `src/ui/copy.ts`.*
- **Layering is only partly enforced by lint, and deliberately so.** Spec §3.4's Rule 2
  names `src/domain/**` and `src/visualization/**`, and `eslint.config.mjs` implements
  exactly that. `application`, `adapters`, `host` and `ui` carry no backwards-import ban;
  the wider layering holds at HEAD by inspection and nothing keeps it. Not added in the
  final fix wave because inventing a layering the spec never stated, during a release
  gate, is how a rule gets the direction wrong — it is a decision for the user.
- **`ScanCoordinator.getLifecycle()` is dead code** — zero callers in `src/` or
  `tests/`. Assessed as an inert accessor rather than a fake feature, reported rather
  than removed, and it still ships in the bundle.
- **The shipped bundle contains an unreachable FileSaver island.** Pinia's own
  `dist/pinia.js` is the single entry its `exports` map offers (there is no production
  variant to select), and although the devtools code that uses it is eliminated by the
  production `NODE_ENV` define, a small download helper survives tree-shaking and
  carries two `XMLHttpRequest` constructions. It is a closed island: its only caller is
  itself, verified by counting every reference to each of its symbols in
  `dist/main.js`. **Two guards stand behind the README's no-network statement, not one,
  and they cover different things.** `tests/host/clean-vault-install.test.ts` sweeps
  `src/`, which reaches no network API at all; `tests/host/build-output.test.ts` sweeps
  **the shipped artefact** — the bundle's network-API census is pinned to exactly these
  two `XMLHttpRequest` constructions and zero of `fetch(`, `WebSocket`, `EventSource`,
  `sendBeacon` and `requestUrl`, and pinia's devtools entry points
  (`setupDevtoolsPlugin`, `__VUE_DEVTOOLS_GLOBAL_HOOK__`, `devtools`) must be absent,
  because that devtools path is the only thing that reaches the island. The source sweep
  alone was not enough: flipping the production `NODE_ENV` define brings the devtools
  code back with a live `fetch` in it and leaves the source sweep green, which is how the
  bundle census was verified. **What is pinned is the census and that one route, not
  reachability in general** — a vendor bump that made the island live without adding an
  XHR or a devtools hook would still pass. A reviewer grepping the bundle will find the
  string, so it is written down here rather than discovered there.
- **The Three.js "multiple instances" warning appears on every re-enable, and its claim
  is false.** Three sets a marker on `globalThis` the first time its module initialises;
  Obsidian tears down a disabled plugin's module scope without clearing that marker, so
  the next enable sees a marker it set itself. One instance re-initialising. It is
  disclosed rather than suppressed, deliberately: suppressing it would also hide a real
  double-bundling defect if one ever occurred.
- **Nothing in the last several rounds was seen in a browser.** The stage-height fix,
  the file-list row rendering and the selected-row highlight all rest on a cascade read
  out of the shipped `obsidian.asar`. The user's retest was positive but was not
  itemised row by row.

---

## Accessibility — the half nobody has checked

**G4's accessibility half and G7 are OPEN.** **13** of the matrix's **14** rows are
**NOT PERFORMED**, in whole or in part; exactly **1** row is fully PASSED and **4** more
have a PASSED jsdom half with an unperformed manual half. No screen reader, no
keyboard-only run of the demo, no 200% zoom, no dark/light/third-party theme, no
host-shortcut non-capture check. The rows are enumerated in the GATE STATUS block of
`2026-09-17-wp01-gate-evidence.md`; they are answered at checkpoint #4 and until then
**this document, the implementation report and the matrix may not be cited as evidence
that accessibility is gated.**

Two of those rows carry a known hazard rather than merely an absence:

- **The third-party theme row matters most.** Ruling M113 shipped a specificity scheme —
  our rules sit inside `:where(.codebase-inspector-root)`, which contributes zero
  specificity, so five controls were raised to `button.ci-…` at (0,1,1) to beat
  Obsidian's own element rules. It has **never met a theme that fights it.** Schedule it
  first.
- **`.ci-search__input` is deliberately left host-styled** (ruling M116). Obsidian skins
  a form field across five states, so raising only the base rule would make the field
  change palette under the pointer. A tripwire test blocks the naive fix. A full re-skin
  is a design decision for the user, not a defect to fix quietly.

And one contrast question that is a judgement rather than a measurement: the two shipped
claims ("Read-only source access", "Source remains unchanged.") render inside
`.ci-snapshot-status`, whose `color: var(--ci-text-muted)` is the lowest-contrast token
on that surface. No CSS was added for them, to stay out of M113's specificity fight.
Whether a factual safety claim belongs in the muted token is for a human looking at it.

---

## Decisions that are the user's, not ours

- **Ruling M108 — the scan is sequential by choice.** Bounded concurrency measured about
  **4×** faster (1,342 → 335 ms on the same fixture) but opens up to *N−1* files *after*
  a cancel, and those reads enter the read log, which is the G2 evidence surface. Four
  gate tests pin the current behaviour. If the speed is taken, "no excluded path is ever
  opened" survives but "a cancelled run opens nothing further" does not. **This is a
  trade for the user to make**, not a defect.
- **Whether the city feels too small** at a wide (~1,876 px) leaf: the panel caps moved
  the stage from 1,280 px to 1,140 px there.
- **The new hover contrast on three controls — decided in WP-02 Part 5 (option B).**
  The skinned hovers no longer paint `--ci-raised`; they paint the plugin-owned
  `--ci-hover`, and text-on-colour buttons use darkened fills. See
  `2026-09-21-wp01b-open-decisions.md` §4.
- **The checkpoint-#3 sections the user never itemised** — multiple leaves, independent
  selection, command reveal, disable/re-enable, theme switching and pop-out migration.
  Automated coverage exists for each and is named in the gate-evidence document; a human
  confirmation does not.

---

## Tooling and gates that are deliberately not green

- **`npm run analyze` exits non-zero and is expected to.** The accepted baseline is
  **9** findings (re-baselined in the WP-02 polish pass, X1) — four exported names their
  tests cite, the `node-access` seam, an unused type named by frozen §4.1,
  `ScanCoordinator.getLifecycle` (no caller; kept as public coordinator surface), a
  duplicate `EntityId` spanning two frozen contracts, and a pre-existing
  `city-view ↔ leaf-registry` cycle. It is a **review list, not a gate**,
  which is why it sits outside `npm run verify`, and **nobody tuned it to green** — that
  is deliberate, and the baseline is what makes a tenth finding visible. It also
  fetches its tool at run time (`npx --yes fallow@3.27.0`), so it needs network and
  resolves outside the lockfile's integrity guarantees.
  **And it does not answer this branch's question 1**, which the gate-evidence document
  used to say it did. Scoping the scan to `src/` does not stop fallow resolving CONSUMERS
  in `tests/`, so an export that only tests use is not reported — `parseEntityId` and
  `COPY_10` are the worked examples. What it reports is exported symbols with no consumer
  anywhere it can resolve one. *Does anything in `src/` — not `tests/` — call this?* is
  answered by review, not by tooling, and nothing standing implements it.
- **Ruling M118 — the `mayPublish` supersession guard is unreachable by construction**
  and stays. The argument rests on exactly two legs: `SCAN_STARTED` no-ops while a run is
  running or cancelling, and there is no yield point between the second cancellation
  check and the guard. Leg one is pinned behaviourally; leg two is pinned by a
  source-as-contract tripwire. **The tripwire is not coverage** — it tests that the
  reason we say publication cannot need refusing is still true, and nothing in the suite
  distinguishes a coordinator that consults the guard from one that ignores it.
- **The gate-evidence "Numbers in this document" block is reviewed, not machine-checked,
  for completeness.** Its lettered residual list — a restatement in neither guarded
  shape, a restatement pairing a count with the wrong total, and a count written with
  underscore emphasis — is prose. **If the sweep regexes in
  `tests/unit/evidence-numbers.test.ts` ever change, that list must be re-examined**,
  because nothing will tell you it has gone stale.
- **Two `eslint-disable` lines and one `@ts-expect-error`** exist in the whole tree, each
  with a written reason. No lint rule is weakened anywhere.

---

## Open questions carried forward from spec §11

- **Whether a loaded view reverts to `DeferredView` when hidden.** **NOT ANSWERED.** It
  was owed to the spike report, carried to checkpoint #3 and not itemised there. If it
  does revert, `onClose` runs on tab switch and part of task 11's pause work is moot; if
  it does not, a long session accumulates one live WebGL context per city tab ever
  shown. Only a real host answers it. Carried to checkpoint #4.
- **Whether the WebGL context survives pop-out migration.** **NOT ANSWERED** by a human;
  pop-out migration was not itemised at checkpoint #3. It is a **performance** question
  only, because the view disposes and reconstructs rather than migrating a context —
  which is exercised against a genuinely separate jsdom realm, but never in a real
  pop-out.
- **Ordering of `setState` relative to `onOpen` on workspace restore.** Established at
  task 3 as a question the implementation does not need to answer: `setState()` does one
  thing — validate and store — and the welcome shell renders the same either way, so
  **whichever order the host uses, the result is identical**. Task 3 could not observe
  the real order in a host and did not claim to. The official statement still does not
  exist.
- **r187 will make `WebGLRenderer` use `WeakRef` and `FinalizationRegistry`
  internally**, which could interact with strict-disposal-on-close. Re-test at upgrade
  time.
- **The Three.js migration wiki OMITS r186's CommonJS deprecation entirely** — it is
  documented only in the GitHub release notes and visible in the published tarball.
  Treat that wiki page as incomplete for r186 when upgrading.
- **Visual regression against the design mockups.** r181 changed PBR energy conservation
  and indirect specular, so any reference screenshot taken against an older Three.js
  needs retaking. Magnitude unmeasured.
- **The design package's Three.js and Obsidian citations** (`[T1]`–`[T4]`, `[O1]`–`[O2]`)
  use non-canonical URL forms, which suggests they were constructed rather than fetched.
  Still to be re-fetched, `[T4]` in particular.
- **Whether the community directory's build verification accepts a `dist/` output.**
  Irrelevant until submission is a goal, and submission is not a goal here.
- **Whether external process execution is permitted by policy.** No official text either
  way. WP-02's concern; the boundary is frozen for WP-01. *Closed by WP-02 Part 7
  (Z1–Z44), which the owner approved.*

Items spec §11 listed as open that this increment **closed**, so the list does not carry
them twice: whether `getSettingDefinitions()` can express a dynamic per-profile list
(yes — the whole settings surface is declarative; see
`2026-09-17-setting-definitions-verification.md`), whether Three.js 0.186.0 behaves
inside Obsidian (yes, at the spike and since), and whether a renderer reconstructed from
a `CameraBookmark` and a `LayoutResult` lands where it left off (task 10's bookmark
round-trip).

---

## WP-02 Part 7 — running an installed fallow

- **No process-tree kill on Windows.** `child.kill()` ends the direct `fallow.exe` only.
  A process it started itself could outlive a cancel, a timeout or a shutdown. No
  `taskkill` is spawned, to keep the process surface to one executable.
- **Not a sandbox.** An authorised fallow runs with the user's permissions and can read
  and change anything the account can. Trust is an application safeguard, and its FNV
  fingerprint detects incidental change, not deliberate forgery.
- **Config files in the root are honoured.** A `.fallowrc.json` or other fallow
  configuration in the analysed folder changes what fallow reports. It is not recorded
  in the provenance. Remote `extends` is never fetched.
- **The git history may be read.** Health analysis may read the repository's git data
  (read-only).
- **Scan exclusions do not apply to fallow.** fallow reads the whole folder. Findings in
  excluded files come back as unmatched paths and never paint the city.
- **Untested versions.** Only 3.21.0 (fixtures) and 3.27.0 (fixtures and `test:fallow`)
  are tested. Other 3.x versions run labelled untested, and the side-effect claim
  ("writes nothing") is verified for 3.27.0 only.
- **A force-quit mid-run.** If Obsidian is killed without `onunload`, a running fallow is
  not stopped by the plugin and runs until it finishes on its own.
- **The final parse is synchronous.** `JSON.parse` of a report of up to 16 MB runs on the
  UI thread, as a Part 6 import does. It is measured, not bounded.
- **Machine identity is inferred.** The "another device" rule relies on
  `loadLocalStorage` not being synced (the existing `getOrCreateMachineId` risk).
- **Two devices displace each other's binding.** The record is stamped with one device's
  id (K2). Choosing the executable on a second device replaces the first device's record,
  so each switch between devices asks for the executable and its review again: once per
  switch, not once per device.
- **Windows child environment.** On Windows the child's environment is the allow-list
  plus the variables libuv always adds; on POSIX it is exactly the allow-list. libuv adds
  its own required variables to every child's environment on Windows (`HOMEDRIVE`,
  `HOMEPATH`, `LOGONSERVER`, `SYSTEMDRIVE`, `SYSTEMROOT`, `TEMP`, `USERDOMAIN`,
  `USERNAME`, `USERPROFILE`, `WINDIR`), whatever env the spawn call passes. The runner
  passes exactly the allow-list; `tests/unit/fallow-runner.test.ts` pins that. The
  contract test (`tests/contracts/fallow-runner.test.ts`) allows exactly libuv's set, on
  top of the allow-list, on Windows, and nothing extra on POSIX.
- **POSIX paths not run here.** The POSIX process-group kill
  (`tests/contracts/fallow-runner.test.ts`) and the `realKill(-pid)` fixture path
  (PF4) are unit- and contract-pinned, but this task ran on Windows: neither was
  exercised on a POSIX machine during this execution.

Some of these are also stated where the user meets them, and only these (corrected in the
final review; the earlier sentence claimed all of them). The review's side-effect list
(Z31) says that it is not a sandbox, that fallow configuration files in the folder are
followed (and remote configuration never fetched), that the git history may be read, that
paths the scan excludes are read too, and that the "writes nothing" claim was checked with
fallow 3.27.0; a trusted version outside the tested ones is labelled "(untested version)"
in the review's Version row and the card's Trust row; and on Windows the review's
Environment row says the variables Windows always provides are passed on as well. The storage
disclosure (Z12) says the executable setting is marked with this device and that another
device asks again, which is the rule the machine-identity item qualifies. The Windows
process-tree limit, a force-quit mid-run, the synchronous parse, the inferred machine
identity itself, the two-device displacement and the POSIX paths not run here are stated
only in this document.

---

## WP-03 Part 1 — dependency evidence from fallow

Transcribed from `docs/superpowers/specs/2026-09-24-wp03-part1-dependencies-design.md`
§6, spec's own limitations for the relation evidence WP-03 Part 1 adds. Recorded by
task 15 (N39).

- **A partial graph.** Only imports that fallow reports in import cycles or boundary
  violations are edges. Neighbourhoods, the Map, the Matrix, the Edges tab and the arcs
  show that subset. A file with no evidenced import may still import or be imported by
  many files; File detail's **Imported by** (fallow's fan-in) is the complete count where
  fallow scored the file.
- **No type-only distinction.** fallow reports no per-edge type-only flag in its
  documented JSON. Type-only cycles are not reported by fallow at all (observed on
  3.27.0). The relations fixture's own type-only import (`src/ui/view.ts`, allowed under
  its `.fallowrc.json`) is simply invisible to the normaliser rather than excluded by it —
  see the WP-03 Part 1 gate-evidence section's acceptance table.
- **Re-export cycles have no direction.** They are listed and reviewable, but not drawn.
- **Your module rules can only be violated, never passed.** Without the full graph, a rule
  with no evidenced crossing is "Not evaluated".
- **Boundaries depend on the analysed folder's fallow config.** Without one, boundary
  violations are "not configured", and this is not counted as missing evidence.
- **An older fallow cannot say it checked boundaries and found none (JF2's accepted
  cost).** fallow 3.21.0 (schema 11) writes no `workspace_diagnostics`, so an empty
  `boundary_violations` list cannot tell "configured, none violated" from "never checked".
  A 3.21.0 report with no boundary violation and no diagnostic therefore reads boundaries
  "not analysed", and the totals that include them read partial, never a measured 0 —
  even when that project did configure boundaries. A 3.27.0 report (schema 12) reads
  "configured, 0" or "not configured" as fallow says.
- **Arcs are depth-tested.** A tall building can hide part of an arc; the Relations list
  is the complete record.
- **3.21.0 and 3.27.0 only.** The relation fields were recorded on these two versions.

Also out of scope for Part 1, per spec §7: the whole import graph from any source (a
native import extractor, per-selection `fallow trace` runs, `viz` DOT or Mermaid parsing,
or fallow's HTML); co-change and observed-call relations, and the Evolution screen's
change coupling (stays sample); the external-packages Dependencies screen (stays sample);
writing or editing fallow config (`.fallowrc.json`) from the plugin; persisting the
relation controls across a reload (owner choice: session only); showing all arcs at once;
`boundary_coverage_violations` and `boundary_call_violations` (stay "not shown"); and the
open owner decisions — M80/F14 renderer retry cap, M95 pointer capture, the spec §7
root-unavailable producer, Y19 external `data.json` edits, and the Z38 no-freeze budget.
The manual Part 7 acceptance check (item 3, "a configured trusted binary runs without
freezing Obsidian") stays the owner's, unchanged from G6 above.

---

## WP-04 Part 1 — investigation workbench and notes

Transcribed from
`docs/superpowers/specs/2026-09-25-wp04-part1-investigation-design.md` §8, plus three
further limitations this task recorded while producing the evidence above (IP29, the §6
probe results and spec §3). Recorded by task 18.

- **Stale detection is by size, line count and modification time, not content.** A file
  edited so that none of the three observations change is read as current even when its
  text differs from what was analysed. For an imported report the analysis time is only
  bounded by the import time.
- **A refresh re-serialises the frontmatter.** `processFrontMatter` rewrites the whole YAML
  block: the user's own comments and quoting style there are not kept, but every value is
  (IP8) — `status`, `created` and any key the user added round-trip value-identical, never
  byte-identical.
- **The note index is per codebase and built from the metadata cache.** A note written by
  another tool without the plugin's frontmatter keys (`type: codebase-investigation` and
  the rest) is not linked, and never appears under a codebase's notes.
- **A notes folder equal to the codebase root is scanned.** It cannot be excluded without
  excluding everything, so notes in that folder are read back into the next scan (IP26).
- **Clone groups, symbol tracing and an external editor are not in this part** (O1, O5).
- **The note serialiser in tests is `yaml` 2.9.1, not Obsidian's own** (IP29). No test
  asserts YAML bytes, only parsed values; a quoting difference between the two libraries is
  found by the native probe, not by the fast suite. Fact (d) above records what Obsidian's
  own `stringifyYaml` actually does: `yes` unquoted (read back as the string `"yes"`),
  `null`/`0012`/`a: b`/`true`/`~`/`#x`/`[[x]]` double-quoted, every value a string.
- **Escaping relies on Obsidian honouring CommonMark backslash escapes for its own syntax.**
  `noteText()`'s escaping is not proved by construction; it is proved by the native probe
  (b) against the real renderer and the real live-preview editor, and it is kept as a
  regression test (`tests/e2e/obsidian-facts.e2e.ts`) precisely because a future Obsidian
  release could change that behaviour. The probe's own positive control (IPF15) is what
  makes a silent pass impossible: it failed once, for a real reason (an undotted host is
  never auto-linked at all), before the literals were corrected.
- **The plugin is desktop-only** (`manifest.json` `isDesktopOnly: true`). The preview's
  `no-filesystem` defensive state (a missing `FileSystemAdapter`) is therefore reachable
  only in tests — never on a real device this plugin runs on (spec §3).
- **Native acceptance runs locally only** (O8). The repository has no CI, so
  `npm run test:e2e` is run by hand, and its evidence is what a run on this machine
  recorded — Windows 11, Obsidian 1.13.4 (baseline) and 1.13.7 (`latest`, resolved on this
  run), one app version per run, one real display session. It does not certify
  accessibility, other operating systems, or any Obsidian version other than the two
  actually run.
- **Two open items the native spine found, neither of them WP-04 code:**
  - **The Settings tab does not refresh after `scan-codebase` creates a profile
    (pre-existing).** `SettingsTab.refresh()` runs only from `onload` and after the tab's
    own mutations, so a profile `scan-codebase` creates in the same session is not listed
    until the plugin reloads and cannot be Connected, renamed or given a notes folder in
    that session. WP-04 Part 1's own preview no longer depends on this (ruling E25 reads an
    unbound profile's preview under its in-memory snapshot root), but the Settings-tab gap
    itself remains.
  - **The test vault's watcher did not index files copied in with `node:fs`
    (test-environment).** In the native session's copied vault, files written by the test
    harness with `node:fs` (rather than through `app.vault.adapter`) were not indexed by
    Obsidian's own file watcher within 9–12 seconds; the copied vault's path being an 8.3
    short path is a plausible but unproven cause. Nothing in the plugin depends on this (the
    scan and preview read through the Node port, not the vault index), but a future native
    test that expects Obsidian to notice an externally-made edit needs to account for it.

---

## Numbers in this document

Read this before quoting a figure from here.

**DERIVED — a stale value reddens a test.** The accessibility row counts above (the
total, the open count, the fully-PASSED count and the half-passed count) are swept by
`tests/unit/evidence-numbers.test.ts`, which reads this file exactly as it reads
`2026-09-17-wp01-gate-evidence.md` and `2026-09-17-wp01-accessibility-matrix.md`:
positively at every site that states one, and negatively against every value they are
not. The same boundary applies here as there — the sweep reads four shapes: "N of the
14"; the open count immediately beside an openness word; a count before "fully PASSED";
and a count before "a PASSED jsdom half" — and **asterisk emphasis only**. The last two
were added in the final fix wave: before it, this paragraph called the fully-PASSED and
half-passed counts derived while nothing read them in this file, and rewriting the
sentence above to claim six fully-passed rows left the suite green. The lettered list of
what still escapes the sweep lives in the gate-evidence document's own Numbers block and
applies to this file identically, to all four counts.

**TRANSCRIBED — reproduce with the command named beside them in the gate-evidence
document; no test can check these.** Every benchmark figure, the adjacent scan timings,
the snapshot ceiling, the concurrency comparison and the `npm run analyze` total of 9.
They are cited from `2026-09-17-wp01-gate-evidence.md` and from task 12's benchmark run,
which writes its results outside this repository by design.

**NEITHER — prose.** Version numbers, spec section numbers, ruling numbers, dates, CSS
pixel thresholds and the specificity pairs `(0,1,1)`/`(0,2,0)` are identifiers and
design values, not measurements. They are not swept.
