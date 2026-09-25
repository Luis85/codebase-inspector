// WP-04 IN1-IN6, IP18/IP19: the Investigate screen's finding list, its roving-focus
// keyboard model (never select-on-focus) and its filters.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import '../mocks/obsidian';
import InvestigateScreen from '../../src/ui/screens/InvestigateScreen.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useInvestigationStore } from '../../src/ui/stores/investigation-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { findingRef } from '../../src/ui/read-models/review-state';
import { FINDINGS_PAGE } from '../../src/ui/read-models/findings';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport, type SyntheticReportOptions } from '../fixtures/evidence-report';
import { inertInvestigationNotes, scriptedSourcePreview } from '../fixtures/fake-investigation';
import type { NoteLink } from '../../src/application/investigation/note-index';

function mountScreen() {
  return mount(InvestigateScreen, { attachTo: document.body, global: { provide: { onSelectCodebase: vi.fn() } } });
}

async function withReport(fileCount: number, options: SyntheticReportOptions = {}) {
  const snap = buildSnapshotFixture({ files: fileCount, directories: Math.max(1, Math.floor(fileCount / 25)) });
  useCityStore().setCity(snap, computeLayout(snap));
  attachSyntheticReport(snap, options);
  useInvestigationStore().setPorts(inertInvestigationNotes(), scriptedSourcePreview());
  useReviewStore().setRepositoryFactory(() => createInMemoryReviewRepository());
  await useReviewStore().bindRepository(snap.repositoryId);
  useCityStore().navigate('investigate');
  return snap;
}

const rowEls = (w: ReturnType<typeof mountScreen>) => w.findAll('.ci-investigate-row');
const fp = (el: ReturnType<typeof rowEls>[number]) => el.attributes('data-fingerprint')!;

describe('Investigate finding list (WP-04 IN1-IN3, IN6)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('renders rows with severity, kind, title, location, status and (when present) a notes chip, paged at FINDINGS_PAGE with Show more', async () => {
    await withReport(150);
    const w = mountScreen();
    await nextTick();
    const { investigation } = useReadModels();
    const total = investigation.value.rows.length;
    expect(total).toBeGreaterThan(FINDINGS_PAGE);
    const rows = rowEls(w);
    expect(rows).toHaveLength(FINDINGS_PAGE);
    // IN3: DOM order matches the model's own total order.
    expect(rows.map((r) => fp(r))).toEqual(investigation.value.rows.slice(0, FINDINGS_PAGE).map((r) => r.fingerprint));
    const first = investigation.value.rows[0]!;
    const firstEl = rows[0]!;
    expect(firstEl.find('.ci-investigate-row__title').text()).toBe(first.title);
    expect(firstEl.find('.ci-investigate-row__location').text()).toContain(first.anchorPath);
    expect(firstEl.find('.ci-chip').exists()).toBe(true);
    expect(firstEl.find('.ci-investigate-row__notes').exists()).toBe(false);
    const more = w.find('.ci-investigate-list__more');
    expect(more.exists()).toBe(true);
    await more.trigger('click');
    expect(rowEls(w)).toHaveLength(Math.min(total, FINDINGS_PAGE * 2));
    w.unmount();
  });

  it('no row renders a report value as markup: a hostile symbol shows as text, and the screen holds no img', async () => {
    await withReport(4, { symbol: '<img src=x onerror=alert(1)>' });
    const w = mountScreen();
    await nextTick();
    expect(w.find('img').exists()).toBe(false);
    const text = rowEls(w).map((r) => r.text()).join(' ');
    expect(text).toContain('<img src=x onerror=alert(1)>');
    w.unmount();
  });
});

describe('Investigate keyboard model (WP-04 IP18): roving focus, never select-on-focus', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('exactly one row is a tab stop; arrows move focus without selecting; Enter selects; Home/End jump; aria-current marks the selection', async () => {
    await withReport(5);
    const w = mountScreen();
    await nextTick();
    const rows = () => rowEls(w);
    expect(rows().filter((r) => r.attributes('tabindex') === '0')).toHaveLength(1);
    expect(rows()[0]!.attributes('tabindex')).toBe('0');

    const list = w.find('.ci-investigate-list');
    await list.trigger('keydown', { key: 'ArrowDown' });
    await nextTick();
    expect(useInvestigationStore().selectedFingerprint, 'focus movement never selects (IN13)').toBeNull();
    expect(rows()[1]!.attributes('tabindex')).toBe('0');
    expect(rows()[0]!.attributes('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(rows()[1]!.element);

    await list.trigger('keydown', { key: 'Enter' });
    await nextTick();
    expect(useInvestigationStore().selectedFingerprint).toBe(fp(rows()[1]!));
    expect(rows()[1]!.attributes('aria-current')).toBe('true');
    expect(rows()[0]!.attributes('aria-current')).toBeUndefined();

    await list.trigger('keydown', { key: 'End' });
    await nextTick();
    expect(rows().at(-1)!.attributes('tabindex')).toBe('0');
    expect(useInvestigationStore().selectedFingerprint, 'End only moves focus').toBe(fp(rows()[1]!));

    await list.trigger('keydown', { key: 'Home' });
    await nextTick();
    expect(rows()[0]!.attributes('tabindex')).toBe('0');
    w.unmount();
  });

  it('clicking a row selects it directly', async () => {
    await withReport(5);
    const w = mountScreen();
    await nextTick();
    const target = rowEls(w)[2]!;
    await target.trigger('click');
    expect(useInvestigationStore().selectedFingerprint).toBe(fp(target));
    expect(target.attributes('aria-current')).toBe('true');
    w.unmount();
  });
});

describe('Investigate filters (WP-04 IN2/IP19)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('type, rule, severity, status and note each narrow the rows; Reset restores them', async () => {
    await withReport(12);
    const w = mountScreen();
    await nextTick();
    const { investigation } = useReadModels();
    const totalAll = investigation.value.rows.length;

    await w.find('.ci-investigate-filters__kind').setValue('complexity');
    await nextTick();
    expect(rowEls(w).length).toBeGreaterThan(0);
    expect(rowEls(w).length).toBeLessThan(totalAll);
    expect(rowEls(w).every((r) => investigation.value.byFingerprint.get(fp(r))?.kind === 'complexity')).toBe(true);

    await w.find('.ci-investigate-filters__reset').trigger('click');
    await nextTick();
    expect(rowEls(w).length).toBe(Math.min(totalAll, FINDINGS_PAGE));

    const rule = investigation.value.rules[0]!;
    await w.find('.ci-investigate-filters__rule').setValue(rule);
    await nextTick();
    expect(rowEls(w).every((r) => investigation.value.byFingerprint.get(fp(r))?.rule === rule)).toBe(true);
    await w.find('.ci-investigate-filters__reset').trigger('click');

    const severity = investigation.value.severities[0]!;
    await w.find('.ci-investigate-filters__severity').setValue(severity);
    await nextTick();
    expect(rowEls(w).every((r) => investigation.value.byFingerprint.get(fp(r))?.severity === severity)).toBe(true);
    await w.find('.ci-investigate-filters__reset').trigger('click');

    const target = investigation.value.rows[0]!;
    await useReviewStore().acknowledge(target.fingerprint, new Date('2026-09-25T00:00:00Z'));
    await nextTick();
    await w.find('.ci-investigate-filters__status').setValue('open');
    await nextTick();
    expect(rowEls(w).some((r) => fp(r) === target.fingerprint)).toBe(false);
    await w.find('.ci-investigate-filters__status').setValue('acknowledged');
    await nextTick();
    expect(rowEls(w).some((r) => fp(r) === target.fingerprint)).toBe(true);
    await w.find('.ci-investigate-filters__reset').trigger('click');

    // Note filter: give one row a note directly through the store's note index.
    const noted = investigation.value.rows[1]!;
    const portable = findingRef(noted.fingerprint)!;
    const link: NoteLink = {
      path: 'notes/n1.md', codebaseId: 'p1', fingerprint: portable, findingId: noted.id, sourcePath: noted.anchorPath,
      snapshotId: 'snap', status: 'open',
    };
    useInvestigationStore().notes = { byFingerprint: new Map([[portable, [link]]]), malformed: 0 };
    await nextTick();
    await w.find('.ci-investigate-filters__note').setValue('with-note');
    await nextTick();
    expect(rowEls(w).map((r) => fp(r))).toEqual([noted.fingerprint]);
    await w.find('.ci-investigate-filters__note').setValue('without-note');
    await nextTick();
    expect(rowEls(w).some((r) => fp(r) === noted.fingerprint)).toBe(false);
    w.unmount();
  });

  it('IP19: selecting a finding the current filter hides resets the filter so the row is listed', async () => {
    await withReport(12);
    const w = mountScreen();
    await nextTick();
    const { investigation } = useReadModels();
    const target = investigation.value.rows[0]!;
    await useReviewStore().acknowledge(target.fingerprint, new Date('2026-09-25T00:00:00Z'));
    await nextTick();
    await w.find('.ci-investigate-filters__status').setValue('open');
    await nextTick();
    expect(rowEls(w).some((r) => fp(r) === target.fingerprint)).toBe(false);

    useInvestigationStore().open(target.fingerprint);
    await nextTick();
    expect((w.find('.ci-investigate-filters__status').element as HTMLSelectElement).value).toBe('all');
    const targetRow = rowEls(w).find((r) => fp(r) === target.fingerprint);
    expect(targetRow, 'the row is listed').toBeTruthy();
    expect(targetRow!.attributes('aria-current')).toBe('true');
    w.unmount();
  });
});
