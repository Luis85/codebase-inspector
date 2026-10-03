// Part 6 E29 (Task 4 fix round 1): Settings › Clear and Settings › Import each replace the
// bound codebase's whole saved review state. Both are blocked (aria-disabled plus a guarded
// handler, E40) while no codebase is on screen, and while that codebase's saved state is
// unread — before its first load finishes, or after the load failed — because the lists
// are then empty only for want of a read, and a replace would wipe what was never shown.
import { computed, type ComputedRef } from 'vue';
import { useCityStore } from '../../stores/city-store';
import { useReviewStore } from '../../stores/review-store';

export interface ReviewWriteGate {
  /** No codebase on screen: the row shows its own hint. */
  noCodebase: ComputedRef<boolean>;
  blocked: ComputedRef<boolean>;
  /** The element that says why: the row's own hint without a codebase, the storage line
   *  (REVIEW_STORE_READ_FAILED) after a failed read, nothing while the read is running. */
  describedBy: ComputedRef<string | undefined>;
}

/** Call from <script setup> only. `storageNoteId` is PrivacyRows' storage line, which shows
 *  REVIEW_STORE_READ_FAILED whenever `loadFailed` is set. */
export function useReviewWriteGate(hintId: string, storageNoteId: string): ReviewWriteGate {
  const city = useCityStore();
  const review = useReviewStore();
  const noCodebase = computed((): boolean => !city.snapshot);
  const blocked = computed((): boolean => noCodebase.value || !review.ready || review.loadFailed);
  const describedBy = computed((): string | undefined => {
    if (noCodebase.value) return hintId;
    return review.loadFailed ? storageNoteId : undefined;
  });
  return { noCodebase, blocked, describedBy };
}
