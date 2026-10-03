// Canvas-focus-scoped key handling (spec 5.2). Pure mapping only — neither function
// here reads a DOM event or a focus state directly; callers (CameraControls.vue,
// FileSearch.vue) gate on "does the canvas/view actually have focus right now"
// themselves and pass in plain, already-read flags. Nothing here registers an
// Obsidian hotkey or any host-wide default binding — these are addEventListener
// handlers on one specific element, never `plugin.addCommand({ hotkeys: [...] })`.
const KEYBOARD_ORBIT_STEP = 0.12;      // radians per arrow press (spec 5.2)
const KEYBOARD_ZOOM_FACTOR = 1.15;     // spec 5.2's keyboard zoom, distinct from the
                                        // button's x1.2 (CameraControls' own click
                                        // handlers apply that constant directly)
const KEYBOARD_PAN_STEP = 30;          // CSS px, shared with the pan buttons

export interface KeyModifiers {
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  composing?: boolean;
}

export interface CameraKeyEvent extends KeyModifiers {
  key: string;
  shiftKey?: boolean;
}

export type CameraKeyCommand =
  | { kind: 'nudge'; delta: { orbit?: [number, number]; pan?: [number, number]; zoomFactor?: number } }
  | { kind: 'fit' }
  | { kind: 'top' }
  | { kind: 'focus' };

function isBlocked(event: KeyModifiers): boolean {
  return Boolean(event.composing || event.ctrlKey || event.metaKey || event.altKey);
}

/** Resolves ONE keydown into a camera command. F, T, +/-, arrows, Shift-arrows and
 *  Enter — nothing else. Never fires with Ctrl/Meta/Alt held or during IME
 *  composition, so a same-key browser/OS/editor shortcut is never shadowed. */
export function cameraKeyCommand(event: CameraKeyEvent): CameraKeyCommand | null {
  if (isBlocked(event)) return null;
  switch (event.key) {
    case 'f': case 'F': return { kind: 'fit' };
    case 't': case 'T': return { kind: 'top' };
    case 'Enter': return { kind: 'focus' };
    case '+': case '=': return { kind: 'nudge', delta: { zoomFactor: KEYBOARD_ZOOM_FACTOR } };
    case '-': case '_': return { kind: 'nudge', delta: { zoomFactor: 1 / KEYBOARD_ZOOM_FACTOR } };
    case 'ArrowLeft': return arrowCommand(event, [-KEYBOARD_ORBIT_STEP, 0], [-KEYBOARD_PAN_STEP, 0]);
    case 'ArrowRight': return arrowCommand(event, [KEYBOARD_ORBIT_STEP, 0], [KEYBOARD_PAN_STEP, 0]);
    case 'ArrowUp': return arrowCommand(event, [0, -KEYBOARD_ORBIT_STEP], [0, -KEYBOARD_PAN_STEP]);
    case 'ArrowDown': return arrowCommand(event, [0, KEYBOARD_ORBIT_STEP], [0, KEYBOARD_PAN_STEP]);
    default: return null;
  }
}

function arrowCommand(
  event: CameraKeyEvent, orbit: [number, number], pan: [number, number],
): CameraKeyCommand {
  return event.shiftKey ? { kind: 'nudge', delta: { pan } } : { kind: 'nudge', delta: { orbit } };
}

export interface SearchShortcutContext {
  viewOwnsFocus: boolean;
  targetIsEditable: boolean;
}

/** "/" focuses the search field, but ONLY when this view owns focus and the event's
 *  target is not itself editable (spec 5.2) — never while typing "/" into the search
 *  field itself, the inspector, or an unrelated Markdown editor elsewhere in the
 *  workspace. */
export function shouldFocusSearchShortcut(
  event: Pick<CameraKeyEvent, 'key' | 'composing' | 'ctrlKey' | 'metaKey' | 'altKey'>,
  ctx: SearchShortcutContext,
): boolean {
  if (event.key !== '/') return false;
  if (isBlocked(event)) return false;
  return ctx.viewOwnsFocus && !ctx.targetIsEditable;
}
