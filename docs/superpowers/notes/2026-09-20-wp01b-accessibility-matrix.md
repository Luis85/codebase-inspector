# WP-01b accessibility matrix — measured, not assumed

Recorded by Task 11 (the last task of `2026-09-20-codebase-city-visual-parity`), per
Ruling 33 in `progress.md`. **This document produces evidence, not features.** Nothing
in `src/` was changed to produce it; anything found here that looks wrong is reported
as a finding for the user to decide on, not fixed in place.

## Read this first: two different instruments, never blurred

This branch's wave 0 built a real browser harness (`npm run harness`,
`npm run harness-shot`) that mounts the actual `src/ui/App.vue`, the actual
`src/ui/styles.css`, and a **vendored copy of Obsidian's own `app.css`**, in a real
Chromium, with WebGL genuinely available (or genuinely disabled, for one shot). That
harness produces real, reproducible measurements about **our page rendered by a real
browser engine**. It is not Obsidian. It has no vault, no workspace, no other plugins,
no real GPU driver, and no screen reader attached to it.

Two Obsidian version numbers matter here and are never conflated:

- **1.12.4** — the version `tests/harness/obsidian.css` was extracted from
  (`resources/obsidian.asar`, 2026-09-20). Every harness-evidenced row below rests on
  this version's default theme tokens.
- **1.13.7** — the user's own installed host. `manifest.json` declares
  `minAppVersion: "1.13.0"`. No claim below is evidence about 1.13.7 specifically; where
  the two could plausibly differ, the row says so.

Rows below are one of three kinds, stated explicitly on every row:

- **EVIDENCED (harness)** — a real measurement taken in the browser harness this task
  ran itself, with the exact numbers, selectors, or files that produced it.
- **SPLIT** — part of the row is harness-checkable (and evidenced), part genuinely
  requires the real host and is NOT PERFORMED.
- **NOT PERFORMED** — requires a human in real Obsidian 1.13.7 (or, for the third-party
  theme row, a human's own choice of theme). Each such row states precisely what that
  person must do.

No row below claims screen-reader, host-keybinding, or human-perceptual compliance from
a browser harness. That was the previous accessibility matrix's own recorded failure
mode (`docs/superpowers/notes/2026-09-17-wp01-accessibility-matrix.md`: "No row above
may be reported as passing on the strength of the evidence in its own Result cell unless
that cell says PASSED" — 13 of its 14 rows were NOT PERFORMED). This document does not
repeat that shape: where evidence exists it is a real number from a real run, not an
inference from an adjacent unit test.

### How the harness measurements were taken

A throwaway Playwright script (`playwright-core` 1.56.1, the project's pinned Chromium
141.0.7390.37, launched exactly as `scripts/harness-shot.mjs` does — `--use-angle=
swiftshader --enable-unsafe-swiftshader`, the conclusion of
`docs/superpowers/notes/2026-09-20-webgl-headless-spike.md`) drove
`vite.harness.config.ts`'s dev server, the same instrument `npm run harness` and
`npm run harness-shot` use. It read colours the same way production does —
`containerEl.getCssPropertyValue(token)`, the real Obsidian DOM extension
(`tests/mocks/dom-extensions.ts`), which is exactly what `src/host/theme-bridge.ts`'s
`readPalette` calls — normalised each resolved colour through a canvas 2D context's
`fillStyle` round-trip to a canonical `#rrggbb`, and computed WCAG relative luminance
and contrast with the standard formula (`sRGB → linear` with the 0.04045/2.4 gamma
split, `(L1+0.05)/(L2+0.05)`) — **not** `src/visualization/color.ts`'s `encodedLuma`,
which Task 3 named explicitly as *not* WCAG relative luminance and warned future
contrast work not to reuse by name. Two of the eight ratios below were recomputed by
hand from the raw RGB triples as a check; both matched the script's output to four
decimal places. The script, its output, and every screenshot it took were deleted
before this commit — none of it is evidence anyone else can re-run by path, only by
re-doing the (documented) method. `npm run harness-shot`'s 11 committed-format PNGs
(gitignored, regenerable) are the citable captures for the screen-composition rows.

---

## Row 1 — Keyboard only

**SPLIT.**

**Harness-evidenced (real Tab-order run, `?screen=s05&theme=dark`, 1280×800):**
pressing Tab from `document.body` moves focus in this order: search input
(`aria-label="Search files or paths"`) → Scan button → List-view toggle
(`aria-label="List view"`) → each district's "Focus `dir-N` in the 3D view" button
interleaved with file rows → the canvas stage itself (`<div data-ci-role="stage"
tabindex="0" aria-label="Codebase city — 3D view">`, reached at the 11th Tab) → the
eight camera buttons in source order (Rotate left/right, Pan up/down/left/right, Zoom
in/out) → the disclosure toggle (`aria-label="Rotate and pan controls"`) → Fit → Top →
Focus → the footer's "Snapshot details" `<summary>` → wraps back to the search input on
the next Tab. Tab both **enters** the camera region (from the file list) and **leaves**
it (into the footer disclosure) with no trap and no skipped control.

Pressing Escape while the stage has focus and nothing is selected leaves focus
unchanged (`document.activeElement` before/after both the stage `div`) — matches
`src/ui/interaction/escape-intent.ts`'s contract exactly: with `modal`, `help`,
`inInspector`, `filesDrawer`, `inSearch&&query` and `inCanvas&&selected` all false,
`escapeIntent` returns `null`, i.e. Escape is correctly a no-op here rather than
throwing focus somewhere.

Read (not re-run) from source: `CameraControls.vue`'s `onKeydown` only acts when
`event.target === stage.value` — arrow/F/T/+/−/Enter presses elsewhere never reach it.
`App.vue`'s `onGlobalKeydown` only acts when `narrowContainer(el).contains(active)` —
i.e. only when the plugin's own root actually contains the focused element. Both gates
mean a keypress with focus on an Obsidian Markdown editor pane (which is never inside
`.codebase-inspector-root`) structurally cannot reach either handler. This is static
code evidence, not a live cross-pane run.

**NOT PERFORMED — needs the real host, Obsidian 1.13.7:** run spec §10's scripted
keyboard-only demo end to end in the real app (open a real repository, approve scope,
scan, reach a known file, confirm its measurements, use the camera and the file list by
keyboard only, cancel a refresh, reopen) without ever reaching for a mouse, **and**
confirm arrow keys/Escape/Tab keep their normal Markdown-editor behaviour when focus is
in a note in a different leaf while a Codebase Inspector view is open. The harness has
no Markdown editor to test against, and the two document-level listeners named above
being *correctly gated* in source is not the same claim as a human confirming no host
shortcut is ever shadowed.

## Row 2 — NVDA (or equivalent screen reader)

**NOT PERFORMED.** Requires NVDA (or an equivalent screen reader) run by a human on the
real host, Obsidian 1.13.7. What that person must do: open the view, tab to the canvas
and confirm NVDA announces it as one named region ("Codebase city — 3D view") with its
help description read on request, not as a grid of individually-focusable objects; run a
scan and confirm the polite region announces progress, completion, cancellation and
failure (with failure alone read assertively); select several files by keyboard and by
click and confirm each selection is announced once, politely; and confirm hovering a
building announces **nothing** (hover is deliberately unannounced —
`AnnouncementRegion.vue`'s own header comment: "never for hover"). No part of this row
was run with a screen reader. The harness confirmed the DOM markup those checks would
exercise is present (`aria-label="Codebase city — 3D view"`, `aria-describedby`
pointing at a populated help paragraph, an `aria-live="polite" role="status"` region and
a separate `aria-live="assertive" role="alert"` region both present in the DOM at
`?screen=s05`), but a screen reader was never attached, so nothing about actual
announcement behaviour is claimed.

## Row 3 — 200% text scaling

**EVIDENCED (harness).** Technique: Chromium's `zoom` CSS property
(`document.body.style.zoom = '2'`), the standard headless proxy for the browser's own
Ctrl-+ zoom (Obsidian's desktop shell is Chromium/Electron) — not identical to
Obsidian's own font-size accessibility setting, stated so nobody reads this as a claim
about that specific control.

Run against `?screen=s07&theme=dark` (file selected, inspector open), 1280×800
viewport, after zoom applied:

- `.ci-inspector`'s computed `overflow-y` is `auto` — the scroll mechanism the brief
  asks for is genuinely present in the stylesheet and active at 200% zoom, not merely
  declared. At this fixture's content length the panel did not need to scroll
  (`scrollHeight === clientHeight === 398px`), so the mechanism's *presence* is
  evidenced, not a forced overflow — the fixture's inspector content (two metrics, two
  buttons) is too short to make it scroll. That gap is stated rather than papered over.
- The inspector's primary actions stayed fully on-screen and reachable: Close button at
  `x:1188–1254, y:26–86`; Focus button at `x:26–140, y:350–410` — both inside the
  1280×800 viewport, neither clipped nor requiring horizontal scroll
  (`document.documentElement.scrollWidth === clientWidth === 1280` throughout).
- No `pageerror` or console error during navigation or after applying zoom.

**Not covered:** the Settings tab (a real Obsidian `SettingTab`, not reachable from the
harness), and whether the *camera controls* overlay (tested for collapse at narrow width
in Row 7, not re-tested combined with 200% zoom here) stays reachable under zoom
simultaneously with a narrow leaf. Time-boxed; flagged rather than silently skipped.

## Row 4 — Dark theme, default

**EVIDENCED (harness).** `npm run harness-shot` against this commit
(`?screen=s05&theme=dark`, `?screen=s07&theme=dark`, `?screen=s08&theme=dark`,
`?screen=s09&theme=dark`, `?screen=s10&theme=dark&width=700`,
`?screen=s11&theme=dark`) produced 7 dark-theme captures with zero page errors and zero
console errors. `harness-shots/s05-city-dark.png` (regenerable, gitignored): the city,
all six district labels, the toolbar, header, legend and the two-row camera-controls
cluster all render legibly against Obsidian 1.12.4's default dark tokens; buildings
render their real `typescript` category colour (`#4a86c8`), confirming colour reaches
WebGL (this was the exact gap Task 3 found and fixed mid-branch — F15 — so it is
reconfirmed here rather than assumed). Row 14 below gives the actual measured contrast
ratios for this theme, which is the load-bearing half of "dark theme, default" as an
accessibility claim rather than a purely visual one.

**Not covered:** any of the user's own installed theme, snippet, or CSS override — that
is Row 6.

## Row 5 — Light theme, default

**EVIDENCED (harness).** Same method as Row 4, `theme=light`. 4 light-theme captures
(`s05-city-light`, `s06-city-light`, `s07-selected-light`, `s11-list-light`), zero page
errors. `harness-shots/s05-city-light.png`: identical composition to dark, correctly
repainted — white surface, dark text, the same building colours (category colour is
theme-invariant by design). Row 14 gives the measured contrast for this theme.

## Row 6 — One third-party theme

**NOT PERFORMED.** Deliberately: this task was explicitly told not to go looking in the
user's own vault (`C:\Projects\renovation-planner\.obsidian\`) for a theme to test
with, and no other theme was substituted. What the human must do, on the real host,
Obsidian 1.13.7: install and activate one third-party theme (name it and its version
number when this row is filled in), open the Codebase Inspector view, and look at every
screen this branch's own mockups cover (S05 city, S07 selection, S08 search, S09 top
view, S10 narrow, S11 fallback) for a control whose skin the theme has overridden in a
way `styles.css` did not anticipate.

Independently verified from source, as the reason this is the **highest-value** NOT
PERFORMED row rather than a formality: every rule block in `src/ui/styles.css`,
**83 of them**, is wrapped in `:where(.codebase-inspector-root)` — zero exceptions —
which contributes **zero** specificity by CSS's own `:where()` semantics, so a theme's
own element-level rules are never structurally guaranteed to lose. **83, not 78**: an
earlier draft of this row undercounted with a grep anchored to lines starting exactly
at column 0, which misses a rule whose selector list continues on a following line
(e.g. `button.ci-selection-notice__reveal,\n:where(...)...`) and a rule nested inside
`@media`/`@container`. Corrected and cross-checked two independent ways, both
reproducible with the commands below (comment-stripped first, since this stylesheet's
own prose quotes CSS rules and an unstripped comment's braces would end a match early
— the same reason `tests/unit/host-cascade.test.ts`'s own `rules()` helper strips
comments before parsing):

```
node -e "
const fs = require('fs');
const css = fs.readFileSync('src/ui/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const pattern = /([^{}@]+)\{([^{}]*)\}/g;
let m, total = 0, whereWrapped = 0;
while ((m = pattern.exec(css)) !== null) {
  total += 1;
  if (m[1].trim().includes(':where(')) whereWrapped += 1;
}
console.log(total, whereWrapped);
"
```

gives `83 83` — every matched rule block (selector text immediately before a `{...}`
body with no nested braces, so `@media`/`@container` wrappers are excluded and their
*inner* rules are counted individually, exactly as they render) is `:where()`-wrapped.
Cross-checked by brace balance, independent of rule-splitting logic entirely:
`(css.match(/\{/g) || []).length` is 86, matched `}` is also 86 (balanced, so nothing
was mis-parsed), and exactly 3 of those opens belong to the file's 3 `@media`/
`@container` wrappers (`@media (prefers-reduced-motion: reduce)`, `@container
(min-width: 820px)`, `@container (max-width: 819px)`) — `86 - 3 = 83`, the same number
by a method that never looks at `:where(` at all.

**This disagrees with the reviewer's independently-counted 82 by one**, and that
disagreement is recorded rather than silently resolved in either direction: both counts
here were produced by two mutually-corroborating methods (regex block match and raw
brace-balance arithmetic) against the file at this commit, and both land on 83. Neither
count found a rule that is *not* `:where()`-wrapped, which is the substantive claim this
row rests on and is unaffected either way. `tests/unit/host-cascade.test.ts` tracks 8 controls
deliberately raised to a (0,1,1) selector (`PLUGIN_SKINNED_BUTTONS`:
`.ci-app__mode-toggle`, `.ci-app__drawer-close`, `.ci-welcome__action`,
`.ci-camera-controls button`, `.ci-toolbar__scan`, `.ci-file-list__group-focus`,
`.ci-selection-notice__reveal`, `.ci-selection-notice__clear`) so they tie Obsidian's
own `button:not(.clickable-icon)` (0,1,1) and win on document order (`styles.css` loads
after `app.css`), while a root-scoped **user** snippet at (0,2,0) still beats the
plugin — the intended outcome. That test is against Obsidian's own vendored 1.12.4
`app.css`, not against any third-party stylesheet, which is exactly the gap this row is
for: nothing has ever tested this arrangement against rules that were not written by
Obsidian.

## Row 7 — Narrow leaf, below 820 px

**EVIDENCED (harness).** `?screen=s10&theme=dark&width=700` (leaf width forced to
700px, below `DRAWER_MAX_INLINE_SIZE`'s 820px threshold), measured live in the harness:
`.ci-harness-leaf`'s `getBoundingClientRect().width` is exactly 700; the camera-controls
disclosure toggle (`.ci-camera-controls__more`) is present with `aria-expanded="false"`;
exactly 6 `<button>` elements render inside `.ci-camera-controls` (the primaries: zoom
±, Fit, Top, Focus, plus the toggle itself — the six step buttons collapsed, matching
Task 10's own finding). `harness-shots/s10-narrow-dark.png` shows the same: the file
list, header (3 lines + badge, no wrap or clip — Task 7's own finding, re-observed here)
and the collapsed camera row all fit inside 700px with no horizontal scrollbar.

## Row 8 — Two simultaneous leaves

**NOT PERFORMED.** The harness mounts exactly one instance; it has no notion of a
second leaf. What the human must do, Obsidian 1.13.7: open two Codebase Inspector
leaves side by side (a split pane), point them at two different repositories (or the
same one), then in one leaf move the camera, change the search query, select a
different file, and open/close the inspector panel — and confirm the *other* leaf's
camera position, query, selection and panel state are all completely unaffected.

Adjacent evidence from source, not a substitute for the run: `src/host/city-view.ts:202`
constructs `this.pinia = createPinia()` **per `CityView` instance** rather than at
module scope, so each leaf's store is structurally independent by construction, not by
convention — but nobody has opened two leaves and watched them not cross-talk.

## Row 9 — Pop-out migration

**NOT PERFORMED.** Requires dragging a leaf into a separate OS window in the real host,
Obsidian 1.13.7, and confirming the city keeps rendering, the camera keeps its position,
and keyboard interaction (Escape, the camera keys) still works in the new window.

Adjacent evidence, not a substitute: `tests/host/window-migration.test.ts` runs 12
tests against a genuinely separate `jsdom` realm (a second `JSDOM` instance with its own
constructors) and a real `adoptNode`, asserting the renderer disposes and reconstructs
in the new window from the existing `LayoutResult` (no rescan), every new DOM node is
created via the new window's document, `node.instanceOf(T)` is used instead of a bare
`instanceof` (which is false across realms), the palette and reduced-motion preference
are re-read in the new window, the `ResizeObserver` is rebuilt there, and — a fix that
shipped on this branch (task-11 fix round 1, item 3, per `App.vue`'s own comment on
`attachKeydownListener`) — the Escape listener re-attaches to the new document rather
than staying bound to the pre-migration one. All of that is simulated-realm evidence.
Nobody has watched a real Electron pop-out do it.

## Row 10 — WebGL unavailable

**EVIDENCED (harness).** `npm run harness-shot`'s `s11-webgl-failed-dark` shot launches
a **second** Chromium process with `--disable-webgl` (verified in
`scripts/harness-shot.mjs`'s own comment, empirically, against this exact Chromium
build: `canvas.getContext('webgl2')` returns `null`, not a throw — the same shape a real
platform failure produces) against the resting screen (`?screen=s05`), so
`city-renderer.ts`'s real `!context` branch runs rather than being simulated.
`harness-shots/s11-webgl-failed-dark.png`, regenerated this run: an empty canvas region,
the orange notice "The 3D view is unavailable. File inspection still works." (COPY-14),
the file list and legend fully intact, and — worth stating plainly since it is easy to
miss in a small screenshot — the camera-controls row (`+ − … Fit Top Focus`) still
renders even with no canvas to control. Zero page errors, zero console errors.

Pre-existing finding, re-confirmed rather than re-discovered: F14
(`progress.md`) — the screen spec's own zone 5, "Retry 3D", does not exist anywhere in
the shipped controls. Still true; still not fixed here, per this task's own rule against
touching `src/`.

## Row 11 — GPU context recovery

**NOT PERFORMED.** Requires forcing a genuine GPU context loss against the real host's
real GPU, Obsidian 1.13.7 — e.g. via the browser devtools console against the plugin's
own canvas (`canvas.getContext('webgl2').getExtension('WEBGL_lose_context')
.loseContext()`, then later `.restoreContext()`), or by a real driver-level event (a
laptop's hybrid-GPU switch, a driver crash/reset). What to confirm: the notice
`CONTEXT_LOST_NOTICE` ("The 3D view stopped responding and will reconstruct. File
inspection still works.") appears, and that the renderer actually disposes and
reconstructs afterward (`src/visualization/city-renderer.ts` listens for
`webglcontextlost`; `src/visualization/disposal.ts`'s own comment records that this
branch deliberately does **not** ship the prototype's self-healing
`webglcontextrestored` partner). `tests/host/window-migration.test.ts` has one test
titled "treats context loss and window migration as ONE recovery path", but that is a
simulated event dispatched in a mocked realm, not a real driver-level loss — stated so
it is not mistaken for this row.

## Row 12 — Reduced motion

**EVIDENCED (harness), by mechanism, not by assertion.** How this was established:
`tests/harness/mount.ts`'s `forceReducedMotion(window)` patches `window.matchMedia` to
report `matches: true` for `(prefers-reduced-motion: reduce)` before `app.mount()` runs
— re-read live in this run, not merely read from source: `page.evaluate(() =>
window.matchMedia('(prefers-reduced-motion: reduce)').matches)` returned `true` on both
the dark and light navigations. `CityViewport.vue`'s `applyMotionPreference` reads that
same query exactly once, synchronously, at renderer construction, and passes
`motion: 'reduced'` into the camera rig; with that setting, `camera-rig.ts`'s `commit()`
applies a bookmark's target/position/zoom immediately rather than tweening over
`TWEEN_MS` (220ms in the standard-motion path). This is the same accessibility path a
real OS-level "reduce motion" preference takes — it is not a shortcut invented for the
harness — and Task 0b/0c already produced the strongest evidence available that it
actually changes the drawn frame: a temporarily-inflated `TWEEN_MS` (220 → 6000ms) with
`forceReducedMotion` skipped photographed a visibly wrong, near-degenerate frame; the
same mutation with `forceReducedMotion` restored photographed the correct one
(`progress.md`, Task 0c fix round 1). That mutation evidence is cited, not re-run here.

**Not covered:** a real OS-level "reduce motion" toggle exercised against the real host.

## Row 13 — Long Unicode paths

**EVIDENCED (harness).** `tests/fixtures/snapshot-builder.ts` already exports
`unicodeFixture()` (combining acute, an RTL Arabic segment, spaces, a 240-character
path: `á fólder مجلد` + padding + `/file.ts`) for exactly this purpose. A temporary
scratch harness entry point (mirroring `tests/harness/mount.ts`, seeded from this
fixture instead of the standard 144-file one; written for this task, deleted before
commit, per the "delete scratch files" rule) mounted the real `App.vue`, selected the
one file, and opened the inspector. Measured directly:

- `.ci-inspector__path`'s rendered text is the full 240-character path, byte-for-byte
  (`textContent.length === 240`), wrapped across 8 visual lines inside a 223px-wide
  panel, with **no truncation and no ellipsis** — confirming
  `src/ui/styles.css`'s `.ci-inspector__path` rule (`overflow-wrap: anywhere`,
  deliberately no `text-overflow`/`white-space: nowrap`, per its own comment: "Do not
  expose crucial content only in an ellipsis tooltip") behaves as designed against a
  genuinely pathological input, not just a short fixture path.
- The file-list row and its group header wrap the same path with no horizontal
  overflow (`document.documentElement.scrollWidth === clientWidth === 1280`), and the
  combining mark and the RTL segment both render inline without breaking the layout or
  reordering surrounding text.
- Zero page errors, zero console errors mounting or interacting with this fixture.

**Not covered:** a hover tooltip case — this view has no hover tooltip on the path (the
previous WP-01 matrix flagged the *absence* of any tooltip-layer test; still true, and
moot here since there is no tooltip to test).

## Row 14 — Measured contrast of our pairs (dark, light)

**EVIDENCED (harness). The load-bearing row.** Per this task's explicit instruction,
**not** compared against `docs/concept/design/validation/reference-contrast-checks.json`
— those six pairs are the prototype's own fixed reference palette (e.g. its dark
primary-button pair is `#ffffff` on `#7653ba`, 5.65:1), which this plugin never renders:
we resolve `--ci-action` from the host's live `--interactive-accent`, not from a
constant, so that file's ratios are unreachable and unfalsifiable for us by
construction. The pairs below are the four this plugin actually owns or bridges.

| Pair | Theme | Foreground | Background | Ratio | Threshold | Result |
|---|---|---|---|---|---|---|
| `--ci-text` on `--ci-surface` | dark | `#dadada` | `#1e1e1e` | **11.93:1** | 4.5:1 (normal text) | **PASS** |
| `--ci-text` on `--ci-surface` | light | `#222222` | `#ffffff` | **15.91:1** | 4.5:1 | **PASS** |
| `--ci-text-muted` on `--ci-panel` | dark | `#b3b3b3` | `#262626` | **7.22:1** | 4.5:1 | **PASS** |
| `--ci-text-muted` on `--ci-panel` | light | `#5c5c5c` | `#f6f6f6` | **6.19:1** | 4.5:1 | **PASS** |
| `--ci-on-action` on `--ci-action` | dark | `#ffffff` | `#8a5cf5` | **4.26:1** | 4.5:1 (normal text — no font-size override found on `.ci-welcome__action` or any `--ci-action`-background button, so the default UI text size applies, not the 18pt/14pt-bold "large text" exemption) | **FAIL** |
| `--ci-on-action` on `--ci-action` | light | `#ffffff` | `#9873f7` | **3.43:1** | 4.5:1 | **FAIL** |
| `--ci-raised` vs `--ci-panel` (hover surface) | dark | `#242424` | `#262626` | **1.03:1** | 3:1 (non-text / UI component) | **FAIL** |
| `--ci-raised` vs `--ci-panel` (hover surface) | light | `#fafafa` | `#f6f6f6` | **1.04:1** | 3:1 | **FAIL** |

**On `--ci-raised`:** this confirms, with an actual WCAG ratio rather than a raw byte
difference, the number already on record (F16, `progress.md`: dark
`rgb(38,38,38)→rgb(36,36,36)`, a 2/255 difference; light `rgb(246,246,246)→
rgb(250,250,250)`, 4/255) — **CONFIRMED, not merely repeated**: 1.03:1 and 1.04:1 are
nowhere near the 3:1 non-text bar, and F16's own root-cause finding stands: the
file-list row's hover is legible only because it hovers from a **transparent** rest
state to `--ci-panel`, not because `--ci-raised` itself provides usable contrast against
`--ci-panel`. Colours resolved this run: dark `--ci-panel` = `#262626` =
`--background-secondary`, `--ci-raised` = `#242424` = `--background-primary-alt`; light
`--ci-panel` = `#f6f6f6`, `--ci-raised` = `#fafafa` — matching Ruling 25's independent
check against Obsidian's known default token values.

**New finding, this row, not previously recorded on this branch:** `--ci-on-action` on
`--ci-action` fails the 4.5:1 normal-text bar in **both** themes — 4.26:1 dark, 3.43:1
light, light being the worse of the two. This pairing backs every primary
accent-coloured control's own label text (`.ci-welcome__action` directly; any other
control sharing `background: var(--ci-action); color: var(--ci-on-action)`). It is a
**host-token consequence, not a plugin authoring bug**: `--ci-action` is a pure alias of
Obsidian's own `--interactive-accent` (styles.css:10, `--ci-action: var(--interactive-
accent)`) and `--ci-on-action` of `--text-on-accent` (styles.css:15) — spec 4.4
forbids this bridge from redefining either, so there is no token-bridge fix available
without violating that rule. The prototype's OWN reference pair for the analogous
role (`#ffffff` on `#7653ba`, 5.65:1) passed only because the prototype used a fixed
brand purple instead of the host's live accent — exactly the divergence this task's own
instructions predicted ("those ratios are unreachable and unfalsifiable for us"), now
measured rather than assumed. **Not fixed here.** Reported to the user as a finding.

---

## Findings summary (not fixed; `src/` untouched)

1. **`--ci-on-action` on `--ci-action` fails WCAG AA 4.5:1 in both themes** (4.26:1
   dark, 3.43:1 light) — new this task, Row 14. A host-token consequence of aliasing
   `--interactive-accent`/`--text-on-accent` rather than a plugin authoring choice; spec
   4.4 forbids fixing it by redefining either variable in the bridge.
2. **`--ci-raised` vs `--ci-panel` fails WCAG AA 3:1 for non-text contrast in both
   themes** (1.03:1 dark, 1.04:1 light) — CONFIRMS F16 (`progress.md`) with a measured
   ratio rather than a raw byte difference. Not fixed here (F16 was already surfaced to
   the user as a measurement, not a fix, on this branch).
3. **F14 re-confirmed, not re-discovered:** S11's "Retry 3D" zone does not exist in the
   shipped controls (Row 10). Still open from earlier in this work package.

No other new finding surfaced. Every other measured pair passes its WCAG bar; every
other harness-evidenced row behaved as designed.

---

## Gate bars, confirmed this run

- `npm run verify` — **exit 0.** `npm run typecheck`, `npm run lint:fast`, `npm run
  lint`, `npm run test`, `npm run build` all passed with the scratch files already
  deleted (verified by re-running after cleanup, not before).
- Suite: **97 files / 1073 passed / 1 skipped** — matches the branch's current
  baseline exactly (Task 13's close-out numbers in `progress.md`). Not changed by this
  task: no test file was added or edited.
- Suppression count, `src/` and `tests/` combined: exactly **3** `eslint-disable`
  (`src/domain/path-safety.ts:2`, `src/host/city-view.ts:212`,
  `tests/harness/mount.ts:38`) and exactly **1** `@ts-expect-error`
  (`tests/unit/city-store.test.ts:353`) — both unchanged from the branch baseline
  (Ruling 8/13).
- `dist/main.js` — **790,537 bytes**, sha256
  `43e92d9a034d9977c8a6393eb67b3d2ff8b00f6220a13dc455279059509c43fa`. **Untouched**:
  this task is a document; nothing under `src/` was edited, so the build is
  byte-identical to Task 13's close-out. `dist/` holds exactly `main.js`,
  `manifest.json`, `styles.css`.
- `git status`: clean except the pre-existing untracked
  `docs/superpowers/notes/wp01-visual-parity-prompt.md`, which predates this task and
  is not this task's file. Every scratch file this task created (`scratch-measure.mjs`,
  `scratch-focus.mjs`, `scratch-shots/`, `tests/harness/scratch-unicode*.{ts,html}`)
  was deleted before this commit.
- No test was loosened. No `src/` file was changed. This document is the only new file
  this task adds, under `docs/`, which per this task's own instructions needs no
  gate-evidence row (that table counts `tests/*` layers only).

## Row count

14 rows total, matching the brief's own numbering:

- **8 EVIDENCED (harness):** dark theme (4), light theme (5), 200% text scaling (3),
  narrow leaf (7), WebGL unavailable (10), reduced motion (12), long Unicode paths (13),
  measured contrast (14).
- **1 SPLIT:** keyboard only (1) — focus order, Tab entry/exit of the camera region,
  and Escape's no-op behaviour are evidenced; Obsidian's own shortcut handling and a
  real cross-pane Markdown-editor check are NOT PERFORMED.
- **6 NOT PERFORMED, each stating exactly what the human must do:** NVDA (2),
  third-party theme (6), two simultaneous leaves (8), pop-out migration (9), GPU context
  recovery (11), and the host-shortcut half of Row 1.

This is a real change from the previous accessibility matrix's 13-of-14 NOT PERFORMED —
made possible entirely by wave 0's browser harness existing, not by lowering what counts
as evidence. G4's accessibility half and G7 close only on the rows a human actually
performs in Obsidian 1.13.7; the 8 harness rows and the evidenced half of Row 1 are
real, but they are evidence about our page in a browser, not about Obsidian.
