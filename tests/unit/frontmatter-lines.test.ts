// Gap closure GRB5: rewriteFrontmatterLines replaces only the snapshot_id and source_path lines of a note's
// frontmatter, so the person's comments and quoting survive a refresh, and refuses (so the caller falls back to
// Obsidian's own frontmatter write) whenever it cannot be sure which bytes a key owns.
import { describe, expect, it } from 'vitest';
import { rewriteFrontmatterLines } from '../../src/host/frontmatter-lines';

const VALUES = { snapshot_id: 's2', source_path: 'src/b.ts' };
const NOTE = [
  '---', 'type: codebase-investigation', "reviewer: 'me'  # kept", '# a comment of its own',
  'source_path: src/a.ts', 'snapshot_id: s1', "status: 'open'", '---', '', 'body', '',
].join('\n');

const rewritten = (text: string): string => {
  const result = rewriteFrontmatterLines(text, VALUES);
  if (!result.ok) throw new Error('expected the rewrite to succeed');
  return result.text;
};

describe('rewriteFrontmatterLines: what is rewritten', () => {
  it('replaces only the two lines, as double-quoted scalars; every other byte is unchanged', () => {
    expect(rewritten(NOTE)).toBe(NOTE.replace('source_path: src/a.ts', 'source_path: "src/b.ts"').replace('snapshot_id: s1', 'snapshot_id: "s2"'));
  });

  it('keeps CRLF line endings, on the rewritten lines too', () => {
    const crlf = NOTE.split('\n').join('\r\n');
    const text = rewritten(crlf);
    expect(text).toBe(crlf.replace('source_path: src/a.ts', 'source_path: "src/b.ts"').replace('snapshot_id: s1', 'snapshot_id: "s2"'));
    expect(text.split('\r\n')).toHaveLength(crlf.split('\r\n').length);
  });

  it('keeps each line\'s own ending in a file that mixes CRLF and LF', () => {
    const mixed = '---\r\nsnapshot_id: s1\nsource_path: x\r\nother: y\n---\r\nbody\n';
    expect(rewritten(mixed)).toBe('---\r\nsnapshot_id: "s2"\nsource_path: "src/b.ts"\r\nother: y\n---\r\nbody\n');
  });

  it('replaces single-quoted, double-quoted and plain values alike', () => {
    const text = rewritten(["---", "snapshot_id: 'old ''one'''", 'source_path: "a\\"b"', '---', 'x'].join('\n'));
    expect(text).toBe(['---', 'snapshot_id: "s2"', 'source_path: "src/b.ts"', '---', 'x'].join('\n'));
  });

  it('allows a hash that is not a comment (no space before it) in the old value', () => {
    expect(rewritten(['---', 'snapshot_id: a#b', 'source_path: x', '---'].join('\n'))).toContain('snapshot_id: "s2"');
  });

  it('writes values containing quotes, colons and hashes so JSON.parse of the scalar gives them back', () => {
    for (const value of ['say "hi"', "it's", 'a: b', 'a #b', '# lead', 'tab\there', 'line\nbreak', 'back\\slash', 'u\u2028v', 'del\u007f', 'smile \u{1F600} end']) {
      const result = rewriteFrontmatterLines(NOTE, { snapshot_id: value, source_path: 'src/b.ts' });
      if (!result.ok) throw new Error('expected the rewrite to succeed');
      const line = result.text.split('\n').find((l) => l.startsWith('snapshot_id: '));
      expect(line).toBeDefined();
      expect(JSON.parse((line ?? '').slice('snapshot_id: '.length))).toBe(value);
      expect(line).not.toMatch(/[\u2028\u007f]/);
    }
  });
});

const refused = (text: string): boolean => !rewriteFrontmatterLines(text, VALUES).ok;
const note = (...lines: string[]): string => ['---', ...lines, '---', 'body'].join('\n');

describe('rewriteFrontmatterLines: when it refuses', () => {
  it.each([
    ['no frontmatter', 'snapshot_id: s1\nsource_path: x\n'],
    ['an unclosed frontmatter block', '---\nsnapshot_id: s1\nsource_path: x\n'],
    ['a duplicated snapshot_id', note('snapshot_id: s1', 'snapshot_id: s0', 'source_path: x')],
    ['a duplicated source_path', note('snapshot_id: s1', 'source_path: x', 'source_path: y')],
    ['a missing snapshot_id', note('source_path: x')],
    ['a missing source_path', note('snapshot_id: s1')],
    ['a literal block value', note('snapshot_id: |', '  s1', 'source_path: x')],
    ['a folded block value', note('snapshot_id: >', '  s1', 'source_path: x')],
    ['an indented continuation of a plain value', note('snapshot_id: s1', '  more', 'source_path: x')],
    ['an indented continuation after a blank line', note('snapshot_id: s1', '', '  more', 'source_path: x')],
    ['an indented continuation after a whitespace-only line', note('snapshot_id: s1', '   ', '  more', 'source_path: x')],
    ['an indented continuation after a blank line (source_path)', note('snapshot_id: s1', 'source_path: x', '', '  more')],
    ['an indented continuation after a comment line', note('snapshot_id: s1', '# c', '  more', 'source_path: x')],
    ['a byte order mark before the block', `\ufeff${note('snapshot_id: s1', 'source_path: x')}`],
    ['an open quote', note('snapshot_id: "s1', '  end"', 'source_path: x')],
    ['an empty value', note('snapshot_id:', 'source_path: x')],
    ['a flow value', note('snapshot_id: [a,', ' b]', 'source_path: x')],
    ['a nested key', note('meta:', '  snapshot_id: s1', 'source_path: x')],
    ['a comment on a plain value', note('snapshot_id: s1 # old', 'source_path: x')],
    ['a comment after a quoted value', note("snapshot_id: 's1'  # old", 'source_path: x')],
    ['a quoted key', note('"snapshot_id": s1', 'source_path: x')],
  ])('%s', (_label, text) => {
    expect(refused(text)).toBe(true);
  });
});
