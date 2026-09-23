// Part 7 Z38: runs every request of the REAL runner as `node fake-fallow.mjs --mode=<m> …`,
// the mode chosen per request (the probe or the run). `hold`, when given, is awaited before
// a run is forwarded, so a test can change the world while fallow "runs".
import { fileURLToPath } from 'node:url';
import type { AnalyzerProcessPort, ProcessRequest } from '../../src/application/ports/analyzer-process';

const FAKE = fileURLToPath(new URL('./fallow-runner/fake-fallow.mjs', import.meta.url));

export function nodeWrapped(
  runner: AnalyzerProcessPort, modeFor: (args: readonly string[]) => string, hold?: () => Promise<void>,
): AnalyzerProcessPort & { requests: ProcessRequest[] } {
  const requests: ProcessRequest[] = [];
  return {
    requests,
    async run(request, token) {
      requests.push(request);
      if (hold !== undefined && request.args[0] !== '--version') await hold();
      return runner.run({ ...request, executablePath: process.execPath, args: [FAKE, `--mode=${modeFor(request.args)}`, ...request.args] }, token);
    },
    killAll() { runner.killAll(); },
  };
}
