// WP-04.2 polish PN4 (P4, scenario 38): Obsidian's update() re-renders every render-type row, so the tab never
// calls it while a field of its settings document holds focus, and calls it once focus has left the fields.
// Observed natively (1.13.4): a profile page renders into its own `.setting-page`, and the tab's containerEl is
// detached while it shows, so the fields are in the tab's document but not in its containerEl. The tab is built
// the way settings-tab-refresh-soon.test.ts builds it. Final fix wave (item 1): focus moving onto a button, or
// leaving with the window, keeps the render waiting, so a click is never lost to a re-render between mousedown
// and mouseup.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { Setting } from '../mocks/obsidian';
import type { App, Plugin as ObsidianPlugin, Setting as ObsidianSetting, SettingDefinitionList,
  SettingDefinitionPage, SettingDefinitionRender, SettingGroup } from 'obsidian';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';
import type { ProfileStore } from '../../src/application/ports/profile-store';

function newTab(profileStore: ProfileStore = createFakeProfileStoreHarness().store): CodebaseInspectorSettingTab {
  return new CodebaseInspectorSettingTab(
    {} as unknown as App, {} as unknown as ObsidianPlugin, profileStore, createFakeBindingStoreHarness().store,
    () => createFakeSourceFileSystem({}).port, { purge: () => Promise.resolve() }, createFakeFallowAnalysis(), { remove: vi.fn() },
    createFakeInvestigationFolders());
}

/** The one profile page's Excluded paths row, rendered into `parent` (settings-tab-validation.test.ts's idiom). */
function renderExclusions(tab: CodebaseInspectorSettingTab, parent: HTMLElement): HTMLTextAreaElement {
  const list = tab.getSettingDefinitions().find((d): d is SettingDefinitionList => 'type' in d && d.type === 'list');
  const page = (list?.items ?? []).find((i): i is SettingDefinitionPage => 'type' in i && i.type === 'page');
  const row = (page?.items ?? []).find(
    (i): i is SettingDefinitionRender => 'render' in i && typeof i.render === 'function' && i.name === 'Excluded paths');
  if (!row) throw new Error('no Excluded paths row');
  const setting = new Setting(parent);
  row.render(setting as unknown as ObsidianSetting, {} as unknown as SettingGroup);
  return setting.controlEl.querySelector('textarea')!;
}

/** An input attached to `parent`, which is attached to the document. */
function field(parent: HTMLElement): HTMLInputElement {
  return parent.createEl('input');
}

/** Stops a focusout before it reaches the document: focus left, but no focusout arrived (its window closed). */
function swallow(event: Event): void {
  event.stopImmediatePropagation();
}

/** Focus leaves `from` for `to` (null: nothing focusable), as a person's click moves it. Follow-ups FM9: jsdom's
 *  focus() and blur() fire the focusout themselves. */
function moveFocus(from: HTMLElement, to: HTMLElement | null): void {
  if (to === null) from.blur(); else to.focus();
}

/** How many of a spy's `addEventListener`/`removeEventListener` calls were for `focusout`. */
function focusouts(calls: unknown[][]): number {
  return calls.filter(([type]) => type === 'focusout').length;
}

/** Follow-ups FU1: the `focusout` listeners attached to `document` minus those removed, from now on. */
function focusoutListeners(): () => number {
  const add = vi.spyOn(document, 'addEventListener');
  const remove = vi.spyOn(document, 'removeEventListener');
  return () => focusouts(add.mock.calls) - focusouts(remove.mock.calls);
}

// jsdom's hasFocus() is false whenever no element is focused; a real window keeps its focus when a click lands on
// the page, so every test runs with the window focused unless it says otherwise.
beforeEach(() => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('settings tab: a refresh never re-renders the field being typed in (WP-04.2 polish PN4)', () => {
  it('waits while a field in its containerEl holds focus, stays waiting across a move to a second field, and renders once focus leaves', async () => {
    const tab = newTab();
    document.body.appendChild(tab.containerEl);
    const first = field(tab.containerEl);
    const second = field(tab.containerEl);
    const update = vi.spyOn(tab, 'update');
    first.focus();
    await tab.refresh();
    expect(update).not.toHaveBeenCalled();
    moveFocus(first, second);
    expect(update).not.toHaveBeenCalled();
    moveFocus(second, null);
    expect(update).toHaveBeenCalledTimes(1);
    second.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('waits for a field of a profile page, which is in the tab’s document but not in its detached containerEl', async () => {
    const tab = newTab();
    // Obsidian 1.13.4 builds a page's root as `createDiv("setting-page vertical-tab-content")`.
    const page = document.body.createDiv({ cls: 'setting-page vertical-tab-content' });
    const typed = field(page);
    const update = vi.spyOn(tab, 'update');
    typed.focus();
    await tab.refresh();
    expect(update).not.toHaveBeenCalled();
    moveFocus(typed, null);
    expect(update).toHaveBeenCalledTimes(1);
  });

  // Gap closure E50 (Task 16 M6): the settings open with Obsidian's search field focused. It sits in the modal's
  // `.vertical-tab-header`, outside the tab's own content, so it never holds the tab's render.
  it('renders at once while Obsidian’s settings search field holds focus: only the tab’s own fields count', async () => {
    const tab = newTab();
    const header = document.body.createDiv({ cls: 'vertical-tab-header' });
    const search = header.createDiv({ cls: 'setting-search-container' }).createEl('input', { type: 'search' });
    document.body.createDiv({ cls: 'vertical-tab-content-container' }).appendChild(tab.containerEl);
    field(tab.containerEl);
    const update = vi.spyOn(tab, 'update');
    search.focus();
    await tab.refresh();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('control: with nothing focused, refresh() calls update() once, as before', async () => {
    const tab = newTab();
    document.body.appendChild(tab.containerEl);
    field(tab.containerEl);
    const update = vi.spyOn(tab, 'update');
    await tab.refresh();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('two refreshSoon() while a field holds focus give one update() once focus leaves', async () => {
    const tab = newTab();
    document.body.appendChild(tab.containerEl);
    const typed = field(tab.containerEl);
    const update = vi.spyOn(tab, 'update');
    typed.focus();
    tab.refreshSoon();
    tab.refreshSoon();
    await flushPromises();
    await flushPromises();
    expect(update).not.toHaveBeenCalled();
    moveFocus(typed, null);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('a render that ran at once is not repeated by a focusout left from an earlier wait', async () => {
    const tab = newTab();
    document.body.appendChild(tab.containerEl);
    const typed = field(tab.containerEl);
    const update = vi.spyOn(tab, 'update');
    typed.focus();
    await tab.refresh();
    // Focus leaves without a focusout reaching the tab (its window closed), and the next refresh renders at once.
    window.addEventListener('focusout', swallow, { capture: true });
    typed.blur();
    window.removeEventListener('focusout', swallow, { capture: true });
    await tab.refresh();
    expect(update).toHaveBeenCalledTimes(1);
    typed.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('focus to a button keeps the render waiting, and the button’s own refresh renders at once', async () => {
    const tab = newTab();
    document.body.appendChild(tab.containerEl);
    const typed = field(tab.containerEl);
    const button = tab.containerEl.createEl('button');
    const update = vi.spyOn(tab, 'update');
    typed.focus();
    await tab.refresh();
    moveFocus(typed, button);
    expect(update).not.toHaveBeenCalled();
    // The button's action (Connect, Reconnect, Clear binding, Forget) ends in refresh(), with the button focused.
    await tab.refresh();
    expect(update).toHaveBeenCalledTimes(1);
    moveFocus(button, null);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('a blur with the document unfocused keeps waiting', async () => {
    const tab = newTab();
    document.body.appendChild(tab.containerEl);
    const typed = field(tab.containerEl);
    const update = vi.spyOn(tab, 'update');
    typed.focus();
    await tab.refresh();
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    moveFocus(typed, null);
    expect(update).not.toHaveBeenCalled();
    // Control: back in the window, the field's own leaving renders.
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    typed.focus();
    moveFocus(typed, null);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('a release while another field holds focus re-checks the document and keeps waiting', async () => {
    const tab = newTab();
    document.body.appendChild(tab.containerEl);
    const first = field(tab.containerEl);
    const second = field(tab.containerEl);
    const update = vi.spyOn(tab, 'update');
    first.focus();
    await tab.refresh();
    second.focus();
    // A late focusout that names no new target, while someone types in `second`.
    first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(update).not.toHaveBeenCalled();
    moveFocus(second, null);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('holds at most one focusout listener across a wait, a render at once and a second wait (follow-ups FU1, E13)', async () => {
    const tab = newTab();
    document.body.appendChild(tab.containerEl);
    const typed = field(tab.containerEl);
    const update = vi.spyOn(tab, 'update');
    const attached = focusoutListeners();
    typed.focus();
    await tab.refresh();
    expect(attached()).toBe(1);
    // The field is left with the window unfocused: the wait's listener returns early and stays.
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    typed.blur();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    expect(attached()).toBe(1);
    await tab.refresh();
    expect(update).toHaveBeenCalledTimes(1);
    expect(attached()).toBe(0);
    typed.focus();
    await tab.refresh();
    expect(attached()).toBe(1);
  });

  it('hide() runs a waiting render once, after a microtask, and removes its listener (follow-ups FU2, E7)', async () => {
    const tab = newTab();
    document.body.appendChild(tab.containerEl);
    const typed = field(tab.containerEl);
    const update = vi.spyOn(tab, 'update');
    // Control: with no render waiting, hide() renders nothing.
    tab.hide();
    await Promise.resolve();
    expect(update).not.toHaveBeenCalled();
    const attached = focusoutListeners();
    typed.focus();
    await tab.refresh();
    expect(update).not.toHaveBeenCalled();
    expect(attached()).toBe(1);
    tab.hide();
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(1);
    expect(attached()).toBe(0);
    // A focusout after the hide adds nothing.
    typed.blur();
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('a refused edit’s Notice shows while a render waits', async () => {
    const { store } = createFakeProfileStoreHarness();
    await store.save({ profileId: 'p1', name: 'Alpha', bindingId: null, exclusions: ['dist'], maxFileBytes: 1_000_000 });
    const tab = newTab(store);
    await tab.refresh();
    const textarea = renderExclusions(tab, document.body.createDiv({ cls: 'setting-page vertical-tab-content' }));
    const update = vi.spyOn(tab, 'update');
    textarea.focus();
    textarea.value = './dist';
    textarea.dispatchEvent(new Event('change'));
    await tab.waitForPendingUpdates();
    expect(update).not.toHaveBeenCalled();
    expect(Array.from(document.querySelectorAll('.notice'), (n) => n.textContent ?? '').join(' ')).toContain('./dist');
    expect((await store.get('p1'))!.exclusions).toEqual(['dist']);
  });
});
