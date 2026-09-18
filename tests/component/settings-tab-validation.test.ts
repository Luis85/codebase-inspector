// Fix wave items 1 (M1) and 6 (I5): what the settings tab SAYS about the exclusions
// field, and what it does when the store refuses an edit. Split out of
// tests/component/settings-tab.test.ts rather than appended to it: that file is at 435
// of the 450-line tests/** budget, and `max-lines` is a protected architectural rule --
// splitting is the clean idiom, weakening the rule is not.
import { afterEach, describe, expect, it } from 'vitest';
import { Setting } from '../mocks/obsidian';
import type { App, Plugin, Setting as ObsidianSetting, SettingDefinitionItem,
  SettingDefinitionList, SettingDefinitionPage, SettingDefinitionRender, SettingGroup } from 'obsidian';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import type { CodebaseProfile } from '../../src/domain/model';

function makeProfile(overrides: Partial<CodebaseProfile> = {}): CodebaseProfile {
  return { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: ['dist'], maxFileBytes: 1_000_000, ...overrides };
}

async function makeTab(profiles: readonly CodebaseProfile[]) {
  const profileHarness = createFakeProfileStoreHarness();
  const bindingHarness = createFakeBindingStoreHarness();
  for (const p of profiles) await profileHarness.store.save(p);
  const tab = new CodebaseInspectorSettingTab(
    {} as unknown as App, {} as unknown as Plugin, profileHarness.store, bindingHarness.store,
    () => createFakeSourceFileSystem({}).port);
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

describe('a rejected settings edit surfaces its reason (I5)', () => {
  async function typeExclusions(tab: CodebaseInspectorSettingTab, value: string): Promise<void> {
    const textarea = renderExclusionsRow(tab).controlEl.querySelector<HTMLTextAreaElement>('textarea')!;
    textarea.value = value;
    textarea.dispatchEvent(new Event('change'));
    await tab.waitForPendingUpdates();
  }

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
