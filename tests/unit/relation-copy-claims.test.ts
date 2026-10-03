// WP-03 spec §5 acceptance: "Static coupling is not presented as proof of runtime
// execution or inevitable breakage" — no line in src/ui/audit-copy/relations.ts claims
// code "calls", "executes" or "will break", except RELATIONS_STATIC_NOTE's own sentence.
// Spec §0 also requires never calling a source-code relationship an Obsidian backlink.
// Modelled on tests/unit/fallow-run-copy.test.ts's "G6: no copy claims a sandbox" sweep.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RELATIONS_STATIC_NOTE } from '../../src/ui/audit-copy/relations';

const FILE = resolve(process.cwd(), 'src', 'ui', 'audit-copy', 'relations.ts');

describe('relations copy claims (spec §5, §0)', () => {
  it('no line claims code "calls" or "executes", or that a change "will break", except RELATIONS_STATIC_NOTE\'s own sentence', () => {
    const lines = readFileSync(FILE, 'utf8').split('\n')
      .filter((line) => /\bcalls\b|\bexecutes\b|will break/i.test(line));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain(RELATIONS_STATIC_NOTE);
  });

  it('never calls a source-code relationship an Obsidian backlink', () => {
    expect(readFileSync(FILE, 'utf8')).not.toMatch(/backlink/i);
  });
});
