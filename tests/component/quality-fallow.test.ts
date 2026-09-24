// Part 6 Y32/Y35: Code quality over an imported fallow report — the Not-analysed state, the
// badge, the tool's severities, per-finding titles, the kind filter, CSV provenance, the
// stale notice, the review dialog's provider and rule rows, and imported text as text.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import QualityScreen from '../../src/ui/screens/QualityScreen.vue';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { formatAbsoluteTime } from '../../src/ui/copy';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import {
  COPY_16, EVIDENCE_BADGE, FALLOW_IMPORT_ACTION, FALLOW_NOT_ANALYSED, FALLOW_NOT_ANALYSED_TITLE, FINDING_DIALOG_PROVIDER_VALUE,
  FINDING_KIND_LABEL, QUALITY_CARD_COMPLEXITY, QUALITY_NO_FINDINGS_REPORTED, SEVERITY_LABEL,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { SYNTHETIC_VERSION, attachSyntheticReport, snapshotWithPaths } from '../fixtures/evidence-report';

const mountQ = () => mount(QualityScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
function withSnapshot(): CodebaseSnapshot {
  const snap = buildSnapshotFixture({ files: 10, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
}
const rowWith = (w: ReturnType<typeof mountQ>, text: string) => w.findAll('.ci-table__row').find((r) => r.text().includes(text));
const csvRows = (call: number): string[] => vi.mocked(downloadText).mock.calls[call]![2].split(/\r?\n/).filter((l) => l !== '').slice(1);

describe('Code quality over a fallow report (Part 6 Y35)', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('without a report: Not analysed replaces the table, no card reads 0, and Import report asks Data & scans for the dialog', async () => {
    withSnapshot();
    const w = mountQ();
    expect(w.find('.ci-not-analysed__title').text()).toBe(FALLOW_NOT_ANALYSED_TITLE);
    expect(w.find('.ci-findings-table').exists()).toBe(false);
    expect(w.find('.ci-evidence-badge').exists()).toBe(false);
    const values = w.findAll('.ci-metric-card__value').map((v) => v.text());
    expect(values).toHaveLength(5);
    expect(values.every((v) => v !== '0')).toBe(true);
    expect(w.findAll('.ci-metric-card .ci-provenance--unknown')).toHaveLength(5);
    // E13: blocked with aria-disabled (another leaf can drop the report while it has focus), and a press exports nothing.
    const exportButton = w.find('.ci-quality__export');
    expect(exportButton.attributes('aria-disabled')).toBe('true');
    expect(exportButton.attributes('disabled')).toBeUndefined();
    await exportButton.trigger('click');
    expect(downloadText).not.toHaveBeenCalled();
    const button = w.find('.ci-not-analysed__import');
    expect(button.text()).toBe(FALLOW_IMPORT_ACTION);
    await button.trigger('click');
    expect(useCityStore().route).toBe('sources');
    expect(useEvidenceStore().importRequested).toBe(true);
    w.unmount();
  });

  it('with a report: the badge heads the screen, each row has its own title and the tool\'s severity', () => {
    attachSyntheticReport(withSnapshot());
    const w = mountQ();
    expect(w.find('.ci-quality__evidence .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'imported'));
    expect(w.find('.ci-not-analysed').exists()).toBe(false);
    expect(w.findAll('.ci-table__row')).toHaveLength(19);
    const complexity = rowWith(w, 'fn0 · Cognitive complexity 20 (threshold 15)');
    expect(complexity?.find('.ci-severity').text()).toBe(SEVERITY_LABEL.critical);
    expect(complexity?.find('.ci-severity').classes()).toContain('ci-severity--critical');
    const unused = rowWith(w, 'symbol1 · Unused export');
    expect(unused?.find('.ci-severity').text()).toBe(SEVERITY_LABEL.unrated);
    expect(unused?.find('.ci-findings-table__evidence').text()).toBe('Unused export');
    expect(rowWith(w, 'symbol3 · Unused type')?.find('.ci-findings-table__evidence').text()).toBe('Unused type');
    expect(rowWith(w, 'Duplicated block · 4 lines')).toBeDefined();
    w.unmount();
  });

  it('a report with no finding on screen says none were reported, not "no match" with a Reset (E14)', async () => {
    const snap = withSnapshot();
    // Same codebase and snapshot, but every finding sits on a path this snapshot does not have.
    attachSyntheticReport(snapshotWithPaths(['elsewhere/orphan.ts'], snap.repositoryId), { snapshotId: snap.snapshotId });
    const w = mountQ();
    expect(w.find('.ci-quality__evidence .ci-evidence-badge').exists()).toBe(true);
    expect(w.find('.ci-not-analysed').exists()).toBe(false);
    expect(w.find('.ci-quality__none').text()).toBe(QUALITY_NO_FINDINGS_REPORTED);
    expect(w.find('.ci-findings-table__none').exists()).toBe(false);
    expect(w.find('.ci-findings-table__reset').exists()).toBe(false);
    w.unmount();

    // Findings that the filters hide keep the no-match state and its Reset.
    attachSyntheticReport(snap);
    const f = mountQ();
    await f.find('.ci-finding-filters__status').setValue('dismissed');
    expect(f.find('.ci-findings-table__none').exists()).toBe(true);
    expect(f.find('.ci-findings-table__reset').exists()).toBe(true);
    expect(f.find('.ci-quality__none').exists()).toBe(false);
    f.unmount();
  });

  it('the severity filter lists the severities the model holds, in rank order, "Not rated" last (R6)', async () => {
    const snap = withSnapshot();
    attachSyntheticReport(snap);
    const w = mountQ();
    const options = w.findAll('.ci-finding-filters__severity option');
    expect(options.map((o) => o.attributes('value'))).toEqual(['', 'critical', 'high', 'moderate', 'unrated']);
    expect(options[4]!.text()).toBe(SEVERITY_LABEL.unrated);
    await w.find('.ci-finding-filters__severity').setValue('unrated');
    const rows = w.findAll('.ci-table__row');
    expect(rows).toHaveLength(14);
    expect(rows.every((r) => r.find('.ci-severity').text() === SEVERITY_LABEL.unrated)).toBe(true);
    w.unmount();

    // A report that rates nothing offers only "Not rated": the options are the model's, not a fixed list.
    attachSyntheticReport(snap, { kind: 'dead-code' });
    const d = mountQ();
    expect(d.findAll('.ci-finding-filters__severity option').map((o) => o.attributes('value'))).toEqual(['', 'unrated']);
    d.unmount();
  });

  it('the kind filter covers both unused rules; a category the report did not analyse reads Unknown and stays listed', async () => {
    const snap = withSnapshot();
    attachSyntheticReport(snap);
    const w = mountQ();
    await w.find('.ci-finding-filters__kind').setValue('unused-exports');
    const rows = w.findAll('.ci-table__row');
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => ['Unused export', 'Unused type'].includes(r.find('.ci-findings-table__evidence').text()))).toBe(true);
    w.unmount();

    attachSyntheticReport(snap, { kind: 'dead-code' });
    const d = mountQ();
    expect(d.find('.ci-not-analysed').exists()).toBe(false);
    const card = d.findAll('.ci-metric-card').find((c) => c.text().includes(QUALITY_CARD_COMPLEXITY));
    expect(card?.find('.ci-provenance--unknown').exists()).toBe(true);
    expect(card?.find('.ci-metric-card__reason').text()).toBe(FALLOW_NOT_ANALYSED);
    expect(d.findAll('.ci-finding-filters__kind option').map((o) => o.text())).toContain(FINDING_KIND_LABEL.complexity);
    d.unmount();
  });

  // E40: a mounted-screen regression pin for Task 8's findingsCsv (it passes before Task 9, like the A9 exemption).
  it('exports the rule, "reported" lines and the report\'s provenance, "stale" once the report predates the snapshot', async () => {
    const snap = withSnapshot();
    attachSyntheticReport(snap);
    const w = mountQ();
    expect(w.find('.ci-quality__export').attributes('aria-disabled')).toBeUndefined();
    await w.find('.ci-quality__export').trigger('click');
    expect(vi.mocked(downloadText).mock.calls[0]![2]).toContain('id,path,module,kind,rule,severity,line,line_state,status,reason,provenance');
    const rows = csvRows(0);
    expect(rows).toHaveLength(19);
    expect(rows.every((l) => l.endsWith(`,fallow ${SYNTHETIC_VERSION} imported`))).toBe(true);
    expect(rows.some((l) => l.includes(',unused-exports,unused-export,unrated,1,reported,open,'))).toBe(true);
    attachSyntheticReport(snap, { snapshotId: 'snapshot-older' });
    await nextTick();
    await w.find('.ci-quality__export').trigger('click');
    const stale = csvRows(1);
    expect(stale.length).toBeGreaterThan(0);
    expect(stale.every((l) => l.endsWith(`,fallow ${SYNTHETIC_VERSION} stale`))).toBe(true);
    w.unmount();
  });

  it('stale evidence stays on screen with the COPY-16 notice, a Stale badge and a stale mark on each row (Y30)', () => {
    const report = attachSyntheticReport(withSnapshot(), { snapshotId: 'snapshot-older' });
    const w = mountQ();
    expect(w.find('.ci-callout').text()).toContain(COPY_16(formatAbsoluteTime(report.importedAt, Intl)));
    expect(w.find('.ci-quality__evidence .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'stale'));
    const rows = w.findAll('.ci-table__row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.find('.ci-findings-table__evidence .ci-provenance--stale').exists())).toBe(true);
    w.unmount();
  });

  it('the review dialog names the provider, the date and the rule with its thresholds; nothing is "Illustrative"', async () => {
    const report = attachSyntheticReport(withSnapshot());
    const w = mountQ();
    await rowWith(w, 'fn0 ·')!.find('.ci-findings-table__open').trigger('click');
    const meta = w.find('.ci-finding-dialog__meta').text();
    expect(meta).toContain(FINDING_DIALOG_PROVIDER_VALUE(SYNTHETIC_VERSION, formatAbsoluteTime(report.importedAt, Intl)));
    expect(meta).toContain('cognitive 20 (threshold 15), cyclomatic 12 (threshold 20)');
    expect(meta).toContain('Reported above threshold.');
    expect(w.find('.ci-finding-dialog__chips .ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'imported'));
    expect(w.find('.ci-finding-dialog').text()).not.toContain('Illustrative');
    w.unmount();
  });

  it('renders an imported symbol that looks like HTML as literal text, in the table and the review dialog (spec §4)', async () => {
    const symbol = '<img src=x onerror=alert(1)>';
    attachSyntheticReport(withSnapshot(), { symbol });
    const w = mountQ();
    const row = rowWith(w, `${symbol} · Unused export`);
    expect(row).toBeDefined();
    expect(w.find('.ci-findings-table img').exists()).toBe(false);
    expect(w.find('.ci-findings-table').html()).toContain('&lt;img');
    await row!.find('.ci-findings-table__open').trigger('click');
    const summary = w.find('.ci-finding-dialog__summary');
    expect(summary.text()).toBe(`${symbol} · Unused export`);
    expect(summary.html()).toContain('&lt;img');
    expect(w.find('.ci-finding-dialog img').exists()).toBe(false);
    w.unmount();
  });

  it('a severity the new report lacks falls back to all severities, so the select never misstates the filter (fix round 1)', async () => {
    const snap = withSnapshot();
    attachSyntheticReport(snap);
    const w = mountQ();
    const select = w.find<HTMLSelectElement>('.ci-finding-filters__severity');
    await select.setValue('high');
    expect(w.findAll('.ci-table__row').length).toBeGreaterThan(0);
    attachSyntheticReport(snap, { kind: 'dead-code' });   // rates nothing: no "high" any more
    await nextTick();
    await nextTick();
    expect(select.element.value).toBe('');
    expect(w.findAll('.ci-table__row')).toHaveLength(10);
    w.unmount();
  });
});
