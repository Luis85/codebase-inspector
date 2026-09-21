import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildFileDetail } from '../../src/ui/read-models/file-detail';
import {
  buildQualityModel, DEFAULT_QUALITY_FILTER, filterFindings, findingsCsv,
} from '../../src/ui/read-models/findings';

const snap = buildSnapshotFixture({ files: 60, directories: 2 });
const files = fileSummariesFor(snap);
const NOW = '2026-09-21T10:00:00.000Z';

describe('code quality model (Part 3 Q1-Q3)', () => {
  it('lists every sample finding of every file, one per file finding count', () => {
    const m = buildQualityModel(files, []);
    const expected = files.reduce((n, f) => n + (f.findings.value ?? 0), 0);
    expect(m.findings).toHaveLength(expected);
    expect(m.findings.length).toBeGreaterThan(0);
    expect(m.findings.every((f) => f.status === 'open')).toBe(true);
  });

  it('fingerprints are unique even where display ids repeat across files', () => {
    const m = buildQualityModel(files, []);
    const ids = m.findings.map((f) => f.id);
    expect(new Set(ids).size).toBeLessThan(ids.length);   // display ids DO repeat within a module
    expect(new Set(m.findings.map((f) => f.fingerprint)).size).toBe(m.findings.length);
  });

  it('File detail and Code quality agree on a finding fingerprint', () => {
    const file = files.find((f) => (f.findings.value ?? 0) > 0)!;
    const detail = buildFileDetail(snap, files, file.id)!;
    const m = buildQualityModel(files, []);
    expect(m.byFingerprint.get(detail.findings[0]!.fingerprint)?.file.id).toBe(file.id);
  });

  it('applies dispositions by fingerprint and keeps the reason', () => {
    const [a, b] = buildQualityModel(files, []).findings;
    const m = buildQualityModel(files, [
      { fingerprint: a!.fingerprint, status: 'acknowledged', decidedAt: NOW },
      { fingerprint: b!.fingerprint, status: 'dismissed', reason: 'intended API', decidedAt: NOW },
      { fingerprint: 'gone#X', status: 'dismissed', reason: 'stale', decidedAt: NOW },
    ]);
    expect(m.byFingerprint.get(a!.fingerprint)?.status).toBe('acknowledged');
    expect(m.byFingerprint.get(b!.fingerprint)?.reason).toBe('intended API');
    const open = buildQualityModel(files, []).cards.find((c) => c.id === 'open')!.value.value!;
    expect(m.cards.find((c) => c.id === 'open')!.value.value).toBe(open - 2);
  });

  it('filters by status (default open), kind, severity, module and text', () => {
    const [a] = buildQualityModel(files, []).findings;
    const m = buildQualityModel(files, [{ fingerprint: a!.fingerprint, status: 'acknowledged', decidedAt: NOW }]);
    expect(filterFindings(m.findings, DEFAULT_QUALITY_FILTER)).not.toContain(m.byFingerprint.get(a!.fingerprint));
    expect(filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'acknowledged' })).toHaveLength(1);
    const cx = filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', kind: 'complexity' });
    expect(cx.length).toBeGreaterThan(0);
    expect(cx.every((f) => f.kind === 'complexity' && f.severity === 'high')).toBe(true);
    const low = filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', severity: 'low' });
    expect(low.length).toBeGreaterThan(0);
    expect(low.every((f) => f.kind === 'unused-exports')).toBe(true);
    const mod = filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', module: 'dir-1' });
    expect(mod.length).toBeGreaterThan(0);
    expect(mod.every((f) => f.file.module === 'dir-1')).toBe(true);
    expect(filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', query: 'no-such' })).toHaveLength(0);
  });

  it('with no files, every card is unknown, never 0', () => {
    const m = buildQualityModel([], []);
    expect(m.cards).toHaveLength(4);
    expect(m.cards.every((c) => c.value.state === 'unknown')).toBe(true);
    expect(m.usesSample).toBe(false);
  });

  it('exports status and reason; an unknown line is an empty cell with its state', () => {
    const m = buildQualityModel(files, []);
    const f = m.findings[0]!;
    const [header, row] = findingsCsv([{ ...f, status: 'dismissed', reason: '=cmd' }]).replace('\uFEFF', '').split('\r\n');
    expect(header).toBe('id,path,module,kind,severity,line,line_state,status,reason,provenance');
    expect(row).toContain(",dismissed,'=cmd,sample");
    expect(findingsCsv([{ ...f, line: null }]).split('\r\n')[1]).toContain(',,unknown,');
  });
});
