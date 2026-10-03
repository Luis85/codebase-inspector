import { describe, expect, it, vi } from 'vitest';
import { awaitQuietMachine } from '../../scripts/native-load-gate.mjs';

const fakeClock = () => { let now = 0; return { now: () => now, sleep: async (ms: number) => { now += ms; } }; };

describe('native load gate (GRD4, GCP10)', () => {
  it('runs at once when the machine is quiet', async () => {
    const clock = fakeClock();
    const sample = vi.fn(async () => 20);
    const result = await awaitQuietMachine({ sample, threshold: 50, maxWaitMs: 900_000, pollMs: 30_000, ...clock });
    expect(result).toEqual({ ok: true, load: 20, waitedMs: 0 });
    expect(sample).toHaveBeenCalledTimes(1);
  });

  it('waits while loaded and runs once the load drops', async () => {
    const clock = fakeClock();
    const loads = [80, 75, 30];
    const result = await awaitQuietMachine({ sample: async () => loads.shift() ?? 30, threshold: 50, maxWaitMs: 900_000, pollMs: 30_000, ...clock });
    expect(result).toEqual({ ok: true, load: 30, waitedMs: 60_000 });
  });

  it('refuses after the maximum wait, naming the load', async () => {
    const clock = fakeClock();
    const result = await awaitQuietMachine({ sample: async () => 90, threshold: 50, maxWaitMs: 60_000, pollMs: 30_000, ...clock });
    expect(result.ok).toBe(false);
    expect(result.load).toBe(90);
  });
});
