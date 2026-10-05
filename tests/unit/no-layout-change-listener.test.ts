// Gap closure GRD8 (WP-04.2 ledger E4): native scenario 1 allows one `layout-change` listener per city leaf, the
// leak Obsidian's own unknown-view pane leaves when a plugin is disabled, so a plugin listener of exactly that shape
// is what the allowance would hide. No src file may name the event, so none can register it; the walk is the other
// static guards' (css-class-scope.test.ts, contrast-tokens.test.ts).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(process.cwd(), 'src');
const LAYOUT_CHANGE = /['"`]layout-change['"`]/u;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.(?:ts|vue)$/u.test(p) ? [p] : [];
  });
}

const FILES = sourceFiles(SRC).map((p) => ({ path: relative(SRC, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }));

describe('no layout-change listener (gap closure GRD8, E4)', () => {
  it('walks the source tree, entry point included', () => {
    expect(FILES.map((file) => file.path)).toContain('main.ts');
    expect(FILES.some((file) => file.path.endsWith('.vue'))).toBe(true);
  });

  it('catches the registration it guards against (positive control)', () => {
    expect(LAYOUT_CHANGE.test("this.registerEvent(this.app.workspace.on('layout-change', () => {}));")).toBe(true);
    expect(LAYOUT_CHANGE.test('workspace.on("layout-change", refresh)')).toBe(true);
    expect(LAYOUT_CHANGE.test('workspace.on(`layout-change`, refresh)')).toBe(true);
  });

  it('no src file names layout-change', () => {
    const offenders = FILES.filter((file) => LAYOUT_CHANGE.test(file.text)).map((file) => `src/${file.path}`);
    expect(offenders, `${offenders.join(', ')} names 'layout-change': a layout-change listener per leaf is what scenario 1's leak allowance would hide (E4)`).toEqual([]);
  });
});
