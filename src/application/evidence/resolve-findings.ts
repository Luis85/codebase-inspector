// Part 6 Y26: matching normalised findings against a snapshot's file paths, and the
// explicit folder mapping the review step may offer. Pure. A finding whose path is not a
// snapshot file never paints a lot or appears in a table: it is dropped, and its path is
// listed. Nothing is ever mapped without the user's choice: `suggestStripPrefix` only
// proposes.
// WP-03 N12: a finding's `related` paths are matched too (never the anchor rule itself),
// so a related path that is not one of the snapshot's files is still listed as unmatched.
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
    for (const related of f.related ?? []) {
      if (!snapshotPaths.has(related)) unmatched.add(related);
    }
  }
  return { matched, unmatchedPaths: [...unmatched].sort() };
}

/** Every leading folder of one path, as `a/`, `a/b/`, … (never the path itself). Built by
 *  growing one string, not by re-joining a growing slice, so the cost is linear in the
 *  path's own segment count (Fix round 1, Important 2). */
function leadingFoldersOf(path: string): string[] {
  const segments = path.split('/');
  const out: string[] = [];
  let prefix = '';
  for (let i = 0; i < segments.length - 1; i += 1) {
    prefix = `${prefix}${segments[i]}/`;
    out.push(prefix);
  }
  return out;
}

/** Every leading folder of every snapshot path, once, so "a snapshot path lies under
 *  `prefix`" (E12) is an O(1) set lookup instead of a scan of the whole snapshot per
 *  candidate prefix (Fix round 1, Important 2). */
function snapshotFolders(snapshotPaths: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  for (const path of snapshotPaths) for (const folder of leadingFoldersOf(path)) out.add(folder);
  return out;
}

interface PrefixCounts { total: number; matched: number }

/** Y26: the shortest qualifying leading folder, or null. A folder qualifies when at
 *  least one unmatched path lies under it, every unmatched path under it matches once
 *  stripped, and no snapshot path already lies under it (E12). Two qualifying folders of
 *  that same shortest length are ambiguous, and nothing is offered.
 *  Fix round 1 (Important 2): linear in the number of path segments — each unmatched
 *  path's own leading folders are visited once (never once per OTHER path), and
 *  "lies under the snapshot" is the one set built above, not a fresh scan per prefix. */
export function suggestStripPrefix(paths: readonly string[], snapshotPaths: ReadonlySet<string>): string | null {
  const folders = snapshotFolders(snapshotPaths);
  const counts = new Map<string, PrefixCounts>();
  for (const path of paths) {
    for (const prefix of leadingFoldersOf(path)) {
      const entry = counts.get(prefix) ?? { total: 0, matched: 0 };
      entry.total += 1;
      if (snapshotPaths.has(path.slice(prefix.length))) entry.matched += 1;
      counts.set(prefix, entry);
    }
  }
  let best: string | null = null;
  let ambiguous = false;
  for (const [prefix, { total, matched }] of counts) {
    if (total !== matched || folders.has(prefix)) continue;
    if (best === null || prefix.length < best.length) {
      best = prefix;
      ambiguous = false;
    } else if (prefix.length === best.length) {
      ambiguous = true;
    }
  }
  return ambiguous ? null : best;
}
