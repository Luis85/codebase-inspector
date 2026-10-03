// Part 7 Z11/Z12: each profile page shows its fallow executable and, when one is chosen,
// its time limit. Forget and the time limit go through the service; a busy or invalid
// answer is shown and changes nothing; removing a profile purges its executable setting.
// A new file: settings-tab.test.ts is at 435 lines.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { Setting } from '../mocks/obsidian';
import type { App, Plugin, Setting as ObsidianSetting, SettingDefinitionList,
  SettingDefinitionPage, SettingDefinitionRender, SettingGroup } from 'obsidian';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { STORAGE_DISCLOSURE_TEXT, analyzerDescription } from '../../src/host/setting-definitions';
import type { AnalyzerBindingRead } from '../../src/application/analysis/analyzer-record';
import { AnalyzerStoreError } from '../../src/application/analysis/analyzer-record';
import type { CodebaseProfile } from '../../src/domain/model';
import {
  FALLOW_EXE_NONE, FALLOW_EXE_OTHER_DEVICE, FALLOW_EXE_UNSUPPORTED, FALLOW_PROFILE_REMOVED, FALLOW_TRUST_VALUE, PROFILE_ANALYZER_PURGE_FAILED,
  SETTINGS_FALLOW_BUSY, SETTINGS_FALLOW_LIMIT_DESC, SETTINGS_FALLOW_LIMIT_INVALID, SETTINGS_FALLOW_STORE_FAILED,
} from '../../src/ui/inspector-copy';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFakeFallowAnalysis, type FakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';

const EXE = 'C:\\Tools\\fallow\\fallow.exe';
const TRUST = { fingerprint: '0a1b2c3d', version: '3.27.0', grantedAt: '2026-09-23T10:00:00.000Z' };
// PF9: typed via Extract, not the whole AnalyzerBindingRead union, so BOUND.binding below
// (used to build variant fixtures for the other describe blocks) type-checks.
const BOUND: Extract<AnalyzerBindingRead, { kind: 'bound' }> =
  { kind: 'bound', binding: { profileId: 'p1', executablePath: EXE, timeoutSeconds: 300, trust: TRUST } };
const profile: CodebaseProfile = { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: [], maxFileBytes: 1_000_000 };
const fakeGroup = {} as unknown as SettingGroup;

async function makeTab(read: AnalyzerBindingRead | null): Promise<{ tab: CodebaseInspectorSettingTab; analysis: FakeFallowAnalysis }> {
  const profiles = createFakeProfileStoreHarness();
  await profiles.store.save(profile);
  const analysis = createFakeFallowAnalysis();
  if (read !== null) analysis.setBinding('p1', read);
  const tab = new CodebaseInspectorSettingTab(
    {} as unknown as App, {} as unknown as Plugin, profiles.store, createFakeBindingStoreHarness().store,
    () => createFakeSourceFileSystem({}).port, { purge: () => Promise.resolve() }, analysis, { remove: vi.fn() }, createFakeInvestigationFolders());
  await tab.refresh();
  return { tab, analysis };
}
function page(tab: CodebaseInspectorSettingTab): SettingDefinitionPage {
  const list = tab.getSettingDefinitions().find((d): d is SettingDefinitionList => 'type' in d && d.type === 'list');
  const found = (list?.items ?? []).find((item): item is SettingDefinitionPage => 'type' in item && item.type === 'page');
  if (!found) throw new Error('no profile page');
  return found;
}
const rowNames = (tab: CodebaseInspectorSettingTab): string[] => (page(tab).items ?? []).map((i) => (i as { name: string }).name);
function render(tab: CodebaseInspectorSettingTab, name: string): Setting {
  const def = (page(tab).items ?? []).find((i): i is SettingDefinitionRender => 'render' in i && i.name === name);
  if (!def) throw new Error(`no row ${name}`);
  const setting = new Setting(document.body.createDiv());
  def.render(setting as unknown as ObsidianSetting, fakeGroup);
  return setting;
}
afterEach(() => {
  document.body.replaceChildren();
});

describe('the fallow executable row (Z12)', () => {
  it('without a record: the none text, no Forget, and no time-limit row', async () => {
    const { tab } = await makeTab(null);
    expect(rowNames(tab)).toEqual(['Name', 'Excluded paths', 'Investigation notes folder', 'Maximum file size to read', 'Source folder', 'fallow executable']);
    const row = render(tab, 'fallow executable');
    expect(row.nameEl.textContent).toBe('fallow executable');
    expect(row.descEl.textContent).toBe(FALLOW_EXE_NONE);
    expect(row.controlEl.querySelector('[data-action="forget-analyzer"]')).toBeNull();
  });

  it('bound: the path and its trust, Forget, and the time-limit row after it', async () => {
    const { tab } = await makeTab(BOUND);
    expect(rowNames(tab).slice(-2)).toEqual(['fallow executable', 'fallow time limit']);
    expect(render(tab, 'fallow executable').descEl.textContent).toBe(`${EXE} · ${FALLOW_TRUST_VALUE('3.27.0', true)}`);
    expect(render(tab, 'fallow executable').controlEl.querySelector('[data-action="forget-analyzer"]')).not.toBeNull();
    const limit = render(tab, 'fallow time limit');
    expect(limit.descEl.textContent).toBe(SETTINGS_FALLOW_LIMIT_DESC);
    expect(limit.controlEl.querySelector('input')?.value).toBe('300');
  });

  it('describes every read kind, and offers Forget except with none or a newer format', () => {
    expect(analyzerDescription({ kind: 'other-machine' })).toBe(FALLOW_EXE_OTHER_DEVICE);
    expect(analyzerDescription({ kind: 'unsupported' })).toBe(FALLOW_EXE_UNSUPPORTED);
    expect(analyzerDescription({ kind: 'bound', binding: { ...BOUND.binding, trust: null } })).toBe(`${EXE} · ${FALLOW_TRUST_VALUE(null, false)}`);
    expect(analyzerDescription({ kind: 'bound', binding: { ...BOUND.binding, trust: { ...TRUST, version: '3.28.0' } } }))
      .toBe(`${EXE} · ${FALLOW_TRUST_VALUE('3.28.0', false)}`);
  });

  it('shows Forget for another device\'s record, but not for a newer-format one', async () => {
    const other = (await makeTab({ kind: 'other-machine' })).tab;
    expect(render(other, 'fallow executable').controlEl.querySelector('[data-action="forget-analyzer"]')).not.toBeNull();
    const newer = (await makeTab({ kind: 'unsupported' })).tab;
    expect(render(newer, 'fallow executable').controlEl.querySelector('[data-action="forget-analyzer"]')).toBeNull();
  });
});

describe('Forget and the time limit go through the service (Z10, Z11)', () => {
  it('Forget asks the service, then refreshes; busy is shown and changes nothing', async () => {
    const { tab, analysis } = await makeTab(BOUND);
    render(tab, 'fallow executable').controlEl.querySelector<HTMLButtonElement>('[data-action="forget-analyzer"]')!.click();
    await tab.waitForPendingUpdates();
    expect(analysis.calls.filter((c) => c.method === 'forget')).toEqual([{ method: 'forget', profileId: 'p1' }]);
    analysis.next.forget = 'busy';
    render(tab, 'fallow executable').controlEl.querySelector<HTMLButtonElement>('[data-action="forget-analyzer"]')!.click();
    await tab.waitForPendingUpdates();
    expect(document.querySelector('.notice')?.textContent).toBe(SETTINGS_FALLOW_BUSY);
  });

  it('a time limit is sent as a number; an invalid one is refused with a reason', async () => {
    const { tab, analysis } = await makeTab(BOUND);
    const setTimeLimit = vi.spyOn(analysis, 'setTimeLimit');
    const input = render(tab, 'fallow time limit').controlEl.querySelector('input')!;
    input.value = '600';
    input.dispatchEvent(new Event('change'));
    await tab.waitForPendingUpdates();
    expect(setTimeLimit).toHaveBeenLastCalledWith('p1', 600);
    analysis.next.setTimeLimit = 'invalid';
    input.value = '';
    input.dispatchEvent(new Event('change'));
    await tab.waitForPendingUpdates();
    expect(setTimeLimit).toHaveBeenLastCalledWith('p1', Number.NaN);
    expect(document.querySelector('.notice')?.textContent).toBe(SETTINGS_FALLOW_LIMIT_INVALID);
  });

  it('final review: a Forget or a time limit refused for a removed codebase says so', async () => {
    const { tab, analysis } = await makeTab(BOUND);
    analysis.next.forget = 'removed';
    render(tab, 'fallow executable').controlEl.querySelector<HTMLButtonElement>('[data-action="forget-analyzer"]')!.click();
    await tab.waitForPendingUpdates();
    expect(document.querySelector('.notice')?.textContent).toBe(FALLOW_PROFILE_REMOVED);
    document.body.replaceChildren();
    analysis.next.setTimeLimit = 'removed';
    const input = render(tab, 'fallow time limit').controlEl.querySelector('input')!;
    input.value = '600';
    input.dispatchEvent(new Event('change'));
    await tab.waitForPendingUpdates();
    expect(document.querySelector('.notice')?.textContent).toBe(FALLOW_PROFILE_REMOVED);
  });
});

describe('Polish D1, D3: a failed Forget or time limit is shown in words', () => {
  it('D1: a refused Forget shows the reason, never "analyzer store: not-bound"', async () => {
    const { tab, analysis } = await makeTab(BOUND);
    vi.spyOn(analysis, 'forget').mockRejectedValue(new AnalyzerStoreError('not-bound'));
    render(tab, 'fallow executable').controlEl.querySelector('button')!.click();
    await tab.waitForPendingUpdates();
    expect(document.querySelector('.notice')?.textContent).toBe(SETTINGS_FALLOW_STORE_FAILED['not-bound']);
  });

  it('D3: a time limit whose write throws an ordinary error shows that error and refreshes', async () => {
    const { tab, analysis } = await makeTab(BOUND);
    vi.spyOn(analysis, 'setTimeLimit').mockRejectedValue(new Error('Could not write data.json.'));
    const refresh = vi.spyOn(tab, 'refresh');
    const input = render(tab, 'fallow time limit').controlEl.querySelector('input')!;
    input.value = '600';
    input.dispatchEvent(new Event('change'));
    await tab.waitForPendingUpdates();
    expect(document.querySelector('.notice')?.textContent).toBe('Could not write data.json.');
    expect(refresh).toHaveBeenCalled();
  });
});

describe('removing a profile purges its executable setting (Z11)', () => {
  it('purges after the profile is removed; a failed purge says so and the list refreshes', async () => {
    const { tab, analysis } = await makeTab(BOUND);
    const purge = vi.spyOn(analysis, 'purgeProfile').mockRejectedValue(new Error('Could not write data.json.'));
    const list = tab.getSettingDefinitions().find((d): d is SettingDefinitionList => 'type' in d && d.type === 'list');
    list!.onDelete!(0);
    await flushPromises();
    expect(purge).toHaveBeenCalledWith('p1');
    expect(document.querySelector('.notice')?.textContent).toBe(PROFILE_ANALYZER_PURGE_FAILED('Could not write data.json.'));
  });
});

describe('the storage disclosure (Z12)', () => {
  it('names the executable setting, its fingerprint and the device rule', () => {
    expect(STORAGE_DISCLOSURE_TEXT).toBe(
      'Codebase profiles, local folder bindings and each codebase’s review decisions (work items, boundary rules and finding decisions) are stored in this vault, in this plugin’s own data file, and survive restarts. When you choose a fallow executable for a codebase, its path, its time limit and a fingerprint of what you trusted (the executable’s path, size and modification time, the folder, the arguments and the fallow version) are stored there too, marked with this device: another device never runs it without asking again. Each codebase’s investigation notes folder is stored there too. Removing a profile removes its review decisions, its executable setting and its notes folder setting; it never deletes the investigation notes you created. fallow findings, imported or collected, are kept for this session only. Nothing about them is sent anywhere else.');
  });
});

describe('the settings definitions stay declarative', () => {
  it('uses no SettingDefinitionItem with a control for the time limit when nothing is bound', async () => {
    const { tab } = await makeTab({ kind: 'invalid' });
    expect(rowNames(tab)).not.toContain('fallow time limit');
    expect(tab.getSettingDefinitions().length).toBeGreaterThan(0);
  });
});
