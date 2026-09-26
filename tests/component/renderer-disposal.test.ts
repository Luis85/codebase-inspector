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
  HEIGHT, ID, WIDTH, captureGetContext, layoutOf, layoutWithTwoDistricts, makeWinDouble,
  paletteFixture, stubGetContext,
} from '../fixtures/renderer-doubles';
import { createPicking } from '../../src/visualization/picking';

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

  // Phase 2 fix wave, I6 (Important): `swapCity`'s two re-application lines
  //   next.setFilter(filter); next.setSelection(selection);
  // could each be DELETED with the suite green at 751 (mutations P1 and N6), while
  // the neighbouring `setColors` and `setBounds` re-applications are pinned by three
  // and two tests. A new layout arrives on every rescan and on every
  // dispose-and-reconstruct (a context loss, a pop-out, a 320 px round trip); if
  // these regress, the outline and the search dimming silently vanish while
  // city-store still holds both, so the list, inspector and banner keep showing them
  // and the two halves of the view disagree with no error.
  it('I6: a NEW layout comes back with the live selection and filter still applied', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    h.port.setColors(paletteFixture());
    await h.port.setLayout(layoutOf('s1', 3), { generation: 1, signal: new AbortController().signal });

    h.port.setSelection(ID('src/f1.ts'));
    h.port.setFilter(new Set([ID('src/f1.ts')]));     // f0 and f2 are non-matches
    probe.meshes.length = 0;
    probe.lines.length = 0;                            // only the NEXT build's objects

    await h.port.setLayout(layoutOf('s2', 3), { generation: 2, signal: new AbortController().signal });

    // The selection outline is the last LineSegments a build constructs.
    const outline = probe.lines[probe.lines.length - 1] as { visible: boolean };
    expect(outline.visible).toBe(true);

    // ...and the first InstancedMesh is the measured-lot batch. A dimmed lot and a
    // matching one must not share a colour.
    const measured = probe.meshes[0] as { instanceColor: { array: ArrayLike<number> } | null };
    const colours = measured.instanceColor!.array;
    expect([colours[0], colours[1], colours[2]]).not.toEqual([colours[3], colours[4], colours[5]]);
  });

  // Phase 2 fix wave, I7 (Important): district labels had NO test at all, and three
  // independent ways of breaking them were all suite-green -- dropping
  // `overlay.setDistricts` entirely (no label is ever created), making `setVisible` a
  // no-op, and dropping the off-screen culling. Labels are one of the five additions
  // spec 4.2 records as proved necessary, and `setLabels` is on the frozen port.
  it('I7: builds one label per district, named, in the mount element', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    await h.port.setLayout(layoutWithTwoDistricts(), { generation: 1, signal: new AbortController().signal });

    const labels = [...h.mount.querySelectorAll('.ci-city-labels__label')];
    expect(labels).toHaveLength(2);
    // F1: each label is a chip of TWO spans now (name, file count), not a bare text
    // node — layoutWithTwoDistricts()'s two lots both belong to the 'src' district.
    expect(labels.map((el) => el.querySelector('.ci-city-labels__name')?.textContent)).toEqual(['src', 'tests']);
    expect(labels.map((el) => el.querySelector('.ci-city-labels__count')?.textContent))
      .toEqual(['2 files', '0 files']);
  });

  it('I7: culls the labels that are off screen, and only those', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    await h.port.setLayout(layoutWithTwoDistricts(), { generation: 1, signal: new AbortController().signal });
    h.runFrames();          // labels are repositioned on render, not on setLayout

    const labels = [...h.mount.querySelectorAll('.ci-city-labels__label')] as HTMLElement[];
    expect(labels[0]!.hidden).toBe(false);      // 'src', at the fitted centre
    expect(labels[1]!.hidden).toBe(true);       // 'tests', anchored 5000 units away
  });

  it('I7: setLabels(false) hides the whole overlay', async () => {
    const h = await makeHarness();
    h.port.resize(WIDTH, HEIGHT, 1);
    await h.port.setLayout(layoutWithTwoDistricts(), { generation: 1, signal: new AbortController().signal });
    const overlay = h.mount.querySelector('.ci-city-labels') as HTMLElement;
    expect(overlay.hidden).toBe(false);
    h.port.setLabels(false);
    expect(overlay.hidden).toBe(true);
    h.port.setLabels(true);
    expect(overlay.hidden).toBe(false);
  });

  // Phase 2 fix wave, I8 (Important): `picking.dispose()` could leak canvas listeners
  // with nothing noticing -- removing the `pointermove` removal, and never
  // registering the document-level `pointerup` at all, both left the suite green at
  // 751. Every pop-out migration, context loss and 320 px round trip disposes and
  // reconstructs a renderer, so a leaked pointermove accumulates one live closure per
  // cycle, each holding the canvas, the scene and the hitTest closure -- and each
  // still raycasting whenever isActive() happens to be true. Spec 4.4's manual-cleanup
  // list is explicit that Component does not cover this, and checkpoint #3's leak
  // check is aimed here. One assertion covers all seven registrations permanently.
  it('I8: picking removes on dispose exactly what it registered, canvas AND document', () => {
    const canvasEvents: string[] = [];
    const canvasRemoved: string[] = [];
    const docEvents: string[] = [];
    const docRemoved: string[] = [];
    const canvas = {
      addEventListener: (type: string) => canvasEvents.push(type),
      removeEventListener: (type: string) => canvasRemoved.push(type),
      getBoundingClientRect: () => ({ width: WIDTH, height: HEIGHT, left: 0, top: 0 }),
    } as unknown as HTMLCanvasElement;
    const win = {
      document: {
        addEventListener: (type: string) => docEvents.push(type),
        removeEventListener: (type: string) => docRemoved.push(type),
      },
      setTimeout: () => 1,
      clearTimeout: () => {},
    } as unknown as Window;

    const picking = createPicking({
      // Checkpoint #3 defect 7 retired `focusRoot`: it existed ONLY to answer "is this
      // canvas focused or engaged" for the wheel gate, and with the gate gone nothing
      // read it. An option nobody reads is the shape this branch keeps paying for.
      win, canvas,
      hitTest: () => null, onPick: () => {}, onHover: () => {},
      onOrbit: () => {}, onPan: () => {}, onZoom: () => {}, isActive: () => true,
    });

    expect(canvasEvents).toEqual([
      'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave', 'wheel',
    ]);
    // "A release outside the canvas still ends the gesture" -- its own documented
    // behaviour, and the second mutation showed it was unheld.
    expect(docEvents).toEqual(['pointerup']);

    picking.dispose();
    expect([...canvasRemoved].sort()).toEqual([...canvasEvents].sort());
    expect(docRemoved).toEqual(docEvents);
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
