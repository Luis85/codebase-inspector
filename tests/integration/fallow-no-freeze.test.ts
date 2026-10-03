// Task 6 (Z38, O2, PP10): moved verbatim from fallow-analysis.test.ts, this describe
// now runs alone in the 'node-serial' vitest project (vitest.config.ts), scheduled
// after every other project so the 50 ms event-loop budget is measured on an
// otherwise idle worker pool. See fallow-analysis-world.ts for the shared setup
// (world(), the tracked spawn, the afterEach cleanup) this case depends on.
// Task 3 (Z38, O1, FN2): a 2 s bare control now runs first; if its own largest gap
// is already >= LOADED_CONTROL_MS the case skips instead of asserting against a
// machine that is too loaded to measure the 50 ms budget honestly.
// GCO22 (GRD2): each mode runs 3x and the smallest of its largest gaps is asserted; a 2 s
// post-control then skips a run the machine loaded mid-way. A stall the code causes repeats
// on the same input; foreign load spikes don't, so repetition separates code from load.
import { clearInterval as stopSampling, setInterval as sampleEvery } from 'node:timers';
import { setTimeout as sleep } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { createFallowRunner } from '../../src/adapters/fallow/fallow-runner';
import { FALLOW_RUN_ARGS, FALLOW_STDERR_TAIL_BYTES, FALLOW_STDOUT_MAX_BYTES, classifyFallowExit } from '../../src/application/analysis/fallow-invocation';
import { createCancellationToken } from '../../src/application/scan-coordinator';
import { realKill } from '../fixtures/real-spawn';
import { FAKE, trackedSpawn, world } from './fallow-analysis-world';

// O1 (decision), spec §3.3: a bare 2 s control (no child, no sampled work beyond the
// sampler itself) peaked at 25.6 ms across idle and real-load pre-run measurements,
// and at 38.4-50.9 ms once every core was burned by another process. 35 sits between
// the two bands: at or above it, the 50 ms budget below cannot be trusted to reflect
// the runner rather than a loaded host machine.
const LOADED_CONTROL_MS = 35;

function startGapSampler(): { stop: () => number } {
  let last = performance.now();
  let worst = 0;
  const sampler = sampleEvery(() => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; }, 10);
  return { stop: () => { stopSampling(sampler); return worst; } };
}

describe('no freeze (acceptance 3)', () => {
  it('the event loop never stalls for 50 ms while a child hangs or streams 12 MB; the final parse is only measured', async (ctx) => {
    const controlSampler = startGapSampler();
    await sleep(2_000);
    const controlWorst = controlSampler.stop();
    process.stdout.write(`[no-freeze] control: largest event-loop gap ${controlWorst.toFixed(1)} ms\n`);
    if (controlWorst >= LOADED_CONTROL_MS) {
      ctx.skip(`machine loaded: the bare control's largest gap was ${controlWorst.toFixed(1)} ms (>= ${LOADED_CONTROL_MS} ms), so the 50 ms budget cannot be measured`);
    }

    const w = await world();
    const runner = createFallowRunner({ spawn: trackedSpawn, env: process.env, platform: process.platform, killProcess: realKill });
    const request = (mode: string, timeoutMs: number) => ({
      executablePath: process.execPath, args: [FAKE, `--mode=${mode}`, ...FALLOW_RUN_ARGS(w.root)], cwd: w.root,
      timeoutMs, maxStdoutBytes: FALLOW_STDOUT_MAX_BYTES, maxStderrBytes: FALLOW_STDERR_TAIL_BYTES,
    });
    const results: Array<{ mode: string; worsts: number[] }> = [];
    for (const [mode, timeoutMs, expected] of [['hang', 2_000, 'timed-out'], ['streamed', 30_000, 'exited']] as const) {
      const worsts: number[] = [];
      for (let i = 1; i <= 3; i += 1) {
        const sampler = startGapSampler();
        const outcome = await runner.run(request(mode, timeoutMs), createCancellationToken().token);
        const worst = sampler.stop();
        expect(outcome.kind, `${mode} #${i}`).toBe(expected);
        const parseStarted = performance.now();
        const classified = classifyFallowExit(outcome, 120);
        process.stdout.write(`[no-freeze] ${mode} #${i}: largest event-loop gap ${worst.toFixed(1)} ms; final parse ${(performance.now() - parseStarted).toFixed(1)} ms (${classified.kind})\n`);
        worsts.push(worst);
      }
      results.push({ mode, worsts });
    }

    const postSampler = startGapSampler();
    await sleep(2_000);
    const postWorst = postSampler.stop();
    process.stdout.write(`[no-freeze] post-control: largest event-loop gap ${postWorst.toFixed(1)} ms\n`);
    if (postWorst >= LOADED_CONTROL_MS) {
      ctx.skip(`machine loaded mid-run: control ${controlWorst.toFixed(1)} ms, post-control ${postWorst.toFixed(1)} ms (>= ${LOADED_CONTROL_MS} ms), so the 50 ms budget cannot be measured`);
    }
    for (const { mode, worsts } of results) {
      expect(Math.min(...worsts), `${mode}: smallest of three largest event-loop gaps`).toBeLessThan(50);
    }
  }, 90_000);
});
