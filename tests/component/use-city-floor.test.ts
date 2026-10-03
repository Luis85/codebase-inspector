// Polish G6 (Part 5 E12): useCityFloor on its own, over a small host component, not only
// through the whole App shell (welcome-state.test.ts's narrow-layout cases already cover
// the 820px drawer threshold there -- this covers the OTHER threshold, the 320px hard
// floor, spec 5.2's "list-first" fallback).
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h, ref } from 'vue';
import '../mocks/obsidian';
import { useCityFloor } from '../../src/ui/screens/city/use-city-floor';
import { useCityStore } from '../../src/ui/stores/city-store';

/** Captures the ResizeObserver callback the fallback (no-shell) branch of useCityFloor
 *  installs on `el.win.ResizeObserver`, exactly the pattern welcome-state.test.ts's own
 *  `FakeResizeObserver`/`makeFakeWin()` stand in for jsdom's real gap -- except this one
 *  keeps the callback so the test can fire it itself, since nothing here ever triggers a
 *  real layout resize. Installed as `window.ResizeObserver` itself (not a per-element
 *  `.win` override) so it is already in place when `onMounted` -- which runs
 *  synchronously inside `mount()`, before a test gets a chance to touch the element --
 *  reads `el.win`, whose getter defaults to the element's OWN `ownerDocument.defaultView`.
 */
class CapturingResizeObserver {
  static last: (() => void) | null = null;
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  constructor(cb: () => void) { CapturingResizeObserver.last = cb; }
}

const Host = defineComponent({
  setup() {
    const rootEl = ref<HTMLElement | null>(null);
    const floor = useCityFloor(rootEl, useCityStore(), ref(false));
    return () => h('div', { ref: rootEl }, floor.narrowDrawer.value ? 'narrow' : 'wide');
  },
});

describe('useCityFloor (Polish G6)', () => {
  it('below the 320 px floor the city switches to list mode and widening restores the spatial mode the user had', () => {
    setActivePinia(createPinia());
    const store = useCityStore();
    expect(store.viewMode).toBe('3d');
    const realResizeObserver = window.ResizeObserver;
    (window as unknown as { ResizeObserver: unknown }).ResizeObserver = CapturingResizeObserver;
    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 200, height: 700, top: 0, left: 0, right: 200, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
    });
    try {
      const w = mount(Host);
      expect(store.viewMode).toBe('list');

      rectSpy.mockReturnValue({
        width: 900, height: 700, top: 0, left: 0, right: 900, bottom: 700, x: 0, y: 0, toJSON: () => ({}),
      });
      CapturingResizeObserver.last!();
      expect(store.viewMode).toBe('3d');
      w.unmount();
    } finally {
      rectSpy.mockRestore();
      (window as unknown as { ResizeObserver: unknown }).ResizeObserver = realResizeObserver;
    }
  });
});
