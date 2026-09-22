import { describe, expect, it } from 'vitest';
import { mdCell, mdCode, mdLine, mdQuote, mdValue } from '../../src/ui/export/markdown';
import { collected, sample, sumEvidence, unknown } from '../../src/ui/evidence';

describe('markdown (Part 4 W6)', () => {
  it('keeps user text on one line and stops it from starting a block', () => {
    expect(mdLine('# Title\nnext')).toBe('\\# Title next');
    expect(mdLine('- item')).toBe('\\- item');
    expect(mdLine('1. one')).toBe('1\\. one');
  });
  it('escapes pipes and backslashes in table cells', () => {
    expect(mdCell('a|b\\c')).toBe('a\\|b\\\\c');
  });
  it('fences code spans that contain backticks', () => {
    expect(mdCode('src/a.ts')).toBe('`src/a.ts`');
    expect(mdCode('a`b')).toBe('`` a`b ``');
  });
  it('quotes every line of a note', () => { expect(mdQuote('a\nb')).toBe('> a\n> b'); });
  it('spells out the evidence of every value and never writes unknown as 0', () => {
    expect(mdValue(collected(1200, 'inventory'), ' lines')).toBe('1,200 lines');
    expect(mdValue(sample(3))).toBe('3 (sample)');
    expect(mdValue(unknown('No secret-scanning provider'))).toBe('unknown (No secret-scanning provider)');
    expect(mdValue(sumEvidence([collected(3, 'inventory'), sample(4), unknown('x')]))).toBe('7 (partial, sample)');
  });
});
