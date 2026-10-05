// Gap closure GRB1 (Y19, GCO7, GCQ7): Obsidian calls onExternalSettingsChange when data.json changed
// outside the plugin (a sync, a hand edit). Every open store re-reads it, read-only: the settings tab,
// a leaf's review, analysis and investigation stores, and the leaf's codebase name. Review Focus 1: a
// re-read that races an own review write in flight never hides that write.
// The real onload builds the real registry, analysis service and notes port; CityView is replaced by a
// stub that keeps the deps onload hands it, so a leaf's stores are wired exactly as onOpen wires them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, type Pinia } from 'pinia';
import CodebaseInspectorPlugin from '../../src/main';
import type { CityViewDeps } from '../../src/host/city-view';
import type { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { wireCodebaseName } from '../../src/host/codebase-name';
import { unwireDataPorts, wireDataPorts } from '../../src/host/data-ports';
import { makeEntityId } from '../../src/domain/entity-id';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useAnalysisStore } from '../../src/ui/stores/analysis-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';

const captured = vi.hoisted((): { deps: unknown } => ({ deps: null }));
vi.mock('../../src/host/city-view', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  CityView: class { readonly deps: unknown; constructor(_leaf: unknown, _plugin: unknown, deps: unknown) { this.deps = deps; captured.deps = deps; } },
}));

const REPO = 'p1';
const NOW = new Date('2026-10-05T10:00:00.000Z');
const FILE_A = makeEntityId(REPO, 'file', 'src/a.ts');
const profile = (name: string): Record<string, unknown> => ({ profileId: REPO, name, bindingId: null, exclusions: [], maxFileBytes: 1_000_000 });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

beforeEach(() => { vi.stubGlobal('window', {}); });
afterEach(() => { vi.unstubAllGlobals(); });

/** A loaded plugin over one in-memory data.json. `edit` changes the file as another program would;
 *  `hold()` keeps the next saveData pending until `release()`. */
function loaded() {
  let data: Record<string, unknown> = { profiles: [profile('Alpha')] };
  let held: (() => void) | null = null;
  let holding = false;
  const loadData = vi.fn(() => Promise.resolve(clone(data)));
  const saveData = vi.fn((next: Record<string, unknown>) => {
    const apply = (): void => { data = clone(next); };
    if (!holding) { apply(); return Promise.resolve(); }
    holding = false;
    return new Promise<void>((resolve) => { held = () => { apply(); resolve(); }; });
  });
  const app = {
    workspace: { onLayoutReady: vi.fn(), getLeavesOfType: vi.fn(() => []), on: vi.fn(() => ({})), offref: vi.fn() },
    vault: { adapter: {}, configDir: '.obsidian', on: vi.fn(() => ({})), getMarkdownFiles: vi.fn(() => []) },
    metadataCache: { on: vi.fn(() => ({})), getFileCache: vi.fn(() => null) },
    loadLocalStorage: vi.fn(() => null),
    saveLocalStorage: vi.fn(),
  };
  const p = Object.assign(Object.create(CodebaseInspectorPlugin.prototype) as object, {
    app, registerView: vi.fn(), addRibbonIcon: vi.fn(), addCommand: vi.fn(), addSettingTab: vi.fn(), registerEvent: vi.fn(),
    loadData, saveData,
  }) as unknown as CodebaseInspectorPlugin & { registerView: ReturnType<typeof vi.fn>; addSettingTab: ReturnType<typeof vi.fn> };
  const edit = (change: (d: Record<string, unknown>) => void): void => { const next = clone(data); change(next); data = next; };
  const hold = (): void => { holding = true; };
  const release = (): void => { held?.(); held = null; };
  return { p, loadData, saveData, edit, hold, release, isHeld: () => held !== null, read: () => data };
}

/** onload, then one leaf: the deps onload gives a CityView, wired to a Pinia as onOpen wires it. */
async function leaf(world: ReturnType<typeof loaded>): Promise<{ deps: CityViewDeps; pinia: Pinia; tab: CodebaseInspectorSettingTab }> {
  world.p.onload();
  const factory = world.p.registerView.mock.calls[0]?.[1] as (leaf: unknown) => unknown;
  factory({});
  const deps = captured.deps as CityViewDeps;
  const pinia = createPinia();
  wireDataPorts(pinia, deps, world.p);
  const tab = world.p.addSettingTab.mock.calls[0]?.[0] as CodebaseInspectorSettingTab;
  await tab.refresh();
  return { deps, pinia, tab };
}

const tabNames = (tab: CodebaseInspectorSettingTab): string[] =>
  (tab as unknown as { entries: { profile: { name: string } }[] }).entries.map((e) => e.profile.name);

describe('onExternalSettingsChange (GRB1)', () => {
  it('is a no-op before onload and after onunload: nothing is read or written', () => {
    const world = loaded();
    expect(() => { world.p.onExternalSettingsChange(); }).not.toThrow();
    world.p.onload();
    world.p.onunload();
    const reads = world.loadData.mock.calls.length;
    world.p.onExternalSettingsChange();
    expect(world.loadData.mock.calls.length).toBe(reads);
    expect(world.saveData).not.toHaveBeenCalled();
  });

  it('refreshes the settings tab, which lists the renamed profile', async () => {
    const world = loaded();
    const { tab } = await leaf(world);
    expect(tabNames(tab)).toEqual(['Alpha']);
    world.edit((d) => { d.profiles = [profile('Renamed elsewhere')]; });
    world.p.onExternalSettingsChange();
    await vi.waitFor(() => { expect(tabNames(tab)).toEqual(['Renamed elsewhere']); });
    expect(world.saveData).not.toHaveBeenCalled();
  });

  it('re-lists the review store, re-reads the analysis binding, the codebase name and the notes folder, writing nothing', async () => {
    const world = loaded();
    const { deps, pinia } = await leaf(world);
    const review = useReviewStore(pinia);
    await review.bindRepository(REPO);
    await review.addWorkItemForFile(FILE_A, 'Split the parser', NOW);
    expect(review.workItems.map((w) => w.title)).toEqual(['Split the parser']);
    const readBinding = vi.spyOn(deps.fallowAnalysis, 'readBinding');
    useAnalysisStore(pinia).bindRepository(REPO);
    useEvidenceStore(pinia).bindRepository(REPO);
    const investigation = useInvestigationStore(pinia);
    await vi.waitFor(() => { expect(investigation.destination?.isDefault).toBe(true); });
    const names: (string | undefined)[] = [];
    const name = wireCodebaseName({ plugin: world.p, profileStore: deps.profileStore, profileId: () => REPO, setName: (n) => { names.push(n); } });
    await flushPromises();
    const bindingReads = readBinding.mock.calls.length;
    const saves = world.saveData.mock.calls.length;

    world.edit((d) => {
      d.profiles = [profile('Beta')];
      d.investigations = { [REPO]: { folder: 'Elsewhere' } };
      const reviews = d.reviews as Record<string, Record<string, unknown>>;
      reviews[REPO] = { ...reviews[REPO], workItems: [] };
    });
    world.p.onExternalSettingsChange();
    await vi.waitFor(() => {
      expect(review.workItems).toEqual([]);
      expect(investigation.destination).toEqual({ folder: 'Elsewhere', isDefault: false });
      expect(names.at(-1)).toBe('Beta');
    });
    expect(readBinding.mock.calls.length).toBeGreaterThan(bindingReads);
    expect(readBinding).toHaveBeenLastCalledWith(REPO);
    expect(world.saveData.mock.calls.length).toBe(saves);
    name.dispose();
    unwireDataPorts(pinia);
  });

  it('Review Focus 1: an own review write in flight when the change lands is shown, the change is not lost, and the repository still writes', async () => {
    const world = loaded();
    const { pinia } = await leaf(world);
    const review = useReviewStore(pinia);
    await review.bindRepository(REPO);
    await review.addWorkItemForFile(FILE_A, 'Split the parser', NOW);
    // Another program empties the set; the plugin is told only once the own write below is pending.
    world.edit((d) => {
      const reviews = d.reviews as Record<string, Record<string, unknown>>;
      reviews[REPO] = { ...reviews[REPO], workItems: [] };
    });
    world.hold();
    const adding = review.addWorkItemForFile(makeEntityId(REPO, 'file', 'src/b.ts'), 'Name the cache', NOW);
    await vi.waitFor(() => { expect(world.isHeld()).toBe(true); });
    expect(review.bucketState.buckets.get(REPO)?.ownWrites).toBe(1);
    world.p.onExternalSettingsChange();   // heard while ownWrites > 0, so it takes the own write's slot
    await flushPromises();
    world.release();
    await adding;
    await flushPromises();
    // The own write is shown, and the outside removal too: the own write's notification found no
    // slot left and reloaded, instead of upserting into the stale list.
    expect(review.workItems.map((w) => w.title)).toEqual(['Name the cache']);
    // Not retired: the next own write is accepted, saved and shown beside it.
    await review.addWorkItemForFile(makeEntityId(REPO, 'file', 'src/c.ts'), 'Drop the shim', NOW);
    await flushPromises();
    expect(review.workItems.map((w) => w.title)).toEqual(['Name the cache', 'Drop the shim']);
    expect(review.storageDiagnostics.retired).toBeFalsy();
    expect(world.saveData).toHaveBeenCalledTimes(3);   // the three own writes, nothing from the re-read
    const stored = (world.read().reviews as Record<string, { workItems: unknown[] }>)[REPO];
    expect(stored?.workItems).toHaveLength(2);
    unwireDataPorts(pinia);
  });
});
