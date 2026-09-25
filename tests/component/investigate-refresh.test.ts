// WP-04 IN31-IN36, O6 (IP8, IP25; E15, E17, E22, E40): refreshing a note's evidence block
// from the Investigate screen, and the notes for findings not in this report. Notes are
// created through the REAL host notes port (the create dialog) over the in-memory fake
// vault, then edited as a person would with `userWrite`. Nothing here mocks the port.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import InvestigateScreen from '../../src/ui/screens/InvestigateScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { EVIDENCE_END } from '../../src/application/investigation/note-model';
import { noteBaseName } from '../../src/application/investigation/note-path';
import { createInvestigationNotes } from '../../src/host/investigation-notes';
import type { InvestigationNotesPort } from '../../src/application/ports/investigation-notes-port';
import {
  FINDING_KIND_LABEL, FINDING_STATUS_LABEL, INVESTIGATE_COUNTS, NOTE_CREATED, NOTE_STATUS, NOTE_VOCABULARY, NOTES_MALFORMED, REFRESH_DONE, REFRESH_FAILED,
  REFRESH_LINE, REFRESH_MARKERS_EDITED, REFRESH_PARTIAL, REFRESH_SNAPSHOT, REFRESH_SOURCE_PATH, REFRESH_STATE,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, snapshotWithOnlyFiles, syntheticEvidenceReport } from '../fixtures/evidence-report';
import { createFakeVault } from '../fixtures/fake-vault';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { scriptedSourcePreview } from '../fixtures/fake-investigation';
import { createFixedClock } from '../fixtures/clock';

/** A transparent wrapper over the REAL port: `hold()` parks every refresh until `release()`. */
function gated(port: InvestigationNotesPort) {
  const waiting: (() => void)[] = [];
  const gate = {
    holding: false,
    hold: () => { gate.holding = true; },
    release: () => { gate.holding = false; for (const go of waiting.splice(0)) go(); },
  };
  const wrapped: InvestigationNotesPort = {
    ...port,
    refresh: async (request) => {
      if (gate.holding) await new Promise<void>((resolve) => { waiting.push(resolve); });
      return port.refresh(request);
    },
  };
  return { gate, wrapped };
}

/** One note, created through the create dialog for the first unused-export finding (a
 *  finding a later report can drop by leaving its file out). */
async function setup() {
  const fake = createFakeVault({ basePath: '/vault' });
  const base = buildSnapshotFixture({ files: 12, directories: 2 });
  const snap: CodebaseSnapshot = { ...base, scope: { ...base.scope, rootPath: '/elsewhere/code' } };
  const harness = createFakeProfileStoreHarness();
  await harness.writeRaw({ profiles: [{ profileId: snap.repositoryId, name: 'Alpha', bindingId: null, exclusions: ['.git'], maxFileBytes: 1_000_000 }] });
  const notes = createInvestigationNotes(fake.app, {
    folders: createFakeInvestigationFolders({ [snap.repositoryId]: 'Notes' }), profiles: harness.store,
    clock: createFixedClock('2026-09-25T10:00:00.000Z'), registerEvent: () => undefined,
  });
  const { gate, wrapped } = gated(notes);
  useCityStore().setCity(snap, computeLayout(snap));
  attachSyntheticReport(snap);
  useInvestigationStore().setPorts(wrapped, scriptedSourcePreview());
  useReviewStore().setRepositoryFactory(() => createInMemoryReviewRepository());
  await useReviewStore().bindRepository(snap.repositoryId);
  useCityStore().navigate('investigate');
  const row = useReadModels().investigation.value.rows.find((r) => r.kind === 'unused-exports')!;
  useInvestigationStore().open(row.fingerprint);
  const w = mount(InvestigateScreen, { attachTo: document.body });
  await flushPromises();
  await w.find('.ci-notes-panel__create').trigger('click');
  await flushPromises();
  await w.find('.ci-create-note__confirm').trigger('click');
  await flushPromises();
  const path = `Notes/${noteBaseName(row.id, FINDING_KIND_LABEL[row.kind], row.file.name)}.md`;
  expect(fake.paths()).toEqual([path]);
  return { fake, snap, row, w, path, gate };
}

type Ctx = Awaited<ReturnType<typeof setup>>;
type Mounted = Ctx['w'];

async function click(w: Mounted, selector: string): Promise<void> {
  await w.find(selector).trigger('click');
  await flushPromises();
}
const liveText = (w: Mounted): string => w.find('.ci-investigate__live').text();
/** Everything after the end-marker line: the user's own sections. */
const afterBlock = (text: string): string => text.slice(text.indexOf(`${EVIDENCE_END}\n`) + EVIDENCE_END.length + 1);
const blockOf = (text: string): string => text.slice(0, text.indexOf(EVIDENCE_END));

function frontmatterOf(ctx: Ctx): Record<string, unknown> {
  const file = ctx.fake.app.vault.getFileByPath(ctx.path);
  if (file === null) throw new Error(`no file at ${ctx.path}`);
  return ctx.fake.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown>;
}

/** Re-attaches the same findings to a new scan of the same codebase. */
async function rescan(ctx: Ctx, snapshotId = 'snapshot-next'): Promise<void> {
  const next = { ...ctx.snap, snapshotId };
  useCityStore().setCity(next, computeLayout(next));
  useEvidenceStore().attach(syntheticEvidenceReport(next));
  await flushPromises();
}

/** A report for the same snapshot that no longer lists the note's finding (IN34). */
async function dropFinding(ctx: Ctx): Promise<void> {
  const kept = ctx.snap.entities.filter((e) => e.kind === 'file' && e.path !== ctx.row.anchorPath).map((e) => e.path);
  useEvidenceStore().attach(syntheticEvidenceReport(snapshotWithOnlyFiles(ctx.snap, kept), { snapshotId: ctx.snap.snapshotId }));
  await flushPromises();
}

async function userEdit(ctx: Ctx, edit: (text: string) => string): Promise<void> {
  ctx.fake.userWrite(ctx.path, edit(ctx.fake.text(ctx.path)!));
  await flushPromises();
}

describe('refreshing a linked note (IN31, IN32; IP8, IP25, E40)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('IN31: the dialog names the snapshot change, the state and the line; confirm refreshes the block only', async () => {
    const ctx = await setup();
    const { w, fake, path, row, gate } = ctx;
    const before = fake.text(path)!;
    await rescan(ctx);
    await click(w, '.ci-notes-panel__refresh');
    expect(w.find('.ci-refresh-note__snapshot').text()).toBe(REFRESH_SNAPSHOT('snapshot-fixture', 'snapshot-next'));
    expect(w.find('.ci-refresh-note__source').exists()).toBe(false);
    expect(w.find('.ci-refresh-note__state').text()).toBe(REFRESH_STATE.current);
    expect(w.find('.ci-refresh-note__line').text()).toBe(REFRESH_LINE(row.line));
    expect(fake.calls.process).toBe(0);
    gate.hold();
    const confirm = w.find('.ci-refresh-note__confirm');
    await confirm.trigger('click');
    expect(confirm.attributes('aria-disabled')).toBe('true');   // E40
    await confirm.trigger('click');
    gate.release();
    await flushPromises();
    expect(fake.calls.process).toBe(1);
    expect(w.find('.ci-refresh-note').exists()).toBe(false);
    expect(liveText(w)).toBe(REFRESH_DONE(path));
    const after = fake.text(path)!;
    expect(afterBlock(after)).toBe(afterBlock(before));
    expect(afterBlock(after).length).toBeGreaterThan(0);
    expect(blockOf(after)).toContain('snapshot-next');
    expect(blockOf(after)).not.toContain('snapshot-fixture');
    expect(frontmatterOf(ctx).snapshot_id).toBe('snapshot-next');
    w.unmount();
  });

  it('vanished marker: with the end marker deleted, confirm shows REFRESH_MARKERS_EDITED, announces nothing and changes nothing', async () => {
    const ctx = await setup();
    const { w, fake, path } = ctx;
    await userEdit(ctx, (text) => text.replace(`${EVIDENCE_END}\n`, ''));
    const before = fake.text(path)!;
    await click(w, '.ci-notes-panel__refresh');
    await click(w, '.ci-refresh-note__confirm');
    expect(w.find('.ci-refresh-note__error[role="alert"]').text()).toBe(REFRESH_MARKERS_EDITED);
    expect(w.find('.ci-refresh-note').exists()).toBe(true);
    expect(liveText(w)).toBe(NOTE_CREATED(path));   // still the create's: nothing new announced
    expect(fake.text(path)).toBe(before);
    expect(fake.calls.processFrontMatter).toBe(0);
    w.unmount();
  });

  it('IN32 (IP8): the user\'s status, an added key and created survive a refresh, value-equal', async () => {
    const ctx = await setup();
    const { w } = ctx;
    await userEdit(ctx, (text) => text.replace('status: open\n', 'status: done\nreviewer: me\n'));
    const created = frontmatterOf(ctx).created;
    await rescan(ctx);
    await click(w, '.ci-notes-panel__refresh');
    await click(w, '.ci-refresh-note__confirm');
    const fm = frontmatterOf(ctx);
    expect(fm).toMatchObject({ status: 'done', reviewer: 'me', snapshot_id: 'snapshot-next' });
    expect(fm.created).toBe(created);
    expect(w.find('.ci-notes-panel__status').text()).toBe(NOTE_STATUS('done'));
    w.unmount();
  });

  it('IP25: a hand-edited source_path is named as a change and restored to the finding\'s path; an unchanged snapshot is not listed', async () => {
    const ctx = await setup();
    const { w, row } = ctx;
    await userEdit(ctx, (text) => text.replace(`source_path: ${row.anchorPath}\n`, 'source_path: src/moved.ts\n'));
    await click(w, '.ci-notes-panel__refresh');
    expect(w.find('.ci-refresh-note__source').text()).toBe(REFRESH_SOURCE_PATH('src/moved.ts', row.anchorPath));
    expect(w.find('.ci-refresh-note__snapshot').exists()).toBe(false);
    await click(w, '.ci-refresh-note__confirm');
    expect(frontmatterOf(ctx)).toMatchObject({ source_path: row.anchorPath, snapshot_id: 'snapshot-fixture' });
    w.unmount();
  });

  it('E15: a frontmatter update that fails after the block was replaced announces REFRESH_PARTIAL, never "nothing changed"', async () => {
    const ctx = await setup();
    const { w, fake, path } = ctx;
    await rescan(ctx);
    vi.spyOn(fake.app.fileManager, 'processFrontMatter').mockRejectedValueOnce(new Error('locked'));
    await click(w, '.ci-notes-panel__refresh');
    await click(w, '.ci-refresh-note__confirm');
    expect(w.find('.ci-refresh-note').exists()).toBe(false);
    expect(liveText(w)).toBe(REFRESH_PARTIAL(path));
    expect(blockOf(fake.text(path)!)).toContain('snapshot-next');
    expect(frontmatterOf(ctx).snapshot_id).toBe('snapshot-fixture');
    w.unmount();
  });

  it('a note deleted while the dialog is open: confirm shows REFRESH_FAILED.missing and announces nothing', async () => {
    const ctx = await setup();
    const { w, fake, path } = ctx;
    await click(w, '.ci-notes-panel__refresh');
    fake.userDelete(path);
    await flushPromises();
    await click(w, '.ci-refresh-note__confirm');
    expect(w.find('.ci-refresh-note__error[role="alert"]').text()).toBe(REFRESH_FAILED.missing);
    expect(liveText(w)).toBe(NOTE_CREATED(path));   // still the create's: nothing new announced
    expect(fake.paths()).toEqual([]);
    w.unmount();
  });

  it('E22: a codebase switch mid-refresh announces nothing in the other codebase; the note is still refreshed', async () => {
    const ctx = await setup();
    const { w, fake, path, gate } = ctx;
    await rescan(ctx);
    await click(w, '.ci-notes-panel__refresh');
    gate.hold();
    await w.find('.ci-refresh-note__confirm').trigger('click');
    const other = buildSnapshotFixture({ files: 12, directories: 2, repositoryId: 'repo-other' });
    useCityStore().setCity(other, computeLayout(other));
    attachSyntheticReport(other);
    await flushPromises();
    expect(w.find('.ci-refresh-note').exists()).toBe(false);
    gate.release();
    await flushPromises();
    expect(blockOf(fake.text(path)!)).toContain('snapshot-next');
    expect(liveText(w)).toBe(NOTE_CREATED(path));   // still the create's: nothing new announced
    w.unmount();
  });
});

describe('notes for findings not in this report (IN34, IN36)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('IN34: the note moves to the orphans panel with its status; refreshing it records "not reported" and keeps the status', async () => {
    const ctx = await setup();
    const { w, fake, path, row } = ctx;
    await userEdit(ctx, (text) => text.replace('status: open\n', 'status: doing\n'));
    expect(w.find('.ci-orphan-notes__path').exists()).toBe(false);
    await dropFinding(ctx);
    const model = useReadModels().investigation.value;
    expect(model.byFingerprint.has(row.fingerprint)).toBe(false);
    expect(w.findAll('.ci-orphan-notes__path').map((p) => p.text())).toEqual([path]);
    expect(w.find('.ci-orphan-notes__status').text()).toBe(NOTE_STATUS('doing'));
    expect(w.find('.ci-panel__subtitle').text()).toBe(INVESTIGATE_COUNTS(model.rows.length, 0, 1, 0));   // IN36: counted apart
    await click(w, '.ci-orphan-notes__refresh');
    expect(w.find('.ci-refresh-note__state').text()).toBe(REFRESH_STATE['not-reported']);
    expect(w.find('.ci-refresh-note__line').exists()).toBe(false);
    expect(w.find('.ci-refresh-note__source').exists()).toBe(false);
    await click(w, '.ci-refresh-note__confirm');
    expect(liveText(w)).toBe(REFRESH_DONE(path));
    expect(REFRESH_STATE['not-reported']).toBe(NOTE_VOCABULARY.labels.notReported);
    expect(blockOf(fake.text(path)!)).toContain(NOTE_VOCABULARY.labels.notReported);
    expect(frontmatterOf(ctx)).toMatchObject({ status: 'doing', source_path: row.anchorPath });
    expect(w.find('.ci-orphan-notes__status').text()).toBe(NOTE_STATUS('doing'));
    w.unmount();
  });

  it('IN36: a note with finding_id: 1 is counted as malformed and linked nowhere; the Note filter lists exactly the rows with a note', async () => {
    const ctx = await setup();
    const { w, fake, path, row } = ctx;
    await click(w, '.ci-notes-panel__create');
    await click(w, '.ci-create-note__confirm');   // a second, well-formed note for the same finding
    const second = fake.paths().find((p) => p !== path)!;
    await userEdit(ctx, (text) => text.replace(`finding_id: ${row.id}\n`, 'finding_id: 1\n'));
    expect(w.find('.ci-orphan-notes__malformed').text()).toBe(NOTES_MALFORMED(1));
    expect(w.find('.ci-orphan-notes__path').exists()).toBe(false);
    expect(w.findAll('.ci-notes-panel__path').map((p) => p.text())).toEqual([second]);
    const model = useReadModels().investigation.value;
    expect(w.find('.ci-panel__subtitle').text()).toBe(INVESTIGATE_COUNTS(model.rows.length, 1, 0, 1));
    await w.find('.ci-investigate-filters__note').setValue('with-note');
    await flushPromises();
    const titles = w.findAll('.ci-investigate-row__title').map((t) => t.text());
    expect(titles).toEqual([row.title]);
    w.unmount();
  });
});

describe('the note\'s own status (O6)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('shows beside the review disposition; editing it in the note updates the chip and leaves the dispositions unchanged', async () => {
    const ctx = await setup();
    const { w, row } = ctx;
    await useReviewStore().acknowledge(row.fingerprint, new Date('2026-09-25T00:00:00Z'));
    await flushPromises();
    const dispositions = JSON.stringify(useReviewStore().dispositions);
    expect(useReviewStore().dispositions).toHaveLength(1);
    const meta = w.find('.ci-evidence-panel__meta').text();
    expect(meta).toContain(FINDING_STATUS_LABEL.acknowledged);
    expect(w.find('.ci-notes-panel__status').text()).toBe(NOTE_STATUS('open'));
    await userEdit(ctx, (text) => text.replace('status: open\n', 'status: won\'t fix\n'));
    expect(w.find('.ci-notes-panel__status').text()).toBe(NOTE_STATUS('won\'t fix'));
    expect(w.find('.ci-evidence-panel__meta').text()).toBe(meta);
    expect(JSON.stringify(useReviewStore().dispositions)).toBe(dispositions);
    w.unmount();
  });
});
