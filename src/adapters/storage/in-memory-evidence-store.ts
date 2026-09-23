// Part 6 Y28: imported fallow evidence, held in memory for this session only. main.ts
// builds ONE instance and every CityView shares it, so an import in one leaf reaches every
// leaf on the same codebase. Nothing is written to data.json or the vault: after a restart
// every codebase reads Not analysed until a report is imported again.
import type { EvidenceReport } from '../../application/evidence/model';
import type { EvidenceRepository } from '../../application/ports/evidence-repository';

/** One subscription. Wrapped, so the same listener subscribed twice unsubscribes independently. */
interface Subscription { listener: (repositoryId: string) => void }

export class InMemoryEvidenceStore implements EvidenceRepository {
  private readonly byRepository = new Map<string, EvidenceReport>();
  private readonly subscriptions = new Set<Subscription>();

  get(repositoryId: string): EvidenceReport | null {
    return this.byRepository.get(repositoryId) ?? null;
  }

  /** Last put wins: one report per codebase. */
  put(repositoryId: string, report: EvidenceReport): void {
    this.byRepository.set(repositoryId, report);
    this.notify(repositoryId);
  }

  remove(repositoryId: string): void {
    if (this.byRepository.delete(repositoryId)) this.notify(repositoryId);
  }

  /** Part 7 Z23: a failed run never clears evidence; it marks it. A NEW object, so every
   *  memo keyed on the report (E53) recomputes. */
  markStale(repositoryId: string): void {
    const report = this.byRepository.get(repositoryId);
    if (report === undefined || report.staleReason === 'failed-run') return;
    this.byRepository.set(repositoryId, { ...report, staleReason: 'failed-run' });
    this.notify(repositoryId);
  }

  subscribe(listener: (repositoryId: string) => void): () => void {
    const subscription: Subscription = { listener };
    this.subscriptions.add(subscription);
    return () => { this.subscriptions.delete(subscription); };
  }

  /** Over a copy, so a listener added while notifying waits for the next change (a live Set
   *  would call it in this same pass). */
  private notify(repositoryId: string): void {
    for (const s of Array.from(this.subscriptions)) s.listener(repositoryId);
  }
}
