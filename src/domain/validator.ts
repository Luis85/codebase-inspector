// Validation is runtime, not casts (spec 4.1). Persisted settings and restored view
// state are untrusted input. Every failure below contributes a reason string, and
// ValidationError.reasons carries ALL of them — never just the first — because a
// snapshot's warnings surface every reason, not the first one hit.
//
// zod-3 -> zod-4 spelling notes (task-2-context.md section 3): `.strict()` survived
// unchanged from zod 3 into zod 4 (verified by running it — see task-2-report.md), so
// no rewrite was needed there. `error.errors` (zod 3) is `error.issues` (zod 4) — used
// below. Custom per-check messages use the zod-4 `{ error: '...' }` option spelling
// (verified to work identically to the older `{ message: '...' }` spelling that zod 4
// still accepts, but `error` is the current one). zod 4's default behaviour already
// collects every issue across a schema (confirmed by direct experiment before writing
// this file) — no `abortEarly` configuration was needed to satisfy "collects ALL
// reasons".
import { z } from 'zod';
import { CATEGORY_IDS } from './classify';
import { normalizeRelativePath } from './path-safety';
import type { CityViewState, CodebaseSnapshot } from './model';

export class ValidationError extends Error {
  constructor(readonly reasons: readonly string[]) {
    super(`Snapshot validation failed:\n- ${reasons.join('\n- ')}`);
    this.name = 'ValidationError';
  }
}

const PAYLOAD_LIMIT = 200_000;

function formatIssue(issue: { message: string; path: readonly PropertyKey[] }): string {
  return issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message;
}

// --- CodebaseSnapshot -------------------------------------------------------------

const entityKindSchema = z.enum(['repository', 'directory', 'file']);

// Structural rules 4 and 5 (path safety, closed category vocabulary) live here, at the
// single entity, so the error message can name the offending entity id.
const codeEntitySchema = z.object({
  id: z.string().min(1),
  repositoryId: z.string().min(1),
  kind: entityKindSchema,
  path: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  category: z.string().nullable(),
}).strict().superRefine((val, ctx) => {
  // The repository entity is the root of the containment tree and has no relative
  // path of its own; by convention its path is the empty string, and that convention
  // is ENFORCED here, not merely assumed — every other kind goes through the same
  // untrusted-input path-safety check as any other entity.
  if (val.kind === 'repository') {
    if (val.path !== '') {
      ctx.addIssue({ code: 'custom', message: `a repository entity's path must be empty (entity ${val.id})` });
    }
  } else {
    try {
      normalizeRelativePath(val.path);
    } catch (e) {
      ctx.addIssue({ code: 'custom', message: `${(e as Error).message} (entity ${val.id})` });
    }
  }
  if (val.kind === 'file') {
    if (val.category === null || !(CATEGORY_IDS as readonly string[]).includes(val.category)) {
      // REJECTED, never re-inferred (spec 4.1) — this is the check the prototype's own
      // validator does not have.
      ctx.addIssue({ code: 'custom', message: `unknown category ${JSON.stringify(val.category)} on ${val.id}` });
    }
  } else if (val.category !== null) {
    // Model comment (model.ts): category is "null for repository and directory".
    ctx.addIssue({ code: 'custom', message: `category must be null on non-file entity ${val.id}` });
  }
});

const measurementSchema = z.object({
  metricId: z.enum(['physical-lines', 'byte-size']),
  unit: z.enum(['lines', 'bytes']),
  definitionVersion: z.literal('1'),
}).strict();

// Structural rules 6 and 7: unavailable is never 0 and always carries a reason;
// measured is always a real, non-negative, finite integer.
const observationSchema = z.object({
  entityId: z.string().min(1),
  measurement: measurementSchema,
  status: z.enum(['measured', 'unavailable']),
  value: z.number().nullable(),
  reason: z.string().nullable(),
}).strict().superRefine((val, ctx) => {
  if (val.status === 'unavailable') {
    if (val.value !== null || !val.reason) {
      ctx.addIssue({ code: 'custom',
        message: 'unavailable observation must carry a null value and a reason' });
    }
  } else if (val.value === null || !Number.isSafeInteger(val.value) || val.value < 0) {
    ctx.addIssue({ code: 'custom',
      message: 'measured observation value must be a non-negative safe integer' });
  }
});

// Structural rule 8: provenance is never read from a payload as a label. The built-in
// inventory is a `builtin-inventory` / `collected` ProviderRun; anything else is
// rejected, not displayed.
const providerRunSchema = z.object({
  runId: z.string().min(1),
  provider: z.string(),
  origin: z.string(),
  capturedAt: z.string(),
  completedAt: z.string().nullable(),
}).strict().superRefine((val, ctx) => {
  if (val.provider !== 'builtin-inventory' || val.origin !== 'collected') {
    ctx.addIssue({ code: 'custom',
      message: `provider "${val.provider}" is not a collected builtin-inventory run` });
  }
});

const analysisScopeSchema = z.object({
  rootPath: z.string().min(1),
  exclusions: z.array(z.string()),
  maxFileBytes: z.number(),
  followSymlinks: z.literal(false),
}).strict();

// Structural rules 1, 2 and 3: duplicate ids, dangling observation references and
// containment-tree cycles all need the whole entity list at once, so they live on the
// top-level snapshot schema rather than on codeEntitySchema.
const snapshotSchema = z.object({
  snapshotId: z.string().min(1),
  schemaVersion: z.literal(1, { error: 'unsupported schemaVersion: expected 1' }),
  repositoryId: z.string().min(1),
  providerRun: providerRunSchema,
  scope: analysisScopeSchema,
  entities: z.array(codeEntitySchema),
  observations: z.array(observationSchema),
  fileSetDigest: z.string(),
  completeness: z.enum(['complete', 'partial'], { error: 'unsupported completeness value' }),
  warnings: z.array(z.string()),
}).strict().superRefine((val, ctx) => {
  const idMap = new Map<string, (typeof val.entities)[number]>();
  for (const entity of val.entities) {
    if (idMap.has(entity.id)) {
      ctx.addIssue({ code: 'custom', message: `duplicate entity id: ${entity.id}` });
    } else {
      idMap.set(entity.id, entity);
    }
  }

  for (const entity of val.entities) {
    if (entity.parentId === null) continue;
    const visited = new Set<string>([entity.id]);
    let currentId: string | null = entity.parentId;
    let steps = 0;
    while (currentId !== null) {
      if (visited.has(currentId)) {
        ctx.addIssue({ code: 'custom', message: `containment-tree cycle at ${entity.id}` });
        break;
      }
      visited.add(currentId);
      const parent = idMap.get(currentId);
      if (!parent) break;   // dangling parentId — not one of the ten rules; ignored.
      currentId = parent.parentId;
      steps += 1;
      if (steps > val.entities.length + 1) {
        ctx.addIssue({ code: 'custom', message: `containment-tree cycle at ${entity.id}` });
        break;
      }
    }
  }

  for (const observation of val.observations) {
    if (!idMap.has(observation.entityId)) {
      ctx.addIssue({ code: 'custom',
        message: `reference integrity: observation targets unknown entity ${observation.entityId}` });
    }
  }
});

/** Validates and returns a CodebaseSnapshot, or throws ValidationError with every
 *  reason the payload violates. Never guesses, never re-infers, never coerces. */
export function validateSnapshot(input: unknown): CodebaseSnapshot {
  // Structural rule 9 (payload limit), checked cheaply up front: a report already
  // known to blow the budget is rejected without paying for a full deep parse of it.
  const shape = input as { entities?: unknown; observations?: unknown } | null | undefined;
  if (Array.isArray(shape?.entities) && Array.isArray(shape.observations)
      && shape.entities.length + shape.observations.length > PAYLOAD_LIMIT) {
    throw new ValidationError(['payload exceeds the entity limit']);
  }

  const result = snapshotSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map(formatIssue));
  }
  return result.data as CodebaseSnapshot;
}

// --- CityViewState ------------------------------------------------------------------

const cameraBookmarkSchema = z.object({
  projection: z.literal('orthographic'),
  mode: z.enum(['3d', 'top']),
  position: z.tuple([z.number(), z.number(), z.number()]),
  target: z.tuple([z.number(), z.number(), z.number()]),
  up: z.tuple([z.number(), z.number(), z.number()]),
  zoom: z.number(),
}).strict();

// getState() persists this through workspace.json, which is user-editable (spec 4.4):
// `.strict()` is what rejects a smuggled `rootPath` key, and there is no scan
// authorisation or resolved absolute path anywhere in this shape.
const cityViewStateSchema = z.object({
  profileId: z.string().nullable(),
  snapshotId: z.string().nullable(),
  selectedEntityId: z.string().nullable(),
  query: z.string(),
  viewMode: z.enum(['3d', 'top', 'list']),
  camera: cameraBookmarkSchema.nullable(),
  previous3dCamera: cameraBookmarkSchema.nullable(),
  inspectorOpen: z.boolean(),
}).strict();

export function validateCityViewState(input: unknown): CityViewState {
  const result = cityViewStateSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(result.error.issues.map(formatIssue));
  }
  return result.data;
}
