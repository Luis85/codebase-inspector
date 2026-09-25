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

## GATE STATUS — READ THIS BEFORE CITING THIS DOCUMENT

| Gate | Status |
|---|---|
| **G2** — source safety and scope | **CLOSED** by the evidence below |
| **G3** — evidence truth | **CLOSED** by the evidence below |
| **G4** — lifecycle and accessibility | **lifecycle half CLOSED; ACCESSIBILITY HALF OPEN** |
| **G5** — performance | **CLOSED for structure, OPEN for real-host timing** (the numbers below are not GPU measurements) |
| **G6** — analyzer process boundary (WP-02 Part 7) | **CLOSED for the automated checks; the manual host check (acceptance 3) is NOT PERFORMED** — see the G6 section |
| **G7** — accessibility | **OPEN** |
| **G8** — testing coverage | **CLOSED**, with the accessibility layer recorded as partly run |

### G4's accessibility half and G7 are OPEN pending a human checkpoint

**No downstream task may cite this document, or
`2026-09-17-wp01-accessibility-matrix.md`, as evidence that accessibility is gated.**
Task 13 is a release gate that cites this document; this block exists so it cannot cite
an unperformed row as a passing one.

Task 12 ran as an automated session with no screen reader, no human eyes, no browser
zoom and no third-party theme. **13** of the matrix's **14** rows are therefore **NOT
PERFORMED**, in whole or in part; exactly one is fully PASSED. They are answered at
**checkpoint #4**, and these are exactly the rows outstanding:

<!-- a11y:open:start -->

1. Keyboard-only: complete the scripted demo without a mouse
2. Screen reader: NVDA on Windows
3. 200% text zoom: no clipping, labels scale as text
4. Focus visibility — the *visible* half (focus order is machine-checked)
5. Dark theme — contrast, **including the two shipped claims themselves**: they render
   inside `.ci-snapshot-status`, whose `color: var(--ci-text-muted)` is the
   lowest-contrast token on the surface (review M5). No CSS was added for them, to
   stay out of ruling M113's specificity fight; whether a factual safety claim should
   sit in the muted token is a judgement for a human looking at it
6. Light theme — contrast, same claim caveat
7. One third-party theme (name it when done) — **schedule this first**: ruling M113's
   `:where(.codebase-inspector-root)` arrangement contributes zero specificity and has
   never met a theme that fights it
8. Non-drag single-pointer equivalence — the *reachable at a real pointer size* half
   (the 11 controls themselves are machine-checked)
9. Reduced motion — the *visibly jumps rather than tweens* half (the command is
   machine-checked, and since the final fix wave so is the response to a live
   preference change; what no double can show is a REAL OS-level change reaching
   the page)
10. Long Unicode paths — the *wraps or truncates legibly* half, and the tooltip case,
    which is covered at no layer
11. Host shortcuts are not captured while the city lacks focus
12. Focus is preserved after a refresh
13. Tooltip and overlay DOM belong to the correct window — in a real pop-out

<!-- a11y:open:end -->

What **is** closed, and may be cited: the structural half. Roving tabindex with exactly
one row in the tab order, one polite live region with an assertive path only for a
blocking failure, the canvas as one named focusable region with an `aria-hidden`
untabbable canvas inside it, a single-pointer alternative for every dragging
gesture (eleven controls in all, of which three — Fit, Top and Focus — are not drag
alternatives at all), focus return from both modals taken from `activeDocument`, and cross-window DOM
ownership enforced by `no-restricted-globals` and exercised against a genuinely separate
jsdom realm. Each is named with its test in the matrix.

A second reading this block is meant to prevent: "the structure is in place" is not "the
product is accessible". Contrast, focus-ring visibility, zoom reflow and screen-reader
output are all unverified, and every one of them is a thing a user experiences directly.

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
reads every `.ts`/`.vue` file under `src/` (320+ files, count asserted so the sweep cannot
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

**Physical lines: exact definition, with its unit tests.** `src/domain/metrics.ts`:
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

> **The LIFECYCLE half of G4 is closed by the evidence in this section. The
> ACCESSIBILITY half of G4, and G7 entirely, are OPEN pending a human
> checkpoint — see the GATE STATUS block at the top of this document for the
> thirteen outstanding rows and where they are answered.**

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
| Interaction p95 (command → draw call) | 1.58 ms | 0.75 ms | **below this harness's measurement resolution — no verdict** |
| Cleanup (`dispose()`) | 0.82 ms | 0.49 ms | **below this harness's measurement resolution — no verdict** |

**The interaction and cleanup rows are noise, and are marked so rather than read as
results** (review M6). Both go *down* as the data goes *up* — five times the lots, half
the time — which is not a plausible measurement of anything. The benign explanation is
real: with `WebGLRenderer` doubled, `render()` is a counter increment and `dispose()` is
dominated by fixed cost, so both stages sit under the timer's useful range. There is also
a residual ordering effect the per-fixture warm-up does not remove: `describe.each` runs
the 5,000-file case second, in the same worker, against an already-warm module graph.
**Neither row supports "at or below ~33 ms" and neither is claimed to.** The other four
stages scale monotonically with the data and are trustworthy as *relative* figures for
this harness. Real interaction frame time needs the real host; see the reference-hardware
block above.

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

## G6 — Analyzer process boundary (WP-02 Part 7)

Recorded by task 14 at branch `feat/wp-02-part7`. Reproduce the process-boundary claims
with `npm run test:fallow` (Git Bash, Windows) and the no-freeze evidence with
`npx vitest run tests/integration/fallow-analysis.test.ts -t "no freeze"`.

### G6 requirement, item by item, each evidence cell naming the test file that holds it

| G6 requirement | Evidence |
|---|---|
| Exact executable/cwd display | `tests/component/connect-fallow-routes.test.ts`: the review renders `facts.executablePath`, the root as "Folder analysed" and "Runs in", and one `<code>` per argv item equal to `FALLOW_RUN_ARGS(root)` (Z31) |
| Explicit trust before any probe | `tests/integration/fallow-analysis.test.ts` ("a bound but untrusted run starts zero processes"): an untrusted `run` records zero process requests, `review` records zero, and after Trust and run the first request is `['--version']`. `tests/unit/fallow-analysis-service.test.ts`: `checkTrust` never touches the process port (Z7, Z8) |
| Missing native binary | `tests/unit/executable-inspector.test.ts`: the inspector answers `executable-missing`; `tests/contracts/fallow-runner.test.ts`: a real spawn `ENOENT` gives `{ kind: 'spawn-failed', errorCode: 'ENOENT' }` (`tests/unit/fallow-runner.test.ts` pins the same answer for a scripted spawn error), classified as `executable-missing` (`tests/unit/fallow-invocation.test.ts`, and end to end by `tests/unit/analysis-coordinator.test.ts`, Review Focus 4) — **citation corrected in the final review** |
| Unsupported version | `tests/integration/fallow-analysis.test.ts`: fake fallow `version-4` gives `version-unsupported`, with no run and no trust stored; `version-untested` runs are labelled untested |
| Finding exit status | `tests/contracts/fallow-runner.test.ts` and `tests/integration/fallow-analysis.test.ts`: `findings-exit-1` completes; `tests/fallow-real/fallow-real.test.ts` test 7: the real binary, `fallow dead-code --fail-on-issues`, exits 1 and still classifies as completed — **corrected during execution, see below** (Z41.7) |
| Real failure | `tests/integration/fallow-analysis.test.ts`: `error-exit-2` gives `analyzer-error`, and the evidence is kept and marked stale; `tests/fallow-real/fallow-real.test.ts` test 6: a real bad root (Z41.6) |
| Malformed/truncated output | `tests/unit/fallow-invocation.test.ts`: no output, non-UTF-8 output and a truncated report all give `output-not-json`, and the stdout cap gives `output-too-large`; `tests/unit/fallow-runner.test.ts`: a drained `exit` whose `close` never follows gives `output-incomplete` |
| Timeout | `tests/unit/fallow-runner.test.ts` (fake timers, plus the never-exits deadline below); `tests/contracts/fallow-runner.test.ts` (`hang`, the real runner); `tests/fallow-real/fallow-real.test.ts` test 8 (the real binary, `timeoutMs: 1`) |
| Cancellation | `tests/unit/fallow-runner.test.ts`: cancel before and after spawn; `tests/contracts/fallow-runner.test.ts`: `hang`; `tests/fallow-real/fallow-real.test.ts` test 9: a real cancel right after spawn; `tests/unit/analysis-state.test.ts`: `cancelling` never publishes |
| Shutdown | `tests/unit/fallow-runner.test.ts` and `tests/contracts/fallow-runner.test.ts`: `killAll` sends the kill signal at once and resolves without waiting for exit; `tests/host/plugin-onload.test.ts` ("Part 7 Z24: onunload shuts the fallow analysis down once, synchronously"): `onunload` calls `shutdown` exactly once |
| Windows launchers | `tests/unit/executable-inspector.test.ts`: `fallow.cmd`, `.bat`, `.ps1`, `.js`/`.mjs`/`.cjs` and a `#!` `fallow` script are all refused as `launcher`; `tests/unit/fallow-runner.test.ts`: `shell: false` in the recorded spawn options; `tests/unit/no-process-execution.test.ts`: the guard's own `shell option` ban (Z37) |
| Process-tree cleanup where supported | `tests/contracts/fallow-runner.test.ts` ("cancel ends the whole process group on POSIX, and the direct child only on Windows (the documented limitation)"): on POSIX the grandchild is asserted gone; on Windows the assertion is `if (process.platform !== 'win32')`-gated, so the code path is unit-pinned but **not exercised on this Windows machine** — see the POSIX note below |
| Do not claim an OS sandbox | `tests/unit/fallow-run-copy.test.ts` ("G6: no copy claims a sandbox; the one mention says it is not one"): `FALLOW_REVIEW_EFFECTS[3]` says it is not a sandbox, and the same test sweeps `src/ui/audit-copy/**` for `/sandbox/i` and finds no other match |
| Disallow auto-install/download/fix paths | `tests/unit/fallow-argv-policy.test.ts` (Z38): no `npx`, `npm`, `fix`, `init`, `setup`, `watch`, `--fail-on-issues` or `--allow-remote-extends` string anywhere in `src/application/analysis/**` or `src/adapters/fallow/**`; no fallow dependency in `package.json`; `test:fallow` is opt-in and outside `npm run verify` |
| Verify cache/report/log side effects against the tested version | `tests/fallow-real/fallow-real.test.ts` tests 4–5: the fs-diff on fallow 3.27.0, plus the `.fallow/` control (Z41.4–5) — the run is pasted verbatim below |
| Environment (Z16) | `tests/unit/fallow-runner.test.ts`: a faked spawn call receives exactly the allow-listed keys plus `NO_COLOR`, nothing else; `tests/contracts/fallow-runner.test.ts` ("gets only the allow-listed environment plus NO_COLOR, never FALLOW_* or NODE_OPTIONS"): the REAL child's own environment, read back through the fake fallow's `env-dump` mode. **On Windows the child's environment is the allow-list plus the variables libuv always adds; on POSIX it is exactly the allow-list** — the contract test allows exactly libuv's set (`HOMEDRIVE`, `HOMEPATH`, `LOGONSERVER`, `SYSTEMDRIVE`, `SYSTEMROOT`, `TEMP`, `USERDOMAIN`, `USERNAME`, `USERPROFILE`, `WINDIR`) on `win32` and nothing extra on POSIX (ruling, Part 7 execution; also the limitations document's tenth Part 7 bullet) |

**Finding exit status, corrected during execution (Z41.7).** The design's probe found
`--fail-on-issues` giving exit 1 (§1's "Real-CLI facts"). Re-run against fallow 3.27.0
during this task, the **bare/combined** mode this runner actually uses **ignores**
`--fail-on-issues` and exits 0 regardless of findings. The real exit-1 test therefore
runs `fallow dead-code --fail-on-issues` — a different subcommand, invoked only from the
test file, never from `src/` (`tests/unit/fallow-argv-policy.test.ts` keeps
`--fail-on-issues` out of `src/application/analysis/**` and `src/adapters/fallow/**`
regardless) — which does honour the flag on this project and exits 1 while still
producing a complete, parseable report. `docs/superpowers/specs/2026-09-23-inspector-ui-part7-design.md`
is corrected in the same commit: its §1 probe-facts row and its Z41.7 bullet both now
state this, each with a one-line "(corrected during execution, Part 7 ledger)" note.

**POSIX paths not run here.** The POSIX process-group kill
(`tests/contracts/fallow-runner.test.ts`) and the `realKill(-pid)` fixture path
(`tests/fixtures/real-spawn.ts`, PF4) are unit- and contract-pinned, but this task ran
on Windows: neither was actually exercised on a POSIX machine during this execution.

**Kill deadline (Z18, superseding the literal wording of Z18's own "resolves on exit").**
A killed run has a final deadline, not an open-ended wait for `exit`: SIGTERM, then
SIGKILL at +2 s (`FALLOW_KILL_GRACE_MS`), then the run is settled — as `timed-out` or
`cancelled`, whichever it was — at +4 s even if the child process never reports its own
exit, so a stuck child cannot hold a run open forever. Pinned by
`tests/unit/fallow-runner.test.ts` ("a timed-out child that never exits still settles 4 s
after the stop…", "a cancelled child that never exits still settles 4 s after the
cancel…").

### `npm run test:fallow` at this commit

Binary: `C:\Users\LuisMendez\AppData\Local\npm-cache\_npx\ee3f2ca80543beb5\node_modules\@fallow-cli\win32-x64-msvc\fallow.exe`
(supplied through `FALLOW_BIN`, so nothing was fetched). Version: **3.27.0**. Platform:
**win32**.

`scripts/fetch-fallow.mjs` strips `npm_config_allow_scripts` from the install
environment it would otherwise pass on — `npm run` re-exports the caller's own
`~/.npmrc` `allow-scripts` setting as that variable, and npm 12 refuses a project-scoped
install with `EALLOWSCRIPTS` when it is set. `FALLOW_BIN` bypasses the fetch entirely
here, but the strip is unconditional so an unset `FALLOW_BIN` install still works on a
machine whose `~/.npmrc` sets `allow-scripts`.

```
FALLOW_BIN="$LOCALAPPDATA/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe" npm run test:fallow

npm notice run codebase-inspector@0.1.0 test:fallow
npm notice run node scripts/fetch-fallow.mjs && vitest run --config vitest.fallow.config.ts
fetch-fallow: FALLOW_BIN=C:\Users\LuisMendez\AppData\Local/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe; nothing fetched.

 RUN  v5.0.1 C:/Projects/codebase-inspector/.claude/worktrees/inspector-prototype-ui-18caac

[fallow-real] C:\Users\LuisMendez\AppData\Local/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe on win32: {"ok":true,"version":"3.27.0","tested":true}

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  17:12:47
   Duration  9.52s (tests 95%, transform 3%, import 2%)
```

All ten tests pass, including test 4 (fs-diff: every file under the root is identical,
byte for byte, before and after, and no entry — in particular no `.fallow/` — is added)
and test 5 (the control: the same run without `--no-cache` **does** create `.fallow/`,
so the diff above is shown to see writes, not blind to them).

### No-freeze evidence

```
npx vitest run tests/integration/fallow-analysis.test.ts -t "no freeze"

[no-freeze] hang: largest event-loop gap 25.7 ms; final parse 0.1 ms (failed)
[no-freeze] streamed: largest event-loop gap 22.9 ms; final parse 30.1 ms (completed)

 Test Files  1 passed (1)
      Tests  1 passed | 13 skipped (14)
```

```
[no-freeze] hang: largest event-loop gap 23.3 ms; final parse 0.2 ms (failed)
[no-freeze] streamed: largest event-loop gap 22.2 ms; final parse 21.4 ms (completed)
```

Observed again in the WP-02 polish pass: the largest event-loop gap was 23.3 ms against
the 50 ms budget (Z38, K18); Part 7 observed 22–27 ms. The budget is unchanged (polish
L5, C18).

Both gaps are well under the 50 ms bound (spec §5, Z38). The final JSON parse runs on
the UI thread and is measured, not bounded (spec §6).

### Deliverable acceptance (3) and (5)

- **(3) "A configured trusted binary runs without freezing Obsidian."**
  - `spawn` is async, and `*Sync` is banned everywhere — `tests/unit/no-process-execution.test.ts` (Z37).
  - The integration test's event-loop gap while running is under 50 ms — `tests/integration/fallow-analysis.test.ts`, the no-freeze evidence above (Z38).
  - The run is detached from the command and the UI — `tests/unit/analysis-coordinator.test.ts` (Z21).
  - A manual host check runs "Run fallow analysis" on this repository in the real Obsidian with the fetched 3.27.0, and records that the city stays interactive while it runs — see "Manual host check" below.
- **(5) "A cancelled or superseded run cannot overwrite a newer snapshot."**
  - The reducer: `cancelling` forbids publication; `mayPublish` checks the identity, the latest snapshot and unchanged evidence — `tests/unit/analysis-state.test.ts` (Z20).
  - Integration: cancel publishes nothing; a rescan while running gives `snapshot-changed`; an import while running gives `superseded` — `tests/integration/fallow-analysis.test.ts`.
  - The publish is atomic (`put` and then `RUN_COMPLETED`, with no `await` between them) — `tests/unit/analysis-coordinator.test.ts`.

### Manual host check — acceptance (3)

**NOT PERFORMED**, awaiting the owner's checkpoint: install with `npm run install:vault`,
open a city on this repository, run *Run fallow analysis* with the local fallow 3.27.0,
and confirm the city stays interactive while it runs. When the owner performs it, the
result replaces this line.

---

## G8 — Testing coverage — WHICH LAYERS ACTUALLY RAN

Counts from `npx vitest run` per directory. **No round or commit label**: a label
naming a round goes stale every round, and the guard below now forces these figures
to be current rather than asking a reader to trust a date. Re-take with the same
command whenever tests are added.

Counts refreshed 2026-09-23 to the living suite after WP-02 Part 6 (the WP-01 gate
itself was taken at the counts in git history), refreshed again at WP-02 Part 7
(task 14), again after the WP-02 polish pass (2026-09-24, task 9 and its final-review
fixes) — each of those refreshed only the derivable figures, the per-layer FILE counts
and their total and the `src/` file floor below, while the per-layer TEST counts stayed
transcribed at their original WP-01-gate figures — and now refreshed **in full** at
WP-03 Part 1 (2026-09-24, task 15, L28's rule: the evidence-note counts are updated once,
in the final task). The gap the previous paragraph apologised for is closed: every FILE
and every TEST count below, and the heading's own total, come from runs taken together at
this commit, immediately after `npm run harness-shot` (above) and immediately before
`npm run verify`. The WP-03 Part 1 final-review fix wave then added two component files
(`connect-fallow-relations.test.ts`, `relation-duplicates.test.ts`) and tests inside
existing unit and component files; it re-ran `npx vitest run tests/unit` and
`npx vitest run tests/component` and refreshed those two rows, the totals and the
heading from those runs and its own `npm run verify`. No other layer's files changed, so
their rows stand as task 15 took them.

Refreshed once more by the WP-03 Part 1 polish pass (2026-09-25, task 4, following the
same rule): PO1, PO2 and the two Task 9 deferred minors added tests only inside
`tests/unit/architecture-relations.test.ts` (unit) and
`tests/component/architecture-screen.test.ts`, `architecture-rules.test.ts`,
`architecture-edges.test.ts` and `architecture-cycles.test.ts` (component); E26's kept
highlight added tests inside `tests/component/city-relations-panel.test.ts` (component).
No new test file. `npm run test` (267 files, 2959 tests, 2958 passed, 1 skipped) and the
two layer re-runs below refreshed the Unit and Component rows, the totals and the
heading; no other layer's files changed, so their rows stand as task 15 took them.

The per-layer total below is **269**, which is not what `npm run test` itself runs: it is
267 files plus the opt-in `tests/fallow-real` layer's two files, which never run inside it
(see the Real fallow row below, and its own eleven-test run in the WP-03 Part 1 section
above). The Contract row is the one exception to "read straight off a run": its guard
derives its Tests cell from its own files rather than a transcription, so it includes
Part 7's runner contract (`tests/contracts/fallow-runner.test.ts`, K28). Reproduce any row
with `npx vitest run <directory>`; reproduce the whole living suite with
`npx vitest run --reporter=dot`.
`tests/unit/install-script.test.ts` passes at this commit too: its checks build their own
throwaway vault trees under `os.tmpdir()` and do not depend on this worktree having a
`.obsidian/` folder of its own, so the environmental failure recorded through Part 6 did
not reproduce here — the disk/live result is recorded rather than that prediction
(corrected during execution, Part 7 task 14).
**269 files, 2959 tests, 2958 passed,
1 skipped.**

**These numbers are partly machine-checked, and the boundary is stated rather than
implied.** `tests/unit/gate-evidence.test.ts` asserts that the table below names *every*
layer that exists and *no* layer that does not, that each row's FILE count matches disk,
and that the per-layer test counts SUM to the total above. It deliberately does **not**
derive the per-layer test counts themselves: vitest exposes no whole-suite tally to a
test inside that suite, and static `it(` counting is wrong here by construction — the
acceptance runner generates 24 tests from one loop and `describe.each` multiplies the
benchmark's. Those figures are transcribed from the command named in each row and are
pinned by their sum. Reproduce any row with `npx vitest run <directory>`.

*What the guard makes impossible, precisely:* a missing or phantom layer (the error
that actually happened), a wrong FILE count, an added or removed test FILE, a
half-updated table where one row or the heading is edited without the other, and a
passed/skipped split that does not add up to the test total beside it. *What it
does NOT catch:* a UNIFORMLY stale transcription — adding one `it()` to an existing
file moves the suite's true total by one while the rows still sum to the stated total,
and the guard stays green. (That example is deliberately written without figures: a
worked example carrying real-looking numbers is a count in disguise, and this document
has been wrong three times about counts.) That is exactly how the first round's three missing tests were
added (one scope-modal, two snapshot-status, all in existing files), so it is named as
the residual rather than described as solved. Re-take the counts with the command
above whenever tests are added.

<!-- g8:table:start -->

| Layer | Directory | Files | Ran | Tests | Notes |
|---|---|---|---|---|---|
| Unit | `tests/unit/**` | 135 | yes | 1733 | domain, application, UI stores, interaction state, stylesheet-as-contract (comments stripped — see below), and this table's own guard. WP-03 Part 1 adds the relation domain/normaliser/model/architecture-model suites and `relation-copy-claims.test.ts` (spec §5's "no calls/executes/will break" and "no backlink" sweeps). The WP-03 Part 1 polish pass adds PO1/PO2 and the JP5 gating cases inside `architecture-relations.test.ts`, no new file |
| Contract | `tests/contracts/**` | 5 | yes | 62 | **one suite, two implementations** (40) — `source-filesystem-port.contract.ts` runs against the fake port and the real Node adapter, so they cannot drift — plus this directory's other three pinned files, `height-scale.test.ts` (task 13's four preserved scale.ts properties), `microcopy.test.ts` (task 12's catalogue-completeness sweep) and `fallow-runner.test.ts` (Part 7 K28: the real adapter against a real spawned process, injected `node:child_process`, Z38) |
| Integration (real temp dirs) | `tests/integration/**` | 9 | yes | 39 | 38 passed + **the one skip**, the file-symlink environment gate. Walker, walker bounds/content/symlinks, scan lifecycle, read log, no-source-writes (including the 1,000-file full-scale proof), vault-is-the-codebase, the fallow-analysis no-freeze suite |
| Component (jsdom) | `tests/component/**` | 92 | yes | 902 | against **our** controls: the file list, search, inspector, camera controls, viewport, status surfaces, announcements, both modals, the settings tab, the renderer contract and disposal, (task 5) the toolbar's Scan control, and (task 7) the canvas header. WP-03 Part 1 adds the Architecture Cycles/Edges/Rules tabs, the File detail and Quality relations panels, the city Relations section, the relation-arcs geometry suite and the renderer-wiring suite. The WP-03 Part 1 polish pass adds cases inside `architecture-screen.test.ts`, `architecture-rules.test.ts`, `architecture-edges.test.ts`, `architecture-cycles.test.ts` and `city-relations-panel.test.ts`, no new file |
| Host (Obsidian doubles) | `tests/host/**` | 20 | yes | 150 | real `CityView` instances over doubles for what Obsidian provides: plugin onload, commands, multi-leaf, lifecycle leaks, window migration (against a genuinely separate jsdom realm), build output, and task 13's clean-vault install — the scriptable half of G1, which also holds the checkpoint-#4 checklist to the controls and keys `src/` actually ships. **This is the layer the rest of this document leans on most heavily** |
| Acceptance (21 + 3 repairs) | `tests/acceptance/**` | 1 | yes | 26 | 24 scenarios plus 2 structural guards (the feature file carries all 21 ported scenarios and the three repairs and nothing else; no step definition is unused) |
| Benchmark | `tests/benchmarks/**` | 2 | yes | 11 | reference hardware recorded above; **not a GPU measurement**, and this document says so in the same table as the numbers. WP-03 Part 1 adds `relations-budget.test.ts` (N33, N37 — medians above) |
| Harness | `tests/harness/**` | 2 | yes | 24 | task 0b: keeps the browser dev harness (`npm run harness`) alive under the ordinary suite — pins the three-stylesheet load order, that `/styles.css` is served from `src/ui/styles.css` on disk rather than a build, the fixture's shape and determinism, and that scheme classes land on `<body>` and nothing else. Not a screenshot test: nothing here asserts what gets drawn, and headless-browser drawing is out of jsdom's reach — see the harness task's own report for what step 10 saw with real eyes. WP-03 Part 1 extends the fixture's synthetic report with relation evidence (N38) |
| Build | `tests/build/**` | 1 | yes | 12 | task 0c: pins `scripts/harness-shot.mjs`'s `SHOTS` coverage (all seven city screens, including S11's two distinct entry paths -- the list-only fallback and a genuine WebGL failure) and `scripts/chromium.mjs`'s own browser-resolution rule (`executablePath()`, asked of playwright-core, never a hand-mirrored per-platform path). Not a screenshot test itself -- see the task's own report for what `npm run harness-shot` produced with real eyes. WP-03 Part 1 adds the six new `wp03-*` and four re-framed `wp02-*` capture ids to the pinned coverage |
| Real fallow (opt-in) | `tests/fallow-real/**` | 2 | opt-in (`npm run test:fallow`), never in `npm run test` | 0 | Part 7 Z40/Z41: ten tests against the real, pinned fallow 3.27.0 (or `FALLOW_BIN`): native-binary inspection, the version probe, fixture fidelity, the fs-diff side-effect proof with its `.fallow/` control, the bad-root error, `--fail-on-issues` exit 1, the time limit, cancel and the stdout cap; WP-03 Part 1 (N36) adds a sibling file's eleventh test against the relations fixture project (J16). Its eleven tests are not part of the living suite this table totals, so its Tests cell is 0; the run is recorded in the WP-03 Part 1 section above and in G6 above |
<!-- g8:table:end -->

| Layer | Ran | Notes |
|---|---|---|
| Accessibility | **partly — G4/G7 remain OPEN** | the jsdom rows ran and are listed in `2026-09-17-wp01-accessibility-matrix.md`; **every manual row is NOT PERFORMED.** This layer has no test-count row above because it is not a directory of tests — it is a checklist a human has not yet worked. See the G4/G7 status block at the top of this document |

### Three honesty notes about the suite itself

**One guard in `ScanCoordinator` is unreachable by construction, and no test can kill
it.** `scan-coordinator.ts`'s `if (!mayPublish(resultIdentity, currentIdentity, …))` —
the identity-tuple check that refuses a late result — cannot fail within a single
coordinator in WP-01's design, and therefore nothing in the suite distinguishes a
coordinator that consults it from one that ignores it. Disabling it outright
(`if (false && !mayPublish(…))`) leaves every acceptance test green, and every test in
the four run-lifecycle suites green with them. That was true before fix round 1 and it is still true after it.

The reason is structural, not a coverage gap, and it rests on **exactly two legs** — the
re-review corrected an earlier, larger statement of this, and the correction matters
because a smaller argument is a more fragile one:

- **(a) `SCAN_STARTED` no-ops while a run is running or cancelling**, so no second run can
  become current while this one is in flight, and both identities derive from the same
  stored approval. *Pinned behaviourally* by `tests/unit/run-state.test.ts`'s "treats a
  duplicate start during a run as a no-op" — break it and a test reddens.
- **(b) There is no yield point** between the second `wasCancelled` check and the guard:
  `validateSnapshot` is pure and synchronous and the identity construction between them
  is too, so nothing can advance the lifecycle in between. *Pinned by
  `tests/unit/gate-evidence.test.ts`'s yield-point tripwire* (fix round 2) — which strips
  `//` comments before scanning, because this branch has already shipped a
  source-as-contract test that passed with its own defect reinstated when a comment
  truncated the parsed region.

"One `ScanCoordinator` per `CityView`" is **not** a third leg and must not be cited as
one: a second coordinator describes its own run, so `mayPublish` correctly returns *true*
and that run publishes into its own leaf — which is right, because the SnapshotStore is
keyed by `snapshotId` and nothing is overwritten.

**The tripwire is not coverage.** It does not test that publication is refused; it tests
that the reason we say publication cannot *need* refusing is still true. When it fails,
exactly one of two things must happen: an acceptance test that kills the guard, or a
correction to this note, `tests/acceptance/wp01.feature`'s header and
`tests/acceptance/steps/source-steps.ts`'s comment. Deleting the tripwire is not one of
the two.

It is kept, not removed: it is spec §7's rule written down at the point of publication,
and the moment more than one coordinator can race for one profile it stops being
redundant. But it is defence in depth, **it is not what makes cross-profile publication
safe today**, and a reader must not take its presence as evidence that the property is
tested. What IS tested, end to end and killed by mutation, is the guard that really does
the work: `view-reconciliation.ts`'s profile check, reached through `city-view.ts`'s own
`reconcileEveryView` fan-out — see the acceptance scenario "Reject late result
publication across profiles", and `tests/acceptance/steps/source-steps.ts`'s own comment
for the full reasoning. Removing that check reddens the scenario immediately.



**Stylesheet-as-contract tests strip CSS comments.** A test of this kind on this branch
once passed with its own defect reinstated, because a CSS comment quoting
`button { height: var(--input-height) }` truncated the parsed rule — the comment's braces
ended the match — and only a mutation check caught it. `tests/unit/host-cascade.test.ts`
and `tests/unit/layout-budget.test.ts` strip comments before parsing. Task 12 wrote no new
stylesheet-reading test.

**`npm run analyze` is a review list, not a pass/fail gate, and it is not part of
`npm run verify`.** It runs `fallow dead-code src`, and what it reports is **exported
symbols with no known consumer anywhere the tool can resolve one — `tests/` included**.

**It does NOT implement question 1 of this branch's dead-surface sweep, and an earlier
version of this paragraph said it did.** Question 1 is "does anything in **`src/`** — not
`tests/` — call this?", and scoping fallow's *scan* to `src/` does not stop it resolving
*consumers* in `tests/`. The final whole-branch review proved it: `parseEntityId`
(`src/domain/entity-id.ts`) and `COPY_10` (`src/ui/copy.ts`) each have **zero** `src/`
consumers and neither is reported, because each is imported by a test. So a symbol that
only tests use — precisely the shape this branch's defect class takes — is invisible
here. **Question 1 is answered by review, not by tooling**, on this branch and at this
commit; nothing standing implements it, and a reader of this document must not take
`analyze` as the instrument. That matters out of proportion to its size, because the
review methodology recorded throughout this document rests on question 1.

**Accepted baseline at this commit: 9 findings** — 5 unused exports, 1 unused type,
1 unused class member, 1 duplicate export pair, 1 circular dependency. The count is
recorded here (review M4) precisely because this gate exits non-zero permanently by
design: without a baseline, a TENTH finding is indistinguishable from the nine
already assessed. Each one:

| Finding | Assessment |
|---|---|
| `districts.ts` `LOT_FOOTPRINT`, `MAX_DIRECT_SUBDISTRICTS`; `picking.ts` `DRAG_THRESHOLD_CSS_PX`; `work-items.ts` `entityPath` | used inside their own modules and named by their tests (`layout-districts`, `layout-determinism`, `ui-steps`, `review-state`), which cite them in comments; no test imports them. The WP-02 polish pass (X1) un-exported the three that no test named (`UNAVAILABLE_FOOTPRINT`, `HOVER_DWELL_MS`, `SCALE_NAME`), with the other module-local helpers the tool flagged. Accepted. |
| `node-access.ts` `fs` | the single Node seam; `fsPromises` is derived from it and `tests/unit/node-access-boundary.test.ts` asserts this file is the only one in `src/` that reaches Node. Accepted. |
| `model.ts` type `SourceReference` | named by spec §4.1's **frozen** implemented-types list. Only the user may change a §4 contract. Accepted, and must not be "cleaned up". |
| `renderer-port.ts` `EntityId` duplicating `entity-id.ts` | both are inside frozen §4.2/§4.1 contracts. Accepted. |
| `city-view.ts → leaf-registry.ts → city-view.ts` cycle | pre-existing and structural (the registry reaches views; views ask the registry to reconcile siblings). Not touched by task 12. |
| **`ScanCoordinator.getLifecycle`** | **no caller; kept as public coordinator surface.** Nothing in `src/` *or* `tests/` calls it: `tests/acceptance/steps/evidence-steps.ts` names it only in comments. It is an inert accessor, not a fake feature, so it is not instance 10 of the branch's defect class. The WP-02 polish pass kept it (polish QF5, correcting L10). Accepted. |

**`analyze` fetches its tool at run time, deliberately.** `npx --yes fallow@3.27.0`
pins the exact version but is not a devDependency, so the gate needs network and
resolves outside `package-lock.json`'s integrity guarantees (review M4). That is a
real trade and it was made knowingly: fallow ships per-platform prebuilt binaries, so
adding it would put an optional-dependency matrix and a large download into every
`npm ci` on every platform, for a tool this project runs occasionally and never in
CI's critical path. The version pin is what keeps the RESULT reproducible. If the
user would rather pay the install cost for lockfile integrity, the change is one line
in `package.json` plus a lockfile update.

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

---

## Numbers in this document

Read this before quoting a figure from here. Every count in this document falls into one
of the kinds enumerated below, and which kind a number is decides how much weight it will
bear. (The kinds are not tallied in this sentence on purpose: a hand-typed count beside
an enumeration is the exact defect this document has been corrected for four times, and
nothing derives a tally of this one.)

**DERIVED — a stale value reddens a test.** `tests/unit/evidence-numbers.test.ts` and
`tests/unit/gate-evidence.test.ts` read this file and the accessibility matrix — and,
since task 13, the two release documents `2026-09-17-wp01-implementation-report.md` and
`2026-09-17-wp01-limitations.md`, which restate these counts and are swept exactly as
these two are, each required to state the figure somewhere the sweep can read it — and
check these against the suite and against the matrix itself:

- the accessibility row counts, **everywhere ANY of the four documents states them in one
  of the shapes the guard reads** — the total, the open count, the fully-PASSED count and
  the half-passed count, positively at every site and negatively against every value they
  are not. Four documents, not two: this one, the matrix, and task 13's implementation
  report and limitations document. The fully-PASSED and half-passed counts were swept in
  the matrix ALONE until the final fix wave, while both release documents declared them
  DERIVED — rewriting the limitations document to claim six fully-passed rows left the
  suite green, a six-fold overstatement of accessibility. The shapes, and what falls
  outside them, are named at the end of this block;
- the length of the GATE STATUS outstanding-rows enumeration, against the open count;
- the G8 layer set, and each layer's **file** count, against `tests/` on disk;
- the G8 table's own text, against the copy of it in the implementation report —
  `tests/host/clean-vault-install.test.ts` asserts the two slices are identical, so the
  copy cannot drift from this original even though the per-layer counts inside it are
  transcribed;
- the sum of the G8 table's per-layer test counts, against the total in its heading;
- the G8 heading's **passed/skipped split**, against the test total in the same heading —
  the split must add up, or one of the two was retyped without the other;
- every per-file test count cited in prose, against that file's own `it(` blocks;
- the acceptance scenario counts, against `tests/acceptance/wp01.feature`;
- the `src/` file floor in the G2 structural sweep, against `src/` on disk;
- the `npm run analyze` baseline's parts, against the total it claims;
- the contract suite's **twenty obligations**, against the contracts layer's own test
  count — one suite run against two implementations, so the layer must be exactly
  twice the obligations;
- the yield-point invariant the `mayPublish` note depends on, against
  `src/application/scan-coordinator.ts` itself.

**TRANSCRIBED — reproduce with the command named beside them; no test can check these.**

- The **per-layer test counts** in the G8 table. Vitest exposes no whole-suite tally to a
  test inside that suite, and static counting is wrong where a runner generates tests from
  a loop. Their *sum* is pinned; a uniformly stale set is the named residual. Re-take with
  `npx vitest run <directory>`.
- Every **G5 benchmark figure** — timings, lots, districts, clamped values. They come from
  `tests/benchmarks/city-benchmark.test.ts`, which writes
  `<tmpdir>/codebase-inspector-benchmark/results.json`; that file is outside the
  repository by design, so nothing here can compare against it.
- The **fixture entity counts** in G2's no-write table (1,000 generated files, 1,004
  collected entities). They come from the same generator the benchmark uses and are
  asserted inside `tests/integration/no-source-writes.test.ts` as bounds, not
  compared against this document.
- **Which** test is skipped, in the G8 heading's one skip. That the split adds up is
  derived (above); which test the runner skipped is a fact of the run, not of the
  repository, and no test inside the suite can read it. Re-take with `npx vitest run`.
- The **reference hardware** rows, which describe a machine.
- The `npm run analyze` **total of 9**. Its internal breakdown is checked, but the figure
  itself needs the tool, which is not part of `npm run verify` and needs network.
- The **living suite's own totals**, now the same figures as the G8 heading itself since
  the WP-03 Part 1 refresh closed the two-vintage gap (269 files, 2959 tests, 2958
  passed, 1 skipped). Nothing in the suite can assert its own whole-run tally from
  inside itself, for the same reason the per-layer test counts are transcribed rather
  than derived. Re-take with `npx vitest run --reporter=dot`.

**NEITHER — prose.** Version numbers, spec section numbers, ruling numbers, COPY ids,
defect numbers, dates and checkpoint numbers are identifiers, not counts. They are not
swept, and a reader should not treat them as measured.

This block exists because the same count was found wrong three separate times, each in a
place the previous fix had not read. The guard enumerates the *wrong values* rather than
the *known sites*, so a figure written into a section nobody has thought of fails — **as
long as it is written in one of the four shapes named below.** The boundary is stated here rather than left
to be discovered, because the previous version of this paragraph claimed no boundary at
all while half the mechanism it described was inert.

**Shape 1 — "N of the 14".** Reserved, by the matrix's own convention, for claims about
OPEN rows. Any spelling, any emphasis, any of the four documents, anywhere.

**Shape 2 — the open count immediately beside an openness word:** "…outstanding rows",
"…rows remain open", "…remains open" and their close neighbours. Adjacency is the point:
the sweep will not vet a number separated from what it counts by an intervening noun,
because this document says "Four questions remain open" about something else entirely,
and a sweep that reddens on a true sentence gets deleted.

**Shape 3 — the fully-PASSED count before "fully PASSED":** "N row is fully PASSED",
"N rows are fully PASSED", "N is fully PASSED". Any spelling, any of the four documents.

**Shape 4 — the half-passed count before "a PASSED jsdom half":** "N more rows have a
PASSED jsdom half", "N more have a PASSED jsdom half". Shapes 3 and 4 need no negative
family: a site matching either shape is READ, so a wrong numeral inside one fails on the
spot rather than having to be enumerated. What escapes them is (a) below, exactly as for
shapes 1 and 2.

**What still escapes, named.** Lettered and listed in full, so that a reader of this block
— task 13's release gate among them — can see the edge of the guarantee rather than infer
it from silence. (No count of them is given here on purpose: a tally beside an enumeration
is exactly the kind of retyped figure this document keeps getting wrong, and this one is
not derived by anything.) Each is a **silent skip**: the sweep does not recognise the
sentence as a claim at all, so it neither reads the number nor reports that it declined to.

**(a) A restatement in neither shape.** The same fact, in the same words, reordered so the
numeral no longer sits beside either anchor. A re-review demonstrated exactly that. It is
not fixed by adding more phrases; it is the reason the convention above exists.

**(b) A restatement that gets the TOTAL wrong.** The positive sweep reads the *second*
number first, and treats a figure that is not the matrix's own total as "not a claim about
this matrix" — so it skips the sentence rather than failing on it. Every negative family is
built around the true total, so none of them covers the case either. A sentence pairing any
open count with a wrong total therefore passes both sweeps in silence. This is narrow: the
total moves only when the table moves, and the table is what both sweeps derive from. It is
named because it is the one case where a wrong number is *skipped* rather than read.

**(c) A count written with underscore emphasis.** Both sweeps read these documents with
asterisks and backticks stripped and nothing else, so a bolded numeral and a bare one are
the same string to them — but an underscore-emphasised one is not, and is invisible to
both. None of the four documents uses underscore emphasis for anything today (the only
underscores in them are inside identifiers), and that convention is the whole of the
mitigation. **Use asterisks for emphasis in all four of these files.**

**(a) and (c) apply to all four counts, not just the open one**: a restatement in none of
the four shapes, and underscore emphasis, are each as invisible for "fully PASSED" as for
"N of the 14". **(b) does NOT** — it is an artefact of shape 1 carrying a total the sweep
has to recognise, and shapes 3 and 4 carry no total at all, so a site matching either of
them is read whatever numbers sit around it. An earlier version of this sentence said all
three applied to all four, contradicting (b) six lines above it.

**State these counts in one of the four shapes, with asterisk emphasis, against the
matrix's own total**, and the guard will tell you when you get one wrong. If you find another way to
escape it, add it to this list — the list being complete is what makes it useful.

---

## WP-03 Part 1 — dependency evidence from fallow (N39)

Recorded by task 15 at branch `feat/wp-03-part1`, base `2bb64d5`; design in
`docs/superpowers/specs/2026-09-24-wp03-part1-dependencies-design.md` (N1–N40). Part 1
delivers `docs/deliverables/Dependencies and Architecture.md` from the relation evidence
fallow already documents — cycles, re-export cycles, boundary violations, unresolved
imports and per-file fan-in/fan-out — inside the same combined report every collected run
or imported report carries. It adds no process, no argv and no trust change: the run
argv, spawn options and process guards from WP-02 Part 7 are untouched
(`tests/unit/fallow-argv-policy.test.ts`, below).

### The deliverable's acceptance, item by item (spec §5)

| Acceptance item | Evidence |
|---|---|
| Hand-authored directed fixtures verify incoming/outgoing queries | `tests/unit/relation-queries.test.ts`, `describe('neighbourhood (N17)')`: "out, 1 hop", "in, 1 hop", "both orders hop, then out before in, then the other end", "2 hops continues in the same direction and never back through the node", "limit keeps the first n and counts the rest as hidden" |
| … cycles | `tests/unit/relation-queries.test.ts`, `describe('stronglyConnected (N18)')`: "keeps groups of more than one node; overlapping cycles form one group"; `tests/unit/normalize-relations.test.ts`: "reports the core 3-file cycle, files in fallow's order, hops[i] = files[i] -> files[(i+1)%n] with the recorded line" |
| … disconnected files | `tests/unit/relation-queries.test.ts`: "a disconnected node has an empty neighbourhood"; `tests/component/file-relations.test.ts`: "a file with no evidenced edge reads RELATIONS_NONE_FOR_FILE, never \"no imports\"" — the relations fixture's own `src/orphan.ts` (`tests/fixtures/fallow/README.md`'s "Relations project", N34) is disconnected, imported by nothing |
| … type-only edges where available | The relations fixture's `src/ui/view.ts` carries both a type-only import (`import type { Row } from '../data/types'`, allowed under the fixture's `.fallowrc.json` `allowTypeOnly`) and a regular one that violates the boundary; `tests/unit/normalize-relations.test.ts`: "reports the one boundary violation, anchored on the importing file" pins that only the regular import is reported — fallow documents no per-edge type-only flag, so the type-only one is invisible to the normaliser rather than excluded by it (limitation, §6 below) |
| … boundary rules | `tests/unit/normalize-relations.test.ts`: "gives a BV- finding anchored on the importing file, at the recorded line, with related: [to]"; `tests/component/architecture-edges.test.ts`, `describe('Architecture: Configured in fallow (WP-03 N24)')`: "lists fallow's recorded violation under the rules, with Review finding" |
| … aggregation | `tests/unit/relation-queries.test.ts`, `describe('aggregateEdges (N19)')`: "counts distinct file edges between different groups"; `tests/unit/architecture-relations.test.ts`, `describe('module edges (N19, N20)')`: "is the one cross-module matched edge, ui -> data, collected; core has no self-edge" (the Map); `describe('cards (N18, N20)')` for the Matrix's own edge counts |
| Edge drill-down resolves to real evidence | `tests/component/architecture-edges.test.ts`: "From opens File detail on the importing file"; `tests/component/quality-relations.test.ts`: "a boundary finding's dialog lists its \"to\" file" |
| Dense graphs remain navigable with explicit truncation | `tests/benchmarks/relations-budget.test.ts`: "the Edges tab stays navigable: EDGE_LIST_LIMIT rows, EDGE_LIST_HIDDEN(edges - 200)"; "the city Relations section stays navigable: RELATION_ARC_LIMIT rows on the hub, hidden > 0" (N33, N37; medians below) |
| Static coupling is not presented as proof of runtime execution or inevitable breakage | `RELATIONS_STATIC_NOTE` on the Edges tab and the Relations section; `tests/unit/relation-copy-claims.test.ts`: "no line claims code \"calls\" or \"executes\", or that a change \"will break\", except RELATIONS_STATIC_NOTE's own sentence" — a sweep of `src/ui/audit-copy/relations.ts` |
| Selection-based edges, not a hairball | `tests/unit/city-relations.test.ts`: "no selection gives no arcs; a file without evidenced edges gives no rows and no arcs to draw"; `tests/component/relation-arcs.test.ts`, `describe('relation-arcs: geometry (N29)')` draws only the arcs it is sent — there is no "show all" |
| Cap visible edges and state the hidden count | 24 in the city — `tests/unit/city-relations.test.ts`: "long cycle: 30 hops highlighted give the first 24 arcs and highlightHidden 6"; 200 in the Edges tab — `tests/component/architecture-edges.test.ts`: "shows at most 200 rows and says how many more are not shown"; 64 in the renderer — `tests/component/relation-arcs.test.ts`: "caps drawing at MAX_RELATION_ARCS" |
| Separate highlight for a selected cycle, with its path in text | `tests/component/relation-arcs.test.ts`: "colours each arc by its own role" (the `cycle` role); `tests/unit/relation-model.test.ts`, `describe('cyclePathText')`: "joins each hop's from with its line, \":?\" for a null line, closing back on the first from"; `tests/component/architecture-cycles.test.ts`: "selecting a cycle highlights the Map edges between its modules and shows its path in the inspector column"; `tests/component/city-relations-panel.test.ts`: "shows its controls, the two rows with their lines, the cycle with a Highlight toggle, and both notes" |
| A 2D/list alternative with keyboard access | `tests/component/architecture-edges.test.ts` (the Edges tab, native buttons); `tests/component/city-relations-panel.test.ts` (the Relations list, native buttons); the canvas stays `aria-hidden` (carried from WP-01 G4) |
| Selected relations stay in each leaf; sharing does not move another leaf's camera | `tests/component/city-relations-panel.test.ts`, `describe('the relations store, one per leaf (N31)')`: "changing leaf A's direction leaves leaf B's store at both, and B's camera unchanged" |
| Not called an Obsidian backlink | `tests/unit/relation-copy-claims.test.ts`: "never calls a source-code relationship an Obsidian backlink" — a sweep of `src/ui/audit-copy/relations.ts` |
| Record unresolved/missing nodes and graph scope instead of silently discarding edges | unresolved imports — `tests/component/architecture-edges.test.ts`: "lists unresolved imports below the table, never as rows, with both notes"; unmatched edges — `tests/unit/relation-model.test.ts`, `describe('unmatched members (N7)')`: "keeps the cycle with matched: false and the unmatched member's id null"; `RELATIONS_SCOPE_NOTE` everywhere — `tests/component/file-relations.test.ts`: "always shows the RELATIONS_SCOPE_NOTE, with or without a report" |
| Do not assume an undocumented `viz --format json`, and do not scrape fallow's HTML | `tests/unit/fallow-argv-policy.test.ts`: "builds exactly two argument lists"; "has no install, fix, init, setup, watch or failing-flag word as a string in the fallow code" — the reader reads only the documented combined-report fields (`fallow-report-schema.ts`), never `fallow viz` |

### Benchmark medians (Task 13, N33/N37)

`npx vitest run tests/benchmarks/relations-budget.test.ts` writes
`<tmpdir>/codebase-inspector-benchmark/relations.json` on every run, over a deterministic
fixture of 5,000 files, 2,000 evidenced edges and 200 cycles:

| Stage | Median | Budget |
|---|---|---|
| `relationModelFor` (a fresh `EvidenceIndex`, bypassing every memo) | 3.08 ms | under 50 ms |
| `neighbourhood(both, 2 hops, limit 24)` on the hub file | 0.58 ms | under 2 ms |
| `aggregateEdges` to 12 modules | 0.59 ms | under 10 ms |
| `createRelationArcs().setArcs(64 arcs)` on the 5,000-lot layout | 0.54 ms | under 8 ms |

Recorded 2026-09-24, Node v24.15.0, `win32 x64` (the same reference machine as G5). These
are structural CPU timings under jsdom, not GPU measurements — the same caveat as G5's
benchmark applies.

### `npm run test:fallow`, extended with the relations fixture (N36)

G6 recorded `npm run test:fallow` against `tests/fallow-real/fallow-real.test.ts` alone.
Task 6/13 added a sibling file (J16) that runs the same real, pinned fallow 3.27.0 against
a temporary copy of the relations fixture project
(`tests/fixtures/fallow/relations-project`, N34) through the production runner and the
production parse-and-normalise pipeline, and asserts the exact relation facts recorded in
that fixture's README: two import cycles (the core three files and the barrel pair), the
barrel pair's re-export cycle, the one boundary violation and the one unresolved import —
and a whole-tree hash of the copied project taken before and after the run, compared for
equality, so the fs-diff result is the same kind of proof G6's own no-write table uses.

```
FALLOW_BIN="$LOCALAPPDATA/npm-cache/_npx/ee3f2ca80543beb5/node_modules/@fallow-cli/win32-x64-msvc/fallow.exe" npm run test:fallow

npm notice run codebase-inspector@0.1.0 test:fallow
npm notice run node scripts/fetch-fallow.mjs && vitest run --config vitest.fallow.config.ts
fetch-fallow: FALLOW_BIN=C:\Users\LuisMendez\AppData\Local\npm-cache\_npx\ee3f2ca80543beb5\node_modules\@fallow-cli\win32-x64-msvc\fallow.exe; nothing fetched.

 RUN  v5.0.1 C:/Projects/codebase-inspector/.claude/worktrees/wp-03-part1

[fallow-real] C:\Users\LuisMendez\AppData\Local\npm-cache\_npx\ee3f2ca80543beb5\node_modules\@fallow-cli\win32-x64-msvc\fallow.exe on win32: {"ok":true,"version":"3.27.0","tested":true}

 Test Files  2 passed (2)
      Tests  11 passed (11)
   Start at  20:12:03
   Duration  8.77s (tests 92%, transform 4%, import 4%)
```

Binary: `C:\Users\LuisMendez\AppData\Local\npm-cache\_npx\ee3f2ca80543beb5\node_modules\@fallow-cli\win32-x64-msvc\fallow.exe`.
Version: **3.27.0**. Platform: **win32**. All eleven tests pass across the two files: the
original ten (G6) plus the relations project's one — "reports the recorded cycle,
re-export cycle, violation and unresolved import, and writes nothing under the root" —
whose fs-diff is **0 differences**, exactly as the fixture's own hash-before/hash-after
comparison in G6's no-write table.

### Harness captures (Task 14, N38)

`npm run harness-shot` produces every id `scripts/harness-shot.mjs`'s `SHOTS` names,
verified by `tests/build/harness-shot.test.ts`. WP-03 Part 1 adds six new captures and
re-frames four existing WP-02 ones now that the synthetic demo report
(`tests/fixtures/evidence-report.ts`) carries real relation evidence rather than empty
relation arrays:

**New (`wp03-*`):**
- `wp03-city-relations-dark` / `wp03-city-relations-light` — the city inspector's
  Relations section, at `select=dir-4/file-4.ts` (`demoRelationsAnchorPath`, a member of
  the demo report's import cycle)
- `wp03-city-cycle-dark` — the same view with a cycle highlighted (`relations=cycle`)
- `wp03-architecture-cycles-dark` / `wp03-architecture-edges-dark` /
  `wp03-architecture-rules-dark` — the Architecture screen's three new tabs

**Re-framed (`wp02-*`, execution ruling, N38):**
- `wp02-architecture-dark` / `-light` / `-narrow-dark` — captured with `&report=demo`
  added to the query. `read-models/architecture.ts` now builds its graph only from real
  relation evidence (`sample-module-edges.ts` is deleted, N20); without a report these
  three drew real module nodes but zero edges. Task 14 is the first task where the
  synthetic report carries cycle and boundary evidence for `report=demo` to show
- `wp02-quality-fallow-dark` — re-captured with the same query. `findings.ts`'s Structure
  card (`QUALITY_CARD_STRUCTURE`, N13) now has a non-zero cycle/boundary/unresolved-import
  count to show; every earlier capture of this screen showed Structure as a real 0

All ten (six new, four re-framed) were produced by the `npm run harness-shot` run this
task recorded, alongside every pre-existing capture — see the G8 counts below for the
full run.

---

## WP-03 Part 1 polish — PO1, PO2, the gating, the highlight, the arrow

Recorded by task 4 at branch `feat/wp-03-part1-polish`, base `6419392`; rulings in
`docs/superpowers/notes/2026-09-25-wp03-part1-polish-ledger.md` (PO1, PO2, JP1–JP8). This
pass amends the WP-03 Part 1 section above at three narrow points and closes the Task 9
and Task 13 deferred minors it left behind; it adds no process, no argv and no trust
change.

### What changed

- **PO1 — the violations card is fallow's own count, never added to your rules (amends
  N20, WP-03 E8/E24).** `violationsValue` (`src/ui/read-models/architecture.ts`) now
  returns fallow's own reported boundary-violation count alone, captioned "Reported by
  fallow". A fifth Architecture card, **Your rules violated**, carries the count of your
  own violated rules independently (`unknown` with no rules or nothing analysed, else the
  count). The Report and its Markdown export pick up both cards with no code change, since
  they already iterate the card list generically by label and value (commit `a03f836`).
- **PO2 — "Violations only" and the marked edges union your rules with fallow's boundary
  module pairs (amends WP-03 E26's "Violations only" item).** `violatingEdgeKeys` is now
  the union of your violated rule pairs and `edgeKey(moduleOf(fromPath), moduleOf(toPath))`
  for every relation edge sourced from a boundary violation, so the Map, the Matrix, the
  Edges filter and the edge inspector's "This edge breaks a boundary rule." all agree
  (commit `a03f836`). A same-module fallow violation keys the diagonal harmlessly:
  `aggregateEdges` already drops same-group pairs before a Map self-edge could be drawn,
  and the Matrix's diagonal cell takes its own "Same module" branch before consulting
  `violating` — no component change was needed for that case.
- **The Task 9 deferred minor — Edges, Map and Matrix gate on any analysed edge category,
  not on cycles alone.** A new `edgesAnalysed` gate
  (`relations.state !== 'none' && (relations.analysed || relations.boundaries ===
  'configured')`) now drives `ArchitectureModel.notAnalysed`, so a report with boundary
  violations but no cycle arrays still shows those boundary edges on the Edges tab, the
  Map and the Matrix. A separate `cyclesNotAnalysed` keeps the old cycle-only formula for
  the Cycles tab and the cycles card, which still read "not analysed" in that case. The
  evidenced-imports card reads `partial` with `RELATION_CYCLES_NOT_REPORTED` there — never
  `collected`, never `unknown` (commit `9e22b09`).
- **The Task 9 deferred minor — the EdgeList direction note is pinned.** "No module is
  selected, so Direction does not filter." / "Outgoing and Incoming are relative to
  {module}." was proved by mounting `EdgeList.vue` directly with `selectedModule: null`
  and `selectedModule: 'ui'`, and by a mutation of the ternary at `EdgeList.vue:99` (fix
  round 1 of Task 2), since `ArchitectureScreen`'s selection composable auto-selects the
  first module on mount and the no-module branch is otherwise unreachable through a full
  mount (commit `9e22b09`).
- **E26's kept highlight — a re-import that drops the highlighted cycle clears it.** A
  third watcher in `src/ui/stores/relations-store.ts` clears `highlightedCycleId` when the
  freshly imported report's normalised cycles no longer carry that finding id (a content
  hash, JP6), and leaves it alone — same id, same cycle — when a re-import keeps it. The
  two existing watchers (repository/report-removed reset, selection-clears-highlight) are
  unchanged (commit `25c0840`).
- **The arrow wrap.** `.ci-city-relations__path` gained `flex: 1 1 0; min-width: 0;`
  (`src/ui/styles/screens-explore.css`) so the direction glyph (`→`/`←`) stays on the same
  line as the path it marks; only the longer continuation and the source label wrap below
  it. Confirmed by reading `harness-shots/wp03-city-relations-dark.png` (not committed —
  `harness-shots/` is git-ignored) (commit `25c0840`).

### The Task 13 deferred minor — benchmark mutation runs

`tests/benchmarks/relations-budget.test.ts` pins three truncation caps behaviourally but,
before this task, none of the three had ever been shown RED: the test imports each
constant from the same module the production code reads, so a plain mutation of the
constant's value is self-consistent and cannot fail the assertion that reads it back. Each
cap was proved live by mutating it in `src`, running
`npx vitest run tests/benchmarks/relations-budget.test.ts`, capturing the failure, then
restoring the file exactly with Edit — confirmed each time and at the end by an empty
`git diff --stat -- src`.

**`EDGE_LIST_LIMIT`** (`src/ui/screens/architecture/use-architecture-selection.ts`, 200).
A first mutation to 300 (still below `TOTAL_EDGES` = 2,000) **survived** — the test's own
`expect(rows).toHaveLength(EDGE_LIST_LIMIT)` reads the same live constant it is checking,
so any value under 2,000 is self-consistently satisfied and the assertion is not, on its
own, proof that a limit is enforced. Strengthened by mutating past the fixture's edge
count instead (2,500 > `TOTAL_EDGES`), which exposes the real cap: the DOM cannot render
more rows than there are filtered edges (2,000), so a limit set above the data no longer
matches what is actually shown.

```
FAIL  |jsdom| tests/benchmarks/relations-budget.test.ts > relations budget — 5,000 files, 2,000 evidenced edges, 200 cycles (N33, N37) > the Edges tab stays navigable: EDGE_LIST_LIMIT rows, EDGE_LIST_HIDDEN(edges - 200)
AssertionError: expected [ DOMWrapper{ …(3) }, …(1999) ] to have a length of 2500 but got 2000
 ❯ tests/benchmarks/relations-budget.test.ts:219:18
    217|     });
    218|     const rows = w.findAll('.ci-edge-list .ci-table__row');
    219|     expect(rows).toHaveLength(EDGE_LIST_LIMIT);
Tests  1 failed | 5 passed (6)
```

**`RELATION_ARC_LIMIT`** (`src/ui/read-models/relations.ts`, 24). Mutated to 5,000 (above
the hub's evidenced neighbourhood):

```
FAIL  |jsdom| tests/benchmarks/relations-budget.test.ts > … > neighbourhood(both, 2 hops, limit 24) on the hub file is under 2 ms (median), with hidden > 0
AssertionError: expected 0 to be greater than 0
 ❯ tests/benchmarks/relations-budget.test.ts:186:37
    186|     expect(hubNeighbourhood.hidden).toBeGreaterThan(0);

FAIL  |jsdom| tests/benchmarks/relations-budget.test.ts > … > the city Relations section stays navigable: RELATION_ARC_LIMIT rows on the hub, hidden > 0
AssertionError: expected [ Array(904) ] to have a length of 5000 but got 904
 ❯ tests/benchmarks/relations-budget.test.ts:226:23
    226|     expect(view.rows).toHaveLength(RELATION_ARC_LIMIT);
Tests  2 failed | 4 passed (6)
```

**The arc cap, `MAX_RELATION_ARCS`** (`src/visualization/relation-arcs.ts`, 64). Mutated
to 32:

```
FAIL  |jsdom| tests/benchmarks/relations-budget.test.ts > … > createRelationArcs().setArcs(64 arcs) on the 5,000-lot layout is under 8 ms (median)
AssertionError: expected 32 to be 64
 ❯ tests/benchmarks/relations-budget.test.ts:207:39
    207|     expect(relationArcs.drawnCount()).toBe(64);
Tests  1 failed | 5 passed (6)
```

**Restore, each time.** `git diff --stat -- src` gave no output after each individual
restore and after all three. GREEN, all six tests, after the final restore:

```
npx vitest run tests/benchmarks/relations-budget.test.ts

 Test Files  1 passed (1)
      Tests  6 passed (6)
```

No test file was edited to strengthen the `EDGE_LIST_LIMIT` case — the existing
assertion was proved sufficient once mutated past the data size rather than within it; the
brief's "or strengthen it" path was not needed.
