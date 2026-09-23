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
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';
import type { ProfileStore } from '../../src/application/ports/profile-store';
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

function newTab(profileStore: ProfileStore, registry: Pick<ReviewRepositoryRegistry, 'purge'>): CodebaseInspectorSettingTab {
  return new CodebaseInspectorSettingTab(
    {} as unknown as App, {} as unknown as ObsidianPlugin, profileStore, createFakeBindingStoreHarness().store,
    () => createFakeSourceFileSystem({}).port, registry, createFakeFallowAnalysis());
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

  // E29 (fix round 1): a failed removal keeps both. `deleteProfile` still lets that
  // rejection propagate (its missing catch is deferred, U47), so the test awaits it directly.
  it('never purges when removing the profile fails', async () => {
    const { store } = createFakeProfileStoreHarness();
    await store.save(profile('p1'));
    vi.spyOn(store, 'remove').mockRejectedValue(new Error('Could not write data.json.'));
    const purge = vi.fn<(repositoryId: string) => Promise<void>>(() => Promise.resolve());
    const tab = newTab(store, { purge });
    const deleteProfile = (tab as unknown as { deleteProfile(id: string): Promise<void> }).deleteProfile.bind(tab);
    await expect(deleteProfile('p1')).rejects.toThrow('Could not write data.json.');
    expect(purge).not.toHaveBeenCalled();
  });
});
