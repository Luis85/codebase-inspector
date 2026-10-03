// WP-04 Part 2 follow-ups FN1: the settings tab's one render wait (src/host/settings-render-wait.ts). It renders at
// once unless a field of the tab's document holds focus, holds at most one focusout listener (FU1), runs a render
// still waiting when the tab is hidden (FU2), and re-arms on another document (FM9).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installObsidianDomExtensions } from '../mocks/obsidian';
import { createRenderWait } from '../../src/host/settings-render-wait';

/** How many of a spy's `addEventListener`/`removeEventListener` calls were for `focusout`. */
function focusouts(calls: unknown[][]): number {
  return calls.filter(([type]) => type === 'focusout').length;
}

/** The `focusout` listeners attached to `doc` minus those removed, from now on. */
function focusoutListeners(doc: Document): () => number {
  const add = vi.spyOn(doc, 'addEventListener');
  const remove = vi.spyOn(doc, 'removeEventListener');
  return () => focusouts(add.mock.calls) - focusouts(remove.mock.calls);
}

/** An input attached to `doc`'s body. */
function field(doc: Document): HTMLInputElement {
  return doc.body.createEl('input');
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

describe('the settings render wait (follow-ups FN1)', () => {
  it('renders at once with nothing focused', () => {
    const render = vi.fn();
    const onError = vi.fn();
    createRenderWait(() => document, render, onError).request();
    expect(render).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('waits while a field is focused, and releases once when focus leaves for outside with the document focused', () => {
    const render = vi.fn();
    const wait = createRenderWait(() => document, render, vi.fn());
    const typed = field(document);
    typed.focus();
    wait.request();
    expect(render).not.toHaveBeenCalled();
    typed.blur();
    expect(render).toHaveBeenCalledTimes(1);
    typed.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('holds at most one focusout listener across a wait, a render at once and a second wait (FU1)', () => {
    const render = vi.fn();
    const wait = createRenderWait(() => document, render, vi.fn());
    const typed = field(document);
    const attached = focusoutListeners(document);
    typed.focus();
    wait.request();
    expect(attached()).toBe(1);
    // Left with the window unfocused: the listener returns early and stays, and the next request renders at once.
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    typed.blur();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    wait.request();
    expect(render).toHaveBeenCalledTimes(1);
    expect(attached()).toBe(0);
    typed.focus();
    wait.request();
    expect(attached()).toBe(1);
  });

  it('hidden() runs a waiting render once, after a microtask, and removes its listener (FU2)', async () => {
    const render = vi.fn();
    const wait = createRenderWait(() => document, render, vi.fn());
    const typed = field(document);
    const attached = focusoutListeners(document);
    typed.focus();
    wait.request();
    wait.hidden();
    expect(attached()).toBe(0);
    expect(render).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(render).toHaveBeenCalledTimes(1);
    typed.blur();
    wait.hidden();
    await Promise.resolve();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('hidden() without a wait does nothing', async () => {
    const render = vi.fn();
    createRenderWait(() => document, render, vi.fn()).hidden();
    await Promise.resolve();
    expect(render).not.toHaveBeenCalled();
  });

  it('a throw in a deferred render reaches onError, whether focusout or hidden() released it', async () => {
    const failure = new Error('render failed');
    const render = vi.fn(() => { throw failure; });
    const onError = vi.fn();
    const wait = createRenderWait(() => document, render, onError);
    const typed = field(document);
    typed.focus();
    wait.request();
    typed.blur();
    expect(onError).toHaveBeenCalledWith(failure);
    typed.focus();
    wait.request();
    wait.hidden();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledTimes(2);
    // Control: a render at once throws to request()'s caller.
    typed.blur();
    expect(() => { wait.request(); }).toThrow(failure);
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('re-arms on another document, releases once there, and a late focusout from the first adds nothing (FM9)', () => {
    const render = vi.fn();
    const frame = document.body.createEl('iframe');
    const other = frame.contentDocument!;
    // The iframe's window has its own prototypes: the same DOM extensions the test window has.
    installObsidianDomExtensions(frame.contentWindow!);
    vi.spyOn(other, 'hasFocus').mockReturnValue(true);
    let current: Document = document;
    const wait = createRenderWait(() => current, render, vi.fn());
    const first = field(document);
    const firstListeners = focusoutListeners(document);
    const otherListeners = focusoutListeners(other);
    first.focus();
    wait.request();
    expect(firstListeners()).toBe(1);
    // Focus moves to the other document: the first loses focus, so its focusout (jsdom blurs `first`) holds the wait.
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    current = other;
    const second = field(other);
    second.focus();
    expect(firstListeners()).toBe(1);
    wait.request();
    expect(render).not.toHaveBeenCalled();
    expect(firstListeners()).toBe(0);
    expect(otherListeners()).toBe(1);
    second.blur();
    expect(render).toHaveBeenCalledTimes(1);
    expect(otherListeners()).toBe(0);
    // A late focusout from the first document, focused again: no listener is left there to render.
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    first.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    expect(render).toHaveBeenCalledTimes(1);
  });
});
