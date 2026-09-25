// WP-04 Task 8 (IN18, IN19, IP10, IP11): the Investigation notes folder setting row --
// its default, a valid change, three distinct refusals (not-relative, config-dir,
// unsafe-name) and the purge on profile removal (IP27, after the analyzer purge).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { Setting } from '../mocks/obsidian';
import type { App, Plugin, Setting as ObsidianSetting, SettingDefinitionItem, SettingDefinitionList,
  SettingDefinitionPage, SettingDefinitionRender, SettingGroup } from 'obsidian';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFakeFallowAnalysis, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import type { CodebaseProfile } from '../../src/domain/model';
import { NOTES_FOLDER_PROBLEM, PROFILE_INVESTIGATION_PURGE_FAILED } from '../../src/ui/inspector-copy';

function makeProfile(overrides: Partial<CodebaseProfile> = {}): CodebaseProfile {
  return { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 1_000_000, ...overrides };
}

// Real vault.configDir, never a literal '.obsidian' in PRODUCTION code -- this is test
// fixture data standing in for the real value settings-tab.ts reads at runtime.
const app = { vault: { configDir: '.obsidian' } } as unknown as App;

async function makeTab(initial: Record<string, string> = {}, analysis: FakeFallowAnalysis = createFakeFallowAnalysis()) {
  const profileHarness = createFakeProfileStoreHarness();
  await profileHarness.store.save(makeProfile());
  const investigations = createFakeInvestigationFolders(initial);
  const tab = new CodebaseInspectorSettingTab(
    app, {} as unknown as Plugin, profileHarness.store, createFakeBindingStoreHarness().store,
    () => createFakeSourceFileSystem({}).port, { purge: () => Promise.resolve() }, analysis, { remove: vi.fn() }, investigations);
  await tab.refresh();
  return { tab, investigations, profileStore: profileHarness.store, analysis };
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

function invokeRender(def: SettingDefinitionRender, setting: Setting): void {
  def.render(setting as unknown as ObsidianSetting, fakeGroup);
}

const containers: HTMLElement[] = [];
afterEach(() => {
  containers.splice(0).forEach((c) => { c.remove(); });
  document.querySelectorAll('.notice-container').forEach((n) => { n.remove(); });
});

function newContainer(): HTMLElement {
  const el = document.body.createDiv();
  containers.push(el);
  return el;
}

function renderFolderInput(tab: CodebaseInspectorSettingTab, profileName: string): HTMLInputElement {
  const page = findProfilePage(tab.getSettingDefinitions(), profileName);
  const def = findRenderDef(page.items, 'Investigation notes folder');
  const setting = new Setting(newContainer());
  invokeRender(def, setting);
  return setting.controlEl.querySelector<HTMLInputElement>('input[type="text"]')!;
}

describe('the Investigation notes folder row', () => {
  it('lists the row right after Excluded paths, showing the default folder', async () => {
    const { tab } = await makeTab();
    const page = findProfilePage(tab.getSettingDefinitions(), 'Alpha');
    const names = (page.items ?? []).map((i) => ('name' in i ? i.name : undefined));
    const excludedAt = names.indexOf('Excluded paths');
    expect(excludedAt).toBeGreaterThanOrEqual(0);
    expect(names[excludedAt + 1]).toBe('Investigation notes folder');
    expect(renderFolderInput(tab, 'Alpha').value).toBe('Codebase investigations/Alpha');
  });

  it('writes a valid change and re-renders the stored value', async () => {
    const { tab, investigations } = await makeTab();
    const input = renderFolderInput(tab, 'Alpha');
    input.value = 'Notes/Investigations';
    input.dispatchEvent(new Event('change'));
    await tab.waitForPendingUpdates();
    expect(investigations.folders.get('p1')).toBe('Notes/Investigations');
    expect(renderFolderInput(tab, 'Alpha').value).toBe('Notes/Investigations');
  });

  it.each([
    ['../x', 'not-relative'],
    ['.obsidian/notes', 'config-dir'],
    ['a/CON', 'unsafe-name'],
  ] as const)('refuses %s (%s): nothing is written, a Notice names the reason, the field reverts', async (raw, problem) => {
    const { tab, investigations } = await makeTab({ p1: 'Notes/Kept' });
    const input = renderFolderInput(tab, 'Alpha');
    input.value = raw;
    input.dispatchEvent(new Event('change'));
    await tab.waitForPendingUpdates();
    expect(investigations.folders.get('p1')).toBe('Notes/Kept');
    expect(document.querySelector('.notice')?.textContent).toBe(NOTES_FOLDER_PROBLEM[problem]);
    expect(renderFolderInput(tab, 'Alpha').value).toBe('Notes/Kept');
  });
});

describe('removing a profile purges its investigation notes folder setting (IP27)', () => {
  it('purges only after the analyzer purge; the notes folder entry is gone afterward', async () => {
    const analysis = createFakeFallowAnalysis();
    const { tab, investigations } = await makeTab({ p1: 'Notes/Kept' }, analysis);
    const analyzerPurge = vi.spyOn(analysis, 'purgeProfile');
    const investigationPurge = vi.spyOn(investigations, 'purge');
    findList(tab.getSettingDefinitions()).onDelete!(0);
    await flushPromises();
    expect(investigationPurge).toHaveBeenCalledWith('p1');
    expect(analyzerPurge.mock.invocationCallOrder[0]).toBeLessThan(investigationPurge.mock.invocationCallOrder[0]!);
    expect(investigations.folders.has('p1')).toBe(false);
  });

  it('shows PROFILE_INVESTIGATION_PURGE_FAILED when the purge fails, and never deletes the notes themselves', async () => {
    const { tab, investigations } = await makeTab({ p1: 'Notes/Kept' });
    vi.spyOn(investigations, 'purge').mockRejectedValue(new Error('Could not write data.json.'));
    findList(tab.getSettingDefinitions()).onDelete!(0);
    await flushPromises();
    expect(document.querySelector('.notice')?.textContent).toBe(PROFILE_INVESTIGATION_PURGE_FAILED('Could not write data.json.'));
  });
});
