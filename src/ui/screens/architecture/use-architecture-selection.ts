// WP-03 N22: the Architecture screen's selection state, moved out of ArchitectureScreen.vue
// so the screen stays under 300 lines with the Cycles and Edges tabs. One module, and at
// most one of an edge, a rule or a cycle, is selected at a time; every watcher re-derives
// or clears a selection a rescan, a re-import or a rule removal took away (F3).
import { computed, ref, watch, type Ref } from 'vue';
import {
  cycleModules, edgeKey, moduleNeighbours, type ArchitectureModel,
} from '../../read-models/architecture';
import { moduleOf, type FileSummary } from '../../read-models/file-summaries';
import { useCityStore } from '../../stores/city-store';

/** N21/J20: the Edges tab shows at most this many rows, then EDGE_LIST_HIDDEN(n). The one
 *  definition: EdgeList.vue and the dense-graph benchmark (Task 13) both import it. */
export const EDGE_LIST_LIMIT = 200;

export function useArchitectureSelection(architecture: Ref<ArchitectureModel>, files: Ref<readonly FileSummary[]>) {
  const store = useCityStore();

  /** P12: open on the selected file's module when it is in the graph. Derived once from the
   *  shared selection, so there is no new cross-screen state. */
  const initialModule = (): string | null => {
    const names = architecture.value.modules.map((m) => m.name);
    const file = files.value.find((f) => f.id === store.selectedEntityId);
    const own = file ? moduleOf(file.path) : null;
    return own !== null && names.includes(own) ? own : names[0] ?? null;
  };

  const selectedModule = ref<string | null>(initialModule());
  const selectedEdge = ref<{ from: string; to: string } | null>(null);
  const selectedRuleId = ref<string | null>(null);
  /** A CycleView's findingId. */
  const selectedCycleId = ref<string | null>(null);

  const moduleSummary = computed(() => architecture.value.modules.find((m) => m.name === selectedModule.value) ?? null);
  const neighbours = computed(() => (selectedModule.value
    ? moduleNeighbours(architecture.value, selectedModule.value) : { incoming: [], outgoing: [] }));
  const selectedRule = computed(() => architecture.value.rules.find((r) => r.rule.id === selectedRuleId.value) ?? null);
  const selectedEdgeModel = computed(() => {
    const s = selectedEdge.value;
    return s ? architecture.value.edges.find((e) => e.from === s.from && e.to === s.to) ?? null : null;
  });
  const edgeViolates = computed(() => {
    const e = selectedEdgeModel.value;
    return e ? architecture.value.violatingEdgeKeys.has(edgeKey(e.from, e.to)) : false;
  });
  const selectedCycle = computed(() => architecture.value.relations.cycles.find((c) => c.findingId === selectedCycleId.value) ?? null);
  /** N21: the selected cycle's modules, highlighted on the Map; null with no cycle selected. */
  const highlightedModules = computed(() => (selectedCycle.value ? cycleModules(selectedCycle.value) : null));

  watch(() => architecture.value.rules, (rules) => {
    if (selectedRuleId.value && !rules.some((r) => r.rule.id === selectedRuleId.value)) selectedRuleId.value = null;
  });
  /** F3: a rescan or snapshot switch can drop the selected module; re-derive it so the
   *  inspector and the rule editor never hold a module the graph no longer has. */
  watch(() => architecture.value.modules, (modules) => {
    if (!modules.some((m) => m.name === selectedModule.value)) selectedModule.value = initialModule();
  });
  /** A re-import or rescan can drop the selected cycle: clear it, never highlight a stale one. */
  watch(() => architecture.value.relations.cycles, (cycles) => {
    if (selectedCycleId.value && !cycles.some((c) => c.findingId === selectedCycleId.value)) selectedCycleId.value = null;
  });

  const selectModule = (name: string): void => {
    selectedModule.value = name;
    selectedEdge.value = null;
    selectedRuleId.value = null;
    selectedCycleId.value = null;
  };
  const selectEdge = (edge: { from: string; to: string }): void => {
    selectedEdge.value = edge;
    selectedRuleId.value = null;
    selectedCycleId.value = null;
    selectedModule.value = edge.from;
  };
  const selectRule = (id: string): void => {
    selectedRuleId.value = id;
    selectedEdge.value = null;
    selectedCycleId.value = null;
    const from = architecture.value.rules.find((r) => r.rule.id === id)?.rule.from;
    if (from !== undefined && architecture.value.modules.some((m) => m.name === from)) selectedModule.value = from;
  };
  const selectCycle = (id: string): void => {
    selectedCycleId.value = id;
    selectedEdge.value = null;
    selectedRuleId.value = null;
  };

  return {
    selectedModule, selectedEdge, selectedRuleId, selectedCycleId, moduleSummary, neighbours, selectedRule,
    selectedEdgeModel, edgeViolates, selectedCycle, highlightedModules, selectModule, selectEdge, selectRule, selectCycle,
  };
}
