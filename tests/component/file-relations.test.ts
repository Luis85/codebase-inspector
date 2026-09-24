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
import { FALLOW_NOT_ANALYSED, RELATION_HIDDEN, RELATIONS_NONE_FOR_FILE, RELATIONS_SCOPE_NOTE } from '../../src/ui/inspector-copy';
import { RELATIONS_PATHS, attachRelationsReport, relationsRecordingJson, snapshotWithPaths } from '../fixtures/evidence-report';

const clipboard = { writeText: vi.fn(() => Promise.resolve()) };
const mountFile = () => mount(FileDetailScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), clipboard } } });

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
    const panel = w.find('.ci-file-relations__list');
    expect(panel.text()).toContain('core/b.ts');
    expect(panel.text()).toContain('core/c.ts');
    expect(panel.text()).toContain('Cycle');
    expect(w.text()).toContain('core/a.ts:1 → core/b.ts:1 → core/c.ts:1 → core/a.ts');
    expect(w.text()).toContain('Imports (fallow)');
    expect(w.text()).toContain('1');
    w.unmount();
  });

  it('selecting a row moves the File detail selection to that file, without moving the camera', async () => {
    const snap = setup();
    selectFile(snap, 'core/a.ts');
    const w = mountFile();
    const store = useCityStore();
    await w.find('.ci-file-relations__select').trigger('click');
    expect(store.selectedEntityId).not.toBe(snap.entities.find((e) => e.path === 'core/a.ts')!.id);
    expect(store.route).toBe('file');
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('a file with no evidenced edge reads RELATIONS_NONE_FOR_FILE, never "no imports"', () => {
    const snap = setup();
    selectFile(snap, 'orphan.ts');
    const w = mountFile();
    expect(w.text()).toContain(RELATIONS_NONE_FOR_FILE);
    expect(w.text()).not.toContain('no imports');
    w.unmount();
  });

  it('without a report the Relations panel is not analysed', () => {
    const snap = setup(RELATIONS_PATHS, 'none');
    selectFile(snap, 'core/a.ts');
    const w = mountFile();
    expect(w.text()).toContain(FALLOW_NOT_ANALYSED);
    w.unmount();
  });

  it('always shows the RELATIONS_SCOPE_NOTE', () => {
    const snap = setup();
    selectFile(snap, 'core/a.ts');
    const w = mountFile();
    expect(w.text()).toContain(RELATIONS_SCOPE_NOTE);
    w.unmount();
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
