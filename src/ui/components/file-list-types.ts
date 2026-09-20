// Task 6: types shared between CodebaseFileList.vue and CodebaseFileListGroup.vue.
// Deliberately a plain .ts module, not exported from either .vue file: eslint's
// type-aware pass (tseslint.parser against tsconfig.json) does not resolve a type
// imported from ANOTHER .vue SFC's <script setup> the way vue-tsc's own language
// tools do — `import type { X } from './Other.vue'` typechecks fine under
// `npm run typecheck` but reads as `error`-typed under `npm run lint`, cascading into
// spurious `@typescript-eslint/no-unsafe-member-access` reports wherever the type is
// used. A plain .ts import has neither problem.
import type { EntityId } from '../../domain/entity-id';
import type { CodeEntity } from '../../domain/model';

/** One district's own group of files, in the order CodebaseFileList.vue's
 *  `groupedFiles` computed built it — see that file for how (C07's `grouping`
 *  input, ordered by `store.layout.districts`). */
export interface FileGroup {
  directoryId: EntityId;
  name: string;
  entities: CodeEntity[];
}

/** The three things a row's rendering depends on, precomputed once per relevant
 *  store change (not once per row, per keystroke) — see CodebaseFileList.vue's
 *  `rowStates` computed. Kept as a plain data shape, never a function prop:
 *  `defineProps<{ isDimmed: (id: EntityId) => boolean }>()` — a named-parameter
 *  function TYPE literal declared inside a .vue `defineProps<>()` — reads as an
 *  unused-variable under this repo's `.vue` lint config (plain `no-unused-vars`,
 *  not the TS-aware version, running against `<script setup>`); a data prop with no
 *  such literal has no equivalent trap. */
export interface RowState {
  dimmed: boolean;
  tabIndex: number;
  selected: boolean;
}
