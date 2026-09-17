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
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function setup(): void {
  const root = fileURLToPath(new URL('../', import.meta.url));
  execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: true });
}
