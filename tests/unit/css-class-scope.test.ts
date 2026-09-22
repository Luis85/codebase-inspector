// E55: a screen never borrows another screen's block class; shared looks live in kit.css.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI = resolve(process.cwd(), 'src', 'ui');
function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? vueFiles(p) : p.endsWith('.vue') ? [p] : [];
  });
}
const FILES = vueFiles(UI).map((p) => ({ path: relative(UI, p).replace(/\\/g, '/'), text: readFileSync(p, 'utf8') }));

/** Block prefix → the only files allowed to use it. */
const OWNERS: Readonly<Record<string, RegExp>> = {
  'ci-overview__': /^screens\/(OverviewScreen\.vue|overview\/)/,
  'ci-hotspots__': /^screens\/(HotspotsScreen\.vue|hotspots\/)/,
  'ci-findings-table__': /^screens\/(QualityScreen\.vue|quality\/)/,
};
const RETIRED = ['ci-hotspots__note', 'ci-hotspots__selected', 'ci-overview__cards', 'ci-overview__grid', 'ci-overview__empty', 'ci-findings-table__empty'];

describe('CSS class scope (E55)', () => {
  it('finds the Vue files', () => { expect(FILES.length).toBeGreaterThan(50); });
  it('uses no retired shared-by-accident class anywhere', () => {
    for (const f of FILES) for (const cls of RETIRED) expect(f.text.includes(cls), `${f.path} uses ${cls}`).toBe(false);
  });
  it('uses a screen block prefix only inside that screen', () => {
    for (const [prefix, owner] of Object.entries(OWNERS)) {
      for (const f of FILES) if (f.text.includes(prefix)) expect(owner.test(f.path), `${f.path} uses ${prefix}`).toBe(true);
    }
  });
  it('kit.css defines the shared classes', () => {
    const kit = readFileSync(join(UI, 'styles', 'kit.css'), 'utf8');
    for (const cls of ['.ci-note', '.ci-empty', '.ci-empty__title', '.ci-selected-strip', '.ci-screen__cards', '.ci-screen__grid', '.ci-chip ', '.ci-chip--sample']) {
      expect(kit.includes(`:where(.codebase-inspector-root) ${cls}`), cls).toBe(true);
    }
  });
});
