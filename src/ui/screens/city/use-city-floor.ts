// WP-02 Part 5 (V2): the city's responsive wiring, moved out of CityWorkspace.vue with no
// behaviour change.
//
// Phase 2 fix wave, I2 (Important): spec 5.2 says "below a hard floor of 320 CSS px inline
// size the view renders LIST-FIRST and creates no WebGL context at all". CityViewport
// disposes the renderer; this switches the presentation, so a leaf dragged into a sidebar
// (spec 5.2: "can be ~150 px") shows the file list instead of an empty bordered stage.
//
// This lives at the workspace level, NOT in CityViewport.applySize, for a structural
// reason: entering list mode UNMOUNTS CityViewport (CityStage's `v-if`), which disconnects
// the very ResizeObserver that would have to notice the leaf widening again -- a one-way
// door. `forcedListByFloor` records that WE switched, so widening restores the user's own
// spatial mode (`returnFromList()` -> `lastSpatialMode`) and never drags someone out of a
// list view they chose themselves. `setViewMode` preserves query, selection and the camera
// bookmark, which is exactly what the spec's next sentence requires.
//
// Part 5 V4 (Part 2 deferral): inside the shell, App's leaf observer is the leaf's ONLY
// observer (shell/leaf-layout.ts). This re-measures on its post-patch `layoutTick`, so the
// nav column's inline/drawer switch is already in the DOM when `cityInlineSize` subtracts
// it, and it observes neither the leaf nor `.ci-shell__content`. Mounted without the shell
// (a component test), it falls back to one observer of its own on the leaf.
import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import type { useCityStore } from '../../stores/city-store';
import { DRAWER_MAX_INLINE_SIZE, MIN_INLINE_SIZE } from '../../responsive';
import { cityInlineSize, narrowContainer } from '../../container-box';
import { injectLeafLayout } from '../../shell/leaf-layout';

interface WinBearing { win?: Window }

export interface CityFloor {
  /** Below the 820 px drawer threshold: the Escape chain's drawer link. */
  narrowDrawer: Readonly<Ref<boolean>>;
}

export function useCityFloor(
  rootEl: Readonly<Ref<HTMLElement | null>>,
  store: ReturnType<typeof useCityStore>,
  filesDrawerOpen: Ref<boolean>,
): CityFloor {
  const narrowDrawer = ref(false);
  const forcedListByFloor = ref(false);
  let resizeObserver: ResizeObserver | null = null;
  let unwireMigration: (() => void) | null = null;
  // Part 5 V4 fix (implementer round 1): `layoutTick` fires once more, right after the
  // shell's very first paint, purely because `navInline` settles from its unmeasured
  // default -- even when that settle changes nothing THIS measurement depends on (no
  // `.codebase-inspector-root` ancestor to climb to, or the nav column was already
  // accounted for). Without this guard that extra call still runs the unconditional
  // "not narrow -> retire the drawer" line below and silently closes a drawer the user
  // opened in the same tick (welcome-state.test.ts's narrow-layout drawer pair). Only
  // skipping when the MEASURED width is unchanged keeps every genuine transition (a
  // real resize, or the nav column's width actually being subtracted for the first
  // time) reacting exactly as before.
  let previousWidth: number | undefined;

  function updateResponsiveLayout(): void {
    const el = rootEl.value;
    if (!el) return;
    // Ruling M97, reopened: the CONTENT box, which is what `container-type: inline-size`
    // compares -- `getBoundingClientRect()` is the BORDER box and Obsidian's own
    // `.view-content` padding makes the two differ by 24 px. See container-box.ts.
    const width = cityInlineSize(el);
    if (width === previousWidth) return;
    previousWidth = width;
    narrowDrawer.value = width < DRAWER_MAX_INLINE_SIZE;
    // Re-review round 2 (R1, Important): at or above the threshold the Files overlay
    // STOPS EXISTING -- styles.css makes the list a permanent column and hides the
    // opener -- so the width that ends the narrow layout is where the flag is retired.
    // Assigned directly rather than through `closeFilesDrawer()`: that one focuses the
    // opener, which is exactly the hidden control this must not send focus to.
    if (!narrowDrawer.value) filesDrawerOpen.value = false;
    // A hidden leaf collapses to exactly 0 (spec 4.2's pause/resume invariant, the
    // same case CityViewport's own zero-box guard exists for) -- suspended, not narrow.
    if (width <= 0) return;
    if (width < MIN_INLINE_SIZE) {
      if (store.viewMode === 'list') return;
      forcedListByFloor.value = true;
      store.setViewMode('list');
    } else if (forcedListByFloor.value) {
      forcedListByFloor.value = false;
      store.returnFromList();
    }
  }

  const leafLayout = injectLeafLayout();
  if (leafLayout) watch(() => leafLayout.layoutTick.value, () => { updateResponsiveLayout(); });

  /** The fallback observer, used only without the shell. Task 11 fix round 1, item 3:
   *  rebuilt off `el`'s CURRENT `.win`, never left pointing at the pre-migration window's
   *  `ResizeObserver` constructor (which has no defined behaviour once `el` has moved). */
  function attachResizeObserver(el: HTMLElement): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (leafLayout) return;
    const win = (el as unknown as WinBearing).win;
    if (!win) return;
    resizeObserver = new (win as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver(() => {
      updateResponsiveLayout();
    });
    resizeObserver.observe(narrowContainer(el));
  }

  onMounted(() => {
    const el = rootEl.value;
    if (!el) return;
    updateResponsiveLayout();
    attachResizeObserver(el);
    // Task 11 fix round 1, item 3: re-measured and re-attached on migration -- the
    // "no wrong-window DOM" clause task 11 named.
    unwireMigration = el.onWindowMigrated(() => {
      updateResponsiveLayout();
      attachResizeObserver(el);
    });
  });
  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    unwireMigration?.();
    unwireMigration = null;
  });

  return { narrowDrawer };
}
