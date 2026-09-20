// The acceptance suite's entry point: parses tests/acceptance/wp01.feature and runs
// every scenario in it against the step definitions in ./steps/*.ts. See
// feature-runner.ts for the two properties that make it a gate (an unimplemented step
// fails; an unused step definition fails).
//
// `three` is doubled at exactly ONE seam -- WebGLRenderer -- and nothing else. jsdom
// resolves no WebGL2 context, so the real class cannot construct here; every other
// part of three (Scene, BufferGeometry, InstancedMesh, Material, and the real
// `dispose()` implementations disposal.ts calls) is the genuine module. That is what
// lets the "Dispose the real Three.js renderer" scenario drive the PRODUCTION
// `createCityRenderer` rather than a stand-in. The limitation is recorded in
// docs/superpowers/notes/2026-09-17-wp01-gate-evidence.md under G4; it is why the
// scenario asserts released resources and inert late callbacks, and asserts nothing
// about pixels.
import { describe, expect, it, vi } from 'vitest';
import featureSource from './wp01.feature?raw';

const webgl = vi.hoisted(() => ({
  instances: [] as { dispose: () => void; forceContextLoss: () => void }[],
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    domElement: HTMLCanvasElement;
    info = { memory: { geometries: 0, textures: 0 }, render: { calls: 0, frame: 0 }, programs: [] };
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    setClearColor = vi.fn();
    setAnimationLoop = vi.fn();
    render = vi.fn(() => { this.info.render.calls += 1; this.info.render.frame += 1; });
    getContext = vi.fn(() => ({ getExtension: () => ({ loseContext: () => {} }) }));
    constructor(params: { canvas: HTMLCanvasElement }) {
      // city-renderer.ts always supplies both the canvas and the context it resolved,
      // so there is nothing to fall back to and nothing here creates DOM of its own.
      this.domElement = params.canvas;
      webgl.instances.push(this);
    }
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

// ONE seam for the renderer FACTORY too: `world.ts`'s `rendererControl` decides, per
// scenario, whether a CityView gets a recording double (the host lifecycle scenarios,
// which need to interrogate what the view commanded) or the genuine production
// `createCityRenderer` (the disposal scenario, which is about the real thing). The
// control object is reached through a dynamic import because a vi.mock factory may not
// close over anything hoisting has not already evaluated.
vi.mock('../../src/visualization/city-renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/visualization/city-renderer')>();
  const { createRecordingRenderer, rendererControl } = await import('./world');
  return {
    ...actual,
    createCityRenderer: (mountEl: HTMLElement, win: Window, onEvent: (e: unknown) => void) => {
      if (rendererControl.useReal) {
        return actual.createCityRenderer(mountEl, win, onEvent);
      }
      const port = createRecordingRenderer();
      rendererControl.calls.push({ port, onEvent: onEvent, mountEl, win });
      return port;
    },
  };
});

const { assertNoUnusedSteps, mergeSteps, parseFeature, runFeature } = await import('./feature-runner');
const { makeWorld, teardownWorld } = await import('./world');
const { uiSteps } = await import('./steps/ui-steps');
const { evidenceSteps } = await import('./steps/evidence-steps');
const { sourceSteps } = await import('./steps/source-steps');
const { lifecycleSteps } = await import('./steps/lifecycle-steps');

export const webglInstances = webgl.instances;

const feature = parseFeature(featureSource);
const steps = mergeSteps(uiSteps, evidenceSteps, sourceSteps, lifecycleSteps);

/** The 21 scenarios of docs/concept/design/wp01-review/validation/production-acceptance.feature,
 *  by name. Listed here so a scenario cannot be quietly dropped or renamed out of the
 *  port: this is the acceptance criterion "all 21 acceptance scenarios pass" expressed
 *  as an assertion rather than as a claim in a report. */
const PORTED_21: readonly string[] = [
  'Select a file without moving the camera',
  'Close details without clearing selection',
  'Keep a selected file outside a new search',
  'Escape in search clears only the query',
  'Keyboard input belongs to the sibling note',
  'Restore a 3D camera after top-view exploration',
  'Dragging does not select on release',
  'Return to the scope review trigger',
  'Cancel a refresh without losing the valid snapshot',
  'Reject late result publication',
  'Preserve inventory without the renderer',
  'Clipboard failure has a usable alternative',
  'Do not scan while enabling or restoring the plugin',
  'Reject approval after root or scope changes',
  'Respect the approved source boundary',
  'Report unreadable content without measured-zero substitution',
  'Preserve independent state across two leaves',
  'Reconcile a file removed from the next snapshot',
  'Move a view to a pop-out window',
  'Dispose the real Three.js renderer',
  'Verify unchanged source after a real scan',
];

/** The three repairs spec §6 requires. */
const REPAIRS: readonly string[] = [
  'Vault is the codebase',
  'Theme change while a city is open',
  'Reject late result publication across profiles',
];

describe('wp01.feature is the whole port', () => {
  const names = feature.scenarios.map((s) => s.name);

  it('carries all 21 ported scenarios and the three repairs, and nothing else', () => {
    expect(names).toEqual([...PORTED_21, ...REPAIRS]);
    expect(names).toHaveLength(24);
  });

  it('defines no step no scenario uses', () => {
    assertNoUnusedSteps(feature, steps);
  });
});

runFeature({ feature, steps, makeWorld, teardown: teardownWorld });
