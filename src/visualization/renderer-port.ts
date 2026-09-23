// CONTRACT NOTES — spec 4.2. Changing any of these is a section 4 contract change:
// stop and raise it with the user.
//
// * The port NEVER THROWS. WebGL2 unavailability, context-creation failure and
//   initialization failure are reported through onEvent as `unavailable`. Promise
//   rejection counts as throwing: an aborted or superseded setLayout RESOLVES without
//   applying. The view always mounts and always has a surface. (The prototype throws
//   from its constructor, which inside onOpen would break view construction and leave
//   a half-built leaf.)
// * The renderer consumes a LayoutResult, NEVER a CodebaseSnapshot. It never computes
//   layout, grouping or district assignment. A renderer API taking a snapshot is a
//   defect, not a convenience.
// * The VIEW owns sizing. The renderer installs no ResizeObserver of its own. resize()
//   re-applies setPixelRatio on EVERY call, clamping the supplied ratio to a maximum
//   of 2, and no-ops on a zero-size box. Resize NEVER implies fit.
// * Hover intent belongs to the renderer: hover-changed fires only after the 200 ms
//   dwell; the renderer owns the timer and raycasts only when it fires. A null entityId
//   is emitted immediately on leave.
// * The VIEW owns focus, keys and accessible naming. mountEl is the single focusable,
//   named region. The renderer's canvas is aria-hidden and never tabbable, and NO key
//   event crosses the port.
// * Camera mode is spelled '3d' | 'top' EVERYWHERE. In 'list' mode no renderer exists
//   and setCameraMode is never called. When setCamera receives a bookmark whose mode
//   differs from the current mode, THE BOOKMARK WINS and the renderer switches.
// * Camera ownership: the renderer owns the live camera and emits camera-changed; the
//   view mirrors it into CityViewState. A command to move the camera is a separate call
//   from the event, so host synchronisation does not loop.
// * NO `restored` event and NO self-healing. On unavailable{context-lost} the VIEW
//   disposes and reconstructs. Ship debugLoseContext; do NOT ship a restore partner.
//   Both prototypes implement self-healing; the Three.js prototype's own recorded run
//   logged 33 "WebGL: INVALID_OPERATION: delete: object does not belong to this
//   context" warnings in that path. That is the failure this rule prevents.
// * Pop-out migration is dispose() plus constructing a new renderer. There is no
//   rebind. The renderer must therefore be cheap to reconstruct from an existing
//   LayoutResult and CityViewState, with no data refetch and no scan.
// * pause/resume: hidden leaves suspend drawing and input, and visibility NEVER
//   authorises a scan.

import type { CategoryId } from '../domain/classify';
import type { CameraBookmark } from '../domain/model';
import type { LayoutResult } from '../domain/layout/types';

export type EntityId = string;          // the NUL-joined identity of section 4.1

export interface CityPalette {          // all values are resolved sRGB strings
  background: string;
  districtSurface: string;
  districtBorder: string;
  labelText: string;
  selection: string;
  unavailable: string;                  // the neutral of section 4.3
  categories: Readonly<Record<CategoryId, string>>;
}

export interface RendererDiagnostics {
  geometries: number; textures: number; programs: number;   // renderer.info
  drawCalls: number; instanceCount: number;
  lastFrameMs: number; contextLost: boolean;
}

export type CreateCityRenderer = (
  mountEl: HTMLElement,
  win: Window,                                   // the prototype omits this; we do not
  onEvent: (e: CityRendererEvent) => void,
) => CityRendererPort;

export interface CityRendererPort {
  setLayout(layout: LayoutResult,
            opts: { generation: number; signal: AbortSignal }): Promise<void>;
  setColors(palette: CityPalette): void;         // every colour the scene draws; re-supplied on css-change
  setSelection(selectedEntityId: EntityId | null): void;
  setFilter(matching: ReadonlySet<EntityId> | null): void;  // null = unfiltered, empty = no matches
  /** Part 6 Y40, the findings lens. null = category colours. A set keeps categories[colorKey]
   *  on the measured lots it contains and paints every other measured lot `unavailable`;
   *  unavailable markers never change. A RECOLOUR ONLY: no relayout, no camera change. The
   *  renderer keeps the set across setColors and setLayout; a NEW renderer starts at null. */
  setReported(ids: ReadonlySet<EntityId> | null): void;
  setLabels(visible: boolean): void;
  setCameraMode(mode: '3d' | 'top'): void;
  setMotion(mode: 'standard' | 'reduced'): void; // view reads matchMedia; renderer tweens or jumps
  getCamera(): CameraBookmark;
  setCamera(camera: CameraBookmark): void;
  nudgeCamera(delta: { orbit?: [number, number];     // radians
                       pan?: [number, number];       // CSS px of apparent movement
                       zoomFactor?: number }): void;
  focus(entityId: EntityId): void;
  fit(): void;
  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void;
  pause(): void;
  resume(): void;
  dispose(): void;
  getDiagnostics(): RendererDiagnostics;   // instrumentation
  debugLoseContext(): void;                // instrumentation
}

export type CityRendererEvent =
  | { type: 'entity-picked'; entityId: EntityId; snapshotId: string }
  | { type: 'hover-changed'; entityId: EntityId | null; snapshotId: string;
      position: { x: number; y: number } | null }   // canvas-relative, for tooltip anchoring
  | { type: 'camera-changed'; camera: CameraBookmark }
  | { type: 'unavailable'; reason: 'unsupported' | 'context-lost' | 'initialization-failed' };
