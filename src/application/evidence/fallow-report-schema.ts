// Part 6 Y22: zod 4 schemas for the fallow report fields this plugin reads, and nothing
// else. Third-party input, so:
// - every field that is read is type-checked;
// - every other field is tolerated AND dropped: zod 4's `z.object` strips unknown keys,
//   so `fragment` (source text), `actions`, `suggestions`, `clone_families`,
//   `vital_signs`, `hotspots`, `targets`, `health_score`, `next_steps` and `_meta` never
//   leave the parse (Y23). WP-03 Part 1 N1: `health.file_scores` is now read, but only
//   for `path`, `fan_in` and `fan_out` — every other field fallow writes on it
//   (`maintainability_index`, `dead_code_ratio`, etc.) is still dropped;
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
//
// Fix round 2 (E31, Important 1 continued): the same attack works through a record, not
// only an array — `z.record(z.string(), z.number())` also validates every value before
// returning, so `check.summary`/the flattened `summary` (an object with as many keys as
// the report writer wants) was still unbounded. It is now `z.record(z.string(),
// z.unknown())` here; `firstRecordFailure` below walks its values by hand, the record
// counterpart of `firstArrayFailure`. Every other record/array container in this file
// was re-checked against the same attack and is already bounded: the object-shaped
// per-element schemas (`UNUSED_ENTRY`, `CLONE_INSTANCE`, `HEALTH_FINDING`,
// `WORKSPACE_DIAGNOSTIC`) and the two-field health `summary` object all have a small,
// fixed set of keys, not one the report controls.
import { z } from 'zod';

const COUNT = z.number().int().nonnegative();

/** N1: the bound for the relation sections' tool-controlled strings (paths, specifiers,
 *  zone names): a long one is refused rather than tolerated. Existing fields (`path`,
 *  `export_name`, etc. above) are untouched by this bound (J5). */
const TOOL_TEXT = z.string().max(1024);

/** A `check.summary`/flattened `summary` value: exported so read-fallow-report.ts's
 *  manual walk (`firstRecordFailure`) can validate one value at a time (Fix round 2). */
export const SUMMARY_VALUE = z.number();

/** An element schema for `unused_exports` and `unused_types`. */
export const UNUSED_ENTRY = z.object({
  path: z.string(),
  export_name: z.string(),
  is_type_only: z.boolean(),
  line: COUNT,
  col: COUNT,
});

/** WP-03 Part 1 N1: the shell for one `circular_dependencies` element. `files` and
 *  `edges` are each `z.array(z.unknown())` here too: read-fallow-report.ts walks them by
 *  hand with `CYCLE_FILE`/`CYCLE_EDGE` (E31), the same two-level pattern as `buildDupes`.
 *  Final review #5: a cycle names at least one file — an empty `files` is refused as
 *  `invalid` here, never normalised into a finding with no path. */
export const CYCLE_SHELL = z.object({ files: z.array(z.unknown()).min(1), line: COUNT, col: COUNT, edges: z.array(z.unknown()).optional() });

/** An element schema for `circular_dependencies[].files`. */
export const CYCLE_FILE = TOOL_TEXT;

/** An element schema for `circular_dependencies[].edges`. */
export const CYCLE_EDGE = z.object({ path: TOOL_TEXT, line: COUNT, col: COUNT });

/** WP-03 Part 1 N1: the shell for one `re_export_cycles` element; its `files` is walked
 *  by hand with `CYCLE_FILE` too, and like CYCLE_SHELL's it is never empty. */
export const RE_EXPORT_CYCLE_SHELL = z.object({ files: z.array(z.unknown()).min(1), kind: z.enum(['multi-node', 'self-loop']) });

/** An element schema for `boundary_violations`. */
export const BOUNDARY_VIOLATION = z.object({
  from_path: TOOL_TEXT, to_path: TOOL_TEXT, from_zone: TOOL_TEXT, to_zone: TOOL_TEXT, import_specifier: TOOL_TEXT, line: COUNT, col: COUNT,
});

/** An element schema for `unresolved_imports`. */
export const UNRESOLVED_IMPORT = z.object({ path: TOOL_TEXT, specifier: TOOL_TEXT, line: COUNT, col: COUNT });

/** An element schema for `health.file_scores` (WP-03 Part 1 N1: only `path`, `fan_in`
 *  and `fan_out` are read; every other field fallow writes is dropped). */
export const FILE_SCORE = z.object({ path: TOOL_TEXT, fan_in: COUNT, fan_out: COUNT });

const CHECK_SHELL_FIELDS = {
  summary: z.record(z.string(), z.unknown()),
  unused_exports: z.array(z.unknown()),
  unused_types: z.array(z.unknown()),
  circular_dependencies: z.array(z.unknown()).optional(),
  re_export_cycles: z.array(z.unknown()).optional(),
  boundary_violations: z.array(z.unknown()).optional(),
  unresolved_imports: z.array(z.unknown()).optional(),
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
  file_scores: z.array(z.unknown()).optional(),
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

/** One element's outcome for `firstArrayFailure`'s custom form: `path` is relative to
 *  that element (an empty array names the element itself). */
type ElementResult<T> = { ok: true; value: T } | { ok: false; path: PropertyKey[] };

/** The first failing element of `items`, at `[...prefix, index, ...itemPath]`, or every
 *  element parsed and stripped by `check`. Stops at the first failure: the reason this
 *  file exists (E31, Important 1). `check` is a zod schema for a flat element, or (Fix
 *  round 2) a validator function for an element that itself needs a nested walk —
 *  `buildDupes` (read-fallow-report.ts) uses this form so its own per-group-then-
 *  per-instance loop does not have to repeat this one. */
export function firstArrayFailure<T>(
  items: readonly unknown[],
  check: z.ZodType<T> | ((item: unknown) => ElementResult<T>),
  prefix: readonly PropertyKey[],
): { ok: true; values: T[] } | { ok: false; path: PropertyKey[] } {
  const validate: (item: unknown) => ElementResult<T> = typeof check === 'function' ? check : (item) => {
    const parsed = check.safeParse(item);
    return parsed.success ? { ok: true, value: parsed.data } : { ok: false, path: parsed.error.issues[0]?.path ?? [] };
  };
  const values: T[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const result = validate(items[i]);
    if (!result.ok) return { ok: false, path: [...prefix, i, ...result.path] };
    values.push(result.value);
  }
  return { ok: true, values };
}

/** The record counterpart of `firstArrayFailure` (Fix round 2, E31 Important 1): the
 *  first bad value of `record`, at `[...prefix, key, ...issuePath]`, or every value
 *  parsed by `valueSchema`, stopping at the first failure instead of validating the
 *  rest. `__proto__` is always skipped — never validated, never copied into `values` —
 *  so the output can never gain an inherited key, matching `z.record`'s own behaviour. */
export function firstRecordFailure<T>(
  record: Readonly<Record<string, unknown>>,
  valueSchema: z.ZodType<T>,
  prefix: readonly PropertyKey[],
): { ok: true; values: Record<string, T> } | { ok: false; path: PropertyKey[] } {
  const values: Record<string, T> = {};
  for (const key of Object.keys(record)) {
    if (key === '__proto__') continue;
    const result = valueSchema.safeParse(record[key]);
    if (!result.success) {
      const issue = result.error.issues[0];
      return { ok: false, path: [...prefix, key, ...(issue?.path ?? [])] };
    }
    values[key] = result.data;
  }
  return { ok: true, values };
}
