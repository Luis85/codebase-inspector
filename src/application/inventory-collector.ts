// Turns walk entries into CodeEntity + Observation records and returns a validated
// CodebaseSnapshot (task-5 brief step 9). Publication is task 8's job — this function
// only produces.
import { classify } from '../domain/classify';
import { makeEntityId } from '../domain/entity-id';
import { countPhysicalLines, byteSize, METRIC_PHYSICAL_LINES, METRIC_BYTE_SIZE } from '../domain/metrics';
import { validateSnapshot } from '../domain/validator';
import type {
  AnalysisScope, ApprovedInventoryRun, CodebaseSnapshot, CodeEntity, Observation,
} from '../domain/model';
import type { SourceFileSystemPort, WalkOptions } from './ports/source-filesystem-port';
import type { CancellationToken } from './ports/cancellation-token';
import type { Clock } from './ports/clock';

/** Ruling M21: a cancelled run REJECTS with this distinguishable type, rather than
 *  resolving with a partial CodebaseSnapshot a later caller could publish by accident.
 *  Produced here regardless of what a concrete CancellationToken implementation itself
 *  throws from `throwIfCancelled()` (this module normalises it — see `checkCancelled`),
 *  so task 8 can map cancellation to the `cancelled` run state without string-matching a
 *  message, whatever CancellationToken implementation it is actually running against. */
export class CancellationError extends Error {
  constructor() {
    super('The inventory run was cancelled.');
    this.name = 'CancellationError';
  }
}

function checkCancelled(token: CancellationToken): void {
  if (token.cancelled) throw new CancellationError();
}

function basenameOf(relativePath: string): string {
  const slash = relativePath.lastIndexOf('/');
  return slash === -1 ? relativePath : relativePath.slice(slash + 1);
}

function parentPathOf(relativePath: string): string {
  const slash = relativePath.lastIndexOf('/');
  return slash === -1 ? '' : relativePath.slice(0, slash);
}

function rootDisplayName(rootPath: string): string {
  const trimmed = rootPath.replace(/[\\/]+$/, '');
  const lastSep = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return lastSep === -1 ? trimmed : trimmed.slice(lastSep + 1);
}

/** A tiny, deterministic, non-cryptographic string hash (FNV-1a), used ONLY for
 *  `fileSetDigest`. Not `entity-id.ts`'s job (identity is explicitly NEVER hashed — spec
 *  4.1) and not a security boundary: this is a change-detection fingerprint over the set
 *  of kept relative paths, cheap enough to not need Node's `crypto` (which
 *  no-nodejs-modules forbids importing anywhere in src/**, this file included). */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

interface DirectoryPlan { path: string; parentPath: string | null }

/** Every directory that lies on a KEPT entry's path becomes an entity (brief step 9),
 *  so layout has a full containment tree — derived from the entries' own relative
 *  paths, not from the walker's separate 'directory' WalkEntries, because only a
 *  directory that actually leads to something kept should exist as an entity at all. */
function planAncestorDirectories(keptPaths: readonly string[]): DirectoryPlan[] {
  const seen = new Map<string, DirectoryPlan>();
  for (const path of keptPaths) {
    let current = parentPathOf(path);
    while (current !== '') {
      if (seen.has(current)) break;   // its own ancestors are already recorded too
      seen.set(current, { path: current, parentPath: parentPathOf(current) || null });
      current = parentPathOf(current);
    }
  }
  return [...seen.values()];
}

function buildRepositoryEntity(repositoryId: string, rootPath: string): CodeEntity {
  return {
    id: makeEntityId(repositoryId, 'repository', ''),
    repositoryId, kind: 'repository', path: '', name: rootDisplayName(rootPath),
    parentId: null, category: null,
  };
}

function buildDirectoryEntities(repositoryId: string, plans: readonly DirectoryPlan[]): Map<string, CodeEntity> {
  const byPath = new Map<string, CodeEntity>();
  // Shortest paths first, so a directory's parentId always resolves to an
  // already-built entity (or the repository, for a top-level directory).
  for (const plan of [...plans].sort((a, b) => a.path.split('/').length - b.path.split('/').length)) {
    const repositoryEntityId = makeEntityId(repositoryId, 'repository', '');
    const parentId = plan.parentPath ? makeEntityId(repositoryId, 'directory', plan.parentPath) : repositoryEntityId;
    byPath.set(plan.path, {
      id: makeEntityId(repositoryId, 'directory', plan.path),
      repositoryId, kind: 'directory', path: plan.path, name: basenameOf(plan.path),
      parentId, category: null,
    });
  }
  return byPath;
}

function buildFileEntity(
  repositoryId: string, relativePath: string, directories: ReadonlyMap<string, CodeEntity>, repositoryEntity: CodeEntity,
): CodeEntity {
  const parentPath = parentPathOf(relativePath);
  const parentId = parentPath ? directories.get(parentPath)!.id : repositoryEntity.id;
  return {
    id: makeEntityId(repositoryId, 'file', relativePath),
    repositoryId, kind: 'file', path: relativePath, name: basenameOf(relativePath),
    parentId, category: classify(relativePath),
  };
}

function measuredObservations(entityId: string, text: string, size: number): Observation[] {
  return [
    { entityId, measurement: METRIC_PHYSICAL_LINES, status: 'measured', value: countPhysicalLines(text), reason: null },
    { entityId, measurement: METRIC_BYTE_SIZE, status: 'measured', value: size, reason: null },
  ];
}

function unavailableObservations(entityId: string, reason: string): Observation[] {
  return [
    { entityId, measurement: METRIC_PHYSICAL_LINES, status: 'unavailable', value: null, reason },
    { entityId, measurement: METRIC_BYTE_SIZE, status: 'unavailable', value: null, reason },
  ];
}

/** Collects a full CodebaseSnapshot by walking `scope.rootPath` through `port`.
 *  Rejects with CancellationError (ruling M21) rather than resolving with a partial
 *  result when `token` is cancelled — cancellation and `completeness: 'partial'` are
 *  different axes (spec 7): a cancelled run never reaches this function's return at all. */
export async function collectInventory(
  port: SourceFileSystemPort,
  scope: AnalysisScope,
  approval: ApprovedInventoryRun,
  token: CancellationToken,
  clock: Clock,
): Promise<CodebaseSnapshot> {
  checkCancelled(token);
  const repositoryId = approval.profileId;
  const capturedAt = clock.nowIso();

  const walkOpts: WalkOptions = {
    exclusions: scope.exclusions, maxFileBytes: scope.maxFileBytes, followSymlinks: scope.followSymlinks,
  };

  const keptFiles: { path: string; absolutePath: string }[] = [];
  const skipped: { path: string; reason: string }[] = [];

  try {
    for await (const entry of port.walk(scope.rootPath, walkOpts, token)) {
      checkCancelled(token);
      if (entry.kind === 'file') {
        keptFiles.push({ path: entry.relativePath, absolutePath: entry.absolutePath });
      } else if (entry.kind === 'skipped') {
        skipped.push({ path: entry.relativePath, reason: entry.reason });
      }
    }
  } catch (e) {
    if (token.cancelled) throw new CancellationError();
    throw e;
  }
  checkCancelled(token);

  const repositoryEntity = buildRepositoryEntity(repositoryId, scope.rootPath);
  const directoryPlans = planAncestorDirectories([...keptFiles.map((f) => f.path), ...skipped.map((s) => s.path)]);
  const directories = buildDirectoryEntities(repositoryId, directoryPlans);

  const entities: CodeEntity[] = [repositoryEntity, ...directories.values()];
  const observations: Observation[] = [];
  const warningReasons = new Set<string>();

  for (const file of keptFiles) {
    const entity = buildFileEntity(repositoryId, file.path, directories, repositoryEntity);
    entities.push(entity);
    const read = await port.readText(file.absolutePath, scope.maxFileBytes);
    if (read.status === 'ok') {
      // byteSize(read.bytes), not the walk's own stat-reported file.byteSize: the byte
      // count for a MEASURED file is derived through the domain's own metric function
      // (task 2) applied to the bytes actually read, not trusted as a number an adapter
      // merely reports (the two agree for any successful read; this is which one the
      // domain layer is authoritative for).
      observations.push(...measuredObservations(entity.id, read.text, byteSize(read.bytes)));
    } else {
      observations.push(...unavailableObservations(entity.id, read.reason));
      warningReasons.add(read.reason);
    }
  }
  for (const entry of skipped) {
    const entity = buildFileEntity(repositoryId, entry.path, directories, repositoryEntity);
    entities.push(entity);
    observations.push(...unavailableObservations(entity.id, entry.reason));
    warningReasons.add(entry.reason);
  }

  const completedAt = clock.nowIso();
  const fileSetDigest = fnv1a([...keptFiles.map((f) => f.path), ...skipped.map((s) => s.path)].sort().join('\u0000'));

  const snapshot: CodebaseSnapshot = {
    snapshotId: `snapshot:${repositoryId}:${capturedAt}`,
    schemaVersion: 1,
    repositoryId,
    providerRun: {
      runId: `run:${repositoryId}:${capturedAt}`,
      provider: 'builtin-inventory',
      origin: 'collected',
      capturedAt,
      completedAt,
    },
    scope,
    entities,
    observations,
    fileSetDigest,
    completeness: warningReasons.size > 0 ? 'partial' : 'complete',
    warnings: [...warningReasons],
  };

  return validateSnapshot(snapshot);
}
