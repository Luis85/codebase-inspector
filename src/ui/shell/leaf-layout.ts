// WP-02 Part 5 (V4, V5; Part 2 deferral): ONE leaf measurement per leaf. App's
// `useLeafWidth` ResizeObserver is the only observer on the leaf. Everything else that
// depends on the leaf's width reacts to `layoutTick` instead of observing the leaf again:
// the city's 320 px floor and 820 px drawer threshold (screens/city/use-city-floor.ts), and
// CameraControls' steps default.
//
// `layoutTick` advances in a `flush: 'post'` watcher, so a reader measures AFTER the nav
// column's inline/drawer switch has been patched into the DOM: `cityInlineSize` subtracts
// the inline column only once `.ci-shell--nav-inline` is on the shell.
import { inject, provide, readonly, ref, watch, type InjectionKey, type Ref } from 'vue';

export interface LeafLayout {
  /** Advances after every leafWidth or navInline change, once the DOM is patched. */
  layoutTick: Readonly<Ref<number>>;
}

export const LEAF_LAYOUT_KEY: InjectionKey<LeafLayout> = Symbol('ci-leaf-layout');

/** Called once, by App.vue, right after `useLeafWidth` and `navInline`. Fix round 3,
 *  minor 4: `leafWidth`/`navInline` used to also sit on the returned/provided object,
 *  but every consumer reads only `layoutTick` (App discards this call's return value
 *  entirely) — so they stay as this function's own parameters, feeding the watcher
 *  below, and are no longer part of `LeafLayout` itself. */
export function provideLeafLayout(leafWidth: Readonly<Ref<number>>, navInline: Readonly<Ref<boolean>>): LeafLayout {
  const tick = ref(0);
  watch([leafWidth, navInline], () => { tick.value += 1; }, { flush: 'post' });
  const layout: LeafLayout = { layoutTick: readonly(tick) };
  provide(LEAF_LAYOUT_KEY, layout);
  return layout;
}

/** The shell's leaf layout, or null outside the shell (a screen or component mounted
 *  alone, as component tests do). */
export function injectLeafLayout(): LeafLayout | null {
  return inject(LEAF_LAYOUT_KEY, null);
}
