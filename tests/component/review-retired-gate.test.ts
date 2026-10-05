// Gap closure GRB13 c: once the registry retires a codebase's review repository (its profile was
// removed while this leaf still showed it), Settings > Clear and Import are blocked
// (aria-disabled plus a guarded handler), described by the storage note that says it was removed.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import SettingsScreen from '../../src/ui/screens/SettingsScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createPluginDataReviewRepository } from '../../src/adapters/storage/plugin-data-review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { REVIEW_STORE_RETIRED_NOTE } from '../../src/ui/inspector-copy';

const mountS = () => mount(SettingsScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
type Wrapper = ReturnType<typeof mountS>;
const openPrivacy = (w: Pick<Wrapper, 'find'>) => w.find('[role="tab"][data-tab-id="privacy"]').trigger('click');

async function boundRepo(): Promise<ReturnType<typeof createPluginDataReviewRepository>> {
  const plugin = new Plugin({}, {}) as unknown as ObsidianPlugin;
  const repo = createPluginDataReviewRepository(plugin, 'p1');
  const review = useReviewStore();
  review.setRepositoryFactory(() => repo);
  await review.bindRepository('p1');
  const snap = buildSnapshotFixture({ files: 1, repositoryId: 'p1' });
  useCityStore().setCity(snap, computeLayout(snap));
  return repo;
}

describe('GRB13 c: a retired review set blocks Clear and Import', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('before the repository is retired, Clear and Import are open', async () => {
    await boundRepo();
    const w = mountS();
    await openPrivacy(w);
    for (const selector of ['.ci-settings__clear', '.ci-settings__import']) {
      expect(w.find(selector).attributes('aria-disabled')).toBeUndefined();
    }
    expect(useReviewStore().retired).toBe(false);
    w.unmount();
  });

  it('after retire(), both are aria-disabled, described by the retired storage note, and do nothing', async () => {
    const repo = await boundRepo();
    repo.retire();
    await flushPromises();
    expect(useReviewStore().retired).toBe(true);
    const w = mountS();
    await openPrivacy(w);
    const pick = vi.spyOn(w.find<HTMLInputElement>('.ci-settings__import-file').element, 'click');
    for (const selector of ['.ci-settings__clear', '.ci-settings__import']) {
      const button = w.find(selector);
      expect(button.attributes('aria-disabled')).toBe('true');
      expect(w.find(`#${button.attributes('aria-describedby')!}`).text()).toBe(REVIEW_STORE_RETIRED_NOTE);
      await button.trigger('click');
    }
    expect(w.find('.ci-clear-dialog').exists()).toBe(false);
    expect(pick).not.toHaveBeenCalled();
    w.unmount();
  });
});
