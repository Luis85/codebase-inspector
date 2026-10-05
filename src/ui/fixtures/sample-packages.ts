// Part 3 Q5: a FICTIONAL package inventory. No registry, lockfile or manifest is read.
// Names, versions, licences and advisory text are fixture data, labelled on screen.
export type PackageRelationship = 'direct' | 'transitive' | 'development';
export type PackageStatus = 'review' | 'current' | 'update' | 'unused';
export interface SampleAdvisory { id: string; summary: string; patched: string }
export interface SamplePackage {
  name: string; version: string; license: string | null; relationship: PackageRelationship; status: PackageStatus;
  references: number; target: string | null; advisory: SampleAdvisory | null; via: string | null;
}

const pkg = (p: Partial<SamplePackage> & Pick<SamplePackage, 'name' | 'version' | 'relationship'>): SamplePackage => ({
  license: 'MIT', status: 'current', references: 0, target: null, advisory: null, via: null, ...p,
});

export const SAMPLE_PACKAGES: readonly SamplePackage[] = [
  pkg({ name: '@sample/document-parser', version: '2.4.0', relationship: 'direct', status: 'review', references: 12, target: '2.4.2',
    advisory: { id: 'DEMO-ADV-001', summary: 'Sample advisory: unsafe parsing of untrusted documents.', patched: '2.4.2' } }),
  pkg({ name: '@sample/archive-reader', version: '1.8.1', relationship: 'transitive', license: 'Apache-2.0', status: 'review', references: 3,
    target: '1.8.3', via: '@sample/document-parser',
    advisory: { id: 'DEMO-ADV-002', summary: 'Sample advisory: archive path validation requires review.', patched: '1.8.3' } }),
  pkg({ name: '@sample/ui-kit', version: '4.2.0', relationship: 'direct', references: 31 }),
  pkg({ name: '@sample/geometry', version: '3.1.2', relationship: 'direct', references: 22 }),
  pkg({ name: '@sample/serializer', version: '2.7.0', relationship: 'direct', references: 19 }),
  pkg({ name: '@sample/date-utils', version: '1.3.4', relationship: 'direct', status: 'update', references: 7, target: '1.4.0' }),
  pkg({ name: '@sample/legacy-icons', version: '0.9.0', relationship: 'direct', license: null, status: 'unused', references: 0 }),
  pkg({ name: '@sample/schema', version: '3.0.2', relationship: 'transitive', references: 16, via: '@sample/serializer' }),
  pkg({ name: '@sample/color', version: '1.2.0', relationship: 'direct', license: 'Apache-2.0', references: 11 }),
  pkg({ name: '@sample/test-harness', version: '5.1.0', relationship: 'development', references: 9 }),
];
