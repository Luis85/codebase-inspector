# WP-01 accessibility matrix

Recorded by task 12. **Every row names the layer it was actually verified at**, which is
the whole point of this table: a matrix that reports "pass" without saying who or what
checked is worth nothing.

> **G4's accessibility half and G7 are OPEN. This matrix is NOT a passing gate and
> must not be cited as one.** **13** of the matrix's **14** rows are NOT PERFORMED,
> in whole or in part; they are answered at **checkpoint #4**. Exactly one row is
> fully PASSED. (That count is DERIVED from this table by
> `tests/unit/gate-evidence.test.ts`, not retyped: a row counts as closed only if
> its Result cell begins `**PASSED`, because half a row is not a gate.) The GATE STATUS block
> at the top of `2026-09-17-wp01-gate-evidence.md` lists exactly which rows are
> outstanding and which structural findings may be cited.

**Read this first.** Task 12 ran as an automated implementation session. It has no
screen reader, no human eyes, no browser zoom and no third-party theme. Every row marked
**manual** below is therefore **NOT PERFORMED**, and that is recorded as a gap rather
than filled in from the jsdom evidence that happens to sit next to it. Where a jsdom
assertion genuinely covers part of a row, it is named — and what it does *not* cover is
named too. The manual rows belong to a human at checkpoint #4 or at task 13's release
check; the "How" column is the instruction for that person.

Legend: **jsdom** = asserted by a test in this repository, listed by file. **manual** =
requires a human in the real Obsidian host. **NOT PERFORMED** = nobody has done it yet.

<!-- a11y:table:start -->

| Check | How | Result |
|---|---|---|
| Keyboard-only: complete the scripted demo without a mouse | manual — spec §10's demo: real external repository → scope approval → scan → find a known file → confirm measurements → keyboard and HTML paths → cancel a refresh → reopen → source unchanged, using only the keyboard | **NOT PERFORMED.** Partially covered at jsdom: rows are native `<button>`s with a roving tabindex and exactly one row in the tab order, moving focus never selects (`tests/component/codebase-file-list.test.ts`); `/` focuses search only while this view owns focus and the target is not editable (`tests/component/file-search.test.ts`); Enter selects the first match deterministically; Escape resolves through one intent chain (`tests/unit/escape-intent.test.ts`, acceptance "Escape in search clears only the query"); F/T/+/−/arrows/Shift-arrows/Enter act only while the canvas itself has focus (`tests/component/camera-controls.test.ts`). **What jsdom cannot tell you: whether the whole demo is completable end to end without ever reaching for a mouse.** |
| Screen reader: NVDA on Windows | manual — NVDA on the user's Windows host; listen through the same demo | **NOT PERFORMED.** Partially covered at jsdom: one polite live region for stage transitions, completion, cancellation and control-initiated selection; assertive only for a blocking failure; hover announces nothing; a rapidly changing counter is throttled; no `aria-valuenow` when the total is unknown (`tests/component/announcement-region.test.ts`). **What jsdom cannot tell you: whether NVDA actually speaks them, in what order, or whether the city region's name and description read sensibly aloud.** |
| 200% text zoom: no clipping, labels scale as text | manual — Obsidian's own font-size setting and OS text scaling, at the user's ~1,876 px leaf and at a narrow sidebar | **NOT PERFORMED.** Adjacent evidence only: the container-query threshold is derived from `DRAWER_MAX_INLINE_SIZE` rather than transcribed, and the chrome is derived from the stylesheet (`tests/unit/layout-budget.test.ts`); the 320 px floor renders list-first with no WebGL context (`tests/component/responsive-floor.test.ts`). Neither is a zoom test. |
| Focus visibility and order | manual + jsdom | **jsdom half PASSED, manual half NOT PERFORMED.** jsdom: one row in the tab order following the roving focus; the canvas is one focusable region and the `<canvas>` itself is `aria-hidden` and never tabbable (`tests/component/city-viewport.test.ts`); both modals move focus onto themselves and return it to their opener on dismissal, taking the opener from `activeDocument` so a pop-out is not robbed (`tests/component/source-modal.test.ts`, `scope-modal.test.ts`, acceptance "Return to the scope review trigger"); the narrow-layout drawers return focus to their opener. **Manual half: whether the focus ring is actually VISIBLE against the real theme — jsdom computes no styles.** |
| Dark theme | manual — include the two shipped claims themselves | **NOT PERFORMED** as an accessibility check. **Review M5:** "Read-only source access · Source remains unchanged." renders inside `.ci-snapshot-status`, whose `color: var(--ci-text-muted)` is the lowest-contrast token on the surface. No CSS was added for the claims, deliberately, to stay out of ruling M113's specificity fight — so whether a factual safety claim belongs in the muted token is a judgement for a human looking at it. The user has run the plugin in their own theme and closed checkpoint #3 on a screenshot, but no contrast measurement was taken. Adjacent: every scene colour is re-read from the theme's tokens on `css-change` (acceptance "Theme change while a city is open"). |
| Light theme | manual — same claim caveat | **NOT PERFORMED.** Same as above; no light-theme run is recorded anywhere on this branch. |
| One third-party theme (name it) | manual — pick one and name it in this cell when it is done | **NOT PERFORMED.** No third-party theme has been tried. Relevant known hazard, ruling M113: our rules are wrapped in `:where(.codebase-inspector-root)`, which contributes **zero** specificity, so a theme's own element rules can win. Five controls have been raised to `button.ci-file-list__row`-style (0,1,1) selectors for exactly this reason, and a root-scoped user snippet at (0,2,0) still wins — which is intended. A third-party theme is the realistic test of that arrangement and it has not been run. |
| Non-drag single-pointer equivalence (11 controls) | jsdom + manual | **jsdom half PASSED.** `tests/component/camera-controls.test.ts` — "offers a SINGLE-POINTER route for every dragging gesture": zoom in, zoom out, rotate left, rotate right, pan up, pan down, pan left, pan right, Fit, Top (a **toggle**, so the 3D view is reachable again) and Focus — 11 controls, each a real `<button>` with an accessible name, driving the port with the spec's own increments. WCAG 2.5.7. **Manual half NOT PERFORMED: whether they are reachable and hittable at a real pointer size on a real leaf.** |
| Reduced motion: camera jumps, does not tween | jsdom + manual | **jsdom half PASSED.** `setMotion('reduced')` is passed when `prefers-reduced-motion` matches, read from `containerEl.win` and re-read on every reconstruction and on live OS-level changes (`tests/component/city-viewport.test.ts`); the rig honours it. **Manual half NOT PERFORMED: whether the camera visibly jumps rather than tweening, which requires watching it.** |
| Long Unicode paths in list, inspector and tooltip | jsdom + manual | **jsdom half PASSED.** `unicodeFixture()` carries a 240-character path with combining marks and an RTL segment and is exercised through the list and inspector; the walker handles the same names on a real filesystem (`tests/integration/walker.test.ts`). **Manual half NOT PERFORMED: whether they WRAP or TRUNCATE legibly on screen, and the tooltip case is not covered at any layer** — the hover tooltip's own rendering has no jsdom assertion about long text. |
| The canvas is one named region, not thousands of buttons | jsdom | **PASSED.** `tests/component/city-viewport.test.ts` — "is ONE named focusable region with a help description, not thousands of buttons", and "marks the canvas aria-hidden and never tabbable". The renderer never receives a key event; the view owns focus, keys and accessible naming (frozen §4.2). |
| Host shortcuts are not captured while the city lacks focus | manual | **NOT PERFORMED** in the real host. Strong adjacent evidence at jsdom: camera keys act only when `event.target` is the stage element itself; Ctrl/Meta/Alt combinations and composing input are ignored so a same-key host shortcut is never shadowed; no host-wide hotkey is registered (commands exist, hotkeys do not) (`tests/component/camera-controls.test.ts`); the shell's Escape listener acts only when this view owns focus, so two open leaves do not cross-talk (`src/ui/App.vue`, acceptance "Keyboard input belongs to the sibling note"). **What is missing is a human typing in a Markdown note beside a city and confirming Obsidian's own shortcuts still fire.** |
| Focus is preserved after a refresh | manual | **NOT PERFORMED.** Adjacent: acceptance "Select a file without moving the camera" asserts focus stays on the activated row through selection, and reconciliation after a new snapshot clears a removed selection without moving focus to a different row by index (acceptance "Reconcile a file removed from the next snapshot"). Neither is a refresh-with-focus-held test in a real host. |
| Tooltip and overlay DOM belong to the correct window | manual | **NOT PERFORMED** in the real host. Adjacent, and unusually strong for a cross-window concern: `tests/host/window-migration.test.ts` runs against a **genuinely separate `jsdom` realm** (a second `JSDOM` instance with its own constructors) and a real `adoptNode`, and asserts that every DOM node is created in the NEW window, that `node.instanceOf(T)` is used instead of `instanceof`, that the palette and reduced-motion preference are re-read there, that the `ResizeObserver` is rebuilt from the new window and that the Escape shortcut moves to the new document. `no-restricted-globals` makes a bare `window`/`document` a lint error in `src/ui/**` and `src/visualization/**`. **What is missing is a human dragging a leaf into a pop-out and hovering a building.** |

<!-- a11y:table:end -->

---

## Summary

- Exactly **1** row is fully PASSED: the canvas as one named region.
- **4** more rows have a PASSED jsdom half and an unperformed manual half — single-pointer
  equivalence (11 controls), reduced motion (the command half), long Unicode paths (the
  list and inspector half), and focus visibility and order (the order half).
- **NOT PERFORMED: every manual row.** That is **13** of the matrix's **14** rows, in
  whole or in part — a row with a passed jsdom half is still open, because half a row is
  not a gate.

All three figures above are DERIVED from the table by
`tests/unit/evidence-numbers.test.ts`. They were transcribed once and were wrong within
one fix round; they are not transcribed now.

The correct reading of this table is that the **structure** is in place and machine-checked
— roving tabindex, one live region, one named canvas region, single-pointer alternatives,
cross-window DOM ownership, focus return from both modals — and that the **perceptual**
half of accessibility has not been checked by anybody. Contrast, focus-ring visibility,
zoom reflow, screen-reader output and third-party themes are all unverified.

No row above may be reported as passing on the strength of the evidence in its own
"Result" cell unless that cell says **PASSED**.

---

## Numbers in this document

Every count stated above is **derived from the table itself** by
`tests/unit/evidence-numbers.test.ts` and `tests/unit/gate-evidence.test.ts`: the total,
the open count, the fully-PASSED count and the half-passed count. A stale value reddens a
test wherever in this file it is written — and so does a value that disagrees with
`2026-09-17-wp01-gate-evidence.md` — **provided it is written in one of the two shapes the
guard reads.** Those shapes, and what falls outside them, are named in
`2026-09-17-wp01-gate-evidence.md`'s own Numbers block. The boundary is stated rather than
implied because half of this guard was inert for a whole fix round while being described
as catching everything.

One convention, so the guard can tell two different facts apart: the phrase
"**N** of the **14**" is reserved for claims about OPEN rows. The fully-PASSED and
half-passed counts are stated in their own shapes ("Exactly **1** row is fully PASSED",
"**4** more rows have a PASSED jsdom half"), because a sweep that cannot tell a
passed-row claim from an open-row claim is a sweep that has to be argued with. (This
paragraph tripped the guard on its first run, for using the reserved shape as an
example. That is the guard working, and the example is now written without it.)

Nothing else in this file is a count. The test-file names in the Result column are cited,
not counted; `11 controls` is the number `tests/component/camera-controls.test.ts` itself
asserts (WCAG 2.5.7's "every dragging gesture"), and it is checked there rather than here.
That test names all eleven controls **and** asserts the component renders exactly that many
buttons, so a twelfth control cannot ship unnamed. Until this round it asserted only that
the eleven were present, which is a weaker thing than this sentence used to claim.

This block exists because the open-row count was found wrong three separate times, each
time in a place the previous fix had not looked. If you add a sentence to this file that
states one of these counts **in one of the two shapes**, you do not need to update
anything: the guard will tell you if you got it wrong. If you state it some other way, it
will not — so use one of the shapes.
