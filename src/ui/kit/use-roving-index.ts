// E10: the one roving-tabindex implementation, extracted from HotspotScatter.vue and
// shared with the Test confidence CoverageMap. Exactly one item is a tab stop. Right or
// Down moves to the next item and Left or Up to the previous one, both wrapping; Home
// and End jump to the ends; Enter or Space activates the active item. Focus follows the
// move after the next render.
import { nextTick, ref, watch, type Ref } from 'vue';

export interface RovingIndexOptions {
  /** How many items there are now. */
  count: () => number;
  /** The index of the selected item, or -1. When it changes, the tab stop follows it. */
  selectedIndex: () => number;
  /** Moves DOM focus onto item `i` (called after `nextTick`). */
  focusAt: (i: number) => void;
  /** Enter or Space on item `i`. */
  activate: (i: number) => void;
}

export interface RovingIndex {
  active: Ref<number>;
  onKeydown: (event: KeyboardEvent) => void;
  setActive: (i: number) => void;
}

/** The index a key moves to from `at` among `n` items, or -1 when the key is not a move. */
export function rovingTarget(key: string, at: number, n: number): number {
  if (key === 'ArrowRight' || key === 'ArrowDown') return (at + 1) % n;
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (at - 1 + n) % n;
  if (key === 'Home') return 0;
  if (key === 'End') return n - 1;
  return -1;
}

export function useRovingIndex(options: RovingIndexOptions): RovingIndex {
  const active = ref(0);
  // The selected item becomes the tab stop; otherwise keep the stop, clamped to the list.
  watch(() => [options.count(), options.selectedIndex()] as const, ([n, selected]) => {
    active.value = selected >= 0 ? selected : Math.min(active.value, Math.max(0, n - 1));
  }, { immediate: true });

  function onKeydown(event: KeyboardEvent): void {
    const n = options.count();
    if (n === 0) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (active.value < n) options.activate(active.value);
      return;
    }
    const next = rovingTarget(event.key, active.value, n);
    if (next < 0) return;
    event.preventDefault();
    active.value = next;
    void nextTick(() => options.focusAt(next));
  }

  function setActive(i: number): void {
    active.value = i;
  }

  return { active, onKeydown, setActive };
}
