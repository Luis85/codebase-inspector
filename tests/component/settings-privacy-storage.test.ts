// Part 6 Y7/R3: Settings › Privacy & storage says the review state is saved per codebase,
// says when saved records could not be read, when the saved state is read-only, and when it
// could not be read at all (through App's bind, which must never leave an unhandled
// rejection); Clear is aria-disabled, with a hint, while no codebase is on screen.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import App from '../../src/ui/App.vue';
import SettingsScreen from '../../src/ui/screens/SettingsScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { createPluginDataReviewRepository } from '../../src/adapters/storage/plugin-data-review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import {
  REVIEW_RECORDS_SKIPPED, REVIEW_STORE_READ_FAILED, REVIEW_STORE_RETIRED_NOTE, REVIEW_STORE_UNSUPPORTED_NOTE, SETTINGS_CLEAR_HINT,
  SETTINGS_STORAGE_TEXT,
} from '../../src/ui/inspector-copy';

// oxlint consistent-function-scoping: closures that capture nothing are hoisted.
const noop = (): void => {};
const hang = <T>(): Promise<T> => new Promise<T>(() => {});
const mountS = () => mount(SettingsScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
type Wrapper = ReturnType<typeof mountS>;
const openPrivacy = (w: Pick<Wrapper, 'find'>) => w.find('[role="tab"][data-tab-id="privacy"]').trigger('click');
const noteOf = (w: Pick<Wrapper, 'find'>) => w.find('.ci-settings__storage-note');

/** Binds the review store to 'p1', backed by the durable adapter over this data.json. */
async function boundTo(doc: unknown): Promise<void> {
  const plugin = new Plugin({}, {}) as unknown as ObsidianPlugin;
  await plugin.saveData(doc);
  const review = useReviewStore();
  review.setRepositoryFactory((id) => createPluginDataReviewRepository(plugin, id));
  await review.bindRepository('p1');
}

function onScreen(): void {
  const snap = buildSnapshotFixture({ files: 1, repositoryId: 'p1' });
  useCityStore().setCity(snap, computeLayout(snap));
}

describe('Settings › Privacy & storage: the saved review state (Part 6 Y7, R3)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('says the review state is saved per codebase, with no extra line while every record was read', async () => {
    await boundTo({ reviews: { p1: { v: 1, workItems: [], rules: [], dispositions: [] } } });
    const w = mountS();
    await openPrivacy(w);
    expect(w.text()).toContain(SETTINGS_STORAGE_TEXT);
    expect(SETTINGS_STORAGE_TEXT).not.toContain('lost when the leaf closes');
    expect(noteOf(w).exists()).toBe(false);
    w.unmount();
  });

  it('counts the saved records that could not be read, and follows the store', async () => {
    await boundTo({ reviews: { p1: { v: 1, workItems: [{ id: 'wi-1', owner: 'x' }, 'garbage'], rules: [], dispositions: [] } } });
    const w = mountS();
    await openPrivacy(w);
    expect(noteOf(w).text()).toBe(REVIEW_RECORDS_SKIPPED(2));
    useReviewStore().$patch({ storageDiagnostics: { skipped: 0, unsupported: false } });
    await nextTick();
    expect(noteOf(w).exists()).toBe(false);
    w.unmount();
  });

  it('Polish G4 (E30): a read failure beside skipped records shows the read-failure note, not the skipped count', async () => {
    await boundTo({ reviews: { p1: { v: 1, workItems: [], rules: [], dispositions: [] } } });
    const w = mountS();
    await openPrivacy(w);
    // PrivacyRows.vue's own precedence order: loadFailed, then retired, then
    // unsupported, then skipped -- both conditions true at once must still read as
    // the read failure, the more serious of the two.
    useReviewStore().$patch({ loadFailed: true, storageDiagnostics: { skipped: 3, unsupported: false } });
    await nextTick();
    expect(noteOf(w).text()).toBe(REVIEW_STORE_READ_FAILED);
    w.unmount();
  });

  it('says the saved state is read-only while its format is unsupported', async () => {
    await boundTo({ reviews: { p1: { v: 2, workItems: [] } } });
    const w = mountS();
    await openPrivacy(w);
    expect(noteOf(w).text()).toBe(REVIEW_STORE_UNSUPPORTED_NOTE);
    w.unmount();
  });

  it('Polish 5b fix round: says a removed codebase was removed, never that its format is unsupported', async () => {
    const plugin = new Plugin({}, {}) as unknown as ObsidianPlugin;
    const repo = createPluginDataReviewRepository(plugin, 'p1');
    const review = useReviewStore();
    review.setRepositoryFactory(() => repo);
    await review.bindRepository('p1');
    repo.retire();   // the registry's purge, while this tab still shows p1
    await flushPromises();
    const w = mountS();
    await openPrivacy(w);
    expect(noteOf(w).text()).toBe(REVIEW_STORE_RETIRED_NOTE);
    w.unmount();
  });

  it('says the saved state could not be read when App\'s bind fails, and leaves no unhandled rejection', async () => {
    const failing = { ...createInMemoryReviewRepository(), listWorkItems: () => Promise.reject(new Error('data.json unreadable')) };
    useReviewStore().setRepositoryFactory(() => failing);
    onScreen();
    useCityStore().navigate('settings');
    const w = mount(App, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), createCityRenderer: null } } });
    await flushPromises();
    expect(useReviewStore().loadFailed).toBe(true);
    await openPrivacy(w);
    expect(noteOf(w).text()).toBe(REVIEW_STORE_READ_FAILED);
    w.unmount();
  });

  it('blocks Clear, with a hint, while no codebase is on screen', async () => {
    const w = mountS();
    await openPrivacy(w);
    const clear = w.find('.ci-settings__clear');
    expect(clear.attributes('aria-disabled')).toBe('true');
    expect(w.find(`#${clear.attributes('aria-describedby')!}`).text()).toBe(SETTINGS_CLEAR_HINT);
    await clear.trigger('click');
    expect(w.find('.ci-clear-dialog').exists()).toBe(false);
    onScreen();
    await nextTick();
    expect(w.find('.ci-settings__clear').attributes('aria-disabled')).toBeUndefined();
    expect(w.find('.ci-settings__clear-hint').exists()).toBe(false);
    await w.find('.ci-settings__clear').trigger('click');
    expect(w.find('.ci-clear-dialog').exists()).toBe(true);
    w.unmount();
  });

  // E29 (fix round 1): with the saved state unread, the lists are empty only because nothing
  // was read; a Clear or an Import would replace a saved set the user never saw.
  it('blocks Clear and Import, described by the storage line, while the saved state could not be read', async () => {
    useReviewStore().setRepositoryFactory(() => ({ ...createInMemoryReviewRepository(), listWorkItems: () => Promise.reject(new Error('data.json unreadable')) }));
    await useReviewStore().bindRepository('p1').catch(noop);
    onScreen();
    const w = mountS();
    await openPrivacy(w);
    const pick = vi.spyOn(w.find<HTMLInputElement>('.ci-settings__import-file').element, 'click');
    for (const selector of ['.ci-settings__clear', '.ci-settings__import']) {
      const button = w.find(selector);
      expect(button.attributes('aria-disabled')).toBe('true');
      expect(w.find(`#${button.attributes('aria-describedby')!}`).text()).toBe(REVIEW_STORE_READ_FAILED);
      await button.trigger('click');
    }
    expect(w.find('.ci-clear-dialog').exists()).toBe(false);
    expect(pick).not.toHaveBeenCalled();
    w.unmount();
  });

  it('blocks Clear and Import until the saved state has been read', async () => {
    useReviewStore().setRepositoryFactory(() => ({ ...createInMemoryReviewRepository(), listWorkItems: hang }));
    void useReviewStore().bindRepository('p1');
    onScreen();
    const w = mountS();
    await openPrivacy(w);
    const pick = vi.spyOn(w.find<HTMLInputElement>('.ci-settings__import-file').element, 'click');
    for (const selector of ['.ci-settings__clear', '.ci-settings__import']) {
      expect(w.find(selector).attributes('aria-disabled')).toBe('true');
      await w.find(selector).trigger('click');
    }
    expect(w.find('.ci-clear-dialog').exists()).toBe(false);
    expect(pick).not.toHaveBeenCalled();
    w.unmount();
  });
});
