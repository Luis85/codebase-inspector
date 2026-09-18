import type { LocalBinding } from '../../domain/model';

/** Persists LocalBinding records — the resolved rootPath and the machineId that
 *  recorded it. `get()` returns null both when no such binding exists AND when the
 *  stored binding's machineId does not match the machine running right now (a profile
 *  synced to another machine via Obsidian Sync copies data.json but not the local
 *  filesystem — spec 4.1/4.4, COPY-28), so a caller cannot tell the two cases apart
 *  from this interface alone, by design: both mean "there is no usable local root for
 *  this bindingId right now." */
export interface LocalBindingStore {
  get(bindingId: string): Promise<LocalBinding | null>;
  save(binding: LocalBinding): Promise<void>;
  clear(bindingId: string): Promise<void>;
}
