/** Browser demo contract. Explicitly adapt imports/types for the Obsidian build. */
export type FileKind = 'TypeScript' | 'JavaScript' | 'Vue' | 'Tests' | 'Styles' | 'JSON' | 'Markdown' | 'Other';
export interface FileRecord {
  readonly id: string;
  readonly path: string;
  readonly name: string;
  readonly category: FileKind;
  readonly lines: number | null;
  readonly bytes: number | null;
}
export interface Snapshot {
  readonly schemaVersion: 1;
  readonly name: string;
  readonly source: 'synthetic' | 'imported';
  readonly files: readonly FileRecord[];
}
export type CameraMode = '3d' | 'top';
export interface CameraState {
  theta: number;
  phi: number;
  zoom: number;
  target: [number, number, number];
  mode: CameraMode;
}
export interface RenderStats {
  revision: string;
  frames: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
}
export interface Diagnostics {
  revision: string;
  backend: 'WebGL2';
  files: number;
  frameCount: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  contextLost: boolean;
  mode: CameraMode;
}
export interface ViewerOptions {
  canvas: HTMLCanvasElement;
  labels: HTMLElement;
  onSelect?: (id: string) => void;
  onHover?: (file: FileRecord | null, point?: { x: number; y: number }) => void;
  onCameraChange?: (state: CameraState) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onRendered?: (stats: RenderStats) => void;
}
export declare class CityViewer {
  constructor(options: ViewerOptions);
  loadSnapshot(snapshot: Snapshot, options?: { fit?: boolean }): void;
  setSelected(id: string | null): void;
  setMatches(ids: Set<string> | null): void;
  setMetric(metric: 'lines' | 'bytes'): void;
  setLabels(show: boolean): void;
  setShadows(enabled: boolean): void;
  setTheme(name: 'light' | 'dark'): void;
  getCameraState(): CameraState;
  restoreCamera(state: CameraState): void;
  orbit(dx: number, dy?: number): void;
  pan(dx: number, dy: number): void;
  zoom(factor: number): void;
  setMode(mode: CameraMode): void;
  fit(): void;
  focusFile(id: string): void;
  pick(clientX: number, clientY: number): FileRecord | null;
  projectFile(id: string): { x: number; y: number; visible: boolean } | null;
  resize(): void;
  setSuspended(suspended: boolean): void;
  invalidate(): void;
  render(): void;
  capture(): string;
  getDiagnostics(): Diagnostics;
  simulateContextLoss(): void;
  restoreContext(): void;
  dispose(): void;
}
