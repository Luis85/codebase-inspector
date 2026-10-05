/** Proposed UI boundaries. Reconcile with the implemented plugin before adopting. */
export type SourceId = string;
export type FileId = string;
export type SnapshotId = string;
export type EvidenceState = 'collected' | 'missing' | 'unsupported' | 'partial' | 'stale' | 'failed' | 'excluded';
export type EvidenceKind = 'observed' | 'modeled' | 'synthetic';

export interface EvidenceProvenance {
  readonly sourceId: SourceId;
  readonly snapshotId: SnapshotId;
  readonly provider: string;
  readonly providerVersion: string;
  readonly schemaVersion: string;
  readonly sourceRevision: string | null;
  readonly collectedAt: string;
  readonly configurationDigest: string;
  readonly kind: EvidenceKind;
}

export type Metric<T> =
  | { readonly state: 'collected'; readonly value: T; readonly provenance: EvidenceProvenance }
  | { readonly state: Exclude<EvidenceState, 'collected'>; readonly reason: string; readonly value?: T };

export interface FileSummary {
  readonly id: FileId;
  readonly sourceId: SourceId;
  readonly relativePath: string;
  readonly displayName: string;
  readonly moduleId: string;
  readonly sourceLines: Metric<number>;
  readonly maxFunctionCognitiveComplexity: Metric<number>;
  readonly commits: Metric<{ count: number; from: string; to: string }>;
  readonly branchCoverage: Metric<{ covered: number; total: number }>;
  readonly directDependents: Metric<number>;
}

export interface SourceDescriptor {
  readonly id: SourceId;
  readonly label: string;
  readonly kind: 'vault' | 'vault-directory' | 'external-directory';
  readonly configuredPath: string;
  readonly excludedGlobs: readonly string[];
  readonly access: 'read-only';
}

export interface DependencyEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly kind: 'source-import' | 'symbol-reference' | 'runtime-call' | 'co-change' | 'intended';
  readonly evidenceKind: EvidenceKind;
  readonly weight: number;
  readonly evidenceRefs: readonly string[];
}

export interface CityViewState {
  readonly files: readonly FileSummary[];
  readonly selectedFileId: FileId | null;
  readonly highlightedFileIds: ReadonlySet<FileId>;
  readonly snapshotId: SnapshotId;
  readonly colorLens: 'review-priority' | 'complexity' | 'coverage-gap' | 'change-frequency' | 'unused';
  readonly heightLens: 'complexity' | 'source-lines' | 'dependents';
  readonly representation: 'city' | 'map';
  readonly theme: 'host-light' | 'host-dark';
  readonly reducedMotion: boolean;
  readonly edges: readonly DependencyEdge[];
}

/** Implement with the existing Three.js city. The HTML Canvas fixture is not production code. */
export interface CityRenderer {
  mount(host: HTMLElement, state: CityViewState): void;
  update(state: CityViewState): void;
  onSelect(listener: (fileId: FileId) => void): () => void;
  onHover(listener: (fileId: FileId | null) => void): () => void;
  /** Only explicit user focus may move the camera toward selection. */
  focus(fileId: FileId): void;
  resetCamera(): void;
  setVisible(visible: boolean): void;
  /** Dispose graphics resources, event handlers, and observers. */
  dispose(): void;
}

export interface FindingDisposition {
  readonly findingFingerprint: string;
  readonly status: 'open' | 'acknowledged' | 'dismissed';
  readonly reason: string | null;
  readonly sourceId: SourceId;
  readonly evidenceSnapshotId: SnapshotId;
  readonly recordedAt: string;
}

export interface RefactorWorkItem {
  readonly id: string;
  readonly title: string;
  readonly status: 'investigate' | 'planned' | 'in-progress' | 'verified';
  readonly priority: 'high' | 'medium' | 'low';
  readonly fileIds: readonly FileId[];
  readonly evidenceRefs: readonly string[];
  readonly stewardshipTeam: string | null;
  readonly rationale: string;
  readonly verification: readonly { label: string; completed: boolean; evidenceRef?: string }[];
}
