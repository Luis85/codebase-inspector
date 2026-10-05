import type { Clock } from '../../src/application/ports/clock';

/** A fixed Clock test double: not named in the task-5 brief's file list, but
 *  `collectInventory` takes one and no test double for it exists yet (task 2 produced
 *  only the `Clock` interface). Advancing `current` between calls lets a test assert
 *  distinct `capturedAt` / `completedAt` timestamps deterministically. */
export function createFixedClock(startIso = '2026-01-01T00:00:00.000Z'): Clock & { advance(ms: number): void } {
  let current = new Date(startIso);
  return {
    now: () => current,
    nowIso: () => current.toISOString(),
    advance(ms: number): void {
      current = new Date(current.getTime() + ms);
    },
  };
}
