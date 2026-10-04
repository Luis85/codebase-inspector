// GRC11 (GCO20): the shipped deliverables say so. WP-01 to WP-04 and Plugin Foundations are `delivered`, each with a
// `## Delivery record` that names PR #1; everything else, Snapshot History (WP-05) included, stays `planned`.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const DIR = resolve(process.cwd(), 'docs', 'deliverables');
const DELIVERED: Readonly<Record<string, string | undefined>> = {
  'Native Codebase City.md': 'WP-01',
  'Fallow Ingestion.md': 'WP-02',
  'Dependencies and Architecture.md': 'WP-03',
  'Investigation and Notes.md': 'WP-04',
  'Plugin Foundations.md': undefined,
};

interface Doc { name: string; meta: Record<string, unknown>; body: string }
function load(name: string): Doc {
  const text = readFileSync(join(DIR, name), 'utf8').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) throw new Error(`${name} has no frontmatter`);
  return { name, meta: parse(m[1]!) as Record<string, unknown>, body: m[2]! };
}
const DOCS = readdirSync(DIR).filter((n) => n.endsWith('.md')).map(load);
/** The text of the `## Delivery record` section, or null when the file has none. */
const record = (doc: Doc): string | null => /^## Delivery record\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(doc.body)?.[1] ?? null;

describe('deliverable status (GRC11)', () => {
  it('marks exactly WP-01 to WP-04 and Plugin Foundations delivered', () => {
    const delivered = DOCS.filter((d) => d.meta.status === 'delivered').map((d) => d.name).sort();
    expect(delivered).toEqual(Object.keys(DELIVERED).sort());
  });
  it('gives each delivered work package its id, and Plugin Foundations one too', () => {
    for (const [name, id] of Object.entries(DELIVERED)) {
      const doc = DOCS.find((d) => d.name === name)!;
      if (id !== undefined) expect(doc.meta.id, name).toBe(id);
      else expect(typeof doc.meta.id, name).toBe('string');
    }
  });
  it('gives every delivered file a Delivery record that names PR #1', () => {
    for (const name of Object.keys(DELIVERED)) {
      const text = record(DOCS.find((d) => d.name === name)!);
      expect(text, `${name} has no "## Delivery record"`).not.toBeNull();
      expect(text, name).toContain('PR #1');
    }
  });
  it('keeps Snapshot History (WP-05) and every other deliverable planned', () => {
    const rest = DOCS.filter((d) => !(d.name in DELIVERED));
    expect(rest.map((d) => d.name)).toContain('Snapshot History.md');
    for (const d of rest) expect(d.meta.status, d.name).toBe('planned');
  });
});
