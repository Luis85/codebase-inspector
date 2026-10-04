import { REVISION } from 'three';

/** GCP6. Three.js writes `window.__THREE__ = REVISION` as its module evaluates, and warns
 *  "Multiple instances of Three.js being imported" when the marker is already there. A plugin
 *  disable/enable (or reload) inside one Obsidian session therefore warned about a bundle that
 *  had in fact been unloaded. On unload the plugin clears ITS OWN marker: only when it still
 *  holds this bundle's `REVISION`, so another Three.js on the page (another plugin, another
 *  revision) is never touched, and a genuine double bundle in one session still warns.
 *
 *  The window is a parameter, not a bare `window`, because spec 4.4's cross-window rule bans
 *  the global inside src/visualization; the caller names the main window Three.js wrote to. */
export function releaseThreeMarker(target: { __THREE__?: unknown }): void {
  if (target.__THREE__ === REVISION) delete target.__THREE__;
}
