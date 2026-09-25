import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import FileDetailScreen from '../../src/ui/screens/FileDetailScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport } from '../fixtures/evidence-report';

function withSelection() {
  const snap = buildSnapshotFixture({ files: 12, directories: 2 });
  const store = useCityStore();
  store.setCity(snap, computeLayout(snap));
  const file = snap.entities.find((e) => e.kind === 'file')!;
  store.select(file.id);
  store.navigate('file');
  return file;
}
const clipboard = { writeText: vi.fn(() => Promise.resolve()) };
const mountFile = () => mount(FileDetailScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), clipboard } } });

describe('FileDetailScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); clipboard.writeText.mockClear(); });

  it('asks for a codebase without a snapshot', () => {
    expect(mountFile().text()).toContain('No snapshot yet');
  });

  it('explains how to pick a file when nothing is selected', async () => {
    const snap = buildSnapshotFixture({ files: 3 });
    useCityStore().setCity(snap, computeLayout(snap));
    const w = mountFile();
    expect(w.text()).toContain('No file selected');
    await w.find('.ci-file-detail__browse').trigger('click');
    expect(useCityStore().route).toBe('hotspots');
    w.unmount();
  });

  it('shows the file identity, four cards, inventory facts and sample findings', () => {
    const file = withSelection();
    const w = mountFile();
    expect(w.find('.ci-page-header__title').text()).toBe(file.name);
    expect(w.text()).toContain(file.path);
    expect(w.findAll('.ci-metric-card')).toHaveLength(4);
    expect(w.find('.ci-source-context').text()).toContain('Bytes');
    expect(w.text()).toContain('A read-only preview of this file is on Investigate, at a reported finding’s line.');
    expect(w.text()).toContain('No findings does not imply no defects.');
    w.unmount();
  });

  it('Show in city keeps the selection, opens the inspector and never moves the camera', async () => {
    const file = withSelection();
    const store = useCityStore();
    const w = mountFile();
    await w.find('.ci-file-detail__city').trigger('click');
    expect(store.route).toBe('city');
    expect(store.selectedEntityId).toBe(file.id);
    expect(store.inspectorOpen).toBe(true);
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('Inspect architecture navigates there', async () => {
    withSelection();
    const w = mountFile();
    await w.find('.ci-file-detail__architecture').trigger('click');
    expect(useCityStore().route).toBe('architecture');
    w.unmount();
  });

  it('adds one work item and lists it', async () => {
    const file = withSelection();
    const w = mountFile();
    await w.find('.ci-file-detail__add').trigger('click');
    await flushPromises();
    expect(useReviewStore().hasWorkItemFor(file.id)).toBe(true);
    expect(w.find('.ci-file-detail__add').attributes('disabled')).toBeDefined();
    expect(w.find('.ci-work-items').text()).toContain(`Investigate ${file.name}`);
    w.unmount();
  });

  it('copies the path through the clipboard seam and reports failure', async () => {
    const file = withSelection();
    const w = mountFile();
    await w.find('.ci-source-context__copy').trigger('click');
    await flushPromises();
    expect(clipboard.writeText).toHaveBeenCalledWith(file.path);
    clipboard.writeText.mockRejectedValueOnce(new Error('denied'));
    await w.find('.ci-source-context__copy').trigger('click');
    await flushPromises();
    expect(w.text()).toContain('Could not copy the path.');
    w.unmount();
  });

  it('a finding opens the Finding review dialog for that finding, with its status', async () => {
    const snap = buildSnapshotFixture({ files: 12, directories: 2 });
    const store = useCityStore();
    store.setCity(snap, computeLayout(snap));
    attachSyntheticReport(snap);
    const finding = useReadModels().quality.value.findings[0]!;
    store.select(finding.file.id);
    store.navigate('file');
    const w = mountFile();
    const buttons = w.findAll('.ci-file-finding__review');
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons[0]!.text()).toContain('Open');
    await buttons[0]!.trigger('click');
    expect(w.find('.ci-finding-dialog').exists()).toBe(true);
    expect(w.find('.ci-finding-dialog').text()).toContain(finding.id);
    await w.find('.ci-finding-dialog__acknowledge').trigger('click');
    await flushPromises();
    expect(buttons[0]!.text()).toContain('Acknowledged');
    await w.find('.ci-finding-dialog__open-file').trigger('click');
    expect(w.find('.ci-finding-dialog').exists()).toBe(false);
    expect(store.route).toBe('file');
    w.unmount();
  });
});
