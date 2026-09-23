// Part 6 Y31/Y37/Y39: the fallow card on Data & scans — its state, its diagnostics, the
// Remove confirmation, and the import request from the command or Not analysed.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { formatAbsoluteTime } from '../../src/ui/copy';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import {
  COPY_16, EVIDENCE_BADGE, FALLOW_CARD_NONE, FALLOW_CATEGORY_LINE, FALLOW_IMPORT_HINT, FALLOW_MATCHED, FALLOW_REMOVE_TITLE,
  FALLOW_REMOVED, FALLOW_ROW_CATEGORIES, FALLOW_ROW_FILE, FALLOW_ROW_IMPORTED, FALLOW_ROW_MATCHED, FALLOW_ROW_NOT_SHOWN,
  FALLOW_ROW_REPORT, FALLOW_ROW_UNMATCHED, FALLOW_ROW_WARNINGS, FINDING_KIND_LABEL, FALLOW_NOT_SHOWN_SUMMARY, FALLOW_WARNINGS_SUMMARY,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { SYNTHETIC_VERSION, attachSyntheticReport, syntheticEvidenceReport } from '../fixtures/evidence-report';

const mountS = () => mount(SourcesScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() } },
});
function withSnapshot(repositoryId = 'repo-a'): CodebaseSnapshot {
  const snap = buildSnapshotFixture({ files: 10, directories: 2, repositoryId });
  useCityStore().setCity(snap, computeLayout(snap));
  useEvidenceStore().bindRepository(repositoryId);
  return snap;
}
/** oxlint consistent-function-scoping: the silenced console.warn, hoisted. */
const quiet = (): void => {};
function fresh(): void {
  setActivePinia(createPinia());
  useEvidenceStore().setRepository(new InMemoryEvidenceStore());
  useCityStore().navigate('sources');
}

describe('the fallow card (Part 6 Y37)', () => {
  beforeEach(fresh);

  it('replaces the static card: Unknown and "No report" without one; Import needs a snapshot, Remove needs a report', async () => {
    const w = mountS();
    expect(w.find('.ci-provider--static').exists()).toBe(false);
    const card = w.find('.ci-provider--fallow');
    expect(card.find('.ci-provenance--unknown').exists()).toBe(true);
    expect(card.find('.ci-fallow-card__none').text()).toBe(FALLOW_CARD_NONE);
    const importButton = card.find('.ci-fallow-card__import');
    expect(importButton.attributes('aria-disabled')).toBe('true');
    expect(importButton.attributes('aria-describedby')).toBe(card.find('.ci-fallow-card__hint').attributes('id'));
    expect(card.find('.ci-fallow-card__hint').text()).toBe(FALLOW_IMPORT_HINT);
    await importButton.trigger('click');
    const remove = card.find('.ci-fallow-card__remove');
    expect(remove.attributes('aria-disabled')).toBe('true');
    await remove.trigger('click');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    withSnapshot();
    await nextTick();
    expect(w.find('.ci-fallow-card__import').attributes('aria-disabled')).toBeUndefined();
    expect(w.find('.ci-fallow-card__import').attributes('aria-describedby')).toBeUndefined();
    w.unmount();
  });

  it('lists only the first 20 warnings and not-shown sections, each with a summary giving its total (E48 I3)', async () => {
    const base = syntheticEvidenceReport(withSnapshot());
    const warnings = Array.from({ length: 50 }, (_, i) => `warning ${i}`);
    // The first two sections share a key, so their lines are the same text (never a Vue key).
    const notShown = Array.from({ length: 30 }, (_, i) => ({ key: i < 2 ? 'twice' : `extra_${i}`, count: 1 }));
    expect(useEvidenceStore().attach({ ...base, normalized: { ...base.normalized, warnings, notShown } })).toBe(true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(quiet);
    const w = mountS();
    await flushPromises();
    const card = w.find('.ci-provider--fallow');
    expect(card.findAll('.ci-fallow-facts__warnings li').map((li) => li.text())).toEqual(warnings.slice(0, 20));
    expect(card.find('.ci-fallow-facts__warnings .ci-fallow-facts__more').text()).toBe(FALLOW_WARNINGS_SUMMARY(50, 20));
    expect(card.findAll('.ci-fallow-facts__not-shown li')).toHaveLength(20);
    expect(card.find('.ci-fallow-facts__not-shown .ci-fallow-facts__more').text()).toBe(FALLOW_NOT_SHOWN_SUMMARY(30, 20));
    expect(warn.mock.calls.flat().join(' ')).not.toContain('Duplicate keys');
    warn.mockRestore();
    w.unmount();
  });

  it('with a report: the badge and the diagnostics, every row labelled', () => {
    const snap = withSnapshot();
    const report = attachSyntheticReport(snap, { unmatchedPaths: ['ghost/a.ts'], warning: 'node_modules is missing' });
    const w = mountS();
    const card = w.find('.ci-provider--fallow');
    expect(card.find('.ci-provenance').exists()).toBe(false);
    expect(card.find('.ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'imported'));
    expect(card.findAll('.ci-fallow-facts dt').map((dt) => dt.text())).toEqual([
      FALLOW_ROW_REPORT, FALLOW_ROW_FILE, FALLOW_ROW_IMPORTED, FALLOW_ROW_CATEGORIES, FALLOW_ROW_MATCHED, FALLOW_ROW_UNMATCHED,
      FALLOW_ROW_NOT_SHOWN, FALLOW_ROW_WARNINGS,
    ]);
    expect(card.find('.ci-fallow-facts__file').text()).toBe(report.fileName);
    expect(card.find('.ci-fallow-facts').classes()).not.toContain('ci-fallow-facts--wide');   // E46: stacked at card width
    expect(card.text()).toContain(formatAbsoluteTime(report.importedAt, Intl));
    expect(card.find('.ci-fallow-facts__matched').text()).toBe(FALLOW_MATCHED(19, 10));
    expect(card.findAll('.ci-fallow-facts__unmatched li').map((li) => li.text())).toEqual(['ghost/a.ts']);
    expect(card.find('.ci-fallow-facts__warnings').text()).toBe('node_modules is missing');
    expect(card.find('.ci-fallow-card__remove').attributes('aria-disabled')).toBeUndefined();
    w.unmount();
  });

  it('a dead-code report reads complexity and duplication as Not analysed, never zero (Y25)', () => {
    attachSyntheticReport(withSnapshot(), { kind: 'dead-code' });
    const w = mountS();
    const lines = w.findAll('.ci-fallow-card .ci-fallow-facts__categories li').map((li) => li.text());
    expect(lines).toEqual([
      FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL.complexity, 'not-analysed'),
      FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL.duplication, 'not-analysed'),
      FALLOW_CATEGORY_LINE(FINDING_KIND_LABEL['unused-exports'], 'analysed'),
    ]);
    w.unmount();
  });

  it('stale evidence: the card, its badge and COPY-16 say so (Y30)', () => {
    const report = attachSyntheticReport(withSnapshot(), { snapshotId: 'snapshot-older' });
    const w = mountS();
    const card = w.find('.ci-provider--fallow');
    expect(card.find('.ci-provenance--stale').exists()).toBe(true);
    expect(card.find('.ci-evidence-badge').text()).toBe(EVIDENCE_BADGE(SYNTHETIC_VERSION, 'stale'));
    expect(card.find('.ci-fallow-card__stale').text()).toBe(COPY_16(formatAbsoluteTime(report.importedAt, Intl)));
    w.unmount();
  });

  it('Remove report asks first; Cancel keeps it; confirming removes it and announces a real outcome (Y31)', async () => {
    const report = attachSyntheticReport(withSnapshot());
    const w = mountS();
    await w.find('.ci-fallow-card__remove').trigger('click');
    expect(w.find('[role="dialog"]').attributes('aria-label')).toBe(FALLOW_REMOVE_TITLE);
    await w.find('.ci-fallow-remove__cancel').trigger('click');
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    expect(useEvidenceStore().report).toBe(report);
    expect(w.find('.ci-sources__live').text()).toBe('');
    await w.find('.ci-fallow-card__remove').trigger('click');
    await w.find('.ci-fallow-remove__confirm').trigger('click');
    await flushPromises();
    expect(useEvidenceStore().report).toBeNull();
    expect(w.find('.ci-sources__live').text()).toBe(FALLOW_REMOVED);
    expect(w.find('.ci-fallow-card__none').text()).toBe(FALLOW_CARD_NONE);
    expect(w.find('.ci-fallow-card__remove').attributes('aria-disabled')).toBe('true');
    w.unmount();
  });

  it('a codebase switch closes the Remove confirmation without removing anything', async () => {
    const report = attachSyntheticReport(withSnapshot('repo-a'));
    const w = mountS();
    await w.find('.ci-fallow-card__remove').trigger('click');
    withSnapshot('repo-b');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    withSnapshot('repo-a');
    expect(useEvidenceStore().report).toBe(report);
    w.unmount();
  });

  it('Remove confirmed after a codebase switch removes nothing, in either codebase (fix round 1, M2)', async () => {
    const snapA = withSnapshot('repo-a');
    const reportA = attachSyntheticReport(snapA);
    const evidence = useEvidenceStore();
    const snapB = buildSnapshotFixture({ files: 10, directories: 2, repositoryId: 'repo-b' });
    evidence.bindRepository('repo-b');
    const reportB = syntheticEvidenceReport(snapB);
    evidence.attach(reportB);
    evidence.bindRepository('repo-a');
    const w = mountS();
    await w.find('.ci-fallow-card__remove').trigger('click');
    const confirm = w.find('.ci-fallow-remove__confirm');
    withSnapshot('repo-b');
    await confirm.trigger('click');   // dispatched before the switch watcher closes the confirmation
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    expect(evidence.report).toBe(reportB);
    expect(w.find('.ci-sources__live').text()).toBe('');
    withSnapshot('repo-a');
    expect(evidence.report).toBe(reportA);
    w.unmount();
  });
});

describe('the import request (Part 6 Y39)', () => {
  beforeEach(fresh);

  it('opens the dialog once, whether the request came before the screen mounted or while it is on screen', async () => {
    withSnapshot();
    const evidence = useEvidenceStore();
    evidence.requestImport();
    const w = mountS();
    await flushPromises();
    expect(w.find('.ci-connect-fallow').exists()).toBe(true);
    expect(evidence.importRequested).toBe(false);
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    evidence.requestImport();
    await flushPromises();
    expect(w.find('.ci-connect-fallow').exists()).toBe(true);
    expect(evidence.importRequested).toBe(false);
    w.unmount();
  });

  it('a request while the Remove confirmation is open closes it first: the dialogs never stack (fix round 1, M3)', async () => {
    const report = attachSyntheticReport(withSnapshot());
    const w = mountS();
    await w.find('.ci-fallow-card__remove').trigger('click');
    expect(w.find('.ci-fallow-remove').exists()).toBe(true);
    useEvidenceStore().requestImport();
    await flushPromises();
    expect(w.findAll('[role="dialog"]')).toHaveLength(1);
    expect(w.find('.ci-fallow-remove').exists()).toBe(false);
    expect(w.find('.ci-connect-fallow').exists()).toBe(true);
    expect(useEvidenceStore().report).toBe(report);
    w.unmount();
  });

  it('with no snapshot, consumes the request and opens nothing', async () => {
    const evidence = useEvidenceStore();
    const w = mountS();
    evidence.requestImport();
    await flushPromises();
    expect(evidence.importRequested).toBe(false);
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    w.unmount();
  });
});
