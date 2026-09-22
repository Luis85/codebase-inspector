import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import SettingsScreen from '../../src/ui/screens/SettingsScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { usePreferencesStore } from '../../src/ui/stores/preferences-store';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { useReportStore } from '../../src/ui/stores/report-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { SETTINGS_CLEAR_FAILED } from '../../src/ui/inspector-copy';

const mountS = () => mount(SettingsScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
const tab = (w: ReturnType<typeof mountS>, id: string) => w.find(`[role="tab"][data-tab-id="${id}"]`).trigger('click');

describe('SettingsScreen (Part 4)', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('opens on Appearance: the theme follows Obsidian and density is a real preference', async () => {
    const w = mountS();
    expect(w.text()).toContain('Follows Obsidian');
    await w.find('.ci-settings__density').setValue('compact');
    expect(usePreferencesStore().density).toBe('compact');
    w.unmount();
  });

  it('Analysis explains the threshold, opens the priority formula and links to the current scope', async () => {
    const w = mountS();
    await tab(w, 'analysis');
    expect(w.text()).toContain('65');
    await w.find('.ci-settings__priority').trigger('click');
    expect(w.find('.ci-formula').exists()).toBe(true);
    await w.find('.ci-formula').trigger('keydown', { key: 'Escape' });
    expect(w.find('.ci-formula').exists()).toBe(false);
    await w.find('.ci-settings__scope').trigger('click');
    expect(useCityStore().route).toBe('sources');
    w.unmount();
  });

  it('Accessibility opens the file inventory in the city list view', async () => {
    const w = mountS();
    await tab(w, 'accessibility');
    await w.find('.ci-settings__inventory').trigger('click');
    expect(useCityStore().viewMode).toBe('list');
    expect(useCityStore().route).toBe('city');
    w.unmount();
  });

  it('exports the review state as JSON through the leaf document', async () => {
    // 'repo-xyz' (not the bare 'repo' the "report" key itself contains) so the
    // not-leaked assertion below is meaningful.
    await useReviewStore().addWorkItemForFile('repo-xyz\0file\0src/a.ts', 'A', new Date());
    useReportStore().applyNote('Confirm the parser boundary.');
    const w = mountS();
    await w.find('.ci-settings__export').trigger('click');
    const [host, name, text, mime] = vi.mocked(downloadText).mock.calls[0]!;
    expect(host.classList.contains('ci-screen--settings')).toBe(true);
    expect(name).toBe('codebase-inspector-review-state.json');
    expect(mime).toBe('application/json;charset=utf-8');
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      schema: 'codebase-inspector.review-state.v1',
      workItems: [{ target: { kind: 'file', path: 'src/a.ts' } }],
      report: { sections: useReportStore().sections, note: 'Confirm the parser boundary.' },
    });
    expect(text).not.toContain(String.fromCharCode(0));
    expect(text).not.toContain('repo-xyz');
    w.unmount();
  });

  it('the Privacy tab\'s own export button also downloads the review state as JSON', async () => {
    const w = mountS();
    await tab(w, 'privacy');
    await w.find('.ci-settings__export-privacy').trigger('click');
    const [, name] = vi.mocked(downloadText).mock.calls[0]!;
    expect(name).toBe('codebase-inspector-review-state.json');
    w.unmount();
  });

  it('clears the review state only after confirmation, and announces it', async () => {
    await useReviewStore().addWorkItemForFile('repo\0file\0src/a.ts', 'A', new Date());
    useReportStore().applyNote('keep?');
    const w = mountS();
    await tab(w, 'privacy');
    await w.find('.ci-settings__clear').trigger('click');
    expect(w.find('.ci-clear-dialog').text()).toContain('1 work items');
    await w.find('.ci-clear-dialog__cancel').trigger('click');
    expect(useReviewStore().workItems).toHaveLength(1);
    await w.find('.ci-settings__clear').trigger('click');
    await w.find('.ci-clear-dialog__confirm').trigger('click');
    await flushPromises();
    expect(useReviewStore().workItems).toHaveLength(0);
    expect(useReportStore().note).toBe('');
    expect(w.find('.ci-clear-dialog').exists()).toBe(false);
    expect(w.find('.ci-settings__live').text()).toBe('Review state cleared.');
    w.unmount();
  });

  it('a rejecting repository keeps the dialog open, shows the error, and keeps the review state (fix round 1, Minor 5)', async () => {
    const review = useReviewStore();
    await review.addWorkItemForFile('repo\0file\0src/a.ts', 'A', new Date());
    useReportStore().applyNote('keep?');
    review.setRepository({ ...createInMemoryReviewRepository(), removeWorkItem: () => Promise.reject(new Error('disk')) });
    const w = mountS();
    await tab(w, 'privacy');
    await w.find('.ci-settings__clear').trigger('click');
    await w.find('.ci-clear-dialog__confirm').trigger('click');
    await flushPromises();
    expect(w.find('.ci-clear-dialog').exists()).toBe(true);
    expect(w.find('.ci-clear-dialog__error').text()).toBe(SETTINGS_CLEAR_FAILED);
    expect(useReportStore().note).toBe('keep?');
    expect(w.find('.ci-settings__live').text()).toBe('');
    w.unmount();
  });
});
