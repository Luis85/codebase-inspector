// Part 7 Z13/Z15/Z18: how the application asks for a process, and what it gets back. The
// adapter (src/adapters/fallow/fallow-runner.ts) is generic: the application builds the
// argv (fallow-invocation.ts), so a test can run any executable through the same adapter.
import type { CancellationToken } from './cancellation-token';

export interface ProcessRequest {
  executablePath: string;
  args: readonly string[];
  /** Always the analysed root (Z15). */
  cwd: string;
  timeoutMs: number;
  maxStdoutBytes: number;
  maxStderrBytes: number;
}

/** Z18: every way a run can end. `run` never rejects. `stdout` is null when the bytes were
 *  not valid UTF-8. `stderrTail` is already cleaned for display (process-output.ts). */
export type ProcessOutcome =
  | { kind: 'exited'; exitCode: number; stdout: string | null; stdoutBytes: number; stderrTail: string }
  | { kind: 'signalled'; signal: string; stderrTail: string }
  | { kind: 'timed-out'; stderrTail: string }
  | { kind: 'cancelled'; stderrTail: string }
  | { kind: 'stdout-too-large'; stderrTail: string }
  | { kind: 'output-incomplete'; stderrTail: string }
  | { kind: 'spawn-failed'; errorCode: string };

export interface AnalyzerProcessPort {
  run(request: ProcessRequest, token: CancellationToken): Promise<ProcessOutcome>;
  /** Z24: kills every live child synchronously and resolves every pending run as cancelled. */
  killAll(): void;
}
