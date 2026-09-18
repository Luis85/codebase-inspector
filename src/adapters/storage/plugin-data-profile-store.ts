import type { Plugin } from 'obsidian';
import type { ProfileStore } from '../../application/ports/profile-store';
import type { CodebaseProfile } from '../../domain/model';
import { validateCodebaseProfile } from '../../domain/validator';
import { asUnknownArray, isRecordWithField, readPluginData, updatePluginDataRecord, writePluginDataSlice } from './plugin-data-shape';

/** plugin.loadData()/saveData()-backed ProfileStore. data.json is user-editable, so
 *  EVERY read validates (spec 4.1) -- list()/get() never cast a raw record, and save()
 *  validates too, so an invalid profile is never persisted in the first place. */
export class PluginDataProfileStore implements ProfileStore {
  constructor(private readonly plugin: Plugin) {}

  async list(): Promise<readonly CodebaseProfile[]> {
    const data = await readPluginData(this.plugin);
    const raw = asUnknownArray(data.profiles);
    return raw.map((entry) => validateCodebaseProfile(entry));
  }

  async get(id: string): Promise<CodebaseProfile | null> {
    const data = await readPluginData(this.plugin);
    const raw = asUnknownArray(data.profiles);
    const found = raw.find((entry) => isRecordWithField(entry, 'profileId', id));
    return found === undefined ? null : validateCodebaseProfile(found);
  }

  async save(profile: CodebaseProfile): Promise<void> {
    const validated = validateCodebaseProfile(profile);
    await writePluginDataSlice(this.plugin, 'profiles', (current) => {
      const list = asUnknownArray(current).filter(
        (entry) => !isRecordWithField(entry, 'profileId', validated.profileId));
      list.push(validated);
      return list;
    });
  }

  async remove(id: string): Promise<void> {
    await writePluginDataSlice(this.plugin, 'profiles', (current) =>
      asUnknownArray(current).filter((entry) => !isRecordWithField(entry, 'profileId', id)));
  }

  async update(id: string, mutate: (current: CodebaseProfile) => CodebaseProfile): Promise<void> {
    await updatePluginDataRecord(this.plugin, 'profiles', 'profileId', id, (current) =>
      validateCodebaseProfile(mutate(validateCodebaseProfile(current))));
  }
}
