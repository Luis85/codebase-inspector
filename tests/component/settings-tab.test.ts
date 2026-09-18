// Component tests for the FULL DECLARATIVE settings tab (verification decision: see
// docs/superpowers/notes/2026-09-17-setting-definitions-verification.md). The
// declarative renderer that would turn getSettingDefinitions()'s return value into DOM
// ships no runtime anywhere in this dependency tree (the 'obsidian' package is types
// only) -- faking it here would test a guess at Obsidian's own behaviour, not this
// plugin's. So these tests call getSettingDefinitions() directly and, for the one row
// that needs real DOM (the binding-status row), invoke its own `render` callback
// against a real Setting built on the same faithful Setting double
// (tests/mocks/obsidian.ts) that render() itself would receive from the real host.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Setting } from '../mocks/obsidian';
import type { App, Plugin, Setting as ObsidianSetting, SettingDefinitionItem, SettingDefinitionList,
  SettingDefinitionPage, SettingDefinitionRender, SettingGroup } from 'obsidian';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import type { CodebaseProfile, LocalBinding } from '../../src/domain/model';
import { BINDING_MISSING_TEXT, STORAGE_DISCLOSURE_TEXT, SYMLINK_POLICY_TEXT } from '../../src/host/setting-definitions';

function makeProfile(overrides: Partial<CodebaseProfile> = {}): CodebaseProfile {
  return { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 1_000_000, ...overrides };
}

async function makeTab(profiles: readonly CodebaseProfile[], bindings: readonly LocalBinding[] = []) {
  const profileHarness = createFakeProfileStoreHarness();
  const bindingHarness = createFakeBindingStoreHarness();
  for (const p of profiles) await profileHarness.store.save(p);
  for (const b of bindings) await bindingHarness.store.save(b);
  const tab = new CodebaseInspectorSettingTab(
    {} as unknown as App, {} as unknown as Plugin, profileHarness.store, bindingHarness.store);
  await tab.refresh();
  return { tab, profileStore: profileHarness.store, bindingStore: bindingHarness.store };
}

function findList(defs: SettingDefinitionItem[]): SettingDefinitionList {
  const found = defs.find((d): d is SettingDefinitionList => 'type' in d && d.type === 'list');
  if (!found) throw new Error('no list definition found');
  return found;
}

function findProfilePage(defs: SettingDefinitionItem[], name: string): SettingDefinitionPage {
  const list = findList(defs);
  const page = (list.items ?? []).find(
    (item): item is SettingDefinitionPage => 'type' in item && item.type === 'page' && item.name === name);
  if (!page) throw new Error(`no profile page named ${name}`);
  return page;
}

function findRenderDef(items: SettingDefinitionItem[] | undefined, name: string): SettingDefinitionRender {
  const found = (items ?? []).find(
    (item): item is SettingDefinitionRender => 'render' in item && typeof item.render === 'function' && item.name === name);
  if (!found) throw new Error(`no render definition named ${name}`);
  return found;
}

const fakeGroup = {} as unknown as SettingGroup;

// One cast at the boundary (matching tests/host/plugin-onload.test.ts's established
// idiom): the mock Setting (tests/mocks/obsidian.ts) implements the well-precedented
// pre-1.13 API surface a render() callback actually uses, not the full real Setting
// interface (addDisplayValue, setErrorMessage, etc., none of which this plugin needs).
function invokeRender(def: SettingDefinitionRender, setting: Setting): void {
  def.render(setting as unknown as ObsidianSetting, fakeGroup);
}

const containers: HTMLElement[] = [];
afterEach(() => { containers.splice(0).forEach((c) => { c.remove(); }); });

function newContainer(): HTMLElement {
  const el = document.body.createDiv();
  containers.push(el);
  return el;
}

function collect(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    out.push(...(statSync(full).isDirectory() ? collect(full) : [full]));
  }
  return out;
}

describe('settings tab', () => {
  it('lists every saved profile', async () => {
    const { tab } = await makeTab([makeProfile({ profileId: 'p1', name: 'Alpha' }), makeProfile({ profileId: 'p2', name: 'Beta' })]);
    const list = findList(tab.getSettingDefinitions());
    expect((list.items ?? []).map((i) => ('name' in i ? i.name : undefined))).toEqual(['Alpha', 'Beta']);
  });

  it('shows a reconnect action when a profile\'s binding is missing on this machine', async () => {
    const { tab } = await makeTab([makeProfile({ profileId: 'p1', bindingId: 'b1' })]);
    // bindingId 'b1' was never saved to the binding store: exactly "missing on this machine".
    const page = findProfilePage(tab.getSettingDefinitions(), 'Alpha');
    const def = findRenderDef(page.items, 'Source folder');
    const setting = new Setting(newContainer());
    invokeRender(def, setting);
    expect(setting.settingEl.textContent).toContain(BINDING_MISSING_TEXT);
    expect(setting.settingEl.querySelector('[data-action="reconnect"]')).not.toBeNull();
  });

  it('confirms before clearing a binding', async () => {
    const { tab, bindingStore } = await makeTab(
      [makeProfile({ profileId: 'p1', bindingId: 'b1' })],
      [{ bindingId: 'b1', label: 'Alpha root', rootPath: 'C:\\Projects\\alpha', machineId: 'irrelevant' }]);
    const page = findProfilePage(tab.getSettingDefinitions(), 'Alpha');
    const def = findRenderDef(page.items, 'Source folder');
    const setting = new Setting(newContainer());
    invokeRender(def, setting);
    const clearButton = setting.settingEl.querySelector<HTMLButtonElement>('[data-action="clear-binding"]');
    expect(clearButton).not.toBeNull();
    clearButton!.click();

    // Clicking the row's own button only opens the modal -- it must not have mutated
    // anything yet (this is the assertion that would fail if clear-binding skipped
    // confirmation and cleared immediately).
    expect(await bindingStore.get('b1')).not.toBeNull();
    const confirmButton = document.querySelector<HTMLButtonElement>('[data-action="confirm-clear-binding"]');
    expect(confirmButton).not.toBeNull();

    confirmButton!.click();
    await Promise.resolve(); // let the modal's async confirm handler settle
    await Promise.resolve();
    expect(await bindingStore.get('b1')).toBeNull();
  });

  it('renders the symlink policy as STATIC EXPLANATORY TEXT, not a disabled toggle', async () => {
    const { tab } = await makeTab([]);
    const defs = tab.getSettingDefinitions();
    const row = defs.find((d) => 'name' in d && d.name === 'Follow symbolic links');
    expect(row).toBeDefined();
    // No control, action or render at all -- there is nothing here that COULD produce
    // an input, button or select, disabled or otherwise (spec 1).
    expect('control' in row!).toBe(false);
    expect('action' in row!).toBe(false);
    expect('render' in row!).toBe(false);
    expect((row as { desc?: string }).desc).toBe(SYMLINK_POLICY_TEXT);
  });

  it('renders a storage disclosure', async () => {
    const { tab } = await makeTab([]);
    const defs = tab.getSettingDefinitions();
    const row = defs.find((d) => 'name' in d && d.name === 'Storage');
    expect(row).toBeDefined();
    expect((row as { desc?: string }).desc).toBe(STORAGE_DISCLOSURE_TEXT);
    // Neither of task 12's evidence-gated claims has leaked forward (ruling M25).
    expect(STORAGE_DISCLOSURE_TEXT).not.toContain('Read-only source access');
    expect(STORAGE_DISCLOSURE_TEXT).not.toContain('Source remains unchanged');
  });

  it('never hardcodes .obsidian anywhere in plugin source', () => {
    // obsidianmd/hardcoded-config-path (a protected lint rule) catches this too; this
    // test documents WHY the rule matters and fails loudly if src/** regresses.
    // A STRING LITERAL containing '.obsidian' is the hardcoded-config-path this
    // criterion (and the protected lint rule of the same name) forbids -- unlike a
    // prose mention inside a `//` comment (e.g. walker.ts's case-sensitivity example),
    // which is not a path value anywhere in the running program.
    const literalObsidian = /(['"`])(?:(?!\1).)*\.obsidian(?:(?!\1).)*\1/;
    const files = collect(join(process.cwd(), 'src')).filter((f) => f.endsWith('.ts') || f.endsWith('.vue'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      // Strip `//` line comments first: walker.ts's own case-sensitivity example
      // quotes '.obsidian' in prose inside a comment, which is not a path value
      // anywhere in the running program.
      const codeOnly = readFileSync(file, 'utf8').replace(/\/\/.*$/gm, '');
      expect(literalObsidian.test(codeOnly), file).toBe(false);
    }
  });

  it('does not render a control for any unimplemented capability', async () => {
    const { tab } = await makeTab([]);
    const defs = tab.getSettingDefinitions();
    // Exactly the profile list, the static symlink row and the storage disclosure --
    // nothing for lens, source-opening, trusted executables or any other out-of-scope
    // capability (spec 1).
    expect(defs.map((d) => ('name' in d ? d.name : ('heading' in d ? d.heading : undefined))))
      .toEqual(['Codebase profiles', 'Follow symbolic links', 'Storage']);
  });
});
