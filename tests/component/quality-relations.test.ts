// WP-03 N13-N15: Quality's new kinds (cycle, boundary, unresolved-import) on screen, the
// review dialog's "Also involves" row and cycle path text, and Architecture -> Quality's
// review-request pair (requestFindingReview/consumeFindingReviewRequest, the requestImport
// pattern). Over the real relations recording (tests/fixtures/fallow/README.md,
// "Relations project"), never a synthetic report: only it carries cycle/boundary findings.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import QualityScreen from '../../src/ui/screens/QualityScreen.vue';
import FileDetailScreen from '../../src/ui/screens/FileDetailScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { FINDING_VIA_RELATED, RELATION_MEMBER_UNMATCHED } from '../../src/ui/inspector-copy';
import {
  attachRelationsReport, RELATIONS_PATHS, snapshotWithOnlyFiles, snapshotWithPaths,
} from '../fixtures/evidence-report';

function withRelations(repositoryId = 'repo-relations-quality'): CodebaseSnapshot {
  const snap = snapshotWithPaths([...RELATIONS_PATHS], repositoryId);
  useCityStore().setCity(snap, computeLayout(snap));
  attachRelationsReport(snap);
  return snap;
}
const mountQ = () => mount(QualityScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
const mountFile = () => mount(FileDetailScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
const rowWith = (w: ReturnType<typeof mountQ>, text: string) => w.findAll('.ci-table__row').find((r) => r.text().includes(text));

describe('Quality: the structure kinds, the review dialog and the review request (WP-03 N13-N15)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('shows five cards including Import structure, and the Type filter lists six kinds', () => {
    withRelations();
    const w = mountQ();
    const cards = w.findAll('.ci-metric-card');
    expect(cards).toHaveLength(5);
    expect(cards.some((c) => c.text().includes('Import structure'))).toBe(true);
    const kindOptions = w.findAll('.ci-finding-filters__kind option');
    expect(kindOptions).toHaveLength(7);   // "All types" plus the six kinds
    w.unmount();
  });

  it('choosing Import cycle leaves only CY- rows', async () => {
    withRelations();
    const w = mountQ();
    await w.find('.ci-finding-filters__kind').setValue('cycle');
    const rows = w.findAll('.ci-table__row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.find('.ci-ref-id').text().startsWith('CY-'))).toBe(true);
    w.unmount();
  });

  it('a cycle\'s dialog lists its other members and the hop path text', async () => {
    withRelations();
    const w = mountQ();
    const row = rowWith(w, 'Import cycle · 3 files');
    expect(row).toBeDefined();
    await row!.find('.ci-findings-table__open').trigger('click');
    const text = w.find('.ci-finding-dialog').text();
    expect(text).toContain('Also involves');
    expect(text).toContain('core/b.ts');
    expect(text).toContain('core/c.ts');
    expect(text).toContain('core/a.ts:1 → core/b.ts:1 → core/c.ts:1 → core/a.ts');
    w.unmount();
  });

  it('a re-export cycle\'s dialog lists its member but shows no hop path (no hop order)', async () => {
    withRelations();
    const w = mountQ();
    const row = rowWith(w, 'Re-export cycle · 2 files');
    expect(row).toBeDefined();
    await row!.find('.ci-findings-table__open').trigger('click');
    const dialog = w.find('.ci-finding-dialog');
    expect(dialog.text()).toContain('barrel/x.ts');
    expect(dialog.find('.ci-finding-dialog__cycle-path').exists()).toBe(false);
    w.unmount();
  });

  it('a boundary finding\'s dialog lists its "to" file', async () => {
    withRelations();
    const w = mountQ();
    const row = rowWith(w, 'Boundary violation · ui → data');
    expect(row).toBeDefined();
    await row!.find('.ci-findings-table__open').trigger('click');
    expect(w.find('.ci-finding-dialog').text()).toContain('data/db.ts');
    w.unmount();
  });

  it('an unmatched related path reads "not in this snapshot"', async () => {
    const snap = withRelations('repo-relations-reduced');
    const reduced = snapshotWithOnlyFiles(snap, RELATIONS_PATHS.filter((p) => p !== 'core/c.ts'));
    useCityStore().setCity(reduced, computeLayout(reduced));
    const w = mountQ();
    const row = rowWith(w, 'Import cycle · 3 files');
    expect(row).toBeDefined();
    await row!.find('.ci-findings-table__open').trigger('click');
    const text = w.find('.ci-finding-dialog').text();
    expect(text).toContain('core/c.ts');
    expect(text).toContain(RELATION_MEMBER_UNMATCHED);
    w.unmount();
  });

  it('requestFindingReview opens the dialog on that finding at mount, once; an unknown fingerprint opens nothing', async () => {
    withRelations();
    const { relations } = useReadModels();
    const coreCycle = relations.value.cycles.find((c) => c.kind === 'import' && c.members.length === 3)!;
    useEvidenceStore().requestFindingReview(coreCycle.fingerprint!);
    const w = mountQ();
    await nextTick();
    expect(w.find('.ci-finding-dialog').exists()).toBe(true);
    expect(w.find('.ci-finding-dialog').text()).toContain('Import cycle · 3 files');
    w.unmount();

    // Consumed: a second mount does not reopen it.
    const w2 = mountQ();
    await nextTick();
    expect(w2.find('.ci-finding-dialog').exists()).toBe(false);
    w2.unmount();

    useEvidenceStore().requestFindingReview('CY-00000000#does-not-exist');
    const w3 = mountQ();
    await nextTick();
    expect(w3.find('.ci-finding-dialog').exists()).toBe(false);
    w3.unmount();
  });

  it('bindRepository clears a pending finding-review request', () => {
    withRelations();
    const { relations } = useReadModels();
    const coreCycle = relations.value.cycles.find((c) => c.kind === 'import' && c.members.length === 3)!;
    useEvidenceStore().requestFindingReview(coreCycle.fingerprint!);
    useEvidenceStore().bindRepository('some-other-repo');
    expect(useEvidenceStore().consumeFindingReviewRequest()).toBeNull();
  });

  it('File detail marks the boundary violation via its related file, and its Review button opens the same fingerprint as Quality', async () => {
    const snap = withRelations();
    const store = useCityStore();
    const dbFile = snap.entities.find((e) => e.kind === 'file' && e.path === 'data/db.ts')!;
    store.select(dbFile.id);
    store.navigate('file');
    const w = mountFile();
    const { fileDetail, quality } = useReadModels();
    const onFile = fileDetail.value!.findings.find((f) => f.kind === 'boundary')!;
    expect(onFile.anchored).toBe(false);
    expect(onFile.anchorPath).toBe('ui/view.ts');
    expect(quality.value.byFingerprint.has(onFile.fingerprint)).toBe(true);
    expect(w.text()).toContain(FINDING_VIA_RELATED('ui/view.ts'));
    const buttons = w.findAll('.ci-file-finding__review');
    const row = buttons.find((b) => b.text().includes(onFile.id));
    expect(row).toBeDefined();
    await row!.trigger('click');
    expect(w.find('.ci-finding-dialog').exists()).toBe(true);
    expect(w.find('.ci-finding-dialog').text()).toContain(onFile.id);
    w.unmount();
  });
});
