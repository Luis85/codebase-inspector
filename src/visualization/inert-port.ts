// Extracted from city-renderer.ts (J9, WP-03 Task 11) to make room under the 400-line
// cap for the relation-arcs wiring. Unchanged in shape except for the new no-op
// setRelations (N28): the inert port still never throws and still round-trips
// getCamera/setCamera so a persisted bookmark survives.
import type { CameraBookmark } from '../domain/model';
import type { CityRendererPort } from './renderer-port';

export const DEFAULT_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d',
  position: [20, 20, 20], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};

/** Returned whenever no WebGL surface could be obtained, so the view always has a
 *  port to hold and never has to branch on null (spec 4.2). Every method is a no-op;
 *  getCamera/setCamera still round-trip so a persisted bookmark survives. */
export function makeInertPort(): CityRendererPort {
  let camera = DEFAULT_CAMERA;
  return {
    setLayout: async () => {},
    setColors: () => {}, setSelection: () => {}, setFilter: () => {}, setReported: () => {}, setLabels: () => {},
    setRelations: () => {},
    setCameraMode: () => {}, setMotion: () => {},
    getCamera: () => camera,
    setCamera: (next) => { camera = next; },
    nudgeCamera: () => {}, focus: () => {}, fit: () => {}, resize: () => {},
    pause: () => {}, resume: () => {}, dispose: () => {},
    getDiagnostics: () => ({
      geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0,
      lastFrameMs: 0, contextLost: false,
    }),
    debugLoseContext: () => {},
  };
}
