import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_BEGIN, EVIDENCE_END, noteFrontmatter, renderEvidenceBlock, renderNoteBody,
} from '../../src/application/investigation/note-model';
import type { EvidenceFacts, NoteVocabulary } from '../../src/application/investigation/note-model';
import { isEvidenceBlock } from '../../src/application/investigation/evidence-block';

// IPF1: EVIDENCE_BLOCK_MAX_BYTES, EVIDENCE_LIST_MAX, portableFingerprint and NoteFrontmatter
// are module-private. Tests use the literals below instead of importing them.
const EVIDENCE_BLOCK_MAX_BYTES = 16 * 1024;

// Step 1: plain words, built once and reused by every case (IP3 — the application layer
// holds no copy of its own; this literal stands in for src/ui/audit-copy/investigation.ts).
const WORDS: NoteVocabulary = {
  headings: {
    context: 'Context',
    observed: 'Observed finding',
    source: 'Source, scope and time',
    uncertainties: 'Uncertainties',
    notes: 'Investigation notes',
    proposed: 'Proposed change',
    checklist: 'Verification checklist',
    decision: 'Decision',
  },
  prompts: {
    notes: 'What did you find?',
    proposed: 'What would you change?',
    decision: 'What was decided?',
  },
  labels: {
    finding: 'Finding',
    kind: 'Kind',
    rule: 'Rule',
    detail: 'Detail',
    severity: 'Severity',
    location: 'Location',
    related: 'Related',
    cyclePath: 'Cycle path',
    provider: 'Provider',
    analysed: 'Analysed at',
    snapshot: 'Snapshot',
    evidence: 'Evidence',
    notReported: 'Not reported in the current scan',
    line: (l, e) => (l === null ? 'Line unknown' : e !== null && e !== l ? `Lines ${l}-${e}` : `Line ${l}`),
    more: (n) => `${n} more`,
  },
};

const FACTS: EvidenceFacts = {
  reported: true,
  findingId: 'UN-00000001',
  title: 'Unused export scaleName',
  kindLabel: 'Unused export',
  ruleText: 'no-unused-exports',
  ruleDetail: 'Exported but never imported elsewhere in src.',
  severityText: 'Medium',
  sourcePath: 'src/domain/scale.ts',
  line: 12,
  endLine: 12,
  related: ['src/domain/scale.ts', 'src/ui/screens/ArchitectureScreen.vue'],
  cyclePath: [],
  provider: 'fallow',
  analysedAt: '2026-09-25T10:00:00.000Z',
  snapshotId: 'snapshot:p1:1',
  evidenceState: 'current',
  uncertainties: ['The line was not re-checked against the live file.'],
};

describe('noteFrontmatter (IN20, IP4)', () => {
  it('returns exactly the ten keys, in order, with portable ids', () => {
    const fm = noteFrontmatter(
      { codebaseId: 'p1', sourcePath: 'src/a.ts', snapshotId: 'snapshot:p1:1', findingId: 'UN-00000001' },
      '2026-09-25T10:00:00.000Z',
    );
    expect(fm).toEqual({
      type: 'codebase-investigation',
      codebase_id: 'p1',
      entity_id: 'file:src/a.ts',
      source_path: 'src/a.ts',
      snapshot_id: 'snapshot:p1:1',
      finding_id: 'UN-00000001',
      finding_fingerprint: 'src/a.ts#UN-00000001',
      provider: 'fallow',
      status: 'open',
      created: '2026-09-25T10:00:00.000Z',
    });
    expect(Object.keys(fm)).toEqual([
      'type', 'codebase_id', 'entity_id', 'source_path', 'snapshot_id', 'finding_id',
      'finding_fingerprint', 'provider', 'status', 'created',
    ]);
    const values = Object.values(fm);
    expect(values).toHaveLength(10);
    expect(values.every((v) => typeof v === 'string')).toBe(true);
    expect(values.every((v) => !(v as string).includes('\u0000'))).toBe(true);
  });
});

describe('renderEvidenceBlock / renderNoteBody (IN22)', () => {
  it('has EVIDENCE_BEGIN first, EVIDENCE_END last, and the four generated headings between them in order', () => {
    const block = renderEvidenceBlock(FACTS, WORDS);
    const lines = block.split('\n');
    expect(lines[0]).toBe(EVIDENCE_BEGIN);
    expect(lines[lines.length - 1]).toBe(EVIDENCE_END);
    const headingLines = lines.filter((l) => l.startsWith('## '));
    expect(headingLines).toEqual([
      `## ${WORDS.headings.context}`, `## ${WORDS.headings.observed}`,
      `## ${WORDS.headings.source}`, `## ${WORDS.headings.uncertainties}`,
    ]);
  });

  it('renderNoteBody adds the four human headings, in order, after EVIDENCE_END, and the checklist as "- [ ] " lines', () => {
    const body = renderNoteBody(FACTS, ['Confirm the finding still reproduces', 'Check for a fix upstream'], WORDS);
    const afterBlock = body.slice(body.indexOf(EVIDENCE_END) + EVIDENCE_END.length);
    const headingLines = afterBlock.split('\n').filter((l) => l.startsWith('## '));
    expect(headingLines).toEqual([
      `## ${WORDS.headings.notes}`, `## ${WORDS.headings.proposed}`,
      `## ${WORDS.headings.checklist}`, `## ${WORDS.headings.decision}`,
    ]);
    const checklistLines = body.split('\n').filter((l) => l.startsWith('- [ ] '));
    expect(checklistLines).toEqual(['- [ ] Confirm the finding still reproduces', '- [ ] Check for a fix upstream']);
  });
});

describe('size (IN25, IP6)', () => {
  it('stays at or under EVIDENCE_BLOCK_MAX_BYTES for a pathological finding, and still ends with EVIDENCE_END', () => {
    const big: EvidenceFacts = {
      ...FACTS,
      title: 'x'.repeat(100_000),
      related: Array.from({ length: 5000 }, (_, i) => `${'p'.repeat(1000)}${i}`),
    };
    const block = renderEvidenceBlock(big, WORDS);
    expect(new TextEncoder().encode(block).length).toBeLessThanOrEqual(EVIDENCE_BLOCK_MAX_BYTES);
    expect(block.endsWith(EVIDENCE_END)).toBe(true);
  });

  it('lists exactly 50 of 60 short related paths, then "10 more"', () => {
    const facts: EvidenceFacts = { ...FACTS, related: Array.from({ length: 60 }, (_, i) => `p${i}.ts`) };
    const block = renderEvidenceBlock(facts, WORDS);
    const shown = block.match(/p\d+\.ts/g) ?? [];
    expect(shown.length).toBeGreaterThan(0);
    expect(shown).toHaveLength(50);
    expect(block).toContain(WORDS.labels.more(10));
  });
});

describe('not reported (IN34)', () => {
  it('shows notReported under the context heading and still carries both markers', () => {
    const facts: EvidenceFacts = {
      reported: false,
      findingId: 'UN-00000002',
      sourcePath: 'src/domain/gone.ts',
      provider: 'fallow',
      analysedAt: '2026-09-25T10:00:00.000Z',
      snapshotId: 'snapshot:p1:2',
      uncertainties: ['The finding is not present in the current report.'],
    };
    const block = renderEvidenceBlock(facts, WORDS);
    const lines = block.split('\n');
    expect(lines[0]).toBe(EVIDENCE_BEGIN);
    expect(lines[lines.length - 1]).toBe(EVIDENCE_END);
    const contextIndex = lines.indexOf(`## ${WORDS.headings.context}`);
    expect(contextIndex).toBeGreaterThanOrEqual(0);
    expect(lines[contextIndex + 1]).toBe(WORDS.labels.notReported);
  });
});

describe('injection (Review Focus 2)', () => {
  it('leaves exactly one line equal to each marker, whatever a title or a related path contains', () => {
    const facts: EvidenceFacts = {
      ...FACTS,
      title: EVIDENCE_END,
      related: [`x\n${EVIDENCE_BEGIN}`],
    };
    const block = renderEvidenceBlock(facts, WORDS);
    const lines = block.split('\n');
    expect(lines.filter((l) => l === EVIDENCE_BEGIN)).toHaveLength(1);
    expect(lines.filter((l) => l === EVIDENCE_END)).toHaveLength(1);
    expect(isEvidenceBlock(block)).toBe(true);
  });
});
