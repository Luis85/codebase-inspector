// Part 7 Z7/Z8/Z22: the fallow analysis service over a scripted process port, inspector and
// binding store — shared by the service tests and the consent-gate tests (Polish B7).
import { AnalysisCoordinator } from '../../src/application/analysis/analysis-coordinator';
import { createFallowAnalysisService } from '../../src/application/analysis/fallow-analysis-service';
import { FALLOW_RUN_ARGS } from '../../src/application/analysis/fallow-invocation';
import { fingerprintTrust, type TrustSubject } from '../../src/application/analysis/analyzer-trust';
import type { AnalyzerBindingStore } from '../../src/application/ports/analyzer-binding-store';
import { createCancellationToken } from '../../src/application/scan-coordinator';
import type { SourceFileSystemPort } from '../../src/application/ports/source-filesystem-port';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { InMemorySnapshotStore } from '../../src/adapters/storage/in-memory-snapshot-store';
import { createFixedClock } from './clock';
import { createFakeProcessPort } from './fake-process-port';
import { createFakeExecutableInspector, factsFor } from './fake-executable-inspector';
import { createInMemoryAnalyzerStore } from './in-memory-analyzer-store';
import { snapshotWithPaths } from './evidence-report';
import { FIXTURE_PROJECT_FILES } from './fallow-expected';

export const SNAPSHOT = snapshotWithPaths(FIXTURE_PROJECT_FILES, 'p1');
export const ROOT = SNAPSHOT.scope.rootPath;
export const EXE = '/opt/fallow/bin/fallow';
export const subjectOf = (facts = factsFor(EXE)): TrustSubject => ({ profileId: 'p1', machineId: 'm', rootPath: ROOT, args: FALLOW_RUN_ARGS(ROOT), facts });
/** A SourceFileSystemPort whose `stat` answers for the root; the other members are unused here. */
export const dirPort = (exists: () => boolean): SourceFileSystemPort => ({
  stat: () => Promise.resolve({ exists: exists(), isDirectory: exists(), isFile: false, isSymbolicLink: false, size: 0, mtimeMs: 0 }),
}) as unknown as SourceFileSystemPort;

export function createServiceWorld(store: AnalyzerBindingStore = createInMemoryAnalyzerStore('m')) {
  const process = createFakeProcessPort();
  const evidence = new InMemoryEvidenceStore();
  const clock = createFixedClock('2026-09-23T10:00:00.000Z');
  const snapshots = new InMemorySnapshotStore(clock);
  snapshots.put(SNAPSHOT);
  const coordinator = new AnalysisCoordinator({ process, evidence, snapshots, clock, createCancellationToken });
  const inspector = createFakeExecutableInspector('fallow');
  const root = { exists: true };
  const service = createFallowAnalysisService({
    store, inspector, coordinator, snapshots, getFilesystem: () => dirPort(() => root.exists), machineId: 'm', clock,
  });
  return { process, evidence, snapshots, coordinator, store, inspector, root, service };
}

export type ServiceWorld = ReturnType<typeof createServiceWorld>;

export async function trusted(s: ServiceWorld, version = '3.27.0'): Promise<void> {
  await s.store.bind('p1', EXE);
  await s.store.grantTrust('p1', { fingerprint: fingerprintTrust(subjectOf(), version), version, grantedAt: '2026-09-23T09:00:00.000Z' }, EXE);
}
export async function reviewed(s: ServiceWorld) {
  const result = await s.service.review('p1', SNAPSHOT, EXE);
  if (!result.ok) throw new Error(`test setup: review refused (${result.code})`);
  return result.review;
}
