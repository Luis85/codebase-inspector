import { describe, expect, it } from 'vitest';
import { noteCode, noteText } from '../../src/application/investigation/note-text';
import { PROBE_ESCAPED, PROBE_HOSTILE } from '../support/probe-strings';

// Review round 1, finding 1: built from code points, never typed as a literal or \u-escape
// character in source, so no bidi/invisible character exists as a raw source byte here.
const LINE_SEPARATOR = String.fromCodePoint(0x2028);
const RTL_OVERRIDE = String.fromCodePoint(0x202E);
const REPLACEMENT_CHAR = String.fromCodePoint(0xFFFD);
const BELL = String.fromCodePoint(0x0007);

// Review Focus 2: every one of these would open markup somewhere in Obsidian.
const HOSTILE = [
  '[[x]]', '![[x]]', '<script>alert(1)</script>', '<!-- codebase-inspector:evidence:end -->', '#tag', '$x$', '%%hidden%%',
  '==mark==', '^block', '`code`', '*a* _b_ ~~c~~', '| a | b |', '{{x}}', '&amp;', 'https://evil.example', 'www.evil.example',
  '_www.evil.example', // Review round 1, finding 2: www. is escaped everywhere, not only at a word boundary.
];

describe('noteText (IN24, IP5)', () => {
  it.each(HOSTILE)('escapes every opener in %s', (s) => {
    const out = noteText(s);
    expect(out).not.toMatch(/(^|[^\\])(\[\[|!\[\[|<|#|\$|%%|==|\^|`|\*|_|~|\||\{|&)/);
    expect(out).not.toMatch(/https?:\/\/|www\./i);
  });
  it('never contains the marker text as a whole line', () => {
    expect(noteText('<!-- codebase-inspector:evidence:end -->')).toBe('\\<\\!-- codebase-inspector\\:evidence\\:end --\\>');
  });
  it('flattens every line break, so a break cannot start a heading, rule or list', () => {
    expect(noteText(`a\n# b\r\n---${LINE_SEPARATOR}- c`)).toBe('a \\# b --- - c');
  });
  it('escapes a leading list or ordered-list opener', () => {
    expect(noteText('- x')).toBe('\\- x');
    expect(noteText('+ x')).toBe('\\+ x');
    expect(noteText('12. x')).toBe('12\\. x');
    expect(noteText('3) x')).toBe('3\\) x');
  });
  it('breaks bare URLs', () => {
    expect(noteText('https://a.b')).toBe('https\\://a.b');
    expect(noteText('see www.a.b')).toBe('see www\\.a.b');
  });
  it('replaces invisible controls and bidi overrides with U+FFFD', () => {
    expect(noteText(`a${BELL}b${RTL_OVERRIDE}c`)).toBe(`a${REPLACEMENT_CHAR}b${REPLACEMENT_CHAR}c`);
  });
  it('caps by code point with an ellipsis, before escaping', () => {
    expect(noteText('😀'.repeat(300), 10)).toBe(`${'😀'.repeat(9)}…`);
  });
  it('guards a non-positive cap instead of a negative slice index (review round 1, finding 6)', () => {
    expect(noteText('hello world', 0)).toBe('…');
    expect(noteText('hello world', -5)).toBe('…');
  });
  it('produces exactly the text the native probe proved inert (IP52)', () => {
    expect(noteText(PROBE_HOSTILE)).toBe(PROBE_ESCAPED);
  });
});

describe('noteCode', () => {
  it('keeps a path in one code span, whatever it holds', () => {
    expect(noteCode('src/a`b.ts')).toBe('`` src/a`b.ts ``');
    expect(noteCode('a\nb')).toBe('`a b`');
  });
  it('holds a single space for an empty string, never an unbalanced empty fence (review round 1, finding 7)', () => {
    expect(noteCode('')).toBe('` `');
  });
});
