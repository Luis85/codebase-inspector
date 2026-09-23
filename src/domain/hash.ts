// Part 6 Y24: FNV-1a over UTF-16 code units, 32-bit, as eight lower-case hex digits.
// Deterministic, non-cryptographic, no Node `crypto` (no-nodejs-modules). It names
// imported findings (`CX-1a2b3c4d`); it is never an entity id (spec 4.1: identity is
// never hashed) and never a security boundary. The same algorithm as the private copies
// in application/approval.ts, application/inventory-collector.ts and
// ui/fixtures/seeded-random.ts, which are left as they are.
export function fnv1a32Hex(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
