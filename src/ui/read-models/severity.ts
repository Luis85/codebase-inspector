// Polish E2 and E8: fallow's severity words, in one place. `high` is the tool's two top
// severities (Part 6 Y34).

/** Polish E8: fallow's own severities plus `unrated`, in rank order (Part 6 Y35, R6). A word a
 *  later fallow adds is kept verbatim on a finding; it is just not in this list. */
export type FindingSeverity = 'critical' | 'high' | 'moderate' | 'unrated';
export const FINDING_SEVERITIES: readonly FindingSeverity[] = ['critical', 'high', 'moderate', 'unrated'];

/** QF2: `string[]`, so `includes` takes a report's own word without a cast. */
const HIGH_SEVERITIES: readonly string[] = ['critical', 'high'];

export function isHighSeverity(severity: string | null): boolean {
  return severity !== null && HIGH_SEVERITIES.includes(severity);
}
