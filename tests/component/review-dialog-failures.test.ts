// Polish 5b fix round 1 (L3: every review-writing screen maps a ReviewStoreError code): the two
// Settings dialogs that write through review.replaceAll (via useBusyAction.run) name a refused
// write's reason; any other failure keeps each dialog's own generic text.
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import '../mocks/obsidian';
import ImportReviewDialog from '../../src/ui/screens/settings/ImportReviewDialog.vue';
import ClearReviewDialog from '../../src/ui/screens/settings/ClearReviewDialog.vue';
import type { ImportCandidate } from '../../src/ui/screens/settings/import-candidate';
import { computeLayout } from '../../src/domain/layout/layout';
import { useCityStore } from '../../src/ui/stores/city-store';
import { useReviewStore } from '../../src/ui/stores/review-store';
import { ReviewStoreError, createInMemoryReviewRepository } from '../../src/ui/stores/ports/review-repository';
import {
  IMPORT_FAILED, REVIEW_STORE_FULL, REVIEW_STORE_RETIRED, REVIEW_STORE_UNSUPPORTED, SETTINGS_CLEAR_FAILED,
} from '../../src/ui/inspector-copy';
import { buildSnapshotFixture } from '../fixtures/snapshot-builder';

const CANDIDATE: ImportCandidate = {
  repositoryId: 'repo-a',
  state: {
    workItems: [], rules: [], dispositions: [],
    report: { sections: { summary: true, architecture: true, hotspots: true, security: true, plan: true }, note: '' },
    origin: null,
  },
};

/** Codebase `repo-a` on screen and bound, its replaceAll rejecting with `error`. */
async function boundRejecting(error: Error): Promise<void> {
  const snap = buildSnapshotFixture({ files: 3, directories: 1, repositoryId: 'repo-a' });
  useCityStore().setCity(snap, computeLayout(snap));
  const review = useReviewStore();
  await review.bindRepository('repo-a');
  const repo = createInMemoryReviewRepository();
  review.setRepository({ ...repo, replaceAll: () => Promise.reject(error) });
}

async function importError(error: Error): Promise<string> {
  await boundRejecting(error);
  const w = mount(ImportReviewDialog, { attachTo: document.body, props: { candidate: CANDIDATE } });
  await w.find('.ci-import-dialog__confirm').trigger('click');
  await flushPromises();
  const text = w.find('.ci-import-dialog__error').text();
  w.unmount();
  return text;
}

async function clearError(error: Error): Promise<string> {
  await boundRejecting(error);
  const w = mount(ClearReviewDialog, { attachTo: document.body });
  await w.find('.ci-clear-dialog__confirm').trigger('click');
  await flushPromises();
  const text = w.find('.ci-clear-dialog__error').text();
  w.unmount();
  return text;
}

describe('Settings review dialogs name a refused write (Polish 5b fix round 1, L3)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });

  it('an import refused as full shows the 1 MB limit; any other failure keeps IMPORT_FAILED', async () => {
    expect(await importError(new ReviewStoreError('full'))).toBe(REVIEW_STORE_FULL);
    setActivePinia(createPinia());
    expect(await importError(Object.assign(new Error('x'), { code: 'full' }))).toBe(IMPORT_FAILED);
  });

  it('a clear refused as unsupported shows the unsupported text; any other failure keeps SETTINGS_CLEAR_FAILED', async () => {
    expect(await clearError(new ReviewStoreError('unsupported'))).toBe(REVIEW_STORE_UNSUPPORTED);
    setActivePinia(createPinia());
    expect(await clearError(new Error('disk'))).toBe(SETTINGS_CLEAR_FAILED);
  });

  it('a write to a removed codebase says it was removed, not that its format is unsupported', async () => {
    expect(await clearError(new ReviewStoreError('retired'))).toBe(REVIEW_STORE_RETIRED);
  });
});
