import { describe, expect, it } from 'vitest';
import { noteText } from '../../src/application/investigation/note-text';

// NE16 (WP-04 Part 2 Task 11): real Obsidian autolinks a bare email (NPF10), and the angle form keeps its link after
// `<` and `>` are escaped, in reading view and live preview. Escaping `@` is what the native scenario proved inert.
describe('noteText escapes an email address (NE16)', () => {
  it('backslash-escapes the @ of a bare email', () => {
    expect(noteText('a@x.io')).toBe('a\\@x.io');
  });
  it('backslash-escapes the @ of an angle-bracket email', () => {
    expect(noteText('<a@x.io>')).toBe('\\<a\\@x.io\\>');
  });
});
