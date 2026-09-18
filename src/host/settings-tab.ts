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
import type { CodebaseProfile } from '../domain/model';
import { buildSettingDefinitions } from './setting-definitions';
import type { ProfileEntry } from './setting-definitions';
import { ClearBindingModal } from './modals/clear-binding-modal';

function parseExclusions(rawLines: string): string[] {
  return rawLines.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
}

export class CodebaseInspectorSettingTab extends PluginSettingTab {
  private entries: ProfileEntry[] = [];

  constructor(
    app: App,
    plugin: Plugin,
    private readonly profileStore: ProfileStore,
    private readonly bindingStore: LocalBindingStore,
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
      onRenameProfile: (id, name) => { void this.updateProfile(id, (p) => ({ ...p, name })); },
      onExclusionsChange: (id, raw) => {
        void this.updateProfile(id, (p) => ({ ...p, exclusions: parseExclusions(raw) }));
      },
      onMaxFileBytesChange: (id, raw) => {
        void this.updateProfile(id, (p) => ({ ...p, maxFileBytes: Number(raw) }));
      },
      onReconnect: (id) => { this.reconnect(id); },
      onClearBinding: (id) => { this.confirmClearBinding(id); },
    });
  }

  private async addProfile(): Promise<void> {
    const profile: CodebaseProfile = {
      profileId: crypto.randomUUID(), name: 'New profile', bindingId: null,
      exclusions: [], maxFileBytes: 5_000_000,
    };
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
    const current = await this.profileStore.get(id);
    if (!current) return;
    try {
      await this.profileStore.save(mutate(current));
    } catch {
      // An invalid edit (e.g. maxFileBytes not a positive integer) is rejected by the
      // store's own validation and simply not persisted -- never silently coerced
      // (spec 4.1). The unedited value is re-read back into entries on the next line.
    }
    await this.refresh();
    this.update();
  }

  // No source-selection flow exists yet -- a later task wires it. Enabled, never
  // disabled (spec 1), and doing nothing observable is the correct WP-01 behaviour,
  // exactly like src/host/commands.ts's scan-codebase/cancel-scan commands.
  private reconnect(_profileId: string): void {}

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
