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
  const flat = value.replace(LINE_BREAKS, ' ').replace(/\t/g, ' ').replace(INVISIBLE, '\uFFFD').trim();
  const points = Array.from(flat);
  return points.length <= max ? flat : `${points.slice(0, max - 1).join('')}…`;
}

export function noteText(value: string, max: number = NOTE_VALUE_MAX): string {
  const escaped = flatten(value, max).replace(PUNCTUATION, '\\$&').replace(/\b(www)\./gi, '$1\\.');
  return escaped.replace(/^([-+])/, '\\$1').replace(/^(\d+)([.)])/, '$1\\$2');
}

export function noteCode(value: string, max: number = NOTE_VALUE_MAX * 2): string {
  return mdCode(flatten(value, max));
}
