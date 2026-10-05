// Fix round 1: the one rule for showing a "Compare snapshots" action (Evolution, Overview,
// City). A comparison needs an EARLIER journal entry than the snapshot on screen, so it is
// the current snapshot's journal index, not the journal's length, that decides.
import { computed, type ComputedRef } from 'vue';
import { useCityStore } from '../../stores/city-store';
import { useSnapshotJournal } from '../../stores/snapshot-journal';

export function useCanCompare(): ComputedRef<boolean> {
  const store = useCityStore();
  const journal = useSnapshotJournal();
  return computed(() => {
    const id = store.snapshot?.snapshotId;
    return id !== undefined && journal.entries.findIndex((e) => e.snapshotId === id) > 0;
  });
}
