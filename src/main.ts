import { Plugin, type WorkspaceLeaf } from 'obsidian';
import { CITY_VIEW_TYPE, CityView } from './host/city-view';
import { openCity, registerCommands } from './host/commands';
import { CodebaseInspectorSettingTab } from './host/settings-tab';
import { PluginDataProfileStore } from './adapters/storage/plugin-data-profile-store';
import { PluginDataBindingStore, getOrCreateMachineId } from './adapters/storage/plugin-data-binding-store';
import { createNodeSourceFileSystem } from './adapters/filesystem/node-source-filesystem';
import { InMemorySnapshotStore } from './adapters/storage/in-memory-snapshot-store';
import { createReviewRepositoryRegistry } from './adapters/storage/review-repository-registry';
import type { Clock } from './application/ports/clock';
import './ui/styles.css';
import './ui/styles/kit.css';
import './ui/styles/shell.css';
import './ui/styles/screens.css';
import './ui/styles/screens-explore.css';
import './ui/styles/screens-audit.css';
import './ui/styles/screens-act.css';
import './ui/styles/screens-configure.css';

// Shared by every CityView: approve()/ScanCoordinator never read the wall clock
// themselves (src/application/approval.ts's own constraint), so ONE Clock is
// constructed here and threaded through, same pattern as scope-modal.ts's own
// SYSTEM_CLOCK for the same reason.
const SYSTEM_CLOCK: Clock = { now: () => new Date(), nowIso: () => new Date().toISOString() };

export default class CodebaseInspectorPlugin extends Plugin {
  override onload(): void {
    // onload REGISTERS ONLY. No scanning, no expensive work (spec 4.4). Constructing
    // the stores and reading/creating this machine's id (a single synchronous
    // localStorage read, see getOrCreateMachineId) is registration-weight, not scan
    // work — no filesystem or network access happens here.
    const profileStore = new PluginDataProfileStore(this);
    const bindingStore = new PluginDataBindingStore(this, getOrCreateMachineId(this.app));
    // Spec 4.5: SnapshotStore is in-memory for WP-01, ONE instance shared by every
    // CityView this plugin ever constructs, so reopening a second leaf for the same
    // profile can find what a first leaf already scanned instead of re-authorising a
    // scan just to look at data that already exists.
    const snapshotStore = new InMemorySnapshotStore(SYSTEM_CLOCK);
    // Part 6 Y11: ONE review repository per codebase for the whole plugin, shared by every
    // leaf (one high-water mark, one cache) and purged with its profile (Y17). It builds
    // and reads nothing until a view binds a codebase.
    const reviewRegistry = createReviewRepositoryRegistry(this);

    this.registerView(CITY_VIEW_TYPE, (leaf: WorkspaceLeaf) => new CityView(leaf, this, {
      profileStore, getFilesystem: () => createNodeSourceFileSystem(), snapshotStore, clock: SYSTEM_CLOCK,
      reviewRepositoryFor: (repositoryId) => reviewRegistry.for(repositoryId),
    }));
    this.addRibbonIcon('building-2', 'Open codebase city', () => { void openCity(this); });
    registerCommands(this);
    // Ruling M30/M31: the settings tab's Connect/Reconnect flow (source-modal.ts)
    // stats a directory through this SAME adapter layer task 5 built -- never a
    // second path to Node. A FACTORY, not an already-built port: onload() registers
    // only, so building the real Node-backed port is deferred to the moment Connect/
    // Reconnect is actually clicked, never during onload itself.
    const settingTab = new CodebaseInspectorSettingTab(
      this.app, this, profileStore, bindingStore, () => createNodeSourceFileSystem(), reviewRegistry);
    this.addSettingTab(settingTab);
    void settingTab.refresh();

    this.app.workspace.onLayoutReady(() => {
      // Startup work belongs here, not in onload. Task 11's per-leaf snapshot
      // reconciliation is triggered by a SCAN completing (city-view.ts's own
      // onLifecycleChange, via leaf-registry.ts's reconcileEveryView) rather than by
      // workspace layout becoming ready — a freshly restored view's snapshotStore is
      // always empty (spec 4.5: in-memory only), so there is nothing to reconcile yet
      // at this point. Nothing else in WP-01 needs startup work.
    });
  }

  // Fix round 2, Item 2: a USER DIRECTIVE, not a defect and not this session's own
  // ruling -- "when activating the plugin, it should not open the plugin," verbatim.
  // Spec 4.4 says "first-enable view opening uses onUserEnable()," and at checkpoint #1
  // that auto-open was reported to the user as spec-mandated, with the auto-open itself
  // named explicitly as a §4.4 deviation the user could ask to change. They have now
  // asked. Only the user may change a §4 rule, and this is that change -- there is
  // deliberately NO onUserEnable() override any more. The ribbon icon and the
  // `open-city` command remain the ways to open a city tab; do not "restore" this as a
  // regression without a new instruction from the user reversing the directive.

  // Typed void and never awaited. Teardown is synchronous and idempotent.
  // NEVER detachLeavesOfType here (spec 4.4).
  override onunload(): void {}
}
