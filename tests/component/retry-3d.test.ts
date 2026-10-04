// Gap closure Task 4 (GRA2, GCN2, GCP9): once automatic reconstruction is capped, the city
// shows the 3D-unavailable notice (COPY-14) with a user-initiated "Retry 3D". Retry
// reinitialises the RENDERER ONLY: it resets the cap, remounts the viewport, returns focus
// to the stage and never asks for a scan.
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import '../mocks/obsidian';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CityStage from '../../src/ui/components/CityStage.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { createReconstructCap } from '../../src/visualization/reconstruct-cap';
import { makeInertPort } from '../../src/visualization/inert-port';
import { COPY_14, CONTEXT_LOST_NOTICE, RETRY_3D } from '../../src/ui/copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import type { CityRendererEvent, CreateCityRenderer } from '../../src/visualization/renderer-port';

const mounted: { unmount(): void }[] = [];
let rectSpy: MockInstance | null = null;

function setStageRect(width: number, height: number): void {
  rectSpy?.mockRestore();
  rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}),
  });
}

function keep<T extends { unmount(): void }>(wrapper: T): T {
  mounted.push(wrapper);
  return wrapper;
}

function mountStage(factory: CreateCityRenderer, onRetry: () => void = () => {}) {
  const retry = vi.fn<() => void>(onRetry);
  const scan = vi.fn<() => void>();
  const w = keep(mount(CityStage, {
    attachTo: document.body,
    global: { provide: { createCityRenderer: factory, retryCityRenderer: retry, onScanRequested: scan } },
  }));
  return { w, retry, scan };
}

async function settle(): Promise<void> {
  await nextTick();
  await nextTick();
  await nextTick();
}

const retryButtons = (w: ReturnType<typeof mountStage>['w']) => w.findAll('button').filter((b) => b.text() === RETRY_3D);

/** Emits `reason` synchronously from inside the factory, the way the real one does for an
 *  initialization failure. */
function failingFactory(reason: 'unsupported' | 'initialization-failed'): ReturnType<typeof vi.fn<CreateCityRenderer>> {
  return vi.fn<CreateCityRenderer>((_mountEl, _win, onEvent) => {
    onEvent({ type: 'unavailable', reason });
    return makeInertPort();
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
  const snapshot = buildSnapshotFixture({ files: 6, directories: 2, repositoryId: 'repo-retry' });
  useCityStore().setCity(snapshot, computeLayout(snapshot));
  setStageRect(800, 600);
});

afterEach(() => {
  while (mounted.length > 0) mounted.pop()!.unmount();
  rectSpy?.mockRestore();
  rectSpy = null;
});

describe('Retry 3D (GRA2, GCN2)', () => {
  it.each(['initialization-failed', 'unsupported'] as const)('shows a "Retry 3D" button under COPY-14 after %s', async (reason) => {
    const { w } = mountStage(failingFactory(reason));
    await settle();
    expect(w.text()).toContain(COPY_14);
    expect(retryButtons(w)).toHaveLength(1);
    expect(retryButtons(w)[0]!.attributes('type')).toBe('button');
  });

  it('does not show for context-lost', async () => {
    let capture: ((e: CityRendererEvent) => void) | null = null;
    const factory = vi.fn<CreateCityRenderer>((_m, _w, onEvent) => { capture = onEvent; return makeInertPort(); });
    const { w } = mountStage(factory);
    await settle();
    expect(factory).toHaveBeenCalledTimes(1);
    // A zero-height box makes the automatic rebuild return early, so the context-lost notice
    // genuinely stays on screen (responsive-floor.test.ts pins the same boundary).
    setStageRect(800, 0);
    capture!({ type: 'unavailable', reason: 'context-lost' });
    await settle();
    expect(w.text()).toContain(CONTEXT_LOST_NOTICE);
    expect(retryButtons(w)).toHaveLength(0);
  });

  it('does not show under the 320 px floor notice', async () => {
    setStageRect(300, 600);
    const factory = vi.fn<CreateCityRenderer>(() => makeInertPort());
    const { w } = mountStage(factory);
    await settle();
    expect(factory).not.toHaveBeenCalled();
    expect(retryButtons(w)).toHaveLength(0);
  });

  it('is absent while 3D is healthy', async () => {
    const { w } = mountStage(vi.fn<CreateCityRenderer>(() => makeInertPort()));
    await settle();
    expect(w.text()).not.toContain(COPY_14);
    expect(retryButtons(w)).toHaveLength(0);
  });

  it('click: resets the cap once, builds the renderer once more, focuses the stage, never scans', async () => {
    let healthy = false;
    const factory = vi.fn<CreateCityRenderer>((_mountEl, _win, onEvent) => {
      if (!healthy) onEvent({ type: 'unavailable', reason: 'initialization-failed' });
      return makeInertPort();
    });
    const { w, retry, scan } = mountStage(factory, () => { healthy = true; });
    await settle();
    expect(factory).toHaveBeenCalledTimes(1);

    await retryButtons(w)[0]!.trigger('click');
    await settle();

    expect(retry).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(2);
    expect(scan).not.toHaveBeenCalled();
    expect(w.text()).not.toContain(COPY_14);
    expect(retryButtons(w)).toHaveLength(0);
    const stage = w.get('[data-ci-role="stage"]').element;
    expect(document.activeElement).toBe(stage);
  });

  it('GCP9: a list/3d round trip with the cap exhausted still offers Retry 3D (it does not reset the cap)', async () => {
    const lossEmitters: Array<(e: CityRendererEvent) => void> = [];
    const inner = vi.fn<CreateCityRenderer>((_m, _w, onEvent) => { lossEmitters.push(onEvent); return makeInertPort(); });
    const cap = createReconstructCap(inner, 0);   // the first loss exhausts it
    const { w, retry } = mountStage(cap.create, () => { cap.reset(); });
    await settle();
    expect(inner).toHaveBeenCalledTimes(1);
    lossEmitters[0]!({ type: 'unavailable', reason: 'context-lost' });
    await settle();
    expect(inner).toHaveBeenCalledTimes(1);   // the rebuild was refused
    expect(w.text()).toContain(COPY_14);
    expect(retryButtons(w)).toHaveLength(1);

    const store = useCityStore();
    store.setViewMode('list');
    await settle();
    expect(w.find('[data-ci-role="stage"]').exists()).toBe(false);
    store.setViewMode('3d');
    await settle();
    expect(inner).toHaveBeenCalledTimes(1);   // still capped
    expect(w.text()).toContain(COPY_14);
    expect(retryButtons(w)).toHaveLength(1);
    expect(retry).not.toHaveBeenCalled();

    await retryButtons(w)[0]!.trigger('click');
    await settle();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(inner).toHaveBeenCalledTimes(2);
    expect(w.text()).not.toContain(COPY_14);
    expect(w.text()).not.toContain(CONTEXT_LOST_NOTICE);
  });
});
