// Part 5 E19: a parsed import paired with the repositoryId it was parsed against, so a
// codebase switch between pick and confirm (or while the file is still being read) can be
// detected instead of writing one codebase's ids into another's bucket (Part 4 E8/E11).
import type { ImportedReviewState } from '../../read-models/review-state-import';

export interface ImportCandidate {
  state: ImportedReviewState;
  repositoryId: string;
}
