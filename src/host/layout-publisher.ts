// WP-02 Part 5 (V1): publishing a snapshot's layout, cut out of city-view.ts with no
// behaviour change.
//
// Obligation 7 (task-8 brief step 4): recomputes the layout from the published snapshot
// and hands it to setLayout with {generation, signal}. `nextGeneration` is ruling M78's
// SHARED dispenser -- `CityViewport` draws from the SAME one on every renderer
// construction, since both writers send `setLayout` to one live port (renderer-handle.ts)
// -- deliberately distinct from the scan run's own `generation`. `setCity` runs
// UNCONDITIONALLY, before checking whether a renderer exists: the HTML list, inspector and
// legend must hold real data below the 320 px floor too, where none does (spec 5.2's
// list-first fallback). `computeLayout` gets its own try/catch -- it has no never-throws
// contract, and this runs even with no renderer to catch a later throw for it.
import type { ShallowRef } from 'vue';
import { computeLayout } from '../domain/layout/layout';
import type { LayoutResult } from '../domain/layout/types';
import type { CodebaseSnapshot } from '../domain/model';
import type { CityRendererPort } from '../visualization/renderer-port';
import type { LayoutGenerationSource } from '../ui/renderer-handle';
import { CITY_RENDER_FAILURE_NOTICE } from '../ui/copy';

export interface LayoutPublisherOptions {
  /** Ruling M68: the view's SHARED renderer handle. `CityViewport` is its only writer. */
  handle: ShallowRef<CityRendererPort | null>;
  nextGeneration: LayoutGenerationSource;
  /** The view's own city store (ruling M66), or a no-op once the view has closed. */
  setCity: (snapshot: CodebaseSnapshot, layout: LayoutResult) => void;
  notify: (message: string) => void;
}

export interface LayoutPublisher {
  publish: (snapshot: CodebaseSnapshot) => Promise<void>;
  /** Called from `onClose`: aborts the in-flight `setLayout`, if any. */
  abort: () => void;
}

export function createLayoutPublisher(options: LayoutPublisherOptions): LayoutPublisher {
  const { handle, nextGeneration, setCity, notify } = options;
  let inFlight: AbortController | null = null;

  async function publish(snapshot: CodebaseSnapshot): Promise<void> {
    let layout: LayoutResult;
    try {
      layout = computeLayout(snapshot);
    } catch {
      notify(CITY_RENDER_FAILURE_NOTICE);
      return;
    }
    setCity(snapshot, layout);
    const renderer = handle.value;
    if (!renderer) return;
    // Fix round 1, Minor 8: every call site is `void publish(...)`, so an uncaught throw
    // here would be an unhandled promise rejection, not a catchable error anywhere.
    // `setLayout` itself never rejects (spec 4.2).
    try {
      inFlight?.abort();
      inFlight = new AbortController();
      await renderer.setLayout(layout, { generation: nextGeneration(), signal: inFlight.signal });
    } catch {
      notify(CITY_RENDER_FAILURE_NOTICE);
    }
  }

  return { publish, abort: () => { inFlight?.abort(); } };
}
