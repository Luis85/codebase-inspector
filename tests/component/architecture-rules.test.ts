import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import ArchitectureScreen from '../../src/ui/screens/ArchitectureScreen.vue';
import BoundaryRuleTable from '../../src/ui/screens/architecture/BoundaryRuleTable.vue';
import RuleEditor from '../../src/ui/screens/architecture/RuleEditor.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { unknown } from '../../src/ui/evidence';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { architectureGraphFor, type RuleEvaluation } from '../../src/ui/read-models/architecture';
import { RULE_SHOW_LABEL } from '../../src/ui/inspector-copy';
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
    await w.find('.ci-rule-table__show').trigger('click');
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

  it('selecting a rule moves the module inspector to its from-module (F3)', async () => {
    setup();
    await useReviewStore().addRule('dir-3', 'dir-1', 'Layering', NOW);
    const w = mountArch();
    expect(w.find('.ci-module-inspector .ci-panel__subtitle').text()).toBe('dir-0');
    await openRulesTab(w);
    await w.find('.ci-rule-table__show').trigger('click');
    expect(w.find('.ci-module-inspector .ci-panel__subtitle').text()).toBe('dir-3');
    w.unmount();
  });

  it('changing a module after a duplicate refusal clears the message (F4)', async () => {
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
    expect(w.find('.ci-rule-editor__error').exists()).toBe(true);
    const other = (to!.findAll('option').map((o) => (o.element as HTMLOptionElement).value))
      .find((v) => v !== free[0] && v !== free[1])!;
    await to!.setValue(other);
    expect(w.find('.ci-rule-editor__error').exists()).toBe(false);
    w.unmount();
  });

  it('the editor falls back to the first module for an unknown initial module (F3)', () => {
    const snap = buildSnapshotFixture({ files: 30, directories: 3 });
    const modules = architectureGraphFor(fileSummariesFor(snap)).modules;
    const w = mount(RuleEditor, { props: { modules, initialFrom: 'gone' }, attachTo: document.body });
    const [from, to] = w.findAll('.ci-rule-editor select');
    expect((from!.element as HTMLSelectElement).value).toBe(modules[0]!.name);
    expect((to!.element as HTMLSelectElement).value).toBe(modules[1]!.name);
    w.unmount();
  });

  it('after removing a rule, focus moves to a sensible target, not the body (F7)', async () => {
    const { free } = setup();
    await useReviewStore().addRule(free[0], free[1], 'x', NOW);
    await useReviewStore().addRule(free[1], free[0], 'y', NOW);
    const w = mountArch();
    await openRulesTab(w);
    await w.find('.ci-rule-table__remove').trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(w.find('[role="tabpanel"]').element);
    await w.find('.ci-rule-table__remove').trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(w.find('.ci-rule-table__empty button').element);
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

describe('Polish F1 (V19): the rule table', () => {
  const RULE: RuleEvaluation = {
    rule: { id: 'AR-001', from: 'ui', to: 'domain', rationale: 'Layering', createdAt: '2026-09-23T10:00:00.000Z' },
    status: 'not-evaluated', violatingImports: unknown('not evaluated'),
  };

  it('rule rows are static; Show selects the rule, a row click does not', async () => {
    const w = mount(BoundaryRuleTable, { props: { rules: [RULE] }, attachTo: document.body });
    const row = w.find('.ci-table__row');
    expect(row.classes()).toContain('ci-table__row--static');
    expect(row.attributes('tabindex')).toBeUndefined();
    await row.trigger('click');
    await row.trigger('keydown', { key: 'Enter' });
    expect(w.emitted('select')).toBeUndefined();
    const show = w.find('.ci-rule-table__show');
    expect(show.attributes('aria-label')).toBe(RULE_SHOW_LABEL('AR-001'));
    await show.trigger('click');
    expect(w.emitted('select')).toEqual([['AR-001']]);
    await w.find('.ci-rule-table__remove').trigger('click');
    expect(w.emitted('remove')).toEqual([['AR-001']]);
    expect(w.emitted('select')).toHaveLength(1);
    w.unmount();
  });
});
