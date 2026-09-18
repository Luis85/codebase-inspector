// Task 10 step 7, second half: disposal gives everything back. Split from
// renderer-contract.test.ts for the tests/** 450-line budget; the `three` double must
// be repeated because vi.mock is hoisted per FILE, but everything around it is shared
// through tests/fixtures/renderer-doubles.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
// Side-effect import: installs the createDiv/setCssStyles prototype extensions real
// Obsidian patches onto HTMLElement before any plugin loads (tests/mocks/obsidian.ts),
// which the renderer's label overlay uses to build its DOM in the right document.
import '../mocks/obsidian';
import { Object3D } from 'three';
import type { CityRendererEvent, CityRendererPort } from '../../src/visualization/renderer-port';
import {
  HEIGHT, WIDTH, captureGetContext, layoutOf, makeWinDouble, stubGetContext,
} from '../fixtures/renderer-doubles';

interface FakeRenderer {
  render: Mock; dispose: Mock; forceContextLoss: Mock; setPixelRatio: Mock;
  setSize: Mock; setClearColor: Mock;
  info: { memory: { geometries: number; textures: number } };
}

const probe = vi.hoisted(() => ({
  geometries: new Set<object>(),
  meshes: [] as object[],
  lines: [] as object[],
  renderers: [] as FakeRenderer[],
  failInit: false,
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  // Read and replaced through an index, not a method reference: an unbound method
  // reference is exactly what @typescript-eslint/unbound-method exists to stop.
  const geometryProto = actual.BufferGeometry.prototype as unknown as { dispose: () => void };
  const baseDispose = geometryProto.dispose;
  geometryProto.dispose = function untracked(this: object): void {
    probe.geometries.delete(this);
    baseDispose.call(this);
  };
  type Ctor = new (...args: never[]) => object;
  /** Wraps one of `actual`'s classes so every instance it constructs is registered,
   *  and BufferGeometry.prototype.dispose above unregisters it again. */
  const track = (name: keyof typeof actual, into: Set<object> | object[]): Ctor =>
    class extends (actual[name] as Ctor) {
      constructor(...args: never[]) {
        super(...args);
        if (Array.isArray(into)) into.push(this); else into.add(this);
      }
    };
  class FakeWebGLRenderer {
    info = {
      memory: { get geometries(): number { return probe.geometries.size; }, textures: 0 },
      programs: [], render: { calls: 0 },
    };
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    getContext = vi.fn(() => ({ getExtension: () => null }));
    constructor() {
      if (probe.failInit) throw new Error('WebGL initialization failed');
      probe.renderers.push(this);
    }
  }
  return {
    ...actual,
    BoxGeometry: track('BoxGeometry', probe.geometries),
    EdgesGeometry: track('EdgesGeometry', probe.geometries),
    BufferGeometry: track('BufferGeometry', probe.geometries),
    InstancedMesh: track('InstancedMesh', probe.meshes),
    LineSegments: track('LineSegments', probe.lines),
    WebGLRenderer: FakeWebGLRenderer,
  };
});

interface Harness {
  port: CityRendererPort;
  mount: HTMLElement;
  events: CityRendererEvent[];
  renderer: FakeRenderer;
  cancelSpy: ReturnType<typeof vi.fn>;
  resizeObserver: ReturnType<typeof vi.fn>;
  runFrames: () => void;
}

let restoreGetContext: () => void;

async function makeHarness(): Promise<Harness> {
  const { win, runFrames, cancelSpy, resizeObserver } = makeWinDouble();
  const events: CityRendererEvent[] = [];
  const mount = document.body.createDiv();
  const { createCityRenderer } = await import('../../src/visualization/city-renderer');
  const port = createCityRenderer(mount, win, (e) => events.push(e));
  return {
    port, mount, events, cancelSpy, resizeObserver, runFrames,
    renderer: probe.renderers[probe.renderers.length - 1] as FakeRenderer,
  };
}

beforeEach(() => {
  restoreGetContext = captureGetContext();
  probe.geometries.clear();
  probe.meshes.length = 0;
  probe.lines.length = 0;
  probe.renderers.length = 0;
  probe.failInit = false;
  stubGetContext('ok');
});

afterEach(() => {
  restoreGetContext();
  document.body.replaceChildren();
});

describe('disposal', () => {
  it('disposes every geometry, material, texture and render target', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    await h.port.setLayout(layoutOf('s1', 20), { generation: 1, signal: new AbortController().signal });
    expect(h.port.getDiagnostics().geometries).toBeGreaterThan(0);
    h.port.dispose();
    expect(h.renderer.info.memory.geometries).toBe(0);
    expect(h.renderer.info.memory.textures).toBe(0);
  });

  it('calls renderer.dispose() AND forceContextLoss()', async () => {
    const h = await makeHarness();
    h.port.dispose();
    expect(h.renderer.dispose).toHaveBeenCalled();
    expect(h.renderer.forceContextLoss).toHaveBeenCalled();
  });

  it('cancels the pending animation frame and every listener', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);        // leaves a frame pending
    h.port.dispose();
    expect(h.cancelSpy).toHaveBeenCalled();
    h.runFrames();
    expect(h.renderer.render).not.toHaveBeenCalled();
  });

  it('removes every DOM node it appended, including the label overlay', async () => {
    const h = await makeHarness();
    expect(h.mount.querySelector('canvas')).not.toBeNull();
    expect(h.mount.querySelector('.ci-city-labels')).not.toBeNull();
    h.port.dispose();
    expect(h.mount.querySelector('canvas')).toBeNull();
    expect(h.mount.querySelector('.ci-city-labels')).toBeNull();
    expect(h.mount.childElementCount).toBe(0);
  });

  it('is idempotent', async () => {
    const h = await makeHarness();
    h.port.dispose();
    expect(() => { h.port.dispose(); }).not.toThrow();
    expect(h.renderer.dispose).toHaveBeenCalledTimes(1);
  });

  it('calls super.dispose() in any Object3D subclass that overrides dispose', async () => {
    // r186 gave Object3D a dispose(). A subclass that overrides it without calling
    // super leaks whatever the base class now releases.
    const { CityRoot } = await import('../../src/visualization/instanced-city');
    expect(Object.prototype.hasOwnProperty.call(CityRoot.prototype, 'dispose')).toBe(true);
    const spy = vi.spyOn(Object3D.prototype, 'dispose');
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    await h.port.setLayout(layoutOf('s1', 4), { generation: 1, signal: new AbortController().signal });
    h.port.dispose();
    expect(spy.mock.instances.some((i) => i instanceof CityRoot)).toBe(true);
    spy.mockRestore();
  });

  it('releases the textures hanging off a material, not just the material', async () => {
    // The renderer draws no textures today, so the count above would pass vacuously;
    // this pins the mechanism that would have to hold the moment one is added.
    const { disposeObject3D } = await import('../../src/visualization/disposal');
    const dispose = vi.fn();
    const material = { isMaterial: true, map: { isTexture: true, dispose }, dispose: vi.fn() };
    const holder = new Object3D() as Object3D & { material: unknown };
    holder.material = material;
    disposeObject3D(holder);
    expect(dispose).toHaveBeenCalled();
    expect(material.dispose).toHaveBeenCalled();
  });

  it('emits no event after dispose, not even from instrumentation', async () => {
    // CityViewport reacts to `unavailable` by disposing and nulling its handle; an
    // event arriving after teardown would re-enter that path against a dead renderer.
    const h = await makeHarness();
    h.port.dispose();
    h.events.length = 0;
    h.port.debugLoseContext();
    h.port.resize(WIDTH, HEIGHT, 1);
    expect(h.events).toHaveLength(0);
  });

  it('leaks nothing across ten construct-and-dispose cycles', async () => {
    for (let i = 0; i < 10; i++) {
      const h = await makeHarness();
      h.port.resize(WIDTH, HEIGHT, 1);
      await h.port.setLayout(layoutOf(`s${i}`, 30), { generation: 1, signal: new AbortController().signal });
      h.port.dispose();
      h.mount.remove();
    }
    expect(probe.geometries.size).toBe(0);
    expect(document.body.querySelector('canvas')).toBeNull();
  });
});
