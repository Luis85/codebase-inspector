import { classify } from '../../src/domain/classify';
import { makeEntityId } from '../../src/domain/entity-id';
import type { EntityId } from '../../src/domain/entity-id';
import type { CodeEntity, CodebaseSnapshot, Observation } from '../../src/domain/model';

export interface FixtureSpec {
  files: number;
  directories?: number;
  measuredZero?: number;            // files whose physical-lines is a MEASURED 0
  unavailable?: number;             // files whose physical-lines is unavailable + reason
  lineCounts?: readonly number[];   // explicit per-file values; used by capFixture
  repositoryId?: string;
  completeness?: 'complete' | 'partial';
  warnings?: readonly string[];
}

function makeObservation(entityId: EntityId, metricId: 'physical-lines' | 'byte-size',
  status: 'measured' | 'unavailable', value: number | null, reason: string | null): Observation {
  const unit = metricId === 'physical-lines' ? 'lines' : 'bytes';
  return { entityId, measurement: { metricId, unit, definitionVersion: '1' }, status, value, reason };
}

/** Builds a valid CodebaseSnapshot from a compact spec. Deterministic for a given spec. */
export function buildSnapshotFixture(spec: FixtureSpec): CodebaseSnapshot {
  const repositoryId = spec.repositoryId ?? 'repo-fixture';
  const directoryCount = spec.directories ?? 0;
  const measuredZero = spec.measuredZero ?? 0;
  const unavailable = spec.unavailable ?? 0;

  const entities: CodeEntity[] = [];
  const observations: Observation[] = [];

  const repositoryEntity: CodeEntity = {
    id: makeEntityId(repositoryId, 'repository', ''),
    repositoryId, kind: 'repository', path: '', name: repositoryId,
    parentId: null, category: null,
  };
  entities.push(repositoryEntity);

  const directories: CodeEntity[] = [];
  for (let i = 0; i < directoryCount; i += 1) {
    const path = `dir-${i}`;
    const entity: CodeEntity = {
      id: makeEntityId(repositoryId, 'directory', path),
      repositoryId, kind: 'directory', path, name: path,
      parentId: repositoryEntity.id, category: null,
    };
    directories.push(entity);
    entities.push(entity);
  }

  for (let i = 0; i < spec.files; i += 1) {
    const parent = directories.length > 0 ? directories[i % directories.length]! : repositoryEntity;
    const path = parent === repositoryEntity ? `file-${i}.ts` : `${parent.path}/file-${i}.ts`;
    const category = classify(path);
    const fileEntity: CodeEntity = {
      id: makeEntityId(repositoryId, 'file', path),
      repositoryId, kind: 'file', path, name: path.slice(path.lastIndexOf('/') + 1),
      parentId: parent.id, category,
    };
    entities.push(fileEntity);

    if (i < measuredZero) {
      observations.push(makeObservation(fileEntity.id, 'physical-lines', 'measured', 0, null));
      observations.push(makeObservation(fileEntity.id, 'byte-size', 'measured', 0, null));
    } else if (i < measuredZero + unavailable) {
      // A binary file: byte size is knowable even when line count is not.
      observations.push(makeObservation(fileEntity.id, 'physical-lines', 'unavailable', null,
        'binary content: physical lines are not defined'));
      observations.push(makeObservation(fileEntity.id, 'byte-size', 'measured', 4096, null));
    } else {
      const lines = spec.lineCounts?.[i] ?? 10 + i;
      observations.push(makeObservation(fileEntity.id, 'physical-lines', 'measured', lines, null));
      observations.push(makeObservation(fileEntity.id, 'byte-size', 'measured', lines * 20, null));
    }
  }

  return {
    snapshotId: 'snapshot-fixture',
    schemaVersion: 1,
    repositoryId,
    providerRun: {
      runId: 'run-fixture',
      provider: 'builtin-inventory',
      origin: 'collected',
      capturedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
    },
    scope: {
      rootPath: '/fixture/root',
      exclusions: [],
      maxFileBytes: 5_000_000,
      followSymlinks: false,
    },
    entities,
    observations,
    fileSetDigest: `fixture-digest-${entities.length}`,
    completeness: spec.completeness ?? 'complete',
    warnings: spec.warnings ?? [],
  };
}

/** 12 files, 3 directories, one measured-zero and one unavailable. The default fixture. */
export function tinyFixture(): CodebaseSnapshot {
  return buildSnapshotFixture({ files: 12, directories: 3, measuredZero: 1, unavailable: 1 });
}

/** 200 files whose values put the 95th percentile WELL BELOW the maximum, so
 *  clampedCount is provably nonzero: 190 files at 10-300 lines, 10 at 2,000-9,000.
 *  Task 4's cap check depends on this; neither prototype's fixture exercises the cap. */
export function capFixture(): CodebaseSnapshot {
  const lineCounts: number[] = [];
  for (let i = 0; i < 190; i += 1) lineCounts.push(10 + Math.round((i / 189) * 290));
  for (let i = 0; i < 10; i += 1) lineCounts.push(2000 + Math.round((i / 9) * 7000));
  return buildSnapshotFixture({ files: 200, lineCounts });
}

/** Combining marks, an RTL segment, spaces, and a 240-character path. */
export function unicodeFixture(): CodebaseSnapshot {
  const repositoryId = 'repo-unicode';
  const segment = 'á fólder مجلد'; // combining acute + RTL Arabic
  const padding = 'x'.repeat(Math.max(0, 240 - segment.length - '/file.ts'.length));
  const path = `${segment}${padding}/file.ts`;
  const repositoryEntity: CodeEntity = {
    id: makeEntityId(repositoryId, 'repository', ''),
    repositoryId, kind: 'repository', path: '', name: repositoryId,
    parentId: null, category: null,
  };
  const directoryEntity: CodeEntity = {
    id: makeEntityId(repositoryId, 'directory', `${segment}${padding}`),
    repositoryId, kind: 'directory', path: `${segment}${padding}`, name: `${segment}${padding}`,
    parentId: repositoryEntity.id, category: null,
  };
  const fileEntity: CodeEntity = {
    id: makeEntityId(repositoryId, 'file', path),
    repositoryId, kind: 'file', path, name: 'file.ts',
    parentId: directoryEntity.id, category: classify(path),
  };
  const observations: Observation[] = [
    makeObservation(fileEntity.id, 'physical-lines', 'measured', 42, null),
    makeObservation(fileEntity.id, 'byte-size', 'measured', 900, null),
  ];
  return {
    snapshotId: 'snapshot-unicode',
    schemaVersion: 1,
    repositoryId,
    providerRun: {
      runId: 'run-unicode', provider: 'builtin-inventory', origin: 'collected',
      capturedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:01.000Z',
    },
    scope: { rootPath: '/fixture/unicode', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false },
    entities: [repositoryEntity, directoryEntity, fileEntity],
    observations,
    fileSetDigest: 'fixture-digest-unicode',
    completeness: 'complete',
    warnings: [],
  };
}

/** Zero files. Valid, and must yield finite geometry bounds downstream. */
export function emptyFixture(): CodebaseSnapshot {
  return buildSnapshotFixture({ files: 0 });
}

/**
 * Ruling M11: `buildSnapshotFixture` emits a completely FLAT tree — every directory's
 * parentId is the repository, so every district it produces sits at depth 1 and a
 * nesting assertion against it would pass vacuously. This fixture has a genuinely
 * nested containment tree instead: alpha/beta at depth 1, four directories at depth 2,
 * and one at depth 3 (alpha/one/nested), each with real parentId chains back to the
 * root. Adding this function changes no existing fixture's behaviour.
 */
export function nestedFixture(): CodebaseSnapshot {
  const repositoryId = 'repo-nested';
  const repositoryEntity: CodeEntity = {
    id: makeEntityId(repositoryId, 'repository', ''),
    repositoryId, kind: 'repository', path: '', name: repositoryId,
    parentId: null, category: null,
  };
  const entities: CodeEntity[] = [repositoryEntity];
  const observations: Observation[] = [];
  let fileIndex = 0;

  const addDir = (parent: CodeEntity, path: string, name: string): CodeEntity => {
    const dir: CodeEntity = {
      id: makeEntityId(repositoryId, 'directory', path),
      repositoryId, kind: 'directory', path, name, parentId: parent.id, category: null,
    };
    entities.push(dir);
    return dir;
  };

  const addFile = (parent: CodeEntity, path: string): void => {
    const name = path.slice(path.lastIndexOf('/') + 1);
    const file: CodeEntity = {
      id: makeEntityId(repositoryId, 'file', path),
      repositoryId, kind: 'file', path, name, parentId: parent.id, category: classify(path),
    };
    entities.push(file);
    const lines = 10 + fileIndex;
    fileIndex += 1;
    observations.push(makeObservation(file.id, 'physical-lines', 'measured', lines, null));
    observations.push(makeObservation(file.id, 'byte-size', 'measured', lines * 20, null));
  };

  const alpha = addDir(repositoryEntity, 'alpha', 'alpha');
  const beta = addDir(repositoryEntity, 'beta', 'beta');
  const alphaOne = addDir(alpha, 'alpha/one', 'one');
  const alphaTwo = addDir(alpha, 'alpha/two', 'two');
  const betaOne = addDir(beta, 'beta/one', 'one');
  addDir(beta, 'beta/two', 'two');
  const alphaOneNested = addDir(alphaOne, 'alpha/one/nested', 'nested');

  addFile(alpha, 'alpha/a.ts');
  addFile(alphaOne, 'alpha/one/b.ts');
  addFile(alphaTwo, 'alpha/two/c.ts');
  addFile(beta, 'beta/d.ts');
  addFile(betaOne, 'beta/one/e.ts');
  addFile(alphaOneNested, 'alpha/one/nested/f.ts');

  return {
    snapshotId: 'snapshot-nested',
    schemaVersion: 1,
    repositoryId,
    providerRun: {
      runId: 'run-nested', provider: 'builtin-inventory', origin: 'collected',
      capturedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:00:01.000Z',
    },
    scope: { rootPath: '/fixture/nested', exclusions: [], maxFileBytes: 5_000_000, followSymlinks: false },
    entities,
    observations,
    fileSetDigest: `fixture-digest-nested-${entities.length}`,
    completeness: 'complete',
    warnings: [],
  };
}
