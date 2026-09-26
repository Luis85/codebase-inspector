// Part 6 R2: the plugin-level data ports every CityViewDeps literal in the tests spreads in
// (`...dataPortDeps()`), so a new port (Task 7's evidence store) changes this one file.
// One in-memory review repository per codebase, shared by every leaf built from the same
// deps object — the registry's own contract, without a data.json.
import type { CityViewDeps } from '../../src/host/city-view';
import { createInMemoryReviewRepository, type ReviewRepository } from '../../src/ui/stores/ports/review-repository';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { createFakeFallowAnalysis } from './fake-fallow-analysis';
import { inertInvestigationNotes, scriptedSourcePreview } from './fake-investigation';

export function dataPortDeps(): Pick<CityViewDeps, 'reviewRepositoryFor' | 'evidenceStore' | 'fallowAnalysis' | 'investigationNotes' | 'sourcePreview'> {
  const repositories = new Map<string, ReviewRepository>();
  return {
    reviewRepositoryFor: (repositoryId) => {
      let repository = repositories.get(repositoryId);
      if (!repository) {
        repository = createInMemoryReviewRepository();
        repositories.set(repositoryId, repository);
      }
      return repository;
    },
    // Part 6 Y28 (Task 7): one session evidence repository per deps object, as main.ts builds one.
    evidenceStore: new InMemoryEvidenceStore(),
    // Part 7 Z28 (Task 9): the fallow analysis service, scripted; it runs nothing.
    fallowAnalysis: createFakeFallowAnalysis(),
    // WP-04 Task 10: the notes port lists and writes nothing; the preview reads nothing on its own.
    investigationNotes: inertInvestigationNotes(),
    sourcePreview: scriptedSourcePreview(),
  };
}
