import { describe, expect, it } from 'vitest';
import {
  defaultNoteFolder, freeNoteName, noteBaseName, validateNoteFolder, validateNoteName,
} from '../../src/application/investigation/note-path';

const validFolder = (v: string) => validateNoteFolder(v, '.obsidian');

// IPF1: NOTE_NAME_MAX, COLLISION_MAX and sanitizeNoteName are module-private. Sanitising is
// reached through noteBaseName and validateNoteName, and every constant below is a literal.
// The empty finding id and kind label in noteBaseName('', '', …) below exist only to reach
// sanitising through a public function; they carry no meaning of their own here.
describe('sanitising a note name (IN21)', () => {
  it('removes the forbidden characters and control characters, collapses whitespace', () => {
    expect(noteBaseName('ID', 'K', 'a\\b/c:d*e?f"g<h>i|j#k^l[m]n\u0000o   p')).toBe('ID K abcdefghijklmno p');
  });
  it('drops leading dots and trailing dots and spaces (reserved and trailing)', () => {
    expect(noteBaseName('', '', '..hidden')).toBe('hidden');
    expect(noteBaseName('', '', 'name. . ')).toBe('name');
  });
  it('suffixes a Windows reserved name, with or without an extension (reserved and trailing)', () => {
    expect(noteBaseName('', '', 'CON')).toBe('CON_');
    expect(noteBaseName('', '', 'nul.backup')).toBe('nul_.backup');
    expect(noteBaseName('', '', 'console')).toBe('console');
  });
  it('recognises the extended reserved list: COM0, CONIN$ and a superscript-digit variant (review round 1, finding 5)', () => {
    const superscriptTwo = String.fromCodePoint(0xB2); // built from a code point, never a literal source char.
    expect(noteBaseName('', '', 'COM0')).toBe('COM0_');
    expect(noteBaseName('', '', 'CONIN$')).toBe('CONIN$_');
    expect(noteBaseName('', '', `LPT${superscriptTwo}`)).toBe(`LPT${superscriptTwo}_`);
  });
  it('cuts at 100 code points', () => {
    expect(Array.from(noteBaseName('', '', 'é'.repeat(150)))).toHaveLength(100);
  });
  it('keeps the reserved-name suffix within 100 code points and stays idempotent (review round 1, finding 4)', () => {
    const hostile = `CON.${'x'.repeat(96)}`; // exactly 100 code points before sanitising
    const once = noteBaseName('', '', hostile);
    expect(Array.from(once).length).toBeLessThanOrEqual(100);
    expect(noteBaseName('', '', once)).toBe(once); // sanitising through the public function is idempotent
    expect(validateNoteFolder(defaultNoteFolder(hostile), '.obsidian').ok).toBe(true);
  });
});

describe('noteBaseName', () => {
  it('is "<id> <kind> <file>", and the id alone when the rest sanitises away', () => {
    expect(noteBaseName('UN-1a2b3c4d', 'Unused exports', 'view.ts')).toBe('UN-1a2b3c4d Unused exports view.ts');
    expect(noteBaseName('UN-1a2b3c4d', '', '[[#]]')).toBe('UN-1a2b3c4d');
  });
});

describe('validateNoteFolder (IN19)', () => {
  it('accepts a POSIX vault-relative folder and drops trailing slashes', () => {
    expect(validFolder('Codebase investigations/App/')).toEqual({ ok: true, folder: 'Codebase investigations/App' });
  });
  it.each([
    ['', 'empty'], ['   ', 'empty'], ['/abs', 'not-relative'], ['C:\\x', 'not-relative'], ['a/../b', 'not-relative'],
    ['a//b', 'not-relative'], ['./a', 'not-relative'], ['.obsidian/notes', 'config-dir'], ['.OBSIDIAN', 'config-dir'],
    ['a/b:c', 'unsafe-name'], ['a/CON', 'unsafe-name'], ['a/trailing.', 'unsafe-name'], ['x'.repeat(201), 'too-long'],
  ])('refuses %j as %s', (value, problem) => {
    expect(validFolder(value)).toEqual({ ok: false, problem });
  });
});

describe('validateNoteName', () => {
  it('strips a typed .md and refuses what sanitising would change', () => {
    expect(validateNoteName('My note.md')).toEqual({ ok: true, name: 'My note' });
    expect(validateNoteName('a#b')).toEqual({ ok: false, problem: 'unsafe-name' });
    expect(validateNoteName('.md')).toEqual({ ok: false, problem: 'empty' });
  });
});

describe('freeNoteName (IN27, IPF8)', () => {
  it('takes the first free of base, base (2) … base (99)', () => {
    const taken = new Set(['X.md', 'X (2).md']);
    expect(freeNoteName('X', (n) => taken.has(n))).toBe('X (3).md');
  });
  it('gives up after (99)', () => {
    expect(freeNoteName('X', () => true)).toBeNull();
  });
  it('trims a 100-code-point base to leave room for the longest suffix, " (99)"', () => {
    const base = 'x'.repeat(100);
    const taken = new Set([`${base}.md`]);
    const result = freeNoteName(base, (n) => taken.has(n));
    expect(result).toBe(`${'x'.repeat(95)} (2).md`);
  });
});

describe('defaultNoteFolder (IN18, IP11)', () => {
  it('sanitises the profile name and falls back when nothing is left', () => {
    expect(defaultNoteFolder('App/Core')).toBe('Codebase investigations/AppCore');
    expect(defaultNoteFolder('///')).toBe('Codebase investigations');
  });
});
