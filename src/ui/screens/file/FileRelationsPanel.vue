<script setup lang="ts">
// WP-03 N17, N25: File detail's Relations panel — the file's evidenced hop-1 neighbourhood
// (both directions, RELATION_ARC_LIMIT), its cycles through this file as path text (N20),
// and fallow's fanOut (N8). N5: absent evidence is never "no imports"; RELATIONS_SCOPE_NOTE
// always shows. Each row's button selects that other file — File detail follows the
// selection (P11); selection never moves the camera (the caller's city-store invariant).
import { computed } from 'vue';
import type { EntityId } from '../../../domain/entity-id';
import { neighbourhood } from '../../../domain/relations/queries';
import { formatMetric } from '../../evidence';
import { useReadModels } from '../../read-models/use-read-models';
import { RELATION_ARC_LIMIT, type RelationSource } from '../../read-models/relations';
import {
  FALLOW_NOT_ANALYSED, RELATION_HIDDEN, RELATION_SOURCE_BOUNDARY, RELATION_SOURCE_CYCLE, RELATIONS_CYCLES_TITLE,
  RELATIONS_DIRECTION_IN, RELATIONS_DIRECTION_OUT, RELATIONS_FAN_OUT, RELATIONS_NONE_FOR_FILE, RELATIONS_SCOPE_NOTE,
  RELATIONS_TITLE,
} from '../../inspector-copy';
import Panel from '../../kit/Panel.vue';
import CycleMembers from '../architecture/CycleMembers.vue';

const props = defineProps<{ fileId: EntityId }>();
const emit = defineEmits<{ select: [id: EntityId] }>();

const { relations } = useReadModels();
const SOURCE_LABEL: Readonly<Record<RelationSource, string>> = { cycle: RELATION_SOURCE_CYCLE, boundary: RELATION_SOURCE_BOUNDARY };

interface RelationRow { key: string; id: EntityId; path: string; line: number | null; directionLabel: string; sourceLabel: string }

/** Matches the Architecture screen's own "not analysed" reading (relations.analysed). */
const notAnalysed = computed(() => !relations.value.analysed);

const neighbours = computed(() => neighbourhood(
  relations.value.index, props.fileId, { direction: 'both', hops: 1, limit: RELATION_ARC_LIMIT },
));

const rows = computed<RelationRow[]>(() => neighbours.value.edges.map((e) => {
  const view = relations.value.edge(e.from, e.to);
  const otherId = e.direction === 'out' ? e.to : e.from;
  const otherPath = e.direction === 'out' ? (view?.toPath ?? e.to) : (view?.fromPath ?? e.from);
  return {
    key: `${e.from}->${e.to}`, id: otherId, path: otherPath, line: view?.line ?? null,
    directionLabel: e.direction === 'out' ? RELATIONS_DIRECTION_OUT : RELATIONS_DIRECTION_IN,
    sourceLabel: view ? view.sources.map((s) => SOURCE_LABEL[s]).join(', ') : '',
  };
}));
const hidden = computed(() => neighbours.value.hidden);

const cyclesThroughFile = computed(() => relations.value.cycles.filter((c) => c.members.some((m) => m.id === props.fileId)));
const fanOut = computed(() => relations.value.fanOut(props.fileId));
</script>

<template>
  <Panel
    :title="RELATIONS_TITLE"
    :footnote="RELATIONS_SCOPE_NOTE"
  >
    <p
      v-if="notAnalysed"
      class="ci-note"
    >
      {{ FALLOW_NOT_ANALYSED }}
    </p>
    <template v-else>
      <p
        v-if="rows.length === 0"
        class="ci-note ci-file-relations__none"
      >
        {{ RELATIONS_NONE_FOR_FILE }}
      </p>
      <ul
        v-else
        class="ci-file-relations__list"
      >
        <li
          v-for="r in rows"
          :key="r.key"
          class="ci-file-relations__row"
        >
          <button
            type="button"
            class="ci-file-relations__select"
            @click="emit('select', r.id)"
          >
            <span class="ci-file-relations__direction">{{ r.directionLabel }}</span>
            <code class="ci-file-relations__path">{{ r.path }}:{{ r.line ?? '?' }}</code>
            <span class="ci-file-relations__source">{{ r.sourceLabel }}</span>
          </button>
        </li>
      </ul>
      <p
        v-if="hidden > 0"
        class="ci-file-relations__hidden"
      >
        {{ RELATION_HIDDEN(hidden) }}
      </p>
      <template v-if="cyclesThroughFile.length > 0">
        <h4 class="ci-file-relations__heading">
          {{ RELATIONS_CYCLES_TITLE }}
        </h4>
        <ul class="ci-file-relations__cycles">
          <li
            v-for="c in cyclesThroughFile"
            :key="c.findingId"
          >
            <code v-if="c.pathText !== ''">{{ c.pathText }}</code>
            <CycleMembers
              v-else
              :cycle="c"
            />
          </li>
        </ul>
      </template>
      <p class="ci-file-relations__fan-out">
        <span class="ci-file-relations__fan-out-label">{{ RELATIONS_FAN_OUT }}</span>
        <span>{{ formatMetric(fanOut) }}</span>
      </p>
    </template>
  </Panel>
</template>
