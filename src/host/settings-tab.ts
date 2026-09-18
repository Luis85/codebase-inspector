// Verification decision (docs/superpowers/notes/2026-09-17-setting-definitions-
// verification.md): FULL DECLARATIVE. This class's entire rendered surface comes from
// getSettingDefinitions() below; no display() override exists (minAppVersion is already
// 1.13.0, so an unreachable pre-1.13 fallback would be dead code). No
// obsidianmd/prefer-setting-definitions disable is used anywhere in this file: a real,
// non-trivial getSettingDefinitions() already satisfies the rule (see the verification
// document's answer to question C).
import { Notice, PluginSettingTab } from 'obsidian';
import type { App, Plugin, SettingDefinitionItem } from 'obsidian';
import type { ProfileStore } from '../application/ports/profile-store';
import type { LocalBindingStore } from '../application/ports/local-binding-store';
import type { CodebaseProfile } from '../domain/model';
import { RECONNECT_NOT_AVAILABLE_TEXT, buildSettingDefinitions } from './setting-definitions';
import type { ProfileEntry } from './setting-definitions';
import { ClearBindingModal } from './modals/clear-binding-modal';

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

  // No source-selection flow exists yet -- task 7 owns wiring this to the real
  // source-selection modal (ruling M26). Enabled, never disabled (spec 1), but a
  // silent no-op is a broken promise a disabled button would not have made: this
  // shows a visible, honest Notice instead (fix round 1, Important 2).
  private reconnect(_profileId: string): void {
    // Assigned (not a bare `new` statement) only to satisfy no-new; Notice displays
    // itself as a side effect of construction, per Obsidian's own API.
    const notice = new Notice(RECONNECT_NOT_AVAILABLE_TEXT);
    void notice;
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
