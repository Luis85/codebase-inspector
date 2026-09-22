// Part 5 E19 fix round: ClearReviewDialog and ImportReviewDialog repeated the same
// busy-guard/error scaffold verbatim. Extracted here: `busy`/`error` state, a
// `requestClose` that ignores Cancel/Escape/backdrop while busy (Part 4 E13, so the
// outcome — an announcement or an error — is never lost mid-action), and `run`, which
// sets busy/clears error before the action and always clears busy after, catching a
// rejection into `failedMessage`. Each caller's action decides its own true/false split
// (setting `error.value` itself for a refusal) — only the surrounding scaffold is shared.
import { ref, type Ref } from 'vue';

export interface BusyAction {
  busy: Ref<boolean>;
  error: Ref<string>;
  // `this: void`: callers destructure these off the returned object (`const { run } =
  // useBusyAction()`), so @typescript-eslint/unbound-method needs the signature to say
  // neither closes over `this` (neither does — both are plain closures over `busy`/`error`).
  requestClose(this: void, emitClose: () => void): void;
  run(this: void, action: () => Promise<void>, failedMessage: string): Promise<void>;
}

export function useBusyAction(): BusyAction {
  const busy = ref(false);
  const error = ref('');

  function requestClose(emitClose: () => void): void {
    if (busy.value) return;
    emitClose();
  }

  async function run(action: () => Promise<void>, failedMessage: string): Promise<void> {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    try {
      await action();
    } catch {
      error.value = failedMessage;
    } finally {
      busy.value = false;
    }
  }

  return { busy, error, requestClose, run };
}
