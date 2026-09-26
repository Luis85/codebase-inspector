// The two container-width thresholds spec 5.2 names, in ONE place.
//
// They are measured against two DIFFERENT elements, by two different owners, which
// is why they were two separate literals before the Phase 2 fix wave:
//
// * `MIN_INLINE_SIZE` — the hard floor. `CityViewport` measures its OWN stage element
//   against it (below it no WebGL context is created at all, and any existing one is
//   disposed), and `App.vue` measures the LEAF CONTAINER against it to decide
//   presentation (below it the view renders list-first). Both halves of that one
//   sentence in spec 5.2 must use the same number, so it is declared once.
// * `DRAWER_MAX_INLINE_SIZE` — the collapse threshold. `App.vue` measures the leaf
//   container against it for `narrowDrawer` (the Escape chain's drawer link), and
//   `src/ui/styles.css` keys its container query on the same number. CSS cannot
//   import this, so that one stays a deliberate, commented duplicate over there.
//
// No behaviour lives here: this module exports two numbers and nothing else, so it
// adds no layer edge to anything that imports it.
export const MIN_INLINE_SIZE = 320;
export const DRAWER_MAX_INLINE_SIZE = 820;
