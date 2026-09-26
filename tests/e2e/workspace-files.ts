// NE3: fixtures written at run time for native scenarios: the relations project copied into a session vault,
// a synthetic source tree sized by probe g, a report crafted from the 3.27.0 recording, and a junction.
// IP56: native files never import tests/fixtures/**; they only read its files from disk.
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';

export const RECORDING = resolve('tests/fixtures/fallow/relations-combined-3.27.0.json');
const RELATIONS_PROJECT = resolve('tests/fixtures/fallow/relations-project');
const CYCLE_ANCHOR = 'src/core/a.ts';
/** Files per leaf folder of the synthetic tree, and folders per level (MAX_DIRECT_SUBDISTRICTS is 20). */
const FILES_PER_FOLDER = 25;
const FOLDERS_PER_LEVEL = 20;

/** Copies the WP-03 relations project into the vault as `folder`; returns its absolute path. */
export function copyProject(vault: string, folder: string): string {
  const target = join(vault, folder);
  cpSync(RELATIONS_PROJECT, target, { recursive: true });
  return target;
}

/** IP56: a local tree hash (the fast suite's hashTree lives under tests/fixtures/, which native files never import). */
export function hashTree(root: string, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of readdirSync(root).sort()) {
    const abs = join(root, name);
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    if (statSync(abs).isDirectory()) Object.assign(out, { [rel]: 'directory' }, hashTree(abs, rel));
    else out[rel] = createHash('sha256').update(readFileSync(abs)).digest('hex');
  }
  return out;
}

/** The import cycle's finding id and reported line, read from the recording through the real parser and normaliser. */
export function cycleFinding(): { id: string; line: number } {
  const parsed = parseFallowReportText(readFileSync(RECORDING, 'utf8'));
  if (!parsed.ok) throw new Error(`the recording was refused (${parsed.code})`);
  const report = buildEvidenceReport({ raw: parsed.report, fileName: 'r.json', stripPrefix: null, importedAt: new Date().toISOString(), snapshotId: 's' });
  const cycle = report.normalized.findings.find((f) => f.category === 'cycle' && f.path === CYCLE_ANCHOR && f.line !== null);
  if (!cycle || cycle.line === null) throw new Error('no import cycle on src/core/a.ts in the recording');
  return { id: cycle.id, line: cycle.line };
}

/** A TypeScript project of `files` source files (plus `package.json` and `src/index.ts`) under `root`:
 *  `src/aI/bJ/cK/fN.ts`, 25 files per folder and at most 20 folders per level. Each folder is one import
 *  chain (fN imports fN-1), and the entry imports every chain's last file, so fallow resolves the whole
 *  graph and reports no unused file. */
export function writeSyntheticTree(root: string, files: number): void {
  const folders = Math.ceil(files / FILES_PER_FOLDER);
  const entry: string[] = [];
  const sums: string[] = [];
  for (let folder = 0; folder < folders; folder += 1) {
    const a = Math.floor(folder / (FOLDERS_PER_LEVEL * FOLDERS_PER_LEVEL));
    const b = Math.floor(folder / FOLDERS_PER_LEVEL) % FOLDERS_PER_LEVEL;
    const c = folder % FOLDERS_PER_LEVEL;
    const relative = `a${a}/b${b}/c${c}`;
    const dir = join(root, 'src', relative);
    mkdirSync(dir, { recursive: true });
    const count = Math.min(FILES_PER_FOLDER, files - folder * FILES_PER_FOLDER);
    for (let n = 0; n < count; n += 1) {
      const body = n === 0
        ? `export const v = ${folder};\n`
        : `import { v as previous } from './f${n - 1}';\n\nexport const v = previous + ${n};\n`;
      writeFileSync(join(dir, `f${n}.ts`), body);
    }
    entry.push(`import { v as v${folder} } from './${relative}/f${count - 1}';`);
    sums.push(`v${folder}`);
  }
  writeFileSync(join(root, 'package.json'), '{ "name": "synthetic-tree", "private": true, "type": "module", "main": "src/index.ts" }\n');
  writeFileSync(join(root, 'src', 'index.ts'), `${entry.join('\n')}\n\nexport const total = ${sums.join(' + ')};\n`);
}

/** The 3.27.0 recording, parsed, changed by `edit` and written to `to`; returns `to`. */
export function writeReport(to: string, edit: (raw: Record<string, unknown>) => void): string {
  const raw = JSON.parse(readFileSync(RECORDING, 'utf8')) as Record<string, unknown>;
  edit(raw);
  writeFileSync(to, JSON.stringify(raw));
  return to;
}

/** A directory junction at `link` naming `target` (no elevation needed); false when the system refuses it. */
export function makeJunction(target: string, link: string): boolean {
  try {
    symlinkSync(target, link, 'junction');
    return true;
  } catch {
    return false;
  }
}
