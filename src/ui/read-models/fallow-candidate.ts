// Part 6 Y26/Y38: what the S14 review step shows for a parsed report, resolved against the
// snapshot on screen. Pure: the dialog calls it again when the mapping checkbox changes,
// and nothing is applied until the user attaches. A read model (Part 6 E20): screens read
// read models, stores and copy only, so this is where the application/evidence edge lives.
import type { EvidenceReport } from '../../application/evidence/model';
import { buildEvidenceReport } from '../../application/evidence/normalize-fallow';
import type { RawFallowReport } from '../../application/evidence/raw-fallow';
import { resolveFindings, suggestStripPrefix } from '../../application/evidence/resolve-findings';

/** E20: the S14 screens reach the evidence layer through this read model only. */
export { FINDING_CATEGORIES, originOf, type EvidenceReport } from '../../application/evidence/model';
export { readFallowReportFile } from '../../application/evidence/read-fallow-report';

/** Y37/Y38: how many unmatched paths are listed; the count is always given. */
export const UNMATCHED_SHOWN = 20;

export interface FallowCandidate { raw: RawFallowReport; fileName: string; importedAt: string; snapshotId: string }
interface FallowReview {
  report: EvidenceReport;
  matchedFindings: number;
  matchedFiles: number;
  unmatchedPaths: readonly string[];
  /** The leading folder the mapping checkbox offers, or null (Y26). */
  suggestion: string | null;
  /** The report has findings and none match, even with the offered mapping (COPY-17). */
  mismatch: boolean;
}

/** Distinct and sorted: the paths the snapshot does not have, plus the paths
 *  normalizeRelativePath refused. Task 6 keeps those apart; Y26 treats them as unmatched. */
export function unmatchedOf(unmatched: readonly string[], report: EvidenceReport): string[] {
  return [...new Set([...unmatched, ...report.normalized.rejectedPaths])].sort((a, b) => a.localeCompare(b));
}

function resolveWith(c: FallowCandidate, snapshotPaths: ReadonlySet<string>, stripPrefix: string | null) {
  const report = buildEvidenceReport({ raw: c.raw, fileName: c.fileName, importedAt: c.importedAt, snapshotId: c.snapshotId, stripPrefix });
  return { report, ...resolveFindings(report.normalized.findings, snapshotPaths) };
}

export function reviewFallowCandidate(c: FallowCandidate, snapshotPaths: ReadonlySet<string>, mapped: boolean): FallowReview {
  const plain = resolveWith(c, snapshotPaths, null);
  const suggestion = plain.unmatchedPaths.length === 0 ? null : suggestStripPrefix(plain.unmatchedPaths, snapshotPaths);
  const withMapping = suggestion === null ? null : resolveWith(c, snapshotPaths, suggestion);
  const chosen = mapped && withMapping ? withMapping : plain;
  const reported = plain.report.normalized.findings.length > 0 || plain.report.normalized.rejectedPaths.length > 0;
  return {
    report: chosen.report,
    matchedFindings: chosen.matched.length,
    matchedFiles: new Set(chosen.matched.map((f) => f.path)).size,
    unmatchedPaths: unmatchedOf(chosen.unmatchedPaths, chosen.report),
    suggestion,
    mismatch: reported && plain.matched.length === 0 && (withMapping === null || withMapping.matched.length === 0),
  };
}
