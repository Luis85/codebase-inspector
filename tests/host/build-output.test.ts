import { beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
let main = '';

beforeAll(() => {
  // execSync, not execFileSync(cmd, args, { shell: true }): the latter triggers
  // Node's DEP0190 deprecation warning (an args array plus shell:true is what lets
  // an argv element be unsafely concatenated into the shell command line).
  // execSync takes one already-composed command string, so it runs through the
  // shell (needed for `npm`, whose own launcher is a .cmd/.ps1 wrapper on
  // Windows) without that pairing. A deliberate, authorised departure from the
  // plan's original snippet, to keep the suite's own output clean (fix round 1,
  // finding 3) — see tests/global-setup.ts for the identical reasoning.
  execSync('npm run build', { cwd: root, stdio: 'inherit' });
  main = readFileSync(dist + 'main.js', 'utf8');
}, 180_000);

describe('dist/', () => {
  it('contains exactly the three installable files', () => {
    expect(readdirSync(dist).sort()).toEqual(['main.js', 'manifest.json', 'styles.css']);
  });

  it('emits CommonJS with the named-exports shape Obsidian loads', () => {
    expect(main).toContain('__esModule');
    expect(main).toMatch(/exports\.default\s*=/);
    expect(main).not.toMatch(/^\s*import\s/m);
  });

  it('never pulls the r186 CommonJS stub', () => {
    // build/three.cjs is a 631-byte stub that calls process.emitWarning. If the bundler
    // resolves the `require` condition instead of `import`, this string appears and a
    // `process` reference is injected into the Obsidian renderer.
    expect(main).not.toContain('THREE_CJS_DEPRECATED');
    expect(main).not.toContain('process.emitWarning');
  });

  it('contains no runtime compiler, because Vue stays runtime-only', () => {
    expect(main).not.toContain('new Function(');
    expect(main).not.toMatch(/\beval\(/);
  });

  it('does not bundle externalised host modules', () => {
    expect(main).toMatch(/require\(["']obsidian["']\)/);
  });
});
