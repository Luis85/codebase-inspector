import type { Plugin } from 'obsidian';
import { asUnknownArray } from '../../domain/plain-data';

/** Obsidian gives a plugin exactly one JSON document (plugin.loadData()/saveData()),
 *  but spec 4.5 lists ProfileStore and LocalBindingStore as two separate application
 *  ports. Every read/write from either store goes through here. Part 6 Y5 (amending
 *  Part 4 W1) adds `reviews`, `{ [repositoryId]: record set }`, owned by the durable
 *  review adapter (plugin-data-review-repository.ts) and written under the same lock.
 *  Part 7 Z1 adds `analyzers`, `{ [profileId]: fallow executable record }`, owned by
 *  plugin-data-analyzer-store.ts, under the same lock. WP-04 Task 8 (IN18, IN19) adds
 *  `investigations`, `{ [profileId]: { folder } }`, owned by
 *  plugin-data-investigation-store.ts, under the same lock. */
export interface PluginDataShape {
  profiles?: unknown;
  bindings?: unknown;
  reviews?: unknown;
  analyzers?: unknown;
  investigations?: unknown;
}

// Fix round 1, Critical 1: one promise chain per Plugin instance. There is exactly one
// CodebaseInspectorPlugin instance per running plugin, and src/main.ts constructs every
// store this module backs with that SAME instance, so keying on `plugin` here correctly
// serialises BOTH stores against each other, not just each store against itself.
const dataLocks = new WeakMap<Plugin, Promise<void>>();

/** Runs `fn` (a full read-modify-write cycle against plugin.loadData()/saveData())
 *  exclusively with respect to every other call made through this function for the SAME
 *  plugin instance.
 *
 *  Without this, two calls that each do their own loadData -> mutate -> saveData can
 *  interleave whenever there is no `await` between the *callers* issuing them (which is
 *  exactly what two near-simultaneous settings-tab events produce): both read the same
 *  starting document, each computes its own result from that now-stale snapshot, and
 *  whichever saveData() call lands second silently discards everything the first one
 *  wrote. This was reproduced against the previous version of this file (fix round 1,
 *  Critical 1) -- two unawaited store.save() calls made one profile vanish outright, and
 *  two overlapping get-then-save calls on the SAME profile (settings-tab.ts's old
 *  updateProfile() pattern) silently discarded one edit. Real loadData()/saveData() do
 *  disk I/O with real latency, so this window is wide open in practice, not a
 *  theoretical race.
 *
 *  Every exported function below acquires this SAME lock for the WHOLE read-mutate-
 *  write cycle (not just the write), so a second operation can only ever start once the
 *  first one's save has completed and it can read the up-to-date document. */
function withDataLock<T>(plugin: Plugin, fn: () => Promise<T>): Promise<T> {
  const previous = dataLocks.get(plugin) ?? Promise.resolve();
  const result = previous.then(fn, fn);
  // Swallow the outcome for the NEXT waiter's sake only -- one failed operation must
  // never permanently jam the queue for unrelated later operations. The caller of
  // THIS specific call still receives fn's real result or rejection via `result`.
  dataLocks.set(plugin, result.then(() => undefined, () => undefined));
  return result;
}

export async function readPluginData(plugin: Plugin): Promise<PluginDataShape> {
  return withDataLock(plugin, async () => {
    const data = (await plugin.loadData()) as PluginDataShape | null | undefined;
    return data ?? {};
  });
}

/** Replaces `key`'s slice with what `mutate` returns, under the data lock.
 *
 *  Polish E7 (L17): when `mutate` returns its input (the SAME reference), nothing changed and
 *  nothing is saved. So `mutate` must never change its input in place: an in-place edit that
 *  returns the same object would be silently dropped. Build and return a new value instead. */
export async function writePluginDataSlice(
  plugin: Plugin,
  key: keyof PluginDataShape,
  mutate: (current: unknown) => unknown,
): Promise<void> {
  await withDataLock(plugin, async () => {
    const data = (await plugin.loadData()) as PluginDataShape | null | undefined;
    const shape = data ?? {};
    const next = mutate(shape[key]);
    // Polish E7: a mutation that changed nothing (returned its input) is not written.
    if (next === shape[key]) return;
    shape[key] = next;
    await plugin.saveData(shape);
  });
}

/** Atomically reads the CURRENT record matching `id` in `field` under `key`, applies
 *  `mutate` to it, and writes the result back -- as ONE indivisible operation under the
 *  SAME lock the two functions above use. This is what makes a caller's own
 *  "read, then later write a full object" pattern safe: `mutate` receives the record AS
 *  IT EXISTS AT WRITE TIME (after waiting for the lock), never a snapshot taken before
 *  the lock was acquired, so a second update() landing in between cannot be silently
 *  overwritten by a first one that started earlier but read a now-stale value (Critical
 *  1's second reproduction). Returns false, and does nothing, if no record matches. */
export async function updatePluginDataRecord(
  plugin: Plugin,
  key: keyof PluginDataShape,
  field: string,
  id: string,
  mutate: (current: unknown) => unknown,
): Promise<boolean> {
  return withDataLock(plugin, async () => {
    const data = (await plugin.loadData()) as PluginDataShape | null | undefined;
    const shape = data ?? {};
    const list = asUnknownArray(shape[key]);
    const index = list.findIndex((entry) => isRecordWithField(entry, field, id));
    if (index === -1) return false;
    const updated = [...list];
    updated[index] = mutate(list[index]);
    shape[key] = updated;
    await plugin.saveData(shape);
    return true;
  });
}

/** Shared list-lookup used by both stores: their records are plain JSON objects at
 *  this layer (validated by the domain schema before ever reaching a typed value), so
 *  matching by id is a structural `unknown` check, not a cast. */
export function isRecordWithField(value: unknown, field: string, id: string): boolean {
  return typeof value === 'object' && value !== null && (value as Record<string, unknown>)[field] === id;
}
