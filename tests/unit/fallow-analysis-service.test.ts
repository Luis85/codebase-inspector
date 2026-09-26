// Part 7 Z7/Z8/Z10/Z11/Z22/Z36 and G6's "explicit trust before any probe": the service
// reviews by inspecting only, runs nothing without trust, probes before it stores trust,
// remembers trust until what it covers changes, and refuses stale or busy starts.
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { createFallowAnalysisService } from '../../src/application/analysis/fallow-analysis-service';
import { FALLOW_ENV_ALLOW_LIST, FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import { fingerprintTrust } from '../../src/application/analysis/analyzer-trust';
import { createFixedClock } from '../fixtures/clock';
import { exitedWith } from '../fixtures/fake-process-port';
import { factsFor } from '../fixtures/fake-executable-inspector';
import { createInMemoryAnalyzerStore } from '../fixtures/in-memory-analyzer-store';
import {
  EXE, ROOT, SNAPSHOT, createServiceWorld, dirPort, reviewed, subjectOf, trusted, type ServiceWorld,
} from '../fixtures/fallow-service-world';

const setup = (): ServiceWorld => createServiceWorld();

describe('every binding write is announced (final review)', () => {
  it('bind, trust, a time limit, a Forget and a purge each notify with the profile id; a refused write does not', async () => {
    const s = setup();
    const changed: string[] = [];
    const off = s.service.onBindingChanged((id) => { changed.push(id); });
    expect(await s.service.trustAndRun('p1', SNAPSHOT, await reviewed(s))).toEqual({ kind: 'started' });
    expect(changed).toEqual(['p1']);
    await s.process.settle(exitedWith(0, 'fallow 3.27.0\n'));
    expect(changed).toEqual(['p1', 'p1']);
    s.service.cancel('p1');
    await delay(0);
    changed.length = 0;
    expect(await s.service.setTimeLimit('p1', 5)).toBe('invalid');
    expect(await s.service.setTimeLimit('p1', 300)).toBe('saved');
    expect(await s.service.forget('p1')).toBe('forgotten');
    await s.service.purgeProfile('p2');
    expect(changed).toEqual(['p1', 'p1', 'p2']);
    off();
    await trusted(s);
    await s.service.forget('p1');
    expect(changed).toEqual(['p1', 'p1', 'p2']);
  });
});

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
