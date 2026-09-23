// Part 6 Y22: zod 4 schemas for the fallow report fields this plugin reads, and nothing
// else. Third-party input, so:
// - every field that is read is type-checked;
// - every other field is tolerated AND dropped: zod 4's `z.object` strips unknown keys,
//   so `fragment` (source text), `actions`, `suggestions`, `clone_families`,
//   `vital_signs`, `file_scores`, `hotspots`, `targets`, `health_score`, `next_steps` and
//   `_meta` never leave the parse (Y23);
// - our own formats stay `.strict()` (review-state-import.ts); this one cannot be,
//   because every fallow release adds fields.
//
// Fix round 1 (E31, Important 1): zod collects EVERY issue before returning from
// `z.array(itemSchema).safeParse(...)`. A supported header followed by a long array of
// bad elements (`"findings":[{},{},…]`) makes zod validate and record an issue for each
// bad field of each element, no matter how few of them read-fallow-report.ts uses
// afterwards. Every array whose length a fallow report controls (`unused_exports`,
// `unused_types`, `clone_groups`, its `instances`, `findings`, `workspace_diagnostics`)
// is therefore declared here as `z.array(z.unknown())`: this schema only checks that the
// field IS an array, in O(1) per element. read-fallow-report.ts then walks each such
// array by hand with the matching element schema below (also exported), stopping at the
// first failing element instead of validating the rest.
import { z } from 'zod';

const COUNT = z.number().int().nonnegative();

/** An element schema for `unused_exports` and `unused_types`. */
export const UNUSED_ENTRY = z.object({
  path: z.string(),
  export_name: z.string(),
  is_type_only: z.boolean(),
  line: COUNT,
  col: COUNT,
});

const CHECK_SHELL_FIELDS = {
  summary: z.record(z.string(), z.number()),
  unused_exports: z.array(z.unknown()),
  unused_types: z.array(z.unknown()),
};

/** An element schema for `clone_groups[].instances`. */
export const CLONE_INSTANCE = z.object({ file: z.string(), start_line: COUNT, end_line: COUNT });

/** An element schema for `clone_groups`. Its own `instances` is walked separately, so it
 *  stays `z.array(z.unknown())` here too: one clone group can carry many instances. */
export const CLONE_GROUP_SHELL = z.object({
  fingerprint: z.string(),
  token_count: COUNT,
  line_count: COUNT,
  instances: z.array(z.unknown()),
});

const DUPES_SHELL_FIELDS = {
  clone_groups: z.array(z.unknown()),
  clone_groups_omitted: COUNT.optional(),
};

/** An element schema for `findings`. */
export const HEALTH_FINDING = z.object({
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

const HEALTH_SHELL_FIELDS = {
  findings: z.array(z.unknown()),
  summary: z.object({ max_cyclomatic_threshold: z.number(), max_cognitive_threshold: z.number() }),
};

/** An element schema for `workspace_diagnostics`. */
export const WORKSPACE_DIAGNOSTIC = z.object({ path: z.string(), kind: z.string(), message: z.string() });

const COMMON_SHELL = {
  schema_version: z.number().int(),
  version: z.string().max(64).regex(/^\d+\.\d+\.\d+/, { error: 'Must start with major.minor.patch.' }),
  workspace_diagnostics: z.array(z.unknown()).optional(),
};

/** Y22: a discriminated union on `kind`. The (kind, schema_version) pair is checked
 *  against FALLOW_SUPPORTED before this runs, so only the four kinds reach it. Every
 *  hot array above is `z.unknown()` here; read-fallow-report.ts validates its elements. */
export const FALLOW_REPORT = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('combined'),
    ...COMMON_SHELL,
    check: z.object(CHECK_SHELL_FIELDS).optional(),
    dupes: z.object(DUPES_SHELL_FIELDS).optional(),
    health: z.object(HEALTH_SHELL_FIELDS).optional(),
  }),
  z.object({ kind: z.literal('dead-code'), ...COMMON_SHELL, ...CHECK_SHELL_FIELDS }),
  z.object({ kind: z.literal('health'), ...COMMON_SHELL, ...HEALTH_SHELL_FIELDS }),
  z.object({ kind: z.literal('dupes'), ...COMMON_SHELL, ...DUPES_SHELL_FIELDS }),
]);

/** The first failing element of `items`, at `[...prefix, index, ...itemPath]`, or every
 *  element parsed and stripped by `itemSchema`. Stops at the first failure: the reason
 *  this file exists (E31, Important 1). */
export function firstArrayFailure<T>(
  items: readonly unknown[],
  itemSchema: z.ZodType<T>,
  prefix: readonly PropertyKey[],
): { ok: true; values: T[] } | { ok: false; path: PropertyKey[] } {
  const values: T[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const result = itemSchema.safeParse(items[i]);
    if (!result.success) {
      const issue = result.error.issues[0];
      return { ok: false, path: [...prefix, i, ...(issue?.path ?? [])] };
    }
    values.push(result.data);
  }
  return { ok: true, values };
}
