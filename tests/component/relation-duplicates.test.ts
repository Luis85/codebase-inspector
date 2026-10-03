// WP-03 Part 1 final review #9: a report can name the same relation twice — two boundary
// violations with the same from/to/specifier on different lines, two unresolved imports of
// the same specifier from one file, or one cycle's files listed in two orders. Each pair
// shares one findingId (normalize-relations.ts keys it without the line), and Quality
// counts it once (assignIds keeps the first). So:
// - every list or table that shows them keys each row uniquely (a duplicate Vue key
//   mis-patches the rows it shares);
// - the Architecture violations card's fallow part and the Overview caption count distinct
//   findingIds, as Quality does (N12: a finding counts once).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, type DOMWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import ArchitectureScreen from '../../src/ui/screens/ArchitectureScreen.vue';
import FileDetailScreen from '../../src/ui/screens/FileDetailScreen.vue';
import FileInspector from '../../src/ui/components/FileInspector.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { CITY_RENDERER_KEY } from '../../src/ui/renderer-handle';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { EvidenceReport } from '../../src/application/evidence/model';
import { ARCH_TAB_CYCLES, ARCH_TAB_EDGES, ARCH_TAB_RULES, OVERVIEW_ARCH_CAPTION } from '../../src/ui/inspector-copy';
import { snapshotWithPaths } from '../fixtures/evidence-report';
import { RELATIONS_PATHS, attachRelationsReport, relationsRecordingJson } from '../fixtures/relations-report';

interface Doc { check: { circular_dependencies: Record<string, unknown>[]; boundary_violations: Record<string, unknown>[]; unresolved_imports: Record<string, unknown>[] } }

/** The recording with each relation kind reported twice: the ui → data violation again on
 *  line 9, the index.ts unresolved import again on line 8, and the core cycle again with its
 *  files in another order (a → c → b). One more violation, ui/view.ts → ghost.ts, has a file
 *  outside the snapshot and is reported twice too, for the unmatched list. */
function duplicatedJson(): string {
  const raw = JSON.parse(relationsRecordingJson()) as Doc;
  const c = raw.check;
  c.boundary_violations.push({ ...c.boundary_violations[0]!, line: 9 });
  const ghost = { ...c.boundary_violations[0]!, to_path: 'src/ghost.ts', import_specifier: 'src/ghost.ts', line: 4 };
  c.boundary_violations.push(ghost, { ...ghost, line: 5 });
  c.unresolved_imports.push({ ...c.unresolved_imports[0]!, line: 8 });
  const files = ['src/core/a.ts', 'src/core/c.ts', 'src/core/b.ts'];
  c.circular_dependencies.push({ files, length: 3, line: 2, col: 0, edges: files.map((path) => ({ path, line: 2, col: 0 })) });
  return JSON.stringify(raw);
}

let snap: CodebaseSnapshot;
let report: EvidenceReport;
beforeEach(() => {
  setActivePinia(createPinia());
  snap = snapshotWithPaths(RELATIONS_PATHS, `repo-relation-duplicates-${Math.random()}`);
  useCityStore().setCity(snap, computeLayout(snap));
  report = attachRelationsReport(snap, { json: duplicatedJson() });
});

/** The Vue key each rendered element was patched under (Vue records the element's vnode on
 *  it in development, under this property). */
const VNODE_PROPERTY = '__vnode';
const keysOf = (els: readonly DOMWrapper<Element>[]): unknown[] =>
  els.map((e) => (Reflect.get(e.element, VNODE_PROPERTY) as { key: unknown }).key);
function expectUnique(els: readonly DOMWrapper<Element>[], count: number): void {
  expect(els).toHaveLength(count);
  expect(new Set(keysOf(els)).size).toBe(count);
}
const idOf = (path: string): string => snap.entities.find((e) => e.kind === 'file' && e.path === path)!.id;

describe('duplicated relations (final review #9)', () => {
  it('the fixture really does repeat each findingId, and Quality counts each once', () => {
    const relations = report.normalized.relations;
    expect(relations.boundaryViolations).toHaveLength(4);
    expect(new Set(relations.boundaryViolations.map((v) => v.findingId)).size).toBe(2);
    expect(new Set(relations.unresolvedImports.map((u) => u.findingId)).size).toBe(1);
    expect(new Set(relations.importCycles.map((c) => c.findingId)).size).toBe(2);   // barrel + core (twice)
    expect(report.normalized.findings.filter((f) => f.category === 'boundary')).toHaveLength(2);
  });

  it('the Architecture violations card and the Overview caption count distinct findings, as Quality does', () => {
    const { architecture, overview } = useReadModels();
    // ui → data (twice) and ui → ghost (twice): two distinct violations, one of them unmatched.
    expect(architecture.value.cards.find((c) => c.id === 'violations')!.value).toMatchObject({ value: 2 });
    expect(overview.value!.cards.find((c) => c.id === 'architecture')!.caption).toBe(OVERVIEW_ARCH_CAPTION('2 boundary violations'));
  });

  it('the Rules tab table and its unmatched list, the Edges tab\'s unresolved list and the Cycles tab key every row uniquely', async () => {
    const w = mount(ArchitectureScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
    const open = async (label: string) => { await w.findAll('[role="tab"]').find((t) => t.text() === label)!.trigger('click'); };
    await open(ARCH_TAB_RULES);
    expectUnique(w.findAll('.ci-architecture__fallow .ci-table__row'), 2);
    expectUnique(w.findAll('.ci-architecture__fallow-unmatched-list > li'), 2);
    await open(ARCH_TAB_EDGES);
    expectUnique(w.findAll('.ci-edge-list__unresolved-list > li'), 2);
    await open(ARCH_TAB_CYCLES);
    expectUnique(w.findAll('.ci-cycle-list__row'), 4);   // two import cycles (core twice), barrel import and re-export
    w.unmount();
  });

  it('the city Relations section and File detail key the cycles through the file uniquely', () => {
    const city = useCityStore();
    city.select(idOf('core/a.ts'));
    city.openInspector();
    const inspector = mount(FileInspector, {
      attachTo: document.body,
      global: { provide: { clipboard: { writeText: vi.fn(async () => {}) }, [CITY_RENDERER_KEY as symbol]: { value: { focus: vi.fn(), setCamera: vi.fn(), setRelations: vi.fn() } } } },
    });
    expectUnique(inspector.findAll('.ci-city-relations__cycle'), 2);
    inspector.unmount();
    city.navigate('file');
    const detail = mount(FileDetailScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), clipboard: { writeText: vi.fn(async () => {}) } } } });
    expectUnique(detail.findAll('.ci-file-relations__cycles > li'), 2);
    detail.unmount();
  });
});
