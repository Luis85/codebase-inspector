// Part 6 Y40: the ONE derivation of "is the findings lens on, and which files are reported",
// shared by the renderer wiring (screens/city/use-lens-renderer.ts), MetricLegend, the lens
// heading, the toolbar select (E18) and the list-mode column, so they can never disagree.
// The lens is active only while it is chosen AND the bound codebase has evidence (current
// or stale).
import { computed, type ComputedRef } from 'vue';
import type { EntityId } from '../../domain/entity-id';
import { useLensStore } from '../stores/lens-store';
import { useReadModels } from './use-read-models';
import type { EvidenceIndex } from './evidence-index';

/** Keyed by the leaf's own index object (E53), itself memoised per (files, report), so
 *  turning the lens on and off rebuilds nothing and hands the renderer the same Set. */
const reportedCache = new WeakMap<EvidenceIndex, ReadonlySet<EntityId>>();
function reportedIdsFor(index: EvidenceIndex): ReadonlySet<EntityId> {
  let hit = reportedCache.get(index);
  if (!hit) {
    // `groupByFile` creates a file's entry with its first finding, so none is empty (Polish E11).
    hit = new Set(index.byFile.keys());
    reportedCache.set(index, hit);
  }
  return hit;
}

interface LensView {
  active: ComputedRef<boolean>;
  evidence: ComputedRef<EvidenceIndex>;
  /** The reported files while the lens is active; null means category colours. */
  reported: ComputedRef<ReadonlySet<EntityId> | null>;
}

export function useLensView(): LensView {
  const lens = useLensStore();
  const { evidence } = useReadModels();
  const active = computed(() => lens.lens === 'findings' && evidence.value.state !== 'none');
  const reported = computed(() => (active.value ? reportedIdsFor(evidence.value) : null));
  return { active, evidence, reported };
}
