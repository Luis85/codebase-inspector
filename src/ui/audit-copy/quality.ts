// Part 3 §2: Code quality screen and the Finding review dialog.
// Part 6 Y35/Y36: findings are an imported fallow report's: the tool's own rule, a title
// per finding, and the review dialog's provider and rule rows.
import type { FindingCategory, FindingDetail, FindingRule } from '../../application/evidence/model';
import type { FindingSeverity } from '../read-models/severity';
export const QUALITY_EYEBROW = 'Audit / Code quality';
export const QUALITY_TITLE = 'From findings to decisions.';
export const QUALITY_SUBTITLE = 'Triage static-analysis evidence without losing its source, scope, or uncertainty.';
export const QUALITY_EXPORT = 'Export findings';
export const QUALITY_CSV_FILENAME = 'codebase-quality-findings.csv';
export const QUALITY_CARD_OPEN = 'Open findings';
export const QUALITY_CARD_OPEN_CAPTION = (total: number, decided: number): string => `${total} findings in this snapshot · ${decided} decided`;
/** Part 6 E37: stale evidence (Y30) was imported against another snapshot, so it never says "in this snapshot". */
export const QUALITY_CARD_OPEN_CAPTION_STALE = (total: number, decided: number): string => `${total} findings in the attached evidence · ${decided} decided`;
export const QUALITY_CARD_COMPLEXITY = 'Complexity findings';
export const QUALITY_CARD_COMPLEXITY_CAPTION = 'Functions the report lists above its complexity thresholds';
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
/** Moved from inspector-copy.ts in Part 6 (R6), unchanged: the per-category fallback title. */
export const FINDING_TITLE: Readonly<Record<'complexity' | 'duplication' | 'unused-exports', string>> = {
  complexity: 'Complex function needs review',
  duplication: 'Repeated implementation detected',
  'unused-exports': 'Potentially unused export',
};
export const FINDING_STATUS_LABEL: Readonly<Record<'open' | 'acknowledged' | 'dismissed', string>> = {
  open: 'Open', acknowledged: 'Acknowledged', dismissed: 'Dismissed',
};
// Part 6 Y35 (R6): the tool's own severity. A finding the tool does not rate reads "Not rated".
const FINDING_SEVERITY_UNRATED = 'Not rated';
export const SEVERITY_LABEL: Readonly<Record<FindingSeverity, string>> = {
  critical: 'Critical', high: 'High', moderate: 'Moderate', unrated: FINDING_SEVERITY_UNRATED,
};
const SEVERITY_LABELS = new Map<string, string>(Object.entries(SEVERITY_LABEL));
/** A word a later fallow adds is shown verbatim, as text. A Map, so no report word reaches an Object.prototype member. */
export const SEVERITY_TEXT = (severity: string): string => SEVERITY_LABELS.get(severity) ?? severity;
export const QUALITY_RESET = 'Reset';
export const QUALITY_TABLE_TITLE = 'Findings';
export const QUALITY_TABLE_CAPTION = 'Reported findings, one row per finding';
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
/** Part 6 E14: a report is attached, but no finding of it resolved to a file on screen. */
export const QUALITY_NO_FINDINGS_REPORTED = 'No findings reported for this codebase. That is not the same as zero complexity.';
export const QUALITY_FOOTNOTE = 'Findings come from fallow, imported as a report or collected by a run you started, and are kept for this session only. Decisions are saved with this codebase’s review state in the plugin’s own data; the repository is never changed.';
export const FINDING_DIALOG_TITLE = 'Review finding';
export const FINDING_DIALOG_PROVIDER = 'Provider';
export const FINDING_DIALOG_PROVIDER_VALUE = (version: string, date: string, origin: 'imported' | 'collected' = 'imported'): string =>
  `fallow ${version} · ${origin === 'collected' ? 'collected run' : 'imported report'}, ${date}`;
export const FINDING_DIALOG_LOCATION = 'Location';
export const FINDING_DIALOG_REASON = 'Disposition note';
export const FINDING_OPEN_FILE = 'Open file detail';
export const FINDING_ADD_WORK_ITEM = 'Add work item';
export const FINDING_IN_PLAN = 'In refactor plan';
export const FINDING_ACKNOWLEDGE = 'Acknowledge';
export const FINDING_REOPEN = 'Reopen';
export const FINDING_DISMISS = 'Dismiss…';
export const FINDING_DISMISS_TITLE = 'Record a dismissal';
export const FINDING_DISMISS_HINT = 'Capture the reason. It is saved with this codebase’s review state in the plugin’s own data; the repository is never changed.';
export const FINDING_DISMISS_REASON = 'Reason';
export const FINDING_DISMISS_PLACEHOLDER = 'For example: intentionally exported through an external API; reference confirmed.';
export const FINDING_DISMISS_REQUIRED = 'Enter a reason before dismissing the finding.';
export const FINDING_DISMISS_TOO_LONG = (max: number): string => `Keep the reason to ${max} characters or fewer.`;
export const FINDING_DISMISS_SAVE = 'Record dismissal';
export const FINDING_DISMISS_CANCEL = 'Cancel';
export const FINDING_DECISION_FAILED = 'Could not save this decision.';
/** Polish C-5a-M2: the dialog's decisions wait for the bound codebase's saved review state. */
export const FINDING_REVIEW_LOADING = 'Loading this codebase’s saved review state… Decisions can be recorded once it is read.';
export const FINDING_ACKNOWLEDGED = 'Finding acknowledged. No repository suppression was written.';
export const FINDING_REOPENED = 'Finding reopened for review.';
export const FINDING_DISMISSED = 'Dismissal and reason saved.';

/* Part 6 Y35/Y36: the tool's rule and a title per finding. */
const FINDING_RULE_LABEL: Readonly<Record<FindingRule, string>> = {
  complexity: 'Complexity', duplication: 'Duplication', 'unused-export': 'Unused export', 'unused-type': 'Unused type',
};
const RULE_LABELS = new Map<string, string>(Object.entries(FINDING_RULE_LABEL));
/** Like SEVERITY_TEXT: a rule this version does not know reads verbatim, and a Map means no
 *  word reaches an Object.prototype member. */
export const RULE_TEXT = (rule: string): string => RULE_LABELS.get(rule) ?? rule;
/** Y35: one title per finding, "<symbol> · <what the tool reported>". A complexity finding
 *  whose `exceeded` word starts with "cyclomatic" shows the cyclomatic measure; any other
 *  word shows the cognitive measure. A rule this version does not know falls back to the
 *  category title. */
export const FINDING_TITLE_FOR = (kind: FindingCategory, rule: string, symbol: string | null, detail: FindingDetail): string => {
  let what: string;
  switch (detail.kind) {
    case 'complexity':
      what = detail.exceeded.startsWith('cyclomatic')
        ? `Cyclomatic complexity ${detail.cyclomatic} (threshold ${detail.cyclomaticThreshold})`
        : `Cognitive complexity ${detail.cognitive} (threshold ${detail.cognitiveThreshold})`;
      break;
    case 'duplication':
      what = `Duplicated block · ${detail.lineCount} lines`;
      break;
    default:
      what = RULE_LABELS.get(rule) ?? FINDING_TITLE[kind];
  }
  return symbol === null ? what : `${symbol} · ${what}`;
};
/** Y36: File detail's line under each finding: the line or the range, then the rule. */
export const FINDING_META = (line: number | null, endLine: number | null, rule: string): string => {
  const where = line === null ? 'Line unknown' : endLine !== null && endLine !== line ? `Lines ${line}–${endLine}` : `Line ${line}`;
  return `${where} · ${RULE_TEXT(rule)}`;
};
export const FILE_NO_FINDINGS_REPORTED = 'No findings reported for this file. That is not the same as zero complexity.';
/** Y35: the rule and its thresholds replace the old confidence row. Unused exports carry
 *  COPY-20's caution. */
export const FINDING_DIALOG_RULE = 'Rule';
export const FINDING_DIALOG_RULE_VALUE = (rule: string, detail: FindingDetail): string => {
  const label = RULE_TEXT(rule);
  switch (detail.kind) {
    case 'complexity':
      return `${label}: cognitive ${detail.cognitive} (threshold ${detail.cognitiveThreshold}), cyclomatic ${detail.cyclomatic} (threshold ${detail.cyclomaticThreshold}). Reported above threshold.`;
    case 'duplication': {
      const others = detail.partnerFiles === 0
        ? 'repeated within this file'
        : `also in ${detail.partnerFiles} other ${detail.partnerFiles === 1 ? 'file' : 'files'}`;
      return `${label}: ${detail.lineCount} lines, ${detail.tokenCount} tokens, ${others}.`;
    }
    default:
      return `${label}${detail.typeOnly && rule !== 'unused-type' ? ' (type only)' : ''}. No static consumers reported in this analysis scope. Verify dynamic or framework usage before removal.`;
  }
};
