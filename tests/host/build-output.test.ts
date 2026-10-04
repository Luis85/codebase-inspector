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
  // NODE_ENV is pinned to 'production' explicitly (fix wave item 2, I1): this process is
  // Vitest, so NODE_ENV=test is inherited by the child, and Vite's MODE follows NODE_ENV
  // even though vite.config.ts pins `define: { 'process.env.NODE_ENV': '"production"' }`
  // for source substitution. `import.meta.env.DEV` is driven by the mode, not by that
  // define -- so without this the child produced a 152-module bundle carrying
  // tests/fixtures/dev-fixture, and every assertion below described an artefact that
  // never ships.
  execSync('npm run build', { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } });
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

  // Task 13 (the release gate). A clean vault has no node_modules, no lockfile and no
  // package manager: whatever the bundle asks the host to `require()` at load time must
  // be something Obsidian itself injects. `obsidian` is; anything else is a plugin that
  // fails to enable in exactly the vault this release is verified in. assert-bundle.mjs
  // already refuses Node BUILT-INS specifically — this is the complete set, so an
  // ordinary dependency added to vite.config.ts's `external` list (where it looks
  // harmless) is caught too. `window.require(...)` is excluded by the same reasoning as
  // in assert-bundle.mjs: that is node-access.ts asking the host, spec §4.4's one
  // sanctioned route, not the bundler's own externalised import.
  it('asks the host to require NOTHING but obsidian, because a clean vault resolves nothing else', () => {
    const specifiers = [...main.matchAll(/(?:([A-Za-z_$][\w$]*)\s*\.\s*)?require\(\s*(["'`])([^"'`]+)\2\s*\)/g)]
      .filter((m) => m[1] !== 'window')
      .map((m) => m[3]!);
    expect([...new Set(specifiers)].sort()).toEqual(['obsidian']);
  });

  // Task 13 fix round 1, Important 2. The README's claim — "It makes no network requests
  // of any kind" — is about the SHIPPED ARTEFACT, and until now the only sweep behind it
  // read `src/` (tests/host/clean-vault-install.test.ts). `dist/main.js` used to carry two
  // `new XMLHttpRequest` that `src/` does not: a FileSaver island from pinia's own
  // `dist/pinia.js`, which is the single entry pinia 4.0.3's `exports` map offers — there
  // is no production variant to select, and the helper survived tree-shaking even though
  // the devtools code that calls it did not. It was dead (`saveAs` has no caller), but
  // that was HAND-verified once, with nothing behind it. Gap closure GRA10/B23 removes it:
  // scripts/pinia-saveas-pure.mjs marks pinia's `saveAs` initialiser `/*#__PURE__*/`, so
  // the unreferenced island is tree-shaken, and the build FAILS if that needle vanishes.
  // The census is therefore pinned to ZERO, with no known exception left to hide behind.
  //
  // Two assertions, because the island can come back two different ways:
  //   * the network-API census itself, pinned to zero;
  //   * the absence of pinia's devtools entry points, which are the ONLY thing that
  //     called the island. `vite.config.ts`'s production `NODE_ENV` define is what
  //     eliminates them; flipping it back is an ordinary edit and is completely silent
  //     today.
  // Recorded in docs/superpowers/notes/2026-09-17-wp01-limitations.md, which this pins.
  it('carries no network call at all, because pinia\'s dead FileSaver island is tree-shaken', () => {
    const occurrences = (needle: string): number => main.split(needle).length - 1;
    expect(occurrences('XMLHttpRequest'), 'the FileSaver island is gone').toBe(0);
    expect(occurrences('new XMLHttpRequest'), 'no XHR of any kind').toBe(0);
    for (const api of ['fetch(', 'WebSocket', 'EventSource', 'sendBeacon', 'requestUrl']) {
      expect(occurrences(api), `dist/main.js reaches ${api}`).toBe(0);
    }
  });

  it('keeps the island DEAD: no devtools entry point survives the production build', () => {
    for (const hook of ['setupDevtoolsPlugin', '__VUE_DEVTOOLS_GLOBAL_HOOK__', 'devtools']) {
      expect(main.includes(hook), `dist/main.js carries ${hook}, which reaches the island`)
        .toBe(false);
    }
    // Not vacuous: the bundle really is the one pinia is in. `$onAction` is a pinia store
    // member (a property key, so minification keeps it) that no file in src/ mentions;
    // pinia's own error messages are dev-only and are stripped by the production define.
    expect(main).toContain('$onAction');
  });

  it('ships the repository manifest byte for byte', () => {
    // The installed folder name must equal the manifest id or onExternalSettingsChange
    // never fires, and every id/name/version assertion made about manifest.json is only
    // about the SHIPPED plugin if copy-manifest.mjs put that same file in dist/.
    expect(readFileSync(dist + 'manifest.json')).toEqual(readFileSync(root + 'manifest.json'));
  });

  // Fix wave item 2 (I1, Important): this whole suite used to assert against a bundle
  // nobody ships. `execSync('npm run build')` from inside Vitest inherited NODE_ENV=test,
  // which flips Vite's own mode, which drives `import.meta.env.DEV` -- so
  // city-renderer.ts's dev-only branch was NOT stripped and
  // `import('../../tests/fixtures/dev-fixture')` landed in dist/main.js (152 modules /
  // 733.17 kB, against production's 150 / 731.60 kB). Asserting on the MARKER, not on the
  // byte size: a size check would drift with every real change, where this names the
  // exact thing that must never be there.
  it('is the production bundle: no test fixture reaches the shipped artefact', () => {
    expect(main).not.toContain('devFixtureLayout');
    expect(main).not.toContain('dev-fixture');
  });
});
