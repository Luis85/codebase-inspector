// Part 4: Refactor workbench and the Work-item editor. Re-exported by inspector-copy.ts.
import type { WorkIntent, WorkPriority } from '../stores/ports/review-repository';

export const WORKBENCH_EYEBROW = 'Act / Refactor workbench';
export const WORKBENCH_TITLE = 'Turn evidence into a refactoring plan.';
export const WORKBENCH_SUBTITLE = 'Keep the reason, affected files, and verification criteria together.';
export const WORKBENCH_EXPORT = 'Export plan';
export const WORKBENCH_MD_FILENAME = 'refactor-plan.md';
export const WORKBENCH_NEW = 'New work item';
export const WORKBENCH_NEW_HINT = 'Select a file in the city, a table or the command palette first.';
export const WORKBENCH_NEW_FOR = (name: string): string => `Plans work for the selected file, ${name}.`;
export const WORKBENCH_CARD_TOTAL = 'Work items';
export const WORKBENCH_CARD_TOTAL_CAPTION = 'Kept in this session only';
export const WORKBENCH_CARD_INVESTIGATE = 'Under investigation';
export const WORKBENCH_CARD_INVESTIGATE_CAPTION = 'Define scope and characterize behaviour';
export const WORKBENCH_CARD_PROGRESS = 'In progress';
export const WORKBENCH_CARD_PROGRESS_CAPTION = 'An explicit status, not source-code automation';
export const WORKBENCH_CARD_VERIFIED = 'Verified';
export const WORKBENCH_CARD_VERIFIED_CAPTION = 'All three checks completed';
export const WORKBENCH_FILTER = 'Filter work items…';
export const WORKBENCH_FILTER_LABEL = 'Filter work items';
export const WORKBENCH_VIEW_LABEL = 'Work item layout';
export const WORKBENCH_VIEW_BOARD = 'Board';
export const WORKBENCH_VIEW_LIST = 'List';
export const WORKBENCH_EMPTY_TITLE = 'No work items yet';
export const WORKBENCH_EMPTY = 'Add them from File detail, Code quality, Test confidence, Dependencies, Security or Ownership.';
export const WORKBENCH_NO_MATCH = 'No work items match this filter.';
export const WORKBENCH_FOOTNOTE = 'Statuses record your plan. Nothing here changes source code.';
export const WORKBENCH_COLUMN_COUNT = (n: number): string => `${n} ${n === 1 ? 'work item' : 'work items'}`;
export const WORKBENCH_CHECKS = (done: number): string => `${done}/3 checks`;
export const WORKBENCH_LIST_CAPTION = 'Work items';
export const WORKBENCH_COL_ITEM = 'Work item';
export const WORKBENCH_COL_TARGET = 'Target';
export const WORKBENCH_COL_INTENT = 'Intent';
export const WORKBENCH_COL_STATUS = 'Status';
export const WORKBENCH_COL_PRIORITY = 'Priority';
export const WORKBENCH_COL_CHECKS = 'Checks';
export const WORK_TARGET_PACKAGE = 'Package';
export const WORK_TARGET_MODULE = 'Module';
export const WORK_TARGET_MISSING = 'Not in this snapshot';
export const WORK_PRIORITY_LABEL: Readonly<Record<WorkPriority, string>> = { high: 'High', medium: 'Medium', low: 'Low' };
export const WORK_INTENT_LABEL: Readonly<Record<WorkIntent, string>> = {
  refactor: 'Refactor', tests: 'Tests', review: 'Review', pairing: 'Pairing', documentation: 'Documentation',
};
export const WORK_CHECK_LABELS: readonly [string, string, string] = [
  'Characterize existing behaviour and define a safe boundary',
  'Implement the agreed change and keep compatibility',
  'Run regression tests and review the evidence',
];
export const WORK_EDITOR_TITLE_EDIT = (id: string): string => `${id} / Work item`;
export const WORK_EDITOR_TITLE_NEW = 'New work item';
export const WORK_EDITOR_SUBTITLE = 'Edit the plan and record an explicit verification state.';
export const WORK_FIELD_TITLE = 'Title';
export const WORK_FIELD_PRIORITY = 'Priority';
export const WORK_FIELD_STATUS = 'Status';
export const WORK_FIELD_INTENT = 'Intent';
export const WORK_FIELD_TARGET = 'Target';
export const WORK_FIELD_NOTES = 'Investigation notes';
export const WORK_CHECKLIST_TITLE = 'Verification checklist';
export const WORK_CHECKLIST_HINT = 'Verified needs all three checks. Changing a status never changes source code.';
export const WORK_SAVE = 'Save changes';
export const WORK_CREATE = 'Create work item';
export const WORK_CANCEL = 'Cancel';
export const WORK_DELETE = 'Delete item';
export const WORK_DELETE_CONFIRM_TEXT = 'Delete this work item? It is removed for this session.';
export const WORK_DELETE_CONFIRM = 'Delete work item';
export const WORK_DELETE_KEEP = 'Keep it';
export const WORK_TITLE_REQUIRED = 'Enter a title.';
export const WORK_TITLE_TOO_LONG = (n: number): string => `Keep the title to ${n} characters or fewer.`;
export const WORK_NOTES_TOO_LONG = (n: number): string => `Keep the notes to ${n} characters or fewer.`;
export const WORK_VERIFIED_NEEDS_CHECKS = 'Complete all three checks before marking the item Verified.';
export const WORK_DUPLICATE = 'This file already has a work item with that intent.';
export const WORK_SAVE_FAILED = 'Could not save the work item.';
export const WORK_DELETE_FAILED = 'Could not delete the work item.';
export const WORK_UPDATED = (id: string): string => `${id} updated.`;
export const WORK_CREATED = (id: string): string => `${id} created.`;
export const WORK_DELETED = (id: string): string => `${id} deleted.`;
export const PLAN_MD_TITLE = (source: string): string => `Refactor plan — ${source}`;
export const PLAN_MD_NOTE = 'Kept in this session only. Statuses record the plan; no source code was changed.';
export const PLAN_MD_EMPTY = 'No work items.';
