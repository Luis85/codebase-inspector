// WP-04 IN14-IN17: the evidence bundle, uncertainty panel and Add work item.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import InvestigateScreen from '../../src/ui/screens/InvestigateScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { uncertaintiesFor, checklistFor, evidenceBundleFor } from '../../src/ui/read-models/investigation-evidence';
import { cyclePathText } from '../../src/ui/read-models/relations';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { formatAbsoluteTime } from '../../src/ui/copy';
import {
  FINDING_DIALOG_RULE_VALUE, FINDING_OPEN_FILE, FINDING_IN_PLAN, FINDING_ADD_WORK_ITEM, FINDING_RELATED_LABEL, FINDING_LINE_TEXT,
  RELATIONS_SCOPE_NOTE, RULE_TEXT, SEVERITY_TEXT, UNCERTAINTY_LINE_NOT_CHECKED, UNCERTAINTY_REPORT_STALE, INVESTIGATE_ORIGIN_TEXT,
  INVESTIGATE_WORK_TITLE, INVESTIGATE_WORK_NOTES, FINDING_KIND_LABEL, NOTE_EVIDENCE_STATE_TEXT,
} from '../../src/ui/inspector-copy';
import { computeLayout } from '../../src/domain/layout/layout';
import type { FindingCategory } from '../../src/application/evidence/model';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, type SyntheticReportOptions } from '../fixtures/evidence-report';
import { inertInvestigationNotes, scriptedSourcePreview } from '../fixtures/fake-investigation';

function mountScreen() {
  return mount(InvestigateScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
}

async function withReport(fileCount: number, options: SyntheticReportOptions = {}) {
  const snap = buildSnapshotFixture({ files: fileCount, directories: 2 });
  useCityStore().setCity(snap, computeLayout(snap));
  attachSyntheticReport(snap, options);
  useInvestigationStore().setPorts(inertInvestigationNotes(), scriptedSourcePreview());
  useReviewStore().setRepositoryFactory(() => createInMemoryReviewRepository());
  await useReviewStore().bindRepository(snap.repositoryId);
  useCityStore().navigate('investigate');
  return snap;
}

function findingOfKind(kind: FindingCategory) {
  const { investigation } = useReadModels();
  const row = investigation.value.rows.find((r) => r.kind === kind);
  if (!row) throw new Error(`no ${kind} finding in the synthetic report`);
  return row;
}

async function select(kind: FindingCategory) {
  const row = findingOfKind(kind);
  useInvestigationStore().open(row.fingerprint);
  await nextTick();
  return row;
}

describe('Evidence panel (WP-04 IN14)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('shows the finding id, rule, rule detail, severity, location, provider+version, origin, analysed time, snapshot id, state, disposition and reason, and the file\'s work items', async () => {
    await withReport(12);
    const row = await select('unused-exports');
    await useReviewStore().dismiss(row.fingerprint, 'confirmed used dynamically', new Date('2026-09-25T00:00:00Z'));
    await useReviewStore().addWorkItemForFile(row.file.id, 'Refactor plan', new Date('2026-09-25T00:00:00Z'));
    await nextTick();
    const w = mountScreen();
    await nextTick();
    const panel = w.find('.ci-evidence-panel__meta');
    const text = panel.text();
    const { investigation } = useReadModels();
    const bundle = evidenceBundleFor(row, investigation.value.evidence, useReadModels().files.value)!;
    expect(text).toContain(row.id);
    expect(text).toContain(RULE_TEXT(row.rule));
    expect(text).toContain(FINDING_DIALOG_RULE_VALUE(row.rule, row.detail));
    expect(text).toContain(SEVERITY_TEXT(row.severity));
    expect(text).toContain(row.anchorPath);
    expect(text).toContain(FINDING_LINE_TEXT(row.line, row.endLine));
    expect(text).toContain('fallow 3.27.0');
    expect(text).toContain(INVESTIGATE_ORIGIN_TEXT.imported);
    expect(text).toContain(formatAbsoluteTime(bundle.analysedAt, Intl));
    expect(text).toContain(bundle.snapshotId);
    expect(text).toContain(NOTE_EVIDENCE_STATE_TEXT.current);
    expect(text).toContain('confirmed used dynamically');
    expect(text).toContain('Refactor plan');
    w.unmount();
  });

  it('for a relations finding, shows Also involves, the cycle path and RELATIONS_SCOPE_NOTE', async () => {
    await withReport(12);
    const row = await select('cycle');
    const w = mountScreen();
    await nextTick();
    expect(w.text()).toContain(RELATIONS_SCOPE_NOTE);
    const related = w.find('.ci-finding-dialog__related');
    expect(related.exists()).toBe(true);
    expect(related.text()).toContain(FINDING_RELATED_LABEL);
    for (const path of row.related) expect(related.text()).toContain(path);
    const cyclePath = row.detail.kind === 'cycle' && row.detail.cycleKind === 'import' ? cyclePathText(row.detail.hops) : '';
    expect(cyclePath, 'this synthetic cycle finding has hops to assert a path from').not.toBe('');
    expect(related.find('.ci-finding-dialog__cycle-path').text()).toBe(cyclePath);
    w.unmount();
  });

  it('a stale report shows the stale ProvenanceBadge and UNCERTAINTY_REPORT_STALE', async () => {
    await withReport(4, { snapshotId: 'a-different-snapshot' });
    await select('unused-exports');
    const w = mountScreen();
    await nextTick();
    expect(w.find('.ci-provenance--stale').exists()).toBe(true);
    expect(w.text()).toContain(UNCERTAINTY_REPORT_STALE);
    w.unmount();
  });

  // Task 17 review, fix round 1: the chips paragraph rendered unconditionally with only a
  // conditional child, so a current bundle (no badge) left an empty <p> — a visible gap
  // above the summary line the captures showed. It exists only when it has something to show.
  it('the chips paragraph is absent for a current bundle and present for a stale one', async () => {
    await withReport(4);
    await select('unused-exports');
    const current = mountScreen();
    await nextTick();
    expect(current.find('.ci-evidence-panel__chips').exists()).toBe(false);
    current.unmount();

    await withReport(4, { snapshotId: 'a-different-snapshot' });
    await select('unused-exports');
    const stale = mountScreen();
    await nextTick();
    expect(stale.find('.ci-evidence-panel__chips').exists()).toBe(true);
    stale.unmount();
  });
});

describe('Uncertainty and checklist panels (WP-04 IN15/IN16)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('lists uncertaintiesFor(...) in order, with UNCERTAINTY_LINE_NOT_CHECKED before any preview is read, and checklistFor(kind)', async () => {
    await withReport(12);
    const row = await select('complexity');
    const w = mountScreen();
    await nextTick();
    const { investigation } = useReadModels();
    const bundle = evidenceBundleFor(row, investigation.value.evidence, useReadModels().files.value)!;
    const expectedUncertainties = uncertaintiesFor(row, bundle, null);
    expect(expectedUncertainties).toContain(UNCERTAINTY_LINE_NOT_CHECKED);
    const items = w.findAll('.ci-uncertainty-panel__list li').map((li) => li.text());
    expect(items).toEqual(expectedUncertainties);
    const checklistItems = w.findAll('.ci-uncertainty-panel__checklist li').map((li) => li.text());
    expect(checklistItems).toEqual(checklistFor(row.kind));
    w.unmount();
  });
});

describe('Add work item from Investigate (WP-04 IN17/IP22)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('opens WorkItemEditor with the IP22 draft; the notes hold no link syntax; saving adds one work item on the anchor file', async () => {
    await withReport(12);
    const row = await select('unused-exports');
    const w = mountScreen();
    await nextTick();
    const button = w.find('.ci-evidence-panel__add-work-item');
    expect(button.text()).toBe(FINDING_ADD_WORK_ITEM);
    expect(button.attributes('aria-disabled')).toBeUndefined();
    await button.trigger('click');
    await nextTick();
    const expectedTitle = INVESTIGATE_WORK_TITLE(row.id, row.file.name);
    const expectedNotes = INVESTIGATE_WORK_NOTES(FINDING_KIND_LABEL[row.kind], RULE_TEXT(row.rule), row.anchorPath, FINDING_LINE_TEXT(row.line, row.endLine));
    expect((w.find('.ci-work-editor__title').element as HTMLInputElement).value).toBe(expectedTitle);
    expect((w.find('.ci-work-editor__notes').element as HTMLTextAreaElement).value).toBe(expectedNotes);
    expect(expectedNotes).not.toContain('[[');
    expect(expectedNotes).not.toContain('](');
    expect(expectedNotes).not.toContain('://');
    await w.find('.ci-work-editor').trigger('submit');
    await nextTick();
    expect(useReviewStore().workItemsForFile(row.file.id)).toHaveLength(1);
    w.unmount();
  });

  it('reads "In refactor plan" and is aria-disabled with a guarded handler once the file already has one', async () => {
    await withReport(12);
    const row = await select('unused-exports');
    await useReviewStore().addWorkItemForFile(row.file.id, 'Existing item', new Date('2026-09-25T00:00:00Z'));
    await nextTick();
    const w = mountScreen();
    await nextTick();
    const button = w.find('.ci-evidence-panel__add-work-item');
    expect(button.text()).toBe(FINDING_IN_PLAN);
    expect(button.attributes('aria-disabled')).toBe('true');
    await button.trigger('click');
    await nextTick();
    expect(w.find('.ci-work-editor').exists(), 'the guarded handler ignores the press').toBe(false);
    expect(useReviewStore().workItemsForFile(row.file.id)).toHaveLength(1);
    w.unmount();
  });
});

describe('Review finding and Open file detail (WP-04 IP20)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('Review finding opens FindingReviewDialog on the fingerprint', async () => {
    await withReport(12);
    const row = await select('unused-exports');
    const w = mountScreen();
    await nextTick();
    await w.find('.ci-evidence-panel__review').trigger('click');
    await nextTick();
    expect(w.find('.ci-finding-dialog__title .ci-ref-id').text()).toBe(row.id);
    w.unmount();
  });

  it('Open file detail selects the anchor and navigates to file, without moving any camera (there is no renderer)', async () => {
    await withReport(12);
    const row = await select('unused-exports');
    const w = mountScreen();
    await nextTick();
    expect(w.text()).toContain(FINDING_OPEN_FILE);
    await w.find('.ci-evidence-panel__open-file').trigger('click');
    await nextTick();
    expect(useCityStore().selectedEntityId).toBe(row.file.id);
    expect(useCityStore().route).toBe('file');
    w.unmount();
  });
});
