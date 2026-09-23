// Part 6 Y26: matching normalised findings against a snapshot's file paths, and the
// explicit folder mapping the review step may offer. Pure. A finding whose path is not a
// snapshot file never paints a lot or appears in a table: it is dropped, and its path is
// listed. Nothing is ever mapped without the user's choice: `suggestStripPrefix` only
// proposes.
import type { EvidenceFinding } from './model';

export function resolveFindings(
  findings: readonly EvidenceFinding[],
  snapshotPaths: ReadonlySet<string>,
): { matched: readonly EvidenceFinding[]; unmatchedPaths: readonly string[] } {
  const matched: EvidenceFinding[] = [];
  const unmatched = new Set<string>();
  for (const f of findings) {
    if (snapshotPaths.has(f.path)) matched.push(f);
    else unmatched.add(f.path);
  }
  return { matched, unmatchedPaths: [...unmatched].sort() };
}

/** Every leading folder of every path, as `a/`, `a/b/`, … */
function leadingFolders(paths: readonly string[]): Set<string> {
  const out = new Set<string>();
  for (const path of paths) {
    const segments = path.split('/');
    for (let i = 1; i < segments.length; i += 1) out.add(`${segments.slice(0, i).join('/')}/`);
  }
  return out;
}

/** Y26: every unmatched path under `prefix` matches once it is removed, at least one path
 *  is under it, and no snapshot path is under it (so removing it can never break a path
 *  that already matches: `normalizeFallow` strips it from every path). */
function qualifies(prefix: string, paths: readonly string[], snapshotPaths: ReadonlySet<string>): boolean {
  let any = false;
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue;
    if (!snapshotPaths.has(path.slice(prefix.length))) return false;
    any = true;
  }
  if (!any) return false;
  for (const snapshotPath of snapshotPaths) if (snapshotPath.startsWith(prefix)) return false;
  return true;
}

/** Y26: the shortest qualifying leading folder, or null. Two qualifying folders of that
 *  same shortest length are ambiguous, and nothing is offered. */
export function suggestStripPrefix(paths: readonly string[], snapshotPaths: ReadonlySet<string>): string | null {
  const qualifying = [...leadingFolders(paths)].filter((prefix) => qualifies(prefix, paths, snapshotPaths));
  if (qualifying.length === 0) return null;
  const shortest = qualifying.reduce((min, p) => Math.min(min, p.length), Number.POSITIVE_INFINITY);
  const best = qualifying.filter((p) => p.length === shortest);
  return best.length === 1 ? best[0]! : null;
}
