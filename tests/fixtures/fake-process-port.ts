// Part 7 Z21: a scriptable AnalyzerProcessPort. Each `run` waits until the test settles
// it; a cancelled token resolves it as `cancelled`, exactly as the real adapter does.
import { setTimeout as delay } from 'node:timers/promises';
import type { AnalyzerProcessPort, ProcessOutcome, ProcessRequest } from '../../src/application/ports/analyzer-process';
import type { CancellationToken } from '../../src/application/ports/cancellation-token';

interface Pending { request: ProcessRequest; resolve: (outcome: ProcessOutcome) => void }

export interface FakeProcessPort extends AnalyzerProcessPort {
  readonly requests: ProcessRequest[];
  /** Resolves the oldest pending run with `outcome`, then lets the coordinator catch up. */
  settle(outcome: ProcessOutcome): Promise<void>;
  pending(): number;
  killAllCalls(): number;
}

type ExitedOutcome = Extract<ProcessOutcome, { kind: 'exited' }>;

/** Typed to the `exited` arm alone (not the whole `ProcessOutcome` union): callers spread
 *  its result to override `stderrTail`, and a union-typed spread loses the discriminant
 *  TypeScript needs to excess-property-check the result against `ProcessOutcome`. */
export const exitedWith = (exitCode: number, stdout: string | null): ExitedOutcome =>
  ({ kind: 'exited', exitCode, stdout, stdoutBytes: stdout === null ? 0 : stdout.length, stderrTail: '' });

const tick = (): Promise<void> => delay(0);

export function createFakeProcessPort(): FakeProcessPort {
  const requests: ProcessRequest[] = [];
  let queue: Pending[] = [];
  let kills = 0;
  return {
    requests,
    run(request: ProcessRequest, token: CancellationToken): Promise<ProcessOutcome> {
      requests.push(request);
      // Polish B9: parity with the real runner, which never spawns for a token already cancelled
      // (and a token's onCancelled never fires for a cancel that already happened).
      if (token.cancelled) return Promise.resolve({ kind: 'cancelled', stderrTail: '' });
      return new Promise<ProcessOutcome>((resolve) => {
        const entry: Pending = { request, resolve };
        queue.push(entry);
        token.onCancelled(() => {
          queue = queue.filter((e) => e !== entry);
          resolve({ kind: 'cancelled', stderrTail: '' });
        });
      });
    },
    killAll(): void {
      kills += 1;
      const all = queue;
      queue = [];
      for (const entry of all) entry.resolve({ kind: 'cancelled', stderrTail: '' });
    },
    async settle(outcome: ProcessOutcome): Promise<void> {
      const entry = queue.shift();
      if (!entry) throw new Error('fake process port: nothing is running');
      entry.resolve(outcome);
      await tick();
      await tick();
    },
    pending: () => queue.length,
    killAllCalls: () => kills,
  };
}
