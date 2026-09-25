// WP-03 N18-N20, N23, N27: the Architecture read model, built from the relation model
// (Task 6) — fallow's evidenced imports (reported cycle hops and boundary violations),
// never a full import graph and never sample data. Modules stay real inventory groups.
import { aggregateEdges, stronglyConnected } from '../../domain/relations/queries';
import { collected, sumEvidence, unknown, type MetricValue } from '../evidence';
import type { BoundaryRule } from '../stores/ports/review-repository';
import {
  ARCH_CARD_EVIDENCED, ARCH_CARD_MODULES, ARCH_CARD_RULES, ARCH_CARD_VIOLATIONS, ARCH_MODULES_OMITTED_CAPTION,
  ARCH_NOT_ANALYSED_NO_SECTION, ARCH_NOT_ANALYSED_NOTE, ARCH_RULES_CAPTION, ARCH_RULES_NONE, ARCH_VIOLATIONS_FALLOW_CAPTION,
  FALLOW_NOT_ANALYSED, RELATIONS_SCOPE_SHORT, RELATION_CARD_CYCLES, RELATION_CYCLES_CAPTION, RULE_NOT_EVALUATED_PARTIAL,
  RULE_NOT_EVALUATED_REASON,
} from '../inspector-copy';
import { relationBoundaryValue, relationValue, type CycleView, type RelationModel } from './relations';
import { byPriority, moduleLabel, moduleOf, type FileSummary } from './file-summaries';

export const MAX_GRAPH_MODULES = 12;
const TOP_FILES = 5;

export interface ModuleSummary { name: string; label: string; fileCount: number; lines: MetricValue; topFiles: readonly FileSummary[] }
export interface ModuleEdge { from: string; to: string; meaning: 'evidenced-import'; imports: MetricValue }
export interface ArchitectureGraph {
  allModules: readonly ModuleSummary[];
  modules: readonly ModuleSummary[];
  omittedModules: number;
  edges: readonly ModuleEdge[];
  omittedEdges: number;
  relations: RelationModel;
}
export type RuleStatus = 'violation' | 'not-evaluated';
export interface RuleEvaluation { rule: BoundaryRule; status: RuleStatus; violatingImports: MetricValue; reason: string | null }
export interface MatrixCell { from: string; to: string; edge: ModuleEdge | null }
export interface ArchitectureCard {
  id: 'modules' | 'evidenced' | 'cycles' | 'violations' | 'rules'; label: string; icon: string;
  value: MetricValue; caption: string; tone: 'accent' | 'danger' | 'warning';
}
export interface ArchitectureModel extends ArchitectureGraph {
  matrix: readonly (readonly MatrixCell[])[];
  rules: readonly RuleEvaluation[];
  violatingEdgeKeys: ReadonlySet<string>;
  cards: readonly ArchitectureCard[];
  /** True without a report, or when the report's check section never covered cycles
   *  (`relations.analysed` is false) — the Map/Matrix/caption "not analysed" state. */
  notAnalysed: boolean;
  /** Final review #8: why, when `notAnalysed` — ARCH_NOT_ANALYSED_NOTE without a report,
   *  ARCH_NOT_ANALYSED_NO_SECTION with one that has no check section. */
  notAnalysedNote: string;
}

export const edgeKey = (from: string, to: string): string => `${from}->${to}`;

export function buildModules(files: readonly FileSummary[]): ModuleSummary[] {
  const groups = new Map<string, FileSummary[]>();
  for (const f of files) {
    const g = groups.get(f.module);
    if (g) g.push(f); else groups.set(f.module, [f]);
  }
  return [...groups.entries()]
    .map(([name, fs]) => ({
      name, label: moduleLabel(name), fileCount: fs.length,
      lines: sumEvidence(fs.map((f) => f.lines)),
      topFiles: [...fs].sort(byPriority).slice(0, TOP_FILES),
    }))
    .sort((a, b) => b.fileCount - a.fileCount || a.name.localeCompare(b.name));
}

/** N19/N20: module edges are the aggregated MATCHED file edges (relations.index.edges,
 *  Task 6), kept only between two of the shown (capped) modules; an edge to an omitted
 *  module is counted in `omittedEdges`, never drawn (N19's Map note). */
export function buildArchitectureGraph(files: readonly FileSummary[], relations: RelationModel): ArchitectureGraph {
  const allModules = buildModules(files);
  const modules = allModules.slice(0, MAX_GRAPH_MODULES);
  const shown = new Set(modules.map((m) => m.name));
  const moduleOfId = new Map(files.map((f) => [f.id, f.module]));
  const aggregated = aggregateEdges(relations.index.edges, (id) => moduleOfId.get(id)!);
  const edges: ModuleEdge[] = [];
  let omittedEdges = 0;
  for (const e of aggregated) {
    if (shown.has(e.from) && shown.has(e.to)) edges.push({ from: e.from, to: e.to, meaning: 'evidenced-import', imports: relationValue(relations, e.count) });
    else omittedEdges += e.count;
  }
  return { allModules, modules, omittedModules: allModules.length - modules.length, edges, omittedEdges, relations };
}

const graphCache = new WeakMap<RelationModel, ArchitectureGraph>();

/** N27: memoised per RelationModel (relationModelFor is itself memoised per (files, evidence
 *  index), so a stable RelationModel means a stable graph). */
export function architectureGraphFor(files: readonly FileSummary[], relations: RelationModel): ArchitectureGraph {
  let hit = graphCache.get(relations);
  if (!hit) { hit = buildArchitectureGraph(files, relations); graphCache.set(relations, hit); }
  return hit;
}

const cyclesCache = new WeakMap<RelationModel, MetricValue>();

/** N18: fallow's import-cycle count (re-export cycles are never merged in), in the
 *  relation model's own evidence state. N27: memoised per RelationModel, so two callers
 *  reading the same relation model get the same MetricValue object — `use-read-models.ts`'s
 *  Overview memo keys on this value by identity. */
export function cyclesValue(relations: RelationModel): MetricValue {
  let hit = cyclesCache.get(relations);
  if (!hit) { hit = relationValue(relations, relations.cycles.filter((c) => c.kind === 'import').length); cyclesCache.set(relations, hit); }
  return hit;
}

/** N20: `moduleOf` each of the cycle's MATCHED members (an unresolved member has no path
 *  worth highlighting on the module map). */
export function cycleModules(cycle: CycleView): ReadonlySet<string> {
  return new Set(cycle.members.filter((m) => m.id !== null).map((m) => moduleOf(m.path)));
}

/** N18: the three cycle numbers. "Files in a cycle" counts every MATCHED MEMBER of every
 *  import cycle — including the matched members of a partly-matched cycle (fix round 1
 *  #9). "Cycle groups" is `stronglyConnected` over only the matched HOP edges, which
 *  `relations.ts` adds solely from FULLY-matched cycles (an unmatched cycle contributes no
 *  hop, N7), so a partial cycle's matched members can inflate "files" without changing
 *  "groups" — that is the point: the files count is honest about what resolved, the
 *  groups count is honest about what could be traced. Re-export cycles are counted
 *  separately and never merged in. */
function cycleNumbers(relations: RelationModel): { files: number; groups: number; reExports: number } {
  const imports = relations.cycles.filter((c) => c.kind === 'import');
  const nodeIds = new Set(imports.flatMap((c) => c.members.filter((m) => m.id !== null).map((m) => m.id!)));
  const hopEdges = relations.edges.filter((e) => e.sources.includes('cycle')).map((e) => ({ from: e.from, to: e.to }));
  const groups = stronglyConnected(Array.from(nodeIds), hopEdges).length;
  const reExports = relations.cycles.filter((c) => c.kind === 're-export').length;
  return { files: nodeIds.size, groups, reExports };
}

/** N23: a rule is `violation` when at least one matched evidenced file edge (aggregated to
 *  module level in `graph.edges`) goes from `rule.from` to `rule.to`; otherwise
 *  `not-evaluated`, in the reason order: out of the shown graph, then no report/not
 *  analysed, then an incomplete graph (a report is present but says nothing about this
 *  pair). No rule is ever `passing` — without the full import graph, a rule with no
 *  evidenced crossing is unproven, not cleared. */
export function evaluateRules(rules: readonly BoundaryRule[], graph: ArchitectureGraph): RuleEvaluation[] {
  const inGraph = new Set(graph.modules.map((m) => m.name));
  const byKey = new Map(graph.edges.map((e) => [edgeKey(e.from, e.to), e]));
  const relations = graph.relations;
  return rules.map((rule): RuleEvaluation => {
    if (!inGraph.has(rule.from) || !inGraph.has(rule.to)) {
      return { rule, status: 'not-evaluated', violatingImports: unknown(RULE_NOT_EVALUATED_REASON), reason: RULE_NOT_EVALUATED_REASON };
    }
    const edge = byKey.get(edgeKey(rule.from, rule.to));
    if (edge) return { rule, status: 'violation', violatingImports: edge.imports, reason: null };
    const reason = relations.state === 'none' || !relations.analysed ? FALLOW_NOT_ANALYSED : RULE_NOT_EVALUATED_PARTIAL;
    return { rule, status: 'not-evaluated', violatingImports: unknown(reason, 'fallow'), reason };
  });
}

export function moduleNeighbours(graph: ArchitectureGraph, name: string): { incoming: string[]; outgoing: string[] } {
  return {
    incoming: graph.edges.filter((e) => e.to === name).map((e) => e.from),
    outgoing: graph.edges.filter((e) => e.from === name).map((e) => e.to),
  };
}

/** PO1 (amending N20, WP-03 E8 and E24 — JP3's ruling): the Boundary violations card is
 *  fallow's own reported count ALONE — never added to your violated rules. The two are
 *  different units (a distinct-finding count vs. a rule count), so summing them once
 *  produced a number that meant nothing; `relationBoundaryValue` already yields N11's own
 *  "not configured" unknown (never a measured 0) and the "not analysed" unknown, so
 *  neither needs restating here. See `rulesValue` for your own rules' own card. */
function violationsValue(relations: RelationModel): MetricValue {
  // Final review #9: distinct findings, as Quality counts them — never two for one violation reported twice.
  return relationBoundaryValue(relations, relations.boundaryFindings);
}

/** PO1 (JP3): the count of your OWN rules currently in violation, independent of
 *  fallow's boundary count. Unknown with no rules at all (nothing to evaluate, ever, not
 *  0 of nothing); unknown while nothing was analysed (the count would mean nothing);
 *  otherwise the number of rules whose status is `violation` — a rule that merely exists
 *  but evaluates not-evaluated contributes nothing, positive or negative. */
function rulesValue(rules: readonly BoundaryRule[], evaluations: readonly RuleEvaluation[], notAnalysed: boolean, notAnalysedNote: string): MetricValue {
  if (rules.length === 0) return unknown(ARCH_RULES_NONE);
  if (notAnalysed) return unknown(notAnalysedNote);
  return collected(evaluations.filter((e) => e.status === 'violation').length, 'review');
}

export function buildArchitectureModel(graph: ArchitectureGraph, rules: readonly BoundaryRule[]): ArchitectureModel {
  const evaluations = evaluateRules(rules, graph);
  const violating = evaluations.filter((e) => e.status === 'violation');
  const byKey = new Map(graph.edges.map((e) => [edgeKey(e.from, e.to), e]));
  const matrix = graph.modules.map((row) => graph.modules.map((col): MatrixCell => ({
    from: row.name, to: col.name, edge: byKey.get(edgeKey(row.name, col.name)) ?? null,
  })));
  const notAnalysed = graph.relations.state === 'none' || !graph.relations.analysed;
  const notAnalysedNote = graph.relations.state === 'none' ? ARCH_NOT_ANALYSED_NOTE : ARCH_NOT_ANALYSED_NO_SECTION;
  const { files, groups, reExports } = cycleNumbers(graph.relations);
  const cards: ArchitectureCard[] = [
    { id: 'modules', label: ARCH_CARD_MODULES, icon: 'boxes', tone: 'accent',
      value: collected(graph.allModules.length, 'inventory'),
      caption: graph.omittedModules > 0 ? ARCH_MODULES_OMITTED_CAPTION(MAX_GRAPH_MODULES) : graph.modules.slice(0, 4).map((m) => m.label).join(' · ') },
    { id: 'evidenced', label: ARCH_CARD_EVIDENCED, icon: 'link', tone: 'accent',
      value: relationValue(graph.relations, graph.relations.edges.length), caption: RELATIONS_SCOPE_SHORT },
    { id: 'cycles', label: RELATION_CARD_CYCLES, icon: 'refresh-cw', tone: 'danger',
      value: cyclesValue(graph.relations),
      // Fix round 1 #2: absent evidence is never rendered as 0 — a caption built from
      // counts that could not be measured reads the not-analysed note instead.
      caption: notAnalysed ? notAnalysedNote : RELATION_CYCLES_CAPTION(files, groups, reExports) },
    { id: 'violations', label: ARCH_CARD_VIOLATIONS, icon: 'alert-triangle', tone: 'warning',
      value: violationsValue(graph.relations),
      // PO1: fallow's own count needs no rule-count caption any more — it only ever
      // says whether it is fallow's, or why there is nothing (the not-analysed note).
      caption: notAnalysed ? notAnalysedNote : ARCH_VIOLATIONS_FALLOW_CAPTION },
    { id: 'rules', label: ARCH_CARD_RULES, icon: 'shield', tone: 'warning',
      value: rulesValue(rules, evaluations, notAnalysed, notAnalysedNote),
      caption: rules.length === 0 ? ARCH_RULES_NONE
        : notAnalysed ? notAnalysedNote
        : ARCH_RULES_CAPTION(rules.length, evaluations.filter((e) => e.status === 'not-evaluated').length) },
  ];
  // PO2 (JP4): the Map, Matrix, Edges filter and edge inspector all agree on ONE set —
  // your violated rule pairs, union fallow's own boundary-violation pairs (`moduleOf` on
  // each relation edge's paths, confirmed against file-summaries.ts as what
  // FileSummary.module is built from, so this matches the Edges tab's own per-row lookup).
  // A same-module fallow violation keys the diagonal (PO2, Review Focus 3): harmless — the
  // Map never draws a self-edge (aggregateEdges drops same-group pairs) and the Matrix's
  // diagonal cell is its own "Same module" branch regardless of this set.
  const violatingEdgeKeys = new Set([
    ...violating.map((e) => edgeKey(e.rule.from, e.rule.to)),
    ...graph.relations.edges.filter((e) => e.sources.includes('boundary')).map((e) => edgeKey(moduleOf(e.fromPath), moduleOf(e.toPath))),
  ]);
  return { ...graph, matrix, rules: evaluations, violatingEdgeKeys, cards, notAnalysed, notAnalysedNote };
}
