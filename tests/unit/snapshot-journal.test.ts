import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor, groupByModule } from '../../src/ui/read-models/file-summaries';
import {
  compareSnapshots, journalEntryFor, type JournalEntry, type JournalModule,
} from '../../src/ui/read-models/snapshot-comparison';
import { JOURNAL_CAP, useSnapshotJournal } from '../../src/ui/stores/snapshot-journal';
import { collected, sumEvidence } from '../../src/ui/evidence';
import { COMPARE_MODULE_ABSENT } from '../../src/ui/inspector-copy';
import type { CodebaseSnapshot } from '../../src/domain/model';

const entry = (snap: CodebaseSnapshot) => journalEntryFor(snap, fileSummariesFor(snap));
const withId = (snap: CodebaseSnapshot, snapshotId: string): CodebaseSnapshot => ({ ...snap, snapshotId });

/** A hand-built JournalEntry for compareSnapshots tests that need exact control over
 *  module membership and file identity, without buildSnapshotFixture's round-robin
 *  module assignment coupling every module's file count to the total. */
function fakeEntry(fileIds: readonly string[], modules: readonly JournalModule[]): JournalEntry {
  return {
    snapshotId: `fake-${fileIds.join('-')}`, repositoryId: 'fake-repo', capturedAt: '2026-01-01T00:00:00.000Z',
    files: fileIds.length, lines: sumEvidence(modules.map((m) => m.lines)), modules, fileIds: new Set(fileIds),
  };
}

describe('journalEntryFor / compareSnapshots (Part 3 Q8, Q9)', () => {
  it('summarizes files, collected lines and modules', () => {
    const snap = buildSnapshotFixture({ files: 12, directories: 3 });
    const e = entry(snap);
    expect(e.files).toBe(12);
    expect(e.lines.state).toBe('collected');
    expect(e.modules.map((m) => m.module)).toEqual(['dir-0', 'dir-1', 'dir-2']);
    expect(e.modules.length).toBeGreaterThan(0);
    expect(e.modules.every((m) => m.files === 4)).toBe(true);
  });

  it('counts added, removed and kept files by identity, and module deltas', () => {
    const before = entry(buildSnapshotFixture({ files: 10, directories: 2 }));
    const after = entry(buildSnapshotFixture({ files: 13, directories: 2 }));
    const c = compareSnapshots(before, after);
    expect(c.added).toBe(3);
    expect(c.removed).toBe(0);
    expect(c.kept).toBe(10);
    expect(c.filesDelta).toBe(3);
    expect(c.linesDelta.state).toBe('collected');
    expect(c.modules.find((m) => m.module === 'dir-0')).toMatchObject({ filesBefore: 5, filesAfter: 7, changed: true });
  });

  it('an unknown line total makes the line delta unknown, never a 0 delta', () => {
    const before = entry(buildSnapshotFixture({ files: 3, unavailable: 3 }));
    const after = entry(buildSnapshotFixture({ files: 3 }));
    expect(compareSnapshots(before, after).linesDelta.state).toBe('unknown');
  });

  it('a module present only in current (more directories) has an unknown before-side (module union)', () => {
    const base = entry(buildSnapshotFixture({ files: 10, directories: 2 }));
    const current = entry(buildSnapshotFixture({ files: 16, directories: 3 }));
    const added = compareSnapshots(base, current).modules.find((m) => m.module === 'dir-2')!;
    expect(added.filesBefore).toBe(0);
    expect(added.filesAfter).toBeGreaterThan(0);
    expect(added.changed).toBe(true);
    expect(added.linesBefore.state).toBe('unknown');
    expect(added.linesBefore.reason).toBe(COMPARE_MODULE_ABSENT);
  });

  it('a module present only in base (fewer directories now) has an unknown after-side (module union, reverse)', () => {
    const base = entry(buildSnapshotFixture({ files: 16, directories: 3 }));
    const current = entry(buildSnapshotFixture({ files: 10, directories: 2 }));
    const removed = compareSnapshots(base, current).modules.find((m) => m.module === 'dir-2')!;
    expect(removed.filesAfter).toBe(0);
    expect(removed.filesBefore).toBeGreaterThan(0);
    expect(removed.changed).toBe(true);
    expect(removed.linesAfter.state).toBe('unknown');
    expect(removed.linesAfter.reason).toBe(COMPARE_MODULE_ABSENT);
  });

  it('a module with identical files and lines reports changed: false even when other files are removed', () => {
    const dir0: JournalModule = { module: 'dir-0', files: 3, lines: collected(30, 'inventory') };
    const dir1Before: JournalModule = { module: 'dir-1', files: 2, lines: collected(20, 'inventory') };
    const base = fakeEntry(['f1', 'f2', 'f3', 'f4', 'f5'], [dir0, dir1Before]);
    const current = fakeEntry(['f1', 'f2', 'f3'], [dir0]);
    const c = compareSnapshots(base, current);
    expect(c.removed).toBeGreaterThan(0);
    expect(c.modules.find((m) => m.module === 'dir-0')).toMatchObject({ changed: false, filesBefore: 3, filesAfter: 3 });
  });
});

describe('groupByModule (E11)', () => {
  it('groups files by module, keeping insertion order', () => {
    const snap = buildSnapshotFixture({ files: 6, directories: 2 });
    const files = fileSummariesFor(snap);
    const groups = groupByModule(files);
    expect([...groups.keys()]).toEqual(['dir-0', 'dir-1']);
    expect(groups.get('dir-0')).toHaveLength(3);
    expect(groups.get('dir-1')).toHaveLength(3);
  });
});

describe('snapshot journal store', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('records each distinct snapshot once, oldest first', () => {
    const j = useSnapshotJournal();
    const snap = buildSnapshotFixture({ files: 3 });
    j.record(entry(snap));
    j.record(entry(snap));
    j.record(entry(withId(snap, 'second')));
    expect(j.entries.map((e) => e.snapshotId)).toEqual([snap.snapshotId, 'second']);
  });

  it('keeps at most JOURNAL_CAP entries, dropping the oldest', () => {
    const j = useSnapshotJournal();
    const snap = buildSnapshotFixture({ files: 2 });
    for (let i = 0; i < JOURNAL_CAP + 2; i += 1) j.record(entry(withId(snap, `s${i}`)));
    expect(j.entries).toHaveLength(JOURNAL_CAP);
    expect(j.entries[0]?.snapshotId).toBe('s2');
  });

  it('starts over when the repository changes', () => {
    const j = useSnapshotJournal();
    j.record(entry(buildSnapshotFixture({ files: 2, repositoryId: 'a' })));
    j.record(entry(buildSnapshotFixture({ files: 2, repositoryId: 'b' })));
    expect(j.entries.map((e) => e.repositoryId)).toEqual(['b']);
  });
});
