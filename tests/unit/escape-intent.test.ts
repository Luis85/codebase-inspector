import { describe, expect, it } from 'vitest';
import { escapeIntent } from '../../src/ui/interaction/escape-intent';

// Ported invariants (not the implementation) from
// docs/concept/design/wp01-review/validation/model.test.cjs, task-9-context.md §10 —
// keeping the invariant, not the function name. task-9-brief.md's own step-2 snippet
// inverts two links of spec §5.2's chain (query before drawer); ruling M61
// (task-9-context.md, defect D22) says the SPEC governs: nonmodal drawer BEFORE
// query. The eight tests below are the brief's own eight `it()` blocks (its prose
// says "six", the code has eight — defect D23; the code block governs). The ninth
// test is new, added by ruling M61 specifically because none of the brief's eight
// distinguishes the two orders.
describe('escapeIntent — exactly one layer per press', () => {
  it('prioritises a modal over a query', () => {
    expect(escapeIntent({ modal: true, inSearch: true, query: 'x' })).toBe('close-modal');
  });

  it('closes camera interaction or help before a drawer', () => {
    expect(escapeIntent({ help: true, narrowDrawer: true, inInspector: true })).toBe('close-help');
  });

  it('clears only the query when the search field is focused and non-empty', () => {
    expect(escapeIntent({ inSearch: true, query: 'x', selected: true })).toBe('clear-query');
  });

  it('does nothing in an unrelated editable surface', () => {
    expect(escapeIntent({ query: 'x', selected: true })).toBeNull();
  });

  it('is suppressed during IME composition', () => {
    expect(escapeIntent({ inSearch: true, query: 'x', composing: true })).toBeNull();
  });

  it('clears the selection, not the query, when the canvas has focus', () => {
    expect(escapeIntent({ inCanvas: true, selected: true, query: 'x' })).toBe('clear-selection');
  });

  it('closes only the drawer for a narrow inspector', () => {
    expect(escapeIntent({ inInspector: true, narrowDrawer: true, selected: true })).toBe('close-inspector');
  });

  it('does not fire on an empty query in the search field', () => {
    expect(escapeIntent({ inSearch: true, query: '' })).toBeNull();
  });

  // Ruling M61 (defect D22): with BOTH a narrow inspector drawer open and a non-empty
  // search query, the drawer must close, not the query clear — spec §5.2's chain is
  // "nonmodal drawer -> query", and the brief's own snippet had that backwards. No
  // test above sets both flags at once, so without this test the order is incidental,
  // not pinned.
  //
  // Reachability note for the report: in this task's actual UI, focus lives in
  // exactly one place at a time (the search input or the inspector), so `inSearch`
  // and `inInspector` cannot both be true from real focus state in the same press.
  // The two flags can still disagree if the inspector drawer is open while the
  // search field independently holds a leftover non-empty query and focus is on
  // NEITHER — escapeIntent is a pure function, so this test pins its contract
  // regardless of whether every combination is reachable from focus alone.
  it('closes a narrow drawer before clearing a query, when both apply at once', () => {
    expect(escapeIntent({
      inSearch: true, query: 'x', inInspector: true, narrowDrawer: true,
    })).toBe('close-inspector');
  });

  // Phase 2 fix wave, I1 (Important): the chain had a branch for the Inspector
  // drawer and none for the FILES drawer — the other of the two drawers spec §5.2
  // names. With the Files drawer open, focus is inside `.ci-file-list`, so
  // `inCanvas && selected` matched instead and Escape resolved the LAST layer
  // destructively: the drawer stayed open and the selection was silently cleared.
  // Ruling M61 fixed the ORDER of this chain; a drawer §5.2 already names belongs
  // in the drawer link of it, which is what these three pin.
  it('closes the Files drawer rather than clearing the selection under it', () => {
    expect(escapeIntent({
      filesDrawer: true, inCanvas: true, selected: true,
    })).toBe('close-files-drawer');
  });

  it('closes the Files drawer before clearing a query', () => {
    expect(escapeIntent({ filesDrawer: true, inSearch: true, query: 'x' })).toBe('close-files-drawer');
  });

  it('still resolves a modal, help and IME composition ahead of the Files drawer', () => {
    expect(escapeIntent({ filesDrawer: true, modal: true })).toBe('close-modal');
    expect(escapeIntent({ filesDrawer: true, help: true })).toBe('close-help');
    expect(escapeIntent({ filesDrawer: true, composing: true })).toBeNull();
  });
});
