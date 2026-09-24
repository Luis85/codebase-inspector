import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { makeEntityId } from '../../src/domain/entity-id';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildOverviewModel } from '../../src/ui/read-models/overview';
import { architectureGraphFor, buildArchitectureModel } from '../../src/ui/read-models/architecture';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { relationModelFor } from '../../src/ui/read-models/relations';
import { buildSecurityModel } from '../../src/ui/read-models/security';
import { buildReportModel, includedSections, reportMarkdown } from '../../src/ui/read-models/report';
import { buildWorkbenchModel, planMarkdown, targetMarkdown } from '../../src/ui/read-models/work-items';
import { REPORT_NOTE_MAX, useReportStore } from '../../src/ui/stores/report-store';
import { NO_CHECKS } from '../../src/ui/stores/ports/review-repository';
import {
  FALLOW_NOT_ANALYSED, RELATIONS_SCOPE_NOTE, REPORT_EVIDENCE_TEXT, REPORT_LIMITS, REPORT_RULES_TITLE, RULE_STATUS_LABEL,
} from '../../src/ui/inspector-copy';

function model() {
  const snapshot = buildSnapshotFixture({ files: 40, directories: 3 });
  const files = fileSummariesFor(snapshot);
  const relations = relationModelFor(files, evidenceIndexFor(files, null, snapshot.snapshotId));
  const graph = architectureGraphFor(files, relations);
  const plan = buildWorkbenchModel([{
    id: 'wi-1', target: { kind: 'package', name: '@sample/a|b' }, intent: 'review', title: 'Review a',
    status: 'planned', priority: 'high', notes: '', checks: NO_CHECKS, createdAt: '2026-09-22T10:00:00.000Z',
  }], files, '').rows;
  return buildReportModel({ snapshot, files, overview: buildOverviewModel(snapshot, files), architecture: buildArchitectureModel(graph, []), security: buildSecurityModel(), plan });
}
const ALL = { summary: true, architecture: true, hotspots: true, security: true, plan: true };

describe('report model and Markdown (Part 4 W6/W7)', () => {
  it('builds collected facts and reuses the screen models, with no composite score', () => {
    const m = model();
    expect(m.summary[0]).toMatchObject({ value: { state: 'collected', value: 40 } });
    expect(m.hotspots.length).toBeGreaterThan(0);
    expect(m.hotspots.length).toBeLessThanOrEqual(5);
    expect(JSON.stringify(m)).not.toMatch(/health score|overall score/i);
  });
  it('numbers the included sections in order and leaves out the excluded ones', () => {
    const md = reportMarkdown(model(), { ...ALL, architecture: false }, '');
    expect(md).toContain('## 01 / Executive summary');
    expect(md).toContain('## 02 / Quality hotspots');
    expect(md).not.toContain('Architecture review');
    expect(includedSections({ ...ALL, summary: false, plan: false })).toEqual(['architecture', 'hotspots', 'security']);
  });
  it('labels sample values, writes unknown values with their reason and never as 0', () => {
    const md = reportMarkdown(model(), ALL, '');
    expect(md).toContain('(sample)');
    const secrets = md.split('\n').find((l) => l.startsWith('- Secret'));
    expect(secrets).toBeDefined();
    expect(secrets).toMatch(/unknown \(/);
    expect(secrets).not.toMatch(/: 0\b/);
    expect(md).toContain('Includes sample data');
  });
  it('escapes table cells and quotes the reviewer note; always has limitations', () => {
    const md = reportMarkdown(model(), ALL, 'Line one\n# two');
    expect(md).toContain('> Line one\n> \\# two');
    expect(md).toContain('## Scope and limitations');
  });
  // One plan-target helper (targetMarkdown): a package/module target is a code span,
  // never a raw pipe-escaped cell — refactor-plan.md and the report agree on its form.
  it('a package target renders identically in the plan export and the report export', () => {
    const snapshot = buildSnapshotFixture({ files: 40, directories: 3 });
    const files = fileSummariesFor(snapshot);
    const rows = buildWorkbenchModel([{
      id: 'wi-1', target: { kind: 'package', name: '@sample/a|b' }, intent: 'review', title: 'Review a',
      status: 'planned', priority: 'high', notes: '', checks: NO_CHECKS, createdAt: '2026-09-22T10:00:00.000Z',
    }], files, '').rows;
    const rendered = targetMarkdown(rows[0]!);
    expect(rendered).toBe('Package `@sample/a|b`');
    const plan = planMarkdown(rows, 'root');
    const md = reportMarkdown(model(), ALL, '');
    expect(plan).toContain(rendered);
    expect(md).toContain(rendered);
  });
  // A path containing '|' must not add a phantom column to the hotspots table: the
  // fenced code span is pipe-escaped same as any other cell.
  it('escapes a pipe in a hotspot path so the table row keeps its column count', () => {
    const m = model();
    const withPipe = { ...m, hotspots: [{ ...m.hotspots[0]!, path: 'src/weird|file.ts' }] };
    const md = reportMarkdown(withPipe, ALL, '');
    const row = md.split('\n').find((l) => l.includes('weird'));
    expect(row).toBeDefined();
    expect(row).toContain('weird\\|file.ts');
    // Five cells means exactly six UNESCAPED '|' separators (leading, four between, trailing).
    expect((row!.match(/(?<!\\)\|/g) ?? []).length).toBe(6);
  });
  it('WP-03 final review #4: import relations are fallow evidence, never sample, and the Architecture metrics carry the scope note (N5)', () => {
    expect(REPORT_EVIDENCE_TEXT).not.toMatch(/import edges/);
    expect(REPORT_EVIDENCE_TEXT).toContain('import relations');
    expect(REPORT_EVIDENCE_TEXT).toContain('History, coverage and packages are sample data.');
    expect(REPORT_LIMITS).not.toMatch(/every other signal here is sample data/i);
    expect(REPORT_LIMITS).toContain('History, coverage and packages are sample data');
    const md = reportMarkdown(model(), ALL, '');
    const architecture = md.slice(md.indexOf('Architecture review'), md.indexOf('Quality hotspots'));
    expect(architecture).toContain(RELATIONS_SCOPE_NOTE);
    // After the metric lines, before the rules.
    expect(architecture.indexOf(RELATIONS_SCOPE_NOTE)).toBeLessThan(architecture.indexOf(REPORT_RULES_TITLE));
    expect(architecture.lastIndexOf('\n- ', architecture.indexOf(RELATIONS_SCOPE_NOTE))).toBeGreaterThan(-1);
    expect(reportMarkdown(model(), { ...ALL, architecture: false }, '')).not.toContain(RELATIONS_SCOPE_NOTE);
  });
  it('WP-03 final review #4 (N23): a rule\'s status is its own evaluation, never "(sample edges)"', () => {
    const snapshot = buildSnapshotFixture({ files: 40, directories: 3 });
    const files = fileSummariesFor(snapshot);
    const graph = architectureGraphFor(files, relationModelFor(files, evidenceIndexFor(files, null, snapshot.snapshotId)));
    const [a, b] = graph.modules;
    const rule = { id: 'R-1', from: a!.name, to: b!.name, rationale: 'kept apart', createdAt: '2026-09-22T10:00:00.000Z' };
    const m = buildReportModel({
      snapshot, files, overview: buildOverviewModel(snapshot, files), architecture: buildArchitectureModel(graph, [rule]),
      security: buildSecurityModel(), plan: [],
    });
    expect(m.rules[0]!.status).toBe(`${RULE_STATUS_LABEL['not-evaluated']} (${FALLOW_NOT_ANALYSED})`);
    expect(reportMarkdown(m, ALL, '')).not.toContain('sample edges');
  });
  it('fix round 1 #5: marks a plan item whose file target left the snapshot, in Markdown too', () => {
    const snapshot = buildSnapshotFixture({ files: 40, directories: 3 });
    const files = fileSummariesFor(snapshot);
    const relations = relationModelFor(files, evidenceIndexFor(files, null, snapshot.snapshotId));
    const graph = architectureGraphFor(files, relations);
    const missingId = makeEntityId(snapshot.repositoryId, 'file', 'ghost.ts');
    const plan = buildWorkbenchModel([{
      id: 'wi-2', target: { kind: 'file', entityId: missingId }, intent: 'refactor', title: 'Ghost file',
      status: 'investigate', priority: 'low', notes: '', checks: NO_CHECKS, createdAt: '2026-09-22T10:00:00.000Z',
    }], files, '').rows;
    const m = buildReportModel({
      snapshot, files, overview: buildOverviewModel(snapshot, files), architecture: buildArchitectureModel(graph, []),
      security: buildSecurityModel(), plan,
    });
    const md = reportMarkdown(m, ALL, '');
    expect(md).toContain('Not in this snapshot');
  });
});

describe('report store (Part 4 W1)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  it('toggles sections, applies a trimmed note, refuses an over-long one and resets', () => {
    const r = useReportStore();
    r.setSection('security', false);
    expect(r.sections.security).toBe(false);
    expect(r.applyNote('  hi  ')).toBe(true);
    expect(r.note).toBe('hi');
    expect(r.applyNote('x'.repeat(REPORT_NOTE_MAX + 1))).toBe(false);
    expect(r.note).toBe('hi');
    r.reset();
    expect(r.sections.security).toBe(true);
    expect(r.note).toBe('');
  });
  it('Part 4 E8 as amended by Part 5 V10: a new codebase starts from the defaults, the note never crosses codebases, and a round trip restores each one\'s own choices', () => {
    const r = useReportStore();
    r.bindRepository('repo-a');
    r.setSection('security', false);
    expect(r.applyNote('about repo-a')).toBe(true);

    r.bindRepository('repo-b');
    expect(r.note).toBe('');
    expect(r.sections).toEqual({ summary: true, architecture: true, hotspots: true, security: true, plan: true });

    r.setSection('plan', false);
    expect(r.applyNote('about repo-b')).toBe(true);
    r.bindRepository('repo-b');
    expect(r.note).toBe('about repo-b');
    expect(r.sections.plan).toBe(false);

    r.bindRepository('repo-a');
    expect(r.note).toBe('about repo-a');
    expect(r.sections).toEqual({ summary: true, architecture: true, hotspots: true, security: false, plan: true });
    r.bindRepository('repo-b');
    expect(r.note).toBe('about repo-b');
    expect(r.sections.plan).toBe(false);
  });
});
