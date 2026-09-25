import { describe, expect, it } from 'vitest';
import { noteCode, noteText } from '../../src/application/investigation/note-text';
import { PROBE_ESCAPED, PROBE_HOSTILE } from '../support/probe-strings';

// Review Focus 2: every one of these would open markup somewhere in Obsidian.
const HOSTILE = [
  '[[x]]', '![[x]]', '<script>alert(1)</script>', '<!-- codebase-inspector:evidence:end -->', '#tag', '$x$', '%%hidden%%',
  '==mark==', '^block', '`code`', '*a* _b_ ~~c~~', '| a | b |', '{{x}}', '&amp;', 'https://evil.example', 'www.evil.example',
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
    expect(noteText('a\n# b\r\n--- - c')).toBe('a \\# b --- - c');
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
    expect(noteText('a\u0007b‮c')).toBe('a�b�c');
  });
  it('caps by code point with an ellipsis, before escaping', () => {
    expect(noteText('😀'.repeat(300), 10)).toBe(`${'😀'.repeat(9)}…`);
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
});
