// Gap closure GRA9 / B13: the markup half of tests/unit/investigate-rows.test.ts. Both note
// panels are mounted directly in a 320 px container (jsdom lays nothing out; the grid rules
// are read from the stylesheet by the unit test) and each row's two buttons must sit in one
// `__actions` cell, in order, with the alert a direct child of the row so it can span.
import { mount } from '@vue/test-utils';
import '../mocks/obsidian';
import { describe, expect, it } from 'vitest';
import NotesPanel from '../../src/ui/screens/investigate/NotesPanel.vue';
import OrphanNotesPanel from '../../src/ui/screens/investigate/OrphanNotesPanel.vue';
import type { NoteLink } from '../../src/application/investigation/note-index';

const LONG = `Codebase Inspector/Investigations/${'a-very-long-note-name-'.repeat(6)}.md`;
/** A leaf-width container: jsdom lays nothing out, so the 320 px is the box a real leaf reports. */
function narrowHost(): HTMLElement {
  const host = document.body.createDiv();
  host.getBoundingClientRect = () => ({ width: 320, height: 800, top: 0, left: 0, right: 320, bottom: 800, x: 0, y: 0, toJSON: () => ({}) });
  return host;
}

function check(root: Element, block: string): void {
  const item = root.querySelector(`.${block}__item`)!;
  const actions = item.querySelector(`:scope > .${block}__actions`);
  expect(actions, `${block}__actions`).not.toBeNull();
  expect(Array.from(actions!.children).map((el) => el.className)).toEqual([`${block}__open`, `${block}__refresh`]);
  expect(item.querySelector(`:scope > .${block}__path`)).not.toBeNull();
  expect(item.querySelector(`:scope > .${block}__status`)).not.toBeNull();
  // The buttons are inside the actions cell only: not direct children of the row.
  expect(item.querySelectorAll(':scope > button')).toHaveLength(0);
}

const link = (path: string): NoteLink => ({
  path, codebaseId: 'c', fingerprint: 'f', findingId: 'x', sourcePath: 's.ts', snapshotId: 'snap', status: 'in progress',
});

describe('the note rows mark up their buttons as one actions cell', () => {
  it('NotesPanel, in a 320 px container', () => {
    const host = narrowHost();
    const w = mount(NotesPanel, { attachTo: host, props: { notes: [link(LONG)], createBlocked: false, opening: false, openFailed: LONG } });
    check(host, 'ci-notes-panel');
    // The alert is a direct child of the row, so the grid-column rule applies to it.
    expect(w.find('.ci-notes-panel__item > .ci-notes-panel__open-error[role="alert"]').exists()).toBe(true);
    expect(w.find('.ci-notes-panel__open').attributes('data-path')).toBe(LONG);
    w.unmount();
    host.remove();
  });

  it('OrphanNotesPanel, in a 320 px container', () => {
    const host = narrowHost();
    const w = mount(OrphanNotesPanel, { attachTo: host, props: { notes: [link(LONG)], malformed: 0, opening: false, openFailed: LONG } });
    check(host, 'ci-orphan-notes');
    expect(w.find('.ci-orphan-notes__item > .ci-orphan-notes__open-error[role="alert"]').exists()).toBe(true);
    expect(w.find('.ci-orphan-notes__open').attributes('data-path')).toBe(LONG);
    w.unmount();
    host.remove();
  });
});
