// Part 4: Settings. Re-exported by inspector-copy.ts.
import type { SettingsTab } from '../screens/settings/settings-tabs';
function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
export const SETTINGS_EYEBROW = 'Configure / Settings';
export const SETTINGS_TITLE = 'A workspace that fits your review.';
export const SETTINGS_SUBTITLE = 'Display preferences are real; production policies are stated explicitly.';
export const SETTINGS_EXPORT = 'Export review state';
export const SETTINGS_JSON_FILENAME = 'codebase-inspector-review-state.json';
export const SETTINGS_TABS_LABEL = 'Settings categories';
export const SETTINGS_TAB: Readonly<Record<SettingsTab, string>> = {
  appearance: 'Appearance', analysis: 'Analysis & scope', accessibility: 'Accessibility', privacy: 'Privacy & storage', about: 'About',
};
export const SETTINGS_THEME = 'Theme';
export const SETTINGS_THEME_TEXT = 'The inspector follows Obsidian’s light or dark theme.';
export const SETTINGS_THEME_VALUE = 'Follows Obsidian';
export const SETTINGS_DENSITY = 'Information density';
export const SETTINGS_DENSITY_TEXT = 'Adjust row spacing without hiding evidence or actions. Kept in this session only.';
export const SETTINGS_DENSITY_LABEL: Readonly<Record<'comfortable' | 'compact', string>> = { comfortable: 'Comfortable', compact: 'Compact' };
export const SETTINGS_THRESHOLD = 'Hotspot review threshold';
export const SETTINGS_THRESHOLD_TEXT = (n: number): string => `Files with a sample priority of ${n} or more count as change hotspots. The formula is fixed and inspectable.`;
export const SETTINGS_PRIORITY_HELP = 'How priority works';
export const SETTINGS_ACCESS = 'Source access';
export const SETTINGS_ACCESS_TEXT = 'Read-only by design. No refactoring, deletion, package install or process execution is performed.';
export const SETTINGS_ACCESS_VALUE = 'Read-only';
export const SETTINGS_SCOPE = 'Profiles, exclusions and limits';
export const SETTINGS_SCOPE_TEXT = 'Edited in Obsidian’s settings for Codebase Inspector (Settings › Community plugins). Data & scans shows the values the snapshot on screen was scanned with.';
export const SETTINGS_SCOPE_VIEW = 'View current scope';
export const SETTINGS_MOTION = 'Reduced motion';
export const SETTINGS_MOTION_TEXT = 'Follows your system setting. The city never moves the camera when you select a file.';
export const SETTINGS_INVENTORY = 'Keyboard-accessible file inventory';
export const SETTINGS_INVENTORY_TEXT = 'Inspect every file in a structured list instead of the 3D view.';
export const SETTINGS_INVENTORY_OPEN = 'Open file inventory';
export const SETTINGS_SHORTCUTS = 'Keyboard shortcuts';
export const SETTINGS_SHORTCUT_LIST: readonly { keys: string; action: string }[] = [
  { keys: 'Ctrl/Cmd + K', action: 'Go to a screen or file (inside the inspector)' },
  { keys: 'Escape', action: 'Close a dialog, the command palette or the navigation drawer' },
  { keys: 'Arrow keys', action: 'Move between tabs, chart points and coverage tiles' },
  { keys: 'Enter or Space', action: 'Open the focused table row' },
];
export const SETTINGS_NETWORK = 'No network requests';
export const SETTINGS_NETWORK_TEXT = 'Everything the inspector shows is computed locally. No analytics, remote assets or registries.';
export const SETTINGS_NETWORK_VALUE = 'Local only';
/** Part 6 Y5/R3: review decisions are saved per codebase; imported findings and the report stay per session. */
export const SETTINGS_STORAGE = 'Saved review state';
export const SETTINGS_STORAGE_TEXT = 'Work items, finding decisions and boundary rules are saved for each codebase in this plugin’s own data for this vault, so they survive restarts. Imported findings and the report screen’s sections and note are kept for this session only. No note in your vault is created or changed.';
export const SETTINGS_CLEAR = 'Clear review state';
export const SETTINGS_CLEAR_TEXT = 'Remove every work item, finding decision and boundary rule saved for this codebase, and this session’s report note. No repository content is affected.';
/** Part 6 R3: Clear is aria-disabled while no codebase is on screen (the Import hint's pattern). */
export const SETTINGS_CLEAR_HINT = 'Open a codebase first: review state is saved for each codebase.';
export const SETTINGS_CLEAR_OPEN = 'Clear review state…';
export const SETTINGS_CLEAR_DIALOG_TITLE = 'Clear review state?';
export const SETTINGS_CLEAR_DIALOG_TEXT = (items: number, decisions: number, rules: number): string =>
  `This removes ${plural(items, 'work item', 'work items')}, ${plural(decisions, 'finding decision', 'finding decisions')} and ${plural(rules, 'boundary rule', 'boundary rules')}, and the report note. It cannot be undone. Export the review state first if you want a record.`;
export const SETTINGS_CLEAR_CONFIRM = 'Clear everything';
export const SETTINGS_CLEAR_CANCEL = 'Cancel';
export const SETTINGS_CLEARED = 'Review state cleared.';
export const SETTINGS_CLEAR_FAILED = 'Could not clear the review state.';
/** Part 5 P1: `clearAll()` refuses (false) while a change is still pending. */
export const SETTINGS_CLEAR_BUSY = 'Wait for the pending change to finish, then clear again.';
export const SETTINGS_ABOUT_READS = 'What it reads';
export const SETTINGS_ABOUT_READS_TEXT = 'File paths, sizes and line counts inside the scope you approve. Nothing outside that scope.';
export const SETTINGS_ABOUT_NEVER = 'What it never does';
export const SETTINGS_ABOUT_NEVER_TEXT = 'Change, delete or move source files; install packages; run tools; send data anywhere.';
export const SETTINGS_ABOUT_SAMPLE = 'Sample data';
export const SETTINGS_ABOUT_SAMPLE_TEXT = 'Signals without a real provider are sample data and are labelled everywhere they appear. Missing evidence is unknown, never zero.';
export const REVIEW_STATE_NOTE = 'Review decisions are saved in the plugin’s own data for this vault; the report’s sections and note are kept for this session only. Nothing in the repository was changed.';
/** Part 5 V12: one `warnings` entry of the v2 export, per kind of item left out. */
export const REVIEW_STATE_SKIPPED = (n: number, kind: 'work items' | 'finding decisions'): string =>
  `Left out ${plural(n, kind === 'work items' ? 'work item' : 'finding decision', kind)} whose target could not be written as a relative path.`;

/* Part 5 V13–V16: Import review state. */
export const SETTINGS_IMPORT = 'Import review state';
export const SETTINGS_IMPORT_TEXT = 'Replace this codebase’s saved review state with a file exported from it. Only the file you pick is read; nothing is read from your vault.';
export const SETTINGS_IMPORT_OPEN = 'Import review state…';
export const SETTINGS_IMPORT_HINT = 'Open a codebase first: imported file paths are matched to the codebase on screen.';
/** V15: one message per refusal. `detail` is the first issue's path for `invalid` and the
 *  file's folder label for `other-codebase`; the other codes ignore it. */
export const IMPORT_ERROR: Readonly<Record<'too-large' | 'not-json' | 'unknown-schema' | 'invalid' | 'other-codebase' | 'read-failed', (detail: string) => string>> = {
  'too-large': () => 'That file is larger than 1 MB, so it was not read. Nothing was imported.',
  'not-json': () => 'That file is not valid JSON. Nothing was imported.',
  'unknown-schema': () => 'That file is not a Codebase Inspector review state (v1 or v2). Nothing was imported.',
  invalid: (at) => (at === '' ? 'That review state is not valid. Nothing was imported.' : `That review state is not valid at ${at}. Nothing was imported.`),
  'other-codebase': (folder) => `That review state belongs to another codebase (${folder}). Open that codebase to import it. Nothing was imported.`,
  'read-failed': () => 'Could not read that file. Nothing was imported.',
};
export const IMPORT_DIALOG_TITLE = 'Replace the review state?';
export const IMPORT_CONFIRM_TEXT = (items: number, decisions: number, rules: number, hasNote: boolean): string =>
  `The file holds ${plural(items, 'work item', 'work items')}, ${plural(decisions, 'finding decision', 'finding decisions')} and ${plural(rules, 'boundary rule', 'boundary rules')}${hasNote ? ', and a report note' : ''}.`;
export const IMPORT_ORIGIN = (folder: string): string => `Exported from the codebase in “${folder}”.`;
export const IMPORT_ORIGIN_UNKNOWN = 'Unknown origin: the file does not say which codebase it came from (a v1 file, or exported with no codebase open).';
export const IMPORT_REPLACE_TEXT = 'Every work item, finding decision and boundary rule saved for this codebase, and the report’s sections and note, will be replaced. This cannot be undone. Export the review state first if you want a record.';
export const IMPORT_CONFIRM = 'Replace review state';
export const IMPORT_CANCEL = 'Cancel';
export const IMPORTED = (items: number, decisions: number, rules: number): string =>
  `Review state imported: ${plural(items, 'work item', 'work items')}, ${plural(decisions, 'finding decision', 'finding decisions')} and ${plural(rules, 'boundary rule', 'boundary rules')}.`;
export const IMPORT_FAILED = 'Could not import the whole review state. The lists show what was saved.';
export const IMPORT_BUSY = 'A review change is still being saved. Try again in a moment.';
/** Part 5 E19: the codebase on screen changed between pick and confirm. */
export const IMPORT_STALE = 'The codebase on screen changed. Pick the file again.';
