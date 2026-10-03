// Task 9 fix round 1, item 7: the narrow (<820px) layout's Files/Inspector
// overlays each need "a visible close that returns focus to its opener" (the
// brief's own words). The opener and the close control live in different
// components (CodebaseFileList activates a row; FileInspector's own close
// button is what returns focus), so the opener element is shared the same way
// renderer-handle.ts shares the live renderer: one `shallowRef`, provided once
// at the root, written by whichever control opened the inspector, read by the
// one that closes it.
import { inject, provide, shallowRef } from 'vue';
import type { InjectionKey, ShallowRef } from 'vue';

export const INSPECTOR_OPENER_KEY: InjectionKey<ShallowRef<HTMLElement | null>> = Symbol('inspector-opener');

export function provideInspectorOpener(): ShallowRef<HTMLElement | null> {
  const handle = shallowRef<HTMLElement | null>(null);
  provide(INSPECTOR_OPENER_KEY, handle);
  return handle;
}

export function useInspectorOpener(): ShallowRef<HTMLElement | null> {
  return inject(INSPECTOR_OPENER_KEY, () => shallowRef<HTMLElement | null>(null), true);
}
