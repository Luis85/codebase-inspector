// Part 3 §2: Security screen. No exploitability verdict anywhere (Q7).
export const SECURITY_EYEBROW = 'Audit / Security';
export const SECURITY_TITLE = 'Make security evidence actionable.';
export const SECURITY_SUBTITLE = 'Review findings in context. A detected pattern is not a confirmed exploit.';
export const SECURITY_SOURCES = 'Evidence sources';
export const SECURITY_EXPORT = 'Export review';
export const SECURITY_CSV_FILENAME = 'sample-security-review.csv';
export const SECURITY_CARD_ADVISORIES = 'Dependency advisories';
export const SECURITY_CARD_ADVISORIES_CAPTION = 'Fictional advisories · reachability unknown';
export const SECURITY_CARD_SECRETS = 'Secret-pattern candidates';
export const SECRETS_NOT_COLLECTED = 'Not collected · no secret-scanning provider';
export const SECURITY_CARD_LICENSES = 'License questions';
export const SECURITY_CARD_LICENSES_CAPTION = 'Recorded licence is unresolved';
export const SECURITY_CARD_RUNTIME = 'Runtime exploitability';
export const RUNTIME_NOT_ASSESSED = 'Not assessed · no runtime evidence';
export const SECURITY_TABS_LABEL = 'Security views';
export const SECURITY_TAB_ADVISORIES = 'Dependency advisories';
export const SECURITY_TAB_SECRETS = 'Secret scanning';
export const SECURITY_TAB_POLICY = 'Review policy';
export const SECURITY_ADVISORIES_TITLE = 'Advisories requiring review';
export const SECURITY_ADVISORIES_SUBTITLE = 'DEMO identifiers are not CVEs or real vulnerability records.';
export const SECURITY_REVIEW_BADGE = 'Review';
export const SECURITY_ADVISORY_VERSIONS = (installed: string, patched: string): string => `Installed ${installed} · illustrative patched version ${patched}`;
export const SECURITY_ADVISORY_LABEL = (id: string, name: string): string => `${id}, ${name}. Inspect package`;
export const SECURITY_CHECKLIST_TITLE = 'Review before remediation';
export const SECURITY_CHECKLIST_SUBTITLE = 'A consistent audit checklist for every dependency finding. Not saved.';
export const SECURITY_CHECKLIST: readonly string[] = [
  'Confirm package and version match',
  'Validate the affected code path is reachable',
  'Check input and deployment exposure',
  'Verify an upgrade and regression-test plan',
];
export const SECURITY_NO_CONCLUSION = 'No conclusion about your repository can be drawn from these demo findings.';
export const SECRETS_TITLE = 'A candidate is not a confirmed secret';
export const SECRETS_SUBTITLE = 'No secret-scanning provider is connected.';
export const SECRETS_EMPTY_TITLE = 'Secret candidates are unknown.';
export const SECRETS_EMPTY = 'Nothing has scanned this codebase for secret patterns. When a provider runs, candidates will be masked and need validation before they count as findings.';
export const POLICY_TITLE = 'Security review policy';
export const POLICY_SUBTITLE = 'The inspector does not automatically accept, suppress or fix findings.';
export const POLICY_ROWS: readonly { rule: string; value: string }[] = [
  { rule: 'Mask secret values', value: 'Always on' },
  { rule: 'Exploitability requires evidence', value: 'Review required' },
  { rule: 'No automatic remediation', value: 'Read-only' },
];
export const REACHABILITY_UNKNOWN = 'unknown';
export const SECURITY_SOURCES_TITLE = 'Security evidence sources';
export const SECURITY_SOURCE_LABELS = {
  advisories: 'Dependency advisories', secrets: 'Secret scanning', runtime: 'Runtime exploitability',
} as const;
