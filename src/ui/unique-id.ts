import { useId } from 'vue';

// Vue's useId() is unique only within ONE app, and every leaf mounts its own app
// (src/host/city-view.ts). The module-level counter keeps ids unique across leaves too,
// for the same reason CommandPalette.vue keeps its own `paletteSequence`.
let sequence = 0;

/** Call from <script setup> only (useId needs a component instance). */
export function useUniqueId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${useId()}-${sequence}`;
}
