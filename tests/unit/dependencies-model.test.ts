import { describe, expect, it } from 'vitest';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';
import { makeEntityId } from '../../src/domain/entity-id';
import { SAMPLE_PACKAGES } from '../../src/ui/fixtures/sample-packages';
import { buildDependenciesModel, filterPackages, packagesCsv } from '../../src/ui/read-models/dependencies';
import { advisoriesCsv, buildSecurityModel } from '../../src/ui/read-models/security';
import { rootFolderLabel } from '../../src/ui/read-models/root-label';
import type { CodebaseSnapshot } from '../../src/domain/model';

function withManifests(snap: CodebaseSnapshot, paths: readonly string[]): CodebaseSnapshot {
  const extra = paths.map((path) => ({
    id: makeEntityId(snap.repositoryId, 'file', path), repositoryId: snap.repositoryId, kind: 'file' as const, path,
    name: path.slice(path.lastIndexOf('/') + 1), parentId: null, category: 'config' as const,
  }));
  return { ...snap, entities: [...snap.entities, ...extra] };
}

/** Hoisted to module scope: captures nothing (oxlint consistent-function-scoping). */
const countByRelationship = (r: string) => SAMPLE_PACKAGES.filter((p) => p.relationship === r).length;

describe('dependencies model (Part 3 Q5, Q6)', () => {
  const snap = buildSnapshotFixture({ files: 4 });

  it('is the fictional fixture: 7 direct, 2 transitive, 1 development; every package is @sample', () => {
    const m = buildDependenciesModel(snap);
    expect(m.packages).toHaveLength(10);
    expect(SAMPLE_PACKAGES).toHaveLength(10);
    expect(SAMPLE_PACKAGES.every((p) => p.name.startsWith('@sample/'))).toBe(true);
    expect([countByRelationship('direct'), countByRelationship('transitive'), countByRelationship('development')]).toEqual([7, 2, 1]);
    expect(m.cards).toHaveLength(4);
    expect(m.cards.every((c) => c.value.state === 'sample')).toBe(true);
  });

  it('lists manifests by NAME only, sorted, and never anything else', () => {
    const m = buildDependenciesModel(withManifests(snap, ['pkg/b/package.json', 'package.json', 'package.json.bak']));
    expect(m.manifests.map((x) => x.path)).toEqual(['package.json', 'pkg/b/package.json']);
  });

  it('filters by relationship, by status, and by name', () => {
    const rows = buildDependenciesModel(snap).packages;
    const transitive = filterPackages(rows, '', 'transitive');
    expect(transitive.length).toBeGreaterThan(0);
    expect(transitive.every((r) => r.pkg.relationship === 'transitive')).toBe(true);
    const review = filterPackages(rows, '', 'review');
    expect(review.length).toBeGreaterThan(0);
    expect(review.every((r) => r.pkg.status === 'review')).toBe(true);
    expect(filterPackages(rows, 'UI-KIT', 'all').map((r) => r.pkg.name)).toEqual(['@sample/ui-kit']);
    expect(filterPackages(rows, 'nothing', 'all')).toHaveLength(0);
  });

  it('licences: an unresolved licence is its own row that needs review', () => {
    const lic = buildDependenciesModel(snap).licenses;
    expect(lic.find((l) => l.key === 'MIT')?.packages).toBe(7);
    expect(lic.find((l) => l.needsReview)?.packages).toBe(1);
  });

  it('the dependency path runs through a direct to a transitive package; root label is the folder name', () => {
    const m = buildDependenciesModel(snap);
    expect(m.path.map((p) => p.relationship)).toEqual(['direct', 'transitive']);
    expect(m.path[1]?.via).toBe(m.path[0]?.name);
    expect(rootFolderLabel('C:\\work\\my-repo\\')).toBe('my-repo');
  });

  it('exports packages with a state per metric; an unresolved licence is an empty cell', () => {
    const csv = packagesCsv(buildDependenciesModel(snap).packages);
    expect(csv.split('\r\n')[0]).toBe('\uFEFFname,version,relationship,license,status,advisory,references,references_state,provenance');
    expect(csv).toContain('@sample/legacy-icons,0.9.0,direct,,unused,,0,sample,sample');
  });
});

describe('security model (Part 3 Q7)', () => {
  const m = buildSecurityModel();
  it('shows the two fixture advisories; runtime exploitability is unknown', () => {
    expect(m.advisories.map((p) => p.advisory?.id)).toEqual(['DEMO-ADV-001', 'DEMO-ADV-002']);
    expect(m.cards.find((c) => c.id === 'runtime')?.value.state).toBe('unknown');
  });
  it('secret candidates are not collected: unknown, never 0', () => {
    const secrets = m.cards.find((c) => c.id === 'secrets')!;
    expect(secrets.value.state).toBe('unknown');
    expect(secrets.value.value).toBeUndefined();
  });
  it('exports advisories with reachability unknown', () => {
    const [header, first] = advisoriesCsv(m.advisories).split('\r\n');
    expect(header).toBe('\uFEFFadvisory,package,installed,illustrative_patched,summary,reachability,provenance');
    expect(first).toContain(',unknown,sample');
  });
});
