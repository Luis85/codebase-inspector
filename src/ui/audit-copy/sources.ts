// Part 4: Data & scans. Re-exported by inspector-copy.ts.
export const SOURCES_EYEBROW = 'Configure / Data & scans';
export const SOURCES_TITLE = 'Know where every signal comes from.';
export const SOURCES_SUBTITLE = 'Explicit sources. Read-only analysis. No automatic installs or background scans.';
export const SOURCES_CHANGE = 'Change source';
export const SOURCES_RESCAN = 'Rescan';
export const SOURCES_CALLOUT_TITLE = 'Evidence sources';
export const SOURCES_CALLOUT = 'One real provider is connected: the built-in read-only inventory. Every other signal is sample data or not collected.';
export const SOURCES_SCOPE_TITLE = 'Active source';
export const SOURCES_SCOPE_SUBTITLE = 'The scope the snapshot on screen was scanned with.';
export const SOURCES_SCOPE_EDIT = 'Edit profiles, exclusions and limits in Obsidian’s settings for Codebase Inspector. Changes apply at the next scan.';
export const SOURCES_ROW_FOLDER = 'Folder';
export const SOURCES_ROW_PATH = 'Path';
export const SOURCES_ROW_EXCLUSIONS = 'Exclusions';
export const SOURCES_ROW_LIMIT = 'Largest file read';
export const SOURCES_ROW_SYMLINKS = 'Symbolic links';
export const SOURCES_ROW_CAPTURED = 'Captured';
export const SOURCES_ROW_COMPLETENESS = 'Completeness';
export const SOURCES_NONE = 'None';
export const SOURCES_SYMLINKS_NOT_FOLLOWED = 'Not followed';
export const SOURCES_COMPLETE = 'Complete';
export const SOURCES_PARTIAL = (measured: number, included: number): string =>
  `Partial: ${measured} of ${included} files measured; the rest could not be read`;
export const SOURCES_STATUS_TITLE = 'Scan status';
export const SOURCES_STATUS_SUBTITLE = 'The last run in this leaf. Scan progress shows on the Code city.';
export const SOURCES_RUN_IDLE = 'No scan has run in this leaf yet.';
export const SOURCES_RUN_RUNNING = (n: number): string => `Scanning: ${n.toLocaleString('en-US')} files read so far. The total is unknown until the scan ends.`;
export const SOURCES_RUN_CANCELLING = 'Cancelling the scan…';
export const SOURCES_RUN_CANCELLED = 'The last scan was cancelled. Its incomplete result was discarded.';
export const SOURCES_RUN_FAILED = (message: string): string => `The last scan failed: ${message}`;
export const SOURCES_RUN_COMPLETE = 'The last scan completed.';
export const SOURCES_PROVIDERS_TITLE = 'Evidence providers';
export const SOURCES_USED_BY = 'Used by';
export const SOURCES_SOURCE_BUILTIN = 'Built-in scan';
export const SOURCES_SOURCE_FICTIONAL = 'Fictional packages';
export const SOURCES_PROVIDER: Readonly<Record<string, { title: string; description: string }>> = {
  inventory: { title: 'File inventory', description: 'Paths, sizes and line counts inside the approved scope, read-only.' },
  static: { title: 'Static findings', description: 'Complexity, unused exports and duplication. Sample data seeded per file.' },
  imports: { title: 'Module import graph', description: 'Module dependencies, cycles and boundary checks. Sample edges, not observed imports.' },
  history: { title: 'Change history', description: 'Commit activity, change coupling and team-level stewardship. Sample data.' },
  coverage: { title: 'Coverage and test runs', description: 'Instrumented branches and test-run summaries. Sample data.' },
  packages: { title: 'Packages and advisories', description: 'A fixed set of fictional packages and demo advisories. No registry is consulted.' },
  secrets: { title: 'Secret scanning', description: 'No secret-scanning provider is connected. Unknown, not zero.' },
  runtime: { title: 'Runtime and mutation', description: 'Runtime traces and mutation results have not been collected. Unknown, not passing.' },
};
export const SOURCES_PLANNED_TITLE = 'Planned integrations';
export const SOURCES_PLANNED = 'An external analyser may later be imported from a report or run as an already-installed tool, and only on your explicit request. Nothing is ever installed, and no integration is active today.';
/** Part 5 V28: the provider's route buttons form a group named after the provider, and
 *  each button's name contains its visible screen title (WCAG 2.5.3). */
export const SOURCES_USED_BY_GROUP = (provider: string): string => `${provider} is used by`;
export const SOURCES_OPEN_ROUTE = (title: string): string => `Open ${title}`;
