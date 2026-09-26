// WP-04 IN1-IN3, IN33/IN34/IN36 (IP4, IP19): the Investigate list's read model — Quality's
// findings, sorted by a total order, filtered by query/Type/Rule/Severity/Status/Note, and
// carrying each row's notes (found by the portable fingerprint) plus the orphaned ones.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, syntheticFallowJson } from '../fixtures/evidence-report';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { buildQualityModel, type QualityFinding, type QualityModel } from '../../src/ui/read-models/findings';
import { findingRef } from '../../src/ui/read-models/review-state';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { EMPTY_NOTE_INDEX, type NoteIndex, type NoteLink } from '../../src/application/investigation/note-index';
import { buildInvestigationModel, DEFAULT_INVESTIGATION_FILTER, filterInvestigation } from '../../src/ui/read-models/investigation';

const byUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const CATEGORY_RANK = new Map(['complexity', 'duplication', 'unused-exports', 'cycle', 'boundary', 'unresolved-import'].map((c, i) => [c, i]));
// oxlint's unicorn/no-array-reverse fires on `.reverse()` even on a fresh copy: maps each
// index to its mirror in a NEW array instead (layout-determinism.test.ts's own pattern).
function toReversedArray<T>(arr: readonly T[]): T[] {
  return arr.map((_, i) => arr[arr.length - 1 - i]!);
}

function setup(fileCount: number) {
  const snap = buildSnapshotFixture({ files: fileCount });
  const files = fileSummariesFor(snap);
  const report = attachSyntheticReport(snap);
  const evidence = evidenceIndexFor(files, report, snap.snapshotId);
  const quality = buildQualityModel(files, evidence, []);
  return { snap, files, report, evidence, quality };
}

const link = (over: Partial<NoteLink> = {}): NoteLink => ({
  path: 'notes/x.md', codebaseId: 'p1', fingerprint: 'x.ts#UN-1', findingId: 'UN-1', sourcePath: 'x.ts', snapshotId: 's1', status: 'open', ...over,
});

describe('buildInvestigationModel — list source (IN1)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('lists exactly Quality’s findings, as a set', () => {
    const { quality } = setup(8);
    const m = buildInvestigationModel(quality, EMPTY_NOTE_INDEX);
    expect(m.rows.length).toBeGreaterThan(0);
    expect(m.rows).toHaveLength(quality.findings.length);
    expect(new Set(m.rows.map((r) => r.fingerprint))).toEqual(new Set(quality.findings.map((f) => f.fingerprint)));
    expect(m.evidence).toBe(quality.evidence);
    expect(m.severities).toBe(quality.severities);
  });
});

describe('buildInvestigationModel — order (IN3)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('reads critical, high, moderate, an unlisted word, then unrated, in that order', () => {
    const snap = buildSnapshotFixture({ files: 8 });
    const files = fileSummariesFor(snap);
    const json = JSON.parse(syntheticFallowJson(snap)) as { health: { findings: { severity: string }[] } };
    expect(json.health.findings.length).toBeGreaterThan(3);
    json.health.findings[3]!.severity = 'urgent';
    const parsed = parseFallowReportText(JSON.stringify(json));
    if (!parsed.ok) throw new Error(`test setup: the report was refused (${parsed.code} ${parsed.detail})`);
    const report = buildEvidenceReport({
      raw: parsed.report, fileName: 'order.json', importedAt: '2026-09-24T00:00:00.000Z', snapshotId: snap.snapshotId, stripPrefix: null,
    });
    const evidence = evidenceIndexFor(files, report, snap.snapshotId);
    const quality = buildQualityModel(files, evidence, []);
    const m = buildInvestigationModel(quality, EMPTY_NOTE_INDEX);
    expect(m.rows.length).toBeGreaterThan(0);

    const distinctSeverities = [...new Set(m.rows.map((r) => r.severity))];
    expect(distinctSeverities).toEqual(['critical', 'high', 'moderate', 'urgent', 'unrated']);

    // Two categories share the unrated rank here (duplication and unused-exports, at
    // least): within it, category order holds, and within one category, path is
    // ascending (J3 code-unit).
    const unrated = m.rows.filter((r) => r.severity === 'unrated');
    expect(unrated.length).toBeGreaterThan(1);
    const categoryRanks = unrated.map((r) => CATEGORY_RANK.get(r.kind) ?? Number.MAX_SAFE_INTEGER);
    expect(categoryRanks).toEqual([...categoryRanks].sort((a, b) => a - b));
    let sawTwoOfSameCategory = false;
    for (let i = 1; i < unrated.length; i += 1) {
      if (unrated[i]!.kind === unrated[i - 1]!.kind) {
        sawTwoOfSameCategory = true;
        expect(byUnit(unrated[i - 1]!.file.path, unrated[i]!.file.path)).toBeLessThanOrEqual(0);
      }
    }
    expect(sawTwoOfSameCategory).toBe(true);

    // A total order: shuffling the input findings never changes the output order.
    const shuffledFindings: readonly QualityFinding[] = toReversedArray(quality.findings);
    const shuffledQuality: QualityModel = { ...quality, findings: shuffledFindings, byFingerprint: new Map(shuffledFindings.map((f) => [f.fingerprint, f])) };
    const shuffled = buildInvestigationModel(shuffledQuality, EMPTY_NOTE_INDEX);
    expect(shuffled.rows.map((r) => r.fingerprint)).toEqual(m.rows.map((r) => r.fingerprint));
  });
});

describe('buildInvestigationModel — order tie-breaks (IN3, fix round 1 review item 1)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('sorts a shared severity/kind/path group by line — no line last — then id in code-unit order', () => {
    const { quality } = setup(4);
    expect(quality.findings.length).toBeGreaterThan(0);
    const base = quality.findings[0]!;
    const mk = (id: string, line: number | null): QualityFinding => ({ ...base, id, line, fingerprint: `${base.file.id}#${id}` });
    // Same severity, kind and path (all copied from `base`) for every row, so only line and
    // id can break the tie. Deliberately out of order, with the two line-4 rows given in
    // id-descending input order, so a missing id tie-break (a stable sort keeping input
    // order) or wrong null-handling would show up as a wrong output order.
    const rows: QualityFinding[] = [mk('id-line5', 5), mk('id-null', null), mk('id-line3', 3), mk('id-b', 4), mk('id-a', 4)];
    const tieBreakQuality: QualityModel = { ...quality, findings: rows, byFingerprint: new Map(rows.map((f) => [f.fingerprint, f])) };
    const m = buildInvestigationModel(tieBreakQuality, EMPTY_NOTE_INDEX);
    expect(m.rows.map((r) => r.id)).toEqual(['id-line3', 'id-a', 'id-b', 'id-line5', 'id-null']);
  });
});

describe('buildInvestigationModel — memoisation (fix round 1 review item 12)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('returns the same object for the same (quality, notes) pair, and a different one for a different NoteIndex', () => {
    const { quality } = setup(4);
    const a = buildInvestigationModel(quality, EMPTY_NOTE_INDEX);
    const b = buildInvestigationModel(quality, EMPTY_NOTE_INDEX);
    expect(b).toBe(a);
    const otherNotes: NoteIndex = { byFingerprint: new Map(), malformed: 0 };
    const c = buildInvestigationModel(quality, otherNotes);
    expect(c).not.toBe(a);
    expect(c.rows).not.toBe(a.rows);
  });
});

describe('filterInvestigation (IN2, IP19)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('narrows by kind, rule, severity, status and query; rules are the present ones, code-unit sorted', () => {
    const { quality } = setup(8);
    const m = buildInvestigationModel(quality, EMPTY_NOTE_INDEX);
    expect(m.rows.length).toBeGreaterThan(0);
    const [row] = m.rows;

    const byKind = filterInvestigation(m.rows, { ...DEFAULT_INVESTIGATION_FILTER, kind: row!.kind });
    expect(byKind.length).toBeGreaterThan(0);
    expect(byKind.every((r) => r.kind === row!.kind)).toBe(true);

    const byRule = filterInvestigation(m.rows, { ...DEFAULT_INVESTIGATION_FILTER, rule: row!.rule });
    expect(byRule.length).toBeGreaterThan(0);
    expect(byRule.every((r) => r.rule === row!.rule)).toBe(true);

    const bySeverity = filterInvestigation(m.rows, { ...DEFAULT_INVESTIGATION_FILTER, severity: row!.severity });
    expect(bySeverity.length).toBeGreaterThan(0);
    expect(bySeverity.every((r) => r.severity === row!.severity)).toBe(true);

    const query = row!.file.path.slice(0, 5).toLowerCase();
    const byQuery = filterInvestigation(m.rows, { ...DEFAULT_INVESTIGATION_FILTER, query });
    expect(byQuery.length).toBeGreaterThan(0);
    expect(byQuery.every((r) => r.file.path.toLowerCase().includes(query))).toBe(true);
    expect(filterInvestigation(m.rows, { ...DEFAULT_INVESTIGATION_FILTER, query: 'no-such-thing-here' })).toHaveLength(0);

    expect(m.rules.length).toBeGreaterThan(0);
    const expectedRules = [...new Set(m.rows.map((r) => r.rule))].sort(byUnit);
    expect(m.rules).toEqual(expectedRules);
  });

  // Fix round 1, review item 11: the earlier status assertions used no dispositions, so
  // 'dismissed' returning 0 rows proved only that the fixture has no dismissed findings,
  // never that the filter narrows. A real disposition makes one row non-open.
  it('status filter narrows once a disposition changes a row', () => {
    const { files, evidence, quality } = setup(8);
    const target = quality.findings[0]!;
    const withDisposition = buildQualityModel(files, evidence, [{ fingerprint: target.fingerprint, status: 'dismissed', decidedAt: '2026-09-24T00:00:00.000Z' }]);
    const m = buildInvestigationModel(withDisposition, EMPTY_NOTE_INDEX);
    expect(m.rows.length).toBeGreaterThan(1);

    const openOnly = filterInvestigation(m.rows, { ...DEFAULT_INVESTIGATION_FILTER, status: 'open' });
    expect(openOnly.length).toBeGreaterThan(0);
    expect(openOnly.every((r) => r.status === 'open')).toBe(true);
    expect(openOnly.some((r) => r.fingerprint === target.fingerprint)).toBe(false);

    const dismissedOnly = filterInvestigation(m.rows, { ...DEFAULT_INVESTIGATION_FILTER, status: 'dismissed' });
    expect(dismissedOnly).toHaveLength(1);
    expect(dismissedOnly[0]!.fingerprint).toBe(target.fingerprint);

    expect(filterInvestigation(m.rows, { ...DEFAULT_INVESTIGATION_FILTER, status: 'all' })).toHaveLength(m.rows.length);
  });

  it('note filter narrows to with-note / without-note', () => {
    const { quality } = setup(4);
    expect(quality.findings.length).toBeGreaterThan(0);
    const [target] = quality.findings;
    const portable = findingRef(target!.fingerprint)!;
    const notes: NoteIndex = { byFingerprint: new Map([[portable, [link({ fingerprint: portable, findingId: target!.id, sourcePath: target!.file.path })]]]), malformed: 0 };
    const m = buildInvestigationModel(quality, notes);
    const withNote = filterInvestigation(m.rows, { ...DEFAULT_INVESTIGATION_FILTER, note: 'with-note' });
    expect(withNote).toHaveLength(1);
    expect(withNote[0]!.fingerprint).toBe(target!.fingerprint);
    const withoutNote = filterInvestigation(m.rows, { ...DEFAULT_INVESTIGATION_FILTER, note: 'without-note' });
    expect(withoutNote).toHaveLength(m.rows.length - 1);
    expect(filterInvestigation(m.rows, { ...DEFAULT_INVESTIGATION_FILTER, note: 'all' })).toHaveLength(m.rows.length);
  });
});

describe('buildInvestigationModel — notes (IN33, IN34, IN36)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('attaches a row’s notes by portable fingerprint, counts them, lists the orphan by path, and passes malformed through', () => {
    const { quality } = setup(4);
    expect(quality.findings.length).toBeGreaterThan(0);
    const [target] = quality.findings;
    const portable = findingRef(target!.fingerprint)!;
    const linked = link({ fingerprint: portable, findingId: target!.id, sourcePath: target!.file.path, path: 'notes/linked.md' });
    const orphan = link({ fingerprint: 'gone.ts#UN-99999999', findingId: 'UN-99999999', sourcePath: 'gone.ts', path: 'notes/gone.md', status: null });
    const notes: NoteIndex = {
      byFingerprint: new Map([[portable, [linked]], ['gone.ts#UN-99999999', [orphan]]]),
      malformed: 3,
    };
    const m = buildInvestigationModel(quality, notes);
    const row = m.byFingerprint.get(target!.fingerprint);
    expect(row).toBeDefined();
    expect(row!.notes).toEqual([linked]);
    expect(m.withNotes).toBe(1);
    expect(m.orphanNotes).toEqual([orphan]);
    expect(m.malformedNotes).toBe(3);
  });
});
