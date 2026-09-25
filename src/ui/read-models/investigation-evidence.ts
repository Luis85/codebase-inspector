// WP-04 IN14-IN17, IN34 (IP23, IP41): the selected finding's evidence bundle — kind, rule,
// severity, location, related paths, cycle path, provenance and evidence state — split
// from investigation.ts before either module nears its cap. Also the generated
// uncertainties (IN15), the verification checklist (IN16), and the facts each note's
// evidence block renders from (IP4, IP23): current for a listed finding, "not reported"
// for one a refresh no longer finds (IN34). Never a score, a percentage or an invented
// risk word (IN17), and never a collected report's absolute paths (Y28).
import { originOf, type EvidenceOrigin, type EvidenceReport, type FindingCategory, type RelationHop } from '../../application/evidence/model';
import type { NoteLink } from '../../application/investigation/note-index';
import type { EvidenceFacts, NoteIdentity } from '../../application/investigation/note-model';
import type { LocationVerdict } from '../../application/investigation/stale-location';
import {
  CHECKLIST_BY_KIND, UNCERTAINTY_BY_KIND, UNCERTAINTY_IMPORT_TIME, UNCERTAINTY_LINE_MATCHED, UNCERTAINTY_LINE_NOT_CHECKED,
  UNCERTAINTY_LINE_STALE, UNCERTAINTY_NO_LINE, UNCERTAINTY_NOT_RATED, UNCERTAINTY_REPORT_STALE, UNCERTAINTY_STATIC,
} from '../audit-copy/investigation';
import { FINDING_DIALOG_RULE_VALUE, FINDING_KIND_LABEL, RELATIONS_SCOPE_NOTE, RULE_TEXT, SEVERITY_TEXT } from '../inspector-copy';
import type { EvidenceIndex } from './evidence-index';
import type { FileSummary } from './file-summaries';
import type { InvestigationRow } from './investigation';
import { cyclePathText } from './relations';

export interface EvidenceBundle {
  readonly kindLabel: string; readonly ruleText: string; readonly ruleDetail: string; readonly severityText: string;
  readonly location: string; readonly related: readonly string[]; readonly unmatchedRelated: ReadonlySet<string>;
  readonly cyclePath: string; readonly cycleFiles: readonly string[]; readonly provider: string;
  readonly origin: EvidenceOrigin; readonly analysedAt: string; readonly snapshotId: string;
  readonly state: 'current' | 'stale';
}

/** IN15: the categories whose evidence is only the partial relation graph (RELATIONS_SCOPE_NOTE). */
const RELATION_SCOPED_KINDS: ReadonlySet<FindingCategory> = new Set(['cycle', 'boundary', 'unresolved-import']);

/** N14/N20: the hop path is only for an import cycle — a re-export cycle has no hop order. */
function cycleHops(row: InvestigationRow): readonly RelationHop[] {
  return row.detail.kind === 'cycle' && row.detail.cycleKind === 'import' ? row.detail.hops : [];
}

/** IN10's upper bound: collected.startedAt for a collected report, importedAt otherwise. */
export function analysedAtOf(report: EvidenceReport): string {
  return report.collected?.startedAt ?? report.importedAt;
}

/** IN14: the selected row's evidence, resolved against the current report and files. Null
 *  only when no report is attached — a row's own quality model implies one, but the type
 *  is not narrowed by the caller. */
export function evidenceBundleFor(row: InvestigationRow, evidence: EvidenceIndex, files: readonly FileSummary[]): EvidenceBundle | null {
  const report = evidence.report;
  if (report === null) return null;
  const hops = cycleHops(row);
  const known = new Set(files.map((f) => f.path));
  return {
    kindLabel: FINDING_KIND_LABEL[row.kind],
    ruleText: RULE_TEXT(row.rule),
    ruleDetail: FINDING_DIALOG_RULE_VALUE(row.rule, row.detail),
    severityText: SEVERITY_TEXT(row.severity),
    location: `${row.anchorPath}:${row.line ?? '?'}`,
    related: row.related,
    unmatchedRelated: new Set(row.related.filter((path) => !known.has(path))),
    cyclePath: cyclePathText(hops),
    cycleFiles: hops.map((h) => h.from),
    provider: report.provider,
    origin: originOf(report),
    analysedAt: analysedAtOf(report),
    snapshotId: report.snapshotId,
    state: evidence.state === 'stale' ? 'stale' : 'current',
  };
}

/** IN15: generated factual statements, in this order — static analysis only; the
 *  stale-location verdict (or "not checked" before a preview is read); a stale report; the
 *  partial relation graph for cycle, boundary and unresolved rows; "Not rated" severity; an
 *  imported report's unknown analysis time; the kind's own caveat last. Never a score or an
 *  invented risk (IN17). */
export function uncertaintiesFor(row: InvestigationRow, bundle: EvidenceBundle, verdict: LocationVerdict | null): readonly string[] {
  const out: string[] = [UNCERTAINTY_STATIC];
  if (verdict === null) out.push(UNCERTAINTY_LINE_NOT_CHECKED);
  else if (verdict.exact) out.push(UNCERTAINTY_LINE_MATCHED(verdict.line));
  else if (verdict.failed === 'no-line') out.push(UNCERTAINTY_NO_LINE);
  else out.push(UNCERTAINTY_LINE_STALE(verdict.failed, verdict.cause, row.line));
  if (bundle.state === 'stale') out.push(UNCERTAINTY_REPORT_STALE);
  if (RELATION_SCOPED_KINDS.has(row.kind)) out.push(RELATIONS_SCOPE_NOTE);
  if (row.severity === 'unrated') out.push(UNCERTAINTY_NOT_RATED);
  if (bundle.origin === 'imported') out.push(UNCERTAINTY_IMPORT_TIME);
  out.push(UNCERTAINTY_BY_KIND[row.kind]);
  return out;
}

/** IN16: 2-4 suggested checks per category, seeding the note's checklist at creation. */
export function checklistFor(kind: FindingCategory): readonly string[] {
  return CHECKLIST_BY_KIND[kind];
}

/** IN20/IP4: the note's identity — the row's own anchor path, never a machine root or a
 *  NUL-joined in-memory id. */
export function noteIdentityFor(row: InvestigationRow, codebaseId: string, snapshotId: string): NoteIdentity {
  return { codebaseId, sourcePath: row.anchorPath, snapshotId, findingId: row.id };
}

/** IP23: the evidence block's facts for a listed finding — never the review disposition or
 *  the file's work items. */
export function evidenceFactsFor(row: InvestigationRow, bundle: EvidenceBundle, uncertainties: readonly string[]): EvidenceFacts {
  return {
    reported: true,
    findingId: row.id,
    title: row.title,
    kindLabel: bundle.kindLabel,
    ruleText: bundle.ruleText,
    ruleDetail: bundle.ruleDetail,
    severityText: bundle.severityText,
    sourcePath: row.anchorPath,
    line: row.line,
    endLine: row.endLine,
    related: bundle.related,
    cyclePath: bundle.cycleFiles,
    provider: bundle.provider,
    analysedAt: bundle.analysedAt,
    snapshotId: bundle.snapshotId,
    evidenceState: bundle.state,
    uncertainties,
  };
}

/** IN34: a refreshed note for a finding the current report no longer lists — the block's
 *  own "Not reported by the current analysis" label carries that, never a fabricated
 *  location or severity here. */
export function goneFactsFor(link: NoteLink, evidence: EvidenceIndex, snapshotId: string): EvidenceFacts {
  const report = evidence.report;
  const uncertainties: string[] = [UNCERTAINTY_STATIC];
  if (report !== null && originOf(report) === 'imported') uncertainties.push(UNCERTAINTY_IMPORT_TIME);
  return {
    reported: false,
    findingId: link.findingId,
    sourcePath: link.sourcePath,
    provider: report?.provider ?? 'fallow',
    analysedAt: report === null ? '' : analysedAtOf(report),
    snapshotId,
    uncertainties,
  };
}
