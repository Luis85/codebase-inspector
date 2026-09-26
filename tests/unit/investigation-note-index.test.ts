import { describe, expect, it } from 'vitest';
import { applyNoteEvent, noteIndexFor, readNoteFrontmatter, type NoteRecords } from '../../src/application/investigation/note-index';

const fm = (over: Record<string, unknown> = {}) => ({
  type: 'codebase-investigation', codebase_id: 'p1', entity_id: 'file:src/a.ts', source_path: 'src/a.ts',
  snapshot_id: 's1', finding_id: 'UN-00000001', finding_fingerprint: 'src/a.ts#UN-00000001', provider: 'fallow',
  status: 'open', created: '2026-09-25T10:00:00.000Z', ...over,
});
const EMPTY: NoteRecords = new Map();

describe('readNoteFrontmatter (IN33)', () => {
  it('links a well-formed note', () => {
    expect(readNoteFrontmatter('n.md', fm())).toEqual({ kind: 'linked', link: {
      path: 'n.md', codebaseId: 'p1', fingerprint: 'src/a.ts#UN-00000001', findingId: 'UN-00000001',
      sourcePath: 'src/a.ts', snapshotId: 's1', status: 'open' } });
  });
  it('ignores a note that is not an investigation, or names no codebase', () => {
    expect(readNoteFrontmatter('n.md', { type: 'daily' })).toBeNull();
    expect(readNoteFrontmatter('n.md', fm({ codebase_id: 42 }))).toBeNull();
    expect(readNoteFrontmatter('n.md', null)).toBeNull();
    expect(readNoteFrontmatter('n.md', ['type'])).toBeNull();
  });
  // Review Focus 5: hostile frontmatter.
  it.each([
    ['a number fingerprint', { finding_fingerprint: 7 }], ['a list snapshot', { snapshot_id: ['s1'] }],
    ['a null finding id', { finding_id: null }], ['an empty source path', { source_path: '' }],
    ['an over-long fingerprint', { finding_fingerprint: 'x'.repeat(2049) }],
  ])('counts %s as malformed', (_name, over) => {
    expect(readNoteFrontmatter('n.md', fm(over))).toEqual({ kind: 'malformed', path: 'n.md', codebaseId: 'p1' });
  });
  it('keeps a non-string status as no status', () => {
    expect(readNoteFrontmatter('n.md', fm({ status: 3 }))).toMatchObject({ link: { status: null } });
  });
  it('treats a cache with no frontmatter as not ours (undefined, distinct from null)', () => {
    expect(readNoteFrontmatter('n.md', undefined)).toBeNull();
  });
});

describe('applyNoteEvent and noteIndexFor', () => {
  const base = applyNoteEvent(EMPTY, { kind: 'reset', files: [
    { path: 'b.md', frontmatter: fm() }, { path: 'a.md', frontmatter: fm() },
    { path: 'other.md', frontmatter: fm({ codebase_id: 'p2' }) }, { path: 'bad.md', frontmatter: fm({ finding_id: 1 }) },
  ] });
  it('lists every note for a fingerprint, by path, for this codebase only (duplicates kept)', () => {
    const index = noteIndexFor(base, 'p1');
    expect(index.byFingerprint.get('src/a.ts#UN-00000001')!.map((l) => l.path)).toEqual(['a.md', 'b.md']);
    expect(index.malformed).toBe(1);
    expect(noteIndexFor(base, 'p2').byFingerprint.get('src/a.ts#UN-00000001')!.map((l) => l.path)).toEqual(['other.md']);
  });
  it('follows a rename and forgets a delete', () => {
    const moved = applyNoteEvent(base, { kind: 'renamed', oldPath: 'a.md', path: 'x/a.md', frontmatter: fm() });
    expect(noteIndexFor(moved, 'p1').byFingerprint.get('src/a.ts#UN-00000001')!.map((l) => l.path)).toEqual(['b.md', 'x/a.md']);
    const gone = applyNoteEvent(moved, { kind: 'deleted', path: 'b.md' });
    expect(noteIndexFor(gone, 'p1').byFingerprint.get('src/a.ts#UN-00000001')!.map((l) => l.path)).toEqual(['x/a.md']);
  });
  it('unlinks a note whose frontmatter was edited away', () => {
    const edited = applyNoteEvent(base, { kind: 'changed', path: 'a.md', frontmatter: { type: 'note' } });
    expect(noteIndexFor(edited, 'p1').byFingerprint.get('src/a.ts#UN-00000001')!.map((l) => l.path)).toEqual(['b.md']);
  });
  it('follows a malformed -> valid -> malformed round trip at the same path', () => {
    const step1 = applyNoteEvent(EMPTY, { kind: 'changed', path: 'r.md', frontmatter: fm({ finding_id: 1 }) });
    expect(step1).not.toBe(EMPTY);
    expect(noteIndexFor(step1, 'p1').malformed).toBe(1);
    const step2 = applyNoteEvent(step1, { kind: 'changed', path: 'r.md', frontmatter: fm() });
    expect(step2).not.toBe(step1);
    const index2 = noteIndexFor(step2, 'p1');
    expect(index2.malformed).toBe(0);
    expect(index2.byFingerprint.get('src/a.ts#UN-00000001')!.map((l) => l.path)).toEqual(['r.md']);
    const step3 = applyNoteEvent(step2, { kind: 'changed', path: 'r.md', frontmatter: fm({ finding_id: 1 }) });
    expect(step3).not.toBe(step2);
    expect(noteIndexFor(step3, 'p1').malformed).toBe(1);
  });
  it('returns the same map when nothing changed, so no listener fires', () => {
    expect(applyNoteEvent(base, { kind: 'changed', path: 'a.md', frontmatter: fm() })).toBe(base);
    expect(applyNoteEvent(base, { kind: 'deleted', path: 'none.md' })).toBe(base);
    expect(applyNoteEvent(base, { kind: 'reset', files: [
      { path: 'b.md', frontmatter: fm() }, { path: 'a.md', frontmatter: fm() },
      { path: 'other.md', frontmatter: fm({ codebase_id: 'p2' }) }, { path: 'bad.md', frontmatter: fm({ finding_id: 1 }) },
    ] })).toBe(base);
  });
});
