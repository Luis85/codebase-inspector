<script setup lang="ts">
import { computed } from 'vue';
import type { MetricValue } from '../../evidence';
import { edgeKey, type ModuleEdge, type ModuleSummary } from '../../read-models/architecture';
import {
  ARCH_EDGES_OMITTED_NOTE, ARCH_MAP_EYEBROW, ARCH_NODE_FILES, ARCH_NODE_LABEL, ARCH_NODE_LABEL_NOT_ANALYSED, ARCH_NOT_ANALYSED_NOTE,
} from '../../inspector-copy';
import { useUniqueId } from '../../unique-id';
import ProvenanceBadge from '../../kit/ProvenanceBadge.vue';
import { MAP_H, MAP_W, edgePath, nodePositions, toPercent } from './map-layout';

/** `evidence` is the relation value (N20): its state is the Map's badge, never "sample".
 *  `cycleModules` is the selected cycle's modules (N21), or null. */
const props = defineProps<{
  modules: readonly ModuleSummary[]; edges: readonly ModuleEdge[];
  violating: ReadonlySet<string>; violationsOnly: boolean; selected: string | null;
  cycleModules: ReadonlySet<string> | null; evidence: MetricValue; notAnalysed: boolean; omittedEdges: number;
}>();
const emit = defineEmits<{ select: [name: string] }>();
const markerId = useUniqueId('ci-map-arrow');

const positions = computed(() => new Map(nodePositions(props.modules.map((m) => m.name)).map((p) => [p.name, p])));

const nodes = computed(() => props.modules.flatMap((m) => {
  const pos = positions.value.get(m.name);
  if (!pos) return [];
  const outgoing = props.edges.filter((e) => e.from === m.name).length;
  const incoming = props.edges.filter((e) => e.to === m.name).length;
  // N5: without a report the counts would read as a measured 0; the label says "not analysed".
  const label = props.notAnalysed ? ARCH_NODE_LABEL_NOT_ANALYSED(m.label, m.fileCount) : ARCH_NODE_LABEL(m.label, m.fileCount, outgoing, incoming);
  return [{ m, style: toPercent(pos), label }];
}));

const drawn = computed(() => props.edges.flatMap((e) => {
  const a = positions.value.get(e.from);
  const b = positions.value.get(e.to);
  const violation = props.violating.has(edgeKey(e.from, e.to));
  if (!a || !b || (props.violationsOnly && !violation)) return [];
  const cycle = props.cycleModules !== null && props.cycleModules.has(e.from) && props.cycleModules.has(e.to);
  return [{ key: edgeKey(e.from, e.to), d: edgePath(a, b), violation, cycle, active: e.from === props.selected || e.to === props.selected }];
}));
</script>

<template>
  <figure class="ci-module-map">
    <figcaption class="ci-module-map__eyebrow">
      {{ ARCH_MAP_EYEBROW }}
      <ProvenanceBadge
        :state="evidence.state"
        :detail="evidence.reason"
      />
    </figcaption>
    <div class="ci-module-map__canvas">
      <svg
        class="ci-module-map__edges"
        :viewBox="`0 0 ${MAP_W} ${MAP_H}`"
        aria-hidden="true"
      >
        <defs>
          <marker
            :id="markerId"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path
              class="ci-module-map__arrow"
              d="M0,0 L10,5 L0,10 z"
            />
          </marker>
          <marker
            :id="`${markerId}-v`"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path
              class="ci-module-map__arrow ci-module-map__arrow--violation"
              d="M0,0 L10,5 L0,10 z"
            />
          </marker>
        </defs>
        <path
          v-for="e in drawn"
          :key="e.key"
          class="ci-module-map__edge"
          :class="{ 'ci-module-map__edge--violation': e.violation, 'ci-module-map__edge--cycle': e.cycle, 'ci-module-map__edge--active': e.active }"
          :d="e.d"
          fill="none"
          :marker-end="`url(#${e.violation || e.cycle ? `${markerId}-v` : markerId})`"
        />
      </svg>
      <button
        v-for="n in nodes"
        :key="n.m.name"
        type="button"
        class="ci-module-map__node"
        :class="{ 'ci-module-map__node--selected': n.m.name === selected, 'ci-module-map__node--cycle': cycleModules?.has(n.m.name) }"
        :style="n.style"
        :aria-pressed="n.m.name === selected"
        :aria-label="n.label"
        @click="emit('select', n.m.name)"
      >
        <span class="ci-module-map__name">{{ n.m.label }}</span>
        <span class="ci-module-map__meta">{{ ARCH_NODE_FILES(n.m.fileCount) }}</span>
      </button>
    </div>
    <p
      v-if="notAnalysed"
      class="ci-architecture__note"
    >
      {{ ARCH_NOT_ANALYSED_NOTE }}
    </p>
    <p
      v-else-if="omittedEdges > 0"
      class="ci-architecture__note"
    >
      {{ ARCH_EDGES_OMITTED_NOTE(omittedEdges) }}
    </p>
  </figure>
</template>
