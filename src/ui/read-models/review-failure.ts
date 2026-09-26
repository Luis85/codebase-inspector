// Polish E1 (amends U27, Part 6 spec §4 "screens keep generic"; L3): a review write the store
// refused names its reason; every other failure keeps the screen's own generic text.
import { ReviewStoreError, type ReviewStoreErrorCode } from '../stores/ports/review-repository';
import { REVIEW_SAVE_UNREPRESENTABLE, REVIEW_STORE_FULL, REVIEW_STORE_RETIRED, REVIEW_STORE_UNSUPPORTED } from '../inspector-copy';

const TEXT: Readonly<Record<ReviewStoreErrorCode, string>> = {
  full: REVIEW_STORE_FULL, unsupported: REVIEW_STORE_UNSUPPORTED, unrepresentable: REVIEW_SAVE_UNREPRESENTABLE,
  retired: REVIEW_STORE_RETIRED,
};

/** Review Focus 2: keyed on `instanceof` only — an Error that merely carries a `code`, or a
 *  message, is a real failure and keeps `fallback`. */
export function reviewFailureText(e: unknown, fallback: string): string {
  return e instanceof ReviewStoreError ? TEXT[e.code] : fallback;
}
