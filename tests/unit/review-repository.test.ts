// Part 6: the ReviewRepository contract against both adapters (ruling M24's pattern, as
// profile-store.test.ts). The durable half runs against the plugin-data adapter only: the
// in-memory adapter has no data.json to reopen, read, hand-edit or count saves of.
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import {
  CONTRACT_REPO, runDurableReviewRepositoryContract, runReviewRepositoryContract, type ReviewRepositoryHarness,
} from '../contracts/review-repository.contract';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { createPluginDataReviewRepository } from '../../src/adapters/storage/plugin-data-review-repository';

const notDurable = (): Promise<never> => Promise.reject(new Error('The in-memory adapter has no data.json.'));
const noWrites = (): number => 0;
const noSaves = (): void => { throw new Error('The in-memory adapter has no data.json.'); };

function inMemoryHarness(): ReviewRepositoryHarness {
  const repo = createInMemoryReviewRepository();
  return { repo, reopen: () => repo, writeRaw: notDurable, readRaw: notDurable, writes: noWrites, failNextSave: noSaves };
}

function pluginDataHarness(): ReviewRepositoryHarness {
  // One cast at the boundary, as profile-store.test.ts: the mock implements loadData/saveData only.
  const plugin = new Plugin({}, {}) as unknown as ObsidianPlugin;
  const save = plugin.saveData.bind(plugin);
  let writes = 0;
  let failNext = false;
  // Counts the adapter's own saves; writeRaw uses `save` directly, so it does not count.
  plugin.saveData = (data: unknown): Promise<void> => {
    writes += 1;
    if (failNext) {
      failNext = false;
      return Promise.reject(new Error('The disk is full.'));
    }
    return save(data);
  };
  return {
    repo: createPluginDataReviewRepository(plugin, CONTRACT_REPO),
    reopen: () => createPluginDataReviewRepository(plugin, CONTRACT_REPO),
    writeRaw: (doc) => save(doc),
    readRaw: () => plugin.loadData() as Promise<unknown>,
    writes: () => writes,
    failNextSave: () => { failNext = true; },
  };
}

runReviewRepositoryContract('in-memory', () => Promise.resolve(inMemoryHarness()));
runReviewRepositoryContract('plugin data.json', () => Promise.resolve(pluginDataHarness()));
runDurableReviewRepositoryContract('plugin data.json', () => Promise.resolve(pluginDataHarness()));
