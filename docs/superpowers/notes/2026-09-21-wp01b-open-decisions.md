---
project: codebase-inspector
title: WP-01b — open decisions for the repository owner
date: 2026-09-21
branch: feat/wp-01-codebase-city
status: awaiting decision
---

# WP-01b — four decisions that are the owner's, not the implementation's

This work package deliberately did not act on the four items below. Each is either a scope
change, a frozen-contract change, or a finding whose remedy the plugin cannot reach. They
are recorded here because the execution ledger that held them is scratch and does not
survive the branch.

Nothing here blocks the branch. Every item is additive.

## 1. F2 — about a third of the ground plate is bare

**Measured, on a real scan of this repository:** root district occupancy **64.2 %**
(own area 1,016,060 against used area 652,244), 90 districts, maximum depth 5, and
`MAX_DIRECT_SUBDISTRICTS` aggregation never triggering.

Four measurements were taken before concluding anything, because the first two cleared the
layout and the visible defect did not go away:

| Measurement | Result |
| - | - |
| District extent against contents' bounding box | Tight to exactly `2 × DISTRICT_PADDING`, every district, every depth |
| Occupancy, three synthetic fixtures | 83.6 % flat, 70.1 % heterogeneous, 62.2 % nested |
| Centring — district centre against contents midpoint | Exact zeros, but **the measurement is tautological**: `districts.ts:318` computes the centre *as* the midpoint of the extent, so it could not have returned anything else. Not counted as evidence. |
| Occupancy on a real scan | **64.2 %** — the closest any figure came to the 60 % line, trending downward with every step toward realism |

**What this means.** Occupancy says *how much* is empty, not *where*. Shelf packing
concentrates its waste rather than distributing it — leftover width at the ragged right
edge of each row, leftover height under every item shorter than its row, and a partial
final row forming one contiguous band along an edge. `districts.ts:195` states the
mechanism in its own comment: *"items are heterogeneous nested boxes and a shelf row is as
tall as its tallest member."* A 36 %-empty plate whose waste is concentrated that way, seen
in isometric projection, is consistent with the large empty foreground in the owner's own
screenshots.

Stated as a hypothesis consistent with the evidence, **not as a proven cause.**

**Why it was not fixed.** The remedy is a change to the packing algorithm, which touches
layout determinism, every pinned layout test, and the bounds the camera frames. That is
materially more than this work package budgeted, and the aggregate benefit is aesthetic
rather than correctness.

## 2. F14 — screen S11 specifies a "Retry 3D" control that does not exist

`screens/s11-fallback.md` lists **"5. Retry 3D"** as a layout zone, and its interaction
table specifies *"Retry 3D → Reinitialize the renderer only; do not scan."*

Established by capturing the genuine WebGL-failure path — Chromium launched with WebGL
disabled, verified empirically to deny a `webgl2` context, against the resting screen:

- **Zone 1 is present.** `CityViewport` renders COPY-14, *"The 3D view is unavailable. File
  inspection still works."*
- **Zone 5 is absent.** One grep hit for "retry" in the entire tree, and it is a comment.

**Why it was not built.** It is new behaviour, and it brushes against the renderer port's
own rule — *"NO `restored` event and NO self-healing… Ship `debugLoseContext`; do NOT ship a
restore partner."* That rule is about automatic recovery rather than a user-initiated
retry, but closely enough that the distinction is the owner's to draw.

## 3. `SourceIdentity` — naming the open codebase needs a frozen-contract field

S05's layout zone 1 is a *"Profile/search/scan toolbar"*. The Scan control and the settings
entry shipped; the identity block did not.

**The gate:** `CodebaseProfile.name` is reachable only behind the host-only `ProfileStore`
port. Verified by grep — `ProfileStore` and `CodebaseProfile` are imported in `src/host/**`,
`src/adapters/**` and `src/domain/validator.ts`, never in `src/ui/**`. `CityStoreState`
holds `snapshot`, and `CodebaseSnapshot` carries `scope.rootPath` but no name.

**What it would take:** a `name` field on `CityStoreState`/`CityViewState`, populated by
`city-view.ts` from the resolved profile. That is a §4 contract change and therefore the
owner's decision.

## 4. Contrast — no skinned control in this view has a perceptible hover

Measured in the harness with the WCAG linearized formula, both themes:

| Pair | Dark | Light | Required | |
| - | - | - | - | - |
| `--ci-text` on `--ci-surface` | 11.93:1 | 15.91:1 | 4.5:1 | pass |
| `--ci-text-muted` on `--ci-panel` | 7.22:1 | 6.19:1 | 4.5:1 | pass |
| `--ci-on-action` on `--ci-action` | **4.26:1** | **3.43:1** | 4.5:1 | **fail** |
| `--ci-raised` against `--ci-panel` | **1.03:1** | **1.04:1** | 3:1 | **fail** |

**Two things make this more than a token curiosity.**

First, `--ci-raised` is the hover surface of **six** skinned controls — the view-mode
toggle, the drawer close, the toolbar Scan button, the file-list group focus, both
selection-notice buttons, and the camera control group. At 1.03:1 the entire skinned-button
hover vocabulary is imperceptible, not one control. The file-list row reads only because it
hovers from *transparent* to `--ci-panel`, not because the token works.

Second, and sharper: the design's own token table at
`foundations/03-design-system.md:42` specifies `--ci-on-action` → `--text-on-accent`
**"with actual host contrast validation."** The design anticipated exactly this risk and
asked for the check. The check has now been run, for the first time, and it fails.

**Why it was not fixed.** Both failing pairs are pure aliases of Obsidian's own
`--text-on-accent`, `--interactive-accent` and `--background-primary-alt`
(`styles.css:10`, `:15`). Spec 4.4 forbids redefining a host `--background-*`/`--text-*`/
`--interactive-*` variable. The failure is inherited from the host's default theme and
cannot be corrected without breaking that rule.

**The options, as they stand:** accept it as a host-theme consequence and record the
limitation; introduce a plugin-owned hover token, which is a §4.1 palette change; or raise
it upstream against Obsidian's defaults.

**Decided (WP-02 Part 5, ruling T32): option B, plugin-owned derived tokens.** `kit.css`
derives `--ci-action-fill`, `--ci-danger-fill` (with 72 % hover variants) and `--ci-hover`
by mixing host variables; no host variable is redefined, so spec 4.4 holds. Every
`mod-cta` and `mod-warning` button in the view, the welcome action, the selected file row
and every skinned hover now use them. The measured ratios after the change are in the
Part 5 Task 16 report.

## Two parked residuals

Neither was fixed, because the branch's single authorised fix wave had already run.

- **The two filter-notice button labels fail open.** They are derived from `COPY_30` by
  locating `' Reveal file or clear selection.'` and splitting on `' or '`. A future
  catalogue reword containing one `' or '` but not matching that anchor would silently
  produce verbose nonsense labels. The test meant to cover this is **circular** — it
  compares the rendered button to the same derived export. One line fixes it: pin the
  literal `Reveal file` and `Clear selection` against the derived exports.
- **`2026-09-20-wp01b-acceptance-spine.md` paraphrases one test name.** It quotes
  *"and still loses to a scoped user snippet"*; the real name is *"and still loses to a
  user snippet scoped to our own root"*. The test exists and does what the row claims.
