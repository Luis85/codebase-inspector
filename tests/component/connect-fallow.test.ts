// Part 6 Y31/Y38 (S14): Connect fallow on Data & scans — the picker, the review step and
// its mapping offer, refusals, busy, a codebase switch, a late result, and report text
// rendered as text. Acceptance (4): a failed import keeps the attached evidence.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import SourcesScreen from '../../src/ui/screens/SourcesScreen.vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { computeLayout } from '../../src/domain/layout/layout';
import type { CodebaseSnapshot } from '../../src/domain/model';
import { formatAbsoluteTime } from '../../src/ui/copy';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import {
  FALLOW_ATTACHED, FALLOW_DIALOG_TITLE, FALLOW_DISCLOSURE, FALLOW_IMPORT_ERROR, FALLOW_MAPPING_OFFER, FALLOW_MATCHED,
  FALLOW_NOT_SHOWN_ITEM, FALLOW_REPLACE_NOTE, FALLOW_SNAPSHOT_FILES, FALLOW_UNMATCHED_SUMMARY, fallowNotShownLabel,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, snapshotWithPaths, syntheticFallowJson } from '../fixtures/evidence-report';

// oxlint consistent-function-scoping: a no-arg closure that captures nothing is hoisted.
const noop = (): void => {};
const mountS = () => mount(SourcesScreen, {
  attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn(), onScanRequested: vi.fn(), onCancelScan: vi.fn() } },
});
/** The mounted screen, typed as mountS returns it (a bare VueWrapper trips no-unsafe-argument). */
type Wrapper = ReturnType<typeof mountS>;
function withSnapshot(repositoryId = 'repo-a'): CodebaseSnapshot {
  const snap = buildSnapshotFixture({ files: 10, directories: 2, repositoryId });
  useCityStore().setCity(snap, computeLayout(snap));
  useEvidenceStore().bindRepository(repositoryId);
  return snap;
}
const filePaths = (snap: CodebaseSnapshot): string[] => snap.entities.filter((e) => e.kind === 'file').map((e) => e.path);
async function openDialog(w: Wrapper): Promise<void> {
  await w.find('.ci-fallow-card__import').trigger('click');
  await flushPromises();
}
/** What a real pick does: `files` is set on the dialog's own input, then `change` fires. */
async function setFile(w: Wrapper, file: File): Promise<void> {
  const input = w.find('.ci-connect-fallow__file');
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
  await input.trigger('change');
}
async function pick(w: Wrapper, text: string, name = 'fallow-report.json'): Promise<void> {
  await setFile(w, new File([text], name, { type: 'application/json' }));
  await flushPromises();
}
/** A file whose `.text()` does not resolve until `release()` (the Part 5 E19a pattern). */
function slowFile(text: string): { file: File; release: () => void } {
  let release: () => void = noop;
  const gate = new Promise<void>((r) => { release = r; });
  const file = new File([text], 'slow.json', { type: 'application/json' });
  const read = file.text.bind(file);
  file.text = async () => { await gate; return read(); };
  return { file, release };
}
/** The synthetic report with two reported-but-not-shown sections (Y25). */
function withNotShown(text: string): string {
  const doc = JSON.parse(text) as { check: { summary: Record<string, number> } };
  doc.check.summary.unused_files = 3;
  doc.check.summary.circular_dependencies = 2;
  return JSON.stringify(doc);
}

describe('Connect fallow (Part 6 Y38, S14)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useEvidenceStore().setRepository(new InMemoryEvidenceStore());
    useCityStore().navigate('sources');
  });

  it('opens from the fallow card with the intro, the disclosure and the snapshot size; Choose clicks the dialog\'s own input', async () => {
    withSnapshot();
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(noop);
    const w = mountS();
    await openDialog(w);
    const dialog = w.find('[role="dialog"]');
    expect(dialog.attributes('aria-label')).toBe(FALLOW_DIALOG_TITLE);
    expect(dialog.text()).toContain(FALLOW_DISCLOSURE);
    expect(dialog.text()).toContain(FALLOW_SNAPSHOT_FILES(10));
    expect(w.find('.ci-connect-fallow__file').attributes()).toMatchObject({ type: 'file', accept: '.json,application/json', tabindex: '-1', 'aria-hidden': 'true' });
    expect(dialog.find('.ci-connect-fallow__file').exists()).toBe(false);   // outside the focus trap
    await w.find('.ci-connect-fallow__choose').trigger('click');
    expect(click).toHaveBeenCalledTimes(1);
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    expect(useEvidenceStore().report).toBeNull();
    w.unmount();
    click.mockRestore();
  });

  it('refuses each broken file with one alert for its code, and a new pick replaces it (Y31)', async () => {
    withSnapshot();
    const w = mountS();
    await openDialog(w);
    const texts = ['{', JSON.stringify({ kind: 'health', schema_version: 99, version: '3.27.0' }), JSON.stringify({ kind: 'combined', schema_version: 12 })];
    for (const text of texts) {
      await pick(w, text);
      const read = parseFallowReportText(text);
      if (read.ok) throw new Error('expected a refusal');
      const alerts = w.findAll('.ci-connect-fallow__error');
      expect(alerts).toHaveLength(1);
      expect(alerts[0]!.attributes('role')).toBe('alert');
      expect(alerts[0]!.text()).toBe(FALLOW_IMPORT_ERROR[read.code](read.detail));
      expect(w.find('.ci-connect-fallow__choose').exists()).toBe(true);
    }
    w.unmount();
  });

  it('refuses a report none of whose findings match this snapshot as a source mismatch (COPY-17)', async () => {
    withSnapshot();
    const w = mountS();
    await openDialog(w);
    await pick(w, syntheticFallowJson(snapshotWithPaths(['elsewhere/a.ts', 'elsewhere/b.ts'])));
    expect(w.find('.ci-connect-fallow__error').text()).toBe(FALLOW_IMPORT_ERROR['source-mismatch'](''));
    expect(w.find('.ci-connect-fallow__attach').exists()).toBe(false);
    w.unmount();
  });

  it('reviews a valid report: counts, the first 20 unmatched paths, the sections not shown; Cancel attaches nothing', async () => {
    const snap = withSnapshot();
    const strays = Array.from({ length: 25 }, (_, i) => `ghost/s${String(i).padStart(2, '0')}.ts`);
    const w = mountS();
    await openDialog(w);
    await pick(w, withNotShown(syntheticFallowJson(snap, { unmatchedPaths: strays })));
    expect(document.activeElement).toBe(w.find('.ci-connect-fallow h3').element);
    expect(w.find('.ci-fallow-facts__file').text()).toBe('fallow-report.json');
    expect(w.find('.ci-connect-fallow .ci-fallow-facts').classes()).toContain('ci-fallow-facts--wide');   // E46
    expect(w.find('.ci-fallow-facts__matched').text()).toBe(FALLOW_MATCHED(19, 10));
    expect(w.find('.ci-fallow-facts__unmatched summary').text()).toBe(FALLOW_UNMATCHED_SUMMARY(25, 20));
    expect(w.findAll('.ci-fallow-facts__unmatched li').map((li) => li.text())).toEqual(strays.slice(0, 20));
    expect(w.findAll('.ci-fallow-facts__not-shown li').map((li) => li.text())).toEqual([
      FALLOW_NOT_SHOWN_ITEM(fallowNotShownLabel('unused_files'), 3),
      FALLOW_NOT_SHOWN_ITEM(fallowNotShownLabel('circular_dependencies'), 2),
    ]);
    expect(w.find('.ci-connect-fallow__mapping').exists()).toBe(false);
    expect(w.find('.ci-connect-fallow__replace').exists()).toBe(false);
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    expect(useEvidenceStore().report).toBeNull();
    w.unmount();
  });

  it('offers the leading-folder mapping unchecked, and applies it only when checked (Y26)', async () => {
    const snap = withSnapshot();
    const w = mountS();
    await openDialog(w);
    await pick(w, syntheticFallowJson(snapshotWithPaths(filePaths(snap).map((p) => `app/${p}`))));
    const box = w.find<HTMLInputElement>('.ci-connect-fallow__mapping input[type="checkbox"]');
    expect(box.element.checked).toBe(false);
    expect(w.find('.ci-connect-fallow__mapping label').text()).toBe(FALLOW_MAPPING_OFFER('app/'));
    expect(w.find('.ci-fallow-facts__matched').text()).toBe(FALLOW_MATCHED(0, 0));
    await box.setValue(true);
    expect(w.find('.ci-fallow-facts__matched').text()).toBe(FALLOW_MATCHED(19, 10));
    await w.find('.ci-connect-fallow__attach').trigger('click');
    await flushPromises();
    expect(useEvidenceStore().report?.stripPrefix).toBe('app/');
    w.unmount();
  });

  it('Attach closes, announces in the Data & scans live region, and a second import notes the replacement', async () => {
    const snap = withSnapshot();
    const w = mountS();
    await openDialog(w);
    await pick(w, syntheticFallowJson(snap));
    await w.find('.ci-connect-fallow__attach').trigger('click');
    await flushPromises();
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    expect(useEvidenceStore().report?.fileName).toBe('fallow-report.json');
    const message = FALLOW_ATTACHED(19, 10);
    expect(w.find('.ci-sources__live').text()).toBe(message);

    const first = useEvidenceStore().report!;
    await openDialog(w);
    await pick(w, syntheticFallowJson(snap), 'second.json');
    expect(w.find('.ci-connect-fallow__replace').text()).toBe(FALLOW_REPLACE_NOTE(formatAbsoluteTime(first.importedAt, Intl)));
    const live = w.find('.ci-sources__live').element;
    const seen: string[] = [];
    const observer = new MutationObserver(() => { seen.push((live.textContent ?? '').trim()); });
    observer.observe(live, { childList: true, characterData: true, subtree: true });
    await w.find('.ci-connect-fallow__attach').trigger('click');
    await flushPromises();
    observer.disconnect();
    expect(seen).toContain('');
    expect(seen[seen.length - 1]).toBe(message);
    expect(useEvidenceStore().report?.fileName).toBe('second.json');
    w.unmount();
  });

  it('ignores Choose, Cancel and Escape while a slow read is in flight (Part 4 E13)', async () => {
    const snap = withSnapshot();
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(noop);
    const w = mountS();
    await openDialog(w);
    const { file, release } = slowFile(syntheticFallowJson(snap));
    await setFile(w, file);
    expect(w.find('.ci-connect-fallow__choose').attributes('aria-disabled')).toBe('true');
    expect(w.find('.ci-connect-fallow__cancel').attributes('aria-disabled')).toBe('true');
    await w.find('.ci-connect-fallow__choose').trigger('click');
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    await w.find('[role="dialog"]').trigger('keydown', { key: 'Escape' });
    expect(w.find('.ci-connect-fallow').exists()).toBe(true);
    expect(click).not.toHaveBeenCalled();
    release();
    await flushPromises();
    expect(w.find('.ci-connect-fallow__attach').exists()).toBe(true);
    expect(w.find('.ci-connect-fallow__cancel').attributes('aria-disabled')).toBeUndefined();
    w.unmount();
    click.mockRestore();
  });

  it('closes without attaching when the codebase changes, and drops the late result (Part 4 E8/E11)', async () => {
    const snap = withSnapshot('repo-a');
    const w = mountS();
    await openDialog(w);
    const { file, release } = slowFile(syntheticFallowJson(snap));
    await setFile(w, file);
    withSnapshot('repo-b');
    await flushPromises();
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    release();
    await flushPromises();
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    expect(w.find('.ci-connect-fallow__error').exists()).toBe(false);
    expect(w.find('.ci-sources__live').text()).toBe('');
    expect(useEvidenceStore().report).toBeNull();
    withSnapshot('repo-a');
    expect(useEvidenceStore().report).toBeNull();
    w.unmount();
  });

  it('drops a read that lands after the evidence store was rebound, and closes (Part 6 E36)', async () => {
    const snap = withSnapshot('repo-a');
    const w = mountS();
    await openDialog(w);
    const { file, release } = slowFile(syntheticFallowJson(snap));
    await setFile(w, file);
    useEvidenceStore().bindRepository('repo-b');
    release();
    await flushPromises();
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    expect(w.find('.ci-sources__live').text()).toBe('');
    expect(useEvidenceStore().report).toBeNull();
    w.unmount();
  });

  it('attaches nothing when the codebase switches between a finished read and the Attach click (Part 6 E36)', async () => {
    const snap = withSnapshot('repo-a');
    const w = mountS();
    await openDialog(w);
    await pick(w, syntheticFallowJson(snap));
    const attach = w.find('.ci-connect-fallow__attach');
    withSnapshot('repo-b');
    await attach.trigger('click');   // dispatched before SourcesScreen's watcher closes the dialog
    await flushPromises();
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    expect(w.find('.ci-sources__live').text()).toBe('');
    expect(useEvidenceStore().report).toBeNull();
    withSnapshot('repo-a');
    expect(useEvidenceStore().report).toBeNull();
    w.unmount();
  });

  it('closes without attaching when the evidence store is bound to another codebase at Attach (Part 6 E36)', async () => {
    const snap = withSnapshot('repo-a');
    const w = mountS();
    await openDialog(w);
    await pick(w, syntheticFallowJson(snap));
    useEvidenceStore().bindRepository('repo-b');
    await w.find('.ci-connect-fallow__attach').trigger('click');
    await flushPromises();
    expect(w.find('.ci-connect-fallow').exists()).toBe(false);
    expect(w.find('.ci-sources__live').text()).toBe('');
    expect(useEvidenceStore().report).toBeNull();
    useEvidenceStore().bindRepository('repo-a');
    expect(useEvidenceStore().report).toBeNull();
    w.unmount();
  });

  it('keeps Tab and Shift+Tab inside the dialog from the review heading and through the unmatched summary (fix round 1)', async () => {
    const snap = withSnapshot();
    const w = mountS();
    await openDialog(w);
    await pick(w, syntheticFallowJson(snap, { unmatchedPaths: ['ghost/a.ts'] }));
    const heading = w.find('.ci-connect-fallow h3');
    const summary = w.find('.ci-fallow-facts__unmatched summary');
    const attach = w.find('.ci-connect-fallow__attach');
    expect(document.activeElement).toBe(heading.element);
    await heading.trigger('keydown', { key: 'Tab', shiftKey: true });   // a focus target outside the Tab order
    expect(document.activeElement).toBe(attach.element);
    await attach.trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(summary.element);                // the summary is in the trap order
    await summary.trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(attach.element);
    w.unmount();
  });

  it('attaches against the snapshot on screen at Attach, so a same-codebase refresh after the read is not stale (fix round 1)', async () => {
    const snap = withSnapshot();
    const w = mountS();
    await openDialog(w);
    await pick(w, syntheticFallowJson(snap));
    const refreshed: CodebaseSnapshot = { ...snap, snapshotId: 'snapshot-refreshed' };
    useCityStore().setCity(refreshed, computeLayout(refreshed));   // the silent "Scan codebase" refresh
    await flushPromises();
    await w.find('.ci-connect-fallow__attach').trigger('click');
    await flushPromises();
    expect(useEvidenceStore().report?.snapshotId).toBe('snapshot-refreshed');
    expect(w.find('.ci-provider--fallow .ci-provenance--stale').exists()).toBe(false);
    expect(w.find('.ci-fallow-card__stale').exists()).toBe(false);
    w.unmount();
  });

  it('acceptance (4): a failed import leaves the attached evidence exactly as it was (Y31)', async () => {
    const snap = withSnapshot();
    const kept = attachSyntheticReport(snap);
    const w = mountS();
    await openDialog(w);
    await pick(w, '{');
    expect(w.find('.ci-connect-fallow__error').text()).toBe(FALLOW_IMPORT_ERROR['not-json'](''));
    await pick(w, syntheticFallowJson(snapshotWithPaths(['elsewhere/a.ts'])));
    expect(w.find('.ci-connect-fallow__error').text()).toBe(FALLOW_IMPORT_ERROR['source-mismatch'](''));
    await w.find('.ci-connect-fallow__cancel').trigger('click');
    expect(useEvidenceStore().report).toBe(kept);
    expect(w.find('.ci-fallow-card .ci-fallow-facts__file').text()).toBe(kept.fileName);
    w.unmount();
  });

  it('renders a report\'s file name and warning as literal text, in the review and on the card (spec §4)', async () => {
    const snap = withSnapshot();
    const evil = '<img src=x onerror=alert(1)>';
    const w = mountS();
    await openDialog(w);
    await pick(w, syntheticFallowJson(snap, { warning: evil, unmatchedPaths: [`ghost/${evil}.ts`] }), evil);
    expect(w.find('.ci-connect-fallow .ci-fallow-facts__file').text()).toBe(evil);
    expect(w.find('.ci-connect-fallow .ci-fallow-facts__warnings').text()).toBe(evil);
    expect(w.find('.ci-connect-fallow .ci-fallow-facts__unmatched li').text()).toBe(`ghost/${evil}.ts`);
    expect(w.find('.ci-connect-fallow img').exists()).toBe(false);
    await w.find('.ci-connect-fallow__attach').trigger('click');
    await flushPromises();
    expect(w.find('.ci-fallow-card .ci-fallow-facts__file').text()).toBe(evil);
    expect(w.find('.ci-fallow-card .ci-fallow-facts__warnings').text()).toBe(evil);
    expect(w.find('.ci-fallow-card .ci-fallow-facts__unmatched li').text()).toBe(`ghost/${evil}.ts`);
    expect(w.find('.ci-fallow-card img').exists()).toBe(false);
    expect(w.find('.ci-fallow-card').html()).toContain('&lt;img');
    w.unmount();
  });
});
