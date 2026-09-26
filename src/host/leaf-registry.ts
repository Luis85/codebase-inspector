// Task 11. Deferred-view-safe enumeration of every open CityView, across every leaf
// and every window. Since Obsidian 1.7.2 every view is created as a DeferredView
// placeholder until its leaf is actually revealed, so `leaf.view` may not be a
// CityView at all yet — a bare cast (`leaf.view as CityView`) would silently hand a
// caller a DeferredView wearing CityView's type and crash on the first real method
// call. `instanceof` is the only correct check, and it works here precisely because
// this file is never itself asked to compare across two different windows'
// realms — it consumes CityView, a class defined once in this plugin's own single
// JS context, not a bare DOM type (spec 4.4's cross-window `instanceOf` rule is about
// DOM types specifically; see window-migration.ts).
//
// `getLeavesOfType`, never the deprecated `workspace.activeLeaf` or any leaf cast —
// the same rule commands.ts already follows for the one active view it needs.
import type { App } from 'obsidian';
import { CITY_VIEW_TYPE, CityView } from './city-view';
import type { CodebaseSnapshot } from '../domain/model';

/** Applies `fn` to every currently-open CityView, in every leaf, in every window.
 *  A leaf whose view is still a DeferredView is silently skipped, never coerced. */
export function forEachCityView(app: App, fn: (view: CityView) => void): void {
  for (const leaf of app.workspace.getLeavesOfType(CITY_VIEW_TYPE)) {
    const view = leaf.view;
    if (view instanceof CityView) fn(view);
  }
}

/** Task 11, carried finding 1 (task-11-context.md section 4): `ScanCoordinator` is
 *  one per CityView, so a scan completing in ONE leaf is invisible to every OTHER
 *  leaf showing the same profile unless something tells them. This is that
 *  something — called once per completed scan, for EVERY open CityView (including
 *  the one whose own coordinator produced `snapshot`, the common case of a leaf
 *  rescanning what it already shows). Each view reconciles only ITS OWN live
 *  selection against `snapshot` (`CityView.applyReconciliation`); a leaf on a
 *  different profile is a no-op, and a leaf on the SAME profile never has its own
 *  snapshot/layout replaced by this — multiple leaves stay independent (ruling M9),
 *  and reconciliation never authorises a scan (spec 4.2). */
export function reconcileEveryView(app: App, snapshot: CodebaseSnapshot): void {
  forEachCityView(app, (view) => { view.applyReconciliation(snapshot); });
}
