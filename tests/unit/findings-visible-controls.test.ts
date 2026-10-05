// Gap closure GRB17a (E30): a finding's symbol and the display strings inside its detail show
// bidi/control code points as \uXXXX escapes, like the source preview; the title and the
// dialog's rule value built from them are escaped too; search still matches the raw text.
import { describe, expect, it } from 'vitest';
import type { EvidenceFinding, FindingDetail } from '../../src/application/evidence/model';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor, type FileSummary } from '../../src/ui/read-models/file-summaries';
import { buildQualityModel, filterFindings, DEFAULT_QUALITY_FILTER, touchingFindings } from '../../src/ui/read-models/findings';
import { FINDING_DIALOG_RULE_VALUE } from '../../src/ui/audit-copy/quality';
import { rawReport } from '../fixtures/fallow-fixture';
import { snapshotWithPaths } from '../fixtures/evidence-report';

const RLO = String.fromCharCode(0x202E);
const FSI = String.fromCharCode(0x2066);
const PATHS = [
  'src/core/a.ts', 'src/core/b.ts', 'src/core/c.ts', 'src/barrel/index.ts', 'src/barrel/x.ts', 'src/barrel/y.ts',
  'src/ui/view.ts', 'src/data/db.ts', 'src/data/types.ts', 'src/index.ts', 'src/orphan.ts',
];
const snapshot = snapshotWithPaths(PATHS, 'repo-controls');
const files = fileSummariesFor(snapshot);
const at = (path: string): FileSummary => files.find((f) => f.path === path)!;
const base = buildEvidenceReport({
  raw: rawReport('relations-combined-3.27.0'), fileName: 'relations.json', importedAt: '2026-09-24T10:00:00.000Z',
  snapshotId: snapshot.snapshotId, stripPrefix: null,
});

const boundary = base.normalized.findings.find((f) => f.category === 'boundary')!;
const cycle = base.normalized.findings.find((f) => f.category === 'cycle' && f.detail.kind === 'cycle' && f.detail.cycleKind === 'import')!;
const unresolved = base.normalized.findings.find((f) => f.category === 'unresolved-import')!;

function hostile(f: EvidenceFinding): EvidenceFinding {
  const d = f.detail;
  let detail: FindingDetail = d;
  if (d.kind === 'boundary') detail = { ...d, specifier: `./x${FSI}y`, toPath: `src/data/d${FSI}b.ts`, fromZone: `ui${FSI}`, toZone: `data${FSI}` };
  if (d.kind === 'cycle') detail = { ...d, members: d.members.map((m) => `${m}${FSI}`), hops: d.hops.map((h) => ({ ...h, from: `${h.from}${FSI}`, to: `${h.to}${FSI}` })) };
  if (d.kind === 'unresolved-import') detail = { ...d, specifier: `./gone${FSI}` };
  return { ...f, symbol: `sym${RLO}bol`, detail };
}
const report = {
  ...base,
  normalized: { ...base.normalized, findings: base.normalized.findings.map((f) => (f === boundary || f === cycle || f === unresolved ? hostile(f) : f)) },
};
const index = evidenceIndexFor(files, report, snapshot.snapshotId);
const rowFor = (f: EvidenceFinding) => touchingFindings(at(f.path), index).find((r) => r.id === f.id)!;

describe('touchingFindings escapes controls in finding text (GRB17a)', () => {
  it('escapes a U+202E in the symbol, and builds the title from the escaped symbol', () => {
    const row = rowFor(boundary);
    expect(row.symbol).toBe('sym\\u202Ebol');
    expect(row.title.startsWith('sym\\u202Ebol · ')).toBe(true);
    expect(row.title).not.toContain(RLO);
  });

  it('escapes a U+2066 in a boundary specifier, toPath and zones, and in the title', () => {
    const row = rowFor(boundary);
    if (row.detail.kind !== 'boundary') throw new Error('expected a boundary detail');
    expect(row.detail.specifier).toBe('./x\\u2066y');
    expect(row.detail.toPath).toBe('src/data/d\\u2066b.ts');
    expect(row.detail.fromZone).toBe('ui\\u2066');
    expect(row.title).toContain('ui\\u2066 → data\\u2066');
    expect(row.title).not.toContain(FSI);
  });

  it('escapes an unresolved-import specifier in the title', () => {
    const row = rowFor(unresolved);
    expect(row.title).toContain('./gone\\u2066');
    expect(row.title).not.toContain(FSI);
  });

  it('escapes cycle members and every hop from/to', () => {
    const row = rowFor(cycle);
    if (row.detail.kind !== 'cycle') throw new Error('expected a cycle detail');
    expect(row.detail.members.length).toBeGreaterThan(0);
    expect(row.detail.members.every((m) => m.endsWith('\\u2066'))).toBe(true);
    expect(row.detail.hops.length).toBeGreaterThan(0);
    expect(row.detail.hops.every((h) => h.from.endsWith('\\u2066') && h.to.endsWith('\\u2066'))).toBe(true);
  });

  it('shows no raw control code point in the dialog rule value', () => {
    const row = rowFor(boundary);
    const text = FINDING_DIALOG_RULE_VALUE(row.rule, row.detail);
    expect(text).toContain('src/data/d\\u2066b.ts');
    expect(text).toContain('ui\\u2066 → data\\u2066');
    expect(text).not.toContain(FSI);
    const unresolvedText = FINDING_DIALOG_RULE_VALUE(rowFor(unresolved).rule, rowFor(unresolved).detail);
    expect(unresolvedText).toContain('./gone\\u2066');
  });

  it('leaves plain text, a null symbol and non-text detail unchanged (control)', () => {
    const plain = touchingFindings(at(base.normalized.findings.find((f) => f.category === 'unused-exports')!.path), evidenceIndexFor(files, base, snapshot.snapshotId));
    const original = base.normalized.findings.find((f) => f.category === 'unused-exports')!;
    const row = plain.find((r) => r.id === original.id)!;
    expect(row.symbol).toBe(original.symbol);
    expect(row.detail).toEqual(original.detail);
    const plainBoundary = touchingFindings(at(boundary.path), evidenceIndexFor(files, base, snapshot.snapshotId)).find((r) => r.id === boundary.id)!;
    expect(plainBoundary.detail).toEqual(boundary.detail);
    expect(plainBoundary.symbol).toBe(boundary.symbol);
  });

  it('search still matches the raw text typed with the control character', () => {
    const model = buildQualityModel(files, index, []);
    const all = { ...DEFAULT_QUALITY_FILTER, status: 'all' as const };
    const hit = filterFindings(model.findings, { ...all, query: `sym${RLO}bol` });
    expect(hit.map((f) => f.id)).toContain(boundary.id);
    expect(hit.every((f) => f.symbol === 'sym\\u202Ebol')).toBe(true);
    expect(filterFindings(model.findings, { ...all, query: `nosuch${RLO}` })).toHaveLength(0);
  });
});
