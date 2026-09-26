// Part 6 Y28: where imported fallow evidence lives for the session. main.ts builds ONE
// instance, shared by every leaf through CityViewDeps.evidenceStore. Each leaf's evidence
// store (src/ui/stores/evidence-store.ts) mirrors the entry for the codebase it is bound to.
import type { EvidenceReport } from '../evidence/model';

export interface EvidenceRepository {
  /** The report attached to this codebase, or null. The stored object itself, never a copy. */
  get(repositoryId: string): EvidenceReport | null;
  /** Attaches the codebase's report, replacing any earlier one, THEN notifies every subscriber,
   *  synchronously: a subscriber already reads the new report. The analysis coordinator relies
   *  on this order (Polish B6): a subscriber that cancels re-entrantly during `put` ends the run
   *  `cancelled`, with the complete, verified report it had already published kept. */
  put(repositoryId: string, report: EvidenceReport): void;
  /** Removes it and notifies. Removing nothing notifies nobody. */
  remove(repositoryId: string): void;
  /** Called with the codebase whose report changed. Returns the unsubscribe function. */
  subscribe(listener: (repositoryId: string) => void): () => void;
  /** Part 7 Z23: after an operational run failure. Replaces the report with a copy marked
   *  `staleReason: 'failed-run'` and notifies; nothing when there is none or it is marked. */
  markStale(repositoryId: string): void;
}
