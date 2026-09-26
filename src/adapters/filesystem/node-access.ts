// The only place that reaches Node's filesystem and path modules; src/adapters/fallow/node-process-access.ts is the only place that reaches Node's process module (Part 7 Z14).
//
// window.require, not a bundled import: Obsidian injects its own CommonJS require, and
// the renderer's window.require is Electron's real one. (The spike settled which;
// window.require is correct either way.) A static import would also trip
// no-nodejs-modules in eslint-plugin-obsidianmd, which isDesktopOnly does not exempt.
//
// node:original-fs, not fs: Electron patches fs to be asar-aware; original-fs is
// unpatched and correct for walking an arbitrary tree. This is what Obsidian's
// first-party obsidian-importer uses.
import { Platform } from 'obsidian';
import type { NodePathLike, NodeRealPathLike } from './node-globals';

export const fs = Platform.isDesktopApp ? window.require('node:original-fs') : null;
export const fsPromises = fs ? fs.promises : null;
export const nodePath = Platform.isDesktopApp ? window.require('node:path') : null;

/** The filesystem and path modules realPathOfNearest resolves with: node-access's own by default, null off desktop. */
interface RealPathModules { readonly fs: NodeRealPathLike | null; readonly path: NodePathLike | null }

function isMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ENOENT';
}

function nearestReal(modules: { fs: NodeRealPathLike; path: NodePathLike }, current: string, rest: readonly string[]): string | null {
  try {
    const real = modules.fs.realpathSync.native(current);
    return rest.length === 0 ? real : modules.path.join(real, ...rest);
  } catch (error) {
    const parent = modules.path.dirname(current);
    if (!isMissing(error) || parent === current) return null;
    return nearestReal(modules, parent, [modules.path.basename(current), ...rest]);
  }
}

/** WP-04.2 NE15: `target`'s filesystem form — `realpathSync.native` of its deepest existing ancestor (a junction
 *  followed, an 8.3 name expanded, the case as stored), with the missing rest re-appended as written. Null off desktop,
 *  and on any error other than a missing segment. Synchronous: the create dialog re-plans on every keystroke. */
export function realPathOfNearest(target: string, modules: RealPathModules = { fs, path: nodePath }): string | null {
  const { fs: files, path: paths } = modules;
  return files === null || paths === null ? null : nearestReal({ fs: files, path: paths }, target, []);
}
