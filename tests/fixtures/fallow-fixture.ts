// Part 6 Y21: the recorded fallow reports (tests/fixtures/fallow/*.json, see its README)
// and helpers to break them one field at a time. The recordings are committed verbatim,
// `fragment` and `actions` included, because the tests prove those are dropped.
// Never assert on elapsed_ms, _meta or next_steps: they change on every recording.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import type { RawFallowReport } from '../../src/application/evidence/raw-fallow';

const DIR = fileURLToPath(new URL('./fallow/', import.meta.url));

export const FALLOW_FIXTURES = ['combined-3.27.0', 'dead-code-3.27.0', 'health-3.27.0', 'dupes-3.27.0', 'combined-3.21.0'] as const;
// WP-03 Part 1 N34: recordings of tests/fixtures/fallow/relations-project/, see its README.
export const RELATION_FIXTURES = ['relations-combined-3.27.0', 'relations-combined-3.21.0', 'relations-no-boundaries-3.27.0'] as const;
export type FallowFixture = (typeof FALLOW_FIXTURES)[number] | (typeof RELATION_FIXTURES)[number];
/** The relations fixture project's absolute directory (Task 13). */
export const RELATIONS_PROJECT_DIR = fileURLToPath(new URL('./fallow/relations-project/', import.meta.url));

type Row = Record<string, unknown>;

/** A report's JSON shape, loose enough for a test to break any field. Single-command
 *  reports carry their one section's fields at the top level (read them as `Row[]`). */
export interface FallowDoc {
  kind: unknown;
  schema_version: unknown;
  version: unknown;
  check?: { summary: Record<string, unknown>; unused_exports: Row[]; unused_types: Row[]; [key: string]: unknown } | null;
  dupes?: { clone_groups: (Row & { instances: Row[] })[]; [key: string]: unknown };
  health?: { findings: Row[]; summary: Row; [key: string]: unknown };
  workspace_diagnostics?: Row[];
  [key: string]: unknown;
}

export const fallowText = (name: FallowFixture): string => readFileSync(join(DIR, `${name}.json`), 'utf8');

/** A fresh copy of a recorded report, with one change applied. */
export function fallowDoc(name: FallowFixture, change?: (doc: FallowDoc) => void): FallowDoc {
  const doc = JSON.parse(fallowText(name)) as FallowDoc;
  change?.(doc);
  return doc;
}

/** Top-level rows of a single-command report (`unused_exports`, `findings`, `clone_groups`, …). */
export const rows = (doc: FallowDoc, key: string): Row[] => doc[key] as Row[];

/** "accepted", or the refusal as "<code> <detail>" (for example "invalid version"). */
export function fallowOutcome(doc: unknown): string {
  const result = parseFallowReportText(JSON.stringify(doc));
  return result.ok ? 'accepted' : `${result.code} ${result.detail}`.trim();
}

/** The validated report, for a fixture name or an edited document. */
export function rawReport(source: FallowFixture | FallowDoc): RawFallowReport {
  const text = typeof source === 'string' ? fallowText(source) : JSON.stringify(source);
  const result = parseFallowReportText(text);
  if (!result.ok) throw new Error(`refused: ${result.code} ${result.detail}`);
  return result.report;
}

function listTs(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...listTs(abs));
    else if (name.endsWith('.ts')) out.push(abs);
  }
  return out;
}

/** Every source line of the fixture project that is long enough to be unmistakable
 *  (12+ characters once trimmed). None may appear in anything the plugin keeps. */
export function fixtureSourceLines(): string[] {
  const lines = listTs(join(DIR, 'project', 'src')).flatMap((f) => readFileSync(f, 'utf8').split(/\r?\n/));
  return lines.map((l) => l.trim()).filter((l) => l.length >= 12);
}

/** Every key at any depth of a JSON-like value. */
export function deepKeys(value: unknown): Set<string> {
  const keys = new Set<string>();
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (typeof v !== 'object' || v === null) return;
    for (const [k, child] of Object.entries(v)) { keys.add(k); visit(child); }
  };
  visit(value);
  return keys;
}

/** Fix round 1 (E31, minor 4): every string value at any depth of a JSON-like value, so a
 *  test can prove source text never survives the parse, not just that its key does not. */
export function deepStrings(value: unknown): string[] {
  const strings: string[] = [];
  const visit = (v: unknown): void => {
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (typeof v === 'string') { strings.push(v); return; }
    if (typeof v !== 'object' || v === null) return;
    for (const child of Object.values(v)) visit(child);
  };
  visit(value);
  return strings;
}

/** Y23: fields fallow writes that must never survive the parse. */
export const DROPPED_KEYS = [
  'fragment', 'actions', 'suggestions', 'clone_families', 'vital_signs', 'file_scores', 'hotspots', 'targets',
  'health_score', 'next_steps', '_meta', 'elapsed_ms',
] as const;
