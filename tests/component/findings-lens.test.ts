// Part 6 Y40: the findings lens in the UI. Covers:
// - the toolbar Colour select (only with evidence, never disabled);
// - the renderer wiring (useLensRenderer, re-applied to a rebuilt renderer);
// - the heading with its badge, and COPY-16 when stale;
// - the legend rows;
// - the list-mode Reported column.
// Evidence comes from the shared fixture (R5): real-shaped fallow JSON through the real
// reader, builder and evidence store.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../mocks/obsidian';
import { defineComponent, h, nextTick, shallowRef, type ShallowRef } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AppToolbar from '../../src/ui/components/AppToolbar.vue';
import CityStage from '../../src/ui/components/CityStage.vue';
import CodebaseFileList from '../../src/ui/components/CodebaseFileList.vue';
import MetricLegend from '../../src/ui/components/MetricLegend.vue';
import { useLensRenderer } from '../../src/ui/screens/city/use-lens-renderer';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useLensStore } from '../../src/ui/stores/lens-store';
import { CITY_RENDERER_KEY } from '../../src/ui/renderer-handle';
import { computeLayout } from '../../src/domain/layout/layout';
import { formatAbsoluteTime } from '../../src/ui/copy';
import {
  COPY_16, LENS_EYEBROW, LENS_LABEL, LENS_LEGEND_NONE, LENS_LEGEND_REPORTED, LENS_LIST_CELL, LENS_LIST_COLUMN,
  LENS_LIST_NONE, LENS_LIST_TEXT, LENS_OPTION_CATEGORY, LENS_OPTION_FINDINGS, LENS_SUBTITLE, LENS_TITLE,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { SYNTHETIC_VERSION, attachSyntheticReport, snapshotWithOnlyFiles, snapshotWithPaths } from '../fixtures/evidence-report';
import { RELATIONS_PATHS, attachRelationsReport } from '../fixtures/relations-report';
import type { CameraBookmark, CodebaseSnapshot, CodeEntity } from '../../src/domain/model';
import type { EvidenceReport } from '../../src/application/evidence/model';
import type { CityRendererPort } from '../../src/visualization/renderer-port';

const CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d', position: [0, 0, 0], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};

function makeRenderer() {
  return {
    setLayout: vi.fn(async () => {}), setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(),
    setReported: vi.fn<CityRendererPort['setReported']>(), setRelations: vi.fn(), setLabels: vi.fn(), setCameraMode: vi.fn(),
    setMotion: vi.fn(), getCamera: vi.fn((): CameraBookmark => CAMERA), setCamera: vi.fn(), nudgeCamera: vi.fn(),
    focus: vi.fn(), fit: vi.fn(), resize: vi.fn(), pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
    getDiagnostics: vi.fn(() => ({
      geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false,
    })),
    debugLoseContext: vi.fn(),
  } satisfies CityRendererPort;
}

let snapshot: CodebaseSnapshot;
function fileAt(i: number): CodeEntity {
  const file = snapshot.entities.filter((e) => e.kind === 'file')[i];
  if (!file) throw new Error(`the fixture has no file ${i}`);
  return file;
}

/** The shared fixture's report for files 4 and 9 only (file 0 is the unavailable lot).
 *  Per syntheticFallowJson's own rules, over those two files:
 *  - file 4 gets an unused export, a critical complexity finding and one clone instance (3 findings);
 *  - file 9 gets an unused export and the other clone instance (2 findings).
 *  That is 5 findings on 2 files, and every other file has none. */
function attachEvidence(snapshotId?: string): EvidenceReport {
  const reported = snapshotWithOnlyFiles(snapshot, [fileAt(4).path, fileAt(9).path]);
  return attachSyntheticReport(reported, snapshotId === undefined ? {} : { snapshotId });
}
const REPORTED = (): Set<string> => new Set([fileAt(4).id, fileAt(9).id]);

const wrappers: { unmount(): void }[] = [];
function keep<T extends { unmount(): void }>(wrapper: T): T {
  wrappers.push(wrapper);
  return wrapper;
}

const Probe = defineComponent({ setup() { useLensRenderer(); return () => h('div'); } });
function mountProbe(handle: ShallowRef<CityRendererPort | null>) {
  return keep(mount(Probe, { global: { provide: { [CITY_RENDERER_KEY as symbol]: handle } } }));
}

beforeEach(() => {
  setActivePinia(createPinia());
  snapshot = buildSnapshotFixture({ files: 12, directories: 3, repositoryId: 'repo-lens', unavailable: 1 });
  useCityStore().setCity(snapshot, computeLayout(snapshot));
});

afterEach(() => {
  wrappers.splice(0).forEach((w) => { w.unmount(); });
  document.body.replaceChildren();
});

describe('the toolbar Colour select (Y40)', () => {
  it('is not rendered without evidence — never a disabled control', () => {
    const w = keep(mount(AppToolbar));
    expect(w.find('.ci-toolbar__lens').exists()).toBe(false);
    expect(w.find('select').exists()).toBe(false);
  });

  it('appears with evidence, named by its visible label, offering the two lenses', () => {
    attachEvidence();
    const w = keep(mount(AppToolbar));
    const select = w.get('select.ci-toolbar__lens');
    const label = w.get('label.ci-toolbar__lens-label');
    expect(label.text()).toBe(LENS_LABEL);
    expect(label.attributes('for')).toBe(select.attributes('id'));
    expect(select.findAll('option').map((o) => o.text())).toEqual([LENS_OPTION_CATEGORY, LENS_OPTION_FINDINGS]);
    expect((select.element as HTMLSelectElement).value).toBe('category');
    expect(select.attributes('disabled')).toBeUndefined();
    expect(select.attributes('aria-disabled')).toBeUndefined();
  });

  it('choosing Reported findings sets this leaf\'s lens', async () => {
    attachEvidence();
    const w = keep(mount(AppToolbar));
    await w.get('select.ci-toolbar__lens').setValue('findings');
    expect(useLensStore().lens).toBe('findings');
  });

  it('disappears, and the lens resets, when the evidence is removed', async () => {
    attachEvidence();
    const w = keep(mount(AppToolbar));
    await w.get('select.ci-toolbar__lens').setValue('findings');
    expect(useEvidenceStore().remove()).toBe(true);
    await nextTick();
    expect(w.find('.ci-toolbar__lens').exists()).toBe(false);
    expect(useLensStore().lens).toBe('category');
  });

  it('disappears, and the lens resets, on a codebase switch', async () => {
    attachEvidence();
    const w = keep(mount(AppToolbar));
    await w.get('select.ci-toolbar__lens').setValue('findings');
    useEvidenceStore().bindRepository('repo-other');
    await nextTick();
    expect(w.find('.ci-toolbar__lens').exists()).toBe(false);
    expect(useLensStore().lens).toBe('category');
  });

  it('is not rendered mid-switch, while the evidence store still holds the OLD codebase\'s report (E18)', async () => {
    attachEvidence();
    const w = keep(mount(AppToolbar));
    expect(w.find('select.ci-toolbar__lens').exists()).toBe(true);
    const next = buildSnapshotFixture({ files: 3, repositoryId: 'repo-next' });
    useCityStore().setCity(next, computeLayout(next));     // the snapshot moved on; the store is not rebound yet
    await nextTick();
    expect(useEvidenceStore().report).not.toBeNull();
    expect(w.find('.ci-toolbar__lens').exists()).toBe(false);
  });
});

describe('useLensRenderer: the lens reaches the renderer (Y40)', () => {
  it('sends nothing to a fresh renderer while the lens is off', async () => {
    attachEvidence();
    const renderer = makeRenderer();
    mountProbe(shallowRef<CityRendererPort | null>(renderer));
    await nextTick();
    expect(renderer.setReported).not.toHaveBeenCalled();
  });

  it('sends the reported files when the lens turns on, and null when it turns off', async () => {
    attachEvidence();
    const renderer = makeRenderer();
    mountProbe(shallowRef<CityRendererPort | null>(renderer));
    useLensStore().setLens('findings');
    await nextTick();
    expect(renderer.setReported).toHaveBeenLastCalledWith(REPORTED());
    useLensStore().setLens('category');
    await nextTick();
    expect(renderer.setReported).toHaveBeenLastCalledWith(null);
    expect(renderer.setReported).toHaveBeenCalledTimes(2);
  });

  it('re-applies the set to a rebuilt renderer (context loss, floor, migration) and never to the old one', async () => {
    attachEvidence();
    const first = makeRenderer();
    const handle = shallowRef<CityRendererPort | null>(first);
    mountProbe(handle);
    useLensStore().setLens('findings');
    await nextTick();
    expect(first.setReported).toHaveBeenCalledTimes(1);
    handle.value = null;                                    // CityViewport disposes and clears the handle
    await nextTick();
    const rebuilt = makeRenderer();
    handle.value = rebuilt;                                 // …then constructs a new renderer
    await nextTick();
    expect(rebuilt.setReported).toHaveBeenCalledTimes(1);
    expect(rebuilt.setReported).toHaveBeenLastCalledWith(REPORTED());
    expect(first.setReported).toHaveBeenCalledTimes(1);
  });

  it('restores the category colours when the evidence goes away', async () => {
    attachEvidence();
    const renderer = makeRenderer();
    mountProbe(shallowRef<CityRendererPort | null>(renderer));
    useLensStore().setLens('findings');
    await nextTick();
    expect(useEvidenceStore().remove()).toBe(true);
    await nextTick();
    expect(renderer.setReported).toHaveBeenLastCalledWith(null);
  });
});

describe('CityStage in the findings lens (Y40)', () => {
  function mountStage(renderer = makeRenderer()) {
    const w = keep(mount(CityStage, {
      global: { provide: { [CITY_RENDERER_KEY as symbol]: shallowRef<CityRendererPort | null>(renderer) } },
    }));
    return { w, renderer };
  }

  it('shows no lens heading while the lens is off', () => {
    attachEvidence();
    expect(mountStage().w.find('.ci-city-lens').exists()).toBe(false);
  });

  it('shows the heading with the matched counts and the evidence badge, and drives the renderer', async () => {
    attachEvidence();
    useLensStore().setLens('findings');
    const { w, renderer } = mountStage();
    await nextTick();
    const heading = w.get('.ci-city-lens');
    expect(heading.get('.ci-city-lens__eyebrow').text()).toBe(LENS_EYEBROW);
    expect(heading.get('.ci-city-lens__title').text()).toBe(LENS_TITLE);
    expect(heading.get('.ci-city-lens__subtitle').text()).toBe(LENS_SUBTITLE(5, 2));
    expect(heading.text()).toContain(SYNTHETIC_VERSION);
    expect(heading.find('.ci-city-lens__stale').exists()).toBe(false);
    expect(renderer.setReported).toHaveBeenLastCalledWith(REPORTED());
  });

  it('keeps the lens on stale evidence and says so with COPY-16 under the heading', async () => {
    const report = attachEvidence('snapshot-older');
    useLensStore().setLens('findings');
    const { w, renderer } = mountStage();
    await nextTick();
    expect(w.get('.ci-city-lens__stale').text()).toBe(COPY_16(formatAbsoluteTime(report.importedAt, Intl)));
    expect(renderer.setReported).toHaveBeenLastCalledWith(REPORTED());
  });
});

describe('MetricLegend in the findings lens (Y40)', () => {
  it('names the two lens colours instead of the categories while the lens is on', async () => {
    attachEvidence();
    const w = keep(mount(MetricLegend));
    expect(w.findAll('.ci-legend__entry').map((e) => e.text())).toEqual(['typescript']);
    useLensStore().setLens('findings');
    await nextTick();
    expect(w.findAll('.ci-legend__entry').map((e) => e.text())).toEqual([LENS_LEGEND_REPORTED, LENS_LEGEND_NONE]);
    expect(w.findAll('.ci-legend__swatch-group .ci-legend__swatch')).toHaveLength(1);
    expect(w.find('.ci-legend__swatch--none').exists()).toBe(true);
  });

  it('drops the Reported row, never a row with no swatch, when no measured lot is reported', async () => {
    const unavailable = useCityStore().layout?.lots.find((l) => l.metricState === 'unavailable');
    expect(unavailable?.entityId).toBe(fileAt(0).id);        // the fixture's one unavailable lot is file 0
    attachSyntheticReport(snapshotWithOnlyFiles(snapshot, [fileAt(0).path]));
    useLensStore().setLens('findings');
    const w = keep(mount(MetricLegend));
    await nextTick();
    expect(w.findAll('.ci-legend__entry').map((e) => e.text())).toEqual([LENS_LEGEND_NONE]);
    expect(w.find('.ci-legend__swatch-group').exists()).toBe(false);
  });
});

describe('the list-mode Reported column (Y40)', () => {
  it('adds a Reported column in list mode only: the count, or an em dash', async () => {
    attachEvidence();
    useLensStore().setLens('findings');
    const w = keep(mount(CodebaseFileList));
    expect(w.find('.ci-file-list__reported-head').exists()).toBe(false);   // beside the canvas, the city carries the lens
    useCityStore().setViewMode('list');
    await nextTick();
    expect(w.get('.ci-file-list__reported-head').text()).toBe(LENS_LIST_COLUMN);
    const cell = (i: number) => {
      const row = w.findAll('.ci-file-list__row').find((r) => r.text().startsWith(fileAt(i).path));
      if (!row) throw new Error(`no row for file ${i}`);
      return row.get('.ci-file-list__reported');
    };
    expect(cell(4).get('[aria-hidden="true"]').text()).toBe('3');
    expect(cell(9).get('[aria-hidden="true"]').text()).toBe('2');
    expect(cell(5).get('[aria-hidden="true"]').text()).toBe(LENS_LIST_NONE);
    expect(cell(4).get('.visually-hidden').text()).toBe(LENS_LIST_CELL(3));
    expect(cell(5).get('.visually-hidden').text()).toBe(LENS_LIST_CELL(0));
  });

  it('WP-03 N12: counts what the lens paints, so a non-anchor cycle member and a violation\'s target read 1, not a dash', async () => {
    const relSnap = snapshotWithPaths(RELATIONS_PATHS, 'repo-lens-relations');
    useCityStore().setCity(relSnap, computeLayout(relSnap));
    attachRelationsReport(relSnap);
    useLensStore().setLens('findings');
    useCityStore().setViewMode('list');
    const w = keep(mount(CodebaseFileList));
    await nextTick();
    const cell = (path: string) => {
      const row = w.findAll('.ci-file-list__row').find((r) => r.text().startsWith(path));
      if (!row) throw new Error(`no row for ${path}`);
      return row.get('.ci-file-list__reported [aria-hidden="true"]').text();
    };
    // core/b.ts and core/c.ts are members of the core cycle anchored on core/a.ts;
    // data/db.ts is the target of the ui/view.ts boundary violation. None anchors a finding.
    expect(cell('core/b.ts')).toBe('1');
    expect(cell('core/c.ts')).toBe('1');
    expect(cell('data/db.ts')).toBe('1');
    expect(cell('core/a.ts')).toBe('1');
    expect(cell('data/types.ts')).toBe(LENS_LIST_NONE);
  });

  it('has no column once the lens is off', async () => {
    attachEvidence();
    useCityStore().setViewMode('list');
    const w = keep(mount(CodebaseFileList));
    await nextTick();
    expect(w.find('.ci-file-list__reported').exists()).toBe(false);
    expect(w.find('.ci-file-list__reported-head').exists()).toBe(false);
  });
});

describe('Polish E11: the Reported count reads the same shown and spoken', () => {
  it('groups thousands in both, and shows none as a dash', () => {
    expect(LENS_LIST_TEXT(12_345)).toBe('12,345');
    expect(LENS_LIST_CELL(12_345)).toBe(', 12,345 reported findings');
    expect(LENS_LIST_TEXT(0)).toBe(LENS_LIST_NONE);
    expect(LENS_LIST_TEXT(null)).toBe(LENS_LIST_NONE);
  });
});
