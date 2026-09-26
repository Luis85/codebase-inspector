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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Setting } from '../mocks/obsidian';
import type { App, Plugin, Setting as ObsidianSetting, SettingDefinitionItem, SettingDefinitionList,
  SettingDefinitionPage, SettingDefinitionRender, SettingGroup } from 'obsidian';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';
import type { CodebaseProfile, LocalBinding } from '../../src/domain/model';
import { BINDING_MISSING_TEXT, STORAGE_DISCLOSURE_TEXT, SYMLINK_POLICY_TEXT } from '../../src/host/setting-definitions';
import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';

function makeProfile(overrides: Partial<CodebaseProfile> = {}): CodebaseProfile {
  return { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 1_000_000, ...overrides };
}

async function makeTab(
  profiles: readonly CodebaseProfile[],
  bindings: readonly LocalBinding[] = [],
  filesystem: SourceFileSystemPort = createFakeSourceFileSystem({}).port,
  // Fix round 3 (ruling M44): defaults to '{}' exactly as before -- every EXISTING test
  // only ever drives the source modal's 'external' mode (never touches app.vault at
  // all), so this stays a no-op override for them. The new "Add profile" test below
  // supplies a real vault.configDir instead.
  app: App = {} as unknown as App,
) {
  const profileHarness = createFakeProfileStoreHarness();
  const bindingHarness = createFakeBindingStoreHarness();
  for (const p of profiles) await profileHarness.store.save(p);
  for (const b of bindings) await bindingHarness.store.save(b);
  const tab = new CodebaseInspectorSettingTab(
    app, {} as unknown as Plugin, profileHarness.store, bindingHarness.store, () => filesystem, { purge: () => Promise.resolve() }, createFakeFallowAnalysis(), { remove: vi.fn() }, createFakeInvestigationFolders());
  await tab.refresh();
  return { tab, profileStore: profileHarness.store, bindingStore: bindingHarness.store };
}

// Task 7 (ruling M30): the settings tab's Connect/Reconnect button opens the real
// source-selection modal. These tests drive that modal exactly as
// tests/component/source-modal.test.ts does -- real DOM, no shortcuts into its
// private state -- so "wired to the real modal" is proven by actually opening and
// completing it, not by a mock that stands in for the modal itself.
function findModal(): HTMLElement {
  const el = document.querySelector('.modal-container');
  if (!el) throw new Error('no modal is open');
  return el as HTMLElement;
}

function completeExternalSelection(resolvedRoot: string): void {
  const modal = findModal();
  const externalRadio = modal.querySelector<HTMLInputElement>('input[type="radio"][value="external"]')!;
  externalRadio.checked = true;
  externalRadio.dispatchEvent(new Event('change'));
  const input = modal.querySelector<HTMLInputElement>('[data-field="external-path"]')!;
  input.value = resolvedRoot;
  input.dispatchEvent(new Event('input'));
  modal.querySelector<HTMLButtonElement>('[data-action="continue"]')!.click();
}

function cancelModal(): void {
  findModal().querySelector<HTMLButtonElement>('[data-action="cancel"]')!.click();
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
  // Task 7: a cancelled or abandoned source modal from an earlier test must not be
  // picked up by findModal() in a later one.
  document.querySelectorAll('.modal-container').forEach((m) => { m.remove(); });
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
    expect(STORAGE_DISCLOSURE_TEXT).not.toContain('Scanning never changes the source');
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
  }, 30_000);

  it('does not render a control for any unimplemented capability', async () => {
    const { tab } = await makeTab([]);
    const defs = tab.getSettingDefinitions();
    // Exactly the profile list, the static symlink row and the storage disclosure --
    // nothing for lens, source-opening, trusted executables or any other out-of-scope
    // capability (spec 1).
    expect(defs.map((d) => ('name' in d ? d.name : ('heading' in d ? d.heading : undefined))))
      .toEqual(['Codebase profiles', 'Follow symbolic links', 'Storage']);
  });

  // Ruling M30: task 7 owns wiring Connect/Reconnect to the real source-selection
  // modal task 6 deliberately left as a placeholder. This is the first caller of
  // LocalBindingStore.save() -- task-7-context.md section 9's trap -- so the covering
  // assertion below checks the profile's bindingId is a NEW id (never read from a
  // prior get()+mutate()+save() on this store), and that both the binding row and the
  // profile update land correctly.
  it('opens the source modal when Connect is clicked for a never-bound profile, and binds it on a successful selection', async () => {
    const { port } = createFakeSourceFileSystem({});
    const { tab, profileStore, bindingStore } = await makeTab(
      [makeProfile({ profileId: 'p1', bindingId: null })], [], port);
    const page = findProfilePage(tab.getSettingDefinitions(), 'Alpha');
    const def = findRenderDef(page.items, 'Source folder');
    const setting = new Setting(newContainer());
    invokeRender(def, setting);
    const connectButton = setting.settingEl.querySelector<HTMLButtonElement>('[data-action="connect"]');
    expect(connectButton).not.toBeNull();

    connectButton!.click();
    expect(document.querySelector('.modal-container')).not.toBeNull();
    completeExternalSelection('/fake-root');
    await tab.waitForPendingUpdates();

    const profile = (await profileStore.get('p1'))!;
    expect(profile.bindingId).not.toBeNull();
    const binding = await bindingStore.get(profile.bindingId!);
    expect(binding?.rootPath).toBe('/fake-root');
  });

  it('reconnects an existing binding to a new root WITHOUT changing the profile\'s bindingId', async () => {
    const { port } = createFakeSourceFileSystem({});
    // bindingId 'b1' was never saved to the binding store: "missing on this machine"
    // (COPY-28) -- exactly the state Reconnect is for.
    const { tab, profileStore, bindingStore } = await makeTab(
      [makeProfile({ profileId: 'p1', bindingId: 'b1' })], [], port);
    const page = findProfilePage(tab.getSettingDefinitions(), 'Alpha');
    const def = findRenderDef(page.items, 'Source folder');
    const setting = new Setting(newContainer());
    invokeRender(def, setting);
    const reconnectButton = setting.settingEl.querySelector<HTMLButtonElement>('[data-action="reconnect"]');
    expect(reconnectButton).not.toBeNull();

    reconnectButton!.click();
    completeExternalSelection('/fake-root');
    await tab.waitForPendingUpdates();

    const profile = (await profileStore.get('p1'))!;
    expect(profile.bindingId).toBe('b1');   // unchanged -- same logical connection
    const binding = await bindingStore.get('b1');
    expect(binding?.rootPath).toBe('/fake-root');
  });

  it('changes nothing when the source modal is cancelled', async () => {
    const { port } = createFakeSourceFileSystem({});
    const { tab, profileStore, bindingStore } = await makeTab(
      [makeProfile({ profileId: 'p1', bindingId: null })], [], port);
    const page = findProfilePage(tab.getSettingDefinitions(), 'Alpha');
    const def = findRenderDef(page.items, 'Source folder');
    const setting = new Setting(newContainer());
    invokeRender(def, setting);
    setting.settingEl.querySelector<HTMLButtonElement>('[data-action="connect"]')!.click();

    cancelModal();
    await tab.waitForPendingUpdates();

    const profile = (await profileStore.get('p1'))!;
    expect(profile.bindingId).toBeNull();
    expect(port.readLog()).toEqual([]);
    expect(await bindingStore.get('b1')).toBeNull();
  });

  // Fix round 1, Minor 3 (folded): reconnect() is the FIRST call site anywhere that
  // calls bindingStore.save() (task-7-context.md section 9's trap), and it also calls
  // profileStore.update() when the profile was never bound -- the same primitive a
  // concurrent rename uses on the SAME profile id. Fired with NO await between the two
  // dispatches, matching what a user clicking Connect and then immediately renaming
  // produces in real use. A test that awaits between the two proves nothing, because
  // the bug this guards against (task 6's Critical 1) only manifests without the await.
  it('survives a reconnect racing a profile rename, fired without an await between them', async () => {
    const { port } = createFakeSourceFileSystem({});
    const { tab, profileStore, bindingStore } = await makeTab(
      [makeProfile({ profileId: 'p1', name: 'Original', bindingId: null })], [], port);
    const page = findProfilePage(tab.getSettingDefinitions(), 'Original');

    const nameSetting = new Setting(newContainer());
    invokeRender(findRenderDef(page.items, 'Name'), nameSetting);
    const nameInput = nameSetting.controlEl.querySelector<HTMLInputElement>('input[type="text"]')!;

    const sourceSetting = new Setting(newContainer());
    invokeRender(findRenderDef(page.items, 'Source folder'), sourceSetting);
    const connectButton = sourceSetting.settingEl.querySelector<HTMLButtonElement>('[data-action="connect"]')!;

    nameInput.value = 'Renamed';
    // No await between these two -- both a profileStore.update() (rename) and a
    // reconnect (bindingStore.save() + profileStore.update() for the new bindingId)
    // are now in flight concurrently against the SAME profile id.
    nameInput.dispatchEvent(new Event('change'));
    connectButton.click();
    completeExternalSelection('/fake-root');

    await tab.waitForPendingUpdates();

    const profile = (await profileStore.get('p1'))!;
    expect(profile.name).toBe('Renamed');        // the rename survives
    expect(profile.bindingId).not.toBeNull();    // the reconnect survives too
    const binding = await bindingStore.get(profile.bindingId!);
    expect(binding?.rootPath).toBe('/fake-root');
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

  // Fix round 3, ruling M44 (Critical): "Add profile" must use the SAME default
  // exclusions scan-flow.ts's resolveOrCreateProfile uses, so the two paths cannot
  // drift apart -- driven through the REAL settings-tab wiring (the list's addItem
  // action), with a real vault.configDir supplied, never a literal '.obsidian'.
  it('"Add profile" creates a profile with the M44 default exclusions, using the real vault.configDir', async () => {
    const app = { vault: { configDir: '.my-vault-config' } } as unknown as App;
    const { tab, profileStore } = await makeTab([], [], undefined, app);
    const [list] = tab.getSettingDefinitions() as [SettingDefinitionList];
    const affordanceEl = newContainer();
    list.addItem!.action(affordanceEl);

    for (let i = 0; i < 50 && (await profileStore.list()).length < 1; i += 1) await Promise.resolve();
    const profiles = await profileStore.list();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]!.exclusions).toEqual(['.git', 'node_modules', '.env', '.my-vault-config']);
    expect(profiles[0]!.name).toBe('New profile');
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
