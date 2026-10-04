// GRC5 (GCO13): axe over the host's own modals (scope, source, clear binding) and every row
// the settings tab renders itself (its `render` definitions; Obsidian draws the declarative
// ones). Each is built the way its own component test builds it (scope-modal.test.ts,
// source-modal.test.ts, settings-tab.test.ts), with content, then checked in the document.
import { afterEach, describe, it, vi } from 'vitest';
import { FileSystemAdapter, Setting } from '../mocks/obsidian';
import type { App, Plugin, Setting as ObsidianSetting, SettingGroup } from 'obsidian';
import { openScopeModal } from '../../src/host/modals/scope-modal';
import { openSourceModal } from '../../src/host/modals/source-modal';
import { ClearBindingModal } from '../../src/host/modals/clear-binding-modal';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import type { CodebaseProfile } from '../../src/domain/model';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import { HARNESS_BINDING } from '../harness/seed';
import { expectAccessible } from './axe-support';

function makeProfile(overrides: Partial<CodebaseProfile> = {}): CodebaseProfile {
  return { profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: ['.git', 'node_modules'], maxFileBytes: 1_000_000, ...overrides };
}

function modalRoot(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.modal-container');
  if (!el) throw new Error('no modal is open');
  return el;
}

const settle = async (): Promise<void> => { for (let i = 0; i < 4; i += 1) await Promise.resolve(); };

afterEach(() => { document.body.empty(); });

describe('axe: the host modals', () => {
  it('the scope modal, with exclusions and the acknowledgement', async () => {
    void openScopeModal({} as App, { profile: makeProfile(), resolvedRoot: 'C:\\Projects\\alpha' });
    await settle();
    await expectAccessible(modalRoot(), '[data-field="acknowledge"]');
  });

  for (const mode of ['vault', 'vault-folder', 'external'] as const) {
    it(`the source modal, the ${mode} mode`, async () => {
      const app = { vault: { adapter: new FileSystemAdapter('C:\\Vault'), configDir: '.obsidian' } } as unknown as App;
      void openSourceModal(app, { profile: makeProfile(), filesystem: createFakeSourceFileSystem({}).port });
      await settle();
      const radio = modalRoot().querySelector<HTMLInputElement>(`input[type="radio"][value="${mode}"]`)!;
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
      await settle();
      await expectAccessible(modalRoot(), 'input[type="radio"][name="source-mode"]');
    });
  }

  it('the clear-binding confirmation', async () => {
    new ClearBindingModal({} as App, 'Alpha root', () => {}).open();
    await settle();
    await expectAccessible(modalRoot(), '[data-action="confirm-clear-binding"]');
  });
});

interface Definition { render?: (setting: ObsidianSetting, group: SettingGroup) => void; items?: readonly Definition[]; name?: string }

/** Every `render` definition, depth first through lists and pages. */
function renderRows(items: readonly Definition[], into: HTMLElement): number {
  let count = 0;
  for (const item of items) {
    if (typeof item.render === 'function') {
      item.render(new Setting(into) as unknown as ObsidianSetting, {} as unknown as SettingGroup);
      count += 1;
    }
    if (item.items) count += renderRows(item.items, into);
  }
  return count;
}

describe('axe: the settings tab', () => {
  it('every row it renders itself, for a bound profile with fallow trusted and a profile whose folder is missing', async () => {
    const profiles = createFakeProfileStoreHarness();
    const bindings = createFakeBindingStoreHarness();
    await profiles.store.save(makeProfile({ profileId: 'p1', bindingId: 'b1' }));
    await profiles.store.save(makeProfile({ profileId: 'p2', name: 'Beta', bindingId: 'b-missing' }));
    await bindings.store.save({ bindingId: 'b1', label: 'Alpha root', rootPath: 'C:\\Projects\\alpha', machineId: 'irrelevant' });
    const analysis = createFakeFallowAnalysis();
    analysis.setBinding('p1', HARNESS_BINDING);
    const tab = new CodebaseInspectorSettingTab(
      {} as App, {} as Plugin, profiles.store, bindings.store, () => createFakeSourceFileSystem({}).port,
      { purge: () => Promise.resolve() }, analysis, { remove: vi.fn() }, createFakeInvestigationFolders());
    await tab.refresh();
    const container = document.body.createDiv({ cls: 'vertical-tab-content' });
    const rows = renderRows(tab.getSettingDefinitions(), container);
    if (rows < 12) throw new Error(`only ${rows} rendered rows; expected both profile pages`);
    await expectAccessible(container, '[data-action="clear-binding"]');
    await expectAccessible(container, '[data-action="reconnect"]');
  });
});
