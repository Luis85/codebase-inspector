// Part 6 Y11/Y14/Y17: one durable review repository per codebase per plugin, and the purge
// that takes a removed profile's saved review state with it.
import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import type { Plugin as ObsidianPlugin } from 'obsidian';
import { Plugin } from '../mocks/obsidian';
import { createReviewRepositoryRegistry } from '../../src/adapters/storage/review-repository-registry';
import { ReviewStoreError } from '../../src/adapters/storage/plugin-data-review-repository';
import type { BoundaryRule } from '../../src/ui/stores/ports/review-repository';

const AT = '2026-09-23T10:00:00.000Z';
const rule = (id: string, to: string): BoundaryRule => ({ id, from: 'ui', to, rationale: 'Layering', createdAt: AT });
const newPlugin = (): ObsidianPlugin => new Plugin({}, {}) as unknown as ObsidianPlugin;
const readDoc = (plugin: ObsidianPlugin): Promise<unknown> => plugin.loadData() as Promise<unknown>;

describe('review repository registry (Part 6 Y11, Y14)', () => {
  it('returns one instance per codebase, so every user shares one id sequence', async () => {
    const registry = createReviewRepositoryRegistry(newPlugin());
    expect(registry.for('p1')).toBe(registry.for('p1'));
    expect(registry.for('p1')).not.toBe(registry.for('p2'));
    await registry.for('p1').listRules();
    expect(registry.for('p1').allocateId('rule')).toBe('AR-001');
    expect(registry.for('p1').allocateId('rule')).toBe('AR-002');
  });

  it('never persists the unbound bucket', async () => {
    const plugin = newPlugin();
    await createReviewRepositoryRegistry(plugin).for('').saveRule(rule('AR-001', 'domain'));
    expect(await readDoc(plugin)).toBeNull();
  });
});

describe('review repository registry: purge (Part 6 Y17)', () => {
  it('deletes only that codebase\'s set, after any write already queued, and leaves every other key as it was', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ profiles: [{ profileId: 'p2' }], reviews: { p1: { v: 1 }, p2: { v: 1, rules: [] } } });
    const registry = createReviewRepositoryRegistry(plugin);
    await registry.for('p1').saveRule(rule('AR-001', 'domain'));
    const queued = registry.for('p1').saveRule(rule('AR-002', 'host'));
    await registry.purge('p1');
    await queued;
    expect(await readDoc(plugin)).toEqual({ profiles: [{ profileId: 'p2' }], reviews: { p2: { v: 1, rules: [] } } });
  });

  it('retires the old instance: a leaf still bound to the removed codebase cannot recreate it, and reloads empty', async () => {
    const plugin = newPlugin();
    const registry = createReviewRepositoryRegistry(plugin);
    const old = registry.for('p1');
    await old.saveRule(rule('AR-001', 'domain'));
    const reloaded: number[] = [];
    old.subscribe(() => { void old.listRules().then((rules) => { reloaded.push(rules.length); }); });
    await registry.purge('p1');
    await flushPromises();
    expect(reloaded).toEqual([0]);
    const refused: unknown = await old.saveRule(rule('AR-002', 'host')).then(() => null, (e: unknown) => e);
    expect(refused).toBeInstanceOf(ReviewStoreError);
    expect((refused as ReviewStoreError).code).toBe('unsupported');
    expect(await readDoc(plugin)).toEqual({ reviews: {} });
    const fresh = registry.for('p1');
    expect(fresh).not.toBe(old);
    await fresh.saveRule(rule('AR-001', 'domain'));
    expect(await fresh.listRules()).toEqual([rule('AR-001', 'domain')]);
  });

  it('leaves a reviews value it cannot read untouched, and resolves when there is nothing to purge', async () => {
    const plugin = newPlugin();
    await plugin.saveData({ reviews: 'not an object' });
    await createReviewRepositoryRegistry(plugin).purge('p1');
    expect(await readDoc(plugin)).toEqual({ reviews: 'not an object' });
    const empty = newPlugin();
    await createReviewRepositoryRegistry(empty).purge('p1');
    expect(await readDoc(empty)).toEqual({});
  });
});
