// Part 6 Y23/Y24: what the recorded 3.27.0 fixture project normalises to. The project
// (tests/fixtures/fallow/project) has exactly one complex function, one clone group
// across two files, one unused export and one unused type. Ids are built from the Y24
// keys here, so a test that compares against these checks the key recipe too.
import { fnv1a32Hex } from '../../src/domain/hash';
import type { EvidenceFinding } from '../../src/application/evidence/model';
import { fallowDoc } from './fallow-fixture';

export const cxId = (path: string, name: string, occurrence: number): string => `CX-${fnv1a32Hex(`${path}|${name}|${occurrence}`)}`;
export const duId = (fingerprint: string, path: string): string => `DU-${fnv1a32Hex(`${fingerprint}|${path}`)}`;
export const unId = (path: string, name: string, rule: 'unused-export' | 'unused-type'): string =>
  `UN-${fnv1a32Hex(`${path}|${name}|${rule}`)}`;
// WP-03 N9: the relation finding ids. `members` is already sorted; `kind` selects the key prefix.
export const cyId = (kind: 'import' | 're-export', members: readonly string[]): string =>
  `CY-${fnv1a32Hex(`${kind === 'import' ? 'import' : 're-export'}|${members.join('\n')}`)}`;
export const bvId = (from: string, to: string, specifier: string): string => `BV-${fnv1a32Hex(`${from}|${to}|${specifier}`)}`;
export const urId = (path: string, specifier: string): string => `UR-${fnv1a32Hex(`${path}|${specifier}`)}`;

/** fallow's own clone fingerprint ("dup:6f87acd9" in the dry run), read from the
 *  recording rather than restated: it is the one opaque value fallow computes. */
export const FIXTURE_FINGERPRINT = String(fallowDoc('combined-3.27.0').dupes?.clone_groups[0]?.fingerprint);

export const PARTITION: EvidenceFinding = {
  id: cxId('src/layout/partition.ts', 'partitionDistrict', 0),
  category: 'complexity', rule: 'complexity', severity: 'critical', path: 'src/layout/partition.ts',
  line: 1, endLine: null, symbol: 'partitionDistrict',
  detail: {
    kind: 'complexity', cognitive: 32, cyclomatic: 18, lineCount: 37, exceeded: 'cognitive_crap',
    cognitiveThreshold: 15, cyclomaticThreshold: 20,
  },
};

const clone = (path: string): EvidenceFinding => ({
  id: duId(FIXTURE_FINGERPRINT, path),
  category: 'duplication', rule: 'duplication', severity: null, path,
  line: 1, endLine: 15, symbol: null,
  detail: { kind: 'duplication', tokenCount: 93, lineCount: 15, partnerFiles: 1 },
});
export const SUM_A = clone('src/text/sum-a.ts');
export const SUM_B = clone('src/text/sum-b.ts');

export const UNUSED_HELPER: EvidenceFinding = {
  id: unId('src/text/format.ts', 'unusedHelper', 'unused-export'),
  category: 'unused-exports', rule: 'unused-export', severity: null, path: 'src/text/format.ts',
  line: 7, endLine: null, symbol: 'unusedHelper', detail: { kind: 'unused', typeOnly: false },
};
export const LABEL_OPTIONS: EvidenceFinding = {
  id: unId('src/text/format.ts', 'LabelOptions', 'unused-type'),
  category: 'unused-exports', rule: 'unused-type', severity: null, path: 'src/text/format.ts',
  line: 1, endLine: null, symbol: 'LabelOptions', detail: { kind: 'unused', typeOnly: true },
};

/** Every file of the fixture project, as a scan of the project folder would list it. */
export const FIXTURE_PROJECT_FILES = [
  'package.json', 'src/index.ts', 'src/layout/partition.ts', 'src/text/format.ts', 'src/text/sum-a.ts', 'src/text/sum-b.ts',
];

/** A finding's position, without its id or measurements. */
export const where = (f: EvidenceFinding): string => `${f.rule} ${f.path}:${f.line ?? '-'}-${f.endLine ?? '-'} ${f.symbol ?? ''}`.trim();
