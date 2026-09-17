/**
 * Proposed WP-01 integration seam. Reconcile these shapes with the repository's
 * existing domain contracts before implementation; do not create duplicate models.
 * This is a declaration/contract, not an implemented Three.js renderer.
 */
export type FileId = string;
export type SnapshotId = string;
export type ViewId = string;
export type Vector3Value = readonly [number, number, number];

export type MeasuredValue =
  | { readonly status: 'measured'; readonly value: number }
  | { readonly status: 'unavailable'; readonly reason: string };

export interface FileInventoryEntry {
  readonly id: FileId;
  readonly relativePath: string;
  readonly category: string;
  readonly physicalLines: MeasuredValue;
  readonly bytes: MeasuredValue;
}

export interface InventorySnapshot {
  readonly id: SnapshotId;
  readonly profileId: string;
  readonly sourceFingerprint: string;
  readonly scopeFingerprint: string;
  readonly createdAt: string;
  readonly files: readonly FileInventoryEntry[];
  readonly completeness: 'complete' | 'partial';
  readonly warnings: readonly string[];
}

export interface CameraBookmark {
  readonly projection: 'orthographic';
  readonly mode: 'three-dimensional' | 'top-down';
  readonly position: Vector3Value;
  readonly target: Vector3Value;
  readonly up: Vector3Value;
  readonly zoom: number;
}

export interface CityLot {
  readonly fileId: FileId;
  readonly directoryId: string;
  readonly center: Vector3Value;
  readonly dimensions: Vector3Value;
}

export interface CityLayout {
  readonly snapshotId: SnapshotId;
  readonly layoutVersion: string;
  readonly lots: readonly CityLot[];
  readonly bounds: { readonly min: Vector3Value; readonly max: Vector3Value };
}

export interface CityTheme {
  readonly background: string;
  readonly districtSurface: string;
  readonly districtBorder: string;
  readonly labelText: string;
  readonly selection: string;
  readonly unknown: string;
  readonly categoryColors: Readonly<Record<string, string>>;
}

export interface CityPresentation {
  readonly selectedFileId: FileId | null;
  /** Null means no filter; an empty set means no matching files. */
  readonly matchingFileIds: ReadonlySet<FileId> | null;
  readonly labels: 'directories' | 'none';
  readonly theme: CityTheme;
  readonly motion: 'instant' | 'reduced' | 'standard';
}

export type CityRendererEvent =
  | { readonly type: 'file-selected'; readonly fileId: FileId; readonly snapshotId: SnapshotId }
  | { readonly type: 'hover-changed'; readonly fileId: FileId | null; readonly snapshotId: SnapshotId }
  | { readonly type: 'camera-changed'; readonly camera: CameraBookmark }
  | { readonly type: 'unavailable'; readonly reason: 'unsupported' | 'context-lost' | 'initialization-failed' }
  | { readonly type: 'restored' };

export interface CityRendererPort {
  /** Loads validated geometry; late/aborted completions must not replace a newer scene. */
  setScene(layout: CityLayout, options: { readonly generation: number; readonly signal: AbortSignal }): Promise<void>;
  /** Recoloring/selection/filter presentation must not recompute file layout. */
  setPresentation(presentation: CityPresentation): void;
  getCamera(): CameraBookmark;
  setCamera(camera: CameraBookmark): void;
  fitCity(): void;
  focusFile(fileId: FileId): void;
  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void;
  /** Hidden leaves suspend drawing and input; visibility never authorizes a scan. */
  setVisible(visible: boolean): void;
  /** Idempotent cleanup of observers, controls, listeners, RAF, and owned GPU assets. */
  dispose(): void;
}

export type CreateCityRenderer = (
  container: HTMLElement,
  onEvent: (event: CityRendererEvent) => void,
) => CityRendererPort;

export interface ApprovedInventoryRun {
  readonly profileId: string;
  readonly sourceFingerprint: string;
  readonly scopeFingerprint: string;
  readonly approvedAt: string;
  readonly operation: 'read-only-inventory';
}

export type InventoryRunState =
  | { readonly status: 'idle' }
  | { readonly status: 'running'; readonly runId: string; readonly generation: number;
      readonly approval: ApprovedInventoryRun; readonly processedFiles: number }
  | { readonly status: 'cancelling'; readonly runId: string; readonly generation: number }
  | { readonly status: 'cancelled'; readonly runId: string }
  | { readonly status: 'failed'; readonly runId: string; readonly message: string }
  | { readonly status: 'complete'; readonly runId: string; readonly snapshotId: SnapshotId };
