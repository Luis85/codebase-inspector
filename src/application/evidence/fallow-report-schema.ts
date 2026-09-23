// Part 6 Y22: zod 4 schemas for the fallow report fields this plugin reads, and nothing
// else. Third-party input, so:
// - every field that is read is type-checked;
// - every other field is tolerated AND dropped: zod 4's `z.object` strips unknown keys,
//   so `fragment` (source text), `actions`, `suggestions`, `clone_families`,
//   `vital_signs`, `file_scores`, `hotspots`, `targets`, `health_score`, `next_steps` and
//   `_meta` never leave the parse (Y23);
// - our own formats stay `.strict()` (review-state-import.ts); this one cannot be,
//   because every fallow release adds fields.
// The parse output is assignable to `RawFallowReport` (read-fallow-report.ts returns it
// as one), so tsc proves this schema and raw-fallow.ts's plain type agree.
import { z } from 'zod';

const COUNT = z.number().int().nonnegative();

const UNUSED_ENTRY = z.object({
  path: z.string(),
  export_name: z.string(),
  is_type_only: z.boolean(),
  line: COUNT,
  col: COUNT,
});
const CHECK_FIELDS = {
  summary: z.record(z.string(), z.number()),
  unused_exports: z.array(UNUSED_ENTRY),
  unused_types: z.array(UNUSED_ENTRY),
};

const CLONE_GROUP = z.object({
  fingerprint: z.string(),
  token_count: COUNT,
  line_count: COUNT,
  instances: z.array(z.object({ file: z.string(), start_line: COUNT, end_line: COUNT })),
});
const DUPES_FIELDS = {
  clone_groups: z.array(CLONE_GROUP),
  clone_groups_omitted: COUNT.optional(),
};

const HEALTH_FINDING = z.object({
  path: z.string(),
  name: z.string(),
  line: COUNT,
  col: COUNT,
  cyclomatic: COUNT,
  cognitive: COUNT,
  line_count: COUNT,
  exceeded: z.string(),
  severity: z.string(),
});
const HEALTH_FIELDS = {
  findings: z.array(HEALTH_FINDING),
  summary: z.object({ max_cyclomatic_threshold: z.number(), max_cognitive_threshold: z.number() }),
};

const COMMON = {
  schema_version: z.number().int(),
  version: z.string().max(64).regex(/^\d+\.\d+\.\d+/, { error: 'Must start with major.minor.patch.' }),
  workspace_diagnostics: z.array(z.object({ path: z.string(), kind: z.string(), message: z.string() })).optional(),
};

/** Y22: a discriminated union on `kind`. The (kind, schema_version) pair is checked
 *  against FALLOW_SUPPORTED before this runs, so only the four kinds reach it. */
export const FALLOW_REPORT = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('combined'),
    ...COMMON,
    check: z.object(CHECK_FIELDS).optional(),
    dupes: z.object(DUPES_FIELDS).optional(),
    health: z.object(HEALTH_FIELDS).optional(),
  }),
  z.object({ kind: z.literal('dead-code'), ...COMMON, ...CHECK_FIELDS }),
  z.object({ kind: z.literal('health'), ...COMMON, ...HEALTH_FIELDS }),
  z.object({ kind: z.literal('dupes'), ...COMMON, ...DUPES_FIELDS }),
]);
