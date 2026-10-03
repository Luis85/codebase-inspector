import type { CancellationToken } from '../../src/application/ports/cancellation-token';

/** A minimal, controllable CancellationToken test double. Not named in the task-5
 *  brief's file list, but every contract-suite cancellation test and the collector's
 *  own cancellation test need one, and the brief's Interfaces section names
 *  `CancellationToken` as a task-2 export with no accompanying test double — this fills
 *  that gap the same way `tests/fixtures/snapshot-builder.ts` fills one for `model.ts`.
 *
 *  `throwIfCancelled` throws a plain, private error — deliberately NOT the production
 *  `CancellationError` that `collectInventory` exports (ruling M21). That type is
 *  `collectInventory`'s own guarantee to ITS callers, produced regardless of what a
 *  concrete `CancellationToken` implementation happens to throw; a contract-suite test
 *  double that already threw the exact production error type would prove nothing about
 *  that normalisation actually happening. */
export function createCancellationToken(): { token: CancellationToken; cancel: () => void } {
  let cancelled = false;
  const listeners = new Set<() => void>();
  const token: CancellationToken = {
    get cancelled() { return cancelled; },
    throwIfCancelled(): void {
      if (cancelled) throw new Error('cancelled (test double)');
    },
    onCancelled(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    token,
    cancel(): void {
      if (cancelled) return;
      cancelled = true;
      for (const listener of listeners) listener();
    },
  };
}
