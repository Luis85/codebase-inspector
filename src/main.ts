import { Plugin, type WorkspaceLeaf } from 'obsidian';
import { CITY_VIEW_TYPE, CityView } from './host/city-view';
import { openCity, registerCommands } from './host/commands';
import { CodebaseInspectorSettingTab } from './host/settings-tab';
import { PluginDataProfileStore } from './adapters/storage/plugin-data-profile-store';
import { PluginDataBindingStore, getOrCreateMachineId } from './adapters/storage/plugin-data-binding-store';
import { createNodeSourceFileSystem } from './adapters/filesystem/node-source-filesystem';
import './ui/styles.css';

export default class CodebaseInspectorPlugin extends Plugin {
  override onload(): void {
    // onload REGISTERS ONLY. No scanning, no expensive work (spec 4.4). Constructing
    // the stores and reading/creating this machine's id (a single synchronous
    // localStorage read, see getOrCreateMachineId) is registration-weight, not scan
    // work — no filesystem or network access happens here.
    this.registerView(CITY_VIEW_TYPE, (leaf: WorkspaceLeaf) => new CityView(leaf, this));
    this.addRibbonIcon('building-2', 'Open codebase city', () => { void openCity(this); });
    registerCommands(this);

    const profileStore = new PluginDataProfileStore(this);
    const bindingStore = new PluginDataBindingStore(this, getOrCreateMachineId(this.app));
    // Ruling M30/M31: the settings tab's Connect/Reconnect flow (source-modal.ts)
    // stats a directory through this SAME adapter layer task 5 built -- never a
    // second path to Node. A FACTORY, not an already-built port: onload() registers
    // only, so building the real Node-backed port is deferred to the moment Connect/
    // Reconnect is actually clicked, never during onload itself.
    const settingTab = new CodebaseInspectorSettingTab(
      this.app, this, profileStore, bindingStore, () => createNodeSourceFileSystem());
    this.addSettingTab(settingTab);
    void settingTab.refresh();

    this.app.workspace.onLayoutReady(() => {
      // Startup work belongs here, not in onload. Nothing in WP-01 needs it yet;
      // task 11 attaches per-leaf snapshot reconciliation.
    });
  }

  // First-enable view opening only. Never on every load.
  override onUserEnable(): void {
    void openCity(this);
  }

  // Typed void and never awaited. Teardown is synchronous and idempotent.
  // NEVER detachLeavesOfType here (spec 4.4).
  override onunload(): void {}
}
