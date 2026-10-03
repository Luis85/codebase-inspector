// WP-03 Task 7 fix round 1 (#6): the real relations recording (not a synthetic one —
// Task 14 extends attachSyntheticReport, in evidence-report.ts, with relation sections),
// shared by every component test that needs it instead of each copying its own path list
// and reader.
//
// WP-03 Part 1 Task 14 fix: split out of tests/fixtures/evidence-report.ts, which
// tests/harness/seed.ts imports (part of mount.ts's harness bundle — real Vite-built
// browser code, no Node runtime). A plain top-level `import { readFileSync } from
// 'node:fs'` — this file's own shape below — throws the MOMENT the module loads: Vite
// externalises `node:fs` for browser code, and the mere ESM binding of a named import
// from the externalised proxy module fails, whether or not anything ever calls
// `readFileSync`. With this file's own contents still inside evidence-report.ts, every
// harness capture page-errored ("Module 'node:fs' has been externalized…"), `npm run
// harness-shot` included, regardless of whether the capture used `report=demo`,
// `relations=`, or nothing relations-related at all — seed.ts's mere import of
// evidence-report.ts was enough. Deferring the READ (a lazy cache) was tried first and
// did not fix it: the import statement itself is what throws, before any call. This file
// is imported ONLY by real (Node-side) tests; the harness never reaches it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { InMemoryEvidenceStore } from '../../src/adapters/storage/in-memory-evidence-store';
import { parseFallowReportText } from '../../src/application/evidence/read-fallow-report';
import { buildEvidenceReport } from '../../src/application/evidence/normalize-fallow';
import { useEvidenceStore } from '../../src/ui/stores/evidence-store';
import type { CodebaseSnapshot } from '../../src/domain/model';
import type { EvidenceReport } from '../../src/application/evidence/model';

const IMPORTED_AT = '2026-09-23T10:00:00.000Z';

/** The recording's own paths, re-rooted without `src/` (tests/fixtures/fallow/README.md,
 *  "Relations project"); a report built with `{ stripPrefix: 'src/' }` resolves against a
 *  snapshot built from these. */
export const RELATIONS_PATHS = [
  'core/a.ts', 'core/b.ts', 'core/c.ts', 'barrel/index.ts', 'barrel/x.ts', 'barrel/y.ts',
  'ui/view.ts', 'data/db.ts', 'data/types.ts', 'index.ts', 'orphan.ts',
] as const;

/** Read once, straight from disk by a plain cwd-relative path — not
 *  `tests/fixtures/fallow-fixture.ts`'s `import.meta.url` helper, which jsdom's fake
 *  `location` resolves to a non-file URL under the component-test project, and this file
 *  is imported from both projects. */
export function relationsRecordingJson(name = 'relations-combined-3.27.0.json'): string {
  return readFileSync(join(process.cwd(), 'tests/fixtures/fallow', name), 'utf8');
}
const RELATIONS_JSON = relationsRecordingJson();

export interface RelationsReportOptions {
  /** Defaults to the snapshot's own id (current evidence). Any other id makes it stale. */
  snapshotId?: string;
  /** WP-03 Task 9: another recording's text (`relationsRecordingJson('relations-no-boundaries-3.27.0.json')`)
   *  or a synthesised copy of this one, read through the same parser, normaliser and strip prefix. */
  json?: string;
}

/** Binds the active leaf's evidence store to `snapshot`'s codebase and attaches the real
 *  relations recording, stripped of its `src/` prefix (JF14), the way `attachSyntheticReport`
 *  attaches a synthetic one. */
export function attachRelationsReport(snapshot: CodebaseSnapshot, options: RelationsReportOptions = {}): EvidenceReport {
  const parsed = parseFallowReportText(options.json ?? RELATIONS_JSON);
  if (!parsed.ok) throw new Error(`test setup: the relations fixture was refused (${parsed.code} ${parsed.detail})`);
  const report = buildEvidenceReport({
    raw: parsed.report, fileName: 'relations.json', importedAt: IMPORTED_AT,
    snapshotId: options.snapshotId ?? snapshot.snapshotId, stripPrefix: 'src/',
  });
  const store = useEvidenceStore();
  store.setRepository(new InMemoryEvidenceStore());
  store.bindRepository(snapshot.repositoryId);
  if (!store.attach(report)) throw new Error('test setup: the evidence store refused the report');
  return report;
}
