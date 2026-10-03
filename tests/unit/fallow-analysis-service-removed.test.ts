// Polish final review: a codebase removed in Settings stays removed for the fallow service. A
// leaf left open on it cannot bind, run, write or bring findings back: every entry point that
// could lead there answers `profile-removed`, and nothing is stored or started.
import { describe, expect, it } from 'vitest';
import { createInMemoryAnalyzerStore } from '../fixtures/in-memory-analyzer-store';
import { EXE, SNAPSHOT, createServiceWorld, reviewed, trusted } from '../fixtures/fallow-service-world';

const REMOVED = { kind: 'refused', code: 'profile-removed', detail: '' };

describe('final review: a removed profile is never bound, run or written again', () => {
  it('after purgeProfile, run is refused as profile-removed (not choose-executable) and nothing starts', async () => {
    const s = createServiceWorld();
    await s.service.purgeProfile('p1');
    expect(await s.service.run('p1', SNAPSHOT)).toEqual(REMOVED);
    expect(s.process.requests).toEqual([]);
  });

  it('after purgeProfile, Trust and run is refused: nothing is bound, nothing starts, no evidence comes back', async () => {
    const inner = createInMemoryAnalyzerStore('m');
    const binds: string[] = [];
    const s = createServiceWorld({ ...inner, bind: (id, path) => { binds.push(path); return inner.bind(id, path); } });
    const review = await reviewed(s);
    await s.service.purgeProfile('p1');
    expect(await s.service.trustAndRun('p1', SNAPSHOT, review)).toEqual(REMOVED);
    expect(binds).toEqual([]);
    expect(await s.store.read('p1')).toEqual({ kind: 'none' });
    expect(s.process.requests).toEqual([]);
    expect(s.evidence.get('p1')).toBeNull();
  });

  it('a removed profile offers no Choose: checkTrust and a path check answer profile-removed', async () => {
    const s = createServiceWorld();
    await s.service.purgeProfile('p1');
    expect(await s.service.checkTrust('p1', SNAPSHOT)).toEqual(REMOVED);
    expect(await s.service.review('p1', SNAPSHOT, EXE)).toEqual({ ok: false, code: 'profile-removed', detail: '' });
    expect(s.inspector.calls).toEqual([]);
  });

  it('Forget and a time limit for a removed profile are refused and write nothing', async () => {
    const s = createServiceWorld();
    await trusted(s);
    await s.service.purgeProfile('p1');
    const changed: string[] = [];
    s.service.onBindingChanged((id) => { changed.push(id); });
    expect(await s.service.forget('p1')).toBe('removed');
    expect(await s.service.setTimeLimit('p1', 600)).toBe('removed');
    expect(changed).toEqual([]);
    expect(await s.store.read('p1')).toEqual({ kind: 'none' });
  });

  it('another profile is unaffected by the removal', async () => {
    const s = createServiceWorld();
    await s.service.purgeProfile('p2');
    await trusted(s);
    expect(await s.service.run('p1', SNAPSHOT)).toEqual({ kind: 'started' });
  });
});
