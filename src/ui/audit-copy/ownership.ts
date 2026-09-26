// Part 3 §2: Ownership screen. Module and team level only (Q11).
export const OWNERSHIP_EYEBROW = 'Audit / Ownership';
export const OWNERSHIP_TITLE = 'Make knowledge resilient.';
export const OWNERSHIP_SUBTITLE = 'Review module stewardship and concentrated knowledge, not developer productivity.';
export const OWNERSHIP_EXPORT = 'Export ownership map';
export const OWNERSHIP_CSV_FILENAME = 'sample-module-stewardship.csv';
export const OWNERSHIP_CALLOUT_TITLE = 'Team-level continuity signals only.';
export const OWNERSHIP_CALLOUT = 'Contribution history is an imperfect proxy for familiarity. No individual ranking or performance score is shown.';
export const SAMPLE_TEAM_LABELS: readonly string[] = ['Experience', 'Platform', 'Core systems'];
export const OWNERSHIP_BARS_TITLE = 'Knowledge distribution by module';
export const OWNERSHIP_BARS_SUBTITLE = 'Sample share of changes attributed to the largest contributing group.';
export const OWNERSHIP_BARS_FOOTNOTE = 'High concentration is a prompt for a conversation, not proof of missing knowledge.';
export const OWNERSHIP_BAR_LABEL = (module: string, pct: string): string => `${module}: ${pct} concentration (sample)`;
// E14: MeterList's own `label` prop, read out once for the whole list.
export const OWNERSHIP_BARS_LABEL = 'Sample knowledge concentration by module';
export const OWNERSHIP_ACTIONS_TITLE = 'Stewardship actions';
export const OWNERSHIP_ACTIONS_SUBTITLE = 'Turn concentrated knowledge into shared understanding.';
export const OWNERSHIP_ACTION_TITLE: Readonly<Record<'pairing' | 'tests' | 'documentation', (m: string) => string>> = {
  pairing: (m) => `Pair-review the ${m} module`,
  tests: (m) => `Make ${m} behaviour executable`,
  documentation: (m) => `Document ${m} decisions`,
};
export const OWNERSHIP_ACTION_BODY: Readonly<Record<'pairing' | 'tests' | 'documentation', string>> = {
  pairing: 'Walk through invariants and boundary decisions with a second reviewer.',
  tests: 'Capture current behaviour in characterization tests before it changes.',
  documentation: 'Write down the decisions and procedures that live in a few heads.',
};
// E50/E44: the button's visible text before it is added — its accessible name (the
// aria-label below) starts with this same text, the state comes after.
export const OWNERSHIP_ACTION_ADD_SHORT = 'Add work item';
export const OWNERSHIP_ACTION_ADD = (title: string): string => `Add work item: ${title}`;
export const OWNERSHIP_ACTION_ADDED = 'In refactor plan';
export const OWNERSHIP_ACTION_ADDED_LABEL = (title: string): string => `In refactor plan: ${title}`;
// E17: announced only on a real (non-null) addWorkItem result; a refusal announces nothing.
export const OWNERSHIP_ACTION_DONE = 'Work item added.';
export const OWNERSHIP_ACTION_FAILED = 'Could not add this work item.';
export const OWNERSHIP_TABLE_TITLE = 'Module stewardship';
export const OWNERSHIP_TABLE_SUBTITLE = 'Stewarding teams are sample labels and need human confirmation.';
export const OWNERSHIP_TABLE_CAPTION = 'Module stewardship';
export const OWNERSHIP_COL_MODULE = 'Module';
export const OWNERSHIP_COL_TEAM = 'Stewarding team';
export const OWNERSHIP_COL_FILES = 'Files';
export const OWNERSHIP_COL_CONCENTRATION = 'Concentration';
export const OWNERSHIP_COL_CANDIDATES = 'Review candidates';
export const OWNERSHIP_COL_ACTIONS = 'Actions';
export const OWNERSHIP_SHOW_IN_CITY = 'Show in city';
// E52 (WCAG 2.5.3, controller ruling): the accessible name must START WITH the button's
// own visible text ("Show in city"), so it is a prefix here, not a rephrasing.
export const OWNERSHIP_SHOW_IN_CITY_LABEL = (m: string): string => `Show in city: ${m}`;
export const OWNERSHIP_HIDDEN = (n: number): string => `${n} smaller modules are not shown.`;
