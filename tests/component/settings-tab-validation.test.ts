// Fix wave items 1 (M1) and 6 (I5): what the settings tab SAYS about the exclusions
// field, and what it does when the store refuses an edit. Split out of
// tests/component/settings-tab.test.ts rather than appended to it: that file is at 435
// of the 450-line tests/** budget, and `max-lines` is a protected architectural rule --
// splitting is the clean idiom, weakening the rule is not.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Setting } from '../mocks/obsidian';
import type { App, Plugin, Setting as ObsidianSetting, SettingDefinitionItem,
  SettingDefinitionList, SettingDefinitionPage, SettingDefinitionRender, SettingGroup } from 'obsidian';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';
import { ValidationError } from '../../src/domain/validator';
import type { ProfileStore } from '../../src/application/ports/profile-store';
import type { CodebaseProfile } from '../../src/domain/model';

function makeProfile(overrides: Partial<CodebaseProfile> = {}): CodebaseProfile {
  return { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: ['dist'], maxFileBytes: 1_000_000, ...overrides };
}

function newTab(profileStore: ProfileStore): CodebaseInspectorSettingTab {
  return new CodebaseInspectorSettingTab(
    {} as unknown as App, {} as unknown as Plugin, profileStore, createFakeBindingStoreHarness().store,
    () => createFakeSourceFileSystem({}).port, { purge: () => Promise.resolve() }, createFakeFallowAnalysis(), { remove: vi.fn() });
}

async function makeTab(profiles: readonly CodebaseProfile[]) {
  const profileHarness = createFakeProfileStoreHarness();
  for (const p of profiles) await profileHarness.store.save(p);
  const tab = newTab(profileHarness.store);
  await tab.refresh();
  return { tab, profileStore: profileHarness.store };
}

function findProfilePage(defs: SettingDefinitionItem[], name: string): SettingDefinitionPage {
  const list = defs.find((d): d is SettingDefinitionList => 'type' in d && d.type === 'list');
  const page = (list?.items ?? []).find(
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

// One cast at the boundary, the same idiom tests/component/settings-tab.test.ts uses.
function invokeRender(def: SettingDefinitionRender, setting: Setting): void {
  def.render(setting as unknown as ObsidianSetting, {} as unknown as SettingGroup);
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

function renderExclusionsRow(tab: CodebaseInspectorSettingTab): Setting {
  const page = findProfilePage(tab.getSettingDefinitions(), 'Alpha');
  const setting = new Setting(newContainer());
  invokeRender(findRenderDef(page.items, 'Excluded paths'), setting);
  return setting;
}

describe('the exclusions field describes only what the walker can actually honour (M1)', () => {
  it('does NOT promise pattern support the walker has no implementation for', async () => {
    const { tab } = await makeTab([makeProfile()]);
    const setting = renderExclusionsRow(tab);
    // walker.ts's isExcluded does exact segment/prefix matching and nothing else, so a
    // label inviting a "pattern" invites input that is accepted, persisted, redisplayed
    // on the consent screen as an approved exclusion -- and excludes nothing.
    expect(setting.settingEl.textContent).toContain('One relative path per line.');
    expect(setting.settingEl.textContent).not.toContain('pattern');
  });
});

// Fix wave item 6 (I5, Important): settings-tab.ts wrapped profileStore.update in
// `try { ... } catch {}` with an EMPTY body, so a user who typed `./dist` into Excluded
// paths -- accepted by the UI, rejected by the validator -- watched the field silently
// revert with no explanation at all. Spec 7: "Validation failures surface as visible
// warnings carrying their reason. Never dropped silently." The comment there was right
// that the value is never silently COERCED; it was silently DISCARDED, which the spec
// names separately.
// Hoisted to module scope (oxlint's consistent-function-scoping): captures nothing from
// the describe block.
function noticeTexts(): string[] {
  return [...document.querySelectorAll('.notice')].map((n) => n.textContent ?? '');
}

// Hoisted to module scope for the same reason noticeTexts() is (oxlint's
// consistent-function-scoping): it captures nothing, and the M62 block below drives the
// exclusions field exactly the same way.
async function typeExclusions(tab: CodebaseInspectorSettingTab, value: string): Promise<void> {
  const textarea = renderExclusionsRow(tab).controlEl.querySelector<HTMLTextAreaElement>('textarea')!;
  textarea.value = value;
  textarea.dispatchEvent(new Event('change'));
  await tab.waitForPendingUpdates();
}

describe('a rejected settings edit surfaces its reason (I5)', () => {
  it('shows the validator\u2019s reason in a Notice instead of reverting in silence', async () => {
    const { tab, profileStore } = await makeTab([makeProfile()]);
    await typeExclusions(tab, './dist');

    const notices = noticeTexts();
    expect(notices.length).toBeGreaterThan(0);
    expect(notices.join(' ')).toMatch(/no empty segments and no \. or \.\. segments/);
    expect(notices.join(' ')).toContain('./dist');
    // Still never silently coerced: the unedited value is what remains persisted.
    expect((await profileStore.get('p1'))!.exclusions).toEqual(['dist']);
  });

  it('surfaces EVERY reason, not just the first', async () => {
    const { tab } = await makeTab([makeProfile()]);
    await typeExclusions(tab, './dist\n*.log\n/etc/passwd');

    const text = noticeTexts().join(' ');
    // ValidationError already collects all of them; that design work was being thrown
    // away here.
    expect(text).toContain('./dist');
    expect(text).toContain('*.log');
    expect(text).toContain('/etc/passwd');
  });

  it('stays silent when the edit is valid', async () => {
    const { tab, profileStore } = await makeTab([makeProfile()]);
    await typeExclusions(tab, 'dist\nnode_modules');

    expect(noticeTexts()).toEqual([]);
    expect((await profileStore.get('p1'))!.exclusions).toEqual(['dist', 'node_modules']);
  });
});

// Ruling M62 (breakage round, item 1): the glob refusal is an INPUT-surface rule, not a
// persisted-record rule -- `codebaseProfileSchema` no longer carries it, because doing
// so retroactively invalidated already-stored profiles. The settings tab is the SECOND
// place a user can type an exclusion (the scope modal is the first), and it is the one
// the fix wave never gave the check. Without it here, `*.log` would now be accepted,
// persisted, redisplayed on the consent screen as an approved exclusion, and exclude
// nothing -- exactly the defect M1 was raised against.
describe('the settings tab refuses a glob exclusion at the input surface (M62)', () => {
  it('shows a visible reason and does not persist it', async () => {
    const { tab, profileStore } = await makeTab([makeProfile()]);
    await typeExclusions(tab, '*.log');

    expect(noticeTexts().join(' ')).toMatch(/\* and \? are not supported/);
    expect(noticeTexts().join(' ')).toContain('*.log');
    // Never silently coerced and never silently accepted: the stored value is unchanged.
    expect((await profileStore.get('p1'))!.exclusions).toEqual(['dist']);
  });

  it('still accepts a plain path the walker can actually honour', async () => {
    const { tab, profileStore } = await makeTab([makeProfile()]);
    await typeExclusions(tab, 'dist\nlogs');

    expect(noticeTexts()).toEqual([]);
    expect((await profileStore.get('p1'))!.exclusions).toEqual(['dist', 'logs']);
  });
});

// A ProfileStore whose list() succeeds `succeedFor` times and then rejects. Module
// scope, per oxlint's consistent-function-scoping: it captures nothing.
function makeFailingStore(
  profiles: readonly CodebaseProfile[], succeedFor: number, reason: Error,
): ProfileStore {
  let calls = 0;
  return {
    list: () => { calls += 1; return calls > succeedFor ? Promise.reject(reason) : Promise.resolve(profiles); },
    get: () => Promise.resolve(null),
    save: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    update: () => Promise.resolve(),
  };
}

// Ruling M63 (breakage round, item 1, independently of globs): PluginDataProfileStore
// .list() throws on ANY one malformed record -- a hand-edited data.json, a record from
// a future schema. refresh() propagated that, and main.ts's `void settingTab.refresh()`
// turned it into an unhandled rejection in a console nobody opens, leaving the tab
// rendered from `entries = []`: every profile gone, no reason shown. Spec 7:
// "Validation failures surface as visible warnings carrying their reason. Never dropped
// silently." This is the destination city-view.ts's withScanGuard already has.
describe('a profile list that fails to load has a real destination (M63)', () => {
  it('surfaces every reason instead of rejecting, so `void refresh()` cannot go unhandled', async () => {
    const reason = new ValidationError(['unknown key: rootPath', 'name: expected string'], 'Codebase profile');
    const tab = newTab(makeFailingStore([], 0, reason));

    await expect(tab.refresh()).resolves.toBeUndefined();

    const text = noticeTexts().join(' ');
    expect(text).toContain('unknown key: rootPath');
    expect(text).toContain('name: expected string');
  });

  it('keeps the profiles it already had rather than silently emptying the list', async () => {
    const tab = newTab(makeFailingStore([makeProfile()], 1, new Error('data.json is corrupt')));
    await tab.refresh();

    await expect(tab.refresh()).resolves.toBeUndefined();

    const list = tab.getSettingDefinitions().find(
      (d): d is SettingDefinitionList => 'type' in d && d.type === 'list');
    expect((list?.items ?? []).map((i) => ('name' in i ? i.name : undefined))).toEqual(['Alpha']);
    expect(noticeTexts().join(' ')).toContain('data.json is corrupt');
  });
});
