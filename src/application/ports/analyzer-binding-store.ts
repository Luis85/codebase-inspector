// Part 7 Z3: the per-profile fallow executable binding and its trust. One durable adapter
// (src/adapters/storage/plugin-data-analyzer-store.ts); the write rules live in
// analyzer-record.ts so every implementation shares them. Every write rejects with
// AnalyzerStoreError ('unsupported' | 'not-bound' | 'changed') when refused, and then
// nothing was written.
import type { AnalyzerTrust } from '../analysis/analyzer-trust';
import type { AnalyzerBindingRead } from '../analysis/analyzer-record';

export type { AnalyzerBinding, AnalyzerBindingRead } from '../analysis/analyzer-record';

export interface AnalyzerBindingStore {
  read(profileId: string): Promise<AnalyzerBindingRead>;
  /** Replaces the path and drops trust; keeps a bound record's time limit, else 120 s. */
  bind(profileId: string, executablePath: string): Promise<void>;
  setTimeoutSeconds(profileId: string, seconds: number): Promise<void>;
  /** Refused with 'changed' when the stored path is no longer `expectedPath`. */
  grantTrust(profileId: string, trust: AnalyzerTrust, expectedPath: string): Promise<void>;
  revokeTrust(profileId: string): Promise<void>;
  forget(profileId: string): Promise<void>;
  /** Z11: profile removal. Deletes the entry whatever its format. */
  purge(profileId: string): Promise<void>;
}
