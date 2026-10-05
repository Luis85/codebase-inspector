// Gap closure Task 4 (GRA2, GCP9). CityViewport disposes and reconstructs the renderer on
// every `unavailable{context-lost}` (spec 4.2, M80). Unbounded, a GPU that keeps losing the
// context loops forever. This wraps the injected factory: after MAX_AUTOMATIC_RECONSTRUCTIONS
// rebuilds the next create answers `unavailable{initialization-failed}` SYNCHRONOUSLY, before
// it returns (the shape CityViewport already handles, see city-viewport.test.ts), with an
// inert port, so the leaf shows the 3D-unavailable notice instead of rebuilding again.
//
// Only a context-lost counts. A create with no loss in between (a window migration) and an
// initialization-failed/unsupported answer do not. Only reset() lifts the cap, and the only
// caller is the user's "Retry 3D" (renderer only, never a scan); a list/3D round trip does not.
import { makeInertPort } from './inert-port';
import type { CreateCityRenderer } from './renderer-port';

export const MAX_AUTOMATIC_RECONSTRUCTIONS = 3;

export interface ReconstructCap {
  create: CreateCityRenderer;
  reset(): void;
}

export function createReconstructCap(inner: CreateCityRenderer, max = MAX_AUTOMATIC_RECONSTRUCTIONS): ReconstructCap {
  let losses = 0;
  const create: CreateCityRenderer = (mountEl, win, onEvent) => {
    if (losses > max) {
      onEvent({ type: 'unavailable', reason: 'initialization-failed' });
      return makeInertPort();
    }
    return inner(mountEl, win, (event) => {
      if (event.type === 'unavailable' && event.reason === 'context-lost') losses += 1;
      onEvent(event);
    });
  };
  return { create, reset: () => { losses = 0; } };
}
