// WP-04 Task 10 (IN18): Settings › Privacy & storage shows the bound codebase's investigation
// notes folder, read-only: the default marked as the default, a stored folder without the
// mark, and a line asking for a codebase while none is bound.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SettingsScreen from '../../src/ui/screens/SettingsScreen.vue';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import {
  NOTES_FOLDER_ROW_DEFAULT, NOTES_FOLDER_ROW_NO_CODEBASE, NOTES_FOLDER_ROW_TEXT, NOTES_FOLDER_ROW_TITLE,
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

async function withPorts(stored: Record<string, string>): Promise<void> {
  const profiles = createFakeProfileStoreHarness();
  await profiles.writeRaw({ profiles: [{ profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 }] });
  const notes = createInvestigationNotes(createFakeVault({ basePath: '/vault' }).app, {
    folders: createFakeInvestigationFolders(stored), profiles: profiles.store, clock: createFixedClock(), registerEvent: ignoreEvent,
  });
  useInvestigationStore().setPorts(notes, scriptedSourcePreview());
}

describe('Settings › Privacy & storage: the investigation notes folder (IN18)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('shows the default folder, marked as the default, for a bound codebase', async () => {
    await withPorts({});
    useEvidenceStore().bindRepository('p1');
    const w = mountS();
    await openPrivacy(w);
    await vi.waitFor(() => { expect(rowOf(w).find('.ci-settings__notes-folder-value').text()).toBe('Codebase investigations/Alpha'); });
    expect(rowOf(w).text()).toContain(NOTES_FOLDER_ROW_TITLE);
    expect(rowOf(w).text()).toContain(NOTES_FOLDER_ROW_TEXT);
    expect(rowOf(w).text()).toContain(NOTES_FOLDER_ROW_DEFAULT);
    expect(rowOf(w).text()).not.toContain(NOTES_FOLDER_ROW_NO_CODEBASE);
    // Read-only: nothing on the row can be edited or pressed.
    expect(rowOf(w).findAll('input, button, select, textarea')).toHaveLength(0);
    w.unmount();
  });

  it('shows a stored folder without the default mark', async () => {
    await withPorts({ p1: 'Reviews/Alpha' });
    useEvidenceStore().bindRepository('p1');
    const w = mountS();
    await openPrivacy(w);
    await vi.waitFor(() => { expect(rowOf(w).find('.ci-settings__notes-folder-value').text()).toBe('Reviews/Alpha'); });
    expect(rowOf(w).text()).not.toContain(NOTES_FOLDER_ROW_DEFAULT);
    w.unmount();
  });

  it('asks for a codebase while none is bound', async () => {
    await withPorts({ p1: 'Reviews/Alpha' });
    const w = mountS();
    await openPrivacy(w);
    expect(rowOf(w).text()).toContain(NOTES_FOLDER_ROW_NO_CODEBASE);
    expect(rowOf(w).find('.ci-settings__notes-folder-value').exists()).toBe(false);
    w.unmount();
  });
});
