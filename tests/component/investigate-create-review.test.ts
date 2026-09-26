// WP-04 polish review: unlike refresh (E24), a create refusal that lands after its dialog
// closed (a same-codebase selection change) was silent — the dialog's own alert line never
// renders once it is gone, and nothing else said the words. Shared setup:
// investigate-create-support.ts (the real notes port over the fake vault).
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { NOTE_CREATE_REFUSED } from '../../src/ui/inspector-copy';
import { liveText, openDialog, setup } from './investigate-create-support';

describe('a create refusal after the dialog closed (polish, E24\'s carry to create)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('is announced in the live region when the selection moves off the finding first', async () => {
    const { w, fake, gate, name, row } = await setup();
    await openDialog(w);
    fake.raceNextCreate(`Notes/${name}.md`, 'theirs');
    gate.hold();
    await w.find('.ci-create-note__confirm').trigger('click');
    const other = useReadModels().investigation.value.rows.find((r) => r.fingerprint !== row.fingerprint)!;
    useInvestigationStore().open(other.fingerprint);
    await flushPromises();
    expect(w.find('.ci-create-note').exists()).toBe(false);
    gate.release();
    await flushPromises();
    expect(liveText(w)).toBe(NOTE_CREATE_REFUSED.exists);
    expect(fake.text(`Notes/${name}.md`)).toBe('theirs');
    w.unmount();
  });

  it('still leaves the dialog\'s own alert line as the only word while the dialog stays open', async () => {
    const { w, fake, gate, name } = await setup();
    await openDialog(w);
    fake.raceNextCreate(`Notes/${name}.md`, 'theirs');
    gate.hold();
    await w.find('.ci-create-note__confirm').trigger('click');
    gate.release();
    await flushPromises();
    expect(w.find('.ci-create-note__error[role="alert"]').text()).toBe(NOTE_CREATE_REFUSED.exists);
    expect(liveText(w)).toBe('');
    w.unmount();
  });
});
