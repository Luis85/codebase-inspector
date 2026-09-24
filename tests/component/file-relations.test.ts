// WP-03 Task 10 (N17, N25): File detail's Relations panel — the file's evidenced hop-1
// neighbourhood (both directions), its cycles as path text, and fallow's fanOut. N5: an
// unanalysed report reads FALLOW_NOT_ANALYSED, and a file with no evidenced edge reads
// RELATIONS_NONE_FOR_FILE, never "no imports". RELATIONS_SCOPE_NOTE always shows.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import FileDetailScreen from '../../src/ui/screens/FileDetailScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import {
  FALLOW_NOT_ANALYSED, RELATION_HIDDEN, RELATION_SOURCE_CYCLE, RELATIONS_DIRECTION_IN, RELATIONS_DIRECTION_OUT, RELATIONS_FAN_OUT,
  RELATIONS_NONE_FOR_FILE, RELATIONS_SCOPE_NOTE, RELATIONS_TITLE,
} from '../../src/ui/inspector-copy';
import { RELATIONS_PATHS, attachRelationsReport, relationsRecordingJson, snapshotWithPaths } from '../fixtures/evidence-report';

const clipboard = { writeText: vi.fn(() => Promise.resolve()) };
const mountFile = () => mount(FileDetailScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), clipboard } } });
type Wrapper = ReturnType<typeof mountFile>;
/** The panel titled RELATIONS_TITLE, so a string the Findings panel also shows (e.g.
 *  FALLOW_NOT_ANALYSED without a report) never passes for the Relations panel's own. */
function relationsPanel(w: Wrapper) {
  const panel = w.findAll('.ci-panel').find((p) => p.find('.ci-panel__title').exists() && p.find('.ci-panel__title').text() === RELATIONS_TITLE);
  if (!panel) throw new Error(`no panel titled ${RELATIONS_TITLE}`);
  return panel;
}

function setup(paths: readonly string[] = RELATIONS_PATHS, report: 'recording' | 'none' = 'recording'): CodebaseSnapshot {
  const snap = snapshotWithPaths(paths, `repo-file-relations-${Math.random()}`);
  useCityStore().setCity(snap, computeLayout(snap));
  if (report === 'recording') attachRelationsReport(snap);
  return snap;
}

function selectFile(snap: CodebaseSnapshot, path: string): void {
  const file = snap.entities.find((e) => e.kind === 'file' && e.path === path)!;
  const store = useCityStore();
  store.select(file.id);
  store.navigate('file');
}

const GENERATED = Array.from({ length: 30 }, (_, i) => `gen/f${i}.ts`);

/** The recording with 30 extra boundary violations from core/a.ts to generated files, so
 *  core/a.ts's hop-1 neighbourhood (its own cycle hops plus these) exceeds RELATION_ARC_LIMIT. */
function manyEdgesFromAJson(): string {
  const raw = JSON.parse(relationsRecordingJson()) as { check: { boundary_violations: unknown[] } };
  raw.check.boundary_violations = GENERATED.map((path) => ({
    from_path: 'src/core/a.ts', to_path: `src/${path}`, from_zone: 'core', to_zone: 'gen',
    import_specifier: `src/${path}`, line: 5, col: 3,
  }));
  return JSON.stringify(raw);
}

describe('FileDetailScreen: Relations panel (WP-03 N17, N25)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('lists the outgoing and incoming evidenced hops, the cycle path text and fanOut, for core/a.ts', () => {
    const snap = setup();
    selectFile(snap, 'core/a.ts');
    const w = mountFile();
    const rows = w.findAll('.ci-file-relations__row').map((r) => r.text());
    expect(rows).toEqual([
      `${RELATIONS_DIRECTION_OUT}core/b.ts:1${RELATION_SOURCE_CYCLE}`,
      `${RELATIONS_DIRECTION_IN}core/c.ts:1${RELATION_SOURCE_CYCLE}`,
    ]);
    expect(w.find('.ci-file-relations__cycles').text()).toBe('core/a.ts:1 → core/b.ts:1 → core/c.ts:1 → core/a.ts');
    // The recording's health.file_scores lists src/core/a.ts with fan_out 1.
    const fanOut = w.find('.ci-file-relations__fan-out');
    expect(fanOut.text()).toBe(`${RELATIONS_FAN_OUT}1`);
    expect(fanOut.find('.ci-provenance').exists()).toBe(false);
    w.unmount();
  });

  it('a stale report\'s fan-out is marked stale', () => {
    const snap = setup(RELATIONS_PATHS, 'none');
    attachRelationsReport(snap, { snapshotId: 'an-older-snapshot' });
    selectFile(snap, 'core/a.ts');
    const w = mountFile();
    const fanOut = w.find('.ci-file-relations__fan-out');
    expect(fanOut.text()).toContain('1');
    expect(fanOut.find('.ci-provenance--stale').exists()).toBe(true);
    w.unmount();
  });

  it('selecting a row moves the File detail selection to that file, without moving the camera', async () => {
    const snap = setup();
    selectFile(snap, 'core/a.ts');
    const w = mountFile();
    const store = useCityStore();
    await w.find('.ci-file-relations__select').trigger('click');
    expect(store.selectedEntityId).toBe(snap.entities.find((e) => e.path === 'core/b.ts')!.id);
    expect(store.route).toBe('file');
    expect(store.camera).toBeNull();
    expect(w.find('.ci-page-header__title').text()).toBe('b.ts');
    w.unmount();
  });

  it('a file with no evidenced edge reads RELATIONS_NONE_FOR_FILE, never "no imports"', () => {
    const snap = setup();
    selectFile(snap, 'orphan.ts');
    const w = mountFile();
    const panel = relationsPanel(w);
    expect(panel.text()).toContain(RELATIONS_NONE_FOR_FILE);
    expect(panel.text()).not.toContain('no imports');
    expect(panel.findAll('.ci-file-relations__row')).toHaveLength(0);
    w.unmount();
  });

  it('without a report the Relations panel is not analysed', () => {
    const snap = setup(RELATIONS_PATHS, 'none');
    selectFile(snap, 'core/a.ts');
    const w = mountFile();
    const panel = relationsPanel(w);
    expect(panel.text()).toContain(FALLOW_NOT_ANALYSED);
    expect(panel.text()).not.toContain(RELATIONS_NONE_FOR_FILE);
    expect(panel.find('.ci-file-relations__fan-out').exists()).toBe(false);
    w.unmount();
  });

  it('always shows the RELATIONS_SCOPE_NOTE, with or without a report', () => {
    const snap = setup();
    selectFile(snap, 'core/a.ts');
    const w = mountFile();
    expect(relationsPanel(w).text()).toContain(RELATIONS_SCOPE_NOTE);
    w.unmount();
    setActivePinia(createPinia());
    const bare = setup(RELATIONS_PATHS, 'none');
    selectFile(bare, 'core/a.ts');
    const w2 = mountFile();
    expect(relationsPanel(w2).text()).toContain(RELATIONS_SCOPE_NOTE);
    w2.unmount();
  });

  it('caps the neighbourhood at 24 rows and shows the hidden count beyond it', () => {
    const snap = setup([...RELATIONS_PATHS, ...GENERATED], 'none');
    attachRelationsReport(snap, { json: manyEdgesFromAJson() });
    selectFile(snap, 'core/a.ts');
    const w = mountFile();
    expect(w.findAll('.ci-file-relations__row')).toHaveLength(24);
    expect(w.text()).toContain(RELATION_HIDDEN(8));
    w.unmount();
  });
});
