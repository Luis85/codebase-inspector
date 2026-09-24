import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import ArchitectureScreen from '../../src/ui/screens/ArchitectureScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { snapshotWithPaths } from '../fixtures/evidence-report';
import type { CodebaseSnapshot } from '../../src/domain/model';

function withSnapshot(files = 60, directories = 6) {
  const snap = buildSnapshotFixture({ files, directories });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
}

// WP-03 JF14: the real relations recording, re-rooted without `src/` (see
// tests/component/architecture-rules.test.ts's header comment for why it is read by a
// plain cwd-relative path rather than tests/fixtures/fallow-fixture.ts's helper).
const RELATIONS_PATHS = [
  'core/a.ts', 'core/b.ts', 'core/c.ts', 'barrel/index.ts', 'barrel/x.ts', 'barrel/y.ts',
  'ui/view.ts', 'data/db.ts', 'data/types.ts', 'index.ts', 'orphan.ts',
];
const RELATIONS_JSON = readFileSync(join(process.cwd(), 'tests/fixtures/fallow/relations-combined-3.27.0.json'), 'utf8');

function attachRelationsReport(snapshot: CodebaseSnapshot): void {
  const parsed = parseFallowReportText(RELATIONS_JSON);
  if (!parsed.ok) throw new Error(`test setup: the relations fixture was refused (${parsed.code} ${parsed.detail})`);
  const report = buildEvidenceReport({
    raw: parsed.report, fileName: 'relations.json', importedAt: '2026-09-24T10:00:00.000Z',
    snapshotId: snapshot.snapshotId, stripPrefix: 'src/',
  });
  const store = useEvidenceStore();
  store.setRepository(new InMemoryEvidenceStore());
  store.bindRepository(snapshot.repositoryId);
  if (!store.attach(report)) throw new Error('test setup: the evidence store refused the report');
}

/** The one real matched edge (`ui -> data`), so the Map and Matrix have something to draw. */
function withRelationsSnapshot(): CodebaseSnapshot {
  const snap = snapshotWithPaths(RELATIONS_PATHS, `repo-arch-screen-${Math.random()}`);
  useCityStore().setCity(snap, computeLayout(snap));
  attachRelationsReport(snap);
  return snap;
}

const mountArch = () => mount(ArchitectureScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
const markerIdOf = (w: ReturnType<typeof mountArch>): string | undefined => w.find('marker').attributes('id');

describe('ArchitectureScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('asks for a codebase without a snapshot', () => {
    const w = mountArch();
    expect(w.text()).toContain('No snapshot yet');
    w.unmount();
  });

  it('NoSnapshot selects a codebase on the city, so its scan states are visible', async () => {
    const store = useCityStore();
    store.navigate('architecture');
    const onSelectCodebase = vi.fn();
    const w = mount(ArchitectureScreen, { attachTo: document.body, global: { provide: { onSelectCodebase } } });
    await w.find('.ci-no-snapshot .mod-cta').trigger('click');
    expect(onSelectCodebase).toHaveBeenCalledTimes(1);
    expect(store.route).toBe('city');
    w.unmount();
  });

  it('shows collected modules and unknown relation cards without a report', () => {
    withSnapshot();
    const w = mountArch();
    const cards = w.findAll('.ci-metric-card');
    expect(cards).toHaveLength(4);
    expect(cards[0]!.find('.ci-metric-card__value').text()).toBe('6');
    expect(cards[0]!.find('.ci-provenance').exists()).toBe(false);
    expect(cards[1]!.find('.ci-metric-card__value').text()).toBe('—');
    expect(cards[1]!.find('.ci-provenance--unknown').exists()).toBe(true);
    expect(cards[3]!.find('.ci-metric-card__value').text()).toBe('—');
    w.unmount();
  });

  it('draws one accessible node per module', () => {
    withSnapshot();
    const w = mountArch();
    const nodes = w.findAll('.ci-module-map__node');
    expect(nodes).toHaveLength(6);
    expect(nodes[0]!.attributes('aria-label')).toMatch(/files, \d+ outgoing, \d+ incoming, evidenced imports$/);
    expect(w.find('.ci-module-map svg').attributes('aria-hidden')).toBe('true');
    w.unmount();
  });

  it('selecting a node shows it in the module inspector', async () => {
    withSnapshot();
    const w = mountArch();
    await w.findAll('.ci-module-map__node')[2]!.trigger('click');
    expect(w.findAll('.ci-module-map__node')[2]!.attributes('aria-pressed')).toBe('true');
    expect(w.find('.ci-module-inspector').text()).toContain(w.findAll('.ci-module-map__node')[2]!.find('.ci-module-map__name').text());
    w.unmount();
  });

  it('opens on the selected file\'s module (P12)', () => {
    const snap = withSnapshot();
    const file = snap.entities.find((e) => e.kind === 'file' && e.path.startsWith('dir-4/'))!;
    useCityStore().select(file.id);
    const w = mountArch();
    expect(w.find('.ci-module-map__node--selected .ci-module-map__name').text()).toBe('dir-4');
    w.unmount();
  });

  it('arrow keys move between tabs and focus the new tab; the matrix is n × n', async () => {
    withSnapshot();
    const w = mountArch();
    await w.find('[role="tab"]').trigger('keydown', { key: 'ArrowRight' });
    await nextTick();
    const matrixTab = w.findAll('[role="tab"]')[1]!;
    expect(matrixTab.attributes('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(matrixTab.element);
    expect(w.findAll('.ci-matrix thead th')).toHaveLength(7);
    expect(w.findAll('.ci-matrix tbody tr')).toHaveLength(6);
    w.unmount();
  });

  it('a matrix cell selects its edge and the edge\'s importing module', async () => {
    withRelationsSnapshot();
    const w = mountArch();
    await w.findAll('[role="tab"]')[1]!.trigger('click');
    const cell = w.find('.ci-matrix__cell');
    await cell.trigger('click');
    expect(cell.attributes('aria-pressed')).toBe('true');
    expect(cell.attributes('aria-label')).toMatch(/imports .*evidenced import statements$/);
    w.unmount();
  });

  it('a module-inspector file opens File detail, keeping the camera', async () => {
    withSnapshot();
    const store = useCityStore();
    const w = mountArch();
    await w.find('.ci-module-inspector__file').trigger('click');
    expect(store.route).toBe('file');
    expect(store.selectedEntityId).not.toBeNull();
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('violations only hides every edge while no rule exists', async () => {
    withRelationsSnapshot();
    const w = mountArch();
    expect(w.findAll('.ci-module-map__edge').length).toBeGreaterThan(0);
    await w.find('.ci-architecture__toggle input').setValue(true);
    expect(w.findAll('.ci-module-map__edge')).toHaveLength(0);
    w.unmount();
  });

  it('a node click clears the boundary selection (F3)', async () => {
    withRelationsSnapshot();
    const w = mountArch();
    await w.findAll('[role="tab"]')[1]!.trigger('click');
    await w.find('.ci-matrix__cell').trigger('click');
    expect(w.find('.ci-boundary').text()).not.toContain('Select a rule or a matrix cell to inspect it.');
    await w.findAll('[role="tab"]')[0]!.trigger('click');
    await w.findAll('.ci-module-map__node')[1]!.trigger('click');
    expect(w.find('.ci-boundary').text()).toContain('Select a rule or a matrix cell to inspect it.');
    w.unmount();
  });

  it('re-derives the selected module when a new snapshot drops it (F3)', async () => {
    withSnapshot();
    const w = mountArch();
    const node = w.findAll('.ci-module-map__node').find((n) => n.find('.ci-module-map__name').text() === 'dir-5')!;
    await node.trigger('click');
    expect(w.find('.ci-module-inspector .ci-panel__subtitle').text()).toBe('dir-5');
    withSnapshot(30, 2);
    await nextTick();
    expect(w.find('.ci-module-inspector .ci-panel__subtitle').text()).toBe('dir-0');
    expect(w.find('.ci-module-map__node--selected .ci-module-map__name').text()).toBe('dir-0');
    w.unmount();
  });

  it('two mounted maps never share a marker id', () => {
    withSnapshot();
    const a = mountArch(); const b = mountArch();
    expect(markerIdOf(a)).not.toBe(markerIdOf(b));
    a.unmount(); b.unmount();
  });
});
