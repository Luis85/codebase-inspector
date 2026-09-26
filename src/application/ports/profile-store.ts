import type { CodebaseProfile } from '../../domain/model';

/** Persists CodebaseProfile records. A profile never carries a resolved path of its
 *  own — only a `bindingId` — so this store never touches the filesystem (task-6 brief
 *  "Interfaces"). Every read validates, because the backing store (plugin.loadData(),
 *  i.e. data.json) is user-editable, untrusted input (spec 4.1). */
export interface ProfileStore {
  list(): Promise<readonly CodebaseProfile[]>;
  get(id: string): Promise<CodebaseProfile | null>;
  save(profile: CodebaseProfile): Promise<void>;
  remove(id: string): Promise<void>;
  /** Atomically reads the CURRENT profile for `id` (if any) and writes back `mutate`'s
   *  result, as one indivisible operation with respect to every other call touching
   *  this document. Unlike `get()` then `save()` — which can interleave with a
   *  concurrent mutation and silently discard one side, because `mutate` would be
   *  applied to a snapshot that is stale by the time `save()` runs — `mutate` here
   *  always receives the value as it exists at write time. Does nothing if `id` does
   *  not exist. Fix round 1, Critical 1: a settings tab that reads a profile and only
   *  later saves the full result back needs exactly this, not `get()`+`save()`. */
  update(id: string, mutate: (current: CodebaseProfile) => CodebaseProfile): Promise<void>;
}
