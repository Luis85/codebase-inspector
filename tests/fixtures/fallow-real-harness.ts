// JF20: the module-local helpers `fallow-real.test.ts` used before it had a sibling file
// (temp copy, fs snapshot, FALLOW_BIN lookup/skip logic), shared verbatim by
// `fallow-real.test.ts` and `fallow-real-relations.test.ts` (J16) so neither copies them.
// Part 7 Z40/Z41: still opt-in only, still never fetches or writes into the repository.
import { existsSync, readFileSync } from 'node:fs';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashTree } from './temp-tree';

export { hashTree };

/** `FALLOW_BIN`, or the binary `npm run test:fallow` fetched into `.fallow-bin/`, or null
 *  when neither is there — the real-binary suites skip rather than fail (never download). */
export function resolveFallowBin(): string | null {
  const fromEnv = process.env.FALLOW_BIN;
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv;
  const file = fileURLToPath(new URL('../../.fallow-bin/bin-path.txt', import.meta.url));
  return existsSync(file) ? readFileSync(file, 'utf8').trim() : null;
}

/** `describe.skipIf`'s title: names the binary the suite runs against, or why it is
 *  skipped — the same text on every real-binary file. */
export function fallowRealTitle(bin: string | null): string {
  return bin === null ? 'fallow binary not fetched: run npm run test:fallow' : `the real fallow at ${bin}`;
}

export interface ProjectCopier {
  /** A fresh temp copy of this copier's source project, tracked for `cleanupAll`. */
  copy(): Promise<string>;
  /** Removes every copy this instance made so far (call from `afterEach`). */
  cleanupAll(): Promise<void>;
}

/** One instance per source project directory (the plain fixture project, or
 *  `RELATIONS_PROJECT_DIR`); every `copy()` lands under its own `mkdtemp` base, so two
 *  copies from the same or different copiers never collide. */
export function createProjectCopier(sourceDir: string): ProjectCopier {
  const bases: string[] = [];
  return {
    async copy(): Promise<string> {
      const base = await mkdtemp(join(tmpdir(), 'ci-fallow-real-'));
      bases.push(base);
      const root = join(base, 'project');
      await cp(sourceDir, root, { recursive: true });
      return root;
    },
    async cleanupAll(): Promise<void> {
      for (const base of bases.splice(0)) await rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    },
  };
}
