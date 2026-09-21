import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor, type FileSummary } from '../../src/ui/read-models/file-summaries';
import { buildFileDetail } from '../../src/ui/read-models/file-detail';
import { sampleFindings } from '../../src/ui/fixtures/sample-findings';
import { sample, unknown } from '../../src/ui/evidence';

const snap = buildSnapshotFixture({ files: 12, directories: 2, unavailable: 1 });
const files = fileSummariesFor(snap);

describe('file detail model', () => {
  it('is null without a selection, for an unknown id, and for a directory', () => {
    expect(buildFileDetail(snap, files, null)).toBeNull();
    expect(buildFileDetail(snap, files, 'nope')).toBeNull();
    const dir = snap.entities.find((e) => e.kind === 'directory')!;
    expect(buildFileDetail(snap, files, dir.id)).toBeNull();
  });
  it('has four sample cards, collected bytes and the entity category', () => {
    const f = files[3]!;
    const d = buildFileDetail(snap, files, f.id)!;
    expect(d.cards.map((c) => [c.id, c.value.state])).toEqual([['complexity', 'sample'], ['coverage', 'sample'], ['dependents', 'sample'], ['priority', 'sample']]);
    expect(d.bytes.state).toBe('collected');
    expect(d.category).toBe(snap.entities.find((e) => e.id === f.id)?.category);
    expect(d.moduleLabel).toBe(f.module);
    expect(d.usesSample).toBe(true);
  });
  it('ends each history series at the current value', () => {
    const f = files[3]!;
    const d = buildFileDetail(snap, files, f.id)!;
    expect(d.history.find((s) => s.id === 'complexity')?.points.at(-1)?.value).toBe(f.complexity.value);
    expect(d.history.find((s) => s.id === 'coverage')?.points.at(-1)?.value).toBe(f.branchCoverage.value);
  });
  it('omits a history series whose value is unknown', () => {
    const f: FileSummary = { ...files[3]!, branchCoverage: unknown('no report') };
    const d = buildFileDetail(snap, files.map((x) => (x.id === f.id ? f : x)), f.id)!;
    expect(d.history.map((s) => s.id)).toEqual(['complexity']);
  });
});

describe('sample findings', () => {
  it('is deterministic, matches the file\'s count, and puts high findings first', () => {
    const f: FileSummary = { ...files[2]!, findings: sample(3), highFindings: sample(1) };
    const list = sampleFindings(f);
    expect(sampleFindings(f)).toEqual(list);
    expect(list).toHaveLength(3);
    expect(list.map((x) => x.severity)).toEqual(['high', 'medium', 'low']);
    expect(list[0]?.id).toMatch(/^CX-dir-\d-0$/);
  });
  it('never puts a finding beyond the file\'s known lines, and has no line when lines are unknown', () => {
    for (const f of files) {
      for (const x of sampleFindings({ ...f, findings: sample(4), highFindings: sample(0) })) {
        if (f.lines.value === undefined) {
          expect(x.line).toBeNull();
        } else {
          expect(x.line).toBeGreaterThanOrEqual(1);
          expect(x.line).toBeLessThanOrEqual(f.lines.value);
        }
      }
    }
  });
  it('has no findings when the count is unknown', () => {
    expect(sampleFindings({ ...files[0]!, findings: unknown('x') })).toEqual([]);
  });
});
