// WP-04 Part 2 follow-ups FN1: the settings tab's one render wait (WP-04.2 polish PN4, final fix wave item 1),
// moved out of settings-tab.ts. At most one focusout listener is ever attached (FU1), and hiding the tab runs a
// render still waiting then (FU2).

/** WP-04.2 polish PN4: whether `target` is an element inside `container`. `matches`, not `instanceof`: the settings
 *  window's elements may come from another window. */
function isElementIn(container: Node, target: EventTarget | null): target is Element {
  return target !== null && 'matches' in target && container.contains(target as Element);
}

/** WP-04.2 polish PN4: whether `target` is a field a person types or picks in (an input, textarea or select) of the
 *  tab's own content in `doc`: its containerEl, or a `.setting-page` (Obsidian 1.13.4 renders a profile page into
 *  its own `setting-page vertical-tab-content` root). Gap closure E50: Obsidian's settings search field, in the
 *  modal's `.vertical-tab-header`, is not the tab's, so focus there (where the settings open) never holds a render. */
function isEditingIn(doc: Node, tabEl: Node, target: EventTarget | null): boolean {
  return isElementIn(doc, target) && target.matches('input, textarea, select')
    && (tabEl.contains(target) || target.closest('.setting-page') !== null);
}

/** The settings tab's render wait: `request()` asks for a render, `hidden()` says the tab was hidden. */
interface RenderWait {
  request(): void;
  hidden(): void;
}

/** `doc` is the tab's document and `tabEl` its containerEl, both read at every request; `render` is the tab's
 *  update(); `onError` shows a throw from a deferred render (a render at once throws to request()'s caller). */
export function createRenderWait(
  doc: () => Document, tabEl: () => Node, render: () => void, onError: (e: unknown) => void,
): RenderWait {
  let pending: { doc: Document; listener: (event: FocusEvent) => void } | null = null;

  const drop = (): void => {
    if (pending === null) return;
    pending.doc.removeEventListener('focusout', pending.listener);
    pending = null;
  };

  /** WP-04.2 polish PN4: Obsidian's update() re-renders every render-type row, so it waits while a field of the
   *  tab's own content holds focus (`isEditingIn`), and runs once focus has left the fields. The document, not the
   *  containerEl, is where it listens: observed on 1.13.4, a profile page renders into its own `.setting-page` and
   *  the containerEl is detached while it shows (Settings open in their own window: NPF7). A render that runs at once supersedes a
   *  waiting one, so a focusout that never arrived (its window closed) cannot hold a later render back.
   *
   *  Final fix wave (item 1): the wait is released only when focus leaves the page's controls. Focus moving onto a
   *  button (Connect, Reconnect, Clear binding, Forget) keeps it waiting: a render there would rebuild the button's
   *  row between mousedown and mouseup and lose the click, and the button's own action ends in refresh() with
   *  nothing editable focused, which renders at once. A window switch (the document lost focus) keeps it waiting
   *  too, so an uncommitted field is never replaced. A release re-checks the current document and focus.
   *
   *  Follow-ups FU1 (WP-04.2 E13): the wait holds its one listener. A render at once removes it first, and a wait on
   *  another document removes the earlier one before it attaches its own, so at most one is ever attached. */
  const request = (): void => {
    const current = doc();
    if (!isEditingIn(current, tabEl(), current.activeElement)) {
      drop();
      render();
      return;
    }
    if (pending?.doc === current) return;
    drop();
    const listener = (event: FocusEvent): void => {
      if (isElementIn(current, event.relatedTarget) || !current.hasFocus()) return;
      drop();
      try { request(); } catch (e) { onError(e); }
    };
    pending = { doc: current, listener };
    current.addEventListener('focusout', listener);
  };

  return {
    request,
    /** Follow-ups FU2 (WP-04.2 E7; WP-04.2 Follow-up E2): a person's close removes the focused field while its
     *  document has focus, and that focusout releases the wait. hide(), through hidden(), releases a render still
     *  waiting when the tab is hidden: a tab switch (focus on a nav item keeps the wait) or a close while the
     *  settings document is unfocused (Obsidian quitting, the plugin unloading, a close from another window). A
     *  microtask (spec FN1): Obsidian calls hide() from closeActiveTab() before it sets activeTab to null, and from
     *  openTab() before it sets the new tab, so the render stores the definitions and refreshes the search without
     *  drawing into the hidden tab. */
    hidden(): void {
      if (pending === null) return;
      drop();
      queueMicrotask(() => {
        try { render(); } catch (e) { onError(e); }
      });
    },
  };
}
