import { describe, expect, it, vi } from 'vitest';
import { openCity } from '../../src/host/commands';
import { CITY_VIEW_TYPE } from '../../src/host/city-view';

// Regression coverage for review round 2 (ruling M9): checkpoint #1's real-host run
// found "opening a second city tab works" fails, because the brief's own original
// openCity reused the first existing city leaf (`existing[0] ?? workspace.getLeaf(...)`)
// on every call. No test in this suite previously called openCity directly, so nothing
// here is "the old test updated" — this file is new, and it pins the corrected
// contract: openCity ALWAYS creates a fresh tab.
function makeLeaf(id: string) {
  return { id, setViewState: vi.fn(async () => {}) };
}

function makePluginDouble() {
  const leaves: ReturnType<typeof makeLeaf>[] = [];
  const workspace = {
    getLeaf: vi.fn(() => {
      const leaf = makeLeaf(`leaf-${leaves.length}`);
      leaves.push(leaf);
      return leaf;
    }),
    revealLeaf: vi.fn(async () => {}),
    getLeavesOfType: vi.fn(() => leaves),
  };
  return { app: { workspace }, workspace, leaves };
}

describe('openCity', () => {
  it('creates a new tab, sets its view state, and reveals it', async () => {
    const plugin = makePluginDouble();
    await openCity(plugin as never);
    expect(plugin.workspace.getLeaf).toHaveBeenCalledWith('tab');
    expect(plugin.leaves[0]?.setViewState).toHaveBeenCalledWith({ type: CITY_VIEW_TYPE, active: true });
    expect(plugin.workspace.revealLeaf).toHaveBeenCalledWith(plugin.leaves[0]);
  });

  it('never reuses an existing city leaf — calling it twice yields TWO distinct leaves', async () => {
    const plugin = makePluginDouble();
    await openCity(plugin as never);
    await openCity(plugin as never);

    // The regression guard: assert the leaf COUNT, not merely that the second call
    // resolved (a reveal-existing implementation resolves too, without error).
    expect(plugin.workspace.getLeaf).toHaveBeenCalledTimes(2);
    expect(plugin.leaves).toHaveLength(2);
    expect(plugin.leaves[0]).not.toBe(plugin.leaves[1]);
    expect(plugin.leaves[0]?.setViewState).toHaveBeenCalledTimes(1);
    expect(plugin.leaves[1]?.setViewState).toHaveBeenCalledTimes(1);
    expect(plugin.workspace.revealLeaf).toHaveBeenNthCalledWith(1, plugin.leaves[0]);
    expect(plugin.workspace.revealLeaf).toHaveBeenNthCalledWith(2, plugin.leaves[1]);
  });

  it('never looks for an existing city leaf at all', async () => {
    const plugin = makePluginDouble();
    await openCity(plugin as never);
    await openCity(plugin as never);
    expect(plugin.workspace.getLeavesOfType).not.toHaveBeenCalled();
  });
});
