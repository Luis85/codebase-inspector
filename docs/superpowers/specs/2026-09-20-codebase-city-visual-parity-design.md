---
project: codebase-inspector
title: WP-01b — Codebase-city visual parity with the design package (design)
status: approved
date: 2026-09-20
branch: feat/wp-01-codebase-city
baseline: b306019
---

# WP-01b design — visual parity of the codebase city

This document records the decisions agreed before implementation. It is a new work
package on top of WP-01, not a continuation of WP-01's task plan. WP-01 is functionally
complete: `npm run verify` exits 0 at 981 passed / 1 skipped over 91 files, and the user
has run the release demo in a real Obsidian host and reports it functionally correct.

Section 11 records what this document establishes and what it does not.

## 0. Precedence

Spec `2026-09-17-codebase-inspector-wp01-design.md` §0 governs this work unchanged. Its
six ranks are not restated here. Two rulings extend it.

### 0.1 Ruling P1 — `interactions/` and `foundations/` sit at rank 5

WP-01's §0 ranks the screen specifications and component library at 5 and the v1.1
handoff at 4. It does not explicitly place `docs/concept/design/interactions/` or
`docs/concept/design/foundations/`. **They sit at rank 5, alongside the screen specs and
component library** — subordinate to the v1.1 handoff at rank 4 where it refines them,
and above the mockup PNGs at rank 6.

Grounds, in order of weight:

1. `screens/s05-city.md` — itself rank 5 — cites `interactions/02-states-and-recovery.md`
   and `interactions/04-microcopy.md` as the normative sources for its own states and
   copy, and `foundations/04-accessibility-and-responsive.md` for its accessibility
   requirements. A document cannot rank below the document that defers to it.
2. WP-01's ledger already grounded two Critical findings in `interactions/04-microcopy.md`
   and treated it as authoritative. P1 makes that precedent explicit and general rather
   than leaving the next reader to rediscover it.
3. Rank 6 is reserved for composition-only and never-behavioural sources. Both
   directories are prose contracts, not compositions.

### 0.2 Ruling P2 — spec §5.2 outranks `foundations/04`'s responsive bands

`foundations/04` gives five responsive bands (≥1180 / 900–1179 / 640–899 / 420–639 /
<420 px). `src/ui/responsive.ts` implements two thresholds, `MIN_INLINE_SIZE = 320` and
`DRAWER_MAX_INLINE_SIZE = 820`, and both come from WP-01 spec **§5.2**, which sits inside
rank **2**. Rank 2 beats rank 5.

**The divergence is therefore not a defect and no task addresses it.** What survives from
`foundations/04` is only what §5.2 is silent on: behaviour at 200% text zoom, internal
scrolling of dialogs and inspectors, and primary actions remaining reachable at every
width. Those are in scope, in wave 3.

P2 is recorded because the divergence looks exactly like a defect on first reading, and
finding it costs an implementer an afternoon before the precedence check rescues them.

## 1. What "parity" means here, and what it does not

**The target is composition, tokens and encoding. It is not pixels.** The design package
says so in its own words: `screens/s05-city.md` calls itself *"a visual specification"*,
calls the screenshot *"a reference composition rather than a fixed resolution
requirement"*, and calls the host chrome *"an illustrative context, not a pixel-perfect
specification of Obsidian itself."* WP-01 spec §0 rank 6 says **"Mockup PNGs —
composition only."**

The operative distinction, which every task brief repeats verbatim:

> A finding of the form *"our render differs from `s05-city.png` at these coordinates"*
> is **not** a defect. A finding of the form *"the design system specifies X and we do
> Y"* **is**.

### 1.1 Ruling P3 — mockup-only elements are in scope

Rank 6 grants the mockups authority over composition, and WP-01 spec §0 glosses
composition as zone order, relative emphasis, and **what is present**. An element visible
in a mockup is therefore specified as present even where no rank-5 prose repeats it.

This admits, specifically: the canvas title block (`STRUCTURE · PHYSICAL INVENTORY` /
`Codebase city` / `144 files grouped into 6 directory districts` / a `Read-only snapshot`
badge), the file-type badges on list rows, and the `/` hint in the search field.

It does not admit geometry, coordinates, dimensions, or the mockup's own font sizes —
`foundations/03` explicitly warns that the mockups' *"small captions and host chrome are
not an instruction to make important product copy 9 px."*

### 1.2 Screen scope

All seven city screens: **S05** dark, **S06** light, **S07** selected, **S08** search,
**S09** top, **S10** narrow, **S11** WebGL fallback. They share nearly all their DOM, so
the incremental cost over S05 alone is verification effort rather than implementation,
and covering them closes accessibility-matrix rows that are currently NOT PERFORMED.

### 1.3 Out of scope

- Any §4 contract change (§4.1–§4.5). See section 4.
- The responsive bands (ruling P2).
- Everything WP-01 §1 already excludes: lenses, analyzers, findings, coverage,
  dependency relations, note writing, snapshot comparison, source-opening.
- The scan-speed trade (M108). It remains the user's open decision.
- Merging to `main`. The user has ruled that this work lands on
  `feat/wp-01-codebase-city` and the branch merges once, later.

## 2. Authoritative sources, and two that are not targets

| Source | What it settles |
| - | - |
| `interactions/03-evidence-and-visual-encoding.md` | Encoding rules: city/district/building/footprint/height/colour semantics, the height formula, the unknown-value rule |
| `components/design-tokens.css` and `.json` | The token bridge |
| `components/component-library.md`, `component-contracts.json` | C01–C12 ids, inputs, events, states, behaviour |
| `screens/s05`–`s11` | Layout zones, components present, per-screen states |
| `foundations/03-design-system.md` | Type scale, spacing grid, radii, theme mapping, city styling |
| `foundations/04-accessibility-and-responsive.md` | Accessibility targets, dialog and drawer rules, announcements — **except** the responsive bands (P2) |
| `validation/design-review-checklist.md` | The acceptance spine (section 6) |
| `mockups/s0*.png` | Composition only: zone order, relative emphasis, what is present |

**Two sources are records of what someone else checked, not targets for us:**

- `validation/render-checks.json` records the *prototype's* headless-Chromium render.
- `validation/reference-contrast-checks.json` measures six text pairs from the
  *prototype's reference palette* — `#ecebf0` on `#232326`, `#282631` on `#fcfcfd`, and
  four more. **We resolve every colour from host semantic variables** and own exactly one
  palette, the ten `--ci-cat-*` swatches. Those six ratios are unreachable and
  unfalsifiable for us. The real contrast obligation is measuring *our* pairs in real
  themes, which is the open G4/G7 matrix, and it lives in wave 3.

## 3. Baseline

Captured 2026-09-20 from the user's own Obsidian host (1.13.7) at `b306019`, in a
**pop-out window**: dark, light, selected, search-filtered, and narrow. These are the
only images of this plugin rendering that exist. Every finding below is grounded in them
plus the source, not in inference from source alone.

### 3.1 Visible defects

| | Finding | Source violated |
| - | - | - |
| F1 | District labels collide. `src`/`application`/`commands` stack into illegible overlapping text; `domain`/`asset` overlap. Labels are bare DOM text with no chip and no file count; the mockup shows chips carrying name and count. | `foundations/03` city styling; mockup composition (P3) |
| F2 | The ground plate is substantially larger than the built area — the lower half of the diamond is empty. `camera-framing.ts` already frames the projected silhouette of `layout.bounds` correctly; `computeBounds` derives those from **district extents, root district included**. The dead space is a packing fact, not a camera fact. | Composition; `s05` layout zone 3 |
| F3 | In light theme the ground plate and the page background are both near-white, leaving almost no figure/ground separation. The tokens are correct; the rendered result is not. | `foundations/03` "Ground/district surfaces derive from host neutral surfaces"; `s06` |
| F4 | File-list rows break mid-word: `presentation/views/GeometrySidecarVie` / `w.ts`. | `foundations/04` "Preserve the full path through wrapping" |
| F5 | Eleven camera buttons occupy a full-width row below the stage, wrapping to two rows in a narrow leaf and consuming stage height. The inventory is correct per `C09`; the placement is not. | Mockup composition (P3); `foundations/03` layout |
| F6 | The legend prints all ten categories when only two are present in the city. | `C11`; mockup composition |

### 3.2 Missing against rank 4/5 contracts

| | Finding | Source violated |
| - | - | - |
| F7 | The toolbar has no source or profile identity, no Scan, no settings. `COPY_07` ("Scan codebase") reaches a user only inside the scope modal. | `s05` layout zone 1, "Profile/search/scan toolbar"; `s05` interaction table row "Scan" |
| F8 | No canvas header block. | Mockup composition (P3) |
| F9 | The file list has no panel header, never applies `grouping`, and offers no surface for `directoryFocusRequested`. Its flat list of full-path buttons is otherwise the **correct** shape — `C07` states "native list buttons are preferable to an incomplete ARIA tree" and requires duplicate basenames be disambiguated. | `C07` inputs and events |
| F10 | The legend names metric, scale and cap but not **aggregation**, and never explains the **equal-lot meaning**. | `C11` "Names the raw metric, aggregation, scale, and cap"; checklist row (section 6) |
| F11 | The footer shows relative age only ("Snapshot retained from just now"), with no absolute time, no included-file count and no district total. | `C12` "Absolute time and scope are available in details" |
| F12 | The inspector shows the basename only — no full path, no scope. | `C10` "Keep exact raw values and scope"; `foundations/04` |
| F13 | "The selected file is outside these filters. Reveal file or clear selection." names two actions as prose. Neither is a control. | `foundations/04`; `interactions/04` |

### 3.3 Assessed and found compliant

Recorded so no later task "fixes" them.

- **`src/domain/layout/scale.ts`.** It replaces the reference fixture's fixed 600-line cap
  with a p95-derived cap. `interactions/03` permits this explicitly — *"Production may
  choose another explicit scale, but it must preserve the metric definition, display cap,
  exact raw values, and legend"* — and it preserves all four, applying one global cap
  rather than a different scale per district. **T13 pins those four properties.** The
  constants are not to be reverted.
- **`camera-rig.fit()` and `camera-framing.ts`.** Arithmetically correct and already
  fixed once. F2 is not a camera defect and no task may change `fit()`.
- **Camera control inventory.** Zoom ±, rotate ×2, pan ×4, Fit, Top, Focus satisfies
  `C09`'s `stepRequested` and `foundations/04`'s non-drag single-pointer requirement.
  Only placement is at issue (F5).

## 4. Frozen contracts

**No §4 contract (§4.1–§4.5) may change. Only the user may change one.** If a task finds
parity appears to require one — a new category colour, a renderer-port signature, a
`CityViewState` field — it **stops and raises it**. It does not design around it.

The binding WP-01 rulings, each restated in the brief of any task touching its area:

- **M113 — the specificity rule.** Keep the `:where(.codebase-inspector-root)` wrapper and
  add the element type selector Obsidian's own rule uses, giving (0,1,1): ties Obsidian,
  wins on document order, stays below a root-scoped user snippet at (0,2,0). Nothing
  exists strictly between, so the shape is forced. **Any rule raised this way is checked
  for whether it now also ties `button:hover`** — three controls silently lost their hover
  affordance exactly that way.
- **M116 — `.ci-search__input` stays host-styled**, and its tripwire test stays. A full
  re-skin is a design decision for the user, not a fix.
- **A1 — the ten `--ci-cat-*` colours are the one plugin-owned palette**, declared as CSS
  custom properties, crossing into WebGL only through `cssColorToSrgbBytes`. An eleventh
  is a §4.1 contract change.
- **The colour rule, lint-enforced.** Do not call `convertSRGBToLinear()`. `new Color()`
  has converted sRGB→working since r152; the extra call is silent and renders 2–3×
  darker.
- **M103 — the label density budget.** A label draws only when its district's projected
  footprint is large enough to read. **T1 changes label presentation, not the threshold.**
- **M114** — no `applySize` clamp. **M118/M119** — the `mayPublish` guard stays.
- **The stage height is `height: 100%`, never `min-height`.** `min-height` never makes a
  height definite; that bug drove the view to ~32,000 px.

**Bars that do not move:** the tree carries exactly **two** `eslint-disable` lines and
**one** `@ts-expect-error`; every task verifies and states the numbers. No lint rule
weakened. **No test loosened** — a test asserting current-but-wrong behaviour is a finding
to report with its citation, not a test to edit.

## 5. Work structure

Four waves. Ownership is disjoint within a wave.

### Wave 0 — the visual harness

**The problem it solves:** at baseline, the only images of this plugin rendering are five
screenshots the user took by hand. Every parity claim in every later wave would otherwise
be either inference from source or a request for the user's time. jsdom draws nothing, so
the 981-test suite cannot see a layout defect at all.

**The source to copy from is `C:\Projects\renovation-planner`**, which has run this
pattern long enough to have paid for its mistakes. Its shape, and what transfers:

| Piece there | What it does | Here |
| - | - | - |
| `vite.harness.config.ts` | Dev server rooted at `tests/harness`, aliasing `obsidian` to the same mock the suite uses, serving the real stylesheet from disk so what is on screen is the CSS being edited and never a stale build | Same, minus the partial assembler — our `styles.css` is one file |
| `tests/harness/index.html` + `obsidian.css` + `theme.ts` | The page: Obsidian's real vendored `app.css` first, so element defaults (button chrome included) are the host's, then the theme class, then our sheet | Same. `obsidian.css` is vendored from the installed `obsidian.asar`, kept whole, and the version it came from is recorded |
| `tests/harness/entries.ts` + `IndexPage.vue` | Named surfaces, selectable by query parameter, each with its own knobs | Ours are the seven screens of §1.2 plus theme and width |
| `scripts/harness-shot.mjs` + `chromium.mjs` | Headless capture over a named SHOTS array into `harness-shots/`, waiting on a per-surface readiness selector rather than "the page loaded", exiting non-zero on a page or console error | Same, with a readiness mark that means *the city has drawn*, not *the canvas element exists* |
| `tests/harness/harness.test.ts` | Keeps the harness alive under `npm run test`, since the harness itself is deliberately outside the gate | Same |

Two rules carried over verbatim from that project, because both were learned expensively
there: **`playwright-core`, never `playwright`** (the latter downloads browsers on
`npm install`, which must not happen on a machine with no browser), and **no
browser-layout literal is written down** — `chromium.executablePath()` is asked, never
mirrored, because a hand-mirrored per-platform table broke on Windows when Playwright
renamed its build directories.

**This is not a test.** It draws; it asserts no appearance; there is no baseline to diff
against. It stays outside `npm run verify`, exactly as it stays outside `npm run check`
there. Its only automatic claim is that the page did not fall over while being
photographed.

| Task | Deliverable |
| - | - |
| **T0a** | **Spike: does headless Chromium draw our city?** The surfaces in the source project are DOM; ours is a WebGL canvas, and headless Chromium renders WebGL through SwiftShader, which may need explicit flags or may not work at all. Output is an answer, not code to keep. **The rest of wave 0 is conditional on it.** |
| **T0b** | The harness server and page: `vite.harness.config.ts`, `tests/harness/`, the vendored `obsidian.css` with its source version recorded, `npm run harness`. |
| **T0c** | The capture script: `scripts/harness-shot.mjs`, `scripts/chromium.mjs`, `playwright-core` as a devDependency, `harness-shots/` gitignored, and a SHOTS array covering §1.2's seven screens across dark and light. Plus the vitest test that keeps the harness alive. |

**If T0a says no**, T0b and T0c still proceed and still earn their place — the six wave-2
chrome zones are ordinary DOM, and S11's WebGL-unavailable fallback is *precisely* what a
browser with no working WebGL renders. Only the canvas-internal findings (F1, F2, F3, and
T4's selection marker) would stay dependent on the user's eye, and section 8's checkpoints
would keep their current weight for those.

### Wave 1 — renderer and layout

Owns `src/visualization/` and `src/domain/layout/`. T1–T3 parallel; T4 parallel.

| Task | Deliverable | Owns |
| - | - | - |
| **T1** | District label **chips**: name plus file count, background, padding and radius from tokens, and collision handling so overlapping districts do not stack text. Addresses F1. | `label-overlay.ts`, one `styles.css` section |
| **T2** | **Packing footprint.** Measure the root district's extent against the union of its children and make `layout.bounds` describe the built area. Addresses F2. `fit()` is not touched. | `src/domain/layout/` |
| **T3** | **Light-theme figure/ground.** Ground and district surfaces keep deriving from host neutrals, with a measured separation rather than an assumed one. Addresses F3. | `instanced-city.ts`, `city-renderer.ts` |
| **T4** | **Selection = outline plus locator marker.** Determine whether the tall translucent column in the baseline is the locator marker `foundations/03` requires. If it is, the task reports a finding and changes nothing. | `instanced-city.ts` |

T1 is the one wave-1 task needing `styles.css`. It lands before wave 2 opens, so there is
no contention — but wave 1 is "3 parallel plus 1", not 4.

### Wave 2 — chrome

Owns `src/ui/`. **Serialized**, because all six tasks edit `src/ui/styles.css` (498 lines,
one file) and the alternatives — splitting it with a `vite.config.ts` concatenation step,
or reorganising it into owned sections — both cost more than the wall-clock they save.
Splitting touches the build, which is spec rank 1, and would oblige every task to prove
`dist/styles.css` unchanged apart from its own rules.

| Task | Deliverable |
| - | - |
| **T5** | Toolbar zone 1: source identity, Scan, settings. Addresses F7. |
| **T6** | File list: panel header, `grouping` applied with per-district counts, a `directoryFocusRequested` surface, mid-word wrap fixed. Addresses F9 and F4. |
| **T7** | Canvas header block: eyebrow, title, subtitle, read-only badge. Addresses F8. |
| **T8** | Legend and footer: present categories only; aggregation and equal-lot meaning named; absolute time, included-file count and district total in the footer. Addresses F6, F10, F11. |
| **T9** | Inspector: full path and scope; "Reveal file or clear selection" becomes two real controls. Addresses F12 and F13. |
| **T10** | Camera controls: compact overlaid group, full inventory retained. Addresses F5. |

**Line caps are budgeted, not discovered.** `App.vue` is at 395/400 and both T5 and T7 add
to it, so each **extracts a component** rather than growing the file. `CityViewport.vue`
397, `city-view.ts` 396, `city-renderer.ts` 396, `camera-rig.ts` 396;
`tests/component/renderer-contract.test.ts` is at **450/450 — the next line fails lint**,
and `city-viewport.test.ts` at 448/450.

### Wave 3 — verification

| Task | Deliverable |
| - | - |
| **T11** | The manual accessibility matrix: dark, light, one third-party theme, 200% text zoom, narrow leaf, keyboard-only. Records pass/fail/not-run per row, never assumed compliance. The third-party theme is the highest-value row: M113's specificity scheme has never met a theme that fights it. |
| **T12** | Pin shipped copy to `interactions/04-microcopy.md`. No copy string in this plugin is bound to the catalogue by any test today. |
| **T13** | Pin `scale.ts`'s four preserved properties (metric definition, display cap, exact raw values, legend) and the one-scale-across-districts rule, so the derived cap is not "corrected" back to 600. |

## 6. Acceptance spine

`validation/design-review-checklist.md`, sections **"City and inspection"** and **"Host
behavior"**. Each row gets a named verdict with evidence, not a tick. Three carry the
work:

- *"Height metric/scale/cap and equal-lot meaning are explained"* — **failing at
  baseline** (F10). Closed by T8.
- *"Category, selected, changed, warning, and unknown states are distinguishable"* — T3
  and T4. "Changed" is a comparison state outside WP-01 scope and is recorded
  **not-applicable**, not passed.
- *"Light/dark/custom theme changes preserve state and readable selection"* — T3, then
  T11's third-party theme.

Rows already satisfied at baseline are recorded as such with their evidence, so the
checklist reads as a verdict on the whole, not a diff.

## 7. Evidence every task produces

Standing bars: `npm run verify` exits 0; the `eslint-disable` and `@ts-expect-error`
counts verified and stated as numbers; no lint rule weakened; no test loosened.

Every brief additionally carries, verbatim, the three things this branch paid to learn:

1. **The production-caller sweep, with both questions.** (1) Does anything in `src/` — not
   `tests/` — call this? **and** (2) does the thing that calls it ever actually happen to
   a user? This branch shipped ten capabilities no user could reach; one passed a per-task
   review, a whole-branch review and a scoped re-review.
2. **Mutation-verifying a guard means breaking the thing it watches, not the guard.**
   Three guards on this branch could not fail at all — one after being mutation-verified
   and reported as working, because `\b` inside a template literal is a backspace
   character. A green test is evidence only once its hazard has been made real and watched
   go red.
3. **`npm run verify` also runs `lint:fast` (oxlint)**, which raises warnings `npm run
   lint` does not. Passing lint alone is not sufficient evidence.

**From wave 1 onward, every task that changes something visible attaches a harness capture
of the surface it changed, before and after**, labelled as a harness capture (section 8).
A task whose change cannot be photographed says so and says why.

Each brief also carries its relevant design sources, the section-4 rulings binding its
area, its explicit file ownership, the TDD requirement (a failing test precedes
implementation, with the RED output, the GREEN output and the exact command in the
report), the no-subagents contract, the destructive-git prohibition, and the attribution
line.

## 8. Human checkpoints

**Wave 0 changes what these are for, but does not remove them.** Once the harness exists,
routine visual evidence is a capture an implementer takes and attaches to its own report,
and the user's checkpoints become judgement calls rather than data collection. The harness
runs our view with a vendored `app.css` and no Obsidian: it cannot speak to host
integration, a third-party theme, GPU behaviour on real hardware, or pop-out windows — and
the baseline captures were taken in a pop-out window, which is the case the harness models
least well. Every capture therefore states that it is a harness capture, and no release
claim rests on one alone.

The plan stops twice and asks the user for screenshots and judgement:

- **After wave 1** — labels, packing, light theme, selection. This is also where the user
  judges **`--ci-raised`** by eye: it had no consumer before WP-01's last wave, is now the
  hover surface for three controls, and in default themes sits close to the surrounding
  surface. It has never been looked at.
- **After wave 2** — the whole composition, in dark and light, at the user's own leaf
  width and narrow.

The panel caps that moved the stage from 1,280 to 1,140 px at the user's ~1,876 px leaf
are confirmed or revisited at the wave-2 checkpoint. B2-as-scoped is satisfied; the trade
was never confirmed with them.

## 9. Risks

- **T2 is the dangerous task.** It changes what `layout.bounds` means, and bounds feed the
  renderer port. If it cannot be done without touching a §4 contract, it stops and raises
  it. It does not design around it.
- **T6 likewise.** `C07` declares `grouping` as an input, but if applying it requires a
  `CityViewState` field, that is the user's decision.
- **New controls in T5 and T10 meet M113**, including the `button:hover` tie check.
- **T9 touches the inspector, not the search field.** M116 holds.
- **T7 and T10 both add elements inside the stage column.** `height: 100%`, never
  `min-height`.
- **T1 and T3 both change what the user sees in the canvas.** Neither may call
  `convertSRGBToLinear()`, and T3 may not add an eleventh palette member.
- **The harness can mislead precisely where it is most useful.** It is not Obsidian: no
  host integration, no third-party theme, no real GPU, and a vendored `app.css` that is a
  snapshot of one Obsidian version. A capture that looks right proves the page drew, not
  that it is right in the host. Treating a harness capture as host evidence is the failure
  mode to watch for, and it is why §8's human checkpoints survive wave 0.
- **Wave 0 adds a devDependency and a second Vite config** — build surface, which is spec
  rank 1. `playwright-core` must not download a browser on install, the harness config must
  not alter what `npm run build` emits, and `dist/` must stay byte-identical across the
  whole of wave 0. That last one is stated as a verification, not an assumption.

## 10. Environment

- Use the uppercase drive letter `C:\Projects\codebase-inspector`. When the shell reports
  `c:\...`, Vitest's Windows project-root matching breaks and every test file fails at
  once with a generic `TypeError`. A mass `TypeError` is that artifact; re-run from the
  uppercase path rather than debugging.
- The IDE TypeScript server hits the same artifact and reports spurious `Cannot find
  module 'vitest'`/`'obsidian'` errors. `npm run typecheck` is the truth.
- PowerShell 5.1 mangles `git commit -m` here-strings containing double quotes. Use
  `git commit -F <file>`.
- `grep -P` is unavailable. Grepping `obsidian.asar` needs a **line-based** pattern —
  its CSS has real newlines, so `grep -a -oE "sel\{[^}]*\}"` matches nothing and looks
  exactly like absence. Use `grep -a -n -A6`.
- Three Obsidian versions are in play: 1.12.4 installed locally, 1.13.1 the types package,
  **1.13.7 the user's host**. Every claim says which one it rests on.
- Three files carry CRLF while the tree is LF: `tests/component/city-viewport.test.ts`,
  `tests/host/window-migration.test.ts`, `tests/component/settings-tab.test.ts`. Use
  `git diff --ignore-all-space` when one changes.
- Grep changed files for NUL bytes before committing. Tool and shell escaping injected one
  in four separate WP-01 rounds.
- **Never write to the user's real `data.json`** at
  `C:\Projects\renovation-planner\.obsidian\plugins\codebase-inspector\data.json`.

**Destructive git — the rule, not a list.** Restore a file only by copying from a plain
backup taken **immediately before** the mutation, not at the start of the round. **No git
verb restores a file, whatever it is called** — not `checkout`, `checkout-index`,
`restore`, `stash pop` or `reset`. Also prohibited: `git reset --hard`, `git clean`,
`--force` anything, `git stash`, and `git commit --amend` on an existing commit (amending
one's own just-created commit to fix attribution is the sole exception). Report a tree
state you want to undo rather than repairing it with git.

## 11. What this document establishes, and what it does not

**Established here:** rulings P1, P2 and P3; the screen scope; the baseline findings
F1–F13, each grounded in a capture from the user's own host on 2026-09-20 plus a cited
source; the three compliant assessments in §3.3; the wave structure and ownership; the
acceptance spine.

**Not established, and not to be assumed:**

- **That F1–F13 are complete.** They are what a reading of the sources plus five
  screenshots found. S09 (top) and S11 (fallback) have no baseline capture at all, and
  their findings will be discovered during wave 3, not before.
- **Any contrast measurement.** Nothing in this package measures our pairs in a real
  theme. G4 and G7 remain OPEN until T11 records rows.
- **That the third-party theme works.** M113's scheme has never met one.
- **That `--ci-raised` reads as a hover surface.** Never judged by eye.
- **Any claim about the 1,140 px stage being right.** The trade was never confirmed.
- **That headless Chromium can draw our WebGL city.** T0a answers it. The source harness
  in `renovation-planner` photographs DOM surfaces; nothing there establishes that
  SwiftShader renders a Three.js instanced city, and the rest of wave 0's value for the
  canvas-internal findings depends on that answer.
- **That a harness capture is evidence about Obsidian.** It is evidence about our page in
  a browser. G4 and G7 close on T11's host runs, not on `harness-shots/`.

**Carried from WP-01, not re-litigated:** the merge to `main` (the user has ruled this
work lands on the same branch); the scan-speed trade M108 (the user's open decision, with
four gate tests pinning current sequential behaviour).

**Never opened:** `docs/concept/design/wp01-review/docs/08-implementation-agent-prompt.md`
and `docs/concept/design/handoff/agent-implementation-prompt.md`. Both assume a codebase
that does not exist here and propose a three-stream model with a contract-changing
integration owner that WP-01 spec §8 explicitly replaces.
