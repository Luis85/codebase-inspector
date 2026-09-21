// Part 2 §2.1/§3: the Architecture screen's read model. Modules come from the real
// inventory. Edges are SAMPLE (P3) and state what they mean (P4). Cycles (Tarjan) and rule
// verdicts are real algorithms run over those sample edges, so they are sample too.
import { collected, formatMetric, isSampleBacked, sample, sumEvidence, unknown, type MetricValue } from '../evidence';
import { sampleModuleEdges } from '../fixtures/sample-module-edges';
import type { BoundaryRule } from '../stores/ports/review-repository';
import {
  ARCH_CARD_CYCLES, ARCH_CARD_EDGES, ARCH_CARD_MODULES, ARCH_CARD_VIOLATIONS, ARCH_EDGES_CAPTION,
  ARCH_MODULES_OMITTED_CAPTION, ARCH_NO_CYCLES_CAPTION, ARCH_NO_RULES_REASON, ARCH_VIOLATIONS_CAPTION,
  NO_FILES_REASON, RULE_NOT_EVALUATED_REASON, SAMPLE_EDGE_DETAIL,
} from '../inspector-copy';
import { byPriority, moduleLabel, type FileSummary } from './file-summaries';

export const MAX_GRAPH_MODULES = 12;
const TOP_FILES = 5;
const EDGE_DETAIL = SAMPLE_EDGE_DETAIL;

export interface ModuleSummary { name: string; label: string; fileCount: number; lines: MetricValue; topFiles: readonly FileSummary[] }
export interface ModuleEdge { from: string; to: string; meaning: 'source-import'; imports: MetricValue }
export interface ArchitectureGraph {
  allModules: readonly ModuleSummary[];
  modules: readonly ModuleSummary[];
  omittedModules: number;
  edges: readonly ModuleEdge[];
  cycles: readonly (readonly string[])[];
}
export type RuleStatus = 'passing' | 'violation' | 'not-evaluated';
export interface RuleEvaluation { rule: BoundaryRule; status: RuleStatus; violatingImports: MetricValue }
export interface MatrixCell { from: string; to: string; edge: ModuleEdge | null }
export interface ArchitectureCard {
  id: 'modules' | 'edges' | 'cycles' | 'violations'; label: string; icon: string;
  value: MetricValue; caption: string; tone: 'accent' | 'danger' | 'warning';
}
export interface ArchitectureModel extends ArchitectureGraph {
  matrix: readonly (readonly MatrixCell[])[];
  rules: readonly RuleEvaluation[];
  violatingEdgeKeys: ReadonlySet<string>;
  cards: readonly ArchitectureCard[];
  usesSample: boolean;
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

/** Tarjan's strongly connected components, keeping only those with MORE than one module.
 *  Members and components are in name order. */
export function cyclicComponents(nodes: readonly string[], edges: readonly { from: string; to: string }[]): string[][] {
  const adjacency = new Map(nodes.map((n) => [n, [] as string[]]));
  for (const e of edges) adjacency.get(e.from)?.push(e.to);
  let counter = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const out: string[][] = [];
  const visit = (v: string): void => {
    index.set(v, counter); low.set(v, counter); counter += 1;
    stack.push(v); onStack.add(v);
    for (const w of adjacency.get(v) ?? []) {
      if (!adjacency.has(w)) continue;
      if (!index.has(w)) { visit(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, index.get(w)!));
    }
    if (low.get(v) !== index.get(v)) return;
    const component: string[] = [];
    for (;;) {
      const w = stack.pop();
      if (w === undefined) break;
      onStack.delete(w);
      component.push(w);
      if (w === v) break;
    }
    if (component.length > 1) out.push(component.sort());
  };
  for (const n of nodes) if (!index.has(n)) visit(n);
  return out.sort((a, b) => (a[0] ?? '').localeCompare(b[0] ?? ''));
}

export function buildArchitectureGraph(files: readonly FileSummary[]): ArchitectureGraph {
  const allModules = buildModules(files);
  const modules = allModules.slice(0, MAX_GRAPH_MODULES);
  const names = modules.map((m) => m.name);
  const edges: ModuleEdge[] = sampleModuleEdges(names).map((e) => ({
    from: e.from, to: e.to, meaning: 'source-import', imports: sample(e.imports, EDGE_DETAIL),
  }));
  return { allModules, modules, omittedModules: allModules.length - modules.length, edges, cycles: cyclicComponents(names, edges) };
}

const graphCache = new WeakMap<readonly FileSummary[], ArchitectureGraph>();

/** Memoized per files ARRAY: `fileSummariesFor` already returns one array per snapshot. */
export function architectureGraphFor(files: readonly FileSummary[]): ArchitectureGraph {
  let hit = graphCache.get(files);
  if (!hit) { hit = buildArchitectureGraph(files); graphCache.set(files, hit); }
  return hit;
}

export function cyclesValue(graph: ArchitectureGraph): MetricValue {
  return graph.modules.length === 0 ? unknown(NO_FILES_REASON) : sample(graph.cycles.length, EDGE_DETAIL);
}

export function evaluateRules(rules: readonly BoundaryRule[], graph: ArchitectureGraph): RuleEvaluation[] {
  const inGraph = new Set(graph.modules.map((m) => m.name));
  return rules.map((rule): RuleEvaluation => {
    if (!inGraph.has(rule.from) || !inGraph.has(rule.to)) {
      return { rule, status: 'not-evaluated', violatingImports: unknown(RULE_NOT_EVALUATED_REASON) };
    }
    const edge = graph.edges.find((e) => e.from === rule.from && e.to === rule.to);
    return edge
      ? { rule, status: 'violation', violatingImports: edge.imports }
      : { rule, status: 'passing', violatingImports: sample(0, EDGE_DETAIL) };
  });
}

export function moduleNeighbours(graph: ArchitectureGraph, name: string): { incoming: string[]; outgoing: string[] } {
  return {
    incoming: graph.edges.filter((e) => e.to === name).map((e) => e.from),
    outgoing: graph.edges.filter((e) => e.from === name).map((e) => e.to),
  };
}

export function buildArchitectureModel(graph: ArchitectureGraph, rules: readonly BoundaryRule[]): ArchitectureModel {
  const evaluations = evaluateRules(rules, graph);
  const violating = evaluations.filter((e) => e.status === 'violation');
  const byKey = new Map(graph.edges.map((e) => [edgeKey(e.from, e.to), e]));
  const matrix = graph.modules.map((row) => graph.modules.map((col): MatrixCell => ({
    from: row.name, to: col.name, edge: byKey.get(edgeKey(row.name, col.name)) ?? null,
  })));
  const empty = graph.modules.length === 0;
  const cards: ArchitectureCard[] = [
    { id: 'modules', label: ARCH_CARD_MODULES, icon: 'boxes', tone: 'accent',
      value: collected(graph.allModules.length, 'inventory'),
      caption: graph.omittedModules > 0 ? ARCH_MODULES_OMITTED_CAPTION(MAX_GRAPH_MODULES) : graph.modules.slice(0, 4).map((m) => m.label).join(' · ') },
    { id: 'edges', label: ARCH_CARD_EDGES, icon: 'link', tone: 'accent',
      value: empty ? unknown(NO_FILES_REASON) : sample(graph.edges.length, EDGE_DETAIL),
      caption: ARCH_EDGES_CAPTION(formatMetric(sumEvidence(graph.edges.map((e) => e.imports)))) },
    { id: 'cycles', label: ARCH_CARD_CYCLES, icon: 'refresh-cw', tone: 'danger', value: cyclesValue(graph),
      caption: graph.cycles.length ? graph.cycles.map((c) => c.map(moduleLabel).join(' ↔ ')).join('; ') : ARCH_NO_CYCLES_CAPTION },
    { id: 'violations', label: ARCH_CARD_VIOLATIONS, icon: 'alert-triangle', tone: 'warning',
      value: rules.length === 0 ? unknown(ARCH_NO_RULES_REASON) : sumEvidence(evaluations.map((e) => e.violatingImports)),
      caption: ARCH_VIOLATIONS_CAPTION(violating.length) },
  ];
  return {
    ...graph, matrix, rules: evaluations,
    violatingEdgeKeys: new Set(violating.map((e) => edgeKey(e.rule.from, e.rule.to))),
    cards, usesSample: cards.some((c) => isSampleBacked(c.value)),
  };
}
