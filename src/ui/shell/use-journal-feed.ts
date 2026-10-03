// shell/use-journal-feed.ts — Part 3 Q8: records each snapshot the leaf shows. Called
// once, from App.vue (the shell), never from city-view.ts (no line budget).
import { watch } from 'vue';
import { fileSummariesFor } from '../read-models/file-summaries';
import { journalEntryFor } from '../read-models/snapshot-comparison';
import { useCityStore } from '../stores/city-store';
import { useSnapshotJournal } from '../stores/snapshot-journal';

export function useJournalFeed(): void {
  const store = useCityStore();
  const journal = useSnapshotJournal();
  watch(() => store.snapshot, (snapshot) => {
    if (snapshot) journal.record(journalEntryFor(snapshot, fileSummariesFor(snapshot)));
  }, { immediate: true });
}
