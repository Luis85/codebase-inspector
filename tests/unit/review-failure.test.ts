// Polish E1 (L3, U27 amended): a refused review write names its reason; nothing else does.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reviewFailureText } from '../../src/ui/read-models/review-failure';
import { ReviewStoreError } from '../../src/ui/stores/ports/review-repository';
import { REVIEW_SAVE_UNREPRESENTABLE, REVIEW_STORE_FULL, REVIEW_STORE_UNSUPPORTED } from '../../src/ui/inspector-copy';

const REVIEW_WRITERS: readonly string[] = [
  'src/ui/components/FileInspector.vue', 'src/ui/screens/architecture/RuleEditor.vue', 'src/ui/screens/ArchitectureScreen.vue',
  'src/ui/screens/dependencies/PackageDetailDialog.vue', 'src/ui/screens/FileDetailScreen.vue', 'src/ui/screens/OwnershipScreen.vue',
  'src/ui/screens/quality/FindingReviewDialog.vue', 'src/ui/screens/TestsScreen.vue', 'src/ui/screens/workbench/WorkItemEditor.vue',
];

describe('reviewFailureText (Polish E1)', () => {
  it('names each refusal in words', () => {
    expect(reviewFailureText(new ReviewStoreError('full'), 'generic')).toBe(REVIEW_STORE_FULL);
    expect(reviewFailureText(new ReviewStoreError('unsupported'), 'generic')).toBe(REVIEW_STORE_UNSUPPORTED);
    expect(reviewFailureText(new ReviewStoreError('unrepresentable'), 'generic')).toBe(REVIEW_SAVE_UNREPRESENTABLE);
  });

  it('Review Focus 2: any other failure keeps the screen\'s own text', () => {
    expect(reviewFailureText(new Error('disk'), 'generic')).toBe('generic');
    expect(reviewFailureText(Object.assign(new Error('x'), { code: 'full' }), 'generic')).toBe('generic');
    expect(reviewFailureText('full', 'generic')).toBe('generic');
  });

  it('every review-writing screen maps its failure', () => {
    expect(REVIEW_WRITERS.length).toBeGreaterThan(0);
    for (const file of REVIEW_WRITERS) expect(readFileSync(file, 'utf8'), file).toContain('reviewFailureText(');
  });

  it('WorkItemEditor maps both its save and its delete', () => {
    expect(readFileSync('src/ui/screens/workbench/WorkItemEditor.vue', 'utf8').split('reviewFailureText(').length - 1).toBe(2);
  });
});
