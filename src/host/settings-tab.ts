// Verification decision (docs/superpowers/notes/2026-09-17-setting-definitions-
// verification.md): FULL DECLARATIVE. This class's entire rendered surface comes from
// getSettingDefinitions() below; no display() override exists (minAppVersion is already
// 1.13.0, so an unreachable pre-1.13 fallback would be dead code). No
// obsidianmd/prefer-setting-definitions disable is used anywhere in this file: a real,
// non-trivial getSettingDefinitions() already satisfies the rule (see the verification
// document's answer to question C).
import { PluginSettingTab } from 'obsidian';
import type { App, Plugin, SettingDefinitionItem } from 'obsidian';
import type { ProfileStore } from '../application/ports/profile-store';
import type { LocalBindingStore } from '../application/ports/local-binding-store';
import type { SourceFileSystemPort } from '../application/ports/source-filesystem-port';
import type { CodebaseProfile } from '../domain/model';
import { buildSettingDefinitions } from './setting-definitions';
import type { ProfileEntry } from './setting-definitions';
import { ClearBindingModal } from './modals/clear-binding-modal';
import { openSourceModal } from './modals/source-modal';
import { createDefaultProfile } from './scan-flow';

function parseExclusions(rawLines: string): string[] {
  return rawLines.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
}

export class CodebaseInspectorSettingTab extends PluginSettingTab {
  private entries: ProfileEntry[] = [];
  // Fix round 1, Important 4: test-only convenience so a test that fires two
  // overlapping edits (e.g. a rename and an exclusions change on the same profile)
  // has a deterministic way to know both have settled, without depending on timing.
  // Production code never reads this -- refresh()/update() already run at the end of
  // every mutation below.
  private pendingUpdates: Promise<void>[] = [];

  constructor(
    app: App,
    plugin: Plugin,
    private readonly profileStore: ProfileStore,
    private readonly bindingStore: LocalBindingStore,
    // A FACTORY, not an already-built port: onload() registers only (spec 4.4), and
    // building the real Node-backed port eagerly would touch window.require at
    // construction time. Deferring construction to the moment Connect/Reconnect is
    // actually clicked keeps onload() free of it entirely -- see main.ts's call site.
    private readonly getFilesystem: () => SourceFileSystemPort,
  ) {
    super(app, plugin);
  }

  /** Loads every saved profile and resolves each one's binding. Public so a test can
   *  await it directly instead of guessing when async loading has settled; production
   *  callers (every mutation below) await the same method before re-rendering. */
  async refresh(): Promise<void> {
    const profiles = await this.profileStore.list();
    const entries: ProfileEntry[] = [];
    for (const profile of profiles) {
      const binding = profile.bindingId === null ? null : await this.bindingStore.get(profile.bindingId);
      entries.push({ profile, binding });
    }
    this.entries = entries;
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    return buildSettingDefinitions(this.entries, {
      onAddProfile: () => { void this.addProfile(); },
      onDeleteProfile: (id) => { void this.deleteProfile(id); },
      onRenameProfile: (id, name) => { this.trackUpdate(this.updateProfile(id, (p) => ({ ...p, name }))); },
      onExclusionsChange: (id, raw) => {
        this.trackUpdate(this.updateProfile(id, (p) => ({ ...p, exclusions: parseExclusions(raw) })));
      },
      onMaxFileBytesChange: (id, raw) => {
        this.trackUpdate(this.updateProfile(id, (p) => ({ ...p, maxFileBytes: Number(raw) })));
      },
      onReconnect: (id) => { this.reconnect(id); },
      onClearBinding: (id) => { this.confirmClearBinding(id); },
    });
  }

  private trackUpdate(pending: Promise<void>): void {
    this.pendingUpdates.push(pending);
    void pending.finally(() => {
      this.pendingUpdates = this.pendingUpdates.filter((p) => p !== pending);
    });
  }

  /** Test-only: resolves once every update triggered so far (including any fired
   *  after this call started, up until they all drain) has settled. See
   *  `pendingUpdates`'s comment above for why production code never needs this. */
  async waitForPendingUpdates(): Promise<void> {
    while (this.pendingUpdates.length > 0) {
      await Promise.allSettled(this.pendingUpdates);
    }
  }

  private async addProfile(): Promise<void> {
    // Ruling M44 (fix round 3): the SAME default-exclusions function scan-flow.ts's
    // resolveOrCreateProfile uses, so this path and the auto-created-from-a-scan path
    // cannot drift apart. `this.app.vault.configDir` is the real vault config directory
    // -- never a literal '.obsidian' (hardcoded-config-path is a protected rule).
    const profile = createDefaultProfile(this.app.vault.configDir);
    await this.profileStore.save(profile);
    await this.refresh();
    this.update();
  }

  private async deleteProfile(id: string): Promise<void> {
    await this.profileStore.remove(id);
    await this.refresh();
    this.update();
  }

  private async updateProfile(id: string, mutate: (profile: CodebaseProfile) => CodebaseProfile): Promise<void> {
    // Fix round 1, Critical 1: this used to be `get(id)` then, much later, `save()` a
    // full object built from that now-possibly-stale read -- exactly the shape that
    // let two overlapping edits on the same profile silently discard one of them.
    // ProfileStore.update() performs the read, the mutation and the write as ONE
    // indivisible operation, so `mutate` is always applied to the current value.
    try {
      await this.profileStore.update(id, mutate);
    } catch {
      // An invalid edit (e.g. maxFileBytes not a positive integer) is rejected by the
      // store's own validation and simply not persisted -- never silently coerced
      // (spec 4.1). The unedited value is re-read back into entries on the next line.
    }
    await this.refresh();
    this.update();
  }

  // Ruling M30: task 7 owns wiring Connect/Reconnect to the real source-selection
  // modal task 6 deliberately left as a placeholder (ruling M26's fix round put an
  // honest interim Notice here; this replaces it, not supplements it).
  private reconnect(profileId: string): void {
    const entry = this.entries.find((e) => e.profile.profileId === profileId);
    if (!entry) return;
    this.trackUpdate(this.performReconnect(profileId, entry.profile));
  }

  // Task-7-context.md section 9's trap: this is the FIRST caller of
  // LocalBindingStore.save() in this codebase, and LocalBindingStore deliberately has
  // no atomic update() (task 6 never needed one). This is NOT a get()-then-save()
  // race: `binding` below is built entirely from data already in hand (the profile
  // entry's own bindingId, plus the modal's own resolvedRoot) -- never from a value
  // this method itself read from bindingStore -- so save() is a single, self-contained
  // write. Its own read-modify-write cycle is already atomic under the SAME lock
  // ProfileStore.update() uses (writePluginDataSlice, plugin-data-shape.ts), so no
  // second store-level primitive is needed here.
  private async performReconnect(profileId: string, profile: CodebaseProfile): Promise<void> {
    const selection = await openSourceModal(this.app, { profile, filesystem: this.getFilesystem() });
    if (selection === null) return;   // cancelled -- changes nothing
    // Reconnecting an EXISTING binding keeps its id (same logical connection, new
    // root); Connecting a never-bound profile mints a fresh one. Either way this is
    // the only place a LocalBinding's id is chosen.
    const bindingId = profile.bindingId ?? crypto.randomUUID();
    await this.bindingStore.save({
      bindingId, label: profile.name, rootPath: selection.resolvedRoot,
      // Always overwritten by PluginDataBindingStore.save() with the real machine id
      // before validation (spec 4.1: provenance is never read from a caller-supplied
      // payload) -- this value is never actually persisted.
      machineId: 'stamped-by-store',
    });
    if (profile.bindingId === null) {
      await this.profileStore.update(profileId, (p) => ({ ...p, bindingId }));
    }
    await this.refresh();
    this.update();
  }

  private confirmClearBinding(profileId: string): void {
    const entry = this.entries.find((e) => e.profile.profileId === profileId);
    if (!entry?.profile.bindingId) return;
    const bindingId = entry.profile.bindingId;
    const label = entry.binding?.label ?? entry.profile.name;
    new ClearBindingModal(this.app, label, () => {
      void (async () => {
        await this.bindingStore.clear(bindingId);
        await this.refresh();
        this.update();
      })();
    }).open();
  }
}
