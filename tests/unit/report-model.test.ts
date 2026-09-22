import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { buildOverviewModel } from '../../src/ui/read-models/overview';
import { architectureGraphFor, buildArchitectureModel } from '../../src/ui/read-models/architecture';
import { buildSecurityModel } from '../../src/ui/read-models/security';
import { buildReportModel, includedSections, reportMarkdown } from '../../src/ui/read-models/report';
import { buildWorkbenchModel } from '../../src/ui/read-models/work-items';
import { REPORT_NOTE_MAX, useReportStore } from '../../src/ui/stores/report-store';
import { NO_CHECKS } from '../../src/ui/stores/ports/review-repository';

function model() {
  const snapshot = buildSnapshotFixture({ files: 40, directories: 3 });
  const files = fileSummariesFor(snapshot);
  const graph = architectureGraphFor(files);
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
    expect(md).toContain('@sample/a\\|b');
    expect(md).toContain('> Line one\n> \\# two');
    expect(md).toContain('## Scope and limitations');
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
});
