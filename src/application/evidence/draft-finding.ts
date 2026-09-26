// Part 6 Y24, WP-03 N9 (J8): a finding awaiting its id, moved out of normalize-fallow.ts
// so normalize-relations.ts can build the same shape without importing the normaliser.
// `key` is what Y24 hashes, kept apart from the finding itself so a hash collision
// between two DIFFERENT keys (Fix round 1, Minor→E33) can be resolved without ever
// dropping a finding.
import type { EvidenceFinding } from './model';

export type FindingPrefix = 'CX' | 'DU' | 'UN' | 'CY' | 'BV' | 'UR';

export interface DraftFinding {
  key: string;
  prefix: FindingPrefix;
  finding: Omit<EvidenceFinding, 'id'>;
}

/** Y26: every report path goes through the scanner's own `normalizeRelativePath`. A
 *  refused path is recorded and yields null (its finding is dropped). */
export type PathMapper = (reportPath: string) => string | null;

/** Fix round 1: `assignIds` (normalize-fallow.ts) dedupes and `idByKey` looks up by this
 *  composite key, never the bare `key`, so two different categories' keys that happen to
 *  collide as plain strings (a BV key `${from}|${to}|${specifier}` and a UR key
 *  `${path}|${specifier}` can coincide) never merge into one finding or point a relation
 *  at the wrong id. The hash input that becomes the id itself stays the bare `key`, so
 *  every id this produced before is unchanged. */
export const draftIdKey = (prefix: FindingPrefix, key: string): string => `${prefix}|${key}`;
