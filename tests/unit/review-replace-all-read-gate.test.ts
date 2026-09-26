// Part 6 E29 (Task 4 fix round 1): replaceAll (and clearAll through it) refuses while the
// bound codebase's saved review state has not been read: its lists are then empty only
// because nothing was read, and one atomic port replace would wipe the saved set the user
// never saw. Refused means `false`, and the port's replaceAll is never called.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { createInMemoryReviewRepository, type ReviewRepository } from '../../src/ui/stores/ports/review-repository';

const EMPTY = { workItems: [], rules: [], dispositions: [] };
// oxlint consistent-function-scoping: closures that capture nothing are hoisted.
const noop = (): void => {};
const hang = <T>(): Promise<T> => new Promise<T>(() => {});

function spiedRepository(overrides: Partial<ReviewRepository>): { repo: ReviewRepository; replaceAll: ReturnType<typeof vi.fn> } {
  const replaceAll = vi.fn(() => Promise.resolve());
  return { repo: { ...createInMemoryReviewRepository(), ...overrides, replaceAll }, replaceAll };
}

describe('review store replaceAll/clearAll before the saved state is read (Part 6 E29)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('refuses while the bound codebase\'s load rejected (loadFailed)', async () => {
    const { repo, replaceAll } = spiedRepository({ listWorkItems: () => Promise.reject(new Error('data.json unreadable')) });
    const store = useReviewStore();
    store.setRepositoryFactory(() => repo);
    await store.bindRepository('p1').catch(noop);
    expect(store.loadFailed).toBe(true);
    expect(await store.replaceAll(EMPTY)).toBe(false);
    expect(await store.clearAll()).toBe(false);
    expect(replaceAll).not.toHaveBeenCalled();
    expect(store.bulkBusy).toBe(false);
  });

  it('refuses before the bound codebase\'s first load finishes (not ready)', async () => {
    const { repo, replaceAll } = spiedRepository({ listWorkItems: hang });
    const store = useReviewStore();
    store.setRepositoryFactory(() => repo);
    void store.bindRepository('p1');
    expect(store.ready).toBe(false);
    expect(await store.replaceAll(EMPTY)).toBe(false);
    expect(await store.clearAll()).toBe(false);
    expect(replaceAll).not.toHaveBeenCalled();
  });
});
