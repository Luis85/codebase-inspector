// Part 7 Z7/Z8/Z10/Z11/Z22/Z36 and G6's "explicit trust before any probe": the service
// reviews by inspecting only, runs nothing without trust, probes before it stores trust,
// remembers trust until what it covers changes, and refuses stale or busy starts.
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { AnalysisCoordinator } from '../../src/application/analysis/analysis-coordinator';
import { createFallowAnalysisService } from '../../src/application/analysis/fallow-analysis-service';
import { FALLOW_ENV_ALLOW_LIST, FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import { fingerprintTrust, type TrustSubject } from '../../src/application/analysis/analyzer-trust';
import { createCancellationToken } from '../../src/application/scan-coordinator';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFixedClock } from '../fixtures/clock';
import { createFakeProcessPort, exitedWith } from '../fixtures/fake-process-port';
import { createFakeExecutableInspector, factsFor } from '../fixtures/fake-executable-inspector';
import { createInMemoryAnalyzerStore } from '../fixtures/in-memory-analyzer-store';
import { snapshotWithPaths } from '../fixtures/evidence-report';
import { FIXTURE_PROJECT_FILES } from '../fixtures/fallow-expected';

const SNAPSHOT = snapshotWithPaths(FIXTURE_PROJECT_FILES, 'p1');
const ROOT = SNAPSHOT.scope.rootPath;
const EXE = '/opt/fallow/bin/fallow';
const subjectOf = (facts = factsFor(EXE)): TrustSubject => ({ profileId: 'p1', machineId: 'm', rootPath: ROOT, args: FALLOW_RUN_ARGS(ROOT), facts });
/** A SourceFileSystemPort whose `stat` answers for the root; the other members are unused here. */
const dirPort = (exists: () => boolean): SourceFileSystemPort => ({
  stat: () => Promise.resolve({ exists: exists(), isDirectory: exists(), isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 }),
}) as unknown as SourceFileSystemPort;

function setup() {
  const process = createFakeProcessPort();
  const evidence = new InMemoryEvidenceStore();
  const clock = createFixedClock('2026-09-23T10:00:00.000Z');
  const snapshots = new InMemorySnapshotStore(clock);
  snapshots.put(SNAPSHOT);
  const coordinator = new AnalysisCoordinator({ process, evidence, snapshots, clock, createCancellationToken });
  const store = createInMemoryAnalyzerStore('m');
  const inspector = createFakeExecutableInspector('fallow');
  const root = { exists: true };
  const service = createFallowAnalysisService({
    store, inspector, coordinator, snapshots, getFilesystem: () => dirPort(() => root.exists), machineId: 'm', clock,
  });
  return { process, evidence, snapshots, coordinator, store, inspector, root, service };
}
async function trusted(s: ReturnType<typeof setup>, version = '3.27.0'): Promise<void> {
  await s.store.bind('p1', EXE);
  await s.store.grantTrust('p1', { fingerprint: fingerprintTrust(subjectOf(), version), version, grantedAt: '2026-09-23T09:00:00.000Z' }, EXE);
}
async function reviewed(s: ReturnType<typeof setup>) {
  const result = await s.service.review('p1', SNAPSHOT, EXE);
  if (!result.ok) throw new Error(`test setup: review refused (${result.code})`);
  return result.review;
}

describe('reading and reviewing never execute (Z22, Z36)', () => {
  it('readBinding adds the platform\'s executable name', async () => {
    const s = setup();
    expect(await s.service.readBinding('p1')).toEqual({ kind: 'none', executableName: 'fallow' });
  });

  it('review inspects the trimmed, normalised path and shows exactly what would run; nothing runs or is stored', async () => {
    const s = setup();
    const result = await s.service.review('p1', SNAPSHOT, `  ${EXE}  `);
    expect(result).toEqual({
      ok: true,
      review: {
        profileId: 'p1', snapshotId: SNAPSHOT.snapshotId, rootPath: ROOT, facts: factsFor(EXE), args: FALLOW_RUN_ARGS(ROOT),
        versionArgs: ['--version'], envNames: FALLOW_ENV_ALLOW_LIST, timeoutSeconds: 120, trustedVersion: null,
        subjectFingerprint: fingerprintTrust(subjectOf(), ''),
      },
    });
    expect(s.inspector.calls).toEqual([{ executablePath: EXE, rootPath: ROOT }]);
    expect(s.process.requests).toEqual([]);
    expect(await s.store.read('p1')).toEqual({ kind: 'none' });
  });

  it('refuses a relative path without inspecting it, and maps the inspector\'s refusals', async () => {
    const s = setup();
    expect(await s.service.review('p1', SNAPSHOT, 'fallow')).toEqual({ ok: false, code: 'executable-refused', detail: 'not-absolute' });
    expect(s.inspector.calls).toEqual([]);
    s.inspector.answer = () => ({ ok: false, refusal: 'launcher', detail: 'fallow' });
    expect(await s.service.review('p1', SNAPSHOT, EXE)).toEqual({ ok: false, code: 'executable-refused', detail: 'launcher:fallow' });
    s.inspector.answer = () => ({ ok: false, refusal: 'not-native', detail: '' });
    expect(await s.service.review('p1', SNAPSHOT, EXE)).toEqual({ ok: false, code: 'executable-refused', detail: 'not-native' });
    s.inspector.answer = () => ({ ok: false, refusal: 'executable-missing', detail: '' });
    expect(await s.service.review('p1', SNAPSHOT, EXE)).toEqual({ ok: false, code: 'executable-missing', detail: '' });
  });

  it('refuses a root that is no longer a directory', async () => {
    const s = setup();
    s.root.exists = false;
    expect(await s.service.review('p1', SNAPSHOT, EXE)).toEqual({ ok: false, code: 'root-unavailable', detail: '' });
  });
});

describe('explicit trust before any probe (G6, Z7, Z8)', () => {
  it('run with no binding asks for an executable and runs nothing', async () => {
    const s = setup();
    expect(await s.service.run('p1', SNAPSHOT)).toEqual({ kind: 'choose-executable', read: { kind: 'none' } });
    expect(s.process.requests).toEqual([]);
  });

  it('run on an untrusted binding returns the review and runs nothing', async () => {
    const s = setup();
    await s.store.bind('p1', EXE);
    const outcome = await s.service.run('p1', SNAPSHOT);
    expect(outcome).toMatchObject({ kind: 'review', reason: 'untrusted', review: { facts: factsFor(EXE), trustedVersion: null } });
    expect(s.process.requests).toEqual([]);
  });

  it('Trust and run binds, probes --version first, stores trust only after the probe passed, then runs', async () => {
    const s = setup();
    const review = await reviewed(s);
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toEqual({ kind: 'started' });
    expect(s.process.requests.map((r) => r.args)).toEqual([['--version']]);
    expect(await s.store.read('p1')).toMatchObject({ kind: 'bound', binding: { executablePath: EXE, trust: null } });
    await s.process.settle(exitedWith(0, 'fallow 3.27.0'));
    expect(await s.store.read('p1')).toMatchObject({
      kind: 'bound', binding: { trust: { fingerprint: fingerprintTrust(subjectOf(), '3.27.0'), version: '3.27.0', grantedAt: '2026-09-23T10:00:00.000Z' } },
    });
    expect(s.process.requests.map((r) => r.args)).toEqual([['--version'], FALLOW_RUN_ARGS(ROOT)]);
  });

  it('a probe that fails stores no trust', async () => {
    const s = setup();
    await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s));
    await s.process.settle(exitedWith(0, 'fallow 4.0.0'));
    expect(s.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'version-unsupported' });
    expect(await s.store.read('p1')).toMatchObject({ kind: 'bound', binding: { trust: null } });
  });
});

describe('remembered trust (Z7)', () => {
  it('starts directly when nothing changed', async () => {
    const s = setup();
    await trusted(s);
    expect(await s.service.checkTrust('p1', SNAPSHOT)).toEqual({ kind: 'trusted' });
    expect(await s.service.run('p1', SNAPSHOT)).toEqual({ kind: 'started' });
    expect(s.process.requests.map((r) => r.args)).toEqual([['--version']]);
  });

  it('a changed binary reopens the review before anything runs', async () => {
    const s = setup();
    await trusted(s);
    s.inspector.answer = (p) => ({ ok: true, facts: factsFor(p, { size: 1 }) });
    expect(await s.service.run('p1', SNAPSHOT)).toMatchObject({ kind: 'review', reason: 'changed', review: { trustedVersion: '3.27.0' } });
    expect(s.process.requests).toEqual([]);
  });

  it('a different probed version revokes trust and ends the run as version-changed', async () => {
    const s = setup();
    await trusted(s);
    await s.service.run('p1', SNAPSHOT);
    await s.process.settle(exitedWith(0, 'fallow 3.28.0'));
    expect(s.service.stateOf('p1')).toMatchObject({ status: 'failed', code: 'version-changed', detail: '3.28.0' });
    expect(await s.store.read('p1')).toMatchObject({ kind: 'bound', binding: { trust: null } });
    expect(s.process.requests).toHaveLength(1);
  });

  it('keeps a bound time limit for the run', async () => {
    const s = setup();
    await trusted(s);
    await s.store.setTimeoutSeconds('p1', 600);
    await s.service.run('p1', SNAPSHOT);
    await s.process.settle(exitedWith(0, 'fallow 3.27.0'));
    expect(s.process.requests[1]?.timeoutMs).toBe(600_000);
  });
});

describe('refusals before a start (Z22)', () => {
  it('Review Focus 4: Trust and run after the file vanished binds nothing and runs nothing', async () => {
    const s = setup();
    const review = await reviewed(s);
    s.inspector.answer = () => ({ ok: false, refusal: 'executable-missing', detail: '' });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toEqual({ kind: 'refused', code: 'executable-missing', detail: '' });
    expect(await s.store.read('p1')).toEqual({ kind: 'none' });
    expect(s.process.requests).toEqual([]);
  });

  it('a file that changed between the review and Trust and run is refused as changed-since-review', async () => {
    const s = setup();
    const review = await reviewed(s);
    s.inspector.answer = (p) => ({ ok: true, facts: factsFor(p, { mtimeMs: 1_758_600_009_000 }) });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toEqual({ kind: 'refused', code: 'changed-since-review', detail: '' });
    expect(await s.store.read('p1')).toEqual({ kind: 'none' });
  });

  it('a leaf showing an older snapshot is refused as snapshot-changed', async () => {
    const s = setup();
    await trusted(s);
    s.snapshots.put({ ...SNAPSHOT, snapshotId: 'snapshot-newer' });
    expect(await s.service.run('p1', SNAPSHOT)).toEqual({ kind: 'refused', code: 'snapshot-changed', detail: '' });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s))).toEqual({ kind: 'refused', code: 'snapshot-changed', detail: '' });
  });

  it('a missing root is refused as root-unavailable; a newer-format record as store-unsupported', async () => {
    const s = setup();
    await trusted(s);
    s.root.exists = false;
    expect(await s.service.run('p1', SNAPSHOT)).toEqual({ kind: 'refused', code: 'root-unavailable', detail: '' });
    const newer = createInMemoryAnalyzerStore('m', { p1: { v: 2 } });
    const t = setup();
    const service = createFallowAnalysisService({
      store: newer, inspector: t.inspector, coordinator: t.coordinator, snapshots: t.snapshots, getFilesystem: () => dirPort(() => true), machineId: 'm', clock: createFixedClock(),
    });
    expect(await service.run('p1', SNAPSHOT)).toEqual({ kind: 'refused', code: 'store-unsupported', detail: '' });
    expect(await service.checkTrust('p1', SNAPSHOT)).toEqual({ kind: 'refused', code: 'store-unsupported', detail: '' });
  });

  it('is busy while a run is active: run, Trust and run and Forget refuse, nothing changes', async () => {
    const s = setup();
    await trusted(s);
    const review = await reviewed(s);
    await s.service.run('p1', SNAPSHOT);
    expect(await s.service.run('p1', SNAPSHOT)).toEqual({ kind: 'busy' });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toEqual({ kind: 'busy' });
    expect(await s.service.forget('p1')).toBe('busy');
    expect(await s.store.read('p1')).toMatchObject({ kind: 'bound' });
  });
});

describe('settings actions (Z10, Z11)', () => {
  it('setTimeLimit writes whole seconds from 10 to 1800 and refuses the rest without writing', async () => {
    const s = setup();
    await s.store.bind('p1', EXE);
    expect(await s.service.setTimeLimit('p1', 300)).toBe('saved');
    expect(await s.service.setTimeLimit('p1', 5)).toBe('invalid');
    expect(await s.service.setTimeLimit('p1', Number.NaN)).toBe('invalid');
    expect(await s.store.read('p1')).toMatchObject({ kind: 'bound', binding: { timeoutSeconds: 300 } });
  });

  it('forget deletes the record when idle', async () => {
    const s = setup();
    await s.store.bind('p1', EXE);
    expect(await s.service.forget('p1')).toBe('forgotten');
    expect(await s.store.read('p1')).toEqual({ kind: 'none' });
  });

  it('purgeProfile cancels the active run and deletes the record whatever its format', async () => {
    const s = setup();
    await trusted(s);
    await s.service.run('p1', SNAPSHOT);
    await s.service.purgeProfile('p1');
    await delay(0);
    expect(s.service.stateOf('p1').status).toBe('cancelled');
    expect(await s.store.read('p1')).toEqual({ kind: 'none' });
  });
});
