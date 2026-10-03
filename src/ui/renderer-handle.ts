// A single, shared provide/inject key for the live CityRendererPort handle, so
// CodebaseFileList, CameraControls and FileInspector can COMMAND the renderer
// (setSelection, nudgeCamera, focus, …) that CityViewport constructs, without any of
// them importing 'three' or the renderer's own construction code — src/ui/** depends
// only on the port's TYPES (renderer-port.ts), never on src/visualization/**'s
// implementation.
//
// App.vue provides ONE `Ref<CityRendererPort | null>` at the top of the tree;
// CityViewport is the only writer (it populates the ref once construction succeeds,
// and clears it back to null on `unavailable`/dispose); every sibling that needs to
// issue a command is a reader only. This keeps exactly one owner and an arbitrary
// number of commanders, mirroring how city-view.ts (unmodified this task) already
// keeps exactly one `this.renderer` field private to itself.
import { inject, provide, shallowRef } from 'vue';
import type { InjectionKey, ShallowRef } from 'vue';
import type { CityRendererPort } from '../visualization/renderer-port';

export const CITY_RENDERER_KEY: InjectionKey<ShallowRef<CityRendererPort | null>> = Symbol('city-renderer');

/** Called by App.vue, near the root of the tree. `shallowRef`, deliberately — a
 *  plain `ref` would deep-wrap the assigned CityRendererPort in a reactive Proxy
 *  (Vue's automatic `toReactive`), so `renderer.value` would no longer be the SAME
 *  object CityViewport handed it, and `expect(handle.value).toBe(rendererDouble)`
 *  (and, in production, `resize === renderer.resize` style identity checks) would
 *  fail even though behaviour looked identical — a real defect this shallowRef
 *  avoids rather than a style preference.
 *
 *  Task 9 fix round 2, item 1 (ruling M68): IDEMPOTENT — first checks whether an
 *  ancestor already provided one (via `inject`) and reuses it instead of shadowing
 *  it with a fresh, disconnected ref for App.vue's own descendants. `city-view.ts`
 *  now provides the shared handle at the APP level (`this.vueApp.provide(...)`,
 *  before `mount()`), because it needs to command the SAME renderer directly
 *  (theme-colour refresh, `setLayout`) without going through a component's own
 *  `provide()`/`inject()` — which only resolves against the app's own provides,
 *  never a descendant component's. Without this idempotence, App.vue's own
 *  unconditional `provide()` call would silently split "the one shared handle"
 *  into two: the one `city-view.ts` writes to, and a different one CityViewport's
 *  siblings would actually read from. Standalone component tests (no `CityView`
 *  ancestor at all) still get a fresh one here, exactly as before. */
export function provideCityRenderer(): ShallowRef<CityRendererPort | null> {
  const existing = inject(CITY_RENDERER_KEY, null);
  if (existing) return existing;
  const handle = shallowRef<CityRendererPort | null>(null);
  provide(CITY_RENDERER_KEY, handle);
  return handle;
}

/** Called by any component that needs to read or (CityViewport only) write the live
 *  renderer. The default is a fresh, locally-owned ref — never `null` — so a
 *  component mounted standalone (a component test with no App.vue ancestor) behaves
 *  exactly like one with no renderer available yet, rather than throwing. */
export function useCityRendererHandle(): ShallowRef<CityRendererPort | null> {
  return inject(CITY_RENDERER_KEY, () => shallowRef<CityRendererPort | null>(null), true);
}

/** The `{generation}` half of spec 4.2's setLayout job token, shared by every caller
 *  that writes to one live port (ruling M78).
 *
 *  TWO writers call setLayout on the SAME port: `city-view.ts` on every publish, and
 *  `CityViewport` on every renderer construction — a context loss, or a drag below the
 *  320 px floor and back, neither of which unmounts the component. Each used to keep its
 *  own counter, so one port received two independent sequences against one
 *  `latestGeneration`, and the port — correctly, per a contract that is frozen and right
 *  — discarded whichever was lower. The reachable path: a retained-state reopen sends 1,
 *  one floor round trip makes the live port 2, and the next publish sends its own 1,
 *  which is silently never applied. The city then shows a snapshot the store no longer
 *  holds, with no error and no visible cue.
 *
 *  A DISPENSER, not a counter: there is deliberately no way to read the current value
 *  without advancing it. That is what makes the port's `<` rule sound. Two calls at the
 *  same generation are not ordered at all — neither supersedes the other, so whichever
 *  build finishes last wins, which is how a 1200-lot layout lands on top of a 10-lot one
 *  issued after it. The fix for that is a fresh token per CALL, not a different operator:
 *  `<=` would be worse than wrong, because setLayout raises `latestGeneration` to its own
 *  generation before the check, so every call would find itself superseded and nothing
 *  would ever render at all. */
export type LayoutGenerationSource = () => number;

export const LAYOUT_GENERATION_KEY: InjectionKey<LayoutGenerationSource> = Symbol('layout-generation');

/** One per view, created by `city-view.ts` and provided at the app level beside the
 *  shared handle — the same lifetime as the port those tokens are addressed to. */
export function createLayoutGenerationSource(): LayoutGenerationSource {
  let issued = 0;
  return () => {
    issued += 1;
    return issued;
  };
}

/** The default is a fresh, locally-owned source — never a shared one — so a component
 *  mounted standalone behaves like a view of its own rather than throwing. */
export function useLayoutGeneration(): LayoutGenerationSource {
  return inject(LAYOUT_GENERATION_KEY, () => createLayoutGenerationSource(), true);
}

// The stage element itself (CityViewport's focusable, named region) is shared the
// same way: CameraControls needs to know whether IT currently has focus (spec 5.2:
// "F, T, +/-, arrows... work only when the canvas itself has focus"), and does not
// otherwise hold a reference to CityViewport's own template ref.
export const CITY_STAGE_KEY: InjectionKey<ShallowRef<HTMLElement | null>> = Symbol('city-stage-el');

export function provideCityStageEl(): ShallowRef<HTMLElement | null> {
  const handle = shallowRef<HTMLElement | null>(null);
  provide(CITY_STAGE_KEY, handle);
  return handle;
}

export function useCityStageEl(): ShallowRef<HTMLElement | null> {
  return inject(CITY_STAGE_KEY, () => shallowRef<HTMLElement | null>(null), true);
}
