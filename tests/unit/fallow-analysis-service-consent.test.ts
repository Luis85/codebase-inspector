// Polish B1, B2, B7: the consent gate case by case — busy races, refused trust writes, and
// every refusal starting nothing.
import { describe, expect, it } from 'vitest';
import { setTimeout as delay } from 'node:timers/promises';
import { AnalyzerStoreError } from '../../src/application/analysis/analyzer-record';
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import type { AnalyzerBindingStore } from '../../src/application/ports/analyzer-binding-store';
import { createInMemoryAnalyzerStore } from '../fixtures/in-memory-analyzer-store';
import { factsFor } from '../fixtures/fake-executable-inspector';
import { exitedWith } from '../fixtures/fake-process-port';
import { emptyEvidenceReport } from '../fixtures/evidence-report';
import { EXE, ROOT, SNAPSHOT, createServiceWorld, reviewed, subjectOf, trusted } from '../fixtures/fallow-service-world';

const OLD_EXE = '/opt/old/fallow';
const refusing = (inner: AnalyzerBindingStore, member: 'grantTrust' | 'revokeTrust', error: Error): AnalyzerBindingStore =>
  ({ ...inner, [member]: () => Promise.reject(error) });

describe('Polish B1: the busy re-check before the bind', () => {
  it('B1: a run that starts while Trust and run awaits its checks is not bound over', async () => {
    const s = createServiceWorld();
    await s.store.bind('p1', OLD_EXE);
    const review = await reviewed(s);
    const inspect = s.inspector.answer;
    s.inspector.answer = (path) => {
      s.coordinator.start({ subject: subjectOf(factsFor(OLD_EXE)), snapshotId: SNAPSHOT.snapshotId, timeoutSeconds: 120, onProbePassed: () => Promise.resolve('continue') });
      return inspect(path);
    };
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toEqual({ kind: 'busy' });
    expect(await s.store.read('p1')).toMatchObject({ kind: 'bound', binding: { executablePath: OLD_EXE } });
  });
});

describe('Polish B2: a refused trust write is not an operational failure', () => {
  it('B2: a grant refused as unsupported ends store-unsupported; evidence is not marked stale', async () => {
    const s = createServiceWorld(refusing(createInMemoryAnalyzerStore('m'), 'grantTrust', new AnalyzerStoreError('unsupported')));
    s.evidence.put('p1', emptyEvidenceReport(SNAPSHOT.snapshotId));
    expect(await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s))).toEqual({ kind: 'started' });
    await s.process.settle(exitedWith(0, 'fallow 3.27.0'));
    expect(s.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'store-unsupported', evidenceKept: false });
    expect(s.evidence.get('p1')?.staleReason).toBeUndefined();
  });

  it('B2: a revoke refused after a version change ends changed-since-review (not-bound) or store-unsupported, never stale', async () => {
    for (const [code, expected] of [['not-bound', 'changed-since-review'], ['unsupported', 'store-unsupported']] as const) {
      const s = createServiceWorld(refusing(createInMemoryAnalyzerStore('m'), 'revokeTrust', new AnalyzerStoreError(code)));
      await trusted(s);
      s.evidence.put('p1', emptyEvidenceReport(SNAPSHOT.snapshotId));
      await s.service.run('p1', SNAPSHOT);
      await s.process.settle(exitedWith(0, 'fallow 3.28.0'));
      expect(s.service.stateOf('p1'), code).toMatchObject({ status: 'failed', code: expected, evidenceKept: false });
      expect(s.evidence.get('p1')?.staleReason, code).toBeUndefined();
    }
  });

  it('B2: any other error from a trust write still ends the run as the internal failure', async () => {
    const s = createServiceWorld(refusing(createInMemoryAnalyzerStore('m'), 'revokeTrust', new Error('disk full')));
    await trusted(s);
    await s.service.run('p1', SNAPSHOT);
    await s.process.settle(exitedWith(0, 'fallow 3.28.0'));
    expect(s.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'spawn-failed', detail: 'internal' });
  });
});

describe('Polish B7: the consent gate at the service', () => {
  it('another device\'s record, or an invalid one, asks for an executable and runs nothing', async () => {
    const other = { v: 1, provider: 'fallow', machineId: 'other', executablePath: EXE, timeoutSeconds: 120, trust: null };
    for (const [record, kind] of [[other, 'other-machine'], [{ v: 1, provider: 'fallow' }, 'invalid']] as const) {
      const s = createServiceWorld(createInMemoryAnalyzerStore('m', { p1: record }));
      expect(await s.service.run('p1', SNAPSHOT), kind).toEqual({ kind: 'choose-executable', read: { kind } });
      expect(s.process.requests, kind).toEqual([]);
    }
  });

  it('Trust and run against a newer-format record is refused as store-unsupported and runs nothing', async () => {
    const s = createServiceWorld(createInMemoryAnalyzerStore('m', { p1: { v: 2 } }));
    expect(await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s))).toEqual({ kind: 'refused', code: 'store-unsupported', detail: '' });
    expect(s.process.requests).toEqual([]);
  });

  it('no refusal starts a process: a relative path, a missing root, an older snapshot, a vanished or changed file', async () => {
    const s = createServiceWorld();
    const review = await reviewed(s);
    expect(await s.service.review('p1', SNAPSHOT, 'fallow')).toMatchObject({ ok: false });
    s.inspector.answer = () => ({ ok: false, refusal: 'executable-missing', detail: '' });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toMatchObject({ kind: 'refused', code: 'executable-missing' });
    s.inspector.answer = (p) => ({ ok: true, facts: factsFor(p, { size: 1 }) });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toMatchObject({ kind: 'refused', code: 'changed-since-review' });
    s.root.exists = false;
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toMatchObject({ kind: 'refused', code: 'root-unavailable' });
    s.root.exists = true;
    s.snapshots.put({ ...SNAPSHOT, snapshotId: 'snapshot-newer' });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toMatchObject({ kind: 'refused', code: 'snapshot-changed' });
    expect(s.process.requests).toEqual([]);
  });

  it('busy keeps the stored trust exactly as it was', async () => {
    const s = createServiceWorld();
    await trusted(s);
    const before = await s.store.read('p1');
    await s.service.run('p1', SNAPSHOT);
    expect(await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s))).toEqual({ kind: 'busy' });
    expect(await s.store.read('p1')).toEqual(before);
  });

  it('a first Trust and run uses the 120 s default: the analysis asks for 120,000 ms', async () => {
    const s = createServiceWorld();
    await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s));
    await s.process.settle(exitedWith(0, 'fallow 3.27.0'));
    expect(s.process.requests.map((r) => r.args)).toEqual([['--version'], FALLOW_RUN_ARGS(ROOT)]);
    expect(s.process.requests[1]?.timeoutMs).toBe(120_000);
  });

  it('setTimeLimit accepts 10 and 1800 and refuses 9, 1801 and 10.5 without writing', async () => {
    const s = createServiceWorld();
    await s.store.bind('p1', EXE);
    expect(await s.service.setTimeLimit('p1', 10)).toBe('saved');
    expect(await s.service.setTimeLimit('p1', 1800)).toBe('saved');
    for (const bad of [9, 1801, 10.5]) expect(await s.service.setTimeLimit('p1', bad), String(bad)).toBe('invalid');
    expect(await s.store.read('p1')).toMatchObject({ binding: { timeoutSeconds: 1800 } });
    await delay(0);
  });
});
