// Final whole-branch review, items 2 and 4: NavColumn's badges and its Escape handling.
// Part 6 Y34: the Code quality badge is the imported fallow findings total. It shows only
// while that total is collected (a current report), never for stale or absent evidence.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import NavColumn from '../../src/ui/shell/NavColumn.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { useReadModels } from '../../src/ui/read-models/use-read-models';
import { computeLayout } from '../../src/domain/layout/layout';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { attachSyntheticReport } from '../fixtures/evidence-report';
import type { CodebaseSnapshot } from '../../src/domain/model';

function withSnapshot(): CodebaseSnapshot {
  const snap = buildSnapshotFixture({ files: 30, directories: 3 });
  useCityStore().setCity(snap, computeLayout(snap));
  return snap;
}

function mountNav(drawer: boolean) {
  return mount(NavColumn, {
    props: { drawer, workspaceLabel: 'repo' },
    global: { provide: { onSelectCodebase: vi.fn() } },
    attachTo: document.body,
  });
}

function badgeFor(w: ReturnType<typeof mountNav>, title: string): string | null {
  const item = w.findAll('.ci-nav__item').find((b) => b.text().includes(title));
  expect(item, `no nav item "${title}"`).toBeDefined();
  const badge = item!.find('.ci-nav__badge');
  return badge.exists() ? badge.text() : null;
}

describe('NavColumn badges', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('shows no Code quality badge without an imported report', () => {
    withSnapshot();
    const w = mountNav(false);
    expect(badgeFor(w, 'Code quality')).toBeNull();
    w.unmount();
  });

  it('shows the findings total as the Code quality badge while the report is current (Part 6 Y34)', () => {
    const report = attachSyntheticReport(withSnapshot());
    const w = mountNav(false);
    expect(badgeFor(w, 'Code quality')).toBe(String(report.normalized.findings.length));
    w.unmount();
  });

  it('counts open findings only: a dismissal drops the badge by one, matching Code quality\'s Open card (E48 I1)', async () => {
    const report = attachSyntheticReport(withSnapshot());
    const { quality } = useReadModels();
    const w = mountNav(false);
    await useReviewStore().dismiss(quality.value.findings[0]!.fingerprint, 'Reviewed, intended.', new Date(0));
    await flushPromises();
    expect(badgeFor(w, 'Code quality')).toBe(String(report.normalized.findings.length - 1));
    expect(badgeFor(w, 'Code quality')).toBe(String(quality.value.cards[0]!.value.value));
    w.unmount();
  });

  it('shows no Code quality badge for stale evidence (Y30)', () => {
    attachSyntheticReport(withSnapshot(), { snapshotId: 'an-older-snapshot' });
    const w = mountNav(false);
    expect(badgeFor(w, 'Code quality')).toBeNull();
    w.unmount();
  });

  it('keeps the workbench badge, which counts real in-memory work items', async () => {
    withSnapshot();
    const w = mountNav(false);
    expect(badgeFor(w, 'Refactor workbench')).toBeNull();
    await useReviewStore().addWorkItemForFile('r\0file\0a.ts', 'Investigate a.ts', new Date(0));
    await flushPromises();
    expect(badgeFor(w, 'Refactor workbench')).toBe('1');
    w.unmount();
  });

  it('counts only open work items, so a verified item drops out of the badge', async () => {
    withSnapshot();
    const w = mountNav(false);
    const review = useReviewStore();
    await review.addWorkItemForFile('r\0file\0a.ts', 'Investigate a.ts', new Date(0));
    const second = await review.addWorkItemForFile('r\0file\0b.ts', 'Investigate b.ts', new Date(0));
    await review.updateWorkItem(second!.id, { status: 'verified', checks: [true, true, true] }, new Date(0));
    await flushPromises();
    expect(badgeFor(w, 'Refactor workbench')).toBe('1');
    w.unmount();
  });
});

function pressEscape(w: ReturnType<typeof mountNav>): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  w.find('.ci-nav__item').element.dispatchEvent(event);
  return event;
}

describe('NavColumn Escape', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  afterEach(() => { document.body.innerHTML = ''; });

  it('closes the drawer and claims the press', () => {
    const w = mountNav(true);
    const event = pressEscape(w);
    expect(event.defaultPrevented).toBe(true);
    expect(w.emitted('close')).toHaveLength(1);
    w.unmount();
  });

  it('leaves Escape unclaimed in the inline nav, so the city escape chain still sees it', () => {
    const w = mountNav(false);
    let reachedDocument = false;
    const listener = (): void => { reachedDocument = true; };
    document.addEventListener('keydown', listener);
    const event = pressEscape(w);
    document.removeEventListener('keydown', listener);
    expect(event.defaultPrevented).toBe(false);
    expect(reachedDocument).toBe(true);
    expect(w.emitted('close')).toBeUndefined();
    w.unmount();
  });
});
