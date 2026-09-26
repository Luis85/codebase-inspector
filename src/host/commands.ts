// Registers the commands without the plugin-id prefix (spec 5.2): the three WP-01
// commands open-city, scan-codebase and cancel-scan, Part 6's import-analysis-report (Y39),
// and Part 7's run-fallow-analysis and cancel-fallow-analysis (Z35). Six in all; none for
// an unimplemented capability (spec 1).
//
// Task 8 wires real bodies for scan-codebase and cancel-scan, operating on the ACTIVE
// CityView (`getActiveViewOfType`, never the deprecated `workspace.activeLeaf` — spec
// 4.4). scan-codebase's own checkCallback still returns true unconditionally
// (task 3's original behaviour, reaffirmed by ruling M36): it stays visible even with
// no active city view, and simply does nothing observable in that case, exactly as it
// did before this task's body existed. cancel-scan's checkCallback does NOT: ruling
// M36 supersedes M6 for cancel-scan only, because once cancelling genuinely does
// something, showing it when there is nothing to cancel is exactly what
// checkCallback is for.
import type { Plugin } from 'obsidian';
import { CITY_VIEW_TYPE, CityView } from './city-view';
import { COPY_09 } from '../ui/copy';
import { FALLOW_COMMAND_CANCEL, FALLOW_COMMAND_IMPORT, FALLOW_COMMAND_RUN } from '../ui/inspector-copy';

/** Always opens a NEW city tab (ruling M9, review round 2). Multiple leaves are a
 *  first-class WP-01 capability, not an edge case: spec 4.4 says "the factory may run
 *  more than once," and task 11's per-leaf snapshot reconciliation only means anything
 *  if two leaves can hold different snapshots. A reveal-existing convention (the
 *  brief's own original line) silently removed that capability — checkpoint #1's
 *  "opening a second city tab works" line failed against it in the real host. Never
 *  casts a leaf's `.view` — callers that need the CityView itself use
 *  `leaf.view instanceof CityView`. */
export async function openCity(plugin: Plugin): Promise<void> {
  const { workspace } = plugin.app;
  const leaf = workspace.getLeaf('tab');
  await leaf.setViewState({ type: CITY_VIEW_TYPE, active: true });
  // Since 1.7.2 every view is created as a DeferredView, so reveal before acting.
  await workspace.revealLeaf(leaf);
}

export function registerCommands(plugin: Plugin): void {
  plugin.addCommand({
    id: 'open-city',
    name: 'Open codebase city',
    callback: () => { void openCity(plugin); },
  });

  plugin.addCommand({
    id: 'scan-codebase',
    name: 'Scan codebase',
    checkCallback: (checking: boolean): boolean => {
      if (checking) return true;
      const view = plugin.app.workspace.getActiveViewOfType(CityView);
      // No active city view: doing nothing observable is the correct WP-01 behaviour,
      // exactly as it was before this task's body existed. Must never throw.
      if (view) void view.startScan();
      return true;
    },
  });

  plugin.addCommand({
    id: 'cancel-scan',
    // COPY-09, from the ONE catalogue (task 12, carried finding 3): the command's
    // palette name IS the cancel label the microcopy catalogue defines.
    name: COPY_09,
    // Ruling M36: hidden from the palette unless the active view actually has a run
    // to cancel -- superseding M6 for THIS command only (spec §5 requires the three
    // commands to be registered, not permanently visible; scan-codebase stays
    // unconditionally visible above).
    checkCallback: (checking: boolean): boolean => {
      const view = plugin.app.workspace.getActiveViewOfType(CityView);
      if (!view || !view.isScanRunning()) return false;
      if (checking) return true;
      view.cancelScan();
      return true;
    },
  });

  plugin.addCommand({
    id: 'import-analysis-report',
    name: FALLOW_COMMAND_IMPORT,
    // Part 6 Y39: only while the active city view shows a snapshot (paths are matched
    // against it). The body opens Data & scans and raises a request; the file is picked
    // inside the S14 dialog, from a real click. Nothing is read or run here.
    checkCallback: (checking: boolean): boolean => {
      const view = plugin.app.workspace.getActiveViewOfType(CityView);
      if (!view || !view.hasSnapshot()) return false;
      if (checking) return true;
      view.openReportImport();
      return true;
    },
  });

  plugin.addCommand({
    id: 'run-fallow-analysis',
    name: FALLOW_COMMAND_RUN,
    // Part 7 Z35: only while the active city view shows a snapshot and its codebase has no
    // analysis in flight. The body opens Data & scans and raises a request: SourcesScreen
    // starts at once when trust holds, and otherwise opens the review. Nothing runs here.
    checkCallback: (checking: boolean): boolean => {
      const view = plugin.app.workspace.getActiveViewOfType(CityView);
      if (!view || !view.hasSnapshot() || view.isAnalysisActive()) return false;
      if (checking) return true;
      view.requestFallowRun();
      return true;
    },
  });

  plugin.addCommand({
    id: 'cancel-fallow-analysis',
    name: FALLOW_COMMAND_CANCEL,
    // Part 7 Z35, M36's rule: offered only while there is an analysis to cancel.
    checkCallback: (checking: boolean): boolean => {
      const view = plugin.app.workspace.getActiveViewOfType(CityView);
      if (!view || !view.isAnalysisCancellable()) return false;
      if (checking) return true;
      view.cancelAnalysis();
      return true;
    },
  });
}
