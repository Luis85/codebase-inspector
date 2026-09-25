// WP-03 Task 7 (N18-N20, N23, N26): the Architecture read model, Overview, Data & scans and
// the Rules table, over the REAL relations recording (tests/fixtures/fallow/README.md,
// "Relations project"), never the deleted sample module edges. JF14: snapshot paths are
// re-rooted without `src/`, and the report is normalised with `{ stripPrefix: 'src/' }`, so
// the fixture's own top-level folders (`core`, `barrel`, `ui`, `data`) become modules —
// under `src/` alone every path would collapse into one module and no edge would cross it.
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import type { EvidenceReport } from '../../src/application/evidence/model';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { relationModelFor } from '../../src/ui/read-models/relations';
import {
  architectureGraphFor, buildArchitectureModel, cycleModules, cyclesValue, edgeKey, evaluateRules, type RuleStatus,
} from '../../src/ui/read-models/architecture';
import { moduleOf } from '../../src/ui/read-models/file-summaries';
import { buildOverviewModel } from '../../src/ui/read-models/overview';
import { buildSourcesModel } from '../../src/ui/read-models/sources';
import {
  ARCH_NOT_ANALYSED_NO_SECTION, ARCH_NOT_ANALYSED_NOTE, ARCH_RULES_CAPTION, ARCH_RULES_NONE, ARCH_VIOLATIONS_FALLOW_CAPTION,
  ARCH_VIOLATIONS_NOT_CONFIGURED, EVIDENCE_SOURCE_FALLOW_PARTIAL, FALLOW_BOUNDARIES_NOT_CONFIGURED, FALLOW_NOT_ANALYSED,
  OVERVIEW_IMPORTS_ROW, RELATIONS_SCOPE_SHORT, RELATION_CYCLES_CAPTION, RELATION_CYCLES_NOT_REPORTED, RULE_NOT_EVALUATED_PARTIAL,
  RULE_NOT_EVALUATED_REASON,
} from '../../src/ui/inspector-copy';
import type { BoundaryRule } from '../../src/ui/stores/ports/review-repository';
import { fallowDoc, rawReport } from '../fixtures/fallow-fixture';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { snapshotWithPaths } from '../fixtures/evidence-report';
import { RELATIONS_PATHS } from '../fixtures/relations-report';

const IMPORTED_AT = '2026-09-24T10:00:00.000Z';
const IDLE = { status: 'idle' as const };
const rule = (from: string, to: string, id = 'AR-001'): BoundaryRule => ({ id, from, to, rationale: 'r', createdAt: IMPORTED_AT });

function reportFor(snapshotId: string, fixture: Parameters<typeof rawReport>[0] = 'relations-combined-3.27.0'): EvidenceReport {
  return buildEvidenceReport({
    raw: rawReport(fixture), fileName: 'relations.json', importedAt: IMPORTED_AT, snapshotId, stripPrefix: 'src/',
  });
}

const snapshot = snapshotWithPaths(RELATIONS_PATHS, 'repo-relations-arch');
const files = fileSummariesFor(snapshot);
const report = reportFor(snapshot.snapshotId);
const evidence = evidenceIndexFor(files, report, snapshot.snapshotId);
const relations = relationModelFor(files, evidence);
const graph = architectureGraphFor(files, relations);

const noReportEvidence = evidenceIndexFor(files, null, snapshot.snapshotId);
const noReportRelations = relationModelFor(files, noReportEvidence);
const noReportGraph = architectureGraphFor(files, noReportRelations);

describe('module edges (N19, N20)', () => {
  it('is the one cross-module matched edge, ui -> data, collected; core has no self-edge', () => {
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ from: 'ui', to: 'data', meaning: 'evidenced-import', imports: { state: 'collected', value: 1 } });
    expect(graph.edges.some((e) => e.from === 'core' && e.to === 'core')).toBe(false);
    expect(graph.omittedEdges).toBe(0);
  });

  it('cycleModules gives moduleOf each matched member', () => {
    const coreCycle = relations.cycles.find((c) => c.kind === 'import' && c.members.length === 3)!;
    expect(cycleModules(coreCycle)).toEqual(new Set(['core']));
  });
});

describe('cards (N18, N20)', () => {
  it('the cycle card counts import cycles (collected) with the recorded files/groups/re-exports, and notAnalysed is false', () => {
    const model = buildArchitectureModel(graph, []);
    expect(model.notAnalysed).toBe(false);
    const card = model.cards.find((c) => c.id === 'cycles')!;
    expect(card.value).toMatchObject({ state: 'collected', value: 2 });
    expect(card.caption).toBe(RELATION_CYCLES_CAPTION(5, 2, 1));
    expect(card.value).toEqual(cyclesValue(relations));
  });

  it('the evidenced-imports card counts every distinct matched file edge, captioned with the scope note', () => {
    const model = buildArchitectureModel(graph, []);
    const card = model.cards.find((c) => c.id === 'evidenced')!;
    expect(card.value).toMatchObject({ state: 'collected', value: 6 });
    expect(card.caption).toBe(RELATIONS_SCOPE_SHORT);
  });

  it('PO1: the violations card is fallow\'s own reported count alone — a violated rule of yours never adds to it', () => {
    const withoutRule = buildArchitectureModel(graph, []);
    const withoutCard = withoutRule.cards.find((c) => c.id === 'violations')!;
    expect(withoutCard.value).toMatchObject({ state: 'collected', value: 1 });
    expect(withoutCard.caption).toBe(ARCH_VIOLATIONS_FALLOW_CAPTION);
    const withRule = buildArchitectureModel(graph, [rule('ui', 'data')]);
    // Same value as without the rule — not the sum (PO1): fallow's distinct-finding count
    // and your rule count are two different units.
    expect(withRule.cards.find((c) => c.id === 'violations')!.value).toEqual(withoutCard.value);
  });

  it('PO1: the rules card counts your OWN violated rules, independent of fallow\'s boundary count', () => {
    const none = buildArchitectureModel(graph, []).cards.find((c) => c.id === 'rules')!;
    expect(none.value).toMatchObject({ state: 'unknown', reason: ARCH_RULES_NONE });

    const notViolated = buildArchitectureModel(graph, [rule('core', 'ui')]).cards.find((c) => c.id === 'rules')!;
    expect(notViolated.value).toMatchObject({ state: 'collected', value: 0 });
    expect(notViolated.caption).toBe(ARCH_RULES_CAPTION(1, 1));

    const violated = buildArchitectureModel(graph, [rule('ui', 'data')]).cards.find((c) => c.id === 'rules')!;
    expect(violated.value).toMatchObject({ state: 'collected', value: 1 });
    expect(violated.caption).toBe(ARCH_RULES_CAPTION(1, 0));
  });

  it('without a report, evidenced/cycles/violations read unknown(FALLOW_NOT_ANALYSED); modules stay collected, notAnalysed is true, and no caption renders a false 0', () => {
    const model = buildArchitectureModel(noReportGraph, []);
    expect(model.notAnalysed).toBe(true);
    expect(model.edges).toEqual([]);
    for (const id of ['evidenced', 'cycles', 'violations'] as const) {
      expect(model.cards.find((c) => c.id === id)).toMatchObject({ value: { state: 'unknown', reason: FALLOW_NOT_ANALYSED } });
    }
    expect(model.cards.find((c) => c.id === 'modules')).toMatchObject({ value: { state: 'collected' } });
    expect(model.cards.find((c) => c.id === 'cycles')!.caption).toBe(ARCH_NOT_ANALYSED_NOTE);
    expect(model.cards.find((c) => c.id === 'violations')!.caption).toBe(ARCH_NOT_ANALYSED_NOTE);
  });

  it('without a report, the rules card reads unknown(ARCH_RULES_NONE) with no rules, else the not-analysed note', () => {
    const noRules = buildArchitectureModel(noReportGraph, []).cards.find((c) => c.id === 'rules')!;
    expect(noRules.value).toMatchObject({ state: 'unknown', reason: ARCH_RULES_NONE });
    const withRule = buildArchitectureModel(noReportGraph, [rule('ui', 'data')]).cards.find((c) => c.id === 'rules')!;
    expect(withRule.value).toMatchObject({ state: 'unknown', reason: ARCH_NOT_ANALYSED_NOTE });
    expect(withRule.caption).toBe(ARCH_NOT_ANALYSED_NOTE);
  });

  it('PO1/PO2: on the no-boundaries recording, a violated rule of yours never resurrects the violations card (still unknown, not configured); the rules card is collected 1', () => {
    const doc = fallowDoc('relations-no-boundaries-3.27.0', (d) => {
      const crossModuleFiles = ['src/ui/view.ts', 'src/core/a.ts'];
      (d.check! as unknown as { circular_dependencies: unknown[] }).circular_dependencies.push({
        files: crossModuleFiles, length: 2, line: 1, col: 0,
        edges: crossModuleFiles.map((path) => ({ path, line: 1, col: 0 })),
      });
    });
    const noBoundariesReport = buildEvidenceReport({
      raw: rawReport(doc), fileName: 'relations.json', importedAt: IMPORTED_AT, snapshotId: snapshot.snapshotId, stripPrefix: 'src/',
    });
    const rel = relationModelFor(files, evidenceIndexFor(files, noBoundariesReport, snapshot.snapshotId));
    expect(rel.boundaries).toBe('not-configured');
    const noBoundariesGraph = architectureGraphFor(files, rel);
    const model = buildArchitectureModel(noBoundariesGraph, [rule('ui', 'core')]);
    expect(model.cards.find((c) => c.id === 'violations')!.value).toMatchObject({ state: 'unknown', reason: FALLOW_BOUNDARIES_NOT_CONFIGURED });
    expect(model.cards.find((c) => c.id === 'rules')!.value).toMatchObject({ state: 'collected', value: 1 });
  });

  it('PO2 (JP4): violatingEdgeKeys unions your violated rule pairs with moduleOf(fromPath)->moduleOf(toPath) for every relation edge sourced from a boundary', () => {
    const withoutRule = buildArchitectureModel(graph, [rule('core', 'ui')]);   // not-evaluated: contributes no pair
    const boundaryEdge = relations.edges.find((e) => e.sources.includes('boundary'))!;
    expect(boundaryEdge).toBeDefined();
    const boundaryKey = edgeKey(moduleOf(boundaryEdge.fromPath), moduleOf(boundaryEdge.toPath));
    expect(withoutRule.violatingEdgeKeys.has(boundaryKey)).toBe(true);
    const withRule = buildArchitectureModel(graph, [rule('ui', 'data')]);
    expect(withRule.violatingEdgeKeys.has(boundaryKey)).toBe(true);
    // Both sources key the same pair here — still one Set entry, never counted twice.
    expect(withRule.violatingEdgeKeys.size).toBe(withoutRule.violatingEdgeKeys.size);
  });

  it('fix round 1 #9: "files in a cycle" counts matched members of a PARTLY matched cycle too', () => {
    // core/c.ts dropped: the core cycle's a/b members still resolve, so they still count as
    // "files in a cycle" even though the whole cycle (and so its hops/groups) stays unmatched.
    const reducedPaths = RELATIONS_PATHS.filter((p) => p !== 'core/c.ts');
    const reducedSnapshot = snapshotWithPaths(reducedPaths, 'repo-relations-arch-reduced');
    const reducedFiles = fileSummariesFor(reducedSnapshot);
    const reducedReport = reportFor(reducedSnapshot.snapshotId);
    const reducedRelations = relationModelFor(reducedFiles, evidenceIndexFor(reducedFiles, reducedReport, reducedSnapshot.snapshotId));
    const reducedGraph = architectureGraphFor(reducedFiles, reducedRelations);
    const model = buildArchitectureModel(reducedGraph, []);
    // barrel's group (2) still fully matched and traced; core's a/b resolve but its hops
    // never draw (the whole cycle is unmatched, N7), so they inflate "files" (2 + 2 = 4)
    // without inflating "groups" (still 1: only the barrel pair).
    expect(model.cards.find((c) => c.id === 'cycles')!.caption).toBe(RELATION_CYCLES_CAPTION(4, 1, 1));
  });
});

/** JP5 (WP-03 Task 9 deferred minor): the with-boundaries 3.27.0 recording, trimmed of its
 *  cycle category (a "trimmed writer", N2) — boundaries stay configured (1 reported
 *  violation) but no cycle was ever reported. */
describe('JP5: edges and the module views gate on ANY analysed edge category', () => {
  const boundaryOnlyDoc = fallowDoc('relations-combined-3.27.0', (d) => {
    delete d.check!.circular_dependencies;
    delete d.check!.re_export_cycles;
  });
  const boundaryOnlyReport = buildEvidenceReport({
    raw: rawReport(boundaryOnlyDoc), fileName: 'relations.json', importedAt: IMPORTED_AT, snapshotId: snapshot.snapshotId, stripPrefix: 'src/',
  });
  const boundaryOnlyRelations = relationModelFor(files, evidenceIndexFor(files, boundaryOnlyReport, snapshot.snapshotId));
  const boundaryOnlyGraph = architectureGraphFor(files, boundaryOnlyRelations);

  it('cycles were never reported, but boundaries are configured', () => {
    expect(boundaryOnlyRelations.analysed).toBe(false);
    expect(boundaryOnlyRelations.boundaries).toBe('configured');
  });

  it('notAnalysed is false (the boundary edge is evidenced); cyclesNotAnalysed stays true', () => {
    const model = buildArchitectureModel(boundaryOnlyGraph, []);
    expect(model.notAnalysed).toBe(false);
    expect(model.cyclesNotAnalysed).toBe(true);
    expect(model.edges).toHaveLength(1);
    expect(model.edges[0]).toMatchObject({
      from: 'ui', to: 'data', imports: { state: 'partial', value: 1, reason: RELATION_CYCLES_NOT_REPORTED },
    });
  });

  it('the cycles card still reads not analysed (unchanged: the Cycles tab keeps the cycle-only gate)', () => {
    const model = buildArchitectureModel(boundaryOnlyGraph, []);
    expect(model.cards.find((c) => c.id === 'cycles')!.caption).toBe(ARCH_NOT_ANALYSED_NO_SECTION);
  });

  it('the evidenced-imports card is partial, with the edge count and RELATION_CYCLES_NOT_REPORTED', () => {
    const model = buildArchitectureModel(boundaryOnlyGraph, []);
    const card = model.cards.find((c) => c.id === 'evidenced')!;
    expect(card.value).toMatchObject({ state: 'partial', value: 1, reason: RELATION_CYCLES_NOT_REPORTED });
  });

  it('a rule of yours with no evidenced crossing reads RULE_NOT_EVALUATED_PARTIAL, not FALLOW_NOT_ANALYSED', () => {
    const [evaluation] = evaluateRules([rule('core', 'ui')], boundaryOnlyGraph);
    expect(evaluation).toMatchObject({ status: 'not-evaluated', reason: RULE_NOT_EVALUATED_PARTIAL });
  });

  it('without a report, both gates stay not analysed, exactly as today', () => {
    const model = buildArchitectureModel(noReportGraph, []);
    expect(model.notAnalysed).toBe(true);
    expect(model.cyclesNotAnalysed).toBe(true);
  });

  it('with a report that has no check section at all, both gates stay not analysed, exactly as today', () => {
    const healthOnlyReport = reportFor(snapshot.snapshotId, 'health-3.27.0');
    const healthRelations = relationModelFor(files, evidenceIndexFor(files, healthOnlyReport, snapshot.snapshotId));
    const model = buildArchitectureModel(architectureGraphFor(files, healthRelations), []);
    expect(model.notAnalysed).toBe(true);
    expect(model.cyclesNotAnalysed).toBe(true);
  });
});

describe('critical fix #1: a boundary count is never a false collected 0', () => {
  it('relations-combined-3.21.0 with violations emptied reads unknown (JF2\'s schema<12 ambiguity: cycles were reported, boundaries were not)', () => {
    const doc = fallowDoc('relations-combined-3.21.0', (d) => {
      (d.check! as unknown as { boundary_violations: unknown[] }).boundary_violations = [];
    });
    const emptiedReport = buildEvidenceReport({
      raw: rawReport(doc), fileName: 'relations.json', importedAt: IMPORTED_AT, snapshotId: snapshot.snapshotId, stripPrefix: 'src/',
    });
    const rel = relationModelFor(files, evidenceIndexFor(files, emptiedReport, snapshot.snapshotId));
    expect(rel.boundaries).toBe('not-reported');
    expect(rel.analysed).toBe(true);
    const model = buildArchitectureModel(architectureGraphFor(files, rel), []);
    expect(model.cards.find((c) => c.id === 'violations')!.value).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
  });

  it('combined-3.21.0 (schema 11, no diagnostics, empty violations) reads unknown, not a measured 0', () => {
    const generic = buildSnapshotFixture({ files: 5 });
    const genFiles = fileSummariesFor(generic);
    const genReport = buildEvidenceReport({
      raw: rawReport('combined-3.21.0'), fileName: 'combined.json', importedAt: IMPORTED_AT, snapshotId: generic.snapshotId, stripPrefix: null,
    });
    const rel = relationModelFor(genFiles, evidenceIndexFor(genFiles, genReport, generic.snapshotId));
    expect(rel.boundaries).toBe('not-reported');
    expect(rel.analysed).toBe(true);
    const model = buildArchitectureModel(architectureGraphFor(genFiles, rel), []);
    expect(model.cards.find((c) => c.id === 'violations')!.value).toMatchObject({ state: 'unknown', reason: FALLOW_NOT_ANALYSED });
  });
});

describe('rules (N23)', () => {
  it('a matched crossing is a violation with the matched count', () => {
    const [evaluation] = evaluateRules([rule('ui', 'data')], graph);
    expect(evaluation).toMatchObject({ status: 'violation', violatingImports: { state: 'collected', value: 1 }, reason: null });
  });
  it('an in-graph pair with no matched crossing is not-evaluated, RULE_NOT_EVALUATED_PARTIAL', () => {
    const [evaluation] = evaluateRules([rule('core', 'ui')], graph);
    expect(evaluation).toMatchObject({ status: 'not-evaluated', reason: RULE_NOT_EVALUATED_PARTIAL });
    expect(evaluation!.violatingImports).toMatchObject({ state: 'unknown', reason: RULE_NOT_EVALUATED_PARTIAL, provenance: { source: 'fallow' } });
  });
  it('a module outside the shown graph is not-evaluated, RULE_NOT_EVALUATED_REASON', () => {
    const [evaluation] = evaluateRules([rule('nope', 'data')], graph);
    expect(evaluation).toMatchObject({ status: 'not-evaluated', reason: RULE_NOT_EVALUATED_REASON });
  });
  it('without a report, an in-graph pair is not-evaluated, FALLOW_NOT_ANALYSED, sourced from fallow', () => {
    const [evaluation] = evaluateRules([rule('ui', 'data')], noReportGraph);
    expect(evaluation).toMatchObject({ status: 'not-evaluated', reason: FALLOW_NOT_ANALYSED });
    expect(evaluation!.violatingImports.provenance.source).toBe('fallow');
  });
  it('no rule is ever passing', () => {
    const evaluations = evaluateRules([rule('ui', 'data'), rule('core', 'ui', 'AR-002'), rule('nope', 'data', 'AR-003')], graph);
    expect(evaluations.length).toBeGreaterThan(0);
    expect(evaluations.every((e) => e.status !== ('passing' as RuleStatus))).toBe(true);
  });
});

describe('Overview (N26)', () => {
  it('the architecture card equals cyclesValue(relations), captioned with the pluralised violation count', () => {
    const model = buildOverviewModel(snapshot, files, cyclesValue(relations), evidence, undefined, relations);
    expect(model.cards.find((c) => c.id === 'architecture')!.value).toEqual(cyclesValue(relations));
    expect(model.cards.find((c) => c.id === 'architecture')!.caption).toBe('Import cycles · 1 boundary violation');
  });
  it('the imports row is partial, sourced from fallow, with a report', () => {
    const model = buildOverviewModel(snapshot, files, cyclesValue(relations), evidence, undefined, relations);
    expect(model.coverage.find((r) => r.id === 'imports')).toMatchObject({ label: OVERVIEW_IMPORTS_ROW, state: 'partial', source: EVIDENCE_SOURCE_FALLOW_PARTIAL });
  });
  it('the imports row is unknown, "Not analysed", without a report', () => {
    const model = buildOverviewModel(snapshot, files, cyclesValue(noReportRelations), noReportEvidence, undefined, noReportRelations);
    const row = model.coverage.find((r) => r.id === 'imports')!;
    expect(row.state).toBe('unknown');
    expect(row.source).toBe('Not analysed');
  });
  it('fix round 1 #3: the caption reads "—", never a false 0, without a report', () => {
    const model = buildOverviewModel(snapshot, files, cyclesValue(noReportRelations), noReportEvidence, undefined, noReportRelations);
    expect(model.cards.find((c) => c.id === 'architecture')!.caption).toBe('Import cycles · —');
  });
  it('fix round 1 #3: the caption reads "boundaries not configured" only for that specific reason', () => {
    const noBoundariesReport = reportFor(snapshot.snapshotId, 'relations-no-boundaries-3.27.0');
    const ev = evidenceIndexFor(files, noBoundariesReport, snapshot.snapshotId);
    const rel = relationModelFor(files, ev);
    const model = buildOverviewModel(snapshot, files, cyclesValue(rel), ev, undefined, rel);
    expect(model.cards.find((c) => c.id === 'architecture')!.caption).toBe(`Import cycles · ${ARCH_VIOLATIONS_NOT_CONFIGURED}`);
  });
});

describe('Data & scans (N26)', () => {
  it('the imports provider row is partial with a report, unknown ("Not analysed") without one, never sample', () => {
    const withReport = buildSourcesModel(snapshot, IDLE, undefined, relations);
    expect(withReport.providers.find((p) => p.id === 'imports')).toMatchObject({ state: 'partial', source: EVIDENCE_SOURCE_FALLOW_PARTIAL });
    const withoutReport = buildSourcesModel(snapshot, IDLE, undefined, noReportRelations);
    // E9/N26: the SAME "Not analysed" wording Overview uses, never "Not collected".
    expect(withoutReport.providers.find((p) => p.id === 'imports')).toMatchObject({ state: 'unknown', source: 'Not analysed' });
  });
});

describe('stale evidence, Overview and Data & scans agree (Review Focus 5, E9)', () => {
  const staleReport = reportFor('other-snapshot');
  const staleEvidence = evidenceIndexFor(files, staleReport, snapshot.snapshotId);
  const staleRelations = relationModelFor(files, staleEvidence);

  it('the Overview imports row reads stale', () => {
    const model = buildOverviewModel(snapshot, files, cyclesValue(staleRelations), staleEvidence, undefined, staleRelations);
    expect(model.coverage.find((r) => r.id === 'imports')).toMatchObject({ state: 'stale', source: EVIDENCE_SOURCE_FALLOW_PARTIAL });
  });
  it('the Data & scans imports row reads stale', () => {
    const model = buildSourcesModel(snapshot, IDLE, undefined, staleRelations);
    expect(model.providers.find((p) => p.id === 'imports')!.state).toBe('stale');
  });
});

describe('the sample module edges file is gone', () => {
  it('src/ui/fixtures/sample-module-edges.ts no longer exists', () => {
    expect(existsSync('src/ui/fixtures/sample-module-edges.ts')).toBe(false);
  });
});
