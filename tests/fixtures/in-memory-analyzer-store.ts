// Part 7 Z3: the in-memory AnalyzerBindingStore, for the service, component and harness
// tests. It applies the SAME pure rules as the durable adapter (applyAnalyzerWrite), and
// passes the same contract (tests/contracts/analyzer-binding-store.contract.ts).
import { applyAnalyzerWrite, decodeAnalyzerRecord, type AnalyzerWrite } from '../../src/application/analysis/analyzer-record';
import type { AnalyzerBindingStore } from '../../src/application/ports/analyzer-binding-store';

export function createInMemoryAnalyzerStore(machineId = 'machine-test', initial?: unknown): AnalyzerBindingStore & { slice(): unknown } {
  let slice: unknown = initial === undefined ? undefined : JSON.parse(JSON.stringify(initial));
  const write = (profileId: string, change: AnalyzerWrite): Promise<void> => {
    try {
      slice = applyAnalyzerWrite(slice, profileId, machineId, change);
      return Promise.resolve();
    } catch (e) {
      return Promise.reject(e instanceof Error ? e : new Error(String(e)));
    }
  };
  return {
    read: (profileId) => Promise.resolve(decodeAnalyzerRecord(slice, profileId, machineId)),
    bind: (profileId, executablePath) => write(profileId, { op: 'bind', executablePath }),
    setTimeoutSeconds: (profileId, seconds) => write(profileId, { op: 'timeout', seconds }),
    grantTrust: (profileId, trust, expectedPath) => write(profileId, { op: 'grant', trust, expectedPath }),
    revokeTrust: (profileId) => write(profileId, { op: 'revoke' }),
    forget: (profileId) => write(profileId, { op: 'forget' }),
    purge: (profileId) => write(profileId, { op: 'purge' }),
    slice: () => slice,
  };
}
