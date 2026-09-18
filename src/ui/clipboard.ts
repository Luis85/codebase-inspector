// Minimal clipboard seam so FileInspector.vue's "Copy relative path" action is
// injectable under test, never reaching a bare `navigator.clipboard` directly from
// a .vue <script setup> block (a real ESLint 'no-unused-vars'/vue-eslint-parser
// interaction flags a plain interface method's parameter name when declared inline
// in an SFC — moving the type here, a plain .ts file, avoids it without weakening
// any rule).
import { inject } from 'vue';

export interface ClipboardLike {
  writeText(text: string): Promise<void>;
}

function realClipboard(): ClipboardLike {
  return (typeof navigator !== 'undefined' ? navigator.clipboard : undefined) as unknown as ClipboardLike;
}

export function useClipboard(): ClipboardLike {
  return inject<ClipboardLike>('clipboard', realClipboard, true);
}
