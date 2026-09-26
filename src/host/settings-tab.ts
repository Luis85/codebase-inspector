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
import type { SourceFileSystemPort } from '../application/ports/source-filesystem-port';
import type { ReviewRepositoryRegistry } from '../adapters/storage/review-repository-registry';
import type { InvestigationFolderStore } from '../adapters/storage/plugin-data-investigation-store';
import {
  FALLOW_PROFILE_REMOVED, NOTES_FOLDER_PROBLEM, PROFILE_ANALYZER_PURGE_FAILED, PROFILE_INVESTIGATION_PURGE_FAILED,
  PROFILE_REVIEW_PURGE_FAILED, SETTINGS_FALLOW_BUSY, SETTINGS_FALLOW_LIMIT_INVALID, SETTINGS_FALLOW_STORE_FAILED,
} from '../ui/inspector-copy';
import type { FallowAnalysisService } from '../application/analysis/fallow-analysis-service';
import { AnalyzerStoreError } from '../application/analysis/analyzer-record';
import type { EvidenceRepository } from '../application/ports/evidence-repository';
import type { CodebaseProfile } from '../domain/model';
import { buildSettingDefinitions } from './setting-definitions';
import type { ProfileEntry } from './setting-definitions';
import { ClearBindingModal } from './modals/clear-binding-modal';
import { openSourceModal } from './modals/source-modal';
import { createDefaultProfile } from './scan-flow';
import { ValidationError, exclusionInputReasons, validationFailureText } from '../domain/validator';
import { defaultNoteFolder, validateNoteFolder } from '../application/investigation/note-path';

function parseExclusions(rawLines: string): string[] {
  return rawLines.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
}

export class CodebaseInspectorSettingTab extends PluginSettingTab {
  private entries: ProfileEntry[] = [];
  // Fix round 1, Important 4: test-only convenience so a test that fires two
  // overlapping edits (e.g. a rename and an exclusions change on the same profile)
  // has a deterministic way to know both have settled, without depending on timing.
  // Production code never reads this -- refresh() (which now updates() too, fix wave
  // item 9) already runs at the end of every mutation below.
  private pendingUpdates: Promise<void>[] = [];
  // WP-04.2 NE9: refreshSoon()'s one refresh in flight, and whether one more is queued.
  private refreshing: Promise<void> | null = null;
  private refreshQueued = false;

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
    // Part 6 Y17: a removed profile's review state goes with it (main.ts passes its one registry).
    private readonly reviewRegistry: Pick<ReviewRepositoryRegistry, 'purge'>,
    // Part 7 Z11/Z12: the plugin's fallow analysis service (main.ts passes its one instance).
    private readonly analysis: Pick<FallowAnalysisService, 'readBinding' | 'forget' | 'setTimeLimit' | 'purgeProfile'>,
    // Polish D5 (L22): the plugin's one session evidence repository, so a removed codebase's
    // findings go with it (main.ts passes its instance).
    private readonly evidence: Pick<EvidenceRepository, 'remove'>,
    // WP-04 Task 8 (IN18, IN19): the plugin's one investigation folder store (main.ts
    // passes its instance). IP28: a required 9th constructor parameter.
    private readonly investigations: InvestigationFolderStore,
  ) {
    super(app, plugin);
  }

  /** Loads every saved profile, resolves each one's binding, and re-renders. Public so a
   *  test can await it directly instead of guessing when async loading has settled.
   *
   *  Fix wave item 9 (I8, part (b)): `update()` is called HERE, at the end, rather than
   *  by each caller. Per obsidian.d.ts:6586 it is what "Stores the result of
   *  getSettingDefinitions() for rendering and search indexing", so a refresh that does
   *  not update leaves the tab rendered from whatever `entries` held when Obsidian last
   *  asked -- for main.ts's `addSettingTab(tab); void tab.refresh();` that is the empty
   *  list, with every saved profile populated silently behind it. Every mutation path in
   *  this file already paired the two; main.ts was the only one that did not, which is
   *  itself the smell. Pairing it here removes the class of bug rather than this
   *  instance, and the four mutation paths below no longer call `update()` themselves --
   *  a second call would re-render twice for one change. */
  async refresh(): Promise<void> {
    try {
      const profiles = await this.profileStore.list();
      const entries: ProfileEntry[] = [];
      for (const profile of profiles) {
        const binding = profile.bindingId === null ? null : await this.bindingStore.get(profile.bindingId);
        const investigationFolder = (await this.investigations.read(profile.profileId)) ?? defaultNoteFolder(profile.name);
        entries.push({ profile, binding, analyzer: await this.analysis.readBinding(profile.profileId), investigationFolder });
      }
      this.entries = entries;
    } catch (e) {
      // Ruling M63 (breakage round): the destination this seam never had. ProfileStore
      // .list() validates EVERY record (data.json is untrusted input, spec 4.1) and
      // throws on the first bad one -- a hand-edited file, a record from a future
      // schema, anything. main.ts calls `void settingTab.refresh()`, so that rejection
      // was unhandled, and the tab then rendered from `entries = []`: every saved
      // profile gone with no reason shown. Spec 7 names exactly that case:
      // "Validation failures surface as visible warnings carrying their reason. Never
      // dropped silently." This is the same destination city-view.ts's withScanGuard
      // gives the scan path. `entries` is deliberately LEFT AS IT WAS -- a failed
      // reload must not be indistinguishable from "you have no profiles".
      this.showFailure(e);
    }
    this.update();
  }

  /** WP-04.2 NE9: a write elsewhere (a scan's new profile, a note's exclusion, a fallow trust) re-reads
   *  the entries; while a refresh runs, at most one more is queued. */
  refreshSoon(): void {
    if (this.refreshing) { this.refreshQueued = true; return; }
    this.refreshing = this.refresh().finally(() => {
      this.refreshing = null;
      if (this.refreshQueued) { this.refreshQueued = false; this.refreshSoon(); }
    });
  }

  /** Every reason on one line, in a Notice. Polish D2: built by `notify`, the one Notice maker. */
  private showFailure(e: unknown, describe?: (reason: string) => string): void {
    const reason = validationFailureText(e);
    this.notify(describe ? describe(reason) : reason);
  }

  /** Polish D1: a refused analyzer write names its reason in words; any other error is shown
   *  as every other failure is. */
  private showAnalyzerFailure(e: unknown): void {
    if (e instanceof AnalyzerStoreError) { this.notify(SETTINGS_FALLOW_STORE_FAILED[e.code]); return; }
    this.showFailure(e);
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    return buildSettingDefinitions(this.entries, {
      onAddProfile: () => { void this.addProfile(); },
      onDeleteProfile: (id) => { void this.deleteProfile(id); },
      onRenameProfile: (id, name) => { this.trackUpdate(this.updateProfile(id, (p) => ({ ...p, name }))); },
      onExclusionsChange: (id, raw) => { this.trackUpdate(this.changeExclusions(id, raw)); },
      onMaxFileBytesChange: (id, raw) => {
        this.trackUpdate(this.updateProfile(id, (p) => ({ ...p, maxFileBytes: Number(raw) })));
      },
      onReconnect: (id) => { this.reconnect(id); },
      onClearBinding: (id) => { this.confirmClearBinding(id); },
      onForgetAnalyzer: (id) => { this.trackUpdate(this.forgetAnalyzer(id)); },
      onAnalyzerTimeoutChange: (id, raw) => { this.trackUpdate(this.changeAnalyzerTimeout(id, raw)); },
      onInvestigationFolderChange: (id, raw) => { this.trackUpdate(this.changeInvestigationFolder(id, raw)); },
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
  }

  private async deleteProfile(id: string): Promise<void> {
    // Polish D4: a failed removal is shown, keeps everything, and the list refreshes. The list's
    // onDelete calls this with `void`, so a rejection here was unhandled.
    try {
      await this.profileStore.remove(id);
    } catch (e) {
      this.showFailure(e);
      await this.refresh();
      return;
    }
    // Part 6 Y17: only once the profile is gone, so a failed removal keeps both. A failed
    // purge says the profile went but its review decisions stayed, with the reason (spec 7,
    // E29); the list refreshes.
    await this.reviewRegistry.purge(id).catch((e: unknown) => { this.showFailure(e, PROFILE_REVIEW_PURGE_FAILED); });
    // Part 7 Z11: and its fallow executable setting, whatever its format (a run in flight is cancelled).
    await this.analysis.purgeProfile(id).catch((e: unknown) => { this.showFailure(e, PROFILE_ANALYZER_PURGE_FAILED); });
    // WP-04 Task 8 (IP27): and its investigation notes folder setting, after the analyzer
    // purge; the investigation notes already created stay in the vault (IN18).
    await this.investigations.purge(id).catch((e: unknown) => { this.showFailure(e, PROFILE_INVESTIGATION_PURGE_FAILED); });
    // Polish D5: and its session evidence, last, for this profile only.
    try {
      this.evidence.remove(id);
    } catch (e) {
      this.showFailure(e);
    }
    await this.refresh();
  }

  /** Part 7 Z11: refused while this codebase's run is starting or active, or (final review)
   *  once its profile was removed; the service changes nothing then. */
  private async forgetAnalyzer(profileId: string): Promise<void> {
    try {
      const result = await this.analysis.forget(profileId);
      if (result !== 'forgotten') this.notify(result === 'busy' ? SETTINGS_FALLOW_BUSY : FALLOW_PROFILE_REMOVED);
    } catch (e) {
      this.showAnalyzerFailure(e);
    }
    await this.refresh();
  }

  /** Part 7 Z10 (M62): whole seconds from 10 to 1800; otherwise refused with a reason, and
   *  refresh() puts the stored value back in the field. */
  private async changeAnalyzerTimeout(profileId: string, rawValue: string): Promise<void> {
    const seconds = rawValue.trim() === '' ? Number.NaN : Number(rawValue);
    try {
      const result = await this.analysis.setTimeLimit(profileId, seconds);
      if (result !== 'saved') this.notify(result === 'invalid' ? SETTINGS_FALLOW_LIMIT_INVALID : FALLOW_PROFILE_REMOVED);
    } catch (e) {
      this.showAnalyzerFailure(e);
    }
    await this.refresh();
  }

  /** WP-04 Task 8 (IN19, IP10, IP11): validated the same way `changeExclusions` is --
   *  refused here, the typed value is never persisted and `refresh()` below puts the
   *  stored value (or the default) back in the field. */
  private async changeInvestigationFolder(profileId: string, rawValue: string): Promise<void> {
    const checked = validateNoteFolder(rawValue, this.app.vault.configDir);
    if (checked.ok) {
      try { await this.investigations.write(profileId, checked.folder); } catch (e) { this.showFailure(e); }
    } else {
      this.notify(NOTES_FOLDER_PROBLEM[checked.problem]);
    }
    await this.refresh();
  }

  private notify(message: string): void {
    const notice = new Notice(message, 8000);
    void notice;
  }

  /** Ruling M62 (breakage round): the Excluded paths field is one of the two places a
   *  user can TYPE an exclusion, and the glob refusal lives at those two surfaces --
   *  never in `codebaseProfileSchema`, which would retroactively invalidate profiles
   *  already on disk. The scope modal already calls the same rules through
   *  `scopeValidationReasons`; this calls `exclusionInputReasons` directly, because a
   *  settings edit carries no maxFileBytes of its own. Refused here, the typed value is
   *  never persisted and `refresh()` below puts the stored value back in the field. */
  private async changeExclusions(profileId: string, rawLines: string): Promise<void> {
    const exclusions = parseExclusions(rawLines);
    const reasons = exclusionInputReasons(exclusions);
    if (reasons.length === 0) {
      await this.updateProfile(profileId, (p) => ({ ...p, exclusions }));
      return;
    }
    this.showFailure(new ValidationError(reasons, 'Excluded paths'));
    await this.refresh();
  }

  private async updateProfile(id: string, mutate: (profile: CodebaseProfile) => CodebaseProfile): Promise<void> {
    // Fix round 1, Critical 1: this used to be `get(id)` then, much later, `save()` a
    // full object built from that now-possibly-stale read -- exactly the shape that
    // let two overlapping edits on the same profile silently discard one of them.
    // ProfileStore.update() performs the read, the mutation and the write as ONE
    // indivisible operation, so `mutate` is always applied to the current value.
    try {
      await this.profileStore.update(id, mutate);
    } catch (e) {
      // An invalid edit (e.g. maxFileBytes not a positive integer, or `./dist` in
      // Excluded paths) is rejected by the store's own validation and not persisted --
      // never silently coerced (spec 4.1). The unedited value is re-read back into
      // entries below.
      //
      // Fix wave item 6 (I5): this catch USED TO BE EMPTY, so the user watched the field
      // revert with no explanation whatsoever. Spec 7 names that case separately from
      // coercion: "Validation failures surface as visible warnings carrying their
      // reason. Never dropped silently." validationFailureText joins EVERY reason
      // ValidationError collected, not just the first -- that design work already
      // existed and was being thrown away here.
      this.showFailure(e);
    }
    await this.refresh();
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
      })();
    }).open();
  }
}
