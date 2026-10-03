// WP-03 N28/N29 (owner-approved §4.2 amendment, Task 11): the directed relation-arcs
// overlay. Two levels, following tests/component/renderer-reported.test.ts's own shape:
// relation-arcs.ts is driven directly with the real `three` (jsdom resolves no WebGL2
// context, but building BufferGeometry/InstancedMesh needs none), then the port
// (city-renderer.ts) is driven with only WebGLRenderer doubled, to prove setRelations
// survives setLayout — the renderer-reconstruction half of the contract (JF15).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../mocks/obsidian';
import {
  BufferGeometry, Color, InstancedMesh, LineSegments, Quaternion, Vector3,
} from 'three';
import type { BufferAttribute } from 'three';
import { createRelationArcs, MAX_RELATION_ARCS } from '../../src/visualization/relation-arcs';
import type { CityPalette, CityRendererPort, RelationArc } from '../../src/visualization/renderer-port';
import type { LayoutResult } from '../../src/domain/layout/types';
import {
  HEIGHT, ID, WIDTH, captureGetContext, layoutOf, makeWinDouble, paletteFixture, stubGetContext,
} from '../fixtures/renderer-doubles';

const SEGMENTS = 24;

/** Every wrapped relation-arcs instance the mocked factory below has produced, newest
 *  last — JF15: the REAL module, spied rather than replaced, so "through the port"
 *  assertions can see what city-renderer forwards without losing real behaviour (the
 *  fake GL renderer's own `info` stays all zeros, so draw calls can't be read from it). */
const relationArcsProbe = vi.hoisted(() => ({
  instances: [] as {
    setLots: ReturnType<typeof vi.fn>;
    setArcs: ReturnType<typeof vi.fn>;
    setColors: ReturnType<typeof vi.fn>;
    drawnCount: () => number;
  }[],
}));

vi.mock('../../src/visualization/relation-arcs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/visualization/relation-arcs')>();
  return {
    ...actual,
    createRelationArcs: (): ReturnType<typeof actual.createRelationArcs> => {
      const real = actual.createRelationArcs();
      const wrapped = {
        ...real,
        setLots: vi.fn((lots: Parameters<typeof real.setLots>[0]) => { real.setLots(lots); }),
        setArcs: vi.fn((arcs: Parameters<typeof real.setArcs>[0]) => { real.setArcs(arcs); }),
        setColors: vi.fn((palette: Parameters<typeof real.setColors>[0]) => { real.setColors(palette); }),
      };
      relationArcsProbe.instances.push(wrapped);
      return wrapped;
    },
  };
});

/** Every fake WebGLRenderer the port constructs, newest last (the renderer-reported.test.ts
 *  pattern) — only needed by 'the port' section below. */
const probe = vi.hoisted(() => ({ renderers: [] as { render: ReturnType<typeof vi.fn> }[] }));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakeWebGLRenderer {
    info = { memory: { geometries: 0, textures: 0 }, programs: [], render: { calls: 0 } };
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    forceContextLoss = vi.fn();
    getContext = vi.fn(() => ({ getExtension: () => null }));
    constructor() { probe.renderers.push(this); }
  }
  return { ...actual, WebGLRenderer: FakeWebGLRenderer };
});

const PALETTE = paletteFixture();

function fourLotLayout(): LayoutResult { return layoutOf('arcs', 4); }

function topOf(layout: LayoutResult, entityId: string): Vector3 {
  const lot = layout.lots.find((l) => l.entityId === entityId)!;
  return new Vector3(lot.center[0], lot.center[1] + lot.dimensions[1] / 2, lot.center[2]);
}

/** setLayout's arguments: a three-lot layout and a fresh job token (the
 *  renderer-reported.test.ts pattern) — captures nothing, so hoisted to module scope. */
const layoutArgs = (id: string, generation: number) =>
  [layoutOf(id, 3), { generation, signal: new AbortController().signal }] as const;

afterEach(() => { vi.restoreAllMocks(); });

describe('relation-arcs: geometry (N29)', () => {
  it('draws every valid arc as two draw calls, with the right vertex and instance counts', () => {
    const rig = createRelationArcs();
    rig.setLots(fourLotLayout().lots);
    rig.setColors(PALETTE);
    const a = ID('src/f0.ts');
    const b = ID('src/f1.ts');
    const c = ID('src/f2.ts');
    rig.setArcs([
      { from: a, to: b, role: 'outgoing' },
      { from: c, to: a, role: 'incoming' },
    ]);
    expect(rig.drawnCount()).toBe(2);
    expect(rig.root.children).toHaveLength(2);
    const [lineSegments, coneMesh] = rig.root.children as [LineSegments, InstancedMesh];
    const position = lineSegments.geometry.getAttribute('position') as BufferAttribute;
    expect(position.count).toBe(2 * SEGMENTS * 2);
    expect(coneMesh.count).toBe(2);
    rig.dispose();
  });

  it('orients the arrowhead\'s +Y onto the curve tangent at t = 0.92, nearer the "to" lot\'s top than the "from" lot\'s', () => {
    const rig = createRelationArcs();
    const layout = fourLotLayout();
    rig.setLots(layout.lots);
    rig.setColors(PALETTE);
    const a = ID('src/f0.ts');
    const b = ID('src/f1.ts');
    rig.setArcs([{ from: a, to: b, role: 'outgoing' }]);
    const [lineSegmentsMesh, coneMesh] = rig.root.children as [LineSegments, InstancedMesh];

    const matrix = coneMesh.matrixWorld.clone();
    coneMesh.getMatrixAt(0, matrix);
    const position = new Vector3();
    const quaternion = new Quaternion();
    const scale = new Vector3();
    matrix.decompose(position, quaternion, scale);

    // Segment 23 of 24 covers t in [22/24, 23/24] = [0.9167, 0.9583], which straddles
    // ARROW_AT (0.92): its own two vertices (indices 44, 45 — see relation-arcs.ts's
    // rebuild()) approximate the curve's own tangent there closely enough, over a 1/24
    // span of a smooth quadratic Bézier, to check the cone's rotation against it without
    // reimplementing the curve's own maths in the test.
    const attr = lineSegmentsMesh.geometry.getAttribute('position');
    const segmentStart = new Vector3().fromBufferAttribute(attr, 44);
    const segmentEnd = new Vector3().fromBufferAttribute(attr, 45);
    const approxTangent = segmentEnd.clone().sub(segmentStart).normalize();
    const rotatedUp = new Vector3(0, 1, 0).applyQuaternion(quaternion);
    expect(rotatedUp.dot(approxTangent)).toBeGreaterThan(0.999);

    const topA = topOf(layout, a);
    const topB = topOf(layout, b);
    expect(position.distanceTo(topB)).toBeLessThan(position.distanceTo(topA));
    rig.dispose();
  });

  it('colours each arc by its own role', () => {
    const rig = createRelationArcs();
    rig.setLots(fourLotLayout().lots);
    const palette: CityPalette = {
      ...PALETTE,
      relations: { outgoing: '#ff0000', incoming: '#00ff00', cycle: '#0000ff' },
    };
    rig.setColors(palette);
    const a = ID('src/f0.ts');
    const b = ID('src/f1.ts');
    const c = ID('src/f2.ts');
    rig.setArcs([
      { from: a, to: b, role: 'outgoing' },
      { from: c, to: a, role: 'incoming' },
    ]);
    const lineSegments = rig.root.children[0] as LineSegments;
    const color = lineSegments.geometry.getAttribute('color') as BufferAttribute;
    const arc0 = new Color(color.getX(0), color.getY(0), color.getZ(0));
    const arc1Start = SEGMENTS * 2;
    const arc1 = new Color(color.getX(arc1Start), color.getY(arc1Start), color.getZ(arc1Start));
    expect(arc0.getHexString()).toBe(new Color(palette.relations.outgoing).getHexString());
    expect(arc1.getHexString()).toBe(new Color(palette.relations.incoming).getHexString());
    rig.dispose();
  });

  it('keeps an arc whose end is not yet a lot, and draws it once the layout has both ends', () => {
    const rig = createRelationArcs();
    const layout = fourLotLayout();
    const missing = ID('src/missing.ts');
    const a = ID('src/f0.ts');
    rig.setColors(PALETTE);
    rig.setLots(layout.lots);
    rig.setArcs([{ from: a, to: missing, role: 'outgoing' }]);
    expect(rig.drawnCount()).toBe(0);
    const extended = [...layout.lots, { ...layout.lots[0]!, entityId: missing, center: [30, 1, 0] as [number, number, number] }];
    rig.setLots(extended);
    expect(rig.drawnCount()).toBe(1);
    rig.dispose();
  });

  it('never draws an arc whose ends are the same entity', () => {
    const rig = createRelationArcs();
    rig.setLots(fourLotLayout().lots);
    rig.setColors(PALETTE);
    const a = ID('src/f0.ts');
    rig.setArcs([{ from: a, to: a, role: 'cycle' }]);
    expect(rig.drawnCount()).toBe(0);
    rig.dispose();
  });

  it('caps drawing at MAX_RELATION_ARCS', () => {
    const rig = createRelationArcs();
    const layout = layoutOf('cap', 2);
    rig.setLots(layout.lots);
    rig.setColors(PALETTE);
    const [a, b] = layout.lots.map((l) => l.entityId) as [string, string];
    const many: RelationArc[] = Array.from({ length: 70 }, () => ({ from: a, to: b, role: 'outgoing' }));
    rig.setArcs(many);
    expect(rig.drawnCount()).toBe(MAX_RELATION_ARCS);
    rig.dispose();
  });

  it('setArcs(null) and setArcs([]) leave drawnCount 0 and empty the root', () => {
    const rig = createRelationArcs();
    rig.setLots(fourLotLayout().lots);
    rig.setColors(PALETTE);
    const a = ID('src/f0.ts');
    const b = ID('src/f1.ts');
    rig.setArcs([{ from: a, to: b, role: 'outgoing' }]);
    expect(rig.drawnCount()).toBe(1);
    rig.setArcs(null);
    expect(rig.drawnCount()).toBe(0);
    expect(rig.root.children).toHaveLength(0);
    rig.setArcs([{ from: a, to: b, role: 'outgoing' }]);
    rig.setArcs([]);
    expect(rig.drawnCount()).toBe(0);
    expect(rig.root.children).toHaveLength(0);
    rig.dispose();
  });

  it('setColors alone rewrites line AND cone colour without rebuilding the position geometry', () => {
    const rig = createRelationArcs();
    rig.setLots(fourLotLayout().lots);
    rig.setColors(PALETTE);
    const a = ID('src/f0.ts');
    const b = ID('src/f1.ts');
    rig.setArcs([{ from: a, to: b, role: 'outgoing' }]);
    const lineSegments = rig.root.children[0] as LineSegments;
    const coneMesh = rig.root.children[1] as InstancedMesh;
    const positionBefore = lineSegments.geometry.getAttribute('position');

    const next: CityPalette = { ...PALETTE, relations: { outgoing: '#ff0000', incoming: '#00ff00', cycle: '#0000ff' } };
    rig.setColors(next);

    // The SAME mesh, re-read from the root rather than the captured reference, so a
    // rebuild that happened to keep the same variable name couldn't slip past this.
    expect(rig.root.children[0]).toBe(lineSegments);
    expect(lineSegments.geometry.getAttribute('position')).toBe(positionBefore);

    const color = lineSegments.geometry.getAttribute('color') as BufferAttribute;
    expect(new Color(color.getX(0), color.getY(0), color.getZ(0)).getHexString())
      .toBe(new Color('#ff0000').getHexString());

    const coneColor = new Color();
    coneMesh.getColorAt(0, coneColor);
    expect(coneColor.getHexString()).toBe(new Color('#ff0000').getHexString());
    rig.dispose();
  });

  it('disposes every geometry AND every cone InstancedMesh no longer attached across 50 setArcs calls (no leak)', () => {
    const rig = createRelationArcs();
    const layout = fourLotLayout();
    rig.setLots(layout.lots);
    rig.setColors(PALETTE);
    const [a, b, c, d] = layout.lots.map((l) => l.entityId) as [string, string, string, string];
    const geometryDisposeSpy = vi.spyOn(BufferGeometry.prototype, 'dispose');
    // r186 gives InstancedMesh its own dispose() (frees instanceMatrix/instanceColor's GL
    // buffers), which disposeObject3D never calls on its own — this is what N29's
    // "repeated selection never leaks" is actually about, not just the two geometries.
    const meshDisposeSpy = vi.spyOn(InstancedMesh.prototype, 'dispose');
    const BUILDS = 50;
    for (let i = 0; i < BUILDS; i++) {
      rig.setArcs([{ from: i % 2 === 0 ? a : c, to: i % 2 === 0 ? b : d, role: 'outgoing' }]);
    }
    // Every build after the first replaces (and disposes) the previous one's two
    // geometries (line + cone) and one cone InstancedMesh; the first has nothing yet
    // attached to dispose.
    expect(geometryDisposeSpy).toHaveBeenCalledTimes((BUILDS - 1) * 2);
    expect(meshDisposeSpy).toHaveBeenCalledTimes(BUILDS - 1);
    rig.dispose();
    expect(geometryDisposeSpy).toHaveBeenCalledTimes(BUILDS * 2);
    expect(meshDisposeSpy).toHaveBeenCalledTimes(BUILDS);
  });

  it('never throws when setArcs precedes setLots/setColors, and draws once both arrive', () => {
    const rig = createRelationArcs();
    const a = ID('src/f0.ts');
    const b = ID('src/f1.ts');
    expect(() => rig.setArcs([{ from: a, to: b, role: 'outgoing' }])).not.toThrow();
    expect(rig.drawnCount()).toBe(0);
    rig.setLots(fourLotLayout().lots);
    rig.setColors(PALETTE);
    expect(rig.drawnCount()).toBe(1);
    rig.dispose();
  });
});

describe('the port: setRelations through CityRendererPort (N28)', () => {
  let restoreGetContext: () => void;
  const ports: CityRendererPort[] = [];
  beforeEach(() => {
    restoreGetContext = captureGetContext();
    stubGetContext('ok');
  });
  afterEach(() => {
    ports.splice(0).forEach((port) => { port.dispose(); });
    restoreGetContext();
    document.body.replaceChildren();
  });

  async function makePort(): Promise<CityRendererPort> {
    const { win } = makeWinDouble();
    const { createCityRenderer } = await import('../../src/visualization/city-renderer');
    const port = createCityRenderer(document.body.createDiv(), win, () => {});
    ports.push(port);
    port.resize(WIDTH, HEIGHT, 1);
    port.setColors(PALETTE);
    return port;
  }

  it('forwards setRelations to setArcs, and forwards lots and colours on layout and swap', async () => {
    const port = await makePort();
    const rig = relationArcsProbe.instances.at(-1)!;
    await port.setLayout(...layoutArgs('s1', 1));
    expect(rig.setLots).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ entityId: ID('src/f0.ts') }),
    ]));
    expect(rig.setColors).toHaveBeenCalledWith(PALETTE);
    const list: RelationArc[] = [{ from: ID('src/f0.ts'), to: ID('src/f1.ts'), role: 'outgoing' }];
    port.setRelations(list);
    expect(rig.setArcs).toHaveBeenCalledWith(list);
  });

  it('applies a setRelations sent BEFORE the first layout once the city lands, and survives a second setLayout', async () => {
    const port = await makePort();
    const rig = relationArcsProbe.instances.at(-1)!;
    const list: RelationArc[] = [{ from: ID('src/f0.ts'), to: ID('src/f1.ts'), role: 'outgoing' }];
    port.setRelations(list);
    expect(rig.setArcs).toHaveBeenCalledWith(list);
    expect(rig.drawnCount()).toBe(0);                 // no lots yet: kept, not drawn
    await port.setLayout(...layoutArgs('s1', 1));
    expect(rig.drawnCount()).toBe(1);
    await port.setLayout(...layoutArgs('s2', 2));      // a rebuilt city, as after a rescan
    expect(rig.drawnCount()).toBe(1);                  // survives the new layout
  });

  it('the inert port (no WebGL2) accepts setRelations without throwing', async () => {
    stubGetContext('null');
    const { createCityRenderer } = await import('../../src/visualization/city-renderer');
    const port = createCityRenderer(document.body.createDiv(), makeWinDouble().win, () => {});
    ports.push(port);
    expect(() => {
      port.setRelations([{ from: ID('src/f0.ts'), to: ID('src/f1.ts'), role: 'cycle' }]);
      port.setRelations(null);
    }).not.toThrow();
  });
});
