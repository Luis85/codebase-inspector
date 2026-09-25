// WP-04 IN14-IN17, IN34 (IP23, IP41): the selected finding's evidence bundle — kind, rule,
// severity, location, related paths, cycle path, provenance and evidence state — split
// from investigation.ts before either module nears its cap. Also the generated
// uncertainties (IN15), the verification checklist (IN16), and the facts each note's
// evidence block renders from (IP4, IP23): current for a listed finding, "not reported"
// for one a refresh no longer finds (IN34). Never a score, a percentage or an invented
// risk word (IN17), and never a collected report's absolute paths (Y28).
import { originOf, type EvidenceOrigin, type EvidenceReport, type FindingCategory, type RelationHop } from '../../application/evidence/model';
import type { EntityId } from '../../domain/entity-id';
import type { CodebaseSnapshot } from '../../domain/model';
import type { NoteLink } from '../../application/investigation/note-index';
import type { EvidenceFacts, NoteIdentity } from '../../application/investigation/note-model';
import type { PreviewRequest, PreviewText } from '../../application/investigation/source-preview';
import type { LocationInputs, LocationVerdict } from '../../application/investigation/stale-location';
import {
  CHECKLIST_BY_KIND, NOTE_ANALYSED_AT_UNKNOWN, NOTE_EVIDENCE_STATE_TEXT, NOTE_PROVIDER_UNKNOWN, UNCERTAINTY_BY_KIND,
  UNCERTAINTY_IMPORT_TIME, UNCERTAINTY_LINE_MATCHED, UNCERTAINTY_LINE_NOT_CHECKED, UNCERTAINTY_LINE_STALE, UNCERTAINTY_NO_LINE,
  UNCERTAINTY_NOT_RATED, UNCERTAINTY_REPORT_FAILED_RUN, UNCERTAINTY_REPORT_STALE, UNCERTAINTY_STATIC,
} from '../audit-copy/investigation';
import { FINDING_DIALOG_RULE_VALUE, FINDING_KIND_LABEL, FINDING_LINE_TEXT, RELATIONS_SCOPE_NOTE, RULE_TEXT, SEVERITY_TEXT } from '../inspector-copy';
import { staleCauseOf, type EvidenceIndex } from './evidence-index';
import type { FileSummary } from './file-summaries';
import { STRUCTURE_CATEGORIES } from './findings';
import type { InvestigationRow } from './investigation';
import { cyclePathText } from './relations';

export interface EvidenceBundle {
  readonly kindLabel: string; readonly ruleText: string; readonly ruleDetail: string; readonly severityText: string;
  readonly location: string; readonly related: readonly string[]; readonly unmatchedRelated: ReadonlySet<string>;
  readonly cyclePath: string; readonly cycleFiles: readonly string[]; readonly provider: string;
  readonly origin: EvidenceOrigin; readonly analysedAt: string; readonly snapshotId: string;
  readonly state: 'current' | 'stale'; readonly staleCause: 'snapshot' | 'failed-run' | null;
}

/** N14/N20: the hop path is only for an import cycle — a re-export cycle has no hop order. */
function cycleHops(row: InvestigationRow): readonly RelationHop[] {
  return row.detail.kind === 'cycle' && row.detail.cycleKind === 'import' ? row.detail.hops : [];
}

/** IN10's upper bound: collected.startedAt for a collected report, importedAt otherwise. */
export function analysedAtOf(report: EvidenceReport): string {
  return report.collected?.startedAt ?? report.importedAt;
}

/** The scan's own observation for one metric on one entity — `measured` with a value,
 *  else null (an `unavailable` observation, or none at all, is as unknown as never having
 *  scanned the file: IN10's checks fail towards stale on either). */
function observedValue(snapshot: CodebaseSnapshot, entityId: EntityId, metricId: 'byte-size' | 'physical-lines'): number | null {
  const obs = snapshot.observations.find((o) => o.entityId === entityId && o.measurement.metricId === metricId);
  return obs !== undefined && obs.status === 'measured' ? obs.value : null;
}

/** IP14 (IN7): the request for the row's anchor file, under the snapshot's OWN root and
 *  byte limit — the service itself re-checks this against the live binding, but the
 *  expected root and limit travel with the request so a reconnected codebase can never
 *  read another folder's file under this finding's path. */
export function previewRequestFor(row: InvestigationRow, snapshot: CodebaseSnapshot): PreviewRequest {
  return {
    codebaseId: snapshot.repositoryId,
    expectedRoot: snapshot.scope.rootPath,
    relativePath: row.anchorPath,
    maxFileBytes: snapshot.scope.maxFileBytes,
    line: row.line,
  };
}

/** IN10 (IP17): the stale-location inputs for the row's anchor entity — `row.file` IS the
 *  anchor (titledFindings, findings.ts, keeps only `anchored` rows), so its own id is the
 *  entity the scan observed. `reportCurrent` is the report's OWN currency (Y30), never the
 *  line verdict's — a stale report still gets its own 'report' check, first in IP17's order. */
export function locationInputsFor(row: InvestigationRow, snapshot: CodebaseSnapshot, evidence: EvidenceIndex, text: PreviewText): LocationInputs {
  return {
    reportCurrent: evidence.state === 'current',
    observedBytes: observedValue(snapshot, row.file.id, 'byte-size'),
    observedLines: observedValue(snapshot, row.file.id, 'physical-lines'),
    currentBytes: text.size,
    currentLines: text.lineCount,
    currentMtimeMs: text.mtimeMs,
    analysedAt: evidence.report === null ? null : analysedAtOf(evidence.report),
    line: row.line,
  };
}

/** IN14: the selected row's evidence, resolved against the current report and files. Null
 *  only when no report is attached — a row's own quality model implies one, but the type
 *  is not narrowed by the caller. */
export function evidenceBundleFor(row: InvestigationRow, evidence: EvidenceIndex, files: readonly FileSummary[]): EvidenceBundle | null {
  const report = evidence.report;
  if (report === null) return null;
  const hops = cycleHops(row);
  const known = new Set(files.map((f) => f.path));
  const state: 'current' | 'stale' = evidence.state === 'stale' ? 'stale' : 'current';
  return {
    kindLabel: FINDING_KIND_LABEL[row.kind],
    ruleText: RULE_TEXT(row.rule),
    ruleDetail: FINDING_DIALOG_RULE_VALUE(row.rule, row.detail),
    severityText: SEVERITY_TEXT(row.severity),
    location: `${row.anchorPath} · ${FINDING_LINE_TEXT(row.line, row.endLine)}`,
    related: row.related,
    unmatchedRelated: new Set(row.related.filter((path) => !known.has(path))),
    cyclePath: cyclePathText(hops),
    cycleFiles: hops.map((h) => h.from),
    provider: report.provider,
    origin: originOf(report),
    analysedAt: analysedAtOf(report),
    snapshotId: report.snapshotId,
    state,
    // WP-04 E10 (fix round 1): a report can be stale because it belongs to another
    // snapshot, OR because it belongs to this one but the run behind it failed
    // (evidence-index.ts build(): `staleReason === undefined ? 'current' : 'stale'`).
    // staleCauseOf tells the two apart so uncertaintiesFor never blames a snapshot
    // mismatch that did not happen.
    staleCause: state === 'stale' ? staleCauseOf(report) : null,
  };
}

/** IN15: generated factual statements, in this order — static analysis only; the
 *  stale-location verdict (or "not checked" before a preview is read, or "no line" when
 *  the finding carries none at all — fix round 1, review item 6); a stale report (its own
 *  words by staleCauseOf, fix round 1, review item 2), unless the line verdict already
 *  named the same stale report (review item 7); the partial relation graph for cycle,
 *  boundary and unresolved rows; "Not rated" severity; an imported report's unknown
 *  analysis time; the kind's own caveat last. Never a score or an invented risk (IN17). */
export function uncertaintiesFor(row: InvestigationRow, bundle: EvidenceBundle, verdict: LocationVerdict | null): readonly string[] {
  const out: string[] = [UNCERTAINTY_STATIC];
  const lineFailedOnReport = verdict !== null && !verdict.exact && verdict.failed === 'report';
  if (row.line === null) out.push(UNCERTAINTY_NO_LINE);
  else if (verdict === null) out.push(UNCERTAINTY_LINE_NOT_CHECKED);
  else if (verdict.exact) out.push(UNCERTAINTY_LINE_MATCHED(verdict.line));
  else if (verdict.failed === 'no-line') out.push(UNCERTAINTY_NO_LINE);
  else out.push(UNCERTAINTY_LINE_STALE(verdict.failed, verdict.cause, row.line));
  // review item 7: the line verdict's own 'report' message already says the report is
  // stale, so the standalone statement below would repeat it.
  if (bundle.state === 'stale' && !lineFailedOnReport) {
    out.push(bundle.staleCause === 'failed-run' ? UNCERTAINTY_REPORT_FAILED_RUN : UNCERTAINTY_REPORT_STALE);
  }
  if (STRUCTURE_CATEGORIES.includes(row.kind)) out.push(RELATIONS_SCOPE_NOTE);
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
    // IN14 (fix round 1, review item 9): the block's own two-word text, never the code
    // word ('current'/'stale') bundle.state carries.
    evidenceState: NOTE_EVIDENCE_STATE_TEXT[bundle.state],
    uncertainties,
  };
}

/** IN34: a refreshed note for a finding the current report no longer lists — the block's
 *  own "Not reported by the current analysis" label carries that, never a fabricated
 *  location or severity here. Fix round 1 (review item 8): with no report attached at all,
 *  `provider`/`analysedAt` read copy words, never a hard-coded 'fallow' guess or a blank
 *  rendered value; with a stale report, the stale uncertainty (its own words by
 *  staleCauseOf) is included, same as a listed finding's. */
export function goneFactsFor(link: NoteLink, evidence: EvidenceIndex, snapshotId: string): EvidenceFacts {
  const report = evidence.report;
  const uncertainties: string[] = [UNCERTAINTY_STATIC];
  if (report !== null) {
    if (originOf(report) === 'imported') uncertainties.push(UNCERTAINTY_IMPORT_TIME);
    if (evidence.state === 'stale') {
      uncertainties.push(staleCauseOf(report) === 'failed-run' ? UNCERTAINTY_REPORT_FAILED_RUN : UNCERTAINTY_REPORT_STALE);
    }
  }
  return {
    reported: false,
    findingId: link.findingId,
    sourcePath: link.sourcePath,
    provider: report === null ? NOTE_PROVIDER_UNKNOWN : report.provider,
    analysedAt: report === null ? NOTE_ANALYSED_AT_UNKNOWN : analysedAtOf(report),
    snapshotId,
    uncertainties,
  };
}
