// Part 3 §2: Code quality screen and the Finding review dialog.
export const QUALITY_EYEBROW = 'Audit / Code quality';
export const QUALITY_TITLE = 'From findings to decisions.';
export const QUALITY_SUBTITLE = 'Triage static-analysis evidence without losing its source, scope, or uncertainty.';
export const QUALITY_EXPORT = 'Export findings';
export const QUALITY_CSV_FILENAME = 'codebase-quality-findings.csv';
export const QUALITY_CARD_OPEN = 'Open findings';
export const QUALITY_CARD_OPEN_CAPTION = (total: number, decided: number): string => `${total} findings in this snapshot · ${decided} decided`;
export const QUALITY_CARD_COMPLEXITY = 'Complexity findings';
export const QUALITY_CARD_COMPLEXITY_CAPTION = 'Functions with cognitive complexity of 30 or more';
export const QUALITY_CARD_UNUSED = 'Unused-export findings';
export const QUALITY_CARD_UNUSED_CAPTION = 'Verify entry points before removal';
export const QUALITY_CARD_DUPLICATION = 'Duplication findings';
export const QUALITY_CARD_DUPLICATION_CAPTION = 'Review semantics before extraction';
export const QUALITY_FILTER_QUERY = 'Find a file or finding…';
export const QUALITY_FILTER_KIND = 'Type';
export const QUALITY_FILTER_SEVERITY = 'Severity';
export const QUALITY_FILTER_MODULE = 'Module';
export const QUALITY_FILTER_STATUS = 'Status';
export const QUALITY_ALL_KINDS = 'All types';
export const QUALITY_ALL_SEVERITIES = 'All severities';
export const QUALITY_ALL_MODULES = 'All modules';
export const QUALITY_ALL_STATUSES = 'All statuses';
export const FINDING_KIND_LABEL: Readonly<Record<'complexity' | 'duplication' | 'unused-exports', string>> = {
  complexity: 'Complexity', duplication: 'Duplication', 'unused-exports': 'Unused exports',
};
export const FINDING_STATUS_LABEL: Readonly<Record<'open' | 'acknowledged' | 'dismissed', string>> = {
  open: 'Open', acknowledged: 'Acknowledged', dismissed: 'Dismissed',
};
export const QUALITY_RESET = 'Reset';
export const QUALITY_TABLE_TITLE = 'Findings';
export const QUALITY_TABLE_CAPTION = 'Static findings, one row per finding';
export const QUALITY_COL_SEVERITY = 'Severity';
export const QUALITY_COL_FINDING = 'Finding';
export const QUALITY_COL_LOCATION = 'Location';
export const QUALITY_COL_EVIDENCE = 'Evidence';
export const QUALITY_COL_STATUS = 'Status';
// Part 5 V19: the row's own button (the row is no longer a control); the name starts with the visible text.
export const QUALITY_COL_REVIEW = 'Review';
export const QUALITY_REVIEW = 'Review';
export const QUALITY_REVIEW_LABEL = (title: string, file: string): string => `Review ${title} in ${file}`;
export const QUALITY_LOCATION = (line: number | null, module: string): string => `${line === null ? 'Line unknown' : `Line ${line}`} · ${module}`;
export const QUALITY_SHOWING = (shown: number, total: number): string => `Showing ${shown} of ${total} matching findings`;
export const QUALITY_NO_MATCH_TITLE = 'No findings match these filters';
export const QUALITY_NO_MATCH = 'Try another type, severity, module or status.';
export const QUALITY_FOOTNOTE = 'Findings are sample data. Decisions are kept in this session only and never written to the repository.';   // E21: use spec wording
export const FINDING_DIALOG_TITLE = 'Review finding';
export const FINDING_DIALOG_PROVIDER = 'Provider';
export const FINDING_DIALOG_PROVIDER_VALUE = 'Sample findings';
export const FINDING_DIALOG_CONFIDENCE = 'Confidence';
export const FINDING_DIALOG_CONFIDENCE_VALUE = 'Illustrative, manual confirmation required';   // E21: use spec wording
export const FINDING_DIALOG_LOCATION = 'Location';
export const FINDING_DIALOG_REASON = 'Disposition note';
export const FINDING_OPEN_FILE = 'Open file detail';
export const FINDING_ADD_WORK_ITEM = 'Add work item';
export const FINDING_IN_PLAN = 'In refactor plan';
export const FINDING_ACKNOWLEDGE = 'Acknowledge';
export const FINDING_REOPEN = 'Reopen';
export const FINDING_DISMISS = 'Dismiss…';
export const FINDING_DISMISS_TITLE = 'Record a dismissal';
export const FINDING_DISMISS_HINT = 'Capture the reason. This only updates the review state for this session.';
export const FINDING_DISMISS_REASON = 'Reason';
export const FINDING_DISMISS_PLACEHOLDER = 'For example: intentionally exported through an external API; reference confirmed.';
export const FINDING_DISMISS_REQUIRED = 'Enter a reason before dismissing the finding.';
export const FINDING_DISMISS_TOO_LONG = (max: number): string => `Keep the reason to ${max} characters or fewer.`;
export const FINDING_DISMISS_SAVE = 'Record dismissal';
export const FINDING_DISMISS_CANCEL = 'Cancel';
export const FINDING_DECISION_FAILED = 'Could not save this decision.';
export const FINDING_ACKNOWLEDGED = 'Finding acknowledged. No repository suppression was written.';
export const FINDING_REOPENED = 'Finding reopened for review.';
export const FINDING_DISMISSED = 'Dismissal and reason saved for this session.';
