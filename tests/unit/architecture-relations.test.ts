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
  architectureGraphFor, buildArchitectureModel, cycleModules, cyclesValue, evaluateRules, type RuleStatus,
} from '../../src/ui/read-models/architecture';
import { buildOverviewModel } from '../../src/ui/read-models/overview';
import { buildSourcesModel } from '../../src/ui/read-models/sources';
import {
  EVIDENCE_SOURCE_FALLOW_PARTIAL, FALLOW_NOT_ANALYSED, OVERVIEW_IMPORTS_ROW, RELATIONS_SCOPE_SHORT,
  RELATION_CYCLES_CAPTION, RULE_NOT_EVALUATED_PARTIAL, RULE_NOT_EVALUATED_REASON,
} from '../../src/ui/inspector-copy';
import type { BoundaryRule } from '../../src/ui/stores/ports/review-repository';
import { rawReport } from '../fixtures/fallow-fixture';
import { snapshotWithPaths } from '../fixtures/evidence-report';

const RELATIONS_PATHS = [
  'core/a.ts', 'core/b.ts', 'core/c.ts',
  'barrel/index.ts', 'barrel/x.ts', 'barrel/y.ts',
  'ui/view.ts', 'data/db.ts', 'data/types.ts',
  'index.ts', 'orphan.ts',
];
const IMPORTED_AT = '2026-09-24T10:00:00.000Z';
const IDLE = { status: 'idle' as const };
const rule = (from: string, to: string, id = 'AR-001'): BoundaryRule => ({ id, from, to, rationale: 'r', createdAt: IMPORTED_AT });

function reportFor(snapshotId: string): EvidenceReport {
  return buildEvidenceReport({
    raw: rawReport('relations-combined-3.27.0'), fileName: 'relations.json', importedAt: IMPORTED_AT, snapshotId, stripPrefix: 'src/',
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
  it('the cycle card counts import cycles (collected) with the recorded files/groups/re-exports', () => {
    const model = buildArchitectureModel(graph, []);
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

  it('the violations card adds fallow\'s own reported violation to your own violated rules', () => {
    const withRule = buildArchitectureModel(graph, [rule('ui', 'data')]);
    // fallow's 1 reported violation + your one violated rule's 1 violating import.
    expect(withRule.cards.find((c) => c.id === 'violations')!.value).toMatchObject({ state: 'collected', value: 2 });
    const withoutRule = buildArchitectureModel(graph, []);
    expect(withoutRule.cards.find((c) => c.id === 'violations')!.value).toMatchObject({ state: 'collected', value: 1 });
  });

  it('without a report, every relation card is unknown(FALLOW_NOT_ANALYSED), edges is empty, modules stay collected', () => {
    const model = buildArchitectureModel(noReportGraph, []);
    expect(model.edges).toEqual([]);
    for (const id of ['evidenced', 'cycles', 'violations'] as const) {
      expect(model.cards.find((c) => c.id === id)).toMatchObject({ value: { state: 'unknown', reason: FALLOW_NOT_ANALYSED } });
    }
    expect(model.cards.find((c) => c.id === 'modules')).toMatchObject({ value: { state: 'collected' } });
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
    expect(evaluation!.violatingImports.state).toBe('unknown');
  });
  it('a module outside the shown graph is not-evaluated, RULE_NOT_EVALUATED_REASON', () => {
    const [evaluation] = evaluateRules([rule('nope', 'data')], graph);
    expect(evaluation).toMatchObject({ status: 'not-evaluated', reason: RULE_NOT_EVALUATED_REASON });
  });
  it('without a report, an in-graph pair is not-evaluated, FALLOW_NOT_ANALYSED', () => {
    const [evaluation] = evaluateRules([rule('ui', 'data')], noReportGraph);
    expect(evaluation).toMatchObject({ status: 'not-evaluated', reason: FALLOW_NOT_ANALYSED });
  });
  it('no rule is ever passing', () => {
    const evaluations = evaluateRules([rule('ui', 'data'), rule('core', 'ui', 'AR-002'), rule('nope', 'data', 'AR-003')], graph);
    expect(evaluations.length).toBeGreaterThan(0);
    expect(evaluations.every((e) => e.status !== ('passing' as RuleStatus))).toBe(true);
  });
});

describe('Overview (N26)', () => {
  it('the architecture card equals cyclesValue(relations)', () => {
    const model = buildOverviewModel(snapshot, files, cyclesValue(relations), evidence, undefined, relations);
    expect(model.cards.find((c) => c.id === 'architecture')!.value).toEqual(cyclesValue(relations));
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
});

describe('Data & scans (N26)', () => {
  it('the imports provider row is partial with a report, unknown without one, never sample', () => {
    const withReport = buildSourcesModel(snapshot, IDLE, undefined, relations);
    expect(withReport.providers.find((p) => p.id === 'imports')!.state).toBe('partial');
    const withoutReport = buildSourcesModel(snapshot, IDLE, undefined, noReportRelations);
    expect(withoutReport.providers.find((p) => p.id === 'imports')!.state).toBe('unknown');
  });
});

describe('the sample module edges file is gone', () => {
  it('src/ui/fixtures/sample-module-edges.ts no longer exists', () => {
    expect(existsSync('src/ui/fixtures/sample-module-edges.ts')).toBe(false);
  });
});
