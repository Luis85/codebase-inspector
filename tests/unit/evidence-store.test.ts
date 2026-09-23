// Part 6 Y29 (ruling R7): the leaf's evidence store mirrors the shared repository's entry
// for the bound codebase, and never keeps a copy of its own that could diverge from the port.
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { isReactive } from 'vue';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import type { EvidenceRepository } from '../../src/application/ports/evidence-repository';
import { emptyEvidenceReport } from '../fixtures/evidence-report';

/** A shared repository that counts its live subscriptions. */
function counting(): { repository: EvidenceRepository; live: () => number } {
  const inner = new InMemoryEvidenceStore();
  let live = 0;
  const repository: EvidenceRepository = {
    get: (id) => inner.get(id),
    put: (id, report) => { inner.put(id, report); },
    remove: (id) => { inner.remove(id); },
    subscribe: (listener) => {
      live += 1;
      const off = inner.subscribe(listener);
      let done = false;
      return () => { if (done) return; done = true; live -= 1; off(); };
    },
  };
  return { repository, live: () => live };
}

/** One leaf: its own Pinia, wired to the shared repository, optionally bound. */
function leaf(repository: EvidenceRepository, id?: string): ReturnType<typeof useEvidenceStore> {
  const store = useEvidenceStore(createPinia());
  store.setRepository(repository);
  if (id !== undefined) store.bindRepository(id);
  return store;
}

describe('evidence store (Part 6 Y29, R7)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('refuses to attach or remove while unbound or without a repository, and reads null', () => {
    const noRepository = useEvidenceStore();
    noRepository.bindRepository('p1');
    expect(noRepository.attach(emptyEvidenceReport('s1'))).toBe(false);
    expect(noRepository.report).toBeNull();
    const repository = new InMemoryEvidenceStore();
    const unbound = leaf(repository);
    expect(unbound.repositoryId).toBe('');
    expect(unbound.attach(emptyEvidenceReport('s1'))).toBe(false);
    expect(unbound.remove()).toBe(false);
    expect(repository.get('')).toBeNull();
  });

  it('attach goes through the port, and the store shows the port\'s own object, never a reactive copy', () => {
    const repository = new InMemoryEvidenceStore();
    const store = leaf(repository, 'p1');
    const report = emptyEvidenceReport('s1');
    expect(store.attach(report)).toBe(true);
    expect(repository.get('p1')).toBe(report);
    expect(store.report).toBe(report);
    expect(isReactive(store.report)).toBe(false);
  });

  it('remove goes through the port; with nothing attached it is refused (E17: nothing to announce)', () => {
    const repository = new InMemoryEvidenceStore();
    const store = leaf(repository, 'p1');
    expect(store.remove()).toBe(false);
    store.attach(emptyEvidenceReport('s1'));
    expect(store.remove()).toBe(true);
    expect(repository.get('p1')).toBeNull();
    expect(store.report).toBeNull();
  });

  it('an import in one leaf shows in every leaf bound to the same codebase, and in no other', () => {
    const repository = new InMemoryEvidenceStore();
    const a = leaf(repository, 'p1');
    const b = leaf(repository, 'p1');
    const c = leaf(repository, 'p2');
    const report = emptyEvidenceReport('s1');
    expect(a.attach(report)).toBe(true);
    expect(b.report).toBe(report);
    expect(c.report).toBeNull();
    expect(b.remove()).toBe(true);
    expect(a.report).toBeNull();
  });

  it('a switch reads the new codebase\'s entry at once and drops a pending import request; switching back restores the old entry', () => {
    const repository = new InMemoryEvidenceStore();
    const forP1 = emptyEvidenceReport('s1', 'p1.json');
    repository.put('p1', forP1);
    const store = leaf(repository, 'p1');
    expect(store.report).toBe(forP1);
    store.requestImport();
    store.bindRepository('p1');
    expect(store.importRequested).toBe(true);
    store.bindRepository('p2');
    expect(store.report).toBeNull();
    expect(store.importRequested).toBe(false);
    store.bindRepository('p1');
    expect(store.report).toBe(forP1);
  });

  it('listens to the bound codebase only: one live subscription per leaf, replaced on every rebind', () => {
    const { repository, live } = counting();
    const store = leaf(repository);
    expect(live()).toBe(0);
    store.bindRepository('p1');
    expect(live()).toBe(1);
    store.bindRepository('p2');
    expect(live()).toBe(1);
    repository.put('p1', emptyEvidenceReport('s1'));
    expect(store.report).toBeNull();
    const forP2 = emptyEvidenceReport('s1', 'p2.json');
    repository.put('p2', forP2);
    expect(store.report).toBe(forP2);
  });

  it('$dispose drops the subscription on the shared repository', () => {
    const { repository, live } = counting();
    const store = leaf(repository, 'p1');
    expect(live()).toBe(1);
    store.$dispose();
    expect(live()).toBe(0);
    expect(() => { repository.put('p1', emptyEvidenceReport('s1')); }).not.toThrow();
  });

  it('an import request is consumed exactly once', () => {
    const store = leaf(new InMemoryEvidenceStore(), 'p1');
    expect(store.consumeImportRequest()).toBe(false);
    store.requestImport();
    expect(store.importRequested).toBe(true);
    expect(store.consumeImportRequest()).toBe(true);
    expect(store.consumeImportRequest()).toBe(false);
    expect(store.importRequested).toBe(false);
  });
});
