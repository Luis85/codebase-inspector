import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import CodebaseFileList from '../../src/ui/components/CodebaseFileList.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../../tests/fixtures/snapshot-builder';
import { CITY_RENDERER_KEY } from '../../src/ui/renderer-handle';
import { classify } from '../../src/domain/classify';
import { makeEntityId } from '../../src/domain/entity-id';
import type { CityRendererPort } from '../../src/visualization/renderer-port';
import type { CodeEntity, CodebaseSnapshot, Observation } from '../../src/domain/model';

function makeRendererDouble() {
  return {
    setLayout: vi.fn(async () => {}),
    setColors: vi.fn(), setSelection: vi.fn(), setFilter: vi.fn(), setLabels: vi.fn(),
    setCameraMode: vi.fn(), setMotion: vi.fn(),
    getCamera: vi.fn(() => ({ projection: 'orthographic' as const, mode: '3d' as const, position: [0, 0, 0] as [number, number, number], target: [0, 0, 0] as [number, number, number], up: [0, 1, 0] as [number, number, number], zoom: 1 })),
    setCamera: vi.fn(), nudgeCamera: vi.fn(), focus: vi.fn(), fit: vi.fn(), resize: vi.fn(),
    pause: vi.fn(), resume: vi.fn(), dispose: vi.fn(),
    getDiagnostics: vi.fn(() => ({ geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0, lastFrameMs: 0, contextLost: false })),
    debugLoseContext: vi.fn(),
  };
}

function mountWithRenderer(rendererDouble: CityRendererPort) {
  return mount(CodebaseFileList, {
    global: { provide: { [CITY_RENDERER_KEY as symbol]: { value: rendererDouble } } },
  });
}

/** Task 6: a snapshot built from EXPLICIT paths, for the two fixtures `buildSnapshotFixture`
 *  cannot produce (round-robin directory assignment, no control over which basename lands
 *  where). Directory entities are synthesised from path prefixes, deduplicated by path,
 *  parented recursively -- exactly the containment tree `buildDistrictLayout` (districts.ts)
 *  expects. */
function buildPathsSnapshot(paths: readonly string[]): CodebaseSnapshot {
  const repositoryId = 'repo-paths';
  const repositoryEntity: CodeEntity = {
    id: makeEntityId(repositoryId, 'repository', ''),
    repositoryId, kind: 'repository', path: '', name: repositoryId, parentId: null, category: null,
  };
  const entities: CodeEntity[] = [repositoryEntity];
  const observations: Observation[] = [];
  const dirsByPath = new Map<string, CodeEntity>();

  function ensureDir(dirPath: string): CodeEntity {
    if (dirPath === '') return repositoryEntity;
    const existing = dirsByPath.get(dirPath);
    if (existing) return existing;
    const lastSlash = dirPath.lastIndexOf('/');
    const parent = ensureDir(lastSlash === -1 ? '' : dirPath.slice(0, lastSlash));
    const entity: CodeEntity = {
      id: makeEntityId(repositoryId, 'directory', dirPath),
      repositoryId, kind: 'directory', path: dirPath, name: dirPath.slice(lastSlash + 1),
      parentId: parent.id, category: null,
    };
    dirsByPath.set(dirPath, entity);
    entities.push(entity);
    return entity;
  }

  for (const path of paths) {
    const lastSlash = path.lastIndexOf('/');
    const parent = ensureDir(lastSlash === -1 ? '' : path.slice(0, lastSlash));
    const fileEntity: CodeEntity = {
      id: makeEntityId(repositoryId, 'file', path),
      repositoryId, kind: 'file', path, name: path.slice(lastSlash + 1),
      parentId: parent.id, category: classify(path),
    };
    entities.push(fileEntity);
    observations.push({
      entityId: fileEntity.id,
      measurement: { metricId: 'physical-lines', unit: 'lines', definitionVersion: '1' },
      status: 'measured', value: 10, reason: null,
    });
  }

  return {
    snapshotId: 'snapshot-paths', schemaVersion: 1, repositoryId,
    providerRun: {
      runId: 'run-paths', provider: 'builtin-inventory', origin: 'collected',
      capturedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:01.000Z',
    },
    scope: { rootPath: '/fixture/paths', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false },
    entities, observations, fileSetDigest: `fixture-digest-paths-${entities.length}`,
    completeness: 'complete', warnings: [],
  };
}

/** Set by every `mountList` call, so a test that mounts once can still assert against
 *  the double afterwards -- mirroring task-6-brief.md's pseudocode, which reads
 *  `rendererDouble` as a variable already in scope by the time it asserts. Named
 *  differently from the LOCAL `rendererDouble` const several tests above already
 *  declare (no-shadow), not because the concept differs. */
let mountedRendererDouble: ReturnType<typeof makeRendererDouble>;

function mountList(spec: { files?: number; directories?: number; paths?: readonly string[] }) {
  const store = useCityStore();
  const snapshot = spec.paths
    ? buildPathsSnapshot(spec.paths)
    : buildSnapshotFixture({ files: spec.files ?? 0, directories: spec.directories ?? 0 });
  store.setCity(snapshot, computeLayout(snapshot));
  mountedRendererDouble = makeRendererDouble();
  return mountWithRenderer(mountedRendererDouble);
}

describe('CodebaseFileList.vue (C07)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders rows as NATIVE BUTTONS', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 3 });
    store.setCity(snapshot, computeLayout(snapshot));
    const rendererDouble = makeRendererDouble();
    const wrapper = mountWithRenderer(rendererDouble);
    const row = wrapper.get('.ci-file-list__row');
    expect(row.element.tagName).toBe('BUTTON');
  });

  // Phase 2 fix wave, M7: `rovingTabIndex` returning 0 for EVERY row left the suite
  // green. A stated accessibility decision ("moving focus with the keyboard never
  // selects") depends on exactly one row being in the tab order -- making every row
  // tabbable would put thousands of stops in it with nothing to notice.
  it('M7: exactly ONE row is in the tab order, and it follows the roving focus', async () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 3 });
    store.setCity(snapshot, computeLayout(snapshot));
    const wrapper = mountWithRenderer(makeRendererDouble());
    const tabIndexes = (): (string | undefined)[] =>
      wrapper.findAll('.ci-file-list__row').map((row) => row.attributes('tabindex'));

    // No roving focus yet: the FIRST row is the single entry point.
    expect(tabIndexes()).toEqual(['0', '-1', '-1']);

    const ids = snapshot.entities.filter((e) => e.kind === 'file').map((e) => e.id);
    store.focusRow(ids[2]!);
    await nextTick();
    expect(tabIndexes()).toEqual(['-1', '-1', '0']);
    // ...and moving focus did NOT select (spec: activation is Enter/click only).
    expect(store.selectedEntityId).toBeNull();
  });

  it('puts no role=tree on an incomplete implementation', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 3, directories: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    const wrapper = mountWithRenderer(makeRendererDouble());
    expect(wrapper.find('[role="tree"]').exists()).toBe(false);
  });

  // Task 10 fix round 1, item 2: REDIRECTED, not deleted. This used to assert that
  // activating a row called the renderer's setSelection directly from this component.
  // That ad-hoc call was the SECOND path to the port — a canvas pick had no equivalent,
  // so the two surfaces disagreed — and it is gone. What a row activation owes is
  // unchanged: it writes the store of record. The canvas half of the guarantee moved to
  // tests/component/city-viewport-wiring.test.ts ("mirrors the store selection onto the
  // renderer, whichever surface set it") and is still proved end to end through a real
  // CityView in tests/host/city-view-store-wiring.test.ts. The renderer assertion stays,
  // inverted, so reintroducing a direct command here fails this test.
  it('drives the canvas through the store, the single selection path', async () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    const rendererDouble = makeRendererDouble();
    const wrapper = mountWithRenderer(rendererDouble);
    const row = wrapper.get('.ci-file-list__row');
    await row.trigger('click');
    const fileEntity = snapshot.entities.find((e) => e.kind === 'file')!;
    expect(store.selectedEntityId).toBe(fileEntity.id);
    expect(rendererDouble.setSelection).not.toHaveBeenCalled();
  });

  it('does not select on mere focus movement', async () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 2 });
    store.setCity(snapshot, computeLayout(snapshot));
    const rendererDouble = makeRendererDouble();
    const wrapper = mountWithRenderer(rendererDouble);
    const row = wrapper.get('.ci-file-list__row');
    await row.trigger('focus');
    expect(store.selectedEntityId).toBeNull();
    // Vacuous against this component since item 2 (it commands no renderer at all now),
    // but kept deliberately as the structural guard the test above names: focus must
    // never select, by EITHER path.
    expect(rendererDouble.setSelection).not.toHaveBeenCalled();
  });

  it('shows COPY-11 when nothing matches', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 4 });
    store.setCity(snapshot, computeLayout(snapshot));
    store.setQuery('nothing-matches-any-of-these');
    const wrapper = mountWithRenderer(makeRendererDouble());
    expect(wrapper.text()).toContain('No matching files. The snapshot still contains');
  });

  // Phase 2c, ruling M102. The rows now carry `v-memo`, so each one is re-patched only
  // when one of its listed dependencies changes -- which is exactly the optimisation that
  // can silently stop a row from updating if a dependency is missing from that list. The
  // three existing tests above all assert the FIRST render (they set the store up before
  // mounting), so none of them could see such a bug. These assert the UPDATE path: every
  // state a row's rendering depends on, changed AFTER mount.
  it('M102: a row re-renders when the dimming, selection or focus changes after mount', async () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 4 });
    store.setCity(snapshot, computeLayout(snapshot));
    const files = snapshot.entities.filter((e) => e.kind === 'file');
    const wrapper = mountWithRenderer(makeRendererDouble());
    const dimmedCount = (): number =>
      wrapper.findAll('.ci-file-list__row').filter((r) => r.classes().includes('ci-file-list__row--dimmed')).length;

    expect(dimmedCount()).toBe(0);
    store.setQuery(files[0]!.path);
    await nextTick();
    expect(dimmedCount()).toBe(3);                       // dimming reaches the rows
    store.setQuery('');
    await nextTick();
    expect(dimmedCount()).toBe(0);                       // ...and comes back off again

    store.select(files[2]!.id);
    await nextTick();
    const selected = wrapper.findAll('.ci-file-list__row')
      .filter((r) => r.classes().includes('ci-file-list__row--selected'));
    expect(selected).toHaveLength(1);
    expect(selected[0]!.attributes('aria-pressed')).toBe('true');

    store.focusRow(files[3]!.id);
    await nextTick();
    const tabbable = wrapper.findAll('.ci-file-list__row').filter((r) => r.attributes('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
    expect(tabbable[0]!.text()).toBe(files[3]!.path);
  });

  it('dims non-matches in place rather than hiding rows', () => {
    const store = useCityStore();
    const snapshot = buildSnapshotFixture({ files: 3 });
    store.setCity(snapshot, computeLayout(snapshot));
    const files = snapshot.entities.filter((e) => e.kind === 'file');
    store.setQuery(files[0]!.path);
    const wrapper = mountWithRenderer(makeRendererDouble());
    const rows = wrapper.findAll('.ci-file-list__row');
    expect(rows).toHaveLength(3);   // never hidden
    const dimmed = rows.filter((r) => r.classes().includes('ci-file-list__row--dimmed'));
    expect(dimmed.length).toBe(2);
  });

  // Task 6 (F9/F4). C07 declares `grouping` as an input and `directoryFocusRequested` as
  // an event; before this task neither had a surface at all.
  describe('task 6: panel header, grouping, directory focus, and wrap-at-separator', () => {
    it('names the panel and says how much is in it', () => {
      const wrapper = mountList({ files: 144, directories: 6 });
      const header = wrapper.find('.ci-file-list__header');
      expect(header.text()).toContain('Codebase files');
      expect(header.text()).toContain('144');
    });

    it('groups rows under their directory, with a count per group', () => {
      // C07's `grouping` input, ordered by `store.layout.districts` -- the same
      // districts the city itself draws -- rather than a second organisation.
      const wrapper = mountList({ files: 144, directories: 6 });
      const groups = wrapper.findAll('.ci-file-list__group');
      expect(groups.length).toBe(6);
      expect(groups[0]!.text()).toMatch(/\b24 files\b/);
    });

    it('offers directory focus from the group heading', async () => {
      // C07's `directoryFocusRequested`, which had no surface at all.
      const wrapper = mountList({ files: 144, directories: 6 });
      await wrapper.findAll('.ci-file-list__group-focus')[0]!.trigger('click');
      expect(mountedRendererDouble.focus).toHaveBeenCalledOnce();
    });

    it('still disambiguates duplicate basenames', () => {
      // C07's own requirement: grouping must not become an excuse to show a bare
      // basename twice. Rows still carry the full path.
      const wrapper = mountList({ paths: ['src/a/index.ts', 'src/b/index.ts'] });
      const labels = wrapper.findAll('.ci-file-list__row').map((row) => row.text());
      expect(new Set(labels).size).toBe(2);
    });

    it('breaks long paths at a separator, never mid-word', () => {
      // F4: `presentation/views/GeometrySidecarVie` / `w.ts` in the user's own capture.
      // Weak on its own -- jsdom computes almost nothing here -- paired with a harness
      // capture at narrow width, which is the real evidence (task-6-report.md).
      const wrapper = mountList({ paths: ['presentation/views/GeometrySidecarView.ts'] });
      const row = wrapper.find('.ci-file-list__row');
      expect(getComputedStyle(row.element).overflowWrap).not.toBe('break-word');
    });

    it('renders every path segment with none of its characters dropped or reordered', () => {
      // The <wbr>-insertion mechanism itself: this is what a jsdom test CAN see, since
      // `.text()` reads textContent, which a <wbr> never contributes to.
      const wrapper = mountList({ paths: ['presentation/views/GeometrySidecarView.ts'] });
      const row = wrapper.find('.ci-file-list__row');
      expect(row.text()).toBe('presentation/views/GeometrySidecarView.ts');
    });
  });
});
