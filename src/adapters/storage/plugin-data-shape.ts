import type { Plugin } from 'obsidian';

/** Obsidian gives a plugin exactly one JSON document (plugin.loadData()/saveData()),
 *  but spec 4.5 lists ProfileStore and LocalBindingStore as two separate application
 *  ports. Every read/write from either store goes through here so neither ever clobbers
 *  the other's slice of data.json with a stale read-modify-write. */
export interface PluginDataShape {
  profiles?: unknown;
  bindings?: unknown;
}

export async function readPluginData(plugin: Plugin): Promise<PluginDataShape> {
  const data = (await plugin.loadData()) as PluginDataShape | null | undefined;
  return data ?? {};
}

export async function writePluginDataSlice(
  plugin: Plugin,
  key: keyof PluginDataShape,
  mutate: (current: unknown) => unknown,
): Promise<void> {
  const data = await readPluginData(plugin);
  data[key] = mutate(data[key]);
  await plugin.saveData(data);
}

/** Shared list-lookup used by both stores: their records are plain JSON objects at
 *  this layer (validated by the domain schema before ever reaching a typed value), so
 *  matching by id is a structural `unknown` check, not a cast. */
export function isRecordWithField(value: unknown, field: string, id: string): boolean {
  return typeof value === 'object' && value !== null && (value as Record<string, unknown>)[field] === id;
}

/** `Array.isArray` narrows to `any[]` even from an `unknown` input (a long-standing
 *  lib.es5 typing quirk), which would leak `any` through every list operation built on
 *  top of it. This gives the narrowed branch an explicit `unknown[]` type instead. */
export function asUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}
