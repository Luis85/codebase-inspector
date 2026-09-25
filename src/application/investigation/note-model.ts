// WP-04 IN20/IN22/IN25 (IP3, IP4, IP6): the note's frontmatter shape and the generated
// evidence block. Headings, prompts and labels arrive as a NoteVocabulary argument — this
// module holds no copy of its own (IP3); the real words live in
// src/ui/audit-copy/investigation.ts. Every dynamic value is escaped through note-text.ts;
// the block renders through a shrink ladder so it always stays at or under
// EVIDENCE_BLOCK_MAX_BYTES (IP6).
import { noteCode, noteText } from './note-text';

// IPF1: module-private — nothing outside this file names the type discriminant directly yet;
// a reader (Task 5, IP13) compares its own parsed value against the literal
// 'codebase-investigation'. Exported the moment a second src module needs to name it.
const NOTE_TYPE = 'codebase-investigation';
export const EVIDENCE_BEGIN = '<!-- codebase-inspector:evidence:begin -->';
export const EVIDENCE_END = '<!-- codebase-inspector:evidence:end -->';
// IPF1: module-private — no consumer outside this file needs the cap as a number; tests use
// the literal 16 * 1024.
const EVIDENCE_BLOCK_MAX_BYTES = 16 * 1024;
const EVIDENCE_LIST_MAX = 50;

export interface NoteIdentity {
  readonly codebaseId: string;
  readonly sourcePath: string;
  readonly snapshotId: string;
  readonly findingId: string;
}

// IPF1: module-private — noteFrontmatter's caller (Task 9) consumes the returned object
// structurally, never by naming this type.
interface NoteFrontmatter {
  readonly type: typeof NOTE_TYPE;
  readonly codebase_id: string;
  readonly entity_id: string;
  readonly source_path: string;
  readonly snapshot_id: string;
  readonly finding_id: string;
  readonly finding_fingerprint: string;
  readonly provider: 'fallow';
  readonly status: 'open';
  readonly created: string;
}

// IPF1: module-private — its result is read back only through noteFrontmatter's
// finding_fingerprint field.
function portableFingerprint(sourcePath: string, findingId: string): string {
  return `${sourcePath}#${findingId}`;
}

/** IN20: the ten frontmatter keys, in order. Portable ids only (IP4) — never a machine root,
 *  an absolute path or a NUL-joined in-memory id. */
export function noteFrontmatter(identity: NoteIdentity, createdIso: string): NoteFrontmatter {
  return {
    type: NOTE_TYPE,
    codebase_id: identity.codebaseId,
    entity_id: `file:${identity.sourcePath}`,
    source_path: identity.sourcePath,
    snapshot_id: identity.snapshotId,
    finding_id: identity.findingId,
    finding_fingerprint: portableFingerprint(identity.sourcePath, identity.findingId),
    provider: 'fallow',
    status: 'open',
    created: createdIso,
  };
}

/** IP23: the finding, its source, scope, time and uncertainties — never the review
 *  disposition or the file's work items. */
export type EvidenceFacts =
  | {
    readonly reported: true; readonly findingId: string; readonly title: string; readonly kindLabel: string;
    readonly ruleText: string; readonly ruleDetail: string; readonly severityText: string; readonly sourcePath: string;
    readonly line: number | null; readonly endLine: number | null; readonly related: readonly string[];
    readonly cyclePath: readonly string[]; readonly provider: string; readonly analysedAt: string;
    readonly snapshotId: string; readonly evidenceState: string; readonly uncertainties: readonly string[];
  }
  | {
    readonly reported: false; readonly findingId: string; readonly sourcePath: string; readonly provider: string;
    readonly analysedAt: string; readonly snapshotId: string; readonly uncertainties: readonly string[];
  };

export interface NoteVocabulary {
  readonly headings: {
    readonly context: string; readonly observed: string; readonly source: string; readonly uncertainties: string;
    readonly notes: string; readonly proposed: string; readonly checklist: string; readonly decision: string;
  };
  readonly prompts: { readonly notes: string; readonly proposed: string; readonly decision: string };
  readonly labels: {
    readonly finding: string; readonly kind: string; readonly rule: string; readonly detail: string;
    readonly severity: string; readonly location: string; readonly related: string; readonly cyclePath: string;
    readonly provider: string; readonly analysed: string; readonly snapshot: string; readonly evidence: string;
    readonly notReported: string; readonly line: (line: number | null, endLine: number | null) => string;
    readonly more: (hidden: number) => string;
  };
}

// IP6: each step is (list entries shown, code points per value); the first result at or
// under EVIDENCE_BLOCK_MAX_BYTES wins, and the last step is within the bound for any input.
const SHRINK: readonly (readonly [list: number, value: number])[] = [[EVIDENCE_LIST_MAX, 256], [20, 256], [5, 128], [0, 64]];

function utf8Length(s: string): number {
  let n = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return n;
}

function headingLine(text: string): string {
  return `## ${text}`;
}

// Every label word is our own copy, but still goes through noteText (only the headings and
// the italic human prompts are raw).
function label(word: string): string {
  return noteText(word);
}

function listLines(groupLabel: string, items: readonly string[], list: number, value: number, more: (hidden: number) => string): string[] {
  if (items.length === 0) return [];
  const shown = items.slice(0, list);
  const hidden = items.length - shown.length;
  const out = [`- ${groupLabel}:`, ...shown.map((item) => `  - ${noteCode(item, value * 2)}`)];
  if (hidden > 0) out.push(`  - ${label(more(hidden))}`);
  return out;
}

function blockLines(facts: EvidenceFacts, words: NoteVocabulary, list: number, value: number): string[] {
  const lines: string[] = [EVIDENCE_BEGIN, headingLine(words.headings.context)];
  lines.push(facts.reported ? noteText(facts.title, value) : label(words.labels.notReported));
  lines.push('', headingLine(words.headings.observed));
  lines.push(`- ${label(words.labels.finding)}: ${noteCode(facts.findingId, value * 2)}`);
  if (facts.reported) {
    lines.push(`- ${label(words.labels.kind)}: ${noteText(facts.kindLabel, value)}`);
    lines.push(`- ${label(words.labels.rule)}: ${noteText(facts.ruleText, value)}`);
    lines.push(`- ${label(words.labels.detail)}: ${noteText(facts.ruleDetail, value)}`);
    lines.push(`- ${label(words.labels.severity)}: ${noteText(facts.severityText, value)}`);
  }
  const lineSuffix = facts.reported ? ` · ${label(words.labels.line(facts.line, facts.endLine))}` : '';
  lines.push(`- ${label(words.labels.location)}: ${noteCode(facts.sourcePath, value * 2)}${lineSuffix}`);
  if (facts.reported) {
    lines.push(...listLines(label(words.labels.related), facts.related, list, value, words.labels.more));
    lines.push(...listLines(label(words.labels.cyclePath), facts.cyclePath, list, value, words.labels.more));
  }
  lines.push('', headingLine(words.headings.source));
  lines.push(`- ${label(words.labels.provider)}: ${noteText(facts.provider, value)}`);
  lines.push(`- ${label(words.labels.analysed)}: ${noteText(facts.analysedAt, value)}`);
  lines.push(`- ${label(words.labels.snapshot)}: ${noteCode(facts.snapshotId, value * 2)}`);
  lines.push(`- ${label(words.labels.evidence)}: ${facts.reported ? noteText(facts.evidenceState, value) : label(words.labels.notReported)}`);
  lines.push('', headingLine(words.headings.uncertainties));
  for (const u of facts.uncertainties) lines.push(`- ${noteText(u, value)}`);
  lines.push(EVIDENCE_END);
  return lines;
}

/** IN23/IN25: both markers, always ≤ EVIDENCE_BLOCK_MAX_BYTES UTF-8 (IP6's shrink ladder). */
export function renderEvidenceBlock(facts: EvidenceFacts, words: NoteVocabulary): string {
  let block = '';
  for (const [list, value] of SHRINK) {
    block = blockLines(facts, words, list, value).join('\n');
    if (utf8Length(block) <= EVIDENCE_BLOCK_MAX_BYTES) return block;
  }
  return block; // [0, 64] is within the bound for any input: pinned by the size test
}

function humanSection(heading: string, prompt: string): string[] {
  return [headingLine(heading), `_${prompt}_`];
}

/** IN22: the block, then the four human sections, each seeded once with its italic prompt. */
export function renderNoteBody(facts: EvidenceFacts, checklist: readonly string[], words: NoteVocabulary): string {
  const lines: string[] = [renderEvidenceBlock(facts, words), ''];
  lines.push(...humanSection(words.headings.notes, words.prompts.notes), '');
  lines.push(...humanSection(words.headings.proposed, words.prompts.proposed), '');
  lines.push(headingLine(words.headings.checklist));
  for (const item of checklist) lines.push(`- [ ] ${noteText(item)}`);
  lines.push('');
  lines.push(...humanSection(words.headings.decision, words.prompts.decision));
  return lines.join('\n');
}
