// Part 6 Y24: Fix round 1 (Minor promoted to Important, E33) — `distinctById` used to
// de-duplicate on the 32-bit hash, not the Y24 key, so two DIFFERENT keys that happened
// to hash the same would silently drop a real finding. `fnv1a32Hex` is stubbed here so
// two distinct keys collide on purpose, in a file of its own so the stub never reaches
// the rest of the suite (each test file gets its own module graph).
import { describe, expect, it, vi } from 'vitest';
import { normalizeFallow } from '../../src/application/evidence/normalize-fallow';
import { FINDING_ID_PATTERN } from '../../src/ui/read-models/review-state';
import { fnv1a } from '../../src/ui/fixtures/seeded-random';
import { fallowDoc, rawReport, rows } from '../fixtures/fallow-fixture';

vi.mock('../../src/domain/hash', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/domain/hash')>();
  return {
    // Any key without a '#' suffix collides on 'aaaaaaaa', on purpose. A suffixed retry
    // key (the one `assignIds` builds on a collision) falls through to the real hash, so
    // the retry loop terminates the way it does in production, never on a second
    // stubbed collision.
    fnv1a32Hex: (text: string) => (text.includes('#') ? actual.fnv1a32Hex(text) : 'aaaaaaaa'),
  };
});

const hex = (text: string): string => fnv1a(text).toString(16).padStart(8, '0');

describe('normalizeFallow: an id collision between two different keys never drops a finding', () => {
  it('keeps both unused-export findings, rehashing the later key to a distinct id', () => {
    const doc = fallowDoc('dead-code-3.27.0', (d) => {
      const entries = rows(d, 'unused_exports');
      entries.push({ ...entries[0]!, export_name: 'otherHelper' });
    });
    const findings = normalizeFallow(rawReport(doc), { stripPrefix: null }).findings;
    const unused = findings.filter((f) => f.rule === 'unused-export');
    expect(unused.map((f) => f.symbol)).toEqual(['unusedHelper', 'otherHelper']);
    // The first key hashes to the stubbed collision value; the second, colliding on the
    // same value, is rehashed (once) on `key#1` through the real algorithm.
    expect(unused[0]!.id).toBe('UN-aaaaaaaa');
    expect(unused[1]!.id).toBe(`UN-${hex('src/text/format.ts|otherHelper|unused-export#1')}`);
    expect(new Set(findings.map((f) => f.id)).size).toBe(findings.length);
    for (const f of unused) expect(FINDING_ID_PATTERN.test(f.id)).toBe(true);
  });
});
