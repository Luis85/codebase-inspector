export as namespace CodebaseInspector3D;
export interface FileRecord { id: string; path: string; name: string; group: string; category: string; lines: number; bytes: number; j?: number; }
export interface RelationshipRecord { id: string; source: string; target: string; kind?: string; provenance?: string; }
export interface CameraState { yaw: number; pitch: number; zoom: number; x: number; y: number; z: number; }
export interface ViewerState { selectedId: string | null; query: string; mode: '3d' | 'top' | 'list'; camera: CameraState; }
export interface ViewerStats { engine: 'THREE.WebGLRenderer'; revision: string; webgl2: boolean; buildings: number; drawCalls: number; triangles: number; geometries: number; frames: number; displayedLinks: number; disposed: boolean; contextLost: boolean; }
export interface ViewerOptions {
  relationships?: RelationshipRecord[];
  minimap?: HTMLCanvasElement;
  onStats?: (stats: ViewerStats) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}
export declare const THREE_REVISION: string;
/** A trusted-data interaction reference, not an unbounded/untrusted source importer. */
export declare class ThreeCity {
  constructor(canvas: HTMLCanvasElement, files: FileRecord[], getState: () => ViewerState, onCamera: (patch: Partial<CameraState>) => void, onSelect: (id: string) => void, options?: ViewerOptions);
  invalidate(): void;
  position(id: string): {x: number; y: number; z: number} | null;
  pick(x: number, y: number): string | null;
  setLens(value: 'category' | 'directory'): void;
  setTheme(value: 'dark' | 'light'): void;
  setLabels(show: boolean): void;
  setDetail(show: boolean): void;
  setLinks(show: boolean): void;
  focusDistrict(name: string): void;
  capture(): string;
  stats(): ViewerStats;
  dispose(): void;
}
