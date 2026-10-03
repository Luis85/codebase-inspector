import type { CategoryId } from './classify';
import type { EntityId, EntityKind } from './entity-id';
import type { RouteId } from './route-ids';

export interface SourceReference { repositoryId: string; path: string }

export interface CodeEntity {
  id: EntityId; repositoryId: string; kind: EntityKind;
  path: string;                  // POSIX, root-relative
  name: string;                  // display name
  parentId: EntityId | null;
  category: CategoryId | null;   // null for repository and directory
}

export interface Measurement {
  metricId: 'physical-lines' | 'byte-size';
  unit: 'lines' | 'bytes';
  definitionVersion: '1';
}

export interface Observation {
  entityId: EntityId;
  measurement: Measurement;
  status: 'measured' | 'unavailable';
  value: number | null;          // NEVER 0 for unavailable
  reason: string | null;         // required when status is 'unavailable'
}

export interface ProviderRun {
  runId: string;
  provider: 'builtin-inventory';  // the built-in inventory IS a ProviderRun
  origin: 'collected';
  capturedAt: string;
  completedAt: string | null;
}

export interface AnalysisScope {
  rootPath: string;              // resolved, absolute — NEVER persisted through getState()
  exclusions: readonly string[];
  maxFileBytes: number;
  followSymlinks: false;         // static in WP-01; S13's row is explanatory text, not a toggle
}

export interface ApprovedInventoryRun {
  profileId: string;
  sourceFingerprint: string;     // over the resolved root
  scopeFingerprint: string;      // over exclusions + limits
  approvedAt: string;
  operation: 'read-only-inventory';
}

export interface CodebaseSnapshot {
  snapshotId: string;
  schemaVersion: 1;
  repositoryId: string;
  providerRun: ProviderRun;
  scope: AnalysisScope;
  entities: readonly CodeEntity[];
  observations: readonly Observation[];
  fileSetDigest: string;
  completeness: 'complete' | 'partial';   // a SECOND axis, not the run state
  warnings: readonly string[];
}

export interface CodebaseProfile {
  profileId: string; name: string; bindingId: string | null;
  exclusions: readonly string[]; maxFileBytes: number;
}

export interface LocalBinding {
  bindingId: string; label: string; rootPath: string; machineId: string;
}

/** Adopted from renderer-port.ts verbatim, with mode respelled from
 *  'three-dimensional' | 'top-down'. ABSOLUTE position/target/up is the persisted form:
 *  the prototype stores theta/phi/radius but recomputes radius from layout extent, so
 *  under dispose-and-reconstruct a restored bookmark would only be exact if the layout
 *  were byte-identical. */
export interface CameraBookmark {
  projection: 'orthographic';
  mode: '3d' | 'top';
  position: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  zoom: number;
}

export interface CityViewState {
  profileId: string | null;
  snapshotId: string | null;
  selectedEntityId: EntityId | null;
  query: string;
  viewMode: '3d' | 'top' | 'list';
  camera: CameraBookmark | null;
  previous3dCamera: CameraBookmark | null;  // load-bearing: without persisting it the
  inspectorOpen: boolean;                   // top<->3D round trip is lost on reload
  /** WP-02: the inspector screen this leaf shows. Optional so pre-WP-02 view state still validates. */
  route?: RouteId;
}
// There is NO lensId in WP-01.

/** Run state and snapshot completeness are two axes, not one (spec 4.1). */
export type InventoryRunState =
  | { status: 'idle' }
  | { status: 'running'; runId: string; generation: number;
      approval: ApprovedInventoryRun; processedFiles: number }
  | { status: 'cancelling'; runId: string; generation: number }
  | { status: 'cancelled'; runId: string }
  | { status: 'failed'; runId: string; message: string }
  | { status: 'complete'; runId: string; snapshotId: string };
