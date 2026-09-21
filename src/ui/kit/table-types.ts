export interface TableColumn<T> {
  key: string;
  label: string;
  numeric?: boolean;
  /** null sorts last in either direction (unknown is never "smallest"). */
  sortValue?: (row: T) => number | string | null;
}

/**
 * Named separately (rather than inlined in EvidenceTable.vue's defineProps) so the
 * function type's parameter name lives in a plain .ts file: the project's flat eslint
 * config only scopes the type-aware `@typescript-eslint/no-unused-vars` (which correctly
 * ignores a type-position parameter name) to **.ts/.tsx** files, not .vue's <script>
 * block, where the type-unaware core `no-unused-vars` stays active and misreads the same
 * parameter name as an unused variable.
 */
export type RowKey<T> = (row: T) => string;
