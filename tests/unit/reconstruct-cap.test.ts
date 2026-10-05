// Gap closure Task 4 (GRA2, GCP9): a cap on AUTOMATIC reconstruction. A context loss makes
// the view dispose and rebuild; without a bound, a GPU that keeps losing the context loops
// forever. After MAX_AUTOMATIC_RECONSTRUCTIONS rebuilds the factory answers with
// unavailable{initialization-failed} before it returns, and only reset() (Retry 3D) lifts it.
import { describe, expect, it, vi } from 'vitest';
import { MAX_AUTOMATIC_RECONSTRUCTIONS, createReconstructCap } from '../../src/visualization/reconstruct-cap';
import { makeInertPort } from '../../src/visualization/inert-port';
import type { CityRendererEvent, CityRendererPort, CreateCityRenderer } from '../../src/visualization/renderer-port';

interface Harness {
  inner: ReturnType<typeof vi.fn<CreateCityRenderer>>;
  emitters: Array<(e: CityRendererEvent) => void>;
}

function makeInner(): Harness {
  const emitters: Array<(e: CityRendererEvent) => void> = [];
  const inner = vi.fn<CreateCityRenderer>((_mountEl, _win, onEvent) => {
    emitters.push(onEvent);
    return makeInertPort();
  });
  return { inner, emitters };
}

const MOUNT = {} as HTMLElement;
const WIN = {} as Window;

function lose(h: Harness): void {
  h.emitters[h.emitters.length - 1]!({ type: 'unavailable', reason: 'context-lost' });
}

describe('createReconstructCap (GRA2)', () => {
  it('caps automatic reconstruction at 3: 1 initial + 3 rebuilds reach the inner factory, the 5th create does not', () => {
    expect(MAX_AUTOMATIC_RECONSTRUCTIONS).toBe(3);
    const h = makeInner();
    const seen: CityRendererEvent[] = [];
    const cap = createReconstructCap(h.inner);
    cap.create(MOUNT, WIN, (e) => { seen.push(e); });
    for (let i = 0; i < 3; i += 1) {
      lose(h);
      cap.create(MOUNT, WIN, (e) => { seen.push(e); });
    }
    expect(h.inner).toHaveBeenCalledTimes(4);
    lose(h);   // the 4th loss
    seen.length = 0;
    const returned: CityRendererPort = cap.create(MOUNT, WIN, (e) => { seen.push(e); });
    expect(h.inner).toHaveBeenCalledTimes(4);
    // Synchronously, before create returned: the event is already recorded.
    expect(seen).toEqual([{ type: 'unavailable', reason: 'initialization-failed' }]);
    // An inert port: every method is a no-op and never throws.
    expect(() => { returned.dispose(); returned.setSelection('x'); returned.resize(1, 1, 1); }).not.toThrow();
    expect(returned.getDiagnostics().contextLost).toBe(false);
  });

  it('reset() lets create reach the inner factory again', () => {
    const h = makeInner();
    const cap = createReconstructCap(h.inner);
    cap.create(MOUNT, WIN, () => {});
    for (let i = 0; i < 4; i += 1) { lose(h); cap.create(MOUNT, WIN, () => {}); }
    expect(h.inner).toHaveBeenCalledTimes(4);
    cap.reset();
    cap.create(MOUNT, WIN, () => {});
    expect(h.inner).toHaveBeenCalledTimes(5);
  });

  it('does not count initialization-failed or unsupported', () => {
    const h = makeInner();
    const cap = createReconstructCap(h.inner);
    cap.create(MOUNT, WIN, () => {});
    for (let i = 0; i < 6; i += 1) {
      h.emitters[h.emitters.length - 1]!({ type: 'unavailable', reason: i % 2 === 0 ? 'initialization-failed' : 'unsupported' });
      cap.create(MOUNT, WIN, () => {});
    }
    expect(h.inner).toHaveBeenCalledTimes(7);
  });

  it('does not count a create with no loss in between (a window migration)', () => {
    const h = makeInner();
    const cap = createReconstructCap(h.inner);
    for (let i = 0; i < 8; i += 1) cap.create(MOUNT, WIN, () => {});
    expect(h.inner).toHaveBeenCalledTimes(8);
  });

  it('forwards every event to the caller, context-lost included', () => {
    const h = makeInner();
    const seen: CityRendererEvent[] = [];
    const cap = createReconstructCap(h.inner);
    cap.create(MOUNT, WIN, (e) => { seen.push(e); });
    lose(h);
    expect(seen).toEqual([{ type: 'unavailable', reason: 'context-lost' }]);
  });
});
