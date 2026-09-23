// Part 6: THE shared EvidenceReport fixture (ruling R5). Task 7: the empty report the store
// and wiring tests move around. Task 8 replaces this file with the full version (the
// synthetic fallow JSON and the report built from it through the real parser).
import type { EvidenceReport, FindingCategory } from '../../src/application/evidence/model';

type Categories = Record<FindingCategory, 'analysed' | 'not-analysed'>;
export const ALL_ANALYSED: Readonly<Categories> = { complexity: 'analysed', duplication: 'analysed', 'unused-exports': 'analysed' };
export const SYNTHETIC_VERSION = '3.27.0';

/** A well-formed report with no findings: the store and wiring tests only move it around. */
export function emptyEvidenceReport(snapshotId: string, fileName = 'fallow.json'): EvidenceReport {
  return {
    provider: 'fallow', providerVersion: SYNTHETIC_VERSION, reportKind: 'combined', schemaVersion: 12, fileName,
    importedAt: '2026-09-23T10:00:00.000Z', snapshotId, stripPrefix: null,
    normalized: { findings: [], categories: { ...ALL_ANALYSED }, notShown: [], rejectedPaths: [], warnings: [] },
  };
}
