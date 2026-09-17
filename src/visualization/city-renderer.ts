// Minimal CityRendererPort implementation (task 3). Task 10 replaces the guts; the
// interface does not change (spec 4.2, frozen). Every method exists, even where the
// body is a deliberate no-op — see task-3-report.md for which is which.
//
// THE PORT NEVER THROWS. WebGL2 unavailability and context-creation failure are
// reported through onEvent as `unavailable`, never thrown, and setLayout resolves
// without applying rather than rejecting when aborted or superseded.
//
// NO restored event and NO self-healing context restore (spec 4.2): on a lost context
// this file only reports `unavailable{context-lost}` — CityView is what disposes and
// reconstructs. debugLoseContext exists for instrumentation; there is no restore
// partner to go with it.
//
// Named imports only, never `import * as THREE` (spec 3.2).
import {
  AmbientLight, BoxGeometry, Color, DirectionalLight, InstancedMesh, Matrix4,
  MeshStandardMaterial, OrthographicCamera, Quaternion, Scene, Vector3, WebGLRenderer,
} from 'three';
import type { CameraBookmark } from '../domain/model';
import type {
  CityPalette, CityRendererPort, CreateCityRenderer, RendererDiagnostics,
} from './renderer-port';

const DEFAULT_CAMERA: CameraBookmark = {
  projection: 'orthographic',
  mode: '3d',
  position: [20, 20, 20],
  target: [0, 0, 0],
  up: [0, 1, 0],
  zoom: 1,
};

// r155/r165 removed useLegacyLights/physicallyCorrectLights. Any pre-r155 light
// intensity must be multiplied by pi (spec 3.2). These are the plan's own pre-r155
// base values (ambient 0.6, directional 1.2) — task 10 owns whether they are the
// right values; task 3 only carries the correct r155+ conversion (see task-3-report.md
// for what this looked like against the default MeshStandardMaterial).
const AMBIENT_INTENSITY = 0.6 * Math.PI;
const DIRECTIONAL_INTENSITY = 1.2 * Math.PI;

function makeInertPort(): CityRendererPort {
  let camera = DEFAULT_CAMERA;
  return {
    setLayout: async () => {},
    setColors: () => {},
    setSelection: () => {},
    setFilter: () => {},
    setLabels: () => {},
    setCameraMode: () => {},
    setMotion: () => {},
    getCamera: () => camera,
    setCamera: (next) => { camera = next; },
    nudgeCamera: () => {},
    focus: () => {},
    fit: () => {},
    resize: () => {},
    pause: () => {},
    resume: () => {},
    dispose: () => {},
    getDiagnostics: () => ({
      geometries: 0, textures: 0, programs: 0, drawCalls: 0, instanceCount: 0,
      lastFrameMs: 0, contextLost: false,
    }),
    debugLoseContext: () => {},
  };
}

export const createCityRenderer: CreateCityRenderer = (mountEl, win, onEvent) => {
  let canvas: HTMLCanvasElement;
  let threeRenderer: WebGLRenderer;
  try {
    canvas = win.document.createElement('canvas');   // injected window, never bare document
    canvas.setAttribute('aria-hidden', 'true');       // never tabbable — the view owns focus
    threeRenderer = new WebGLRenderer({ canvas, antialias: true });
  } catch {
    onEvent({ type: 'unavailable', reason: 'initialization-failed' });
    return makeInertPort();          // the view always mounts and always has a surface
  }
  mountEl.appendChild(canvas);

  const scene = new Scene();
  const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
  let cameraBookmark = DEFAULT_CAMERA;
  applyBookmarkToCamera(cameraBookmark);

  const ambient = new AmbientLight(0xffffff, AMBIENT_INTENSITY);
  const directional = new DirectionalLight(0xffffff, DIRECTIONAL_INTENSITY);
  directional.position.set(1, 2, 1);
  scene.add(ambient, directional);

  let mesh: InstancedMesh | null = null;
  let palette: CityPalette | null = null;
  let generation = -1;
  let paused = false;
  let contextLost = false;
  let lastFrameMs = 0;
  let instanceCount = 0;

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();     // suppress the default browser recovery UI; we do not restore in place
    contextLost = true;
    onEvent({ type: 'unavailable', reason: 'context-lost' });
  });

  function applyBookmarkToCamera(bookmark: CameraBookmark): void {
    camera.position.set(...bookmark.position);
    camera.up.set(...bookmark.up);
    camera.lookAt(...bookmark.target);
    camera.zoom = bookmark.zoom;
    camera.updateProjectionMatrix();
  }

  function render(): void {
    if (paused || contextLost) return;
    const start = Date.now();
    threeRenderer.render(scene, camera);
    lastFrameMs = Date.now() - start;
  }

  function disposeMesh(): void {
    if (!mesh) return;
    scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as MeshStandardMaterial).dispose();
    mesh.dispose();     // r186: Object3D.dispose() — subclasses overriding it must call super.dispose()
    mesh = null;
  }

  const port: CityRendererPort = {
    async setLayout(layout, opts) {
      if (opts.signal.aborted) return;      // resolves without applying, never rejects
      generation = opts.generation;
      const lots = layout.lots;

      disposeMesh();
      if (lots.length === 0) { render(); return; }

      const geometry = new BoxGeometry(1, 1, 1);
      const material = new MeshStandardMaterial({ color: 0xffffff });
      const next = new InstancedMesh(geometry, material, lots.length);
      const m = new Matrix4();
      const noRotation = new Quaternion();
      lots.forEach((lot, i) => {
        m.compose(new Vector3(...lot.center), noRotation, new Vector3(...lot.dimensions));
        next.setMatrixAt(i, m);
        const hex = palette?.categories[lot.colorKey] ?? palette?.unavailable ?? '#808080';
        next.setColorAt(i, new Color(hex));
      });
      next.instanceMatrix.needsUpdate = true;
      if (next.instanceColor) next.instanceColor.needsUpdate = true;

      if (opts.signal.aborted || opts.generation !== generation) {
        // Superseded while building: resolve without applying, never reject.
        next.geometry.dispose();
        next.material.dispose();
        return;
      }
      mesh = next;
      instanceCount = lots.length;
      scene.add(mesh);
      render();
    },

    setColors(next) {
      palette = next;
      threeRenderer.setClearColor(new Color(next.background));
      render();
    },

    // Selection state only; task 10 adds the visual highlight (raycast + material swap).
    setSelection() {},
    // Filter state only; task 10 hides/dims non-matching instances.
    setFilter() {},
    // Label overlay does not exist yet (task 10's label-overlay.ts).
    setLabels() {},

    setCameraMode(mode) {
      cameraBookmark = mode === 'top'
        ? { ...cameraBookmark, mode, position: [0, 30, 0], up: [0, 0, -1] }
        : { ...cameraBookmark, mode, position: DEFAULT_CAMERA.position, up: DEFAULT_CAMERA.up };
      applyBookmarkToCamera(cameraBookmark);
      render();
    },

    // Tweening belongs to task 10's camera-rig.ts; the minimal renderer has no motion.
    setMotion() {},

    getCamera: () => cameraBookmark,

    setCamera(bookmark) {
      cameraBookmark = bookmark;      // the bookmark wins, including a mode switch
      applyBookmarkToCamera(bookmark);
      render();
    },

    // Orbit/pan/zoom interaction math is task 10's picking.ts/camera-rig.ts.
    nudgeCamera() {},
    // Needs raycast-by-id lookup into the instanced mesh (task 10).
    focus() {},
    fit() {},

    resize(cssWidth, cssHeight, pixelRatio) {
      if (cssWidth <= 0 || cssHeight <= 0) return;   // no-ops on a zero-size box
      threeRenderer.setPixelRatio(Math.min(pixelRatio, 2));   // re-applied on EVERY call, max 2
      threeRenderer.setSize(cssWidth, cssHeight, false);
      const aspect = cssWidth / cssHeight;
      const frustum = 10;
      camera.left = -frustum * aspect;
      camera.right = frustum * aspect;
      camera.top = frustum;
      camera.bottom = -frustum;
      camera.updateProjectionMatrix();
      render();
    },

    pause() { paused = true; },
    resume() { paused = false; render(); },

    dispose() {
      disposeMesh();
      ambient.dispose();
      directional.dispose();
      threeRenderer.dispose();
      threeRenderer.forceContextLoss();
      canvas.remove();
    },

    getDiagnostics(): RendererDiagnostics {
      const info = threeRenderer.info;
      return {
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        programs: info.programs?.length ?? 0,
        drawCalls: info.render.calls,
        instanceCount,
        lastFrameMs,
        contextLost,
      };
    },

    debugLoseContext() {
      const ext = threeRenderer.getContext().getExtension('WEBGL_lose_context');
      ext?.loseContext();
    },
  };

  // Dev-only fixture path (never shipped — see tests/fixtures/dev-fixture.ts's own
  // comment for the dead-code-elimination mechanism: import.meta.env.DEV is a
  // Vite-injected compile-time constant, `false` in every production build, so this
  // whole branch is stripped from dist/main.js). Lets an implementer see the
  // instanced-box pipeline actually draw something while working on this file; it is
  // not a rendered control and nothing in the UI toggles it.
  if (import.meta.env.DEV && win.localStorage.getItem('codebase-inspector:dev-fixture') === '1') {
    void import('../../tests/fixtures/dev-fixture').then(({ devFixtureLayout }) => {
      const controller = new AbortController();
      void port.setLayout(devFixtureLayout(), { generation: 0, signal: controller.signal });
    });
  }

  render();
  return port;
};
