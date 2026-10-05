// Gap closure GRA10/B23. pinia 4.0.3 ships one entry (dist/pinia.js) whose FileSaver
// island (two XHRs) survives tree-shaking because `saveAs` is initialised by a
// conditional expression Rollup cannot prove side-effect free. The pre-transform wraps
// that initialiser in a `/*#__PURE__*/` IIFE so the unreferenced island drops out, and it
// FAILS the build when the needle disappears, so a pinia bump cannot silently undo it.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { piniaSaveAsPure } from '../../scripts/pinia-saveas-pure.mjs';

const SAVE_AS = 'const saveAs = !IS_CLIENT ? () => {} : typeof HTMLAnchorElement !== "undefined" && "download" in HTMLAnchorElement.prototype && !isMacOSWebView ? downloadSaveAs : "msSaveOrOpenBlob" in _navigator ? msSaveAs : fileSaverSaveAs;';
const PINIA = `const a = 1;\n${SAVE_AS}\nfunction downloadSaveAs() {}\n`;

function run(code: string, id: string) {
  const error = vi.fn((message: string): never => { throw new Error(message); });
  // Vite types `transform` as an ObjectHook; this plugin always supplies the plain function form.
  const transform = piniaSaveAsPure().transform as unknown as (this: { error: typeof error }, code: string, id: string) => unknown;
  const result = transform.call({ error }, code, id);
  return { result, error };
}

describe('piniaSaveAsPure', () => {
  it('runs before the other plugins', () => {
    expect(piniaSaveAsPure().enforce).toBe('pre');
  });

  it.each([
    ['posix', '/repo/node_modules/pinia/dist/pinia.js'],
    ['windows', 'C:\\repo\\node_modules\\pinia\\dist\\pinia.js'],
  ])('wraps the saveAs initialiser in a PURE iife (%s ids)', (_style, id) => {
    const { result } = run(PINIA, id);
    const code = (result as { code: string }).code;
    expect(code).toContain('const saveAs = /*#__PURE__*/ (() => !IS_CLIENT ? () => {} : ');
    expect(code).toContain('fileSaverSaveAs)();');
    expect(code).not.toContain('const saveAs = !IS_CLIENT');
    expect(code).toContain('const a = 1;');
    expect(code).toContain('function downloadSaveAs() {}');
  });

  it.each([
    '/repo/node_modules/pinia/dist/pinia.mjs',
    '/repo/node_modules/vue/dist/pinia.js',
    '/repo/src/ui/pinia.js',
  ])('returns null for any other id (%s)', (id) => {
    const { result, error } = run(PINIA, id);
    expect(result).toBeNull();
    expect(error).not.toHaveBeenCalled();
  });

  it('fails the build, naming GRA10, when the pinia id has no needle', () => {
    expect(() => run('const unrelated = 1;', '/repo/node_modules/pinia/dist/pinia.js')).toThrow(/GRA10/);
  });

  it('matches the needle in the pinia build that is actually installed', () => {
    // Not vacuous against a hand-written string: the real file must carry the needle.
    const real = readFileSync('node_modules/pinia/dist/pinia.js', 'utf8');
    const { result } = run(real, '/repo/node_modules/pinia/dist/pinia.js');
    expect((result as { code: string }).code).toContain('/*#__PURE__*/ (() => !IS_CLIENT');
  });
});
