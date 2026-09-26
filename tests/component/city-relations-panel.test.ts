// WP-03 Task 12 (N30, N31): the city file inspector's Relations section — Direction and Hops
// controls, Show arcs, the neighbourhood rows (each a button that selects the file without
// moving the camera), the cycles through the file with a Highlight toggle, the notes and the
// stale label — and the per-leaf relations store behind it (defaults, reset, J15's order).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { nextTick, watch } from 'vue';
import '../mocks/obsidian';
import FileInspector from '../../src/ui/components/FileInspector.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useRelationsStore, type RelationControlDirection } from '../../src/ui/stores/relations-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { useCityRelations } from '../../src/ui/read-models/use-city-relations';
import { CITY_RENDERER_KEY } from '../../src/ui/renderer-handle';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CameraBookmark, CodebaseSnapshot } from '../../src/domain/model';
import {
  CYCLE_KIND_LABEL, FALLOW_NOT_ANALYSED, RELATION_HIDDEN, RELATION_MEMBER_UNMATCHED, RELATION_SOURCE_CYCLE, RELATIONS_DIRECTION_BOTH,
  RELATIONS_DIRECTION_IN, RELATIONS_DIRECTION_LABEL, RELATIONS_DIRECTION_OUT, RELATIONS_HIGHLIGHT_CYCLE, RELATIONS_HIGHLIGHT_CYCLE_LABEL,
  RELATION_ROW_LOCATION, RELATIONS_HOPS_LABEL, RELATIONS_SCOPE_NOTE, RELATIONS_SHOW_ARCS,
  RELATIONS_STATIC_NOTE, RELATIONS_TITLE,
} from '../../src/ui/inspector-copy';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { snapshotWithPaths } from '../fixtures/evidence-report';
import { RELATIONS_PATHS, attachRelationsReport, relationsRecordingJson } from '../fixtures/relations-report';

/** E26/JP6: a re-import, through the real parser and normaliser straight into `attach` on the
 *  ALREADY-bound repository — unlike `attachRelationsReport`, which rebinds a fresh repository
 *  (right for first attach, wrong for a rescan: it would reset the store itself, the very
 *  thing this simulates a rescan withOUT triggering). */
function reimportRelationsReport(snap: CodebaseSnapshot, json?: string): void {
  const parsed = parseFallowReportText(json ?? relationsRecordingJson());
  if (!parsed.ok) throw new Error(`test setup: the relations fixture was refused (${parsed.code} ${parsed.detail})`);
  const report = buildEvidenceReport({
    raw: parsed.report, fileName: 'relations.json', importedAt: '2026-09-24T10:00:00.000Z', snapshotId: snap.snapshotId, stripPrefix: 'src/',
  });
  if (!useEvidenceStore().attach(report)) throw new Error('test setup: the evidence store refused the re-import');
}

const BOOKMARK: CameraBookmark = { projection: 'orthographic', mode: '3d', position: [4, 5, 6], target: [1, 2, 3], up: [0, 1, 0], zoom: 2 };
const LONG = Array.from({ length: 30 }, (_, i) => `long/f${String(i).padStart(2, '0')}.ts`);
/** The recording plus a 30-file import cycle long/f00 → … → long/f29 → long/f00 (paths under `src/`, stripped). */
function longCycleJson(): string {
  const raw = JSON.parse(relationsRecordingJson()) as { check: { circular_dependencies: unknown[] } };
  const files = LONG.map((p) => `src/${p}`);
  raw.check.circular_dependencies.push({ files, length: files.length, line: 1, col: 0, edges: files.map((path) => ({ path, line: 1, col: 0 })) });
  return JSON.stringify(raw);
}
/** The recording with the core/a.ts → b.ts → c.ts cycle removed from `circular_dependencies`
 *  (E26/JP6: a re-import that drops the highlighted cycle). Every other section, including
 *  the barrel re-export cycle, is unchanged. */
function withoutCoreCycleJson(): string {
  const raw = JSON.parse(relationsRecordingJson()) as { check: { circular_dependencies: { files: string[] }[] } };
  raw.check.circular_dependencies = raw.check.circular_dependencies.filter((c) => c.files[0] !== 'src/core/a.ts');
  return JSON.stringify(raw);
}
/** The recording with the core cycle's three imports on distinct lines: a.ts imports b.ts on
 *  line 35, b.ts imports c.ts on line 7, c.ts imports a.ts on line 15 (fallow's edge line is
 *  in the IMPORTING file). */
function distinctLinesJson(): string {
  const raw = JSON.parse(relationsRecordingJson()) as { check: { circular_dependencies: { files: string[]; edges: { line: number }[] }[] } };
  const core = raw.check.circular_dependencies.find((c) => c.files[0] === 'src/core/a.ts')!;
  [35, 7, 15].forEach((line, i) => { core.edges[i]!.line = line; });
  return JSON.stringify(raw);
}
/** The recording's rows (every core edge on line 1) as final review #2 prints them: the line
 *  is in the importing file, so an outgoing row names it. */
const A_TO_B = 'core/b.ts · line 1 in core/a.ts';
const B_TO_C = 'core/c.ts · line 1 in core/b.ts';
const C_TO_A = 'core/c.ts:1';
const idOf = (snap: CodebaseSnapshot, path: string): string => snap.entities.find((e) => e.kind === 'file' && e.path === path)!.id;

/** A city with the relations recording attached, core/a.ts selected and the inspector open. */
interface SetupOptions { paths?: readonly string[]; json?: string; select?: string }
function setup(report: 'recording' | 'none' | 'stale' = 'recording', options: SetupOptions = {}): CodebaseSnapshot {
  const snap = snapshotWithPaths(options.paths ?? RELATIONS_PATHS, `repo-city-relations-${Math.random()}`);
  const city = useCityStore();
  city.setCity(snap, computeLayout(snap));
  const json = options.json === undefined ? {} : { json: options.json };
  if (report === 'recording') attachRelationsReport(snap, json);
  if (report === 'stale') attachRelationsReport(snap, { ...json, snapshotId: 'an-older-snapshot' });
  city.select(idOf(snap, options.select ?? 'core/a.ts'));
  city.openInspector();
  city.setCamera(BOOKMARK);
  return snap;
}

const renderers: { focus: ReturnType<typeof vi.fn>; setCamera: ReturnType<typeof vi.fn>; setRelations: ReturnType<typeof vi.fn> }[] = [];
const wrappers: { unmount(): void }[] = [];
function mountInspector(pinia?: Pinia) {
  const renderer = { focus: vi.fn(), setCamera: vi.fn(), setRelations: vi.fn() };
  renderers.push(renderer);
  const w = mount(FileInspector, {
    attachTo: document.body,
    global: {
      ...(pinia ? { plugins: [pinia] } : {}),
      provide: { clipboard: { writeText: vi.fn(async () => {}) }, [CITY_RENDERER_KEY as symbol]: { value: renderer } },
    },
  });
  wrappers.push(w);
  return { w, renderer };
}
type Wrapper = ReturnType<typeof mountInspector>['w'];
const section = (w: Wrapper) => w.get('.ci-city-relations');
const paths = (w: Wrapper) => w.findAll('.ci-city-relations__row .ci-city-relations__path').map((p) => p.text());
const group = (w: Wrapper, label: string) => section(w).get(`[role="group"][aria-label="${label}"]`);
const pressed = (w: Wrapper, label: string) => group(w, label).findAll('button').filter((b) => b.attributes('aria-pressed') === 'true').map((b) => b.text());
async function press(w: Wrapper, label: string, text: string): Promise<void> {
  await group(w, label).findAll('button').find((b) => b.text() === text)!.trigger('click');
}

/** Moves every control off its default, and checks it moved. */
function customise(): ReturnType<typeof useRelationsStore> {
  const store = useRelationsStore();
  store.setDirection('out');
  store.setHops(2);
  store.setShowArcs(false);
  store.highlightCycle('CY-00000001');
  expect([store.direction, store.hops, store.showArcs, store.highlightedCycleId]).toEqual(['out', 2, false, 'CY-00000001']);
  return store;
}
const DEFAULTS = ['both', 1, true, null];

beforeEach(() => { setActivePinia(createPinia()); });
afterEach(() => {
  wrappers.splice(0).forEach((w) => { w.unmount(); });
  renderers.splice(0);
});

describe('the city Relations section (N30)', () => {
  it('shows its controls, the two rows with their lines, the cycle with a Highlight toggle, and both notes', async () => {
    setup();
    const { w } = mountInspector();
    expect(section(w).get('.ci-city-relations__title').text()).toBe(RELATIONS_TITLE);
    expect(group(w, RELATIONS_DIRECTION_LABEL).findAll('button').map((b) => b.text()))
      .toEqual([RELATIONS_DIRECTION_BOTH, RELATIONS_DIRECTION_OUT, RELATIONS_DIRECTION_IN]);
    expect(pressed(w, RELATIONS_DIRECTION_LABEL)).toEqual([RELATIONS_DIRECTION_BOTH]);
    expect(group(w, RELATIONS_HOPS_LABEL).findAll('button').map((b) => b.text())).toEqual(['1', '2']);
    expect(pressed(w, RELATIONS_HOPS_LABEL)).toEqual(['1']);
    const arcs = section(w).get('.ci-city-relations__arcs');
    expect(arcs.text()).toBe(RELATIONS_SHOW_ARCS);
    expect((arcs.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true);

    expect(paths(w)).toEqual([A_TO_B, C_TO_A]);
    const rows = w.findAll('.ci-city-relations__row');
    expect(rows[0]!.get('.ci-city-relations__glyph--out').text()).toBe('→');
    expect(rows[0]!.text()).toContain(RELATIONS_DIRECTION_OUT);
    expect(rows[1]!.get('.ci-city-relations__glyph--in').text()).toBe('←');
    expect(rows[1]!.text()).toContain(RELATIONS_DIRECTION_IN);
    expect(rows.every((r) => r.get('.ci-city-relations__source').text() === RELATION_SOURCE_CYCLE)).toBe(true);

    const cycles = w.findAll('.ci-city-relations__cycle');
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.get('code').text()).toBe('core/a.ts:1 → core/b.ts:1 → core/c.ts:1 → core/a.ts');
    const toggle = cycles[0]!.get('button.ci-city-relations__highlight');
    expect(toggle.text()).toBe(RELATIONS_HIGHLIGHT_CYCLE);
    const core = useReadModels().relations.value.cycles.find((c) => c.pathText.startsWith('core/a.ts'))!;
    expect(toggle.attributes('aria-label')).toBe(RELATIONS_HIGHLIGHT_CYCLE_LABEL(core.findingId));
    expect(toggle.attributes('aria-pressed')).toBe('false');
    await toggle.trigger('click');
    expect(toggle.attributes('aria-pressed')).toBe('true');
    expect(useRelationsStore().highlightedCycleId).toBe(core.findingId);
    await toggle.trigger('click');
    expect(toggle.attributes('aria-pressed')).toBe('false');
    expect(useRelationsStore().highlightedCycleId).toBeNull();

    expect(section(w).text()).toContain(RELATIONS_SCOPE_NOTE);
    expect(section(w).text()).toContain(RELATIONS_STATIC_NOTE);
    expect(section(w).find('.ci-provenance').exists()).toBe(false);
  });

  it('the controls drive the rows and the store: Outgoing, 2 hops, Show arcs off', async () => {
    setup();
    const { w } = mountInspector();
    await press(w, RELATIONS_DIRECTION_LABEL, RELATIONS_DIRECTION_OUT);
    expect(pressed(w, RELATIONS_DIRECTION_LABEL)).toEqual([RELATIONS_DIRECTION_OUT]);
    expect(paths(w)).toEqual([A_TO_B]);
    await press(w, RELATIONS_HOPS_LABEL, '2');
    expect(paths(w)).toEqual([A_TO_B, B_TO_C]);
    expect(w.findAll('.ci-city-relations__row')[1]!.text()).toContain(`${RELATIONS_HOPS_LABEL} 2`);
    await section(w).get('.ci-city-relations__arcs input').setValue(false);
    const store = useRelationsStore();
    expect([store.direction, store.hops, store.showArcs]).toEqual(['out', 2, false]);
    expect(paths(w)).toEqual([A_TO_B, B_TO_C]);
  });

  it('final review #2: each row\'s line is shown against the file that imports, in both directions and at hop 2', async () => {
    setup('recording', { json: distinctLinesJson() });
    const { w } = mountInspector();
    // Outgoing: core/a.ts (selected) imports core/b.ts on ITS line 35. Incoming: core/c.ts imports on its own line 15.
    expect(paths(w)).toEqual(['core/b.ts · line 35 in core/a.ts', 'core/c.ts:15']);
    await press(w, RELATIONS_DIRECTION_LABEL, RELATIONS_DIRECTION_OUT);
    await press(w, RELATIONS_HOPS_LABEL, '2');
    // Hop 2 outwards: core/b.ts imports core/c.ts on core/b.ts's line 7, not the selected file's.
    expect(paths(w)).toEqual(['core/b.ts · line 35 in core/a.ts', 'core/c.ts · line 7 in core/b.ts']);
    expect(paths(w)).toEqual([RELATION_ROW_LOCATION('core/b.ts', 'core/a.ts', 35), RELATION_ROW_LOCATION('core/c.ts', 'core/b.ts', 7)]);
  });

  it('a row button selects that file and never moves the camera', async () => {
    const snap = setup();
    const { w, renderer } = mountInspector();
    await w.findAll('.ci-city-relations__row button')[0]!.trigger('click');
    const city = useCityStore();
    expect(city.selectedEntityId).toBe(idOf(snap, 'core/b.ts'));
    expect(renderer.focus).not.toHaveBeenCalled();
    expect(renderer.setCamera).not.toHaveBeenCalled();
    expect(city.camera).toEqual(BOOKMARK);
    expect(paths(w)).toEqual([B_TO_C, 'core/a.ts:1']);   // b.ts selected: it imports c.ts; a.ts imports it
  });

  it('selecting another file clears the highlight', async () => {
    const snap = setup();
    const { w } = mountInspector();
    await w.get('button.ci-city-relations__highlight').trigger('click');
    expect(useRelationsStore().highlightedCycleId).not.toBeNull();
    useCityStore().select(idOf(snap, 'core/b.ts'));
    await nextTick();
    expect(useRelationsStore().highlightedCycleId).toBeNull();
    expect(w.get('button.ci-city-relations__highlight').attributes('aria-pressed')).toBe('false');
  });

  it('stale evidence still lists the rows, with the stale label in the section', () => {
    setup('stale');
    const { w } = mountInspector();
    expect(section(w).get('.ci-provenance--stale').text()).toBe('Stale');
    expect(paths(w)).toEqual([A_TO_B, C_TO_A]);
  });

  it('without a report it says not analysed, with no rows and no controls', () => {
    setup('none');
    const { w } = mountInspector();
    expect(section(w).text()).toContain(FALLOW_NOT_ANALYSED);
    expect(section(w).text()).toContain(RELATIONS_SCOPE_NOTE);
    expect(w.findAll('.ci-city-relations__row')).toHaveLength(0);
    expect(section(w).find('[role="group"]').exists()).toBe(false);
  });

  it('a re-export cycle is listed without a Highlight toggle; the file\'s import cycle keeps its own', () => {
    setup('recording', { select: 'barrel/index.ts' });
    const { w } = mountInspector();
    const cycles = w.findAll('.ci-city-relations__cycle');
    expect(cycles.map((c) => c.get('.ci-city-relations__kind').text())).toEqual([CYCLE_KIND_LABEL.import, CYCLE_KIND_LABEL['re-export']]);
    expect(cycles[0]!.find('.ci-city-relations__highlight').exists()).toBe(true);
    expect(cycles[1]!.text()).toContain('barrel/x.ts');
    expect(cycles[1]!.find('.ci-city-relations__highlight').exists()).toBe(false);
    const labels = w.findAll('.ci-city-relations__highlight').map((b) => b.attributes('aria-label'));
    expect(labels).toHaveLength(1);
  });

  it('a partly unmatched cycle is listed with its missing member, without a Highlight toggle', () => {
    setup('recording', { paths: RELATIONS_PATHS.filter((p) => p !== 'core/c.ts') });
    const { w } = mountInspector();
    const cycles = w.findAll('.ci-city-relations__cycle');
    expect(cycles).toHaveLength(1);
    expect(cycles[0]!.text()).toContain(RELATION_MEMBER_UNMATCHED);
    expect(cycles[0]!.find('.ci-city-relations__highlight').exists()).toBe(false);
  });

  it('a highlighted cycle longer than 24 hops says how many arcs are not shown', async () => {
    setup('recording', { paths: [...RELATIONS_PATHS, ...LONG], json: longCycleJson(), select: LONG[0]! });
    const { w } = mountInspector();
    const cycle = w.findAll('.ci-city-relations__cycle').find((c) => c.get('code').text().startsWith(`${LONG[0]}:1`))!;
    expect(cycle.find('.ci-city-relations__hidden').exists()).toBe(false);
    await cycle.get('button.ci-city-relations__highlight').trigger('click');
    expect(cycle.get('.ci-city-relations__hidden').text()).toBe(RELATION_HIDDEN(6));
    await section(w).get('.ci-city-relations__arcs input').setValue(false);
    expect(cycle.find('.ci-city-relations__hidden').exists()).toBe(false);   // no arcs drawn, nothing hidden
  });
});

describe('the relations store, one per leaf (N31)', () => {
  it('changing leaf A\'s direction leaves leaf B\'s store at both, and B\'s camera unchanged', async () => {
    const leafA = createPinia();
    const leafB = createPinia();
    setActivePinia(leafA);
    setup();
    setActivePinia(leafB);
    setup();
    const a = mountInspector(leafA);
    const b = mountInspector(leafB);
    await press(a.w, RELATIONS_DIRECTION_LABEL, RELATIONS_DIRECTION_IN);
    expect(useRelationsStore(leafA).direction).toBe('in');
    expect(useRelationsStore(leafB).direction).toBe('both');
    expect(pressed(b.w, RELATIONS_DIRECTION_LABEL)).toEqual([RELATIONS_DIRECTION_BOTH]);
    expect(useCityStore(leafB).camera).toEqual(BOOKMARK);
    expect(b.renderer.setCamera).not.toHaveBeenCalled();
  });

  it('detaching the report resets it to its defaults', () => {
    setup();
    const store = customise();
    useEvidenceStore().remove();
    expect([store.direction, store.hops, store.showArcs, store.highlightedCycleId]).toEqual(DEFAULTS);
  });

  it('binding a different repository resets it to its defaults', () => {
    setup();
    const store = customise();
    useEvidenceStore().bindRepository('another-repository');
    expect([store.direction, store.hops, store.showArcs, store.highlightedCycleId]).toEqual(DEFAULTS);
  });

  it('ignores an unknown direction, hop count or Show arcs value', () => {
    const store = useRelationsStore();
    store.setDirection('sideways' as unknown as RelationControlDirection);
    store.setHops(3 as unknown as 1);
    store.setShowArcs('no' as unknown as boolean);
    expect([store.direction, store.hops, store.showArcs]).toEqual(['both', 1, true]);
  });

  it('J15: showCycleInCity selects, then highlights, then navigates — the highlight survives the selection', () => {
    const snap = setup();
    const city = useCityStore();
    const store = useRelationsStore();
    city.navigate('architecture');
    city.closeInspector();   // final review #6: Show in city must open it, as File detail's does
    let highlightAtNavigate: string | null | undefined;
    const stop = watch(() => city.route, () => { highlightAtNavigate = store.highlightedCycleId; }, { flush: 'sync' });
    store.showCycleInCity('CY-00000002', idOf(snap, 'core/b.ts'));
    stop();
    expect(city.selectedEntityId).toBe(idOf(snap, 'core/b.ts'));
    expect(store.highlightedCycleId).toBe('CY-00000002');
    expect(highlightAtNavigate).toBe('CY-00000002');
    expect(city.route).toBe('city');
    expect(city.inspectorOpen).toBe(true);
    expect(city.camera).toEqual(BOOKMARK);
  });

  it('E26/JP6: re-importing a report that drops the highlighted cycle clears it, and sends no cycle arcs', async () => {
    const snap = setup();
    mountInspector();
    const core = useReadModels().relations.value.cycles.find((c) => c.pathText.startsWith('core/a.ts'))!;
    const store = useRelationsStore();
    store.highlightCycle(core.findingId);
    await nextTick();
    expect(store.highlightedCycleId).toBe(core.findingId);
    // Minor 5 (polish final review): FileInspector never calls the renderer's setRelations
    // itself (only CityStage does), so asserting against `renderer.setRelations` here was
    // vacuous — it could never have been called either way. Assert on the read model that
    // actually feeds the arcs instead: a `role: 'cycle'` arc exists while highlighted
    // (non-empty precondition, E27), then none once the re-import drops the highlight.
    const arcsBefore = useCityRelations().value.arcs;
    expect(arcsBefore?.some((a) => a.role === 'cycle')).toBe(true);

    reimportRelationsReport(snap, withoutCoreCycleJson());
    await nextTick();
    expect(store.highlightedCycleId).toBeNull();
    const arcsAfter = useCityRelations().value.arcs;
    expect(arcsAfter?.some((a) => a.role === 'cycle')).toBe(false);
  });

  it('E26/JP6: re-importing the same report keeps the highlight (same content-hash finding id)', async () => {
    const snap = setup();
    mountInspector();
    const core = useReadModels().relations.value.cycles.find((c) => c.pathText.startsWith('core/a.ts'))!;
    const store = useRelationsStore();
    store.highlightCycle(core.findingId);
    await nextTick();

    reimportRelationsReport(snap);   // the exact same recording, re-imported
    await nextTick();
    expect(store.highlightedCycleId).toBe(core.findingId);
  });
});
