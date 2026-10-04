/** GRA1: a snapshot built from a bare list of repository-relative file paths, so the layout can be measured on a
 *  real tree without a filesystem scan. Every path prefix becomes a directory entity with a real parentId chain;
 *  every file gets a MEASURED line count of 10, so every lot has the full LOT_FOOTPRINT (an unavailable metric would
 *  shrink it to UNAVAILABLE_FOOTPRINT and skew occupancy). Nothing is sorted here: the layout sorts. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classify } from '../../src/domain/classify';
import { makeEntityId } from '../../src/domain/entity-id';
import type { CodeEntity, CodebaseSnapshot, Observation } from '../../src/domain/model';

/** `git ls-files` at the gap-closure plan base 3df98ea (1,236 paths), frozen as a sorted JSON array. */
export const REAL_TREE_PATHS: readonly string[] = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/real-tree.json'), 'utf8'),
) as string[];

const LINES = 10;

export function snapshotFromPaths(paths: readonly string[], repositoryId: string): CodebaseSnapshot {
  const repositoryEntity: CodeEntity = {
    id: makeEntityId(repositoryId, 'repository', ''),
    repositoryId, kind: 'repository', path: '', name: repositoryId,
    parentId: null, category: null,
  };
  const entities: CodeEntity[] = [repositoryEntity];
  const observations: Observation[] = [];
  const directories = new Map<string, CodeEntity>();

  const addDir = (path: string): CodeEntity => {
    const existing = directories.get(path);
    if (existing) return existing;
    const slash = path.lastIndexOf('/');
    const parent = slash < 0 ? repositoryEntity : addDir(path.slice(0, slash));
    const dir: CodeEntity = {
      id: makeEntityId(repositoryId, 'directory', path),
      repositoryId, kind: 'directory', path, name: path.slice(slash + 1), parentId: parent.id, category: null,
    };
    directories.set(path, dir);
    entities.push(dir);
    return dir;
  };

  const addFile = (path: string): void => {
    const slash = path.lastIndexOf('/');
    const parent = slash < 0 ? repositoryEntity : addDir(path.slice(0, slash));
    const file: CodeEntity = {
      id: makeEntityId(repositoryId, 'file', path),
      repositoryId, kind: 'file', path, name: path.slice(slash + 1), parentId: parent.id, category: classify(path),
    };
    entities.push(file);
    const measurement = (metricId: 'physical-lines' | 'byte-size', value: number): Observation => ({
      entityId: file.id,
      measurement: { metricId, unit: metricId === 'physical-lines' ? 'lines' : 'bytes', definitionVersion: '1' },
      status: 'measured', value, reason: null,
    });
    observations.push(measurement('physical-lines', LINES), measurement('byte-size', LINES * 20));
  };

  for (const path of paths) addFile(path);

  return {
    snapshotId: `snapshot-${repositoryId}`,
    schemaVersion: 1,
    repositoryId,
    providerRun: {
      runId: `run-${repositoryId}`, provider: 'builtin-inventory', origin: 'collected',
      capturedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:01.000Z',
    },
    scope: { rootPath: `/fixture/${repositoryId}`, exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false },
    entities,
    observations,
    fileSetDigest: `fixture-digest-${repositoryId}-${entities.length}`,
    completeness: 'complete',
    warnings: [],
  };
}
