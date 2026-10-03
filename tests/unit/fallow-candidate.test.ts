// Part 6 Y26/Y38: what the S14 review step shows for a parsed report, resolved against the
// snapshot on screen — matches, unmatched and refused paths, the mapping offer, mismatch.
import { describe, expect, it } from 'vitest';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { UNMATCHED_SHOWN, reviewFallowCandidate, type FallowCandidate } from '../../src/ui/read-models/fallow-candidate';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { snapshotWithPaths, syntheticFallowJson, type SyntheticFallowOptions } from '../fixtures/evidence-report';

const snap = buildSnapshotFixture({ files: 10, directories: 2 });
const filePaths = snap.entities.filter((e) => e.kind === 'file').map((e) => e.path);
const paths: ReadonlySet<string> = new Set(filePaths);
function candidate(source: CodebaseSnapshot, o: SyntheticFallowOptions = {}): FallowCandidate {
  const read = parseFallowReportText(syntheticFallowJson(source, o));
  if (!read.ok) throw new Error(`${read.code}: ${read.detail}`);
  return { raw: read.report, fileName: 'r.json', importedAt: '2026-09-23T08:30:00.000Z', snapshotId: snap.snapshotId };
}

describe('reviewFallowCandidate (Part 6 Y26/Y38)', () => {
  // WP-03 N38: `snap`'s 10 files satisfy syntheticFallowJson's six-file floor, so its
  // usual 19 unused/complexity/duplication findings gain 5 relation findings (cycle,
  // re-export cycle, two boundary violations, unresolved import) — 24 in all.
  it('matches every finding on the snapshot\'s own paths', () => {
    const r = reviewFallowCandidate(candidate(snap), paths, false);
    expect(r).toMatchObject({ matchedFindings: 24, matchedFiles: 10, unmatchedPaths: [], suggestion: null, mismatch: false });
    expect(r.report.stripPrefix).toBeNull();
  });

  it('lists unmatched paths distinct and sorted, and offers no mapping that would not match', () => {
    const r = reviewFallowCandidate(candidate(snap, { unmatchedPaths: ['ghost/b.ts', 'ghost/a.ts', 'ghost/a.ts'] }), paths, false);
    expect(r.unmatchedPaths).toEqual(['ghost/a.ts', 'ghost/b.ts']);
    expect(r).toMatchObject({ matchedFindings: 24, suggestion: null, mismatch: false });
  });

  it('offers the leading folder and applies it only when asked (Y26)', () => {
    const c = candidate(snapshotWithPaths(filePaths.map((p) => `app/${p}`)));
    const plain = reviewFallowCandidate(c, paths, false);
    expect(plain).toMatchObject({ matchedFindings: 0, suggestion: 'app/', mismatch: false });
    expect(plain.unmatchedPaths).toHaveLength(10);
    expect(plain.report.stripPrefix).toBeNull();
    const mapped = reviewFallowCandidate(c, paths, true);
    expect(mapped).toMatchObject({ matchedFindings: 24, matchedFiles: 10, unmatchedPaths: [], suggestion: 'app/' });
    expect(mapped.report.stripPrefix).toBe('app/');
  });

  it('is a source mismatch when the report has findings and none match, even with a mapping (COPY-17)', () => {
    const r = reviewFallowCandidate(candidate(snapshotWithPaths(['elsewhere/a.ts', 'elsewhere/b.ts'])), paths, false);
    expect(r).toMatchObject({ matchedFindings: 0, suggestion: null, mismatch: true });
  });

  it('is never a mismatch for a report with no findings at all', () => {
    expect(reviewFallowCandidate(candidate(snapshotWithPaths([])), paths, false)).toMatchObject({ matchedFindings: 0, mismatch: false });
  });

  it('lists a refused path (absolute, or with ..) as unmatched, never resolved', () => {
    const r = reviewFallowCandidate(candidate(snap, { unmatchedPaths: ['../outside.ts', '/abs/x.ts'] }), paths, false);
    expect(r.unmatchedPaths).toEqual(expect.arrayContaining(['../outside.ts', '/abs/x.ts']));
    expect(r.matchedFindings).toBe(24);
    expect(reviewFallowCandidate(candidate(snapshotWithPaths([]), { unmatchedPaths: ['../outside.ts'] }), paths, false).mismatch).toBe(true);
  });

  it('lists at most 20 unmatched paths on screen', () => {
    expect(UNMATCHED_SHOWN).toBe(20);
  });
});
