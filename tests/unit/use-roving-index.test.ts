import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import { rovingTarget, useRovingIndex } from '../../src/ui/kit/use-roving-index';

const key = (k: string): KeyboardEvent => ({ key: k, preventDefault: vi.fn() }) as unknown as KeyboardEvent;
/** The event plus its `preventDefault` spy, held as a standalone mock. */
function keyWithSpy(k: string): { event: KeyboardEvent; prevented: ReturnType<typeof vi.fn> } {
  const prevented = vi.fn();
  return { event: { key: k, preventDefault: prevented } as unknown as KeyboardEvent, prevented };
}

function setup(count = 4, selected = -1) {
  const n = ref(count);
  const sel = ref(selected);
  const focusAt = vi.fn();
  const activate = vi.fn();
  const scope = effectScope();
  const roving = scope.run(() => useRovingIndex({ count: () => n.value, selectedIndex: () => sel.value, focusAt, activate }))!;
  return { n, sel, focusAt, activate, scope, ...roving };
}

describe('rovingTarget', () => {
  it('wraps the arrows, jumps Home and End, and ignores other keys', () => {
    expect(rovingTarget('ArrowRight', 3, 4)).toBe(0);
    expect(rovingTarget('ArrowDown', 1, 4)).toBe(2);
    expect(rovingTarget('ArrowLeft', 0, 4)).toBe(3);
    expect(rovingTarget('ArrowUp', 2, 4)).toBe(1);
    expect(rovingTarget('Home', 2, 4)).toBe(0);
    expect(rovingTarget('End', 0, 4)).toBe(3);
    expect(rovingTarget('a', 0, 4)).toBe(-1);
  });
});

describe('useRovingIndex', () => {
  it('moves the tab stop, focuses after nextTick, and activates on Enter or Space', async () => {
    const r = setup();
    const left = keyWithSpy('ArrowLeft');
    r.onKeydown(left.event);
    expect(left.prevented).toHaveBeenCalled();
    expect(r.active.value).toBe(3);
    expect(r.focusAt).not.toHaveBeenCalled();
    await nextTick();
    expect(r.focusAt).toHaveBeenCalledWith(3);
    r.onKeydown(key('Enter'));
    r.onKeydown(key(' '));
    expect(r.activate.mock.calls).toEqual([[3], [3]]);
    const other = keyWithSpy('Tab');
    r.onKeydown(other.event);
    expect(other.prevented).not.toHaveBeenCalled();
    r.scope.stop();
  });

  it('follows the selection, clamps when the list shrinks, and does nothing when empty', async () => {
    const r = setup(5, 2);
    expect(r.active.value).toBe(2);
    r.sel.value = -1; r.setActive(4);
    r.n.value = 3;
    await nextTick();
    expect(r.active.value).toBe(2);
    r.n.value = 0;
    await nextTick();
    r.onKeydown(key('Enter'));
    r.onKeydown(key('ArrowRight'));
    expect(r.activate).not.toHaveBeenCalled();
    expect(r.active.value).toBe(0);
    r.scope.stop();
  });
});
