// WP-03 Task 9 (N20, N21, N15, N30): the Architecture screen's five tabs and the Cycles
// tab over the real relations recording — kind, member count and path text, the Map's
// cycle highlight, Review finding (Architecture -> Quality) and Show in city — plus the
// Map/Matrix not-analysed and omitted-edges notes (E10).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import ArchitectureScreen from '../../src/ui/screens/ArchitectureScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useRelationsStore } from '../../src/ui/stores/relations-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CameraBookmark, CodebaseSnapshot } from '../../src/domain/model';
import {
  ARCH_EDGES_OMITTED_NOTE, ARCH_NOT_ANALYSED_NO_SECTION, ARCH_NOT_ANALYSED_NOTE, ARCH_TAB_CYCLES, ARCH_TAB_EDGES, ARCH_TAB_MAP, ARCH_TAB_MATRIX,
  ARCH_MATRIX_NO_EDGE, ARCH_NODE_LABEL_NOT_ANALYSED, ARCH_NONE, ARCH_TAB_RULES, CYCLE_KIND_LABEL, FALLOW_NOT_ANALYSED, NO_VALUE,
  RELATION_MEMBER_UNMATCHED, RELATIONS_SCOPE_SHORT,
} from '../../src/ui/inspector-copy';
import { snapshotWithPaths } from '../fixtures/evidence-report';
import { RELATIONS_PATHS, attachRelationsReport, relationsRecordingJson } from '../fixtures/relations-report';

const BOOKMARK: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [10, 20, 30], target: [0, 0, 0], up: [0, 1, 0], zoom: 1.5,
};

function setup(paths: readonly string[] = RELATIONS_PATHS, report: 'recording' | 'none' | { json: string } = 'recording'): CodebaseSnapshot {
  const snap = snapshotWithPaths(paths, `repo-arch-cycles-${Math.random()}`);
  useCityStore().setCity(snap, computeLayout(snap));
  if (report === 'recording') attachRelationsReport(snap);
  else if (report !== 'none') attachRelationsReport(snap, report);
  return snap;
}

/** The recording plus a cycle across two modules (data <-> ui), so the Map has module
 *  edges between a cycle's modules to highlight (the recording's own cycles stay inside
 *  one module each). */
function crossModuleCycleJson(): string {
  const raw = JSON.parse(relationsRecordingJson()) as { check: { circular_dependencies: unknown[] } };
  raw.check.circular_dependencies.push({
    files: ['src/data/db.ts', 'src/ui/view.ts'], length: 2, line: 2, col: 0,
    edges: [{ path: 'src/data/db.ts', line: 2, col: 0 }, { path: 'src/ui/view.ts', line: 3, col: 9 }],
  });
  return JSON.stringify(raw);
}

const mountArch = () => mount(ArchitectureScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
type Wrapper = ReturnType<typeof mountArch>;
async function openTab(w: Wrapper, label: string): Promise<void> {
  await w.findAll('[role="tab"]').find((t) => t.text() === label)!.trigger('click');
}
const idOf = (snap: CodebaseSnapshot, path: string) => snap.entities.find((e) => e.path === path)!.id;

describe('Architecture: tabs and Cycles (WP-03 N21)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('renders five tabs in the order Map, Matrix, Cycles, Edges, Rules', () => {
    setup();
    const w = mountArch();
    expect(w.findAll('[role="tab"]').map((t) => t.text()))
      .toEqual([ARCH_TAB_MAP, ARCH_TAB_MATRIX, ARCH_TAB_CYCLES, ARCH_TAB_EDGES, ARCH_TAB_RULES]);
    w.unmount();
  });

  it('lists the import cycles, then the re-export cycle, each with kind, member count and path text', async () => {
    setup();
    const w = mountArch();
    await openTab(w, ARCH_TAB_CYCLES);
    const rows = w.findAll('.ci-cycle-list__row');
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.find('.ci-cycle-list__kind').text())).toEqual([CYCLE_KIND_LABEL.import, CYCLE_KIND_LABEL.import, CYCLE_KIND_LABEL['re-export']]);
    expect(rows.map((r) => r.find('.ci-cycle-list__count').text())).toEqual(['2 files', '3 files', '2 files']);
    expect(rows[0]!.find('.ci-cycle-list__path').text()).toBe('barrel/index.ts:1 → barrel/x.ts:1 → barrel/index.ts');
    expect(rows[1]!.find('.ci-cycle-list__path').text()).toBe('core/a.ts:1 → core/b.ts:1 → core/c.ts:1 → core/a.ts');
    // A re-export cycle has no hop order: its members are listed as text instead.
    expect(rows[2]!.find('.ci-cycle-list__path').exists()).toBe(false);
    expect(rows[2]!.findAll('.ci-cycle-list__member').map((m) => m.text())).toEqual(['barrel/index.ts', 'barrel/x.ts']);
    w.unmount();
  });

  it('selecting a cycle highlights the Map edges between its modules and shows its path in the inspector column', async () => {
    setup(RELATIONS_PATHS, { json: crossModuleCycleJson() });
    const w = mountArch();
    expect(w.findAll('.ci-module-map__edge').length).toBeGreaterThan(0);
    expect(w.findAll('.ci-module-map__edge--cycle')).toHaveLength(0);
    await openTab(w, ARCH_TAB_CYCLES);
    const row = w.findAll('.ci-cycle-list__row').find((r) => r.text().includes('data/db.ts:2'))!;
    await row.find('.ci-cycle-list__select').trigger('click');
    expect(row.find('.ci-cycle-list__select').attributes('aria-pressed')).toBe('true');
    expect(w.find('.ci-architecture__inspectors').text()).toContain('data/db.ts:2 → ui/view.ts:3 → data/db.ts');
    await openTab(w, ARCH_TAB_MAP);
    expect(w.findAll('.ci-module-map__edge--cycle')).toHaveLength(2);
    expect(w.findAll('.ci-module-map__node--cycle').map((n) => n.find('.ci-module-map__name').text()).sort()).toEqual(['data', 'ui']);
    w.unmount();
  });

  it('Review finding asks Quality to open the cycle\'s finding and navigates there', async () => {
    setup();
    const w = mountArch();
    const cycle = useReadModels().architecture.value.relations.cycles[0]!;
    await openTab(w, ARCH_TAB_CYCLES);
    await w.findAll('.ci-cycle-list__row')[0]!.find('.ci-cycle-list__review').trigger('click');
    expect(cycle.fingerprint).not.toBeNull();
    expect(useEvidenceStore().consumeFindingReviewRequest()).toBe(cycle.fingerprint);
    expect(useCityStore().route).toBe('quality');
    w.unmount();
  });

  it('Show in city selects the anchor file, highlights the cycle and opens the city, keeping the camera', async () => {
    const snap = setup();
    const store = useCityStore();
    store.setCamera(BOOKMARK);
    const w = mountArch();
    const core = useReadModels().architecture.value.relations.cycles[1]!;
    await openTab(w, ARCH_TAB_CYCLES);
    await w.findAll('.ci-cycle-list__row')[1]!.find('.ci-cycle-list__city').trigger('click');
    expect(store.selectedEntityId).toBe(idOf(snap, 'core/a.ts'));
    expect(useRelationsStore().highlightedCycleId).toBe(core.findingId);
    expect(store.route).toBe('city');
    expect(store.camera).toEqual(BOOKMARK);
    w.unmount();
  });

  it('a cycle with a member outside the snapshot says so and offers no Show in city', async () => {
    setup(RELATIONS_PATHS.filter((p) => p !== 'core/c.ts'));
    const w = mountArch();
    await openTab(w, ARCH_TAB_CYCLES);
    const [barrel, core] = w.findAll('.ci-cycle-list__row');
    expect(core!.text()).toContain(RELATION_MEMBER_UNMATCHED);
    expect(core!.find('.ci-cycle-list__city').exists()).toBe(false);
    expect(barrel!.text()).not.toContain(RELATION_MEMBER_UNMATCHED);
    expect(barrel!.find('.ci-cycle-list__city').exists()).toBe(true);
    w.unmount();
  });

  it('without a report the Cycles tab is not analysed, and the Map and Matrix say why they have no edges', async () => {
    setup(RELATIONS_PATHS, 'none');
    const w = mountArch();
    expect(w.find('.ci-module-map').text()).toContain(ARCH_NOT_ANALYSED_NOTE);
    expect(useReadModels().architecture.value.cards.find((c) => c.id === 'cycles')!.caption).toBe(ARCH_NOT_ANALYSED_NOTE);
    expect(w.find('.ci-module-map .ci-provenance').text()).toBe('Unknown');
    // N5 for screen readers: no "0 outgoing, 0 incoming", no "No evidenced imports" per cell.
    expect(w.find('.ci-module-map__node').attributes('aria-label')).toBe(ARCH_NODE_LABEL_NOT_ANALYSED('barrel', 3));
    const facts = w.findAll('.ci-module-inspector dd');
    expect(facts.slice(2).map((d) => d.text())).toEqual([NO_VALUE, NO_VALUE]);
    expect(w.find('.ci-module-inspector').text()).not.toContain(RELATIONS_SCOPE_SHORT);
    await openTab(w, ARCH_TAB_MATRIX);
    expect(w.find('.ci-matrix__scroll').text()).toContain(ARCH_NOT_ANALYSED_NOTE);
    const hidden = w.findAll('.ci-matrix__td .visually-hidden').map((s) => s.text());
    expect(hidden).toContain(FALLOW_NOT_ANALYSED);
    expect(hidden).not.toContain(ARCH_MATRIX_NO_EDGE);
    await openTab(w, ARCH_TAB_CYCLES);
    expect(w.find('[role="tabpanel"]').text()).toContain(FALLOW_NOT_ANALYSED);
    expect(w.findAll('.ci-cycle-list__row')).toHaveLength(0);
    w.unmount();
  });

  it('final review #8: a report with no check section says so on the Map, the Matrix and the cycles card, not "no report is attached"', async () => {
    setup(RELATIONS_PATHS, { json: relationsRecordingJson('health-3.27.0.json') });
    const w = mountArch();
    const noSection = 'The attached fallow report has no import cycle or boundary section, so no imports are shown.';
    expect(ARCH_NOT_ANALYSED_NO_SECTION).toBe(noSection);
    expect(w.find('.ci-module-map').text()).toContain(noSection);
    expect(w.find('.ci-module-map').text()).not.toContain(ARCH_NOT_ANALYSED_NOTE);
    expect(useReadModels().architecture.value.cards.find((c) => c.id === 'cycles')!.caption).toBe(noSection);
    await openTab(w, ARCH_TAB_MATRIX);
    expect(w.find('.ci-matrix__scroll').text()).toContain(noSection);
    expect(w.find('.ci-matrix__scroll').text()).not.toContain(ARCH_NOT_ANALYSED_NOTE);
    w.unmount();
  });

  it('with a report the Map shows the evidence state, never sample, and counts edges to modules not shown', () => {
    // Eight 4-file modules push `ui` (one file) out of the 12 shown, so ui -> data is omitted.
    const extra = Array.from({ length: 8 }, (_m, m) => Array.from({ length: 4 }, (_f, f) => `m${m}/f${f}.ts`)).flat();
    setup([...RELATIONS_PATHS, ...extra]);
    const w = mountArch();
    const map = w.find('.ci-module-map');
    expect(map.find('.ci-provenance').text()).toBe('Collected');
    expect(map.text()).not.toContain(ARCH_NOT_ANALYSED_NOTE);
    expect(map.text()).toContain(ARCH_EDGES_OMITTED_NOTE(1));
    // m0 (the first module) has no evidenced neighbour: "None evidenced", with the scope stated.
    const inspector = w.find('.ci-module-inspector');
    expect(inspector.findAll('dd').slice(2).map((d) => d.text())).toEqual([ARCH_NONE, ARCH_NONE]);
    expect(inspector.text()).toContain(RELATIONS_SCOPE_SHORT);
    w.unmount();
  });
});
