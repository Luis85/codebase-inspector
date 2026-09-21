import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computeLayout } from '../../src/domain/layout/layout';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { unknown, sample } from '../../src/ui/evidence';
import { fileSummariesFor, moduleLabel, moduleOf, priorityEvidence, priorityScore } from '../../src/ui/read-models/file-summaries';
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

  it('labels the root module "Root files"', () => {
    expect(moduleLabel('(root)')).toBe('Root files');
    expect(moduleLabel('src')).toBe('src');
  });

  it('makes priority unknown when any input lacks a value (A13)', () => {
    expect(priorityEvidence(sample(10), unknown('x'), sample(1), sample(2)).state).toBe('unknown');
    expect(priorityEvidence(sample(24), sample(22), sample(1), sample(2)))
      .toMatchObject({ state: 'sample', value: 50, provenance: { source: 'sample', detail: 'sample heuristic' } });
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

  // Final review item 5: colour is keyed by series id, so with coverage absent the
  // complexity series is first yet keeps its own (accent) tone.
  it('tones each series by what it is, not by its position', () => {
    expect(model.series.map((s) => [s.id, s.tone])).toEqual([['coverage', 'success'], ['high-complexity', 'accent']]);
    const empty = buildSnapshotFixture({ files: 0 });
    const m = buildOverviewModel(empty, fileSummariesFor(empty));
    expect(m.series).toEqual([]);
  });

  it('never caps the high-complexity COUNT series at 100', () => {
    const big = buildSnapshotFixture({ files: 900, directories: 6 });
    const bigFiles = fileSummariesFor(big);
    const count = bigFiles.filter((f) => (f.complexity.value ?? 0) >= 30).length;
    expect(count).toBeGreaterThan(100);
    const series = buildOverviewModel(big, bigFiles).series.find((s) => s.id === 'high-complexity');
    expect(series?.points.at(-1)?.value).toBe(count);
  });

  it('never names the "(root)" module in investigation copy', () => {
    const rootOnly = buildSnapshotFixture({ files: 6 });
    expect(buildOverviewModel(rootOnly, fileSummariesFor(rootOnly)).investigations[1]?.title).toBe('Protect the root files');
  });

  it('makes branch coverage partial, not a smaller whole, when a file lacks coverage (A13)', () => {
    const s = buildSnapshotFixture({ files: 4 });
    const withGap = fileSummariesFor(s).map((f, i) => (i === 0
      ? { ...f, branchesCovered: unknown('no report'), branchesTotal: unknown('no report') } : f));
    expect(buildOverviewModel(s, withGap).cards.find((c) => c.id === 'coverage')?.value.state).toBe('partial');
  });

  it('uses the cycles value it is given for the architecture card', () => {
    const arch = buildOverviewModel(snap, files, sample(2)).cards.find((c) => c.id === 'architecture');
    expect(arch?.value).toMatchObject({ state: 'sample', value: 2 });
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

// Final review F1: the per-snapshot read models are built once, however many callers
// (a screen and the shell's provenance badge) read them.
describe('read-model memoization', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('two callers share one Overview model per snapshot, and a new snapshot rebuilds it', () => {
    const store = useCityStore();
    const snap = buildSnapshotFixture({ files: 30, directories: 3 });
    store.setCity(snap, computeLayout(snap));
    const a = useReadModels();
    const b = useReadModels();
    expect(a.overview.value).not.toBeNull();
    expect(b.overview.value).toBe(a.overview.value);
    const next = buildSnapshotFixture({ files: 31, directories: 3 });
    store.setCity(next, computeLayout(next));
    expect(a.overview.value).not.toBe(null);
    expect(a.overview.value?.fileCount).toBe(31);
    expect(b.overview.value).toBe(a.overview.value);
  });

  it('two callers share one File detail model per (snapshot, file)', () => {
    const store = useCityStore();
    const snap = buildSnapshotFixture({ files: 12, directories: 2 });
    store.setCity(snap, computeLayout(snap));
    const [first, second] = fileSummariesFor(snap);
    store.select(first!.id);
    const a = useReadModels();
    const b = useReadModels();
    expect(a.fileDetail.value?.file.id).toBe(first!.id);
    expect(b.fileDetail.value).toBe(a.fileDetail.value);
    store.select(second!.id);
    expect(a.fileDetail.value?.file.id).toBe(second!.id);
    expect(b.fileDetail.value).toBe(a.fileDetail.value);
  });

  // Part 3 §4 (E5, no mounting): two callers share one Architecture model per rule set,
  // and adding a rule rebuilds it for both.
  it('two callers share one Architecture model per (graph, rule set)', async () => {
    const store = useCityStore();
    const snap = buildSnapshotFixture({ files: 20, directories: 2 });
    store.setCity(snap, computeLayout(snap));
    const a = useReadModels();
    const b = useReadModels();
    expect(a.architecture.value).toBe(b.architecture.value);
    await useReviewStore().addRule('dir-0', 'dir-1', 'keep boundaries', new Date());
    expect(a.architecture.value.rules).toHaveLength(1);
    expect(b.architecture.value).toBe(a.architecture.value);
  });
});
