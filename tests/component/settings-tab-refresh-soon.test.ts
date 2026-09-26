// WP-04.2 NE9: the settings tab re-reads on a write it did not make through refreshSoon(), which coalesces: one
// refresh now, and at most one more queued while it runs. A new file: settings-tab.test.ts is at its cap. The tab
// is built the way settings-tab-purge.test.ts builds it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import type { App, Plugin as ObsidianPlugin } from 'obsidian';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import type { ProfileStore } from '../../src/application/ports/profile-store';
import type { CodebaseProfile } from '../../src/domain/model';

function newTab(profileStore: ProfileStore): CodebaseInspectorSettingTab {
  return new CodebaseInspectorSettingTab(
    {} as unknown as App, {} as unknown as ObsidianPlugin, profileStore, createFakeBindingStoreHarness().store,
    () => createFakeSourceFileSystem({}).port, { purge: () => Promise.resolve() }, createFakeFallowAnalysis(), { remove: vi.fn() },
    createFakeInvestigationFolders());
}

afterEach(() => {
  document.querySelectorAll('.notice-container').forEach((n) => { n.remove(); });
});

describe('settings tab: refreshSoon (WP-04.2 NE9)', () => {
  it('three calls while a refresh is loading make exactly one more refresh, after the first', async () => {
    const { store } = createFakeProfileStoreHarness();
    const pending: ((profiles: CodebaseProfile[]) => void)[] = [];
    const list = vi.spyOn(store, 'list').mockImplementation(() => new Promise((resolve) => { pending.push(resolve); }));
    const tab = newTab(store);
    const update = vi.spyOn(tab, 'update');
    tab.refreshSoon();
    tab.refreshSoon();
    tab.refreshSoon();
    expect(list).toHaveBeenCalledTimes(1);
    pending[0]!([]);
    await vi.waitFor(() => { expect(list).toHaveBeenCalledTimes(2); });
    expect(update).toHaveBeenCalledTimes(1);
    pending[1]!([]);
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('a call after a refresh settles starts a new one', async () => {
    const { store } = createFakeProfileStoreHarness();
    const list = vi.spyOn(store, 'list');
    const tab = newTab(store);
    tab.refreshSoon();
    await flushPromises();
    tab.refreshSoon();
    await flushPromises();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('Task 2 fix round 1: a refresh that throws is shown, never an unhandled rejection, and a queued refresh still runs', async () => {
    const { store } = createFakeProfileStoreHarness();
    const list = vi.spyOn(store, 'list');
    const tab = newTab(store);
    const update = vi.spyOn(tab, 'update').mockImplementationOnce(() => { throw new Error('The settings could not be drawn.'); });
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      tab.refreshSoon();
      tab.refreshSoon();
      await vi.waitFor(() => { expect(update).toHaveBeenCalledTimes(2); });
      await flushPromises();
      expect(list).toHaveBeenCalledTimes(2);
      expect(document.querySelector('.notice')?.textContent).toBe('The settings could not be drawn.');
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });
});
