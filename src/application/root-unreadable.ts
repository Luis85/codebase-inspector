// Gap closure GRB17b (GCQ9, closes Part A E17): a scan root the walk cannot list. The walker
// throws this in place of the listing's raw error, so the scan coordinator reports the root as
// unavailable (the `root-unavailable` cause, COPY-28) and names the code, never as a plain
// "Scan failed". Every other directory that cannot be listed stays a visible skip.

/** The code of a Node system error (`EACCES`, `ENOENT`, …), or `UNKNOWN` when it carries none. */
export function errorCodeOf(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'code' in e && typeof e.code === 'string' && e.code !== '') return e.code;
  return 'UNKNOWN';
}

export class RootUnreadableError extends Error {
  readonly code: string;
  /** The listing's own error, unchanged. */
  readonly original: unknown;

  constructor(original: unknown) {
    const code = errorCodeOf(original);
    super(`The source directory cannot be listed (${code}).`);
    this.name = 'RootUnreadableError';
    this.code = code;
    this.original = original;
  }
}
