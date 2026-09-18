// Task 11. Spec 4.2: "Pop-out migration is dispose() plus constructing a new
// renderer. There is no rebind." — and, ruling M79 (task-11-context.md section 3):
// that behaviour is observed through the SHARED renderer handle and
// `CityViewport`'s own lifecycle now, never a `view.renderer` field (ruling M68
// removed it in task 9).
//
// A canvas moved to a different window's document is, in every browser this plugin
// ships to, exactly as unusable as one whose context was lost by the platform:
// Chromium does not keep a WebGLRenderingContext alive across a cross-window
// `adoptNode`. This module does not wait to find out empirically — it disposes and
// NULLS the shared handle the instant Obsidian reports the migration, which is the
// SAME transition `CityViewport`'s own `unavailable{context-lost}` branch already
// produces (city-viewport's own `watch(cityRendererHandle, ...)` reconstructs
// whenever the handle becomes null while still mounted, regardless of which of the
// two produced it — ONE recovery path, not two). This file never constructs a
// renderer itself (only `CityViewport` does, ruling M68) and never touches the
// coordinator: visibility and migration never authorise a scan (spec 4.2).
import type { ShallowRef } from 'vue';
import type { CityRendererPort } from '../visualization/renderer-port';

export interface WindowMigrationDeps {
  cityRendererHandle: ShallowRef<CityRendererPort | null>;
}

/** Registers `containerEl`'s real, ambient Obsidian extension
 *  (`HTMLElement.prototype.onWindowMigrated`) and returns the SAME destroy function
 *  it hands back — the caller (`city-view.ts`) retains it and calls it in
 *  `onClose()`, never re-derives or drops it: an un-retained registration is a
 *  leaked closure over this view for the life of the window. */
export function wireWindowMigration(containerEl: HTMLElement, deps: WindowMigrationDeps): () => void {
  return containerEl.onWindowMigrated(() => {
    deps.cityRendererHandle.value?.dispose();
    deps.cityRendererHandle.value = null;
  });
}
