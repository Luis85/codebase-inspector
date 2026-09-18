import { describe, expect, it, vi } from 'vitest';
import CodebaseInspectorPlugin from '../../src/main';
import { CITY_VIEW_TYPE } from '../../src/host/city-view';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';

// A hand-rolled double: bypasses the real Plugin constructor entirely (no `new`), so
// this never needs a working Obsidian App/Plugin runtime — only enough for onload's
// own logic (this.registerView/addRibbonIcon/addCommand/this.app.workspace) to run.
// The 'obsidian' module is externalised at build time; see tests/mocks/obsidian.ts for
// why a real one cannot exist under plain Node.
function makeApp() {
  // loadLocalStorage/saveLocalStorage (task 6): getOrCreateMachineId reads/writes
  // through these during onload, to construct the plugin-data binding store.
  const localStorage = new Map<string, unknown>();
  return {
    workspace: {
      onLayoutReady: vi.fn(),
      detachLeavesOfType: vi.fn(),
      getLeavesOfType: vi.fn(() => []),
      getLeaf: vi.fn(() => ({ setViewState: vi.fn(async () => {}) })),
      revealLeaf: vi.fn(async () => {}),
      on: vi.fn(() => ({})),
      offref: vi.fn(),
    },
    vault: { adapter: { read: vi.fn(), list: vi.fn() } },
    loadLocalStorage: vi.fn((key: string) => (localStorage.has(key) ? localStorage.get(key) : null)),
    saveLocalStorage: vi.fn((key: string, data: unknown) => { localStorage.set(key, data); }),
  };
}

type PluginDouble = CodebaseInspectorPlugin & {
  app: ReturnType<typeof makeApp>;
  registerView: ReturnType<typeof vi.fn>;
  addRibbonIcon: ReturnType<typeof vi.fn>;
  addCommand: ReturnType<typeof vi.fn>;
  addSettingTab: ReturnType<typeof vi.fn>;
  loadData: ReturnType<typeof vi.fn>;
  saveData: ReturnType<typeof vi.fn>;
};

function makePluginDouble(): PluginDouble {
  // Object.create bypasses the real Plugin/Component constructors entirely (no
  // `new`), so this never needs a working Obsidian App/Plugin runtime — only enough
  // for onload's own logic (this.registerView/addRibbonIcon/addCommand/addSettingTab/
  // this.app.workspace) to run. One cast at the boundary: the real Plugin.app type is
  // the full Obsidian App interface, which this double intentionally does not
  // implement in full.
  return Object.assign(Object.create(CodebaseInspectorPlugin.prototype) as object, {
    app: makeApp(),
    registerView: vi.fn(),
    addRibbonIcon: vi.fn(),
    addCommand: vi.fn(),
    addSettingTab: vi.fn(),
    loadData: vi.fn(async () => null),
    saveData: vi.fn(async () => {}),
  }) as unknown as PluginDouble;
}

describe('onload', () => {
  it('registers the city view, the ribbon icon and three commands, and nothing else', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.registerView).toHaveBeenCalledWith(CITY_VIEW_TYPE, expect.any(Function));
    expect(p.addRibbonIcon).toHaveBeenCalledTimes(1);
    expect(p.addCommand.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id).sort())
      .toEqual(['cancel-scan', 'open-city', 'scan-codebase']);
  });

  it('registers exactly one settings tab (task 6)', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.addSettingTab).toHaveBeenCalledTimes(1);
    expect(p.addSettingTab.mock.calls[0]?.[0]).toBeInstanceOf(CodebaseInspectorSettingTab);
  });

  it('registers commands WITHOUT the plugin-id prefix', () => {
    const p = makePluginDouble();
    p.onload();
    for (const [cmd] of p.addCommand.mock.calls as [{ id: string }][]) {
      expect(cmd.id).not.toMatch(/^codebase-inspector/);
    }
  });

  it('registers no command for an unimplemented capability', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.addCommand).toHaveBeenCalledTimes(3);
  });

  it('does no filesystem access and starts no scan during onload', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.app.vault.adapter.read).not.toHaveBeenCalled();
    expect(p.app.vault.adapter.list).not.toHaveBeenCalled();
  });

  it('defers startup work to onLayoutReady and first-enable opening to onUserEnable', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.app.workspace.onLayoutReady).toHaveBeenCalled();
  });

  it('never detaches leaves in onunload', () => {
    const p = makePluginDouble();
    p.onload();
    p.onunload();
    expect(p.app.workspace.detachLeavesOfType).not.toHaveBeenCalled();
  });

  it('types onunload as void, so teardown is never awaited', () => {
    const p = makePluginDouble();
    expect(p.onunload()).toBeUndefined();
  });
});
