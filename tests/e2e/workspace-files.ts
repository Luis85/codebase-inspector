// NE3: fixtures written at run time for native scenarios: the relations project copied into a session vault,
// a synthetic source tree sized by probe g, and a report crafted from the 3.27.0 recording.
// IP56: native files never import tests/fixtures/**; they only read its files from disk.
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { resolveFindings } from '../../src/application/evidence/resolve-findings';

export const RECORDING = resolve('tests/fixtures/fallow/relations-combined-3.27.0.json');
const RELATIONS_PROJECT = resolve('tests/fixtures/fallow/relations-project');
/** The file the recording's import cycle is anchored on (its finding fingerprint is `<anchor>#<finding id>`). */
export const CYCLE_ANCHOR = 'src/core/a.ts';
/** The file the recording's one unused-exports finding is anchored on. */
const UNUSED_EXPORT_ANCHOR = 'src/barrel/x.ts';
/** Files per leaf folder of the synthetic tree, and folders per level (MAX_DIRECT_SUBDISTRICTS is 20). */
const FILES_PER_FOLDER = 25;
const FOLDERS_PER_LEVEL = 20;

/** Copies the WP-03 relations project into the vault as `folder`; returns its absolute path. */
export function copyProject(vault: string, folder: string): string {
  const target = join(vault, folder);
  cpSync(RELATIONS_PROJECT, target, { recursive: true });
  return target;
}

/** FM12: the sorted, recursive, depth-first walk `hashTree` and `projectFilePaths` share. `onDir` (given) runs
 *  before descending into a directory, and `onFile` for each file; both get the path relative to the original
 *  `root`, `/`-separated. */
function walk(root: string, onFile: (rel: string) => void, onDir?: (rel: string) => void, prefix = ''): void {
  for (const name of readdirSync(root).sort()) {
    const abs = join(root, name);
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    if (statSync(abs).isDirectory()) {
      onDir?.(rel);
      walk(abs, onFile, onDir, rel);
    } else {
      onFile(rel);
    }
  }
}

/** IP56: a local tree hash (the fast suite's hashTree lives under tests/fixtures/, which native files never import). */
export function hashTree(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  walk(root, (rel) => { out[rel] = createHash('sha256').update(readFileSync(join(root, rel))).digest('hex'); }, (rel) => { out[rel] = 'directory'; });
  return out;
}

/** Every finding the recording (or a report crafted from it, `file`) holds once normalised: the real parser and
 *  normaliser. */
export function recordingFindings(file = RECORDING) {
  const parsed = parseFallowReportText(readFileSync(file, 'utf8'));
  if (!parsed.ok) throw new Error(`the recording was refused (${parsed.code})`);
  const report = buildEvidenceReport({ raw: parsed.report, fileName: 'r.json', stripPrefix: null, importedAt: new Date().toISOString(), snapshotId: 's' });
  return report.normalized.findings;
}

/** Every file (never a folder) under `root`, `/`-separated and relative to it: what a snapshot's own file paths
 *  are. */
function projectFilePaths(root: string): string[] {
  const out: string[] = [];
  walk(root, (rel) => out.push(rel));
  return out;
}

/** T6: how many findings the recording (or a report crafted from it, `file`) gives Investigate to list for the
 *  project at `projectRoot` once normalised and resolved against its real files (`resolveFindings`) — never a raw
 *  finding count, which would also count one whose anchor is not a snapshot file. */
export function expectedFindingCount(projectRoot: string, file = RECORDING): number {
  const snapshotPaths = new Set(projectFilePaths(projectRoot));
  return resolveFindings(recordingFindings(file), snapshotPaths).matched.length;
}

/** The import cycle's finding id and reported line, read from the recording through the real parser and normaliser. */
export function cycleFinding(): { id: string; line: number } {
  const cycle = recordingFindings().find((f) => f.category === 'cycle' && f.path === CYCLE_ANCHOR && f.line !== null);
  if (!cycle || cycle.line === null) throw new Error('no import cycle on src/core/a.ts in the recording');
  return { id: cycle.id, line: cycle.line };
}

/** FM14: the recording's one unused-exports finding, on src/barrel/x.ts -- T4's "second, still-open finding",
 *  derived instead of hard-coded, read the same way as cycleFinding. */
export function unusedExportFinding(): string {
  const finding = recordingFindings().find((f) => f.category === 'unused-exports' && f.path === UNUSED_EXPORT_ANCHOR);
  if (!finding) throw new Error('no unused-exports finding on src/barrel/x.ts in the recording');
  return finding.id;
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

/** FM13: one shape for the recording's `check.unused_exports` entries, so writeReport's callers need no cast of
 *  their own. */
export type UnusedExportEntry = { path: string; export_name: string } & Record<string, unknown>;
/** The recording's raw JSON shape, typed only where writeReport's callers reach in (`check.unused_exports`);
 *  every other field stays `unknown`. */
type RecordingRaw = Record<string, unknown> & { check: { unused_exports: UnusedExportEntry[] } };

/** The 3.27.0 recording, parsed, changed by `edit` and written to `to`; returns `to`. */
export function writeReport(to: string, edit: (raw: RecordingRaw) => void): string {
  const raw = JSON.parse(readFileSync(RECORDING, 'utf8')) as RecordingRaw;
  edit(raw);
  writeFileSync(to, JSON.stringify(raw));
  return to;
}
