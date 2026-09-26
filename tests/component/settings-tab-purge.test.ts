// Part 6 Y17: removing a codebase profile in the plugin settings removes its saved review
// state too — data.json `reviews[id]` and the registry's cached instance. A new file:
// settings-tab.test.ts is at 435 lines.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import type { App, Plugin as ObsidianPlugin, SettingDefinitionItem, SettingDefinitionList } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { PluginDataProfileStore } from '../../src/adapters/storage/plugin-data-profile-store';
import { createReviewRepositoryRegistry, type ReviewRepositoryRegistry } from '../../src/adapters/storage/review-repository-registry';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFakeFallowAnalysis, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { emptyEvidenceReport } from '../fixtures/evidence-report';
import type { ProfileStore } from '../../src/application/ports/profile-store';
import type { EvidenceRepository } from '../../src/application/ports/evidence-repository';
import type { CodebaseProfile } from '../../src/domain/model';
import { PROFILE_REVIEW_PURGE_FAILED } from '../../src/ui/inspector-copy';

const AT = '2026-09-23T10:00:00.000Z';
const profile = (profileId: string): CodebaseProfile =>
  ({ profileId, name: profileId, bindingId: null, exclusions: [], maxFileBytes: 1_000_000 });
const SET = {
  v: 1, workItems: [], rules: [{ id: 'AR-001', from: 'ui', to: 'domain', rationale: 'Layering', createdAt: AT }],
  dispositions: [], highWater: { workItem: 0, rule: 1 },
};

function findList(defs: SettingDefinitionItem[]): SettingDefinitionList {
  const found = defs.find((d): d is SettingDefinitionList => 'type' in d && d.type === 'list');
  if (!found) throw new Error('no list definition found');
  return found;
}

function newTab(
  profileStore: ProfileStore, registry: Pick<ReviewRepositoryRegistry, 'purge'>,
  options: { analysis?: FakeFallowAnalysis; evidence?: Pick<EvidenceRepository, 'remove'> } = {},
): CodebaseInspectorSettingTab {
  return new CodebaseInspectorSettingTab(
    {} as unknown as App, {} as unknown as ObsidianPlugin, profileStore, createFakeBindingStoreHarness().store,
    () => createFakeSourceFileSystem({}).port, registry, options.analysis ?? createFakeFallowAnalysis(), options.evidence ?? { remove: vi.fn() }, createFakeInvestigationFolders());
}

afterEach(() => {
  document.querySelectorAll('.notice-container').forEach((n) => { n.remove(); });
});

describe('settings tab: removing a profile purges its review state (Part 6 Y17)', () => {
  it('deletes that profile\'s saved review state and nothing else', async () => {
    const plugin = new Plugin({}, {}) as unknown as ObsidianPlugin;
    await plugin.saveData({ profiles: [profile('p1'), profile('p2')], reviews: { p1: SET, p2: SET } });
    const registry = createReviewRepositoryRegistry(plugin);
    const cached = registry.for('p1');
    const tab = newTab(new PluginDataProfileStore(plugin), registry);
    await tab.refresh();
    findList(tab.getSettingDefinitions()).onDelete!(0);
    await flushPromises();
    expect(await plugin.loadData()).toEqual({ profiles: [profile('p2')], reviews: { p2: SET } });
    expect(registry.for('p1')).not.toBe(cached);
  });

  it('purges only after the profile is removed; a failed purge is shown with its reason and the list still refreshes', async () => {
    const { store } = createFakeProfileStoreHarness();
    await store.save(profile('p1'));
    const remove = vi.spyOn(store, 'remove');
    const purge = vi.fn<(repositoryId: string) => Promise<void>>(() => Promise.reject(new Error('Could not write data.json.')));
    const tab = newTab(store, { purge });
    await tab.refresh();
    findList(tab.getSettingDefinitions()).onDelete!(0);
    await flushPromises();
    expect(purge).toHaveBeenCalledWith('p1');
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(purge.mock.invocationCallOrder[0]!);
    expect(document.querySelector('.notice')?.textContent).toBe(PROFILE_REVIEW_PURGE_FAILED('Could not write data.json.'));
    expect(findList(tab.getSettingDefinitions()).items).toEqual([]);
  });

  it('Polish D4: a failed removal is shown, keeps the profile, and purges and removes nothing', async () => {
    const { store } = createFakeProfileStoreHarness();
    await store.save(profile('p1'));
    vi.spyOn(store, 'remove').mockRejectedValue(new Error('Could not write data.json.'));
    const purge = vi.fn<(repositoryId: string) => Promise<void>>(() => Promise.resolve());
    const evidence = { remove: vi.fn() };
    const tab = newTab(store, { purge }, { evidence });
    await tab.refresh();
    findList(tab.getSettingDefinitions()).onDelete!(0);
    await flushPromises();
    expect(document.querySelector('.notice')?.textContent).toBe('Could not write data.json.');
    expect(purge).not.toHaveBeenCalled();
    expect(evidence.remove).not.toHaveBeenCalled();
    expect(findList(tab.getSettingDefinitions()).items).toHaveLength(1);
  });

  it('Polish D5: removes only the removed profile\'s session evidence, after the analyzer purge', async () => {
    const { store } = createFakeProfileStoreHarness();
    await store.save(profile('p1'));
    await store.save(profile('p2'));
    const evidence = new InMemoryEvidenceStore();
    evidence.put('p1', emptyEvidenceReport('s1'));
    evidence.put('p2', emptyEvidenceReport('s2'));
    const analysis = createFakeFallowAnalysis();
    const purge = vi.spyOn(analysis, 'purgeProfile');
    const remove = vi.spyOn(evidence, 'remove');
    const tab = newTab(store, { purge: () => Promise.resolve() }, { analysis, evidence });
    await tab.refresh();
    const index = findList(tab.getSettingDefinitions()).items!.findIndex((item) => 'name' in item && item.name === 'p1');
    findList(tab.getSettingDefinitions()).onDelete!(index);
    await flushPromises();
    expect(evidence.get('p1')).toBeNull();
    expect(evidence.get('p2')).not.toBeNull();
    expect(remove.mock.calls).toEqual([['p1']]);
    expect(purge.mock.invocationCallOrder[0]).toBeLessThan(remove.mock.invocationCallOrder[0]!);
  });
});
