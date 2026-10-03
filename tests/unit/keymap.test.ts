import { describe, expect, it } from 'vitest';
import { cameraKeyCommand, shouldFocusSearchShortcut } from '../../src/ui/interaction/keymap';

// Not in task-9-brief.md's own required test list, but keymap.ts is new production
// code this task ships (src/ui/interaction/keymap.ts), so the non-negotiables'
// "a failing test precedes the implementation, every time" applies to it exactly as
// much as to escape-intent.ts. The KEYBOARD increments (orbit 0.12 rad, zoom x1.15,
// pan 30 px) are spec 5.2's own defaults, restated in plan-global-constraints.md.
describe('cameraKeyCommand', () => {
  it('maps a bare ArrowLeft to the keyboard orbit step', () => {
    expect(cameraKeyCommand({ key: 'ArrowLeft' })).toEqual({ kind: 'nudge', delta: { orbit: [-0.12, 0] } });
  });

  it('maps a bare ArrowRight to the keyboard orbit step in the opposite direction', () => {
    expect(cameraKeyCommand({ key: 'ArrowRight' })).toEqual({ kind: 'nudge', delta: { orbit: [0.12, 0] } });
  });

  it('maps Shift+ArrowLeft to a pan, not an orbit', () => {
    expect(cameraKeyCommand({ key: 'ArrowLeft', shiftKey: true }))
      .toEqual({ kind: 'nudge', delta: { pan: [-30, 0] } });
  });

  it('maps "+" to the keyboard zoom factor', () => {
    expect(cameraKeyCommand({ key: '+' })).toEqual({ kind: 'nudge', delta: { zoomFactor: 1.15 } });
  });

  it('maps "-" to the inverse of the keyboard zoom factor', () => {
    expect(cameraKeyCommand({ key: '-' })).toEqual({ kind: 'nudge', delta: { zoomFactor: 1 / 1.15 } });
  });

  it('maps F to fit and T to top', () => {
    expect(cameraKeyCommand({ key: 'F' })).toEqual({ kind: 'fit' });
    expect(cameraKeyCommand({ key: 'T' })).toEqual({ kind: 'top' });
  });

  it('maps Enter to focus', () => {
    expect(cameraKeyCommand({ key: 'Enter' })).toEqual({ kind: 'focus' });
  });

  it('ignores Ctrl/Meta/Alt combinations', () => {
    expect(cameraKeyCommand({ key: 'ArrowLeft', ctrlKey: true })).toBeNull();
    expect(cameraKeyCommand({ key: 'F', metaKey: true })).toBeNull();
    expect(cameraKeyCommand({ key: 'T', altKey: true })).toBeNull();
  });

  it('is suppressed during IME composition', () => {
    expect(cameraKeyCommand({ key: 'Enter', composing: true })).toBeNull();
  });

  it('returns null for a key outside the honoured set', () => {
    expect(cameraKeyCommand({ key: 'q' })).toBeNull();
  });
});

describe('shouldFocusSearchShortcut', () => {
  it('fires on "/" when this view owns focus and the target is not editable', () => {
    expect(shouldFocusSearchShortcut({ key: '/' }, { viewOwnsFocus: true, targetIsEditable: false })).toBe(true);
  });

  it('is refused when the view does not own focus', () => {
    expect(shouldFocusSearchShortcut({ key: '/' }, { viewOwnsFocus: false, targetIsEditable: false })).toBe(false);
  });

  it('is refused when the event target is itself editable', () => {
    expect(shouldFocusSearchShortcut({ key: '/' }, { viewOwnsFocus: true, targetIsEditable: true })).toBe(false);
  });

  it('is refused during IME composition, even with focus and a non-editable target', () => {
    expect(shouldFocusSearchShortcut(
      { key: '/', composing: true }, { viewOwnsFocus: true, targetIsEditable: false },
    )).toBe(false);
  });

  it('ignores Ctrl/Meta/Alt combinations', () => {
    expect(shouldFocusSearchShortcut(
      { key: '/', ctrlKey: true }, { viewOwnsFocus: true, targetIsEditable: false },
    )).toBe(false);
  });

  it('does not fire for any key other than "/"', () => {
    expect(shouldFocusSearchShortcut({ key: 'a' }, { viewOwnsFocus: true, targetIsEditable: false })).toBe(false);
  });
});
