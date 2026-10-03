// Part 7 Z25: an imported report keeps its exact Part 6 shape; only a collected run has
// `collected`, and that is how its origin is told.
import { describe, expect, it } from 'vitest';
import { originOf, type EvidenceReport } from '../../src/application/evidence/model';
import { emptyEvidenceReport } from '../fixtures/evidence-report';

describe('originOf (Z25)', () => {
  it('is imported without `collected`, and the Part 6 shape has no new key', () => {
    const imported = emptyEvidenceReport('s1');
    expect(originOf(imported)).toBe('imported');
    expect(Object.keys(imported).sort()).toEqual(
      ['fileName', 'importedAt', 'normalized', 'provider', 'providerVersion', 'reportKind', 'schemaVersion', 'snapshotId', 'stripPrefix']);
  });

  it('is collected with `collected`', () => {
    const collected: EvidenceReport = {
      ...emptyEvidenceReport('s1', 'fallow.exe'),
      collected: {
        origin: 'collected', sourceMatch: 'verified', runId: 'r1', rootPath: 'C:\\repo', executablePath: 'C:\\Tools\\fallow\\fallow.exe',
        args: ['--format', 'json', '--no-cache', '--quiet', '--root', 'C:\\repo'], exitCode: 1,
        startedAt: '2026-09-23T10:00:00.000Z', durationMs: 900, versionTested: true,
      },
    };
    expect(originOf(collected)).toBe('collected');
  });
});
