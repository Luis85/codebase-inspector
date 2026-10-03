// Polish E5 (L11): two structural checks on untrusted JSON, shared by every layer that decodes
// it (the analyzer record, the review adapter and codec, the plugin-data stores).
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `Array.isArray` narrows to `any[]` even from `unknown` (a lib.es5 quirk); this gives the
 *  narrowed branch an explicit `unknown[]`, so no `any` leaks into list code. */
export function asUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}
