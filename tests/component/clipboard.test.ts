// Task 9 fix round 2, item 3 (Minor fold): `clipboard.ts`'s default `writeText`
// used to resolve silently (`undefined`) when the shared stage element has no
// window yet -- the optional chain `win?.navigator.clipboard.writeText(text)`
// short-circuits without ever calling `navigator.clipboard`, so `await` sees a
// resolved `undefined`, not a rejection. `FileInspector.vue`'s own `copyRelativePath`
// (COPY-27) then reports success without ever having copied anything. Exercised via
// a real mounted component (not a component-level double, unlike file-inspector.test.ts's
// own tests, which always inject their OWN `clipboard` double and so never reach
// this file's actual default implementation at all).
import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useClipboard } from '../../src/ui/clipboard';

function mountWithClipboard() {
  let captured: ReturnType<typeof useClipboard> | null = null;
  const Host = defineComponent({
    setup() {
      captured = useClipboard();
      return () => h('div');
    },
  });
  mount(Host);
  return captured!;
}

describe('useClipboard()', () => {
  it('rejects, rather than silently resolving, when no stage window is available yet', async () => {
    const clipboard = mountWithClipboard();
    // No `provideCityStageEl()` ancestor exists in this bare mount, so
    // `useCityStageEl()` falls back to its own fresh, always-null ref (never a
    // real stage) -- exactly the "stage never mounted" case the header comment
    // above describes.
    await expect(clipboard.writeText('src/example.ts')).rejects.toThrow();
  });
});
