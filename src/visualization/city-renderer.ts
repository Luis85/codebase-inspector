// The full CityRendererPort (task 10). The interface does not change — it was frozen
// in task 2 (spec 4.2). This file is the composition root: it owns the WebGL surface,
// the scene and the lights, and wires together render-scheduler.ts (when a frame
// happens), camera-rig.ts (where the camera is), instanced-city.ts (what is drawn and
// which instance is which entity), picking.ts (what a pointer means), label-overlay.ts
// (district names as real DOM text) and disposal.ts (giving the GPU everything back).
//
// THE PORT NEVER THROWS. WebGL2 unavailability, context-creation failure and
// initialization failure are reported through onEvent as `unavailable`, and an aborted
// or superseded setLayout RESOLVES without applying rather than rejecting. The view
// always mounts and always has a surface.
//
// NO restored event and NO self-healing (spec 4.2): on a lost context this file only
// reports `unavailable{context-lost}` — the VIEW disposes and reconstructs.
// debugLoseContext() exists for instrumentation; there is no restore partner.
//
// Named imports only, never `import * as THREE` (spec 3.2). No bare `window`,
// `document`, `requestAnimationFrame`, `setInterval`, `ResizeObserver`,
// `IntersectionObserver` or DOM `instanceof` anywhere in src/visualization/.
import {
  AmbientLight, Color, DirectionalLight, Raycaster, Scene, Timer, Vector2, WebGLRenderer,
} from 'three';
import type { Object3D } from 'three';
import type { CameraBookmark } from '../domain/model';
import type { LayoutResult } from '../domain/layout/types';
import type {
  CityPalette, CityRendererPort, CreateCityRenderer, EntityId, RendererDiagnostics,
} from './renderer-port';
import { createScheduler } from './render-scheduler';
import { createCameraRig, ORBIT_RADIANS_PER_CSS_PX } from './camera-rig';
import { buildCity, lotRadius, type CityMeshes } from './instanced-city';
import { createPicking, type CanvasPoint } from './picking';
import { createLabelOverlay } from './label-overlay';
import { disposeObject3D, disposeRenderer } from './disposal';

// LIGHTING. r155/r165 removed useLegacyLights and physicallyCorrectLights, so
// intensities are physically correct now and any value authored before r155 is wrong by
// exactly a factor of pi. Each is therefore written literally as `<value> * Math.PI`.
//
// The BASE numbers are chosen, not inherited. MeshStandardMaterial's diffuse response
// is irradiance * albedo / pi, so an AmbientLight of `a * pi` contributes `a * albedo`
// and a DirectionalLight of `d * pi` contributes `dotNL * d * albedo`. With the sun at
// SUN_DIRECTION the largest dot product an axis-aligned box face can have is that
// direction's largest normalised component, 2/sqrt(6) ~ 0.8165. So for the brightest
// albedo a theme can hand us (1.0) the most-lit face lands at:
//
//   plan  0.6 / 1.2   ->  1.5798   clipped
//   brief 0.55 / 1.1  ->  1.4481   clipped — the brief's values do NOT fix the
//                                  blown-out white the task-S spike photographed
//   these 0.3  / 0.8  ->  0.9532
//
// (1.65 and 1.8 are the dotNL = 1 upper bounds — unattainable on a box lit from this
// direction, and NOT the figures above. Both are quoted here so a future reader can
// tell which number answers which question.)
//
// Staying under 1 is the floor, not the point. The point is that `new Color(hex)`
// converts sRGB -> working, so a mid-grey theme colour arrives at linear ~0.216 and its
// most-lit face renders at ~0.205 linear ~ sRGB 0.49 — the brightest face REPRODUCES
// THE PALETTE COLOUR almost exactly, which is what makes a category legible as the
// colour the legend shows. The shaded sides land at ~0.63 and ~0.30 of albedo, so a
// building still reads as a solid. tests/component/renderer-contract asserts that budget
// arithmetically, because nothing else catches a wrong intensity.
export const AMBIENT_BASE = 0.3;
export const DIRECTIONAL_BASE = 0.8;
export const SUN_DIRECTION: readonly [number, number, number] = [1, 2, 1];
const AMBIENT_INTENSITY = AMBIENT_BASE * Math.PI;
const DIRECTIONAL_INTENSITY = DIRECTIONAL_BASE * Math.PI;

const MAX_PIXEL_RATIO = 2;
const FOCUS_CONTEXT = 3;                // how much room a focused lot keeps around it

const DEFAULT_CAMERA: CameraBookmark = {
  projection: 'orthographic', mode: '3d',
  position: [20, 20, 20], target: [0, 0, 0], up: [0, 1, 0], zoom: 1,
};

/** Returned whenever no WebGL surface could be obtained, so the view always has a
 *  port to hold and never has to branch on null (spec 4.2). Every method is a no-op;
 *  getCamera/setCamera still round-trip so a persisted bookmark survives. */
function makeInertPort(): CityRendererPort {
  let camera = DEFAULT_CAMERA;
  return {
    setLayout: async () => {},
    setColors: () => {}, setSelection: () => {}, setFilter: () => {}, setLabels: () => {},
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

export const createCityRenderer: CreateCityRenderer = (mountEl, win, onEvent) => {
  let canvas: HTMLCanvasElement;
  let context: RenderingContext | null;
  try {
    canvas = win.document.createElement('canvas');   // injected window, never bare document
    canvas.setAttribute('aria-hidden', 'true');      // never tabbable — the view owns focus
    // Block, not the default inline: an inline canvas sits on a text baseline and
    // leaves a descender gap inside a stage sized to it exactly, which shows up as a
    // scrollbar the view never asked for.
    canvas.setCssStyles({ display: 'block' });
    context = canvas.getContext('webgl2');
  } catch {
    // getContext itself refused: the platform cannot give us a WebGL2 surface at all.
    onEvent({ type: 'unavailable', reason: 'unsupported' });
    return makeInertPort();
  }
  if (!context) {
    onEvent({ type: 'unavailable', reason: 'unsupported' });
    return makeInertPort();
  }

  let threeRenderer: WebGLRenderer;
  try {
    threeRenderer = new WebGLRenderer({ canvas, context, antialias: true });
  } catch {
    // A context exists but Three could not initialise against it — a different failure
    // from "this platform has no WebGL2", and the view distinguishes them.
    onEvent({ type: 'unavailable', reason: 'initialization-failed' });
    return makeInertPort();
  }
  mountEl.appendChild(canvas);

  const scene = new Scene();
  // Ambient light is neutral white and carries no category colour: CityPalette has no
  // ambient member — it is the seven fields of spec 4.2 and nothing more. Category
  // colour arrives per instance through setColorAt (instanced-city.ts).
  const ambient = new AmbientLight(0xffffff, AMBIENT_INTENSITY);
  const sun = new DirectionalLight(0xffffff, DIRECTIONAL_INTENSITY);
  sun.position.set(SUN_DIRECTION[0], SUN_DIRECTION[1], SUN_DIRECTION[2]);
  scene.add(ambient, sun);

  let city: CityMeshes | null = null;
  let layout: LayoutResult | null = null;
  let palette: CityPalette | null = null;
  let selection: EntityId | null = null;
  let filter: ReadonlySet<EntityId> | null = null;
  let labelsVisible = true;
  let cssWidth = 0;
  let cssHeight = 0;
  let paused = false;
  let contextLost = false;
  let disposed = false;
  let hasFitted = false;
  let lastFrameMs = 0;
  let latestGeneration = 0;

  const rig = createCameraRig({
    bounds: { min: [-1, 0, -1], max: [1, 1, 1] },
    onChanged: () => {
      // The EVENT, kept separate from the setCamera COMMAND so host synchronisation
      // does not loop (spec 4.2).
      onEvent({ type: 'camera-changed', camera: rig.getCamera() });
      scheduler.invalidate();
    },
  });

  /** Phase 2c, I1: the one flag object, hoisted so the three picking handlers below
   *  cannot drift apart and no allocation happens per pointer event. */
  const CONTINUOUS = { continuous: true } as const;

  const overlay = createLabelOverlay(mountEl);
  const timer = new Timer();          // r183 deprecated Clock; Timer is core since r179
  const raycaster = new Raycaster();
  const ndc = new Vector2();

  function draw(): void {
    if (disposed || contextLost || paused || cssWidth <= 0 || cssHeight <= 0) return;
    timer.update();
    const stillMoving = rig.advance(timer.getDelta() * 1000);
    overlay.update(rig.camera, cssWidth, cssHeight);
    const started = Date.now();
    threeRenderer.render(scene, rig.camera);
    lastFrameMs = Date.now() - started;
    // The ONLY thing that keeps frames coming, and it stops the frame the tween ends:
    // there is no inertia and no idle animation (acceptance criterion 2).
    if (stillMoving) scheduler.invalidate();
  }

  const scheduler = createScheduler(win, draw);

  function isActive(): boolean { return !disposed && !paused && !contextLost; }

  function hitTest(point: CanvasPoint): EntityId | null {
    if (!city || cssWidth <= 0 || cssHeight <= 0) return null;
    // Raycasting reads matrixWorld, which only the render pass would otherwise
    // refresh — and a pick can happen before any frame has drawn.
    scene.updateMatrixWorld();
    ndc.set((point.x / cssWidth) * 2 - 1, -(point.y / cssHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, rig.camera);
    // FILE LOTS ONLY: never labels, ground planes, district borders or overlays.
    const hits = raycaster.intersectObjects(city.pickTargets as Object3D[], false);
    for (const hit of hits) {
      if (hit.instanceId === undefined) continue;
      const entity = city.entityAt(hit.object, hit.instanceId);
      if (entity !== null) return entity;      // the batch-and-instance to entity map
    }
    return null;
  }

  const picking = createPicking({
    win, canvas, hitTest, isActive,
    onPick: (entityId) => {
      if (layout) onEvent({ type: 'entity-picked', entityId, snapshotId: layout.snapshotId });
    },
    onHover: (entityId, position) => {
      if (layout) onEvent({ type: 'hover-changed', entityId, snapshotId: layout.snapshotId, position });
    },
    // Phase 2c, I1: CONTINUOUS. These three are the only call sites in the codebase
    // that know the delta was produced by picking, i.e. at pointer rate -- a drag
    // delivers one per pointermove, ~60-1000 a second, and a wheel burst the same.
    // `nudgeCamera` below (the dock and the keyboard) is discrete and keeps the tween.
    // The flag is the rig's own; it never crosses the frozen 4.2 port boundary.
    onOrbit: (dx, dy) => {
      rig.nudge({ orbit: [-dx * ORBIT_RADIANS_PER_CSS_PX, -dy * ORBIT_RADIANS_PER_CSS_PX] }, CONTINUOUS);
    },
    onPan: (dx, dy) => { rig.nudge({ pan: [dx, dy] }, CONTINUOUS); },
    onZoom: (factor) => { rig.nudge({ zoomFactor: factor }, CONTINUOUS); },
  });

  function handleContextLost(): void {
    // Reported once, and never after dispose(): the view reacts to `unavailable` by
    // disposing and nulling its handle, so a late event re-enters that path against a
    // renderer that is already gone. There is no restore partner either way.
    if (contextLost || disposed) return;
    contextLost = true;
    scheduler.setContextLost(true);
    onEvent({ type: 'unavailable', reason: 'context-lost' });
  }

  const onContextLost = (event: Event): void => {
    event.preventDefault();             // suppress the browser's own recovery UI
    handleContextLost();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);

  function swapCity(next: CityMeshes | null, source: LayoutResult): void {
    city?.dispose();
    scene.remove(...scene.children.filter((child) => child.name === 'city-root'));
    city = next;
    layout = source;
    if (!next) return;
    next.root.name = 'city-root';
    scene.add(next.root);
    if (palette) next.setColors(palette);
    next.setFilter(filter);
    next.setSelection(selection);
    overlay.setDistricts(source.districts);
    if (palette) overlay.setColors(palette);
    rig.setBounds(source.bounds);
    if (!hasFitted) { hasFitted = true; rig.fit(); }    // the FIRST layout frames itself
    scheduler.invalidate();
  }

  const port: CityRendererPort = {
    async setLayout(next, opts): Promise<void> {
      if (opts.signal.aborted || disposed) return;     // resolves without applying
      latestGeneration = Math.max(latestGeneration, opts.generation);
      const superseded = (): boolean =>
        disposed || opts.signal.aborted || opts.generation < latestGeneration;
      // buildCity yields to the host between chunks — the task-S spike measured a
      // 160 ms click-handler violation from building a city synchronously. The
      // supersession check therefore sits AFTER a real await point, inside that loop
      // and again here, which is the only place it can do anything at all.
      const built = await buildCity(next, { win, superseded });
      if (!built) return;
      if (superseded()) { built.dispose(); return; }
      swapCity(built, next);
    },

    setColors(next: CityPalette): void {
      // Re-supplies EVERY colour the scene draws. Never moves a building, changes the
      // camera or clears selection/filter state (spec 4.4).
      palette = next;
      threeRenderer.setClearColor(new Color(next.background));
      city?.setColors(next);
      overlay.setColors(next);
      scheduler.invalidate();
    },

    setSelection(entityId: EntityId | null): void {
      selection = entityId;
      city?.setSelection(entityId);
      scheduler.invalidate();
    },

    setFilter(matching: ReadonlySet<EntityId> | null): void {
      filter = matching;               // null = unfiltered, empty = no matches
      city?.setFilter(matching);
      scheduler.invalidate();
    },

    setLabels(visible: boolean): void {
      labelsVisible = visible;
      overlay.setVisible(visible);
      scheduler.invalidate();
    },

    setCameraMode(mode: '3d' | 'top'): void { rig.setCameraMode(mode); },
    setMotion(mode: 'standard' | 'reduced'): void { rig.setMotion(mode); scheduler.invalidate(); },
    getCamera: () => rig.getCamera(),
    setCamera(bookmark: CameraBookmark): void { rig.setCamera(bookmark); scheduler.invalidate(); },
    nudgeCamera(delta): void { rig.nudge(delta); },

    focus(entityId: EntityId): void {
      const lot = city?.lotOf(entityId);
      if (!lot) return;
      rig.focusOn(lot.center, lotRadius(lot) * FOCUS_CONTEXT);
    },

    fit(): void { hasFitted = true; rig.fit(); },

    resize(width: number, height: number, pixelRatio: number): void {
      if (width <= 0 || height <= 0) return;        // hidden leaves cost nothing
      cssWidth = width;
      cssHeight = height;
      threeRenderer.setPixelRatio(Math.min(pixelRatio, MAX_PIXEL_RATIO));  // EVERY call
      // updateStyle TRUE, unlike task 3's minimal renderer: setSize(w, h, false)
      // resizes only the drawing buffer, leaving the canvas's CSS size at its
      // intrinsic attribute size — which at devicePixelRatio 2 is twice the box the
      // view measured. The VIEW owns deciding the size; applying it to our own canvas
      // is ours.
      threeRenderer.setSize(width, height, true);
      rig.setViewportSize(width, height);           // resize NEVER implies fit
      scheduler.invalidate();
    },

    pause(): void { paused = true; scheduler.setSuspended(true); },
    resume(): void { paused = false; scheduler.setSuspended(false); scheduler.invalidate(); },

    dispose(): void {
      if (disposed) return;                          // idempotent
      disposed = true;
      canvas.removeEventListener('webglcontextlost', onContextLost);
      scheduler.dispose();
      picking.dispose();
      overlay.dispose();
      city?.dispose();
      city = null;
      disposeObject3D(scene);        // the lights, and anything else left in the graph
      rig.dispose();
      disposeRenderer(threeRenderer);
      canvas.remove();
    },

    getDiagnostics(): RendererDiagnostics {
      const info = threeRenderer.info;
      return {
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
        drawCalls: info.render.calls,
        instanceCount: city?.instanceCount ?? 0,
        lastFrameMs,
        contextLost,
      };
    },

    debugLoseContext(): void {
      // Instrumentation, and the port never throws (spec 4.2) — no carve-out. Called
      // after dispose() or against an already-degraded context, getContext()/
      // getExtension() can throw; a no-op is the correct outcome, not a crash.
      try {
        threeRenderer.getContext().getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        // Already gone or unavailable — nothing to lose.
      }
      // Reported directly as well as through the extension: loseContext() delivers its
      // event asynchronously (and not at all where the extension is missing), and this
      // path is instrumentation whose whole purpose is to be observable. handleContextLost
      // reports once, so the real event arriving afterwards is a no-op.
      handleContextLost();
    },
  };

  overlay.setVisible(labelsVisible);

  // Dev-only fixture path (never shipped — see ./dev-fixture.ts's own comment for the
  // dead-code-elimination mechanism: import.meta.env.DEV is a Vite-injected
  // compile-time constant, `false` in every production build, so this whole branch is
  // stripped from dist/main.js). Not a rendered control; nothing in the UI toggles it.
  if (import.meta.env.DEV && win.localStorage.getItem('codebase-inspector:dev-fixture') === '1') {
    void import('./dev-fixture').then(({ devFixtureLayout }) => {
      const controller = new AbortController();
      return port.setLayout(devFixtureLayout(), { generation: 0, signal: controller.signal });
    });
  }

  return port;
};
