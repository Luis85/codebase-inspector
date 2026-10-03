import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';
import { contentBoxInlineSize, narrowContainer } from '../container-box';

interface WinBearing { win?: Window }

/** The leaf's content-box inline size, tracked through the element's OWN window (spec 4.4)
 *  and re-attached after a pop-out migration. 0 while hidden or before layout. */
export function useLeafWidth(rootEl: Ref<HTMLElement | null>): Ref<number> {
  const width = ref(0);
  let observer: ResizeObserver | null = null;
  let unwire: (() => void) | null = null;

  function measure(el: HTMLElement): void { width.value = contentBoxInlineSize(narrowContainer(el)); }

  function attach(el: HTMLElement): void {
    observer?.disconnect();
    observer = null;
    measure(el);
    const win = (el as unknown as WinBearing).win;
    if (!win) return;
    observer = new (win as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver(() => { measure(el); });
    observer.observe(narrowContainer(el));
  }

  onMounted(() => {
    const el = rootEl.value;
    if (!el) return;
    attach(el);
    unwire = el.onWindowMigrated(() => { attach(el); });
  });
  onBeforeUnmount(() => { observer?.disconnect(); observer = null; unwire?.(); unwire = null; });
  return width;
}
