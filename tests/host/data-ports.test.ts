// Part 6 Y11/Y12/Y5, R2: wireDataPorts hands the plugin's review registry to one leaf's
// review store before mount; two leaves on one codebase then share one durable repository —
// one id sequence, and a change in one shows in the other — and the review state is there
// again after a restart (a new registry on the same data.json). unwireDataPorts detaches a
// closing leaf, so the plugin-level repository stops calling into it.
import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createPinia, type Pinia } from 'pinia';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { unwireDataPorts, wireDataPorts } from '../../src/host/data-ports';
import type { CityViewDeps } from '../../src/host/city-view';
import { createReviewRepositoryRegistry, type ReviewRepositoryRegistry } from '../../src/adapters/storage/review-repository-registry';
import { createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { makeEntityId } from '../../src/domain/entity-id';
import { dataPortDeps } from '../fixtures/data-port-deps';

const REPO = 'p1';
const NOW = new Date('2026-09-23T10:00:00.000Z');
const FILE_A = makeEntityId(REPO, 'file', 'src/a.ts');
/** wireDataPorts reads only the data ports; the shared helper supplies the rest (E3). */
const depsOf = (ports: Pick<CityViewDeps, 'reviewRepositoryFor'>): CityViewDeps => ({ ...dataPortDeps(), ...ports }) as CityViewDeps;
const newPlugin = (): ObsidianPlugin => new Plugin({}, {}) as unknown as ObsidianPlugin;

/** A leaf: its own Pinia, wired to `registry`, its review store bound to REPO. */
async function leaf(registry: ReviewRepositoryRegistry): Promise<{ pinia: Pinia; review: ReturnType<typeof useReviewStore> }> {
  const pinia = createPinia();
  wireDataPorts(pinia, depsOf({ reviewRepositoryFor: (id) => registry.for(id) }));
  const review = useReviewStore(pinia);
  await review.bindRepository(REPO);
  return { pinia, review };
}

describe('wireDataPorts (Part 6 Y11)', () => {
  it('builds the bound codebase\'s review repository through the given factory', async () => {
    const repo = createInMemoryReviewRepository();
    const reviewRepositoryFor = vi.fn(() => repo);
    const pinia = createPinia();
    wireDataPorts(pinia, depsOf({ reviewRepositoryFor }));
    const review = useReviewStore(pinia);
    await review.bindRepository(REPO);
    expect(reviewRepositoryFor).toHaveBeenCalledWith(REPO);
    await review.addWorkItemForFile(FILE_A, 'Split the parser', NOW);
    expect((await repo.listWorkItems()).map((w) => w.title)).toEqual(['Split the parser']);
  });

  it('two leaves on one codebase share one repository: one id sequence, and each shows the other\'s change (Y11, Y12)', async () => {
    const registry = createReviewRepositoryRegistry(newPlugin());
    const left = (await leaf(registry)).review;
    const right = (await leaf(registry)).review;
    expect((await left.addWorkItemForFile(FILE_A, 'Split the parser', NOW))?.id).toBe('wi-1');
    await flushPromises();
    expect(right.workItems.map((w) => w.id)).toEqual(['wi-1']);
    expect((await right.addWorkItem({ kind: 'module', module: 'src' }, 'review', 'Review src', NOW))?.id).toBe('wi-2');
    await flushPromises();
    expect(left.workItems.map((w) => w.id)).toEqual(['wi-1', 'wi-2']);
    expect(await right.removeWorkItem('wi-1')).toBe(true);
    await flushPromises();
    expect(left.workItems.map((w) => w.id)).toEqual(['wi-2']);
  });

  it('keeps the review state across a restart: a new registry on the same data.json lists it (Y5)', async () => {
    const plugin = newPlugin();
    const before = (await leaf(createReviewRepositoryRegistry(plugin))).review;
    await before.addWorkItemForFile(FILE_A, 'Split the parser', NOW);
    await before.addRule('ui', 'domain', 'Layering', NOW);
    await before.acknowledge(`${FILE_A}#CX-1`, NOW);
    const after = (await leaf(createReviewRepositoryRegistry(plugin))).review;
    expect(after.workItems).toEqual(before.workItems);
    expect(after.rules).toEqual(before.rules);
    expect(after.dispositions).toEqual(before.dispositions);
    expect((await after.addRule('ui', 'host', 'Layering', NOW))?.id).toBe('AR-002');
  });

  it('mirrors what the saved state could not show into the store (Y7)', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ reviews: { [REPO]: { v: 1, workItems: [{ id: 'wi-1', owner: 'x' }], rules: [], dispositions: [] } } });
    const { review } = await leaf(createReviewRepositoryRegistry(plugin));
    expect(review.workItems).toEqual([]);
    expect(review.storageDiagnostics).toEqual({ skipped: 1, unsupported: false });
  });
});

describe('unwireDataPorts (Part 6 R2)', () => {
  it('detaches a closing leaf: it stops following the other leaf, which keeps working', async () => {
    const registry = createReviewRepositoryRegistry(newPlugin());
    const closing = await leaf(registry);
    const open = await leaf(registry);
    unwireDataPorts(closing.pinia);
    await open.review.addWorkItemForFile(FILE_A, 'Split the parser', NOW);
    await flushPromises();
    expect(closing.review.workItems).toEqual([]);
    expect(open.review.workItems.map((w) => w.id)).toEqual(['wi-1']);
  });
});
