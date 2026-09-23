// Part 6 Y11/R2 (Task 7 adds Y28's evidence store to both functions): the plugin-level data
// ports a CityView hands to its own Pinia stores in onOpen, before mount, so App's first
// bind already uses them — and takes back in onClose, before the Pinia is dropped, because
// the ports outlive the leaf. Kept out of city-view.ts (the 360-line budget).
import type { Pinia } from 'pinia';
import { useReviewStore } from '../ui/stores/review-store';
import { useCityStore } from '../ui/stores/city-store';
import { useEvidenceStore } from '../ui/stores/evidence-store';
import type { CityViewDeps } from './city-scan-controller';

/** Y11: the review store builds each codebase's repository through the plugin's registry,
 *  so two leaves on one codebase share one instance: one high-water mark, one cache and
 *  one subscription source (Y12). */
export function wireDataPorts(pinia: Pinia, deps: CityViewDeps): void {
  useReviewStore(pinia).setRepositoryFactory(deps.reviewRepositoryFor);
  // Part 6 Y28/Y29: the plugin's ONE evidence repository. App binds the store to the
  // snapshot's codebase; the store listens to that codebase's entry.
  useEvidenceStore(pinia).setRepository(deps.evidenceStore);
}

/** R2: a closing leaf stops listening to the plugin-level repository (Task 2's `detach`),
 *  so later writes from other leaves never reload a dead store. */
export function unwireDataPorts(pinia: Pinia): void {
  useReviewStore(pinia).detach();
  // Part 6 Y29: the shared evidence repository outlives the leaf. The evidence store is a
  // setup store, so `$dispose` runs its `onScopeDispose` and drops its listener.
  useEvidenceStore(pinia).$dispose();
}

/** Part 6 Y39: the `import-analysis-report` command's body. It goes to Data & scans and
 *  raises a request; SourcesScreen opens the S14 dialog from it (Task 10). The file picker
 *  therefore always opens from a real click inside the dialog. */
export function requestReportImport(pinia: Pinia): void {
  useCityStore(pinia).navigate('sources');
  useEvidenceStore(pinia).requestImport();
}
