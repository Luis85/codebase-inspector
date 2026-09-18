// Task 10 fix round 1, fold: the hazard that BLOCKS the list-mode `v-if`.
//
// `useClipboard` takes its Window from `useCityStageEl()`, which `CityViewport` nulls on
// unmount — but `FileInspector` is `v-if="store.inspectorOpen"`, independent of
// `viewMode`. So the moment the viewport stops being mounted in list mode (spec 5.2's
// "no renderer exists"), "Copy relative path" would throw *clipboard unavailable: no
// stage window* in exactly the mode the spec calls the FALLBACK. The fallback window had
// to exist before the v-if did.
//
// Deliberately its OWN file rather than an addition to clipboard.test.ts: that file must
// NOT import the Obsidian mock, because its test ("rejects when no stage window is
// available yet") depends on there being no cross-window global either. Importing the
// mock there would have changed what that test asserts. Here the mock is the point.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, shallowRef } from 'vue';
import { mount } from '@vue/test-utils';
import '../mocks/obsidian';      // installs Obsidian's ambient `activeWindow`
import { useClipboard } from '../../src/ui/clipboard';
import { CITY_STAGE_KEY } from '../../src/ui/renderer-handle';

let captured: ReturnType<typeof useClipboard> | null = null;

/** One component for the whole file (vue/one-component-per-file): the stage handle is
 *  supplied through mount's own `provide`, not through a second wrapper component. */
const Host = defineComponent({
  setup() {
    captured = useClipboard();
    return () => h('div');
  },
});

function mountWithStage(stageEl: HTMLElement | null): ReturnType<typeof useClipboard> {
  captured = null;
  mount(Host, { global: { provide: { [CITY_STAGE_KEY as symbol]: shallowRef(stageEl) } } });
  return captured!;
}

describe('useClipboard() without a mounted stage', () => {
  let writeText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    writeText = vi.fn(async () => {});
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText }, configurable: true, writable: true,
    });
  });

  it('falls back to the cross-window global, so list mode can still copy a path', async () => {
    // A null stage handle is the exact state list mode leaves behind once CityViewport
    // is no longer mounted.
    const clipboard = mountWithStage(null);
    await expect(clipboard.writeText('src/example.ts')).resolves.toBeUndefined();
    expect(writeText).toHaveBeenCalledWith('src/example.ts');
  });

  it('still prefers the stage window when one exists, never the ambient global', async () => {
    // The stage's own window is the cross-window-correct answer after a pop-out (spec
    // 4.4); the ambient global is only what is left when there is no stage at all.
    const stageWriteText = vi.fn(async () => {});
    const stageEl = document.body.createDiv();
    (stageEl as unknown as { win: Window }).win = {
      navigator: { clipboard: { writeText: stageWriteText } },
    } as unknown as Window;

    await mountWithStage(stageEl).writeText('src/example.ts');
    expect(stageWriteText).toHaveBeenCalledWith('src/example.ts');
    expect(writeText).not.toHaveBeenCalled();
  });
});
