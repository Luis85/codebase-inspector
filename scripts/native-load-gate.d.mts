// Declaration for scripts/native-load-gate.mjs, imported as a module by tests/unit/native-load-gate.test.ts
// (the same arrangement as scripts/harness-shot.d.mts).
export interface QuietMachineOptions {
  sample: () => Promise<number>;
  threshold: number;
  maxWaitMs: number;
  pollMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface QuietMachineResult {
  ok: boolean;
  load: number;
  waitedMs: number;
}

export declare function sampleCpuPercent(windowMs?: number): Promise<number>;
export declare function awaitQuietMachine(options: QuietMachineOptions): Promise<QuietMachineResult>;
