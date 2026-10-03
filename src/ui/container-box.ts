// WHICH element the 820 px threshold is measured on, and WHICH BOX of it.
//
// Both halves lived in App.vue. They moved here for two reasons: App.vue is at its
// 400-line cap, and the second half is a rule that deserves a test of its own rather
// than one reachable only by mounting the whole shell.
//
// Ruling M97, reopened at checkpoint #3. The stylesheet's `@container (min-width: 820px)`
// and App.vue's `narrowDrawer` are two halves of ONE rule (spec 5.2), and CSS cannot
// import `responsive.ts`, so the number is a commented duplicate across the two files.
// They were still measuring two DIFFERENT boxes of the same element:
//
//   * `container-type: inline-size` establishes a query container whose queried size is
//     the element's CONTENT box;
//   * `getBoundingClientRect().width` is its BORDER box.
//
// Obsidian's own `.workspace-leaf-content .view-content` (verified in the shipped
// obsidian.asar) declares `padding: var(--size-4-3) var(--size-4-3) var(--size-4-8)` with
// `--size-4-3: 12px`, and `.view-content` IS `.codebase-inspector-root` (spec 4.4). With
// the host's global `box-sizing: border-box` the two numbers differ by exactly 24 px, so
// there was a 24 px band of leaf widths in which App said "wide" while the stylesheet
// laid the leaf out narrow -- and in that band the list is an overlay that hides itself
// unless the drawer is open, which App then refused to keep open.

interface WinBearing { win?: Window }

/** A computed length, or 0. A property no stylesheet has set resolves to the empty string
 *  outside a real host, and `Number.parseFloat('')` is NaN -- which would poison the whole
 *  subtraction rather than contributing nothing. */
function px(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** The element the container query is evaluated against: the leaf content element, which
 *  is where `container-type: inline-size` sits (spec 4.4). Falls back to the component's
 *  own root for a standalone mount, the same fallback FileSearch.vue's focus-containment
 *  check already uses -- never a bare `window`/viewport measurement, which a CONTAINER
 *  query does not track. */
export function narrowContainer(el: HTMLElement): HTMLElement {
  return el.closest<HTMLElement>('.codebase-inspector-root') ?? el;
}

/** The element's CONTENT box inline size -- the number `@container (min-width: …)`
 *  compares against, so the number App must compare against too.
 *
 *  The window comes from the element (`el.win`, spec 4.4's cross-window rule), never a
 *  bare global, so this still reads the right realm after a pop-out migration. Outside a
 *  real host that extension may not be installed, and a padding a stylesheet has not
 *  applied resolves to the empty string, so every term degrades to 0 and this returns the
 *  border box -- which is the correct answer precisely when there is no padding.
 *
 *  Known residual: `.view-content` is `overflow: auto`, and a visible classic scrollbar is
 *  taken out of the content box without changing the border box, so this over-reports by
 *  the scrollbar width while one is showing. That is smaller than the 24 px it fixes, and
 *  the height fix in this same round is what stops that scrollbar from appearing at all. */
export function contentBoxInlineSize(el: HTMLElement): number {
  const borderBox = el.getBoundingClientRect().width;
  const win = (el as unknown as WinBearing).win;
  // Task 10: CameraControls now reaches this function too, from plain component
  // setup rather than only from a real App.vue mount -- and several existing test
  // doubles assign `.win` to a minimal object built for whatever THAT file already
  // needed (a `ResizeObserver`/`matchMedia` stand-in), never `getComputedStyle`. A
  // real Window always has it; a `.win` that does not is the same "not a real
  // host" case the border-box fallback below already exists for, just missing a
  // different member of the same object.
  if (!win || typeof win.getComputedStyle !== 'function') return borderBox;
  const style = win.getComputedStyle(el);
  return borderBox
    - px(style.paddingLeft) - px(style.paddingRight)
    - px(style.borderLeftWidth) - px(style.borderRightWidth);
}

/** WP-02: the inline size the CITY actually gets. The leaf measurement above is still the
 *  one CSS container queries on the leaf compare against, but once the inspector shell
 *  shows its navigation column inline (`.ci-shell--nav-inline`) the city's own content box
 *  (`.ci-shell__content`, itself a size container in shell.css) is narrower by that
 *  column. Subtracting it keeps the JS threshold decisions (drawer at 820 px, list-first
 *  floor at 320 px) in step with the container queries evaluated on `.ci-shell__content`.
 *  Outside the shell, or with the nav collapsed into a drawer, this equals the leaf size. */
export function cityInlineSize(el: HTMLElement): number {
  const leaf = narrowContainer(el);
  const nav = leaf.querySelector<HTMLElement>('.ci-shell--nav-inline > .ci-shell__nav');
  return contentBoxInlineSize(leaf) - (nav ? nav.getBoundingClientRect().width : 0);
}
