// Part 6 Y11/Y17: one durable review repository per codebase for the whole plugin. main.ts
// builds one registry. Every CityView reaches it through CityViewDeps.reviewRepositoryFor,
// so two leaves on one codebase share one instance (one high-water mark, one subscription
// source), and the settings tab purges a removed profile's review state through it.
import type { Plugin } from 'obsidian';
import { createInMemoryReviewRepository, type ReviewRepository } from '../../ui/stores/ports/review-repository';
import { createPluginDataReviewRepository, deleteReviewSet, type PluginDataReviewRepository } from './plugin-data-review-repository';

export interface ReviewRepositoryRegistry {
  /** The cached instance for this codebase, built on first use. */
  for(repositoryId: string): ReviewRepository;
  /** Y17: deletes `reviews[repositoryId]` under the data lock and drops the instance. */
  purge(repositoryId: string): Promise<void>;
}

export function createReviewRepositoryRegistry(plugin: Plugin): ReviewRepositoryRegistry {
  const instances = new Map<string, PluginDataReviewRepository>();
  return {
    for(repositoryId) {
      // Y14: the unbound '' bucket is never persisted. The review store keeps its own
      // in-memory one; this answer only makes a stray call harmless.
      if (repositoryId === '') return createInMemoryReviewRepository();
      let instance = instances.get(repositoryId);
      if (!instance) {
        instance = createPluginDataReviewRepository(plugin, repositoryId);
        instances.set(repositoryId, instance);
      }
      return instance;
    },
    async purge(repositoryId) {
      const instance = instances.get(repositoryId);
      instances.delete(repositoryId);
      // The delete is queued on the data lock first, then the old instance is retired: a
      // write it had already queued lands before the delete, one it starts now is refused,
      // and the reload its subscribers start reads after the delete.
      const deleted = deleteReviewSet(plugin, repositoryId);
      instance?.retire();
      await deleted;
    },
  };
}
