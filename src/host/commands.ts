// Registers the three WP-01 commands, without the plugin-id prefix (spec 5.2):
// open-city, scan-codebase, cancel-scan. No fourth command, and none for an
// unimplemented capability (spec 1).
//
// scan-codebase and cancel-scan are REGISTERED here — visible in the command palette,
// per checkpoint #1 — but no approval flow exists until task 8 wires their bodies.
// checkCallback returns true unconditionally for `checking` so the palette keeps
// listing them (Obsidian hides a command from the palette when checkCallback(true)
// returns false); invoking them today does nothing observable and never throws.
import type { Plugin } from 'obsidian';
import { CITY_VIEW_TYPE } from './city-view';

/** Always opens a NEW city tab (ruling M9, review round 2). Multiple leaves are a
 *  first-class WP-01 capability, not an edge case: spec 4.4 says "the factory may run
 *  more than once," and task 11's per-leaf snapshot reconciliation only means anything
 *  if two leaves can hold different snapshots. A reveal-existing convention (the
 *  brief's own original line) silently removed that capability — checkpoint #1's
 *  "opening a second city tab works" line failed against it in the real host. Never
 *  casts a leaf's `.view` — callers that need the CityView itself use
 *  `leaf.view instanceof CityView`. */
export async function openCity(plugin: Plugin): Promise<void> {
  const { workspace } = plugin.app;
  const leaf = workspace.getLeaf('tab');
  await leaf.setViewState({ type: CITY_VIEW_TYPE, active: true });
  // Since 1.7.2 every view is created as a DeferredView, so reveal before acting.
  await workspace.revealLeaf(leaf);
}

export function registerCommands(plugin: Plugin): void {
  plugin.addCommand({
    id: 'open-city',
    name: 'Open codebase city',
    callback: () => { void openCity(plugin); },
  });

  plugin.addCommand({
    id: 'scan-codebase',
    name: 'Scan codebase',
    checkCallback: (checking: boolean): boolean => {
      if (checking) return true;
      // No profile and no approval flow exist yet (task 8 wires this). Must never
      // throw; doing nothing is the correct WP-01 behaviour.
      return true;
    },
  });

  plugin.addCommand({
    id: 'cancel-scan',
    name: 'Cancel scan',
    checkCallback: (checking: boolean): boolean => {
      if (checking) return true;
      return true;
    },
  });
}
