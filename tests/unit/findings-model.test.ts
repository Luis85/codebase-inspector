// Part 3 Q1-Q3, Part 6 Y33-Y35 (ruling R6): the Code quality model over imported evidence.
import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { syntheticEvidenceReport } from '../fixtures/evidence-report';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildFileDetail } from '../../src/ui/read-models/file-detail';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import {
  buildQualityModel, DEFAULT_QUALITY_FILTER, filterFindings, findingsCsv, severityRank, severityTone,
  type QualityModel,
} from '../../src/ui/read-models/findings';
import type { FindingDisposition } from '../../src/ui/stores/ports/review-repository';
import { FALLOW_NOT_ANALYSED, NO_FILES_REASON } from '../../src/ui/inspector-copy';

const snap = buildSnapshotFixture({ files: 60, directories: 2 });
const files = fileSummariesFor(snap);
const report = syntheticEvidenceReport(snap);
const evidence = evidenceIndexFor(files, report, snap.snapshotId);
const NOW = '2026-09-21T10:00:00.000Z';
const model = (dispositions: readonly FindingDisposition[] = []) => buildQualityModel(files, evidence, dispositions);
const card = (m: QualityModel, id: string) => m.cards.find((c) => c.id === id)!.value;

describe('code quality model (Part 3 Q1-Q3, Part 6 Y34)', () => {
  it('lists every imported finding that resolved to a file, all open', () => {
    const m = model();
    expect(m.findings.length).toBeGreaterThan(0);
    expect(m.findings).toHaveLength(report.normalized.findings.length);
    expect(m.findings.every((f) => f.status === 'open')).toBe(true);
    expect(m.evidence).toBe(evidence);
  });

  it('fingerprints are unique and name the file (Q2)', () => {
    const m = model();
    expect(new Set(m.findings.map((f) => f.fingerprint)).size).toBe(m.findings.length);
    expect(m.findings[0]!.fingerprint).toBe(`${m.findings[0]!.file.id}#${m.findings[0]!.id}`);
  });

  it('File detail and Code quality agree on a finding fingerprint', () => {
    const file = files[3]!;
    const detail = buildFileDetail(snap, files, file.id, evidence)!;
    expect(detail.findings.length).toBeGreaterThan(0);
    expect(model().byFingerprint.get(detail.findings[0]!.fingerprint)?.file.id).toBe(file.id);
  });

  it('applies dispositions by fingerprint and keeps the reason', () => {
    const [a, b] = model().findings;
    const m = model([
      { fingerprint: a!.fingerprint, status: 'acknowledged', decidedAt: NOW },
      { fingerprint: b!.fingerprint, status: 'dismissed', reason: 'intended API', decidedAt: NOW },
      { fingerprint: 'gone#X', status: 'dismissed', reason: 'stale', decidedAt: NOW },
    ]);
    expect(m.byFingerprint.get(a!.fingerprint)?.status).toBe('acknowledged');
    expect(m.byFingerprint.get(b!.fingerprint)?.reason).toBe('intended API');
    expect(card(m, 'open').value).toBe((card(model(), 'open').value ?? 0) - 2);
  });

  it('filters by status (default open), kind, severity, module and text', () => {
    const [a] = model().findings;
    const m = model([{ fingerprint: a!.fingerprint, status: 'acknowledged', decidedAt: NOW }]);
    expect(filterFindings(m.findings, DEFAULT_QUALITY_FILTER)).not.toContain(m.byFingerprint.get(a!.fingerprint));
    expect(filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'acknowledged' })).toHaveLength(1);
    const cx = filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', kind: 'complexity' });
    expect(cx.length).toBeGreaterThan(0);
    expect(cx.every((f) => f.kind === 'complexity' && f.severity !== 'unrated')).toBe(true);
    const unrated = filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', severity: 'unrated' });
    expect(unrated.length).toBeGreaterThan(0);
    expect(unrated.every((f) => f.kind !== 'complexity')).toBe(true);
    // Y35: the unused-exports kind covers both of its rules.
    const unused = filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', kind: 'unused-exports' });
    expect(new Set(unused.map((f) => f.rule))).toEqual(new Set(['unused-export', 'unused-type']));
    const mod = filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', module: 'dir-1' });
    expect(mod.length).toBeGreaterThan(0);
    expect(mod.every((f) => f.file.module === 'dir-1')).toBe(true);
    // The symbol is searchable: only file 7's unused type is named symbol7 (60 files: no symbol70-79).
    expect(filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', query: 'symbol7' })).toHaveLength(1);
    expect(filterFindings(m.findings, { ...DEFAULT_QUALITY_FILTER, status: 'all', query: 'no-such' })).toHaveLength(0);
  });

  it('cards count the open findings per category as collected fallow evidence', () => {
    const m = model();
    expect(card(m, 'open')).toMatchObject({ state: 'collected', value: m.findings.length, provenance: { source: 'fallow', detail: 'imported report 3.27.0' } });
    expect(card(m, 'unused-exports').value).toBe(m.findings.filter((f) => f.kind === 'unused-exports').length);
    expect(card(m, 'duplication').value).toBe(m.findings.filter((f) => f.kind === 'duplication').length);
  });

  it('with no report there are no findings, and every card is unknown with FALLOW_NOT_ANALYSED, never 0', () => {
    const m = buildQualityModel(files, evidenceIndexFor(files, null, snap.snapshotId), []);
    expect(m.findings).toEqual([]);
    expect(m.cards).toHaveLength(4);
    for (const c of m.cards) expect(c.value).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
    // Fix round 1 (E37): the Open caption carries no unmeasured count either.
    const caption = m.cards.find((c) => c.id === 'open')!.caption;
    expect(caption).toBe(FALLOW_NOT_ANALYSED);
    expect(caption).not.toMatch(/\d/);
  });

  it('with no files, every card is unknown with its reason, never 0', () => {
    const m = buildQualityModel([], evidenceIndexFor([], null, ''), []);
    expect(m.cards).toHaveLength(4);
    for (const c of m.cards) expect(c.value).toMatchObject({ state: 'unknown', reason: NO_FILES_REASON });
    expect(m.cards.find((c) => c.id === 'open')!.caption).toBe(NO_FILES_REASON);
  });

  it('a category the report did not analyse reads unknown; the others still count (Y25, a dead-code report)', () => {
    const deadCode = syntheticEvidenceReport(snap, { kind: 'dead-code' });
    const m = buildQualityModel(files, evidenceIndexFor(files, deadCode, snap.snapshotId), []);
    expect(card(m, 'complexity')).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
    expect(card(m, 'duplication').state).toBe('unknown');
    expect(card(m, 'unused-exports').state).toBe('collected');
    expect(card(m, 'open').state).toBe('partial');
  });

  it('stale evidence is still listed, with every count stale (Y30)', () => {
    const stale = evidenceIndexFor(files, syntheticEvidenceReport(snap, { snapshotId: 'an-older-snapshot' }), snap.snapshotId);
    const m = buildQualityModel(files, stale, []);
    expect(m.findings).toHaveLength(report.normalized.findings.length);
    const values = m.cards.map((c) => c.value);
    expect(values).toHaveLength(4);
    expect(values.every((v) => v.state === 'stale')).toBe(true);
    // Fix round 1 (E37): stale evidence is never described as "in this snapshot".
    const caption = m.cards.find((c) => c.id === 'open')!.caption;
    expect(caption).not.toContain('in this snapshot');
    expect(caption).toBe(`${m.findings.length} findings in the attached evidence · 0 decided`);
    expect(card(model(), 'open').state).toBe('collected');
    expect(model().cards.find((c) => c.id === 'open')!.caption).toBe(`${m.findings.length} findings in this snapshot · 0 decided`);
  });

  it('ranks critical, high, moderate, an unknown word, then unrated; the tone of anything unknown is unrated (R6)', () => {
    const words = ['unrated', 'moderate', 'extreme', 'high', 'critical'];
    expect([...words].sort((x, y) => severityRank(x) - severityRank(y))).toEqual(['critical', 'high', 'moderate', 'extreme', 'unrated']);
    expect(severityRank('constructor')).toBe(severityRank('extreme'));
    expect(['critical', 'high', 'moderate', 'unrated', '<img src=x>', 'toString'].map((s) => severityTone(s)))
      .toEqual(['critical', 'high', 'moderate', 'unrated', 'unrated', 'unrated']);
  });

  it('exports the rule, status, reason and fallow provenance; an unknown line is an empty cell with its state', () => {
    const f = model().findings[0]!;
    const bom = String.fromCharCode(0xFEFF);
    const [header, row] = findingsCsv([{ ...f, status: 'dismissed', reason: '=cmd' }], evidence).replace(bom, '').split('\r\n');
    expect(header).toBe('id,path,module,kind,rule,severity,line,line_state,status,reason,provenance');
    expect(row).toContain(",reported,dismissed,'=cmd,fallow 3.27.0 imported");
    expect(findingsCsv([{ ...f, line: null }], evidence).split('\r\n')[1]).toContain(',,unknown,');
    const stale = evidenceIndexFor(files, syntheticEvidenceReport(snap, { snapshotId: 'an-older-snapshot' }), snap.snapshotId);
    expect(findingsCsv([f], stale)).toContain('fallow 3.27.0 stale');
  });
});
