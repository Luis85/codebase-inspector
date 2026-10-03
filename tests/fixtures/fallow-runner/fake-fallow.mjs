// Part 7 Z38: a stand-in for fallow, run as `node fake-fallow.mjs --mode=<mode> [fallow args…]`.
// The mode is an ARGUMENT because the runner filters the environment (Z16). The report it
// prints is the committed fallow 3.27.0 recording. Test-only: nothing under src/ runs it.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// PF1: a plain Node process with no window; the timer is read into a local binding.
const every = setInterval;
const mode = (process.argv[2] ?? '').replace(/^--mode=/, '');
const fixture = () => readFileSync(fileURLToPath(new URL('../fallow/combined-3.27.0.json', import.meta.url)));
const hang = () => { every(() => {}, 1_000); };
const exitAfter = (text, code) => { process.stdout.write(text, () => process.exit(code)); };

function writeBlocks(block, count, done) {
  let written = 0;
  const next = () => {
    while (written < count) {
      written += 1;
      if (!process.stdout.write(block)) { process.stdout.once('drain', next); return; }
    }
    done();
  };
  next();
}

switch (mode) {
  case 'version': process.stdout.write('fallow 3.27.0\n'); break;
  case 'version-4': process.stdout.write('fallow 4.0.0\n'); break;
  case 'version-untested': process.stdout.write('fallow 3.28.0\n'); break;
  case 'ok': process.stdout.write(fixture()); break;
  case 'findings-exit-1': exitAfter(fixture(), 1); break;
  case 'error-exit-2': exitAfter(JSON.stringify({ error: true, message: "invalid root path '/nope': No such file or directory (os error 2)", exit_code: 2 }), 2); break;
  case 'garbage': process.stdout.write('this is not json'); break;
  case 'truncated': { const text = fixture(); process.stdout.write(text.subarray(0, Math.floor(text.length / 2))); break; }
  case 'huge': writeBlocks(Buffer.alloc(1024 * 1024, 0x20), 17, () => {}); break;
  case 'streamed': process.stdout.write(fixture(), () => writeBlocks(Buffer.alloc(64 * 1024, 0x20), 192, () => {})); break;
  case 'stderr-flood': process.stderr.write(Buffer.alloc(1024 * 1024, 0x61)); process.stderr.write('\nlast line\n'); process.stdout.write(fixture()); break;
  case 'hang': hang(); break;
  case 'trickle': every(() => { process.stdout.write(' '); }, 50); break;
  case 'env-dump': process.stdout.write(JSON.stringify(Object.keys(process.env).sort())); break;
  case 'cwd': process.stdout.write(process.cwd()); break;
  case 'argv': process.stdout.write(JSON.stringify(process.argv.slice(3))); break;
  case 'grandchild': {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
    writeFileSync(join(process.cwd(), 'grandchild.pid'), String(child.pid));
    hang();
    break;
  }
  case 'html-stderr': process.stderr.write('<img src=x onerror=alert(1)>\n', () => process.exit(3)); break;
  default: process.stderr.write(`fake-fallow: unknown mode "${mode}"\n`, () => process.exit(9));
}
