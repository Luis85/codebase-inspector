import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { byPriority, fileSummariesFor, filesByPriority, type FileSummary } from '../../src/ui/read-models/file-summaries';
import { MAX_PLOTTED, buildHotspotsModel, coverageBand, hotspotsCsv } from '../../src/ui/read-models/hotspots';
import { sample, unknown } from '../../src/ui/evidence';

const ALL = { module: null, query: '' };
const filesOf = (files: number, directories = 3) => fileSummariesFor(buildSnapshotFixture({ files, directories }));

describe('hotspots model', () => {
  it('filters by module and by path, highest priority first', () => {
    const files = filesOf(60);
    const m = buildHotspotsModel(files, { module: 'dir-1', query: '' });
    expect(m.rows.every((f) => f.module === 'dir-1')).toBe(true);
    const ps = m.rows.map((f) => f.priority.value ?? -1);
    expect([...ps].sort((a, b) => b - a)).toEqual(ps);
    expect(buildHotspotsModel(files, { module: null, query: 'FILE-1.TS' }).rows.map((f) => f.name)).toEqual(['file-1.ts']);
    expect(m.modules.map((x) => x.name)).toEqual(['dir-0', 'dir-1', 'dir-2']);
  });
  it('plots at most MAX_PLOTTED files and counts the rest (P7)', () => {
    const m = buildHotspotsModel(filesOf(500), ALL);
    expect(m.points).toHaveLength(MAX_PLOTTED);
    expect(m.plottable).toBe(500);
    expect(m.points[0]?.file.id).toBe(m.rows[0]?.id);
  });
  it('never plots a file without complexity or commits, and never as 0', () => {
    const files = filesOf(5).map((f, i): FileSummary => (i === 0 ? { ...f, complexity: unknown('no analyzer') } : f));
    const m = buildHotspotsModel(files, ALL);
    expect(m.points).toHaveLength(4);
    expect(m.unplottable).toBe(1);
  });
  it('keeps unknown lines as null, for a ring', () => {
    const files = fileSummariesFor(buildSnapshotFixture({ files: 3, unavailable: 1 }));
    expect(buildHotspotsModel(files, ALL).points.some((p) => p.lines === null)).toBe(true);
  });
  it('bands coverage, unknown included', () => {
    expect([sample(10), sample(60), sample(80), unknown('x')].map(coverageBand)).toEqual(['low', 'mid', 'high', 'unknown']);
  });
  it('sorts by priority once per files array (F1), and filtered rows keep that order', () => {
    const files = filesOf(80);
    const sorted = filesByPriority(files);
    expect(filesByPriority(files)).toBe(sorted);
    expect(sorted).toEqual([...files].sort(byPriority));
    const rows = buildHotspotsModel(files, { module: 'dir-2', query: 'file-1' }).rows;
    expect(rows.length).toBeGreaterThan(1);
    expect(rows).toEqual(sorted.filter((f) => f.module === 'dir-2' && f.path.includes('file-1')));
    expect([...rows].sort(byPriority)).toEqual(rows);
  });
  it('shortlists at most five files with a known priority', () => {
    const files = filesOf(20).map((f, i): FileSummary => (i < 18 ? { ...f, priority: unknown('x') } : f));
    expect(buildHotspotsModel(files, ALL).shortlist).toHaveLength(2);
    expect(buildHotspotsModel(filesOf(20), ALL).shortlist).toHaveLength(5);
  });
});

describe('hotspots CSV (P8)', () => {
  it('has a header, one CRLF line per row, and a state column per metric', () => {
    const rows = filesOf(3);
    const lines = hotspotsCsv(rows).split('\r\n');
    expect(lines[0]).toBe('path,module,priority,priority_state,complexity,complexity_state,commits_90d,commits_90d_state,branch_coverage_pct,branch_coverage_pct_state,lines,lines_state');
    expect(lines).toHaveLength(rows.length + 2);   // header + rows + trailing empty
    expect(lines.at(-1)).toBe('');
  });
  it('exports an unknown value as an empty cell with its state — never 0', () => {
    const [f] = filesOf(1);
    const csv = hotspotsCsv([{ ...f!, complexity: unknown('no analyzer') }]);
    expect(csv.split('\r\n')[1]).toContain(',,unknown,');
  });
  it('guards formula injection and quotes separators', () => {
    const [f] = filesOf(1);
    const line = hotspotsCsv([{ ...f!, path: '=HYPERLINK("x"),a.ts', module: '+cmd' }]).split('\r\n')[1];
    expect(line?.startsWith('"\'=HYPERLINK(""x""),a.ts",\'+cmd,')).toBe(true);
  });
});
