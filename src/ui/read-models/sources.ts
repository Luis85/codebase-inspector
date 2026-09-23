// Part 4 W2/W3/W15: Data & scans. The scope rows and the run state are real (collected
// from the snapshot on screen and the run store). Part 6 Y37: so is the fallow card, from
// the evidence index. Every other provider is sample or unknown and says so.
import type { CodebaseSnapshot, InventoryRunState } from '../../domain/model';
import type { RouteId } from '../../domain/route-ids';
import type { EvidenceOrigin } from '../../application/evidence/model';
import type { EvidenceState } from '../evidence';
import { formatAbsoluteTime } from '../copy';
import { countPartialRead } from '../view-surface';
import {
  EVIDENCE_SOURCE_NONE, EVIDENCE_SOURCE_SAMPLE, FALLOW_SOURCE, SOURCES_COMPLETE, SOURCES_NONE, SOURCES_PARTIAL, SOURCES_PROVIDER,
  SOURCES_ROW_CAPTURED, SOURCES_ROW_COMPLETENESS, SOURCES_ROW_EXCLUSIONS, SOURCES_ROW_FOLDER, SOURCES_ROW_LIMIT,
  SOURCES_ROW_PATH, SOURCES_ROW_SYMLINKS, SOURCES_SOURCE_BUILTIN, SOURCES_SOURCE_FICTIONAL, SOURCES_SYMLINKS_NOT_FOLLOWED,
} from '../inspector-copy';
import type { EvidenceIndexState } from './evidence-index';
import { rootFolderLabel } from './root-label';

export type RunView =
  | { kind: 'idle' } | { kind: 'running'; processed: number } | { kind: 'cancelling' }
  | { kind: 'cancelled' } | { kind: 'failed'; message: string } | { kind: 'complete' };

export function runView(run: InventoryRunState): RunView {
  switch (run.status) {
    case 'idle': return { kind: 'idle' };
    case 'running': return { kind: 'running', processed: run.processedFiles };
    case 'cancelling': return { kind: 'cancelling' };
    case 'cancelled': return { kind: 'cancelled' };
    case 'failed': return { kind: 'failed', message: run.message };
    case 'complete': return { kind: 'complete' };
    default: {
      const exhaustive: never = run;
      return exhaustive;
    }
  }
}

export interface ScopeRow { id: string; label: string; value: string; mono: boolean }
export interface ProviderCard {
  id: string; title: string; icon: string; state: EvidenceState; source: string; description: string; routes: readonly RouteId[];
}
export interface SourcesModel { scope: readonly ScopeRow[] | null; run: RunView; providers: readonly ProviderCard[] }

/** Hoisted to module scope (consistent-function-scoping): captures nothing per call. */
function formatFixed(v: number): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: 1 });
}

/** Part 5 V26: the unit is picked AFTER rounding to one decimal. Rounding is counted in
 *  tenths of a KB, which is exact for whole byte counts, so 999,950 bytes and up read
 *  "1 MB" and never "1,000 KB". */
export function formatBytes(n: number): string {
  if (Math.round(n / 100) >= 10_000) return `${formatFixed(n / 1_000_000)} MB`;
  if (n >= 1_000) return `${formatFixed(n / 1_000)} KB`;
  return n === 1 ? '1 byte' : `${n.toLocaleString('en-US')} bytes`;
}

function scopeRows(snapshot: CodebaseSnapshot): ScopeRow[] {
  const { scope } = snapshot;
  const partial = countPartialRead(snapshot);
  return [
    { id: 'folder', label: SOURCES_ROW_FOLDER, value: rootFolderLabel(scope.rootPath), mono: false },
    { id: 'path', label: SOURCES_ROW_PATH, value: scope.rootPath, mono: true },
    { id: 'exclusions', label: SOURCES_ROW_EXCLUSIONS, value: scope.exclusions.join(', ') || SOURCES_NONE, mono: true },
    { id: 'limit', label: SOURCES_ROW_LIMIT, value: formatBytes(scope.maxFileBytes), mono: false },
    { id: 'symlinks', label: SOURCES_ROW_SYMLINKS, value: SOURCES_SYMLINKS_NOT_FOLLOWED, mono: false },
    { id: 'captured', label: SOURCES_ROW_CAPTURED, value: formatAbsoluteTime(snapshot.providerRun.capturedAt, Intl), mono: false },
    { id: 'completeness', label: SOURCES_ROW_COMPLETENESS, value: partial ? SOURCES_PARTIAL(partial.measured, partial.included) : SOURCES_COMPLETE, mono: false },
  ];
}

const provider = (id: string, icon: string, state: EvidenceState, source: string, routes: readonly RouteId[]): ProviderCard => ({
  id, icon, state, source, routes, title: SOURCES_PROVIDER[id]?.title ?? id, description: SOURCES_PROVIDER[id]?.description ?? '',
});

/** Part 6 Y37: the fallow card's state comes from the evidence index (Y30, Y33).
 *  Part 7 Z27: `origin` is optional, so the Part 6 callers and tests keep their shape. */
interface FallowCardState { state: EvidenceIndexState; version: string | null; origin?: EvidenceOrigin }
const NO_FALLOW: FallowCardState = { state: 'none', version: null };
const FALLOW_EVIDENCE: Readonly<Record<EvidenceIndexState, EvidenceState>> = { none: 'unknown', current: 'collected', stale: 'stale' };

export function buildSourcesModel(snapshot: CodebaseSnapshot | null, run: InventoryRunState, fallow: FallowCardState = NO_FALLOW): SourcesModel {
  const inventory: EvidenceState = !snapshot ? 'unknown' : snapshot.completeness === 'partial' ? 'partial' : 'collected';
  return {
    scope: snapshot ? scopeRows(snapshot) : null,
    run: runView(run),
    providers: [
      provider('inventory', 'folder-tree', inventory, snapshot ? SOURCES_SOURCE_BUILTIN : EVIDENCE_SOURCE_NONE, ['city', 'overview']),
      provider('fallow', 'code', FALLOW_EVIDENCE[fallow.state], fallow.version === null ? EVIDENCE_SOURCE_NONE : FALLOW_SOURCE(fallow.version, fallow.origin ?? 'imported'), ['quality', 'file']),
      provider('imports', 'network', 'sample', EVIDENCE_SOURCE_SAMPLE, ['architecture']),
      provider('history', 'git-branch', 'sample', EVIDENCE_SOURCE_SAMPLE, ['hotspots', 'evolution', 'ownership']),
      provider('coverage', 'flask-conical', 'sample', EVIDENCE_SOURCE_SAMPLE, ['tests']),
      provider('packages', 'package', 'sample', SOURCES_SOURCE_FICTIONAL, ['dependencies', 'security']),
      provider('secrets', 'lock', 'unknown', EVIDENCE_SOURCE_NONE, ['security']),
      provider('runtime', 'activity', 'unknown', EVIDENCE_SOURCE_NONE, ['tests', 'security']),
    ],
  };
}
