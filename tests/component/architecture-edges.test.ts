// WP-03 Task 9 (N21, N24, N5, N6): the Architecture Edges tab (matched file edges, the
// direction/source filters, File detail from the importing file, unresolved imports kept
// out of the table, the 200-row limit) and the Rules tab's "Configured in fallow" panel.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import ArchitectureScreen from '../../src/ui/screens/ArchitectureScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import {
  ARCH_FALLOW_ZONES_NONE, ARCH_FALLOW_ZONES_TITLE, ARCH_FALLOW_ZONES_UNMATCHED, ARCH_TAB_EDGES, ARCH_TAB_MAP, ARCH_TAB_RULES,
  EDGE_DIRECTION_RELATIVE, EDGE_LIST_HIDDEN, FALLOW_BOUNDARIES_NOT_CONFIGURED, FALLOW_NOT_ANALYSED, RELATION_MEMBER_UNMATCHED,
  RELATIONS_SCOPE_NOTE, RELATIONS_STATIC_NOTE, RELATION_TYPE_UNKNOWN, UNRESOLVED_TITLE,
} from '../../src/ui/inspector-copy';
import { RELATIONS_PATHS, attachRelationsReport, relationsRecordingJson, snapshotWithPaths } from '../fixtures/evidence-report';

const NOW = new Date('2026-09-24T10:00:00.000Z');

function setup(paths: readonly string[] = RELATIONS_PATHS, report: 'recording' | 'none' | { json: string } = 'recording'): CodebaseSnapshot {
  const snap = snapshotWithPaths(paths, `repo-arch-edges-${Math.random()}`);
  useCityStore().setCity(snap, computeLayout(snap));
  if (report === 'recording') attachRelationsReport(snap);
  else if (report !== 'none') attachRelationsReport(snap, report);
  return snap;
}

const GENERATED = Array.from({ length: 250 }, (_, i) => `gen/f${i}.ts`);

/** The recording with its import cycles removed and 250 boundary violations, each from a
 *  generated file to data/db.ts: exactly 250 distinct matched file edges. */
function manyViolationsJson(): string {
  const raw = JSON.parse(relationsRecordingJson()) as { check: { circular_dependencies: unknown[]; boundary_violations: unknown[] } };
  raw.check.circular_dependencies = [];
  raw.check.boundary_violations = GENERATED.map((path) => ({
    from_path: `src/${path}`, to_path: 'src/data/db.ts', from_zone: 'gen', to_zone: 'data',
    import_specifier: 'src/data/db.ts', line: 3, col: 9,
  }));
  return JSON.stringify(raw);
}

const mountArch = () => mount(ArchitectureScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
type Wrapper = ReturnType<typeof mountArch>;
async function openTab(w: Wrapper, label: string): Promise<void> {
  await w.findAll('[role="tab"]').find((t) => t.text() === label)!.trigger('click');
}
async function selectModule(w: Wrapper, name: string): Promise<void> {
  await openTab(w, ARCH_TAB_MAP);
  await w.findAll('.ci-module-map__node').find((n) => n.find('.ci-module-map__name').text() === name)!.trigger('click');
}
const rows = (w: Wrapper) => w.findAll('.ci-edge-list .ci-table__row');
const cells = (w: Wrapper) => rows(w).map((r) => r.findAll('td').map((c) => c.text()));

describe('Architecture: Edges (WP-03 N21)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('lists the matched file edges with From, To, Source, Line and an unknown Type', async () => {
    setup();
    const w = mountArch();
    await openTab(w, ARCH_TAB_EDGES);
    const table = cells(w);
    expect(table).toHaveLength(6);
    expect(table).toContainEqual(['ui/view.ts', 'data/db.ts', 'Boundary', '3', RELATION_TYPE_UNKNOWN]);
    expect(table).toContainEqual(['core/a.ts', 'core/b.ts', 'Cycle', '1', RELATION_TYPE_UNKNOWN]);
    expect(w.find('.ci-edge-list thead').text()).toContain('Source');
    w.unmount();
  });

  it('the direction filter follows the selected module, and the source filter narrows by source', async () => {
    setup();
    const w = mountArch();
    await selectModule(w, 'ui');
    await openTab(w, ARCH_TAB_EDGES);
    expect(w.find('.ci-edge-list__direction-note').text()).toBe(EDGE_DIRECTION_RELATIVE('ui'));
    const [direction] = w.findAll('.ci-edge-list__filters select');
    await direction!.setValue('out');
    expect(cells(w).map((c) => c[0])).toEqual(['ui/view.ts']);
    await direction!.setValue('in');
    expect(rows(w)).toHaveLength(0);
    await selectModule(w, 'data');
    await openTab(w, ARCH_TAB_EDGES);
    const [direction2, source2] = w.findAll('.ci-edge-list__filters select');
    await direction2!.setValue('in');
    expect(cells(w).map((c) => c[1])).toEqual(['data/db.ts']);
    await direction2!.setValue('all');
    await source2!.setValue('cycle');
    expect(rows(w)).toHaveLength(5);
    await source2!.setValue('boundary');
    expect(cells(w).map((c) => c[0])).toEqual(['ui/view.ts']);
    w.unmount();
  });

  it('From opens File detail on the importing file', async () => {
    const snap = setup();
    const store = useCityStore();
    const w = mountArch();
    await openTab(w, ARCH_TAB_EDGES);
    const from = w.find('.ci-edge-list__from');
    const path = from.text();
    await from.trigger('click');
    expect(store.selectedEntityId).toBe(snap.entities.find((e) => e.path === path)!.id);
    expect(store.route).toBe('file');
    w.unmount();
  });

  it('lists unresolved imports below the table, never as rows, with both notes', async () => {
    setup();
    const w = mountArch();
    await openTab(w, ARCH_TAB_EDGES);
    const unresolved = w.find('.ci-edge-list__unresolved');
    expect(unresolved.text()).toContain(UNRESOLVED_TITLE);
    expect(unresolved.text()).toContain('index.ts:4 → ./does-not-exist');
    expect(w.find('.ci-edge-list table').text()).not.toContain('does-not-exist');
    expect(w.text()).toContain(RELATIONS_STATIC_NOTE);
    expect(w.text()).toContain(RELATIONS_SCOPE_NOTE);
    w.unmount();
  });

  it('Violations only keeps the edges that break one of your rules', async () => {
    setup();
    await useReviewStore().addRule('ui', 'data', 'No shortcuts', NOW);
    const w = mountArch();
    await openTab(w, ARCH_TAB_EDGES);
    await w.find('.ci-architecture__toggle input').setValue(true);
    expect(cells(w).map((c) => c[0])).toEqual(['ui/view.ts']);
    w.unmount();
  });

  it('shows at most 200 rows and says how many more are not shown', async () => {
    setup([...RELATIONS_PATHS, ...GENERATED], { json: manyViolationsJson() });
    expect(useReadModels().architecture.value.relations.edges).toHaveLength(250);
    const w = mountArch();
    await openTab(w, ARCH_TAB_EDGES);
    expect(rows(w)).toHaveLength(200);
    expect(w.find('.ci-edge-list').text()).toContain(EDGE_LIST_HIDDEN(50));
    w.unmount();
  });

  it('without a report the Edges tab is not analysed', async () => {
    setup(RELATIONS_PATHS, 'none');
    const w = mountArch();
    await openTab(w, ARCH_TAB_EDGES);
    expect(w.find('[role="tabpanel"]').text()).toContain(FALLOW_NOT_ANALYSED);
    expect(rows(w)).toHaveLength(0);
    w.unmount();
  });
});

describe('Architecture: Configured in fallow (WP-03 N24)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('lists fallow\'s recorded violation under the rules, with Review finding', async () => {
    setup();
    const w = mountArch();
    const violation = useReadModels().architecture.value.relations.boundaryViolations[0]!;
    await openTab(w, ARCH_TAB_RULES);
    const panel = w.find('.ci-architecture__fallow');
    expect(panel.text()).toContain(ARCH_FALLOW_ZONES_TITLE);
    const row = panel.find('.ci-table__row');
    expect(row.findAll('td').slice(0, 4).map((c) => c.text())).toEqual(['ui/view.ts', 'data/db.ts', 'ui → data', '3']);
    await row.find('.ci-architecture__review').trigger('click');
    expect(useEvidenceStore().consumeFindingReviewRequest()).toBe(violation.fingerprint);
    expect(useCityStore().route).toBe('quality');
    w.unmount();
  });

  it('a reported violation outside the snapshot is counted and listed, never "no violations"', async () => {
    setup(RELATIONS_PATHS.filter((p) => p !== 'ui/view.ts'));
    const w = mountArch();
    await openTab(w, ARCH_TAB_RULES);
    const panel = w.find('.ci-architecture__fallow');
    expect(panel.text()).not.toContain(ARCH_FALLOW_ZONES_NONE);
    expect(panel.find('table').exists()).toBe(false);
    expect(panel.text()).toContain(ARCH_FALLOW_ZONES_UNMATCHED(1));
    const item = panel.find('.ci-architecture__fallow-unmatched-list li');
    expect(item.text()).toContain('ui/view.ts:3 → data/db.ts');
    expect(item.text()).toContain(`ui/view.ts ${RELATION_MEMBER_UNMATCHED}`);
    w.unmount();
  });

  it('says boundaries are not configured, with no table, on the no-boundaries recording', async () => {
    setup(RELATIONS_PATHS, { json: relationsRecordingJson('relations-no-boundaries-3.27.0.json') });
    const w = mountArch();
    await openTab(w, ARCH_TAB_RULES);
    const panel = w.find('.ci-architecture__fallow');
    expect(panel.text()).toContain(FALLOW_BOUNDARIES_NOT_CONFIGURED);
    expect(panel.find('table').exists()).toBe(false);
    w.unmount();
  });

  it('is not analysed without a report', async () => {
    setup(RELATIONS_PATHS, 'none');
    const w = mountArch();
    await openTab(w, ARCH_TAB_RULES);
    expect(w.find('.ci-architecture__fallow').text()).toContain(FALLOW_NOT_ANALYSED);
    w.unmount();
  });
});
