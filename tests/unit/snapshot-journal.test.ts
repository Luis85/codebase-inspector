import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor, groupByModule } from '../../src/ui/read-models/file-summaries';
import { compareSnapshots, journalEntryFor } from '../../src/ui/read-models/snapshot-comparison';
import { JOURNAL_CAP, useSnapshotJournal } from '../../src/ui/stores/snapshot-journal';
import type { CodebaseSnapshot } from '../../src/domain/model';

const entry = (snap: CodebaseSnapshot) => journalEntryFor(snap, fileSummariesFor(snap));
const withId = (snap: CodebaseSnapshot, snapshotId: string): CodebaseSnapshot => ({ ...snap, snapshotId });

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
