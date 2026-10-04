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
reads every `.ts`/`.vue` file under `src/` (355+ files, count asserted so the sweep cannot
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

Refreshed once more by the final whole-branch review's fix wave (2026-09-25, following
the same rule): Minor 1 (the cycles card's caption) and Minor 7 (`ARCH_RULES_NONE_REASON`)
added no test, only changed what existing ones expect; Minor 4 (the Report/Markdown split)
added ONE test, inside `tests/unit/report-model.test.ts`; Minor 5 replaced a vacuous
assertion inside an existing `tests/component/city-relations-panel.test.ts` test, adding
no case; Important 1 extended an existing `tests/component/architecture-cycles.test.ts`
case. No new test file. `npm run test` (267 files, 2960 tests, 2959 passed, 1 skipped) and
`npx vitest run tests/unit` (135 files, 1734 tests) refreshed the Unit row and the
heading; `npx vitest run tests/component` (92 files, 902 tests, unchanged) confirmed the
Component row needed no change. No other layer's files changed, so their rows stand as
task 15 took them.

Refreshed once more by **WP-04 Part 1** (2026-09-26, task 18, the same L28 rule: the
evidence-note counts are updated once, in the final task). Tasks 0–17 add test files across
seven layers — 17 in `tests/unit/` (the native harness's own unit tests plus the
application-layer investigation suites: `note-text`, `note-path`, `note-model`,
`note-index`, `root-path`, `source-preview`, `stale-location`, `evidence`,
`evidence-splice`, `model`, `store`, `store-ports`, `folder-store`, `fake-vault`,
`session-lifecycle`, `native-results-gate`, `native-baseline`), 3 in `tests/host/`
(`investigation-notes`, `investigation-note-index`, `investigation-ports`), 13 in
`tests/component/` (the Investigate screen, its dialogs and panels, the city Findings
panel, the Settings notes-folder row, and the work-item-editor draft), 2 in
`tests/acceptance/` (the in-memory spine and the safety cases, IN38/IN39) and 1 in
`tests/integration/` (`investigation-preview-real`) — plus new cases inside two existing
`tests/harness/` and `tests/build/` files (no new file in either). `npm run test` (303
files, 3439 tests) and the per-layer re-runs below refreshed every row, the totals and the
heading; the Contract and Benchmark rows are unchanged (WP-04 Part 1 touches neither
directory). The native layer (`tests/e2e/`, `tests/support/`) adds no G8 row: IP53 keeps
native cases out of this table, because they are opt-in and local-only, and its two
`tests/unit/` files are already counted in the Unit row above. The native run itself —
`npm run test:e2e`, both at the baseline version and at `OBSIDIAN_VERSION=latest` — is
recorded in the **WP-04 Part 1** section below, in its own **native acceptance**
subsection.

The final whole-branch review's fix wave (2026-09-26) adds one more component file,
`investigate-create-review.test.ts` (finding 8: a create refusal that lands after its
dialog closed — the same codebase, the selection moved off the finding — is now announced
through the live region, same as refresh's E24), 2 tests. `npm run test` becomes 304
files, 3441 tests, and the per-layer re-runs below refreshed the Component row, the total
and the heading again the same way.

Refreshed once more by **WP-04 Part 2** (2026-09-26, task 12, the same L28 rule: the
evidence-note counts are updated once, in the final task). Part 2 is native coverage, and
its three `src` fixes (NE9, NE15, NE16) each brought fast-suite tests with them — 2 files in
`tests/unit/` (`plugin-data-watch`, NE9's `watchPluginData`; `note-text-email`, NE16's
escaped `@`), 1 in `tests/component/` (`settings-tab-refresh-soon`, NE9's coalesced
`refreshSoon`) and 1 in `tests/host/` (`investigation-notes-alias`, NE15's
`realPathOfNearest` overlap through a junction or 8.3 alias) — plus one new case inside the
existing `tests/host/plugin-onload.test.ts` (NE9's `main.ts` wiring: a profile write
refreshes the tab, and after `onunload` it no longer does). `npm run test` becomes 308
files, 3465 tests; `npx vitest run tests/unit` (154 files, 1994 tests),
`npx vitest run tests/component` (107 files, 1028 tests) and `npx vitest run tests/host`
(24 files, 247 tests) refreshed those three rows, the totals and the heading. No other
layer's files changed, so their rows stand as WP-04 Part 1 took them.

Part 2's final whole-branch review fix wave (2026-09-26) adds five cases inside
`tests/host/plugin-onload.test.ts` (Minor 6: a write to each slice the Settings tab shows —
`profiles`, `bindings`, `analyzers`, `investigations` — refreshes it, and a `reviews` write
does not). `npm run test` becomes 308 files, 3470 tests; `npx vitest run tests/host` (24
files, 252 tests) refreshed the Host row, the total and the heading.

**The heading states what the fix wave's one `npm run verify` measured, and that run
failed.** It exited 1: the typecheck and both lints passed, and `npm run test` ran 308
files (307 passed, 1 failed) and 3470 tests — 3468 passed, 1 failed, 1 skipped — so the
chain stopped before its own `npm run build` (run on its own straight after: it passed).
The failure is the Z38 no-freeze case in `tests/integration/fallow-analysis.test.ts`
("the event loop never stalls for 50 ms…"): a 52.5 ms largest gap under the full suite's
load, against its 50 ms bound. Re-run alone straight after, it passed (largest gaps
23.0 ms while the child hangs, 25.7 ms while it streams). It failed the same way in both of
task 12's `npm run verify` runs, which also exited 1 (56.7 ms, then 53.1 ms; alone, and
with its own file, it passed at 25.0–27.9 ms and 19.9–25.6 ms). So Z38 has failed in every
full-suite run Part 2 measured, and passed every time alone. The Z38 budget is out of
Part 2's scope, so the case is unchanged, and the heading counts it as failed. The native run —
then 36 required scenarios across 13 files — was recorded in the **WP-04 Part 2** section
at the end of this document; it added no G8 row (IP53).

Refreshed once more by the **WP-04 Part 2 polish pass** (2026-09-26, task 9, the same L28
rule: the evidence-note counts are updated once, in the final task). Tasks 1–8 (base
`9644c08`, HEAD `f931ad8`) touch three of the ten layers, none of them by adding a new
layer or removing one. Task 1 (P2/NPF15) adds `tests/host/investigation-notes-unindexed.test.ts`
(3 cases: a disk-only folder is used, a disk-only file still refuses, an indexed folder
takes no `stat` call) — one file. Task 2 (P1/E20, P5/E13, T8) adds 3 cases inside
`investigation-notes-alias.test.ts` and 1 inside `investigation-ports.test.ts` (the
services wiring pin), no new file. Task 3 (P6/E14, O1) adds 4 cases inside
`city-view-scan-modes.test.ts` (the Reconnect scope-modal path, cancel, unbound and
same-root silent refresh) and updates `consent-chain.test.ts`'s five `runRefresh` call
sites for the new bound-root parameter, adding no case. Task 4 (P4, NE9 typing) adds
`tests/component/settings-tab-focus.test.ts` (5 cases: the deferred `update()` and
field-to-field, a profile page's field outside the detached `containerEl`, nothing focused,
`refreshSoon` still coalescing, a stale wait never repeating a render) — one file. Task 5
(P3) ships no product and no test change at all (rulings E8, E9 below). Task 6 (P7/Z38, O2)
moves the no-freeze case out of `fallow-analysis.test.ts` into its own
`tests/integration/fallow-no-freeze.test.ts`, a third `node-serial` project
(`groupOrder: 1`) that runs alone, after every other file — one file added, one case
relocated, none added, so the Integration row's Tests cell is unchanged. Tasks 7 (T1–T5,
T9, T10) and 8 (T6, T7) touch only `tests/e2e/**`; no fast-suite file or case. `npm run
test` becomes 311 files, 3486 tests; `npx vitest run tests/host` (25 files, 263 tests),
`npx vitest run tests/component` (108 files, 1033 tests) and `npx vitest run
tests/integration` (11 files, 45 tests) refreshed those three rows, the totals and the
heading. No other layer's files or tests changed, so their rows stand as Part 2's final
review took them. The pass's **final fix wave** then adds 4 cases inside
`settings-tab-focus.test.ts` (focus onto a button keeps the render waiting, a window blur
keeps it waiting, a release re-checks the document's focus, and a refused edit's Notice
shows while a render waits), no new file: `npx vitest run tests/component` becomes 108
files, 1037 tests, `npm run test` 311 files, 3490 tests, and the Component row, the total
and the heading were refreshed from that.

Refreshed once more by the **WP-04 Part 2 follow-ups pass** (2026-09-27, task 5, the same
L28 rule: the evidence-note counts are updated once, in the final task). Tasks 1–4 (base
`8466f03`, HEAD `69dabdd`) touch four of the ten layers, none of them by adding or removing
a layer. Task 1 (E7/E13) extracts the settings tab's waiting render into its own module,
`src/host/settings-render-wait.ts` (`createRenderWait`), and adds
`tests/component/settings-render-wait.test.ts` (7 cases, testing `createRenderWait` in
isolation: a render at once with nothing focused; a wait while a field is focused,
released once when focus leaves for outside with the document focused; at most one
`focusout` listener across a wait, a render at once and a second wait (FU1); `hidden()`
running a waiting render once, after a microtask, and removing its listener; `hidden()`
without a wait doing nothing; a deferred render's throw reaching `onError`, with a render
at once throwing to its caller as the control; and FM9's re-arm on a second document) —
one new file — plus 2 more cases inside `settings-tab-focus.test.ts` (E13: across a wait,
a render at once and a second wait the tab holds one `focusout` listener, then none, then
one; E7: `hide()` while a render waits runs `update()` once, after a microtask, and
removes the listener, with a no-wait control in which `hide()` renders nothing). Task 2
adds 1 case inside `fake-vault.test.ts` (the fake vault announces a reconciled folder) and
1 inside `investigation-notes-alias.test.ts` (a relation-free resolver: "resolves each
path to an unrelated folder of its own"), and rewrites `city-view-scan-modes.test.ts`'s
`silentRefresh` helper, which used to await `startScan()` in full (so a regression that
opened the scope modal timed out at Vitest's 5 s default): it now starts the scan without
awaiting it, polls for a modal within the file's own 50-microtask budget, asserts none,
then awaits the scan — no new case there, and no new file anywhere in this task. Task 3
(O1) adds `tests/build/vitest-projects.test.ts` (3 cases: exactly one `node-serial`
project, including exactly the no-freeze file; its `groupOrder` greater than every other
project's; the `node` project excluding the file) — one new file — plus the 2 s
bare-control load guard inside `fallow-no-freeze.test.ts`
itself, no new case there: the case skips with its own control figure instead of asserting
the 50 ms budget when the machine is already loaded. Task 4 touches only `tests/e2e/**`
(a shared step,
`tests/e2e/inspector-binding.ts`) and re-verifies scenario 39's RED; no fast-suite file or
case. `npm run test` becomes 313 files, 3504 tests; `npx vitest run tests/unit` (154 files,
1995 tests), `npx vitest run tests/component` (109 files, 1046 tests),
`npx vitest run tests/host` (25 files, 264 tests) and `npx vitest run tests/build` (2
files, 16 tests) refreshed those four rows, the totals and the heading. No other layer's
files or tests changed, so their rows stand as the polish pass's final fix wave took them.

Refreshed once more by the **WP-04.2 follow-up E3** (2026-09-27), the explicit timeout for
the acceptance scenario "Verify unchanged source after a real scan". `runFeature` takes a
per-scenario `timeouts` map, and `wp01.steps.ts` gives that scenario 60 000 ms, citing the
measurement recorded in the WP-04.2 follow-up E3 section at the end of this document. It
adds one file to one layer, `tests/acceptance/feature-runner.test.ts`, with four tests, and
one guard inside `wp01.steps.ts`. The only other test edit is the scenario-count sentence
`tests/unit/evidence-numbers.test.ts` pins, now 3 structural guards (not a new case).
`npm run test` becomes 314 files, 3509 tests; `npx vitest run tests/acceptance` (4 files, 44
tests) refreshed the Acceptance row, the totals and the heading. No other layer's files or
tests changed, so their rows stand as the follow-ups pass took them.

Refreshed once more by the **gap-closure Part D** (2026-10-03, task 8, the same L28 rule: the
evidence-note counts are updated once, in the final task). Tasks 1–7 (base `4996187`, HEAD
`cc879fc`) touch three of the ten layers (Unit, Component, Integration), none of them by adding
or removing a layer. Unit adds four files and 28 cases: `native-load-gate.test.ts` (task 1, 3
cases for the native runs' CPU load gate), `native-node-guard.test.ts` (task 7, 7 cases for the
libuv minimum), `no-layout-change-listener.test.ts` (task 4, 3 cases: the static guard that no
`src` file registers `layout-change`, with a positive control) and `yaml-parity.test.ts` (task 5,
13 cases: the mock's `stringifyYaml`/`parseYaml` against the native fact table, which holds 11
values), plus one case inside `native-results-gate.test.ts` (task 1: a crash-shaped report is
refused) and one inside `investigation-note-path.test.ts` (task 5: `LPT0` and `CONOUT$` are
reserved names). Component's Tests cell is unchanged: `investigate-screen.test.ts` gains 2
cases (task 5: a filter change after Show more resets to the first page, and the idle state
with and without a report) and `fallow-run-outcomes.test.ts` loses the 2 rows of the
`FALLOW_TRUST_NOT_STARTED` case along with the dead branch they covered. Integration's Tests
cell is unchanged too: `fallow-no-freeze.test.ts` stays one case, which now runs each mode 3
times and asserts the smallest of the three largest gaps (task 2, GRD2). Task 3 (native
scenario 41), task 6 (the opt-in procdump setup) and task 7's `native-tests.mjs` change touch
only `tests/e2e/**` and `scripts/`, with no fast-suite case beyond those listed. `npm run test`
becomes 318 files, 3537 tests; `npx vitest run tests/unit` (158 files, 2023 tests) and
`npx vitest run tests/component` (109 files, 1046 tests, unchanged) confirmed the two rows. No
other layer's files or tests changed, so their rows stand as the WP-04.2 follow-up E3 took them.

Refreshed once more by the **gap-closure Part C** (2026-10-04, task 9, the same L28 rule: the
evidence-note counts are updated once, in the final task). Tasks 1–8 (base `59649b8`, HEAD
`65d834e`) add test files to three of the ten layers (Unit, Component and Build) and add
or remove no layer. Unit adds four files: `may-publish-consulted.test.ts`
(task 2, 2 cases), `contrast-gate.test.ts` (task 5, 119 cases), `architecture-card-fit.test.ts`
(task 8, 3 cases) and `deliverables-status.test.ts` (task 8, 4 cases). Component adds four
files, the axe suites `axe-routes.test.ts` (28 cases), `axe-routes-act.test.ts` (17),
`axe-dialogs.test.ts` (19) and `axe-host-modals.test.ts` (6). Build adds two files,
`eslint-layering.test.ts` (task 3, 18 cases) and `ci-workflow.test.ts` (task 4, 7 cases). The
Host, Integration, Acceptance, Benchmark and Harness rows are unchanged. Every Tests cell
below comes from one full `npx vitest run` with the JSON reporter, not an `npm run test` run, in which the Z38 no-freeze case executed, grouped by
test file directory from vitest's own JSON report; the other tasks changed existing test
files without adding a file. `npm run test` becomes 328 files, 3776 tests at that head (`0f8add8`). The final-review fix wave then added cases to existing files only (Unit +7: `contrast-gate.test.ts` 124 and `architecture-card-fit.test.ts` 5; Component +1: `axe-routes.test.ts` 29; Build +33: `eslint-layering.test.ts` 51), so the cells above read Unit 2168, Component 1123 and Build 74 and the suite is 328 files, 3817 tests, 3816 passed, 1 skipped, as its `npm run verify` measured with Z38 executed; each of the three directories was re-read with `npx vitest run <directory>`.

The per-layer total below is **330**, which is not what `npm run test` itself runs: it is
328 files plus the opt-in `tests/fallow-real` layer's two files, which never run inside it
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

**The heading now states what the gap-closure Part C's passing `npm run verify` measured,
with the Z38 no-freeze case executed rather than skipped; every run of Part C, with its Z38
outcome, is disclosed in its own section at the end of this document.** Before it, the
heading stated what the gap-closure Part D's passing `npm run verify` measured; every run of
Part D, with its Z38 outcome, is disclosed in its own section. Before that, the heading
stated what the WP-04.2 follow-up E3's passing `npm run verify`
measured; every run of that follow-up, with its Z38 outcome, is disclosed in its own
section at the end of this document. Before that, the heading stated what the WP-04 Part 2
follow-ups pass's Run 1 `npm run verify`
measured (task 5's pre-commit dry run at `69dabdd`); Run 2 at `059203a` and the final
review fix wave's `npm run verify` at `b5a8591` measured the same counts. Every run of
the WP-04 Part 2 polish pass — Tasks 5, 6 and 8's earlier
runs, task 9's own one `npm run test` and five `npm run verify` runs, and the final fix
wave's runs — is disclosed in the WP-04 Part 2 polish section below, unchanged by this
task. Every run of THIS pass — the counts-refresh `npm run test`, every `npm run verify`,
every native gate run (task 5's two and the final review fix wave's two), every `npm run
test:fallow`, every `npm run analyze` and `npm run harness-shot` — is disclosed in the
WP-04 Part 2 follow-ups section at the end of this document.**
In short, of task 9's own runs: its `npm run test` at `f931ad8` failed only on the
expected pre-refresh G8 file count, with Z38 passing (hang 25.0 ms, streamed 28.4 ms); the
first verify run failed only on this
document's own arithmetic (the G8 total had not yet been updated to match the refreshed
table — a self-inflicted, expected failure, not a product or test regression) with Z38
passing; the second and third runs failed on further self-inflicted documentation mistakes
plus one unrelated environmental flake (an acceptance test that passed alone immediately
after), and in the third Z38 itself genuinely failed (62.5 ms), in the fourth back-to-back
full-suite run of the task; the fourth and fifth runs each exited 0 with every test
passing, Z38 included. See that section for the exact tails, both native gate runs,
`npm run test:fallow`, `npm run analyze` and `npm run harness-shot`.
**330 files, 3817 tests, 3816 passed, 0 failed,
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
| Unit | `tests/unit/**` | 162 | yes | 2168 | domain, application, UI stores, interaction state, stylesheet-as-contract (comments stripped — see below), and this table's own guard. WP-03 Part 1 adds the relation domain/normaliser/model/architecture-model suites and `relation-copy-claims.test.ts` (spec §5's "no calls/executes/will break" and "no backlink" sweeps). The WP-03 Part 1 polish pass adds PO1/PO2 and the JP5 gating cases inside `architecture-relations.test.ts`, no new file. The final whole-branch review's fix wave adds Minor 4's Report/Markdown split case inside `report-model.test.ts`, no new file. **WP-04 Part 1** adds 17 files: the native harness's own `session-lifecycle`, `native-results-gate` and `native-baseline` tests (Task 0, IP45), and the pure application layer's `investigation-note-text`, `investigation-note-path`, `investigation-note-model`, `investigation-evidence-splice`, `investigation-note-index`, `investigation-root-path`, `investigation-source-preview`, `investigation-stale-location`, `investigation-evidence`, `investigation-model`, `investigation-store`, `investigation-store-ports`, `investigation-folder-store` and `fake-vault` tests (Tasks 2–10). **WP-04 Part 2** adds 2 files: `plugin-data-watch.test.ts` (Task 2, NE9: `watchPluginData` hears a settled write to a watched slice, and only that) and `note-text-email.test.ts` (Task 11, NE16: `noteText` backslash-escapes the `@` of a bare or angle-bracket email). **The WP-04 Part 2 follow-ups pass** adds one case inside `fake-vault.test.ts` (Task 2: the fake vault announces a reconciled folder), no new file. **The gap-closure Part D** adds 4 files: `native-load-gate.test.ts` (Task 1, GRD4: the CPU load gate of native runs), `native-node-guard.test.ts` (Task 7, GRD1: a native run refuses a Node whose libuv is older than 1.52), `no-layout-change-listener.test.ts` (Task 4, E4: a static guard that no `src` file registers `layout-change`) and `yaml-parity.test.ts` (Task 5, GRD10: the mock's YAML pair against the native fact table) — plus one case inside `native-results-gate.test.ts` (Task 1: a crash-shaped report is refused) and one inside `investigation-note-path.test.ts` (Task 5: `LPT0` and `CONOUT$` are reserved names). **The gap-closure Part C** adds 4 files: `may-publish-consulted.test.ts` (Task 2, GRC13: `ScanCoordinator` publishes nothing when `mayPublish` refuses, with a control that publishes when it agrees), `contrast-gate.test.ts` (Task 5, GRC3: the WCAG contrast gate over the vendored `obsidian.css` and the plugin's own tokens, both themes, plus the sweep that no `color:` declaration in `src/ui` escapes it), `architecture-card-fit.test.ts` (Task 8, GRC9: five Architecture cards fit one row at 1280 px) and `deliverables-status.test.ts` (Task 8, GRC11: which deliverables are marked delivered) — plus a changed `evidence-numbers.test.ts` (Task 2: the residual-sweep fingerprint), no new file |
| Contract | `tests/contracts/**` | 5 | yes | 62 | **one suite, two implementations** (40) — `source-filesystem-port.contract.ts` runs against the fake port and the real Node adapter, so they cannot drift — plus this directory's other three pinned files, `height-scale.test.ts` (task 13's four preserved scale.ts properties), `microcopy.test.ts` (task 12's catalogue-completeness sweep) and `fallow-runner.test.ts` (Part 7 K28: the real adapter against a real spawned process, injected `node:child_process`, Z38). Untouched by WP-04 Part 1 |
| Integration (real temp dirs) | `tests/integration/**` | 11 | yes | 45 | 44 passed + **the one skip**, the file-symlink environment gate. Walker, walker bounds/content/symlinks, scan lifecycle, read log, no-source-writes (including the 1,000-file full-scale proof), vault-is-the-codebase, the fallow-analysis no-freeze suite. **WP-04 Part 1** adds `investigation-preview-real.test.ts` (Task 4, IP15: the source-preview service against the real Node adapter over a real temp directory). **The WP-04 Part 2 polish pass** (Task 6, P7/Z38) moves the no-freeze case out of `fallow-analysis.test.ts` into its own `tests/integration/fallow-no-freeze.test.ts`, in the `node-serial` project so it runs alone, after every other file — one file added, one case relocated, none added, the row's Tests cell unchanged. **The WP-04 Part 2 follow-ups pass** (Task 3, O1) adds a 2 s bare control before that same case, so it skips with its own figure instead of asserting the 50 ms budget when the bare control already shows the machine loaded (>= 35 ms) — still one case, the row's Tests cell unchanged. **The gap-closure Part D** (Task 2, GRD2) makes that one case run each mode 3 times and assert the smallest of the three largest gaps, with a 2 s post-control that skips a run the machine loaded part-way — still one case, the row's Tests cell unchanged |
| Component (jsdom) | `tests/component/**` | 113 | yes | 1123 | against **our** controls: the file list, search, inspector, camera controls, viewport, status surfaces, announcements, both modals, the settings tab, the renderer contract and disposal, (task 5) the toolbar's Scan control, and (task 7) the canvas header. WP-03 Part 1 adds the Architecture Cycles/Edges/Rules tabs, the File detail and Quality relations panels, the city Relations section, the relation-arcs geometry suite and the renderer-wiring suite. The WP-03 Part 1 polish pass adds cases inside `architecture-screen.test.ts`, `architecture-rules.test.ts`, `architecture-edges.test.ts`, `architecture-cycles.test.ts` and `city-relations-panel.test.ts`, no new file. **WP-04 Part 1** adds 13 files: the Investigate screen and route (`investigate-screen`, `investigate-route`), its entry points (`investigate-entry-points`), the evidence and preview panels (`investigate-evidence`, `investigate-preview`, `investigate-preview-io`), the create and refresh dialogs (`investigate-create`, `investigate-refresh`, `investigate-refresh-review`), the city Findings panel (`city-findings-panel`), the Settings notes-folder row (`settings-notes-folder-row`, `settings-notes-folder`) and the work-item-editor draft prefill (`work-item-editor-draft`). **The final whole-branch review's fix wave** adds a 14th, `investigate-create-review.test.ts` (finding 8: a create refusal announced through the live region once its dialog has closed). **WP-04 Part 2** adds `settings-tab-refresh-soon.test.ts` (Task 2, NE9: the Settings tab's coalesced `refreshSoon`, and a refresh that throws is shown rather than left unhandled). **The WP-04 Part 2 polish pass** adds `settings-tab-focus.test.ts` (Task 4, NE9 typing: the deferred `update()`, field-to-field, a profile page's field, nothing focused, `refreshSoon` still coalescing, a stale wait; the final fix wave adds focus onto a button keeping the wait, a window blur keeping it, a release re-checking focus, and a refused edit's Notice shown while a render waits) — one file, nine cases. **The WP-04 Part 2 follow-ups pass** (Task 1, E7/E13) adds one file, `settings-render-wait.test.ts` (the extracted `createRenderWait` module in isolation: a render at once with nothing focused; a wait while a field is focused, released once when focus leaves for outside with the document focused; at most one `focusout` listener across a wait, a render at once and a second wait (FU1); `hidden()` running a waiting render once, after a microtask, and removing its listener; `hidden()` without a wait doing nothing; a deferred render's throw reaching `onError`, with a render at once throwing to its caller as the control; and FM9's re-arm on a second document), seven cases — and two more cases inside `settings-tab-focus.test.ts` (E13: across a wait, a render at once and a second wait the tab holds one `focusout` listener, then none, then one; E7: `hide()` while a render waits runs `update()` once, after a microtask, and removes the listener, with a no-wait control in which `hide()` renders nothing). **The gap-closure Part D** (Task 5) adds two cases inside `investigate-screen.test.ts` (GRD13: a filter change after Show more resets to the first page; the idle state with and without a report) and removes the two rows of `fallow-run-outcomes.test.ts`'s `FALLOW_TRUST_NOT_STARTED` case with the dead branch they covered — the row's Tests cell unchanged. **The gap-closure Part C** (Task 6, GRC5) adds 4 files, `axe-routes.test.ts`, `axe-routes-act.test.ts`, `axe-dialogs.test.ts` and `axe-host-modals.test.ts`: axe-core, pinned as a devDependency and absent from `dist`, run over every route (with content, through `axe-support.ts`'s mount of the whole leaf), the dialogs and the host modals, with serious and critical violations failing; only four rules are switched off, for every case and never per screen (`color-contrast`, which jsdom cannot compute and the contrast gate covers instead, and the page-level `region`, `landmark-one-main` and `page-has-heading-one`). Tasks 7 and 8 also change existing component files (`architecture-edges`, `architecture-cycles`, `scope-modal`, `settings-tab`, `snapshot-status`, among others) without adding a file |
| Host (Obsidian doubles) | `tests/host/**` | 25 | yes | 264 | real `CityView` instances over doubles for what Obsidian provides: plugin onload, commands, multi-leaf, lifecycle leaks, window migration (against a genuinely separate jsdom realm), build output, and task 13's clean-vault install — the scriptable half of G1, which also holds the checkpoint-#4 checklist to the controls and keys `src/` actually ships. **This is the layer the rest of this document leans on most heavily.** **WP-04 Part 1** adds `investigation-notes.test.ts` (Task 9: `plan`/`create`/`refresh`/`open`/`destination`/`sourceNotePath` against the fake vault), `investigation-note-index.test.ts` (Task 9: the incremental reducer) and `investigation-ports.test.ts` (Task 10: the wired `InvestigationNotesPort`/source-preview over the fake vault, including E25's unbound-profile case). **WP-04 Part 2** adds `investigation-notes-alias.test.ts` (Task 8, NE15: `realPathOfNearest` and the notes port's overlap and `sourceNotePath` through a junction root, with a no-resolver control) and six cases inside `plugin-onload.test.ts` (Task 2, NE9: a profile write refreshes the Settings tab, and after `onunload` it no longer does; the final review fix wave's Minor 6: a write to each watched slice — `profiles`, `bindings`, `analyzers`, `investigations` — refreshes it, and a `reviews` write does not). **The WP-04 Part 2 polish pass** adds `investigation-notes-unindexed.test.ts` (Task 1, NPF15: a disk-only folder is used, a disk-only file still refuses, an indexed folder takes no `stat` call) — one file, three cases — plus three more cases inside `investigation-notes-alias.test.ts` (Task 2, E20/E13) and one inside `investigation-ports.test.ts` (Task 2, the services wiring pin), and four inside `city-view-scan-modes.test.ts` (Task 3, E14/O1: the Reconnect scope-modal path, cancel, unbound and same-root silent refresh). **The WP-04 Part 2 follow-ups pass** adds one case inside `investigation-notes-alias.test.ts` (Task 2: a relation-free resolver, "resolves each path to an unrelated folder of its own") and rewrites `city-view-scan-modes.test.ts`'s `silentRefresh` helper, which used to await `startScan()` in full (so a regression that opened the scope modal timed out at Vitest's 5 s default): it now starts the scan without awaiting it, polls for a modal within the file's own 50-microtask budget, asserts none, then awaits the scan (no new case there), no new file |
| Acceptance (21 + 3 repairs) | `tests/acceptance/**` | 4 | yes | 44 | 24 scenarios plus 3 structural guards (the feature file carries all 21 ported scenarios and the three repairs and nothing else; no step definition is unused; the real-scan scenario runs on its measured budget). **WP-04 Part 1** adds `investigation-spine.test.ts` (Task 16, IN38: finding → preview → create → edit → rescan → refresh, byte-identical human sections, over the real relations project and the real Node port) and `investigation-safety.test.ts` (Task 16, IN39: injection, collision, race, marker and traversal cases; mutation runs below). **The WP-04.2 follow-up E3** adds the third guard above and `feature-runner.test.ts`: two `it` cases (a scenario named in `runFeature`'s `timeouts` is registered with that budget and the others keep the default; a budget naming no scenario throws before anything registers) plus the two scenarios of its probe feature, four tests |
| Benchmark | `tests/benchmarks/**` | 2 | yes | 11 | reference hardware recorded above; **not a GPU measurement**, and this document says so in the same table as the numbers. WP-03 Part 1 adds `relations-budget.test.ts` (N33, N37 — medians above). Untouched by WP-04 Part 1 |
| Harness | `tests/harness/**` | 2 | yes | 26 | task 0b: keeps the browser dev harness (`npm run harness`) alive under the ordinary suite — pins the three-stylesheet load order, that `/styles.css` is served from `src/ui/styles.css` on disk rather than a build, the fixture's shape and determinism, and that scheme classes land on `<body>` and nothing else. Not a screenshot test: nothing here asserts what gets drawn, and headless-browser drawing is out of jsdom's reach — see the harness task's own report for what step 10 saw with real eyes. WP-03 Part 1 extends the fixture's synthetic report with relation evidence (N38). **WP-04 Part 1** (Task 17) adds two cases inside `harness-evidence.test.ts` for `demoInvestigation`'s linked and orphan notes and its fixed preview's location verdicts, no new file |
| Build | `tests/build/**` | 4 | yes | 74 | task 0c: pins `scripts/harness-shot.mjs`'s `SHOTS` coverage (all seven city screens, including S11's two distinct entry paths -- the list-only fallback and a genuine WebGL failure) and `scripts/chromium.mjs`'s own browser-resolution rule (`executablePath()`, asked of playwright-core, never a hand-mirrored per-platform path). Not a screenshot test itself -- see the task's own report for what `npm run harness-shot` produced with real eyes. WP-03 Part 1 adds the six new `wp03-*` and four re-framed `wp02-*` capture ids to the pinned coverage. **WP-04 Part 1** (Task 17) adds one case inside `harness-shot.test.ts` pinning the five new `wp04-investigate-*` ids, no new file. **The WP-04 Part 2 follow-ups pass** (Task 3) adds a second file, `vitest-projects.test.ts` (3 cases pinning `vitest.config.ts`'s own project shape: exactly one `node-serial` project, including exactly `fallow-no-freeze.test.ts`; its `groupOrder` greater than every other project's; and the `node` project excluding that file). **The gap-closure Part C** adds 2 more files: `eslint-layering.test.ts` (Task 3, GRC1: each layer ban of `eslint.config.mjs`'s `no-restricted-imports` is proved by linting a snippet through the real config, with controls that stay allowed, and the one review-record codec exception pinned both ways) and `ci-workflow.test.ts` (Task 4, GRC2: pins `.github/workflows/verify.yml`'s shape, which runs `npm ci --ignore-scripts` and `npm run verify` on `windows-latest` and leaves the native gates out) |
| Real fallow (opt-in) | `tests/fallow-real/**` | 2 | opt-in (`npm run test:fallow`), never in `npm run test` | 0 | Part 7 Z40/Z41: ten tests against the real, pinned fallow 3.27.0 (or `FALLOW_BIN`): native-binary inspection, the version probe, fixture fidelity, the fs-diff side-effect proof with its `.fallow/` control, the bad-root error, `--fail-on-issues` exit 1, the time limit, cancel and the stdout cap; WP-03 Part 1 (N36) adds a sibling file's eleventh test against the relations fixture project (J16). Its eleven tests are not part of the living suite this table totals, so its Tests cell is 0; the run is recorded in the WP-03 Part 1 section above and in G6 above. Untouched by WP-04 Part 1 |
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

**Accepted baseline at this commit: 4 findings** — 1 unused export, 1 unused type,
1 duplicate export pair, 1 circular dependency. The count is
recorded here (review M4) precisely because this gate exits non-zero permanently by
design: without a baseline, a FIFTH finding is indistinguishable from the four
already assessed. Gap closure Part C (GRC12) took it from 9 to 4: `LOT_FOOTPRINT`,
`MAX_DIRECT_SUBDISTRICTS`, `DRAG_THRESHOLD_CSS_PX` and `entityPath` are un-exported
(each is used inside its own module and no file imports it), and
`ScanCoordinator.getLifecycle` is deleted (no caller anywhere; the coordinator's
observers read lifecycle through `subscribe`). Each remaining one:

| Finding | Assessment |
|---|---|
| `node-access.ts` `fs` | the single Node seam; `fsPromises` is derived from it and `tests/unit/node-access-boundary.test.ts` asserts this file is the only one in `src/` that reaches Node. Accepted. |
| `model.ts` type `SourceReference` | named by spec §4.1's **frozen** implemented-types list. Only the user may change a §4 contract. Accepted, and must not be "cleaned up". |
| `renderer-port.ts` `EntityId` duplicating `entity-id.ts` | both are inside frozen §4.2/§4.1 contracts. Accepted. |
| `city-view.ts → leaf-registry.ts → city-view.ts` cycle | pre-existing and structural (the registry reaches views; views ask the registry to reconcile siblings). Not touched by task 12. |

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
- **Which** test is skipped, in the G8 heading's one skip, and which one failed (Z38,
  named beside the heading). That the split adds up is
  derived (above); which test the runner skipped is a fact of the run, not of the
  repository, and no test inside the suite can read it. Re-take with `npx vitest run`.
- The **reference hardware** rows, which describe a machine.
- The `npm run analyze` **total of 4**. Its internal breakdown is checked, but the figure
  itself needs the tool, which is not part of `npm run verify` and needs network.
- The **living suite's own totals**, now the same figures as the G8 heading itself since
  the WP-03 Part 1 refresh closed the two-vintage gap, refreshed again by the final
  whole-branch review's fix wave, by WP-04 Part 2's task 12, by Part 2's final review fix
  wave (308 files, 3470 tests: 3468 passed, 1 failed — Z38 under load — and 1 skipped), and
  by the WP-04 Part 2 polish pass's task 9 (313 files, 3486 tests:
  3485 passed, 0 failed, 1 skipped), by that pass's final fix wave (313 files,
  3490 tests: 3489 passed, 0 failed, 1 skipped, as its last `npm run
  verify` beside the G8 heading measured — see the WP-04 Part 2 polish section for every
  run either made), and now by the WP-04 Part 2 follow-ups pass's task 5 (315 files,
  3504 tests: 3503 passed, 0 failed, 1 skipped, as its last `npm run verify` beside the
  G8 heading measured — see the WP-04 Part 2 follow-ups section for every run made).
  Nothing in the suite can assert its own whole-run tally from inside itself, for the
  same reason the per-layer test counts are transcribed rather than derived. Re-take
  with `npx vitest run --reporter=dot`.

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

Sweep fingerprint: `6e9200b0`

That is an FNV-1a hash of the source and flags of every sweep regex, and of the phrase
templates of the negative sweep's two families, in `tests/unit/evidence-numbers.test.ts`.
It is derived: the test recomputes it and fails when it differs, and it also fails if any
of items (a), (b) or (c) above goes missing. Editing a sweep regex therefore cannot pass
silently — re-examine the list above against the new shapes, then update the fingerprint.

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
  line as the path it marks. Polish final review #6a: the source label sits to the right
  of the glyph and path on that same first line, not below it — it is the path alone that
  wraps, inside its own column (`overflow-wrap: anywhere`), when it runs long. Confirmed by
  reading `harness-shots/wp03-city-relations-dark.png` (not committed — `harness-shots/` is
  git-ignored) (commit `25c0840`).

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
A mutation to 300 (still below `TOTAL_EDGES` = 2,000) **survived** against
`relations-budget.test.ts`'s own assertion — `expect(rows).toHaveLength(EDGE_LIST_LIMIT)`
reads the same live constant it is checking, so any value under 2,000 is self-consistently
satisfied and that assertion alone is not proof a limit is enforced. Polish final review
#6b: that is not the open gap it looks like — `tests/component/architecture-edges.test.ts`'s
own "shows at most 200 rows and says how many more are not shown" test pins the LITERAL 200
against a fixed 250-edge fixture (`expect(rows(w)).toHaveLength(200)` plus
`EDGE_LIST_HIDDEN(50)`, independent of the constant's own value), and that test fails under
the very same 300 mutation (all 250 rows render, `EDGE_LIST_HIDDEN` never appears) — closing
JP7's clause without touching `relations-budget.test.ts`. A mutation past
`relations-budget.test.ts`'s own fixture size (2,500 > `TOTAL_EDGES`) fails ITS assertion too,
since the DOM cannot render more rows than there are filtered edges (2,000):

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

No test file was edited to strengthen the `EDGE_LIST_LIMIT` case — the literal-200 pin
already in `architecture-edges.test.ts` closes JP7's clause under the in-range (300)
mutation, and `relations-budget.test.ts`'s own assertion closes it independently under the
past-fixture-size (2,500) mutation; the brief's "or strengthen it" path was not needed.

---

## WP-04 Part 1 — investigation workbench and notes

Recorded by task 18 at branch `feat/wp-04-part1`, base `450a0da`; design in
`docs/superpowers/specs/2026-09-25-wp04-part1-investigation-design.md` (IN1–IN51, owner
decisions O1–O8), rulings in
`docs/superpowers/notes/2026-09-25-wp04-part1-ledger.md`. Part 1 delivers a new
**Investigate** screen: a finding list over the same evidence Quality reads, a bounded
read-only source preview with a stale-location rule, an evidence bundle and uncertainty
panel, and explicit Markdown-note creation and refresh in the user's own vault (O3, O4).
It adds one new durable key (`investigations`) and no process, argv or trust change.

### G2 note — the source-unchanged claim and O7

Ruling E29: `CLAIM_SOURCE_UNCHANGED` ("Scanning never changes the source." at E29, reworded
to "Scans and previews never change source files." in gap closure,
`SnapshotStatus.vue`, the scope modal) covers scanning and the preview only. The only
in-root write this part adds is an investigation note the user confirmed in the create
dialog (O7), written through the vault API (`Vault.createFolder`, `Vault.create`), never
through the `SourceFileSystemPort` the scan and preview read through. That write is
disclosed both in the README ("What this plugin reads, and what it never does") and in
the create dialog itself (`NOTE_CREATE_OVERLAP`, `NOTE_CREATE_EXCLUDE`), so the claim and
the one exception to it are stated in the same places a user would look.

### The deliverable's acceptance, item by item (spec §5)

| Acceptance | Test (in-memory) | Native (IN51) |
|---|---|---|
| A city finding opens the same evidence in the workbench | `tests/component/investigate-entry-points.test.ts`: "IN4/IN5: a city finding opens the same evidence in the workbench, keeping the selection and never moving the camera" (plus the Quality dialog, File detail and Architecture entry points in the same file) | — (component only, per spec §5) |
| One well-formed note in the chosen folder, no source-project edit | `tests/acceptance/investigation-spine.test.ts`: "finding → Investigate: the preview shows the anchor file as read from disk, with the reported line highlighted exactly" and "→ create → edit → rescan and re-attach → refresh: human sections byte-identical, frontmatter value-identical, a new block, no source write" (the whole-tree hash is unchanged); the **O7 exception** — a note created inside the codebase root, with its explicit exclusion checkbox — is `tests/component/investigate-create.test.ts`, describe "inside the codebase root (IN29, IP26)": "a folder inside the root shows the overlap, checked; confirming adds its root-relative exclusion and says so" | native spine (below): the note exists in the real vault; the copied codebase folder is unchanged (fs-diff, IN39) |
| Existing notes are not overwritten | exact and case-only collision — `tests/component/investigate-create.test.ts`: "IN27: a taken name shows its (2) name and path before confirm; confirming writes it and leaves the first file byte-identical"; race — "the race: another writer takes the name first; the refusal stays in the dialog, announces nothing, and re-plans"; `tests/host/investigation-notes.test.ts`, describe "create: the race (IN27, IPF16, Review Focus 3)": "a request whose re-plan renames is refused as exists, writing nothing" | probe (a): `vault.create` rejects an existing path, and (recorded) a case-only variant too, on this case-insensitive vault (IPF16) |
| Filenames and messages cannot inject unsafe markup | `tests/acceptance/investigation-safety.test.ts`: "a symbol, a specifier and a zone name holding every opener give inert notes; the screen shows the text as text" and "a hostile file name: the proposed name holds none of `[ ] # ^ \|`, and source_path round-trips exactly"; `tests/unit/investigation-note-text.test.ts` (`noteText`/`noteCode`): "flattens every line break, so a break cannot start a heading, rule or list", "escapes a leading list or ordered-list opener", "breaks bare URLs", "replaces invisible controls and bidi overrides with U+FFFD", "produces exactly the text the native probe proved inert (IP52)" | probe (b): backslash escapes keep every category inert in reading view and live preview, with a positive control that proves the probe can fail (IPF17) |
| Human sections survive evidence refresh | `tests/acceptance/investigation-spine.test.ts` (the same "→ create → edit → rescan …" case above); `tests/component/investigate-refresh.test.ts`: "IN31: the dialog names the snapshot change, the state and the line; confirm refreshes the block only" and "IN32 (IP8): the user's status, an added key and created survive a refresh, value-equal" | native spine (below): "keeps human sections byte-identical across a real refresh and links the note through the metadata cache" — byte-identical human sections, value-identical frontmatter, over a real `vault.process` and `processFrontMatter` |
| Stale line → stale evidence, not an exact highlight | `tests/unit/investigation-stale-location.test.ts` (`locationVerdict`): "is exact only when every check holds", "names the FIRST failed check", "a finding with no line is never exact", "an mtime equal to the analysis time passes"; `tests/component/investigate-preview.test.ts`, describe "IN10: the exact-line highlight and the stale-location callout" (the size/lines/mtime/line-range/report cases) | — (unit/component only, per spec §5) |
| (the plugin itself) loads cleanly in Obsidian | — | smoke (below): "loads the plugin without errors and opens the inspector on its default route", extended by Task 11's "renders the Investigate route in a real leaf" |

### Task 16 mutation runs

`tests/acceptance/investigation-safety.test.ts` and `investigation-spine.test.ts` are
acceptance pins over the real relations project and the real notes port; both mutations
below were applied to `src` with Edit, run, and reverted (`git diff --stat -- src` empty
afterwards):

1. **`noteText` skips escaping `[`** (`PUNCTUATION` regex missing `\]`):
   ```
   FAIL  tests/acceptance/investigation-safety.test.ts > injection through report text (IN39, Review Focus 2) > a symbol, a specifier and a zone name holding every opener give inert notes; the screen shows the text as text
   AssertionError: unescaped [[: expected true to be false
    ❯ expectInert tests/acceptance/investigation-safety.test.ts:94:58
         Tests  1 failed | 10 passed (11)
   ```
2. **`spliceEvidenceBlock` accepts a missing end marker** (`if (begins.length === 1 && begin && ends.length === 0) return { ok: true, … }`):
   ```
   FAIL  tests/acceptance/investigation-safety.test.ts > refresh and the markers, and who writes (IN31, IN35; Review Focus 1) > vanished or doubled marker: each refresh reports REFRESH_MARKERS_EDITED and each note is byte-identical
   Error: Cannot call text on an empty DOMWrapper.
    ❯ refuseRefresh tests/acceptance/investigation-safety.test.ts:203:59   (the refresh succeeded, so the dialog closed with no alert)
         Tests  1 failed | 10 passed (11)
   ```

Both were reverted before the recorded GREEN run; a third, native-layer mutation proving
the same marker-splice guard inside a real `vault.process` is in the **native acceptance**
subsection below.

### The five spec §6 probe results

Run by Task 0 (`tests/e2e/obsidian-facts.e2e.ts`) against Obsidian 1.13.4/win32, and kept
as native regression tests thereafter (Task 16's `npm run test:e2e` re-runs all five, and
this task's own run below re-confirms them):

| Fact | Result | Ruling |
|---|---|---|
| (a) `vault.create` rejects a path that already exists | **PASS.** A second `create('probe-a.md', …)` rejected with `"File already exists."`, text unchanged; a case-only duplicate (`PROBE-A.md`) also rejected on this case-insensitive vault | IPF16 |
| (b) Backslash escapes suppress wikilinks, embeds, tags, comments, highlights, block ids and math in reading and live-preview views | **PASS** (after IPF15's dotted-host correction to the probe literals: bare `x` is never auto-linked at all, so the first run's positive control could not fire). Every category present for the control (2 external links, 1 internal link, 1 embed, 1 tag, 1 highlight, 1 math span, the `%%…%%` comment hidden, `^probe-id` registered), 0 for the escaped text in both views | IPF15, IPF17 |
| (c) `metadataCache` fires `changed` after `vault.process` and `processFrontMatter` | **PASS.** All three writes (`create`, `process`, `processFrontMatter`) produced a `changed` event within the 5 s bound; none timed out | IPF18 |
| (d) `stringifyYaml` quoting of `yes`, `null`, `0012`, `a: b` | **PASS.** `yes` is written unquoted (YAML 1.2 core schema) and reads back as the string `"yes"`; `null`, `0012`, `a: b`, `true`, `~`, `#x` and `[[x]]` are double-quoted; every value round-trips as a string | IPF19 |
| (e) `createFolder` creates missing parents | **PASS.** `createFolder('p1/q1')` created the missing `p1` parent; both segments indexed as `TFolder` and present on disk | IPF20 |

### Harness captures (Task 17, IN40)

`npm run harness-shot` produces every id `scripts/harness-shot.mjs`'s `SHOTS` names,
verified by `tests/build/harness-shot.test.ts`, and reproduced by this task's own run
(below): five new `wp04-*` captures, seeded by `demoInvestigation` (`tests/harness/seed.ts`)
through the same read models the real screen uses, over a fake vault whose base path is the
snapshot's own root (so the default notes folder overlaps it, exercising IN26/IN29's
Exclude checkbox):

- `wp04-investigate-dark` / `-light` — the two-column Investigate screen, the first finding
  selected (`fn6 · Cognitive complexity 26`), its Evidence panel and its exact-highlighted
  Source preview, dark and light
- `wp04-investigate-narrow-dark` (760×1600) — the single-column stack, showing the orphan
  note under **Notes for findings not in this report**
- `wp04-investigate-stale-dark` — the same selection with a one-byte size mismatch: the
  stale-location callout, no highlighted line, the IN10 exact/no-exact contrast
- `wp04-investigate-create-dialog-dark` — the create dialog open over the screen, showing
  the folder, the planned name, the vault path and the checked Exclude checkbox (IN26,
  IN29)

Confirmed present, current and error-free by this task's own `npm run harness-shot` run
(Step 5 below): every id from `s05` through `s11`, every `wp02-*`, `wp03-*` and `wp04-*`
capture, exit 0, no page error and no console error on any shot.

### Native acceptance (O8, IN42–IN51)

**Stack and origin.** Vitest 5.0.1 drives a real installed Obsidian through standalone
WebdriverIO (`wdio-obsidian-service` 3.2.1, `webdriverio` 9.32.0), ported from
[`github.com/Luis85/describe`](https://github.com/Luis85/describe) (MIT, same author) as
Task 0. It is a separate project (`tests/e2e/vitest.config.mts`), typechecked and linted by
`npm run verify` but **never run** by it; `npm run test:e2e` = `npm run build` + the native
project + the results gate.

**Command and gate, at the baseline version** (`OBSIDIAN_VERSION` unset):

```
npm run test:e2e

 ✓ |native-obsidian| tests/e2e/obsidian-facts.e2e.ts (5 tests) 22812ms
 ✓ |native-obsidian| tests/e2e/investigation.e2e.ts (1 test) 7320ms
 ✓ |native-obsidian| tests/e2e/smoke.e2e.ts (2 tests) 8270ms
 ✓ |native-obsidian| tests/e2e/lifecycle.e2e.ts (2 tests) 6398ms
 Test Files  4 passed (4)
      Tests  10 passed (10)
Verified 10 executed native Vitest cases, including all 10 required scenarios.
```

Resolved versions (`reports/native/cases/*/environment.json`):
`{"requestedVersion":"1.13.4","appVersion":"1.13.4","installerVersion":"1.13.4","platform":"win32","runner":"vitest","commit":"local"}`.

**Command and gate, at `OBSIDIAN_VERSION=latest`:**

```
OBSIDIAN_VERSION=latest npm run test:e2e

 ✓ |native-obsidian| tests/e2e/obsidian-facts.e2e.ts (5 tests) 112254ms
 ✓ |native-obsidian| tests/e2e/smoke.e2e.ts (2 tests) 7534ms
 ✓ |native-obsidian| tests/e2e/investigation.e2e.ts (1 test) 7041ms
 ✓ |native-obsidian| tests/e2e/lifecycle.e2e.ts (2 tests) 5872ms
 Test Files  4 passed (4)
      Tests  10 passed (10)
Verified 10 executed native Vitest cases, including all 10 required scenarios.
```

Resolved versions: `{"requestedVersion":"latest","appVersion":"1.13.7","installerVersion":"1.13.7","platform":"win32","runner":"vitest","commit":"local"}`
— `latest` resolved to **1.13.7**, distinct from and newer than the 1.13.4 baseline; both
runs passed all 10 required scenarios with no retries. IN49's rule (a version that cannot
be downloaded fails the run; `latest` is never treated as reproducible) held: both versions
downloaded and ran cleanly on this attempt.

**The required-scenario list** (`tests/e2e/required-scenarios.json`, IN48): the smoke
("loads the plugin without errors and opens the inspector on its default route", Task 0;
"renders the Investigate route in a real leaf", Task 11, IPF5), the five Obsidian-fact
probes above (Task 0), the two session-cleanup tests ("releases the app, driver and copied
directories after a test body rejects"; "releases an acquired real session when final
initialization rejects", Task 0, IN45), and the native spine ("keeps human sections
byte-identical across a real refresh and links the note through the metadata cache", Task
16, IN51 d) — ten in total, none of them G8 layers (IP53).

**The native spine** (`tests/e2e/investigation.e2e.ts`, Task 16). In the session's copied
vault: `scan-codebase`'s own default flow — the source and scope modals over the copied
`code/` folder, creating an unbound profile (no Connect step; E25's preview reads under the
snapshot's own root) — → scan → import a real fallow report through the Data & scans dialog
→ select the import-cycle finding → the source preview shows the exact highlight → create a
note through the real dialog → edit its human sections through `vault.process` → rescan (a
new snapshot) → refresh through the real dialog: the text after the end marker is
byte-identical, the frontmatter is value-identical bar the new `snapshot_id`, and Obsidian's
own `metadataCache` links the note to the finding (not the notes port — the native spine
checks the real host). A bound profile's preview (a Connected folder read through the
binding rather than the snapshot root) is not exercised natively; it is covered only by
`tests/host/investigation-ports.test.ts` ("E25: a profile with no binding (scan-codebase's
own) reads under the snapshot root; a binding whose record is gone does not"). The RED
proof: `refreshNote` mutated to also write `RED mutation` after `## Decision` failed the
byte-identity assertion, reproduced with the recorded versions and reverted before the
final run above. The same test also carries Task 9's move/rename and delete carry: a moved
and renamed note stays linked through the real metadata cache, and a deleted note leaves the
notes panel.

**Native cases are not a G8 layer (IP53).** They are opt-in, local and never part of
`npm run verify`; the two `tests/unit/` files the native layer adds (`session-lifecycle`,
`native-results-gate`, plus `native-baseline`) are already counted in the Unit row above.

**Local only, desktop only.** Every run above was on this Windows 11 machine; the
repository has no CI for `npm run test:e2e`, so this evidence is what a run on this machine
recorded. `manifest.json` sets `isDesktopOnly: true`, so the native layer never exercises
mobile emulation (none is installed, IP51) or any operating system but this one.

**If Task 0 had stopped under IN50:** it did not — IPF14 records GO on this Windows 11
machine at first attempt — so the in-memory-only fallback was never needed and every native
scenario above stayed in the required list.

## WP-04 Part 2 — native e2e coverage

Recorded by task 12 at branch `feat/wp-04-part2`, base `353e2c1`; design in
`docs/superpowers/specs/2026-09-26-wp04-part2-native-e2e-design.md` (NE1–NE20, NP1–NP20,
owner decisions O1–O4), rulings in `docs/superpowers/notes/2026-09-26-wp04-part2-ledger.md`.
Part 2 adds no feature. It carries the Part 1 native harness from 10 required scenarios to
36, over the surfaces only a real Obsidian can show: the real Settings renderer, plugin
unload and reload, commands run by id, the installed fallow, the note index over real vault
events, note refresh and the codebase root, the bound preview, themes and an app restart.
It adds no durable key, no process, no argv, no trust change and no new dependency (NE2).

### The three `src` fixes the native tests exposed (O2)

Each was shown RED natively first, then fixed with its own fast-suite test (counted in the
G8 rows above):

- **NE9** — the Settings tab did not refresh after a `data.json` write it did not make (a
  profile created by `scan-codebase`, a note's exclusion, a fallow trust in Data & scans).
  `plugin-data-shape.ts` gains `watchPluginData`, the tab gains a coalesced `refreshSoon`,
  and `main.ts` wires one to the other for the plugin's loaded lifetime.
- **NE15** — the in-root overlap check compared the vault's 8.3 base path with a long-form
  root as two different folders. `node-access.ts` gains `realPathOfNearest`, injected into
  `investigation-notes.ts` through `investigation-services.ts`, so `plan()` and
  `sourceNotePath` compare resolved paths; with no Node filesystem it answers `null` and
  the old comparison stands.
- **NE16** — `noteText` left a bare email's `@` unescaped, so Obsidian autolinked it in
  reading view. It now backslash-escapes `@` like the other openers.

### Command and gate, at the baseline version

`OBSIDIAN_VERSION` unset, `FALLOW_BIN` set to the installed fallow 3.27.0 binary (scenarios
8, 9 and 15 run it), no `fallow.exe` running beforehand, at commit `3275092`, on this
Windows 11 machine:

```
npm run test:e2e

 ✓ |native-obsidian| tests/e2e/commands.e2e.ts (3 tests) 41248ms
 ✓ |native-obsidian| tests/e2e/notes-root.e2e.ts (2 tests) 17323ms
 ✓ |native-obsidian| tests/e2e/plugin-lifecycle.e2e.ts (2 tests) 15639ms
 ✓ |native-obsidian| tests/e2e/notes-refresh.e2e.ts (3 tests) 20900ms
 ✓ |native-obsidian| tests/e2e/obsidian-facts.e2e.ts (7 tests) 19898ms
 ✓ |native-obsidian| tests/e2e/preview.e2e.ts (2 tests) 14635ms
 ✓ |native-obsidian| tests/e2e/city.e2e.ts (2 tests) 14628ms
 ✓ |native-obsidian| tests/e2e/notes-index.e2e.ts (2 tests) 11790ms
 ✓ |native-obsidian| tests/e2e/fallow.e2e.ts (3 tests) 86918ms
 ✓ |native-obsidian| tests/e2e/investigation.e2e.ts (1 test) 7514ms
 ✓ |native-obsidian| tests/e2e/settings.e2e.ts (5 tests) 30199ms
 ✓ |native-obsidian| tests/e2e/lifecycle.e2e.ts (2 tests) 5033ms
 ✓ |native-obsidian| tests/e2e/smoke.e2e.ts (2 tests) 6308ms
 Test Files  13 passed (13)
      Tests  36 passed (36)
   Duration  328.50s
Verified 36 executed native Vitest cases, including all 36 required scenarios.
```

Resolved versions (`reports/native/cases/*/environment.json`, every case alike):
`{"requestedVersion":"1.13.4","appVersion":"1.13.4","installerVersion":"1.13.4","platform":"win32","runner":"vitest","commit":"local"}`.
The run logged one WebDriver `element not interactable` error inside
`settings.e2e.ts`'s Connect case; the case passed on its own polled click, with no retry
(`retry: 0`), and the line did not recur in the latest run below. The final review fix wave
makes every such click wait until WebDriver finds the button clickable (below).

### Command and gate, at `OBSIDIAN_VERSION=latest`

The same `FALLOW_BIN`, the same commit, run once, immediately after the baseline:

```
OBSIDIAN_VERSION=latest npm run test:e2e

 ✓ |native-obsidian| tests/e2e/fallow.e2e.ts (3 tests) 93680ms
 ✓ |native-obsidian| tests/e2e/commands.e2e.ts (3 tests) 39307ms
 ✓ |native-obsidian| tests/e2e/settings.e2e.ts (5 tests) 33690ms
 ✓ |native-obsidian| tests/e2e/notes-refresh.e2e.ts (3 tests) 23347ms
 ✓ |native-obsidian| tests/e2e/obsidian-facts.e2e.ts (7 tests) 23946ms
 ✓ |native-obsidian| tests/e2e/notes-root.e2e.ts (2 tests) 19925ms
 ✓ |native-obsidian| tests/e2e/plugin-lifecycle.e2e.ts (2 tests) 17931ms
 ✓ |native-obsidian| tests/e2e/preview.e2e.ts (2 tests) 17460ms
 ✓ |native-obsidian| tests/e2e/city.e2e.ts (2 tests) 16465ms
 ✓ |native-obsidian| tests/e2e/notes-index.e2e.ts (2 tests) 13173ms
 ✓ |native-obsidian| tests/e2e/investigation.e2e.ts (1 test) 12085ms
 ✓ |native-obsidian| tests/e2e/smoke.e2e.ts (2 tests) 6582ms
 ✓ |native-obsidian| tests/e2e/lifecycle.e2e.ts (2 tests) 5347ms
 Test Files  13 passed (13)
      Tests  36 passed (36)
   Duration  342.93s
Verified 36 executed native Vitest cases, including all 36 required scenarios.
```

Resolved versions: `{"requestedVersion":"latest","appVersion":"1.13.7","installerVersion":"1.13.7","platform":"win32","runner":"vitest","commit":"local"}`
— `latest` resolved to **1.13.7**, the same release WP-04 Part 1's latest run resolved to,
and newer than the 1.13.4 baseline. Both runs passed every required scenario with no retry
and no worker crash (E5). O4's rule holds as in Part 1: the gate is 1.13.4; `latest` is one
recorded run, never treated as reproducible.

### The required-scenario list, by file

`tests/e2e/required-scenarios.json` (IN48, NE6) now names 36 scenarios across 13 files.
Part 1's ten stand unchanged in `smoke` (2), `obsidian-facts` (5 of its 7), `lifecycle`
(2) and `investigation` (1). Part 2 adds 26:

| File | Scenarios added by Part 2 |
|---|---|
| `settings.e2e.ts` | the tab renders each saved codebase; it lists a codebase `scan-codebase` created (NE9); the notes folder setting saves or refuses with its reason; an excluded-paths change is saved or refused, and the next scan asks for approval; Connect binds a vault folder and Clear binding asks first |
| `plugin-lifecycle.e2e.ts` | unloading releases views, events and timers; profiles, bindings, the notes folder, dispositions and work items survive a reload |
| `commands.e2e.ts` | open-city and the ribbon each open a city tab; `cancel-scan` stops a running scan and is refused with none; `import-analysis-report` attaches a real report and is refused without a snapshot |
| `fallow.e2e.ts` | `run-fallow-analysis` runs the installed fallow; `cancel-fallow-analysis` stops a running analysis and is refused with none; Settings shows an executable trusted in Data & scans (NE9) |
| `notes-index.e2e.ts` | the index follows a folder move and ignores an unrelated note; a note moved while the plugin was disabled relinks on enable |
| `notes-refresh.e2e.ts` | edited markers are refused byte-identically; a failed frontmatter update after the block was written reports partial; refreshing a note moved inside the root changes nothing else there |
| `notes-root.e2e.ts` | a note created inside the root is excluded from the next scan; the exclusion is offered when the root is reached through an alias (NE15) |
| `preview.e2e.ts` | a bound codebase previews under its connected folder and refuses a changed root; Open in Obsidian and Open note each open a new tab |
| `city.e2e.ts` | the city draws in dark and light and recolours on `css-change` without a rebuild; the city leaf's route survives an app restart without a scan |
| `obsidian-facts.e2e.ts` | code spans keep `%%`, `$` and `==` inert; email addresses stay inert after `noteText` escaping (NE16) |

Each carries a positive control in the same test and was shown RED once (NE5), on the
unfixed code for NE9, NE15 and NE16, under its spec §5 mutation, or — for the code-span
scenario, per spec §5 — by the unescaped control in the same test; the RED outputs are in
the task reports, and no mutation was committed.

### Not a G8 layer, local only, no CI

**Native cases are not a G8 layer (IP53).** They are opt-in, local and never part of
`npm run verify`; the fast-suite files Part 2's fixes brought are counted in the Unit,
Component and Host rows above.

**Local only, desktop only, no CI (O3).** Both runs above were on this Windows 11 machine;
the repository has no CI for `npm run test:e2e`, and O3 keeps it that way for Part 2 (CI is
a recorded follow-up), so this evidence is what a run on this machine recorded. Mobile
emulation, pop-out windows (NE20) and the other exclusions in the spec's "Out of Part 2"
line are not exercised.

### The rest of task 12's verification

At the same commit: `npm run test:fallow` (same `FALLOW_BIN`, fallow 3.27.0): 2 files,
11 tests passed. `npm run analyze`: the accepted baseline of 9, unchanged.
`npm run harness-shot`: exit 0, every capture written, no page or console error; the five
`wp04-investigate-*` captures and `wp02-settings-dark` and `s05-city-dark` were opened and
are unchanged in kind — NE9, NE15 and NE16 change no layout.

### The final review fix wave

Tests and documents only; `src` is unchanged. Connect and Reconnect (`inspector.ts`'s
`bindFrom`) and `settings.e2e.ts`'s Clear binding, Cancel and confirm now poll each button
to clickable before clicking it, and the native files share one `data.json` reader, one
vault base path and one XPath class predicate. The baseline gate after it (same
`FALLOW_BIN`, no `fallow.exe` running beforehand), on this Windows 11 machine:

```
npm run test:e2e

 Test Files  13 passed (13)
      Tests  36 passed (36)
   Duration  347.66s
Verified 36 executed native Vitest cases, including all 36 required scenarios.
```

No WebDriver error was logged, and no worker crashed (E5). The run before the Clear-binding
waits were added also passed, 36 of 36, but logged two recovered `element not interactable`
errors in `settings.e2e.ts`'s Connect case. The log names no element; the only clicks
changed between the two runs were that case's Clear binding, Cancel and confirm, and the
second run logged none. `npm run verify`: exit 1, with Z38 the one failure
(see the G8 heading). `npm run analyze`: 9, unchanged.

---

## WP-04 Part 2 polish — P1–P7, the Z38 relocation and the native gate to 40

Recorded by task 9 at branch `feat/wp-04-part2-polish`, base `9644c08`, HEAD `f931ad8`;
plan in `docs/superpowers/plans/2026-09-26-wp04-part2-polish.md`, rulings in
`docs/superpowers/notes/2026-09-26-wp04-part2-polish-ledger.md` (WP-04.2 Polish E1–E11).
This pass closes WP-04 Part 2's own deferred minors (P1–P8, T1–T10) and carries the native
gate from 36 to 40 required scenarios. It adds no feature, no durable key, no process, no
argv and no trust change.

### What changed (P1–P7; P8 is no change)

- **P2/NPF15 (Task 1, scenario 37).** `ensureFolders` (`src/host/investigation-notes.ts`)
  now asks `app.vault.adapter.stat(prefix)` for a segment the vault has not indexed: a
  disk-only **folder** is used as is, never `createFolder`-ed; a disk-only **file** still
  refuses (`write-failed`); a genuinely absent segment still falls through to
  `createFolder`. The fake vault (`tests/fixtures/fake-vault.ts`) gains `diskOnly`,
  `adapter.stat` and a `calls.stat` counter, so a test can assert an already-indexed
  segment takes no `stat` call. New scenario 37, exact title `creates a note in a folder
  that exists on disk before Obsidian has indexed it` (`notes-root.e2e.ts`), which copies
  the project through `node:fs` so the session vault's watcher never indexes it first.
- **P1/E20 + P5/E13 + T8 (Task 2).** `realPathOfNearest`
  (`src/adapters/filesystem/node-access.ts`) now refuses a UNC (`\\...`) or `//...` path
  before touching `fs`/`path` at all, so an offline SMB root can no longer block the
  renderer. `createInvestigationNotes` holds one session-scoped memo
  (`Map<string, string | null>`): `plan`/`create` resolve the **root** through the memo and
  the **target folder** fresh every call; `sourceNotePath` resolves the vault base and the
  root through the memo and re-appends the relative path textually, rather than resolving
  the joined target directly. `investigation-services.ts`'s wiring is unchanged and is now
  pinned by a fast test.
- **P6/E14, O1 (Task 3, scenario 39).** `CityViewDeps.boundRoot` gives `startScan`'s
  refresh branch the profile's live binding root on this device (or `null` for another
  device's binding, PN5). `runRefresh` now opens the scope modal on that bound root when it
  differs from the stored scope's root (`sameRoot`, case-insensitive off Linux); a cancel
  leaves the snapshot, profile, binding and exclusions untouched; an unbound profile, or
  one bound to the snapshot's own root, still refreshes silently. New scenario 39, exact
  title `scan-codebase after a Reconnect to another folder asks to approve the connected
  folder` (`commands.e2e.ts`).
- **P4, NE9 typing (Task 4, scenario 38).** The Settings tab now defers its `update()`
  while a field in the settings window's **document** holds focus (ruling E3: scoped to
  `containerEl.ownerDocument`, not `containerEl`, because a profile page renders into its
  own `.setting-page` while the tab's own `containerEl` sits detached) and renders once
  focus leaves. New scenario 38, exact title `a setting being typed keeps its text when a
  write elsewhere refreshes the settings tab` (`settings.e2e.ts`).
- **P3 (Task 5) — no product change.** Rulings E8 and E9: ChromeDriver's own click-scroll
  only moves an element that starts outside the viewport, and the Create/Open-in-Obsidian
  buttons are already inside it, merely covered by Obsidian's fixed status bar — a
  WebDriver `.click()` therefore never triggers a scroll `scroll-padding-block-end` could
  affect. At maximum scroll the Create button sits 70.35 px above the status bar's top
  (measured, not committed). `centred()` stays, with its doc comment corrected: the overlap
  is Obsidian's own status bar, not the plugin's content padding (already zero). The spec's
  P3 WCAG 2.4.11 claim is withdrawn.
- **P7/Z38, O2 (Task 6).** The no-freeze case moves out of `fallow-analysis.test.ts` into
  its own `tests/integration/fallow-no-freeze.test.ts`, in a third `node-serial` Vitest
  project (`groupOrder: 1`) that always runs after the `node` and `jsdom` projects finish,
  so its 50 ms budget is measured on an otherwise idle worker pool. The budget itself
  (50 ms, both `hang` and `streamed` modes) is unchanged.
- **T1–T5, T9, T10 (Task 7).** Native test minors only, no `src` change: `openPluginSettings`
  captures its window handle inside the poll itself; `listenerCounts` fails closed on a
  non-array entry, with scenario 1's negative control; `reviewFinding` is typed and
  scenario 2 also dismisses a second finding, checked before and after the reload;
  `evidence()` checks `dt`/`dd`; scenario 2's post-reload mutation is recorded; the smoke
  test's nav labels come from `ROUTE_META`; scenarios 2, 17 and 22 take the config's
  default timeout.
- **T6, T7 (Task 8, scenario 40).** `expectedFindingCount` now counts findings the way the
  app does, through `resolveFindings` against the project's own file paths, so a finding
  whose anchor is not a snapshot file is left out. New scenario 40, exact title `the
  finding list pages through a report longer than one page and leaves out unmatched
  findings` (`investigation.e2e.ts`): a crafted 157-finding report (150 clones of one
  unused-export finding, plus one clone on a path outside the project), 156 matched and
  listed, the 157th left out.
- **P8 — no change.**

### Rulings carried into this record (not re-litigated)

- **E3** (amends PN4): the focus check is scoped to the settings window's own document
  (`containerEl.ownerDocument`), not `containerEl` — a profile page renders into its own
  `.setting-page` while the tab's `containerEl` sits detached, so a `containerEl`-scoped
  check would never defer. Before Settings are first opened, `containerEl.ownerDocument`
  is the main window's document, so a focused field anywhere in the main window also
  defers this tab's `update()` — harmless; `display()` re-reads `getSettingDefinitions()`.
- **E4** (amends spec §5 row 38's control): the positive control is the notes-folder field
  showing the write made elsewhere after the field blurs (the tab did re-render with the
  new value), not a marker on another row — a marker on `.setting-item` survives a
  re-render, and one on the Name input disappears even with no write, since the tab's own
  save re-renders it regardless.
- **E5**: the write scenario 38 watches is the tab's own investigation-folder store,
  reached through `app.setting.activeTab` (a `writePluginDataSlice('investigations')`
  write) — `setTimeLimit` throws `not-bound` for a profile with no fallow executable, and
  the plugin instance itself holds no profile store.
- **E7**: a settings window closed while a field is focused fires no `focusout`, so the
  deferred `update()` may never run — accepted as a known cost, not fixed. `refresh()` has
  already stored fresh entries and Obsidian calls `getSettingDefinitions()` on every
  `display()`, so only `update()`'s own search-index snapshot stays stale until the next
  refresh or display.
- **E9** (closes the Task 9 minor, amends P3/PN3): the plugin's padding is not at fault and
  no product change ships. Natively, the button's own `focus()` already scrolls it clear of
  the status bar on the unchanged CSS, and at maximum scroll the Create button sits
  70.35 px above the status bar's top. Only a WebDriver click on a button left under the
  bar at the viewport's bottom edge is intercepted — Obsidian's fixed status bar over any
  view. The spec's "focus is obscured (WCAG 2.4.11)" claim is withdrawn.
- **E10**: Task 9's native runs set `FALLOW_BIN` as a pure-backslash Windows path
  (`Join-Path`) — scenario 15 compares the executable path the tab shows against
  `FALLOW_BIN` textually, and a mixed-separator value is a harness input error, not a
  product bug.

### The native gate, 36 → 40 required scenarios

Four scenarios added, all inside files the gate already named — no new native file:

| File | Scenario added |
|---|---|
| `notes-root.e2e.ts` | 37 — `creates a note in a folder that exists on disk before Obsidian has indexed it` (P2/NPF15) |
| `settings.e2e.ts` | 38 — `a setting being typed keeps its text when a write elsewhere refreshes the settings tab` (P4, NE9 typing) |
| `commands.e2e.ts` | 39 — `scan-codebase after a Reconnect to another folder asks to approve the connected folder` (P6/E14, O1) |
| `investigation.e2e.ts` | 40 — `the finding list pages through a report longer than one page and leaves out unmatched findings` (T6, T7) |

**Ruling E11**: these four numbers are the spec §5 numbers, not implementation order —
`required-scenarios.json` is ordered by the commit that appended each title (Task 1's
scenario 37 landed before Task 3's scenario 39 and Task 4's scenario 38), and the gate
(`scripts/check-native-results.mjs`) matches every case to its required title, never to a
position in the file. Scenario 38 stays "settings typing" and scenario 39 stays
"scan after Reconnect"; neither is renumbered to match file order.

Each was shown RED once, per its own task report: scenario 37 on unfixed `ensureFolders`
(the create refused as `write-failed`); scenario 38 on `0f12436` (typed text lost to a
write elsewhere's re-render); scenario 39 under a mutation where `boundRoot` answered null
(after a Reconnect, scan-codebase silently refreshed the **old** root, with no modal); scenario 40 against the pre-fix
`expectedFindingCount` (the unmatched clone counted as listed). Every new or changed
scenario carries a positive control in the same test (Review Focus 5), and none matches
Obsidian's own UI text (IPF20).

### Every `npm run verify` and `npm run test` run this task made

Disclosed in full, including every self-inflicted failure and every flake across the
whole pass — nothing here is a cherry-picked pass:

**Earlier runs of the pass** (Tasks 5, 6 and 8; recorded in task-9-context.md and
disclosed here for the same reason every other run is):

- Controller `npm run test` at `5968e38` (after the last `src` task, Task 5): 308/310
  files, 3483 passed, 1 skipped, 2 failed — the G8 component file count (107 vs. 108,
  expected until this task) and **Z38 failed**: hang 62.6 ms, before Task 6's isolation.
- Task 6's own `npm run test` at `886f67a`: 310/311 files, 3484 passed, 1 failed (the same
  G8 count), 1 skipped; **Z38 passed**: hang 33.9 ms, streamed 20.3 ms — isolated in its own
  `node-serial` project for the first time.
- An ad hoc run during Task 6's gate re-check (a two-file `npx vitest run` under the root
  config, so the no-freeze file ran in the `node-serial` project, group 1): **Z38 failed
  once** at 290 ms right after a typecheck/lint burst, then passed on immediate re-runs
  (24.6/19.7 ms, then 22.4/24.9 ms).

**Stated plainly: after the isolation, Z38 failed 2 of the recorded runs** — this 290 ms
run and task 9's `npm run verify` #3 below (62.5 ms) — both inside `node-serial`, and both
put down to machine load that was inferred, not measured. The isolation removed the
contention from inside the suite; it did not remove failure under load on the machine.
- Task 8's native run: scenario 9 (`cancel-fallow-analysis`) flaked once on a `vaultHas`
  poll timeout during an investigation run, then passed both alone and in the final
  full-file run.

**This task's own runs** (one `npm run test` and five `npm run verify`):

1. **`npm run test` (counts refresh, before touching this document), HEAD `f931ad8`:**
   311 files (310 passed, 1 failed — the pre-refresh G8 file-count check, expected) and
   3486 tests — 3484 passed, 1 failed, 1 skipped. **Z38 passed** (hang 25.0 ms, streamed
   28.4 ms).
2. **`npm run verify` #1, after the G8 table rows above were refreshed but before this
   document's own total line was:** typecheck and both lints passed; `npm run test` ran
   311 files (310 passed, 1 failed) and 3486 tests — 3484 passed, 1 failed, 1 skipped — the
   one failure being `gate-evidence.test.ts`'s "states a total that its own rows add up
   to" (expected 3470, the table's rows now summed to 3486); the chain still reached
   `npm run build` (vite build, `assert-bundle: OK`) because the failure was inside the
   vitest run started by the test harness's own global setup, not the outer chain's own
   `npm run test` step — exit was still non-zero overall. **Z38 passed** (hang 30.7 ms,
   streamed 25.2 ms).
3. **`npm run verify` #2, after this document's total line was edited to a literal
   placeholder by mistake:** the placeholder broke both self-checking regexes outright, so
   3 test files failed instead of the intended 1 — `evidence-numbers.test.ts` and
   `gate-evidence.test.ts` both reported "the G8 heading no longer states
   files/tests/passed/[failed/]skipped" (a wholly self-inflicted, expected consequence of
   the mistake, corrected immediately after), plus one genuine but unrelated flake:
   `tests/acceptance/wp01.steps.ts`'s "Verify unchanged source after a real scan" timed out
   at the default 5000 ms under this run's system load (confirmed to pass alone afterward,
   13.05 s wall time with most of it in module transform — see below). 311 files
   (308 passed, 3 failed) and 3486 tests — 3482 passed, 3 failed, 1 skipped. **Z38 passed**
   (hang 22.7 ms, streamed 25.0 ms).
4. **`npm run verify` #3, after the placeholder was replaced with real figures (311 files,
   3485 passed, 0 failed, 1 skipped) — still wrong, because the heading's own file count
   must equal the table's row SUM including the opt-in `fallow-real` layer (313), the same
   convention the WP-04 Part 2 fix wave's own heading used (310 = 308 + 2), not the running
   count `npm run test` itself executes (311):** `gate-evidence.test.ts`'s file-sum check
   failed as a direct result (expected 311, the rows summed to 313); **Z38 genuinely
   failed this run** (hang 62.5 ms, over the 50 ms budget, under the same sustained load —
   the fourth back-to-back full-suite run of this task: its `npm run test` and three
   `npm run verify` runs); the same `wp01.steps.ts`
   scenario flaked again (5000 ms timeout). 311 files (308 passed, 3 failed) and 3486
   tests — 3482 passed, 3 failed, 1 skipped.
5. **`npm run verify` #4, after the heading's file count was corrected to 313 — exit 0,
   every test passed:** typecheck, both lints, `npm run test` (311 files, all passed;
   3486 tests, 3485 passed, 1 skipped) and `npm run build` (twice — once from the test
   harness's own global setup, once from this chain's own final step) all green. **Z38
   passed** (hang 21.6 ms, streamed 21.1 ms).
6. **`npm run verify` #5, taken once more after this document's own native-gate and
   harness-shot prose was filled in below (a documentation-only change; no `src` or test
   file touched between runs 4 and 5) — exit 0, every test passed again:** typecheck, both
   lints, `npm run test` (311 files, all passed; 3486 tests, 3485 passed, 1 skipped) and
   `npm run build` (twice, same reason as run 4) all green. **Z38 passed** (hang 22.5 ms,
   streamed 27.3 ms). This is the run the G8 heading above states.

`tests/acceptance/wp01.steps.ts`'s flake in runs 3–4 of the list above (`npm run verify`
#2 and #3) is unrelated to this pass: no task
1–8 touches `tests/acceptance/**`, the real-filesystem hashing pipeline it exercises, or
anything it depends on, and it passed in 13.05 s when run alone
(`npx vitest run tests/acceptance/wp01.steps.ts -t "Verify unchanged source after a real
scan"`) immediately afterward. It is recorded here as an environmental flake under
sustained load — the third and fourth back-to-back full-suite runs of this task — the
same class of flake this document already records for Z38 (G8 heading, above), and it did
not recur in runs 5 and 6.

### Command and gate, at the baseline version

`OBSIDIAN_VERSION` unset, `FALLOW_BIN` set to the same pure-backslash path as Part 2's own
task 12 run (ruling E10), no `fallow.exe` running beforehand (confirmed with
`tasklist /FI "IMAGENAME eq fallow.exe"`), at commit `f931ad8`, on this Windows 11 machine:

```
npm run test:e2e

 ✓ |native-obsidian| tests/e2e/obsidian-facts.e2e.ts (7 tests) 30356ms
 ✓ |native-obsidian| tests/e2e/fallow.e2e.ts (3 tests) 102971ms
 ✓ |native-obsidian| tests/e2e/commands.e2e.ts (4 tests) 49312ms
 ✓ |native-obsidian| tests/e2e/settings.e2e.ts (6 tests) 39951ms
 ✓ |native-obsidian| tests/e2e/plugin-lifecycle.e2e.ts (2 tests) 19695ms
 ✓ |native-obsidian| tests/e2e/preview.e2e.ts (2 tests) 19337ms
 ✓ |native-obsidian| tests/e2e/notes-refresh.e2e.ts (3 tests) 53453ms
 ✓ |native-obsidian| tests/e2e/city.e2e.ts (2 tests) 19396ms
 ✓ |native-obsidian| tests/e2e/notes-root.e2e.ts (3 tests) 25440ms
 ✓ |native-obsidian| tests/e2e/investigation.e2e.ts (2 tests) 14662ms
 ✓ |native-obsidian| tests/e2e/notes-index.e2e.ts (2 tests) 15739ms
 ✓ |native-obsidian| tests/e2e/lifecycle.e2e.ts (2 tests) 6290ms
 ✓ |native-obsidian| tests/e2e/smoke.e2e.ts (2 tests) 7319ms
 Test Files  13 passed (13)
      Tests  40 passed (40)
   Duration  474.14s
Verified 40 executed native Vitest cases, including all 40 required scenarios.
```

Resolved versions (`reports/native/cases/*/environment.json`, every case alike):
`{"requestedVersion":"1.13.4","appVersion":"1.13.4","installerVersion":"1.13.4","platform":"win32","runner":"vitest","commit":"local"}`.
The run logged one `stderr` `WebDriverError: javascript error: vault:ci-probe is not a
listener array` inside `plugin-lifecycle.e2e.ts`'s "unloading the plugin releases its
views, events and timers" — this is Task 7's own T2 negative control (`listenerCounts`
failing closed on a non-array entry), not an unexpected fault; the case still passed
(5781 ms). No other WebDriver error was logged and no worker crashed.

### Command and gate, at `OBSIDIAN_VERSION=latest`

The same `FALLOW_BIN`, the same commit, run once, immediately after the baseline:

```
OBSIDIAN_VERSION=latest npm run test:e2e

 ✓ |native-obsidian| tests/e2e/fallow.e2e.ts (3 tests) 96282ms
 ✓ |native-obsidian| tests/e2e/notes-refresh.e2e.ts (3 tests) 22891ms
 ✓ |native-obsidian| tests/e2e/commands.e2e.ts (4 tests) 47338ms
 ✓ |native-obsidian| tests/e2e/settings.e2e.ts (6 tests) 38238ms
 ✓ |native-obsidian| tests/e2e/obsidian-facts.e2e.ts (7 tests) 22136ms
 ✓ |native-obsidian| tests/e2e/notes-root.e2e.ts (3 tests) 25112ms
 ✓ |native-obsidian| tests/e2e/plugin-lifecycle.e2e.ts (2 tests) 20719ms
 ✓ |native-obsidian| tests/e2e/city.e2e.ts (2 tests) 19777ms
 ✓ |native-obsidian| tests/e2e/preview.e2e.ts (2 tests) 17776ms
 ✓ |native-obsidian| tests/e2e/notes-index.e2e.ts (2 tests) 16071ms
 ✓ |native-obsidian| tests/e2e/investigation.e2e.ts (2 tests) 14623ms
 ✓ |native-obsidian| tests/e2e/smoke.e2e.ts (2 tests) 8331ms
 ✓ |native-obsidian| tests/e2e/lifecycle.e2e.ts (2 tests) 6855ms
 Test Files  13 passed (13)
      Tests  40 passed (40)
   Duration  375.68s
Verified 40 executed native Vitest cases, including all 40 required scenarios.
```

Resolved versions: `{"requestedVersion":"latest","appVersion":"1.13.7","installerVersion":"1.13.7","platform":"win32","runner":"vitest","commit":"local"}`
— `latest` resolved to **1.13.7**, the same release WP-04 Part 1's and Part 2's own
`latest` runs resolved to. Both runs passed every required scenario with no retry and no
worker crash; the same T2 negative-control `stderr` line (`vault:ci-probe is not a
listener array`) appears once here too, in the same case, for the same reason. O4's rule
holds as before: the gate is 1.13.4; `latest` is one recorded run, never treated as
reproducible.

### The rest of task 9's verification

At the same commit: `npm run test:fallow` (same `FALLOW_BIN`, fallow 3.27.0): 2 files,
11 tests passed (`fetch-fallow.mjs` reused the pinned `FALLOW_BIN`, nothing fetched).
`npm run analyze`: the accepted baseline of 9, unchanged (5 unused exports, 1 unused
type, 1 unused class member, 1 duplicate export pair, 1 circular dependency — the same
six items the G8 baseline table above assesses; no task 1–8 change added, removed or
touched any of them).
`npm run harness-shot`: exit 0, every capture written, no page or console error. The five
`wp04-investigate-*` captures (`-dark`, `-light`, `-narrow-dark`, `-stale-dark`,
`-create-dialog-dark`), all five `wp02-settings-*` captures (`-dark`, `-light`,
`-narrow-dark`, `-privacy-dark`, `-import-dark`) and `s05-city-dark` were opened and read
with real eyes. They are unchanged in kind from Part 2's own run: the two-column
Investigate screen, its Evidence panel and exact-highlighted Source preview; the
narrow single-column stack; the stale-location callout with no highlighted line; the
create dialog with its folder, planned name and checked Exclude checkbox; the Settings
tab's five tabs (Appearance, Analysis & scope, Accessibility, Privacy & storage, About)
and the Privacy & storage tab's rows (No network requests, Saved review state,
Investigation notes folder, Import/Clear review state) and its Replace-review-state
confirmation dialog; and the Code city district view. Nothing here changed in layout —
consistent with PN3: this pass ships no CSS.

### Final fix wave

After the final whole-branch review (base `e39667b`), one fix wave at `9caede4`. **What
changed:** the Settings tab's waiting render (`renderWhenIdle`,
`src/host/settings-tab.ts`) is now released only when focus leaves the page's controls —
focus moving onto a button (Connect, Reconnect, Clear binding, Forget) keeps it waiting, so
a render can no longer rebuild the button's row between mousedown and mouseup and lose the
click, and the button's own action ends in `refresh()` with nothing editable focused, which
renders at once; a blur while the document has lost focus (a window switch) keeps it
waiting too; and a release re-checks the tab's current document and focus through
`renderWhenIdle()` instead of calling `update()` directly. `settings-tab-focus.test.ts`
gains four cases (the three above, each RED on `e39667b` first, and a refused edit's Notice
shown while a render waits, RED under a temporary mutation that deferred `notify`,
reverted), so its earlier "a refusal still shown" is now true. Comment-only fixes in
`scan-flow.ts` (`runRefresh`), `preview.e2e.ts` (scenario 23) and `settings.e2e.ts`
(scenario 38's control, E4); scenario 37 re-reads that `code/` is still unindexed just
before its create; `fallow-analysis-world.ts` drops two needless exports. No CSS and no
capture changed, so `npm run harness-shot` was not re-run. This record's Z38 account
above was corrected (the 290 ms failure ran inside `node-serial`; after the isolation Z38
failed 2 recorded runs, both put down to inferred machine load), as were scenario 39's RED
wording and the ruling range (E1–E11).

**Re-verification, every run:** typecheck, `lint:fast` and eslint on the touched files
clean; the touched fast files green; `npm run analyze` 9, unchanged. `npm run verify` #1
(after the counts refresh): exit 0 — 311 files, 3490 tests, 3489 passed, 1 skipped;
**Z38 passed** (hang 34.8 ms, streamed 35.5 ms). Native, `FALLOW_BIN` pure-backslash (E10),
no `fallow.exe` running before either run: `npm run test:e2e` on 1.13.4 — 13 files,
40 passed, 520.17 s, `Verified 40 executed native Vitest cases, including all 40 required
scenarios.`; with `OBSIDIAN_VERSION=latest` (resolved to **1.13.7**) — 13 files, 40 passed,
346.69 s, the same Verified line. Each logged only the T2 negative control's one
`vault:ci-probe is not a listener array` line, and no worker crashed. `npm run
test:fallow`: 2 files, 11 tests passed, nothing fetched. `npm run verify` #2, after this
paragraph was written (documentation only since #1): exit 0 — 311 files, 3490 tests,
3489 passed, 1 skipped; **Z38 passed** (hang 25.4 ms, streamed 25.2 ms). This is the run
the G8 heading states; only this sentence was added after it.

---

## WP-04 Part 2 follow-ups — the Z38 load guard; the native gate stays at 40

Recorded by task 5 at branch `feat/wp-04-part2-followups`, base `8466f03`, HEAD `69dabdd`;
plan in `docs/superpowers/plans/2026-09-27-wp04-part2-followups.md`, design in
`docs/superpowers/specs/2026-09-27-wp04-part2-followups-design.md`. This pass closes the
WP-04 Part 2 polish pass's own deferred follow-ups (Tasks 1-4): FN1's settings-tab
render-wait extraction and hidden-tab release (E7, E13), a handful of test-only minors,
and O1's Z38 load guard. It adds no feature, no durable key, no new process, no argv and
no trust change.

**Ruling E2 (controller): design spec §5's scenario 41 was DROPPED before
implementation.** `tests/e2e/required-scenarios.json` is unchanged by this pass — 40
titles across the same 13 files the WP-04 Part 2 polish pass left it at. Scenario 41 (`a
setting being typed when the settings window closes shows the write made elsewhere once
the settings reopen`) was designed but never kept: on unchanged `src` it passed, closed
from the settings window and again from the main window (ruling E1), so it could not be
shown RED. The reason is ruling E2's: every person-driven settings close removes the
focused field while its document has focus, and Chromium's removal `focusout` releases
the wait before `hide()` runs. The only path the wait outlives — a close while the
settings document is unfocused (Obsidian quitting, the plugin unloading, a close from
another window) — cannot be produced through WebDriver without moving OS focus, so FU2 is
proven by the fast tab-level case in `settings-tab-focus.test.ts` (`hide()` while a
render waits runs `update()` once, after a microtask; RED on `8466f03`, where `update()`
never ran after `hide()`). No RED is owed for a scenario that was never added, and no
native file changes shape.

### What changed (Tasks 1-4)

- **Task 1 (E7, E13).** The settings tab's waiting-render logic
  (`src/host/settings-tab.ts`) is extracted into its own module,
  `src/host/settings-render-wait.ts` (`createRenderWait`), and tested in isolation by the
  new `tests/component/settings-render-wait.test.ts` (7 cases): a render at once with
  nothing focused; a wait while a field is focused, released once when focus leaves for
  outside with the document focused; at most one `focusout` listener across a wait, a
  render at once and a second wait (FU1); `hidden()` running a waiting render once, after
  a microtask, and removing its listener; `hidden()` without a wait doing nothing; a
  deferred render's throw reaching `onError`, whether a `focusout` or `hidden()` released
  it, with a render at once throwing to its caller as the control; and FM9's re-arm on a
  second document, where a late `focusout` from the first adds nothing. (Focus moving
  onto a button keeps the wait while a refresh with the button focused renders at once,
  and a blur with the window unfocused keeps the wait; those are pinned in
  `settings-tab-focus.test.ts` since the polish pass.) Two more cases inside
  `tests/component/settings-tab-focus.test.ts` pin the tab's wiring: E13 — across a wait,
  a render at once and a second wait, the tab holds one `focusout` listener, then none,
  then one; E7 — `hide()` while a render waits runs `update()` once, after a microtask,
  and removes the listener, with a no-wait control in which `hide()` renders nothing. The
  task also words FM8's refusal-restore comments in `settings-tab.ts` and trims FM9's
  `moveFocus` to move focus only.
- **Task 2.** Test-only minors; its one `src` change is FM2's type alias
  `type Memo = RealPath` in `src/host/investigation-notes.ts` (behaviour-neutral):
  `tests/unit/fake-vault.test.ts` gains a case that the fake vault announces a reconciled
  folder; `tests/host/investigation-notes-alias.test.ts` gains a case (a third `it.each`
  row) — a relation-free resolver, "resolves each path to an unrelated folder of its
  own". `tests/host/city-view-scan-modes.test.ts`'s `silentRefresh` helper (FM7) used to
  await `startScan()` in full, so a regression that opened the scope modal timed out at
  Vitest's 5 s default; it now starts the scan without awaiting it, polls for a modal
  within the file's own 50-microtask budget, asserts none, then awaits the scan — no new
  case there.
- **Task 3 (O1).** The new `tests/build/vitest-projects.test.ts` (3 cases) pins
  `vitest.config.ts`'s own project shape: exactly one `node-serial` project, including
  exactly `fallow-no-freeze.test.ts`; its `groupOrder` greater than every other
  project's; and the `node` project excluding that file.
  `tests/integration/fallow-no-freeze.test.ts` (Z38) now runs a 2 s bare control first
  (`startGapSampler`, no child process, no sampled work beyond the sampler itself): if the
  control's own largest event-loop gap is already >= 35 ms (`LOADED_CONTROL_MS`), the case
  calls `ctx.skip(...)` with that figure instead of asserting the 50 ms budget against a
  host that cannot measure it honestly. Still one `it()` there, so the Integration row's
  Tests cell is unchanged; the `vitest-projects.test.ts` pin above (this task) keeps the
  case alone in `node-serial`.
- **Task 4.** Native-only; no fast-suite file or case. FM5: scenario 39 asserts the
  offered root at step 5 as soon as it is read, not after the approval, and after the
  cancel it reads the plugin data once to assert the bindings unchanged and
  `cancel-scan` refused, beside the probe's positive control, `scan-codebase` available
  in the same state (ruling E4). FM6: a shared step, `tests/e2e/inspector-binding.ts`
  (`clearBinding`), replaces the copy duplicated between `commands.e2e.ts` (scenario 39)
  and `preview.e2e.ts` (scenario 23, inline) — NP2's rule that `tests/e2e/inspector.ts`
  stays at exactly 400 lines means a new shared step goes in its own file. FM11:
  `plugin-lifecycle.e2e.ts`'s repeated `app.vault._` double cast becomes one cast type,
  `EventsTable`, used at both probe sites. FM12: `workspace-files.ts`'s `hashTree` and
  `projectFilePaths` share one private sorted tree walk. FM13: `writeReport`'s `edit`
  receives the recording typed where its callers reach in (`check.unused_exports`
  entries, `UnusedExportEntry`), so scenario 40's and `preview.e2e.ts`'s casts go. FM14:
  scenario 2's second finding is derived from the recording (`unusedExportFinding()`, a
  sibling of `cycleFinding`) instead of the hard-coded `SECOND_FINDING`. FM4:
  `commands.e2e.ts`'s header and describe title name rows 5–7 and 39.

### `npm run test`, refreshing the counts

At `69dabdd`, before this document's own counts were refreshed: 313 files (311 passed, 2
failed — the two pre-refresh count checks, `gate-evidence.test.ts`'s component-file-count
and `evidence-numbers.test.ts`'s src-floor, exactly as expected before this task's own
edits) and 3504 tests — 3501 passed, 2 failed, 1 skipped. **Z38 passed**: control 23.6 ms,
hang 25.1 ms, streamed 19.7 ms.

After the G8 table, the src/ floor and the mirrored release document were refreshed (this
document's own edits above): `npx vitest run tests/unit` (154 files, 1995 tests),
`npx vitest run tests/component` (109 files, 1046 tests), `npx vitest run tests/host` (25
files, 264 tests) and `npx vitest run tests/build` (2 files, 16 tests) each matched the
refreshed table, and `npx vitest run tests/unit/gate-evidence.test.ts
tests/unit/evidence-numbers.test.ts` (24 tests) and
`npx vitest run tests/host/clean-vault-install.test.ts` (15 tests, including the
two-document G8-identity check) all passed clean.

### `npm run verify`

**Run 1 (pre-commit dry run)**, at `69dabdd` with every evidence edit above already made
but not yet committed: exit 0. typecheck, `lint:fast` and `eslint` clean; `npm run test`
— 313 files, all passed; 3504 tests, 3503 passed, 1 skipped; **Z38 passed** (control
16.6 ms, hang 29.2 ms, streamed 21.8 ms); `npm run build` — `assert-bundle: OK`,
`dist/main.js` 1217 kB. **This is the run the G8 heading above states** (315 files
including the opt-in `fallow-real` row's two; 3504 tests, 3503 passed, 0 failed,
1 skipped).

**Run 2 (final, after the evidence commit)**, at `059203a`: exit 0. typecheck,
`lint:fast` and `eslint` clean; `npm run test` — 313 files, all passed; 3504 tests, 3503
passed, 1 skipped; **Z38 passed** (control 17.9 ms, hang 29.7 ms, streamed 28.2 ms);
`npm run build` — `assert-bundle: OK`, `dist/main.js` 1217 kB. The same counts as Run 1:
only documentation changed between the two.

### Native, at the baseline version (1.13.4)

`FALLOW_BIN` set to the pure-backslash path (E10), no `fallow.exe` running before the run
(checked with `Get-Process fallow`), at `69dabdd`, on this Windows 11 machine:

```
npm run test:e2e

 Test Files  13 passed (13)
      Tests  40 passed (40)
   Duration  483.43s
Verified 40 executed native Vitest cases, including all 40 required scenarios.
```

Resolved version: `{"requestedVersion":"1.13.4","appVersion":"1.13.4",
"installerVersion":"1.13.4","platform":"win32","runner":"vitest","commit":"local"}`. The
run logged only the one expected T2 negative-control `stderr` line (`WebDriverError:
javascript error: vault:ci-probe is not a listener array`, inside
`plugin-lifecycle.e2e.ts`'s "unloading the plugin releases its views, events and timers"
— the same known-benign line every prior Part 2 run has logged), and no worker crashed.

### Native, at `OBSIDIAN_VERSION=latest` — FAILED, reported as run, never retried

The same `FALLOW_BIN`, run once immediately after the baseline, with no `fallow.exe`
running beforehand (`Get-Process fallow` showed nothing just before the command started):

```
OBSIDIAN_VERSION=latest npm run test:e2e

 FAIL |native-obsidian| tests/e2e/fallow.e2e.ts > the installed fallow run by command id
in the real Obsidian host (WP-04.2 §5 rows 8, 9, 15) > cancel-fallow-analysis stops a
running analysis and is refused when none runs
AssertionError: expected 1 to be +0 // Object.is equality
 ❯ tests/e2e/fallow.e2e.ts:101:22
     99|     // No fallow runs on the system before this test, so a count of 0 …
    100|     const baseline = fallowProcessCount();
    101|     expect(baseline).toBe(0);

 Test Files  1 failed | 12 passed (13)
      Tests  1 failed | 39 passed (40)
   Duration  299.73s
```

Resolved version: `{"requestedVersion":"latest","appVersion":"1.13.7",
"installerVersion":"1.13.7","platform":"win32","runner":"vitest","commit":"local"}` —
`latest` resolved to **1.13.7**, the same release every prior `latest` run on this branch
resolved to.

**The failure is environmental, not a product defect, and it was reported rather than
retried (NP4's own no-retry rule).** `fallowProcessCount()`'s own baseline assertion —
"no fallow process runs on the system before this test" — found **one** running, and
`Get-CimInstance Win32_Process -Filter "Name='fallow.exe'"` taken immediately afterward
identified it: a `fallow.exe` launched from a **different, foreign worktree**
(`C:\Projects\obsidian-plugin-shell\.claude\worktrees\resolve-pr-conflicts-ci-4efd87\...`)
on this shared machine — a session this task neither started nor may kill, exactly the
interference the pre-flight instructions warned about. `Get-Process fallow` had shown
nothing running immediately before this command was launched; the foreign process
appeared mid-run, between the pre-flight check and the assertion inside the test itself,
which this task has no way to serialise against. Per the standing rule, this run stands
as recorded — `1 failed | 39 passed (40)`, no `Verified` line — and was not re-run.

### `npm run test:fallow`

Same `FALLOW_BIN`, fallow 3.27.0: 2 files, 11 tests passed in 10.06 s (`fetch-fallow.mjs`
reused the pinned `FALLOW_BIN`; nothing fetched).

### `npm run analyze`

9 findings, unchanged from every prior round: 5 unused exports, 1 unused type, 1 unused
class member, 1 duplicate export pair, 1 circular dependency — the same six items the G8
baseline table above assesses. No task 1–4 change added, removed or touched any of them.

### `npm run harness-shot`

Exit 0, every capture written, no page or console error logged. The five
`wp02-settings-*` captures (`-dark`, `-light`, `-narrow-dark`, `-privacy-dark`,
`-import-dark`) were opened and read with real eyes: the Settings tab's five tabs
(Appearance, Analysis & scope, Accessibility, Privacy & storage, About) render
identically in dark and light, the narrow layout collapses the sidebar to icons and
stacks the page without clipping anything, the Privacy & storage tab shows its four rows
(No network requests, Saved review state, Investigation notes folder, Import/Clear review
state) with the Replace-review-state confirmation dialog rendering its full copy
including the "Unknown origin" warning. Nothing here changed in layout or copy from the
prior round — consistent with this pass shipping no CSS.

### The final review's fix wave, and every run on its head

After the whole-branch review, commit `b5a8591` rewords the render-wait comments in
`src/host/settings-tab.ts` and `src/host/settings-render-wait.ts` (a person's close
releases the wait through the removal `focusout`; a tab switch keeps it, because focus on
a settings nav item stays inside the document, so `hide()` from `openTab()` is its
release, as for a close while the settings document is unfocused) and tightens
`settings-tab-focus.test.ts`'s E13 case to the exact listener counts, 0 after the render
at once and 1 after the second wait. No file or test count moved. The runs on that head,
in order:

- **`npm run verify`** at `b5a8591`: exit 0. typecheck, `lint:fast` and `eslint` clean;
  `npm run test` — 313 files, all passed; 3504 tests, 3503 passed, 1 skipped; **Z38
  passed** (control 16.5 ms, hang 29.1 ms, streamed 18.9 ms); `npm run build` —
  `assert-bundle: OK`, `dist/main.js` 1217 kB.
- **`npm run test:e2e` (1.13.4) — FAILED, reported as run, never retried.** 13 files
  (1 failed, 12 passed), 40 tests (1 failed, 39 passed), 353.33 s, no `Verified` line.
  The one failure is `fallow.e2e.ts`'s `cancel-fallow-analysis stops a running analysis
  and is refused when none runs`, at its baseline `expect(baseline).toBe(0)`
  (`fallow.e2e.ts:101`, `expected 1 to be +0`), the line task 5's `latest` run failed on.
  The cause is another session's `fallow.exe`, and the run's own precondition was broken
  at launch: a check 14 s before found none, but the launch-time `Get-Process fallow`
  found one running. A watcher over `Get-CimInstance Win32_Process -Filter
  "Name='fallow.exe'"` then recorded, while the run lasted, 131 `fallow.exe` processes
  whose command line names `C:\Projects\obsidian-plugin-shell\.claude\worktrees\resolve-pr-conflicts-ci-4efd87\...`
  (a `dupes` run every 1–3 s), 55 more gone before their command line could be read, and
  this run's own 2. None was killed. Resolved: `{"requestedVersion":"1.13.4",
  "appVersion":"1.13.4","installerVersion":"1.13.4","platform":"win32","runner":"vitest",
  "commit":"local"}`. Only the T2 negative control's `vault:ci-probe is not a listener
  array` line was logged, and no worker crashed.
- **`OBSIDIAN_VERSION=latest npm run test:e2e`**, started only after the foreign stream
  had stopped (no `fallow.exe` for 120 s straight, waited 15:47:55–15:55:12) and with none
  running at launch: 13 files, 40 passed, 377.48 s, `Verified 40 executed native Vitest
  cases, including all 40 required scenarios.` Resolved to **1.13.7**. Only the T2 line was
  logged; the watcher saw no `fallow.exe` but this run's own `FALLOW_BIN`.
- **`npm run test:fallow`**: 2 files, 11 tests passed in 9.57 s, fallow 3.27.0, nothing
  fetched.
- **`npm run analyze`**: 9 findings, unchanged (5 unused exports, 1 unused type, 1 unused
  class member, 1 duplicate export pair, 1 circular dependency).
- **`npm run verify`** at `832758a`, after the evidence commit: exit 0; 313 files, 3504
  tests, 3503 passed, 1 skipped; **Z38 passed** (control 16.7 ms, hang 25.2 ms, streamed
  18.1 ms).
- **`npm run test:e2e` (1.13.4) once more, on the final head `832758a` (ruling E7)** —
  launched only after 120 s with no `fallow.exe`, none running at launch — **FAILED,
  reported as run, never retried.** 13 files (12 passed), 40 tests (39 passed, none
  failed an assertion), 335.35 s, no `Verified` line: the Vitest worker running
  `fallow.e2e.ts` exited with Windows code 3221226505 (`0xC0000409`, a process fault)
  before its case reported. Only the T2 line was logged.
- **The 1.13.4 run of record (ruling E8)** is therefore task 5's run at `059203a` (40/40,
  `Verified 40 executed native Vitest cases, including all 40 required scenarios.`, 483 s).
  Its native inputs are the final head's: `tests/e2e`, `scripts` and the build
  configuration are unchanged since `059203a`, and building `src/host/settings-tab.ts` and
  `src/host/settings-render-wait.ts` as they were there gives a `dist/main.js` (SHA-256
  `b47599725e07…6485c2`) and `dist/styles.css` byte-identical to the final head's, because
  the only `src` change since is comment text. The `latest` run above (1.13.7, 40/40) ran on
  that same bundle.

## WP-04.2 follow-up E3 — an explicit timeout for the real-scan acceptance scenario

Ruling "WP-04.2 Follow-up E3" recorded, and did not fix, the acceptance scenario "Verify
unchanged source after a real scan" timing out at Vitest's 5 000 ms default under load
(polish `verify` #2 and #3, three all-core-load measurement runs, the controller's run at
`d665099`). This follow-up, based on PR 1's head `9b219df`, measures the scenario and gives
it an explicit budget. What the scenario asserts does not change.

**Change.** `runFeature` (`tests/acceptance/feature-runner.ts`) takes an optional
`timeouts` map, keyed by exact scenario name. A named scenario is registered with that
budget, and every other scenario keeps the default. A key naming no scenario throws before
anything registers. `wp01.steps.ts` gives the one scenario 60 000 ms, citing the figures
below in its comment, and adds a guard that pins that budget on the registered test.
`tests/acceptance/feature-runner.test.ts` covers the mechanism. The guard was mutation-checked: with the
budget changed to 30 000 ms, it failed (`expected 30000 to be 60000`).

**Measurement** (2026-09-27, this 22-core Windows machine, Node 24). A temporary, uncommitted
instrumentation in `runFeature` logged each step's start and end to a scratch file. It was
reverted before any commit. For the load runs, the scenario's timeout was lifted to 120 s so
that the durations are not censored at 5 s.

| Condition | Runs | Scenario total | Last step (reads `src/**`) |
|---|---|---|---|
| `wp01.steps.ts` alone | 5 | 0.40–0.66 s | 0.26–0.45 s |
| full `npx vitest run`, no synthetic load | 5 | 1.7, 2.4, 2.6, 3.9 s, and one **timeout at 5 000 ms** | 1.3–3.2 s |
| full run beside a 22-thread `worker_threads` burner (it reached only ~55–68 % CPU) | 3 | 1.9, 2.4, 3.6 s | 1.4–2.7 s |
| full run beside 22 separate burner processes (~85–90 % CPU) | 3 | 4.7, 22.8, 27.4 s | 3.3, 19.2, 24.0 s |

The machine was never idle. Other sessions' node processes and Defender kept its total CPU
between 34 % and 91 % while the runs were taken. The last step, which reads and
pattern-checks every `.ts` and `.vue` file under `src/`, takes most of the time. The 5 s
default sat inside the measured spread, and 60 s is about twice the worst run measured.
Under the 22-process burner, the suite failed 15, 20 and 22 other tests on their own
budgets, so that condition bounds this scenario's budget; it is not a condition the suite
is expected to pass.

**Every run, with its Z38 (`fallow-no-freeze.test.ts`) outcome.** Control / hang / streamed are
the largest event-loop gaps.

- The five `wp01.steps.ts`-only runs and one probe run: Z38 not in scope (single file).
- Full run, no synthetic load, 1: exit 0; Z38 passed, 25.4 / 24.8 / 22.4 ms.
- Full run, no synthetic load, 2: exit 1, **this scenario timed out at 5 000 ms** (the only
  failure); Z38 passed, 25.7 / 21.9 / 19.4 ms.
- Full run, no synthetic load, 3 and 4: exit 0; Z38 passed, 24.4 / 26.7 / 20.4 and
  23.1 / 29.6 / 25.8 ms.
- Full run, no synthetic load, 5: exit 1, **Z38 failed** (control 33.2 ms, under the 35 ms
  guard, so it asserted; hang 53.8 ms), its only failure.
- Thread burner, 1–3: exit 0; Z38 passed, 24.4 / 31.0 / 33.4, 25.4 / 30.6 / 27.9 and
  25.8 / 25.6 / 21.5 ms.
- Process burner, 1: exit 1 (15 load failures); Z38 passed, 20.6 / 31.4 / 33.0 ms (the
  burner processes had reached their 400 s end by the time `node-serial` ran).
- Process burner, 2: exit 1 (20 load failures); **Z38 failed**, control 28.8 ms, hang 71.6 ms.
- Process burner, 3: exit 1 (22 load failures); **Z38 failed**, control 27.8 ms, hang 55.3 ms.
- `npm run verify` 1, with the change and before this document's refresh: exit 1, the one
  failure the expected G8 Acceptance file count (`expected 3 to be 4`); 314 files, 3509
  tests, 3507 passed, 1 skipped; Z38 passed, 24.7 / 27.6 / 23.2 ms.
- `npm run verify` 2, after the refresh (the run the G8 heading states): exit 0; typecheck
  and both lints clean; 314 files, 3509 tests, 3508 passed, 1 skipped; Z38 passed,
  30.9 / 32.0 / 27.7 ms; `npm run build`, `assert-bundle: OK`, `dist/main.js` 1217 kB.
  The pre-push `npm run verify` on the commit itself is disclosed where this follow-up is reported.

## WP-04.2 Follow-up E6 — the native fallow process count scoped to the Obsidian under test

Recorded at branch `claude/optimistic-ptolemy-a69331`, base `9b219df`, fix commit `849748f`.
The follow-up that rulings E6 and E7 suggested: `fallowProcessCount()` in
`tests/e2e/inspector-fallow.ts` counted every `fallow.exe` on the machine (`tasklist`), so
another session's `fallow dupes` failed `cancel-fallow-analysis`'s baseline. It now takes
the Obsidian renderer's pid (`process.pid` through `executeObsidian`; the plugin's fallow
runner spawns from the renderer, `shell: false`) and counts the `fallow.exe` processes
descending from it, walking one `Get-CimInstance Win32_Process` snapshot's parent pids
down. A child is taken only when created after its parent, so a process whose dead
parent's pid was reused inside the tree stays out. The old count survives as
`machineFallowCount()`. `src` is unchanged, and `tests/e2e/inspector.ts` stays at 400 lines.

The scenario keeps its name and its assertions, and gains a foreign process: a copy of
the system's `PING.EXE` named `fallow.exe`, pinging localhost from a temporary folder,
started by the test runner (not by Obsidian) before the baseline. It runs for the whole
scenario and is stopped and removed in `onTestFinished`. Its own controls are
`machineFallowCount() >= 1` before the baseline and again after the cancel, so the scoped
0 there is the scope, not the process's absence. The positive control that the scoped
count sees the test's own run is the existing poll for `>= 1` before the cancel is sent.
The `cancelled` evidence now records `obsidian`, `foreign`, `baseline`, `running` and
`system`.

The runs, in order, all with `FALLOW_BIN` as the pure-backslash path that
`npm run test:fallow` wrote to `.fallow-bin\bin-path.txt` (fallow 3.27.0; that run: 2
files, 11 tests passed):

- **RED, before the fix** (the test and the foreign process in place,
  `fallowProcessCount(root)` still returning the machine-wide count). This is the cancel
  scenario alone, on 1.13.4: failed at `expect(baseline).toBe(0)`
  (`fallow.e2e.ts:108`, `expected 1 to be +0`).
- **GREEN attempts under foreign CPU load, disclosed.** Two development runs of the cancel
  scenario alone on the fix failed outside the change, while the machine was at 100 % CPU
  from other sessions' `node` processes. After the second run, those were identified as
  `node -e` busy loops of 400 s each, using 118 CPU-seconds per 5 s. Both runs passed the new baseline (line 108). One then failed `scanFolder('big')`'s 60 s
  snapshot poll (`inspector.ts:114`), and the other failed the vault poll at
  `fallow.e2e.ts:111`, where the `executeObsidian` call itself did not resolve in time.
- **GREEN** (the cancel scenario alone, 1.13.4, started once the load had stayed under 50 % and
  the busy loops had ended): passed, `{"baseline":0,"running":1,"system":1}`.
- **Mutation** (on `849748f`, `fallowProcessCount` made to return `machineFallowCount()`
  first, the foreign process running): the cancel scenario alone failed at
  `fallow.e2e.ts:108`, `expected 1 to be +0`. The mutation was reverted with
  `git checkout -- tests/e2e/inspector-fallow.ts`.
- **`npm run test:e2e` (1.13.4)** at `849748f`: 13 files, 40 passed, 414.15 s,
  `Verified 40 executed native Vitest cases, including all 40 required scenarios.` The
  cancel case recorded `{"baseline":0,"running":1,"system":1}`: the foreign process was
  listed by the system and not by the scope. Only the T2 negative control's
  `vault:ci-probe is not a listener array` line was logged.
- **`OBSIDIAN_VERSION=latest npm run test:e2e`** at `849748f`, no `fallow.exe` running at
  launch: resolved to **1.13.7**; 13 files, 40 passed, 570.70 s, `Verified 40 executed
  native Vitest cases, including all 40 required scenarios.` The cancel case recorded
  `{"baseline":0,"running":1,"system":1}`. Only the T2 line was logged.
- **`npm run verify`** at `849748f`, on its base `9b219df` before E3: exit 0; 313 files,
  3504 tests, 3503 passed, 1 skipped; **Z38 passed** (control 18.2 ms, hang 25.4 ms,
  streamed 23.7 ms); `assert-bundle: OK`, `dist/main.js` 1217 kB.

A native run no longer needs "no `fallow.exe` running" as a precondition (E10's half about
foreign processes). A foreign `fallow.exe` now only adds load.

**Landed on E3.** Both E6 commits were cherry-picked onto E3's `4a4a073` (branch
`feat/wp-04-followups-e3-e6`); the only conflict was this note's end, resolved by keeping
E3's section and then this one. One review commit, `97a47b6`, hardens
`tests/e2e/inspector-fallow.ts`: the `powershell.exe` process listing gets a 30 s timeout
and a timeout or signal throws, naming the command; the foreign ping runs `-n 330` (about
329 s, just over the 300 s test timeout) instead of `-n 3600`; and a failed foreign spawn
removes its temporary folder before rethrowing. The runs on `97a47b6`, in order, with
`FALLOW_BIN` the npx cache's fallow 3.27.0; each native run was launched after 60 s under
50 % total CPU, with no `fallow.exe` running at launch:

- **`npm run verify`**: exit 0; 314 files, 3509 tests, 3508 passed, 1 skipped; **Z38
  passed** (control 25.0 ms, hang 23.1 ms, streamed 22.1 ms); `assert-bundle: OK`,
  `dist/main.js` 1217 kB.
- **`npm run test:e2e` (1.13.4)**, after a 721 s wait for the load: **FAILED, reported as
  run, never retried.** 13 files (12 passed), 40 tests (36 passed, none failed an
  assertion), 362.60 s, no `Verified` line: the Vitest worker running `commands.e2e.ts`
  exited with Windows code 3221226505 (`0xC0000409`, a process fault) before its four
  cases reported, as ruling E7's run did in `fallow.e2e.ts`. `fallow.e2e.ts` passed all 3;
  the cancel case recorded `{"baseline":0,"running":1,"system":1}`. Only the T2 negative
  control's `vault:ci-probe is not a listener array` line was logged.
- **`OBSIDIAN_VERSION=latest npm run test:e2e`**, after a 366 s wait: resolved to
  **1.13.7**; 13 files, 40 passed, 383.99 s, `Verified 40 executed native Vitest cases,
  including all 40 required scenarios.` The cancel case recorded
  `{"baseline":0,"running":1,"system":1}`. Only the T2 line was logged.
- **`npm run test:fallow`**: 2 files, 11 tests passed in 9.08 s, fallow 3.27.0, nothing
  fetched.
- **`npm run analyze`**: 9 findings, unchanged (5 unused exports, 1 unused type, 1 unused
  class member, 1 duplicate export pair, 1 circular dependency).

## Gap closure Part D — native evidence and load gate, Z38 best-of-3, scenario 41 and the crash investigation

Recorded at branch `feat/gap-closure`, base `4996187`, HEAD `cc879fc` (this task's evidence
commit follows it). Part D carries the native gate from 40 to **41 required scenarios**,
still across the same 13 files, and changes how native runs are made and recorded. No
`tests/e2e/inspector.ts` line is added: the source and scope modal helpers moved into
`tests/e2e/inspector-scan.ts` (task 4), which leaves `inspector.ts` at 381 lines.

- **The load gate and run-scoped evidence** (task 1, `727e066` and `6de9207`).
  `npm run test:e2e` runs `scripts/native-load-gate.mjs` first: it samples the machine's CPU
  for 10 s, waits up to 15 minutes for the load to fall below 50 %, and otherwise refuses with
  exit 3 and writes no native Vitest report (only the run's `load-gate.json`)
  (`tests/unit/native-load-gate.test.ts`, 3 cases). Each run writes its
  evidence under `reports/native/runs/<UTC>-<version>/` (`NATIVE_RUN_DIR`): the Vitest JSON
  and JUnit reports, `load-gate.json`, per-case `environment.json` files (now also `node`,
  `uv`, `v8` and `chromedriver`), `breadcrumbs.ndjson` (`tests/e2e/breadcrumbs.ts`:
  crash-safe NDJSON breadcrumbs per session phase) and a `node-reports/` folder that the
  Vitest workers' `--report-on-fatalerror` and `--report-uncaught-exception` write into; the
  recorded `__fastfail` crash produced none there (a fast-fail bypasses Node's report, and the
  dump came from procdump).
  `tests/unit/native-results-gate.test.ts` gains a crash-shaped case.
- **Z38 best-of-3** (task 2, `578fc6a`): `tests/integration/fallow-no-freeze.test.ts` runs
  each mode 3 times and asserts that the smallest of the three largest gaps is below 50 ms;
  a 2 s post-control skips the case when the machine measured at 35 ms or more part-way
  through. Its timeout is 90 s.
- **Scenario 41** (task 3, `6bd5902`), in `tests/e2e/settings.e2e.ts`: `a render waiting in
  the settings tab is released when another settings tab is opened` (rename-based, ruling
  E1). `tests/e2e/required-scenarios.json` now lists 41 titles.
- **Scenarios 3 and 4, and the layout-change guard** (task 4, `4b99f97`): scenario 4 has its
  own scan-running control (the cancel-scan command is available during a 2 000-file scan,
  which is then cancelled); scenario 3 observes 0 canvas removals across the theme switches
  (NE13); `tests/unit/no-layout-change-listener.test.ts` is the static guard that no `src`
  file registers `layout-change` (E4).
- **The minors** (task 5, `2143a52`): reserved-name, paging-reset and idle-state cases; the
  A10 and C13 REDs; `trustAndRun` narrowed to `TrustAndRunOutcome`, with the dead branch and
  `FALLOW_TRUST_NOT_STARTED` removed; `tests/support/yaml-facts.ts` shared by the native fact
  test and the new `tests/unit/yaml-parity.test.ts`; the notes-root comment, the limitation,
  the citations (`07-sources-and-limits.md`) and the Part 7 spec row.
- **The crash investigation** (task 6, `99c4a39`, task 7, `cc879fc`): the opt-in
  `tests/e2e/procdump-setup.ts` (`NATIVE_PROCDUMP`) attached procdump to each native worker.
  The `0xC0000409` crash reproduced once in 3 diagnostic runs, and the dump symbolized to a
  stack-cookie (GS) failure in libuv's Windows `uv__tcp_connect` (an inlined
  `uv__insert_pending_req`), on Node 24.15.0 / libuv 1.51.0. `scripts/native-node-guard.mjs`
  (`libuvAtLeast`, `tests/unit/native-node-guard.test.ts`, 7 cases) makes
  `scripts/native-tests.mjs` refuse, with exit 4, a Node whose libuv is older than 1.52.
  Every run now first removes the previous top-level `vitest-results.json` and `junit.xml`,
  so a refusal or a failed build never leaves an older report at the gate's path, and the
  libuv guard applies on Windows only, where `tests/e2e/vitest.config.mts` also stops a
  hand-started native run at config load.
  Under Node 24.21.0 (libuv 1.52.1), task 7 recorded 11 consecutive green 1.13.4 runs
  (41 of 41) and one `latest` run.

The runs of task 8, in order (`FALLOW_BIN` the npx cache's fallow 3.27.0 as a pure-backslash
path; the native runs used the portable Node 24.21.0, because the system Node 24.15.0 is
refused by the guard):

- **`npm run test`**, before the counts refresh: exit 1, the one failure the expected G8
  Unit file count (`expected 154 to be 158`); 318 files, 3537 tests, 3535 passed, 1 failed,
  1 skipped. **Z38 executed and passed**: pre-control 21.6 ms; hang 21.2 / 24.3 / 24.5 ms;
  streamed 20.3 / 23.5 / 16.0 ms; post-control 28.3 ms.
- **`npx vitest run tests/unit`**: 158 files, 2023 tests (the one failure the same G8 file
  count). **`npx vitest run tests/component`**: 109 files, 1046 tests, unchanged. They refreshed
  the Unit row, the totals and the heading.
- **`npm run verify` 1**, after the refresh: exit 0; typecheck and both lints clean; 318
  files, 3537 tests, 3536 passed, 1 skipped; **Z38 passed**: pre-control 24.4 ms; hang
  22.9 / 23.7 / 23.1 ms; streamed 18.2 / 23.5 / 24.2 ms; post-control 26.3 ms;
  `assert-bundle: OK`, `dist/main.js` 1216 kB. This is the run the G8 heading states.
- **`npm run test:e2e` (1.13.4)**, load gate at 6 % CPU: 13 files, 41 passed, 419.71 s,
  `Verified 41 executed native Vitest cases, including all 41 required scenarios.` Run
  directory `reports/native/runs/2026-10-03T14-21-47-902Z-baseline`; Obsidian 1.13.4, Node
  24.21.0, libuv 1.52.1.
- **`OBSIDIAN_VERSION=latest npm run test:e2e`**, load gate at 18 % CPU: resolved to
  **1.13.7**; 13 files, 41 passed, 394.45 s, `Verified 41 executed native Vitest cases,
  including all 41 required scenarios.` Run directory
  `reports/native/runs/2026-10-03T14-29-30-202Z-latest`.
- **`npm run test:fallow`**: 2 files, 11 tests passed in 9.29 s, fallow 3.27.0, nothing
  fetched.
- **`npm run analyze`**: 9 findings, unchanged (5 unused exports, 1 unused type, 1 unused
  class member, 1 duplicate export pair, 1 circular dependency).

The final `npm run verify` on the evidence commit itself is disclosed where Part D is
reported.

## Gap closure Part C — the layering lint, CI, the contrast gate, axe, analyze 4 and the counts

Part C (base `59649b8`, tasks 1–8 at HEAD `65d834e`) adds the layering lint
(`eslint.config.mjs`, `tests/build/eslint-layering.test.ts`), the CI workflow
(`.github/workflows/verify.yml`, `tests/build/ci-workflow.test.ts`), the contrast gate
(`tests/unit/contrast-gate.test.ts`), the axe suites (`tests/component/axe-*.test.ts`), the
Architecture and deliverable-status changes, and the `npm run analyze` re-baseline from 9
to 4 (GRC12). It adds no native scenario, so the native gate stays at 41. Task 9 refreshed
the G8 table, then its mirror in the implementation report in a second pass (the first verify failed on the copy), and corrected three
quotations of the source claim that the Part C copy change had made stale: two in the implementation report and one in the G2 note (the
implementation report's checkpoint list, which `tests/host/clean-vault-install.test.ts`
checks against `src/`), and brought the limitations document up to date with the layering lint
and the deleted `ScanCoordinator.getLifecycle()`.

The runs of task 9, in order (`FALLOW_BIN` the npx cache's fallow 3.27.0 as a pure-backslash
path; the native runs used the portable Node 24.21.0, because the system Node 24.15.0 is
refused by the guard):

- **`npm run test`** 1, before any evidence edit: exit 1, two expected failures: the G8 Unit
  file count (`expected 158 to be 162`) and `clean-vault-install.test.ts` (the report still
  quoted the old source claim). 328 files, 3776 tests, 3773 passed, 2 failed, 1 skipped, 94 s.
  **Z38 executed and passed**: control 18.9 ms; hang 21.8 / 20.6 / 26.3 ms; streamed
  19.6 / 16.0 / 19.0 ms; post-control 25.2 ms.
- **`npx vitest run --reporter=json`** (the whole suite, grouped by directory to take the
  per-layer figures): exit 1, the one failure the same G8 file count; 328 files, 3776 tests,
  3774 passed, 1 failed, 1 skipped, 95 s. **Z38 executed and passed**: control 16.4 ms; hang
  30.1 / 20.3 / 21.5 ms; streamed 18.6 / 24.4 / 23.6 ms; post-control 23.8 ms. The per-layer
  figures in the table above are this run's.
- **`npm run verify` 1**, after the counts refresh but before the report's table was
  refreshed to match: exit 1, the one failure the G8 copy in the implementation report
  (`copies the G8 table without letting the copy drift from the original`); 328 files, 3776
  tests, 3774 passed, 1 failed, 1 skipped; 200 s, stopping at the failed test step, so
  verify's own build step did not run. **Z38 executed and passed**: control
  27.0 ms; hang 22.6 / 16.5 / 24.6 ms; streamed 22.6 / 24.8 / 16.2 ms; post-control 29.4 ms.
- **`npm run verify` 2**, after the report's table matched: exit 0; typecheck and both
  lints clean; 328 files, 3776 tests, 3775 passed, 1 skipped; **Z38 executed and passed**:
  control 24.1 ms; hang 25.2 / 22.8 / 24.6 ms; streamed 21.1 / 19.5 / 18.7 ms; post-control
  16.5 ms; `assert-bundle: OK`, `dist/main.js` 1218 kB. This is the run the G8 heading
  states.
- **`npm run test:e2e` (1.13.4)**, load gate at 12 % CPU: 13 files, 41 passed, 491.45 s of
  Vitest time (506.8 s wall), `Verified 41 executed native Vitest cases, including all 41
  required scenarios.` Run directory
  `reports/native/runs/2026-10-04T08-41-42-593Z-baseline`; Obsidian 1.13.4, Node 24.21.0,
  libuv 1.52.1.
- **`OBSIDIAN_VERSION=latest npm run test:e2e`**, load gate at 26 % CPU: resolved to
  **1.13.7**; 13 files, 41 passed, 484.87 s of Vitest time (508.6 s wall), `Verified 41
  executed native Vitest cases, including all 41 required scenarios.` Run directory
  `reports/native/runs/2026-10-04T08-50-40-019Z-latest`.
- **`npm run test:fallow`**: 2 files, 11 tests passed in 10.75 s, fallow 3.27.0, nothing
  fetched.
- **`npm run analyze`**: 4 findings (1 unused export, 1 unused type, 1 duplicate export
  pair, 1 circular dependency), as baselined in GRC12.
- **`npm audit --omit=dev`** and **`npm audit`**: both found 0 vulnerabilities.
- **`npm run harness-shot`**: 86 captures written.
