// Part 4: Settings. Re-exported by inspector-copy.ts.
export const SETTINGS_EYEBROW = 'Configure / Settings';
export const SETTINGS_TITLE = 'A workspace that fits your review.';
export const SETTINGS_SUBTITLE = 'Display preferences are real; production policies are stated explicitly.';
export const SETTINGS_EXPORT = 'Export review state';
export const SETTINGS_JSON_FILENAME = 'codebase-inspector-review-state.json';
export const SETTINGS_TABS_LABEL = 'Settings categories';
export const SETTINGS_TAB: Readonly<Record<'appearance' | 'analysis' | 'accessibility' | 'privacy' | 'about', string>> = {
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
export const SETTINGS_STORAGE = 'Session-only review state';
export const SETTINGS_STORAGE_TEXT = 'Work items, finding decisions, boundary rules and report notes live in this leaf’s memory. They are lost when the leaf closes. Nothing is written to your vault.';
export const SETTINGS_CLEAR = 'Clear review state';
export const SETTINGS_CLEAR_TEXT = 'Remove every work item, finding decision, boundary rule and the report note from this session. No repository content is affected.';
export const SETTINGS_CLEAR_OPEN = 'Clear review state…';
export const SETTINGS_CLEAR_DIALOG_TITLE = 'Clear review state?';
export const SETTINGS_CLEAR_DIALOG_TEXT = (items: number, decisions: number, rules: number): string =>
  `This removes ${items} work items, ${decisions} finding decisions and ${rules} boundary rules, and the report note. It cannot be undone. Export the review state first if you want a record.`;
export const SETTINGS_CLEAR_CONFIRM = 'Clear everything';
export const SETTINGS_CLEAR_CANCEL = 'Cancel';
export const SETTINGS_CLEARED = 'Review state cleared.';
export const SETTINGS_CLEAR_FAILED = 'Could not clear the review state.';
export const SETTINGS_ABOUT_READS = 'What it reads';
export const SETTINGS_ABOUT_READS_TEXT = 'File paths, sizes and line counts inside the scope you approve. Nothing outside that scope.';
export const SETTINGS_ABOUT_NEVER = 'What it never does';
export const SETTINGS_ABOUT_NEVER_TEXT = 'Change, delete or move source files; install packages; run tools; send data anywhere.';
export const SETTINGS_ABOUT_SAMPLE = 'Sample data';
export const SETTINGS_ABOUT_SAMPLE_TEXT = 'Signals without a real provider are sample data and are labelled everywhere they appear. Missing evidence is unknown, never zero.';
export const REVIEW_STATE_NOTE = 'Kept in memory for one session. Nothing was written to the vault.';
