<!--
  C07 — the HTML inventory list. Activating a row writes `cityStore.select()`, the store
  of record, and nothing else: task 10 fix round 1, item 2 removed the direct
  `renderer.setSelection()` call that used to sit beside it, because a canvas pick had
  no equivalent and so the two surfaces disagreed. CityViewport now watches
  `store.selectedEntityId` and is the SINGLE path to the port, for both surfaces — row
  activation neither imports the renderer handle for selection nor issues a selection
  command to it. Its own test guards against the second SELECTION path being
  reintroduced here.

  Rows are native <button>s (never role="tree" — that is future, richer-than-WP-01
  tree semantics this component does not implement) with a roving tabindex: moving
  focus with the keyboard never selects, only Enter/click activation does.

  Task 6 (F9/F4): grouped by district (C07's `grouping` input) with a per-group focus
  control (C07's `directoryFocusRequested` event) — this is the ONE place in the
  component that DOES hold a renderer handle, for that one command; it still never
  touches selection. See `focusDistrict` below: task 6 fix round 1 closed the
  production-caller gap that used to make this command a no-op — `focus(entityId)`
  (city-renderer.ts) now resolves a directory id through `districtOf` and frames the
  district's own ground extent.
-->
<script setup lang="ts">
import { computed } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useInspectorOpener } from '../drawer-focus';
import { useCityRendererHandle } from '../renderer-handle';
import { formatCopy11, formatFileListHeader } from '../copy';
import CodebaseFileListGroup from './CodebaseFileListGroup.vue';
import type { FileGroup, RowState } from './file-list-types';
import type { EntityId } from '../../domain/entity-id';
import type { CodeEntity } from '../../domain/model';
import { useLensView } from '../read-models/use-lens-view';
import { LENS_LIST_COLUMN } from '../inspector-copy';

const store = useCityStore();
const inspectorOpener = useInspectorOpener();
const renderer = useCityRendererHandle();
/** Part 6 Y40: the Reported column, in list mode only — beside the canvas, the city itself
 *  carries the lens. */
const { active: lensActive, evidence } = useLensView();
const reportedColumn = computed(() => lensActive.value && store.viewMode === 'list');

const fileEntities = computed(() => (store.snapshot?.entities.filter((e) => e.kind === 'file') ?? []));
const totalFileCount = computed(() => fileEntities.value.length);
const noMatches = computed(() => store.matchingIds !== null && store.matchingIds.size === 0);
const emptyCopy = computed(() => formatCopy11(totalFileCount.value, store.query));
const headerCopy = computed(() => formatFileListHeader(totalFileCount.value));

// C07's `grouping` input. Files are grouped by the SAME directoryId the city itself
// assigns each lot (store.layout.lots), never by entity.parentId — the two can differ
// once MAX_DIRECT_SUBDISTRICTS aggregation re-parents a file's lot to an ancestor
// district (districts.ts), and group ORDER follows store.layout.districts, so the
// list and the city agree on both membership and order rather than introducing a
// second, disagreeing organisation (task-6-brief.md). A district with none of its own
// files directly under it — the repository root itself, the instant any subdirectory
// exists — is simply omitted rather than rendered as an empty heading.
const groupedFiles = computed<FileGroup[]>(() => {
  const directoryOf = new Map<EntityId, EntityId>();
  for (const lot of store.layout?.lots ?? []) directoryOf.set(lot.entityId, lot.directoryId);

  const byDirectory = new Map<EntityId, CodeEntity[]>();
  for (const entity of fileEntities.value) {
    const directoryId = directoryOf.get(entity.id);
    if (directoryId === undefined) continue;   // no layout yet for this entity — never misfile it
    const list = byDirectory.get(directoryId);
    if (list) list.push(entity); else byDirectory.set(directoryId, [entity]);
  }

  const groups: FileGroup[] = [];
  for (const district of store.layout?.districts ?? []) {
    const entities = byDirectory.get(district.directoryId);
    if (entities && entities.length > 0) {
      groups.push({ directoryId: district.directoryId, name: district.name, entities });
    }
  }
  return groups;
});

// Phase 2c, ruling M102 (the IN-SCOPE half; windowing is deliberately not attempted --
// see the report). These used to be called (twice each -- once for `v-memo`'s own
// dependency array, once again for the class/tabindex/aria bindings) PER ROW on every
// patch, and `rovingTabIndex` re-derived the single focus target inside each of those
// ~2,000 calls. `rowStates` computes every row's {dimmed, tabIndex, selected} ONCE per
// relevant change instead -- still one pass over the files, same as before, just a
// single pass instead of up to four -- and each row's own work in
// CodebaseFileListGroup.vue becomes a Map lookup.
//
// Deliberately its OWN computed, not folded into `groupedFiles` above: `groupedFiles`
// depends only on the snapshot/layout (rare changes), and a keystroke touches only
// `matchingIds`. Combining the two would make every keystroke also re-run the
// directory-grouping pass for no reason -- the same mistake M102 exists to prevent.
const matchingIds = computed(() => store.matchingIds);
const focusTarget = computed(() => store.focusedEntityId ?? fileEntities.value[0]?.id ?? null);

const rowStates = computed<ReadonlyMap<EntityId, RowState>>(() => {
  const map = new Map<EntityId, RowState>();
  for (const entity of fileEntities.value) {
    map.set(entity.id, {
      dimmed: matchingIds.value !== null && !matchingIds.value.has(entity.id),
      tabIndex: entity.id === focusTarget.value ? 0 : -1,
      selected: entity.id === store.selectedEntityId,
      // WP-03 N12: `touching`, the same map the lens paints (use-lens-view.ts), so a
      // cycle's other members and a violation's other end read their finding here too.
      // Each finding is listed once per file it touches; totals still count it once.
      reported: reportedColumn.value ? (evidence.value.touching.get(entity.id)?.length ?? 0) : null,
    });
  }
  return map;
});

/** Activating a row both selects it AND opens the inspector (task 9 fix round
 *  1, item 7 — this is the "opener" the narrow-drawer close returns focus to;
 *  `openInspector()` had no production caller at all before this). Captures
 *  `event.currentTarget` — the row button itself — through the shared handle
 *  so FileInspector's own close button knows where to return focus. */
function activate(entityId: EntityId, event: Event): void {
  store.select(entityId);
  inspectorOpener.value = event.currentTarget as HTMLElement;
  store.openInspector();
}

/** C07's `directoryFocusRequested`: frames a district's lots in the 3D view without
 *  touching selection or the inspector — unlike `activate`, this never calls
 *  `store.select`. It commands the renderer directly, the same handle CameraControls'
 *  own Focus button reads (`renderer.value?.focus(store.selectedEntityId)`); there is
 *  no store field for "which directory is framed" because nothing else needs to read
 *  it back (spec 4.2: the renderer owns the live camera, the store only mirrors it).
 *
 *  Task 6 fix round 1 closed the production-caller gap this used to have: the real
 *  renderer's `focus(entityId)` (city-renderer.ts) tries `city.lotOf(entityId)` first
 *  — unchanged behaviour for every existing FILE caller — and, only when that finds
 *  no lot, tries the id as a district's own directoryId through `city.districtOf`
 *  (instanced-city.ts's `byDistrict` map), framing the district's ground extent.
 *  Neither id space overlaps the other (entity-id.ts's NUL-joined identity encodes
 *  `kind`), so this call now both reaches the renderer and moves the camera. */
function focusDistrict(directoryId: EntityId): void {
  renderer.value?.focus(directoryId);
}
</script>

<template>
  <div class="ci-file-list">
    <div class="ci-file-list__header">
      <span
        v-if="reportedColumn"
        class="ci-file-list__reported-head"
        aria-hidden="true"
      >{{ LENS_LIST_COLUMN }}</span>
      <h3 class="ci-file-list__title">
        {{ headerCopy }}
      </h3>
    </div>
    <CodebaseFileListGroup
      v-for="group in groupedFiles"
      :key="group.directoryId"
      :group="group"
      :row-states="rowStates"
      @activate="activate"
      @focus-row="store.focusRow"
      @focus-district="focusDistrict"
    />
    <p
      v-if="noMatches"
      class="ci-file-list__empty"
    >
      {{ emptyCopy }}
    </p>
  </div>
</template>
