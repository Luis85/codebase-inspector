import type { App, Plugin } from 'obsidian';
import type { LocalBindingStore } from '../../application/ports/local-binding-store';
import type { LocalBinding } from '../../domain/model';
import { validateLocalBinding } from '../../domain/validator';
import { asUnknownArray, isRecordWithField, readPluginData, writePluginDataSlice } from './plugin-data-shape';

const MACHINE_ID_KEY = 'codebase-inspector:machine-id';

/** A vault-local, per-machine identifier, persisted through App.loadLocalStorage /
 *  saveLocalStorage (obsidian.d.ts, `@since 1.8.7` -- well under this plugin's
 *  minAppVersion of 1.13.0). Storing it inside data.json instead would defeat its
 *  entire purpose: data.json is exactly what Obsidian Sync copies, so a "local machine
 *  id" kept there would travel to every synced machine along with it, and every
 *  machine would agree on the same id -- which is why this uses localStorage instead.
 *
 *  INFERRED, and therefore a risk rather than a fact (spec 11's own register for this
 *  kind of gap; fix round 1, Important 3). obsidian.d.ts documents loadLocalStorage /
 *  saveLocalStorage only as "Retrieve/save value from/to localStorage for this vault"
 *  (obsidian.d.ts:467-480) -- nothing about Obsidian Sync's scope. docs.obsidian.md's
 *  own reference page for loadLocalStorage carries the identical one-line description,
 *  and its "Store secrets" guide (docs.obsidian.md/plugins/guides/secret-storage) says
 *  only that a secret "is stored in local storage, keyed to the specific vault" --
 *  again without addressing sync scope. The closest obsidianmd-owned support found is
 *  obsidian-help's own Sync documentation (github.com/obsidianmd/obsidian-help,
 *  "Obsidian Sync/Local and remote vaults.md"): "Obsidian Sync tracks changes at the
 *  file level and only transfers the files that have been modified" -- localStorage is
 *  not a vault file, which supports but does not explicitly state that it is excluded.
 *  No obsidianmd-owned source was found that settles this outright (checked 2026-09-18).
 *
 *  What breaks if this inference is wrong: if Sync DOES carry this value, a rootPath
 *  recorded on machine A would read as machineId-matching on machine B, so get() would
 *  report the binding AVAILABLE there instead of missing -- COPY-28 would never show,
 *  and a later task would attempt to scan a path that does not exist on that machine,
 *  instead of surfacing the reconnect prompt this whole mechanism exists to produce.
 *  This is carried into task 13's limitations regardless of how this round resolves. */
export function getOrCreateMachineId(app: App): string {
  const existing: unknown = app.loadLocalStorage(MACHINE_ID_KEY);
  if (typeof existing === 'string' && existing.length > 0) return existing;
  const created = crypto.randomUUID();
  app.saveLocalStorage(MACHINE_ID_KEY, created);
  return created;
}

/** plugin.loadData()/saveData()-backed LocalBindingStore. A binding recorded on a
 *  different machine (a data.json copied in by Obsidian Sync) is well-formed but
 *  unusable here -- get() reports it exactly like "no binding at all" (COPY-28 covers
 *  the UI-visible distinction, using the still-present bindingId to say why). */
export class PluginDataBindingStore implements LocalBindingStore {
  constructor(private readonly plugin: Plugin, private readonly currentMachineId: string) {}

  async get(bindingId: string): Promise<LocalBinding | null> {
    const data = await readPluginData(this.plugin);
    const raw = asUnknownArray(data.bindings);
    const found = raw.find((entry) => isRecordWithField(entry, 'bindingId', bindingId));
    if (found === undefined) return null;
    const binding = validateLocalBinding(found);
    if (binding.machineId !== this.currentMachineId) return null;
    return binding;
  }

  async save(binding: LocalBinding): Promise<void> {
    // The machineId is never caller-supplied data -- this store always stamps the
    // machine actually doing the saving, exactly like a ProviderRun's provenance is
    // never read from a payload (spec 4.1). Validated AFTER stamping, so a malformed
    // caller-supplied machineId can never silently survive the stamp.
    const stamped = validateLocalBinding({ ...binding, machineId: this.currentMachineId });
    await writePluginDataSlice(this.plugin, 'bindings', (current) => {
      const list = asUnknownArray(current).filter(
        (entry) => !isRecordWithField(entry, 'bindingId', stamped.bindingId));
      list.push(stamped);
      return list;
    });
  }

  async clear(bindingId: string): Promise<void> {
    await writePluginDataSlice(this.plugin, 'bindings', (current) =>
      asUnknownArray(current).filter((entry) => !isRecordWithField(entry, 'bindingId', bindingId)));
  }
}
