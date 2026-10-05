// GRB12 / GCQ4: the scan warnings that are about the scope rather than about a skipped entry.
// `snapshot.warnings` is plain text, and the skip reasons beside it are already literal
// strings (adapters/filesystem), so the text is produced here: src/application never imports
// src/ui, which holds the other copy. The wording is spec GCN12, verbatim.

/** An exclusion saved before M62 may hold `*` or `?`. The walker matches exclusions as literal
 *  paths, so it matches nothing; M62 forbids migrating stored values away, so the scan names it. */
export function wildcardExclusionWarnings(exclusions: readonly string[]): string[] {
  return exclusions
    .filter((x) => x.includes('*') || x.includes('?'))
    .map((x) => `The exclusion "${x}" contains * or ? and matches nothing. Edit it in Settings.`);
}
