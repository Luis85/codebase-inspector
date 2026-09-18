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
import { BINDING_MISSING_TEXT, RECONNECT_NOT_AVAILABLE_TEXT, STORAGE_DISCLOSURE_TEXT,
  SYMLINK_POLICY_TEXT } from '../../src/host/setting-definitions';

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
afterEach(() => {
  containers.splice(0).forEach((c) => { c.remove(); });
  // Fix round 1, Important 2: Notice appends to document.body directly (real Obsidian
  // behaviour), outside any container this suite tracks otherwise -- clean it up so a
  // stale notice from an earlier test cannot make a later "a notice appeared" assertion
  // pass vacuously.
  document.querySelectorAll('.notice-container').forEach((n) => { n.remove(); });
});

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
      // Strip block comments (/* ... */, including /** ... */ JSDoc) and `//` line
      // comments before checking: walker.ts's case-sensitivity example quotes
      // '.obsidian' in a `//` comment, and plugin-data-binding-store.ts's machineId
      // doc comment (fix round 1, Important 3) cites "docs.obsidian.md" by domain name
      // in a `/** */` block -- neither is a path value anywhere in the running program.
      const codeOnly = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
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

  // Fix round 1, Important 2 (ruling M26): an enabled button that silently does
  // nothing is a broken promise a disabled one would not have made. Reconnect/Connect
  // must produce a visible, honest response.
  it('shows a visible, honest notice when Reconnect is clicked, not a silent no-op', async () => {
    const { tab } = await makeTab([makeProfile({ profileId: 'p1', bindingId: 'b1' })]);
    // bindingId 'b1' was never saved to the binding store: "missing on this machine".
    const page = findProfilePage(tab.getSettingDefinitions(), 'Alpha');
    const def = findRenderDef(page.items, 'Source folder');
    const setting = new Setting(newContainer());
    invokeRender(def, setting);
    const reconnectButton = setting.settingEl.querySelector<HTMLButtonElement>('[data-action="reconnect"]');
    expect(reconnectButton).not.toBeNull();
    expect(document.querySelector('.notice')).toBeNull();

    reconnectButton!.click();

    const notice = document.querySelector('.notice');
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toBe(RECONNECT_NOT_AVAILABLE_TEXT);
    // Truthful and undated (ruling M26): no specific version or date is promised.
    expect(RECONNECT_NOT_AVAILABLE_TEXT).not.toMatch(/\d/);
  });

  it('shows the same visible notice when Connect is clicked for a never-bound profile', async () => {
    const { tab } = await makeTab([makeProfile({ profileId: 'p1', bindingId: null })]);
    const page = findProfilePage(tab.getSettingDefinitions(), 'Alpha');
    const def = findRenderDef(page.items, 'Source folder');
    const setting = new Setting(newContainer());
    invokeRender(def, setting);
    const connectButton = setting.settingEl.querySelector<HTMLButtonElement>('[data-action="connect"]');
    expect(connectButton).not.toBeNull();

    connectButton!.click();

    expect(document.querySelector('.notice')?.textContent).toBe(RECONNECT_NOT_AVAILABLE_TEXT);
  });

  // Fix round 1, Important 4: renderNameRow/renderExclusionsRow/renderMaxFileBytesRow
  // and their onRenameProfile/onExclusionsChange/onMaxFileBytesChange wiring had no
  // coverage at any level. Driven end to end through the real settings-tab wiring below
  // (dispatch a real DOM 'change' event, not a direct callback call).
  it('renames the CORRECT profile through the settings-tab wiring, not a swapped id', async () => {
    const { tab, profileStore } = await makeTab([
      makeProfile({ profileId: 'p1', name: 'Alpha' }),
      makeProfile({ profileId: 'p2', name: 'Beta' }),
    ]);
    const page = findProfilePage(tab.getSettingDefinitions(), 'Beta');
    const def = findRenderDef(page.items, 'Name');
    const setting = new Setting(newContainer());
    invokeRender(def, setting);
    const input = setting.controlEl.querySelector<HTMLInputElement>('input[type="text"]')!;
    input.value = 'Beta Renamed';
    input.dispatchEvent(new Event('change'));

    await tab.waitForPendingUpdates();
    expect((await profileStore.get('p2'))!.name).toBe('Beta Renamed');
    // A swapped id (editing p2's row but writing p1) would fail this line.
    expect((await profileStore.get('p1'))!.name).toBe('Alpha');
  });

  it('edits exclusions through the settings-tab wiring', async () => {
    const { tab, profileStore } = await makeTab([makeProfile({ profileId: 'p1' })]);
    const page = findProfilePage(tab.getSettingDefinitions(), 'Alpha');
    const def = findRenderDef(page.items, 'Excluded paths');
    const setting = new Setting(newContainer());
    invokeRender(def, setting);
    const textarea = setting.controlEl.querySelector<HTMLTextAreaElement>('textarea')!;
    textarea.value = 'dist\nnode_modules\n\n  \n';
    textarea.dispatchEvent(new Event('change'));

    await tab.waitForPendingUpdates();
    // Blank/whitespace-only lines are dropped, matching parseExclusions.
    expect((await profileStore.get('p1'))!.exclusions).toEqual(['dist', 'node_modules']);
  });

  it('edits maxFileBytes through the settings-tab wiring', async () => {
    const { tab, profileStore } = await makeTab([makeProfile({ profileId: 'p1' })]);
    const page = findProfilePage(tab.getSettingDefinitions(), 'Alpha');
    const def = findRenderDef(page.items, 'Maximum file size to read');
    const setting = new Setting(newContainer());
    invokeRender(def, setting);
    const input = setting.controlEl.querySelector<HTMLInputElement>('input[type="number"]')!;
    input.value = '2000000';
    input.dispatchEvent(new Event('change'));

    await tab.waitForPendingUpdates();
    expect((await profileStore.get('p1'))!.maxFileBytes).toBe(2_000_000);
  });

  // Fix round 1, Critical 1 + Important 4 combined: the exact ordinary-use scenario
  // named in the finding, driven through the real UI wiring end to end -- a user
  // renames a profile then, before that save round-trips, edits its exclusions.
  it('survives an interleaved rename and exclusions edit on the SAME profile, fired without an await between them', async () => {
    const { tab, profileStore } = await makeTab([makeProfile({ profileId: 'p1', name: 'Original', exclusions: [] })]);
    const page = findProfilePage(tab.getSettingDefinitions(), 'Original');
    const nameSetting = new Setting(newContainer());
    invokeRender(findRenderDef(page.items, 'Name'), nameSetting);
    const exclusionsSetting = new Setting(newContainer());
    invokeRender(findRenderDef(page.items, 'Excluded paths'), exclusionsSetting);

    const nameInput = nameSetting.controlEl.querySelector<HTMLInputElement>('input[type="text"]')!;
    const exclusionsTextarea = exclusionsSetting.controlEl.querySelector<HTMLTextAreaElement>('textarea')!;
    nameInput.value = 'Renamed';
    exclusionsTextarea.value = 'dist';
    // No await between these two dispatches -- this is what two near-simultaneous
    // settings-tab events produce in real use.
    nameInput.dispatchEvent(new Event('change'));
    exclusionsTextarea.dispatchEvent(new Event('change'));

    await tab.waitForPendingUpdates();
    const profile = (await profileStore.get('p1'))!;
    // Not vacuous: before this fix round, one of these two always lost.
    expect(profile.name).toBe('Renamed');
    expect(profile.exclusions).toEqual(['dist']);
  });
});
