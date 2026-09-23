// Part 6 R2: the plugin-level data ports every CityViewDeps literal in the tests spreads in
// (`...dataPortDeps()`), so a new port (Task 7's evidence store) changes this one file.
// One in-memory review repository per codebase, shared by every leaf built from the same
// deps object — the registry's own contract, without a data.json.
import type { CityViewDeps } from '../../src/host/city-view';
import { createInMemoryReviewRepository, type ReviewRepository } from '../../src/ui/stores/ports/review-repository';

export function dataPortDeps(): Pick<CityViewDeps, 'reviewRepositoryFor'> {
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
  };
}
