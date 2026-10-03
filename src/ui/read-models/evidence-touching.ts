// WP-03 N12: grouping a report's findings by file, split out of evidence-index.ts to keep
// it under its size cap. `byFile` keeps Part 6 Y26's anchor-only meaning (every existing
// consumer still counts a finding once); `touching` additionally lists a finding under
// each matched related file, so a cycle or a boundary violation shows, and paints, on
// every file it involves, never twice under the same file.
import type { EntityId } from '../../domain/entity-id';
import type { EvidenceFinding } from '../../application/evidence/model';
import { resolveFindings } from '../../application/evidence/resolve-findings';
import type { FileSummary } from './file-summaries';

export interface TouchingFinding { readonly finding: EvidenceFinding; readonly anchorId: EntityId }

function addTouch(touching: Map<EntityId, TouchingFinding[]>, id: EntityId, entry: TouchingFinding): void {
  const list = touching.get(id);
  if (list) list.push(entry); else touching.set(id, [entry]);
}

/** Y26/N12: a finding whose anchor path is not in the snapshot never reaches a file (its
 *  path is listed as unmatched); a related path that does not match is also listed, but
 *  never drops the finding itself (the anchor rule is unchanged). */
export function groupByFile(files: readonly FileSummary[], findings: readonly EvidenceFinding[]): {
  byFile: Map<EntityId, EvidenceFinding[]>; touching: Map<EntityId, TouchingFinding[]>; unmatchedPaths: readonly string[];
} {
  const byPath = new Map<string, EntityId>(files.map((f) => [f.path, f.id]));
  const { matched, unmatchedPaths } = resolveFindings(findings, new Set(byPath.keys()));
  const byFile = new Map<EntityId, EvidenceFinding[]>();
  const touching = new Map<EntityId, TouchingFinding[]>();
  for (const f of matched) {
    const anchorId = byPath.get(f.path);
    if (anchorId === undefined) continue;
    const list = byFile.get(anchorId);
    if (list) list.push(f); else byFile.set(anchorId, [f]);
    // The anchor first, then each matched related file's id, never the same file twice.
    const targets = new Set<EntityId>([anchorId]);
    for (const related of f.related ?? []) {
      const relatedId = byPath.get(related);
      if (relatedId !== undefined) targets.add(relatedId);
    }
    for (const id of targets) addTouch(touching, id, { finding: f, anchorId });
  }
  return { byFile, touching, unmatchedPaths };
}
