// WP-04 IN24 (IP5): the ONE escaping function for every report- or user-derived string in a
// note body. One line, capped, every CommonMark and Obsidian opener backslash-escaped.
// Paths and ids go through noteCode instead (a code span is literal).
import { mdCode } from '../markdown-code';

// WP-04 E8 (fix round 1, review minor 1): every control, line-break and bidi/format code
// point used below is built from a NUMBER, never a literal or escape-text character in
// source (the same reasoning as note-path.ts's CONTROL_AND_BIDI_CHARS) — this module's
// whole job is stripping these code points out of a note, so it must never itself carry one
// as a raw source byte. Confirmed the hard way: typing the \u escape TEXT for these exact
// code points landed the RAW character in the file instead (fix round 1, review item 1).
// INVISIBLE_CONTROLS (the bidi/format subset) is the ONE shared definition: source-preview.ts's
// line-escaping regex imports it rather than keeping its own copy that could drift, or fail
// the same way, again.
const BIDI_FORMAT_CODES = [0x200E, 0x200F, 0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x2066, 0x2067, 0x2068, 0x2069];
export const INVISIBLE_CONTROLS = BIDI_FORMAT_CODES.map((c) => String.fromCharCode(c)).join('');

const LINE_SEPARATOR_CODES = [0x2028, 0x2029];
const LINE_SEPARATOR_CHARS = LINE_SEPARATOR_CODES.map((c) => String.fromCharCode(c)).join('');
const REPLACEMENT_CHAR = String.fromCharCode(0xFFFD);

// IPF1: module-private — no consumer outside this file needs the cap as a number.
const NOTE_VALUE_MAX = 256;
const LINE_BREAKS = new RegExp(`[\\r\\n${LINE_SEPARATOR_CHARS}]+`, 'g');
// no-control-regex does not fire on a dynamically-built RegExp (it can only see a literal
// /…/ pattern), so no disable comment is needed here, unlike the old regex literal.
const INVISIBLE = new RegExp(`[\\u0000-\\u0008\\u000B-\\u001F\\u007F-\\u009F${INVISIBLE_CONTROLS}]`, 'g');
const PUNCTUATION = /[\\`*_[\]<>#|~=$%^!{}&:]/g;

function flatten(value: string, max: number): string {
  // Review round 1, finding 6: a caller passing max <= 0 must not turn the cap into a
  // negative slice index (Array.prototype.slice(0, -1) would keep almost everything).
  const safeMax = Math.max(1, max);
  const flat = value.replace(LINE_BREAKS, ' ').replace(/\t/g, ' ').replace(INVISIBLE, REPLACEMENT_CHAR).trim();
  const points = Array.from(flat);
  return points.length <= safeMax ? flat : `${points.slice(0, safeMax - 1).join('')}…`;
}

export function noteText(value: string, max: number = NOTE_VALUE_MAX): string {
  // Review round 1, finding 2 (WP-04 E4): www. must be escaped wherever it occurs, not only
  // at a word boundary — `\b` failed to match after a leading escaped `_`, so `_www.evil.
  // example` kept its live autolink.
  const escaped = flatten(value, max).replace(PUNCTUATION, '\\$&').replace(/(www)\./gi, '$1\\.');
  return escaped.replace(/^([-+])/, '\\$1').replace(/^(\d+)([.)])/, '$1\\$2');
}

export function noteCode(value: string, max: number = NOTE_VALUE_MAX * 2): string {
  const flat = flatten(value, max);
  // Review round 1, finding 7: two bare backticks are not a valid empty code span (and are
  // ambiguous next to a real fence); hold a single space instead, same as a hand-written
  // empty inline code note would.
  return flat === '' ? '` `' : mdCode(flat);
}
