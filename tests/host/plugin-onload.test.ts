import { describe, expect, it, vi, type MockInstance } from 'vitest';
import CodebaseInspectorPlugin from '../../src/main';
import { CITY_VIEW_TYPE } from '../../src/host/city-view';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { writePluginDataSlice } from '../../src/adapters/storage/plugin-data-shape';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import type { SettingDefinitionItem, SettingDefinitionList } from 'obsidian';

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
    // WP-04 IP12: the notes port's events and its first read, which onload must never reach.
    vault: { adapter: { read: vi.fn(), list: vi.fn() }, on: vi.fn(() => ({})), getMarkdownFiles: vi.fn(() => []) },
    metadataCache: { on: vi.fn(() => ({})), getFileCache: vi.fn(() => null) },
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
  registerEvent: ReturnType<typeof vi.fn>;
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
    registerEvent: vi.fn(),
  }) as unknown as PluginDouble;
}

describe('onload', () => {
  it('registers the city view, the ribbon icon and six commands, and nothing else', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.registerView).toHaveBeenCalledWith(CITY_VIEW_TYPE, expect.any(Function));
    expect(p.addRibbonIcon).toHaveBeenCalledTimes(1);
    expect(p.addCommand.mock.calls.map((c: unknown[]) => (c[0] as { id: string }).id).sort())
      .toEqual(['cancel-fallow-analysis', 'cancel-scan', 'import-analysis-report', 'open-city', 'run-fallow-analysis', 'scan-codebase']);
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
    // Part 6 Y39 and Part 7 Z35: import, run and cancel an analysis are all implemented.
    expect(p.addCommand).toHaveBeenCalledTimes(6);
  });

  it('does no filesystem access and starts no scan during onload', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.app.vault.adapter.read).not.toHaveBeenCalled();
    expect(p.app.vault.adapter.list).not.toHaveBeenCalled();
  });

  it('WP-04 IP12: registers no vault or metadata-cache listener and reads no note during onload', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.registerEvent).not.toHaveBeenCalled();
    expect(p.app.vault.on).not.toHaveBeenCalled();
    expect(p.app.metadataCache.on).not.toHaveBeenCalled();
    expect(p.app.vault.getMarkdownFiles).not.toHaveBeenCalled();
  });

  it('defers startup work to onLayoutReady', () => {
    const p = makePluginDouble();
    p.onload();
    expect(p.app.workspace.onLayoutReady).toHaveBeenCalled();
  });

  // Fix round 2, Item 2: a USER DIRECTIVE ("when activating the plugin, it should not
  // open the plugin"), not a defect -- see the comment in src/main.ts for the full
  // history (spec 4.4 originally called for this, reported to the user at checkpoint #1
  // as a named deviation they could ask to change; they have). This test REPLACES one
  // whose NAME claimed "first-enable opening to onUserEnable" but never actually called
  // onUserEnable() or asserted anything about it -- a vacuous assertion in the same
  // category this plan's reviews have repeatedly flagged. Rewritten to deliberately test
  // the opposite, real behaviour, rather than silently dropped.
  it('does NOT open a city tab when the plugin is enabled (user directive)', () => {
    const p = makePluginDouble();
    p.onload();
    p.onUserEnable();
    expect(p.app.workspace.getLeaf).not.toHaveBeenCalled();
    expect(p.app.workspace.revealLeaf).not.toHaveBeenCalled();
  });

  it('never detaches leaves in onunload', () => {
    const p = makePluginDouble();
    p.onload();
    p.onunload();
    expect(p.app.workspace.detachLeavesOfType).not.toHaveBeenCalled();
  });

  it('Part 7 Z24: onunload shuts the fallow analysis down once, synchronously', () => {
    const p = makePluginDouble();
    p.onload();
    const analysis = (p as unknown as { analysis: { shutdown(): void } }).analysis;
    const shutdown = vi.spyOn(analysis, 'shutdown');
    expect(p.onunload()).toBeUndefined();
    p.onunload();
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it('types onunload as void, so teardown is never awaited', () => {
    const p = makePluginDouble();
    expect(p.onunload()).toBeUndefined();
  });
});

// Fix wave item 9 (I8, part (b) only): main.ts did
//   this.addSettingTab(settingTab);   // Obsidian calls update() -> getSettingDefinitions()
//   void settingTab.refresh();        // async: sets this.entries -- and never update()d
// Per obsidian.d.ts:6586, update() is what "Stores the result of getSettingDefinitions()
// for rendering and search indexing", so the tab was cached with `entries = []` and the
// saved profiles were populated behind it. Every OTHER mutation path in settings-tab.ts
// pairs refresh() with update(); main.ts was the only one that did not -- an asymmetry
// that is itself the smell. Fixed by pairing inside refresh(), which removes the class
// of bug rather than this instance.
//
// Part (a) -- whether the declarative surface renders correctly in a real 1.13.0+ host --
// is NOT covered here and cannot be: the locally installed Obsidian is 1.12.4 and
// getSettingDefinitions has 0 hits in its shipped asar. That goes to the user's checkpoint.
// Hoisted to module scope (oxlint's consistent-function-scoping): captures nothing from
// the describe block.
function makeTab(): CodebaseInspectorSettingTab {
  return new CodebaseInspectorSettingTab(
    {} as never, {} as never,
    createFakeProfileStoreHarness().store, createFakeBindingStoreHarness().store,
    () => createFakeSourceFileSystem({}).port, { purge: () => Promise.resolve() }, createFakeFallowAnalysis(), { remove: vi.fn() }, createFakeInvestigationFolders());
}

describe('the settings tab is rendered, not merely refreshed', () => {
  it('refresh() always pairs with update(), so no caller can forget it', async () => {
    const tab = makeTab();
    const update = vi.spyOn(tab, 'update');
    await tab.refresh();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('refresh() updates exactly once, never twice, on a mutation path', async () => {
    const tab = makeTab();
    const update = vi.spyOn(tab, 'update');
    await tab.refresh();
    await tab.refresh();
    // Two refreshes, two updates -- not four. Pairing inside refresh() must not leave a
    // stale explicit update() behind on the paths that already called both.
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('onload leaves the tab UPDATED once its refresh settles', async () => {
    const update = vi.spyOn(CodebaseInspectorSettingTab.prototype, 'update');
    try {
      const p = makePluginDouble();
      p.onload();
      // onload's `void settingTab.refresh()` is async; drain the microtask queue rather
      // than guessing how many hops loadData() takes.
      for (let i = 0; i < 50 && update.mock.calls.length === 0; i += 1) await Promise.resolve();
      expect(update).toHaveBeenCalled();
    } finally {
      update.mockRestore();
    }
  });
});

// Part 6 Y11/Y17: onload builds ONE review registry and hands it to the settings tab, so
// removing a profile removes its saved review state. (The CityView half,
// `reviewRepositoryFor`, needs a DOM to construct a view: tests/host/city-view-data-ports
// and the typecheck cover it.)
describe('the review registry (Part 6 Y11, Y17)', () => {
  it('reaches the settings tab: removing a profile purges its saved review state', async () => {
    const p = makePluginDouble();
    let data: unknown = {
      profiles: [{ profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 }],
      reviews: { p1: { v: 1, workItems: [], rules: [], dispositions: [] }, p2: { v: 1 } },
    };
    // Own promise-returning doubles (not mockImplementation on the void-typed vi.fn():
    // @typescript-eslint/no-misused-promises), over one in-memory data.json.
    Object.assign(p, {
      loadData: vi.fn(() => Promise.resolve(JSON.parse(JSON.stringify(data)) as unknown)),
      saveData: vi.fn((next: unknown) => {
        data = JSON.parse(JSON.stringify(next)) as unknown;
        return Promise.resolve();
      }),
    });
    p.onload();
    const tab = p.addSettingTab.mock.calls[0]?.[0] as CodebaseInspectorSettingTab;
    await tab.refresh();
    const list = tab.getSettingDefinitions().find((d: SettingDefinitionItem): d is SettingDefinitionList => 'type' in d && d.type === 'list');
    expect(list?.onDelete).toBeDefined();
    list?.onDelete?.(0);
    await vi.waitFor(() => { expect(data).toEqual({ profiles: [], reviews: { p2: { v: 1 } } }); });
  });
});

/** A loaded plugin double over one in-memory data.json, with its settings tab's refresh spied (and stubbed). */
async function loadedWithTab(): Promise<{ p: PluginDouble; refresh: MockInstance<CodebaseInspectorSettingTab['refresh']> }> {
  const p = makePluginDouble();
  let data: unknown = null;
  Object.assign(p, {
    loadData: vi.fn(() => Promise.resolve(data)),
    saveData: vi.fn((next: unknown) => { data = JSON.parse(JSON.stringify(next)) as unknown; return Promise.resolve(); }),
  });
  p.onload();
  const tab = p.addSettingTab.mock.calls[0]?.[0] as CodebaseInspectorSettingTab;
  await tab.refresh();
  return { p, refresh: vi.spyOn(tab, 'refresh').mockResolvedValue() };
}

// WP-04.2 NE9: onload watches data.json for the settings tab; onunload stops it.
describe('the settings tab follows data.json writes while the plugin is loaded (WP-04.2 NE9)', () => {
  // Every slice the tab shows: its profiles, their bindings, their fallow executables and their notes folders.
  it.each(['profiles', 'bindings', 'analyzers', 'investigations'] as const)('a %s write refreshes the tab', async (key) => {
    const { p, refresh } = await loadedWithTab();
    await writePluginDataSlice(p, key, () => ({ written: key }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('a reviews write does not refresh the tab, which shows no review state', async () => {
    const { p, refresh } = await loadedWithTab();
    await writePluginDataSlice(p, 'reviews', () => ({ p1: { v: 1 } }));
    await Promise.resolve();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('a profile write refreshes the tab, and after onunload it no longer does', async () => {
    const { p, refresh } = await loadedWithTab();
    await writePluginDataSlice(p, 'profiles', () => [{ profileId: 'p1' }]);
    expect(refresh).toHaveBeenCalledTimes(1);
    p.onunload();
    await writePluginDataSlice(p, 'profiles', () => [{ profileId: 'p2' }]);
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
