# WP-01 gate evidence — G2, G3, G4, G5, G8

Recorded by task 12 at branch `feat/wp-01-codebase-city`. Every row below names the
artefact it rests on, and every row that was **not** performed says so in those words.
Nothing here is taken from either prototype: `docs/concept/prototype/`,
`docs/concept/prototype-v2/` and `docs/concept/design/wp01-review/src/` are rank 6 in
spec §0's precedence order and are never behavioural evidence. The Three.js prototype
vendors r140 against our 0.186.0 pin, ran on a software rasteriser, exercises no
Obsidian host, no filesystem, no repeated construct-and-dispose cycle, no second leaf
and no window migration, and asserts no timing at any scale. **No prototype result is
cited anywhere in this document.**

Reproduce everything automated here with `npm run verify`. The benchmark figures come
from `tests/benchmarks/city-benchmark.test.ts`, which writes
`<tmpdir>/codebase-inspector-benchmark/results.json` on every run.

---

## G2 — Source safety and scope

### Boundary

Fixtures exercised, each against a **real temporary directory** through the real Node
adapter (never a fake tree), plus the shared contract suite that runs the same
twenty-obligation suite against **both** the fake and the real port so the two cannot
drift:

| Case | Where | Result |
|---|---|---|
| Spaces and trailing dots in names | `tests/integration/walker.test.ts` | pass |
| Unicode, combining marks, RTL segments | `tests/integration/walker.test.ts`; `tests/contracts/source-filesystem-port.contract.ts` (multi-byte size in BYTES) | pass |
| Windows drive paths and prefix collisions | `tests/integration/walker.test.ts`; `tests/unit/path-safety.test.ts` (`C:\Projects\app` vs `C:\Projects\app-evil`) | pass |
| Parent traversal (`..`, bare `..` entry, `..` above the root) | `tests/unit/walker-bounds.test.ts`; `tests/unit/path-safety.test.ts`; `tests/component/source-modal.test.ts` | pass |
| Symlinks and junctions | `tests/integration/walker-symlinks.test.ts`; acceptance "Respect the approved source boundary" (a real junction pointing **out** of the approved root) | pass — directory junction runs for real; the plain **file**-symlink case is the one skipped test (see below) |
| Permission errors | `tests/integration/walker-content.test.ts`; `tests/unit/walker-bounds.test.ts` (unreadable directory, distinct `wasDirectory`) | pass |
| Binary and invalid text | `tests/integration/walker-content.test.ts`; contract suite | pass |
| Nested ignore rules | `tests/integration/walker.test.ts` | pass |
| Huge files | `tests/integration/walker-content.test.ts`; benchmark fixture carries a 6 MB `assets/huge.txt` past `maxFileBytes` | pass |
| Cancellation | `tests/unit/walker-bounds.test.ts`; `tests/integration/scan-lifecycle.test.ts`; acceptance "Cancel a refresh without losing the valid snapshot" | pass |
| Deep nesting beyond 20 levels, duplicate basenames, `maxDepth`, `maxEntries` | `tests/integration/walker.test.ts`; `tests/unit/walker-bounds.test.ts` | pass |

**The one skipped test is a genuine environment gate, not a gap in the evidence.** This
machine lacks Windows Developer Mode, so creating a plain *file* symlink fails `EPERM`
before the assertion is reached. The directory-junction case — the one that actually
matters for escaping an approved root, and the one the acceptance suite also exercises
— runs for real.

### No source writes

**Method.** SHA-256 of every file in the tree, plus `size` and `mtimeMs`, before and
after a scan, compared with a single whole-tree equality — not a spot check. Directories
and symlinks get their own fingerprint too, so a newly created empty directory or a
re-pointed link is also caught (`tests/fixtures/temp-tree.ts`, `hashTree`).

**Fixture, at full scale, with the plugin already installed.** The 1,000-file functional
fixture `scripts/make-benchmark-fixture.mjs` generates is a **vault with this plugin
installed**: `.obsidian/plugins/codebase-inspector/` carries `dist/`'s own `main.js`,
`manifest.json` and `styles.css` when a build exists, alongside another plugin's
`data.json`, a `.git`, a `node_modules` and a `.env`. That is the real configuration, not
a bare directory the plugin has never been near.

| Run | Fixture | Entries compared | Differences |
|---|---|---|---|
| Full scale | `<tmpdir>/codebase-inspector-benchmark/functional-1000`, 1,000 generated source files (1,004 file entities collected) | whole tree, including `.git`, `node_modules`, `.obsidian` and the installed plugin | **0** |
| Small, with unreadable/binary/symlink fixtures | `tests/integration/no-source-writes.test.ts`'s own temp tree | whole tree | **0** |
| Acceptance, with Unicode and a space in a directory name | acceptance "Verify unchanged source after a real scan" | whole tree, plus a full path listing before/after | **0** |

*Differences must be 0, and are 0.*

**The inspected tree only.** The brief is explicit that unavoidable Obsidian workspace
updates must not be compared as if they were source-code modifications. Nothing wrote to
`.obsidian` in these runs (no Obsidian process was running), so the whole-tree diff is
the stronger statement and it holds. The inspected subtree is *additionally* asserted on
its own, so the same assertion can be reused unchanged inside a live host.

**No analyzer, Git command, project script or package installation was executed.** This
is asserted **structurally**, because "no process was spawned" is not observable after
the fact while "nothing in the shipped source can spawn one" is: the acceptance step
reads every `.ts`/`.vue` file under `src/` (76+ files, count asserted so the sweep cannot
go vacuous) and fails on any occurrence of `child_process`, `execFile`, `spawnSync`,
`spawn(`, `execSync` or `npm install`. `src/adapters/filesystem/node-access.ts` is the
only file in `src/` that reaches Node at all, and `tests/unit/node-access-boundary.test.ts`
enforces that — including the bracket-notation and aliased spellings of `window.require`.

### Secrets are never read

**Method.** The `SourceFileSystemPort` records every path it **OPENS** — `walk`'s per-entry
`onOpen`, `readText` and `stat` all append to one shared log, and the contract suite
asserts that both the fake and the real adapter log identically. The test then asserts
that excluded paths never appear in that log. **This proves the ABSENCE OF A READ, not
absence from an interface.**

Every check below is preceded by a **positive control** asserting that an included path
*is* in the log, because an empty or broken log would satisfy every absence trivially.

| Excluded and verified absent | Where |
|---|---|
| `.env` | `tests/integration/read-log.test.ts` |
| `.git` | `tests/integration/read-log.test.ts`; `tests/integration/vault-is-the-codebase.test.ts`; acceptance "Vault is the codebase" |
| **the actual `vault.configDir`** — `.obsidian` *and* a deliberately non-default `.my-config` | `tests/integration/vault-is-the-codebase.test.ts`; acceptance "Vault is the codebase" |
| another plugin's `data.json` | as above |
| this plugin's own `data.json` | as above |
| `node_modules` | `tests/integration/vault-is-the-codebase.test.ts` |
| **Verified present (so the log is real)** | `src/a.ts`, `notes/note.md`, `README.md`, depending on the fixture |

**The config directory's name is never hardcoded.** `defaultExclusionsFor(vaultConfigDir)`
takes the caller's `vault.configDir`; `src/adapters/**` never decides it.
`vault-is-the-codebase.test.ts` renames the generated `.obsidian` to `.my-config` and
proves both halves: with the **right** name passed, nothing under it is opened; with the
**wrong** name passed, the same directory **is** opened. Without that second half, "we
exclude the configured directory" would be indistinguishable from "we exclude a directory
that happens to be called `.obsidian`".

> **This property is load-bearing and it has a known pending decision against it.**
> Ruling M108 left the scanner **sequential**. Bounded concurrency measured about four
> times faster but reads up to *N−1* files after a cancellation — and those reads **enter
> this read log**. If the user later takes the speed, the read-log property recorded here
> changes shape: "no excluded path is ever opened" survives, but "a cancelled run opens
> nothing further" does not. That question is open with the user and carried to
> checkpoint #4. It is written here rather than buried so the amendment is a one-paragraph
> edit rather than a re-derivation.

### Pruned directories are reported honestly

A pruned or unenterable directory is never silently dropped. `walker.ts` yields a
`kind: 'skipped'` entry carrying a **reason** for every one of: an excluded path
(pruned before anything is opened), an unreadable directory (`directory is unreadable:
<message>`), `maxDepth` exceeded, `maxEntries` exceeded, a symlink not followed, a file
over `maxFileBytes`, binary content, and a path that resolves outside the approved root.
`collectInventory` carries each into the snapshot: a skipped **directory** keeps
`wasDirectory: true` and is not turned into a file entity (a regression that did exactly
that was fixed in task 5's fix round 1), and a skipped **file** becomes an entity whose
observations are `status: 'unavailable'` with the walker's own reason.

**What the user sees.** The reason reaches the inspector verbatim through
`formatUnavailableReason` ("Not measured. {reason}"), and the snapshot's
`completeness: 'partial'` drives COPY-13 ("Some files could not be read. Measurements
cover {measured} of {included} included files.") in the status surface. Covered by
`tests/component/file-inspector.test.ts`, `tests/component/status-surfaces.test.ts` and
acceptance "Report unreadable content without measured-zero substitution".

### Refresh excludes report/cache output

This plugin's own output lives under the same config directory as every other plugin's,
so **excluding the whole config directory** — never a per-plugin list `src/adapters/**`
would have to maintain — is what keeps a refresh from ever reading, and therefore ever
re-analysing, its own prior output. Proved directly: the read log carries no path ending
`/plugins/codebase-inspector/data.json` (`tests/integration/read-log.test.ts`,
`tests/integration/vault-is-the-codebase.test.ts`, acceptance "Vault is the codebase"),
with a positive control in each case. WP-01 writes no report or cache file of any other
kind; the SnapshotStore is in-memory (spec §4.5).

### Supporting, not a substitute

At checkpoint #1 the user personally observed **no filesystem activity on view open**.
That is real evidence and it agrees with `tests/host/lifecycle-leaks.test.ts` and
acceptance "Do not scan while enabling or restoring the plugin". It does not replace the
record above; it corroborates it.

---

## G3 — Evidence truth

**Physical lines: exact definition + 7 unit tests.** `src/domain/metrics.ts`:
empty text is 0; CRLF is **one** separator; a trailing newline adds no phantom line;
blank and comment lines **count**. Tests: `tests/unit/metrics.test.ts` (7 `it` blocks).

**No provider means not analyzed.** WP-01 ships exactly one provider,
`builtin-inventory`, and `src/domain/validator.ts` rejects any snapshot whose
`providerRun.provider` is not `builtin-inventory` with `origin: 'collected'`. There is no
code path that produces an entity with an inferred or defaulted measurement: every
`Observation` originates in `collectInventory` from something the walk actually read, and
a file the walk could not read becomes `unavailable` with a reason rather than acquiring a
value. No findings, coverage, dependency or runtime provider exists in WP-01 to be
silently stood in for.

**Unavailable is never a measured zero.** The validator rejects an `unavailable`
observation whose `value` is `0` (`src/domain/validator.ts`, structural rules 6 and 7:
"unavailable observation must carry a null value and a reason"), and rejects one with no
reason. The collector never coerces: binary, undecodable, oversized, unreadable and
skipped content never reach `countPhysicalLines` at all. Tests:
`tests/unit/validator.test.ts` — "rejects an unavailable observation whose value is 0,
never coercing it", "rejects an unavailable observation with no reason", and — the other
side of the same boundary — "accepts a measured-zero observation, because zero is a valid
measurement". Acceptance: "Report unreadable content without measured-zero substitution",
which also asserts that a genuinely readable sibling still carries a real number, so
"never zero" is not being satisfied by measuring nothing at all.

**Provenance is never read from a payload.** `tests/unit/validator.test.ts` — "never
reads provenance from the payload": a fixture with `source: 'synthetic'` and
`providerRun.provider: 'hand-edited'` is **rejected**, not displayed. Provenance is a
property of the run that produced a snapshot, established by the collector; a restored or
imported value claiming provenance is data to be validated, never a label to display.

**Run completion is separate from findings and policy verdict.** WP-01 ships neither
findings nor a policy verdict. The fields are separate in the model: `InventoryRunState`
(spec §4.1) carries run status alone, `CodebaseSnapshot.completeness` carries
`'complete' | 'partial'`, and `warnings` is its own array. A cancelled run produces
**no** snapshot and its notice is COPY-10 — asserted character for character against the
catalogue entry by acceptance "Cancel a refresh without losing the valid snapshot",
including that the sentence contains no finding or measurement language.

**Nothing infers "safe to delete", "test will pass" or "not exploitable".** No such
string, concept or code path exists in `src/`. COPY-20 ("Unused candidate") is WP-02+ and
is absent from `src/ui/copy.ts` by policy, with its own note in that file.

---

## G4 — Lifecycle and accessibility

### Checkpoint #3, by row

Checkpoint #3 was **closed by the user** at branch `49f47e3` with "this looks better
now. proceed", accompanied by a screenshot of the working city. Four questions remain
open and are carried to checkpoint #4 (ruling M117). The honest row-by-row position:

| Row | Checkpoint #3 result | Automated coverage |
|---|---|---|
| Multiple leaves | **not itemised by the user** | `tests/host/multi-leaf.test.ts` (10 tests); acceptance "Preserve independent state across two leaves" |
| Independent selection | **not itemised by the user** | as above — selection, query, camera, inspector and Pinia instance all proved independent |
| Command reveal | **not itemised by the user** | `tests/host/commands.test.ts`; `multi-leaf.test.ts` "reveals a leaf before acting on it" |
| Close / reopen | **confirmed** — the user's screenshot shows a reopened city with its retained snapshot ("Snapshot retained from just now.") | `tests/host/city-view.test.ts`; `lifecycle-leaks.test.ts` "survives ten open/close cycles with zero live WebGL contexts" |
| Disable / re-enable | **not itemised by the user** | `tests/host/plugin-onload.test.ts`; acceptance "Do not scan while enabling or restoring the plugin" |
| Workspace restoration | **confirmed indirectly** — the user's earlier reports show state surviving restarts (this is how the `setCameraMode('3d')` defect was found) | `tests/unit/view-state.test.ts`; `view-state-sync.test.ts`; `city-view.test.ts` |
| Hidden and resized leaves | **confirmed** — defects 5, 6 and 7 (indefinite height, row wrapping, wheel zoom) were reported by the user at this checkpoint and are visibly fixed in the closing screenshot | `lifecycle-leaks.test.ts` "pauses drawing and input for a hidden leaf, and NEVER scans on resume"; `responsive-floor.test.ts`; `stage-height.test.ts`; `layout-budget.test.ts` |
| Theme switching | **not itemised by the user** | acceptance "Theme change while a city is open" (the §6 repair); `tests/host/city-view.test.ts`'s css-change wiring |
| Pop-out migration | **not itemised by the user** | `tests/host/window-migration.test.ts` (13 tests, against a genuinely separate `jsdom` realm with a real `adoptNode`); acceptance "Move a view to a pop-out window" |

**This table is deliberately not rounded up.** The user closed the checkpoint on the
strength of the city rendering correctly after three reported defects were fixed; they
did not walk every row and did not say they had. Presenting automated coverage as a
human confirmation is exactly the kind of claim this document exists to avoid.

### No orphan canvas, observer, timer, watcher, event handler or active render loop after shutdown

`tests/host/lifecycle-leaks.test.ts`: no `requestAnimationFrame` handle, no timer and no
active render loop; no observer; no event handler; the `matchMedia` change listener is
released with the view; the `css-change` subscription is released with the view; ten
open/close cycles leave **zero** live WebGL contexts; a zero-size leaf costs nothing.
`tests/component/renderer-disposal.test.ts` adds the renderer's own side: every geometry,
material, texture and render target disposed; `renderer.dispose()` **and**
`forceContextLoss()`; every appended DOM node removed including the label overlay;
picking removes on dispose exactly what it registered, on the canvas **and** on the
document; idempotent; and nothing leaks across ten construct-and-dispose cycles.

### Job completion after a closed or rebound view is ignored

`tests/host/lifecycle-leaks.test.ts` — "ignores a job that completes after its view
closed". `tests/component/renderer-disposal.test.ts` — "emits no event after dispose, not
even from instrumentation". Acceptance "Dispose the real Three.js renderer" drives the
**production** `createCityRenderer` and asserts that a snapshot arriving after the view is
gone changes nothing and issues no further draw. At the run level, `mayPublish` refuses a
late result on any component of the five-part identity tuple — acceptance "Reject late
result publication" and "Reject late result publication across profiles", the latter with
a deliberately *higher* generation than anything the live run issued, so a rule comparing
generations alone would publish it and this one does not.

### The file list and inspector work keyboard-only and without WebGL

Acceptance "Preserve inventory without the renderer": the renderer reports
`unavailable{unsupported}`, COPY-14 appears, and the HTML list still renders every file,
still selects on activation, and the inspector still shows raw lines and bytes — while
the run stays `idle`, because a renderer failure is never authorisation to re-enumerate
the source. Keyboard-only: rows are native `<button>`s with a roving tabindex, exactly one
in the tab order, and moving focus never selects
(`tests/component/codebase-file-list.test.ts`). Every dragging gesture has a
single-pointer alternative (`tests/component/camera-controls.test.ts`, WCAG 2.5.7).

### Limitation of the automated renderer evidence

jsdom resolves no WebGL2 context, so every renderer suite — including acceptance "Dispose
the real Three.js renderer" — doubles `THREE.WebGLRenderer` and **only** that class. Real
`Scene`, real `BufferGeometry`, real `InstancedMesh`, real materials and the real
`dispose()` implementations `disposal.ts` calls are the genuine module. So these suites
establish that the scene graph is built and given back correctly; they establish **nothing
about pixels, GPU memory or frame time**. The reference-hardware block below exists for
exactly that reason.

---

## G5 — Performance

### Reference hardware — recorded, because CI software rendering establishes nothing

| | |
|---|---|
| CPU | Intel(R) Core(TM) Ultra 9 185H |
| GPU | NVIDIA RTX 1000 Ada Generation Laptop GPU (Intel Arc Pro Graphics also present) |
| OS | Microsoft Windows 11 Pro 10.0.26200 |
| Obsidian | **not exercised by these numbers** — 1.12.4 is installed locally; the user's host is 1.13.7; the types package is 1.13.1 |
| Electron / Chrome | **not captured** — see the note below |
| Runtime actually measured | Node v24.15.0 + jsdom under vitest, `WebGLRenderer` doubled |
| Viewport | 1200 × 800 CSS px (set on the renderer; no display) |
| devicePixelRatio | 1 |
| Fixture | `scripts/make-benchmark-fixture.mjs`, deterministic, 1,000 and 5,000 source files |
| Settings | default profile exclusions (`defaultExclusionsFor('.obsidian')`), `maxFileBytes` 1,000,000, `followSymlinks` false |
| Measurement method | `performance.now()` around each stage separately; layout and scan measured once per fixture; interaction sampled 120 times and reported at p95; a throwaway warm-up renderer is built and disposed before the measured window |

**These are not GPU measurements and must not be quoted as any.** jsdom has no WebGL2
context, so `WebGLRenderer` is doubled: "first paint" below is the time from `setLayout`
until the **first draw call is issued** (real scene construction, real instancing, no
rasterisation), and "interaction" is command-to-draw latency, not frame time on a
display. The Electron/Chrome row is left empty rather than filled from the installed
Obsidian, because the number that would matter is the one the *user's* 1.13.7 host runs
and no measurement was taken there.

### Results (initial targets, NOT claims)

| Stage | 1,000 files | 5,000 files | Target |
|---|---|---|---|
| Scan | 2,914 ms | 13,399 ms | — |
| Normalization (`validateSnapshot`) | 27.7 ms | 39.4 ms | — |
| Layout (`computeLayout`) | 22.7 ms | 32.6 ms | — |
| First paint after snapshot available | 48.8 ms | 153.8 ms | within 3 s — met, but **not on a GPU** |
| Interaction p95 (command → draw call) | 1.58 ms | 0.75 ms | at or below ~33 ms — met, but **not a display frame time** |
| Cleanup (`dispose()`) | 0.82 ms | 0.49 ms | — |

The scan figures are the honest cost of ruling M108's **sequential** walk, and they are
the number the open speed-versus-cancellation question is about. They are real: a real
temporary tree, real `node:fs` reads, real decoding.

**Two measurement bugs were found and fixed before any of this was recorded**, and both
are worth knowing about because either would have produced a plausible-looking table:
without a warm-up the first fixture measured paid all of three's JIT cost, and `void`-ing
the asynchronous `setLayout` measured only its synchronous prefix. Together they reported
the 1,000-file build as roughly four times **slower** than the 5,000-file one.

### No sustained animation while idle or hidden

**Method.** `renderer.info.render.frame` (via the doubled renderer's draw counter) after
the scene has settled, with the frame queue drained repeatedly; then again with the leaf
hidden, modelled by `pause()` — the same call `CityViewport.applySize` makes for a
zero-size box.

**Result.** 0 further draws after settling, at both 1,000 and 5,000 files. 0 draws while
paused, including after a camera nudge that would otherwise invalidate the scheduler.
Asserted, not merely recorded.

### Aggregation rather than silent disappearance at unsupported scale

| | 1,000 files | 5,000 files |
|---|---|---|
| File entities collected | 1,004 | 5,004 |
| Lots | 1,004 | 5,004 |
| **Lots dropped** | **0** | **0** |
| Districts | 5 | 5 |
| Districts aggregated | 3 | 3 |
| Values clamped by the metric cap | 40 | 170 |

Zero lots dropped is **asserted** in the benchmark, not just recorded: it is about the
layout rather than about pixels, so it is one of the few scale claims jsdom genuinely
establishes.

### Diagnostics

`getDiagnostics()` supplies `geometries`/`textures`/`programs`, `drawCalls`,
`instanceCount`, `lastFrameMs` and `contextLost`; `debugLoseContext()` forces
`WEBGL_lose_context`. Both are the frozen §4.2 port's own instrumentation and are what
the benchmark and the disposal suites consume. No instrumentation was added beside them.

---

## G8 — Testing coverage — WHICH LAYERS ACTUALLY RAN

Counts from `npm run verify` at this commit: **88 files, 936 tests, 935 passed,
1 skipped.**

| Layer | Ran | Count | Notes |
|---|---|---|---|
| Unit | yes | 451 | domain, application, UI stores, interaction state, stylesheet-as-contract (comments stripped — see below) |
| Contract | yes | 40 | **one suite, two implementations** — `tests/contracts/source-filesystem-port.contract.ts` runs against the fake port and the real Node adapter, so they cannot drift |
| Integration (real temp dirs) | yes | 24 + 1 skipped | walker, walker bounds/content/symlinks, scan lifecycle, read log, no-source-writes (including the 1,000-file full-scale proof), vault-is-the-codebase. The skip is the file-symlink environment gate |
| Component (jsdom) | yes | 295 | against **our** controls: the file list, search, inspector, camera controls, viewport, status surfaces, announcements, both modals, the settings tab, the renderer contract and disposal |
| Acceptance (21 + 3 repairs) | yes | 26 | 24 scenarios plus 2 structural guards (the feature file carries all 21 ported scenarios and the three repairs and nothing else; no step definition is unused) |
| Accessibility | **partly** | see the matrix | jsdom rows ran; **every manual row is NOT PERFORMED** — `2026-09-17-wp01-accessibility-matrix.md` names each one individually |
| Benchmark | yes | 5 | reference hardware recorded above; **not a GPU measurement**, and the document says so in the same table as the numbers |

### Two honesty notes about the suite itself

**Stylesheet-as-contract tests strip CSS comments.** A test of this kind on this branch
once passed with its own defect reinstated, because a CSS comment quoting
`button { height: var(--input-height) }` truncated the parsed rule — the comment's braces
ended the match — and only a mutation check caught it. `tests/unit/host-cascade.test.ts`
and `tests/unit/layout-budget.test.ts` strip comments before parsing. Task 12 wrote no new
stylesheet-reading test.

**`npm run analyze` is a review list, not a pass/fail gate, and it is not part of
`npm run verify`.** It runs `fallow dead-code src` — scoped to `src/` deliberately,
because question 1 of this branch's own dead-surface sweep is literally "does anything in
`src/` — not `tests/` — call this?". Current result (7 unused exports, 1 unused type, 1
unused class member, 1 duplicate export pair, 1 circular dependency):

| Finding | Assessment |
|---|---|
| `districts.ts` `LOT_FOOTPRINT`, `UNAVAILABLE_FOOTPRINT`, `MAX_DIRECT_SUBDISTRICTS`; `picking.ts` `DRAG_THRESHOLD_CSS_PX`, `HOVER_DWELL_MS`; `scale.ts` `SCALE_NAME` | exported for their **tests**, which assert against the constant rather than retyping the number. Used inside their own modules. Accepted. |
| `node-access.ts` `fs` | the single Node seam; `fsPromises` is derived from it and `tests/unit/node-access-boundary.test.ts` asserts this file is the only one in `src/` that reaches Node. Accepted. |
| `model.ts` type `SourceReference` | named by spec §4.1's **frozen** implemented-types list. Only the user may change a §4 contract. Accepted, and must not be "cleaned up". |
| `renderer-port.ts` `EntityId` duplicating `entity-id.ts` | both are inside frozen §4.2/§4.1 contracts. Accepted. |
| `city-view.ts → leaf-registry.ts → city-view.ts` cycle | pre-existing and structural (the registry reaches views; views ask the registry to reconcile siblings). Not touched by task 12. |
| **`ScanCoordinator.getLifecycle`** | **a genuine zero-caller surface.** Nothing in `src/` *or* `tests/` called it before this task. It is an inert accessor, not a fake feature, so it is not instance 10 of the branch's defect class — but it is dead code, it is outside task 12's file ownership, and it is **reported rather than removed**. |

The COPY catalogue duplication this gate first surfaced (15 unused exports) is fixed:
COPY-03…COPY-07 and COPY-09 now come from `src/ui/copy.ts` instead of being retyped in
the two modals and in `commands.ts`. COPY-10 stays, and the acceptance suite compares the
assembled cancellation sentence to it with `{time}` substituted, so its two shipped halves
cannot drift from the catalogue.

---

## The two factual claims

**"Read-only source access"** and **"Source remains unchanged."** ship as of this commit,
in `src/host/modals/scope-modal.ts` (the consent artefact, where the claim is made
*before* the read) and `src/ui/components/SnapshotStatus.vue` (the persistent status line,
where it is made *after*). Each site carries a comment citing this document. They were
deliberately absent until now, and task 7's absence assertion was flipped to a presence
assertion in the same commit that adds them (ruling P5).

The G2 record above is what those two sentences rest on. If any of it ceases to be
true — in particular the read-log property, which has an open decision against it — the
claims come back out.
