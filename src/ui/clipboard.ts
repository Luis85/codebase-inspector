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

export function useClipboard(): ClipboardLike {
  const stageHandle = useCityStageEl();
  return inject<ClipboardLike>('clipboard', () => ({
    async writeText(text: string): Promise<void> {
      const win = (stageHandle.value as unknown as WinBearing | null)?.win;
      if (!win) throw new Error('clipboard unavailable: no stage window');
      await win.navigator.clipboard.writeText(text);
    },
  }), true);
}
