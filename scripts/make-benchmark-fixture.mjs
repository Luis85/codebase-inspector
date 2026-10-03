// Generates the two benchmark fixtures task 12 measures against: a 1,000-file
// FUNCTIONAL fixture (also the tree the G2 whole-tree no-write proof runs over at full
// scale) and a 5,000-file PERFORMANCE fixture.
//
// Deterministic by construction. Every name, every nesting decision and every file's
// length comes from one seeded linear congruential generator, so the same --files value
// always produces byte-for-byte the same tree. A benchmark whose input differs between
// runs measures nothing, and a no-write proof over a tree that is not reproducible
// cannot be re-checked by anybody else.
//
// The tree is a VAULT with this plugin already installed: `.obsidian/plugins/
// codebase-inspector/` carries dist/'s own files when a build exists. That is what makes
// the G2 proof cover the real configuration (task-12-brief.md step 3) rather than a
// bare directory the plugin has never been near, and it is what gives the read-log
// proof a genuine other-plugin data.json and a genuine own-output data.json to be
// absent from.
//
// Usage:
//   node scripts/make-benchmark-fixture.mjs --files 1000 --out <dir> [--force]
//
// Prints one line of JSON describing what it made, so a caller can assert on it:
//   {"root":"…","sourceFiles":1000,"totalEntries":1043,"excludedDirs":[…]}
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

/** A tiny LCG (Numerical Recipes' constants). Seeded per fixture size, never from a
 *  clock — see the determinism note above. */
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const EXTENSIONS = ['.ts', '.ts', '.ts', '.vue', '.css', '.json', '.md'];
const SEGMENTS = ['core', 'ui', 'domain', 'adapters', 'host', 'utils', 'model', 'view',
  'service', 'layout', 'render', 'store', 'parser', 'schema', 'api'];

function bodyFor(extension, lines, random) {
  const out = [];
  for (let i = 0; i < lines; i += 1) {
    const r = random();
    if (r < 0.12) out.push('');
    else if (r < 0.28) out.push(`// ${SEGMENTS[Math.floor(random() * SEGMENTS.length)]} note ${i}`);
    else if (extension === '.json') out.push(`  "key${i}": ${i},`);
    else if (extension === '.css') out.push(`.cls-${i} { margin: ${i % 12}px; }`);
    else if (extension === '.md') out.push(`Paragraph ${i} of the generated document.`);
    else out.push(`export const value${i} = ${i} * ${(i % 7) + 1};`);
  }
  if (extension === '.json') return `{\n${out.join('\n')}\n  "end": true\n}\n`;
  return `${out.join('\n')}\n`;
}

/** The directory a file lands in: a real tree, not a flat one. Depth 1-4, with the
 *  same segment vocabulary reused so directories genuinely accumulate siblings. */
function directoryFor(index, random) {
  const depth = 1 + Math.floor(random() * 4);
  const parts = ['src'];
  for (let d = 0; d < depth; d += 1) {
    parts.push(`${SEGMENTS[Math.floor(random() * SEGMENTS.length)]}-${Math.floor(random() * 6)}`);
  }
  if (index % 11 === 0) parts[0] = 'tests';
  if (index % 23 === 0) parts[0] = 'docs';
  return parts.join('/');
}

function write(root, relative, contents) {
  const absolute = join(root, ...relative.split('/'));
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
}

/** Everything a scan MUST NOT read, present for real so the read-log proof has
 *  something to be absent from rather than passing by absence. */
function writeExcluded(root) {
  write(root, '.git/config', '[core]\n\trepositoryformatversion = 0\n');
  write(root, '.git/HEAD', 'ref: refs/heads/main\n');
  write(root, '.git/objects/ab/cdef', 'not a real object\n');
  write(root, '.env', 'API_TOKEN=hunter2\nDATABASE_URL=postgres://localhost/secret\n');
  write(root, 'node_modules/left-pad/index.js', 'module.exports = () => {};\n');
  write(root, 'node_modules/left-pad/package.json', '{"name":"left-pad","version":"1.0.0"}\n');
  write(root, '.obsidian/workspace.json', '{"main":{"id":"root"}}\n');
  write(root, '.obsidian/appearance.json', '{"theme":"obsidian"}\n');
  write(root, '.obsidian/plugins/other-plugin/data.json', '{"token":"another plugin\'s secret"}\n');
  write(root, '.obsidian/plugins/other-plugin/main.js', 'module.exports = {};\n');
  // THIS plugin, installed. Real build output when there is one, a stand-in otherwise,
  // so the fixture is usable before `npm run build` has ever run.
  const dist = join(REPO_ROOT, 'dist');
  for (const name of ['main.js', 'manifest.json', 'styles.css']) {
    const target = join(root, '.obsidian', 'plugins', 'codebase-inspector', name);
    mkdirSync(dirname(target), { recursive: true });
    const source = join(dist, name);
    if (existsSync(source)) copyFileSync(source, target);
    else writeFileSync(target, `/* codebase-inspector ${name}: no dist build present */\n`);
  }
  write(root, '.obsidian/plugins/codebase-inspector/data.json',
    '{"profiles":[],"bindings":[],"lastSnapshotId":"generated"}\n');
}

export function makeBenchmarkFixture({ files, root, force = false }) {
  const marker = join(root, '.benchmark-fixture.json');
  const spec = { files, version: 2 };
  if (existsSync(marker) && !force) {
    const existing = JSON.parse(readFileSync(marker, 'utf8'));
    if (existing.files === spec.files && existing.version === spec.version) return existing;
    rmSync(root, { recursive: true, force: true });
  } else if (existsSync(root) && force) {
    rmSync(root, { recursive: true, force: true });
  }

  mkdirSync(root, { recursive: true });
  const random = makeRandom(files * 7919 + 13);
  const directories = new Set();
  for (let i = 0; i < files; i += 1) {
    const extension = EXTENSIONS[Math.floor(random() * EXTENSIONS.length)];
    const directory = directoryFor(i, random);
    directories.add(directory);
    const lines = 5 + Math.floor(random() * 400);
    write(root, `${directory}/file-${i}${extension}`, bodyFor(extension, lines, random));
  }
  // Content the collector must report as UNAVAILABLE rather than measured-zero: real
  // binary bytes, and a file past any sane maxFileBytes.
  write(root, 'assets/logo.bin', Buffer.from([0x00, 0x01, 0x02, 0xff, 0x00, 0xfe]));
  write(root, 'assets/huge.txt', 'x'.repeat(6_000_000));
  write(root, 'README.md', `# Benchmark fixture\n\n${files} generated source files.\n`);
  writeExcluded(root);

  const result = {
    ...spec,
    root,
    sourceFiles: files,
    directories: directories.size,
    excludedDirs: ['.git', 'node_modules', '.env', '.obsidian'],
  };
  writeFileSync(marker, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function parseArgs(argv) {
  const args = { files: 1000, out: null, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--files') { args.files = Number(argv[i + 1]); i += 1; }
    else if (argv[i] === '--out') { args.out = argv[i + 1]; i += 1; }
    else if (argv[i] === '--force') args.force = true;
  }
  if (!Number.isInteger(args.files) || args.files <= 0) throw new Error('--files must be a positive integer');
  if (!args.out) throw new Error('--out <dir> is required');
  return args;
}

// Only when run as a script, never on import.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = parseArgs(process.argv.slice(2));
  const result = makeBenchmarkFixture({ files: args.files, root: resolve(args.out), force: args.force });
  console.log(JSON.stringify(result));
}
