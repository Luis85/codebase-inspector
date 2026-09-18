import { describe, expect, it, vi } from 'vitest';
import { openCity, registerCommands } from '../../src/host/commands';
import { CITY_VIEW_TYPE } from '../../src/host/city-view';

interface AddedCommand {
  id: string;
  checkCallback?: (checking: boolean) => boolean;
}

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

// Ruling M36: cancel-scan's checkCallback is hidden unless the active view has a run
// to cancel; scan-codebase's stays unconditionally visible (superseding M6 for
// cancel-scan only). These tests exercise registerCommands' actual checkCallback
// bodies directly — a fake `view` double, not a real CityView, since ScanCoordinator's
// own behaviour is already exhaustively covered in tests/unit/scan-coordinator.test.ts.
function makeViewDouble(running: boolean): { startScan: ReturnType<typeof vi.fn>; cancelScan: ReturnType<typeof vi.fn>; isScanRunning: () => boolean } {
  return { startScan: vi.fn(async () => {}), cancelScan: vi.fn(), isScanRunning: () => running };
}

function findCommand(addCommand: ReturnType<typeof vi.fn>, id: string): AddedCommand {
  const found = (addCommand.mock.calls as [AddedCommand][]).find(([c]) => c.id === id);
  if (!found) throw new Error(`test setup: no command registered with id "${id}"`);
  return found[0];
}

function makeCommandsPluginDouble(activeView: ReturnType<typeof makeViewDouble> | null) {
  const addCommand = vi.fn();
  const plugin = {
    app: { workspace: { getActiveViewOfType: vi.fn(() => activeView) } },
    addCommand,
  };
  registerCommands(plugin as never);
  return { plugin, addCommand };
}

describe('registerCommands — scan-codebase', () => {
  it('checkCallback(true) returns true even with no active city view', () => {
    const { addCommand } = makeCommandsPluginDouble(null);
    expect(findCommand(addCommand, 'scan-codebase').checkCallback!(true)).toBe(true);
  });

  it('invoking it with no active city view does nothing observable and never throws', () => {
    const { addCommand } = makeCommandsPluginDouble(null);
    expect(() => findCommand(addCommand, 'scan-codebase').checkCallback!(false)).not.toThrow();
  });

  it('invoking it with an active city view calls startScan()', () => {
    const view = makeViewDouble(false);
    const { addCommand } = makeCommandsPluginDouble(view);
    findCommand(addCommand, 'scan-codebase').checkCallback!(false);
    expect(view.startScan).toHaveBeenCalledTimes(1);
  });
});

describe('registerCommands — cancel-scan (ruling M36)', () => {
  it('checkCallback(true) returns FALSE with no active city view', () => {
    const { addCommand } = makeCommandsPluginDouble(null);
    expect(findCommand(addCommand, 'cancel-scan').checkCallback!(true)).toBe(false);
  });

  it('checkCallback(true) returns FALSE when the active view has no run in progress', () => {
    const { addCommand } = makeCommandsPluginDouble(makeViewDouble(false));
    expect(findCommand(addCommand, 'cancel-scan').checkCallback!(true)).toBe(false);
  });

  it('checkCallback(true) returns true when the active view has a run in progress', () => {
    const { addCommand } = makeCommandsPluginDouble(makeViewDouble(true));
    expect(findCommand(addCommand, 'cancel-scan').checkCallback!(true)).toBe(true);
  });

  it('invoking it while running calls cancelScan()', () => {
    const view = makeViewDouble(true);
    const { addCommand } = makeCommandsPluginDouble(view);
    findCommand(addCommand, 'cancel-scan').checkCallback!(false);
    expect(view.cancelScan).toHaveBeenCalledTimes(1);
  });
});
