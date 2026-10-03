import { cpus } from 'node:os';
import { setTimeout as wait } from 'node:timers/promises';

const ticks = () => cpus().reduce((sum, cpu) => {
  const t = cpu.times;
  return { idle: sum.idle + t.idle, total: sum.total + t.user + t.nice + t.sys + t.idle + t.irq };
}, { idle: 0, total: 0 });

/** GRD4 (GCP10): the machine's total CPU use over `windowMs`, from os.cpus() tick deltas. */
export async function sampleCpuPercent(windowMs = 10_000) {
  const before = ticks();
  await wait(windowMs);
  const after = ticks();
  const total = after.total - before.total;
  return total <= 0 ? 0 : Math.round(100 * (1 - (after.idle - before.idle) / total));
}

/** Waits for a quiet machine, up to maxWaitMs; never reports a pass for a run that did not happen. */
export async function awaitQuietMachine({ sample, threshold, maxWaitMs, pollMs, now = Date.now, sleep = (ms) => wait(ms) }) {
  const started = now();
  for (;;) {
    const load = await sample();
    const waitedMs = now() - started;
    if (load < threshold) return { ok: true, load, waitedMs };
    if (waitedMs + pollMs > maxWaitMs) return { ok: false, load, waitedMs };
    await sleep(pollMs);
  }
}
