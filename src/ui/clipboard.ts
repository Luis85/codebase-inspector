// Minimal clipboard seam so FileInspector.vue's "Copy relative path" action is
// injectable under test, never reaching a bare `navigator.clipboard` directly from
// a .vue <script setup> block (a real ESLint 'no-unused-vars'/vue-eslint-parser
// interaction flags a plain interface method's parameter name when declared inline
// in an SFC — moving the type here, a plain .ts file, avoids it without weakening
// any rule).
//
// Task 9 fix round 1, item 5 (Important, spec 4.4's cross-window rule): the
// default clipboard used to read the bare global `navigator`, which after a
// pop-out is the WRONG window's navigator. Reads `win.navigator` off the shared
// stage element instead (renderer-handle.ts's own cross-window-correct handle),
// resolved LAZILY inside `writeText` — not once at inject time, when the stage
// may not have mounted yet — so a real copy always targets the window the view
// is actually showing in.
//
// Task 9 fix round 2, item 3 (Minor fold): when the stage never mounted, this
// used to silently do nothing — `win?.navigator.clipboard.writeText(text)`
// short-circuits the WHOLE chain without throwing, so `await` sees a resolved
// `undefined`, not a failure. `FileInspector.vue`'s `copyRelativePath` then
// reported COPY-27 (success) without ever having copied anything. Throws instead,
// so that existing catch block (its selectable-text fallback) actually runs.
import { inject } from 'vue';
import { useCityStageEl } from './renderer-handle';

export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

interface WinBearing { win?: Window }

/** The stage's own window first — that is the cross-window-correct answer after a
 *  pop-out migration (spec 4.4), and it is the window the view is actually showing in.
 *
 *  Task 10 fix round 1, fold: with `CityViewport` no longer mounted in list mode (spec
 *  5.2's "no renderer exists"), the stage handle is NULL there, while `FileInspector` is
 *  gated on `inspectorOpen` and is entirely independent of `viewMode`. Without this
 *  fallback, "Copy relative path" would throw in exactly the mode the spec calls the
 *  fallback. `activeWindow` is Obsidian's own ambient cross-window global, kept pointed
 *  at the window holding the focused leaf — the sanctioned answer, and still never a bare
 *  `window`. Outside a real host (and in `clipboard.test.ts`, which deliberately does not
 *  install it) it is undefined, and the throw below still fires. */
function resolveWindow(stage: HTMLElement | null): Window | null {
  const fromStage = (stage as unknown as WinBearing | null)?.win;
  if (fromStage) return fromStage;
  return typeof activeWindow === 'undefined' ? null : activeWindow;
}

export function useClipboard(): ClipboardLike {
  const stageHandle = useCityStageEl();
  return inject<ClipboardLike>('clipboard', () => ({
    async writeText(text: string): Promise<void> {
      const win = resolveWindow(stageHandle.value);
      if (!win) throw new Error('clipboard unavailable: no stage window');
      await win.navigator.clipboard.writeText(text);
    },
  }), true);
}
