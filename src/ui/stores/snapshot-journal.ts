// stores/snapshot-journal.ts — Part 3 Q8: the snapshots this leaf has shown in this
// session, in memory only (durable history is WP-05). One store per leaf's Pinia.
import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import type { JournalEntry } from '../read-models/snapshot-comparison';

export const JOURNAL_CAP = 10;

export const useSnapshotJournal = defineStore('snapshot-journal', {
  state: () => ({ entries: [] as JournalEntry[] }),
  actions: {
    /** Oldest first. A snapshot already recorded is ignored; a different repository
     *  starts the journal over, so two codebases are never compared. */
    record(entry: JournalEntry): void {
      const last = this.entries[this.entries.length - 1];
      if (last && last.repositoryId !== entry.repositoryId) { this.entries = [markRaw(entry)]; return; }
      if (this.entries.some((e) => e.snapshotId === entry.snapshotId)) return;
      this.entries = [...this.entries, markRaw(entry)].slice(-JOURNAL_CAP);
    },
  },
});
