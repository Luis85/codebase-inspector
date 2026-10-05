import { describe, expect, it } from 'vitest';
import { noteText } from '../../src/application/investigation/note-text';

// NE16 (WP-04 Part 2 Task 11): real Obsidian autolinks a bare email (NPF10), and the angle form keeps its link after
// `<` and `>` are escaped, in reading view and live preview. Escaping `@` is what the native scenario proved inert.
// GRB16: only an `@` after a GFM email local-part character can start an email, so only that one is escaped.
describe('noteText escapes an email address (NE16)', () => {
  it('backslash-escapes the @ of a bare email', () => {
    expect(noteText('a@x.io')).toBe('a\\@x.io');
  });
  it('backslash-escapes the @ of an angle-bracket email', () => {
    expect(noteText('<a@x.io>')).toBe('\\<a\\@x.io\\>');
  });
});

describe('noteText leaves an @ that cannot start an email bare (GRB16)', () => {
  it('keeps a package scope free of a backslash', () => {
    expect(noteText('@scope/pkg')).toBe('@scope/pkg');
  });
  it('keeps a package scope after a space free of a backslash', () => {
    expect(noteText('see @scope/pkg')).toBe('see @scope/pkg');
  });
  it('keeps an @ after an opening parenthesis bare', () => {
    expect(noteText('(@scope/pkg)')).toBe('(@scope/pkg)');
  });
  it('keeps an @ after a backslash bare, because the backslash is not a local-part character', () => {
    expect(noteText('\\@x')).toBe('\\\\@x');
  });
});

describe('noteText escapes the @ after every GFM local-part character (GRB16)', () => {
  const LOCAL_PART_CHARS = `abcxyzABCXYZ0129.!#$%&'*+/=?^_\`{|}~-`;
  it.each(Array.from(LOCAL_PART_CHARS))('escapes the @ after %s', (char) => {
    const escaped = noteText(`a${char}@x.io`);
    expect(escaped.endsWith('\\@x.io')).toBe(true);
    // Exactly one @ in the output, and it is the escaped one.
    expect(escaped.match(/@/g)?.length).toBe(1);
  });
});
