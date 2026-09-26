// WP-03 N30/N31: the ONE derivation of the city Relations view for this leaf — the rows the
// Relations section lists and the arcs use-relation-renderer.ts sends — so the two can never
// disagree (every arc has its text row).
import { computed, type ComputedRef } from 'vue';
import { useCityStore } from '../stores/city-store';
import { useRelationsStore } from '../stores/relations-store';
import { cityRelationsFor, type CityRelationsView } from './city-relations';
import { useReadModels } from './use-read-models';

export function useCityRelations(): ComputedRef<CityRelationsView> {
  const city = useCityStore();
  const controls = useRelationsStore();
  const { relations } = useReadModels();
  return computed(() => cityRelationsFor(relations.value, city.selectedEntityId, controls));
}
