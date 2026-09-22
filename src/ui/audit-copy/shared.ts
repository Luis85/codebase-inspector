// Part 3: strings shared by the six Audit screens. Re-exported by inspector-copy.ts.
export const SAMPLE_BADGE_DETAIL = 'Sample data';
export const SHOW_MORE = (n: number): string => `Show ${n} more`;
export const RESET_FILTERS = 'Reset filters';
export const EXPORT_FAILED = 'Could not start the download.';
export const EVIDENCE_DIALOG_READ_ONLY = 'For these signals the inspector reads no source content and runs no tools. Sample values come from deterministic fixtures and are labelled everywhere they appear.';
export const EVIDENCE_SOURCE_SAMPLE = 'Sample provider';
export const EVIDENCE_SOURCE_NONE = 'Not collected';
// E47: the first column of every chart's visually hidden table fallback.
export const CHART_DATE_HEADER = 'Date';
// E13: BarChart's SVG <desc>; the full values are in the table fallback.
export const CHART_BARS_DESC = (n: number): string => `Bar chart of ${n} ${n === 1 ? 'interval' : 'intervals'}; the values are listed in the table that follows.`;
// Part 5 V7: the shell's route announcement (App's visually hidden status region), said
// only when focus stayed in the shell (nav column, top bar, palette opener).
export const ROUTE_OPENED = (title: string): string => `${title} screen.`;
