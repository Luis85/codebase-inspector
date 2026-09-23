// Part 7 Z3: the suite every AnalyzerBindingStore must pass, run against the durable
// plugin-data adapter and the in-memory test double (the review-repository.contract.ts
// pattern), so they cannot drift. `slice()` returns data.json's `analyzers` value.
import { describe, expect, it } from 'vitest';
import { AnalyzerStoreError } from '../../src/application/analysis/analyzer-record';
import type { AnalyzerBindingStore } from '../../src/application/ports/analyzer-binding-store';

export interface AnalyzerStoreHarness {
  store: AnalyzerBindingStore;
  slice: () => Promise<unknown>;
}
export const CONTRACT_MACHINE = 'machine-contract';
const EXE = 'C:\\Tools\\fallow\\fallow.exe';
const TRUST = { fingerprint: '0a1b2c3d', version: '3.27.0', grantedAt: '2026-09-23T10:00:00.000Z' };

async function codeOf(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { return e instanceof AnalyzerStoreError ? e.code : 'other'; }
  return 'none';
}

export function runAnalyzerBindingStoreContract(label: string, make: (initial?: unknown) => Promise<AnalyzerStoreHarness>): void {
  describe(`${label}: AnalyzerBindingStore contract (Z3)`, () => {
    it('reads none, then the bound record after bind, with no trust and the default limit', async () => {
      const { store } = await make();
      expect(await store.read('p1')).toEqual({ kind: 'none' });
      await store.bind('p1', EXE);
      expect(await store.read('p1')).toEqual({ kind: 'bound', binding: { profileId: 'p1', executablePath: EXE, timeoutSeconds: 120, trust: null } });
    });

    it('grants, revokes and changes the time limit on the bound record only', async () => {
      const { store } = await make();
      await store.bind('p1', EXE);
      await store.grantTrust('p1', TRUST, EXE);
      await store.setTimeoutSeconds('p1', 600);
      expect(await store.read('p1')).toEqual({ kind: 'bound', binding: { profileId: 'p1', executablePath: EXE, timeoutSeconds: 600, trust: TRUST } });
      await store.revokeTrust('p1');
      expect(await store.read('p1')).toMatchObject({ kind: 'bound', binding: { trust: null, timeoutSeconds: 600 } });
      expect(await codeOf(store.revokeTrust('p2'))).toBe('not-bound');
      expect(await codeOf(store.setTimeoutSeconds('p2', 60))).toBe('not-bound');
    });

    it('refuses trust for a path that is no longer the bound one', async () => {
      const { store } = await make();
      await store.bind('p1', EXE);
      await store.bind('p1', 'D:\\fallow.exe');
      expect(await codeOf(store.grantTrust('p1', TRUST, EXE))).toBe('changed');
      expect(await store.read('p1')).toMatchObject({ kind: 'bound', binding: { trust: null } });
    });

    it('re-binding drops trust but keeps the time limit', async () => {
      const { store } = await make();
      await store.bind('p1', EXE);
      await store.setTimeoutSeconds('p1', 300);
      await store.grantTrust('p1', TRUST, EXE);
      await store.bind('p1', EXE);
      expect(await store.read('p1')).toMatchObject({ kind: 'bound', binding: { trust: null, timeoutSeconds: 300 } });
    });

    it('forget and purge remove only their own profile', async () => {
      const { store, slice } = await make();
      await store.bind('p1', EXE);
      await store.bind('p2', EXE);
      await store.forget('p1');
      expect(await store.read('p1')).toEqual({ kind: 'none' });
      await store.purge('p2');
      expect(await slice()).toEqual({});
    });

    it('reads another device\'s record as other-machine, never uses it, and replaces it only on bind', async () => {
      const foreign = { v: 1, provider: 'fallow', machineId: 'machine-other', executablePath: EXE, timeoutSeconds: 120, trust: TRUST };
      const { store } = await make({ p1: foreign });
      expect(await store.read('p1')).toEqual({ kind: 'other-machine' });
      expect(await codeOf(store.grantTrust('p1', TRUST, EXE))).toBe('not-bound');
      await store.bind('p1', EXE);
      expect(await store.read('p1')).toMatchObject({ kind: 'bound', binding: { trust: null } });
    });

    it('keeps a newer-format record read-only: every write but purge is refused and it stays as it was', async () => {
      const newer = { v: 2, provider: 'fallow', executable: { path: EXE } };
      const { store, slice } = await make({ p1: newer, p2: newer });
      expect(await store.read('p1')).toEqual({ kind: 'unsupported' });
      expect(await codeOf(store.bind('p1', EXE))).toBe('unsupported');
      expect(await codeOf(store.forget('p1'))).toBe('unsupported');
      expect(await codeOf(store.setTimeoutSeconds('p1', 60))).toBe('unsupported');
      expect(await slice()).toEqual({ p1: newer, p2: newer });
      await store.purge('p1');
      expect(await slice()).toEqual({ p2: newer });
    });
  });
}
