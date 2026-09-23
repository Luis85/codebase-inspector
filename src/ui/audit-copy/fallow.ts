// Part 6: fallow report import. Re-exported by inspector-copy.ts. Tasks 7-11 add the
// dialog, card, badge and lens strings to this file.
import { FALLOW_REPORT_MAX_BYTES, FALLOW_SUPPORTED, type FallowImportErrorCode, type FallowReportKind } from '../../application/evidence/raw-fallow';

/** Fix round 1 (E31, minor 5): "16 MB", derived instead of hard-coded, so the copy and
 *  the limit it describes cannot drift apart. */
const FALLOW_MAX_SIZE_TEXT = `${FALLOW_REPORT_MAX_BYTES / (1024 * 1024)} MB`;

function supportedText(): string {
  const byKind = new Map<FallowReportKind, number[]>();
  for (const s of FALLOW_SUPPORTED) byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s.schema]);
  const parts = [...byKind].map(([kind, schemas]) => `${kind} (schema ${schemas.join(' or ')})`);
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] ?? ''}`;
}

/** Y20: "combined (schema 11 or 12), dead-code (schema 9), health (schema 11) and dupes (schema 10)". */
export const FALLOW_SUPPORTED_TEXT = supportedText();

/** Y20: names what the file is and what this version reads. `kind` and `schema` come
 *  from the file and are shown as text only. */
export const FALLOW_UNSUPPORTED = (kind: string, schema: string): string =>
  `That file is a fallow “${kind}” report at schema ${schema}, which this version cannot read. Supported: ${FALLOW_SUPPORTED_TEXT}. Nothing was imported.`;

/** Y31: one message per refusal. `detail` is `<kind>@<schema>` (or '') for
 *  `unsupported` and the first issue's path for `invalid`; the other codes ignore it.
 *  A refusal never touches evidence that is already attached. */
export const FALLOW_IMPORT_ERROR: Readonly<Record<FallowImportErrorCode, (detail: string) => string>> = {
  'too-large': () => `That file is larger than ${FALLOW_MAX_SIZE_TEXT}, so it was not read. Nothing was imported.`,
  'not-json': () => 'That file is not valid JSON. Nothing was imported.',
  unsupported: (found) => {
    const at = found.lastIndexOf('@');
    return at < 0
      ? `That file is not a fallow report this version can read. Supported: ${FALLOW_SUPPORTED_TEXT}. Nothing was imported.`
      : FALLOW_UNSUPPORTED(found.slice(0, at), found.slice(at + 1));
  },
  invalid: (at) => (at === '' ? 'That fallow report is not valid. Nothing was imported.' : `That fallow report is not valid at ${at}. Nothing was imported.`),
  // COPY-17, adapted: a fallow report names no revision, so the match is by file path.
  'source-mismatch': () => 'This report does not match the selected source: none of its findings names a file in the current snapshot, even with the offered folder mapping. Nothing was imported.',
  'read-failed': () => 'Could not read that file. Nothing was imported.',
};

/** Y25: labels for the check.summary counts Part 6 reports but does not show. */
const NOT_SHOWN_LABEL: Readonly<Record<string, string>> = {
  unused_files: 'Unused files',
  private_type_leaks: 'Private type leaks',
  unused_dependencies: 'Unused dependencies',
  unused_enum_members: 'Unused enum members',
  unused_class_members: 'Unused class members',
  unused_store_members: 'Unused store members',
  unprovided_injects: 'Unprovided injects',
  unrendered_components: 'Unrendered components',
  unused_component_props: 'Unused component props',
  unused_component_emits: 'Unused component emits',
  unused_component_inputs: 'Unused component inputs',
  unused_component_outputs: 'Unused component outputs',
  unused_svelte_events: 'Unused Svelte events',
  unused_server_actions: 'Unused server actions',
  unused_load_data_keys: 'Unused load data keys',
  unresolved_imports: 'Unresolved imports',
  unlisted_dependencies: 'Unlisted dependencies',
  duplicate_exports: 'Duplicate exports',
  type_only_dependencies: 'Type-only dependencies',
  test_only_dependencies: 'Test-only dependencies',
  dev_dependencies_in_production: 'Dev dependencies used in production',
  circular_dependencies: 'Circular dependencies',
  re_export_cycles: 'Re-export cycles',
  boundary_violations: 'Boundary violations',
  boundary_coverage_violations: 'Boundary coverage violations',
  boundary_call_violations: 'Boundary call violations',
  policy_violations: 'Policy violations',
  stale_suppressions: 'Stale suppressions',
  unused_catalog_entries: 'Unused catalog entries',
  empty_catalog_groups: 'Empty catalog groups',
  unresolved_catalog_references: 'Unresolved catalog references',
  unused_dependency_overrides: 'Unused dependency overrides',
  misconfigured_dependency_overrides: 'Misconfigured dependency overrides',
  invalid_client_exports: 'Invalid client exports',
  mixed_client_server_barrels: 'Mixed client/server barrels',
  misplaced_directives: 'Misplaced directives',
  route_collisions: 'Route collisions',
  dynamic_segment_name_conflicts: 'Dynamic segment name conflicts',
  clone_groups_omitted: 'Clone groups left out of the report',
};

/** Y25: a key missing from the map is shown by its raw key. Own keys only, so a key such
 *  as "constructor" from the file never reaches Object.prototype. */
export const fallowNotShownLabel = (key: string): string =>
  (Object.prototype.hasOwnProperty.call(NOT_SHOWN_LABEL, key) ? NOT_SHOWN_LABEL[key] : undefined) ?? key;

// Part 6 Y39: the command palette entry.
export const FALLOW_COMMAND_IMPORT = 'Import analysis report';
