import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';

vi.mock('../../src/ui/export/download', () => ({ downloadText: vi.fn() }));
import { downloadText } from '../../src/ui/export/download';
import TestsScreen from '../../src/ui/screens/TestsScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
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
    expect(w.find('.ci-evidence-dialog').text()).toContain('Mutation testing');
    await w.find('.ci-evidence-dialog__close').trigger('click');
    await w.find('.ci-tests__export').trigger('click');
    const [, name, text] = vi.mocked(downloadText).mock.calls[0]!;
    expect(name).toBe('branch-coverage-gaps.csv');
    expect(text.split('\r\n').length).toBeGreaterThan(2);
    w.unmount();
  });
});
