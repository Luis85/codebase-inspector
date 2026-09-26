// WP-04.2 polish PN4 (P4, scenario 38): Obsidian's update() re-renders every render-type row, so the tab never
// calls it while a field of its settings document holds focus, and calls it once focus has left the fields.
// Observed natively (1.13.4): a profile page renders into its own `.setting-page`, and the tab's containerEl is
// detached while it shows, so the fields are in the tab's document but not in its containerEl. The tab is built
// the way settings-tab-refresh-soon.test.ts builds it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import type { App, Plugin as ObsidianPlugin } from 'obsidian';
import { CodebaseInspectorSettingTab } from '../../src/host/settings-tab';
import { createFakeProfileStoreHarness } from '../fixtures/fake-profile-store';
import { createFakeBindingStoreHarness } from '../fixtures/fake-binding-store';
import { createFakeSourceFileSystem } from '../fixtures/fake-source-filesystem';
import { createFakeFallowAnalysis } from '../fixtures/fake-fallow-analysis';
import { createFakeInvestigationFolders } from '../fixtures/fake-investigation-folders';

function newTab(): CodebaseInspectorSettingTab {
  return new CodebaseInspectorSettingTab(
    {} as unknown as App, {} as unknown as ObsidianPlugin, createFakeProfileStoreHarness().store, createFakeBindingStoreHarness().store,
    () => createFakeSourceFileSystem({}).port, { purge: () => Promise.resolve() }, createFakeFallowAnalysis(), { remove: vi.fn() },
    createFakeInvestigationFolders());
}

/** An input attached to `parent`, which is attached to the document. */
function field(parent: HTMLElement): HTMLInputElement {
  return parent.createEl('input');
}

/** Stops a focusout before it reaches the document: focus left, but no focusout arrived (its window closed). */
function swallow(event: Event): void {
  event.stopImmediatePropagation();
}

/** Focus leaves `from` for `to` (null: nothing focusable), as a person's click moves it. */
function moveFocus(from: HTMLElement, to: HTMLElement | null): void {
  if (to === null) from.blur(); else to.focus();
  from.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: to }));
}

afterEach(() => {
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
    const page = document.body.createDiv();
    const typed = field(page);
    const update = vi.spyOn(tab, 'update');
    typed.focus();
    await tab.refresh();
    expect(update).not.toHaveBeenCalled();
    moveFocus(typed, null);
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
});
