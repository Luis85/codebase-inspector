// IP16 / gap closure GRB17a: the ONE display helper that shows control and bidi code points
// as literal `\uXXXX` text. The source preview uses it for a file's lines (a verbatim window
// onto the file, never a rewrite of its bytes); a finding's symbol and detail strings use it
// so a report cannot reorder or hide what the screen shows.
import { INVISIBLE_CONTROLS } from './note-text';

// Every C0 control except tab and newline, DEL, C1 and the bidi/format controls — the same set
// note-text.ts's INVISIBLE regex strips from a note (INVISIBLE_CONTROLS, its ONE shared
// export). Dynamically built, so no-control-regex (which only sees a literal /…/ pattern)
// needs no disable here.
const CONTROL_ESCAPE = new RegExp(`[\\u0000-\\u0008\\u000B-\\u001F\\u007F-\\u009F${INVISIBLE_CONTROLS}]`, 'g');

export const visibleControls = (value: string): string => value.replace(
  CONTROL_ESCAPE,
  (ch) => `\\u${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`,
);
