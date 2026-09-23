// Polish G2: the one recursive file walker the whole-src guards share. It was written three
// times (no-process-execution, node-access-boundary, fallow-argv-policy).
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Every file under `dir` whose base name `accept` keeps, depth first, in readdir order. */
export function listFiles(dir: string, accept: (name: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) return listFiles(abs, accept);
    return accept(name) ? [abs] : [];
  });
}
