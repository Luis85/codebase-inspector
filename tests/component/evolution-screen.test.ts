import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import EvolutionScreen from '../../src/ui/screens/EvolutionScreen.vue';
import SnapshotComparisonDialog from '../../src/ui/screens/evolution/SnapshotComparisonDialog.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useSnapshotJournal } from '../../src/ui/stores/snapshot-journal';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { journalEntryFor, snapshotEntryLabel } from '../../src/ui/read-models/snapshot-comparison';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import type { CodebaseSnapshot } from '../../src/domain/model';

/** The screen does not feed the journal (App.vue does), so tests record entries directly. */
function show(snap: CodebaseSnapshot) {
  useCityStore().setCity(snap, computeLayout(snap));
  useSnapshotJournal().record(journalEntryFor(snap, fileSummariesFor(snap)));
}
/** A snapshot with a real collector id (`snapshot:<repo>:<capturedAt>`, inventory-collector.ts). */
function scannedAt(capturedAt: string, files: number): CodebaseSnapshot {
  const base = buildSnapshotFixture({ files, directories: 2 });
  return { ...base, snapshotId: `snapshot:${base.repositoryId}:${capturedAt}`, providerRun: { ...base.providerRun, capturedAt } };
}
const mountE = () => mount(EvolutionScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });

describe('EvolutionScreen', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('asks for a codebase without a snapshot', () => {
    const w = mountE();
    expect(w.text()).toContain('No snapshot yet');
    w.unmount();
  });

  it('with one snapshot: no Compare action, and "files changed since previous" is unknown', () => {
    show(buildSnapshotFixture({ files: 20, directories: 2 }));
    const w = mountE();
    expect(w.find('.ci-evolution__compare').exists()).toBe(false);
    const card = w.findAll('.ci-metric-card').find((c) => c.text().includes('Files changed since previous'));   // E22
    expect(card).toBeDefined();
    expect(card!.text()).toContain('Needs a second snapshot');
    expect(w.text()).toContain('Only one snapshot so far.');
    w.unmount();
  });

  it('the 30/90-day toggle changes the sample activity series', async () => {
    show(buildSnapshotFixture({ files: 20 }));
    const w = mountE();
    expect(w.findAll('.ci-bar-chart__bar')).toHaveLength(7);
    expect(w.find('.ci-evolution__window [data-window="90"]').attributes('aria-pressed')).toBe('true');
    await w.find('.ci-evolution__window [data-window="30"]').trigger('click');
    expect(w.findAll('.ci-bar-chart__bar')).toHaveLength(5);
    expect(w.find('.ci-evolution__window [data-window="30"]').attributes('aria-pressed')).toBe('true');
    expect(w.find('.ci-evolution__window [data-window="90"]').attributes('aria-pressed')).toBe('false');
    w.unmount();
  });

  it('labels both charts as sample (E14)', () => {
    show(buildSnapshotFixture({ files: 20 }));
    const w = mountE();
    expect(w.find('.ci-bar-chart title').text()).toBe('Sample commits per interval');
    const line = w.find('.ci-line-chart svg');
    expect(line.exists()).toBe(true);
    expect(line.attributes('aria-label')).toBe('Sample coverage trend: weighted branch coverage (%) per interval');
    expect(w.text()).not.toContain('Coverage is unknown');
    w.unmount();
  });

  it('an empty snapshot has no coverage, so no trend is drawn', () => {
    show(buildSnapshotFixture({ files: 0 }));
    const w = mountE();
    expect(w.find('.ci-line-chart').exists()).toBe(false);
    expect(w.text()).toContain('Coverage is unknown, so there is no trend to draw.');
    w.unmount();
  });

  it('no Compare action when the snapshot on screen is the oldest in the journal', () => {
    const first = buildSnapshotFixture({ files: 20, directories: 2 });
    show(first);
    show({ ...buildSnapshotFixture({ files: 24, directories: 2 }), snapshotId: 'second' });
    useCityStore().setCity(first, computeLayout(first));
    expect(useSnapshotJournal().entries).toHaveLength(2);
    const w = mountE();
    expect(w.find('.ci-evolution__compare').exists()).toBe(false);
    expect(w.find('.ci-journal__compare').exists()).toBe(false);
    w.unmount();
  });

  it('focus returns to the Compare button when the dialog closes', async () => {
    show(buildSnapshotFixture({ files: 20, directories: 2 }));
    show({ ...buildSnapshotFixture({ files: 24, directories: 2 }), snapshotId: 'second' });
    const w = mountE();
    const compare = w.find('.ci-evolution__compare');
    (compare.element as HTMLElement).focus();
    await compare.trigger('click');
    await nextTick();
    expect(document.activeElement).not.toBe(compare.element);
    await w.find('.ci-compare-dialog__close').trigger('click');
    expect(document.activeElement).toBe(compare.element);
    w.unmount();
  });

  it('two scans on the same day get distinct journal rows and options (real collector ids)', async () => {
    show(scannedAt('2026-09-22T09:05:00.000Z', 20));
    show(scannedAt('2026-09-22T14:30:00.000Z', 22));
    show(scannedAt('2026-09-22T17:45:00.000Z', 24));
    const w = mountE();
    const heads = w.findAll('.ci-journal__head').map((h) => h.text());
    expect(heads).toHaveLength(3);
    expect(new Set(heads).size).toBe(3);
    await w.find('.ci-evolution__compare').trigger('click');
    const options = w.findAll('.ci-compare-dialog option').map((o) => o.text());
    expect(options).toHaveLength(2);
    expect(options[0]).not.toBe(options[1]);
    expect(options[0]).toContain('14:30');
    w.unmount();
  });

  it('with two snapshots: Compare opens a dialog of collected differences', async () => {
    show(buildSnapshotFixture({ files: 20, directories: 2 }));
    show({ ...buildSnapshotFixture({ files: 24, directories: 2 }), snapshotId: 'second' });
    const w = mountE();
    await w.find('.ci-evolution__compare').trigger('click');
    const dialog = w.find('.ci-compare-dialog');
    expect(dialog.exists()).toBe(true);
    expect(dialog.text()).toContain('Files added');
    expect(dialog.find('.ci-compare-dialog__added').text()).toBe('4');
    expect(dialog.text()).not.toContain('Sample');
    await dialog.find('.ci-compare-dialog__close').trigger('click');
    expect(w.find('.ci-compare-dialog').exists()).toBe(false);
    w.unmount();
  });

  it('a journal entry\'s Compare button opens the dialog against that entry', async () => {
    show(buildSnapshotFixture({ files: 20, directories: 2 }));
    show({ ...buildSnapshotFixture({ files: 22, directories: 2 }), snapshotId: 'second' });
    show({ ...buildSnapshotFixture({ files: 25, directories: 2 }), snapshotId: 'third' });
    const w = mountE();
    const items = w.findAll('.ci-journal__item');
    expect(items).toHaveLength(3);
    expect(items[0]!.text()).toContain('On screen');
    await items[2]!.find('.ci-journal__compare').trigger('click');
    // The oldest entry (20 files) is the base: 5 files added.
    expect(w.find('.ci-compare-dialog__added').text()).toBe('5');
    expect((w.find('.ci-compare-dialog select').element as HTMLSelectElement).value).toBe(useSnapshotJournal().entries[0]!.snapshotId);
    w.unmount();
  });

  it('a coupling row opens File detail for its first file', async () => {
    show(buildSnapshotFixture({ files: 30, directories: 2 }));
    const store = useCityStore();
    const w = mountE();
    await w.find('.ci-coupling .ci-table__row').trigger('click');
    expect(store.route).toBe('file');
    expect(store.selectedEntityId).not.toBeNull();
    expect(store.camera).toBeNull();
    w.unmount();
  });

  it('every coupling row carries the correlation note and a sample badge (E31/E38)', () => {
    show(buildSnapshotFixture({ files: 30, directories: 2 }));
    const w = mountE();
    const rows = w.findAll('.ci-coupling .ci-table__row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.find('.ci-coupling__note').text() === 'Correlation, not a causal dependency')).toBe(true);
    expect(rows.every((r) => r.find('.ci-provenance--sample').exists())).toBe(true);
    w.unmount();
  });
});

describe('SnapshotComparisonDialog', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('shows a module absent on one side with unknown lines as "—", never 0 (E33)', () => {
    show(buildSnapshotFixture({ files: 4, directories: 2 }));
    show({ ...buildSnapshotFixture({ files: 9, directories: 3 }), snapshotId: 'second' });
    const w = mount(SnapshotComparisonDialog, { attachTo: document.body });
    const row = w.findAll('.ci-compare-dialog__module').find((r) => r.text().includes('dir-2'));
    expect(row).toBeDefined();
    expect(row!.find('.ci-compare-dialog__lines').text()).toMatch(/^— → \d/);
    w.unmount();
  });

  it('falls back to the newest earlier entry when the chosen base leaves the journal', async () => {
    show(buildSnapshotFixture({ files: 20, directories: 2 }));
    show({ ...buildSnapshotFixture({ files: 22, directories: 2 }), snapshotId: 'second' });
    show({ ...buildSnapshotFixture({ files: 25, directories: 2 }), snapshotId: 'third' });
    const journal = useSnapshotJournal();
    const w = mount(SnapshotComparisonDialog, { attachTo: document.body, props: { initialBaseId: journal.entries[0]!.snapshotId } });
    expect(w.find('.ci-compare-dialog__added').text()).toBe('5');
    journal.entries = journal.entries.slice(1);
    await nextTick();
    expect((w.find('select').element as HTMLSelectElement).value).toBe('second');
    expect(w.find('.ci-compare-dialog__added').text()).toBe('3');
    w.unmount();
  });
});

describe('snapshotEntryLabel', () => {
  it('tells two same-day scans apart by their UTC time', () => {
    const a = snapshotEntryLabel('2026-09-22T09:05:00.000Z');
    const b = snapshotEntryLabel('2026-09-22T14:30:00.000Z');
    expect(a).not.toBe(b);
    expect(a).toBe('Sep 22 · 09:05 UTC');
  });
});
