// WP-04 Task 14 review, fix round 1 (IN31, IN34; E22, E23, E24, E13, E40): the refresh
// dialog's edge cases — a codebase switch under an orphan's dialog, the CURRENT index entry
// rather than the link captured at open (a re-linked or hand-edited note), an outcome that
// lands after the dialog closed, and the busy dialog ignoring Cancel and Escape. Shared
// setup: investigate-refresh-support.ts (the real notes port over the fake vault).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { EVIDENCE_END } from '../../src/application/investigation/note-model';
import {
  NOTE_CREATED, NOTE_OPEN_FAILED, NOTE_VOCABULARY, REFRESH_DONE, REFRESH_FAILED, REFRESH_MARKERS_EDITED, REFRESH_SNAPSHOT,
} from '../../src/ui/inspector-copy';
import { syntheticEvidenceReport } from '../fixtures/evidence-report';
import { blockOf, click, dropFinding, liveText, rescan, setup, switchCodebase, userEdit } from './investigate-refresh-support';

const dialog = '.ci-refresh-note';

describe('an orphan\'s dialog and the bound codebase (review 1, E22)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('a codebase switch before the write closes the orphan\'s dialog', async () => {
    const ctx = await setup();
    await dropFinding(ctx);
    await click(ctx.w, '.ci-orphan-notes__refresh');
    expect(ctx.w.find(dialog).exists()).toBe(true);
    await switchCodebase(ctx.row.anchorPath);   // the other codebase does not report it either
    expect(ctx.w.find(dialog).exists()).toBe(false);
    expect(ctx.fake.calls.process).toBe(0);
    ctx.w.unmount();
  });

  it('a codebase switch during the write closes the dialog and announces nothing; the note is still refreshed', async () => {
    const ctx = await setup();
    const { w, fake, path, gate } = ctx;
    await dropFinding(ctx);
    await click(w, '.ci-orphan-notes__refresh');
    const said = liveText(w);   // the gone notice (IN4)
    gate.hold();
    await w.find('.ci-refresh-note__confirm').trigger('click');
    await switchCodebase(ctx.row.anchorPath);
    expect(w.find(dialog).exists()).toBe(false);
    gate.release();
    await flushPromises();
    expect(blockOf(fake.text(path)!)).toContain(NOTE_VOCABULARY.labels.notReported);
    expect(liveText(w)).toBe(said);   // nothing new announced
    w.unmount();
  });

  it('an orphan\'s dialog closes when its finding is reported again', async () => {
    const ctx = await setup();
    await dropFinding(ctx);
    await click(ctx.w, '.ci-orphan-notes__refresh');
    expect(ctx.w.find(dialog).exists()).toBe(true);
    useEvidenceStore().attach(syntheticEvidenceReport(ctx.snap));
    await flushPromises();
    expect(ctx.w.find(dialog).exists()).toBe(false);
    ctx.w.unmount();
  });
});

describe('the current index entry, never the link captured at open (review 2, E23)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('a snapshot_id edited while the dialog is open is the change\'s "from" side', async () => {
    const ctx = await setup();
    await rescan(ctx);
    await click(ctx.w, '.ci-notes-panel__refresh');
    expect(ctx.w.find('.ci-refresh-note__snapshot').text()).toBe(REFRESH_SNAPSHOT('snapshot-fixture', 'snapshot-next'));
    await userEdit(ctx, (text) => text.replace('snapshot_id: snapshot-fixture\n', 'snapshot_id: snapshot-hand\n'));
    expect(ctx.w.find('.ci-refresh-note__snapshot').text()).toBe(REFRESH_SNAPSHOT('snapshot-hand', 'snapshot-next'));
    ctx.w.unmount();
  });

  it('a note re-linked to another finding while the dialog is open is refused as not-linked without a write', async () => {
    const ctx = await setup();
    const { w, fake, path, row } = ctx;
    const other = useReadModels().investigation.value.rows.find((r) => r.fingerprint !== row.fingerprint && r.portable !== null)!;
    await click(w, '.ci-notes-panel__refresh');
    await userEdit(ctx, (text) => text.replace(/^finding_fingerprint: .*$/m, `finding_fingerprint: ${JSON.stringify(other.portable)}`));
    expect(useReadModels().investigation.value.byFingerprint.get(other.fingerprint)!.notes.map((n) => n.path)).toEqual([path]);
    const before = fake.text(path)!;
    await click(w, '.ci-refresh-note__confirm');
    expect(w.find('.ci-refresh-note__error[role="alert"]').text()).toBe(REFRESH_FAILED['not-linked']);
    expect(w.find(dialog).exists()).toBe(true);
    expect(fake.calls.process).toBe(0);
    expect(fake.text(path)).toBe(before);
    expect(liveText(w)).toBe(NOTE_CREATED(path));
    w.unmount();
  });
});

describe('an outcome after the dialog closed (review 4, E24)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('a refusal that lands after a selection change closed the dialog is announced in the live region', async () => {
    const ctx = await setup();
    const { w, fake, path, row, gate } = ctx;
    await click(w, '.ci-notes-panel__refresh');
    gate.hold();
    await w.find('.ci-refresh-note__confirm').trigger('click');
    await userEdit(ctx, (text) => text.replace(`${EVIDENCE_END}\n`, ''));
    const before = fake.text(path)!;
    const other = useReadModels().investigation.value.rows.find((r) => r.fingerprint !== row.fingerprint)!;
    useInvestigationStore().open(other.fingerprint);
    await flushPromises();
    expect(w.find(dialog).exists()).toBe(false);
    gate.release();
    await flushPromises();
    expect(liveText(w)).toBe(REFRESH_MARKERS_EDITED);
    expect(fake.text(path)).toBe(before);
    w.unmount();
  });

  it('a success that lands after the dialog closed is announced too', async () => {
    const ctx = await setup();
    const { w, path, row, gate } = ctx;
    await rescan(ctx);
    await click(w, '.ci-notes-panel__refresh');
    gate.hold();
    await w.find('.ci-refresh-note__confirm').trigger('click');
    useInvestigationStore().open(useReadModels().investigation.value.rows.find((r) => r.fingerprint !== row.fingerprint)!.fingerprint);
    await flushPromises();
    expect(w.find(dialog).exists()).toBe(false);
    gate.release();
    await flushPromises();
    expect(liveText(w)).toBe(REFRESH_DONE(path));
    w.unmount();
  });
});

describe('the busy dialog and the orphans panel (review 6; E13, E40)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('Cancel and Escape are ignored while a refresh is running', async () => {
    const ctx = await setup();
    const { w, path, gate } = ctx;
    await click(w, '.ci-notes-panel__refresh');
    gate.hold();
    await w.find('.ci-refresh-note__confirm').trigger('click');
    await w.find('.ci-refresh-note__cancel').trigger('click');
    await w.find('.ci-dialog').trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(w.find(dialog).exists()).toBe(true);
    expect(w.find('.ci-refresh-note__cancel').attributes('aria-disabled')).toBe('true');
    gate.release();
    await flushPromises();
    expect(w.find(dialog).exists()).toBe(false);
    expect(liveText(w)).toBe(REFRESH_DONE(path));
    w.unmount();
  });

  it('an orphan\'s Open that finds no file shows NOTE_OPEN_FAILED under that note', async () => {
    const ctx = await setup();
    const { w, fake } = ctx;
    await dropFinding(ctx);
    vi.spyOn(fake.app.vault, 'getFileByPath').mockReturnValueOnce(null);
    await click(w, '.ci-orphan-notes__open');
    expect(w.find('.ci-orphan-notes__open-error[role="alert"]').text()).toBe(NOTE_OPEN_FAILED);
    expect(fake.opened).toEqual([]);
    w.unmount();
  });
});
