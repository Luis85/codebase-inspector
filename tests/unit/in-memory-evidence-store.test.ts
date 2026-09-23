// Part 6 Y28: session-only evidence, one report per codebase, shared by every leaf.
import { describe, expect, it, vi } from 'vitest';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { emptyEvidenceReport } from '../fixtures/evidence-report';

describe('InMemoryEvidenceStore (Part 6 Y28)', () => {
  it('holds one report per codebase and hands back the stored object itself', () => {
    const store = new InMemoryEvidenceStore();
    const a = emptyEvidenceReport('s1', 'a.json');
    const b = emptyEvidenceReport('s1', 'b.json');
    expect(store.get('p1')).toBeNull();
    store.put('p1', a);
    store.put('p2', b);
    expect(store.get('p1')).toBe(a);
    expect(store.get('p2')).toBe(b);
    const replacement = emptyEvidenceReport('s2', 'c.json');
    store.put('p1', replacement);
    expect(store.get('p1')).toBe(replacement);
    store.remove('p1');
    expect(store.get('p1')).toBeNull();
    expect(store.get('p2')).toBe(b);
  });

  it('notifies every subscriber with the codebase after a put and a remove; removing nothing notifies nobody', () => {
    const store = new InMemoryEvidenceStore();
    const first = vi.fn();
    const second = vi.fn();
    store.subscribe(first);
    store.subscribe(second);
    store.put('p1', emptyEvidenceReport('s1'));
    store.remove('p1');
    store.remove('p1');
    store.remove('never-attached');
    expect(first.mock.calls).toEqual([['p1'], ['p1']]);
    expect(second.mock.calls).toEqual([['p1'], ['p1']]);
  });

  it('unsubscribing stops notifications, and the same listener subscribed twice unsubscribes independently', () => {
    const store = new InMemoryEvidenceStore();
    const listener = vi.fn();
    const offFirst = store.subscribe(listener);
    const offSecond = store.subscribe(listener);
    store.put('p1', emptyEvidenceReport('s1'));
    expect(listener).toHaveBeenCalledTimes(2);
    offFirst();
    store.put('p1', emptyEvidenceReport('s2'));
    expect(listener).toHaveBeenCalledTimes(3);
    offSecond();
    offSecond();
    store.put('p1', emptyEvidenceReport('s3'));
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('a listener that unsubscribes while being notified never makes another one miss it', () => {
    const store = new InMemoryEvidenceStore();
    const later = vi.fn();
    const off = store.subscribe(() => { off(); });
    store.subscribe(later);
    store.put('p1', emptyEvidenceReport('s1'));
    expect(later).toHaveBeenCalledWith('p1');
  });
});
