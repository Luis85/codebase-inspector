// scripts/assert-bundle.mjs — build-time guard, kept for the life of the project.
import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const files = readdirSync(dist).sort();
const main = readFileSync(dist + 'main.js', 'utf8');
const fail = (msg) => { console.error(`assert-bundle: ${msg}`); process.exitCode = 1; };

if (files.join(',') !== 'main.js,manifest.json,styles.css') {
  fail(`dist/ must contain exactly main.js, manifest.json and styles.css — found ${files.join(', ')}`);
}
if (main.includes('THREE_CJS_DEPRECATED') || main.includes('process.emitWarning')) {
  fail("dist/main.js pulled three's deprecated CommonJS stub. Check resolve.conditions in vite.config.ts.");
}
if (main.includes('new Function(') || /\beval\(/.test(main)) {
  fail('dist/main.js contains a runtime compiler. Vue must stay runtime-only, permanently.');
}
if (!main.includes('__esModule') || !/exports\.default\s*=/.test(main)) {
  fail('dist/main.js is not the named-CommonJS shape Obsidian loads.');
}

// Fix wave item 2 (I1). The test harness used to build with NODE_ENV=test inherited from
// Vitest, which flips Vite's mode, which drives import.meta.env.DEV — so
// city-renderer.ts's dev-only branch survived and tests/fixtures/dev-fixture was bundled
// into the shipped artefact. Both execSync call sites now pin NODE_ENV=production; this
// is the permanent guard behind that, on every build, including one a developer runs by
// hand.
if (main.includes('dev-fixture') || main.includes('devFixtureLayout')) {
  fail('dist/main.js contains the dev fixture. Check NODE_ENV / import.meta.env.DEV.');
}

// A Node built-in must never be BUNDLED (the ledger's long-standing deferred minor, and a
// cheap second guard behind obsidianmd/no-nodejs-modules). Reasoning for the shape of this
// check, which is not "does the string `node:` appear":
//   * vite.config.ts externalises every built-in in both bare and `node:` form, so a
//     static import that slipped past the lint rule does NOT get inlined — it surfaces as
//     a top-level `require("fs")` the Obsidian renderer would have to resolve itself.
//     That require call is therefore the actual symptom of a bundled built-in.
//   * node-access.ts legitimately contains the strings `node:original-fs` and `node:path`
//     — it passes them to Obsidian's own injected `window.require` at runtime, which is
//     the ONE sanctioned route to Node (spec 4.4) and must stay. Asserting on the bare
//     string would forbid the correct code and prove nothing about the incorrect code.
// The discriminator is the CALLEE: `window.require(...)` is node-access.ts asking the
// host; an unqualified `require(...)` is the bundler's own externalised import. Minified
// output may quote the specifier with ', " or a backtick, so all three are matched.
const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
const requires = [...main.matchAll(/(?:([A-Za-z_$][\w$]*)\s*\.\s*)?require\(\s*(["'`])([^"'`]+)\2\s*\)/g)];
const bundledBuiltins = requires
  .filter((m) => m[1] !== 'window' && builtins.has(m[3]))
  .map((m) => m[3]);
if (bundledBuiltins.length > 0) {
  fail(`dist/main.js bundles Node built-in(s): ${[...new Set(bundledBuiltins)].join(', ')}. `
    + 'All Node access goes through window.require in src/adapters/filesystem/node-access.ts.');
}

// Final-wave minor 2. The check above is about Node BUILT-INS only, so an ordinary
// dependency added to vite.config.ts's `external` list — where it looks harmless — left
// this script printing OK for a bundle that cannot load: a clean vault has no
// node_modules, no lockfile and no package manager, and `obsidian` is the only specifier
// the host injects. tests/host/build-output.test.ts catches it and `npm run verify` runs
// that test, but a developer running `npm run build` by hand was told OK. Same regex,
// same `window.require` exemption (that one is node-access.ts asking the host, spec §4.4).
const externals = [...new Set(requires.filter((m) => m[1] !== 'window').map((m) => m[3]))];
const unresolvable = externals.filter((specifier) => specifier !== 'obsidian');
if (unresolvable.length > 0) {
  fail(`dist/main.js asks the host to require ${unresolvable.join(', ')}. A vault resolves `
    + "nothing but 'obsidian' — the plugin would fail to load. Check rollupOptions.external.");
}
// Breakage-round item 2: GUARDED, because fail() sets process.exitCode and RETURNS --
// every check above runs, so that every reason is reported, and the run therefore
// carries on past a failure. Unconditional, this line made `OK` the last thing a build
// log said about a bundle that had just been rejected; the exit status was right and the
// output was a lie. Nothing above is changed: all reasons still go to stderr first.
if (process.exitCode) {
  console.error('assert-bundle: FAILED — dist/main.js was rejected for the reason(s) above.');
} else {
  console.log(`assert-bundle: OK — dist/main.js is ${(main.length / 1024).toFixed(0)} kB`);
}
