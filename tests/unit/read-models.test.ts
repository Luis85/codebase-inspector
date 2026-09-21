import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor, moduleOf, priorityScore } from '../../src/ui/read-models/file-summaries';
import { buildOverviewModel, HOTSPOT_THRESHOLD } from '../../src/ui/read-models/overview';
import { buildCitySummary } from '../../src/ui/read-models/city-summary';

describe('file summaries', () => {
  it('derives the module from the first path segment', () => {
    expect(moduleOf('src/domain/a.ts')).toBe('src');
    expect(moduleOf('a.ts')).toBe('(root)');
  });

  it('uses the handoff priority heuristic, capped at 100', () => {
    expect(priorityScore(48, 44, 0)).toBe(100);
    expect(priorityScore(0, 0, 1)).toBe(0);
    expect(priorityScore(24, 22, 0.5)).toBe(50);
  });

  it('marks real line counts collected and everything else sample', () => {
    const snap = buildSnapshotFixture({ files: 3 });
    const [first] = fileSummariesFor(snap);
    expect(first?.lines.state).toBe('collected');
    expect(first?.lines.provenance.source).toBe('inventory');
    expect(first?.complexity.state).toBe('sample');
    expect(first?.priority.state).toBe('sample');
  });

  it('keeps an unavailable line count unknown with its reason — never 0', () => {
    const snap = buildSnapshotFixture({ files: 2, unavailable: 1 });
    const unknownLines = fileSummariesFor(snap).find((f) => f.lines.state === 'unknown');
    expect(unknownLines?.lines.value).toBeUndefined();
    expect(unknownLines?.lines.reason).toBeTruthy();
  });

  it('returns only files and memoizes per snapshot object', () => {
    const snap = buildSnapshotFixture({ files: 4, directories: 2 });
    expect(fileSummariesFor(snap)).toHaveLength(4);
    expect(fileSummariesFor(snap)).toBe(fileSummariesFor(snap));
  });
});

describe('overview model', () => {
  const snap = buildSnapshotFixture({ files: 40, directories: 3 });
  const files = fileSummariesFor(snap);
  const model = buildOverviewModel(snap, files);

  it('has the four prototype cards and no composite score', () => {
    expect(model.cards.map((c) => c.id)).toEqual(['findings', 'coverage', 'architecture', 'hotspots']);
  });

  it('reports architecture as unknown, not zero', () => {
    const arch = model.cards.find((c) => c.id === 'architecture');
    expect(arch?.value.state).toBe('unknown');
    expect(arch?.value.value).toBeUndefined();
  });

  it('counts hotspots at or above the threshold', () => {
    const expected = files.filter((f) => (f.priority.value ?? 0) >= HOTSPOT_THRESHOLD).length;
    expect(model.cards.find((c) => c.id === 'hotspots')?.value.value).toBe(expected);
  });

  it('lists at most five hotspots, highest priority first', () => {
    expect(model.hotspots.length).toBeLessThanOrEqual(5);
    const ps = model.hotspots.map((h) => h.priority.value ?? 0);
    expect([...ps].sort((a, b) => b - a)).toEqual(ps);
  });

  it('ends the coverage series at the coverage card value', () => {
    const coverage = model.series.find((s) => s.id === 'coverage');
    expect(coverage?.points).toHaveLength(7);
    expect(coverage?.points.at(-1)?.value).toBe(model.cards.find((c) => c.id === 'coverage')?.value.value);
  });

  it('declares inventory collected and import graph unknown in evidence coverage', () => {
    expect(model.coverage.find((r) => r.id === 'inventory')?.state).toBe('collected');
    expect(model.coverage.find((r) => r.id === 'imports')?.state).toBe('unknown');
    expect(model.usesSample).toBe(true);
  });

  it('marks inventory partial for a partial snapshot', () => {
    const partial = buildSnapshotFixture({ files: 3, completeness: 'partial' });
    const m = buildOverviewModel(partial, fileSummariesFor(partial));
    expect(m.coverage.find((r) => r.id === 'inventory')?.state).toBe('partial');
  });

  it('produces three investigations with targets', () => {
    expect(model.investigations).toHaveLength(3);
    expect(model.investigations[0]?.entityId).toBeTruthy();
  });

  it('handles an empty snapshot without throwing', () => {
    const empty = buildSnapshotFixture({ files: 0 });
    const m = buildOverviewModel(empty, fileSummariesFor(empty));
    expect(m.fileCount).toBe(0);
    expect(m.investigations).toHaveLength(0);
    expect(m.cards.find((c) => c.id === 'coverage')?.value.state).toBe('unknown');
  });
});

describe('city summary', () => {
  it('has hotspots, cycles (unknown) and unused exports', () => {
    const snap = buildSnapshotFixture({ files: 20 });
    const cards = buildCitySummary(fileSummariesFor(snap));
    expect(cards.map((c) => c.id)).toEqual(['hotspots', 'cycles', 'unused']);
    expect(cards[1]?.value.state).toBe('unknown');
  });
});
