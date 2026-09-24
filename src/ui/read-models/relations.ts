// WP-03 N5-N8: fallow's path-level dependency evidence (Task 2's createRelationIndex,
// Task 4's RelationEvidence), resolved against this snapshot's files. The evidenced edge
// set is only the hops of reported import cycles and the reported boundary violations
// (N5) — never the import graph. An edge whose path is not a snapshot file is never
// drawn: it is counted in unmatchedEdges, and a cycle with an unresolved member is kept
// (matched: false) with that member's id null (N7).
import type { EntityId } from '../../domain/entity-id';
import { createRelationIndex, type RelationIndex } from '../../domain/relations/graph';
import {
  originOf, type BoundariesState, type RelationHop, type ReportedBoundaryViolation, type ReportedCycle, type ReportedReExportCycle,
} from '../../application/evidence/model';
import { unknown, type MetricValue, type Provenance } from '../evidence';
import { FALLOW_NOT_ANALYSED, FALLOW_PROVENANCE_DETAIL, RELATION_FAN_NOT_SCORED } from '../inspector-copy';
import type { EvidenceIndex, EvidenceIndexState } from './evidence-index';
import { findingFingerprint } from './findings';
import type { FileSummary } from './file-summaries';

export type RelationSource = 'cycle' | 'boundary';
export interface FileRef { readonly path: string; readonly id: EntityId | null }
export interface RelationEdgeView {
  readonly from: EntityId; readonly to: EntityId; readonly fromPath: string; readonly toPath: string;
  readonly sources: readonly RelationSource[]; readonly line: number | null;
}
export interface CycleView {
  readonly findingId: string; readonly kind: 'import' | 're-export'; readonly members: readonly FileRef[];
  readonly hops: readonly RelationHop[]; readonly matched: boolean; readonly fingerprint: string | null; readonly pathText: string;
}
export interface BoundaryView {
  readonly findingId: string; readonly from: FileRef; readonly to: FileRef; readonly fromZone: string;
  readonly toZone: string; readonly line: number; readonly fingerprint: string | null;
}
export interface UnresolvedView { readonly findingId: string; readonly file: FileRef; readonly specifier: string; readonly line: number }

export interface RelationModel {
  readonly state: EvidenceIndexState;
  /** The report's cycle category is analysed (RelationEvidence.cyclesReported). */
  readonly analysed: boolean;
  readonly boundaries: BoundariesState | 'none';
  /** The matched edges, as a pure graph over snapshot EntityIds. */
  readonly index: RelationIndex;
  readonly edges: readonly RelationEdgeView[];
  edge(from: EntityId, to: EntityId): RelationEdgeView | undefined;
  /** Import cycles first, then re-export cycles, each in report order. */
  readonly cycles: readonly CycleView[];
  readonly boundaryViolations: readonly BoundaryView[];
  readonly unresolved: readonly UnresolvedView[];
  readonly unmatchedEdges: number;
  fanIn(id: EntityId): MetricValue;
  fanOut(id: EntityId): MetricValue;
}

/** "a.ts:35 → b.ts:15 → a.ts": each hop's FROM with its own line (":?" when null),
 *  closing back on the first hop's FROM. Empty for a re-export cycle (no hop order, N3). */
export function cyclePathText(hops: readonly RelationHop[]): string {
  if (hops.length === 0) return '';
  const parts = hops.map((h) => `${h.from}:${h.line ?? '?'}`);
  parts.push(hops[0]!.from);
  return parts.join(' → ');
}

function fileRef(pathToId: ReadonlyMap<string, EntityId>, path: string): FileRef {
  return { path, id: pathToId.get(path) ?? null };
}

/** N7 Review Focus 2: the same pair reported as both a cycle hop and a boundary violation
 *  merges into one edge, sources in the order cycle/boundary, line the first non-null. A
 *  self-loop is skipped, so `edges` stays in step with `index.edges` (createRelationIndex
 *  drops self-loops, domain/relations/graph.ts). */
function addEdge(
  byFrom: Map<EntityId, Map<EntityId, RelationEdgeView>>, from: EntityId, to: EntityId, fromPath: string, toPath: string,
  source: RelationSource, line: number | null,
): void {
  if (from === to) return;
  let byTo = byFrom.get(from);
  if (!byTo) { byTo = new Map(); byFrom.set(from, byTo); }
  const existing = byTo.get(to);
  if (!existing) { byTo.set(to, { from, to, fromPath, toPath, sources: [source], line }); return; }
  const sources = existing.sources.includes(source) ? existing.sources : [...existing.sources, source];
  byTo.set(to, { ...existing, sources, line: existing.line ?? line });
}

/** A cycle finding's own fingerprint, through findings.ts's canonical builder: null when
 *  the anchor path itself does not resolve. */
function anchorFingerprint(findingId: string, anchorPath: string | undefined, pathToId: ReadonlyMap<string, EntityId>): string | null {
  const anchorId = anchorPath === undefined ? undefined : pathToId.get(anchorPath);
  return anchorId === undefined ? null : findingFingerprint(anchorId, findingId);
}

/** N7: a hop is drawn only when its OWN endpoints resolve, and only when every member of
 *  its cycle resolves too — a partially-resolved cycle is never drawn as if it were
 *  complete. A hop with an unresolved endpoint is counted in unmatchedEdges either way. */
function buildImportCycles(
  cycles: readonly ReportedCycle[], pathToId: ReadonlyMap<string, EntityId>, findingPath: ReadonlyMap<string, string>,
  edgesByFrom: Map<EntityId, Map<EntityId, RelationEdgeView>>,
): { views: CycleView[]; unmatched: number } {
  const views: CycleView[] = [];
  let unmatched = 0;
  for (const c of cycles) {
    const members = c.files.map((p) => fileRef(pathToId, p));
    const matched = members.every((m) => m.id !== null);
    for (const hop of c.hops) {
      const fromId = pathToId.get(hop.from);
      const toId = pathToId.get(hop.to);
      if (fromId === undefined || toId === undefined) { unmatched += 1; continue; }
      if (matched) addEdge(edgesByFrom, fromId, toId, hop.from, hop.to, 'cycle', hop.line);
    }
    views.push({
      findingId: c.findingId, kind: 'import', members, hops: c.hops, matched,
      fingerprint: anchorFingerprint(c.findingId, findingPath.get(c.findingId), pathToId),
      pathText: cyclePathText(c.hops),
    });
  }
  return { views, unmatched };
}

/** N3: a re-export cycle has no hop order, so it never contributes an edge. */
function buildReExportCycles(
  cycles: readonly ReportedReExportCycle[], pathToId: ReadonlyMap<string, EntityId>, findingPath: ReadonlyMap<string, string>,
): CycleView[] {
  const views: CycleView[] = [];
  for (const c of cycles) {
    const members = c.files.map((p) => fileRef(pathToId, p));
    views.push({
      findingId: c.findingId, kind: 're-export', members, hops: [], matched: members.every((m) => m.id !== null),
      fingerprint: anchorFingerprint(c.findingId, findingPath.get(c.findingId), pathToId),
      pathText: '',
    });
  }
  return views;
}

function buildBoundaries(
  violations: readonly ReportedBoundaryViolation[], pathToId: ReadonlyMap<string, EntityId>,
  edgesByFrom: Map<EntityId, Map<EntityId, RelationEdgeView>>,
): { views: BoundaryView[]; unmatched: number } {
  const views: BoundaryView[] = [];
  let unmatched = 0;
  for (const v of violations) {
    const fromId = pathToId.get(v.from);
    const toId = pathToId.get(v.to);
    if (fromId === undefined || toId === undefined) unmatched += 1;
    else addEdge(edgesByFrom, fromId, toId, v.from, v.to, 'boundary', v.line);
    views.push({
      findingId: v.findingId, from: fileRef(pathToId, v.from), to: fileRef(pathToId, v.to),
      fromZone: v.fromZone, toZone: v.toZone, line: v.line,
      fingerprint: fromId === undefined ? null : findingFingerprint(fromId, v.findingId),
    });
  }
  return { views, unmatched };
}

function build(files: readonly FileSummary[], evidence: EvidenceIndex): RelationModel {
  const pathToId = new Map(files.map((f) => [f.path, f.id]));
  const report = evidence.report;
  const relations = report?.normalized.relations ?? null;
  const analysed = relations !== null && relations.cyclesReported;
  const findingPath = new Map((report?.normalized.findings ?? []).map((f) => [f.id, f.path]));
  const edgesByFrom = new Map<EntityId, Map<EntityId, RelationEdgeView>>();
  const importCycles = buildImportCycles(relations?.importCycles ?? [], pathToId, findingPath, edgesByFrom);
  const reExportCycles = buildReExportCycles(relations?.reExportCycles ?? [], pathToId, findingPath);
  const boundaries = buildBoundaries(relations?.boundaryViolations ?? [], pathToId, edgesByFrom);
  const unresolved: UnresolvedView[] = (relations?.unresolvedImports ?? []).map((u) => ({
    findingId: u.findingId, file: fileRef(pathToId, u.path), specifier: u.specifier, line: u.line,
  }));
  const edges = Array.from(edgesByFrom.values()).flatMap((byTo) => Array.from(byTo.values()));
  const index = createRelationIndex(edges.map((e) => ({ from: e.from, to: e.to })));
  const provenance: Provenance | null = report === null ? null
    : { source: 'fallow', detail: FALLOW_PROVENANCE_DETAIL(report.providerVersion, originOf(report)) };
  /** Built once, not per fanIn/fanOut call: a path->id lookup per scored file, not a scan
   *  of `files`/`relations.fan` per file on screen. */
  const fanById = new Map<EntityId, { fanIn: number; fanOut: number }>();
  if (relations !== null && relations.fan !== null) {
    for (const f of relations.fan) {
      const id = pathToId.get(f.path);
      if (id !== undefined) fanById.set(id, f);
    }
  }
  const fan = (id: EntityId, pick: (v: { fanIn: number; fanOut: number }) => number): MetricValue => {
    if (relations === null || relations.fan === null || provenance === null) return unknown(FALLOW_NOT_ANALYSED, 'fallow');
    const entry = fanById.get(id);
    if (entry === undefined) return unknown(RELATION_FAN_NOT_SCORED, 'fallow');
    return { state: evidence.state === 'stale' ? 'stale' : 'collected', value: pick(entry), provenance };
  };
  const model: RelationModel = {
    state: evidence.state, analysed, boundaries: relations?.boundaries ?? 'none', index, edges,
    edge: (from, to) => edgesByFrom.get(from)?.get(to),
    cycles: [...importCycles.views, ...reExportCycles],
    boundaryViolations: boundaries.views,
    unresolved,
    unmatchedEdges: importCycles.unmatched + boundaries.unmatched,
    fanIn: (id) => fan(id, (v) => v.fanIn),
    fanOut: (id) => fan(id, (v) => v.fanOut),
  };
  if (provenance !== null) provenanceCache.set(model, provenance);
  return model;
}

const cache = new WeakMap<EvidenceIndex, { files: readonly FileSummary[]; model: RelationModel }>();

/** Memoised per EvidenceIndex — shared by every leaf on the codebase — then per files array. */
export function relationModelFor(files: readonly FileSummary[], evidence: EvidenceIndex): RelationModel {
  const hit = cache.get(evidence);
  if (hit && hit.files === files) return hit.model;
  const model = build(files, evidence);
  cache.set(evidence, { files, model });
  return model;
}

const provenanceCache = new WeakMap<RelationModel, Provenance>();

/** J13/JF23: the relation evidence state for a count already computed elsewhere (Task 7's
 *  Architecture cards): unknown(FALLOW_NOT_ANALYSED) without a report or when the cycle
 *  category was not analysed; stale when the model is stale; else collected, fallow
 *  provenance (the same one fanIn/fanOut use). */
export function relationValue(model: RelationModel, n: number): MetricValue {
  const provenance = model.analysed ? provenanceCache.get(model) : undefined;
  if (!provenance) return unknown(FALLOW_NOT_ANALYSED, 'fallow');
  return { state: model.state === 'stale' ? 'stale' : 'collected', value: n, provenance };
}
