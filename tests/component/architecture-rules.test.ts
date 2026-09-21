import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import ArchitectureScreen from '../../src/ui/screens/ArchitectureScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { architectureGraphFor } from '../../src/ui/read-models/architecture';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const NOW = new Date('2026-09-21T10:00:00.000Z');
function setup() {
  const snap = buildSnapshotFixture({ files: 60, directories: 6 });
  useCityStore().setCity(snap, computeLayout(snap));
  const graph = architectureGraphFor(fileSummariesFor(snap));
  const edge = graph.edges[0]!;
  const names = graph.modules.map((m) => m.name);
  const free = names.flatMap((a) => names.map((b) => [a, b] as const))
    .find(([a, b]) => a !== b && !graph.edges.some((e) => e.from === a && e.to === b))!;
  return { edge, free };
}
const mountArch = () => mount(ArchitectureScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
const openRulesTab = async (w: ReturnType<typeof mountArch>) => { await w.findAll('[role="tab"]')[2]!.trigger('click'); };

describe('boundary rules', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('the rules tab starts empty with an add action that opens the editor', async () => {
    setup();
    const w = mountArch();
    await openRulesTab(w);
    expect(w.find('.ci-rule-table__empty').exists()).toBe(true);
    await w.find('.ci-rule-table__empty button').trigger('click');
    expect(w.find('[role="dialog"]').exists()).toBe(true);
    w.unmount();
  });

  it('saves a rule from the editor, only with a rationale, and shows it on the rules tab', async () => {
    const { free } = setup();
    const w = mountArch();
    await w.find('.ci-page-header__actions button').trigger('click');
    const [from, to] = w.findAll('.ci-rule-editor select');
    await from!.setValue(free[0]);
    await to!.setValue(free[1]);
    expect(w.find('.ci-rule-editor button[type="submit"]').attributes('disabled')).toBeDefined();
    await w.find('.ci-rule-editor textarea').setValue('Keep layers apart');
    await w.find('.ci-rule-editor').trigger('submit');
    await flushPromises();
    expect(w.find('[role="dialog"]').exists()).toBe(false);
    expect(w.find('[role="tab"][aria-selected="true"]').text()).toBe('Boundary rules');
    expect(w.find('.ci-table').text()).toContain(`${free[0]} must not import ${free[1]}`);
    expect(w.find('.ci-table').text()).toContain('Passing');
    w.unmount();
  });

  it('warns when both modules are the same', async () => {
    setup();
    const w = mountArch();
    await w.find('.ci-page-header__actions button').trigger('click');
    const [from, to] = w.findAll('.ci-rule-editor select');
    await to!.setValue((from!.element as HTMLSelectElement).value);
    expect(w.find('.ci-rule-editor__error').text()).toBe('Choose two different modules.');
    w.unmount();
  });

  it('a rule over an existing edge is a sample violation: card, dashed edge, inspector', async () => {
    const { edge } = setup();
    await useReviewStore().addRule(edge.from, edge.to, 'No shortcuts', NOW);
    const w = mountArch();
    const violations = w.findAll('.ci-metric-card')[3]!;
    expect(violations.find('.ci-metric-card__value').text()).toBe(String(edge.imports.value));
    expect(violations.find('.ci-provenance--sample').exists()).toBe(true);
    await w.find('.ci-architecture__toggle input').setValue(true);
    expect(w.findAll('.ci-module-map__edge--violation')).toHaveLength(1);
    await openRulesTab(w);
    await w.find('.ci-table__row').trigger('click');
    expect(w.find('.ci-boundary').text()).toContain('No shortcuts');
    expect(w.findAll('.ci-boundary .ci-module-inspector__file').length).toBeGreaterThan(0);
    w.unmount();
  });

  it('refuses a duplicate pair with an inline message', async () => {
    const { free } = setup();
    await useReviewStore().addRule(free[0], free[1], 'x', NOW);
    const w = mountArch();
    await w.find('.ci-page-header__actions button').trigger('click');
    const [from, to] = w.findAll('.ci-rule-editor select');
    await from!.setValue(free[0]);
    await to!.setValue(free[1]);
    await w.find('.ci-rule-editor textarea').setValue('again');
    await w.find('.ci-rule-editor').trigger('submit');
    await flushPromises();
    expect(w.find('.ci-rule-editor__error').text()).toBe('A rule for these two modules already exists.');
    w.unmount();
  });

  it('removes a rule; Enter on Remove never activates the row', async () => {
    const { free } = setup();
    await useReviewStore().addRule(free[0], free[1], 'x', NOW);
    const w = mountArch();
    await openRulesTab(w);
    const remove = w.find('.ci-rule-table__remove');
    await remove.trigger('keydown', { key: 'Enter' });
    expect(w.find('.ci-boundary').text()).not.toContain('AR-001');
    await remove.trigger('click');
    await flushPromises();
    expect(useReviewStore().ruleCount).toBe(0);
    expect(w.find('.ci-rule-table__empty').exists()).toBe(true);
    w.unmount();
  });
});
