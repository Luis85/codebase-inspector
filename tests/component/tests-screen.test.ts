import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import TestsScreen from '../../src/ui/screens/TestsScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { ReviewStoreError } from '../../src/ui/stores/ports/review-repository';
import { REVIEW_STORE_FULL, TESTS_PLAN_FAILED } from '../../src/ui/inspector-copy';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

function withSnapshot(files = 60, testFiles = 0) {
  const snap = buildSnapshotFixture({ files, directories: 3, testFiles });
  useCityStore().setCity(snap, computeLayout(snap));
}
const mountT = () => mount(TestsScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
const tab = (w: ReturnType<typeof mountT>, id: string) => w.find(`[role="tab"][data-tab-id="${id}"]`);

describe('TestsScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); vi.mocked(downloadText).mockClear(); });

  it('mutation is shown as not collected, never as 0', () => {
    withSnapshot();
    const w = mountT();
    const card = w.findAll('.ci-metric-card').find((c) => c.text().includes('Mutation score'))!;
    expect(card.text()).toContain('—');
    expect(card.text()).toContain('Not collected');
    expect(card.text()).not.toMatch(/\b0\b/);
    w.unmount();
  });

  it('one tile per file (capped), a single tab stop, arrows move it, Enter selects without navigating', async () => {
    withSnapshot(30);
    const store = useCityStore();
    store.navigate('tests');
    const w = mountT();
    const tiles = () => w.findAll('.ci-coverage-map__tile');
    expect(tiles()).toHaveLength(30);
    expect(tiles().filter((t) => t.attributes('tabindex') === '0')).toHaveLength(1);
    await w.find('.ci-coverage-map').trigger('keydown', { key: 'ArrowRight' });
    await nextTick();
    expect(tiles()[1]!.attributes('tabindex')).toBe('0');
    expect(document.activeElement).toBe(tiles()[1]!.element);
    await w.find('.ci-coverage-map').trigger('keydown', { key: 'Enter' });
    expect(store.selectedEntityId).toBe(tiles()[1]!.attributes('data-entity-id'));
    expect(store.route).toBe('tests');
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('module bars are labelled sample; the gaps table plans tests as a work item', async () => {
    withSnapshot(80);
    const w = mountT();
    const meters = w.findAll('.ci-meter');
    expect(meters.length).toBeGreaterThan(0);   // E27
    expect(meters.every((m) => (m.attributes('aria-label') ?? '').includes('sample'))).toBe(true);
    await w.find('.ci-coverage-gaps__plan').trigger('click');
    await Promise.resolve(); await nextTick();
    const item = useReviewStore().workItems[0]!;
    expect(item.intent).toBe('tests');
    expect(item.target.kind).toBe('file');
    w.unmount();
  });

  it('the plan button never activates its row, and once planned it stays focused, aria-disabled and inert', async () => {
    withSnapshot(80);
    const store = useCityStore();
    store.navigate('tests');
    const w = mountT();
    const plan = () => w.find('.ci-coverage-gaps__plan');
    const name = plan().attributes('aria-label')!;
    expect(name.startsWith('Plan tests')).toBe(true);   // WCAG 2.5.3: the name contains the visible label
    await plan().trigger('keydown', { key: 'Enter' });
    expect(store.route).toBe('tests');
    (plan().element as HTMLElement).focus();
    await plan().trigger('click');
    await Promise.resolve(); await nextTick();
    expect(store.route).toBe('tests');
    expect(useReviewStore().workItems).toHaveLength(1);
    expect(plan().attributes('aria-disabled')).toBe('true');
    expect(plan().text()).toBe('Tests planned');
    expect(plan().attributes('aria-label')!.startsWith('Tests planned')).toBe(true);
    expect(document.activeElement).toBe(plan().element);
    await plan().trigger('click');
    await Promise.resolve(); await nextTick();
    expect(useReviewStore().workItems).toHaveLength(1);
    w.unmount();
  });

  it('test results: real test files only, or an empty state; mutation tab explains the unknown', async () => {
    withSnapshot(20, 3);
    const w = mountT();
    await tab(w, 'results').trigger('click');
    expect(w.findAll('.ci-table__row')).toHaveLength(3);
    await tab(w, 'mutation').trigger('click');
    expect(w.text()).toContain('The strength of your assertions is unknown.');
    w.unmount();
    setActivePinia(createPinia());
    withSnapshot(20, 0);
    const w2 = mountT();
    await tab(w2, 'results').trigger('click');
    expect(w2.text()).toContain('No test files in this inventory');
    w2.unmount();
  });

  it('the evidence dialog lists each signal and its state; export sends every gap', async () => {
    withSnapshot(80);
    const w = mountT();
    await w.find('.ci-tests__evidence').trigger('click');
    const row = (label: string) => w.findAll('.ci-evidence-dialog__row').find((r) => r.text().includes(label))!;
    expect(row('Mutation testing').find('.ci-provenance').classes()).toContain('ci-provenance--unknown');
    expect(row('Test runs').find('.ci-provenance').classes()).toContain('ci-provenance--unknown');
    expect(row('Test runs').text()).toContain('Not collected');
    expect(row('Branch coverage').find('.ci-provenance').classes()).toContain('ci-provenance--sample');
    await w.find('.ci-evidence-dialog__close').trigger('click');
    expect(w.find('.ci-tests__export').attributes('aria-disabled')).toBeUndefined();
    await w.find('.ci-tests__export').trigger('click');
    const [, name, text] = vi.mocked(downloadText).mock.calls[0]!;
    expect(name).toBe('branch-coverage-gaps.csv');
    const gaps = useReadModels().testConfidence.value!.gaps.length;
    expect(gaps).toBeGreaterThan(0);
    const trailing = text.endsWith('\r\n') ? 1 : 0;
    expect(text.split('\r\n')).toHaveLength(gaps + 1 + trailing);
    w.unmount();
  });

  it('the selected-file strip names a selected file even when the module filter hides its tile', async () => {
    withSnapshot(60);
    const store = useCityStore();
    const w = mountT();
    const files = useReadModels().files.value;
    const other = files.find((f) => f.module !== files[0]!.module)!;
    await w.find('.ci-tests__module').setValue(files[0]!.module);
    store.select(other.id);
    await nextTick();
    expect(w.find('.ci-selected-strip').text()).toContain(other.name);
    w.unmount();
  });

  it('the run duration badge shows the value\'s own state', async () => {
    withSnapshot(20, 3);
    const w = mountT();
    await tab(w, 'results').trigger('click');
    const badges = w.findAll('.ci-tests__duration .ci-provenance');
    expect(badges.length).toBeGreaterThan(0);
    expect(badges.every((b) => b.classes().includes('ci-provenance--sample'))).toBe(true);
    w.unmount();
  });

  it('V23 (E40): with no model, Export is aria-disabled, stays focusable, and a press hands nothing to downloadText', async () => {
    const w = mountT();   // no snapshot: testConfidence is null
    const button = w.find('.ci-tests__export');
    expect(button.attributes('disabled')).toBeUndefined();
    expect(button.attributes('aria-disabled')).toBe('true');
    (button.element as HTMLElement).focus();
    await button.trigger('click');
    await nextTick();
    expect(downloadText).not.toHaveBeenCalled();
    expect(w.find('.ci-tests__live').text()).toBe('');
    expect(document.activeElement).toBe(button.element);
    w.unmount();
  });

  it('Polish E1: a refused plan names its reason; any other failure keeps the generic text', async () => {
    withSnapshot(80);
    const w = mountT();
    const save = vi.spyOn(useReviewStore().repository, 'saveWorkItem');
    save.mockRejectedValueOnce(new ReviewStoreError('full'));
    await w.find('.ci-coverage-gaps__plan').trigger('click');
    await flushPromises();
    expect(w.find('.ci-tests__live').text()).toBe(REVIEW_STORE_FULL);
    save.mockRejectedValueOnce(new Error('disk'));
    await w.find('.ci-coverage-gaps__plan').trigger('click');
    await flushPromises();
    expect(w.find('.ci-tests__live').text()).toBe(TESTS_PLAN_FAILED);
    w.unmount();
  });
});
