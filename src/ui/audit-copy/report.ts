// Part 4: the Audit report. Re-exported by inspector-copy.ts.
export const REPORT_EYEBROW = 'Act / Audit report';
export const REPORT_TITLE = 'An audit you can explain.';
export const REPORT_SUBTITLE = 'A review-ready narrative with scope, evidence, limitations, and next actions.';
export const REPORT_EXPORT = 'Export Markdown';
export const REPORT_MD_FILENAME = 'codebase-audit-report.md';
export const REPORT_KICKER = 'Codebase Inspector';
export const REPORT_PAPER_TITLE = 'Codebase quality & architecture review';
export const REPORT_SAMPLE_BADGE = 'Includes sample data';
export const REPORT_MD_DISCLAIMER = 'Includes sample data. This is not an audit of your repository.';
export const REPORT_FACT_SOURCE = 'Source';
export const REPORT_FACT_SNAPSHOT = 'Snapshot';
export const REPORT_FACT_EXCLUSIONS = 'Scope exclusions';
export const REPORT_FACT_EVIDENCE = 'Evidence';
export const REPORT_FACT_SAFETY = 'Source safety';
export const REPORT_NO_EXCLUSIONS = 'None';
// WP-03 final review #4: import relations (the imports fallow reports in cycles and boundary
// violations) are fallow evidence now, never sample data.
export const REPORT_EVIDENCE_TEXT = 'File inventory collected by the built-in read-only scan. Static findings and import relations (the imports fallow reports in cycles and boundary violations) come from fallow evidence (an imported report or a run you started) when one is attached for this session, and read Not analysed otherwise. History, coverage and packages are sample data. Mutation, runtime and secret scanning were not collected.';
export const REPORT_SAFETY_TEXT = 'Read-only inventory within the approved scope. No source file was changed and no tool was run.';
export const REPORT_SECTION_LABEL: Readonly<Record<'summary' | 'architecture' | 'hotspots' | 'security' | 'plan', string>> = {
  summary: 'Executive summary', architecture: 'Architecture review', hotspots: 'Quality hotspots',
  security: 'Security review', plan: 'Refactor plan',
};
export const REPORT_SECTION_HEADING = (n: number, title: string): string => `${String(n).padStart(2, '0')} / ${title}`;
export const REPORT_FILES = 'Files';
export const REPORT_LINES = 'Source lines';
export const REPORT_SUMMARY_NOTE = 'These independent signals are not a composite quality score.';
export const REPORT_RULES_TITLE = 'Boundary rules';
export const REPORT_NO_RULES = 'No boundary rules defined.';
export const REPORT_RULE_BOUNDARY = (from: string, to: string): string => `${from} must not import ${to}`;
/** WP-03 N23 (final review #4): a rule's status reads as the rule table's does — the status,
 *  with its reason when it has one — never "(sample edges)". */
export const REPORT_RULE_STATUS = (status: string, reason: string | null): string => (reason === null ? status : `${status} (${reason})`);
export const REPORT_COL_RULE = 'Rule';
export const REPORT_COL_BOUNDARY = 'Intended boundary';
export const REPORT_COL_STATUS = 'Status';
export const REPORT_COL_RATIONALE = 'Rationale';
export const REPORT_COL_FILE = 'File';
export const REPORT_COL_PRIORITY = 'Priority';
export const REPORT_COL_COMPLEXITY = 'Max complexity';
export const REPORT_COL_COMMITS = 'Commits / 90d';
export const REPORT_COL_COVERAGE = 'Branch coverage';
export const REPORT_HOTSPOTS_NOTE = 'Priority is an investigation heuristic built from sample signals, not a defect probability.';
export const REPORT_SECURITY_NOTE = 'Advisories are fictional demo records. Reachability, runtime exposure and secrets were not assessed; no exploitability verdict is given.';
export const REPORT_NO_PLAN = 'No work items.';
export const REPORT_PLAN_LINE = (id: string, title: string, status: string, priority: string, target: string): string =>
  `${id}: ${title} — ${status}; ${priority} priority; ${target}`;
export const REPORT_NOTE_TITLE = 'Reviewer note';
export const REPORT_NO_NOTE = 'No reviewer note.';
export const REPORT_LIMITS_TITLE = 'Scope and limitations';
export const REPORT_LIMITS = 'The file inventory is measured by the scan. Static findings and import relations come from fallow when a report is attached, and import relations are only the imports fallow reports in cycles and boundary violations, not the full import graph. History, coverage and packages are sample data; anything else is unknown. No source content was interpreted, no runtime traffic, credentials or real package advisories were analysed. Import graphs do not prove architectural intent. Coverage does not prove correctness. Missing evidence is unknown, not passing.';
export const REPORT_CONTENTS_TITLE = 'Report contents';
export const REPORT_CONTENTS_SUBTITLE = 'Choose what to include.';
export const REPORT_NOTE_PANEL_TITLE = 'Reviewer note';
export const REPORT_NOTE_PANEL_SUBTITLE = 'Kept in this session only.';
export const REPORT_NOTE_LABEL = 'Reviewer note';
export const REPORT_NOTE_APPLY = 'Apply note';
export const REPORT_NOTE_APPLIED = 'Reviewer note applied to the report.';
export const REPORT_NOTE_TOO_LONG = (n: number): string => `Keep the note to ${n} characters or fewer.`;
export const REPORT_CALLOUT_TITLE = 'Illustrative review';
// Controller ruling X18: use this exact copy (differs from the plan's own draft text).
export const REPORT_CALLOUT = 'This is an illustrative review built partly from sample data. It is not a security certification or an audit of your repository.';
