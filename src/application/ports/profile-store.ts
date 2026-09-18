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
}
