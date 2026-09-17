// scripts/assert-bundle.mjs — build-time guard, kept for the life of the project.
import { readdirSync, readFileSync } from 'node:fs';
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
console.log(`assert-bundle: OK — dist/main.js is ${(main.length / 1024).toFixed(0)} kB`);
