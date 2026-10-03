---
project: codebase-inspector
title: WP-01b acceptance spine — design-review-checklist verdicts
date: 2026-09-21
branch: feat/wp-01-codebase-city
---

# WP-01b acceptance spine

Spec `2026-09-20-codebase-city-visual-parity-design.md` §6 requires a named verdict,
with evidence, against every row of
`docs/concept/design/validation/design-review-checklist.md`'s **"City and inspection"**
and **"Host behavior"** sections — including rows already satisfied at baseline, so this
document reads as a verdict on the whole rather than a diff against WP-01b's own
findings. This was the one spec §6 obligation the whole-branch review found nobody had
produced; `2026-09-20-wp01b-accessibility-matrix.md` is a different document (spec §11's
manual/harness matrix) and does not substitute for it.

**Every verdict below cites a file, a test name, or a measurement.** A verdict without a
citation is the assumed compliance the previous work package was criticised for, and this
document exists to be the opposite of that. Every citation was re-run or re-read while
writing this document, not transcribed from an earlier claim.

**Harness rows say so.** Several PASS verdicts below rest partly on
`tests/harness/`-driven measurements (the dev harness / `npm run harness-shot`) rather
than a real Obsidian host. The harness runs our own page in a browser with Obsidian
**1.12.4**'s vendored `app.css`; the user's own host is **1.13.7**. Where a verdict leans
on a harness measurement, that is stated explicitly rather than left to be assumed as
host evidence — this is exactly the distinction spec §8/§11 draw between a harness
capture and a checkpoint the user runs themselves.

Verdicts used: **PASS** (the row holds, with citations), **PARTIAL** (part of the row is
evidenced, part is not), **NOT APPLICABLE** (the row names a capability out of WP-01's
scope by spec ruling), **NOT PERFORMED** (nobody has run the check).

---

## City and inspection

### 1. Buildings map to unique normalized file IDs; different basenames do not collide — PASS

An entity's id is `repositoryId`, entity `kind` and the POSIX root-relative `path`,
NUL-joined — never a hash, never a basename alone.

- `tests/unit/entity-id.test.ts`, `'is repository id, entity kind and POSIX
  root-relative path, NUL-joined'` — the id is unique by construction: two files can
  share a basename only if they also share the full path, which makes them the same
  file.
- `tests/unit/entity-id.test.ts`, `'distinguishes a directory from a file at the same
  path'` — the `kind` segment stops a file and its own containing directory (same path
  string) from colliding.
- `tests/component/codebase-file-list.test.ts`, describe block `'task 6: panel header,
  grouping, directory focus, and wrap-at-separator'`, `'still disambiguates duplicate
  basenames'` — two files named `index.ts` under different directories (`src/a/index.ts`,
  `src/b/index.ts`) render as two rows with two distinct labels (`new
  Set(labels).size === 2`), which is C07's own explicit requirement that grouping never
  becomes an excuse to show a bare basename twice.

### 2. Height metric/scale/cap and equal-lot meaning are explained — PASS

**This is the row that was FAILING at baseline** (finding F10: the legend named metric,
scale and cap but never explained the equal-lot meaning). Closed by Task 8.

- `src/ui/copy.ts`, `LEGEND_EQUAL_LOT` — `'One equal lot per file: footprint size
  carries no meaning, only height does.'`, authored for exactly this gap.
- `tests/component/metric-legend.test.ts`: `'names the scale "physical lines ·
  square-root scale"'`, `'names the ACTUAL cap in lines and the clamped count'`,
  `'names the aggregation, not only the metric and scale'`, `'explains the equal-lot
  meaning'` — all four elements the checklist row names (metric, scale, cap,
  equal-lot meaning) are pinned as rendered text, not merely present in source.

### 3. Exact values remain accessible in list/inspector — PASS

- `tests/component/file-inspector.test.ts`: `'shows the RAW values, always — raw lines
  and bytes, not scaled height'`, `'shows the full path, wrapped, not only the
  basename'` (Task 9, closing F12), `'names the scope the values were measured in,
  redacted to a basename'`.
- `tests/contracts/height-scale.test.ts`: `'preserves the exact raw values, which the
  cap never rewrites'` — pins that `scale.ts`'s display cap clamps rendered height only,
  never the value the inspector reads back.

### 4. Unknown measurements are not encoded as zero — PASS

- `src/domain/layout/scale.ts` / `tests/unit/layout-scale.test.ts`, `'gives unavailable
  lots ONE distinct, SMALLER marker footprint'` — an unavailable observation gets its
  own minimum-height marker shape, never a height of zero derived from a missing value.
- `tests/component/metric-legend.test.ts`: `'explains the unknown marker when this city
  has an unavailable lot'`, `'never shows "unavailable" as a category swatch'` — unknown
  is rendered as `CityLot.metricState`, a distinct marker with its own explanation
  (`LEGEND_UNKNOWN_MARKER`), never folded into the category vocabulary or a bare zero.
- `tests/component/file-inspector.test.ts`, `'surfaces the REASON for an unavailable
  measurement'` — the inspector shows *why* a value is missing rather than a numeric
  zero standing in for it.

### 5. Click selects; drag does not also select; focus is explicit — PASS

- `tests/component/picking.test.ts`: `'does not select on release after a drag beyond 5
  CSS PIXELS'`, `'DOES select on release within 5 CSS pixels'`, `'measures the drag
  threshold in CSS pixels, not device pixels'` — a real drag past the WCAG-motivated
  5px threshold never selects; only a genuine click (or a release inside that
  threshold) does.
- `tests/component/codebase-file-list.test.ts`, `'M7: exactly ONE row is in the tab
  order, and it follows the roving focus'` — moving keyboard focus moves the roving
  `tabindex` but explicitly does **not** select (`store.selectedEntityId` stays
  `null`); only Enter/click activation selects (`'does not select on mere focus
  movement'`).

### 6. Search/filter does not arbitrarily reshuffle the city — PASS

- `src/ui/stores/city-store.ts`: `layout` is produced once, by `computeLayout(snapshot)`
  at `setCity()`, and `setQuery`/`setFilter` never call it again — filtering is a
  display-state overlay (`matchingIds`, dimming) over a layout that does not move.
- `tests/unit/city-store.test.ts`, `'keeps a filter-hidden selection SELECTED and
  explains it'` — a selection that falls outside the current filter stays selected
  rather than the view silently re-picking or re-arranging anything.
- `tests/component/codebase-file-list.test.ts`, `'dims non-matches in place rather than
  hiding rows'` — the list-level proof of the same rule: `rows` stays the same length
  and the same order under a query; only the `--dimmed` class changes.

### 7. Category, selected, changed, warning, and unknown states are distinguishable — PARTIAL

- **"changed" is NOT APPLICABLE**, not merely unaddressed: spec
  `2026-09-20-codebase-city-visual-parity-design.md` §1.3 lists "snapshot comparison"
  as out of scope, and §6 states the same ruling directly — `"'Changed' is a comparison
  state outside WP-01 scope"`. WP-01's own spec (`2026-09-17-…-wp01-design.md`) lists
  "snapshot history and comparison" among the capabilities stated out of scope for the
  same reason: there is no second snapshot to compare against.
- **"unknown" is PASS** — see row 4 above (its own marker shape, its own explanation,
  never a category swatch).
- **"category" is PASS** — `tests/component/metric-legend.test.ts`, `'shows only the
  categories actually present in this city, in canonical order'`; the ten
  `--ci-cat-*` swatches (`src/ui/styles.css:46` onward) are the one plugin-owned
  palette (spec §4's frozen ruling A1), each a visually distinct hue.
- **"selected" and "warning" are the open half.** Selection is rendered as an outline
  plus locator, coloured from `--ci-action` (`src/host/theme-bridge.ts:37`,
  `src/visualization/instanced-city.ts:275`,
  `src/ui/copy.ts`'s `LEGEND_SELECTION_OUTLINE` — "Selection is shown as an outline;
  color marks category only"), and a warning banner is coloured from `--ci-warning`
  (`src/ui/styles.css:18`, used at `src/ui/styles.css:609`) — both are *tokens distinct
  from any `--ci-cat-*` swatch* by construction, but **nothing has measured** the
  selection outline's actual rendered contrast against each of the ten category
  swatches, or the warning colour against them. Task 11's contrast matrix
  (`2026-09-20-wp01b-accessibility-matrix.md`, Row 14) measured `--ci-on-action` on
  `--ci-action` and `--ci-raised` on `--ci-panel` — a different pair — not this one.
  **This is a measurement gap, not a known failure**: nothing found the two
  indistinguishable, but nothing looked.

### 8. Directional edges agree with readable edge lists — NOT APPLICABLE

Dependency relations are out of WP-01 scope by spec ruling: spec
`2026-09-17-…-wp01-design.md` states plainly, among what is out of scope, "findings,
coverage, **dependency relations** and runtime evidence", and
`2026-09-20-codebase-city-visual-parity-design.md` §1.3 restates the same list for this
package. There are no directional edges anywhere in this view for a readable edge list
to agree or disagree with — the row names a capability this increment does not build,
not a defect in one it does.

---

## Host behavior

### 1. All CSS is scoped; host globals and base colors are not overwritten — PASS (upgraded from assumed to measured)

**This is the row this package genuinely upgraded** — WP-01 asserted the `:where()`
scoping rule but never counted the sheet; this package measured it.

- **83 of 83 rule blocks in `src/ui/styles.css` are `:where(.codebase-inspector-root)`
  -wrapped; zero are unwrapped.** Re-derived independently while writing this document
  (two corroborating methods, matching `2026-09-20-wp01b-accessibility-matrix.md`'s own
  derivation and Ruling 37's independent third derivation):
  ```
  node -e "
  const fs = require('fs');
  const css = fs.readFileSync('src/ui/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const pattern = /([^{}@]+)\{([^{}]*)\}/g;
  let m, total = 0, whereWrapped = 0;
  while ((m = pattern.exec(css)) !== null) { total += 1; if (m[1].trim().includes(':where(')) whereWrapped += 1; }
  console.log(total, whereWrapped);
  "
  ```
  gives `83 83`.
- `tests/unit/host-cascade.test.ts` pins the *mechanism* that scoping depends on: every
  plugin-skinned control is raised to exactly the specificity that beats Obsidian's own
  default and still loses to a user snippet scoped to the plugin root (`'and still loses
  to a user snippet scoped to our own root'`, `'keeps the zero-specificity scope, which is what the user
  snippet wins against'`) — `:where()` is not merely present, it is the thing every
  raised rule is checked against.
- **The token bridge aliases, never redefines.** `src/ui/styles.css:4-18` declares every
  `--ci-*` token as `var(--background-*|--text-*|--interactive-*, …)` — a pointer at the
  host's own custom property, never a literal color that would overwrite it. Spec
  `2026-09-17-…-wp01-design.md` §4.4 forbids redefining a host
  `--background-*`/`--text-*`/`--interactive-*` variable directly; the bridge complies
  by construction (nothing in `src/ui/styles.css` or `src/host/theme-bridge.ts`
  assigns to one of those names — it only reads them).

### 2. Light/dark/custom theme changes preserve state and readable selection — PARTIAL

- **Dark and light are EVIDENCED**, harness-only:
  `2026-09-20-wp01b-accessibility-matrix.md` Rows 4–5 — `npm run harness-shot` produced
  7 dark-theme and 4 light-theme captures with zero page/console errors; building
  colours and composition repaint correctly under both. Row 14 gives measured contrast
  ratios for both themes (`--ci-text`/`--ci-surface`: 11.93:1 dark, 15.91:1 light, both
  PASS WCAG AA; `--ci-on-action`/`--ci-action`: 4.26:1 dark, 3.43:1 light, both **FAIL**
  the 4.5:1 normal-text requirement — a real defect this document does not re-litigate,
  see F18 in the matrix).
- **State preservation across a theme change is PASS**, at the mechanism level:
  `tests/host/city-view-store-wiring.test.ts`, `'calls setColors again on a css-change
  event'` — a host theme change re-reads the palette and re-applies colour only; it
  never touches the Pinia store's selection, query or camera state, which live in a
  separate module entirely.
- **Custom (third-party) theme is NOT PERFORMED.** Task 11 was explicitly told not to
  go looking in the user's own vault for a theme to test with, and none was substituted
  (`2026-09-20-wp01b-accessibility-matrix.md` Row 6). M113's specificity scheme has
  never actually met a theme that fights it.

### 3. Two leaves maintain independent camera, query, selection, and panel state — PASS

- `tests/host/multi-leaf.test.ts`: `'keeps selection independent between two city
  leaves'`, `'keeps query, camera and inspector state independent'`, `'gives each leaf
  its own Pinia instance'`, `'gives each leaf its own renderer and its own WebGL
  context'` — all four state categories the row names, pinned individually, at test
  level (real `CityView` instances over Obsidian doubles, not a host run).

### 4. Pop-out migration uses the owning document/window — PASS

- `tests/host/window-migration.test.ts`: `'is signalled by HTMLElement.onWindowMigrated
  on containerEl'`, `'creates every DOM node in the NEW window, never the old one'`,
  `'uses node.instanceOf(T) for DOM type checks, because instanceof is false across
  windows'`, `'re-reads the palette and the reduced-motion preference in the new
  window'`, `'rebuilds the ResizeObserver in the new window after migration'`, `'moves
  the Escape shortcut to the new document after migration'` — at test level, over a
  genuinely separate jsdom realm standing in for the pop-out window.

### 5. Closing a view cancels frames, listeners, observers, and GPU resources — PASS

- `tests/host/lifecycle-leaks.test.ts`: `'leaves no requestAnimationFrame handle, no
  timer, and no active render loop'`, `'leaves no observer'`, `'leaves no event
  handler'`, `'releases the matchMedia change listener with the view'`, `'releases the
  css-change subscription with the view'`, `'survives ten open/close cycles with zero
  live WebGL contexts'` — every resource category the row names (frames, listeners,
  observers, GPU) has its own pinned assertion, plus a repeated-cycle proof that
  nothing accumulates.

### 6. Hidden leaves pause unnecessary rendering — PASS

- `tests/host/lifecycle-leaks.test.ts`, `'pauses drawing and input for a hidden leaf,
  and NEVER scans on resume'` — a leaf that leaves the visible tab set stops drawing
  and, critically, resuming visibility never triggers a scan (spec 4.2/4.5: reopening a
  view never authorises one).
- `tests/host/lifecycle-leaks.test.ts`, `'costs nothing for a zero-size leaf'` — the
  same pause mechanism covers the zero-dimension case a hidden leaf can present.

### 7. Keyboard input in a Markdown editor is not intercepted by inspector controls — PASS

- `tests/unit/keymap.test.ts`: `'is refused when the view does not own focus'`, `'is
  refused when the event target is itself editable'` — the camera-key mapping fires
  only while this view's own stage element is the document's active element, and never
  when the event's own target is an editable surface (a Markdown editor included).
- `tests/unit/escape-intent.test.ts`, `'does nothing in an unrelated editable surface'`
  — the Escape handler carries the identical refusal.
- `src/ui/components/CameraControls.vue`'s own header comment states the mechanism
  this pins: key handling "only ever listens while the canvas stage element … is the
  document's own active element — never a host-wide Obsidian command/hotkey"; this
  component never imports `'obsidian'` at all, so it has no way to register a
  host-level hotkey that could compete with the editor in the first place.

---

## Summary

| Verdict | Count | Rows |
| - | - | - |
| PASS | 12 | City 1–6; Host 1, 3, 4, 5, 6, 7 |
| PARTIAL | 2 | City 7; Host 2 |
| NOT APPLICABLE | 1 | City 8 |
| NOT PERFORMED | 0 (folded into the two PARTIAL rows above) | — |

Fifteen rows total (8 "City and inspection" + 7 "Host behavior"), matching
`docs/concept/design/validation/design-review-checklist.md` exactly. Twelve are
callable now, with citations, including the one row that was failing at baseline
(City 2) and the one row this package upgraded from an assumed rule to a measured one
(Host 1). The two PARTIAL rows are not close calls dressed up as measured — City 7's
gap (selection-vs-category contrast) and Host 2's gap (custom theme) are both concrete,
namable, and left open rather than rounded up.
