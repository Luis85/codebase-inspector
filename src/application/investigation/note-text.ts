// WP-04 IN24 (IP5): the ONE escaping function for every report- or user-derived string in a
// note body. One line, capped, every CommonMark and Obsidian opener backslash-escaped.
// Paths and ids go through noteCode instead (a code span is literal).
import { mdCode } from '../markdown-code';

// IPF1: module-private — no consumer outside this file needs the cap as a number.
const NOTE_VALUE_MAX = 256;
const LINE_BREAKS = /[\r\n\u2028\u2029]+/g;
// eslint-disable-next-line no-control-regex -- detecting control characters is the point.
const INVISIBLE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
const PUNCTUATION = /[\\`*_[\]<>#|~=$%^!{}&:]/g;

function flatten(value: string, max: number): string {
  // Review round 1, finding 6: a caller passing max <= 0 must not turn the cap into a
  // negative slice index (Array.prototype.slice(0, -1) would keep almost everything).
  const safeMax = Math.max(1, max);
  const flat = value.replace(LINE_BREAKS, ' ').replace(/\t/g, ' ').replace(INVISIBLE, '\uFFFD').trim();
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
