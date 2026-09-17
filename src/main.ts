import { Plugin, type WorkspaceLeaf } from 'obsidian';
import { CITY_VIEW_TYPE, CityView } from './host/city-view';
import { openCity, registerCommands } from './host/commands';
import './ui/styles.css';

export default class CodebaseInspectorPlugin extends Plugin {
  override onload(): void {
    // onload REGISTERS ONLY. No scanning, no expensive work (spec 4.4).
    this.registerView(CITY_VIEW_TYPE, (leaf: WorkspaceLeaf) => new CityView(leaf, this));
    this.addRibbonIcon('building-2', 'Open codebase city', () => { void openCity(this); });
    registerCommands(this);

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
