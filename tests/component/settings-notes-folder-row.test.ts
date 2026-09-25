// WP-04 Task 10 (IN18): Settings › Privacy & storage shows the bound codebase's investigation
// notes folder, read-only: the default marked as the default, a stored folder without the
// mark, and a line asking for a codebase while none is bound. The row re-reads the folder
// each time it mounts (the folder is changed in Obsidian's settings tab, which has no change
// signal), and says so when the folder setting could not be read.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SettingsScreen from '../../src/ui/screens/SettingsScreen.vue';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import type { InvestigationFolderStore } from '../../src/adapters/storage/plugin-data-investigation-store';
import {
  NOTES_FOLDER_ROW_DEFAULT, NOTES_FOLDER_ROW_FAILED, NOTES_FOLDER_ROW_NO_CODEBASE, NOTES_FOLDER_ROW_TEXT, NOTES_FOLDER_ROW_TITLE,
} from '../../src/ui/inspector-copy';
import { createFakeVault } from '../fixtures/fake-vault';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFixedClock } from '../fixtures/clock';
import { scriptedSourcePreview } from '../fixtures/fake-investigation';

// Module scope (oxlint consistent-function-scoping): captures nothing.
const ignoreEvent = (): void => {};
const mountS = () => mount(SettingsScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
type Wrapper = ReturnType<typeof mountS>;
const openPrivacy = (w: Pick<Wrapper, 'find'>) => w.find('[role="tab"][data-tab-id="privacy"]').trigger('click');
const rowOf = (w: Pick<Wrapper, 'find'>) => w.find('.ci-settings__notes-folder');
const valueOf = (w: Pick<Wrapper, 'find'>) => rowOf(w).find('.ci-settings__notes-folder-value');

async function withPorts(folders: InvestigationFolderStore): Promise<void> {
  const profiles = createFakeProfileStoreHarness();
  await profiles.writeRaw({ profiles: [{ profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 }] });
  const notes = createInvestigationNotes(createFakeVault({ basePath: '/vault' }).app, {
    folders, profiles: profiles.store, clock: createFixedClock(), registerEvent: ignoreEvent,
  });
  useInvestigationStore().setPorts(notes, scriptedSourcePreview());
}

describe('Settings › Privacy & storage: the investigation notes folder (IN18)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('shows the default folder, marked as the default, for a bound codebase', async () => {
    await withPorts(createFakeInvestigationFolders());
    useEvidenceStore().bindRepository('p1');
    const w = mountS();
    await openPrivacy(w);
    await vi.waitFor(() => { expect(valueOf(w).text()).toBe('Codebase investigations/Alpha'); });
    expect(rowOf(w).text()).toContain(NOTES_FOLDER_ROW_TITLE);
    expect(rowOf(w).text()).toContain(NOTES_FOLDER_ROW_TEXT);
    expect(rowOf(w).text()).toContain(NOTES_FOLDER_ROW_DEFAULT);
    expect(rowOf(w).text()).not.toContain(NOTES_FOLDER_ROW_NO_CODEBASE);
    // Read-only: nothing on the row can be edited or pressed.
    expect(rowOf(w).findAll('input, button, select, textarea')).toHaveLength(0);
    w.unmount();
  });

  it('shows a stored folder without the default mark', async () => {
    await withPorts(createFakeInvestigationFolders({ p1: 'Reviews/Alpha' }));
    useEvidenceStore().bindRepository('p1');
    const w = mountS();
    await openPrivacy(w);
    await vi.waitFor(() => { expect(valueOf(w).text()).toBe('Reviews/Alpha'); });
    expect(rowOf(w).text()).not.toContain(NOTES_FOLDER_ROW_DEFAULT);
    w.unmount();
  });

  it('shows the new folder after it was changed in Obsidian\'s settings, once the row mounts again', async () => {
    const folders = createFakeInvestigationFolders({ p1: 'Reviews/Alpha' });
    await withPorts(folders);
    useEvidenceStore().bindRepository('p1');
    const first = mountS();
    await openPrivacy(first);
    await vi.waitFor(() => { expect(valueOf(first).text()).toBe('Reviews/Alpha'); });
    first.unmount();
    await folders.write('p1', 'Moved/Alpha');
    const second = mountS();
    await openPrivacy(second);
    await vi.waitFor(() => { expect(valueOf(second).text()).toBe('Moved/Alpha'); });
    second.unmount();
  });

  it('says the folder setting could not be read, and shows no folder', async () => {
    await withPorts({ ...createFakeInvestigationFolders(), read: () => Promise.reject(new Error('data.json unreadable')) });
    useEvidenceStore().bindRepository('p1');
    const w = mountS();
    await openPrivacy(w);
    await vi.waitFor(() => { expect(rowOf(w).text()).toContain(NOTES_FOLDER_ROW_FAILED); });
    expect(valueOf(w).exists()).toBe(false);
    w.unmount();
  });

  it('asks for a codebase while none is bound', async () => {
    await withPorts(createFakeInvestigationFolders({ p1: 'Reviews/Alpha' }));
    const w = mountS();
    await openPrivacy(w);
    expect(rowOf(w).text()).toContain(NOTES_FOLDER_ROW_NO_CODEBASE);
    expect(valueOf(w).exists()).toBe(false);
    w.unmount();
  });
});
