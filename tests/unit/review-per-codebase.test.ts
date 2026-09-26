// Part 5 V8–V9: review state per codebase, and in-flight operations across a switch.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { makeEntityId } from '../../src/domain/entity-id';
import { architectureGraphFor } from '../../src/ui/read-models/architecture';
import { evidenceIndexFor } from '../../src/ui/read-models/evidence-index';
import { fileSummariesFor } from '../../src/ui/read-models/file-summaries';
import { relationModelFor } from '../../src/ui/read-models/relations';
import { architectureModelFor } from '../../src/ui/read-models/use-read-models';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { NO_CHECKS, createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const NOW = new Date('2026-09-22T10:00:00.000Z');
const fileIn = (repo: string, path: string) => ({ kind: 'file' as const, entityId: makeEntityId(repo, 'file', path) });
// oxlint(consistent-function-scoping): a no-arg noop captures nothing, so it is hoisted
// to module scope rather than recreated inside `deferred()` on every call.
const noop = (): void => {};

/** A promise the test settles by hand, to hold a repository call open across a switch. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = noop;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

describe('review store per codebase (Part 5 V8)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('empties the lists synchronously on a switch, before the new codebase has loaded', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    await store.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A1', NOW);
    await store.addRule('ui', 'domain', 'Layering', NOW);
    await store.acknowledge(`${fileIn('repo-a', 'src/a.ts').entityId}#CX-a-1`, NOW);
    const binding = store.bindRepository('repo-b');
    expect(store.workItems).toEqual([]);
    expect(store.rules).toEqual([]);
    expect(store.dispositions).toEqual([]);
    await binding;
    expect(store.workItemCount).toBe(0);
  });

  it('keeps each codebase\'s items, rules, decisions and id counters apart, and restores them on the way back', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    await store.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A1', NOW);
    const a2 = await store.addWorkItem(fileIn('repo-a', 'src/b.ts'), 'refactor', 'A2', NOW);
    // wi-2 is removed, but its id stays spent: the repository's high-water mark remembers it (Part 6 Y10).
    expect(await store.removeWorkItem(a2!.id)).toBe(true);
    await store.addRule('ui', 'domain', 'Layering', NOW);
    await store.acknowledge('fp-a', NOW);

    await store.bindRepository('repo-b');
    expect((await store.addWorkItem(fileIn('repo-b', 'src/a.ts'), 'refactor', 'B1', NOW))?.id).toBe('wi-1');
    expect((await store.addRule('ui', 'domain', 'B rule', NOW))?.id).toBe('AR-001');
    expect(store.workItems.map((w) => w.title)).toEqual(['B1']);

    await store.bindRepository('repo-a');
    expect(store.workItems.map((w) => w.title)).toEqual(['A1']);
    expect(store.rules.map((r) => r.rationale)).toEqual(['Layering']);
    expect(store.dispositions.map((d) => d.fingerprint)).toEqual(['fp-a']);
    expect((await store.addWorkItem(fileIn('repo-a', 'src/c.ts'), 'refactor', 'A3', NOW))?.id).toBe('wi-3');
    expect((await store.addRule('ui', 'api', 'Second', NOW))?.id).toBe('AR-002');
  });

  it('keeps a save that settles after a switch in its own codebase: it is returned, never shown in the other one', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    const repoA = createInMemoryReviewRepository();
    const gate = deferred();
    store.setRepository({ ...repoA, saveWorkItem: async (item) => { await gate.promise; await repoA.saveWorkItem(item); } });
    const adding = store.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A1', NOW);
    await store.bindRepository('repo-b');
    gate.resolve();
    const item = await adding;
    expect(item?.title).toBe('A1');
    expect(store.workItems).toEqual([]);
    expect((await repoA.listWorkItems()).map((w) => w.title)).toEqual(['A1']);
    await store.bindRepository('repo-a');
    expect(store.workItems.map((w) => w.title)).toEqual(['A1']);
  });

  it('never lets an update or a removal that settles after a switch touch the other codebase\'s item with the same id', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    await store.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A1', NOW);
    await store.addWorkItem(fileIn('repo-a', 'src/b.ts'), 'refactor', 'A2', NOW);
    const repoA = store.repository;
    const gate = deferred();
    store.setRepository({
      ...repoA,
      saveWorkItem: async (item) => { await gate.promise; await repoA.saveWorkItem(item); },
      removeWorkItem: async (id) => { await gate.promise; await repoA.removeWorkItem(id); },
    });
    const updating = store.updateWorkItem('wi-1', { title: 'A1 renamed' }, NOW);
    const removing = store.removeWorkItem('wi-2');
    await store.bindRepository('repo-b');
    await store.addWorkItem(fileIn('repo-b', 'src/a.ts'), 'refactor', 'B1', NOW);
    await store.addWorkItem(fileIn('repo-b', 'src/b.ts'), 'refactor', 'B2', NOW);
    expect(store.workItems.map((w) => w.id)).toEqual(['wi-1', 'wi-2']);
    gate.resolve();
    expect((await updating)?.title).toBe('A1 renamed');
    expect(await removing).toBe(true);
    expect(store.workItems.map((w) => w.title)).toEqual(['B1', 'B2']);
    await store.bindRepository('repo-a');
    expect(store.workItems.map((w) => w.title)).toEqual(['A1 renamed']);
  });

  it('a load that settles after a switch never fills the new codebase with the old one\'s data', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    const repoA = createInMemoryReviewRepository();
    await repoA.saveWorkItem({
      id: 'wi-1', target: fileIn('repo-a', 'src/a.ts'), intent: 'refactor', title: 'A1', status: 'planned',
      priority: 'medium', notes: '', checks: NO_CHECKS, createdAt: NOW.toISOString(),
    });
    const gate = deferred();
    store.setRepository({ ...repoA, listWorkItems: async () => { await gate.promise; return repoA.listWorkItems(); } });
    const loading = store.load();
    await store.bindRepository('repo-b');
    gate.resolve();
    await loading;
    expect(store.workItems).toEqual([]);
  });

  it('binding the bound codebase again is a no-op: nothing is emptied or reloaded', async () => {
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    const repo = createInMemoryReviewRepository();
    let lists = 0;
    store.setRepository({ ...repo, listWorkItems: () => { lists += 1; return repo.listWorkItems(); } });
    await store.addWorkItem(fileIn('repo-a', 'src/a.ts'), 'refactor', 'A1', NOW);
    await store.bindRepository('repo-a');
    expect(lists).toBe(0);
    expect(store.workItems.map((w) => w.title)).toEqual(['A1']);
  });

  it('the Architecture memo (keyed by the raw rules array) follows the switch both ways', async () => {
    const files = fileSummariesFor(buildSnapshotFixture({ files: 6, directories: 2, repositoryId: 'repo-a' }));
    const graph = architectureGraphFor(files, relationModelFor(files, evidenceIndexFor(files, null, 'repo-a')));
    const store = useReviewStore();
    await store.bindRepository('repo-a');
    await store.addRule('dir-0', 'dir-1', 'Layering', NOW);
    expect(architectureModelFor(graph, store.rules).rules).toHaveLength(1);
    await store.bindRepository('repo-b');
    expect(architectureModelFor(graph, store.rules).rules).toHaveLength(0);
    await store.bindRepository('repo-a');
    expect(architectureModelFor(graph, store.rules).rules).toHaveLength(1);
  });
});
