// read-models/dependencies.ts — Part 3 Q5/Q6: the fictional inventory, plus ONE real,
// metadata-only signal: which package.json files the inventory holds (never read).
import type { EntityId } from '../../domain/entity-id';
import type { CodebaseSnapshot } from '../../domain/model';
import { sample, type MetricValue } from '../evidence';
import { metricColumns, toCsv, type CsvColumn } from '../export/csv';
import { SAMPLE_PACKAGES, type PackageRelationship, type SamplePackage } from '../fixtures/sample-packages';
import {
  DEPS_CARD_ADVISORIES, DEPS_CARD_ADVISORIES_CAPTION, DEPS_CARD_LICENSE, DEPS_CARD_LICENSE_CAPTION, DEPS_CARD_PACKAGES,
  DEPS_CARD_PACKAGES_CAPTION, DEPS_CARD_UNUSED, DEPS_CARD_UNUSED_CAPTION, DEPS_LICENSE_UNRESOLVED,
} from '../inspector-copy';
import { rootFolderLabel } from './root-label';

export type PackageFilter = 'all' | PackageRelationship | 'review' | 'unused';
export interface PackageRow { pkg: SamplePackage; references: MetricValue }
export interface LicenseRow { key: string; label: string; packages: number; needsReview: boolean }
export interface ManifestRow { id: EntityId; path: string }
export interface DependenciesCard { id: 'packages' | 'advisories' | 'unused' | 'license'; label: string; icon: string; value: MetricValue; caption: string; tone: 'accent' | 'warning' }
export interface DependenciesModel {
  packages: readonly PackageRow[]; licenses: readonly LicenseRow[]; path: readonly SamplePackage[];
  manifests: readonly ManifestRow[]; rootLabel: string; cards: readonly DependenciesCard[]; usesSample: true;
}

const UNRESOLVED = '(unresolved)';
const count = (pred: (p: SamplePackage) => boolean): number => SAMPLE_PACKAGES.filter(pred).length;

function licenses(): LicenseRow[] {
  const by = new Map<string, number>();
  for (const p of SAMPLE_PACKAGES) { const k = p.license ?? UNRESOLVED; by.set(k, (by.get(k) ?? 0) + 1); }
  return [...by.entries()].map(([key, packages]) => ({
    key, label: key === UNRESOLVED ? DEPS_LICENSE_UNRESOLVED : key, packages, needsReview: key === UNRESOLVED,
  })).sort((a, b) => b.packages - a.packages || a.label.localeCompare(b.label));
}

/** The fixture's one illustrative path: the first transitive package with an advisory. */
function dependencyPath(): SamplePackage[] {
  const transitive = SAMPLE_PACKAGES.find((p) => p.relationship === 'transitive' && p.advisory !== null);
  const direct = SAMPLE_PACKAGES.find((p) => p.name === transitive?.via);
  return direct && transitive ? [direct, transitive] : [];
}

export function buildDependenciesModel(snapshot: CodebaseSnapshot): DependenciesModel {
  const manifests = snapshot.entities
    .filter((e) => e.kind === 'file' && e.name === 'package.json')
    .map((e) => ({ id: e.id, path: e.path }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    packages: SAMPLE_PACKAGES.map((pkg) => ({ pkg, references: sample(pkg.references) })),
    licenses: licenses(),
    path: dependencyPath(),
    manifests,
    rootLabel: rootFolderLabel(snapshot.scope.rootPath),
    cards: [
      { id: 'packages', label: DEPS_CARD_PACKAGES, icon: 'package', value: sample(SAMPLE_PACKAGES.length),
        caption: DEPS_CARD_PACKAGES_CAPTION(count((p) => p.relationship === 'direct'), count((p) => p.relationship === 'transitive'), count((p) => p.relationship === 'development')), tone: 'accent' },
      { id: 'advisories', label: DEPS_CARD_ADVISORIES, icon: 'shield', value: sample(count((p) => p.advisory !== null)), caption: DEPS_CARD_ADVISORIES_CAPTION, tone: 'warning' },
      { id: 'unused', label: DEPS_CARD_UNUSED, icon: 'file', value: sample(count((p) => p.status === 'unused')), caption: DEPS_CARD_UNUSED_CAPTION, tone: 'accent' },
      { id: 'license', label: DEPS_CARD_LICENSE, icon: 'file-text', value: sample(count((p) => p.license === null)), caption: DEPS_CARD_LICENSE_CAPTION, tone: 'warning' },
    ],
    usesSample: true,
  };
}

export function filterPackages(rows: readonly PackageRow[], query: string, filter: PackageFilter): readonly PackageRow[] {
  const q = query.trim().toLowerCase();
  return rows.filter(({ pkg }) => (filter === 'all' || pkg.relationship === filter || pkg.status === filter)
    && (!q || pkg.name.toLowerCase().includes(q)));
}

const PACKAGE_COLUMNS: readonly CsvColumn<PackageRow>[] = [
  { header: 'name', value: (r) => r.pkg.name },
  { header: 'version', value: (r) => r.pkg.version },
  { header: 'relationship', value: (r) => r.pkg.relationship },
  { header: 'license', value: (r) => r.pkg.license ?? undefined },
  { header: 'status', value: (r) => r.pkg.status },
  { header: 'advisory', value: (r) => r.pkg.advisory?.id },
  ...metricColumns<PackageRow>('references', (r) => r.references),
  { header: 'provenance', value: () => 'sample' },
];

export function packagesCsv(rows: readonly PackageRow[]): string {
  return toCsv(PACKAGE_COLUMNS, rows);
}
