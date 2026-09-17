// Vitest global setup: runs once before any test file, regardless of file
// discovery/execution order or parallelism.
//
// tests/host/build-output.test.ts builds dist/ as a side effect of its own
// beforeAll (it runs `npm run build`), and tests/unit/install-script.test.ts's
// last case copies dist/ into a scratch vault without building it itself.
// Vitest's file discovery/scheduling order is not guaranteed to run one before
// the other, so without this, the install-script test can see a missing dist/.
// Building here once, up front, makes the full suite's outcome independent of
// that ordering.
//
// Only builds when dist/main.js is missing: a narrow single-file run (the normal
// TDD loop — `npx vitest run tests/unit/whatever.test.ts`) should not pay for a
// full production build every time. tests/host/build-output.test.ts still always
// rebuilds in its own beforeAll, since validating a fresh build is that test's job.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default function setup(): void {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const distMain = fileURLToPath(new URL('../dist/main.js', import.meta.url));
  if (existsSync(distMain)) return;

  // execSync, not execFileSync(cmd, args, { shell: true }): DEP0190 fires
  // specifically for the argv-array-plus-shell combination (spawn/execFile with
  // both an `args` array and `shell: true`), because that pairing is what lets an
  // element of `args` be unsafely concatenated into the shell command line.
  // execSync takes one already-composed command string and has no separate args
  // array to concatenate, so it runs through the shell (needed for `npm`, whose
  // own launcher is a .cmd/.ps1 wrapper on Windows) without triggering the warning.
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
}
