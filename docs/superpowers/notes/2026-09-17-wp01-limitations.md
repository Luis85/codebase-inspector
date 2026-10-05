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
- **The 820 CSS px collapse threshold was provisional.** Checkpoint #3 did not itemise it.
  What checkpoint #3 *did* produce at this layout: three defects the user reported and
  saw fixed — indefinite stage height, file-list row wrapping and wheel zoom — closed
  with "this looks better now. proceed" and a screenshot. Whether 820 px was the right
  number in a sidebar and in a pop-out was **NOT ANSWERED**. *Resolved: gap closure
  (GRA6).* The threshold is **760**, measured by `harness-measure`'s drawer sweep as the
  smallest candidate at which the three-column city (the city at content = T, the leaf at
  T + 220 with the navigation inline) and the navigation band clip nothing and the stage
  keeps at least 320 px, set in all four places that carry it and pinned by
  `tests/unit/drawer-threshold.test.ts`. The stage margin at 760 is small, and it is
  decided on the stage's content box (`clientWidth`, which is what `CityViewport`'s 320
  floor reads): in the harness the border box measures 324 px and the content box 322 px,
  so the margin is 2 px.
- **The snapshot size ceiling is a hard failure, not a degradation.** The validator
  rejects a snapshot above 200,000 entities + observations, which is roughly 65,000
  in-scope files. The development vault sits at about 61% of that. A larger root fails
  the **whole scan** rather than degrading.
- **There is no include list.** The scope model is a root plus exclusions — a denylist —
  so "scan only `src` and `test`" is not expressible.
- **The FNV-1a hash under-invalidates.** Ruling M58 left the 32-bit hash at both call
  sites. Two different inputs can collide, and a colliding change is not seen as a
  change. Recorded as a property, not fixed. *Resolved for the in-memory fingerprints: gap
  closure GRB11 (GCQ3, 2026-10-05).* `fingerprintSource`, `fingerprintScope`,
  `fileSetDigest` and the root fingerprint are 64-bit FNV-1a; the persisted trust value stays
  32-bit, so every stored trust grant stays valid.
- **An exclusion containing `*` or `?` persisted before ruling M62** is accepted on read
  and **matches nothing** until the user next passes it through an input surface, which
  now refuses it with a visible reason. There is no glob support anywhere in the walk.
  *Resolved: gap closure GRB12 (GCQ4, 2026-10-05).* Each such exclusion adds a snapshot
  warning ("The exclusion "{x}" contains * or ? and matches nothing. Edit it in Settings."),
  shown on Data & scans; it does not mark the snapshot partial. *Accepted (gap closure E50,
  final review M6, 2026-10-05):* the snapshot warnings list on Data & scans
  (`ScopePanel.vue`) is uncapped: it shows one item per unique skip reason, plus each
  wildcard warning, however many there are. A cap would need new copy (a "and N more" line
  and its wording), so it is left as it is.
- **`CityViewport`'s self-reconstruction had no attempt cap.** A context that was lost
  repeatedly was reconstructed repeatedly. *Resolved: gap closure (GRA2).*
  `src/visualization/reconstruct-cap.ts` wraps the renderer factory the host provides: after
  3 automatic reconstructions, the next context loss makes the next create answer
  `unavailable{initialization-failed}` with the inert port, and a **Retry 3D** button
  remounts the viewport and resets the counter. See the shared-notice limitation below.
- **`root-unavailable` was a spec §7 state with no producer.** *Resolved: gap closure
  (GRA4).* A refresh that finds the root gone or no longer a directory now emits it: the
  status banner reads COPY-28, the snapshot stays readable, and a refresh never asks to
  approve a missing folder (the host tests, `tests/host/scan-flow-root-unavailable.test.ts`;
  native scenario 42 pins the banner). An existing root whose listing fails
  (for example `EACCES`) stays a generic scan failure; "unreadable" as its own state is
  Part B's GRB17. *Resolved: gap closure GRB17b (GCQ9, 2026-10-05).* A root whose stat is
  unreadable, or whose listing throws, is reported as unavailable too (COPY-28) and its
  message names the code; `StatResult.unreadable` carries it, the preview reports
  `read-error` rather than missing, and the source modal says "The folder cannot be read
  ({code})." (`tests/unit/stat-unreadable.test.ts`,
  `tests/host/source-modal-unreadable.test.ts`). Not natively exercised: an `EACCES`
  folder cannot be made on this Windows machine without changing its ACLs.
- **An edge drag took no `setPointerCapture`** (ruling M95), so an unclamped canvas
  point could raycast outside the frustum and pick an off-screen building. *Resolved:
  gap closure (GRA3).* The pointer is captured on press and a pick outside the canvas is
  refused (`tests/component/picking-capture.test.ts`).
- **A capped context and a context that never initialised show the same notice (gap
  closure GRA2, spec §9).** The cap reuses `initialization-failed` (GCN2, so no §4.2
  interface change), so both show COPY-14. Only the **Retry 3D** button, which appears
  with the notice, tells the user that the context was lost rather than refused at start.
- **Packing is NFDH, and the F2 calibration did not reproduce (gap closure GRA1, GCO2).**
  The spike could not reproduce the 64.2 % measured on 84d92d7's tree: the closest
  definition gave 65.41 %, none within ±0.1, so the baseline was re-taken on the plan-base
  tree (1,236 paths, frozen as `tests/fixtures/real-tree.json`) under GCP3. There the
  shelf packing's root occupancy is 54.66 %; next-fit decreasing height gives 71.87 %
  (+17.21 points), first-fit decreasing height +13.80 and a skyline packer +11.99. All three
  cleared the +10 threshold, so the simplest, NFDH, was adopted (`LAYOUT_VERSION` is `'2'`,
  `src/domain/layout/pack.ts`). About 28 % of the root's extent is still empty on that
  tree, and positions differ from the shelf layout, so a city read before and after the
  change does not compare.
- **The topbar clips in narrow leaves with the navigation as a drawer (found by gap
  closure Task 7, not fixed).** At 360 and 480 px the `.ci-shell__topbar` itself overflows
  (measured in the harness: its scroll width exceeds its client width up to a 540 px leaf).
  Above that the topbar box fits, but its breadcrumb still truncates: the 700 px S10 leaf, in
  drawer mode, shows "Workspace / roo" because the search field, the sample-data chip and
  the snapshot selector take the room first. So there is no single bound at about 540 px:
  the breadcrumb is clipped at every drawer-mode width looked at (360, 480 and 700 px),
  and the wide captures (1280 px and up, navigation inline) show it whole. It is independent of the collapse threshold, is not one of Part A's
  rows and is carried as a follow-up.
- **The arrowhead cones on a relation arc are 1–2 px at the fit zoom (gap closure GRA7,
  not fixed).** The selected file's arcs and cones now draw above the buildings, but the
  cones (radius 0.35, height 1.1) are not scaled with the city, so the direction of an arc
  reads poorly at the default camera. Scaling them is outside GRA7 and is a follow-up.
- **One surface with no production caller, recorded rather than removed.**
  The final whole-branch review recorded it as one of three, and **it is dead in `src/`
  while tests do use it** — which is exactly why it is not visible to `npm run analyze`
  (see that gate below). (`ScanCoordinator.getLifecycle()`, recorded beside it, was deleted
  in gap closure Part C, GRC12. `parseEntityId` (`src/domain/entity-id.ts`), the third, was
  called only by tests; *superseded: `review-state.ts`, `review-record-codec.ts` and
  `work-items.ts` in `src/ui/read-models` call it.*) `CityRendererPort.getCamera()`
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
  *Superseded: gap closure Part C (GRC1) added the layer bans to `eslint.config.mjs`
  (`no-restricted-imports` for `ui`, `application` and `adapters`), pinned by
  `tests/build/eslint-layering.test.ts`.*
- **`ScanCoordinator.getLifecycle()` was dead code** — zero callers in `src/` or
  `tests/`. Assessed as an inert accessor rather than a fake feature, and reported
  rather than removed. *Superseded: gap closure Part C (GRC12) deleted it, and it no
  longer ships in the bundle.*
- **The shipped bundle no longer contains pinia's unreachable FileSaver island.** Pinia's
  own `dist/pinia.js` is the single entry its `exports` map offers (there is no production
  variant to select), and although the devtools code that uses it is eliminated by the
  production `NODE_ENV` define, a small download helper used to survive tree-shaking and
  carry two `XMLHttpRequest` constructions. It was a closed island: its only caller was
  itself. *Resolved: gap closure (GRA10, B23).* `scripts/pinia-saveas-pure.mjs` is a
  `enforce: 'pre'` Vite plugin that rewrites exactly one statement in that one file, pinia's
  `const saveAs = ...` initialiser, to a `/*#__PURE__*/` call, which lets Rollup drop the
  unreferenced declaration and the helpers only it reaches. **It fails the build if the
  statement disappears** (the error names GRA10), so a pinia bump cannot quietly turn the
  transform into a no-op. **Two guards stand behind the README's no-network statement, not
  one, and they cover different things.** `tests/host/clean-vault-install.test.ts` sweeps
  `src/`, which reaches no network API at all; `tests/host/build-output.test.ts` sweeps
  **the shipped artefact** — the bundle's network-API census is now pinned to zero
  `XMLHttpRequest` and zero of `fetch(`, `WebSocket`, `EventSource`, `sendBeacon` and
  `requestUrl`, and pinia's devtools entry points (`setupDevtoolsPlugin`,
  `__VUE_DEVTOOLS_GLOBAL_HOOK__`, `devtools`) must stay absent, because flipping the
  production `NODE_ENV` define would bring the devtools code back with a live `fetch` in it
  and leave the source sweep green. Its non-vacuity anchor is a pinia member name that
  survives minification (`$onAction`); pinia's error messages are dev-only and are stripped.
  **What is pinned is the census, that one route and the transform's needle, not
  reachability in general.**
- **The Three.js "multiple instances" warning on re-enable is fixed.** Three sets
  `window.__THREE__` the first time its module initialises and warns when it finds the
  marker already set. Obsidian tears down a disabled plugin's module scope without clearing
  that marker, so the next enable saw a marker it had set itself: one instance
  re-initialising, and a false claim. *Resolved: gap closure (GCP6), reversing the earlier
  "disclosed rather than suppressed" stance.* `onunload` now calls `releaseThreeMarker`
  (`src/visualization/three-marker.ts`) on the main window, which deletes the marker **only
  when it equals this bundle's own Three.js `REVISION`**. A marker with the same revision is cleared, whoever wrote it; a marker
  written by a different revision is left alone, and a genuine double bundle in one
  session still warns. Verified natively by the plugin-lifecycle scenario, which reads
  the marker before and after a real disable.
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

And one contrast question that was a judgement rather than a measurement, now decided:
the two shipped claims ("Read-only source access", "Source remains unchanged.") render
inside `.ci-snapshot-status`, which is `color: var(--ci-text-muted)`. The owner ruled
(gap closure GCO16, GRC4) that a factual safety claim renders in the normal text token,
so `.ci-snapshot-status__claims` now declares `color: var(--ci-text)`. It is one class at
(0,1,0) on a `<span>`, which no Obsidian element rule colours, so M113's fight (about
`<button>`s) does not apply. `tests/unit/contrast-gate.test.ts` pins the declaration.

---

## Decisions that are the user's, not ours

- **Ruling M108 — the scan is sequential by choice.** Bounded concurrency measured about
  **4×** faster (1,342 → 335 ms on the same fixture) but opens up to *N−1* files *after*
  a cancel, and those reads enter the read log, which is the G2 evidence surface. Four
  gate tests pin the current behaviour. If the speed is taken, "no excluded path is ever
  opened" survives but "a cancelled run opens nothing further" does not. **This is a
  trade for the user to make**, not a defect. *Decided and closed: gap closure GRB2
  (GCO8, GCN5, 2026-10-05).* The user took the speed. The walker prepares a window of 8
  entries per directory; no excluded path is opened, nothing new is dispatched after a
  cancel is observed, and in-flight reads drain before the run reports cancelled. Only the
  read log's order became completion-dependent. The four gate tests were rewritten to that
  guarantee (gate evidence, G2).
- **Whether the city feels too small** at a wide (~1,876 px) leaf: the panel caps moved
  the stage from 1,280 px to 1,140 px there; after GRA5 (list 15 %, inspector 12 %) the
  stage's content box measures 1,154 px (border box 1,156.4 px) at a 1,876 px leaf with
  the inspector open.
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
  **4** findings (re-baselined in gap closure Part C, GRC12, from 9) — the `node-access`
  seam, an unused type named by frozen §4.1, a duplicate `EntityId` spanning two frozen
  contracts, and a pre-existing `city-view ↔ leaf-registry` cycle. It is a **review list, not a gate**,
  which is why it sits outside `npm run verify`, and **nobody tuned it to green** — that
  is deliberate, and the baseline is what makes a fifth finding visible. It also
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
  `taskkill` is spawned, to keep the process surface to one executable. *Superseded: gap
  closure GRB3 (E41, 2026-10-05).* The probe found fallow 3.27.0 spawning `git` (and git a
  second git), so on Windows the stop and the shutdown now run
  `%SystemRoot%\System32\taskkill.exe /PID <pid> /T /F` before the direct kill, bounded at
  1 s; the contract test proves a detached grandchild gone. A force-quit is still not
  covered (below). *Residual (gap closure E50, final review M5, 2026-10-05):* `taskkill /T`
  builds its tree from each process's recorded parent-PID field, which Windows never
  updates when the parent exits. If fallow was given a reused PID, an orphan whose recorded
  parent was the earlier holder of that PID could be killed with the tree. It is rare, and it cannot be fixed from Node, which offers no
  job-object or process-creation-time check for the tree.
- **Not a sandbox.** An authorised fallow runs with the user's permissions and can read
  and change anything the account can. Trust is an application safeguard, and its FNV
  fingerprint detects incidental change, not deliberate forgery.
- **Config files in the root are honoured.** A `.fallowrc.json` or other fallow
  configuration in the analysed folder changes what fallow reports. It is not recorded
  in the provenance. Remote `extends` is never fetched. *Partly superseded: gap closure GRB9
  (GCQ5, GCP7, 2026-10-05).* The names fallow 3.27.0 documents (`.fallowrc.json`,
  `.fallowrc.jsonc`, `fallow.toml`, `.fallow.toml`) found in the root are recorded in the
  run's provenance and shown in the fallow facts. A config fallow finds by walking up, or
  through `extends`, is not listed.
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
  switch, not once per device. *Superseded: gap closure GRB10 (GCO23, GCN10, 2026-10-05).*
  The analyzer record is v2, one entry per device: binding on a second device keeps the
  first device's entry, and a v1 record is read as one device and migrated on the next
  write. An older build reads v2 as unsupported and refuses to write it.
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
(Since closed by gap closure Part A: the renderer retry cap (GRA2), pointer capture (GRA3)
and the root-unavailable producer (GRA4). Y19 closed by gap closure Part B, GRB1,
2026-10-05: `onExternalSettingsChange` re-reads every open store read-only, with the
8.3-path host limit recorded in the Part B section below.)
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
  byte-identical. *Resolved for plain frontmatter: gap closure GRB5 (2026-10-05).* When
  `snapshot_id` and `source_path` each sit on exactly one plain top-level line, the refresh
  rewrites only those two lines inside the same write, keeping comments and quoting
  (native scenario 44). Anything else (a duplicate key, a multi-line or nested value, a
  comment on the key's line, no frontmatter) falls back to `processFrontMatter` as before.
- **The note index is per codebase and built from the metadata cache.** A note written by
  another tool without the plugin's frontmatter keys (`type: codebase-investigation` and
  the rest) is not linked, and never appears under a codebase's notes.
- **A notes folder equal to the codebase root is scanned.** It cannot be excluded without
  excluding everything, so notes in that folder are read back into the next scan (IP26).
  *Superseded: gap closure GRB7 (2026-10-05).* A notes folder that is the codebase folder
  itself is refused ("This folder is the codebase folder itself. Choose another folder for
  the note.") and nothing is written (native scenario 46).
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
- **A missed metadata event is not repaired until reload (E14's cost).** The note index
  updates incrementally from `changed`/`rename`/`delete`; if Obsidian fails to fire one of
  those for some file (or the listener is not registered yet), that note's entry is stale
  until the next whole-cache rebuild, which runs only once, on the first `resolved` after
  the plugin starts. Nothing prompts a rebuild in between. *Resolved: gap closure GRB6
  (2026-10-05).* Opening Investigate resyncs the index once per screen open (native
  scenario 45, which has to simulate the miss: Obsidian 1.13.4 did not miss the event when
  probed, ruling Gap-closure E33).
- **The preview reads under a root approved for scanning but never connected in Settings
  (E25's cost).** A profile with no binding (`scan-codebase`'s own default flow) reads the
  source preview under the snapshot's own root rather than a Settings-tab binding, so the
  preview works without ever exercising the Connect step or its per-device binding record.
  The bound-profile preview path — a Connected folder read through the binding — is not
  exercised by the native spine at all; it is covered only by
  `tests/host/investigation-ports.test.ts`.
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
    **Amended (gap closure GRD11, 2026-10-03):** the plugin no longer depends on the watcher
    indexing `node:fs` copies. Since WP-04.2 NPF15 (`ca1a8b7`) the note create uses a folder
    that exists on disk before Obsidian has indexed it, instead of refusing it as
    write-failed. The environment fact itself stays: the test vault's watcher still does not
    index files copied in with `node:fs`, so a native test that needs the vault to know such
    a file must create it through the vault API.
- **A search typed in Settings holds back a write made elsewhere (ruling Gap-closure E2).**
  Focus in the settings search box holds the settings tab's render wait, because that wait
  covers every field of the settings document (E3/E12), the search box included. A write
  made elsewhere while someone types a search therefore reaches the search index only once
  focus leaves the fields or the tab is hidden (gap closure, 2026-10-03). *Narrowed: gap
  closure E50 (Task 16 M6, 2026-10-05).* The wait now counts only the fields of the tab's own
  content (its containerEl and its `.setting-page`), never Obsidian's settings search field,
  so a write made while the search box has focus renders, and reaches the search index, at
  once; scenario 43 no longer blurs the search field and asserts it is focused. What remains:
  a render already waiting for a field of the tab still waits when focus moves from that
  field to the search box, until focus leaves the settings fields, the tab is hidden, or
  another refresh is requested while the search box has focus (that request renders at once;
  gap closure E52).
- **An older build drops a leaf state that carries `name` (gap closure GRA8, 2026-10-04).**
  `CityViewState.name?` is new (§4.1, amended by GCN3). An older build's `.strict()` schema
  rejects the unknown key, so it discards the whole persisted leaf state once; the leaf opens
  at its defaults, and the next save of that build writes a state without `name`. Only a
  downgrade past this change shows it.

---

## Gap closure Part B — accepted limits (GRB18, GCN11) and one host limit

Spec §7 of `docs/superpowers/specs/2026-10-03-gap-closure-design.md` closes these as
decided, each with its reason. They are closed, not dropped: each is a decided limitation,
not a follow-up.

- **B11(a): an unreachable root's null real-path resolution is kept for the session**
  (accepted, gap closure GRB18, 2026-10-05). It is fail-safe: with no real path, the
  notes-folder check falls back to the textual comparison.
- **B11(b): a mapped drive to an offline server blocks once per session** (accepted, gap
  closure GRB18, 2026-10-05). `plan()` must be synchronous (NE15), and Node has no
  non-blocking real-path call with a timeout.
- **B12: the Settings render waits while a field has focus, by design** (accepted, gap
  closure GRB18, 2026-10-05). FN1's hidden-tab render draws into no visible field, so the
  wait costs nothing while the tab is hidden. The search-box case is the E2 item in the
  WP-04 section above.
- **B16(b): the "removed" mark on a codebase is kept in memory only** (accepted, gap
  closure GRB18, 2026-10-05). No snapshot survives a restart, so after one there is no
  leaf left on the removed codebase for the mark to describe.
- **Already recorded above, and accepted as decided (gap closure GRB18, 2026-10-05), so not
  repeated here:** B6 (GCO24, stale detection by size, line count and modification time, in
  the WP-04 section); B14(1) a force-quit, B14(2) the synchronous parse, B14(4) scan
  exclusions not applied to fallow, B14(5) untested versions and B14(6) inferred machine
  identity (the Part 7 section); B15(1) the 200,000 ceiling, B15(2) no include list,
  B15(5) the per-snapshot height cap and B15(6) skipped file symlinks (Known limitations);
  and GCO15, the search field left host-styled (M116, the accessibility section).
- **A live external `data.json` edit is missed when the vault's path is an 8.3 short path
  (found by gap closure Task 16, 2026-10-05; not a plugin defect).** With the vault under a
  short path such as `C:\Users\LUISME~1\AppData\Local\Temp\…`, Obsidian 1.13.4 slices the
  config watcher's path wrongly (it reports `raw:g/.obsidian/plugins/…/data.json`, the
  vault prefix cut at the wrong length) and never calls `onExternalSettingsChange`, so the
  change is picked up only at the next bind or a plugin reload. The plugin cannot work
  around it: the hook is never called. Evidence:
  `reports/native/runs/20261005T144745Z-taskB16-probe` (short-path TEMP: three mangled
  `raw` events, 0 hook calls) against `reports/native/runs/20261005T144936Z-taskB16-probe-longtemp`
  (long-path TEMP: `raw:.obsidian/plugins/…/data.json`, 1 hook call). Native scenario 43
  therefore sets TEMP to the long path, in `tests/e2e/settings.e2e.ts` only (ruling
  Gap-closure E46).

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
the snapshot ceiling, the concurrency comparison and the `npm run analyze` total of 4.
They are cited from `2026-09-17-wp01-gate-evidence.md` and from task 12's benchmark run,
which writes its results outside this repository by design.

**NEITHER — prose.** Version numbers, spec section numbers, ruling numbers, dates, CSS
pixel thresholds and the specificity pairs `(0,1,1)`/`(0,2,0)` are identifiers and
design values, not measurements. They are not swept.
