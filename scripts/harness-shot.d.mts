// scripts/harness-shot.mjs is plain JS (no type-aware linting inside scripts/, matching
// the other files here) but tests/build/harness-shot.test.ts imports its `SHOTS` export
// directly — the one script in scripts/ actually imported as a module rather than read as
// text or spawned as a subprocess (see the other tests/*/**.mjs references). This sibling
// declaration is what gives that import a real type instead of an implicit `any`.
export interface HarnessShot {
  id: string;
  query: string;
  viewport?: { width: number; height: number };
  /** True only for the one capture that needs a browser launched with WebGL genuinely
   *  unavailable, routed through its own wait function in harness-shot.mjs's `main()`
   *  — see that file's comment on `waitForFailurePathSettled` for why. */
  webglDisabled?: boolean;
}

export declare const SHOTS: readonly HarnessShot[];
