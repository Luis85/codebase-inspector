// WP-03 N18-N20, N23, N27: the Architecture read model, built from the relation model
// (Task 6) — fallow's evidenced imports (reported cycle hops and boundary violations),
// never a full import graph and never sample data. Modules stay real inventory groups.
import { aggregateEdges, stronglyConnected } from '../../domain/relations/queries';
import { collected, sumEvidence, unknown, type MetricValue } from '../evidence';
import type { BoundaryRule } from '../stores/ports/review-repository';
import {
  ARCH_CARD_EVIDENCED, ARCH_CARD_MODULES, ARCH_CARD_VIOLATIONS, ARCH_MODULES_OMITTED_CAPTION,
  ARCH_VIOLATIONS_CAPTION, FALLOW_BOUNDARIES_NOT_CONFIGURED, FALLOW_NOT_ANALYSED, RELATIONS_SCOPE_SHORT,
  RELATION_CARD_CYCLES, RELATION_CYCLES_CAPTION, RULE_NOT_EVALUATED_PARTIAL, RULE_NOT_EVALUATED_REASON,
} from '../inspector-copy';
import { relationValue, type CycleView, type RelationModel } from './relations';
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
  id: 'modules' | 'evidenced' | 'cycles' | 'violations'; label: string; icon: string;
  value: MetricValue; caption: string; tone: 'accent' | 'danger' | 'warning';
}
export interface ArchitectureModel extends ArchitectureGraph {
  matrix: readonly (readonly MatrixCell[])[];
  rules: readonly RuleEvaluation[];
  violatingEdgeKeys: ReadonlySet<string>;
  cards: readonly ArchitectureCard[];
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

/** N18: fallow's import-cycle count (re-export cycles are never merged in), in the
 *  relation model's own evidence state. */
export function cyclesValue(relations: RelationModel): MetricValue {
  return relationValue(relations, relations.cycles.filter((c) => c.kind === 'import').length);
}

/** N20: `moduleOf` each of the cycle's MATCHED members (an unresolved member has no path
 *  worth highlighting on the module map). */
export function cycleModules(cycle: CycleView): ReadonlySet<string> {
  return new Set(cycle.members.filter((m) => m.id !== null).map((m) => moduleOf(m.path)));
}

/** N18: the three cycle numbers. "Files in a cycle" and "Cycle groups" both read only
 *  MATCHED import cycles — re-export cycles are counted separately and never merged in. */
function cycleNumbers(relations: RelationModel): { files: number; groups: number; reExports: number } {
  const matchedImports = relations.cycles.filter((c) => c.kind === 'import' && c.matched);
  const nodeIds = new Set(matchedImports.flatMap((c) => c.members.map((m) => m.id!)));
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
    return { rule, status: 'not-evaluated', violatingImports: unknown(reason), reason };
  });
}

export function moduleNeighbours(graph: ArchitectureGraph, name: string): { incoming: string[]; outgoing: string[] } {
  return {
    incoming: graph.edges.filter((e) => e.to === name).map((e) => e.from),
    outgoing: graph.edges.filter((e) => e.from === name).map((e) => e.to),
  };
}

/** N20: the Boundary violations card adds fallow's own reported violations (skipped
 *  entirely, not counted as 0, while boundaries are not configured — N11's rule) to the
 *  count of your OWN rules in violation. It is unknown only when both sources have
 *  nothing to add: boundaries not configured AND no rules of your own. */
function violationsValue(relations: RelationModel, evaluations: readonly RuleEvaluation[], rules: readonly BoundaryRule[]): MetricValue {
  const fallow = relations.boundaries === 'not-configured' ? null : relationValue(relations, relations.boundaryViolations.length);
  const own = rules.length === 0 ? null : sumEvidence(evaluations.filter((e) => e.status === 'violation').map((e) => e.violatingImports));
  const parts = [fallow, own].filter((v): v is MetricValue => v !== null);
  return parts.length === 0 ? unknown(FALLOW_BOUNDARIES_NOT_CONFIGURED, 'fallow') : sumEvidence(parts);
}

export function buildArchitectureModel(graph: ArchitectureGraph, rules: readonly BoundaryRule[]): ArchitectureModel {
  const evaluations = evaluateRules(rules, graph);
  const violating = evaluations.filter((e) => e.status === 'violation');
  const byKey = new Map(graph.edges.map((e) => [edgeKey(e.from, e.to), e]));
  const matrix = graph.modules.map((row) => graph.modules.map((col): MatrixCell => ({
    from: row.name, to: col.name, edge: byKey.get(edgeKey(row.name, col.name)) ?? null,
  })));
  const { files, groups, reExports } = cycleNumbers(graph.relations);
  const cards: ArchitectureCard[] = [
    { id: 'modules', label: ARCH_CARD_MODULES, icon: 'boxes', tone: 'accent',
      value: collected(graph.allModules.length, 'inventory'),
      caption: graph.omittedModules > 0 ? ARCH_MODULES_OMITTED_CAPTION(MAX_GRAPH_MODULES) : graph.modules.slice(0, 4).map((m) => m.label).join(' · ') },
    { id: 'evidenced', label: ARCH_CARD_EVIDENCED, icon: 'link', tone: 'accent',
      value: relationValue(graph.relations, graph.relations.edges.length), caption: RELATIONS_SCOPE_SHORT },
    { id: 'cycles', label: RELATION_CARD_CYCLES, icon: 'refresh-cw', tone: 'danger',
      value: cyclesValue(graph.relations), caption: RELATION_CYCLES_CAPTION(files, groups, reExports) },
    { id: 'violations', label: ARCH_CARD_VIOLATIONS, icon: 'alert-triangle', tone: 'warning',
      value: violationsValue(graph.relations, evaluations, rules),
      caption: ARCH_VIOLATIONS_CAPTION(violating.length) },
  ];
  return {
    ...graph, matrix, rules: evaluations,
    violatingEdgeKeys: new Set(violating.map((e) => edgeKey(e.rule.from, e.rule.to))),
    cards,
  };
}
