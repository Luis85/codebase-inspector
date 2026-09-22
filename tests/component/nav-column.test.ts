// Final whole-branch review, items 2 and 4: NavColumn's badges and its Escape handling.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import NavColumn from '../../src/ui/shell/NavColumn.vue';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { computeLayout } from '../../src/domain/layout/layout';
import { collected } from '../../src/ui/evidence';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

/** Part 1 has no provider that COLLECTS findings; this flag lets one test stand in for
 *  Part 2's first real provider without changing what every other test sees. */
const forced = vi.hoisted(() => ({ collectedFindings: null as number | null }));
vi.mock('../../src/ui/read-models/overview', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/ui/read-models/overview')>();
  return {
    ...original,
    buildOverviewModel: (...args: Parameters<typeof original.buildOverviewModel>) => {
      const model = original.buildOverviewModel(...args);
      const count = forced.collectedFindings;
      if (count === null) return model;
      return { ...model, cards: model.cards.map((c) => (c.id === 'findings' ? { ...c, value: collected(count, 'test provider') } : c)) };
    },
  };
});

function withSnapshot(): void {
  const snap = buildSnapshotFixture({ files: 30, directories: 3 });
  useCityStore().setCity(snap, computeLayout(snap));
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
  beforeEach(() => { setActivePinia(createPinia()); forced.collectedFindings = null; });
  afterEach(() => { document.body.innerHTML = ''; });

  it('shows no Code quality badge while the findings count is only sample data', () => {
    withSnapshot();
    const w = mountNav(false);
    expect(badgeFor(w, 'Code quality')).toBeNull();
    w.unmount();
  });

  it('shows the Code quality badge once the findings count is collected', () => {
    forced.collectedFindings = 7;
    withSnapshot();
    const w = mountNav(false);
    expect(badgeFor(w, 'Code quality')).toBe('7');
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
