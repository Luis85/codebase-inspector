import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import ArchitectureScreen from '../../src/ui/screens/ArchitectureScreen.vue';
import BoundaryRuleTable from '../../src/ui/screens/architecture/BoundaryRuleTable.vue';
import RuleEditor from '../../src/ui/screens/architecture/RuleEditor.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { computeLayout } from '../../src/domain/layout/layout';
import { unknown } from '../../src/ui/evidence';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { relationModelFor } from '../../src/ui/read-models/relations';
import { architectureGraphFor, type RuleEvaluation } from '../../src/ui/read-models/architecture';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { RULE_SHOW_LABEL } from '../../src/ui/inspector-copy';
import { snapshotWithPaths } from '../fixtures/evidence-report';
import type { CodebaseSnapshot } from '../../src/domain/model';

const NOW = new Date('2026-09-21T10:00:00.000Z');
const IMPORTED_AT = '2026-09-24T10:00:00.000Z';
// WP-03 JF14: the real relations recording, re-rooted without `src/` (module names become
// the fixture's own top-level folders — core, barrel, ui, data — instead of collapsing to
// one `src` module). See tests/fixtures/fallow/README.md, "Relations project". Read by a
// plain cwd-relative path (not `tests/fixtures/fallow-fixture.ts`'s `import.meta.url`
// helper, which jsdom's fake location resolves to a non-file URL — E31-style: read once,
// straight from disk).
const RELATIONS_PATHS = [
  'core/a.ts', 'core/b.ts', 'core/c.ts', 'barrel/index.ts', 'barrel/x.ts', 'barrel/y.ts',
  'ui/view.ts', 'data/db.ts', 'data/types.ts', 'index.ts', 'orphan.ts',
];
const RELATIONS_JSON = readFileSync(join(process.cwd(), 'tests/fixtures/fallow/relations-combined-3.27.0.json'), 'utf8');

function attachRelationsReport(snapshot: CodebaseSnapshot): void {
  const parsed = parseFallowReportText(RELATIONS_JSON);
  if (!parsed.ok) throw new Error(`test setup: the relations fixture was refused (${parsed.code} ${parsed.detail})`);
  const report = buildEvidenceReport({
    raw: parsed.report, fileName: 'relations.json', importedAt: IMPORTED_AT,
    snapshotId: snapshot.snapshotId, stripPrefix: 'src/',
  });
  const store = useEvidenceStore();
  store.setRepository(new InMemoryEvidenceStore());
  store.bindRepository(snapshot.repositoryId);
  if (!store.attach(report)) throw new Error('test setup: the evidence store refused the report');
}

/** The one real cross-module edge (`ui -> data`) and a module pair fallow never reports. */
function setup() {
  const snap = snapshotWithPaths(RELATIONS_PATHS, `repo-rules-${Math.random()}`);
  useCityStore().setCity(snap, computeLayout(snap));
  attachRelationsReport(snap);
  const { architecture } = useReadModels();
  const edge = architecture.value.edges[0]!;
  const names = architecture.value.modules.map((m) => m.name);
  const free = names.flatMap((a) => names.map((b) => [a, b] as const))
    .find(([a, b]) => a !== b && !architecture.value.edges.some((e) => e.from === a && e.to === b))!;
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

  it('saves a rule from the editor, only with a rationale, and shows it on the rules tab, not evaluated', async () => {
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
    expect(w.find('.ci-table').text()).toContain('Not evaluated');
    expect(w.find('.ci-table').text()).not.toContain('Passing');
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

  it('a rule over an existing evidenced edge is a violation: card, dashed edge, inspector', async () => {
    const { edge } = setup();
    await useReviewStore().addRule(edge.from, edge.to, 'No shortcuts', NOW);
    const w = mountArch();
    const violations = w.findAll('.ci-metric-card')[3]!;
    // fallow's own reported violation (1) plus this one violated rule (1).
    expect(violations.find('.ci-metric-card__value').text()).toBe('2');
    await w.find('.ci-architecture__toggle input').setValue(true);
    expect(w.findAll('.ci-module-map__edge--violation')).toHaveLength(1);
    await openRulesTab(w);
    await w.find('.ci-rule-table__show').trigger('click');
    expect(w.find('.ci-boundary').text()).toContain('No shortcuts');
    expect(w.find('.ci-boundary').text()).toContain('Violation');
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
    // P12's default (no file selected) opens on the first module by count/name, 'barrel';
    // a rule FROM a different module ('data') proves the selection actually moved.
    await useReviewStore().addRule('data', 'core', 'Layering', NOW);
    const w = mountArch();
    expect(w.find('.ci-module-inspector .ci-panel__subtitle').text()).toBe('barrel');
    await openRulesTab(w);
    await w.find('.ci-rule-table__show').trigger('click');
    expect(w.find('.ci-module-inspector .ci-panel__subtitle').text()).toBe('data');
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
    const snap = snapshotWithPaths(RELATIONS_PATHS, `repo-rules-editor-${Math.random()}`);
    const files = fileSummariesFor(snap);
    const relations = relationModelFor(files, evidenceIndexFor(files, null, snap.snapshotId));
    const modules = architectureGraphFor(files, relations).modules;
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
    status: 'not-evaluated', violatingImports: unknown('not evaluated'), reason: 'not evaluated',
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
