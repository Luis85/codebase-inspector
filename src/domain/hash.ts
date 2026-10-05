// Part 6 Y24: FNV-1a over UTF-16 code units, 32-bit, as eight lower-case hex digits.
// Deterministic, non-cryptographic, no Node `crypto` (no-nodejs-modules). It names
// imported findings (`CX-1a2b3c4d`) and is the persisted trust fingerprint (GCQ3); it is
// never an entity id (spec 4.1: identity is never hashed) and never a security boundary.
// ui/fixtures/seeded-random.ts keeps its own private copy, left as it is.
export function fnv1a32Hex(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// GRB11: the 64-bit variant (offset 0xcbf29ce484222325, prime 0x100000001b3), as sixteen
// lower-case hex digits. For values held in memory only (scope fingerprints, the file-set
// digest, the analysis root fingerprint), where 32 bits is too narrow a collision margin.
// Done as two 32-bit halves rather than BigInt so a digest over every path stays cheap.
// The prime is 2^40 + 0x1b3, so a multiply is `h * 0x1b3` plus `h << 40`; the latter only
// reaches the high half, as `lo << 8`.
export function fnv1a64Hex(text: string): string {
  let hi = 0xcbf29ce4;
  let lo = 0x84222325;
  for (let i = 0; i < text.length; i += 1) {
    lo = (lo ^ text.charCodeAt(i)) >>> 0;
    const product = lo * 0x1b3;
    const carry = Math.floor(product / 0x100000000);
    hi = (hi * 0x1b3 + carry + ((lo << 8) >>> 0)) >>> 0;
    lo = product >>> 0;
  }
  return hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0');
}
